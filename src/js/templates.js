/* OpenTick templates: a piece of text with blanks ({{like this}}). Using a template asks you one question per blank, shows the
   result as you answer, and lets you copy it, save it as a note or start a task from it.

   Writing one:   {{name}}              a blank (asks "name")
                  {{name|fallback}}     the text used when the answer is left empty
                  {{note:Meeting notes}} the text of another note, put in as it is
                  {{today}} {{tomorrow}} {{yesterday}} {{weekday}} {{time}} {{now}} {{month}} {{year}}   filled in by OpenTick
   Every blank becomes a question you can set up: its wording, the kind of answer (a line, a long text, a number, a date, a choice from a
   list, yes / no, or ANOTHER NOTE) and a default. Templates can carry tags and be linked to a list or a project, which is how they show up
   in those places. They are an ordinary synced collection (S.templates), so they sync and are encrypted with everything else.

   template: { id, name, body, vars: [{ key, label, type, options, use, default }], tags, listId, projectId, pinned, created, updated }
   key = the blank's name in lower case; type = text | longtext | number | date | choice | yesno | note; use (note answers) = body | title */
U.tplSel = null; U.tplQ = ''; U.tplTag = '';

const TPL_RE = /\{\{\s*([^{}|]*?)\s*(?:\|([^{}]*))?\}\}/g;
const TPL_TYPES = [['text', 'A line of text'], ['longtext', 'A longer text'], ['number', 'A number'], ['date', 'A date'], ['choice', 'A choice from a list'], ['yesno', 'Yes or no'], ['note', 'Another note']];
const longDate = d => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const TPL_BUILTIN = {
  today: () => longDate(new Date()), tomorrow: () => longDate(addDays(new Date(), 1)), yesterday: () => longDate(addDays(new Date(), -1)),
  date: () => todayStr(), time: () => fmtTime(`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`), now: () => `${longDate(new Date())} ${fmtTime(`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`)}`,
  weekday: () => FULLDAYS[new Date().getDay()], month: () => MONTHS[new Date().getMonth()], year: () => String(new Date().getFullYear()),
};
const tplId = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const tplById = id => S.templates.find(t => t.id === id) || null;
function newTemplate(o = {}) { const now = Date.now(); return { id: uid(), name: '', body: '', vars: [], tags: [], listId: '', projectId: '', pinned: false, created: now, updated: now, ...o }; }

// every {{...}} in a text: { raw, kind: 'var' | 'note' | 'builtin', key, label, fallback }
function tplTokens(body) {
  const out = []; String(body || '').replace(TPL_RE, (raw, inner, fb) => {
    const name = inner.trim(); if (!name) return raw;
    if (/^note\s*:/i.test(name)) out.push({ raw, kind: 'note', key: name.replace(/^note\s*:\s*/i, '').trim(), label: '', fallback: fb || '' });
    else if (TPL_BUILTIN[tplId(name)] && !name.includes(' ')) out.push({ raw, kind: 'builtin', key: tplId(name), label: name, fallback: fb || '' });
    else out.push({ raw, kind: 'var', key: tplId(name), label: name, fallback: fb === undefined ? '' : fb });
    return raw;
  });
  return out;
}
// keep the questions in step with the blanks in the text: new blanks get a question, ones that were taken out keep their set-up (shown as unused)
function tplSyncVars(t) {
  const seen = new Set(), used = [];
  for (const k of tplTokens(t.body)) if (k.kind === 'var' && !seen.has(k.key)) { seen.add(k.key); used.push(k); }
  const have = new Map((t.vars || []).map(v => [v.key, v]));
  const next = used.map(k => have.get(k.key) || { key: k.key, label: k.label, type: 'text', options: [], use: 'body', default: '' });
  const rest = (t.vars || []).filter(v => !seen.has(v.key));
  t.vars = [...next, ...rest]; return t;
}
const tplUsedKeys = t => new Set(tplTokens(t.body).filter(k => k.kind === 'var').map(k => k.key));
const tplAsked = t => { const u = tplUsedKeys(t); return (t.vars || []).filter(v => u.has(v.key)); };

