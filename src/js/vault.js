'use strict';
/* OpenTick vault: optional end-to-end encryption of everything the app stores, backs up or syncs.

   How it is built (nothing here is home-made crypto: it is all the browser's Web Crypto, in every webview we ship):
   • One random 256-bit data key (the DEK) encrypts the data. It is never stored in the clear: it is stored WRAPPED, once by a key
     derived from your passphrase (PBKDF2-HMAC-SHA256, 600 000 rounds, random salt) and, if you made one, once by a random
     recovery key. Changing the passphrase just re-wraps the same DEK, so every backup and device keeps working.
   • Every blob is sealed with AES-256-GCM: a fresh random 96-bit nonce each time, the text compressed first (encrypted data
     cannot be compressed afterwards), and associated data that binds the blob to this vault and to its purpose
     (local / sync / backup / snapshot / file), so a blob cannot be passed off as another kind of blob.
   • The DEK lives in memory as a NON-EXTRACTABLE CryptoKey: not even this page's own code can read its bytes back.
   • Every encrypted export, snapshot and sync file carries the wrapped-key header, so it can be opened anywhere with just the
     passphrase (or recovery key). A new device joins a synced vault by typing the passphrase; nothing else is shared.
   • Scopes (Settings → Encryption): "device" (stored data, attachments, automatic backups, sync logins), "backups" (exported
     files) and "sync" (the cloud copy). The passphrase and the keys are never stored in plain form or sent anywhere.
   This file is the engine (keys, sealing, storage). The lock screen and the Settings page are in vaultui.js. */
const VAULT_CFG = 'opentick.vault.v1', VAULT_ENC = 'opentick.v1.enc', VAULT_MEM = 'vault-key';
const VAULT_STUB = '{"v":1,"tasks":[],"lists":[],"enc":1}'; // what an older app finds under the normal key: nothing to overwrite the real (encrypted) copy with
const VAULT_ITER = 600000, VAULT_ITER_MIN = 100000, VAULT_ITER_MAX = 10000000, VAULT_PASS_MIN = 8;
const vEnc = s => new TextEncoder().encode(s), vDec = b => new TextDecoder().decode(b);
const v64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const u64 = s => Uint8Array.from(atob(String(s).replace(/\s/g, '')), c => c.charCodeAt(0));
const vRand = n => crypto.getRandomValues(new Uint8Array(n));
const vHex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const vErr = (code, msg) => Object.assign(new Error(msg || code), { vault: code });
// Web Crypto needs a secure context (https, localhost, or the desktop / mobile app); without it the feature is simply unavailable
const vaultAvail = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.getRandomValues === 'function' && (typeof isSecureContext === 'undefined' || isSecureContext !== false);

/* ---------- state ---------- */
const vaultDefaults = () => ({ scopes: { local: true, backup: true, sync: true }, auto: 0, remember: false, widgets: false, hv: 1, theme: '', mig: 0 });
function vaultReadCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(VAULT_CFG));
    if (c && typeof c === 'object' && c.id && c.kdf && c.kdf.s && c.p && c.p.ct) { const d = vaultDefaults(); return { ...d, ...c, scopes: { ...d.scopes, ...(c.scopes || {}) } }; }
  } catch (e) { /* no vault */ }
  return null;
}
const vHasBlob = () => { try { return !!localStorage.getItem(VAULT_ENC); } catch (e) { return false; } };
const Vault = { cfg: vaultReadCfg(), keys: new Map(), key: null, locked: false, committed: false, started: false };
Vault.committed = !!Vault.cfg;
Vault.locked = !!(Vault.cfg && Vault.cfg.scopes.local && vHasBlob()); // the data on this device is encrypted: nothing can be read until the key is back
const vaultOn = () => !!Vault.cfg;
const vaultScope = name => !!(Vault.cfg && Vault.cfg.scopes && Vault.cfg.scopes[name]);
const vaultReady = () => !Vault.locked;
const vaultHeader = () => Vault.cfg && { id: Vault.cfg.id, v: 1, hv: Vault.cfg.hv || 1, kdf: Vault.cfg.kdf, p: Vault.cfg.p, r: Vault.cfg.r || null };
function vaultSaveCfg() { try { localStorage.setItem(VAULT_CFG, JSON.stringify(Vault.cfg)); Vault.committed = true; } catch (e) { throw vErr('storage', 'Could not save the encryption settings: storage is full'); } }
// a data set with nothing in it, shown (never saved) while the vault is locked
const vaultPlaceholder = () => migrate({ v: 1, tasks: [] });

