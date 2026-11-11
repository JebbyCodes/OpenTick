/* OpenTick contacts: an address book that the rest of the app can point at.
   S.contacts is a synced collection (merged by newest edit, tombstoned on delete, encrypted with everything else):
     { id, name, nick, role, org, emails [{ l, v }], phones [{ l, v }], web, addr, bday 'YYYY-MM-DD', tz '' | IANA zone,
       avail { days { 0..6: [['09:00','12:00'], …] }, note }, extra [{ l, v }], tags, notes, color, fav, created, u }
   • Available hours are per weekday, in the contact's own time zone (tz '' = yours). "Available now" and "next free" are worked out from them.
   • A link is one fact in one record, like a task's links to notes: task.contactIds, note.contactIds and subject.contactIds hold the ids, and
     the other direction (everything a person is linked to) is worked out, never stored, so it cannot disagree with itself.
   • Writing @[Name] in a note or a task's notes mentions a person. The mention is a link in the text; rename the person and the mentions follow.
   • +name in a quick-add ("Send the report to +anna") links the person and takes the word out of the title.
   • Teachers of the Classes timetable are contacts too: every teacher has a contact (id "ct-<teacher id>", so two devices that both make it
     agree) and teacher.contactId points at it. Name, email and phone are kept in step both ways. The Contacts page groups them as Class contacts.
   The normalisers are function declarations on purpose: migrate() calls them while core.js is still loading, before any const below exists,
   so they must only use other function declarations and literals. */
