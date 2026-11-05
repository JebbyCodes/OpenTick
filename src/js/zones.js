/* OpenTick time zones: plan across zones.
   • Helpers (tz…) turn a moment into the wall-clock time of any IANA zone and back, with the browser's own Intl data, so daylight-saving
     changes are right on every platform and nothing is bundled.
   • S.zones is a synced collection of saved zones: { id, name, tz (IANA name), projectId, listId, tags, u }. Like every collection it is merged
     by newest edit, deleted with tombstones and encrypted with the rest of the data when encryption is on.
   • The Time zones page lays out one day as a row of hours per zone, shades working hours (Settings per device: S.settings.tz), marks the hours
     when everyone is in working hours, and turns the chosen moment into a task or a countdown. A task made there keeps the zone it was planned
     in (task.tz), so it shows "9:00 AM New York" next to your own time.
   • The timetable can show a second zone beside its hours (S.settings.tt.tz2).
   Nothing here needs the network. The normaliser is a function declaration on purpose: migrate() calls it while the first file is still loading. */
function tzNormalise(z) {
  z.name = String(z.name || '').slice(0, 60); z.tz = String(z.tz || 'UTC');
  if (!Array.isArray(z.tags)) z.tags = [];
  z.tags = z.tags.map(g => String(g).toLowerCase()).filter(Boolean);
  return z;
}

