/* OpenTick update check: finds out whether a newer release exists, and tells you. It never downloads or installs anything: it opens the
   release page and you choose what to do.

   OFF BY DEFAULT. OpenTick makes no request to anyone until you either turn on "Check for updates automatically" or press "Check now".
   With it on, the app asks GitHub's public "latest release" endpoint for this project (api.github.com), at most once a day while it is open.
   The request carries nothing about you, your data or your settings: only what any web request carries (your IP address and a generic
   client name), which GitHub sees. The answer is used for the version number and the link, and the link is only followed when it points at
   this project's own releases on github.com.

   The choice is a setting of this device (S.settings.upd = { auto, last, ok, seen, found }), so it is never synced and it is sealed with the
   other settings when device encryption is on. It holds no data of yours.
   Store and package-manager installs (Microsoft Store, Snap, Chocolatey, F-Droid …) are updated by their own store: the notice says so. */
const UPD_REPO = 'JebbyCodes/OpenTick';
const UPD_API = `https://api.github.com/repos/${UPD_REPO}/releases/latest`, UPD_PAGE = `https://github.com/${UPD_REPO}/releases/latest`;
const UPD_OK_EVERY = 24 * 36e5, UPD_RETRY = 2 * 36e5, UPD_TIMEOUT = 12000;
const UPD_VER = /^[0-9A-Za-z.+-]{1,30}$/;
const UPD = { busy: false, timer: 0 };
const updFail = m => Object.assign(new Error(m), { upd: true }); // a sentence that is already fit to show
// the version running now (a function so that a test can stand in for it; a development build has no number)
function updHave() { return APP_VERSION; }
const updCfg = () => { const s = S.settings; return s.upd && typeof s.upd === 'object' ? s.upd : (s.upd = { auto: false, last: 0, ok: false, seen: '', found: '' }); };