function ctIds(v) { return Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x))].slice(0, 40) : []; }
function ctStr(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
function ctHM(x) { return typeof x === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(x) ? (x.length === 4 ? '0' + x : x) : ''; }
function ctMin(x) { const p = String(x).split(':').map(Number); return (p[0] || 0) * 60 + (p[1] || 0); }
function ctList(v, legacy) { // [{ l, v }]: a label and a value; a plain string (an older single field) becomes one entry
  let a = Array.isArray(v) ? v : []; if (!a.length && legacy) a = [legacy];
  return a.map(x => (typeof x === 'string' ? { l: '', v: x } : x)).filter(x => x && typeof x === 'object' && typeof x.v === 'string' && x.v.trim()).map(x => ({ l: ctStr(x.l, 24), v: ctStr(x.v, 200) })).slice(0, 12);
}
function ctAvailNorm(a) {
  const out = { days: {}, note: '' }; a = a && typeof a === 'object' ? a : {}; out.note = ctStr(a.note, 200);
  const d = a.days && typeof a.days === 'object' ? a.days : {};
  for (let i = 0; i < 7; i++) {
    const r = (Array.isArray(d[i]) ? d[i] : []).map(x => (Array.isArray(x) ? [ctHM(x[0]), ctHM(x[1])] : null)).filter(x => x && x[0] && x[1] && ctMin(x[0]) < ctMin(x[1])).sort((p, q) => ctMin(p[0]) - ctMin(q[0]));
    const m = []; for (const x of r) { const l = m[m.length - 1]; if (l && ctMin(x[0]) <= ctMin(l[1])) { if (ctMin(x[1]) > ctMin(l[1])) l[1] = x[1]; } else m.push([x[0], x[1]]); } // overlapping ranges become one
    out.days[i] = m.slice(0, 4);
  }
  return out;
}
function ctNormalise(c) {
  c.name = ctStr(c.name, 120).replace(/[[\]]/g, ''); c.nick = ctStr(c.nick, 40).replace(/[[\]\s]/g, ''); c.role = ctStr(c.role, 80); c.org = ctStr(c.org, 80);
  c.emails = ctList(c.emails, c.email); c.phones = ctList(c.phones, c.phone); delete c.email; delete c.phone;
  c.web = ctStr(c.web, 300); c.addr = ctStr(c.addr, 300); c.bday = /^\d{4}-\d\d-\d\d$/.test(c.bday || '') ? c.bday : '';
  c.tz = typeof c.tz === 'string' && c.tz && typeof tzValid === 'function' && tzValid(c.tz) ? c.tz : '';
  c.avail = ctAvailNorm(c.avail); c.extra = ctList(c.extra);
  c.tags = Array.isArray(c.tags) ? [...new Set(c.tags.map(g => String(g).toLowerCase().replace(/^#/, '').replace(/[\s,#]+/g, '-')).filter(Boolean))].slice(0, 20) : [];
  c.notes = typeof c.notes === 'string' ? c.notes : ''; c.color = typeof c.color === 'string' ? c.color : ''; c.fav = !!c.fav; c.created = c.created || Date.now();
  return c;
}
// each teacher in the Classes timetable has a contact; one that does not yet (an older teacher, or one that arrived through sync) gets it here, once
function ctMigrateTeachers(r) {
  const now = Date.now();
  for (const t of r.school) {
    if (t.k !== 'teacher' || t.contactId) continue;
    const id = 'ct-' + t.id; t.contactId = id;
    if (!r.contacts.some(c => c.id === id) && !(r.tomb && r.tomb[id])) r.contacts.push(ctNormalise({ id, name: t.name || 'Teacher', emails: t.email ? [{ l: 'School', v: t.email }] : [], phones: t.phone ? [{ l: 'School', v: t.phone }] : [], created: now, u: now }));
  }
}

const CT_LAB = { emails: ['Work', 'School', 'Home', 'Other'], phones: ['Mobile', 'Work', 'School', 'Home', 'Other'] };
const ctById = id => S.contacts.find(c => c.id === id) || null;
const ctKey = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const ctByName = name => { const k = ctKey(name); return k ? S.contacts.find(c => ctKey(c.name) === k) || null : null; };
// the person a quick-add names (+anna): the exact name with the spaces left out, a nickname, else the one person whose name (or first name) starts with it
function ctByToken(list, tok) {
  const k = ctKey(tok); if (!k) return null; const by = (list || []).filter(x => x && x.name);
  const exact = by.find(x => ctKey(x.name) === k || (x.nick && ctKey(x.nick) === k)); if (exact) return exact;
  const pre = by.filter(x => ctKey(x.name).startsWith(k) || ctKey(String(x.name).split(/\s+/)[0]).startsWith(k)); return pre.length === 1 ? pre[0] : null;
}
const ctInitials = n => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return (((w[0] || '')[0] || '?') + (w.length > 1 ? (w[w.length - 1][0] || '') : '')).toUpperCase(); };
const ctColor = c => c.color || COLORS[[...ctKey(c.name)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % COLORS.length][0];
const ctAvatar = (c, n = 40) => `<span class="pe-av" style="--c:${esc(ctColor(c))};--n:${n}px" aria-hidden="true">${esc(ctInitials(c.name))}</span>`;
const ctSub = c => [c.role, c.org].filter(Boolean).join(' · ');

/* ---------- available hours ---------- */
// what day and minute it is for the contact (in their own zone when they have one)
function ctNowIn(c, now = Date.now()) {
  if (c.tz && typeof tzValid === 'function' && tzValid(c.tz)) { const p = tzParts(now, c.tz); return { dow: new Date(p.y, p.m - 1, p.d).getDay(), min: p.h * 60 + p.mi }; }
  const d = new Date(now); return { dow: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
}
const ctHasHours = c => Object.values(c.avail.days).some(r => r.length);
// { state: 'none' | 'on' | 'off', until (when the current stretch ends), next { off (days ahead), dow, start } }
function ctAvail(c, now = Date.now()) {
  if (!ctHasHours(c)) return { state: 'none' };
  const { dow, min } = ctNowIn(c, now);
  for (const [s, e] of c.avail.days[dow] || []) if (min >= ctMin(s) && min < ctMin(e)) return { state: 'on', until: e };
  for (let off = 0; off < 8; off++) { const d = (dow + off) % 7; for (const [s] of c.avail.days[d] || []) if (off > 0 || ctMin(s) > min) return { state: 'off', next: { off, dow: d, start: s } }; }
  return { state: 'off' };
}
const ctDayWord = n => (n.off === 0 ? 'today' : n.off === 1 ? 'tomorrow' : DAYS[n.dow]);
function ctAvailText(c, now = Date.now()) {
  const a = ctAvail(c, now); if (a.state === 'none') return '';
  if (a.state === 'on') return 'Available now · until ' + fmtTime(a.until);
  return a.next ? 'Free ' + ctDayWord(a.next) + ' from ' + fmtTime(a.next.start) : 'Not available';
}
const ctDayHours = (c, d) => (c.avail.days[d] || []).map(([s, e]) => fmtRange(s, e)).join(', ');
const ctWeek = () => { const ws = S.settings.weekStart || 0; return [0, 1, 2, 3, 4, 5, 6].map(i => (ws + i) % 7); };

/* ---------- what a person is linked to ---------- */
const ctOf = rec => ctIds(rec && rec.contactIds).map(ctById).filter(Boolean);
const CT_MENTION = /(^|[^\w@])@\[([^\]\n]{1,120})\]/g;
function ctMentioned(text) { const out = new Set(); if (typeof text === 'string' && text.includes('@[')) text.replace(CT_MENTION, (m, p, n) => { out.add(ctKey(n)); return m; }); return out; }
const ctMentionsIn = (c, text) => ctMentioned(text).has(ctKey(c.name));
const ctTaskLive = t => !t.deleted && !t.log;
const ctTasks = c => S.tasks.filter(t => ctTaskLive(t) && ((t.contactIds || []).includes(c.id) || ctMentionsIn(c, t.notes))).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || String(a.due || '9').localeCompare(String(b.due || '9')));
const ctNotes = c => S.notes.filter(n => (n.contactIds || []).includes(c.id) || ctMentionsIn(c, n.body)).sort((a, b) => (b.updated || 0) - (a.updated || 0));
const ctTeacherRecs = c => (typeof scOf === 'function' ? scOf('teacher').filter(t => t.contactId === c.id) : []);
// the classes a person has to do with: ones they teach (through the Teachers tab or a lesson's own teacher) and ones they were linked to by hand
function ctClasses(c) {
  if (typeof scOf !== 'function') return [];
  const tids = new Set(ctTeacherRecs(c).map(t => t.id)), les = scOf('lesson'), out = [];
  for (const s of scOf('subject')) {
    const teaches = (s.teacherId && tids.has(s.teacherId)) || les.some(l => l.subjectId === s.id && l.teacherId && tids.has(l.teacherId)), linked = (s.contactIds || []).includes(c.id);
    if (teaches || linked) out.push({ s, role: teaches ? 'Teacher' : 'Class contact' });
  }
  return out.sort((a, b) => a.s.name.localeCompare(b.s.name));
}
const ctIsClass = c => ctTeacherRecs(c).length > 0 || ctClasses(c).length > 0;
const ctCounts = c => ({ tasks: ctTasks(c).filter(t => t.status === 'open').length, notes: ctNotes(c).length, classes: ctClasses(c).length });
// the people on one task or note: the ones linked on purpose, then the ones mentioned in its text (those cannot be unlinked from here)
function ctPeople(kind, rec) {
  const lk = ctOf(rec).map(c => ({ c, link: true })), text = kind === 'task' ? rec.notes : kind === 'note' ? rec.body : '';
  const ment = ctMentioned(text); return lk.concat(S.contacts.filter(c => ment.has(ctKey(c.name)) && !lk.some(x => x.c.id === c.id)).map(c => ({ c, link: false })));
}
function ctSetLink(rec, cid, on) {
  const cur = ctIds(rec.contactIds), has = cur.includes(cid);
  if (on && !has) rec.contactIds = [...cur, cid]; else if (!on && has) rec.contactIds = cur.filter(x => x !== cid);
  save();
}
// a person's name changed: every @[Old] in notes and task notes becomes @[New]
function ctRenameRefs(from, to) {
  const k = ctKey(from); if (!k || from === to) return;
  const fix = s => (typeof s === 'string' && s.includes('@[') ? s.replace(CT_MENTION, (m, p, n) => (ctKey(n) === k ? p + '@[' + to + ']' : m)) : s);
  for (const n of S.notes) { const b = fix(n.body); if (b !== n.body) n.body = b; }
  for (const t of S.tasks) { const b = fix(t.notes); if (b !== t.notes) t.notes = b; }
}
function ctCleanRefs(id) {
  for (const t of S.tasks) if ((t.contactIds || []).includes(id)) t.contactIds = t.contactIds.filter(x => x !== id);
  for (const n of S.notes) if ((n.contactIds || []).includes(id)) n.contactIds = n.contactIds.filter(x => x !== id);
  if (typeof scOf === 'function') for (const s of scOf('subject')) if ((s.contactIds || []).includes(id)) s.contactIds = s.contactIds.filter(x => x !== id);
}

/* ---------- teachers <-> contacts ---------- */
// the teacher record changed in Classes (rec is about to be saved): make or update its contact
function ctTeacherPush(rec) {
  let c = rec.contactId && ctById(rec.contactId);
  if (!c) { if (rec.contactId && !ctById(rec.contactId) && S.tomb[rec.contactId]) return; c = ctNormalise({ id: rec.contactId || 'ct-' + rec.id, name: rec.name || 'Teacher', created: Date.now() }); S.contacts.push(c); rec.contactId = c.id; }
  c.name = ctStr(rec.name, 120).replace(/[[\]]/g, '') || c.name;
  const put = (key, v, lab) => { const l = (c[key] || []).slice(); if (v) { if (l.length) l[0] = { ...l[0], v }; else l.push({ l: lab, v }); } else if (l.length) l.shift(); c[key] = l; };
  put('emails', rec.email || '', 'School'); put('phones', rec.phone || '', 'School'); ctNormalise(c);
}
// the contact changed: its teacher records follow (the timetable shows the teacher's own name, email and phone)
function ctTeacherPull(c) {
  for (const t of ctTeacherRecs(c)) { t.name = c.name; t.email = (c.emails[0] || {}).v || ''; t.phone = (c.phones[0] || {}).v || ''; }
}

/* ---------- the page ---------- */
const CT_SORTS = [['name', 'Name'], ['org', 'Organisation'], ['added', 'Newest added'], ['free', 'Available first']];
function ctFilters() {
  const f = S.settings.ct, out = [['all', 'Everyone', 'contact'], ['fav', 'Favourites', 'star']];
  if (S.contacts.some(ctIsClass)) out.push(['class', 'Class contacts', 'teacher']);
  if (S.contacts.some(ctHasHours)) out.push(['now', 'Available now', 'clock']);
  const tags = [...new Set(S.contacts.flatMap(c => c.tags))].sort(); for (const g of tags.slice(0, 12)) out.push(['tag:' + g, '#' + g, 'tag']);
  return out.some(x => x[0] === f.filter) ? out : out.concat(f.filter === 'all' ? [] : [[f.filter, f.filter, 'tag']]);
}
function ctMatch(c, q) {
  if (!q) return true; const hay = [c.name, c.nick, c.role, c.org, c.tags.join(' '), c.notes, c.addr, c.web, ...c.emails.map(x => x.v), ...c.phones.map(x => x.v), ...c.extra.map(x => x.v)].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
function ctVisible(now = Date.now()) {
  const f = S.settings.ct, q = (U.ctQ || '').trim();
  let l = S.contacts.filter(c => ctMatch(c, q));
  if (f.filter === 'fav') l = l.filter(c => c.fav); else if (f.filter === 'class') l = l.filter(ctIsClass); else if (f.filter === 'now') l = l.filter(c => ctAvail(c, now).state === 'on'); else if (f.filter.startsWith('tag:')) l = l.filter(c => c.tags.includes(f.filter.slice(4)));
  const nm = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const rank = c => { const a = ctAvail(c, now); return a.state === 'on' ? 0 : a.state === 'off' ? 1 : 2; };
  return l.sort(f.sort === 'org' ? (a, b) => (a.org || '￿').localeCompare(b.org || '￿') || nm(a, b) : f.sort === 'added' ? (a, b) => b.created - a.created || nm(a, b) : f.sort === 'free' ? (a, b) => rank(a) - rank(b) || nm(a, b) : nm);
}
function ctCard(c, now) {
  const av = ctAvail(c, now), n = ctCounts(c), cls = ctClasses(c), mail = c.emails[0], tel = c.phones[0];
  const badge = av.state === 'none' ? '' : `<span class="pe-free ${av.state}" title="${esc(c.tz ? 'In ' + tzCity(c.tz) + ' time' : 'In your time')}"><i></i>${esc(ctAvailText(c, now))}</span>`;
  return `<article class="pe-card" style="--c:${esc(ctColor(c))}" data-ctid="${esc(c.id)}">`
    + `<button class="pe-main" data-act="ctopen" data-id="${esc(c.id)}" aria-label="Open ${esc(c.name)}">${ctAvatar(c, 44)}<span class="pe-nm"><b class="mq">${esc(c.name)}</b><small class="mq">${esc(ctSub(c) || 'No role or organisation')}</small></span>${c.fav ? `<span class="pe-fav" title="Favourite">${ic('star', 14)}</span>` : ''}</button>`
    + (badge ? `<div class="pe-row">${badge}</div>` : '')
    + (cls.length ? `<div class="pe-row pe-cls">${cls.slice(0, 3).map(x => `<span class="pe-cl" style="--c:${esc(x.s.color || 'var(--acc)')}" title="${esc(x.role)}">${x.s.icon ? iconAny(x.s.icon, 12) : ic('book', 12)}<span>${esc(x.s.name)}</span></span>`).join('')}${cls.length > 3 ? `<small class="hint">+${cls.length - 3}</small>` : ''}</div>` : '')
    + `<div class="pe-row pe-q">${mail ? `<a class="btn sm" href="mailto:${esc(mail.v)}" title="Email ${esc(mail.v)}" aria-label="Email ${esc(c.name)}">${ic('mail', 14)}</a>` : ''}${tel ? `<a class="btn sm" href="tel:${esc(tel.v.replace(/[^\d+]/g, ''))}" title="Call ${esc(tel.v)}" aria-label="Call ${esc(c.name)}">${ic('phone', 14)}</a>` : ''}`
    + `<span class="pe-n">${n.tasks ? `<span title="Open tasks">${ic('check-square', 12)} ${n.tasks}</span>` : ''}${n.notes ? `<span title="Notes">${ic('notes', 12)} ${n.notes}</span>` : ''}${n.classes ? `<span title="Classes">${ic('book', 12)} ${n.classes}</span>` : ''}</span></div></article>`;
}
function ctListHtml() {
  const now = Date.now(), l = ctVisible(now), f = S.settings.ct;
  if (!l.length) return `<div class="empty">${ic('contact', 40)}<p>${S.contacts.length ? 'Nobody matches this search or filter.' : 'Keep the people you work and study with in one place: their details, when they are free, and what you have with them.'}</p>${S.contacts.length ? '<button class="btn" data-act="ctreset">Show everyone</button>' : `<button class="btn pri" data-act="ctadd">${ic('plus', 15)} New contact</button>`}</div>`;
  const grid = a => `<div class="pe-grid">${a.map(c => ctCard(c, now)).join('')}</div>`;
  if (f.filter !== 'all' || f.sort !== 'name' || (U.ctQ || '').trim()) return grid(l);
  const fav = l.filter(c => c.fav), cls = l.filter(c => !c.fav && ctIsClass(c)), rest = l.filter(c => !c.fav && !ctIsClass(c));
  const sec = (title, ico, a, hint = '') => (a.length ? `<h3 class="hh pe-h">${ic(ico, 16)} ${esc(title)}<span class="fcnt">${a.length}</span>${hint ? `<small class="hint">${esc(hint)}</small>` : ''}</h3>${grid(a)}` : '');
  return (fav.length || cls.length ? sec('Favourites', 'star', fav) + sec('Class contacts', 'teacher', cls, 'Teachers and others from your classes') + sec('Everyone else', 'contact', rest) : grid(rest));
}
function renderContacts() {
  const f = S.settings.ct, tools = `<select data-ctf="sort" title="Sort" aria-label="Sort">${opts(CT_SORTS, f.sort)}</select><button class="btn pri" data-act="ctadd">${ic('plus', 16)}<span class="hide-m"> Contact</span></button>`;
  $('#main').innerHTML = topHtml('Contacts', tools)
    + `<div class="body pe-body"><div class="pe-filters"><div class="search hs">${ic('search', 16)}<input id="ct-q" placeholder="Search people, organisations, emails…" autocomplete="off" value="${esc(U.ctQ || '')}"></div><div class="hchips">${ctFilters().map(([k, n, i]) => `<button class="tfc${f.filter === k ? ' on' : ''}" data-act="ctfilter" data-f="${esc(k)}" aria-pressed="${f.filter === k}">${ic(i, 13)} ${esc(n)}</button>`).join('')}</div></div><div id="ct-list">${ctListHtml()}</div></div>`;
}
const ctRepaintList = () => { const l = $('#ct-list'); if (l) l.innerHTML = ctListHtml(); };
document.addEventListener('input', e => { if (e.target && e.target.id === 'ct-q') { U.ctQ = e.target.value; ctRepaintList(); } });
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || el.dataset.ctf === undefined || U.page !== 'contacts') return;
  S.settings.ct[el.dataset.ctf] = el.value; save(); renderMain();
});

/* ---------- the profile ---------- */
// a website is only ever an http(s) link: "javascript:" and the like are shown as text, not made clickable
function ctWebHref(u) { const x = /^[a-z][a-z0-9+.-]*:/i.test(String(u)) ? String(u) : 'https://' + u; return /^https?:\/\//i.test(x) ? x : ''; }
const ctLink = (kind, v) => (kind === 'emails' ? `<a href="mailto:${esc(v)}">${esc(v)}</a>` : kind === 'phones' ? `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}">${esc(v)}</a>` : esc(v));
function ctDetailRow(ico, label, html, copy) { return `<div class="pe-d"><span class="pe-di">${ic(ico, 15)}</span><div class="pe-dv"><small>${esc(label)}</small><span>${html}</span></div>${copy ? `<button type="button" class="ib sm" data-m="copy" data-v="${esc(copy)}" title="Copy" aria-label="Copy ${esc(label)}">${ic('copy', 14)}</button>` : ''}</div>`; }
function ctProfileHtml(c) {
  const now = Date.now(), av = ctAvail(c, now), tasks = ctTasks(c), notes = ctNotes(c), cls = ctClasses(c), z = c.tz ? ` · ${esc(tzCity(c.tz))} time` : '';
  const week = ctWeek().map(d => `<div class="pe-wd${(c.avail.days[d] || []).length ? ' on' : ''}${ctNowIn(c, now).dow === d ? ' today' : ''}"><b>${DAYS[d]}</b><span>${esc(ctDayHours(c, d) || '—')}</span></div>`).join('');
  const bd = c.bday ? (() => { const d = pYmd(c.bday); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; })() : '';
  const li = (items, empty, kind) => (items.length ? `<div class="pe-ls">${items.join('')}</div>` : `<p class="hint">${empty}</p>`);
  return `<div class="pe-prof" style="--c:${esc(ctColor(c))}"><div class="pe-ph">${ctAvatar(c, 64)}<div class="pe-pt"><h3>${esc(c.name)}${c.nick ? ` <small>“${esc(c.nick)}”</small>` : ''}</h3><p>${esc(ctSub(c) || 'No role or organisation yet')}</p>${c.tags.length ? `<div class="pe-tags">${c.tags.map(g => `<span class="tag">#${esc(g)}</span>`).join('')}</div>` : ''}</div><button type="button" class="ib${c.fav ? ' on' : ''}" data-m="fav" title="${c.fav ? 'Remove from favourites' : 'Add to favourites'}" aria-label="Favourite" aria-pressed="${c.fav}">${ic('star', 18)}</button></div>`
    + `<div class="pe-acts">${c.emails[0] ? `<a class="btn" href="mailto:${esc(c.emails[0].v)}">${ic('mail', 15)} Email</a>` : ''}${c.phones[0] ? `<a class="btn" href="tel:${esc(c.phones[0].v.replace(/[^\d+]/g, ''))}">${ic('phone', 15)} Call</a>` : ''}<button type="button" class="btn" data-m="edit">${ic('pencil', 15)} Edit</button></div>`
    + `<section class="pe-s"><h4>${ic('clock', 15)} Available hours${z}</h4>${ctHasHours(c) ? `<p class="pe-now ${av.state}"><i></i>${esc(ctAvailText(c, now))}</p><div class="pe-week">${week}</div>` : '<p class="hint">No hours set. Edit the contact to add when they are free.</p>'}${c.avail.note ? `<p class="pe-an">${esc(c.avail.note)}</p>` : ''}</section>`
    + `<section class="pe-s"><h4>${ic('user', 15)} Details</h4>${[...c.emails.map(x => ctDetailRow('mail', x.l || 'Email', ctLink('emails', x.v), x.v)), ...c.phones.map(x => ctDetailRow('phone', x.l || 'Phone', ctLink('phones', x.v), x.v)), c.web ? ctDetailRow('link', 'Website', ctWebHref(c.web) ? `<a href="${esc(ctWebHref(c.web))}" target="_blank" rel="noopener noreferrer">${esc(c.web)}</a>` : esc(c.web)) : '', c.addr ? ctDetailRow('pin', 'Address', esc(c.addr), c.addr) : '', bd ? ctDetailRow('gift', 'Birthday', esc(bd)) : '', ...c.extra.map(x => ctDetailRow('info', x.l || 'Other', esc(x.v)))].join('') || '<p class="hint">No details yet.</p>'}${c.notes ? `<div class="pe-notes md">${typeof md === 'function' ? md(c.notes) : esc(c.notes)}</div>` : ''}</section>`
    + `<section class="pe-s"><h4>${ic('book', 15)} Classes${cls.length ? `<span class="fcnt">${cls.length}</span>` : ''}<button type="button" class="btn sm" data-m="lk-class">${ic('plus', 13)} Link</button></h4>${li(cls.map(x => `<span class="lchip"><button type="button" class="lc-b" data-m="goclass" data-id="${esc(x.s.id)}" title="${esc(x.role)}">${x.s.icon ? iconAny(x.s.icon, 13) : ic('book', 13)}<span>${esc(x.s.name)}</span><small>${esc(x.role)}</small></button></span>`), typeof scOf === 'function' ? 'Not linked to a class. Teachers you add in Classes appear here by themselves; link anyone else with Link.' : '', 'class')}</section>`
    + `<section class="pe-s"><h4>${ic('check-square', 15)} Tasks${tasks.length ? `<span class="fcnt">${tasks.length}</span>` : ''}<button type="button" class="btn sm" data-m="lk-task">${ic('plus', 13)} Link</button><button type="button" class="btn sm" data-m="new-task">${ic('plus', 13)} New</button></h4>${li(tasks.slice(0, 30).map(t => `<span class="lchip${t.status !== 'open' ? ' fin' : ''}"><button type="button" class="lc-b" data-m="gotask" data-id="${esc(t.id)}">${ic(t.status === 'done' ? 'check-circle' : 'check-square', 13)}<span>${titleHtml(t)}</span>${t.due ? `<small>${esc(dueLabel(t))}</small>` : ''}</button></span>`), 'No tasks yet. Link one, or add +' + esc((c.nick || c.name.split(/\s+/)[0] || 'name').toLowerCase()) + ' to a task when you type it.', 'task')}</section>`
    + `<section class="pe-s"><h4>${ic('notes', 15)} Notes${notes.length ? `<span class="fcnt">${notes.length}</span>` : ''}<button type="button" class="btn sm" data-m="lk-note">${ic('plus', 13)} Link</button><button type="button" class="btn sm" data-m="new-note">${ic('plus', 13)} New</button></h4>${li(notes.slice(0, 30).map(n => `<span class="lchip"><button type="button" class="lc-b" data-m="gonote" data-id="${esc(n.id)}">${ic('notes', 13)}<span>${noteTitleHtml(n)}</span></button></span>`), 'No notes yet. Mention them in any note with @[' + esc(c.name) + '].', 'note')}</section></div>`
    + `<div class="mact"><button type="button" class="danger" data-m="del">Delete</button><span class="sp"></span><button type="button" class="pri" data-m="ok">Done</button></div>`;
}
function ctProfile(id) {
  const c = ctById(id); if (!c) { toast('That contact was deleted'); return; }
  const m0 = $('#modal'), keep = m0 && m0.classList.contains('on') && $('.mbox', m0) ? $('.mbox', m0).scrollTop : 0;
  openModal(ctProfileHtml(c), m => {
    const box = $('.mbox', m); if (box && keep) box.scrollTop = keep;
    m.onclick = async e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); afterContactChange(); } return; }
      const k = b.dataset.m, again = () => ctProfile(id);
      if (k === 'ok') { closeModal(); afterContactChange(); }
      else if (k === 'edit') ctEditForm(c);
      else if (k === 'fav') { c.fav = !c.fav; save(); sfx('tick'); again(); }
      else if (k === 'copy') { try { await navigator.clipboard.writeText(b.dataset.v); toast('Copied'); } catch (err) { toast('Could not copy'); } }
      else if (k === 'del') { if (await askConfirm('Delete ' + c.name + '? Tasks and notes that point at them stay, just without the link.', 'Delete')) { ctDelete(c); } else again(); }
      else if (k === 'gotask') { closeModal(); openTaskById(b.dataset.id); }
      else if (k === 'gonote') { closeModal(); openNoteById(b.dataset.id); }
      else if (k === 'goclass') { closeModal(); S.settings.tt.mode = 'school'; U.scTab = 'subj'; U.page = 'timetable'; U.pinKey = null; render(); }
      else if (k === 'lk-task') ctPickFor(c, 'task', again);
      else if (k === 'lk-note') ctPickFor(c, 'note', again);
      else if (k === 'lk-class') ctPickFor(c, 'class', again);
      else if (k === 'new-task') { closeModal(); const t = await askText('New task for ' + c.name, '', 'e.g. Send the report tomorrow 5pm'); if (t) { quickAdd(t, { contactIds: [c.id] }); renderSide(); renderMain(); toast('Task added'); } ctProfile(id); }
      else if (k === 'new-note') { const n = newNote({ title: 'Notes on ' + c.name, contactIds: [c.id] }); S.notes.push(n); sfx('add'); closeModal(); openNoteById(n.id); }
    };
  }, 'wide pe-modal');
}
function afterContactChange() { if (U.page === 'contacts') renderMain(); else if (U.page === 'timetable' && typeof schoolOn === 'function' && schoolOn()) renderMain(); else if (U.page === 'tasks') renderDetail(); }
function ctDelete(c) {
  S.contacts = S.contacts.filter(x => x !== c); ctCleanRefs(c.id); save(); closeModal(); sfx('undo'); toast('Contact deleted'); afterContactChange(); if (typeof renderDetail === 'function') renderDetail();
}

