/* OpenTick sync.
   One JSON file (opentick.json) lives on the provider. Each sync = download it, MERGE it with local data
   (see mergeData in core.js: last-writer-wins per record + tombstones), then upload the result if it differs.
   Uploads are conditional (If-Match / If-None-Match), so if another device wrote in between we just re-merge.
   A provider is { label, read(cfg, rev), write(cfg, text, rev, isNew) }, so adding S3, Dropbox etc. means adding one object.
     read  → { status: 'ok'|'nochange'|'missing', text?, rev? }
     write → { rev } or { conflict: true }
   Device-local and never synced: settings, view preferences, reminder history, and the credentials below. */
const SYNC_KEY = 'opentick.sync.v1', SYNC_FILE = 'opentick.json', SYNC_V = 2; // 2: adds tag colours + timetable slots (older apps refuse the file instead of silently dropping them)
const syncErr = msg => Object.assign(new Error(msg), { sync: true });

/* ---------- config (kept out of S so credentials never end up in backups or on the server) ---------- */
const syncDefaults = () => ({ provider: '', auto: true, device: uid(), rev: null, fp: null, last: 0, webdav: { url: '', folder: 'OpenTick', user: '', pass: '' }, file: { path: '', name: '' } });
function loadSyncCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(SYNC_KEY)), d = syncDefaults();
    if (c && typeof c === 'object') return { ...d, ...c, webdav: { ...d.webdav, ...c.webdav }, file: { ...d.file, ...c.file } };
  } catch (e) { /* fall through */ }
  return syncDefaults();
}
const saveSyncCfg = () => { try { localStorage.setItem(SYNC_KEY, JSON.stringify(Sync.cfg)); } catch (e) { /* ignore */ } };

/* ---------- transport: Tauri's HTTP plugin (no CORS) on desktop/mobile, plain fetch on the web ---------- */
async function httpx(method, url, headers, body) {
  const T = TAURI(), native = !!(T && T.http && T.http.fetch);
  try { return await (native ? T.http.fetch : fetch)(url, { method, headers, body, cache: 'no-store' }); }
  catch (e) {
    throw syncErr(native ? `Could not reach the server (${(e && e.message) || e})`
      : 'Could not reach the server: it may be offline, the URL may be wrong, or the server does not allow browser (CORS) requests. The desktop and mobile apps are not affected by CORS — see the README.');
  }
}
const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const authFail = r => { if (r.status === 401 || r.status === 403) throw syncErr(`The server rejected the login (${r.status}) — check username and (app) password`); };

