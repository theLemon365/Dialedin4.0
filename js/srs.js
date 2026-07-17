/* ==========================================================
   srs.js — Spaced Repetition Study Module for DialedIn
   Fulfills SM-2 scheduler, priority queuing, local state,
   keyboard navigation, and city-growth gamification.
   ========================================================== */
"use strict";

const SRS = (() => {
  const { $, $$, el, esc, toast, modal, congrats } = UI;

  // Initial dummy cards to populate if empty
  const DEFAULT_CARDS = [
    {
      id: "fc_default_1",
      front: "What is the primary mechanism of Spaced Repetition?",
      back: "Spaced repetition acts to flatten the Ebbinghaus forgetting curve by reviewing information at increasingly longer intervals, reinforcing the neural pathways just before they fade.",
      tags: "Psychology",
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: "" // will be initialized to today
    },
    {
      id: "fc_default_2",
      front: "How does the SuperMemo-2 (SM-2) algorithm update parameters?",
      back: "Grade >= 3: Reps 0 -> Int 1, Reps 1 -> Int 6, Reps > 1 -> Int = round(Int * EF). Reps increment by 1.\nGrade < 3: Reps = 0, Int = 1.\nIn both cases, EF is adjusted based on: EF' = EF + (0.1 - (5-grade)*(0.08 + (5-grade)*0.02)). Floor of 1.3.",
      tags: "Algorithms",
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: "" // today
    },
    {
      id: "fc_default_3",
      front: "Explain the difference between Active Recall and Passive Review.",
      back: "Active recall forces the brain to retrieve information from memory (e.g. answering a question from a flashcard), which strengthens retention. Passive review (re-reading notes) only builds recognition familiarity, not true recall.",
      tags: "Learning Theory",
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: "" // today
    },
    {
      id: "fc_default_4",
      front: "How do you handle keyboard shortcuts in DialedIn's study session?",
      back: "[Spacebar] reveals the answer side.\nPress [1] for Again, [2] for Hard, [3] for Good, and [4] for Easy to score and schedule.",
      tags: "DialedIn",
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: "" // today
    },
    {
      id: "fc_default_5",
      front: "Why is sleep critical for spaced-repetition performance?",
      back: "Sleep triggers synaptic consolidation, transferring temporary learning from the hippocampus to the long-term neocortex, stabilizing the intervals scheduled by SM-2.",
      tags: "Neuroscience",
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: "" // today
    }
  ];

  // State
  let sessionQueue = [];
  let currentCardIndex = -1;
  let isAnswerRevealed = false;
  let sessionActive = false;
  let deckSearchQuery = "";
  
  // Session tracking metrics
  let sessionInitialCount = 0;
  let sessionCorrectCount = 0;
  let sessionAgainCount = 0;

  // Initialize store and inject CSS styles
  function init() {
    if (!Store.s.flashcards) {
      const today = Store.todayStr();
      Store.s.flashcards = DEFAULT_CARDS.map(c => {
        c.nextReviewDate = today;
        return c;
      });
      Store.save();
    }
    injectStyles();
    initKeyboardListeners();
  }

  // Check if a session is currently running
  function isSessionActive() {
    return sessionActive && currentCardIndex >= 0 && currentCardIndex < sessionQueue.length;
  }

  // SM-2 Spaced Repetition Algorithm Implementation
  function scheduleCard(card, grade) {
    // grade: 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)
    let reps = card.repetitions || 0;
    let interval = card.interval || 1;
    let ef = card.easeFactor || 2.5;

    if (grade >= 3) {
      if (reps === 0) {
        interval = 1;
      } else if (reps === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ef);
      }
      reps += 1;
    } else {
      reps = 0;
      interval = 1;
    }

    // EF adjustment formula
    ef = ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (ef < 1.3) ef = 1.3;

    // Save back to card
    card.repetitions = reps;
    card.interval = interval;
    card.easeFactor = parseFloat(ef.toFixed(3));
    
    // Set next review date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + interval);
    card.nextReviewDate = Store.todayStr(targetDate);
    
    Store.save();
  }

  // Priority Queuing: overdue cards first, then new cards, then recently learned cards
  function getSortedDeck() {
    const today = Store.todayStr();
    return [...(Store.s.flashcards || [])].sort((a, b) => {
      // 1. Due date overdue check
      const aDue = a.nextReviewDate <= today;
      const bDue = b.nextReviewDate <= today;
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      // 2. New card check (repetitions = 0 is considered new)
      const aNew = (a.repetitions || 0) === 0;
      const bNew = (b.repetitions || 0) === 0;
      if (aNew && !bNew) return -1;
      if (!aNew && bNew) return 1;

      // 3. Sort by next review date ascending
      return (a.nextReviewDate || "").localeCompare(b.nextReviewDate || "");
    });
  }

  // Start study session
  function startSession(studyAll = false) {
    const today = Store.todayStr();
    let pool = Store.s.flashcards || [];

    if (!studyAll) {
      // Due today (overdue + new cards)
      pool = pool.filter(c => !c.nextReviewDate || c.nextReviewDate <= today || (c.repetitions || 0) === 0);
    }

    if (pool.length === 0) {
      toast("No cards due for review! Add some new cards or review all.");
      return;
    }

    // Shuffle study queue slightly but preserve overall priority queuing
    sessionQueue = [...pool].sort((a, b) => {
      // Overdue first
      const aOverdue = a.nextReviewDate <= today && (a.repetitions || 0) > 0;
      const bOverdue = b.nextReviewDate <= today && (b.repetitions || 0) > 0;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      // New cards second
      const aNew = (a.repetitions || 0) === 0;
      const bNew = (b.repetitions || 0) === 0;
      if (aNew && !bNew) return -1;
      if (!aNew && bNew) return 1;

      return Math.random() - 0.5; // slight random shuffle within equal tiers
    });

    sessionQueue = sessionQueue.map(c => ({ ...c })); // copy cards to prevent mutating queue directly during trial
    currentCardIndex = 0;
    isAnswerRevealed = false;
    sessionActive = true;

    // Reset tracking counters
    sessionInitialCount = sessionQueue.length;
    sessionCorrectCount = 0;
    sessionAgainCount = 0;

    AudioFX.play("click");
    render();
  }

  // Handle keyboard navigation for Spacebar and number grading keys
  function initKeyboardListeners() {
    window.addEventListener("keydown", e => {
      if (UI.currentView !== "srs" || !sessionActive) return;

      if (e.key === " ") {
        e.preventDefault();
        if (!isAnswerRevealed) {
          revealAnswer();
        }
      } else if (isAnswerRevealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const gradeMap = { "1": 1, "2": 3, "3": 4, "4": 5 };
        submitReview(gradeMap[e.key]);
      }
    });
  }

  // Reveal current card's answer
  function revealAnswer() {
    isAnswerRevealed = true;
    AudioFX.play("click");
    
    const cardEl = $("#srs-flip-card");
    if (cardEl) {
      cardEl.classList.add("flipped");
    }
    
    // Update active UI elements
    const revealBtn = $("#srs-reveal-btn");
    if (revealBtn) revealBtn.classList.add("hidden");

    const controls = $("#srs-grade-controls");
    if (controls) controls.classList.remove("hidden");
  }

  // Submit grading feedback
  function submitReview(grade) {
    if (currentCardIndex < 0 || currentCardIndex >= sessionQueue.length) return;

    const copyCard = sessionQueue[currentCardIndex];
    // Find real card in storage to update
    const realCard = Store.s.flashcards.find(c => c.id === copyCard.id);
    if (realCard) {
      scheduleCard(realCard, grade);
    }

    // Keep stats
    if (grade >= 3) {
      sessionCorrectCount++;
      toast("+XP", "xp", 800);
    } else {
      sessionAgainCount++;
      // If "Again" is chosen, push card to the end of the queue for immediate reinforcement!
      sessionQueue.push({ ...copyCard, repetitions: 0, interval: 1 });
      toast("Scheduled for re-test", "bad", 1200);
    }

    AudioFX.play("click");

    // Move to next card
    currentCardIndex++;
    isAnswerRevealed = false;

    if (currentCardIndex >= sessionQueue.length) {
      completeSession();
    } else {
      render();
    }
  }

  // Complete study session and grant gamification rewards
  function completeSession() {
    sessionActive = false;
    currentCardIndex = -1;

    // Gamification Integration
    const xpGranted = Game.addXP(60);
    Game.addCoins(25);
    
    // City builder contribution: Add +12 simulated focus hours to the Lower Manhattan Skyline!
    Store.s.simulatedFocusHours = (Store.s.simulatedFocusHours || 0) + 12;
    Store.save();

    // Celebrate milestone
    congrats(
      "Mental Discipline Unlocked! 🎓",
      `Aarush, you finished your Spaced Repetition deck! You earned +${xpGranted} XP, 25 Coins, and added +12 simulated hours to your NYC Focus District!`,
      "🧠"
    );

    // Refresh focus district simulator to pick up the updated hours immediately
    if (typeof District !== "undefined" && District.init) {
      District.init();
    }

    render();
  }

  // Create a brand new flashcard
  function createCard(front, back, tags) {
    if (!front.trim() || !back.trim()) {
      toast("Please provide both front and back content.");
      return;
    }

    const card = {
      id: "fc_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      front: front.trim(),
      back: back.trim(),
      tags: tags.trim() || "General",
      repetitions: 0,
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: Store.todayStr()
    };

    Store.s.flashcards.push(card);
    Store.save();
    toast("Flashcard created successfully!");
    render();
  }

  // Delete an existing flashcard
  function deleteCard(id) {
    Store.s.flashcards = Store.s.flashcards.filter(c => c.id !== id);
    Store.save();
    toast("Flashcard deleted.");
    render();
  }

  // Reset progress statistics on a single card
  function resetCardStats(id) {
    const card = Store.s.flashcards.find(c => c.id === id);
    if (card) {
      card.repetitions = 0;
      card.interval = 1;
      card.easeFactor = 2.5;
      card.nextReviewDate = Store.todayStr();
      Store.save();
      toast("Card stats reset to default scheduling.");
      render();
    }
  }

  // Open modal to edit flashcard content
  function openEditModal(id) {
    const card = Store.s.flashcards.find(c => c.id === id);
    if (!card) return;

    modal("✏️ Edit Flashcard", `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label class="muted" style="font-size:0.75rem; display:block; margin-bottom:4px;">FRONT (QUESTION/TERM)</label>
          <textarea id="edit-fc-front" class="field" style="width:100%; height:80px; font-family:inherit;">${esc(card.front)}</textarea>
        </div>
        <div>
          <label class="muted" style="font-size:0.75rem; display:block; margin-bottom:4px;">BACK (ANSWER/DEFINITION)</label>
          <textarea id="edit-fc-back" class="field" style="width:100%; height:110px; font-family:inherit;">${esc(card.back)}</textarea>
        </div>
        <div>
          <label class="muted" style="font-size:0.75rem; display:block; margin-bottom:4px;">TAGS</label>
          <input type="text" id="edit-fc-tags" class="field" style="width:100%;" value="${esc(card.tags || '')}" placeholder="e.g. Science, Tech">
        </div>
      </div>
    `, [
      { label: "Cancel", cls: "ghost" },
      { label: "Save Changes", cls: "primary", onClick: (m) => {
        const front = m.querySelector("#edit-fc-front").value;
        const back = m.querySelector("#edit-fc-back").value;
        const tags = m.querySelector("#edit-fc-tags").value;

        if (!front.trim() || !back.trim()) {
          toast("Please fill in both front and back.");
          return false;
        }

        card.front = front.trim();
        card.back = back.trim();
        card.tags = tags.trim() || "General";
        Store.save();
        toast("Card updated.");
        render();
        return true;
      }}
    ]);
  }

  // Generate HTML for Deck List Management View
  function renderDeckListHTML() {
    const cards = Store.s.flashcards || [];
    const today = Store.todayStr();
    
    const filtered = cards.filter(c => {
      const q = deckSearchQuery.toLowerCase();
      return c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q) || (c.tags || "").toLowerCase().includes(q);
    });

    const rows = filtered.map(c => {
      const isDue = c.nextReviewDate <= today || (c.repetitions || 0) === 0;
      const dueStatus = isDue ? `<span class="srs-badge due">Due Today</span>` : `<span class="srs-badge scheduled">In ${c.interval}d (${c.nextReviewDate})</span>`;
      
      return `
        <tr>
          <td><b style="color:var(--text);">${esc(c.front)}</b></td>
          <td><span class="muted" style="font-size:0.8rem; display:block; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(c.back)}">${esc(c.back)}</span></td>
          <td><span class="srs-tag">${esc(c.tags || "General")}</span></td>
          <td style="font-size:0.75rem;">${dueStatus}</td>
          <td style="font-size:0.72rem; color:var(--muted); text-align:center;">
            EF ${c.easeFactor} | Reps ${c.repetitions}
          </td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="icon-btn" data-edit-id="${c.id}" title="Edit Card">✏️</button>
            <button class="icon-btn" data-reset-id="${c.id}" title="Reset Stats">♻️</button>
            <button class="icon-btn danger" data-del-id="${c.id}" title="Delete Card">🗑️</button>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="card" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
          <div>
            <h3>🗃️ Deck Management</h3>
            <div class="card-sub">Browse, edit, delete, or reset parameters of cards in your learning database.</div>
          </div>
          <div style="display:flex; gap:8px;">
            <input type="text" id="srs-deck-search" class="field" placeholder="Search cards..." style="max-width:200px;" value="${esc(deckSearchQuery)}">
          </div>
        </div>
        
        <div style="overflow-x:auto;">
          <table class="srs-table">
            <thead>
              <tr>
                <th>Front (Question)</th>
                <th>Back (Answer)</th>
                <th>Category</th>
                <th>Status</th>
                <th style="text-align:center;">SM-2 Stats</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="6" class="muted" style="text-align:center; padding:24px;">No flashcards match your search filter.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Render the core SRS flashcard study view
  function render() {
    init();

    const v = $("#view-srs");
    if (!v) return;

    const cards = Store.s.flashcards || [];
    const today = Store.todayStr();
    
    // Counts
    const dueCount = cards.filter(c => !c.nextReviewDate || c.nextReviewDate <= today || (c.repetitions || 0) === 0).length;
    const totalCount = cards.length;

    // 1. If inside an active study session
    if (sessionActive && currentCardIndex < sessionQueue.length) {
      const card = sessionQueue[currentCardIndex];
      const progPercent = (currentCardIndex / sessionInitialCount) * 100;
      
      v.innerHTML = `
        <div class="srs-container">
          <!-- Session Header & Metrics -->
          <div class="card" style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
              <div>
                <h2>🎓 Active Study Session</h2>
                <div class="card-sub">Tap Spacebar to flip or 1-4 to grade. Real-time recall reinforcement.</div>
              </div>
              <button class="btn sm danger" id="srs-quit-btn">Quit Study</button>
            </div>
            
            <!-- Progress Bar Visualization -->
            <div class="srs-progress-wrapper" style="margin-top:12px;">
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px;" class="muted">
                <span>Reinforced: ${currentCardIndex} / ${sessionInitialCount} cards</span>
                <span>${Math.round(progPercent)}% Complete</span>
              </div>
              <div class="srs-progress-bar"><div class="srs-progress-fill" style="width:${progPercent}%;"></div></div>
            </div>
          </div>

          <!-- The Interactive Flashcard Card itself -->
          <div class="srs-flashcard-container">
            <div class="srs-flip-card" id="srs-flip-card">
              
              <!-- Front Side -->
              <div class="srs-card-face front">
                <span class="srs-card-tag">QUESTION · ${esc(card.tags || "General")}</span>
                <div class="srs-card-content">${esc(card.front)}</div>
                <div class="srs-card-footer muted">[ Click Card or press Spacebar to Reveal Answer ]</div>
              </div>

              <!-- Back Side -->
              <div class="srs-card-face back">
                <span class="srs-card-tag back-tag">ANSWER · ${esc(card.tags || "General")}</span>
                <div class="srs-card-content answer-text">${esc(card.back).replace(/\n/g, "<br>")}</div>
                <div class="srs-card-footer muted">Choose feedback rating to schedule next recall</div>
              </div>

            </div>
          </div>

          <!-- Bottom Control Panels -->
          <div class="srs-controls-panel">
            <button class="btn primary lg" id="srs-reveal-btn" style="width:100%; max-width:400px; margin:0 auto; display:block;">Reveal Answer <kbd style="margin-left:8px;">Space</kbd></button>
            
            <div class="srs-grade-controls hidden" id="srs-grade-controls" style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
              <button class="btn srs-grade-btn again" data-grade="1">
                <span class="emoji">❌</span>
                <b>Again</b>
                <span class="muted font-mono" style="font-size:0.65rem;">Reset interval [1]</span>
              </button>
              <button class="btn srs-grade-btn hard" data-grade="3">
                <span class="emoji">⚠️</span>
                <b>Hard</b>
                <span class="muted font-mono" style="font-size:0.65rem;">Short delay [2]</span>
              </button>
              <button class="btn srs-grade-btn good" data-grade="4">
                <span class="emoji">✅</span>
                <b>Good</b>
                <span class="muted font-mono" style="font-size:0.65rem;">SM-2 standard [3]</span>
              </button>
              <button class="btn srs-grade-btn easy" data-grade="5">
                <span class="emoji">🚀</span>
                <b>Easy</b>
                <span class="muted font-mono" style="font-size:0.65rem;">Multiply EF [4]</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // Event handlers inside session
      $("#srs-quit-btn").onclick = () => {
        sessionActive = false;
        render();
      };
      $("#srs-flip-card").onclick = () => {
        if (!isAnswerRevealed) revealAnswer();
      };
      $("#srs-reveal-btn").onclick = () => {
        revealAnswer();
      };
      v.querySelectorAll(".srs-grade-btn").forEach(btn => {
        btn.onclick = () => {
          submitReview(parseInt(btn.dataset.grade));
        };
      });
      return;
    }

    // 2. Deck Dashboard overview (the regular state)
    v.innerHTML = `
      <div class="srs-container">
        <!-- Dashboard banner & Quick metrics -->
        <div style="display:grid; grid-template-columns:1fr; gap:16px; margin-bottom:20px;" class="md:grid-cols-3">
          <div class="card md:col-span-2">
            <h2>🧠 Spaced Repetition Flashcards</h2>
            <p class="muted">DialedIn uses the SuperMemo-2 scheduling matrix to lock in concepts for the long haul. Reinforcing flashcards grants focus XP, coins, and grows your Lower Manhattan skyline.</p>
            
            <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
              <button class="btn primary" id="srs-start-due" ${dueCount === 0 ? "disabled" : ""}>Study Due Today (${dueCount})</button>
              <button class="btn" id="srs-start-all">Study All Cards (${totalCount})</button>
            </div>
          </div>

          <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <h3>📊 Recall Dashboard</h3>
              <div class="card-sub">Spaced retention overview</div>
            </div>
            
            <div style="display:flex; justify-content:space-around; margin:10px 0; text-align:center;">
              <div>
                <h1 style="font-size:2.2rem; color:var(--accent); font-weight:800;">${dueCount}</h1>
                <span class="muted" style="font-size:0.75rem;">DUE TODAY</span>
              </div>
              <div style="border-left:1px solid var(--line); height:40px; margin-top:10px;"></div>
              <div>
                <h1 style="font-size:2.2rem; color:var(--text); font-weight:800;">${totalCount}</h1>
                <span class="muted" style="font-size:0.75rem;">DECK SIZE</span>
              </div>
            </div>

            <p class="muted" style="font-size:0.75rem; text-align:center; background:rgba(255,255,255,0.02); padding:6px; border-radius:var(--radius-sm);">
              ${dueCount === 0 ? "🎉 Outstanding! You are 100% Dialed In today." : "⚠️ Reinforce due cards to prevent forgetting."}
            </p>
          </div>
        </div>

        <!-- Create New Card Form & Quick Add -->
        <div class="grid-2">
          <div class="card">
            <h3>📝 Quick Create Flashcard</h3>
            <div class="card-sub">Introduce new concepts or vocabulary to your memory bank.</div>
            
            <div style="display:flex; flex-direction:column; gap:12px; margin-top:12px;">
              <div>
                <label class="muted" style="font-size:0.7rem; display:block; margin-bottom:4px;">FRONT (QUESTION / TERM)</label>
                <input type="text" id="srs-new-front" class="field" style="width:100%;" placeholder="e.g. What is the Big O of Binary Search?">
              </div>
              <div>
                <label class="muted" style="font-size:0.7rem; display:block; margin-bottom:4px;">BACK (ANSWER / DEFINITION)</label>
                <textarea id="srs-new-back" class="field" style="width:100%; height:75px; font-family:inherit;" placeholder="e.g. O(log n), because the search space is divided by two at each step."></textarea>
              </div>
              <div>
                <label class="muted" style="font-size:0.7rem; display:block; margin-bottom:4px;">CATEGORIES / TAGS</label>
                <input type="text" id="srs-new-tags" class="field" style="width:100%;" placeholder="e.g. CS, Algorithms">
              </div>
              <button class="btn primary sm" id="srs-add-btn" style="margin-top:4px;">➕ Create Card</button>
            </div>
          </div>

          <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <h3>⌨️ Keyboard Study Hotkeys</h3>
              <div class="card-sub">Frictionless study workflow instructions</div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:8px; margin:12px 0;">
              <div class="stat-line"><span class="srs-key">Spacebar</span> <b>Flip & Reveal Answer</b></div>
              <div class="stat-line"><span class="srs-key">1</span> <b>Grade 'Again' (forgot)</b></div>
              <div class="stat-line"><span class="srs-key">2</span> <b>Grade 'Hard'</b></div>
              <div class="stat-line"><span class="srs-key">3</span> <b>Grade 'Good'</b></div>
              <div class="stat-line"><span class="srs-key">4</span> <b>Grade 'Easy'</b></div>
            </div>

            <div class="muted" style="font-size:0.75rem; text-align:center; padding:8px; border-radius:var(--radius-sm); border:1px dashed var(--line);">
              ⚡ Using keyboard hotkeys makes studying fast and highly interactive! Try it!
            </div>
          </div>
        </div>

        <!-- Render Deck list -->
        <div id="srs-deck-list-holder">
          ${renderDeckListHTML()}
        </div>
      </div>
    `;

    // Hook up dashboard actions
    $("#srs-start-due").onclick = () => startSession(false);
    $("#srs-start-all").onclick = () => startSession(true);
    $("#srs-add-btn").onclick = () => {
      const front = $("#srs-new-front").value;
      const back = $("#srs-new-back").value;
      const tags = $("#srs-new-tags").value;
      createCard(front, back, tags);
    };

    // Attach search event
    const searchInp = $("#srs-deck-search");
    if (searchInp) {
      searchInp.oninput = () => {
        deckSearchQuery = searchInp.value;
        const holder = $("#srs-deck-list-holder");
        if (holder) holder.innerHTML = renderDeckListHTML();
        attachTableListeners();
      };
    }

    attachTableListeners();
  }

  // Hook up event listeners for Edit/Delete/Reset buttons on table rows
  function attachTableListeners() {
    const v = $("#view-srs");
    if (!v) return;

    v.querySelectorAll("[data-edit-id]").forEach(btn => {
      btn.onclick = () => openEditModal(btn.dataset.editId);
    });

    v.querySelectorAll("[data-reset-id]").forEach(btn => {
      btn.onclick = () => {
        if (confirm("Reset recall history stats for this card? It will go back to Day 1 schedule.")) {
          resetCardStats(btn.dataset.resetId);
        }
      };
    });

    v.querySelectorAll("[data-del-id]").forEach(btn => {
      btn.onclick = () => {
        if (confirm("Are you sure you want to delete this flashcard permanently?")) {
          deleteCard(btn.dataset.delId);
        }
      };
    });
  }

  // Inject CSS styles optimized for standard night and minimal themes
  function injectStyles() {
    if ($("#srs-custom-styles")) return;

    const styles = el("style", "", `
      /* Spaced Repetition CSS Styles */
      .srs-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-bottom: 24px;
      }
      .srs-badge {
        display: inline-block;
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-weight: 700;
        text-transform: uppercase;
      }
      .srs-badge.due {
        background: var(--tint5);
        color: var(--bad);
        border: 1px solid rgba(217, 115, 111, 0.2);
      }
      .srs-badge.scheduled {
        background: var(--tint3);
        color: var(--good);
        border: 1px solid rgba(39, 166, 68, 0.2);
      }
      .srs-tag {
        display: inline-block;
        background: rgba(255, 255, 255, 0.05);
        padding: 1px 6px;
        border-radius: var(--radius-sm);
        font-size: 0.72rem;
        color: var(--muted2);
        border: 1px solid var(--line);
      }
      .srs-key {
        display: inline-block;
        background: var(--overlay2);
        border: 1px solid var(--line-strong);
        color: var(--text);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-family: var(--font-mono);
        font-size: 0.7rem;
        margin-right: 4px;
        font-weight: bold;
      }
      .srs-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.84rem;
      }
      .srs-table th {
        padding: 10px;
        color: var(--muted);
        font-weight: 600;
        font-size: 0.75rem;
        text-transform: uppercase;
        border-bottom: 1px solid var(--line-strong);
      }
      .srs-table td {
        padding: 10px;
        border-bottom: 1px solid var(--line);
      }
      .srs-table tr:hover td {
        background: rgba(255, 255, 255, 0.01);
      }

      /* Flashcard Flip Interface */
      .srs-flashcard-container {
        perspective: 1200px;
        width: 100%;
        max-width: 600px;
        height: 280px;
        margin: 16px auto;
      }
      .srs-flip-card {
        width: 100%;
        height: 100%;
        position: relative;
        transform-style: preserve-3d;
        transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
      }
      .srs-flip-card.flipped {
        transform: rotateY(180deg);
      }
      .srs-card-face {
        width: 100%;
        height: 100%;
        position: absolute;
        backface-visibility: hidden;
        border-radius: var(--radius-lg);
        border: 1px solid var(--line-strong);
        background: var(--card2);
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-shadow: var(--shadow-lg), 0 0 16px rgba(0,0,0,0.2);
        overflow-y: auto;
      }
      .srs-card-face.front {
        background: radial-gradient(circle at top left, var(--card2), rgba(94, 106, 210, 0.03));
      }
      .srs-card-face.back {
        transform: rotateY(180deg);
        background: radial-gradient(circle at bottom right, var(--card2), rgba(39, 166, 68, 0.03));
      }
      .srs-card-tag {
        font-size: 0.65rem;
        font-weight: bold;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
        border-bottom: 1px dashed var(--line);
        padding-bottom: 6px;
        width: 100%;
      }
      .srs-card-tag.back-tag {
        color: var(--good);
      }
      .srs-card-content {
        flex-grow: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 1.3rem;
        font-weight: 600;
        line-height: 1.5;
        color: var(--text);
        padding: 12px 0;
      }
      .srs-card-content.answer-text {
        font-size: 1.05rem;
        font-weight: 400;
        align-items: flex-start;
        text-align: left;
        justify-content: flex-start;
        overflow-y: auto;
      }
      .srs-card-footer {
        font-size: 0.72rem;
        text-align: center;
        letter-spacing: 0.02em;
        border-top: 1px solid var(--line);
        padding-top: 8px;
        width: 100%;
      }

      /* Study Grade Button Panels */
      .srs-grade-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 10px 16px !important;
        border-radius: var(--radius) !important;
        flex: 1;
        min-width: 110px;
        max-width: 150px;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.12s ease !important;
        border: 1px solid var(--line) !important;
        background: var(--card) !important;
      }
      .srs-grade-btn:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      .srs-grade-btn .emoji {
        font-size: 1.4rem;
        margin-bottom: 4px;
      }
      .srs-grade-btn b {
        font-size: 0.8rem;
        display: block;
        margin-bottom: 2px;
      }
      .srs-grade-btn.again {
        border-color: rgba(217, 115, 111, 0.4) !important;
      }
      .srs-grade-btn.again:hover {
        background: var(--tint5) !important;
      }
      .srs-grade-btn.hard {
        border-color: rgba(185, 141, 74, 0.4) !important;
      }
      .srs-grade-btn.hard:hover {
        background: var(--tint2) !important;
      }
      .srs-grade-btn.good {
        border-color: rgba(94, 106, 210, 0.4) !important;
      }
      .srs-grade-btn.good:hover {
        background: var(--tint1) !important;
      }
      .srs-grade-btn.easy {
        border-color: rgba(39, 166, 68, 0.4) !important;
      }
      .srs-grade-btn.easy:hover {
        background: var(--tint3) !important;
      }

      /* Progress Bars */
      .srs-progress-bar {
        background: rgba(255, 255, 255, 0.05);
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        width: 100%;
      }
      .srs-progress-fill {
        background: linear-gradient(90deg, var(--accent), var(--accent2));
        height: 100%;
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
    `);
    styles.id = "srs-custom-styles";
    document.head.appendChild(styles);
  }

  return {
    render,
    isSessionActive,
    startSession
  };
})();
