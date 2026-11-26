// Statistics are the same on every device (0.9.1). Before, the Statistics tally was kept per device and never synced, so two devices of one person showed
// different numbers. Now the tally is a synced collection (S.acts: one record per device per day, merged by the larger count of each key) and what
// Statistics shows is a pure function of those records. Everything here runs through the REAL encrypted sync file between independent app instances.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB, clock } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const PASS = 'correct horse battery staple', srv = await davServer();
const link = (a, folder) => Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder, user: 'me', pass: 'secret' } });
// each group of devices syncs through its own folder (A and B through an ENCRYPTED one; the later groups are about the counting, not the sealing)
const dev = (folder = 'OpenTick') => { const a = makeApp({ store: {}, indexedDB: fakeIndexedDB() }); link(a, folder); a.S.settings.history.on = true; return a; };
const sync = async (...ds) => { for (const d of ds) { await d.syncNow(true); assert.equal(d.Sync.state, 'ok', d.Sync.msg); } };
const task = (a, title, o = {}) => { const t = a.newTask({ title, ...o }); a.S.tasks.push(t); return t; };
// what a person sees on the Statistics page: every number of the filtered view over all time (the same stCompute that draws the cards, charts and heatmap)
const days = a => JSON.parse(JSON.stringify(a.actDays())); // (JSON: the app runs in its own VM realm, so deepStrictEqual would see different prototypes)
const view = a => { a.S.settings.stats.range = 'all'; a.S.settings.stats.kinds = []; a.S.settings.stats.acts = []; a.S.settings.stats.scope = ''; return JSON.parse(JSON.stringify(a.stCompute(a.stFilter()))); };
const same = (a, b, msg) => { assert.deepEqual(view(a), view(b), msg); assert.deepEqual(days(a), days(b), msg + ' (every count)'); };
const wait = ms => { clock.t += ms; };

/* ---- 0. the old behaviour was a real discrepancy: with nothing shared, two devices disagree ---- */
const A = dev(), B = dev();
await A.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await A.vDrain();
await sync(A);
await B.vaultJoin(JSON.parse(srv.files.get('/dav/OpenTick/opentick.json').body).vault, 'p', PASS, { local: false }); await sync(B);
assert.notEqual(A.Sync.cfg.device, B.Sync.cfg.device, 'two devices have two ids');

/* ---- 1. actions on both devices; after syncing, both show identical statistics ---- */
wait(5000); const a1 = task(A, 'A one'), a2 = task(A, 'A two'); A.flush(); wait(3000); A.toggleDone(a1); A.flush();
wait(3000); const b1 = task(B, 'B one'); B.flush(); wait(3000); B.toggleDone(b1); B.flush(); wait(1000); const b2 = task(B, 'B two'); B.flush(); wait(1000); B.toggleDone(b2); B.flush();
assert.notDeepEqual(view(A), view(B), 'before syncing each device only knows what it did itself (this is what used to be shown permanently)');
const add0 = view(A).taskAdd, done0 = view(A).taskDone;
await sync(A, B, A);
same(A, B, 'after syncing both devices show the same statistics');
assert.equal(view(A).taskAdd, 4, 'adds: two on A, two on B'); assert.equal(view(A).taskDone, 3, 'completions: one on A, two on B');
assert.ok(view(A).taskAdd > add0 && view(A).taskDone >= done0, 'A now includes B\'s counts');
assert.equal(A.S.acts.length, 2, 'one record per device per day'); assert.deepEqual([...new Set(A.S.acts.map(r => r.dev))].sort(), [A.Sync.cfg.device, B.Sync.cfg.device].sort());
for (const r of A.S.acts) assert.ok(/^ac-[\w-]+-\d{4}-\d{2}-\d{2}$/.test(r.id) && r.id === 'ac-' + r.dev + '-' + r.day, 'record ids are device + day');
const sealed = srv.files.get('/dav/OpenTick/opentick.json').body;
assert.ok(!sealed.includes('task.add') && !sealed.includes('task.done'), 'the counts are sealed with the rest: nothing readable in the cloud file'); assert.equal(JSON.parse(sealed).acts, undefined);

