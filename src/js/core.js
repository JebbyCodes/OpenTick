'use strict';
/* OpenTick core: helpers, dates, repeat rules, quick-add parser, store */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayStr = () => ymd(new Date());
const dayDiff = (a, b) => Math.round((pYmd(a) - pYmd(b)) / 864e5);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PRIO = ['None', 'Low', 'Medium', 'High'];
const COLORS = [['#4772fa', 'Blue'], ['#e5484d', 'Red'], ['#f4a62a', 'Orange'], ['#34b36b', 'Green'], ['#8e5cf7', 'Purple'], ['#12a9c7', 'Teal'], ['#e255a1', 'Pink'], ['#7c828d', 'Gray'], ['#d79921', 'Yellow'], ['#98971a', 'Olive'], ['#b16286', 'Plum'], ['#458588', 'Steel']];
// [id, name, preview background, preview text, preview accent]; the real palettes live in styles.css
const THEMES = [
  ['gruvbox-dark', 'Gruvbox Dark', '#282828', '#ebdbb2', '#fabd2f'], ['gruvbox-light', 'Gruvbox Light', '#fbf1c7', '#3c3836', '#b57614'],
  ['light', 'Light', '#ffffff', '#202328', '#4772fa'], ['dark', 'Dark', '#1b1d21', '#e8eaee', '#4772fa'],
  ['nord', 'Nord', '#2e3440', '#eceff4', '#88c0d0'], ['solarized-dark', 'Solarized Dark', '#002b36', '#93a1a1', '#268bd2'],
  ['dracula', 'Dracula', '#282a36', '#f8f8f2', '#bd93f9'], ['auto', 'Match system', 'linear-gradient(135deg,#fbf1c7 50%,#282828 50%)', '#3c3836', '#b57614'],
];
const DEFAULT_THEME = 'gruvbox-dark';
// build metadata injected by build-app.mjs (window.OT); a raw, unbuilt src/index.html still works
const OTMETA = (typeof window !== 'undefined' && window.OT) || {};
const APP_VERSION = OTMETA.version || 'dev';
const APP_LOGO = OTMETA.logo || 'icon.svg';

