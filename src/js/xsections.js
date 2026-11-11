/* OpenTick custom sections: a person (or a pack from someone else) makes a new section with its own fields, and it sits in the sidebar and the
   tab bar next to the built-in ones: reading lists, recipes, expenses, gift ideas, anything that is a list of things with details.
   Two synced collections (merged by newest edit, tombstoned on delete, encrypted with everything else):
     S.csections  { id 'x-…', name, icon, color, title (what the name field is called), fields [{ id, name, type, opts }], view 'list' | 'cards' | 'table',
                    checkable (each entry has a tick box), sort { f, dir }, group (a select field's id), pack (the pack it came from), created, u }
     S.centries   { id, sid (the section), title, vals { fieldId: value }, notes (Markdown), done, contactIds, created, u }
   Field types: text · note (long text) · number · date · check · select (opts) · rating (1-5) · url · tags.
   A section is data only: it cannot run anything. That is what makes sharing one safe (packs.js). Its id is its one page, so the existing
   navigation (ui.js: secsAll / navKeys) lists it, orders it, pins and hides it like any other section.
   The normalisers are function declarations on purpose: migrate() calls them while core.js is still loading, so they only use function declarations. */
function xsStr(v, n) { return String(v == null ? '' : v).trim().slice(0, n); }
function xsFid() { return 'f' + Math.random().toString(36).slice(2, 7); }
function xsNormalise(s) {
  s.name = xsStr(s.name, 40) || 'Section'; s.icon = typeof s.icon === 'string' ? s.icon.slice(0, 40) : ''; s.color = typeof s.color === 'string' && s.color ? s.color.slice(0, 20) : '#4772fa';
  s.title = xsStr(s.title, 30) || 'Name';
  const seen = {}, types = ['text', 'note', 'number', 'date', 'check', 'select', 'rating', 'url', 'tags'];
  s.fields = (Array.isArray(s.fields) ? s.fields : []).filter(f => f && typeof f === 'object').slice(0, 24).map(f => {
    let id = /^[\w-]{1,24}$/.test(f.id || '') ? f.id : xsFid(); while (seen[id]) id = xsFid(); seen[id] = 1;
    const type = types.includes(f.type) ? f.type : 'text';
    return type === 'select' ? { id, name: xsStr(f.name, 40) || 'Field', type, opts: [...new Set((Array.isArray(f.opts) ? f.opts : []).map(o => xsStr(o, 40)).filter(Boolean))].slice(0, 30) } : { id, name: xsStr(f.name, 40) || 'Field', type };
  });
  s.view = ['list', 'cards', 'table'].includes(s.view) ? s.view : 'list'; s.checkable = !!s.checkable;
  const so = s.sort && typeof s.sort === 'object' ? s.sort : {}; s.sort = { f: typeof so.f === 'string' && so.f ? so.f.slice(0, 24) : 'created', dir: so.dir === 'asc' ? 'asc' : 'desc' };
  s.group = typeof s.group === 'string' && s.fields.some(f => f.id === s.group && (f.type === 'select' || f.type === 'check')) ? s.group : '';
  s.pack = typeof s.pack === 'string' ? s.pack.slice(0, 60) : ''; s.created = s.created || Date.now();
  return s;
}
function xeNormalise(e) {
  e.sid = typeof e.sid === 'string' ? e.sid : ''; e.title = xsStr(e.title, 200); e.notes = typeof e.notes === 'string' ? e.notes.slice(0, 20000) : '';
  const v = e.vals && typeof e.vals === 'object' && !Array.isArray(e.vals) ? e.vals : {}, out = {};
  for (const k of Object.keys(v).slice(0, 40)) { const x = v[k]; if (typeof x === 'string') out[k] = x.slice(0, 5000); else if (typeof x === 'number' && isFinite(x)) out[k] = x; else if (typeof x === 'boolean') out[k] = x; else if (Array.isArray(x)) out[k] = x.map(y => xsStr(y, 40)).filter(Boolean).slice(0, 20); }
  e.vals = out; e.done = !!e.done; e.contactIds = ctIds(e.contactIds); e.created = e.created || Date.now();
  return e;
}

