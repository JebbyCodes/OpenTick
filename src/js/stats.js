/* OpenTick Statistics (0.9).
   What you did and when, read from the per-day tally core.js keeps in S.activity (see "activity tally" there). Nothing is counted, and
   nothing is shown, unless History is on (Settings → Data & sync → History & statistics). The tally is per device and never synced.
   A tally key is `kind.action|where it is filed|hour`; a filter is (range, kinds, actions, scope), and every number, chart and the
   heatmap on the page and in the shared image is worked out from the same filtered rows (stEach), so they always agree.
   The shared image is an SVG drawn from the same numbers (stSvg), turned into a PNG with a canvas. */

const ST_KINDS = [['task', 'Tasks'], ['note', 'Notes'], ['habit', 'Habits'], ['focus', 'Focus sessions'], ['list', 'Lists'], ['project', 'Projects'], ['slot', 'Timetable'], ['countdown', 'Countdowns'], ['contact', 'Contacts'], ['board', 'Boards'], ['template', 'Templates'], ['zone', 'Time zones'], ['section', 'Sections'], ['entry', 'Entries']];
const ST_ACTS = ['add', 'edit', 'done', 'reopen', 'wontdo', 'delete', 'restore', 'purge'];
const ST_RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 3 months'], ['180', 'Last 6 months'], ['365', 'Last year'], ['all', 'All time'], ['custom', 'Custom dates…']];
const ST_PANELS = [['cards', 'Key numbers'], ['heat', 'Heatmap'], ['trend', 'Over time'], ['kinds', 'By type'], ['acts', 'By action'], ['week', 'By weekday'], ['hour', 'By time of day'], ['lists', 'By list']];
const ST_KIND_NAME = Object.fromEntries(ST_KINDS);
const ST_DATE = /^\d{4}-\d{2}-\d{2}$/;
const stNum = n => Number(n).toLocaleString();
const stDays = (a, b) => Math.round((pYmd(b) - pYmd(a)) / 864e5);

/* ---------- the filter ---------- */
function stFilter() {
  const st = S.settings.stats, today = todayStr(); let from, to = today;
  if (st.range === 'custom') { from = ST_DATE.test(st.from) ? st.from : today; to = ST_DATE.test(st.to) ? st.to : today; if (from > to) [from, to] = [to, from]; }
  else if (st.range === 'all') { from = Object.keys(S.activity.days).sort()[0] || today; }
  else { const n = Math.max(1, Math.min(800, +st.range || 90)); from = ymd(addDays(new Date(), 1 - n)); }
  return { from, to, kinds: new Set(st.kinds || []), acts: new Set(st.acts || []), scope: st.scope || '', sub: st.sub !== false, hide: new Set(st.hide || []) };
}
// the filed-under values a scope stands for: a list (with its sublists unless asked not to), a project (its lists), or null for everything
function stScopeSet(scope, sub) {
  if (scope.startsWith('p:')) { const p = projectOf(scope.slice(2)); return new Set(p ? [...(sub ? projectListIds(p) : (p.listIds || [])), 'p:' + p.id] : [scope]); }
  if (scope.startsWith('l:')) { const id = scope.slice(2); return new Set(sub ? listIds(id) : [id]); }
  return null;
}
function stScopeName(scope) {
  if (scope.startsWith('p:')) { const p = projectOf(scope.slice(2)); return p ? p.name : 'a removed project'; }
  if (scope.startsWith('l:')) { const id = scope.slice(2); return id === 'inbox' ? 'Inbox' : S.lists.some(l => l.id === id) ? listLabel(id) : 'a removed list'; }
  return '';
}
const stKindsOn = f => !f.kinds.size ? null : f.kinds;
// every counted row inside the filter: fn(day, kind, action, scope, hour (-1 = unknown), count, isFocusMinutes)
function stEach(f, fn) {
  const sc = f.scope ? stScopeSet(f.scope, f.sub) : null, days = S.activity.days;
  for (const day of Object.keys(days)) {
    if (day < f.from || day > f.to) continue;
    for (const [key, n] of Object.entries(days[day])) {
      const [ka, scope = '', hr = ''] = key.split('|'), dot = ka.indexOf('.'), kind = ka.slice(0, dot), raw = ka.slice(dot + 1), min = raw === 'min', act = min ? 'done' : raw;
      if (f.kinds.size && !f.kinds.has(kind)) continue;
      if (f.acts.size && !f.acts.has(act)) continue;
      if (sc && !sc.has(scope)) continue;
      fn(day, kind, act, scope, hr === '' ? -1 : +hr, n, min);
    }
  }
}

