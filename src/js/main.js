/* OpenTick main: modals, platform bridges, timers, events, startup */
const TAURI = () => window.__TAURI__ || null;
let toastTimer;
// act = { label, fn }: a button in the message (for Undo)
function toast(m, act) {
  const el = $('#toast'); if (!el) return; el.textContent = m;
  if (act && el.append && document.createElement) { const b = document.createElement('button'); b.type = 'button'; b.textContent = act.label; b.onclick = () => { el.classList.remove('on', 'act'); act.fn(); }; el.append(' ', b); }
  el.classList.toggle('act', !!act); el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on', 'act'), act ? 7000 : 2600);
}
function applyTheme() {
  const th = THEMES.some(t => t[0] === S.settings.theme) || customTheme(S.settings.theme) ? S.settings.theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = THEMES.some(t => t[0] === th) ? th : DEFAULT_THEME;
  themeApplyCustom(); // an imported theme sits on top of its base theme
  if (typeof bgApply === 'function') bgApply();
  try { const c = getComputedStyle(document.documentElement).getPropertyValue('--side').trim(), m = document.querySelector('meta[name=theme-color]'); if (c && m) m.setAttribute('content', c); } catch (e) { /* cosmetic only */ }
}
const refresh = () => { renderSide(); renderMain(); renderDetail(); };

/* ---------- small animations ----------
   Rendering rebuilds the DOM, so an animation is queued with fx(selector, name) and played on the fresh elements by
   fxFlush() at the end of renderMain / renderDetail. Everything is switched off by prefers-reduced-motion. */
const motionOK = () => !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) && (!S || !S.settings || S.settings.motion !== 'off');
// Settings → Animations: the whole interface reads data-motion (normal / calm / off) from the page root
function motionApply() { if (typeof document !== 'undefined' && document.documentElement && document.documentElement.setAttribute) document.documentElement.setAttribute('data-motion', (S.settings && S.settings.motion) || 'normal'); }
const rowSel = id => ['.task', '.card', '.tri', '.chip', '.blk', '.gt-r'].map(c => `${c}[data-id="${id}"]`).join(',');
function fx(sel, name = 'pop') { if (motionOK()) U.fx.push({ sel, name, at: Date.now() }); }
function fxPlay(el, name) {
  const c = 'fx-' + name; el.classList.remove(c); void el.offsetWidth; el.classList.add(c);
  const off = ev => { if (ev.target !== el) return; el.classList.remove(c); el.removeEventListener('animationend', off); };
  el.addEventListener('animationend', off);
}
function fxFlush() {
  if (!U.fx.length) return;
  const now = Date.now(); U.fx = U.fx.filter(f => now - f.at < 150);
  for (const f of U.fx) $$(f.sel).forEach(el => { if (el.dataset.fxd !== String(f.at) + f.name) { el.dataset.fxd = String(f.at) + f.name; fxPlay(el, f.name); } });
}
// tick a checkbox with a short animation, give it a moment to be seen, then carry on (the data change has already happened)
function tickThen(el, leave, fn) {
  if (!el || !el.closest || !el.classList || !motionOK()) { fn(); return; }
  el.classList.add('on'); el.innerHTML = ic('check', el.classList.contains('sm') ? 11 : 13); fxPlay(el, 'tick');
  const row = leave && el.closest('.task,.card'); if (row) row.classList.add('fx-leave');
  setTimeout(fn, row ? 400 : 330);
}
// let rows fade out before they are removed from the list
function leaveThen(id, fn) {
  const rows = motionOK() ? $$(rowSel(id)) : [];
  if (!rows.length) { fn(); return; }
  rows.forEach(r => r.classList.add('fx-leave')); setTimeout(fn, 230);
}
// the flame that plays over a habit card when a check-in extends its streak
function fireBurst(id, n, per) {
  const card = $(`.habit[data-id="${id}"]`); if (!card || !card.appendChild || !motionOK()) return;
  const o = document.createElement('div'); o.className = 'fire'; o.setAttribute('aria-hidden', 'true');
  o.innerHTML = `<div class="fl"><svg class="flame" viewBox="0 0 48 64"><path class="f1" d="M24 2c2 12 18 20 18 38 0 13-8 22-18 22S6 53 6 40c0-8 4-13 8-18 1 7 4 9 7 10-2-12 0-22 3-30z"/><path class="f2" d="M24 22c1 8 11 13 11 24 0 8-5 14-11 14S13 54 13 46c0-5 3-8 5-11 1 4 2 6 4 6-1-8 0-14 2-19z"/><path class="f3" d="M24 42c1 4 6 7 6 12 0 4-3 7-6 7s-6-3-6-7c0-3 2-5 3-6 1 2 1 3 2 3-1-4 0-7 1-9z"/></svg><b>${n}</b></div><small>${esc(per)} streak!</small>`
    + [-22, -9, 6, 20, 30, -30].map((x, i) => `<i class="ember" style="--x:${x}px;--d:${(i * 0.07).toFixed(2)}s"></i>`).join('');
  card.appendChild(o); setTimeout(() => o.remove(), 1900);
}

