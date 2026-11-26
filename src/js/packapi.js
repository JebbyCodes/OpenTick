/* OpenTick pack API (0.9.1): the ONLY way a pack's declared actions touch the rest of the app. A pack is data: it cannot run anything, so what it "does" is
   something OpenTick does FOR it when the person presses an action button on an entry, opens an entry's related panel, or a pack reminder comes due.
   This file defines (1) which targets and capabilities exist, with the plain sentence that is shown to the person for each; (2) the API, where every call
   starts with pkCan() (packperm.js), returns copies of data cut down to the granted fields (never a live record, never the whole record), and writes one
   audit event; (3) the declarative actions and the related panel a section can carry, and the code that runs them.
   There is no target for settings, credentials, keys, files or other packs' private state, so nothing here can reach them. What the API does not implement
   has no capability, and a manifest that asks for it is refused (packPermsClean).
   Records a pack made are recorded by the app (an audit event with op 'create'): that, never a claim in the pack, is what "pack-created" means. Links
   (entry.links = [{ t, id }]) live on the pack's own entries and are what "pack-linked" means.
   Function declarations are used for what core.js's migrate() reaches while the bundle loads; the rest may use consts. */

/* ---------- what is in a record, as far as the API is concerned ---------- */
const PKA_FIELDS = {
  tasks: { title: t => t.title, status: t => t.status, 'due-date': t => t.due || null, priority: t => t.priority || 0, tags: t => (t.tags || []).slice() },
  notes: { title: n => n.title, tags: n => (n.tags || []).slice(), updated: n => n.updated || 0 },
  habits: { title: h => h.name },
  projects: { title: p => p.name },
  pack: { title: e => e.title, done: e => !!e.done },
};
const PKA_DETAIL = { tasks: { notes: t => t.notes || '', subtasks: t => (t.subtasks || []).map(s => ({ title: s.title, done: !!s.done })) }, notes: { body: n => n.body || '' } };
const pkaList = (kind, id) => {
  if (kind === 'tasks') return S.tasks.filter(t => !t.deleted && !t.log);
  if (kind === 'notes') return S.notes.slice(); if (kind === 'habits') return S.habits.slice(); if (kind === 'projects') return S.projects.slice();
  const m = /^pack:(.+)$/.exec(kind); if (m) { const ids = new Set(S.csections.filter(s => s.packId === m[1]).map(s => s.id)); return S.centries.filter(e => ids.has(e.sid)); }
  return [];
};
const pkaKind = target => (target.startsWith('pack:') ? 'pack' : target);
const pkaFind = (target, id) => pkaList(target).find(r => r.id === id) || null;
const pkaFieldWords = (f, d = 'nothing') => { const l = (f || []).map(x => x.replace('-', ' ')); return l.length ? (l.length === 1 ? l[0] : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]) : d; };
const pkaRecWords = s => (s && s.records === 'pack-linked' ? 'that this pack made or is linked to' : 'that this pack made');
const pkaCap = (kind, title, describe, x = {}) => ({ kind, title, describe, ...x }); // (one capability: what kind of thing it is, its title, the sentence the person reads, and its limits)

