/* ==========================================================
   tasks.js — kanban, nested subtasks, tags, quick add,
              recurring, icebox, eisenhower, timebox grid
   ========================================================== */
"use strict";

const Tasks = (() => {
  const { $, $$, el, esc, toast, modal } = UI;

  let filter = { text: "", twoMin: false, tag: null };

  /* ---------- CRUD ---------- */
  function syncTaskToTimebox(task) {
    if (!task) return;
    Object.keys(Store.s.timebox).forEach(date => {
      tbBlocksFor(date).forEach(b => {
        if (b.taskId === task.id) {
          b.title = task.title;
          if (task.estimate && !b.dur) b.dur = task.estimate;
        }
      });
    });
  }

  function purgeTaskFromTimebox(taskId) {
    Object.keys(Store.s.timebox).forEach(date => {
      Store.s.timebox[date] = tbBlocksFor(date).filter(b => b.taskId !== taskId);
    });
  }

  function createTask(props) {
    const t = Object.assign({
      id: "t" + (Store.s.taskSeq++),
      title: "Untitled",
      status: "todo",           // todo | doing | done | icebox
      priority: "med",          // low | med | high
      tags: [],
      skill: null,
      due: null,                // yyyy-mm-dd
      estimate: null,           // minutes
      subtasks: [],             // {id, name, done, subtasks:[]}
      createdAt: Date.now(),
      completedAt: null,
      order: Date.now(),
      recur: null,              // {every: n, unit: 'day'|'week'|'month', nth: null|{week:3, dow:2}}
      urgent: null, important: null,
      commitment: null,
    }, props);
    Store.s.tasks.push(t);
    Store.save();
    if (typeof Undo !== "undefined") Undo.record();
    return t;
  }

  const byId = id => Store.s.tasks.find(t => t.id === id);

  function completeTask(id) {
    const t = byId(id);
    if (!t || t.status === "done") return;
    t.status = "done";
    t.completedAt = Date.now();
    syncTaskToTimebox(t);
    if (typeof Undo !== "undefined") Undo.record();
    toast(`✅ Marked done — "${t.title}"`, "good");
    Game.onTaskCompleted(t);
    spawnRecurrence(t);
    render();
  }

  function reopenTask(id) {
    const t = byId(id);
    if (!t) return;
    t.status = "todo"; t.completedAt = null;
    Store.save();
    if (typeof Undo !== "undefined") Undo.record();
    render();
  }

  function deleteTask(id) {
    purgeTaskFromTimebox(id);
    Store.s.tasks = Store.s.tasks.filter(t => t.id !== id);
    Store.save();
    if (typeof Undo !== "undefined") Undo.record();
    render();
  }

  /* ---------- Recurring engine ---------- */
  function spawnRecurrence(t) {
    if (!t.recur) return;
    const next = nextRecurDate(t.recur, t.due ? new Date(t.due + "T12:00") : new Date());
    createTask({
      title: t.title, priority: t.priority, tags: t.tags.slice(), skill: t.skill,
      estimate: t.estimate, recur: t.recur, due: Store.todayStr(next),
      subtasks: t.subtasks.map(s => ({ ...s, done: false })),
    });
    toast(`🔁 Recurring: next "${t.title}" scheduled ${Store.todayStr(next)}`);
  }

  function nextRecurDate(recur, from) {
    const d = new Date(from);
    if (recur.nth) { // e.g. every 3rd Tuesday of next month
      const target = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      let count = 0;
      while (true) {
        if (target.getDay() === recur.nth.dow) { count++; if (count === recur.nth.week) break; }
        target.setDate(target.getDate() + 1);
      }
      return target;
    }
    const n = recur.every || 1;
    if (recur.unit === "day") d.setDate(d.getDate() + n);
    else if (recur.unit === "week") d.setDate(d.getDate() + n * 7);
    else if (recur.unit === "month") d.setMonth(d.getMonth() + n);
    return d;
  }

  /* ---------- Quick add parser (text-to-task) ---------- */
  // /today /tomorrow /high /low /5m /30m #tag @skill /every-day /every-week /ice
  function parseQuickAdd(raw) {
    let title = raw;
    const props = { tags: [], priority: "med" };
    const grab = (re, fn) => { title = title.replace(re, m => { fn(m); return ""; }); };

    grab(/\/today\b/gi, () => props.due = Store.todayStr());
    grab(/\/tomorrow\b/gi, () => props.due = Store.todayStr(new Date(Date.now() + 864e5)));
    grab(/\/high\b/gi, () => props.priority = "high");
    grab(/\/low\b/gi, () => props.priority = "low");
    grab(/\/ice\b/gi, () => props.status = "icebox");
    grab(/\/every-day\b/gi, () => props.recur = { every: 1, unit: "day" });
    grab(/\/every-week\b/gi, () => props.recur = { every: 1, unit: "week" });
    grab(/\/every-month\b/gi, () => props.recur = { every: 1, unit: "month" });
    grab(/\/(\d+)m\b/gi, m => props.estimate = parseInt(m.match(/\d+/)[0], 10));
    grab(/#[\w-]+/g, m => props.tags.push(m.trim()));
    grab(/@(\w+)/g, m => {
      const name = m.slice(1).toLowerCase();
      const sk = Store.s.skills.find(s => s.id === name || s.name.toLowerCase().startsWith(name));
      if (sk) props.skill = sk.id;
    });
    props.title = title.replace(/\s+/g, " ").trim() || "Untitled";
    if (typeof Categorize !== "undefined") Categorize.applyToQuickAddProps(props, raw);
    return props;
  }

  /* ---------- Auto-prioritization ---------- */
  function effectivePriority(t) {
    let score = { high: 3, med: 2, low: 1 }[t.priority];
    if (t.due) {
      const days = (new Date(t.due + "T23:59") - Date.now()) / 864e5;
      if (days < 0) score += 4;
      else if (days < 1) score += 3;
      else if (days < 3) score += 1.5;
    }
    return score;
  }

  function sortedTasks(status) {
    return Store.s.tasks
      .filter(t => t.status === status)
      .filter(t => !filter.text || t.title.toLowerCase().includes(filter.text))
      .filter(t => !filter.twoMin || (t.estimate !== null && t.estimate <= 2))
      .filter(t => !filter.tag || t.tags.includes(filter.tag))
      .sort((a, b) => (effectivePriority(b) - effectivePriority(a)) || (a.order - b.order));
  }

  /* ---------- "Now" task ---------- */
  function nowTask() {
    const doing = sortedTasks("doing");
    if (doing.length) return doing[0];
    const todo = sortedTasks("todo");
    return todo[0] || null;
  }

  /* ---------- Task age ---------- */
  function ageClass(t) {
    if (t.status === "done") return "";
    const days = (Date.now() - t.createdAt) / 864e5;
    if (days > 7) return "age-ancient";
    if (days > 3) return "age-old";
    return "";
  }

  function subProgress(t) {
    const flat = [];
    (function walk(list) { list.forEach(s => { flat.push(s); walk(s.subtasks || []); }); })(t.subtasks || []);
    if (!flat.length) return null;
    return { done: flat.filter(s => s.done).length, total: flat.length };
  }

  /* ---------- Render: task card ---------- */
  function taskCardEl(t, compact = false) {
    const card = el("div", `task-card ${ageClass(t)}`);
    card.draggable = true;
    card.dataset.id = t.id;

    const dueTag = t.due ? (() => {
      const days = (new Date(t.due + "T23:59") - Date.now()) / 864e5;
      const cls = days < 1 ? "due-soon" : "";
      const label = days < 0 ? "⚠ overdue" : `📅 ${t.due.slice(5)}`;
      return `<span class="tag ${cls}">${label}</span>`;
    })() : "";

    const skill = t.skill ? Store.s.skills.find(s => s.id === t.skill) : null;
    const prog = subProgress(t);

    card.innerHTML = `
      <div class="t-title">${esc(t.title)} ${t.recur ? "🔁" : ""}</div>
      <div class="t-meta">
        <span class="tag pri-${t.priority}">${t.priority}</span>
        ${t.estimate ? `<span class="tag">⏱ ${t.estimate}m</span>` : ""}
        ${dueTag}
        ${skill ? `<span class="tag">${skill.icon} ${esc(skill.name)}</span>` : ""}
        ${t.tags.map(tg => `<span class="tag" data-tag="${esc(tg)}">${esc(tg)}</span>`).join("")}
      </div>
      ${prog ? `<div class="t-progress"><i style="width:${(prog.done / prog.total * 100)}%"></i></div>` : ""}`;

    if (!compact) {
      const actions = el("div", "t-actions");
      const mk = (label, title, fn) => {
        const b = el("button", "icon-btn", label); b.title = title;
        b.onclick = e => { e.stopPropagation(); fn(); };
        actions.appendChild(b);
      };
      if (t.status !== "done") mk("✅", "Complete", () => Psych.gateComplete(t));
      else mk("↩️", "Reopen", () => reopenTask(t.id));
      mk("▶", "Focus on this now", () => { setNow(t.id); });
      mk("✏️", "Edit", () => editModal(t));
      mk("🧊", t.status === "icebox" ? "Thaw" : "Icebox", () => {
        t.status = t.status === "icebox" ? "todo" : "icebox"; Store.save(); render();
      });
      mk("😩", "Why am I avoiding this?", () => Psych.procrastinationLog(t));
      mk("🗑️", "Delete", () => deleteTask(t.id));
      card.appendChild(actions);
      if (t.subtasks.length) card.appendChild(subtaskListEl(t, t.subtasks, 0));
    }

    card.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/task", t.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    return card;
  }

  /* nested collapsible subtasks (infinite depth) */
  function subtaskListEl(task, subs, depth) {
    const wrap = el("div", "subtask-list");
    subs.forEach(s => {
      const row = el("div", `subtask ${s.done ? "done" : ""}`);
      const toggle = el("button", "st-toggle", (s.subtasks && s.subtasks.length) ? (s.collapsed ? "▸" : "▾") : "·");
      toggle.onclick = e => { e.stopPropagation(); s.collapsed = !s.collapsed; Store.save(); render(); };
      const cb = el("input"); cb.type = "checkbox"; cb.checked = s.done;
      cb.onclick = e => {
        e.stopPropagation();
        s.done = cb.checked;
        if (s.done) { AudioFX.play("tick"); Game.addXP(8, task.skill, { silent: true }); UI.refreshChips(); }
        Store.save(); render();
      };
      const name = el("span", "st-name", esc(s.name));
      const add = el("button", "st-toggle", "+"); add.title = "Add nested sub-task";
      add.onclick = e => {
        e.stopPropagation();
        const nm = prompt("Nested sub-task:");
        if (nm) { (s.subtasks = s.subtasks || []).push({ id: Date.now(), name: nm, done: false, subtasks: [] }); Store.save(); render(); }
      };
      row.append(toggle, cb, name, add);
      wrap.appendChild(row);
      if (s.subtasks && s.subtasks.length && !s.collapsed) wrap.appendChild(subtaskListEl(task, s.subtasks, depth + 1));
    });
    return wrap;
  }

  function setNow(id, opts = {}) {
    const t = byId(id);
    if (!t) return;
    Store.s.tasks.forEach(x => { if (x.status === "doing") x.status = "todo"; });
    t.status = "doing";
    Store.save();
    if (!opts.quiet) {
      UI.showView("dashboard");
      toast(`🎯 Now working on: ${t.title}`);
    }
  }

  /* ---------- Edit modal ---------- */
  function editModal(t) {
    const skills = Store.s.skills.map(s => `<option value="${s.id}" ${t.skill === s.id ? "selected" : ""}>${s.icon} ${esc(s.name)}</option>`).join("");
    modal("✏️ Edit Task", `
      <label class="field"><span>Title</span><input type="text" id="et-title" value="${esc(t.title)}"></label>
      <div class="grid-2">
        <label class="field"><span>Priority</span>
          <select id="et-pri">
            <option value="low" ${t.priority === "low" ? "selected" : ""}>Low</option>
            <option value="med" ${t.priority === "med" ? "selected" : ""}>Medium</option>
            <option value="high" ${t.priority === "high" ? "selected" : ""}>High</option>
          </select></label>
        <label class="field"><span>Skill</span>
          <select id="et-skill"><option value="">(none)</option>${skills}</select></label>
        <label class="field"><span>Due date</span><input type="date" id="et-due" value="${t.due || ""}"></label>
        <label class="field"><span>Estimate (min)</span><input type="number" id="et-est" value="${t.estimate ?? ""}"></label>
      </div>
      <label class="field"><span>Tags (space-separated, e.g. #quick #at-computer)</span>
        <input type="text" id="et-tags" value="${esc(t.tags.join(" "))}"></label>
      <label class="field"><span>Recurrence</span>
        <select id="et-recur">
          <option value="">None</option>
          <option value="d1" ${t.recur?.unit === "day" && t.recur?.every === 1 ? "selected" : ""}>Every day</option>
          <option value="d2" ${t.recur?.unit === "day" && t.recur?.every === 2 ? "selected" : ""}>Every 2 days</option>
          <option value="w1" ${t.recur?.unit === "week" && !t.recur?.nth ? "selected" : ""}>Every week</option>
          <option value="m1" ${t.recur?.unit === "month" && !t.recur?.nth ? "selected" : ""}>Every month</option>
          <option value="nth32" ${t.recur?.nth?.week === 3 && t.recur?.nth?.dow === 2 ? "selected" : ""}>Every 3rd Tuesday</option>
          <option value="nth11" ${t.recur?.nth?.week === 1 && t.recur?.nth?.dow === 1 ? "selected" : ""}>Every 1st Monday</option>
        </select></label>
      <label class="field"><span>Add sub-task</span><input type="text" id="et-sub" placeholder="Type and press Enter…"></label>`,
      [
        { label: "Cancel" },
        { label: "Save", cls: "primary", onClick: m => {
          t.title = m.querySelector("#et-title").value.trim() || t.title;
          t.priority = m.querySelector("#et-pri").value;
          t.skill = m.querySelector("#et-skill").value || null;
          t.due = m.querySelector("#et-due").value || null;
          t.estimate = m.querySelector("#et-est").value ? parseInt(m.querySelector("#et-est").value, 10) : null;
          t.tags = m.querySelector("#et-tags").value.split(/\s+/).filter(Boolean).map(x => x.startsWith("#") ? x : "#" + x);
          const rv = m.querySelector("#et-recur").value;
          t.recur = rv === "" ? null :
            rv === "d1" ? { every: 1, unit: "day" } :
            rv === "d2" ? { every: 2, unit: "day" } :
            rv === "w1" ? { every: 1, unit: "week" } :
            rv === "m1" ? { every: 1, unit: "month" } :
            rv === "nth32" ? { nth: { week: 3, dow: 2 } } :
            rv === "nth11" ? { nth: { week: 1, dow: 1 } } : null;
          syncTaskToTimebox(t);
          Store.save(); render();
        }},
      ]);
    setTimeout(() => {
      const sub = document.querySelector("#et-sub");
      if (sub) sub.addEventListener("keydown", e => {
        if (e.key === "Enter" && sub.value.trim()) {
          t.subtasks.push({ id: Date.now(), name: sub.value.trim(), done: false, subtasks: [] });
          sub.value = ""; Store.save(); toast("Sub-task added");
        }
      });
    }, 50);
  }

  /* ---------- Eisenhower ---------- */
  function eisenQuad(t) {
    const urgent = t.urgent ?? (t.due && (new Date(t.due + "T23:59") - Date.now()) / 864e5 < 2);
    const important = t.important ?? (t.priority === "high");
    if (urgent && important) return "q1";
    if (!urgent && important) return "q2";
    if (urgent && !important) return "q3";
    return "q4";
  }

  /* ---------- Views ---------- */
  function render() {
    if (UI.currentView === "tasks") renderTasksView();
    if (UI.currentView === "dashboard") App.renderDashboard();
    if (UI.currentView === "timebox") renderTimeboxView();
  }

  let taskViewMode = "board"; // board | list
  let listFilter = { type: "all", tag: null };
  let completedOpen = false;

  let tbViewDate = null;   // yyyy-mm-dd shown in the Timebox day grid; null = today
  let tbViewMode = "day";  // day | month — the Timebox zoom level
  let tbMonthCursor = null; // yyyy-mm for month view

  function renderTasksView() {
    const v = $("#view-tasks");
    v.innerHTML = `
      <div class="notes-mode-tabs">
        <button class="mode-btn ${taskViewMode === "board" ? "active" : ""}" data-mode="board">Board</button>
        <button class="mode-btn ${taskViewMode === "list" ? "active" : ""}" data-mode="list">List</button>
      </div>
      <div id="task-mode-body"></div>`;
    v.querySelectorAll(".notes-mode-tabs .mode-btn").forEach(b => b.onclick = () => { taskViewMode = b.dataset.mode; renderTasksView(); });
    const body = $("#task-mode-body");
    if (taskViewMode === "list") renderListView(body);
    else renderBoardMode(body);
  }

  function renderBoardMode(v) {
    const allTags = [...new Set(Store.s.tasks.flatMap(t => t.tags))];
    v.innerHTML = `
      <div class="quickadd-row">
        <input type="text" id="quick-add-input"
          placeholder='Quick add — try: "Finish essay /today /high /45m #school @coding"'>
        <button class="btn primary" id="quick-add-btn">＋ Add</button>
      </div>
      <div class="task-toolbar">
        <input type="text" id="task-search" placeholder="🔍 filter…" style="max-width:170px" value="${esc(filter.text)}">
        <button class="btn sm ${filter.twoMin ? "primary" : ""}" id="two-min-btn" title="Show only tasks under 2 minutes">⚡ 2-min rule</button>
        <select id="tag-filter" style="max-width:160px">
          <option value="">All tags</option>
          ${allTags.map(t => `<option ${filter.tag === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
        </select>
        <button class="btn sm" id="matrix-btn">Eisenhower Matrix</button>
        <button class="btn sm" id="icebox-btn">🧊 Icebox (${Store.s.tasks.filter(t => t.status === "icebox").length})</button>
        <span class="muted" style="font-size:.72rem">drag cards between columns · drag to reorder</span>
      </div>
      <div class="kanban">
        <div class="kan-col" data-status="todo"><h3>📋 To Do <span id="cnt-todo"></span></h3><div class="kan-body"></div></div>
        <div class="kan-col" data-status="doing"><h3>🚧 Doing <span id="cnt-doing"></span></h3><div class="kan-body"></div></div>
        <div class="kan-col" data-status="done"><h3>✅ Done <span id="cnt-done"></span></h3><div class="kan-body"></div></div>
      </div>
      <div id="matrix-wrap" class="hidden" style="margin-top:16px"></div>
      <div id="icebox-wrap" class="hidden" style="margin-top:16px"></div>`;

    ["todo", "doing", "done"].forEach(status => {
      const col = v.querySelector(`.kan-col[data-status="${status}"] .kan-body`);
      const list = sortedTasks(status);
      v.querySelector(`#cnt-${status}`).textContent = list.length;
      list.forEach(t => col.appendChild(taskCardEl(t)));
    });

    // dnd between columns + manual reorder
    $$(".kan-col").forEach(col => {
      col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
      col.addEventListener("drop", e => {
        e.preventDefault(); col.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/task");
        const t = byId(id);
        if (!t) return;
        const newStatus = col.dataset.status;
        // manual reorder: drop position relative to sibling cards
        const after = e.target.closest(".task-card");
        if (after && after.dataset.id !== id) {
          const ref = byId(after.dataset.id);
          t.order = ref.order - 0.5;
        } else {
          t.order = Date.now();
        }
        if (newStatus === "done" && t.status !== "done") { Psych.gateComplete(t); return; }
        if (newStatus === "doing") Store.s.tasks.forEach(x => { if (x.id !== id && x.status === "doing") x.status = "todo"; });
        t.status = newStatus;
        Store.save(); render();
      });
    });

    $("#quick-add-btn").onclick = quickAdd;
    $("#quick-add-input").addEventListener("keydown", e => { if (e.key === "Enter") quickAdd(); });
    $("#task-search").oninput = e => { filter.text = e.target.value.toLowerCase(); softRerenderColumns(); };
    $("#two-min-btn").onclick = () => { filter.twoMin = !filter.twoMin; renderTasksView(); };
    $("#tag-filter").onchange = e => { filter.tag = e.target.value || null; renderTasksView(); };
    $("#matrix-btn").onclick = () => { const w = $("#matrix-wrap"); w.classList.toggle("hidden"); if (!w.classList.contains("hidden")) renderMatrix(w); };
    $("#icebox-btn").onclick = () => { const w = $("#icebox-wrap"); w.classList.toggle("hidden"); if (!w.classList.contains("hidden")) renderIcebox(w); };
  }

  /* ---------- List view — a dense, Todoist-style flat checklist with a smart-lists rail ---------- */
  function taskMatchesListFilterFor(t, f) {
    if (f.type === "tag") return t.tags.includes(f.tag);
    if (f.type === "today") return !!t.due && t.due <= Store.todayStr();
    if (f.type === "week") {
      if (!t.due) return false;
      const days = (new Date(t.due + "T23:59") - Date.now()) / 864e5;
      return days >= 0 && days <= 7;
    }
    if (f.type === "nodate") return !t.due;
    return true;
  }
  const taskMatchesListFilter = t => taskMatchesListFilterFor(t, listFilter);

  function renderListView(v) {
    const allTags = [...new Set(Store.s.tasks.flatMap(t => t.tags))];

    const railItem = (label, icoName, type, tag) => {
      const active = listFilter.type === type && (type !== "tag" || listFilter.tag === tag);
      const cnt = Store.s.tasks.filter(t => t.status !== "done" && taskMatchesListFilterFor(t, { type, tag })).length;
      return `<button class="tl-rail-item ${active ? "active" : ""}" data-type="${type}" data-tag="${esc(tag || "")}">
        <i class="ico" data-ico="${icoName}"></i><span>${esc(label)}</span><span class="tl-count">${cnt}</span>
      </button>`;
    };

    v.innerHTML = `
      <div class="tl-layout">
        <div class="tl-rail">
          <div class="tl-rail-label">Views</div>
          ${railItem("All Tasks", "check", "all")}
          ${railItem("Today", "calendar", "today")}
          ${railItem("Next 7 Days", "calendar", "week")}
          ${railItem("No Due Date", "file", "nodate")}
          ${allTags.length ? `<div class="tl-rail-label">Lists</div>${allTags.map(tg => railItem(tg.replace(/^#/, ""), "bars", "tag", tg)).join("")}` : ""}
        </div>
        <div class="tl-main">
          <div class="card">
            <div class="quickadd-row" style="margin-bottom:14px">
              <input type="text" id="quick-add-input"
                placeholder='Add a task — try: "Finish essay /today /high /45m #school @coding"'>
              <button class="btn primary" id="quick-add-btn">＋ Add</button>
            </div>
            <div id="tl-rows"></div>
          </div>
        </div>
      </div>`;
    UI.mountIcons(v);

    v.querySelectorAll(".tl-rail-item").forEach(b => {
      b.onclick = () => { listFilter = { type: b.dataset.type, tag: b.dataset.tag || null }; renderListView(v); };
    });
    $("#quick-add-btn").onclick = quickAdd;
    $("#quick-add-input").addEventListener("keydown", e => { if (e.key === "Enter") quickAdd(); });

    const rows = $("#tl-rows");
    const matching = Store.s.tasks.filter(t => taskMatchesListFilter(t)).sort((a, b) => (effectivePriority(b) - effectivePriority(a)) || (a.order - b.order));
    const todo = matching.filter(t => t.status === "todo");
    const doing = matching.filter(t => t.status === "doing");
    const done = matching.filter(t => t.status === "done");

    if (!matching.length) { rows.innerHTML = `<div class="tl-empty">Nothing here — add a task above.</div>`; return; }

    const rowEl = t => {
      const r = el("div", `tl-row ${t.status === "done" ? "done" : ""}`);
      r.innerHTML = `
        <button class="tl-checkbox ${t.status === "done" ? "checked" : ""}">${t.status === "done" ? '<i class="ico" data-ico="check"></i>' : ""}</button>
        <span class="tl-row-title">${esc(t.title)}</span>
        <div class="tl-row-meta">
          ${t.priority === "high" ? `<span class="t-pri-dot" style="background:var(--bad)"></span>` : ""}
          ${t.due ? `<span class="muted" style="font-size:.7rem">${esc(t.due.slice(5))}</span>` : ""}
          ${t.tags.map(tg => `<span class="tag" style="font-size:.66rem">${esc(tg)}</span>`).join("")}
        </div>`;
      UI.mountIcons(r);
      r.querySelector(".tl-checkbox").onclick = e => {
        e.stopPropagation();
        if (t.status === "done") reopenTask(t.id);
        else Psych.gateComplete(t);
      };
      r.onclick = () => editModal(t);
      return r;
    };

    if (doing.length) {
      rows.appendChild(el("div", "tl-group-head", `In Progress <span class="tl-count">${doing.length}</span>`));
      doing.forEach(t => rows.appendChild(rowEl(t)));
    }
    rows.appendChild(el("div", "tl-group-head", `To Do <span class="tl-count">${todo.length}</span>`));
    if (todo.length) todo.forEach(t => rows.appendChild(rowEl(t)));
    else rows.appendChild(el("div", "tl-empty", "Clear — nice work."));

    if (done.length) {
      const toggle = el("button", `tl-completed-toggle ${completedOpen ? "open" : ""}`,
        `<i class="ico" data-ico="chevron"></i> Completed <span class="tl-count">${done.length}</span>`);
      UI.mountIcons(toggle);
      toggle.onclick = () => { completedOpen = !completedOpen; renderListView(v); };
      rows.appendChild(toggle);
      if (completedOpen) done.forEach(t => rows.appendChild(rowEl(t)));
    }
  }

  function softRerenderColumns() {
    ["todo", "doing", "done"].forEach(status => {
      const col = document.querySelector(`.kan-col[data-status="${status}"] .kan-body`);
      if (!col) return;
      col.innerHTML = "";
      sortedTasks(status).forEach(t => col.appendChild(taskCardEl(t)));
    });
  }

  function quickAdd() {
    const inp = $("#quick-add-input");
    if (!inp.value.trim()) return;
    const props = parseQuickAdd(inp.value);
    const t = createTask(props);
    Automation.applyTemplates(t);
    Store.save();
    AudioFX.play("tick");
    inp.value = "";
    render();
  }

  const DEFAULT_EISEN_TITLES = {
    q1: "Urgent & Important — Do Now",
    q2: "Important, Not Urgent — Schedule",
    q3: "Urgent, Not Important — Batch",
    q4: "Neither — Question It",
  };

  function renderMatrix(wrap) {
    if (!Store.s.settings.eisenTitles) Store.s.settings.eisenTitles = { ...DEFAULT_EISEN_TITLES };
    const titles = Store.s.settings.eisenTitles;
    const active = Store.s.tasks.filter(t => t.status === "todo" || t.status === "doing");
    const quads = { q1: [], q2: [], q3: [], q4: [] };
    active.forEach(t => quads[eisenQuad(t)].push(t));
    const quadHTML = q => `
      <div class="quad ${q}">
        <h4><span class="quad-title" data-q="${q}">${esc(titles[q] || DEFAULT_EISEN_TITLES[q])}</span><button class="icon-btn quad-edit" data-q="${q}" title="Rename"><i class="ico" data-ico="edit"></i></button></h4>
        ${quads[q].map(t => `<div class="mini-task">${esc(t.title)}</div>`).join("") || '<span class="muted">Clear</span>'}
      </div>`;
    wrap.innerHTML = `<div class="card"><h2>Eisenhower Matrix</h2>
      <div class="card-sub">Auto-sorted from priority + deadlines. Click the pencil on any quadrant to rename it.</div>
      <div class="matrix">
        ${quadHTML("q1")}${quadHTML("q2")}${quadHTML("q3")}${quadHTML("q4")}
      </div></div>`;
    UI.mountIcons(wrap);
    wrap.querySelectorAll(".quad-edit").forEach(btn => {
      btn.onclick = () => {
        const q = btn.dataset.q;
        const span = wrap.querySelector(`.quad-title[data-q="${q}"]`);
        const input = document.createElement("input");
        input.type = "text"; input.value = titles[q] || DEFAULT_EISEN_TITLES[q];
        input.style.font = "inherit"; input.style.padding = "2px 6px";
        span.replaceWith(input);
        input.focus(); input.select();
        const commit = () => {
          titles[q] = input.value.trim() || DEFAULT_EISEN_TITLES[q];
          Store.save(); renderMatrix(wrap);
        };
        input.onblur = commit;
        input.onkeydown = e => { if (e.key === "Enter") commit(); if (e.key === "Escape") renderMatrix(wrap); };
      };
    });
  }

  function renderIcebox(wrap) {
    const iced = Store.s.tasks.filter(t => t.status === "icebox");
    wrap.innerHTML = `<div class="card"><h2>🧊 Icebox</h2>
      <div class="card-sub">Ideas on ice. They don't clutter your board, but they're never lost.</div>
      <div class="icebox-list"></div></div>`;
    const list = wrap.querySelector(".icebox-list");
    if (!iced.length) list.innerHTML = '<span class="muted">Nothing frozen. Add tasks with <kbd>/ice</kbd>.</span>';
    iced.forEach(t => list.appendChild(taskCardEl(t)));
  }

  /* ---------- Timebox — a real minute-precision calendar, Linear-styled ----------
     Store.s.timebox[date] is an array of blocks: {id, taskId|null, title, color, start, dur}
     where start/dur are minutes-from-midnight. Blocks can be drawn fresh by dragging on empty
     grid space (exact-minute start/duration, no fixed slots), dragged to move, dragged from the
     bottom edge to resize, or dropped in from the task pool. Older saves stored timebox[date] as
     {hour->[taskIds]} / {"h:m"->[ids]} — migrateTimeboxDay folds that into blocks transparently. */
  const TB_COLORS = [
    { id: "gray", hex: "#8a8f98" }, { id: "red", hex: "#e5484d" }, { id: "orange", hex: "#f5a524" },
    { id: "yellow", hex: "#e8c547" }, { id: "green", hex: "#46a758" }, { id: "blue", hex: "#5e6ad2" },
    { id: "purple", hex: "#8e6ff0" },
  ];
  const TB_HOUR_H = 56; // px per hour on the day grid

  function tbDate() { return tbViewDate || Store.todayStr(); }

  function migrateTimeboxDay(date) {
    const raw = Store.s.timebox[date];
    if (Array.isArray(raw)) return raw;
    const blocks = [];
    if (raw && typeof raw === "object") {
      Object.entries(raw).forEach(([key, ids]) => {
        let start, dur;
        if (key.includes(":")) { const [h, m] = key.split(":").map(Number); start = h * 60 + m; dur = 15; }
        else { start = Number(key) * 60; dur = 60; }
        (ids || []).forEach(id => {
          const t = byId(id);
          blocks.push({ id: "tb" + Date.now() + Math.floor(Math.random() * 10000), taskId: id, title: t ? t.title : "Task", color: null, start, dur });
        });
      });
    }
    Store.s.timebox[date] = blocks;
    return blocks;
  }
  function tbBlocksFor(date) { return migrateTimeboxDay(date); }
  function tbCount(date) {
    const raw = Store.s.timebox[date];
    if (!raw) return 0;
    if (Array.isArray(raw)) return raw.length;
    return Object.values(raw).reduce((a, arr) => a + (arr ? arr.length : 0), 0);
  }
  function tbHasTask(date, taskId) { return tbBlocksFor(date).some(b => b.taskId === taskId); }
  function tbAddBlock(date, spec) {
    const blocks = tbBlocksFor(date);
    const b = {
      id: "tb" + Date.now() + Math.floor(Math.random() * 10000),
      taskId: spec.taskId || null, title: spec.title || "Untitled", color: spec.color || null,
      start: Math.max(0, Math.min(1439, Math.round(spec.start))), dur: Math.max(5, Math.round(spec.dur || 30)),
    };
    blocks.push(b);
    Store.save();
    if (typeof Undo !== "undefined") Undo.record();
    return b;
  }

  // Sweep-line layout: groups transitively-overlapping blocks into clusters, then greedily
  // assigns each a column within its cluster — concurrent blocks sit side-by-side instead of
  // stacking on each other; non-overlapping blocks each still get the full row width.
  function tbLayout(blocks) {
    const items = blocks.map(b => ({ b, start: b.start, end: b.start + Math.max(b.dur, 5) })).sort((a, b) => a.start - b.start || a.end - b.end);
    const out = [];
    let cluster = [], clusterEnd = -Infinity;
    const flush = () => {
      if (!cluster.length) return;
      const colEnds = [];
      cluster.forEach(it => {
        let col = colEnds.findIndex(e => e <= it.start);
        if (col === -1) { col = colEnds.length; colEnds.push(it.end); } else colEnds[col] = it.end;
        it.col = col;
      });
      cluster.forEach(it => out.push({ b: it.b, col: it.col, totalCols: colEnds.length }));
      cluster = []; clusterEnd = -Infinity;
    };
    items.forEach(it => {
      if (cluster.length && it.start >= clusterEnd) flush();
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.end);
    });
    flush();
    return out;
  }

  function tbMinToLabel(min) {
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    const h = Math.floor(min / 60), m = min % 60;
    return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
  }

  /* Block editor modal — rename, exact start/duration, color, and optional task link (keeps
     it synced with the Tasks list: renaming a linked block renames the task too). */
  function openBlockEditor(date, block, isNew) {
    const blocks = tbBlocksFor(date);
    const linkable = Store.s.tasks.filter(t => (t.status === "todo" || t.status === "doing") && (!tbHasTask(date, t.id) || t.id === block.taskId));
    modal(isNew ? "New timebox block" : "Edit block", `
      <label class="field"><span>Name</span><input type="text" id="tbe-title" value="${esc(block.title)}" placeholder="What's happening?"></label>
      <label class="field"><span>Starts</span><input type="time" id="tbe-start" value="${String(Math.floor(block.start / 60)).padStart(2, "0")}:${String(block.start % 60).padStart(2, "0")}"></label>
      <label class="field"><span>Duration (minutes)</span><input type="number" id="tbe-dur" min="5" step="1" value="${block.dur}"></label>
      <label class="field"><span>Link to task <span class="muted2">(optional — keeps it synced with Tasks)</span></span>
        <select id="tbe-task">
          <option value="">— none, just a calendar block —</option>
          ${linkable.map(t => `<option value="${t.id}" ${t.id === block.taskId ? "selected" : ""}>${esc(t.title)}</option>`).join("")}
        </select>
      </label>
      <div class="field"><span>Color</span>
        <div class="tbe-color-row">
          <button class="tbe-color-swatch ${!block.color ? "sel" : ""}" data-color="" title="No color"><i class="ico" data-ico="x"></i></button>
          ${TB_COLORS.map(c => `<button class="tbe-color-swatch ${block.color === c.id ? "sel" : ""}" data-color="${c.id}" style="background:${c.hex}" title="${c.id}"></button>`).join("")}
        </div>
      </div>`,
      [
        { label: "Delete", cls: "danger", onClick: () => {
          if (typeof Undo !== "undefined") Undo.record();
          Store.s.timebox[date] = tbBlocksFor(date).filter(b => b.id !== block.id);
          Store.save(); renderTimeboxView();
        } },
        { label: "Cancel", onClick: () => {
          if (isNew) {
            if (typeof Undo !== "undefined") Undo.record();
            Store.s.timebox[date] = tbBlocksFor(date).filter(b => b.id !== block.id);
            Store.save(); renderTimeboxView();
          }
        } },
        { label: "Save", cls: "primary", onClick: m => {
          block.title = m.querySelector("#tbe-title").value.trim() || "Untitled";
          const [hh, mm] = m.querySelector("#tbe-start").value.split(":").map(Number);
          if (!isNaN(hh)) block.start = Math.max(0, Math.min(1439, hh * 60 + (mm || 0)));
          block.dur = Math.max(5, parseInt(m.querySelector("#tbe-dur").value, 10) || 30);
          block.taskId = m.querySelector("#tbe-task").value || null;
          if (block.taskId) { const t = byId(block.taskId); if (t) t.title = block.title; }
          if (typeof Undo !== "undefined") Undo.record();
          Store.save(); renderTimeboxView();
        } },
      ], { sticky: true });
    setTimeout(() => {
      document.querySelectorAll(".tbe-color-swatch").forEach(sw => sw.onclick = () => {
        block.color = sw.dataset.color || null;
        document.querySelectorAll(".tbe-color-swatch").forEach(s2 => s2.classList.toggle("sel", s2 === sw));
      });
    }, 20);
  }

  function tbQuickAdd(dateStr) {
    const input = $("#tb-quick-add");
    const title = input.value.trim();
    if (!title) return;
    createTask({ title, due: dateStr });
    renderTimeboxView();
    UI.toast("Added to the pool — drag it onto the calendar, or click-drag to draw a block");
  }

  // Global keyboard handler for Timebox — Esc month→day, ↓ day→month, ↑ month→day
  let tbKeyHandler = null;
  function bindTbKeyHandler() {
    if (tbKeyHandler) document.removeEventListener("keydown", tbKeyHandler);
    tbKeyHandler = e => {
      const view = document.getElementById("view-timebox");
      if (!view || !view.classList.contains("active")) return;
      if (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
      if (document.querySelector(".note-modal-back") || document.querySelector("#modal-root")?.children.length) return;

      if (e.key === "ArrowDown" && tbViewMode === "day") {
        e.preventDefault();
        tbViewMode = "month";
        tbMonthCursor = tbDate().slice(0, 7);
        renderTimeboxView();
        return;
      }
      if (e.key === "ArrowUp" && tbViewMode === "month") {
        e.preventDefault();
        tbViewMode = "day";
        renderTimeboxView();
        return;
      }
      if (e.key === "Escape") {
        if (tbViewMode === "month") { tbViewMode = "day"; renderTimeboxView(); }
      }
    };
    document.addEventListener("keydown", tbKeyHandler);
  }

  function renderTimeboxView() {
    bindTbKeyHandler();
    const v = $("#view-timebox");
    if (tbViewMode === "month") { renderTimeboxMonth(v); return; }

    const today = Store.todayStr();
    const viewDate = tbDate();
    const blocks = tbBlocksFor(viewDate);
    const unboxed = Store.s.tasks.filter(t => (t.status === "todo" || t.status === "doing") && !tbHasTask(viewDate, t.id));

    const dateObj = new Date(viewDate + "T12:00:00");
    const dateLabel = dateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    const ydayStr = Store.todayStr(new Date(dateObj.getTime() - 864e5));
    const tmrwStr = Store.todayStr(new Date(dateObj.getTime() + 864e5));

    v.innerHTML = `
      <div class="card tb-fade-in"><h2>Time Boxing
          <button class="icon-btn" id="tb-prev-day" title="Previous day"><i class="ico" data-ico="chevron" style="transform:rotate(180deg);display:inline-block"></i></button>
          <span class="tb-date-label">${dateLabel}${viewDate === today ? " · Today" : ""}</span>
          <button class="icon-btn" id="tb-next-day" title="Next day"><i class="ico" data-ico="chevron"></i></button>
          <span class="spacer"></span>
          <button class="btn sm" id="tb-copy-yday" title="Rebuild yesterday's schedule for this day">Copy yesterday</button>
          <button class="btn sm" id="tb-copy-tomorrow" title="Copy this day's schedule forward one day">Copy → tomorrow</button>
          ${blocks.length ? `<button class="icon-btn" id="tb-clear-day" title="Clear this day's schedule"><i class="ico" data-ico="x"></i></button>` : ""}
          ${viewDate === today ? `
            <button class="btn sm" id="tb-save-routine" title="Save today's layout as your repeatable daily routine">Save as routine</button>
            ${Store.s.routine ? `<button class="icon-btn" id="tb-delete-routine" title="Delete saved routine"><i class="ico" data-ico="x"></i></button>` : ""}
            <button class="btn sm primary" id="tb-apply-routine" title="Apply your saved routine — recreates tasks & schedule, no retyping">Apply routine${Store.s.routine ? "" : " (none saved)"}</button>
          ` : ""}
        </h2>
        <div class="card-sub">Drag a task from the pool onto the calendar, or click-drag directly on the grid to draw a block at the exact minute you want. Drag a block to move it, drag its bottom edge to resize, click it to rename, time, color, or link it to a task. <b>↓</b> zooms out to the month calendar; scroll past the bottom or Esc also opens month view.</div>
        <div class="quickadd-row" style="margin-bottom:12px">
          <input type="text" id="tb-quick-add" placeholder="Add a task for ${viewDate === today ? "today" : dateLabel}…">
          <button class="btn primary" id="tb-quick-add-btn">＋ Add</button>
        </div>
        <div class="tb-pool" id="tb-pool">${unboxed.length ? "" : '<span class="muted">All active tasks are boxed.</span>'}</div>
        <div class="tb-cal-wrap" id="tb-cal-scroll">
          <div class="tb-cal-inner">
            <div class="tb-cal-hourcol" id="tb-cal-hourcol"></div>
            <div class="tb-cal-grid" id="tb-cal-grid"></div>
          </div>
        </div>
      </div>`;
    UI.mountIcons(v);

    $("#tb-prev-day").onclick = () => { tbViewDate = ydayStr; renderTimeboxView(); };
    $("#tb-next-day").onclick = () => { tbViewDate = tmrwStr; renderTimeboxView(); };
    $("#tb-copy-yday").onclick = () => copyScheduleBetween(ydayStr, viewDate, false);
    $("#tb-copy-tomorrow").onclick = () => copyScheduleBetween(viewDate, tmrwStr, true);
    if ($("#tb-clear-day")) $("#tb-clear-day").onclick = () => {
      if (typeof Undo !== "undefined") Undo.record();
      Store.s.timebox[viewDate] = [];
      Store.save(); renderTimeboxView();
      UI.toast("Day's schedule cleared");
    };
    if (viewDate === today) {
      $("#tb-save-routine").onclick = saveRoutine;
      $("#tb-apply-routine").onclick = applyRoutine;
      if (Store.s.routine) $("#tb-delete-routine").onclick = deleteRoutine;
    }
    $("#tb-quick-add-btn").onclick = () => tbQuickAdd(viewDate);
    $("#tb-quick-add").addEventListener("keydown", e => { if (e.key === "Enter") tbQuickAdd(viewDate); });

    const pool = $("#tb-pool");
    unboxed.forEach(t => pool.appendChild(tbChip(t)));

    const hourCol = $("#tb-cal-hourcol");
    const grid = $("#tb-cal-grid");
    const scrollWrap = $("#tb-cal-scroll");
    grid.style.height = hourCol.style.height = (24 * TB_HOUR_H) + "px";
    for (let h = 0; h <= 23; h++) {
      const lbl = el("div", "tb-cal-hourlabel", h === 0 ? "12am" : h === 12 ? "12pm" : `${h % 12}${h < 12 ? "am" : "pm"}`);
      lbl.style.top = (h * TB_HOUR_H) + "px";
      hourCol.appendChild(lbl);
      const line = el("div", "tb-cal-hourline");
      line.style.top = (h * TB_HOUR_H) + "px";
      grid.appendChild(line);
    }
    if (viewDate === today) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const nowLine = el("div", "tb-cal-nowline");
      nowLine.style.top = (nowMin / 60 * TB_HOUR_H) + "px";
      grid.appendChild(nowLine);
      setTimeout(() => { scrollWrap.scrollTop = Math.max(0, nowMin / 60 * TB_HOUR_H - 160); }, 0);
    } else {
      setTimeout(() => { scrollWrap.scrollTop = Math.max(0, 8 * TB_HOUR_H - 40); }, 0);
    }

    function minFromClientY(clientY) {
      const r = grid.getBoundingClientRect();
      return Math.max(0, Math.min(1439, Math.round((clientY - r.top) / TB_HOUR_H * 60)));
    }

    tbLayout(blocks).forEach(({ b, col, totalCols }) => grid.appendChild(tbBlockEl(b, col, totalCols, viewDate, minFromClientY)));

    // Click-drag anywhere on empty grid space draws a brand-new block spanning the exact
    // minute range dragged — no fixed slots, no snapping to 15s.
    grid.addEventListener("mousedown", e => {
      if (e.target.closest(".tb-block") || e.button !== 0) return;
      const startMin = minFromClientY(e.clientY);
      const ghost = el("div", "tb-block tb-block-ghost");
      grid.appendChild(ghost);
      const paint = (a, b2) => {
        const top = Math.min(a, b2), h = Math.max(20, Math.abs(b2 - a));
        ghost.style.top = (top / 60 * TB_HOUR_H) + "px";
        ghost.style.height = (h / 60 * TB_HOUR_H) + "px";
      };
      paint(startMin, startMin + 15);
      let endMin = startMin + 15;
      const move = ev => { endMin = minFromClientY(ev.clientY); paint(startMin, endMin); };
      const up = () => {
        window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
        ghost.remove();
        const s = Math.min(startMin, endMin), en = Math.max(startMin, endMin);
        const nb = tbAddBlock(viewDate, { title: "", start: s, dur: Math.max(5, en - s) });
        openBlockEditor(viewDate, nb, true);
      };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });

    // Drop a task chip from the pool straight onto the calendar at the exact drop position.
    grid.addEventListener("dragover", e => e.preventDefault());
    grid.addEventListener("drop", e => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/task");
      const t = id && byId(id);
      if (!t) return;
      tbAddBlock(viewDate, { taskId: t.id, title: t.title, start: minFromClientY(e.clientY), dur: t.estimate || 30 });
      renderTimeboxView();
    });
    pool.addEventListener("dragover", e => e.preventDefault());
    pool.addEventListener("drop", e => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/task");
      if (typeof Undo !== "undefined") Undo.record();
      Store.s.timebox[viewDate] = tbBlocksFor(viewDate).filter(b => b.taskId !== id);
      Store.save(); renderTimeboxView();
    });

    // Scrolling past the very bottom of the day zooms out to the month view; Esc reverses it.
    scrollWrap.addEventListener("wheel", e => {
      if (e.deltaY > 0 && scrollWrap.scrollTop >= scrollWrap.scrollHeight - scrollWrap.clientHeight - 2) {
        e.preventDefault();
        tbViewMode = "month"; tbMonthCursor = viewDate.slice(0, 7); renderTimeboxView();
      }
    }, { passive: false });
  }

  function tbBlockEl(b, col, totalCols, date, minFromClientY) {
    const colorHex = b.color ? (TB_COLORS.find(c => c.id === b.color) || {}).hex : null;
    const d = el("div", `tb-block ${colorHex ? "tinted" : ""}`);
    if (colorHex) d.style.setProperty("--tint", colorHex);
    d.style.top = (b.start / 60 * TB_HOUR_H) + "px";
    d.style.height = Math.max(16, b.dur / 60 * TB_HOUR_H) + "px";
    d.style.left = `calc(${col} * (100% / ${totalCols}) + 2px)`;
    d.style.width = `calc(100% / ${totalCols} - 4px)`;
    d.title = "Drag to move · drag bottom edge to resize · click to edit";
    d.innerHTML = `<div class="tb-block-title">${b.taskId ? '<i class="ico" data-ico="link"></i> ' : ""}${esc(b.title || "Untitled")}</div>
      <div class="tb-block-time">${tbMinToLabel(b.start)} – ${tbMinToLabel(b.start + b.dur)}</div>
      <div class="tb-block-resize"></div>`;
    UI.mountIcons(d);

    d.addEventListener("mousedown", e => {
      if (e.target.closest(".tb-block-resize")) return;
      e.stopPropagation();
      const startClientY = e.clientY, startStart = b.start;
      let moved = false;
      const move = ev => {
        const dy = ev.clientY - startClientY;
        if (Math.abs(dy) > 3) moved = true;
        b.start = Math.max(0, Math.min(1439 - b.dur, startStart + Math.round(dy / TB_HOUR_H * 60)));
        d.style.top = (b.start / 60 * TB_HOUR_H) + "px";
        d.querySelector(".tb-block-time").textContent = `${tbMinToLabel(b.start)} – ${tbMinToLabel(b.start + b.dur)}`;
      };
      const up = () => {
        window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
        if (moved && typeof Undo !== "undefined") Undo.record();
        Store.save();
        if (!moved) openBlockEditor(date, b, false);
        else renderTimeboxView();
      };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    d.querySelector(".tb-block-resize").addEventListener("mousedown", e => {
      e.stopPropagation();
      const startClientY = e.clientY, startDur = b.dur;
      const move = ev => {
        b.dur = Math.max(5, Math.min(1440 - b.start, startDur + Math.round((ev.clientY - startClientY) / TB_HOUR_H * 60)));
        d.style.height = Math.max(16, b.dur / 60 * TB_HOUR_H) + "px";
        d.querySelector(".tb-block-time").textContent = `${tbMinToLabel(b.start)} – ${tbMinToLabel(b.start + b.dur)}`;
      };
      const up = () => {
        window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
        if (typeof Undo !== "undefined") Undo.record();
        Store.save(); renderTimeboxView();
      };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    });
    return d;
  }

  function tbMonthEventHtml(b) {
    const colorHex = b.color ? (TB_COLORS.find(c => c.id === b.color) || {}).hex : "var(--muted2)";
    return `<div class="tb-month-event">
      <span class="tb-month-event-bar" style="background:${colorHex}"></span>
      <span class="tb-month-event-dot"></span>
      <span class="tb-month-event-title">${esc(b.title || "Untitled")}</span>
      <span class="tb-month-event-time">${tbMinToLabel(b.start)}</span>
    </div>`;
  }

  function renderTimeboxMonth(v) {
    const cursor = tbMonthCursor || Store.todayStr().slice(0, 7);
    const [y, m] = cursor.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthLabel = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const today = Store.todayStr();

    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    v.innerHTML = `
      <div class="card tb-fade-in">
        <h2>
          <button class="icon-btn" id="tb-m-prev" title="Previous month"><i class="ico" data-ico="chevron" style="transform:rotate(180deg);display:inline-block"></i></button>
          <span class="tb-date-label">${monthLabel}</span>
          <button class="icon-btn" id="tb-m-next" title="Next month"><i class="ico" data-ico="chevron"></i></button>
        </h2>
        <div class="card-sub"><b>↑</b> returns to the day timeboxing view for the selected day (or today). Click a day, press Enter, or scroll up on a day to zoom into its minute-precision calendar. <b>↓</b> from day view opens this month calendar.</div>
        <div class="tb-month-grid" id="tb-month-grid">
          ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<div class="tb-month-dow">${d}</div>`).join("")}
          ${cells.map(d => {
            if (!d) return `<div class="tb-month-cell empty"></div>`;
            const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const blocks = tbBlocksFor(dateStr).slice().sort((a, b) => a.start - b.start);
            const maxShow = 4;
            const events = blocks.slice(0, maxShow).map(tbMonthEventHtml).join("");
            const more = blocks.length > maxShow ? `<div class="tb-month-more">+${blocks.length - maxShow} more</div>` : "";
            return `<button class="tb-month-cell ${dateStr === today ? "today" : ""}" data-date="${dateStr}" tabindex="0">
              <span class="tb-month-daynum">${d}</span>
              <div class="tb-month-events">${events || `<span class="tb-month-empty muted2">—</span>`}${more}</div>
            </button>`;
          }).join("")}
        </div>
      </div>`;
    UI.mountIcons(v);

    $("#tb-m-prev").onclick = () => { const nd = new Date(y, m - 2, 1); tbMonthCursor = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`; renderTimeboxView(); };
    $("#tb-m-next").onclick = () => { const nd = new Date(y, m, 1); tbMonthCursor = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`; renderTimeboxView(); };
    const zoomIntoDay = dateStr => { tbViewDate = dateStr; tbViewMode = "day"; renderTimeboxView(); };
    v.querySelectorAll(".tb-month-cell[data-date]").forEach(c => {
      c.onclick = () => zoomIntoDay(c.dataset.date);
      c.addEventListener("keydown", e => {
        if (e.key === "ArrowUp" || e.key === "Enter" || e.key === "+") { e.preventDefault(); zoomIntoDay(c.dataset.date); }
      });
    });
    $("#tb-month-grid").addEventListener("wheel", e => {
      const cell = e.target.closest(".tb-month-cell[data-date]");
      if (!cell || e.deltaY >= 0) return;
      e.preventDefault();
      zoomIntoDay(cell.dataset.date);
    }, { passive: false });
  }

  /* ---------- Repeatable schedules: copy between days & saved routine ---------- */
  function cloneForToday(t) {
    return createTask({
      title: t.title, priority: t.priority, tags: (t.tags || []).slice(),
      skill: t.skill, estimate: t.estimate, due: Store.todayStr(),
    });
  }

  // Copies every block from one day onto another — used for both "Copy yesterday" (backward)
  // and "Copy → tomorrow" (forward). Finished/iced linked tasks get a fresh clone so the copy
  // is actually actionable rather than pointing at an already-completed task.
  function copyScheduleBetween(fromDate, toDate, forward) {
    const src = tbBlocksFor(fromDate);
    if (!src.length) { UI.toast(`No schedule found for ${forward ? "today" : "yesterday"} to copy`, "bad"); return; }
    if (typeof Undo !== "undefined") Undo.record();
    const dest = tbBlocksFor(toDate);
    let placed = 0;
    src.forEach((b, i) => {
      let taskId = b.taskId;
      if (taskId) {
        const t = byId(taskId);
        if (!t) taskId = null;
        else if (t.status === "done" || t.status === "icebox") taskId = cloneForToday(t).id;
        if (taskId && dest.some(x => x.taskId === taskId)) return;
      }
      dest.push({ id: "tb" + Date.now() + Math.floor(Math.random() * 10000) + i, taskId, title: b.title, color: b.color, start: b.start, dur: b.dur });
      placed++;
    });
    Store.save(); renderTimeboxView();
    UI.toast(`📋 Schedule copied — ${placed} block(s) ${forward ? "moved forward a day" : "rebuilt"}`);
  }

  function saveRoutine() {
    const blocks = tbBlocksFor(Store.todayStr());
    if (!blocks.length) { UI.toast("Draw some blocks onto today's calendar first, then save the layout as your routine", "bad"); return; }
    if (typeof Undo !== "undefined") Undo.record();
    Store.s.routine = blocks.map(b => {
      const t = b.taskId ? byId(b.taskId) : null;
      return { title: b.title, start: b.start, dur: b.dur, color: b.color, priority: t?.priority, tags: (t?.tags || []).slice(), skill: t?.skill, estimate: t?.estimate };
    });
    Store.save(); renderTimeboxView();
    UI.toast(`⭐ Routine saved (${Store.s.routine.length} block(s)). Hit ▶ Apply routine any morning — zero retyping.`);
  }

  function applyRoutine() {
    const r = Store.s.routine;
    if (!r || !r.length) { UI.toast("No routine saved yet — build today's plan, then ⭐ Save as routine", "bad"); return; }
    if (typeof Undo !== "undefined") Undo.record();
    const today = Store.todayStr();
    let placed = 0;
    r.forEach(spec => {
      let t = Store.s.tasks.find(x => x.title === spec.title && (x.status === "todo" || x.status === "doing"));
      if (!t) t = createTask({ title: spec.title, priority: spec.priority, tags: (spec.tags || []).slice(), skill: spec.skill, estimate: spec.estimate, due: today });
      if (tbHasTask(today, t.id)) return;
      tbAddBlock(today, { taskId: t.id, title: spec.title, start: spec.start, dur: spec.dur, color: spec.color });
      placed++;
    });
    Store.save(); renderTimeboxView();
    AudioFX.play("complete");
    UI.toast(`▶ Routine applied — ${placed} block(s) scheduled, tasks recreated automatically`);
  }

  function deleteRoutine() {
    if (typeof Undo !== "undefined") Undo.record();
    Store.s.routine = null;
    Store.save(); renderTimeboxView();
    UI.toast("Routine deleted — save a new one anytime");
  }

  function tbChip(t) {
    const c = el("div", "tb-chip", esc(t.title));
    c.draggable = true;
    c.addEventListener("dragstart", e => e.dataTransfer.setData("text/task", t.id));
    return c;
  }

  /* ---------- Housekeeping (auto-clean, smart reschedule) ---------- */
  function housekeeping() {
    const now = Date.now();
    if (Store.s.settings.autoClean) {
      const before = Store.s.tasks.length;
      Store.s.tasks = Store.s.tasks.filter(t => !(t.status === "done" && t.completedAt && now - t.completedAt > 7 * 864e5));
      if (Store.s.tasks.length < before) toast(`🧹 Auto-clean archived ${before - Store.s.tasks.length} old done task(s)`);
    }
    if (Store.s.settings.autoReschedule) {
      const today = Store.todayStr();
      let moved = 0;
      Store.s.tasks.forEach(t => {
        if (t.status !== "done" && t.status !== "icebox" && t.due && t.due < today) { t.due = today; moved++; }
      });
      if (moved) toast(`📦 Smart reschedule: ${moved} unfinished task(s) moved to today`);
    }
    Store.save();
  }

  return {
    createTask, byId, completeTask, reopenTask, deleteTask, setNow,
    parseQuickAdd, sortedTasks, nowTask, taskCardEl, editModal,
    renderTasksView, renderTimeboxView, render, housekeeping,
    nextRecurDate, tbBlocksFor, tbHasTask, tbAddBlock,
  };
})();
