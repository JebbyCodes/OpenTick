/* OpenTick advanced fields (0.9.1): what a field of a custom section (xsections.js) can be and do beyond its type.
   Everything here is data and rules: nothing is ever run (a calculated field's formula is read by formula.js, which has no eval).
   A field is  { id, name, type, opts?, formula?, desc?, ph?, def?, req?, min?, max?, minLen?, maxLen?, int?, fmt?, fg?, when? }
     desc     a line of help shown under the field                    ph      the grey hint inside an empty box
     def      the value a NEW entry starts with ('today' for a date)  req     the entry cannot be saved while it is empty (while the field is shown)
     min max  number or date range, or how many choices / tags       minLen maxLen   how long a text may be       int   whole numbers only
     fmt      how a value is shown: { prefix, suffix, unit, dec, style: number|integer|percent|ratio|date, thou, datefmt: short|long|iso, bar, barMax }
     fg       the id of the field group it sits in (section.fgroups: [{ id, name, desc }])
     when     when the field is shown (visibleWhen): { field, equals | notEquals | in | notIn | filled } or { all: [...] } / { any: [...] }, `field` being a field id
   A section also has templates: [{ id, name, desc, title, notes, vals { fieldId: value } }], the starting points offered for a new entry.
   Two new types: multiselect (several of the field's own options; not free-form tags) and calculated (read-only, worked out by formula.js, never stored).
   A field that is not shown keeps its value but counts as empty everywhere (conditions of other fields, formulas, validation, the screen), and comes back when it is shown again.
   The cleaners are function declarations that use only literals: migrate() runs them while core.js is still loading, when no constant of any file exists yet. */
