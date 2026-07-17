/* ==========================================================
   categorize.js — multilingual keyword inference for skills,
   tags, and procrastination reasons (no external API needed)
   ========================================================== */
"use strict";

const Categorize = (() => {
  const norm = s => String(s ?? "").toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s#@/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const hasAny = (text, words) => words.some(w => {
    const wn = norm(w);
    if (!wn) return false;
    if (wn.length > 2) return text.includes(wn);
    try { return new RegExp("\\b" + escRe(wn) + "\\b").test(text); }
    catch (e) { return text.includes(wn); }
  });

  const SKILL_RULES = [
    { skill: "fitness", words: ["gym", "workout", "run", "running", "exercise", "lift", "weights", "cardio", "yoga", "stretch", "walk", "steps", "sport", "training", "ejercicio", "correr", "gimnasio"] },
    { skill: "coding", words: ["code", "coding", "program", "programming", "debug", "deploy", "git", "api", "software", "developer", "javascript", "python", "excel", "spreadsheet", "programar", "codigo"] },
    { skill: "reading", words: ["read", "reading", "book", "chapter", "article", "paper", "leer", "libro", "lectura"] },
    { skill: "school", words: ["school", "homework", "study", "exam", "test", "quiz", "class", "lecture", "essay", "assignment", "university", "college", "tarea", "estudiar", "examen", "escuela", "clase"] },
    { skill: "creative", words: ["draw", "paint", "design", "write", "music", "video", "edit", "art", "creative", "sketch", "diseno", "dibujar", "escribir", "musica"] },
    { skill: "life", words: ["clean", "laundry", "dishes", "email", "admin", "errand", "chore", "organize", "budget", "bank", "tax", "appointment", "limpiar", "compras", "casa"] },
  ];

  const TAG_RULES = [
    { tag: "#food", words: ["food", "comida", "eat", "eating", "comer", "meal", "lunch", "dinner", "breakfast", "snack", "groceries", "grocery", "cook", "cooking", "restaurant", "cocinar", "almuerzo", "cena", "desayuno", "merienda", "hambre", "hungry"] },
    { tag: "#health", words: ["sick", "ill", "illness", "doctor", "medicine", "medication", "hospital", "pain", "ache", "fever", "cold", "flu", "therapy", "dentist", "enfermo", "enferma", "enfermedad", "medico", "dolor", "salud", "health"] },
    { tag: "#sleep", words: ["sleep", "nap", "bed", "tired", "insomnia", "dormir", "sueno", "cansado", "cansada"] },
    { tag: "#social", words: ["friend", "family", "party", "call", "text", "meet", "hangout", "amigo", "familia", "reunion"] },
    { tag: "#money", words: ["pay", "bill", "invoice", "money", "budget", "bank", "rent", "dinero", "pagar", "factura"] },
  ];

  const AVOIDANCE_RULES = [
    { reason: "😴 Tired", words: ["tired", "exhausted", "sleepy", "fatigue", "burned out", "cansado", "cansada", "agotado", "sueno", "sleep", "dormir"] },
    { reason: "😵 Confused / don't know how to start", words: ["confused", "confusing", "don't know", "dont know", "unclear", "lost", "confundido", "no se", "how do i", "como empiezo"] },
    { reason: "😰 Overwhelmed — too big", words: ["overwhelmed", "too big", "too much", "massive", "huge", "abrumado", "demasiado", "mucho"] },
    { reason: "🥱 Boring", words: ["boring", "bored", "dull", "tedious", "aburrido", "aburrida", "monotonous"] },
    { reason: "😨 Afraid to fail", words: ["afraid", "scared", "fear", "fail", "failure", "anxious", "anxiety", "miedo", "temor", "fracaso", "nervioso"] },
    { reason: "📱 Distracted by something fun", words: ["distracted", "distraction", "phone", "social media", "youtube", "game", "gaming", "tiktok", "instagram", "netflix", "distraido", "juego", "telefono"] },
    { reason: "🤷 No clear next step", words: ["no clear", "next step", "stuck", "blocked", "where to start", "sin claridad", "paso siguiente", "atascado"] },
    { reason: "⏰ 'No time' (allegedly)", words: ["no time", "not enough time", "too busy", "busy", "schedule", "no tengo tiempo", "ocupado", "ocupada"] },
  ];

  function inferFromText(raw) {
    const text = norm(raw);
    let skill = null;
    const tags = [];
    for (const rule of SKILL_RULES) {
      if (hasAny(text, rule.words)) { skill = rule.skill; break; }
    }
    for (const rule of TAG_RULES) {
      if (hasAny(text, rule.words) && !tags.includes(rule.tag)) tags.push(rule.tag);
    }
    return { skill, tags };
  }

  function applyToQuickAddProps(props, rawText) {
    try {
      const inferred = inferFromText(rawText);
      if (!props.skill && inferred.skill) props.skill = inferred.skill;
      inferred.tags.forEach(t => { if (!props.tags.includes(t)) props.tags.push(t); });
    } catch (e) { /* never block task creation */ }
    return props;
  }

  function categorizeAvoidance(raw) {
    const text = norm(raw);
    if (!text.trim()) return "🤷 Other";
    let best = null, bestScore = 0;
    for (const rule of AVOIDANCE_RULES) {
      let score = 0;
      for (const w of rule.words) {
        const wn = norm(w);
        if (!wn) continue;
        if (wn.length > 3 && text.includes(wn)) score += wn.length;
        else {
          try { if (new RegExp("\\b" + escRe(wn) + "\\b").test(text)) score += 4; }
          catch (e) { if (text.includes(wn)) score += 4; }
        }
      }
      if (score > bestScore) { bestScore = score; best = rule.reason; }
    }
    return bestScore > 0 ? best : `🤷 ${String(raw).trim().slice(0, 48)}`;
  }

  return { inferFromText, applyToQuickAddProps, categorizeAvoidance };
})();
