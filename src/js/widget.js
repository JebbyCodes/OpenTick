/* OpenTick widgets.
   • Android: home-screen widgets (src-tauri/android-widgets). The app can't hand data to them directly, so it keeps a small JSON file
     (today's tasks + the theme colours) in its app-data folder; the widgets read it. Ticking a task or tapping "+" on a widget leaves a note in a
     second file, which the app picks up the next time it opens (completing the task, or focusing the add box).
   • Desktop (Windows, macOS, Linux): a small always-on-top "mini widget" window with today's tasks.
   • Anywhere: open index.html?widget=1 for the same compact view. It is the page the desktop window shows.
   Nothing here runs for people who don't use widgets. */
const WIDGET = /[?&]widget=1\b|#widget\b/.test(typeof location !== 'undefined' ? location.href : '');
// which widget this window shows: index.html?widget=1&w=calendar (tasks when not given)
const WG_KINDS = [['tasks', 'Tasks', 'check-circle', 'Today\'s tasks, with a box to add one'], ['lists', 'Lists', 'list', 'Every list and what is open in it'], ['projects', 'Projects', 'layers', 'Progress of each project'], ['notes', 'Notes', 'notes', 'Pinned and recent notes'], ['calendar', 'Calendar', 'calendar', 'A month, and the tasks on a day'], ['timetable', 'Timetable', 'table', 'Today\'s timetable: classes, slots and timed tasks'], ['matrix', 'Matrix', 'grid', 'The four boxes of the matrix'], ['habits', 'Habit', 'activity', 'Check in today\'s habits'], ['focus', 'Focus', 'clock', 'A focus timer']];
const WIDGET_KIND = (() => { const m = /[?&]w=([a-z]+)/.exec(typeof location !== 'undefined' ? location.href : ''); return m && WG_KINDS.some(k => k[0] === m[1]) ? m[1] : 'tasks'; })();
const WG_DATA = 'opentick-widget.json', WG_ACT = 'opentick-widget-actions.json';
const isAndroidApp = () => !!TAURI() && /Android/i.test(navigator.userAgent || '');

