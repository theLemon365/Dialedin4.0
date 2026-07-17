/* ==========================================================
   undo.js — global undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Y)
   Captures tasks, notes, canvases, timebox, journal, brain dump, scratchpad.
   In text fields, native browser undo is tried first.
   ========================================================== */
"use strict";

const Undo = (() => {
  const MAX = 80;
  let stack = [];
  let idx = -1;
  let applying = false;
  const debouncers = new Map();

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function snapshot() {
    const s = Store.s;
    return {
      tasks: clone(s.tasks),
      taskSeq: s.taskSeq,
      notes: clone(s.notes),
      noteSeq: s.noteSeq,
      canvases: clone(s.canvases),
      canvasSeq: s.canvasSeq,
      timebox: clone(s.timebox),
      braindump: s.braindump,
      scratchpad: s.scratchpad,
      journal: clone(s.journal),
    };
  }

  function applySnap(snap) {
    applying = true;
    const s = Store.s;
    s.tasks = snap.tasks;
    s.taskSeq = snap.taskSeq;
    s.notes = snap.notes;
    s.noteSeq = snap.noteSeq;
    s.canvases = snap.canvases;
    s.canvasSeq = snap.canvasSeq;
    s.timebox = snap.timebox;
    s.braindump = snap.braindump;
    s.scratchpad = snap.scratchpad;
    s.journal = snap.journal;
    Store.save();
    applying = false;
    refreshUI();
  }

  function refreshUI() {
    const scratch = document.getElementById("scratch-text");
    if (scratch) scratch.value = Store.s.scratchpad || "";
    const bd = document.getElementById("bd-text");
    if (bd) bd.value = Store.s.braindump || "";

    const openNoteId = typeof Notes !== "undefined" && Notes.getOpenNoteId ? Notes.getOpenNoteId() : null;

    if (typeof UI !== "undefined") {
      UI.refreshChips?.();
      if (UI.refreshAll) UI.refreshAll();
      else if (UI.currentView && UI.showView) UI.showView(UI.currentView);
    }

    if (openNoteId) {
      if (Store.s.notes.some(n => n.id === openNoteId)) {
        if (typeof Notes !== "undefined" && Notes.openNoteModal) Notes.openNoteModal(openNoteId);
      } else if (typeof Notes !== "undefined" && Notes.closeNoteModal) Notes.closeNoteModal();
    }
  }

  function isTextTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      return ["text", "search", "email", "url", "tel", "password", "number"].includes(t) || !el.type;
    }
    return false;
  }

  function syncActiveEditor() {
    const ae = document.activeElement;
    if (!ae) return;
    if (ae.id === "scratch-text") { Store.s.scratchpad = ae.value; Store.save(); return; }
    if (ae.id === "bd-text") { Store.s.braindump = ae.value; Store.save(); return; }
    if (typeof Notes !== "undefined" && Notes.syncOpenNote) Notes.syncOpenNote(ae);
  }

  function tryNativeUndo() {
    const ae = document.activeElement;
    if (!isTextTarget(ae)) return false;
    try {
      if (document.queryCommandEnabled("undo")) {
        document.execCommand("undo");
        syncActiveEditor();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function tryNativeRedo() {
    const ae = document.activeElement;
    if (!isTextTarget(ae)) return false;
    try {
      if (document.queryCommandEnabled("redo")) {
        document.execCommand("redo");
        syncActiveEditor();
        return true;
      }
    } catch (e) {}
    return false;
  }

  function record() {
    if (applying) return;
    const snap = snapshot();
    const top = stack[idx];
    if (top && JSON.stringify(top) === JSON.stringify(snap)) return;

    if (idx < stack.length - 1) stack = stack.slice(0, idx + 1);
    stack.push(snap);
    if (stack.length > MAX) { stack.shift(); idx = stack.length - 1; }
    else idx = stack.length - 1;
  }

  function recordDebounced(key = "default", ms = 700) {
    clearTimeout(debouncers.get(key));
    debouncers.set(key, setTimeout(() => record(), ms));
  }

  function init() {
    stack = [snapshot()];
    idx = 0;
  }

  function undo() {
    if (tryNativeUndo()) return true;
    if (idx <= 0) return false;
    idx--;
    applySnap(stack[idx]);
    return true;
  }

  function redo() {
    if (tryNativeRedo()) return true;
    if (idx >= stack.length - 1) return false;
    idx++;
    applySnap(stack[idx]);
    return true;
  }

  function canUndo() { return idx > 0; }
  function canRedo() { return idx < stack.length - 1; }

  return { init, record, recordDebounced, undo, redo, canUndo, canRedo };
})();