function xfdS(v, n) { return String(v == null || typeof v === 'object' ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n); }
function xfdIso(v) { if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(v)) return ''; const d = new Date(v + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : ''; }
function xfdInt(v, lo, hi) { const n = typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+$/.test(v.trim()) ? Number(v) : NaN; return Number.isInteger(n) && n >= lo && n <= hi ? n : null; }
function xfdNum(v) { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) ? n : null; }
function xfdTags(v) { return (Array.isArray(v) ? v : []).map(x => xfdS(x, 40).toLowerCase().replace(/^#/, '')).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 20); }
// one value cut to a field's type; null = it does not fit (dyn: 'today' is allowed, for a default)
function xfdValue(f, v, dyn) {
  if (v == null || v === '' || f.type === 'calculated') return null;
  switch (f.type) {
    case 'number': return xfdNum(v);
    case 'check': return v === true || v === 'true' ? true : null;
    case 'rating': return xfdInt(v, 1, 5);
    case 'date': return dyn && v === 'today' ? 'today' : xfdIso(v) || null;
    case 'tags': { const t = xfdTags(typeof v === 'string' ? v.split(/[\s,]+/) : v); return t.length ? t : null; }
    case 'select': return typeof v === 'string' && (f.opts || []).includes(v) ? v : null;
    case 'multiselect': { const a = typeof v === 'string' ? v.split(',').map(x => x.trim()) : Array.isArray(v) ? v : null; if (!a) return null; const set = a.map(x => xfdS(x, 40)); const r = (f.opts || []).filter(o => set.includes(o)); return r.length ? r : null; }
    default: return typeof v === 'object' ? null : xfdS(v, f.type === 'note' ? 5000 : 500) || null;
  }
}
function xfdFormula(v) { return xfdS(v, 300); }
// how a field is shown (only the keys that mean something for its type)
// a prefix or suffix keeps the spaces it was typed with (" / month"), unless it is nothing but spaces
function xfdAff(v, n) { const s = String(v == null || typeof v === 'object' ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n); return s.trim() ? s : ''; }
function xfdFmt0(x, type) {
  const o = x && typeof x === 'object' && !Array.isArray(x) ? x : {}, out = {};
  if (type === 'number' || type === 'calculated') {
    const pre = xfdAff(o.prefix, 8), suf = xfdAff(o.suffix, 12), unit = xfdS(o.unit, 12), dec = xfdInt(o.dec, 0, 6), style = ['number', 'integer', 'percent', 'ratio'].includes(o.style) || (type === 'calculated' && o.style === 'date') ? o.style : '';
    if (pre) out.prefix = pre; if (suf) out.suffix = suf; if (unit) out.unit = unit; if (dec !== null && style !== 'integer') out.dec = dec; if (style && style !== 'number') out.style = style; if (o.thou === false) out.thou = false;
    if (style !== 'date' && o.bar === true) { out.bar = true; const m = xfdNum(o.barMax); if (m !== null && m > 0 && m !== 100) out.barMax = m; }
  }
  if (type === 'date' || (type === 'calculated' && o.style === 'date')) { if (['short', 'long', 'iso'].includes(o.datefmt) && o.datefmt !== 'short') out.datefmt = o.datefmt; }
  return out;
}
// the extra properties of one field (raw field, its type, its cleaned options); `when` and `fg` need the other fields and come later
function xfdExtras(f, type, opts) {
  const out = {}, text = type === 'text' || type === 'note' || type === 'url', many = type === 'multiselect' || type === 'tags';
  const desc = xfdS(f.desc, 200), ph = type === 'check' || type === 'rating' || type === 'calculated' ? '' : xfdS(f.ph, 60);
  if (desc) out.desc = desc; if (ph) out.ph = ph;
  if (f.req === true && type !== 'check' && type !== 'calculated') out.req = true;
  let min = null, max = null, minLen = null, maxLen = null;
  if (type === 'number') { min = xfdNum(f.min); max = xfdNum(f.max); if (f.int === true) out.int = true; }
  else if (type === 'date') { min = f.min === 'today' ? 'today' : xfdIso(f.min) || null; max = f.max === 'today' ? 'today' : xfdIso(f.max) || null; }
  else if (many) { min = xfdInt(f.min, 0, type === 'tags' ? 20 : 30); max = xfdInt(f.max, 1, type === 'tags' ? 20 : 30); }
  if (text) { minLen = xfdInt(f.minLen, 1, 5000); maxLen = xfdInt(f.maxLen, 1, 5000); }
  if (min !== null && max !== null && typeof min === typeof max && min !== 'today' && max !== 'today' && min > max) { min = null; max = null; } // (a range that cannot be met is dropped)
  if (minLen !== null && maxLen !== null && minLen > maxLen) { minLen = null; maxLen = null; }
  if (min !== null && !(many && min === 0)) out.min = min; if (max !== null) out.max = max; if (minLen !== null) out.minLen = minLen; if (maxLen !== null) out.maxLen = maxLen;
  const fmt = xfdFmt0(f.fmt, type); if (Object.keys(fmt).length) out.fmt = fmt;
  if (f.def != null && f.def !== '' && type !== 'calculated') { const d = xfdValue({ type, opts }, f.def, true); if (d !== null && !xfdBreaks({ type, opts, ...out }, d)) out.def = d; }
  return out;
}
// does a value break a field's own numeric / length / count rule? (a short reason, or '')
function xfdBreaks(f, v) {
  const n = f.name ? `“${f.name}”` : 'This field';
  if (v == null || v === '' || v === 'today' && f.type === 'date') return '';
  if (f.type === 'number') { const x = xfdNum(v); if (x === null) return `${n} must be a number.`; if (f.int && !Number.isInteger(x)) return `${n} must be a whole number.`; if (f.min != null && x < f.min) return `${n} must be at least ${f.min}.`; if (f.max != null && x > f.max) return `${n} must be at most ${f.max}.`; }
  else if (f.type === 'text' || f.type === 'note' || f.type === 'url') { const l = String(v).length; if (f.minLen != null && l < f.minLen) return `${n} needs at least ${f.minLen} character${f.minLen === 1 ? '' : 's'}.`; if (f.maxLen != null && l > f.maxLen) return `${n} can have at most ${f.maxLen} character${f.maxLen === 1 ? '' : 's'}.`; }
  else if (f.type === 'multiselect' || f.type === 'tags') { const c = Array.isArray(v) ? v.length : 0, w = f.type === 'tags' ? 'tag' : 'choice'; if (f.min != null && c < f.min) return `${n} needs at least ${f.min} ${w}${f.min === 1 ? '' : 's'}.`; if (f.max != null && c > f.max) return `${n} can have at most ${f.max} ${w}${f.max === 1 ? '' : 's'}.`; }
  else if (f.type === 'date') { const d = xfdIso(String(v)); if (!d) return `${n} must be a date.`; const t = xfdToday0(); if (f.min != null) { const lo = f.min === 'today' ? t : f.min; if (d < lo) return `${n} cannot be before ${lo}.`; } if (f.max != null) { const hi = f.max === 'today' ? t : f.max; if (d > hi) return `${n} cannot be after ${hi}.`; } }
  return '';
}
function xfdToday0() { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

/* ---------- when a field is shown ---------- */
function xfdCond(c, ids, depth) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  for (const mode of ['all', 'any']) if (Array.isArray(c[mode])) { if (depth > 0) return null; const list = c[mode].map(x => xfdCond(x, ids, depth + 1)).filter(Boolean).slice(0, 4); return list.length ? (list.length === 1 ? list[0] : { [mode]: list }) : null; }
  if (typeof c.field !== 'string' || !ids.includes(c.field)) return null;
  const out = { field: c.field }, scalar = v => (typeof v === 'string' ? xfdS(v, 40) : typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'boolean' ? v : null);
  if ('equals' in c) { const v = scalar(c.equals); if (v === null) return null; out.equals = v; }
  else if ('notEquals' in c) { const v = scalar(c.notEquals); if (v === null) return null; out.notEquals = v; }
  else if (Array.isArray(c.in) || Array.isArray(c.notIn)) { const k = Array.isArray(c.in) ? 'in' : 'notIn', l = c[k].map(scalar).filter(v => v !== null && v !== '').slice(0, 12); if (!l.length) return null; out[k] = l; }
  else if ('filled' in c) out.filled = c.filled !== false;
  else return null;
  return out;
}
function xfdCondRefs(c, out) { out = out || []; if (!c) return out; if (c.all || c.any) for (const x of c.all || c.any) xfdCondRefs(x, out); else if (c.field && !out.includes(c.field)) out.push(c.field); return out; }
// conditions that lead back to themselves are dropped (the pure "A is shown when B, B when A" loop; loops through a formula are found at run time: xfdPlan)
function xfdBreakLoops(fields) {
  const by = {}; for (const f of fields) by[f.id] = f; const state = {};
  const visit = (id, path) => { const f = by[id]; if (!f || !f.when || state[id] === 2) return; if (state[id] === 1) { const start = path.indexOf(id); for (const p of path.slice(start)) if (by[p] && by[p].when) delete by[p].when; return; } state[id] = 1; for (const r of xfdCondRefs(f.when)) { if (by[id] && by[id].when) visit(r, path.concat(id)); } state[id] = 2; };
  for (const f of fields) visit(f.id, []);
}
// every field is shown or not, in an order where what a condition needs is known first
const XFD_CACHE = new Map();
function xfdPlan(s) {
  const fields = s.fields || [], sig = JSON.stringify(fields.map(f => [f.id, f.name, f.type, f.formula || '', f.when || null]));
  const hit = XFD_CACHE.get(sig); if (hit) return hit;
  const fp = xfPlan(s), ids = new Set(fields.map(f => f.id)), edges = Object.create(null), when = Object.create(null);
  for (const f of fields) { const w = xfdCondRefs(f.when).filter(r => ids.has(r)); when[f.id] = w; const d = w.filter(r => r !== f.id); const p = fp.calc[f.id]; if (f.type === 'calculated' && p && !p.err) for (const x of p.deps) if (!d.includes(x)) d.push(x); edges[f.id] = d; }
  // strongly connected pieces: every field on a loop; one whose condition needs a field of its own loop has the condition set aside
  let idx = 0; const index = Object.create(null), low = Object.create(null), on = Object.create(null), stack = [], comps = [];
  const strong = v => { index[v] = low[v] = idx++; stack.push(v); on[v] = true; for (const w of edges[v]) { if (index[w] === undefined) { strong(w); low[v] = Math.min(low[v], low[w]); } else if (on[w]) low[v] = Math.min(low[v], index[w]); } if (low[v] === index[v]) { const c = []; let w; do { w = stack.pop(); on[w] = false; c.push(w); } while (w !== v); comps.push(c); } };
  for (const f of fields) if (index[f.id] === undefined) strong(f.id);
  const loops = Object.create(null), name = id => (fields.find(f => f.id === id) || {}).name || id;
  for (const c of comps) { if (c.length < 2) { if (when[c[0]].includes(c[0])) loops[c[0]] = 'Shown or hidden by itself'; continue; } const set = new Set(c); for (const id of c) if (when[id].some(r => set.has(r))) loops[id] = 'Shown or hidden by a field that depends on it: ' + c.slice().reverse().map(name).join(' → '); }
  const order = [], seen = new Set(); const put = id => { if (seen.has(id)) return; seen.add(id); for (const d of edges[id]) { if (loops[id] && when[id].includes(d)) continue; put(d); } order.push(id); }; for (const f of fields) put(f.id);
  const plan = { order, loops, fp }; if (XFD_CACHE.size > 60) XFD_CACHE.clear(); XFD_CACHE.set(sig, plan); return plan;
}
function xfdMatch(c, eff, by) {
  if (c.all) return c.all.every(x => xfdMatch(x, eff, by)); if (c.any) return c.any.some(x => xfdMatch(x, eff, by));
  const f = by.get(c.field), v = eff[c.field], arr = Array.isArray(v), has = x => (arr ? v.some(y => String(y) === String(x)) : v === true ? x === true : typeof v === 'number' ? Number(x) === v && x !== '' : v != null && String(v) === String(x));
  const empty = v == null || v === '' || v === false || (arr && !v.length);
  if ('filled' in c) return c.filled ? !empty : empty;
  if ('equals' in c) return c.equals === '' ? empty : f && f.type === 'check' ? (c.equals === true || c.equals === 'true') === !!v : has(c.equals);
  if ('notEquals' in c) return c.notEquals === '' ? !empty : f && f.type === 'check' ? (c.notEquals === true || c.notEquals === 'true') !== !!v : !has(c.notEquals);
  if (c.in) return c.in.some(has); if (c.notIn) return !c.notIn.some(has); return true;
}

/* ---------- everything about one entry's values: what is shown, what counts, and what the formulas give ---------- */
// → { vis: { id: bool }, eff: { id: value } (what counts: hidden fields left out, calculated ones in), calc: { id: { v, err } } }
function xfdState(s, vals) {
  const fields = s.fields || [], plan = xfdPlan(s), by = new Map(fields.map(f => [f.id, f])), own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const eff = Object.create(null), vis = Object.create(null), calc = Object.create(null); vals = vals || {};
  for (const id of plan.order) {
    const f = by.get(id); if (!f) continue;
    const shown = f.when && !plan.loops[id] ? xfdMatch(f.when, eff, by) : true; vis[id] = shown;
    if (f.type === 'calculated') {
      const p = plan.fp.calc[id]; let r = { v: null, err: '' };
      if (!p) r = { v: null, err: '' }; else if (p.err) r = { v: null, err: p.err }; else {
        const get = ref => { const g = xfResolve(ref, fields); if (!g) throw xfErr(`There is no field called [${ref}]`); if (g.type === 'calculated') { const q = calc[g.id]; if (!q || q.err) throw xfErr('Depends on a field with a problem'); return q.v; } return xfNum(g, own(eff, g.id) ? eff[g.id] : undefined); };
        try { r = { v: xfRun(p.ast, get, xfToday), err: '' }; } catch (e) { if (!e.xf) throw e; r = { v: null, err: e.message }; }
      }
      if (!shown) r = { v: null, err: '' }; calc[id] = r; if (r.v !== null) eff[id] = r.v;
    } else if (shown && own(vals, id)) eff[id] = vals[id];
  }
  return { vis, eff, calc };
}
// what is wrong with an entry's values: [{ fid, msg }] (fields that are shown only; a required field must have a value). `st` is the state, when the caller has it already.
function xfdProblems(s, vals, st) {
  st = st || xfdState(s, vals); const out = [];
  for (const f of s.fields || []) {
    if (f.type === 'calculated' || !st.vis[f.id]) continue; const v = st.eff[f.id], empty = v == null || v === '' || (Array.isArray(v) && !v.length) || (f.type === 'check' && !v);
    if (empty) { if (f.req) out.push({ fid: f.id, msg: `“${f.name}” is required.` }); continue; }
    const m = xfdTypeBreak(f, v) || xfdBreaks(f, v); if (m) out.push({ fid: f.id, msg: m });
  }
  return out;
}
function xfdUrlOk(v) { // a web address people would type: http(s), a host with a dot (or localhost), no spaces; a bare "example.com" is fine
  const t = String(v).trim(); if (!t || /\s/.test(t)) return false; let u; try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : 'https://' + t); } catch (e) { return false; }
  return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname && (u.hostname.includes('.') || u.hostname === 'localhost') && !/^\.|\.$|\.\./.test(u.hostname);
}
function xfdTypeBreak(f, v) { // a value that is not even the right kind of thing
  const n = `“${f.name}”`;
  if (f.type === 'number' && xfdNum(v) === null) return `${n} must be a number.`;
  if (f.type === 'date' && !xfdIso(String(v))) return `${n} must be a date.`;
  if (f.type === 'url' && !xfdUrlOk(v)) return `${n} must be a web address, such as https://example.com.`;
  if (f.type === 'select' && !(f.opts || []).includes(v)) return `${n} is not one of the choices.`;
  if (f.type === 'multiselect' && (!Array.isArray(v) || v.some(x => !(f.opts || []).includes(x)))) return `${n} has a choice that is not in the list.`;
  if (f.type === 'rating' && xfdInt(v, 1, 5) === null) return `${n} must be 1 to 5 stars.`;
  return '';
}

/* ---------- showing a value ---------- */
function xfdNumText(x, fmt) {
  const o = fmt || {}, style = o.style || 'number', n = style === 'ratio' ? x * 100 : x, pct = style === 'percent' || style === 'ratio', dec = style === 'integer' ? 0 : o.dec;
  let s; try { s = n.toLocaleString(undefined, { minimumFractionDigits: dec == null ? 0 : dec, maximumFractionDigits: dec == null ? (pct ? 1 : 6) : dec, useGrouping: o.thou !== false }); } catch (e) { s = String(n); }
  return (o.prefix || '') + s + (pct ? '%' : '') + (o.unit ? ' ' + o.unit : '') + (o.suffix || '');
}
function xfdDateText(iso, how) {
  if (!xfdIso(iso)) return String(iso); if (how === 'iso') return iso;
  if (how === 'long') { const p = iso.split('-'); try { return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return iso; } }
  return typeof fmtDate === 'function' ? fmtDate(iso) : iso;
}
// the plain text of a value of field f (a calculated field's value comes from st.calc); '' when empty
function xfdText(f, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
  if (f.type === 'number') return typeof v === 'number' || xfdNum(v) !== null ? xfdNumText(xfdNum(v), f.fmt) : String(v);
  if (f.type === 'calculated') return typeof v !== 'number' ? '' : f.fmt && f.fmt.style === 'date' ? xfdDateText(xfFromDays(v), f.fmt.datefmt) : xfdNumText(v, f.fmt);
  if (f.type === 'date') return xfdDateText(String(v), f.fmt && f.fmt.datefmt);
  if (f.type === 'check') return v ? 'Yes' : '';
  if (Array.isArray(v)) return v.join(f.type === 'tags' ? ' ' : ', ');
  return String(v);
}
// the share of a progress bar (0 to 100) for a value, or null when the field does not show one
function xfdBar(f, v) { if (!f.fmt || !f.fmt.bar || typeof v !== 'number' || !Number.isFinite(v)) return null; const max = f.fmt.barMax || 100, x = f.fmt.style === 'ratio' ? v * 100 : v; return Math.max(0, Math.min(100, (x / max) * 100)); }
// does a section have anything that makes an entry's values more than what was typed (a condition, a formula)?
// does a section have any rule that can flag an entry (so a list should check them)?
const xfdRules = s => (s.fields || []).some(f => f.req || f.when || f.int || f.type === 'url' || f.type === 'calculated' || f.min != null || f.max != null || f.minLen != null || f.maxLen != null);
const xfdAdvanced = s => (s.fields || []).some(f => f.when || f.type === 'calculated');
// the state of an entry for the screen: null when nothing is conditional or calculated (then a value is what was typed)
const xfdStateOf = (s, e) => (xfdAdvanced(s) ? xfdState(s, e.vals) : null);
// the value of field f of an entry as the screen sees it (hidden fields: nothing; calculated: the result)
function xfdShown(s, e, f, st) { if (!st) return f.type === 'calculated' ? null : e.vals[f.id]; if (!st.vis[f.id]) return null; return f.type === 'calculated' ? (st.calc[f.id] || {}).v : e.vals[f.id]; }
// a stored value of an entry as the rest of the app should read it: nothing when the field is hidden (it counts as empty everywhere), and nothing for a calculated field
// (reminders and actions work on what is stored)
function xfdStored(s, e, id) {
  if (!e || !e.vals) return undefined; const f = (s.fields || []).find(x => x.id === id); if (!f || f.type === 'calculated') return undefined;
  if (xfdAdvanced(s) && xfdState(s, e.vals).vis[id] === false) return undefined; return e.vals[id];
}
// a field's value as text for a message or a link ({field} in a pack's templates): hidden gives '', a calculated field its result as it is shown, a list its items joined by spaces
function xfdFill(s, e, f) {
  const st = xfdStateOf(s, e), v = xfdShown(s, e, f, st); if (v == null || v === false || v === '') return '';
  return f.type === 'calculated' ? xfdText(f, v) : Array.isArray(v) ? v.join(' ') : String(v);
}
// a field's plain text on the screen, for search: a number as it is shown, a list joined
function xfdSearchText(s, e) { const st = xfdStateOf(s, e); return s.fields.map(f => { const v = xfdShown(s, e, f, st); if (v == null || v === '') return ''; return f.type === 'calculated' ? xfdText(f, v) : f.type === 'check' ? (v ? f.name : '') : Array.isArray(v) ? v.join(' ') : String(v); }).join(' '); }
// is a value what the field starts with anyway (so it does not count as something typed)?
function xfdIsDefault(f, v) { if (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) return true; if (f.def == null) return false; const d = f.def === 'today' ? xfdToday0() : f.def; return Array.isArray(d) ? Array.isArray(v) && v.length === d.length && d.every((x, i) => x === v[i]) : d === v; }

/* ---------- starting an entry ---------- */
// the values a new entry begins with: the fields' defaults, then a template's values over them
function xfdStart(s, tpl) {
  const vals = {}; for (const f of s.fields || []) if (f.def != null && f.type !== 'calculated') vals[f.id] = f.def === 'today' ? xfdToday0() : Array.isArray(f.def) ? f.def.slice() : f.def;
  if (tpl) for (const k of Object.keys(tpl.vals || {})) vals[k] = Array.isArray(tpl.vals[k]) ? tpl.vals[k].slice() : tpl.vals[k];
  return vals;
}
// a template applied to an entry that is being made or edited: it fills what is empty or still holds the field's own starting value, and never writes over what was typed
function xfdFillEmpty(s, e, tpl) {
  const n = { vals: 0, title: false, notes: false }; if (!tpl) return n; const by = {}; for (const f of s.fields || []) by[f.id] = f;
  for (const k of Object.keys(tpl.vals || {})) { const f = by[k]; if (f && xfdIsDefault(f, e.vals[k])) { e.vals[k] = Array.isArray(tpl.vals[k]) ? tpl.vals[k].slice() : tpl.vals[k]; n.vals++; } }
  if (tpl.title && !String(e.title || '').trim()) { e.title = tpl.title; n.title = true; } if (tpl.notes && !String(e.notes || '').trim()) { e.notes = tpl.notes; n.notes = true; }
  return n;
}
function xfdGroups(raw, ids) { // the field groups of a section
  const out = [], seen = {}; for (const g of (Array.isArray(raw) ? raw : []).slice(0, 8)) { if (!g || typeof g !== 'object') continue; let id = /^[\w-]{1,24}$/.test(g.id || '') ? g.id : 'g' + Math.random().toString(36).slice(2, 6); while (seen[id]) id += 'x'; seen[id] = 1; const name = xfdS(g.name, 40); if (!name) continue; const o = { id, name }; const d = xfdS(g.desc, 160); if (d) o.desc = d; out.push(o); } void ids; return out;
}
function xfdTemplates(raw, fields) { // the entry templates of a section: values are kept only for fields that exist, cut to their type
  const out = [], seen = {}, by = {}; for (const f of fields) by[f.id] = f;
  for (const t of (Array.isArray(raw) ? raw : []).slice(0, 8)) {
    if (!t || typeof t !== 'object') continue; const name = xfdS(t.name, 40); if (!name) continue;
    let id = /^[\w-]{1,24}$/.test(t.id || '') ? t.id : 't' + Math.random().toString(36).slice(2, 6); while (seen[id]) id += 'x'; seen[id] = 1;
    const vals = {}, rv = t.vals && typeof t.vals === 'object' && !Array.isArray(t.vals) ? t.vals : {};
    for (const k of Object.keys(rv).slice(0, 40)) { if (!Object.prototype.hasOwnProperty.call(by, k)) continue; const v = xfdValue(by[k], rv[k], true); if (v !== null && !xfdBreaks(by[k], v)) vals[k] = v; }
    const o = { id, name }; const d = xfdS(t.desc, 160); if (d) o.desc = d; const ti = xfdS(t.title, 200); if (ti) o.title = ti; const no = typeof t.notes === 'string' ? t.notes.slice(0, 2000) : ''; if (no.trim()) o.notes = no; o.vals = vals; out.push(o);
  }
  return out;
}
// a calculated value never sits in an entry (it is worked out, not kept): take out any that a field turning into a calculated one leaves behind. Nothing a person typed in another kind of field is touched.
function xsRevalidate(s) {
  let changed = 0;
  for (const sec of s ? [s] : S.csections) { const calc = sec.fields.filter(f => f.type === 'calculated'); if (!calc.length) continue; for (const e of xsEntries(sec)) for (const f of calc) if (Object.prototype.hasOwnProperty.call(e.vals, f.id)) { delete e.vals[f.id]; changed++; } }
  return changed;
}