/* ---------- pickers ---------- */
// a list with a search box, where tapping a row toggles it. o: { title, ph, items(q) -> [{ id, html, sub, on }], toggle(id), newLabel, onNew, done, empty }
function ctPickList(o) {
  const row = x => `<button type="button" class="lprow${x.on ? ' on' : ''}" data-lid="${esc(x.id)}"><span class="lpc">${x.on ? ic('check', 14) : ''}</span><span class="lpt">${x.html}</span><small>${esc(x.sub || '')}</small></button>`;
  openModal(`<h3>${esc(o.title)}</h3><input id="lp-q" placeholder="${esc(o.ph || 'Search')}" autocomplete="off"><div class="lplist" id="lp-l"></div><div class="mact">${o.newLabel ? `<button type="button" data-m="new">${ic('plus', 14)} ${esc(o.newLabel)}</button>` : ''}<span class="sp"></span><button type="button" class="pri" data-m="ok">Done</button></div>`, m => {
    const q = $('#lp-q', m), paint = () => { $('#lp-l', m).innerHTML = o.items(q.value.trim().toLowerCase()).map(row).join('') || `<p class="hint">${esc(o.empty || 'Nothing matches.')}</p>`; };
    paint(); if (!narrow(820)) q.focus();
    m.oninput = e => { if (e.target.id === 'lp-q') paint(); };
    const finish = () => { closeModal(); if (o.done) o.done(); };
    m.onclick = e => {
      const r = e.target.closest('[data-lid]'); if (r) { o.toggle(r.dataset.lid); sfx('tick'); paint(); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) finish(); return; }
      if (b.dataset.m === 'ok') finish(); else if (b.dataset.m === 'new' && o.onNew) { closeModal(); o.onNew(); }
    };
  }, 'wide');
}
// from a task, note or class: choose the people on it
function ctPickPeople(kind, id) {
  const rec = kind === 'task' ? getT(id) : kind === 'note' ? noteById(id) : typeof scGet === 'function' ? scGet(id) : null; if (!rec) return;
  const on = c => ctIds(rec.contactIds).includes(c.id), name = kind === 'task' ? rec.title : kind === 'note' ? noteTitle(rec) : rec.name;
  ctPickList({
    title: 'People on “' + String(name || '').slice(0, 40) + '”', ph: 'Search people',
    items: q => S.contacts.filter(c => ctMatch(c, q)).sort((a, b) => (on(b) ? 1 : 0) - (on(a) ? 1 : 0) || a.name.localeCompare(b.name)).map(c => ({ id: c.id, html: `<span class="pe-pk">${ctAvatar(c, 22)}${esc(c.name)}</span>`, sub: ctSub(c), on: on(c) })),
    toggle: cid => ctSetLink(rec, cid, !ctIds(rec.contactIds).includes(cid)),
    empty: 'No contacts yet. Create one below.', newLabel: 'New contact', onNew: async () => { const c = await ctEditForm(null, {}, true); if (c) ctSetLink(rec, c.id, true); ctPickPeople(kind, id); },
    done: () => ctRefreshOwner(kind, id),
  });
}
function ctRefreshOwner(kind, id) {
  if (kind === 'task') { if (U.sel === id) renderDetail(); renderMain(); }
  else if (kind === 'note') { const e = $('#n-links'); if (e && U.noteSel === id) e.innerHTML = noteLinksHtml(noteById(id)); renderNoteList(); }
  else render();
}
// from a person: choose the tasks, notes or classes that are linked to them
function ctPickFor(c, kind, back) {
  const mk = { task: () => S.tasks.filter(t => ctTaskLive(t) && t.status !== 'wontdo'), note: () => S.notes.slice(), class: () => (typeof scOf === 'function' ? scOf('subject') : []) }[kind];
  const label = { task: x => titleHtml(x), note: x => noteTitleHtml(x), class: x => esc(x.name) }[kind], text = { task: x => x.title + ' ' + x.notes, note: x => noteTitle(x) + ' ' + x.body, class: x => x.name }[kind];
  const hold = x => (kind === 'class' ? ctClasses(c).find(y => y.s.id === x.id) && ctClasses(c).find(y => y.s.id === x.id).role === 'Teacher' : false);
  const on = x => (x.contactIds || []).includes(c.id) || hold(x);
  ctPickList({
    title: { task: 'Link tasks to ', note: 'Link notes to ', class: 'Link classes to ' }[kind] + c.name, ph: 'Search',
    items: q => mk().filter(x => !q || text[kind] && text[kind](x).toLowerCase().includes(q)).sort((a, b) => (on(b) ? 1 : 0) - (on(a) ? 1 : 0) || (kind === 'task' ? (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) : kind === 'note' ? (b.updated || 0) - (a.updated || 0) : a.name.localeCompare(b.name))).slice(0, 80)
      .map(x => ({ id: x.id, html: label(x), sub: kind === 'task' ? (x.due ? dueLabel(x) : listOf(x.listId).name) : kind === 'note' ? noteWhen(x.updated) : hold(x) ? 'Teacher' : '', on: on(x) })),
    toggle: id => { const rec = kind === 'task' ? getT(id) : kind === 'note' ? noteById(id) : scGet(id); if (!rec) return; if (hold(rec)) { toast('Set the teacher in Classes → Teachers'); return; } ctSetLink(rec, c.id, !(rec.contactIds || []).includes(c.id)); },
    empty: 'Nothing to link yet.', done: back,
  });
}