// an answer as it goes into the text
function tplAnswer(v, a) {
  if (a == null || a === '') return '';
  if (v.type === 'date') { const d = pYmd(String(a)); return isNaN(d) ? String(a) : longDate(d); }
  if (v.type === 'yesno') return a === true || a === 'yes' ? 'Yes' : 'No';
  if (v.type === 'note') { const n = noteById(a); return n ? (v.use === 'title' ? noteTitle(n) : n.body || '') : ''; }
  return String(a);
}
// the text with the answers put in. ph: show ‹question› for a blank that has no answer yet (the preview).
function tplRender(t, ans = {}, ph = false) {
  const vars = new Map((t.vars || []).map(v => [v.key, v]));
  return String(t.body || '').replace(TPL_RE, (raw, inner, fb) => {
    const name = inner.trim(); if (!name) return raw;
    if (/^note\s*:/i.test(name)) { const n = noteByTitle(name.replace(/^note\s*:\s*/i, '').trim()); return n ? n.body || '' : ph ? `‹note “${name.replace(/^note\s*:\s*/i, '')}” not found›` : ''; }
    const id = tplId(name); if (TPL_BUILTIN[id] && !name.includes(' ')) return TPL_BUILTIN[id]();
    const v = vars.get(id) || { key: id, label: name, type: 'text' }, got = tplAnswer(v, ans[id]);
    if (got !== '') return got;
    if (fb) return fb;
    if (v.type === 'yesno' && ans[id] === false) return 'No';
    return ph ? `‹${v.label || name}›` : '';
  });
}
const tplDefaults = t => { const a = {}; for (const v of tplAsked(t)) { const d = v.default; if (v.type === 'date') a[v.key] = d === 'today' || !d ? (d === 'today' ? todayStr() : '') : d; else if (v.type === 'yesno') a[v.key] = d === 'yes'; else a[v.key] = d || ''; } return a; };

/* ---------- where templates show up ---------- */
const tplAllTags = () => [...new Set(S.templates.flatMap(t => t.tags))].sort();
function tplFor(eff) { // the templates linked to a list, a project or a tag, or matching a search
  if (eff.startsWith('list:')) { const ids = new Set([eff.slice(5), ...listDescendants(eff.slice(5)).map(l => (l && l.id) || l)]); return S.templates.filter(t => t.listId && ids.has(t.listId)); }
  if (eff.startsWith('project:')) { const p = projectOf(eff.slice(8)), ids = new Set(projectListIds(p)); return S.templates.filter(t => t.projectId === p.id || (t.listId && ids.has(t.listId))); }
  if (eff.startsWith('tag:')) { const g = eff.slice(4); return S.templates.filter(t => t.tags.includes(g)); }
  if (eff === 'search' && U.q) { const q = U.q.toLowerCase(); return S.templates.filter(t => (t.name + ' ' + t.body + ' ' + t.tags.join(' ')).toLowerCase().includes(q)); }
  return [];
}
function tplStripHtml(eff) {
  const ts = tplFor(eff); if (!ts.length) return '';
  return `<div class="tplstrip"><span class="tb-l">${ic('copy', 14)} Templates</span><div class="tb-c">${ts.map(t => `<button class="tfc tplchip" data-act="tplfill" data-id="${esc(t.id)}" title="Fill in “${esc(t.name || 'Untitled')}”">${esc(t.name || 'Untitled')}</button>`).join('')}</div></div>`;
}
function tplHomeChip(t) {
  if (t.projectId && S.projects.some(p => p.id === t.projectId)) { const p = projectOf(t.projectId); return `<span class="nh" style="--c:${p.color}">${ic('layers', 11)}<span>${esc(p.name)}</span></span>`; }
  if (t.listId && S.lists.some(l => l.id === t.listId)) { const l = listOf(t.listId); return `<span class="nh" style="--c:${l.color}">${ic('list', 11)}<span>${esc(l.name)}</span></span>`; }
  return '';
}

