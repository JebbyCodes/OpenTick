/* OpenTick import: bring tasks in from other apps.
   Every parser turns the files it is given into one neutral "draft": lists (a path such as ['Work', 'Backend'] means the
   list Backend inside Work), tasks (with subtasks) and notes. importApply() then turns a draft into real lists and tasks.
   ZIP files are opened too, so an export can be dropped in as downloaded.
   The formats are written from each app's documented export; where an app changes its export, a parser may need a tweak. */

/* ---------- small helpers ---------- */
const stripBom = s => String(s || '').replace(/^\uFEFF/, '');
const baseName = n => String(n || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
const MONTH_IDX = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function csvParse(text, delim) {
  text = stripBom(text);
  if (!delim) { const first = text.split(/\r?\n/, 1)[0] || '', n = c => first.split(c).length; delim = n('\t') > n(',') && n('\t') > n(';') ? '\t' : n(';') > n(',') ? ';' : ','; }
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
// header row -> objects keyed by lower-cased column name
function csvObjects(rows, headerAt = 0) {
  const head = rows[headerAt].map(h => String(h).trim().toLowerCase());
  return rows.slice(headerAt + 1).map(r => { const o = {}; head.forEach((h, i) => { if (h && o[h] === undefined) o[h] = (r[i] || '').trim(); }); return o; });
}

// a moment -> local date and time, or the date and time as seen in `tz` (an IANA zone name)
function partsIn(dt, tz) {
  const p2 = n => String(n).padStart(2, '0');
  if (tz) {
    try {
      const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(dt), g = t => (f.find(x => x.type === t) || {}).value;
      return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
    } catch (e) { /* unknown zone: fall back to local time */ }
  }
  return { date: `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`, time: `${p2(dt.getHours())}:${p2(dt.getMinutes())}` };
}
function parseWhen(s, tz) {
  s = String(s || '').trim(); if (!s) return null;
  const p2 = n => String(n).padStart(2, '0'); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)) || (m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: null };
  if ((m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})[T ](\d{2}):?(\d{2})(?::?(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/))) {
    const [, y, mo, d, h, mi, se, z] = m;
    if (!z) return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` }; // no zone: the clock time as written
    const zone = z === 'Z' ? 'Z' : z.includes(':') ? z : z.slice(0, 3) + ':' + z.slice(3), dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${se || '00'}${zone}`);
    return isNaN(dt) ? null : partsIn(dt, tz);
  }
  const mon = x => MONTH_IDX[String(x).slice(0, 3).toLowerCase()];
  if ((m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})/)) && mon(m[1])) return { date: `${m[3]}-${p2(mon(m[1]))}-${p2(m[2])}`, time: null };
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]{3,9})\.?,? (\d{4})/)) && mon(m[2])) return { date: `${m[3]}-${p2(mon(m[2]))}-${p2(m[1])}`, time: null };
  if ((m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/))) { const a = +m[1], b = +m[2]; const [d, mo] = b > 12 ? [b, a] : [a, b]; return { date: `${m[3]}-${p2(mo)}-${p2(d)}`, time: null }; }
  return null;
}
const stampOf = (s, tz) => { const w = parseWhen(s, tz); if (w) { const d = new Date(`${w.date}T${w.time || '00:00'}:00`); if (!isNaN(d)) return d.getTime(); } const d = new Date(s); return isNaN(d) ? null : d.getTime(); };

// "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE" -> { every, unit, days }
function rruleToRepeat(r) {
  const o = {}; String(r || '').replace(/^RRULE:/i, '').split(';').forEach(p => { const [k, v] = p.split('='); if (k) o[k.toUpperCase()] = v; });
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[o.FREQ]; if (!unit) return null;
  const rep = { every: Math.max(1, +o.INTERVAL || 1), unit };
  if (unit === 'week' && o.BYDAY) { const d = o.BYDAY.split(',').map(x => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(x.slice(-2))).filter(x => x >= 0); if (d.length) rep.days = d; }
  return rep;
}
// "every 2 weeks", "every Monday and Friday", "every weekday", "daily"
function repeatFromText(s) {
  s = String(s || '').toLowerCase().replace(/^every!?\s+/, 'every ').trim(); let m;
  if (/^(daily|every day)$/.test(s)) return { every: 1, unit: 'day' };
  if (/^(weekly|every week)$/.test(s)) return { every: 1, unit: 'week' };
  if (/^(monthly|every month)$/.test(s)) return { every: 1, unit: 'month' };
  if (/^(yearly|annually|every year)$/.test(s)) return { every: 1, unit: 'year' };
  if (/^every (work)?weekdays?/.test(s)) return { every: 1, unit: 'week', days: [1, 2, 3, 4, 5] };
  if ((m = s.match(/^every (\d+) (day|week|month|year)s?$/))) return { every: +m[1], unit: m[2] };
  const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  if (/^every /.test(s)) { const d = names.map((n, i) => (new RegExp('\\b' + n).test(s) ? i : -1)).filter(i => i >= 0); if (d.length) return { every: 1, unit: 'week', days: d }; }
  return null;
}