function pkaStd(noun, plural, o = {}) { // the capabilities that tasks and notes share, with the words of each
  return {
    discover_section: pkaCap('discover', `Find out that ${plural} exist`, () => `See that the ${plural} section exists and what it is called. Nothing inside it.`),
    discover_fields: pkaCap('discover', `See what a ${noun} is made of`, () => `See the names and kinds of the fields a ${noun} has (like “title” or “due date”). No ${noun} itself.`),
    list_records: pkaCap('read', `Count your ${plural}`, () => `Get the list of your ${plural} as a list of ids and nothing about what is in them.`),
    search_records: pkaCap('read', `Search ${plural}`, s => `Look for ${plural} by their ${pkaFieldWords(s.fields)}. It gets back which ones match and their ${pkaFieldWords(s.fields)}, nothing else.`, { fields: o.search, defFields: ['title'] }),
    view_record_summary: pkaCap('read', `See a few details of a ${noun}`, s => `Read ${pkaFieldWords(s.fields)} of the ${plural} it finds or is linked to. Not the rest.`, { fields: o.summary, defFields: o.summaryDef }),
    ...(o.detail ? { view_record_details: pkaCap('read', `Read a ${noun} in full`, () => `Read everything in a ${noun}: ${o.detail}.`) } : {}),
    create_record: pkaCap('create', `Add ${plural}`, () => `Create new ${plural} for you. It cannot read or change the ones you already have.`),
    update_specific_fields: pkaCap('modify', `Change some fields of its ${plural}`, s => `Change only the ${pkaFieldWords(s.fields)} of ${plural} ${pkaRecWords(s)}. Not your other ${plural}.`, { fields: o.update, defFields: o.updateDef, records: ['pack-created', 'pack-linked'] }),
    delete_own_records: pkaCap('delete', `Delete the ${plural} it made`, () => `Move ${plural} that this pack made to the trash. It cannot delete anything else, and never deletes for good.`, { records: ['pack-created'] }),
    link_records: pkaCap('link', `Link entries to ${plural}`, () => `Connect its own entries to ${plural} you choose or find. It does not get to read them unless you allow that separately.`),
    view_relationships: pkaCap('link', `See its links to ${plural}`, () => `See which ${plural} its own entries are linked to (just the links).`),
    unlink_own_records: pkaCap('link', `Remove its own links`, () => `Remove the links its entries have to ${plural}. The ${plural} are not touched.`),
    ...(o.complete ? {
      complete_record: pkaCap('modify', `Mark ${plural} done`, s => `Mark ${plural} ${pkaRecWords(s)} as done. Nothing else about them.`, { records: ['pack-created', 'pack-linked'] }),
      reopen_record: pkaCap('modify', `Reopen ${plural}`, s => `Mark ${plural} ${pkaRecWords(s)} as not done again.`, { records: ['pack-created', 'pack-linked'] }),
    } : {}),
  };
}
pkRegisterTarget({ id: 'tasks', name: 'Tasks', caps: pkaStd('task', 'tasks', { search: ['title', 'tags'], summary: ['title', 'status', 'due-date', 'priority', 'tags'], summaryDef: ['title', 'status', 'due-date'], detail: 'the notes and the checklist', update: ['title', 'due-date', 'priority', 'tags', 'notes'], updateDef: ['title', 'due-date'], complete: true }) });
pkRegisterTarget({ id: 'notes', name: 'Notes', caps: pkaStd('note', 'notes', { search: ['title', 'tags'], summary: ['title', 'tags', 'updated'], summaryDef: ['title', 'tags'], detail: 'the whole text', update: ['title', 'body', 'tags'], updateDef: ['title', 'body'] }) });
pkRegisterTarget({ id: 'habits', name: 'Habits', caps: {
  discover_section: pkaCap('discover', 'Find out that habits exist', () => 'See that the Habits section exists. Nothing inside it.'),
  list_records: pkaCap('read', 'List your habits', s => `Get your habits as a list of ids${(s.fields || []).length ? ' and their names' : ''}. Not their history.`, { fields: ['title'], defFields: ['title'] }),
  read_statistics: pkaCap('read', 'Read habit statistics', () => 'Read a habit’s current streak and how often it was done this period (numbers only, not which days).'),
} });
pkRegisterTarget({ id: 'projects', name: 'Projects', caps: {
  discover_section: pkaCap('discover', 'Find out that projects exist', () => 'See that the Projects section exists. Nothing inside it.'),
  list_records: pkaCap('read', 'List your projects', s => `Get your projects as a list of ids${(s.fields || []).length ? ' and their names' : ''}.`, { fields: ['title'], defFields: ['title'] }),
  search_records: pkaCap('read', 'Search projects', () => 'Look for projects by name and get back which ones match.', { fields: ['title'], defFields: ['title'] }),
} });
pkRegisterTarget({ id: 'pack:*', name: 'another pack', caps: { // the sections of one other installed pack: 'pack:<its id>'
  discover_section: pkaCap('discover', 'Find out that the other pack is installed', () => 'See that the other pack is installed and what it is called. Nothing inside it.'),
  list_records: pkaCap('read', 'List its entries', () => 'Get the entries of the other pack as a list of ids.'),
  search_records: pkaCap('read', 'Search its entries', () => 'Look for entries of the other pack by title and get back which ones match.', { fields: ['title'], defFields: ['title'] }),
  view_record_summary: pkaCap('read', 'See a few details of its entries', s => `Read ${pkaFieldWords(s.fields)} of the entries of the other pack.`, { fields: ['title', 'done'], defFields: ['title'] }),
} });

