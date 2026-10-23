// Classes (the former "school" timetable): exams and homework are ordinary tasks, lessons live on the main timetable, tasks can sit inside
// a lesson, and every page of it says when things end and fits without scrolling text.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';

const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const NBSP = /\u00a0/g, plain = h => String(h).replace(/<[^>]*>/g, ' ').replace(NBSP, ' ').replace(/\s+/g, ' ');
// a device with a standard school day, two classes and a few lessons (Monday to Friday first period: Maths; Monday second period: Music)
function setup(opts = {}) {
  const A = makeApp(), S = A.S;
  S.settings.clock.h24 = true; S.settings.tt.mode = 'school';
  A.scSeedPeriods(); const per = A.scPeriods().filter(p => !p.brk);
  S.school.push({ id: 'su1', k: 'subject', name: 'Mathematics', short: 'Maths', color: '#e5484d', icon: 'calculator', room: 'R1' }, { id: 'su2', k: 'subject', name: 'Music', color: '#8e5cf7', icon: 'music' }, { id: 'te1', k: 'teacher', name: 'Ms Lee' });
  for (const d of [1, 2, 3, 4, 5]) S.school.push({ id: 'l' + d, k: 'lesson', day: d, periodId: per[0].id, subjectId: 'su1', week: 0 });
  S.school.push({ id: 'lm2', k: 'lesson', day: 1, periodId: per[1].id, subjectId: 'su2', week: 0, room: 'Studio' });
  if (opts.save !== false) { A.save(); A.flush(); }
  return { A, S, per };
}
const dayOf = (A, dow) => { const t = new Date(clock.t); return A.addDays(t, (dow - t.getDay() + 7) % 7); }; // the next date that falls on that weekday (today when it matches)

/* ---- 1. old exam and homework records become tasks, once ---- */
{
  const mk = () => ({ v: 1, tasks: [], lists: [], school: [
    { id: 'su1', k: 'subject', name: 'Maths' },
    { id: 'e1', k: 'exam', title: 'Mock paper', date: '2999-10-30', time: '09:00', subjectId: 'su1', room: 'Hall', notes: 'Bring a calculator' },
    { id: 'e0', k: 'exam', title: 'Last term', date: '2001-09-01', subjectId: 'su1' },
    { id: 'h1', k: 'homework', title: 'Read chapter 4', due: '2999-10-12', done: false, subjectId: 'su1' },
    { id: 'h2', k: 'homework', title: 'Worksheet', due: '2001-10-01', done: true },
  ], tomb: {} });
  const A = makeApp(), r = A.migrate(mk());
  const by = id => r.tasks.find(t => t.id === id);
  assert.equal(r.tasks.length, 4, 'one task per old record');
  assert.ok(!r.school.some(x => x.k === 'exam' || x.k === 'homework'), 'the old records are gone');
  assert.ok(r.school.some(x => x.k === 'subject'), 'the class stays');
  const e1 = by('sx-e1'); assert.equal(e1.kind, 'exam'); assert.equal(e1.due, '2999-10-30'); assert.equal(e1.time, '09:00'); assert.equal(e1.dur, 60); assert.equal(e1.subjectId, 'su1'); assert.equal(e1.room, 'Hall'); assert.equal(e1.notes, 'Bring a calculator'); assert.equal(e1.status, 'open');
  assert.equal(by('sx-e0').status, 'done', 'a past exam is finished'); assert.equal(by('sx-h2').status, 'done', 'finished homework stays finished'); assert.equal(by('sx-h1').status, 'open'); assert.equal(by('sx-h1').kind, 'homework');
  assert.equal(e1.listId, 'list-classes'); assert.ok(r.lists.some(l => l.id === 'list-classes' && l.name === 'Classes'), 'they land in a list called Classes');
  for (const id of ['e1', 'e0', 'h1', 'h2']) assert.ok(r.tomb[id], 'the old record is tombstoned: ' + id);
  // running it again (every load, merge and import does) changes nothing
  const before = JSON.stringify(r.tasks.map(t => t.id).sort()); A.migrate(r); assert.equal(JSON.stringify(r.tasks.map(t => t.id).sort()), before);
  // a task that was deleted stays deleted when an old copy of the record turns up again
  const g = JSON.parse(JSON.stringify(r)); g.tasks = g.tasks.filter(t => t.id !== 'sx-h1'); g.tomb['sx-h1'] = Date.now() + 1; g.school.push({ id: 'h1', k: 'homework', title: 'Read chapter 4', due: '2999-10-12', done: false });
  A.migrate(g); assert.ok(!g.tasks.some(t => t.id === 'sx-h1'), 'a deleted task is not made again');
  // two devices that both migrate end up with one task each, not two
  const B = makeApp(), r2 = B.migrate(mk()), merged = A.mergeData({ ...r, pomo: [] }, { ...r2, pomo: [] });
  assert.equal(merged.tasks.filter(t => t.id === 'sx-e1').length, 1); assert.equal(merged.tasks.length, 4);
  // a device still on the old version hands over its old records: they are tombstoned, and the migrated tasks win
  const old = { tasks: [], lists: [], habits: [], tags: [], slots: [], notes: [], projects: [], pomo: [], tomb: {}, school: [{ id: 'e1', k: 'exam', title: 'Mock paper', date: '2999-10-30', u: 5 }] };
  const m2 = A.mergeData({ ...r, pomo: [] }, old); assert.ok(!m2.school.some(x => x.id === 'e1'), 'the old record does not come back'); assert.ok(m2.tasks.some(t => t.id === 'sx-e1'));
  // if the person had deleted the Classes list on purpose, the tasks go to the Inbox instead of bringing it back
  const z = mk(); z.tomb['list-classes'] = 5; assert.ok(A.migrate(z).tasks.every(t => t.listId === 'inbox'));
  // the name the person chose for the page is the name of that list
  const n = mk(); n.school.push({ id: 'school-cfg', k: 'cfg', days: [1, 2, 3, 4, 5], name: 'Lectures' }); assert.equal(A.migrate(n).lists.find(l => l.id === 'list-classes').name, 'Lectures');
}