/* ---------- the numbers ---------- */
function stCompute(f) {
  const r = { total: 0, byDay: {}, kinds: {}, acts: {}, wd: [0, 0, 0, 0, 0, 0, 0], hr: Array(24).fill(0), lists: {}, focusMin: 0, sessions: 0, taskAdd: 0, taskDone: 0, noteAdd: 0, noteEdit: 0, habit: 0 };
  const wdOf = {}, add = (o, k, n) => { o[k] = (o[k] || 0) + n; };
  stEach(f, (day, kind, act, scope, hr, n, min) => {
    if (min) { r.focusMin += n; return; }
    r.total += n; add(r.byDay, day, n); add(r.kinds, kind, n); add(r.acts, act, n); add(r.lists, scope, n);
    r.wd[wdOf[day] != null ? wdOf[day] : (wdOf[day] = pYmd(day).getDay())] += n;
    if (hr >= 0) r.hr[hr] += n;
    if (kind === 'task') { if (act === 'add') r.taskAdd += n; else if (act === 'done') r.taskDone += n; }
    else if (kind === 'note') { if (act === 'add') r.noteAdd += n; else if (act === 'edit') r.noteEdit += n; }
    else if (kind === 'habit' && act === 'done') r.habit += n;
    else if (kind === 'focus' && act === 'done') r.sessions += n;
  });
  r.span = Math.max(1, stDays(f.from, f.to) + 1);
  const ds = Object.keys(r.byDay); r.activeDays = ds.length; r.avg = ds.length ? r.total / ds.length : 0;
  r.busiest = ds.reduce((b, d) => (!b || r.byDay[d] > r.byDay[b] ? d : b), null);
  let run = 0, best = 0;
  for (let d = pYmd(f.from), i = 0; i < r.span; d = addDays(d, 1), i++) { if (r.byDay[ymd(d)]) { run++; best = Math.max(best, run); } else run = 0; }
  r.bestStreak = best;
  let cur = 0, d = pYmd(f.to); if (!r.byDay[ymd(d)] && f.to === todayStr()) d = addDays(d, -1); // today is not over yet: an empty today does not break the streak
  while (ymd(d) >= f.from && r.byDay[ymd(d)]) { cur++; d = addDays(d, -1); }
  r.curStreak = cur;
  return r;
}
// the bars of "over time": a day each for a month or so, a week each for up to ~6 months, else a month each; empty stretches stay in
function stTrend(f, r) {
  const step = r.span <= 45 ? 'day' : r.span <= 200 ? 'week' : 'month', ws = +S.settings.weekStart || 0, out = [], at = new Map();
  const keyOf = d => (step === 'day' ? ymd(d) : step === 'week' ? ymd(addDays(d, -((d.getDay() - ws + 7) % 7))) : ymd(d).slice(0, 7));
  const labelOf = k => { const d = pYmd(step === 'month' ? k + '-01' : k); return step === 'month' ? MONTHS[d.getMonth()].slice(0, 3) + (d.getMonth() === 0 || !out.length ? ' ’' + String(d.getFullYear()).slice(2) : '') : d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
  for (let d = pYmd(f.from), i = 0; i < r.span; d = addDays(d, 1), i++) { const k = keyOf(d); if (!at.has(k)) { const b = { k, n: 0, label: '', title: '' }; at.set(k, b); out.push(b); b.label = labelOf(k); } at.get(k).n += r.byDay[ymd(d)] || 0; }
  out.forEach(b => { b.title = (step === 'week' ? 'Week of ' : '') + b.label + ': ' + stNum(b.n); });
  return { step, bars: out };
}
// the heatmap: up to 53 weeks ending at the last day, one column per week, a row per weekday (in the week-start order); level 0-4 by quartile of the busy days
function stHeat(f, r) {
  const ws = +S.settings.weekStart || 0, end = pYmd(f.to), lim = addDays(end, -(53 * 7 - 1));
  let s0 = pYmd(f.from); if (s0 < lim) s0 = lim; s0 = addDays(s0, -((s0.getDay() - ws + 7) % 7));
  const vals = Object.values(r.byDay).filter(v => v > 0).sort((a, b) => a - b), q = p => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] || 0, q1 = q(0.25), q2 = q(0.5), q3 = q(0.75);
  const cols = Math.ceil((stDays(ymd(s0), f.to) + 1) / 7), cells = [], months = [];
  for (let c = 0; c < cols; c++) {
    const col = []; for (let rw = 0; rw < 7; rw++) {
      const d = addDays(s0, c * 7 + rw), k = ymd(d);
      if (k < f.from || k > f.to) { col.push(null); continue; }
      const n = r.byDay[k] || 0; col.push({ k, n, level: n ? 1 + (n > q1) + (n > q2) + (n > q3) : 0 });
    }
    cells.push(col);
    const first = col.find(Boolean); if (first) { const m = first.k.slice(0, 7); if (!months.length || months[months.length - 1].m !== m) months.push({ c, m, label: MONTHS[+m.slice(5) - 1].slice(0, 3) }); }
  }
  return { cols, cells, months, ws };
}
const stWdNames = () => { const ws = +S.settings.weekStart || 0; return Array.from({ length: 7 }, (_, i) => (ws + i) % 7); };
const stDayText = (k, year) => { const d = pYmd(k); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}${year === false || d.getFullYear() === new Date().getFullYear() ? '' : ' ' + d.getFullYear()}`; };
// the key numbers; each belongs to a kind (and maybe an action) so a filter that excludes it hides it instead of showing a misleading 0
function stCards(f, r) {
  const all = [
    ['Activity', stNum(r.total), null, null], ['Active days', `${stNum(r.activeDays)} of ${stNum(r.span)}`, null, null],
    ['Current streak', r.curStreak + (r.curStreak === 1 ? ' day' : ' days'), null, null], ['Best streak', r.bestStreak + (r.bestStreak === 1 ? ' day' : ' days'), null, null],
    ['Tasks completed', stNum(r.taskDone), 'task', 'done'], ['Tasks added', stNum(r.taskAdd), 'task', 'add'],
    ['Notes written', stNum(r.noteAdd), 'note', 'add'], ['Notes edited', stNum(r.noteEdit), 'note', 'edit'],
    ['Habit check-ins', stNum(r.habit), 'habit', 'done'], ['Focus time', r.focusMin ? fmtDur(r.focusMin) : '0m', 'focus', 'done'],
    ['Per active day', r.avg ? (Math.round(r.avg * 10) / 10).toLocaleString() : '0', null, null], ['Busiest day', r.busiest ? `${stDayText(r.busiest)} · ${stNum(r.byDay[r.busiest])}` : '–', null, null],
  ];
  return all.filter(([, , k, a]) => (!k || !f.kinds.size || f.kinds.has(k)) && (!a || !f.acts.size || f.acts.has(a)));
}
function stListRows(r, names) {
  const rows = Object.entries(r.lists).filter(([k]) => k !== '').map(([k, n]) => [k, n]).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return rows.map(([k, n], i) => [!names ? 'List ' + (i + 1) : k.startsWith('p:') ? (projectOf(k.slice(2)) || { name: 'A removed project' }).name : S.lists.some(l => l.id === k) ? listLabel(k) : 'A removed list', n]);
}
const stBarRows = (obj, names, order) => Object.entries(obj).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0])).map(([k, n]) => [names[k] || k, n]);

/* ---------- the page ---------- */
function stOffHtml(what) {
  return `<div class="stoff">${ic('history', 44)}<h2>${what} needs History</h2><p>${what === 'Statistics' ? 'Statistics are worked out from the history OpenTick keeps on this device, and History is off, so there is nothing to show.' : 'History is off, so OpenTick is not keeping a list of what you change.'} Turn it on to start. It stays on this device (it is not synced), you can switch it off again, and you can clear it at any time.</p><button class="btn pri" data-act="histon">Turn on history</button></div>`;
}
const stBars = (rows, cls = '') => { const mx = Math.max(1, ...rows.map(x => x[1])); return `<div class="stbars ${cls}">${rows.map(([l, n]) => `<div class="stbar"><span class="stl" title="${esc(l)}">${esc(l)}</span><span class="stbw"><span class="stfill" style="width:${Math.max(2, Math.round(n / mx * 100))}%"></span></span><b>${stNum(n)}</b></div>`).join('') || '<p class="hint">Nothing here for these filters.</p>'}</div>`; };
function stCols(vals, labels, titles) {
  const mx = Math.max(1, ...vals);
  return `<div class="stcols" style="--n:${vals.length}">${vals.map((v, i) => `<div class="stcol" title="${esc(titles[i])}"><span class="stcb"><span style="height:${v ? Math.max(3, Math.round(v / mx * 100)) : 0}%"></span></span><small>${esc(labels[i])}</small></div>`).join('')}</div>`;
}
function stHeatHtml(f, r) {
  const h = stHeat(f, r);
  const head = `<div class="sthm-m" style="--c:${h.cols}">${h.months.map(m => `<span style="grid-column:${m.c + 1}">${m.label}</span>`).join('')}</div>`;
  const cells = `<div class="sthm" style="--c:${h.cols}">${h.cells.map(col => col.map(c => (c ? `<span class="stcell l${c.level}" title="${esc(stDayText(c.k) + ': ' + stNum(c.n))}"></span>` : '<span class="stcell none"></span>')).join('')).join('')}</div>`;
  return `<div class="stheat" role="img" aria-label="Activity heatmap, ${r.activeDays} active days${r.busiest ? ', busiest day ' + esc(stDayText(r.busiest)) : ''}">${head}${cells}<div class="sthm-k"><span>Less</span>${[0, 1, 2, 3, 4].map(l => `<span class="stcell l${l}"></span>`).join('')}<span>More</span></div></div>`;
}
const stPanel = (id, title, body, f) => (f.hide.has(id) ? '' : `<section class="stp stp-${id}"><h3>${title}</h3>${body}</section>`);
function stScopeOptions(cur) {
  const o = (v, n) => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(n)}</option>`;
  let h = o('', 'Everything');
  if (S.projects.length) h += `<optgroup label="Projects">${S.projects.map(p => o('p:' + p.id, p.name)).join('')}</optgroup>`;
  h += `<optgroup label="Lists">${o('l:inbox', 'Inbox')}${listTree().map(({ l, depth }) => o('l:' + l.id, '  '.repeat(depth) + (depth ? '↳ ' : '') + l.name)).join('')}</optgroup>`;
  if (cur && !h.includes(` selected`)) h += o(cur, stScopeName(cur));
  return h;
}
function stFilterSummary(f, names = true) {
  const bits = [f.from === f.to ? stDayText(f.from) : `${stDayText(f.from)} – ${stDayText(f.to)}`];
  if (f.scope) bits.push(names ? stScopeName(f.scope) + (f.sub && !f.scope.startsWith('p:') && S.lists.some(l => l.parent === f.scope.slice(2)) ? ' and sublists' : '') : 'one ' + (f.scope.startsWith('p:') ? 'project' : 'list'));
  if (f.kinds.size) bits.push([...f.kinds].map(k => ST_KIND_NAME[k] || k).join(', '));
  if (f.acts.size) bits.push([...f.acts].map(a => (HIST_ACT[a] || a).toLowerCase()).join(', '));
  return bits.join(' · ');
}
function renderStats() {
  if (!histOn()) { $('#main').innerHTML = topHtml('Statistics') + `<div class="body stpage">${stOffHtml('Statistics')}</div>`; return; }
  const f = stFilter(), r = stCompute(f), st = S.settings.stats, has = Object.keys(S.activity.days).length > 0;
  const kindsPresent = ST_KINDS.filter(([k]) => Object.keys(S.activity.days).some(d => Object.keys(S.activity.days[d]).some(key => key.startsWith(k + '.')))), kinds = kindsPresent.length ? kindsPresent : ST_KINDS.slice(0, 4);
  const chip = (act, attr, on, label) => `<button class="tfc${on ? ' on' : ''}" data-act="${act}" ${attr} aria-pressed="${on}">${esc(label)}</button>`;
  const names = { ...Object.fromEntries(ST_KINDS), ...HIST_ACT };
  const wdn = stWdNames(), tr = stTrend(f, r);
  const body = [
    stPanel('cards', 'Key numbers', `<div class="stcards">${stCards(f, r).map(([l, v]) => `<div class="stc"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>`, f),
    stPanel('heat', 'Activity heatmap', stHeatHtml(f, r), f),
    stPanel('trend', 'Over time' + `<small> · by ${tr.step}</small>`, stCols(tr.bars.map(b => b.n), tr.bars.map((b, i) => (tr.bars.length <= 14 || i % Math.ceil(tr.bars.length / 8) === 0 ? b.label : '')), tr.bars.map(b => b.title)), f),
    stPanel('kinds', 'By type', stBars(stBarRows(r.kinds, ST_KIND_NAME, ST_KINDS.map(x => x[0])), names), f),
    stPanel('acts', 'By action', stBars(stBarRows(r.acts, HIST_ACT, ST_ACTS), names), f),
    stPanel('week', 'By weekday', stCols(wdn.map(d => r.wd[d]), wdn.map(d => DAYS[d].slice(0, 1)), wdn.map(d => FULLDAYS[d] + ': ' + stNum(r.wd[d]))), f),
    stPanel('hour', 'By time of day', stCols(r.hr, r.hr.map((_, h) => (h % 6 === 0 ? String(h) : '')), r.hr.map((n, h) => fmtHour(h) + ': ' + stNum(n))), f),
    stPanel('lists', 'By list', stBars(stListRows(r, true), {}), f),
  ].join('');
  $('#main').innerHTML = topHtml('Statistics', `<button class="btn" data-act="stshare" title="Make an image to share">${ic('upload', 15)} Share</button>`)
    + `<div class="stfilters"><div class="strow"><select data-stf="range" aria-label="Period">${opts(ST_RANGES, st.range)}</select>${st.range === 'custom' ? `<input type="date" data-stf="from" value="${esc(f.from)}" aria-label="From"><input type="date" data-stf="to" value="${esc(f.to)}" aria-label="To">` : ''}<select data-stf="scope" aria-label="Project or list">${stScopeOptions(f.scope)}</select>${f.scope && !f.scope.startsWith('p:') && S.lists.some(l => l.parent === f.scope.slice(2)) || (f.scope.startsWith('p:')) ? `<label class="chkl"><input type="checkbox" data-stf="sub"${f.sub ? ' checked' : ''}> Include sublists</label>` : ''}</div>`
    + `<div class="hchips"><span class="stlab">Type</span>${kinds.map(([k, n]) => chip('stkind', `data-k="${k}"`, f.kinds.has(k), n)).join('')}</div>`
    + `<div class="hchips"><span class="stlab">Action</span>${ST_ACTS.map(a => chip('stact', `data-a="${a}"`, f.acts.has(a), HIST_ACT[a])).join('')}</div>`
    + `<div class="hchips"><span class="stlab">Show</span>${ST_PANELS.map(([k, n]) => chip('stpanel', `data-p="${k}"`, !f.hide.has(k), n)).join('')}${f.kinds.size || f.acts.size || f.scope ? '<button class="btn sm" data-act="stclear">Clear filters</button>' : ''}</div></div>`
    + `<div class="body stpage">${has ? '' : `<p class="hint pad">Nothing counted yet. Add, edit and finish things and they will appear here.</p>`}${body}<p class="hint pad">Counted on this device since ${S.activity.on ? esc(new Date(S.activity.on).toLocaleDateString()) : 'you turned history on'}${S.activity.filled ? ', starting from when your existing tasks, notes and habit check-ins were made' : ''}. Quick edits to one item are counted once. Nothing is counted while history is off. <button class="lnk" data-act="strst">Reset statistics</button></p></div>`;
}
const stSet = (k, v) => { S.settings.stats[k] = v; save(); renderMain(); };
const stToggle = (k, v) => { const a = new Set(S.settings.stats[k] || []); if (a.has(v)) a.delete(v); else a.add(v); stSet(k, [...a]); };
const ST_ACT = {
  stkind: el => stToggle('kinds', el.dataset.k), stact: el => stToggle('acts', el.dataset.a), stpanel: el => stToggle('hide', el.dataset.p),
  stclear: () => { Object.assign(S.settings.stats, { kinds: [], acts: [], scope: '' }); save(); renderMain(); },
  strst: async () => { if (await askConfirm('Reset Statistics? The counts kept on this device are removed. Your tasks, notes and the History list are not touched.', 'Reset')) { S.activity = actNew(); S.activity.on = Date.now(); S.activity.filled = Date.now(); save(); renderMain(); toast('Statistics reset'); } },
  histon: () => { prefSet('history.on', true); },
  stshare: () => stShareOpen(),
};
function stChange(el) {
  const k = el.dataset.stf, st = S.settings.stats;
  if (k === 'sub') st.sub = el.checked; else if (k === 'from' || k === 'to') { if (!ST_DATE.test(el.value)) return; st[k] = el.value; } else st[k] = el.value;
  if (k === 'range' && el.value === 'custom') { const f = stFilter(); st.from = st.from || f.from; st.to = st.to || f.to; }
  save(); renderMain();
}
// turning History on or off (Settings → Data & sync): on starts the tally from what is already stored
function histToggled() {
  if (histOn()) { S.activity.on = Date.now(); const n = actBackfill(); save(); toast(n ? `History is on. Statistics start with the ${stNum(n)} things already in OpenTick.` : 'History is on.'); }
  else { save(); toast('History is off. Nothing new is recorded; what was recorded stays until you clear it.'); }
  if (U.page === 'stats' || U.page === 'history') renderMain();
  const d = typeof $ === 'function' ? $('#histset') : null; if (d) d.innerHTML = historySettingsInner();
}
function historySettingsInner() {
  const days = Object.keys(S.activity.days).length;
  return `<label class="a11y-r tg"><span><b>Keep a history of changes</b><small>Lists what you add, edit, finish and delete on the History page, and counts it for Statistics. Off by default. It stays on this device: it is not synced, and it is encrypted along with the rest when you use encryption.</small></span><input type="checkbox" data-pf="history.on"${histOn() ? ' checked' : ''}></label>
<p class="hint">${histOn() ? 'On' : 'Off'} · ${stNum(S.history.length)} ${S.history.length === 1 ? 'entry' : 'entries'} in the history · ${stNum(days)} ${days === 1 ? 'day' : 'days'} of statistics</p>
<div class="dgrid"><button data-m="statsopen">${ic('activity', 18)}<span><b>Open Statistics</b><small>Heatmap, charts and filters</small></span></button><button class="dz" data-m="histwipe">${ic('trash', 18)}<span><b>Delete history and statistics…</b><small>Only these two · your tasks and notes stay</small></span></button></div>`;
}
const historySettingsHtml = () => `<h4 class="mh">History &amp; statistics</h4><div id="histset">${historySettingsInner()}</div>`;
function statsSettingsAct(a) {
  if (a === 'statsopen') { closeModal(); U.page = 'stats'; U.sel = null; render(); return true; }
  if (a === 'histwipe') {
    askConfirm('Delete the history list and the Statistics counts from this device? Your tasks, notes and everything else stay.', 'Delete').then(ok => {
      if (ok) { S.history = []; S.activity = actNew(); S.activity.on = histOn() ? Date.now() : 0; S.activity.filled = Date.now(); save(); toast('History and statistics deleted'); }
      openSettings('data');
    });
    return true;
  }
  return false;
}

/* ---------- sharing as an image ---------- */
function stColors() {
  const c = { bg: '#282828', card: '#32302f', text: '#ebdbb2', muted: '#a89984', line: '#3c3836', acc: '#fabd2f', onacc: '#282828' };
  try { const cs = getComputedStyle(document.documentElement); for (const [k, v] of Object.entries({ bg: '--bg', card: '--card', text: '--text', muted: '--muted', line: '--line', acc: '--acc', onacc: '--on-acc' })) { const x = (cs.getPropertyValue(v) || '').trim(); if (x) c[k] = x; } } catch (e) { /* the defaults are a theme of their own */ }
  return c;
}
// the picture as one self-contained SVG (no scripts, fonts or links), drawn from the same numbers as the page
function stSvg(f, r, o = {}) {
  const C = o.colors || stColors(), W = 960, P = 36, IW = W - 2 * P, names = !!o.names, out = [];
  let y = P;
  const t = (x, yy, s, a = {}) => out.push(`<text x="${x}" y="${yy}" font-size="${a.size || 14}" font-weight="${a.weight || 400}" fill="${a.fill || C.text}" text-anchor="${a.anchor || 'start'}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif">${esc(s)}</text>`);
  const rect = (x, yy, w, h, fill, rx = 0, op = 1) => out.push(`<rect x="${x}" y="${yy}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${op < 1 ? ` fill-opacity="${op}"` : ''}/>`);
  const head = (s) => { t(P, y + 14, s, { size: 15, weight: 700 }); y += 28; };
  const bars = (rows, x, w, label) => { const mx = Math.max(1, ...rows.map(q => q[1])); rows.slice(0, 8).forEach(([l, n], i) => { const yy = y + i * 24; t(x, yy + 14, l.length > 22 ? l.slice(0, 21) + '…' : l, { size: 12, fill: C.muted }); const bw = Math.max(3, Math.round((w - 200) * n / mx)); rect(x + 150, yy + 2, bw, 14, C.acc, 4); t(x + 156 + bw, yy + 14, stNum(n), { size: 12, weight: 700 }); }); y += Math.max(1, Math.min(8, rows.length)) * 24 + 10; };
  const cols = (vals, labels, x, w, h) => { const mx = Math.max(1, ...vals), g = 3, bw = Math.max(2, (w - g * (vals.length - 1)) / vals.length); vals.forEach((v, i) => { const bh = v ? Math.max(3, Math.round(h * v / mx)) : 0; rect(x + i * (bw + g), y + h - bh, bw, bh, C.acc, Math.min(3, bw / 2)); if (labels[i]) t(x + i * (bw + g) + bw / 2, y + h + 14, labels[i], { size: 10, fill: C.muted, anchor: 'middle' }); }); };
  t(P, y + 22, 'My OpenTick statistics', { size: 26, weight: 800 }); y += 34;
  t(P, y + 14, stFilterSummary(f, names).slice(0, 120), { size: 13, fill: C.muted }); y += 34;
  if (!f.hide.has('cards')) {
    const cards = stCards(f, r), cw = (IW - 36) / 4;
    cards.forEach(([l, v], i) => { const cx = P + (i % 4) * (cw + 12), cy = y + Math.floor(i / 4) * 80; rect(cx, cy, cw, 68, C.card, 12); t(cx + 14, cy + 32, v.length > 16 ? v.slice(0, 15) + '…' : v, { size: v.length > 12 ? 17 : 24, weight: 800, fill: C.acc }); t(cx + 14, cy + 54, l, { size: 12, fill: C.muted }); });
    y += Math.ceil(cards.length / 4) * 80 + 14;
  }
  if (!f.hide.has('heat')) {
    const h = stHeat(f, r), cell = Math.min(15, Math.floor((IW - (h.cols - 1) * 3) / h.cols)), step = cell + 3;
    head('Activity'); const top = y + 14; h.months.forEach(m => t(P + m.c * step, y + 8, m.label, { size: 10, fill: C.muted }));
    h.cells.forEach((col, ci) => col.forEach((c, ri) => { if (c) rect(P + ci * step, top + ri * step, cell, cell, c.level ? C.acc : C.line, 3, c.level ? [0, 0.3, 0.52, 0.76, 1][c.level] : 0.55); }));
    y = top + 7 * step + 22;
  }
  if (!f.hide.has('trend')) { const tr = stTrend(f, r); head('Over time · by ' + tr.step); cols(tr.bars.map(b => b.n), tr.bars.map((b, i) => (tr.bars.length <= 12 || i % Math.ceil(tr.bars.length / 8) === 0 ? b.label : '')), P, IW, 90); y += 90 + 30; }
  const pair = [['kinds', 'By type', stBarRows(r.kinds, ST_KIND_NAME, ST_KINDS.map(x => x[0]))], ['acts', 'By action', stBarRows(r.acts, HIST_ACT, ST_ACTS)]].filter(p => !f.hide.has(p[0]));
  if (pair.length) { const y0 = y; let used = 0; pair.forEach(([, title, rows], i) => { y = y0; const x = P + i * (IW / pair.length); t(x, y + 14, title, { size: 15, weight: 700 }); y += 28; bars(rows, x, IW / pair.length - 20); used = Math.max(used, y - y0); }); y = y0 + used + 8; }
  if (!f.hide.has('lists') && Object.keys(r.lists).some(k => k)) { head(names ? 'By list' : 'By list (names hidden)'); bars(stListRows(r, names), P, IW); }
  const wk = !f.hide.has('week'), hr = !f.hide.has('hour');
  if (wk || hr) {
    const y0 = y, wdn = stWdNames();
    if (wk) { t(P, y + 14, 'By weekday', { size: 15, weight: 700 }); y += 28; cols(wdn.map(d => r.wd[d]), wdn.map(d => DAYS[d].slice(0, 1)), P, hr ? 300 : IW, 80); y = y0; }
    if (hr) { const x = wk ? P + 330 : P; t(x, y + 14, 'By time of day', { size: 15, weight: 700 }); y += 28; cols(r.hr, r.hr.map((_, h) => (h % 6 === 0 ? String(h) : '')), x, wk ? IW - 330 : IW, 80); }
    y = y0 + 28 + 80 + 30;
  }
  t(P, y + 10, 'Made with OpenTick', { size: 12, fill: C.muted }); t(W - P, y + 10, new Date().toLocaleDateString(), { size: 12, fill: C.muted, anchor: 'end' }); y += 10 + P;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="${W}" height="${y}" fill="${C.bg}"/>${out.join('')}</svg>`, w: W, h: y };
}
function stPng(pic, scale = 2) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { try { const c = document.createElement('canvas'); c.width = pic.w * scale; c.height = pic.h * scale; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob(b => (b ? res(b) : rej(new Error('The image could not be made'))), 'image/png'); } catch (e) { rej(e); } };
    img.onerror = () => rej(new Error('The image could not be drawn here'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pic.svg);
  });
}
function stShareOpen() {
  const f = stFilter(), r = stCompute(f), o = { names: false }, draw = () => stSvg(f, r, o);
  const paint = m => { const pic = draw(); m.querySelector('.stprev').innerHTML = pic.svg.replace(/ width="\d+" height="\d+"/, ' style="width:100%;height:auto"'); return pic; };
  openModal(`<h3>Share your statistics</h3><p class="hint">An image of what the page shows now, with your filters. It is made here on your device; nothing is uploaded.</p><div class="stprev" aria-label="Preview"></div><label class="chkl"><input type="checkbox" id="stnames"> Include list and project names</label><div class="mrow"><button class="btn pri" data-m="share">Share…</button><button class="btn" data-m="png">Save PNG</button><button class="btn" data-m="copy">Copy image</button><button class="btn" data-m="svg">Save SVG</button><button class="btn" data-m="ok">Close</button></div>`, m => {
    paint(m);
    m.onchange = e => { if (e.target.id === 'stnames') { o.names = e.target.checked; paint(m); } };
    m.onclick = async e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      const a = b.dataset.m, pic = draw(), stamp = ymd(new Date());
      try {
        if (a === 'ok') closeModal();
        else if (a === 'svg') { if (await saveBlob(`opentick-statistics-${stamp}.svg`, new Blob([pic.svg], { type: 'image/svg+xml' }))) toast('Image saved'); }
        else {
          const png = await stPng(pic), file = new File([png], `opentick-statistics-${stamp}.png`, { type: 'image/png' });
          if (a === 'png') { if (await saveBlob(file.name, png)) toast('Image saved'); }
          else if (a === 'copy') { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); toast('Image copied'); } else toast('This device cannot copy images — use Save PNG'); }
          else if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'My OpenTick statistics' }); } catch (err) { if (err && err.name !== 'AbortError') throw err; } }
          else if (await saveBlob(file.name, png)) toast('Image saved — attach it where you want to share it');
        }
      } catch (err) { toast('Could not make the image: ' + (err.message || err)); }
    };
  }, 'stshare');
}
