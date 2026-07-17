/* ==========================================================
   app.js — dashboard (Now / Pulse / Progress), quests view,
   skills & bosses & guild, shop, automation, settings, boot
   ========================================================== */
"use strict";

/* ---------- Automation (IFTTT rules, templates, focus hours) ---------- */
const Automation = (() => {
  const { $, el, esc, toast, modal } = UI;

  const TRIGGERS = {
    tasksDoneToday: { label: "tasks completed today reaches", get: () => Store.day().tasksDone },
    focusMinToday: { label: "focus minutes today reach", get: () => Store.day().focusMin },
    xpToday: { label: "XP earned today reaches", get: () => Store.day().xp },
    streak: { label: "streak reaches (days)", get: () => Store.s.streak },
  };
  const ACTIONS = {
    coins: { label: "grant 50 bonus coins", run: () => Game.addCoins(50) },
    theme_minimal: { label: "switch to Minimal theme", run: () => { UI.setThemeMode("minimal"); toast("🎨 Minimal theme activated by your rule!"); } },
    theme_dark: { label: "switch to Dark theme", run: () => { UI.setThemeMode("dark"); toast("🎨 Dark theme activated by your rule!"); } },
    zen: { label: "enter Zen Mode", run: () => UI.enterZen() },
    celebrate: { label: "throw a celebration", run: () => UI.congrats("Rule Triggered! 🤖", "Aarush, your own automation just rewarded you. You literally programmed your motivation.", "🤖") },
  };

  function checkRules() {
    const today = Store.todayStr();
    (Store.s.rules || []).forEach(r => {
      if (r.firedDay === today) return;
      const trig = TRIGGERS[r.trigger];
      if (trig && trig.get() >= r.threshold) {
        r.firedDay = today;
        toast(`🌐 Rule fired: when ${trig.label} ${r.threshold}`, "gold", 4000);
        ACTIONS[r.action]?.run();
        Store.save();
      }
    });
  }

  /* template scheduler: auto-append sub-tasks when a new task title matches */
  function applyTemplates(task) {
    (Store.s.taskTemplates || []).forEach(tpl => {
      if (tpl.match && task.title.toLowerCase().includes(tpl.match.toLowerCase())) {
        tpl.subs.forEach(s => task.subtasks.push({ id: Date.now() + Math.random(), name: s, done: false, subtasks: [] }));
        toast(`📐 Template "${tpl.match}" auto-added ${tpl.subs.length} sub-tasks`);
      }
    });
  }

  /* focus scheduling: auto high-alert during set hours */
  let focusModeActive = false;
  function checkFocusHours() {
    const fh = Store.s.settings.focusHours;
    if (!fh.enabled) return;
    const h = new Date().getHours();
    const inWindow = fh.start <= fh.end ? (h >= fh.start && h < fh.end) : (h >= fh.start || h < fh.end);
    if (inWindow && !focusModeActive) {
      focusModeActive = true;
      Store.s.pomo.strict = true;
      toast("🚨 Scheduled Focus Hours began — Strict Mode auto-enabled. High-alert engaged.", "gold", 6000);
      Store.save();
    } else if (!inWindow && focusModeActive) {
      focusModeActive = false;
      Store.s.pomo.strict = false;
      toast("Focus hours over — strict mode relaxed. Good work. 🫡");
      Store.save();
    }
  }

  function render() {
    const v = $("#view-automation");
    const rules = Store.s.rules || [];
    const templates = Store.s.taskTemplates || [];
    const fh = Store.s.settings.focusHours;

    v.innerHTML = `
      <div class="card">
        <h2>🌐 "If This, Then That" Rules</h2>
        <div class="card-sub">Program your own reward loops. Rules fire once per day.</div>
        <div id="rule-list">${rules.filter(r => TRIGGERS[r.trigger] && ACTIONS[r.action]).map(r => `
          <div class="rule-row">
            <span>IF <b>${TRIGGERS[r.trigger].label} ${r.threshold}</b> → THEN <b>${ACTIONS[r.action].label}</b></span>
            <span class="muted" style="font-size:.7rem">${r.firedDay === Store.todayStr() ? "✅ fired today" : "⏳ armed"}</span>
            <button class="icon-btn" data-del-rule="${r.id}">🗑</button>
          </div>`).join("") || '<span class="muted">No rules yet.</span>'}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <select id="rule-trig">${Object.entries(TRIGGERS).map(([k, t]) => `<option value="${k}">${t.label}…</option>`).join("")}</select>
          <input type="number" id="rule-n" placeholder="n" style="max-width:80px" value="3">
          <select id="rule-act">${Object.entries(ACTIONS).map(([k, a]) => `<option value="${k}">${a.label}</option>`).join("")}</select>
          <button class="btn primary sm" id="rule-add">＋ Add rule</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>⏰ Focus Scheduling</h2>
          <div class="card-sub">During these hours the app auto-switches to high-alert (Strict Mode on).</div>
          <label class="check"><input type="checkbox" id="fh-on" ${fh.enabled ? "checked" : ""}> Enable scheduled focus hours</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" id="fh-start" min="0" max="23" value="${fh.start}" style="max-width:80px"> :00 →
            <input type="number" id="fh-end" min="0" max="23" value="${fh.end}" style="max-width:80px"> :00
          </div>
        </div>
        <div class="card">
          <h2>🧹 Housekeeping Automations</h2>
          <label class="check"><input type="checkbox" id="ak-clean" ${Store.s.settings.autoClean ? "checked" : ""}> Auto-clean: archive done tasks older than 7 days</label>
          <label class="check"><input type="checkbox" id="ak-resched" ${Store.s.settings.autoReschedule ? "checked" : ""}> Smart rescheduling: move yesterday's unfinished tasks to today</label>
        </div>
      </div>

      <div class="card">
        <h2>📐 Template Scheduler</h2>
        <div class="card-sub">When a new task's title contains a keyword, sub-tasks are auto-appended.</div>
        <div>${templates.map((t, i) => `
          <div class="rule-row"><span>"<b>${esc(t.match)}</b>" → +${t.subs.map(esc).join(", ")}</span>
          <button class="icon-btn" data-del-tpl="${i}">🗑</button></div>`).join("") || '<span class="muted">No templates yet.</span>'}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <input type="text" id="tpl-match" placeholder='keyword, e.g. "essay"' style="max-width:160px">
          <input type="text" id="tpl-subs" placeholder="sub-tasks, comma separated: Outline, Draft, Edit">
          <button class="btn primary sm" id="tpl-add">＋ Add</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>💾 Data Backup</h2>
          <div class="card-sub">One-click local backup of everything (per profile).</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" id="bk-export">⬇ Export backup</button>
            <button class="btn" id="bk-import">⬆ Import backup</button>
            <input type="file" id="bk-file" accept=".json" class="hidden">
          </div>
        </div>
        <div class="card">
          <h2>♻️ Prestige (Stat Reset)</h2>
          <div class="card-sub">Reset XP, coins, tasks & streak for a fresh start — badges, notes and best-streak survive. Prestige can always be undone from this page; downloading a backup file is optional, your call.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn danger" id="prestige-btn">♻️ Prestige reset</button>
            ${Store.hasPrestigeSnapshot() ? `<button class="btn" id="prestige-undo">↩️ Undo last prestige</button>` : ""}
          </div>
        </div>
      </div>`;

    $("#rule-add").onclick = () => {
      Store.s.rules = Store.s.rules || [];
      Store.s.rules.push({
        id: "r" + Date.now(),
        trigger: $("#rule-trig").value,
        threshold: parseInt($("#rule-n").value, 10) || 1,
        action: $("#rule-act").value,
        firedDay: null,
      });
      Store.save(); render();
    };
    v.querySelectorAll("[data-del-rule]").forEach(b => b.onclick = () => {
      Store.s.rules = Store.s.rules.filter(r => r.id !== b.dataset.delRule);
      Store.save(); render();
    });
    $("#fh-on").onchange = e => { fh.enabled = e.target.checked; Store.save(); checkFocusHours(); };
    $("#fh-start").onchange = e => { fh.start = +e.target.value; Store.save(); };
    $("#fh-end").onchange = e => { fh.end = +e.target.value; Store.save(); };
    $("#ak-clean").onchange = e => { Store.s.settings.autoClean = e.target.checked; Store.save(); };
    $("#ak-resched").onchange = e => { Store.s.settings.autoReschedule = e.target.checked; Store.save(); };

    $("#tpl-add").onclick = () => {
      const match = $("#tpl-match").value.trim();
      const subs = $("#tpl-subs").value.split(",").map(s => s.trim()).filter(Boolean);
      if (!match || !subs.length) { toast("Need a keyword and at least one sub-task", "bad"); return; }
      (Store.s.taskTemplates = Store.s.taskTemplates || []).push({ match, subs });
      Store.save(); render();
    };
    v.querySelectorAll("[data-del-tpl]").forEach(b => b.onclick = () => {
      Store.s.taskTemplates.splice(+b.dataset.delTpl, 1);
      Store.save(); render();
    });

    $("#bk-export").onclick = () => { Store.exportBackup(); toast("💾 Backup downloaded"); };
    $("#bk-import").onclick = () => $("#bk-file").click();
    $("#bk-file").onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { Store.importBackup(rd.result); toast("✅ Backup restored"); location.reload(); }
        catch (err) { toast("Import failed — invalid file", "bad"); }
      };
      rd.readAsText(f);
    };
    $("#prestige-btn").onclick = () => {
      modal("♻️ Prestige?", `<p>This resets XP, level, coins, tasks and streak. You keep: badges, best streak, notes, settings — plus a shiny <b>Prestige ${Store.s.prestige + 1}</b> rank.</p>
        <p class="muted" style="margin:8px 0">You can undo this anytime from this page — but a downloaded backup file is a nice extra safety net.</p>
        <label class="check"><input type="checkbox" id="prestige-backup-chk"> 💾 Also download a backup file before resetting</label>`,
        [
          { label: "Cancel" },
          { label: "♻️ Yes, reset me", cls: "danger", onClick: m => {
            if (m.querySelector("#prestige-backup-chk").checked) Store.exportBackup();
            Store.prestige();
            UI.congrats("Prestige! ♻️", `Welcome to Prestige ${Store.s.prestige}, Aarush. Same you, fresh numbers, all the wisdom.`, "♻️");
            Game.checkBadges();
            UI.refreshAll();
            render();
          }},
        ]);
    };
    const undoBtn = $("#prestige-undo");
    if (undoBtn) undoBtn.onclick = () => {
      modal("↩️ Undo prestige?", `<p>This restores everything — XP, level, coins, tasks, streak — exactly as it was the moment you prestiged.</p>`,
        [
          { label: "Cancel" },
          { label: "↩️ Restore it all", cls: "primary", onClick: () => {
            if (Store.undoPrestige()) { toast("↩️ Prestige undone — everything restored"); location.reload(); }
            else toast("No snapshot found", "bad");
          }},
        ]);
    };
  }

  return { checkRules, applyTemplates, checkFocusHours, render };
})();

