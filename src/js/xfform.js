/* The entry editor of a custom section (xsections.js xsEditEntry) with the advanced fields of xfields.js:
   descriptions and placeholders, required marks, limits, fields that appear and disappear as the entry changes (shown-when), calculated fields that update as you type,
   field groups, a multi-select with its own search, and templates for a new entry. Every message is plain text and goes with the field it is about (aria-describedby),
   and nothing is said about a field a person has not been to yet, until they try to save. */
const xfuId = (p, f) => p + '-' + f.id;
const xfuLimit = (f, k) => (f[k] === 'today' ? xfdToday0() : f[k]);
function xfuControl(f, v, calc) {
  const lab = esc(f.name) + (f.req ? ' <b class="xs-rq" aria-hidden="true">*</b>' : ''), ids = [f.desc ? xfuId('xd', f) : '', xfuId('xe', f)].filter(Boolean).join(' ');
  const a = ` aria-describedby="${ids}"${f.req ? ' aria-required="true"' : ''}`, ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
  if (f.type === 'calculated') return `<div class="lbl"><span>${lab} <small class="xs-ro">calculated</small></span><output class="xs-co" data-xc="${f.id}" aria-live="polite"${a}>${calc ? xsShow(f, calc.v) || '<span class="xs-na">—</span>' : '<span class="xs-na">—</span>'}</output></div>`;
  if (f.type === 'check') return `<label class="chkl"><input type="checkbox" data-xv="${f.id}"${v ? ' checked' : ''}${a}> ${lab}</label>`;
  if (f.type === 'note') return `<label><span>${lab}</span><textarea data-xv="${f.id}" rows="3"${ph}${a}>${esc(v || '')}</textarea></label>`;
  if (f.type === 'select') return `<label><span>${lab}</span><select data-xv="${f.id}"${a}>${opts([['', '—'], ...f.opts.map(o => [o, o])], v || '')}</select></label>`;
  if (f.type === 'multiselect') {
    const sel = Array.isArray(v) ? v : [], many = f.opts.length > 8;
    return `<fieldset class="xs-ms" data-xm="${f.id}"${a}><legend>${lab}</legend>${many ? `<input type="search" class="xs-mf" data-xms="${f.id}" placeholder="Find an option" aria-label="Find an option in ${esc(f.name)}" autocomplete="off">` : ''}<div class="xs-mo">${f.opts.map(o => `<label class="chkl" data-o="${esc(o.toLowerCase())}"><input type="checkbox" data-xmv="${f.id}" value="${esc(o)}"${sel.includes(o) ? ' checked' : ''}> ${esc(o)}</label>`).join('') || '<small class="hint">This field has no options yet.</small>'}</div><small class="xs-mc" data-xmc="${f.id}" aria-live="polite">${sel.length ? sel.length + ' selected' : 'None selected'}</small></fieldset>`;
  }
  if (f.type === 'rating') { const n = +v || 0; return `<div class="lbl"><span>${lab}</span><div class="xs-rate" data-xr="${f.id}" data-v="${n}" role="radiogroup" aria-label="${esc(f.name)}"${a}>${[1, 2, 3, 4, 5].map(i => `<button type="button" class="${i <= n ? 'on' : ''}" data-star="${i}" role="radio" aria-checked="${i === n}" aria-label="${i} star${i > 1 ? 's' : ''}">${ic('star', 20)}</button>`).join('')}<button type="button" class="btn sm" data-star="0">Clear</button></div></div>`; }
  if (f.type === 'tags') return `<label><span>${lab}</span><input data-xv="${f.id}" value="${esc((Array.isArray(v) ? v : []).map(g => '#' + g).join(' '))}" placeholder="${esc(f.ph || '#one #two')}"${a}></label>`;
  const lim = f.type === 'number' ? `${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}` : f.type === 'date' ? `${f.min != null ? ` min="${xfuLimit(f, 'min')}"` : ''}${f.max != null ? ` max="${xfuLimit(f, 'max')}"` : ''}` : '';
  return `<label><span>${lab}</span><input id="${xfuId('xv', f)}" data-xv="${f.id}" type="${{ number: 'number', date: 'date', url: 'url' }[f.type] || 'text'}"${f.type === 'number' ? ` step="${f.int ? 1 : 'any'}" inputmode="${f.int ? 'numeric' : 'decimal'}"` : ''}${lim} value="${esc(v == null ? '' : v)}" autocomplete="off"${ph}${a}></label>`;
}
// one field with its help line and its (empty) message line; hidden when its condition says so
function xfuField(f, v, st) {
  const shown = !st || st.vis[f.id] !== false;
  return `<div class="xs-fld" data-fld="${f.id}"${shown ? '' : ' hidden'}>${xfuControl(f, v, st && st.calc[f.id])}${f.desc ? `<small class="xs-d" id="${xfuId('xd', f)}">${esc(f.desc)}</small>` : ''}<small class="xs-er" id="${xfuId('xe', f)}" hidden></small></div>`;
}
// the title, the tick box, the fields (ungrouped first, then each group in its own box), and the notes: what a template or a repaint replaces
function xfuCoreHtml(s, st) {
  const state = xfdAdvanced(s) ? xfdState(s, st.vals) : null, fld = f => xfuField(f, st.vals[f.id], state), gs = s.fgroups || [];
  const loose = s.fields.filter(f => !f.fg || !gs.some(g => g.id === f.fg)).map(fld).join('');
  const boxes = gs.map(g => { const own = s.fields.filter(f => f.fg === g.id); if (!own.length) return ''; const any = !state || own.some(f => state.vis[f.id] !== false); return `<fieldset class="xs-fg" data-fgrp="${g.id}"${any ? '' : ' hidden'}><legend>${esc(g.name)}</legend>${g.desc ? `<small class="xs-d">${esc(g.desc)}</small>` : ''}${own.map(fld).join('')}</fieldset>`; }).join('');
  return `<label><span>${esc(s.title)}</span><input data-k="title" value="${esc(st.title)}" autocomplete="off" maxlength="200"></label>${s.checkable ? `<label class="chkl"><input type="checkbox" data-k="done"${st.done ? ' checked' : ''}> Done</label>` : ''}${loose}${boxes}<label><span>Notes</span><textarea data-k="notes" rows="3" placeholder="Markdown works here. Mention a person with @[Name].">${esc(st.notes)}</textarea></label>`;
}
function xfuTemplatePicker(s) {
  const l = s.tpls || []; if (!l.length) return '';
  return `<label class="xs-tp"><span>Start from a template</span><select data-xtpl aria-label="Fill this entry from a template">${opts([['', 'Choose…'], ...l.map(t => [t.id, t.name + (t.desc ? ' — ' + t.desc : '')])], '')}</select><small class="hint">Fills what is empty; what you have typed stays.</small></label>`;
}
// the values typed so far, read from the form (a calculated field has no control; a field that is hidden is still read, and keeps its value)
function xfuReadVals(m, s) {
  const vals = {};
  for (const f of s.fields) {
    if (f.type === 'calculated') continue; let v;
    if (f.type === 'rating') { const r = $(`[data-xr="${f.id}"]`, m); v = r ? +r.dataset.v || 0 : 0; if (!v) continue; }
    else if (f.type === 'multiselect') { const boxes = $$(`[data-xmv="${f.id}"]`, m); if (!boxes.length && !$(`[data-xm="${f.id}"]`, m)) continue; v = boxes.filter(x => x.checked).map(x => x.value); }
    else { const el = $(`[data-xv="${f.id}"]`, m); if (!el) continue; v = f.type === 'check' ? el.checked : f.type === 'number' ? (el.value === '' ? '' : +el.value) : f.type === 'tags' ? el.value.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean) : el.value; }
    if (v !== '' && v !== false && !(Array.isArray(v) && !v.length)) vals[f.id] = v;
  }
  return vals;
}
// bring the form up to date with what is typed: who is shown, what the formulas give, and the messages of the fields a person has been to
function xfuRefresh(m, s, touched, all) {
  const vals = xfuReadVals(m, s), state = xfdState(s, vals), probs = xfdProblems(s, vals, state);
  for (const f of s.fields) {
    const w = $(`[data-fld="${f.id}"]`, m); if (!w) continue; w.hidden = state.vis[f.id] === false;
    if (f.type === 'calculated') { const o = $(`[data-xc="${f.id}"]`, m), c = state.calc[f.id] || { v: null, err: '' }; if (o) o.innerHTML = c.err && !w.hidden ? `<span class="xs-cerr">${ic('alert', 13)} ${esc(c.err)}</span>` : xsShow(f, c.v) || '<span class="xs-na">—</span>'; }
    const er = $(`#${xfuId('xe', f)}`, m), p = probs.find(x => x.fid === f.id), say = p && (all || touched.has(f.id)), el = $(`[data-xv="${f.id}"], [data-xm="${f.id}"], [data-xr="${f.id}"]`, m);
    if (er) { er.hidden = !say; er.textContent = say ? p.msg : ''; } if (el) { if (say) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
    if (f.type === 'multiselect') { const c = $(`[data-xmc="${f.id}"]`, m), n = (vals[f.id] || []).length; if (c) c.textContent = n ? n + ' selected' : 'None selected'; }
  }
  for (const g of $$('[data-fgrp]', m)) g.hidden = !$$('[data-fld]', g).some(x => !x.hidden);
  return { vals, state, probs };
}
// wire one open entry editor: live updating, the touched marks, the option search, and the template picker. `st` is the entry being edited.
function xfuInit(m, s, st) {
  const form = $('.xs-form', m); if (!form) return; const touched = new Set(), fid = el => { const w = el.closest && el.closest('[data-fld]'); return w ? w.dataset.fld : ''; };
  const upd = () => xfuRefresh(m, s, touched, false);
  form.addEventListener('input', e => { if (e.target.matches && e.target.matches('[data-xms]')) return; upd(); });
  form.addEventListener('change', e => { const id = fid(e.target); if (id) touched.add(id); upd(); });
  form.addEventListener('focusout', e => { const id = fid(e.target); if (id && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(`[data-fld="${id}"]`))) { touched.add(id); upd(); } });
  form.addEventListener('click', e => { const star = e.target.closest && e.target.closest('[data-star]'); if (star) { const id = fid(star); if (id) touched.add(id); upd(); } });
  form.addEventListener('input', e => { const q = e.target.dataset && e.target.dataset.xms; if (!q) return; const w = e.target.value.trim().toLowerCase(); for (const l of $$(`[data-xm="${q}"] [data-o]`, form)) l.hidden = !!w && !l.dataset.o.includes(w); });
  const pick = $('[data-xtpl]', form);
  if (pick) pick.addEventListener('change', () => {
    const tpl = (s.tpls || []).find(t => t.id === pick.value); pick.value = ''; if (!tpl) return;
    xsReadEntry(m, s, st); const n = xfdFillEmpty(s, st, tpl), k = n.vals + (n.title ? 1 : 0) + (n.notes ? 1 : 0);
    $('#xs-core', m).innerHTML = xfuCoreHtml(s, st); xfuRefresh(m, s, touched, false);
    toast(k ? `Filled in ${k} ${k === 1 ? 'thing' : 'things'} from “${tpl.name}”` : 'Nothing to fill in: everything already has a value');
  });
  xfuRefresh(m, s, touched, false);
  return { touched, refresh: all => xfuRefresh(m, s, touched, all) };
}
// try to save: false (with the messages shown and the first problem in focus) when a shown field breaks a rule
function xfuCheck(m, s, st, ctl) {
  const probs = xfdProblems(s, st.vals); if (!probs.length) return true;
  ctl.refresh(true); const first = probs[0], w = $(`[data-fld="${first.fid}"]`, m), el = w && $('input:not([type=hidden]), select, textarea, button', w);
  if (w && w.scrollIntoView) w.scrollIntoView({ block: 'center' }); if (el && el.focus) el.focus();
  toast(probs.length === 1 ? probs[0].msg : `${probs[0].msg} (and ${probs.length - 1} more)`); return false;
}