/* ---------- the API: one object per pack, every call asks pkCan first and leaves one audit event ---------- */
function pkApi(packId) {
  const refuse = (op, target, cap, r, rec) => { pkAudit({ packId, op, target, rec, ok: false, cap: r.missing || pkpKey(target, cap), why: r.why }); return { ok: false, missing: r.missing, why: r.why }; };
  const gate = (op, target, cap, ctx, rec) => { const r = pkCan(packId, target, cap, ctx); return r.ok ? r : { fail: refuse(op, target, cap, r, rec) }; };
  const done = (op, target, cap, rec, extra = {}) => { pkAudit({ packId, op, target, rec, ok: true, cap: pkpKey(target, cap) }); return { ok: true, ...extra }; };
  const pick = (kind, rec, fields, table = PKA_FIELDS) => { const o = { id: rec.id }; for (const f of fields) if (table[kind] && table[kind][f]) o[f] = table[kind][f](rec); return o; };
  const myEntry = id => { const e = S.centries.find(x => x.id === id), s = e && S.csections.find(x => x.id === e.sid); return e && s && s.packId === packId ? e : null; }; // (a pack can only link its own entries)
  const api = {
    discover(target) {
      const g = gate('discover', target, 'discover_section', {}, ''); if (g.fail) return g.fail; const t = pkpTarget(target);
      return done('discover', target, 'discover_section', '', { name: t.name, exists: target.startsWith('pack:') ? !!pksRec(target.slice(5)) : true });
    },
    fields(target) {
      const g = gate('discover_fields', target, 'discover_fields', {}, ''); if (g.fail) return g.fail;
      const k = pkaKind(target), kinds = { title: 'text', status: 'choice', 'due-date': 'date', priority: 'number', tags: 'tags', notes: 'text', subtasks: 'list', body: 'text', updated: 'date' };
      return done('discover_fields', target, 'discover_fields', '', { fields: Object.keys(PKA_FIELDS[k] || {}).concat(Object.keys(PKA_DETAIL[k] || {})).map(f => ({ key: f, type: kinds[f] || 'text' })) });
    },
    list(target, o = {}) {
      const g = gate('list', target, 'list_records', {}, ''); if (g.fail) return g.fail;
      const lim = Math.max(1, Math.min(200, o.limit | 0 || 100)); return done('list', target, 'list_records', '', { records: pkaList(target).slice(0, lim).map(r => ({ id: r.id })) });
    },
    search(target, query, o = {}) {
      const g = gate('search', target, 'search_records', {}, ''); if (g.fail) return g.fail;
      const fields = (g.scope.fields || ['title']), words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6), lim = Math.max(1, Math.min(20, o.limit | 0 || 10)), k = pkaKind(target);
      const hay = r => fields.map(f => { const v = PKA_FIELDS[k][f] && PKA_FIELDS[k][f](r); return Array.isArray(v) ? v.join(' ') : String(v == null ? '' : v); }).join(' ').toLowerCase();
      const hits = words.length ? pkaList(target).filter(r => words.every(w => hay(r).includes(w))).slice(0, lim) : [];
      return done('search', target, 'search_records', '', { records: hits.map(r => pick(k, r, fields)) });
    },
    summary(target, id, fields) {
      const first = pkpCap(packId, pkpKey(target, 'view_record_summary')), want = fields && fields.length ? fields : (first && first.scope.fields) || ['title'];
      const g = gate('summary', target, 'view_record_summary', { fields: want, recordId: id }, id); if (g.fail) return g.fail;
      const r = pkaFind(target, id); if (!r) return done('summary', target, 'view_record_summary', id, { record: null });
      return done('summary', target, 'view_record_summary', id, { record: pick(pkaKind(target), r, want) });
    },
    details(target, id) {
      const g = gate('details', target, 'view_record_details', { recordId: id }, id); if (g.fail) return g.fail;
      const k = pkaKind(target), r = pkaFind(target, id); if (!r) return done('details', target, 'view_record_details', id, { record: null });
      return done('details', target, 'view_record_details', id, { record: { ...pick(k, r, Object.keys(PKA_FIELDS[k])), ...pick(k, r, Object.keys(PKA_DETAIL[k] || {}), PKA_DETAIL) } });
    },
    stats(target, id) {
      const g = gate('stats', target, 'read_statistics', {}, id); if (g.fail) return g.fail; const h = target === 'habits' ? pkaFind('habits', id) : null;
      return done('stats', target, 'read_statistics', id, { stats: h ? { streak: streak(h), doneThisPeriod: habitProgress(h).done, goal: habitProgress(h).n, per: habitProgress(h).per } : null });
    },
    create(target, data = {}) {
      const g = gate('create', target, 'create_record', {}, ''); if (g.fail) return g.fail; const d = data && typeof data === 'object' ? data : {}, now = Date.now();
      const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n), tags = a => (Array.isArray(a) ? a : []).map(x => text(x, 40).toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 12);
      let rec;
      if (target === 'tasks') {
        const title = text(d.title, 200); if (!title) return refuse('create', target, 'create_record', { missing: pkpKey(target, 'create_record'), why: 'A task needs a title.' }, '');
        rec = newTask({ title, notes: text(d.notes, 5000), due: /^\d{4}-\d\d-\d\d$/.test(d.due || d['due-date'] || '') ? (d.due || d['due-date']) : null, priority: [0, 1, 2, 3].includes(+d.priority) ? +d.priority : 0, tags: tags(d.tags) }); S.tasks.push(rec);
      } else if (target === 'notes') {
        const title = text(d.title, 200); if (!title && !text(d.body, 5)) return refuse('create', target, 'create_record', { missing: pkpKey(target, 'create_record'), why: 'A note needs a title or some text.' }, '');
        rec = newNote({ title, body: text(d.body, 20000), tags: tags(d.tags) }); S.notes.push(rec);
      } else return refuse('create', target, 'create_record', { missing: pkpKey(target, 'create_record'), why: 'OpenTick cannot create that.' }, '');
      return done('create', target, 'create_record', rec.id, { id: rec.id });
    },
    update(target, id, data = {}) {
      const keys = Object.keys(data || {}), g = gate('update', target, 'update_specific_fields', { fields: keys, recordId: id }, id); if (g.fail) return g.fail;
      const r = pkaFind(target, id); if (!r) return refuse('update', target, 'update_specific_fields', { missing: pkpKey(target, 'update_specific_fields'), why: 'That record is gone.' }, id);
      const text = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
      for (const k of keys) {
        if (target === 'tasks') { if (k === 'title') r.title = text(data[k], 200) || r.title; else if (k === 'notes') r.notes = text(data[k], 5000); else if (k === 'due-date') r.due = /^\d{4}-\d\d-\d\d$/.test(data[k] || '') ? data[k] : null; else if (k === 'priority') r.priority = [0, 1, 2, 3].includes(+data[k]) ? +data[k] : r.priority; else if (k === 'tags') r.tags = (Array.isArray(data[k]) ? data[k] : []).map(x => text(x, 40).toLowerCase()).filter(Boolean).slice(0, 12); }
        else if (target === 'notes') { if (k === 'title') r.title = text(data[k], 200); else if (k === 'body') r.body = text(data[k], 20000); else if (k === 'tags') r.tags = (Array.isArray(data[k]) ? data[k] : []).map(x => text(x, 40).toLowerCase()).filter(Boolean).slice(0, 12); r.updated = Date.now(); }
      }
      save(); return done('update', target, 'update_specific_fields', id);
    },
    complete(target, id) {
      const g = gate('complete', target, 'complete_record', { recordId: id }, id); if (g.fail) return g.fail; const t = target === 'tasks' ? pkaFind('tasks', id) : null;
      if (!t) return refuse('complete', target, 'complete_record', { missing: pkpKey(target, 'complete_record'), why: 'That task is gone.' }, id);
      if (t.status === 'open') toggleDone(t); return done('complete', target, 'complete_record', id);
    },
    reopen(target, id) {
      const g = gate('reopen', target, 'reopen_record', { recordId: id }, id); if (g.fail) return g.fail; const t = target === 'tasks' ? pkaFind('tasks', id) : null;
      if (!t) return refuse('reopen', target, 'reopen_record', { missing: pkpKey(target, 'reopen_record'), why: 'That task is gone.' }, id);
      if (t.status === 'done') toggleDone(t); return done('reopen', target, 'reopen_record', id);
    },
    remove(target, id) { // to the trash (tasks) or away (notes); only what this pack made
      const g = gate('delete', target, 'delete_own_records', { recordId: id }, id); if (g.fail) return g.fail;
      if (target === 'tasks') { const t = pkaFind('tasks', id); if (t) { t.deleted = Date.now(); save(); } } else if (target === 'notes') { S.notes = S.notes.filter(n => n.id !== id); save(); }
      return done('delete', target, 'delete_own_records', id);
    },
    link(entryId, target, id) {
      const g = gate('link', target, 'link_records', {}, id); if (g.fail) return g.fail; const e = myEntry(entryId);
      if (!e) return refuse('link', target, 'link_records', { missing: pkpKey(target, 'link_records'), why: 'A pack can only link its own entries.' }, id);
      if (!pkaFind(target, id)) return refuse('link', target, 'link_records', { missing: pkpKey(target, 'link_records'), why: 'That record is gone.' }, id);
      e.links = e.links || []; if (!e.links.some(l => l.t === target && l.id === id) && e.links.length < 20) e.links.push({ t: target, id }); save(); return done('link', target, 'link_records', id);
    },
    unlink(entryId, target, id) {
      const g = gate('unlink', target, 'unlink_own_records', {}, id); if (g.fail) return g.fail; const e = myEntry(entryId); if (!e) return refuse('unlink', target, 'unlink_own_records', { missing: pkpKey(target, 'unlink_own_records'), why: 'A pack can only change its own entries.' }, id);
      e.links = (e.links || []).filter(l => !(l.t === target && l.id === id)); save(); return done('unlink', target, 'unlink_own_records', id);
    },
    links(entryId, target) {
      const g = gate('links', target, 'view_relationships', { relationship: 'linked' }, ''); if (g.fail) return g.fail; const e = myEntry(entryId); if (!e) return done('links', target, 'view_relationships', '', { ids: [] });
      return done('links', target, 'view_relationships', '', { ids: (e.links || []).filter(l => l.t === target && pkaFind(target, l.id)).map(l => l.id) });
    },
  };
  if (typeof pkrMethods === 'function') Object.assign(api, pkrMethods(packId, { gate, refuse, done })); // reminders (packrem.js)
  return api;
}
// who linked a record: the pack's own entries say so
const pkpLinked = (packId, target, id) => { const ids = new Set(S.csections.filter(s => s.packId === packId).map(s => s.id)); return S.centries.some(e => ids.has(e.sid) && (e.links || []).some(l => l.t === target && l.id === id)); };
// undo: only what the app can put back without guessing. A record a pack created is moved away again (tasks to the trash); the event is marked, once, on every device
function pkpUndo(eventId) {
  const ev = S.pkact.find(e => e.id === eventId); if (!ev || ev.undone || !ev.ok || ev.op !== 'create') return { ok: false, why: 'That cannot be undone.' };
  if (ev.target === 'tasks') { const t = S.tasks.find(x => x.id === ev.rec); if (t && !t.deleted) t.deleted = Date.now(); } else if (ev.target === 'notes') S.notes = S.notes.filter(n => n.id !== ev.rec); else return { ok: false, why: 'That cannot be undone.' };
  ev.undone = true; pkAudit({ packId: ev.packId, op: 'undo', target: ev.target, rec: ev.rec, ok: true, cap: ev.cap, undoOf: ev.id }); save(); return { ok: true };
}

