/* ==========================================================
   audio.js — SFX packs (8-bit / sci-fi / anime) + ambient mixer
   All sound is synthesized with Web Audio; no files needed.
   ========================================================== */
"use strict";

const AudioFX = (() => {
  let ctx = null;
  const ensureCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    const c = ensureCtx();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + when + dur);
    g.gain.setValueAtTime(vol, c.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + when); o.stop(c.currentTime + when + dur + 0.05);
  }

  const packs = {
    "minimal": {
      /* Clean, quiet UI clicks — a checkbox tick, not a video-game jingle */
      complete: () => { tone(1500, .045, "sine", .07); tone(1900, .05, "sine", .06, .06); },
      levelup:  () => { [880, 1175, 1568].forEach((f, i) => tone(f, .06, "sine", .08, i * .06)); },
      coin:     () => tone(1400, .04, "sine", .06),
      start:    () => tone(700, .045, "sine", .05),
      fail:     () => tone(220, .1, "sine", .06),
      tick:     () => tone(1000, .018, "sine", .03),
      badge:    () => { tone(1500, .045, "sine", .08); tone(1900, .05, "sine", .08, .06); tone(2300, .07, "sine", .06, .12); },
    },
    "8bit": {
      complete: () => { tone(523, .09, "square", .12); tone(659, .09, "square", .12, .09); tone(784, .18, "square", .12, .18); },
      levelup:  () => { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, .1, "square", .11, i * .08)); },
      coin:     () => { tone(988, .06, "square", .1); tone(1319, .16, "square", .1, .06); },
      start:    () => { tone(440, .08, "square", .09); tone(554, .12, "square", .09, .08); },
      fail:     () => { tone(300, .16, "square", .12, 0, 150); tone(200, .3, "square", .12, .15, 90); },
      tick:     () => tone(880, .03, "square", .04),
      badge:    () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .09, "square", .1, i * .07)); },
    },
    "scifi": {
      complete: () => { tone(600, .25, "sine", .12, 0, 1400); },
      levelup:  () => { tone(300, .5, "sawtooth", .07, 0, 1200); tone(600, .4, "sine", .1, .1, 1800); },
      coin:     () => tone(1500, .12, "sine", .1, 0, 2200),
      start:    () => tone(200, .3, "sawtooth", .07, 0, 500),
      fail:     () => tone(500, .5, "sawtooth", .1, 0, 80),
      tick:     () => tone(1200, .02, "sine", .04),
      badge:    () => { tone(400, .4, "sine", .1, 0, 1600); tone(800, .4, "sine", .08, .2, 2400); },
    },
    "anime": {
      complete: () => { [784, 988, 1175].forEach((f, i) => tone(f, .14, "triangle", .13, i * .05)); },
      levelup:  () => { [523, 587, 659, 784, 880, 1047, 1319].forEach((f, i) => tone(f, .12, "triangle", .11, i * .06)); },
      coin:     () => { tone(1319, .1, "triangle", .12); tone(1760, .14, "triangle", .1, .07); },
      start:    () => { tone(659, .1, "triangle", .1); tone(880, .15, "triangle", .1, .08); },
      fail:     () => { tone(440, .2, "triangle", .12); tone(349, .3, "triangle", .12, .18); },
      tick:     () => tone(1047, .03, "triangle", .04),
      badge:    () => { [659, 784, 880, 1047, 1319, 1568].forEach((f, i) => tone(f, .11, "triangle", .1, i * .06)); },
    },
  };

  function play(name) {
    if (!Store.s.settings.sound) return;
    const pack = packs[Store.s.settings.sfxPack] || packs["minimal"];
    try { (pack[name] || pack.complete)(); } catch (e) {}
  }

  /* ---------- Ambient mixer ---------- */
  const ambient = { nodes: {}, gains: {}, master: null };

  function makeNoiseBuffer(c, type) {
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (type === "brown") { lastOut = (lastOut + 0.02 * white) / 1.02; d[i] = lastOut * 3.5; }
      else d[i] = white;
    }
    return buf;
  }

  function startChannel(id) {
    const c = ensureCtx();
    if (!ambient.master) { ambient.master = c.createGain(); ambient.master.gain.value = 1; ambient.master.connect(c.destination); }
    if (ambient.nodes[id]) return;
    const g = c.createGain(); g.gain.value = 0; g.connect(ambient.master);
    ambient.gains[id] = g;
    const nodes = [];

    if (id === "white") {
      const src = c.createBufferSource(); src.buffer = makeNoiseBuffer(c, "white"); src.loop = true;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 6000;
      src.connect(f).connect(g); src.start(); nodes.push(src);
    }
    if (id === "rain") {
      const src = c.createBufferSource(); src.buffer = makeNoiseBuffer(c, "white"); src.loop = true;
      const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.6;
      const lfo = c.createOscillator(), lfoG = c.createGain();
      lfo.frequency.value = 0.3; lfoG.gain.value = 400;
      lfo.connect(lfoG).connect(f.frequency); lfo.start();
      src.connect(f).connect(g); src.start(); nodes.push(src, lfo);
    }
    if (id === "cafe") {
      const src = c.createBufferSource(); src.buffer = makeNoiseBuffer(c, "brown"); src.loop = true;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
      const lfo = c.createOscillator(), lfoG = c.createGain();
      lfo.frequency.value = 0.13; lfoG.gain.value = 250;
      lfo.connect(lfoG).connect(f.frequency); lfo.start();
      src.connect(f).connect(g); src.start(); nodes.push(src, lfo);
    }
    if (id === "lofi") {
      // gentle chord pad cycling — a minimal lo-fi vibe
      const chords = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 233.1, 311.1]];
      let ci = 0;
      const oscs = chords[0].map(fr => {
        const o = c.createOscillator(), og = c.createGain();
        o.type = "triangle"; o.frequency.value = fr; og.gain.value = 0.25;
        o.connect(og).connect(g); o.start(); return o;
      });
      const iv = setInterval(() => {
        ci = (ci + 1) % chords.length;
        oscs.forEach((o, i) => o.frequency.linearRampToValueAtTime(chords[ci][i], c.currentTime + 1.5));
      }, 4000);
      nodes.push(...oscs, { stop: () => clearInterval(iv) });
    }
    ambient.nodes[id] = nodes;
  }

  function setChannel(id, vol01) {
    if (vol01 > 0) startChannel(id);
    if (ambient.gains[id]) {
      const base = { white: .12, rain: .25, cafe: .3, lofi: .16 }[id] || .2;
      ambient.gains[id].gain.linearRampToValueAtTime(vol01 * base, ensureCtx().currentTime + 0.3);
    }
  }

  function stopAll() {
    Object.keys(ambient.gains).forEach(id => setChannel(id, 0));
  }

  return { play, setChannel, stopAll };
})();