/* ---------- modals ---------- */
function openModal(html, ready, cls = '') { const m = $('#modal'); m.onclick = m.onchange = m.onkeydown = m.oninput = null; m.innerHTML = `<div class="mback ${cls}"><div class="mbox ${cls}">${html}</div></div>`; m.classList.add('on'); if (ready) ready(m); }
function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; m.onclick = m.onchange = m.onkeydown = m.oninput = null; }
const askText = (title, val = '', ph = '') => new Promise(res => {
  openModal(`<h3>${esc(title)}</h3><input id="mt" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off"><div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="ok">OK</button></div>`, m => {
    const i = $('#mt', m), done = v => { closeModal(); res(v); };
    i.focus(); i.select();
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === 'ok' ? i.value.trim() : null); else if (e.target.classList.contains('mback')) done(null); };
    i.onkeydown = e => { if (e.key === 'Enter') done(i.value.trim()); };
  });
});
const askConfirm = (msg, ok = 'Delete') => new Promise(res => {
  openModal(`<p>${esc(msg)}</p><div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="ok">${esc(ok)}</button></div>`, m => {
    const done = v => { closeModal(); res(v); };
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === 'ok'); else if (e.target.classList.contains('mback')) done(false); };
  });
});
const askMenu = (title, items) => new Promise(res => {
  openModal(`<h3>${esc(title)}</h3><div class="menu">${items.map((it, i) => `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.color ? `<i style="background:${it.color}"></i>` : ''}${esc(it.label)}</button>`).join('')}</div>`, m => {
    const done = v => { closeModal(); res(v); };
    m.onclick = e => { const b = e.target.closest('[data-i]'); if (b) done(+b.dataset.i); else if (e.target.classList.contains('mback')) done(null); };
  });
});
const pickColor = (cur = '', allowNone = false) => new Promise(res => {
  const done = v => { closeModal(); res(v); };
  openModal(`<h3>Colour</h3><div class="sw big">${COLORS.map(([c, n]) => `<button style="--c:${c}" class="${c === cur ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div><div class="mrow"><label class="inl">Custom <input type="color" id="pc-cust" value="${/^#[0-9a-f]{6}$/i.test(cur) ? cur : '#4772fa'}"></label>${allowNone ? '<button data-n="1">No colour</button>' : ''}</div><div class="mact"><button data-m="no">Cancel</button></div>`, m => {
    m.onclick = e => { const b = e.target.closest('button'); if (b && b.dataset.c) done(b.dataset.c); else if (b && b.dataset.n) done(''); else if (b || e.target.classList.contains('mback')) done(null); };
    m.onchange = e => { if (e.target.id === 'pc-cust') done(e.target.value); };
  });
});
async function tagMenu(name) {
  const col = tagColor(name), items = [{ label: 'Change colour', color: col || undefined }, ...(col ? [{ label: 'Remove colour' }] : []), { label: 'Rename tag' }];
  const i = await askMenu('#' + name, items); if (i == null) return;
  const lab = items[i].label;
  if (lab === 'Change colour') { const c = await pickColor(col || '', false); if (!c) return; setTagColor(name, c); }
  else if (lab === 'Remove colour') setTagColor(name, null);
  else {
    const n = await askText('Rename tag', name), nn = n && n.toLowerCase().replace(/^#/, '').replace(/[\s,#]+/g, '-').replace(/^-+|-+$/g, '');
    if (!nn || nn === name) return;
    renameTag(name, nn); if (U.nav === 'tag:' + name) U.nav = 'tag:' + nn;
  }
  refresh();
}

/* ---------- links ---------- */
function openExternal(url) {
  const T = TAURI();
  if (T && T.opener && T.opener.openUrl) { T.opener.openUrl(url).catch(() => {}); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/* ---------- files (Tauri dialog+fs, File System Access, or classic download) ---------- */
const pathOf = p => (p && typeof p === 'object' ? p.path : p);
async function saveText(name, text, mime = 'application/json') {
  const T = TAURI();
  if (T && T.dialog && T.fs) { const p = pathOf(await T.dialog.save({ defaultPath: name })); if (!p) return false; await T.fs.writeTextFile(p, text); return true; }
  if (window.showSaveFilePicker) {
    try { const h = await window.showSaveFilePicker({ suggestedName: name }); const w = await h.createWritable(); await w.write(text); await w.close(); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true;
}
// named = true returns { text, name } so the caller can use the file name; otherwise just the text
async function pickText(exts = ['json'], label = 'JSON', named = false) {
  const T = TAURI();
  if (T && T.dialog && T.fs) { const p = pathOf(await T.dialog.open({ multiple: false, filters: [{ name: label, extensions: exts }] })); if (!p) return null; const text = await T.fs.readTextFile(p); return named ? { text, name: String(p).split(/[\\/]/).pop() } : text; }
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = exts.map(x => '.' + x).join(','); i.onchange = async () => res(i.files[0] ? (named ? { text: await i.files[0].text(), name: i.files[0].name } : await i.files[0].text()) : null); i.click(); });
}
async function exportData() { try { if (await saveText(`opentick-${todayStr()}.json`, JSON.stringify({ ...S, _app: { name: 'OpenTick', version: APP_VERSION, exported: new Date().toISOString() } }, null, 1))) toast('Exported'); } catch (e) { toast('Export failed: ' + (e.message || e)); } }

/* ---------- notifications, sound, reminders ---------- */
async function ensureNotify() {
  try {
    const T = TAURI();
    if (T && T.notification) { let ok = await T.notification.isPermissionGranted(); if (!ok) ok = (await T.notification.requestPermission()) === 'granted'; return ok; }
    if ('Notification' in window) { if (Notification.permission === 'default') await Notification.requestPermission(); return Notification.permission === 'granted'; }
  } catch (e) { /* ignore */ }
  return false;
}
function notify(title, body) {
  try {
    const T = TAURI();
    if (T && T.notification) {
      // Android draws the small notification icon from a monochrome drawable of its own (src-tauri/android-widgets/res/drawable/ic_stat_opentick.xml);
      // without this it falls back to the launcher icon, which Android flattens into a white square. Desktop systems ignore / don't have this.
      const o = { title, body }; if (/Android/i.test(navigator.userAgent || '')) { o.icon = 'ic_stat_opentick'; o.iconColor = '#E09B00'; }
      T.notification.sendNotification(o); return;
    }
    if ('Notification' in window && Notification.permission === 'granted') { new Notification(title, { body, icon: APP_LOGO }); return; }
  } catch (e) { /* fall through */ }
  toast(`${title}${body ? ' — ' + body : ''}`);
}
const beep = () => sfx('chime');
function checkReminders() {
  if (WIDGET) return;
  const now = Date.now(); let changed = false;
  for (const t of S.tasks) {
    if (t.deleted || t.status !== 'open' || !t.due || t.reminder == null) continue;
    const at = new Date(`${t.due}T${t.time || '09:00'}`).getTime() - t.reminder * 60000;
    const key = `${t.id}|${t.due}|${t.time || ''}|${t.reminder}`;
    if (now >= at && now - at < 864e5 && !S.fired[key]) { S.fired[key] = 1; changed = true; notify(t.title, 'Due ' + dueLabel(t)); sfx('chime'); }
  }
  if (schoolRemind()) changed = true;
  // timetable slots: remind before they start (today, and tomorrow for slots just after midnight)
  const today = new Date();
  for (const sl of S.slots) {
    if (sl.remind == null) continue;
    for (const off of [0, 1]) {
      const d = addDays(today, off), k = ymd(d); if (!sl.days.includes(d.getDay())) continue;
      const at = new Date(`${k}T${sl.start}`).getTime() - sl.remind * 60000, endAt = new Date(`${k}T${sl.end}`).getTime(), key = `s|${sl.id}|${k}|${sl.start}|${sl.remind}`;
      if (now >= at && now < endAt && !S.fired[key]) { S.fired[key] = 1; changed = true; notify(sl.title, `${fmtRange(sl.start, sl.end)}${sl.loc ? ' · ' + sl.loc : ''}`); sfx('chime'); }
    }
  }
  const old = ymd(addDays(today, -2));
  for (const k of Object.keys(S.fired)) if (k.startsWith('s|') && k.split('|')[2] < old) { delete S.fired[k]; changed = true; }
  if (changed) save();
}

/* ---------- pomodoro ----------
   P.run means "started"; time only passes while pActive(). Normally that is the same thing, but in face-down mode
   (Settings of the Focus page, meant for phones) time only passes while the phone lies face down: pick it up and the
   timer pauses by itself, put it down and it carries on. Time is counted tick by tick rather than against an end time,
   which is what lets it pause and resume. */
const P = { mode: 'focus', total: 25 * 60, left: 25 * 60, run: false, last: 0, task: '', down: null, act: false };
const pActive = () => P.run && (!S.settings.pomo.faceDown || P.down === true);
function pSet(mode) { P.mode = mode; P.total = P.left = S.settings.pomo[mode] * 60; P.run = false; P.last = Date.now(); paintClock(); wlSync(); }
function pToggle() {
  if (P.run) { P.run = false; }
  else { if (P.left <= 0) P.left = P.total; P.run = true; P.last = Date.now(); ensureNotify(); sfx('start'); if (S.settings.pomo.faceDown) fdEnable(); }
  P.act = pActive(); paintClock(); wlSync();
}
// "45", "1h30", "1.5h", "90s", "25:00" (mm:ss) or "1:30:00" (h:mm:ss) -> seconds, or null
function parseDur(str) {
  const s = String(str || '').trim().toLowerCase(); if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return m[3] != null ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
  // tokens like "1h", "30m", "45s"; a bare number counts as minutes (or as the minutes after an hour: "1h30")
  const unit = { h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, m: 60, min: 60, mins: 60, minute: 60, minutes: 60, s: 1, sec: 1, secs: 1, second: 1, seconds: 1 };
  let total = 0, any = false; const re = /(\d+(?:\.\d+)?)\s*([a-z]*)\s*/y; let t;
  while (re.lastIndex < s.length && (t = re.exec(s))) {
    if (t[2] && !(t[2] in unit)) return null;
    if (!t[2] && (re.lastIndex < s.length)) return null; // a bare number may only come last
    total += +t[1] * (t[2] ? unit[t[2]] : 60); any = true;
  }
  return any && re.lastIndex >= s.length ? Math.round(total) : null;
}
function pCustom(str) {
  const sec = parseDur(str);
  if (!sec || sec < 1 || sec > 86400) { toast('Try 45, 1h30, 90s or 25:00 (up to 24 hours)'); return false; }
  P.total = P.left = sec; P.run = false; P.act = false; wlSync(); sfx('tick'); return true;
}
// add or take away time, running or not
function pAdd(min) {
  const d = min * 60; P.left = Math.max(1, Math.min(86400, P.left + d)); P.total = Math.max(P.left, Math.min(86400, P.total + d));
  paintClock();
}
function pDone() {
  const wasFocus = P.mode === 'focus';
  if (wasFocus) { S.pomo.push({ ts: Date.now(), min: Math.max(1, Math.round(P.total / 60)), task: P.task || null }); save(); }
  beep(); notify(wasFocus ? 'Focus session complete 🎉' : 'Break is over', wasFocus ? 'Time for a break.' : 'Ready to focus again?');
  const n = S.pomo.filter(p => ymd(new Date(p.ts)) === todayStr()).length;
  pSet(wasFocus ? (n % 4 === 0 ? 'long' : 'short') : 'focus');
  if (U.page === 'focus') renderMain();
}
function pTick() {
  const now = Date.now(), dt = Math.max(0, (now - P.last) / 1000); P.last = now;
  if (!P.run) return;
  const act = pActive();
  if (act !== P.act) { P.act = act; if (S.settings.pomo.faceDown) { sfx(act ? 'start' : 'undo'); paintClock(); } } // picked up / put down
  if (!act) return;
  P.left = Math.max(0, P.left - dt);
  if (P.left <= 0) pDone(); else paintClock();
}
setInterval(pTick, 250);

/* face-down detection: the motion sensor reports tilt; "up" is how much the screen points at the sky (+1 face up, -1 face down) */
const FD = { on: false };
function fdHandler(e) {
  if (e.beta == null || e.gamma == null) return;
  const up = Math.cos(e.beta * Math.PI / 180) * Math.cos(e.gamma * Math.PI / 180), was = P.down;
  if (up < -0.75) P.down = true; else if (up > -0.4 || P.down == null) P.down = false; // in between: keep the last state, so a tilt does not flicker
  if (P.down !== was) { P.act = pActive(); paintClock(); }
}
async function fdEnable() { // true, 'denied' or 'nosensor'
  if (typeof DeviceOrientationEvent === 'undefined') return 'nosensor';
  try { if (typeof DeviceOrientationEvent.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return 'denied'; } catch (e) { return 'denied'; }
  if (!FD.on) { window.addEventListener('deviceorientation', fdHandler); FD.on = true; }
  if (P.down == null) await new Promise(r => setTimeout(r, 1200)); // a desktop reports empty readings: no sensor
  return P.down == null ? 'nosensor' : true;
}
function fdDisable() { if (FD.on) { window.removeEventListener('deviceorientation', fdHandler); FD.on = false; } P.down = null; P.act = pActive(); wlSync(); paintClock(); }
const fdStatus = () => {
  if (!S.settings.pomo.faceDown) return '';
  if (P.down == null) return ['wait', 'Waiting for the motion sensor…'];
  if (!P.run) return P.down ? ['ok', 'Face down — press Start to begin'] : ['off', 'Press Start, then lay the phone face down'];
  return P.down ? ['ok', 'Face down — counting'] : ['off', 'Face up — paused. Turn the phone over to continue'];
};
// keep the screen awake while a face-down session runs (the sensor stops reporting on a locked phone)
const WL = { lock: null };
function wlSync() {
  if (typeof widgetPush === 'function') widgetPush(true); // the Focus widget shows whether a session is running
  try {
    const want = P.run && S.settings.pomo.faceDown && navigator.wakeLock;
    if (want && !WL.lock && document.visibilityState === 'visible') navigator.wakeLock.request('screen').then(l => { WL.lock = l; l.addEventListener('release', () => { if (WL.lock === l) WL.lock = null; }); }).catch(() => {});
    else if (!want && WL.lock) { WL.lock.release().catch(() => {}); WL.lock = null; }
  } catch (e) { /* optional nicety */ }
}

/* ---------- settings ---------- */
// a play button shows a pause icon for as long as its sound lasts
function playBtn(b) {
  const pi = $('.pi', b); if (!pi) return;
  b.classList.add('playing'); pi.innerHTML = ic('pause', 13); clearTimeout(b._t);
  b._t = setTimeout(() => { b.classList.remove('playing'); pi.innerHTML = ic('play', 13); }, sfxDuration(b.dataset.play) * 1000);
}
async function loadSnaps(m) {
  const box = $('#snaps', m); if (!box) return;
  const list = await snapList(), fmt = t => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  box.innerHTML = (list.length ? list.map(x => `<div class="snap"><span><b>${esc(fmt(x.at))}</b><small>${x.tag ? 'Before deleting everything · ' : ''}${x.tasks} task${x.tasks === 1 ? '' : 's'}</small></span><button data-snaprs="${esc(x.key)}">Restore</button><button class="ib" data-snapdl="${esc(x.key)}" title="Download this backup" aria-label="Download this backup">${ic('download', 15)}</button></div>`).join('') : '<p class="hint">The first automatic backup is made a few seconds after you open the app.</p>')
    + `<div class="snapfoot"><button data-m="snapnow">${ic('refresh', 14)} Back up now</button><span class="hint">One copy a day, the last ${SNAP_KEEP} kept, on this device only.</span></div>`;
}
function openSettings() {
  const s = S.settings;
  openModal(`<h3>Settings</h3><h4 class="mh first">Appearance</h4><div id="thsec">${themeSectionHtml()}</div>${scaleSetting()}<div class="dgrid" style="margin-top:10px"><button data-m="bgfx">${ic('sparkles', 18)}<span><b>Background effects</b><small>${bgNorm(s.bg).on ? 'On · ' + (BG_STYLES.find(x => x[0] === bgNorm(s.bg).style) || [])[1] : 'Off'} — soft moving shapes behind the app</small></span></button></div><h4 class="mh">General &amp; focus timer</h4><div class="form">
<label>Start screen${homeSelectHtml()}</label>
<label>Animations<select data-sx="motion">${opts([['normal', 'Normal'], ['calm', 'Calm (subtle)'], ['off', 'Off']], s.motion || 'normal')}</select></label>
<label>Week starts on<select data-s="weekStart">${opts([[1, 'Monday'], [0, 'Sunday'], [6, 'Saturday']], s.weekStart)}</select></label>
<label>Focus (min)<input type="number" min="1" max="180" data-p="focus" value="${s.pomo.focus}"></label>
<label>Short break (min)<input type="number" min="1" max="60" data-p="short" value="${s.pomo.short}"></label>
<label>Long break (min)<input type="number" min="1" max="120" data-p="long" value="${s.pomo.long}"></label></div>
<h4 class="mh">Sound</h4><div class="snd"><div class="mrow tight"><label class="chkl"><input type="checkbox" data-snd="on"${s.sound.on !== false ? ' checked' : ''}> Sound effects</label><label class="chkl"><input type="checkbox" data-snd="haptic"${s.sound.haptic !== false ? ' checked' : ''}> Vibrate on phones</label></div><label class="vol">${ic('volume', 16)}<input type="range" min="0" max="1" step="0.05" data-snd="vol" value="${s.sound.vol}" aria-label="Volume"></label><div class="mrow tight">${Object.entries(SOUNDS).map(([k, v]) => `<button class="sbtn" data-play="${k}" title="Play this sound"><span class="pi">${ic('play', 13)}</span>${esc(v.label)}</button>`).join('')}</div></div>
<h4 class="mh">Clock</h4><div class="mrow tight"><label class="chkl"><input type="checkbox" data-ck="on"${s.clock.on !== false ? ' checked' : ''}> Show date &amp; time</label><label class="chkl"><input type="checkbox" data-ck="h24"${s.clock.h24 ? ' checked' : ''}> 24-hour clock</label><label class="chkl"><input type="checkbox" data-ck="sec"${s.clock.sec ? ' checked' : ''}> Seconds</label></div><p class="hint">At the foot of the sidebar, or a small corner label when the sidebar is hidden.</p>
<div class="mrow tight" style="margin-top:10px"><label class="chkl"><input type="checkbox" data-bnr="on"${s.banners !== false ? ' checked' : ''}> Show banners on lists and projects</label></div>
<details class="gtd" style="margin-top:12px"><summary>Sidebar views</summary><div id="sbv">${uiSidebarSettings()}</div></details>
<h4 class="mh">Data, sync &amp; backup</h4><div class="dgrid">
<button data-m="sync">${ic('cloud', 18)}<span><b>Sync</b><small>${Sync.on ? 'On · ' + esc((PROVIDERS[Sync.cfg.provider] || {}).label || '') : 'Off — WebDAV, Git, S3 or a file'}</small></span></button>
<button data-m="export">${ic('download', 18)}<span><b>Export backup</b><small>Everything as one JSON file</small></span></button>
<button data-m="impapps">${ic('upload', 18)}<span><b>Import from another app</b><small>TickTick, Todoist, Anytype, Trello…</small></span></button>
<button data-m="import">${ic('upload', 18)}<span><b>Import a backup</b><small>Merge or replace · OpenTick JSON file</small></span></button>
<button data-m="oginport">${ic('calendar', 18)}<span><b>Import an OpenGantt chart</b><small>.opengantt file</small></span></button>
<button data-m="notif">${ic('bell', 18)}<span><b>Notifications</b><small>Allow reminders</small></span></button></div>
<h4 class="mh">Widgets</h4>${isAndroidApp() ? `<div class="dgrid"><button data-m="widget">${ic('layers', 18)}<span><b>Home-screen widgets</b><small>Long-press the home screen → Widgets → OpenTick. There is one for tasks, lists, projects, notes, calendar, timetable, matrix, habits and focus.</small></span></button></div>` : `<div class="dgrid">${WG_KINDS.map(k => `<button data-m="widget" data-w="${k[0]}">${ic(k[2], 18)}<span><b>${k[1]}</b><small>${esc(k[3])}</small></span></button>`).join('')}</div><p class="hint">Small windows that stay on top and look like the app. They update as you work.</p>`}
<h4 class="mh">Danger zone</h4><div class="dgrid"><button class="dz" data-m="wipe">${ic('trash', 18)}<span><b>Delete everything…</b><small>Tasks, lists, notes, habits and more · asks first</small></span></button></div>
<h4 class="mh">Automatic backups</h4><div id="snaps" class="snaps"><p class="hint">Loading…</p></div>
<h4 class="mh">Help &amp; about</h4><div class="dgrid"><button data-m="help">${ic('book-open', 18)}<span><b>Help &amp; user guide</b><small>How everything works · printable</small></span></button><button data-m="aboutdlg">${ic('info', 18)}<span><b>About OpenTick</b><small>v${esc(APP_VERSION)} · source, licences &amp; credits</small></span></button></div>
<div class="about">${logoHtml(40)}<div><b>OpenTick</b> <span class="ver">v${esc(APP_VERSION)}</span><br><span class="hint">${OTMETA.built ? 'Built ' + esc(OTMETA.built) + ' · ' : ''}Your data lives on this device. Turn on Sync to share it between devices, or export a JSON backup. Theme, sound and view settings stay per device.</span></div></div>
<div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => {
    loadSnaps(m); scaleBind(m);
    m.onchange = e => {
      const el = e.target;
      if (el.dataset.bnr) { S.settings.banners = el.checked; save(); return; }
      if (el.dataset.ck) { S.settings.clock[el.dataset.ck] = el.checked; save(); clockPaint(); return; }
      if (el.dataset.snd) { const k = el.dataset.snd; S.settings.sound[k] = el.type === 'checkbox' ? el.checked : +el.value; save(); if (k === 'vol' || (k === 'on' && el.checked)) sfx('done', true); return; }
      if (el.dataset.pg) { const h = S.settings.ui.hidePages; if (el.checked) S.settings.ui.hidePages = h.filter(k => k !== el.dataset.pg); else if (!h.includes(el.dataset.pg)) h.push(el.dataset.pg); save(); const b = $('#sbv', m); if (b) b.innerHTML = uiSidebarSettings(); return; }
      if (el.dataset.sx) { S.settings[el.dataset.sx] = el.value; if (el.dataset.sx === 'motion') motionApply(); save(); return; }
      if (el.dataset.s) { S.settings[el.dataset.s] = +el.value; }
      if (el.dataset.p) { S.settings.pomo[el.dataset.p] = Math.max(1, Math.min(180, +el.value || 25)); if (!P.run) pSet(P.mode); }
      save();
    };
    m.onclick = async e => {
      const pl = e.target.closest('[data-play]'); if (pl) { sfx(pl.dataset.play, true); playBtn(pl); return; }
      const rs = e.target.closest('[data-snaprs]'), sd = e.target.closest('[data-snapdl]');
      if (rs) { if (await askConfirm('Restore this backup? Your current data is backed up first, so you can come back.', 'Restore')) { try { await snapRestore(rs.dataset.snaprs); closeModal(); U.nav = 'today'; render(); toast('Backup restored'); } catch (err) { toast(err.message); } } return; }
      if (sd) { snapDownload(sd.dataset.snapdl); return; }
      const mvb = e.target.closest('[data-pgmv]');
      if (mvb) { uiMovePage(mvb.dataset.pgmv, +mvb.dataset.d); const b = $('#sbv', m); if (b) b.innerHTML = uiSidebarSettings(); return; }
      const th = e.target.closest('[data-th]');
      if (th) { S.settings.theme = th.dataset.th; applyTheme(); save(); const sec = $('#thsec', m); if (sec) sec.innerHTML = themeSectionHtml(); return; }
      const b = e.target.closest('[data-m]');
      if (!b) { if (e.target.classList.contains('mback')) { closeModal(); render(); } return; }
      const a = b.dataset.m;
      if (a === 'ok') { closeModal(); render(); }
      else if (a === 'export') exportData();
      else if (a === 'import') { closeModal(); importData(); }
      else if (a === 'widget') { if (isAndroidApp()) { widgetPush(true); toast('Long-press the home screen, choose Widgets, then OpenTick'); } else openMiniWidget(b.dataset.w || 'tasks'); }
      else if (a === 'bgfx') { closeModal(); openBgSettings(); }
      else if (a === 'help') { closeModal(); openHelp(); }
      else if (a === 'aboutdlg') { closeModal(); openAbout(); }
      else if (a === 'wipe') { closeModal(); if (!(await deleteEverything())) openSettings(); }
      else if (a === 'impapps') { closeModal(); openImport(); }
      else if (a === 'sync') { closeModal(); openSync(); }
      else if (a === 'oginport') { closeModal(); ogImport(null); }
      else if (a === 'about') { try { await navigator.clipboard.writeText(`OpenTick v${APP_VERSION}${OTMETA.built ? ' (built ' + OTMETA.built + ')' : ''} · ${navigator.userAgent}`); toast('Version info copied'); } catch (err) { toast('OpenTick v' + APP_VERSION); } }
      else if (a === 'snapnow') { await snapSave(true); loadSnaps(m); toast('Backup saved'); }
      else if (a === 'notif') toast((await ensureNotify()) ? 'Notifications enabled' : 'Notifications are blocked');
      else if (a === 'themeimp') {
        try { const f = await pickText(['css', 'json', 'txt'], 'Theme', true); if (!f) return; const r = themeImport(f.text, f.name); const sec = $('#thsec', m); if (sec) sec.innerHTML = themeSectionHtml(); toast(r.replaced ? `Updated “${r.rec.name}”` : `Added “${r.rec.name}”`); } catch (err) { toast(err.message || 'Could not read that theme'); }
      } else if (a === 'themepaste') { closeModal(); themePasteDialog(openSettings); }
      else if (a === 'themetpl') { try { if (await saveText('opentick-theme-template.css', themeTemplate(), 'text/css')) toast('Template saved'); } catch (err) { toast('Could not save: ' + (err.message || err)); } }
      else if (a === 'themeexp') { const c = customTheme(b.dataset.id); if (c) try { if (await saveText(themeSlug(c.name) + '.css', themeFile(c), 'text/css')) toast('Theme saved'); } catch (err) { toast('Could not save: ' + (err.message || err)); } }
      else if (a === 'themedel') { const c = customTheme(b.dataset.id); if (c && await askConfirm(`Remove the theme “${c.name}”?`, 'Remove')) { themeRemove(c.id); closeModal(); openSettings(); } else if (c) openSettings(); }
    };
  }, 'wide');
}

/* ---------- actions ---------- */
function addCtx() {
  const n = U.nav;
  if (n.startsWith('list:')) return { listId: n.slice(5) };
  if (n.startsWith('project:')) { const p = projectOf(n.slice(8)); if (!p) return {}; const own = (p.listIds || []).filter(id => S.lists.some(l => l.id === id)), pick = projectListIds(p).includes(U.projList[p.id]) ? U.projList[p.id] : own[0]; return pick ? { listId: pick } : {}; }
  if (n === 'today' || n === 'week') return { due: todayStr() };
  if (n === 'tomorrow') return { due: ymd(addDays(new Date(), 1)) };
  if (n.startsWith('tag:')) return { tags: [n.slice(4)] };
  return {};
}
function quickAdd(text, ctx = {}) {
  const p = parseQuick(text, S.lists);
  const t = newTask({ title: p.title, due: p.due || ctx.due || null, time: p.time, ...(p.dur || ctx.dur ? { dur: p.dur || ctx.dur } : {}), priority: p.priority || ctx.priority || 0, tags: [...new Set([...(ctx.tags || []), ...p.tags])], listId: p.listId || ctx.listId || 'inbox', repeat: p.repeat, section: ctx.section || null });
  S.tasks.push(t); save(); sfx('add'); fx(rowSel(t.id), 'enter'); return t;
}
function reorder(dragId, beforeId) {
  if (dragId === beforeId) return;
  const eff = U.nav, ids = sortTasks(scopeTasks(eff).filter(t => t.status === 'open')).map(t => t.id).filter(i => i !== dragId);
  const idx = ids.indexOf(beforeId); ids.splice(idx < 0 ? ids.length : idx, 0, dragId);
  ids.forEach((id, i) => { getT(id).order = i * 1000; });
  save(); renderMain();
}
const closeDetail = () => { U.sel = null; $$('.sel').forEach(x => x.classList.remove('sel')); renderDetail(); };
const setNav = nav => { if (U.bsel) { U.bsel = null; document.body.classList.remove('batch'); } U.page = 'tasks'; U.nav = nav; U.q = ''; U.sel = null; document.body.classList.remove('drawer'); fx('#main > *:not(.top)', 'fade'); render(); };

/* ---------- timetable: slot editor, settings, drag & resize ---------- */
function slotClashes(d) {
  const a = toMin(d.start), b = toMin(d.end), out = [];
  for (const o of S.slots) {
    if (o.id === d.id) continue;
    const shared = o.days.filter(x => d.days.includes(x));
    if (shared.length && a < toMin(o.end) && toMin(o.start) < b) out.push(`${o.title || 'Untitled'} (${shared.map(x => DAYS[x]).join(', ')})`);
  }
  return out;
}
function openSlot(s, pre = {}) {
  const isNew = !s, ws = +S.settings.weekStart, order = Array.from({ length: 7 }, (_, i) => (ws + i) % 7);
  const d = s ? { ...s, days: [...s.days] } : { id: uid(), title: pre.title || '', days: pre.days || [new Date().getDay()], start: pre.start || '09:00', end: pre.end || '10:00', color: pre.color || COLORS[S.slots.length % COLORS.length][0], loc: '', notes: '', remind: null, created: Date.now() };
  const linked = () => { const ts = S.tasks.filter(t => !t.deleted && t.slotId === d.id); return ts.length ? ts.map(t => `<div class="lt${t.status !== 'open' ? ' fin' : ''}" data-act="open" data-id="${t.id}"><span>${titleHtml(t)}</span><small>${t.due ? esc(dueLabel(t)) : 'no date'}</small></div>`).join('') : '<p class="hint">No tasks linked yet.</p>'; };
  const snap = () => JSON.stringify([d.title, d.days, d.start, d.end, d.color, d.loc, d.notes, d.remind, d.icon || '']); let orig = snap(), armed = false;
  const read = () => { d.title = $('#sl-title').value.trim(); d.start = $('#sl-start').value || d.start; d.end = $('#sl-end').value || d.end; d.loc = $('#sl-loc').value.trim(); d.notes = $('#sl-notes').value; d.remind = remRead($('[data-rem=sl]')); };
  const warn = () => { read(); const bad = toMin(d.end) <= toMin(d.start) ? 'End time must be after the start time.' : '', cl = bad ? [] : slotClashes(d); $('#sl-warn').innerHTML = bad ? `<span class="bad">${bad}</span>` : cl.length ? `<span class="bad">${ic('alert', 13)} Overlaps with ${esc(cl.join(', '))}</span>` : ''; };
  openModal(`<h3>${isNew ? 'New timetable slot' : 'Edit slot'} <span class="dirty" id="sl-dirty" hidden>${ic('alert', 12)} Unsaved changes</span></h3><div class="form one">
<label>Title<input id="sl-title" value="${esc(d.title)}" placeholder="e.g. Maths, Gym, Deep work" autocomplete="off"></label>
<div class="lbl">Repeats weekly on<div class="dayp">${order.map(n => `<button type="button" class="dp${d.days.includes(n) ? ' on' : ''}" data-d="${n}">${DAYS[n]}</button>`).join('')}</div></div>
<div class="two"><label>Start<input type="time" id="sl-start" value="${d.start}"></label><label>End<input type="time" id="sl-end" value="${d.end}"></label></div>
<div id="sl-warn" class="hint"></div>
<details class="hb-more"${d.icon ? ' open' : ''}><summary>Icon</summary><input type="search" id="sl-isearch" placeholder="Search icons" autocomplete="off" aria-label="Search icons"><div class="ic-scroll" id="sl-ig">${iconGridHtml(d.icon, d.color)}<p class="hint ic-none" hidden>No icon matches that.</p></div></details>
<div class="lbl">Colour<div class="sw">${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === d.color ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}<input type="color" id="sl-cust" value="${/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#4772fa'}" title="Custom colour"></div></div>
<label>Location<input id="sl-loc" value="${esc(d.loc)}" placeholder="Room, address or link" autocomplete="off"></label>
<div class="lbl">Reminder${remHtml('sl', d.remind)}</div>
<label>Notes<textarea id="sl-notes" placeholder="Anything to remember">${esc(d.notes)}</textarea></label></div>
${isNew ? '' : filesHtml('slot', d.id)}
${isNew ? '<p class="hint">Save the slot first, then you can attach tasks to it.</p>' : `<div class="lbl tl">Tasks for this slot<div id="sl-tasks">${linked()}</div><input id="sl-tadd" placeholder="+ Add a task  (lands on the next ${esc(DAYS[nextSlotDate(d).getDay()])})" autocomplete="off"></div>`}
<div class="mact">${isNew ? '' : '<button class="danger" data-m="del">Delete</button><button data-m="dup">Duplicate</button>'}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    warn(); orig = snap(); if (isNew) $('#sl-title').focus();
    const dirty = () => { read(); const dd = snap() !== orig; $('#sl-dirty').hidden = !dd; if (!dd && armed) { armed = false; const c = $('[data-m=no]', m); c.textContent = 'Cancel'; c.classList.remove('danger'); } return dd; };
    const leave = () => { // a second press discards; the first only warns
      if (!dirty() || armed) { closeModal(); return; }
      armed = true; const c = $('[data-m=no]', m); c.textContent = 'Discard changes'; c.classList.add('danger'); toast('You have unsaved changes — press again to discard them');
    };
    m.oninput = e => { if (e.target.id === 'sl-isearch') { iconFilter($('#sl-ig', m), e.target.value); return; } dirty(); };
    m.onchange = e => { if (e.target.id === 'sl-cust') { d.color = e.target.value; $$('.sw button', m).forEach(x => x.classList.remove('on')); } else if (/^sl-(start|end)$/.test(e.target.id)) warn(); else if (e.target.closest && e.target.closest('[data-rem]')) remSync($('[data-rem=sl]', m)); dirty(); };
    m.onkeydown = e => {
      if (e.key !== 'Enter' || e.isComposing) return;
      if (e.target.id === 'sl-tadd' && e.target.value.trim()) { const t = quickAdd(e.target.value.trim(), { due: ymd(nextSlotDate(d)) }); t.slotId = d.id; save(); e.target.value = ''; $('#sl-tasks').innerHTML = linked(); renderSide(); }
      else if (e.target.id === 'sl-title') $('[data-m=save]', m).click();
    };
    m.onclick = async e => {
      const fa = e.target.closest('[data-fa]'); if (fa) { fileAction(fa).then(() => { const sec = $('.fsec', m); if (sec) { sec.outerHTML = filesHtml('slot', d.id); filesHydrate(m); } }); return; }
      const b = e.target.closest('button');
      if (!b) { if (e.target.classList.contains('mback')) leave(); return; }
      if (b.dataset.d != null) { const n = +b.dataset.d; d.days = d.days.includes(n) ? d.days.filter(x => x !== n) : [...d.days, n].sort((x, y) => x - y); b.classList.toggle('on', d.days.includes(n)); warn(); dirty(); }
      else if (b.dataset.c) { d.color = b.dataset.c; $$('.sw button', m).forEach(x => x.classList.toggle('on', x === b)); dirty(); }
      else if (b.dataset.i != null) { d.icon = d.icon === b.dataset.i ? '' : b.dataset.i; $$('#sl-ig button', m).forEach(x => x.classList.toggle('on', x.dataset.i === d.icon)); dirty(); }
      else if (b.dataset.m === 'no') leave();
      else if (b.dataset.m === 'save') {
        read();
        if (!d.title) { toast('Give the slot a title'); $('#sl-title').focus(); return; }
        if (!d.days.length) { toast('Pick at least one day'); return; }
        if (toMin(d.end) <= toMin(d.start)) { toast('End must be after the start'); return; }
        if (isNew) S.slots.push(d); else Object.assign(s, d);
        save(); closeModal(); refresh();
      } else if (b.dataset.m === 'dup') {
        read(); S.slots.push({ ...d, id: uid(), title: (d.title || 'Slot') + ' (copy)', days: [...d.days], files: (d.files || []).map(f => ({ ...f })), created: Date.now() }); save(); closeModal(); refresh(); toast('Duplicated');
      } else if (b.dataset.m === 'del') {
        closeModal();
        if (await askConfirm(`Delete “${s.title}”? Tasks linked to it stay, just unlinked.`)) { S.tasks.forEach(t => { if (t.slotId === s.id) t.slotId = null; }); S.slots = S.slots.filter(x => x !== s); save(); refresh(); } else openSlot(s);
      }
    };
  }, 'wide');
}
function openTTSettings() {
  const tt = S.settings.tt, hrs = n => Array.from({ length: n }, (_, i) => [i, fmtMin(i * 60)]);
  openModal(`<h3>Timetable settings</h3><div class="form"><label class="inl"><input type="checkbox" data-t="auto"${tt.auto ? ' checked' : ''}> Hide the quiet hours (shows 6:00–22:00 and anything scheduled outside them)</label><label>Day starts at<select data-t="from"${tt.auto ? ' disabled' : ''}>${opts(hrs(23), tt.from)}</select></label><label>Day ends at<select data-t="to"${tt.auto ? ' disabled' : ''}>${opts(hrs(25).slice(1), tt.to)}</select></label><label class="inl"><input type="checkbox" data-t="fit"${tt.fit !== false ? ' checked' : ''}> Fit the day to the screen (more of the day without scrolling)</label><label class="inl"><input type="checkbox" data-t="weekends"${tt.weekends ? ' checked' : ''}> Show weekends</label></div><p class="hint">The grid grows by itself if something is scheduled outside the shown hours. Times follow the 12 / 24-hour choice in Settings → Clock.</p><div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => {
    m.onchange = e => {
      const k = e.target.dataset.t; if (!k) return;
      if (k === 'weekends' || k === 'fit' || k === 'auto') tt[k] = e.target.checked; else tt[k] = +e.target.value;
      if (k === 'auto' || k === 'fit') { U.ttAvail = null; save(); closeModal(); openTTSettings(); return; }
      let fix = false;
      if (tt.to <= tt.from) { if (k === 'from') tt.to = Math.min(24, tt.from + 1); else tt.from = Math.max(0, tt.to - 1); fix = true; }
      save(); if (fix) { closeModal(); openTTSettings(); }
    };
    m.onclick = e => { if (e.target.closest('[data-m]') || e.target.classList.contains('mback')) { closeModal(); renderMain(); } };
  });
}
function calShift(n) {
  const d = U.calD, v = calView();
  if (v === 'month') { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); U.calD = x; }
  else U.calD = addDays(d, n * CAL_STEP[v]);
  fx('#main > *:not(.top)', 'fade'); renderMain();
}
const ttShift = n => { U.ttDate = addDays(U.ttDate || new Date(), n * ttStep()); renderMain(); };
// dropping a task or slot block on the grid: set its day and (snapped to 15 min) time
function ttDrop(e, el) {
  const date = el.dataset.d, isAd = el.classList.contains('tt-ad');
  let m = 0;
  if (!isAd) m = Math.max(0, Math.min(1439, +el.dataset.from + Math.round((zy(e.clientY, el.getBoundingClientRect().top) - (U.dragOff || 0)) / (TT_HH / 60) / 15) * 15));
  if (String(U.drag).startsWith('slot:')) {
    if (isAd) return;
    const [, sid, day] = U.drag.split(':'), sl = slotById(sid); if (!sl) return;
    const len = toMin(sl.end) - toMin(sl.start), st = Math.min(m, 1424), nd = pYmd(date).getDay();
    sl.start = fromMin(st); sl.end = fromMin(Math.min(1439, st + len));
    sl.days = sl.days.length === 1 ? [nd] : [...new Set(sl.days.map(x => (x === +day ? nd : x)))].sort((a, b) => a - b);
  } else {
    const t = getT(U.drag); if (!t) return;
    t.due = date; t.slotId = null;
    if (isAd) t.time = null; else { t.time = fromMin(m); t.dur = t.dur || 30; }
  }
  save(); sfx('sched'); const dropped = String(U.drag).startsWith('slot:') ? `.blk[data-sid="${U.drag.split(':')[1]}"]` : rowSel(U.drag); fx(dropped, 'enter'); renderSide(); renderMain(); renderDetail();
}

// "Add to timetable": one small form for a task (on a date) or a weekly slot, opened by clicking / dragging the grid or by the + buttons
function openTTCreate(pre = {}) {
  const ws = +S.settings.weekStart, order = Array.from({ length: 7 }, (_, i) => (ws + i) % 7), date = pre.date || ymd(U.ttDate || new Date());
  const st = { kind: U.ttKind || 'task', title: '', date, days: [pYmd(date).getDay()], start: pre.start || '09:00', end: pre.end || '10:00', color: COLORS[S.slots.length % COLORS.length][0] };
  openModal(`<h3>Add to timetable</h3><div class="seg full" id="tc-kind"><button type="button" data-k="task">Task</button><button type="button" data-k="slot">Weekly slot</button></div>
<div class="form one tc" id="tc"><label>Title<input id="tc-title" autocomplete="off"></label>
<label class="only-task">Date<input type="date" id="tc-date" value="${st.date}"></label>
<div class="lbl only-slot">Repeats every<div class="dayp">${order.map(n => `<button type="button" class="dp${st.days.includes(n) ? ' on' : ''}" data-d="${n}">${DAYS[n]}</button>`).join('')}</div></div>
<div class="two"><label>Start<input type="time" id="tc-start" value="${st.start}"></label><label>End<input type="time" id="tc-end" value="${st.end}"></label></div>
<div class="chips tc-dur">${[15, 30, 45, 60, 90, 120].map(m => `<button type="button" class="btn sm" data-dur="${m}">${fmtDur(m)}</button>`).join('')}</div>
<div class="lbl only-slot">Colour<div class="sw">${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === st.color ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div></div>
<div id="tc-warn" class="hint"></div></div>
<div class="mact"><button data-m="more">More options…</button><span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="add">Add</button></div>`, m => {
    const read = () => { st.title = $('#tc-title').value.trim(); st.start = $('#tc-start').value || st.start; st.end = $('#tc-end').value || st.end; st.date = $('#tc-date').value || st.date; };
    const kind = k => {
      st.kind = U.ttKind = k; $('#tc').className = 'form one tc k-' + k;
      $$('#tc-kind button', m).forEach(b => b.classList.toggle('on', b.dataset.k === k));
      $('#tc-title').placeholder = k === 'task' ? 'e.g. Write essay !high #uni' : 'e.g. Maths, Gym, Deep work';
    };
    const warn = () => { read(); $('#tc-warn').innerHTML = toMin(st.end) <= toMin(st.start) ? '<span class="bad">End must be after the start.</span>' : ''; };
    const make = more => {
      read();
      if (toMin(st.end) <= toMin(st.start)) { toast('End must be after the start'); return; }
      if (more && st.kind === 'slot') { closeModal(); openSlot(null, { title: st.title, days: st.days, start: st.start, end: st.end, color: st.color }); return; }
      if (!st.title) { toast('Give it a title'); $('#tc-title').focus(); return; }
      if (st.kind === 'task') {
        const p = parseQuick(st.title, S.lists), t = newTask({ title: p.title, due: st.date, time: st.start, dur: toMin(st.end) - toMin(st.start), priority: p.priority, tags: p.tags, listId: p.listId || 'inbox' });
        S.tasks.push(t); if (more) U.sel = t.id; save(); closeModal(); sfx('add'); U.ttDate = pYmd(st.date); refresh();
      } else {
        if (!st.days.length) { toast('Pick at least one day'); return; }
        S.slots.push({ id: uid(), title: st.title, days: [...st.days], start: st.start, end: st.end, color: st.color, loc: '', notes: '', remind: null, created: Date.now() });
        save(); closeModal(); sfx('add'); refresh();
      }
    };
    kind(st.kind); $('#tc-title').focus();
    m.onchange = warn;
    m.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing && e.target.id === 'tc-title') { e.preventDefault(); make(false); } };
    m.onclick = e => {
      const b = e.target.closest('button');
      if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.k) kind(b.dataset.k);
      else if (b.dataset.d != null) { const n = +b.dataset.d; st.days = st.days.includes(n) ? st.days.filter(x => x !== n) : [...st.days, n].sort((x, y) => x - y); b.classList.toggle('on', st.days.includes(n)); }
      else if (b.dataset.c) { st.color = b.dataset.c; $$('.sw button', m).forEach(x => x.classList.toggle('on', x === b)); }
      else if (b.dataset.dur) { read(); $('#tc-end').value = fromMin(Math.min(1439, toMin(st.start) + +b.dataset.dur)); warn(); }
      else if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'add') make(false);
      else if (b.dataset.m === 'more') make(true);
    };
  }, 'wide');
}
// put an existing task on a day and time without dragging (works on a phone)
function openTTSchedule(id) {
  const t = getT(id); if (!t) return;
  const n = new Date(), nm = Math.min(1380, (n.getHours() + (n.getMinutes() > 30 ? 1 : 0)) * 60 + (n.getMinutes() > 30 ? 0 : 30));
  openModal(`<h3>Schedule task</h3><p class="ttl-p">${titleHtml(t)}</p><div class="form one"><div class="two"><label>Day<input type="date" id="ts-date" value="${t.due || ymd(U.ttDate || n)}"></label><label>Start<input type="time" id="ts-time" value="${t.time || fromMin(nm)}"></label></div><div class="lbl">Length${durHtml('ts', t.dur || 30)}</div></div>
<div class="mact">${t.time ? '<button class="danger" data-m="clear">Remove time</button>' : ''}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok">Schedule</button></div>`, m => {
    const box = $('[data-dur=ts]', m);
    m.oninput = e => { if (e.target.closest && e.target.closest('[data-dur]')) durMark(box, durRead(box) || 0); };
    m.onchange = e => { if (e.target.closest && e.target.closest('[data-dur]')) durSet(box, durRead(box) || 0); };
    m.onclick = e => {
      const dp = e.target.closest('[data-dp]'); if (dp) { durSet(box, +dp.dataset.dp || 0); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'ok') { t.due = $('#ts-date').value || t.due || todayStr(); t.time = $('#ts-time').value || '09:00'; t.dur = durRead(box) || 30; t.slotId = null; U.ttDate = pYmd(t.due); sfx('sched'); }
      else if (b.dataset.m === 'clear') { t.time = null; t.dur = null; }
      closeModal(); if (b.dataset.m !== 'no') { save(); refresh(); }
    };
  }, 'wide');
}
// phone: the unscheduled tasks as a sheet instead of a side panel
function openTTTasks() {
  const list = () => ttUnscheduled().slice(0, 60).map(ttTrayItem).join('') || '<p class="hint">Nothing waiting — nice.</p>';
  openModal(`<h3>Tasks without a time</h3><input id="tt-sheet-add" placeholder="+ New task  (try “Study 4pm for 90min”)" autocomplete="off"><div class="trl sheet" id="tt-sheet-l">${list()}</div><div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => {
    m.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'tt-sheet-add' && e.target.value.trim()) { quickAdd(e.target.value.trim(), {}); e.target.value = ''; $('#tt-sheet-l').innerHTML = list(); renderSide(); } };
    m.onclick = e => {
      const sc = e.target.closest('[data-act=ttsched]'); if (sc) { closeModal(); openTTSchedule(sc.dataset.id); return; }
      const op = e.target.closest('[data-act=open]'); if (op) { closeModal(); ACT.open(op); return; }
      if (e.target.closest('[data-m=ok]') || e.target.classList.contains('mback')) closeModal();
    };
  });
}

// one form for a new or an existing habit: name, icon, colour and goal (every day by default)
function openHabit(h) {
  const isNew = !h, d = h ? { name: h.name, icon: h.icon || '✓', color: h.color, goal: habitGoal(h) }
    : { name: '', icon: HABIT_ICONS[S.habits.length % 8], color: COLORS[(S.habits.length + 5) % COLORS.length][0], goal: { per: 'day', n: 1 } };
  const nOpts = () => { const max = d.goal.per === 'week' ? 7 : 31; return Array.from({ length: max }, (_, i) => `<option value="${i + 1}"${d.goal.n === i + 1 ? ' selected' : ''}>${i + 1}</option>`).join(''); };
  openModal(`<h3>${isNew ? 'New habit' : 'Edit habit'}</h3><div class="form one">
<label>Name<input id="hb-name" value="${esc(d.name)}" placeholder="e.g. Read 20 pages" autocomplete="off"></label>
<div class="lbl">Icon<div class="hb-icons" id="hb-icons">${[...new Set([d.icon, ...HABIT_ICONS])].filter(i => !IC[i]).map(i => `<button type="button" data-i="${esc(i)}" class="${i === d.icon ? 'on' : ''}">${esc(i)}</button>`).join('')}</div><details class="hb-more"${IC[d.icon] ? ' open' : ''}><summary>More icons</summary><input id="hb-isearch" type="search" placeholder="Search icons" autocomplete="off" aria-label="Search icons"><div class="ic-scroll" id="hb-ig">${iconGridHtml(d.icon, d.color)}<p class="hint ic-none" hidden>No icon matches that.</p></div></details><label class="hb-own">or type your own <input id="hb-icon" value="${esc(d.icon)}" maxlength="8" autocomplete="off"></label></div>
<div class="lbl">Colour<div class="sw">${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === d.color ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}<input type="color" id="hb-cust" value="${/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#4772fa'}" title="Custom colour"></div></div>
<div class="lbl">Goal<div class="seg full" id="hb-per">${HABIT_PER.map(([k, n]) => `<button type="button" data-per="${k}" class="${d.goal.per === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="hb-n" id="hb-n"></div></div></div>
<div class="mact">${isNew ? '' : '<button class="danger" data-m="del">Delete</button>'}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    const paintGoal = () => {
      const g = d.goal, box = $('#hb-n', m);
      box.innerHTML = g.per === 'day' ? '<span class="hint">One check-in every day keeps the streak going.</span>' : `<span>Aim for</span><select id="hb-nsel">${nOpts()}</select><span>time${g.n === 1 ? '' : 's'} a ${g.per}</span><span class="hint">A ${g.per} counts toward the streak once you reach the goal.</span>`;
      $$('#hb-per button', m).forEach(b => b.classList.toggle('on', b.dataset.per === g.per));
    };
    paintGoal(); $('#hb-name', m).focus();
    const pickIcon = i => { d.icon = i; $('#hb-icon', m).value = i; $$('#hb-icons button, #hb-ig button', m).forEach(b => b.classList.toggle('on', b.dataset.i === i)); };
    m.oninput = e => { if (e.target.id === 'hb-isearch') iconFilter($('#hb-ig', m), e.target.value); else if (e.target.id === 'hb-icon') { const v = e.target.value.trim(); if (v) pickIcon(v); } };
    m.onchange = e => {
      if (e.target.id === 'hb-cust') { d.color = e.target.value; $$('.sw button', m).forEach(x => x.classList.remove('on')); }
      else if (e.target.id === 'hb-nsel') { d.goal.n = +e.target.value; paintGoal(); }
    };
    m.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing && e.target.id === 'hb-name') { e.preventDefault(); $('[data-m=save]', m).click(); } };
    m.onclick = async e => {
      const b = e.target.closest('button');
      if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.i != null) pickIcon(b.dataset.i);
      else if (b.dataset.c) { d.color = b.dataset.c; $$('.sw button', m).forEach(x => x.classList.toggle('on', x === b)); }
      else if (b.dataset.per) { d.goal.per = b.dataset.per; d.goal.n = d.goal.per === 'day' ? 1 : Math.min(d.goal.n, d.goal.per === 'week' ? 7 : 31); paintGoal(); }
      else if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'save') {
        d.name = $('#hb-name', m).value.trim(); d.icon = ($('#hb-icon', m).value.trim() || d.icon || '✓');
        if (!d.name) { toast('Give the habit a name'); $('#hb-name', m).focus(); return; }
        const goal = { per: d.goal.per, n: d.goal.per === 'day' ? 1 : d.goal.n };
        if (isNew) S.habits.push({ id: uid(), name: d.name, icon: d.icon, color: d.color, goal, created: todayStr(), log: {} });
        else Object.assign(h, { name: d.name, icon: d.icon, color: d.color, goal });
        save(); closeModal(); sfx('add'); renderMain();
      } else if (b.dataset.m === 'del') {
        closeModal();
        if (await askConfirm(`Delete “${h.name}” and its history?`)) { S.habits = S.habits.filter(x => x !== h); save(); renderMain(); } else openHabit(h);
      }
    };
  }, 'wide');
}
// one form for a new or an existing list: name, icon (or any emoji), colour and the list it sits inside
const isEmojiIcon = i => !!i && !IC[i];
function iconColourFields(d, what) {
  return `<div class="lbl">Icon<input id="pk-isearch" type="search" placeholder="Search icons" autocomplete="off" aria-label="Search icons"><div class="ic-scroll" id="pk-icons">${iconGridHtml(d.icon, d.color)}<p class="hint ic-none" hidden>No icon matches that.</p></div><label class="hb-own">or use an emoji <input id="pk-emoji" maxlength="8" value="${isEmojiIcon(d.icon) ? esc(d.icon) : ''}" placeholder="🙂" autocomplete="off"></label></div>
<div class="lbl">Colour<div class="sw">${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}<input type="color" id="pk-cust" value="${/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#4772fa'}" title="Custom colour"></div></div>`;
}
// keeps the preview, the icon grid and the swatches in step with d
function iconColourWire(m, d) {
  const paint = () => {
    $$('#pk-icons button', m).forEach(b => { b.classList.toggle('on', b.dataset.i === d.icon || (!d.icon && b.dataset.i === 'list')); b.style.color = d.color; });
    $$('.sw button', m).forEach(b => b.classList.toggle('on', b.dataset.c === d.color));
    const pv = $('#pk-prev', m); if (pv) pv.innerHTML = `<span class="ni" style="color:${d.color}">${listIcon(d, 22)}</span><b>${esc(d.name || 'Untitled')}</b>`;
  };
  m.oninput = e => {
    if (e.target.id === 'pk-isearch') { iconFilter(m, e.target.value); return; }
    if (e.target.id === 'pk-name') d.name = e.target.value;
    else if (e.target.id === 'pk-emoji') { const v = e.target.value.trim(); d.icon = v || ''; }
    paint();
  };
  m.onchange = e => { if (e.target.id === 'pk-cust') { d.color = e.target.value; paint(); } };
  const click = e => {
    const b = e.target.closest('button'); if (!b) return false;
    if (b.dataset.i) { d.icon = b.dataset.i === 'list' ? '' : b.dataset.i; const em = $('#pk-emoji', m); if (em) em.value = ''; paint(); return true; }
    if (b.dataset.c) { d.color = b.dataset.c; paint(); return true; }
    return false;
  };
  paint(); return click;
}
function openListForm(l, parent = '') {
  const isNew = !l, d = l ? { name: l.name, icon: l.icon || '', color: l.color, parent: l.parent || '', banner: bannerDraft(l.banner) } : { name: '', icon: '', color: COLORS[S.lists.length % COLORS.length][0], parent, banner: bannerDraft(null) };
  const bad = l ? new Set([l.id, ...listDescendants(l.id)]) : new Set();
  const parents = () => '<option value="">— Top level —</option>' + listTree().filter(x => !bad.has(x.l.id)).map(x => `<option value="${esc(x.l.id)}"${x.l.id === d.parent ? ' selected' : ''}>${'\u2003'.repeat(x.depth)}${x.depth ? '↳ ' : ''}${esc(x.l.name)}</option>`).join('');
  openModal(`<h3>${isNew ? (parent ? 'New sublist' : 'New list') : 'Edit list'}</h3><div class="pk-prev" id="pk-prev"></div><div class="form one">
<label>Name<input id="pk-name" value="${esc(d.name)}" placeholder="e.g. Groceries" autocomplete="off"></label>
${iconColourFields(d)}
<label>Inside<select id="pk-parent">${parents()}</select></label>
${bannerFields(d, d.color)}</div>
<div class="mact">${isNew ? '' : '<button class="danger" data-m="del">Delete</button>'}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    const click = iconColourWire(m, d); $('#pk-name', m).focus();
    const bw = bannerWire(m, d, () => d.color), oi = m.oninput; m.oninput = e => { if (!bw.input(e)) oi(e); };
    m.onchange = e => { if (bw.change(e)) return; if (e.target.id === 'pk-parent') d.parent = e.target.value; else if (e.target.id === 'pk-cust') { d.color = e.target.value; oi({ target: { id: '' } }); } };
    m.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing && e.target.id === 'pk-name') { e.preventDefault(); $('[data-m=save]', m).click(); } };
    m.onclick = async e => {
      if (bw.click(e)) return;
      if (click(e)) return;
      const b = e.target.closest('button');
      if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'save') {
        d.name = $('#pk-name', m).value.trim(); if (!d.name) { toast('Give the list a name'); $('#pk-name', m).focus(); return; }
        const em = $('#pk-emoji', m).value.trim(); if (em) d.icon = em;
        if (isNew) { const nl = { id: uid(), name: d.name, color: d.color, sections: [], created: Date.now(), parent: d.parent || null }; if (d.icon) nl.icon = d.icon; bannerSet(nl, d.banner); S.lists.push(nl); if (d.parent) S.settings.ui.fold['l:' + d.parent] = false; save(); closeModal(); sfx('add'); setNav('list:' + nl.id); }
        else { l.name = d.name; l.color = d.color; l.parent = d.parent || null; if (d.icon) l.icon = d.icon; else delete l.icon; bannerSet(l, d.banner); save(); closeModal(); refresh(); }
      } else if (b.dataset.m === 'del') { closeModal(); U.nav = 'list:' + l.id; ACT.listmenu({ dataset: { lid: l.id } }); }
    };
  }, 'wide');
}
// projects: a named set of lists (each brings its sublists), viewed together
function openProjectForm(p) {
  const isNew = !p, d = p ? { name: p.name, icon: p.icon || '', color: p.color, ids: new Set(p.listIds || []), banner: bannerDraft(p.banner) } : { name: '', icon: 'layers', color: COLORS[(S.projects.length + 3) % COLORS.length][0], ids: new Set(), banner: bannerDraft(null) };
  if (d.icon === 'layers') d.icon = '';
  const tree = listTree(), pickers = () => tree.length ? tree.map(({ l, depth }) => `<label class="pk-l" style="--d:${depth}"><input type="checkbox" data-lid="${esc(l.id)}"${d.ids.has(l.id) ? ' checked' : ''}><span class="ni" style="color:${l.color}">${listIcon(l, 16)}</span><span>${esc(l.name)}</span></label>`).join('') : '<p class="hint">Create a list first, then link it here.</p>';
  openModal(`<h3>${isNew ? 'New project' : 'Edit project'}</h3><div class="pk-prev" id="pk-prev"></div><div class="form one">
<label>Name<input id="pk-name" value="${esc(d.name)}" placeholder="e.g. Website relaunch" autocomplete="off"></label>
<div class="lbl">Lists in this project<div class="pk-lists">${pickers()}</div><p class="hint">Ticking a list brings its sublists along. A list can belong to several projects.</p></div>
${iconColourFields(d)}
${bannerFields(d, d.color)}</div>
<div class="mact">${isNew ? '' : '<button class="danger" data-m="del">Delete</button>'}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    const click = iconColourWire(m, d); $('#pk-name', m).focus(); const bw = bannerWire(m, d, () => d.color), oi = m.oninput; m.oninput = e => { if (!bw.input(e)) oi(e); };
    m.onchange = e => { if (bw.change(e)) return; if (e.target.id === 'pk-cust') { d.color = e.target.value; oi({ target: { id: '' } }); } else if (e.target.dataset.lid) { if (e.target.checked) d.ids.add(e.target.dataset.lid); else d.ids.delete(e.target.dataset.lid); } };
    m.onclick = async e => {
      if (bw.click(e)) return;
      if (click(e)) return;
      const b = e.target.closest('button');
      if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'save') {
        d.name = $('#pk-name', m).value.trim(); if (!d.name) { toast('Give the project a name'); $('#pk-name', m).focus(); return; }
        const em = $('#pk-emoji', m).value.trim(); if (em) d.icon = em;
        const ids = tree.map(x => x.l.id).filter(id => d.ids.has(id));
        if (isNew) { const np = { id: uid(), name: d.name, color: d.color, listIds: ids, created: Date.now() }; if (d.icon) np.icon = d.icon; bannerSet(np, d.banner); S.projects.push(np); save(); closeModal(); sfx('add'); setNav('project:' + np.id); }
        else { Object.assign(p, { name: d.name, color: d.color, listIds: ids }); if (d.icon) p.icon = d.icon; else delete p.icon; bannerSet(p, d.banner); save(); closeModal(); refresh(); }
      } else if (b.dataset.m === 'del') {
        closeModal();
        if (await askConfirm(`Delete the project “${p.name}”? Its lists, tasks and notes are not affected.`)) { notesDetach('project', p.id); S.projects = S.projects.filter(x => x !== p); save(); if (U.nav === 'project:' + p.id) setNav('today'); else refresh(); } else openProjectForm(p);
      }
    };
  }, 'wide');
}
const gantt_parents = () => [...S.tasks.filter(t => t.listId && !t.deleted && t.subtasks && t.subtasks.length).map(t => t.id), ...S.tasks.flatMap(t => { const out = []; const walk = a => (a || []).forEach(x => { if (x.children && x.children.length) { out.push(x.id); walk(x.children); } }); walk(t.subtasks); return out; })];
const ACT = {
  async taskicon() { const t = getT(U.sel); if (!t) return; const v = await pickIcon(t.icon || '', listOf(t.listId).color, 'Task icon'); if (v == null) return; if (v) t.icon = v; else delete t.icon; save(); render(); },
  taskiconx() { const t = getT(U.sel); if (!t) return; delete t.icon; save(); render(); },
  nav: (el, e) => {
    const nav = el.dataset.nav;
    if (nav.startsWith('tag:') && e && (e.ctrlKey || e.metaKey || e.shiftKey)) { // Ctrl / Shift + click a sidebar tag: add it to the tag filter
      const g = nav.slice(4); U.tagSel = U.tagSel.includes(g) ? U.tagSel.filter(x => x !== g) : [...U.tagSel, g];
      if (U.page !== 'tasks' || U.nav.startsWith('tag:')) setNav('all'); else render();
      return;
    }
    setNav(nav);
  },
  sortdir: () => { S.settings.sortDir = sortDir() === 'asc' ? 'desc' : 'asc'; save(); renderMain(); },
  tagtoggle: el => { const g = el.dataset.tag; U.tagSel = U.tagSel.includes(g) ? U.tagSel.filter(x => x !== g) : [...U.tagSel, g]; sfx('tick'); renderSide(); renderMain(); },
  tagmode: el => { U.tagMode = el.dataset.v; renderMain(); },
  tagclear: () => { U.tagSel = []; renderSide(); renderMain(); },
  page: el => { if (U.bsel) { U.bsel = null; document.body.classList.remove('batch'); } U.page = el.dataset.page; U.sel = null; document.body.classList.remove('drawer'); fx('#main > *:not(.top)', 'fade'); render(); },
  burger: () => document.body.classList.add('drawer'),
  scrim: () => { document.body.classList.remove('drawer'); closeDetail(); },
  open: el => { U.sel = el.dataset.id; $$('.sel').forEach(x => x.classList.remove('sel')); $$(`[data-act="open"][data-id="${U.sel}"]`).forEach(x => x.classList.add('sel')); renderDetail(); },
  closedetail: closeDetail,
  toggle: el => {
    const t = getT(el.dataset.id); if (!t) return;
    const wasOpen = t.status === 'open', rep = !!(t.repeat && t.due), eff = U.q ? 'search' : U.nav;
    toggleDone(t);
    if (!wasOpen) { refresh(); return; }
    // a finished task leaves open-only lists; a repeating one stays, with its next date
    const leaves = rep ? U.page === 'tasks' && !scopeTasks(eff).some(x => x.id === t.id) : (U.page === 'matrix' || (U.page === 'tasks' && !FLAT.includes(eff) && !U.showDone[eff]));
    tickThen(el, leaves, refresh);
  },
  settings: openSettings,
  addlist: () => openListForm(null, ''),
  async listmenu(el) {
    const l = S.lists.find(x => x.id === ((el && el.dataset && el.dataset.lid) || U.nav.slice(5))); if (!l || l.id === 'inbox') return;
    const i = await askMenu(l.name, [{ label: 'Edit list (name, icon, colour, parent)…' }, { label: 'Add a sublist…' }, { label: 'Banner…' }, { label: 'Delete list', danger: true }]);
    if (i === 0) openListForm(l);
    else if (i === 1) openListForm(null, l.id);
    else if (i === 2) openBannerDialog('list', l.id);
    else if (i === 3) {
      const kids = S.lists.filter(x => x.parent === l.id).length;
      if (!await askConfirm(`Delete “${l.name}” and move its tasks to Trash?${kids ? ` Its ${kids === 1 ? 'sublist moves' : kids + ' sublists move'} up a level.` : ''}`)) return;
      S.tasks.filter(t => t.listId === l.id).forEach(t => { t.deleted = Date.now(); });
      S.lists.forEach(x => { if (x.parent === l.id) x.parent = l.parent || null; });
      S.projects.forEach(p => { p.listIds = (p.listIds || []).filter(id => id !== l.id); });
      notesDetach('list', l.id);
      S.lists = S.lists.filter(x => x.id !== l.id); save();
      if (U.nav === 'list:' + l.id) setNav('today'); else refresh();
    }
  },
  addproject: () => openProjectForm(null),
  bannedit: el => openBannerDialog(el.dataset.kind, el.dataset.id),
  projmenu: el => { const p = projectOf(el.dataset.pid); if (p) openProjectForm(p); },
  view: el => { listOf(U.nav.slice(5)).view = el.dataset.v; save(); renderMain(); },
  async secadd() { const n = await askText('New section'); if (!n) return; const l = listOf(U.nav.slice(5)); if (!l.sections.includes(n)) l.sections.push(n); save(); renderMain(); },
  async secdel(el) {
    const l = listOf(U.nav.slice(5)), s = el.dataset.sec;
    if (!await askConfirm(`Delete section “${s}”? Its tasks stay in the list.`)) return;
    l.sections = l.sections.filter(x => x !== s); S.tasks.forEach(t => { if (t.listId === l.id && t.section === s) t.section = null; }); save(); renderMain();
  },
  showdone: () => { const k = U.q ? 'search' : U.nav; U.showDone[k] = !U.showDone[k]; renderMain(); },
  emptytrash: async () => { if (await askConfirm('Permanently delete everything in Trash?')) { S.tasks = S.tasks.filter(t => !t.deleted); U.sel = null; save(); refresh(); } },
  cleardone: async () => { if (await askConfirm('Move all completed tasks to Trash?', 'Clear')) { S.tasks.forEach(t => { if (!t.deleted && t.status === 'done') t.deleted = Date.now(); }); save(); refresh(); } },
  // detail actions
  prio: el => { getT(U.sel).priority = +el.dataset.p; save(); refresh(); },
  qdate: el => {
    const t = getT(U.sel), w = el.dataset.w, d = new Date();
    t.due = w === 'today' ? ymd(d) : w === 'tomorrow' ? ymd(addDays(d, 1)) : w === 'next' ? ymd(addDays(d, ((8 - d.getDay()) % 7) || 7)) : null;
    if (!t.due) { t.time = null; t.repeat = null; }
    save(); refresh();
  },
  subtog: el => { const s = getT(U.sel).subtasks.find(x => x.id === el.dataset.sid); s.done = !s.done; sfx(s.done ? 'tick' : 'undo'); if (s.done) fx(`.sub .chk[data-sid="${s.id}"]`, 'tick'); save(); refresh(); },
  subdel: el => { const t = getT(U.sel); t.subtasks = t.subtasks.filter(x => x.id !== el.dataset.sid); save(); refresh(); },
  del: () => { const t = getT(U.sel); t.deleted = Date.now(); toast('Moved to Trash'); sfx('trash'); save(); leaveThen(t.id, () => { closeDetail(); renderSide(); renderMain(); }); },
  restore: () => { delete getT(U.sel).deleted; save(); closeDetail(); renderSide(); renderMain(); },
  purge: () => { S.tasks = S.tasks.filter(t => t.id !== U.sel); save(); closeDetail(); renderSide(); renderMain(); },
  wontdo: () => { const t = getT(U.sel); t.status = t.status === 'wontdo' ? 'open' : 'wontdo'; save(); refresh(); },
  dup: () => { const t = getT(U.sel), c = newTask({ ...t, id: uid(), title: t.title + ' (copy)', status: 'open', created: Date.now(), subtasks: t.subtasks.map(s => ({ ...s, id: uid(), done: false })), tags: [...t.tags], links: [...(t.links || [])], files: (t.files || []).map(f => ({ ...f })) }); delete c.doneAt; delete c.deleted; S.tasks.push(c); U.sel = c.id; fx(rowSel(c.id), 'enter'); save(); refresh(); },
  // calendar
  calprev: () => calShift(-1), calnext: () => calShift(1),
  caltoday: () => { U.calD = new Date(); fx('#main > *:not(.top)', 'fade'); renderMain(); },
  calview: el => {
    const t = new Date(); if (U.calD.getFullYear() === t.getFullYear() && U.calD.getMonth() === t.getMonth()) U.calD = t; // keep "today" in view when switching
    S.settings.cal.view = el.dataset.v; save(); fx('#main > *:not(.top)', 'fade'); renderMain();
  },
  calgo: (el, e) => { if (e) e.stopPropagation(); U.calD = pYmd(el.dataset.d); S.settings.cal.view = 'day'; save(); fx('#main > *:not(.top)', 'fade'); renderMain(); },
  async calday(el) {
    const d = el.dataset.d, txt = await askText('Add task on ' + fmtDate(d), '', 'e.g. Dentist 3pm !high');
    if (!txt) return;
    quickAdd(txt, { due: d }); renderSide(); renderMain();
  },
  // habits
  haddlg: () => openHabit(null),
  hday(el) {
    const h = S.habits.find(x => x.id === el.dataset.id), d = el.dataset.d; if (!h) return;
    if (!validKey(d) || d > todayStr()) { toast("You can check in on today or an earlier day — not on a future date."); return; }
    const before = streak(h), on = !h.log[d];
    if (on) h.log[d] = 1; else delete h.log[d];
    (h.logU = h.logU || {})[d] = Date.now(); save(); // logU lets sync merge check-ins day by day
    const after = streak(h), hot = on && after > before && after >= FIRE_MIN;
    sfx(hot ? 'streak' : on ? 'done' : 'undo');
    if (on) fx(`.habit[data-id="${h.id}"] [data-d="${d}"]`, 'tick');
    renderMain();
    if (hot) fireBurst(h.id, after, habitGoal(h).per);
  },
  hmenu: el => { const h = S.habits.find(x => x.id === el.dataset.id); if (h) openHabit(h); },
  // notes + sync
  nmode: el => { U.nMode = el.dataset.m; renderDetail(); if (U.nMode === 'write') { const ta = $('textarea[data-f="notes"]'); if (ta) ta.focus(); } },
  nedit: (el, e) => {
    if (e.target.closest('a,input')) return; // links and checkboxes act on their own
    U.nMode = 'write'; renderDetail(); const ta = $('textarea[data-f="notes"]'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  },
  nfmt: el => { const f = el.dataset.for; if (f && /^#[nx]-ta$/.test(f) && BE.cur && BE.cur.o.pre === f[1] && $(`#${f[1]}-ed`) && $(`#${f[1]}-ed`).classList.contains('ed-blocks') && bedFormat(el.dataset.k)) return; mdFormat(el.dataset.k, f ? $(f) : null); },
  ...NOTE_ACT,
  ...SC_ACT,
  ...BATCH_ACT,
  ...HABIT_ACT,
  ...HELP_ACT,
  ...GT_ACT,
  // Gantt dates in the task panel
  gxstart: () => { const t = getT(U.sel); if (!t) return; t.astart = todayStr(); sfx('tick'); save(); refresh(); },
  gxend: () => { const t = getT(U.sel); if (!t || t.status === 'done') return; t.status = 'done'; t.doneAt = Date.now(); if (t.astart && t.astart > todayStr()) t.astart = todayStr(); sfx('done'); save(); refresh(); },
  gxclear: () => { const t = getT(U.sel); if (!t) return; t.astart = null; if (t.status === 'done') { t.status = 'open'; delete t.doneAt; } sfx('undo'); save(); refresh(); },
  syncnow: () => syncNow(true),
  syncdock: () => { if (Sync.on) syncNow(true); else openSync(); },
  // history
  hact: el => { const a = el.dataset.a, l = U.hist.acts; U.hist.acts = l.includes(a) ? l.filter(x => x !== a) : [...l, a]; U.hist.shown = 150; renderMain(); },
  hkind: el => { const k = el.dataset.k, l = U.hist.kinds; U.hist.kinds = l.includes(k) ? l.filter(x => x !== k) : [...l, k]; U.hist.shown = 150; renderMain(); },
  hreset: () => { U.hist.acts = []; U.hist.kinds = []; U.hist.q = ''; U.hist.shown = 150; renderMain(); },
  hmore: () => { U.hist.shown += 150; $('#hlist').innerHTML = histListHtml(); },
  hclear: async () => { if (await askConfirm('Clear the whole history? Your tasks and notes are not affected.', 'Clear')) { S.history = []; save(); renderMain(); } },
  hopen: el => {
    const k = el.dataset.k, id = el.dataset.id;
    if (k === 'task') {
      const t = getT(id); if (!t) { toast('That task was deleted forever'); return; }
      setNav(t.deleted ? 'trash' : t.status === 'done' ? 'done' : t.status === 'wontdo' ? 'wontdo' : t.listId === 'inbox' ? 'inbox' : 'list:' + t.listId); U.sel = id; renderMain(); renderDetail();
    } else if (k === 'note') { if (noteById(id)) openNoteById(id); else toast('That note was deleted'); }
    else if (k === 'habit') { U.page = 'habits'; render(); }
    else if (k === 'slot') { U.page = 'timetable'; render(); }
    else if (k === 'list') { if (S.lists.some(l => l.id === id)) setNav('list:' + id); else toast('That list was deleted'); }
  },
  // tags
  tagmenu: el => tagMenu(el.dataset.tag),
  tagcolor: el => tagMenu(el.dataset.tag),
  // timetable
  ttprev: () => ttShift(-1), ttnext: () => ttShift(1),
  tttoday: () => { U.ttDate = new Date(); renderMain(); },
  ttview: el => { U.ttV = el.dataset.v; S.settings.tt.view = el.dataset.v; save(); renderMain(); },
  ttday: el => { U.ttDate = pYmd(el.dataset.d); U.ttV = 'day'; S.settings.tt.view = 'day'; save(); renderMain(); },
  ttjump: el => { U.ttDate = pYmd(el.dataset.d); renderMain(); },
  tttray: () => { if (narrow(820)) openTTTasks(); else { U.ttTray = !ttTrayOn(); renderMain(); } },
  ttsched: (el, e) => { e.stopPropagation(); openTTSchedule(el.dataset.id); },
  ttset: openTTSettings,
  ttad() { S.settings.tt.adOpen = S.settings.tt.adOpen === false; save(); U.ttAvail = null; renderMain(); },
  ttadd: () => { const n = new Date(), m = Math.min(1380, Math.max(S.settings.tt.from * 60, n.getMinutes() > 30 ? (n.getHours() + 1) * 60 : n.getHours() * 60)); openTTCreate({ date: ymd(U.ttDate || n), start: fromMin(m), end: fromMin(m + 60) }); },
  ttslot: el => openSlot(slotById(el.dataset.sid)),
  ttcell: (el, e) => {
    const y = zy(e.clientY, el.getBoundingClientRect().top), m = Math.min(1380, +el.dataset.from + Math.floor(y / (TT_HH / 60) / 30) * 30);
    openTTCreate({ date: el.dataset.d, start: fromMin(m), end: fromMin(Math.min(1439, m + 60)) });
  },
  // gantt / OpenGantt
  ogopen: el => openOG(el.dataset.list),
  gtog: (el, e) => { e.stopPropagation(); const k = el.dataset.key; if (U.gcol.has(k)) U.gcol.delete(k); else U.gcol.add(k); renderMain(); },
  gfold: el => { const k = el.dataset.k, f = S.settings.ui.fold; f[k] = !f[k]; save(); el.classList.toggle('closed', !!f[k]); el.setAttribute('aria-expanded', String(!f[k])); const b = el.nextElementSibling; if (b && b.classList.contains('gbody')) b.classList.toggle('closed', !!f[k]); },
  gfoldall: () => { const hs = $$('#main .gtog'); if (!hs.length) return; const shut = hs.some(h => !h.classList.contains('closed')), f = S.settings.ui.fold; hs.forEach(h => { f[h.dataset.k] = shut; h.classList.toggle('closed', shut); h.setAttribute('aria-expanded', String(!shut)); const b = h.nextElementSibling; if (b && b.classList.contains('gbody')) b.classList.toggle('closed', shut); }); save(); },
  pexp: el => { const f = S.settings.ui.fold, k = 'pe:' + el.dataset.pid; f[k] = !f[k]; save(); renderSide(); },
  fold: el => { const f = S.settings.ui.fold; f[el.dataset.k] = !f[el.dataset.k]; save(); renderSide(); },
  uitoggle: el => uiToggle(el.dataset.k),
  gzoom: el => gtZoom(+el.dataset.d),
  gfit: gtFit,
  gtable: () => { const g = S.settings.gantt; g.table = g.table === false; save(); renderMain(); },
  gcols: openGtCols,
  gexp: el => {
    if (el.dataset.v === '0') U.gcol.clear();
    else gantt_parents().forEach(id => U.gcol.add(id));
    renderMain();
  },
  gtoday: () => { const w = $('.gt-wrap'), u = $('.gt-h .gt-ht u'); if (w && u) w.scrollLeft = Math.max(0, parseFloat(u.style.left) - 220); },
  // focus
  pmode: el => { pSet(el.dataset.m); renderMain(); },
  ptoggle: () => { pToggle(); renderMain(); },
  preset: () => { P.left = P.total; P.run = false; P.act = false; wlSync(); renderMain(); },
  padd: el => pAdd(+el.dataset.m),
  pcustom: () => { const i = $('#pcus'); if (i && pCustom(i.value)) renderMain(); },
  pskip: () => { pSet(P.mode === 'focus' ? 'short' : 'focus'); renderMain(); },
};
document.addEventListener('click', e => {
  if (U.suppress && Date.now() - U.suppress < 80) { U.suppress = 0; e.preventDefault(); return; } // the click that ends a block resize
  const a = e.target.closest('a[href]');
  if (a && a.closest('.md')) { e.preventDefault(); openExternal(a.href); return; }
  const wl = e.target.closest('.wl[data-note]'); if (wl) { e.preventDefault(); openNoteById(wl.dataset.note); return; }
  if (e.target.closest('#modal')) return;
  if (U.bsel) { const r = e.target.closest('#main [data-act="open"][data-id],#main [data-act="toggle"][data-id]'); if (r) { batchToggle(r.dataset.id, e); return; } }
  const dp = e.target.closest('[data-dp]');
  if (dp && dp.closest('#detail [data-dur=task]')) { const t = getT(U.sel); if (t) { t.dur = +dp.dataset.dp || null; save(); sfx('tick'); refresh(); } return; }
  const fa = e.target.closest('[data-fa]');
  if (fa && !(e.target.closest('.frow') && e.target.closest('button[data-fa]') && e.target.closest('button[data-fa]') !== fa)) { fileAction(fa); return; }
  const fl = e.target.closest('.fl[data-file]'); if (fl) { e.preventDefault(); const own = [['task', U.sel], ['note', U.noteSel]].find(([k, id]) => id && filesOf(fileOwner(k, id)).some(f => f.id === fl.dataset.file)); if (own) fileView(own[0], own[1], fl.dataset.file); else toast('That file is not attached here'); return; }
  const eb = e.target.closest('[data-ed]'); if (eb) { edSetMode(eb.dataset.ed, eb.dataset.mode); return; } // Write / Split / Preview on the Notes page
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (fn) fn(el, e);
});

/* ---------- inputs ---------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'nq') { U.nq = el.value; renderNoteList(); return; }
  if (el.id === 'hq') { U.hist.q = el.value; U.hist.shown = 150; const l = $('#hlist'); if (l) l.innerHTML = histListHtml(); return; }
  if (el.dataset.f === 'ntitle') { noteInput('title', el.value); return; }
  if (el.dataset.f === 'nbody') { noteInput('body', el.value); return; }
  if (el.id === 'q') { U.q = el.value.trim(); if (U.q) U.page = 'tasks'; U.sel = null; renderSide(); renderMain(); renderDetail(); $('#q').focus(); return; }
  const t = getT(U.sel);
  const dbox = el.closest && el.closest('#detail [data-dur=task]');
  if (dbox && t) { t.dur = durRead(dbox); durMark(dbox, t.dur || 0); save(); clearTimeout(U._dr); U._dr = setTimeout(() => { renderMain(); renderSide(); }, 250); return; } // typing: store as you go, tidy the boxes on blur
  if (el.dataset.f === 'title' && t) { t.title = el.value; save(); $$(`.task[data-id="${t.id}"] .ttl, .card[data-id="${t.id}"] .ttl`).forEach(x => { x.innerHTML = titleHtml(t); }); }
  else if (el.dataset.f === 'notes' && t) { t.notes = el.value; U.nMode = 'write'; save(); fitTa(el); }
  else if (el.dataset.sf && t) { const s = t.subtasks.find(x => x.id === el.dataset.sf); if (s) { s.title = el.value; save(); } }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.closest('#modal')) return;
  if (el.classList && el.classList.contains('mdchk') && el.closest && el.closest('#n-pv')) { // a checklist ticked in a note's preview
    const n = noteById(U.noteSel); if (!n) return;
    n.body = mdToggleLine(n.body, +el.dataset.mdl); n.updated = Date.now(); const ta = $('#n-ta'); if (ta) ta.value = n.body; save(); sfx(el.checked ? 'done' : 'undo'); notePaint(); return;
  }
  if (el.dataset.f === 'ntags') { noteInput('tags', el.value); return; }
  if (el.dataset.f === 'nhome') { const n = noteById(U.noteSel); if (!n) return; noteSetHome(n, el.value); save(); renderNoteList(); const sc = noteScope(); if (sc && !noteInScope(n, sc)) toast('Filed under another list — it moved out of this view'); return; }
  if (el.classList && el.classList.contains('mdchk')) {
    const t = getT(U.sel); if (!t) return;
    t.notes = mdToggleLine(t.notes, +el.dataset.mdl); sfx(el.checked ? 'tick' : 'undo'); save();
    const pv = $('#nprev'); if (pv) pv.innerHTML = md(t.notes);
    renderMain(); return;
  }
  if (el.dataset.fd !== undefined) {
    if (el.checked) {
      const r = await fdEnable();
      if (r !== true) { el.checked = false; toast(r === 'denied' ? 'Motion access was denied — allow it in your browser settings' : 'No motion sensor found, so face-down mode needs a phone or tablet'); S.settings.pomo.faceDown = false; fdDisable(); save(); renderMain(); return; }
      S.settings.pomo.faceDown = true; sfx('tick');
    } else { S.settings.pomo.faceDown = false; fdDisable(); }
    save(); P.act = pActive(); wlSync(); renderMain(); return;
  }
  if (el.dataset.hsel) { U.hist[el.dataset.hsel] = el.value; renderMain(); return; }
  if (el.dataset.gs) { if (el.dataset.gs === 'list') U.gList = el.value; else { S.settings.gantt[el.dataset.gs] = el.value; save(); } U.gScrollReset = true; renderMain(); return; }
  if (el.dataset.sel) {
    if (el.dataset.sel === 'ptask') P.task = el.value; else if (el.dataset.sel === 'projlist') { U.projList[el.dataset.pid] = el.value; renderMain(); } else { S.settings[el.dataset.sel] = el.value; if (el.dataset.sel === 'sort') S.settings.sortDir = null; /* each sort starts in its natural direction */ save(); renderMain(); }
    return;
  }
  const dbox = el.closest && el.closest('#detail [data-dur=task]');
  if (dbox) { const t = getT(U.sel); if (t) { t.dur = durRead(dbox); durSet(dbox, t.dur || 0); save(); renderMain(); renderSide(); } return; }
  const rbox = el.closest && el.closest('#detail [data-rem=task]');
  if (rbox) { // reminder: a preset, or any amount before the due time
    const t = getT(U.sel); if (!t) return;
    if (el.classList.contains('rsel')) U.remCustom = el.value === 'custom' ? t.id : null;
    t.reminder = remRead(rbox); if (t.reminder != null) { if (!t.due) t.due = todayStr(); ensureNotify(); }
    save(); refresh(); return;
  }
  const f = el.dataset.f, t = getT(U.sel); if (!f || !t) return;
  const v = el.value;
  if (f === 'due') { t.due = v || null; if (!v) { t.time = null; t.repeat = null; } else if (t.start && v < t.start) t.start = v; }
  else if (f === 'time') t.time = v || null;
  else if (f === 'list') { t.listId = v; t.section = null; }
  else if (f === 'section') t.section = v || null;
  else if (f === 'repeat') { if (v === 'none') t.repeat = null; else if (REPS[v]) { t.repeat = JSON.parse(JSON.stringify(REPS[v])); if (!t.due) t.due = todayStr(); } }
  else if (f === 'start') { t.start = v || null; if (t.start && t.due && t.start > t.due) t.due = t.start; }
  else if (f === 'astart') { t.astart = v || null; if (t.astart && t.status === 'done' && t.doneAt && ymd(new Date(t.doneAt)) < t.astart) t.doneAt = ogNoon(t.astart); }
  else if (f === 'aend') { // an actual end date means the task finished that day; clearing it reopens the task
    if (v) { if (t.status !== 'done') { t.status = 'done'; sfx('done'); } t.doneAt = ogNoon(v); if (t.astart && t.astart > v) t.astart = v; }
    else if (t.status === 'done') { t.status = 'open'; delete t.doneAt; sfx('undo'); }
  }
  else if (f === 'slot') { t.slotId = v || null; const sl = v && slotById(v); if (sl && !t.due) t.due = ymd(nextSlotDate(sl)); }
  else if (f === 'tags') t.tags = [...new Set(v.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean))];
  else return;
  save(); refresh();
});
document.addEventListener('keydown', e => {
  const el = e.target;
  if (e.key === 'Enter' && !e.isComposing) {
    if (el.id === 'pcus') { if (pCustom(el.value)) renderMain(); return; }
    if (el.id === 'add' && el.value.trim()) { const t = quickAdd(el.value.trim(), addCtx()); el.value = ''; renderSide(); renderMain(); $('#add').focus(); toast('Added “' + t.title + '”'); }
    else if (el.classList.contains('kadd') && el.value.trim()) { const sec = el.dataset.sec; quickAdd(el.value.trim(), { listId: U.nav.slice(5), section: sec || null }); renderSide(); renderMain(); const n = $$('.kadd').find(x => x.dataset.sec === sec); if (n) n.focus(); }
    else if (el.classList.contains('tradd') && el.value.trim()) { quickAdd(el.value.trim(), {}); renderSide(); renderMain(); const n = $('.tradd'); if (n) n.focus(); }
    else if (el.classList.contains('caladd') && el.value.trim()) { quickAdd(el.value.trim(), { due: el.dataset.d }); renderSide(); renderMain(); const n = $('.caladd'); if (n) n.focus(); }
    else if (el.classList.contains('qadd') && el.value.trim()) { const i = el.dataset.q; quickAdd(el.value.trim(), U.matrixCtx[i]); renderSide(); renderMain(); $$('.qadd')[i].focus(); }
    else if (el.dataset.md !== undefined) mdEnter(el, e);
    else if (el.id === 'd-subnew' && el.value.trim()) { getT(U.sel).subtasks.push({ id: uid(), title: el.value.trim(), done: false }); save(); renderDetail(); renderMain(); $('#d-subnew').focus(); }
    return;
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  if (el.dataset && el.dataset.md !== undefined) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) { const k = { b: 'bold', i: 'italic', k: 'link' }[e.key.toLowerCase()]; if (k) { e.preventDefault(); mdFormat(k, el); return; } }
    if (e.key === 'Tab') { mdTab(el, e); return; }
  }
  if (e.key === 'Escape') { if (U.nFull && !$('#modal.on') && !$('.bed-pop')) { noteFull(false); return; } if ($('#modal.on')) { const b = $('.mback'); if (b) b.click(); } else if (U.sel) closeDetail(); else document.body.classList.remove('drawer'); return; }
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); document.body.classList.add('drawer'); const q = $('#q'); if (q) q.focus(); return; }
  if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && !($('#modal.on'))) {
    if (e.key === '[') { e.preventDefault(); uiToggle('side'); return; }
    if (e.key === ']') { e.preventDefault(); uiToggle('detail'); return; }
    if (e.key === '\\') { e.preventDefault(); uiFocus(); return; }
  }
  if (e.key === 'n' && !typing && !e.ctrlKey && !e.metaKey) { const a = $('#add'); if (a) { e.preventDefault(); a.focus(); } }
});

