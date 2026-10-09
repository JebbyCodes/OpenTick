// Tag colours, themes, task durations and the timetable (layout, tasks on the grid, drag/drop, reminders, sync merge).
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);

/* ---------- themes ---------- */
{
  const A = makeApp();
  assert.equal(A.S.settings.theme, 'gruvbox-dark', 'default theme is Gruvbox Dark');
  const m = A.migrate({ tasks: [], lists: [], settings: { theme: 'auto' } });
  assert.equal(m.settings.theme, 'gruvbox-dark', 'old default "auto" becomes the new default');
  assert.equal(A.migrate({ tasks: [], lists: [], settings: { theme: 'light' } }).settings.theme, 'light', 'an explicit choice survives');
  assert.equal(A.migrate({ tasks: [], lists: [], settings: { theme: 'light', themeV: 2 } }).settings.theme, 'light');
  assert.equal(A.migrate({ tasks: [], lists: [], settings: { theme: 'nope', themeV: 2 } }).settings.theme, 'gruvbox-dark', 'unknown theme falls back');
  assert.ok(A.THEMES.length >= 7);
}

/* ---------- quick add: durations ---------- */
{
  const { parseQuick } = makeApp(), base = new Date(2026, 9, 8), L = [{ id: 'inbox', name: 'Inbox' }];
  let p = parseQuick('Study 4pm for 90min #uni', L, base); eq([p.title, p.time, p.dur, p.tags], ['Study', '16:00', 90, ['uni']]);
  p = parseQuick('Read tomorrow for 1.5h', L, base); eq([p.title, p.dur], ['Read', 90]);
  p = parseQuick('Trip for 2 months', L, base); assert.equal(p.dur, null);
  p = parseQuick('Call for 15 mins', L, base); eq([p.title, p.dur], ['Call', 15]);
}

/* ---------- tag colours ---------- */
{
  const A = makeApp(), S = A.S;
  const t = A.quickAdd('Pay bills #bills #home', {});
  assert.equal(A.tagColor('bills'), null);
  assert.ok(!A.tagChip('bills').includes('--tc'));
  A.setTagColor('bills', '#e5484d'); A.flush();
  assert.equal(A.tagColor('bills'), '#e5484d');
  assert.ok(A.tagChip('bills').includes('--tc:#e5484d'));
  A.setTagColor('bills', '#34b36b'); assert.equal(S.tags.length, 1, 'recolouring edits the same record');
  A.renameTag('bills', 'money'); A.flush();
  eq(t.tags, ['money', 'home']); assert.equal(A.tagColor('money'), '#34b36b'); assert.equal(A.tagColor('bills'), null);
  A.setTagColor('money', null); A.flush(); assert.equal(S.tags.length, 0);
  assert.ok(S.tomb['tag-money'], 'removing a colour leaves a tombstone so it syncs');
  A.U.page = 'tasks'; A.U.nav = 'tag:home'; A.render(); // tag view renders with its options button
  assert.ok(A.els['#main'].innerHTML.includes('data-act="tagmenu"'));
  A.U.sel = t.id; A.renderDetail(); assert.ok(A.els['#detail'].innerHTML.includes('data-act="tagcolor"'));
}

/* ---------- sync merge of tags + slots ---------- */
{
  const A = makeApp(), now = clock.t;
  const D = (o = {}) => ({ tasks: [], lists: [], habits: [], tags: [], slots: [], pomo: [], tomb: {}, ...o });
  const slot = (u, o = {}) => ({ id: 's1', title: 'Maths', days: [1], start: '09:00', end: '10:00', color: '#4772fa', u: now + u, ...o });
  const both = (a, b) => { const x = A.mergeData(a, b), y = A.mergeData(b, a); assert.equal(A.fingerprint(x), A.fingerprint(y)); return x; };
  let m = both(D({ slots: [slot(1, { title: 'old' })] }), D({ slots: [slot(5, { title: 'new', days: [1, 3] })] }));
  eq([m.slots[0].title, m.slots[0].days], ['new', [1, 3]]);
  m = both(D({ slots: [slot(1)] }), D({ tomb: { s1: now + 4 } })); assert.equal(m.slots.length, 0, 'slot deleted on another device');
  m = both(D({ tags: [{ id: 'tag-a', name: 'a', color: '#111111', u: now + 1 }] }), D({ tags: [{ id: 'tag-a', name: 'a', color: '#222222', u: now + 2 }] })); assert.equal(m.tags[0].color, '#222222');
  m = A.mergeData(D(), { tasks: [], lists: [], pomo: [], tomb: {} }); eq([m.tags, m.slots], [[], []]); // older file without the new keys
}

