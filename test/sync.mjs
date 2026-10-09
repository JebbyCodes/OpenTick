// Sync: merge rules, change tracking, and the real engine against a mock WebDAV server (two devices).
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const J = o => JSON.parse(JSON.stringify(o));
const tick = (ms = 10000) => { clock.t += ms; };

/* ============ 1. merge rules (pure) ============ */
{
  const { mergeData, fingerprint } = makeApp();
  const base = clock.t - 100000, B = n => (n ? base + n : 0);   // small offsets from "now" so tombstones are inside the TTL
  const task = (id, u, extra = {}) => ({ id, title: id, notes: '', tags: [], subtasks: [], status: 'open', u: B(u), ...extra });
  const D = (o = {}) => ({ tasks: [], lists: [], habits: [], pomo: [], tomb: {}, ...o });
  const tomb = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, B(v)]));
  const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
  const both = (a, b) => { const x = mergeData(a, b), y = mergeData(b, a); assert.equal(fingerprint(x), fingerprint(y), 'merge must be commutative'); assert.equal(fingerprint(mergeData(x, a)), fingerprint(x), 'idempotent'); assert.equal(fingerprint(mergeData(x, b)), fingerprint(x), 'idempotent'); return x; };

  let m = both(D({ tasks: [task('a', 5, { title: 'old' })] }), D({ tasks: [task('a', 9, { title: 'new' })] }));
  assert.equal(m.tasks[0].title, 'new');
  m = both(D({ tasks: [task('a', 1)] }), D({ tasks: [task('b', 1)] })); assert.equal(m.tasks.length, 2);                      // different records: union
  m = both(D({ tasks: [task('a', 5)] }), D({ tasks: [], tomb: tomb({ a: 8 }) })); assert.equal(m.tasks.length, 0); assert.equal(m.tomb.a, B(8));   // deleted after last edit
  m = both(D({ tasks: [task('a', 9)] }), D({ tasks: [], tomb: tomb({ a: 8 }) })); assert.equal(m.tasks.length, 1); assert.equal(m.tomb.a, undefined); // edited after deletion: resurrected
  m = both(D({ tasks: [task('a', 0)] }), D({ tomb: tomb({ a: 3 }) })); assert.equal(m.tasks.length, 0);                              // legacy (unstamped) record vs deletion
  m = both(D({ tasks: [task('a', 4, { title: 'x' })] }), D({ tasks: [task('a', 4, { title: 'y' })] })); assert.ok(['x', 'y'].includes(m.tasks[0].title)); // same tick: deterministic
  // habits merge per day
  const hab = (u, log, logU, name = 'h') => ({ id: 'h1', name, icon: '', color: '', log, logU: Object.fromEntries(Object.entries(logU).map(([k, v]) => [k, B(v)])), u: B(u) });
  m = both(D({ habits: [hab(5, { '2026-10-01': 1 }, { '2026-10-01': 5 })] }), D({ habits: [hab(6, { '2026-10-02': 1 }, { '2026-10-02': 6 })] }));
  same(Object.keys(m.habits[0].log).sort(), ['2026-10-01', '2026-10-02']);
  assert.ok(m.habits[0].u > B(6), 'a merged habit that differs from both sides must outrank them so it propagates');
  m = both(D({ habits: [hab(5, { '2026-10-01': 1 }, { '2026-10-01': 5 })] }), D({ habits: [hab(8, {}, { '2026-10-01': 8 })] })); // unticked later on the other device
  same(Object.keys(m.habits[0].log), []);
  m = both(D({ habits: [hab(9, { '2026-10-01': 1 }, { '2026-10-01': 9 })] }), D({ habits: [hab(8, {}, { '2026-10-01': 4 })] })); // ticked later
  same(Object.keys(m.habits[0].log), ['2026-10-01']);
  m = both(D({ habits: [{ id: 'h1', name: 'a', log: { d: 1 }, u: 0 }] }), D({ habits: [{ id: 'h1', name: 'a', log: {}, u: 0 }] })); same(Object.keys(m.habits[0].log), ['d']); // legacy: union
  // pomodoro log: union, de-duplicated
  m = both(D({ pomo: [{ ts: 1, min: 25, task: null }, { ts: 2, min: 25, task: null }] }), D({ pomo: [{ ts: 2, min: 25, task: null }, { ts: 3, min: 5, task: 'x' }] })); assert.equal(m.pomo.length, 3);
  // very old tombstones are dropped, recent ones kept
  m = mergeData(D({ tomb: { old: clock.t - 400 * 864e5, fresh: clock.t - 864e5 } }), D()); same(Object.keys(m.tomb), ['fresh']);
  // fingerprint only moves when something syncable changes
  assert.notEqual(fingerprint(D({ tasks: [task('a', 1)] })), fingerprint(D({ tasks: [task('a', 2)] })));
  assert.equal(fingerprint(D({ tasks: [task('a', 1)] })), fingerprint(D({ tasks: [task('a', 1, { title: 'ignored: u is the version' })] })));
}

