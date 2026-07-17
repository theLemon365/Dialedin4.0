/* ==========================================================
   notes.js — markdown notes, wiki links, templates, toggles,
   code blocks, bookmark cards, voice-to-text, journal, export
   ========================================================== */
"use strict";

const Notes = (() => {
  const { $, el, esc, toast, modal } = UI;

  let activeNoteId = null;
  let notesMode = "canvas"; // list | graph | canvas
  let activeCanvasId = null;
  let pendingGraphNodePos = null; // {id,x,y} — pins a just-created note at the right-click spot
  let graph3D = false; // toggled by the graph view's 2D/3D control
  let graphRotY = -0.5, graphRotX = -0.28; // orbit camera angles, only used in 3D mode

  // Single, module-level (not per-render) outside-click handler that closes any open
  // note/card color-swatch popover — attaching this inside render() instead would stack a
  // fresh listener on every repaint.
  document.addEventListener("click", e => {
    if (!e.target.closest(".note-color-pop") && !e.target.closest("#note-color-btn")) {
      const p = document.getElementById("note-color-pop"); if (p) p.classList.add("hidden");
    }
    if (!e.target.closest(".canvas-color-pop") && !e.target.closest(".card-color-dot")) {
      document.querySelectorAll(".canvas-color-pop").forEach(p => p.classList.add("hidden"));
    }
    if (!e.target.closest(".canvas-font-pop")) {
      document.querySelectorAll(".canvas-font-pop").forEach(p => p.classList.add("hidden"));
    }
  });

  const TEMPLATES = {
    "Daily Journal": `# Journal — {date}\n\n## How I feel\n\n\n## Top 3 for today\n- [ ] \n- [ ] \n- [ ] \n\n## Notes\n`,
    "Project Plan": `# Project: \n\n## Goal (one sentence)\n\n\n## Why it matters\n\n\n## Milestones\n- [ ] \n- [ ] \n\n## Risks\n> \n\n## First micro-step\n`,
    "Meeting Notes": `# Meeting — {date}\n\n**Who:** \n**Goal:** \n\n## Notes\n\n\n## Action items\n- [ ] \n`,
    "Book Notes": `# 📚 Book: \n\n**Author:** \n**Rating:** /10\n\n## Key ideas\n- \n\n## Favorite quotes\n> \n\n## How I'll apply it\n`,
    "Code Snippet": "# Snippet: \n\n```js\n// paste code here\n```\n\n## What it does\n\n\n## Gotchas\n",
  };

  const JOURNAL_PROMPTS = [
    "What would today look like if it were easy?",
    "What is one thing you're avoiding, and what's the real reason?",
    "If your future self watched you today, what would make them proud?",
    "What drained your energy yesterday? Can you shield it today?",
    "What tiny win from this week deserves more credit?",
    "What would you attempt if you knew you couldn't fail?",
    "Which habit is quietly shaping your life right now — good or bad?",
    "What does 'enough' look like today?",
    "Who do you want to be during hard moments?",
    "What's one thing you know you should do but keep postponing? Why?",
    "If today had a title like a book chapter, what would it be?",
    "What are you optimizing for this month — and is it the right thing?",
    "What advice do you keep giving others but not taking yourself?",
    "What made you feel most alive this week?",
  ];

  function dailyPrompt() {
    const seed = parseInt(Store.todayStr().replace(/-/g, ""), 10);
    return JOURNAL_PROMPTS[seed % JOURNAL_PROMPTS.length];
  }

  const NOTE_COLORS = [
    { id: "gray", hex: "#8a8f98" }, { id: "red", hex: "#e5484d" }, { id: "orange", hex: "#f5a524" },
    { id: "yellow", hex: "#e8c547" }, { id: "green", hex: "#46a758" }, { id: "blue", hex: "#5e6ad2" },
    { id: "purple", hex: "#8e6ff0" },
  ];

  const NOTE_FONTS = [
    { id: "", label: "Default", family: "" },
    { id: "serif", label: "Serif", family: "Georgia, 'Times New Roman', serif" },
    { id: "mono", label: "Monospace", family: "'JetBrains Mono', Consolas, monospace" },
    { id: "cursive", label: "Cursive", family: "'Brush Script MT', cursive" },
    { id: "classic", label: "Classic", family: "'Times New Roman', Times, serif" },
  ];

  function rgbToHex(rgb) {
    if (!rgb) return null;
    if (rgb.startsWith("#")) return rgb.toLowerCase();
    const m = rgb.match(/\d+/g);
    if (!m) return null;
    return "#" + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, "0")).join("");
  }

  // Converts bare shorthand (red:Food, bold:Hi, font:Cursive|text) into canonical {{…}} tokens.
  function normalizeMarkupSource(src) {
    return NotecardRenderer.normalizeSource(src);
  }

  function normalizeNoteBody(n) {
    if (!n?.body) return;
    const norm = normalizeMarkupSource(n.body);
    if (norm !== n.body) n.body = norm;
  }

  function resolveInlineStyledMarkup(html) {
    let out = html, prev = "";
    while (out !== prev) {
      prev = out;
      out = out.replace(/\{\{font:([^|{}]+)\|([^{}]+)\}\}/g, (m, font, inner) =>
        NotecardRenderer.astToHtml([{ type: "font", font: font.trim(), children: NotecardRenderer.parse(inner) }]));
      out = out.replace(/\{\{(\w+):([^{}]+)\}\}/g, (m, kind, inner) => {
        const id = kind.toLowerCase();
        const children = NotecardRenderer.parse(inner);
        if (NotecardRenderer.COLOR_IDS.includes(id))
          return NotecardRenderer.astToHtml([{ type: "color", color: id, children }]);
        if (NotecardRenderer.STYLE_IDS.includes(id))
          return NotecardRenderer.astToHtml([{ type: id, children }]);
        return m;
      });
    }
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="nc-bold">$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<u class="nc-underline">$1</u>');
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em class=\"nc-italic\">$2</em>");
    return out;
  }

  // Renders parsed AST as HTML — tokens never appear as plain strings.
  function renderRichText(src, opts = {}) {
    return NotecardRenderer.toHtml(src, opts);
  }

  function bodyForRender(n) {
    return { text: (n?.body || "").trim(), font: n?.font || null };
  }

  function noteMarkupSource(n) {
    let src = normalizeMarkupSource(n?.body || "");
    if (n?.font && src && !src.includes("{{font:")) src = `{{font:${n.font}|${src}}}`;
    return src;
  }

  function cardBodyText(card, n) {
    if (n?.body?.trim()) return n.body;
    if (card?.text?.trim()) {
      if (n) n.body = card.text;
      return card.text;
    }
    return "";
  }

  /* ---------- Markdown renderer (with wiki links, toggles, bookmarks) ---------- */
  function renderMarkdown(src) {
    let out = esc(normalizeMarkupSource(src || ""));

    // fenced code blocks first
    out = out.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) =>
      `<pre><code data-lang="${lang}">${code}</code></pre>`);

    // toggle lists:  >> Title  ...lines... <<
    out = out.replace(/^&gt;&gt; ?(.+)\n([\s\S]*?)^&lt;&lt;$/gm, (m, title, body) =>
      `<details><summary><b>${title}</b></summary>${body}</details>`);

    // wiki links [[Note Name]] — contenteditable="false" turns each one into an atomic chip
    // inside the rich-text editor, so clicking it navigates instead of just placing a cursor.
    out = out.replace(/\[\[([^\]]+)\]\]/g, (m, name) =>
      `<span class="wikilink" contenteditable="false" data-wiki="${name.trim()}">🔗 ${name.trim()}</span>`);

    // bookmark cards: lines that are just a URL
    out = out.replace(/^(https?:\/\/\S+)$/gm, url => {
      let host = url; try { host = new URL(url).hostname; } catch (e) {}
      return `<a class="bookmark-card" href="${url}" target="_blank">🔖 <b>${host}</b><br><span class="muted" style="font-size:.7rem">${url}</span></a>`;
    });

    // images ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\((\S+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:6px 0">');
    // links [text](url)
    out = out.replace(/\[([^\]]+)\]\((\S+?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // headers
    out = out.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    out = out.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    out = out.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    // blockquote
    out = out.replace(/^&gt; ?(.*)$/gm, "<blockquote>$1</blockquote>");
    // checkboxes & bullets
    out = out.replace(/^- \[x\] (.*)$/gmi, '<div>☑️ <s>$1</s></div>');
    out = out.replace(/^- \[ \] (.*)$/gm, '<div>⬜ $1</div>');
    out = out.replace(/^(\s*)- (.*)$/gm, "$1<li>$2</li>");
    out = out.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>");
    out = resolveInlineStyledMarkup(out);
    out = out.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    // paragraphs
    out = out.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
    return out;
  }

  /* ---------- Notes view ---------- */
  function render() {
    const v = $("#view-notes");
    v.innerHTML = `
      <div class="notes-mode-tabs">
        <button class="mode-btn ${notesMode === "list" ? "active" : ""}" data-mode="list">Notes</button>
        <button class="mode-btn ${notesMode === "graph" ? "active" : ""}" data-mode="graph">Graph View</button>
        <button class="mode-btn ${notesMode === "canvas" ? "active" : ""}" data-mode="canvas">Canvas</button>
      </div>
      <div id="notes-mode-body"></div>`;
    v.querySelectorAll(".notes-mode-tabs .mode-btn").forEach(b => b.onclick = () => { notesMode = b.dataset.mode; render(); });

    const body = $("#notes-mode-body");
    if (notesMode === "graph") renderGraphMode(body);
    else if (notesMode === "canvas") renderCanvasMode(body);
    else renderListMode(body);
  }

  let noteSearchQuery = "";
  let notesCanvasFilter = null;

  function noteById(id) { return Store.s.notes.find(n => n.id === id); }

  function canvasCardNote(card) { return card?.noteId ? noteById(card.noteId) : null; }

  function canvasDisplayLabel(cv) {
    const titles = (cv.cards || []).map(c => (canvasCardNote(c)?.title || c.title || "").trim()).filter(Boolean);
    if (!titles.length) return "Empty canvas";
    if (titles.length <= 2) return titles.join(" · ");
    return titles.slice(0, 2).join(" · ") + ` +${titles.length - 2}`;
  }

  function ensureNotesCanvasFilter() {
    ensureCanvases();
    if (!notesCanvasFilter || !Store.s.canvases.some(c => c.id === notesCanvasFilter))
      notesCanvasFilter = Store.s.canvases[0]?.id || null;
  }

  function syncCanvasConnectionsToGraph() {
    Store.s.canvases.forEach(cv => {
      (cv.connections || []).forEach(conn => {
        const ca = cv.cards.find(c => c.id === conn.from);
        const cb = cv.cards.find(c => c.id === conn.to);
        if (!ca?.noteId || !cb?.noteId) return;
        const a = noteById(ca.noteId), b = noteById(cb.noteId);
        if (!a || !b) return;
        a.links = a.links || [];
        b.links = b.links || [];
        if (!a.links.includes(b.id)) a.links.push(b.id);
        if (!b.links.includes(a.id)) b.links.push(a.id);
      });
    });
  }

  let notesRefreshTimer = null;
  function scheduleNotesRefresh() {
    clearTimeout(notesRefreshTimer);
    notesRefreshTimer = setTimeout(refreshNotesViews, 120);
  }

  function refreshNotesViews() {
    if (!$("#view-notes")?.classList.contains("active")) return;
    const body = $("#notes-mode-body");
    if (!body) return;
    if (notesMode === "list") renderListMode(body);
    else if (notesMode === "graph") renderGraphMode(body);
    else if (notesMode === "canvas") updateCanvasTabLabels(body);
  }

  function updateCanvasTabLabels(container) {
    container.querySelectorAll(".canvas-tab[data-id]").forEach(tab => {
      const c = Store.s.canvases.find(x => x.id === tab.dataset.id);
      const label = tab.querySelector(".canvas-tab-label");
      if (c && label) {
        label.textContent = canvasDisplayLabel(c);
        tab.title = canvasDisplayLabel(c);
      }
    });
  }

  function onNoteDataChange(n) {
    if (n) syncWikiLinks(n);
    syncCanvasConnectionsToGraph();
    Store.s.canvases.forEach(cv => { cv.name = canvasDisplayLabel(cv); });
    Store.save();
    scheduleNotesRefresh();
  }

  function attachNoteToCanvas(n, cvId) {
    const cv = Store.s.canvases.find(c => c.id === cvId);
    if (!cv || cv.cards.some(c => c.noteId === n.id)) return;
    cv.cards.push({
      id: "cc" + Date.now() + Math.floor(Math.random() * 1000),
      noteId: n.id, x: 40 + (cv.cards.length % 4) * 240, y: 40 + Math.floor(cv.cards.length / 4) * 170,
      w: 220, h: 150,
    });
  }

  function detachNoteFromCanvases(noteId) {
    Store.s.canvases.forEach(cv => {
      const dead = cv.cards.filter(c => c.noteId === noteId).map(c => c.id);
      cv.cards = cv.cards.filter(c => c.noteId !== noteId);
      cv.connections = (cv.connections || []).filter(c => !dead.includes(c.from) && !dead.includes(c.to));
      cv.name = canvasDisplayLabel(cv);
    });
  }

  function renderNoteBodyHtml(n) {
    const { text, font } = bodyForRender(n);
    return renderRichText(text, { font });
  }

  function mountNoteBody(el, n) {
    const { text, font } = bodyForRender(n);
    if (text || font) NotecardRenderer.mount(el, text, { font });
    else NotecardRenderer.unmount(el);
  }

  function refreshCanvasEditorContent(ed, n) {
    if (!n) return;
    const raw = NotecardRenderer.normalizeSource(n.body || "");
    ed.innerHTML = NotecardRenderer.toHtml(raw, { font: n.font }) || "";
  }

  function notePreviewHtml(n) {
    if (!n?.body?.trim() && !n?.font) return "";
    return renderNoteBodyHtml(n);
  }

  function saveCaret(ed) {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !ed.contains(sel.anchorNode)) return null;
    return sel.getRangeAt(0).cloneRange();
  }

  function restoreCaret(ed, range) {
    if (!range || !ed) return;
    ed.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function prettyPrintEditor(ed, n, canvasInline = false) {
    if (!ed || !n) return;
    const caret = saveCaret(ed);
    n.body = normalizeMarkupSource(serializeEditor(ed));
    if (canvasInline) refreshCanvasEditorContent(ed, n);
    else refreshEditorContent(ed, n);
    restoreCaret(ed, caret);
    Store.save();
  }

  const prettyPrintTimers = new Map();
  function schedulePrettyPrint(ed, n, ms = 280, canvasInline = false) {
    const key = (n?.id || "default") + (canvasInline ? "-canvas" : "");
    clearTimeout(prettyPrintTimers.get(key));
    prettyPrintTimers.set(key, setTimeout(() => prettyPrintEditor(ed, n, canvasInline), ms));
  }

  function noteMatchesSearch(n, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q);
  }

  // Notes list — a grid of small tinted tiles (title + preview snippet), Linear/Notion style.
  // Clicking a tile opens the full editor in a centered, blurred-backdrop popup (openNoteModal)
  // instead of a permanent side pane, so the grid itself stays airy and scannable.
  function renderListMode(v) {
    ensureNotesCanvasFilter();
    v.innerHTML = `
      <div class="notes-grid-toolbar">
        <div class="notes-search-wrap">
          <i class="ico" data-ico="search"></i>
          <input type="text" id="notes-search" placeholder="Search notes in this canvas…" value="${esc(noteSearchQuery)}">
        </div>
        <select id="note-canvas-filter" title="Canvas">
          ${Store.s.canvases.map(c => `<option value="${c.id}" ${c.id === notesCanvasFilter ? "selected" : ""}>${esc(canvasDisplayLabel(c))}</option>`).join("")}
        </select>
        <button class="btn-plus" id="note-new" title="New note on this canvas"><i class="ico" data-ico="plus"></i></button>
      </div>
      <div class="notes-tile-grid" id="notes-tile-grid"></div>`;
    UI.mountIcons(v);

    const grid = $("#notes-tile-grid");
    const q = noteSearchQuery.trim();
    const notes = Store.s.notes.filter(n => n.canvasId === notesCanvasFilter && noteMatchesSearch(n, q));
    if (!notes.length) {
      grid.innerHTML = `<div class="notes-empty-hint">${q ? `No notes match "${esc(q)}" on this canvas.` : "No notecards on this canvas yet — hit ＋ or switch to Canvas to add one."}</div>`;
    } else {
      notes.forEach(n => grid.appendChild(noteTileEl(n)));
    }

    const searchInput = $("#notes-search");
    searchInput.oninput = e => {
      noteSearchQuery = e.target.value;
      const caret = e.target.selectionStart;
      renderListMode(v);
      const fresh = $("#notes-search");
      fresh.focus(); fresh.setSelectionRange(caret, caret);
    };
    $("#note-canvas-filter").onchange = e => {
      notesCanvasFilter = e.target.value;
      renderListMode(v);
    };
    $("#note-new").onclick = () => {
      const n = mintNote("Untitled", "", { canvasId: notesCanvasFilter });
      attachNoteToCanvas(n, notesCanvasFilter);
      onNoteDataChange(n);
      render(); openNoteModal(n.id);
    };
  }

  function noteTileEl(n) {
    const colorHex = n.color ? (NOTE_COLORS.find(c => c.id === n.color) || {}).hex : null;
    const tile = el("div", `note-tile ${colorHex ? "tinted" : ""}`);
    if (colorHex) tile.style.setProperty("--tint", colorHex);
    tile.innerHTML = `
      <div class="note-tile-head">
        <span class="note-tile-title">${esc(n.title || "Untitled")}</span>
        <button class="icon-btn note-tile-del" title="Delete"><i class="ico" data-ico="x"></i></button>
      </div>
      <div class="note-tile-snip md-preview notecard-render-host"></div>`;
    UI.mountIcons(tile);
    const snipHost = tile.querySelector(".notecard-render-host");
    if (n.body?.trim() || n.font) mountNoteBody(snipHost, n);
    else snipHost.innerHTML = '<span class="muted2">Empty note</span>';
    tile.querySelector(".note-tile-del").onclick = e => {
      e.stopPropagation();
      detachNoteFromCanvases(n.id);
      Store.s.notes = Store.s.notes.filter(x => x.id !== n.id);
      if (activeNoteId === n.id) activeNoteId = null;
      if (typeof Undo !== "undefined") Undo.record();
      Store.save(); render();
    };
    tile.onclick = () => openNoteModal(n.id);
    return tile;
  }

  /* ---------- Note editor modal — medium popup, centered, blurred backdrop, expands as you write ---------- */
  let noteModalBack = null;

  function closeNoteModal() {
    if (!noteModalBack) return;
    const back = noteModalBack;
    noteModalBack = null;
    back.classList.remove("open");
    setTimeout(() => back.remove(), 160);
    const body = $("#notes-mode-body");
    if (body && notesMode === "list") renderListMode(body);
    else if (body && notesMode === "canvas") renderCanvasMode(body);
  }

  function openNoteModal(id) {
    const n = Store.s.notes.find(x => x.id === id);
    if (!n) return;
    activeNoteId = id;
    if (noteModalBack) noteModalBack.remove();
    const back = el("div", "note-modal-back", '<div class="note-modal-box"></div>');
    document.body.appendChild(back);
    noteModalBack = back;
    back.onclick = e => { if (e.target === back) closeNoteModal(); };
    const escHandler = e => {
      if (e.key === "Escape" && noteModalBack === back) { closeNoteModal(); document.removeEventListener("keydown", escHandler); }
    };
    document.addEventListener("keydown", escHandler);
    mountNoteEditor(back.querySelector(".note-modal-box"), n);
    requestAnimationFrame(() => back.classList.add("open"));
  }

  // Builds the full rich-text editor (title, color, format bar, history/voice/export, body)
  // inside an arbitrary container — used by the modal popup. Grows with content up to a cap.
  function mountNoteEditor(wrap, n) {
    const activeColor = n.color ? NOTE_COLORS.find(c => c.id === n.color) : null;
    wrap.innerHTML = `
      <div class="note-title-row">
        <input type="text" id="note-title" value="${esc(n.title)}">
        <button class="icon-btn note-color-dot" id="note-color-btn" title="Note color">
          <i style="width:10px;height:10px;border-radius:50%;display:block;background:${activeColor ? activeColor.hex : "transparent"};border:1px solid ${activeColor ? activeColor.hex : "var(--line-strong)"}"></i>
        </button>
        <div class="note-color-pop hidden" id="note-color-pop">
          <button class="note-color-swatch" data-color="" title="No color"><i class="ico" data-ico="x"></i></button>
          ${NOTE_COLORS.map(c => `<button class="note-color-swatch" data-color="${c.id}" style="background:${c.hex}" title="${c.id}"></button>`).join("")}
        </div>
        <button class="icon-btn note-modal-close" id="note-modal-close" title="Close (Esc)"><i class="ico" data-ico="x"></i></button>
      </div>
      <div class="notes-mode-tabs" style="margin-bottom:8px">
        <span class="card-sub" style="font-size:.72rem;padding:6px 8px 6px 2px">Type <code>[[Note Title]]</code> to auto-link.</span>
        <span class="spacer"></span>
        <button class="mode-btn" id="note-history-btn">History${n.history.length ? ` (${n.history.length})` : ""}</button>
        <button class="mode-btn" id="note-voice">Dictate</button>
        <button class="mode-btn" id="note-export-md">.md</button>
        <button class="mode-btn" id="note-export-pdf">PDF</button>
      </div>
      <div class="note-format-bar">
        <button class="icon-btn" id="fmt-bold" title="Bold"><b>B</b></button>
        <button class="icon-btn" id="fmt-italic" title="Italic"><i>I</i></button>
        <button class="icon-btn" id="fmt-underline" title="Underline"><u>U</u></button>
        <select id="fmt-font" title="Font" style="font-size:.72rem;padding:2px 4px;max-width:96px">
          ${NOTE_FONTS.map(f => `<option value="${f.family}">${f.label}</option>`).join("")}
        </select>
        <span class="fmt-sep"></span>
        ${NOTE_COLORS.map(c => `<button class="fmt-color-swatch" data-color="${c.id}" style="background:${c.hex}" title="Color text ${c.id}"></button>`).join("")}
      </div>
      <div id="note-editor" contenteditable="true"></div>`;
    UI.mountIcons(wrap);

    wrap.querySelector("#note-modal-close").onclick = () => closeNoteModal();

    const titleInput = wrap.querySelector("#note-title");
    titleInput.oninput = () => {
      n.title = titleInput.value;
      Store.save();
      if (typeof Undo !== "undefined") Undo.recordDebounced("note-title-" + n.id);
      onNoteDataChange(n);
    };

    const colorBtn = wrap.querySelector("#note-color-btn");
    const colorPop = wrap.querySelector("#note-color-pop");
    colorBtn.onclick = e => { e.stopPropagation(); colorPop.classList.toggle("hidden"); };
    wrap.querySelectorAll(".note-color-swatch").forEach(sw => sw.onclick = () => {
      n.color = sw.dataset.color || null; Store.save();
      mountNoteEditor(wrap, n);
    });

    wrap.querySelector("#note-history-btn").onclick = () => historyModal(n);

    const ed = wrap.querySelector("#note-editor");
    refreshEditorContent(ed, n);
    try { document.execCommand("defaultParagraphSeparator", false, "br"); } catch (e) {}

    const autoGrow = () => { ed.style.height = "auto"; ed.style.height = Math.min(ed.scrollHeight, Math.round(window.innerHeight * 0.52)) + "px"; };
    autoGrow();

    let bodyAtFocus = null;
    ed.onfocus = () => { bodyAtFocus = n.body; };
    ed.oninput = () => {
      n.body = serializeEditor(ed);
      Store.save();
      if (typeof Undo !== "undefined") Undo.recordDebounced("note-body-" + n.id);
      syncWikiLinks(n);
      schedulePrettyPrint(ed, n);
      onNoteDataChange(n);
      autoGrow();
    };
    ed.onblur = () => {
      n.body = normalizeMarkupSource(serializeEditor(ed));
      const createdNew = syncWikiLinks(n);
      onNoteDataChange(n);
      if (bodyAtFocus !== null && bodyAtFocus !== n.body && bodyAtFocus.trim()) {
        n.history.push({ ts: Date.now(), body: bodyAtFocus });
        if (n.history.length > 25) n.history.shift();
      }
      Store.save();
      refreshEditorContent(ed, n); // commit & pretty-print: renders [[links]], headers, etc.
      autoGrow();
    };

    wrap.querySelectorAll(".note-format-bar button").forEach(b => b.addEventListener("mousedown", e => e.preventDefault()));
    let savedRange = null;
    const saveRange = () => {
      const sel = window.getSelection();
      if (sel.rangeCount && ed.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
    };
    ed.addEventListener("mouseup", saveRange);
    ed.addEventListener("keyup", saveRange);
    const applyCmd = (cmd, val) => {
      ed.focus();
      if (savedRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
      document.execCommand("styleWithCSS", false, true);
      document.execCommand(cmd, false, val);
      n.body = serializeEditor(ed); Store.save(); applyNoteBodyToCanvas(n);
    };
    wrap.querySelector("#fmt-bold").onclick = () => applyCmd("bold");
    wrap.querySelector("#fmt-italic").onclick = () => applyCmd("italic");
    wrap.querySelector("#fmt-underline").onclick = () => applyCmd("underline");
    wrap.querySelector("#fmt-font").onchange = e => { if (e.target.value) applyCmd("fontName", e.target.value); e.target.selectedIndex = 0; };
    wrap.querySelectorAll(".fmt-color-swatch").forEach(sw => sw.onclick = () => {
      const c = NOTE_COLORS.find(cc => cc.id === sw.dataset.color);
      if (c) applyCmd("foreColor", c.hex);
    });

    wrap.querySelector("#note-voice").onclick = () => dictate(txt => {
      ed.focus();
      document.execCommand("insertText", false, (n.body && !n.body.endsWith("\n") ? "\n" : "") + txt);
      n.body = serializeEditor(ed); Store.save(); applyNoteBodyToCanvas(n); autoGrow();
    });
    wrap.querySelector("#note-export-md").onclick = () => downloadText(`${n.title}.md`, n.body, "text/markdown");
    wrap.querySelector("#note-export-pdf").onclick = () => {
      const w = window.open("", "_blank");
      w.document.write(`<html><head><title>${esc(n.title)}</title>
        <style>body{font-family:Segoe UI,sans-serif;max-width:720px;margin:40px auto;line-height:1.6}
        pre{background:#f4f4f4;padding:12px;border-radius:8px}code{background:#f4f4f4;padding:2px 5px;border-radius:4px}</style>
        </head><body><h1>${esc(n.title)}</h1>${renderMarkdown(n.body)}
        <script>window.onload=()=>window.print()<\/script></body></html>`);
      w.document.close();
      toast("Print dialog → 'Save as PDF'");
    };
  }

  /* ---------- Graph View — Linear-style force layout of [[wiki links]] ---------- */
  // Regex-extracts every [[Note Title]] reference out of a note's body. Titles keep
  // their original casing here — callers that need case-insensitive matching lowercase
  // on their own — so a freshly auto-created note is titled exactly as the user typed it.
  function extractLinkTitles(body) {
    const out = [];
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(body || ""))) out.push(m[1].trim());
    return out;
  }

  // The wiki-link engine: scans a note's body for [[Title]] references, and for each one:
  //  1. Looks for an existing note with that exact title (case-insensitive).
  //  2. If none exists, silently creates a new empty note with that title (auto-linking engine).
  //  3. Records the relationship as a bi-directional edge — both notes get each other's id
  //     pushed into their `links` array — so the Graph View lights up instantly with no
  //     extra step from the user. Safe to call repeatedly (idempotent once notes exist).
  function syncWikiLinks(n) {
    const titles = [...new Set(extractLinkTitles(n.body))].filter(Boolean);
    const newLinkIds = [];
    let createdAny = false;
    titles.forEach(title => {
      let target = Store.s.notes.find(x => x.id !== n.id && (x.title || "").trim().toLowerCase() === title.toLowerCase());
      if (!target) {
        target = createNoteQuiet(title, "");
        createdAny = true;
        toast(`🔗 Typing [[${title}]] auto-created & linked a new note — see it in Graph View`);
      }
      if (target.id !== n.id) newLinkIds.push(target.id);
    });
    n.links = newLinkIds;
    newLinkIds.forEach(tid => {
      const target = Store.s.notes.find(x => x.id === tid);
      if (!target) return;
      target.links = target.links || [];
      if (!target.links.includes(n.id)) target.links.push(n.id);
    });
    if (createdAny) Store.save();
    return createdAny;
  }

  function cssVar(name) {
    return getComputedStyle(document.body).getPropertyValue(name).trim() || "#8a8f98";
  }

  function renderGraphMode(container) {
    syncCanvasConnectionsToGraph();
    Store.s.notes.slice().forEach(n => syncWikiLinks(n));
    const notes = Store.s.notes;
    container.innerHTML = `<div class="notes-graph-wrap">
      <canvas id="notes-graph-canvas"></canvas>
      <div class="graph-tooltip hidden" id="graph-tooltip"></div>
      ${notes.length < 2 ? `<div class="graph-empty-hint">Create a couple of notes and link them with <code>[[Note Title]]</code> to see the graph come alive.</div>` : ""}
      <div class="graph-toolbar">
        <button class="btn sm ${!graph3D ? "primary" : ""}" id="graph-mode-2d">2D</button>
        <button class="btn sm ${graph3D ? "primary" : ""}" id="graph-mode-3d">3D</button>
      </div>
      <div class="graph-hint-bar">${graph3D ? "Drag to orbit · scroll to zoom · click a dot to open its note" : "Drag to pan · scroll to zoom · drag a dot to move it · click a dot to open its note"}</div>
    </div>`;
    if (notes.length < 1) return;
    $("#graph-mode-2d").onclick = () => { if (graph3D) { graph3D = false; renderGraphMode(container); } };
    $("#graph-mode-3d").onclick = () => { if (!graph3D) { graph3D = true; renderGraphMode(container); } };

    const canvas = $("#notes-graph-canvas");
    const tooltip = $("#graph-tooltip");
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    // Build nodes + edges from each note's synced `links` array (kept up to date by syncWikiLinks)
    const spread = Math.min(W, H);
    const nodes = notes.map((n, i) => ({
      id: n.id, title: n.title || "Untitled", color: n.color,
      x: W / 2 + Math.cos(i / notes.length * Math.PI * 2) * spread * 0.28 + (Math.random() - 0.5) * 20,
      y: H / 2 + Math.sin(i / notes.length * Math.PI * 2) * spread * 0.28 + (Math.random() - 0.5) * 20,
      z: graph3D ? (Math.random() - 0.5) * spread * 0.55 : 0,
      vx: 0, vy: 0, vz: 0, degree: 0,
    }));
    if (pendingGraphNodePos) {
      const pinned = nodes.find(nd => nd.id === pendingGraphNodePos.id);
      if (pinned) { pinned.x = pendingGraphNodePos.x; pinned.y = pendingGraphNodePos.y; }
      pendingGraphNodePos = null;
    }
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const edgeSet = new Set();
    const edges = [];
    notes.forEach(n => {
      (n.links || []).forEach(targetId => {
        if (targetId === n.id || !nodeById.has(targetId)) return;
        const key = [n.id, targetId].sort().join("|");
        if (edgeSet.has(key)) return;
        edgeSet.add(key);
        edges.push({ a: n.id, b: targetId });
      });
    });
    edges.forEach(e => { nodeById.get(e.a).degree++; nodeById.get(e.b).degree++; });

    const radiusOf = nd => 5 + Math.sqrt(nd.degree + 1) * 3.2;
    const FOCAL = 480;

    let panX = 0, panY = 0, scale = 1;

    // Orbit projection: rotates a node's (x,y,z) — centered on the canvas midpoint — around the
    // camera's yaw/pitch angles, then applies simple perspective so far nodes shrink/dim and near
    // nodes grow/brighten. In 2D mode every z is 0 and rotation is skipped, so this collapses to
    // an identity transform and behaves exactly like the old flat graph.
    function project(nd) {
      let x1 = nd.x - W / 2, y1 = nd.y - H / 2, z1 = nd.z;
      if (graph3D) {
        const cosY = Math.cos(graphRotY), sinY = Math.sin(graphRotY);
        const xr = x1 * cosY + z1 * sinY, zr = -x1 * sinY + z1 * cosY;
        const cosX = Math.cos(graphRotX), sinX = Math.sin(graphRotX);
        const yr = y1 * cosX - zr * sinX, zr2 = y1 * sinX + zr * cosX;
        x1 = xr; y1 = yr; z1 = zr2;
      }
      const persp = graph3D ? FOCAL / Math.max(60, FOCAL + z1) : 1;
      return { sx: W / 2 + x1 * persp, sy: H / 2 + y1 * persp, persp, z: z1 };
    }

    function draw(hoverNode) {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(scale, scale);

      nodes.forEach(nd => { const p = project(nd); nd._sx = p.sx; nd._sy = p.sy; nd._persp = p.persp; nd._z = p.z; });

      const connected = hoverNode ? new Set(edges.filter(e => e.a === hoverNode.id || e.b === hoverNode.id)
        .flatMap(e => [e.a, e.b])) : null;

      // Use a solid (non-transparent) color here — canvas globalAlpha already handles the fade,
      // and compounding it with an rgba() custom property would make the lines nearly invisible.
      const lineColor = cssVar("--text-tertiary");
      const accent = cssVar("--accent");
      const textColor = cssVar("--text");

      edges.forEach(e => {
        const a = nodeById.get(e.a), b = nodeById.get(e.b);
        const hi = hoverNode && (e.a === hoverNode.id || e.b === hoverNode.id);
        ctx.beginPath();
        ctx.moveTo(a._sx, a._sy); ctx.lineTo(b._sx, b._sy);
        ctx.strokeStyle = hi ? accent : lineColor;
        ctx.globalAlpha = (hi ? 0.85 : 0.48) * (graph3D ? Math.min(1, (a._persp + b._persp) / 2) : 1);
        ctx.lineWidth = (hi ? 2 : 1.25) / scale;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Painter's algorithm in 3D — draw farthest-from-camera nodes first so nearer ones layer on top.
      const drawOrder = graph3D ? nodes.slice().sort((a, b) => b._z - a._z) : nodes;
      drawOrder.forEach(nd => {
        const r = radiusOf(nd) * (graph3D ? Math.max(0.35, nd._persp) : 1);
        const isHover = hoverNode === nd;
        const isConnected = connected && connected.has(nd.id);
        const tint = nd.color ? (NOTE_COLORS.find(c => c.id === nd.color) || {}).hex : null;
        ctx.beginPath();
        ctx.arc(nd._sx, nd._sy, isHover ? r + 1.5 : r, 0, Math.PI * 2);
        ctx.fillStyle = isHover || isConnected ? accent : tint || textColor;
        const depthAlpha = graph3D ? Math.min(1, Math.max(0.25, nd._persp)) : 1;
        ctx.globalAlpha = (isHover ? 1 : isConnected ? 0.9 : tint ? 0.85 : 0.35 + Math.min(nd.degree, 8) * 0.05) * depthAlpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Settle with a short, snappy force simulation, then freeze. Runs the same 3D-capable physics
    // whether or not 3D is enabled — in 2D mode every z/vz simply stays pinned at 0.
    let frame = 0;
    const MAX_FRAMES = 90;
    function step() {
      const cool = Math.max(0, 1 - frame / MAX_FRAMES);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
          let dist2 = dx * dx + dy * dy + dz * dz || 0.01;
          let dist = Math.sqrt(dist2);
          const force = 1400 / dist2;
          dx /= dist; dy /= dist; dz /= dist;
          a.vx += dx * force; a.vy += dy * force; a.vz += dz * force;
          b.vx -= dx * force; b.vy -= dy * force; b.vz -= dz * force;
        }
      }
      edges.forEach(e => {
        const a = nodeById.get(e.a), b = nodeById.get(e.b);
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const force = (dist - 90) * 0.02;
        dx /= dist; dy /= dist; dz /= dist;
        a.vx += dx * force; a.vy += dy * force; a.vz += dz * force;
        b.vx -= dx * force; b.vy -= dy * force; b.vz -= dz * force;
      });
      nodes.forEach(nd => {
        nd.vx += (W / 2 - nd.x) * 0.002; nd.vy += (H / 2 - nd.y) * 0.002; nd.vz += (0 - nd.z) * 0.002;
        nd.vx *= 0.82; nd.vy *= 0.82; nd.vz *= 0.82;
        nd.x += nd.vx * cool; nd.y += nd.vy * cool; nd.z += nd.vz * cool;
      });
      draw(hoveredNode);
      frame++;
      if (frame < MAX_FRAMES) requestAnimationFrame(step);
    }

    let hoveredNode = null;
    let drag = null; // {type:'pan'|'node', ...}

    function graphPoint(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: (clientX - r.left - panX) / scale, y: (clientY - r.top - panY) / scale };
    }
    // Hit-tests against each node's last-drawn screen position (_sx/_sy) rather than its raw
    // world x/y — in 3D mode those differ because of the orbit rotation + perspective projection.
    function nodeAt(gx, gy) {
      let best = null, bestD = Infinity;
      nodes.forEach(nd => {
        const r = radiusOf(nd) * (graph3D ? Math.max(0.35, nd._persp || 1) : 1) + 5 / scale;
        const d = Math.hypot((nd._sx ?? nd.x) - gx, (nd._sy ?? nd.y) - gy);
        if (d <= r && d < bestD) { best = nd; bestD = d; }
      });
      return best;
    }

    canvas.addEventListener("mousedown", e => {
      const p = graphPoint(e.clientX, e.clientY);
      const nd = nodeAt(p.x, p.y);
      canvas.classList.add("grabbing");
      if (nd && graph3D) drag = { type: "node3d", node: nd };
      else if (nd) drag = { type: "node", node: nd, moved: false, startX: e.clientX, startY: e.clientY };
      else if (graph3D) drag = { type: "orbit", startX: e.clientX, startY: e.clientY, startRotY: graphRotY, startRotX: graphRotX };
      else drag = { type: "pan", startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY };
    });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    function onMove(e) {
      if (!drag) {
        // hover detection only when this graph canvas is still mounted
        if (!document.body.contains(canvas)) { cleanup(); return; }
        const r = canvas.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          if (hoveredNode) { hoveredNode = null; tooltip.classList.add("hidden"); draw(null); }
          return;
        }
        const p = graphPoint(e.clientX, e.clientY);
        const nd = nodeAt(p.x, p.y);
        if (nd !== hoveredNode) {
          hoveredNode = nd; draw(nd);
        }
        if (nd) {
          tooltip.classList.remove("hidden");
          tooltip.textContent = nd.title;
          tooltip.style.left = (nd._sx * scale + panX) + "px";
          tooltip.style.top = (nd._sy * scale + panY) + "px";
        } else tooltip.classList.add("hidden");
        return;
      }
      if (!document.body.contains(canvas)) { cleanup(); return; }
      if (drag.type === "pan") {
        panX = drag.startPanX + (e.clientX - drag.startX);
        panY = drag.startPanY + (e.clientY - drag.startY);
        draw(hoveredNode);
      } else if (drag.type === "orbit") {
        graphRotY = drag.startRotY + (e.clientX - drag.startX) * 0.006;
        graphRotX = Math.max(-1.3, Math.min(1.3, drag.startRotX + (e.clientY - drag.startY) * 0.006));
        draw(hoveredNode);
      } else if (drag.type === "node") {
        if (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3) drag.moved = true;
        const p = graphPoint(e.clientX, e.clientY);
        drag.node.x = p.x; drag.node.y = p.y;
        draw(hoveredNode);
      }
    }
    function onUp(e) {
      canvas.classList.remove("grabbing");
      if (drag && drag.type === "node3d") {
        openNoteModal(drag.node.id);
        drag = null;
        return;
      }
      if (drag && drag.type === "node" && !drag.moved) {
        openNoteModal(drag.node.id);
        drag = null;
        return;
      }
      drag = null;
    }
    function cleanup() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const before = { x: (mx - panX) / scale, y: (my - panY) / scale };
      scale = Math.min(3, Math.max(0.25, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      panX = mx - before.x * scale; panY = my - before.y * scale;
      draw(hoveredNode);
    }, { passive: false });

    canvas.addEventListener("contextmenu", e => {
      e.preventDefault();
      const p = graphPoint(e.clientX, e.clientY);
      const r = canvas.getBoundingClientRect();
      showContextMenu(wrap, e.clientX - r.left, e.clientY - r.top, [
        { label: "＋ New note here", onClick: () => {
          const predictedId = "n" + Store.s.noteSeq;
          pendingGraphNodePos = { id: predictedId, x: p.x, y: p.y };
          createNote("Untitled", "");
        } },
      ]);
    });

    requestAnimationFrame(step);
  }

  /* ---------- Lightweight floating context menu (right-click actions) ---------- */
  function showContextMenu(container, x, y, items) {
    document.querySelectorAll(".ctx-menu").forEach(m => m.remove());
    const menu = el("div", "ctx-menu");
    menu.style.left = x + "px"; menu.style.top = y + "px";
    items.forEach(it => {
      const b = el("button", "ctx-menu-item", it.label);
      // Stop the click from bubbling to document — several onClick handlers (e.g. opening a
      // card's color/font popover) get immediately undone by the doc-level outside-click closer.
      b.onclick = e => { e.stopPropagation(); menu.remove(); it.onClick(); };
      menu.appendChild(b);
    });
    container.appendChild(menu);
    setTimeout(() => {
      const closeOnce = e => { if (!menu.contains(e.target)) { menu.remove(); window.removeEventListener("mousedown", closeOnce); } };
      window.addEventListener("mousedown", closeOnce);
    }, 0);
  }

  /* ---------- Infinite Canvas — each card is a real note (shared with Notes + Graph) ---------- */
  function mintNote(title, body, extra = {}, recordUndo = true) {
    const n = Object.assign({
      id: "n" + (Store.s.noteSeq++), title, body, color: null, font: null, canvasId: null,
      links: [], history: [], createdAt: Date.now(),
    }, extra);
    Store.s.notes.unshift(n);
    Store.save();
    if (recordUndo && typeof Undo !== "undefined") Undo.record();
    return n;
  }

  function migrateCanvasToSharedNotes(cv) {
    if (!cv.connections) cv.connections = [];
    if (cv.noteId) {
      const mirror = noteById(cv.noteId);
      if (mirror && mirror.body && !cv.cards.length) applyNoteBodyToCanvas(mirror);
    }
    cv.cards.forEach(c => {
      if (c.noteId) {
        const n = noteById(c.noteId);
        if (n) {
          n.canvasId = cv.id;
          if (c.text?.trim() && !n.body?.trim()) n.body = c.text;
          if (c.title?.trim() && (!n.title || n.title === "Untitled")) n.title = c.title;
          if (c.color && !n.color) n.color = c.color;
          if (c.font && !n.font) n.font = c.font;
        }
        delete c.title; delete c.text; delete c.color; delete c.font;
        return;
      }
      const n = mintNote(c.title || "Untitled", c.text || "", { canvasId: cv.id, color: c.color || null, font: c.font || null }, false);
      c.noteId = n.id;
      delete c.title; delete c.text; delete c.color; delete c.font;
    });
    if (cv.noteId) {
      Store.s.notes = Store.s.notes.filter(n => n.id !== cv.noteId);
      delete cv.noteId;
    }
    cv.name = canvasDisplayLabel(cv);
  }

  function applyNoteBodyToCanvas(n) {
    const cv = Store.s.canvases.find(c => c.noteId === n.id);
    if (!cv) return false;
    const body = (n.body || "").trim();
    const chunks = !body || body.startsWith("_This canvas has no cards yet")
      ? [] : body.split(/\n{2,}-{3,}\n{2,}/).map(c => c.trim()).filter(Boolean);
    const parsed = chunks.map((chunk, i) => {
      const m = chunk.match(/^##\s?(.*)\n?([\s\S]*)$/);
      let title = m ? m[1].trim() : "";
      let text = (m ? m[2] : chunk).trim();
      if (text === "_empty_") text = "";
      if (title === `Notecard ${i + 1}`) title = ""; // that's the auto placeholder header, not a real title
      return { title, text };
    });
    const oldCards = cv.cards;
    cv.cards = parsed.map((p, i) => {
      const existing = oldCards[i];
      if (existing) return Object.assign({}, existing, { title: p.title, text: p.text });
      return { id: "cc" + Date.now() + Math.floor(Math.random() * 1000) + i, x: 40 + (i % 4) * 240, y: 40 + Math.floor(i / 4) * 170, w: 220, h: 150, title: p.title, text: p.text, color: null, font: null };
    });
    const ids = new Set(cv.cards.map(c => c.id));
    cv.connections = (cv.connections || []).filter(c => ids.has(c.from) && ids.has(c.to));
    return true;
  }

  function ensureCanvases() {
    if (!Store.s.canvases.length) {
      Store.s.canvases.push({ id: "cv" + (Store.s.canvasSeq++), name: "Empty canvas", cards: [], connections: [] });
    }
    Store.s.notes.forEach(normalizeNoteBody);
    Store.s.canvases.forEach(cv => migrateCanvasToSharedNotes(cv));
    if (!activeCanvasId || !Store.s.canvases.find(c => c.id === activeCanvasId)) activeCanvasId = Store.s.canvases[0].id;
  }

  function renderCanvasMode(container) {
    ensureCanvases();
    const cv = Store.s.canvases.find(c => c.id === activeCanvasId);

    container.innerHTML = `
      <div class="canvas-tabs">
        ${Store.s.canvases.map(c => `
          <button class="canvas-tab ${c.id === activeCanvasId ? "active" : ""}" data-id="${c.id}" title="${esc(canvasDisplayLabel(c))}">
            <span class="canvas-tab-label">${esc(canvasDisplayLabel(c))}</span>
            ${Store.s.canvases.length > 1 ? `<i class="ico tab-del" data-ico="x" data-del="${c.id}" title="Delete canvas"></i>` : ""}
          </button>`).join("")}
        <button class="canvas-tab-add" id="canvas-add" title="New canvas"><i class="ico" data-ico="plus"></i></button>
        <span class="spacer"></span>
        <button class="btn sm" id="canvas-add-card">＋ Card</button>
      </div>
      <div class="notes-canvas-wrap">
        <div class="canvas-board-outer" id="canvas-outer">
          <div class="canvas-board" id="canvas-board">
            <svg class="canvas-connectors" id="canvas-connectors"><defs>
              <marker id="conn-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z"></path>
              </marker>
            </defs></svg>
          </div>
          ${cv.cards.length === 0 ? `<div class="canvas-empty-hint">No notecards yet — double-click the board or hit ＋ Card to add one. Each card is a real note shared with Notes &amp; Graph.</div>` : ""}
        </div>
      </div>`;
    UI.mountIcons(container);

    container.querySelectorAll(".canvas-tab").forEach(tab => {
      tab.onclick = e => {
        if (e.target.closest("[data-del]") || activeCanvasId === tab.dataset.id) return;
        activeCanvasId = tab.dataset.id;
        notesCanvasFilter = tab.dataset.id;
        renderCanvasMode(container);
      };
    });
    container.querySelectorAll("[data-del]").forEach(x => {
      x.onclick = e => {
        e.stopPropagation();
        if (Store.s.canvases.length <= 1) return;
        const dead = Store.s.canvases.find(c => c.id === x.dataset.del);
        if (dead) dead.cards.forEach(c => { if (c.noteId) Store.s.notes = Store.s.notes.filter(n => n.id !== c.noteId); });
        Store.s.canvases = Store.s.canvases.filter(c => c.id !== x.dataset.del);
        if (activeCanvasId === x.dataset.del) activeCanvasId = Store.s.canvases[0].id;
        if (notesCanvasFilter === x.dataset.del) notesCanvasFilter = activeCanvasId;
        Store.save(); renderCanvasMode(container);
      };
    });
    $("#canvas-add").onclick = () => {
      const c = { id: "cv" + (Store.s.canvasSeq++), name: "Empty canvas", cards: [], connections: [] };
      Store.s.canvases.push(c); activeCanvasId = c.id; notesCanvasFilter = c.id;
      Store.save(); renderCanvasMode(container);
    };

    const outer = $("#canvas-outer");
    const board = $("#canvas-board");
    const svg = $("#canvas-connectors");
    let panX = 20, panY = 20, scale = 1;
    const applyTransform = () => { board.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; };
    applyTransform();

    function toBoard(clientX, clientY) {
      const r = outer.getBoundingClientRect();
      return { x: (clientX - r.left - panX) / scale, y: (clientY - r.top - panY) / scale };
    }

    function drawConnectors() {
      let maxX = 900, maxY = 700;
      cv.cards.forEach(c => { maxX = Math.max(maxX, c.x + c.w + 400); maxY = Math.max(maxY, c.y + c.h + 400); });
      svg.setAttribute("width", maxX); svg.setAttribute("height", maxY);
      svg.querySelectorAll(".conn-line").forEach(l => l.remove());
      cv.connections.forEach(conn => {
        const a = cv.cards.find(c => c.id === conn.from), b = cv.cards.find(c => c.id === conn.to);
        if (!a || !b) return;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", a.x + a.w / 2); line.setAttribute("y1", a.y + a.h / 2);
        line.setAttribute("x2", b.x + b.w / 2); line.setAttribute("y2", b.y + b.h / 2);
        line.setAttribute("class", "conn-line");
        line.setAttribute("marker-end", "url(#conn-arrow)");
        line.onclick = e => {
          e.stopPropagation();
          cv.connections = cv.connections.filter(c => c !== conn);
          Store.save(); drawConnectors();
        };
        svg.appendChild(line);
      });
    }

    function cardEl(card, idx) {
      if (!card.noteId) {
        const boot = mintNote("Untitled", "", { canvasId: cv.id }, false);
        card.noteId = boot.id;
      }
      const n = canvasCardNote(card);
      const d = el("div", "canvas-card");
      d.dataset.cardId = card.id;
      d.style.left = card.x + "px"; d.style.top = card.y + "px";
      d.style.width = card.w + "px"; d.style.height = card.h + "px";
      const colorHex = n?.color ? (NOTE_COLORS.find(c => c.id === n.color) || {}).hex : null;
      if (colorHex) { d.classList.add("tinted"); d.style.setProperty("--tint", colorHex); }
      d.innerHTML = `
        <div class="canvas-card-head" title="Drag to move · double-click to open full editor · right-click for more">
          <button class="icon-btn card-color-dot" title="Card color"><i class="card-color-swatch" style="background:${colorHex || "transparent"};border-color:${colorHex || "var(--line-strong)"}"></i></button>
          <i class="ico card-link" data-ico="link" title="Drag onto another card to connect"></i>
          <span class="spacer"></span>
          <i class="ico card-del" data-ico="x" title="Delete"></i>
        </div>
        <div class="canvas-color-pop hidden">
          <button class="canvas-color-swatch" data-color="" title="No color"><i class="ico" data-ico="x"></i></button>
          ${NOTE_COLORS.map(c => `<button class="canvas-color-swatch" data-color="${c.id}" style="background:${c.hex}" title="${c.id}"></button>`).join("")}
        </div>
        <div class="canvas-font-pop hidden">
          ${NOTE_FONTS.map(f => `<button class="canvas-font-swatch" data-font="${esc(f.family)}" style="font-family:${f.family || "inherit"}">Aa</button>`).join("")}
        </div>
        <input type="text" class="canvas-card-title" placeholder="Untitled" value="${esc(n?.title || "")}">
        <div class="canvas-card-fmt">
          <button type="button" class="canvas-fmt-btn" data-cmd="bold" title="Bold"><b>B</b></button>
          <button type="button" class="canvas-fmt-btn" data-cmd="italic" title="Italic"><i>I</i></button>
          <button type="button" class="canvas-fmt-btn" data-cmd="underline" title="Underline"><u>U</u></button>
          ${NOTE_COLORS.map(c => `<button type="button" class="canvas-fmt-color" data-color="${c.id}" style="background:${c.hex}" title="Text ${c.id}"></button>`).join("")}
        </div>
        <div class="canvas-card-body-wrap">
          <div class="notecard-render-host"></div>
          <div class="canvas-card-body hidden" contenteditable="true" data-placeholder="Click to type…"></div>
        </div>
        <div class="canvas-resize-handle"></div>`;
      UI.mountIcons(d);

      const deleteCard = () => {
        if (card.noteId) Store.s.notes = Store.s.notes.filter(x => x.id !== card.noteId);
        cv.cards = cv.cards.filter(c => c.id !== card.id);
        cv.connections = cv.connections.filter(c => c.from !== card.id && c.to !== card.id);
        cv.name = canvasDisplayLabel(cv);
        onNoteDataChange();
        renderCanvasMode(container);
      };
      d.querySelector(".card-del").onclick = deleteCard;

      const colorPop = d.querySelector(".canvas-color-pop");
      const fontPop = d.querySelector(".canvas-font-pop");
      const renderHost = d.querySelector(".notecard-render-host");
      const bodyEd = d.querySelector(".canvas-card-body");

      function syncCardDisplay() {
        if (!n) return;
        const text = cardBodyText(card, n);
        if (text) n.body = NotecardRenderer.normalizeSource(text);
        normalizeNoteBody(n);
        if (!n.body?.trim() && !n.font) {
          renderHost.innerHTML = '<span class="muted2">Click to type…</span>';
        } else {
          NotecardRenderer.mount(renderHost, n.body, { font: n.font });
        }
        renderHost.classList.remove("hidden");
        bodyEd.classList.add("hidden");
      }

      function enterCardEdit() {
        if (!n) return;
        const text = cardBodyText(card, n);
        if (text) n.body = NotecardRenderer.normalizeSource(text);
        renderHost.classList.add("hidden");
        bodyEd.classList.remove("hidden");
        refreshCanvasEditorContent(bodyEd, n);
        bodyEd.focus();
      }

      function exitCardEdit() {
        if (!n) return;
        n.body = normalizeMarkupSource(serializeEditor(bodyEd));
        delete card.text; delete card.title;
        syncWikiLinks(n);
        Store.save();
        bodyEd.classList.add("hidden");
        syncCardDisplay();
        onNoteDataChange(n);
      }

      syncCardDisplay();

      const titleInput = d.querySelector(".canvas-card-title");
      d.querySelectorAll(".canvas-color-swatch").forEach(sw => sw.onclick = e => {
        e.stopPropagation();
        colorPop.classList.add("hidden");
        if (n) { n.color = sw.dataset.color || null; onNoteDataChange(n); renderCanvasMode(container); }
      });
      d.querySelectorAll(".canvas-font-swatch").forEach(sw => sw.onclick = e => {
        e.stopPropagation();
        fontPop.classList.add("hidden");
        const font = sw.dataset.font;
        if (font && n) {
          if (bodyEd.classList.contains("hidden")) enterCardEdit();
          applyCanvasCmd(bodyEd, "fontName", font);
          commitCanvasBody(bodyEd, n);
        }
      });

      titleInput.oninput = () => { if (n) { n.title = titleInput.value; onNoteDataChange(n); } };
      titleInput.addEventListener("mousedown", e => e.stopPropagation());
      titleInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); enterCardEdit(); } });

      renderHost.onclick = e => { e.stopPropagation(); enterCardEdit(); };
      renderHost.addEventListener("mousedown", e => e.stopPropagation());
      d.querySelector(".canvas-card-body-wrap").onclick = e => {
        e.stopPropagation();
        if (bodyEd.classList.contains("hidden")) enterCardEdit();
      };

      d.querySelectorAll(".canvas-fmt-btn").forEach(b => {
        b.addEventListener("mousedown", e => e.preventDefault());
        b.onclick = e => {
          e.stopPropagation();
          if (bodyEd.classList.contains("hidden")) enterCardEdit();
          applyCanvasCmd(bodyEd, b.dataset.cmd);
          commitCanvasBody(bodyEd, n);
        };
      });
      d.querySelectorAll(".canvas-fmt-color").forEach(sw => {
        sw.addEventListener("mousedown", e => e.preventDefault());
        sw.onclick = e => {
          e.stopPropagation();
          if (bodyEd.classList.contains("hidden")) enterCardEdit();
          const c = NOTE_COLORS.find(x => x.id === sw.dataset.color);
          if (c) applyCanvasCmd(bodyEd, "foreColor", c.hex);
          commitCanvasBody(bodyEd, n);
        };
      });
      bodyEd.oninput = () => {
        if (!n) return;
        n.body = serializeEditor(bodyEd);
        Store.save();
        if (typeof Undo !== "undefined") Undo.recordDebounced("canvas-card-" + n.id);
        schedulePrettyPrint(bodyEd, n, 80, true);
      };
      bodyEd.onblur = () => exitCardEdit();
      bodyEd.addEventListener("mousedown", e => e.stopPropagation());
      d.querySelector(".canvas-card-body-wrap").addEventListener("mousedown", e => e.stopPropagation());

      const head = d.querySelector(".canvas-card-head");
      head.addEventListener("dblclick", e => {
        e.stopPropagation();
        if (n) openNoteModal(n.id);
      });
      head.addEventListener("mousedown", e => {
        if (e.target.closest(".card-link") || e.target.closest(".card-del")) return;
        e.stopPropagation();
        const startClientX = e.clientX, startClientY = e.clientY;
        const startX = card.x, startY = card.y;
        const move = ev => {
          card.x = startX + (ev.clientX - startClientX) / scale;
          card.y = startY + (ev.clientY - startClientY) / scale;
          d.style.left = card.x + "px"; d.style.top = card.y + "px";
          drawConnectors();
        };
        const up = () => {
          window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
          Store.save(); scheduleNotesRefresh();
        };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      });

      d.addEventListener("contextmenu", e => {
        e.preventDefault(); e.stopPropagation();
        const r = outer.getBoundingClientRect();
        showContextMenu(outer, e.clientX - r.left, e.clientY - r.top, [
          { label: "Rename card", onClick: () => { titleInput.focus(); titleInput.select(); } },
          { label: "Open full editor", onClick: () => { if (n) openNoteModal(n.id); } },
          { label: "Change color", onClick: () => { colorPop.classList.remove("hidden"); fontPop.classList.add("hidden"); } },
          { label: "Change font", onClick: () => { fontPop.classList.remove("hidden"); colorPop.classList.add("hidden"); } },
          { label: "Delete card", onClick: deleteCard },
        ]);
      });

      d.querySelector(".card-link").addEventListener("mousedown", e => {
        e.stopPropagation(); e.preventDefault();
        const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tempLine.setAttribute("class", "conn-line-temp");
        const start = { x: card.x + card.w / 2, y: card.y + card.h / 2 };
        tempLine.setAttribute("x1", start.x); tempLine.setAttribute("y1", start.y);
        tempLine.setAttribute("x2", start.x); tempLine.setAttribute("y2", start.y);
        svg.appendChild(tempLine);
        const move = ev => {
          const p = toBoard(ev.clientX, ev.clientY);
          tempLine.setAttribute("x2", p.x); tempLine.setAttribute("y2", p.y);
        };
        const up = ev => {
          window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
          tempLine.remove();
          const targetEl = document.elementFromPoint(ev.clientX, ev.clientY);
          const targetCardEl = targetEl && targetEl.closest && targetEl.closest(".canvas-card");
          if (targetCardEl && targetCardEl.dataset.cardId !== card.id) {
            const targetCard = cv.cards.find(c => c.id === targetCardEl.dataset.cardId);
            if (targetCard) {
              const exists = cv.connections.some(c => (c.from === card.id && c.to === targetCard.id) || (c.from === targetCard.id && c.to === card.id));
              if (!exists) cv.connections.push({ id: "cn" + Date.now(), from: card.id, to: targetCard.id });
              syncCanvasConnectionsToGraph();
              onNoteDataChange(n);
              drawConnectors();
            }
          }
        };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      });

      const handle = d.querySelector(".canvas-resize-handle");
      handle.addEventListener("mousedown", e => {
        e.stopPropagation();
        const startClientX = e.clientX, startClientY = e.clientY;
        const startW = card.w, startH = card.h;
        const move = ev => {
          card.w = Math.max(140, startW + (ev.clientX - startClientX) / scale);
          card.h = Math.max(90, startH + (ev.clientY - startClientY) / scale);
          d.style.width = card.w + "px"; d.style.height = card.h + "px";
          drawConnectors();
        };
        const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); Store.save(); };
        window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
      });

      return d;
    }

    cv.cards.forEach((c, i) => board.appendChild(cardEl(c, i)));
    drawConnectors();

    function addCardAt(x, y) {
      const note = mintNote("Untitled", "", { canvasId: cv.id });
      const card = { id: "cc" + Date.now() + Math.floor(Math.random() * 1000), noteId: note.id, x: x - 110, y: y - 65, w: 220, h: 150 };
      cv.cards.push(card);
      cv.name = canvasDisplayLabel(cv);
      onNoteDataChange(note);
      renderCanvasMode(container);
    }
    $("#canvas-add-card").onclick = () => {
      const r = outer.getBoundingClientRect();
      const p = toBoard(r.left + r.width / 2, r.top + r.height / 2);
      addCardAt(p.x, p.y);
    };
    outer.addEventListener("dblclick", e => {
      if (e.target.closest(".canvas-card")) return;
      const p = toBoard(e.clientX, e.clientY);
      addCardAt(p.x, p.y);
    });
    outer.addEventListener("contextmenu", e => {
      if (e.target.closest(".canvas-card")) return;
      e.preventDefault();
      const r = outer.getBoundingClientRect();
      const p = toBoard(e.clientX, e.clientY);
      showContextMenu(outer, e.clientX - r.left, e.clientY - r.top, [
        { label: "＋ New note here", onClick: () => addCardAt(p.x, p.y) },
      ]);
    });

    // pan background
    outer.addEventListener("mousedown", e => {
      if (e.target.closest(".canvas-card")) return;
      outer.classList.add("panning");
      const startClientX = e.clientX, startClientY = e.clientY, startPanX = panX, startPanY = panY;
      const move = ev => { panX = startPanX + (ev.clientX - startClientX); panY = startPanY + (ev.clientY - startClientY); applyTransform(); };
      const up = () => { outer.classList.remove("panning"); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    outer.addEventListener("wheel", e => {
      e.preventDefault();
      const r = outer.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const before = { x: (mx - panX) / scale, y: (my - panY) / scale };
      scale = Math.min(2.5, Math.max(0.3, scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      panX = mx - before.x * scale; panY = my - before.y * scale;
      applyTransform();
    }, { passive: false });
  }

  function applyCanvasCmd(bodyEd, cmd, val) {
    bodyEd.focus();
    try { document.execCommand("styleWithCSS", false, true); } catch (e) {}
    document.execCommand(cmd, false, val ?? null);
  }

  function commitCanvasBody(bodyEd, n) {
    if (!n) return;
    n.body = normalizeMarkupSource(serializeEditor(bodyEd));
    Store.save();
    refreshCanvasEditorContent(bodyEd, n);
    onNoteDataChange(n);
  }

  // Serializes the rich-text (contenteditable) DOM of the note editor back into our plain-text
  // markdown source, so `n.body` always stays a portable, exportable string — the same one that
  // extractLinkTitles/syncWikiLinks and .md export already understand — even though the editor
  // itself now shows fully rendered WYSIWYG formatting (bold looks bold, colors show, etc.)
  // instead of raw markdown syntax while you type.
  function domToMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    const inner = () => Array.from(node.childNodes).map(domToMarkdown).join("");
    if (node.classList && node.classList.contains("wikilink")) return `[[${node.dataset.wiki}]]`;
    switch (tag) {
      case "b": case "strong": return `**${inner()}**`;
      case "i": case "em": return `*${inner()}*`;
      case "u": return `__${inner()}__`;
      case "br": return "\n";
      case "div": case "p": return inner() + "\n";
      case "h1": return `# ${inner()}\n`;
      case "h2": return `## ${inner()}\n`;
      case "h3": return `### ${inner()}\n`;
      case "blockquote": return `> ${inner()}\n`;
      case "li": return `- ${inner()}\n`;
      case "code": return "`" + inner() + "`";
      case "pre": return "```\n" + inner() + "\n```";
      case "a": return node.getAttribute("href") ? `[${inner()}](${node.getAttribute("href")})` : inner();
      case "font": {
        const face = node.getAttribute("face");
        const color = node.getAttribute("color");
        let content = inner();
        const c = color && NOTE_COLORS.find(cc => cc.hex.toLowerCase() === color.toLowerCase());
        if (c) content = `{{${c.id}:${content}}}`;
        if (face) content = `{{font:${face}|${content}}}`;
        return content;
      }
      case "span": {
        let content = inner();
        const st = node.style;
        const cls = node.classList;
        if (cls?.contains("nc-bold")) content = `{{bold:${content}}}`;
        else if (cls?.contains("nc-italic")) content = `{{italic:${content}}}`;
        else if (cls?.contains("nc-underline")) content = `__${content}__`;
        else {
          const decoration = (st && (st.textDecorationLine || st.textDecoration)) || "";
          if (decoration.includes("underline")) content = `__${content}__`;
          if (st && st.fontStyle === "italic") content = `*${content}*`;
          const weight = st && st.fontWeight;
          if (weight === "bold" || weight === "700" || (parseInt(weight, 10) >= 600)) content = `**${content}**`;
        }
        const hex = rgbToHex(st && st.color);
        const c = hex && NOTE_COLORS.find(cc => cc.hex.toLowerCase() === hex.toLowerCase());
        if (c) content = `{{${c.id}:${content}}}`;
        const font = st && st.fontFamily;
        if (font) content = `{{font:${font.replace(/['"]/g, "").split(",")[0]}|${content}}}`;
        return content;
      }
      default: return inner();
    }
  }

  function serializeEditor(ed) {
    return Array.from(ed.childNodes).map(domToMarkdown).join("").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
  }

  function createNote(title, body, extra) {
    const n = mintNote(title, body, extra);
    activeNoteId = n.id;
    if (n.canvasId) attachNoteToCanvas(n, n.canvasId);
    render();
    return n;
  }

  function createNoteQuiet(title, body, extra) {
    const n = mintNote(title, body, extra);
    if (n.canvasId) attachNoteToCanvas(n, n.canvasId);
    return n;
  }

  function findOrCreateByTitle(title) {
    let n = Store.s.notes.find(x => x.title.toLowerCase() === title.toLowerCase());
    if (!n) n = createNote(title, `# ${title}\n\n`);
    return n;
  }

  // Repaints the editor's rich-text surface from the note's stored markdown, and (re)wires
  // the click handler that lets [[wiki-link]] chips navigate. Called on note switch and again
  // after every blur — a full "commit & pretty-print" pass — but never mid-keystroke, so it
  // can't yank the caret out from under an active typing session.
  function refreshEditorContent(ed, n) {
    ed.innerHTML = renderMarkdown(noteMarkupSource(n)) || "";
    ed.querySelectorAll(".wikilink").forEach(w => w.onclick = () => {
      const target = findOrCreateByTitle(w.dataset.wiki);
      n.links = n.links || []; target.links = target.links || [];
      if (!target.links.includes(n.id)) target.links.push(n.id);
      if (!n.links.includes(target.id)) n.links.push(target.id);
      Store.save();
      // Navigate inside the modal itself (rather than closing back to the grid and re-opening)
      // when the click originated from the popup editor.
      if (noteModalBack) openNoteModal(target.id); else render();
    });
  }

  /* ---------- Version history ---------- */
  function historyModal(n) {
    const rows = n.history.slice().reverse();
    modal("Version history", `
      <div class="card-sub" style="margin-bottom:12px">${rows.length ? "Snapshots are taken whenever you finish an editing session with changes." : "No earlier versions yet — keep editing, and checkpoints will appear here."}</div>
      <div id="history-list">
        ${rows.map((h, i) => `
          <div class="history-row" data-i="${rows.length - 1 - i}">
            <div>
              <div class="history-ts">${new Date(h.ts).toLocaleString()}</div>
              <div class="history-snip muted">${esc(h.body.replace(/\s+/g, " ").trim().slice(0, 70))}${h.body.length > 70 ? "…" : ""}</div>
            </div>
            <button class="btn sm" data-restore="${rows.length - 1 - i}">Restore</button>
          </div>`).join("") || ""}
      </div>`, [{ label: "Close" }]);
    setTimeout(() => {
      document.querySelectorAll("[data-restore]").forEach(b => b.onclick = () => {
        const idx = parseInt(b.dataset.restore, 10);
        const snap = n.history[idx];
        if (!snap) return;
        n.history.push({ ts: Date.now(), body: n.body });
        n.body = snap.body;
        Store.save();
        document.querySelector(".modal-back")?.remove();
        toast("Restored an earlier version");
        render();
      });
    }, 30);
  }

  /* ---------- Voice-to-text ---------- */
  function dictate(onText) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Voice input isn't supported in this browser", "bad"); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    toast("🎤 Listening… speak now");
    rec.onresult = e => { const txt = e.results[0][0].transcript; onText(txt); toast("✅ Captured: " + txt.slice(0, 40)); };
    rec.onerror = () => toast("Voice capture failed — try again", "bad");
    rec.start();
  }

  function downloadText(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- Journal view ---------- */
  function renderJournal() {
    const v = $("#view-journal");
    const today = Store.todayStr();
    if (!Store.s.journal[today]) Store.s.journal[today] = { prompt: dailyPrompt(), entry: "", gratitude: "" };
    const j = Store.s.journal[today];
    const pastDays = Object.keys(Store.s.journal).filter(d => d !== today && (Store.s.journal[d].entry || Store.s.journal[d].gratitude)).sort().reverse().slice(0, 14);

    v.innerHTML = `
      <div class="card">
        <h2>📔 Daily Journal — ${today}</h2>
        <div class="card-sub">Today's prompt:</div>
        <p style="font-size:1.05rem;font-weight:600;margin-bottom:12px">"${j.prompt}"</p>
        <textarea id="j-entry" style="min-height:140px" placeholder="Write freely…">${esc(j.entry)}</textarea>
      </div>
      <div class="card">
        <h2>🌼 Gratitude Corner</h2>
        <div class="card-sub">One thing you're glad happened today. Small counts. Tiny counts double.</div>
        <input type="text" id="j-grat" value="${esc(j.gratitude)}" placeholder="Today I'm glad that…">
      </div>
      ${pastDays.length ? `<div class="card"><h2>🕰 Past entries</h2>${pastDays.map(d => `
        <details style="margin-bottom:8px"><summary style="cursor:pointer"><b>${d}</b> — <span class="muted">${esc(Store.s.journal[d].prompt || "")}</span></summary>
        <p style="padding:8px 0 2px;font-size:.86rem">${esc(Store.s.journal[d].entry || "—")}</p>
        ${Store.s.journal[d].gratitude ? `<p class="muted" style="font-size:.8rem">🌼 ${esc(Store.s.journal[d].gratitude)}</p>` : ""}</details>`).join("")}</div>` : ""}`;

    let journalCredited = !!j.entry;
    $("#j-entry").oninput = e => {
      j.entry = e.target.value; Store.save();
      if (typeof Undo !== "undefined") Undo.recordDebounced("journal-entry");
      if (!journalCredited && j.entry.length > 30) { journalCredited = true; Game.questProgress("journal", 1); Game.addXP(20, null, { silent: true }); }
    };
    let gratCredited = !!j.gratitude;
    $("#j-grat").onchange = e => {
      j.gratitude = e.target.value; Store.save();
      if (typeof Undo !== "undefined") Undo.recordDebounced("journal-grat");
      if (!gratCredited && j.gratitude.length > 3) { gratCredited = true; Game.questProgress("gratitude", 1); toast("🌼 Gratitude logged. +15 XP", "xp"); Game.addXP(15, null, { silent: true }); }
      Game.checkBadges();
    };
  }

  function syncOpenNote(fromEl) {
    if (!noteModalBack || !activeNoteId) return;
    const n = Store.s.notes.find(x => x.id === activeNoteId);
    if (!n) return;
    const root = noteModalBack;
    const title = root.querySelector("#note-title");
    const ed = root.querySelector("#note-editor");
    if (title && (!fromEl || fromEl === title)) n.title = title.value;
    if (ed && (!fromEl || fromEl === ed || ed.contains(fromEl))) n.body = serializeEditor(ed);
    Store.save();
  }

  function getOpenNoteId() { return activeNoteId; }

  return { render, renderJournal, renderMarkdown, dailyPrompt, dictate, downloadText, openNoteModal, closeNoteModal, syncOpenNote, getOpenNoteId };
})();