/* ---- 2. quick add: @class, /exam, /homework ---- */
{
  const { A, S } = setup(), base = new Date(2026, 9, 8), L = [{ id: 'inbox', name: 'Inbox' }], subjects = A.scOf('subject');
  let p = A.parseQuick('Read chapter 4 @maths tomorrow !high /hw', L, base, { subjects });
  assert.equal(p.subjectId, 'su1'); assert.equal(p.kind, 'homework'); assert.equal(p.title, 'Read chapter 4'); assert.equal(p.priority, 3); assert.equal(p.due, '2026-10-09');
  assert.equal(A.parseQuick('Mock @Mathematics /exam friday 9am', L, base, { subjects }).kind, 'exam');
  assert.equal(A.parseQuick('Practice @mus', L, base, { subjects }).subjectId, 'su2', 'an unambiguous start of a name is enough');
  assert.equal(A.parseQuick('Practice @m', L, base, { subjects }).subjectId, null, 'ambiguous: Mathematics and Music'); assert.match(A.parseQuick('Practice @m', L, base, { subjects }).title, /@m/);
  assert.equal(A.parseQuick('Email @bob about it', L, base, { subjects }).subjectId, null, 'an unknown name stays in the title'); assert.match(A.parseQuick('Email @bob about it', L, base, { subjects }).title, /@bob/);
  assert.equal(A.parseQuick('Email bob@example.com now', L, base, { subjects }).subjectId, null, 'an address is not a class');
  assert.equal(A.parseQuick('Plain old task', L, base).kind, null, 'without classes nothing changes');
  // quickAdd keeps the lot, and puts schoolwork in the Classes list when there is one
  const t = A.quickAdd('Essay plan @maths /hw friday');
  assert.equal(t.kind, 'homework'); assert.equal(t.subjectId, 'su1'); assert.equal(t.listId, 'inbox', 'no Classes list yet');
  S.lists.push({ id: 'list-classes', name: 'Classes', color: '#8e5cf7', sections: [] }); assert.equal(A.quickAdd('Quiz /exam').listId, 'list-classes');
  assert.equal(A.quickAdd('Chat with Ms Lee', { subjectId: 'su2' }).subjectId, 'su2', 'the context supplies a class');
}