/* ---------- dates & repeat ---------- */
function fmtDate(s) {
  const d = pYmd(s), diff = dayDiff(s, todayStr());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return DAYS[d.getDay()];
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}` + (d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : '');
}
const dueLabel = t => (t.due ? fmtDate(t.due) + (validHM(t.time) ? ' ' + fmtTime(t.time) : '') : '');
function isOverdue(t) {
  if (!t.due || t.status !== 'open') return false;
  const td = todayStr();
  if (t.due < td) return true;
  if (t.due === td && t.time) { const n = new Date(); return t.time < `${pad(n.getHours())}:${pad(n.getMinutes())}`; }
  return false;
}
const REPS = {
  daily: { every: 1, unit: 'day' },
  weekdays: { every: 1, unit: 'week', days: [1, 2, 3, 4, 5] },
  weekly: { every: 1, unit: 'week' },
  monthly: { every: 1, unit: 'month' },
  yearly: { every: 1, unit: 'year' },
};
function repeatKey(r) {
  if (!r) return 'none';
  for (const [k, v] of Object.entries(REPS)) if (JSON.stringify(v) === JSON.stringify(r)) return k;
  return 'custom';
}
function repeatLabel(r) {
  if (!r) return '';
  if (r.unit === 'week' && r.days && r.days.length) return 'Weekly on ' + r.days.map(d => DAYS[d]).join(', ');
  return r.every === 1 ? { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[r.unit] : `Every ${r.every} ${r.unit}s`;
}
function nextDue(t) {
  const r = t.repeat; let d = pYmd(t.due);
  if (r.unit === 'day') d = addDays(d, r.every);
  else if (r.unit === 'week') {
    if (r.days && r.days.length) { do { d = addDays(d, 1); } while (!r.days.includes(d.getDay())); }
    else d = addDays(d, 7 * r.every);
  } else if (r.unit === 'month') {
    const day = d.getDate();
    d = new Date(d.getFullYear(), d.getMonth() + r.every, 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else d = new Date(d.getFullYear() + r.every, d.getMonth(), d.getDate());
  return ymd(d);
}

/* ---------- quick-add parser: "Pay rent every month 9am !high #bills ~Personal" ---------- */
const WD = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MO = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const WDRE = '(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';
const MORE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
// a class named in a quick-add (@maths): the exact name or short code, else the one class whose name starts with what was typed
const classKey = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
function classByToken(subjects, tok) {
  const k = classKey(tok); if (!k) return null;
  const by = (subjects || []).filter(x => x && x.name);
  return by.find(x => classKey(x.name) === k) || by.find(x => x.short && classKey(x.short) === k) || (by.filter(x => classKey(x.name).startsWith(k)).length === 1 ? by.find(x => classKey(x.name).startsWith(k)) : null);
}
function parseQuick(text, lists, base = new Date(), ctx = {}) {
  const o = { title: '', due: null, time: null, dur: null, priority: 0, tags: [], listId: null, repeat: null, subjectId: null, kind: null };
  let s = ' ' + text + ' ';
  const bd = ymd(base);
  const take = (re, fn) => { s = s.replace(re, (...m) => (fn(m) === false ? m[0] : ' ')); };
  const setD = d => { o.due = ymd(d); };
  take(/\s#([\w-]+)(?=\s)/g, m => { o.tags.push(m[1].toLowerCase()); });
  take(/\s~(\S+)(?=\s)/g, m => {
    const k = m[1].toLowerCase(), l = lists.find(x => x.name.toLowerCase().replace(/\s+/g, '') === k);
    if (!l) return false; o.listId = l.id;
  });
  take(/\s@([^\s@]+)(?=\s)/g, m => { const c = classByToken(ctx.subjects, m[1]); if (!c) return false; o.subjectId = c.id; });
  take(/\s\/(exam|test|homework|hw)(?=\s)/gi, m => { o.kind = /^(exam|test)$/i.test(m[1]) ? 'exam' : 'homework'; });
  take(/\s!(high|medium|med|low)(?=\s)/gi, m => { o.priority = { low: 1, med: 2, medium: 2, high: 3 }[m[1].toLowerCase()]; });
  take(/\sfor\s+(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)(?=\s)/i, m => {
    const n = Math.round(parseFloat(m[1]) * (/^h/i.test(m[2]) ? 60 : 1)); if (n < 1 || n > 1440) return false; o.dur = n;
  });
  // repeats
  take(/\s(?:every\s+weekday|weekdays)(?=\s)/i, () => { o.repeat = { every: 1, unit: 'week', days: [1, 2, 3, 4, 5] }; });
  take(new RegExp('\\severy\\s+((?:' + WDRE + '(?:\\s*(?:,|and|&)\\s*)?)+)(?=\\s)', 'i'), m => {
    const d = [...new Set((m[1].match(/sun|mon|tue|wed|thu|fri|sat/gi) || []).map(x => WD[x.toLowerCase()]))].sort();
    o.repeat = { every: 1, unit: 'week', days: d };
  });
  take(/\severy\s+(\d+)\s*(day|week|month|year)s?(?=\s)/i, m => { o.repeat = { every: +m[1], unit: m[2].toLowerCase() }; });
  take(/\severy\s+(day|week|month|year)(?=\s)/i, m => { o.repeat = { every: 1, unit: m[1].toLowerCase() }; });
  take(/\s(daily|weekly|monthly|yearly)(?=\s)/i, m => { o.repeat = { every: 1, unit: { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[m[1].toLowerCase()] }; });
  // time
  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)/i, m => {
    let h = +m[1]; if (h < 1 || h > 12) return false;
    const ap = m[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
    o.time = `${pad(h)}:${m[2] || '00'}`;
  });
  if (!o.time) take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i, m => { o.time = `${pad(+m[1])}:${m[2]}`; });
  // dates
  take(/\s(\d{4}-\d{2}-\d{2})(?=\s)/, m => { setD(pYmd(m[1])); });
  take(/\sin\s+(\d+)\s*(day|week|month)s?(?=\s)/i, m => {
    const n = +m[1], b = new Date(base);
    if (/week/i.test(m[2])) setD(addDays(b, 7 * n)); else if (/month/i.test(m[2])) { b.setMonth(b.getMonth() + n); setD(b); } else setD(addDays(b, n));
  });
  take(/\s(?:today|tod)(?=\s)/i, () => setD(base));
  take(/\s(?:tomorrow|tmrw|tmr)(?=\s)/i, () => setD(addDays(base, 1)));
  take(/\snext\s+week(?=\s)/i, () => setD(addDays(base, ((8 - base.getDay()) % 7) || 7)));
  take(new RegExp('\\s' + MORE + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)', 'i'), m => {
    const day = +m[2]; if (day < 1 || day > 31) return false;
    let d = new Date(base.getFullYear(), MO[m[1].slice(0, 3).toLowerCase()], day);
    if (ymd(d) < bd) d = new Date(base.getFullYear() + 1, d.getMonth(), day);
    setD(d);
  });
  take(new RegExp('\\s(?:(?:next|this|on)\\s+)?(' + WDRE + ')(?=\\s)', 'i'), m => {
    let n = (WD[m[1].slice(0, 3).toLowerCase()] - base.getDay() + 7) % 7; if (n === 0) n = 7;
    setD(addDays(base, n));
  });
  if (o.repeat && !o.due) {
    if (o.repeat.days && o.repeat.days.length) { let d = new Date(base); while (!o.repeat.days.includes(d.getDay())) d = addDays(d, 1); setD(d); }
    else o.due = bd;
  }
  if (o.time && !o.due) o.due = bd;
  s = s.replace(/\s+(?:on|at|by|due|for)\s*$/i, ' ');
  o.title = s.replace(/\s+/g, ' ').trim() || text.trim();
  return o;
}

/* ---------- store ---------- */
const KEY = 'opentick.v1';
function localWeekStart() {
  try { const l = new Intl.Locale(navigator.language), w = l.getWeekInfo ? l.getWeekInfo() : l.weekInfo; return w.firstDay % 7; } catch (e) { return 1; }
}
/* Exams and homework used to be records of their own inside the classes timetable. They are ordinary tasks now, so a list, a project, the
   calendar and the matrix all see them. Each old record becomes the task "sx-<id>" exactly once: the record is dropped and its id is
   tombstoned, so a device that still has it (or syncs it back) cannot make a second copy, and a task you delete stays deleted.
   It has to be a plain function: load() runs before the later scripts are defined. */
function migrateClasses(r) {
  const old = r.school.filter(x => x.k === 'exam' || x.k === 'homework');
  if (!old.length) return;
  const now = Date.now(), td = ymd(new Date()), have = new Set(r.tasks.map(t => t.id)), cfg = r.school.find(x => x.k === 'cfg');
  let listId = 'inbox', top = Math.min(0, ...r.tasks.map(x => x.order || 0));
  const mkList = () => {
    if (r.tomb['list-classes'] && !r.lists.some(l => l.id === 'list-classes')) return 'inbox'; // it was deleted on purpose
    if (!r.lists.some(l => l.id === 'list-classes')) r.lists.push({ id: 'list-classes', name: (cfg && cfg.name) || 'Classes', color: '#8e5cf7', sections: [], u: now });
    return 'list-classes';
  };
  for (const x of old) {
    const id = 'sx-' + x.id;
    if (!have.has(id) && !r.tomb[id]) {
      if (listId === 'inbox') listId = mkList();
      const exam = x.k === 'exam', due = (exam ? x.date : x.due) || null, done = exam ? !!(due && due < td) : !!x.done;
      const t = { id, title: x.title || (exam ? 'Exam' : 'Homework'), notes: x.notes || '', listId, due, time: exam && x.time ? x.time : null, ...(exam && x.time ? { dur: 60 } : {}), priority: 0, tags: [], subtasks: [], repeat: null, reminder: null, status: done ? 'done' : 'open', ...(done ? { doneAt: now } : {}), section: null, created: now, order: (top -= 1000), kind: x.k, ...(x.subjectId ? { subjectId: x.subjectId } : {}), ...(exam && x.room ? { room: x.room } : {}), u: now };
      r.tasks.push(t); have.add(id);
    }
    r.tomb[x.id] = Math.max(r.tomb[x.id] || 0, now);
  }
  r.school = r.school.filter(x => x.k !== 'exam' && x.k !== 'homework');
}
function migrate(r) {
  r.lists = r.lists || [];
  if (!r.lists.some(l => l.id === 'inbox')) r.lists.unshift({ id: 'inbox', name: 'Inbox', color: '#4772fa', sections: [] });
  r.lists.forEach(l => { l.sections = l.sections || []; });
  r.tasks.forEach(t => { t.tags = t.tags || []; t.subtasks = t.subtasks || []; t.notes = t.notes || ''; t.status = t.status || 'open'; if (t.links && !Array.isArray(t.links)) t.links = []; });
  r.habits = r.habits || []; r.pomo = r.pomo || []; r.fired = r.fired || {}; r.tomb = r.tomb || {};
  r.tags = r.tags || []; r.slots = r.slots || []; r.school = Array.isArray(r.school) ? r.school.filter(x => x && x.id && x.k) : []; r.notes = Array.isArray(r.notes) ? r.notes : [];
  migrateClasses(r);
  r.notes.forEach(n => { n.title = n.title || ''; n.body = n.body || ''; n.tags = n.tags || []; n.created = n.created || Date.now(); n.updated = n.updated || n.created; });
  r.slots.forEach(x => { x.days = x.days || []; });
  r.settings = { theme: DEFAULT_THEME, sort: 'manual', group: 'none', weekStart: localWeekStart(), ...(r.settings || {}) };
  // 'auto' used to be the default; the default is now Gruvbox Dark (an explicit light/dark choice is kept)
  if (r.settings.themeV !== 2) { if (r.settings.theme === 'auto') r.settings.theme = DEFAULT_THEME; r.settings.themeV = 2; }
  r.settings.customThemes = Array.isArray(r.settings.customThemes) ? r.settings.customThemes.filter(c => c && c.id && typeof c.css === 'string') : [];
  if (!THEMES.some(t => t[0] === r.settings.theme) && !r.settings.customThemes.some(c => c.id === r.settings.theme)) r.settings.theme = DEFAULT_THEME;
  r.settings.gantt = { scale: 'week', mode: 'both', zoom: 1, nameW: 290, cols: ['plan', 'actual'], hatch: true, progress: true, tray: true, trayW: 220, lanes: true, ...(r.settings.gantt || {}) };
  // layout is per device: panel widths, which panels are hidden, folded sidebar sections, sidebar views
  r.settings.ui = { sideW: 300, detailW: 380, side: true, detail: true, trayW: 236, tray: true, fold: {}, hidePages: [], pageOrder: [], scale: 1, ...(r.settings.ui || {}) };
  if (!r.settings.bg || typeof r.settings.bg !== 'object') r.settings.bg = { on: !/Android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''), animate: true, style: 'accent', shape: 'blobs', intensity: 60, speed: 100 };
  { const sc = r.settings.ui.scale == null || r.settings.ui.scale === '' ? NaN : Number(r.settings.ui.scale); r.settings.ui.scale = Number.isFinite(sc) ? Math.min(1.5, Math.max(0.8, Math.round(sc * 20) / 20)) : 1; }
  { const t0 = r.settings.tt || {}; // `auto` hides the quiet hours; anyone who had already narrowed the range keeps their own hours
    r.settings.tt = { from: 0, to: 24, view: 'week', weekends: true, fit: true, adOpen: true, classes: true, ...t0 };
    if (typeof t0.auto !== 'boolean') r.settings.tt.auto = !(t0.from > 0 || (t0.to != null && t0.to < 24)); }
  // the grid used to default to 07:00–21:00; the whole day is now shown unless the range was chosen deliberately after that change
  if (r.settings.tt.v !== 2) { if (r.settings.tt.from === 7 && r.settings.tt.to === 21) { r.settings.tt.from = 0; r.settings.tt.to = 24; } r.settings.tt.v = 2; }
  r.projects = Array.isArray(r.projects) ? r.projects : []; // projects link lists (and, with them, their sublists) together
  r.history = Array.isArray(r.history) ? r.history : []; // this device's log of changes (never synced)
  r.settings.cal = { view: 'month', ...(r.settings.cal || {}) };
  r.settings.clock = { on: true, h24: false, sec: false, ...(r.settings.clock || {}) };
  r.settings.sound = { on: true, vol: 0.7, haptic: true, ...(r.settings.sound || {}) };
  if (r.settings.banners == null) r.settings.banners = true;
  r.settings.notes = { view: 'auto', scope: '', group: false, ...(r.settings.notes || {}) };
  r.settings.pomo = { focus: 25, short: 5, long: 15, faceDown: false, ...(r.settings.pomo || {}) };
  return r;
}
function seed() {
  // fixed ids: two fresh devices that sync with each other end up with ONE set of welcome tasks, not two
  const td = todayStr(), tm = ymd(addDays(new Date(), 1)), pid = 'personal', wid = 'work';
  const mk = (id, title, o = {}) => ({ id: 'seed-' + id, title, notes: '', listId: 'inbox', due: null, time: null, priority: 0, tags: [], subtasks: [], repeat: null, reminder: null, status: 'open', section: null, created: Date.now(), order: 0, ...o });
  const tasks = [
    mk('welcome', 'Welcome to OpenTick 👋 Tap a task to edit it', { due: td, priority: 2, notes: '**Your data lives on this device.** Use *Settings → Sync* to keep your devices in step, or *Export* to back up.\n\nNotes support **Markdown**: `code`, [links](https://example.com), lists and checklists.\n\n- [ ] Click a checkbox to tick it off\n- [ ] Switch to *Write* to edit this note' }),
    mk('quick', 'Quick add understands text: “Call mum tomorrow 5pm !high #family”', { due: td }),
    mk('tabs', 'Try the Calendar, Matrix, Habit and Focus tabs', { due: tm }),
    mk('plants', 'Water the plants every 3 days', { due: td, listId: pid, repeat: { every: 3, unit: 'day' } }),
    mk('sprint', 'Plan the sprint', { listId: wid, section: 'To Do', priority: 3, subtasks: [{ id: 'seed-s1', title: 'Collect tickets', done: true }, { id: 'seed-s2', title: 'Estimate', done: false }] }),
    mk('prs', 'Review pull requests', { listId: wid, section: 'Doing', due: tm }),
  ];
  tasks.forEach((t, i) => { t.order = i * 1000; });
  return migrate({
    v: 1, tasks,
    lists: [{ id: 'inbox', name: 'Inbox', color: '#4772fa', sections: [] }, { id: pid, name: 'Personal', color: '#f4a62a', sections: [] }, { id: wid, name: 'Work', color: '#34b36b', sections: ['To Do', 'Doing', 'Done'], view: 'kanban' }],
    habits: [{ id: 'seed-water', name: 'Drink water', icon: '💧', color: '#12a9c7', log: {} }],
    notes: [{ id: 'seed-note-md', title: 'Notes: a Markdown cheat sheet', pinned: true, tags: ['welcome'], created: Date.now(), updated: Date.now(), body: [
      '# Welcome to Notes', '', 'Everything here is **Markdown**. Use the toolbar, or just type. Switch between *Write*, *Split* and *Preview* above.', '',
      '## Text', '', '**bold**, *italic*, ~~strike~~, ==highlight==, `inline code`, H~2~O and x^2^ — and a [link](https://example.com).', '',
      '## Lists', '', '- [x] Checklists can be ticked in the preview', '- [ ] Like this one', '  - nested items work too', '', '1. Numbered', '2. Lists', '',
      '## Quote, code and table', '', '> A quote for the road.', '', '```js', 'const answer = 42; // fenced code, with colours', '```', '',
      '| Feature | Works |', '|---|:-:|', '| Tables | yes |', '| Footnotes | yes[^1] |', '',
      '## Linking', '', 'Link notes together with double brackets: [[Notes: a Markdown cheat sheet]]. Images use `![alt](https://…)`.', '',
      '[^1]: Footnotes appear at the bottom of the note.'].join('\n') }],
  });
}
function load() {
  if (Vault.locked) return vaultPlaceholder(); // encrypted and not unlocked yet: an empty stand-in that is never written anywhere
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.v && Array.isArray(r.tasks) && !r.enc) return migrate(r); } catch (e) { /* fall through */ }
  return seed();
}
/* ---------- change tracking for sync ----------
   Every record (task, list, habit) carries `u`, the time it last changed. Instead of touching every mutation site,
   save() compares each record with a snapshot (SEEN) and stamps the ones that differ. Records that disappeared get a
   tombstone in S.tomb so a deletion can be told apart from "this device has never seen it". */
