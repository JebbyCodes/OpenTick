// Loads the app's scripts into an isolated VM context with a fake DOM, so several "devices" can run side by side.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code = ['core', 'md', 'views', 'sync', 'og', 'gantt', 'ui', 'main'].map(n => readFileSync(new URL(`../src/js/${n}.js`, import.meta.url), 'utf8')).join('\n');

export const clock = { t: Date.UTC(2026, 9, 8, 10, 0, 0) };
class FDate extends Date { static now() { return clock.t; } constructor(...a) { if (a.length) super(...a); else super(clock.t); } }

export function makeApp({ fetch = globalThis.fetch, store = {} } = {}) {
  const els = {};
  const el = () => ({ innerHTML: '', value: '', dataset: {}, style: {}, textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, focus() {}, select() {}, setAttribute() {}, click() {} });
  const ctx = vm.createContext({
    console, setTimeout: (f, ms) => { const t = setTimeout(f, ms); t.unref && t.unref(); return t; }, clearTimeout, setInterval: () => 0, URL, Date: FDate, Math, JSON, Intl, Promise, fetch, btoa, TextEncoder, Map, Set,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { language: 'en-GB', onLine: true }, location: { protocol: 'file:' },
    window: { addEventListener() {}, innerWidth: 1800 },
    document: { querySelector: s => (els[s] ??= el()), querySelectorAll: () => [], addEventListener() {}, activeElement: null, hidden: false, title: '', documentElement: { dataset: {} }, body: { classList: { toggle() {}, add() {}, remove() {} } }, createElement: el },
  });
  const api = vm.runInContext(code + `\n;({ md, mdInline, mdToggleLine, mdStats, parseQuick, quickAdd, toggleDone, newTask, render, renderMain, renderDetail, renderSide, U, P, get S() { return S; },
    stamp, flush, save, snapshot, fingerprint, mergeData, applyMerged, replaceAll, initSeen, getT, Sync, syncNow, syncBadge, syncStatusText, buildPayload, parsePayload, PROVIDERS, dav, hooks, undoMerge: undoMerge,
    nextDue, pSet, pToggle, checkReminders, reorder, sortTasks, scopeTasks, repeatKey, repeatLabel, noteBadge, titleHtml, notesHtml, ACT, mdEnter, mdFormat,
    tagChip, tagColor, setTagColor, renameTag, ttDays, ttItems, ttLayout, renderTimetable, ttDrop, toMin, fromMin, slotById, nextSlotDate, fmtDur, metaX, THEMES, applyTheme, migrate, ttRange, slotClashes, toggleDone, ACT,
    ogYamlParse, ogMergeYaml, ogEmitRows, ogExtract, ogCompose, ogRowOfTask, ogFields, ogHash, ogImportText, ogSync, OG, OGIO, ogMerge, ogBuild, ogExportable, ganttRows, renderGantt, ogStr, ogTaskHash, ogFmtOf, ogDated, ganttDates, gtApply, gtStatus, gtPct, GT_COLS, gtCols, gtSetCols, gtDrop, uiToggle, uiFocus, uiNavDrop, pagesShown, uiMovePage, UIC, uiSetWidth, listOf })`, ctx);
  api.store = store; api.els = els;
  return api;
}
