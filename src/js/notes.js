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
const noteSnippet = n => {
  const lines = String(n.body || '').split('\n').map(l => mdPlain(l.trim().replace(NOTE_MARK, '').replace(/^(?:[-*_]\s*){3,}$/, '').replace(/^(?:```|~~~).*$/, '')).trim()).filter(Boolean);
  return (n.title && n.title.trim() ? lines : lines.slice(1)).join(' ').slice(0, 110);
};
function noteList() {
  const q = U.nq.trim().toLowerCase();
  return S.notes.filter(n => !q || (n.title + ' ' + n.body + ' ' + n.tags.join(' ') + ' ' + (n.files || []).map(f => f.name).join(' ')).toLowerCase().includes(q))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
}
function noteListHtml() {
  const ns = noteList(); if (!ns.length) return `<p class="hint pad">${U.nq ? 'No notes match.' : 'No notes yet.'}</p>`;
  let pinned = null, out = '';
  for (const n of ns) {
    if (!!n.pinned !== pinned) { pinned = !!n.pinned; if (pinned && ns.some(x => !x.pinned)) out += '<div class="grp">Pinned</div>'; else if (!pinned && ns.some(x => x.pinned)) out += '<div class="grp">Notes</div>'; }
    out += `<div class="nti${U.noteSel === n.id ? ' on' : ''}${editedCls(n.id)}" data-act="noteopen" data-id="${n.id}"><div class="nt-t">${n.pinned ? ic('star', 12) + ' ' : ''}<span class="nt-tx">${noteTitleHtml(n)}</span></div><div class="nt-s">${esc(noteSnippet(n)) || '<i>No text</i>'}</div><div class="nt-m"><span>${esc(noteWhen(n.updated))}</span>${linkedTasks(n).length ? `<span title="Linked tasks">${ic('check-square', 12)} ${linkedTasks(n).length}</span>` : ''}${(n.files || []).length ? `<span title="Attachments">${ic('paperclip', 12)} ${n.files.length}</span>` : ''}${n.tags.map(tagChip).join('')}</div></div>`;
  }
  return out;
}
function noteEditorHtml(n) {
  const mode = edMode(S.settings.notes.view);
  return `<div class="ne-head"><button class="ib mob2" data-act="noteback" aria-label="Back to the list">${ic('left', 20)}</button><input class="ne-title" data-f="ntitle" value="${esc(n.title)}" placeholder="Untitled note" autocomplete="off">`
    + `<button class="ib${n.pinned ? ' on' : ''}" data-act="notepin" title="${n.pinned ? 'Unpin' : 'Pin to the top'}">${ic('star', 18)}</button>${edModeSeg(mode, 'n')}<button class="ib" data-act="notemenu" title="More">${ic('more', 18)}</button></div>`
    + `<div class="ne-tags"><span>${ic('tag', 14)}</span><input data-f="ntags" value="${esc(n.tags.map(g => '#' + g).join(' '))}" placeholder="#tags" autocomplete="off"></div>`
    + `<div class="ne-links" id="n-links">${noteLinksHtml(n)}</div>`
    + `<details class="ne-att"${(n.files || []).length ? ' open' : ''}><summary>${ic('paperclip', 14)} Attachments${(n.files || []).length ? ` <span class="fcnt">${n.files.length}</span>` : ''}</summary>${filesHtml('note', n.id)}</details>`
    + `<div class="ne-tool" id="n-tool"${mode === 'preview' ? ' hidden' : ''}>${mdToolbar('#n-ta')}</div>`
    + edBody('n', n.body, mode, 'nbody', 'Start writing… Markdown is supported: # headings, **bold**, - lists, [[links to other notes]], tables and more.')
    + `<div class="ne-foot" id="n-stat">${edStats(n.body)}<span><span class="sv" data-sv></span> <span id="n-ed">${editedText(n, true)}</span></span></div>`;
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
  const st = $('#n-stat'); if (st) st.innerHTML = `${edStats(n.body)}<span><span class="sv" data-sv></span> <span id="n-ed">${editedText(n, true)}</span></span>`;
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
  if (pre === 'n') { S.settings.notes.view = mode; save(); if (mode !== 'write') notePaint(); }
  if (mode !== 'preview') { const ta = $(`#${pre}-ta`); if (ta && ta.focus) ta.focus(); }
}

/* ---------- a task's notes in a wide editor ---------- */
function openNoteExpand(tid) {
  const t = getT(tid); if (!t) return;
  let mode = edMode('auto'), timer = 0; U.xTask = tid;
  const paint = () => { const pv = $('#x-pv'); if (pv) pv.innerHTML = previewHtml(t.notes); const st = $('#x-stat'); if (st) st.textContent = edStats(t.notes); };
  const finish = () => { clearTimeout(timer); closeModal(); renderMain(); renderDetail(); renderSide(); };
  openModal(`<div class="xhead"><button class="ib" data-x="close" title="Back to the task (Esc)" aria-label="Close">${ic('left', 20)}</button><div class="xt"><b>${titleHtml(t)}</b><small>Notes · ${esc(listOf(t.listId).name)}${t.due ? ' · ' + esc(dueLabel(t)) : ''}</small></div>${edModeSeg(mode, 'x')}<button class="ib" data-fa="add" data-k="task" data-o="${tid}" title="Attach a file (PDF, image, document…)" aria-label="Attach a file">${ic('paperclip', 18)}</button><button class="btn pri" data-x="close">Done</button></div>`
    + `<div class="ne-tool" id="x-tool">${mdToolbar('#x-ta')}</div>`
    + edBody('x', t.notes, mode, 'xnotes', 'Write your notes in Markdown…')
    + `<div class="ne-foot"><span id="x-stat">${edStats(t.notes)}</span><span class="hide-m">Esc to close · changes save as you type</span></div>`, m => {
    const ta = $('#x-ta', m); if (ta && narrow(900) === false) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    m.oninput = e => { if (e.target.id !== 'x-ta') return; t.notes = e.target.value; save(); clearTimeout(timer); timer = setTimeout(paint, 100); };
    m.onchange = e => {
      if (!(e.target.classList && e.target.classList.contains('mdchk'))) return;
      const box = $('#x-ta', m); box.value = mdToggleLine(box.value, +e.target.dataset.mdl); t.notes = box.value; save(); sfx('tick'); paint();
    };
    m.onclick = async e => {
      const fa = e.target.closest('[data-fa]'); if (fa) { if (fa.dataset.fa === 'add') { const fs = await pickFiles(); if (fs.length) await filesIntoText($('#x-ta', m), fs); } else fileAction(fa); return; }
      const fl = e.target.closest('.fl[data-file]'); if (fl) { fileView('task', tid, fl.dataset.file); return; }
      if (e.target.closest('[data-x=close]') || e.target.classList.contains('mback')) { finish(); return; }
      const f = e.target.closest('[data-act=nfmt]'); if (f) { mdFormat(f.dataset.k, $('#x-ta', m)); return; }
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
        if (kind === 'task') { const n = newNote({ title: own.title.trim() }); S.notes.push(n); setLink(own, n.id, true); sfx('add'); closeModal(); openNoteById(n.id); setTimeout(() => { const ta = $('#n-ta'); if (ta) ta.focus(); }, 30); }
        else { const title = await askText('New task linked to this note', '', 'e.g. Book the venue tomorrow 5pm'); if (title) { const t = quickAdd(title, {}); setLink(t, own.id, true); renderSide(); } openLinkPicker(kind, id); }
      }
    };
  }, 'wide');
}