const COLL = ['tasks', 'lists', 'habits', 'tags', 'slots', 'notes', 'projects', 'school'];
const SEEN = { tasks: new Map(), lists: new Map(), habits: new Map(), tags: new Map(), slots: new Map(), notes: new Map(), projects: new Map(), school: new Map() };
const hashOf = o => JSON.stringify(o, (k, v) => (k === 'u' ? undefined : v));
// "edited just now" markers: which records this device changed in the last couple of minutes (never synced, never saved)
const EDITED = new Map(), EDIT_SHOW = 120000;
const editedCls = id => (EDITED.has(id) && Date.now() - EDITED.get(id) < EDIT_SHOW ? ' edited' : '');
function initSeen() { for (const c of COLL) { SEEN[c].clear(); for (const o of S[c]) SEEN[c].set(o.id, hashOf(o)); } }
function stamp() {
  const now = Date.now(); let changed = false; const seen = [];
  for (const c of COLL) {
    const live = new Set();
    for (const o of S[c]) {
      live.add(o.id);
      const h = hashOf(o), prev = SEEN[c].get(o.id);
      if (prev !== h) { o.u = Math.max(now, (o.u || 0) + 1); SEEN[c].set(o.id, h); changed = true; seen.push([c, prev, o]); if (prev && c !== 'habits') EDITED.set(o.id, now); }
    }
    for (const id of [...SEEN[c].keys()]) if (!live.has(id)) { seen.push([c, SEEN[c].get(id), null]); SEEN[c].delete(id); S.tomb[id] = Math.max(now, (S.tomb[id] || 0) + 1); changed = true; }
  }
  if (seen.length) { try { histRecord(seen, now); } catch (e) { /* the log is a convenience: never let it break saving */ } }
  return changed;
}

