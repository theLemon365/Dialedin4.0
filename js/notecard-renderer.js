/* ==========================================================
   notecard-renderer.js — parse formatting tokens into styled DOM
   (never show raw yellow: / bold: — render CSS styles instead)
   ========================================================== */
"use strict";

const NotecardRenderer = (() => {
  const COLORS = {
    gray: "#8a8f98", red: "#e5484d", orange: "#f5a524", yellow: "#e8c547",
    green: "#46a758", blue: "#5e6ad2", purple: "#8e6ff0",
  };
  const COLOR_IDS = Object.keys(COLORS);
  const STYLE_IDS = ["bold", "italic", "underline"];

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Token normalization (yellow:word → {{yellow:word}}) ---------- */
  function normalizeSource(src) {
    if (!src) return "";
    let s = src;
    [...STYLE_IDS, ...COLOR_IDS].forEach(id => {
      const re = new RegExp(`(^|[\\s(,\\[])((${id}):([^\\s\\{\\}\\n|,;]+))`, "gi");
      s = s.replace(re, (m, pre, _full, tokenId, text) => `${pre}{{${tokenId.toLowerCase()}:${text.trim()}}}`);
    });
    s = s.replace(/(?:^|[\s(,[])(font:([^|\n]+)\|([^\n]+))/gi, (m, pre, font, text) => {
      const trimmed = text.trim();
      if (trimmed.startsWith("{{")) return m;
      return `${pre}{{font:${font.trim()}|${trimmed}}}`;
    });
    return s.trim();
  }

  function mergeText(nodes) {
    const out = [];
    for (const n of nodes) {
      if (n.type === "text" && !n.value) continue;
      const prev = out[out.length - 1];
      if (n.type === "text" && prev?.type === "text") prev.value += n.value;
      else out.push(n);
    }
    return out;
  }

  function parseMarkdownInline(text) {
    if (!text) return [];
    const nodes = [];
    let i = 0;
    while (i < text.length) {
      if (text.startsWith("**", i)) {
        const end = text.indexOf("**", i + 2);
        if (end !== -1) {
          nodes.push({ type: "bold", children: parseMarkdownInline(text.slice(i + 2, end)) });
          i = end + 2;
          continue;
        }
      }
      if (text.startsWith("__", i)) {
        const end = text.indexOf("__", i + 2);
        if (end !== -1) {
          nodes.push({ type: "underline", children: parseMarkdownInline(text.slice(i + 2, end)) });
          i = end + 2;
          continue;
        }
      }
      if (text[i] === "*" && text[i + 1] !== "*") {
        const end = text.indexOf("*", i + 1);
        if (end !== -1 && text[end + 1] !== "*") {
          nodes.push({ type: "italic", children: parseMarkdownInline(text.slice(i + 1, end)) });
          i = end + 1;
          continue;
        }
      }
      const nextSpecial = (() => {
        const marks = ["**", "__", "*", "{{"];
        let pos = -1;
        for (const m of marks) {
          const p = text.indexOf(m, i);
          if (p !== -1 && (pos === -1 || p < pos)) pos = p;
        }
        return pos === -1 ? text.length : pos;
      })();
      if (nextSpecial > i) {
        nodes.push({ type: "text", value: text.slice(i, nextSpecial) });
        i = nextSpecial;
      } else {
        nodes.push({ type: "text", value: text[i] });
        i += 1;
      }
    }
    return mergeText(nodes);
  }

  function parseTokens(src) {
    if (!src) return [];
    src = normalizeSource(src);
    const nodes = [];
    let i = 0;
    while (i < src.length) {
      if (src.startsWith("{{", i)) {
        const close = src.indexOf("}}", i + 2);
        if (close !== -1) {
          const inner = src.slice(i + 2, close);
          const pipe = inner.indexOf("|");
          if (inner.startsWith("font:") && pipe !== -1) {
            nodes.push({
              type: "font",
              font: inner.slice(5, pipe).trim(),
              children: parseTokens(inner.slice(pipe + 1)),
            });
          } else {
            const colon = inner.indexOf(":");
            if (colon !== -1) {
              const kind = inner.slice(0, colon).toLowerCase();
              const content = inner.slice(colon + 1);
              if (COLOR_IDS.includes(kind)) {
                nodes.push({ type: "color", color: kind, children: parseTokens(content) });
              } else if (STYLE_IDS.includes(kind)) {
                nodes.push({ type: kind, children: parseTokens(content) });
              } else {
                nodes.push({ type: "text", value: src.slice(i, close + 2) });
              }
            } else {
              nodes.push({ type: "text", value: src.slice(i, close + 2) });
            }
          }
          i = close + 2;
          continue;
        }
      }
      const next = src.indexOf("{{", i);
      const chunk = next === -1 ? src.slice(i) : src.slice(i, next);
      nodes.push(...parseMarkdownInline(chunk));
      i = next === -1 ? src.length : next;
    }
    return mergeText(nodes);
  }

  function parse(src, opts = {}) {
    let text = normalizeSource(src || "");
    if (opts.font && text && !text.includes("{{font:")) {
      text = `{{font:${opts.font}|${text}}}`;
    }
    return parseTokens(text);
  }

  /* ---------- Styled DOM components (vanilla — no React/CDN needed) ---------- */
  function astToHtml(nodes) {
    return (nodes || []).map(n => {
      switch (n.type) {
        case "text": return esc(n.value);
        case "color":
          return `<span class="nc-color" style="color:${COLORS[n.color] || n.color} !important">${astToHtml(n.children)}</span>`;
        case "font":
          return `<span class="nc-font" style="font-family:${esc(n.font)} !important">${astToHtml(n.children)}</span>`;
        case "bold":
          return `<strong class="nc-bold">${astToHtml(n.children)}</strong>`;
        case "italic":
          return `<em class="nc-italic">${astToHtml(n.children)}</em>`;
        case "underline":
          return `<u class="nc-underline">${astToHtml(n.children)}</u>`;
        default: return esc(n.value || "");
      }
    }).join("");
  }

  function toHtml(src, opts = {}) {
    return astToHtml(parse(src, opts));
  }

  function mount(el, src, opts = {}) {
    if (!el) return;
    const html = toHtml(src, opts);
    el.innerHTML = html || "";
  }

  function unmount(el) {
    if (el) el.innerHTML = "";
  }

  function update(el, src, opts = {}) {
    mount(el, src, opts);
  }

  return {
    COLORS, COLOR_IDS, STYLE_IDS,
    normalizeSource, parse, toHtml, astToHtml,
    mount, unmount, update,
  };
})();