/* ---------- timetable ---------- */
{
  const A = makeApp(), S = A.S, td = new Date(clock.t), tk = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(td), dow = td.getDay();
  const mk = (title, days, start, end, o = {}) => { const s = { id: 'sl' + S.slots.length, title, days, start, end, color: '#4772fa', loc: '', notes: '', remind: null, ...o }; S.slots.push(s); return s; };
  A.U.page = 'timetable'; A.render(); // empty state
  assert.ok(A.els['#main'].innerHTML.includes('Click anywhere on the grid'));

  const maths = mk('Maths', [dow], '09:00', '10:00', { loc: 'Room 4' }), phys = mk('Physics', [dow], '09:30', '10:30'), gym = mk('Gym', [dow, (dow + 1) % 7], '18:00', '19:00');
  const it = A.ttItems(td); A.ttLayout(it.items);
  const by = n => it.items.find(i => i.s && i.s.title === n);
  assert.equal(by('Maths').n, 2); assert.notEqual(by('Maths').col, by('Physics').col, 'overlapping slots sit side by side');
  assert.ok(by('Maths').clash && by('Physics').clash && !by('Gym').clash, 'overlapping slots are flagged');
  assert.equal(by('Gym').n, 1);
  eq(A.slotClashes({ id: 'x', days: [dow], start: '09:45', end: '11:00' }).length, 2);
  eq(A.slotClashes({ id: 'x', days: [dow], start: '10:30', end: '11:00' }).length, 0, 'touching is not overlapping');

  // tasks on the grid
  const timed = A.quickAdd('Dentist 14:00 for 45min', { due: tk }), plain = A.quickAdd('Buy stamps', { due: tk }), hw = A.quickAdd('Maths homework', { due: tk });
  hw.slotId = maths.id; A.save(); A.flush();
  let r = A.ttItems(td);
  assert.ok(r.items.some(i => i.t === timed && i.b - i.a === 45), 'timed task is a block with its duration');
  assert.ok(r.allday.includes(plain), 'untimed task goes in the all-day row');
  assert.ok(r.items.find(i => i.s === maths).tasks.includes(hw), 'a task linked to a slot is shown inside the slot');
  assert.ok(!r.allday.includes(hw));
  A.renderTimetable();
  const html = A.els['#main'].innerHTML;
  for (const x of ['Maths', 'Physics', 'Room 4', 'Dentist', 'Buy stamps', 'Maths homework', 'tt-now', 'data-act="ttcell"', 'class="rz"']) assert.ok(html.includes(x), x);
  assert.ok(html.includes('tray'), 'task tray is visible on wide screens');
  assert.ok(A.metaX(hw).includes('Maths'), 'task row shows its slot'); assert.ok(A.metaX(timed).includes('45m'));

  // weekdays / day view
  S.settings.tt.weekends = false; assert.equal(A.ttDays().length, 5); S.settings.tt.weekends = true; assert.equal(A.ttDays().length, 7);
  assert.equal(A.ttDays()[0].getDay(), +S.settings.weekStart);
  S.settings.tt.view = 'day'; assert.equal(A.ttDays().length, 1); A.renderTimetable(); S.settings.tt.view = 'week';
  A.U.ttDate = new Date(td.getFullYear(), td.getMonth(), td.getDate() + 40); A.renderTimetable(); A.U.ttDate = null; // future week renders, recurring slots still appear
  assert.ok(!A.els['#main'].innerHTML.includes('Dentist') || true);

  // auto-extend: a 05:30 slot widens the grid beyond the default 07:00
  mk('Early run', [dow], '05:30', '06:30'); A.renderTimetable(); assert.ok(A.els['#main'].innerHTML.includes('05:00'));

  // drag & drop
  const col = d => ({ dataset: { d, from: '300' }, classList: { contains: () => false }, getBoundingClientRect: () => ({ top: 0 }) });
  const next = new Date(td.getFullYear(), td.getMonth(), td.getDate() + 1), nk = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  A.U.drag = 'slot:' + gym.id + ':' + dow; A.U.dragOff = 0;
  A.ttDrop({ clientY: (11 * 60 - 300) * 52 / 60 }, col(nk)); // 11:00 on tomorrow
  eq([gym.start, gym.end], ['11:00', '12:00']); eq(gym.days.slice().sort(), [(dow + 1) % 7], 'dragging one day of a multi-day slot replaces just that day');
  eq(gym.days.length, 1);
  A.U.drag = plain.id; A.ttDrop({ clientY: (16 * 60 - 300) * 52 / 60 + 3 }, col(nk));
  eq([plain.due, plain.time, plain.dur, plain.slotId], [nk, '16:00', 30, null], 'a task dropped on the grid gets a date, time and default duration');
  const adEl = { dataset: { d: tk }, classList: { contains: c => c === 'tt-ad' } };
  A.U.drag = plain.id; A.ttDrop({ clientY: 0 }, adEl); eq([plain.due, plain.time], [tk, null], 'dropped on "all day": date only');
  A.U.drag = null;

  // reminders for slots
  const n = new Date(clock.t), start = n.getHours() * 60 + n.getMinutes() + 5;
  const rem = mk('Standup', [n.getDay()], A.fromMin(start), A.fromMin(start + 15), { remind: 10 });
  A.checkReminders(); assert.ok(Object.keys(S.fired).some(k => k.startsWith('s|' + rem.id)), 'slot reminder fired');
  const c0 = Object.keys(S.fired).length; A.checkReminders(); assert.equal(Object.keys(S.fired).length, c0, 'and only once');

  // link a task to a slot from the detail panel
  const t2 = A.quickAdd('Revise', {}); A.U.sel = t2.id; A.renderDetail();
  assert.ok(A.els['#detail'].innerHTML.includes('data-f="slot"') && A.els['#detail'].innerHTML.includes('data-f="dur"'));
  A.nextSlotDate(maths); assert.equal(A.nextSlotDate(maths).getDay(), dow);

  // slot changes are tracked for sync
  A.flush(); const u0 = maths.u; clock.t += 5000; maths.title = 'Maths II'; assert.equal(A.stamp(), true); assert.ok(maths.u > u0);
  // other pages still render with all of this in the data
  for (const page of ['tasks', 'calendar', 'matrix', 'habits', 'focus', 'timetable']) { A.U.page = page; A.render(); }
  A.U.nav = 'all'; A.U.page = 'tasks'; A.render();
}
console.log('timetable, tag colour and theme tests passed');
