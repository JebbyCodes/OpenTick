/* OpenTick reminders: one place that works out WHEN things should notify.
   remEntries(from, to) lists every notification due between two moments: task reminders (several per task, each "N minutes before" or an
   exact date and time), lesson and timetable-slot reminders, and an optional morning digest. The in-app check (checkReminders) fires what is
   due now; the background service (bg.js) hands the same list for the next two weeks to the operating system, so nothing depends on the
   window being open. Keys keep their old format, so a reminder that already fired is never fired twice after an update. */

const REM_ABS = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/;
// every reminder of a task: numbers are "minutes before", strings ('YYYY-MM-DDTHH:MM') are exact moments. t.reminder stays the first relative one.
const remsOf = t => Array.isArray(t.rems) ? t.rems.filter(r => (typeof r === 'number' && r >= 0) || (typeof r === 'string' && REM_ABS.test(r))) : (t.reminder != null ? [t.reminder] : []);
function remsSet(t, list) {
  const seen = new Set(), out = [];
  for (const r of list) { if (!((typeof r === 'number' && r >= 0) || (typeof r === 'string' && REM_ABS.test(r))) || seen.has(r)) continue; seen.add(r); out.push(r); }
  out.sort((a, b) => (typeof a === typeof b ? (a < b ? -1 : a > b ? 1 : 0) : typeof a === 'number' ? -1 : 1));
  if (out.length) t.rems = out; else delete t.rems;
  const first = out.find(r => typeof r === 'number'); t.reminder = first == null ? null : first;
}
const remAbsText = r => { const [d, tm] = String(r).split('T'); return `${fmtDate(d)} ${fmtTime(tm)}`; };
const remItemLabel = r => typeof r === 'number' ? remLabel(r) : 'At ' + remAbsText(r);

/* quiet hours (this device): a reminder that falls inside is held back until they end */
const quietCfg = () => { const q = (S.settings && S.settings.quiet) || {}; return { on: !!q.on, from: validHM(q.from) ? q.from : '22:00', to: validHM(q.to) ? q.to : '07:00' }; };
function quietShift(ms) {
  const q = quietCfg(); if (!q.on) return ms;
  const d = new Date(ms), m = d.getHours() * 60 + d.getMinutes(), a = toMin(q.from), b = toMin(q.to); if (a === b) return ms;
  const inside = a < b ? (m >= a && m < b) : (m >= a || m < b); if (!inside) return ms;
  const e = new Date(ms); e.setHours(Math.floor(b / 60), b % 60, 0, 0);
  if (e.getTime() <= ms) e.setDate(e.getDate() + 1);
  return e.getTime();
}
const lessonRemMin = () => { const c = scCfg(); return c.remindV ? (c.remind == null || c.remind === '' ? null : +c.remind) : (c.remind ? +c.remind : null); }; // 0 used to mean "never"

function digestText(k) {
  const tasks = S.tasks.filter(t => !t.deleted && !t.log && t.status === 'open' && t.due && (k === todayStr() ? t.due <= k : t.due === k)).length;
  const ls = typeof scDayLessons === 'function' && typeof schoolOn === 'function' && schoolOn() ? scDayLessons(pYmd(k)) : [];
  const parts = [];
  parts.push(tasks ? plural(tasks, 'task') + ' to do' : 'No tasks due');
  if (ls.length) { const f = ls[0], s = scSubj(f.l.subjectId); parts.push(`${plural(ls.length, 'lesson')}, first ${fmtTime(f.p.start)}${s ? ' ' + s.name : ''}`); }
  return parts.join(' · ');
}