/* ---------- notes editing helpers ---------- */
function mdFormat(kind, ta) {
  ta = ta || $('textarea[data-f="notes"]'); if (!ta) return;
  let a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
  const sel = v.slice(a, b);
  const wrap = (l, r, ph) => { const inner = sel || ph; v = v.slice(0, a) + l + inner + r + v.slice(b); a += l.length; b = a + inner.length; };
  // add `pre` to every selected line, or strip it again if all of them already have it (`add` may be a function of the line number)
  const lines = (has, add, strip) => {
    const s0 = v.lastIndexOf('\n', a - 1) + 1; let e0 = v.indexOf('\n', b); if (e0 < 0) e0 = v.length;
    const ls = v.slice(s0, e0).split('\n'), blk = (ls.every(l => has.test(l)) ? ls.map(l => l.replace(strip, '')) : ls.map((l, i) => (typeof add === 'function' ? add(i) : add) + l.replace(strip, ''))).join('\n');
    v = v.slice(0, s0) + blk + v.slice(e0); a = b = s0 + blk.length; // caret after the block, so typing continues the line instead of replacing it
  };
  const insert = (txt, selFrom, selLen) => { const pre = a > 0 && v[a - 1] !== '\n' ? '\n\n' : a > 0 && v[a - 2] !== '\n' && v[a - 1] === '\n' ? '\n' : ''; v = v.slice(0, a) + pre + txt + v.slice(b); a += pre.length + selFrom; b = a + selLen; };
  const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
  if (kind === 'bold') wrap('**', '**', 'bold');
  else if (kind === 'italic') wrap('*', '*', 'italic');
  else if (kind === 'strike') wrap('~~', '~~', 'text');
  else if (kind === 'mark') wrap('==', '==', 'text');
  else if (kind === 'code') { if (sel.includes('\n')) wrap('```\n', '\n```', ''); else wrap('`', '`', 'code'); }
  else if (kind === 'link') { const txt = sel || 'link'; v = v.slice(0, a) + '[' + txt + '](https://)' + v.slice(b); a += txt.length + 3; b = a + 8; }
  else if (kind === 'img') { const txt = sel || 'alt text'; v = v.slice(0, a) + '![' + txt + '](https://)' + v.slice(b); a += txt.length + 4; b = a + 8; }
  else if (kind === 'embed') insert('![](https://)\n', 4, 8);
  else if (kind === 'nembed') insert('![[Note title]]\n', 3, 10);
  else if (kind === 'ul') lines(/^\s*[-*+]\s+(?!\[[ xX]\])/, '- ', ITEM);
  else if (kind === 'ol') lines(/^\s*\d+[.)]\s+/, i => `${i + 1}. `, ITEM);
  else if (kind === 'task') lines(/^\s*[-*+]\s+\[[ xX]\]\s/, '- [ ] ', ITEM);
  else if (kind === 'quote') lines(/^>\s?/, '> ', /^>\s?/);
  else if (kind === 'h') lines(/^#{1,6}\s/, '## ', /^#{1,6}\s+/);
  else if (kind === 'hr') insert('---\n', 4, 0);
  else if (kind === 'table') insert('| Column | Column |\n|---|---|\n|  |  |\n', 2, 6);
  ta.value = v; ta.setSelectionRange(a, b); ta.focus();
  ta.dispatchEvent(new Event('input', { bubbles: true })); // the editor's own input handler stores the text, so every editor behaves the same
}
// Tab / Shift+Tab indent or outdent list items and selected lines; on an ordinary line Tab keeps its normal job (moving focus)
function mdTab(ta, e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, s0 = v.lastIndexOf('\n', a - 1) + 1; let e0 = v.indexOf('\n', b); if (e0 < 0) e0 = v.length;
  const ls = v.slice(s0, e0).split('\n');
  if (!(ls.length > 1 || /^\s*(?:[-*+]|\d+[.)])\s/.test(ls[0]))) return;
  e.preventDefault();
  const out = ls.map(l => (e.shiftKey ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l));
  const d0 = out[0].length - ls[0].length, total = out.join('\n').length - (e0 - s0);
  ta.setRangeText(out.join('\n'), s0, e0, 'preserve'); ta.setSelectionRange(Math.max(s0, a + d0), b + total);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