/* ---------- the form ---------- */
function ctRowsHtml(key, list) {
  const labs = CT_LAB[key];
  return list.map((x, i) => `<div class="pe-r" data-li="${key}"><select data-l aria-label="Label">${opts(labs.concat(x.l && !labs.includes(x.l) ? [x.l] : []).map(v => [v, v]), x.l || labs[0])}</select><input data-v type="${key === 'emails' ? 'email' : 'tel'}" value="${esc(x.v)}" placeholder="${key === 'emails' ? 'name@example.com' : '+44 7700 900123'}" autocomplete="off" aria-label="${key === 'emails' ? 'Email' : 'Phone number'}"><button type="button" class="ib sm" data-m="rm" data-li="${key}" data-i="${i}" title="Remove" aria-label="Remove">${ic('x', 14)}</button></div>`).join('');
}
const ctExtraHtml = list => list.map((x, i) => `<div class="pe-r" data-li="extra"><input data-l value="${esc(x.l)}" placeholder="Label (e.g. Office)" maxlength="24" aria-label="Label"><input data-v value="${esc(x.v)}" placeholder="Value" aria-label="Value"><button type="button" class="ib sm" data-m="rm" data-li="extra" data-i="${i}" title="Remove" aria-label="Remove">${ic('x', 14)}</button></div>`).join('');
const ctAvailHtml = avail => ctWeek().map(d => { const r = avail.days[d] || []; return `<div class="pe-ad"><b>${DAYS[d]}</b><div class="pe-rg">${r.map(([s, e], i) => `<span class="pe-rr" data-ar="${d}"><input type="time" data-s value="${s}" aria-label="${DAYS[d]} from"><i>–</i><input type="time" data-e value="${e}" aria-label="${DAYS[d]} to"><button type="button" class="ib sm" data-m="rmr" data-d="${d}" data-i="${i}" title="Remove" aria-label="Remove">${ic('x', 13)}</button></span>`).join('')}${r.length < 4 ? `<button type="button" class="btn sm" data-m="addr" data-d="${d}">${ic('plus', 12)}${r.length ? '' : ' Add hours'}</button>` : ''}</div></div>`; }).join('');
function ctFormBody(st) {
  const z = typeof tzOptions === 'function' ? tzOptions(st.tz) : [];
  return `<div class="form one pe-form"><label>Name<input data-k="name" value="${esc(st.name)}" placeholder="Anna Smith" autocomplete="off" maxlength="120"></label>`
    + `<div class="pe-two"><label>Role<input data-k="role" value="${esc(st.role)}" placeholder="Maths teacher" maxlength="80"></label><label>Organisation<input data-k="org" value="${esc(st.org)}" placeholder="Northfield School" maxlength="80"></label></div>`
    + `<label>Nickname<input data-k="nick" value="${esc(st.nick)}" placeholder="Short word for +quick-add, e.g. anna" maxlength="40"></label>`
    + `<div class="pe-sec"><b>Email</b><div id="pe-emails">${ctRowsHtml('emails', st.emails)}</div><button type="button" class="btn sm" data-m="add" data-li="emails">${ic('plus', 13)} Add an email</button></div>`
    + `<div class="pe-sec"><b>Phone</b><div id="pe-phones">${ctRowsHtml('phones', st.phones)}</div><button type="button" class="btn sm" data-m="add" data-li="phones">${ic('plus', 13)} Add a number</button></div>`
    + `<div class="pe-two"><label>Website<input data-k="web" value="${esc(st.web)}" placeholder="example.com" maxlength="300"></label><label>Birthday<input data-k="bday" type="date" value="${esc(st.bday)}"></label></div>`
    + `<label>Address<input data-k="addr" value="${esc(st.addr)}" maxlength="300"></label>`
    + `<div class="pe-sec"><b>Available hours</b><small class="hint">When they can be reached. Several stretches a day are fine.</small><div class="pe-presets"><button type="button" class="btn sm" data-m="preset" data-p="work">Mon–Fri 9–5</button><button type="button" class="btn sm" data-m="preset" data-p="copy">Copy the first day to the weekdays</button><button type="button" class="btn sm" data-m="preset" data-p="clear">Clear</button></div><div id="pe-avail">${ctAvailHtml(st.avail)}</div>`
    + `<label>Their time zone<select data-k="tz">${opts([['', 'My own time'], ...z], st.tz)}</select></label><label>About their availability<input data-k="availNote" value="${esc(st.avail.note)}" placeholder="Best by email; no calls after 4" maxlength="200"></label></div>`
    + `<div class="pe-sec"><b>More details</b><div id="pe-extra">${ctExtraHtml(st.extra)}</div><button type="button" class="btn sm" data-m="add" data-li="extra">${ic('plus', 13)} Add a detail</button></div>`
    + `<label>Tags<input data-k="tags" value="${esc(st.tags.map(g => '#' + g).join(' '))}" placeholder="#client #family"></label><label>Notes<textarea data-k="notes" rows="3">${esc(st.notes)}</textarea></label>`
    + `<div class="lbl"><span>Colour</span><div class="sw" data-sw><button type="button" class="${!st.color ? 'on' : ''}" data-c="" title="Automatic" aria-label="Automatic" style="--c:var(--line)"></button>${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === st.color ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div></div></div>`;
}
// reads the open form back into st (before it is redrawn, and when it is saved)
function ctFormRead(m, st) {
  for (const el of $$('[data-k]', m)) { const k = el.dataset.k; if (k === 'tags') st.tags = el.value.split(/[\s,]+/).filter(Boolean); else if (k === 'availNote') st.avail.note = el.value; else st[k] = el.value; }
  for (const key of ['emails', 'phones', 'extra']) st[key] = $$(`[data-li="${key}"][class~="pe-r"]`, m).map(r => ({ l: $('[data-l]', r).value, v: $('[data-v]', r).value }));
  const days = {}; for (let i = 0; i < 7; i++) days[i] = [];
  for (const r of $$('[data-ar]', m)) days[+r.dataset.ar].push([$('[data-s]', r).value, $('[data-e]', r).value]);
  st.avail.days = days; return st;
}
// opens the form; resolves to the saved contact (or null). `quiet`: do not open the profile afterwards (the caller carries on)
function ctEditForm(c, preset = {}, quiet = false) {
  return new Promise(res => {
    const isNew = !c, old = c ? c.name : '', st = JSON.parse(JSON.stringify(c || ctNormalise({ id: uid(), name: '', ...preset }))); st.avail = ctAvailNorm(st.avail);
    const paint = m => { $('.pe-fw', m).innerHTML = ctFormBody(st); };
    const done = v => { closeModal(); res(v); }, cancel = () => { done(null); if (!isNew && !quiet) ctProfile(c.id); };
    openModal(`<h3>${isNew ? 'New contact' : 'Edit contact'}</h3><div class="pe-fw">${ctFormBody(st)}</div><div class="mact"><span class="sp"></span><button type="button" data-m="no">Cancel</button><button type="button" class="pri" data-m="save">${isNew ? 'Add' : 'Save'}</button></div>`, m => {
      const first = $('[data-k=name]', m); if (first && !narrow(700)) first.focus();
      m.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.dataset.k && e.target.type !== 'date') { e.preventDefault(); $('[data-m=save]', m).click(); } };
      m.onclick = e => {
        const sw = e.target.closest('[data-sw] [data-c]'); if (sw) { st.color = sw.dataset.c; $$('[data-sw] [data-c]', m).forEach(x => x.classList.toggle('on', x === sw)); return; }
        const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) cancel(); return; }
        const k = b.dataset.m;
        if (k === 'no') { cancel(); return; }
        ctFormRead(m, st);
        if (k === 'add') { st[b.dataset.li].push(b.dataset.li === 'extra' ? { l: '', v: '' } : { l: CT_LAB[b.dataset.li][0], v: '' }); paint(m); const rows = $$(`[data-li="${b.dataset.li}"][class~="pe-r"] [data-v]`, m); if (rows.length) rows[rows.length - 1].focus(); }
        else if (k === 'rm') { st[b.dataset.li].splice(+b.dataset.i, 1); paint(m); }
        else if (k === 'addr') { const d = +b.dataset.d, r = st.avail.days[d] || (st.avail.days[d] = []), last = r[r.length - 1], s = last ? Math.min(1320, ctMin(last[1]) + 60) : 540; r.push([fromMin(s), fromMin(Math.min(1439, s + (last ? 120 : 480)))]); paint(m); }
        else if (k === 'rmr') { st.avail.days[+b.dataset.d].splice(+b.dataset.i, 1); paint(m); }
        else if (k === 'preset') {
          const p = b.dataset.p, w = ctWeek(), first = st.avail.days[w[0]] || [];
          if (p === 'clear') for (const d of w) st.avail.days[d] = [];
          else if (p === 'work') for (const d of [1, 2, 3, 4, 5]) st.avail.days[d] = [['09:00', '17:00']];
          else if (p === 'copy') { if (!first.length) { toast('Add hours to ' + DAYS[w[0]] + ' first'); return; } for (const d of [1, 2, 3, 4, 5]) st.avail.days[d] = first.map(x => x.slice()); }
          paint(m);
        }
        else if (k === 'save') {
          if (!st.name.trim()) { toast('Give them a name'); return; }
          if (Object.values(st.avail.days).some(r => r.some(([s, e]) => ctHM(s) && ctHM(e) && ctMin(s) >= ctMin(e)))) { toast('Each available stretch must end after it starts'); return; }
          const next = ctNormalise({ ...st, name: st.name.trim() });
          let rec; if (isNew) { S.contacts.push(next); rec = next; } else { Object.assign(c, next); rec = c; if (old && old !== rec.name) ctRenameRefs(old, rec.name); }
          ctTeacherPull(rec); save(); sfx(isNew ? 'add' : 'tick'); done(rec);
          if (!quiet) { if (U.page === 'contacts') renderMain(); ctProfile(rec.id); }
        }
      };
    }, 'wide pe-modal');
  });
}

