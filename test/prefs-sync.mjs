// User preferences follow the person (0.9.1). Before, S.settings was entirely per device: a theme, quiet hours or the clock format had to be set again on every
// device. Now an allow-list of the settings (PREF_SYNC in core.js) travels as the sealed `prefs` collection; what describes a DEVICE stays on it.
// Everything here runs through the real encrypted sync file between independent app instances.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB, clock } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const PASS = 'correct horse battery staple', FILE = '/dav/OpenTick/opentick.json', srv = await davServer();
const dev = (folder = 'OpenTick') => { const a = makeApp({ store: {}, indexedDB: fakeIndexedDB() }); Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder, user: 'me', pass: 'secret' } }); return a; };
const sync = async (...ds) => { for (const d of ds) { await d.syncNow(true); assert.equal(d.Sync.state, 'ok', d.Sync.msg); } };
const J = o => JSON.parse(JSON.stringify(o));
const wait = ms => { clock.t += ms; };

const A = dev(), B = dev();
await A.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await A.vDrain(); await sync(A);
await B.vaultJoin(JSON.parse(srv.files.get(FILE).body).vault, 'p', PASS, { local: false }); await sync(B);
const DEFAULT_THEME = A.__get('DEFAULT_THEME');

/* ---- 0. nothing is invented: a device that never changed a preference has no preference records ---- */
assert.deepEqual(J(A.S.prefs), [], 'untouched preferences have no records (so a new device can never overwrite your choices with its defaults)');
assert.equal(B.S.settings.theme, DEFAULT_THEME);

/* ---- 1. choices made on A arrive on B; device-specific ones do not ---- */
wait(5000);
A.S.settings.theme = 'nord'; A.S.settings.quiet = { on: true, from: '21:30', to: '06:45' }; A.S.settings.a11y.contrast = true; A.S.settings.a11y.dys = true;
A.S.settings.clock.h24 = true; A.S.settings.tasks.defPrio = 2; A.S.settings.weekStart = 3;
// device-specific on A: layout, services, vibration, view state, the recording switch, the pixel width of a Gantt column
A.S.settings.ui.sideW = 411; A.S.settings.a11y.tactile = true; A.S.settings.svc.on = false; A.S.settings.cal.view = 'week'; A.S.settings.gantt.nameW = 333; A.S.settings.history.on = true; A.S.settings.bridge.on = true; A.S.settings.eink.mode = 'on'; A.S.settings.notes.scope = 'x'; A.S.settings.tt.view = 'day'; A.S.settings.pomo.faceDown = true;
A.flush(); await sync(A, B);
for (const [k, v] of [['theme', 'nord'], ['quiet', { on: true, from: '21:30', to: '06:45' }], ['weekStart', 3]]) assert.deepEqual(J(B.S.settings[k]), v, k + ' arrived on the other device');
assert.equal(B.S.settings.a11y.contrast, true); assert.equal(B.S.settings.a11y.dys, true); assert.equal(B.S.settings.clock.h24, true); assert.equal(B.S.settings.tasks.defPrio, 2);
assert.equal(B.S.settings.ui.sideW, 300, 'the width of the sidebar belongs to the device'); assert.equal(B.S.settings.a11y.tactile, false, 'vibration belongs to the device');
assert.equal(B.S.settings.svc.on, true); assert.equal(B.S.settings.cal.view, 'month'); assert.equal(B.S.settings.gantt.nameW, 290); assert.equal(B.S.settings.history.on, false); assert.equal(B.S.settings.bridge.on, false);
assert.equal(B.S.settings.eink.mode, 'auto'); assert.equal(B.S.settings.notes.scope, ''); assert.equal(B.S.settings.tt.view, 'week'); assert.equal(B.S.settings.pomo.faceDown, false);
assert.deepEqual(J(B.S.prefs.map(r => r.key).sort()), J(A.S.prefs.map(r => r.key).sort()), 'the same records on both');
for (const r of A.S.prefs) assert.ok(!['ui', 'svc', 'bridge', 'eink', 'history', 'cal', 'upd', 'bg', 'watch'].includes(r.key), 'a device setting never has a record: ' + r.key);
assert.ok(!('tactile' in A.S.prefs.find(r => r.key === 'a11y').value) && !('nameW' in (A.S.prefs.find(r => r.key === 'gantt') || { value: {} }).value), 'and device sub-keys are not in the record');
const sealed = srv.files.get(FILE).body;
assert.ok(!sealed.includes('pf-theme') && !sealed.includes('nord') && !sealed.includes('21:30'), 'sealed with everything else: nothing readable in the cloud file'); assert.equal(JSON.parse(sealed).prefs, undefined);

/* ---- 2. the newest change wins, in both directions, and syncing again changes nothing ---- */
wait(5000); B.S.settings.theme = 'dracula'; B.flush(); await sync(B, A); assert.equal(A.S.settings.theme, 'dracula', 'a later change on B reaches A');
wait(5000); A.S.settings.theme = 'light'; A.flush(); wait(1000); B.S.settings.theme = 'dark'; B.flush(); // both change it while apart: the later one is kept on both
await sync(A, B, A); assert.equal(A.S.settings.theme, 'dark'); assert.equal(B.S.settings.theme, 'dark');
const settled = JSON.stringify(A.S.prefs.map(r => [r.id, r.u])); for (let i = 0; i < 3; i++) { await sync(B, A); assert.equal(JSON.stringify(A.S.prefs.map(r => [r.id, r.u])), settled, 're-syncing does not rewrite records'); }
// a change to one sub-key of a group does not touch the sub-keys this device keeps for itself
B.S.settings.a11y.tactile = true; B.S.settings.a11y.bold = true; B.flush(); await sync(B, A); assert.equal(A.S.settings.a11y.bold, true); assert.equal(A.S.settings.a11y.tactile, true, 'A kept its own vibration choice (it was on already)');
A.S.settings.a11y.tactile = false; A.flush(); await sync(A, B); assert.equal(B.S.settings.a11y.tactile, true, 'and A turning its own vibration off does not turn it off on B');

