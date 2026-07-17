# ⚔️ DialedIn — Aarush's Productivity RPG

A gamified anti-procrastination dashboard. Zero dependencies, zero build step —
pure HTML/CSS/JS with everything stored locally in your browser (`localStorage`).

## Run it

Just open `index.html` in any modern browser, or serve the folder:

```powershell
cd FocusQuest
python -m http.server 8080   # then visit http://localhost:8080
```

## Layout philosophy (anti-chaos)

Everything lives in a **modular collapsible sidebar**. The dashboard shows only three zones:

- **The Now Zone** — the single task you're working on
- **The Pulse** — the active timer (Smart Pomodoro / Stopwatch / Just-5-Minutes)
- **The Progress** — level, XP bar, streak, coins, daily quests

## Feature map

| Area | Where |
|---|---|
| XP, levels, coins, streak multipliers | Top bar + Dashboard |
| Daily quests (3/day, randomized), badges | Game → Quests & Badges |
| Skill trees, Boss battles, Guild vs Procrastination Monster | Game → Skills & Bosses |
| Item shop, avatar skins/gear/pets, real-life rewards, prestige | Game → Shop & Avatar |
| Kanban, nested subtasks, smart tags, recurring, icebox, Eisenhower matrix, 2-min filter | Core → Tasks |
| Time-boxing drag & drop grid | Core → Timebox |
| Smart Pomodoro, strict mode, overtime tracker, ambient mixer, break ideas | Dashboard (The Pulse) |
| Brain dump, commitment wall, friction puzzles, micro-steps, procrastination log, forgiveness | Mind → Brain Dump + task actions |
| Heatmap, energy curve, pie chart, streak calendar, report card, predictions | Data → Analytics |
| Markdown notes, wiki links, templates, voice-to-text, exports | Mind → Notes |
| Daily journal prompt + gratitude corner | Mind → Journal |
| Hydration, mood, breathing, stretches, wind-down, step sync | Body → Wellness |
| IFTTT rules, focus scheduling, auto-clean, template scheduler, backup, prestige | System → Automation |
| Themes, fonts, custom CSS, SFX packs, profiles | System → Settings |

## Quick-add syntax

`Finish essay /today /high /45m #school @coding` — also `/tomorrow`, `/low`,
`/ice` (send to icebox), `/every-day`, `/every-week`, `/every-month`.

## Keyboard shortcuts

`1–9` switch views · `Space` start/pause timer · `z` Zen mode · `n` new task ·
`s` scratchpad · `b` sidebar · `?` help
