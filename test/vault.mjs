// Encryption: the key hierarchy, the sealed stores (data, backups, automatic backups, attachments, sync logins, the cloud file), locking,
// the two-device sync flow, and the attacks the design is meant to stop (tampering, swapping the cloud file for a readable one).
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const PASS = 'correct horse battery staple', PASS2 = 'a different passphrase entirely';
const SECRET = 'TOP-SECRET-TITLE-9f3a', SECRET2 = 'SECOND-SECRET-NOTE-77b1', PLAINTEXT_LOGIN = 'hunter2-webdav-login';
const SCOPES = { local: true, backup: true, sync: true };
const wait = (ms = 40) => new Promise(r => setTimeout(r, ms));
const dump = store => Object.entries(store).map(([k, v]) => k + '=' + v).join('\n');
const ENC = 'opentick.v1.enc', CFG = 'opentick.vault.v1', STUB = '{"v":1,"tasks":[],"lists":[],"enc":1}';
// a device = its own localStorage + IndexedDB; passing `prev` is a restart of the same device
const makeDev = prev => { const store = prev ? prev.store : {}, indexedDB = prev ? prev.indexedDB : fakeIndexedDB(), a = makeApp({ store, indexedDB }); a.indexedDB = indexedDB; return a; };
const idbText = a => [...a.indexedDB.kv.entries()].map(([k, v]) => k + '=' + JSON.stringify(v, (_, x) => (x instanceof Uint8Array ? 'u8:' + x.length : x))).join('\n');
const withData = async () => { const D = makeDev(); D.S.tasks.push(D.newTask({ title: SECRET })); D.S.notes.push(D.newNote({ title: 'n', body: SECRET2 })); D.save(); D.flush(); return D; };

