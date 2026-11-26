/* What a pack can say about a field beyond its type (format 2): the advanced fields of xfields.js, in the words a pack author writes.
   In a pack file a field is
     { key, name, type, opts, formula, description, placeholder, default, required, min, max, minLength, maxLength, integer,
       format { prefix, suffix, unit, decimals, style, thousands, dateFormat, progress, progressMax },
       group (a key of the section's groups), visibleWhen { field (a key), equals | notEquals | in | notIn | filled } or { all: [...] } / { any: [...] } }
   a section also has  groups: [{ key, name, description }]  and  templates: [{ key, name, description, title, notes, values { fieldKey: value } }].
   The pack is cleaned into the app's own words (desc, ph, def, req, minLen, maxLen, int, fmt, fg, when, formula, vals), still in the pack's KEYS; installing turns
   every key into the section's own field id. A value that does not fit is cut with a warning, never kept, and nothing here is ever run: a formula is read by formula.js.
   Everything is a function declaration or a plain constant used only at run time. */
const PKF_KNOWN = ['key', 'name', 'type', 'opts', 'formula', 'description', 'placeholder', 'default', 'required', 'min', 'max', 'minLength', 'maxLength', 'integer', 'format', 'group', 'visibleWhen'];
const PKF_PAIRS = [['desc', 'description'], ['ph', 'placeholder'], ['def', 'default'], ['req', 'required'], ['min', 'min'], ['max', 'max'], ['minLen', 'minLength'], ['maxLen', 'maxLength'], ['int', 'integer']];
const PKF_INTERNAL = ['desc', 'ph', 'def', 'req', 'min', 'max', 'minLen', 'maxLen', 'int', 'fmt', 'fg', 'when'];
const pkfGiven = v => v != null && v !== '' && v !== false;
// is a field (from a pack file, a cleaned pack or a section) using anything that needs format 2?
function pkfAdvanced(f) {
  if (!f || typeof f !== 'object') return false; if (f.type === 'multiselect' || f.type === 'calculated') return true;
  return PKF_INTERNAL.some(k => pkfGiven(f[k])) || PKF_PAIRS.some(p => pkfGiven(f[p[1]])) || pkfGiven(f.format) || pkfGiven(f.group) || pkfGiven(f.visibleWhen);
}
const pkfSectionAdvanced = s => !!(s && ((s.groups && s.groups.length) || (s.templates && s.templates.length) || (s.fields || []).some(pkfAdvanced)));
const pkfFmtIn = x => { const o = x && typeof x === 'object' && !Array.isArray(x) ? x : {}; return { prefix: o.prefix, suffix: o.suffix, unit: o.unit, dec: o.decimals, style: o.style, thou: o.thousands, datefmt: o.dateFormat, bar: o.progress, barMax: o.progressMax }; };
const pkfFmtOut = f => { const o = f || {}, r = {}; if (o.prefix) r.prefix = o.prefix; if (o.suffix) r.suffix = o.suffix; if (o.unit) r.unit = o.unit; if (o.dec != null) r.decimals = o.dec; if (o.style) r.style = o.style; if (o.thou === false) r.thousands = false; if (o.datefmt) r.dateFormat = o.datefmt; if (o.bar) r.progress = true; if (o.barMax != null) r.progressMax = o.barMax; return r; };

