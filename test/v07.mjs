// 0.7 features: sort direction, multi-tag filter, history, calendar repeats, matrix moves, habit goals, focus (custom time, face-down), clock.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const A = makeApp(), { S, U } = A;
const td = A.ymd ? A.ymd(new Date()) : '2026-10-08';
const mk = (title, o = {}) => { const t = A.newTask({ title, ...o }); S.tasks.push(t); return t; };
S.tasks.length = 0;
const a = mk('a', { priority: 1, due: '2026-10-12', tags: ['work', 'urgent'], created: 1 }), b = mk('b', { priority: 3, due: '2026-10-09', tags: ['work'], created: 2 });
const c = mk('c', { priority: 2, tags: ['home', 'urgent'], created: 3 }), d = mk('d', { priority: 0, due: '2026-10-10', created: 4 });
const names = l => l.map(t => t.title).join('');

/* sort direction: natural defaults are kept, the arrow reverses, undated / untagged stay last */
S.settings.sort = 'due'; S.settings.sortDir = null;
assert.equal(names(A.sortTasks(S.tasks)), 'bdac'); S.settings.sortDir = 'desc'; assert.equal(names(A.sortTasks(S.tasks)), 'adbc', 'descending due keeps undated last');
S.settings.sort = 'priority'; S.settings.sortDir = null; assert.equal(names(A.sortTasks(S.tasks)), 'bcad', 'priority starts high to low (as before)'); S.settings.sortDir = 'asc'; assert.equal(names(A.sortTasks(S.tasks)), 'dacb');
S.settings.sort = 'created'; S.settings.sortDir = null; assert.equal(names(A.sortTasks(S.tasks)), 'dcba', 'created starts newest first (as before)');
S.settings.sort = 'title'; S.settings.sortDir = 'desc'; assert.equal(names(A.sortTasks(S.tasks)), 'dcba');
S.settings.sort = 'tags'; S.settings.sortDir = null; assert.equal(names(A.sortTasks(S.tasks)), 'cabd', 'sort by tags, untagged last');
S.settings.sort = 'manual'; S.settings.sortDir = null;

/* multi-tag filter + group by tag */
U.tagSel = ['work', 'urgent']; U.tagMode = 'all'; assert.equal(names(A.tagFiltered(S.tasks)), 'a');
U.tagMode = 'any'; assert.equal(names(A.tagFiltered(S.tasks)), 'abc'); U.tagSel = []; assert.equal(A.tagFiltered(S.tasks).length, 4);
S.settings.group = 'tag'; const g = A.groupTasks(S.tasks); S.settings.group = 'none';
eq(g.map(x => x.title + x.tasks.length), ['#home1', '#urgent2', '#work2', 'No tag1'], 'a task appears under each of its tags');

/* calendar: every repeat of a repeating task is projected, however far away */
const daily = mk('daily', { due: '2026-10-08', repeat: { every: 3, unit: 'day' } });
eq(A.repeatDates(daily, '2026-10-08', '2026-10-20'), ['2026-10-11', '2026-10-14', '2026-10-17', '2026-10-20']);
assert.ok(A.repeatDates(daily, '2030-01-01', '2030-01-31').length >= 10, 'a far-away month still shows its repeats');
const weekly = mk('weekly', { due: '2026-10-08', repeat: { every: 1, unit: 'week', days: [1, 3] } });
assert.ok(A.repeatDates(weekly, '2026-10-12', '2026-10-18').join() === '2026-10-12,2026-10-14');
assert.equal(A.repeatDates(mk('once', { due: '2026-10-08' }), '2026-10-01', '2026-12-01').length, 0);
const loop = mk('loop', { due: '2026-10-08', repeat: { every: 0, unit: 'day' } }); assert.ok(A.repeatDates(loop, '2026-10-09', '2026-11-30').length < 5, 'a rule that does not move forward cannot loop');
const by = A.calItems('2026-10-08', '2026-10-17'); assert.ok(by['2026-10-14'].some(x => x.virt && x.t === daily), 'virtual entries are marked');
S.tasks = S.tasks.filter(t => ![daily, weekly, loop].includes(t) && t.title !== 'once');

