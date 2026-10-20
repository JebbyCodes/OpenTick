/* OpenTick school timetable: the classic school week, kept apart from tasks on purpose (none of it shows up in Today, lists,
   the matrix or the calendar). It follows the features of the open-source "Timetable" app (flxholle / asdoi): lesson periods with
   times, subjects with a colour, room and teacher, teachers, a weekly grid (optionally alternating A / B weeks), what is on now
   and next, homework, exams, notes, a reminder before a lesson, and it travels with your backup and sync like everything else.
   All of it lives in one synced collection, S.school, of small records told apart by `k`:
   cfg · period · subject · teacher · lesson · homework · exam · snote. */
const SC_DEF = { id: 'school-cfg', k: 'cfg', days: [1, 2, 3, 4, 5], ab: false, swap: false, remind: 5 };
const scOf = k => S.school.filter(r => r.k === k), scGet = id => S.school.find(r => r.id === id);
const scCfg = () => scGet('school-cfg') || SC_DEF;
function scCfgSet(p) { let c = scGet('school-cfg'); if (!c) { c = { ...SC_DEF }; S.school.push(c); } Object.assign(c, p); save(); }
const scPeriods = () => scOf('period').sort((a, b) => a.start.localeCompare(b.start));
const scDays = () => { const ws = S.settings.weekStart || 0; return [...scCfg().days].sort((a, b) => ((a - ws + 7) % 7) - ((b - ws + 7) % 7)); };
const schoolOn = () => (S.settings.tt || {}).mode === 'school';
const scSubj = id => scGet(id) && scGet(id).k === 'subject' ? scGet(id) : null;
const scTeacherOf = (l, s) => scGet(l.teacherId || (s && s.teacherId) || '');
function isoWeekNo(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); }
// 0 when weeks do not alternate, else 1 (week A) or 2 (week B)
const scWeekType = d => { const c = scCfg(); return c.ab ? ((isoWeekNo(d) % 2) ^ (c.swap ? 1 : 0) ? 1 : 2) : 0; };
const scWeekName = wt => (wt === 1 ? 'Week A' : wt === 2 ? 'Week B' : '');
// the lesson in a cell: one made for this week type wins over one that runs every week
function scLesson(day, pid, wt) { const ls = scOf('lesson').filter(l => l.day === day && l.periodId === pid && (!wt || !l.week || l.week === wt)); return ls.find(l => l.week === wt && wt) || ls[0] || null; }
function scDayLessons(date) { const wt = scWeekType(date), day = date.getDay(); return scPeriods().filter(p => !p.brk).map(p => ({ p, l: scLesson(day, p.id, wt) })).filter(x => x.l); }
function scNowNext() {
  const n = new Date(), m = n.getHours() * 60 + n.getMinutes(), items = scDayLessons(n).map(x => ({ ...x, a: toMin(x.p.start), b: toMin(x.p.end) }));
  return { cur: items.find(x => m >= x.a && m < x.b) || null, next: items.find(x => x.a > m) || null, m };
}
const scDue = k => { if (!k) return ''; const d = dayDiff(k, todayStr()); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : d > 1 && d < 15 ? `In ${d} days` : d < 0 && d > -15 ? `${-d} days ago` : fmtDate(k); };
function scSeedPeriods() {
  [['08:00', '08:45'], ['08:50', '09:35'], ['09:35', '09:55', 1], ['09:55', '10:40'], ['10:45', '11:30'], ['11:35', '12:20'], ['12:20', '13:00', 1], ['13:00', '13:45'], ['13:50', '14:35']].forEach(([start, end, brk], i) => S.school.push({ id: uid(), k: 'period', start, end, brk: !!brk, label: brk ? (i === 2 ? 'Break' : 'Lunch') : '' }));
  save();
}
// one compact button (a segmented switch made the planner's header wrap onto a second row): the school cap in the planner, the grid in school
const ttModeSeg = () => (schoolOn()
  ? `<button class="ib on" data-act="scmode" data-m="plan" title="Back to the planner" aria-label="Back to the planner">${ic('table', 18)}</button>`
  : `<button class="ib" data-act="scmode" data-m="school" title="School timetable (lessons, homework, exams)" aria-label="Open the school timetable">${ic('graduation', 18)}</button>`);