/* ---------- the draft ---------- */
function newDraft() {
  const lists = new Map();
  return {
    lists, notes: [], warn: [],
    list(path) { const p = (path && path.length ? path : ['Imported']).map(x => String(x || '').trim()).filter(Boolean), k = p.join('\u0001'); if (!lists.has(k)) lists.set(k, { path: p, tasks: [] }); return lists.get(k); },
    add(path, t) {
      const x = { title: '', notes: '', due: null, time: null, priority: 0, tags: [], status: 'open', repeat: null, subtasks: [], section: null, ...t };
      x.title = String(x.title || '').trim(); if (!x.title) return null;
      x.tags = [...new Set((x.tags || []).map(g => String(g).trim().replace(/^#/, '').replace(/\s+/g, '-')).filter(Boolean))];
      this.list(path).tasks.push(x); return x;
    },
  };
}
const draftCounts = D => { let tasks = 0, subs = 0; for (const l of D.lists.values()) for (const t of l.tasks) { tasks++; subs += t.subtasks.length; } return { lists: [...D.lists.values()].filter(l => l.tasks.length).length, tasks, subs, notes: D.notes.length }; };

/* ---------- ZIP (stored or deflated entries) ---------- */
async function unzipEntries(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Not a readable ZIP file');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true); const out = [], dec = new TextDecoder();
  for (let i = 0; i < n && v.getUint32(p, true) === 0x02014b50; i++) {
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (name.endsWith('/') || /__MACOSX\//.test(name) || !/\.(json|csv|md|markdown|txt|ics|opml|xml)$/i.test(name)) continue;
    const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = u8.subarray(start, start + csize);
    let bytes;
    if (method === 0) bytes = data;
    else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else continue;
    out.push({ name, text: dec.decode(bytes) });
    if (out.length >= 5000) break;
  }
  return out;
}
// File objects (or { name, text }) -> [{ name, text }], opening ZIPs
async function readImportFiles(list) {
  const out = [];
  for (const f of list) {
    if (typeof f.text === 'string') { out.push({ name: f.name, text: f.text }); continue; }
    if (/\.zip$/i.test(f.name)) out.push(...await unzipEntries(await f.arrayBuffer()));
    else out.push({ name: f.name, text: await f.text() });
  }
  return out;
}

/* ---------- TickTick (Settings → Account → Generate backup: a CSV) ---------- */
function parseTickTick(files) {
  const D = newDraft();
  for (const f of files) {
    const rows = csvParse(f.text), hi = rows.findIndex(r => r.includes('Folder Name') && r.includes('Title')); if (hi < 0) continue;
    const items = csvObjects(rows, hi), byId = new Map(), top = [];
    for (const o of items) {
      const tz = o.timezone || undefined, allDay = /^true$/i.test(o['is all day']), kind = (o.kind || 'TEXT').toUpperCase();
      const path = [o['folder name'], o['list name']].map(x => (x || '').trim()).filter(Boolean);
      if (kind === 'NOTE') { if (o.title || o.content) D.notes.push({ title: o.title, body: o.content }); continue; }
      const st = parseWhen(o['start date'], tz), du = parseWhen(o['due date'], tz), due = du || st, pr = { 0: 0, 1: 1, 3: 2, 5: 3 }[+o.priority] || 0;
      let notes = o.content || '', subtasks = [];
      if (/^y/i.test(o['is check list'])) { subtasks = notes.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => ({ title: l.replace(/^[▫▪\-*]\s*(\[[ xX]\])?\s*/, ''), done: /^(▪|- \[x\])/i.test(l) })); notes = ''; }
      const t = { title: o.title, notes, due: due ? due.date : null, time: !allDay && du && du.time && du.time !== '00:00' ? du.time : null, priority: pr, tags: (o.tags || '').split(',').map(x => x.trim()).filter(Boolean), status: +o.status === 0 || o.status === '' ? 'open' : 'done', repeat: rruleToRepeat(/RRULE:|FREQ=/i.test(o.repeat) ? o.repeat.replace(/^.*?(FREQ=)/i, '$1') : ''), subtasks, section: o['column name'] || null, created: stampOf(o['created time'], tz), doneAt: stampOf(o['completed time'], tz), start: st && du && st.date < du.date ? st.date : null };
      const pid = o.parentid || o['parent id'];
      if (pid) { top.push({ pid, t, path }); } else { const x = D.add(path.length ? path : ['TickTick'], t); if (x && o.taskid) byId.set(o.taskid, x); }
    }
    for (const { pid, t, path } of top) { const parent = byId.get(pid); if (parent) parent.subtasks.push({ title: t.title, done: t.status === 'done' }); else D.add(path.length ? path : ['TickTick'], t); }
  }
  return D;
}

/* ---------- Todoist (project menu → Export as CSV) ---------- */
function parseTodoist(files) {
  const D = newDraft();
  for (const f of files) {
    const rows = csvParse(f.text); if (!rows.length) continue;
    const items = csvObjects(rows), list = [baseName(f.name).replace(/\s*[-–]\s*\d{4}-\d{2}-\d{2}.*$/, '') || 'Todoist']; let section = null, last = null, lastTop = null;
    for (const o of items) {
      const type = (o.type || '').toLowerCase();
      if (type === 'section') { section = o.content || null; continue; }
      if (type === 'note') { if (last) last.notes = (last.notes ? last.notes + '\n\n' : '') + (o.content || ''); continue; }
      if (type && type !== 'task') continue;
      const pr = { 1: 3, 2: 2, 3: 1, 4: 0 }[+o.priority] || 0, ds = (o.date || '').trim(), when = parseWhen(ds), rep = /^every|daily|weekly|monthly|yearly/i.test(ds) ? repeatFromText(ds.replace(/\s+(at|starting|from|until|for)\b.*$/i, '')) : null;
      const indent = +o.indent || 1;
      if (indent > 1 && lastTop) { lastTop.subtasks.push({ title: o.content, done: false }); continue; }
      last = lastTop = D.add(list, { title: o.content, notes: [o.description, ds && !when && !rep ? `Due: ${ds}` : ''].filter(Boolean).join('\n\n'), priority: pr, due: when ? when.date : null, time: when ? when.time : null, repeat: rep, section });
      if (last && rep && !last.due) last.due = ymd(new Date());
    }
  }
  return D;
}

/* ---------- Google Tasks (Google Takeout → Tasks → Tasks.json) ---------- */
function parseGoogleTasks(files) {
  const D = newDraft();
  for (const f of files) {
    let j; try { j = JSON.parse(stripBom(f.text)); } catch (e) { continue; }
    const lists = j.kind === 'tasks#taskLists' || Array.isArray(j.items) && j.items.some(x => Array.isArray(x.items)) ? j.items : j.kind === 'tasks#tasks' ? [{ title: baseName(f.name), items: j.items }] : [];
    for (const l of lists) {
      const path = [l.title || 'Google Tasks'], byId = new Map(), later = [];
      for (const t of l.items || []) {
        const x = { title: t.title, notes: t.notes || '', status: t.status === 'completed' ? 'done' : 'open', due: t.due ? String(t.due).slice(0, 10) : null, doneAt: t.completed ? stampOf(t.completed) : null, created: t.updated ? stampOf(t.updated) : null };
        if (t.parent) later.push([t, x]); else { const d = D.add(path, x); if (d) byId.set(t.id, d); }
      }
      for (const [t, x] of later) { const p = byId.get(t.parent); if (p) p.subtasks.push({ title: x.title, done: x.status === 'done' }); else D.add(path, x); }
    }
  }
  return D;
}

/* ---------- Trello (board menu → Print and export → Export as JSON) ---------- */
function parseTrello(files) {
  const D = newDraft();
  for (const f of files) {
    let b; try { b = JSON.parse(stripBom(f.text)); } catch (e) { continue; }
    if (!Array.isArray(b.lists) || !Array.isArray(b.cards)) continue;
    const board = b.name || 'Trello', lists = b.lists.filter(l => !l.closed).sort((x, y) => (x.pos || 0) - (y.pos || 0)), items = new Map();
    for (const c of b.checklists || []) { const a = items.get(c.idCard) || []; a.push(...(c.checkItems || []).sort((x, y) => (x.pos || 0) - (y.pos || 0)).map(i => ({ title: i.name, done: i.state === 'complete' }))); items.set(c.idCard, a); }
    for (const l of lists) {
      D.list([board, l.name]);
      for (const c of b.cards.filter(c => c.idList === l.id && !c.closed).sort((x, y) => (x.pos || 0) - (y.pos || 0))) {
        const w = c.due ? parseWhen(c.due) : null;
        D.add([board, l.name], { title: c.name, notes: [c.desc, c.shortUrl ? `Trello: ${c.shortUrl}` : ''].filter(Boolean).join('\n\n'), due: w ? w.date : null, time: w ? w.time : null, status: c.dueComplete ? 'done' : 'open', tags: (c.labels || []).map(x => x.name || x.color), subtasks: items.get(c.id) || [] });
      }
    }
  }
  return D;
}

/* ---------- Taskwarrior (`task export` → JSON) ---------- */
function parseTaskwarrior(files) {
  const D = newDraft();
  for (const f of files) {
    let a; const txt = stripBom(f.text).trim();
    try { a = JSON.parse(txt); } catch (e) { a = txt.split(/\r?\n/).map(l => { try { return JSON.parse(l); } catch (x) { return null; } }).filter(Boolean); }
    for (const t of Array.isArray(a) ? a : [a]) {
      if (!t || !t.description || /^(deleted|recurring)$/.test(t.status)) continue;
      const w = t.due ? parseWhen(t.due) : null;
      D.add(t.project ? String(t.project).split('.') : ['Taskwarrior'], { title: t.description, notes: (t.annotations || []).map(x => x.description).join('\n'), due: w ? w.date : null, time: w && w.time !== '00:00' ? w.time : null, priority: { H: 3, M: 2, L: 1 }[t.priority] || 0, tags: t.tags || [], status: t.status === 'completed' ? 'done' : 'open', created: t.entry ? stampOf(t.entry) : null, doneAt: t.end ? stampOf(t.end) : null });
    }
  }
  return D;
}

/* ---------- todo.txt ---------- */
function parseTodoTxt(files) {
  const D = newDraft();
  for (const f of files) {
    const name = baseName(f.name) || 'todo';
    for (let line of stripBom(f.text).split(/\r?\n/)) {
      line = line.trim(); if (!line) continue;
      let done = false, pr = 0, doneAt = null, created = null; const dr = /^\d{4}-\d{2}-\d{2}$/;
      if (/^x\s/.test(line)) { done = true; line = line.slice(2).trim(); const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+/); if (m) { doneAt = stampOf(m[1]); line = line.slice(m[0].length); } }
      const pm = line.match(/^\(([A-Z])\)\s+/); if (pm) { pr = { A: 3, B: 2, C: 1 }[pm[1]] || 0; line = line.slice(pm[0].length); }
      const cm = line.match(/^(\d{4}-\d{2}-\d{2})\s+/); if (cm) { created = stampOf(cm[1]); line = line.slice(cm[0].length); }
      const tags = [], projects = []; let due = null;
      const title = line.split(/\s+/).filter(tok => {
        let m;
        if ((m = tok.match(/^\+(\S+)/))) { projects.push(m[1]); return false; }
        if ((m = tok.match(/^@(\S+)/))) { tags.push(m[1]); return false; }
        if ((m = tok.match(/^([A-Za-z]+):(\S+)$/)) && !/^https?$/i.test(m[1])) { if (m[1] === 'due' && dr.test(m[2])) due = m[2]; return false; }
        return true;
      }).join(' ');
      D.add(projects.length ? [projects[0].replace(/_/g, ' ')] : [name], { title, priority: pr, due, tags, status: done ? 'done' : 'open', doneAt, created });
    }
  }
  return D;
}

/* ---------- iCalendar (.ics): to-dos (Apple Reminders, Thunderbird, …) and events ---------- */
function parseIcs(files) {
  const D = newDraft(), unesc = v => String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  for (const f of files) {
    const lines = stripBom(f.text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/); let cal = baseName(f.name), cur = null, alarm = false;
    for (const raw of lines) {
      const c = raw.indexOf(':'); if (c < 0) continue;
      const [name, ...params] = raw.slice(0, c).split(';'), key = name.toUpperCase(), val = raw.slice(c + 1);
      if (key === 'X-WR-CALNAME') cal = unesc(val);
      else if (key === 'BEGIN' && /^VALARM$/i.test(val)) alarm = true;
      else if (key === 'END' && /^VALARM$/i.test(val)) alarm = false;
      else if (alarm) continue;
      else if (key === 'BEGIN' && /^(VTODO|VEVENT)$/i.test(val)) cur = { type: val.toUpperCase(), p: {}, tz: {} };
      else if (key === 'END' && cur && cur.type === val.toUpperCase()) {
        const p = cur.p, ev = cur.type === 'VEVENT', st = parseWhen(p.DTSTART), du = parseWhen(p.DUE) || (ev ? st : null), en = ev ? parseWhen(p.DTEND) : null, when = du || st;
        let dur = null; if (ev && st && en && st.time && en.time && st.date === en.date) dur = Math.max(5, toMin(en.time) - toMin(st.time));
        const pri = +p.PRIORITY || 0, status = String(p.STATUS || '').toUpperCase();
        D.add([cal], { title: unesc(p.SUMMARY), notes: unesc(p.DESCRIPTION), due: when ? when.date : null, time: when && when.time ? when.time : null, dur, priority: pri >= 1 && pri <= 4 ? 3 : pri === 5 ? 2 : pri >= 6 ? 1 : 0, tags: String(p.CATEGORIES || '').split(',').map(x => unesc(x).trim()).filter(Boolean), status: status === 'COMPLETED' || +p['PERCENT-COMPLETE'] === 100 ? 'done' : status === 'CANCELLED' ? 'wontdo' : 'open', repeat: p.RRULE ? rruleToRepeat(p.RRULE) : null, doneAt: p.COMPLETED ? stampOf(p.COMPLETED) : null });
        cur = null;
      } else if (cur && !(key in cur.p)) cur.p[key] = val;
    }
  }
  return D;
}

/* ---------- OPML (Workflowy, Dynalist, Checkvist, …): top-level items become lists ---------- */
function parseOpml(files) {
  const D = newDraft(), dec = s => String(s || '').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  for (const f of files) {
    const tops = [], re = /<outline\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<\/outline\s*>/gi; let m, depth = 0, listName = null, task = null; const fallback = baseName(f.name) || 'OPML';
    while ((m = re.exec(f.text))) {
      if (m[0][1] === '/') { depth--; if (depth <= 1) task = null; if (depth <= 0) listName = null; continue; }
      const at = {}; String(m[1] || '').replace(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (x, k, v, a, b) => { at[k] = dec(a != null ? a : b); });
      const text = at.text || at.title || '', done = /^(true|yes)$/i.test(at._complete || '');
      if (depth === 0) { listName = text || fallback; D.list([listName]); task = null; tops.push({ title: text, notes: at._note || '', status: done ? 'done' : 'open' }); }
      else if (depth === 1) task = D.add([listName || fallback], { title: text, notes: at._note || '', status: done ? 'done' : 'open' });
      else if (task) task.subtasks.push({ title: text, done });
      if (!m[2]) depth++;
    }
    // an outline with no nesting at all is just a list of tasks; otherwise drop the empty lists made for childless top-level items
    if (![...D.lists.values()].some(l => l.tasks.length)) { D.lists.clear(); tops.forEach(t => D.add([fallback], t)); }
    else for (const [k, l] of [...D.lists]) if (!l.tasks.length) D.lists.delete(k);
  }
  return D;
}

/* ---------- Markdown: Obsidian (Tasks plugin), Logseq, Anytype exports, plain checklists ---------- */
function mdTaskFields(text) {
  let title = text, due = null, start = null, doneAt = null, repeat = null, pr = 0; const tags = [];
  const take = (re, fn) => { title = title.replace(re, (...a) => { fn(...a); return ''; }); };
  take(/📅\s*(\d{4}-\d{2}-\d{2})/, (m, d) => { due = d; });
  take(/\[due::\s*(\d{4}-\d{2}-\d{2})\]/i, (m, d) => { due = d; });
  take(/⏳\s*(\d{4}-\d{2}-\d{2})/, (m, d) => { if (!due) due = d; });
  take(/🛫\s*(\d{4}-\d{2}-\d{2})/, (m, d) => { start = d; });
  take(/✅\s*(\d{4}-\d{2}-\d{2})/, (m, d) => { doneAt = stampOf(d); });
  take(/➕\s*\d{4}-\d{2}-\d{2}/, () => {});
  take(/🔁\s*([^📅⏳🛫✅➕⏫🔼🔽🔺⏬#]+)/, (m, r) => { repeat = repeatFromText(r.trim()); });
  take(/🆔\s*\S+|⛔\s*\S+/g, () => {});
  take(/[⏫🔺]/, () => { pr = 3; }); take(/🔼/, () => { pr = 2; }); take(/🔽/, () => { pr = 1; }); take(/⏬/, () => { pr = 0; });
  take(/(^|\s)#([\w/-]+)/g, (m, sp, g) => { tags.push(g); });
  return { title: title.replace(/\s{2,}/g, ' ').trim(), due, start, doneAt, repeat, priority: pr, tags };
}
function parseMarkdown(files, o = {}) {
  const D = newDraft();
  for (const f of files) {
    let text = stripBom(f.text).replace(/\r\n?/g, '\n'), fm = {};
    const m = text.match(/^---\n([\s\S]*?)\n---\n?/); if (m) { text = text.slice(m[0].length); m[1].split('\n').forEach(l => { const k = l.match(/^([\w ]+):\s*(.*)$/); if (k) fm[k[1].trim().toLowerCase()] = k[2].trim().replace(/^["']|["']$/g, ''); }); }
    const lines = text.split('\n'), name = fm.title || baseName(f.name), path = [name]; let section = null, top = null, topIndent = 0, found = 0;
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]; let h, cb = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX/\-])\]\s+(.*)$/), lg = !cb && line.match(/^(\s*)(?:[-*+]\s+)?(TODO|DOING|NOW|LATER|WAITING|DONE|CANCELED|CANCELLED)\s+(.*)$/);
      if ((h = line.match(heading)) && !cb) { section = h[1].trim(); continue; }
      if (!cb && !lg) continue;
      const indent = (cb ? cb[1] : lg[1]).replace(/\t/g, '    ').length, status = cb ? (/[xX]/.test(cb[2]) ? 'done' : cb[2] === '-' ? 'wontdo' : 'open') : /^(DONE)$/.test(lg[2]) ? 'done' : /^CANCEL/.test(lg[2]) ? 'wontdo' : 'open';
      const fields = mdTaskFields(cb ? cb[3] : lg[3]);
      if (top && indent > topIndent) { top.subtasks.push({ title: fields.title, done: status === 'done' }); continue; }
      let due = fields.due; // Logseq keeps dates on the following lines
      for (let j = i + 1; j < lines.length && /^\s*(SCHEDULED|DEADLINE):/.test(lines[j]); j++) { const d = lines[j].match(/<(\d{4}-\d{2}-\d{2})/); if (d && (!due || /DEADLINE/.test(lines[j]))) due = d[1]; }
      top = D.add(path, { title: fields.title, due, start: fields.start, priority: fields.priority, tags: fields.tags, repeat: fields.repeat, status, doneAt: fields.doneAt, section: section && section !== name ? section : null }); topIndent = indent; if (top) found++;
    }
    // a page with no checklist: a task (when it carries a done / due property, as Anytype exports do) or a note
    if (!found && o.pages !== false && text.trim()) {
      const done = fm.done ?? fm['done?'], due = parseWhen(fm.due || fm['due date'] || fm.deadline), title = (text.match(/^#\s+(.*)$/m) || [])[1] || name;
      if (done !== undefined || due) D.add(['Anytype'], { title, notes: text.replace(/^#\s+.*\n?/, '').trim(), status: /^(true|yes|1|done)$/i.test(done) ? 'done' : 'open', due: due ? due.date : null });
      else D.notes.push({ title, body: text.replace(/^#\s+.*\n?/, '').trim() });
    }
  }
  return D;
}

/* ---------- Anytype (JSON export; Markdown exports go through the Markdown parser) ---------- */
function parseAnytype(files) {
  const D = newDraft(); let md = [];
  for (const f of files) {
    if (/\.(md|markdown|txt)$/i.test(f.name)) { md.push(f); continue; }
    let j; try { j = JSON.parse(stripBom(f.text)); } catch (e) { continue; }
    for (const obj of Array.isArray(j) ? j : [j]) {
      if (!obj || typeof obj !== 'object') continue;
      if (obj.sbType && !/^(Page|Task|Note|ProfilePage)$/i.test(obj.sbType)) continue;
      const data = (obj.snapshot && obj.snapshot.data) || obj.data || obj, det = data.details || {}, blocks = data.blocks || [];
      const texts = blocks.map(b => b && b.content && b.content.text).filter(Boolean), isCheck = t => t.style === 'Checkbox' || t.style === 8;
      const checks = texts.filter(isCheck), body = texts.filter(t => !isCheck(t) && t.text && !(t.style === 'Title' || t.style === 7)).map(t => t.text).join('\n');
      const name = det.name || (texts.find(t => t.style === 'Title' || t.style === 7) || {}).text || '';
      const when = det.dueDate ? new Date(+det.dueDate * (+det.dueDate < 1e12 ? 1000 : 1)) : null, due = when && !isNaN(when) ? partsIn(when) : null;
      const isTask = typeof det.done === 'boolean' || /task/i.test(String(det.type || det.targetObjectType || ''));
      if (isTask && name) D.add(['Anytype'], { title: name, notes: body, status: det.done ? 'done' : 'open', due: due ? due.date : null, time: due && due.time !== '00:00' ? due.time : null, subtasks: checks.map(c => ({ title: c.text, done: !!c.checked })) });
      else if (checks.length) checks.forEach(c => D.add([name || 'Anytype'], { title: c.text, status: c.checked ? 'done' : 'open' }));
      else if (name && body) D.notes.push({ title: name, body });
    }
  }
  if (md.length) { const M = parseMarkdown(md, { pages: true }); for (const l of M.lists.values()) for (const t of l.tasks) D.add(l.path, t); D.notes.push(...M.notes); }
  return D;
}

/* ---------- generic CSV (Notion databases, Airtable, Asana, spreadsheets, …) ---------- */
function parseCsvGeneric(files) {
  const D = newDraft(), pick = (o, names) => { for (const n of names) if (o[n]) return o[n]; return ''; };
  for (const f of files) {
    const rows = csvParse(f.text); if (rows.length < 2) continue;
    const items = csvObjects(rows), fallback = baseName(f.name).replace(/\s+[0-9a-f]{32}$/i, '') || 'Imported';
    for (const o of items) {
      const title = pick(o, ['title', 'name', 'task', 'task name', 'summary', 'subject', 'content', 'item', 'to do', 'todo']); if (!title) continue;
      const when = parseWhen(pick(o, ['due', 'due date', 'due_date', 'deadline', 'date', 'end', 'end date', 'start date', 'start'])), st = pick(o, ['status', 'state', 'done', 'completed', 'complete', 'checked', 'progress']);
      const pr = pick(o, ['priority']).toLowerCase(), list = pick(o, ['list', 'project', 'folder', 'board', 'category', 'group', 'section']);
      D.add(list ? list.split(/\s*[>/›]\s*/) : [fallback], {
        title, notes: pick(o, ['notes', 'description', 'details', 'body', 'comment', 'comments']), due: when ? when.date : null, time: when ? when.time : null,
        priority: /^(3|high|urgent|p1|critical|!!!)/.test(pr) ? 3 : /^(2|medium|normal|p2|med)/.test(pr) ? 2 : /^(1|low|p3)/.test(pr) ? 1 : 0,
        tags: pick(o, ['tags', 'tag', 'labels', 'label']).split(/[;,]/).map(x => x.trim()).filter(Boolean),
        status: /^(done|complete|completed|closed|resolved|finished|yes|true|x|1|✓|✔)$/i.test(st) ? 'done' : 'open', created: stampOf(pick(o, ['created', 'created time', 'created at', 'created date'])),
      });
    }
  }
  return D;
}

/* ---------- registry, detection ---------- */
const IMPORTERS = [
  { id: 'ticktick', name: 'TickTick', accept: '.csv', parse: parseTickTick, how: 'Settings → Account → Generate Backup, then choose the CSV. Folders become parent lists and lists become sublists; checklists, tags, priorities, repeats and board columns come along.', score: (n, t) => (/^[^\n]*\n?[\s\S]{0,600}"?Folder Name"?,"?List Name"?/.test(t.slice(0, 2000)) ? 1 : 0) },
  { id: 'todoist', name: 'Todoist', accept: '.csv', parse: parseTodoist, how: 'Open a project → ⋯ → Export as CSV (one file per project; several can be chosen together). Sections, sub-tasks, priorities and dates are kept.', score: (n, t) => (/^\s*TYPE,CONTENT,DESCRIPTION/i.test(stripBom(t)) ? 1 : 0) },
  { id: 'googletasks', name: 'Google Tasks', accept: '.json,.zip', parse: parseGoogleTasks, how: 'Google Takeout → select “Tasks”, then choose the downloaded ZIP (or the Tasks.json inside it).', score: (n, t) => (/"tasks#task/.test(t.slice(0, 4000)) ? 1 : 0) },
  { id: 'trello', name: 'Trello', accept: '.json', parse: parseTrello, how: 'Board menu → Print and export → Export as JSON. The board becomes a list, its Trello lists become sublists, checklists become subtasks.', score: (n, t) => (/"lists"\s*:\s*\[/.test(t) && /"cards"\s*:\s*\[/.test(t) ? 1 : 0) },
  { id: 'taskwarrior', name: 'Taskwarrior', accept: '.json', parse: parseTaskwarrior, how: 'Run `task export > tasks.json`. Dotted projects (work.backend) become sublists.', score: (n, t) => (/^\s*[\[{]/.test(t) && /"uuid"\s*:/.test(t) && /"description"\s*:/.test(t) ? 0.9 : 0) },
  { id: 'anytype', name: 'Anytype', accept: '.json,.md,.zip', parse: parseAnytype, how: 'Anytype → Settings → Export, as JSON or Markdown (a ZIP can be chosen as it is). Task objects become tasks, checkboxes become subtasks, other pages become notes.', score: (n, t) => (/"snapshot"\s*:\s*\{\s*"data"|"sbType"/.test(t.slice(0, 4000)) ? 1 : 0) },
  { id: 'ics', name: 'Calendar / Reminders (.ics)', accept: '.ics', parse: parseIcs, how: 'Any iCalendar file: Apple Reminders and Calendar exports, Thunderbird, Nextcloud Tasks, Google Calendar. To-dos and events both come in.', score: (n, t) => (/^\s*BEGIN:VCALENDAR/i.test(stripBom(t)) ? 1 : 0) },
  { id: 'opml', name: 'OPML outline', accept: '.opml,.xml', parse: parseOpml, how: 'Workflowy, Dynalist, Checkvist and most outliners export OPML. Top-level items become lists, the next level tasks, deeper levels subtasks.', score: (n, t) => (/<opml[\s>]/i.test(t.slice(0, 2000)) ? 1 : 0) },
  { id: 'todotxt', name: 'todo.txt', accept: '.txt', parse: parseTodoTxt, how: 'A todo.txt file. +projects become lists, @contexts tags, (A) priorities and due: dates are kept.', score: (n, t) => { const l = t.split(/\r?\n/).filter(x => x.trim()).slice(0, 30); return l.length && l.filter(x => /^(x |\([A-Z]\) |\d{4}-\d{2}-\d{2} )|\s[+@]\w|due:\d/.test(x)).length / l.length > 0.5 && !/^\s*[-*] \[/m.test(t) ? 0.8 : 0; } },
  { id: 'markdown', name: 'Markdown / Obsidian / Logseq', accept: '.md,.markdown,.txt,.zip', parse: parseMarkdown, how: 'Notes with - [ ] checklists (choose files, or a ZIP of a vault). Obsidian Tasks dates (📅 ⏳ 🔁 ⏫), #tags, nested items and Logseq TODO / DONE are understood; each file becomes a list.', score: (n, t) => (/\.(md|markdown)$/i.test(n) || /^\s*[-*+] \[[ xX]\]/m.test(t) ? 0.6 : 0) },
  { id: 'csv', name: 'Notion, Asana, spreadsheets (CSV)', accept: '.csv,.zip', parse: parseCsvGeneric, how: 'Any CSV with a title column (Title / Name / Task). Due date, status, priority, tags, notes and list / project columns are picked up by name. Notion: database ⋯ → Export → CSV.', score: (n, t) => (/\.csv$/i.test(n) ? 0.4 : 0) },
];
function importDetect(files) {
  const f = files[0]; if (!f) return null;
  let best = null, bs = 0;
  for (const p of IMPORTERS) { const s = p.score(f.name, f.text); if (s > bs) { bs = s; best = p; } }
  return best;
}
// files + provider id ('' = detect) -> { provider, draft }
function importParse(files, id) {
  const p = id ? IMPORTERS.find(x => x.id === id) : importDetect(files);
  if (!p) throw new Error('This file is not in a format OpenTick recognises. Pick the app it came from, or use CSV for a spreadsheet.');
  return { provider: p, draft: p.parse(files) };
}

/* ---------- applying a draft ---------- */
function importApply(D, o = {}) {
  const now = Date.now(), made = [], pathIds = new Map(); let added = 0, skipped = 0;
  const lower = s => String(s).toLowerCase();
  const ensure = path => {
    let parent = null;
    for (let i = 0; i < path.length; i++) {
      const name = path[i], key = path.slice(0, i + 1).map(lower).join('\u0001');
      if (pathIds.has(key)) { parent = pathIds.get(key); continue; }
      let l = o.merge === false ? null : S.lists.find(x => lower(x.name) === lower(name) && (x.parent || null) === parent && (i > 0 || lower(name) !== 'inbox' || x.id === 'inbox'));
      if (!l) { l = { id: uid(), name, color: COLORS[(S.lists.length + made.length) % COLORS.length][0], sections: [], created: now, parent }; if (i === 0 && lower(name) === 'inbox' && !S.lists.some(x => x.id === 'inbox')) l.id = 'inbox'; S.lists.push(l); made.push(l.id); }
      pathIds.set(key, l.id); parent = l.id;
    }
    return parent;
  };
  const firstLists = [];
  for (const [k, dl] of D.lists) {
    if (o.skip && o.skip.has(k)) continue;
    const listId = ensure(dl.path), list = S.lists.find(x => x.id === listId), rootId = pathIds.get(lower(dl.path[0])); if (!firstLists.includes(rootId)) firstLists.push(rootId); // roots: a project brings their sublists
    for (const t of dl.tasks) {
      if (o.dedupe !== false && S.tasks.some(x => !x.deleted && x.listId === listId && x.title === t.title && (x.due || null) === (t.due || null))) { skipped++; continue; }
      if (t.section && !list.sections.includes(t.section)) list.sections.push(t.section);
      const task = newTask({ title: t.title, notes: t.notes || '', listId, due: t.due || null, time: t.due ? t.time || null : null, priority: t.priority || 0, tags: t.tags || [], status: t.status || 'open', repeat: t.due ? t.repeat || null : null, section: t.section || null, subtasks: (t.subtasks || []).map(s => ({ id: uid(), title: s.title, done: !!s.done })) });
      if (t.start && t.due && t.start <= t.due) task.start = t.start;
      if (t.dur) task.dur = t.dur;
      if (t.created) task.created = t.created;
      if (task.status === 'done') task.doneAt = t.doneAt || t.created || now;
      S.tasks.push(task); added++;
    }
  }
  let notes = 0; for (const n of D.notes) { if (o.dedupe !== false && S.notes.some(x => x.title === n.title && x.body === n.body)) continue; S.notes.push(newNote({ title: n.title || '', body: n.body || '' })); notes++; }
  let project = null;
  if (o.project && firstLists.length) { project = { id: uid(), name: o.project, color: COLORS[(S.projects.length + 3) % COLORS.length][0], listIds: firstLists, created: now }; S.projects.push(project); }
  histNote('import', `Imported ${added} task${added === 1 ? '' : 's'}${o.source ? ' from ' + o.source : ''}`);
  save();
  return { added, skipped, notes, lists: made.length, project, first: firstLists[0] || null };
}

/* ---------- dialog ---------- */
async function openImport(preset) {
  const st = { provider: '', files: [], res: null, err: '', skip: new Set(), merge: true, dedupe: true, project: false, pname: '', busy: false, replace: false };
  const prov = () => (st.provider ? IMPORTERS.find(p => p.id === st.provider) : null);
  const draw = () => {
    const D = st.res && st.res.draft, c = D ? draftCounts(D) : null, p = prov();
    const lists = D ? [...D.lists.entries()].filter(([, l]) => l.tasks.length).sort((a, b) => a[1].path.join('\u0001').localeCompare(b[1].path.join('\u0001'))) : [];
    openModal(`<h3>Import from another app</h3>
<div class="imp-prov" role="radiogroup" aria-label="Where is the data from?"><button class="${!st.provider ? 'on' : ''}" data-m="prov" data-p="">${ic('search', 15)} Detect</button>${IMPORTERS.map(x => `<button class="${st.provider === x.id ? 'on' : ''}" data-m="prov" data-p="${x.id}">${esc(x.name)}</button>`).join('')}</div>
<p class="hint imp-how">${p ? esc(p.how) : 'Choose the file or ZIP you exported (several files at once are fine) and OpenTick works out which app it came from — or pick the app above.'}</p>
<label class="imp-drop" id="imp-drop"><input type="file" id="imp-file" multiple accept="${p ? esc(p.accept) + ',.zip' : '.csv,.json,.zip,.md,.markdown,.txt,.ics,.opml,.xml'}"><span>${ic('upload', 22)}</span><b>${st.files.length ? esc(st.files.map(f => f.name).join(', ').slice(0, 90)) : 'Choose files, or drop them here'}</b><small>${st.files.length ? 'Choose again to replace' : 'CSV · JSON · ZIP · Markdown · ICS · OPML · todo.txt'}</small></label>
${st.busy ? '<p class="hint">Reading…</p>' : ''}${st.err ? `<p class="imp-err">${esc(st.err)}</p>` : ''}
${c ? `<div class="imp-sum"><b>${esc(st.res.provider.name)}</b><span>${c.tasks} task${c.tasks === 1 ? '' : 's'}</span><span>${c.lists} list${c.lists === 1 ? '' : 's'}</span>${c.subs ? `<span>${c.subs} subtask${c.subs === 1 ? '' : 's'}</span>` : ''}${c.notes ? `<span>${c.notes} note${c.notes === 1 ? '' : 's'}</span>` : ''}</div>
<div class="imp-lists">${lists.map(([k, l]) => `<label class="imp-l" style="--d:${l.path.length - 1}"><input type="checkbox" data-k="${esc(k)}"${st.skip.has(k) ? '' : ' checked'}><span>${esc(l.path[l.path.length - 1])}${l.path.length > 1 ? `<small>${esc(l.path.slice(0, -1).join(' › '))}</small>` : ''}</span><em>${l.tasks.length}</em></label>`).join('') || '<p class="hint">No tasks were found in these files.</p>'}</div>
<div class="imp-opts"><label class="chkl rep${st.replace ? ' on' : ''}"><input type="checkbox" data-o="replace"${st.replace ? ' checked' : ''}> <span><b>Replace everything</b> — delete all my current data first, then import${st.replace ? `<small>You will be asked to confirm. ${esc(dataCountsText())} will be deleted.</small>` : ''}</span></label>${st.replace ? '' : `<label class="chkl"><input type="checkbox" data-o="merge"${st.merge ? ' checked' : ''}> Add to lists that already have the same name</label><label class="chkl"><input type="checkbox" data-o="dedupe"${st.dedupe ? ' checked' : ''}> Skip tasks that are already there</label>`}<label class="chkl"><input type="checkbox" data-o="project"${st.project ? ' checked' : ''}> Group the imported lists in a new project</label>${st.project ? `<input id="imp-pname" value="${esc(st.pname)}" placeholder="Project name">` : ''}</div>
${D.warn.length ? `<p class="hint">${esc(D.warn.join(' '))}</p>` : ''}` : ''}
<div class="mact"><span class="sp"></span><button data-m="no">Cancel</button><button class="${st.replace ? 'danger' : 'pri'}" data-m="go"${c && (c.tasks || c.notes) ? '' : ' disabled'}>${c ? `${st.replace ? 'Replace and import' : 'Import'} ${c.tasks}${c.notes ? ' + ' + c.notes + ' notes' : ''}` : 'Import'}</button></div>`, m => {
      const load = async list => {
        st.busy = true; st.err = ''; st.res = null; draw();
        try { st.files = await readImportFiles(list); if (!st.files.length) throw new Error('Nothing readable in those files (supported: CSV, JSON, ZIP, Markdown, ICS, OPML, TXT).'); st.res = importParse(st.files, st.provider); st.skip = new Set(); if (!st.pname) st.pname = st.res.provider.name + ' import'; }
        catch (e) { st.err = e.message || String(e); }
        st.busy = false; draw();
      };
      const fi = $('#imp-file', m); if (fi) fi.onchange = () => { if (fi.files.length) { st.picked = [...fi.files]; load(st.picked); } };
      const dz = $('#imp-drop', m); if (dz) { dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over'); dz.ondrop = e => { e.preventDefault(); if (e.dataTransfer.files.length) { st.picked = [...e.dataTransfer.files]; load(st.picked); } }; }
      m.onchange = e => {
        const el = e.target; if (el.id === 'imp-file') return;
        if (el.dataset.k !== undefined) { if (el.checked) st.skip.delete(el.dataset.k); else st.skip.add(el.dataset.k); }
        else if (el.dataset.o) { st[el.dataset.o] = el.checked; if (el.dataset.o === 'project' || el.dataset.o === 'replace') draw(); }
      };
      m.oninput = e => { if (e.target.id === 'imp-pname') st.pname = e.target.value; };
      m.onclick = e => {
        const b = e.target.closest('button'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
        if (b.dataset.m === 'prov') { st.provider = b.dataset.p; if (st.files.length) { st.res = null; st.err = ''; try { st.res = importParse(st.files, st.provider); st.skip = new Set(); } catch (x) { st.err = x.message; } } draw(); }
        else if (b.dataset.m === 'no') closeModal();
        else if (b.dataset.m === 'go' && st.res) (async () => {
          let key = '';
          if (st.replace) { // delete everything first, after a clear confirmation (cancelling returns to this dialog with its choices)
            const D = st.res.draft, c = draftCounts(D), o = await askWipe({ title: 'Replace everything with this import?', lead: `All of your current data is deleted first. Then ${esc(plural(c.tasks, 'task'))}${c.notes ? ` and ${esc(plural(c.notes, 'note'))}` : ''} from ${esc(st.res.provider.name)} are imported, so you end up with only what is in the file.`, ok: 'Replace and import' });
            if (!o) { draw(); return; }
            key = await wipeAll({ settings: false, files: o.files });
          }
          const r = importApply(st.res.draft, { merge: st.replace ? false : st.merge, dedupe: st.replace ? false : st.dedupe, skip: st.skip, project: st.project ? (st.pname.trim() || 'Imported') : '', source: st.res.provider.name });
          closeModal(); sfx('done'); toast(`Imported ${r.added} task${r.added === 1 ? '' : 's'}${r.notes ? ` and ${r.notes} note${r.notes === 1 ? '' : 's'}` : ''}${r.skipped ? ` (${r.skipped} already there)` : ''}`, st.replace && key ? { label: 'Undo', fn: async () => { try { await snapRestore(key); U.nav = 'today'; U.page = 'tasks'; render(); toast('Restored'); } catch (e) { toast('Could not undo: ' + (e.message || e)); } } } : undefined);
          if (r.project) setNav('project:' + r.project.id); else if (r.first) setNav('list:' + r.first); else { refresh(); }
        })();
      };
    }, 'wide');
    if (st.drawn) $$('#modal .mback,#modal .mbox').forEach(x => x.classList.add('again')); // redrawing: no pop-in animation
    st.drawn = true;
  };
  if (preset) st.provider = preset;
  draw();
}
