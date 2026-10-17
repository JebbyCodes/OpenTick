/* OpenTick habits: reaching any date, and the history graph.
   Dates are always handled as local calendar days (a "YYYY-MM-DD" key, or a Date at local midnight moved with setDate), never as
   24-hour millisecond steps, so month ends, leap days and daylight-saving changes cannot shift a check-in onto the wrong day.

   What the history graph colours (one habit, or all habits together), for each day up to today:
     done   the habit was checked in that day
     open   it still needed a check-in: a daily habit, or a weekly / monthly goal not yet met earlier in that week / month
     met    a weekly / monthly goal that was already met earlier in its period: it is not asking for more, so it is not counted
     na     before the habit existed (its created date, or its first check-in if that is older)
   A day's level is  done / (done + open)  with  0 = none, 1 = up to a third, 2 = up to two thirds, 3 = more than that but not all,
   4 = all of them.  A day where nothing was due (no habit existed yet, or every goal was already met) is "no data", which is drawn
   differently from a day on which something was due and nothing was checked in.  Future days are never filled in. */
const HM_MIN = '1970-01-01', HM_MAX = '2100-12-31', HM_WEEKS = 53;
const dayOnly = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const validKey = k => /^\d{4}-\d{2}-\d{2}$/.test(String(k || '')) && ymd(pYmd(k)) === k; // rejects 2026-02-30 and the like
const hmClamp = d => { const lo = pYmd(HM_MIN), hi = pYmd(HM_MAX), x = dayOnly(d); return x < lo ? lo : x > hi ? hi : x; };
// the same day of the month n months away, held to that month's last day (31 Jan + 1 month = 28 / 29 Feb)
function hmAddMonths(d, n) { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; }

function habitStartKey(h) {
  const ks = Object.keys((h && h.log) || {}).filter(k => h.log[k] && validKey(k)).sort(), c = h && validKey(h.created) ? h.created : null, f = ks[0] || null;
  return c && f ? (c < f ? c : f) : c || f;
}
function habitDayStatus(h, key, today = todayStr()) {
  if (key > today) return 'future';
  const st = habitStartKey(h); if (!st || key < st) return 'na';
  if (h.log && h.log[key]) return 'done';
  const g = habitGoal(h); if (g.per === 'day') return 'open';
  let n = 0; for (let d = hStart(pYmd(key), g.per); ymd(d) < key; d = addDays(d, 1)) if (h.log && h.log[ymd(d)]) n++;
  return n >= g.n ? 'met' : 'open';
}
const hmLevel = f => (!(f > 0) ? 0 : f >= 1 ? 4 : f <= 1 / 3 ? 1 : f <= 2 / 3 ? 2 : 3);
function hmDay(habits, key, today = todayStr()) {
  const items = habits.map(h => ({ h, s: habitDayStatus(h, key, today) }));
  if (key > today) return { key, kind: 'future', done: 0, due: 0, level: -1, items };
  const done = items.filter(i => i.s === 'done').length, due = done + items.filter(i => i.s === 'open').length;
  if (!due) return { key, kind: 'na', done: 0, due: 0, level: -1, items, why: items.some(i => i.s === 'met') ? 'met' : 'none' };
  return { key, kind: 'data', done, due, level: hmLevel(done / due), items };
}
// weeks as columns of 7 date keys, oldest first, aligned to the chosen first day of the week; the last column holds `end`
function hmGrid(end, ws, weeks = HM_WEEKS) {
  const e = dayOnly(end), last = addDays(e, -((e.getDay() - ws + 7) % 7)), first = addDays(last, -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, c) => Array.from({ length: 7 }, (_, r) => ymd(addDays(first, c * 7 + r))));
}
// a month name over the column that holds the 1st, skipped when it would crowd the previous name
function hmMonthLabels(cols) {
  const out = []; let lastC = -9;
  cols.forEach((col, c) => {
    const i = col.findIndex(k => k.endsWith('-01')); if (i < 0 && c) return;
    const m = pYmd(col[i < 0 ? 0 : i]).getMonth(), y = pYmd(col[i < 0 ? 0 : i]).getFullYear();
    if (c - lastC < 3) return; lastC = c; out.push({ c, text: MONTHS[m].slice(0, 3) + (m === 0 ? ' ' + y : '') });
  });
  return out;
}
function hmSummary(habits, cols, today = todayStr()) {
  let done = 0, due = 0, active = 0, tracked = 0;
  for (const col of cols) for (const k of col) {
    if (k > today) continue; const d = hmDay(habits, k, today);
    if (d.kind === 'data') { tracked++; done += d.done; due += d.due; if (d.done) active++; }
  }
  return { checkins: done, activeDays: active, trackedDays: tracked, rate: due ? Math.round((done / due) * 100) : null };
}
const hmWords = d => (d.kind === 'future' ? 'upcoming' : d.kind === 'na' ? (d.why === 'met' ? 'nothing due, goals already met' : 'no habit tracked yet') : `${d.done} of ${d.due} due checked in`);
const hmLong = k => `${FULLDAYS[pYmd(k).getDay()]} ${pYmd(k).getDate()} ${MONTHS[pYmd(k).getMonth()]} ${pYmd(k).getFullYear()}`;

