/* OpenTick notes: the Notes page, the Markdown editor pieces shared with task notes, and the wide ("expanded") editor
   that opens a task's notes in a big window with a live preview. */
U.noteSel = null; U.nq = '';
MD_NOTE = name => { const n = noteByTitle(name); return n ? { id: n.id, title: noteTitle(n), body: n.body || '', self: U.page === 'notes' && U.noteSel === n.id } : null; };
MD_WIKI = name => { const n = noteByTitle(name); return n ? { id: n.id, title: noteTitle(n) } : null; };

// formatting toolbar: [id, label, tooltip]
const NOTE_FMT = [
  ['bold', 'bold', 'Bold (Ctrl+B)'], ['italic', 'italic', 'Italic (Ctrl+I)'], ['strike', 'strike', 'Strikethrough'],
  ['code', 'code', 'Code'], ['link', 'link', 'Link (Ctrl+K)'], ['h', 'heading', 'Heading'], ['ul', 'list', 'Bulleted list'], ['ol', 'list-ol', 'Numbered list'],
  ['task', 'check-square', 'Checklist'], ['quote', 'quote', 'Quote'], ['table', 'table', 'Insert a table'], ['img', 'image', 'Insert an image'], ['embed', 'embed', 'Embed a video, audio, PDF or music player (paste its link)'], ['nembed', 'sticky', 'Embed another note'], ['hr', 'minus', 'Divider'],
];
const mdToolbar = target => NOTE_FMT.map(([k, l, tt]) => `<button class="fmt" data-act="nfmt" data-k="${k}" data-for="${target}" title="${tt}" aria-label="${esc(tt)}">${ic(l, 17)}</button>`).join('');
const edModeSeg = (mode, pre) => `<div class="seg" role="tablist">${[['blocks', 'Edit'], ['write', 'Source'], ['split', 'Split'], ['preview', 'Preview']].map(([m, n]) => `<button class="${mode === m ? 'on' : ''}${m === 'split' ? ' hide-m' : ''}" data-ed="${pre}" data-mode="${m}" role="tab" title="${{ blocks: 'Edit with blocks: type / for a menu', write: 'Edit the Markdown text', split: 'Markdown beside a live preview', preview: 'Read it' }[m]}">${n}</button>`).join('')}</div>`;
// the editing surface itself: a textarea and a rendered preview side by side (or one of them)
const edBody = (pre, text, mode, field, ph) => `<div class="ed ed-${mode}" id="${pre}-ed"><div class="bed" id="${pre}-bed" data-ph="${esc(ph)}"></div><textarea id="${pre}-ta" data-md data-f="${field}" spellcheck="true" placeholder="${esc(ph)}">${esc(text)}</textarea><div class="md edprev" id="${pre}-pv">${previewHtml(text)}</div></div>`;
const previewHtml = text => (String(text || '').trim() ? md(text) : '<p class="hint">Nothing to preview yet.</p>');
const edStats = text => { const s = mdStats(text), w = wordCount(text); return `${w} word${w === 1 ? '' : 's'} · ${String(text || '').length} characters${w > 150 ? ` · ${Math.max(1, Math.round(w / 220))} min read` : ''}${s.total ? ` · ${s.done}/${s.total} done` : ''}`; };
// "split" needs room: on a narrow screen it quietly becomes "write"
const edMode = pref => (pref === 'auto' || !pref ? 'blocks' : pref === 'split' && narrow(900) ? 'write' : pref);