/* ---------- primitives ---------- */
const vAad = (id, purpose) => vEnc(`opentick|enc1|${id}|${purpose}`);
const vWrapAad = (id, how) => vEnc(`opentick|wrap1|${id}|${how}`);
async function vPipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
const vGzip = async bytes => { try { return typeof CompressionStream === 'function' ? await vPipe(bytes, new CompressionStream('gzip')) : null; } catch (e) { return null; } };
const vGunzip = bytes => vPipe(bytes, new DecompressionStream('gzip'));
const vAesKey = (raw, extractable = false) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
const vNfkc = s => String(s == null ? '' : s).normalize('NFKC'); // the same passphrase typed on another keyboard or OS composes the same way
// passphrase -> key-encryption key
async function vKekPass(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', vEnc(vNfkc(pass)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
// recovery key (160 random bits: high entropy already, so one HKDF step is enough) -> key-encryption key
async function vKekRecovery(bytes, salt) {
  const base = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: vEnc('opentick recovery key v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function vWrap(raw, id, how, kek) {
  const iv = vRand(12), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: vWrapAad(id, how) }, kek, raw));
  return { iv: v64(iv), ct: v64(ct) };
}
/* ---------- the recovery key: 32 characters of Crockford base32 (no I, L, O or U), written in groups of four ---------- */
const V32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function vRecoveryText(bytes) { let bits = 0, acc = 0, out = ''; for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { out += V32[(acc >> (bits - 5)) & 31]; bits -= 5; } acc &= (1 << bits) - 1; } return out.match(/.{1,4}/g).join('-'); }
function vRecoveryParse(text) {
  const s = String(text || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  if (s.length !== 32 || [...s].some(c => !V32.includes(c))) return null;
  let bits = 0, acc = 0; const out = [];
  for (const c of s) { acc = (acc << 5) | V32.indexOf(c); bits += 5; if (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; acc &= (1 << bits) - 1; } }
  return Uint8Array.from(out);
}
const vRecoveryOk = text => !!vRecoveryParse(text);

/* ---------- a vault's header: the wrapped data key + how to unwrap it. Safe to store anywhere (it is useless without the passphrase). ---------- */
function vHeaderCheck(h) {
  const ok = h && typeof h === 'object' && typeof h.id === 'string' && /^[\w-]{4,40}$/.test(h.id) && h.kdf && typeof h.kdf.s === 'string' && Number.isInteger(h.kdf.i) && h.p && typeof h.p.iv === 'string' && typeof h.p.ct === 'string';
  if (!ok) throw vErr('header', 'The encryption information in this file is damaged');
  if (h.kdf.i < VAULT_ITER_MIN || h.kdf.i > VAULT_ITER_MAX) throw vErr('header', 'The encryption settings in this file are not ones OpenTick accepts');
  return h;
}
// unwrap the data key with the passphrase ('p') or the recovery key ('r'); resolves to the raw bytes (callers wipe them)
async function vRawDek(h, how, secret) {
  vHeaderCheck(h);
  let kek, w;
  if (how === 'r') {
    const rb = vRecoveryParse(secret); if (!rb) throw vErr('badrecovery', 'That is not a recovery key (it has 32 letters and digits, in groups of four)');
    if (!h.r) throw vErr('norecovery', 'There is no recovery key for this data');
    kek = await vKekRecovery(rb, u64(h.r.s)); w = h.r;
  } else { kek = await vKekPass(secret, u64(h.kdf.s), h.kdf.i); w = h.p; }
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u64(w.iv), additionalData: vWrapAad(h.id, how) }, kek, u64(w.ct))); }
  catch (e) { throw vErr('wrong', how === 'r' ? 'That recovery key does not match' : 'That passphrase is not right'); }
}
async function vUnlockHeader(h, how, secret) { const raw = await vRawDek(h, how, secret); try { return await vAesKey(raw); } finally { raw.fill(0); } }
// a brand new vault: random data key, wrapped by the passphrase (and by a new recovery key when asked)
async function vNewHeader(pass, withRecovery = true) {
  const raw = vRand(32), id = vHex(vRand(8)), salt = vRand(16), h = { id, v: 1, hv: 1, kdf: { a: 'PBKDF2-SHA256', i: VAULT_ITER, s: v64(salt) }, p: null, r: null };
  let recovery = '';
  try {
    h.p = await vWrap(raw, id, 'p', await vKekPass(pass, salt, VAULT_ITER));
    if (withRecovery) { const rb = vRand(20), rs = vRand(16); h.r = { s: v64(rs), ...(await vWrap(raw, id, 'r', await vKekRecovery(rb, rs))) }; recovery = vRecoveryText(rb); }
    return { header: h, key: await vAesKey(raw), recovery };
  } finally { raw.fill(0); }
}
// the same data key under a new passphrase (a fresh salt and nonce); the recovery wrap is untouched
async function vRewrapPass(h, how, secret, newPass) {
  const raw = await vRawDek(h, how, secret);
  try { const salt = vRand(16), kdf = { a: 'PBKDF2-SHA256', i: VAULT_ITER, s: v64(salt) }; return { ...h, hv: (h.hv || 1) + 1, kdf, p: await vWrap(raw, h.id, 'p', await vKekPass(newPass, salt, VAULT_ITER)) }; } finally { raw.fill(0); }
}
// a new recovery key (the old one stops working)
async function vRewrapRecovery(h, how, secret) {
  const raw = await vRawDek(h, how, secret);
  try { const rb = vRand(20), rs = vRand(16); return { header: { ...h, hv: (h.hv || 1) + 1, r: { s: v64(rs), ...(await vWrap(raw, h.id, 'r', await vKekRecovery(rb, rs))) } }, recovery: vRecoveryText(rb) }; } finally { raw.fill(0); }
}
// how good is a passphrase? { ok, score 0-4, label, tip } (length matters most; a few obvious choices are refused)
const VAULT_COMMON = /^(password|passw0rd|12345678|123456789|1234567890|qwertyui|qwerty123|iloveyou|letmein1|opentick|11111111|abcdefgh|admin123|welcome1)/i;
function vStrength(p) {
  p = vNfkc(p); const n = [...p].length;
  if (!n) return { ok: false, score: 0, label: '', tip: '' };
  if (n < VAULT_PASS_MIN) return { ok: false, score: 1, label: 'Too short', tip: `Use at least ${VAULT_PASS_MIN} characters` };
  if (VAULT_COMMON.test(p) || /^(.)\1+$/.test(p)) return { ok: false, score: 1, label: 'Too easy to guess', tip: 'Avoid common words and repeated characters' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length, uniq = new Set(p).size;
  let s = n >= 20 ? 4 : n >= 15 ? 3 : n >= 12 ? (classes >= 2 ? 3 : 2) : n >= 10 ? (classes >= 3 ? 2 : 1) : (classes >= 3 ? 2 : 1);
  if (uniq < Math.min(6, n / 2)) s = Math.min(s, 1);
  s = Math.max(1, s);
  return { ok: true, score: s, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][s], tip: s < 3 ? 'Longer is stronger: try four or more unrelated words' : '' };
}