const XS_TYPES = [['text', 'Text', 'A short line'], ['note', 'Long text', 'Several lines'], ['number', 'Number', 'Amounts, counts, prices'], ['date', 'Date', 'A day'], ['check', 'Tick box', 'Yes or no'], ['select', 'Choice', 'One of your own options'], ['rating', 'Rating', 'One to five stars'], ['url', 'Link', 'A web address'], ['tags', 'Tags', 'Several words']];
const XS_TYPE_NAME = Object.fromEntries(XS_TYPES.map(t => [t[0], t[1]]));
const csecEntries = () => S.csections.map(s => [s.id, s.name, s.icon || 'layers', [s.id]]); // what ui.js adds to SECTIONS
const csecOn = page => S.csections.some(s => s.id === page);
const xsById = id => S.csections.find(s => s.id === id) || null;
const xsEntries = s => S.centries.filter(e => e.sid === s.id);
const xsEntryById = id => S.centries.find(e => e.id === id) || null;
const xsField = (s, id) => s.fields.find(f => f.id === id) || null;

/* ---------- templates: the quick way to start ---------- */
const XS_TEMPLATES = [
  { id: 'blank', name: 'Blank', icon: 'layers', color: '#4772fa', desc: 'Start with nothing and add the fields you want.', title: 'Name', fields: [] },
  { id: 'reading', name: 'Reading list', icon: 'book-open', color: '#8e5cf7', desc: 'Books and articles with a status and a rating.', title: 'Title', view: 'cards', group: 'Status', fields: [{ name: 'Author', type: 'text' }, { name: 'Status', type: 'select', opts: ['To read', 'Reading', 'Finished'] }, { name: 'Rating', type: 'rating' }, { name: 'Link', type: 'url' }] },
  { id: 'watch', name: 'Watchlist', icon: 'film', color: '#e5484d', desc: 'Films and series to watch, and what you thought.', title: 'Title', view: 'list', checkable: true, fields: [{ name: 'Kind', type: 'select', opts: ['Film', 'Series', 'Documentary'] }, { name: 'Where', type: 'text' }, { name: 'Rating', type: 'rating' }] },
  { id: 'gifts', name: 'Gift ideas', icon: 'gift', color: '#e255a1', desc: 'Who it is for, what it costs, whether it is bought.', title: 'Idea', view: 'table', fields: [{ name: 'For', type: 'text' }, { name: 'Price', type: 'number' }, { name: 'Link', type: 'url' }, { name: 'Bought', type: 'check' }] },
  { id: 'recipes', name: 'Recipes', icon: 'utensils', color: '#f4a62a', desc: 'Dishes to cook with time, servings and a source.', title: 'Dish', view: 'cards', fields: [{ name: 'Minutes', type: 'number' }, { name: 'Serves', type: 'number' }, { name: 'Source', type: 'url' }, { name: 'Ingredients', type: 'note' }] },
  { id: 'expenses', name: 'Expenses', icon: 'wallet', color: '#34b36b', desc: 'Money spent, by date and category.', title: 'What for', view: 'table', sort: { f: 'Date', dir: 'desc' }, fields: [{ name: 'Amount', type: 'number' }, { name: 'Date', type: 'date' }, { name: 'Category', type: 'select', opts: ['Food', 'Travel', 'Bills', 'Fun', 'Other'] }] },
  { id: 'workouts', name: 'Workout log', icon: 'dumbbell', color: '#12a9c7', desc: 'Sessions with how long and how it felt.', title: 'Session', view: 'list', sort: { f: 'Date', dir: 'desc' }, fields: [{ name: 'Date', type: 'date' }, { name: 'Type', type: 'select', opts: ['Run', 'Gym', 'Swim', 'Walk', 'Yoga'] }, { name: 'Minutes', type: 'number' }, { name: 'Felt', type: 'rating' }] },
  { id: 'places', name: 'Places to visit', icon: 'map', color: '#458588', desc: 'Somewhere to go one day, ticked off when you have.', title: 'Place', view: 'list', checkable: true, fields: [{ name: 'Where', type: 'text' }, { name: 'Link', type: 'url' }] },
];
// a template (or a pack's section) as a section record: field names stand in for ids until here, so group and sort can name a field
function xsFromTemplate(t) {
  const fields = (t.fields || []).map(f => ({ ...f, id: xsFid() })), byName = n => (fields.find(f => f.name === n) || {}).id || '';
  return xsNormalise({ id: 'x-' + uid(), name: t.name === 'Blank' ? 'My section' : t.name, icon: t.icon, color: t.color, title: t.title, fields, view: t.view || 'list', checkable: !!t.checkable, group: t.group ? byName(t.group) : '', sort: t.sort && t.sort.f && t.sort.f !== 'created' && t.sort.f !== 'title' ? { f: byName(t.sort.f), dir: t.sort.dir } : t.sort || {}, created: Date.now() });
}

