/* ==========================================================
   analytics.js — heatmap, energy curve, pie chart, streak
   calendar, comparisons, report card, timeline, predictions,
   session pause audit ledger, and multi-chart visualizer suite
   ========================================================== */
"use strict";

const Analytics = (() => {
  const { $, el, esc, toast, modal } = UI;

  const cssVar = name => getComputedStyle(document.body).getPropertyValue(name).trim();

  let activeTab = "flow";

  /* ---------- helpers ---------- */
  function lastNDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(Store.todayStr(new Date(Date.now() - i * 864e5)));
    return out;
  }
  const dayStat = d => Store.s.dayStats[d] || { focusMin: 0, tasksDone: 0, xp: 0, distracted: 0, sessions: 0 };

  function weekSum(offsetWeeks) {
    const days = lastNDays(7 * (offsetWeeks + 1)).slice(0, 7);
    return days.reduce((a, d) => a + dayStat(d).focusMin, 0);
  }

  /* ---------- session pause & duration ledger modal ---------- */
  function showSessionPauseLedger() {
    const history = Store.s.sessionHistory || [];
    
    let tableRows = "";
    if (history.length === 0) {
      tableRows = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 24px; color: var(--muted); font-style: italic; font-size: 0.8rem;">
            No focus sessions recorded in ledger yet. Complete a session to see entries!
          </td>
        </tr>
      `;
    } else {
      tableRows = history.map((s, idx) => {
        const sessionNum = idx + 1;
        const dateStr = s.ts ? new Date(s.ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';
        const title = esc(s.title || "Focus Session");
        const category = esc(s.category || "General");
        const duration = s.durationMin || 0;
        const pausedTime = s.lostMin || 0;
        const finished = s.finished !== false;
        
        return `
          <tr style="border-b: 1px solid rgba(255,255,255,0.06); transition: background 0.2s;">
            <td style="padding: 10px; font-family: monospace; font-size: 0.75rem; color: var(--muted);">${sessionNum}</td>
            <td style="padding: 10px; font-family: monospace; font-size: 0.75rem; color: var(--muted);">${dateStr}</td>
            <td style="padding: 10px;">
              <div style="font-weight: 600; color: #fff; font-size: 0.8rem;">${title}</div>
              <div style="font-size: 0.7rem; color: var(--accent); font-weight: 500;">${category}</div>
            </td>
            <td style="padding: 10px; font-weight: 600; color: #00ffff; font-family: monospace; font-size: 0.85rem;">${duration} <span style="font-size: 0.7rem; font-weight: normal; color: var(--muted);">m</span></td>
            <td style="padding: 10px; font-weight: 600; color: #ffd166; font-family: monospace; font-size: 0.85rem;">${pausedTime} <span style="font-size: 0.7rem; font-weight: normal; color: var(--muted);">m</span></td>
            <td style="padding: 10px;">
              <span style="padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; ${finished ? 'background: rgba(69,209,131,0.1); color: var(--good); border: 1px solid rgba(69,209,131,0.2);' : 'background: rgba(236,95,89,0.1); color: var(--bad); border: 1px solid rgba(236,95,89,0.2);'}">
                ${finished ? 'Completed' : 'Aborted'}
              </span>
            </td>
          </tr>
        `;
      }).reverse().join("");
    }

    modal("📋 Complete Session & Pause Duration Ledger", `
      <div style="max-height: 480px; overflow-y: auto; color: var(--text-light); padding-right: 4px;">
        <p style="font-size: 0.8rem; color: var(--muted); margin-bottom: 16px; line-height: 1.5;">
          This audit ledger tracks every recorded focus session, including the exact cumulative pause time, categories, duration, and session statuses.
        </p>
        <div style="overflow-x: auto; border-radius: 8px; border: 1px solid var(--line); background: rgba(0,0,0,0.25);">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
            <thead>
              <tr style="background: rgba(255,255,255,0.03); border-b: 1px solid var(--line); color: var(--text); font-weight: 600;">
                <th style="padding: 12px 10px;">#</th>
                <th style="padding: 12px 10px;">Timestamp</th>
                <th style="padding: 12px 10px;">Session Title / Skill</th>
                <th style="padding: 12px 10px;">Duration</th>
                <th style="padding: 12px 10px;">Time Paused</th>
                <th style="padding: 12px 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `);
  }

  /* ---------- render multi-chart visualizer suite tab ---------- */
  function renderSuiteTab(tab) {
    const port = document.getElementById("chart-suite-viewport");
    if (!port) return;

    // Toggle button active classes
    const btnFlow = document.getElementById("btn-chart-tab-flow");
    const btnTax = document.getElementById("btn-chart-tab-taxonomy");
    const btnTopo = document.getElementById("btn-chart-tab-topography");
    
    if (btnFlow) btnFlow.classList.toggle("active", tab === "flow");
    if (btnTax) btnTax.classList.toggle("active", tab === "taxonomy");
    if (btnTopo) btnTopo.classList.toggle("active", tab === "topography");

    if (tab === "flow") {
      // Stacked Area Chart & Scatter Plot
      const days = lastNDays(7);
      const focusData = days.map(d => dayStat(d).focusMin);
      const distractData = days.map(d => dayStat(d).distracted);
      
      const useMock = focusData.reduce((a, b) => a + b, 0) === 0;
      const displayFocus = useMock ? [25, 50, 45, 90, 60, 110, 75] : focusData;
      const displayDist = useMock ? [1, 2, 0, 3, 1, 2, 0] : distractData;
      const labels = days.map(d => {
        const parts = d.split("-");
        return `${parts[1]}/${parts[2]}`;
      });

      const width = 500;
      const height = 180;
      const padding = 20;
      const chartW = width - padding * 2;
      const chartH = height - padding * 2;
      const dx = chartW / 6;
      const maxVal = Math.max(10, ...displayFocus.map((f, i) => f + displayDist[i] * 10)); // Scale distractions slightly for better visualization

      // Build Stacked Area Path
      let focusPoints = "";
      let focusAreaPath = `M ${padding} ${height - padding} `;
      displayFocus.forEach((val, idx) => {
        const x = padding + idx * dx;
        const y = height - padding - (val / maxVal) * chartH;
        focusAreaPath += `L ${x} ${y} `;
        focusPoints += `<circle cx="${x}" cy="${y}" r="4" fill="#00ffff" stroke="#0c0e15" stroke-width="1.5" />`;
      });
      focusAreaPath += `L ${padding + 6 * dx} ${height - padding} Z`;

      let stackedAreaPath = `M ${padding} ${height - padding} `;
      let stackedPoints = "";
      displayFocus.forEach((val, idx) => {
        const x = padding + idx * dx;
        const totalVal = val + (displayDist[idx] * 10);
        const y = height - padding - (totalVal / maxVal) * chartH;
        stackedAreaPath += `L ${x} ${y} `;
        stackedPoints += `<circle cx="${x}" cy="${y}" r="4" fill="#ff00ff" stroke="#0c0e15" stroke-width="1.5" />`;
      });
      stackedAreaPath += `L ${padding + 6 * dx} ${height - padding} Z`;

      // Build Scatter Plot
      const sessions = Store.s.sessionHistory || [];
      const hasSessions = sessions.length > 0;
      const scatterSessions = hasSessions ? sessions : [
        { durationMin: 25, lostMin: 2, title: "Database Architecture", finished: true },
        { durationMin: 50, lostMin: 5, title: "Refactoring Server", finished: true },
        { durationMin: 15, lostMin: 0, title: "Email Inbox Zero", finished: true },
        { durationMin: 90, lostMin: 12, title: "Product Feature Spec", finished: false },
        { durationMin: 45, lostMin: 1, title: "Algorithm Design", finished: true },
        { durationMin: 120, lostMin: 18, title: "Deep Focus Sprint", finished: true }
      ];

      const scatterWidth = 500;
      const scatterHeight = 180;
      const maxDuration = Math.max(120, ...scatterSessions.map(s => s.durationMin));
      const maxLost = Math.max(15, ...scatterSessions.map(s => s.lostMin));

      const scatterDots = scatterSessions.map(s => {
        const cx = padding + ((s.durationMin / maxDuration) * (scatterWidth - padding * 2));
        const cy = scatterHeight - padding - ((s.lostMin / Math.max(1, maxLost)) * (scatterHeight - padding * 2));
        const color = s.finished ? "#a855f7" : "#ff4545";
        return `<circle cx="${cx}" cy="${cy}" r="6" fill="${color}" opacity="0.85" style="cursor: pointer;" title="${esc(s.title)}: ${s.durationMin}m focused, ${s.lostMin}m paused"/>`;
      }).join("");

      port.innerHTML = `
        <div class="grid-2" style="gap: 20px;">
          <div class="card-sub" style="padding: 14px; background: rgba(0,0,0,0.15); border: 1px solid var(--line); border-radius: var(--radius-sm);">
            <h4 style="margin:0 0 8px 0; font-size:0.85rem; color:var(--text); display:flex; justify-content:space-between;">
              <span>📈 Stacked Area: Cumulative Flow Daily</span>
              ${useMock ? '<span class="tag sm" style="font-size:0.6rem; background:rgba(255,215,0,0.1); color:#ffd166;">SAMPLE DATA</span>' : '<span class="tag sm" style="font-size:0.6rem; background:rgba(69,209,131,0.1); color:#45d183;">LIVE STATE</span>'}
            </h4>
            <div style="width:100%; overflow-x:auto;">
              <svg viewBox="0 0 500 180" width="100%" height="150" style="display:block;">
                <defs>
                  <linearGradient id="grad-focus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#00ffff" stop-opacity="0.32"/>
                    <stop offset="100%" stop-color="#00ffff" stop-opacity="0.0"/>
                  </linearGradient>
                  <linearGradient id="grad-dist" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ff00ff" stop-opacity="0.22"/>
                    <stop offset="100%" stop-color="#ff00ff" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>
                <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                <path d="${stackedAreaPath}" fill="url(#grad-dist)" />
                <path d="${focusAreaPath}" fill="url(#grad-focus)" />
                <path d="${stackedAreaPath.replace(/Z$/, '')}" fill="none" stroke="#ff00ff" stroke-width="2" />
                <path d="${focusAreaPath.replace(/Z$/, '')}" fill="none" stroke="#00ffff" stroke-width="2.5" />
                ${stackedPoints}
                ${focusPoints}
                ${labels.map((l, i) => `<text x="${padding + i * dx}" y="${height - 4}" fill="var(--muted)" font-size="8" text-anchor="middle">${l}</text>`).join("")}
              </svg>
            </div>
            <div style="display:flex; justify-content:center; gap:16px; font-size:0.7rem; margin-top:8px;">
              <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:2px; background:#00ffff; display:inline-block;"></span> Deep Focus Min</span>
              <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:2px; background:#ff00ff; display:inline-block;"></span> Paused/Distracted Intensity</span>
            </div>
          </div>

          <div class="card-sub" style="padding: 14px; background: rgba(0,0,0,0.15); border: 1px solid var(--line); border-radius: var(--radius-sm);">
            <h4 style="margin:0 0 8px 0; font-size:0.85rem; color:var(--text); display:flex; justify-content:space-between;">
              <span>🎯 Scatter Plot: Duration vs Distraction</span>
              ${!hasSessions ? '<span class="tag sm" style="font-size:0.6rem; background:rgba(255,215,0,0.1); color:#ffd166;">SAMPLE DATA</span>' : '<span class="tag sm" style="font-size:0.6rem; background:rgba(69,209,131,0.1); color:#45d183;">LIVE STATE</span>'}
            </h4>
            <div style="width:100%; overflow-x:auto;">
              <svg viewBox="0 0 500 180" width="100%" height="150" style="display:block;">
                <line x1="${padding}" y1="${scatterHeight - padding}" x2="${scatterWidth - padding}" y2="${scatterHeight - padding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${scatterHeight - padding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                ${scatterDots}
                <text x="${scatterWidth / 2}" y="${scatterHeight - 2}" fill="var(--muted)" font-size="8" text-anchor="middle">Session Duration (minutes) ➡️</text>
                <text x="4" y="${scatterHeight / 2}" fill="var(--muted)" font-size="8" text-anchor="middle" transform="rotate(-90 4 ${scatterHeight / 2})">Paused Duration (m) ➡️</text>
              </svg>
            </div>
            <div style="display:flex; justify-content:center; gap:16px; font-size:0.7rem; margin-top:8px;">
              <span style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:50%; background:#a855f7; display:inline-block;"></span> Completed Session</span>
              <span style="display:flex; align-items:center; gap:4px;"><span style="width:8px; height:8px; border-radius:50%; background:#ff4545; display:inline-block;"></span> Aborted/Strict Failed</span>
            </div>
          </div>
        </div>
      `;
    } else if (tab === "taxonomy") {
      // Donut Chart & Funnel Chart
      const plCounts = {};
      Store.s.procrastinationLog.forEach(p => plCounts[p.reason] = (plCounts[p.reason] || 0) + 1);
      const entries = Object.entries(plCounts).sort((a, b) => b[1] - a[1]);
      const hasPL = entries.length > 0;
      const donutData = hasPL ? entries : [["Fear of Failure", 6], ["Overwhelm", 4], ["Boredom", 3], ["Fatigue", 2]];
      const totalProcrastinations = donutData.reduce((a, b) => a + b[1], 0);

      const width = 200;
      const height = 180;
      const radius = 60;
      const cx = 100;
      const cy = 90;
      const colors = ["#8a2be2", "#ff00ff", "#00ffff", "#ffff00", "#ff4545"];
      
      let donutSlices = "";
      let accumAngle = -Math.PI / 2;
      donutData.forEach(([reason, val], i) => {
        const sliceAngle = (val / totalProcrastinations) * Math.PI * 2;
        const x1 = cx + radius * Math.cos(accumAngle);
        const y1 = cy + radius * Math.sin(accumAngle);
        const x2 = cx + radius * Math.cos(accumAngle + sliceAngle);
        const y2 = cy + radius * Math.sin(accumAngle + sliceAngle);
        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
        donutSlices += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}" stroke="#0c0e15" stroke-width="1.5" />`;
        accumAngle += sliceAngle;
      });

      const todoCount = Store.s.tasks.filter(t => t.status === "todo").length;
      const doingCount = Store.s.tasks.filter(t => t.status === "doing").length;
      const doneCount = Store.s.tasks.filter(t => t.status === "done").length;
      const hasTasks = (todoCount + doingCount + doneCount) > 0;

      const pipeline = [
        { label: "1. Backlog & Queue", count: hasTasks ? (todoCount + doingCount + doneCount) : 15, width: 220, col: "#00ffff" },
        { label: "2. Active Focus (Doing)", count: hasTasks ? (doingCount + doneCount) : 9, width: 150, col: "#a855f7" },
        { label: "3. Shipped (Done)", count: hasTasks ? doneCount : 6, width: 90, col: "#45d183" }
      ];

      const funnelRows = pipeline.map((p, idx) => {
        const rowH = 34;
        const topY = 24 + idx * 46;
        const bottomY = topY + rowH;
        const midX = 250;
        const nextP = pipeline[idx + 1];
        const nextW = nextP ? nextP.width : p.width * 0.6;
        
        const ptTopLeft = `${midX - p.width / 2},${topY}`;
        const ptTopRight = `${midX + p.width / 2},${topY}`;
        const ptBotRight = `${midX + nextW / 2},${bottomY}`;
        const ptBotLeft = `${midX - nextW / 2},${bottomY}`;
        
        return `
          <polygon points="${ptTopLeft} ${ptTopRight} ${ptBotRight} ${ptBotLeft}" fill="${p.col}" opacity="0.18" stroke="${p.col}" stroke-width="1.5" style="filter: drop-shadow(0 0 2px ${p.col})" />
          <text x="${midX}" y="${topY + 20}" fill="#ffffff" font-size="10" font-weight="700" text-anchor="middle">${esc(p.label)} (${p.count})</text>
        `;
      }).join("");

      port.innerHTML = `
        <div class="grid-2" style="gap: 20px;">
          <div class="card-sub" style="padding: 14px; background: rgba(0,0,0,0.15); border: 1px solid var(--line); border-radius: var(--radius-sm); display:flex; flex-direction:column; align-items:center;">
            <h4 style="margin:0 0 8px 0; font-size:0.85rem; color:var(--text); width:100%; display:flex; justify-content:space-between;">
              <span>🍩 Procrastination Donut Chart</span>
              ${!hasPL ? '<span class="tag sm" style="font-size:0.6rem; background:rgba(255,215,0,0.1); color:#ffd166;">SAMPLE DATA</span>' : '<span class="tag sm" style="font-size:0.6rem; background:rgba(69,209,131,0.1); color:#45d183;">LIVE STATE</span>'}
            </h4>
            <div style="display:flex; align-items:center; width:100%; justify-content:space-evenly; flex-wrap:wrap; gap:12px;">
              <div style="position:relative; width:130px; height:130px;">
                <svg viewBox="0 0 200 180" width="100%" height="100%">
                  ${donutSlices}
                  <circle cx="${cx}" cy="${cy}" r="38" fill="#111218" />
                </svg>
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; font-family:var(--font-mono); line-height:1.1;">
                  <span style="font-size:1rem; font-weight:700; color:var(--text);">${totalProcrastinations}</span>
                  <span style="font-size:0.55rem; color:var(--muted); display:block; text-transform:uppercase;">Halts</span>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; gap:6px; font-size:0.72rem; min-width:140px;">
                ${donutData.map(([reason, val], i) => `
                  <div style="display:flex; align-items:center; gap:6px; color:var(--text-light);">
                    <span style="width:8px; height:8px; background:${colors[i % colors.length]}; border-radius:2px; display:inline-block;"></span>
                    <span>${esc(reason)} (${Math.round(val / totalProcrastinations * 100)}%)</span>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>

          <div class="card-sub" style="padding: 14px; background: rgba(0,0,0,0.15); border: 1px solid var(--line); border-radius: var(--radius-sm);">
            <h4 style="margin:0 0 8px 0; font-size:0.85rem; color:var(--text); display:flex; justify-content:space-between;">
              <span>🔻 Funnel: Task Pipe Conversions</span>
              ${!hasTasks ? '<span class="tag sm" style="font-size:0.6rem; background:rgba(255,215,0,0.1); color:#ffd166;">SAMPLE DATA</span>' : '<span class="tag sm" style="font-size:0.6rem; background:rgba(69,209,131,0.1); color:#45d183;">LIVE STATE</span>'}
            </h4>
            <div style="width:100%; overflow-x:auto;">
              <svg viewBox="0 0 500 180" width="100%" height="150" style="display:block;">
                ${funnelRows}
              </svg>
            </div>
          </div>
        </div>
      `;
    } else if (tab === "topography") {
      // Treemap & Bubble Chart
      const skills = Store.s.skills || [];
      const hasXP = skills.some(s => s.xp > 0);
      const displaySkills = hasXP ? skills : [
        { name: "Coding", xp: 1200, icon: "💻", color: "#00ffff" },
        { name: "Reading", xp: 850, icon: "📚", color: "#9d6bff" },
        { name: "Fitness", xp: 600, icon: "💪", color: "#45d183" },
        { name: "Creative", xp: 400, icon: "🎨", color: "#ff00ff" },
        { name: "Life Admin", xp: 200, icon: "🏡", color: "#ffd166" }
      ];

      const totalXP = displaySkills.reduce((a, b) => a + b.xp, 0);

      const treemapW = 230;
      const treemapH = 150;
      
      let treemapHTML = "";
      let currentX = 0;
      let currentY = 0;
      let currentW = treemapW;
      let currentH = treemapH;

      const colors = ["#00ffff", "#a855f7", "#ff00ff", "#ffff00", "#45d183", "#ff6b6b"];

      displaySkills.forEach((s, idx) => {
        const ratio = s.xp / (totalXP || 1);
        let blockW, blockH;
        let blockX = currentX;
        let blockY = currentY;

        if (currentW > currentH) {
          blockW = currentW * ratio;
          blockH = currentH;
          currentX += blockW;
          currentW -= blockW;
        } else {
          blockW = currentW;
          blockH = currentH * ratio;
          currentY += blockH;
          currentH -= blockH;
        }

        const borderCol = s.color || colors[idx % colors.length];

        treemapHTML += `
          <div style="position:absolute; left:${blockX}px; top:${blockY}px; width:${blockW - 2}px; height:${blockH - 2}px; background:${borderCol}1a; border: 1px solid ${borderCol}; border-radius:4px; padding: 6px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; box-sizing:border-box;">
            <span style="font-size:1.15rem; margin-bottom:2px;">${s.icon || '🔬'}</span>
            <span style="font-size:0.65rem; font-weight:700; color:white; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; width:100%;">${esc(s.name)}</span>
            <span style="font-size:0.6rem; color:var(--muted); font-family:var(--font-mono);">${s.xp} XP</span>
          </div>
        `;
      });

      const focusLog = Store.s.focusLog || [];
      const hourBubbleData = Array(24).fill(0);
      focusLog.forEach(l => hourBubbleData[l.hour] += l.mins);
      
      const hasLog = focusLog.length > 0;
      const displayBubbles = hasLog ? hourBubbleData : [
        10, 0, 0, 0, 0, 15, 35, 45, 90, 60, 40, 75, 110, 85, 30, 45, 115, 125, 95, 60, 45, 20, 10, 5
      ];

      const bubbleWidth = 240;
      const bubbleHeight = 150;
      const pad = 12;
      const maxBubbleVal = Math.max(10, ...displayBubbles);
      
      let bubblesHTML = "";
      for (let h = 0; h < 24; h += 2) {
        const val = displayBubbles[h] || 0;
        const radius = Math.max(2, (val / maxBubbleVal) * 16);
        const cx = pad + (h / 24) * (bubbleWidth - pad * 2) + radius;
        const cy = bubbleHeight / 2;
        
        bubblesHTML += `
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#a855f7" opacity="0.65" style="filter:drop-shadow(0 0 3px #a855f7);" />
          <text x="${cx}" y="${bubbleHeight - 4}" fill="var(--muted)" font-size="7" text-anchor="middle">${h}h</text>
        `;
      }

      port.innerHTML = `
        <div class="grid-2" style="gap: 20px;">
          <div class="card-sub" style="padding: 14px; background: rgba(0,0,0,0.15); border: 1px solid var(--line); border-radius: var(--radius-sm);">
            <h4 style="margin:0 0 8px 0; font-size:0.85rem; color:var(--text); display:flex; justify-content:space-between;">
              <span>🗺️ Treemap: Skill Depth Weight</span>
              ${!hasXP ? '<span class="tag sm" style="font-size:0.6rem; background:rgba(255,215,0,0.1); color:#ffd166;">SAMPLE DATA</span>' : '<span class="tag sm" style="font-size:0.6rem; background:rgba(69,209,131,0.1); color:#45d183;">LIVE STATE</span>'}
            </h4>
            <div style="position:relative; width:100%; height:150px; overflow:hidden;">
              ${treemapHTML}
            </div>
          </div>

          <div class="card-sub" style="padding: 14px; background: rgba(0,0,0,0.15); border: 1px solid var(--line); border-radius: var(--radius-sm);">
            <h4 style="margin:0 0 8px 0; font-size:0.85rem; color:var(--text); display:flex; justify-content:space-between;">
              <span>🫧 Bubble Chart: Focus Density Curve</span>
              ${!hasLog ? '<span class="tag sm" style="font-size:0.6rem; background:rgba(255,215,0,0.1); color:#ffd166;">SAMPLE DATA</span>' : '<span class="tag sm" style="font-size:0.6rem; background:rgba(69,209,131,0.1); color:#45d183;">LIVE STATE</span>'}
            </h4>
            <div style="width:100%; overflow-x:auto;">
              <svg viewBox="0 0 240 150" width="100%" height="150" style="display:block;">
                <line x1="10" y1="75" x2="230" y2="75" stroke="rgba(255,255,255,0.06)" stroke-width="1.5" stroke-dasharray="3,3" />
                ${bubblesHTML}
              </svg>
            </div>
          </div>
        </div>
      `;
    }
  }

  /* ---------- render ---------- */
  function render() {
    const v = $("#view-analytics");
    const thisWeek = lastNDays(7).reduce((a, d) => a + dayStat(d).focusMin, 0);
    const lastWeek = lastNDays(14).slice(0, 7).reduce((a, d) => a + dayStat(d).focusMin, 0);
    let compareMsg;
    if (lastWeek === 0 && thisWeek === 0) compareMsg = "Start focusing to unlock week-over-week comparisons.";
    else if (lastWeek === 0) compareMsg = `🚀 ${thisWeek} focus minutes this week — your first tracked week!`;
    else {
      const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
      compareMsg = pct >= 0
        ? `📈 You are <b>${pct}% more focused</b> this week than last week (${thisWeek} vs ${lastWeek} min)!`
        : `📉 Down ${Math.abs(pct)}% vs last week (${thisWeek} vs ${lastWeek} min). One good session flips this.`;
    }

    const ratio = Store.s.focusBlocks > 0
      ? (Store.s.focusBlocks / Math.max(1, Store.s.distractions)).toFixed(1)
      : "—";

    const doneTasks = Store.s.tasks.filter(t => t.completedAt);
    const avgLife = doneTasks.length
      ? (doneTasks.reduce((a, t) => a + (t.completedAt - t.createdAt), 0) / doneTasks.length / 36e5).toFixed(1) + " hrs"
      : "—";

    const plCounts = {};
    Store.s.procrastinationLog.forEach(p => plCounts[p.reason] = (plCounts[p.reason] || 0) + 1);
    const topReason = Object.entries(plCounts).sort((a, b) => b[1] - a[1])[0];

    v.innerHTML = `
      <div class="card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h2>📊 Historical Comparison</h2>
          <p style="font-size:.95rem">${compareMsg}</p>
        </div>
        <button class="btn sm" id="btn-show-paused-sessions-ledger" style="background:rgba(138,43,226,0.15); color:#a855f7; border: 1px solid rgba(138,43,226,0.3); font-weight:600;">
          🔍 View Session Pause Ledger
        </button>
      </div>

      <div class="card"><h2>🟩 Focus Heatmap <span class="spacer"></span><span class="muted" style="font-size:.72rem">last 26 weeks</span></h2>
        <div class="heatmap" id="an-heatmap"></div>
      </div>

      <div class="grid-2">
        <div class="card"><h2>⚡ Energy Tracker <span class="spacer"></span><span class="muted" style="font-size:.72rem">focus min by hour of day</span></h2>
          <canvas class="chart" id="an-energy" height="180"></canvas>
          <div class="card-sub" id="an-peak"></div>
        </div>
        <div class="card"><h2>🥧 Focus Distribution</h2>
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <canvas id="an-pie" width="170" height="170"></canvas>
            <div class="pie-legend" id="an-pie-legend"></div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card"><h2>🗓️ Streak Calendar <span class="spacer"></span><span class="muted" style="font-size:.72rem">last 28 days</span></h2>
          <div class="streak-cal" id="an-streakcal"></div>
        </div>
        <div class="card"><h2>🔢 Core Stats</h2>
          <div class="stat-line"><span>Focus-to-distraction ratio</span><b>${ratio} : 1</b></div>
          <div class="stat-line"><span>Total focus time</span><b>${Math.floor(Store.s.totalFocusMin / 60)}h ${Store.s.totalFocusMin % 60}m</b></div>
          <div class="stat-line"><span>Sessions completed</span><b>${Store.s.sessionsCompleted}</b></div>
          <div class="stat-line"><span>Overtime worked</span><b>${Store.s.overtimeTotal} min</b></div>
          <div class="stat-line"><span>Avg task lifecycle (created → done)</span><b>${avgLife}</b></div>
          <div class="stat-line"><span>Best streak</span><b>${Store.s.bestStreak} days</b></div>
          <div class="stat-line"><span>Top avoidance reason</span><b>${topReason ? `${topReason[0]} (${topReason[1]}×)` : "—"}</b></div>
        </div>
      </div>

      <!-- 📊 Interactive Cybernetic Visualization Suite -->
      <div class="card" style="padding: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div>
            <h2 style="margin:0; font-size:1.25rem; display:flex; align-items:center; gap:8px;">
              <span>📊</span> Cybernetic Visualization Suite
            </h2>
            <p class="muted" style="margin:4px 0 0 0; font-size:0.8rem;">Deep multidimensional data analysis. Click tabs to cycle visualizers.</p>
          </div>
          <div style="display:flex; gap:4px; background:rgba(0,0,0,0.2); padding:3px; border-radius:6px; border:1px solid var(--line);">
            <button class="btn sm ghost active" id="btn-chart-tab-flow" style="font-size:0.75rem; padding: 4px 8px;">📈 Flow & Spire</button>
            <button class="btn sm ghost" id="btn-chart-tab-taxonomy" style="font-size:0.75rem; padding: 4px 8px;">🍩 Taxonomy</button>
            <button class="btn sm ghost" id="btn-chart-tab-topography" style="font-size:0.75rem; padding: 4px 8px;">🗺️ Topography</button>
          </div>
        </div>

        <div id="chart-suite-viewport" style="min-height: 200px; display:flex; flex-direction:column; justify-content:center; gap:20px; padding:12px 0;">
          <!-- Content dynamically rendered -->
        </div>
      </div>

      <div class="grid-2">
        <div class="card"><h2>🔮 Predictive Analytics</h2><div id="an-predict"></div></div>
        <div class="card"><h2>🏛️ Milestone Timeline</h2><div id="an-timeline" style="max-height:220px;overflow-y:auto"></div></div>
      </div>

      <div class="card"><h2>📋 Weekly Report Card <span class="spacer"></span>
        <button class="btn sm primary" id="an-download">⬇ Download report</button></h2>
        <div id="an-report"></div>
      </div>

      <div class="grid-2" style="margin-top:24px">
        <div class="card" style="display:flex; flex-direction:column; gap:12px;">
          <h2>🫠 Distraction & Refocus Logs</h2>
          <p class="muted">Every self-reported distraction is sent to DialedIn's Gemini AI engine for deep classification and personalized habit coaching.</p>
          <div style="max-height: 350px; overflow-y: auto; display:flex; flex-direction:column; gap:10px;" id="distraction-log-container">
            ${(Store.s.distractionsLog && Store.s.distractionsLog.length) ? Store.s.distractionsLog.map(d => `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px; font-size: 0.85rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                  <span style="font-weight: 700; color: #ff6b6b; font-size: 0.72rem; text-transform: uppercase; background: rgba(255,107,107,0.1); padding: 2px 6px; border-radius: 4px;">Category: ${esc(d.category || "General")}</span>
                  <span class="muted" style="font-size:0.75rem">${esc(new Date(d.ts).toLocaleString())}</span>
                </div>
                <p style="margin-bottom: 8px; font-style: italic; color: var(--text);">"${esc(d.text)}"</p>
                <div style="font-size:0.8rem; background: rgba(69, 209, 131, 0.05); border-left: 2px solid var(--good); padding: 6px 10px; border-radius: 2px; color: var(--text-light);">
                  💡 <b>Gemini Coach:</b> ${esc(d.advice || "Take a slow breath, shut any unrelated tabs, and re-engage your focused phase. You can do this!")}
                </div>
              </div>
            `).reverse().join("") : `<div class="muted" style="text-align:center; padding: 20px 0;">No self-reported distractions. Perfect focus record! ⚔️</div>`}
          </div>
        </div>

        <div class="card" style="display:flex; flex-direction:column; gap:12px;">
          <h2>💔 Abandoned Strict Sessions</h2>
          <p class="muted">Breaking strict focus locks down the application and turns a sector of your NYC Digital District offline/rusty.</p>
          <div style="max-height: 350px; overflow-y: auto; display:flex; flex-direction:column; gap:10px;" id="failed-sessions-container">
            ${(Store.s.failedSessionsLog && Store.s.failedSessionsLog.length) ? Store.s.failedSessionsLog.map(f => `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px; font-size: 0.85rem; border-left: 3px solid var(--bad);">
                <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                  <span style="font-weight: 700; color: var(--bad);">Session #${f.sessionNumber} Failed</span>
                  <span class="muted" style="font-size:0.75rem">${esc(new Date(f.ts).toLocaleString())}</span>
                </div>
                <p style="margin-bottom: 4px;">Task: <b>${esc(f.title)}</b></p>
                <p class="muted" style="font-size:0.78rem">Total Focus Time Thrown Away: <span style="color: #ff6b6b; font-weight:600;">${f.timeLostMins} mins</span></p>
              </div>
            `).reverse().join("") : `<div class="muted" style="text-align:center; padding: 20px 0;">No failed strict sessions. Your digital power grid is pristine! 🏙️</div>`}
          </div>
        </div>
      </div>`;

    renderHeatmap();
    renderEnergy();
    renderPie();
    renderStreakCal();
    renderPredict();
    renderTimeline();
    renderReport();
    
    // Bind ledger trigger
    const btnLedger = $("#btn-show-paused-sessions-ledger");
    if (btnLedger) btnLedger.onclick = showSessionPauseLedger;

    // Bind Cybernetic Visualizer Suite buttons
    const btnFlow = $("#btn-chart-tab-flow");
    const btnTax = $("#btn-chart-tab-taxonomy");
    const btnTopo = $("#btn-chart-tab-topography");

    if (btnFlow) {
      btnFlow.onclick = () => {
        activeTab = "flow";
        renderSuiteTab("flow");
      };
    }
    if (btnTax) {
      btnTax.onclick = () => {
        activeTab = "taxonomy";
        renderSuiteTab("taxonomy");
      };
    }
    if (btnTopo) {
      btnTopo.onclick = () => {
        activeTab = "topography";
        renderSuiteTab("topography");
      };
    }

    // Initialize suite render
    renderSuiteTab(activeTab);

    $("#an-download").onclick = downloadReport;
  }

  function renderHeatmap() {
    const wrap = $("#an-heatmap");
    const days = lastNDays(26 * 7);
    const firstDow = new Date(days[0] + "T12:00").getDay();
    for (let i = 0; i < firstDow; i++) wrap.appendChild(el("div", "hm-cell", ""));
    days.forEach(d => {
      const m = dayStat(d).focusMin;
      const lvl = m === 0 ? 0 : m < 25 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
      const c = el("div", "hm-cell");
      c.dataset.l = lvl;
      c.title = `${d}: ${m} focus min, ${dayStat(d).tasksDone} tasks`;
      wrap.appendChild(c);
    });
  }

  const SAMPLE_ENERGY = [0, 0, 0, 0, 0, 2, 6, 14, 22, 30, 26, 18, 12, 20, 28, 34, 30, 22, 16, 24, 18, 10, 4, 1];

  function renderEnergy() {
    const cv = $("#an-energy"), ctx = cv.getContext("2d");
    cv.width = cv.clientWidth * 2; cv.height = 360;
    const byHour = Array(24).fill(0);
    Store.s.focusLog.forEach(f => byHour[f.hour] += f.mins);
    const ghost = Math.max(...byHour) === 0;
    const data = ghost ? SAMPLE_ENERGY : byHour;
    const max = Math.max(1, ...data);
    const W = cv.width, H = cv.height, pad = 30;
    ctx.font = "20px Inter, sans-serif";
    const accent = cssVar("--accent") || "#6d7cff";
    const muted = cssVar("--muted") || "#888";
    const bw = (W - pad * 2) / 24;
    data.forEach((v2, h) => {
      const bh = (H - pad * 2) * (v2 / max);
      ctx.fillStyle = !ghost && v2 === max && max > 1 ? (cssVar("--gold") || "#ffd166") : accent;
      ctx.globalAlpha = ghost ? (v2 ? .15 : .05) : (v2 ? 1 : .12);
      const x = pad + h * bw + 3, y = H - pad - Math.max(bh, 4), w = bw - 6, hh = Math.max(bh, 4);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, hh, [5, 5, 0, 0]); else ctx.rect(x, y, w, hh);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (h % 4 === 0) { ctx.fillStyle = muted; ctx.fillText(String(h), pad + h * bw + 2, H - 6); }
    });
    if (ghost) {
      ctx.fillStyle = muted; ctx.textAlign = "center";
      ctx.font = "600 26px Inter, sans-serif";
      ctx.fillText("PREVIEW", W / 2, H / 2 - 14);
      ctx.font = "400 19px Inter, sans-serif";
      ctx.fillText("your real energy curve draws itself with every session", W / 2, H / 2 + 16);
      ctx.textAlign = "left";
    }
    const peak = byHour.indexOf(Math.max(...byHour));
    $("#an-peak").innerHTML = !ghost
      ? `Your peak hour so far: <b>${peak % 12 || 12}${peak < 12 ? " AM" : " PM"}</b> — guard it like treasure.`
      : "This is a sample shape — one focus session starts painting the real one.";
  }

  function renderPie() {
    const cv = $("#an-pie"), ctx = cv.getContext("2d");
    const bySkill = {};
    Store.s.focusLog.forEach(f => {
      const key = f.skill || "unsorted";
      bySkill[key] = (bySkill[key] || 0) + f.mins;
    });
    let entries = Object.entries(bySkill).sort((a, b) => b[1] - a[1]);
    let total = entries.reduce((a, e) => a + e[1], 0);
    const legend = $("#an-pie-legend");
    const ghost = !total;
    if (ghost) {
      entries = [["coding", 45], ["school", 30], ["reading", 15], ["fitness", 10]];
      total = 100;
      cv.style.opacity = ".22";
      legend.innerHTML = '<span class="muted">Sample preview — focus on any task and the real split appears here instantly.</span>';
    } else {
      cv.style.opacity = "1";
    }
    const colors = ["#6d7cff", "#9a8cff", "#3fbf76", "#d9a648", "#ec5f59", "#ff9e4a", "#4ec3c3", "#e87ca8"];
    let ang = -Math.PI / 2;
    entries.forEach(([k, v2], i) => {
      const slice = (v2 / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(85, 85);
      ctx.arc(85, 85, 80, ang, ang + slice - 0.02);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ang += slice;
      if (!ghost) {
        const sk = Store.s.skills.find(s => s.id === k);
        const name = sk ? `${sk.icon} ${sk.name}` : "🗂 Unsorted";
        legend.innerHTML += `<div><span class="dot" style="background:${colors[i % colors.length]}"></span>${name} — <b>${Math.round(v2 / total * 100)}%</b> (${v2}m)</div>`;
      }
    });
    ctx.beginPath(); ctx.arc(85, 85, 48, 0, Math.PI * 2);
    ctx.fillStyle = cssVar("--card") || "#101116"; ctx.fill();
    ctx.fillStyle = cssVar("--text") || "#e4e5e9";
    ctx.font = "700 20px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(ghost ? "—" : `${Math.floor(total / 60)}h${total % 60 ? " " + (total % 60) + "m" : ""}`, 85, 82);
    ctx.font = "500 10px Inter, sans-serif";
    ctx.fillStyle = cssVar("--muted") || "#7e828e";
    ctx.fillText(ghost ? "PREVIEW" : "TOTAL FOCUS", 85, 98);
  }

  function renderStreakCal() {
    const wrap = $("#an-streakcal");
    const today = Store.todayStr();
    lastNDays(28).forEach(d => {
      const s = dayStat(d);
      const hit = s.focusMin > 0 || s.tasksDone > 0;
      const c = el("div", `sc-cell ${hit ? "hit" : ""} ${d === today ? "today" : ""}`, hit ? "✕" : new Date(d + "T12:00").getDate());
      c.title = d;
      wrap.appendChild(c);
    });
  }

  function renderPredict() {
    const wrap = $("#an-predict");
    const bosses = Store.s.bosses.filter(b => !b.defeated && b.subs.some(s => s.done));
    let html = "";
    bosses.forEach(b => {
      const done = b.subs.filter(s => s.done).length;
      const daysSince = Math.max(1, (Date.now() - b.createdAt) / 864e5);
      const rate = done / daysSince;
      const remaining = b.subs.length - done;
      const eta = Math.ceil(remaining / rate);
      html += `<div class="stat-line"><span>${b.emoji} ${esc(b.name)}</span><b>~${eta} day${eta === 1 ? "" : "s"} at current pace</b></div>`;
    });
    const active = Store.s.tasks.filter(t => t.status === "todo" || t.status === "doing");
    const recent = lastNDays(7).reduce((a, d) => a + dayStat(d).tasksDone, 0) / 7;
    if (active.length && recent > 0) {
      html += `<div class="stat-line"><span>📋 Current backlog (${active.length} tasks)</span><b>~${Math.ceil(active.length / recent)} days to clear</b></div>`;
    }
    wrap.innerHTML = html || '<span class="muted">Work on a Boss or complete tasks to unlock predictions.</span>';
  }

  function renderTimeline() {
    const wrap = $("#an-timeline");
    const items = Store.s.milestones.slice().reverse();
    wrap.innerHTML = items.length
      ? items.map(m => `<div class="timeline-item"><span class="muted">${new Date(m.ts).toLocaleDateString()}</span><b>${esc(m.title)}</b></div>`).join("")
      : '<span class="muted">Your biggest wins will be immortalized here.</span>';
  }

  function reportData() {
    const days = lastNDays(7);
    const focus = days.reduce((a, d) => a + dayStat(d).focusMin, 0);
    const tasks = days.reduce((a, d) => a + dayStat(d).tasksDone, 0);
    const xp = days.reduce((a, d) => a + dayStat(d).xp, 0);
    const distracted = days.reduce((a, d) => a + dayStat(d).distracted, 0);
    const bestDay = days.slice().sort((a, b) => dayStat(b).focusMin - dayStat(a).focusMin)[0];
    return { days, focus, tasks, xp, distracted, bestDay };
  }

  function renderReport() {
    const r = reportData();
    const wins = [];
    const improve = [];
    if (r.focus >= 300) wins.push(`${Math.floor(r.focus / 60)}+ hours of deep focus`);
    else if (r.focus > 0) improve.push("Aim for a bit more total focus time next week");
    if (r.tasks >= 10) wins.push(`${r.tasks} tasks shipped`);
    else improve.push("Try clearing more small tasks — momentum compounds");
    if (Store.s.streak >= 3) wins.push(`${Store.s.streak}-day active streak`);
    else improve.push("Build a 3-day streak — show up tomorrow");
    if (r.distracted > 10) improve.push(`${r.distracted} distraction logs — consider Strict Mode or the ambient mixer`);
    else if (r.focus > 0) wins.push("Kept distractions low");

    $("#an-report").innerHTML = `
      <div class="stat-line"><span>Focus minutes (7d)</span><b>${r.focus}</b></div>
      <div class="stat-line"><span>Tasks completed (7d)</span><b>${r.tasks}</b></div>
      <div class="stat-line"><span>XP earned (7d)</span><b>${r.xp}</b></div>
      <div class="stat-line"><span>Best day</span><b>${r.bestDay} (${dayStat(r.bestDay).focusMin} min)</b></div>
      <div style="margin-top:10px"><b style="color:var(--good)">✅ Wins:</b> ${wins.join(" · ") || "This week is still unwritten."}</div>
      <div style="margin-top:6px"><b style="color:var(--gold)">🔧 Improve:</b> ${improve.join(" · ") || "Honestly? Just keep doing this."}</div>`;
  }

  function downloadReport() {
    const r = reportData();
    const lines = [
      `# DialedIn Weekly Report — Aarush`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `## Numbers (last 7 days)`,
      `- Focus minutes: ${r.focus}`,
      `- Tasks completed: ${r.tasks}`,
      `- XP earned: ${r.xp}`,
      `- Distractions logged: ${r.distracted}`,
      `- Current streak: ${Store.s.streak} days (best: ${Store.s.bestStreak})`,
      `- Level: ${Game.level().level} · Coins: ${Store.s.coins}`,
      ``,
      `## Day by day`,
      ...r.days.map(d => `- ${d}: ${dayStat(d).focusMin} min focus, ${dayStat(d).tasksDone} tasks`),
      ``,
      `Keep going. Future-you is watching. 🚀`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `focusquest-report-${Store.todayStr()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("📋 Report downloaded");
  }

  return { render };
})();
