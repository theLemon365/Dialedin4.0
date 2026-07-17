/* ==========================================================
   ui.js — toasts, modals, congrats, themes, backgrounds,
            zen mode, scratchpad, shortcuts
   ========================================================== */
"use strict";

const UI = (() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Icon set — minimal 16x16 line glyphs (Linear/Feather-style), monochrome via currentColor ---------- */
  const SVG_OPEN = 'viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    home: `<path d="M2.5 7.5 8 3l5.5 4.5"/><path d="M4 6.5V13h8V6.5"/>`,
    check: `<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M5 8.2l2 2 4-4.2"/>`,
    calendar: `<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11"/><path d="M5.3 2v3M10.7 2v3"/>`,
    target: `<circle cx="8" cy="8" r="5.3"/><circle cx="8" cy="8" r="1.8"/>`,
    activity: `<path d="M2 9.5l2.6-3.6L7.4 9l3.4-6L14 8"/>`,
    bag: `<path d="M4.2 5.2h7.6l.9 8.3H3.3z"/><path d="M6.1 5.2v-1a1.9 1.9 0 0 1 3.8 0v1"/>`,
    bars: `<path d="M3.2 13V8.4M8 13V4M12.8 13V9.6"/>`,
    heart: `<path d="M8 13.2C4.3 10.7 2.4 8.7 2.4 6.4c0-1.7 1.4-2.9 2.9-2.9 1.1 0 2 .5 2.7 1.5.7-1 1.6-1.5 2.7-1.5 1.5 0 2.9 1.2 2.9 2.9 0 2.3-1.9 4.3-5.6 6.8z"/>`,
    file: `<path d="M4.2 2.2h4.6l3 3v8.6h-7.6z"/><path d="M6 8.2h4M6 10.5h4"/>`,
    book: `<path d="M8 4.3c-1.4-1-3.3-1-4.7-.5v9c1.4-.5 3.3-.5 4.7.5"/><path d="M8 4.3c1.4-1 3.3-1 4.7-.5v9c-1.4-.5-3.3-.5-4.7.5"/>`,
    wind: `<path d="M2 5.6h7.8a1.9 1.9 0 1 0-1.9-2.4"/><path d="M2 9.6h9.5a1.9 1.9 0 1 1-1.9 2.4"/>`,
    zap: `<path d="M8.6 2 4.2 8.8h3.4L7 14l4.8-7.2H8.1z"/>`,
    settings: `<circle cx="8" cy="8" r="2.1"/><path d="M8 2.4v1.8M8 11.8v1.8M2.4 8h1.8M11.8 8h1.8M4.1 4.1l1.3 1.3M10.6 10.6l1.3 1.3M11.9 4.1l-1.3 1.3M5.4 10.6l-1.3 1.3"/>`,
    moon: `<path d="M12.7 9.6A5.4 5.4 0 1 1 6.4 3.3a5.4 5.4 0 1 0 6.3 6.3z"/>`,
    keyboard: `<rect x="2" y="4.2" width="12" height="7.6" rx="1.4"/><path d="M4.4 7.2h.01M6.9 7.2h.01M9.1 7.2h.01M11.6 7.2h.01M4.8 9.6h6.4"/>`,
    chevron: `<path d="M5.5 3.5 10 8l-4.5 4.5"/>`,
    scratch: `<path d="M3.2 2.5h9.6v9L9.4 14H3.2z"/><path d="M9.4 14v-2.5h2.9"/>`,
    compass: `<circle cx="8" cy="8" r="5.6"/><path d="M10.2 5.8 9 9l-3.2 1.2L7 7z"/>`,
    gamepad: `<rect x="1.8" y="5" width="12.4" height="7" rx="3"/><path d="M4.6 8h2M5.6 7v2"/><circle cx="10.5" cy="7.5" r=".55" fill="currentColor" stroke="none"/><circle cx="12" cy="9" r=".55" fill="currentColor" stroke="none"/>`,
    volume: `<path d="M2.5 6.2h2.3L8 3.5v9L4.8 9.8H2.5z"/><path d="M10.5 6a3 3 0 0 1 0 4"/>`,
    palette: `<circle cx="8" cy="8" r="5.6"/><circle cx="6" cy="6.3" r=".7" fill="currentColor" stroke="none"/><circle cx="9.6" cy="5.8" r=".7" fill="currentColor" stroke="none"/><circle cx="10.4" cy="9.2" r=".7" fill="currentColor" stroke="none"/><path d="M8 3.6a4.4 4.4 0 0 0 0 8.8c1 0 1-1.4-.3-1.6-1.3-.2-1.1-1.9.3-1.9h1.3c1.5 0 2.7-1.3 2.7-2.7 0-1.4-1.5-2.6-4-2.6z"/>`,
    star: `<path d="M8 2.4l1.7 3.5 3.9.5-2.8 2.7.7 3.9L8 11.1l-3.5 1.9.7-3.9-2.8-2.7 3.9-.5z"/>`,
    flame: `<path d="M8 2.2s3.6 2.9 3.6 6.4a3.6 3.6 0 1 1-7.2 0c0-.9.3-1.6.7-2.2.2.9.9 1.4 1.5 1.2C6 6.4 5.5 4.3 8 2.2z"/>`,
    clock: `<circle cx="8" cy="8.4" r="5.6"/><path d="M8 5.4v3l2.2 1.3"/>`,
    coin: `<circle cx="8" cy="8" r="5.6"/><path d="M8 5.2v5.6M6.4 9.8c0 .8.7 1.2 1.6 1.2s1.6-.4 1.6-1c0-1.5-3.2-.8-3.2-2.4 0-.6.7-1 1.6-1s1.6.4 1.6 1"/>`,
    droplet: `<path d="M8 2.3c1.7 2.6 4 5.3 4 7.6a4 4 0 1 1-8 0c0-2.3 2.3-5 4-7.6z"/>`,
    plus: `<path d="M8 3.2v9.6M3.2 8h9.6"/>`,
    edit: `<path d="M10.3 2.9 13.1 5.7 5.4 13.4H2.6v-2.8z"/><path d="M9 4.2 11.8 7"/>`,
    x: `<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>`,
    link: `<circle cx="4.3" cy="11.7" r="2.1"/><circle cx="11.7" cy="4.3" r="2.1"/><path d="M5.8 10.2l4.4-4.4"/>`,
    bell: `<path d="M8 2.6c-2 0-3.4 1.6-3.4 3.8v2c0 .8-.3 1.5-.9 2.2l-.5.6h9.6l-.5-.6c-.6-.7-.9-1.4-.9-2.2v-2c0-2.2-1.4-3.8-3.4-3.8z"/><path d="M6.5 12.4a1.6 1.6 0 0 0 3 0"/>`,
    search: `<circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2l3.3 3.3"/>`,
    cube: `<path d="M8 2.4 13.4 5.4v5.2L8 13.6 2.6 10.6V5.4z"/><path d="M2.6 5.4 8 8.4l5.4-3M8 8.4v5.2"/>`,
    grid: `<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 6.5h11M2.5 10.5h11M6.5 2.5v11M10.5 2.5v11"/>`,
  };
  function iconSVG(name) { return ICONS[name] ? `<svg ${SVG_OPEN}>${ICONS[name]}</svg>` : ""; }
  function mountIcons(root) {
    (root || document).querySelectorAll("i.ico[data-ico]").forEach(n => {
      if (!n.dataset.mounted) { n.innerHTML = iconSVG(n.dataset.ico); n.dataset.mounted = "1"; }
    });
  }

  /* ---------- Toasts (deduped — spamming the same action replaces one toast) ---------- */
  const toastSlots = new Map();
  function toast(msg, kind = "", ms = 2600, opts = {}) {
    const key = opts.key || msg;
    let slot = toastSlots.get(key);
    if (slot) {
      clearTimeout(slot.hideTimer);
      clearTimeout(slot.removeTimer);
      slot.el.textContent = msg;
      slot.el.className = `toast ${kind}`;
      slot.el.classList.remove("out");
    } else {
      slot = { el: el("div", `toast ${kind}`, msg) };
      $("#toasts").appendChild(slot.el);
      toastSlots.set(key, slot);
    }
    slot.hideTimer = setTimeout(() => slot.el.classList.add("out"), ms);
    slot.removeTimer = setTimeout(() => {
      slot.el.remove();
      toastSlots.delete(key);
    }, ms + 450);
  }

  /* ---------- Modal ---------- */
  function modal(title, bodyHTML, actions = [], opts = {}) {
    const back = el("div", "modal-back");
    const m = el("div", "modal");
    m.innerHTML = `<h3>${title}</h3><div class="modal-body">${bodyHTML}</div>`;
    const act = el("div", "modal-actions");
    actions.forEach(a => {
      const b = el("button", `btn ${a.cls || ""}`, a.label);
      b.onclick = () => { const r = a.onClick ? a.onClick(m) : true; if (r !== false) back.remove(); };
      act.appendChild(b);
    });
    m.appendChild(act);
    back.appendChild(m);
    back.onclick = e => { if (e.target === back && !opts.sticky) back.remove(); };
    $("#modal-root").appendChild(back);
    return { close: () => back.remove(), root: m };
  }

  /* ---------- Congrats (Aarush celebrations) ---------- */
  let confettiRAF = null;
  function runConfetti(canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = innerWidth; canvas.height = innerHeight;
    const colors = ["#ffd166", "#4aa8ff", "#9d6bff", "#45d183", "#ff6b6b", "#ff9e4a"];
    const parts = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI, vr: -0.1 + Math.random() * 0.2,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    let frames = 0;
    (function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach(p => {
        p.y += p.vy; p.x += p.vx; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        if (p.y > canvas.height + 30) { p.y = -20; p.x = Math.random() * canvas.width; }
      });
      if (++frames < 60 * 8) confettiRAF = requestAnimationFrame(loop);
    })();
  }

  function congrats(title, msg, emoji = "🎉") {
    const ov = $("#congrats-overlay");
    $("#congrats-emoji").textContent = emoji;
    $("#congrats-title").textContent = title;
    $("#congrats-msg").textContent = msg;
    ov.classList.remove("hidden");
    if (Store.s.settings.animations) runConfetti($("#confetti-canvas"));
    AudioFX.play("levelup");
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("#congrats-close").onclick = () => {
      $("#congrats-overlay").classList.add("hidden");
      cancelAnimationFrame(confettiRAF);
    };
  });

  /* Milestone celebration wrapper — one-time per milestone id */
  function celebrateMilestone(id, title, msg, emoji) {
    if (Store.s.congratsShown.includes(id)) return;
    Store.s.congratsShown.push(id);
    Store.s.milestones.push({ ts: Date.now(), title });
    Store.save();
    congrats(title, msg, emoji);
  }

  /* ---------- Theme (two options: dark / minimal; winddown auto-applies near bedtime unless snoozed) ---------- */
  function applyTheme() {
    const mode = Store.s.settings.themeMode === "minimal" ? "minimal" : "dark";
    Store.s.settings.themeMode = mode;
    const h = new Date().getHours();
    const bedtime = Store.s.settings.bedtimeHour;
    const snoozedToday = Store.s.settings.winddownSnoozeDate === Store.todayStr();
    const windingDown = Store.s.settings.autoWinddown !== false && !snoozedToday &&
      h >= bedtime - 1 && h < bedtime + 2;
    document.body.dataset.theme = windingDown ? "winddown" : (mode === "minimal" ? "minimal" : "night");
    document.body.dataset.font = Store.s.settings.font;
    document.body.classList.toggle("no-anim", !Store.s.settings.animations);
    // custom accent (shop upgrade)
    if (Store.s.settings.accentColor && Store.s.shopOwned.includes("cos_accent"))
      document.body.style.setProperty("--accent", Store.s.settings.accentColor);
    else document.body.style.removeProperty("--accent");
    $("#custom-css-inject").textContent = Store.s.settings.customCSS || "";
    drawBackground();
  }

  /* Explicit user theme pick (button/dropdown) always wins over auto wind-down for the rest of today. */
  function setThemeMode(mode) {
    Store.s.settings.themeMode = mode === "minimal" ? "minimal" : "dark";
    Store.s.settings.winddownSnoozeDate = Store.todayStr();
    Store.save();
    applyTheme();
  }

  /* ---------- Procedural "video" backgrounds ---------- */
  let bgRAF = null, bgParts = [];
  function drawBackground() {
    cancelAnimationFrame(bgRAF);
    const cv = $("#bg-canvas");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    cv.width = innerWidth; cv.height = innerHeight;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const kind = Store.s.settings.videoBg;
    if (kind === "none" || !Store.s.settings.animations) return;

    if (kind === "rain") {
      bgParts = Array.from({ length: 120 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, l: 8 + Math.random() * 14, v: 7 + Math.random() * 8 }));
      (function loop() {
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = "rgba(120,160,220,.35)"; ctx.lineWidth = 1;
        bgParts.forEach(p => {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 1.5, p.y + p.l); ctx.stroke();
          p.y += p.v; p.x -= 0.4;
          if (p.y > cv.height) { p.y = -20; p.x = Math.random() * cv.width; }
        });
        bgRAF = requestAnimationFrame(loop);
      })();
    } else if (kind === "space") {
      bgParts = Array.from({ length: 160 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.6 + .3, tw: Math.random() * Math.PI * 2 }));
      (function loop() {
        ctx.clearRect(0, 0, cv.width, cv.height);
        bgParts.forEach(p => {
          p.tw += 0.03;
          ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(p.tw));
          ctx.fillStyle = "#cfe2ff";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          p.x -= 0.06; if (p.x < 0) p.x = cv.width;
        });
        ctx.globalAlpha = 1;
        bgRAF = requestAnimationFrame(loop);
      })();
    } else if (kind === "cozy") {
      // slow drifting warm dust motes
      bgParts = Array.from({ length: 40 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 3 + 1, vx: 0.15 + Math.random() * 0.3, ph: Math.random() * Math.PI * 2 }));
      (function loop() {
        ctx.clearRect(0, 0, cv.width, cv.height);
        bgParts.forEach(p => {
          p.ph += 0.01; p.x += p.vx; p.y += Math.sin(p.ph) * 0.3;
          if (p.x > cv.width) p.x = -5;
          ctx.globalAlpha = 0.12 + 0.1 * Math.sin(p.ph * 2);
          ctx.fillStyle = "#e8b06a";
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
        bgRAF = requestAnimationFrame(loop);
      })();
    }
  }
  window.addEventListener("resize", () => drawBackground());

  /* ---------- View switching ---------- */
  const renderers = {};
  function registerView(name, fn) { renderers[name] = fn; }
  function showView(name) {
    $$(".view").forEach(v => v.classList.remove("active"));
    $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
    const view = $("#view-" + name);
    if (view) view.classList.add("active");
    if (renderers[name]) renderers[name]();
    // expand parent nav-group if collapsed
    const navBtn = $$(".nav-item").find(n => n.dataset.view === name);
    if (navBtn) {
      const items = navBtn.closest(".nav-group-items");
      if (items && items.classList.contains("collapsed")) {
        items.classList.remove("collapsed");
        items.parentElement.querySelector(".nav-group-head")?.classList.remove("collapsed");
      }
    }
    currentView = name;
  }
  let currentView = "dashboard";

  /* ---------- Greeting + identity ---------- */
  function greetingText() {
    const h = new Date().getHours();
    const base = h < 5 ? `Burning the midnight oil, ${USER_NAME}?` :
      h < 12 ? `Good morning, ${USER_NAME}` :
      h < 17 ? `Good afternoon, ${USER_NAME}` :
      h < 21 ? `Good evening, ${USER_NAME}` : `Winding down, ${USER_NAME}?`;
    const d = Store.day();
    const doneToday = d.tasksDone;
    const focusToday = d.focusMin;
    let vibe;
    if (focusToday >= 120 || doneToday >= 5) vibe = "You're crushing it today. 🔥";
    else if (focusToday >= 30 || doneToday >= 1) vibe = "Solid progress — keep the momentum.";
    else if (new Date().getHours() >= 15) vibe = "The day isn't over. One task. Right now.";
    else vibe = "Fresh start. Pick one thing and begin.";
    return `${base} — <span class="muted2">${vibe}</span>`;
  }
  function refreshGreeting() { $("#greeting").innerHTML = greetingText(); }

  function refreshIdentity() {
    $("#identity-banner").textContent = "✦ " + (Store.s.settings.identity || "Set your identity anchor…") + " ✦";
  }

  /* ---------- Top chips (The Progress zone, always visible) ---------- */
  function refreshChips() {
    const lvl = Game.level();
    const chipIco = name => `<i class="ico muted-icon">${iconSVG(name)}</i>`;
    $("#chip-level").innerHTML = `${chipIco("star")} Lv ${lvl.level}${Store.s.prestige ? ` <span class="muted">P${Store.s.prestige}</span>` : ""}`;
    $("#xp-label").textContent = `${lvl.into}/${lvl.need} XP`;
    const coinsVal = Store.s.infiniteCoinsEnabled ? "∞" : Store.s.coins;
    $("#chip-coins").innerHTML = `${chipIco("coin")} ${coinsVal}`;
    $("#chip-streak").innerHTML = `${chipIco("flame")} ${Store.s.streak} day${Store.s.streak === 1 ? "" : "s"}`;
    $("#chip-multiplier").innerHTML = `${chipIco("zap")} ×${Game.multiplier().toFixed(1)}`;
    // sidebar mini profile
    const eq = Store.s.equipped;
    const skin = Game.shopItem(eq.skin), pet = Game.shopItem(eq.pet);
    $("#side-profile").innerHTML = `
      <div class="avatar-mini">${skin ? skin.icon : "🙂"}${pet ? `<span class="avatar-pet">${pet.icon}</span>` : ""}</div>
      <div><b>${USER_NAME}</b><br><span class="muted">Lv ${lvl.level} · ${chipIco("flame")}${Store.s.streak}</span></div>`;
  }

  function refreshAll() {
    refreshGreeting(); refreshIdentity(); refreshChips();
    if (renderers[currentView]) renderers[currentView]();
  }

  /* ---------- Global quick-add bar (bottom-edge, opens on "n") ---------- */
  function toggleQuickBar(force) {
    const bar = $("#quick-bar");
    const input = $("#quick-bar-input");
    const on = typeof force === "boolean" ? force : bar.classList.contains("hidden");
    bar.classList.toggle("hidden", !on);
    if (on) { input.value = ""; setTimeout(() => input.focus(), 10); }
  }
  function initQuickBar() {
    const input = $("#quick-bar-input");
    input.addEventListener("keydown", e => {
      if (e.key === "Escape") { toggleQuickBar(false); return; }
      if (e.key !== "Enter" || !input.value.trim()) return;
      const t = Tasks.createTask(Tasks.parseQuickAdd(input.value));
      Automation.applyTemplates(t);
      Store.save();
      AudioFX.play("tick");
      toast(`＋ Added "${t.title}"`);
      toggleQuickBar(false);
      if (renderers[currentView]) renderers[currentView]();
    });
  }

  /* ---------- Scratchpad ---------- */
  function initScratchpad() {
    const pad = $("#scratchpad"), txt = $("#scratch-text");
    txt.value = Store.s.scratchpad || "";
    txt.oninput = () => {
      Store.s.scratchpad = txt.value;
      Store.save();
      if (typeof Undo !== "undefined") Undo.recordDebounced("scratchpad");
    };
    $("#scratch-toggle").onclick = () => pad.classList.toggle("hidden");
    $("#scratch-close").onclick = () => pad.classList.add("hidden");
  }

  /* ---------- Zen mode ---------- */
  function enterZen() {
    $("#zen-overlay").classList.remove("hidden");
    updateZen();
  }
  function exitZen() { $("#zen-overlay").classList.add("hidden"); }
  function isZen() { return !$("#zen-overlay").classList.contains("hidden"); }

  /* ---------- Minimal Mode (the "z" / sidebar Zen Mode button) ----------
     Distinct from the fullscreen Focus Session above (click the timer ring for that).
     Minimal Mode strips the whole app down to Dashboard's timer+task, Tasks, and Analytics. */
  function isMinimalMode() { return document.body.classList.contains("minimal-zen"); }
  function toggleMinimalMode(force) {
    const on = typeof force === "boolean" ? force : !isMinimalMode();
    document.body.classList.toggle("minimal-zen", on);
    $("#zen-btn")?.classList.toggle("active", on);
    toast(on ? "Minimal Mode — just your timer, tasks, notes & analytics. Press z to exit." : "Minimal Mode off — welcome back.", "", 3200, { key: "minimal-mode" });
    if (renderers[currentView]) renderers[currentView]();
  }
  function updateZen() {
    if (!isZen()) return;
    const t = Tasks.nowTask();
    $("#zen-task").textContent = t ? t.title : "Pick a task, then breathe.";
    $("#zen-timer").textContent = Timer.displayTime();
    const c = $("#zen-controls");
    c.innerHTML = "";
    const mk = (label, cls, fn) => { const b = el("button", `btn ${cls}`, label); b.onclick = fn; c.appendChild(b); return b; };
    mk(Timer.isRunning() ? (Timer.isPaused() ? "▶ Resume" : "⏸ Pause") : "▶ Start Focus", "primary",
      () => { Timer.isRunning() ? Timer.togglePause() : Timer.start("pomodoro"); updateZen(); });
    if (Timer.isRunning()) mk("⏹ Reset", "danger", () => Timer.stop(false));
    if (t) mk(`✅ Done — "${esc(t.title.length > 28 ? t.title.slice(0, 26) + "…" : t.title)}"`, "good",
      () => { Psych.gateComplete(t); $("#zen-picker").classList.add("hidden"); updateZen(); });
    mk("📋 Pick task", "ghost", () => {
      const p = $("#zen-picker");
      p.classList.toggle("hidden");
      if (!p.classList.contains("hidden")) renderZenPicker();
    });
  }

  /* Zen task picker — pulls straight from the Kanban board */
  function renderZenPicker() {
    const p = $("#zen-picker");
    p.innerHTML = "";
    const tasks = [...Tasks.sortedTasks("doing"), ...Tasks.sortedTasks("todo")].slice(0, 10);
    if (!tasks.length) {
      p.innerHTML = `<div class="zp-empty muted">Board is empty — add tasks from the Dashboard or Tasks view.</div>`;
      return;
    }
    const now = Tasks.nowTask();
    tasks.forEach(t => {
      const item = el("button", `zp-item ${now && now.id === t.id ? "current" : ""}`);
      item.innerHTML = `<span>${t.status === "doing" ? "🚧 " : ""}${esc(t.title)}</span>
        <span class="muted" style="font-size:.7rem">${t.estimate ? "⏱ " + t.estimate + "m" : ""} ${t.priority === "high" ? "🔴" : ""}</span>`;
      item.onclick = () => {
        Tasks.setNow(t.id, { quiet: true });
        p.classList.add("hidden");
        updateZen();
      };
      p.appendChild(item);
    });
  }

  /* ---------- Guided website tour ---------- */
  let tour = { active: false, step: 0 };
  function clearTourHighlight() {
    $$(".tour-target").forEach(n => n.classList.remove("tour-target"));
  }
  function closeTour() {
    tour.active = false;
    clearTourHighlight();
    $("#tour-overlay")?.remove();
    $("#tour-card")?.remove();
  }
  function tourSteps() {
    return [
      { view: "dashboard", target: "#view-dashboard .zone-now", title: "The Now Zone", body: "This is your single active mission. Start here when you feel overwhelmed." },
      { view: "dashboard", target: "#view-dashboard .card .pulse-wrap", title: "The Pulse Timer", body: "Run focus sessions, customize work/break lengths, and track streak-safe deep work." },
      { view: "tasks", target: "#view-tasks .kanban", title: "Kanban Board", body: "Plan and move tasks across To Do, Doing, and Done. Drag and drop everything." },
      { view: "timebox", target: "#view-timebox .timebox-grid", title: "Timebox Grid", body: "Drag tasks into hour blocks. Save this as a routine to reuse daily without retyping." },
      { view: "skills", target: "#view-skills #boss-list", title: "Boss Battles", body: "Break giant projects into sub-tasks and chip down a boss HP bar as you finish work." },
      { view: "shop", target: "#view-shop .shop-grid", title: "Shop & Rewards", body: "Spend coins on cosmetics, upgrades, and real-life reward permissions." },
      { view: "analytics", target: "#view-analytics", title: "Analytics", body: "See focus patterns, streaks, and progress trends. Previews keep this useful from day one." },
      { view: "automation", target: "#view-automation", title: "Automation & Backup", body: "Create rules, export/import backups, and undo prestige safely." },
      { view: "settings", target: "#view-settings", title: "Settings", body: "Switch themes, accents, sounds, and behavior. Tune DialedIn to your style." },
      { view: "dashboard", target: "#zen-btn", title: "Zen Mode", body: "Strips the whole app down to just your timer, tasks, and Analytics — everything else disappears until you press z again." },
      { view: "dashboard", target: "#view-dashboard .card .timer-mini", title: "Focus Session", body: "Click the timer readout itself for a true fullscreen focus session — just the task and the clock, nothing else." },
      { view: "dashboard", target: "#media-guard-btn", title: "Honesty Gate", body: "About to open games or media? This makes you type out loud what you're choosing, before you choose it." },
    ];
  }
  function positionTourCard(target) {
    const card = $("#tour-card");
    if (!card) return;
    if (!target) {
      card.style.left = "50%";
      card.style.top = "50%";
      card.style.transform = "translate(-50%, -50%)";
      return;
    }
    const r = target.getBoundingClientRect();
    const margin = 14;
    const cardW = Math.min(430, Math.floor(innerWidth * .92));
    let left = r.right + margin;
    if (left + cardW > innerWidth - margin) left = Math.max(margin, r.left - cardW - margin);
    let top = r.top;
    const maxTop = innerHeight - card.offsetHeight - margin;
    if (top > maxTop) top = maxTop;
    top = Math.max(margin, top);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.transform = "none";
  }
  function renderTourStep() {
    if (!tour.active) return;
    const steps = tourSteps();
    const s = steps[tour.step];
    if (!s) return closeTour();
    showView(s.view);
    setTimeout(() => {
      clearTourHighlight();
      const target = $(s.target);
      target?.classList.add("tour-target");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      const card = $("#tour-card");
      if (!card) return;
      card.innerHTML = `
        <div class="tour-kicker">Guided Tour</div>
        <div class="tour-title">${esc(s.title)}</div>
        <div class="tour-body">${esc(s.body)}</div>
        <div class="tour-actions">
          <button class="btn sm" id="tour-back" ${tour.step === 0 ? "disabled" : ""}>← Back</button>
          <button class="btn sm primary" id="tour-next">${tour.step === steps.length - 1 ? "Finish" : "Next →"}</button>
          <button class="btn sm ghost" id="tour-close">Close</button>
          <span class="tour-step">${tour.step + 1} / ${steps.length}</span>
        </div>`;
      $("#tour-back").onclick = () => { tour.step = Math.max(0, tour.step - 1); renderTourStep(); };
      $("#tour-next").onclick = () => { tour.step >= steps.length - 1 ? closeTour() : (tour.step++, renderTourStep()); };
      $("#tour-close").onclick = closeTour;
      positionTourCard(target);
    }, 90);
  }
  function startTour() {
    closeTour();
    tour = { active: true, step: 0 };
    document.body.appendChild(el("div", "", ""));
    document.body.lastElementChild.id = "tour-overlay";
    const card = el("div", "");
    card.id = "tour-card";
    document.body.appendChild(card);
    $("#tour-overlay").onclick = closeTour;
    renderTourStep();
  }

  /* ---------- Keyboard shortcuts ---------- */
  const viewKeys = { "1": "dashboard", "2": "tasks", "3": "timebox", "4": "quests", "5": "skills", "6": "shop", "7": "notes", "8": "analytics", "9": "wellness" };
  function isTypingContext() {
    const ae = document.activeElement;
    if (currentView === "srs" && typeof SRS !== "undefined" && SRS.isSessionActive()) return true;
    if (!ae) return false;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName)) return true;
    if (ae.isContentEditable) return true;
    if (!$("#quick-bar")?.classList.contains("hidden")) return true;
    if (!$("#scratchpad")?.classList.contains("hidden")) return true;
    if ($("#modal-root")?.children.length) return true;
    if (document.querySelector(".note-modal-back")) return true;
    const typingSel = "#note-editor, #note-title, #j-entry, #j-grat, #bd-text, #task-search, #quick-add-input, #quick-bar-input, #scratch-text, #set-css, .modal";
    if (ae.closest && ae.closest(typingSel)) return true;
    return false;
  }
  function initShortcuts() {
    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openCommandPalette(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (typeof Undo !== "undefined") Undo.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        if (typeof Undo !== "undefined") Undo.redo();
        return;
      }
      if (e.key === "Escape") { if ($("#cmd-palette-back")) closeCommandPalette(); else if (tour.active) closeTour(); else exitZen(); return; }
      if (Store.s.settings.shortcutsEnabled === false) return;
      if (isTypingContext()) return;
      if (viewKeys[e.key]) { showView(viewKeys[e.key]); }
      else if (e.key === "z") { toggleMinimalMode(); }
      else if (e.key === "b") { toggleSidebar(); }
      else if (e.key === "s") { $("#scratchpad").classList.toggle("hidden"); }
      else if (e.key === " ") { e.preventDefault(); Timer.isRunning() ? Timer.togglePause() : Timer.start("pomodoro"); }
      else if (e.key === "n" || e.key === "c") { toggleQuickBar(true); }
      else if (e.key === "g") { startTour(); }
      else if (e.key === "?") { showShortcutHelp(); }
    });
  }
  function showShortcutHelp() {
    modal("⌨️ Keyboard Shortcuts", `
      <div class="stat-line"><span>Ctrl/Cmd + K</span><b>Search anything (always on)</b></div>
      <div class="stat-line"><span>Ctrl/Cmd + Z</span><b>Undo last action or typing</b></div>
      <div class="stat-line"><span>Ctrl/Cmd + Y</span><b>Redo (also Cmd/Ctrl + Shift + Z)</b></div>
      <div class="stat-line"><span>↓ / ↑</span><b>Timebox: month calendar ↔ day view</b></div>
      <div class="stat-line"><span>Settings</span><b>Toggle shortcuts on/off</b></div>
      <div class="stat-line"><span>1–9</span><b>Switch views</b></div>
      <div class="stat-line"><span>Space</span><b>Start / pause timer</b></div>
      <div class="stat-line"><span>z</span><b>Minimal Mode (strips app to timer + tasks + analytics)</b></div>
      <div class="stat-line"><span>click ring</span><b>Fullscreen Focus Session</b></div>
      <div class="stat-line"><span>n / c</span><b>Quick-add a task (bottom bar)</b></div>
      <div class="stat-line"><span>g</span><b>Start guided tour</b></div>
      <div class="stat-line"><span>s</span><b>Scratchpad</b></div>
      <div class="stat-line"><span>b</span><b>Toggle sidebar</b></div>
      <div class="stat-line"><span>Esc</span><b>Exit Focus Session / close</b></div>
      <div class="stat-line"><span>?</span><b>This help</b></div>`,
      [{ label: "Close", cls: "primary" }]);
  }

  /* ---------- Global Command Palette (Ctrl/Cmd+K) — site-wide search + jump + highlight ---------- */
  const SEARCH_SYNONYMS = {
    pulse: ["timer", "pomodoro", "stopwatch", "focus session", "the pulse"],
    focus: ["deep work", "concentration", "focus time", "focus-to-distraction", "focus distribution", "distraction ratio"],
    zen: ["minimal mode", "minimal", "distraction free"],
    streak: ["days", "flame", "multiplier"],
    boss: ["boss battle", "project", "hp"],
    mood: ["feelings", "emotion", "wellness mood"],
    water: ["hydration", "drink", "cups"],
    journal: ["diary", "gratitude", "reflection"],
    brain: ["brain dump", "inbox", "vent"],
    heatmap: ["calendar heat", "focus heatmap"],
    energy: ["peak hour", "energy tracker", "hour of day"],
    distribution: ["pie chart", "skill split", "focus distribution"],
    ratio: ["focus-to-distraction", "distraction ratio"],
    shop: ["avatar", "coins", "skins", "pets"],
    quest: ["daily quest", "badges"],
    timebox: ["schedule", "calendar grid", "time block"],
    settings: ["theme", "appearance", "profile", "sound"],
    automation: ["rules", "ifttt", "templates"],
    analytics: ["stats", "report", "data", "insights"],
    dashboard: ["home", "now zone", "progress"],
  };

  function expandQuery(q) {
    const parts = new Set([q]);
    Object.entries(SEARCH_SYNONYMS).forEach(([key, vals]) => {
      if (q.includes(key) || vals.some(v => q.includes(v))) {
        parts.add(key);
        vals.forEach(v => parts.add(v));
      }
    });
    return [...parts].join(" ");
  }

  function highlightElement(node, ms = 2600) {
    if (!node) return;
    node.classList.add("search-flash");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => node.classList.remove("search-flash"), ms);
  }

  function findTextTarget(container, needle) {
    if (!container || !needle) return null;
    const n = needle.toLowerCase();
    const escAttr = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(needle) : needle.replace(/"/g, '\\"');
    const marked = container.querySelector(`[data-search="${escAttr}"]`);
    if (marked) return marked;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node, best = null;
    while (node = walker.nextNode()) {
      if (!node.textContent.trim() || !node.textContent.toLowerCase().includes(n)) continue;
      let el = node.parentElement;
      while (el && el !== container) {
        if (el.matches && el.matches(".card, .stat-line, .zone-label, .zone-now, .pulse-card, .progress-card, .ritual-card, .quest-item, .shop-item, .skill-row, .boss-card, .nav-item, h2, h3, label.field, .mode-btn, .note-tile, .task-col, .breath-stage, .water-row, .mood-row")) {
          best = el;
          break;
        }
        el = el.parentElement;
      }
      if (best) break;
      best = node.parentElement;
      break;
    }
    return best;
  }

  function navigateAndHighlight(viewName, findText, query) {
    showView(viewName);
    const needle = findText || query;
    let found = false;
    [120, 320, 650].forEach(ms => {
      setTimeout(() => {
        if (found) return;
        const container = $("#view-" + viewName);
        const target = findTextTarget(container, needle);
        if (target) { found = true; highlightElement(target); }
      }, ms);
    });
  }

  function scanLivePageText() {
    const seen = new Set();
    const entries = [];
    const views = ["dashboard", "tasks", "timebox", "quests", "skills", "shop", "notes", "journal", "braindump", "analytics", "wellness", "automation", "settings"];
    views.forEach(viewName => {
      const container = $("#view-" + viewName);
      if (!container || !container.textContent.trim()) return;
      container.querySelectorAll("h2, h3, .zone-label, .stat-line > span:first-child, .card-sub, .ritual-k").forEach(el => {
        const title = el.textContent.replace(/\s+/g, " ").trim().slice(0, 90);
        if (title.length < 4) return;
        const key = viewName + "|" + title.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        entries.push({
          title,
          sub: viewName + " · on page",
          icon: "search",
          body: title.toLowerCase(),
          run: () => navigateAndHighlight(viewName, title, title.toLowerCase()),
        });
      });
    });
    return entries;
  }

  function siteEntry(title, sub, icon, view, findText, keywords = []) {
    const blob = [title, findText, ...keywords].filter(Boolean).join(" ").toLowerCase();
    return {
      title, sub, icon, body: blob,
      run: () => navigateAndHighlight(view, findText || title, title.toLowerCase()),
    };
  }

  function buildPaletteCommands() {
    const cmds = [];
    $$(".nav-item[data-view]").forEach(btn => {
      const clone = btn.cloneNode(true);
      clone.querySelectorAll("kbd,.ico").forEach(n => n.remove());
      cmds.push({
        title: clone.textContent.trim(), sub: "View", icon: btn.querySelector(".ico")?.dataset.ico || "file",
        body: clone.textContent.trim().toLowerCase(),
        run: () => showView(btn.dataset.view),
      });
    });

    cmds.push(
      siteEntry("The Pulse", "Dashboard · Timer", "clock", "dashboard", "The Pulse", ["pulse", "timer", "pomodoro"]),
      siteEntry("The Now Zone", "Dashboard · Active task", "target", "dashboard", "The Now Zone", ["now zone", "current task"]),
      siteEntry("The Progress", "Dashboard · Level & quests", "star", "dashboard", "The Progress", ["progress", "level", "xp", "streak"]),
      siteEntry("Daily Ritual", "Dashboard · Run your day", "compass", "dashboard", "Daily Ritual", ["ritual", "run this day"]),
      siteEntry("Focus-to-distraction ratio", "Analytics · Core Stats", "bars", "analytics", "Focus-to-distraction ratio", ["focus ratio", "distraction"]),
      siteEntry("Focus Distribution", "Analytics · Pie chart", "bars", "analytics", "Focus Distribution", ["distribution", "pie", "skills split"]),
      siteEntry("Energy Tracker", "Analytics · Peak hours", "activity", "analytics", "Energy Tracker", ["energy", "peak hour"]),
      siteEntry("Focus Heatmap", "Analytics · 26 weeks", "calendar", "analytics", "Focus Heatmap", ["heatmap"]),
      siteEntry("Streak Calendar", "Analytics · 28 days", "calendar", "analytics", "Streak Calendar", ["streak calendar"]),
      siteEntry("Weekly Report Card", "Analytics · Download", "file", "analytics", "Weekly Report Card", ["report"]),
      siteEntry("Predictive Analytics", "Analytics · ETA", "target", "analytics", "Predictive Analytics", ["predictions"]),
      siteEntry("Kanban board", "Tasks · Board view", "check", "tasks", "Kanban", ["board", "todo", "doing", "done"]),
      siteEntry("Smart lists", "Tasks · List view", "bars", "tasks", "Smart lists", ["today", "next 7 days"]),
      siteEntry("Eisenhower matrix", "Tasks · Priority grid", "target", "tasks", "Eisenhower", ["urgent", "important"]),
      siteEntry("Timebox grid", "Timebox · Day schedule", "calendar", "timebox", "Timebox", ["timebox", "schedule"]),
      siteEntry("Brain Dump Inbox", "Mind · Vent & convert", "wind", "braindump", "Brain Dump", ["brain dump", "inbox"]),
      siteEntry("Journal", "Mind · Daily prompt", "book", "journal", "Journal", ["gratitude", "diary"]),
      siteEntry("Daily quests", "Quests · Today", "target", "quests", "Daily Quests", ["quests"]),
      siteEntry("Badges", "Quests · Achievements", "star", "quests", "Badges", ["badges", "achievements"]),
      siteEntry("Boss Battles", "Skills · Projects", "activity", "skills", "Boss", ["boss battles"]),
      siteEntry("Skill trees", "Skills · XP tracks", "activity", "skills", "Skills", ["skill tree"]),
      siteEntry("Shop & Avatar", "Progression · Cosmetics", "bag", "shop", "Your Avatar", ["shop", "avatar", "skins", "pets"]),
      siteEntry("Hydration tracker", "Wellness · Water", "droplet", "wellness", "Hydration", ["water", "hydration"]),
      siteEntry("Mood check-in", "Wellness · Log mood", "heart", "wellness", "Mood", ["mood", "feelings"]),
      siteEntry("Breathing exercise", "Wellness · Calm", "wind", "wellness", "Breathing", ["breath", "calm"]),
      siteEntry("IFTTT rules", "Automation · Triggers", "zap", "automation", "IFTTT", ["rules", "automation"]),
      siteEntry("Spaced Repetition Flashcards", "Tools · Spaced repetition learning", "star", "srs", "Spaced Repetition Flashcards", ["srs", "spaced repetition", "flashcards", "study", "sm-2"]),
      siteEntry("Theme & appearance", "Settings · Look & feel", "palette", "settings", "Appearance", ["theme", "dark", "minimal", "font"]),
      siteEntry("Keyboard shortcuts", "Settings · Hotkeys", "keyboard", "settings", "Keyboard", ["shortcuts", "hotkeys"]),
      siteEntry("Context profiles", "Settings · School / Life", "settings", "settings", "Context Profiles", ["profile", "school", "hobbies"]),
      { title: "Toggle Minimal (Zen) Mode", sub: "Action · z", icon: "moon", body: "minimal zen mode toggle", run: () => toggleMinimalMode() },
      { title: "Enter Focus Session", sub: "Action", icon: "clock", body: "focus session fullscreen zen overlay", run: () => enterZen() },
      { title: "Quick-add a task", sub: "Action · n", icon: "plus", body: "quick add task create", run: () => toggleQuickBar(true) },
      { title: "Toggle sidebar", sub: "Action · b", icon: "bars", body: "sidebar collapse", run: () => toggleSidebar() },
      { title: "Start guided tour", sub: "Action · g", icon: "compass", body: "tour guide onboarding", run: () => startTour() },
      { title: "Show keyboard shortcuts", sub: "Action · ?", icon: "keyboard", body: "shortcuts help", run: () => showShortcutHelp() },
      { title: "Cycle theme", sub: "Action", icon: "palette", body: "theme dark minimal switch", run: () => $("#theme-cycle")?.click() },
    );

    (Store.s.tasks || []).forEach(t => {
      if (t.status === "done") return;
      cmds.push({
        title: t.title, sub: "Task · " + t.status, icon: "check",
        body: [t.title, ...(t.tags || []), t.priority].join(" ").toLowerCase(),
        run: () => { showView("tasks"); setTimeout(() => highlightElement(findTextTarget($("#view-tasks"), t.title)), 120); },
      });
    });

    (Store.s.notes || []).forEach(n => {
      const cv = n.canvasId ? (Store.s.canvases || []).find(c => c.id === n.canvasId) : null;
      cmds.push({
        title: n.title || "Untitled", sub: cv ? "Notecard · canvas" : "Note", icon: cv ? "cube" : "file",
        body: [n.title, n.body || ""].join(" ").toLowerCase(),
        run: () => { showView("notes"); Notes.openNoteModal(n.id); },
      });
    });

    Object.entries(Store.s.journal || {}).forEach(([date, j]) => {
      if (!j.entry && !j.gratitude) return;
      cmds.push({
        title: `Journal · ${date}`, sub: "Journal entry", icon: "book",
        body: [date, j.prompt, j.entry, j.gratitude].join(" ").toLowerCase(),
        run: () => { showView("journal"); setTimeout(() => highlightElement(findTextTarget($("#view-journal"), date)), 120); },
      });
    });

    const seenTitles = new Set(cmds.map(c => c.title.toLowerCase()));
    scanLivePageText().forEach(entry => {
      if (seenTitles.has(entry.title.toLowerCase())) return;
      seenTitles.add(entry.title.toLowerCase());
      cmds.push(entry);
    });

    return cmds;
  }

  function markMatch(text, q) {
    if (!q) return esc(text);
    const idx = text.toLowerCase().indexOf(q);
    if (idx < 0) return esc(text);
    return esc(text.slice(0, idx)) + `<mark class="cmd-mark">${esc(text.slice(idx, idx + q.length))}</mark>` + esc(text.slice(idx + q.length));
  }

  function closeCommandPalette() { $("#cmd-palette-back")?.remove(); }
  function openCommandPalette() {
    if ($("#cmd-palette-back")) { $("#cmd-palette-input")?.focus(); return; }
    const back = el("div", "cmd-palette-back");
    back.id = "cmd-palette-back";
    back.innerHTML = `
      <div class="cmd-palette-box">
        <div class="cmd-palette-input-row">
          <i class="ico" data-ico="search"></i>
          <input type="text" id="cmd-palette-input" placeholder="Search anything on the site…" autocomplete="off" spellcheck="false">
          <kbd>esc</kbd>
        </div>
        <div class="cmd-palette-results" id="cmd-palette-results"></div>
        <div class="cmd-palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> go &amp; highlight</span>
        </div>
      </div>`;
    document.body.appendChild(back);
    mountIcons(back);
    back.onclick = e => { if (e.target === back) closeCommandPalette(); };
    requestAnimationFrame(() => back.classList.add("open"));

    const commands = (() => { try { return buildPaletteCommands(); } catch (e) { console.error("Search index error:", e); return []; } })();
    const input = $("#cmd-palette-input");
    const resultsEl = $("#cmd-palette-results");
    let active = 0, shown = [];

    function score(cmd, qRaw) {
      const q = expandQuery(qRaw);
      const tokens = q.split(/\s+/).filter(Boolean);
      if (!tokens.length) return 1;
      const title = cmd.title.toLowerCase();
      const body = (cmd.body || "").toLowerCase();
      let s = -1;
      tokens.forEach(t => {
        if (title === t) s = Math.max(s, 100);
        else if (title.startsWith(t)) s = Math.max(s, 85);
        else {
          const ti = title.indexOf(t);
          if (ti >= 0) s = Math.max(s, 70 - ti);
        }
        if (body.includes(t)) s = Math.max(s, 35);
        if ((cmd.sub || "").toLowerCase().includes(t)) s = Math.max(s, 45);
      });
      return s;
    }
    function setActive(i) {
      active = i;
      resultsEl.querySelectorAll(".cmd-palette-item").forEach((row, j) => {
        row.classList.toggle("active", j === active);
      });
      resultsEl.querySelector(".cmd-palette-item.active")?.scrollIntoView({ block: "nearest" });
    }
    function draw() {
      const q = input.value.trim().toLowerCase();
      shown = q
        ? commands.map(c => ({ c, s: score(c, q) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).map(x => x.c).slice(0, 50)
        : commands.slice(0, 50);
      active = Math.min(active, Math.max(0, shown.length - 1));
      resultsEl.innerHTML = shown.length ? "" : `<div class="cmd-palette-empty">No matches for "${esc(input.value)}"</div>`;
      shown.forEach((c, i) => {
        const row = el("div", `cmd-palette-item ${i === active ? "active" : ""}`);
        row.innerHTML = `<i class="ico" data-ico="${c.icon}"></i><span class="cmd-title">${markMatch(c.title, q)}</span><span class="cmd-sub muted2">${esc(c.sub)}</span>`;
        // IMPORTANT: do not call draw() on mouseenter — that caused an infinite re-render loop
        row.onmouseenter = () => { if (active !== i) setActive(i); };
        row.onclick = () => { closeCommandPalette(); c.run(); };
        resultsEl.appendChild(row);
      });
      mountIcons(resultsEl);
    }
    input.onkeydown = e => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(shown.length - 1, active + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, active - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); const c = shown[active]; if (c) { closeCommandPalette(); c.run(); } }
    };
    input.oninput = () => { active = 0; draw(); };
    draw();
    setTimeout(() => input.focus(), 10);
  }

  function toggleSidebar() {
    const sb = $("#sidebar");
    sb.classList.toggle("collapsed");
    const collapsed = sb.classList.contains("collapsed");
    Store.s.settings.sidebarCollapsed = collapsed;
    $("#sidebar-collapse").textContent = collapsed ? "▶" : "◀";
    // Keep --sidebar-w in sync so fixed, content-centered elements (toasts, quick-bar) stay aligned
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? "56px" : "236px");
    Store.save();
  }

  return {
    $, $$, el, esc, toast, modal, congrats, celebrateMilestone,
    applyTheme, setThemeMode, registerView, showView, refreshAll, refreshChips, refreshGreeting, refreshIdentity,
    initScratchpad, initShortcuts, toggleSidebar, enterZen, exitZen, isZen, updateZen, startTour,
    openCommandPalette, closeCommandPalette,
    toggleMinimalMode, isMinimalMode, iconSVG, mountIcons, toggleQuickBar, initQuickBar,
    get currentView() { return currentView; },
  };
})();
