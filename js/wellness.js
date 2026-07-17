/* ==========================================================
   wellness.js — hydration, posture, blink, breathing,
   stretches, mood, screen-time, wind-down, steps
   ========================================================== */
"use strict";

const Wellness = (() => {
  const { $, el, esc, toast, modal } = UI;

  const STRETCHES = [
    { fig: "🙆", name: "Overhead reach", how: "Interlace fingers, palms to ceiling, reach up and hold 15s." },
    { fig: "🤷", name: "Shoulder rolls", how: "Roll shoulders backward 10 times, slowly. Melt the keyboard hunch." },
    { fig: "🧎", name: "Seated spinal twist", how: "Sit tall, twist gently to each side, hold 10s per side." },
    { fig: "🙇", name: "Neck release", how: "Ear to shoulder, hold 15s each side. No forcing." },
    { fig: "🦵", name: "Standing hamstring", how: "Heel on chair, hinge forward slightly, 15s per leg." },
    { fig: "🤲", name: "Wrist saver", how: "Arm out, palm up, gently pull fingers back 10s. Typing insurance." },
  ];

  const MOODS = [["Great", "great"], ["Good", "good"], ["Meh", "meh"], ["Tired", "tired"], ["Stressed", "stressed"]];

  /* ---------- reminders loop ---------- */
  let lastPosture = Date.now(), lastBlink = Date.now(), lastScreenWarn = Date.now();
  function startLoops() {
    setInterval(() => {
      const s = Store.s.settings;
      const now = Date.now();
      if (s.postureReminders && now - lastPosture > 45 * 60000) {
        lastPosture = now;
        toast("🪑 Posture check! Shoulders back, spine tall, feet flat. You look 20% more heroic already.", "", 5000);
      }
      if (now - lastBlink > 20 * 60000) {
        lastBlink = now;
        toast("👁️ Blink break: 20 seconds, look 20 feet away. Your eyes run this operation.", "", 4500);
      }
      if (s.screenTimeWarn && now - Store.s.sessionStart > 3 * 3600000 && now - lastScreenWarn > 3600000) {
        lastScreenWarn = now;
        toast("🖥️ You've been here 3+ hours straight. A real break would be elite-level discipline.", "gold", 6000);
      }
      // wind-down check
      const h = new Date().getHours();
      if ((h === s.bedtimeHour - 1) && !windDownShown) {
        windDownShown = true;
        toast("🌙 Wind-Down Mode engaged — the interface is dimming to help your brain downshift.", "", 6000);
        UI.applyTheme();
      }
    }, 60000);
  }
  let windDownShown = false;

  /* ---------- guided breathing ---------- */
  function breathingModal() {
    const m = modal("Box Breathing — 1 minute", `
      <div class="breath-stage">
        <div class="breath-circle" id="breath-circle"></div>
        <div class="breath-label" id="breath-label">Get ready…</div>
        <div class="muted" id="breath-count" style="font-size:.8rem"></div>
      </div>`,
      [{ label: "Done", cls: "primary", onClick: () => { clearInterval(iv); } }]);
    const phases = [["Breathe in…", 4, 1.35], ["Hold", 4, 1.35], ["Breathe out…", 4, 0.8], ["Hold", 4, 0.8]];
    let pi = 0, cycles = 0;
    const circle = m.root.querySelector("#breath-circle");
    const label = m.root.querySelector("#breath-label");
    const count = m.root.querySelector("#breath-count");
    function step() {
      const [txt, secs, scale] = phases[pi];
      label.textContent = txt;
      circle.style.transform = `scale(${scale})`;
      count.textContent = `cycle ${cycles + 1} of 4`;
      pi = (pi + 1) % phases.length;
      if (pi === 0) cycles++;
      if (cycles >= 4) {
        clearInterval(iv);
        label.textContent = "Beautiful. 🌊";
        Game.addXP(15, null, { silent: true });
        toast("+15 XP for taking care of your nervous system", "xp");
      }
    }
    step();
    const iv = setInterval(step, 4000);
  }

  /* ---------- view ---------- */
  function render() {
    const v = $("#view-wellness");
    const today = Store.todayStr();
    const cups = Store.s.hydration[today] || 0;
    const stepsToday = Store.s.stepGoal.log[today] || 0;
    const st = STRETCHES[Math.floor(Date.now() / 3600000) % STRETCHES.length];
    const todayMoods = Store.s.moodLog.filter(m2 => Store.todayStr(new Date(m2.ts)) === today);

    v.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h2>Hydration Tracker <span class="spacer"></span><span class="muted2" style="font-size:.78rem;font-weight:600">${cups}/8</span></h2>
          <div class="card-sub">Tap a segment as you finish a glass. Target: 8 today.</div>
          <div class="water-row" id="water-row">
            ${Array.from({ length: 8 }, (_, i) => `<span class="water-cup ${i < cups ? "full" : ""}" data-i="${i}"><i class="ico" data-ico="droplet"></i></span>`).join("")}
          </div>
          <p class="muted" style="margin-top:12px;font-size:.8rem">${cups >= 8 ? "Fully hydrated — nicely done." : `${8 - cups} to go.`}</p>
        </div>
        <div class="card">
          <h2>Mood Log</h2>
          <div class="card-sub">Before or after a session — how are you actually doing?</div>
          <div class="mood-row" id="mood-row">
            ${MOODS.map(([label, k]) => `<button class="mode-btn" data-mood="${k}">${label}</button>`).join("")}
          </div>
          <p class="muted" style="margin-top:12px;font-size:.8rem">${todayMoods.length ? "Today: " + todayMoods.map(m2 => MOODS.find(x => x[1] === m2.mood)?.[0] || "").join(", ") : "No moods logged today."}</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>Guided Breathing</h2>
          <div class="card-sub">One minute of box breathing. Resets your nervous system between sessions.</div>
          <button class="btn primary" id="breath-btn">Start 1-min breathing</button>
        </div>
        <div class="card">
          <h2>Stretch of the Hour</h2>
          <div class="stretch-fig">${st.fig}</div>
          <p style="text-align:center"><b>${st.name}</b></p>
          <p class="muted" style="text-align:center;font-size:.82rem">${st.how}</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>Step Goal Sync</h2>
          <div class="card-sub">Balance mental grind with physical movement. Log today's steps.</div>
          <div style="display:flex;gap:8px">
            <input type="number" id="steps-in" placeholder="steps today" value="${stepsToday || ""}" style="flex:1">
            <button class="btn" id="steps-save">Save</button>
          </div>
          <p class="muted" style="margin-top:12px;font-size:.8rem" id="steps-msg">
            Goal: ${Store.s.stepGoal.goal.toLocaleString()} · ${stepsToday ? Math.round(stepsToday / Store.s.stepGoal.goal * 100) + "% there" : "not logged yet"}
          </p>
        </div>
        <div class="card">
          <h2>Wind-Down</h2>
          <div class="card-sub">An hour before bedtime the whole site shifts into a warm, low-stimulation mode.</div>
          <label class="field"><span>My bedtime hour (24h)</span>
            <input type="number" id="bed-hour" min="19" max="27" value="${Store.s.settings.bedtimeHour}"></label>
          <button class="btn" id="winddown-preview" style="margin-top:12px">Preview Wind-Down theme</button>
        </div>
      </div>`;
    UI.mountIcons(v);

    $("#water-row").onclick = e => {
      const cup = e.target.closest(".water-cup");
      if (!cup) return;
      const i = +cup.dataset.i;
      Store.s.hydration[today] = (i < (Store.s.hydration[today] || 0)) ? i : i + 1;
      Game.questProgress("water", 1);
      Game.checkBadges();
      Store.save(); render();
      AudioFX.play("tick");
    };

    $("#mood-row").onclick = e => {
      const b = e.target.closest("button[data-mood]");
      if (!b) return;
      Store.s.moodLog.push({ ts: Date.now(), mood: b.dataset.mood });
      Game.questProgress("mood", 1);
      Game.checkBadges();
      Store.save(); render();
      toast("Mood logged — self-awareness is a superpower 🧠");
    };

    $("#breath-btn").onclick = breathingModal;
    $("#steps-save").onclick = () => {
      const val = parseInt($("#steps-in").value, 10) || 0;
      Store.s.stepGoal.log[today] = val;
      Store.save(); render();
      if (val >= Store.s.stepGoal.goal) { toast("👟 Step goal crushed! +30 XP", "gold"); Game.addXP(30, "fitness", { silent: true }); }
    };
    $("#bed-hour").onchange = e => { Store.s.settings.bedtimeHour = parseInt(e.target.value, 10) || 22; Store.save(); };
    $("#winddown-preview").onclick = () => {
      document.body.dataset.theme = "winddown";
      toast("🌙 Wind-Down preview — theme returns to normal on next theme refresh");
    };
  }

  return { render, startLoops, breathingModal };
})();