/* ---------- state ---------- */
const hAnchor = () => hmClamp(U.hDate ? U.hDate : new Date());
const hmEnd = () => hmClamp(U.hMapEnd ? U.hMapEnd : new Date());
function hmHabits() { const id = U.hMapHabit; const one = id && id !== 'all' && S.habits.find(h => h.id === id); return one ? [one] : S.habits; }
function hmEarliest() { return S.habits.map(habitStartKey).filter(Boolean).sort()[0] || null; }

/* ---------- views ---------- */
const hSeg = () => `<div class="seg" role="tablist" aria-label="Habit view">${[['track', 'Check in', 'check'], ['map', 'History', 'activity']].map(([v, n]) => `<button role="tab" aria-selected="${(U.hView || 'track') === v}" class="${(U.hView || 'track') === v ? 'on' : ''}" data-act="hview" data-v="${v}">${n}</button>`).join('')}</div>`;
function hmRangeLabel(days) {
  const a = days[0], b = days[days.length - 1], same = a.getFullYear() === b.getFullYear();
  return `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)}${same ? '' : ' ' + a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
}
function hNavHtml(anchor, days) {
  const tk = todayStr(), ak = ymd(anchor), isToday = ak === tk;
  return `<div class="hnav" role="group" aria-label="Choose which days to show">
<button class="ib" data-act="hnav" data-n="-7" title="Previous week" aria-label="Previous week">${ic('left')}</button>
<div class="hrange" aria-live="polite"><b>${esc(hmRangeLabel(days))}</b><small>${isToday ? 'Up to today' : `Up to ${esc(hmLong(ak))}`}</small></div>
<button class="ib" data-act="hnav" data-n="7" title="Next week" aria-label="Next week">${ic('right')}</button>
<label class="hjump"><span class="vh">Jump to a date</span><input type="date" data-hjump min="${HM_MIN}" max="${HM_MAX}" value="${ak}"></label>
<button class="btn${isToday ? '' : ' pri'}" data-act="htoday"${isToday ? ' disabled' : ''}>Today</button></div>`;
}
function renderHabits() {
  if ((U.hView || 'track') === 'map') return renderHabitMap();
  const anchor = hAnchor(), tk = todayStr(), ak = ymd(anchor), days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i - 6));
  const cards = S.habits.map(h => {
    const g = habitGoal(h), sk = streak(h), full0 = habitProgress(h), full = g.per !== 'day' && full0.done >= g.n;
    const pa = { ...g, done: habitCounts(h, g.per)[hKey(anchor, g.per)] || 0 }, isNow = hKey(anchor, g.per) === hKey(new Date(), g.per), done = pa.done >= g.n && g.per !== 'day';
    const when = isNow ? `this ${g.per}` : g.per === 'week' ? `week of ${fmtDate(hKey(anchor, 'week'))}` : MONTHS[hStart(anchor, 'month').getMonth()] + ' ' + hStart(anchor, 'month').getFullYear();
    const future = ak > tk;
    return `<div class="habit" data-id="${h.id}" style="--c:${h.color}"><div class="hh"><span class="hi" data-act="hmenu" data-id="${h.id}" title="Edit habit and icon">${esc(h.icon || '✓')}</span><div class="hn" data-act="hmenu" data-id="${h.id}"><b>${esc(h.name)}</b><small><span class="sk${sk >= FIRE_MIN ? ' hot' : ''}">${sk >= FIRE_MIN ? ic('flame', 12) : ''}${sk} ${g.per} streak</span> · ${esc(habitGoalLabel(g))} · ${Object.keys(h.log).length} check-ins</small></div><button class="hcheck${h.log[ak] ? ' on' : ''}" data-act="hday" data-id="${h.id}" data-d="${ak}" aria-pressed="${!!h.log[ak]}" aria-label="${future ? 'Cannot check in on a future date' : (h.log[ak] ? 'Checked in on ' : 'Check in on ') + esc(hmLong(ak))}" title="${ak === tk ? 'Check in today' : esc(hmLong(ak))}"${future ? ' disabled' : ''}>${ic('check', 20)}</button></div>${g.per === 'day' ? '' : `<div class="hprog${done ? ' full' : ''}" title="${pa.done} of ${g.n} ${when}"><div><i style="width:${Math.min(100, Math.round(pa.done / g.n * 100))}%"></i></div><small>${pa.done}/${g.n} ${when}${done ? ' ✓' : ''}</small></div>`}<div class="hstrip">${days.map(d => { const k = ymd(d), fut = k > tk; return `<button class="hd${h.log[k] ? ' on' : ''}${k === ak ? ' cur' : ''}${k === tk ? ' today' : ''}${fut ? ' fut' : ''}" data-act="hday" data-id="${h.id}" data-d="${k}" aria-pressed="${!!h.log[k]}" aria-label="${esc(hmLong(k))}${h.log[k] ? ', checked in' : fut ? ', upcoming' : ', not checked in'}"${fut ? ' disabled' : ''}><small>${DAYS[d.getDay()]}</small>${d.getDate()}</button>`; }).join('')}</div></div>`;
  }).join('');
  $('#main').innerHTML = topHtml('Habit', hSeg() + `<button class="btn pri" data-act="haddlg" aria-label="New habit">${ic('plus', 16)}<span class="hide-m"> New habit</span></button>`)
    + `<div class="body habits">${S.habits.length ? hNavHtml(anchor, days) : ''}${cards || `<div class="empty">${ic('activity', 44)}<p>Build a streak — add your first habit</p></div>`}</div>`;
  if (U.hFocus) { const b = $(U.hFocus); U.hFocus = null; if (b && b.focus) b.focus(); }
}

function hmCellsHtml(habits, cols, today, sel) {
  const one = habits.length === 1;
  return cols.map(col => col.map(k => {
    const d = hmDay(habits, k, today), cls = d.kind === 'future' ? 'fut' : d.kind === 'na' ? 'na' : 'l' + (one ? (d.level ? 4 : 0) : d.level);
    return `<button class="hm-cell ${cls}${k === sel ? ' sel' : ''}" data-act="hmsel" data-d="${k}" tabindex="${k === sel ? 0 : -1}" aria-pressed="${k === sel}" aria-label="${esc(hmLong(k))}: ${hmWords(d)}" title="${esc(hmLong(k))} — ${hmWords(d)}"></button>`;
  }).join('')).join('');
}
function hmDetailHtml(habits, key, today) {
  if (!key) return `<p class="hint">Choose a day to see which habits were checked in.</p>`;
  const d = hmDay(habits, key, today), st = { done: ['check', 'Checked in'], open: ['circle', 'Not checked in'], met: ['minus', 'Goal already met for this period'], na: ['minus', 'Not tracked yet'], future: ['calendar', 'Upcoming'] };
  return `<div class="hm-dh"><b>${esc(hmLong(key))}</b><button class="btn sm" data-act="hmopen" data-d="${key}">${ic('right', 14)} Open this day</button></div><p class="hm-dsum">${d.kind === 'data' ? `${d.done} of ${d.due} due ${d.due === 1 ? 'habit' : 'habits'} checked in (${Math.round(d.done / d.due * 100)}%)` : d.kind === 'future' ? 'This day has not happened yet, so nothing is filled in.' : d.why === 'met' ? 'Nothing was due: every weekly or monthly goal was already met.' : 'No habit was being tracked yet.'}</p>`
    + `<ul class="hm-dl">${d.items.map(i => `<li class="s-${i.s}"><span class="hm-di" style="--c:${i.h.color}">${esc(i.h.icon || '✓')}</span><span class="hm-dn">${esc(i.h.name)}</span><span class="hm-ds">${ic(st[i.s][0], 13)} ${st[i.s][1]}</span></li>`).join('')}</ul>`;
}
function renderHabitMap() {
  const today = todayStr(), end = hmEnd(), cols = hmGrid(end, +S.settings.weekStart), habits = hmHabits(), one = habits.length === 1;
  const first = pYmd(cols[0][0]), lastD = pYmd(cols[cols.length - 1][6]), earliest = hmEarliest(), y0 = earliest ? +earliest.slice(0, 4) : new Date().getFullYear(), y1 = new Date().getFullYear() + 1;
  const sel = U.hSel && cols.some(c => c.includes(U.hSel)) ? U.hSel : (today >= cols[0][0] && today <= cols[cols.length - 1][6] ? today : cols[cols.length - 1][0]);
  U.hSel = sel;
  const sum = hmSummary(habits, cols, today), wsOrder = Array.from({ length: 7 }, (_, r) => (+S.settings.weekStart + r) % 7);
  const canPrev = !earliest || ymd(first) > earliest, canNext = ymd(lastD) < ymd(addDays(new Date(), 365));
  const color = one ? habits[0].color : 'var(--acc)';
  const body = !S.habits.length ? `<div class="empty">${ic('activity', 44)}<p>Add a habit to see its history here</p></div>` : `
<div class="hnav" role="group" aria-label="Choose the period">
<button class="ib" data-act="hmnav" data-n="-1" title="Earlier" aria-label="Earlier year"${canPrev ? '' : ' disabled'}>${ic('left')}</button>
<div class="hrange" aria-live="polite"><b>${esc(hmRangeLabel([first, lastD]))}</b><small>${HM_WEEKS} weeks</small></div>
<button class="ib" data-act="hmnav" data-n="1" title="Later" aria-label="Later year"${canNext ? '' : ' disabled'}>${ic('right')}</button>
<label class="hjump"><span class="vh">Year</span><select data-hmyear aria-label="Jump to a year">${Array.from({ length: y1 - Math.min(y0, y1) + 1 }, (_, i) => y1 - i).map(y => `<option value="${y}"${y === end.getFullYear() ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
<button class="btn${U.hMapEnd ? ' pri' : ''}" data-act="htoday"${U.hMapEnd ? '' : ' disabled'}>Latest</button></div>
<label class="hm-pick">Show <select data-hmhabit aria-label="Which habits">${opts([['all', 'All habits together'], ...S.habits.map(h => [h.id, (h.icon || '✓') + ' ' + h.name])], U.hMapHabit || 'all')}</select></label>
<div class="hm-sum" role="group" aria-label="Summary of this period"><div><b>${sum.checkins}</b><small>check-ins</small></div><div><b>${sum.activeDays}</b><small>active days</small></div><div><b>${sum.rate == null ? '–' : sum.rate + '%'}</b><small>completion rate</small></div></div>
<div class="hm" style="--hc:${color}">
<div class="hm-scroll" tabindex="-1"><div class="hm-in" style="--wk:${cols.length}">
<div class="hm-months" aria-hidden="true">${hmMonthLabels(cols).map(m => `<span style="grid-column:${m.c + 1} / span 4">${m.text}</span>`).join('')}</div>
<div class="hm-wd" aria-hidden="true">${wsOrder.map((d, r) => `<span>${r % 2 === 0 && r < 5 ? DAYS[d] : ''}</span>`).join('')}</div>
<div class="hm-cells" role="group" aria-label="Habit history, ${esc(hmRangeLabel([first, lastD]))}">${hmCellsHtml(habits, cols, today, sel)}</div></div></div>
<div class="hm-legend" aria-label="Legend">${one ? `<span><i class="hm-cell l0"></i>No check-in</span><span><i class="hm-cell l4"></i>Checked in</span>` : `<span class="hm-sc">Less <i class="hm-cell l0"></i><i class="hm-cell l1"></i><i class="hm-cell l2"></i><i class="hm-cell l3"></i><i class="hm-cell l4"></i> More</span>`}<span><i class="hm-cell na"></i>Not tracked / nothing due</span><span><i class="hm-cell fut"></i>Upcoming</span></div>
<details class="hm-how"><summary>How is this calculated?</summary><p>Each square is one day. Its shade is the share of the habits that were due that day and got checked in: none, up to a third, up to two thirds, more than that, or all of them${one ? ' (with a single habit a day is either checked in or not)' : ''}. A weekly or monthly goal stops counting as due once it has been met for that week or month, and days before a habit was created are left out, so a missed day never appears for something you were not yet doing. Striped squares have nothing due; dashed squares are in the future. Nothing is added to your records to fill the graph.</p></details></div>
<div class="hm-detail" aria-live="polite">${hmDetailHtml(habits, sel, today)}</div>`;
  const sc = $('.hm-scroll'), keepX = sc ? sc.scrollLeft : null;
  $('#main').innerHTML = topHtml('Habit', hSeg() + `<button class="btn pri" data-act="haddlg" aria-label="New habit">${ic('plus', 16)}<span class="hide-m"> New habit</span></button>`) + `<div class="body habits hmv">${body}</div>`;
  const n = $('.hm-scroll'); if (n) n.scrollLeft = keepX != null && !U.hScrollEnd ? keepX : n.scrollWidth; U.hScrollEnd = false;
  if (U.hFocus) { const b = $(U.hFocus); U.hFocus = null; if (b && b.focus) b.focus(); }
}
function hmSelect(key, focus) {
  U.hSel = key; const habits = hmHabits(), today = todayStr();
  $$('.hm-cell.sel').forEach(c => { c.classList.remove('sel'); c.tabIndex = -1; c.setAttribute('aria-pressed', 'false'); });
  const c = $(`.hm-cell[data-d="${key}"]`); if (c) { c.classList.add('sel'); c.tabIndex = 0; c.setAttribute('aria-pressed', 'true'); if (focus && c.focus) c.focus({ preventScroll: false }); }
  const d = $('.hm-detail'); if (d) d.innerHTML = hmDetailHtml(habits, key, today);
}

const HABIT_ACT = {
  hnav(el) { U.hDate = hmClamp(addDays(hAnchor(), +el.dataset.n)); U.hFocus = `[data-act="hnav"][data-n="${el.dataset.n}"]`; renderMain(); },
  htoday() { if ((U.hView || 'track') === 'map') { U.hMapEnd = null; U.hScrollEnd = true; U.hSel = todayStr(); } else U.hDate = null; U.hFocus = '[data-act="htoday"]'; renderMain(); },
  hview(el) { U.hView = el.dataset.v === 'map' ? 'map' : 'track'; U.hScrollEnd = true; U.hFocus = `[data-act="hview"][data-v="${U.hView}"]`; renderMain(); },
  hmnav(el) { U.hMapEnd = hmClamp(addDays(hmEnd(), 364 * +el.dataset.n)); if (ymd(U.hMapEnd) >= todayStr()) U.hMapEnd = null; U.hScrollEnd = true; U.hFocus = `[data-act="hmnav"][data-n="${el.dataset.n}"]`; renderMain(); },
  hmsel(el) { hmSelect(el.dataset.d, true); },
  hmopen(el) { if (!validKey(el.dataset.d)) return; U.hDate = hmClamp(pYmd(el.dataset.d)); U.hView = 'track'; renderMain(); window.scrollTo && window.scrollTo(0, 0); },
};
document.addEventListener('change', e => {
  const t = e.target; if (!t || !t.matches) return;
  if (t.matches('[data-hjump]')) { if (validKey(t.value)) { U.hDate = hmClamp(pYmd(t.value)); U.hFocus = '[data-hjump]'; renderMain(); } else toast('That is not a date I can show — pick one from the calendar.'); }
  else if (t.matches('[data-hmhabit]')) { U.hMapHabit = t.value; U.hFocus = '[data-hmhabit]'; renderMain(); }
  else if (t.matches('[data-hmyear]')) { const y = +t.value, cur = new Date().getFullYear(); U.hMapEnd = y >= cur ? null : new Date(y, 11, 31); U.hScrollEnd = true; U.hFocus = '[data-hmyear]'; renderMain(); }
});
// arrow keys move between the squares of the graph (left / right = a week, up / down = a day), Home / End = first / last day shown
document.addEventListener('keydown', e => {
  const c = e.target && e.target.classList && e.target.classList.contains('hm-cell') && e.target.dataset.d ? e.target : null; if (!c) return;
  const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1, PageUp: -28, PageDown: 28 }[e.key];
  const keys = $$('.hm-cell[data-d]').map(x => x.dataset.d);
  let to = step ? addDays(pYmd(c.dataset.d), step) : null, k = to ? ymd(to) : e.key === 'Home' ? keys[0] : e.key === 'End' ? keys[keys.length - 1] : null;
  if (!k) return; e.preventDefault(); if (k < keys[0]) k = keys[0]; if (k > keys[keys.length - 1]) k = keys[keys.length - 1]; hmSelect(k, true);
});
