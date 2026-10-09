// Layout settings, sidebar views / list reordering, task drops on the sidebar, and the Gantt table + drag date maths.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m); // the app runs in its own VM realm

const app = makeApp();
const { S, U, uiToggle, uiFocus, pagesShown, uiMovePage, uiNavDrop, gtApply, ganttDates, gtStatus, gtPct, GT_COLS, gtCols, gtSetCols, UIC } = app;

/* defaults + hiding panels */
assert.equal(S.settings.ui.side, true); assert.equal(S.settings.ui.detail, true); assert.equal(S.settings.ui.sideW, 300);
uiToggle('side'); assert.equal(app.S.settings.ui.side, false); uiToggle('side'); assert.equal(app.S.settings.ui.side, true);
uiFocus(); eq([app.S.settings.ui.side, app.S.settings.ui.detail], [false, false]);
uiFocus(); eq([app.S.settings.ui.side, app.S.settings.ui.detail], [true, true], 'focus mode restores what was visible');
app.S.settings.ui.detail = false; uiFocus(); uiFocus(); eq([app.S.settings.ui.side, app.S.settings.ui.detail], [true, false], 'and only that');
app.S.settings.ui.detail = true;

/* width limits */
const c = UIC.side; assert.equal(app.uiSetWidth(c, 50), 220); assert.equal(app.uiSetWidth(c, 5000) <= 520, true);

/* sidebar views: order + hide, but the page you are on never disappears */
eq(pagesShown().map(p => p[0]), ['tasks', 'calendar', 'timetable', 'gantt', 'matrix', 'habits', 'focus']);
uiMovePage('gantt', -1); eq(pagesShown().map(p => p[0]).slice(0, 4), ['tasks', 'calendar', 'gantt', 'timetable']);
app.S.settings.ui.hidePages = ['habits', 'gantt']; U.page = 'gantt';
eq(pagesShown().map(p => p[0]), ['tasks', 'calendar', 'gantt', 'timetable', 'matrix', 'focus'], 'current page stays; habits hidden');
U.page = 'tasks'; assert.equal(pagesShown().some(p => p[0] === 'gantt'), false);

/* dropping a task on the sidebar */
const t = app.newTask({ title: 'drag me' }); app.S.tasks.push(t);
const work = app.S.lists.find(l => l.id !== 'inbox'); U.drag = t.id;
assert.equal(uiNavDrop({ dataset: { nav: 'list:' + work.id } }), true); assert.equal(t.listId, work.id);
uiNavDrop({ dataset: { nav: 'tomorrow' } }); assert.equal(t.due, app.S.tasks && (() => { const d = new Date(clock.t); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })());
uiNavDrop({ dataset: { nav: 'trash' } }); assert.ok(t.deleted);
assert.equal(uiNavDrop({ dataset: { nav: 'list:nope' } }), false);
U.drag = null;

/* Gantt table columns */
eq(gtCols(), ['plan']);
gtSetCols(['plan', 'status', 'bogus']); eq(gtCols(), ['plan', 'status'], 'unknown column names are ignored');
assert.ok(app.S.settings.gantt.nameW >= 190 + 122 + 116, 'the table grows to fit its columns');
const mk = o => ganttDates({ status: 'open', ...o }, true);
const today = (() => { const d = new Date(clock.t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const day = n => { const d = new Date(clock.t); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
assert.equal(today, '2026-10-08');
eq(gtStatus(mk({ start: day(2), due: day(5) })), ['Not started', '']);
eq(gtStatus(mk({ start: day(-2), due: day(5) })), ['In progress', 'prog']);
eq(gtStatus(mk({ start: day(-9), due: day(-5) })), ['Overdue', 'over']);
eq(gtStatus(mk({ status: 'done', start: day(-9), due: day(-5), doneAt: clock.t })), ['Completed late', 'late']);
eq(gtStatus(mk({ status: 'done', start: day(-9), due: day(5), doneAt: clock.t })), ['Completed', 'done']);
assert.equal(gtPct(mk({ start: day(-1), due: day(2) })), 50); // day 2 of 4
assert.equal(GT_COLS.variance[2](mk({ start: day(-9), due: day(-5) })), '+5 d');
assert.equal(GT_COLS.variance[2](mk({ status: 'done', start: day(-9), due: day(-5), doneAt: clock.t - 7 * 864e5 })), '−2 d');
assert.equal(GT_COLS.plan[2](mk({ start: '2026-10-08', due: '2026-10-08' })), 'Oct 8', 'a one-day plan reads as a single date');

/* dragging bars: the date maths */
const row = { k: 'task', t: { start: '2026-10-10', due: '2026-10-14', astart: '2026-10-09', title: 'x', status: 'open' } }, D = () => ganttDates(row.t, true);
gtApply(row, 'plan', 'move', 3, D()); eq([row.t.start, row.t.due], ['2026-10-13', '2026-10-17']);
gtApply(row, 'plan', 'r', 2, D()); eq([row.t.start, row.t.due], ['2026-10-13', '2026-10-19']);
gtApply(row, 'plan', 'l', -4, D()); eq([row.t.start, row.t.due], ['2026-10-09', '2026-10-19']);
gtApply(row, 'plan', 'l', 99, D()); eq([row.t.start, row.t.due], ['2026-10-19', '2026-10-19'], 'the start cannot pass the end');
gtApply(row, 'plan', 'r', -99, D()); eq([row.t.start, row.t.due], ['2026-10-19', '2026-10-19'], 'the end cannot pass the start');
gtApply(row, 'act', 'l', 2, D()); assert.equal(row.t.astart, '2026-10-11');
const ms = { k: 'task', t: { due: '2026-10-20', title: 'm', status: 'open' } }; gtApply(ms, 'plan', 'move', -5, ganttDates(ms.t, true)); eq([ms.t.start || null, ms.t.due], [null, '2026-10-15'], 'a milestone keeps its one date');
const st = { k: 'task', t: { start: '2026-10-20', title: 's', status: 'open' } }; gtApply(st, 'plan', 'move', 2, ganttDates(st.t, true)); eq([st.t.start, st.t.due || null], ['2026-10-22', null]);
const sub = { k: 'sub', s: { start: '2026-10-01', due: '2026-10-03', title: 'sub' } }; gtApply(sub, 'plan', 'move', 1, ganttDates(sub.s, false)); eq([sub.s.start, sub.s.due], ['2026-10-02', '2026-10-04']);
console.log('layout + gantt tests passed');
