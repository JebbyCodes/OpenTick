/* OpenTick notes: the Notes page, the Markdown editor pieces shared with task notes, and the wide ("expanded") editor
   that opens a task's notes in a big window with a live preview. */
U.noteSel = null; U.nq = '';
MD_WIKI = name => { const n = noteByTitle(name); return n ? { id: n.id, title: noteTitle(n) } : null; };

// formatting toolbar: [id, label, tooltip]
const NOTE_FMT = [
  ['bold', '<span class="f-b">B</span>', 'Bold (Ctrl+B)'], ['italic', '<span class="f-i">I</span>', 'Italic (Ctrl+I)'], ['strike', '<span class="f-s">S</span>', 'Strikethrough'],
  ['code', '&lt;/&gt;', 'Code'], ['link', 'Link', 'Link (Ctrl+K)'], ['h', 'H', 'Heading'], ['ul', '•', 'Bulleted list'], ['ol', '1.', 'Numbered list'],
  ['task', '☑', 'Checklist'], ['quote', '❝', 'Quote'], ['table', 'Table', 'Insert a table'], ['img', 'Image', 'Insert an image'], ['hr', '—', 'Divider'],
];
const mdToolbar = target => NOTE_FMT.map(([k, l, tt]) => `<button class="fmt" data-act="nfmt" data-k="${k}" data-for="${target}" title="${tt}" aria-label="${esc(tt)}">${l}</button>`).join('');
const edModeSeg = (mode, pre) => `<div class="seg" role="tablist">${[['write', 'Write'], ['split', 'Split'], ['preview', 'Preview']].map(([m, n]) => `<button class="${mode === m ? 'on' : ''}${m === 'split' ? ' hide-m' : ''}" data-ed="${pre}" data-mode="${m}" role="tab">${n}</button>`).join('')}</div>`;
// the editing surface itself: a textarea and a rendered preview side by side (or one of them)
const edBody = (pre, text, mode, field, ph) => `<div class="ed ed-${mode}" id="${pre}-ed"><textarea id="${pre}-ta" data-md data-f="${field}" spellcheck="true" placeholder="${esc(ph)}">${esc(text)}</textarea><div class="md edprev" id="${pre}-pv">${previewHtml(text)}</div></div>`;
const previewHtml = text => (String(text || '').trim() ? md(text) : '<p class="hint">Nothing to preview yet.</p>');
const edStats = text => { const s = mdStats(text), w = wordCount(text); return `${w} word${w === 1 ? '' : 's'} · ${String(text || '').length} characters${w > 150 ? ` · ${Math.max(1, Math.round(w / 220))} min read` : ''}${s.total ? ` · ${s.done}/${s.total} done` : ''}`; };
// "split" needs room: on a narrow screen it quietly becomes "write"
const edMode = pref => (pref === 'auto' || !pref ? (narrow(900) ? 'write' : 'split') : pref === 'split' && narrow(900) ? 'write' : pref);