/* ---------- history ----------
   A per-device log of what you changed: stamp() already compares every record with its previous state, so the log is
   built from those differences (nothing has to be remembered at each call site). Changes that arrive through sync are
   not logged. Quick successive edits of one record (typing a title) are folded into one entry. */
const HIST_MAX = 2000, HIST_MERGE = 90000;
const HIST_KIND = { tasks: 'task', lists: 'list', habits: 'habit', notes: 'note', slots: 'slot', projects: 'project' };
const HIST_ACT = { add: 'Added', edit: 'Edited', done: 'Completed', reopen: 'Reopened', wontdo: "Won't do", delete: 'Deleted', restore: 'Restored', purge: 'Deleted forever', import: 'Imported' };
const HIST_IGN = new Set(['u', 'id', 'order', 'updated', 'created', 'doneAt', 'logU', 'deleted', 'log', 'pinned']);
const HIST_FLAG = new Set(['notes', 'body', 'subtasks', 'log', 'banner']); // changes shown as "edited", without values
const histName = (k, o) => String((k === 'task' ? o.title : k === 'list' || k === 'habit' || k === 'project' ? o.name : k === 'note' ? noteTitle(o) : o.title) || '').trim().slice(0, 90) || 'Untitled';
function histChange(k, o, n) {
  if (k === 'task') {
    if (!o.deleted && n.deleted) return { a: 'delete' };
    if (o.deleted && !n.deleted) return { a: 'restore' };
    if (o.status !== n.status) return { a: n.status === 'done' ? 'done' : n.status === 'wontdo' ? 'wontdo' : 'reopen' };
  }
  if (k === 'note' && !o.pinned !== !n.pinned) return { a: 'edit', f: { pinned: [!!o.pinned, !!n.pinned] } };
  if (k === 'habit') { // check-ins: which days were ticked or unticked
    const on = [], off = [];
    for (const d of Object.keys(n.log || {})) if (n.log[d] && !(o.log || {})[d]) on.push(d);
    for (const d of Object.keys(o.log || {})) if (o.log[d] && !(n.log || {})[d]) off.push(d);
    if (on.length || off.length) { const e = { a: on.length ? 'done' : 'reopen', d: (on.length ? 'Checked in ' : 'Unchecked ') + (on.length ? on : off).sort().join(', ') }; return e; }
  }
  const f = {};
  for (const key of new Set([...Object.keys(o), ...Object.keys(n)])) {
    if (HIST_IGN.has(key)) continue;
    const a = o[key], b = n[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) f[key] = HIST_FLAG.has(key) ? [null, null] : [typeof a === 'string' ? a.slice(0, 120) : a ?? null, typeof b === 'string' ? b.slice(0, 120) : b ?? null];
  }
  return Object.keys(f).length ? { a: 'edit', f } : null;
}
function histRecord(seen, now) {
  const out = [], clones = new Set();
  for (const [c, prev, cur] of seen) if (c === 'tasks' && !prev && cur && cur.log && cur.status === 'done') clones.add(cur.title);
  for (const [c, prevJson, cur] of seen) {
    const k = HIST_KIND[c]; if (!k) continue;
    const o = prevJson ? JSON.parse(prevJson) : null;
    if (!o && cur) { out.push(cur.log && cur.status === 'done' ? { k, a: 'done', id: cur.id, n: histName(k, cur), d: 'Repeating task: this occurrence' } : { k, a: 'add', id: cur.id, n: histName(k, cur) }); continue; }
    if (o && !cur) { out.push({ k, a: k === 'task' ? 'purge' : 'delete', id: o.id, n: histName(k, o) }); continue; }
    if (!o || !cur) continue;
    const ch = histChange(k, o, JSON.parse(hashOf(cur)));
    if (!ch) continue;
    // the next-date change of a repeating task that was just ticked is already told by its "completed" entry
    if (k === 'task' && ch.f && clones.has(cur.title) && cur.repeat && Object.keys(ch.f).every(x => x === 'due' || x === 'subtasks' || x === 'time')) continue;
    out.push({ k, ...ch, id: cur.id, n: histName(k, cur) });
  }
  const H = S.history;
  for (const e of out) {
    e.t = now;
    if (e.a === 'edit' && e.f) { // fold into a recent edit of the same record
      const prev = H.slice(-25).reverse().find(x => x.id === e.id && x.a === 'edit' && x.f && now - x.t < HIST_MERGE);
      if (prev) {
        for (const [key, [from, to]] of Object.entries(e.f)) prev.f[key] = prev.f[key] ? [prev.f[key][0], to] : [from, to];
        for (const key of Object.keys(prev.f)) if (!HIST_FLAG.has(key) && JSON.stringify(prev.f[key][0]) === JSON.stringify(prev.f[key][1])) delete prev.f[key];
        prev.t = now; prev.n = e.n;
        if (!Object.keys(prev.f).length) H.splice(H.indexOf(prev), 1);
        continue;
      }
    }
    H.push(e);
  }
  if (H.length > HIST_MAX) H.splice(0, H.length - HIST_MAX);
}
function histNote(a, text) { S.history.push({ t: Date.now(), k: 'app', a, id: '', n: text }); }

