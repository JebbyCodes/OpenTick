// Habits: any date, calendar maths, and the history graph's numbers. Run under several time zones (DST changes, a 30-minute DST zone).
import assert from 'node:assert/strict';
import { makeApp } from './harness.mjs';

for (const tz of ['UTC', 'Europe/London', 'America/New_York', 'Australia/Lord_Howe', 'Pacific/Auckland']) {
  process.env.TZ = tz;
  const app = makeApp(), { S, U } = app, k = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const D = (y, m, d) => new Date(y, m - 1, d), key = d => app.ymd(d);

  /* ---- calendar maths ---- */
  assert.equal(key(app.hmAddMonths(D(2028, 1, 31), 1)), '2028-02-29', 'leap year: 31 Jan + 1 month');
  assert.equal(key(app.hmAddMonths(D(2027, 1, 31), 1)), '2027-02-28');
  assert.equal(key(app.hmAddMonths(D(2026, 12, 15), 1)), '2027-01-15', 'across the year end');
  assert.equal(key(app.hmAddMonths(D(2026, 1, 15), -1)), '2025-12-15');
  assert.equal(key(app.hmClamp(D(1960, 5, 5))), '1970-01-01'); assert.equal(key(app.hmClamp(D(2200, 1, 1))), '2100-12-31');
  assert.equal(app.validKey('2026-02-30'), false); assert.equal(app.validKey('2028-02-29'), true); assert.equal(app.validKey('2027-02-29'), false);
  assert.equal(app.validKey(''), false); assert.equal(app.validKey('2026-1-5'), false); assert.equal(app.validKey(null), false);

  /* ---- the grid: 53 aligned weeks, consecutive calendar days, no repeats, whatever the DST changes do ---- */
  for (const ws of [0, 1, 6]) for (const end of [D(2026, 10, 15), D(2026, 3, 29), D(2026, 11, 1), D(2027, 1, 2), D(2028, 2, 29), D(2026, 3, 8)]) {
    const cols = app.hmGrid(end, ws), flat = cols.flat();
    assert.equal(cols.length, 53); assert.ok(cols.every(c => c.length === 7));
    assert.equal(new Set(flat).size, 371, `no repeated or skipped days (${tz}, ws ${ws}, ${key(end)})`);
    for (let i = 1; i < flat.length; i++) assert.equal(key(app.addDays(app.pYmd(flat[i - 1]), 1)), flat[i], `consecutive at ${flat[i]} (${tz})`);
    assert.ok(cols.every(c => app.pYmd(c[0]).getDay() === ws), 'every column starts on the chosen first weekday');
    assert.ok(cols[52].includes(key(end)), 'the last column holds the end date');
  }
  { // year boundary: the label for January carries the year, and December/January both appear
    const cols = app.hmGrid(D(2027, 1, 20), 1), labels = app.hmMonthLabels(cols).map(l => l.text);
    assert.ok(labels.includes('Jan 2027') && labels.includes('Dec') && labels.includes('Feb') === false);
    const colsNow = app.hmGrid(D(2026, 10, 15), 1), l2 = app.hmMonthLabels(colsNow);
    for (let i = 1; i < l2.length; i++) assert.ok(l2[i].c - l2[i - 1].c >= 3, 'month names never crowd each other');
    assert.equal(app.hmGrid(D(2028, 2, 29), 1).flat().includes('2028-02-29'), true, 'the leap day exists');
  }

  /* ---- levels ---- */
  assert.deepEqual([0, 0.01, 1 / 3, 0.34, 2 / 3, 0.67, 0.99, 1].map(app.hmLevel), [0, 1, 1, 2, 2, 3, 3, 4]);
  assert.equal(app.hmLevel(NaN), 0);

  /* ---- statuses: done / open / met / na / future ---- */
  const today = '2026-10-15', mk = (over = {}) => ({ id: 'h' + Math.random(), name: 'x', color: '#fff', goal: { per: 'day', n: 1 }, log: {}, ...over });
  const daily = mk({ created: '2026-10-01', log: { '2026-10-05': 1, '2026-10-06': 1, '2026-10-15': 1 } });
  const st = (h, d) => app.habitDayStatus(h, d, today);
  assert.equal(st(daily, '2026-09-30'), 'na', 'before the habit existed'); assert.equal(st(daily, '2026-10-01'), 'open', 'its first day, nothing yet = open, not na');
  assert.equal(st(daily, '2026-10-05'), 'done'); assert.equal(st(daily, '2026-10-07'), 'open'); assert.equal(st(daily, '2026-10-16'), 'future');
  const old = mk({ log: { '2026-09-20': 1 } }); assert.equal(app.habitStartKey(old), '2026-09-20', 'no created date: starts at the first check-in'); assert.equal(st(old, '2026-09-19'), 'na');
  const created = mk({ created: '2026-09-25', log: { '2026-09-20': 1 } }); assert.equal(app.habitStartKey(created), '2026-09-20', 'an older check-in beats a later created date');
  assert.equal(app.habitStartKey(mk()), null); assert.equal(st(mk(), '2026-10-10'), 'na', 'a habit with no created date and no check-ins has no history');
  assert.equal(app.habitStartKey(mk({ log: { 'nonsense': 1, '2026-02-30': 1 } })), null, 'malformed keys are ignored');
  // weekly 2x goal (weeks start Monday = 1): Mon 5 & Tue 6 done -> the rest of that week is met
  S.settings.weekStart = 1;
  const wk = mk({ created: '2026-09-01', goal: { per: 'week', n: 2 }, log: { '2026-10-05': 1, '2026-10-06': 1, '2026-10-14': 1 } });
  assert.equal(st(wk, '2026-10-05'), 'done'); assert.equal(st(wk, '2026-10-07'), 'met', 'goal reached earlier that week'); assert.equal(st(wk, '2026-10-11'), 'met');
  assert.equal(st(wk, '2026-10-12'), 'open', 'a new week asks again'); assert.equal(st(wk, '2026-10-14'), 'done'); assert.equal(st(wk, '2026-10-15'), 'open');
  const mo = mk({ created: '2026-01-01', goal: { per: 'month', n: 1 }, log: { '2026-10-02': 1 } }); assert.equal(st(mo, '2026-10-20' > today ? '2026-10-14' : '2026-10-14'), 'met'); assert.equal(st(mo, '2026-09-30'), 'open');

  /* ---- a day across several habits ---- */
  const hs = [daily, old, wk];
  let d = app.hmDay(hs, '2026-10-05', today); assert.deepEqual([d.kind, d.done, d.due], ['data', 2, 3], 'daily done + old (open) + weekly done');
  d = app.hmDay(hs, '2026-10-07', today); assert.deepEqual([d.done, d.due], [0, 2], 'the weekly goal was met, so it is not counted as due'); assert.equal(d.level, 0, 'due and nothing checked in is level 0, not "no data"');
  d = app.hmDay([wk], '2026-10-07', today); assert.deepEqual([d.kind, d.why], ['na', 'met'], 'only a met goal: nothing due');
  d = app.hmDay(hs, '2026-08-01', today); assert.equal(d.kind, 'na'); assert.equal(d.why, 'none');
  d = app.hmDay(hs, '2026-10-20', today); assert.equal(d.kind, 'future'); assert.equal(d.level, -1);
  d = app.hmDay([], '2026-10-05', today); assert.equal(d.kind, 'na', 'no habits at all');
  d = app.hmDay([daily], '2026-10-05', today); assert.equal(d.level, 4); d = app.hmDay([daily], '2026-10-07', today); assert.equal(d.level, 0);

  /* ---- summary: counts only days that had something due, never the future ---- */
  const cols = app.hmGrid(D(2026, 10, 15), 1), sm = app.hmSummary([daily], cols, today);
  assert.equal(sm.checkins, 3); assert.equal(sm.activeDays, 3); assert.equal(sm.trackedDays, 15, '1 Oct to 15 Oct'); assert.equal(sm.rate, 20, '3 of 15 days');
  assert.deepEqual({ ...app.hmSummary([], cols, today) }, { checkins: 0, activeDays: 0, trackedDays: 0, rate: null }, 'no habits: no rate, not 0%');
  assert.equal(app.hmSummary([mk({ created: '2026-10-20' })], cols, today).rate, null, 'a habit that starts in the future has no data yet');

  /* ---- records are never invented ---- */
  const before = JSON.stringify(S.habits); S.habits.push(daily, wk); U.hView = 'map'; app.renderHabits(); U.hView = 'track'; app.renderHabits();
  assert.equal(JSON.stringify(S.habits.slice(0, S.habits.length - 2)), before, 'rendering changes no habit');
  assert.deepEqual(Object.keys(daily.log), ['2026-10-05', '2026-10-06', '2026-10-15'], 'no fake completions were added to make the graph fuller');

  /* ---- navigation: the displayed window follows the chosen date ---- */
  U.page = 'habits'; U.hView = 'track'; U.hDate = null; const html0 = (app.renderHabits(), app.els['#main'].innerHTML);
  app.HABIT_ACT.hnav({ dataset: { n: '-7' } }); const a1 = key(app.hAnchor()); assert.equal(a1, key(app.addDays(app.pYmd(app.todayStr()), -7)));
  assert.notEqual(app.els['#main'].innerHTML, html0, 'the strip changed, not just a header'); assert.ok(app.els['#main'].innerHTML.includes(`data-d="${a1}"`));
  app.HABIT_ACT.hnav({ dataset: { n: '-7' } }); assert.equal(key(app.hAnchor()), key(app.addDays(app.pYmd(app.todayStr()), -14)));
  U.hDate = D(2027, 1, 3); app.renderHabits(); const h = app.els['#main'].innerHTML; assert.ok(h.includes('data-d="2026-12-28"') && h.includes('data-d="2027-01-03"'), 'a week crossing the year end'); assert.ok(h.includes('28 Dec 2026 – 3 Jan 2027'));
  U.hDate = D(2028, 3, 1); app.renderHabits(); assert.ok(app.els['#main'].innerHTML.includes('data-d="2028-02-29"'), 'the leap day is reachable');
  U.hDate = D(2040, 6, 1); app.renderHabits(); assert.ok(/data-d="2040-06-01"[^>]*disabled/.test(app.els['#main'].innerHTML), 'future days can be viewed but not checked in');
  U.hDate = null; U.hView = 'track';
}
process.env.TZ = 'UTC';
console.log('habit navigation + history tests passed');
