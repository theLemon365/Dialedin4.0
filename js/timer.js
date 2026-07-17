/* ==========================================================
   timer.js — smart pomodoro, stopwatch, just-5-min, strict,
              visual ring, overtime, breaks, lockout
   ========================================================== */
"use strict";

const Timer = (() => {
  const { $, el, esc, toast, modal } = UI;

  const state = {
    mode: "pomodoro",       // pomodoro | stopwatch | five
    phase: "idle",          // idle | work | break | overtime
    running: false, paused: false,
    startTs: 0, pausedAt: 0, pausedTotal: 0,
    durationSec: 0,
    minutesCredited: 0,
    overtimeStart: 0,
    tick: null,

    // Productivity enhancements
    sessionTitle: "",
    secondsInWorkMode: 0,
    eyeStrainCountdown: 0,
    eyeStrainActive: false,
    sessionPausedTime: 0,
  };

  const BREAK_IDEAS = [
    "🚰 Get a glass of water and drink all of it",
    "🙆 Reach up high, then touch your toes — 5 slow reps",
    "🫁 Box breathing: 4s in, 4s hold, 4s out, 4s hold — ×4",
    "🪟 Look out a window at something 20+ feet away for 20s",
    "🚶 Walk one lap around your room or house",
    "🧹 Clear exactly 3 items off your desk",
    "💪 10 wall push-ups or squats",
    "👀 Close your eyes and slowly roll them — eye strain reset",
    "🌤️ Step outside for 60 seconds of fresh air",
    "🧊 Splash cold water on your face",
  ];

  /* ---------- Pomodoro ---------- */
  function elapsedSec() {
    if (!state.running) return 0;
    const pausedExtra = state.paused ? (Date.now() - state.pausedAt) : 0;
    return Math.floor((Date.now() - state.startTs - state.pausedTotal - pausedExtra) / 1000);
  }

  function remainingSec() {
    return Math.max(0, state.durationSec - elapsedSec());
  }

  function displayTime() {
    let s;
    if (!state.running) s = (Store.s.pomo.work * 60);
    else if (state.mode === "stopwatch" || state.phase === "overtime") s = state.phase === "overtime" ? Math.floor((Date.now() - state.overtimeStart) / 1000) : elapsedSec();
    else s = remainingSec();
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function start(mode = "pomodoro") {
    const t = Tasks.nowTask();
    if (mode !== "stopwatch" && t && !t.commitment) { Psych.commitmentWall(t, () => reallyStart(mode)); return; }
    reallyStart(mode);
  }

  function reallyStart(mode) {
    if (state.running) return;
    state.mode = mode;
    state.phase = "work";
    state.running = true; state.paused = false;
    state.startTs = Date.now(); state.pausedTotal = 0;
    state.minutesCredited = 0;
    state.durationSec = mode === "five" ? 5 * 60 : mode === "stopwatch" ? 0 : Store.s.pomo.work * 60;

    // Capture custom session title
    const titleIn = document.getElementById("session-title-input");
    state.sessionTitle = titleIn ? titleIn.value.trim() : "";
    state.secondsInWorkMode = 0;
    state.eyeStrainCountdown = 0;
    state.eyeStrainActive = false;
    state.sessionPausedTime = 0;

    AudioFX.play("start");
    Store.day().sessions++;
    if (mode === "five") toast("🚪 Just 5 minutes. That's the whole deal. Go.", "xp");
    startTick();
    renderPulse();
    UI.updateZen();
    document.querySelector(".zone-now")?.classList.add("pulsing");
  }

  function startTick() {
    clearInterval(state.tick);
    state.tick = setInterval(onTick, 1000);
  }

  function onTick() {
    if (!state.running) return;

    // 20-20-20 Eye Strain Break countdown ticking
    if (state.eyeStrainActive) {
      state.eyeStrainCountdown--;
      updateEyeStrainOverlay();
      if (state.eyeStrainCountdown <= 0) {
        state.eyeStrainActive = false;
        state.paused = false;
        state.pausedTotal += 20000; // offset the 20 seconds
        AudioFX.play("start");
        hideEyeStrainOverlay();
        toast("👁️ 20-20-20 Eye Break complete! Resuming focus session.", "good");
      }
      return;
    }

    if (state.paused) return;

    const el = elapsedSec();
    // credit focused minutes as they accrue (work phase only)
    if (state.phase === "work" || state.phase === "overtime") {
      const mins = Math.floor(el / 60) + (state.phase === "overtime" ? state.minutesCredited : 0);
      while (state.minutesCredited < Math.floor(el / 60)) {
        state.minutesCredited++;
        const t = Tasks.nowTask();
        Game.onFocusMinutes(1, t?.skill || null, t?.id || null);
        Store.s.focusBlocks++;
      }

      // Check 20-20-20 Rule seconds
      if (Store.s.pomo.rule202020 && state.phase === "work") {
        state.secondsInWorkMode++;
        if (state.secondsInWorkMode >= 1200) { // 20 mins
          trigger202020Break();
          return;
        }
      }
    }

    if (state.mode !== "stopwatch" && state.phase === "work" && remainingSec() <= 0) {
      onWorkComplete();
    }
    if (state.phase === "break" && remainingSec() <= 0) {
      endBreak();
    }
    if (state.phase === "overtime") {
      // credit overtime minutes
      const otMin = Math.floor((Date.now() - state.overtimeStart) / 60000);
      if (otMin > (state.otCredited || 0)) {
        state.otCredited = otMin;
        Store.s.overtimeTotal++;
        const t = Tasks.nowTask();
        Game.onFocusMinutes(1, t?.skill || null, t?.id || null);
      }
    }
    renderPulse();
    UI.updateZen();
  }

  function trigger202020Break() {
    state.paused = true;
    state.pausedAt = Date.now();
    state.secondsInWorkMode = 0;
    state.eyeStrainCountdown = 20;
    state.eyeStrainActive = true;
    AudioFX.play("fail");

    let overlay = document.getElementById("eye-strain-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "eye-strain-overlay";
      overlay.className = "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 text-center p-6";
      document.body.appendChild(overlay);
    }
    overlay.classList.remove("hidden");
    updateEyeStrainOverlay();
  }

  function updateEyeStrainOverlay() {
    const overlay = document.getElementById("eye-strain-overlay");
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="max-w-md p-8 bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl animate-pulse" id="eye-strain-content">
        <div class="text-emerald-400 text-6xl mb-4">👁️</div>
        <h2 class="text-2xl font-bold text-white mb-2">20-20-20 Eye Strain Break</h2>
        <p class="text-slate-300 text-sm mb-6 leading-relaxed">
          Look away at an object at least <strong>20 feet away</strong> for the next 20 seconds to prevent digital eye strain and micro-fatigue.
        </p>
        <div class="relative w-32 h-32 mx-auto flex items-center justify-center">
          <svg class="absolute inset-0 w-full h-full transform -rotate-90">
            <circle cx="64" cy="64" r="54" stroke="rgba(255,255,255,0.05)" stroke-width="8" fill="transparent"/>
            <circle cx="64" cy="64" r="54" stroke="#10b981" stroke-width="8" fill="transparent"
              stroke-dasharray="339.292" stroke-dashoffset="${339.292 * (1 - state.eyeStrainCountdown / 20)}"/>
          </svg>
          <span class="text-3xl font-extrabold text-white">${state.eyeStrainCountdown}s</span>
        </div>
        <button class="mt-8 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
          id="skip-eye-break-btn">Skip Break</button>
      </div>
    `;
    const skipBtn = overlay.querySelector("#skip-eye-break-btn");
    if (skipBtn) {
      skipBtn.onclick = () => {
        state.eyeStrainActive = false;
        state.paused = false;
        state.pausedTotal += (20 - state.eyeStrainCountdown) * 1000;
        AudioFX.play("start");
        hideEyeStrainOverlay();
        toast("Eye strain break skipped.", "xp");
      };
    }
  }

  function hideEyeStrainOverlay() {
    const overlay = document.getElementById("eye-strain-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  function onWorkComplete() {
    AudioFX.play("complete");
    Store.day(); // ensure
    Store.s.sessionsCompleted++;
    Game.questProgress("sessions", 1);
    const scale = Game.earnScale();
    Game.addXP(Math.max(5, Math.round(30 * scale)), Tasks.nowTask()?.skill || null);
    Game.addCoins(Math.max(2, Math.round(10 * scale)), true);

    if (state.mode === "five") {
      state.running = false; state.phase = "idle"; clearInterval(state.tick);
      modal("🚪 5 minutes done — resistance broken!", `
        <p>Aarush, you did the hard part: <b>you started.</b></p>
        <p class="muted" style="margin-top:8px">Motivation follows action, not the other way around. Ride the momentum?</p>`,
        [
          { label: "😌 Stop here (still a win)", onClick: () => renderPulse() },
          { label: "🔥 Keep going — full session", cls: "primary", onClick: () => { reallyStart("pomodoro"); } },
        ]);
      renderPulse();
      return;
    }

    // enter overtime instead of hard stop
    state.phase = "overtime";
    state.overtimeStart = Date.now();
    state.otCredited = 0;
    
    // Drop building block onto the NYC Focus District grid
    if (typeof District !== "undefined") {
      const mins = Store.s.pomo.work || 25;
      const tk = Tasks.nowTask();
      const bTitle = state.sessionTitle || (tk ? tk.title : "Focus Block");
      District.addFocusBuilding(mins, bTitle);
    }

    toast("⏰ Session complete! Now in OVERTIME — every extra minute is tracked & counted.", "gold", 5000);
    notify("Pomodoro complete!", "Take a break, or keep riding the overtime wave.");
  }

  function takeBreak() {
    clearInterval(state.tick);
    state.phase = "break";
    state.running = true; state.paused = false;
    state.startTs = Date.now(); state.pausedTotal = 0;
    state.durationSec = Store.s.pomo.brk * 60;
    const idea = BREAK_IDEAS[Math.floor(Math.random() * BREAK_IDEAS.length)];
    modal("☕ Break time", `
      <p style="font-size:1.05rem;margin-bottom:8px">${idea}</p>
      <p class="muted">Break: ${Store.s.pomo.brk} min. Also — blink slowly a few times. Your eyes will thank you. 👁️</p>`,
      [{ label: "Got it", cls: "primary" }]);
    startTick(); renderPulse();
  }

  function endBreak() {
    AudioFX.play("start");
    state.running = false; state.phase = "idle"; clearInterval(state.tick);
    toast("Break over — ready for the next round?", "xp");
    notify("Break over", "Ready for the next focus round?");
    renderPulse();
  }

  function togglePause() {
    if (!state.running) return;
    if (Store.s.pomo.strict && state.phase === "work") {
      toast("🔒 Strict Mode: no pausing. You chose this. Finish.", "bad");
      AudioFX.play("fail");
      return;
    }
    if (state.paused) { 
      const pausedDuration = Date.now() - state.pausedAt;
      state.pausedTotal += pausedDuration; 
      state.sessionPausedTime += pausedDuration;
      state.paused = false; 
    }
    else { 
      state.paused = true; 
      state.pausedAt = Date.now(); 
    }
    renderPulse(); UI.updateZen();
  }

  function stop(finished = false) {
    if (Store.s.pomo.strict && state.phase === "work" && !finished && remainingSec() > 0) {
      failSession();
      return;
    }

    if (state.paused) {
      state.sessionPausedTime += Date.now() - state.pausedAt;
    }

    // Log to Focus Ledger before stopping
    if (state.running && (state.phase === "work" || state.phase === "overtime")) {
      const elSec = elapsedSec();
      const elapsedMin = Math.round(elSec / 60);
      const lostMin = Math.round(state.sessionPausedTime / 60000);

      const defaultTitle = Tasks.nowTask() ? Tasks.nowTask().title : `Untitled #${Store.s.sessionsCompleted + 1}`;
      const title = state.sessionTitle || defaultTitle;
      const category = Tasks.nowTask() ? (Tasks.nowTask().skill || "General") : "General";

      if (elapsedMin >= 1) {
        Store.s.sessionHistory = Store.s.sessionHistory || [];
        Store.s.sessionHistory.push({
          ts: Date.now(),
          title: title,
          durationMin: elapsedMin,
          lostMin: lostMin,
          finished: finished,
          category: category
        });
        Store.save();
        toast(`💾 Focus Session recorded in ledger: "${title}" (${elapsedMin}m)`, "good");
      }
    }

    state.running = false; state.phase = "idle"; state.paused = false;
    clearInterval(state.tick);
    document.querySelector(".zone-now")?.classList.remove("pulsing");
    renderPulse(); UI.updateZen();
  }

  /* ---------- Fail session → Time Out lockout ---------- */
  function failSession() {
    modal("⚠️ Abandon strict session?", `
      <p>Strict Mode is on. Quitting counts as a <b>failed session</b> and locks the app for 15 minutes.</p>
      <p class="muted" style="margin-top:6px">Or… you could just finish. ${Math.ceil(remainingSec() / 60)} min left.</p>`,
      [
        { label: "💪 Keep going", cls: "primary" },
        { label: "Fail Session (15-min lockout)", cls: "danger", onClick: () => {
          const t = Tasks.nowTask();
          const elapsedMin = Math.floor(elapsedSec() / 60);
          const title = t ? t.title : `Untitled #${Store.s.sessionsCompleted + 1}`;
          
          Store.s.failedSessionsLog = Store.s.failedSessionsLog || [];
          Store.s.failedSessionsLog.push({
            ts: Date.now(),
            sessionNumber: Store.s.sessionsCompleted + 1,
            title,
            timeLostMins: elapsedMin || 1
          });
          
          state.running = false; state.phase = "idle"; clearInterval(state.tick);
          AudioFX.play("fail");
          
          if (typeof District !== "undefined") {
            District.markSectorOffline();
          }
          
          startLockout(15 * 60);
          renderPulse();
        }},
      ]);
  }

  function startLockout(seconds, opts = {}) {
    const ov = $("#lockout-overlay");
    $("#lockout-title").textContent = opts.title || "⏳ Time Out";
    $("#lockout-msg").textContent = opts.msg || "You failed a session. The app is locked so you can reset your mind.";
    $("#lockout-hint").textContent = opts.hint || "Stand up. Breathe. Drink water. Come back stronger.";
    ov.classList.remove("hidden");
    const end = Date.now() + seconds * 1000;
    const iv = setInterval(() => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      $("#lockout-timer").textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
      if (left <= 0) {
        clearInterval(iv); ov.classList.add("hidden");
        if (opts.onDone) opts.onDone(); else toast("Lockout over. Fresh start. 💙", "xp");
      }
    }, 500);
  }

  /* ---------- Mandatory Rest Break (burnout guard) ----------
     Gamifies recovery: completing the forced rest pays XP + coins. */
  function mandatoryRest(focusedMins, distractionSpike) {
    // pause whatever is running (bypasses strict mode — recovery outranks it)
    state.running = false; state.phase = "idle"; state.paused = false;
    clearInterval(state.tick);
    renderPulse(); UI.updateZen(); UI.exitZen();
    AudioFX.play("start");
    const why = distractionSpike >= 5
      ? `Your focus-to-distraction ratio is dropping fast (${distractionSpike} distractions this block). That's your brain waving a white flag.`
      : `You've focused ${focusedMins} minutes straight. Elite — but recovery is part of the training, not a break from it.`;
    startLockout(10 * 60, {
      title: "🛌 Mandatory Rest Break",
      msg: `${why} DialedIn is locked for 10 minutes.`,
      hint: "Walk. Water. Look out a window. Finishing this rest pays +60 XP and +25 coins — recovery is part of the game.",
      onDone: () => {
        Game.addXP(60, null, { noMult: true, silent: true });
        Game.addCoins(25, true);
        toast("🛌 Recovery complete: +60 XP, +25 🪙. THIS is how you avoid the week-three burnout wall.", "gold", 6000);
      },
    });
  }

  /* ---------- The Pulse (render) ---------- */
  function editSessionTitle(index) {
    const s = Store.s.sessionHistory[index];
    if (!s) return;
    const newTitle = prompt("Edit focus session title:", s.title);
    if (newTitle !== null) {
      s.title = newTitle.trim() || "Untitled Focus Session";
      Store.save();
      renderPulse();
      toast("Session title updated.", "xp");
    }
  }

  function deleteSession(index) {
    if (confirm("Are you sure you want to delete this focus session?")) {
      Store.s.sessionHistory.splice(index, 1);
      Store.save();
      renderPulse();
      toast("Session deleted from ledger.", "bad");
    }
  }

  function openManualLogModal() {
    modal("＋ Log Past Focus Session", `
      <div class="flex flex-col gap-3 text-left">
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Session Title</label>
          <input type="text" id="manual-log-title" class="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white" placeholder="e.g. Worked on database layer">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Focus Duration (mins)</label>
            <input type="number" id="manual-log-duration" class="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white" min="1" max="300" value="25">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-1">Lost / Paused Time (mins)</label>
            <input type="number" id="manual-log-lost" class="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white" min="0" max="120" value="0">
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-400 mb-1">Category / Skill</label>
          <select id="manual-log-category" class="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white">
            <option value="Coding">Coding / Tech</option>
            <option value="Writing">Writing</option>
            <option value="Design">Design</option>
            <option value="Health">Health / Mind</option>
            <option value="General">General / Administrative</option>
          </select>
        </div>
      </div>
    `, [
      { label: "Cancel" },
      { label: "Save to Ledger", cls: "primary", onClick: () => {
        const titleVal = document.getElementById("manual-log-title").value.trim() || "Manual Focus Session";
        const durationVal = Math.max(1, parseInt(document.getElementById("manual-log-duration").value, 10) || 25);
        const lostVal = Math.max(0, parseInt(document.getElementById("manual-log-lost").value, 10) || 0);
        const categoryVal = document.getElementById("manual-log-category").value;

        Store.s.sessionHistory = Store.s.sessionHistory || [];
        Store.s.sessionHistory.push({
          ts: Date.now(),
          title: titleVal,
          durationMin: durationVal,
          lostMin: lostVal,
          finished: true,
          category: categoryVal
        });

        // Award XP + Coins
        Store.s.focusBlocks += Math.floor(durationVal / 25) || 1;
        Game.addXP(Math.round(durationVal * 1.2), categoryVal);
        Game.addCoins(Math.round(durationVal * 0.4), true);

        // Add building to Focus District
        if (typeof District !== "undefined") {
          District.addFocusBuilding(durationVal, titleVal);
        }

        Store.save();
        renderPulse();
        toast("Manual focus session successfully logged!", "good");
      }}
    ]);
  }

  function pulseHTML() {
    const history = Store.s.sessionHistory || [];
    const recentHistory = history.slice(-5).reverse();
    const historyHTML = recentHistory.map((s, idx) => {
      const realIdx = history.length - 1 - idx;
      const dateStr = new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/40 text-xs mb-1.5 gap-2">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-slate-200 flex items-center gap-1">
              <span class="text-emerald-400">●</span> 
              <span class="truncate block" id="session-title-text-${realIdx}">${esc(s.title)}</span>
            </div>
            <div class="text-[10px] text-slate-400 flex items-center gap-2">
              <span>${dateStr}</span> • <span>${s.durationMin}m focused</span> • <span class="text-rose-400">${s.lostMin}m lost</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300" onclick="Timer.editSessionTitle(${realIdx})">✏️</button>
            <button class="px-1.5 py-0.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded text-[10px]" onclick="Timer.deleteSession(${realIdx})">✕</button>
          </div>
        </div>
      `;
    }).join("");

    const distractionsCount = Store.day().distracted || 0;
    const distractionsInsight = distractionsCount > 0 
      ? `🚨 Today: <strong>${distractionsCount}</strong> distraction events. Take deeper, scheduled breaks!`
      : `🌟 0 distractions logged today. Clean slate!`;

    return `
    <div class="pulse-wrap flex flex-col gap-3">
      <!-- Session Title input -->
      <div class="flex flex-col gap-1">
        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Session Title</label>
        <input type="text" id="session-title-input" class="w-full text-xs bg-slate-950 border border-slate-800/80 rounded px-2.5 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" placeholder="What are you focusing on right now?" value="${esc(state.sessionTitle || "")}" ${state.running ? "disabled" : ""}>
      </div>

      <div class="pulse-head">
        <div class="timer-mini" title="Click for a fullscreen Focus Session">
          <div class="timer-mini-row">
            <div class="timer-time" id="pulse-time">--:--</div>
            <div class="timer-phase" id="pulse-phase">ready</div>
          </div>
          <div class="timer-mini-bar"><i id="pulse-bar-fill"></i></div>
          <div class="timer-over" id="pulse-over"></div>
        </div>
        <div class="pulse-controls">
          <div class="timer-modes">
            <button class="mode-btn ${state.mode === "pomodoro" ? "active" : ""}" data-mode="pomodoro">Pomodoro</button>
            <button class="mode-btn ${state.mode === "stopwatch" ? "active" : ""}" data-mode="stopwatch">Stopwatch</button>
            <button class="mode-btn ${state.mode === "five" ? "active" : ""}" data-mode="five">Just 5 Minutes</button>
          </div>
          <div class="timer-actions" id="pulse-actions"></div>
        </div>
      </div>
      <div class="timer-opts">
        <label title="Session length in minutes">work <input type="number" id="opt-work" min="5" max="180" value="${Store.s.pomo.work}">m</label>
        <label title="Break length in minutes">break <input type="number" id="opt-brk" min="1" max="60" value="${Store.s.pomo.brk}">m</label>
        <label title="No pausing once started"><input type="checkbox" id="opt-strict" ${Store.s.pomo.strict ? "checked" : ""}> Strict</label>
        <label title="Trigger 20-second break every 20 minutes to prevent eye strain"><input type="checkbox" id="opt-rule202020" ${Store.s.pomo.rule202020 ? "checked" : ""}> 20-20-20 Rule</label>
        <button class="btn sm ghost" id="log-distraction" title="Self-report a distracted moment">I got distracted</button>
      </div>

      <!-- Past Sessions Ledger -->
      <div class="border-t border-slate-800/60 pt-3">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-semibold text-slate-300">Focus Ledger (Sessions)</h4>
          <button class="px-2 py-0.5 bg-purple-950/60 hover:bg-purple-900 text-purple-300 rounded text-[10px] font-medium border border-purple-800/30 transition-colors" id="btn-manual-log-session">＋ Log Past Session</button>
        </div>
        ${historyHTML ? `<div class="max-h-[140px] overflow-y-auto pr-1">${historyHTML}</div>` : `<p class="text-[11px] text-slate-500 italic">No focus sessions recorded in ledger yet.</p>`}
      </div>

      <!-- Distraction insights of the day -->
      <div class="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/10 text-[11px] text-slate-300 flex flex-col gap-1">
        <span class="font-semibold text-indigo-400">🧠 Cognitive Load Advisor</span>
        <span>${distractionsInsight}</span>
      </div>

      <details style="margin-top:2px">
        <summary style="cursor:pointer;font-size:.78rem;color:var(--muted)">Ambient Sound Mixer</summary>
        <div style="padding-top:10px">
          ${["white:White noise", "rain:Rain", "lofi:Lo-fi pad", "cafe:Cafe"].map(x => {
            const [id, name] = x.split(":");
            return `<div class="mixer-row"><span class="mix-name">${name}</span>
              <input type="range" min="0" max="100" value="0" data-mix="${id}"></div>`;
          }).join("")}
          <div class="muted" style="font-size:.72rem">Sounds are synthesized live — they stop when volume hits 0.</div>
        </div>
      </details>
    </div>`;
  }

  function bindPulse(container) {
    const ring = container.querySelector(".timer-mini");
    if (ring) ring.onclick = () => UI.enterZen();
    container.querySelectorAll(".mode-btn").forEach(b => b.onclick = () => {
      if (state.running) { toast("Finish or stop the current session first"); return; }
      state.mode = b.dataset.mode;
      container.querySelectorAll(".mode-btn").forEach(x => x.classList.toggle("active", x === b));
      renderPulse();
    });
    
    container.querySelector("#opt-strict").onchange = e => { Store.s.pomo.strict = e.target.checked; Store.save(); };
    
    const ruleCh = container.querySelector("#opt-rule202020");
    if (ruleCh) {
      ruleCh.onchange = e => { Store.s.pomo.rule202020 = e.target.checked; Store.save(); };
    }

    const titleIn = container.querySelector("#session-title-input");
    if (titleIn) {
      titleIn.oninput = e => { state.sessionTitle = e.target.value; };
    }

    const manualBtn = container.querySelector("#btn-manual-log-session");
    if (manualBtn) {
      manualBtn.onclick = () => openManualLogModal();
    }

    container.querySelector("#opt-work").onchange = e => {
      const v = Math.min(180, Math.max(5, parseInt(e.target.value, 10) || 25));
      Store.s.pomo.work = v; e.target.value = v; Store.save(); renderPulse();
    };
    container.querySelector("#opt-brk").onchange = e => {
      const v = Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 5));
      Store.s.pomo.brk = v; e.target.value = v; Store.save();
    };
    container.querySelector("#log-distraction").onclick = () => {
      Store.s.distractions++; Store.day().distracted++;
      Store.save();
      Psych.distractionGate();
    };
    container.querySelectorAll("[data-mix]").forEach(sl => {
      sl.oninput = () => AudioFX.setChannel(sl.dataset.mix, sl.value / 100);
    });
    renderPulse();
  }

  /* Shared 0..1 progress fraction — drives both the in-card mini bar and the top-edge bar. */
  function progressFrac() {
    if (!state.running) return 0;
    if (state.mode !== "stopwatch" && state.phase !== "overtime" && state.durationSec > 0)
      return 1 - remainingSec() / state.durationSec;
    if (state.phase === "overtime") return 1;
    if (state.mode === "stopwatch") return (elapsedSec() % 60) / 60;
    return 0;
  }

  /* Always-visible chrome: sidebar mini readout + slim top-edge progress bar.
     Runs regardless of which view is mounted, since the ring is gone from the main layout. */
  function renderChrome() {
    const timeEl = document.getElementById("side-timer-time");
    const dotEl = document.getElementById("side-timer-dot");
    const labelEl = document.getElementById("side-timer-label");
    const fill = document.getElementById("top-progress-fill");
    if (timeEl) timeEl.textContent = state.running ? displayTime() : "--:--";
    if (labelEl) labelEl.textContent =
      !state.running ? "ready" : state.paused ? "paused" :
      state.phase === "break" ? "break" : state.phase === "overtime" ? "overtime" : "focus";
    if (dotEl) dotEl.classList.toggle("live", state.running && !state.paused);
    if (fill) {
      fill.style.width = Math.min(100, Math.max(0, progressFrac() * 100)) + "%";
      fill.parentElement?.classList.toggle("active", state.running);
    }
  }

  function renderPulse() {
    renderChrome();
    const timeEl = document.getElementById("pulse-time");
    if (!timeEl) return;
    timeEl.textContent = displayTime();
    const phaseEl = document.getElementById("pulse-phase");
    const overEl = document.getElementById("pulse-over");
    phaseEl.textContent =
      state.phase === "idle" ? "ready" :
      state.paused ? "paused" :
      state.phase === "work" ? (state.mode === "stopwatch" ? "deep work ↑" : "focus") :
      state.phase === "break" ? "break" : "overtime 🔥";
    overEl.textContent = state.phase === "overtime" ? `+${displayTime()} beyond the bell` : "";

    // slim in-card progress bar (replaces the old circular ring)
    const bar = document.getElementById("pulse-bar-fill");
    if (bar) bar.style.width = Math.min(100, Math.max(0, progressFrac() * 100)) + "%";

    // actions
    const act = document.getElementById("pulse-actions");
    if (!act) return;
    act.innerHTML = "";
    const mk = (label, cls, fn) => { const b = el("button", `btn ${cls}`, label); b.onclick = fn; act.appendChild(b); };
    if (!state.running) {
      mk(state.mode === "five" ? "🚪 Start 5-min door" : state.mode === "stopwatch" ? "▶ Start stopwatch" : "▶ Start focus", "primary", () => start(state.mode));
    } else {
      if (state.phase === "overtime") {
        mk("☕ Take break", "good", takeBreak);
        mk("⏹ Done", "", () => stop(true));
      } else {
        mk(state.paused ? "▶ Resume" : "⏸ Pause", "", togglePause);
        mk("⏹ Stop", "danger", () => stop(false));
      }
    }
  }

  return {
    start, stop, togglePause, takeBreak, startLockout, mandatoryRest,
    pulseHTML, bindPulse, renderPulse, renderChrome, displayTime,
    isRunning: () => state.running,
    isPaused: () => state.paused,
    phase: () => state.phase,
    editSessionTitle, deleteSession, openManualLogModal
  };
})();