/* ---------- sealing and opening ----------
   A sealed text is { v, vid, z, iv, ct } (all text: safe in JSON / localStorage); sealed bytes are { vid, iv, ct } as typed arrays (for IndexedDB). */
function vCur() { const c = Vault.cfg, key = c && Vault.keys.get(c.id); if (!key) throw vErr('locked', 'Encryption is on but locked: enter your passphrase first'); return { id: c.id, key }; }
async function vSeal(text, purpose) {
  const { id, key } = vCur(); let bytes = vEnc(text), z = 0;
  const g = await vGzip(bytes); if (g && g.length < bytes.length) { bytes = g; z = 1; }
  const iv = vRand(12), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: vAad(id, purpose) }, key, bytes));
  return { v: 1, vid: id, z, iv: v64(iv), ct: v64(ct) };
}
async function vOpen(env, purpose, key) {
  if (!env || !env.iv || !env.ct || !env.vid) throw vErr('bad', 'This encrypted data is damaged');
  key = key || Vault.keys.get(env.vid); if (!key) throw vErr('nokey', 'This data is encrypted with a key this device does not have');
  let bytes; try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u64(env.iv), additionalData: vAad(env.vid, purpose) }, key, u64(env.ct))); }
  catch (e) { throw vErr('bad', 'This data could not be decrypted: it is damaged, or it was not made with this key'); }
  if (env.z) bytes = await vGunzip(bytes);
  return vDec(bytes);
}
async function vSealBin(bytes, purpose) {
  const { id, key } = vCur(), iv = vRand(12), ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: vAad(id, purpose) }, key, bytes));
  return { vid: id, iv, ct };
}
async function vOpenBin(rec, purpose, key) {
  key = key || Vault.keys.get(rec.vid); if (!key) throw vErr('nokey', 'This file is encrypted with a key this device does not have');
  try { return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv, additionalData: vAad(rec.vid, purpose) }, key, rec.ct)); }
  catch (e) { throw vErr('bad', 'This file could not be decrypted: it is damaged, or it was not made with this key'); }
}
// is this parsed JSON one of our encrypted envelopes (a backup file, a sync file)?
const vIsEnv = d => !!(d && typeof d === 'object' && d.enc && d.iv && d.ct && d.vid && d.vault);
// a self-contained encrypted file: the data, plus the header that lets the passphrase open it anywhere
async function vFile(text, kind, schema) {
  const env = await vSeal(text, kind);
  return JSON.stringify({ app: 'opentick', kind, schema, enc: 1, at: Date.now(), vault: vaultHeader(), vid: env.vid, z: env.z, iv: env.iv, ct: env.ct });
}
// open one of those files with a key you hold, or the passphrase / recovery key typed for it
async function vFileOpen(d, kind, how, secret) {
  let key = Vault.keys.get(d.vid);
  if (!key) { if (!how) throw vErr('nokey', 'This file is encrypted with another passphrase'); vHeaderCheck(d.vault); if (d.vault.id !== d.vid) throw vErr('header', 'This file is damaged'); key = await vUnlockHeader(d.vault, how, secret); }
  return vOpen(d, kind, key);
}

