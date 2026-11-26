/* OpenTick pack usage counts (0.9.1): the opt-in, anonymous "this pack was really used" count that the pack library's website shows ("Used 1,245 times").

   OFF until the person turns it on, in Settings > Sections & packs. While it is off nothing here makes a token or makes a request, and nothing is remembered except, if it was on before, the list of packs this device has already counted (`done`, device-only), kept so that turning it back on does not count them twice.

   What counts as "used": after a pack that came from the LIBRARY (not a file or pasted text: a changed copy of a pack must never be counted as the original) has
   been added, the first time the person on this device
     • saves or ticks off an entry in one of its sections,
     • runs one of its actions, or
     • picks one of its colour themes.
   Adding the pack, browsing the library and downloading a pack file are never counted: this is a count of use, not of downloads, and the website says so.

   What is sent, once per pack per device, when that first use happens:
     POST <usage service>/use      { "pack": "<the pack's id>", "token": "<32 random hex characters>" }
   and nothing else: no entry, note, task, field value, book title or name; no account, device or user identifier; no version, no time zone, no language. The token is
   random, made for that ONE pack on that ONE device, kept only until the service has said it has the count, and then deleted. It exists only so that a repeated
   request (a retry after the answer was lost) is not counted twice; it is not shared by two packs and it is never sent with anything else. The service keeps a hash
   of pack + token and one running total per pack. Like any web request, the request itself carries the device's IP address; the service does not store it.

   Where it goes: the address is published by the library itself, in its index.json ("usage"), checked here (https only, no login, no query) and remembered on this
   device (only while counting is on; turning it on asks for that public index file, which carries nothing about the person). If the library publishes none, or the
   service cannot be reached, nothing is shown to the person: the count stays queued on this device and is tried again later, and is dropped for good, with the
   address, when the person turns the setting off.

   Stored on this device only (settings.packStats is not in PREF_SYNC, so it is never uploaded by sync):
     { on, url, done: { <pack id>: <time> }, pend: { <pack id>: { t: <token>, at, next } } }
   A second device of the same person is a second installation: it counts once more, after that person turned the setting on there too. */
const PKST = { timeout: 8000, backoff: [60e3, 5 * 60e3, 30 * 60e3, 6 * 3600e3], max: 40, busy: false, timer: 0 };

const pkstBox = () => { const o = S.settings.packStats; return o && typeof o === 'object' && !Array.isArray(o) ? o : null; };
const pkstOn = () => { const o = pkstBox(); return !!(o && o.on === true); };
function pkstState() { // the stored state, made safe to read (a damaged value never breaks anything)
  let o = pkstBox(); if (!o) o = S.settings.packStats = { on: false };
  if (!o.done || typeof o.done !== 'object' || Array.isArray(o.done)) o.done = {};
  if (!o.pend || typeof o.pend !== 'object' || Array.isArray(o.pend)) o.pend = {};
  if (typeof o.url !== 'string') o.url = '';
  return o;
}

// an address the library published: https, no login, no query, no fragment; '' when it is anything else
function pkstUrlOk(u) {
  if (typeof u !== 'string' || u.length > 200) return '';
  let x; try { x = new URL(u); } catch (e) { return ''; }
  if (x.protocol !== 'https:' || x.username || x.password || x.search || x.hash || !/\./.test(x.hostname)) return '';
  return (x.origin + x.pathname).replace(/\/+$/, '');
}
// called with every index the library sends (packlib.js), and only while counting is on: remembers its usage address, or forgets it when the library no longer publishes one
function pkstLearn(raw) {
  if (!pkstOn()) return; // off: not even the library's address is kept
  const o = pkstState(), u = pkstUrlOk(raw);
  if (o.url !== u) { o.url = u; if (typeof save === 'function') save(); pkstSchedule(); }
}

// the packs this device may count: installed from the library and still installed
function pkstEligible(packId) {
  const r = typeof pksRec === 'function' ? pksRec(packId) : null;
  return !!(r && r.source && r.source.kind === 'library' && r.state === 'installed');
}
function pkstToken() {
  try { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, v => v.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } // no random source: no count (never a weak token)
}

// THE entry point: this pack was just used by the person. Cheap when off, and never throws.
function pkstUse(packId) {
  try {
    if (!pkstOn() || typeof packId !== 'string' || !packId) return;
    const o = pkstState(); if (o.done[packId] || o.pend[packId] || !pkstEligible(packId)) return;
    if (Object.keys(o.pend).length >= PKST.max) return;
    const t = pkstToken(); if (!t) return;
    o.pend[packId] = { t, at: Date.now(), next: 0, n: 0 };
    save(); pkstFlush();
  } catch (e) { /* a count must never get in the way of what the person is doing */ }
}
// the section of an entry, and the colour theme that was picked, to the pack that made them
function pkstSection(s) { if (s && s.packId) pkstUse(s.packId); }
function pkstTheme(themeId) {
  try {
    if (!pkstOn()) return;
    const c = typeof customTheme === 'function' ? customTheme(themeId) : null; if (!c) return; // only a custom theme can come from a pack
    const r = (S.packs || []).find(x => x.state === 'installed' && x.source && x.source.kind === 'library' && Array.isArray(x.themes) && x.themes.includes(c.name));
    if (r) pkstUse(r.packId);
  } catch (e) { /* see above */ }
}