/* matrix: a task moved to a box takes on that box's priority / urgency */
const q = mk('q', { priority: 0 }); A.mxMove(q, 0); assert.equal(A.mxOf(q), 0); assert.equal(q.priority, 3); assert.ok(q.due);
A.mxMove(q, 3); assert.equal(A.mxOf(q), 3); assert.equal(q.due, null); assert.ok(q.priority < 2);
const qr = mk('qr', { priority: 3, due: '2026-10-08', repeat: { every: 1, unit: 'day' } }); A.mxMove(qr, 1); assert.ok(qr.due > '2026-10-08', 'a repeating task is moved to tomorrow, not undated');
S.tasks = S.tasks.filter(t => t !== q && t !== qr);

/* habit goals */
const h = { id: 'h', name: 'Run', icon: '🏃', color: '#fff', log: {} }; S.habits.push(h);
eq({ ...A.habitGoal(h) }, { per: 'day', n: 1 }, 'daily is the default');
h.log['2026-10-07'] = 1; h.log['2026-10-08'] = 1; assert.equal(A.streak(h), 2);
h.goal = { per: 'week', n: 2 }; S.settings.weekStart = 1; // this week (Mon 5 Oct) has 2 check-ins, the week before none
assert.equal(A.streak(h), 1); assert.equal(A.habitProgress(h).done, 2);
h.log['2026-09-29'] = 1; h.log['2026-10-01'] = 1; assert.equal(A.streak(h), 2, 'consecutive weeks that met the goal');
h.goal = { per: 'week', n: 99 }; assert.equal(A.habitGoal(h).n, 7, 'a weekly goal is capped at 7');

/* history */
S.history.length = 0; A.flush(); A.initSeen();
const t1 = A.quickAdd('History probe', {}); clock.t += 1000; A.flush();
t1.title = 'History probe 2'; t1.priority = 3; clock.t += 1000; A.flush();
t1.due = '2026-10-20'; clock.t += 1000; A.flush();
const ed = S.history.filter(e => e.a === 'edit'); assert.equal(ed.length, 1, 'quick edits of one task fold into one entry');
eq(Object.keys(ed[0].f).sort(), ['due', 'priority', 'title']); assert.equal(ed[0].f.title[0], 'History probe');
assert.ok(A.histDetail(ed[0]).includes('Priority'), 'details are readable');
A.toggleDone(t1); clock.t += 1000; A.flush(); t1.status = 'open'; delete t1.doneAt; clock.t += 1000; A.flush();
t1.deleted = clock.t; clock.t += 1000; A.flush(); delete t1.deleted; clock.t += 1000; A.flush();
S.tasks = S.tasks.filter(x => x !== t1); clock.t += 1000; A.flush();
eq(S.history.filter(e => e.id === t1.id).map(e => e.a), ['add', 'edit', 'done', 'reopen', 'delete', 'restore', 'purge'], 'every kind of change is told');
const rep = mk('Repeater', { due: '2026-10-08', repeat: { every: 1, unit: 'day' } }); clock.t += 1000; A.flush(); S.history.length = 0;
A.toggleDone(rep); clock.t += 1000; A.flush();
eq(S.history.map(e => e.a), ['done'], 'ticking a repeating task logs one completion, not an extra edit');
h.goal = null; S.history.length = 0; h.log['2026-10-09'] = 1; clock.t += 1000; A.flush(); assert.equal(S.history[0].a, 'done'); assert.ok(S.history[0].d.includes('2026-10-09'));
// the log is per device: it is not in the sync file, survives a restore, and synced-in changes are not logged
assert.equal('history' in A.snapshot(), false, 'history stays out of the sync snapshot');
const keep = A.S.history.length; A.replaceAll(JSON.parse(JSON.stringify({ ...A.snapshot(), tasks: [] }))); assert.equal(A.S.history.length, keep, 'a restore keeps this device log');
const B = makeApp(); const bt = B.quickAdd('from B', {}); B.flush(); const before = A.S.history.length;
A.applyMerged(A.mergeData(A.snapshot(), B.snapshot())); assert.ok(A.S.tasks.some(x => x.title === 'from B')); assert.equal(A.S.history.length, before, 'changes that arrive by sync are not logged');
for (let i = 0; i < 2100; i++) A.S.history.push({ t: 1, k: 'task', a: 'edit', id: 'x' + i, n: 'x' }); A.flush(); t1.title = 'x'; // trimmed on the next record
A.S.tasks.push(mk('trim')); clock.t += 1000; A.flush(); assert.ok(A.S.history.length <= 2000, 'the log is capped');