/* ---------- the page ---------- */
const tplFiltered = () => {
  const q = U.tplQ.trim().toLowerCase();
  return S.templates.filter(t => (!U.tplTag || t.tags.includes(U.tplTag)) && (!q || (t.name + ' ' + t.body + ' ' + t.tags.join(' ')).toLowerCase().includes(q)))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
};
const tplSnippet = t => String(t.body || '').replace(/\s+/g, ' ').trim().slice(0, 140);
function tplCard(t) {
  const n = tplAsked(t).length;
  return `<div class="tplc${t.pinned ? ' pin' : ''}" data-act="tplopen" data-id="${esc(t.id)}" tabindex="0" role="button" aria-label="Open template ${esc(t.name || 'Untitled')}">
<div class="tplh"><b>${t.pinned ? ic('star', 13) + ' ' : ''}${esc(t.name || 'Untitled template')}</b><small>${n ? plural(n, 'question') : 'No questions'}</small></div>
<p class="tpls">${esc(tplSnippet(t)) || '<span class="hint">Empty</span>'}</p>
<div class="tplm">${tplHomeChip(t)}${t.tags.map(g => `<span class="tag">#${esc(g)}</span>`).join('')}<span class="sp"></span><button class="btn sm pri" data-act="tplfill" data-id="${esc(t.id)}">${ic('sparkles', 13)} Use</button></div></div>`;
}
function renderTemplates() {
  const t = U.tplSel && tplById(U.tplSel); if (!t) U.tplSel = null;
  if (t) { $('#main').innerHTML = topHtml(esc(t.name || 'Template'), `<button class="btn" data-act="tplback">${ic('left', 15)}<span class="hide-m"> All templates</span></button><button class="btn pri" data-act="tplfill" data-id="${esc(t.id)}">${ic('sparkles', 15)} Use</button>`) + tplEditorHtml(t); tplPaintPreview(); return; }
  const list = tplFiltered(), tags = tplAllTags();
  $('#main').innerHTML = topHtml('Templates', `<button class="btn pri" data-act="tpladd">${ic('plus', 16)}<span class="hide-m"> New template</span></button>`)
    + `<div class="body tplpage"><div class="search tplsearch">${ic('search', 16)}<input id="tpl-q" placeholder="Search templates" autocomplete="off" value="${esc(U.tplQ)}"></div>`
    + (tags.length ? `<div class="tagbar"><span class="tb-l">${ic('tag', 14)} Tags</span><div class="tb-c">${tags.map(g => `<button class="tfc${U.tplTag === g ? ' on' : ''}" data-act="tpltag" data-tag="${esc(g)}" aria-pressed="${U.tplTag === g}">#${esc(g)}</button>`).join('')}</div></div>` : '')
    + (list.length ? `<div class="tplgrid">${list.map(tplCard).join('')}</div>`
      : `<div class="empty">${ic('copy', 44)}<p>${S.templates.length ? 'No templates match' : 'Make a template once, fill it in whenever you need it'}</p>${S.templates.length ? '' : `<p class="hint">Write the text with blanks like <code>{{client}}</code>. OpenTick asks for each one and gives you the finished text to copy.</p><button class="btn pri" data-act="tpladd">${ic('plus', 16)} New template</button>`}</div>`)
    + '</div>';
}
function tplQuestionHtml(t, v) {
  const used = tplUsedKeys(t).has(v.key), k = esc(v.key);
  return `<div class="tplq${used ? '' : ' unused'}" data-vk="${k}"><div class="tqh"><code>{{${esc(v.label || v.key)}}}</code>${used ? '' : `<span class="hint">not in the text</span><button class="ib sm" data-act="tplvdel" data-k="${k}" title="Remove this question" aria-label="Remove this question">${ic('trash', 14)}</button>`}</div>
<label>Ask<input data-vf="label" value="${esc(v.label || '')}" placeholder="The question to ask" autocomplete="off"></label>
<label>Answer<select data-vf="type">${opts(TPL_TYPES, v.type || 'text')}</select></label>
${v.type === 'choice' ? `<label>Choices (one per line)<textarea data-vf="options" rows="3" placeholder="Option A&#10;Option B">${esc((v.options || []).join('\n'))}</textarea></label>` : ''}
${v.type === 'note' ? `<label>Put in<select data-vf="use">${opts([['body', 'The text of the note'], ['title', 'The title of the note']], v.use || 'body')}</select></label>` : ''}
${v.type === 'yesno' ? `<label>Starts as<select data-vf="default">${opts([['no', 'No'], ['yes', 'Yes']], v.default === 'yes' ? 'yes' : 'no')}</select></label>`
  : v.type === 'date' ? `<label>Starts as<select data-vf="default">${opts([['', 'Empty'], ['today', 'Today']], v.default === 'today' ? 'today' : '')}</select></label>`
  : v.type === 'note' ? '' : `<label>Starts as<input data-vf="default" value="${esc(v.default || '')}" placeholder="(empty)" autocomplete="off"></label>`}</div>`;
}
function tplEditorHtml(t) {
  const lists = S.lists.map(l => [l.id, listLabel(l.id)]), qs = t.vars || [];
  return `<div class="body tplpage tpled" data-tid="${esc(t.id)}">
<label class="tpl-f">Name<input data-tf="name" value="${esc(t.name)}" placeholder="e.g. Client email, Weekly review" autocomplete="off"></label>
<div class="tpl-f"><span class="lbl">Text</span><div class="tpl-tb"><button class="btn sm" data-act="tplins" data-w="var" title="Add a blank">${ic('plus', 13)} Blank</button><button class="btn sm" data-act="tplins" data-w="note" title="Put the text of another note here">${ic('sticky', 13)} Note</button><button class="btn sm" data-act="tplins" data-w="built" title="Today's date, the time and so on">${ic('calendar', 13)} Date &amp; time</button><span class="hint">Write <code>{{name}}</code> for a blank, <code>{{name|fallback}}</code> for one with a fallback.</span></div>
<textarea data-tf="body" class="tpl-ta" rows="12" spellcheck="true" placeholder="Hi {{name}},&#10;&#10;Thank you for {{reason}}. I will get back to you by {{date}}.&#10;&#10;{{note:Email signature}}">${esc(t.body)}</textarea></div>
<div class="tpl-f"><span class="lbl">Questions</span><div id="tpl-qs" class="tplqs">${qs.length ? qs.map(v => tplQuestionHtml(t, v)).join('') : '<p class="hint">Put a blank like <code>{{name}}</code> in the text and its question appears here.</p>'}</div></div>
<div class="tpl-f"><span class="lbl">Result so far</span><pre id="tpl-pv" class="tplpv"></pre></div>
<div class="tpl-f two"><label>Tags<input data-tf="tags" value="${esc(t.tags.map(g => '#' + g).join(' '))}" placeholder="#tags" autocomplete="off"></label>
<label>List<select data-tf="listId">${opts([['', 'No list'], ...lists], t.listId || '')}</select></label>
<label>Project<select data-tf="projectId">${opts([['', 'No project'], ...S.projects.map(p => [p.id, p.name])], t.projectId || '')}</select></label></div>
<p class="hint">A template linked to a list, a project or a tag appears on that page, ready to use.</p>
<div class="mrow"><button class="btn" data-act="tplpin" data-id="${esc(t.id)}">${ic('star', 14)} ${t.pinned ? 'Unpin' : 'Pin to the top'}</button><button class="btn" data-act="tpldup" data-id="${esc(t.id)}">${ic('copy', 14)} Duplicate</button><button class="btn danger" data-act="tpldel" data-id="${esc(t.id)}">${ic('trash', 14)} Delete</button></div></div>`;
}
const tplPaintPreview = () => { const t = tplById(U.tplSel), el = $('#tpl-pv'); if (t && el) el.textContent = tplRender(t, tplDefaults(t), true) || ' '; };

// what the editor fields change
function tplEdit(field, v, el) {
  const t = tplById(U.tplSel); if (!t) return;
  if (field === 'name') t.name = v;
  else if (field === 'body') { t.body = v; tplSyncVars(t); }
  else if (field === 'tags') t.tags = [...new Set(v.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean))];
  else if (field === 'listId') { t.listId = v; }
  else if (field === 'projectId') { t.projectId = v; }
  t.updated = Date.now(); save();
  clearTimeout(U._tp); U._tp = setTimeout(() => { const qs = $('#tpl-qs'); if (qs && field === 'body') { qs.innerHTML = t.vars.length ? t.vars.map(x => tplQuestionHtml(t, x)).join('') : '<p class="hint">Put a blank like <code>{{name}}</code> in the text and its question appears here.</p>'; } tplPaintPreview(); }, 120);
}
function tplVarEdit(el) {
  const t = tplById(U.tplSel), card = el.closest('[data-vk]'); if (!t || !card) return;
  const v = t.vars.find(x => x.key === card.dataset.vk); if (!v) return;
  const f = el.dataset.vf, val = el.value;
  if (f === 'options') v.options = val.split('\n').map(x => x.trim()).filter(Boolean);
  else v[f] = val;
  t.updated = Date.now(); save();
  if (f === 'type') { card.outerHTML = tplQuestionHtml(t, v); }
  tplPaintPreview();
}
// put text into the template body where the cursor is
function tplInsert(text) {
  const ta = $('.tpl-ta'); if (!ta) return;
  const a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, b = ta.selectionEnd == null ? a : ta.selectionEnd;
  ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
  const p = a + text.length; if (ta.setSelectionRange) ta.setSelectionRange(p, p); ta.focus(); tplEdit('body', ta.value, ta);
}
async function tplInsertWhat(w) {
  if (w === 'var') { const n = await askText('Name of the blank', '', 'e.g. client name'); if (n) tplInsert('{{' + n.replace(/[{}|]/g, '') + '}}'); }
  else if (w === 'note') { const id = await tplPickNote(); const n = id && noteById(id); if (n) tplInsert('{{note:' + noteTitle(n) + '}}'); }
  else { const names = Object.keys(TPL_BUILTIN), i = await askMenu('Put in', names.map(k => ({ label: `{{${k}}}  —  ${TPL_BUILTIN[k]()}` }))); if (i != null) tplInsert('{{' + names[i] + '}}'); }
}
// choose one of the notes (with a search box). Resolves to the note id, or null.
const tplPickNote = () => new Promise(res => {
  const list = q => S.notes.filter(n => !q || (noteTitle(n) + ' ' + n.body).toLowerCase().includes(q.toLowerCase())).sort((a, b) => noteTitle(a).localeCompare(noteTitle(b))).slice(0, 40);
  const rows = q => list(q).map(n => `<button class="tpl-np" data-id="${esc(n.id)}"><b>${esc(noteTitle(n))}</b><small>${esc(noteSnippet(n))}</small></button>`).join('') || '<p class="hint">No notes found.</p>';
  openModal(`<h3>Choose a note</h3><div class="search">${ic('search', 16)}<input id="tpl-nq" placeholder="Search notes" autocomplete="off"></div><div id="tpl-nl" class="tpl-nl">${rows('')}</div><div class="mact"><button data-m="no">Cancel</button></div>`, m => {
    const done = v => { closeModal(); res(v); }; $('#tpl-nq', m).focus();
    m.oninput = e => { if (e.target.id === 'tpl-nq') $('#tpl-nl', m).innerHTML = rows(e.target.value); };
    m.onclick = e => { const b = e.target.closest('.tpl-np'); if (b) done(b.dataset.id); else if (e.target.closest('[data-m=no]') || e.target.classList.contains('mback')) done(null); };
  });
});

