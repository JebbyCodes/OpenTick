/* OpenTick widgets.
   • Android: home-screen widgets (src-tauri/android-widgets). The app can't hand data to them directly, so it keeps a small JSON file
     (today's tasks + the theme colours) in its app-data folder; the widgets read it. Ticking a task or tapping "+" on a widget leaves a note in a
     second file, which the app picks up the next time it opens (completing the task, or focusing the add box).
   • Desktop (Windows, macOS, Linux): a small always-on-top "mini widget" window with today's tasks.
   • Anywhere: open index.html?widget=1 for the same compact view. It is the page the desktop window shows.
   Nothing here runs for people who don't use widgets. */
const WIDGET = /[?&]widget=1\b|#widget\b/.test(typeof location !== 'undefined' ? location.href : '');
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
function widgetTasks(limit = 14) {
  const td = todayStr();
  return S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && t.due && t.due <= td)
    .sort((a, b) => a.due.localeCompare(b.due) || (a.time || '99:99').localeCompare(b.time || '99:99') || (b.priority || 0) - (a.priority || 0) || (a.order || 0) - (b.order || 0))
    .slice(0, limit).map(t => ({ id: t.id, t: t.title, due: t.due, time: t.time || '', p: t.priority || 0, c: cssHex(listOf(t.listId).color, '#4772fa') }));
}
const widgetCount = () => S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && t.due && t.due <= todayStr()).length;
function widgetSnapshot() { return { v: 1, at: Date.now(), today: todayStr(), total: widgetCount(), tasks: widgetTasks(), theme: widgetTheme() }; }

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
      const snap = widgetSnapshot(), body = JSON.stringify({ ...snap, at: 0 }); if (body === wgLast && !now) return; wgLast = body;
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
    let done = 0, add = false, open = '';
    for (const a of list) {
      if (a.op === 'done') { const t = getT(a.id); if (t && t.status === 'open') { toggleDone(t); done++; } }
      else if (a.op === 'add') add = true; else if (a.op === 'open' && a.id && getT(a.id)) open = a.id;
    }
    if (done) { sfx('done'); save(); flush(); toast(`${done} task${done === 1 ? '' : 's'} done from the widget`); }
    if (add) { U.page = 'tasks'; setNav('today'); setTimeout(() => { const a = $('#add'); if (a) a.focus(); }, 200); }
    else if (open) { U.page = 'tasks'; U.sel = open; render(); }
    else if (done) refresh();
    widgetPush(true);
  } catch (e) { /* ignore */ }
}

/* ---------- the desktop mini widget ---------- */
const desktopApp = () => !!TAURI() && !isAndroidApp() && !/iPhone|iPad/i.test(navigator.userAgent || '');
async function openMiniWidget() {
  const T = TAURI(), WW = T && T.webviewWindow && T.webviewWindow.WebviewWindow;
  if (!WW) { window.open(location.pathname.replace(/[^/]*$/, '') + 'index.html?widget=1', 'opentick-widget', 'width=340,height=460'); return; }
  try {
    const ex = await WW.getByLabel('widget'); if (ex) { await ex.setFocus(); return; }
    const w = new WW('widget', { url: 'index.html?widget=1', title: 'OpenTick', width: 330, height: 440, minWidth: 250, minHeight: 200, decorations: false, alwaysOnTop: true, resizable: true, skipTaskbar: true, focus: true });
    w.once('tauri://error', e => toast('Could not open the widget: ' + (e && e.payload || e)));
  } catch (e) { toast('Could not open the widget: ' + (e.message || e)); }
}
async function closeMiniWidget() { const T = TAURI(); try { if (T && T.window) await T.window.getCurrentWindow().close(); else window.close(); } catch (e) { window.close(); } }
async function focusMain() { const T = TAURI(); try { const WW = T.webviewWindow.WebviewWindow, m = await WW.getByLabel('main'); if (m) { await m.show(); await m.setFocus(); } } catch (e) { /* ignore */ } }

/* ---------- the compact view (?widget=1) ---------- */
function widgetRow(t, td) {
  const over = t.due < td, when = t.due === td ? t.time : fmtDate(t.due) + (t.time ? ' ' + t.time : '');
  return `<div class="wg-r${over ? ' over' : ''}" data-id="${esc(t.id)}"><button class="wg-ck p${t.priority || 0}" data-wg="done" aria-label="Complete"></button><span class="wg-t" data-wg="open">${esc(t.title)}</span>${when ? `<small>${esc(when)}</small>` : ''}</div>`;
}
function renderWidget() {
  let root = $('#wgapp'); if (!root) { root = document.createElement('div'); root.id = 'wgapp'; document.body.appendChild(root); }
  document.documentElement.classList.add('wgmode');
  const td = todayStr(), ts = S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && t.due && t.due <= td).sort((a, b) => a.due.localeCompare(b.due) || (a.time || '99').localeCompare(b.time || '99') || (b.priority || 0) - (a.priority || 0));
  const keep = $('#wg-add') ? $('#wg-add').value : '';
  root.innerHTML = `<header class="wg-h" data-tauri-drag-region><b data-tauri-drag-region>Today</b><span data-tauri-drag-region>${ts.length ? ts.length + ' to do' : ''}</span><button data-wg="main" title="Open OpenTick" aria-label="Open OpenTick">${ic('layers', 14)}</button>${desktopApp() ? `<button data-wg="close" title="Close" aria-label="Close">${ic('x', 14)}</button>` : ''}</header>
<div class="wg-l">${ts.map(t => widgetRow(t, td)).join('') || `<p class="wg-e">${ic('check-circle', 22)}<span>Nothing due today</span></p>`}</div>
<form class="wg-a" id="wg-form"><input id="wg-add" placeholder="Add a task…" autocomplete="off" aria-label="Add a task"></form>`;
  if (keep && $('#wg-add')) $('#wg-add').value = keep;
}
function widgetWire() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-wg]'); if (!b || !WIDGET) return; const row = b.closest('.wg-r'), a = b.dataset.wg;
    if (a === 'done' && row) { const t = getT(row.dataset.id); if (t && t.status === 'open') { toggleDone(t); save(); flush(); sfx('done'); } renderWidget(); }
    else if (a === 'open' || a === 'main') focusMain();
    else if (a === 'close') closeMiniWidget();
  });
  document.addEventListener('submit', e => {
    if (!WIDGET || e.target.id !== 'wg-form') return; e.preventDefault(); const i = $('#wg-add'), v = i.value.trim(); if (!v) return;
    quickAdd(v, { due: todayStr() }); i.value = ''; save(); flush(); renderWidget();
  });
}
