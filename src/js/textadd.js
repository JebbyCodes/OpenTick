/* OpenTick "Add from text" (0.9): type or paste many things at once, in a plain-text format that is quick to write by hand
   and easy to ask an AI for.

   Seven kinds, one box:   tasks · calendar (dated events) · timeline (start → end) · timetable (weekly slots) · notes · habits · countdowns

   • tbParse(text, kind, ctx)   pure: text → { items, warns, newLists }. Nothing is changed, so the preview can run on every key.
   • tbCommit(parsed, ctx)      writes the items (in the order they were typed) and returns what it made, so it can be undone.
   • tbPrompt(kind)             the "copy syntax for AI" text: the format, an example, today's date and the user's list names.

   The task kinds reuse the quick-add parser (parseQuick), so everything quick add understands works on a line here: #tag ~List +person
   !high every week until … for 90m, dates like "tomorrow", "fri", "Nov 20". On top of that: time ranges (9:00-10:30), "remind 30m",
   subtasks by indentation, "> note" lines, "# List" / "## Section" headings, "[x]" for done. Nothing here is synced or stored beyond
   what is created: the box only remembers its text while the app is open. */

const TB_KINDS = [['tasks', 'Tasks', 'check-circle'], ['calendar', 'Calendar', 'calendar'], ['timeline', 'Timeline', 'gantt'], ['timetable', 'Timetable', 'table'], ['notes', 'Notes', 'notes'], ['habits', 'Habits', 'activity'], ['countdowns', 'Countdowns', 'hourglass']];
const TB_NOUN = { tasks: ['task', 'tasks'], calendar: ['event', 'events'], timeline: ['item', 'items'], timetable: ['slot', 'slots'], notes: ['note', 'notes'], habits: ['habit', 'habits'], countdowns: ['countdown', 'countdowns'] };
const TB_PAGE = { tasks: 'tasks', kanban: 'tasks', matrix: 'tasks', calendar: 'calendar', gantt: 'timeline', notes: 'notes', habits: 'habits', countdowns: 'countdowns' };
const TB_MAX = 500; // items in one go
const TB_UNIT = { m: 1, min: 1, mins: 1, minute: 1, minutes: 1, h: 60, hr: 60, hrs: 60, hour: 60, hours: 60, d: 1440, day: 1440, days: 1440, w: 10080, wk: 10080, wks: 10080, week: 10080, weeks: 10080 };
const TB_COLOURS = { ...Object.fromEntries(COLORS.map(([c, n]) => [n.toLowerCase(), c])), grey: '#7c828d' };
const TB_WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TB_W = '(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*';
const TB_BULLET = /^(?:[-*•–]\s+|\d{1,3}[.)]\s+)/;
const TB_END = '(?=[\\s,.;:)]|$)';