/* ---------- provider: WebDAV (Nextcloud, ownCloud, Synology, Apache/nginx dav, Box, …) ---------- */
const dav = {
  label: 'WebDAV',
  where(c) {
    const base = c.url.trim().replace(/\/+$/, ''), segs = c.folder.split('/').map(x => x.trim()).filter(Boolean).map(encodeURIComponent);
    return { base, segs, file: [base, ...segs, SYNC_FILE].join('/') };
  },
  auth: c => (c.user || c.pass ? { Authorization: 'Basic ' + b64(c.user + ':' + c.pass) } : {}),
  async read(c, rev) {
    const h = dav.auth(c); if (rev) h['If-None-Match'] = rev;
    const r = await httpx('GET', dav.where(c).file, h);
    if (r.status === 304) return { status: 'nochange' };
    if (r.status === 404) return { status: 'missing' };
    authFail(r);
    if (!r.ok) throw syncErr(`The server answered ${r.status} ${r.statusText || ''}`.trim());
    return { status: 'ok', text: await r.text(), rev: r.headers.get('etag') };
  },
  async write(c, text, rev, isNew) {
    const { base, segs, file } = dav.where(c), h = { ...dav.auth(c), 'Content-Type': 'application/json; charset=utf-8' };
    if (isNew) h['If-None-Match'] = '*'; else if (rev && !/^W\//.test(rev)) h['If-Match'] = rev; // weak etags can't be used with If-Match
    let r = await httpx('PUT', file, h, text);
    if (r.status === 404 || r.status === 409) { // folder missing: create each level, then retry once
      let p = base;
      for (const s of segs) { p += '/' + s; await httpx('MKCOL', p, dav.auth(c)); }
      r = await httpx('PUT', file, h, text);
    }
    if (r.status === 412) return { conflict: true };
    authFail(r);
    if (!r.ok) throw syncErr(`Upload failed: the server answered ${r.status} ${r.statusText || ''}`.trim());
    return { rev: r.headers.get('etag') };
  },
};

/* ---------- provider: a file in a folder another tool syncs (Syncthing, Dropbox, OneDrive, iCloud Drive, Nextcloud client, …) ---------- */
const idb = (mode, fn) => new Promise((res, rej) => {
  const o = indexedDB.open('opentick', 1);
  o.onupgradeneeded = () => o.result.createObjectStore('kv');
  o.onerror = () => rej(o.error);
  o.onsuccess = () => { const tx = o.result.transaction('kv', mode), r = fn(tx.objectStore('kv')); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); };
});
const fileSupported = () => { const T = TAURI(), mobile = /Android|iPhone|iPad/i.test(navigator.userAgent || ''); return !!(T && T.fs && T.dialog && !mobile) || (!T && !!window.showSaveFilePicker); };
async function filePerm(h) {
  const o = { mode: 'readwrite' };
  if ((await h.queryPermission(o)) === 'granted') return;
  try { if ((await h.requestPermission(o)) === 'granted') return; } catch (e) { /* needs a click */ }
  throw syncErr('Permission to use the sync file is needed — press “Sync now”.');
}
async function fileRead(c) {
  const T = TAURI();
  let txt;
  if (T && T.fs) { try { txt = await T.fs.readTextFile(c.path); } catch (e) { if (/not found|no such file|os error 2|cannot find/i.test(String(e))) return null; throw syncErr('Could not read the sync file: ' + e); } }
  else {
    const h = await idb('readonly', s => s.get('file-handle')); if (!h) throw syncErr('No sync file chosen');
    await filePerm(h);
    try { txt = await (await h.getFile()).text(); } catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
  }
  return txt.trim() ? txt : null; // a freshly created, empty file counts as "no data yet"
}
const filep = {
  label: 'File or synced folder',
  async read(c, rev) {
    const txt = await fileRead(c); if (txt == null) return { status: 'missing' };
    const r = cyrb53(txt); return rev && r === rev ? { status: 'nochange' } : { status: 'ok', text: txt, rev: r };
  },
  async write(c, text, rev, isNew) {
    const cur = await fileRead(c), curRev = cur == null ? null : cyrb53(cur); // re-check right before writing
    if (isNew ? curRev !== null : rev && curRev !== rev) return { conflict: true };
    const T = TAURI();
    if (T && T.fs) await T.fs.writeTextFile(c.path, text);
    else { const h = await idb('readonly', s => s.get('file-handle')), w = await h.createWritable(); await w.write(text); await w.close(); }
    return { rev: cyrb53(text) };
  },
};
const PROVIDERS = { webdav: dav, file: filep };

/* ---------- engine ---------- */
const Sync = { cfg: loadSyncCfg(), state: 'off', msg: '', busy: false, queued: false, timer: 0, get on() { return !!(this.cfg.provider && PROVIDERS[this.cfg.provider]); } };
const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(ts).toLocaleDateString(); };

function buildPayload() {
  const snap = snapshot();
  return { snap, fp: fingerprint(snap), text: JSON.stringify({ app: 'opentick', schema: SYNC_V, device: Sync.cfg.device, at: Date.now(), ...snap }) };
}
function parsePayload(text) {
  let d; try { d = JSON.parse(text); } catch (e) { throw syncErr('The remote file is not valid JSON — leaving it alone'); }
  if (!d || d.app !== 'opentick' || !Array.isArray(d.tasks) || !Array.isArray(d.lists)) throw syncErr('The remote file is not an OpenTick sync file — refusing to overwrite it');
  if ((d.schema || 1) > SYNC_V) throw syncErr('The remote data was written by a newer OpenTick — please update this app');
  d.habits = d.habits || []; d.tags = d.tags || []; d.slots = d.slots || []; d.pomo = d.pomo || []; d.tomb = d.tomb || {};
  return d;
}
function setSync(state, msg = '') { Sync.state = state; Sync.msg = msg; paintSync(); }
function scheduleSync(ms) { clearTimeout(Sync.timer); if (Sync.on && Sync.cfg.auto) Sync.timer = setTimeout(() => syncNow(), ms); }