/* ---- 3. the main timetable shows lessons, and tasks sit inside them ---- */
{
  const { A, S, per } = setup(), mon = dayOf(A, 1), k = A.ymd(mon);
  let r = A.ttItems(mon); const les = r.items.filter(i => i.k === 'lesson');
  assert.equal(les.length, 2, 'two lessons on Monday'); assert.equal(les[0].a, A.toMin(per[0].start)); assert.equal(les[0].b, A.toMin(per[0].end), 'a lesson has its real end'); assert.equal(les[0].s.id, 'su1');
  assert.equal(A.ttItems(dayOf(A, 0)).items.length, 0, 'Sunday is empty');
  // a task tied to a lesson is drawn inside it; one for the class with no time goes into that class's lesson that day; one with a time is its own block
  const a = A.newTask({ title: 'Hand in essay', due: k, lessonId: 'lm2' }), b = A.newTask({ title: 'Bring ruler', due: k, subjectId: 'su1' }), c = A.newTask({ title: 'Lab at four', due: k, time: '16:00', subjectId: 'su1' }), d = A.newTask({ title: 'Buy milk', due: k });
  S.tasks.push(a, b, c, d);
  r = A.ttItems(mon); const maths = r.items.find(i => i.k === 'lesson' && i.l.id === 'l1'), music = r.items.find(i => i.k === 'lesson' && i.l.id === 'lm2');
  same(music.tasks.map(t => t.title), ['Hand in essay']); same(maths.tasks.map(t => t.title), ['Bring ruler']);
  assert.ok(r.items.some(i => i.k === 'task' && i.t.title === 'Lab at four'), 'a timed task keeps its own block'); same(r.allday.map(t => t.title), ['Buy milk']);
  // a lesson id that is not that day's does not host the task
  a.due = A.ymd(A.addDays(mon, 1)); assert.ok(!A.ttItems(A.addDays(mon, 1)).items.some(i => i.k === 'lesson' && i.tasks.includes(a)) && A.ttItems(A.addDays(mon, 1)).allday.includes(a));
  a.due = k;
  // the "show classes" switch hides lessons but not the tasks
  S.settings.tt.classes = false; r = A.ttItems(mon); assert.ok(!r.items.some(i => i.k === 'lesson')); assert.ok(r.allday.includes(b) && r.allday.includes(a)); S.settings.tt.classes = true;
  // a cancelled lesson, and a day off
  A.scSetSkip('l1', k, true); assert.ok(!A.ttItems(mon).items.some(i => i.k === 'lesson' && i.l.id === 'l1')); assert.ok(A.scAgenda(mon).items.some(i => i.k === 'lesson' && i.cancelled && i.l.id === 'l1'), 'the agenda still shows it, marked');
  A.scSetSkip('l1', k, false); assert.ok(A.ttItems(mon).items.some(i => i.k === 'lesson' && i.l.id === 'l1'));
  S.school.push({ id: 'off1', k: 'off', from: k, to: k, label: 'Inset day' }); r = A.ttItems(mon); assert.equal(r.off.label, 'Inset day'); assert.ok(!r.items.some(i => i.k === 'lesson')); assert.equal(A.scAgenda(mon).off.label, 'Inset day');
  S.school.pop();
  // overlapping blocks are told apart: a slot over a lesson is a clash
  S.slots.push({ id: 'sl1', title: 'Choir', start: '08:15', end: '09:00', days: [1], color: '#12a9c7' });
  r = A.ttItems(mon); A.ttLayout(r.items); assert.ok(r.items.find(i => i.k === 'lesson' && i.l.id === 'l1').clash && r.items.find(i => i.k === 'slot').clash, 'lesson and slot overlap');
  assert.ok(r.items.every(i => i.n >= 1 && i.col < i.n), 'laid out side by side');
  S.slots.pop();
  // the planner draws them: not draggable, with start–end, the room, and the task inside
  S.settings.tt.mode = 'plan'; U_set(A, mon); A.renderTimetable(); const html = A.els['#main'].innerHTML;
  assert.match(html, /data-act="sclesson" data-lid="l1" data-date="/); assert.ok(!/class="blk lsn[^"]*"[^>]*draggable/.test(html), 'a lesson is not draggable'); assert.ok(plain(html).includes('08:00–08:45') || plain(html).includes('08:00 – 08:45'), 'end time shown');
  assert.match(html, /Studio/); assert.match(html, /Bring ruler/);
  S.settings.tt.classes = false; A.renderTimetable(); assert.ok(!/data-act="sclesson"/.test(A.els['#main'].innerHTML)); S.settings.tt.classes = true;
}
function U_set(A, date) { A.U.page = 'timetable'; A.U.ttDate = date; A.S.settings.tt.view = 'week'; }

/* ---- 4. the week and the class lookups ---- */
{
  const { A, S, per } = setup();
  assert.equal(A.scHas(), true); assert.equal(A.scName(), 'Classes'); A.scCfgSet({ name: 'Courses' }); assert.equal(A.scName(), 'Courses'); A.scCfgSet({ name: '  ' }); assert.equal(A.scName(), 'Classes', 'blank falls back'); A.scCfgSet({ name: 'x'.repeat(60) }); assert.equal(A.scName().length, 24); A.scCfgSet({ name: '' });
  assert.equal(A.scShort(A.scSubj('su1')), 'Maths'); assert.equal(A.scShort(A.scSubj('su2')), 'Musi', 'the first letters of a single word'); assert.equal(A.scShort({ name: 'Physical Education' }), 'PE', 'initials of several words'); assert.equal(A.scShort({ name: 'x', short: 'abcdefgh' }), 'abcde', 'a chosen short name is capped at five letters');
  // the next lesson of a class
  const n = A.scNextLesson('su2', dayOf(A, 1)); assert.ok(n && n.l.id === 'lm2'); assert.equal(A.scNextLesson('nobody'), null);
  const tue = A.scNextLesson('su1', A.addDays(dayOf(A, 1), 0)); assert.ok(tue.date >= A.ymd(dayOf(A, 1)));
  // lessons for a task: the ones on its day, then the coming ones of its class
  const t = A.newTask({ title: 'x', due: A.ymd(dayOf(A, 1)), subjectId: 'su1' }); const ch = A.scLessonChoices(t); assert.ok(ch.length >= 2 && ch.every(c => /^[^|]+\|\d{4}-\d\d-\d\d$/.test(c[0]))); assert.ok(ch.some(c => c[0].startsWith('l1|')));
  same(A.scLessonChoices(A.newTask({ title: 'y' })), [], 'no class, no date: nothing to pick');
  // the density tiers
  same([40, 70, 100, 200].map(A.scDensity), ['xs', 's', 'm', 'l']);
  // two-week timetables
  A.scCfgSet({ ab: true }); S.school.push({ id: 'lw', k: 'lesson', day: 2, periodId: per[1].id, subjectId: 'su2', week: 1 });
  const tue1 = dayOf(A, 2), tue2 = A.addDays(tue1, 7), wk = [A.scWeekType(tue1), A.scWeekType(tue2)]; assert.notEqual(wk[0], wk[1]);
  const a = wk[0] === 1 ? tue1 : tue2, b = wk[0] === 1 ? tue2 : tue1; assert.ok(A.ttItems(a).items.some(i => i.k === 'lesson' && i.l.id === 'lw'), 'week A lesson in week A'); assert.ok(!A.ttItems(b).items.some(i => i.k === 'lesson' && i.l.id === 'lw'));
  A.scCfgSet({ ab: false });
}

/* ---- 5. every page draws, says when things end, and has nothing that slides ---- */
{
  const { A, S, per } = setup(), mon = dayOf(A, 1), mk = A.ymd(mon);
  S.tasks.push(A.newTask({ title: 'Mock paper', kind: 'exam', subjectId: 'su1', due: mk, time: '10:00', dur: 90, room: 'Hall', listId: 'inbox' }), A.newTask({ title: 'Read ch 4', kind: 'homework', subjectId: 'su1', due: A.ymd(A.addDays(mon, 2)) }));
  S.school.push({ id: 'sn1', k: 'snote', title: 'Formulae', subjectId: 'su1', body: 'a^2+b^2' });
  for (const tab of A.SC_TABS.map(x => x[0])) { A.U.scTab = tab; A.U.scDate = mon; A.renderSchool(); const h = A.els['#main'].innerHTML; assert.ok(h.length > 200, tab + ' draws'); assert.ok(!/class="[^"]*\bmq\b/.test(h), tab + ': no scrolling text'); assert.equal(typeof A.scTabHtml(tab), 'string'); }
  // Day: every entry has its start and its end, and the exam is in the agenda with the lessons
  A.U.scTab = 'day'; A.U.scDate = mon; A.renderSchool(); let day = plain(A.els['#main'].innerHTML);
  for (const t of [per[0].start, per[0].end, per[1].start, per[1].end]) assert.ok(day.includes(t), 'agenda shows ' + t); assert.match(day, /Mathematics/); assert.match(day, /Music/); assert.match(day, /Mock paper/); assert.ok(day.includes('10:00') && day.includes('11:30'), 'an exam of 90 minutes ends at 11:30');
  assert.match(day, /Break/, 'breaks are there'); assert.ok(day.indexOf('Mathematics') < day.indexOf('Music') && day.indexOf('Music') < day.indexOf('Mock paper'), 'in time order');
  // the 12-hour clock too
  S.settings.clock.h24 = false; A.renderSchool(); day = plain(A.els['#main'].innerHTML); assert.match(day, /8:45 AM|8:45/); S.settings.clock.h24 = true;
  // Today: now and next, and when it ends. The clock is moved to the middle of a lesson, then to a gap
  const lessonStart = A.toMin(per[0].start), setNow = m => { const t = new Date(clock.t); t.setHours(Math.floor(m / 60), m % 60, 0, 0); clock.t = t.getTime(); };
  const keep = clock.t; try {
    setNow(lessonStart + 15); const today = A.todayStr(); const first = A.scAgenda(new Date(clock.t)); assert.ok(first);
    // make sure today has the lessons: use whatever weekday it is
    const dow = new Date(clock.t).getDay(); S.school.filter(x => x.k === 'lesson' && x.id !== 'lm2').forEach(x => { x.day = dow; }); S.school.push({ id: 'late', k: 'lesson', day: dow, periodId: per[2].id, subjectId: 'su2', week: 0 });
    A.U.scTab = 'today'; A.renderSchool(); let h = plain(A.els['#main'].innerHTML);
    assert.match(h, /Now/); assert.match(h, /Ends at 08:45/); assert.match(h, /30 min left/); assert.match(h, /Next/); assert.match(h, /Starts at 09:55 · in 1 h 40 min/); assert.ok(/ends in 30 min/.test(h), 'the agenda row counts down too'); assert.ok(/class="sc-ag lsn now"/.test(A.els['#main'].innerHTML), 'the lesson on now is marked, with its progress'); assert.ok(/class="sc-prog"/.test(A.els['#main'].innerHTML));
    assert.match(h, /the day ends in 2 h 25 min/);
    setNow(A.toMin(per[0].end) + 1); A.renderSchool(); h = plain(A.els['#main'].innerHTML); assert.match(h, /Free for now|until/); assert.ok(/class="sc-nowl"/.test(A.els['#main'].innerHTML), 'between two things a now line shows where the day is');
    setNow(23 * 60); A.renderSchool(); h = plain(A.els['#main'].innerHTML); assert.match(h, /Done for today/); assert.match(h, /last one ended at 10:40/); assert.match(h, /First one starts at 08:50/, 'after the last one: when it starts again');
    setNow(6 * 60); A.renderSchool(); h = plain(A.els['#main'].innerHTML); assert.match(h, /Not started yet/);
    void today;
  } finally { clock.t = keep; }
  // Week: the days across, each period down, and a marker for what is due
  A.U.scTab = 'week'; A.U.scDate = mon; A.renderSchool(); const wk = A.els['#main'].innerHTML;
  assert.match(wk, /class="sc-grid"/); assert.equal((wk.match(/class="sc-h[ "]/g) || []).length >= 6, true); assert.match(wk, /sc-due ex/, 'the day with the exam is marked'); assert.match(wk, /data-act="sclesson"/);
  assert.match(wk, /class="sc-nf"/); assert.match(wk, /class="sc-ns"/, 'both a full and a short name are there; the page picks one by the room it has');
  // a day off blanks that column
  S.school.push({ id: 'off2', k: 'off', from: mk, to: mk, label: 'Closed' }); A.renderSchool(); assert.match(A.els['#main'].innerHTML, /sc-c off/); S.school.pop();
  // the lists of exams and homework are tasks
  A.U.scTab = 'exam'; A.renderSchool(); assert.match(A.els['#main'].innerHTML, /Mock paper/); A.U.scTab = 'hw'; A.renderSchool(); assert.match(A.els['#main'].innerHTML, /Read ch 4/);
  // nothing set up: the page says how to start instead of showing an empty grid
  const E = makeApp(); E.S.settings.tt.mode = 'school'; E.U.scTab = 'week'; E.renderSchool(); assert.match(E.els['#main'].innerHTML, /Set up your lesson times first/); assert.equal(E.scHas(), false);
}