/* ============ 2. change tracking ============ */
{
  const A = makeApp(), S = A.S;
  assert.equal(A.stamp(), false, 'fresh load must not stamp anything');
  const t = S.tasks[0]; tick(); t.title = 'edited'; assert.equal(A.stamp(), true);
  assert.equal(t.u, clock.t); const u = t.u; tick(); assert.equal(A.stamp(), false); assert.equal(t.u, u, 'untouched records keep their stamp');
  const id = S.tasks[1].id; S.tasks = S.tasks.filter(x => x.id !== id); tick(); assert.equal(A.stamp(), true); assert.equal(S.tomb[id], clock.t, 'hard delete leaves a tombstone');
  const n = A.quickAdd('new one', {}); tick(); A.stamp(); assert.equal(n.u, clock.t);
  S.habits[0].log['2026-10-08'] = 1; tick(); assert.equal(A.stamp(), true, 'habit check-ins count as edits');
  // a reload from storage must not re-stamp
  A.flush(); const B = makeApp({ store: A.store }); assert.equal(B.stamp(), false); assert.equal(B.S.tasks.find(x => x.id === t.id).u, t.u);
}

/* ============ 3. engine vs. a WebDAV server ============ */
const FILE = '/dav/OpenTick/opentick.json';
const device = (srv, o = {}) => { const a = makeApp(); Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder: 'OpenTick', user: 'me', pass: 'secret', ...o } }); return a; };
const remote = srv => JSON.parse(srv.files.get(FILE).body);
const titles = a => a.S.tasks.filter(t => !t.deleted).map(t => t.title).sort();
const getTask = (a, title) => a.S.tasks.find(t => t.title === title);
const edit = (a, fn) => { tick(); fn(); a.flush(); };
const sync = async (...apps) => { for (const a of apps) { tick(); await a.syncNow(); assert.equal(a.Sync.state, 'ok', a.Sync.msg); } };
const assertConverged = (srv, ...apps) => { const fp = apps[0].fingerprint(apps[0].snapshot()); for (const a of apps) assert.equal(a.fingerprint(a.snapshot()), fp); assert.equal(apps[0].fingerprint(remote(srv)), fp, 'server copy must match too'); };