/* ---------- small readers ---------- */
const tbClean = s => String(s || '').replace(/\s+/g, ' ').replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '').trim();
const tbHM = n => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
function tbClock(h, mi, ap) { // → minutes since midnight, or null
  h = +h; mi = mi == null || mi === '' ? 0 : +mi;
  if (ap) { ap = String(ap).toLowerCase(); if (h < 1 || h > 12) return null; if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; }
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}
// "9:00-10:30", "9am-5pm", "11-1pm" (an am/pm on one side is shared), "9-10" only where `bare` (a timetable); returns { start, end, bad, rest }
const TB_RANGE = /(^|\s)(?:from\s+|at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=[\s,.;)]|$)/i;
function tbRange(s, bare) {
  const m = s.match(TB_RANGE); if (!m) return null;
  const [all, pre, h1, m1, a1, h2, m2, a2] = m;
  if (!bare && m1 == null && m2 == null && !a1 && !a2) return null; // "2-3" is not a time without a colon or am/pm
  const H1 = +h1, H2 = +h2; let A1 = a1 ? a1.toLowerCase() : null, A2 = a2 ? a2.toLowerCase() : null, a, b;
  if (A2 && !A1) A1 = (H1 % 12) > (H2 % 12) ? (A2 === 'am' ? 'pm' : 'am') : A2; // 11-1pm starts in the morning
  a = tbClock(H1, m1, A1);
  if (A1 && !A2) { b = tbClock(H2, m2, A1); if (a != null && b != null && b <= a) b = tbClock(H2, m2, A1 === 'am' ? 'pm' : 'am'); } // 9am-5
  else if (!A1 && !A2) { b = tbClock(H2, m2, null); if (a != null && b != null && b <= a && H2 <= 12) b += 720; } // 9:00-5:00
  else b = tbClock(H2, m2, A2);
  if (a == null || b == null) return null;
  const bad = b <= a || b > 1439;
  return { start: tbHM(a), end: bad ? null : tbHM(b), bad, rest: s.replace(all, pre || ' ') };
}
// one time: "9am", "at 2:30 pm", "14:00"
function tbTime(s) {
  let r = null;
  let rest = s.replace(/(^|\s)(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=[\s,.;)]|$)/i, (m, pre, h, mi, ap) => { const v = tbClock(+h, mi, ap); if (v == null) return m; r = v; return pre || ' '; });
  if (r == null) rest = s.replace(/(^|\s)(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=[\s,.;)]|$)/i, (m, pre, h, mi) => { r = +h * 60 + +mi; return pre || ' '; });
  return r == null ? null : { time: tbHM(r), rest };
}
// "remind 30m", "remind 1 day before", "remind on time": minutes before; any number of them
function tbRemind(s) {
  const list = [];
  const rest = s.replace(/(^|\s)remind(?:er)?s?\s+(?:me\s+)?(?:(\d+(?:\.\d+)?)\s*(m|mins?|minutes?|h|hrs?|hours?|d|days?|w|wks?|weeks?)?|(on\s*time|now))(?:\s+before)?(?=\s|$)/gi, (m, pre, n, u, z) => { list.push(z ? 0 : Math.round(parseFloat(n) * TB_UNIT[(u || 'm').toLowerCase()])); return pre; });
  return { rest, list: [...new Set(list)] };
}
// dates the quick-add parser does not read on its own: "20 Nov", "20th of November", "Nov 20 2026" (→ 2026-11-20); a weekday beside a date is dropped ("Mon 16 Nov")
function tbDates(s) {
  const iso = (mo, d, y) => `${y}-${pad(MO[mo.slice(0, 3).toLowerCase()] + 1)}-${pad(+d)}`;
  s = s.replace(new RegExp('(^|\\s)' + WDRE + '\\.?,?\\s+(?=(?:\\d{1,2}(?:st|nd|rd|th)?(?:\\s+of)?\\s+)?' + MORE + '\\b|\\d{4}-\\d{2}-\\d{2})', 'gi'), '$1');
  s = s.replace(new RegExp('(^|\\s)(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+' + MORE + '\\.?,?\\s+(\\d{4})(?=[\\s,.;:)]|$)', 'gi'), (m, pre, d, mo, y) => ` ${iso(mo, d, y)} `);
  s = s.replace(new RegExp('(^|\\s)' + MORE + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?=[\\s,.;:)]|$)', 'gi'), (m, pre, mo, d, y) => ` ${iso(mo, d, y)} `);
  return s.replace(new RegExp('(^|\\s)(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+' + MORE + '\\b\\.?', 'gi'), (m, pre, d, mo) => `${pre}${mo} ${d}`);
}
// a line that is only a date ("Friday", "Nov 24", "2026-11-24", "Mon 16 Nov:") → 'YYYY-MM-DD', else null
function tbHeaderDate(text, ctx) {
  const t = tbDates(' ' + String(text).replace(/^#{1,6}\s+/, '').replace(/[:：]\s*$/, '') + ' ').replace(/\s+/g, ' ').trim();
  if (!t || /\d{1,2}:\d{2}|\b(?:am|pm)\b/i.test(t)) return null;
  const p = parseQuick(t, ctx.lists, ctx.base, {});
  return p.due && !p.repeat && p.title === t ? p.due : null;
}
function tbColourName(v) { v = String(v).toLowerCase().replace(/^#/, ''); return /^[0-9a-f]{6}$/.test(v) ? '#' + v : TB_COLOURS[v] || ''; }
function tbColour(s, hash) { // "colour:red" anywhere; "#red" / "#34b36b" too where tags do not exist (timetable, habits)
  let color = '';
  s = s.replace(/(^|\s)colou?r\s*[:=]\s*(#?[0-9a-f]{6}|[a-z]+)(?=\s|$)/i, (m, pre, v) => { color = tbColourName(v); return color ? pre : m; });
  if (!color && hash) s = s.replace(/(^|\s)#([0-9a-f]{6}|[a-z]+)(?=\s|$)/gi, (m, pre, v) => { const c = tbColourName(v); if (!c || color) return m; color = c; return pre; });
  return { color, rest: s };
}
function tbDayIdx(w) {
  w = String(w).toLowerCase(); if (w.length < 3) return -1;
  let i = TB_WD.findIndex(f => f.startsWith(w)); if (i < 0 && w.endsWith('s')) i = TB_WD.findIndex(f => f.startsWith(w.slice(0, -1)));
  return i;
}
// days of the week in a line: "Mon", "Mon, Wed & Fri", "Mon-Fri", "weekdays", "weekends", "daily" → { days: [0-6], rest }
function tbDays(s) {
  const days = new Set(), all = () => [0, 1, 2, 3, 4, 5, 6].forEach(d => days.add(d));
  s = s.replace(/(^|\s)(?:every|each|on)\s+(?=(?:sun|mon|tue|wed|thu|fri|sat|week|day))/gi, '$1');
  s = s.replace(new RegExp('(^|[\\s,])(?:weekdays?|every\\s*weekday)' + TB_END, 'gi'), (m, pre) => { [1, 2, 3, 4, 5].forEach(d => days.add(d)); return pre + '\u0001'; });
  s = s.replace(new RegExp('(^|[\\s,])weekends?' + TB_END, 'gi'), (m, pre) => { days.add(6); days.add(0); return pre + '\u0001'; });
  s = s.replace(new RegExp('(^|[\\s,])(?:every\\s*day|everyday|daily|all\\s+week)' + TB_END, 'gi'), (m, pre) => { all(); return pre + '\u0001'; });
  s = s.replace(new RegExp('(^|[\\s,])(' + TB_W + ')\\s*(?:-|–|—|to|through|thru)\\s*(' + TB_W + ')' + TB_END, 'gi'), (m, pre, a, b) => {
    const i = tbDayIdx(a), j = tbDayIdx(b); if (i < 0 || j < 0) return m;
    for (let d = i; ; d = (d + 1) % 7) { days.add(d); if (d === j) break; }
    return pre + '\u0001';
  });
  s = s.replace(new RegExp('(^|[\\s,&+(])(' + TB_W + ')' + TB_END, 'gi'), (m, pre, w) => { const i = tbDayIdx(w); if (i < 0) return m; days.add(i); return pre + '\u0001'; });
  s = s.replace(/\u0001(?:\s*(?:,|&|\+|and)\s*\u0001)*/g, ' ');
  return { days: [...days].sort((a, b) => a - b), rest: s };
}
const tbDayNames = days => { const o = [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d)); return o.length === 7 ? 'Every day' : o.length === 5 && !days.includes(0) && !days.includes(6) ? 'Mon–Fri' : o.map(d => DAYS[d]).join(', '); };
const tbRep = r => (!r ? '' : r.days && r.days.length ? (r.days.join() === '1,2,3,4,5' ? 'every weekday' : 'every ' + [1, 2, 3, 4, 5, 6, 0].filter(d => r.days.includes(d)).map(d => DAYS[d]).join(', ')) : r.every > 1 ? `every ${r.every} ${r.unit}s` : 'every ' + r.unit);
// the leading emoji of a line (a habit's or a countdown's icon)
function tbIcon(s) { const m = s.trim().match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u); return m ? { icon: m[1], rest: s.trim().slice(m[0].length) } : { icon: '', rest: s }; }

// the lines of a text: blank lines and "// comments" dropped, indentation measured (a tab counts as two spaces)
function tbLines(text) {
  const out = [];
  String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    if (!raw.trim() || /^\s*(?:\/\/|<!--)/.test(raw)) return;
    const s = raw.trim(); if (/^(?:```|~~~)/.test(s)) return; // an AI often wraps its answer in a code block
    out.push({ n: i + 1, indent: raw.match(/^[ \t]*/)[0].replace(/\t/g, '  ').length, s });
  });
  return out;
}
// where a "Work > Website" path lives now: the id of the last list, or null when something on the way is missing
function tbFindList(path, lists) {
  let parent = '', id = null;
  for (const name of path) {
    const k = name.toLowerCase(), l = lists.find(x => (x.parent || '') === parent && String(x.name).toLowerCase() === k) || (!parent && k === 'inbox' ? lists.find(x => x.id === 'inbox') : null);
    if (!l) return null; id = l.id; parent = l.id;
  }
  return id;
}

/* ---------- tasks, calendar, timeline ---------- */
function tbTask(line, mode, st, ctx, W) {
  let s = line.s, status = 'open';
  const mk = s.match(/^\[([ xX-])\]\s*/); if (mk) { status = /x/i.test(mk[1]) ? 'done' : mk[1] === '-' ? 'wontdo' : 'open'; s = s.slice(mk[0].length); }
  s = ' ' + s + ' ';
  const rm = tbRemind(s); s = tbDates(rm.rest);
  const pq = x => parseQuick(x.trim(), ctx.lists, ctx.base, { subjects: ctx.subjects, contacts: ctx.contacts });
  let p, start = null, due = null, time = null, dur = 0, title = '';
  if (mode === 'timeline') {
    const fr = s.replace(/(^|\s)from\s+(.+?)\s+(?:to|through|thru)\s+(.+?)\s*$/i, (m, pre, a, b) => `${pre} ${a} -> ${b} `);
    s = (tbTime(fr) || { rest: fr }).rest;
    const parts = s.split(/\s*(?:->|→|=>|\.\.)\s*/);
    if (parts.length > 1) {
      const left = parts[0], right = parts.slice(1).join(' '), pl = pq(left), pr = pq(right);
      const lOnly = !!pl.due && pl.title === left.trim(), rOnly = !!pr.due && pr.title === right.trim();
      p = { ...pl, tags: [...new Set([...pl.tags, ...pr.tags])], priority: Math.max(pl.priority, pr.priority), listId: pl.listId || pr.listId, repeat: pl.repeat || pr.repeat, until: pl.until || pr.until, subjectId: pl.subjectId || pr.subjectId, kind: pl.kind || pr.kind, contactIds: [...new Set([...pl.contactIds, ...pr.contactIds])] };
      title = lOnly ? (rOnly ? '' : pr.title) : pl.title;
      start = pl.due; due = pr.due;
      if (!start && due) start = due;
      else if (start && !due) { W.warn(line.n, 'No end date could be read after the arrow, so only the start date was used.'); due = start; }
    } else {
      let n = 0; s = s.replace(/(^|\s)for\s+(\d+)\s*(d|days?|w|wks?|weeks?)(?=\s)/i, (m, pre, k, u) => { n = +k * (/^w/i.test(u) ? 7 : 1); return pre; });
      p = pq(s); title = p.title; start = p.due; due = p.due;
      if (n > 0 && start) due = ymd(addDays(pYmd(start), n - 1));
    }
    if (start && due && start > due) { [start, due] = [due, start]; W.warn(line.n, 'The end was before the start, so the two dates were swapped.'); }
    if (!start) W.warn(line.n, 'No date was found, so this will not show on the timeline.');
  } else {
    const r = tbRange(s, false);
    if (r) { s = r.rest; time = r.start; if (r.end) dur = toMin(r.end) - toMin(r.start); else W.warn(line.n, 'The end of the time range is not after its start, so only the start time was used.'); }
    else { const c = tbTime(s); if (c) { s = c.rest; time = c.time; } }
    p = pq(s); title = p.title; due = p.due || st.date || (time ? ymd(ctx.base) : null);
    if (mode === 'calendar' && !due) W.warn(line.n, 'No date was found (put a date line above it), so it was added without one.');
  }
  title = tbClean(title);
  if (!title) { W.skip(line.n, 'Needs a title.'); return null; }
  if (rm.list.length && !due) W.warn(line.n, 'A reminder needs a date, so it was ignored.');
  return { k: 'task', n: line.n, title, due, start: mode === 'timeline' ? start : null, time, dur: dur || p.dur || 0, priority: p.priority, tags: p.tags, listPath: st.path, listId: p.listId, section: st.section, repeat: p.repeat, until: p.until, status, notes: '', rems: due ? rm.list : [], subs: [], contactIds: p.contactIds, kind: p.kind, subjectId: p.subjectId };
}
function tbParseTasks(text, mode, ctx, W) {
  const items = [], newLists = [], seen = new Set(), st = { date: null, path: null, section: null };
  let parent = null;
  for (const line of tbLines(text)) {
    if (items.length >= TB_MAX) { W.warn(line.n, `Only the first ${TB_MAX} lines were read.`); break; }
    let s = line.s;
    if (s.startsWith('>')) { if (!parent) { W.warn(line.n, 'A “>” note line needs a task above it.'); continue; } parent.notes += (parent.notes ? '\n' : '') + s.replace(/^>\s?/, ''); continue; }
    const h = s.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const name = h[2].trim().replace(/[:：]$/, ''); parent = null;
      if (mode === 'calendar') { const d = tbHeaderDate(name, ctx); if (d) st.date = d; else W.warn(line.n, `The heading “${name}” was ignored: in the calendar format a heading is a date.`); continue; }
      if (h[1].length === 1) {
        const path = name.split(/\s*[>›»]\s*/).map(x => x.trim()).filter(Boolean); st.path = path.length ? path : null; st.section = null;
        if (path.length && tbFindList(path, ctx.lists) == null && !seen.has(path.join('\u0001').toLowerCase())) { seen.add(path.join('\u0001').toLowerCase()); newLists.push(path); }
      } else st.section = name || null;
      continue;
    }
    s = s.replace(TB_BULLET, '');
    if (mode === 'calendar') { const d = tbHeaderDate(s, ctx); if (d) { st.date = d; parent = null; continue; } }
    if (parent && line.indent > parent.indent) { // a subtask: plain text
      const m = s.match(/^\[([ xX-])\]\s*/); const done = !!m && /x/i.test(m[1]); if (m) s = s.slice(m[0].length);
      if (s.trim()) parent.subs.push({ title: s.trim(), done }); continue;
    }
    const it = tbTask({ ...line, s }, mode, st, ctx, W); if (!it) { parent = null; continue; }
    it.indent = line.indent; items.push(it); parent = it;
  }
  return { items, newLists };
}

/* ---------- timetable slots ---------- */
function tbParseSlots(text, ctx, W) {
  const items = [], st = { days: null };
  for (const line of tbLines(text)) {
    if (items.length >= TB_MAX) { W.warn(line.n, `Only the first ${TB_MAX} lines were read.`); break; }
    let s = line.s;
    if (s.startsWith('>')) { const last = items[items.length - 1]; if (!last) W.warn(line.n, 'A “>” note line needs a slot above it.'); else last.notes += (last.notes ? '\n' : '') + s.replace(/^>\s?/, ''); continue; }
    s = s.replace(/^#{1,6}\s+/, '').replace(TB_BULLET, '');
    const hd = tbDays(' ' + s.replace(/[:：]\s*$/, '') + ' '); if (hd.days.length && !tbClean(hd.rest)) { st.days = hd.days; continue; } // a line of only days: the slots below use them
    s = ' ' + s + ' ';
    let loc = ''; s = s.replace(/\(([^()]*)\)/, (m, a) => { loc = a.trim().slice(0, 60); return ' '; });
    const rm = tbRemind(s); s = rm.rest;
    const cl = tbColour(s, true); s = cl.rest.replace(/(^|\s)#([\w-]+)(?=\s)/g, (m, pre, g) => { W.warn(line.n, `“#${g}” is not a colour name, so it was ignored.`); return pre; });
    const dy = tbDays(s); s = dy.rest; const days = dy.days.length ? dy.days : st.days || [];
    let t0 = null, t1 = null; const r = tbRange(s, true);
    if (r) { s = r.rest; t0 = r.start; t1 = r.end; if (r.bad) W.warn(line.n, 'The end time is not after the start, so a one-hour slot was used.'); }
    else { const c = tbTime(s); if (c) { s = c.rest; t0 = c.time; } }
    let dur = 0; s = s.replace(/(^|\s)for\s+(\d+(?:\.\d+)?)\s*(h|hrs?|hours?|m|mins?|minutes?)(?=\s)/i, (m, pre, n, u) => { dur = Math.round(parseFloat(n) * (/^h/i.test(u) ? 60 : 1)); return pre; });
    if (t0 && !t1) t1 = tbHM(Math.min(toMin(t0) + (dur || 60), 1439));
    const title = tbClean(s).replace(/^(?:(?:from|at|on|every)\s+)+/i, '').replace(/(?:\s+(?:from|at|on|every))+$/i, '');
    if (!days.length) { W.skip(line.n, 'Needs a day, for example Mon, Mon-Fri or weekdays.'); continue; }
    if (!t0) { W.skip(line.n, 'Needs a time, for example 9:00-10:30.'); continue; }
    if (!title) { W.skip(line.n, 'Needs a title.'); continue; }
    items.push({ k: 'slot', n: line.n, title: title.slice(0, 80), days, start: t0, end: t1, color: cl.color, loc, notes: '', remind: rm.list.length ? rm.list[0] : null });
  }
  // overlaps with what is already there, or with each other (a warning only: two things at once is allowed)
  items.forEach((it, i) => {
    const hit = [...S.slots.filter(o => o.days.some(d => it.days.includes(d)) && toMin(it.start) < toMin(o.end) && toMin(it.end) > toMin(o.start)).map(o => o.title), ...items.slice(0, i).filter(o => o.days.some(d => it.days.includes(d)) && toMin(it.start) < toMin(o.end) && toMin(it.end) > toMin(o.start)).map(o => o.title)];
    if (hit.length) W.warn(it.n, `Overlaps with ${[...new Set(hit)].join(', ')}.`);
  });
  return { items, newLists: [] };
}

/* ---------- notes ---------- */
function tbParseNotes(text, ctx, W) {
  const items = []; let cur = null, fence = false;
  String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach((l, i) => {
    if (/^\s*(?:```|~~~)/.test(l)) fence = !fence;
    const h = !fence && l.match(/^#\s+(.+?)\s*$/);
    if (h) {
      const tags = [], title = h[1].replace(/(^|\s)#([\w-]+)(?=\s|$)/g, (m, pre, g) => { tags.push(g.toLowerCase()); return pre; }).trim();
      cur = { k: 'note', n: i + 1, title: title.slice(0, 200), tags: [...new Set(tags)], lines: [] }; items.push(cur); return;
    }
    if (!cur) { if (!l.trim()) return; cur = { k: 'note', n: i + 1, title: '', tags: [], lines: [] }; items.push(cur); }
    cur.lines.push(l);
  });
  const out = [];
  for (const it of items) { it.body = it.lines.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, ''); delete it.lines; if (it.title || it.body) out.push(it); }
  if (out.length > TB_MAX) { W.warn(0, `Only the first ${TB_MAX} notes were read.`); out.length = TB_MAX; }
  if (out.length && !out.some(n => n.title)) W.warn(out[0].n, 'No “# Title” line was found, so this is one note and its title comes from its first line.');
  return { items: out, newLists: [] };
}

/* ---------- habits and countdowns ---------- */
function tbParseHabits(text, ctx, W) {
  const items = [];
  for (const line of tbLines(text)) {
    if (items.length >= TB_MAX) { W.warn(line.n, `Only the first ${TB_MAX} lines were read.`); break; }
    let s = line.s; if (s.startsWith('>')) { W.warn(line.n, 'Habits have no notes, so this line was ignored.'); continue; }
    s = s.replace(/^#{1,6}\s+/, '').replace(TB_BULLET, '');
    const ic0 = tbIcon(s); s = ' ' + ic0.rest + ' ';
    const cl = tbColour(s, true); s = cl.rest.replace(/(^|\s)#([\w-]+)(?=\s)/g, (m, pre, g) => { W.warn(line.n, `“#${g}” is not a colour name, so it was ignored.`); return pre; });
    let per = 'day', n = 1, found = false;
    s = s.replace(/(^|\s)(\d{1,2})\s*(?:(?:x|×|times?|days?)\s*(?:(?:\/|a|per|each|every)\s*)?|\/\s*)(week|month|day)(?=\s|$)/i, (m, pre, k, u) => { n = +k; per = u.toLowerCase(); found = true; return pre; });
    if (!found) s = s.replace(/(^|\s)(?:every\s*day|everyday|daily|each\s+day)(?=\s|$)/i, (m, pre) => { found = true; return pre; })
      .replace(/(^|\s)(?:weekly|every\s+week|once\s+a\s+week)(?=\s|$)/i, (m, pre) => { per = 'week'; found = true; return pre; })
      .replace(/(^|\s)(?:monthly|every\s+month|once\s+a\s+month)(?=\s|$)/i, (m, pre) => { per = 'month'; found = true; return pre; });
    const max = per === 'day' ? 1 : per === 'week' ? 7 : 31;
    if (n < 1) n = 1; if (n > max) { W.warn(line.n, `A ${per === 'day' ? 'day' : per} has room for ${max}, so the goal was lowered to ${max}.`); n = max; }
    const name = tbClean(s);
    if (!name) { W.skip(line.n, 'Needs a name.'); continue; }
    items.push({ k: 'habit', n: line.n, name: name.slice(0, 80), icon: ic0.icon, color: cl.color, goal: { per, n } });
  }
  items.forEach(it => { if (S.habits.some(h => h.name.toLowerCase() === it.name.toLowerCase())) W.warn(it.n, `You already have a habit called “${it.name}”; this adds another.`); });
  return { items, newLists: [] };
}
function tbParseCountdowns(text, ctx, W) {
  const items = [];
  for (const line of tbLines(text)) {
    if (items.length >= TB_MAX) { W.warn(line.n, `Only the first ${TB_MAX} lines were read.`); break; }
    let s = line.s;
    if (s.startsWith('>')) { const last = items[items.length - 1]; if (!last) W.warn(line.n, 'A “>” note line needs a countdown above it.'); else last.note += (last.note ? '\n' : '') + s.replace(/^>\s?/, ''); continue; }
    s = s.replace(/^#{1,6}\s+/, '').replace(TB_BULLET, '');
    const ic0 = tbIcon(s); s = ' ' + ic0.rest + ' ';
    const cl = tbColour(s, false); s = cl.rest;
    const rm = tbRemind(s); s = rm.rest;
    let repeat = ''; s = s.replace(/(^|\s)(?:every\s+year|each\s+year|yearly|annual(?:ly)?)(?=\s)/i, (m, pre) => { repeat = 'year'; return pre; });
    s = tbDates(s); let time = ''; const c = tbTime(s); if (c) { s = c.rest; time = c.time; }
    const p = parseQuick(s.trim(), ctx.lists, ctx.base, {}), name = tbClean(p.due && p.title === s.trim() ? '' : p.title);
    if (!name) { W.skip(line.n, 'Needs a name.'); continue; }
    if (!p.due) { W.skip(line.n, `“${name}” needs a date, for example Dec 25 or 2026-12-25.`); continue; }
    items.push({ k: 'countdown', n: line.n, name: name.slice(0, 120), date: p.due, time, repeat, remind: rm.list, tags: p.tags, listId: p.listId || '', icon: ic0.icon, color: cl.color, note: '' });
  }
  return { items, newLists: [] };
}

/* ---------- the entry point of the parser ---------- */
function tbParse(text, kind, ctx = {}) {
  ctx = { base: ctx.base || new Date(), lists: ctx.lists || S.lists, contacts: ctx.contacts || S.contacts, subjects: ctx.subjects || (typeof scOf === 'function' ? scOf('subject') : []), listId: ctx.listId || '', home: ctx.home || '' };
  const warns = [], W = { warn: (n, msg) => warns.push({ n, msg, skip: false }), skip: (n, msg) => warns.push({ n, msg, skip: true }) };
  const r = kind === 'timetable' ? tbParseSlots(text, ctx, W) : kind === 'notes' ? tbParseNotes(text, ctx, W) : kind === 'habits' ? tbParseHabits(text, ctx, W) : kind === 'countdowns' ? tbParseCountdowns(text, ctx, W)
    : tbParseTasks(text, kind === 'calendar' || kind === 'timeline' ? kind : 'tasks', ctx, W);
  warns.sort((a, b) => a.n - b.n);
  return { kind, items: r.items, newLists: r.newLists, warns, count: r.items.length, subs: r.items.reduce((n, x) => n + (x.subs ? x.subs.length : 0), 0), skipped: warns.filter(x => x.skip).length };
}

/* ---------- writing ---------- */
function tbEnsure(path, made) { // the list at the end of a path, creating what is missing (parent first)
  let parent = '', id = null;
  for (const name of path) {
    let l = S.lists.find(x => (x.parent || '') === parent && String(x.name).toLowerCase() === name.toLowerCase());
    if (!l) { l = { id: uid(), name: name.slice(0, 80), color: COLORS[S.lists.length % COLORS.length][0], sections: [], created: Date.now(), parent: parent || null }; S.lists.push(l); made.lists.push(l.id); }
    id = l.id; parent = l.id;
  }
  return id;
}
function tbSection(listId, name, made) {
  const l = S.lists.find(x => x.id === listId); if (!l) return;
  if (!Array.isArray(l.sections)) l.sections = [];
  if (!l.sections.includes(name)) { l.sections.push(name); made.sections.push([listId, name]); }
}
function tbCommit(P, ctx = {}) {
  const made = { kind: P.kind, tasks: [], slots: [], notes: [], habits: [], countdowns: [], lists: [], sections: [] }, now = Date.now(), N = P.items.length;
  if (!N) return made;
  if (P.kind === 'timetable') {
    const colourOf = new Map(S.slots.map(x => [x.title.toLowerCase(), x.color]));
    P.items.forEach((it, i) => {
      const color = it.color || colourOf.get(it.title.toLowerCase()) || COLORS[(S.slots.length + i) % COLORS.length][0]; colourOf.set(it.title.toLowerCase(), color);
      const d = { id: uid(), title: it.title, days: [...it.days], start: it.start, end: it.end, color, loc: it.loc || '', notes: it.notes || '', remind: it.remind, created: now };
      S.slots.push(d); made.slots.push(d.id);
    });
  } else if (P.kind === 'notes') {
    P.items.forEach((it, i) => {
      const n = newNote({ title: it.title, body: it.body, tags: [...it.tags], created: now - i, updated: now - i }); if (ctx.home) { noteSetHome(n, ctx.home); n.updated = now - i; }
      S.notes.push(n); made.notes.push(n.id);
    });
  } else if (P.kind === 'habits') {
    P.items.forEach((it, i) => {
      const h = { id: uid(), name: it.name, icon: it.icon || HABIT_ICONS[(S.habits.length) % 8], color: it.color || COLORS[(S.habits.length + 5) % COLORS.length][0], goal: { ...it.goal }, created: todayStr(), log: {} };
      S.habits.push(h); made.habits.push(h.id);
    });
  } else if (P.kind === 'countdowns') {
    P.items.forEach(it => {
      const c = cdNormalise({ id: uid(), name: it.name, date: it.date, time: it.time, tz: '', icon: it.icon, color: it.color, note: it.note || '', listId: it.listId, projectId: '', tags: [...it.tags], taskId: '', repeat: it.repeat, remind: [...it.remind], archived: false, created: now });
      S.countdowns.push(c); made.countdowns.push(c.id);
    });
  } else {
    const all = S.tasks.map(x => x.order || 0), lo = Math.min(0, ...all), hi = Math.max(0, ...all), bottom = (S.settings.tasks || {}).addPos === 'bottom';
    const defList = S.settings.tasks && S.settings.tasks.defList && S.lists.some(l => l.id === S.settings.tasks.defList) ? S.settings.tasks.defList : 'inbox';
    P.items.forEach((it, i) => {
      const listId = it.listPath ? tbEnsure(it.listPath, made) : it.listId || (ctx.listId && S.lists.some(l => l.id === ctx.listId) ? ctx.listId : '') || (it.kind && typeof scWorkList === 'function' ? scWorkList() : defList);
      const t = newTask({ title: it.title, notes: it.notes || '', listId, due: it.due || null, time: it.time || null, ...(it.dur ? { dur: it.dur } : {}), priority: it.priority || 0, tags: [...it.tags], subtasks: it.subs.map(x => ({ id: uid(), title: x.title, done: x.done })), repeat: it.repeat || null, ...(it.repeat && it.until ? { until: it.until } : {}), section: it.section || null, ...(it.start ? { start: it.start } : {}), ...(it.kind ? { kind: it.kind } : {}), ...(it.subjectId ? { subjectId: it.subjectId } : {}), ...(it.contactIds.length ? { contactIds: [...it.contactIds] } : {}) });
      if (it.status === 'done') { t.status = 'done'; t.doneAt = now; } else if (it.status === 'wontdo') t.status = 'wontdo';
      if (it.rems.length && t.due) remsSet(t, it.rems);
      prefNewTask(t, null);
      t.order = bottom ? hi + 1000 * (i + 1) : lo - 1000 * (N - i); // the text's own order: the first line ends up on top (or, if new tasks go to the bottom, first of the new ones)
      if (it.section) tbSection(listId, it.section, made);
      S.tasks.push(t); made.tasks.push(t.id);
    });
  }
  save(); return made;
}
function tbUndo(made) {
  const gone = id => made.tasks.includes(id) || made.slots.includes(id) || made.notes.includes(id) || made.habits.includes(id) || made.countdowns.includes(id);
  S.tasks = S.tasks.filter(x => !gone(x.id)); S.slots = S.slots.filter(x => !gone(x.id)); S.notes = S.notes.filter(x => !gone(x.id)); S.habits = S.habits.filter(x => !gone(x.id)); S.countdowns = S.countdowns.filter(x => !gone(x.id));
  for (const [lid, name] of made.sections) { const l = S.lists.find(x => x.id === lid); if (l && Array.isArray(l.sections) && !S.tasks.some(t => t.listId === lid && t.section === name)) l.sections = l.sections.filter(x => x !== name); }
  for (const id of [...made.lists].reverse()) if (!S.tasks.some(t => t.listId === id) && !S.lists.some(l => l.parent === id)) S.lists = S.lists.filter(l => l.id !== id); // only lists nobody has used since
  save();
}
const tbCountLabel = P => { const [one, many] = TB_NOUN[P.kind]; return `${P.count} ${P.count === 1 ? one : many}`; };

/* ---------- the "copy syntax for AI" text ---------- */
const TB_DOC = {
  tasks: `One task per line, written the way you would type it into quick add:
  Title [date] [time] [!high|!medium|!low] [#tag …] [~List] [+person] [every week | every 2 days | weekdays] [until 2026-12-31] [for 90m] [remind 30m]
Dates: today, tomorrow, mon…sun, next week, in 3 days, Nov 20, 20 Nov, 2026-11-20. Times: 9am, 14:30, or a range 9:00-10:30 (the range sets the length).
Indent a line (two spaces or a tab) to make it a subtask of the line above; subtasks are plain text, "[x] " in front marks one done.
A line starting with "> " adds a note to the task above. "[x] " at the start of a task marks it done.
"# List name" puts the tasks below it in that list (created if it does not exist; "Work > Website" makes a sublist); "## Section" starts a section inside it.
Lines starting with // are ignored. Do not number the lines.`,
  calendar: `Put a date on its own line, then that day's events below it (or put the date in each line):
  Friday                       (also: Nov 24, 2026-11-24, tomorrow, Mon 16 Nov)
  9:00-10:30 Team standup #work
  12:30 Lunch with +anna for 1h
Each event: [time or time range] Title [#tag] [!high] [every week] [remind 30m] [for 45m]. A range like 9:00-10:30 sets the length. Use 24-hour times or am/pm.
Indent a line to make a subtask of the line above; "> text" adds a note. Lines starting with // are ignored.`,
  timeline: `One item per line with a start and an end:
  Title start -> end         (also "start .. end", "from Nov 2 to Nov 20", or a start and a length: "Nov 2 for 5 days" / "for 2 weeks")
A single date makes a one-day item. Add [#tag] [!high] [~List] [+person] as usual. Indent for subtasks, "> text" for a note.
"# List name" and "## Section" work as for tasks. Lines starting with // are ignored.`,
  timetable: `One weekly slot per line: days, a time range, a title, and optionally a place in brackets and a colour:
  Mon Wed 9:00-10:30 Maths (Room 4) colour:blue
Days: mon tue wed thu fri sat sun, a range like mon-fri, or weekdays / weekends / daily. Or put the days alone on a line and list the slots below it.
Colours: blue red orange green purple teal pink gray yellow olive plum steel, or #34b36b. Optional: "remind 10m". "> text" adds a note to the slot above. Lines starting with // are ignored.`,
  notes: `Start each note with a line "# Title" (tags can follow the title: "# Meeting with Anna #meeting").
Everything under it, up to the next "# " line, is the note's text and is read as Markdown (lists, **bold**, [ ] checkboxes, ## sub-headings, tables).
Do not use a single "# " for anything inside a note; use "## " or deeper.`,
  habits: `One habit per line: [emoji] Name [how often] [colour]
  How often: daily (the default), weekly, monthly, "3x week", "5 times a week", "4 per month".
  Colours: #blue #red #orange #green #purple #teal #pink #gray #yellow #olive #plum #steel. Lines starting with // are ignored.`,
  countdowns: `One countdown per line: [emoji] Name date [time] [yearly] [#tag] [remind 1d] [colour:red]
  Dates: Dec 25, 25 Dec 2026, 2026-12-25. Add "yearly" for birthdays and anniversaries. "remind 1d" / "remind 1w" / "remind 1h" can be repeated.
  "> text" adds a note to the countdown above. Lines starting with // are ignored.`,
};
const TB_EX = {
  tasks: `# Work > Website relaunch
## Design
Draft the homepage mockups fri 10:00-12:00 !high #design remind 1h
  Collect brand assets
  [x] Pick fonts
  > Ask Anna for the logo files first
Review copy tomorrow 3pm for 45m #review
## Launch
Announce on social media Dec 1 9am #marketing
Send the status email every fri 4pm until 2026-12-31 !low
# Personal
Pay rent every month Dec 1 !high`,
  calendar: `Friday
9:00-10:30 Team standup #work
12:30 Lunch with the team for 1h
Dentist 2pm remind 1d
Nov 24
Project review 10-11am !high
  Prepare the slides
  > Bring the printed report`,
  timeline: `# Website relaunch
Design phase Nov 2 -> Nov 20 #design
Build from Nov 23 to Jan 15 !high
  Set up the repo
  Build the pages
Testing Jan 18 for 5 days
Launch Jan 25`,
  timetable: `Mon Wed 9:00-10:30 Maths (Room 4) colour:blue
Mon-Fri 8:15-8:30 Registration
Tue 14:00-15:30 Chemistry lab (Lab 2) #green remind 10m
Thu
11:00-12:00 English (Room 7)
> Bring the reading book`,
  notes: `# Meeting with Anna #meeting
Agenda
- Budget for next year
- [ ] Send the notes afterwards

# Packing list #travel
- [ ] Passport
- [ ] Charger`,
  habits: `💧 Drink water daily
🏃 Run 3x week #green
📚 Read 20 pages 5 times a week
Call family weekly`,
  countdowns: `🎂 Anna's birthday Mar 12 yearly #anna remind 1d
Product launch 2026-12-01 9:00 remind 1w
Summer holiday Aug 3 #travel
> Flights are booked`,
};
function tbPrompt(kind) {
  const [, many] = TB_NOUN[kind], now = new Date(), cap = s => s[0].toUpperCase() + s.slice(1);
  const names = kind === 'notes' || kind === 'timetable' || kind === 'habits' ? [] : S.lists.filter(l => l.id !== 'inbox').map(l => listLabel(l.id).replace(/ › /g, ' > ')).slice(0, 40);
  return `I use the app OpenTick. Turn my request into ${many} in OpenTick's “Add from text” format.

Reply with ONLY the text to paste, in one code block, with no explanation before or after it.
Today is ${cap(TB_WD[now.getDay()])} ${ymd(now)}. Prefer real dates (2026-11-20 or Nov 20) over vague words.${names.length ? `\nMy lists: Inbox, ${names.join(', ')}. Use "# List name" lines only for these or for new lists I ask for.` : ''}

FORMAT
${TB_DOC[kind]}

EXAMPLE
${TB_EX[kind]}

MY REQUEST
(describe what you want here)
`;
}

/* ---------- the dialog ---------- */
const tbKindHere = () => (U.page === 'timetable' ? (typeof schoolOn === 'function' && schoolOn() ? 'calendar' : 'timetable') : TB_PAGE[U.page] || 'tasks');
function tbItemHtml(it) {
  const c = (t, cls) => `<span class="atx-c${cls ? ' ' + cls : ''}">${esc(t)}</span>`;
  const when = d => fmtDate(d);
  let title = '', chips = [];
  if (it.k === 'task') {
    title = it.title;
    if (it.start && it.due && it.start !== it.due) chips.push(c(`${when(it.start)} → ${when(it.due)}`, 'd')); else if (it.due) chips.push(c(when(it.due) + (it.time ? ' ' + fmtTime(it.time) : '') + (it.dur ? ' · ' + fmtDur(it.dur) : ''), 'd'));
    if (it.priority) chips.push(c(['', 'Low', 'Medium', 'High'][it.priority], 'p' + it.priority));
    it.tags.forEach(g => chips.push(c('#' + g)));
    if (it.listPath) chips.push(c(it.listPath.join(' › '), 'l')); else if (it.listId) chips.push(c(listLabel(it.listId), 'l'));
    if (it.section) chips.push(c(it.section));
    if (it.repeat) chips.push(c('↻ ' + tbRep(it.repeat)));
    if (it.rems.length) chips.push(c('⏰ ' + it.rems.map(m => remLabel(m).replace(' before', '')).join(', ')));
    it.contactIds.forEach(id => { const p = S.contacts.find(x => x.id === id); if (p) chips.push(c('+' + p.name)); });
    if (it.notes) chips.push(c('note')); if (it.status === 'done') chips.push(c('done', 'ok')); if (it.status === 'wontdo') chips.push(c('won’t do'));
  } else if (it.k === 'slot') {
    title = it.title; chips.push(c(tbDayNames(it.days), 'd'), c(`${fmtTime(it.start)}–${fmtTime(it.end)}`, 'd')); if (it.loc) chips.push(c(it.loc, 'l')); if (it.notes) chips.push(c('note')); if (it.remind != null) chips.push(c('⏰ ' + remLabel(it.remind).replace(' before', '')));
  } else if (it.k === 'note') {
    title = it.title || noteTitle({ title: '', body: it.body }); chips.push(c(`${it.body ? it.body.split('\n').length : 0} line${it.body.split('\n').length === 1 ? '' : 's'}`)); it.tags.forEach(g => chips.push(c('#' + g)));
  } else if (it.k === 'habit') {
    title = (it.icon ? it.icon + ' ' : '') + it.name; chips.push(c(habitGoalLabel(it.goal), 'd'));
  } else {
    title = (it.icon ? it.icon + ' ' : '') + it.name; chips.push(c(fmtDate(it.date) + (it.time ? ' ' + fmtTime(it.time) : ''), 'd')); if (it.repeat) chips.push(c('↻ every year')); it.tags.forEach(g => chips.push(c('#' + g)));
    if (it.remind.length) chips.push(c('⏰ ' + it.remind.map(m => (m === 0 ? 'on time' : remLabel(m).replace(' before', ''))).join(', '))); if (it.listId) chips.push(c(listLabel(it.listId), 'l'));
  }
  const dot = it.color ? `<i class="atx-dot" style="background:${esc(it.color)}"></i>` : '';
  return `<div class="atx-r"><span class="atx-t">${dot}${esc(title)}</span><span class="atx-m">${chips.join('')}</span></div>${(it.subs || []).map(x => `<div class="atx-r atx-s"><span class="atx-t">↳ ${x.done ? '✓ ' : ''}${esc(x.title)}</span></div>`).join('')}`;
}
function tbPreviewHtml(P) {
  if (!P.count && !P.warns.length) return '<p class="hint">Nothing yet. Type or paste one per line, or press <b>Example</b> to see the format.</p>';
  const bits = [tbCountLabel(P)]; if (P.subs) bits.push(`${P.subs} subtask${P.subs === 1 ? '' : 's'}`); if (P.newLists.length) bits.push(`${P.newLists.length} new list${P.newLists.length === 1 ? '' : 's'}`);
  const rows = P.items.slice(0, 60).map(tbItemHtml).join('') + (P.items.length > 60 ? `<p class="hint">…and ${P.items.length - 60} more.</p>` : '');
  const lists = P.newLists.length ? `<p class="hint atx-nl">${ic('plus', 13)} New: ${P.newLists.map(p => esc(p.join(' › '))).join(', ')}</p>` : '';
  const warns = P.warns.length ? `<ul class="atx-w">${P.warns.slice(0, 30).map(w => `<li class="${w.skip ? 'skip' : ''}"><b>${w.n ? 'Line ' + w.n : 'Note'}${w.skip ? ' (skipped)' : ''}:</b> ${esc(w.msg)}</li>`).join('')}${P.warns.length > 30 ? `<li>…and ${P.warns.length - 30} more.</li>` : ''}</ul>` : '';
  return `${P.count ? `<div class="atx-sum">${esc(bits.join(' · '))}</div>` : ''}${rows}${lists}${warns}`;
}
function tbHere() { // where the box starts: the list you are looking at, the notes folder you are in
  const st = U.tb; st.listId = U.page === 'tasks' && /^list:/.test(U.nav || '') && S.lists.some(l => l.id === U.nav.slice(5)) ? U.nav.slice(5) : '';
  const sc = typeof noteScope === 'function' ? noteScope() : ''; st.home = sc.startsWith('list:') ? 'l:' + sc.slice(5) : sc.startsWith('project:') ? 'p:' + sc.slice(8) : '';
}
function tbOpen(kind, text) {
  U.tb = U.tb || { kind: 'tasks', text: {}, listId: '', home: '' };
  U.tb.kind = TB_KINDS.some(k => k[0] === kind) ? kind : tbKindHere(); if (text != null) U.tb.text[U.tb.kind] = text;
  tbHere(); tbShow();
}
function tbShow() {
  const st = U.tb, k = st.kind, [one, many] = TB_NOUN[k], isNote = k === 'notes', hasDest = ['tasks', 'calendar', 'timeline'].includes(k) || isNote;
  const defList = S.settings.tasks && S.settings.tasks.defList && S.lists.some(l => l.id === S.settings.tasks.defList) ? S.settings.tasks.defList : 'inbox';
  const destSel = !hasDest ? '' : isNote
    ? `<label class="atx-dest">Add to <select id="atx-dest" aria-label="Where the notes go">${opts([['', 'Not in a list or project'], ...listOpts().filter(([v]) => v !== 'inbox').map(([v, n]) => ['l:' + v, n]), ...S.projects.map(p => ['p:' + p.id, 'Project: ' + p.name])], st.home)}</select></label>`
    : `<label class="atx-dest">Add to <select id="atx-dest" aria-label="Which list">${opts([['', 'Default list (' + listLabel(defList) + ')'], ...listOpts()], st.listId)}</select></label>`;
  const hint = { tasks: 'One task per line. Dates, #tags, !priority, subtasks (indent) and “# List” headings work.', calendar: 'A date on its own line, then that day’s events with their times.', timeline: 'Title, then start -> end.', timetable: 'Days, a time range and a title: Mon Wed 9:00-10:30 Maths.', notes: 'Start each note with “# Title”; the rest is its text.', habits: 'One per line: Run 3x week, Drink water daily.', countdowns: 'Name and date: Holiday Aug 3, Birthday Mar 12 yearly.' }[k];
  openModal(`<h3>${ic('clipboard', 18)} Add from text</h3>
<div class="seg atx-seg" role="tablist" aria-label="What to add">${TB_KINDS.map(([id, n, i]) => `<button type="button" role="tab" data-tbk="${id}" class="${id === k ? 'on' : ''}" aria-selected="${id === k}">${ic(i, 14)}<span>${n}</span></button>`).join('')}</div>
<p class="hint atx-hint">${esc(hint)}</p>
<textarea id="atx-ta" class="atx-ta" rows="7" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Text to add" placeholder="${esc(TB_EX[k].split('\n').slice(0, 3).join('\n'))}">${esc(st.text[k] || '')}</textarea>
${destSel ? `<div class="atx-row">${destSel}</div>` : ''}
<div class="atx-prev" id="atx-prev" aria-live="polite"></div>
<details class="atx-help"><summary>Syntax for ${many}</summary><pre>${esc(TB_DOC[k])}</pre></details>
<div class="mact"><button type="button" data-m="ex" title="Put an example in the box">Example</button><button type="button" data-m="ai" title="Copy a prompt you can paste into an AI chat. It includes the format, today’s date${['tasks', 'calendar', 'timeline', 'countdowns'].includes(k) ? ' and your list names' : ''}.">Copy syntax for AI</button><span class="sp"></span><button type="button" data-m="no">Cancel</button><button type="button" class="pri" id="atx-ok" data-m="ok" disabled>Add</button></div>`, m => {
    const ta = $('#atx-ta', m), ok = $('#atx-ok', m), prev = $('#atx-prev', m), ctx = () => ({ listId: st.listId || '', home: st.home || '' });
    let timer = 0;
    const paint = () => { st.text[k] = ta.value; const P = tbParse(ta.value, k, ctx()); prev.innerHTML = tbPreviewHtml(P); ok.disabled = !P.count; ok.textContent = P.count ? 'Add ' + tbCountLabel(P) : 'Add'; return P; };
    ta.oninput = () => { clearTimeout(timer); timer = setTimeout(paint, 120); };
    m.onchange = e => { if (e.target.id === 'atx-dest') { if (isNote) st.home = e.target.value; else st.listId = e.target.value; paint(); } };
    m.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target === ta) { e.preventDefault(); ok.click(); } };
    m.onclick = async e => {
      const tab = e.target.closest('[data-tbk]'), b = e.target.closest('[data-m]');
      if (tab) { st.text[k] = ta.value; st.kind = tab.dataset.tbk; tbShow(); return; }
      if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      const a = b.dataset.m;
      if (a === 'no') closeModal();
      else if (a === 'ex') { ta.value = ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n\n' + TB_EX[k] : TB_EX[k]; paint(); ta.focus(); }
      else if (a === 'ai') {
        const txt = tbPrompt(k);
        try { await navigator.clipboard.writeText(txt); toast('Copied. Paste it into an AI chat, then paste the answer here.'); }
        catch (x) { ta.value = txt; ta.select(); toast('Select and copy the text in the box'); }
      } else if (a === 'ok') {
        const P = tbParse(ta.value, k, ctx()); if (!P.count) return;
        const made = tbCommit(P, ctx()); st.text[k] = ''; closeModal(); sfx('add'); refresh();
        toast(`Added ${tbCountLabel(P)}${P.skipped ? ` (${P.skipped} line${P.skipped === 1 ? '' : 's'} skipped)` : ''}`, { label: 'Undo', fn: () => { tbUndo(made); refresh(); toast('Undone'); } });
      }
    };
    paint(); ta.focus();
  }, 'atx');
}
function tbTool() { // the button in a page's header
  if (!(U.page in TB_PAGE) && U.page !== 'timetable') return '';
  return `<button class="ib" data-act="tbopen" title="Add several from text…  (Shift+A)" aria-label="Add several from text">${ic('clipboard')}</button>`;
}
const TB_ACT = { tbopen: () => tbOpen() };
// pasting several lines into the quick-add box offers them to this box instead of squashing them into one task
if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
  document.addEventListener('paste', e => {
    const t = e.target; if (!t || t.id !== 'add') return;
    const txt = (e.clipboardData && e.clipboardData.getData && e.clipboardData.getData('text')) || '';
    if (txt.split(/\r?\n/).filter(l => l.trim()).length < 2) return;
    e.preventDefault(); tbOpen('tasks', txt);
  });
}