/* ---------- values ---------- */
const xsStars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const xsHost = u => { try { return new URL(/^[a-z]+:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
// a note as one line of plain text (for a card): Markdown marks and @[mention] brackets are taken out
const xsNoteLine = t => String(t || '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/@\[([^\]]+)\]/g, '@$1').replace(/[*_`~>#]+/g, '').replace(/\s+/g, ' ').trim();
const xsHref = u => { const x = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u; return /^https?:\/\//i.test(x) ? x : ''; };
function xsShow(f, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
  if (f.type === 'check') return v ? `<span class="xs-ok">${ic('check', 14)}</span>` : '';
  if (f.type === 'rating') return `<span class="xs-st" role="img" aria-label="${+v} out of 5">${xsStars(Math.max(0, Math.min(5, +v || 0)))}</span>`;
  if (f.type === 'date') return /^\d{4}-\d\d-\d\d$/.test(v) ? esc(fmtDate(v)) : esc(v);
  if (f.type === 'url') { const h = xsHref(String(v)); return h ? `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer">${esc(xsHost(String(v)))}</a>` : esc(v); }
  if (f.type === 'select') return `<span class="xs-chip">${esc(v)}</span>`;
  if (f.type === 'tags') return (Array.isArray(v) ? v : []).map(g => `<span class="tag">#${esc(g)}</span>`).join(' ');
  if (f.type === 'number') return esc(typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : v);
  if (f.type === 'note') return esc(String(v).replace(/\s+/g, ' ').slice(0, 140));
  return esc(v);
}
const xsPlain = (f, v) => (f.type === 'check' ? (v ? 'Yes' : '') : Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v));
// compare two entries on a field (empty values always sort last)
function xsCmp(s, a, b) {
  const k = s.sort.f, dir = s.sort.dir === 'asc' ? 1 : -1;
  let x, y, empty;
  if (k === 'created') { x = a.created; y = b.created; } else if (k === 'title') { x = a.title.toLowerCase(); y = b.title.toLowerCase(); } else {
    const f = xsField(s, k); if (!f) return 0; x = a.vals[k]; y = b.vals[k]; empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);
    if (empty(x) !== empty(y)) return empty(x) ? 1 : -1; if (empty(x)) return 0;
    if (f.type === 'select') { x = f.opts.indexOf(x); y = f.opts.indexOf(y); } else if (f.type === 'check') { x = x ? 1 : 0; y = y ? 1 : 0; } else if (Array.isArray(x)) { x = x.join(' '); y = y.join(' '); } else if (typeof x === 'string') { x = x.toLowerCase(); y = String(y).toLowerCase(); }
  }
  return x < y ? -dir : x > y ? dir : 0;
}
function xsVisible(s) {
  const q = ((U.xsQ || {})[s.id] || '').trim().toLowerCase();
  let l = xsEntries(s); if (q) l = l.filter(e => (e.title + ' ' + e.notes + ' ' + s.fields.map(f => xsPlain(f, e.vals[f.id])).join(' ') + ' ' + ctOf(e).map(c => c.name).join(' ')).toLowerCase().includes(q));
  return l.sort((a, b) => (s.checkable && a.done !== b.done ? (a.done ? 1 : -1) : 0) || xsCmp(s, a, b) || a.created - b.created);
}

/* ---------- the page ---------- */
const xsPeople = e => { const ps = ctOf(e); return ps.length ? `<span class="xs-pp">${ps.slice(0, 3).map(c => `<span title="${esc(c.name)}">${ctAvatar(c, 18)}</span>`).join('')}${ps.length > 3 ? `<small>+${ps.length - 3}</small>` : ''}</span>` : ''; };
function xsEntryHtml(s, e) {
  const tick = s.checkable ? `<button type="button" class="chk${e.done ? ' on' : ''}" data-act="xsdone" data-id="${esc(e.id)}" aria-label="${e.done ? 'Mark as not done' : 'Mark as done'}" aria-pressed="${!!e.done}">${e.done ? ic('check', 13) : ''}</button>` : '';
  const vals = s.fields.map(f => [f, xsShow(f, e.vals[f.id])]).filter(x => x[1]);
  if (s.view === 'cards') return `<article class="xs-card${e.done ? ' fin' : ''}" style="--c:${esc(s.color)}" data-eid="${esc(e.id)}"><div class="xs-ch">${tick}<button type="button" class="xs-t" data-act="xsedit" data-id="${esc(e.id)}"><b>${esc(e.title || 'Untitled')}</b></button>${xsPeople(e)}</div>${vals.length ? `<dl class="xs-dl">${vals.map(([f, h]) => `<div><dt>${esc(f.name)}</dt><dd>${h}</dd></div>`).join('')}</dl>` : ''}${e.notes ? `<p class="xs-n">${esc(xsNoteLine(e.notes).slice(0, 160))}</p>` : ''}</article>`;
  return `<div class="xs-row${e.done ? ' fin' : ''}" data-eid="${esc(e.id)}">${tick}<button type="button" class="xs-t" data-act="xsedit" data-id="${esc(e.id)}"><b>${esc(e.title || 'Untitled')}</b><span class="xs-v">${vals.slice(0, 4).map(([f, h]) => `<span title="${esc(f.name)}">${h}</span>`).join('')}</span></button>${xsPeople(e)}</div>`;
}
function xsTableHtml(s, l) {
  return `<div class="xs-tw"><table class="xs-tb"><thead><tr>${s.checkable ? '<th class="xs-c"></th>' : ''}<th>${esc(s.title)}</th>${s.fields.map(f => `<th>${esc(f.name)}</th>`).join('')}<th class="xs-c"></th></tr></thead><tbody>${l.map(e => `<tr class="${e.done ? 'fin' : ''}" data-eid="${esc(e.id)}">${s.checkable ? `<td class="xs-c"><button type="button" class="chk${e.done ? ' on' : ''}" data-act="xsdone" data-id="${esc(e.id)}" aria-label="${e.done ? 'Mark as not done' : 'Mark as done'}" aria-pressed="${!!e.done}">${e.done ? ic('check', 13) : ''}</button></td>` : ''}<td><button type="button" class="xs-t" data-act="xsedit" data-id="${esc(e.id)}"><b>${esc(e.title || 'Untitled')}</b></button></td>${s.fields.map(f => `<td>${xsShow(f, e.vals[f.id])}</td>`).join('')}<td class="xs-c">${xsPeople(e)}</td></tr>`).join('')}</tbody></table></div>`;
}
function xsBodyHtml(s) {
  const l = xsVisible(s), all = xsEntries(s).length;
  if (!l.length) return `<div class="empty">${iconAny(s.icon, 40, 'layers')}<p>${all ? 'Nothing matches this search.' : `Nothing in ${esc(s.name)} yet.`}</p>${all ? '' : `<button class="btn pri" data-act="xsadd">${ic('plus', 15)} Add the first one</button>`}</div>`;
  const wrap = a => (s.view === 'table' ? xsTableHtml(s, a) : `<div class="${s.view === 'cards' ? 'xs-grid' : 'xs-list'}">${a.map(e => xsEntryHtml(s, e)).join('')}</div>`), g = xsField(s, s.group);
  if (!g) return wrap(l);
  const keys = g.type === 'check' ? [true, false] : [...g.opts, ''], lab = k => (g.type === 'check' ? (k ? g.name : 'Not ' + g.name.toLowerCase()) : k || 'No ' + g.name.toLowerCase());
  return keys.map(k => { const part = l.filter(e => (g.type === 'check' ? !!e.vals[g.id] === k : (e.vals[g.id] || '') === k)); return part.length ? `<h3 class="hh xs-h">${esc(lab(k))}<span class="fcnt">${part.length}</span></h3>${wrap(part)}` : ''; }).join('');
}
function renderCustomSection() {
  const s = xsById(U.page); if (!s) { U.page = 'tasks'; renderMain(); return; }
  const views = [['list', 'List', 'list'], ['cards', 'Cards', 'grid'], ['table', 'Table', 'table']], sorts = [['created', 'Newest added'], ['title', s.title], ...s.fields.filter(f => f.type !== 'note').map(f => [f.id, f.name])];
  const groups = [['', 'No grouping'], ...s.fields.filter(f => f.type === 'select' || f.type === 'check').map(f => [f.id, 'Group by ' + f.name])];
  const tools = `<div class="seg" role="group" aria-label="View">${views.map(([k, n, i]) => `<button type="button" class="${s.view === k ? 'on' : ''}" data-act="xsview" data-v="${k}" title="${n}" aria-label="${n}" aria-pressed="${s.view === k}">${ic(i, 15)}</button>`).join('')}</div>`
    + `<select data-xsf="sort" title="Sort by" aria-label="Sort by">${opts(sorts, s.sort.f)}</select><button class="ib" data-act="xsdir" title="${s.sort.dir === 'asc' ? 'Ascending' : 'Descending'}" aria-label="Reverse the order">${ic(s.sort.dir === 'asc' ? 'arrow-up' : 'arrow-down', 16)}</button>`
    + `<button class="ib" data-act="xsset" title="Edit this section" aria-label="Edit this section">${ic('sliders', 18)}</button><button class="btn pri" data-act="xsadd">${ic('plus', 16)}<span class="hide-m"> Add</span></button>`;
  $('#main').innerHTML = topHtml(esc(s.name), tools)
    + `<div class="body xs-body"><div class="pe-filters"><div class="search hs">${ic('search', 16)}<input id="xs-q" placeholder="Search ${esc(s.name)}" autocomplete="off" value="${esc((U.xsQ || {})[s.id] || '')}"></div>${groups.length > 1 ? `<select data-xsf="group" aria-label="Group">${opts(groups, s.group)}</select>` : ''}</div><div id="xs-list">${xsBodyHtml(s)}</div></div>`;
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'xs-q') { const s = xsById(U.page); if (!s) return; (U.xsQ = U.xsQ || {})[s.id] = e.target.value; const l = $('#xs-list'); if (l) l.innerHTML = xsBodyHtml(s); } });
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || el.dataset.xsf === undefined) return; const s = xsById(U.page); if (!s) return;
  if (el.dataset.xsf === 'sort') s.sort = { ...s.sort, f: el.value }; else if (el.dataset.xsf === 'group') s.group = el.value;
  save(); renderMain();
});