/* ---------- reading a pack's fields (packClean calls these) ---------- */
// the properties of one field: type-checked, cut to size, with a warning for what did not fit. `type` and `opts` are already clean.
function pkfExtras(rf, type, opts, label, warn) {
  const raw = { fmt: pkfFmtIn(rf.format) }; for (const [a, b] of PKF_PAIRS) raw[a] = rf[b];
  const out = xfdExtras(raw, type, opts), lost = [];
  for (const [a, b] of PKF_PAIRS) if (pkfGiven(raw[a]) && !(a in out) && !(a === 'min' && raw.min === 0 && (type === 'multiselect' || type === 'tags'))) lost.push(b); // (a minimum of 0 choices means nothing, so nothing is lost)
  if (rf.format && typeof rf.format === 'object' && Object.values(rf.format).some(pkfGiven) && !out.fmt) lost.push('format');
  if (lost.length) warn.push(`${label}: ${lost.join(', ')} did not fit this kind of field and ${lost.length === 1 ? 'was' : 'were'} left out.`);
  const odd = Object.keys(rf).filter(k => !PKF_KNOWN.includes(k)); if (odd.length) warn.push(`${label} has ${odd.length === 1 ? 'a property' : 'properties'} this version of OpenTick does not know (${odd.slice(0, 4).map(k => pkS(k, 20)).join(', ')}); left out.`);
  return out;
}
// the fields of a section (already cleaned one by one, keyed by `key`): conditions, formulas and groups, which need all the keys to be known. Returns { groups, templates }.
function pkfSection(rs, name, fields, rawFields, warn) {
  const keys = fields.map(f => f.key); let lost = 0;
  const groups = xfdGroups((Array.isArray(rs.groups) ? rs.groups : []).map(g => (g && typeof g === 'object' ? { id: g.key, name: g.name, desc: g.description } : null)));
  if (Array.isArray(rs.groups) && rs.groups.length > groups.length) warn.push(`Some groups of “${name}” were left out (a group needs a name, and a section can have 8).`);
  fields.forEach((f, i) => {
    const rf = rawFields[i], label = `“${f.name}” in “${name}”`;
    if (pkfGiven(rf.group)) { if (groups.some(g => g.id === rf.group)) f.fg = rf.group; else warn.push(`${label} is in the group “${pkS(rf.group, 24)}”, which the section does not have, so it is not grouped.`); }
    if (rf.visibleWhen !== undefined && rf.visibleWhen !== null) { const w = xfdCond(rf.visibleWhen, keys.filter(k => k !== f.key), 0); if (w) f.when = w; else warn.push(`${label} has a visibleWhen condition that is not valid (it needs a field of this section and equals, notEquals, in, notIn or filled), so it is always shown.`); }
  });
  // (the loop check works on ids, which here are the keys)
  const had = fields.filter(f => f.when).length, idf = fields.map(f => ({ id: f.key, when: f.when })); xfdBreakLoops(idf); fields.forEach((f, i) => { if (!idf[i].when) delete f.when; }); lost = had - fields.filter(f => f.when).length; if (lost) warn.push(`${lost === 1 ? 'A visibleWhen condition' : lost + ' visibleWhen conditions'} of “${name}” led back to ${lost === 1 ? 'itself' : 'themselves'} and ${lost === 1 ? 'was' : 'were'} left out.`);
  const all = fields.map(f => ({ id: f.key, name: f.name, type: f.type, formula: f.formula }));
  for (const f of fields) if (f.type === 'calculated') { const r = xfCheck(f.formula || '', all, f.key, {}, f.name); if (!r.ok) warn.push(`The formula of “${f.name}” in “${name}” does not work (${r.err}); the field will show a warning until it is fixed.`); }
  const tpl = xfdTemplates((Array.isArray(rs.templates) ? rs.templates : []).map(t => (t && typeof t === 'object' ? { id: t.key, name: t.name, desc: t.description, title: t.title, notes: t.notes, vals: t.values } : null)), fields.map(f => ({ ...f, id: f.key })));
  if (Array.isArray(rs.templates) && rs.templates.length > tpl.length) warn.push(`Some templates of “${name}” were left out (a template needs a name, and a section can have 8).`);
  const rawT = (Array.isArray(rs.templates) ? rs.templates : []).filter(x => x && typeof x === 'object' && pkS(x.name, 40)), given = rawT.reduce((n, x) => n + (x.values && typeof x.values === 'object' && !Array.isArray(x.values) ? Math.min(40, Object.keys(x.values).length) : 0), 0), kept = tpl.reduce((n, x) => n + Object.keys(x.vals).length, 0);
  if (given > kept) warn.push(`${given - kept} value${given - kept === 1 ? '' : 's'} in the templates of “${name}” did not fit their field and ${given - kept === 1 ? 'was' : 'were'} left out.`);
  return { groups, templates: tpl };
}
/* ---------- installing and exporting ---------- */
const pkfMapCond = (c, ids) => (c.all || c.any ? { [c.all ? 'all' : 'any']: (c.all || c.any).map(x => pkfMapCond(x, ids)) } : { ...c, field: ids[c.field] });
// the section's own fields, from a cleaned pack section: every key becomes the field's id
function pkfInstallFields(ps, ids) {
  const keyed = ps.fields.map(f => ({ id: f.key, name: f.name, type: f.type }));
  return ps.fields.map(f => {
    const o = { ...f, id: ids[f.key] }; delete o.key; if (!o.opts || !o.opts.length || (f.type !== 'select' && f.type !== 'multiselect')) delete o.opts;
    if (f.when) o.when = pkfMapCond(f.when, ids);
    if (f.formula) o.formula = xfRewrite(f.formula, ref => { const t = xfResolve(ref, keyed); return t ? ids[t.id] : null; });
    return o;
  });
}
function pkfInstallExtras(ps, ids) { // groups and templates of a cleaned pack section, for xsNormalise
  const o = {}; if (ps.groups && ps.groups.length) o.fgroups = ps.groups.map(g => ({ ...g }));
  if (ps.templates && ps.templates.length) o.tpls = ps.templates.map(t => ({ ...t, vals: Object.fromEntries(Object.entries(t.vals || {}).filter(([k]) => ids[k]).map(([k, v]) => [ids[k], v])) }));
  return o;
}
// a section's field as a pack file writes it (the key is the field's id; a formula already names ids)
function pkfFieldOut(f) {
  const o = { key: f.id, name: f.name, type: f.type }; if (f.type === 'select' || f.type === 'multiselect') o.opts = f.opts || []; if (f.type === 'calculated') o.formula = f.formula || '';
  for (const [a, b] of PKF_PAIRS) if (pkfGiven(f[a])) o[b] = f[a];
  if (f.fmt && Object.keys(f.fmt).length) o.format = pkfFmtOut(f.fmt); if (f.fg) o.group = f.fg; if (f.when) o.visibleWhen = JSON.parse(JSON.stringify(f.when)); return o;
}
function pkfSectionOut(s, os) { // groups and templates of a section into its pack form `os`
  if (s.fgroups && s.fgroups.length) os.groups = s.fgroups.map(g => ({ key: g.id, name: g.name, ...(g.desc ? { description: g.desc } : {}) }));
  if (s.tpls && s.tpls.length) os.templates = s.tpls.map(t => ({ key: t.id, name: t.name, ...(t.desc ? { description: t.desc } : {}), ...(t.title ? { title: t.title } : {}), ...(t.notes ? { notes: t.notes } : {}), values: JSON.parse(JSON.stringify(t.vals || {})) }));
}