/* ---- 2. offline divergence on both, then any order of syncing converges, and syncing again changes nothing ---- */
wait(60000); task(A, 'A offline'); A.flush(); A.toggleDone(a2); A.flush(); wait(2000); task(B, 'B offline 1'); task(B, 'B offline 2'); B.flush();
await sync(B, A, B); same(A, B, 'converged after offline work on both'); const settled = view(A);
for (let i = 0; i < 3; i++) { await sync(A, B); same(A, B, 'syncing again'); assert.deepEqual(view(A), settled, 're-syncing never changes a number (no double counting)'); }
assert.equal(settled.taskAdd, 7);

/* ---- 3. a device that does not record (history off) still shows the same numbers; the History list stays local ---- */
B.S.settings.history.on = false; B.U.page = 'stats'; B.render(); const html = B.els['#main'].innerHTML;
assert.ok(!/Statistics needs History/.test(html), 'counts made elsewhere are shown even where this device does not record'); same(A, B, 'a device with history off shows the same numbers');
const before = view(B); task(B, 'not recorded'); B.flush(); assert.deepEqual(view(B), before, 'and it records nothing of its own while off'); B.S.settings.history.on = true;
assert.equal(A.S.history.some(h => h.n === 'B one'), false, 'the History list (what happened on THIS device) is not synced');

/* ---- 4. day and hour are fixed by the device that did the action ---- */
const rec = A.S.acts.find(r => r.dev === A.Sync.cfg.device); const hours = JSON.stringify(rec.k); wait(36 * 3600e3); await sync(A, B); wait(1000);
assert.equal(JSON.stringify(B.S.acts.find(r => r.id === rec.id).k), hours, 'the buckets do not move when read later on another device'); same(A, B, 'later');

/* ---- 5. migration from the per-device tally of 0.9.0: adopted once, not doubled, not lost ---- */
const L = dev('F5'), M = dev('F5'); await sync(L); await sync(M);
const legacy = { '2026-10-06': { 'task.done|inbox|9': 3, 'task.add|inbox|9': 4 }, '2026-10-07': { 'habit.done||': 2 } };
L.S.activity.days = JSON.parse(JSON.stringify(legacy)); M.S.activity.days = { '2026-10-06': { 'task.done|inbox|9': 1 }, '2026-10-08': { 'note.add||20': 5 } };
const lBefore = days(L); L.flush(); M.flush();
assert.deepEqual(lBefore, legacy, 'the tally an older version kept is what Statistics shows right after the upgrade'); assert.deepEqual(JSON.parse(JSON.stringify(L.S.activity.days)), {}, 'and now lives in this device\'s records');
assert.ok(L.S.acts.every(r => r.dev === L.Sync.cfg.device)); L.S.activity.days = JSON.parse(JSON.stringify(legacy)); L.flush(); assert.deepEqual(days(L), legacy, 'adopting the same tally twice does not double it');
await sync(L, M, L); same(L, M, 'two devices that each had their own old tally now agree'); const lm = days(L);
assert.equal(lm['2026-10-06']['task.done|inbox|9'], 4, 'the two old tallies add up (3 on one device, 1 on the other)'); assert.equal(lm['2026-10-08']['note.add||20'], 5);
await sync(M, L, M); assert.deepEqual(days(L), lm, 'stable'); assert.deepEqual(days(M), lm);