/* ---------- the clock arithmetic ---------- */
const TZ_DTF = new Map();
const TZ_FALLBACK = ['UTC', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Sao_Paulo', 'Atlantic/Reykjavik', 'Europe/London', 'Europe/Paris', 'Europe/Athens', 'Africa/Cairo', 'Africa/Johannesburg', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
const tzLocal = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
function tzValid(z) { if (!z || typeof z !== 'string') return false; try { new Intl.DateTimeFormat('en-US', { timeZone: z }); return true; } catch (e) { return false; } }
function tzDtf(tz) {
  let f = TZ_DTF.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); TZ_DTF.set(tz, f); }
  return f;
}
// the wall clock of a zone at a moment: { y, m, d, h, mi, s }
function tzParts(ms, tz) {
  const o = {}; for (const p of tzDtf(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second };
}
// minutes the zone is ahead of UTC at that moment (negative when behind)
function tzOffset(ms, tz) { const p = tzParts(ms, tz); return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000); }
// the moment a wall-clock date and time happens in a zone. A time that does not exist (the hour skipped when clocks go forward) lands just after the gap.
function tzToUtc(date, time, tz) {
  const [y, m, d] = String(date).split('-').map(Number), [h, mi] = String(time || '0:0').split(':').map(Number), wall = Date.UTC(y, m - 1, d, h || 0, mi || 0);
  // the offsets in force a day before and after, then whichever reading really is that wall-clock time
  const a = tzOffset(wall - 864e5, tz), c = tzOffset(wall + 864e5, tz), t1 = wall - a * 60000, t2 = wall - c * 60000;
  const ok1 = tzOffset(t1, tz) === a, ok2 = tzOffset(t2, tz) === c;
  if (ok1 && ok2) return Math.min(t1, t2); // clocks went back: the time happens twice, the first one is taken
  if (ok1) return t1; if (ok2) return t2;
  return t1; // clocks went forward and this time does not exist: it lands just after the gap
}
const tzDate = (ms, tz) => { const p = tzParts(ms, tz); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
const tzHM = (ms, tz) => { const p = tzParts(ms, tz); return `${pad(p.h)}:${pad(p.mi)}`; };
function tzAbbr(ms, tz) { try { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName'); return p ? p.value : tz; } catch (e) { return tz; } }
function tzOffLabel(ms, tz) { const o = tzOffset(ms, tz), a = Math.abs(o); return 'UTC' + (o === 0 ? '' : (o < 0 ? '−' : '+') + Math.floor(a / 60) + (a % 60 ? ':' + pad(a % 60) : '')); }
const tzCity = tz => String(tz || '').split('/').pop().replace(/_/g, ' ');
const tzLabel = z => (z && z.name && z.name.trim()) || tzCity(z && z.tz);
const tzAll = () => { let l = []; try { if (Intl.supportedValuesOf) l = Intl.supportedValuesOf('timeZone'); } catch (e) { l = []; } if (!l.length) l = TZ_FALLBACK; return l.includes('UTC') ? l : ['UTC', ...l]; };
const tzOptions = (cur, now = Date.now()) => tzAll().map(z => [z, `${z.replace(/_/g, ' ')} (${tzOffLabel(now, z)})`]).concat(cur && !tzAll().includes(cur) && tzValid(cur) ? [[cur, cur]] : []);
// a moment shown as a time of day in a zone, in the 12 / 24-hour style of Settings → Clock
const tzFmt = (ms, tz) => fmtTime(tzHM(ms, tz));
// "Wed 4 Nov, 9:00 AM" in a zone
function tzFull(ms, tz) { const p = tzParts(ms, tz), d = new Date(Date.UTC(p.y, p.m - 1, p.d)); return `${DAYS[d.getUTCDay()]} ${p.d} ${MONTHS[p.m - 1].slice(0, 3)}, ${fmtMin(p.h * 60 + p.mi)}`; }
// the zone a record names: '' / 'local' / an unknown name all mean this device's own zone
const tzOf = id => (!id || id === 'local' || !tzValid(id) ? tzLocal() : id);

/* ---------- tasks planned in a zone ----------
   A task with a zone (task.tz) and a time keeps an anchor: zd + zt, its date and time on THAT zone's clock. The anchor is what the task
   means ("9:00 in New York"); due and time stay the familiar local date and time, worked out from it, so the calendar, timetable, reminders,
   widgets and sorting need no changes. Travelling changes your local clock, so due / time are worked out again (tzReflow).
   Because each device works them out for itself, due / time of an anchored task are left out of the change check (hashOf in core.js): two
   devices in different zones never fight over them in sync. Editing the date or time yourself moves the anchor to the new moment. */
const tzAnchored = t => !!(t.tz && t.zd && t.zt && tzValid(t.tz));
function tzLocalOf(t) { const ms = tzToUtc(t.zd, t.zt, t.tz), z = tzLocal(); return { d: tzDate(ms, z), t: tzHM(ms, z), ms }; }
// worked out again for this device's clock; returns how many tasks moved
function tzReflow() {
  let n = 0; const z = tzLocal();
  for (const t of S.tasks) {
    if (!tzAnchored(t)) continue;
    const L = tzLocalOf(t); if (t.due !== L.d || t.time !== L.t) { t.due = L.d; t.time = L.t; n++; }
  }
  S.settings.tzSeen = z; return n;
}
// called for every task before changes are detected: gives a new zoned task its anchor, and moves the anchor when due / time were edited
function tzTaskSync(t) {
  if (!t.tz || !tzValid(t.tz) || !t.due || !t.time || t.deleted) { if (t.zd || t.zt) { delete t.zd; delete t.zt; } return; }
  if (!S.settings.tzSeen) S.settings.tzSeen = tzLocal(); // the zone this device's local times were last worked out for
  if (S.settings.tzSeen && S.settings.tzSeen !== tzLocal()) tzReflow(); // the device moved to another zone: re-derive before reading edits
  if (tzAnchored(t)) {
    const L = tzLocalOf(t); if (t.due === L.d && t.time === L.t) return; // nothing was edited
    // a repeating task that only moved to its next date keeps the zone's own time (9:00 stays 9:00 there across daylight-saving changes)
    if (t.repeat && t.time === L.t) {
      const nd = tzDate(tzToUtc(t.due, t.time, tzLocal()), t.tz), ms = tzToUtc(nd, t.zt, t.tz);
      t.zd = nd; t.due = tzDate(ms, tzLocal()); t.time = tzHM(ms, tzLocal()); return;
    }
  }
  const ms = tzToUtc(t.due, t.time, tzLocal()); t.zd = tzDate(ms, t.tz); t.zt = tzHM(ms, t.tz);
}
// a zone change noticed while the app is running (a flight, a changed system setting)
function tzWatch() {
  if (typeof S === 'undefined' || !S.settings) return;
  const z = tzLocal(); if (!S.settings.tzSeen) { S.settings.tzSeen = z; return; }
  if (S.settings.tzSeen === z) return;
  const n = tzReflow(); save();
  if (n) { toast(`Your time zone is now ${tzCity(z)}: ${n} task time${n === 1 ? ' was' : 's were'} moved to match`); if (typeof refresh === 'function') refresh(); }
}
// the zone picker behind "Another zone…" in the task panel
async function tzPickTask(t) {
  const v = await formDialog({ title: 'Planned in…', ok: 'Use this zone', fields: [{ k: 'tz', label: 'Time zone', type: 'select', v: t.tz || tzLocal(), opts: tzOptions(t.tz) }], check: x => (tzValid(x.tz) ? '' : 'Choose a time zone') });
  return v ? v.tz : null;
}
// the "Planned in" choices for the task panel
const tzTaskOptions = t => [['', 'My own time zone'], ...S.zones.filter(z => tzValid(z.tz)).map(z => [z.tz, `${tzLabel(z)} (${tzCity(z.tz)})`]), ...(t.tz && !S.zones.some(z => z.tz === t.tz) ? [[t.tz, tzCity(t.tz)]] : []), ['__more', 'Another zone…']];
if (typeof setInterval === 'function' && typeof document !== 'undefined') { const h = setInterval(() => { try { if (!document.hidden) tzWatch(); } catch (e) { /* later */ } }, 30000); if (h && h.unref) h.unref(); }

/* ---------- saved zones ---------- */
const tzById = id => S.zones.find(z => z.id === id);
function tzNewZone(o = {}) { return tzNormalise({ id: uid(), name: '', tz: tzLocal(), projectId: '', listId: '', tags: [], created: Date.now(), ...o }); }
// scopes ('list:ID', 'project:ID', 'tag:name'; '' = everything) shared by zones, countdowns and boards
function scopeOptions(allLabel = 'Everything') {
  return [['', allLabel], ...listTree().map(({ l, depth }) => ['list:' + l.id, 'List · ' + ' '.repeat(depth) + l.name]), ...S.projects.map(p => ['project:' + p.id, 'Project · ' + p.name]), ...allTags().map(g => ['tag:' + g, 'Tag · #' + g])];
}
// does a record that may carry listId / projectId / tags belong to a scope?
function scopeHas(scope, o) {
  if (!scope) return true;
  if (scope.startsWith('list:')) return !!o.listId && listIds(scope.slice(5)).includes(o.listId);
  if (scope.startsWith('project:')) { const p = projectOf(scope.slice(8)); return !!p && (o.projectId === p.id || (!!o.listId && projectListIds(p).includes(o.listId))); }
  if (scope.startsWith('tag:')) return (o.tags || []).includes(scope.slice(4));
  return true;
}
const tzScopeValid = sc => !sc || sc === '' || scopeOptions().some(o => o[0] === sc);
// the rows of the planner: this device first, then the saved zones from the furthest behind to the furthest ahead
function tzRows(now = Date.now(), scope = '') {
  const loc = tzLocal(), rows = [{ id: 'local', name: 'Local', tz: loc, local: true }];
  const zs = S.zones.filter(z => tzValid(z.tz) && scopeHas(scope, z)).map(z => ({ id: z.id, name: tzLabel(z), tz: z.tz, z })).sort((a, b) => tzOffset(now, a.tz) - tzOffset(now, b.tz) || a.name.localeCompare(b.name));
  return rows.concat(zs);
}
// the planner's state (this window only): the day, the time on the reference zone's clock, and which row is the reference
function tzState() {
  const z = U.tz || (U.tz = {});
  if (!z.day) { const n = new Date(Date.now() + 36e5 - (Date.now() % 36e5)); z.day = ymd(n); z.time = pad(n.getHours()) + ':00'; }
  if (!z.ref) z.ref = 'local';
  return z;
}
const tzCfg = () => { const c = S.settings.tz || {}, a = Number.isFinite(+c.start) ? +c.start : 8, b = Number.isFinite(+c.end) ? +c.end : 18; return { start: Math.max(0, Math.min(23, a)), end: Math.max(1, Math.min(24, b)) }; };
// 'w' working hours, 'n' night, 'e' early / late
function tzClass(mins, cfg = tzCfg()) { const h = mins / 60; return h >= cfg.start && h < cfg.end ? 'w' : (h >= 22 || h < 6) ? 'n' : 'e'; }
// the planner worked out for a state: rows with their 24 cells, the chosen moment, and the hours when everyone is in working hours
function tzPlan(st = tzState(), scope = '', now = Date.now()) {
  const rows = tzRows(now, scope), ref = rows.find(r => r.id === st.ref) || rows[0], cfg = tzCfg();
  const at = tzToUtc(st.day, st.time, ref.tz), cells = Array.from({ length: 24 }, (_, i) => tzToUtc(st.day, pad(i) + ':00', ref.tz));
  const grid = rows.map(r => ({ row: r, cells: cells.map(ms => { const p = tzParts(ms, r.tz), m = p.h * 60 + p.mi; return { ms, h: p.h, mi: p.mi, cls: tzClass(m, cfg), newDay: p.h === 0 && p.mi === 0, date: `${p.y}-${pad(p.m)}-${pad(p.d)}` }; }) }));
  const shared = cells.map((_, i) => grid.every(g => g.cells[i].cls === 'w'));
  // contiguous runs of shared hours, as [from, to) hours on the reference clock
  const runs = []; let a = -1;
  shared.forEach((on, i) => { if (on && a < 0) a = i; if ((!on || i === 23) && a >= 0) { runs.push([a, on && i === 23 ? 24 : i]); a = -1; } });
  return { rows, ref, at, cells, grid, shared, runs, cfg };
}
const tzRunText = (r, tz) => `${fmtMin(r[0] * 60)}–${fmtMin(r[1] * 60)}`;
// the planner as plain text (to copy into a message)
function tzSummary(plan) {
  const lines = plan.rows.map(r => `${r.name}: ${tzFull(plan.at, r.tz)} (${tzAbbr(plan.at, r.tz)})`);
  return lines.join('\n');
}

/* ---------- the page ---------- */
function tzScopeSel() { const sc = (U.tzScope = tzScopeValid(U.tzScope) ? U.tzScope || '' : ''); return sc; }
function renderZones() {
  const st = tzState(), scope = tzScopeSel(), plan = tzPlan(st, scope), ref = plan.ref, at = plan.at, cfg = plan.cfg, selH = +st.time.slice(0, 2);
  const tools = `<button class="ib" data-act="tzday" data-d="-1" title="Previous day" aria-label="Previous day">${ic('left')}</button><input type="date" class="tzdate" data-tzd value="${esc(st.day)}" aria-label="Day" title="Day (on the ${esc(ref.name)} clock)"><button class="ib" data-act="tzday" data-d="1" title="Next day" aria-label="Next day">${ic('right')}</button><button class="btn" data-act="tznow" title="Back to the next full hour">Now</button>`
    + `<select data-tzf title="Show zones for" aria-label="Show zones for">${opts(scopeOptions('All zones'), scope)}</select><button class="btn pri" data-act="tzadd">${ic('plus', 16)}<span class="hide-m"> Add zone</span></button>`;
  const hdr = `<div class="tzh tzcorner">${esc(ref.name)} clock</div>` + plan.cells.map((ms, i) => `<div class="tzh${plan.shared[i] ? ' ok' : ''}${i === selH ? ' sel' : ''}" title="${plan.shared[i] ? 'Everyone is in working hours' : ''}">${plan.shared[i] ? ic('check', 11) : ''}<span>${i === 0 ? '0' : i}</span></div>`).join('');
  const rowsHtml = plan.grid.map(g => {
    const r = g.row, isRef = r.id === ref.id, selCell = g.cells[selH] || g.cells[0], nowAt = tzParts(at, r.tz), dd = dayDiff(tzDate(at, r.tz), st.day);
    const lab = `<div class="tzl${isRef ? ' ref' : ''}"><div class="tzn"><b>${esc(r.name)}</b><small>${esc(tzCity(r.tz))} · ${esc(tzAbbr(at, r.tz))} · ${esc(tzOffLabel(at, r.tz))}</small></div><div class="tzt"><b>${esc(fmtMin(nowAt.h * 60 + nowAt.mi))}</b>${dd ? `<em>${dd > 0 ? '+' : '−'}${Math.abs(dd)} day${Math.abs(dd) === 1 ? '' : 's'}</em>` : ''}</div>`
      + `<button class="ib sm tzrefb${isRef ? ' on' : ''}" data-act="tzref" data-id="${esc(r.id)}" title="${isRef ? 'The hours above are on this clock' : 'Plan from this zone: put its clock on top'}" aria-label="Plan from ${esc(r.name)}" aria-pressed="${isRef}">${ic('clock', 14)}</button>${r.z ? `<button class="ib sm" data-act="tzedit" data-id="${esc(r.id)}" title="Edit" aria-label="Edit ${esc(r.name)}">${ic('more', 14)}</button>` : '<span class="tzsp"></span>'}</div>`;
    const cells = g.cells.map((c, i) => `<button class="tzc ${c.cls}${i === selH ? ' sel' : ''}${c.newDay ? ' nd' : ''}${plan.shared[i] ? ' all' : ''}" data-act="tzpick" data-h="${i}" aria-label="${esc(r.name)} ${esc(fmtMin(c.h * 60 + c.mi))}${c.newDay ? ', new day' : ''}" aria-pressed="${i === selH}">${c.newDay ? `<small>${DAYS[pYmd(c.date).getDay()]}</small>` : ''}<span>${c.mi ? fmtMin(c.h * 60 + c.mi, { noAp: true }) : clock24() ? pad(c.h) : (c.h % 12 || 12) + (c.h === 0 || c.h === 12 ? (c.h === 0 ? 'a' : 'p') : '')}</span></button>`).join('');
    return lab + cells;
  }).join('');
  const best = plan.runs.length ? `<p class="tzbest ok">${ic('check-circle', 15)} Everyone is in working hours: <b>${plan.runs.map(r => tzRunText(r)).join(', ')}</b> on the ${esc(ref.name)} clock.</p>` : plan.rows.length > 1 ? `<p class="tzbest">${ic('alert', 15)} No hour on this day is inside everyone's working hours (${esc(fmtMin(cfg.start * 60))}–${esc(fmtMin(cfg.end * 60))}).</p>` : `<p class="tzbest">${ic('globe', 15)} Add a zone to compare it with your own time.</p>`;
  const sel = plan.rows.map(r => `<li><b>${esc(r.name)}</b> ${esc(tzFull(at, r.tz))} <small>${esc(tzAbbr(at, r.tz))}</small></li>`).join('');
  $('#main').innerHTML = topHtml('Time zones', tools)
    + `<div class="body tzbody"><div class="tzbar"><label class="tzt2">Selected time on the <b>${esc(ref.name)}</b> clock <input type="time" data-tzt value="${esc(st.time)}" aria-label="Time"></label><label class="tzt2">Working hours <select data-tzw="start" aria-label="Working hours start">${opts(Array.from({ length: 24 }, (_, h) => [h, fmtMin(h * 60)]), cfg.start)}</select> to <select data-tzw="end" aria-label="Working hours end">${opts(Array.from({ length: 24 }, (_, h) => [h + 1, fmtMin((h + 1) * 60)]), cfg.end)}</select></label></div>`
    + `<div class="tzgrid" role="group" aria-label="Hours of the day in each zone" style="--tzn:${plan.rows.length}">${hdr}${rowsHtml}</div>${best}`
    + `<div class="tzsel"><h3 class="hh">${ic('clock', 16)} ${esc(tzFull(at, ref.tz))} <small>${esc(ref.name)}</small></h3><ul class="tzlist">${sel}</ul><div class="tzact"><button class="btn pri" data-act="tztask">${ic('plus', 15)} Make a task</button><button class="btn" data-act="tzcd">${ic('hourglass', 15)} Make a countdown</button><button class="btn" data-act="tzcopy">${ic('copy', 15)} Copy</button></div></div>`
    + `${S.zones.length ? '' : `<div class="empty sm">${ic('globe', 34)}<p>Add the places you work with. Each one gets a row, and the hours when everyone is awake light up.</p><button class="btn pri" data-act="tzadd">${ic('plus', 15)} Add a zone</button></div>`}</div>`;
}

/* ---------- dialogs and actions ---------- */
async function tzZoneForm(z) {
  const isNew = !z, d = z || tzNewZone();
  const v = await formDialog({ title: isNew ? 'Add a time zone' : 'Edit time zone', ok: isNew ? 'Add' : 'Save', del: !isNew, fields: [
    { k: 'name', label: 'Name', type: 'text', v: d.name, ph: 'e.g. New York office, Mum' },
    { k: 'tz', label: 'Time zone', type: 'select', v: d.tz, opts: tzOptions(d.tz) },
    { k: 'projectId', label: 'Project (optional)', type: 'select', v: d.projectId || '', opts: [['', 'None'], ...S.projects.map(p => [p.id, p.name])] },
    { k: 'listId', label: 'List (optional)', type: 'select', v: d.listId || '', opts: [['', 'None'], ...listTree().map(({ l, depth }) => [l.id, ' '.repeat(depth) + l.name])] },
    { k: 'tags', label: 'Tags (optional)', type: 'text', v: (d.tags || []).join(' '), ph: 'team travel' },
  ], check: x => (tzValid(x.tz) ? '' : 'Choose a time zone') });
  if (!v) return null;
  if (v._del) { S.zones = S.zones.filter(x => x !== z); save(); return 'deleted'; }
  const tags = [...new Set(String(v.tags).split(/[\s,]+/).map(g => g.replace(/^#/, '').toLowerCase()).filter(Boolean))];
  if (isNew) S.zones.push(tzNormalise({ ...d, name: v.name.trim(), tz: v.tz, projectId: v.projectId, listId: v.listId, tags }));
  else Object.assign(z, tzNormalise({ ...z, name: v.name.trim(), tz: v.tz, projectId: v.projectId, listId: v.listId, tags }));
  save(); return 'saved';
}
const TZ_ACT = {
  async tzadd() { if (await tzZoneForm(null)) { sfx('add'); renderMain(); } },
  async tzedit(el) { const z = tzById(el.dataset.id); if (!z) return; const r = await tzZoneForm(z); if (r) { if (U.tz && U.tz.ref === z.id && r === 'deleted') U.tz.ref = 'local'; renderMain(); } },
  tzref(el) { const st = tzState(), plan = tzPlan(st, tzScopeSel()), row = plan.rows.find(r => r.id === el.dataset.id); if (!row) return; // the same moment, now read on that zone's clock
    st.day = tzDate(plan.at, row.tz); st.time = tzHM(plan.at, row.tz); st.ref = row.id; renderMain(); },
  tzpick(el) { const st = tzState(); st.time = pad(+el.dataset.h) + ':00'; renderMain(); },
  tzday(el) { const st = tzState(); st.day = ymd(addDays(pYmd(st.day), +el.dataset.d)); renderMain(); },
  tznow() { U.tz = null; renderMain(); },
  tzcopy() { const t = tzSummary(tzPlan(tzState(), tzScopeSel())); if (typeof tplCopy === 'function') tplCopy(t); else toast(t); },
  async tztask() {
    const plan = tzPlan(tzState(), tzScopeSel()), loc = tzLocal(), d = tzDate(plan.at, loc), tm = tzHM(plan.at, loc), r = plan.ref;
    const v = await formDialog({ title: 'Make a task', ok: 'Add task', fields: [
      { k: 'title', label: 'Title', type: 'text', v: '', ph: 'e.g. Call with the New York team' },
      { k: 'hint', type: 'hint', label: `${fmtDate(d)} at ${fmtTime(tm)} your time${r.local ? '' : ` · ${tzFull(plan.at, r.tz)} in ${r.name}`}` },
      { k: 'dur', label: 'Length', type: 'select', v: 60, opts: [[0, 'No length'], [15, '15 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [90, '1 hour 30'], [120, '2 hours']] },
      { k: 'listId', label: 'List', type: 'select', v: 'inbox', opts: listOpts() },
      { k: 'tags', label: 'Tags', type: 'text', v: '', ph: 'meeting' },
    ], check: x => (x.title.trim() ? '' : 'Give the task a title') });
    if (!v) return;
    const t = newTask({ title: v.title.trim(), due: d, time: tm, ...(+v.dur ? { dur: +v.dur } : {}), listId: v.listId, tags: [...new Set(String(v.tags).split(/[\s,]+/).map(g => g.replace(/^#/, '').toLowerCase()).filter(Boolean))], ...(r.local ? {} : { tz: r.tz }) });
    prefNewTask(t, {}); S.tasks.push(t); save(); sfx('add'); toast(`Added “${t.title}” on ${fmtDate(d)} at ${fmtTime(tm)}`);
  },
  tzcd() { const plan = tzPlan(tzState(), tzScopeSel()), r = plan.ref; cdForm(null, { date: tzDate(plan.at, r.tz), time: tzHM(plan.at, r.tz), tz: r.local ? '' : r.tz, name: '' }).then(x => { if (x) { sfx('add'); toast('Countdown added'); } }); },
  // the timetable's second zone
  async tt2() {
    const cur = S.settings.tt.tz2 || '', items = [{ label: cur ? 'No second zone' : 'No second zone (now)' }, ...S.zones.filter(z => tzValid(z.tz)).map(z => ({ label: `${tzLabel(z)} · ${tzCity(z.tz)}${z.tz === cur ? ' ✓' : ''}` }))];
    if (!S.zones.length) { toast('Add a time zone on the Time zones page first'); return; }
    const i = await askMenu('Show a second time zone beside the hours', items); if (i == null) return;
    const zs = S.zones.filter(z => tzValid(z.tz)); S.settings.tt.tz2 = i === 0 ? '' : zs[i - 1].tz; save(); renderMain();
  },
};
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || U.page !== 'zones') return;
  if (el.dataset.tzd !== undefined) { if (/^\d{4}-\d\d-\d\d$/.test(el.value)) { tzState().day = el.value; renderMain(); } }
  else if (el.dataset.tzt !== undefined) { if (validHM(el.value)) { tzState().time = el.value.length === 4 ? '0' + el.value : el.value; renderMain(); } }
  else if (el.dataset.tzw) { const c = S.settings.tz = S.settings.tz || {}; c[el.dataset.tzw] = +el.value; if (+c.end <= +c.start) { if (el.dataset.tzw === 'start') c.end = Math.min(24, +c.start + 1); else c.start = Math.max(0, +c.end - 1); } save(); renderMain(); }
  else if (el.dataset.tzf !== undefined) { U.tzScope = el.value; renderMain(); }
});