/* ---- 6. exams and homework behave like tasks everywhere ---- */
{
  const { A, S } = setup(), mon = dayOf(A, 1), k = A.ymd(mon);
  S.lists.push({ id: 'uni', name: 'University', color: '#4772fa', sections: [] }, { id: 'unia', parent: 'uni', name: 'Year 2', color: '#4772fa', sections: [] }); S.projects.push({ id: 'pr1', name: 'Finals', color: '#e5484d', listIds: ['uni'] });
  const ex = A.newTask({ title: 'Final exam', kind: 'exam', due: k, time: '09:00', subjectId: 'su1', listId: 'unia' }), hw = A.newTask({ title: 'Problem set', kind: 'homework', due: k, subjectId: 'su1', listId: 'uni' }); S.tasks.push(ex, hw);
  assert.ok(A.scopeTasks('list:unia').includes(ex), 'in its sublist'); assert.ok(A.scopeTasks('list:uni').includes(ex) && A.scopeTasks('list:uni').includes(hw), 'and in the list above it'); assert.ok(A.scopeTasks('project:pr1').includes(ex), 'and in the project');
  assert.ok(A.calItems(k, k)[k].some(i => i.t === ex), 'on the calendar'); assert.ok(A.scWork('exam').includes(ex) && A.scWork('homework').includes(hw) && !A.scWork('exam').includes(hw));
  // completing, searching, the matrix
  A.toggleDone(hw); assert.equal(hw.status, 'done'); assert.ok(!A.scWork('homework').some(t => t.status === 'open'));
  A.U.nav = 'all'; assert.ok(A.scopeTasks('all').includes(ex));
  assert.ok(A.metaX(ex).includes('exam') || /Exam/.test(A.metaX(ex)), 'its badge says it is an exam'); assert.match(A.metaX(hw), /homework|Homework/i);
  // the task panel offers Type, Class, Lesson and Room, and reads them back
  A.U.sel = ex.id; A.renderDetail(); const d = A.els['#detail'].innerHTML;
  assert.match(d, /data-f="kind"/); assert.match(d, /data-f="subject"/); assert.match(d, /data-f="lesson"/); assert.match(d, /data-f="room"/); assert.match(d, /<option value="exam" selected/);
  const plainTask = A.newTask({ title: 'Just a task' }); S.tasks.push(plainTask); A.U.sel = plainTask.id; A.renderDetail(); assert.ok(!/data-f="room"/.test(A.els['#detail'].innerHTML), 'no room row on an ordinary task');
  // the task row in lists carries its class
  assert.match(A.rowHtml(ex), /Exam|exam/);
  // the detail handlers (type, class, lesson) are wired in
  assert.ok(typeof A.ACT.nextlesson === 'function' && typeof A.ACT.sclesson === 'function' && typeof A.ACT.scjump === 'function' && typeof A.ACT.scadd === 'function');
}