// sends what is waiting. 2xx: counted (or already counted), forget the token. 400/404/413/422: the service will never take it, forget it too. Anything else (429, 5xx, offline): keep it and try later.
async function pkstFlush() {
  if (PKST.busy || !pkstOn()) return;
  const o = pkstState(), url = pkstUrlOk(o.url); if (!url) return;
  const now = Date.now(), due = Object.keys(o.pend).filter(id => (o.pend[id].next || 0) <= now); if (!due.length) return;
  PKST.busy = true;
  try {
    for (const id of due) {
      const p = o.pend[id]; if (!p || !pkstOn()) continue;
      let status = 0, timer;
      try {
        const r = await Promise.race([httpx('POST', url + '/use', { 'Content-Type': 'application/json' }, JSON.stringify({ pack: id, token: p.t })), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timed out')), PKST.timeout); })]);
        status = r && r.status || 0;
      } catch (e) { status = 0; } finally { clearTimeout(timer); }
      if (!pkstOn() || !o.pend[id]) continue; // turned off while the request was out: nothing more is kept
      if ((status >= 200 && status < 300) || [400, 404, 413, 422].includes(status)) { delete o.pend[id]; o.done[id] = Date.now(); }
      else { p.n = (p.n || 0) + 1; p.next = Date.now() + PKST.backoff[Math.min(p.n - 1, PKST.backoff.length - 1)]; }
    }
    save();
  } finally { PKST.busy = false; }
  pkstSchedule();
}
// one timer, for the soonest waiting count; not running when nothing waits or the setting is off
function pkstSchedule() {
  if (typeof setTimeout !== 'function') return;
  clearTimeout(PKST.timer); PKST.timer = 0;
  const o = pkstBox(); if (!o || !o.on || !o.pend || !pkstUrlOk(o.url)) return;
  const next = Math.min(...Object.values(o.pend).map(p => (p && p.next) || 0), Infinity); if (next === Infinity) return;
  PKST.timer = setTimeout(() => { PKST.timer = 0; pkstFlush(); }, Math.max(5000, Math.min(next - Date.now(), 6 * 3600e3)));
  if (PKST.timer && PKST.timer.unref) PKST.timer.unref();
}

// ---------- Settings ----------
function pkstSetOn(on) {
  const o = pkstState(); on = !!on; if (o.on === on) return;
  o.on = on;
  if (!on) { o.pend = {}; o.url = ''; clearTimeout(PKST.timer); PKST.timer = 0; } // off: whatever was waiting is dropped, not sent later, and the address is forgotten
  save();
  if (on && typeof pkIndex === 'function') pkIndex().then(ix => { pkstLearn(ix.usage); pkstFlush(); }, () => { /* offline: it is learned the next time the library is opened */ }); // the library publishes the address: this asks for that public file, nothing about you
}
function pkstSettingsHtml() {
  const on = pkstOn(), o = pkstBox() || {}, url = pkstUrlOk(o.url), waiting = on && o.pend ? Object.keys(o.pend).length : 0, counted = o.done ? Object.keys(o.done).length : 0;
  return `<h4 class="mh">Pack usage counts</h4><p class="hint" style="margin-top:0">The pack library's website can show how many times each pack has been used. That only works if people choose to say so. It is <b>off</b> unless you turn it on, and it does nothing at all while it is off.</p>`
    + `<div class="pk-r pkst-r"><span class="pk-ic">${ic('activity', 18)}</span><span class="pk-n"><b>${on ? 'Counting is on' : 'Counting is off'}</b><small>${on ? 'The first time you really use a pack from the library on this device, it adds one to that pack\'s count.' : 'Nothing is sent. Packs you use are not counted.'}${on && waiting ? ' ' + esc(plural(waiting, 'count')) + ' waiting to be sent.' : ''}${counted ? ' ' + esc(plural(counted, 'pack')) + ' counted from this device.' : ''}</small></span>`
    + `<button type="button" class="btn sm${on ? '' : ' pri'}" data-m="pkstog" aria-pressed="${on}">${on ? 'Turn off' : 'Turn on'}</button></div>`
    + `<details class="pkst-d"><summary>Exactly what is sent</summary><div class="hint"><p style="margin-top:6px">Once for each library pack, the first time you really use it: saving or ticking off one of its entries, running one of its actions, or choosing one of its colour themes. Adding a pack or looking at the library is not use, and a pack from a file is never counted.</p>`
    + `<p><b>Sent:</b> the pack's id (for example <code>reading-tracker</code>) and a random code made only for that pack on this device, so that a retry is not counted twice. The code is deleted as soon as the count is received.</p>`
    + `<p><b>Never sent:</b> what is in your entries, tasks or notes, titles, names, field values, your account, a device or user identifier, your version of OpenTick, or anything else about you. It is not linked to your sync or to your other devices; another device of yours counts once more, if you turn this on there too.</p>`
    + `<p>${url ? 'Counts go to <code>' + esc(url) + '</code>, the address the library publishes.' : 'Counts go to the address the library publishes. It has not published one, so nothing can be sent right now.'} The request carries your IP address like any web request; the service does not keep it. If the service cannot be reached the count waits on this device and is tried again later. Turning this off drops anything that is still waiting.</p></div></details>`;
}
function pkstAct(a, b, m, back) {
  if (a !== 'pkstog') return false;
  const turnOn = !pkstOn(); pkstSetOn(turnOn);
  if (turnOn) toast('Pack usage counts are on. Thank you!'); else toast('Pack usage counts are off. Nothing is sent.');
  if (typeof back === 'function') back();
  return true;
}
// after a restart: a count that was waiting is tried again (only when the person turned counting on)
if (typeof setTimeout === 'function' && typeof document !== 'undefined') { const t = setTimeout(() => { try { if (pkstOn()) { pkstFlush(); pkstSchedule(); } } catch (e) { /* later */ } }, 20000); if (t && t.unref) t.unref(); }
