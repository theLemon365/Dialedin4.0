/* ==========================================================
   store.js — persistent state, profiles, day rollover, backup
   ========================================================== */
"use strict";

const USER_NAME = "Aarush";

const Store = (() => {
  const KEY_PREFIX = "focusquest_v1_";
  const PROFILE_KEY = "focusquest_profile";

  const todayStr = (d = new Date()) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const defaultSkills = () => ([
    { id: "fitness", name: "Fitness", icon: "💪", xp: 0 },
    { id: "coding", name: "Coding", icon: "💻", xp: 0 },
    { id: "reading", name: "Reading", icon: "📚", xp: 0 },
    { id: "school", name: "School", icon: "🎓", xp: 0 },
    { id: "creative", name: "Creative", icon: "🎨", xp: 0 },
    { id: "life", name: "Life Admin", icon: "🏡", xp: 0 },
  ]);

  const defaultState = () => ({
    version: 1,
    createdAt: Date.now(),
    profile: "School",
    prestige: 0,

    // gamification
    xp: 0,
    coins: 120,
    streak: 0,
    bestStreak: 0,
    lastActiveDay: null,
    streakSavers: 1,          // forgiveness tokens
    skills: defaultSkills(),
    badges: [],               // ids of unlocked badges
    quests: { day: null, list: [] },
    bosses: [],
    shopOwned: ["skin_knight", "pet_dog"],
    equipped: { skin: "skin_knight", pet: "pet_dog" },
    congratsShown: [],        // milestone ids already celebrated
    customRewards: [],        // user-defined shop rewards: {id, icon, name, price, type:"reward", custom:true}
    mediaConfessions: 0,      // times the media/games honesty gate was used
    infiniteCoinsEnabled: false,
    simulatedFocusHours: 0,

    // tasks
    tasks: [],
    taskSeq: 1,
    braindump: "",
    procrastinationLog: [],   // {ts, taskId, reason}
    icebox: [],               // task ids live in tasks[] with status 'icebox'

    // timer / focus
    focusLog: [],             // {ts, mins, skill, taskId, hour, distracted}
    distractions: 0,
    focusBlocks: 0,
    overtimeTotal: 0,
    pomo: { work: 25, brk: 5, autoAdjust: false, strict: false, rule202020: false },
    sessionsCompleted: 0,
    totalFocusMin: 0,
    sessionHistory: [], // [{ts, title, durationMin, lostMin, finished, category}]

    // day tracking
    dayStats: {},             // date -> {focusMin, tasksDone, xp, water, mood:[], distracted, sessions}
    preCommit: { day: null, text: null },
    milestones: [],           // {ts, title}
    countdowns: [],           // {id, name, date}

    // notes
    notes: [],
    noteSeq: 1,
    flashcards: [],
    canvases: [],             // [{id, name, cards:[{id,x,y,w,h,text}]}]
    canvasSeq: 1,
    scratchpad: "",
    journal: {},              // date -> {prompt, entry, gratitude}

    // wellness
    hydration: {},            // date -> cups
    moodLog: [],              // {ts, mood, when}
    stepGoal: { goal: 8000, log: {} },

    // settings
    settings: {
      sound: true,
      sfxPack: "minimal",
      themeMode: "dark",       // dark | minimal
      accentColor: null,       // custom accent (shop unlock)
      font: "default",
      animations: true,
      videoBg: "none",         // none | rain | space | cozy
      identity: "I am a disciplined creator.",
      bedtimeHour: 22,
      autoWinddown: true,      // auto-switch to amber wind-down theme near bedtime
      winddownSnoozeDate: null, // date-string; when set to today, skip auto wind-down for the rest of the day
      postureReminders: true,
      screenTimeWarn: true,
      customCSS: "",
      focusHours: { enabled: false, start: 9, end: 17 },
      autoClean: true,
      autoReschedule: true,
      sidebarCollapsed: false,
      shortcutsEnabled: true,
      eisenTitles: {
        q1: "Urgent & Important — Do Now",
        q2: "Important, Not Urgent — Schedule",
        q3: "Urgent, Not Important — Batch",
        q4: "Neither — Question It",
      },
    },

    // automation
    rules: [],                 // {id, trigger, threshold, action, fired}
    timebox: {},               // date -> {hour -> [taskIds]}
    routine: null,             // saved daily schedule: {hour -> [{title, priority, tags, skill, estimate}]}
    sessionStart: Date.now(),
  });

  let profile = localStorage.getItem(PROFILE_KEY) || "School";
  let state = null;

  const keyFor = p => KEY_PREFIX + p;

  function load() {
    try {
      const raw = localStorage.getItem(keyFor(profile));
      state = raw ? Object.assign(defaultState(), JSON.parse(raw)) : defaultState();
    } catch (e) { state = defaultState(); }
    state.profile = profile;
    state.sessionStart = Date.now();
    if (!state.settings || typeof state.settings !== "object") state.settings = defaultState().settings;
    state.settings = Object.assign(defaultState().settings, state.settings);
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(keyFor(profile), JSON.stringify(state)); } catch (e) {}
    }, 250);
  }

  function switchProfile(name) {
    localStorage.setItem(keyFor(profile), JSON.stringify(state));
    profile = name;
    localStorage.setItem(PROFILE_KEY, name);
    load();
  }

  function day(dateStr = todayStr()) {
    if (!state.dayStats[dateStr]) {
      state.dayStats[dateStr] = { focusMin: 0, tasksDone: 0, xp: 0, water: 0, distracted: 0, sessions: 0, moods: [] };
    }
    return state.dayStats[dateStr];
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `focusquest-backup-${profile}-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importBackup(json) {
    const parsed = JSON.parse(json);
    state = Object.assign(defaultState(), parsed);
    state.profile = profile;
    save();
  }

  function prestige() {
    // snapshot so prestige can be undone (and exportable backup still covers everything)
    try { localStorage.setItem("focusquest_preprestige_" + profile, JSON.stringify(state)); } catch (e) {}
    const kept = {
      badges: state.badges.slice(),
      bestStreak: state.bestStreak,
      prestige: (state.prestige || 0) + 1,
      settings: state.settings,
      notes: state.notes,
      noteSeq: state.noteSeq,
      congratsShown: [],
    };
    state = Object.assign(defaultState(), kept);
    state.profile = profile;
    save();
  }

  function hasPrestigeSnapshot() {
    return !!localStorage.getItem("focusquest_preprestige_" + profile);
  }

  function undoPrestige() {
    const raw = localStorage.getItem("focusquest_preprestige_" + profile);
    if (!raw) return false;
    try {
      state = Object.assign(defaultState(), JSON.parse(raw));
      state.profile = profile;
      localStorage.removeItem("focusquest_preprestige_" + profile);
      localStorage.setItem(keyFor(profile), JSON.stringify(state));
      return true;
    } catch (e) { return false; }
  }

  load();

  return {
    get s() { return state; },
    get profile() { return profile; },
    save, switchProfile, day, todayStr, exportBackup, importBackup, prestige,
    hasPrestigeSnapshot, undoPrestige,
    defaultState,
  };
})();