// Enter at the end of a list item continues the list (an empty item ends it)
function mdEnter(ta, e) {
  if (e.shiftKey || ta.selectionStart !== ta.selectionEnd) return;
  const v = ta.value, p = ta.selectionStart, eol = v.indexOf('\n', p);
  if (eol !== -1 && eol !== p) return;
  const s0 = v.lastIndexOf('\n', p - 1) + 1, m = v.slice(s0, p).match(/^(\s*)([-*+]|(\d+)([.)]))\s+(\[[ xX]\]\s+)?(.*)$/);
  if (!m) return;
  e.preventDefault();
  if (!m[6].trim()) ta.setRangeText('', s0, p, 'end'); // empty item: drop the marker and leave the list
  else ta.setRangeText('\n' + m[1] + (m[3] ? (+m[3] + 1) + m[4] : m[2]) + ' ' + (m[5] ? '[ ] ' : ''), p, p, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ---------- drag & drop (reorder rows, move cards between board columns, matrix boxes) ---------- */
// dropping a task in a matrix box changes its priority / due date to fit the box, and places it before the row it landed on
function matrixDrop(e, quad) {
  const t = getT(U.drag); if (!t) return;
  const qi = +quad.dataset.qi, from = mxOf(t), row = e.target.closest('.task[data-id]'), before = row && row.dataset.id !== t.id ? getT(row.dataset.id) : null;
  if (qi === from && !before && !quad.contains(e.target.closest('.qb'))) return;
  if (qi !== from) { mxMove(t, qi); toast(`Moved to “${MQ[qi].n}”`); sfx('sched'); } else sfx('tick');
  if (S.settings.sort === 'manual') {
    if (before) t.order = (before.order || 0) - 0.5;
    else t.order = Math.max(0, ...S.tasks.filter(x => !x.deleted && x.status === 'open' && x.id !== t.id && mxOf(x) === qi).map(x => x.order || 0)) + 1000;
  }
  save(); fx(rowSel(t.id), 'flash'); refresh();
}
document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.fmt,.rz')) e.preventDefault(); });
document.addEventListener('dragstart', e => {
  if (U.tdrag) { e.preventDefault(); return; } // a touch drag is already under way
  const r = e.target.closest('[data-id][draggable],[data-sid][draggable]'); if (!r) return;
  if (e.target.closest('.rz')) { e.preventDefault(); return; }
  U.drag = r.dataset.sid ? `slot:${r.dataset.sid}:${r.dataset.day}` : r.dataset.id;
  U.dragOff = r.classList.contains('blk') ? zy(e.clientY, r.getBoundingClientRect().top) : 0; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', U.drag); r.classList.add('drag');
});
document.addEventListener('dragend', () => { U.drag = null; $$('.drag,.over').forEach(x => x.classList.remove('drag', 'over')); });
document.addEventListener('dragover', e => {
  if (!U.drag) return;
  const quad = U.page === 'matrix' && e.target.closest('.quad');
  if (quad && getT(U.drag)) { e.preventDefault(); $$('.over').forEach(x => x.classList.remove('over')); quad.classList.add('over'); const r = e.target.closest('.task'); if (r && r.dataset.id !== U.drag) r.classList.add('over'); return; }
  const tgt = e.target.closest('.task[draggable],.col[data-sec],.tt-col,.tt-ad,.nav[data-nav],.gt-t');
  if (tgt) { e.preventDefault(); $$('.over').forEach(x => x.classList.remove('over')); tgt.classList.add('over'); }
});
document.addEventListener('drop', e => {
  if (!U.drag) return;
  const quad = U.page === 'matrix' && e.target.closest('.quad');
  if (quad && getT(U.drag)) { e.preventDefault(); matrixDrop(e, quad); return; }
  const tt = e.target.closest('.tt-col,.tt-ad');
  if (tt) { e.preventDefault(); ttDrop(e, tt); return; }
  const nv = e.target.closest('.nav[data-nav]');
  if (nv && getT(U.drag)) { e.preventDefault(); uiNavDrop(nv); return; }
  const gt = e.target.closest('.gt-t');
  if (gt && getT(U.drag)) { e.preventDefault(); gtDrop(e, gt); return; }
  const col = e.target.closest('.col[data-sec]'), row = e.target.closest('.task[draggable]');
  if (col) { e.preventDefault(); const t = getT(U.drag); t.section = col.dataset.sec || null; save(); renderMain(); }
  else if (row) { e.preventDefault(); reorder(U.drag, row.dataset.id); }
});

// resize a timetable block by its top or bottom edge (slot start / end time, task start / duration), 15-minute steps
document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('.rz'); if (!h) return;
  e.preventDefault(); e.stopPropagation();
  const blk = h.parentElement, top = h.dataset.e === 'top', a = +blk.dataset.a, b = +blk.dataset.b, ppm = TT_HH / 60, y0 = e.clientY;
  const col = blk.parentElement, from = col && col.dataset.from ? +col.dataset.from : 0;
  let na = a, nb = b;
  if (h.setPointerCapture) h.setPointerCapture(e.pointerId);
  const mv = ev => {
    const dm = Math.round(zd(ev.clientY - y0) / ppm / 15) * 15;
    if (top) na = Math.max(from, Math.min(b - 15, a + dm)); else nb = Math.max(a + 15, Math.min(1439, b + dm));
    blk.style.top = (na - from) * ppm + 'px'; blk.style.height = Math.max(TT_MINH(), (nb - na) * ppm - 2) + 'px';
  };
  const up = () => {
    h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    U.suppress = Date.now();
    if (h.dataset.k === 'slot') { const sl = slotById(h.dataset.id); if (sl) { if (top) sl.start = fromMin(na); else sl.end = fromMin(nb); } }
    else { const t = getT(h.dataset.id); if (t) { if (top) t.time = fromMin(na); t.dur = nb - na; } }
    save(); renderMain(); renderSide();
  };
  h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
});

