/* OpenTick sync.
   One JSON file (opentick.json) lives on the provider. Each sync = download it, MERGE it with local data
   (see mergeData in core.js: last-writer-wins per record + tombstones), then upload the result if it differs.
   Uploads are conditional (If-Match / If-None-Match), so if another device wrote in between we just re-merge.
   A provider is { label, read(cfg, rev), write(cfg, text, rev, isNew) }, so adding S3, Dropbox etc. means adding one object.
     read  → { status: 'ok'|'nochange'|'missing', text?, rev? }
     write → { rev } or { conflict: true }
   Device-local and never synced: settings, view preferences, reminder history, and the credentials below. */
const SYNC_KEY = 'opentick.sync.v1', SYNC_FILE = 'opentick.json', SYNC_V = 3; // 2: adds tag colours + timetable slots; 3: adds notes (older apps refuse the file instead of silently dropping them)
const syncErr = msg => Object.assign(new Error(msg), { sync: true });

/* ---------- config (kept out of S so credentials never end up in backups or on the server) ---------- */
const syncDefaults = () => ({ provider: '', auto: true, device: uid(), rev: null, fp: null, last: 0, webdav: { url: '', folder: 'OpenTick', user: '', pass: '' }, file: { path: '', name: '' }, git: { base: 'https://api.github.com', repo: '', path: 'opentick.json', branch: '', token: '' }, s3: { endpoint: '', region: 'us-east-1', bucket: '', key: 'opentick.json', access: '', secret: '' } });
function loadSyncCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(SYNC_KEY)), d = syncDefaults();
    if (c && typeof c === 'object') return { ...d, ...c, webdav: { ...d.webdav, ...c.webdav }, file: { ...d.file, ...c.file }, git: { ...d.git, ...c.git }, s3: { ...d.s3, ...c.s3 } };
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
/* ---------- provider: a Git repository file (GitHub, GitHub Enterprise, Gitea, Forgejo, Codeberg) ----------
   Uses the "contents" API. The file's blob SHA is the revision, and a write that names an outdated SHA is refused, which is
   exactly the conditional write sync needs. Use a private repository that exists just for this; every sync that changes
   something is one commit. The token needs read and write access to that repository's contents. Files up to 1 MB. */
const bytesToB64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const b64ToText = b => new TextDecoder().decode(Uint8Array.from(atob(String(b).replace(/\s/g, '')), c => c.charCodeAt(0)));
const gitp = {
  label: 'Git repository',
  url(c) {
    const base = c.base.trim().replace(/\/+$/, ''), path = c.path.split('/').map(x => x.trim()).filter(Boolean).map(encodeURIComponent).join('/');
    return `${base}/repos/${c.repo.trim().replace(/^\/+|\/+$/g, '')}/contents/${path}${c.branch.trim() ? '?ref=' + encodeURIComponent(c.branch.trim()) : ''}`;
  },
  headers: c => ({ Authorization: 'token ' + c.token.trim(), Accept: 'application/vnd.github+json' }),
  async read(c, rev) {
    const r = await httpx('GET', gitp.url(c), gitp.headers(c));
    if (r.status === 404) return { status: 'missing' }; // no file yet (a wrong repository name shows up on the first upload)
    authFail(r);
    if (!r.ok) throw syncErr(`The server answered ${r.status} ${r.statusText || ''}`.trim());
    const j = await r.json();
    if (rev && j.sha === rev) return { status: 'nochange' };
    if (!j.content && j.size > 0) throw syncErr('The sync file is larger than 1 MB, which the contents API cannot read');
    return { status: 'ok', text: b64ToText(j.content || ''), rev: j.sha };
  },
  async write(c, text, rev, isNew) {
    const body = { message: 'OpenTick sync', content: bytesToB64(new TextEncoder().encode(text)) };
    if (!isNew && rev) body.sha = rev; if (c.branch.trim()) body.branch = c.branch.trim();
    const r = await httpx('PUT', gitp.url(c).replace(/\?ref=.*$/, ''), { ...gitp.headers(c), 'Content-Type': 'application/json' }, JSON.stringify(body));
    if (r.status === 409 || r.status === 422) { const j = await r.json().catch(() => ({})); if (r.status === 409 || /sha|exist|conflict/i.test(j.message || '')) return { conflict: true }; throw syncErr('The repository refused the upload: ' + (j.message || r.status)); }
    if (r.status === 404) throw syncErr('Repository not found, or the token is not allowed to write to it');
    authFail(r);
    if (!r.ok) throw syncErr(`Upload failed: the server answered ${r.status} ${r.statusText || ''}`.trim());
    const j = await r.json(); return { rev: (j.content && j.content.sha) || null };
  },
};