/* ---------- the data on this device ----------
   flush() is synchronous but Web Crypto is not, so the encrypted write is queued and coalesced: only the newest state is ever sealed,
   the previous encrypted copy stays in place until the new one is written (a crash loses at most the last few edits, never the data),
   and vDrain() lets a caller wait until everything has landed. */
const VP = { pending: null, busy: false, waiters: [], failed: 0 };
const vaultLocalOn = () => !!(Vault.cfg && Vault.cfg.scopes.local && Vault.key);
function vPersistLocal(json) { VP.pending = json; if (!VP.busy) vPersistRun(); }
async function vPersistRun() {
  VP.busy = true;
  try {
    while (VP.pending != null) {
      const j = VP.pending; VP.pending = null;
      try {
        const env = await vSeal(j, 'local');
        localStorage.setItem(VAULT_ENC, JSON.stringify(env));
        if (Vault.committed) localStorage.setItem(KEY, VAULT_STUB); // only once the vault itself is saved: until then the readable copy is all there is
        if (VP.failed) { VP.failed = 0; }
      } catch (e) { if (!VP.failed++ && typeof toast === 'function') toast(e && e.vault === 'locked' ? 'Locked: your last change was not saved' : 'Could not save — storage is full'); }
    }
  } finally { VP.busy = false; for (const f of VP.waiters.splice(0)) f(); }
}
const vDrain = () => (VP.busy || VP.pending != null ? new Promise(r => VP.waiters.push(r)) : Promise.resolve());
// store the data the way the vault says. Locked = nothing is written, ever (what is in memory is only a placeholder).
function persist(quiet) {
  if (Vault.locked) return false;
  if (Vault.cfg && Vault.cfg.scopes.local) { if (!Vault.key) return false; vPersistLocal(JSON.stringify(S)); vHint(); return true; }
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) { if (!quiet && typeof toast === 'function') toast('Could not save — storage is full'); return false; }
}
// the lock screen wears your theme: its name is not a secret, and it is kept beside the vault, not inside the data
function vHint() { try { const t = S.settings && S.settings.theme; if (Vault.committed && Vault.cfg && t && Vault.cfg.theme !== t && /^[\w-]{1,40}$/.test(t)) { Vault.cfg.theme = t; localStorage.setItem(VAULT_CFG, JSON.stringify(Vault.cfg)); } } catch (e) { /* cosmetic */ } }
// read the encrypted copy back (after the key is known)
async function vaultLoadLocal() {
  const raw = localStorage.getItem(VAULT_ENC); if (!raw) throw vErr('nodata', 'There is no encrypted data on this device');
  return JSON.parse(await vOpen(JSON.parse(raw), 'local'));
}
// "unlock": the key is known → decrypt the data into memory
async function vaultOpenData() {
  const d = await vaultLoadLocal();
  if (!d || !Array.isArray(d.tasks)) throw vErr('bad', 'The decrypted data is not an OpenTick data set');
  S = migrate(d); initSeen(); Vault.locked = false;
}