// "#rrggbb" for any CSS colour (the widgets cannot read CSS)
function cssHex(v, fallback) {
  try { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = '#000'; c.fillStyle = String(v).trim(); const o = c.fillStyle; if (/^#[0-9a-f]{6}$/i.test(o)) return o; const m = o.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (m) return '#' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join(''); } catch (e) { /* use the fallback */ }
  return fallback;
}
function widgetTheme() {
  let cs = { getPropertyValue: () => '' }; try { cs = getComputedStyle(document.documentElement); } catch (e) { /* no page: the default colours */ }
  const g = (n, d) => cssHex(cs.getPropertyValue(n) || d, d);
  return { bg: g('--bg', '#282828'), card: g('--card', '#32302f'), text: g('--text', '#ebdbb2'), muted: g('--muted', '#a89984'), acc: g('--acc', '#fabd2f'), onAcc: g('--on-acc', '#282828'), red: g('--red', '#fb4934'), line: g('--line', '#3c3836') };
}
// what the widgets show: open tasks due today or earlier, soonest first
function widgetTasks(limit = 12) {
  const td = todayStr();
  return S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && t.due && t.due <= td)
    .sort((a, b) => a.due.localeCompare(b.due) || (tmEff(a) || '99:99').localeCompare(tmEff(b) || '99:99') || (b.priority || 0) - (a.priority || 0) || (a.order || 0) - (b.order || 0))
    .slice(0, limit).map(t => ({ id: t.id, t: t.title, due: t.due, time: tmEff(t) || '', p: t.priority || 0, c: cssHex(listOf(t.listId).color, '#4772fa'), ln: listOf(t.listId).name }));
}
const widgetCount = () => S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && t.due && t.due <= todayStr()).length;
/* what the Android widgets show besides tasks. Each piece is small, and a failure in one leaves the others working. */
const wgSafe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
const wgOpen = ids => S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && ids.has(t.listId));
function wgLists() { const td = todayStr(); return S.lists.slice(0, 9).map(l => { const ts = S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && t.listId === l.id); return { id: l.id, n: l.name, c: cssHex(l.color, '#4772fa'), o: ts.length, l: ts.filter(t => t.due && t.due < td).length }; }); }
function wgProjects() { const td = todayStr(); return S.projects.slice(0, 5).map(p => { const st = homeStats(scopeTasks('project:' + p.id)); return { id: p.id, n: p.name, c: cssHex(p.color, '#4772fa'), pct: st.pct, o: st.open, l: st.late }; }); }
function wgNotes() { return [...S.notes].filter(n => !n.deleted).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated).slice(0, 6).map(n => ({ id: n.id, t: noteTitle(n), s: noteSnippet(n).slice(0, 90), pin: !!n.pinned })); }
function wgCal() { const days = {}; for (const t of S.tasks) if (!t.deleted && !t.log && t.status === 'open' && t.due) days[t.due] = (days[t.due] || 0) + 1; return { ws: +S.settings.weekStart || 0, days }; }
// one day of the timetable for the widgets: every row carries start, end, room and teacher (the widgets always show them)
function wgTtDay(now) {
  const wt = typeof scWeekType === 'function' ? scWeekType(now) : 0, sub = FULLDAYS[now.getDay()] + (wt ? ' · ' + scWeekName(wt) : '');
  const d = ttItems(now), items = d.items.slice().sort((a, b) => a.a - b.a || a.b - b.b).slice(0, 10).map(it => it.k === 'lesson'
    ? { a: fmtHM(it.a), b: fmtHM(it.b), n: scLessonName(it), s: scRoom(it.l, it.s), r: scRoom(it.l, it.s), te: (scTeacherOf(it.l, it.s) || {}).name || '', c: cssHex(it.s ? it.s.color : '#888888', '#888888'), x: it.tasks.length }
    : { a: fmtHM(it.a), b: fmtHM(it.b), n: it.k === 'slot' ? it.s.title : it.t.title, s: it.k === 'slot' ? it.s.loc || '' : '', r: it.k === 'slot' ? it.s.loc || '' : '', te: '', c: cssHex(it.k === 'slot' ? it.s.color : listOf(it.t.listId).color, '#4772fa'), x: it.k === 'slot' ? it.tasks.length : 0 });
  return { k: ymd(now), d: DAYS[now.getDay()], sub, off: d.off ? holName(d.off) : '', items };
}
function wgTt() {
  const now = new Date(), t0 = wgTtDay(now), days = Array.from({ length: 5 }, (_, i) => wgTtDay(addDays(now, i)));
  return { kind: 'plan', title: typeof scHas === 'function' && scHas() ? scName() : 'Timetable', sub: t0.sub, off: t0.off, items: t0.items, days };
}
function wgMx() { const open = S.tasks.filter(t => !t.deleted && t.status === 'open'); return MQ.map((q, i) => { const ts = sortTasks(open.filter(t => mxOf(t) === i)); return { n: q.n, sub: q.sub, c: cssHex(q.c, '#888888'), k: ts.length, items: ts.slice(0, 3).map(t => ({ id: t.id, t: t.title })) }; }); }
function wgHabits() { const tk = todayStr(); return S.habits.slice(0, 7).map(h => ({ id: h.id, n: h.name, c: cssHex(h.color, '#34b36b'), e: IC[h.icon] ? '' : (h.icon || ''), s: streak(h), u: habitGoal(h).per, d: !!(h.log && h.log[tk]) })); }
function wgFocus() { const td = todayStr(), mine = S.pomo.filter(p => ymd(new Date(p.ts)) === td); return { min: mine.reduce((a, p) => a + p.min, 0), n: mine.length, run: !!P.run, left: Math.round(P.left), tot: Math.round(P.total), at: Date.now(), mode: P.mode }; }
// With encryption covering this device, the widgets (which cannot decrypt anything) get a snapshot with no data in it unless the person allowed a readable summary
const widgetLocked = () => !!(Vault.cfg && Vault.cfg.scopes.local && !Vault.cfg.widgets) || !!Vault.locked;
function widgetSnapshot() {
  if (widgetLocked()) return { v: 2, at: Date.now(), today: todayStr(), locked: true, total: 0, tasks: [], theme: widgetTheme(), lists: [], projects: [], notes: [], cal: {}, tt: {}, mx: [], hb: [], fc: {} };
  return { v: 2, at: Date.now(), today: todayStr(), total: widgetCount(), tasks: widgetTasks(), theme: widgetTheme(), lists: wgSafe(wgLists, []), projects: wgSafe(wgProjects, []), notes: wgSafe(wgNotes, []), cal: wgSafe(wgCal, {}), tt: wgSafe(wgTt, {}), mx: wgSafe(wgMx, []), hb: wgSafe(wgHabits, []), fc: wgSafe(wgFocus, {}) };
}