/* ---- 7. backup, merge, counts, widgets ---- */
{
  const { A, S } = setup(), mon = dayOf(A, 1), k = A.ymd(mon);
  S.tasks.push(A.newTask({ title: 'Quiz', kind: 'exam', due: k, subjectId: 'su1', room: 'Hall' })); S.school.push({ id: 'skip-l1-' + k, k: 'skip', lessonId: 'l1', date: k }, { id: 'off3', k: 'off', from: k, to: k, label: 'x' }); A.save(); A.flush();
  const snap = A.snapshot(); assert.ok(snap.school.some(r => r.k === 'skip') && snap.school.some(r => r.k === 'off') && snap.school.some(r => r.k === 'lesson'), 'lessons, cancellations and days off travel');
  const pay = A.buildPayload(); const back = A.parsePayload(pay.text); assert.ok(back.tasks.find(t => t.title === 'Quiz').kind === 'exam' && back.tasks.find(t => t.title === 'Quiz').room === 'Hall', 'the new task fields survive a sync file');
  assert.ok(back.school.some(r => r.k === 'subject' && r.short === 'Maths'));
  // two devices cancelling the same lesson make one record (a fixed id), and a restore on one wins over the other when it is newer
  const B = makeApp(); B.S.school.push({ id: 'skip-l1-' + k, k: 'skip', lessonId: 'l1', date: k, u: Date.now() + 10 }); const m = A.mergeData(snap, B.snapshot()); assert.equal(m.school.filter(r => r.id === 'skip-l1-' + k).length, 1);
  // the counts a person sees
  const c = A.dataCounts(); assert.ok(c.school > 0); const txt = A.dataCountsText(c); assert.ok(/class|lesson|item/i.test(txt) || /task/.test(txt)); assert.ok(!/school item/i.test(txt), 'it no longer says "school"');
  // widgets: one list with lessons and tasks, each with an end; the title follows the name
  const w = A.wgTt(); assert.equal(w.kind, 'plan'); assert.equal(w.title, 'Classes');
  const items = w.items; assert.ok(Array.isArray(items)); const isMon = new Date(clock.t).getDay() === 1; void isMon;
  for (const it of items) { assert.match(it.a, /^\d\d:\d\d$/); assert.match(it.b, /^\d\d:\d\d$/); assert.ok(A.toMin(it.b) > A.toMin(it.a)); }
  A.scCfgSet({ name: 'Lectures' }); assert.equal(A.wgTt().title, 'Lectures');
  const snapW = A.widgetSnapshot(); assert.equal(snapW.tt.kind, 'plan'); assert.ok(JSON.stringify(snapW).length < 40000);
  A.U.page = 'timetable'; const wb = A.wgBody('timetable'); assert.equal(typeof wb.html, 'string'); assert.equal(wb.title, 'Lectures');
  // the quick words the help and the settings use
  assert.ok(A.SC_NAMES.includes('Classes') && A.SC_NAMES.includes('Lectures'));
  // removing a class unlinks its tasks, keeps them, and frees their lessons
  const q = S.tasks.find(t => t.title === 'Quiz'); q.lessonId = 'l1'; A.scRemove(A.scGet('su1')); assert.equal(q.subjectId, ''); assert.equal(q.lessonId, null); assert.ok(S.tasks.includes(q)); assert.ok(!S.school.some(r => r.k === 'skip' && r.lessonId === 'l1'));
}

/* ---- 8. what is stored is what was before: a backup of an older version still opens ---- */
{
  const A = makeApp(), old = { v: 1, tasks: [{ id: 'a', title: 'x', status: 'open', listId: 'inbox', tags: [], subtasks: [] }], lists: [{ id: 'inbox', name: 'Inbox', color: '#4772fa', sections: [] }], school: [{ id: 'su1', k: 'subject', name: 'Art', color: '#f00', icon: '' }, { id: 'h9', k: 'homework', title: 'Sketch', due: '2999-01-01', subjectId: 'su1', done: false }], settings: { tt: { mode: 'school' } } };
  A.replaceAll(JSON.parse(JSON.stringify(old)));
  assert.ok(A.S.tasks.some(t => t.id === 'sx-h9' && t.kind === 'homework' && t.subjectId === 'su1'), 'an old backup\'s homework comes in as a task'); assert.ok(!A.S.school.some(r => r.k === 'homework'));
  assert.equal(A.schoolOn(), true, 'the layout choice is kept');
}
console.log('classes tests passed');
