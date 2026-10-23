/* OpenTick classes: a weekly timetable of lessons (school, university, courses, a rota…). It is called "Classes" unless you rename it.
   It follows the features of the open-source "Timetable" app (flxholle / asdoi): lesson periods with times, subjects with a colour, room
   and teacher, teachers, a weekly grid (optionally alternating A / B weeks), what is on now and next, notes, days off, a reminder before a
   lesson, and it travels with your backup and sync like everything else.
   Lessons are not kept apart from the rest of the app: they are drawn on the main timetable next to weekly slots and timed tasks, tasks can
   sit inside a lesson (task.lessonId) or belong to a class (task.subjectId), and exams and homework are ordinary tasks (task.kind) that can
   live in any list, sublist or project, show up in Today, the calendar and the matrix, and be ticked off like any other task.
   The classes themselves live in one synced collection, S.school, of small records told apart by `k`:
   cfg · period · subject · teacher · lesson · off (days off) · skip (one cancelled lesson) · snote.
   (Old exam and homework records are turned into tasks by migrateClasses() in core.js.) */
const SC_DEF = { id: 'school-cfg', k: 'cfg', days: [1, 2, 3, 4, 5], ab: false, swap: false, remind: 5, name: '' };
const scOf = k => S.school.filter(r => r.k === k), scGet = id => S.school.find(r => r.id === id);
const scCfg = () => scGet('school-cfg') || SC_DEF;
function scCfgSet(p) { let c = scGet('school-cfg'); if (!c) { c = { ...SC_DEF }; S.school.push(c); } Object.assign(c, p); save(); }
const SC_NAMES = ['Classes', 'Lessons', 'Courses', 'Lectures', 'Schedule', 'School', 'Rota'];
const scName = () => String(scCfg().name || '').trim().slice(0, 24) || 'Classes';
const scPeriods = () => scOf('period').sort((a, b) => a.start.localeCompare(b.start));
const scDays = () => { const ws = S.settings.weekStart || 0; return [...scCfg().days].sort((a, b) => ((a - ws + 7) % 7) - ((b - ws + 7) % 7)); };
const schoolOn = () => (S.settings.tt || {}).mode === 'school'; // the Classes layout is showing (the name is historic: it is what the setting has always been called)
const scSubj = id => scGet(id) && scGet(id).k === 'subject' ? scGet(id) : null;
const scTeacherOf = (l, s) => scGet(l.teacherId || (s && s.teacherId) || '');
const scRoom = (l, s) => String((l && l.room) || (s && s.room) || '');
function isoWeekNo(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); }
// 0 when weeks do not alternate, else 1 (week A) or 2 (week B)
const scWeekType = d => { const c = scCfg(); return c.ab ? ((isoWeekNo(d) % 2) ^ (c.swap ? 1 : 0) ? 1 : 2) : 0; };
const scWeekName = wt => (wt === 1 ? 'Week A' : wt === 2 ? 'Week B' : '');
// a short code for a class: the one it was given, else its first letters (never wider than four characters)
const scShort = s => { if (!s) return ''; const c = String(s.short || '').trim(); if (c) return c.slice(0, 5); const w = String(s.name || '').trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w.map(x => x[0]).join('') : (w[0] || '').slice(0, 4)).slice(0, 5); };
const fmtHM = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
// "12 min", "1 h 20 min"
const scSpan = m => { m = Math.max(0, Math.round(m)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`; };
const scDue = k => { if (!k) return ''; const d = dayDiff(k, todayStr()); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 1 && d < 15 ? `In ${d} days` : d < 0 && d > -15 ? `${-d} days ago` : fmtDate(k); };

/* ---------- days off and cancelled lessons ---------- */
const scOff = date => { const k = ymd(date); return scOf('off').find(o => o.from && o.from <= k && k <= (o.to || o.from)) || null; };
const scSkipId = (lid, k) => 'skip-' + lid + '-' + k; // a fixed id: two devices cancelling the same lesson make one record
const scSkipped = (lid, k) => !!scGet(scSkipId(lid, k));
function scSetSkip(lid, k, on) {
  const id = scSkipId(lid, k), cur = scGet(id);
  if (on && !cur) S.school.push({ id, k: 'skip', lessonId: lid, date: k }); else if (!on && cur) S.school = S.school.filter(x => x !== cur);
  save();
}

/* ---------- the lessons of a day ---------- */
// the lesson in a cell: one made for this week type wins over one that runs every week
function scLesson(day, pid, wt) { const ls = scOf('lesson').filter(l => l.day === day && l.periodId === pid && (!wt || !l.week || l.week === wt)); return ls.find(l => l.week === wt && wt) || ls[0] || null; }
// [{ p: period, l: lesson }] in time order; none on a day off. With `cancelled`, the lessons cancelled for that date are included (marked).
function scDayLessons(date, o = {}) {
  if (scOff(date)) return [];
  const wt = scWeekType(date), day = date.getDay(), k = ymd(date), out = [];
  for (const p of scPeriods()) {
    if (p.brk) continue;
    const l = scLesson(day, p.id, wt); if (!l) continue;
    const gone = scSkipped(l.id, k); if (gone && !o.cancelled) continue;
    out.push(gone ? { p, l, cancelled: true } : { p, l });
  }
  return out;
}
// the next time a class meets: { date, l, p } (today counts while its lesson has not started yet)
function scNextLesson(subjectId, from = new Date(), horizon = 28) {
  const nowM = from.getHours() * 60 + from.getMinutes();
  for (let i = 0; i <= horizon; i++) { const d = addDays(from, i); for (const x of scDayLessons(d)) if (x.l.subjectId === subjectId && (i > 0 || toMin(x.p.start) > nowM)) return { date: ymd(d), l: x.l, p: x.p }; }
  return null;
}
function scNowNext() {
  const n = new Date(), m = n.getHours() * 60 + n.getMinutes(), items = scDayLessons(n).map(x => ({ ...x, a: toMin(x.p.start), b: toMin(x.p.end) }));
  return { cur: items.find(x => m >= x.a && m < x.b) || null, next: items.find(x => x.a > m) || null, m, items };
}
function scSeedPeriods() {
  [['08:00', '08:45'], ['08:50', '09:35'], ['09:35', '09:55', 1], ['09:55', '10:40'], ['10:45', '11:30'], ['11:35', '12:20'], ['12:20', '13:00', 1], ['13:00', '13:45'], ['13:50', '14:35']].forEach(([start, end, brk], i) => S.school.push({ id: uid(), k: 'period', start, end, brk: !!brk, label: brk ? (i === 2 ? 'Break' : 'Lunch') : '' }));
  save();
}
// the lessons a task can belong to: the ones on its due day, plus the coming ones of its class. Values are "lessonId|date" (choosing one sets both).
function scLessonChoices(t) {
  const out = [], seen = new Set(), add = (date, x) => { const v = x.l.id + '|' + date; if (seen.has(v)) return; seen.add(v); const s = scSubj(x.l.subjectId); out.push([v, `${fmtDate(date)} · ${fmtRange(x.p.start, x.p.end)}${s ? ' · ' + s.name : ''}`]); };
  if (t.due) for (const x of scDayLessons(pYmd(t.due))) if (!t.subjectId || x.l.subjectId === t.subjectId) add(t.due, x);
  if (t.subjectId) { const from = t.due ? pYmd(t.due) : new Date(); let n = 0; for (let i = 0; i < 28 && n < 6; i++) { const d = addDays(from, i), k = ymd(d); for (const x of scDayLessons(d)) if (x.l.subjectId === t.subjectId && !seen.has(x.l.id + '|' + k)) { add(k, x); n++; } } }
  return out;
}
// does this person use the classes at all? (decides whether lessons are offered and drawn on the main timetable)
const scHas = () => scPeriods().some(p => !p.brk) && scOf('lesson').length > 0;

/* ---------- everything on one day ----------
   The same list the main timetable draws (lessons, weekly slots, tasks with a time, tasks inside a lesson or slot), plus the breaks, in time order. */
function scAgenda(date) {
  const r = ttItems(date, { classes: true }), items = [...r.items], off = scOff(date);
  if (!off) {
    for (const p of scPeriods()) if (p.brk && validHM(p.start) && validHM(p.end)) items.push({ k: 'brk', p, a: toMin(p.start), b: toMin(p.end) });
    for (const x of scDayLessons(date, { cancelled: true })) if (x.cancelled) { const s = scSubj(x.l.subjectId); items.push({ k: 'lesson', l: x.l, p: x.p, s, a: toMin(x.p.start), b: toMin(x.p.end), tasks: [], cancelled: true }); }
  }
  items.sort((x, y) => x.a - y.a || x.b - y.b);
  return { items, allday: r.allday, off };
}
const scLessonName = it => (it.s ? it.s.name : 'Lesson');
const scColor = s => (s && s.color) || 'var(--muted)';
// a class as a small coloured chip (its short code when there is little room)
const scChip = (s, short) => (s ? `<span class="sc-chip" style="--c:${s.color}">${iconAny(s.icon, 13)}<span>${esc(short ? scShort(s) : s.name)}</span></span>` : '');

/* ---------- shared pieces of the pages ---------- */
const scTaskLine = t => `<div class="sc-tk${t.status !== 'open' ? ' fin' : ''}" data-act="open" data-id="${t.id}"><button class="chk sm p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 11) : ''}</button>${t.kind ? `<span class="sc-kd ${t.kind}" title="${t.kind === 'exam' ? 'Exam' : 'Homework'}">${ic(t.kind === 'exam' ? 'exam' : 'homework', 12)}</span>` : ''}<span class="sc-tt">${titleHtml(t)}</span></div>`;
// one entry of a day's agenda
function scAgendaRow(it, date, nowM, today) {
  const dur = it.b - it.a, live = today && nowM >= it.a && nowM < it.b, past = today && nowM >= it.b, cls = (live ? ' now' : '') + (past ? ' past' : '');
  const tcol = `<time class="sc-t"><b>${fmtMin(it.a)}</b><span>${fmtMin(it.b)}</span></time>`;
  if (it.k === 'brk') return `<div class="sc-ag brk${cls}">${tcol}<span class="sc-bar"></span><div class="sc-ab"><span class="sc-rt">${esc(it.p.label || 'Break')}</span><small>${fmtDur(dur)}</small></div></div>`;
  const prog = live ? `<div class="sc-prog" style="--pct:${Math.round((nowM - it.a) / Math.max(1, dur) * 100)}%"></div><em class="sc-left">ends in ${scSpan(it.b - nowM)}</em>` : '';
  const tasks = it.tasks && it.tasks.length ? `<div class="sc-tks">${it.tasks.map(scTaskLine).join('')}</div>` : '';
  if (it.k === 'lesson') {
    const s = it.s, t = scTeacherOf(it.l, s), room = scRoom(it.l, s), k = ymd(date);
    return `<div class="sc-ag lsn${cls}${it.cancelled ? ' gone' : ''}" style="--c:${scColor(s)}" data-act="sclesson" data-lid="${it.l.id}" data-date="${k}" tabindex="0" role="button" aria-label="${esc(scLessonName(it))}, ${fmtRange(it.a, it.b)}${it.cancelled ? ', cancelled' : ''}">${tcol}<span class="sc-bar"></span><div class="sc-ab"><div class="sc-l1"><span class="sc-rt">${s ? iconAny(s.icon, 16) : ''}<span>${esc(scLessonName(it))}</span></span><small>${fmtDur(dur)}</small></div>`
      + `<div class="sc-l2">${it.cancelled ? '<span class="sc-x">Cancelled</span>' : ''}${room ? `<span>${ic('pin', 12)} ${esc(room)}</span>` : ''}${t ? `<span>${ic('teacher', 12)} ${esc(t.name)}</span>` : ''}${it.l.week ? `<span class="sc-w">${it.l.week === 1 ? 'Week A' : 'Week B'}</span>` : ''}</div>${prog}${tasks}</div></div>`;
  }
  if (it.k === 'slot') return `<div class="sc-ag slt${cls}" style="--c:${it.s.color}" data-act="ttslot" data-sid="${it.s.id}" tabindex="0" role="button" aria-label="${esc(it.s.title)}, ${fmtRange(it.a, it.b)}">${tcol}<span class="sc-bar"></span><div class="sc-ab"><div class="sc-l1"><span class="sc-rt">${it.s.icon ? iconAny(it.s.icon, 16) : ic('table', 15)}<span>${esc(it.s.title)}</span></span><small>${fmtDur(dur)}</small></div>${it.s.loc ? `<div class="sc-l2"><span>${ic('pin', 12)} ${esc(it.s.loc)}</span></div>` : ''}${prog}${tasks}</div></div>`;
  const t = it.t, s = scSubj(t.subjectId);
  return `<div class="sc-ag tsk${cls}${t.status !== 'open' ? ' fin' : ''}" style="--c:${s ? s.color : listOf(t.listId).color}" data-act="open" data-id="${t.id}"><time class="sc-t"><b>${fmtMin(it.a)}</b><span>${fmtMin(it.b)}</span></time><span class="sc-bar"></span><div class="sc-ab"><div class="sc-l1"><span class="sc-rt"><button class="chk sm p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 11) : ''}</button>${t.kind ? `<span class="sc-kd ${t.kind}">${ic(t.kind === 'exam' ? 'exam' : 'homework', 13)}</span>` : ''}<span>${titleHtml(t)}</span></span><small>${fmtDur(dur)}</small></div>${s || t.room ? `<div class="sc-l2">${scChip(s)}${t.room ? `<span>${ic('pin', 12)} ${esc(t.room)}</span>` : ''}</div>` : ''}${prog}</div></div>`;
}
// the agenda of a day: a "now" line is slipped in at the right place when the day is today
function scAgendaHtml(date, ag = scAgenda(date)) {
  const today = ymd(date) === todayStr(), n = new Date(), nowM = n.getHours() * 60 + n.getMinutes();
  if (ag.off) return `<div class="sc-off">${ic('sun', 22)}<div><b>Day off</b><span>${esc(ag.off.label || 'No classes today')}</span></div></div>` + (ag.allday.length ? `<div class="sc-list">${ag.allday.map(t => rowHtml(t, true)).join('')}</div>` : '');
  let html = '', marked = false;
  const nowLine = `<div class="sc-nowl" aria-label="Now, ${fmtMin(nowM)}"><span>${fmtMin(nowM)}</span><i></i></div>`;
  for (const it of ag.items) {
    if (today && !marked && nowM < it.b && nowM < it.a) { html += nowLine; marked = true; } else if (today && nowM >= it.a && nowM < it.b) marked = true;
    html += scAgendaRow(it, date, nowM, today);
  }
  if (today && !marked && ag.items.length) html += nowLine;
  const empty = !ag.items.filter(i => i.k !== 'brk').length;
  return (empty && !ag.allday.length ? `<div class="empty sm">${ic('sun', 36)}<p>Nothing on ${today ? 'today' : 'this day'}</p></div>` : empty ? '' : `<div class="sc-agenda">${html}</div>`)
    + (ag.allday.length ? `<div class="sc-sec"><h3 class="hh">${ic('check-circle', 16)} No time set</h3><div class="sc-list">${ag.allday.map(t => rowHtml(t, true)).join('')}</div></div>` : '');
}
// the hero of the Today page: what is on now, what comes next, how long until the day ends
function scHeroHtml(date) {
  const ag = scAgenda(date), n = new Date(), m = n.getHours() * 60 + n.getMinutes();
  if (ag.off) return `<div class="sc-hero"><div class="sc-now idle"><span class="sc-nl">Today</span><b>Day off</b><span>${esc(ag.off.label || 'No classes today')}</span></div></div>`;
  const real = ag.items.filter(i => (i.k === 'lesson' && !i.cancelled) || i.k === 'slot'), cur = real.find(i => m >= i.a && m < i.b), next = real.find(i => i.a > m);
  const title = i => (i.k === 'lesson' ? scLessonName(i) : i.s.title), colour = i => (i.k === 'lesson' ? scColor(i.s) : i.s.color), icon = i => (i.k === 'lesson' ? (i.s ? iconAny(i.s.icon, 18) : '') : i.s.icon ? iconAny(i.s.icon, 18) : ic('table', 17));
  const where = i => (i.k === 'lesson' ? [scRoom(i.l, i.s), (scTeacherOf(i.l, i.s) || {}).name] : [i.s.loc]).filter(Boolean).map(esc).join(' · ');
  const card = (lab, i, extra, cls = '') => `<div class="sc-now${cls}" style="--c:${colour(i)}"><span class="sc-nl">${lab}</span><b>${icon(i)} ${esc(title(i))}</b><span class="sc-nt">${fmtRange(i.a, i.b)}${where(i) ? ' · ' + where(i) : ''}</span>${extra}</div>`;
  let a = '', b = '';
  if (cur) a = card('Now', cur, `<div class="sc-prog" style="--pct:${Math.round((m - cur.a) / Math.max(1, cur.b - cur.a) * 100)}%"></div><span class="sc-left">Ends at ${fmtMin(cur.b)} · ${scSpan(cur.b - m)} left</span>`);
  else if (next) a = `<div class="sc-now idle"><span class="sc-nl">Now</span><b>${real.some(i => i.b <= m) ? 'Free for now' : 'Not started yet'}</b><span class="sc-nt">${scSpan(next.a - m)} until ${esc(title(next))}</span></div>`;
  else if (real.length) a = `<div class="sc-now idle"><span class="sc-nl">Now</span><b>Done for today</b><span class="sc-nt">The last one ended at ${fmtMin(real[real.length - 1].b)}</span></div>`;
  else a = `<div class="sc-now idle"><span class="sc-nl">Now</span><b>Nothing scheduled</b><span class="sc-nt">No lessons or slots today</span></div>`;
  if (next) b = card('Next', next, `<span class="sc-left">Starts at ${fmtMin(next.a)} · in ${scSpan(next.a - m)}</span>`);
  else if (!cur || real.length) { // after the last one: when does it start again?
    for (let i = 1; i <= 14 && !b; i++) { const d = addDays(date, i), g = scAgenda(d); const f = g.items.find(x => (x.k === 'lesson' && !x.cancelled) || x.k === 'slot'); if (f) b = card(i === 1 ? 'Tomorrow' : fmtDate(ymd(d)), f, `<span class="sc-left">First one starts at ${fmtMin(f.a)}</span>`); }
  }
  const sum = real.length ? `<p class="sc-sum">${real.length} today · ${fmtMin(real[0].a)} – ${fmtMin(real[real.length - 1].b)}${m < real[real.length - 1].b ? ` · the day ends in ${scSpan(Math.max(0, real[real.length - 1].b - m))}` : ''}</p>` : '';
  return `<div class="sc-hero"><div class="sc-nn">${a}${b}</div>${sum}</div>`;
}

/* ---------- the week grid ----------
   Periods run down, days across. Nothing in a cell scrolls or slides: the text adapts to the room there is (see scDensity), and tapping a cell
   shows everything about it. */
function scWeekDates(base) { const ws = +S.settings.weekStart || 0; return addDays(base, -((base.getDay() - ws + 7) % 7)); }
// how much a cell can say, from its width: xs = a short code, s = the name, m = name and room, l = name, room and teacher
const scDensity = cw => (cw < 58 ? 'xs' : cw < 84 ? 's' : cw < 132 ? 'm' : 'l');
function scGridHtml() {
  const days = scDays(), per = scPeriods(), base = U.scDate || new Date(), td = todayStr();
  if (!per.length) return `<div class="empty">${ic('table', 44)}<p>Set up your lesson times first</p><button class="btn pri" data-act="scsetup">Use a standard school day</button><button class="btn" data-act="scperiods">Enter them myself</button></div>`;
  const ws0 = scWeekDates(base), wk = days.map(d => addDays(ws0, (d - (+S.settings.weekStart || 0) + 7) % 7)), wt = scWeekType(base), nn = scNowNext();
  const info = wk.map(d => { const ag = scAgenda(d), byL = new Map(); for (const it of ag.items) if (it.k === 'lesson') byL.set(it.l.id, it); const due = S.tasks.filter(t => !t.deleted && t.due === ymd(d) && t.status === 'open' && (t.kind || t.subjectId || t.lessonId)); return { d, k: ymd(d), off: ag.off, byL, due, exam: due.some(t => t.kind === 'exam') }; });
  const rows = per.map(p => (p.brk ? 'auto' : 'minmax(var(--rh),1fr)')).join(' ');
  let n = 0, h = `<div class="sc-grid" style="--cols:${days.length};grid-template-rows:auto ${rows}"><div class="sc-h sc-corner">${wt ? `<small>${scWeekName(wt)}</small>` : ''}</div>`
    + info.map(x => `<button class="sc-h${x.k === td ? ' today' : ''}${x.off ? ' off' : ''}" data-act="scjump" data-d="${x.k}" title="Open ${FULLDAYS[x.d.getDay()]} ${x.d.getDate()} ${MONTHS[x.d.getMonth()]}"><span class="sc-dn">${DAYS[x.d.getDay()]}</span><b>${x.d.getDate()}</b>${x.off ? '<small class="sc-offl">Off</small>' : x.due.length ? `<small class="sc-due${x.exam ? ' ex' : ''}">${x.exam ? ic('exam', 11) : ic('check-circle', 11)}${x.due.length}</small>` : ''}</button>`).join('');
  for (const p of per) {
    if (p.brk) { h += `<div class="sc-brk"><span>${esc(p.label || 'Break')}</span><small>${fmtTime(p.start)} – ${fmtTime(p.end)}</small></div>`; continue; }
    n++; h += `<div class="sc-p"><b>${esc(p.label || n)}</b><small>${fmtMin(toMin(p.start), { noAp: true })}</small><small>${fmtMin(toMin(p.end), { noAp: true })}</small></div>`;
    for (const x of info) {
      const d = x.d.getDay(), l = scLesson(d, p.id, wt), s = l && scSubj(l.subjectId), t = l && scTeacherOf(l, s), room = l && scRoom(l, s);
      if (x.off || !l) { h += x.off ? `<div class="sc-c off" aria-hidden="true"></div>` : `<button class="sc-c" data-act="sccell" data-day="${d}" data-p="${p.id}" aria-label="Add a lesson on ${FULLDAYS[d]}, ${fmtTime(p.start)}">${ic('plus', 14)}</button>`; continue; }
      const gone = scSkipped(l.id, x.k), it = x.byL.get(l.id), tk = it && it.tasks ? it.tasks.filter(z => z.status === 'open') : [], isNow = nn.cur && x.k === td && nn.cur.p.id === p.id;
      const label = `${s ? s.name : 'Lesson'}, ${FULLDAYS[d]} ${fmtRange(p.start, p.end)}${room ? ', ' + room : ''}${t ? ', ' + t.name : ''}${gone ? ', cancelled' : ''}`;
      h += `<button class="sc-c has${isNow ? ' now' : ''}${gone ? ' gone' : ''}" style="--c:${scColor(s)}" data-act="sclesson" data-lid="${l.id}" data-date="${x.k}" title="${esc(label)}" aria-label="${esc(label)}"><span class="sc-n">${s ? iconAny(s.icon, 14) : ''}<span class="sc-nf">${esc(s ? s.name : 'Lesson')}</span><span class="sc-ns">${esc(s ? scShort(s) : 'Les')}</span></span>${room ? `<small class="sc-r">${esc(room)}</small>` : ''}${t ? `<small class="sc-te">${esc(t.name)}</small>` : ''}${l.week ? `<i class="sc-w">${l.week === 1 ? 'A' : 'B'}</i>` : ''}${tk.length ? `<b class="sc-k${tk.some(z => z.kind === 'exam') ? ' ex' : ''}" title="${tk.length} task${tk.length === 1 ? '' : 's'} for this lesson">${tk.some(z => z.kind === 'exam') ? ic('exam', 10) : ic('check', 10)}${tk.length}</b>` : ''}</button>`;
    }
  }
  return h + '</div>';
}
function scDayNavHtml() {
  const days = scDays(), base = U.scDate || new Date(), ws0 = scWeekDates(base), td = todayStr(), sel = ymd(base);
  return `<div class="tt-strip sc-strip">${days.map(d => { const date = addDays(ws0, (d - (+S.settings.weekStart || 0) + 7) % 7), k = ymd(date), ag = scAgenda(date), n = ag.items.filter(i => i.k !== 'brk' && !i.cancelled).length + ag.allday.length; return `<button class="${k === sel ? 'on' : ''}${k === td ? ' today' : ''}${ag.off ? ' off' : ''}" data-act="scjump" data-d="${k}"><small>${DAYS[d]}</small><b>${date.getDate()}</b><i>${ag.off ? 'off' : n ? '•'.repeat(Math.min(3, n)) : ''}</i></button>`; }).join('')}</div>`;
}
function scDayHtml() {
  const date = U.scDate || new Date(), wt = scWeekType(date);
  return scDayNavHtml() + `<h2 class="sc-dh">${esc(FULLDAYS[date.getDay()])} <span>${date.getDate()} ${esc(MONTHS[date.getMonth()])}</span>${wt ? `<em>${scWeekName(wt)}</em>` : ''}</h2>` + scAgendaHtml(date);
}
function scTodayHtml() {
  const td = new Date(), tds = todayStr(), wk = S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open');
  const hw = wk.filter(t => t.kind === 'homework' && t.due && dayDiff(t.due, tds) <= 7).sort((a, b) => a.due.localeCompare(b.due)), ex = wk.filter(t => t.kind === 'exam' && t.due && dayDiff(t.due, tds) >= 0 && dayDiff(t.due, tds) <= 21).sort((a, b) => a.due.localeCompare(b.due) || (a.time || '').localeCompare(b.time || ''));
  const wt = scWeekType(td);
  return `<div class="sc-today">${scHeroHtml(td)}<h3 class="hh">${ic('table', 16)} ${esc(FULLDAYS[td.getDay()])}${wt ? ' · ' + scWeekName(wt) : ''}</h3>${scAgendaHtml(td)}`
    + (ex.length ? `<h3 class="hh">${ic('exam', 16)} Exams coming up</h3><div class="sc-list">${ex.map(t => rowHtml(t, true)).join('')}</div>` : '')
    + (hw.length ? `<h3 class="hh">${ic('homework', 16)} Homework due soon</h3><div class="sc-list">${hw.map(t => rowHtml(t, true)).join('')}</div>` : '') + '</div>';
}
// exams and homework are tasks: the pages are just those tasks, with the usual rows (tick, open, drag between lists)
const scWork = kind => S.tasks.filter(t => !t.deleted && !t.log && t.kind === kind);
function scTabHtml(tab) {
  const empty = (ico, msg, btn) => `<div class="empty">${ic(ico, 44)}<p>${msg}</p>${btn || ''}</div>`;
  if (tab === 'week') return scGridHtml();
  if (tab === 'day') return scDayHtml();
  if (tab === 'today') return scTodayHtml();
  if (tab === 'hw') {
    const all = scWork('homework'), open = all.filter(t => t.status === 'open').sort((a, b) => (a.due || '9').localeCompare(b.due || '9')), done = all.filter(t => t.status !== 'open').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    return !all.length ? empty('homework', 'No homework yet', `<button class="btn pri" data-act="scaddwork" data-kind="homework">Add homework</button>`) : (open.length ? `<div class="sc-list">${open.map(t => rowHtml(t, true)).join('')}</div>` : '<p class="hint">All done. Nice.</p>') + (done.length ? `<h3 class="hh">${ic('check-circle', 16)} Done · ${done.length}</h3><div class="sc-list fin">${done.slice(0, 40).map(t => rowHtml(t, true)).join('')}</div>` : '');
  }
  if (tab === 'exam') {
    const all = scWork('exam'), td = todayStr(), up = all.filter(t => t.status === 'open' && (!t.due || t.due >= td)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || (a.time || '').localeCompare(b.time || '')), past = all.filter(t => !up.includes(t)).sort((a, b) => (b.due || '').localeCompare(a.due || ''));
    return !all.length ? empty('exam', 'No exams yet', `<button class="btn pri" data-act="scaddwork" data-kind="exam">Add an exam</button>`) : (up.length ? `<div class="sc-list">${up.map(t => rowHtml(t, true)).join('')}</div>` : '<p class="hint">No exams coming up.</p>') + (past.length ? `<h3 class="hh">Past and finished · ${past.length}</h3><div class="sc-list fin">${past.slice(0, 40).map(t => rowHtml(t, true)).join('')}</div>` : '');
  }
  if (tab === 'subj') {
    const all = scOf('subject').sort((a, b) => a.name.localeCompare(b.name));
    return !all.length ? empty('book', 'Add the classes you take', `<button class="btn pri" data-act="scaddkind" data-kind="subject">Add a class</button>`) : `<div class="sc-cards">${all.map(s => { const t = scGet(s.teacherId), open = S.tasks.filter(x => !x.deleted && !x.log && x.status === 'open' && x.subjectId === s.id).length, ls = scOf('lesson').filter(l => l.subjectId === s.id).length; return `<button class="sc-card" style="--c:${s.color}" data-act="scedit" data-id="${s.id}"><span class="sc-ci">${iconAny(s.icon, 20, 'book')}</span><b>${esc(s.name)}</b><small>${esc([s.room, t && t.name].filter(Boolean).join(' · ')) || 'No room or teacher'}</small><small class="sc-cm">${ls} lesson${ls === 1 ? '' : 's'} a week${open ? ` · ${open} open task${open === 1 ? '' : 's'}` : ''}</small></button>`; }).join('')}</div>`;
  }
  if (tab === 'teach') { const all = scOf('teacher').sort((a, b) => a.name.localeCompare(b.name)); return !all.length ? empty('teacher', 'Add your teachers', `<button class="btn pri" data-act="scaddkind" data-kind="teacher">Add a teacher</button>`) : `<div class="sc-list">${all.map(t => `<button class="sc-row" data-act="scedit" data-id="${t.id}"><span class="sc-ci">${ic('teacher', 18)}</span><span class="sc-rt">${esc(t.name)}</span><small>${esc([t.email, t.phone].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`; }
  const all = scOf('snote').sort((a, b) => (b.u || 0) - (a.u || 0)); return !all.length ? empty('sticky', 'Jot down things for class', `<button class="btn pri" data-act="scaddkind" data-kind="snote">Add a note</button>`) : `<div class="sc-cards">${all.map(n => { const s = scSubj(n.subjectId); return `<button class="sc-card note" style="--c:${s ? s.color : 'var(--acc)'}" data-act="scedit" data-id="${n.id}"><b>${esc(n.title || 'Note')}</b><p>${esc((n.body || '').slice(0, 140))}</p>${scChip(s)}</button>`; }).join('')}</div>`;
}
const SC_TABS = [['today', 'Today', 'sun'], ['day', 'Day', 'calendar'], ['week', 'Week', 'table'], ['exam', 'Exams', 'exam'], ['hw', 'Homework', 'homework'], ['subj', 'Subjects', 'book'], ['teach', 'Teachers', 'teacher'], ['note', 'Notes', 'sticky']];
const SC_VIEWS = new Set(['today', 'day', 'week']);
// the planner's one icon button for switching to the classes (and the grid icon for going back): the graduation cap, whatever the thing is called
const ttModeSeg = () => (schoolOn()
  ? `<button class="ib on" data-act="scmode" data-m="plan" title="Back to the timetable" aria-label="Back to the timetable">${ic('table', 18)}</button>`
  : `<button class="ib" data-act="scmode" data-m="school" title="${esc(scName())}: lessons, exams and homework" aria-label="Open ${esc(scName())}">${ic('graduation', 18)}</button>`);
function renderSchool() {
  const tab = SC_TABS.some(x => x[0] === U.scTab) ? U.scTab : (scHas() ? 'today' : 'week'), date = U.scDate || new Date(), name = scName();
  const wt = scWeekType(tab === 'week' ? scWeekDates(date) : date);
  const nav = tab === 'week' || tab === 'day' ? `<button class="ib" data-act="scwk" data-d="-1" title="Previous ${tab === 'week' ? 'week' : 'day'}" aria-label="Previous ${tab === 'week' ? 'week' : 'day'}">${ic('left')}</button><button class="btn" data-act="scwk" data-d="0">${tab === 'week' ? (wt ? scWeekName(wt) : 'This week') : 'Today'}</button><button class="ib" data-act="scwk" data-d="1" title="Next ${tab === 'week' ? 'week' : 'day'}" aria-label="Next ${tab === 'week' ? 'week' : 'day'}">${ic('right')}</button>` : '';
  const addLabel = { exam: 'Exam', hw: 'Homework', subj: 'Class', teach: 'Teacher', note: 'Note' }[tab] || 'Add';
  const tools = `${nav}${ttModeSeg()}<button class="btn pri" data-act="scadd" title="Add a lesson, exam, homework, task, class…">${ic('plus', 16)}<span class="hide-m"> ${addLabel}</span></button><button class="ib" data-act="scset" title="${esc(name)} settings" aria-label="${esc(name)} settings">${ic('sliders')}</button>`;
  const title = esc(name) + (tab === 'week' || tab === 'day' ? '' : '');
  $('#main').innerHTML = topHtml(title, tools)
    + `<div class="sc-tabs" role="tablist" aria-label="${esc(name)} pages">${SC_TABS.map(([k, n, i]) => `<button class="${tab === k ? 'on' : ''}" data-act="sctab" data-t="${k}" role="tab" aria-selected="${tab === k}" aria-label="${n}" title="${n}">${ic(i, 16)}<span>${n}</span></button>`).join('')}</div>`
    + `<div class="body sc-body" data-v="${tab}"><div class="sc-wrap">${scTabHtml(tab)}</div></div>`;
  const g = $('#main .sc-grid');
  if (g && g.clientWidth) {
    const cols = scDays().length, cw = (g.clientWidth - (narrow(600) ? 40 : 56)) / Math.max(1, cols); g.dataset.d = scDensity(cw);
    // a name that would have to be broken in the middle of a word is replaced by its short code: nothing is ever cut off or slides
    for (const c of $$('.sc-c.has', g)) { const f = $('.sc-nf', c); c.classList.toggle('short', !!f && g.dataset.d !== 'xs' && f.scrollWidth > f.clientWidth + 1); }
  }
  fx('#main .sc-wrap', 'fade');
}

/* ---------- forms ---------- */
function scForm(title, fields, vals, onSave, onDel) {
  const row = x => {
    const v = vals[x.k] ?? '';
    if (x.t === 'select') return `<label>${x.l}<select data-k="${x.k}">${opts(x.o, v)}</select></label>`;
    if (x.t === 'area') return `<label>${x.l}<textarea data-k="${x.k}" rows="${x.r || 4}">${esc(v)}</textarea></label>`;
    if (x.t === 'check') return `<label class="chkl"><input type="checkbox" data-k="${x.k}"${v ? ' checked' : ''}> ${x.l}</label>`;
    if (x.t === 'color') return `<div class="lbl">Colour<div class="sw">${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === v ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div></div>`;
    if (x.t === 'icon') return `<details class="hb-more"${v ? ' open' : ''}><summary>Icon</summary><input type="search" data-isearch placeholder="Search icons" autocomplete="off"><div class="ic-scroll" data-ig>${iconGridHtml(v, vals.color || 'var(--acc)')}<p class="hint ic-none" hidden>No icon matches that.</p></div></details>`;
    return `<label>${x.l}<input data-k="${x.k}" type="${x.t || 'text'}" value="${esc(v)}"${x.p ? ` placeholder="${esc(x.p)}"` : ''}${x.m ? ` maxlength="${x.m}"` : ''}></label>`;
  };
  openModal(`<h3>${title}</h3><div class="form one">${fields.map(row).join('')}</div><div class="mact">${onDel ? '<button class="danger" data-m="del">Delete</button>' : ''}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    const st = { ...vals }, first = $('[data-k]', m); if (first && first.type === 'text' && !narrow(700)) first.focus();
    m.oninput = e => { if (e.target.dataset.isearch != null) iconFilter($('[data-ig]', m), e.target.value); };
    m.onclick = async e => {
      const b = e.target.closest('button'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.c) { st.color = b.dataset.c; $$('.sw button', m).forEach(x => x.classList.toggle('on', x === b)); return; }
      if (b.dataset.i != null) { st.icon = st.icon === b.dataset.i ? '' : b.dataset.i; $$('[data-ig] button', m).forEach(x => x.classList.toggle('on', x.dataset.i === st.icon)); return; }
      if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'del') { if (await askConfirm('Delete this?')) { closeModal(); onDel(); } }
      else if (b.dataset.m === 'save') { for (const el of $$('[data-k]', m)) st[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); if (onSave(st) !== false) closeModal(); }
    };
  });
}
const scSubjOpts = (none = 'No class') => [['', none], ...scOf('subject').sort((a, b) => a.name.localeCompare(b.name)).map(s => [s.id, s.name])];
const scTeachOpts = (none = 'No teacher') => [['', none], ...scOf('teacher').sort((a, b) => a.name.localeCompare(b.name)).map(t => [t.id, t.name])];
const scPut = (rec, old) => { if (old) Object.assign(old, rec); else S.school.push(rec); save(); render(); };
function scEdit(kind, id, pre = {}) {
  const old = id ? scGet(id) : null, v = { ...(old || {}), ...pre }, del = old ? () => { scRemove(old); } : null;
  if (kind === 'subject') scForm(old ? 'Edit class' : 'New class', [{ k: 'name', l: 'Name', p: 'Mathematics' }, { k: 'short', l: 'Short name (optional, up to 5 letters; used when there is little room)', p: 'Maths', m: 5 }, { k: 'room', l: 'Usual room' }, { k: 'teacherId', l: 'Teacher', t: 'select', o: scTeachOpts() }, { k: 'color', t: 'color' }, { k: 'icon', t: 'icon' }], { color: COLORS[scOf('subject').length % COLORS.length][0], ...v }, s => { if (!s.name) { toast('Give the class a name'); return false; } scPut({ id: old ? old.id : uid(), k: 'subject', name: s.name, short: s.short, room: s.room, teacherId: s.teacherId, color: s.color, icon: s.icon || '' }, old); }, del);
  else if (kind === 'teacher') scForm(old ? 'Edit teacher' : 'New teacher', [{ k: 'name', l: 'Name' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'phone', l: 'Phone', t: 'tel' }], v, s => { if (!s.name) { toast('Give the teacher a name'); return false; } scPut({ id: old ? old.id : uid(), k: 'teacher', name: s.name, email: s.email, phone: s.phone }, old); }, del);
  else if (kind === 'snote') scForm(old ? 'Edit note' : 'New note', [{ k: 'title', l: 'Title' }, { k: 'subjectId', l: 'Class', t: 'select', o: scSubjOpts() }, { k: 'body', l: 'Text', t: 'area', r: 8 }], v, s => { if (!s.title && !s.body) { toast('Write something first'); return false; } scPut({ id: old ? old.id : uid(), k: 'snote', title: s.title, subjectId: s.subjectId, body: s.body }, old); }, del);
  else if (kind === 'off') scOffDlg(old);
  else if (kind === 'lesson') { if (old) scLessonDlg(old.day, old.periodId); }
}
// removing something takes the things that pointed at it along gracefully: tasks keep existing, just unlinked
function scRemove(r) {
  S.school = S.school.filter(x => x !== r);
  const lessonGone = ids => { const set = new Set(ids); S.tasks.forEach(t => { if (t.lessonId && set.has(t.lessonId)) t.lessonId = null; }); S.school = S.school.filter(x => !(x.k === 'skip' && set.has(x.lessonId))); };
  if (r.k === 'subject') {
    const ls = S.school.filter(x => x.k === 'lesson' && x.subjectId === r.id).map(x => x.id); lessonGone(ls);
    S.school = S.school.filter(x => !(x.k === 'lesson' && x.subjectId === r.id)); S.school.forEach(x => { if (x.subjectId === r.id) x.subjectId = ''; });
    S.tasks.forEach(t => { if (t.subjectId === r.id) t.subjectId = ''; });
  }
  if (r.k === 'teacher') S.school.forEach(x => { if (x.teacherId === r.id) x.teacherId = ''; });
  if (r.k === 'lesson') lessonGone([r.id]);
  save(); render();
}
// add or change a lesson. From a cell the day and the period are fixed; from the Add menu they are chosen (and several days can be picked at once).
function scLessonDlg(day, pid, o = {}) {
  const base = U.scDate || new Date(), wt = scWeekType(scWeekDates(base)), c = scCfg(), pick = !!o.pick, per = scPeriods().filter(p => !p.brk);
  if (!per.length) { toast('Set the lesson times first'); scPeriodsDlg(); return; }
  if (!scOf('subject').length) { toast('Add a class first, then place it in the timetable'); scEdit('subject'); return; }
  const old = pick ? null : scLesson(day, pid, wt), ws = +S.settings.weekStart || 0, order = scCfg().days.length ? scDays() : [1, 2, 3, 4, 5];
  const st = { days: [day ?? order[0]], period: pid || per[0].id, subjectId: old ? old.subjectId : '', room: old ? old.room || '' : '', teacherId: old ? old.teacherId || '' : '', week: String(old ? old.week || 0 : c.ab ? wt : 0) };
  const pl = p => `${p.label || 'Lesson'} · ${fmtTime(p.start)} – ${fmtTime(p.end)}`;
  const heading = pick || !old ? 'New lesson' : 'Edit lesson', cur = scGet(st.period);
  openModal(`<h3>${heading}${pick ? '' : `<small class="sc-mh">${FULLDAYS[day]} · ${cur ? fmtTime(cur.start) + ' – ' + fmtTime(cur.end) : ''}</small>`}</h3><div class="form one">
<label>Class<select data-k="subjectId">${opts(scSubjOpts('Choose…'), st.subjectId)}</select></label>
${pick || !old ? `<div class="lbl">Days<div class="dayp">${order.map(n => `<button type="button" class="dp${st.days.includes(n) ? ' on' : ''}" data-d="${n}">${DAYS[n]}</button>`).join('')}</div></div>` : ''}
${pick ? `<label>Period<select data-k="period">${opts(per.map(p => [p.id, pl(p)]), st.period)}</select></label>` : ''}
<label>Room (if not the usual one)<input data-k="room" value="${esc(st.room)}" autocomplete="off"></label>
<label>Teacher (if not the usual one)<select data-k="teacherId">${opts(scTeachOpts("The class's teacher"), st.teacherId)}</select></label>
${c.ab ? `<label>Runs in<select data-k="week">${opts([['0', 'Every week'], ['1', 'Week A only'], ['2', 'Week B only']], st.week)}</select></label>` : ''}</div>
<div class="mact">${old ? '<button class="danger" data-m="del">Delete</button>' : ''}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    m.onclick = async e => {
      const b = e.target.closest('button'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.d != null) { const n = +b.dataset.d; st.days = st.days.includes(n) ? st.days.filter(x => x !== n) : [...st.days, n]; b.classList.toggle('on', st.days.includes(n)); return; }
      if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'del') { if (await askConfirm('Delete this lesson?')) { closeModal(); scRemove(old); } }
      else if (b.dataset.m === 'save') {
        for (const el of $$('[data-k]', m)) st[el.dataset.k] = el.value.trim();
        if (!st.subjectId) { toast('Choose a class'); return; }
        if (!st.days.length) { toast('Pick at least one day'); return; }
        const pidv = pick ? st.period : pid, weekv = +st.week || 0;
        if (old) { Object.assign(old, { subjectId: st.subjectId, room: st.room, teacherId: st.teacherId, week: weekv }); }
        else for (const dd of st.days) { const there = scOf('lesson').filter(x => x.day === dd && x.periodId === pidv && (!weekv || !x.week || x.week === weekv)); S.school = S.school.filter(x => !there.includes(x)); S.school.push({ id: uid(), k: 'lesson', day: dd, periodId: pidv, subjectId: st.subjectId, room: st.room, teacherId: st.teacherId, week: weekv }); }
        save(); closeModal(); render(); sfx('add');
      }
    };
  });
}
function scPeriodsDlg() {
  let rows = scPeriods().map(p => ({ ...p })); if (!rows.length) rows = [{ id: uid(), k: 'period', start: '08:00', end: '08:45', brk: false, label: '' }];
  const paint = m => { $('#scp', m).innerHTML = rows.map((p, i) => `<div class="scp-r"><input data-i="${i}" data-f="label" value="${esc(p.label)}" placeholder="${p.brk ? 'Break' : 'Lesson ' + (rows.slice(0, i + 1).filter(x => !x.brk).length)}" aria-label="Name"><input type="time" data-i="${i}" data-f="start" value="${p.start}" aria-label="Start"><input type="time" data-i="${i}" data-f="end" value="${p.end}" aria-label="End"><label class="chkl" title="A break is shown as a thin row"><input type="checkbox" data-i="${i}" data-f="brk"${p.brk ? ' checked' : ''}> break</label><button class="ib sm" data-rm="${i}" aria-label="Remove">${ic('x', 14)}</button></div>`).join(''); };
  openModal(`<h3>Lesson times</h3><p class="hint">One row per lesson or break. Lessons are placed in the weekly grid by these times, and drawn at these times on the main timetable.</p><div id="scp" class="scp"></div><div class="mrow"><button data-add="1">${ic('plus', 14)} Add a row</button></div><div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    paint(m);
    m.onchange = e => { const el = e.target, i = el.dataset.i; if (i == null) return; rows[i][el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.f === 'brk') paint(m); };
    m.onclick = e => {
      const b = e.target.closest('button'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.rm != null) { rows.splice(+b.dataset.rm, 1); paint(m); }
      else if (b.dataset.add) { const last = rows[rows.length - 1], s = last ? last.end : '08:00'; rows.push({ id: uid(), k: 'period', start: s, end: fmtHM(Math.min(1439, toMin(s) + 45)), brk: false, label: '' }); paint(m); }
      else if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'save') {
        if (rows.some(p => !validHM(p.start) || !validHM(p.end) || toMin(p.end) <= toMin(p.start))) { toast('Each row needs a start time before its end time'); return; }
        const keep = new Set(rows.map(p => p.id)), gone = S.school.filter(x => x.k === 'lesson' && !keep.has(x.periodId)).map(x => x.id);
        S.school = S.school.filter(x => x.k !== 'period' || keep.has(x.id)).filter(x => x.k !== 'lesson' || keep.has(x.periodId));
        if (gone.length) { const set = new Set(gone); S.tasks.forEach(t => { if (t.lessonId && set.has(t.lessonId)) t.lessonId = null; }); S.school = S.school.filter(x => !(x.k === 'skip' && set.has(x.lessonId))); }
        for (const p of rows) { const o = scGet(p.id); if (o) Object.assign(o, { start: p.start, end: p.end, brk: !!p.brk, label: p.label || '' }); else S.school.push({ id: p.id, k: 'period', start: p.start, end: p.end, brk: !!p.brk, label: p.label || '' }); }
        save(); closeModal(); render();
      }
    };
  });
}
function scOffDlg(old, back) {
  const v = old || { from: ymd(U.scDate || new Date()), to: '', label: '' };
  scForm(old ? 'Edit days off' : 'Days off', [{ k: 'label', l: 'What is it?', p: 'Half term, holiday, study leave' }, { k: 'from', l: 'First day', t: 'date' }, { k: 'to', l: 'Last day (blank = just that day)', t: 'date' }], v, s => {
    if (!s.from) { toast('Choose the first day'); return false; }
    if (s.to && s.to < s.from) { toast('The last day is before the first'); return false; }
    scPut({ id: old ? old.id : uid(), k: 'off', from: s.from, to: s.to && s.to !== s.from ? s.to : '', label: s.label }, old); if (back) back();
  }, old ? () => { scRemove(old); if (back) back(); } : null);
}
function scSettings() {
  const c = scCfg(), offs = () => scOf('off').sort((a, b) => a.from.localeCompare(b.from));
  const offLabel = o => `${fmtDate(o.from)}${o.to ? ' – ' + fmtDate(o.to) : ''}`;
  const draw = () => openModal(`<h3>${esc(scName())} settings</h3><div class="form one">
<label>Name<input id="sc-name" value="${esc(c.name || '')}" placeholder="Classes" maxlength="24" autocomplete="off" list="sc-names"><datalist id="sc-names">${SC_NAMES.map(n => `<option value="${n}">`).join('')}</datalist></label>
<div class="lbl">Days<div class="mrow tight">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="chkl"><input type="checkbox" data-d="${d}"${c.days.includes(d) ? ' checked' : ''}> ${DAYS[d]}</label>`).join('')}</div></div>
<label class="chkl"><input type="checkbox" id="sc-ab"${c.ab ? ' checked' : ''}> Alternate between week A and week B</label>
<label class="chkl"><input type="checkbox" id="sc-swap"${c.swap ? ' checked' : ''}> This week is the other one (swap A and B)</label>
<label class="chkl"><input type="checkbox" id="sc-show"${S.settings.tt.classes !== false ? ' checked' : ''}> Show lessons on the main timetable</label>
<label>Remind me before a lesson<select id="sc-rem">${opts([[0, 'Never'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before']], c.remind)}</select></label></div>
<div class="lbl sc-offs">Days off${offs().length ? `<div class="sc-offl-l">${offs().map(o => `<button class="sc-offr" data-off="${o.id}"><span>${esc(o.label || 'Day off')}</span><small>${esc(offLabel(o))}</small></button>`).join('')}</div>` : '<p class="hint">Holidays and breaks: lessons are hidden on these days.</p>'}<button data-m="addoff">${ic('plus', 14)} Add days off</button></div>
<div class="mrow"><button data-m="periods">${ic('clock', 15)} Lesson times…</button></div><div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => {
    const save1 = () => {
      const days = $$('[data-d]', m).filter(x => x.checked).map(x => +x.dataset.d); if (!days.length) { toast('Keep at least one day'); return false; }
      scCfgSet({ days, ab: $('#sc-ab', m).checked, swap: $('#sc-swap', m).checked, remind: +$('#sc-rem', m).value, name: $('#sc-name', m).value.trim().slice(0, 24) });
      S.settings.tt.classes = $('#sc-show', m).checked; save(); return true;
    };
    m.onchange = e => { if (e.target.id === 'sc-name') return; save1(); };
    m.oninput = e => { if (e.target.id === 'sc-name') scCfgSet({ name: e.target.value.trim().slice(0, 24) }); };
    m.onclick = e => {
      const off = e.target.closest('[data-off]'); if (off) { closeModal(); scOffDlg(scGet(off.dataset.off), scSettings); return; }
      const b = e.target.closest('button'); if (!b) { if (e.target.classList.contains('mback')) { save1(); closeModal(); render(); } return; }
      if (b.dataset.m === 'periods') { save1(); closeModal(); scPeriodsDlg(); }
      else if (b.dataset.m === 'addoff') { save1(); closeModal(); scOffDlg(null, scSettings); }
      else if (b.dataset.m === 'ok') { save1(); closeModal(); render(); }
    };
  });
  draw();
}

/* ---------- exams and homework: a small form that makes an ordinary task ---------- */
const scListLabel = id => { const projs = S.projects.filter(p => projectListIds(p).includes(id)).map(p => p.name); return listLabel(id) + (projs.length ? ' · ' + projs.join(', ') : ''); };
const scListOpts = () => [['inbox', 'Inbox'], ...listTree().map(({ l, depth }) => [l.id, ' '.repeat(depth) + (depth ? '↳ ' : '') + scListLabel(l.id)])];
// the list new class work goes to: the one it was last put in, else the "Classes" list if it exists
const scWorkList = () => (U.scList && S.lists.some(l => l.id === U.scList) ? U.scList : S.lists.some(l => l.id === 'list-classes') ? 'list-classes' : 'inbox');
function scWorkDlg(kind, pre = {}) {
  const exam = kind === 'exam', nl = pre.subjectId ? scNextLesson(pre.subjectId) : null;
  const v = { title: pre.title || '', subjectId: pre.subjectId || '', due: pre.due || (exam ? '' : nl ? nl.date : ''), time: pre.time || '', dur: pre.dur || 60, room: pre.room || '', listId: pre.listId || scWorkList(), priority: pre.priority || 0, notes: '', lessonId: pre.lessonId || (nl && !pre.due ? nl.l.id : '') };
  openModal(`<h3>${ic(exam ? 'exam' : 'homework', 18)} New ${exam ? 'exam' : 'homework'}</h3><div class="form one">
<label>${exam ? 'Title' : 'What to do'}<input id="sw-title" value="${esc(v.title)}" placeholder="${exam ? 'Chapter 4 test' : 'Exercises 3 to 8'}" autocomplete="off"></label>
<label>Class<select id="sw-subj" data-k="subjectId">${opts(scSubjOpts(), v.subjectId)}</select></label>
<div class="two"><label>${exam ? 'Date' : 'Due'}<input type="date" id="sw-due" value="${v.due}"></label>${exam ? `<label>Starts at<input type="time" id="sw-time" value="${v.time}"></label>` : '<div></div>'}</div>
${exam ? `<div class="lbl">Length${durHtml('sw', v.dur)}</div><label>Room or place<input id="sw-room" value="${esc(v.room)}" autocomplete="off"></label>` : '<div class="chips" id="sw-quick"></div>'}
<label>List<select id="sw-list">${opts(scListOpts(), v.listId)}</select></label>
<label>Priority<select id="sw-pri">${opts(PRIO.map((n, i) => [i, n]).reverse(), v.priority)}</select></label>
<label>Notes<textarea id="sw-notes" rows="3" placeholder="Optional"></textarea></label></div>
<div class="mact"><button data-m="more">More options…</button><span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok">Add</button></div>`, m => {
    const t = $('#sw-title', m), due = $('#sw-due', m), subj = $('#sw-subj', m); if (t.focus && !narrow(700)) t.focus();
    let lesson = v.lessonId;
    const quick = () => { // homework: "next lesson of this class" in one tap
      const box = $('#sw-quick', m); if (!box) return; const n = subj.value ? scNextLesson(subj.value) : null;
      box.innerHTML = n ? `<button type="button" class="btn sm" data-nl="1">${ic('table', 13)} Next ${esc((scSubj(subj.value) || {}).name || 'lesson')}: ${esc(fmtDate(n.date))}, ${fmtTime(n.p.start)}</button>` : '';
    };
    quick();
    m.onchange = e => { if (e.target === subj) { lesson = ''; quick(); } else if (e.target === due) lesson = lesson && scGet(lesson) && scGet(lesson).day === (due.value ? pYmd(due.value).getDay() : -1) ? lesson : ''; };
    const make = more => {
      const title = t.value.trim(); if (!title) { toast(exam ? 'Give the exam a title' : 'Say what the homework is'); t.focus(); return; }
      const box = $('[data-dur=sw]', m), tm = exam ? $('#sw-time', m).value : '';
      const task = newTask({ title, notes: $('#sw-notes', m).value, listId: $('#sw-list', m).value || 'inbox', due: due.value || null, time: tm || null, priority: +$('#sw-pri', m).value || 0, kind, ...(subj.value ? { subjectId: subj.value } : {}), ...(exam && tm ? { dur: durRead(box) || 60 } : {}), ...(exam && $('#sw-room', m).value.trim() ? { room: $('#sw-room', m).value.trim() } : {}), ...(lesson ? { lessonId: lesson } : {}) });
      U.scList = task.listId; S.tasks.push(task); if (more) U.sel = task.id; save(); closeModal(); sfx('add'); if (task.due) U.ttDate = pYmd(task.due); refresh();
    };
    m.oninput = e => { if (e.target.closest && e.target.closest('[data-dur]')) durMark($('[data-dur=sw]', m), durRead($('[data-dur=sw]', m)) || 0); };
    m.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing && e.target.id === 'sw-title') { e.preventDefault(); make(false); } };
    m.onclick = e => {
      const dp = e.target.closest('[data-dp]'); if (dp) { durSet($('[data-dur=sw]', m), +dp.dataset.dp || 0); return; }
      const nlb = e.target.closest('[data-nl]'); if (nlb && subj.value) { const n = scNextLesson(subj.value); if (n) { due.value = n.date; lesson = n.l.id; } return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') closeModal(); else if (b.dataset.m === 'ok') make(false); else if (b.dataset.m === 'more') make(true);
    };
  }, 'wide');
}

/* ---------- a lesson on a date: what it is, the tasks for it, and the things to do with it ---------- */
function scLessonSheet(lid, k) {
  const l = scGet(lid); if (!l) return;
  const date = pYmd(k), s = scSubj(l.subjectId), p = scGet(l.periodId), t = scTeacherOf(l, s), room = scRoom(l, s);
  const tasks = () => S.tasks.filter(x => !x.deleted && !x.log && x.due === k && (x.lessonId === lid || (!x.lessonId && !x.time && s && x.subjectId === s.id))).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.priority - a.priority);
  const lines = () => { const ts = tasks(); return ts.length ? ts.map(scTaskLine).join('') : '<p class="hint">Nothing for this lesson yet.</p>'; };
  const gone = scSkipped(lid, k), nextOf = s ? scNextLesson(s.id, addDays(date, 0)) : null;
  openModal(`<h3 class="sc-lh" style="--c:${scColor(s)}"><span class="sc-lbar"></span>${s ? iconAny(s.icon, 20) : ''}<span>${esc(s ? s.name : 'Lesson')}</span></h3>
<p class="sc-lm"><b>${esc(FULLDAYS[date.getDay()])} ${date.getDate()} ${esc(MONTHS[date.getMonth()])}</b> · ${p ? fmtRange(p.start, p.end) + ' · ' + fmtDur(toMin(p.end) - toMin(p.start)) : ''}${room ? ` · ${ic('pin', 12)} ${esc(room)}` : ''}${t ? ` · ${ic('teacher', 12)} ${esc(t.name)}` : ''}${gone ? ' · <span class="sc-x">Cancelled this day</span>' : ''}</p>
<div class="lbl tl">Tasks for this lesson<div id="sl-ltasks" class="sc-ltasks">${lines()}</div><input id="sl-ladd" placeholder="+ Add a task for this lesson  (try “Read chapter 4 !high”)" autocomplete="off"></div>
<div class="mrow"><button data-m="hw">${ic('homework', 14)} Homework…</button><button data-m="ex">${ic('exam', 14)} Exam…</button>${s ? '<button data-m="cls">Open the class</button>' : ''}</div>
<div class="mrow"><button data-m="edit">${ic('sliders', 14)} Edit this lesson</button><button data-m="skip">${gone ? 'Restore this lesson' : 'Cancel this lesson on this day'}</button></div>
<div class="mact"><span class="sp"></span><button class="pri" data-m="ok">Done</button></div>`, m => {
    const ctx = { due: k, subjectId: s ? s.id : '', lessonId: lid };
    m.onkeydown = e => {
      if (e.key !== 'Enter' || e.isComposing || e.target.id !== 'sl-ladd' || !e.target.value.trim()) return;
      const tk = quickAdd(e.target.value.trim(), { due: k, ...(s ? { subjectId: s.id } : {}) }); tk.lessonId = lid; if (s && !tk.subjectId) tk.subjectId = s.id; save();
      e.target.value = ''; $('#sl-ltasks', m).innerHTML = lines(); renderSide(); renderMain();
    };
    m.onclick = e => {
      const op = e.target.closest('[data-act=open]'), tg = e.target.closest('[data-act=toggle]');
      if (tg) { const x = getT(tg.dataset.id); if (x) { toggleDone(x); $('#sl-ltasks', m).innerHTML = lines(); renderSide(); renderMain(); } return; }
      if (op) { closeModal(); U.sel = op.dataset.id; U.page = U.page || 'timetable'; refresh(); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      const a = b.dataset.m;
      if (a === 'ok') closeModal();
      else if (a === 'hw' || a === 'ex') { closeModal(); scWorkDlg(a === 'ex' ? 'exam' : 'homework', { ...ctx, due: a === 'ex' ? k : (nextOf ? nextOf.date : ''), lessonId: a === 'ex' ? lid : (nextOf ? nextOf.l.id : ''), time: a === 'ex' && p ? p.start : '', dur: a === 'ex' && p ? toMin(p.end) - toMin(p.start) : 60 }); }
      else if (a === 'cls') { closeModal(); scEdit('subject', s.id); }
      else if (a === 'edit') { closeModal(); scLessonDlg(l.day, l.periodId); }
      else if (a === 'skip') { scSetSkip(lid, k, !gone); closeModal(); render(); toast(gone ? 'Lesson restored' : 'Lesson cancelled for that day'); }
    };
  }, 'wide');
}
// what the "Add" button offers on the classes pages and on the main timetable
async function scAddMenu(pre = {}) {
  const items = [{ label: 'Lesson', k: 'lesson' }, { label: 'Exam', k: 'exam' }, { label: 'Homework', k: 'homework' }, { label: 'Task', k: 'task' }, { label: 'Weekly slot', k: 'slot' }, { label: 'Class (subject)', k: 'subject' }, { label: 'Teacher', k: 'teacher' }, { label: 'Note', k: 'snote' }, { label: 'Days off', k: 'off' }];
  const i = await askMenu('Add…', items.filter(x => !(pre.only && !pre.only.includes(x.k)))); if (i == null) return;
  const k = items.filter(x => !(pre.only && !pre.only.includes(x.k)))[i].k;
  if (k === 'lesson') scLessonDlg(pre.day ?? (U.scDate || new Date()).getDay(), pre.pid, { pick: true });
  else if (k === 'exam' || k === 'homework') scWorkDlg(k, { due: pre.date || '' });
  else if (k === 'task') openTTCreate({ date: pre.date || ymd(U.scDate || new Date()) });
  else if (k === 'slot') { U.ttKind = 'slot'; openTTCreate({ date: pre.date || ymd(U.scDate || new Date()) }); }
  else scEdit(k);
}
// a notification shortly before each lesson starts (called with the other reminders)
function schoolRemind() {
  const c = scCfg(); if (!c.remind) return false; const now = Date.now(), today = new Date(), k = ymd(today); let changed = false;
  for (const { p, l } of scDayLessons(today)) {
    const at = new Date(`${k}T${p.start}`).getTime() - c.remind * 60000, end = new Date(`${k}T${p.end}`).getTime(), key = `s|${l.id}|${k}|${p.start}|${c.remind}`, s = scSubj(l.subjectId);
    if (now >= at && now < end && !S.fired[key]) { S.fired[key] = 1; changed = true; notify((s ? s.name : 'Lesson') + ' starts soon', `${fmtRange(p.start, p.end)}${scRoom(l, s) ? ' · ' + scRoom(l, s) : ''}`); sfx('chime'); }
  }
  return changed;
}
const SC_ACT = {
  scmode: el => { S.settings.tt.mode = el.dataset.m === 'school' ? 'school' : 'plan'; if (S.settings.tt.mode === 'school') U.scDate = U.ttDate || U.scDate || new Date(); save(); fx('#main > *:not(.top)', 'fade'); render(); },
  sctab: el => { U.scTab = el.dataset.t; renderMain(); },
  scwk: el => { const d = +el.dataset.d, step = (U.scTab === 'week' ? 7 : 1); U.scDate = d ? addDays(U.scDate || new Date(), d * step) : new Date(); renderMain(); },
  scjump: el => { U.scDate = pYmd(el.dataset.d); if (U.scTab === 'week') U.scTab = 'day'; renderMain(); },
  scsetup: () => { scSeedPeriods(); renderMain(); },
  scperiods: () => scPeriodsDlg(),
  scset: () => scSettings(),
  sccell: el => scLessonDlg(+el.dataset.day, el.dataset.p),
  sclesson: el => scLessonSheet(el.dataset.lid, el.dataset.date),
  scedit: el => { const r = scGet(el.dataset.id); if (r) scEdit(r.k, r.id); },
  scaddkind: el => scEdit(el.dataset.kind),
  scaddwork: el => scWorkDlg(el.dataset.kind),
  nextlesson: () => { const t = getT(U.sel); if (!t || !t.subjectId) return; const n = scNextLesson(t.subjectId); if (!n) { toast('No upcoming lesson of this class'); return; } t.due = n.date; t.lessonId = n.l.id; save(); refresh(); },
  scadd: () => { const t = U.scTab || 'today'; if (t === 'exam' || t === 'hw') scWorkDlg(t === 'exam' ? 'exam' : 'homework'); else if (t === 'subj') scEdit('subject'); else if (t === 'teach') scEdit('teacher'); else if (t === 'note') scEdit('snote'); else scAddMenu({ date: ymd(U.scDate || new Date()) }); },
};