const SC_TABS = [['week', 'Timetable', 'table'], ['today', 'Today', 'sun'], ['hw', 'Homework', 'homework'], ['exam', 'Exams', 'exam'], ['subj', 'Subjects', 'book'], ['teach', 'Teachers', 'teacher'], ['note', 'Notes', 'sticky']];
const scChip = s => (s ? `<span class="sc-chip" style="--c:${s.color}">${iconAny(s.icon, 13)}<span>${esc(s.name)}</span></span>` : '');

/* ---------- pages ---------- */
function scGridHtml() {
  const days = scDays(), per = scPeriods(), off = U.scWeek || 0, base = addDays(new Date(), off * 7), td = todayStr(), nn = scNowNext();
  if (!per.length) return `<div class="empty">${ic('table', 44)}<p>Set up your lesson times first</p><button class="btn pri" data-act="scsetup">Use a standard school day</button><button class="btn" data-act="scperiods">Enter them myself</button></div>`;
  const ws = S.settings.weekStart || 0, ws0 = addDays(base, -((base.getDay() - ws + 7) % 7)), wk = days.map(d => addDays(ws0, (d - ws + 7) % 7));
  let n = 0, h = `<div class="sc-grid" style="--cols:${days.length}"><div class="sc-h"></div>${days.map((d, i) => `<div class="sc-h${off === 0 && wk[i] && ymd(wk[i]) === td ? ' today' : ''}">${DAYS[d]}${wk[i] ? `<small>${wk[i].getDate()}</small>` : ''}</div>`).join('')}`;
  const wt = scWeekType(base);
  for (const p of per) {
    if (p.brk) { h += `<div class="sc-brk"><span>${esc(p.label || 'Break')}</span><small>${fmtTime(p.start)} – ${fmtTime(p.end)}</small></div>`; continue; }
    n++; h += `<div class="sc-p"><b>${esc(p.label || n)}</b><small>${fmtTime(p.start)}</small><small>${fmtTime(p.end)}</small></div>`;
    for (const d of days) {
      const l = scLesson(d, p.id, wt), s = l && scSubj(l.subjectId), t = l && scTeacherOf(l, s), isNow = nn.cur && off === 0 && nn.cur.p.id === p.id && d === new Date().getDay();
      h += l ? `<button class="sc-c has${isNow ? ' now' : ''}" style="--c:${s ? s.color : 'var(--muted)'}" data-act="sccell" data-day="${d}" data-p="${p.id}" title="${esc((s ? s.name : 'Lesson') + (l.room || (s && s.room) ? ' · ' + (l.room || s.room) : '') + (t ? ' · ' + t.name : ''))}"><span class="sc-n mq">${s ? iconAny(s.icon, 13) : ''}${esc(s ? s.name : 'Lesson')}</span><small class="mq">${esc([l.room || (s && s.room), t && t.name].filter(Boolean).join(' · '))}</small>${l.week ? `<i class="sc-w">${l.week === 1 ? 'A' : 'B'}</i>` : ''}</button>`
        : `<button class="sc-c" data-act="sccell" data-day="${d}" data-p="${p.id}" aria-label="Add a lesson on ${FULLDAYS[d]}, ${fmtTime(p.start)}">${ic('plus', 14)}</button>`;
    }
  }
  return h + '</div>';
}
function scTodayHtml() {
  const nn = scNowNext(), td = todayStr(), items = scDayLessons(new Date());
  const card = (lab, x) => { if (!x) return ''; const s = scSubj(x.l.subjectId), t = scTeacherOf(x.l, s); return `<div class="sc-now" style="--c:${s ? s.color : 'var(--acc)'}"><span class="sc-nl">${lab}</span><b>${iconAny(s && s.icon, 18)} ${esc(s ? s.name : 'Lesson')}</b><span>${fmtRange(x.p.start, x.p.end)}${x.l.room || (s && s.room) ? ' · ' + esc(x.l.room || s.room) : ''}${t ? ' · ' + esc(t.name) : ''}</span></div>`; };
  const hw = scOf('homework').filter(x => !x.done && x.due && dayDiff(x.due, td) <= 7).sort((a, b) => a.due.localeCompare(b.due)), ex = scOf('exam').filter(x => x.date && dayDiff(x.date, td) >= 0 && dayDiff(x.date, td) <= 21).sort((a, b) => a.date.localeCompare(b.date));
  return `<div class="sc-today"><div class="sc-nn">${card('Now', nn.cur) || '<div class="sc-now idle"><span class="sc-nl">Now</span><b>No lesson right now</b></div>'}${card('Next', nn.next)}</div>`
    + `<h3 class="hh">${ic('table', 16)} ${esc(FULLDAYS[new Date().getDay()])}${scWeekType(new Date()) ? ' · ' + scWeekName(scWeekType(new Date())) : ''}</h3>${items.length ? `<div class="sc-list">${items.map(x => { const s = scSubj(x.l.subjectId); return `<button class="sc-row" style="--c:${s ? s.color : 'var(--muted)'}" data-act="sccell" data-day="${new Date().getDay()}" data-p="${x.p.id}"><time>${fmtTime(x.p.start)}</time><span class="sc-bar"></span><span class="sc-rt mq">${s ? iconAny(s.icon, 15) : ''} ${esc(s ? s.name : 'Lesson')}</span><small>${esc(x.l.room || (s && s.room) || '')}</small></button>`; }).join('')}</div>` : '<p class="hint">No lessons today.</p>'}`
    + (hw.length ? `<h3 class="hh">${ic('homework', 16)} Homework due soon</h3><div class="sc-list">${hw.map(scHwRow).join('')}</div>` : '') + (ex.length ? `<h3 class="hh">${ic('exam', 16)} Coming up</h3><div class="sc-list">${ex.map(scExamRow).join('')}</div>` : '') + '</div>';
}
const scHwRow = h => { const s = scSubj(h.subjectId), late = !h.done && h.due && dayDiff(h.due, todayStr()) < 0; return `<div class="sc-row hw${h.done ? ' fin' : ''}" style="--c:${s ? s.color : 'var(--muted)'}"><button class="chk${h.done ? ' on' : ''}" data-act="schwtog" data-id="${h.id}" aria-label="Mark done">${h.done ? ic('check', 13) : ''}</button><button class="sc-rb" data-act="scedit" data-id="${h.id}"><span class="sc-rt mq">${esc(h.title || 'Homework')}</span>${scChip(s)}${h.due ? `<em class="${late ? 'late' : ''}">${esc(scDue(h.due))}</em>` : ''}</button></div>`; };
const scExamRow = x => { const s = scSubj(x.subjectId); return `<button class="sc-row" style="--c:${s ? s.color : 'var(--muted)'}" data-act="scedit" data-id="${x.id}"><span class="sc-bar"></span><span class="sc-rt mq">${esc(x.title || 'Exam')}</span>${scChip(s)}<em>${esc(scDue(x.date))}${x.time ? ' · ' + fmtTime(x.time) : ''}</em></button>`; };
function scTabHtml(tab) {
  const empty = (ico, msg, btn) => `<div class="empty">${ic(ico, 44)}<p>${msg}</p>${btn || ''}</div>`;
  if (tab === 'week') return scGridHtml();
  if (tab === 'today') return scTodayHtml();
  if (tab === 'hw') { const all = scOf('homework'), open = all.filter(h => !h.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')), done = all.filter(h => h.done); return !all.length ? empty('homework', 'No homework yet') : (open.length ? `<div class="sc-list">${open.map(scHwRow).join('')}</div>` : '<p class="hint">All done. Nice.</p>') + (done.length ? `<h3 class="hh">${ic('check-circle', 16)} Done · ${done.length}</h3><div class="sc-list">${done.map(scHwRow).join('')}</div>` : ''); }
  if (tab === 'exam') { const all = scOf('exam').sort((a, b) => (a.date || '9').localeCompare(b.date || '9')), td = todayStr(), up = all.filter(x => !x.date || dayDiff(x.date, td) >= 0), past = all.filter(x => x.date && dayDiff(x.date, td) < 0); return !all.length ? empty('exam', 'No exams yet') : (up.length ? `<div class="sc-list">${up.map(scExamRow).join('')}</div>` : '') + (past.length ? `<h3 class="hh">Past</h3><div class="sc-list fin">${past.map(scExamRow).join('')}</div>` : ''); }
  if (tab === 'subj') { const all = scOf('subject').sort((a, b) => a.name.localeCompare(b.name)); return !all.length ? empty('book', 'Add the subjects you take') : `<div class="sc-cards">${all.map(s => { const t = scGet(s.teacherId); return `<button class="sc-card" style="--c:${s.color}" data-act="scedit" data-id="${s.id}"><span class="sc-ci">${iconAny(s.icon, 20, 'book')}</span><b class="mq">${esc(s.name)}</b><small class="mq">${esc([s.room, t && t.name].filter(Boolean).join(' · ')) || 'No room or teacher'}</small></button>`; }).join('')}</div>`; }
  if (tab === 'teach') { const all = scOf('teacher').sort((a, b) => a.name.localeCompare(b.name)); return !all.length ? empty('teacher', 'Add your teachers') : `<div class="sc-list">${all.map(t => `<button class="sc-row" data-act="scedit" data-id="${t.id}"><span class="sc-ci">${ic('teacher', 18)}</span><span class="sc-rt mq">${esc(t.name)}</span><small class="mq">${esc([t.email, t.phone].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>`; }
  const all = scOf('snote').sort((a, b) => (b.u || 0) - (a.u || 0)); return !all.length ? empty('sticky', 'Jot down things for school') : `<div class="sc-cards">${all.map(n => { const s = scSubj(n.subjectId); return `<button class="sc-card note" style="--c:${s ? s.color : 'var(--acc)'}" data-act="scedit" data-id="${n.id}"><b class="mq">${esc(n.title || 'Note')}</b><p>${esc((n.body || '').slice(0, 140))}</p>${scChip(s)}</button>`; }).join('')}</div>`;
}
function renderSchool() {
  const tab = U.scTab || 'week', c = scCfg(), off = U.scWeek || 0, wt = scWeekType(addDays(new Date(), off * 7));
  const addLabel = { week: 'Lesson', today: 'Homework', hw: 'Homework', exam: 'Exam', subj: 'Subject', teach: 'Teacher', note: 'Note' }[tab];
  const nav = tab === 'week' ? `<button class="ib" data-act="scwk" data-d="-1" title="Previous week">${ic('left')}</button><button class="btn" data-act="scwk" data-d="0">${wt ? scWeekName(wt) : 'This week'}</button><button class="ib" data-act="scwk" data-d="1" title="Next week">${ic('right')}</button>` : '';
  const tools = `${nav}${ttModeSeg()}<button class="btn pri" data-act="scadd">${ic('plus', 16)}<span class="hide-m"> ${addLabel}</span></button><button class="ib" data-act="scset" title="School timetable settings">${ic('sliders')}</button>`;
  $('#main').innerHTML = topHtml('School', tools)
    + `<div class="sc-tabs" role="tablist">${SC_TABS.map(([k, n, i]) => `<button class="${tab === k ? 'on' : ''}" data-act="sctab" data-t="${k}" role="tab">${ic(i, 16)}<span>${n}</span></button>`).join('')}</div>`
    + `<div class="body sc-body"><div class="sc-wrap">${scTabHtml(tab)}</div></div>`;
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
    return `<label>${x.l}<input data-k="${x.k}" type="${x.t || 'text'}" value="${esc(v)}"${x.p ? ` placeholder="${esc(x.p)}"` : ''}></label>`;
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
const scSubjOpts = (none = 'No subject') => [['', none], ...scOf('subject').sort((a, b) => a.name.localeCompare(b.name)).map(s => [s.id, s.name])];
const scTeachOpts = (none = 'No teacher') => [['', none], ...scOf('teacher').sort((a, b) => a.name.localeCompare(b.name)).map(t => [t.id, t.name])];
const scPut = (rec, old) => { if (old) Object.assign(old, rec); else S.school.push(rec); save(); render(); };
function scEdit(kind, id, pre = {}) {
  const old = id ? scGet(id) : null, v = { ...(old || {}), ...pre }, del = old ? () => { scRemove(old); } : null;
  if (kind === 'subject') scForm(old ? 'Edit subject' : 'New subject', [{ k: 'name', l: 'Name', p: 'Mathematics' }, { k: 'room', l: 'Usual room' }, { k: 'teacherId', l: 'Teacher', t: 'select', o: scTeachOpts() }, { k: 'color', t: 'color' }, { k: 'icon', t: 'icon' }], { color: COLORS[scOf('subject').length % COLORS.length][0], ...v }, s => { if (!s.name) { toast('Give the subject a name'); return false; } scPut({ id: old ? old.id : uid(), k: 'subject', name: s.name, room: s.room, teacherId: s.teacherId, color: s.color, icon: s.icon || '' }, old); }, del);
  else if (kind === 'teacher') scForm(old ? 'Edit teacher' : 'New teacher', [{ k: 'name', l: 'Name' }, { k: 'email', l: 'Email', t: 'email' }, { k: 'phone', l: 'Phone', t: 'tel' }], v, s => { if (!s.name) { toast('Give the teacher a name'); return false; } scPut({ id: old ? old.id : uid(), k: 'teacher', name: s.name, email: s.email, phone: s.phone }, old); }, del);
  else if (kind === 'homework') scForm(old ? 'Edit homework' : 'New homework', [{ k: 'title', l: 'What to do' }, { k: 'subjectId', l: 'Subject', t: 'select', o: scSubjOpts() }, { k: 'due', l: 'Due', t: 'date' }, { k: 'notes', l: 'Notes', t: 'area' }, { k: 'done', l: 'Done', t: 'check' }], v, s => { if (!s.title) { toast('Say what the homework is'); return false; } scPut({ id: old ? old.id : uid(), k: 'homework', title: s.title, subjectId: s.subjectId, due: s.due, notes: s.notes, done: !!s.done }, old); }, del);
  else if (kind === 'exam') scForm(old ? 'Edit exam' : 'New exam', [{ k: 'title', l: 'Title', p: 'Chapter 4 test' }, { k: 'subjectId', l: 'Subject', t: 'select', o: scSubjOpts() }, { k: 'date', l: 'Date', t: 'date' }, { k: 'time', l: 'Time', t: 'time' }, { k: 'room', l: 'Room' }, { k: 'notes', l: 'Notes', t: 'area' }], v, s => { if (!s.title) { toast('Give the exam a title'); return false; } scPut({ id: old ? old.id : uid(), k: 'exam', title: s.title, subjectId: s.subjectId, date: s.date, time: s.time, room: s.room, notes: s.notes }, old); }, del);
  else if (kind === 'snote') scForm(old ? 'Edit note' : 'New note', [{ k: 'title', l: 'Title' }, { k: 'subjectId', l: 'Subject', t: 'select', o: scSubjOpts() }, { k: 'body', l: 'Text', t: 'area', r: 8 }], v, s => { if (!s.title && !s.body) { toast('Write something first'); return false; } scPut({ id: old ? old.id : uid(), k: 'snote', title: s.title, subjectId: s.subjectId, body: s.body }, old); }, del);
}
function scRemove(r) {
  S.school = S.school.filter(x => x !== r);
  if (r.k === 'subject') { S.school = S.school.filter(x => !(x.k === 'lesson' && x.subjectId === r.id)); S.school.forEach(x => { if (x.subjectId === r.id) x.subjectId = ''; }); }
  if (r.k === 'teacher') S.school.forEach(x => { if (x.teacherId === r.id) x.teacherId = ''; });
  save(); render();
}
function scLessonDlg(day, pid) {
  const per = scGet(pid), wt = scWeekType(addDays(new Date(), (U.scWeek || 0) * 7)), old = scLesson(day, pid, wt), c = scCfg();
  if (!scOf('subject').length && !old) { toast('Add a subject first, then place it in the timetable'); U.scTab = 'subj'; renderMain(); scEdit('subject'); return; }
  const v = old || { week: c.ab ? wt : 0 };
  scForm(`${FULLDAYS[day]} · ${fmtTime(per.start)} – ${fmtTime(per.end)}`, [{ k: 'subjectId', l: 'Subject', t: 'select', o: scSubjOpts('Choose…') }, { k: 'room', l: 'Room (if not the usual one)' }, { k: 'teacherId', l: 'Teacher (if not the usual one)', t: 'select', o: scTeachOpts('The subject\'s teacher') }, ...(c.ab ? [{ k: 'week', l: 'Runs in', t: 'select', o: [['0', 'Every week'], ['1', 'Week A only'], ['2', 'Week B only']] }] : [])], { ...v, week: String(v.week || 0) }, s => {
    if (!s.subjectId) { toast('Choose a subject'); return false; }
    S.school = S.school.filter(x => x !== old); S.school.push({ id: old ? old.id : uid(), k: 'lesson', day, periodId: pid, subjectId: s.subjectId, room: s.room, teacherId: s.teacherId, week: +s.week || 0 }); save(); render();
  }, old ? () => scRemove(old) : null);
}
function scPeriodsDlg() {
  let rows = scPeriods().map(p => ({ ...p })); if (!rows.length) rows = [{ id: uid(), k: 'period', start: '08:00', end: '08:45', brk: false, label: '' }];
  const paint = m => { $('#scp', m).innerHTML = rows.map((p, i) => `<div class="scp-r"><input data-i="${i}" data-f="label" value="${esc(p.label)}" placeholder="${p.brk ? 'Break' : 'Lesson ' + (rows.slice(0, i + 1).filter(x => !x.brk).length)}" aria-label="Name"><input type="time" data-i="${i}" data-f="start" value="${p.start}" aria-label="Start"><input type="time" data-i="${i}" data-f="end" value="${p.end}" aria-label="End"><label class="chkl" title="A break is shown as a thin row"><input type="checkbox" data-i="${i}" data-f="brk"${p.brk ? ' checked' : ''}> break</label><button class="ib sm" data-rm="${i}" aria-label="Remove">${ic('x', 14)}</button></div>`).join(''); };
  openModal(`<h3>Lesson times</h3><p class="hint">One row per lesson or break. Lessons are placed in the weekly grid by these times.</p><div id="scp" class="scp"></div><div class="mrow"><button data-add="1">${ic('plus', 14)} Add a row</button></div><div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    paint(m);
    m.onchange = e => { const el = e.target, i = el.dataset.i; if (i == null) return; rows[i][el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.f === 'brk') paint(m); };
    m.onclick = e => {
      const b = e.target.closest('button'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.rm != null) { rows.splice(+b.dataset.rm, 1); paint(m); }
      else if (b.dataset.add) { const last = rows[rows.length - 1], s = last ? last.end : '08:00'; rows.push({ id: uid(), k: 'period', start: s, end: fmtHM(toMin(s) + 45), brk: false, label: '' }); paint(m); }
      else if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'save') {
        if (rows.some(p => !validHM(p.start) || !validHM(p.end) || toMin(p.end) <= toMin(p.start))) { toast('Each row needs a start time before its end time'); return; }
        const keep = new Set(rows.map(p => p.id)); S.school = S.school.filter(x => x.k !== 'period' || keep.has(x.id)).filter(x => x.k !== 'lesson' || keep.has(x.periodId));
        for (const p of rows) { const o = scGet(p.id); if (o) Object.assign(o, { start: p.start, end: p.end, brk: !!p.brk, label: p.label || '' }); else S.school.push({ id: p.id, k: 'period', start: p.start, end: p.end, brk: !!p.brk, label: p.label || '' }); }
        save(); closeModal(); render();
      }
    };
  });
}
const fmtHM = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
function scSettings() {
  const c = scCfg();
  openModal(`<h3>School timetable</h3><div class="form one"><div class="lbl">School days<div class="mrow tight">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="chkl"><input type="checkbox" data-d="${d}"${c.days.includes(d) ? ' checked' : ''}> ${DAYS[d]}</label>`).join('')}</div></div><label class="chkl"><input type="checkbox" id="sc-ab"${c.ab ? ' checked' : ''}> Alternate between week A and week B</label><label class="chkl"><input type="checkbox" id="sc-swap"${c.swap ? ' checked' : ''}> This week is the other one (swap A and B)</label><label>Remind me before a lesson<select id="sc-rem">${opts([[0, 'Never'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before']], c.remind || 0)}</select></label></div><div class="dgrid" style="margin-top:12px"><button data-m="periods">${ic('clock', 18)}<span><b>Lesson times</b><small>Periods and breaks</small></span></button></div><div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => {
    m.onchange = e => {
      const days = $$('[data-d]', m).filter(x => x.checked).map(x => +x.dataset.d); if (!days.length) { toast('Keep at least one school day'); e.target.checked = true; return; }
      scCfgSet({ days, ab: $('#sc-ab', m).checked, swap: $('#sc-swap', m).checked, remind: +$('#sc-rem', m).value });
    };
    m.onclick = e => { const b = e.target.closest('button'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); render(); } return; } if (b.dataset.m === 'periods') { closeModal(); scPeriodsDlg(); } else if (b.dataset.m === 'ok') { closeModal(); render(); } };
  });
}
// a notification shortly before each lesson starts (called with the other reminders)
function schoolRemind() {
  const c = scCfg(); if (!c.remind) return false; const now = Date.now(), today = new Date(), k = ymd(today); let changed = false;
  for (const { p, l } of scDayLessons(today)) {
    const at = new Date(`${k}T${p.start}`).getTime() - c.remind * 60000, end = new Date(`${k}T${p.end}`).getTime(), key = `s|${l.id}|${k}|${p.start}|${c.remind}`, s = scSubj(l.subjectId);
    if (now >= at && now < end && !S.fired[key]) { S.fired[key] = 1; changed = true; notify((s ? s.name : 'Lesson') + ' starts soon', `${fmtRange(p.start, p.end)}${l.room || (s && s.room) ? ' · ' + (l.room || s.room) : ''}`); sfx('chime'); }
  }
  return changed;
}
const SC_ACT = {
  scmode: el => { S.settings.tt.mode = el.dataset.m === 'school' ? 'school' : 'plan'; save(); fx('#main > *:not(.top)', 'fade'); renderMain(); },
  sctab: el => { U.scTab = el.dataset.t; renderMain(); },
  scwk: el => { const d = +el.dataset.d; U.scWeek = d ? (U.scWeek || 0) + d : 0; renderMain(); },
  scsetup: () => { scSeedPeriods(); renderMain(); },
  scperiods: () => scPeriodsDlg(),
  scset: () => scSettings(),
  sccell: el => scLessonDlg(+el.dataset.day, el.dataset.p),
  scedit: el => { const r = scGet(el.dataset.id); if (r) scEdit(r.k, r.id); },
  schwtog: el => { const h = scGet(el.dataset.id); if (!h) return; h.done = !h.done; save(); sfx(h.done ? 'done' : 'undo'); renderMain(); },
  scadd: () => { const t = U.scTab || 'week'; if (t === 'week') { if (!scPeriods().length) ACT.scsetup(); else toast('Tap a cell in the grid to add a lesson'); } else scEdit({ today: 'homework', hw: 'homework', exam: 'exam', subj: 'subject', teach: 'teacher', note: 'snote' }[t]); },
};
