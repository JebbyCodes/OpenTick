/* OpenTick countdowns: count down to a date or an exact moment.
   S.countdowns is a synced collection (merged by newest edit, tombstoned on delete, encrypted with everything else):
     { id, name, date 'YYYY-MM-DD', time 'HH:MM' | '', tz '' | IANA zone, icon, color, note, listId, projectId, tags, taskId,
       repeat '' | 'year', remind [minutes before], archived, created, u }
   • tz '' is a floating time: 9:00 means 9:00 wherever you are. A zone makes it one real moment ("9:00 in New York"), shown beside your own time.
   • A date with no time counts whole days (to the start of that day); with a time it counts down to the second.
   • A yearly countdown rolls to its next anniversary by itself (birthdays, holidays).
   • Lists, projects and tags work like they do on tasks: filter by them, and a list / project / tag page shows its own countdowns in a strip.
   • A reminder before the moment is a normal reminder (remEntries), so desktop, phone and the Android background service all fire it.
   The normaliser is a function declaration on purpose: migrate() calls it while core.js is still loading. */
function cdNormalise(c) {
  c.name = String(c.name || '').slice(0, 120);
  c.date = /^\d{4}-\d\d-\d\d$/.test(c.date || '') ? c.date : new Date().toISOString().slice(0, 10);
  c.time = /^([01]?\d|2[0-3]):[0-5]\d$/.test(c.time || '') ? (c.time.length === 4 ? '0' + c.time : c.time) : '';
  c.tz = typeof c.tz === 'string' ? c.tz : '';
  c.icon = typeof c.icon === 'string' ? c.icon : ''; c.color = typeof c.color === 'string' && c.color ? c.color : '#4772fa'; c.note = typeof c.note === 'string' ? c.note : '';
  c.listId = c.listId || ''; c.projectId = c.projectId || ''; c.taskId = c.taskId || '';
  c.tags = Array.isArray(c.tags) ? c.tags.map(g => String(g).toLowerCase()).filter(Boolean) : [];
  c.repeat = c.repeat === 'year' ? 'year' : '';
  c.remind = Array.isArray(c.remind) ? c.remind.map(Number).filter(n => Number.isFinite(n) && n >= 0) : [];
  c.archived = !!c.archived; c.created = c.created || Date.now();
  return c;
}