async function widgetPath(name) {
  const T = TAURI(); if (!(T && T.path && T.fs)) return null;
  const dir = String(await T.path.appDataDir()).replace(/[\\/]+$/, ''); try { await T.fs.mkdir(dir, { recursive: true }); } catch (e) { /* it exists */ }
  return dir + '/' + name;
}
let wgTimer = 0, wgLast = '';
function widgetPush(now) {
  if (WIDGET || !isAndroidApp()) return; clearTimeout(wgTimer);
  wgTimer = setTimeout(async () => {
    try {
      const snap = widgetSnapshot(), body = JSON.stringify({ ...snap, at: 0, fc: { ...snap.fc, at: 0, left: snap.fc && snap.fc.run ? 0 : snap.fc && snap.fc.left } }); if (body === wgLast && !now) return; wgLast = body;
      const p = await widgetPath(WG_DATA); if (p) await TAURI().fs.writeTextFile(p, JSON.stringify(snap));
    } catch (e) { /* widgets are optional */ }
  }, now ? 0 : 1500);
}
// things done on a widget while the app was closed
async function widgetPull() {
  if (WIDGET || !isAndroidApp()) return;
  try {
    const p = await widgetPath(WG_ACT); if (!p) return; let list = [];
    try { list = JSON.parse(await TAURI().fs.readTextFile(p) || '[]'); } catch (e) { return; }
    if (!Array.isArray(list) || !list.length) return;
    await TAURI().fs.writeTextFile(p, '[]');
    let done = 0, add = false, open = '', other = null;
    for (const a of list) {
      if (a.op === 'done') { const t = getT(a.id); if (t && t.status === 'open') { toggleDone(t); done++; } }
      else if (a.op === 'add') add = true; else if (a.op === 'open' && a.id && getT(a.id)) open = a.id;
      else if (a.op === 'habit') { const h = S.habits.find(x => x.id === a.id); if (h) { ACT.hday({ dataset: { id: h.id, d: todayStr() } }); done++; } }
      else if (['nav', 'page', 'note', 'newnote', 'focus'].includes(a.op)) other = a;
    }
    if (other) wgRunCommand(JSON.stringify({ op: other.op, id: other.id, nav: other.id, page: other.id }));
    if (done) { sfx('done'); save(); flush(); toast(`${done} task${done === 1 ? '' : 's'} done from the widget`); }
    if (add) { U.page = 'tasks'; setNav('today'); setTimeout(() => { const a = $('#add'); if (a) a.focus(); }, 200); }
    else if (open) { U.page = 'tasks'; U.sel = open; render(); }
    else if (done) refresh();
    widgetPush(true);
  } catch (e) { /* ignore */ }
}

/* ---------- the desktop mini widget ---------- */
const desktopApp = () => !!TAURI() && !isAndroidApp() && !/iPhone|iPad/i.test(navigator.userAgent || '');
async function openMiniWidget(kind = 'tasks') {
  if (!WG_KINDS.some(k => k[0] === kind)) kind = 'tasks';
  const T = TAURI(), WW = T && T.webviewWindow && T.webviewWindow.WebviewWindow, meta = WG_KINDS.find(k => k[0] === kind), url = 'index.html?widget=1&w=' + kind;
  if (!WW) { window.open(location.pathname.replace(/[^/]*$/, '') + url, 'opentick-widget-' + kind, 'width=360,height=480'); return; }
  const size = { calendar: [340, 470], matrix: [380, 460], focus: [300, 420], timetable: [340, 460] }[kind] || [330, 440];
  try {
    const label = 'widget-' + kind, ex = await WW.getByLabel(label); if (ex) { await ex.setFocus(); return; }
    const w = new WW(label, { url, title: 'OpenTick ' + meta[1], width: size[0], height: size[1], minWidth: 250, minHeight: 200, decorations: false, dragDropEnabled: false, alwaysOnTop: true, resizable: true, skipTaskbar: true, focus: true });
    w.once('tauri://error', e => toast('Could not open the widget: ' + (e && e.payload || e)));
  } catch (e) { toast('Could not open the widget: ' + (e.message || e)); }
}
async function closeMiniWidget() { const T = TAURI(); try { if (T && T.window) await T.window.getCurrentWindow().close(); else window.close(); } catch (e) { window.close(); } }
async function focusMain() { const T = TAURI(); try { const WW = T.webviewWindow.WebviewWindow, m = await WW.getByLabel('main'); if (m) { await m.show(); await m.setFocus(); } } catch (e) { /* ignore */ } }

