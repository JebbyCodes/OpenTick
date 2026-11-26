// Installed packs follow the person between devices (0.9.1): one synced record per pack (S.packs), with install / switch off / remove / add again.
// Everything runs through the real encrypted sync file between independent app instances. The sections and entries a pack made were already synced; what is
// new is that the PACK is: its name, version, source, and what the person decided about it.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB, clock } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const PASS = 'correct horse battery staple', FILE = '/dav/OpenTick/opentick.json', srv = await davServer();
const dev = (folder = 'OpenTick') => { const a = makeApp({ store: {}, indexedDB: fakeIndexedDB() }); Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder, user: 'me', pass: 'secret' } }); return a; };
const sync = async (...ds) => { for (const d of ds) { await d.syncNow(true); assert.equal(d.Sync.state, 'ok', d.Sync.msg); } };
const J = o => JSON.parse(JSON.stringify(o)), wait = ms => { clock.t += ms; };
const PACK = { opentick: 'pack', format: 1, id: 'reading-demo', name: 'Reading demo', version: '1.2.0', description: 'A test pack', sections: [{ name: 'Books', icon: 'book', fields: [{ key: 'author', name: 'Author', type: 'text' }], entries: [{ title: 'Dune', vals: { author: 'Herbert' } }, { title: 'Emma', vals: { author: 'Austen' } }] }], themes: [] };
const SHA = 'ab'.repeat(32);
// (the harness exports only some names; the rest of the bundle is reached with __run)
const q = v => JSON.stringify(v);
const P = d => ({ set: (id, st) => d.__run(`pksSetState(${q(id)}, ${q(st)})`), remove: (id, del) => d.__run(`pksRemove(${q(id)}, ${!!del})`), hidden: sec => d.__run(`pksHidden(S.csections.find(x => x.id === ${q(sec.id)}))`),
  nav: () => J(d.__run('csecEntries()')), on: id => d.__run(`csecOn(${q(id)})`), html: () => d.__run('pksSettingsHtml()'), needsNewer: i => d.__run(`pksNeedsNewer(S.packs[${i}])`), inst: e => J(d.__run(`pkInstalled(${q(e)})`)),
  // the confirmation modal: answer it like a person would
  ask: async (pack, answer) => { const pr = d.__run(`pksConfirmReinstall(${q({ id: pack.id, name: pack.name })})`); await Promise.resolve(); const m = d.els['#modal'], html = m.innerHTML; m.onclick({ target: { closest: s => (s === '[data-m]' ? { dataset: { m: answer ? 'ok' : 'no' } } : null), classList: { contains: () => false } } }); return { yes: await pr, html }; } });

const A = dev(), B = dev();
await A.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await A.vDrain(); await sync(A);
await B.vaultJoin(JSON.parse(srv.files.get(FILE).body).vault, 'p', PASS, { local: false }); await sync(B);
const secId = d => d.S.csections.find(s => s.packId === 'reading-demo').id, entries = d => d.S.centries.filter(e => e.sid === secId(d)).length;

/* ---- 1. installing on A: a pack record, which another device receives with the data; nothing is invented or fetched ---- */
const { pack } = A.packParse(JSON.stringify(PACK)); wait(5000);
A.packInstall(pack, { kind: 'library', code: 'K7QM-3XRD', sha256: SHA, size: 321 }); A.flush();
const rec = J(A.S.packs.find(r => r.packId === 'reading-demo'));
assert.equal(rec.id, 'pk-reading-demo'); assert.equal(rec.name, 'Reading demo'); assert.equal(rec.version, '1.2.0'); assert.equal(rec.state, 'installed'); assert.equal(rec.format, 1);
assert.deepEqual(rec.source, { kind: 'library', code: 'K7QM-3XRD', sha256: SHA, size: 321 }); assert.equal(rec.dev, A.Sync.cfg.device); assert.equal(rec.sectionIds.length, 1);
await sync(A, B);
const recB = J(B.S.packs.find(r => r.packId === 'reading-demo')); assert.ok(recB, 'the pack is installed on the other device too'); assert.equal(recB.version, '1.2.0'); assert.deepEqual(recB.source, rec.source);
assert.equal(entries(B), 2, 'with its entries'); assert.equal(P(B).nav().length >= 1 && P(B).nav().some(e => e[1] === 'Books'), true, 'and its section in the sidebar');
assert.equal(P(B).inst({ id: 'reading-demo', version: '1.2.0' }).ver, '1.2.0', 'the library shows it as installed on every device'); assert.equal(P(B).inst({ id: 'reading-demo', version: '1.3.0' }).newer, true);
const sealed = srv.files.get(FILE).body; assert.ok(!sealed.includes('reading-demo') && !sealed.includes('K7QM') && !sealed.includes('Herbert'), 'sealed in the cloud file with everything else');
assert.equal(A.S.packs.length, 1, 'one record per pack'); assert.equal(B.S.packs.length, 1);

/* ---- 2. what the person adds to the pack's section on B shows up on A ---- */
wait(3000); B.S.centries.push(J(B.__run(`xeNormalise({ id: uid(), sid: S.csections.find(s => s.packId === 'reading-demo').id, title: 'Ulysses' })`))); B.flush(); await sync(B, A); assert.equal(entries(A), 3);