const CD_REMIND = [['', 'No reminder'], ['0', 'When it arrives'], ['60', '1 hour before'], ['1440', '1 day before'], ['10080', '1 week before'], ['0,1440', 'A day before and when it arrives']];
const cdById = id => S.countdowns.find(c => c.id === id);
const cdZone = c => (c.tz && tzValid(c.tz) ? c.tz : '');
// the moment (ms) of a countdown. Floating times use this device's zone; a date with no time is the start of that day.
function cdMoment(c, date = c.date) { return tzToUtc(date, c.time || '00:00', cdZone(c) || tzLocal()); }
// a yearly countdown moves to its next occurrence (Feb 29 falls back to Feb 28 in other years)
function cdDateFor(c, now = Date.now()) {
  if (c.repeat !== 'year') return c.date;
  const [y0, m, d] = c.date.split('-').map(Number), tz = cdZone(c) || tzLocal();
  let y = Math.max(y0, tzParts(now, tz).y);
  const at = yy => `${yy}-${pad(m)}-${pad(m === 2 && d === 29 && !(yy % 4 === 0 && (yy % 100 !== 0 || yy % 400 === 0)) ? 28 : d)}`;
  if (c.time ? cdMoment(c, at(y)) + 1000 < now : tzDate(now, tz) > at(y)) y++; // this year's one has passed
  return at(y);
}
// where a countdown stands: { ms (until, negative = past), past, today, days, h, m, s, whole (date-only), date, at }
function cdLeft(c, now = Date.now()) {
  const date = cdDateFor(c, now), at = cdMoment(c, date), tz = cdZone(c) || tzLocal();
  if (!c.time) {
    const days = dayDiff(date, tzDate(now, tz));
    return { whole: true, date, at, ms: at - now, past: days < 0, today: days === 0, days: Math.abs(days), h: 0, m: 0, s: 0 };
  }
  const ms = at - now, a = Math.abs(ms), sec = Math.floor(a / 1000);
  return { whole: false, date, at, ms, past: ms < 0, today: tzDate(now, tz) === date, days: Math.floor(sec / 86400), h: Math.floor(sec % 86400 / 3600), m: Math.floor(sec % 3600 / 60), s: sec % 60 };
}
// the short text for chips: "12 days", "3d 4h", "Today", "5 days ago"
function cdShort(c, now = Date.now()) {
  const L = cdLeft(c, now), ago = L.past ? ' ago' : '';
  if (L.whole) return L.today ? 'Today' : `${L.days} day${L.days === 1 ? '' : 's'}${ago}`;
  if (L.days) return `${L.days}d ${L.h}h${ago}`;
  if (L.h) return `${L.h}h ${L.m}m${ago}`;
  if (L.m) return `${L.m}m ${pad(L.s)}s${ago}`;
  return `${L.s}s${ago}`;
}
// the big number and its unit for a card
function cdBig(c, now = Date.now()) {
  const L = cdLeft(c, now);
  if (L.whole) return L.today ? { n: '0', u: 'Today', past: false } : { n: String(L.days), u: L.days === 1 ? 'day' : 'days', past: L.past };
  if (L.days >= 1) return { n: String(L.days), u: L.days === 1 ? 'day' : 'days', past: L.past, sub: `${L.h}h ${pad(L.m)}m ${pad(L.s)}s` };
  return { n: `${pad(L.h)}:${pad(L.m)}:${pad(L.s)}`, u: L.past ? 'ago' : 'left', past: L.past, small: true };
}
// "Sat 12 Dec 2026, 9:00 AM" plus where it falls in your own time when the countdown has a zone
function cdWhen(c, now = Date.now()) {
  const L = cdLeft(c, now), z = cdZone(c), d = pYmd(L.date), base = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  if (!c.time) return base + (z ? ` · ${tzCity(z)}` : '');
  if (!z || z === tzLocal()) return `${base}, ${fmtTime(c.time)}`;
  return `${base}, ${fmtTime(c.time)} ${tzCity(z)} · ${tzFull(L.at, tzLocal())} your time`;
}
const cdScopeKey = () => { const f = S.settings.cd || {}; return f.list ? 'list:' + f.list : f.project ? 'project:' + f.project : f.tag ? 'tag:' + f.tag : ''; };
function cdList(now = Date.now()) {
  const f = S.settings.cd || {}, sc = cdScopeKey(), show = f.show || 'upcoming';
  let l = S.countdowns.filter(c => scopeHas(sc, c));
  l = l.filter(c => { const p = cdLeft(c, now).past; return show === 'all' ? true : show === 'past' ? p || c.archived : !p && !c.archived; });
  const by = f.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : f.sort === 'added' ? (a, b) => b.created - a.created : (a, b) => (show === 'past' ? cdLeft(b, now).at - cdLeft(a, now).at : cdLeft(a, now).at - cdLeft(b, now).at);
  return l.sort(by);
}
function cdHome(c) {
  const bits = [];
  if (c.projectId && projectOf(c.projectId)) { const p = projectOf(c.projectId); bits.push(`<span class="nh" style="--c:${p.color}">${ic('layers', 11)}<span>${esc(p.name)}</span></span>`); }
  if (c.listId && S.lists.some(l => l.id === c.listId)) { const l = listOf(c.listId); bits.push(`<span class="nh" style="--c:${l.color}">${ic('list', 11)}<span>${esc(l.name)}</span></span>`); }
  return bits.join('') + c.tags.map(g => (typeof tagChip === 'function' ? tagChip(g) : `<span class="tg">#${esc(g)}</span>`)).join('');
}
function cdCard(c, now) {
  const b = cdBig(c, now), L = cdLeft(c, now), t = c.taskId && S.tasks.find(x => x.id === c.taskId && !x.deleted);
  return `<article class="cdc${b.past ? ' past' : ''}${L.today ? ' today' : ''}" style="--c:${esc(c.color)}" data-cdid="${esc(c.id)}">`
    + `<button class="cdmain" data-act="cdedit" data-id="${esc(c.id)}" aria-label="Edit ${esc(c.name || 'countdown')}"><span class="cdi">${c.icon ? iconAny(c.icon, 20) : ic('hourglass', 20)}</span><span class="cdn">${esc(c.name || 'Untitled')}</span>`
    + `<span class="cdbig${b.small ? ' sm' : ''}" data-cdt="${esc(c.id)}"><b>${esc(b.n)}</b><i>${esc(b.u)}</i>${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</span>`
    + `<span class="cdw">${esc(cdWhen(c, now))}${c.repeat ? ` · ${ic('repeat', 11)} yearly` : ''}</span></button>`
    + `<div class="cdm">${cdHome(c)}${t ? `<button class="tfc" data-act="cdtask" data-id="${esc(t.id)}" title="Open the task">${ic('check-circle', 12)} ${esc(t.title)}</button>` : ''}${c.remind.length ? `<span class="cdrem" title="Reminder set">${ic('bell', 12)}</span>` : ''}</div>`
    + (c.note ? `<p class="cdnote">${esc(c.note)}</p>` : '') + `</article>`;
}
function renderCountdowns() {
  const f = S.settings.cd, now = Date.now(), l = cdList(now), sc = cdScopeKey();
  const tools = `<select data-cdf="show" title="Show" aria-label="Show">${opts([['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All']], f.show)}</select><select data-cdf="sort" title="Sort" aria-label="Sort">${opts([['soon', 'Soonest first'], ['name', 'Name'], ['added', 'Newest added']], f.sort)}</select>`
    + `<select data-cdf="scope" title="Filter by list, project or tag" aria-label="Filter">${opts(scopeOptions('Everything'), sc)}</select><button class="btn pri" data-act="cdadd">${ic('plus', 16)}<span class="hide-m"> Countdown</span></button>`;
  const empty = `<div class="empty">${ic('hourglass', 40)}<p>${S.countdowns.length ? 'Nothing matches this filter.' : 'Count down to a trip, an exam, a launch or a birthday.'}</p><button class="btn pri" data-act="cdadd">${ic('plus', 15)} New countdown</button></div>`;
  $('#main').innerHTML = topHtml('Countdowns', tools) + `<div class="body">${l.length ? `<div class="cdgrid">${l.map(c => cdCard(c, now)).join('')}</div>` : empty}</div>`;
}
// the strip on a list / project / tag page, and a short one on Today
function cdStripHtml(eff, now = Date.now()) {
  let l;
  if (/^(list|project|tag):/.test(eff)) l = S.countdowns.filter(c => !c.archived && scopeHas(eff, c) && !cdLeft(c, now).past);
  else if (eff === 'today') l = S.countdowns.filter(c => { const x = cdLeft(c, now); return !c.archived && !x.past && x.days <= 7; });
  else return '';
  if (!l.length) return '';
  l.sort((a, b) => cdLeft(a, now).at - cdLeft(b, now).at);
  return `<div class="tplstrip cdstrip"><span class="tb-l">${ic('hourglass', 14)} Countdowns</span><div class="tb-c">${l.slice(0, 6).map(c => `<button class="tfc cdchip" style="--c:${esc(c.color)}" data-act="cdedit" data-id="${esc(c.id)}" title="${esc(cdWhen(c, now))}">${c.icon ? iconAny(c.icon, 13) : ''}<span>${esc(c.name || 'Untitled')}</span><b data-cdchip="${esc(c.id)}">${esc(cdShort(c, now))}</b></button>`).join('')}${l.length > 6 ? `<button class="tfc" data-act="page" data-page="countdowns">+${l.length - 6} more</button>` : ''}</div></div>`;
}

