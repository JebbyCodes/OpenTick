// Loads the app's scripts into an isolated VM context with a fake DOM, so several "devices" can run side by side.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { JS_ORDER } from '../build-app.mjs';
const code = JS_ORDER.map(n => readFileSync(new URL(`../src/js/${n}.js`, import.meta.url), 'utf8')).join('\n');

export const clock = { t: Date.UTC(2026, 9, 8, 10, 0, 0) };
class FDate extends Date { static now() { return clock.t; } constructor(...a) { if (a.length) super(...a); else super(clock.t); } }

// a small in-memory IndexedDB (just the get / put / delete / getAllKeys the app uses), so attachments can be tested without a browser
export function fakeIndexedDB() {
  const kv = new Map(), store = { put: (v, k) => { kv.set(k, v); return { result: k }; }, get: k => ({ result: kv.get(k) }), delete: k => { kv.delete(k); return { result: undefined }; }, getAllKeys: () => ({ result: [...kv.keys()] }) };
  return { kv, open() { const o = {}; setTimeout(() => { o.result = { createObjectStore() {}, transaction() { const tx = { objectStore: () => store }; setTimeout(() => tx.oncomplete && tx.oncomplete(), 0); return tx; } }; o.onsuccess && o.onsuccess(); }, 0); return o; } };
}
export function makeApp({ fetch = globalThis.fetch, store = {}, indexedDB } = {}) {
  const els = {}, LST = {}, win = { addEventListener() {}, innerWidth: 1800 };
  const el = () => ({ innerHTML: '', value: '', dataset: {}, style: {}, textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, focus() {}, select() {}, setAttribute() {}, click() {}, querySelector: () => el(), querySelectorAll: () => [], setSelectionRange() {}, value: '' });
  const ctx = vm.createContext({
    console, setTimeout: (f, ms) => { const t = setTimeout(f, ms); t.unref && t.unref(); return t; }, clearTimeout, setInterval: () => 0, URL, Date: FDate, Math, JSON, Intl, Promise, fetch, btoa, atob, TextEncoder, TextDecoder, Blob, Response, DecompressionStream, crypto: globalThis.crypto, Uint8Array, DataView, Map, Set, File, indexedDB,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { language: 'en-GB', onLine: true, userAgent: '' }, location: { protocol: 'file:' },
    window: win,
    document: { querySelector: s => (els[s] ??= el()), querySelectorAll: () => [], addEventListener: (t, f) => (LST[t] ||= []).push(f), activeElement: null, hidden: false, title: '', documentElement: { dataset: {} }, body: { classList: { toggle() {}, add() {}, remove() {} } }, createElement: el },
  });
  const api = vm.runInContext(code + `\n;({ md, mdInline, mdToggleLine, mdStats, parseQuick, quickAdd, toggleDone, newTask, render, renderMain, renderDetail, renderSide, U, P, get S() { return S; },
    stamp, flush, save, snapshot, fingerprint, mergeData, applyMerged, replaceAll, initSeen, getT, Sync, syncNow, syncBadge, syncStatusText, buildPayload, parsePayload, PROVIDERS, dav, hooks, undoMerge: undoMerge,
    nextDue, pSet, pToggle, checkReminders, reorder, sortTasks, scopeTasks, repeatKey, repeatLabel, noteBadge, titleHtml, notesHtml, ACT, mdEnter, mdFormat,
    tagChip, tagColor, setTagColor, renameTag, ttDays, ttItems, ttLayout, renderTimetable, ttDrop, toMin, fromMin, slotById, nextSlotDate, fmtDur, metaX, THEMES, applyTheme, migrate, ttRange, slotClashes, toggleDone, ACT,
    ogYamlParse, ogMergeYaml, ogEmitRows, ogExtract, ogCompose, ogRowOfTask, ogFields, ogHash, ogImportText, ogSync, OG, OGIO, ogMerge, ogBuild, ogExportable, ganttRows, renderGantt, ogStr, ogTaskHash, ogFmtOf, ogDated, ganttDates, gtApply, gtStatus, gtPct, GT_COLS, gtCols, gtSetCols, gtDrop, uiToggle, uiFocus, uiNavDrop, pagesShown, uiMovePage, UIC, uiSetWidth, listOf,
    sfx, SOUNDS, noteById, noteTitle, newNote, noteList, noteInput, renderNotes, NOTE_ACT, gtDetailHtml, gtSummary, openNoteExpand, APP_VERSION, ttView, ttStrip, mdHighlight, PROVIDERS, sigV4, sha256hex, bytesToB64, b64ToText, DAV_PRESETS, IMPORTERS, importParse, importApply, importDetect, draftCounts, csvParse, parseWhen, unzipEntries, readImportFiles, repeatFromText, rruleToRepeat, listTree, listDescendants, listLabel, listIds, projectListIds, projectOf, listIcon, LIST_ICONS, sortDir, tagFiltered, groupTasks, repeatDates, calItems, mxMove, mxOf, MQ, parseDur, pCustom, pAdd, pActive, pTick, fdHandler, fdStatus, habitGoal, habitProgress, streak, clockParts, HIST_ACT, histDetail, histFiltered, histNote, FIRE_MIN, fmtClock,
    TT_HH, TT_MINH, noteTitleSrc, noteTitleHtml, mdPlain, durHtml, durRead, remHtml, remRead, remLabel, remParts, REM_PRESETS, themeImport, themeScope, themeNormalise, themeList, customTheme, themeRemove, themeSectionHtml, themeFile,
    filesHtml, fileKind, fileMd, fileBadge, fileSize, FILE_KINDS, linkedNotes, linkedTasks, setLink, batchStart, batchApplyChanges, batchSnapshot, batchUndo, bIds, openBatchEdit, BATCH_ACT, renderTasks, openLinkPicker, linkedNotesHtml, noteLinksHtml,
    gtSvg, gtModel, gtPages, gtRaw, gtCol, gtAllCols, gtYamlCheck, gtYamlHtml, ogApplyOpts, GT_ACT, editedCls, EDITED, editedText, fitTa, openTTSchedule, filesGC, noteSnippet, noteByTitle, todayStr, edSetMode, BATCH_ACT, themeSectionHtml,
    blkParse, blkSerialize, blkDoc, blkSrc, blkTurn, blkShortcut, blkSplit, blkMergeUp, blkMergeDown, blkReparse, blkFixGaps, blkMove, blkInsertAfter, blkDuplicate, blkLeaveList, liInfo, liShift, liToggle, liNext, liLevel,
    noteHomeOf, noteInScope, noteScopeValid, noteScope, noteSetHome, notesDetach, noteHomeValue, noteHomePatch, noteScopeCount, noteListHtml, projectOf, bannerCss, bannerClean, bannerSet, bannerHtml, bannerDraft, bannerOk, BANNER_GRADS,
    dataCounts, dataCountsText, wipeAll, backupMerge, widgetTasks, widgetSnapshot, cssHex, listOf, bedMenuItems, BED_CMDS,
    bgNorm, bgAmax, BG_DEF, BG_STYLES, BG_SHAPES, clampScale, zPct, ymd, pYmd, addDays, hmClamp, hmAddMonths, habitStartKey, habitDayStatus, hmLevel, hmDay, hmGrid, hmMonthLabels, hmSummary, hmDetailHtml, validKey, HM_WEEKS, HABIT_ACT, renderHabits, renderHabitMap, hmEnd, hAnchor,
    fmtMin, fmtTime, fmtRange, fmtHour, validHM, ttFitHH, dueLabel, TT_AUTO,
    nameFromPath, sniffFile, mimeFromName, classifyReadError, readPicked, pickFiles, filesAdd, fileDuplicate, fileReadError, FILE_MAX })`, ctx);
  api.store = store; api.els = els; api.LST = LST; api.win = win;
  // dispatch to the page-level listeners the app registered, with a fake event whose closest() answers from `hits` (selector -> element)
  api.fire = (type, hits = {}, extra = {}) => { const e = { target: { closest: s => hits[s] || null, classList: { contains: () => false }, ...extra.target }, preventDefault() {}, stopPropagation() {}, ...extra }; for (const f of LST[type] || []) f(e); return e; };
  return api;
}