/* ---------- using a template: one question at a time, the result growing underneath ---------- */
async function tplCopy(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); toast('Copied'); return true; } } catch (e) { /* fall back */ }
  try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand && document.execCommand('copy'); ta.remove(); toast(ok ? 'Copied' : 'Select the text and copy it'); return !!ok; } catch (e) { toast('Select the text and copy it'); return false; }
}
function tplFill(id) {
  const t = tplById(id); if (!t) return;
  tplSyncVars(t);
  const rs = tplFill._resume; tplFill._resume = null;
  const qs = tplAsked(t), ans = rs && rs.id === id ? rs.ans : tplDefaults(t); let i = rs && rs.id === id ? rs.i : 0;
  const q = () => qs[i], last = () => i >= qs.length;
  const input = v => {
    const a = ans[v.key], k = esc(v.key);
    if (v.type === 'longtext') return `<textarea id="tf-in" rows="5" placeholder="Type your answer">${esc(a)}</textarea>`;
    if (v.type === 'number') return `<input id="tf-in" type="number" inputmode="decimal" value="${esc(a)}">`;
    if (v.type === 'date') return `<input id="tf-in" type="date" value="${esc(a)}"><div class="chips"><button class="btn sm" data-tfd="0">Today</button><button class="btn sm" data-tfd="1">Tomorrow</button><button class="btn sm" data-tfd="7">Next week</button></div>`;
    if (v.type === 'choice') return `<div class="tf-ch" id="tf-in" role="radiogroup">${(v.options || []).map(o => `<button class="tfc${a === o ? ' on' : ''}" data-tfc="${esc(o)}" role="radio" aria-checked="${a === o}">${esc(o)}</button>`).join('') || '<p class="hint">This question has no choices yet. Add some in the template.</p>'}</div>`;
    if (v.type === 'yesno') return `<div class="tf-ch" id="tf-in" role="radiogroup"><button class="tfc${a === true ? ' on' : ''}" data-tfy="1" role="radio" aria-checked="${a === true}">Yes</button><button class="tfc${a === false || a === '' ? ' on' : ''}" data-tfy="0" role="radio" aria-checked="${a === false || a === ''}">No</button></div>`;
    if (v.type === 'note') { const n = a && noteById(a); return `<div id="tf-in"><button class="btn" data-tfn="1">${ic('sticky', 14)} ${n ? esc(noteTitle(n)) : 'Choose a note'}</button>${n ? `<button class="btn sm" data-tfn="0">Clear</button>` : ''}<p class="hint">${v.use === 'title' ? 'The note’s title is put in.' : 'The note’s text is put in.'}</p></div>`; }
    return `<input id="tf-in" value="${esc(a)}" placeholder="Type your answer" autocomplete="off" data-k="${k}">`;
  };
  const read = () => { const v = q(), el = $('#tf-in'); if (!v || !el) return; if (['text', 'longtext', 'number', 'date'].includes(v.type)) ans[v.key] = el.value; };
  const preview = () => { const p = $('#tf-pv'); if (p) p.textContent = tplRender(t, ans, true); };
  const draw = m => {
    const n = qs.length, v = q();
    const body = last()
      ? `<h3>${esc(t.name || 'Template')}</h3><p class="hint">Here it is. You can still change the text before you copy it.</p><textarea id="tf-out" class="tf-out" rows="12">${esc(tplRender(t, ans))}</textarea>
<div class="mact"><button data-m="back">${n ? 'Back' : 'Close'}</button><span class="sp"></span><button data-m="note">${ic('notes', 14)} Save as note</button><button data-m="task">${ic('check-circle', 14)} Make a task</button><button class="pri" data-m="copy">${ic('copy', 14)} Copy</button></div>`
      : `<h3>${esc(t.name || 'Template')}</h3><div class="tf-prog" role="progressbar" aria-valuenow="${i + 1}" aria-valuemin="1" aria-valuemax="${n}"><i style="width:${Math.round((i + 1) / n * 100)}%"></i></div><p class="hint">Question ${i + 1} of ${n}</p>
<div class="tf-q"><label for="tf-in" class="tf-l">${esc(v.label || v.key)}</label>${input(v)}</div>
<pre id="tf-pv" class="tplpv sm"></pre>
<div class="mact"><button data-m="${i ? 'back' : 'no'}">${i ? 'Back' : 'Cancel'}</button><span class="sp"></span><button data-m="skip" title="Go straight to the result">Skip to result</button><button class="pri" data-m="next">${i === n - 1 ? 'Finish' : 'Next'}</button></div>`;
    m.querySelector('.mbox').innerHTML = body; preview();
    const f = $('#tf-in', m); if (f && f.focus && f.tagName !== 'DIV') { f.focus(); if (f.select && f.tagName === 'INPUT') f.select(); }
    if (last()) { const o = $('#tf-out', m); if (o) o.focus(); }
  };
  openModal('', m => {
    draw(m);
    m.oninput = e => { if (e.target.id === 'tf-in') { read(); preview(); } };
    m.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !last() && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); read(); i++; draw(m); } };
    m.onclick = async e => {
      const d = e.target.closest('[data-tfd]'); if (d) { const dd = ymd(addDays(new Date(), +d.dataset.tfd)); $('#tf-in', m).value = dd; ans[q().key] = dd; preview(); return; }
      const c = e.target.closest('[data-tfc]'); if (c) { ans[q().key] = c.dataset.tfc; $$('[data-tfc]', m).forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-checked', String(x === c)); }); preview(); return; }
      const y = e.target.closest('[data-tfy]'); if (y) { ans[q().key] = y.dataset.tfy === '1'; $$('[data-tfy]', m).forEach(x => { x.classList.toggle('on', x === y); x.setAttribute('aria-checked', String(x === y)); }); preview(); return; }
      const nb = e.target.closest('[data-tfn]'); if (nb) { if (nb.dataset.tfn === '0') { ans[q().key] = ''; draw(m); return; } const nid = await tplPickNote(); if (nid) ans[q().key] = nid; tplFillAgain(t, ans, i); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      const w = b.dataset.m;
      if (w === 'no') closeModal();
      else if (w === 'next') { read(); i++; draw(m); }
      else if (w === 'skip') { read(); i = qs.length; draw(m); }
      else if (w === 'back') { if (!qs.length) { closeModal(); return; } read(); i = Math.max(0, i - 1); draw(m); }
      else { const out = ($('#tf-out', m) || {}).value || ''; if (w === 'copy') { await tplCopy(out); } else if (w === 'note') { tplToNote(t, out); closeModal(); } else if (w === 'task') { tplToTask(t, out); closeModal(); } }
    };
  });
}
// the note picker closed the dialog: open it again where the person was
function tplFillAgain(t, ans, i) { tplFill._resume = { id: t.id, ans, i }; tplFill(t.id); }
const tplToNote = (t, text) => { const n = newNote({ title: (t.name || 'From a template').trim(), body: text, tags: [...t.tags] }); if (t.projectId && S.projects.some(p => p.id === t.projectId)) n.projectId = t.projectId; else if (t.listId && S.lists.some(l => l.id === t.listId)) n.listId = t.listId; S.notes.push(n); save(); U.page = 'notes'; U.noteSel = n.id; U.nq = ''; render(); toast('Saved as a note'); };
function tplToTask(t, text) {
  const target = t.listId && S.lists.some(l => l.id === t.listId) ? t.listId : t.projectId && S.projects.some(p => p.id === t.projectId) ? ((projectOf(t.projectId).listIds || []).find(id => S.lists.some(l => l.id === id)) || 'inbox') : 'inbox';
  const first = text.split('\n').find(l => l.trim()) || t.name || 'Task';
  const task = newTask({ title: (t.name || first).slice(0, 120), notes: text, listId: target, tags: [...t.tags] }); S.tasks.push(task); save(); sfx('add');
  U.page = 'tasks'; setNav(target === 'inbox' ? 'inbox' : 'list:' + target); U.sel = task.id; render(); toast('Task made');
}