/* ---------- provider: S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO, …) ----------
   Requests are signed with AWS Signature V4 in the browser (Web Crypto). The ETag is the revision and writes are
   conditional (If-Match / If-None-Match). A browser needs CORS on the bucket (allow GET, PUT, the headers
   authorization, content-type, if-match, if-none-match, x-amz-*, and expose ETag); the desktop and mobile apps do not. */
const hexOf = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const utf8 = s => (typeof s === 'string' ? new TextEncoder().encode(s) : s);
const sha256hex = async d => hexOf(await crypto.subtle.digest('SHA-256', utf8(d)));
async function hmac256(key, data) { const k = await crypto.subtle.importKey('raw', utf8(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC', k, utf8(data))); }
// -> request headers including Authorization (pure apart from `date`, so it can be checked against AWS's published examples)
async function sigV4({ method, url, headers = {}, payloadHash, access, secret, region, service = 's3', date = new Date() }) {
  const u = new URL(url), amz = date.toISOString().replace(/[:-]|\.\d{3}/g, ''), day = amz.slice(0, 8), h = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
  h.host = u.host; h['x-amz-date'] = amz; h['x-amz-content-sha256'] = payloadHash;
  const names = Object.keys(h).sort(), signed = names.join(';'), query = [...u.searchParams].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const canonical = [method, u.pathname, query, names.map(n => n + ':' + h[n] + '\n').join(''), signed, payloadHash].join('\n'), scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amz, scope, await sha256hex(canonical)].join('\n');
  let k = await hmac256('AWS4' + secret, day); for (const part of [region, service, 'aws4_request']) k = await hmac256(k, part);
  const sig = hexOf(await hmac256(k, toSign)), out = { ...headers, 'x-amz-date': amz, 'x-amz-content-sha256': payloadHash, Authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope},SignedHeaders=${signed},Signature=${sig}` };
  return out;
}
const s3p = {
  label: 'S3-compatible storage',
  url: c => `${c.endpoint.trim().replace(/\/+$/, '')}/${encodeURIComponent(c.bucket.trim())}/${c.key.split('/').map(encodeURIComponent).join('/')}`,
  async call(c, method, headers, body) {
    if (!(typeof crypto !== 'undefined' && crypto.subtle)) throw syncErr('This browser context cannot sign requests (Web Crypto needs https). Use the desktop or mobile app, or open OpenTick over https.');
    const url = s3p.url(c), h = await sigV4({ method, url, headers, payloadHash: await sha256hex(body == null ? '' : body), access: c.access.trim(), secret: c.secret.trim(), region: c.region.trim() || 'us-east-1' });
    return httpx(method, url, h, body);
  },
  async read(c, rev) {
    const r = await s3p.call(c, 'GET', rev ? { 'If-None-Match': rev } : {});
    if (r.status === 304) return { status: 'nochange' };
    if (r.status === 404) return { status: 'missing' };
    authFail(r);
    if (!r.ok) throw syncErr(`The storage service answered ${r.status} ${r.statusText || ''}`.trim());
    return { status: 'ok', text: await r.text(), rev: r.headers.get('etag') };
  },
  async write(c, text, rev, isNew) {
    const cond = isNew ? { 'If-None-Match': '*' } : rev ? { 'If-Match': rev } : {};
    let r = await s3p.call(c, 'PUT', { ...cond, 'Content-Type': 'application/json' }, text);
    if (r.status === 501 && Object.keys(cond).length) r = await s3p.call(c, 'PUT', { 'Content-Type': 'application/json' }, text); // a service without conditional writes: sync still merges before it writes
    if (r.status === 412 || r.status === 409) return { conflict: true };
    authFail(r);
    if (!r.ok) throw syncErr(`Upload failed: the storage service answered ${r.status} ${r.statusText || ''}`.trim());
    return { rev: r.headers.get('etag') };
  },
};
const PROVIDERS = { webdav: dav, file: filep, git: gitp, s3: s3p };
const DAV_PRESETS = [['', 'Other WebDAV server', ''], ['nextcloud', 'Nextcloud / ownCloud', 'https://YOUR-SERVER/remote.php/dav/files/USERNAME/'], ['box', 'Box', 'https://dav.box.com/dav'], ['pcloud', 'pCloud (EU)', 'https://ewebdav.pcloud.com'], ['pcloudus', 'pCloud (US)', 'https://webdav.pcloud.com'], ['koofr', 'Koofr', 'https://app.koofr.net/dav/Koofr'], ['yandex', 'Yandex Disk', 'https://webdav.yandex.com'], ['synology', 'Synology NAS', 'https://YOUR-NAS:5006/']];

/* ---------- automatic local backups: one snapshot a day, the last 7 kept in this browser's IndexedDB ---------- */
const SNAP_KEEP = 7;
async function snapKeys() { try { return ((await idb('readonly', s => s.getAllKeys())) || []).filter(k => /^snap:/.test(k)).sort(); } catch (e) { return []; } }
async function snapList() {
  const out = [];
  for (const k of await snapKeys()) { try { const v = await idb('readonly', s => s.get(k)); if (v) out.push({ key: k, at: v.at, tasks: v.tasks, fp: v.fp, tag: v.tag || '' }); } catch (e) { /* skip */ } }
  return out.reverse();
}
// `tag` makes a separate restore point ("Before deleting everything") that the daily copy cannot overwrite; returns the key, or false
async function snapSave(force, tag) {
  if (typeof WIDGET !== 'undefined' && WIDGET) return false;
  try {
    flush(); const key = 'snap:' + todayStr() + (tag ? '~' + tag + '-' + Date.now().toString(36) : ''), fp = fingerprint(snapshot()), cur = tag ? null : await idb('readonly', s => s.get(key));
    if (cur && cur.fp === fp && !force) return false;
    await idb('readwrite', s => s.put({ at: Date.now(), tasks: S.tasks.filter(t => !t.deleted).length, fp, tag: tag || '', data: JSON.stringify({ ...S, history: [] }) }, key));
    const keys = await snapKeys(); for (const k of keys.slice(0, Math.max(0, keys.length - SNAP_KEEP))) await idb('readwrite', s => s.delete(k));
    return key;
  } catch (e) { return false; }
}
async function snapRestore(key) { const v = await idb('readonly', s => s.get(key)); if (!v) throw new Error('That backup is gone'); await snapSave(true); replaceAll(JSON.parse(v.data)); histNote('import', 'Restored the automatic backup from ' + key.slice(5, 15)); save(); }
async function snapDownload(key) { const v = await idb('readonly', s => s.get(key)); if (!v) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([v.data], { type: 'application/json' })); a.download = `opentick-backup-${key.slice(5).replace(/[^\w-]+/g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

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
  d.habits = d.habits || []; d.tags = d.tags || []; d.slots = d.slots || []; d.notes = d.notes || []; d.projects = d.projects || []; d.school = d.school || []; d.pomo = d.pomo || []; d.tomb = d.tomb || {};
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
  if (typeof WIDGET !== 'undefined' && WIDGET) return;
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
  if (typeof paintDock === 'function') paintDock();
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
  if (d.provider === 'git') {
    d.git.base = d.git.base.trim() || 'https://api.github.com';
    if (!/^[\w.-]+\/[\w.-]+$/.test(d.git.repo.trim())) { toast('Enter the repository as owner/name'); return false; }
    if (!d.git.token.trim()) { toast('Paste an access token that can write to the repository'); return false; }
    if (!d.git.path.trim()) d.git.path = 'opentick.json';
  }
  if (d.provider === 's3') {
    if (!/^https?:\/\/\S+$/i.test(d.s3.endpoint.trim())) { toast('Enter the service endpoint, starting with https://'); return false; }
    if (!d.s3.bucket.trim() || !d.s3.access.trim() || !d.s3.secret.trim()) { toast('Bucket, access key and secret key are all needed'); return false; }
    if (!d.s3.key.trim()) d.s3.key = 'opentick.json';
  }
  Object.assign(c, { provider: d.provider, auto: d.auto, webdav: d.webdav, file: d.file, git: d.git, s3: d.s3, rev: null, fp: null });
  saveSyncCfg(); setSync('busy'); renderSide();
  await syncNow(true);
  return true;
}
function disconnectSync() {
  const c = Sync.cfg; c.provider = ''; c.rev = c.fp = null; c.webdav.pass = ''; c.git.token = ''; c.s3.secret = '';
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
  replaceAll(JSON.parse(raw)); histNote('import', 'Restored the data from before the last sync'); save(); U.sel = null; render(); toast('Restored'); syncNow();
}

/* ---------- dialog ---------- */
const syncFormGit = fld => fld('Repository (owner/name)', 'git.repo', 'text', 'me/opentick-data') + fld('Access token', 'git.token', 'password', 'ghp_… or a Gitea token') + fld('File in the repository', 'git.path', 'text', 'opentick.json') + fld('Branch (blank = default)', 'git.branch', 'text', 'main') + fld('API address', 'git.base', 'url', 'https://api.github.com')
  + '<p class="hint">Use a private repository made for this. GitHub: a fine-grained token with “Contents: read and write” on that repository. Gitea / Forgejo / Codeberg: set the API address to https://your-host/api/v1. The token stays on this device; each sync that changes something is one commit.</p>';
const syncFormS3 = fld => fld('Endpoint', 's3.endpoint', 'url', 'https://s3.us-east-1.amazonaws.com') + fld('Region', 's3.region', 'text', 'us-east-1 (auto for R2)') + fld('Bucket', 's3.bucket') + fld('Object name', 's3.key', 'text', 'opentick.json') + fld('Access key ID', 's3.access') + fld('Secret access key', 's3.secret', 'password')
  + `<p class="hint">Works with AWS S3, Cloudflare R2 (endpoint https://ACCOUNT.r2.cloudflarestorage.com, region auto), Backblaze B2, Wasabi and MinIO. Use a key limited to this bucket. The secret stays on this device.${TAURI() && TAURI().http ? '' : ' In a browser the bucket needs a CORS rule (allow GET and PUT, expose ETag); the desktop and mobile apps do not.'}</p>`;
function openSync() {
  const c = Sync.cfg, d = { provider: c.provider, auto: c.auto, webdav: { ...c.webdav }, file: { ...c.file }, git: { ...c.git }, s3: { ...c.s3 }, preset: '' };
  const fld = (label, key, type = 'text', ph = '') => `<label>${label}<input type="${type}" data-sy="${key}" value="${esc(key.split('.').reduce((o, k) => o[k], d))}" placeholder="${esc(ph)}" autocomplete="${type === 'password' ? 'new-password' : 'off'}" spellcheck="false" autocapitalize="off"></label>`;
  const draw = () => {
    const web = !(TAURI() && TAURI().http);
    const body = d.provider === 'git' ? syncFormGit(fld) : d.provider === 's3' ? syncFormS3(fld) : d.provider === 'webdav'
      ? `<label>Service<select data-sy="preset">${DAV_PRESETS.map(([k, n]) => `<option value="${k}"${d.preset === k ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` + fld('Server address', 'webdav.url', 'url', 'https://cloud.example.com/remote.php/dav/files/me/') + fld('Folder', 'webdav.folder', 'text', 'OpenTick') + fld('Username', 'webdav.user') + fld('Password (use an app password)', 'webdav.pass', 'password')
        + `<p class="hint">Works with Nextcloud, ownCloud, Synology, Apache/nginx WebDAV and more. The password is stored on this device only.${web ? ' In a browser the server must allow CORS (see the README); the desktop and mobile apps don’t need that.' : ''}</p>`
      : d.provider === 'file'
        ? `<label>File<div class="filerow"><span>${esc(d.file.path || d.file.name || 'None chosen')}</span><button data-m="pickfile">Choose…</button></div></label><p class="hint">Pick a file inside a folder that Syncthing, Dropbox, OneDrive, iCloud Drive or a Nextcloud client already keeps in sync.</p>`
        : '<p class="hint">Sync keeps your tasks, lists, tag colours, timetable, habits and focus history identical on all your devices. Changes made on different devices are merged; the most recent edit to a task wins.</p>';
    openModal(`<h3>Sync</h3><div class="form one"><label>Provider<select data-sy="provider">${opts([['', 'Off'], ['webdav', 'WebDAV (Nextcloud, Box, pCloud…)'], ['git', 'Git repository (GitHub, Gitea…)'], ['s3', 'S3 storage (AWS, R2, B2, MinIO…)'], ...(fileSupported() ? [['file', 'File or synced folder']] : [])], d.provider)}</select></label>${body}
${d.provider ? `<label class="inl"><input type="checkbox" data-sy="auto"${d.auto ? ' checked' : ''}> Sync automatically</label>` : ''}</div>
<p class="hint" id="sy-status">${syncStatusText()}</p>
<div class="mrow"><button class="pri" data-m="save">${d.provider ? 'Save &amp; sync' : 'Save'}</button>${Sync.on ? '<button data-m="now">Sync now</button><button data-m="undo">Undo last merge</button><button class="danger" data-m="off">Disconnect</button>' : ''}</div>
<div class="mact"><button data-m="close">Close</button></div>`, m => {
      const upd = e => {
        const el = e.target, k = el.dataset.sy; if (!k) return;
        if (k === 'provider') { d.provider = el.value; draw(); }
        else if (k === 'preset') { d.preset = el.value; const pr = DAV_PRESETS.find(x => x[0] === el.value); if (pr && pr[2]) d.webdav.url = pr[2]; draw(); }
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