function remEntries(from, to) {
  const out = [], day0 = new Date(from); day0.setHours(0, 0, 0, 0);
  const days = Math.min(30, Math.max(1, Math.ceil((to - day0.getTime()) / 864e5) + 1)), lastKey = ymd(addDays(day0, days));
  const add = (key, at, exp, e) => { at = quietShift(at); if (at <= to && exp >= from) out.push({ key, at, exp: Math.max(exp, at), ...e }); };
  // tasks: the next due date, and (for a repeat) the ones after it that fall inside the window
  for (const t of S.tasks) {
    if (t.deleted || t.log || t.status !== 'open' || !t.due) continue;
    const rs = remsOf(t); if (!rs.length) continue;
    const dates = [t.due]; if (t.repeat) for (const d of repeatDates(t, t.due, lastKey)) dates.push(d);
    dates.forEach((d, i) => {
      const tm = tmEff(t, d) || '', base = new Date(`${d}T${tm || '09:00'}`).getTime(), body = 'Due ' + fmtDate(d) + (validHM(tm) ? ' ' + fmtTime(tm) : '');
      for (const r of rs) {
        if (typeof r === 'number') add(`${t.id}|${d}|${tm}|${r}`, base - r * 60000, base - r * 60000 + 864e5, { kind: 'task', id: t.id, title: t.title, body });
        else if (i === 0) { const at = new Date(r).getTime(); add(`${t.id}|abs|${r}`, at, at + 864e5, { kind: 'task', id: t.id, title: t.title, body }); }
      }
    });
  }
  // lessons
  const lr = lessonRemMin();
  if (lr != null && typeof scDayLessons === 'function') for (let i = 0; i <= days; i++) {
    const d = addDays(day0, i), k = ymd(d);
    for (const { p, l } of scDayLessons(d)) {
      const s = scSubj(l.subjectId), st = new Date(`${k}T${p.start}`).getTime(), en = new Date(`${k}T${p.end}`).getTime(), room = scRoom(l, s);
      add(`s|${l.id}|${k}|${p.start}|${lr}`, st - lr * 60000, en, { kind: 'lesson', id: l.id, title: (s ? s.name : 'Lesson') + (lr ? ' starts soon' : ' starts now'), body: `${fmtRange(p.start, p.end)}${room ? ' · ' + room : ''}${l.teacher || (s && s.teacher) ? ' · ' + (l.teacher || s.teacher) : ''}` });
    }
  }
  // timetable slots
  for (const sl of S.slots) {
    if (sl.remind == null) continue;
    for (let i = 0; i <= days; i++) {
      const d = addDays(day0, i), k = ymd(d); if (!sl.days.includes(d.getDay())) continue;
      const st = new Date(`${k}T${sl.start}`).getTime(), en = new Date(`${k}T${sl.end}`).getTime();
      add(`s|${sl.id}|${k}|${sl.start}|${sl.remind}`, st - sl.remind * 60000, en, { kind: 'slot', id: sl.id, title: sl.title, body: `${fmtRange(sl.start, sl.end)}${sl.loc ? ' · ' + sl.loc : ''}` });
    }
  }
  // morning digest
  const dg = (S.settings && S.settings.digest) || {};
  if (dg.on && validHM(dg.at)) for (let i = 0; i <= days; i++) {
    const k = ymd(addDays(day0, i)), at = new Date(`${k}T${dg.at}`).getTime();
    add(`d|${k}`, at, at + 6 * 36e5, { kind: 'digest', id: '', title: 'Your day', body: digestText(k) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/* the reminders editor inside the task panel: the list that is set, plus one control to add another */
function remListHtml(t) {
  const rs = remsOf(t);
  return `<div class="remlist" data-rl="task">${rs.map((r, i) => `<span class="remchip">${ic('bell', 12)} ${esc(remItemLabel(r))}<button type="button" data-act="remdel" data-i="${i}" aria-label="Remove reminder ${esc(remItemLabel(r))}">${ic('x', 11)}</button></span>`).join('')}${rs.length ? '' : '<span class="hint">No reminder</span>'}</div>
<div class="remadd" data-rl="add"><select class="rsel" aria-label="Add a reminder">${opts([['', '+ Add a reminder'], ...REM_PRESETS, ['custom', 'Custom amount…'], ['abs', 'At an exact date and time…']], '')}</select>
<div class="remc" hidden><input type="number" inputmode="decimal" class="rn" min="0" step="any" value="30" aria-label="How long before"><select class="ru" aria-label="Unit">${opts(REM_UNITS, 1)}</select><span class="hint">before</span><button type="button" class="btn sm" data-act="remcustom">Add</button></div>
<div class="rema" hidden><input type="date" class="rad" aria-label="Reminder date" value="${t.due || todayStr()}"><input type="time" class="rat" aria-label="Reminder time" value="${validHM(tmEff(t)) ? tmEff(t) : '09:00'}"><button type="button" class="btn sm" data-act="remabs">Add</button></div></div>`;
}

function checkReminders() {
  if (WIDGET) return;
  if (typeof document !== 'undefined' && document.hidden && typeof bgNative === 'function' && bgNative()) return; // the background service shows it while the page is hidden
  const now = Date.now(); let changed = false;
  for (const e of remEntries(now, now)) {
    if (S.fired[e.key] || now > e.exp) continue;
    S.fired[e.key] = now; changed = true; notify(e.title, e.body); sfx('chime');
  }
  // forget what fired long ago (the keys only exist to stop a reminder repeating)
  const old = now - 45 * 864e5, oldDay = ymd(addDays(new Date(), -2));
  for (const [k, v] of Object.entries(S.fired)) {
    if ((typeof v === 'number' && v > 1 && v < old) || (k.startsWith('s|') && k.split('|')[2] < oldDay) || (k.startsWith('d|') && k.slice(2) < oldDay) || (/^[^|]+\|\d{4}-\d\d-\d\d\|/.test(k) && k.split('|')[1] < ymd(new Date(old)))) { delete S.fired[k]; changed = true; }
  }
  if (changed) save();
}
// kept for older callers: lessons are part of checkReminders now
const schoolRemind = () => false;
