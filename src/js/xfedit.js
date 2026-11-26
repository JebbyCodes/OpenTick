/* The section editor's side of the advanced fields (xsections.js xsEditSection): the details of each field (description, placeholder, default, required,
   limits, format, group, shown-when, formula), the field groups, and the entry templates.
   The editor works on a copy of the section (`st`); a closed details panel leaves its field untouched, an open one is read back into it, and everything goes through
   xsNormalise on save, which cuts whatever does not fit. A formula is shown with field NAMES (what a person writes) and stored with field IDS (so a rename breaks nothing). */
const xfeOpen = { f: new Set(), t: new Set() }; // which details panels are open, by field id / template id (kept across repaints, cleared when the editor opens)
const XFE_OPS = [['equals', 'is'], ['notEquals', 'is not'], ['in', 'is one of'], ['notIn', 'is none of'], ['filled', 'has a value'], ['empty', 'is empty']];
const xfeRow = (label, ctl, hint) => `<label class="xfe-r"><span>${label}</span>${ctl}${hint ? `<small class="hint">${hint}</small>` : ''}</label>`;
const xfeIn = (k, v, attrs) => `<input data-fd="${k}" value="${esc(v == null ? '' : v)}" ${attrs || ''} autocomplete="off">`;
const xfeChk = (k, on, label) => `<label class="chkl"><input type="checkbox" data-fd="${k}"${on ? ' checked' : ''}> ${label}</label>`;
const xfeSel = (k, list, cur) => `<select data-fd="${k}">${opts(list, cur)}</select>`;
const xfeNumber = f => f.type === 'number' || f.type === 'calculated';

/* ---------- formulas: names for people, ids for storage ---------- */
function xfeFormulaShow(src, fields) { // ids → names (a name that would be ambiguous or has a bracket stays an id)
  return xfRewrite(src, ref => { const f = fields.find(x => x.id === ref); if (!f) return null; const n = String(f.name).trim(); if (!n || /[\]\[]/.test(n)) return null; const same = fields.filter(x => String(x.name).trim().toLowerCase() === n.toLowerCase()); return same.length === 1 ? n : null; });
}
function xfeFormulaStore(src, fields) { return xfRewrite(src, ref => { const f = xfResolve(ref, fields); return f ? f.id : null; }); }
function xfeSample(s) { const e = s ? xsEntries(s)[0] : null; return e ? { vals: e.vals, title: e.title } : { vals: {}, title: '' }; }
// what a formula would give for the first entry (or for an empty one), as a line of text
function xfePreview(src, st, f, s) {
  const text = String(src || '').trim(); if (!text) return { ok: false, html: 'Write a formula, for example <code>[Price] * [Quantity]</code>.' };
  const fields = st.fields.map(x => (x === f ? { ...x, formula: xfeFormulaStore(text, st.fields) } : x)), sam = xfeSample(s), r = xfCheck(xfeFormulaStore(text, st.fields), fields, f.id, sam.vals, f.name);
  if (!r.ok) return { ok: false, html: `${ic('alert', 13)} ${esc(r.err)}` };
  const shown = r.value === null ? 'empty (a field it needs is empty)' : xfdText({ ...f, type: 'calculated' }, r.value) || String(r.value);
  return { ok: true, html: `${ic('check', 13)} ${sam.title ? 'For “' + esc(sam.title) + '”' : 'With nothing filled in'}: <b>${esc(shown)}</b>` };
}