/* ---- 3. switching a pack off puts its sections away on every device and deletes nothing; switching on brings them back ---- */
wait(3000); assert.equal(P(A).set('reading-demo', 'disabled'), true); A.flush(); await sync(A, B);
assert.equal(B.S.packs[0].state, 'disabled'); assert.equal(P(B).hidden(B.S.csections.find(s => s.packId === 'reading-demo')), true);
assert.ok(!P(B).nav().some(e => e[1] === 'Books'), 'a switched-off pack is not in the sidebar'); assert.equal(P(B).on(secId(B)), false, 'nor reachable as a page'); assert.equal(entries(B), 3, 'nothing was deleted');
const found = d => J(d.__run(`srchGroups('Dune', 'all').flatMap(g => g.rows.map(r => r.label))`)); assert.ok(!found(B).includes('Dune'), 'and not in search');
wait(3000); P(B).set('reading-demo', 'installed'); B.flush(); assert.ok(found(B).includes('Dune'), 'switched on again: found in search'); await sync(B, A); assert.equal(A.S.packs[0].state, 'installed'); assert.ok(P(A).nav().some(e => e[1] === 'Books'));

/* ---- 4. removing keeps everything the person has; the pack is "not installed" everywhere ---- */
wait(3000); assert.ok(await P(A).remove('reading-demo', false)); A.flush(); await sync(A, B);
assert.equal(B.S.packs[0].state, 'removed'); assert.equal(P(B).inst({ id: 'reading-demo', version: '1.2.0' }), null, 'the library no longer shows it as installed');
assert.equal(entries(B), 3, 'the entries stay'); assert.ok(P(B).nav().some(e => e[1] === 'Books'), 'and the section stays, as an ordinary section'); assert.equal(P(B).hidden(B.S.csections[0]), false);
for (let i = 0; i < 3; i++) { await sync(B, A); } assert.equal(A.S.packs.length, 1, 'syncing again does not bring the pack back or duplicate it'); assert.equal(A.S.packs[0].state, 'removed'); assert.equal(B.S.packs[0].state, 'removed');

/* ---- 5. a device that has not heard of the removal cannot bring the pack back by switching it off or on ---- */
const C = dev(); await C.vaultJoin(JSON.parse(srv.files.get(FILE).body).vault, 'p', PASS, { local: false });
// C goes offline having synced when the pack was still installed: here we simulate with D, a device that synced before the removal
const stale = J(B.S.packs[0]); stale.rm = 0; stale.ri = stale.ri; delete stale.state; stale.on = 'installed';
wait(3000); const x = J(B.S.packs[0]); x.on = 'installed'; x.onAt = x.onAt + 50000; x.rm = 0; // a later "switch on" made elsewhere, unaware of the removal
const merged = B.mergeData({ ...B.snapshot(), packs: J(B.S.packs) }, { ...B.snapshot(), packs: [{ ...x, u: x.u + 9999 }] });
assert.equal(merged.packs[0].state, 'removed', 'a later switch-on from a device that has not heard about the removal does not undo it'); assert.equal(merged.packs[0].rm, B.S.packs[0].rm, 'the removal is kept');
const re = B.mergeData({ ...B.snapshot(), packs: J(B.S.packs) }, { ...B.snapshot(), packs: [{ ...x, ri: B.S.packs[0].rm + 5, rm: 0, u: x.u + 9999 }] });
assert.equal(re.packs[0].state, 'installed', 'but a deliberate "add it again" made after the removal does');

/* ---- 6. adding it back and installing again are the person's choice; an install asks first, and the state follows ---- */
wait(3000); assert.equal(P(B).set('reading-demo', 'installed'), true, 'Add it back'); B.flush(); await sync(B, A); assert.equal(A.S.packs[0].state, 'installed'); assert.equal(entries(A), 3);
wait(3000); await P(A).remove('reading-demo', false); A.flush();
const yes = await P(A).ask(pack, true); assert.equal(yes.yes, true); assert.ok(/removed/.test(yes.html) && yes.html.includes('Reading demo'), 'installing a pack that was removed asks first: ' + yes.html.slice(0, 120));
const no = await P(A).ask(pack, false); assert.equal(no.yes, false, 'and the answer no leaves it removed'); assert.equal(A.S.packs[0].state, 'removed');
const before = A.S.csections.length; wait(2000); A.packInstall(pack, { kind: 'file' }); A.flush(); assert.equal(A.S.packs[0].state, 'installed', 'installing it on purpose brings it back'); assert.equal(A.S.packs.length, 1);
assert.equal(A.S.csections.length, before + 1, '(as it always did, a second install makes a second copy of the sections; removing and switching are about the pack)');

