// Every kind of data you can make travels between two devices through an encrypted sync file, and nothing in the file is readable.
// The list of kinds comes from the app itself (COLL), so a collection added later without being covered here fails this test.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB, clock } from './harness.mjs';
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
  contacts: () => A.ctNormalise({ id: 'ct-sa', name: W('contact'), org: W('org'), emails: [{ l: 'Work', v: 'sa@example.com' }], tags: ['sa'], avail: { days: { 1: [['09:00', '12:00']] }, note: W('availnote') } }),
  csections: () => A.xsNormalise({ id: 'x-sa', name: W('section'), icon: 'book-open', fields: [{ id: 'f1', name: W('field'), type: 'text' }, { id: 'f2', name: 'Status', type: 'select', opts: ['A', 'B'] }] }),
  centries: () => A.xeNormalise({ id: 'xe-sa', sid: 'x-sa', title: W('entry'), vals: { f1: W('value'), f2: 'B' }, contactIds: ['ct-sa'] }),
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
assert.equal(JSON.stringify(B.S.contacts.find(c => c.id === 'ct-sa').avail.days[1]), '[["09:00","12:00"]]', 'available hours arrive intact');
assert.equal(B.S.csections.find(x => x.id === 'x-sa').fields.length, 2); assert.equal(JSON.stringify(B.S.centries.find(e => e.id === 'xe-sa').contactIds), '["ct-sa"]', 'an entry keeps its link to a contact');

// edits and deletions in each collection travel back, still sealed
B.S.zones.find(z => z.id === 'z-sa').name = W('zone2'); B.S.countdowns.find(c => c.id === 'cd-sa').name = W('cd2'); B.S.boards.find(b => b.id === 'b-sa').name = W('board2');
B.S.contacts.find(c => c.id === 'ct-sa').phones = [{ l: 'Mobile', v: W('phone2') }]; B.S.centries.find(e => e.id === 'xe-sa').title = W('entry2'); B.S.csections.find(x => x.id === 'x-sa').name = W('section2');
B.S.templates.splice(0, 1); B.S.tags.splice(0, 1);
B.save(); B.flush(); await B.syncNow(true);
assert.ok(!srv.files.get(FILE).body.includes('SECRET-'), 'what B uploaded is sealed');
await A.syncNow(true);
assert.equal(A.Sync.state, 'ok', A.Sync.msg);
assert.equal(A.S.zones.find(z => z.id === 'z-sa').name, W('zone2'));
assert.equal(A.S.countdowns.find(c => c.id === 'cd-sa').name, W('cd2'));
assert.equal(A.S.boards.find(b => b.id === 'b-sa').name, W('board2'));
assert.equal(A.S.contacts.find(c => c.id === 'ct-sa').phones[0].v, W('phone2')); assert.equal(A.S.centries.find(e => e.id === 'xe-sa').title, W('entry2')); assert.equal(A.S.csections.find(x => x.id === 'x-sa').name, W('section2'));
assert.ok(!A.S.templates.some(t => t.name === W('template')), 'a deleted template is deleted everywhere');
assert.ok(!A.S.tags.some(t => t.id === 't-sa'), 'a deleted tag is deleted everywhere');
// deleting a contact, an entry and a section travels too (a moment later than B's edits, which is what a delete after them means)
clock.t += 60000;
A.S.contacts.splice(0, A.S.contacts.length); A.S.centries.splice(0, A.S.centries.length); A.S.csections.splice(0, A.S.csections.length);
A.save(); A.flush(); await A.syncNow(true); await B.syncNow(true);
assert.equal(B.S.contacts.length + B.S.centries.length + B.S.csections.length, 0, 'deleted contacts, entries and sections are deleted on the other device');
srv.server.close();
console.log('syncall: ok');
