/* OpenTick packs: a pack is one small JSON file that carries sections (xsections.js) and/or themes (themes.js) from one person to another.
   It is the groundwork for a marketplace: anything a marketplace will ever list is one of these files, so the format, the checks and the install
   step live here first, and work from a file or pasted text today.
   A pack is DATA ONLY. It cannot contain code, scripts, remote files or CSS rules: a section is fields and entries, a theme is a set of colour
   variables. Everything in it is checked and cut down to size before anything is kept (packClean); nothing in a file is ever run or inserted as HTML.
   Installing only adds: it never changes or removes what is already there, and it never reads anything from the person's data.
   The format is documented for authors in docs/PACKS.md; marketplace/ in the repository holds examples that the tests check.
     { opentick: 'pack', format: 1, id, name, version, author, description, license, homepage,
       sections: [{ name, icon, color, title, view, checkable, sort { f, dir }, group, fields: [{ key, name, type, opts }],
                    entries: [{ title, vals { key: value }, notes, done }] }],
       themes: [{ name, base, vars { '--bg': '#…' } }] } */
const PACK_FORMAT = 1, PACK_MAX_BYTES = 2 * 1024 * 1024, PACK_LIMIT = { sections: 12, fields: 24, entries: 500, themes: 6 };
const pkS = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const PK_TYPES = ['text', 'note', 'number', 'date', 'check', 'select', 'rating', 'url', 'tags'];
const pkColor = v => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(v || '').trim()) ? String(v).trim() : '');
const pkHttp = v => { const u = pkS(v, 300); return /^https?:\/\/[^\s<>"']+$/i.test(u) ? u : ''; };
// a theme value is a colour or a shadow: letters, digits, # ( ) , . % / - and spaces; never anything that could load or run something
// (a value that is too long is refused, not cut: a cut shadow or colour could leave a bracket open and swallow the rules after it)
function pkThemeVal(v) {
  const x = typeof v === 'string' ? v.trim() : ''; if (!/^[#\w\s().,%/-]{1,80}$/.test(x) || /url|expression|javascript|import|var\(/i.test(x)) return '';
  let depth = 0; for (const ch of x) { if (ch === '(') depth++; else if (ch === ')' && --depth < 0) return ''; }
  return depth === 0 ? x : '';
}
const pkSlug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
function pkValue(f, v) { // one entry value cut to its field's type; null = drop it
  if (v == null || v === '') return null;
  if (f.type === 'number') { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null; }
  if (f.type === 'check') return v === true || v === 'true' ? true : null;
  if (f.type === 'rating') { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null; }
  if (f.type === 'date') return /^\d{4}-\d\d-\d\d$/.test(String(v)) ? String(v) : null;
  if (f.type === 'tags') return Array.isArray(v) ? v.map(x => pkS(x, 40).toLowerCase().replace(/^#/, '')).filter(Boolean).slice(0, 20) : null;
  if (typeof v === 'object') return null;
  return pkS(v, f.type === 'note' ? 5000 : 500) || null;
}
// raw parsed JSON -> { pack, warnings } (a clean copy that holds only what the format knows) or an Error saying what is wrong
function packClean(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.opentick !== 'pack') throw new Error('This is not an OpenTick pack. A pack file starts with "opentick": "pack".');
  const fmt = Number(raw.format); if (!Number.isInteger(fmt) || fmt < 1) throw new Error('This pack does not say which format it uses.');
  if (fmt > PACK_FORMAT) throw new Error('This pack was made for a newer OpenTick. Please update the app, then try again.');
  const warn = [], arr = v => (Array.isArray(v) ? v : []);
  const pack = { id: pkSlug(raw.id || raw.name) || 'pack', name: pkS(raw.name, 60) || 'Untitled pack', version: pkS(raw.version, 20), author: pkS(raw.author, 60), description: pkS(raw.description, 300), license: pkS(raw.license, 40), homepage: pkHttp(raw.homepage), sections: [], themes: [] };
  if (arr(raw.sections).length > PACK_LIMIT.sections) warn.push(`Only the first ${PACK_LIMIT.sections} sections were read.`);
  for (const rs of arr(raw.sections).slice(0, PACK_LIMIT.sections)) {
    if (!rs || typeof rs !== 'object') continue;
    const name = pkS(rs.name, 40); if (!name) { warn.push('A section without a name was skipped.'); continue; }
    const keys = new Set(), fields = [];
    for (const rf of arr(rs.fields).slice(0, PACK_LIMIT.fields)) {
      if (!rf || typeof rf !== 'object') continue;
      let key = /^[\w-]{1,24}$/.test(String(rf.key || '')) ? String(rf.key) : 'f' + (fields.length + 1); while (keys.has(key)) key += 'x'; keys.add(key);
      const type = PK_TYPES.includes(rf.type) ? rf.type : (warn.push(`A field of “${name}” had an unknown type and became text.`), 'text');
      fields.push({ key, name: pkS(rf.name, 40) || 'Field', type, opts: type === 'select' ? [...new Set(arr(rf.opts).map(o => pkS(o, 40)).filter(Boolean))].slice(0, 30) : [] });
    }
    const sorts = rs.sort && typeof rs.sort === 'object' ? rs.sort : {}, entries = []; let dropped = 0;
    if (arr(rs.entries).length > PACK_LIMIT.entries) warn.push(`Only the first ${PACK_LIMIT.entries} entries of “${name}” were read.`);
    for (const re of arr(rs.entries).slice(0, PACK_LIMIT.entries)) {
      if (!re || typeof re !== 'object') continue;
      const vals = {}, rv = re.vals && typeof re.vals === 'object' && !Array.isArray(re.vals) ? re.vals : {};
      for (const k of Object.keys(rv)) if (!keys.has(k)) dropped++;
      for (const f of fields) { const v = pkValue(f, rv[f.key]); if (v != null) vals[f.key] = v; else if (rv[f.key] != null && rv[f.key] !== '' && rv[f.key] !== false) dropped++; }
      entries.push({ title: pkS(re.title, 200), vals, notes: pkS(re.notes, 5000), done: re.done === true });
    }
    if (rs.group && !fields.some(f => f.key === rs.group && (f.type === 'select' || f.type === 'check'))) warn.push(`“${name}” is grouped by “${pkS(rs.group, 24)}”, which is not one of its choice or tick-box fields, so it is not grouped.`);
    if (sorts.f && sorts.f !== 'title' && sorts.f !== 'created' && !keys.has(sorts.f)) warn.push(`“${name}” is sorted by “${pkS(sorts.f, 24)}”, which is not one of its fields, so it is sorted by date added.`);
    if (dropped) warn.push(`${dropped} value${dropped === 1 ? '' : 's'} in “${name}” did not fit their field and ${dropped === 1 ? 'was' : 'were'} left out.`);
    pack.sections.push({ name, icon: pkS(rs.icon, 16), color: pkColor(rs.color), title: pkS(rs.title, 30) || 'Name', view: ['list', 'cards', 'table'].includes(rs.view) ? rs.view : 'list', checkable: rs.checkable === true, sort: { f: keys.has(sorts.f) || sorts.f === 'title' ? sorts.f : 'created', dir: sorts.dir === 'asc' ? 'asc' : 'desc' }, group: keys.has(rs.group) && fields.find(f => f.key === rs.group && (f.type === 'select' || f.type === 'check')) ? rs.group : '', fields, entries });
  }
  const allowed = new Set(typeof THEME_VARS !== 'undefined' ? THEME_VARS.map(v => v[0]) : []);
  if (arr(raw.themes).length > PACK_LIMIT.themes) warn.push(`Only the first ${PACK_LIMIT.themes} themes were read.`);
  for (const rt of arr(raw.themes).slice(0, PACK_LIMIT.themes)) {
    if (!rt || typeof rt !== 'object') continue; const name = pkS(rt.name, 40), vars = {};
    if (!name) { warn.push('A theme without a name was skipped.'); continue; }
    for (const [k, v] of Object.entries(rt.vars && typeof rt.vars === 'object' ? rt.vars : {})) { const kk = String(k).startsWith('--') ? String(k) : '--' + k, val = pkThemeVal(v); if (!allowed.has(kk)) warn.push(`The theme “${name}” has “${kk}”, which is not a theme colour; it was left out.`); else if (!val) warn.push(`The theme “${name}” has a value for “${kk}” that is not a plain colour or shadow; it was left out.`); else vars[kk] = val; }
    if (!vars['--bg'] || !vars['--text'] || !vars['--acc']) { warn.push(`The theme “${name}” needs at least --bg, --text and --acc, so it was skipped.`); continue; }
    pack.themes.push({ name, base: pkS(rt.base, 24).toLowerCase(), vars });
  }
  if (!pack.sections.length && !pack.themes.length) throw new Error('This pack has no sections or themes in it.');
  return { pack, warnings: warn };
}
function packParse(text) {
  const t = String(text || '').replace(/^﻿/, '').trim();
  if (!t) throw new Error('The pack is empty.');
  if (t.length > PACK_MAX_BYTES) throw new Error('That pack is too large (the limit is 2 MB).');
  let j; try { j = JSON.parse(t); } catch (e) { throw new Error('This is not a pack file: ' + e.message); }
  return packClean(j);
}
const packCounts = p => ({ sections: p.sections.length, fields: p.sections.reduce((n, s) => n + s.fields.length, 0), entries: p.sections.reduce((n, s) => n + s.entries.length, 0), themes: p.themes.length });
// adds what the pack holds. New ids for everything, so installing the same pack twice gives two copies and never touches the first.
function packInstall(pack) {
  const now = Date.now(); let entries = 0; const made = [];
  for (const ps of pack.sections) {
    const ids = {}, fields = ps.fields.map(f => ({ id: (ids[f.key] = xsFid()), name: f.name, type: f.type, ...(f.type === 'select' ? { opts: f.opts } : {}) }));
    const s = xsNormalise({ id: 'x-' + uid(), name: ps.name, icon: ps.icon, color: ps.color || '#4772fa', title: ps.title, fields, view: ps.view, checkable: ps.checkable, group: ids[ps.group] || '', sort: ps.sort.f === 'created' || ps.sort.f === 'title' ? ps.sort : { f: ids[ps.sort.f] || 'created', dir: ps.sort.dir }, pack: pack.name, created: now });
    S.csections.push(s); made.push(s);
    ps.entries.forEach((pe, i) => { const vals = {}; for (const [k, v] of Object.entries(pe.vals)) if (ids[k]) vals[ids[k]] = v; S.centries.push(xeNormalise({ id: uid(), sid: s.id, title: pe.title, vals, notes: pe.notes, done: pe.done, created: now - i })); entries++; });
  }
  let themes = 0;
  for (const t of pack.themes) { try { themeImport(JSON.stringify({ name: t.name, base: t.base, vars: t.vars }), t.name, false); themes++; } catch (e) { /* a bad theme must not stop the sections */ } }
  save(); return { sections: made, entries, themes };
}
// one or more sections as a pack
function packFromSections(list, meta = {}, withEntries = true) {
  return {
    opentick: 'pack', format: PACK_FORMAT, id: pkSlug(meta.id || meta.name || (list[0] && list[0].name)) || 'pack', name: pkS(meta.name || (list.length === 1 ? list[0].name : 'My sections'), 60), version: pkS(meta.version || '1.0.0', 20), author: pkS(meta.author, 60), description: pkS(meta.description, 300), license: pkS(meta.license, 40),
    sections: list.map(s => ({ name: s.name, icon: s.icon, color: s.color, title: s.title, view: s.view, checkable: s.checkable, sort: { ...s.sort }, group: s.group, fields: s.fields.map(f => ({ key: f.id, name: f.name, type: f.type, ...(f.type === 'select' ? { opts: f.opts } : {}) })),
      entries: withEntries ? xsEntries(s).sort((a, b) => b.created - a.created).map(e => ({ title: e.title, vals: e.vals, ...(e.notes ? { notes: e.notes } : {}), ...(e.done ? { done: true } : {}) })) : [] })),
  };
}
async function packsExport(list, name) {
  if (!list.length) { toast('There is no section to export'); return; }
  const v = await formDialog({ title: 'Export as a pack', ok: 'Export', fields: [
    { k: 'name', label: 'Pack name', type: 'text', v: name || (list.length === 1 ? list[0].name : 'My sections') }, { k: 'author', label: 'Author (optional)', type: 'text', v: '' }, { k: 'description', label: 'What it is (optional)', type: 'textarea', v: '', rows: 2 },
    { k: 'entries', label: 'Include the entries (leave off to share just the empty section)', type: 'check', v: false },
    { k: 'hint', type: 'hint', label: 'A pack holds only the sections: never your contacts, tasks or settings. People linked to entries are left out.' }], check: x => (!x.name.trim() ? 'Give the pack a name' : '') });
  if (!v) return;
  const pack = packFromSections(list, { name: v.name.trim(), author: v.author, description: v.description }, !!v.entries);
  try { if (await saveText(`opentick-pack-${pack.id}.json`, JSON.stringify(pack, null, 2))) toast('Pack saved'); } catch (e) { toast('Could not save: ' + (e.message || e)); }
}
const packsExportSection = s => packsExport([s], s.name);

/* ---------- looking at a pack before it is added ---------- */
function packPreview(pack, warnings, again) {
  const c = packCounts(pack), dup = pack.sections.some(ps => S.csections.some(s => s.pack === pack.name && s.name === ps.name));
  openModal(`<h3>${esc(pack.name)}</h3><p class="hint">${[pack.version ? 'Version ' + esc(pack.version) : '', pack.author ? 'by ' + esc(pack.author) : '', pack.license ? esc(pack.license) : ''].filter(Boolean).join(' · ')}</p>${pack.description ? `<p>${esc(pack.description)}</p>` : ''}`
    + `<div class="pk-list">${pack.sections.map(s => `<div class="pk-i" style="--c:${esc(s.color || 'var(--acc)')}"><span>${iconAny(s.icon, 18, 'layers')}</span><b>${esc(s.name)}</b><small>${s.fields.length} field${s.fields.length === 1 ? '' : 's'}${s.entries.length ? ` · ${s.entries.length} entr${s.entries.length === 1 ? 'y' : 'ies'}` : ''}</small></div>`).join('')}${pack.themes.map(t => `<div class="pk-i" style="--c:${esc(t.vars['--acc'])}"><span><i class="pk-sw" style="background:${esc(t.vars['--bg'])}"><u style="background:${esc(t.vars['--acc'])}"></u></i></span><b>${esc(t.name)}</b><small>Theme</small></div>`).join('')}</div>`
    + (dup ? '<p class="hint">You already have a section from this pack. Adding it again makes a second copy.</p>' : '') + (warnings.length ? `<p class="hint">${warnings.map(esc).join('<br>')}</p>` : '')
    + `<p class="hint">${ic('shield', 13)} A pack only adds ${c.sections ? 'sections' : ''}${c.sections && c.themes ? ' and ' : ''}${c.themes ? 'colours' : ''}. It cannot run anything, and it does not touch what you already have.${pack.homepage ? ` <a href="${esc(pack.homepage)}" target="_blank" rel="noopener noreferrer">${esc(pack.homepage.replace(/^https?:\/\//, '').slice(0, 50))}</a>` : ''}</p>`
    + `<div class="mact"><span class="sp"></span><button type="button" data-m="no">Cancel</button><button type="button" class="pri" data-m="ok">Add to OpenTick</button></div>`, m => {
    m.onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); if (again) again(); } return; }
      if (b.dataset.m === 'ok') { const r = packInstall(pack); closeModal(); sfx('add'); if (r.sections[0]) { U.page = r.sections[0].id; U.pinKey = null; } render(); toast(`Added ${[r.sections.length ? plural(r.sections.length, 'section') : '', r.themes ? plural(r.themes, 'theme') : ''].filter(Boolean).join(' and ')}`); if (!r.sections.length && again) again(); }
      else { closeModal(); if (again) again(); }
    };
  }, 'wide xs-modal');
}
function packOpenText(text, again) { try { const r = packParse(text); packPreview(r.pack, r.warnings, again); } catch (e) { toast(e.message || 'That is not a pack'); if (again) again(); } }
async function packFromFile(again) { try { const f = await pickText(['json', 'txt'], 'OpenTick pack', true); if (f) packOpenText(f.text, again); else if (again) again(); } catch (e) { toast('Could not read that file'); if (again) again(); } }
function packPaste(again) {
  openModal(`<h3>Paste a pack</h3><p class="hint">Paste the text of a pack file.</p><textarea id="pk-ta" class="th-ta" spellcheck="false" placeholder='{ "opentick": "pack", "format": 1, … }'></textarea><div class="mact"><span class="sp"></span><button type="button" data-m="no">Cancel</button><button type="button" class="pri" data-m="ok">Continue</button></div>`, m => {
    const ta = $('#pk-ta', m); ta.focus();
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); if (again) again(); } return; } if (b.dataset.m === 'ok') { const t = ta.value; closeModal(); packOpenText(t, again); } else { closeModal(); if (again) again(); } };
  }, 'wide');
}
// the small block on the "New section" dialog
const packsImportHtml = () => `<div class="pk-imp"><span>${ic('package', 15)} Have a pack from someone else?</span><button type="button" class="btn sm" data-m="packfile">${ic('upload', 13)} From a file…</button><button type="button" class="btn sm" data-m="packpaste">${ic('file-text', 13)} Paste…</button></div>`;
function packsHandle(b) { // clicks in the New section dialog
  const a = b.dataset.m; closeModal();
  if (a === 'packfile') packFromFile(xsNew); else if (a === 'packpaste') packPaste(xsNew);
}