/* ---------- remembering the key on this device ----------
   An option for people who do not want to type the passphrase at every start: the data key (still non-extractable) is kept in IndexedDB.
   It keeps the data safe in a copied file, a cloud backup or a stolen backup, but not from someone who can use this unlocked device. */
const vRememberPut = async key => { try { await idb('readwrite', s => s.put({ id: Vault.cfg.id, key }, VAULT_MEM)); return true; } catch (e) { return false; } };
const vRememberGet = async () => { try { const r = await idb('readonly', s => s.get(VAULT_MEM)); return r && Vault.cfg && r.id === Vault.cfg.id ? r.key : null; } catch (e) { return null; } };
const vRememberDel = async () => { try { await idb('readwrite', s => s.delete(VAULT_MEM)); } catch (e) { /* nothing was kept */ } };
// a key that is only good if it really opens something: try it against the stored data
async function vTryKey(key) {
  if (!Vault.cfg || !key) return false;
  try { if (Vault.locked) { Vault.keys.set(Vault.cfg.id, key); await vOpen(JSON.parse(localStorage.getItem(VAULT_ENC)), 'local', key); } return true; }
  catch (e) { Vault.keys.delete(Vault.cfg.id); return false; }
}
/* ---------- other windows (the desktop mini-widgets) get the key from the main window, so nobody types it twice ---------- */
let vChanObj;
function vChan() { try { if (vChanObj === undefined) vChanObj = typeof BroadcastChannel === 'function' ? new BroadcastChannel('opentick-vault') : null; } catch (e) { vChanObj = null; } return vChanObj; }
function vShareStart() {
  const c = vChan(); if (!c || (typeof WIDGET !== 'undefined' && WIDGET)) return;
  c.onmessage = e => { if (e.data && e.data.t === 'need' && Vault.cfg && Vault.key && !Vault.locked) { try { c.postMessage({ t: 'key', id: Vault.cfg.id, key: Vault.key }); } catch (err) { /* the key cannot travel here */ } } };
}
function vShareAsk(ms = 1500) {
  const c = vChan(); if (!c) return Promise.resolve(null);
  return new Promise(res => { const t = setTimeout(() => { c.onmessage = null; res(null); }, ms); c.onmessage = e => { if (e.data && e.data.t === 'key' && Vault.cfg && e.data.id === Vault.cfg.id) { clearTimeout(t); c.onmessage = null; res(e.data.key); } }; c.postMessage({ t: 'need' }); });
}

