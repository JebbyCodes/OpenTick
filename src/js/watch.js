/* OpenTick smartwatch layout, for a small round or square screen on the wrist (Wear OS and other Android watches, Tizen, any watch with a web view).

   It is the same app, the same data and the same sync and encryption, with a different face: instead of the sidebar, lists and panels there are six
   full-screen pages you swipe or tap between (the dots at the bottom):
     Now     the time, the next lesson or task, how many tasks are left
     Tasks   today's and overdue tasks, with a big tick to finish one and an Add button (type or dictate; "Call mum 5pm !high" is understood as usual)
     Next    today's timetable, with the lesson on now and the one after
     Habits  tap to check in for today
     Focus   the focus timer, with start / pause / skip
     More    sync now, lock, the full Settings, and a way back to the full app

   Settings → Appearance → Smartwatch layout: Automatic / On / Off, and the screen shape (round screens keep clear of the corners).
   Automatic turns it on in the dedicated watch builds (the Wear OS APK and the /watch/ web app), when the address has ?watch, and on browsers whose
   user-agent names a known watch. If it is not detected, choose On. Like the e-ink mode this is a setting of the device and is never synced.

   Nothing here stores anything of its own: tasks, habits, the timer and sync are the app's own, so everything that syncs and everything that
   encryption protects behaves exactly as in the full app. Notifications are the app's own as well; a watch that mirrors its phone's
   notifications shows those too (see docs/WATCHES.md). */