let S = load();
initSeen();
let saveTimer;
const hooks = { change() {} }; // sync.js hooks in here
function flush() {
  clearTimeout(saveTimer);
  if (Vault.locked) return; // locked: S is only a placeholder, so nothing is stamped, saved or synced
  const changed = stamp();
  persist();
  if (changed) { hooks.change(); if (typeof dockSaved === 'function') dockSaved(); if (typeof editedPaint === 'function') editedPaint(); if (typeof widgetPush === 'function') widgetPush(); }
  else if (typeof dockSaved === 'function') dockSaved(true);
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 120); if (typeof savePending === 'function') savePending(); }

/* ---------- merge (pure): last-writer-wins per record, deletions via tombstones ---------- */
const TOMB_TTL = 180 * 864e5;
const canon = o => JSON.stringify(Object.keys(o || {}).sort().map(k => [k, o[k]]));
const cyrb53 = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36); };
const snapshot = () => ({ tasks: S.tasks, lists: S.lists, habits: S.habits, tags: S.tags, slots: S.slots, notes: S.notes, projects: S.projects, school: S.school, pomo: S.pomo, tomb: S.tomb });
function fingerprint(d) {
  const p = [];
  for (const c of COLL) for (const o of (d[c] || [])) p.push(c[0] + o.id + ':' + (o.u || 0));
  p.sort();
  for (const id of Object.keys(d.tomb || {}).sort()) p.push('x' + id + ':' + d.tomb[id]);
  p.push('p' + (d.pomo || []).length);
  return cyrb53(p.join('|'));
}
function pickNewer(x, y) {
  const a = x.u || 0, b = y.u || 0;
  if (a !== b) return a > b ? x : y;
  return JSON.stringify(x) >= JSON.stringify(y) ? x : y; // same clock tick: any deterministic rule, so both devices agree
}
// habits: the winner supplies name/icon/colour; check-ins are merged per day so two devices ticking different days both survive
function mergeHabit(x, y, w) {
  const lx = x.log || {}, ly = y.log || {}, ux = x.logU || {}, uy = y.logU || {};
  const log = {}, logU = {};
  for (const d of [...new Set([...Object.keys(lx), ...Object.keys(ly), ...Object.keys(ux), ...Object.keys(uy)])].sort()) {
    const tx = ux[d] || 0, ty = uy[d] || 0;
    if (tx > ty ? lx[d] : ty > tx ? ly[d] : lx[d] || ly[d]) log[d] = 1;
    if (tx || ty) logU[d] = Math.max(tx, ty);
  }
  const m = { ...w, log, logU };
  if (canon(log) !== canon(w.log) || canon(logU) !== canon(w.logU)) m.u = Math.max(x.u || 0, y.u || 0) + 1; // differs from both sides → must propagate
  return m;
}
function mergeData(L, R) {
  const out = { tomb: {} }, tombs = new Map(), now = Date.now();
  for (const t of [L.tomb || {}, R.tomb || {}]) for (const [id, ts] of Object.entries(t)) tombs.set(id, Math.max(tombs.get(id) || 0, ts));
  for (const c of COLL) {
    const a = new Map((L[c] || []).map(o => [o.id, o])), b = new Map((R[c] || []).map(o => [o.id, o])), res = [];
    for (const id of new Set([...a.keys(), ...b.keys()])) {
      const x = a.get(id), y = b.get(id);
      let w = x && y ? pickNewer(x, y) : x || y;
      if (c === 'habits' && x && y) w = mergeHabit(x, y, w);
      if ((tombs.get(id) || 0) >= (w.u || 0) && tombs.has(id)) continue; // deleted at least as recently as it was last edited
      tombs.delete(id); // an edit newer than the deletion resurrects the record
      res.push(w);
    }
    out[c] = res;
  }
  for (const [id, ts] of tombs) if (now - ts < TOMB_TTL) out.tomb[id] = ts;
  const seen = new Set(), pomo = [];
  for (const p of [...(L.pomo || []), ...(R.pomo || [])]) { const k = p.ts + '|' + p.min + '|' + (p.task || ''); if (!seen.has(k)) { seen.add(k); pomo.push(p); } }
  out.pomo = pomo.sort((p, q) => p.ts - q.ts);
  return out;
}
function applyMerged(m) {
  S.tasks = m.tasks; S.lists = m.lists; S.habits = m.habits; S.tags = m.tags; S.slots = m.slots; S.notes = m.notes; S.projects = m.projects; S.school = m.school; S.pomo = m.pomo; S.tomb = m.tomb;
  migrate(S); initSeen();
  persist(true); // if storage is full the copy in memory is still right
}
// Replace everything (import / undo) in a way that sync treats as a deliberate edit: gone records become tombstones, kept ones are re-stamped
function replaceAll(d) {
  const old = {}; for (const c of COLL) old[c] = S[c].map(o => o.id);
  const tomb = { ...S.tomb }, now = Date.now(), hist = S.history;
  S = migrate({ ...d, tomb: {} }); S.history = hist;
  for (const c of COLL) {
    const ids = new Set(S[c].map(o => o.id));
    for (const id of old[c]) if (!ids.has(id)) tomb[id] = now;
    S[c].forEach(o => { o.u = now; delete tomb[o.id]; });
  }
  S.tomb = tomb; initSeen(); flush(); hooks.change();
}
const getT = id => S.tasks.find(t => t.id === id);
/* ---------- tag colours, timetable helpers ---------- */
const tagColor = name => { const r = S.tags.find(x => x.id === 'tag-' + name); return r ? r.color : null; };
function setTagColor(name, color) {
  const id = 'tag-' + name, i = S.tags.findIndex(x => x.id === id);
  if (!color) { if (i >= 0) S.tags.splice(i, 1); } else if (i >= 0) S.tags[i].color = color; else S.tags.push({ id, name, color });
  save();
}
function renameTag(from, to) {
  const c = tagColor(from);
  S.tasks.forEach(t => { if (t.tags.includes(from)) t.tags = [...new Set(t.tags.map(g => (g === from ? to : g)))]; });
  setTagColor(from, null);
  if (c && !tagColor(to)) setTagColor(to, c);
  save();
}
const toMin = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fromMin = n => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
const slotById = id => S.slots.find(x => x.id === id);
function nextSlotDate(s, from = new Date()) { for (let i = 0; i < 7; i++) { const d = addDays(from, i); if ((s.days || []).includes(d.getDay())) return d; } return from; }
/* Times are stored as 24-hour "HH:MM" and drawn the way Settings -> Clock says (12-hour with AM / PM unless "24-hour" is on).
   Anything that is not a real time shows as nothing rather than "NaN:NaN". */