/* ---------- turning it on, off and re-keying ----------
   Every store (the data, the pre-merge copy, automatic backups, attachments, sync logins) is read in whatever form it is in and written
   in the form the current settings ask for. So "enable", "disable", "change what is encrypted" and "join another vault" are all the
   same step, and it is safe to repeat: an interrupted run is simply finished at the next unlock (cfg.mig). */
async function vaultApplyLocal() {
  await vDrain();
  if (Vault.cfg && Vault.cfg.scopes.local) { Vault.locked = false; vPersistLocal(JSON.stringify(S)); await vDrain(); vHint(); }
  else { try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.removeItem(VAULT_ENC); } catch (e) { throw vErr('storage', 'Could not write the data back: storage is full'); } }
}
async function vaultReseal(progress) {
  const say = t => { if (typeof progress === 'function') progress(t); };
  say('Main data'); await vaultApplyLocal();
  say('Safety copy'); if (typeof premergeReseal === 'function') await premergeReseal();
  say('Sync login'); if (typeof saveSyncCfg === 'function') saveSyncCfg();
  let keys = []; try { keys = (await idb('readonly', s => s.getAllKeys())) || []; } catch (e) { keys = []; }
  const snaps = keys.filter(k => /^snap:/.test(k)), files = keys.filter(k => /^file:/.test(k));
  let n = 0; for (const k of snaps) { say(`Automatic backups ${++n}/${snaps.length}`); try { await snapReseal(k); } catch (e) { /* one unreadable copy must not stop the rest */ } }
  n = 0; for (const k of files) { say(`Attached files ${++n}/${files.length}`); try { await fileReseal(k); } catch (e) { /* the same */ } }
  say('Widgets'); if (typeof widgetPush === 'function') widgetPush(true);
}
// turn encryption on. Resolves to the recovery key (text). `scopes` = { local, backup, sync }
async function vaultEnable(pass, scopes, o = {}) {
  if (Vault.cfg) throw vErr('already', 'Encryption is already on');
  if (!vaultAvail()) throw vErr('unavailable', 'Encryption is not available here');
  const st = vStrength(pass); if (!st.ok) throw vErr('weak', st.tip || 'Choose a stronger passphrase');
  const { header, key, recovery } = await vNewHeader(pass, true);
  const prev = Vault.cfg;
  Vault.cfg = { ...vaultDefaults(), ...header, scopes: { local: !!scopes.local, backup: !!scopes.backup, sync: !!scopes.sync }, remember: !!o.remember, mig: 1, theme: (S.settings && S.settings.theme) || '' };
  Vault.keys.set(header.id, key); Vault.key = key; Vault.committed = false;
  try {
    flush(); await vDrain(); // the encrypted copy is written first …
    vaultSaveCfg();           // … and only then is the vault itself saved: the commit point. Before it nothing has changed; after it, the data needs the key
    if (Vault.cfg.scopes.local) localStorage.setItem(KEY, VAULT_STUB);
  } catch (e) { Vault.cfg = prev; Vault.keys.delete(header.id); Vault.key = null; Vault.committed = false; try { localStorage.removeItem(VAULT_ENC); } catch (x) { /* nothing */ } throw e; }
  if (Vault.cfg.remember) await vRememberPut(key);
  vShareStart();
  await vaultReseal(o.progress);
  Vault.cfg.mig = 0; vaultSaveCfg();
  if (typeof Sync !== 'undefined') { Sync.cfg.encSeen = false; Sync.cfg.hdr = 0; Sync.cfg.fp = null; saveSyncCfg(); } // the next sync uploads the sealed copy
  if (typeof hooks !== 'undefined') hooks.change();
  return recovery;
}
// change what is encrypted. Turning sync off lets the next sync write a readable cloud copy once (the other devices ask before accepting that).
async function vaultSetScopes(next, o = {}) {
  const was = { ...Vault.cfg.scopes };
  Vault.cfg.scopes = { local: !!next.local, backup: !!next.backup, sync: !!next.sync };
  vaultSaveCfg();
  if (typeof Sync !== 'undefined') {
    if (was.sync && !next.sync) { Sync.cfg.downgrade = true; Sync.cfg.encSeen = false; }
    if (!was.sync && next.sync) { Sync.cfg.downgrade = false; Sync.cfg.fp = null; }
    saveSyncCfg();
  }
  await vaultReseal(o.progress);
  if (typeof hooks !== 'undefined') hooks.change();
}
// turn encryption off: everything is written back readable, then the vault (and any remembered key) is erased
async function vaultDisable(o = {}) {
  const key = Vault.key, id = Vault.cfg.id;
  Vault.cfg.scopes = { local: false, backup: false, sync: false };
  Vault.keys.set(id, key);
  if (typeof Sync !== 'undefined') { Sync.cfg.downgrade = true; Sync.cfg.encSeen = false; }
  await vaultReseal(o.progress);                     // every store is readable again …
  const cfg = Vault.cfg; Vault.cfg = null; Vault.key = null;
  try { localStorage.removeItem(VAULT_CFG); localStorage.removeItem(VAULT_ENC); } catch (e) { /* nothing */ }
  Vault.committed = false; await vRememberDel();
  if (typeof Sync !== 'undefined') saveSyncCfg();
  Vault.keys.set(id, key);                           // kept for this session only, so one last sync can still read the (encrypted) cloud copy and replace it
  return cfg;
}
// another device's vault (it came with a synced or imported file): adopt it with the passphrase typed for it. Local data is merged by the caller.
async function vaultJoin(header, how, secret, o = {}) {
  vHeaderCheck(header);
  const key = await vUnlockHeader(header, how, secret), prev = Vault.cfg, d = vaultDefaults();
  Vault.keys.set(header.id, key);
  Vault.cfg = { ...d, id: header.id, v: 1, hv: header.hv || 1, kdf: header.kdf, p: header.p, r: header.r || null, scopes: { local: o.local !== false, backup: true, sync: true }, auto: prev ? prev.auto : 0, remember: prev ? !!prev.remember : false, widgets: prev ? !!prev.widgets : false, mig: 1, theme: (S.settings && S.settings.theme) || '' };
  Vault.key = key; Vault.locked = false; Vault.committed = false;
  flush(); await vDrain(); vaultSaveCfg();
  if (Vault.cfg.scopes.local) localStorage.setItem(KEY, VAULT_STUB);
  if (Vault.cfg.remember) await vRememberPut(key);
  vShareStart();
  await vaultReseal(o.progress);
  Vault.cfg.mig = 0; vaultSaveCfg();
  return key;
}
// the same vault, written with a newer header (another device changed the passphrase or the recovery key): keep the newest one
function vaultAdoptHeader(h) {
  if (!Vault.cfg || !h || h.id !== Vault.cfg.id || (h.hv || 1) <= (Vault.cfg.hv || 1)) return false;
  try { vHeaderCheck(h); } catch (e) { return false; }
  Vault.cfg = { ...Vault.cfg, hv: h.hv, kdf: h.kdf, p: h.p, r: h.r || null }; vaultSaveCfg(); return true;
}
async function vaultChangePass(oldSecret, how, newPass) {
  const st = vStrength(newPass); if (!st.ok) throw vErr('weak', st.tip || 'Choose a stronger passphrase');
  const h = await vRewrapPass(vaultHeader(), how, oldSecret, newPass);
  Vault.cfg = { ...Vault.cfg, hv: h.hv, kdf: h.kdf, p: h.p }; vaultSaveCfg();
  if (typeof hooks !== 'undefined') hooks.change(); // the new header is part of the next sync
  return true;
}
async function vaultNewRecovery(secret, how) {
  const r = await vRewrapRecovery(vaultHeader(), how, secret);
  Vault.cfg = { ...Vault.cfg, hv: r.header.hv, r: r.header.r }; vaultSaveCfg();
  if (typeof hooks !== 'undefined') hooks.change();
  return r.recovery;
}
// prove the person knows the passphrase before a sensitive step (switching it off, showing the recovery key …)
async function vaultVerify(pass) { try { const raw = await vRawDek(vaultHeader(), 'p', pass); raw.fill(0); return true; } catch (e) { if (e && e.vault === 'wrong') return false; throw e; } }