/* ---------- chips on tasks, notes and classes ---------- */
const ctChip = (c, rm, kind, id, ment) => `<span class="lchip pe-chip${ment ? ' ment' : ''}"><button type="button" class="lc-b" data-act="ctopen" data-id="${esc(c.id)}" title="${ment ? 'Mentioned in the text. ' : ''}Open ${esc(c.name)}">${ctAvatar(c, 18)}<span>${esc(c.name)}</span></button>${rm ? `<button type="button" class="lc-x" data-act="ctunlink" data-k="${kind}" data-id="${esc(id)}" data-cid="${esc(c.id)}" title="Remove" aria-label="Remove ${esc(c.name)}">${ic('x', 12)}</button>` : ''}</span>`;
// the "People" block of the task panel
function ctPeopleHtml(kind, rec) {
  const ps = ctPeople(kind, rec);
  return `<div class="lnks pe-people"><div class="fh"><b>${ic('contact', 14)} People</b>${ps.length ? `<span class="fcnt">${ps.length}</span>` : ''}<button type="button" class="btn sm" data-act="ctpick" data-k="${kind}" data-id="${esc(rec.id)}">${ic('plus', 13)} ${ps.length ? 'Add' : 'Add a person'}</button></div>`
    + (ps.length ? `<div class="lchips">${ps.map(x => ctChip(x.c, x.link, kind, rec.id, !x.link)).join('')}</div>` : '<p class="hint">Link the people this is about. Type +name when you add a task, or @[Name] in the notes.</p>') + '</div>';
}
// the inline row in a note's details
function ctNoteRowHtml(n) {
  const ps = ctPeople('note', n);
  return `<span class="ne-lh">${ic('contact', 14)} People</span>${ps.map(x => ctChip(x.c, x.link, 'note', n.id, !x.link)).join('')}<button type="button" class="btn sm" data-act="ctpick" data-k="note" data-id="${esc(n.id)}">${ic('plus', 13)} ${ps.length ? 'Add' : 'Add a person'}</button>`;
}
// Mention button of the notes toolbar: pick a person, put @[Name] at the caret
function ctMentionPick(ta) {
  const a = ta.selectionStart, b = ta.selectionEnd, put = name => {
    const v = ta.value, pre = a > 0 && /[^\s([{>"']/.test(v[a - 1]) ? ' ' : '', txt = pre + '@[' + name + ']'; ta.value = v.slice(0, a) + txt + v.slice(b); const p = a + txt.length; ta.focus(); ta.setSelectionRange(p, p); ta.dispatchEvent(new Event('input', { bubbles: true }));
  };
  if (!S.contacts.length) { put('Name'); ta.setSelectionRange(a + 2, a + 6); return; }
  ctPickList({ title: 'Mention a person', ph: 'Search people', items: q => S.contacts.filter(c => ctMatch(c, q)).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 60).map(c => ({ id: c.id, html: `<span class="pe-pk">${ctAvatar(c, 22)}${esc(c.name)}</span>`, sub: ctSub(c), on: false })), toggle: id => { const c = ctById(id); if (c) { closeModal(); put(c.name); } }, empty: 'No contacts yet.', newLabel: 'New contact', onNew: async () => { const c = await ctEditForm(null, {}, true); if (c) put(c.name); else ta.focus(); } });
}

/* ---------- mentions in rendered text ---------- */
MD_CONTACT = name => { const c = ctByName(name); return c ? { id: c.id, name: c.name } : null; };
document.addEventListener('click', e => { const m = e.target && e.target.closest && e.target.closest('.ctm[data-ct]'); if (m) { e.preventDefault(); ctProfile(m.dataset.ct); } });
document.addEventListener('keydown', e => { const m = e.target && e.target.classList && e.target.classList.contains('ctm') && e.target.dataset.ct ? e.target : null; if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ctProfile(m.dataset.ct); } });

const CT_ACT = {
  ctadd: () => ctEditForm(null),
  ctopen: el => ctProfile(el.dataset.id),
  ctfilter: el => { S.settings.ct.filter = el.dataset.f; save(); renderMain(); },
  ctreset: () => { S.settings.ct.filter = 'all'; U.ctQ = ''; save(); renderMain(); },
  ctpick: el => ctPickPeople(el.dataset.k, el.dataset.id),
  ctunlink: el => {
    const k = el.dataset.k, id = el.dataset.id, rec = k === 'task' ? getT(id) : k === 'note' ? noteById(id) : null; if (!rec) return;
    ctSetLink(rec, el.dataset.cid, false); sfx('undo'); ctRefreshOwner(k, id);
  },
};