async function syncNow(manual) {
  if (!Sync.on) return;
  if (Sync.busy) { Sync.queued = true; return; }
  clearTimeout(Sync.timer);
  Sync.busy = true; setSync('busy');
  const c = Sync.cfg, P = PROVIDERS[c.provider], pc = c[c.provider];
  let changed = false;
  try {
    for (let n = 0; ; n++) {
      if (n >= 4) throw syncErr('The server keeps changing underneath us — will try again shortly');
      flush();
      const r = await P.read(pc, c.rev);
      flush(); // anything typed while we were waiting on the network is stamped before we merge
      let pushRev = c.rev;
      if (r.status === 'ok') {
        const remote = parsePayload(r.text), local = snapshot(), merged = mergeData(local, remote);
        if (fingerprint(merged) !== fingerprint(local)) {
          try { localStorage.setItem(KEY + '.premerge', JSON.stringify(S)); } catch (e) { /* best effort */ }
          applyMerged(merged); changed = true;
        }
        if (fingerprint(merged) === fingerprint(remote)) { c.rev = r.rev; c.fp = fingerprint(merged); break; } // already identical, nothing to upload
        pushRev = r.rev;
      } else if (r.status === 'nochange' && c.fp === fingerprint(snapshot())) break; // nobody changed anything
      const out = buildPayload();
      const w = await P.write(pc, out.text, pushRev, r.status === 'missing');
      if (w.conflict) continue; // someone else wrote first: loop re-reads and re-merges
      c.rev = w.rev || null; c.fp = out.fp; break;
    }
    c.last = Date.now(); saveSyncCfg(); setSync('ok');
    if (changed) afterRemote();
    if (manual) toast(changed ? 'Synced — received changes from another device' : 'Synced');
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const msg = e && e.sync ? e.message : 'Sync failed: ' + ((e && e.message) || e);
    setSync(offline ? 'offline' : 'error', msg);
    if (manual) toast(msg);
    if (!offline && !(e && e.sync && /rejected the login|refusing/.test(e.message))) scheduleSync(60000);
  } finally {
    Sync.busy = false;
    if (Sync.queued) { Sync.queued = false; scheduleSync(500); }
  }
}
// refresh the UI after remote data arrived, but never yank the screen out from under someone who is typing
function afterRemote() {
  if (U.sel && !getT(U.sel)) U.sel = null;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest && a.closest('#main,#detail')) { setTimeout(afterRemote, 1500); return; }
  refresh();
}
function startSync() {
  hooks.change = () => scheduleSync(5000); // 5 s after the last local edit
  setInterval(() => { if (Sync.cfg.auto && !document.hidden) syncNow(); }, 180000);
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Sync.cfg.auto && Date.now() - Sync.cfg.last > 30000) syncNow(); });
  if (Sync.on) setTimeout(() => syncNow(), 600);
}

/* ---------- status badge (sidebar) ---------- */
function syncStatusText() {
  const s = Sync.state, last = Sync.cfg.last ? ` · last sync ${ago(Sync.cfg.last)}` : '';
  if (!Sync.on) return 'Not connected';
  if (s === 'busy') return 'Syncing…';
  if (s === 'error' || s === 'offline') return `<span class="bad">${esc(Sync.msg || 'Offline')}</span>${last}`;
  return (Sync.cfg.last ? 'Up to date' : 'Connected') + last;
}
function syncBadge() {
  if (!Sync.on) return '';
  const s = Sync.state, tip = s === 'busy' ? 'Syncing…' : s === 'error' || s === 'offline' ? Sync.msg || 'Offline' : Sync.cfg.last ? 'Synced ' + ago(Sync.cfg.last) : 'Sync';
  return `<button class="ib sync ${s}" id="syncb" data-act="syncnow" title="${esc(tip)}" aria-label="Sync now">${ic(s === 'error' || s === 'offline' ? 'cloud-off' : s === 'busy' ? 'refresh' : 'cloud', 18)}</button>`;
}
function paintSync() {
  const b = $('#syncb'); if (b && b.outerHTML !== undefined) b.outerHTML = syncBadge();
  const m = $('#sy-status'); if (m) m.innerHTML = syncStatusText();
}

/* ---------- connect / disconnect / pick file ---------- */
async function connectSync(d) {
  const c = Sync.cfg;
  if (!d.provider) return disconnectSync();
  if (d.provider === 'webdav') {
    d.webdav.url = d.webdav.url.trim();
    if (!/^https?:\/\/\S+$/i.test(d.webdav.url)) { toast('Enter the full server address, starting with https://'); return false; }
  }
  if (d.provider === 'file' && !d.file.path && !d.file.name) { toast('Choose a file first'); return false; }
  Object.assign(c, { provider: d.provider, auto: d.auto, webdav: d.webdav, file: d.file, rev: null, fp: null });
  saveSyncCfg(); setSync('busy'); renderSide();
  await syncNow(true);
  return true;
}
function disconnectSync() {
  const c = Sync.cfg; c.provider = ''; c.rev = c.fp = null; c.webdav.pass = '';
  saveSyncCfg(); clearTimeout(Sync.timer); setSync('off'); renderSide();
  return true;
}
async function pickSyncFile(d) {
  const T = TAURI(), i = await askMenu('Sync file', [{ label: 'Use an existing file' }, { label: 'Create a new file' }]);
  if (i == null) return;
  const types = [{ description: 'JSON', accept: { 'application/json': ['.json'] } }];
  try {
    if (T && T.fs) {
      const filters = [{ name: 'JSON', extensions: ['json'] }];
      const p = pathOf(i === 0 ? await T.dialog.open({ multiple: false, filters }) : await T.dialog.save({ defaultPath: 'opentick-sync.json', filters }));
      if (p) d.file = { path: p, name: p.split(/[\\/]/).pop() };
    } else {
      const h = i === 0 ? (await window.showOpenFilePicker({ types }))[0] : await window.showSaveFilePicker({ suggestedName: 'opentick-sync.json', types });
      await idb('readwrite', s => s.put(h, 'file-handle'));
      d.file = { path: '', name: h.name };
    }
  } catch (e) { if (e.name !== 'AbortError') toast('Could not choose the file: ' + (e.message || e)); }
}
async function undoMerge() {
  let raw = null; try { raw = localStorage.getItem(KEY + '.premerge'); } catch (e) { /* ignore */ }
  if (!raw) { toast('Nothing to undo'); return; }
  if (!await askConfirm('Put your data back the way it was before the last sync brought in changes? Newer changes made since then are lost on this device and the other devices are updated to match.', 'Undo')) return;
  replaceAll(JSON.parse(raw)); U.sel = null; render(); toast('Restored'); syncNow();
}

