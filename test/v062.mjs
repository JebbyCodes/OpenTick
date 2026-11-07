// 0.6.2: one Calendar (month + agenda by date, week / 3 days / day as the time grid), the same names everywhere, app-wide search,
// Templates reachable from Notes, and the sync file / vault untouched by any of it.
import assert from 'node:assert/strict';
import { makeApp } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const A = makeApp(), { S, U } = A;

/* the Calendar is one section: the old Timetable is its week / 3 days / day */
eq(A.viewsOf('calendar'), ['calendar', 'countdowns', 'zones'], 'Timetable is no longer a tab of its own');
eq(A.CAL_MODES.map(m => m[0]), ['month', 'week', '3day', 'day', 'agenda']);
eq(A.CAL_MODES.filter(m => m[3]).map(m => m[0]), ['week', '3day', 'day'], 'week, 3 days and day are the time grid');
A.calGo('week'); assert.equal(U.page, 'timetable'); assert.equal(A.calMode(), 'week'); assert.ok(A.calIsGrid());
A.calGo('3day'); assert.equal(A.calMode(), '3day'); assert.equal(S.settings.tt.view, '3day', 'the grid view is remembered');
A.calGo('day'); assert.equal(A.calMode(), 'day');
A.calGo('month'); assert.equal(U.page, 'calendar'); assert.equal(A.calMode(), 'month'); assert.ok(!A.calIsGrid());
A.calGo('agenda'); assert.equal(U.page, 'calendar'); assert.equal(A.calMode(), 'agenda'); assert.equal(S.settings.cal.view, 'agenda');
A.calGo('month'); assert.equal(S.settings.cal.view, 'month');
A.ACT.ttview({ dataset: { v: 'week' } }); assert.equal(U.page, 'timetable', 'the old week button still works'); assert.equal(A.ttView(), 'week');
// every Calendar mode draws without error and carries the shared toolbar (back, today, forward, Add, More) and the one set of mode tabs
for (const v of ['month', 'week', '3day', 'day', 'agenda']) {
  A.calGo(v); const h = A.els['#main'].innerHTML;
  assert.ok(h.includes('caladd') && h.includes('calmore'), `${v}: one Add and one More`);
  assert.ok(h.includes('data-act="calview"') && h.includes('data-act="ttview"'), `${v}: the mode tabs are there`);
  assert.ok(!h.includes('data-act="scmode" data-m="school"'), `${v}: the Classes switch is in More, not on the toolbar`);
}
// the More menu holds the rest, and only offers what applies to the view
A.calGo('week'); assert.ok(A.calMoreItems().length >= 3); A.calGo('month'); assert.ok(A.calMoreItems().length < 6);
// page ids are kept, so old links, widgets and shortcuts open the right thing
assert.ok(A.PAGES.some(p => p[0] === 'timetable') && A.PAGES.some(p => p[0] === 'calendar'));

/* the same name on the button and on the page */
const VIEW_TITLES = { gantt: 'Timeline', kanban: 'Board', habits: 'Habits', matrix: 'Matrix' };
for (const [k, want] of Object.entries(VIEW_TITLES)) {
  assert.equal(A.VIEW_TAB[k][0], want, `${k} tab`);
  U.page = k; A.render(); const m = A.els['#main'].innerHTML;
  assert.ok(m.includes(`<h1>${want}</h1>`), `${k}: the heading says ${want}`);
}

/* app-wide search */
S.tasks.push(A.newTask({ title: 'Buy oat milk', tags: ['shop'] })); S.notes.push(A.newNote({ title: 'Oat recipes', body: 'porridge with oat milk' }));
const g = A.srchGroups('oat', 'all'), keys = g.map(x => x.k);
assert.ok(keys.includes('tasks') && keys.includes('notes'), 'tasks and notes are searched together');
assert.ok(g.find(x => x.k === 'tasks').rows.some(r => r.label === 'Buy oat milk'));
assert.ok(g.every(x => x.rows.length && x.rows.every(r => typeof r.run === 'function')), 'every hit can be opened');
assert.ok(A.srchGroups('oat', 'tasks').every(x => x.scope === 'tasks'), 'a scope narrows the groups');
assert.ok(A.srchGroups('settings', 'all').some(x => x.k === 'set'), 'settings sections are found');
assert.ok(A.srchGroups('week', 'all').some(x => x.k === 'pages' && x.rows.some(r => /Calendar: Week/.test(r.label))), 'Calendar views are found by name');
assert.ok(A.srchGroups('', 'all').length === 1 && A.srchGroups('', 'all')[0].k === 'jump', 'nothing typed: places to go');
assert.equal(A.srchGroups('zzzqqq-no-such-thing', 'all').filter(x => x.k !== 'set' && x.k !== 'cmds').length, 0, 'no match, no rows');
// a deleted task is not found
const gone = A.newTask({ title: 'Ghost oat task' }); gone.deleted = true; S.tasks.push(gone);
assert.ok(!A.srchGroups('ghost', 'all').some(x => x.k === 'tasks'), 'the bin is not searched');
// searching never changes your data
const before = JSON.stringify(A.snapshot()); A.srchGroups('oat', 'all'); A.srchGroups('week', 'all'); assert.equal(JSON.stringify(A.snapshot()), before, 'search reads only');

/* Templates are reachable from Notes */
U.page = 'notes'; U.noteSel = null; A.render();
assert.ok(A.els['#main'].innerHTML.includes('data-act="notetpl"'), 'the Notes page has a template button');
assert.equal(typeof A.NOTE_ACT.notetpl === 'function' || typeof A.ACT.notetpl === 'function', true, 'and it does something');

/* the sync file and the vault are not touched by any of this: same collections in the snapshot, same payload parts, and a view change is not a data change */
const snap = A.snapshot();
eq(Object.keys(snap), ['tasks', 'lists', 'habits', 'tags', 'slots', 'notes', 'projects', 'school', 'templates', 'countdowns', 'zones', 'boards', 'pomo', 'tomb'], 'the synced collections are the same as in 0.6.1');
eq(Object.keys(A.buildPayload()), ['snap', 'fp', 'text'], 'the sync payload has the same parts');
const fp = A.fingerprint(A.snapshot()); A.calGo('week'); A.calGo('month'); assert.equal(A.fingerprint(A.snapshot()), fp, 'moving around the Calendar does not look like an edit to sync');
console.log('0.6.2 tests passed (one Calendar, names, search, templates in Notes, sync shape)');