/* ---------- the Notes page ---------- */
const noteWhen = ts => { const d = new Date(ts), k = ymd(d); return k === todayStr() ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : fmtDate(k); };
const noteSnippet = n => { const lines = String(n.body || '').split('\n').map(l => l.replace(/^[#>\-*+\s]+|\[[ xX]\]\s*|[*_`~=]/g, '').trim()).filter(Boolean); if (n.title && n.title.trim()) return lines.join(' ').slice(0, 110); return lines.slice(1).join(' ').slice(0, 110); };
function noteList() {
  const q = U.nq.trim().toLowerCase();
  return S.notes.filter(n => !q || (n.title + ' ' + n.body + ' ' + n.tags.join(' ')).toLowerCase().includes(q))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
}
function noteListHtml() {
  const ns = noteList(); if (!ns.length) return `<p class="hint pad">${U.nq ? 'No notes match.' : 'No notes yet.'}</p>`;
  let pinned = null, out = '';
  for (const n of ns) {
    if (!!n.pinned !== pinned) { pinned = !!n.pinned; if (pinned && ns.some(x => !x.pinned)) out += '<div class="grp">Pinned</div>'; else if (!pinned && ns.some(x => x.pinned)) out += '<div class="grp">Notes</div>'; }
    out += `<div class="nti${U.noteSel === n.id ? ' on' : ''}" data-act="noteopen" data-id="${n.id}"><div class="nt-t">${n.pinned ? ic('star', 12) + ' ' : ''}${esc(noteTitle(n))}</div><div class="nt-s">${esc(noteSnippet(n)) || '<i>No text</i>'}</div><div class="nt-m"><span>${esc(noteWhen(n.updated))}</span>${n.tags.map(tagChip).join('')}</div></div>`;
  }
  return out;
}
function noteEditorHtml(n) {
  const mode = edMode(S.settings.notes.view);
  return `<div class="ne-head"><button class="ib mob2" data-act="noteback" aria-label="Back to the list">${ic('left', 20)}</button><input class="ne-title" data-f="ntitle" value="${esc(n.title)}" placeholder="Untitled note" autocomplete="off">`
    + `<button class="ib${n.pinned ? ' on' : ''}" data-act="notepin" title="${n.pinned ? 'Unpin' : 'Pin to the top'}">${ic('star', 18)}</button>${edModeSeg(mode, 'n')}<button class="ib" data-act="notemenu" title="More">${ic('more', 18)}</button></div>`
    + `<div class="ne-tags"><span>${ic('tag', 14)}</span><input data-f="ntags" value="${esc(n.tags.map(g => '#' + g).join(' '))}" placeholder="#tags" autocomplete="off"></div>`
    + `<div class="ne-tool" id="n-tool"${mode === 'preview' ? ' hidden' : ''}>${mdToolbar('#n-ta')}</div>`
    + edBody('n', n.body, mode, 'nbody', 'Start writing… Markdown is supported: # headings, **bold**, - lists, [[links to other notes]], tables and more.')
    + `<div class="ne-foot" id="n-stat">${edStats(n.body)}<span>Edited ${esc(noteWhen(n.updated))}</span></div>`;
}
function renderNotes() {
  let n = U.noteSel && noteById(U.noteSel); if (!n) U.noteSel = null;
  if (!n && !narrow(820) && !U.nq) { const first = noteList()[0]; if (first) { n = first; U.noteSel = first.id; } }
  const tools = `<button class="btn pri" data-act="noteadd">${ic('plus', 16)}<span class="hide-m"> New note</span></button><button class="ib" data-act="noteimport" title="Import a Markdown file">${ic('upload')}</button>`;
  $('#main').innerHTML = topHtml('Notes', tools)
    + `<div class="nt${n ? ' open' : ''}"><aside class="nt-list"><div class="nt-search">${ic('search', 15)}<input id="nq" placeholder="Search notes" value="${esc(U.nq)}" autocomplete="off"></div><div class="nt-items" id="nt-items">${noteListHtml()}</div></aside>`
    + `<section class="nt-ed" id="nt-ed">${n ? noteEditorHtml(n) : `<div class="empty">${ic('file-text', 44)}<p>${S.notes.length ? 'Pick a note to read or edit it' : 'Write your first note'}</p><button class="btn pri" data-act="noteadd">${ic('plus', 16)} New note</button></div>`}</section></div>`;
}
const renderNoteList = () => { const el = $('#nt-items'); if (el) el.innerHTML = noteListHtml(); };
// refresh the preview / stats / list after typing (debounced by the caller)
function notePaint() {
  const n = noteById(U.noteSel); if (!n) return;
  const pv = $('#n-pv'); if (pv) pv.innerHTML = previewHtml(n.body);
  const st = $('#n-stat'); if (st) st.innerHTML = `${edStats(n.body)}<span>Edited ${esc(noteWhen(n.updated))}</span>`;
  renderNoteList();
}
function noteInput(field, v) {
  const n = noteById(U.noteSel); if (!n) return;
  if (field === 'tags') n.tags = [...new Set(v.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean))];
  else n[field] = v;
  n.updated = Date.now(); save();
  clearTimeout(U._np); U._np = setTimeout(notePaint, 120);
}
function noteMarkdown(n) { return (n.title && n.title.trim() && !/^\s*#\s/.test(n.body) ? `# ${n.title.trim()}\n\n` : '') + n.body; }
const noteFile = n => (noteTitle(n).replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'note') + '.md';
function openNoteById(id) { if ($('#modal.on')) closeModal(); U.page = 'notes'; U.noteSel = id; U.sel = null; U.nq = ''; render(); }

const NOTE_ACT = {
  noteadd: () => { const n = newNote(); S.notes.push(n); U.noteSel = n.id; U.nq = ''; save(); sfx('add'); renderMain(); const t = $('.ne-title'); if (t) t.focus(); },
  noteopen: el => { U.noteSel = el.dataset.id; renderMain(); },
  noteback: () => { U.noteSel = null; renderMain(); },
  notepin: () => { const n = noteById(U.noteSel); if (!n) return; n.pinned = !n.pinned; save(); renderMain(); },
  async notemenu() {
    const n = noteById(U.noteSel); if (!n) return;
    const items = [{ label: 'Export as Markdown file…' }, { label: 'Copy as Markdown' }, { label: 'Duplicate' }, { label: 'Delete note', danger: true }];
    const i = await askMenu(noteTitle(n), items); if (i == null) return;
    if (i === 0) { try { if (await saveText(noteFile(n), noteMarkdown(n), 'text/markdown')) toast('Exported'); } catch (e) { toast('Export failed: ' + (e.message || e)); } }
    else if (i === 1) { try { await navigator.clipboard.writeText(noteMarkdown(n)); toast('Copied'); } catch (e) { toast('Could not copy: ' + (e.message || e)); } }
    else if (i === 2) { const c = newNote({ title: (n.title || noteTitle(n)) + ' (copy)', body: n.body, tags: [...n.tags] }); S.notes.push(c); U.noteSel = c.id; save(); renderMain(); }
    else if (i === 3 && await askConfirm(`Delete “${noteTitle(n)}”? This cannot be undone.`)) {
      const next = noteList().find(x => x.id !== n.id); S.notes = S.notes.filter(x => x !== n); U.noteSel = narrow(820) ? null : next ? next.id : null; save(); sfx('trash'); renderMain();
    }
  },
  async noteimport() {
    try {
      const txt = await pickText(['md', 'markdown', 'txt'], 'Markdown'); if (txt == null) return;
      const m = txt.match(/^\s*#\s+(.+?)\s*\n+([\s\S]*)$/), n = newNote(m ? { title: m[1].trim(), body: m[2] } : { body: txt });
      S.notes.push(n); U.noteSel = n.id; save(); renderMain(); toast('Imported');
    } catch (e) { toast('Import failed: ' + (e.message || e)); }
  },
  nexpand: () => openNoteExpand(U.sel),
};

// switch Write / Split / Preview without redrawing (keeps the cursor): pre = 'n' (Notes page) or 'x' (wide task editor)
function edSetMode(pre, mode) {
  const ed = $(`#${pre}-ed`); if (!ed) return;
  ed.className = 'ed ed-' + mode;
  $$(`[data-ed="${pre}"]`).forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  const tool = $(`#${pre}-tool`); if (tool) tool.hidden = mode === 'preview';
  if (pre === 'n') { S.settings.notes.view = mode; save(); }
  if (mode !== 'preview') { const ta = $(`#${pre}-ta`); if (ta && ta.focus) ta.focus(); }
}

/* ---------- a task's notes in a wide editor ---------- */
function openNoteExpand(tid) {
  const t = getT(tid); if (!t) return;
  let mode = edMode('auto'), timer = 0;
  const paint = () => { const pv = $('#x-pv'); if (pv) pv.innerHTML = previewHtml(t.notes); const st = $('#x-stat'); if (st) st.textContent = edStats(t.notes); };
  const finish = () => { clearTimeout(timer); closeModal(); renderMain(); renderDetail(); renderSide(); };
  openModal(`<div class="xhead"><button class="ib" data-x="close" title="Back to the task (Esc)" aria-label="Close">${ic('left', 20)}</button><div class="xt"><b>${titleHtml(t)}</b><small>Notes · ${esc(listOf(t.listId).name)}${t.due ? ' · ' + esc(dueLabel(t)) : ''}</small></div>${edModeSeg(mode, 'x')}<button class="btn pri" data-x="close">Done</button></div>`
    + `<div class="ne-tool" id="x-tool">${mdToolbar('#x-ta')}</div>`
    + edBody('x', t.notes, mode, 'xnotes', 'Write your notes in Markdown…')
    + `<div class="ne-foot"><span id="x-stat">${edStats(t.notes)}</span><span class="hide-m">Esc to close · changes save as you type</span></div>`, m => {
    const ta = $('#x-ta', m); if (ta && narrow(900) === false) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    m.oninput = e => { if (e.target.id !== 'x-ta') return; t.notes = e.target.value; save(); clearTimeout(timer); timer = setTimeout(paint, 100); };
    m.onchange = e => {
      if (!(e.target.classList && e.target.classList.contains('mdchk'))) return;
      const box = $('#x-ta', m); box.value = mdToggleLine(box.value, +e.target.dataset.mdl); t.notes = box.value; save(); sfx('tick'); paint();
    };
    m.onclick = e => {
      if (e.target.closest('[data-x=close]') || e.target.classList.contains('mback')) { finish(); return; }
      const f = e.target.closest('[data-act=nfmt]'); if (f) { mdFormat(f.dataset.k, $('#x-ta', m)); return; }
      const b = e.target.closest('[data-ed=x]'); if (b) { mode = b.dataset.mode; edSetMode('x', mode); }
    };
  }, 'xl');
}
