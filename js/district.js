/* ==========================================================
   district.js — Lower Manhattan Dusk Skyline Simulator
   Fulfills all architectural, environmental, lighting,
   and details constraints with rich 2D Canvas rendering.
   ========================================================== */
"use strict";

const District = (() => {
  const { $, el, esc, toast } = UI;

  // Shoreline geometry defining the Lower Manhattan peninsula (tapered south)
  const SHORELINE = [
    { x: -150, y: -250 }, // Northwest (Hudson)
    { x: -140, y: -100 },
    { x: -160, y: 50 },   // Battery Park City edge
    { x: -110, y: 150 },
    { x: -60, y: 220 },   // The Battery West
    { x: 0, y: 240 },     // The Battery Point (Southernmost Tip)
    { x: 60, y: 220 },    // The Battery East
    { x: 110, y: 150 },   // South Street Seaport
    { x: 150, y: 50 },    // East River Lower
    { x: 140, y: -100 },
    { x: 150, y: -250 }   // Northeast
  ];

  const BATTERY_PARK = [
    { x: -120, y: 110 },
    { x: -110, y: 150 },
    { x: -60, y: 210 },
    { x: 0, y: 230 },
    { x: 50, y: 210 },
    { x: 90, y: 150 },
    { x: 70, y: 110 },
    { x: 0, y: 80 }
  ];

  // Specific piers extending into the East & Hudson rivers
  const PIERS = [
    { x: -162, y: -20, w: 35, h: 12, rot: -0.1 }, // Hudson Piers
    { x: -165, y: 30, w: 32, h: 12, rot: -0.1 },
    { x: -160, y: 80, w: 30, h: 12, rot: -0.1 },
    { x: 152, y: 120, w: 32, h: 12, rot: 0.15 },  // East River Piers (Pier 15)
    { x: 148, y: 80, w: 35, h: 14, rot: 0.15 },   // Pier 17 Seaport
    { x: 155, y: 0, w: 30, h: 12, rot: 0.15 }
  ];

  // Bridges spanning the East River
  const BRIDGES = [
    {
      name: "Brooklyn Bridge",
      startX: 130, startY: -50,
      endX: 380, endY: -10,
      towerX: 200, towerY: -35,
      towerHeight: 75,
      color: "#999084" // stone grey
    },
    {
      name: "Manhattan Bridge",
      startX: 140, startY: -180,
      endX: 390, endY: -140,
      towerX: 210, towerY: -165,
      towerHeight: 65,
      color: "#547c9c" // steel blue
    }
  ];

  const DISTRICT_METADATA = {
    fidi: {
      id: "fidi",
      name: "Financial District",
      unlockHours: 0,
      color: "#10b981", // Emerald
      desc: "The historic powerhouse of Wall Street and One World Trade Center. Features deep canyons and towering finance monoliths.",
      landmark: "One World Trade Center"
    },
    tribeca: {
      id: "tribeca",
      name: "TriBeCa & SoHo",
      unlockHours: 25,
      color: "#fbbf24", // Amber
      desc: "A charming neighborhood of classic cast-iron warehouses, red-brick facades, cobblestones, and rooftop water towers.",
      landmark: "Washington Square Arch"
    },
    brooklyn: {
      id: "brooklyn",
      name: "Brooklyn & DUMBO",
      unlockHours: 100,
      color: "#3b82f6", // Blue
      desc: "Across the East River. Historic waterfront piers, converted brick warehouses, and stunning views of the Manhattan skyline.",
      landmark: "Brooklyn Bridge"
    },
    midtown: {
      id: "midtown",
      name: "Midtown Manhattan",
      unlockHours: 500,
      color: "#ec4899", // Pink
      desc: "The soaring, high-energy core of the metropolis. Features massive Art Deco legends, glittering billboard towers, and skyscrapers.",
      landmark: "Empire State & Chrysler Buildings"
    },
    centralpark: {
      id: "centralpark",
      name: "Central Park & West Side",
      unlockHours: 2000,
      color: "#14b8a6", // Teal
      desc: "A massive, lush green park surrounded by elegant pre-war co-ops and ultra-tall contemporary needle skyscrapers.",
      landmark: "Central Park & Needle Towers"
    }
  };

  const SIM_BUILDINGS = [
    // --- FINANCIAL DISTRICT (FiDi) ---
    { id: "wtc1", name: "One World Trade Center", cx: -90, cy: 110, w: 26, d: 26, h: 220, style: "wtc", baseColor: "#050a14", district: "fidi", unlockHours: 0 },
    { id: "wall40", name: "40 Wall Street", cx: -45, cy: 150, w: 20, d: 20, h: 165, style: "wall40", baseColor: "#03060c", district: "fidi", unlockHours: 10 },
    { id: "woolworth", name: "Woolworth Building", cx: -60, cy: 90, w: 18, d: 18, h: 145, style: "woolworth", baseColor: "#05060a", district: "fidi", unlockHours: 30 },
    { id: "pine70", name: "70 Pine Street", cx: -20, cy: 140, w: 18, d: 18, h: 160, style: "pine70", baseColor: "#04060a", district: "fidi", unlockHours: 60 },
    { id: "exchange20", name: "20 Exchange Place", cx: -30, cy: 180, w: 18, d: 18, h: 135, style: "setback", baseColor: "#050508", district: "fidi", unlockHours: 100 },
    { id: "gehry8", name: "8 Spruce Street (Gehry)", cx: -15, cy: 95, w: 16, d: 16, h: 150, style: "gehry", baseColor: "#04070d", district: "fidi", unlockHours: 150 },
    { id: "statue_of_liberty", name: "Statue of Liberty", cx: -150, cy: 190, w: 18, d: 18, h: 35, style: "statue_of_liberty", baseColor: "#1b2c26", district: "fidi", unlockHours: 200 },
    
    // --- TRIBECA & SOHO ---
    { id: "ghostbusters", name: "Hook & Ladder 8", cx: -50, cy: 40, w: 14, d: 16, h: 45, style: "brick", district: "tribeca", unlockHours: 25 },
    { id: "soho_loft_1", name: "Cast-Iron Loft Alpha", cx: -60, cy: 15, w: 16, d: 16, h: 55, style: "brick", baseColor: "#170807", district: "tribeca", unlockHours: 50 },
    { id: "washington_arch", name: "Washington Square Arch", cx: -10, cy: 20, w: 18, d: 10, h: 25, style: "washington_arch", baseColor: "#e5e7eb", district: "tribeca", unlockHours: 75 },
    { id: "soho_loft_2", name: "SoHo Grand Chambers", cx: -30, cy: 50, w: 18, d: 18, h: 65, style: "brick", baseColor: "#110b14", district: "tribeca", unlockHours: 120 },

    // --- BROOKLYN & DUMBO ---
    { id: "brooklyn_loft_1", name: "Empire Stores Loft", cx: 95, cy: 40, w: 20, d: 16, h: 38, style: "brick", baseColor: "#190806", district: "brooklyn", unlockHours: 100 },
    { id: "dumbo_clock", name: "DUMBO Clocktower", cx: 110, cy: 60, w: 16, d: 16, h: 70, style: "brick", baseColor: "#120a0a", district: "brooklyn", unlockHours: 150 },
    { id: "williamsburg_bank", name: "Williamsburgh Bank Tower", cx: 120, cy: 120, w: 18, d: 18, h: 110, style: "setback", baseColor: "#05060b", district: "brooklyn", unlockHours: 250 },
    { id: "brooklyn_tower", name: "The Brooklyn Tower", cx: 105, cy: 160, w: 22, d: 22, h: 190, style: "gehry", baseColor: "#030408", district: "brooklyn", unlockHours: 400 },

    // --- MIDTOWN MANHATTAN ---
    { id: "flatiron", name: "Flatiron Building", cx: -20, cy: -20, w: 18, d: 10, h: 85, style: "flatiron", baseColor: "#08090a", district: "midtown", unlockHours: 500 },
    { id: "midtown_glass_1", name: "Citigroup Center", cx: 45, cy: -40, w: 20, d: 20, h: 160, style: "setback", baseColor: "#03070f", district: "midtown", unlockHours: 750 },
    { id: "empire_state", name: "Empire State Building", cx: 0, cy: -60, w: 24, d: 24, h: 250, style: "esb", baseColor: "#05060c", district: "midtown", unlockHours: 1000 },
    { id: "chrysler", name: "Chrysler Building", cx: 35, cy: -80, w: 20, d: 20, h: 235, style: "chrysler", baseColor: "#04050a", district: "midtown", unlockHours: 1500 },
    { id: "times_square", name: "One Times Square", cx: -35, cy: -90, w: 18, d: 18, h: 140, style: "times_square", baseColor: "#040710", district: "midtown", unlockHours: 2500 },

    // --- CENTRAL PARK & UPPER WEST/EAST SIDE ---
    { id: "plaza_hotel", name: "The Plaza Hotel", cx: -10, cy: -140, w: 24, d: 20, h: 90, style: "setback", baseColor: "#0a0a09", district: "centralpark", unlockHours: 2000 },
    { id: "pencil_tower_2", name: "432 Park Avenue", cx: 25, cy: -150, w: 14, d: 14, h: 220, style: "slab", baseColor: "#080a0f", district: "centralpark", unlockHours: 3000 },
    { id: "pencil_tower_1", name: "111 West 57th (Pencil)", cx: -25, cy: -160, w: 12, d: 12, h: 240, style: "gehry", baseColor: "#05080e", district: "centralpark", unlockHours: 4000 },
    { id: "vessel", name: "The Vessel & Hudson Yards", cx: -90, cy: -150, w: 20, d: 20, h: 45, style: "vessel", baseColor: "#1d0e06", district: "centralpark", unlockHours: 5000 }
  ];

  // Camera State
  let panX = 0;
  let panY = 75; // central focus shift
  let scale = 1.1;
  let isDragging = false;
  let isRotating = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let rotationAngle = -0.45; // slight starting angle for 3D depth feeling out-of-the-box!
  let W = 700;
  let H = 450;

  function init() {
    if (!Store.s.districtBuildings) {
      Store.s.districtBuildings = [
        { x: -50, y: 40, size: "medium", name: "Chelsea Hub", color: "#4aa8ff", broken: false, height: 45 },
        { id: "earned_node_1", cx: 20, cy: -20, w: 18, d: 18, h: 35, style: "block", baseColor: "#45d183", broken: false }
      ];
    }
    if (Store.s.districtViewMode === undefined) {
      Store.s.districtViewMode = "isometric";
    }
    if (Store.s.infiniteCoinsEnabled === undefined) {
      Store.s.infiniteCoinsEnabled = false;
    }
    if (Store.s.simulatedFocusHours === undefined || Store.s.simulatedFocusHours > 7000) {
      Store.s.simulatedFocusHours = 7000;
    }
    if (Store.s.districtZenMode === undefined) {
      Store.s.districtZenMode = false;
    }
    Store.save();
  }

  // Camera View Matrix projection (incorporates focal scale, rotation, topographic elevation & oblique perspective)
  function project(lx, ly, lz = 0, onLand = true) {
    // 1. Rotate around (0,0) center
    const cosR = Math.cos(rotationAngle);
    const sinR = Math.sin(rotationAngle);
    const rx0 = lx * cosR - ly * sinR;
    const ry0 = lx * sinR + ly * cosR;

    // 2. Isometric / Oblique perspective tilt
    const angle = Math.PI / 6; // 30 degrees isometric tilt
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Oblique transformation
    const rx = (rx0 - ry0) * cosA;
    const ry = (rx0 + ry0) * sinA;

    // Topographical elevation (only if onLand is true and we are within general land mass)
    let elev = 0;
    if (onLand && Math.abs(lx) < 145 && ly < 230 && ly > -240) {
      // Dome elevation: highest at Broadway spine (lx = 0) and tapering smoothly to the shorelines
      const nx = lx / 145;
      const ny = (ly + 10) / 240;
      elev = Math.max(0, 16 * (1 - nx * nx) * (1 - ny * ny));
    }

    // Atmospheric depth perspective division (focal compression)
    const d = 650;
    const depthFactor = d / (d + ry);

    return {
      x: rx * depthFactor,
      y: (ry - (lz + elev)) * depthFactor,
      depth: ry // used for Painter's Algorithm sorting!
    };
  }

  // Blending helper for natural PBR shaded facade colors
  function blendColor(hex, blendHex, ratio) {
    const hexToRgb = (h) => {
      let cleaned = h.replace("#", "");
      if (cleaned.length === 3) {
        cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
      }
      return {
        r: parseInt(cleaned.substring(0, 2), 16) || 0,
        g: parseInt(cleaned.substring(2, 4), 16) || 0,
        b: parseInt(cleaned.substring(4, 6), 16) || 0
      };
    };

    const c1 = hexToRgb(hex);
    const c2 = hexToRgb(blendHex);
    const r = Math.round(c1.r * (1 - ratio) + c2.r * ratio);
    const g = Math.round(c1.g * (1 - ratio) + c2.g * ratio);
    const b = Math.round(c1.b * (1 - ratio) + c2.b * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }

  const PROCEDURAL_BUILDINGS = [];

  function getDistrictKey(x, y) {
    if (x > 65 && y < 100) {
      return "brooklyn";
    } else if (y < -150) {
      return "centralpark";
    } else if (y >= -150 && y < 0) {
      return "midtown";
    } else if (y >= 0 && y < 80) {
      return "tribeca";
    } else {
      return "fidi";
    }
  }

  function generateProceduralBuildings() {
    if (PROCEDURAL_BUILDINGS.length > 0) return;

    // Linear congruential generator for deterministic procedural generation
    let seedVal = 741829;
    function lcgRandom() {
      seedVal = (seedVal * 1664525 + 1013904223) % 4294967296;
      return seedVal / 4294967296;
    }

    function isInsidePolygon(x, y, polygon) {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    function isInsideLand(x, y) {
      // Exclude Battery Park area from dense skyscrapers
      if (isInsidePolygon(x, y, BATTERY_PARK)) return false;
      return isInsidePolygon(x, y, SHORELINE);
    }

    // Generate dense candidate points on Manhattan land mass using a tight grid
    const candidatePoints = [];
    for (let cx = -140; cx <= 140; cx += 5) {
      for (let cy = -230; cy <= 210; cy += 5) {
        // Exclude battery park
        let isBP = false;
        if (cx < -70 && cy > 140) isBP = true; 
        
        if (!isBP && isInsideLand(cx, cy)) {
          // Verify we aren't too close to hand-crafted landmarks to prevent overlaps
          let tooClose = false;
          for (let l of SIM_BUILDINGS) {
            const dx = l.cx - cx;
            const dy = l.cy - cy;
            if (dx * dx + dy * dy < 64) { // safe spacing of 8 units
              tooClose = true;
              break;
            }
          }
          if (!tooClose) {
            candidatePoints.push({ cx, cy });
          }
        }
      }
    }

    // Shuffle the candidate points list deterministically
    for (let i = candidatePoints.length - 1; i > 0; i--) {
      const j = Math.floor(lcgRandom() * (i + 1));
      const temp = candidatePoints[i];
      candidatePoints[i] = candidatePoints[j];
      candidatePoints[j] = temp;
    }

    let candIdx = 0;

    // A. ICONIC LANDMARKS (every 140 hours up to 7000 hours, total = 50 structures)
    for (let i = 1; i <= 50; i++) {
      const reqHours = i * 140;
      if (candIdx >= candidatePoints.length) break;
      const pt = candidatePoints[candIdx++];

      const styles = [
        "wtc", "esb", "chrysler", "wall40", "woolworth", "gehry", 
        "setback", "pine70", "glass", "slab", "flatiron", "times_square"
      ];
      const style = styles[Math.floor(lcgRandom() * styles.length)];

      const w = 18 + Math.floor(lcgRandom() * 8);
      const d = 18 + Math.floor(lcgRandom() * 8);
      const h = 140 + Math.floor(lcgRandom() * 110);

      const baseColors = ["#040815", "#03060d", "#050711", "#02040a", "#060914"];
      const baseColor = baseColors[Math.floor(lcgRandom() * baseColors.length)];

      PROCEDURAL_BUILDINGS.push({
        id: `proc_iconic_${i}`,
        name: `Iconic Landmark ${i}`,
        cx: pt.cx,
        cy: pt.cy,
        w,
        d,
        h,
        style,
        baseColor,
        reqHours,
        district: getDistrictKey(pt.cx, pt.cy),
        type: "iconic"
      });
    }

    // B. MID-SIZED BUILDINGS (every 70 hours up to 7000 hours, total = 100 structures)
    for (let i = 1; i <= 100; i++) {
      const reqHours = i * 70;
      if (candIdx >= candidatePoints.length) break;
      const pt = candidatePoints[candIdx++];

      const styles = ["setback", "glass", "slab", "gehry", "brick", "cylinder"];
      const style = styles[Math.floor(lcgRandom() * styles.length)];

      const w = 13 + Math.floor(lcgRandom() * 5);
      const d = 13 + Math.floor(lcgRandom() * 5);
      const h = 80 + Math.floor(lcgRandom() * 55);

      const baseColors = ["#05070d", "#04050a", "#06080e", "#030408"];
      const baseColor = baseColors[Math.floor(lcgRandom() * baseColors.length)];

      PROCEDURAL_BUILDINGS.push({
        id: `proc_mid_${i}`,
        name: `Mid-rise Monolith ${i}`,
        cx: pt.cx,
        cy: pt.cy,
        w,
        d,
        h,
        style,
        baseColor,
        reqHours,
        district: getDistrictKey(pt.cx, pt.cy),
        type: "mid"
      });
    }

    // C. SMALL BUILDINGS (every 30 hours up to 7000 hours, total = 233 structures)
    for (let i = 1; i <= 233; i++) {
      const reqHours = i * 30;
      if (candIdx >= candidatePoints.length) break;
      const pt = candidatePoints[candIdx++];

      const styles = ["brick", "slab", "block", "pyramid", "spire"];
      const style = styles[Math.floor(lcgRandom() * styles.length)];

      const w = 9 + Math.floor(lcgRandom() * 4);
      const d = 9 + Math.floor(lcgRandom() * 4);
      const h = 40 + Math.floor(lcgRandom() * 35);

      const baseColors = ["#040509", "#05060b", "#030407", "#050508"];
      const baseColor = baseColors[Math.floor(lcgRandom() * baseColors.length)];

      PROCEDURAL_BUILDINGS.push({
        id: `proc_small_${i}`,
        name: `Sleek Pod ${i}`,
        cx: pt.cx,
        cy: pt.cy,
        w,
        d,
        h,
        style,
        baseColor,
        reqHours,
        district: getDistrictKey(pt.cx, pt.cy),
        type: "small"
      });
    }

    // D. BASIC PROPS (Added every 1-5 hours, e.g. streetlights, cyber trees, steam vents, antennas)
    let propHour = 1;
    let propCounter = 1;
    while (propHour <= 7000) {
      if (candidatePoints.length === 0) break;
      // Select random baseline grid point and add organic offset
      const basePt = candidatePoints[Math.floor(lcgRandom() * candidatePoints.length)];
      
      const jX = (lcgRandom() - 0.5) * 8.5;
      const jY = (lcgRandom() - 0.5) * 8.5;
      const cx = Math.round(basePt.cx + jX);
      const cy = Math.round(basePt.cy + jY);

      const propStyles = ["streetlight", "tree", "steam", "utility"];
      const style = propStyles[Math.floor(lcgRandom() * propStyles.length)];
      
      const w = 4;
      const d = 4;
      let h = 12;
      if (style === "streetlight") h = 10 + Math.floor(lcgRandom() * 5);
      else if (style === "tree") h = 8 + Math.floor(lcgRandom() * 5);
      else if (style === "steam") h = 4;
      else if (style === "utility") h = 14 + Math.floor(lcgRandom() * 8);

      PROCEDURAL_BUILDINGS.push({
        id: `proc_prop_${propCounter++}`,
        name: `Grid Prop ${propCounter}`,
        cx,
        cy,
        w,
        d,
        h,
        style,
        baseColor: "#1e293b",
        reqHours: propHour,
        district: getDistrictKey(cx, cy),
        type: "prop"
      });

      // Increment hours by a random 1-5 step
      propHour += 1 + Math.floor(lcgRandom() * 5);
    }
  }

  function getActiveBuildings() {
    init();
    generateProceduralBuildings();
    
    // Allow the full range of simulated focus hours to determine density and growth
    const hours = Store.s.simulatedFocusHours !== undefined ? Store.s.simulatedFocusHours : 7000;

    const activeList = [];

    // 1. Hand-crafted landmarks spawning prioritization & district unlocking
    SIM_BUILDINGS.forEach(b => {
      const dist = DISTRICT_METADATA[b.district];
      // Only spawn if both district is unlocked AND this specific building's milestone is met!
      if (hours >= dist.unlockHours && hours >= b.unlockHours) {
        // Grow heights dynamically with focus hours beyond their unlock hours
        const extraHours = hours - b.unlockHours;
        const growthScale = 1.0 + Math.min(0.4, Math.log10(extraHours / 100 + 1) * 0.15);
        const finalH = Math.round(b.h * growthScale);
        
        activeList.push({
          ...b,
          h: finalH
        });
      }
    });

    // 2. Merge in active procedural buildings whose districts are unlocked
    PROCEDURAL_BUILDINGS.forEach(pb => {
      const dist = DISTRICT_METADATA[pb.district];
      if (hours >= dist.unlockHours && pb.reqHours <= hours) {
        if (pb.type === "prop") {
          activeList.push({
            ...pb
          });
        } else {
          // Density progression: procedural building heights grow as overall hours increase
          const extraHours = hours - pb.reqHours;
          const growthScale = 1.0 + Math.min(0.3, Math.log10(extraHours / 100 + 1) * 0.12);
          const currentH = Math.round(pb.h * growthScale);
          activeList.push({
            ...pb,
            h: currentH
          });
        }
      }
    });

    // 3. Merge in earned focus buildings (from actual user focus sessions)
    const earned = (Store.s.districtBuildings || []).map((b, idx) => {
      const angles = [0.4, 1.6, 2.8, 4.0, 5.2];
      const rad = 75 + (idx * 14);
      const cx = Math.round(Math.cos(angles[idx % angles.length]) * rad);
      const cy = Math.round(Math.sin(angles[idx % angles.length]) * rad + 20);
      return {
        id: `earned_${idx}`,
        name: b.name || "Focus Station",
        cx,
        cy,
        w: b.size === "skyscraper" ? 22 : b.size === "medium" ? 18 : 14,
        d: b.size === "skyscraper" ? 22 : b.size === "medium" ? 18 : 14,
        h: b.height || 45,
        style: b.size === "skyscraper" ? "wtc" : "block",
        baseColor: b.color || "#090c14",
        broken: !!b.broken
      };
    });

    return [...activeList, ...earned];
  }

  function addFocusBuilding(mins, title = "Focus Block") {
    init();
    let size = "small";
    let height = 30 + Math.random() * 20;
    if (mins >= 120) size = "skyscraper", height = 110 + Math.random() * 40;
    else if (mins >= 50) size = "medium", height = 60 + Math.random() * 30;

    const newB = {
      id: `earned_${Date.now()}`,
      name: title || "Server Node",
      size,
      height,
      color: ["#5e6ad2", "#4aa8ff", "#9d6bff", "#45d183", "#f5a524"][Math.floor(Math.random() * 5)],
      broken: false,
      ts: Date.now()
    };

    Store.s.districtBuildings.push(newB);
    Store.save();
    toast(`🏙️ Focus session completed! A new ${size} tower has been erected in your skyline.`, "gold", 4000);
    return newB;
  }

  function markSectorOffline() {
    init();
    if (Store.s.districtBuildings.length > 0) {
      const active = Store.s.districtBuildings.filter(b => !b.broken);
      if (active.length > 0) {
        active[active.length - 1].broken = true;
        Store.save();
        toast("🔴 Strike triggered! A sector of your permanent focus skyline went OFFLINE and rusted.", "bad", 5000);
      }
    } else {
      toast("No permanent buildings earned yet to trigger diagnostic rust strike!", "bad");
    }
  }

  function render(canvas) {
    if (!canvas) return;
    init();

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width || 700;
    H = rect.height || 450; // Dynamic, responsive height matching parent container

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    // ======================================================
    // 1. EARTHY REAL NYC SUNSET SKY & WATER BACKGROUND
    // ======================================================
    // Soft afternoon golden sun gradient in the sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#ca8a04");   // Golden hour yellow/orange upper sky
    sky.addColorStop(0.35, "#f59e0b"); // Vibrant warm amber
    sky.addColorStop(0.65, "#f97316"); // Sunset orange horizon
    sky.addColorStop(1, "#c2410c");   // Warm reddish earth glow near base
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Render soft, scattered realistic clouds
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let c = 0; c < 5; c++) {
      const cloudX = (W * 0.15 + c * (W * 0.22) + Date.now() * 0.002) % (W + 200) - 100;
      const cloudY = H * 0.12 + Math.sin(c) * 40;
      const cloudGrad = ctx.createRadialGradient(cloudX, cloudY, 10, cloudX, cloudY, 90);
      cloudGrad.addColorStop(0, "#fed7aa"); // Warm peach cloud center
      cloudGrad.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, 90, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Draw realistic warm golden sun in the upper sky
    const sunX = W * 0.2;
    const sunY = H * 0.18;
    ctx.save();
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, 110);
    sunGlow.addColorStop(0, "rgba(255, 253, 245, 1.0)");
    sunGlow.addColorStop(0.1, "rgba(254, 240, 138, 0.85)"); // bright sunlit yellow
    sunGlow.addColorStop(0.4, "rgba(251, 146, 60, 0.4)");  // orange haze
    sunGlow.addColorStop(1, "rgba(251, 146, 60, 0)");
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw moving birds and helicopters
    ctx.save();
    const timeVal = Date.now() * 0.0008;
    // Tiny silhouettes of seagulls gliding
    ctx.strokeStyle = "rgba(41, 37, 36, 0.6)"; // dark stone grey birds
    ctx.lineWidth = 1.0;
    for (let b = 0; b < 3; b++) {
      const bx = (W * 0.4 + b * 110 + timeVal * 25) % (W + 100) - 50;
      const by = H * 0.15 + Math.sin(timeVal + b) * 20 + b * 15;
      ctx.beginPath();
      ctx.moveTo(bx - 3, by + 1);
      ctx.quadraticCurveTo(bx - 1.5, by - 1.5, bx, by);
      ctx.quadraticCurveTo(bx + 1.5, by - 1.5, bx + 3, by + 1);
      ctx.stroke();
    }
    ctx.restore();

    // Draw realistic East River / Hudson River water surface
    ctx.save();
    // Soft dark blue-gray with ripples reflecting the golden sky
    const waterGrad = ctx.createLinearGradient(0, H * 0.45, 0, H);
    waterGrad.addColorStop(0, "#2c3b4e"); // Soft dark steel blue-gray
    waterGrad.addColorStop(0.5, "#1f2937"); // Deep gray
    waterGrad.addColorStop(1, "#111827"); // Shadow depth
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);

    // Interactive river wave texture / sparkles reflecting golden sunset sun
    ctx.strokeStyle = "rgba(253, 224, 71, 0.15)"; // soft golden sparkles
    ctx.lineWidth = 0.6;
    const waveCount = 45;
    for (let w = 0; w < waveCount; w++) {
      const wSeed = w * 47.91;
      const wx = (wSeed + Date.now() * 0.015) % W;
      const wy = H * 0.45 + (wSeed * 11) % (H * 0.55);
      const wLength = 12 + (wSeed % 18);
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + wLength, wy);
      ctx.stroke();
    }
    ctx.restore();

    // Cinematic Wind-Blown Rain / Spark Particles Overlay
    if (Store.s.settings.animations) {
      ctx.strokeStyle = "rgba(226, 232, 240, 0.18)"; // Soft natural silver-white rain streaks
      ctx.lineWidth = 0.85;
      const rainCount = 45;
      for (let r = 0; r < rainCount; r++) {
        const rSeed = r * 17.53;
        const rx = (rSeed + Date.now() * 0.6) % W;
        const ry = (rSeed * 2.3 + Date.now() * 1.5) % H;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + 16);
        ctx.stroke();
      }
    }

    // Distant Commercial Jet / Helicopter Strobes & Vapor Trails
    if (Store.s.settings.animations) {
      const numPlanes = 3;
      for (let i = 0; i < numPlanes; i++) {
        const speed = 0.00004 + (i * 0.00002);
        const t = (Date.now() * speed) % 1.3;
        
        const startX = -100;
        const startY = H * (0.05 + i * 0.09);
        const endX = W + 100;
        const endY = H * (0.08 + i * 0.06);
        
        const x = startX * (1 - t) + endX * t;
        const y = startY * (1 - t) + endY * t;
        
        if (x > 0 && x < W) {
          // Soft jet vapor trail
          const trailGrad = ctx.createLinearGradient(x - 40, y, x, y);
          trailGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
          trailGrad.addColorStop(1, "rgba(255, 255, 255, 0.09)");
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(x - 40, y);
          ctx.lineTo(x, y);
          ctx.stroke();
          
          // Red and white blinking navigation strobe
          const isBlink = Math.sin(Date.now() * 0.008 + i) > 0.4;
          ctx.fillStyle = isBlink ? "#ef4444" : "#ffffff";
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Distant NYC Buildings & Jersey Shore Silhouettes
    ctx.save();
    ctx.fillStyle = "rgba(15, 17, 23, 0.95)"; // Matte dark grey/black
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 0.5;
    
    const distTowers = [
      { x: W * 0.12, w: 25, h: 90 },
      { x: W * 0.28, w: 20, h: 120 },
      { x: W * 0.45, w: 15, h: 75 },
      { x: W * 0.65, w: 30, h: 105 },
      { x: W * 0.85, w: 24, h: 135 }
    ];
    distTowers.forEach(dt => {
      const ty = H * 0.58;
      ctx.fillRect(dt.x - dt.w/2, ty - dt.h, dt.w, dt.h);
      ctx.strokeRect(dt.x - dt.w/2, ty - dt.h, dt.w, dt.h);
      
      // Draw subtle warm golden office windows in the background
      ctx.fillStyle = "rgba(251, 191, 36, 0.45)"; // Soft golden amber
      ctx.fillRect(dt.x - 4, ty - dt.h + 20, 8, 1.5);
      ctx.fillRect(dt.x - 4, ty - dt.h + 35, 8, 1.5);
    });
    ctx.restore();

    ctx.save();
    // Center the origin and apply viewport drag/zoom scale
    ctx.translate(W / 2 + panX, H / 2 + panY);
    ctx.scale(scale, scale);

    // ======================================================
    // 2. WATER DEPTH UNDERLAY & NATURAL LAND SHADOW
    // ======================================================
    ctx.save();
    const shadowCenter = project(0, 0, -115, false);
    const shadowGlow = ctx.createRadialGradient(shadowCenter.x, shadowCenter.y, 10, shadowCenter.x, shadowCenter.y, 450);
    shadowGlow.addColorStop(0, "rgba(9, 13, 22, 0.88)"); // Dark river floor depth
    shadowGlow.addColorStop(0.5, "rgba(15, 23, 42, 0.35)"); // Soft natural shadow of the land
    shadowGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    
    ctx.fillStyle = shadowGlow;
    ctx.beginPath();
    ctx.ellipse(shadowCenter.x, shadowCenter.y, 480, 200, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ======================================================
    // 3. SHADOW PASS (Projected Soft Shadows - Near-Black)
    // ======================================================
    const activeBuildings = getActiveBuildings();
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)"; // Extremely deep shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 12; // Soft edge shadow blending

    activeBuildings.forEach(b => {
      const hw = b.w / 2;
      const hd = b.d / 2;
      const h = b.h;

      // Shadow casting math based on upper-left sun: offset x-southeastwards (positive X, positive Y)
      const shadowLengthX = h * 0.58;
      const shadowLengthY = h * 0.28;

      const pBackLeft = project(b.cx - hw, b.cy - hd, 0, true);
      const pFrontLeft = project(b.cx - hw, b.cy + hd, 0, true);
      const pFrontRight = project(b.cx + hw, b.cy + hd, 0, true);
      const pBackRight = project(b.cx + hw, b.cy - hd, 0, true);

      ctx.beginPath();
      ctx.moveTo(pBackLeft.x, pBackLeft.y);
      ctx.lineTo(pFrontLeft.x, pFrontLeft.y);
      ctx.lineTo(pFrontRight.x + shadowLengthX, pFrontRight.y + shadowLengthY);
      ctx.lineTo(pBackRight.x + shadowLengthX, pBackRight.y + shadowLengthY);
      ctx.lineTo(pBackLeft.x + shadowLengthX, pBackLeft.y + shadowLengthY);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // ======================================================
    // 4. FLOATING CASCADES REMOVED (Grounded Realism)
    // ======================================================

    // ======================================================
    // 5. LOWER MANHATTAN LEVITATING ISLAND & 3D CRYSTAL UNDERPLATE
    // ======================================================
    // Helper to generate organic jagged shoreline via procedural subdivision
    const getIrregularShoreline = () => {
      const irregular = [];
      for (let i = 0; i < SHORELINE.length; i++) {
        const p1 = SHORELINE[i];
        const p2 = SHORELINE[(i + 1) % SHORELINE.length];
        
        irregular.push(p1);
        
        // Add 3 subdivision points per segment to inject organic jaggedness
        const steps = 4;
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const mx = p1.x * (1 - t) + p2.x * t;
          const my = p1.y * (1 - t) + p2.y * t;
          
          // Generate organic jaggedness based on sine/cosine noise
          const noise = Math.sin(mx * 0.09) * Math.cos(my * 0.09) * 4.8 + Math.sin(mx * 0.25) * 1.5;
          const angle = Math.atan2(my, mx);
          
          irregular.push({
            x: mx + Math.cos(angle) * noise,
            y: my + Math.sin(angle) * noise
          });
        }
      }
      return irregular;
    };

    const irregularCoast = getIrregularShoreline();

    // 5a. Render Realistic Concrete Seawall Embankment (anchoring Manhattan in the water)
    ctx.save();
    for (let i = 0; i < irregularCoast.length; i++) {
      const p1 = irregularCoast[i];
      const p2 = irregularCoast[(i + 1) % irregularCoast.length];
      
      const pt1_top = project(p1.x, p1.y, 0, true);
      const pt2_top = project(p2.x, p2.y, 0, true);
      const pt1_bot = project(p1.x, p1.y, -14, true);
      const pt2_bot = project(p2.x, p2.y, -14, true);
      
      // Base concrete foundation facet
      ctx.fillStyle = "#3e3e42"; // concrete block grey
      ctx.beginPath();
      ctx.moveTo(pt1_top.x, pt1_top.y);
      ctx.lineTo(pt2_top.x, pt2_top.y);
      ctx.lineTo(pt2_bot.x, pt2_bot.y);
      ctx.lineTo(pt1_bot.x, pt1_bot.y);
      ctx.closePath();
      ctx.fill();
      
      // Shadow overlay depending on segment angle
      ctx.fillStyle = `rgba(0, 0, 0, ${0.35 + 0.15 * Math.sin(i)})`;
      ctx.beginPath();
      ctx.moveTo(pt1_top.x, pt1_top.y);
      ctx.lineTo(pt2_top.x, pt2_top.y);
      ctx.lineTo(pt2_bot.x, pt2_bot.y);
      ctx.lineTo(pt1_bot.x, pt1_bot.y);
      ctx.closePath();
      ctx.fill();

      // Subtle stone masonry lines on seawall
      ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pt1_top.x, pt1_top.y);
      ctx.lineTo(pt1_bot.x, pt1_bot.y);
      ctx.stroke();
    }
    ctx.restore();

    // 5b. Render Main Landmass Peninsula Plate (Realistic asphalt/concrete Manhattan ground)
    ctx.fillStyle = "#3b4252"; // Solid asphalt grey city floor plane
    ctx.strokeStyle = "#4c566a"; // Concrete edge border
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    const coastStart = project(irregularCoast[0].x, irregularCoast[0].y, 0, true);
    ctx.moveTo(coastStart.x, coastStart.y);
    for (let i = 1; i < irregularCoast.length; i++) {
      const p = project(irregularCoast[i].x, irregularCoast[i].y, 0, true);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Realistic street grid system (Broadway, West Side Highway, FDR Drive, and cross streets)
    ctx.save();
    ctx.strokeStyle = "#1a1f29"; // Dark asphalt road lines
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    // West Side Highway (Left coast of Manhattan)
    for (let ly = -230; ly <= 210; ly += 20) {
      const p = project(-115, ly, 0, true);
      if (ly === -230) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    // FDR Drive (Right coast of Manhattan)
    for (let ly = -230; ly <= 210; ly += 20) {
      const p = project(115, ly, 0, true);
      if (ly === -230) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    // Broadway (Central spine)
    for (let ly = -240; ly <= 220; ly += 20) {
      const p = project(0, ly, 0, true);
      if (ly === -240) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Draw little yellow taxis and white cars moving along Broadway and Highways!
    const taxiTimeNow = Date.now() * 0.04;
    ctx.fillStyle = "#eab308"; // taxi yellow
    for (let i = 0; i < 8; i++) {
      const ly = ((taxiTimeNow + i * 60) % 450) - 225;
      const pTax = project(0, ly, 0, true);
      ctx.fillRect(pTax.x - 0.8, pTax.y - 0.8, 1.6, 1.6);
    }
    ctx.fillStyle = "#f8fafc"; // white cars
    for (let i = 0; i < 8; i++) {
      const ly = ((taxiTimeNow * 0.8 + i * 55) % 450) - 225;
      const pCar = project(-115, ly, 0, true);
      ctx.fillRect(pCar.x - 0.8, pCar.y - 0.8, 1.6, 1.6);
    }
    ctx.restore();

    // ======================================================
    // 6. REALISTIC NYC HARBOR DOCKS & WATER TRAFFIC
    // ======================================================
    // Weathered wooden/concrete docks/piers extending into the rivers
    PIERS.forEach(pier => {
      const p = project(pier.x, pier.y, -2);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(pier.rot);
      
      // Supporting structures (concrete foundation piles)
      ctx.fillStyle = "#475569"; // grey concrete piles
      ctx.fillRect(-pier.w * 0.4, pier.h * 0.3, pier.w * 0.15, 6);
      ctx.fillRect(pier.w * 0.25, pier.h * 0.3, pier.w * 0.15, 6);
      
      // Deck
      ctx.fillStyle = "#78716c"; // Weathered stone/wood brown-grey deck
      ctx.strokeStyle = "#44403c";
      ctx.lineWidth = 1.0;
      ctx.fillRect(-pier.w / 2, -pier.h / 2, pier.w, pier.h);
      ctx.strokeRect(-pier.w / 2, -pier.h / 2, pier.w, pier.h);
      
      // Draw wooden plank lines
      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.lineWidth = 0.5;
      for (let px = -pier.w / 2 + 3; px < pier.w / 2; px += 4) {
        ctx.beginPath();
        ctx.moveTo(px, -pier.h / 2);
        ctx.lineTo(px, pier.h / 2);
        ctx.stroke();
      }
      
      ctx.restore();
    });

    // Moving River Vessel Traffic (Real maritime craft with foaming wakes)
    const timeSec = Date.now() * 0.001;
    
    // 1. Iconic Staten Island Ferry (Orange hull, white superstructure, sitting on water)
    const ferryTime = (Date.now() * 0.01) % 460;
    const fx = -240 + ferryTime;
    const fy = 210 - (ferryTime * 0.12);
    const fp = project(fx, fy, 0); // Sitting on the water surface (z = 0)
    
    // Draw white foam wake
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(fp.x - 14, fp.y, 4, 0, Math.PI * 2);
    ctx.arc(fp.x - 22, fp.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ea580c"; // Staten Island Ferry Orange
    ctx.fillRect(fp.x - 10, fp.y - 3, 20, 6); // Hull
    ctx.fillStyle = "#f8fafc"; // White passenger cabin levels
    ctx.fillRect(fp.x - 7, fp.y - 5, 14, 2);
    ctx.fillRect(fp.x - 4, fp.y - 7, 8, 2);
    ctx.fillStyle = "#1e293b"; // Dark stack
    ctx.fillRect(fp.x - 1, fp.y - 9, 2, 2);
    
    // Navigation lights (standard red and green)
    const navBlink = Math.sin(Date.now() * 0.005) > 0;
    ctx.fillStyle = navBlink ? "#ef4444" : "#7f1d1d";
    ctx.beginPath();
    ctx.arc(fp.x - 8, fp.y - 4, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = navBlink ? "#22c55e" : "#14532d";
    ctx.beginPath();
    ctx.arc(fp.x + 8, fp.y - 4, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // 2. NYC Yellow Water Taxi (At water level)
    const taxiTime = (Date.now() * 0.014) % 360;
    const tx = -180 + taxiTime * 0.8;
    const ty = -120 + taxiTime * 0.4;
    const tp = project(tx, ty, 0); 
    
    // White foam wake
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.arc(tp.x - 7, tp.y, 3, 0, Math.PI * 2);
    ctx.arc(tp.x - 12, tp.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#eab308"; // NYC Yellow
    ctx.fillRect(tp.x - 5, tp.y - 2.5, 10, 5); // Hull
    ctx.fillStyle = "#0f172a"; // Dark passenger cabin
    ctx.fillRect(tp.x - 2, tp.y - 1.5, 5, 3);

    // 3. Classic Sailboat Yacht (At water level)
    const sailTime = timeSec * 0.15;
    const sx = -150 + Math.sin(sailTime) * 35;
    const sy = 160 + Math.cos(sailTime) * 15;
    const sp = project(sx, sy, 0); 
    
    // Wake
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.beginPath();
    ctx.arc(sp.x - 6, sp.y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f1f5f9"; // Sleek white sailboat hull
    ctx.beginPath();
    ctx.moveTo(sp.x - 5, sp.y + 1);
    ctx.lineTo(sp.x + 5, sp.y + 1);
    ctx.lineTo(sp.x + 7, sp.y - 0.5);
    ctx.lineTo(sp.x - 6, sp.y - 0.5);
    ctx.closePath();
    ctx.fill();
    
    // Cream tall triangular sail
    ctx.fillStyle = "#fef3c7"; // Warm cream sail
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y - 1);
    ctx.lineTo(sp.x - 3, sp.y - 12);
    ctx.lineTo(sp.x + 1, sp.y - 1);
    ctx.closePath();
    ctx.fill();

    // 4. NYPD Harbor Patrol Boat (At water level)
    const patrolTime = (Date.now() * 0.008) % 380;
    const px = 100 - patrolTime * 0.7;
    const py = 120 - patrolTime * 0.2;
    const pp = project(px, py, 0); 
    
    // Wake
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(pp.x + 8, pp.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1e3a8a"; // NYPD Dark Blue Hull
    ctx.fillRect(pp.x - 6, pp.y - 2, 12, 4);
    ctx.fillStyle = "#f1f5f9"; // White cabin
    ctx.fillRect(pp.x - 2, pp.y - 4, 6, 2.5);
    
    // Sirens blinking red/blue
    const sirenRed = Math.sin(Date.now() * 0.01) > 0;
    ctx.fillStyle = sirenRed ? "#ef4444" : "#3b82f6";
    ctx.beginPath();
    ctx.arc(pp.x + 1, pp.y - 4.5, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // ======================================================
    // 7. BATTERY PARK & URBAN GREEN SPACES (Lush natural NYC parklands)
    // ======================================================
    // Rich natural dark-green park lawn
    const parkGrad = ctx.createLinearGradient(0, 100, 0, 240);
    parkGrad.addColorStop(0, "#14532d"); // Deep forest green
    parkGrad.addColorStop(1, "#166534"); // Lush park green
    ctx.fillStyle = parkGrad;
    ctx.beginPath();
    const bpStart = project(BATTERY_PARK[0].x, BATTERY_PARK[0].y);
    ctx.moveTo(bpStart.x, bpStart.y);
    for (let i = 1; i < BATTERY_PARK.length; i++) {
      const p = project(BATTERY_PARK[i].x, BATTERY_PARK[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();

    // Distant City Hall Park / Green Belt in the North Background
    ctx.fillStyle = "#14532d"; // lush green lawn
    ctx.beginPath();
    const chp1 = project(-20, -160);
    const chp2 = project(15, -160);
    const chp3 = project(25, -135);
    const chp4 = project(-10, -135);
    ctx.moveTo(chp1.x, chp1.y);
    ctx.lineTo(chp2.x, chp2.y);
    ctx.lineTo(chp3.x, chp3.y);
    ctx.lineTo(chp4.x, chp4.y);
    ctx.closePath();
    ctx.fill();

    // Castle Clinton Monument (Circular Sandstone Fort in Battery Park)
    const ccPos = project(-55, 165);
    ctx.fillStyle = "rgba(10, 10, 10, 0.35)"; // Shadow
    ctx.beginPath();
    ctx.arc(ccPos.x + 1.5, ccPos.y + 1, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#78350f"; // Rich sandstone brown brick fort walls
    ctx.strokeStyle = "#451a03"; // brick outline
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(ccPos.x, ccPos.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#451a03"; // Dark inner courtyard
    ctx.beginPath();
    ctx.arc(ccPos.x, ccPos.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Realistic concrete pedestrian pathways winding through Battery Park
    ctx.strokeStyle = "rgba(224, 224, 215, 0.38)"; // Soft light concrete walk path
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const path1 = project(-90, 120);
    const path2 = project(-40, 180);
    const path3 = project(20, 210);
    ctx.moveTo(path1.x, path1.y);
    ctx.quadraticCurveTo(path2.x, path2.y, path3.x, path3.y);
    ctx.stroke();

    ctx.strokeStyle = "rgba(224, 224, 215, 0.28)"; // secondary path
    ctx.beginPath();
    const path4 = project(-100, 135);
    const path5 = project(-50, 175);
    const path6 = project(35, 200);
    ctx.moveTo(path4.x, path4.y);
    ctx.quadraticCurveTo(path5.x, path5.y, path6.x, path6.y);
    ctx.stroke();

    // Multi-shade Dense Tree Canopy (Natural green/autumn shade trees)
    const treeCoords = [
      // Battery Park
      {x: -100, y: 140, type: 0}, {x: -90, y: 160, type: 1}, {x: -80, y: 130, type: 2},
      {x: -60, y: 170, type: 0}, {x: -40, y: 190, type: 1}, {x: -20, y: 200, type: 2},
      {x: 10, y: 215, type: 0}, {x: 30, y: 190, type: 1}, {x: 50, y: 170, type: 2},
      {x: 70, y: 135, type: 0}, {x: -30, y: 120, type: 1}, {x: 20, y: 110, type: 2},
      {x: -45, y: 150, type: 0}, {x: -75, y: 175, type: 1}, {x: -10, y: 170, type: 2},
      {x: 40, y: 145, type: 0}, {x: 60, y: 120, type: 1}, {x: -85, y: 110, type: 2},
      // City Hall Park
      {x: -15, y: -150, type: 0}, {x: -5, y: -150, type: 1}, {x: 5, y: -150, type: 2},
      {x: -10, y: -142, type: 0}, {x: 0, y: -142, type: 1}, {x: 10, y: -142, type: 2},
      {x: 15, y: -148, type: 0}, {x: 8, y: -155, type: 1}
    ];
    treeCoords.forEach((t, idx) => {
      const p = project(t.x, t.y);
      // Soft tree shadow
      ctx.fillStyle = "rgba(10, 18, 12, 0.22)";
      ctx.beginPath();
      ctx.arc(p.x + 1.2, p.y + 0.8, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Natural green tree crowns
      let crownColor = "#22c55e"; // bright green
      if (t.type === 1) crownColor = "#15803d"; // deep green
      else if (t.type === 2) crownColor = "#84cc16"; // light lime green

      ctx.fillStyle = crownColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // ======================================================
    // 9. 9/11 MEMORIAL REFLECTING POOLS (Realistic slate grey & dark water)
    // ======================================================
    const pools = [
      { cx: -82, cy: -75 },
      { cx: -82, cy: -45 }
    ];
    pools.forEach(pool => {
      const p = project(pool.cx, pool.cy, 0, true);
      ctx.fillStyle = "#1e293b"; // Deep dark water
      ctx.fillRect(p.x - 9, p.y - 5, 18, 10);
      ctx.strokeStyle = "#475569"; // Slate grey granite edge
      ctx.lineWidth = 1.0;
      ctx.strokeRect(p.x - 9, p.y - 5, 18, 10);
    });

    // Downtown Manhattan Heliport on Pier 6 (Yellow/White Marker + White 'H')
    const helipadPier = PIERS[2]; // Moored pier
    const helipadP = project(helipadPier.x, helipadPier.y, 1, false);
    ctx.save();
    ctx.translate(helipadP.x, helipadP.y);
    ctx.rotate(helipadPier.rot);
    ctx.strokeStyle = "#eab308"; // Standard yellow helipad circle
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 5px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", 0, 0);
    ctx.restore();

    // Floating Maritime traffic (3D-looking ships in Hudson and East River)
    const drawShip = (cx, cy, headingAngle, size, color) => {
      const p = project(cx, cy, 0, false);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(headingAngle);
      
      // Hull
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.4);
      ctx.lineTo(size * 0.4, -size * 0.4);
      ctx.lineTo(size, 0); // pointed bow
      ctx.lineTo(size * 0.4, size * 0.4);
      ctx.lineTo(-size, size * 0.4);
      ctx.closePath();
      ctx.fill();
      
      // Cabin house
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-size * 0.4, -size * 0.25, size * 0.6, size * 0.5);
      
      // Mast/antenna
      ctx.strokeStyle = "#a4b3c4";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -size * 0.8);
      ctx.stroke();
      
      // Tiny glowing window dot
      ctx.fillStyle = "#ffe680";
      ctx.fillRect(-2, -1, 1.5, 1.5);
      ctx.restore();
    };

    // Yacht floating in Hudson
    drawShip(-190, -80, -0.2, 7, "#2e3b4e");
    // Cargo ship anchored in East River
    drawShip(210, 60, 0.15, 9, "#7d322a");

    // ======================================================
    // 10. BACKGROUND SUSPENSION BRIDGES (Brooklyn Bridge stone towers & steel cables)
    // ======================================================
    ctx.save();
    ctx.globalAlpha = 0.92;
    BRIDGES.forEach(br => {
      const pStart = project(br.startX, br.startY, 0, false);
      const pEnd = project(br.endX, br.endY, 0, false);
      
      // Draw actual double-layered road deck (stiffening truss)
      ctx.strokeStyle = "#475569"; // steel truss grey
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
      
      // Draw structural diagonal cross trusses (X shapes) along bridge deck
      ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const trussSteps = 30;
      for (let s = 0; s < trussSteps; s++) {
        const t1 = s / trussSteps;
        const t2 = (s + 1) / trussSteps;
        const lx1 = br.startX * (1 - t1) + br.endX * t1;
        const ly1 = br.startY * (1 - t1) + br.endY * t1;
        const lx2 = br.startX * (1 - t2) + br.endX * t2;
        const ly2 = br.startY * (1 - t2) + br.endY * t2;

        const lp1_b = project(lx1, ly1, 0, false);
        const lp1_t = project(lx1, ly1, 4.0, false);
        const lp2_b = project(lx2, ly2, 0, false);
        const lp2_t = project(lx2, ly2, 4.0, false);

        // Vertical brace
        ctx.moveTo(lp1_b.x, lp1_b.y);
        ctx.lineTo(lp1_t.x, lp1_t.y);
        // Diagonal X braces
        ctx.moveTo(lp1_b.x, lp1_b.y);
        ctx.lineTo(lp2_t.x, lp2_t.y);
        ctx.moveTo(lp2_b.x, lp2_b.y);
        ctx.lineTo(lp1_t.x, lp1_t.y);
      }
      ctx.stroke();

      // Main Suspension Tower (Double masonry pillars with pointed gothic cutouts)
      const pTowerBase = project(br.towerX, br.towerY, 0, false);
      const pTowerTop = project(br.towerX, br.towerY, br.towerHeight, false);
      
      // Draw stone masonry tower (warm beige/brown stone)
      ctx.fillStyle = "#878170"; // beautiful granite stone grey-brown
      ctx.fillRect(pTowerBase.x - 8, pTowerTop.y, 16, pTowerBase.y - pTowerTop.y);
      
      // Draw vertical masonry joints/lines on the stone towers
      ctx.strokeStyle = "#575249";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(pTowerBase.x, pTowerBase.y);
      ctx.lineTo(pTowerBase.x, pTowerTop.y);
      ctx.moveTo(pTowerBase.x - 4, pTowerBase.y);
      ctx.lineTo(pTowerBase.x - 4, pTowerTop.y);
      ctx.moveTo(pTowerBase.x + 4, pTowerBase.y);
      ctx.lineTo(pTowerBase.x + 4, pTowerTop.y);
      ctx.stroke();

      // Draw horizontal masonry block lines
      ctx.beginPath();
      for (let ty = pTowerTop.y + 4; ty < pTowerBase.y; ty += 6) {
        ctx.moveTo(pTowerBase.x - 8, ty);
        ctx.lineTo(pTowerBase.x + 8, ty);
      }
      ctx.stroke();

      // Draw double gothic arches cut out of the towers (pointed gothic look)
      ctx.fillStyle = "#292524"; // deep shadowed cutout
      
      // Left gothic arch
      ctx.beginPath();
      ctx.moveTo(pTowerBase.x - 5.5, pTowerBase.y - 12);
      ctx.quadraticCurveTo(pTowerBase.x - 3.5, pTowerBase.y - 25, pTowerBase.x - 3.5, pTowerBase.y - 34); // peak
      ctx.quadraticCurveTo(pTowerBase.x - 3.5, pTowerBase.y - 25, pTowerBase.x - 1.5, pTowerBase.y - 12);
      ctx.closePath();
      ctx.fill();

      // Right gothic arch
      ctx.beginPath();
      ctx.moveTo(pTowerBase.x + 1.5, pTowerBase.y - 12);
      ctx.quadraticCurveTo(pTowerBase.x + 3.5, pTowerBase.y - 25, pTowerBase.x + 3.5, pTowerBase.y - 34); // peak
      ctx.quadraticCurveTo(pTowerBase.x + 3.5, pTowerBase.y - 25, pTowerBase.x + 5.5, pTowerBase.y - 12);
      ctx.closePath();
      ctx.fill();

      // Tower cornices
      ctx.fillStyle = "#a19a86";
      ctx.fillRect(pTowerBase.x - 9, pTowerTop.y - 4, 18, 4);

      // Main Suspension Cables (Steel cables)
      ctx.strokeStyle = "#475569"; // slate steel grey
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      // Left sweep
      ctx.moveTo(pTowerTop.x, pTowerTop.y);
      ctx.quadraticCurveTo((pStart.x + pTowerBase.x) / 2, (pStart.y + pTowerBase.y) / 2 + 16, pStart.x, pStart.y);
      // Right sweep
      ctx.moveTo(pTowerTop.x, pTowerTop.y);
      ctx.quadraticCurveTo((pEnd.x + pTowerBase.x) / 2, (pEnd.y + pTowerBase.y) / 2 + 18, pEnd.x, pEnd.y);
      ctx.stroke();

      // Vertical suspender cable drops connecting main cables to the bridge deck
      ctx.strokeStyle = "rgba(71, 85, 105, 0.35)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const cableSteps = 22;
      for (let s = 1; s < cableSteps; s++) {
        const t = s / cableSteps;
        const lx = br.startX * (1 - t) + br.endX * t;
        const ly = br.startY * (1 - t) + br.endY * t;
        const lp = project(lx, ly, 0, false);
        
        let cyTop;
        const tTower = (br.towerX - br.startX) / (br.endX - br.startX);
        if (t < tTower) {
          const ratio = t / tTower;
          cyTop = pTowerTop.y * ratio + pStart.y * (1 - ratio);
        } else {
          const ratio = (1 - t) / (1 - tTower);
          cyTop = pTowerTop.y * ratio + pEnd.y * (1 - ratio);
        }
        ctx.moveTo(lp.x, lp.y);
        ctx.lineTo(lp.x, cyTop);
      }
      ctx.stroke();

      // Small realistic warm lights on deck (like yellow car lights)
      ctx.fillStyle = "rgba(253, 224, 71, 0.6)";
      const steps = 12;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const lx = br.startX * (1 - t) + br.endX * t;
        const ly = br.startY * (1 - t) + br.endY * t;
        const lp = project(lx, ly, 0, false);
        ctx.beginPath();
        ctx.arc(lp.x, lp.y - 0.5, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    // ======================================================
    // 11. DETAILED 3D BUILDINGS LAYER (Painters Algorithm sorting based on projected depth)
    // ======================================================
    const sorted = [...activeBuildings].map(b => {
      // Calculate projected depth to support rotation perfectly
      const proj = project(b.cx, b.cy, 0);
      return { ...b, projDepth: proj.depth };
    }).sort((a, b) => {
      return a.projDepth - b.projDepth;
    });

    sorted.forEach(b => {
      drawHighFidelity3DBuilding(ctx, b);
    });

    // Render elegant steel-and-glass pedestrian skybridges connecting nearby skyscrapers
    ctx.save();
    for (let i = 0; i < sorted.length; i++) {
      const b1 = sorted[i];
      if (b1.broken || b1.style === "streetlight" || b1.style === "tree" || b1.style === "steam" || b1.style === "utility") continue;
      
      // Connect to nearby buildings
      for (let j = i + 1; j < sorted.length; j++) {
        const b2 = sorted[j];
        if (b2.broken || b2.style === "streetlight" || b2.style === "tree" || b2.style === "steam" || b2.style === "utility") continue;
        
        const dist = Math.hypot(b1.cx - b2.cx, b1.cy - b2.cy);
        // Only connect if distance is close enough (between 25 and 45 units)
        if (dist > 25 && dist < 45) {
          // Adjust height: make skywalks connect at 55% of the shorter building's height
          const shorterH = Math.min(b1.h, b2.h);
          const bridgeH = shorterH * 0.55;
          
          const pt1 = project(b1.cx, b1.cy, bridgeH);
          const pt2 = project(b2.cx, b2.cy, bridgeH);
          
          // Draw structural girder under-bridge (slate grey)
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
          
          // Realistic glass-walled walkway outline
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y - 1.5);
          ctx.lineTo(pt2.x, pt2.y - 1.5);
          ctx.stroke();
          
          // Tiny glowing warm window lights inside the pedestrian bridge
          ctx.fillStyle = "rgba(254, 240, 138, 0.8)"; // soft warm yellow windows
          ctx.beginPath();
          ctx.arc((pt1.x + pt2.x) / 2, (pt1.y + pt2.y) / 2 - 0.7, 1.0, 0, Math.PI * 2);
          ctx.fill();
          break; // limit to one bridge per building to keep it clean and elegant
        }
      }
    }
    ctx.restore();

    // ======================================================
    // 11.5 SWEEPING SEARCHLIGHTS (Elegant white/golden tribute beacons)
    // ======================================================
    if (Store.s.settings.animations) {
      const beams = [
        { cx: -80, cy: -50, h: 120, col: "rgba(254, 243, 199, ", speed: 0.0006 }, // Warm white/cream
        { cx: 80, cy: 50, h: 130, col: "rgba(248, 250, 252, ", speed: 0.0008 },  // Pure sky white
        { cx: 10, cy: 90, h: 100, col: "rgba(253, 254, 255, ", speed: 0.0005 }   // Bright white beacon
      ];

      beams.forEach((bm, i) => {
        const base = project(bm.cx, bm.cy, bm.h);
        const time = Date.now() * bm.speed + (i * 45);
        const sweepAngle = Math.sin(time) * 0.15; // subtle realistic slow sweep
        
        const topX = base.x + Math.sin(sweepAngle) * 120;
        const topY = base.y - 210;

        const beamGrad = ctx.createLinearGradient(base.x, base.y, topX, topY);
        beamGrad.addColorStop(0, bm.col + "0.22)");
        beamGrad.addColorStop(0.5, bm.col + "0.08)");
        beamGrad.addColorStop(1, bm.col + "0)");

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(base.x - 1.0, base.y);
        ctx.lineTo(topX - 10, topY);
        ctx.lineTo(topX + 10, topY);
        ctx.lineTo(base.x + 1.0, base.y);
        ctx.closePath();
        ctx.fill();
      });
    }

    // ======================================================
    // 12. FOREGROUND DISTANCE HAZE & OBLIQUE LENS DEPTH (Late sun dust & real haze)
    // ======================================================
    const mist = ctx.createLinearGradient(0, 0, 0, H);
    mist.addColorStop(0, "rgba(245, 230, 210, 0.07)"); // warm sunset sky haze
    mist.addColorStop(0.85, "rgba(245, 230, 210, 0)");
    mist.addColorStop(1, "rgba(120, 110, 100, 0.05)"); // soft ground shadows
    ctx.fillStyle = mist;
    ctx.fillRect(-W, -H, W * 2, H * 2);

    // FLOATING VOLUMETRIC FOG & ATMOSPHERIC PERSPECTIVE
    if (Store.s.settings.animations) {
      ctx.save();
      const fogTime = Date.now() * 0.00015;
      const numFogBands = 4;
      for (let f = 0; f < numFogBands; f++) {
        const fogY = H * 0.35 + (f * 45) + Math.sin(fogTime + f) * 15;
        const fogGrad = ctx.createLinearGradient(0, fogY - 20, 0, fogY + 20);
        const fogAlpha = 0.03 + Math.abs(Math.sin(fogTime * 2 + f)) * 0.04;
        
        fogGrad.addColorStop(0, "rgba(24, 44, 64, 0)");
        fogGrad.addColorStop(0.5, `rgba(157, 107, 255, ${fogAlpha})`); // soft purple-tinted volumetric fog
        fogGrad.addColorStop(1, "rgba(24, 44, 64, 0)");
        
        ctx.fillStyle = fogGrad;
        ctx.fillRect(-W * 1.5, fogY - 20, W * 3, 40);
      }
      ctx.restore();
    }

    ctx.restore();

    // ======================================================
    // 13. SCREEN-SPACE POST-PROCESSING (Cinematic Spire Glow, Warm Sun Haze, Soft Vignette)
    // ======================================================
    // Soft Spire Lights & Warm Glow
    const spires = [
      { cx: 0, cy: -30, h: 250, col: "rgba(254, 243, 199, " }, // Empire State Spire (Warm White/Amber)
      { cx: -90, cy: -115, h: 195, col: "rgba(255, 255, 255, " } // One WTC Spire (Bright White)
    ];
    spires.forEach(sp => {
      const topPt = project(sp.cx, sp.cy, sp.h);
      const scrX = W / 2 + panX + topPt.x * scale;
      const scrY = H / 2 + panY + topPt.y * scale;
      
      if (scrX > 0 && scrX < W && scrY > 0 && scrY < H) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        
        // Soft circular warm glow around the beacon core
        const bloom = ctx.createRadialGradient(scrX, scrY, 1, scrX, scrY, 30);
        bloom.addColorStop(0, "#ffffff");
        bloom.addColorStop(0.2, sp.col + "0.3)");
        bloom.addColorStop(0.6, sp.col + "0.08)");
        bloom.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(scrX, scrY, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // Cinematic Soft Film Grain for realistic atmospheric texture
    if (Store.s.settings.animations) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.008)";
      for (let g = 0; g < 10000; g++) {
        const gx = Math.random() * W;
        const gy = Math.random() * H;
        const gSize = Math.random() * 1.0 + 0.4;
        ctx.fillRect(gx, gy, gSize, gSize);
      }
      ctx.fillStyle = "rgba(0, 0, 0, 0.006)";
      for (let g = 0; g < 8000; g++) {
        const gx = Math.random() * W;
        const gy = Math.random() * H;
        const gSize = Math.random() * 0.8 + 0.4;
        ctx.fillRect(gx, gy, gSize, gSize);
      }
      ctx.restore();
    }

    // ======================================================
    // 14. SCREEN-SPACE CINEMATIC OVERLAYS (Golden Sun Dust & Ambient Warmth)
    // ======================================================
    if (Store.s.settings.animations) {
      const now = Date.now();
      
      // Floating Warm Gold Dust / Sun Pollen Motes
      const emberCount = 20;
      for (let e = 0; e < emberCount; e++) {
        const seed = e * 29.41;
        const ex = (seed + now * 0.015) % W;
        const ey = (seed * 1.7 + now * 0.005) % H;
        const radius = 0.8 + Math.abs(Math.sin(seed + now * 0.001)) * 1.0;
        const alpha = 0.04 + Math.abs(Math.sin(seed + now * 0.002)) * 0.08;
        
        ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`; // Golden amber sun particles
        ctx.beginPath();
        ctx.arc(ex, ey, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Upper-left Warm Sun Flare / Evening Haze
      const leakGradLeft = ctx.createRadialGradient(0, 0, 20, 0, 0, W * 0.5);
      leakGradLeft.addColorStop(0, "rgba(253, 186, 116, 0.07)"); // Amber sun glow
      leakGradLeft.addColorStop(0.5, "rgba(251, 191, 36, 0.02)"); // Golden haze fade
      leakGradLeft.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = leakGradLeft;
      ctx.fillRect(0, 0, W * 0.5, H * 0.5);
      
      // Lens Dust Speckles (subtle sun flare dust)
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      for (let d = 0; d < 6; d++) {
        const dx = (d * 142.53) % W;
        const dy = (d * 87.21) % H;
        ctx.beginPath();
        ctx.arc(dx, dy, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // C. Soft Warm Vignette to gently frame the golden scene
    const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(31, 23, 14, 0.35)"); // Warm charcoal/umber frame
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  // Draw specific architectural crowns, window clusters, and facade systems
  function drawHighFidelity3DBuilding(ctx, b) {
    const hw = b.w / 2;
    const hd = b.d / 2;
    const isSkyscraper = b.style !== "streetlight" && b.style !== "tree" && b.style !== "steam" && b.style !== "utility" && b.style !== "washington_arch" && b.style !== "vessel" && b.style !== "statue_of_liberty";
    const h = b.h * (isSkyscraper ? 1.25 : 1.0);

    // Shading palette
    const baseColor = b.baseColor || "#abc8e2";
    
    // Strong natural sunlight from upper-left (warm golden-cream tones)
    let leftFaceColor = blendColor(baseColor, "#fff8e7", 0.45);  // Bright golden-cream sunlit face
    let rightFaceColor = blendColor(baseColor, "#3a4050", 0.38); // Soft daytime shadow face (less harsh)
    let topFaceColor = blendColor(baseColor, "#ffffff", 0.55);   // Bright sunlit roof

    if (b.broken) {
      // Rusted diagnostic sector offline style
      leftFaceColor = "#4d2a25";
      rightFaceColor = "#261512";
      topFaceColor = "#3d1b17";
    }

    // Coordinates of building floor footprint
    const pFront = project(b.cx, b.cy + hd);
    const pLeft = project(b.cx - hw, b.cy);
    const pRight = project(b.cx + hw, b.cy);
    const pBack = project(b.cx, b.cy - hd);

    // Coordinate extrusions based on height tiers / setbacks
    const projectExtruded = (x, y, heightVal) => project(x, y, heightVal);

    // Helper to draw a sleek bright chamfer line catching sunset specular reflections down the central corner of buildings
    const drawSpecularEdge = (ptBot, ptTop) => {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"; // Specular highlight catching low sun highlights
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(ptBot.x, ptBot.y);
      ctx.lineTo(ptTop.x, ptTop.y);
      ctx.stroke();
    };

    // Helper to draw realistic busy rooftop detailing (Greebling: water towers, mechanical penthouses, antennas)
    const drawGreeble = (cx, cy, cz, w, d) => {
      const boxH = 5;
      const gw = w * 0.35;
      const gd = d * 0.35;
      
      const gpFront = projectExtruded(cx, cy + gd, cz);
      const gpLeft = projectExtruded(cx - gw, cy, cz);
      const gpRight = projectExtruded(cx + gw, cy, cz);
      
      const gpFront_t = projectExtruded(cx, cy + gd, cz + boxH);
      const gpLeft_t = projectExtruded(cx - gw, cy, cz + boxH);
      const gpRight_t = projectExtruded(cx + gw, cy, cz + boxH);
      const gpBack_t = projectExtruded(cx, cy - gd, cz + boxH);

      // Draw sides of penthouse
      ctx.fillStyle = "rgba(10, 12, 18, 0.95)"; // Deep matte charcoal/black
      ctx.beginPath();
      ctx.moveTo(gpLeft.x, gpLeft.y);
      ctx.lineTo(gpFront.x, gpFront.y);
      ctx.lineTo(gpFront_t.x, gpFront_t.y);
      ctx.lineTo(gpLeft_t.x, gpLeft_t.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(5, 7, 10, 0.98)";
      ctx.beginPath();
      ctx.moveTo(gpFront.x, gpFront.y);
      ctx.lineTo(gpRight.x, gpRight.y);
      ctx.lineTo(gpRight_t.x, gpRight_t.y);
      ctx.lineTo(gpFront_t.x, gpFront_t.y);
      ctx.closePath();
      ctx.fill();

      // Top penthouse plate
      ctx.fillStyle = "rgba(15, 20, 28, 0.95)";
      ctx.beginPath();
      ctx.moveTo(gpLeft_t.x, gpLeft_t.y);
      ctx.lineTo(gpFront_t.x, gpFront_t.y);
      ctx.lineTo(gpRight_t.x, gpRight_t.y);
      ctx.lineTo(gpBack_t.x, gpBack_t.y);
      ctx.closePath();
      ctx.fill();

      // Concrete/Yellow Helipad marking (standard real highrise feature)
      const helipadRadius = Math.min(w, d) * 0.38;
      if (helipadRadius > 4) {
        const helipadCenter = projectExtruded(cx, cy, cz);
        ctx.strokeStyle = "rgba(254, 240, 138, 0.5)"; // Soft industrial yellow ring
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(helipadCenter.x, helipadCenter.y, helipadRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(100, 116, 139, 0.5)"; // Matte grey letter 'H'
        ctx.font = "bold " + Math.max(5, Math.floor(helipadRadius * 0.8)) + "px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("H", helipadCenter.x, helipadCenter.y);
      }

      // Iconic NYC Wooden Water Tower (Draw on 40% of building roofs)
      if (Math.sin(cx * 3.1 + cy * 1.7) > 0.2) {
        ctx.save();
        const wtH = 8.5; // height of water tower
        const wtW = 4.0; // width
        const wtPt = projectExtruded(cx - w * 0.2, cy - d * 0.2, cz + boxH);
        
        // Draw 4 steel legs
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 0.8;
        const legOffsets = [[-2, -2], [2, -2], [2, 2], [-2, 2]];
        const legBasePt = projectExtruded(cx - w * 0.2, cy - d * 0.2, cz + boxH + 4);
        legOffsets.forEach(off => {
          const bPt = projectExtruded(cx - w * 0.2 + off[0], cy - d * 0.2 + off[1], cz + boxH);
          const tPt = projectExtruded(cx - w * 0.2 + off[0] * 0.5, cy - d * 0.2 + off[1] * 0.5, cz + boxH + 4);
          ctx.beginPath();
          ctx.moveTo(bPt.x, bPt.y);
          ctx.lineTo(tPt.x, tPt.y);
          ctx.stroke();
        });

        // Cylinder wooden vat
        const vatCenter = projectExtruded(cx - w * 0.2, cy - d * 0.2, cz + boxH + 4);
        const vatTop = projectExtruded(cx - w * 0.2, cy - d * 0.2, cz + boxH + 9);
        
        ctx.fillStyle = "#7c2d12"; // Warm cedar/rustic brown
        ctx.beginPath();
        ctx.ellipse(vatCenter.x, vatCenter.y, 2.0, 1.0, 0, 0, Math.PI);
        ctx.lineTo(vatTop.x + 2.0, vatTop.y);
        ctx.ellipse(vatTop.x, vatTop.y, 2.0, 1.0, 0, Math.PI, 0);
        ctx.lineTo(vatCenter.x - 2.0, vatCenter.y);
        ctx.closePath();
        ctx.fill();

        // Dark conical roof of water tower
        const roofApex = projectExtruded(cx - w * 0.2, cy - d * 0.2, cz + boxH + 11.5);
        ctx.fillStyle = "#27272a"; // Zinc/charcoal slate roof
        ctx.beginPath();
        ctx.moveTo(vatTop.x - 2.1, vatTop.y);
        ctx.lineTo(vatTop.x + 2.1, vatTop.y);
        ctx.lineTo(roofApex.x, roofApex.y);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // Slim industrial steel antenna mast
      ctx.strokeStyle = "#475569"; // Slate gray steel
      ctx.lineWidth = 0.9;
      const antBase = projectExtruded(cx, cy, cz + boxH);
      const antTop = projectExtruded(cx, cy, cz + boxH + 11);
      ctx.beginPath();
      ctx.moveTo(antBase.x, antBase.y);
      ctx.lineTo(antTop.x, antTop.y);
      ctx.stroke();

      // Flashing Red Aviation Warning Beacon (realistic standard)
      const blink = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${blink * 0.85 + 0.15})`;
      ctx.beginPath();
      ctx.arc(antTop.x, antTop.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    };

    // Draw solid walls with modular paneling lines to break up flat surfaces
    const drawFacet = (pt1, pt2, pt2_top, pt1_top, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.lineTo(pt2_top.x, pt2_top.y);
      ctx.lineTo(pt1_top.x, pt1_top.y);
      ctx.closePath();
      ctx.fill();
      
      // Draw realistic horizontal masonry block joints or concrete slab lines
      const heightEst = Math.abs(pt1.y - pt1_top.y);
      const widthEst = Math.abs(pt1.x - pt2.x);
      
      ctx.strokeStyle = "rgba(0, 0, 0, 0.12)"; // Very soft architectural groove color
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      
      // Horizontal slab lines
      const slabCount = Math.floor(heightEst / 6.5);
      for (let f = 1; f <= slabCount; f++) {
        const r = f / (slabCount + 1);
        const lP = { x: pt1.x * (1 - r) + pt1_top.x * r, y: pt1.y * (1 - r) + pt1_top.y * r };
        const rP = { x: pt2.x * (1 - r) + pt2_top.x * r, y: pt2.y * (1 - r) + pt2_top.y * r };
        ctx.moveTo(lP.x, lP.y);
        ctx.lineTo(rP.x, rP.y);
      }
      ctx.stroke();

      // Vertical expansion joint panel seams
      ctx.beginPath();
      const colCount = Math.floor(widthEst / 8.0);
      if (colCount > 1) {
        for (let c = 1; c <= colCount; c++) {
          const r = c / (colCount + 1);
          const bP = { x: pt1.x * (1 - r) + pt2.x * r, y: pt1.y * (1 - r) + pt2.y * r };
          const tP = { x: pt1_top.x * (1 - r) + pt2_top.x * r, y: pt1_top.y * (1 - r) + pt2_top.y * r };
          ctx.moveTo(bP.x, bP.y);
          ctx.lineTo(tP.x, tP.y);
        }
      }
      ctx.stroke();

      // Subtle light-catching edge highlight on corners
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(pt2.x, pt2.y);
      ctx.lineTo(pt2_top.x, pt2_top.y);
      ctx.stroke();

      // Soft thin panel borders
      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.lineTo(pt2_top.x, pt2_top.y);
      ctx.lineTo(pt1_top.x, pt1_top.y);
      ctx.closePath();
      ctx.stroke();
    };

    // ----------------------------------------------------
    // PROCEDURAL PROPS & EXPERIMENTAL SHAPES RENDERERS
    // ----------------------------------------------------
    if (b.style === "streetlight") {
      const base = project(b.cx, b.cy, 0);
      const top = projectExtruded(b.cx, b.cy, h);
      
      // Draw thin pole
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      // Curve the top slightly to represent a street lamp arm
      const arm = projectExtruded(b.cx + 2.5, b.cy, h);
      ctx.lineTo(arm.x, arm.y);
      ctx.stroke();

      // Glowing streetlamp bulb (Warm high-pressure sodium amber)
      const glowBlink = Math.sin(Date.now() * 0.003 + b.cx) * 0.15 + 0.85;
      const col = "rgba(251, 191, 36, ";
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(arm.x, arm.y, 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = col + (0.45 * glowBlink) + ")";
      ctx.beginPath();
      ctx.arc(arm.x, arm.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (b.style === "tree") {
      const base = project(b.cx, b.cy, 0);
      const top = projectExtruded(b.cx, b.cy, h);
      // Trunk
      ctx.strokeStyle = "#2e1e12";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();

      // Natural NYC foliage (soft park green and golden autumn rust colors)
      const foliageCol = b.cy % 3 === 0 ? "rgba(34, 197, 94, " : b.cy % 3 === 1 ? "rgba(217, 119, 6, " : "rgba(22, 163, 74, ";
      ctx.fillStyle = foliageCol + "0.68)";
      ctx.beginPath();
      ctx.arc(top.x, top.y, 4.0, 0, Math.PI * 2);
      ctx.fill();

      // Soft natural foliage halo (no high-tech neon outer glow)
      ctx.fillStyle = foliageCol + "0.22)";
      ctx.beginPath();
      ctx.arc(top.x, top.y, 7.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (b.style === "steam") {
      const base = project(b.cx, b.cy, 0);
      // Draw a dark manhole circle on pavement
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Drifting steam particles
      const t = (Date.now() * 0.0008 + Math.abs(b.cx)) % 1.0;
      const steamY = base.y - t * 24;
      const steamX = base.x + Math.sin(t * 7 + b.cy) * 4.5;
      const steamAlpha = (1.0 - t) * 0.45;
      const r = 2 + t * 5.5;

      ctx.fillStyle = `rgba(180, 220, 255, ${steamAlpha})`;
      ctx.beginPath();
      ctx.arc(steamX, steamY, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (b.style === "utility") {
      const base = project(b.cx, b.cy, 0);
      const top = projectExtruded(b.cx, b.cy, h);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();

      // Draw cross beams
      const midY = base.y - (base.y - top.y) * 0.5;
      ctx.beginPath();
      ctx.moveTo(base.x - 3, midY);
      ctx.lineTo(base.x + 3, midY);
      ctx.moveTo(base.x - 2, top.y + 3);
      ctx.lineTo(base.x + 2, top.y + 3);
      ctx.stroke();

      // Red blinking warning beacon at the top
      const blink = Math.sin(Date.now() * 0.007 + b.cx) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${blink})`;
      ctx.beginPath();
      ctx.arc(top.x, top.y, 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (b.style === "pyramid") {
      const pFront = project(b.cx, b.cy + hd);
      const pLeft = project(b.cx - hw, b.cy);
      const pRight = project(b.cx + hw, b.cy);
      const pApex = projectExtruded(b.cx, b.cy, h);

      // Left face
      ctx.fillStyle = leftFaceColor;
      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pFront.x, pFront.y);
      ctx.lineTo(pApex.x, pApex.y);
      ctx.closePath();
      ctx.fill();

      // Right face
      ctx.fillStyle = rightFaceColor;
      ctx.beginPath();
      ctx.moveTo(pFront.x, pFront.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.lineTo(pApex.x, pApex.y);
      ctx.closePath();
      ctx.fill();

      drawSpecularEdge(pFront, pApex);

      // Glowing corners of the pyramid (Soft golden sunset highlight)
      ctx.strokeStyle = "rgba(253, 224, 71, 0.45)";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(pFront.x, pFront.y);
      ctx.lineTo(pApex.x, pApex.y);
      ctx.stroke();
      return;
    }

    if (b.style === "cylinder") {
      const rX = hw;
      const rY = hd * 0.5; // perspective ellipse
      const basePt = project(b.cx, b.cy, 0);
      const topPt = projectExtruded(b.cx, b.cy, h);

      // Draw solid filled cylinder body
      ctx.fillStyle = leftFaceColor;
      ctx.beginPath();
      ctx.ellipse(basePt.x, basePt.y, rX, rY, 0, 0, Math.PI);
      ctx.lineTo(topPt.x + rX, topPt.y);
      ctx.ellipse(topPt.x, topPt.y, rX, rY, 0, Math.PI, 0);
      ctx.lineTo(basePt.x - rX, basePt.y);
      ctx.closePath();
      ctx.fill();

      // Realtime cylinder shadow mapping
      const cyGrad = ctx.createLinearGradient(basePt.x - rX, basePt.y, basePt.x + rX, basePt.y);
      cyGrad.addColorStop(0, "rgba(255,255,255,0.18)");
      cyGrad.addColorStop(0.3, "rgba(255,255,255,0.06)");
      cyGrad.addColorStop(0.7, "rgba(0,0,0,0.32)");
      cyGrad.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = cyGrad;
      ctx.beginPath();
      ctx.ellipse(basePt.x, basePt.y, rX, rY, 0, 0, Math.PI);
      ctx.lineTo(topPt.x + rX, topPt.y);
      ctx.ellipse(topPt.x, topPt.y, rX, rY, 0, Math.PI, 0);
      ctx.lineTo(basePt.x - rX, basePt.y);
      ctx.closePath();
      ctx.fill();

      // Top cap ellipse
      ctx.fillStyle = topFaceColor;
      ctx.beginPath();
      ctx.ellipse(topPt.x, topPt.y, rX, rY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal metal structure bands wrapping around the cylinder
      const ringCount = Math.floor(h / 30);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
      ctx.lineWidth = 1.0;
      for (let ri = 1; ri < ringCount; ri++) {
        const ringH = (h / ringCount) * ri;
        const ringPt = projectExtruded(b.cx, b.cy, ringH);
        ctx.beginPath();
        ctx.ellipse(ringPt.x, ringPt.y, rX, rY, 0, 0, Math.PI); // Draw front half of ring
        ctx.stroke();
      }
      return;
    }

    if (b.style === "spire") {
      const base = project(b.cx, b.cy, 0);
      const p1 = projectExtruded(b.cx - hw * 0.4, b.cy, 0);
      const p2 = projectExtruded(b.cx + hw * 0.4, b.cy, 0);
      const t_apex = projectExtruded(b.cx, b.cy, h);

      // Left face of needle
      ctx.fillStyle = leftFaceColor;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(t_apex.x, t_apex.y);
      ctx.lineTo(base.x, base.y);
      ctx.closePath();
      ctx.fill();

      // Right face of needle
      ctx.fillStyle = rightFaceColor;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(t_apex.x, t_apex.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.fill();

      // Red blinking safety beacon at apex
      const blink = Math.sin(Date.now() * 0.005 + b.cx) * 0.5 + 0.5;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(t_apex.x, t_apex.y, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(239, 68, 68, ${0.75 * blink})`;
      ctx.beginPath();
      ctx.arc(t_apex.x, t_apex.y, 6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // ----------------------------------------------------
    // STYLE A: ONE WORLD TRADE CENTER (Tapering Octagonal Prism)
    // ----------------------------------------------------
    if (b.style === "wtc") {
      // 1 WTC is a masterpiece of tapering triangular facets.
      // Base square transitions to central octagon and terminates on small top square rotated 45 degrees
      const topRotSize = hw * 0.45;
      const t0 = projectExtruded(b.cx, b.cy + topRotSize, h);
      const t1 = projectExtruded(b.cx + topRotSize, b.cy, h);
      const t2 = projectExtruded(b.cx, b.cy - topRotSize, h);
      const t3 = projectExtruded(b.cx - topRotSize, b.cy, h);

      // We draw the 4 primary visible crystalline facets
      // Left-front facet
      ctx.fillStyle = leftFaceColor;
      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pFront.x, pFront.y);
      ctx.lineTo(t0.x, t0.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.closePath();
      ctx.fill();

      // Highlight stripe
      ctx.fillStyle = blendColor(baseColor, "#ffffff", 0.15);
      ctx.beginPath();
      ctx.moveTo(pFront.x, pFront.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t0.x, t0.y);
      ctx.closePath();
      ctx.fill();

      // Right-front facet (Shadowed side)
      ctx.fillStyle = rightFaceColor;
      ctx.beginPath();
      ctx.moveTo(pFront.x, pFront.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.closePath();
      ctx.fill();

      // Top roof plate
      ctx.fillStyle = topFaceColor;
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(t2.x, t2.y);
      ctx.lineTo(t3.x, t3.y);
      ctx.closePath();
      ctx.fill();

      // Golden sunset specular highlights on the sharp front crystalline ridges
      if (!b.broken) {
        drawSpecularEdge(pFront, t0);
        drawSpecularEdge(pFront, t1);
      }

      // Giant detailed metallic spire mast
      if (!b.broken) {
        const mastBase = projectExtruded(b.cx, b.cy, h);
        const mastTop = projectExtruded(b.cx, b.cy, h + 42);
        ctx.strokeStyle = "#b3c1cc";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(mastBase.x, mastBase.y);
        ctx.lineTo(mastTop.x, mastTop.y);
        ctx.stroke();

        // Helipad circle on roof
        ctx.strokeStyle = "rgba(69, 209, 131, 0.4)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(mastBase.x, mastBase.y, 4, 0, Math.PI * 2);
        ctx.stroke();

        // Spire blinking red aviation safety beacon (slow fade)
        const blink = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 77, 77, ${blink})`;
        ctx.beginPath();
        ctx.arc(mastTop.x, mastTop.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ----------------------------------------------------
    // STYLE AA: EMPIRE STATE BUILDING (Setback Spire Tower)
    // ----------------------------------------------------
    else if (b.style === "esb") {
      // Classic art-deco tiered setback tower
      const h1 = h * 0.45;
      const h2 = h * 0.75;
      const h3 = h * 0.90;

      // Base block
      const pFront1 = projectExtruded(b.cx, b.cy + hd, h1);
      const pLeft1 = projectExtruded(b.cx - hw, b.cy, h1);
      const pRight1 = projectExtruded(b.cx + hw, b.cy, h1);
      const pBack1 = projectExtruded(b.cx, b.cy - hd, h1);

      drawFacet(pLeft, pFront, pFront1, pLeft1, leftFaceColor);
      drawFacet(pFront, pRight, pRight1, pFront1, rightFaceColor);

      // Tier 2 setback
      const hw2 = hw * 0.75;
      const hd2 = hd * 0.75;
      const pFront2_b = projectExtruded(b.cx, b.cy + hd2, h1);
      const pLeft2_b = projectExtruded(b.cx - hw2, b.cy, h1);
      const pRight2_b = projectExtruded(b.cx + hw2, b.cy, h1);

      const pFront2_t = projectExtruded(b.cx, b.cy + hd2, h2);
      const pLeft2_t = projectExtruded(b.cx - hw2, b.cy, h2);
      const pRight2_t = projectExtruded(b.cx + hw2, b.cy, h2);

      drawFacet(pLeft2_b, pFront2_b, pFront2_t, pLeft2_t, leftFaceColor);
      drawFacet(pFront2_b, pRight2_b, pRight2_t, pFront2_t, rightFaceColor);

      // Tier 3 setback
      const hw3 = hw * 0.50;
      const hd3 = hd * 0.50;
      const pFront3_b = projectExtruded(b.cx, b.cy + hd3, h2);
      const pLeft3_b = projectExtruded(b.cx - hw3, b.cy, h2);
      const pRight3_b = projectExtruded(b.cx + hw3, b.cy, h2);

      const pFront3_t = projectExtruded(b.cx, b.cy + hd3, h3);
      const pLeft3_t = projectExtruded(b.cx - hw3, b.cy, h3);
      const pRight3_t = projectExtruded(b.cx + hw3, b.cy, h3);

      drawFacet(pLeft3_b, pFront3_b, pFront3_t, pLeft3_t, leftFaceColor);
      drawFacet(pFront3_b, pRight3_b, pRight3_t, pFront3_t, rightFaceColor);

      // Spire base / dome
      const mastBase = projectExtruded(b.cx, b.cy, h3);
      const mastTop = projectExtruded(b.cx, b.cy, h + 50); // Tall mast

      // Drawing a thick real metallic spire mast
      ctx.strokeStyle = "rgba(226, 232, 240, 0.95)";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(mastBase.x, mastBase.y);
      ctx.lineTo(mastTop.x, mastTop.y);
      ctx.stroke();

      // Volumetric searchlight / god ray beam shooting up from the spire (Warm sunset gold)
      const glow = ctx.createLinearGradient(mastTop.x, mastTop.y, mastTop.x, mastTop.y - 120);
      glow.addColorStop(0, "rgba(254, 240, 138, 0.28)"); // Soft amber/yellow core
      glow.addColorStop(0.3, "rgba(251, 191, 36, 0.12)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(mastTop.x - 1, mastTop.y);
      ctx.lineTo(mastTop.x - 15, mastTop.y - 120);
      ctx.lineTo(mastTop.x + 15, mastTop.y - 120);
      ctx.lineTo(mastTop.x + 1, mastTop.y);
      ctx.closePath();
      ctx.fill();

      // Fast flashing white beacon at tip
      const beaconFlash = Math.sin(Date.now() * 0.012) > 0.6 ? 1.0 : 0.25;
      ctx.fillStyle = `rgba(255, 255, 255, ${beaconFlash})`;
      ctx.beginPath();
      ctx.arc(mastTop.x, mastTop.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Window layers on setbacks
      drawRandomWindows(ctx, pLeft, pFront, pFront1, pLeft1, b.id + "_1", b.broken);
      drawRandomWindows(ctx, pFront, pRight, pRight1, pFront1, b.id + "_1r", b.broken);
      drawRandomWindows(ctx, pLeft2_b, pFront2_b, pFront2_t, pLeft2_t, b.id + "_2", b.broken);
      drawRandomWindows(ctx, pFront2_b, pRight2_b, pRight2_t, pFront2_t, b.id + "_2r", b.broken);
    }

    // ----------------------------------------------------
    // STYLE B: 40 WALL STREET (Pyramid Crown Skyscraper)
    // ----------------------------------------------------
    else if (b.style === "wall40") {
      const setbackH = h * 0.6;
      const sfFront = projectExtruded(b.cx, b.cy + hd, setbackH);
      const sfLeft = projectExtruded(b.cx - hw, b.cy, setbackH);
      const sfRight = projectExtruded(b.cx + hw, b.cy, setbackH);

      // Draw Lower Block
      drawFacet(pLeft, pFront, sfFront, sfLeft, leftFaceColor);
      drawFacet(pFront, pRight, sfRight, sfFront, rightFaceColor);

      // Draw Upper tier
      const upW = hw * 0.7;
      const upD = hd * 0.7;
      const roofH = h * 0.85;

      const utFront_b = projectExtruded(b.cx, b.cy + upD, setbackH);
      const utLeft_b = projectExtruded(b.cx - upW, b.cy, setbackH);
      const utRight_b = projectExtruded(b.cx + upW, b.cy, setbackH);

      const utFront_t = projectExtruded(b.cx, b.cy + upD, roofH);
      const utLeft_t = projectExtruded(b.cx - upW, b.cy, roofH);
      const utRight_t = projectExtruded(b.cx + upW, b.cy, roofH);

      drawFacet(utLeft_b, utFront_b, utFront_t, utLeft_t, leftFaceColor);
      drawFacet(utFront_b, utRight_b, utRight_t, utFront_t, rightFaceColor);

      // Green pyramid copper roof (40 Wall Street iconic feature)
      const roofTip = projectExtruded(b.cx, b.cy, h);
      const copperLeft = b.broken ? "#5e423d" : "#439478"; // oxidized green
      const copperRight = b.broken ? "#3d2a27" : "#2f6e58";

      ctx.fillStyle = copperLeft;
      ctx.beginPath();
      ctx.moveTo(utLeft_t.x, utLeft_t.y);
      ctx.lineTo(utFront_t.x, utFront_t.y);
      ctx.lineTo(roofTip.x, roofTip.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = copperRight;
      ctx.beginPath();
      ctx.moveTo(utFront_t.x, utFront_t.y);
      ctx.lineTo(utRight_t.x, utRight_t.y);
      ctx.lineTo(roofTip.x, roofTip.y);
      ctx.closePath();
      ctx.fill();

      // Slender gold spire needle
      if (!b.broken) {
        const needleTop = projectExtruded(b.cx, b.cy, h + 18);
        ctx.strokeStyle = "#ffd700"; // gold leaf
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(roofTip.x, roofTip.y);
        ctx.lineTo(needleTop.x, needleTop.y);
        ctx.stroke();
      }

      drawRandomWindows(ctx, pLeft, pFront, sfFront, sfLeft, b.id, b.broken);
      drawRandomWindows(ctx, pFront, pRight, sfRight, sfFront, b.id + "_r", b.broken);
    }

    // ----------------------------------------------------
    // STYLE C: WOOLWORTH BUILDING (Gothic Gothic Setbacks)
    // ----------------------------------------------------
    else if (b.style === "woolworth") {
      // 3 Tiers of classical setbacks topped with gothic copper spire
      const t1 = h * 0.4;
      const t2 = h * 0.75;

      const drawTier = (wF, dF, hStart, hEnd) => {
        const tw = hw * wF;
        const td = hd * dF;
        const bF = projectExtruded(b.cx, b.cy + td, hStart);
        const bL = projectExtruded(b.cx - tw, b.cy, hStart);
        const bR = projectExtruded(b.cx + tw, b.cy, hStart);

        const tF = projectExtruded(b.cx, b.cy + td, hEnd);
        const tL = projectExtruded(b.cx - tw, b.cy, hEnd);
        const tR = projectExtruded(b.cx + tw, b.cy, hEnd);

        drawFacet(bL, bF, tF, tL, leftFaceColor);
        drawFacet(bF, bR, tR, tF, rightFaceColor);

        // Ornate cornices (little stone shelves wrapping around)
        ctx.strokeStyle = "#ffffff";
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tL.x, tL.y);
        ctx.lineTo(tF.x, tF.y);
        ctx.lineTo(tR.x, tR.y);
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        drawRandomWindows(ctx, bL, bF, tF, tL, b.id + "_" + hStart, b.broken);
        drawRandomWindows(ctx, bF, bR, tR, tF, b.id + "_r_" + hStart, b.broken);
      };

      drawTier(1.0, 1.0, 0, t1);
      drawTier(0.75, 0.75, t1, t2);
      drawTier(0.55, 0.55, t2, h * 0.9);

      // Gothic copper crown
      const crownBaseY = h * 0.9;
      const cw = hw * 0.55;
      const cd = hd * 0.55;
      const crFront = projectExtruded(b.cx, b.cy + cd, crownBaseY);
      const crLeft = projectExtruded(b.cx - cw, b.cy, crownBaseY);
      const crRight = projectExtruded(b.cx + cw, b.cy, crownBaseY);
      const crTip = projectExtruded(b.cx, b.cy, h);

      ctx.fillStyle = b.broken ? "#523733" : "#3b8066";
      ctx.beginPath();
      ctx.moveTo(crLeft.x, crLeft.y);
      ctx.lineTo(crFront.x, crFront.y);
      ctx.lineTo(crTip.x, crTip.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = b.broken ? "#3d2926" : "#2a5c4a";
      ctx.beginPath();
      ctx.moveTo(crFront.x, crFront.y);
      ctx.lineTo(crRight.x, crRight.y);
      ctx.lineTo(crTip.x, crTip.y);
      ctx.closePath();
      ctx.fill();
    }

    // ----------------------------------------------------
    // STYLE D: 8 SPRUCE STREET / GEHRY (Metallic Wave Facade)
    // ----------------------------------------------------
    else if (b.style === "gehry") {
      const pFront_t = projectExtruded(b.cx, b.cy + hd, h);
      const pLeft_t = projectExtruded(b.cx - hw, b.cy, h);
      const pRight_t = projectExtruded(b.cx + hw, b.cy, h);
      const pBack_t = projectExtruded(b.cx, b.cy - hd, h);

      drawFacet(pLeft, pFront, pFront_t, pLeft_t, leftFaceColor);
      drawFacet(pFront, pRight, pRight_t, pFront_t, rightFaceColor);

      // Top Roof plate
      ctx.fillStyle = topFaceColor;
      ctx.beginPath();
      ctx.moveTo(pLeft_t.x, pLeft_t.y);
      ctx.lineTo(pFront_t.x, pFront_t.y);
      ctx.lineTo(pRight_t.x, pRight_t.y);
      ctx.lineTo(pBack_t.x, pBack_t.y);
      ctx.closePath();
      ctx.fill();

      // Golden specular corner highlight catching low sunset rays
      if (!b.broken) {
        drawSpecularEdge(pFront, pFront_t);
      }

      // Custom horizontal waves in Gehry style facade (wavy steel ripples)
      if (!b.broken) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        const steps = Math.floor(h / 6);
        for (let i = 1; i < steps; i++) {
          const ratio = i / steps;
          const rH = h * ratio;
          const lP = projectExtruded(b.cx - hw, b.cy, rH);
          const fP = projectExtruded(b.cx, b.cy + hd, rH);
          const rP = projectExtruded(b.cx + hw, b.cy, rH);

          // left facade wave
          ctx.moveTo(lP.x, lP.y);
          ctx.quadraticCurveTo((lP.x + fP.x) / 2 + Math.sin(ratio * 20) * 1.5, (lP.y + fP.y) / 2, fP.x, fP.y);
          // right facade wave
          ctx.lineTo(rP.x, rP.y);
        }
        ctx.stroke();

        // Busy rooftop mechanical penthouse and antennas
        drawGreeble(b.cx, b.cy, h, hw, hd);
      }

      drawRandomWindows(ctx, pLeft, pFront, pFront_t, pLeft_t, b.id, b.broken);
      drawRandomWindows(ctx, pFront, pRight, pRight_t, pFront_t, b.id + "_r", b.broken);
    }

    // ----------------------------------------------------
    // STYLE E: SETBACK TOWERS / 70 PINE (Classical skyscrapers)
    // ----------------------------------------------------
    else if (b.style === "setback" || b.style === "pine70") {
      const setbackCount = b.style === "pine70" ? 4 : 3;
      let lastH = 0;
      
      for (let s = 1; s <= setbackCount; s++) {
        const factor = 1.0 - (s - 1) * 0.18;
        const curH = s === setbackCount ? h : lastH + (h - lastH) * 0.35;
        
        const sw = hw * factor;
        const sd = hd * factor;

        const sb_f = projectExtruded(b.cx, b.cy + sd, lastH);
        const sb_l = projectExtruded(b.cx - sw, b.cy, lastH);
        const sb_r = projectExtruded(b.cx + sw, b.cy, lastH);

        const st_f = projectExtruded(b.cx, b.cy + sd, curH);
        const st_l = projectExtruded(b.cx - sw, b.cy, curH);
        const st_r = projectExtruded(b.cx + sw, b.cy, curH);

        drawFacet(sb_l, sb_f, st_f, st_l, leftFaceColor);
        drawFacet(sb_f, sb_r, st_r, st_f, rightFaceColor);

        // Highlight every setback's vertical corner edge
        if (!b.broken) {
          drawSpecularEdge(sb_f, st_f);
        }

        // Ornate window outlines
        drawRandomWindows(ctx, sb_l, sb_f, st_f, st_l, b.id + "_" + s, b.broken);
        drawRandomWindows(ctx, sb_f, sb_r, st_r, st_f, b.id + "_r_" + s, b.broken);

        lastH = curH;
      }

      // Spires on 70 Pine
      if (b.style === "pine70" && !b.broken) {
        const roofTip = projectExtruded(b.cx, b.cy, h);
        const spireTip = projectExtruded(b.cx, b.cy, h + 24);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(roofTip.x, roofTip.y);
        ctx.lineTo(spireTip.x, spireTip.y);
        ctx.stroke();

        const blink = Math.sin(Date.now() * 0.007) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 77, 77, ${blink})`;
        ctx.beginPath();
        ctx.arc(spireTip.x, spireTip.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ----------------------------------------------------
    // STYLE F: GLASS CURTAIN WALL BLOCKS (Battery Park City)
    // ----------------------------------------------------
    else if (b.style === "glass" || b.style === "slab") {
      const pFront_t = projectExtruded(b.cx, b.cy + hd, h);
      const pLeft_t = projectExtruded(b.cx - hw, b.cy, h);
      const pRight_t = projectExtruded(b.cx + hw, b.cy, h);
      const pBack_t = projectExtruded(b.cx, b.cy - hd, h);

      drawFacet(pLeft, pFront, pFront_t, pLeft_t, leftFaceColor);
      drawFacet(pFront, pRight, pRight_t, pFront_t, rightFaceColor);

      // Top Roof plate
      ctx.fillStyle = topFaceColor;
      ctx.beginPath();
      ctx.moveTo(pLeft_t.x, pLeft_t.y);
      ctx.lineTo(pFront_t.x, pFront_t.y);
      ctx.lineTo(pRight_t.x, pRight_t.y);
      ctx.lineTo(pBack_t.x, pBack_t.y);
      ctx.closePath();
      ctx.fill();

      // Specular bright edge highlight down the front glass seam
      if (!b.broken) {
        drawSpecularEdge(pFront, pFront_t);
      }

      // Glass vertical grid columns
      if (!b.broken) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1.5;
        const steps = b.style === "slab" ? 8 : 4;
        for (let i = 1; i < steps; i++) {
          const ratio = i / steps;
          const botL = projectExtruded(b.cx - hw + b.w * ratio, b.cy, 0);
          const topL = projectExtruded(b.cx - hw + b.w * ratio, b.cy, h);
          ctx.beginPath();
          ctx.moveTo(botL.x, botL.y);
          ctx.lineTo(topL.x, topL.y);
          ctx.stroke();
        }

        // Rooftop greebling detailing
        drawGreeble(b.cx, b.cy, h, hw, hd);
      }

      drawRandomWindows(ctx, pLeft, pFront, pFront_t, pLeft_t, b.id, b.broken);
      drawRandomWindows(ctx, pFront, pRight, pRight_t, pFront_t, b.id + "_r", b.broken);
    }

    // ----------------------------------------------------
    // STYLE F2: WASHINGTON SQUARE ARCH
    // ----------------------------------------------------
    else if (b.style === "washington_arch") {
      const archColor = "#e2e8f0";
      const shadowColor = "#cbd5e1";
      
      // Left pillar
      const lp1 = projectExtruded(b.cx - 6, b.cy, 0);
      const lp1_t = projectExtruded(b.cx - 6, b.cy, 18);
      const lp2 = projectExtruded(b.cx - 2, b.cy, 0);
      const lp2_t = projectExtruded(b.cx - 2, b.cy, 18);

      // Right pillar
      const rp1 = projectExtruded(b.cx + 2, b.cy, 0);
      const rp1_t = projectExtruded(b.cx + 2, b.cy, 18);
      const rp2 = projectExtruded(b.cx + 6, b.cy, 0);
      const rp2_t = projectExtruded(b.cx + 6, b.cy, 18);

      ctx.strokeStyle = archColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(lp1.x, lp1.y); ctx.lineTo(lp1_t.x, lp1_t.y);
      ctx.moveTo(lp2.x, lp2.y); ctx.lineTo(lp2_t.x, lp2_t.y);
      ctx.moveTo(rp1.x, rp1.y); ctx.lineTo(rp1_t.x, rp1_t.y);
      ctx.moveTo(rp2.x, rp2.y); ctx.lineTo(rp2_t.x, rp2_t.y);
      ctx.stroke();

      // Top Arch slab connecting them
      const top1 = projectExtruded(b.cx - 7, b.cy, 18);
      const top2 = projectExtruded(b.cx + 7, b.cy, 18);
      const top1_t = projectExtruded(b.cx - 7, b.cy, 24);
      const top2_t = projectExtruded(b.cx + 7, b.cy, 24);

      ctx.strokeStyle = archColor;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo((top1.x + top1_t.x)/2, (top1.y + top1_t.y)/2);
      ctx.lineTo((top2.x + top2_t.x)/2, (top2.y + top2_t.y)/2);
      ctx.stroke();
    }

    // ----------------------------------------------------
    // STYLE F3: FLATIRON BUILDING (3D Wedge)
    // ----------------------------------------------------
    else if (b.style === "flatiron") {
      const ptFront = projectExtruded(b.cx, b.cy + hd, 0);
      const ptLeft = projectExtruded(b.cx - hw, b.cy - hd, 0);
      const ptRight = projectExtruded(b.cx + hw, b.cy - hd, 0);

      const ptFront_t = projectExtruded(b.cx, b.cy + hd, h);
      const ptLeft_t = projectExtruded(b.cx - hw, b.cy - hd, h);
      const ptRight_t = projectExtruded(b.cx + hw, b.cy - hd, h);

      // Left face
      ctx.fillStyle = leftFaceColor;
      ctx.beginPath();
      ctx.moveTo(ptLeft.x, ptLeft.y);
      ctx.lineTo(ptFront.x, ptFront.y);
      ctx.lineTo(ptFront_t.x, ptFront_t.y);
      ctx.lineTo(ptLeft_t.x, ptLeft_t.y);
      ctx.closePath();
      ctx.fill();

      // Right face
      ctx.fillStyle = rightFaceColor;
      ctx.beginPath();
      ctx.moveTo(ptFront.x, ptFront.y);
      ctx.lineTo(ptRight.x, ptRight.y);
      ctx.lineTo(ptRight_t.x, ptRight_t.y);
      ctx.lineTo(ptFront_t.x, ptFront_t.y);
      ctx.closePath();
      ctx.fill();

      // Roof
      ctx.fillStyle = topFaceColor;
      ctx.beginPath();
      ctx.moveTo(ptFront_t.x, ptFront_t.y);
      ctx.lineTo(ptLeft_t.x, ptLeft_t.y);
      ctx.lineTo(ptRight_t.x, ptRight_t.y);
      ctx.closePath();
      ctx.fill();

      // Draw windows on wedge faces
      drawRandomWindows(ctx, ptLeft, ptFront, ptFront_t, ptLeft_t, b.id, b.broken);
      drawRandomWindows(ctx, ptFront, ptRight, ptRight_t, ptFront_t, b.id + "_r", b.broken);
    }

    // ----------------------------------------------------
    // STYLE F4: TIMES SQUARE BILLBOARDS
    // ----------------------------------------------------
    else if (b.style === "times_square") {
      const pFront_t = projectExtruded(b.cx, b.cy + hd, h);
      const pLeft_t = projectExtruded(b.cx - hw, b.cy, h);
      const pRight_t = projectExtruded(b.cx + hw, b.cy, h);
      const pBack_t = projectExtruded(b.cx, b.cy - hd, h);

      drawFacet(pLeft, pFront, pFront_t, pLeft_t, leftFaceColor);
      drawFacet(pFront, pRight, pRight_t, pFront_t, rightFaceColor);
      drawFacet(pLeft_t, pFront_t, pRight_t, pBack_t, topFaceColor);

      drawRandomWindows(ctx, pLeft, pFront, pFront_t, pLeft_t, b.id, b.broken);
      drawRandomWindows(ctx, pFront, pRight, pRight_t, pFront_t, b.id + "_r", b.broken);

      // Flashing billboards on front faces
      if (!b.broken) {
        ctx.save();
        const tNow = Date.now();
        const colors = ["#ff007f", "#00f0ff", "#ffe600", "#7f00ff"];
        const bbColor = colors[Math.floor(tNow / 1200) % colors.length];

        // Billboard panel
        const pBB_bl = projectExtruded(b.cx - hw * 0.8, b.cy + hd * 1.01, h * 0.35);
        const pBB_br = projectExtruded(b.cx + hw * 0.8, b.cy + hd * 1.01, h * 0.35);
        const pBB_tr = projectExtruded(b.cx + hw * 0.8, b.cy + hd * 1.01, h * 0.75);
        const pBB_tl = projectExtruded(b.cx - hw * 0.8, b.cy + hd * 1.01, h * 0.75);
        
        ctx.fillStyle = "rgba(10, 12, 18, 0.95)";
        ctx.beginPath();
        ctx.moveTo(pBB_bl.x, pBB_bl.y);
        ctx.lineTo(pBB_br.x, pBB_br.y);
        ctx.lineTo(pBB_tr.x, pBB_tr.y);
        ctx.lineTo(pBB_tl.x, pBB_tl.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = bbColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Neon scrolling messages
        ctx.fillStyle = bbColor;
        ctx.font = "bold 5.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const center = projectExtruded(b.cx, b.cy + hd * 1.01, h * 0.55);
        const messages = ["DIALED", "FOCUS", "AARUSH", "GROW", "NYC"];
        const msg = messages[Math.floor(tNow / 1500) % messages.length];
        ctx.fillText(msg, center.x, center.y);
        ctx.restore();
      }
    }

    // ----------------------------------------------------
    // STYLE F5: CENTRAL PARK GREENERY (Lawn & Trees)
    // ----------------------------------------------------
    else if (b.style === "central_park") {
      ctx.fillStyle = "#1e4620"; // Lush forest green lawn
      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pFront.x, pFront.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.lineTo(pBack.x, pBack.y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#2d5a2f";
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // Render miniature 3D trees
      const treeCoords = [
        { dx: -3, dy: -3, h: 7 },
        { dx: 3, dy: -2, h: 9 },
        { dx: -2, dy: 3, h: 8 },
        { dx: 4, dy: 4, h: 10 }
      ];

      treeCoords.forEach(t => {
        const trunkBase = projectExtruded(b.cx + t.dx, b.cy + t.dy, 0);
        const trunkTop = projectExtruded(b.cx + t.dx, b.cy + t.dy, t.h);

        // Brown trunk
        ctx.strokeStyle = "#5a3a22";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(trunkBase.x, trunkBase.y);
        ctx.lineTo(trunkTop.x, trunkTop.y);
        ctx.stroke();

        // Green canopy
        ctx.fillStyle = "#4a852b";
        ctx.beginPath();
        ctx.arc(trunkTop.x, trunkTop.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#6ca53d"; // highlights
        ctx.beginPath();
        ctx.arc(trunkTop.x - 1, trunkTop.y - 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // ----------------------------------------------------
    // STYLE F6: CHRYSLER BUILDING (Art Deco Crown)
    // ----------------------------------------------------
    else if (b.style === "chrysler") {
      const h1 = h * 0.4;
      const h2 = h * 0.7;
      const h3 = h * 0.85;

      // Base block
      const pFront1 = projectExtruded(b.cx, b.cy + hd, h1);
      const pLeft1 = projectExtruded(b.cx - hw, b.cy, h1);
      const pRight1 = projectExtruded(b.cx + hw, b.cy, h1);

      drawFacet(pLeft, pFront, pFront1, pLeft1, leftFaceColor);
      drawFacet(pFront, pRight, pRight1, pFront1, rightFaceColor);

      // Middle block
      const pFront2 = projectExtruded(b.cx, b.cy + hd * 0.75, h2);
      const pLeft2 = projectExtruded(b.cx - hw * 0.75, b.cy, h2);
      const pRight2 = projectExtruded(b.cx + hw * 0.75, b.cy, h2);

      drawFacet(pLeft1, pFront1, pFront2, pLeft2, leftFaceColor);
      drawFacet(pFront1, pRight1, pRight2, pFront2, rightFaceColor);

      // Crown setback
      const pFront3 = projectExtruded(b.cx, b.cy + hd * 0.45, h3);
      const pLeft3 = projectExtruded(b.cx - hw * 0.45, b.cy, h3);
      const pRight3 = projectExtruded(b.cx + hw * 0.45, b.cy, h3);

      drawFacet(pLeft2, pFront2, pFront3, pLeft3, "#94a3b8"); // Metallic silver faces
      drawFacet(pFront2, pRight2, pRight3, pFront3, "#cbd5e1");

      if (!b.broken) {
        // Chrysler radiating crown arches
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1.0;
        const crownCenter = projectExtruded(b.cx, b.cy, h3);
        for (let arc = 1; arc <= 4; arc++) {
          const rArc = arc * 2.5;
          ctx.beginPath();
          ctx.arc(crownCenter.x, crownCenter.y, rArc, Math.PI, Math.PI * 2);
          ctx.stroke();
        }

        // Long metallic needle spire
        const needleBase = projectExtruded(b.cx, b.cy, h3);
        const needleTop = projectExtruded(b.cx, b.cy, h + 38);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(needleBase.x, needleBase.y);
        ctx.lineTo(needleTop.x, needleTop.y);
        ctx.stroke();

        // Safety warning beacon
        const safetyBlink = Math.sin(Date.now() * 0.007) > 0.3;
        ctx.fillStyle = safetyBlink ? "#ff2200" : "rgba(0,0,0,0)";
        ctx.beginPath();
        ctx.arc(needleTop.x, needleTop.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      drawRandomWindows(ctx, pLeft, pFront, pFront1, pLeft1, b.id, b.broken);
      drawRandomWindows(ctx, pFront, pRight, pRight1, pFront1, b.id + "_r", b.broken);
    }

    // ----------------------------------------------------
    // STYLE F7: THE VESSEL (Honeycomb Copper Rings)
    // ----------------------------------------------------
    else if (b.style === "vessel") {
      ctx.save();
      const tiers = 5;
      const baseRadius = 8;
      const topRadius = 14;

      for (let t = 0; t <= tiers; t++) {
        const ratio = t / tiers;
        const rCurrent = baseRadius + ratio * (topRadius - baseRadius);
        const zCurrent = ratio * h;

        const center = projectExtruded(b.cx, b.cy, zCurrent);
        
        ctx.strokeStyle = "#b45309"; // Pure copper orange-brown
        ctx.fillStyle = "rgba(180, 83, 9, 0.15)";
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const pt = projectExtruded(b.cx + Math.cos(angle) * rCurrent, b.cy + Math.sin(angle) * rCurrent, zCurrent);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
      ctx.restore();
    }

    // ----------------------------------------------------
    // STYLE F8: STATUE OF LIBERTY (Pedestal + Copper Torch)
    // ----------------------------------------------------
    else if (b.style === "statue_of_liberty") {
      // Granite pedestal base blocks
      const p1 = projectExtruded(b.cx - 7, b.cy - 7, 0);
      const p2 = projectExtruded(b.cx + 7, b.cy - 7, 0);
      const p3 = projectExtruded(b.cx + 7, b.cy + 7, 0);
      const p4 = projectExtruded(b.cx - 7, b.cy + 7, 0);
      
      const pt1 = projectExtruded(b.cx - 5, b.cy - 5, 12);
      const pt2 = projectExtruded(b.cx + 5, b.cy - 5, 12);
      const pt3 = projectExtruded(b.cx + 5, b.cy + 5, 12);
      const pt4 = projectExtruded(b.cx - 5, b.cy + 5, 12);

      // Draw pedestal faces
      ctx.fillStyle = "#8a8b8c";
      ctx.beginPath();
      ctx.moveTo(p4.x, p4.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(pt3.x, pt3.y);
      ctx.lineTo(pt4.x, pt4.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#6b6c6d";
      ctx.beginPath();
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.lineTo(pt3.x, pt3.y);
      ctx.closePath();
      ctx.fill();

      // Green oxidized copper lady statue
      const statueCol = "#4d927d";
      const statueBase = projectExtruded(b.cx, b.cy, 12);
      const statueBody = projectExtruded(b.cx, b.cy, 24);
      const torchTip = projectExtruded(b.cx + 2, b.cy - 2, 30);

      // Main gown pillar
      ctx.strokeStyle = statueCol;
      ctx.lineWidth = 4.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(statueBase.x, statueBase.y);
      ctx.lineTo(statueBody.x, statueBody.y);
      ctx.stroke();

      // Raised arm holding torch
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(statueBody.x, statueBody.y - 3);
      ctx.lineTo(torchTip.x, torchTip.y);
      ctx.stroke();

      // Glowing golden flame
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.arc(torchTip.x, torchTip.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
      
      const flameBlink = Math.sin(Date.now() * 0.008) * 0.25 + 0.75;
      ctx.fillStyle = `rgba(234, 179, 8, ${flameBlink * 0.38})`;
      ctx.beginPath();
      ctx.arc(torchTip.x, torchTip.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ----------------------------------------------------
    // STYLE G: HISTORIC BRICK STRUCTURES (Low-Rise Seaport)
    // ----------------------------------------------------
    else {
      // Standard brick block with horizontal cornices & traditional roofs
      const pFront_t = projectExtruded(b.cx, b.cy + hd, h);
      const pLeft_t = projectExtruded(b.cx - hw, b.cy, h);
      const pRight_t = projectExtruded(b.cx + hw, b.cy, h);
      const pBack_t = projectExtruded(b.cx, b.cy - hd, h);

      drawFacet(pLeft, pFront, pFront_t, pLeft_t, leftFaceColor);
      drawFacet(pFront, pRight, pRight_t, pFront_t, rightFaceColor);

      // Draw horizontal masonry banding
      ctx.strokeStyle = "rgba(5, 5, 10, 0.18)";
      ctx.lineWidth = 2;
      const bands = Math.floor(h / 12);
      for (let i = 1; i <= bands; i++) {
        const bandH = (h / bands) * i;
        const lP = projectExtruded(b.cx - hw, b.cy, bandH);
        const fP = projectExtruded(b.cx, b.cy + hd, bandH);
        const rP = projectExtruded(b.cx + hw, b.cy, bandH);
        ctx.beginPath();
        ctx.moveTo(lP.x, lP.y);
        ctx.lineTo(fP.x, fP.y);
        ctx.lineTo(rP.x, rP.y);
        ctx.stroke();
      }

      // Rooftop wood water tower (NYC Iconic pre-war asset)
      if (b.style === "brick" && !b.broken) {
        const wtBase = projectExtruded(b.cx, b.cy, h);
        ctx.fillStyle = "#5c412f"; // wood barrel brown
        ctx.fillRect(wtBase.x - 3, wtBase.y - 8, 6, 8);
        ctx.strokeStyle = "#382316";
        ctx.strokeRect(wtBase.x - 3, wtBase.y - 8, 6, 8);
        
        // conical roof
        ctx.fillStyle = "#3d5743"; // oxidized metal green cap
        ctx.beginPath();
        ctx.moveTo(wtBase.x - 4.5, wtBase.y - 8);
        ctx.lineTo(wtBase.x, wtBase.y - 12);
        ctx.lineTo(wtBase.x + 4.5, wtBase.y - 8);
        ctx.closePath();
        ctx.fill();
      }

      drawRandomWindows(ctx, pLeft, pFront, pFront_t, pLeft_t, b.id, b.broken);
      drawRandomWindows(ctx, pFront, pRight, pRight_t, pFront_t, b.id + "_r", b.broken);
    }

    // Draw active construction cranes on growing or under-construction procedural buildings
    const hours = Store.s.simulatedFocusHours !== undefined ? Store.s.simulatedFocusHours : 7000;
    const hasCrane = !b.broken && (b.id.startsWith("proc_") && (Math.sin(b.cx * 1.3 + b.cy * 0.7) > 0.75) && (hours < 6500));
    if (hasCrane) {
      ctx.save();
      const roofCenter = projectExtruded(b.cx, b.cy, h);
      
      // Vertical mast of the crane (extends up from the roof)
      const craneMastH = 15 + Math.sin(b.cx) * 5;
      const craneMastTop = projectExtruded(b.cx, b.cy, h + craneMastH);
      
      ctx.strokeStyle = "#ff9e4a"; // Construction warning orange
      ctx.lineWidth = 1.0;
      
      // Draw mast (truss style)
      ctx.beginPath();
      ctx.moveTo(roofCenter.x, roofCenter.y);
      ctx.lineTo(craneMastTop.x, craneMastTop.y);
      ctx.stroke();
      
      // Draw parallel mast lines to look like metal truss structure
      const mastOffset = 1.5;
      ctx.beginPath();
      ctx.moveTo(roofCenter.x - mastOffset, roofCenter.y);
      ctx.lineTo(craneMastTop.x - mastOffset, craneMastTop.y);
      ctx.moveTo(roofCenter.x + mastOffset, roofCenter.y);
      ctx.lineTo(craneMastTop.x + mastOffset, craneMastTop.y);
      ctx.stroke();
      
      // Horizontal jib (long arm extending forward, counter-jib extending back)
      // Rotates slowly over time based on Date.now() and unique building offset
      const jibAngle = (Date.now() * 0.0004 + b.cx) % (Math.PI * 2);
      const jibLength = 14 + Math.cos(b.cy) * 4;
      const jibEndX = b.cx + Math.cos(jibAngle) * jibLength;
      const jibEndY = b.cy + Math.sin(jibAngle) * jibLength;
      const jibEnd = projectExtruded(jibEndX, jibEndY, h + craneMastH);
      
      const counterEndX = b.cx - Math.cos(jibAngle) * (jibLength * 0.4);
      const counterEndY = b.cy - Math.sin(jibAngle) * (jibLength * 0.4);
      const counterEnd = projectExtruded(counterEndX, counterEndY, h + craneMastH);
      
      ctx.beginPath();
      ctx.moveTo(counterEnd.x, counterEnd.y);
      ctx.lineTo(jibEnd.x, jibEnd.y);
      ctx.stroke();
      
      // Draw diagonal truss bracing inside the jib
      ctx.strokeStyle = "rgba(255, 158, 74, 0.5)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const jx = b.cx * (1 - t) + jibEndX * t;
        const jy = b.cy * (1 - t) + jibEndY * t;
        const jpt = projectExtruded(jx, jy, h + craneMastH);
        ctx.lineTo(jpt.x, jpt.y);
      }
      ctx.stroke();
      
      // Cable/Hook wire dropping down from the jib tip (bobs up and down)
      const hookLength = 8 + Math.sin(Date.now() * 0.001 + b.cx) * 3;
      const hookEnd = projectExtruded(jibEndX, jibEndY, h + craneMastH - hookLength);
      
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(jibEnd.x, jibEnd.y);
      ctx.lineTo(hookEnd.x, hookEnd.y);
      ctx.stroke();
      
      // Small hook weight at the end
      ctx.fillStyle = "#ff9e4a";
      ctx.fillRect(hookEnd.x - 0.8, hookEnd.y, 1.6, 1.6);
      
      // Cab on the crane
      const cabPos = projectExtruded(b.cx + Math.cos(jibAngle) * 2, b.cy + Math.sin(jibAngle) * 2, h + craneMastH - 1);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cabPos.x - 1, cabPos.y - 1, 2, 2);
      
      // Flashing warning beacon on the mast top and jib end
      const craneBlink = Math.sin(Date.now() * 0.008 + b.cx) > 0.5;
      ctx.fillStyle = craneBlink ? "#ff2200" : "rgba(0,0,0,0)";
      ctx.beginPath();
      ctx.arc(craneMastTop.x, craneMastTop.y, 1.2, 0, Math.PI * 2);
      ctx.arc(jibEnd.x, jibEnd.y, 1.0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }

  // Generate randomized natural patterns of warm golden or cool office windows with 3D recess depth casing
  // and realistic window details like curtain/blind patterns instead of uniform glowing grids
  function drawRandomWindows(ctx, botL, botR, topR, topL, seed, broken) {
    if (broken) {
      // Offline sector has only 3% chance of flashing short-circuit windows
      if (Math.random() > 0.96) {
        ctx.fillStyle = "rgba(180, 110, 80, 0.3)";
        ctx.fillRect((botL.x + topR.x) / 2 - 1, (botL.y + topR.y) / 2 - 1, 2, 2);
      }
      return;
    }

    // Deterministic random generator based on coordinates seed
    const pseudoRand = (s) => {
      let mask = 0;
      for (let i = 0; i < s.length; i++) {
        mask = (mask << 5) - mask + s.charCodeAt(i);
        mask |= 0;
      }
      const x = Math.sin(mask) * 10000;
      return x - Math.floor(x);
    };

    // Standard density of active windows for evening realistic NYC look
    const densityThreshold = 0.45; // ~55% of windows are lit up

    const rows = 9; 
    const cols = 6; 
    ctx.save();

    for (let r = 1; r < rows; r++) {
      const rRatio = r / rows;
      for (let c = 1; c < cols; c++) {
        const cRatio = c / cols;

        // Generate state
        const randVal = pseudoRand(seed + "_" + r + "_" + c);
        
        // Calculate exact point on extruded 3D plane
        const ptBottom = {
          x: botL.x * (1 - cRatio) + botR.x * cRatio,
          y: botL.y * (1 - cRatio) + botR.y * cRatio
        };
        const ptTop = {
          x: topL.x * (1 - cRatio) + topR.x * cRatio,
          y: topL.y * (1 - cRatio) + topR.y * cRatio
        };

        const winPt = {
          x: ptBottom.x * (1 - rRatio) + ptTop.x * rRatio,
          y: ptBottom.y * (1 - rRatio) + ptTop.y * rRatio
        };

        // Window casing shadow / frame
        ctx.fillStyle = "rgba(15, 12, 10, 0.75)"; // Dark frame
        ctx.fillRect(winPt.x - 1.2, winPt.y - 1.5, 2.4, 3.0);

        // Lit vs Dark window decision
        if (randVal < densityThreshold) {
          // Dark window (some natural interior reflection but mostly unlit)
          ctx.fillStyle = "rgba(28, 25, 23, 0.85)";
          ctx.fillRect(winPt.x - 0.8, winPt.y - 1.1, 1.6, 2.2);
          
          // Draw subtle reflection or curtain detail in dark window
          if (randVal < 0.2) {
            ctx.fillStyle = "rgba(248, 250, 252, 0.15)"; // faint reflection/curtain
            ctx.fillRect(winPt.x - 0.8, winPt.y - 1.1, 0.8, 2.2); // half curtain
          }
          continue;
        }

        // Active/Lit window colors (warm sunset golden, amber, warm ivory white)
        const colVal = pseudoRand(seed + "_col_" + r + "_" + c);
        const flicker = 0.85 + 0.15 * Math.sin(Date.now() * 0.001 + colVal * 100); // subtle warm lamp flicker (not crazy strobe)

        let winColor;
        if (colVal < 0.4) {
          winColor = `rgba(254, 240, 138, ${0.85 * flicker})`; // Warm bright gold
        } else if (colVal < 0.8) {
          winColor = `rgba(253, 186, 116, ${0.8 * flicker})`;  // Warm soft amber/orange
        } else {
          winColor = `rgba(255, 251, 235, ${0.9 * flicker})`;  // Clean warm ivory white
        }

        // Draw active window glass background
        ctx.fillStyle = winColor;
        ctx.fillRect(winPt.x - 0.8, winPt.y - 1.1, 1.6, 2.2);

        // Draw realistic window details — varied curtain/blind patterns inside active windows!
        const detailVal = pseudoRand(seed + "_detail_" + r + "_" + c);
        if (detailVal < 0.3) {
          // Horizontal blinds pattern (fine dark lines)
          ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(winPt.x - 0.8, winPt.y - 0.6);
          ctx.lineTo(winPt.x + 0.8, winPt.y - 0.6);
          ctx.moveTo(winPt.x - 0.8, winPt.y);
          ctx.lineTo(winPt.x + 0.8, winPt.y);
          ctx.moveTo(winPt.x - 0.8, winPt.y + 0.6);
          ctx.lineTo(winPt.x + 0.8, winPt.y + 0.6);
          ctx.stroke();
        } else if (detailVal < 0.6) {
          // Elegant left curtain (soft light grey/beige covering left part of window)
          ctx.fillStyle = "rgba(226, 221, 212, 0.9)";
          const curtainW = 0.4 + (detailVal - 0.3) * 1.5; // randomized width
          ctx.fillRect(winPt.x - 0.8, winPt.y - 1.1, curtainW, 2.2);
        } else if (detailVal < 0.85) {
          // Elegant double side curtains
          ctx.fillStyle = "rgba(226, 221, 212, 0.9)";
          ctx.fillRect(winPt.x - 0.8, winPt.y - 1.1, 0.4, 2.2);
          ctx.fillRect(winPt.x + 0.4, winPt.y - 1.1, 0.4, 2.2);
        } // 0.85+ is no curtain, pure warm glass!
      }
    }
    ctx.restore();
  }

  function bindEvents(canvas, renderCallback) {
    canvas.addEventListener("mousedown", e => {
      if (e.shiftKey || e.button === 2) {
        isRotating = true;
        dragStartX = e.clientX;
        canvas.style.cursor = "sync";
      } else {
        isDragging = true;
        dragStartX = e.clientX - panX;
        dragStartY = e.clientY - panY;
        canvas.style.cursor = "grabbing";
      }
      e.preventDefault();
    });

    window.addEventListener("mousemove", e => {
      if (isRotating) {
        const dx = e.clientX - dragStartX;
        rotationAngle += dx * 0.007; // scale rotation sensitivity
        dragStartX = e.clientX;
        renderCallback();
      } else if (isDragging) {
        panX = e.clientX - dragStartX;
        panY = e.clientY - dragStartY;
        renderCallback();
      }
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
      isRotating = false;
      canvas.style.cursor = "grab";
    });

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      scale = Math.min(3.5, Math.max(0.35, scale * (e.deltaY > 0 ? 0.92 : 1.08)));
      renderCallback();
    });

    // Prevent context menu on right click to make rotation dragging perfectly smooth
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    // Window resize handler to maintain sharp crisp pixel ratios during transitions
    window.addEventListener("resize", () => {
      if (canvas && $("#view-district")?.classList.contains("active")) {
        renderCallback();
      }
    });
  }

  function renderView() {
    const v = $("#view-district");
    if (!v) return;

    init();

    const mode = Store.s.districtViewMode || "isometric";
    const hours = Store.s.simulatedFocusHours || 0;
    const isInfinite = !!Store.s.infiniteCoinsEnabled;

    const list = getActiveBuildings();
    const blocksOccupied = list.length;
    const powerOutput = (blocksOccupied * 32.8).toFixed(1);
    const tallestHeight = list.length > 0 ? Math.max(...list.map(b => b.h)) : 0;
    const spireMeters = Math.round(tallestHeight * 2.8);

    let classification = "Rural Server Outpost";
    if (hours >= 7000) classification = "🌌 Legendary Cyberpunk Metropolis";
    else if (hours >= 5000) classification = "🏙️ High-Density Megacity Core";
    else if (hours >= 3000) classification = "🌆 Flourishing Tech Skyline";
    else if (hours >= 1000) classification = "🏢 Modern Downtown Hub";
    else if (hours >= 100) classification = "🔌 Cozy Node Substation";
    else if (hours >= 1) classification = "🏢 Active Manhattan Blueprint";

    // Toggle Zen Mode Active Class on parent container
    if (Store.s.districtZenMode) {
      v.classList.add("zen-mode-active");
    } else {
      v.classList.remove("zen-mode-active");
    }

    // Detect if we are already in fullscreen to preserve HUD button state
    const isFSActive = v.classList.contains("fullscreen-active");

    // Compute dynamic HTML for districts status board
    let districtHtml = "";
    Object.values(DISTRICT_METADATA).forEach(d => {
      const isUnlocked = hours >= d.unlockHours;
      const col = d.color;
      districtHtml += `
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.02); padding-bottom:6px; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:9px; height:9px; border-radius:50%; background:${col}; box-shadow: 0 0 6px ${col};"></div>
            <span style="font-weight:600; color:${isUnlocked ? "var(--text)" : "var(--muted)"}; font-size:0.78rem;">${d.name}</span>
          </div>
          <span style="font-size:0.72rem; font-family:var(--font-mono); font-weight:700; color:${isUnlocked ? col : "var(--muted)"};">
            ${isUnlocked ? "🔓 ACTIVE" : `🔒 ${d.unlockHours}h`}
          </span>
        </div>
      `;
    });

    // Compute dynamic HTML for landmark achievements lists
    let landmarksHtml = "";
    const unlockedLandmarks = SIM_BUILDINGS.filter(b => hours >= b.unlockHours);
    const landmarkCount = SIM_BUILDINGS.length;
    const unlockedCount = unlockedLandmarks.length;

    SIM_BUILDINGS.forEach(b => {
      const dist = DISTRICT_METADATA[b.district];
      const isUnlocked = hours >= dist.unlockHours && hours >= b.unlockHours;
      const col = dist.color;
      landmarksHtml += `
        <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.72rem; margin-bottom:5px; opacity:${isUnlocked ? 1.0 : 0.42};">
          <span style="color:${isUnlocked ? "var(--text)" : "var(--muted)"}; font-weight:${isUnlocked ? "600" : "normal"}; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 170px;">
            ${isUnlocked ? "⭐" : "🔒"} ${b.name}
          </span>
          <span style="font-family:var(--font-mono); color:${isUnlocked ? col : "var(--muted)"}; font-weight: 600;">
            ${isUnlocked ? "ACTIVE" : `${b.unlockHours}h`}
          </span>
        </div>
      `;
    });

    v.innerHTML = `
      <style>
        #view-district.zen-mode-active > .card:first-child {
          display: none !important;
        }
        #view-district.zen-mode-active .controls-column {
          display: none !important;
        }
        #view-district.zen-mode-active .canvas-card {
          grid-column: span 12 / span 12 !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        #view-district.zen-mode-active .canvas-container {
          height: 620px !important;
        }
      </style>

      <div class="card" style="margin-bottom: 20px">
        <h2>🏙️ NYC Digital Focus District</h2>
        <p class="muted">Your oblique cyberpunk sanctuary. Focus blocks build real skyscrapers, failure rusting them. Adjust simulated hours to see your skyline grow into a 7,000-hour ultra-metropolis! <strong>Drag to pan, use scroll to zoom. Drag with right-click or hold Shift to rotate!</strong></p>
      </div>

      <div class="grid-layout" style="display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start;" class="md:grid-cols-12">
        
        <!-- Left: Interactive Canvas -->
        <div class="card md:col-span-8 canvas-card" style="padding: 16px; margin: 0; display:flex; flex-direction:column; gap:12px;">
          <div class="district-header" style="display:flex; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; flex-direction:column;">
              <span class="tag" style="background:var(--glow); color:var(--accent); width:fit-content; font-size:0.65rem; font-weight:700;">LIVE SYSTEM MONITOR</span>
              <h3 style="margin: 4px 0 0 0; font-size: 1.15rem; color: var(--text);">${classification}</h3>
            </div>
            <span class="spacer"></span>
            <div class="district-controls" style="display:flex; gap:6px; align-items: center; flex-wrap: wrap;">
              <button class="btn sm ${mode === "isometric" ? "primary" : ""}" id="btn-dist-3d" title="Oblique 3D Perspective">3D Skyline</button>
              <button class="btn sm ${mode === "flat" ? "primary" : ""}" id="btn-dist-2d" title="Orthographic Flat View">2D Blueprint</button>
              
              <!-- Map Rotation Buttons -->
              <button class="btn sm" id="btn-dist-rot-left" title="Rotate Camera Left">🔄 Left</button>
              <button class="btn sm" id="btn-dist-rot-right" title="Rotate Camera Right">🔄 Right</button>
 
              <button class="btn sm ghost" id="btn-dist-reset" title="Recenter View">🎯 Recenter</button>
              <button class="btn sm ${Store.s.districtZenMode ? "primary" : ""}" id="btn-dist-zen" title="Toggle Zen View (Hides UI Panels)">👁️ Zen HUD</button>
              <button class="btn sm ${isFSActive ? "primary" : ""}" id="btn-dist-fullscreen-toggle" title="Toggle Fullscreen Immersive Mode">${isFSActive ? "❌ Exit Full Screen" : "📺 Full Screen"}</button>
            </div>
          </div>

          <div class="canvas-container" style="background:#07090e; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; position: relative; height: 500px;">
            <canvas id="district-canvas" style="cursor: grab; width: 100%; height: 100%; display: block;"></canvas>
            
            <div style="position: absolute; bottom: 12px; left: 12px; background: rgba(12,14,21,0.85); border: 1px solid var(--line); padding: 8px 12px; border-radius: var(--radius-sm); font-size:0.7rem; pointer-events:none; display:flex; flex-direction:column; gap:4px; font-family:var(--font-mono); z-index: 5;">
              <span style="color:var(--text); font-weight:600;">⌨️ Navigation:</span>
              <span class="muted">🖱️ Drag to pan camera</span>
              <span class="muted">🔄 Right-Click Drag or Shift+Drag to Rotate</span>
              <span class="muted">🎛️ Scroll wheel to zoom</span>
            </div>

            <!-- Floating Zen Overlay -->
            <div id="zen-floating-hud" style="position: absolute; bottom: 12px; right: 12px; background: rgba(10, 14, 24, 0.88); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.12); padding: 10px 16px; border-radius: 8px; display: ${Store.s.districtZenMode ? "flex" : "none"}; align-items: center; gap: 12px; z-index: 10; width: 280px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
              <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem; font-family:var(--font-mono);">
                  <span style="color:var(--text-light); font-weight:600;">FOCUS LEVEL:</span>
                  <span id="lbl-zen-hours" style="color:var(--accent); font-weight:700;">${hours.toLocaleString()} hrs</span>
                </div>
                <input type="range" id="district-hours-slider-zen" min="0" max="7000" step="10" value="${hours}" style="width:100%; accent-color: var(--accent); cursor: pointer;">
              </div>
              <button class="btn sm" id="btn-dist-zen-exit" style="padding: 4px 8px; font-size: 0.7rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);" title="Exit Zen View">Exit Zen</button>
            </div>
          </div>
        </div>

        <!-- Right: Control Tower Panel -->
        <div class="md:col-span-4 controls-column" style="display:flex; flex-direction:column; gap:20px;">
          
          <!-- Slider & Cheat Config Card -->
          <div class="card" style="padding: 18px; margin: 0;">
            <div class="zone-label" style="margin-bottom:12px;">🎛️ District Control Tower</div>
            
            <!-- Focus Hours Slider -->
            <div style="margin-bottom: 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-light);">Simulated Focus Hours</span>
                <span id="lbl-slider-hours" style="font-size:0.82rem; font-weight:700; color:var(--accent); font-family:var(--font-mono);">${hours.toLocaleString()} hrs</span>
              </div>
              <input type="range" id="district-hours-slider" min="0" max="7000" step="10" value="${hours}" style="width:100%; accent-color: var(--accent); cursor: pointer; background: var(--line); height: 6px; border-radius: 3px; outline: none; transition: background 450ms ease-in-out;">
              <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--muted); margin-top:4px; font-family:var(--font-mono);">
                <span>0h (Real)</span>
                <span>1.5k</span>
                <span>4k</span>
                <span>7k (Max Limit)</span>
              </div>
            </div>

            <!-- Divider -->
            <div style="height:1px; background:var(--line); margin:16px 0;"></div>

            <!-- Permission / Cheats Mode -->
            <div>
              <span style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--muted); font-weight:700; display:block; margin-bottom:8px;">🔓 Permissions & Hacks</span>
              <label class="field" style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; background:rgba(255,255,255,0.02); border: 1px solid var(--line); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom:0;">
                <input type="checkbox" id="chk-infinite-coins" ${isInfinite ? "checked" : ""} style="width:16px; height:16px; accent-color: var(--good); cursor:pointer;">
                <div style="display:flex; flex-direction:column; line-height:1.2;">
                  <span style="font-size:0.82rem; font-weight:600; color:var(--text);">Perm: Infinite Coins</span>
                  <span style="font-size:0.68rem; color:var(--muted);">Buy everything instantly in shop</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Manhattan District Status Board -->
          <div class="card" style="padding: 18px; margin: 0; background: rgba(255,255,255,0.01);">
            <div class="zone-label" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
              <span>🗺️ Manhattan District Status</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${districtHtml}
            </div>
          </div>

          <!-- Iconic NYC Landmarks Achievement Board -->
          <div class="card" style="padding: 18px; margin: 0; background: rgba(255,255,255,0.01);">
            <div class="zone-label" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
              <span>🏆 NYC Landmark Achievements</span>
              <span style="font-size:0.7rem; font-family:var(--font-mono); font-weight:700; color:var(--accent); background:rgba(168,85,247,0.1); padding:2px 6px; border-radius:10px;">${unlockedCount}/${landmarkCount}</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:2px; max-height:160px; overflow-y:auto; padding-right:4px;">
              ${landmarksHtml}
            </div>
          </div>

          <!-- Live City Stats Card -->
          <div class="card" style="padding: 18px; margin: 0; background: rgba(255,255,255,0.01);">
            <div class="zone-label" style="margin-bottom:12px;">📊 Skyline Telemetry</div>
            
            <div style="display:flex; flex-direction:column; gap:10px; font-size:0.8rem;">
              <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.02); padding-bottom:6px;">
                <span class="muted">Active Skylines:</span>
                <span style="font-weight:600; color:var(--text);">${blocksOccupied} structures</span>
              </div>
              <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.02); padding-bottom:6px;">
                <span class="muted">Neon Grid Power:</span>
                <span style="font-weight:600; color:var(--good); font-family:var(--font-mono);">${powerOutput} GW</span>
              </div>
              <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.02); padding-bottom:6px;">
                <span class="muted">Tallest Apex Peak:</span>
                <span style="font-weight:600; color:var(--accent); font-family:var(--font-mono);">${spireMeters} Meters (${spireMeters > 0 ? "Beacon Active" : "No Spire"})</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span class="muted">Grid Health:</span>
                <span style="font-weight:700; color:#4aa8ff;">100% ONLINE</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    // Now bind all UI handlers
    const canvas = v.querySelector("#district-canvas");
    if (canvas) {
      bindEvents(canvas, () => {
        render(canvas);
      });
      setTimeout(() => render(canvas), 60);
    }

    // Toggle 3D / 2D
    const btn3d = v.querySelector("#btn-dist-3d");
    const btn2d = v.querySelector("#btn-dist-2d");
    const btnReset = v.querySelector("#btn-dist-reset");
    const btnRotLeft = v.querySelector("#btn-dist-rot-left");
    const btnRotRight = v.querySelector("#btn-dist-rot-right");
    const btnFullscreen = v.querySelector("#btn-dist-fullscreen-toggle");

    if (btn3d) btn3d.onclick = () => {
      Store.s.districtViewMode = "isometric";
      Store.save();
      renderView();
    };

    if (btn2d) btn2d.onclick = () => {
      Store.s.districtViewMode = "flat";
      Store.save();
      renderView();
    };

    if (btnReset) btnReset.onclick = () => {
      panX = 0;
      panY = 75;
      scale = 1.1;
      rotationAngle = -0.45;
      render(canvas);
    };

    if (btnRotLeft) btnRotLeft.onclick = () => {
      rotationAngle -= Math.PI / 12;
      render(canvas);
    };

    if (btnRotRight) btnRotRight.onclick = () => {
      rotationAngle += Math.PI / 12;
      render(canvas);
    };

    if (btnFullscreen) {
      btnFullscreen.onclick = () => {
        const isFS = v.classList.toggle("fullscreen-active");
        btnFullscreen.innerHTML = isFS ? "❌ Close Screen" : "📺 Full Screen";
        btnFullscreen.className = isFS ? "btn sm primary" : "btn sm";
        
        if (isFS) {
          panX = 0;
          panY = 100;
          scale = 1.3;
          document.getElementById("sidebar")?.classList.add("hidden-temp-fs");
          document.getElementById("topbar")?.classList.add("hidden-temp-fs");
          document.getElementById("main-wrap")?.classList.add("no-margin-fs");
          toast("📺 IMMERSIVE FULL-SCREEN METROPOLIS: Click & Drag to pan, scroll to zoom. Shift+Drag or Right-click to rotate the entire skyline!", "gold", 4500);
        } else {
          document.getElementById("sidebar")?.classList.remove("hidden-temp-fs");
          document.getElementById("topbar")?.classList.remove("hidden-temp-fs");
          document.getElementById("main-wrap")?.classList.remove("no-margin-fs");
        }
        render(canvas);
      };
    }

    // Escape key to exit fullscreen gracefully
    const escExitHandler = (e) => {
      if (e.key === "Escape" && v.classList.contains("fullscreen-active")) {
        v.classList.remove("fullscreen-active");
        if (btnFullscreen) {
          btnFullscreen.innerHTML = "📺 Full Screen";
          btnFullscreen.className = "btn sm";
        }
        document.getElementById("sidebar")?.classList.remove("hidden-temp-fs");
        document.getElementById("topbar")?.classList.remove("hidden-temp-fs");
        document.getElementById("main-wrap")?.classList.remove("no-margin-fs");
        render(canvas);
      }
    };
    window.removeEventListener("keydown", escExitHandler);
    window.addEventListener("keydown", escExitHandler);

    // Zen Mode Buttons
    const btnZen = v.querySelector("#btn-dist-zen");
    const btnZenExit = v.querySelector("#btn-dist-zen-exit");
    
    if (btnZen) {
      btnZen.onclick = () => {
        Store.s.districtZenMode = !Store.s.districtZenMode;
        Store.save();
        renderView();
      };
    }
    if (btnZenExit) {
      btnZenExit.onclick = () => {
        Store.s.districtZenMode = false;
        Store.save();
        renderView();
      };
    }

    // Dual-sync Hours Sliders (Main & Zen HUD)
    const slider = v.querySelector("#district-hours-slider");
    const sliderZen = v.querySelector("#district-hours-slider-zen");
    const lblSliderHours = v.querySelector("#lbl-slider-hours");
    const lblZenHours = v.querySelector("#lbl-zen-hours");

    function updateSimulationHours(val) {
      Store.s.simulatedFocusHours = val;
      Store.save();
      
      const hoursText = val === 0 ? "0 hrs (Real Session Data)" : `${val.toLocaleString()} hrs`;
      if (lblSliderHours) lblSliderHours.textContent = hoursText;
      if (lblZenHours) lblZenHours.textContent = hoursText;
      if (slider) slider.value = val;
      if (sliderZen) sliderZen.value = val;
      
      const list = getActiveBuildings();
      const blocksCount = list.length;
      let clsName = "Rural Server Outpost";
      if (val >= 7000) clsName = "🌌 Legendary Cyberpunk Metropolis";
      else if (val >= 5000) clsName = "🏙️ High-Density Megacity Core";
      else if (val >= 3000) clsName = "🌆 Flourishing Tech Skyline";
      else if (val >= 1000) clsName = "🏢 Modern Downtown Hub";
      else if (val >= 100) clsName = "🔌 Cozy Node Substation";
      else if (val >= 1) clsName = "🏢 Active Manhattan Blueprint";

      const titleHeader = v.querySelector("h3");
      if (titleHeader) titleHeader.textContent = clsName;

      render(canvas);
    }

    if (slider) {
      slider.oninput = () => {
        updateSimulationHours(parseInt(slider.value));
      };
      slider.onchange = () => {
        renderView();
      };
    }

    if (sliderZen) {
      sliderZen.oninput = () => {
        updateSimulationHours(parseInt(sliderZen.value));
      };
      sliderZen.onchange = () => {
        renderView();
      };
    }

    // Infinite coins check
    const chkCoins = v.querySelector("#chk-infinite-coins");
    if (chkCoins) {
      chkCoins.onchange = () => {
        const checked = chkCoins.checked;
        Store.s.infiniteCoinsEnabled = checked;
        if (checked) {
          if (Store.s.coins !== 999999) {
            Store.s.preCheatCoins = Store.s.coins;
          }
          Store.s.coins = 999999;
          AudioFX.play("levelup");
          toast("💰 UNLIMITED BUDGET ENGAGED: Infinite coins assigned! Go clean out the shop, Aarush!", "gold", 5000);
        } else {
          Store.s.coins = Store.s.preCheatCoins !== undefined ? Store.s.preCheatCoins : 120;
          AudioFX.play("fail");
          toast("🔒 Infinite coins disabled. Returning to legal focus-min economy.", "bad", 4000);
        }
        Store.save();
        UI.refreshChips();
      };
    }

    // Custom Focus Node Builder
    const btnAddCustom = v.querySelector("#btn-add-custom-node");
    if (btnAddCustom) {
      btnAddCustom.onclick = () => {
        Store.s.simulatedFocusHours = 0;
        Store.save();
        addFocusBuilding(120, "Empire State Replica");
        renderView();
      };
    }

    // Rust Strike Trigger
    const btnRust = v.querySelector("#btn-rust-node");
    if (btnRust) {
      btnRust.onclick = () => {
        Store.s.simulatedFocusHours = 0;
        Store.save();
        markSectorOffline();
        renderView();
      };
    }
  }

  return {
    init,
    addFocusBuilding,
    markSectorOffline,
    render,
    getActiveBuildings,
    renderView
  };
})();