/* ---- 7. concurrent changes converge on every device, in any order ---- */
await sync(A, B, A); wait(4000);
P(A).set('reading-demo', 'disabled'); wait(500); P(B).set('reading-demo', 'disabled'); A.flush(); B.flush(); await sync(A, B, A); assert.equal(A.S.packs[0].state, 'disabled'); assert.equal(B.S.packs[0].state, 'disabled');
wait(4000); P(A).set('reading-demo', 'installed'); wait(500); await P(A).remove('reading-demo', false); P(B).set('reading-demo', 'installed'); A.flush(); B.flush();
await sync(B, A, B); assert.equal(A.S.packs[0].state, 'removed', 'a removal and a switch-on made at the same time: the removal stands'); assert.equal(B.S.packs[0].state, 'removed'); assert.equal(J(A.S.packs[0]).rm, J(B.S.packs[0]).rm);
const stable = JSON.stringify(A.S.packs.map(r => [r.id, r.u])); for (let i = 0; i < 3; i++) { await sync(A, B); assert.equal(JSON.stringify(A.S.packs.map(r => [r.id, r.u])), stable, 're-syncing changes nothing'); }
// the merge rule itself: commutative, associative, idempotent
const base = J(A.S.packs[0]), p1 = { ...base, on: 'disabled', onAt: 100, rm: 0, ri: 50, u: 10 }, p2 = { ...base, on: 'installed', onAt: 90, rm: 70, ri: 50, u: 20 }, p3 = { ...base, on: 'installed', onAt: 95, rm: 70, ri: 80, u: 15 };
const mg = (l, r) => J(A.mergeData({ ...A.snapshot(), packs: l, tomb: {} }, { ...A.snapshot(), packs: r, tomb: {} }).packs[0]); const st = o => JSON.stringify({ ...o, u: 0 });
assert.equal(st(mg([p1], [p2])), st(mg([p2], [p1])), 'commutative'); assert.equal(st(mg([mg([p1], [p2])], [p3])), st(mg([p1], [mg([p2], [p3])])), 'associative'); assert.equal(st(mg([mg([p1], [p2])], [p2])), st(mg([p1], [p2])), 'idempotent');
assert.ok(mg([p1], [p2]).u > Math.max(p1.u, p2.u) || st(mg([p1], [p2])) === st(p2) || st(mg([p1], [p2])) === st(p1), 'a merged record that differs from both gets a newer stamp');

/* ---- 8. removing AND deleting the data is a separate, explicit choice with a restore point; the deletion syncs ---- */
const D = dev('F8'), E = dev('F8'); await sync(D); await sync(E);
D.packInstall(D.packParse(JSON.stringify(PACK)).pack); D.flush(); await sync(D, E); assert.equal(E.S.csections.length, 1);
assert.ok(await P(D).remove('reading-demo', true), 'removed with its data'); D.flush(); assert.equal(D.S.csections.length, 0); assert.equal(D.S.centries.length, 0);
await sync(D, E); assert.equal(E.S.csections.length, 0, 'the deletion reaches the other device'); assert.equal(E.S.centries.length, 0); assert.equal(E.S.packs[0].state, 'removed');
assert.ok((await D.__run('snapList()')).some(s => /before-pack-delete/.test(JSON.stringify(s))), 'a restore point was made first');

/* ---- 9. packs made before 0.9.1 (sections with a packId and no record) get one, the same on every device ---- */
const F = dev('F9'), G = dev('F9'); await sync(F); await sync(G);
for (const d of [F, G]) d.S.csections.push(J(d.__run(`xsNormalise({ id: 'cs-old', name: 'Old pack section', pack: 'Old pack', packId: 'old-pack', packVer: '0.9.0', created: 1700000000000 })`)));
F.flush(); G.flush(); const fr = J(F.S.packs.find(r => r.packId === 'old-pack')), gr = J(G.S.packs.find(r => r.packId === 'old-pack'));
assert.ok(fr && gr); assert.equal(fr.version, '0.9.0'); assert.equal(fr.state, 'installed'); assert.deepEqual({ ...fr, u: 0 }, { ...gr, u: 0 }, 'both devices describe it identically');
await sync(F, G, F); assert.equal(F.S.packs.filter(r => r.packId === 'old-pack').length, 1); assert.equal(G.S.packs.filter(r => r.packId === 'old-pack').length, 1);

/* ---- 10. a pack that needs a newer format is kept untouched and says so ---- */
const H = dev('F10'); H.S.packs.push({ id: 'pk-future', packId: 'future', name: 'Future pack', version: '9.0.0', format: 99 - 1, source: { kind: 'file' }, on: 'installed', onAt: 5, rm: 0, ri: 5, sectionIds: [], themes: [], installedAt: 5, dev: 'x' }); H.flush();
assert.equal(P(H).needsNewer(0), true); const html = P(H).html(); assert.ok(/needs a newer OpenTick/.test(html) && html.includes('Future pack'), 'the settings list says so'); assert.equal(H.S.packs[0].version, '9.0.0', 'and keeps the record as it was');
// invalid records are dropped when loaded
H.S.packs.push({ id: 'pk-', packId: '', name: 'bad' }, { id: 'x', packId: 'Bad Id!' }); H.__run('migrate(S)'); assert.equal(H.S.packs.length, 1, 'records that are not packs are dropped');

srv.server.close();
console.log('pack state tests passed (install record, sync, switch off/on, remove keeps data, removal stands, add again, delete data, adoption, format)');