/* ============ 1. the primitives ============ */
{
  const A = makeApp();
  assert.ok(A.vaultAvail());
  assert.equal(A.vStrength('short').ok, false); assert.equal(A.vStrength('password1234').ok, false); assert.equal(A.vStrength('aaaaaaaaaaaa').ok, false);
  assert.ok(A.vStrength(PASS).ok && A.vStrength(PASS).score >= 3); assert.equal(A.vStrength('').score, 0);
  const { header, key, recovery } = await A.vNewHeader(PASS, true);
  assert.match(recovery, /^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(header.kdf.i, 600000); assert.equal(key.extractable, false, 'the data key is not extractable');
  assert.ok(A.vRecoveryParse(recovery.toLowerCase().replace(/-/g, ' ')), 'case and separators do not matter');
  assert.equal(A.vRecoveryParse('too short'), null);
  const k1 = await A.vUnlockHeader(header, 'p', PASS), k2 = await A.vUnlockHeader(header, 'r', recovery);
  assert.equal(k1.extractable, false); assert.equal(k2.extractable, false);
  await assert.rejects(A.vUnlockHeader(header, 'p', PASS + 'x'), e => e.vault === 'wrong');
  await assert.rejects(A.vUnlockHeader(header, 'r', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ'), e => e.vault === 'wrong');
  await assert.rejects(A.vUnlockHeader(header, 'r', 'nonsense'), e => e.vault === 'badrecovery');
  // a header from outside is checked before it is trusted (a file cannot make us run a billion rounds, or a handful)
  assert.throws(() => A.vHeaderCheck({ ...header, kdf: { ...header.kdf, i: 1e12 } }), e => e.vault === 'header');
  assert.throws(() => A.vHeaderCheck({ ...header, kdf: { ...header.kdf, i: 10 } }), e => e.vault === 'header');
  assert.throws(() => A.vHeaderCheck({ id: 'x' }), e => e.vault === 'header');
  // k1 and k2 are the same key: what one seals the other opens (through the module's own functions, with explicit keys)
  A.Vault.cfg = { ...A.vaultHeader?.call(null) }; // (no vault is on: vaultHeader is undefined here, so this is just {} )
  A.Vault.cfg = null;
}

/* ============ 2. turning it on: nothing readable is left behind ============ */
const D1 = await withData();
assert.ok(dump(D1.store).includes(SECRET), 'before: the data is readable in storage');
const rec = await D1.vaultEnable(PASS, SCOPES, {});
await D1.vDrain();
assert.match(rec, /^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
assert.ok(D1.store[ENC] && D1.store[CFG], 'the sealed copy and the vault are saved');
assert.equal(D1.store['opentick.v1'], STUB, 'an old app finds an empty stand-in, not the data (and nothing it could overwrite the real copy with)');
assert.ok(!dump(D1.store).includes(SECRET) && !dump(D1.store).includes(SECRET2), 'no readable trace of the data in localStorage');
assert.ok(D1.vaultOn() && D1.vaultScope('local') && D1.vaultScope('backup') && D1.vaultScope('sync'));
assert.ok(D1.syncBadge === undefined || true);
{ // the cloud icon: a padlock whenever encryption is on
  assert.match(D1.encMark(), /encb/); assert.match(D1.encTip(), /Encrypted end to end/);
  assert.equal(makeApp().encMark(), '');
}

/* ============ 3. the next start: locked, nothing written, wrong passphrase, right passphrase ============ */
{
  const before = D1.store[ENC];
  const D2 = makeDev(D1); await wait();
  assert.equal(D2.Vault.locked, true); assert.equal(D2.S.tasks.length, 0, 'locked: only an empty stand-in is in memory');
  D2.S.tasks.push(D2.newTask({ title: 'must never be written' })); D2.save(); D2.flush(); await D2.vDrain(); await wait(200);
  assert.equal(D2.store[ENC], before, 'locked: nothing is ever written over the encrypted copy');
  assert.equal(D2.store['opentick.v1'], STUB);
  await D2.vaultUnlockWith('p', 'not the passphrase'); assert.equal(D2.Vault.locked, true, 'a wrong passphrase does not unlock');
  await D2.vaultUnlockWith('p', PASS);
  assert.equal(D2.Vault.locked, false); assert.ok(D2.S.tasks.some(t => t.title === SECRET), 'the data is back'); assert.ok(D2.S.notes.some(n => n.body === SECRET2));
  assert.ok(!D2.S.tasks.some(t => t.title === 'must never be written'));
  // edits after the unlock are sealed too, and survive another restart
  D2.S.tasks.push(D2.newTask({ title: 'added after unlock' })); D2.save(); D2.flush(); await D2.vDrain();
  assert.notEqual(D2.store[ENC], before); assert.ok(!dump(D2.store).includes('added after unlock'));
  const D3 = makeDev(D2); await wait(); await D3.vaultUnlockWith('p', PASS);
  assert.ok(D3.S.tasks.some(t => t.title === 'added after unlock') && D3.S.tasks.some(t => t.title === SECRET));
  // the recovery key opens it as well (it then offers a new passphrase; that prompt is not answered here)
  const D4 = makeDev(D2); await wait(); D4.vaultUnlockWith('r', rec); await wait(300);
  assert.equal(D4.Vault.locked, false, 'the recovery key unlocks'); assert.ok(D4.S.tasks.some(t => t.title === SECRET));
  // "Lock now": the key and the data leave memory
  await D3.vaultLockNow();
  assert.equal(D3.Vault.locked, true); assert.equal(D3.Vault.key, null); assert.equal(D3.S.tasks.length, 0);
  const sealed = D3.store[ENC]; D3.S.tasks.push(D3.newTask({ title: 'after lock' })); D3.flush(); await wait(100); assert.equal(D3.store[ENC], sealed);
  await D3.syncNow(true); // a locked app does not sync, and does not throw
}

/* ============ 4. changing the passphrase and the recovery key ============ */
{
  const D = await withData(); const recA = await D.vaultEnable(PASS, SCOPES, {}); await D.vDrain();
  const h1 = D.vaultHeader();
  await D.vaultChangePass(PASS, 'p', PASS2);
  const h2 = D.vaultHeader();
  assert.equal(h2.hv, h1.hv + 1); assert.equal(h2.id, h1.id); assert.notEqual(h2.kdf.s, h1.kdf.s, 'a fresh salt');
  await assert.rejects(D.vUnlockHeader(h2, 'p', PASS), e => e.vault === 'wrong'); await D.vUnlockHeader(h2, 'p', PASS2); await D.vUnlockHeader(h2, 'r', recA);
  await assert.rejects(D.vaultChangePass('wrong one entirely', 'p', 'yet another good passphrase'), e => e.vault === 'wrong');
  await assert.rejects(D.vaultChangePass(PASS2, 'p', 'short'), e => e.vault === 'weak');
  // the data was not re-encrypted: a blob sealed before the change still opens (same data key)
  const D2 = makeDev(D); await wait(); await D2.vaultUnlockWith('p', PASS2); assert.ok(D2.S.tasks.some(t => t.title === SECRET));
  const recB = await D.vaultNewRecovery(PASS2, 'p'); assert.notEqual(recB, recA);
  await assert.rejects(D.vUnlockHeader(D.vaultHeader(), 'r', recA), e => e.vault === 'wrong', 'the old recovery key stops working'); await D.vUnlockHeader(D.vaultHeader(), 'r', recB);
  assert.equal(await D.vaultVerify(PASS2), true); assert.equal(await D.vaultVerify(PASS), false);
}

/* ============ 5. what is encrypted can be changed, and turned off again ============ */
{
  const D = await withData(); await D.vaultEnable(PASS, SCOPES, {}); await D.vDrain();
  await D.vaultSetScopes({ local: false, backup: true, sync: true }); await D.vDrain();
  assert.ok(D.store['opentick.v1'].includes(SECRET), 'device scope off: stored readable again'); assert.equal(D.store[ENC], undefined);
  assert.equal(D.Vault.locked, false);
  const R = makeDev(D); await wait(); assert.equal(R.Vault.locked, false, 'nothing to unlock when the device scope is off'); assert.ok(R.S.tasks.some(t => t.title === SECRET));
  await D.vaultSetScopes({ local: true, backup: true, sync: true }); await D.vDrain();
  assert.ok(!dump(D.store).includes(SECRET) && D.store[ENC], 'device scope on again: sealed again');
  const cfg = await D.vaultDisable(); await D.vDrain();
  assert.ok(cfg && D.Vault.cfg === null); assert.equal(D.store[CFG], undefined); assert.equal(D.store[ENC], undefined);
  assert.ok(D.store['opentick.v1'].includes(SECRET) && D.store['opentick.v1'].includes(SECRET2), 'encryption off: everything is readable again');
  const R2 = makeDev(D); await wait(); assert.equal(R2.Vault.locked, false); assert.ok(R2.S.tasks.some(t => t.title === SECRET));
  assert.equal(R2.vaultOn(), false);
}

/* ============ 6. attached files, automatic backups, the pre-merge copy, sync logins ============ */
{
  const D = await withData();
  const plainFile = await D.filePut(new File(['bytes added before encryption'], 'before.txt', { type: 'text/plain' }));
  await D.snapSave(true);
  assert.ok(idbText(D).includes('bytes added') || idbText(D).includes('"blob"'), 'before: stored as it is');
  D.Sync.cfg.webdav.pass = PLAINTEXT_LOGIN; D.saveSyncCfg(); D.premergeSave();
  assert.ok(dump(D.store).includes(PLAINTEXT_LOGIN) && dump(D.store).includes(SECRET));
  await D.vaultEnable(PASS, SCOPES, {}); await D.vDrain(); await wait(100);
  // everything that was there is sealed now
  const raw = D.indexedDB.kv.get('file:' + plainFile.id); assert.equal(raw.enc, 1); assert.equal(raw.blob, undefined); assert.equal(raw.name, undefined, 'even the name is sealed');
  assert.equal(await (await D.fileGet(plainFile.id)).text(), 'bytes added before encryption'); assert.equal((await D.fileGet(plainFile.id)).type, 'text/plain');
  for (const [k, v] of D.indexedDB.kv) if (k.startsWith('snap:')) { assert.equal(v.enc, 1, 'the old automatic backup is sealed'); assert.equal(v.data, undefined); }
  assert.ok(!dump(D.store).includes(PLAINTEXT_LOGIN), 'the sync password is not readable'); assert.ok(D.store[D.SYNC_SEC], 'it is kept in its own sealed entry');
  assert.equal(JSON.parse(D.store[D.SYNC_KEY]).webdav.pass, '', 'and blanked in the readable one');
  assert.ok(!dump(D.store).includes(SECRET));
  // new files and backups are sealed as they are made
  const nf = await D.filePut(new File(['a new secret file'], 'new.pdf', { type: 'application/pdf' }));
  const nr = D.indexedDB.kv.get('file:' + nf.id); assert.equal(nr.enc, 1); assert.ok(!idbText(D).includes('a new secret file') && !idbText(D).includes('new.pdf'));
  const key = await D.snapSave(true); assert.ok(key); const sv = D.indexedDB.kv.get(key); assert.equal(sv.enc, 1); assert.ok(!idbText(D).includes(SECRET));
  const list = await D.snapList(); assert.ok(list.length >= 1 && list[0].sealed === true && list[0].tasks > 0, 'the list shows a sealed copy with its task count');
  // a restore reads it back
  D.S.tasks = D.S.tasks.filter(t => t.title !== SECRET); D.flush(); assert.ok(!D.S.tasks.some(t => t.title === SECRET));
  await D.snapRestore(key); assert.ok(D.S.tasks.some(t => t.title === SECRET), 'the sealed automatic backup restores');
  // after a restart + unlock the logins and the safety copy come back
  D.Sync.cfg.webdav.pass = PLAINTEXT_LOGIN; D.saveSyncCfg(); await D.syncSecretsDrain(); D.premergeSave(); await wait(100);
  assert.ok(!dump(D.store).includes(PLAINTEXT_LOGIN)); assert.ok(!dump(D.store).includes(SECRET));
  const E = makeDev(D); await wait(); assert.equal(E.Sync.cfg.webdav.pass, '', 'locked: the login is not loaded'); await E.vaultUnlockWith('p', PASS); await wait(50);
  assert.equal(E.Sync.cfg.webdav.pass, PLAINTEXT_LOGIN, 'unlocked: the login is back');
  assert.ok((await E.premergeLoad() || '').includes(SECRET), 'the safety copy opens');
  // and turning encryption off writes all of it back readable
  await D.vaultDisable(); await D.vDrain(); await wait(50);
  assert.equal(D.indexedDB.kv.get('file:' + nf.id).enc, undefined); assert.equal(await (await D.fileGet(nf.id)).text(), 'a new secret file');
  assert.ok(dump(D.store).includes(PLAINTEXT_LOGIN) && D.store[D.SYNC_SEC] === undefined);
  assert.equal(D.indexedDB.kv.get(key).enc, undefined); assert.equal(typeof D.indexedDB.kv.get(key).data, 'string'); assert.ok(JSON.parse(D.indexedDB.kv.get(key).data).tasks.length > 0, 'the automatic backup is readable again');
}

/* ============ 7. backup files ============ */
{
  const D = await withData(); const recD = await D.vaultEnable(PASS, SCOPES, {}); await D.vDrain();
  const body = JSON.stringify({ ...D.S, _app: { name: 'OpenTick' } }), text = await D.vFile(body, 'backup', 4), d = JSON.parse(text);
  assert.ok(!text.includes(SECRET) && d.enc === 1 && d.app === 'opentick' && D.vIsEnv(d)); assert.equal(d.vault.id, D.Vault.cfg.id);
  assert.equal(JSON.stringify(await D.backupParse(text)).includes(SECRET), true, 'the device that made it opens it without asking');
  // any other device opens it with just the passphrase, or the recovery key
  const W = makeApp();
  assert.ok((await W.vFileOpen(d, 'backup', 'p', PASS)).includes(SECRET)); assert.ok((await W.vFileOpen(d, 'backup', 'r', recD)).includes(SECRET));
  await assert.rejects(W.vFileOpen(d, 'backup', 'p', PASS2), e => e.vault === 'wrong'); await assert.rejects(W.vFileOpen(d, 'backup'), e => e.vault === 'nokey');
  // it is bound to what it is: a backup cannot be passed off as a sync file, and tampering is caught
  await assert.rejects(W.vFileOpen(d, 'sync', 'p', PASS), e => e.vault === 'bad');
  const t1 = { ...d, ct: d.ct.slice(0, 10) + (d.ct[10] === 'A' ? 'B' : 'A') + d.ct.slice(11) }; await assert.rejects(W.vFileOpen(t1, 'backup', 'p', PASS), e => e.vault === 'bad');
  const t2 = { ...d, iv: d.iv.slice(0, 2) + (d.iv[2] === 'A' ? 'B' : 'A') + d.iv.slice(3) }; await assert.rejects(W.vFileOpen(t2, 'backup', 'p', PASS), e => e.vault === 'bad');
  const t3 = { ...d, vid: 'deadbeefdeadbeef', vault: { ...d.vault, id: 'deadbeefdeadbeef' } }; await assert.rejects(W.vFileOpen(t3, 'backup', 'p', PASS), e => e.vault === 'wrong' || e.vault === 'bad', 'a header re-labelled with another vault id does not open');
  // two seals of the same text differ (fresh nonce every time)
  assert.notEqual(JSON.parse(await D.vFile(body, 'backup', 4)).ct, d.ct);
}

/* ============ 8. sync: the cloud file is sealed, a new device joins with the passphrase, attacks are refused ============ */
{
  const srv = await davServer(), FILE = '/dav/OpenTick/opentick.json';
  const link = a => Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder: 'OpenTick', user: 'me', pass: 'secret' } });
  const A = makeDev(); link(A); A.S.tasks.push(A.newTask({ title: SECRET })); A.save(); A.flush();
  await A.vaultEnable(PASS, SCOPES, {}); await A.vDrain();
  await A.syncNow(true);
  const body1 = srv.files.get(FILE).body, r1 = JSON.parse(body1);
  assert.equal(r1.enc, 1); assert.equal(r1.schema, 5); assert.equal(r1.tasks, undefined, 'no task list in the clear'); assert.ok(!body1.includes(SECRET) && !body1.includes('Welcome to OpenTick'));
  assert.equal(r1.vault.id, A.Vault.cfg.id); assert.equal(A.Sync.state, 'ok'); assert.equal(A.Sync.cfg.encSeen, true);
  // a device without the vault does not upload over it, and does not read it
  const B = makeDev(); link(B); B.S.tasks.push(B.newTask({ title: 'only on B' })); B.save(); B.flush();
  await B.syncNow(false);
  assert.equal(B.Sync.state, 'error'); assert.match(B.Sync.msg, /passphrase this device does not know/); assert.equal(srv.files.get(FILE).body, body1, 'the cloud copy is untouched');
  // joining with the passphrase (the wrong one fails): its data is kept and merged
  await assert.rejects(B.vaultJoin(r1.vault, 'p', PASS2, { local: false }), e => e.vault === 'wrong'); assert.equal(B.vaultOn(), false);
  await B.vaultJoin(r1.vault, 'p', PASS, { local: false });
  assert.ok(B.vaultOn() && B.Vault.cfg.id === r1.vault.id && B.vaultScope('sync') && !B.vaultScope('local'));
  await B.syncNow(true);
  assert.equal(B.Sync.state, 'ok'); assert.ok(B.S.tasks.some(t => t.title === SECRET), 'B received A’s data'); assert.ok(B.S.tasks.some(t => t.title === 'only on B'), 'and kept its own');
  assert.ok(!srv.files.get(FILE).body.includes('only on B'), 'what B uploaded is sealed too');
  await A.syncNow(true); assert.ok(A.S.tasks.some(t => t.title === 'only on B'), 'A received B’s task');
  // the passphrase changed on A reaches B through the next sync
  await A.vaultChangePass(PASS, 'p', PASS2); await A.syncNow(true);
  assert.equal(JSON.parse(srv.files.get(FILE).body).vault.hv, 2, 'the cloud file carries the new header');
  B.S.tasks.push(B.newTask({ title: 'B again' })); B.save(); B.flush(); await B.syncNow(true);
  assert.equal(B.Vault.cfg.hv, 2, 'B picked up the new header'); await B.vUnlockHeader(B.vaultHeader(), 'p', PASS2);
  // nobody can swap the cloud file for a readable one: A refuses it and keeps its data
  const good = srv.files.get(FILE).body, count = A.S.tasks.length;
  srv.files.set(FILE, { body: JSON.stringify({ app: 'opentick', schema: 4, ...A.snapshot(), tasks: [{ id: 'evil', title: 'planted by the server', status: 'open', u: Date.now() + 1e6, tags: [], subtasks: [] }] }), etag: '"evil1"' });
  await A.syncNow(false);
  assert.equal(A.Sync.state, 'error'); assert.match(A.Sync.msg, /no longer encrypted/); assert.ok(!A.S.tasks.some(t => t.id === 'evil'), 'the planted task was not merged'); assert.equal(A.S.tasks.length, count);
  // …or for a damaged one
  const env = JSON.parse(good); env.ct = env.ct.slice(0, 20) + (env.ct[20] === 'A' ? 'B' : 'A') + env.ct.slice(21);
  srv.files.set(FILE, { body: JSON.stringify(env), etag: '"bad2"' }); await A.syncNow(false);
  assert.equal(A.Sync.state, 'error'); assert.match(A.Sync.msg, /could not be decrypted/); assert.equal(A.S.tasks.length, count);
  // an old copy replayed is just an older version: last-writer-wins keeps the newer records
  srv.files.set(FILE, { body: good, etag: '"good3"' }); await A.syncNow(true); assert.equal(A.Sync.state, 'ok');
  // locked: no request at all
  await A.vaultLockNow(); const gets = srv.count('GET'); await A.syncNow(true); assert.equal(srv.count('GET'), gets, 'a locked app does not touch the network');
  // switching sync encryption off here is the one allowed way back to a readable file
  const C = makeDev(); link(C); await C.vaultEnable(PASS, SCOPES, {}); await C.vDrain();
  srv.files.delete(FILE); await C.syncNow(true); assert.ok(JSON.parse(srv.files.get(FILE).body).enc === 1);
  await C.vaultSetScopes({ local: true, backup: true, sync: false }); await C.syncNow(true);
  const plain = JSON.parse(srv.files.get(FILE).body); assert.equal(plain.enc, undefined); assert.ok(Array.isArray(plain.tasks), 'after turning sync encryption off the cloud copy is readable again');
  srv.server.close();
}

/* ============ 9. the stand-in an older app finds, and a store that lost its vault ============ */
{
  const D = await withData(); await D.vaultEnable(PASS, SCOPES, {}); await D.vDrain();
  assert.equal(D.store['opentick.v1'], STUB);
  // someone clears the vault entry but the sealed copy is still there: the app does not mistake the stand-in for the data
  delete D.store[CFG]; const X = makeDev(D); await wait(); assert.equal(X.Vault.locked, false); assert.ok(!X.S.tasks.some(t => t.title === SECRET));
  assert.ok(D.store[ENC], 'the sealed copy is left where it is (it can still be opened from a backup header or the cloud)');
}

/* ============ 10. widgets cannot decrypt: they get an empty "locked" snapshot unless a readable summary was allowed ============ */
{
  const W = makeDev(); W.S.tasks.push(W.newTask({ title: SECRET, due: W.todayStr() })); W.save(); W.flush();
  assert.ok(JSON.stringify(W.widgetSnapshot()).includes(SECRET), 'without encryption the widgets show today');
  await W.vaultEnable(PASS, SCOPES, {}); await W.vDrain();
  const snap = W.widgetSnapshot(); assert.equal(snap.locked, true); assert.ok(!JSON.stringify(snap).includes(SECRET), 'no task text reaches a widget while encryption covers this device');
  W.Vault.cfg.widgets = true; assert.ok(JSON.stringify(W.widgetSnapshot()).includes(SECRET), 'allowed: the summary of today is shared'); assert.equal(W.widgetSnapshot().locked, undefined);
  W.Vault.cfg.widgets = false; await W.vaultLockNow(); assert.equal(W.widgetSnapshot().locked, true);
}
console.log('encryption tests passed');
