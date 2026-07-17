/* ==========================================================
   excel.js — "Code Excel" Spreadsheet Engine (Linear Style)
   Provides standard Excel cell grids, formulas, toolbar formatting,
   CSV import/export, and multiple sheet tabs.
   ========================================================== */
"use strict";

const Excel = (() => {
  const { $, $$, el, esc, toast, modal } = UI;

  let activeCell = "A1";
  let editMode = false;
  let activeTabId = null;
  let rowSearchQuery = "";

  const DEFAULT_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const DEFAULT_ROWS_COUNT = 25;

  function init() {
    if (!Store.s.spreadsheets || !Store.s.spreadsheets.length) {
      Store.s.spreadsheets = [
        {
          id: "sheet_tracker",
          name: "Focus Ledger",
          data: {
            "A1": { "v": "Aarush's Productivity Ledger", "bold": true },
            "A2": { "v": "Use formulas like =SUM(B4:B6) or =B4*C4*2 to calculate metrics." },
            "A3": { "v": "Date", "bold": true }, "B3": { "v": "Duration (m)", "bold": true }, "C3": { "v": "Multiplier", "bold": true }, "D3": { "v": "XP Earned", "bold": true },
            "A4": { "v": "2026-07-12" }, "B4": { "v": "25" }, "C4": { "v": "1.0" }, "D4": { "v": "=B4*C4*2" },
            "A5": { "v": "2026-07-13" }, "B5": { "v": "50" }, "C5": { "v": "1.2" }, "D5": { "v": "=B5*C5*2" },
            "A6": { "v": "2026-07-14" }, "B6": { "v": "120" }, "C6": { "v": "1.5" }, "D6": { "v": "=B6*C6*2" },
            "A8": { "v": "Aggregate Metrics:", "bold": true },
            "A9": { "v": "Total focused mins" }, "B9": { "v": "=SUM(B4:B6)", "bold": true },
            "A10": { "v": "Average focus block" }, "B10": { "v": "=AVERAGE(B4:B6)", "bold": true },
            "A11": { "v": "Total XP generated" }, "D11": { "v": "=SUM(D4:D6)", "bold": true, "bg": "rgba(69, 209, 131, 0.15)" }
          },
          colsWidth: {},
          rowsHeight: {},
          cols: [...DEFAULT_COLS],
          rowsCount: DEFAULT_ROWS_COUNT
        },
        {
          id: "sheet_habits",
          name: "Habit Scorecard",
          data: {
            "A1": { "v": "Daily Habit Scorecard", "bold": true },
            "A3": { "v": "Habit", "bold": true }, "B3": { "v": "Mon", "bold": true }, "C3": { "v": "Tue", "bold": true }, "D3": { "v": "Wed", "bold": true }, "E3": { "v": "Thu", "bold": true }, "F3": { "v": "Fri", "bold": true }, "G3": { "v": "Total", "bold": true },
            "A4": { "v": "Hydration (8+ cups)" }, "B4": { "v": "1" }, "C4": { "v": "1" }, "D4": { "v": "0" }, "E4": { "v": "1" }, "F4": { "v": "1" }, "G4": { "v": "=SUM(B4:F4)" },
            "A5": { "v": "Breathing Routine" }, "B5": { "v": "1" }, "C5": { "v": "0" }, "D5": { "v": "1" }, "E5": { "v": "1" }, "F5": { "v": "0" }, "G5": { "v": "=SUM(B5:F5)" },
            "A6": { "v": "No Distractions" }, "B6": { "v": "0" }, "C6": { "v": "1" }, "D6": { "v": "1" }, "E6": { "v": "0" }, "F6": { "v": "1" }, "G6": { "v": "=SUM(B6:F6)" },
            "A8": { "v": "Total Habits Done:" }, "G8": { "v": "=B4+C4+D4+E4+F4+B5+C5+D5+E5+F5+B6+C6+D6+E6+F6", "bold": true }
          },
          colsWidth: {},
          rowsHeight: {},
          cols: [...DEFAULT_COLS],
          rowsCount: DEFAULT_ROWS_COUNT
        }
      ];
      Store.s.selectedSpreadsheetId = "sheet_tracker";
      Store.save();
    }
    activeTabId = Store.s.selectedSpreadsheetId;
  }

  function getActiveSheet() {
    init();
    return Store.s.spreadsheets.find(s => s.id === activeTabId) || Store.s.spreadsheets[0];
  }

  // --- Formula Parsing & Evaluation (Robust / Circular-safe) ---
  function isCellRef(str) {
    return /^[A-Z]+[0-9]+$/.test(str.toUpperCase());
  }

  function colIndex(name) {
    let index = 0;
    for (let i = 0; i < name.length; i++) {
      index = index * 26 + (name.charCodeAt(i) - 64);
    }
    return index;
  }

  function colName(index) {
    let name = "";
    while (index > 0) {
      let mod = (index - 1) % 26;
      name = String.fromCharCode(65 + mod) + name;
      index = Math.floor((index - mod) / 26);
    }
    return name;
  }

  function expandRange(rangeStr) {
    const parts = rangeStr.split(":");
    if (parts.length !== 2) return [];
    const start = parts[0].toUpperCase();
    const end = parts[1].toUpperCase();

    const startColMatch = start.match(/[A-Z]+/);
    const startRowMatch = start.match(/[0-9]+/);
    const endColMatch = end.match(/[A-Z]+/);
    const endRowMatch = end.match(/[0-9]+/);

    if (!startColMatch || !startRowMatch || !endColMatch || !endRowMatch) return [];

    const startCol = colIndex(startColMatch[0]);
    const startRow = parseInt(startRowMatch[0], 10);
    const endCol = colIndex(endColMatch[0]);
    const endRow = parseInt(endRowMatch[0], 10);

    const cells = [];
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);

    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        cells.push(colName(c) + r);
      }
    }
    return cells;
  }

  function evaluateCell(cellId, sheet, visited = new Set()) {
    if (visited.has(cellId)) return "#REF!";
    const cell = sheet.data[cellId];
    if (!cell || cell.v === undefined || cell.v === null || cell.v === "") return "";
    
    const val = String(cell.v);
    if (val.startsWith("=")) {
      visited.add(cellId);
      try {
        const res = parseAndEvalFormula(val.slice(1), sheet, visited);
        visited.delete(cellId);
        return res;
      } catch (e) {
        visited.delete(cellId);
        return "#VALUE!";
      }
    }
    
    if (!isNaN(val) && val !== "") {
      return parseFloat(val);
    }
    return val;
  }

  function parseAndEvalFormula(formulaStr, sheet, visited) {
    let expr = formulaStr.trim().toUpperCase();

    // Excel functions: SUM, AVERAGE, MIN, MAX, COUNT, CONCAT, PRODUCT, SQRT, POWER, ROUND, ABS, UPPER, LOWER, LEN, TRIM, IF
    const funcRegex = /(SUM|AVERAGE|MIN|MAX|COUNT|CONCAT|PRODUCT|SQRT|POWER|ROUND|ABS|UPPER|LOWER|LEN|TRIM|IF)\(([^)]*)\)/g;
    let matches;
    while ((matches = funcRegex.exec(expr)) !== null) {
      const fullMatch = matches[0];
      const funcName = matches[1];
      const argsStr = matches[2];
      
      const args = argsStr.split(",").map(a => a.trim());
      const cellValues = [];

      for (const arg of args) {
        if (arg.includes(":")) {
          const expanded = expandRange(arg);
          for (const cid of expanded) {
            const val = evaluateCell(cid, sheet, visited);
            if (val !== "") cellValues.push(val);
          }
        } else {
          if (isCellRef(arg)) {
            const val = evaluateCell(arg, sheet, visited);
            if (val !== "") cellValues.push(val);
          } else {
            const num = parseFloat(arg);
            if (!isNaN(num)) cellValues.push(num);
            else cellValues.push(arg);
          }
        }
      }

      let result = 0;
      if (funcName === "SUM") {
        result = cellValues.reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
      } else if (funcName === "AVERAGE") {
        const numbers = cellValues.filter(v => typeof v === "number");
        result = numbers.length ? numbers.reduce((sum, v) => sum + v, 0) / numbers.length : 0;
      } else if (funcName === "MIN") {
        const numbers = cellValues.filter(v => typeof v === "number");
        result = numbers.length ? Math.min(...numbers) : 0;
      } else if (funcName === "MAX") {
        const numbers = cellValues.filter(v => typeof v === "number");
        result = numbers.length ? Math.max(...numbers) : 0;
      } else if (funcName === "COUNT") {
        result = cellValues.filter(v => typeof v === "number").length;
      } else if (funcName === "CONCAT") {
        result = cellValues.join("");
      } else if (funcName === "PRODUCT") {
        const numbers = cellValues.filter(v => typeof v === "number");
        result = numbers.length ? numbers.reduce((prod, v) => prod * v, 1) : 0;
      } else if (funcName === "SQRT") {
        const first = typeof cellValues[0] === "number" ? cellValues[0] : parseFloat(cellValues[0]);
        result = !isNaN(first) && first >= 0 ? Math.sqrt(first) : 0;
      } else if (funcName === "POWER") {
        const base = typeof cellValues[0] === "number" ? cellValues[0] : parseFloat(cellValues[0]);
        const exp = typeof cellValues[1] === "number" ? cellValues[1] : parseFloat(cellValues[1]);
        result = !isNaN(base) && !isNaN(exp) ? Math.pow(base, exp) : 0;
      } else if (funcName === "ROUND") {
        const num = typeof cellValues[0] === "number" ? cellValues[0] : parseFloat(cellValues[0]);
        const decimals = typeof cellValues[1] === "number" ? cellValues[1] : parseInt(cellValues[1] || 0, 10);
        result = !isNaN(num) ? Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals) : 0;
      } else if (funcName === "ABS") {
        const val = typeof cellValues[0] === "number" ? cellValues[0] : parseFloat(cellValues[0]);
        result = !isNaN(val) ? Math.abs(val) : 0;
      } else if (funcName === "UPPER") {
        result = cellValues.map(v => String(v)).join(" ").toUpperCase();
      } else if (funcName === "LOWER") {
        result = cellValues.map(v => String(v)).join(" ").toLowerCase();
      } else if (funcName === "LEN") {
        result = cellValues.map(v => String(v)).join(" ").length;
      } else if (funcName === "TRIM") {
        result = cellValues.map(v => String(v)).join(" ").trim();
      } else if (funcName === "IF") {
        const conditionStr = args[0] || "FALSE";
        const trueVal = args[1] ? args[1].replace(/['"]/g, "") : "";
        const falseVal = args[2] ? args[2].replace(/['"]/g, "") : "";

        let parsedCond = conditionStr;
        const cellRefRegex = /\b([A-Z]+[0-9]+)\b/g;
        parsedCond = parsedCond.replace(cellRefRegex, (match) => {
          const val = evaluateCell(match, sheet, visited);
          return typeof val === "number" ? val : `"${val}"`;
        });

        let condMet = false;
        try {
          if (/^[A-Za-z0-9.><=!'"\-+*/() ]+$/.test(parsedCond)) {
            condMet = !!(new Function(`return (${parsedCond})`)());
          }
        } catch(e) {
          condMet = false;
        }

        let finalVal = condMet ? trueVal : falseVal;
        if (isCellRef(finalVal)) {
          finalVal = evaluateCell(finalVal, sheet, visited);
        }
        result = finalVal;
      }

      expr = expr.replace(fullMatch, typeof result === "number" ? result : `"${result}"`);
      funcRegex.lastIndex = 0; // reset
    }

    // Resolve standalone cells
    const cellRefRegex = /\b([A-Z]+[0-9]+)\b/g;
    expr = expr.replace(cellRefRegex, (match) => {
      const val = evaluateCell(match, sheet, visited);
      return typeof val === "number" ? val : `"${val}"`;
    });

    try {
      if (/^[0-9.+\-*/() ]+$/.test(expr)) {
        const res = new Function(`return (${expr})`)();
        return typeof res === "number" && !isNaN(res) ? Math.round(res * 100) / 100 : res;
      }
      return expr.replace(/['"]/g, "");
    } catch (err) {
      return expr.replace(/['"]/g, "");
    }
  }

  function sortSheetByActiveColumn(descending = false) {
    const sheet = getActiveSheet();
    const activeColMatch = activeCell.match(/^([A-Z]+)([0-9]+)$/);
    if (!activeColMatch) return;
    const col = activeColMatch[1];
    
    // Header row bounds (rows 1-3 are headers/labels in standard template)
    const headerRows = 3;
    const maxRow = sheet.rowsCount || DEFAULT_ROWS_COUNT;
    
    const rowsToSort = [];
    for (let r = headerRows + 1; r <= maxRow; r++) {
      const cid = `${col}${r}`;
      const val = evaluateCell(cid, sheet);
      rowsToSort.push({ rowNum: r, val: val });
    }
    
    rowsToSort.sort((a, b) => {
      const valA = a.val;
      const valB = b.val;
      if (typeof valA === "number" && typeof valB === "number") {
        return descending ? valB - valA : valA - valB;
      }
      return descending 
        ? String(valB).localeCompare(String(valA))
        : String(valA).localeCompare(String(valB));
    });
    
    const newData = {};
    for (const cid in sheet.data) {
      const matches = cid.match(/^([A-Z]+)([0-9]+)$/);
      if (matches && parseInt(matches[2], 10) <= headerRows) {
        newData[cid] = sheet.data[cid];
      }
    }
    
    rowsToSort.forEach((sortedItem, idx) => {
      const newRowNum = headerRows + 1 + idx;
      sheet.cols.forEach(colChar => {
        const oldCid = `${colChar}${sortedItem.rowNum}`;
        const newCid = `${colChar}${newRowNum}`;
        if (sheet.data[oldCid]) {
          newData[newCid] = sheet.data[oldCid];
        }
      });
    });
    
    sheet.data = newData;
    Store.save();
    renderView();
    toast(`Sorted sheet by column ${col} (${descending ? "Z-A" : "A-Z"})`, "good");
  }

  function renderSVGChart(sheet) {
    const labelRange = sheet.chartLabelRange || "";
    const dataRange = sheet.chartDataRange || "";
    const chartType = sheet.chartType || "bar";
    
    if (!labelRange || !dataRange) return "";
    
    const labelCells = expandRange(labelRange);
    const dataCells = expandRange(dataRange);
    
    if (!labelCells.length || !dataCells.length) return "";
    
    const points = [];
    let maxVal = 0;
    
    dataCells.forEach((cid, idx) => {
      const lCid = labelCells[idx];
      const val = parseFloat(evaluateCell(cid, sheet)) || 0;
      const label = lCid ? String(evaluateCell(lCid, sheet)) : "";
      points.push({ label, val });
      if (val > maxVal) maxVal = val;
    });
    
    if (maxVal === 0) maxVal = 100;
    
    const width = 500;
    const height = 180;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    let chartElements = "";
    
    if (chartType === "bar") {
      const barWidth = Math.max(8, (chartWidth / points.length) * 0.65);
      const colSpacing = chartWidth / points.length;
      
      points.forEach((pt, idx) => {
        const x = paddingLeft + idx * colSpacing + (colSpacing - barWidth) / 2;
        const barHeight = (pt.val / maxVal) * chartHeight;
        const y = paddingTop + chartHeight - barHeight;
        
        chartElements += `
          <g class="transition-all duration-300">
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="url(#barGrad)" rx="3" filter="url(#glow)"></rect>
            <text x="${x + barWidth / 2}" y="${height - 6}" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="monospace">${esc(pt.label)}</text>
            <text x="${x + barWidth / 2}" y="${y - 4}" fill="#22d3ee" font-size="9" text-anchor="middle" font-weight="bold" font-family="monospace">${pt.val}</text>
          </g>
        `;
      });
    } else {
      const colSpacing = chartWidth / (points.length - 1 || 1);
      let pathPoints = "";
      let markers = "";
      
      points.forEach((pt, idx) => {
        const x = paddingLeft + idx * colSpacing;
        const valHeight = (pt.val / maxVal) * chartHeight;
        const y = paddingTop + chartHeight - valHeight;
        
        pathPoints += `${idx === 0 ? "M" : "L"} ${x} ${y} `;
        
        markers += `
          <g>
            <circle cx="${x}" cy="${y}" r="4.5" fill="#f43f5e" stroke="#fff" stroke-width="2" filter="url(#glow)"></circle>
            <text x="${x}" y="${height - 6}" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="monospace">${esc(pt.label)}</text>
            <text x="${x}" y="${y - 8}" fill="#f43f5e" font-size="9" text-anchor="middle" font-weight="bold" font-family="monospace">${pt.val}</text>
          </g>
        `;
      });
      
      chartElements += `
        <path d="${pathPoints}" fill="none" stroke="#f43f5e" stroke-width="3" filter="url(#glow)"></path>
        ${markers}
      `;
    }
    
    return `
      <div class="p-5 rounded-2xl border border-slate-800 bg-slate-950/80 mb-6 flex flex-col md:flex-row gap-5" style="margin-top: 16px">
        <div class="flex-1 min-w-0">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span class="text-cyan-400">●</span> Live Visual Chart (${chartType === "bar" ? "Bar" : "Line"})
          </div>
          <svg viewBox="0 0 ${width} ${height}" class="w-full h-[180px]">
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#22d3ee" />
                <stop offset="100%" stop-color="#d946ef" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur>
                <feComposite in="SourceGraphic" in2="blur" operator="over"></feComposite>
              </filter>
            </defs>
            <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" stroke="#1e293b" stroke-dasharray="2 2"></line>
            <line x1="${paddingLeft}" y1="${paddingTop + chartHeight / 2}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight / 2}" stroke="#1e293b" stroke-dasharray="2 2"></line>
            <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="#334155"></line>
            
            <text x="${paddingLeft - 8}" y="${paddingTop + 4}" fill="#64748b" font-size="8" text-anchor="end" font-family="monospace">${Math.round(maxVal)}</text>
            <text x="${paddingLeft - 8}" y="${paddingTop + chartHeight / 2 + 3}" fill="#64748b" font-size="8" text-anchor="end" font-family="monospace">${Math.round(maxVal / 2)}</text>
            <text x="${paddingLeft - 8}" y="${paddingTop + chartHeight + 3}" fill="#64748b" font-size="8" text-anchor="end" font-family="monospace">0</text>
            
            ${chartElements}
          </svg>
        </div>
        <div class="w-full md:w-[190px] flex flex-col justify-between shrink-0 border-l border-slate-800/80 md:pl-5">
          <div class="text-[10px] text-slate-500 italic mb-2">Configure and redraw your custom metrics visualizer instantly.</div>
          <button class="btn sm danger text-[10px] w-full" id="excel-btn-delete-chart">✕ Remove Chart</button>
        </div>
      </div>
    `;
  }

  // --- Rendering and UI ---
  function getHTML() {
    init();
    const sheet = getActiveSheet();
    return `
      <div class="excel-container flex flex-col gap-3">
        <!-- Sheet Tabs Bar -->
        <div class="excel-tabs flex items-center justify-between">
          <div class="tab-list flex items-center gap-1">
            ${Store.s.spreadsheets.map(s => `
              <div class="excel-tab ${s.id === activeTabId ? "active" : ""}" data-tab-id="${s.id}">
                <span class="tab-name">${esc(s.name)}</span>
                ${Store.s.spreadsheets.length > 1 ? `<span class="tab-close" data-del-tab="${s.id}">✕</span>` : ""}
              </div>
            `).join("")}
            <button class="btn sm tab-add-btn" id="add-sheet-btn">＋ New Sheet</button>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn sm" id="excel-import-btn">📂 Import CSV</button>
            <button class="btn sm" id="excel-export-btn">📥 Export CSV</button>
          </div>
        </div>

        <!-- Excel Main Toolbar (Formatting Ribbon) -->
        <div class="excel-toolbar flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-1.5">
            <button class="tool-btn" id="excel-bold" title="Toggle Bold"><b>B</b></button>
            <button class="tool-btn" id="excel-italic" title="Toggle Italic"><i>I</i></button>
            <div class="divider"></div>
            <button class="tool-btn" id="excel-align-left" title="Align Left">⫷</button>
            <button class="tool-btn" id="excel-align-center" title="Align Center">≣</button>
            <button class="tool-btn" id="excel-align-right" title="Align Right">⫸</button>
            <div class="divider"></div>
            <label class="color-picker-label" title="Background Color">
              🎨 Bg
              <input type="color" id="excel-bg-color" value="#0c0e15">
            </label>
            <label class="color-picker-label" title="Text Color">
              ✏️ Color
              <input type="color" id="excel-text-color" value="#ffffff">
            </label>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button class="btn sm" id="excel-sort-asc" title="Sort Column ascending">Sort A-Z</button>
            <button class="btn sm" id="excel-sort-desc" title="Sort Column descending">Sort Z-A</button>
            <div class="divider"></div>
            <button class="btn sm" id="excel-add-row" title="Add Row below">+ Row</button>
            <button class="btn sm" id="excel-add-col" title="Add Column right">+ Col</button>
            <button class="btn sm bad" id="excel-clear" title="Clear this sheet">Clear Sheet</button>
          </div>
        </div>

        <!-- Searching, Filtering, and Advanced Data Tools -->
        <div class="p-3 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-between flex-wrap gap-3">
          <!-- Row Search / Search -->
          <div class="flex items-center gap-2 flex-1 min-w-[200px]">
            <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Search</span>
            <input type="text" id="excel-search-input" class="w-full max-w-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" placeholder="Type to filter sheet rows..." value="${esc(rowSearchQuery)}">
            ${rowSearchQuery ? `<button class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded" id="excel-clear-search">Clear</button>` : ""}
          </div>
          <!-- Chart Range Selector -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="text-slate-400 font-semibold uppercase tracking-wider">Chart:</span>
            <input type="text" id="excel-chart-labels" class="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs" placeholder="Labels e.g. A4:A6" value="${esc(sheet.chartLabelRange || "")}">
            <input type="text" id="excel-chart-data" class="w-18 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs" placeholder="Data e.g. B4:B6" value="${esc(sheet.chartDataRange || "")}">
            <select id="excel-chart-type" class="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs">
              <option value="bar" ${sheet.chartType === "bar" ? "selected" : ""}>Bar</option>
              <option value="line" ${sheet.chartType === "line" ? "selected" : ""}>Line</option>
            </select>
            <button class="btn sm primary text-xs" id="excel-btn-draw-chart">Draw Chart</button>
          </div>
        </div>

        <!-- Render visual SVG chart if configured -->
        ${renderSVGChart(sheet)}

        <!-- Formula Bar -->
        <div class="excel-formula-bar flex items-center">
          <div class="cell-ref" id="formula-cell-ref">${activeCell}</div>
          <div class="formula-fx"><i>fx</i></div>
          <input type="text" class="formula-input" id="formula-input-box" placeholder="Enter value or formula starting with =">
        </div>

        <!-- Sizable Cell Grid -->
        <div class="excel-grid-viewport">
          <table class="excel-table">
            <thead>
              <tr>
                <th class="row-index-head"></th>
                ${sheet.cols.map(c => `<th class="col-header" data-col="${c}">${c}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${Array.from({ length: sheet.rowsCount || DEFAULT_ROWS_COUNT }, (_, r) => {
                const rowNum = r + 1;
                
                // Search rows filter
                if (rowSearchQuery) {
                  let rowContainsQuery = false;
                  sheet.cols.forEach(col => {
                    const cid = `${col}${rowNum}`;
                    const val = evaluateCell(cid, sheet);
                    if (String(val).toLowerCase().includes(rowSearchQuery.toLowerCase())) {
                      rowContainsQuery = true;
                    }
                  });
                  // Rows 1-3 are headers/meta inside standard template, preserve them
                  if (rowNum > 3 && !rowContainsQuery) {
                    return ""; // skip row
                  }
                }

                return `
                  <tr>
                    <td class="row-index-cell">${rowNum}</td>
                    ${sheet.cols.map(col => {
                      const cid = `${col}${rowNum}`;
                      const cellData = sheet.data[cid] || {};
                      const evalValue = evaluateCell(cid, sheet);
                      
                      // Formatting styles
                      const isBold = !!cellData.bold;
                      const isItalic = !!cellData.italic;
                      const align = cellData.align || "left";
                      const customBg = cellData.bg || "";
                      const customColor = cellData.color || "";

                      const styleParts = [];
                      if (isBold) styleParts.push("font-weight: bold;");
                      if (isItalic) styleParts.push("font-style: italic;");
                      if (align) styleParts.push(`text-align: ${align};`);
                      if (customBg) styleParts.push(`background-color: ${customBg};`);
                      if (customColor) styleParts.push(`color: ${customColor};`);

                      const cellStyle = styleParts.length ? `style="${styleParts.join(" ")}"` : "";

                      return `
                        <td class="excel-cell ${cid === activeCell ? "selected" : ""}" 
                            data-cell-id="${cid}" 
                            ${cellStyle}>
                          <span class="cell-text-span">${esc(evalValue)}</span>
                        </td>
                      `;
                    }).join("")}
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <!-- Quick Help Card -->
        <div class="excel-help">
          💡 <b>Formulas list</b>: Supports basic math <code>=B4*C4+10</code>, ranges <code>=SUM(B4:B6)</code>, <code>=AVERAGE(B4:B6)</code>, <code>=MIN(B4:B6)</code>, <code>=MAX(B4:B6)</code>, <code>=PRODUCT(B4:C4)</code>, <code>=ROUND(B10, 2)</code>, and conditional statements <code>=IF(B4>30, "Complete", "Keep going")</code>. Double-click any cell to edit. Use keyboard arrow keys to navigate.
        </div>
      </div>
    `;
  }

  function renderView() {
    const v = $("#view-excel");
    if (!v) return;
    v.innerHTML = `
      <div class="card" style="margin-bottom: 24px">
        <h2>📊 Linear Spreadsheet Utility</h2>
        <p class="muted">Track focus sessions, calculate habit multipliers, or model your study goals in a linear, tabular interface.</p>
      </div>
      ${getHTML()}
    `;
    bindUI(v);
  }

  function bindUI(container) {
    // Tab switching
    container.querySelectorAll(".excel-tab").forEach(tab => {
      tab.onclick = (e) => {
        if (e.target.classList.contains("tab-close")) return;
        activeTabId = tab.dataset.tabId;
        Store.s.selectedSpreadsheetId = activeTabId;
        Store.save();
        renderView();
      };
    });

    // Delete Tab
    container.querySelectorAll("[data-del-tab]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const tid = btn.dataset.delTab;
        Store.s.spreadsheets = Store.s.spreadsheets.filter(s => s.id !== tid);
        if (activeTabId === tid) {
          activeTabId = Store.s.spreadsheets[0].id;
          Store.s.selectedSpreadsheetId = activeTabId;
        }
        Store.save();
        renderView();
        toast("🗑️ Sheet deleted");
      };
    });

    // Add Tab
    const addSheetBtn = container.querySelector("#add-sheet-btn");
    if (addSheetBtn) {
      addSheetBtn.onclick = () => {
        modal("📊 New Spreadsheet Tab", `
          <label class="field"><span>Sheet Name</span><input type="text" id="new-sheet-name" placeholder="E.g., Budget, Study Hours" value="Sheet ${Store.s.spreadsheets.length + 1}"></label>
        `, [
          { label: "Cancel" },
          { label: "Create", cls: "primary", onClick: m => {
            const name = m.querySelector("#new-sheet-name").value.trim() || "New Sheet";
            const id = "sheet_" + Date.now();
            Store.s.spreadsheets.push({
              id,
              name,
              data: {},
              cols: [...DEFAULT_COLS],
              rowsCount: DEFAULT_ROWS_COUNT,
              colsWidth: {},
              rowsHeight: {}
            });
            activeTabId = id;
            Store.s.selectedSpreadsheetId = id;
            Store.save();
            renderView();
            toast(`＋ Created "${name}"`);
          }}
        ]);
      };
    };

    // Double click to edit cell
    container.querySelectorAll(".excel-cell").forEach(cell => {
      cell.onclick = () => {
        selectCell(cell.dataset.cellId, container);
      };

      cell.ondblclick = () => {
        startEditingCell(cell, container);
      };
    });

    // Formula Input Bar changes
    const fib = container.querySelector("#formula-input-box");
    if (fib) {
      // populate with current cell raw value
      const sheet = getActiveSheet();
      const cellData = sheet.data[activeCell] || {};
      fib.value = cellData.v !== undefined ? cellData.v : "";

      fib.oninput = () => {
        updateActiveCellValue(fib.value, container, false);
      };

      fib.onkeydown = (e) => {
        if (e.key === "Enter") {
          updateActiveCellValue(fib.value, container, true);
          fib.blur();
        }
      };
    }

    // Bold formatting
    const btnBold = container.querySelector("#excel-bold");
    if (btnBold) {
      btnBold.onclick = () => {
        const sheet = getActiveSheet();
        sheet.data[activeCell] = sheet.data[activeCell] || { v: "" };
        sheet.data[activeCell].bold = !sheet.data[activeCell].bold;
        Store.save();
        renderView();
      };
    }

    // Italic formatting
    const btnItalic = container.querySelector("#excel-italic");
    if (btnItalic) {
      btnItalic.onclick = () => {
        const sheet = getActiveSheet();
        sheet.data[activeCell] = sheet.data[activeCell] || { v: "" };
        sheet.data[activeCell].italic = !sheet.data[activeCell].italic;
        Store.save();
        renderView();
      };
    }

    // Align formatting
    ["left", "center", "right"].forEach(dir => {
      const btn = container.querySelector(`#excel-align-${dir}`);
      if (btn) {
        btn.onclick = () => {
          const sheet = getActiveSheet();
          sheet.data[activeCell] = sheet.data[activeCell] || { v: "" };
          sheet.data[activeCell].align = dir;
          Store.save();
          renderView();
        };
      }
    });

    // Background color
    const bgPicker = container.querySelector("#excel-bg-color");
    if (bgPicker) {
      bgPicker.oninput = () => {
        const sheet = getActiveSheet();
        sheet.data[activeCell] = sheet.data[activeCell] || { v: "" };
        sheet.data[activeCell].bg = bgPicker.value;
        Store.save();
      };
      bgPicker.onchange = () => {
        renderView();
      };
    }

    // Text color
    const textPicker = container.querySelector("#excel-text-color");
    if (textPicker) {
      textPicker.oninput = () => {
        const sheet = getActiveSheet();
        sheet.data[activeCell] = sheet.data[activeCell] || { v: "" };
        sheet.data[activeCell].color = textPicker.value;
        Store.save();
      };
      textPicker.onchange = () => {
        renderView();
      };
    }

    // Add Row
    const btnAddRow = container.querySelector("#excel-add-row");
    if (btnAddRow) {
      btnAddRow.onclick = () => {
        const sheet = getActiveSheet();
        sheet.rowsCount = (sheet.rowsCount || DEFAULT_ROWS_COUNT) + 5;
        Store.save();
        renderView();
        toast("＋ Added 5 rows");
      };
    }

    // Add Column
    const btnAddCol = container.querySelector("#excel-add-col");
    if (btnAddCol) {
      btnAddCol.onclick = () => {
        const sheet = getActiveSheet();
        const lastCol = sheet.cols[sheet.cols.length - 1];
        const nextCol = colName(colIndex(lastCol) + 1);
        sheet.cols.push(nextCol);
        Store.save();
        renderView();
        toast(`＋ Added Column ${nextCol}`);
      };
    }

    // Clear sheet
    const btnClear = container.querySelector("#excel-clear");
    if (btnClear) {
      btnClear.onclick = () => {
        modal("🚨 Clear Spreadsheet", "<p>Are you sure you want to clear all data and styling in this spreadsheet tab? This cannot be undone.</p>", [
          { label: "Cancel" },
          { label: "Clear Sheet", cls: "bad", onClick: () => {
            const sheet = getActiveSheet();
            sheet.data = {};
            Store.save();
            renderView();
            toast("🧹 Sheet cleared");
          }}
        ]);
      };
    }

    // CSV Import
    const btnImport = container.querySelector("#excel-import-btn");
    if (btnImport) {
      btnImport.onclick = () => {
        const input = el("input");
        input.type = "file";
        input.accept = ".csv";
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const r = new FileReader();
          r.onload = (evt) => {
            importCSVData(evt.target.result);
          };
          r.readAsText(file);
        };
        input.click();
      };
    }

    // CSV Export
    const btnExport = container.querySelector("#excel-export-btn");
    if (btnExport) {
      btnExport.onclick = () => {
        exportCSVData();
      };
    }

    // Row search and filtering
    const searchIn = container.querySelector("#excel-search-input");
    if (searchIn) {
      searchIn.oninput = (e) => {
        rowSearchQuery = e.target.value.trim();
      };
      searchIn.onkeydown = (e) => {
        if (e.key === "Enter") {
          renderView();
        }
      };
    }
    const clearSearchBtn = container.querySelector("#excel-clear-search");
    if (clearSearchBtn) {
      clearSearchBtn.onclick = () => {
        rowSearchQuery = "";
        renderView();
      };
    }

    // Column sorting
    const btnSortAsc = container.querySelector("#excel-sort-asc");
    if (btnSortAsc) {
      btnSortAsc.onclick = () => sortSheetByActiveColumn(false);
    }
    const btnSortDesc = container.querySelector("#excel-sort-desc");
    if (btnSortDesc) {
      btnSortDesc.onclick = () => sortSheetByActiveColumn(true);
    }

    // Chart Configuration and Drawing
    const drawChartBtn = container.querySelector("#excel-btn-draw-chart");
    if (drawChartBtn) {
      drawChartBtn.onclick = () => {
        const sheet = getActiveSheet();
        const labelsIn = container.querySelector("#excel-chart-labels");
        const dataIn = container.querySelector("#excel-chart-data");
        const typeSel = container.querySelector("#excel-chart-type");
        
        sheet.chartLabelRange = labelsIn ? labelsIn.value.trim() : "";
        sheet.chartDataRange = dataIn ? dataIn.value.trim() : "";
        sheet.chartType = typeSel ? typeSel.value : "bar";
        
        Store.save();
        renderView();
        toast("📊 Rendered custom SVG chart!", "good");
      };
    }
    const deleteChartBtn = container.querySelector("#excel-btn-delete-chart");
    if (deleteChartBtn) {
      deleteChartBtn.onclick = () => {
        const sheet = getActiveSheet();
        delete sheet.chartLabelRange;
        delete sheet.chartDataRange;
        delete sheet.chartType;
        Store.save();
        renderView();
        toast("🗑️ Chart removed", "bad");
      };
    }

    // Keyboard Arrow navigation inside Spreadsheet
    bindKeyboardGridNavigation(container);
  }

  function selectCell(cellId, container) {
    activeCell = cellId;
    container.querySelectorAll(".excel-cell").forEach(c => c.classList.toggle("selected", c.dataset.cellId === cellId));
    container.querySelector("#formula-cell-ref").textContent = cellId;

    const sheet = getActiveSheet();
    const cellData = sheet.data[cellId] || {};
    const fib = container.querySelector("#formula-input-box");
    if (fib) {
      fib.value = cellData.v !== undefined ? cellData.v : "";
    }
  }

  function startEditingCell(cellEl, container) {
    if (editMode) return;
    editMode = true;

    const cid = cellEl.dataset.cellId;
    const sheet = getActiveSheet();
    const cellData = sheet.data[cid] || {};
    const currentVal = cellData.v !== undefined ? cellData.v : "";

    // Insert overlay input
    cellEl.innerHTML = `<input type="text" class="excel-cell-edit-input" value="${esc(currentVal)}">`;
    const inp = cellEl.querySelector(".excel-cell-edit-input");
    inp.focus();
    // Select all text
    inp.select();

    const finishEdit = (save) => {
      if (!editMode) return;
      editMode = false;
      const finalVal = inp.value;
      if (save) {
        updateActiveCellValue(finalVal, container, true);
      } else {
        renderView();
      }
    };

    inp.onblur = () => finishEdit(true);
    inp.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finishEdit(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finishEdit(false);
      }
    };
  }

  function updateActiveCellValue(value, container, triggerRender) {
    const sheet = getActiveSheet();
    sheet.data[activeCell] = sheet.data[activeCell] || {};
    sheet.data[activeCell].v = value;
    Store.save();

    if (triggerRender) {
      renderView();
    }
  }

  function bindKeyboardGridNavigation(container) {
    const onKey = (e) => {
      if (editMode) return; // ignore arrow keys when writing
      const view = $("#view-excel");
      if (!view || !view.classList.contains("active")) return;

      const matches = activeCell.match(/^([A-Z]+)([0-9]+)$/);
      if (!matches) return;
      
      const col = matches[1];
      const row = parseInt(matches[2], 10);
      const sheet = getActiveSheet();
      
      let newCol = col;
      let newRow = row;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        newRow = Math.max(1, row - 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        newRow = Math.min(sheet.rowsCount || DEFAULT_ROWS_COUNT, row + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const cIdx = sheet.cols.indexOf(col);
        if (cIdx > 0) newCol = sheet.cols[cIdx - 1];
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const cIdx = sheet.cols.indexOf(col);
        if (cIdx < sheet.cols.length - 1) newCol = sheet.cols[cIdx + 1];
      } else {
        return;
      }

      const newId = `${newCol}${newRow}`;
      if (newId !== activeCell) {
        selectCell(newId, container);
      }
    };

    // Remove any previous listener to avoid double-triggers
    window.removeEventListener("keydown", window.__excel_key_nav);
    window.__excel_key_nav = onKey;
    window.addEventListener("keydown", onKey);
  }

  // --- CSV Import/Export ---
  function importCSVData(csvText) {
    const sheet = getActiveSheet();
    const rows = csvText.split(/\r?\n/).filter(r => r.trim());
    if (!rows.length) return;

    sheet.data = {}; // Reset current sheet data
    
    rows.forEach((rowLine, rIdx) => {
      const rowNum = rIdx + 1;
      const cols = parseCSVLine(rowLine);
      
      cols.forEach((val, cIdx) => {
        if (cIdx < sheet.cols.length) {
          const colNameChar = sheet.cols[cIdx];
          const cid = `${colNameChar}${rowNum}`;
          sheet.data[cid] = { v: val };
        }
      });
    });

    if (rows.length > sheet.rowsCount) {
      sheet.rowsCount = rows.length + 5;
    }

    Store.save();
    renderView();
    toast("📂 CSV Imported Successfully!");
  }

  function parseCSVLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  function exportCSVData() {
    const sheet = getActiveSheet();
    const maxRow = sheet.rowsCount || DEFAULT_ROWS_COUNT;
    const csvLines = [];

    for (let r = 1; r <= maxRow; r++) {
      const rowVals = sheet.cols.map(col => {
        const cid = `${col}${r}`;
        const val = evaluateCell(cid, sheet);
        const strVal = String(val !== null && val !== undefined ? val : "");
        // Escape quotes
        if (strVal.includes(",") || strVal.includes('"') || strVal.includes("\n")) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
      // Skip trailing empty rows
      if (rowVals.every(v => v === "")) continue;
      csvLines.push(rowVals.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + csvLines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const linkEl = el("a");
    linkEl.setAttribute("href", encodedUri);
    linkEl.setAttribute("download", `spreadsheet_${sheet.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`);
    linkEl.click();
    toast("📥 CSV Export Triggered!");
  }

  return {
    init,
    getHTML,
    renderView,
    bindUI,
    getActiveSheet
  };
})();