/* ---------- dialog ---------- */
function openSync() {
  const c = Sync.cfg, d = { provider: c.provider, auto: c.auto, webdav: { ...c.webdav }, file: { ...c.file } };
  const fld = (label, key, type = 'text', ph = '') => `<label>${label}<input type="${type}" data-sy="${key}" value="${esc(key.split('.').reduce((o, k) => o[k], d))}" placeholder="${esc(ph)}" autocomplete="${type === 'password' ? 'new-password' : 'off'}" spellcheck="false" autocapitalize="off"></label>`;
  const draw = () => {
    const web = !(TAURI() && TAURI().http);
    const body = d.provider === 'webdav'
      ? fld('Server address', 'webdav.url', 'url', 'https://cloud.example.com/remote.php/dav/files/me/') + fld('Folder', 'webdav.folder', 'text', 'OpenTick') + fld('Username', 'webdav.user') + fld('Password (use an app password)', 'webdav.pass', 'password')
        + `<p class="hint">Works with Nextcloud, ownCloud, Synology, Apache/nginx WebDAV and more. The password is stored on this device only.${web ? ' In a browser the server must allow CORS (see the README); the desktop and mobile apps don’t need that.' : ''}</p>`
      : d.provider === 'file'
        ? `<label>File<div class="filerow"><span>${esc(d.file.path || d.file.name || 'None chosen')}</span><button data-m="pickfile">Choose…</button></div></label><p class="hint">Pick a file inside a folder that Syncthing, Dropbox, OneDrive, iCloud Drive or a Nextcloud client already keeps in sync.</p>`
        : '<p class="hint">Sync keeps your tasks, lists, tag colours, timetable, habits and focus history identical on all your devices. Changes made on different devices are merged; the most recent edit to a task wins.</p>';
    openModal(`<h3>Sync</h3><div class="form one"><label>Provider<select data-sy="provider">${opts([['', 'Off'], ['webdav', 'WebDAV'], ...(fileSupported() ? [['file', 'File or synced folder']] : [])], d.provider)}</select></label>${body}
${d.provider ? `<label class="inl"><input type="checkbox" data-sy="auto"${d.auto ? ' checked' : ''}> Sync automatically</label>` : ''}</div>
<p class="hint" id="sy-status">${syncStatusText()}</p>
<div class="mrow"><button class="pri" data-m="save">${d.provider ? 'Save &amp; sync' : 'Save'}</button>${Sync.on ? '<button data-m="now">Sync now</button><button data-m="undo">Undo last merge</button><button class="danger" data-m="off">Disconnect</button>' : ''}</div>
<div class="mact"><button data-m="close">Close</button></div>`, m => {
      const upd = e => {
        const el = e.target, k = el.dataset.sy; if (!k) return;
        if (k === 'provider') { d.provider = el.value; draw(); }
        else if (k === 'auto') d.auto = el.checked;
        else { const [g, f] = k.split('.'); d[g][f] = el.value; }
      };
      m.oninput = e => { if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') upd(e); };
      m.onchange = upd;
      m.onclick = async e => {
        const b = e.target.closest('[data-m]');
        if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
        const a = b.dataset.m;
        if (a === 'close') closeModal();
        else if (a === 'pickfile') { await pickSyncFile(d); draw(); }
        else if (a === 'save') { if (await connectSync(d)) { if (!d.provider) closeModal(); else draw(); } }
        else if (a === 'now') syncNow(true);
        else if (a === 'undo') { closeModal(); undoMerge(); }
        else if (a === 'off') { disconnectSync(); closeModal(); toast('Sync turned off'); }
      };
    }, 'wide');
  };
  draw();
}