/* ---------- the Notes page ---------- */
const noteWhen = ts => { const d = new Date(ts), k = ymd(d); return k === todayStr() ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : fmtDate(k); };
const noteSnippet = n => {
  const lines = String(n.body || '').split('\n').map(l => mdPlain(l.trim().replace(NOTE_MARK, '').replace(/^(?:[-*_]\s*){3,}$/, '').replace(/^(?:```|~~~).*$/, '')).trim()).filter(Boolean);
  return (n.title && n.title.trim() ? lines : lines.slice(1)).join(' ').slice(0, 110);
};
function noteList() {
  const q = U.nq.trim().toLowerCase(), sc = noteScope();
  return S.notes.filter(n => noteInScope(n, sc) && (!q || (n.title + ' ' + n.body + ' ' + n.tags.join(' ') + ' ' + (n.files || []).map(f => f.name).join(' ')).toLowerCase().includes(q)))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
}
// a small chip saying where a note is filed
function noteHomeChip(n) {
  const h = noteHomeOf(n); if (!h.kind) return '';
  const o = h.kind === 'project' ? projectOf(h.id) : listOf(h.id);
  return `<span class="nh" style="--c:${o.color}" title="${h.kind === 'project' ? 'Project' : 'List'}: ${esc(h.kind === 'project' ? o.name : listLabel(o.id))}">${h.kind === 'project' ? ic('layers', 11) : listIcon(o, 11)}<span>${esc(o.name)}</span></span>`;
}
function noteScopeLabel(sc = noteScope()) {
  if (!sc) return 'All notes'; if (sc === 'none') return 'Not in a list or project';
  return sc.startsWith('project:') ? projectOf(sc.slice(8)).name : listOf(sc.slice(5)).name;
}
const noteScopeCount = sc => S.notes.filter(n => noteInScope(n, sc)).length;
function noteRowHtml(n, showHome) {
  return `<div class="nti${U.noteSel === n.id ? ' on' : ''}${editedCls(n.id)}" data-act="noteopen" data-id="${n.id}"><div class="nt-t">${n.pinned ? ic('star', 12) + ' ' : ''}${n.icon ? `<span class="nt-ic">${iconAny(n.icon, 14)}</span>` : ''}<span class="nt-tx">${noteTitleHtml(n)}</span></div><div class="nt-s">${esc(noteSnippet(n)) || '<i>No text</i>'}</div><div class="nt-m"><span>${esc(noteWhen(n.updated))}</span>${showHome ? noteHomeChip(n) : ''}${linkedTasks(n).length ? `<span title="Linked tasks">${ic('check-square', 12)} ${linkedTasks(n).length}</span>` : ''}${(n.files || []).length ? `<span title="Attachments">${ic('paperclip', 12)} ${n.files.length}</span>` : ''}${n.tags.map(tagChip).join('')}</div></div>`;
}
function noteListHtml() {
  const ns = noteList(), sc = noteScope(); if (!ns.length) return `<p class="hint pad">${U.nq ? 'No notes match.' : sc ? 'No notes here yet.' : 'No notes yet.'}${sc && U.nq ? ' <button class="btn sm" data-act="notescope" data-sc="">Search all notes</button>' : ''}</p>`;
  const showHome = !(sc && sc !== 'none' && !sc.startsWith('project:') && ns.every(n => noteHomeOf(n).id === sc.slice(5))) && sc !== 'none';
  // grouped by where the notes are filed (pinned notes stay on top inside each group)
  if (S.settings.notes.group && (!sc || sc.startsWith('project:') || (sc.startsWith('list:') && listDescendants(sc.slice(5)).length))) {
    const groups = new Map(), key = n => { const h = noteHomeOf(n); return h.kind ? h.kind + ':' + h.id : ''; };
    for (const n of ns) { const k = key(n); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); }
    const rank = k => (k.startsWith('project:') ? 0 : k.startsWith('list:') ? 1 : 2), name = k => (k.startsWith('project:') ? projectOf(k.slice(8)).name : k.startsWith('list:') ? listLabel(k.slice(5)) : 'Not in a list or project');
    return [...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || name(a[0]).localeCompare(name(b[0])))
      .map(([k, list]) => `<div class="grp">${k ? (k.startsWith('project:') ? ic('layers', 12) : ic('list', 12)) + ' ' : ''}${esc(name(k))}<span>${list.length}</span></div>` + list.map(n => noteRowHtml(n, false)).join('')).join('');
  }
  let pinned = null, out = '';
  for (const n of ns) {
    if (!!n.pinned !== pinned) { pinned = !!n.pinned; if (pinned && ns.some(x => !x.pinned)) out += '<div class="grp">Pinned</div>'; else if (!pinned && ns.some(x => x.pinned)) out += '<div class="grp">Notes</div>'; }
    out += noteRowHtml(n, showHome);
  }
  return out;
}
// the list / project picker for a note, and the filter dialog for the Notes page
const noteHomeOptions = cur => `<option value="">No list or project</option>${S.projects.length ? `<optgroup label="Projects">${S.projects.map(p => `<option value="p:${esc(p.id)}"${cur === 'p:' + p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>` : ''}<optgroup label="Lists">${listTree().map(({ l, depth }) => `<option value="l:${esc(l.id)}"${cur === 'l:' + l.id ? ' selected' : ''}>${'\u2003'.repeat(depth)}${depth ? '↳ ' : ''}${esc(l.name)}</option>`).join('')}</optgroup>`;
function openNoteScope() {
  const row = (sc, icon, label, color, depth = 0) => `<button type="button" class="scr${noteScope() === sc ? ' on' : ''}" data-sc="${esc(sc)}" style="--d:${depth}"><span class="ni"${color ? ` style="color:${color}"` : ''}>${icon}</span><span class="scl">${esc(label)}</span><em>${noteScopeCount(sc)}</em></button>`;
  openModal(`<h3>Show notes from</h3><div class="scp">${row('', ic('notes', 16), 'All notes', '')}${row('none', ic('file-text', 16), 'Not in a list or project', '')}
${S.projects.length ? '<div class="scg">Projects</div>' + S.projects.map(p => row('project:' + p.id, listIcon(p, 16), p.name, p.color)).join('') : ''}
<div class="scg">Lists</div>${listTree().map(({ l, depth }) => row('list:' + l.id, listIcon(l, 16), l.name, l.color, depth)).join('') || '<p class="hint">Create a list to file notes in it.</p>'}</div>
<label class="chkl"><input type="checkbox" data-g="1"${S.settings.notes.group ? ' checked' : ''}> Group notes by list / project</label>
<div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => {
    m.onchange = e => { if (e.target.dataset.g) { S.settings.notes.group = e.target.checked; save(); renderNoteList(); } };
    m.onclick = e => {
      const r = e.target.closest('[data-sc]'); if (r) { S.settings.notes.scope = r.dataset.sc; save(); closeModal(); U.noteSel = null; renderMain(); return; }
      if (e.target.closest('[data-m=ok]') || e.target.classList.contains('mback')) { closeModal(); renderMain(); }
    };
  }, 'wide');
}
function noteEditorHtml(n) {
  const mode = edMode(S.settings.notes.view);
  return `<div class="ne-head"><button class="ib mob2" data-act="noteback" aria-label="Back to the list">${ic('left', 20)}</button><button class="ib ne-ico" data-act="noteicon" title="Note icon" aria-label="Choose an icon for this note">${iconAny(n.icon, 20, 'file-text')}</button><input class="ne-title" data-f="ntitle" value="${esc(n.title)}" placeholder="Untitled note" autocomplete="off">`
    + `<button class="ib${n.pinned ? ' on' : ''}" data-act="notepin" title="${n.pinned ? 'Unpin' : 'Pin to the top'}">${ic('star', 18)}</button>${edModeSeg(mode, 'n')}<button class="ib hide-m ne-lt" data-act="notelist" title="${noteListOn() ? 'Hide the note list' : 'Show the note list'}" aria-label="Toggle the note list" aria-pressed="${!noteListOn()}">${ic(noteListOn() ? 'sidebar-close' : 'sidebar-open', 18)}</button><button class="ib ne-fs" data-act="notefull" title="${U.nFull ? 'Leave full screen (Esc)' : 'Full screen'}" aria-label="Full screen" aria-pressed="${!!U.nFull}">${ic(U.nFull ? 'minimize-2' : 'maximize-2', 18)}</button><button class="ib" data-act="notemenu" title="More">${ic('more', 18)}</button></div>`
    + `<div class="ne-props"><div class="ne-tags"><span>${ic('tag', 14)}</span><input data-f="ntags" value="${esc(n.tags.map(g => '#' + g).join(' '))}" placeholder="#tags" autocomplete="off"></div><label class="ne-home" title="Where this note is filed"><span>${ic('folder', 14)}</span><select data-f="nhome" aria-label="List or project">${noteHomeOptions(noteHomeValue(n))}</select></label></div>`
    + `<div class="ne-links" id="n-links">${noteLinksHtml(n)}</div>`
    + `<details class="ne-att"${(n.files || []).length ? ' open' : ''}><summary>${ic('paperclip', 14)} Attachments${(n.files || []).length ? ` <span class="fcnt">${n.files.length}</span>` : ''}</summary>${filesHtml('note', n.id)}</details>`
    + `<div class="ne-tool${mode === 'blocks' ? ' bm' : ''}" id="n-tool"${mode === 'preview' ? ' hidden' : ''}>${mdToolbar('#n-ta')}</div>`
    + edBody('n', n.body, mode, 'nbody', 'Start writing… Markdown is supported: # headings, **bold**, - lists, [[links to other notes]], tables and more.')
    + `<div class="ne-foot" id="n-stat">${edStats(n.body)}<span><span class="sv" data-sv></span> <span id="n-when">${editedText(n, true)}</span></span></div>`;
}
function renderNotes() {
  let n = U.noteSel && noteById(U.noteSel); if (!n) U.noteSel = null;
  if (!n && !narrow(820) && !U.nq) { const first = noteList()[0]; if (first) { n = first; U.noteSel = first.id; } }
  const tools = `<button class="btn pri" data-act="noteadd">${ic('plus', 16)}<span class="hide-m"> New note</span></button><button class="ib" data-act="noteimport" title="Import a Markdown file">${ic('upload')}</button>`;
  $('#main').innerHTML = topHtml('Notes', tools)
    + `<div class="nt${n ? ' open' : ''}${noteListOn() ? '' : ' nolist'}"><aside class="nt-list"><button type="button" class="nt-scope${noteScope() ? ' on' : ''}" data-act="notescope" title="Show the notes of a list or project">${ic('folder', 14)}<span>${esc(noteScopeLabel())}</span><em>${noteScopeCount(noteScope())}</em>${ic('down', 12)}</button><div class="nt-search">${ic('search', 15)}<input id="nq" placeholder="Search notes" value="${esc(U.nq)}" autocomplete="off"></div><div class="nt-items" id="nt-items">${noteListHtml()}</div></aside>`
    + `<section class="nt-ed${U.nFull && n ? ' full' : ''}" id="nt-ed">${n ? noteEditorHtml(n) : `<div class="empty">${ic('file-text', 44)}<p>${S.notes.length ? 'Pick a note to read or edit it' : 'Write your first note'}</p><button class="btn pri" data-act="noteadd">${ic('plus', 16)} New note</button></div>`}</section></div>`;
  noteBedStart();
}
// start the block editor on the Notes page (when that is the chosen mode)
function noteBedStart() {
  const n = noteById(U.noteSel), host = $('#n-bed'); if (!n || !host) return;
  if (edMode(S.settings.notes.view) !== 'blocks') { if (BE.cur && BE.cur.o.pre === 'n') BE.cur = null; return; }
  const id = n.id;
  bedMount({ pre: 'n', host, ph: host.dataset.ph, get: () => (noteById(id) || {}).body || '', set: t => { if (U.noteSel !== id) return; noteInput('body', t); const ta = $('#n-ta'); if (ta) ta.value = t; } });
}
const renderNoteList = () => { const el = $('#nt-items'); if (el) el.innerHTML = noteListHtml(); };
// refresh the preview / stats / list after typing (debounced by the caller)
function notePaint() {
  const n = noteById(U.noteSel); if (!n) return;
  const pv = $('#n-pv'), blocks = BE.cur && BE.cur.o.pre === 'n' && $('#n-ed') && $('#n-ed').classList.contains('ed-blocks');
  if (blocks) { if (BE.cur.cur !== n.body) bedReload(BE.cur); } else if (pv) pv.innerHTML = previewHtml(n.body);
  const st = $('#n-stat'); if (st) st.innerHTML = `${edStats(n.body)}<span><span class="sv" data-sv></span> <span id="n-when">${editedText(n, true)}</span></span>`;
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

const noteListOn = () => (S.settings.notes || {}).list !== false;
// full screen writing: the editor takes the whole window; Esc (or the same button) brings the rest back
function noteFull(on) {
  U.nFull = !!on; document.body.classList.toggle('nfull', U.nFull);
  const ed = $('#nt-ed'); if (ed) ed.classList.toggle('full', U.nFull && !!U.noteSel);
  const b = $('.ne-fs'); if (b) { b.innerHTML = ic(U.nFull ? 'minimize-2' : 'maximize-2', 18); b.title = U.nFull ? 'Leave full screen (Esc)' : 'Full screen'; b.setAttribute('aria-pressed', String(!!U.nFull)); }
  if (BE.cur && BE.cur.o.pre === 'n') { const h = $('#n-bed'); if (h) h.scrollTop = h.scrollTop; }
}
const NOTE_ACT = {
  notefull: () => noteFull(!U.nFull),
  notelist: () => { S.settings.notes.list = !noteListOn(); save(); const nt = $('.nt'); if (nt) nt.classList.toggle('nolist', !noteListOn()); const b = $('.ne-lt'); if (b) { b.innerHTML = ic(noteListOn() ? 'sidebar-close' : 'sidebar-open', 18); b.title = noteListOn() ? 'Hide the note list' : 'Show the note list'; b.setAttribute('aria-pressed', String(!noteListOn())); } },
  async noteicon() { const n = noteById(U.noteSel); if (!n) return; const v = await pickIcon(n.icon || '', 'var(--acc)', 'Note icon'); if (v == null) return; if (v) n.icon = v; else delete n.icon; n.updated = Date.now(); save(); renderMain(); },
  notescope: el => { if (el && el.dataset && el.dataset.sc != null) { S.settings.notes.scope = el.dataset.sc; save(); U.noteSel = null; renderMain(); } else openNoteScope(); },
  scopenotes: el => { S.settings.notes.scope = el.dataset.scope; save(); U.page = 'notes'; U.noteSel = null; U.nq = ''; U.sel = null; document.body.classList.remove('drawer'); render(); },
  noteadd: () => { const n = newNote(noteHomePatch(noteScope())); S.notes.push(n); U.noteSel = n.id; U.nq = ''; save(); sfx('add'); renderMain(); const t = $('.ne-title'); if (t) t.focus(); },
  noteopen: el => { U.noteSel = el.dataset.id; renderMain(); },
  noteback: () => { U.noteSel = null; renderMain(); },
  notepin: () => { const n = noteById(U.noteSel); if (!n) return; n.pinned = !n.pinned; save(); renderMain(); },
  async notemenu() {
    const n = noteById(U.noteSel); if (!n) return;
    const items = [{ label: 'Export as Markdown file…' }, { label: 'Copy as Markdown' }, { label: 'Duplicate' }, { label: 'Delete note', danger: true }];
    const i = await askMenu(noteTitle(n), items); if (i == null) return;
    if (i === 0) { try { if (await saveText(noteFile(n), noteMarkdown(n), 'text/markdown')) toast('Exported'); } catch (e) { toast('Export failed: ' + (e.message || e)); } }
    else if (i === 1) { try { await navigator.clipboard.writeText(noteMarkdown(n)); toast('Copied'); } catch (e) { toast('Could not copy: ' + (e.message || e)); } }
    else if (i === 2) { const c = newNote({ title: (n.title || noteTitle(n)) + ' (copy)', body: n.body, tags: [...n.tags], ...(n.listId ? { listId: n.listId } : {}), ...(n.projectId ? { projectId: n.projectId } : {}) }); S.notes.push(c); U.noteSel = c.id; save(); renderMain(); }
    else if (i === 3 && await askConfirm(`Delete “${noteTitle(n)}”? This cannot be undone.`)) {
      const next = noteList().find(x => x.id !== n.id); S.tasks.forEach(t => { if ((t.links || []).includes(n.id)) t.links = t.links.filter(x => x !== n.id); }); S.notes = S.notes.filter(x => x !== n); U.noteSel = narrow(820) ? null : next ? next.id : null; save(); sfx('trash'); renderMain();
    }
  },
  async noteimport() {
    try {
      const files = await pickFiles('.md,.markdown,.txt,.pdf,.doc,.docx,.odt,.rtf,.csv,.xlsx,.pptx,image/*,audio/*,video/*'); if (!files.length) return;
      let last = null, n = 0;
      for (const f of files) {
        if (/\.(md|markdown|txt)$/i.test(f.name) || /^text\/(plain|markdown)$/.test(f.type)) { // text becomes the note itself
          const txt = await f.text(), m = txt.match(/^\s*#\s+(.+?)\s*\n+([\s\S]*)$/), note = newNote(m ? { title: m[1].trim(), body: m[2] } : { title: f.name.replace(/\.[^.]+$/, ''), body: txt });
          S.notes.push(note); last = note; n++;
        } else { // anything else (a PDF, a picture, a document…) becomes a note that holds the file, with a link to open it
          const note = newNote({ title: f.name.replace(/\.[^.]+$/, '') }); S.notes.push(note);
          const [rec] = await filesAdd('note', note.id, [f]);
          if (rec) { note.body = fileMd(rec) + '\n'; last = note; n++; } else S.notes = S.notes.filter(x => x !== note);
        }
      }
      if (last) { U.noteSel = last.id; save(); renderMain(); toast(n === 1 ? 'Imported' : `Imported ${n} files`); }
    } catch (e) { toast('Import failed: ' + (e.message || e)); }
  },
  nlnkpick: () => openLinkPicker('note', U.noteSel),
  lnkpick: () => openLinkPicker('task', U.sel),
  lnkopen: el => openNoteById(el.dataset.id),
  nlnkopen: el => openTaskById(el.dataset.id),
  lnkrm: el => { const t = getT(U.sel); if (!t) return; setLink(t, el.dataset.id, false); sfx('undo'); refresh(); },
  nlnkrm: el => { const t = getT(el.dataset.id); if (!t) return; setLink(t, U.noteSel, false); sfx('undo'); const e = $('#n-links'); if (e) e.innerHTML = noteLinksHtml(noteById(U.noteSel)); renderNoteList(); },
  nexpand: () => openNoteExpand(U.sel),
};

// switch Write / Split / Preview without redrawing (keeps the cursor): pre = 'n' (Notes page) or 'x' (wide task editor)
function edSetMode(pre, mode) {
  const ed = $(`#${pre}-ed`); if (!ed) return;
  ed.className = 'ed ed-' + mode;
  $$(`[data-ed="${pre}"]`).forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  const tool = $(`#${pre}-tool`); if (tool) tool.hidden = mode === 'preview';
  if (tool) tool.classList.toggle('bm', mode === 'blocks');
  if (pre === 'n') { S.settings.notes.view = mode; save(); }
  if (mode === 'blocks') { if (pre === 'n') noteBedStart(); else if (U._xStart) U._xStart(); return; }
  if (pre === 'n' && mode !== 'write') notePaint();
  if (mode !== 'preview') { const ta = $(`#${pre}-ta`); if (ta && ta.focus) ta.focus(); }
}

/* ---------- a task's notes in a wide editor ---------- */
function openNoteExpand(tid) {
  const t = getT(tid); if (!t) return;
  let mode = edMode('auto'), timer = 0; U.xTask = tid;
  const paint = () => { const pv = $('#x-pv'); if (pv) pv.innerHTML = previewHtml(t.notes); const st = $('#x-stat'); if (st) st.textContent = edStats(t.notes); };
  U._xStart = () => { const host = $('#x-bed'); if (host) bedMount({ pre: 'x', host, ph: host.dataset.ph, get: () => t.notes || '', set: v => { t.notes = v; const ta = $('#x-ta'); if (ta) ta.value = v; save(); clearTimeout(timer); timer = setTimeout(paint, 100); } }); };
  const finish = () => { clearTimeout(timer); if (BE.cur && BE.cur.o.pre === 'x') BE.cur = null; U._xStart = null; closeModal(); renderMain(); renderDetail(); renderSide(); };
  openModal(`<div class="xhead"><button class="ib" data-x="close" title="Back to the task (Esc)" aria-label="Close">${ic('left', 20)}</button><div class="xt"><b>${titleHtml(t)}</b><small>Notes · ${esc(listOf(t.listId).name)}${t.due ? ' · ' + esc(dueLabel(t)) : ''}</small></div>${edModeSeg(mode, 'x')}<button class="ib" data-fa="add" data-k="task" data-o="${tid}" title="Attach a file (PDF, image, document…)" aria-label="Attach a file">${ic('paperclip', 18)}</button><button class="btn pri" data-x="close">Done</button></div>`
    + `<div class="ne-tool${mode === 'blocks' ? ' bm' : ''}" id="x-tool">${mdToolbar('#x-ta')}</div>`
    + edBody('x', t.notes, mode, 'xnotes', 'Write your notes in Markdown…')
    + `<div class="ne-foot"><span id="x-stat">${edStats(t.notes)}</span><span class="hide-m">Esc to close · changes save as you type</span></div>`, m => {
    if (mode === 'blocks') U._xStart(); else { const ta = $('#x-ta', m); if (ta && narrow(900) === false) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
    m.oninput = e => { if (e.target.id !== 'x-ta') return; t.notes = e.target.value; save(); clearTimeout(timer); timer = setTimeout(paint, 100); };
    m.onchange = e => {
      if (!(e.target.classList && e.target.classList.contains('mdchk'))) return;
      const box = $('#x-ta', m); box.value = mdToggleLine(box.value, +e.target.dataset.mdl); t.notes = box.value; save(); sfx('tick'); paint();
    };
    m.onclick = async e => {
      const fa = e.target.closest('[data-fa]'); if (fa) { if (fa.dataset.fa === 'add') { const fs = await pickFiles(); if (fs.length) await filesIntoText($('#x-ta', m), fs); } else fileAction(fa); return; }
      const fl = e.target.closest('.fl[data-file]'); if (fl) { fileView('task', tid, fl.dataset.file); return; }
      if (e.target.closest('[data-x=close]') || e.target.classList.contains('mback')) { finish(); return; }
      const f = e.target.closest('[data-act=nfmt]'); if (f) { if ($('#x-ed', m).classList.contains('ed-blocks') && bedFormat(f.dataset.k)) return; mdFormat(f.dataset.k, $('#x-ta', m)); return; }
      const b = e.target.closest('[data-ed=x]'); if (b) { mode = b.dataset.mode; edSetMode('x', mode); }
    };
  }, 'xl');
}

/* ---------- linking notes and tasks ----------
   Both sides show the link as chips you can open or remove, and both open the same picker: search, tap to link / unlink. */
const linkChipTask = (t, rm) => `<span class="lchip${t.status !== 'open' ? ' fin' : ''}"><button type="button" class="lc-b" data-act="nlnkopen" data-id="${t.id}" title="Open this task">${ic(t.status === 'done' ? 'check-circle' : 'check-square', 13)}<span>${titleHtml(t)}</span>${t.due ? `<small>${esc(dueLabel(t))}</small>` : ''}</button>${rm ? `<button type="button" class="lc-x" data-act="nlnkrm" data-id="${t.id}" title="Unlink" aria-label="Unlink">${ic('x', 12)}</button>` : ''}</span>`;
function noteLinksHtml(n) {
  const ts = linkedTasks(n);
  return `<span class="ne-lh">${ic('link', 14)} Tasks</span>${ts.map(t => linkChipTask(t, true)).join('')}<button type="button" class="btn sm" data-act="nlnkpick">${ic('plus', 13)} ${ts.length ? 'Link' : 'Link a task'}</button>`;
}
function linkedNotesHtml(t) {
  const ns = linkedNotes(t);
  return `<div class="lnks"><div class="fh"><b>${ic('notes', 14)} Linked notes</b>${ns.length ? `<span class="fcnt">${ns.length}</span>` : ''}<button type="button" class="btn sm" data-act="lnkpick">${ic('plus', 13)} ${ns.length ? 'Link' : 'Link a note'}</button></div>`
    + (ns.length ? `<div class="lchips">${ns.map(n => `<span class="lchip"><button type="button" class="lc-b" data-act="lnkopen" data-id="${n.id}" title="Open this note">${ic('notes', 13)}<span>${noteTitleHtml(n)}</span></button><button type="button" class="lc-x" data-act="lnkrm" data-id="${n.id}" title="Unlink" aria-label="Unlink">${ic('x', 12)}</button></span>`).join('')}</div>` : '<p class="hint">Link a note to keep longer writing next to this task. It stays with every repeat of the task.</p>')
    + '</div>';
}
function openTaskById(id) {
  const t = getT(id); if (!t) { toast('That task was deleted'); return; }
  if ($('#modal.on')) closeModal();
  setNav(t.deleted ? 'trash' : t.status === 'done' ? 'done' : t.listId === 'inbox' ? 'inbox' : 'list:' + t.listId); U.sel = id; renderMain(); renderDetail();
}
// the picker: kind 'task' links notes to the open task, kind 'note' links tasks to the open note
function openLinkPicker(kind, id) {
  const own = kind === 'task' ? getT(id) : noteById(id); if (!own) return;
  const isOn = x => (kind === 'task' ? (own.links || []).includes(x.id) : (x.links || []).includes(own.id));
  const items = q => {
    q = q.trim().toLowerCase();
    const all = kind === 'task' ? S.notes.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0)) : S.tasks.filter(t => !t.deleted && !t.log && t.status !== 'wontdo').sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || dueKey(a).localeCompare(dueKey(b)));
    return all.filter(x => !q || (kind === 'task' ? noteTitle(x) + ' ' + x.body : x.title + ' ' + x.notes).toLowerCase().includes(q)).sort((a, b) => (isOn(b) ? 1 : 0) - (isOn(a) ? 1 : 0)).slice(0, 60);
  };
  const row = x => `<button type="button" class="lprow${isOn(x) ? ' on' : ''}" data-lid="${x.id}"><span class="lpc">${isOn(x) ? ic('check', 14) : ''}</span><span class="lpt">${kind === 'task' ? noteTitleHtml(x) : titleHtml(x)}</span><small>${esc(kind === 'task' ? noteWhen(x.updated) : (x.due ? dueLabel(x) : listOf(x.listId).name))}</small></button>`;
  const list = q => items(q).map(row).join('') || `<p class="hint">${kind === 'task' ? 'No notes yet — create one below.' : 'No matching tasks.'}</p>`;
  openModal(`<h3>${kind === 'task' ? 'Link notes to this task' : 'Link tasks to this note'}</h3><input id="lp-q" placeholder="${kind === 'task' ? 'Search notes' : 'Search tasks'}" autocomplete="off"><div class="lplist" id="lp-l">${list('')}</div><div class="mact"><button data-m="new">${ic('plus', 14)} ${kind === 'task' ? 'New note for this task' : 'New task for this note'}</button><span class="sp"></span><button class="pri" data-m="ok">Done</button></div>`, m => {
    const q = $('#lp-q', m), paint = () => { $('#lp-l', m).innerHTML = list(q.value); };
    if (!narrow(820)) q.focus();
    m.oninput = e => { if (e.target.id === 'lp-q') paint(); };
    const finish = () => { closeModal(); if (U.page === 'notes') renderMain(); else refresh(); };
    m.onclick = async e => {
      const r = e.target.closest('[data-lid]');
      if (r) { const x = r.dataset.lid; if (kind === 'task') setLink(own, x, !isOn(noteById(x))); else { const t = getT(x); setLink(t, own.id, !isOn(t)); } sfx('tick'); paint(); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) finish(); return; }
      if (b.dataset.m === 'ok') finish();
      else if (b.dataset.m === 'new') {
        if (kind === 'task') { const n = newNote({ title: own.title.trim(), ...(own.listId && own.listId !== 'inbox' ? { listId: own.listId } : {}) }); S.notes.push(n); setLink(own, n.id, true); sfx('add'); closeModal(); openNoteById(n.id); setTimeout(() => { const ta = $('#n-ta'); if (ta) ta.focus(); }, 30); }
        else { const title = await askText('New task linked to this note', '', 'e.g. Book the venue tomorrow 5pm'); if (title) { const t = quickAdd(title, {}); setLink(t, own.id, true); renderSide(); } openLinkPicker(kind, id); }
      }
    };
  }, 'wide');
}
