// Every kind of data you can make travels between two devices through an encrypted sync file, and nothing in the file is readable.
// The list of kinds comes from the app itself (COLL), so a collection added later without being covered here fails this test.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const PASS = 'correct horse battery staple', FILE = '/dav/OpenTick/opentick.json';
const makeDev = () => { const a = makeApp({ store: {}, indexedDB: fakeIndexedDB() }); return a; };
const srv = await davServer();
const link = a => Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder: 'OpenTick', user: 'me', pass: 'secret' } });
const W = s => 'SECRET-' + s + '-4c1e'; // a word that must never show up in the sync file

const A = makeDev(); link(A);
const mk = {
  tasks: () => A.newTask({ title: W('task') }),
  lists: () => ({ id: 'l-sa', name: W('list'), color: '#4772fa', sections: [], created: 1 }),
  habits: () => ({ id: 'h-sa', name: W('habit'), icon: '🏃', color: '#fff', log: {} }),
  tags: () => ({ id: 't-sa', name: W('tag'), color: '#e5484d' }),
  slots: () => ({ id: 'sl-sa', title: W('slot'), days: [1], start: '08:00', end: '09:00', color: '#4772fa', loc: '', notes: '', remind: null }),
  notes: () => A.newNote({ title: W('note'), body: W('notebody') }),
  projects: () => ({ id: 'p-sa', name: W('project'), color: '#f00', listIds: [], created: 1 }),
  school: () => ({ id: 'su-sa', k: 'subject', name: W('subject'), color: '#e5484d', icon: 'calculator', room: 'R1' }),
  templates: () => A.newTemplate({ name: W('template'), body: W('tplbody') }),
  countdowns: () => A.cdNormalise({ id: 'cd-sa', name: W('countdown'), date: '2030-01-01', time: '10:00' }),
  zones: () => ({ id: 'z-sa', name: W('zone'), tz: 'Asia/Tokyo' }),
  boards: () => ({ ...A.kbNewBoard(W('board')), id: 'b-sa' }),
};
assert.deepEqual(Object.keys(mk).sort(), [...A.COLL].sort(), 'every synced collection is covered by this test');
for (const c of A.COLL) { const o = mk[c](); A.S[c].push(o); }
A.save(); A.flush();
await A.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await A.vDrain();
await A.syncNow(true);
assert.equal(A.Sync.state, 'ok', A.Sync.msg);
const body = srv.files.get(FILE).body, env = JSON.parse(body);
assert.equal(env.enc, 1, 'the cloud file is sealed');
for (const c of A.COLL) assert.equal(env[c], undefined, c + ' is not stored in the clear');
assert.ok(!body.includes('SECRET-'), 'no readable trace of any collection in the cloud file');
assert.ok(!body.includes('Tokyo'), 'time zone names are sealed too');

// a second device joins with the passphrase and receives every kind of data
const B = makeDev(); link(B);
await B.vaultJoin(env.vault, 'p', PASS, { local: false });
await B.syncNow(true);
assert.equal(B.Sync.state, 'ok', B.Sync.msg);
for (const c of A.COLL) assert.ok(B.S[c].some(o => JSON.stringify(o).includes('SECRET-')), c + ' arrived on the second device');
assert.equal(B.S.zones.find(z => z.id === 'z-sa').tz, 'Asia/Tokyo');
assert.equal(B.S.countdowns.find(c => c.id === 'cd-sa').date, '2030-01-01');
assert.equal(B.S.boards.find(b => b.id === 'b-sa').cols.length, A.S.boards.find(b => b.id === 'b-sa').cols.length);

// edits and deletions in each collection travel back, still sealed
B.S.zones.find(z => z.id === 'z-sa').name = W('zone2'); B.S.countdowns.find(c => c.id === 'cd-sa').name = W('cd2'); B.S.boards.find(b => b.id === 'b-sa').name = W('board2');
B.S.templates.splice(0, 1); B.S.tags.splice(0, 1);
B.save(); B.flush(); await B.syncNow(true);
assert.ok(!srv.files.get(FILE).body.includes('SECRET-'), 'what B uploaded is sealed');
await A.syncNow(true);
assert.equal(A.Sync.state, 'ok', A.Sync.msg);
assert.equal(A.S.zones.find(z => z.id === 'z-sa').name, W('zone2'));
assert.equal(A.S.countdowns.find(c => c.id === 'cd-sa').name, W('cd2'));
assert.equal(A.S.boards.find(b => b.id === 'b-sa').name, W('board2'));
assert.ok(!A.S.templates.some(t => t.name === W('template')), 'a deleted template is deleted everywhere');
assert.ok(!A.S.tags.some(t => t.id === 't-sa'), 'a deleted tag is deleted everywhere');
srv.server.close();
console.log('syncall: ok');