const srv = await davServer();
try {
  // first device creates folder + file; second device joins and ends up with the SAME welcome tasks (no duplicates)
  const A = device(srv), B = device(srv);
  await sync(A);
  assert.ok(srv.files.has(FILE)); assert.equal(srv.count('MKCOL'), 1);
  const payload = remote(srv); assert.equal(payload.app, 'opentick'); assert.ok(!('settings' in payload) && !('fired' in payload), 'device-local state is not uploaded');
  assert.ok(!JSON.stringify(payload).includes('secret'), 'credentials never reach the server');
  assert.ok(!JSON.stringify(A.S).includes('secret'), 'credentials are not in the exported data');
  await sync(B);
  assert.equal(B.S.tasks.length, A.S.tasks.length, 'seed data must not duplicate'); assertConverged(srv, A, B);

  // nothing changed → a sync is one conditional GET, no upload
  const puts = srv.count('PUT'); await sync(A); assert.equal(srv.count('PUT'), puts); 

  // edits flow both ways
  edit(A, () => { A.quickAdd('from A !high', {}); });
  await sync(A, B); assert.ok(titles(B).includes('from A')); assert.equal(getTask(B, 'from A').priority, 3);
  // concurrent edits to different tasks both survive
  edit(A, () => { getTask(A, 'Review pull requests').title = 'Review PRs'; });
  edit(B, () => { getTask(B, 'Plan the sprint').priority = 1; });
  await sync(A, B, A); assert.ok(titles(A).includes('Review PRs') && titles(B).includes('Review PRs')); assert.equal(getTask(A, 'Plan the sprint').priority, 1); assertConverged(srv, A, B);
  // concurrent edits to the SAME task: latest edit wins everywhere
  edit(A, () => { getTask(A, 'Review PRs').title = 'A wrote this'; });
  edit(B, () => { getTask(B, 'Review PRs').title = 'B wrote this'; });
  await sync(A, B, A); assert.ok(titles(A).includes('B wrote this') && titles(B).includes('B wrote this')); assertConverged(srv, A, B);
  // notes (markdown) round-trip untouched
  const md = '# Plan\n- [ ] one\n- [x] two\n\n`code` **bold**';
  edit(A, () => { getTask(A, 'from A').notes = md; }); await sync(A, B); assert.equal(getTask(B, 'from A').notes, md);

  // deletions propagate and stay deleted
  edit(A, () => { A.S.tasks = A.S.tasks.filter(t => t.title !== 'from A'); });
  await sync(A, B, A, B); assert.ok(!titles(A).includes('from A') && !titles(B).includes('from A')); assertConverged(srv, A, B);
  edit(B, () => { getTask(B, 'Plan the sprint').deleted = clock.t; });     // trash (soft delete) syncs as an edit
  await sync(B, A); assert.ok(getTask(A, 'Plan the sprint').deleted);
  // lists + habits
  edit(A, () => { A.S.lists.push({ id: 'l-x', name: 'Errands', color: '#000', sections: [], created: clock.t }); });
  await sync(A, B); assert.ok(B.S.lists.some(l => l.name === 'Errands'));
  edit(A, () => { A.S.habits[0].log['2026-10-07'] = 1; A.S.habits[0].logU = { '2026-10-07': clock.t }; });
  edit(B, () => { B.S.habits[0].log['2026-10-06'] = 1; B.S.habits[0].logU = { '2026-10-06': clock.t }; });
  await sync(A, B, A); assert.equal(Object.keys(A.S.habits[0].log).length, 2); assert.equal(Object.keys(B.S.habits[0].log).length, 2); assertConverged(srv, A, B);
  edit(A, () => { A.S.pomo.push({ ts: clock.t, min: 25, task: null }); }); await sync(A, B); assert.equal(B.S.pomo.length, 1);
  // settings stay per device
  edit(B, () => { B.S.settings.theme = 'dark'; }); await sync(B, A); assert.notEqual(A.S.settings.theme, 'dark');

  // import-style replace propagates removals as well
  const keep = J(B.S); keep.tasks = keep.tasks.slice(0, 2);
  tick(); B.replaceAll(keep); await sync(B, A); assert.equal(A.S.tasks.length, 2); assertConverged(srv, A, B);

  // another device writes between our read and our write: conditional PUT fails with 412, engine re-merges and retries
  const C = device(srv); await sync(C);
  edit(C, () => { C.quickAdd('from C', {}); }); edit(A, () => { A.quickAdd('from A2', {}); });
  srv.beforePut = () => { /* C uploads first, behind A's back */ const f = srv.files.get(FILE), d = JSON.parse(f.body); const c = C.buildPayload(); srv.files.set(FILE, { body: c.text, etag: '"raced"' }); };
  const before = srv.count('PUT'); await sync(A);
  assert.ok(srv.count('PUT') >= before + 2, 'retried after 412'); assert.ok(titles(A).includes('from C') && titles(A).includes('from A2'));
  assert.ok(remote(srv).tasks.some(t => t.title === 'from A2') && remote(srv).tasks.some(t => t.title === 'from C'), 'nothing lost in the race');
  await sync(B, C); assertConverged(srv, A, B, C);

  // two devices that already hold different data merge instead of clobbering
  const srv2 = await davServer({ dirs: ['/dav', '/dav/OpenTick'] });
  try {
    const X = device(srv2), Y = device(srv2);
    edit(X, () => { X.S.tasks = []; X.initSeen(); X.quickAdd('only on X', {}); X.S.tasks.forEach(t => (t.u = 0)); });
    edit(Y, () => { Y.S.tasks = []; Y.initSeen(); Y.quickAdd('only on Y', {}); });
    await sync(X, Y, X); assert.equal(JSON.stringify(titles(X).filter(t => t.startsWith('only'))), '["only on X","only on Y"]'); assert.equal(srv2.count('MKCOL'), 0, 'existing folder is reused');
  } finally { srv2.server.close(); }

  // failures: bad login, foreign file, unreachable server. None may modify local or remote data
  const snapRemote = srv.files.get(FILE).body, snapLocal = JSON.stringify(A.S.tasks);
  const bad = device(srv, { pass: 'nope' }); await bad.syncNow(); assert.equal(bad.Sync.state, 'error'); assert.match(bad.Sync.msg, /rejected the login/);
  const gone = device(srv, { url: 'http://127.0.0.1:1/dav' }); await gone.syncNow(); assert.equal(gone.Sync.state, 'error'); assert.match(gone.Sync.msg, /Could not reach/);
  srv.files.set(FILE, { body: '{"hello":"world"}', etag: '"foreign"' });
  const f1 = device(srv); await f1.syncNow(); assert.equal(f1.Sync.state, 'error'); assert.match(f1.Sync.msg, /not an OpenTick sync file/); assert.equal(srv.files.get(FILE).body, '{"hello":"world"}');
  srv.files.set(FILE, { body: 'not json at all', etag: '"junk"' });
  await f1.syncNow(); assert.match(f1.Sync.msg, /not valid JSON/); assert.equal(srv.files.get(FILE).body, 'not json at all');
  srv.files.set(FILE, { body: JSON.stringify({ app: 'opentick', schema: 99, tasks: [], lists: [] }), etag: '"future"' });
  await f1.syncNow(); assert.match(f1.Sync.msg, /newer OpenTick/);
  srv.files.set(FILE, { body: snapRemote, etag: '"restored"' });
  assert.equal(JSON.stringify(A.S.tasks), snapLocal, 'failed syncs leave local data alone');
  // badge / status text render in every state
  for (const st of ['off', 'busy', 'ok', 'error', 'offline']) { A.Sync.state = st; A.Sync.msg = '<b>x</b>'; assert.ok(A.syncBadge().includes('syncb') && !A.syncBadge().includes('<b>x')); assert.ok(!A.syncStatusText().includes('<b>x')); }

  // folders nested two deep are created level by level
  const srv3 = await davServer();
  try { const N = device(srv3, { folder: 'Apps/Tick' }); await sync(N); assert.equal(srv3.count('MKCOL'), 2); assert.ok(srv3.files.has('/dav/Apps/Tick/opentick.json')); } finally { srv3.server.close(); }
  // servers that don't send ETags still sync (no conditional requests available)
  const srv4 = await davServer({ etags: false, dirs: ['/dav', '/dav/OpenTick'] });
  try { const P = device(srv4), Q = device(srv4); edit(P, () => P.quickAdd('no-etag task', {})); await sync(P, Q); assert.ok(titles(Q).includes('no-etag task')); edit(Q, () => { getTask(Q, 'no-etag task').title = 'renamed'; }); await sync(Q, P); assert.ok(titles(P).includes('renamed')); } finally { srv4.server.close(); }
  // unicode credentials + folder names
  const srv5 = await davServer({ user: 'zoë', pass: 'pässwörd', dirs: ['/dav', '/dav/Tâches'] });
  try { const U = device(srv5, { user: 'zoë', pass: 'pässwörd', folder: 'Tâches' }); await sync(U); assert.ok(srv5.files.has('/dav/Tâches/opentick.json')); } finally { srv5.server.close(); }
} finally { srv.server.close(); }
console.log('sync tests passed');
process.exit(0);