/* ---------- the widget views (?widget=1&w=…) ----------
   They are made of the app's own pieces (task rows, project and list cards, the focus ring, the matrix boxes, habit check-ins), so a widget
   looks like the app in whatever theme you picked. A widget window is a small copy of the app: ticking a task or a habit there changes
   the shared data (every window hears it), and anything that needs the big window (opening a task, a note, a list) is sent to it as a
   command through localStorage. */
const WCMD = 'opentick.wcmd';
function wgCommand(cmd) { try { localStorage.setItem(WCMD, JSON.stringify({ ...cmd, at: Date.now() + Math.random() })); } catch (e) { /* storage off */ } focusMain(); }
// run in the main window when a widget sends it something
function wgRunCommand(raw) {
  let c; try { c = JSON.parse(raw); } catch (e) { return; } if (!c || WIDGET) return;
  if (c.op === 'open' && getT(c.id)) { U.page = 'tasks'; U.sel = c.id; render(); }
  else if (c.op === 'nav' && typeof c.nav === 'string') { U.page = 'tasks'; setNav(c.nav); }
  else if (c.op === 'page' && PAGES.some(p => p[0] === c.page)) { U.page = c.page; render(); }
  else if (c.op === 'note' && noteById(c.id)) { U.page = 'notes'; U.noteSel = c.id; render(); }
  else if (c.op === 'newnote') { const n = newNote(); S.notes.push(n); save(); U.page = 'notes'; U.noteSel = n.id; U.nq = ''; render(); }
  else if (c.op === 'habit') { const h = S.habits.find(x => x.id === c.id); if (h) { ACT.hday({ dataset: { id: h.id, d: todayStr() } }); render(); } }
  else if (c.op === 'focus') { U.page = 'focus'; render(); if (c.id === 'start' && !P.run) { pToggle(); render(); } }
  else if (c.op === 'add') { U.page = 'tasks'; setNav('today'); setTimeout(() => { const a = $('#add'); if (a) a.focus(); }, 150); }
}
const wgTasksToday = () => { const td = todayStr(); return S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && t.due && t.due <= td).sort((a, b) => a.due.localeCompare(b.due) || (tmEff(a) || '99').localeCompare(tmEff(b) || '99') || (b.priority || 0) - (a.priority || 0)); };
const W = { month: null, day: null, tt: null }; // the calendar widget's own state
function wgBody(kind) {
  const td = todayStr();
  if (kind === 'tasks') { const ts = wgTasksToday(); return { title: 'Today', sub: ts.length ? ts.length + ' to do' : '', html: `<div class="wg-l">${ts.map(t => rowHtml(t, true)).join('') || `<p class="wg-e">${ic('check-circle', 22)}<span>Nothing due today</span></p>`}</div>`, foot: `<form class="wg-a" id="wg-form"><input id="wg-add" placeholder="Add a task…" autocomplete="off" aria-label="Add a task"></form>` }; }
  if (kind === 'lists') { const ls = S.lists.filter(l => !l.parent); return { title: 'Lists', sub: S.lists.length + '', html: `<div class="wg-l"><div class="lgrid wgrid">${S.lists.map(l => homeListCard(l)).join('')}</div></div>` }; }
  if (kind === 'projects') return { title: 'Projects', sub: S.projects.length + '', html: `<div class="wg-l">${S.projects.length ? `<div class="pgrid wgrid">${S.projects.map(homeProjectCard).join('')}</div>` : `<p class="wg-e">${ic('layers', 22)}<span>No projects yet</span></p>`}</div>` };
  if (kind === 'notes') { const ns = [...S.notes].filter(n => !n.deleted).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated).slice(0, 14); return { title: 'Notes', sub: S.notes.length + '', html: `<div class="wg-l nt-list">${ns.map(n => noteRowHtml(n, false)).join('') || `<p class="wg-e">${ic('notes', 22)}<span>No notes yet</span></p>`}</div>`, foot: `<form class="wg-a" id="wg-nform"><input id="wg-nadd" placeholder="Quick note…" autocomplete="off" aria-label="Quick note"></form>` }; }
  if (kind === 'calendar') {
    const m = W.month || (W.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1)), ws = +S.settings.weekStart || 0, first = addDays(m, -((m.getDay() - ws + 7) % 7)), sel = W.day || td;
    const cnt = {}; for (const t of S.tasks) if (!t.deleted && t.status === 'open' && t.due) cnt[t.due] = (cnt[t.due] || 0) + 1;
    const cells = Array.from({ length: 42 }, (_, i) => { const d = addDays(first, i), k = ymd(d), n = cnt[k] || 0; return `<button class="wc-d${d.getMonth() !== m.getMonth() ? ' out' : ''}${k === td ? ' today' : ''}${k === sel ? ' sel' : ''}" data-wd="${k}"><span>${d.getDate()}</span>${n ? `<i>${n > 3 ? '3+' : '•'.repeat(n)}</i>` : ''}</button>`; }).join('');
    const ts = S.tasks.filter(t => !t.deleted && t.status === 'open' && t.due === sel).sort((a, b) => (tmEff(a) || '99').localeCompare(tmEff(b) || '99'));
    return { title: MONTHS[m.getMonth()] + ' ' + m.getFullYear(), sub: '', tools: `<button data-wm="-1" aria-label="Previous month">${ic('left', 14)}</button><button data-wm="0" aria-label="This month">${ic('calendar', 14)}</button><button data-wm="1" aria-label="Next month">${ic('right', 14)}</button>`, html: `<div class="wg-l"><div class="wc-w">${Array.from({ length: 7 }, (_, i) => `<span>${DAYS[(ws + i) % 7].slice(0, 2)}</span>`).join('')}</div><div class="wc-g">${cells}</div><h4 class="wc-h">${esc(fmtDate(sel))}</h4>${ts.map(t => rowHtml(t, true)).join('') || '<p class="hint pad">Nothing on this day.</p>'}</div>` };
  }
  if (kind === 'timetable') {
    const now = new Date(), isToday = !W.tt || W.tt === td, day = isToday ? now : pYmd(W.tt), nowM = now.getHours() * 60 + now.getMinutes(), d = ttItems(day), items = d.items.slice().sort((x, y) => x.a - y.a || x.b - y.b), wt = scWeekType(day);
    const nm = it => (it.k === 'lesson' ? scLessonName(it) : it.k === 'slot' ? it.s.title : it.t.title), col = it => (it.k === 'lesson' ? (it.s ? it.s.color : '#888888') : it.k === 'slot' ? it.s.color : listOf(it.t.listId).color);
    const room = it => (it.k === 'lesson' ? scRoom(it.l, it.s) : it.k === 'slot' ? it.s.loc || '' : ''), teach = it => (it.k === 'lesson' ? (scTeacherOf(it.l, it.s) || {}).name || '' : ''), ico = it => (it.k === 'lesson' && it.s ? iconAny(it.s.icon, 14) + ' ' : '');
    const cur = isToday ? items.find(it => it.a <= nowM && nowM < it.b) : null, nxt = isToday ? items.find(it => it.a > nowM) : null;
    const where = it => [room(it) ? `<span class="mq">${ic('pin', 11)} ${esc(room(it))}</span>` : '', teach(it) ? `<span class="mq">${ic('teacher', 11)} ${esc(teach(it))}</span>` : ''].join('');
    const card = (lab, it, note) => (it ? `<div class="sc-now" style="--c:${col(it)}"><span class="sc-nl">${lab}</span><b>${ico(it)}${esc(nm(it))}</b><span class="sc-nt">${fmtRange(fmtHM(it.a), fmtHM(it.b))}${room(it) ? ' · ' + esc(room(it)) : ''}${teach(it) ? ' · ' + esc(teach(it)) : ''}${note}</span></div>` : '');
    const rows = items.map(it => `<div class="wt-row${isToday && it.b <= nowM ? ' fin' : isToday && it.a <= nowM ? ' live' : ''}" style="--c:${col(it)}"><time><b>${fmtTime(fmtHM(it.a))}</b><span>${fmtTime(fmtHM(it.b))}</span></time><span class="wt-bar"></span><span class="wt-n">${ico(it)}${esc(nm(it))}${(it.tasks || []).length ? ` <i class="wt-k">${ic('check-circle', 12)} ${it.tasks.length}</i>` : ''}</span><small class="wt-w">${where(it) || '<span class="hint">No room</span>'}</small></div>`).join('');
    const none = d.off ? `<p class="wg-e">${ic('sun', 22)}<span>${esc(holName(d.off))}</span></p>` : `<p class="wg-e">${ic('table', 22)}<span>Nothing scheduled</span></p>`;
    const lab = isToday ? 'Today' : fmtDate(ymd(day)), tools = `<button data-wt="-1" aria-label="Previous day">${ic('left', 14)}</button><button data-wt="0" aria-label="Today">${ic('calendar', 14)}</button><button data-wt="1" aria-label="Next day">${ic('right', 14)}</button>`;
    return { title: scHas() ? scName() : 'Timetable', sub: FULLDAYS[day.getDay()] + (isToday ? '' : ' ' + day.getDate() + ' ' + MONTHS[day.getMonth()].slice(0, 3)) + (wt ? ' · ' + scWeekName(wt) : ''), tools, html: `<div class="wg-l">${d.off ? holBand(d.off, 'big') : ''}${card('Now', cur, ` · ends in ${scSpan(cur ? cur.b - nowM : 0)}`)}${card(cur ? 'Next' : 'Next up', nxt, ` · in ${scSpan(nxt ? nxt.a - nowM : 0)}`)}<div class="wt-list">${rows || (d.off ? '' : none)}</div>${d.allday.length ? `<h4 class="wc-h">Any time</h4>${d.allday.map(t => rowHtml(t, true)).join('')}` : ''}</div>` };
  }
  if (kind === 'matrix') { const open = S.tasks.filter(t => !t.deleted && t.status === 'open'); return { title: 'Matrix', sub: '', html: `<div class="wg-l"><div class="matrix wmx">${MQ.map((q, i) => { const ts = sortTasks(open.filter(t => mxOf(t) === i)); return `<div class="quad" style="--c:${q.c}"><div class="qh"><b>${q.n}</b><small>${q.sub} · ${ts.length}</small></div><div class="qb">${ts.slice(0, 4).map(t => rowHtml(t, false)).join('') || '<p class="hint qempty">Empty</p>'}${ts.length > 4 ? `<p class="hint pad">+${ts.length - 4} more</p>` : ''}</div></div>`; }).join('')}</div></div>` }; }
  if (kind === 'habits') { const tk = td; return { title: 'Habit', sub: S.habits.length ? S.habits.filter(h => h.log && h.log[tk]).length + '/' + S.habits.length : '', html: `<div class="wg-l">${S.habits.map(h => { const g = habitGoal(h), sk = streak(h); return `<div class="habit wgh" style="--c:${h.color}"><div class="hh"><span class="hi">${iconAny(h.icon || '✓', 20)}</span><div class="hn"><b>${esc(h.name)}</b><small><span class="sk${sk >= FIRE_MIN ? ' hot' : ''}">${sk >= FIRE_MIN ? ic('flame', 12) : ''}${sk} ${g.per} streak</span></small></div><button class="hcheck${h.log && h.log[tk] ? ' on' : ''}" data-act="hday" data-id="${h.id}" data-d="${tk}" aria-pressed="${!!(h.log && h.log[tk])}" aria-label="Check in ${esc(h.name)}">${ic('check', 16)}</button></div></div>`; }).join('') || `<p class="wg-e">${ic('activity', 22)}<span>No habits yet</span></p>`}</div>` }; }
  // focus: a timer of its own in this window; finished sessions are saved with the rest of your data
  const C = 2 * Math.PI * 110, mins = S.pomo.filter(p => ymd(new Date(p.ts)) === td).reduce((a, p) => a + p.min, 0);
  return { title: 'Focus', sub: mins + ' min today', html: `<div class="wg-l body focus wfocus"><div class="modes">${[['focus', 'Focus'], ['short', 'Short'], ['long', 'Long']].map(([k, n]) => `<button class="${P.mode === k ? 'on' : ''}" data-act="pmode" data-m="${k}">${n}</button>`).join('')}</div><div class="ring"><svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="110" class="bg"/><circle id="pring" cx="120" cy="120" r="110" class="fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - P.left / P.total)}" transform="rotate(-90 120 120)"/></svg><div id="pclock">${fmtClock(P.left)}</div></div><div class="pctl"><button class="btn pri" data-act="ptoggle">${P.run ? 'Pause' : P.left < P.total ? 'Resume' : 'Start'}</button><button class="btn" data-act="preset">Reset</button><button class="btn" data-act="pskip">Skip</button></div></div>` };
}
function renderWidget() {
  let root = $('#wgapp'); if (!root) { root = document.createElement('div'); root.id = 'wgapp'; document.body.appendChild(root); }
  document.documentElement.classList.add('wgmode'); root.dataset.kind = WIDGET_KIND;
  const keep = ['#wg-add', '#wg-nadd'].map(q => { const el = $(q); return el ? [q, el.value, document.activeElement === el] : null; }).filter(Boolean);
  const scroll = $('.wg-l') ? $('.wg-l').scrollTop : 0, b = wgBody(WIDGET_KIND);
  root.innerHTML = `<header class="wg-h" data-tauri-drag-region><b data-tauri-drag-region>${esc(b.title)}</b><span data-tauri-drag-region>${esc(b.sub || '')}</span>${b.tools || ''}<button data-wg="main" title="Open OpenTick" aria-label="Open OpenTick">${ic('layers', 14)}</button>${desktopApp() ? `<button data-wg="close" title="Close" aria-label="Close">${ic('x', 14)}</button>` : ''}</header>${b.html}${b.foot || ''}`;
  for (const [q, v, f] of keep) { const el = $(q); if (el) { el.value = v; if (f) el.focus(); } }
  const l = $('.wg-l'); if (l) l.scrollTop = scroll;
  if (WIDGET_KIND === 'focus') paintClock();
}
function widgetWire() {
  document.addEventListener('click', e => {
    if (!WIDGET) return;
    const wg = e.target.closest('[data-wg]'), wm = e.target.closest('[data-wm]'), wtn = e.target.closest('[data-wt]'), wd = e.target.closest('[data-wd]'), act = e.target.closest('[data-act]');
    if (wg) { const a = wg.dataset.wg; if (a === 'main') focusMain(); else if (a === 'close') closeMiniWidget(); return; }
    if (wm) { const n = +wm.dataset.wm, m = W.month || new Date(); W.month = n ? new Date(m.getFullYear(), m.getMonth() + n, 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1); if (!n) W.day = todayStr(); renderWidget(); return; }
    if (wtn) { const n = +wtn.dataset.wt, cur = W.tt ? pYmd(W.tt) : new Date(); W.tt = n ? ymd(addDays(cur, n)) : null; renderWidget(); return; }
    if (wd) { W.day = wd.dataset.wd; renderWidget(); return; }
    if (!act) return; const a = act.dataset.act, id = act.dataset.id || (act.closest('[data-id]') || {}).dataset && act.closest('[data-id]').dataset.id;
    e.stopPropagation();
    if (a === 'toggle') { const t = getT(id); if (t) { toggleDone(t); save(); flush(); sfx('done'); } renderWidget(); }
    else if (a === 'hday') { ACT.hday(act); save(); flush(); renderWidget(); }
    else if (['ptoggle', 'preset', 'pskip', 'pmode'].includes(a)) { ACT[a](act); renderWidget(); }
    else if (a === 'open') wgCommand({ op: 'open', id });
    else if (a === 'nav') wgCommand({ op: 'nav', nav: act.dataset.nav });
    else if (a === 'noteopen') wgCommand({ op: 'note', id });
    else wgCommand({ op: 'page', page: { timetable: 'timetable', matrix: 'matrix', habits: 'habits', focus: 'focus' }[WIDGET_KIND] || 'tasks' });
  }, true);
  document.addEventListener('submit', e => {
    if (!WIDGET) return; e.preventDefault();
    if (e.target.id === 'wg-form') { const i = $('#wg-add'), v = i.value.trim(); if (!v) return; quickAdd(v, { due: todayStr() }); i.value = ''; save(); flush(); renderWidget(); }
    else if (e.target.id === 'wg-nform') { const i = $('#wg-nadd'), v = i.value.trim(); if (!v) return; S.notes.push(newNote({ title: v })); i.value = ''; save(); flush(); sfx('add'); renderWidget(); }
  });
  if (WIDGET) setInterval(() => { if (!$('#wg-add:focus,#wg-nadd:focus') && WIDGET_KIND !== 'focus') renderWidget(); }, 60000);
}