// timetable: drag down an empty column (mouse) to pick a time range, then a small form opens; a plain click or tap adds a one-hour block
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || e.button > 0 || U.page !== 'timetable') return;
  const col = e.target.closest && e.target.closest('.tt-col'); if (!col || e.target.closest('.blk')) return;
  const rect = col.getBoundingClientRect(), ppm = TT_HH / 60, from = +col.dataset.from, y0 = e.clientY;
  const at = y => Math.max(0, Math.min(1439, from + Math.round(zy(y, rect.top) / ppm / 15) * 15)), a0 = at(y0);
  let on = false, box = null, a = a0, b = a0;
  const mv = ev => {
    if (!on && Math.abs(ev.clientY - y0) < 6) return;
    if (!on) { on = true; box = document.createElement('div'); box.className = 'tt-sel'; col.appendChild(box); document.body.classList.add('ttdrag'); }
    const m = at(ev.clientY); a = Math.min(a0, m); b = Math.max(a0, m); if (b - a < 15) b = Math.min(1439, a + 15);
    box.style.top = (a - from) * ppm + 'px'; box.style.height = (b - a) * ppm + 'px'; box.textContent = `${fromMin(a)} – ${fromMin(b)}`;
  };
  const up = () => {
    document.removeEventListener('pointermove', mv); document.body.classList.remove('ttdrag');
    if (!on) return;
    box.remove(); U.suppress = Date.now(); // the click that follows the drag must not also open the form
    openTTCreate({ date: col.dataset.d, start: fromMin(a), end: fromMin(b) });
  };
  document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up, { once: true });
});
// timetable on a phone: swipe sideways to go to the next / previous day
let swipe = null;
document.addEventListener('touchstart', e => { const sc = e.target.closest && e.target.closest('.tt-scroll'); swipe = sc && e.touches.length === 1 && U.page === 'timetable' && ttView() !== 'week' ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
document.addEventListener('touchend', e => { if (!swipe) return; const t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y; swipe = null; if (Math.abs(dx) > 70 && Math.abs(dy) < 45) ttShift(dx < 0 ? 1 : -1); }, { passive: true });

/* ---------- timetable on a touch screen: press and hold, then slide ----------
   Phones have no HTML5 drag-and-drop, so a task or slot is picked up with a half-second press (a short buzz confirms it),
   follows the finger, and is dropped on a day column (to set its time) or the all-day row (to clear it). The grid scrolls by
   itself when the finger nears an edge. A finger that moves before the press is a scroll and does nothing. */
(() => {
  let g = null;
  const SEL = '.blk[data-id],.blk[data-sid],.tt-ad .chip[data-id],.tri[data-id]';
  const zoneAt = (x, y) => { const el = document.elementFromPoint ? document.elementFromPoint(x, y) : null; return el && el.closest ? el.closest('.tt-col,.tt-ad') : null; };
  const finish = () => {
    if (!g) return;
    clearTimeout(g.timer); clearInterval(g.tick); if (g.ghost) g.ghost.remove();
    if (g.el && g.el.classList) g.el.classList.remove('drag');
    document.body.classList.remove('tdrag'); $$('.over').forEach(x => x.classList.remove('over'));
    if (g.on) { U.drag = null; U.tdrag = false; U.suppress = Date.now(); }
    g = null;
  };
  const place = (x, y) => {
    const gh = g.ghost; gh.style.left = Math.round(x / Z.z - g.gw / 2) + 'px'; gh.style.top = Math.round(y / Z.z - (U.dragOff || g.gh / 2)) + 'px'; // the ghost lives in the scaled page
    gh.style.display = 'none'; const z = zoneAt(x, y); gh.style.display = '';
    $$('.over').forEach(el => { if (el !== z) el.classList.remove('over'); }); if (z) z.classList.add('over');
  };
  document.addEventListener('touchstart', e => {
    if (U.page !== 'timetable' || e.touches.length !== 1) return;
    const el = e.target.closest && e.target.closest(SEL); if (!el || e.target.closest('.rz,.chk,button,input,select')) return;
    const t = e.touches[0]; finish(); g = { el, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, on: false };
    g.timer = setTimeout(() => {
      if (!g) return;
      const r = g.el.getBoundingClientRect(); g.on = true; swipe = null;
      U.drag = g.el.dataset.sid ? `slot:${g.el.dataset.sid}:${g.el.dataset.day}` : g.el.dataset.id; U.tdrag = true;
      U.dragOff = g.el.classList.contains('blk') ? zy(g.y0, r.top) : 0;
      g.gw = Math.min(r.width / Z.r, 230); g.gh = Math.min(r.height / Z.r, 90);
      const gh = g.ghost = g.el.cloneNode(true); gh.classList.add('tghost'); gh.removeAttribute('data-act'); gh.removeAttribute('draggable');
      for (const [k, v] of Object.entries({ position: 'fixed', margin: '0', width: g.gw + 'px', height: g.gh + 'px', zIndex: '300', pointerEvents: 'none', right: 'auto', bottom: 'auto' })) gh.style[k] = v;
      document.body.appendChild(gh); g.el.classList.add('drag'); document.body.classList.add('tdrag');
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (_) { /* optional */ }
      place(g.x, g.y);
      g.tick = setInterval(() => { // scroll the grid while the finger sits near an edge
        const sc = $('.tt-scroll'); if (!sc || !g) return; const b = sc.getBoundingClientRect();
        const gy = zc(g.y), gx = zc(g.x), k = Z.r;
        if (gy < b.top + 80 * k) sc.scrollTop -= 12; else if (gy > b.bottom - 80 * k) sc.scrollTop += 12;
        if (gx < b.left + 36 * k) sc.scrollLeft -= 10; else if (gx > b.right - 36 * k) sc.scrollLeft += 10;
        place(g.x, g.y);
      }, 16);
    }, 480);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return; const t = e.touches[0];
    if (!g.on) { if (Math.hypot(t.clientX - g.x0, t.clientY - g.y0) > 10) finish(); return; } // moved before the press counted: it is a scroll
    e.preventDefault(); g.x = t.clientX; g.y = t.clientY; place(g.x, g.y);
  }, { passive: false });
  document.addEventListener('touchend', e => {
    if (!g) return;
    if (g.on) { const t = e.changedTouches[0], gh = g.ghost; if (gh) gh.style.display = 'none'; const z = zoneAt(t.clientX, t.clientY); if (z) ttDrop({ clientY: t.clientY }, z); }
    finish();
  });
  document.addEventListener('touchcancel', finish);
})();

/* ---------- startup ---------- */
if (!WIDGET) homeApply();
motionApply();
applyTheme();
applyScale(null, { quiet: true });
bgApply();
uiInit();
render();
mqStart();
checkReminders();
setInterval(checkReminders, 20000);
setInterval(clockPaint, 1000); setInterval(editedSweep, 20000); setTimeout(filesGC, 25000);
setTimeout(() => snapSave(), 8000); setInterval(() => snapSave(), 30 * 60000); // one automatic local backup a day
ogSchedule(1500); setInterval(() => ogSchedule(10), 180000);
// keep the timetable's "now" line moving (not while typing, in a dialog, or mid-drag)
setInterval(() => { if (U.page === 'timetable' && !U.drag && !$('#modal.on') && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) renderMain(); }, 60000);
window.addEventListener('storage', e => { if (e.key === WCMD && e.newValue) { wgRunCommand(e.newValue); return; } if (e.key === KEY) { S = load(); initSeen(); applyTheme(); render(); } });
window.addEventListener('pagehide', flush);
if (S.settings.pomo.faceDown) { try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') fdEnable(); else if (typeof DeviceOrientationEvent !== 'undefined') { window.addEventListener('deviceorientation', fdHandler); FD.on = true; } } catch (e) { /* no sensor */ } }
startSync();
widgetWire(); if (!WIDGET) { setTimeout(widgetPull, 900); window.addEventListener('focus', widgetPull); widgetPush(); }
document.addEventListener('visibilitychange', () => { if (document.hidden) widgetPush(true); else widgetPull(); if (!document.hidden) { wlSync(); checkReminders(); ogSchedule(300); if (!document.activeElement || !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) render(); } });
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__TAURI__) navigator.serviceWorker.register('sw.js').catch(() => {});

/* timetable blocks are real controls: Enter / Space opens one, and a changed window (rotation, split screen, resizing) refits the hours */
document.addEventListener('keydown', e => {
  const b = e.target && e.target.classList && e.target.classList.contains('blk') ? e.target : null;
  if (b && (e.key === 'Enter' || e.key === ' ') && !$('#modal.on')) { e.preventDefault(); b.click(); }
});
{
  let rt = 0, lastW = window.innerWidth, lastH = window.innerHeight;
  const refit = () => { clearTimeout(rt); rt = setTimeout(() => { if (window.innerWidth === lastW && window.innerHeight === lastH) return; lastW = window.innerWidth; lastH = window.innerHeight; if (U.page === 'timetable' && !$('#modal.on')) { U.ttAvail = null; renderMain(); } }, 160); };
  window.addEventListener('resize', refit); window.addEventListener('orientationchange', refit);
}
