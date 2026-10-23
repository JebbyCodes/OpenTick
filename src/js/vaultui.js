/* OpenTick vault screens: the lock screen, Settings → Encryption and the passphrase prompts. The engine (keys, sealing, storage) is in vault.js. */
const VAULT_AUTO = [[0, 'Never'], [1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes'], [30, 'After 30 minutes'], [60, 'After 1 hour']];
const vaultSay = (el, t) => { if (el) el.textContent = t; };
// strength meter under a "new passphrase" field
function vMeter(p) {
  const st = vStrength(p), msg = p ? st.label + (st.tip ? ' · ' + st.tip : '') : `At least ${VAULT_PASS_MIN} characters. Four or more unrelated words make a strong passphrase.`;
  return `<div class="pwm s${p ? st.score : 0}" aria-hidden="true"><i></i><i></i><i></i><i></i></div><small class="pwl${p && !st.ok ? ' bad' : ''}">${esc(msg)}</small>`;
}
// a modal that stays open until a spinner-worthy job is done
function vaultBusy(title) {
  openModal(`<h3>${ic('lock', 18)} ${esc(title)}</h3><div class="vk-busy"><span class="vk-spin" aria-hidden="true"></span><span id="vb-t" aria-live="polite">Working…</span></div><p class="hint">Please keep OpenTick open until this finishes.</p>`, null, 'wide');
  return { say: t => vaultSay($('#vb-t'), t), close: closeModal };
}

/* ---------- asking for the passphrase (or the recovery key) ----------
   askSecret({ title, lead, ok, extra, recovery, check }) -> what check() returned, or null when cancelled.
   check(how, secret, modal, say) runs while the dialog shows "Checking…"; if it throws, its message is shown under the field and the dialog stays. */
function askSecret(o) {
  return new Promise(res => {
    let how = 'p', busy = false;
    openModal(`<h3>${ic('lock', 18)} ${esc(o.title)}</h3>${o.lead ? `<p>${esc(o.lead)}</p>` : ''}
<form id="vs-f" autocomplete="off"><label class="vk-f"><span id="vs-l">Passphrase</span><input type="password" id="vs-i" autocomplete="current-password" autocapitalize="off" spellcheck="false" aria-describedby="vs-e"></label>
<div class="vk-row"><label class="chkl"><input type="checkbox" id="vs-show"> Show</label>${o.recovery === false ? '' : '<button type="button" class="vk-link" id="vs-alt">Use my recovery key instead</button>'}</div>
${o.extra || ''}<p class="vk-err" id="vs-e" role="alert"></p>
<div class="mact"><button type="button" data-m="no">Cancel</button><button class="pri" type="submit" id="vs-ok">${esc(o.ok || 'Unlock')}</button></div></form>`, m => {
      const i = $('#vs-i', m), err = $('#vs-e', m), ok = $('#vs-ok', m), lab = $('#vs-l', m), alt = $('#vs-alt', m), done = v => { closeModal(); res(v); };
      if (i.focus) i.focus();
      $('#vs-show', m).onchange = e => { i.type = e.target.checked ? 'text' : 'password'; };
      if (alt) alt.onclick = () => {
        how = how === 'p' ? 'r' : 'p'; lab.textContent = how === 'p' ? 'Passphrase' : 'Recovery key'; alt.textContent = how === 'p' ? 'Use my recovery key instead' : 'Use my passphrase instead';
        i.value = ''; i.placeholder = how === 'r' ? 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX' : ''; i.setAttribute('autocomplete', how === 'r' ? 'off' : 'current-password'); err.textContent = ''; i.focus();
      };
      $('#vs-f', m).onsubmit = async e => {
        e.preventDefault(); if (busy) return;
        const secret = i.value; if (!secret) { err.textContent = how === 'p' ? 'Enter your passphrase' : 'Enter your recovery key'; return; }
        busy = true; ok.disabled = true; ok.textContent = 'Checking…'; err.textContent = '';
        try { done(o.check ? await o.check(how, secret, m, t => { ok.textContent = t; }) : { how, secret }); }
        catch (x) { busy = false; ok.disabled = false; ok.textContent = o.ok || 'Unlock'; err.textContent = (x && x.message) || 'That did not work'; i.select(); }
      };
      m.onclick = e => { const b = e.target.closest('[data-m]'); if ((b || e.target.classList.contains('mback')) && !busy) done(null); };
    }, 'wide');
  });
}
// two new-passphrase fields with a strength meter -> the passphrase, or null
function askNewPass(o) {
  return new Promise(res => {
    openModal(`<h3>${ic('lock', 18)} ${esc(o.title)}</h3>${o.lead ? `<p>${esc(o.lead)}</p>` : ''}
<form id="np-f" autocomplete="off"><label class="vk-f"><span>New passphrase</span><input type="password" id="np-1" autocomplete="new-password" autocapitalize="off" spellcheck="false"></label><div id="np-m" class="vk-meter">${vMeter('')}</div>
<label class="vk-f"><span>Repeat it</span><input type="password" id="np-2" autocomplete="new-password" autocapitalize="off" spellcheck="false"></label>
<div class="vk-row"><label class="chkl"><input type="checkbox" id="np-show"> Show</label></div><p class="vk-err" id="np-e" role="alert"></p>
<div class="mact"><button type="button" data-m="no">Cancel</button><button class="pri" type="submit">${esc(o.ok || 'Save')}</button></div></form>`, m => {
      const a = $('#np-1', m), b = $('#np-2', m), err = $('#np-e', m), done = v => { closeModal(); res(v); };
      if (a.focus) a.focus();
      a.oninput = () => { $('#np-m', m).innerHTML = vMeter(a.value); err.textContent = ''; };
      $('#np-show', m).onchange = e => { a.type = b.type = e.target.checked ? 'text' : 'password'; };
      $('#np-f', m).onsubmit = e => {
        e.preventDefault(); const st = vStrength(a.value);
        if (!st.ok) { err.textContent = st.tip || 'Choose a stronger passphrase'; return; }
        if (a.value !== b.value) { err.textContent = 'The two passphrases are not the same'; return; }
        done(a.value);
      };
      m.onclick = e => { if (e.target.closest('[data-m]') || e.target.classList.contains('mback')) done(null); };
    }, 'wide');
  });
}
// open an encrypted backup (or any sealed file of ours): with the key this device holds, or the passphrase typed for it (never kept) -> the text, or null
async function vaultOpenFile(d, kind) {
  if (Vault.keys.has(d.vid)) return vOpen(d, kind);
  if (Vault.cfg && Vault.cfg.id === d.vid && !Vault.key) { if (!(await vaultEnsureKey(true))) return null; return vOpen(d, kind); }
  let out = null;
  const r = await askSecret({ title: 'Encrypted backup', lead: 'This file is encrypted. Enter the passphrase it was made with. It is only used to open this file and is not kept.', ok: 'Open', check: async (how, secret) => { out = await vFileOpen(d, kind, how, secret); return true; } });
  return r ? out : null;
}

/* ---------- getting the key back ---------- */
async function vaultAdoptKey(key) {
  Vault.keys.set(Vault.cfg.id, key); Vault.key = key;
  try { if (Vault.locked) await vaultOpenData(); }
  catch (e) { Vault.keys.delete(Vault.cfg.id); Vault.key = null; throw e; }
  await syncSecretsLoad();
  if (Vault.cfg.remember) await vRememberPut(key);
  if (Vault.cfg.mig) vaultReseal().then(() => { Vault.cfg.mig = 0; vaultSaveCfg(); }).catch(() => { /* tried again at the next unlock */ });
  vShareStart(); vShareAnnounce();
  Vault.act = Date.now();
  if (typeof paintSync === 'function') paintSync();
}
// tell the other windows (the desktop mini-widgets) the key, so they open without asking
function vShareAnnounce() { const c = vChan(); if (c && !(typeof WIDGET !== 'undefined' && WIDGET) && Vault.cfg && Vault.key) { try { c.postMessage({ t: 'key', id: Vault.cfg.id, key: Vault.key }); } catch (e) { /* cannot travel */ } } }
// a key without asking: the one kept on this device ("remember me") or, for a widget window, the main window's
async function vaultQuietKey() {
  if (!Vault.cfg) return null;
  if (typeof WIDGET !== 'undefined' && WIDGET) { const k = await vShareAsk(1500); if (k) return k; }
  return Vault.cfg.remember ? await vRememberGet() : null;
}
// make sure the key is here (sync, export …). Quietly if it can be; otherwise by asking when `interactive`.
async function vaultEnsureKey(interactive) {
  if (!Vault.cfg || Vault.key) return true;
  const k = await vaultQuietKey(); if (k) { await vaultAdoptKey(k); return true; }
  if (!interactive) return false;
  const key = await askSecret({ title: 'Unlock encryption', lead: 'Enter your passphrase to continue.', ok: 'Unlock', check: async (how, secret) => vUnlockHeader(vaultHeader(), how, secret) });
  if (!key) return false;
  await vaultAdoptKey(key); return true;
}
// a cloud copy (or file) from another vault: type its passphrase to use it here. Your own data is kept and merged.
async function vaultJoinPrompt(header) {
  const had = vaultOn(), local = !(Vault.cfg && Vault.cfg.scopes.local);
  const r = await askSecret({
    title: 'Unlock the cloud copy', ok: 'Unlock and use it',
    lead: had ? 'The cloud copy is encrypted with a different passphrase than this device uses. Enter the cloud passphrase to switch this device to it. Your data here is kept and merged.' : 'The cloud copy is encrypted. Enter its passphrase to use it on this device. Your data here is kept and merged.',
    extra: local ? '<label class="chkl"><input type="checkbox" id="vj-local" checked> Also encrypt the data stored on this device (asks for the passphrase when the app opens)</label>' : '',
    check: async (how, secret, m, say) => { const lc = $('#vj-local', m); await vaultJoin(header, how, secret, { local: lc ? lc.checked : true, progress: say }); return true; },
  });
  if (r && typeof appResume === 'function' && APP_STARTED) appResume(true);
  return !!r;
}

/* ---------- the lock screen ---------- */
const LK = { mode: 'p', busy: false, opening: false, err: '' };
function lkHtml() {
  const wg = typeof WIDGET !== 'undefined' && WIDGET;
  if (LK.opening) return `<div class="lk-card opening">${logoHtml(56)}<span class="vk-spin" aria-hidden="true"></span></div>`;
  if (LK.mode === 'reset') return `<div class="lk-card">${logoHtml(48)}<h1>Start again on this device?</h1>
<p class="lk-sub">Without the passphrase or the recovery key your data here cannot be opened by anyone. You can erase what is stored on this device and start fresh.</p>
<p class="lk-sub"><b>Nothing in the cloud is touched.</b> If you sync, the encrypted copy is still there, and your passphrase opens it from any device (including this one afterwards).</p>
<form id="lk-f"><label class="vk-f"><span>Type <b>ERASE</b> to confirm</span><input id="lk-i" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
<div class="mact"><button type="button" data-lk="back">Back</button><button class="danger" type="submit" id="lk-go" disabled>Erase this device</button></div></form></div>`;
  const rec = LK.mode === 'r';
  return `<div class="lk-card">${logoHtml(56)}<h1>OpenTick is locked</h1>
<p class="lk-sub">${wg ? 'Unlock OpenTick in its main window and this widget opens by itself, or enter the passphrase here.' : rec ? 'Enter your recovery key. You will be asked to choose a new passphrase afterwards.' : 'Your data is encrypted. Enter your passphrase to open it.'}</p>
<form id="lk-f" autocomplete="off"><label class="vk-f"><span>${rec ? 'Recovery key' : 'Passphrase'}</span><input type="password" id="lk-i" ${rec ? 'placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off"' : 'autocomplete="current-password"'} autocapitalize="off" spellcheck="false"${LK.busy ? ' disabled' : ''}></label>
<div class="vk-row"><label class="chkl"><input type="checkbox" id="lk-show"> Show</label></div>
<p class="vk-err" id="lk-e" role="alert">${esc(LK.err)}</p>
<button class="pri lk-go" type="submit"${LK.busy ? ' disabled' : ''}>${LK.busy ? 'Unlocking…' : 'Unlock'}</button></form>
<div class="lk-alt">${Vault.cfg && Vault.cfg.r ? `<button type="button" data-lk="mode">${rec ? 'Use my passphrase' : 'Use my recovery key'}</button>` : ''}<button type="button" data-lk="reset">I have lost both</button></div></div>`;
}
function lkDraw() {
  const el = $('#lock'); if (!el) return;
  el.innerHTML = lkHtml();
  const i = $('#lk-i', el), f = $('#lk-f', el);
  if (i && i.focus && !LK.busy) i.focus();
  const sh = $('#lk-show', el); if (sh) sh.onchange = e => { i.type = e.target.checked ? 'text' : 'password'; };
  if (f && LK.mode === 'reset') { i.oninput = () => { $('#lk-go', el).disabled = i.value.trim().toUpperCase() !== 'ERASE'; }; f.onsubmit = async e => { e.preventDefault(); if (i.value.trim().toUpperCase() === 'ERASE') await vaultReset(); }; }
  else if (f) f.onsubmit = async e => { e.preventDefault(); if (LK.busy || !i.value) return; await vaultUnlockWith(LK.mode, i.value); };
  el.onclick = e => {
    const b = e.target.closest('[data-lk]'); if (!b) return;
    if (b.dataset.lk === 'mode') { LK.mode = LK.mode === 'r' ? 'p' : 'r'; LK.err = ''; lkDraw(); }
    else if (b.dataset.lk === 'reset') { LK.mode = 'reset'; LK.err = ''; lkDraw(); }
    else if (b.dataset.lk === 'back') { LK.mode = 'p'; lkDraw(); }
  };
}
function vaultShowLock(o = {}) {
  let el = $('#lock'); if (!el) { el = document.createElement('div'); el.id = 'lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'OpenTick is locked'); document.body.appendChild(el); }
  document.body.classList.add('locked');
  const th = Vault.cfg && Vault.cfg.theme; if (th && THEMES.some(t => t[0] === th)) document.documentElement.dataset.theme = th;
  LK.mode = 'p'; LK.busy = false; LK.err = ''; LK.opening = !!o.opening; lkDraw();
}
function vaultHideLock() { const el = $('#lock'); if (el && el.remove) el.remove(); document.body.classList.remove('locked'); }
async function vaultUnlockWith(how, secret) {
  LK.busy = true; LK.err = ''; lkDraw();
  try {
    const key = await vUnlockHeader(vaultHeader(), how, secret);
    await vaultAdoptKey(key);
    vaultHideLock(); vaultUnlocked();
    if (how === 'r') { const np = await askNewPass({ title: 'Choose a new passphrase', lead: 'You opened your data with the recovery key. Choose a new passphrase so you do not need it next time. (The recovery key keeps working.)', ok: 'Save passphrase' }); if (np) { try { await vaultChangePass(secret, 'r', np); toast('Passphrase changed'); } catch (e) { toast(e.message || 'Could not change the passphrase'); } } }
  } catch (e) { LK.busy = false; LK.err = e && e.vault ? e.message : 'Could not unlock: ' + ((e && e.message) || e); lkDraw(); }
}
// the data is open: carry on starting the app, or pick up where it was before it locked
function vaultUnlocked() { if (typeof appStart === 'function' && !APP_STARTED) { APP_STARTED = true; appStart(); } else if (typeof appResume === 'function') appResume(); }
// "Lock now", the idle timer, or a phone coming back after a while
async function vaultLockNow() {
  if (!Vault.cfg || !Vault.cfg.scopes.local || Vault.locked || !Vault.key) return;
  flush(); await vDrain(); await syncSecretsDrain();
  if (typeof closeModal === 'function') closeModal();
  Vault.locked = true; Vault.key = null; Vault.keys.clear();
  if (typeof syncSecretsWipe === 'function') syncSecretsWipe();
  clearTimeout(Sync.timer);
  try { for (const u of FILE_URL.values()) URL.revokeObjectURL(u); FILE_URL.clear(); } catch (e) { /* none */ }
  S = vaultPlaceholder(); initSeen();
  U.sel = null; U.noteSel = null; U.q = ''; U.tagSel = []; U.bsel = null;
  for (const id of ['side', 'main', 'detail', 'tabbar']) { const el = document.getElementById ? document.getElementById(id) : null; if (el) el.innerHTML = ''; }
  await vRememberDel(); // locking means locking: the key kept for "remember me" is dropped until the next unlock
  vaultShowLock(); if (typeof paintSync === 'function') paintSync();
}
async function vaultReset() {
  try { await vRememberDel(); const keys = (await idb('readonly', s => s.getAllKeys())) || []; for (const k of keys) if (/^(snap|file):/.test(k)) await idb('readwrite', s => s.delete(k)); } catch (e) { /* nothing more to erase */ }
  try { for (const k of [VAULT_CFG, VAULT_ENC, KEY, PREMERGE, SYNC_KEY, SYNC_SEC]) localStorage.removeItem(k); } catch (e) { /* none */ }
  Vault.cfg = null; Vault.locked = false; Vault.key = null; Vault.keys.clear();
  if (typeof location !== 'undefined' && location.reload) location.reload();
}
// idle and background locking
function vaultIdleStart() {
  if (Vault.idleOn || typeof document === 'undefined' || !document.addEventListener) return; Vault.idleOn = true; Vault.act = Date.now();
  const bump = () => { Vault.act = Date.now(); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) document.addEventListener(ev, bump, { passive: true, capture: true });
  setInterval(() => vaultIdleCheck(), 10000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) Vault.hiddenAt = Date.now(); else vaultIdleCheck(true); });
}
function vaultIdleCheck(resumed) {
  const c = Vault.cfg; if (!c || !c.scopes.local || !c.auto || Vault.locked || !Vault.key) return;
  const since = resumed && Vault.hiddenAt ? Date.now() - Vault.hiddenAt : Date.now() - (Vault.act || Date.now());
  if (since >= c.auto * 60000) vaultLockNow();
}
// the very start of the app: no vault → start; locked → try the quiet ways, then show the lock screen
async function vaultStart(start) {
  if (!Vault.cfg) { APP_STARTED = true; start(); return; }
  vaultIdleStart(); vShareStart();
  if (!Vault.locked) { APP_STARTED = true; start(); if (!Vault.key) vaultEnsureKey(false).then(ok => { if (ok && typeof paintSync === 'function') paintSync(); }); return; }
  vaultShowLock({ opening: true });
  let key = null; try { key = await vaultQuietKey(); } catch (e) { key = null; }
  if (key) { try { await vaultAdoptKey(key); vaultHideLock(); vaultUnlocked(); return; } catch (e) { /* the kept key is stale: ask */ } }
  vaultShowLock();
  // a widget window opens by itself when the main window unlocks
  const c = vChan(); if (c && typeof WIDGET !== 'undefined' && WIDGET) c.onmessage = async e => { if (e.data && e.data.t === 'key' && Vault.cfg && e.data.id === Vault.cfg.id && Vault.locked) { try { await vaultAdoptKey(e.data.key); vaultHideLock(); vaultUnlocked(); } catch (err) { /* wrong key */ } } };
}

/* ---------- Settings → Encryption ---------- */
const vScopeLine = c => [c.scopes.local && 'this device', c.scopes.backup && 'backups', c.scopes.sync && 'sync'].filter(Boolean).join(', ');
function vaultSettingsHtml() {
  if (!vaultAvail()) return `<h3>${ic('shield', 18)} Encryption</h3><p>Encryption is not available here: it needs a secure connection (https) or the OpenTick desktop or mobile app.</p><div class="mact"><button class="pri" data-v="back">Back</button></div>`;
  const c = Vault.cfg;
  if (!c) return `<h3>${ic('shield', 18)} Encryption</h3>
<p>Lock your data with a passphrase. OpenTick encrypts it with AES-256 <b>before</b> it is stored, backed up or synced, so nobody who gets hold of the files (a cloud provider, a stolen laptop, a copied backup) can read it. Only you hold the passphrase.</p>
<ul class="vk-list"><li>${ic('check', 14)} Tasks, notes, habits, timetable, attached files and history</li><li>${ic('check', 14)} The cloud copy, exported backups and the automatic backups</li><li>${ic('check', 14)} Your sync login (password or token)</li><li>${ic('check', 14)} Works on every device you use; a new device joins by typing the passphrase</li></ul>
<p class="hint">You choose what is covered and whether OpenTick asks for the passphrase each time it opens. The passphrase never leaves this device. There is no reset: keep the recovery key that is made for you.</p>
<div class="mact"><button data-v="back">Back</button><button class="pri" data-v="setup">Turn on encryption…</button></div>`;
  const sc = c.scopes, one = (k, t, d) => `<label class="vk-sc"><input type="checkbox" data-vs="${k}"${sc[k] ? ' checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`;
  return `<h3>${ic('shield', 18)} Encryption</h3>
<div class="vk-stat ${Vault.key ? 'ok' : 'warn'}">${ic(Vault.key ? 'lock' : 'unlock', 18)}<span><b>${Vault.key ? 'On and unlocked' : 'On, but locked'}</b><small>AES-256-GCM · passphrase key stretched with PBKDF2 (${(c.kdf.i / 1000) | 0},000 rounds) · ${c.r ? 'recovery key set' : 'no recovery key'}</small></span></div>
<h4 class="mh">What is encrypted</h4><div class="vk-scopes">
${one('local', 'On this device', 'The stored data, attached files, automatic backups and your sync login. OpenTick asks for the passphrase when it opens.')}
${one('backup', 'Backup files', 'Exports and downloaded backups are saved as encrypted files that the passphrase opens on any device.')}
${one('sync', 'Cloud sync', 'The file on your server is unreadable to the server and to anyone who can see it.')}</div>
<h4 class="mh">Locking</h4><div class="form one"><label>Lock automatically<select data-vo="auto"${sc.local ? '' : ' disabled'}>${opts(VAULT_AUTO, c.auto)}</select></label></div>
<label class="chkl"><input type="checkbox" data-vo="remember"${c.remember ? ' checked' : ''}> Remember me on this device</label>
<p class="hint">${c.remember ? 'OpenTick opens without asking. The data stays encrypted in its files and backups, but anyone who can use this unlocked device can read it. Turn this off on a shared computer.' : 'OpenTick asks for the passphrase each time it opens.'}</p>
${isAndroidApp() ? `<label class="chkl"><input type="checkbox" data-vo="widgets"${c.widgets ? ' checked' : ''}${sc.local ? '' : ' disabled'}> Let home-screen widgets show today's tasks</label><p class="hint">Widgets cannot decrypt anything. With this on, a readable summary of today is kept for them; off, they show “Locked”.</p>` : ''}
<h4 class="mh">Keys</h4><div class="dgrid">
<button data-v="lock"${sc.local ? '' : ' disabled'}>${ic('lock', 18)}<span><b>Lock now</b><small>Ask for the passphrase again</small></span></button>
<button data-v="pass">${ic('key', 18)}<span><b>Change passphrase</b><small>Backups and other devices keep working</small></span></button>
<button data-v="recovery">${ic('shield', 18)}<span><b>Recovery key</b><small>${c.r ? 'Make a new one (the old one stops working)' : 'Make one, in case you forget the passphrase'}</small></span></button>
<button class="dz" data-v="off">${ic('unlock', 18)}<span><b>Turn off encryption…</b><small>Everything is written back readable</small></span></button></div>
<div class="mact"><button class="pri" data-v="back">Done</button></div>`;
}
function openVault() {
  const back = () => { closeModal(); openSettings(); };
  const draw = () => openModal(vaultSettingsHtml(), wire, 'wide');
  const progressRun = async (title, fn) => { const b = vaultBusy(title); try { return await fn(b.say); } finally { /* the caller redraws */ } };
  const needPass = (title, lead) => askSecret({ title, lead, ok: 'Continue', check: async (how, secret) => { if (how === 'p' ? !(await vaultVerify(secret)) : false) throw vErr('wrong', 'That passphrase is not right'); if (how === 'r') await vUnlockHeader(vaultHeader(), 'r', secret); return { how, secret }; } });
  function wire(m) {
    m.onchange = async e => {
      const el = e.target;
      if (el.dataset.vs) {
        const next = { ...Vault.cfg.scopes, [el.dataset.vs]: el.checked };
        if (!next.local && !next.backup && !next.sync) { el.checked = true; toast('To switch everything off, use “Turn off encryption”'); return; }
        if (!el.checked) {
          const warn = { local: 'Your data on this device, the attached files and the automatic backups will be stored readable again, and OpenTick stops asking for the passphrase.', backup: 'Exports and downloaded backups will be plain files that anyone can read.', sync: 'On the next sync the cloud copy is replaced by a readable one. Your other devices will ask you before they accept it.' }[el.dataset.vs];
          if (!await askConfirm(warn, 'Turn off')) { el.checked = true; return; }
        }
        let ok = true; await progressRun('Updating encryption', async say => { try { await vaultSetScopes(next, { progress: say }); } catch (err) { ok = false; toast(err.message || 'Could not change that'); } });
        if (ok && !next.local) Vault.locked = false;
        draw(); if (typeof paintSync === 'function') paintSync(); return;
      }
      if (el.dataset.vo) {
        const k = el.dataset.vo;
        if (k === 'auto') Vault.cfg.auto = +el.value || 0;
        else if (k === 'remember') { Vault.cfg.remember = el.checked; if (el.checked) await vRememberPut(Vault.key); else await vRememberDel(); }
        else if (k === 'widgets') { Vault.cfg.widgets = el.checked; if (typeof widgetPush === 'function') widgetPush(true); }
        try { vaultSaveCfg(); } catch (err) { toast(err.message); }
        if (k === 'remember') draw();
      }
    };
    m.onclick = async e => {
      const b = e.target.closest('[data-v]');
      if (!b) { if (e.target.classList.contains('mback')) back(); return; }
      const a = b.dataset.v;
      if (a === 'back') back();
      else if (a === 'setup') vaultSetup();
      else if (a === 'lock') { closeModal(); await vaultLockNow(); }
      else if (a === 'pass') {
        const cur = await needPass('Change passphrase', 'First, your current passphrase (or your recovery key).'); if (!cur) { draw(); return; }
        const np = await askNewPass({ title: 'New passphrase', lead: 'Your data and your backups are not re-encrypted, only the key that protects them is. Other devices that sync learn the new passphrase the next time they sync.', ok: 'Change passphrase' }); if (!np) { draw(); return; }
        try { await vaultChangePass(cur.secret, cur.how, np); toast('Passphrase changed'); } catch (err) { toast(err.message || 'Could not change the passphrase'); }
        draw();
      } else if (a === 'recovery') {
        const cur = await needPass('New recovery key', 'Making a new recovery key means the old one stops working. First, your passphrase.'); if (!cur) { draw(); return; }
        try { const text = await vaultNewRecovery(cur.secret, cur.how); vaultShowRecovery(text, draw); } catch (err) { toast(err.message || 'Could not make a recovery key'); draw(); }
      } else if (a === 'off') {
        const cur = await needPass('Turn off encryption', 'Everything will be written back unreadable-free: stored data, files, backups and (if sync is on) the cloud copy. First, your passphrase.'); if (!cur) { draw(); return; }
        if (!await askConfirm('Turn off encryption? From now on your data is stored, backed up and synced readable. Your other devices will ask before they accept an unencrypted cloud copy.', 'Turn off')) { draw(); return; }
        const busy = vaultBusy('Turning off encryption');
        try { await vaultDisable({ progress: busy.say }); if (Sync.on) { busy.say('Updating the cloud copy'); await syncNow(false); } closeModal(); toast('Encryption is off'); } catch (err) { closeModal(); toast(err.message || 'Could not turn encryption off'); }
        if (typeof paintSync === 'function') paintSync(); openVault();
      }
    };
  }
  draw();
}
// the guided "turn it on" dialog
function vaultSetup() {
  openModal(`<h3>${ic('shield', 18)} Turn on encryption</h3>
<form id="vk-f" autocomplete="off"><label class="vk-f"><span>Choose a passphrase</span><input type="password" id="vk-1" autocomplete="new-password" autocapitalize="off" spellcheck="false"></label><div id="vk-m" class="vk-meter">${vMeter('')}</div>
<label class="vk-f"><span>Repeat it</span><input type="password" id="vk-2" autocomplete="new-password" autocapitalize="off" spellcheck="false"></label>
<div class="vk-row"><label class="chkl"><input type="checkbox" id="vk-show"> Show</label></div>
<h4 class="mh">What to encrypt</h4><div class="vk-scopes">
<label class="vk-sc"><input type="checkbox" id="vk-s-local" checked><span><b>On this device</b><small>Stored data, attached files, automatic backups. Asks for the passphrase when the app opens.</small></span></label>
<label class="vk-sc"><input type="checkbox" id="vk-s-backup" checked><span><b>Backup files</b><small>Exports and downloaded backups.</small></span></label>
<label class="vk-sc"><input type="checkbox" id="vk-s-sync" checked><span><b>Cloud sync</b><small>The file on your server${Sync.on ? '' : ' (when you turn sync on)'}.</small></span></label></div>
<label class="chkl vk-rem"><input type="checkbox" id="vk-rem"> Remember me on this device <small>(do not ask for the passphrase each time)</small></label>
<label class="chkl vk-ack"><input type="checkbox" id="vk-ack"> I understand that if I lose both my passphrase and my recovery key, my encrypted data cannot be recovered by anyone, including OpenTick.</label>
<p class="vk-err" id="vk-e" role="alert"></p>
<div class="mact"><button type="button" data-v="cancel">Cancel</button><button class="pri" type="submit" id="vk-go" disabled>Turn on</button></div></form>`, m => {
    const a = $('#vk-1', m), b = $('#vk-2', m), ack = $('#vk-ack', m), go = $('#vk-go', m), err = $('#vk-e', m);
    if (a.focus) a.focus();
    const upd = () => { go.disabled = !(ack.checked && vStrength(a.value).ok && a.value === b.value); };
    a.oninput = () => { $('#vk-m', m).innerHTML = vMeter(a.value); err.textContent = ''; upd(); };
    b.oninput = upd; ack.onchange = upd;
    $('#vk-show', m).onchange = e => { a.type = b.type = e.target.checked ? 'text' : 'password'; };
    m.onclick = e => { if (e.target.closest('[data-v=cancel]') || e.target.classList.contains('mback')) openVault(); };
    $('#vk-f', m).onsubmit = async e => {
      e.preventDefault(); if (go.disabled) return;
      const scopes = { local: $('#vk-s-local', m).checked, backup: $('#vk-s-backup', m).checked, sync: $('#vk-s-sync', m).checked };
      if (!scopes.local && !scopes.backup && !scopes.sync) { err.textContent = 'Choose at least one thing to encrypt'; return; }
      const remember = $('#vk-rem', m).checked, pass = a.value, busy = vaultBusy('Encrypting your data');
      try {
        busy.say('Making your keys…');
        const rec = await vaultEnable(pass, scopes, { remember, progress: t => busy.say(t) });
        closeModal(); if (typeof paintSync === 'function') paintSync();
        vaultShowRecovery(rec, () => { openVault(); if (Sync.on) syncNow(false); });
      } catch (x) { closeModal(); toast((x && x.message) || 'Could not turn encryption on'); vaultSetup(); }
    };
  }, 'wide');
}
// shown once: the only other way into the data
function vaultShowRecovery(text, after) {
  openModal(`<h3>${ic('key', 18)} Save your recovery key</h3>
<p>If you forget your passphrase, this key is the only other way back into your data. It is shown <b>once</b>: OpenTick does not keep a readable copy. Store it somewhere safe and offline, such as a password manager or a printout. Anyone who has it can open your data.</p>
<div class="vk-key" id="vk-key" tabindex="0">${esc(text)}</div>
<div class="mrow"><button data-v="copy">${ic('copy', 14)} Copy</button><button data-v="save">${ic('download', 14)} Save as a file</button></div>
<label class="chkl vk-ack"><input type="checkbox" id="vk-ok"> I have saved my recovery key somewhere safe</label>
<div class="mact"><button class="pri" data-v="done" id="vk-done" disabled>Done</button></div>`, m => {
    const ok = $('#vk-ok', m), done = $('#vk-done', m);
    ok.onchange = () => { done.disabled = !ok.checked; };
    m.onclick = async e => {
      const b = e.target.closest('[data-v]'); if (!b) return; const a = b.dataset.v;
      if (a === 'copy') { try { await navigator.clipboard.writeText(text); toast('Recovery key copied'); } catch (err) { toast('Could not copy: select it and copy by hand'); } }
      else if (a === 'save') { try { if (await saveText(`opentick-recovery-key.txt`, `OpenTick recovery key\n\n${text}\n\nVault: ${Vault.cfg ? Vault.cfg.id : ''}\nMade: ${new Date().toISOString()}\n\nThis key opens your encrypted OpenTick data if you forget your passphrase. Keep this file somewhere safe and offline; anyone who has it can open your data.\n`, 'text/plain')) toast('Saved'); } catch (err) { toast('Could not save: ' + (err.message || err)); } }
      else if (a === 'done' && ok.checked) { closeModal(); if (after) after(); }
    };
  }, 'wide');
}