/* ---- 6. restoring or importing data keeps what was counted; Delete everything / Reset removes it on every device ---- */
const keep = JSON.stringify(A.actDays()); A.replaceAll(JSON.parse(JSON.stringify({ ...A.snapshot(), tasks: [] }))); assert.equal(JSON.stringify(A.actDays()), keep, 'restoring data does not un-count what you did');
await sync(A, B, A); same(A, B, 'and still equal'); assert.equal(JSON.stringify(A.actDays()), keep);
A.actClear(); assert.equal(Object.keys(A.actDays()).length, 0, 'Reset statistics clears the device'); await sync(A, B);
assert.equal(Object.keys(B.actDays()).length, 0, 'and, after syncing, every device'); same(A, B, 'reset');
wait(2000); task(B, 'after the reset'); B.flush(); await sync(B, A); same(A, B, 'counting resumes cleanly'); assert.equal(view(A).taskAdd, 1, 'only what happened after the reset');
// a stale copy that was deleted (reset) must not bring the old counts back through the per-key maximum
const C = dev('F6'); const stale = JSON.parse(JSON.stringify(A.S.acts)).map(r => ({ ...r, k: { 'task.add||1': 99 }, u: 1 }));
C.S.acts = stale; const merged = C.mergeData({ ...C.snapshot(), acts: stale, tomb: { [stale[0].id]: Date.now() } }, A.snapshot());
assert.ok(!merged.acts.some(r => (r.k['task.add||1'] || 0) >= 99), 'a copy deleted at least as recently as it was edited takes no part in the merge');

/* ---- 7. the merge rule itself: commutative, associative, idempotent; two devices with the same id (a cloned profile) lose nothing ---- */
const X = { id: 'ac-d-2026-11-01', dev: 'd', day: '2026-11-01', k: { a: 3, b: 1 }, u: 10 }, Y = { id: X.id, dev: 'd', day: X.day, k: { a: 2, c: 4 }, u: 20 }, Z = { id: X.id, dev: 'd', day: X.day, k: { b: 7 }, u: 15 };
const mg = (l, r) => A.mergeData({ ...A.snapshot(), acts: l, tomb: {} }, { ...A.snapshot(), acts: r, tomb: {} }).acts.find(r2 => r2.id === X.id);
const k = o => JSON.stringify(Object.entries(o.k).sort());
assert.equal(k(mg([X], [Y])), k(mg([Y], [X])), 'commutative'); assert.deepEqual(JSON.parse(JSON.stringify(mg([X], [Y]).k)), { a: 3, b: 1, c: 4 }, 'the larger count of every key');
assert.equal(k(mg([mg([X], [Y])], [Z])), k(mg([X], [mg([Y], [Z])])), 'associative'); assert.equal(k(mg([mg([X], [Y])], [Y])), k(mg([X], [Y])), 'idempotent');
assert.ok(mg([X], [Y]).u > Y.u, 'a merged record that differs from both sides gets a newer stamp so it propagates'); assert.equal(mg([Y], [{ ...Y }]).u, Y.u, 'identical copies are left alone');

/* ---- 8. counting what already exists (turning history on) happens once for the whole account ---- */
const P = dev('F8'), Q = dev('F8'); P.S.settings.history.on = false; Q.S.settings.history.on = false; await sync(P); await sync(Q);
task(P, 'old one', { created: Date.UTC(2026, 9, 1, 9, 0, 0) }); P.flush(); await sync(P, Q);
P.S.settings.history.on = true; P.histToggled(); Q.S.settings.history.on = true; Q.histToggled(); // both turn it on while offline from each other
const bf = view(P); assert.deepEqual(view(Q), bf, 'both counted the same existing things'); await sync(P, Q, P); same(P, Q, 'one shared count per day, not one per device'); assert.deepEqual(view(P), bf, 'nothing is counted twice');
const R = dev('F8'); await sync(R); R.S.settings.history.on = true; R.histToggled(); assert.equal(R.histToggled && view(R).total, view(P).total, 'a device that joins later does not count the same things again');

srv.server.close();
console.log('statistics sync tests passed (identical on every device, offline convergence, idempotent, migration, reset, merge laws)');