/* ---- 3. a device that joins later with factory settings receives your choices and never overwrites them ---- */
const C = dev(); await C.vaultJoin(JSON.parse(srv.files.get(FILE).body).vault, 'p', PASS, { local: false });
assert.equal(C.S.settings.theme, DEFAULT_THEME, 'a new device starts with the defaults'); await sync(C);
assert.equal(C.S.settings.theme, 'dark'); assert.equal(C.S.settings.quiet.on, true); assert.equal(C.S.settings.weekStart, 3);
await sync(A, B, C, A); for (const d of [A, B, C]) { assert.equal(d.S.settings.theme, 'dark'); assert.equal(d.S.settings.quiet.from, '21:30'); assert.equal(d.S.settings.a11y.contrast, true); }

/* ---- 4. a preference put back to its default is a change like any other; the receiver applies the screen effects ---- */
wait(5000); A.S.settings.theme = DEFAULT_THEME; A.S.settings.quiet.on = false; A.flush(); assert.ok(A.S.prefs.some(r => r.key === 'theme'), 'the record stays, now holding the default');
let applied = 0; B.__run('globalThis.__themeCalls = 0'); await sync(A, B); assert.equal(B.S.settings.theme, DEFAULT_THEME); assert.equal(B.S.settings.quiet.on, false);

/* ---- 5. what a remote record may and may not do ---- */
const evil = J(A.snapshot()); const bad = (id, key, value) => { evil.prefs = evil.prefs.filter(r => r.id !== id); evil.prefs.push({ id, key, value, u: clock.t + 1 }); };
bad('pf-a11y', 'a11y', { contrast: false, tactile: true, hackedKey: 1 });         // reaches a device-only sub-key
bad('pf-ui', 'ui', { sideW: 1 });                                                 // a key that is not on the allow-list
bad('pf-theme', 'theme', { not: 'a string' });                                    // the wrong shape for that preference
bad('pf-weekStart', 'weekStart', 'tuesday');                                      // the wrong type
bad('pf-x', 'nope', 5); bad('pf-other', 'theme', 'nord');                         // an unknown key; an id that does not match its key
const before = J(B.S.settings); B.applyMerged(B.mergeData(B.snapshot(), evil));
assert.equal(B.S.settings.a11y.tactile, true, 'unchanged (B had it on already)'); assert.equal(B.S.settings.a11y.contrast, false, 'the allowed sub-key of that record was applied'); assert.equal(B.S.settings.ui.sideW, before.ui.sideW, 'a device key is not reachable from a record');
assert.equal(B.S.settings.theme, DEFAULT_THEME, 'a value of the wrong shape is ignored'); assert.equal(B.S.settings.weekStart, 3, 'a value of the wrong type is ignored'); assert.equal(B.S.settings.hackedKey, undefined, 'no new keys appear in the settings');
assert.ok(!B.S.prefs.some(r => ['pf-ui', 'pf-x', 'pf-other'].includes(r.id)), 'records that are not valid preferences are dropped on load');
B.flush(); assert.ok(B.S.prefs.find(r => r.key === 'theme') && typeof B.S.prefs.find(r => r.key === 'theme').value === 'string', 'and a record of the wrong shape is repaired from the real setting');

/* ---- 6. deleting the settings (Delete everything + reset settings) resets them on the other devices too ---- */
await sync(B, A, C); assert.equal(A.S.settings.clock.h24, true);
wait(5000); await A.wipeAll({ settings: true, files: false }); assert.equal(A.S.settings.clock.h24, false, 'the device that reset has its defaults'); assert.deepEqual(J(A.S.prefs), [], 'and no records');
await sync(A, B, C); for (const d of [B, C]) { assert.equal(d.S.settings.clock.h24, false, 'a reset is a deliberate deletion: it reaches the other devices'); assert.equal(d.S.settings.a11y.contrast, false); assert.equal(d.S.settings.weekStart, A.S.settings.weekStart); }
assert.equal(B.S.settings.ui.sideW, 300); assert.equal(B.S.settings.a11y.tactile, true, 'device-specific choices survive the reset of the synced ones');
// and a choice made afterwards starts a new record that is not swallowed by the old deletion
wait(2000); C.S.settings.theme = 'nord'; C.flush(); await sync(C, A, B); assert.equal(A.S.settings.theme, 'nord'); assert.equal(B.S.settings.theme, 'nord');

/* ---- 7. "Delete everything" WITHOUT resetting settings keeps them, and a backup carries them ---- */
wait(2000); B.S.settings.quiet = { on: true, from: '20:00', to: '05:00' }; B.flush(); await B.wipeAll({ settings: false, files: false }); assert.equal(B.S.settings.quiet.from, '20:00', 'settings kept');
await sync(B, A); assert.equal(A.S.settings.quiet.from, '20:00', 'and still shared');
const backup = JSON.parse(JSON.stringify(B.S)); assert.ok(backup.prefs.some(r => r.key === 'quiet'), 'the backup file includes the preference records');
const D = dev('F7'); D.replaceAll(backup); assert.equal(D.S.settings.quiet.from, '20:00', 'restoring a backup restores the preferences'); assert.ok(D.S.prefs.some(r => r.key === 'quiet'));

srv.server.close();
console.log('preferences sync tests passed (allow-list, device-specific kept local, newest wins, new devices do not overwrite, hostile records, reset propagation, backups)');