/* ---------- Settings: Sections & packs ---------- */
function packsSettingsHtml() {
  const rows = S.csections.map(s => `<div class="pk-r" style="--c:${esc(s.color)}"><span class="pk-ic">${iconAny(s.icon, 18, 'layers')}</span><span class="pk-n"><b>${esc(s.name)}</b><small>${plural(xsEntries(s).length, 'entry').replace('entrys', 'entries')} · ${plural(s.fields.length, 'field')}${s.pack ? ' · from ' + esc(s.pack) : ''}</small></span><button type="button" class="btn sm" data-m="xsgo" data-id="${esc(s.id)}">Open</button><button type="button" class="btn sm" data-m="xsexp" data-id="${esc(s.id)}">Export</button></div>`).join('');
  return `<h4 class="mh">Your sections</h4><p class="hint">Make a section for anything you keep a list of: books, recipes, spending, gift ideas. It appears in the sidebar beside Tasks and Notes, and you can order, pin or hide it in Layout like the rest.</p>`
    + (rows ? `<div class="pk-rows">${rows}</div>` : '<p class="hint">You have not made a section yet.</p>')
    + `<div class="ct-acts"><button type="button" class="btn pri" data-m="xsnew">${ic('plus', 14)} New section</button><button type="button" class="btn" data-m="packfile">${ic('upload', 14)} Add a pack…</button><button type="button" class="btn" data-m="packpaste">${ic('file-text', 14)} Paste a pack…</button>${S.csections.length ? `<button type="button" class="btn" data-m="packall">${ic('download', 14)} Export all…</button>` : ''}</div>`
    + `<h4 class="mh">Marketplace</h4><div class="pk-market"><span>${ic('package', 22)}</span><div><b>Coming soon</b><p class="hint">A place to find sections and themes made by other people, and to share your own. Everything in it will be a pack, the same file you can add above today, so a pack you make now will work there.</p><p class="hint">Want to make one? <a href="https://github.com/${esc(UPD_REPO)}/blob/main/docs/PACKS.md" target="_blank" rel="noopener noreferrer">How packs work</a>. Packs hold only sections and colours: they cannot run code or see your data.</p></div></div>`;
}
// Settings clicks that belong here; returns true when handled
function packsSettingsAct(a, b) {
  const back = () => openSettings('sections');
  if (a === 'xsnew') { closeModal(); xsNew(); return true; }
  if (a === 'packfile') { closeModal(); packFromFile(back); return true; }
  if (a === 'packpaste') { closeModal(); packPaste(back); return true; }
  if (a === 'packall') { closeModal(); packsExport(S.csections.slice()).then(back); return true; }
  if (a === 'xsexp') { const s = xsById(b.dataset.id); if (s) { closeModal(); packsExport([s], s.name).then(back); } return true; }
  if (a === 'xsgo') { const s = xsById(b.dataset.id); if (s) { closeModal(); U.page = s.id; U.pinKey = null; render(); } return true; }
  return false;
}