/* ---------- an entry ---------- */
const xsInput = (f, v) => {
  const id = 'xv-' + f.id, lab = esc(f.name);
  if (f.type === 'check') return `<label class="chkl"><input type="checkbox" data-xv="${f.id}"${v ? ' checked' : ''}> ${lab}</label>`;
  if (f.type === 'note') return `<label><span>${lab}</span><textarea data-xv="${f.id}" rows="3">${esc(v || '')}</textarea></label>`;
  if (f.type === 'select') return `<label><span>${lab}</span><select data-xv="${f.id}">${opts([['', '—'], ...f.opts.map(o => [o, o])], v || '')}</select></label>`;
  if (f.type === 'rating') { const n = +v || 0; return `<div class="lbl"><span>${lab}</span><div class="xs-rate" data-xr="${f.id}" data-v="${n}" role="radiogroup" aria-label="${lab}">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="${i <= n ? 'on' : ''}" data-star="${i}" role="radio" aria-checked="${i === n}" aria-label="${i} star${i > 1 ? 's' : ''}">${ic('star', 20)}</button>`).join('')}<button type="button" class="btn sm" data-star="0">Clear</button></div></div>`; }
  if (f.type === 'tags') return `<label><span>${lab}</span><input data-xv="${f.id}" value="${esc((Array.isArray(v) ? v : []).map(g => '#' + g).join(' '))}" placeholder="#one #two"></label>`;
  return `<label><span>${lab}</span><input id="${id}" data-xv="${f.id}" type="${{ number: 'number', date: 'date', url: 'url' }[f.type] || 'text'}"${f.type === 'number' ? ' step="any"' : ''} value="${esc(v == null ? '' : v)}" autocomplete="off"></label>`;
};
function xsReadEntry(m, s, st) {
  st.title = $('[data-k=title]', m).value; st.notes = $('[data-k=notes]', m).value; st.vals = {};
  for (const f of s.fields) {
    let v;
    if (f.type === 'rating') { const r = $(`[data-xr="${f.id}"]`, m); v = r ? +r.dataset.v || 0 : 0; if (!v) continue; }
    else { const el = $(`[data-xv="${f.id}"]`, m); if (!el) continue; v = f.type === 'check' ? el.checked : f.type === 'number' ? (el.value === '' ? '' : +el.value) : f.type === 'tags' ? el.value.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean) : el.value; }
    if (v !== '' && v !== false && !(Array.isArray(v) && !v.length)) st.vals[f.id] = v;
  }
  st.contactIds = $$('[data-cp]:checked', m).map(x => x.dataset.cp); st.done = $('[data-k=done]', m) ? $('[data-k=done]', m).checked : st.done;
  return st;
}
function xsEditEntry(s, e, preset = {}) {
  const isNew = !e, st = JSON.parse(JSON.stringify(e || xeNormalise({ id: uid(), sid: s.id, title: '', ...preset })));
  const people = S.contacts.length ? `<details class="pe-pp"${st.contactIds.length ? ' open' : ''}><summary>${ic('contact', 14)} People${st.contactIds.length ? ` <span class="fcnt">${st.contactIds.length}</span>` : ''}</summary><div class="pe-pl">${S.contacts.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<label class="chkl"><input type="checkbox" data-cp="${esc(c.id)}"${st.contactIds.includes(c.id) ? ' checked' : ''}> ${ctAvatar(c, 18)} ${esc(c.name)}</label>`).join('')}</div></details>` : '';
  openModal(`<h3>${isNew ? 'New entry' : 'Edit entry'} · ${esc(s.name)}</h3><div class="form one xs-form"><label><span>${esc(s.title)}</span><input data-k="title" value="${esc(st.title)}" autocomplete="off" maxlength="200"></label>${s.checkable ? `<label class="chkl"><input type="checkbox" data-k="done"${st.done ? ' checked' : ''}> Done</label>` : ''}${s.fields.map(f => xsInput(f, st.vals[f.id])).join('')}<label><span>Notes</span><textarea data-k="notes" rows="3" placeholder="Markdown works here. Mention a person with @[Name].">${esc(st.notes)}</textarea></label>${people}</div><div class="mact">${isNew ? '' : '<button type="button" class="danger" data-m="del">Delete</button>'}<span class="sp"></span><button type="button" data-m="no">Cancel</button><button type="button" class="pri" data-m="save">${isNew ? 'Add' : 'Save'}</button></div>`, m => {
    const first = $('[data-k=title]', m); if (first && !narrow(700)) first.focus();
    m.onkeydown = e2 => { if (e2.key === 'Enter' && e2.target.tagName === 'INPUT' && e2.target.type !== 'checkbox' && e2.target.type !== 'date') { e2.preventDefault(); $('[data-m=save]', m).click(); } };
    m.onclick = async e2 => {
      const star = e2.target.closest('[data-star]'); if (star) { const r = star.closest('[data-xr]'), n = +star.dataset.star; r.dataset.v = n; $$('[data-star]', r).forEach(b => { const i = +b.dataset.star; if (i) { b.classList.toggle('on', i <= n); b.setAttribute('aria-checked', String(i === n)); } }); return; }
      const b = e2.target.closest('[data-m]'); if (!b) { if (e2.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'del') { if (await askConfirm('Delete this entry?')) { S.centries = S.centries.filter(x => x !== e); save(); closeModal(); sfx('undo'); renderMain(); } }
      else if (b.dataset.m === 'save') {
        xsReadEntry(m, s, st); if (!st.title.trim() && !Object.keys(st.vals).length && !st.notes.trim()) { toast('Fill in at least a ' + s.title.toLowerCase()); return; }
        st.title = st.title.trim(); xeNormalise(st);
        if (isNew) { S.centries.push(st); sfx('add'); } else Object.assign(e, st);
        save(); closeModal(); renderMain();
      }
    };
  }, 'wide');
}

/* ---------- making and changing a section ---------- */
function xsNew() { // step one: pick a starting point
  openModal(`<h3>New section</h3><p class="hint">A section is a list of things with the details you choose. Pick a starting point; everything can be changed after.</p><div class="xs-tpls">${XS_TEMPLATES.map(t => `<button type="button" class="xs-tpl" style="--c:${t.color}" data-tpl="${t.id}"><span>${iconAny(t.icon, 22)}</span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('')}</div>${typeof packsImportHtml === 'function' ? packsImportHtml() : ''}<div class="mact"><span class="sp"></span><button type="button" data-m="no">Cancel</button></div>`, m => {
    m.onclick = e => {
      const t = e.target.closest('[data-tpl]'); if (t) { closeModal(); xsEditSection(null, xsFromTemplate(XS_TEMPLATES.find(x => x.id === t.dataset.tpl))); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') closeModal(); else if (typeof packsHandle === 'function') packsHandle(b, m);
    };
  }, 'wide xs-modal');
}
function xsFieldRows(st) {
  return st.fields.map((f, i) => `<div class="xs-fr" data-fr="${i}"><input data-fn value="${esc(f.name)}" placeholder="Field name" maxlength="40" aria-label="Field name"><select data-ft aria-label="Field type">${opts(XS_TYPES.map(t => [t[0], t[1]]), f.type)}</select><span class="xs-fb"><button type="button" class="ib sm" data-m="fup" data-i="${i}"${i ? '' : ' disabled'} title="Move up" aria-label="Move up">${ic('up', 14)}</button><button type="button" class="ib sm" data-m="fdn" data-i="${i}"${i < st.fields.length - 1 ? '' : ' disabled'} title="Move down" aria-label="Move down">${ic('down', 14)}</button><button type="button" class="ib sm" data-m="frm" data-i="${i}" title="Remove this field" aria-label="Remove field">${ic('x', 14)}</button></span>${f.type === 'select' ? `<input class="xs-fo" data-fo value="${esc((f.opts || []).join(', '))}" placeholder="Options, separated by commas" aria-label="Options">` : ''}</div>`).join('');
}
function xsSectionBody(st, isNew) {
  return `<div class="form one"><label><span>Name</span><input data-k="name" value="${esc(st.name)}" maxlength="40" autocomplete="off"></label>`
    + `<div class="lbl"><span>Icon</span><button type="button" class="btn fd-ic" data-m="icon">${iconAny(st.icon, 18, 'layers')}<span>${st.icon ? 'Change icon' : 'Choose an icon'}</span></button></div>`
    + `<div class="lbl"><span>Colour</span><div class="sw" data-sw>${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === st.color ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div></div>`
    + `<label><span>What each entry is called</span><input data-k="title" value="${esc(st.title)}" maxlength="30" placeholder="Title, Name, Dish…"></label>`
    + `<div class="pe-sec"><b>Fields</b><small class="hint">The details every entry can have.</small><div id="xs-fields">${xsFieldRows(st)}</div><button type="button" class="btn sm" data-m="fadd">${ic('plus', 13)} Add a field</button></div>`
    + `<label class="chkl"><input type="checkbox" data-k="checkable"${st.checkable ? ' checked' : ''}> Each entry has a tick box (like a to-do)</label>`
    + `<label><span>Show entries as</span><select data-k="view">${opts([['list', 'A list'], ['cards', 'Cards'], ['table', 'A table']], st.view)}</select></label>${st.pack ? `<p class="hint">From the pack “${esc(st.pack)}”.</p>` : ''}</div>`;
}
function xsReadSection(m, st) {
  st.name = $('[data-k=name]', m).value; st.title = $('[data-k=title]', m).value; st.checkable = $('[data-k=checkable]', m).checked; st.view = $('[data-k=view]', m).value;
  st.fields = $$('[data-fr]', m).map((r, i) => { const old = st.fields[i] || {}, type = $('[data-ft]', r).value, o = $('[data-fo]', r); return { id: old.id, name: $('[data-fn]', r).value, type, ...(type === 'select' ? { opts: o ? o.value.split(',').map(x => x.trim()).filter(Boolean) : old.opts || [] } : {}) }; });
  return st;
}
// step two: the section itself. `draft` carries what was typed across the icon picker.
function xsEditSection(s, draft) {
  const isNew = !s, st = draft || JSON.parse(JSON.stringify(s));
  const paint = m => { $('#xs-body', m).innerHTML = xsSectionBody(st, isNew); };
  openModal(`<h3>${isNew ? 'New section' : 'Edit section'}</h3><div id="xs-body">${xsSectionBody(st, isNew)}</div><div class="mact">${isNew ? '' : '<button type="button" class="danger" data-m="del">Delete</button><button type="button" data-m="export">Export…</button>'}<span class="sp"></span><button type="button" data-m="no">Cancel</button><button type="button" class="pri" data-m="save">${isNew ? 'Create' : 'Save'}</button></div>`, m => {
    const first = $('[data-k=name]', m); if (first && !narrow(700)) { first.focus(); if (isNew) first.select(); }
    m.onchange = e => { if (e.target.matches && e.target.matches('[data-ft]')) { xsReadSection(m, st); paint(m); } }; // a field turned into a Choice gets its options box
    m.onclick = async e => {
      const sw = e.target.closest('[data-sw] [data-c]'); if (sw) { st.color = sw.dataset.c; $$('[data-sw] [data-c]', m).forEach(x => x.classList.toggle('on', x === sw)); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      const k = b.dataset.m; if (k === 'no') { closeModal(); return; }
      xsReadSection(m, st);
      if (k === 'icon') { const p = await pickIcon(st.icon || '', st.color); if (p !== null) st.icon = p; xsEditSection(s, st); }
      else if (k === 'fadd') { if (st.fields.length >= 24) { toast('That is the most fields a section can have'); return; } st.fields.push({ id: xsFid(), name: '', type: 'text' }); paint(m); const r = $$('[data-fn]', m); r[r.length - 1].focus(); }
      else if (k === 'frm') { const f = st.fields[+b.dataset.i], used = s && xsEntries(s).filter(en => f && en.vals[f.id] != null).length; if (used && !(await askConfirm(`${used} ${used === 1 ? 'entry has' : 'entries have'} a value in “${f.name || 'this field'}”. Remove the field and those values?`, 'Remove'))) { xsEditSection(s, st); return; } st.fields.splice(+b.dataset.i, 1); paint(m); }
      else if (k === 'fup' || k === 'fdn') { const i = +b.dataset.i, j = i + (k === 'fup' ? -1 : 1); if (j >= 0 && j < st.fields.length) { [st.fields[i], st.fields[j]] = [st.fields[j], st.fields[i]]; paint(m); } }
      else if (k === 'export') { closeModal(); if (typeof packsExportSection === 'function') packsExportSection(s); }
      else if (k === 'del') { const n = xsEntries(s).length; if (await askConfirm(`Delete “${s.name}”${n ? ` and its ${n} ${n === 1 ? 'entry' : 'entries'}` : ''}? This cannot be undone.`, 'Delete')) { xsDelete(s); closeModal(); } }
      else if (k === 'save') {
        if (!st.name.trim()) { toast('Give the section a name'); return; }
        if (st.fields.some(f => !f.name.trim())) { toast('Give every field a name, or remove it'); return; }
        st.name = st.name.trim(); xsNormalise(st);
        if (isNew) { S.csections.push(st); U.page = st.id; U.pinKey = null; }
        else { // a field taken out takes its values with it
          const gone = s.fields.map(f => f.id).filter(id => !st.fields.some(f => f.id === id)); if (gone.length) for (const en of xsEntries(s)) for (const id of gone) delete en.vals[id];
          Object.assign(s, st);
        }
        save(); closeModal(); sfx(isNew ? 'add' : 'tick'); render(); if (isNew) toast('Section added');
      }
    };
  }, 'wide xs-modal');
}
function xsDelete(s) {
  S.centries = S.centries.filter(e => e.sid !== s.id); S.csections = S.csections.filter(x => x !== s);
  const u = S.settings.ui; u.navOrder = (u.navOrder || []).filter(k => k !== 'sec:' + s.id); u.hidePages = (u.hidePages || []).filter(k => k !== s.id);
  if (U.page === s.id) { U.page = 'tasks'; U.nav = 'today'; } save(); sfx('undo'); toast('Section deleted'); render();
}

const XS_ACT = {
  xsnew: () => xsNew(),
  xsadd: () => { const s = xsById(U.page); if (s) xsEditEntry(s, null); },
  xsedit: el => { const e = xsEntryById(el.dataset.id), s = e && xsById(e.sid); if (s) xsEditEntry(s, e); },
  xsdone: el => { const e = xsEntryById(el.dataset.id); if (e) { e.done = !e.done; save(); sfx(e.done ? 'done' : 'tick'); renderMain(); } },
  xsset: () => { const s = xsById(U.page); if (s) xsEditSection(s); },
  xsview: el => { const s = xsById(U.page); if (s) { s.view = el.dataset.v; save(); renderMain(); } },
  xsdir: () => { const s = xsById(U.page); if (s) { s.sort = { ...s.sort, dir: s.sort.dir === 'asc' ? 'desc' : 'asc' }; save(); renderMain(); } },
};
