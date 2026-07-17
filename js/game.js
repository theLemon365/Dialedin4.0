/* ==========================================================
   game.js — XP, levels, coins, streaks, quests, skills,
              bosses, badges, shop, avatar, milestones
   ========================================================== */
"use strict";

const Game = (() => {
  const { $, el, esc, toast } = UI;

  /* ---------- Quote of the Day (cycles every calendar day) ---------- */
  const DAILY_QUOTES = [
    { q: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", by: "Aristotle" },
    { q: "It is not that we have a short time to live, but that we waste a lot of it.", by: "Seneca" },
    { q: "The impediment to action advances action. What stands in the way becomes the way.", by: "Marcus Aurelius" },
    { q: "How we spend our days is, of course, how we spend our lives.", by: "Annie Dillard" },
    { q: "You do not rise to the level of your goals. You fall to the level of your systems.", by: "James Clear" },
    { q: "Amateurs sit and wait for inspiration. The rest of us just get up and go to work.", by: "Stephen King" },
    { q: "It always seems impossible until it's done.", by: "Nelson Mandela" },
    { q: "The successful warrior is the average man, with laser-like focus.", by: "Bruce Lee" },
    { q: "Do not wait to strike till the iron is hot; but make it hot by striking.", by: "William Butler Yeats" },
    { q: "Whether you think you can, or you think you can't — you're right.", by: "Henry Ford" },
    { q: "I have not failed. I've just found 10,000 ways that won't work.", by: "Thomas Edison" },
    { q: "The best time to plant a tree was 20 years ago. The second best time is now.", by: "Chinese proverb" },
    { q: "Hard choices, easy life. Easy choices, hard life.", by: "Jerzy Gregorek" },
    { q: "You may delay, but time will not.", by: "Benjamin Franklin" },
    { q: "The man who moves a mountain begins by carrying away small stones.", by: "Confucius" },
    { q: "Discipline is choosing between what you want now and what you want most.", by: "Abraham Lincoln (attr.)" },
    { q: "Everything you've ever wanted is on the other side of fear.", by: "George Addair" },
    { q: "Do the difficult things while they are easy and do the great things while they are small.", by: "Lao Tzu" },
    { q: "A year from now you may wish you had started today.", by: "Karen Lamb" },
    { q: "Nothing in the world can take the place of persistence.", by: "Calvin Coolidge" },
    { q: "The only way to do great work is to love what you do.", by: "Steve Jobs" },
    { q: "Well done is better than well said.", by: "Benjamin Franklin" },
    { q: "First we make our habits, then our habits make us.", by: "John Dryden" },
    { q: "He who has a why to live for can bear almost any how.", by: "Friedrich Nietzsche" },
    { q: "Waste no more time arguing about what a good man should be. Be one.", by: "Marcus Aurelius" },
    { q: "Start where you are. Use what you have. Do what you can.", by: "Arthur Ashe" },
    { q: "It does not matter how slowly you go as long as you do not stop.", by: "Confucius" },
    { q: "Success is the sum of small efforts, repeated day in and day out.", by: "Robert Collier" },
    { q: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", by: "Alexander Graham Bell" },
    { q: "What you do every day matters more than what you do once in a while.", by: "Gretchen Rubin" },
    { q: "Someday is not a day of the week.", by: "Janet Dailey" },
  ];

  /* quotes shown when Aarush crushes the 6-hour focus milestone */
  const TRIUMPH_QUOTES = [
    { q: "Great things are done by a series of small things brought together.", by: "Vincent van Gogh" },
    { q: "Perseverance is not a long race; it is many short races one after the other.", by: "Walter Elliot" },
    { q: "The reward of a thing well done is having done it.", by: "Ralph Waldo Emerson" },
    { q: "Continuous effort — not strength or intelligence — is the key to unlocking our potential.", by: "Winston Churchill" },
    { q: "If people knew how hard I worked to get my mastery, it wouldn't seem so wonderful at all.", by: "Michelangelo" },
    { q: "Victory belongs to the most persevering.", by: "Napoleon Bonaparte" },
    { q: "What we achieve inwardly will change outer reality.", by: "Plutarch" },
    { q: "The fight is won or lost far away from witnesses — behind the lines, in the gym, and out there on the road.", by: "Muhammad Ali" },
    { q: "I'm a great believer in luck, and I find the harder I work, the more I have of it.", by: "Thomas Jefferson (attr.)" },
    { q: "Genius is one percent inspiration and ninety-nine percent perspiration.", by: "Thomas Edison" },
  ];

  const daySeed = () => parseInt(Store.todayStr().replace(/-/g, ""), 10);
  const dailyQuote = () => DAILY_QUOTES[daySeed() % DAILY_QUOTES.length];
  const triumphQuote = () => TRIUMPH_QUOTES[daySeed() % TRIUMPH_QUOTES.length];

  /* ---------- Leveling ---------- */
  // XP needed for level n: 80 * n^1.35
  function level() {
    let xp = Store.s.xp, lvl = 1;
    let need = xpForLevel(lvl);
    while (xp >= need) { xp -= need; lvl++; need = xpForLevel(lvl); }
    return { level: lvl, into: Math.floor(xp), need: Math.floor(need), pct: xp / need };
  }
  const xpForLevel = n => Math.round(80 * Math.pow(n, 1.35));

  function multiplier() {
    const s = Store.s.streak;
    return Math.min(3, 1 + s * 0.1); // +10% per streak day, cap ×3
  }

  /* ---------- Economy guard: logarithmic diminishing returns ----------
     Full rewards for the first 3h of focus per day; after that each extra
     minute pays less (floor 25%), so 50-hour weeks can't hyperinflate coins. */
  function earnScale() {
    const f = Store.day().focusMin;
    if (f <= 180) return 1;
    return Math.max(0.25, 1 / (1 + Math.log2(1 + (f - 180) / 90)));
  }

  function notifyInflationOnce() {
    const d = Store.day();
    if (earnScale() < 1 && !d.inflationNotified) {
      d.inflationNotified = true;
      toast("🏦 3h+ focused today — rewards now scale down logarithmically to keep the economy meaningful. Rest resets it tomorrow.", "gold", 6500);
    }
  }

  function addXP(amount, skillId = null, opts = {}) {
    const mult = opts.noMult ? 1 : multiplier();
    const gained = Math.round(amount * mult);
    const before = level().level;
    Store.s.xp += gained;
    Store.day().xp += gained;
    if (skillId) {
      const sk = Store.s.skills.find(s => s.id === skillId);
      if (sk) sk.xp += gained;
    }
    const after = level().level;
    if (!opts.silent) toast(`+${gained} XP${mult > 1 ? ` (×${mult.toFixed(1)} streak)` : ""}`, "xp");
    if (after > before) onLevelUp(after);
    Automation.checkRules("xp");
    Store.save();
    UI.refreshChips();
    return gained;
  }

  function addCoins(amount, silent = false) {
    Store.s.coins += amount;
    if (!silent && amount > 0) { toast(`+${amount} 🪙`, "gold"); AudioFX.play("coin"); }
    Store.save(); UI.refreshChips();
  }

  function onLevelUp(newLevel) {
    addCoins(newLevel * 25, true);
    AudioFX.play("levelup");
    UI.congrats(`Level ${newLevel}, Aarush! 🎊`,
      `You just leveled up and earned ${newLevel * 25} coins. Your consistency is literally becoming power.`, "⬆️");
    checkBadges();
    // milestone levels
    [5, 10, 20, 30, 50].forEach(m => {
      if (newLevel === m) UI.celebrateMilestone(`level_${m}`, `Level ${m} Reached!`,
        `Aarush, you've reached Level ${m}. Most people never get this far. You did.`, "🏔️");
    });
  }

  /* ---------- Streaks ---------- */
  function touchStreak() {
    const today = Store.todayStr();
    if (Store.s.lastActiveDay === today) return;
    const yesterday = Store.todayStr(new Date(Date.now() - 864e5));
    if (Store.s.lastActiveDay === yesterday) {
      Store.s.streak++;
    } else if (Store.s.lastActiveDay !== null) {
      // streak broken — offer forgiveness
      if (Store.s.streakSavers > 0) {
        Store.s.streakSavers--;
        Store.s.streak++; // saved!
        toast(`🛟 Streak Saver used! Your ${Store.s.streak}-day streak lives on. (${Store.s.streakSavers} left)`, "gold", 4500);
      } else {
        offerForgiveness();
        Store.s.streak = 1;
      }
    } else {
      Store.s.streak = 1;
    }
    Store.s.lastActiveDay = today;
    Store.s.bestStreak = Math.max(Store.s.bestStreak, Store.s.streak);
    [3, 7, 14, 30, 60, 100].forEach(m => {
      if (Store.s.streak === m) UI.celebrateMilestone(`streak_${m}`, `${m}-Day Streak! 🔥`,
        `Aarush, ${m} days in a row. This is who you are now — someone who shows up.`, "🔥");
    });
    checkBadges();
    Store.save(); UI.refreshChips();
  }

  function offerForgiveness() {
    UI.modal("💙 Forgiveness Button", `
      <p style="margin-bottom:10px">Your streak broke — and that's okay. One missed day doesn't erase who you're becoming.</p>
      <p class="muted" style="font-size:.84rem">The "might as well give up" voice is lying. Press the button, forgive yourself, and start fresh with <b>zero shame</b>. You'll even earn a fresh Streak Saver at 500 XP earned this week.</p>`,
      [{ label: "💙 I forgive myself. Restarting.", cls: "primary", onClick: () => { toast("Fresh start. Day 1 begins now. 💙", "xp"); } }],
      { sticky: true });
  }

  /* ---------- Daily quests ---------- */
  const QUEST_POOL = [
    { id: "focus45_noon", name: "Focus for 45 min before noon", target: 45, type: "focusBeforeNoon", xp: 120, coins: 40 },
    { id: "focus90", name: "Rack up 90 total focus minutes", target: 90, type: "focusMin", xp: 150, coins: 50 },
    { id: "tasks3", name: "Complete 3 tasks", target: 3, type: "tasksDone", xp: 100, coins: 35 },
    { id: "tasks5", name: "Complete 5 tasks", target: 5, type: "tasksDone", xp: 160, coins: 60 },
    { id: "session2", name: "Finish 2 full focus sessions", target: 2, type: "sessions", xp: 90, coins: 30 },
    { id: "water5", name: "Drink 5 cups of water", target: 5, type: "water", xp: 60, coins: 20 },
    { id: "journal1", name: "Write a journal entry", target: 1, type: "journal", xp: 70, coins: 25 },
    { id: "gratitude1", name: "Log one gratitude", target: 1, type: "gratitude", xp: 50, coins: 15 },
    { id: "boss1", name: "Deal damage to a Boss (finish a sub-task)", target: 1, type: "bossHit", xp: 110, coins: 40 },
    { id: "twomin3", name: "Clear 3 tasks under 2 minutes", target: 3, type: "quickTasks", xp: 90, coins: 30 },
    { id: "mood2", name: "Log your mood twice", target: 2, type: "mood", xp: 50, coins: 15 },
    { id: "focus25_night", name: "One 25-min session after 6 PM", target: 25, type: "focusEvening", xp: 100, coins: 35 },
  ];

  function seededShuffle(arr, seed) {
    const a = arr.slice();
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function ensureDailyQuests() {
    const today = Store.todayStr();
    if (Store.s.quests.day === today && Store.s.quests.list.length) return;
    const seed = parseInt(today.replace(/-/g, ""), 10);
    const slots = Store.s.shopOwned.includes("up_quest4") ? 4 : 3;
    Store.s.quests = {
      day: today,
      list: seededShuffle(QUEST_POOL, seed).slice(0, slots).map(q => ({ ...q, progress: 0, done: false })),
    };
    Store.save();
  }

  function questProgress(type, amount = 1, ctx = {}) {
    ensureDailyQuests();
    const hour = new Date().getHours();
    Store.s.quests.list.forEach(q => {
      if (q.done) return;
      let inc = 0;
      if (q.type === type) inc = amount;
      if (q.type === "focusBeforeNoon" && type === "focusMin" && hour < 12) inc = amount;
      if (q.type === "focusEvening" && type === "focusMin" && hour >= 18) inc = amount;
      if (!inc) return;
      q.progress = Math.min(q.target, q.progress + inc);
      if (q.progress >= q.target) {
        q.done = true;
        addXP(q.xp, null, { noMult: false });
        addCoins(q.coins);
        toast(`🎯 Quest complete: ${q.name}`, "gold", 4000);
        AudioFX.play("badge");
        if (Store.s.quests.list.every(x => x.done)) {
          UI.congrats("All Daily Quests Cleared! 🎯",
            `Aarush, you swept every quest today. Bonus 50 coins for total domination.`, "👑");
          addCoins(50, true);
        }
      }
    });
    Store.save();
  }

  /* ---------- Skills ---------- */
  function skillLevel(sk) {
    let xp = sk.xp, lvl = 1, need = 100 * Math.pow(lvl, 1.3);
    while (xp >= need) { xp -= need; lvl++; need = 100 * Math.pow(lvl, 1.3); }
    return { level: lvl, into: Math.floor(xp), need: Math.floor(need), pct: xp / need };
  }

  function addSkill(name, icon) {
    const id = "sk_" + Date.now();
    Store.s.skills.push({ id, name, icon: icon || "✨", xp: 0 });
    Store.save();
  }

  /* ---------- Bosses ---------- */
  const BOSS_EMOJIS = ["🐉", "👹", "🦑", "🤖", "👾", "🧟", "🦖", "💀"];
  function createBoss(name, subtasks) {
    Store.s.bosses.push({
      id: "boss_" + Date.now(),
      name, emoji: BOSS_EMOJIS[Math.floor(Math.random() * BOSS_EMOJIS.length)],
      subs: subtasks.map((t, i) => ({ id: i, name: t, done: false })),
      createdAt: Date.now(), defeated: false,
    });
    Store.save();
  }

  function hitBoss(bossId, subId) {
    const b = Store.s.bosses.find(x => x.id === bossId);
    if (!b) return;
    const sub = b.subs.find(s => s.id === subId);
    if (!sub || sub.done) return;
    sub.done = true;
    AudioFX.play("complete");
    addXP(40, null);
    questProgress("bossHit", 1);
    const remaining = b.subs.filter(s => !s.done).length;
    if (remaining === 0 && !b.defeated) {
      b.defeated = true;
      b.defeatedAt = Date.now();
      addCoins(200);
      addXP(300, null, { noMult: true, silent: true });
      UI.celebrateMilestone(`boss_${b.id}`, `${b.emoji} BOSS DEFEATED: ${b.name}`,
        `Incredible, Aarush! You broke "${b.name}" into pieces and destroyed every one. +300 XP, +200 coins.`, "⚔️");
    } else {
      toast(`⚔️ Hit! ${b.name} — ${remaining} HP segments left`, "xp");
    }
    Store.save();
  }

  /* ---------- Badges ---------- */
  const BADGES = [
    { id: "first_task", icon: "🥇", name: "First Blood", desc: "Complete your first task", check: s => totalTasksDone() >= 1 },
    { id: "task_25", icon: "📦", name: "Shipper", desc: "Complete 25 tasks", check: s => totalTasksDone() >= 25 },
    { id: "task_100", icon: "🚀", name: "Centurion", desc: "Complete 100 tasks", check: s => totalTasksDone() >= 100 },
    { id: "focus_60", icon: "🕐", name: "First Hour", desc: "60 total focus minutes", check: s => s.totalFocusMin >= 60 },
    { id: "focus_600", icon: "🧠", name: "Deep Diver", desc: "10 hours of total focus", check: s => s.totalFocusMin >= 600 },
    { id: "focus_3000", icon: "🌌", name: "Monk Mode", desc: "50 hours of total focus", check: s => s.totalFocusMin >= 3000 },
    { id: "night_owl", icon: "🦉", name: "Night Owl", desc: "Focus session after 11 PM", check: s => s.focusLog.some(f => f.hour >= 23 || f.hour < 4) },
    { id: "early_bird", icon: "🐦", name: "Early Bird", desc: "Focus session before 7 AM", check: s => s.focusLog.some(f => f.hour >= 4 && f.hour < 7) },
    { id: "streak_7", icon: "🔥", name: "On Fire", desc: "7-day streak", check: s => s.bestStreak >= 7 },
    { id: "streak_30", icon: "☄️", name: "Unstoppable", desc: "30-day streak", check: s => s.bestStreak >= 30 },
    { id: "boss_slayer", icon: "⚔️", name: "Boss Slayer", desc: "Defeat your first Boss", check: s => s.bosses.some(b => b.defeated) },
    { id: "boss_3", icon: "🏆", name: "Raid Leader", desc: "Defeat 3 Bosses", check: s => s.bosses.filter(b => b.defeated).length >= 3 },
    { id: "rich", icon: "💰", name: "Coin Hoarder", desc: "Hold 1000 coins at once", check: s => s.coins >= 1000 },
    { id: "hydrated", icon: "💧", name: "Hydro Homie", desc: "8 cups of water in one day", check: s => Object.values(s.hydration).some(c => c >= 8) },
    { id: "journaler", icon: "📔", name: "Reflector", desc: "Write 7 journal entries", check: s => Object.values(s.journal).filter(j => j.entry).length >= 7 },
    { id: "quest_master", icon: "🎯", name: "Quest Master", desc: "Clear all daily quests in one day", check: s => s.quests.list.length >= 3 && s.quests.list.every(q => q.done) },
    { id: "level_10", icon: "🌟", name: "Double Digits", desc: "Reach Level 10", check: s => level().level >= 10 },
    { id: "overtime", icon: "🏃", name: "Marathoner", desc: "30+ min of overtime work", check: s => s.overtimeTotal >= 30 },
    { id: "prestige_1", icon: "♻️", name: "Reborn", desc: "Prestige once", check: s => s.prestige >= 1 },
    { id: "zen_master", icon: "🧘", name: "Zen Master", desc: "Log 10 moods", check: s => s.moodLog.length >= 10 },
  ];

  function totalTasksDone() {
    return Object.values(Store.s.dayStats).reduce((a, d) => a + (d.tasksDone || 0), 0);
  }

  function checkBadges() {
    BADGES.forEach(b => {
      if (!Store.s.badges.includes(b.id) && b.check(Store.s)) {
        Store.s.badges.push(b.id);
        AudioFX.play("badge");
        UI.toast(`Badge unlocked — ${b.name}`, "gold");
        addCoins(30, true);
      }
    });
    Store.save();
  }

  /* ---------- Shop ---------- */
  const SHOP = [
    // skins
    { id: "skin_knight", icon: "🧑‍💼", name: "Focused Human", type: "skin", price: 0 },
    { id: "skin_ninja", icon: "🥷", name: "Ninja", type: "skin", price: 150 },
    { id: "skin_wizard", icon: "🧙", name: "Wizard", type: "skin", price: 250 },
    { id: "skin_astro", icon: "🧑‍🚀", name: "Astronaut", type: "skin", price: 400 },
    { id: "skin_royal", icon: "🤴", name: "Royalty", type: "skin", price: 600 },
    { id: "skin_robot", icon: "🤖", name: "Automaton", type: "skin", price: 800 },
    // pets
    { id: "pet_dog", icon: "🐕", name: "Loyal Dog", type: "pet", price: 250 },
    { id: "pet_cat", icon: "🐱", name: "Study Cat", type: "pet", price: 200 },
    { id: "pet_dragon", icon: "🐲", name: "Baby Dragon", type: "pet", price: 450 },
    { id: "pet_owl", icon: "🦉", name: "Wise Owl", type: "pet", price: 350 },
    { id: "pet_fox", icon: "🦊", name: "Clever Fox", type: "pet", price: 300 },
    // real-life rewards (gold sinks)
    { id: "rl_tv", icon: "📺", name: "30 min of TV", type: "reward", price: 500 },
    { id: "rl_game", icon: "🎮", name: "1 hour of gaming", type: "reward", price: 800 },
    { id: "rl_snack", icon: "🍫", name: "Favorite snack", type: "reward", price: 300 },
    { id: "rl_sleepin", icon: "😴", name: "Guilt-free sleep-in", type: "reward", price: 1000 },
    { id: "rl_cheatmeal", icon: "🍕", name: "Cheat meal", type: "reward", price: 1200 },
    { id: "rl_movie", icon: "🎬", name: "Movie night", type: "reward", price: 1500 },
    { id: "rl_weekend", icon: "🎟️", name: "Weekend 3h gaming pass", type: "reward", price: 2000 },
    { id: "rl_daysoff", icon: "🏖️", name: "Full guilt-free day off", type: "reward", price: 5000 },
    // permanent upgrades (big sinks)
    { id: "cos_accent", icon: "🎨", name: "Custom accent color (Settings)", type: "upgrade", price: 1500 },
    { id: "up_quest4", icon: "🎯", name: "4th daily quest slot", type: "upgrade", price: 3000 },
    // consumables
    { id: "c_saver", icon: "🛟", name: "Streak Saver", type: "consumable", price: 400 },
  ];
  const shopItem = id => SHOP.find(i => i.id === id) || (Store.s.customRewards || []).find(r => r.id === id) || null;

  /* ---------- Custom rewards (user-defined gold sinks) ---------- */
  function addCustomReward({ icon, name, price }) {
    if (!Store.s.customRewards) Store.s.customRewards = [];
    const item = {
      id: "custom_" + Date.now(),
      icon: icon || "🎁",
      name: (name || "My Reward").trim().slice(0, 60),
      price: Math.max(1, Math.round(price) || 100),
      type: "reward",
      custom: true,
    };
    Store.s.customRewards.push(item);
    Store.save();
    return item;
  }

  function removeCustomReward(id) {
    Store.s.customRewards = (Store.s.customRewards || []).filter(r => r.id !== id);
    Store.save();
  }

  function buy(id) {
    const item = shopItem(id);
    if (!item) return;
    if (item.type !== "reward" && item.type !== "consumable" && Store.s.shopOwned.includes(id)) { equip(id); return; }
    const hasInfinite = !!Store.s.infiniteCoinsEnabled;
    if (!hasInfinite && Store.s.coins < item.price) { toast("Not enough coins yet — keep grinding! 🪙", "bad"); AudioFX.play("fail"); return; }
    if (!hasInfinite) Store.s.coins -= item.price;
    if (item.type === "reward") {
      AudioFX.play("coin");
      UI.congrats(`Reward Redeemed! ${item.icon}`,
        `Enjoy it, Aarush — "${item.name}" is bought and paid for with real focus. Zero guilt. You earned this.`, item.icon);
    } else if (item.type === "consumable") {
      if (item.id === "c_saver") Store.s.streakSavers++;
      toast(`🛟 Streak Saver purchased (${Store.s.streakSavers} held)`, "gold");
      AudioFX.play("coin");
    } else if (item.type === "upgrade") {
      if (Store.s.shopOwned.includes(id)) { toast("Already owned!"); if (!hasInfinite) Store.s.coins += item.price; return; }
      Store.s.shopOwned.push(id);
      AudioFX.play("badge");
      if (id === "cos_accent") toast("🎨 Custom accent unlocked — pick your color in Settings → Appearance", "gold", 5000);
      if (id === "up_quest4") { toast("🎯 4th daily quest slot unlocked — starts tomorrow (or re-rolls today)", "gold", 5000); Store.s.quests.day = null; ensureDailyQuests(); }
    } else {
      Store.s.shopOwned.push(id);
      equip(id);
      AudioFX.play("coin");
      toast(`${item.icon} ${item.name} unlocked & equipped!`, "gold");
    }
    checkBadges();
    Store.save(); UI.refreshChips();
    if (UI.currentView === "shop") UI.showView("shop");
  }

  function equip(id) {
    const item = shopItem(id);
    if (!item || !Store.s.shopOwned.includes(id)) return;
    if (Store.s.equipped[item.type] === id) Store.s.equipped[item.type] = null; // toggle off
    else Store.s.equipped[item.type] = id;
    Store.save(); UI.refreshChips();
    if (UI.currentView === "shop") UI.showView("shop");
  }

  /* ---------- Task completion hook (central reward pipeline) ---------- */
  function onTaskCompleted(task) {
    const d = Store.day();
    d.tasksDone++;
    touchStreak();
    const base = task.priority === "high" ? 50 : task.priority === "med" ? 35 : 25;
    addXP(base, task.skill || null);
    addCoins(Math.round(base / 3), true);
    AudioFX.play("complete");
    questProgress("tasksDone", 1);
    if (task.estimate && task.estimate <= 2) questProgress("quickTasks", 1);
    // total-task milestones
    const total = totalTasksDone();
    [10, 50, 100, 250, 500].forEach(m => {
      if (total === m) UI.celebrateMilestone(`tasks_${m}`, `${m} Tasks Completed!`,
        `Aarush, that's ${m} things you've finished that procrastination said you couldn't. Massive.`, "🏅");
    });
    checkBadges();
    Automation.checkRules("taskDone");
  }

  /* ---------- Focus minute hook ---------- */
  function onFocusMinutes(mins, skillId, taskId) {
    const d = Store.day();
    d.focusMin += mins;
    Store.s.totalFocusMin += mins;
    Store.s.focusLog.push({ ts: Date.now(), mins, skill: skillId, taskId, hour: new Date().getHours() });
    if (Store.s.focusLog.length > 5000) Store.s.focusLog = Store.s.focusLog.slice(-4000);
    touchStreak();
    addXP(Math.max(1, Math.round(mins * 2 * earnScale())), skillId, { silent: true }); // 2 XP/min, scaled after 3h/day
    notifyInflationOnce();
    questProgress("focusMin", mins);
    // 6 hours of focus in a single day — massive reward + a legend's words
    if (d.focusMin >= 360 && !d.sixHourDone) {
      d.sixHourDone = true;
      addXP(500, null, { noMult: true, silent: true });
      addCoins(300, true);
      Store.s.milestones.push({ ts: Date.now(), title: `6-hour focus day (${Store.todayStr()})` });
      const tq = triumphQuote();
      UI.congrats(`SIX HOURS OF FOCUS, ${USER_NAME}! 🏆`,
        `That's elite-tier deep work — +500 XP and +300 coins are yours. "${tq.q}" — ${tq.by}. They earned their legend the same way you just did: one focused hour at a time.`, "🏆");
    }
    // focus milestones (total hours)
    const hrs = Math.floor(Store.s.totalFocusMin / 60);
    [1, 5, 10, 25, 50, 100].forEach(m => {
      if (hrs >= m) UI.celebrateMilestone(`focus_h_${m}`, `${m} Hour${m > 1 ? "s" : ""} of Deep Focus!`,
        `Aarush, you've now focused for ${m} total hour${m > 1 ? "s" : ""} inside DialedIn. That's real, banked effort.`, "🧠");
    });
    checkBadges();
    Store.save(); UI.refreshChips();
  }

  return {
    dailyQuote, triumphQuote, earnScale,
    level, xpForLevel, multiplier, addXP, addCoins, touchStreak,
    ensureDailyQuests, questProgress, QUEST_POOL,
    skillLevel, addSkill,
    createBoss, hitBoss,
    BADGES, checkBadges, totalTasksDone,
    SHOP, shopItem, buy, equip, addCustomReward, removeCustomReward,
    onTaskCompleted, onFocusMinutes,
  };
})();