const WATCH_UA = /\b(Wear ?OS|Pixel Watch|Galaxy Watch|SM-R\d{3}|TicWatch|Fossil Gen|Tizen[^)]*Watch)\b/i;
const WATCH_MODES = ['auto', 'on', 'off'], WATCH_SHAPES = ['auto', 'round', 'square'];
const WATCH_PAGES = [['now', 'Now'], ['tasks', 'Tasks'], ['next', 'Next'], ['habits', 'Habits'], ['focus', 'Focus'], ['more', 'More']];
const WT = { page: 'now', add: false, x: 0, y: 0, t: 0, timer: 0 };
const watchCfg = () => { const s = S.settings; return s.watch && typeof s.watch === 'object' ? s.watch : (s.watch = { mode: 'auto', shape: 'auto' }); };
function watchAuto() {
  try {
    if (typeof OTMETA !== 'undefined' && OTMETA && OTMETA.watch) return true;
    if (typeof location !== 'undefined' && /[?&#]watch(=(1|on|true))?(&|$)/i.test((location.search || '') + (location.hash || ''))) return true;
    return typeof navigator !== 'undefined' && WATCH_UA.test(navigator.userAgent || '');
  } catch (e) { return false; }
}
const watchOn = () => { const m = watchCfg().mode; return m === 'on' || (m !== 'off' && watchAuto()); };
// round screens cut the corners off: keep the content inside the circle. Automatic = a nearly square, small screen.
function watchRound() {
  const s = watchCfg().shape; if (s === 'round') return true; if (s === 'square') return false;
  const w = typeof innerWidth === 'number' ? innerWidth : 0, h = typeof innerHeight === 'number' ? innerHeight : 0;
  return w > 0 && h > 0 && Math.max(w, h) <= 520 && Math.abs(w - h) <= 0.12 * Math.max(w, h);
}

/* ---------- the pages: each returns { title, sub, html } ---------- */
const wTime = n => fmtTime(pad(n.getHours()) + ':' + pad(n.getMinutes()));
// "2:56 PM" is drawn as 2:56 with a small PM, so the big digits stay as large as they can on a narrow screen
const wTimeHtml = n => { const [hm, ap] = wTime(n).split(/\s+/); return esc(hm) + (ap ? `<small>${esc(ap)}</small>` : ''); };
const wEmpty = (icon, text) => `<p class="w-e">${ic(icon, 30)}<span>${esc(text)}</span></p>`;
const wBtn = (act, label, cls = '', extra = '') => `<button class="w-btn ${cls}" data-act="${act}"${extra}>${label}</button>`;
const wtName = it => (it.k === 'lesson' ? scLessonName(it) : it.k === 'slot' ? it.s.title : it.t.title);
const wtColor = it => (it.k === 'lesson' ? (it.s ? it.s.color : '#888888') : it.k === 'slot' ? it.s.color : listOf(it.t.listId).color);
const wtRoom = it => (it.k === 'lesson' ? scRoom(it.l, it.s) : it.k === 'slot' ? it.s.loc || '' : '');
const wFocusMins = () => { const td = todayStr(); return S.pomo.filter(p => ymd(new Date(p.ts)) === td).reduce((a, p) => a + p.min, 0); };
function wToday() { const n = new Date(), d = ttItems(n), items = d.items.slice().sort((x, y) => x.a - y.a || x.b - y.b), m = n.getHours() * 60 + n.getMinutes(); return { n, d, items, m, cur: items.find(i => i.a <= m && m < i.b) || null, nxt: items.find(i => i.a > m) || null }; }
const wtLine = (it, m) => `<span class="w-dot" style="--c:${esc(wtColor(it))}"></span><span class="w-l"><b>${esc(wtName(it))}</b><small>${fmtRange(fmtHM(it.a), fmtHM(it.b))}${wtRoom(it) ? ' · ' + esc(wtRoom(it)) : ''}${m == null ? '' : it.a <= m ? ' · ends in ' + scSpan(it.b - m) : ' · in ' + scSpan(it.a - m)}</small></span>`;

function wNow() {
  const n = new Date(), ts = wgTasksToday(), t = wToday(), mins = wFocusMins();
  const next = t.cur ? ['Now', t.cur] : t.nxt ? ['Next', t.nxt] : null;
  const card = next ? `<div class="w-card" data-act="wgo" data-p="next"><small>${next[0]}</small><div class="w-it">${wtLine(next[1], t.m)}</div></div>`
    : ts.length ? `<div class="w-card" data-act="wgo" data-p="tasks"><small>First task</small><div class="w-it"><span class="w-l"><b>${esc(ts[0].title)}</b><small>${wTaskSub(ts[0])}</small></span></div></div>` : '';
  return { title: FULLDAYS[n.getDay()], sub: `${n.getDate()} ${MONTHS[n.getMonth()].slice(0, 3)}`, html: `<div class="w-clock"><b id="w-time">${wTimeHtml(n)}</b></div>${card}<p class="w-stats"><span>${ts.length ? ts.length + (ts.length === 1 ? ' task' : ' tasks') + ' to do' : 'Nothing to do'}</span>${mins ? `<span>${mins} min focus</span>` : ''}</p><div class="w-two">${wBtn('wadd', ic('plus', 20) + ' Add')}${wBtn('wgo', ic('timer', 20) + ' Focus', '', ' data-p="focus"')}</div>` };
}
function wTaskSub(t) {
  const td = todayStr(), bits = [];
  if (t.due && t.due < td) bits.push('Overdue'); else if (tmEff(t)) bits.push(fmtTime(tmEff(t)));
  const l = listOf(t.listId); if (l && l.name && l.id !== 'inbox') bits.push(esc(l.name));
  return bits.join(' · ') || 'Today';
}
function wTasks() {
  const ts = wgTasksToday().slice(0, 40), td = todayStr();
  if (WT.add) return { title: 'New task', sub: '', html: `<form id="w-form" class="w-form"><input id="w-in" placeholder="Say or type it" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" aria-label="New task"><button class="w-btn pri" type="submit">${ic('check', 20)} Add</button><button class="w-btn" type="button" data-act="wcancel">Cancel</button></form><p class="w-hint">Try “Call mum 5pm” or “Report tomorrow !high”.</p>` };
  return { title: 'Tasks', sub: ts.length ? ts.length + ' to do' : '', html: (ts.map(t => `<div class="w-row${t.due && t.due < td ? ' od' : ''}"><button class="w-chk" data-act="wtoggle" data-id="${esc(t.id)}" aria-label="Done: ${esc(t.title)}">${ic('check', 22)}</button><span class="w-l"><b>${esc(t.title)}</b><small>${wTaskSub(t)}</small></span></div>`).join('') || wEmpty('check-circle', 'Nothing due today')) + wBtn('wadd', ic('plus', 20) + ' New task', 'pri') };
}
function wNext() {
  const t = wToday(), day = t.n, off = t.d.off;
  const rows = t.items.map(it => `<div class="w-row${it.b <= t.m ? ' fin' : it.a <= t.m ? ' live' : ''}">${wtLine(it, null)}</div>`).join('');
  return { title: scHas() ? scName() : 'Timetable', sub: FULLDAYS[day.getDay()], html: (off ? wEmpty('sun', holName(off)) : '') + (t.cur ? `<div class="w-card live"><small>Now</small><div class="w-it">${wtLine(t.cur, t.m)}</div></div>` : '') + (t.nxt ? `<div class="w-card"><small>${t.cur ? 'Next' : 'Next up'}</small><div class="w-it">${wtLine(t.nxt, t.m)}</div></div>` : '') + (rows ? `<h4 class="w-h4">Today</h4>${rows}` : off ? '' : wEmpty('table', 'Nothing scheduled today')) };
}
function wHabits() {
  const tk = todayStr();
  const rows = S.habits.map(h => { const g = habitProgress(h), done = g.per === 'day' ? !!(h.log && h.log[tk]) : g.done >= g.n, sk = streak(h); return `<button class="w-row w-hab${done ? ' on' : ''}" data-act="whday" data-id="${esc(h.id)}" style="--c:${esc(cssHex(h.color, '#34b36b'))}" aria-pressed="${done}" aria-label="${esc(h.name)}${done ? ', done' : ''}"><span class="w-hi">${done ? ic('check', 22) : iconAny(h.icon || '✓', 22)}</span><span class="w-l"><b>${esc(h.name)}</b><small>${g.per === 'day' ? (done ? 'Done today' : 'Not yet') : `${g.done}/${g.n} this ${g.per}`}${sk > 1 ? ` · ${sk} in a row` : ''}</small></span></button>`; }).join('');
  const dn = S.habits.filter(h => { const g = habitProgress(h); return g.per === 'day' ? !!(h.log && h.log[tk]) : g.done >= g.n; }).length;
  return { title: 'Habits', sub: S.habits.length ? dn + '/' + S.habits.length : '', html: rows || wEmpty('activity', 'No habits yet. Add them in the full app.') };
}
function wFocus() {
  const C = 2 * Math.PI * 110;
  return { title: 'Focus', sub: wFocusMins() + ' min today', html: `<div class="w-modes">${[['focus', 'Focus'], ['short', 'Short'], ['long', 'Long']].map(([k, n]) => `<button class="${P.mode === k ? 'on' : ''}" data-act="wpmode" data-m="${k}">${n}</button>`).join('')}</div><div class="w-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="110" class="bg"/><circle id="pring" cx="120" cy="120" r="110" class="fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - P.left / P.total)}" transform="rotate(-90 120 120)"/></svg><div id="pclock" role="timer">${fmtClock(P.left)}</div></div><div class="w-two">${wBtn('wptoggle', (P.run ? ic('pause', 20) + ' Pause' : ic('play', 20) + (P.left < P.total ? ' Resume' : ' Start')), 'pri')}${wBtn('wpskip', 'Skip')}</div>` };
}
function wMore() {
  const locked = !!(Vault.cfg && Vault.cfg.scopes && Vault.cfg.scopes.local), st = !Sync.on ? 'Sync is off. Set it up in Settings.' : Sync.busy || Sync.state === 'busy' ? 'Syncing…' : Sync.state === 'ok' ? 'Synced' : Sync.state === 'offline' ? 'Offline' : Sync.state === 'error' ? (Sync.msg || 'Sync problem') : 'Ready';
  return { title: 'More', sub: '', html: `<div class="w-list">${Sync.on ? wBtn('wsync', ic('refresh', 20) + ' Sync now') + `<p class="w-hint" role="status">${esc(st)}</p>` : `<p class="w-hint">${esc(st)}</p>`}${locked ? wBtn('wlock', ic('lock', 20) + ' Lock now') : ''}${wBtn('wsettings', ic('settings', 20) + ' Settings')}${wBtn('wfull', ic('panel-left', 20) + ' Full app')}<p class="w-hint">OpenTick ${esc(APP_VERSION)} · watch layout</p></div>` };
}
const WATCH_BODY = { now: wNow, tasks: wTasks, next: wNext, habits: wHabits, focus: wFocus, more: wMore };
function watchBody(page) {
  try { return WATCH_BODY[page]() ; } catch (e) { // never a blank watch: say so, and offer the way out
    return { title: 'OpenTick', sub: '', html: `${wEmpty('alert', 'This page could not be drawn.')}${wBtn('wgo', 'Back to Now', 'pri', ' data-p="now"')}` };
  }
}

/* ---------- drawing and switching ---------- */
function watchRender() {
  if (typeof document === 'undefined') return;
  const root0 = document.documentElement; root0.classList.add('wmode');
  let root = $('#wapp'); if (!root) { root = document.createElement('div'); root.id = 'wapp'; document.body.insertBefore(root, $('#scrim') || null); }
  if (!WATCH_PAGES.some(p => p[0] === WT.page)) WT.page = 'now';
  const keep = ['#w-in'].map(q => { const el = $(q); return el ? [q, el.value, document.activeElement === el] : null; }).filter(Boolean);
  const body = $('#w-b'), scroll = body ? body.scrollTop : 0, same = body && root.dataset.page === WT.page && root.dataset.add === String(WT.add);
  const b = watchBody(WT.page); root.dataset.page = WT.page; root.dataset.add = String(WT.add); root.className = watchRound() ? 'w-round' : 'w-square';
  root.innerHTML = `<header class="w-hd"><b>${esc(b.title)}</b>${b.sub ? `<span>${esc(b.sub)}</span>` : ''}</header><div class="w-b" id="w-b" tabindex="-1">${b.html}</div><nav class="w-n" aria-label="Pages">${WATCH_PAGES.map(([k, n]) => `<button class="${k === WT.page ? 'on' : ''}" data-act="wgo" data-p="${k}" aria-label="${n}"${k === WT.page ? ' aria-current="page"' : ''}><i></i></button>`).join('')}</nav>`;
  const nb = $('#w-b'); if (nb && same) nb.scrollTop = scroll;
  for (const [q, v, f] of keep) { const el = $(q); if (el) { el.value = v; if (f) el.focus(); } }
  if (WT.add && !keep.length) { const el = $('#w-in'); if (el) { el.focus(); setTimeout(() => { if (document.activeElement !== el) el.focus(); }, 80); } } // focus inside the tap, so the keyboard (or dictation) opens at once
  if (WT.page === 'focus') paintClock();
}
// the layout was switched off: put the full app back
function watchLeave() { const r = typeof document !== 'undefined' && document.documentElement; if (!r || !r.classList || !r.classList.contains('wmode')) return; r.classList.remove('wmode'); const w = $('#wapp'); if (w) w.remove(); }
function watchApply() { if (typeof document === 'undefined') return; if (watchOn()) watchRender(); else { watchLeave(); render(); } motionApply(); }
function watchGo(p, step) {
  const i = WATCH_PAGES.findIndex(x => x[0] === WT.page), j = p ? WATCH_PAGES.findIndex(x => x[0] === p) : i + step;
  if (j < 0 || j >= WATCH_PAGES.length || j === i) return; WT.page = WATCH_PAGES[j][0]; WT.add = false; watchRender(); const b = $('#w-b'); if (b) b.scrollTop = 0;
}
const WATCH_ACT = {
  wgo: el => watchGo(el.dataset.p),
  wadd: () => { WT.page = 'tasks'; WT.add = true; watchRender(); },
  wcancel: () => { WT.add = false; watchRender(); },
  wtoggle: el => { const t = getT(el.dataset.id); if (t) { toggleDone(t); save(); sfx('done'); } watchRender(); },
  whday: el => { ACT.hday({ dataset: { id: el.dataset.id, d: todayStr() } }); watchRender(); },
  wpmode: el => { pSet(el.dataset.m); watchRender(); },
  wptoggle: () => { pToggle(); watchRender(); },
  wpskip: () => { pSet(P.mode === 'focus' ? 'short' : 'focus'); watchRender(); },
  wsync: () => { syncNow(true); watchRender(); setTimeout(watchRender, 1500); },
  wlock: () => { if (typeof vaultLockNow === 'function') vaultLockNow(); },
  wsettings: () => { openSettings(); },
  wfull: () => { watchCfg().mode = 'off'; save(); watchApply(); },
};
function watchAdd(text) { const v = String(text || '').trim(); if (!v) return null; const t = quickAdd(v, { due: todayStr() }); save(); WT.add = false; watchRender(); return t; }
function watchWire() {
  if (typeof document === 'undefined') return;
  document.addEventListener('submit', e => { if (e.target && e.target.id === 'w-form') { e.preventDefault(); const i = $('#w-in'); watchAdd(i ? i.value : ''); } });
  // swipe sideways between the pages (not while typing); the keyboard does the same on a watch that has one
  document.addEventListener('pointerdown', e => { if (!watchOn() || !e.target.closest || !e.target.closest('#wapp') || e.target.closest('input')) { WT.t = 0; return; } WT.x = e.clientX; WT.y = e.clientY; WT.t = Date.now(); }, true);
  document.addEventListener('pointerup', e => {
    if (!WT.t || !watchOn()) return; const dx = e.clientX - WT.x, dy = e.clientY - WT.y, dt = Date.now() - WT.t; WT.t = 0;
    if (dt < 900 && Math.abs(dx) > 46 && Math.abs(dx) > 1.6 * Math.abs(dy)) watchGo(null, dx < 0 ? 1 : -1);
  }, true);
  document.addEventListener('keydown', e => { if (!watchOn() || e.target.closest('input,textarea,select') || document.querySelector('#modal.on')) return; if (e.key === 'ArrowRight') { watchGo(null, 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { watchGo(null, -1); e.preventDefault(); } });
  // the clock and the timetable move on by themselves, gently (a watch has a small battery)
  WT.timer = setInterval(() => { if (watchOn() && !document.hidden && (WT.page === 'now' || WT.page === 'next') && !$('#w-in:focus') && !document.querySelector('#modal.on')) watchRender(); }, 30000) || 1;
  if (typeof addEventListener === 'function') addEventListener('resize', () => { if (watchOn()) watchRender(); });
}

/* ---------- Settings → Appearance ---------- */
function watchSettingsHtml() {
  const w = watchCfg(), on = watchOn();
  return `<h4 class="mh">Smartwatch layout</h4>
<div class="form"><label>Watch layout<select data-pf="watch.mode">${opts([['auto', 'Automatic' + (watchAuto() ? ' (on for this app)' : '')], ['on', 'On'], ['off', 'Off']], w.mode)}</select></label>
<label>Screen shape<select data-pf="watch.shape">${opts([['auto', 'Automatic'], ['round', 'Round'], ['square', 'Square']], w.shape)}</select></label></div>
<p class="hint">For a small screen on the wrist: six full-screen pages (Now, Tasks, Next, Habits, Focus, More) with big type, swiped or tapped between. It uses the same data, sync and encryption as the full app. ${on ? 'The watch layout is on now; choose Off, or “Full app” on its More page, to get the normal app back.' : 'Choose On if your watch was not detected.'} There are dedicated watch builds too (see the README).</p>`;
}