/* ---------- the dialog ---------- */
const cdTags = s => [...new Set(String(s || '').split(/[\s,]+/).map(g => g.replace(/^#/, '').toLowerCase()).filter(Boolean))];
async function cdForm(c, preset = {}) {
  const isNew = !c, d = c || cdNormalise({ id: uid(), name: '', date: ymd(addDays(new Date(), 7)), ...preset });
  const v = await formDialog({ title: isNew ? 'New countdown' : 'Edit countdown', ok: isNew ? 'Add' : 'Save', del: !isNew, fields: [
    { k: 'name', label: 'Name', type: 'text', v: d.name, ph: 'e.g. Holiday in Lisbon' },
    { k: 'date', label: 'Date', type: 'date', v: d.date },
    { k: 'time', label: 'Time (optional: leave empty to count whole days)', type: 'time', v: d.time },
    { k: 'tz', label: 'Time zone', type: 'select', v: d.tz, opts: [['', 'My own time (follows me when I travel)'], ...tzOptions(d.tz)] },
    { k: 'repeat', label: 'Repeats', type: 'select', v: d.repeat, opts: [['', 'Once'], ['year', 'Every year']] },
    { k: 'remind', label: 'Reminder', type: 'select', v: d.remind.join(','), opts: CD_REMIND.concat(CD_REMIND.some(o => o[0] === d.remind.join(',')) ? [] : [[d.remind.join(','), 'Custom']]) },
    { k: 'icon', label: 'Icon', type: 'icon', v: d.icon },
    { k: 'color', label: 'Colour', type: 'color', v: d.color },
    { k: 'listId', label: 'List (optional)', type: 'select', v: d.listId, opts: [['', 'None'], ...listTree().map(({ l, depth }) => [l.id, ' '.repeat(depth) + l.name])] },
    { k: 'projectId', label: 'Project (optional)', type: 'select', v: d.projectId, opts: [['', 'None'], ...S.projects.map(p => [p.id, p.name])] },
    { k: 'tags', label: 'Tags (optional)', type: 'text', v: d.tags.join(' '), ph: 'travel family' },
    { k: 'note', label: 'Note', type: 'textarea', v: d.note, rows: 2 },
    ...(d.taskId && S.tasks.some(t => t.id === d.taskId && !t.deleted) ? [{ k: 'hint', type: 'hint', label: 'Linked to a task. Changing the task’s date does not change this countdown.' }] : []),
  ], check: x => (!x.name.trim() ? 'Give the countdown a name' : !/^\d{4}-\d\d-\d\d$/.test(x.date) ? 'Choose a date' : '') });
  if (!v) return null;
  if (v._del) { S.countdowns = S.countdowns.filter(x => x !== c); save(); renderMain(); return { deleted: true }; }
  const next = { ...d, name: v.name.trim(), date: v.date, time: v.time || '', tz: v.tz, repeat: v.repeat, remind: v.remind === '' ? [] : String(v.remind).split(',').map(Number), icon: v.icon || '', color: v.color, listId: v.listId, projectId: v.projectId, tags: cdTags(v.tags), note: v.note.trim() };
  if (isNew) S.countdowns.push(cdNormalise(next)); else Object.assign(c, cdNormalise(next));
  save(); if (U.page === 'countdowns') renderMain(); else if (typeof refresh === 'function') refresh();
  return isNew ? S.countdowns[S.countdowns.length - 1] : c;
}
// a countdown that counts down to a task (its due date and time; the zone it was planned in, if any)
function cdFromTask(t) {
  return cdForm(null, { name: t.title, date: t.due || ymd(addDays(new Date(), 7)), time: t.time || '', tz: t.tz || '', listId: t.listId && t.listId !== 'inbox' ? t.listId : '', tags: [...(t.tags || [])], taskId: t.id });
}

const CD_ACT = {
  async cdadd() { const c = await cdForm(null); if (c && !c.deleted) { sfx('add'); toast('Countdown added'); } },
  async cdedit(el) { const c = cdById(el.dataset.id); if (c) await cdForm(c); },
  cdtask(el) { const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return; if (typeof setNav === 'function') setNav('list:' + t.listId); U.sel = t.id; refresh(); },
};
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || el.dataset.cdf === undefined || U.page !== 'countdowns') return;
  const f = S.settings.cd, k = el.dataset.cdf;
  if (k === 'scope') { const [t, ...r] = el.value.split(':'), id = r.join(':'); f.list = t === 'list' ? id : ''; f.project = t === 'project' ? id : ''; f.tag = t === 'tag' ? id : ''; }
  else f[k] = el.value;
  save(); renderMain();
});
// the numbers tick every second while the page (or a strip) is on screen: only the text changes, nothing is redrawn
function cdTick() {
  if (typeof document === 'undefined' || document.hidden) return;
  const now = Date.now();
  if (U.page === 'countdowns') {
    $$('#main [data-cdid]').forEach(card => {
      const c = cdById(card.dataset.cdid); if (!c) return; const b = cdBig(c, now), el = $('[data-cdt]', card); if (!el) return;
      const html = `<b>${esc(b.n)}</b><i>${esc(b.u)}</i>${b.sub ? `<small>${esc(b.sub)}</small>` : ''}`;
      if (el.innerHTML !== html) el.innerHTML = html;
      card.classList.toggle('past', !!b.past);
    });
  }
  $$('#main [data-cdchip]').forEach(el => { const c = cdById(el.dataset.cdchip); if (c) { const t = cdShort(c, now); if (el.textContent !== t) el.textContent = t; } });
}
if (typeof setInterval === 'function' && typeof document !== 'undefined') { const h = setInterval(cdTick, 1000); if (h && h.unref) h.unref(); }