/* ---------- Main App ---------- */
const App = (() => {
  const { $, $$, el, esc, toast, modal } = UI;
  let ritualExpanded = false;

  /* ============ DAILY RITUAL ENGINE ============ */
  function hourFocusMap() {
    const h = Array(24).fill(0);
    Store.s.focusLog.forEach(f => h[f.hour] += f.mins);
    return h;
  }
  function peakHour() {
    const h = hourFocusMap();
    const max = Math.max(...h);
    return max > 0 ? h.indexOf(max) : 10;
  }
  function dateFromTs(ts) { return Store.todayStr(new Date(ts)); }
  function yesterdayKey() { return Store.todayStr(new Date(Date.now() - 864e5)); }
  function completionCount(title) {
    return Store.s.tasks.filter(t => t.title === title && t.completedAt).length;
  }
  function findActiveByTitle(title) {
    return Store.s.tasks.find(t => t.title === title && (t.status === "todo" || t.status === "doing"));
  }
  function strongestRecurringTasks(limit = 4) {
    const map = new Map();
    Store.s.tasks.filter(t => t.recur).forEach(t => {
      if (!map.has(t.title)) map.set(t.title, { title: t.title, priority: t.priority, tags: (t.tags || []).slice(), skill: t.skill, estimate: t.estimate, recur: t.recur });
    });
    return [...map.values()]
      .sort((a, b) => completionCount(b.title) - completionCount(a.title))
      .slice(0, limit);
  }
  function yesterdayWinningSlots(limit = 4) {
    const yday = yesterdayKey();
    const blocks = Tasks.tbBlocksFor(yday);
    const rows = [];
    blocks.forEach(b => {
      if (!b.taskId) return;
      const t = Tasks.byId(b.taskId);
      if (!t || !t.completedAt || dateFromTs(t.completedAt) !== yday) return;
      rows.push({
        hour: Math.floor(b.start / 60),
        title: t.title,
        priority: t.priority,
        tags: (t.tags || []).slice(),
        skill: t.skill,
        estimate: t.estimate,
        source: "yesterday win",
      });
    });
    return rows.sort((a, b) => a.hour - b.hour).slice(0, limit);
  }
  function unfinishedSuggestions(limit = 5) {
    const pri = p => ({ high: 3, med: 2, low: 1 }[p] || 1);
    return Store.s.tasks
      .filter(t => t.status === "todo" || t.status === "doing")
      .sort((a, b) => pri(b.priority) - pri(a.priority))
      .slice(0, limit)
      .map(t => ({ title: t.title, id: t.id, reason: t.status === "doing" ? "already in progress" : "unfinished item" }));
  }
  function brainDumpSuggestions(limit = 3) {
    const lines = (Store.s.braindump || "")
      .split("\n").map(x => x.trim()).filter(Boolean)
      .filter(x => x.length >= 3)
      .slice(0, limit);
    return lines.map(title => ({ title, reason: "brain dump idea" }));
  }
  function craftJournalPrompt(ydayStats, winners) {
    if (!ydayStats) return "What's one win you want to repeat from yesterday?";
    const winTask = winners[0]?.title;
    if (winTask) {
      return `Yesterday's win was "${winTask}". What made it work, and how can you repeat that today?`;
    }
    if ((ydayStats.focusMin || 0) > 0) {
      return `You focused ${ydayStats.focusMin} min yesterday. What one choice made that possible?`;
    }
    return "If today goes well, what tiny action will future-you thank you for?";
  }
  function buildDailyRitual() {
    const today = Store.todayStr();
    const yday = yesterdayKey();
    const yStats = Store.s.dayStats[yday] || null;
    const peak = peakHour();
    const routine = Store.s.routine || [];
    const winners = yesterdayWinningSlots(5);
    const recurring = strongestRecurringTasks(4);
    const unfinished = unfinishedSuggestions(5);
    const brain = brainDumpSuggestions(3);

    // Build prefill slots by confidence tiers: routine -> yesterday wins -> recurring -> high unfinished
    const usedTitles = new Set();
    const slots = [];
    const pushSlot = (hour, spec, source) => {
      if (!spec?.title) return;
      if (usedTitles.has(spec.title)) return;
      usedTitles.add(spec.title);
      slots.push({
        hour: Math.max(6, Math.min(23, +hour)),
        title: spec.title,
        priority: spec.priority || "med",
        tags: (spec.tags || []).slice(),
        skill: spec.skill || null,
        estimate: spec.estimate || null,
        source,
      });
    };

    routine.forEach(s => pushSlot(Math.floor((s.start || 0) / 60), s, "routine"));
    winners.forEach(w => pushSlot(w.hour, w, "yesterday win"));

    let shift = 0;
    recurring.forEach(r => pushSlot(peak + (shift++), r, "recurring"));
    unfinished.filter(u => !usedTitles.has(u.title)).slice(0, 2).forEach((u, i) => {
      const t = Tasks.byId(u.id);
      if (t) pushSlot(peak + 2 + i, t, "unfinished");
    });

    const overwhelmScore =
      (Store.s.tasks.filter(t => t.status === "todo").length >= 10 ? 2 : 0) +
      (brain.length >= 4 ? 1 : 0) +
      ((Store.day().distracted || 0) >= 5 ? 1 : 0);
    const overwhelm = overwhelmScore >= 2;

    const head = yStats && ((yStats.focusMin || 0) > 0 || (yStats.tasksDone || 0) > 0)
      ? `Good morning. Yesterday you crushed ${yStats.tasksDone || 0} tasks and ${yStats.focusMin || 0} focus min. Here's what Today You might love:`
      : "Good morning. Here's a low-friction day plan built from your routines, unfinished priorities, and best focus hour:";

    return {
      today, yday, peak, winners, recurring, unfinished, brain, overwhelm,
      headline: head,
      slots: slots.sort((a, b) => a.hour - b.hour).slice(0, 8),
      journalPrompt: craftJournalPrompt(yStats, winners),
      ran: !!Store.day().ritualRan,
    };
  }
  function applyDailyRitual(plan) {
    const today = Store.todayStr();
    let scheduled = 0, created = 0;
    plan.slots.forEach(s => {
      let t = findActiveByTitle(s.title);
      if (!t) {
        t = Tasks.createTask({
          title: s.title, priority: s.priority || "med",
          tags: (s.tags || []).slice(), skill: s.skill || null,
          estimate: s.estimate || null, due: today,
        });
        created++;
      }
      if (!Tasks.tbHasTask(today, t.id)) {
        Tasks.tbAddBlock(today, { taskId: t.id, title: t.title, start: s.hour * 60, dur: t.estimate || 45, color: null });
        scheduled++;
      }
    });

    // Pull top brain-dump ideas into tasks (not auto-slotted, so user can drag)
    const createdFromBrain = [];
    plan.brain.slice(0, 2).forEach(b => {
      if (!findActiveByTitle(b.title)) {
        const t = Tasks.createTask(Tasks.parseQuickAdd(b.title + " /today"));
        createdFromBrain.push(t.title);
      }
    });

    // Seed journal prompt tied to yesterday wins
    Store.s.journal[today] = Store.s.journal[today] || { prompt: "", entry: "", gratitude: "" };
    if (!Store.s.journal[today].entry) Store.s.journal[today].prompt = plan.journalPrompt;

    const d = Store.day();
    d.ritualRan = true;
    d.ritualRanAt = Date.now();
    Store.save();
    UI.refreshAll();
    UI.showView("timebox");
    toast(`🚀 Day loaded: ${scheduled} timeblocks ready (${created} new tasks). Drag to tweak, then start.`);
    if (createdFromBrain.length) toast(`🧠 Also pulled from Brain Dump: ${createdFromBrain.join(", ")}`, "", 5000);
  }

  /* ============ DASHBOARD ============ */
  function renderDashboard() {
    const v = $("#view-dashboard");
    const t = Tasks.nowTask();
    const lvl = Game.level();
    Game.ensureDailyQuests();
    const quests = Store.s.quests.list;
    const d = Store.day();
    const anchor = Store.s.preCommit.day === Store.todayStr() ? Store.s.preCommit.text : null;

    const ritual = buildDailyRitual();

    // Dense task feed: active task pinned first, then next few todo/doing rows.
    const feed = [...Tasks.sortedTasks("doing"), ...Tasks.sortedTasks("todo")]
      .filter(x => !t || x.id !== t.id)
      .slice(0, t ? 5 : 6);
    const priColor = p => p === "high" ? "var(--bad)" : p === "med" ? "var(--gold)" : "var(--text-tertiary)";
    const taskRow = (tk, active) => `
      <div class="task-row-mini ${active ? "active" : ""}" data-id="${tk.id}">
        <span class="t-pri-dot" style="background:${priColor(tk.priority)}"></span>
        <span class="t-row-title">${esc(tk.title)}</span>
        <span class="status-tag ${tk.status}">${tk.status === "doing" ? "In Progress" : "Todo"}</span>
      </div>`;

    v.innerHTML = `
      <!-- DAILY RITUAL — collapsed to one line by default ("card" > "block" per Linear's info-density rule) -->
      <div class="card ritual-card">
        <div class="ritual-top">
          <span class="zone-label" style="margin:0">Daily Ritual</span>
          <span class="ritual-summary">${esc(ritual.headline)}</span>
          <button class="btn sm ghost" id="ritual-toggle">${ritualExpanded ? "Hide" : "Details"}</button>
          <button class="btn sm primary" id="run-day-btn">${ritual.ran ? "↻ Re-run" : "▶ Run This Day"}</button>
        </div>
        <div class="ritual-details ${ritualExpanded ? "" : "hidden"}">
          <div class="ritual-grid">
            <div class="ritual-block">
              <div class="ritual-k">Auto-generated Timebox</div>
              ${ritual.slots.length
                ? ritual.slots.slice(0, 5).map(s => `<div class="ritual-line"><b>${s.hour % 12 || 12}${s.hour < 12 ? "AM" : "PM"}</b> ${esc(s.title)} <span class="muted">(${s.source})</span></div>`).join("")
                : `<div class="muted">No saved routine or wins yet — this will improve as you use Timebox.</div>`}
            </div>
            <div class="ritual-block">
              <div class="ritual-k">Smart Suggestions</div>
              ${ritual.unfinished.slice(0, 3).map(s => `<div class="ritual-line">• ${esc(s.title)} <span class="muted">(${s.reason})</span></div>`).join("") || `<div class="muted">No unfinished tasks right now.</div>`}
              ${ritual.brain.slice(0, 2).map(s => `<div class="ritual-line">• ${esc(s.title)} <span class="muted">(brain dump)</span></div>`).join("")}
              <div class="ritual-line">⚡ Peak hour detected: <b>${ritual.peak % 12 || 12}${ritual.peak < 12 ? "AM" : "PM"}</b> — deep work is weighted here.</div>
              <div class="ritual-line">📔 Journal prompt seeded from yesterday's wins.</div>
            </div>
          </div>
          <div class="ritual-actions">
            <button class="btn" id="open-timebox-btn">Open Timebox</button>
            ${ritual.overwhelm ? `<button class="btn good" id="ritual-zen-btn">Enter Zen (overwhelm detected)</button>` : ""}
            <span class="muted ritual-hint">After running, you'll land in Timebox with everything draggable for quick customization.</span>
          </div>
        </div>
      </div>

      <!-- THE NOW ZONE — dense row feed instead of one giant hero card; quick-add lives on "n" -->
      <div class="zone-now ${Timer.isRunning() ? "pulsing" : ""}">
        <div class="zone-label">The Now Zone ${anchor ? `· <span style="color:var(--gold)">⚓ today's ONE thing: ${esc(anchor)}</span>` : ""}</div>
        ${t ? `
          <div class="now-active-row">
            <div>
              <div class="now-task-title">${esc(t.title)}</div>
              <div class="now-task-meta">
                ${t.commitment ? `💬 "${esc(t.commitment)}"` : "No commitment written yet — the timer will ask."}
                ${t.estimate ? ` · ⏱ ~${t.estimate} min` : ""}
              </div>
            </div>
            <div class="now-active-actions">
              <button class="btn sm good" id="now-complete">Done</button>
              <button class="btn sm" id="now-micro">Break down</button>
              <button class="btn sm ghost" id="now-skip">Skip</button>
            </div>
          </div>` : ""}
        <div class="task-list-mini">
          ${feed.map(x => taskRow(x, false)).join("") || (t ? "" : `<div class="now-empty">Nothing queued — press <kbd>n</kbd> to quick-add, or hit <kbd>2</kbd> for the full board.</div>`)}
        </div>
      </div>

      <!-- THE PULSE -->
      <div class="card pulse-card">
        <div class="zone-label">The Pulse</div>
        ${Timer.pulseHTML()}
      </div>

      <!-- THE PROGRESS -->
      <div class="card progress-card">
        <div class="zone-label">The Progress</div>
        <div class="prog-row">
          <div class="prog-stat"><div class="big"><i class="ico" data-ico="star"></i> ${lvl.level}</div><div class="lbl">level ${Store.s.prestige ? `(P${Store.s.prestige})` : ""}</div></div>
          <div class="prog-stat"><div class="big"><i class="ico" data-ico="flame"></i> ${Store.s.streak}</div><div class="lbl">day streak ×${Game.multiplier().toFixed(1)}</div></div>
          <div class="prog-stat"><div class="big"><i class="ico" data-ico="clock"></i> ${d.focusMin}</div><div class="lbl">focus min today</div></div>
          <div class="prog-stat"><div class="big"><i class="ico" data-ico="check"></i> ${d.tasksDone}</div><div class="lbl">tasks today</div></div>
          <div class="prog-stat"><div class="big"><i class="ico" data-ico="coin"></i> ${Store.s.coins}</div><div class="lbl">coins</div></div>
        </div>
        <div style="margin-top:16px">
          ${quests.map(q => `
            <div class="quest-item ${q.done ? "done" : ""}">
              <i class="ico" data-ico="${q.done ? "check" : "target"}"></i>
              <span class="q-name" style="flex:2">${q.name}</span>
              <span class="q-ratio">${Math.min(q.progress, q.target)}/${q.target}</span>
              <div class="q-prog"><i style="width:${Math.min(100, q.progress / q.target * 100)}%"></i></div>
              <span class="q-reward">+${q.xp}xp +${q.coins}c</span>
            </div>`).join("")}
        </div>
      </div>

      <div class="card quote-card">
        <div class="zone-label">Quote of the Day</div>
        ${(() => { const dq = Game.dailyQuote(); return `
          <p style="font-size:1rem;font-style:italic;max-width:640px;margin:8px 0 6px">"${dq.q}"</p>
          <p class="muted" style="font-size:.8rem">— ${dq.by}</p>`; })()}
        <div style="max-width:420px;margin:16px 0 0">
          <div class="muted" style="font-size:.72rem;margin-bottom:6px;display:flex;justify-content:space-between;gap:8px">
            <span>${d.sixHourDone ? "6-hour focus day conquered — reward claimed" : "6-hour focus day — reward: +500 XP, +300 coins"}</span>
            <span style="flex-shrink:0">${Math.floor(d.focusMin / 60)}h ${d.focusMin % 60}m / 6h</span>
          </div>
          <div class="q-prog"><i style="width:${Math.min(100, d.focusMin / 360 * 100)}%;background:${d.sixHourDone ? "var(--gold)" : "var(--accent)"}"></i></div>
        </div>
      </div>

      <div class="grid-2 misc-grid">
        <div class="card">
          <h2>⏳ Countdowns to Milestones <span class="spacer"></span><button class="btn sm" id="cd-add">＋</button></h2>
          <div id="cd-list"></div>
        </div>
        <div class="card">
          <h2>🗒️ Today's journal prompt</h2>
          <p style="font-size:.95rem;font-weight:600">"${Notes.dailyPrompt()}"</p>
          <button class="btn sm" style="margin-top:8px" id="dash-journal">📔 Answer in Journal</button>
        </div>
      </div>`;

    if (t) {
      $("#now-complete").onclick = () => { Psych.gateComplete(t); renderDashboard(); };
      $("#now-micro").onclick = () => Psych.microSteps(t);
      $("#now-skip").onclick = () => Psych.frictionPuzzle("skip this task", () => {
        t.status = "todo"; t.order = Date.now() + 1e6;
        const next = Store.s.tasks.filter(x => x.status === "todo" && x.id !== t.id)[0];
        if (next) Tasks.setNow(next.id); else { Store.save(); renderDashboard(); }
      });
    }
    $$(".task-row-mini").forEach(row => row.onclick = () => { Tasks.setNow(row.dataset.id, { quiet: true }); renderDashboard(); });

    $("#ritual-toggle").onclick = () => { ritualExpanded = !ritualExpanded; renderDashboard(); };
    $("#run-day-btn").onclick = () => applyDailyRitual(ritual);
    $("#open-timebox-btn")?.addEventListener("click", () => UI.showView("timebox"));
    $("#ritual-zen-btn")?.addEventListener("click", UI.enterZen);

    Timer.bindPulse(v);

    renderCountdowns();
    $("#cd-add").onclick = addCountdown;
    $("#dash-journal").onclick = () => UI.showView("journal");
    UI.mountIcons(v);
  }

  function renderCountdowns() {
    const wrap = $("#cd-list");
    if (!wrap) return;
    const list = Store.s.countdowns || [];
    wrap.innerHTML = list.length ? "" : '<span class="muted" style="font-size:.8rem">Add a big deadline — exams, launches, birthdays.</span>';
    list.forEach(cd => {
      const days = Math.ceil((new Date(cd.date + "T23:59") - Date.now()) / 864e5);
      const row = el("div", "stat-line cd-line");
      row.innerHTML = `<span>${esc(cd.name)}${cd.remindDate ? ` <i class="ico cd-remind-ico" data-ico="bell" title="Reminder set for ${esc(cd.remindDate)}"></i>` : ""}</span>
        <span class="cd-right"><b style="color:${days < 7 ? "var(--bad)" : "var(--accent)"}">${days < 0 ? "passed" : days + " days"}</b></span>`;
      UI.mountIcons(row);
      const right = row.querySelector(".cd-right");
      const edit = el("button", "icon-btn", '<i class="ico" data-ico="bell"></i>');
      edit.title = "Set/edit reminder";
      edit.onclick = () => editCountdownReminder(cd);
      UI.mountIcons(edit);
      const x = el("button", "icon-btn", "✕");
      x.onclick = () => { Store.s.countdowns = list.filter(c => c.id !== cd.id); Store.save(); renderCountdowns(); };
      right.appendChild(edit); right.appendChild(x);
      wrap.appendChild(row);
    });
  }

  function addCountdown() {
    modal("⏳ New Countdown", `
      <label class="field"><span>What's the milestone?</span><input type="text" id="cd-name" placeholder="Final exams"></label>
      <label class="field"><span>Date</span><input type="date" id="cd-date"></label>
      <label class="field"><span>Remind me on (optional)</span><input type="date" id="cd-remind"></label>
      <p class="muted" style="font-size:.72rem;margin-top:2px">You'll see a reminder banner every time you open the app on or after that date, right before it drops you into Focus.</p>`,
      [
        { label: "Cancel" },
        { label: "Add", cls: "primary", onClick: m => {
          const name = m.querySelector("#cd-name").value.trim();
          const date = m.querySelector("#cd-date").value;
          const remindDate = m.querySelector("#cd-remind").value || null;
          if (!name || !date) return false;
          (Store.s.countdowns = Store.s.countdowns || []).push({ id: "cd" + Date.now(), name, date, remindDate, remindLastShown: null });
          Store.save(); renderCountdowns();
        }},
      ]);
  }

  function editCountdownReminder(cd) {
    modal("🔔 Reminder", `
      <p class="muted" style="font-size:.82rem;margin-bottom:8px">Milestone: <b>${esc(cd.name)}</b> — ${esc(cd.date)}</p>
      <label class="field"><span>Remind me on</span><input type="date" id="cd-remind-edit" value="${esc(cd.remindDate || "")}"></label>
      <p class="muted" style="font-size:.72rem;margin-top:2px">Leave blank and save to remove the reminder.</p>`,
      [
        { label: "Cancel" },
        { label: "Save", cls: "primary", onClick: m => {
          cd.remindDate = m.querySelector("#cd-remind-edit").value || null;
          cd.remindLastShown = null;
          Store.save(); renderCountdowns();
        }},
      ]);
  }

  /* Milestone reminders — checked once per app load, before the Zen focus screen takes over,
     so nothing gets buried once you're locked into a session. Re-shows once per calendar day
     for every countdown whose remindDate has arrived, until you delete it or the date passes. */
  function checkMilestoneReminders() {
    const today = Store.todayStr();
    const due = (Store.s.countdowns || []).filter(cd => cd.remindDate && cd.remindDate <= today && cd.remindLastShown !== today);
    if (!due.length) return;
    due.forEach(cd => { cd.remindLastShown = today; });
    Store.save();
    const rows = due.map(cd => {
      const days = Math.ceil((new Date(cd.date + "T23:59") - Date.now()) / 864e5);
      return `<div class="stat-line"><span>${esc(cd.name)}</span><b style="color:${days < 7 ? "var(--bad)" : "var(--accent)"}">${days < 0 ? "passed" : days + " days"}</b></div>`;
    }).join("");
    modal("🔔 Milestone Reminder", `<p style="margin-bottom:10px">You asked to be reminded about:</p>${rows}`,
      [{ label: "Got it", cls: "primary" }], { sticky: true });
  }

  /* ============ QUESTS & BADGES ============ */
  function renderQuests() {
    const v = $("#view-quests");
    Game.ensureDailyQuests();
    const quests = Store.s.quests.list;
    v.innerHTML = `
      <div class="card">
        <h2>🎯 Daily Quests <span class="spacer"></span><span class="muted" style="font-size:.72rem">new set every midnight</span></h2>
        ${quests.map(q => `
          <div class="quest-item ${q.done ? "done" : ""}">
            <i class="ico" data-ico="${q.done ? "check" : "target"}"></i>
            <span class="q-name" style="flex:2">${q.name}</span>
            <span class="q-ratio">${Math.min(q.progress, q.target)}/${q.target}</span>
            <div class="q-prog"><i style="width:${Math.min(100, q.progress / q.target * 100)}%"></i></div>
            <span class="q-reward">+${q.xp}xp +${q.coins}c</span>
          </div>`).join("")}
        <p class="muted" style="font-size:.76rem;margin-top:8px">Clear all 3 for a +50 coin sweep bonus.</p>
      </div>
      <div class="card">
        <h2>🏅 Achievement Badges <span class="spacer"></span><span class="muted" style="font-size:.72rem">${Store.s.badges.length}/${Game.BADGES.length} unlocked</span></h2>
        <div class="badge-grid">
          ${Game.BADGES.map(b => `
            <div class="badge ${Store.s.badges.includes(b.id) ? "unlocked" : "locked"}" title="${b.desc}">
              <span class="b-icon">${b.icon}</span><b>${b.name}</b><br><span class="muted">${b.desc}</span>
            </div>`).join("")}
        </div>
      </div>`;
    UI.mountIcons(v);
  }

  /* ============ SKILLS, BOSSES & GUILD ============ */
  function renderSkills() {
    const v = $("#view-skills");
    const party = Store.s.party || null;

    v.innerHTML = `
      <div class="card">
        <h2>🌳 Real-Life Skill Trees <span class="spacer"></span><button class="btn sm" id="skill-add">＋ New skill</button></h2>
        <div class="card-sub">Tag tasks with a skill (e.g. <kbd>@coding</kbd>) — its XP grows every time you focus or finish.</div>
        <div id="skill-list"></div>
      </div>

      <div class="card">
        <h2>⚔️ Boss Battles <span class="spacer"></span><button class="btn sm primary" id="boss-add">＋ Summon a Boss</button></h2>
        <div class="card-sub">Turn a scary project into a monster. Every sub-task you finish deals damage.</div>
        <div id="boss-list"></div>
      </div>

      <div class="card">
        <h2>🛡️ Guild — Party vs the Procrastination Monster</h2>
        <div class="card-sub">Team up (IRL friends — log their focus honestly!). Combined focus minutes slay the shared monster.</div>
        <div id="party-wrap"></div>
      </div>`;

    // skills
    const sl = $("#skill-list");
    Store.s.skills.forEach(sk => {
      const info = Game.skillLevel(sk);
      const row = el("div", "skill-row");
      row.innerHTML = `
        <div class="skill-icon">${sk.icon}</div>
        <div class="skill-body">
          <div class="skill-name"><span>${esc(sk.name)}</span><span>Lv ${info.level} · ${info.into}/${info.need} XP</span></div>
          <div class="skill-bar"><i style="width:${info.pct * 100}%"></i></div>
        </div>`;
      sl.appendChild(row);
    });
    $("#skill-add").onclick = () => {
      modal("🌳 New Skill", `
        <label class="field"><span>Skill name</span><input type="text" id="sk-name" placeholder="Guitar"></label>
        <label class="field"><span>Emoji icon</span><input type="text" id="sk-icon" placeholder="🎸" maxlength="4"></label>`,
        [
          { label: "Cancel" },
          { label: "Plant it", cls: "primary", onClick: m => {
            const name = m.querySelector("#sk-name").value.trim();
            if (!name) return false;
            Game.addSkill(name, m.querySelector("#sk-icon").value.trim());
            renderSkills();
          }},
        ]);
    };

    // bosses
    const bl = $("#boss-list");
    if (!Store.s.bosses.length) bl.innerHTML = '<span class="muted">No bosses yet. That giant project you\'re dreading? Perfect candidate.</span>';
    Store.s.bosses.slice().reverse().forEach(b => {
      const done = b.subs.filter(s => s.done).length;
      const hp = 100 - Math.round(done / b.subs.length * 100);
      const card = el("div", "boss-card");
      card.innerHTML = `
        <div class="boss-head">
          <span class="boss-emoji">${b.defeated ? "💀" : b.emoji}</span>
          <div style="flex:1">
            <b>${esc(b.name)}</b>
            <div class="boss-hp" style="margin-top:6px"><i style="width:${hp}%"></i></div>
            <div class="muted" style="font-size:.72rem;margin-top:3px">${hp} / 100 HP · ${b.subs.length - done} sub-task(s) remaining</div>
          </div>
          <button class="icon-btn" data-boss-del="${b.id}">🗑</button>
        </div>
        ${b.defeated ? `<div class="boss-defeated">🏆 DEFEATED — ${new Date(b.defeatedAt).toLocaleDateString()}</div>` : ""}
        <div>${b.subs.map(s => `
          <div class="boss-sub ${s.done ? "done" : ""}">
            <input type="checkbox" ${s.done ? "checked" : ""} ${b.defeated || s.done ? "disabled" : ""} data-boss="${b.id}" data-sub="${s.id}">
            <span>${esc(s.name)}</span>
          </div>`).join("")}</div>`;
      bl.appendChild(card);
    });
    bl.querySelectorAll("input[data-boss]").forEach(cb => cb.onchange = () => {
      Game.hitBoss(cb.dataset.boss, +cb.dataset.sub);
      renderSkills();
    });
    bl.querySelectorAll("[data-boss-del]").forEach(b2 => b2.onclick = () => {
      Store.s.bosses = Store.s.bosses.filter(x => x.id !== b2.dataset.bossDel);
      Store.save(); renderSkills();
    });
    $("#boss-add").onclick = () => {
      modal("⚔️ Summon a Boss", `
        <label class="field"><span>Name the monster (your big scary project)</span>
          <input type="text" id="bs-name" placeholder="The History Essay of Doom"></label>
        <label class="field"><span>Its body parts — sub-tasks, one per line (each = damage you can deal)</span>
          <textarea id="bs-subs" placeholder="Research sources\nOutline\nWrite intro\nWrite body\nEdit & submit"></textarea></label>`,
        [
          { label: "Flee", },
          { label: "⚔️ SUMMON", cls: "primary", onClick: m => {
            const name = m.querySelector("#bs-name").value.trim();
            const subs = m.querySelector("#bs-subs").value.split("\n").map(s => s.trim()).filter(Boolean);
            if (!name || subs.length < 2) { toast("Name it and give it at least 2 parts", "bad"); return false; }
            Game.createBoss(name, subs);
            AudioFX.play("fail"); // ominous
            toast(`${name} has appeared! ⚔️`, "bad", 3500);
            renderSkills();
          }},
        ]);
    };

    // guild / party
    renderParty();
  }

  function renderParty() {
    const wrap = $("#party-wrap");
    const party = Store.s.party;
    if (!party) {
      wrap.innerHTML = `<button class="btn primary" id="party-create">🛡️ Found a Guild</button>`;
      $("#party-create").onclick = () => {
        modal("🛡️ Found a Guild", `
          <label class="field"><span>Guild name</span><input type="text" id="g-name" placeholder="The Deadline Slayers"></label>
          <label class="field"><span>Monster HP (total party focus minutes to win)</span><input type="number" id="g-hp" value="300"></label>`,
          [
            { label: "Cancel" },
            { label: "Found it", cls: "primary", onClick: m => {
              const name = m.querySelector("#g-name").value.trim() || "The Deadline Slayers";
              Store.s.party = {
                name, monsterHp: parseInt(m.querySelector("#g-hp").value, 10) || 300,
                members: [{ name: USER_NAME, mins: 0, isMe: true }],
                startFocus: Store.s.totalFocusMin,
              };
              Store.save(); renderSkills();
            }},
          ]);
      };
      return;
    }
    // my contribution auto-syncs from total focus since founding
    const me = party.members.find(m => m.isMe);
    me.mins = Store.s.totalFocusMin - party.startFocus;
    const total = party.members.reduce((a, m) => a + m.mins, 0);
    const hpLeft = Math.max(0, party.monsterHp - total);
    const pct = Math.max(0, 100 - Math.round(total / party.monsterHp * 100));

    wrap.innerHTML = `
      <div class="boss-head">
        <span class="boss-emoji">${hpLeft <= 0 ? "💀" : "🦥"}</span>
        <div style="flex:1">
          <b>${esc(party.name)}</b> vs <b>The Procrastination Monster</b>
          <div class="boss-hp" style="margin-top:6px"><i style="width:${pct}%"></i></div>
          <div class="muted" style="font-size:.72rem;margin-top:3px">${hpLeft} focus-minutes of HP left (total needed: ${party.monsterHp})</div>
        </div>
      </div>
      ${hpLeft <= 0 ? `<div class="boss-defeated">🏆 The Monster is DEAD. Your guild's combined focus destroyed it!</div>` : ""}
      <div style="margin-top:8px">
        ${party.members.map((m, i) => `<div class="stat-line"><span>${m.isMe ? "⭐ " : "👤 "}${esc(m.name)}</span><b>${m.mins} min ${m.isMe ? "(auto-synced)" : ""}</b></div>`).join("")}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn sm" id="party-addm">＋ Add member</button>
        <button class="btn sm" id="party-log">📝 Log a friend's focus</button>
        <button class="btn sm danger" id="party-disband">Disband</button>
      </div>`;

    if (hpLeft <= 0 && !party.celebrated) {
      party.celebrated = true; Store.save();
      UI.celebrateMilestone("party_" + party.name, "🏆 Guild Victory!",
        `Aarush, ${party.name} pooled ${total} minutes of pure focus and slew the Procrastination Monster. Legendary teamwork.`, "🛡️");
    }

    $("#party-addm").onclick = () => {
      const name = prompt("Friend's name:");
      if (name) { party.members.push({ name, mins: 0 }); Store.save(); renderSkills(); }
    };
    $("#party-log").onclick = () => {
      const others = party.members.filter(m => !m.isMe);
      if (!others.length) { toast("Add a member first"); return; }
      modal("📝 Log friend's focus", `
        <label class="field"><span>Who</span><select id="pl-who">${others.map((m, i) => `<option value="${i}">${esc(m.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Minutes they focused (honor system!)</span><input type="number" id="pl-min" value="25"></label>`,
        [
          { label: "Cancel" },
          { label: "Log it", cls: "primary", onClick: m => {
            others[+m.querySelector("#pl-who").value].mins += parseInt(m.querySelector("#pl-min").value, 10) || 0;
            Store.save(); renderSkills();
          }},
        ]);
    };
    $("#party-disband").onclick = () => { Store.s.party = null; Store.save(); renderSkills(); };
  }

  /* ============ SHOP & AVATAR ============ */
  function renderShop() {
    const v = $("#view-shop");
    const eq = Store.s.equipped;
    const skin = Game.shopItem(eq.skin), pet = Game.shopItem(eq.pet);
    const sections = [["skin", "🎭 Skins"], ["pet", "🐾 Pets"], ["reward", "🎁 Real-Life Rewards"], ["upgrade", "🧬 Permanent Upgrades"], ["consumable", "🧪 Consumables"]];

    v.innerHTML = `
      <div class="avatar-stage">
        <div class="zone-label">Your Avatar</div>
        <div class="avatar-big">
          ${skin ? skin.icon : "🙂"}
          ${pet ? `<span class="avatar-pet-big">${pet.icon}</span>` : ""}
        </div>
        <p style="margin-top:10px"><b>${USER_NAME}</b> · Level ${Game.level().level} ${Store.s.prestige ? `· Prestige ${Store.s.prestige}` : ""}</p>
        <p class="muted" style="font-size:.8rem">🪙 ${Store.s.coins} coins · earn more by focusing & finishing tasks</p>
      </div>
      ${sections.map(([type, label]) => `
        <div class="card">
          <h2>${label}${type === "reward" ? `<span class="spacer"></span><button class="btn sm" id="add-reward-btn">＋ Add custom reward</button>` : ""}</h2>
          ${type === "reward" ? `<div class="card-sub">Buy the built-in rewards, or design your own real-life reward permissions below.</div>` : ""}
          <div class="shop-grid">
            ${Game.SHOP.filter(i => i.type === type).concat(type === "reward" ? (Store.s.customRewards || []) : []).map(i => {
              const owned = Store.s.shopOwned.includes(i.id);
              const equipped = eq[i.type] === i.id;
              return `<div class="shop-item ${owned ? "owned" : ""} ${equipped ? "equipped" : ""} ${i.custom ? "custom-reward" : ""}">
                ${i.custom ? `<button class="s-remove" data-remove-reward="${i.id}" title="Delete this custom reward">✕</button>` : ""}
                <span class="s-icon">${i.icon}</span><b>${esc(i.name)}</b>
                <div class="s-price">${i.price === 0 ? "free" : i.price + " 🪙"}</div>
                <button class="btn sm ${owned ? "" : "primary"}" data-buy="${i.id}" ${type === "upgrade" && owned ? "disabled" : ""}>
                  ${type === "reward" ? "Redeem" : type === "consumable" ? "Buy" : type === "upgrade" ? (owned ? "Owned ✓" : "Unlock") : equipped ? "Unequip" : owned ? "Equip" : "Buy"}
                </button>
              </div>`;
            }).join("")}
          </div>
        </div>`).join("")}`;

    v.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => Game.buy(b.dataset.buy));
    v.querySelectorAll("[data-remove-reward]").forEach(b => b.onclick = e => {
      e.stopPropagation();
      Game.removeCustomReward(b.dataset.removeReward);
      renderShop();
    });
    $("#add-reward-btn").onclick = openCustomRewardModal;
  }

  function openCustomRewardModal() {
    UI.modal("🎁 Design a Custom Reward", `
      <p class="muted" style="font-size:.82rem;margin-bottom:12px">Whatever actually motivates you — a real permission you "buy" with coins you earned through focus.</p>
      <label class="field"><span>Icon (emoji)</span><input type="text" id="cr-icon" maxlength="4" placeholder="🎮" value="🎮"></label>
      <label class="field"><span>Name</span><input type="text" id="cr-name" maxlength="60" placeholder="1 hour of gaming, guilt-free"></label>
      <label class="field"><span>Price (coins)</span><input type="number" id="cr-price" min="1" max="100000" value="500"></label>`,
      [
        { label: "Cancel" },
        { label: "🎁 Create reward", cls: "primary", onClick: m => {
          const name = m.querySelector("#cr-name").value.trim();
          if (!name) { toast("Give your reward a name.", "bad"); return false; }
          const icon = m.querySelector("#cr-icon").value.trim() || "🎁";
          const price = parseInt(m.querySelector("#cr-price").value, 10) || 100;
          Game.addCustomReward({ icon, name, price });
          toast(`🎁 "${name}" added to your rewards shelf`, "gold");
          renderShop();
        }},
      ], { sticky: true });
  }

  /* ============ SETTINGS ============ */
  function renderSettings() {
    const v = $("#view-settings");
    const s = Store.s.settings;
    const profiles = ["School", "Hobbies", "Life"];

    v.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h2>🗂️ Context Profiles</h2>
          <div class="card-sub">Separate dashboards with separate tasks, XP and stats.</div>
          <div style="display:flex;gap:8px">
            ${profiles.map(p => `<button class="btn ${Store.profile === p ? "primary" : ""}" data-prof="${p}">${p}</button>`).join("")}
          </div>
        </div>
        <div class="card">
          <h2>✦ Identity Anchor</h2>
          <div class="card-sub">The banner at the top of every page.</div>
          <button class="btn" id="set-identity">Edit: "${esc(s.identity)}"</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>🎨 Appearance</h2>
          <label class="field"><span>Theme</span>
            <select id="set-theme">
              <option value="dark" ${s.themeMode !== "minimal" ? "selected" : ""}>🌌 Dark</option>
              <option value="minimal" ${s.themeMode === "minimal" ? "selected" : ""}>☁️ Minimal (clean & light)</option>
            </select></label>
          <label class="check"><input type="checkbox" id="set-winddown" ${s.autoWinddown !== false ? "checked" : ""}> 🌙 Auto amber wind-down theme near bedtime (hr ${s.bedtimeHour})</label>
          <label class="field"><span>Font</span>
            <select id="set-font">
              <option value="default" ${s.font === "default" ? "selected" : ""}>Default (clean sans)</option>
              <option value="mono" ${s.font === "mono" ? "selected" : ""}>Monospace (high focus)</option>
              <option value="dyslexic" ${s.font === "dyslexic" ? "selected" : ""}>Dyslexia-friendly</option>
            </select></label>
          <label class="field"><span>Ambient background</span>
            <select id="set-bg">
              ${["none", "rain", "space", "cozy"].map(b => `<option ${s.videoBg === b ? "selected" : ""}>${b}</option>`).join("")}
            </select></label>
          <label class="check"><input type="checkbox" id="set-anim" ${s.animations ? "checked" : ""}> Animations & visual pulses (turn off if distracting)</label>
          <label class="check" style="margin-top:10px"><input type="checkbox" id="set-shortcuts" ${s.shortcutsEnabled !== false ? "checked" : ""}> ⌨️ Enable keyboard shortcuts (1–9, z, n, space…)</label>
          <p class="muted" style="font-size:.72rem;margin-top:4px">Ctrl/Cmd+K search always works. Shortcuts never fire while typing in notes, journal, tasks, or brain dump.</p>
          ${Store.s.shopOwned.includes("cos_accent")
            ? `<label class="field"><span>🎨 Custom accent color (unlocked!)</span>
                 <div style="display:flex;gap:8px;align-items:center">
                   <input type="color" id="set-accent" value="${s.accentColor || "#6d7cff"}" style="max-width:70px">
                   <button class="btn sm" id="set-accent-reset">Reset to default</button>
                 </div></label>`
            : `<p class="muted" style="font-size:.72rem">🎨 Custom accent color: unlock in the Shop (1500 🪙)</p>`}
        </div>
        <div class="card">
          <h2>🔊 Sound</h2>
          <label class="check"><input type="checkbox" id="set-sound" ${s.sound ? "checked" : ""}> Sound effects</label>
          <label class="field"><span>SFX pack</span>
            <select id="set-pack">
              <option value="minimal" ${s.sfxPack !== "8bit" && s.sfxPack !== "scifi" && s.sfxPack !== "anime" ? "selected" : ""}>Minimal ticks</option>
              <option value="8bit" ${s.sfxPack === "8bit" ? "selected" : ""}>🕹️ 8-bit retro</option>
              <option value="scifi" ${s.sfxPack === "scifi" ? "selected" : ""}>🛸 Sci-fi</option>
              <option value="anime" ${s.sfxPack === "anime" ? "selected" : ""}>🌸 Anime chimes</option>
            </select></label>
          <button class="btn sm" id="set-testsfx">▶ Test the pack</button>
          <div style="margin-top:14px">
            <label class="check"><input type="checkbox" id="set-posture" ${s.postureReminders ? "checked" : ""}> 🪑 Posture reminders (every 45 min)</label>
            <label class="check"><input type="checkbox" id="set-screen" ${s.screenTimeWarn ? "checked" : ""}> 🖥️ Screen-time warnings</label>
            <button class="btn sm" id="set-notif">🔔 Enable desktop notifications</button>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>🧑‍🎨 Custom CSS</h2>
        <div class="card-sub">Power users: style DialedIn however you want. Applied live.</div>
        <textarea id="set-css" style="font-family:var(--font-mono);font-size:.78rem" placeholder=".zone-now { border: 2px solid hotpink; }">${esc(s.customCSS)}</textarea>
      </div>`;

    v.querySelectorAll("[data-prof]").forEach(b => b.onclick = () => {
      Store.switchProfile(b.dataset.prof);
      toast(`Switched to ${b.dataset.prof} profile`, "", 2600, { key: "profile-switch" });
      UI.applyTheme(); UI.refreshAll();
      renderSettings();
    });
    $("#set-identity").onclick = Psych.editIdentity;
    $("#set-theme").onchange = e => UI.setThemeMode(e.target.value);
    $("#set-shortcuts").onchange = e => {
      s.shortcutsEnabled = e.target.checked;
      Store.save();
      toast(s.shortcutsEnabled ? "⌨️ Keyboard shortcuts on" : "⌨️ Keyboard shortcuts off", "", 2200, { key: "shortcuts-toggle" });
    };
    $("#set-winddown").onchange = e => { s.autoWinddown = e.target.checked; Store.save(); UI.applyTheme(); };
    $("#set-font").onchange = e => { s.font = e.target.value; Store.save(); UI.applyTheme(); };
    $("#set-bg").onchange = e => { s.videoBg = e.target.value; Store.save(); UI.applyTheme(); };
    $("#set-anim").onchange = e => { s.animations = e.target.checked; Store.save(); UI.applyTheme(); };
    $("#set-sound").onchange = e => { s.sound = e.target.checked; Store.save(); };
    $("#set-pack").onchange = e => { s.sfxPack = e.target.value; Store.save(); AudioFX.play("levelup"); };
    $("#set-testsfx").onclick = () => AudioFX.play("levelup");
    $("#set-posture").onchange = e => { s.postureReminders = e.target.checked; Store.save(); };
    $("#set-screen").onchange = e => { s.screenTimeWarn = e.target.checked; Store.save(); };
    $("#set-notif").onclick = () => {
      if ("Notification" in window) Notification.requestPermission().then(p => toast(p === "granted" ? "🔔 Notifications on" : "Notifications blocked"));
    };
    $("#set-css").oninput = e => { s.customCSS = e.target.value; Store.save(); UI.applyTheme(); };
    const accentInp = $("#set-accent");
    if (accentInp) {
      accentInp.oninput = e => { s.accentColor = e.target.value; Store.save(); UI.applyTheme(); };
      $("#set-accent-reset").onclick = () => { s.accentColor = null; Store.save(); UI.applyTheme(); renderSettings(); };
    }
  }

  /* ============ BOOT ============ */
  function init() {
    // register views
    UI.registerView("dashboard", renderDashboard);
    UI.registerView("tasks", () => Tasks.renderTasksView());
    UI.registerView("timebox", () => Tasks.renderTimeboxView());
    UI.registerView("quests", renderQuests);
    UI.registerView("skills", renderSkills);
    UI.registerView("shop", renderShop);
    UI.registerView("notes", () => Notes.render());
    UI.registerView("journal", () => Notes.renderJournal());
    UI.registerView("braindump", () => Psych.renderBrainDump());
    UI.registerView("analytics", () => Analytics.render());
    UI.registerView("wellness", () => Wellness.render());
    UI.registerView("srs", () => SRS.render());
    UI.registerView("automation", () => Automation.render());
    UI.registerView("settings", renderSettings);
    UI.registerView("excel", () => Excel.renderView());
    UI.registerView("district", () => District.renderView());

    // nav
    UI.mountIcons();
    document.querySelectorAll(".nav-item").forEach(n => n.onclick = () => UI.showView(n.dataset.view));
    document.querySelectorAll(".nav-group-head").forEach(h => h.onclick = () => {
      const items = h.parentElement.querySelector(".nav-group-items");
      items.classList.toggle("collapsed");
      h.classList.toggle("collapsed", items.classList.contains("collapsed"));
    });
    document.getElementById("sidebar-collapse").onclick = UI.toggleSidebar;
    if (Store.s.settings.sidebarCollapsed) UI.toggleSidebar();

    // topbar
    document.getElementById("zen-btn").onclick = () => UI.toggleMinimalMode();
    document.getElementById("zen-exit").onclick = UI.exitZen;
    document.getElementById("media-guard-btn").onclick = Psych.mediaGuard;
    document.getElementById("cmd-palette-btn").onclick = UI.openCommandPalette;
    document.getElementById("shortcut-btn").onclick = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
    document.getElementById("tour-btn").onclick = UI.startTour;
    document.getElementById("sound-toggle").onclick = () => {
      Store.s.settings.sound = !Store.s.settings.sound;
      Store.save();
      document.getElementById("sound-toggle").classList.toggle("muted-icon", !Store.s.settings.sound);
      toast(Store.s.settings.sound ? "Sound on" : "Sound off", "", 2600, { key: "sound-toggle" });
    };
    document.getElementById("sound-toggle").classList.toggle("muted-icon", !Store.s.settings.sound);
    document.getElementById("theme-cycle").onclick = () => {
      UI.setThemeMode(Store.s.settings.themeMode === "minimal" ? "dark" : "minimal");
      toast("Theme: " + (Store.s.settings.themeMode === "minimal" ? "☁️ Minimal" : "🌌 Dark"), "", 2600, { key: "theme-cycle" });
    };
    document.getElementById("identity-banner").onclick = Psych.editIdentity;

    if (typeof Undo !== "undefined") Undo.init();
    UI.initScratchpad();
    UI.initShortcuts();
    UI.initQuickBar();
    UI.applyTheme();
    UI.refreshGreeting();
    UI.refreshIdentity();

    // daily systems
    Game.ensureDailyQuests();
    Tasks.housekeeping();
    UI.refreshChips();
    UI.showView("dashboard");

    // sidebar mini timer readout — always live, independent of which view is mounted
    Timer.renderChrome();
    document.getElementById("side-timer").onclick = UI.enterZen;

    // Milestone reminders fire first — before the Focus Session takes over the whole screen,
    // so a due "remind me" date is never buried once you're locked into a session.
    checkMilestoneReminders();

    // Launch straight into the fullscreen Focus Session — the app opens on
    // the timer, not the dashboard. Dismiss with ✕/Esc to reach the rest of the app.
    UI.enterZen();

    // periodic refresh: greeting, theme (dynamic), rules, focus hours
    setInterval(() => {
      UI.refreshGreeting();
      UI.applyTheme(); // re-evaluates wind-down window near bedtime
      Automation.checkRules();
      Automation.checkFocusHours();
    }, 60000);
    Automation.checkFocusHours();

    Wellness.startLoops();
    initSpotify();

    // morning pre-commitment popup (after slight delay so the app paints first)
    setTimeout(() => Psych.preCommitCheck(), 900);

    // first-visit welcome
    if (!localStorage.getItem("focusquest_welcomed")) {
      localStorage.setItem("focusquest_welcomed", "1");
      setTimeout(() => UI.congrats(`Welcome to DialedIn, ${USER_NAME}! ⚔️`,
        "Your productivity is now an RPG. Earn XP by focusing, defeat project Bosses, keep your streak alive — and spend coins on real rewards. Press ? anytime for shortcuts.", "🗺️"), 1600);
    }
  }

  function initSpotify() {
    const toggleBtn = document.getElementById("spotify-toggle");
    const body = document.getElementById("spotify-body");
    const caret = document.getElementById("spotify-caret-icon");
    const select = document.getElementById("spotify-playlist-select");
    const customGroup = document.getElementById("spotify-custom-url-group");
    const customInput = document.getElementById("spotify-custom-input");
    const customLoadBtn = document.getElementById("spotify-custom-load-btn");
    const iframe = document.getElementById("spotify-player-iframe");

    if (!toggleBtn || !body) return;

    // 1. Toggle collapse state
    let collapsed = localStorage.getItem("spotify_widget_collapsed") === "true";
    const updateCollapse = () => {
      body.style.display = collapsed ? "none" : "block";
      caret.style.transform = collapsed ? "rotate(180deg)" : "rotate(0deg)";
    };
    toggleBtn.onclick = () => {
      collapsed = !collapsed;
      localStorage.setItem("spotify_widget_collapsed", collapsed);
      updateCollapse();
    };
    updateCollapse();

    // Size Selection Controls
    const btnCompact = document.getElementById("btn-spotify-compact");
    const btnMid = document.getElementById("btn-spotify-mid");
    const btnLarge = document.getElementById("btn-spotify-large");
    const holder = document.getElementById("spotify-iframe-holder");

    const setPlayerSize = (size) => {
      let h = 152;
      btnCompact?.classList.remove("primary");
      btnMid?.classList.remove("primary");
      btnLarge?.classList.remove("primary");

      if (size === "compact") {
        h = 80;
        btnCompact?.classList.add("primary");
      } else if (size === "mid") {
        h = 152;
        btnMid?.classList.add("primary");
      } else if (size === "large") {
        h = 352;
        btnLarge?.classList.add("primary");
      }
      if (holder) holder.style.height = `${h}px`;
      if (iframe) iframe.setAttribute("height", h);
      localStorage.setItem("spotify_player_size", size);
    };

    if (btnCompact) btnCompact.onclick = () => setPlayerSize("compact");
    if (btnMid) btnMid.onclick = () => setPlayerSize("mid");
    if (btnLarge) btnLarge.onclick = () => setPlayerSize("large");

    // Load saved size
    const savedSize = localStorage.getItem("spotify_player_size") || "mid";
    setPlayerSize(savedSize);

    // 2. Load saved playlist URL
    const savedUrl = Store.s.settings.spotifyUrl || "https://open.spotify.com/embed/playlist/37i9dQZF1DX8UebhpvM97p";
    if (iframe) {
      iframe.src = savedUrl;
    }

    // Attempt to set matching select value
    let found = false;
    for (let i = 0; i < select.options.length; i++) {
      if (savedUrl.includes(select.options[i].value)) {
        select.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found && savedUrl) {
      select.value = "custom";
      customGroup.style.display = "flex";
      customInput.value = savedUrl;
    }

    // 3. Select playlist action
    select.onchange = () => {
      if (select.value === "custom") {
        customGroup.style.display = "flex";
      } else {
        customGroup.style.display = "none";
        const embedUrl = select.value + "?utm_source=generator&theme=0";
        if (iframe) iframe.src = embedUrl;
        Store.s.settings.spotifyUrl = embedUrl;
        Store.save();
        toast("🎶 Switched Focus Playlist");
      }
    };

    // Helper to extract embed url
    function getSpotifyEmbedUrl(url) {
      if (!url) return "";
      url = url.trim();
      if (url.includes("/embed/")) return url;
      if (url.startsWith("<iframe")) {
        const m = url.match(/src="([^"]+)"/);
        if (m) return m[1];
      }
      const matches = url.match(/open\.spotify\.com\/(playlist|album|track|artist)\/([a-zA-Z0-9]+)/);
      if (matches) {
        const type = matches[1];
        const id = matches[2];
        return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
      }
      return "";
    }

    // Custom URL load button
    customLoadBtn.onclick = () => {
      const val = customInput.value.trim();
      const embed = getSpotifyEmbedUrl(val);
      if (embed) {
        if (iframe) iframe.src = embed;
        Store.s.settings.spotifyUrl = embed;
        Store.save();
        toast("🎶 Loaded custom Spotify playlist!");
      } else {
        toast("❌ Invalid Spotify URL. Paste a playlist, album, or track link.", "bad");
      }
    };
  }

  document.addEventListener("DOMContentLoaded", init);

  return { renderDashboard, renderQuests, renderSkills, renderShop, renderSettings };
})();
