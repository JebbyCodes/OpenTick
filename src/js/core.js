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

/* ---------- dates & repeat ---------- */
function fmtDate(s) {
  const d = pYmd(s), diff = dayDiff(s, todayStr());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return DAYS[d.getDay()];
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}` + (d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : '');
}
const dueLabel = t => (t.due ? fmtDate(t.due) + (t.time ? ' ' + t.time : '') : '');
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
function parseQuick(text, lists, base = new Date()) {
  const o = { title: '', due: null, time: null, dur: null, priority: 0, tags: [], listId: null, repeat: null };
  let s = ' ' + text + ' ';
  const bd = ymd(base);
  const take = (re, fn) => { s = s.replace(re, (...m) => (fn(m) === false ? m[0] : ' ')); };
  const setD = d => { o.due = ymd(d); };
  take(/\s#([\w-]+)(?=\s)/g, m => { o.tags.push(m[1].toLowerCase()); });
  take(/\s~(\S+)(?=\s)/g, m => {
    const k = m[1].toLowerCase(), l = lists.find(x => x.name.toLowerCase().replace(/\s+/g, '') === k);
    if (!l) return false; o.listId = l.id;
  });
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
function migrate(r) {
  r.lists = r.lists || [];
  if (!r.lists.some(l => l.id === 'inbox')) r.lists.unshift({ id: 'inbox', name: 'Inbox', color: '#4772fa', sections: [] });
  r.lists.forEach(l => { l.sections = l.sections || []; });
  r.tasks.forEach(t => { t.tags = t.tags || []; t.subtasks = t.subtasks || []; t.notes = t.notes || ''; t.status = t.status || 'open'; });
  r.habits = r.habits || []; r.pomo = r.pomo || []; r.fired = r.fired || {}; r.tomb = r.tomb || {};
  r.tags = r.tags || []; r.slots = r.slots || [];
  r.slots.forEach(x => { x.days = x.days || []; });
  r.settings = { theme: DEFAULT_THEME, sort: 'manual', group: 'none', weekStart: localWeekStart(), ...(r.settings || {}) };
  // 'auto' used to be the default; the default is now Gruvbox Dark (an explicit light/dark choice is kept)
  if (r.settings.themeV !== 2) { if (r.settings.theme === 'auto') r.settings.theme = DEFAULT_THEME; r.settings.themeV = 2; }
  if (!THEMES.some(t => t[0] === r.settings.theme)) r.settings.theme = DEFAULT_THEME;
  r.settings.gantt = { scale: 'week', mode: 'both', zoom: 1, nameW: 290, cols: ['plan'], hatch: true, progress: true, tray: true, trayW: 220, ...(r.settings.gantt || {}) };
  // layout is per device: panel widths, which panels are hidden, folded sidebar sections, sidebar views
  r.settings.ui = { sideW: 300, detailW: 380, side: true, detail: true, trayW: 236, tray: true, fold: {}, hidePages: [], pageOrder: [], ...(r.settings.ui || {}) };
  r.settings.tt = { from: 7, to: 21, view: 'week', weekends: true, ...(r.settings.tt || {}) };
  r.settings.pomo = { focus: 25, short: 5, long: 15, ...(r.settings.pomo || {}) };
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
  });
}
function load() {
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.v && Array.isArray(r.tasks)) return migrate(r); } catch (e) { /* fall through */ }
  return seed();
}
/* ---------- change tracking for sync ----------
   Every record (task, list, habit) carries `u`, the time it last changed. Instead of touching every mutation site,
   save() compares each record with a snapshot (SEEN) and stamps the ones that differ. Records that disappeared get a
   tombstone in S.tomb so a deletion can be told apart from "this device has never seen it". */
const COLL = ['tasks', 'lists', 'habits', 'tags', 'slots'];
const SEEN = { tasks: new Map(), lists: new Map(), habits: new Map(), tags: new Map(), slots: new Map() };
const hashOf = o => JSON.stringify(o, (k, v) => (k === 'u' ? undefined : v));
function initSeen() { for (const c of COLL) { SEEN[c].clear(); for (const o of S[c]) SEEN[c].set(o.id, hashOf(o)); } }
function stamp() {
  const now = Date.now(); let changed = false;
  for (const c of COLL) {
    const live = new Set();
    for (const o of S[c]) {
      live.add(o.id);
      const h = hashOf(o);
      if (SEEN[c].get(o.id) !== h) { o.u = Math.max(now, (o.u || 0) + 1); SEEN[c].set(o.id, h); changed = true; }
    }
    for (const id of [...SEEN[c].keys()]) if (!live.has(id)) { SEEN[c].delete(id); S.tomb[id] = Math.max(now, (S.tomb[id] || 0) + 1); changed = true; }
  }
  return changed;
}

let S = load();
initSeen();
let saveTimer;
const hooks = { change() {} }; // sync.js hooks in here
function flush() {
  clearTimeout(saveTimer);
  const changed = stamp();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save — storage is full'); }
  if (changed) { hooks.change(); if (typeof ogSchedule === 'function') ogSchedule(); }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 120); }

/* ---------- merge (pure): last-writer-wins per record, deletions via tombstones ---------- */
const TOMB_TTL = 180 * 864e5;
const canon = o => JSON.stringify(Object.keys(o || {}).sort().map(k => [k, o[k]]));
const cyrb53 = s => { let a = 0xdeadbeef, b = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); } a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36); };
const snapshot = () => ({ tasks: S.tasks, lists: S.lists, habits: S.habits, tags: S.tags, slots: S.slots, pomo: S.pomo, tomb: S.tomb });
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
  S.tasks = m.tasks; S.lists = m.lists; S.habits = m.habits; S.tags = m.tags; S.slots = m.slots; S.pomo = m.pomo; S.tomb = m.tomb;
  migrate(S); initSeen();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* keep going: memory copy is still right */ }
}
// Replace everything (import / undo) in a way that sync treats as a deliberate edit: gone records become tombstones, kept ones are re-stamped
function replaceAll(d) {
  const old = {}; for (const c of COLL) old[c] = S[c].map(o => o.id);
  const tomb = { ...S.tomb }, now = Date.now();
  S = migrate({ ...d, tomb: {} });
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
const fmtDur = m => (m % 60 === 0 ? `${m / 60}h` : m > 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const listOf = id => S.lists.find(l => l.id === id) || S.lists[0];
function newTask(o = {}) {
  const top = Math.min(0, ...S.tasks.map(x => x.order || 0)) - 1000;
  return { id: uid(), title: '', notes: '', listId: 'inbox', due: null, time: null, priority: 0, tags: [], subtasks: [], repeat: null, reminder: null, status: 'open', section: null, created: Date.now(), order: top, ...o };
}
function toggleDone(t) {
  if (t.status === 'open') {
    if (t.repeat && t.due) {
      S.tasks.push({ ...t, id: uid(), status: 'done', doneAt: Date.now(), log: 1, repeat: null, reminder: null, subtasks: t.subtasks.map(s => ({ ...s })), tags: [...t.tags] });
      t.due = nextDue(t); t.subtasks.forEach(s => { s.done = false; });
      toast('Done — next: ' + dueLabel(t));
    } else { t.status = 'done'; t.doneAt = Date.now(); }
  } else { t.status = 'open'; delete t.doneAt; }
  save();
}