// "v0.7.0" / "0.7.0-rc.1" -> { n: [0, 7, 0], pre: 'rc.1' } ; null for anything else
function updParse(v) {
  const m = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})(?:-([0-9A-Za-z.-]{1,20}))?(?:\+[0-9A-Za-z.-]{1,20})?$/.exec(String(v || '').trim());
  return m ? { n: [+m[1], +m[2], +m[3]], pre: m[4] || '' } : null;
}
// is version a newer than version b? A pre-release (0.8.0-rc.1) comes before the release it leads up to (0.8.0).
function updNewer(a, b) {
  const x = updParse(a), y = updParse(b); if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] > y.n[i];
  if (x.pre === y.pre) return false;
  if (!x.pre) return true; if (!y.pre) return false;
  return x.pre.localeCompare(y.pre, 'en', { numeric: true }) > 0;
}
// only this project's own release pages are ever opened
const updLink = u => (typeof u === 'string' && u.startsWith(`https://github.com/${UPD_REPO}/`) && !/[\s"'<>]/.test(u) ? u : UPD_PAGE);

// ask GitHub. Resolves to { state: 'new' | 'current' | 'error', version, url, error }. Never throws.
async function updCheck() {
  const cfg = updCfg(); let timer;
  try {
    const r = await Promise.race([
      httpx('GET', UPD_API, { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timed out')), UPD_TIMEOUT); }),
    ]);
    clearTimeout(timer);
    if (r.status === 403 || r.status === 429) throw updFail('GitHub is limiting requests right now. Try again later.');
    if (r.status === 404) throw updFail('No release was found.');
    if (!r.ok) throw updFail(`GitHub answered ${r.status}.`);
    const j = await r.json(), tag = j && typeof j.tag_name === 'string' ? j.tag_name.trim() : '';
    if (!updParse(tag)) throw updFail('GitHub sent an answer that could not be understood.');
    const version = tag.replace(/^v/, ''), found = { state: updNewer(version, updHave()) ? 'new' : 'current', version, url: updLink(j.html_url) };
    cfg.last = Date.now(); cfg.ok = true; cfg.found = found.state === 'new' && UPD_VER.test(version) ? version : ''; save();
    return found;
  } catch (e) {
    clearTimeout(timer);
    cfg.last = Date.now(); cfg.ok = false; save();
    return { state: 'error', error: e && e.upd ? e.message : 'Could not reach GitHub. Are you online?' };
  }
}

// the automatic check: only when it was turned on, not more than once a day (two hours after a failure), and only the main window
const updDue = (now = Date.now()) => { const c = updCfg(); return c.auto === true && now - (c.last || 0) >= (c.ok ? UPD_OK_EVERY : UPD_RETRY); };
async function updAuto() {
  if (WIDGET || UPD.busy || !updDue()) return null;
  UPD.busy = true;
  try {
    const r = await updCheck(), c = updCfg();
    if (r.state === 'new' && c.seen !== r.version) { // each version is announced once; Settings → About always shows it
      c.seen = r.version; save();
      toast(`OpenTick ${r.version} is available`, { label: 'See what’s new', fn: () => openExternal(r.url) });
    }
    updRefresh(); return r;
  } finally { UPD.busy = false; }
}
function updStart() {
  if (UPD.timer) return; // once per run
  setTimeout(() => { updAuto(); }, 9000);
  UPD.timer = setInterval(() => { updAuto(); }, 30 * 60000) || 1;
}

/* ---------- Settings → About & privacy ---------- */
const updWhen = t => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function updStatusHtml(r) {
  const c = updCfg();
  if (r && r.state === 'new') return `<b>Version ${esc(r.version)} is available</b> (you have ${esc(updHave())}). <a href="${esc(r.url)}" data-updact="open">Open the release page</a>`;
  if (r && r.state === 'current') return updParse(updHave()) ? `You have the latest version (${esc(updHave())}). Checked ${esc(updWhen(c.last))}.` : `This is a development build (${esc(updHave())}). The latest release is ${esc(r.version)}.`;
  if (r && r.state === 'error') return `${esc(r.error)}`;
  if (c.found && updNewer(c.found, updHave())) return `<b>Version ${esc(c.found)} is available</b> (you have ${esc(updHave())}). <a href="${UPD_PAGE}" data-updact="open">Open the release page</a>`;
  if (c.last && c.ok) return `You have the latest version (${esc(updHave())}). Checked ${esc(updWhen(c.last))}.`;
  return 'Not checked yet.';
}
function updSettingsHtml() {
  const c = updCfg();
  return `<div class="upd" id="upd"><h4 class="mh">Updates</h4>`
    + `<div class="mrow tight"><label class="chkl"><input type="checkbox" data-upd="auto"${c.auto === true ? ' checked' : ''}> Check for updates automatically</label></div>`
    + `<div class="mrow tight"><button class="btn sm" data-updact="check">${ic('refresh', 13)} Check now</button><span class="hint updst" role="status" aria-live="polite">${updStatusHtml()}</span></div>`
    + `<p class="hint">Off by default. When it is on, OpenTick asks GitHub (api.github.com) once a day whether a newer release exists. Nothing about you or your data is sent, only the request itself, which GitHub sees like any web request. “Check now” sends one request, only when you press it. OpenTick never downloads or installs anything by itself. If you installed it from a store or a package manager, update it there.</p></div>`;
}
function updRefresh(r) { const el = typeof $ === 'function' ? $('#upd .updst') : null; if (el) el.innerHTML = updStatusHtml(r); }
async function updAction(el) {
  const a = el.dataset.updact;
  if (a === 'open') { const u = el.getAttribute && el.getAttribute('href'); openExternal(updLink(u)); return; }
  if (a !== 'check' || UPD.busy) return;
  UPD.busy = true; const st = typeof $ === 'function' ? $('#upd .updst') : null; if (st) st.textContent = 'Checking…';
  try { const r = await updCheck(); updRefresh(r); } finally { UPD.busy = false; }
}
function updToggle(on) {
  const c = updCfg(); c.auto = on === true; if (c.auto) c.last = 0; save();
  if (c.auto) setTimeout(() => { updAuto(); }, 400); // turning it on checks once straight away
}