const TPL_ACT = {
  tpladd: () => { const t = newTemplate({ name: '' }); S.templates.push(t); save(); U.page = 'templates'; U.tplSel = t.id; render(); setTimeout(() => { const n = $('[data-tf=name]'); if (n) n.focus(); }, 50); },
  tplopen: el => { U.tplSel = el.dataset.id; renderMain(); },
  tplback: () => { U.tplSel = null; renderMain(); },
  tplfill: el => tplFill(el.dataset.id),
  tpltag: el => { U.tplTag = U.tplTag === el.dataset.tag ? '' : el.dataset.tag; renderMain(); },
  tplpin: el => { const t = tplById(el.dataset.id); if (t) { t.pinned = !t.pinned; save(); renderMain(); } },
  tpldup: el => { const t = tplById(el.dataset.id); if (!t) return; const c = newTemplate({ ...JSON.parse(JSON.stringify(t)), id: uid(), name: (t.name || 'Template') + ' copy', pinned: false, created: Date.now(), updated: Date.now() }); S.templates.push(c); save(); U.tplSel = c.id; renderMain(); toast('Duplicated'); },
  async tpldel(el) { const t = tplById(el.dataset.id); if (!t || !(await askConfirm(`Delete “${t.name || 'Untitled template'}”?`))) return; S.templates = S.templates.filter(x => x !== t); U.tplSel = null; save(); renderMain(); toast('Deleted'); },
  tplins: el => { tplInsertWhat(el.dataset.w); },
  tplvdel: el => { const t = tplById(U.tplSel); if (!t) return; t.vars = t.vars.filter(v => v.key !== el.dataset.k); t.updated = Date.now(); save(); const qs = $('#tpl-qs'); if (qs) qs.innerHTML = t.vars.map(v => tplQuestionHtml(t, v)).join('') || '<p class="hint">Put a blank like <code>{{name}}</code> in the text and its question appears here.</p>'; },
};
document.addEventListener('input', e => {
  const el = e.target; if (!el || !el.dataset || U.page !== 'templates') return;
  if (el.id === 'tpl-q') { U.tplQ = el.value; const pos = el.selectionStart; renderMain(); const n = $('#tpl-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* ignore */ } } return; }
  if (el.dataset.tf && (el.dataset.tf === 'name' || el.dataset.tf === 'body' || el.dataset.tf === 'tags')) tplEdit(el.dataset.tf, el.value, el);
  else if (el.dataset.vf && el.dataset.vf !== 'type' && el.tagName !== 'SELECT') tplVarEdit(el);
});
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || U.page !== 'templates') return;
  if (el.dataset.tf === 'listId' || el.dataset.tf === 'projectId') { tplEdit(el.dataset.tf, el.value, el); if (el.dataset.tf === 'listId' && el.value) { const t = tplById(U.tplSel); if (t) { t.projectId = ''; save(); } } renderMain(); }
  else if (el.dataset.tf === 'tags') { renderMain(); }
  else if (el.dataset.vf && (el.dataset.vf === 'type' || el.tagName === 'SELECT')) tplVarEdit(el);
});