/* ---------- declarative actions and the related panel (what a section may carry) ---------- */
function pkaOps() { // op -> what it needs; `link`: the action may also link what it made; `maps`: which of its fields can be filled from the entry
  return {
    create_task: { target: 'tasks', caps: ['create_record'], link: true, maps: ['title', 'due', 'notes', 'priority', 'tags'], name: 'Create a task' },
    create_note: { target: 'notes', caps: ['create_record'], link: true, maps: ['title', 'body', 'tags'], name: 'Create a note' },
    link_task: { target: 'tasks', caps: ['search_records', 'link_records', 'view_record_summary'], maps: [], name: 'Link a task' },
    link_note: { target: 'notes', caps: ['search_records', 'link_records', 'view_record_summary'], maps: [], name: 'Link a note' },
    complete_linked: { target: 'tasks', caps: ['view_relationships', 'complete_record'], maps: [], name: 'Mark linked tasks done' },
    reopen_linked: { target: 'tasks', caps: ['view_relationships', 'reopen_record'], maps: [], name: 'Reopen linked tasks' },
  };
}
function pkaKeepActions(list) {
  const ops = pkaOps(), seen = {}, out = [];
  for (const a of (Array.isArray(list) ? list : []).slice(0, 8)) {
    if (!a || typeof a !== 'object' || !ops[a.op]) continue; const id = /^[\w-]{1,24}$/.test(a.id || '') ? a.id : ''; if (!id || seen[id]) continue; seen[id] = 1;
    const map = {}; for (const k of ops[a.op].maps) if (a.map && typeof a.map[k] === 'string') map[k] = a.map[k].slice(0, 300);
    out.push({ id, name: String(a.name || '').trim().slice(0, 40) || ops[a.op].name, icon: typeof a.icon === 'string' ? a.icon.slice(0, 16) : '', op: a.op, map, link: ops[a.op].link ? a.link === true : false });
  }
  return out;
}
function pkaKeepRelated(list) {
  const seen = {}, out = [];
  for (const r of (Array.isArray(list) ? list : []).slice(0, 4)) {
    if (!r || typeof r !== 'object' || (r.target !== 'tasks' && r.target !== 'notes') || seen[r.target]) continue; seen[r.target] = 1;
    const ok = r.target === 'tasks' ? ['title', 'status', 'due-date', 'priority', 'tags'] : ['title', 'tags', 'updated'], f = (Array.isArray(r.fields) ? r.fields : []).filter(x => ok.includes(x));
    out.push({ target: r.target, fields: [...new Set(f.length ? f : ['title'])].sort(), title: String(r.title || '').trim().slice(0, 40) });
  }
  return out;
}
// the permissions an action needs: [[target, cap], …]
const pkaNeeds = a => { const o = pkaOps()[a.op]; return o ? o.caps.map(c => [o.target, c]).concat(a.link && o.link ? [[o.target, 'link_records']] : []) : []; };
const pkaRelNeeds = r => [[r.target, 'view_relationships'], [r.target, 'view_record_summary']];
// packClean hooks: the actions / related of a raw section, checked against what OpenTick can do AND against what the pack asks permission for (an action whose
// permissions are not in the manifest could never run, so it is reported and left out instead of failing later)
function packActionsClean(raw, section, warn, perms) {
  if (raw == null) return []; if (!Array.isArray(raw)) { warn.push(`“${section.name}” has actions in a form OpenTick does not understand, so they were left out.`); return []; }
  const ops = pkaOps(), keep = pkaKeepActions(raw), asked = new Set(perms ? perms.sections.flatMap(s => s.capabilities.map(c => pkpKey(s.id, c.id))) : []);
  raw.forEach(a => { if (a && typeof a === 'object' && !ops[a.op]) warn.push(`The action “${pkS(a.name || a.id, 40) || '?'}” of “${section.name}” does something OpenTick cannot do, so it was left out.`); });
  return keep.filter(a => { const miss = pkaNeeds(a).map(([t, c]) => pkpKey(t, c)).filter(k => !asked.has(k)); if (miss.length) warn.push(`The action “${a.name}” of “${section.name}” needs permissions the pack does not ask for (${miss.join(', ')}), so it was left out.`); return !miss.length; });
}
function packRelatedClean(raw, section, warn, perms) {
  if (raw == null) return []; if (!Array.isArray(raw)) { warn.push(`“${section.name}” has a related panel in a form OpenTick does not understand, so it was left out.`); return []; }
  const asked = new Set(perms ? perms.sections.flatMap(s => s.capabilities.map(c => pkpKey(s.id, c.id))) : []);
  return pkaKeepRelated(raw).filter(r => { const miss = pkaRelNeeds(r).map(([t, c]) => pkpKey(t, c)).filter(k => !asked.has(k)); if (miss.length) warn.push(`The related panel for ${r.target} in “${section.name}” needs permissions the pack does not ask for (${miss.join(', ')}), so it was left out.`); return !miss.length; });
}
// the manifest a set of sections needs for its own actions and panels (used when sections are exported as a pack)
function pkaPermsFor(sections) {
  const by = {};
  for (const sec of sections) {
    for (const a of sec.actions || []) for (const [t, c] of pkaNeeds(a)) (by[t] = by[t] || {})[c] = by[t][c] || pkpDefaultScope(t, c);
    if ((sec.reminders || []).length) (by.reminders = by.reminders || {}).create_reminder = by.reminders.create_reminder || pkpDefaultScope('reminders', 'create_reminder');
    for (const r of sec.related || []) for (const [t, c] of pkaRelNeeds(r)) { const sc = (by[r.target] = by[r.target] || {})[c] = by[r.target][c] || pkpDefaultScope(t, c); if (c === 'view_record_summary') sc.fields = pkpSort([...(sc.fields || []), ...r.fields]); }
  }
  const ids = Object.keys(by); if (!ids.length) return null;
  return { sections: ids.map(t => ({ id: t, reason: 'Used by the actions and panels of these sections.', capabilities: Object.keys(by[t]).map(c => ({ id: c, scope: by[t][c], required: false })) })) };
}
// {fieldKey} in a map → the entry's value (the pack's keys were turned into the section's field ids when it was installed)
const pkaFill = (tpl, sec, e) => String(tpl || '').replace(/\{([\w-]{1,24})\}/g, (m, k) => { if (k === 'title') return e.title || ''; const f = sec.fields.find(x => x.id === k); if (!f) return ''; return xfdFill(sec, e, f); }).trim();
function pkaRun(sec, e, action) {
  const packId = sec.packId, api = pkApi(packId), need = pkaNeeds(action), miss = need.map(([t, c]) => pkCan(packId, t, c)).filter(r => !r.ok);
  if (miss.length) { for (const m of miss) pkAudit({ packId, op: action.op, target: sec.id, rec: e.id, ok: false, cap: m.missing, why: m.why }); return { ok: false, missing: miss.map(m => m.missing), why: miss[0].why }; }
  const o = pkaOps()[action.op], map = k => pkaFill(action.map[k], sec, e);
  if (action.op === 'create_task' || action.op === 'create_note') {
    const data = action.op === 'create_task' ? { title: map('title') || e.title, due: map('due'), notes: map('notes'), priority: +map('priority') || 0, tags: map('tags').split(/[\s,]+/).filter(Boolean) } : { title: map('title') || e.title, body: map('body'), tags: map('tags').split(/[\s,]+/).filter(Boolean) };
    const r = api.create(o.target, data); if (!r.ok) return r; if (action.link) { const l = api.link(e.id, o.target, r.id); if (!l.ok) return { ...l, created: r.id }; } save(); return { ok: true, made: r.id };
  }
  if (action.op === 'complete_linked' || action.op === 'reopen_linked') {
    const ids = api.links(e.id, o.target); if (!ids.ok) return ids; let n = 0, fail = null;
    for (const id of ids.ids) { const r = action.op === 'complete_linked' ? api.complete(o.target, id) : api.reopen(o.target, id); if (r.ok) n++; else fail = fail || r; }
    return { ok: n > 0 || !fail, changed: n, why: fail ? fail.why : '', missing: fail ? [fail.missing] : [] };
  }
  return { ok: false, why: 'That action needs you to choose something first.' }; // link_*: the picker (packpermui.js) searches, shows titles, and links the one chosen
}