/* focus: any time, face-down */
assert.equal(A.parseDur('45'), 2700); assert.equal(A.parseDur('1h30'), 5400); assert.equal(A.parseDur('90s'), 90); assert.equal(A.parseDur('25:00'), 1500); assert.equal(A.parseDur('1:30:00'), 5400); assert.equal(A.parseDur('1.5h'), 5400);
assert.equal(A.parseDur('abc'), null); assert.equal(A.parseDur('5 30'), null); assert.equal(A.parseDur(''), null);
assert.equal(A.pCustom('0'), false); assert.equal(A.pCustom('2h'), true); assert.equal(A.P.total, 7200); assert.equal(A.fmtClock(7200), '2:00:00'); assert.equal(A.fmtClock(65), '01:05');
A.pAdd(5); assert.equal(A.P.left, 7500); A.pAdd(-9999); assert.equal(A.P.left, 1, 'cannot go below one second');
A.pCustom('10'); A.S.settings.pomo.faceDown = false; A.pToggle(); clock.t += 3000; A.pTick(); assert.equal(Math.round(A.P.left), 597, 'counts normally');
A.S.settings.pomo.faceDown = true; A.P.down = false; clock.t += 3000; A.pTick(); assert.equal(Math.round(A.P.left), 597, 'face up: paused');
A.fdHandler({ beta: 180, gamma: 0 }); assert.equal(A.P.down, true); clock.t += 4000; A.pTick(); assert.equal(Math.round(A.P.left), 593, 'face down: counting');
A.fdHandler({ beta: 120, gamma: 0 }); assert.equal(A.P.down, true, 'a slight tilt does not flicker'); A.fdHandler({ beta: 5, gamma: 5 }); assert.equal(A.P.down, false);
clock.t += 5000; A.pTick(); assert.equal(Math.round(A.P.left), 593, 'picked up: paused again'); A.fdHandler({ beta: null, gamma: null }); assert.equal(A.P.down, false, 'empty sensor readings are ignored');
assert.ok(A.fdStatus()[1].includes('paused')); A.fdHandler({ beta: -178, gamma: 3 }); assert.equal(A.P.down, true, 'face down whichever way the phone was turned');

/* clock */
A.S.settings.clock = { on: true, h24: false, sec: false }; const cp = A.clockParts(new Date(2026, 9, 12, 17, 5, 9));
eq({ ...cp }, { time: '5:05', ap: 'PM', date: 'Monday, 12 October 2026' });
A.S.settings.clock = { on: true, h24: true, sec: true }; assert.equal(A.clockParts(new Date(2026, 9, 12, 7, 5, 9)).time, '07:05:09');

/* layout regression: the sidebar / details panel can be hidden (fixed, out of flow) without #main falling into a 0px track */
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
assert.ok(css.includes('#main{grid-column:2}') && css.includes('#detail{grid-column:3}'), 'panes keep their own grid column');
console.log('0.7 feature tests passed');