/* ---------- the details of one field ---------- */
function xfeDefault(f) {
  const v = f.def, t = f.type;
  if (t === 'check') return xfeChk('def', v === true, 'Ticked to begin with');
  if (t === 'date') return xfeRow('Starts as', `<span class="xfe-2">${xfeSel('defmode', [['', 'Empty'], ['today', 'Today'], ['date', 'A date']], v === 'today' ? 'today' : v ? 'date' : '')}<input type="date" data-fd="def" value="${v && v !== 'today' ? esc(v) : ''}"></span>`);
  if (t === 'select') return xfeRow('Starts as', xfeSel('def', [['', 'Empty'], ...(f.opts || []).map(o => [o, o])], v || ''));
  if (t === 'rating') return xfeRow('Starts as', xfeSel('def', [['', 'No rating'], ...[1, 2, 3, 4, 5].map(n => [String(n), n + (n === 1 ? ' star' : ' stars')])], v ? String(v) : ''));
  if (t === 'multiselect') return `<fieldset class="xfe-m"><legend>Starts with</legend>${(f.opts || []).map(o => `<label class="chkl"><input type="checkbox" data-fdm="def" value="${esc(o)}"${(v || []).includes(o) ? ' checked' : ''}> ${esc(o)}</label>`).join('') || '<small class="hint">Add options first.</small>'}</fieldset>`;
  if (t === 'tags') return xfeRow('Starts with', xfeIn('def', (v || []).map(x => '#' + x).join(' '), 'placeholder="#one #two"'));
  if (t === 'number') return xfeRow('Starts as', xfeIn('def', v == null ? '' : v, 'type="number" step="any"'));
  return xfeRow('Starts as', xfeIn('def', v || '', 'maxlength="500"'));
}
function xfeFormat(f) {
  const o = f.fmt || {}, styles = [['number', 'Number'], ['integer', 'Whole number'], ['percent', 'Percent (45 shows as 45%)'], ['ratio', 'Ratio (0.45 shows as 45%)']];
  if (f.type === 'calculated') styles.push(['date', 'A date (the result is a day)']);
  return `<fieldset class="xfe-m"><legend>How it looks</legend>${xfeRow('Style', xfeSel('fmt.style', styles, o.style || 'number'))}<span class="xfe-2">${xfeRow('Decimals', xfeIn('fmt.dec', o.dec, 'type="number" min="0" max="6" step="1" placeholder="Automatic"'))}${xfeRow('Unit', xfeIn('fmt.unit', o.unit, 'maxlength="12" placeholder="kg, pages…"'))}</span><span class="xfe-2">${xfeRow('Before', xfeIn('fmt.prefix', o.prefix, 'maxlength="8" placeholder="$"'))}${xfeRow('After', xfeIn('fmt.suffix', o.suffix, 'maxlength="12" placeholder="/ month"'))}</span>${xfeChk('fmt.thou', o.thou !== false, 'Group thousands (1,234)')}${xfeChk('fmt.bar', !!o.bar, 'Show a progress bar')}${xfeRow('Bar is full at', xfeIn('fmt.barMax', o.barMax, 'type="number" min="0" step="any" placeholder="100"'), 'Ratio style: 1 is full.')}</fieldset>`;
}
function xfeLimits(f) {
  const t = f.type;
  if (t === 'number') return `<span class="xfe-2">${xfeRow('Smallest', xfeIn('min', f.min, 'type="number" step="any"'))}${xfeRow('Largest', xfeIn('max', f.max, 'type="number" step="any"'))}</span>${xfeChk('int', f.int, 'Whole numbers only')}`;
  if (t === 'date') { const md = k => (f[k] === 'today' ? 'today' : f[k] ? 'date' : ''); return xfeRow('Earliest', `<span class="xfe-2">${xfeSel('minmode', [['', 'Any day'], ['today', 'Today'], ['date', 'A date']], md('min'))}<input type="date" data-fd="min" value="${f.min && f.min !== 'today' ? esc(f.min) : ''}"></span>`) + xfeRow('Latest', `<span class="xfe-2">${xfeSel('maxmode', [['', 'Any day'], ['today', 'Today'], ['date', 'A date']], md('max'))}<input type="date" data-fd="max" value="${f.max && f.max !== 'today' ? esc(f.max) : ''}"></span>`) + xfeRow('Shown as', xfeSel('fmt.datefmt', [['short', 'Short (15 Jan 2026)'], ['long', 'Long (Thursday 15 January 2026)'], ['iso', '2026-01-15']], (f.fmt || {}).datefmt || 'short')); }
  if (t === 'text' || t === 'note' || t === 'url') return `<span class="xfe-2">${xfeRow('Shortest', xfeIn('minLen', f.minLen, 'type="number" min="1" max="5000" step="1"'))}${xfeRow('Longest', xfeIn('maxLen', f.maxLen, 'type="number" min="1" max="5000" step="1"'))}</span>`;
  if (t === 'multiselect' || t === 'tags') return `<span class="xfe-2">${xfeRow('At least', xfeIn('min', f.min, 'type="number" min="1" step="1" placeholder="No minimum"'))}${xfeRow('At most', xfeIn('max', f.max, 'type="number" min="1" step="1" placeholder="No maximum"'))}</span>`;
  return '';
}
// the "shown when" rows of a field: one or more conditions about other fields, joined by all / any
function xfeConds(f) { const w = f.when; if (!w) return { mode: 'all', rows: [] }; if (w.all || w.any) return { mode: w.all ? 'all' : 'any', rows: (w.all || w.any).slice() }; return { mode: 'all', rows: [w] }; }
const xfeOpOf = c => ('equals' in c ? 'equals' : 'notEquals' in c ? 'notEquals' : c.in ? 'in' : c.notIn ? 'notIn' : c.filled === false ? 'empty' : 'filled');
function xfeCondRow(st, f, c, k) {
  const others = st.fields.filter(x => x.id !== f.id), tgt = st.fields.find(x => x.id === c.field) || others[0], op = xfeOpOf(c), v = op === 'equals' ? c.equals : op === 'notEquals' ? c.notEquals : '';
  let val = '';
  if (op === 'equals' || op === 'notEquals') {
    if (tgt && (tgt.type === 'select' || tgt.type === 'multiselect')) val = `<select data-wv aria-label="Value">${opts([['', '—'], ...(tgt.opts || []).map(o => [o, o])], v === undefined ? '' : String(v))}</select>`;
    else if (tgt && tgt.type === 'check') val = `<select data-wv aria-label="Value">${opts([['true', 'ticked'], ['false', 'not ticked']], v === false || v === 'false' ? 'false' : 'true')}</select>`;
    else val = `<input data-wv value="${esc(v == null ? '' : v)}" maxlength="40" aria-label="Value" autocomplete="off">`;
  } else if (op === 'in' || op === 'notIn') val = `<input data-wv value="${esc((c.in || c.notIn || []).join(', '))}" maxlength="200" placeholder="one, two" aria-label="Values, separated by commas" autocomplete="off">`;
  return `<div class="xfe-w" data-wr="${k}"><select data-wf aria-label="Field">${opts(others.map(x => [x.id, x.name || '(unnamed)']), tgt ? tgt.id : '')}</select><select data-wo aria-label="Condition">${opts(XFE_OPS, op)}</select>${val}<button type="button" class="ib sm" data-m="wrm" data-k="${k}" title="Remove this condition" aria-label="Remove this condition">${ic('x', 14)}</button></div>`;
}
function xfeWhen(st, f) {
  const others = st.fields.filter(x => x.id !== f.id), cs = xfeConds(f); if (!others.length) return `<fieldset class="xfe-m"><legend>Shown when</legend><small class="hint">Add another field to use as a condition.</small></fieldset>`;
  return `<fieldset class="xfe-m"><legend>Shown when</legend>${cs.rows.length > 1 ? `<label class="xfe-r"><span>Show this field when</span><select data-wm>${opts([['all', 'all of these are true'], ['any', 'any of these is true']], cs.mode)}</select></label>` : ''}${cs.rows.map((c, k) => xfeCondRow(st, f, c, k)).join('')}${cs.rows.length < 4 ? `<button type="button" class="btn sm" data-m="wadd" data-fid="${f.id}">${ic('plus', 13)} ${cs.rows.length ? 'Add a condition' : 'Only show it when…'}</button>` : ''}${cs.rows.length ? '' : '<small class="hint">Always shown. A field that is hidden keeps what was typed and counts as empty.</small>'}</fieldset>`;
}
function xfePanel(st, f, s) {
  const t = f.type, gs = st.fgroups || [], parts = [xfeRow('Description', xfeIn('desc', f.desc, 'maxlength="200" placeholder="Help shown under the field"'))];
  if (t === 'calculated') {
    const shown = xfeFormulaShow(f.formula || '', st.fields), pv = xfePreview(shown, st, f, s);
    parts.push(`<label class="xfe-r"><span>Formula</span><textarea data-fd="formula" rows="2" spellcheck="false" maxlength="300" placeholder="[Pages read] / [Total pages] * 100" aria-describedby="xfp-${f.id}">${esc(shown)}</textarea></label><label class="xfe-r"><span>Insert a field</span><select data-xfins aria-label="Insert a field into the formula">${opts([['', 'Choose…'], ...st.fields.filter(x => x.id !== f.id && ['number', 'rating', 'check', 'date', 'calculated'].includes(x.type)).map(x => [x.id, x.name || '(unnamed)'])], '')}</select></label><p class="xfe-pv${pv.ok ? ' ok' : ' bad'}" id="xfp-${f.id}" data-xfpv aria-live="polite">${pv.html}</p><small class="hint">Numbers, dates, tick boxes and ratings of this section, and + − × ÷ ( ), min, max, round, if, today and more. Nothing else is ever run.</small>`);
  } else {
    if (!['check', 'rating'].includes(t)) parts.push(xfeRow('Placeholder', xfeIn('ph', f.ph, 'maxlength="60" placeholder="Shown inside the empty box"')));
    if (t !== 'check') parts.push(xfeChk('req', f.req, 'Required: an entry cannot be saved without it'));
    parts.push(xfeLimits(f), xfeDefault(f));
  }
  if (xfeNumber(f)) parts.push(xfeFormat(f));
  if (gs.length) parts.push(xfeRow('Group', xfeSel('fg', [['', '(none)'], ...gs.map(g => [g.id, g.name])], f.fg || '')));
  parts.push(xfeWhen(st, f));
  return `<div class="xs-fx" data-fx="${f.id}">${parts.join('')}</div>`;
}
// one line under a closed field saying what is special about it
function xfeSummary(st, f) {
  const a = [], g = (st.fgroups || []).find(x => x.id === f.fg);
  if (f.type === 'calculated') a.push('= ' + (xfeFormulaShow(f.formula || '', st.fields) || 'no formula yet')); if (f.req) a.push('required'); if (f.when) a.push('conditional'); if (g) a.push('in “' + g.name + '”'); if (f.def != null) a.push('has a starting value');
  if (f.min != null || f.max != null || f.minLen != null || f.maxLen != null || f.int) a.push('limits'); if (f.fmt && Object.keys(f.fmt).length) a.push('formatted');
  return a.length ? `<small class="xs-fs">${esc(a.join(' · '))}</small>` : '';
}
function xfeFieldExtras(st, f, i, s) { // what xsFieldRows adds to a row: the details button's state, a summary, the panel
  const open = xfeOpen.f.has(f.id);
  return { btn: `<button type="button" class="ib sm${open ? ' on' : ''}" data-m="fdet" data-i="${i}" aria-expanded="${open}" title="Details of this field" aria-label="Details of ${esc(f.name || 'this field')}">${ic('sliders', 14)}</button>`, tail: open ? xfePanel(st, f, s) : xfeSummary(st, f) };
}