const validHM = x => /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(x || ''));
const clock24 = () => !!(S && S.settings && S.settings.clock && S.settings.clock.h24);
function fmtMin(min, o) { // minutes after midnight (1440 = the end of the day)
  if (!Number.isFinite(min)) return '';
  const m = ((Math.round(min) % 1440) + 1440) % 1440, h = Math.floor(m / 60), mm = m % 60;
  if (clock24()) return pad(h) + ':' + pad(mm);
  return (h % 12 || 12) + ':' + pad(mm) + (o && o.noAp ? '' : '\u00a0' + (h < 12 ? 'AM' : 'PM'));
}
const fmtTime = hm => (validHM(hm) ? fmtMin(toMin(hm)) : '');
// "9:00–10:30 AM" when both ends are on the same side of noon, "11:30 AM–1:00 PM" otherwise; a missing or backwards end shows just the start
function fmtRange(a, b) {
  a = typeof a === 'string' ? (validHM(a) ? toMin(a) : NaN) : a; b = typeof b === 'string' ? (validHM(b) ? toMin(b) : NaN) : b;
  if (!Number.isFinite(a)) return '';
  if (!Number.isFinite(b) || b <= a) return fmtMin(a);
  const same = !clock24() && Math.floor((a % 1440) / 720) === Math.floor((b % 1440) / 720);
  return fmtMin(a, { noAp: same }) + '–' + fmtMin(b);
}
const fmtHour = h => (clock24() ? pad(h % 24) + ':00' : ((h % 12) || 12) + '\u00a0' + (h % 24 < 12 ? 'AM' : 'PM'));
const fmtDur = m => (m % 60 === 0 ? `${m / 60}h` : m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const listOf = id => S.lists.find(l => l.id === id) || S.lists[0];
/* ---------- sublists and projects ----------
   A list may sit inside another (list.parent) to any depth; a list's view includes its sublists. A project links any
   number of lists (and so their sublists) so they can be looked at together. A missing or cyclic parent is treated as top level. */
function listTree() {
  const ids = new Set(S.lists.map(l => l.id)), by = new Map(), out = [], seen = new Set();
  for (const l of S.lists) { if (l.id === 'inbox') continue; const p = l.parent && ids.has(l.parent) && l.parent !== l.id && l.parent !== 'inbox' ? l.parent : ''; if (!by.has(p)) by.set(p, []); by.get(p).push(l); }
  const walk = (p, d) => { for (const l of by.get(p) || []) { if (seen.has(l.id)) continue; seen.add(l.id); out.push({ l, depth: d, kids: (by.get(l.id) || []).length }); walk(l.id, d + 1); } };
  walk('', 0);
  for (const l of S.lists) if (l.id !== 'inbox' && !seen.has(l.id)) { seen.add(l.id); out.push({ l, depth: 0, kids: 0 }); } // only reachable through a cycle
  return out;
}
function listDescendants(id) {
  const out = [], seen = new Set([id]); let frontier = [id];
  while (frontier.length) { const next = []; for (const l of S.lists) if (l.parent && frontier.includes(l.parent) && !seen.has(l.id)) { seen.add(l.id); out.push(l.id); next.push(l.id); } frontier = next; }
  return out;
}
function listPath(id) { const out = [], seen = new Set(); let l = S.lists.find(x => x.id === id); while (l && !seen.has(l.id)) { seen.add(l.id); out.unshift(l.name); l = l.parent ? S.lists.find(x => x.id === l.parent) : null; } return out; }
const listLabel = id => listPath(id).join(' › ');
const listIds = id => [id, ...listDescendants(id)];
const projectOf = id => S.projects.find(p => p.id === id);
const projectListIds = p => [...new Set((p.listIds || []).filter(id => S.lists.some(l => l.id === id)).flatMap(listIds))];
function newTask(o = {}) {
  const top = Math.min(0, ...S.tasks.map(x => x.order || 0)) - 1000;
  return { id: uid(), title: '', notes: '', listId: 'inbox', due: null, time: null, priority: 0, tags: [], subtasks: [], repeat: null, reminder: null, status: 'open', section: null, created: Date.now(), order: top, ...o };
}
function toggleDone(t) {
  if (t.status === 'open') {
    if (t.repeat && t.due) {
      // the finished occurrence is kept as a record with its own copy of the notes, links and files; the live task carries
      // all of them into the next occurrence (ticked checklist items in its notes start again, like subtasks)
      S.tasks.push({ ...t, id: uid(), status: 'done', doneAt: Date.now(), log: 1, repeat: null, reminder: null, subtasks: t.subtasks.map(s => ({ ...s })), tags: [...t.tags], links: [...(t.links || [])], files: (t.files || []).map(f => ({ ...f })) });
      t.due = nextDue(t); t.subtasks.forEach(s => { s.done = false; });
      if (t.notes) t.notes = t.notes.replace(/^(\s*(?:[-*+]|\d{1,9}[.)])\s+\[)[xX](\])/gm, '$1 $2');
      toast('Done — next: ' + dueLabel(t)); sfx('done');
    } else { t.status = 'done'; t.doneAt = Date.now(); sfx('done'); }
  } else { t.status = 'open'; delete t.doneAt; sfx('undo'); }
  save();
}