/* ---------- reading an open panel back ---------- */
const xfeSet = (f, k, v) => { if (v === undefined || v === null || v === '' || v === false) delete f[k]; else f[k] = v; };
function xfeReadPanel(r, f) {
  const p = $('[data-fx]', r); if (!p) return; const g = k => $(`[data-fd="${k}"]`, p), has = k => !!g(k), val = k => (has(k) ? g(k).value : undefined), on = k => (has(k) ? g(k).checked : undefined);
  if (has('desc')) xfeSet(f, 'desc', val('desc').trim()); if (has('ph')) xfeSet(f, 'ph', val('ph').trim()); if (has('req')) xfeSet(f, 'req', on('req')); if (has('int')) xfeSet(f, 'int', on('int'));
  if (has('formula')) f.formula = xfeFormulaStore(val('formula'), []); // (names are turned into ids by the caller, who knows all the fields)
  const num = k => (has(k) && val(k) !== '' ? Number(val(k)) : undefined);
  if (f.type === 'number' || f.type === 'multiselect' || f.type === 'tags') { xfeSet(f, 'min', num('min')); xfeSet(f, 'max', num('max')); }
  if (f.type === 'date') for (const k of ['min', 'max']) { const m = val(k + 'mode'); xfeSet(f, k, m === 'today' ? 'today' : m === 'date' ? val(k) || undefined : undefined); }
  if (has('minLen')) { xfeSet(f, 'minLen', num('minLen')); xfeSet(f, 'maxLen', num('maxLen')); }
  if (has('fg')) xfeSet(f, 'fg', val('fg'));
  if (f.type !== 'calculated' && (has('def') || has('defmode') || $('[data-fdm="def"]', p))) {
    let d;
    if (f.type === 'check') d = on('def') ? true : undefined; else if (f.type === 'date') { const m = val('defmode'); d = m === 'today' ? 'today' : m === 'date' ? val('def') || undefined : undefined; }
    else if (f.type === 'multiselect') { const c = $$('[data-fdm="def"]:checked', p).map(x => x.value); d = c.length ? c : undefined; }
    else if (f.type === 'rating') d = val('def') ? Number(val('def')) : undefined; else if (f.type === 'tags') d = val('def').split(/[\s,]+/).map(x => x.replace(/^#/, '')).filter(Boolean); else if (f.type === 'number') d = num('def'); else d = val('def') || undefined;
    xfeSet(f, 'def', Array.isArray(d) && !d.length ? undefined : d);
  }
  if (has('fmt.style')) {
    const fm = {}, n = k => (has(k) && val(k) !== '' ? Number(val(k)) : undefined), s = val('fmt.style'); if (s && s !== 'number') fm.style = s;
    const dec = n('fmt.dec'); if (dec !== undefined && s !== 'integer') fm.dec = dec; for (const k of ['prefix', 'suffix', 'unit']) { const v = k === 'unit' ? val('fmt.' + k).trim() : val('fmt.' + k); if (v && v.trim()) fm[k] = v; }
    if (!on('fmt.thou')) fm.thou = false; if (on('fmt.bar')) { fm.bar = true; const b = n('fmt.barMax'); if (b !== undefined) fm.barMax = b; }
    if (has('fmt.datefmt') && val('fmt.datefmt') !== 'short') fm.datefmt = val('fmt.datefmt'); xfeSet(f, 'fmt', Object.keys(fm).length ? fm : undefined);
  } else if (has('fmt.datefmt')) { const d = val('fmt.datefmt'); xfeSet(f, 'fmt', d && d !== 'short' ? { datefmt: d } : undefined); }
  // shown when
  {
    const rows = $$('[data-wr]', p).map(w => {
      const field = $('[data-wf]', w).value, op = $('[data-wo]', w).value, v = $('[data-wv]', w), raw = v ? v.value : '', c = { field };
      if (op === 'filled') c.filled = true; else if (op === 'empty') c.filled = false;
      else if (op === 'equals' || op === 'notEquals') c[op] = raw === 'true' ? true : raw === 'false' ? false : raw;
      else c[op] = raw.split(',').map(x => x.trim()).filter(Boolean);
      return c;
    });
    const m = $('[data-wm]', p), mode = m ? m.value : 'all';
    if (!rows.length) delete f.when; else f.when = rows.length === 1 ? rows[0] : { [mode]: rows };
  }
}

/* ---------- field groups ---------- */
function xfeGroupsHtml(st) {
  const gs = st.fgroups || [];
  return `<div class="pe-sec"><b>Field groups</b><small class="hint">Boxes with a heading, to keep a long form tidy. Fields without a group come first.</small><div id="xs-groups">${gs.map((g, i) => `<div class="xfe-g" data-gr="${i}"><input data-gn value="${esc(g.name)}" maxlength="40" placeholder="Group name" aria-label="Group name" autocomplete="off"><input data-gd value="${esc(g.desc || '')}" maxlength="160" placeholder="A line of help (optional)" aria-label="Group help" autocomplete="off"><span class="xs-fb"><button type="button" class="ib sm" data-m="gup" data-i="${i}"${i ? '' : ' disabled'} title="Move up" aria-label="Move group up">${ic('up', 14)}</button><button type="button" class="ib sm" data-m="gdn" data-i="${i}"${i < gs.length - 1 ? '' : ' disabled'} title="Move down" aria-label="Move group down">${ic('down', 14)}</button><button type="button" class="ib sm" data-m="grm" data-i="${i}" title="Remove this group" aria-label="Remove group">${ic('x', 14)}</button></span></div>`).join('')}</div>${gs.length < 8 ? `<button type="button" class="btn sm" data-m="gadd">${ic('plus', 13)} Add a group</button>` : ''}</div>`;
}
function xfeReadGroups(m, st) {
  const rows = $$('[data-gr]', m); if (!$('#xs-groups', m)) return;
  st.fgroups = rows.map((r, i) => { const old = (st.fgroups || [])[i] || {}; return { id: old.id, name: $('[data-gn]', r).value, desc: $('[data-gd]', r).value }; });
}

/* ---------- templates ---------- */
function xfeMini(f, v) {
  const lab = esc(f.name), a = `data-tv="${f.id}"`;
  if (f.type === 'check') return `<label class="chkl"><input type="checkbox" ${a}${v ? ' checked' : ''}> ${lab}</label>`;
  if (f.type === 'select') return xfeRow(lab, `<select ${a}>${opts([['', '—'], ...(f.opts || []).map(o => [o, o])], v || '')}</select>`);
  if (f.type === 'rating') return xfeRow(lab, `<select ${a}>${opts([['', '—'], ...[1, 2, 3, 4, 5].map(n => [String(n), n + ' ★'])], v ? String(v) : '')}</select>`);
  if (f.type === 'multiselect') return `<fieldset class="xfe-m"><legend>${lab}</legend>${(f.opts || []).map(o => `<label class="chkl"><input type="checkbox" data-tvm="${f.id}" value="${esc(o)}"${(v || []).includes(o) ? ' checked' : ''}> ${esc(o)}</label>`).join('')}</fieldset>`;
  if (f.type === 'tags') return xfeRow(lab, `<input ${a} value="${esc((v || []).map(x => '#' + x).join(' '))}" placeholder="#one #two" autocomplete="off">`);
  if (f.type === 'note') return xfeRow(lab, `<textarea ${a} rows="2">${esc(v || '')}</textarea>`);
  return xfeRow(lab, `<input ${a} type="${{ number: 'number', date: 'date' }[f.type] || 'text'}"${f.type === 'number' ? ' step="any"' : ''} value="${esc(v == null ? '' : v)}" autocomplete="off">`);
}
function xfeTemplatesHtml(st) {
  const ts = st.tpls || [], fields = st.fields.filter(f => f.type !== 'calculated');
  return `<div class="pe-sec"><b>Entry templates</b><small class="hint">Starting points for a new entry: a title, notes and values filled in for you. They never overwrite what has been typed.</small><div id="xs-tpls">${ts.map((t, j) => { const open = xfeOpen.t.has(t.id); return `<div class="xfe-t" data-tr="${j}"><div class="xs-fr"><input data-tn value="${esc(t.name)}" maxlength="40" placeholder="Template name" aria-label="Template name" autocomplete="off"><input data-td value="${esc(t.desc || '')}" maxlength="160" placeholder="What it is for" aria-label="Template description" autocomplete="off"><span class="xs-fb"><button type="button" class="ib sm${open ? ' on' : ''}" data-m="tdet" data-i="${j}" aria-expanded="${open}" title="Edit what it fills in" aria-label="Edit what ${esc(t.name || 'this template')} fills in">${ic('sliders', 14)}</button><button type="button" class="ib sm" data-m="trm" data-i="${j}" title="Remove this template" aria-label="Remove template">${ic('x', 14)}</button></span></div>${open ? `<div class="xs-fx" data-tx="${j}">${xfeRow('Title', `<input data-tt value="${esc(t.title || '')}" maxlength="200" autocomplete="off">`)}${xfeRow('Notes', `<textarea data-tnotes rows="2">${esc(t.notes || '')}</textarea>`)}${fields.map(f => xfeMini(f, (t.vals || {})[f.id])).join('') || '<small class="hint">Add fields to fill in.</small>'}</div>` : ''}</div>`; }).join('')}</div>${ts.length < 8 ? `<button type="button" class="btn sm" data-m="tadd">${ic('plus', 13)} Add a template</button>` : ''}</div>`;
}
function xfeReadTemplates(m, st) {
  if (!$('#xs-tpls', m)) return;
  st.tpls = $$('[data-tr]', m).map((r, j) => {
    const old = (st.tpls || [])[j] || {}, t = { id: old.id, name: $('[data-tn]', r).value, desc: $('[data-td]', r).value, title: old.title, notes: old.notes, vals: old.vals || {} }, p = $('[data-tx]', r);
    if (p) {
      t.title = $('[data-tt]', p).value; t.notes = $('[data-tnotes]', p).value; t.vals = {};
      for (const f of st.fields) {
        if (f.type === 'calculated') continue; let v;
        if (f.type === 'multiselect') { const c = $$(`[data-tvm="${f.id}"]:checked`, p).map(x => x.value); v = c.length ? c : undefined; } else { const el = $(`[data-tv="${f.id}"]`, p); if (!el) continue; v = f.type === 'check' ? (el.checked ? true : undefined) : f.type === 'number' ? (el.value === '' ? undefined : Number(el.value)) : f.type === 'rating' ? (el.value ? Number(el.value) : undefined) : f.type === 'tags' ? el.value.split(/[\s,]+/).map(x => x.replace(/^#/, '')).filter(Boolean) : el.value || undefined; }
        if (v !== undefined && !(Array.isArray(v) && !v.length)) t.vals[f.id] = v;
      }
    }
    return t;
  });
}

/* ---------- the editor's own clicks and typing ---------- */
// true when the click was one of ours; `paint` redraws the editor body
function xfeClick(b, m, st, paint, s) {
  const k = b.dataset.m, i = +b.dataset.i, swap = (a, x, y) => { if (y >= 0 && y < a.length) { [a[x], a[y]] = [a[y], a[x]]; paint(m); } };
  if (k === 'fdet') { const f = st.fields[i]; if (!f) return true; if (xfeOpen.f.has(f.id)) xfeOpen.f.delete(f.id); else xfeOpen.f.add(f.id); paint(m); const x = $(`[data-fx="${f.id}"] input, [data-fx="${f.id}"] textarea`, m); if (x && xfeOpen.f.has(f.id) && x.focus) x.focus(); return true; }
  if (k === 'wadd') { const f = st.fields.find(x => x.id === b.dataset.fid), first = f && st.fields.find(x => x.id !== f.id); if (!f || !first) return true; const cs = xfeConds(f); cs.rows.push({ field: first.id, filled: true }); f.when = cs.rows.length === 1 ? cs.rows[0] : { [cs.mode]: cs.rows }; paint(m); return true; }
  if (k === 'wrm') { const f = st.fields.find(x => $(`[data-fx="${x.id}"]`, m) && $(`[data-fx="${x.id}"]`, m).contains(b)); if (!f) return true; const cs = xfeConds(f); cs.rows.splice(+b.dataset.k, 1); if (cs.rows.length) f.when = cs.rows.length === 1 ? cs.rows[0] : { [cs.mode]: cs.rows }; else delete f.when; paint(m); return true; }
  if (k === 'gadd') { st.fgroups = st.fgroups || []; st.fgroups.push({ id: 'g' + Math.random().toString(36).slice(2, 6), name: '' }); paint(m); const r = $$('[data-gn]', m); r[r.length - 1].focus(); return true; }
  if (k === 'grm') { st.fgroups.splice(i, 1); paint(m); return true; }
  if (k === 'gup' || k === 'gdn') { swap(st.fgroups, i, i + (k === 'gup' ? -1 : 1)); return true; }
  if (k === 'tadd') { st.tpls = st.tpls || []; const t = { id: 't' + Math.random().toString(36).slice(2, 6), name: '', vals: {} }; st.tpls.push(t); xfeOpen.t.add(t.id); paint(m); const r = $$('[data-tn]', m); r[r.length - 1].focus(); return true; }
  if (k === 'trm') { const t = st.tpls[i]; if (t) xfeOpen.t.delete(t.id); st.tpls.splice(i, 1); paint(m); return true; }
  if (k === 'tdet') { const t = st.tpls[i]; if (!t) return true; if (xfeOpen.t.has(t.id)) xfeOpen.t.delete(t.id); else xfeOpen.t.add(t.id); paint(m); return true; }
  void s; return false;
}
// a changed select that changes what else is on the screen (a condition's field or operator): true when the editor must repaint
const xfeRepaintOn = el => !!(el.matches && el.matches('[data-wf], [data-wo], [data-fo]'));
// typing in a formula: the preview line follows; picking a field from "Insert a field" puts its name at the cursor
function xfeInput(e, m, st, s) {
  const el = e.target; if (!el || !el.matches) return false;
  if (el.matches('[data-xfins]')) { const ta = $('[data-fd="formula"]', el.closest('[data-fx]')), f = st.fields.find(x => x.id === el.value); if (ta && f) { const nm = /[\]\[]/.test(f.name) ? f.id : f.name, a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, z = ta.selectionEnd == null ? a : ta.selectionEnd; ta.value = ta.value.slice(0, a) + '[' + nm + ']' + ta.value.slice(z); ta.focus(); const p = a + nm.length + 2; ta.setSelectionRange(p, p); xfeShowPreview(m, st, s, ta); } el.value = ''; return true; }
  if (el.matches('[data-fd="formula"]')) { xfeShowPreview(m, st, s, el); return true; }
  return false;
}
function xfeShowPreview(m, st, s, ta) {
  const p = ta.closest('[data-fx]'), f = st.fields.find(x => x.id === p.dataset.fx), out = $('[data-xfpv]', p); if (!f || !out) return;
  const pv = xfePreview(ta.value, st, f, s); out.className = 'xfe-pv ' + (pv.ok ? 'ok' : 'bad') + (!ta.value.trim() ? ' bad' : ''); out.innerHTML = pv.html;
}
// before saving: every formula must work and no condition may lead back to itself. Returns a message and the field to show, or null.
function xfeProblem(st) {
  for (const f of st.fields) if (f.type === 'calculated') { const r = xfCheck(f.formula || '', st.fields, f.id, {}, f.name); if (!r.ok) return { fid: f.id, msg: `The formula of “${f.name}”: ${r.err}` }; }
  const plan = xfdPlan({ fields: st.fields }); for (const id of Object.keys(plan.loops)) { const f = st.fields.find(x => x.id === id); return { fid: id, msg: `“${f ? f.name : id}”: ${plan.loops[id]}` }; }
  return null;
}