/* ---------- standalone notes ---------- */
const noteById = id => S.notes.find(n => n.id === id);
// A note's title as it is written (markdown and all): the title field, else the first line of the text without its block marker.
// Only the marker is removed (#, >, -, 1., [ ]), so **bold** or `code` at the start of a line survives and can be rendered.
const NOTE_MARK = /^(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d{1,9}[.)]\s+|\[[ xX]\]\s+)+/;
const noteTitleSrc = n => (n.title && n.title.trim()) || (String(n.body || '').split('\n').map(l => l.trim().replace(NOTE_MARK, '').replace(/\s+#+\s*$/, '').trim()).find(Boolean) || 'Untitled note');
// The same title as plain text (for menus, history, wiki links): the markup is rendered and then the tags are dropped.
const mdPlain = s => String(mdInline(String(s || ''), true)).replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const noteTitle = n => mdPlain(noteTitleSrc(n)).trim().slice(0, 80) || 'Untitled note';
const noteTitleHtml = n => mdInline(noteTitleSrc(n), true) || esc(noteTitle(n));
function newNote(o = {}) { const now = Date.now(); return { id: uid(), title: '', body: '', tags: [], pinned: false, created: now, updated: now, ...o }; }
const noteByTitle = name => { const k = String(name || '').trim().toLowerCase(); return k ? S.notes.find(n => noteTitle(n).toLowerCase() === k || noteTitleSrc(n).toLowerCase() === k) || null : null; };
const wordCount = txt => (String(txt || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;

/* ---------- where a note lives: a list or a project ----------
   note.listId / note.projectId say where a note is filed (at most one of them; neither = unfiled). A list's notes include those of its
   sublists, and a project's notes include those filed in any of its lists. A list or project that was deleted simply means "unfiled". */
function noteHomeOf(n) {
  if (n.projectId && S.projects.some(p => p.id === n.projectId)) return { kind: 'project', id: n.projectId };
  if (n.listId && n.listId !== 'inbox' && S.lists.some(l => l.id === n.listId)) return { kind: 'list', id: n.listId };
  return { kind: '', id: '' };
}
// scope: '' = every note, 'none' = unfiled, 'list:ID', 'project:ID'
function noteInScope(n, scope) {
  if (!scope) return true;
  const h = noteHomeOf(n);
  if (scope === 'none') return !h.kind;
  if (scope.startsWith('list:')) return h.kind === 'list' && listIds(scope.slice(5)).includes(h.id);
  if (scope.startsWith('project:')) { const p = projectOf(scope.slice(8)); return !!p && (h.kind === 'project' ? h.id === p.id : h.kind === 'list' && projectListIds(p).includes(h.id)); }
  return true;
}
const noteScopeValid = scope => !scope || scope === 'none' || (scope.startsWith('list:') && S.lists.some(l => l.id === scope.slice(5))) || (scope.startsWith('project:') && !!projectOf(scope.slice(8)));
const noteScope = () => { const sc = (S.settings.notes || {}).scope || ''; return noteScopeValid(sc) ? sc : ''; };
const noteHomePatch = scope => (scope.startsWith('list:') ? { listId: scope.slice(5) } : scope.startsWith('project:') ? { projectId: scope.slice(8) } : {});
// the dropdown value of a note's home: '', 'l:ID' or 'p:ID'
const noteHomeValue = n => { const h = noteHomeOf(n); return h.kind === 'project' ? 'p:' + h.id : h.kind === 'list' ? 'l:' + h.id : ''; };
function noteSetHome(n, v) {
  delete n.listId; delete n.projectId;
  if (v.startsWith('p:')) n.projectId = v.slice(2); else if (v.startsWith('l:')) n.listId = v.slice(2);
  n.updated = Date.now();
}
// when a list or project goes away its notes become unfiled
const notesDetach = (kind, id) => S.notes.forEach(n => { if (kind === 'list' && n.listId === id) { delete n.listId; } else if (kind === 'project' && n.projectId === id) { delete n.projectId; } });

/* ---------- links between tasks and notes ----------
   A task keeps the ids of the notes it is linked to (task.links). The other direction is worked out, never stored, so a link
   is one fact in one record: it syncs with the task, and cannot disagree with itself. A deleted note simply drops out. */
const linkedNotes = t => (t.links || []).map(id => noteById(id)).filter(Boolean);
const linkedTasks = n => S.tasks.filter(t => !t.deleted && !t.log && (t.links || []).includes(n.id));
function setLink(t, noteId, on) {
  const cur = t.links || [], has = cur.includes(noteId);
  if (on && !has) t.links = [...cur, noteId]; else if (!on && has) t.links = cur.filter(x => x !== noteId);
  save();
}
