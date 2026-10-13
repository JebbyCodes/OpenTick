/* OpenTick files: attach PDFs, images, documents, spreadsheets, audio and video to a task, a note or a timetable slot.
   A record keeps a small list `files: [{ id, name, type, size, added }]`; the bytes live in this device's IndexedDB
   (key "file:<id>"), so they never inflate the saved data or the sync file. The list syncs with the record; on another
   device a file shows "not on this device" until it is attached again. In Markdown a file is `[name](ot-file:ID)` and an
   image is `![alt](ot-file:ID)`, which the renderer turns into a link that opens the viewer / an inline picture. */

const FILE_MAX = 40 * 1024 * 1024;
const FILE_EXT = (n = '') => (String(n).match(/\.([A-Za-z0-9]{1,6})$/) || [, ''])[1].toLowerCase();
// kind -> [label, badge colour]
const FILE_KINDS = {
  pdf: ['PDF', '#e5484d'], image: ['Image', '#12a9c7'], audio: ['Audio', '#8e5cf7'], video: ['Video', '#8e5cf7'], doc: ['Document', '#4772fa'],
  sheet: ['Spreadsheet', '#34b36b'], slides: ['Slides', '#f4a62a'], text: ['Text', '#7c828d'], archive: ['Archive', '#b16286'], other: ['File', '#7c828d'],
};
function fileKind(f) {
  const t = String(f.type || '').toLowerCase(), e = FILE_EXT(f.name);
  if (t === 'application/pdf' || e === 'pdf') return 'pdf';
  if (t.startsWith('image/') || /^(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/.test(e)) return 'image';
  if (t.startsWith('audio/') || /^(mp3|wav|ogg|m4a|flac|aac)$/.test(e)) return 'audio';
  if (t.startsWith('video/') || /^(mp4|webm|mov|mkv|m4v)$/.test(e)) return 'video';
  if (/^(docx?|odt|rtf|pages)$/.test(e)) return 'doc';
  if (/^(xlsx?|ods|csv|tsv|numbers)$/.test(e)) return 'sheet';
  if (/^(pptx?|odp|key)$/.test(e)) return 'slides';
  if (t.startsWith('text/') || /^(txt|md|markdown|json|xml|yaml|yml|log|html?|css|js|ts|py|sh)$/.test(e)) return 'text';
  if (/^(zip|tar|gz|7z|rar)$/.test(e)) return 'archive';
  return 'other';
}
const fileBadge = f => { const k = fileKind(f), c = FILE_KINDS[k][1], e = FILE_EXT(f.name).toUpperCase() || FILE_KINDS[k][0].toUpperCase(); return `<span class="fext" style="--c:${c}">${esc(e.slice(0, 4))}</span>`; };
const fileSize = n => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB' : (n / 1048576).toFixed(1) + ' MB');

/* ---------- storage ---------- */
const FILE_URL = new Map(); // id -> blob URL (kept while the page is open)
async function filePut(file) {
  const id = uid(); await idb('readwrite', s => s.put({ blob: file, name: file.name, type: file.type || '', size: file.size, at: Date.now() }, 'file:' + id));
  return { id, name: file.name || 'file', type: file.type || '', size: file.size, added: Date.now() };
}
async function fileGet(id) { try { const v = await idb('readonly', s => s.get('file:' + id)); return v ? v.blob : null; } catch (e) { return null; } }
async function fileUrl(id) { if (FILE_URL.has(id)) return FILE_URL.get(id); const b = await fileGet(id); if (!b) return null; const u = URL.createObjectURL(b); FILE_URL.set(id, u); return u; }
// forget bytes no record points at any more (only ones older than a day, so nothing in the middle of being attached is lost)
async function filesGC() {
  try {
    const used = new Set([...S.tasks, ...S.notes, ...S.slots].flatMap(o => (o.files || []).map(f => f.id)));
    const keys = (await idb('readonly', s => s.getAllKeys())) || [];
    for (const k of keys) {
      if (!/^file:/.test(k) || used.has(k.slice(5))) continue;
      const v = await idb('readonly', s => s.get(k)); if (v && Date.now() - (v.at || 0) > 864e5) await idb('readwrite', s => s.delete(k));
    }
  } catch (e) { /* storage is optional */ }
}
async function saveBlob(name, blob) {
  const T = TAURI();
  if (T && T.dialog && T.fs) { const p = pathOf(await T.dialog.save({ defaultPath: name })); if (!p) return false; await T.fs.writeFile(p, new Uint8Array(await blob.arrayBuffer())); return true; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); return true;
}
// choose one or more files of any type (browser input, or the native dialog in the desktop / mobile app)
async function pickFiles(accept = '', multiple = true) {
  const T = TAURI();
  if (T && T.dialog && T.fs) {
    const r = await T.dialog.open({ multiple }); if (!r) return []; const out = [];
    for (const p of [].concat(r).map(pathOf)) { try { out.push(new File([await T.fs.readFile(p)], String(p).split(/[\\/]/).pop())); } catch (e) { toast('Could not read ' + p); } }
    return out;
  }
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.multiple = multiple; if (accept) i.accept = accept; i.onchange = () => res([...i.files]); i.oncancel = () => res([]); i.click(); });
}

/* ---------- owners: task | note | slot ---------- */
const fileOwner = (k, id) => (k === 'task' ? getT(id) : k === 'note' ? noteById(id) : k === 'slot' ? slotById(id) : null);
const filesOf = o => (o && Array.isArray(o.files) ? o.files : []);
async function filesAdd(k, id, list) {
  const o = fileOwner(k, id); if (!o) return [];
  const added = [];
  for (const f of list) {
    if (f.size > FILE_MAX) { toast(`“${f.name}” is larger than ${FILE_MAX / 1048576} MB`); continue; }
    try { const rec = await filePut(f); (o.files = filesOf(o)).push(rec); added.push(rec); } catch (e) { toast('Could not store “' + f.name + '”: ' + (e.message || 'storage error')); }
  }
  if (added.length) { if (k === 'note') o.updated = Date.now(); save(); sfx('add'); toast(added.length === 1 ? `Attached “${added[0].name}”` : `Attached ${added.length} files`); filesRefresh(k, id); }
  return added;
}
const fileMd = f => `${fileKind(f) === 'image' ? '!' : ''}[${f.name.replace(/[\[\]]/g, '')}](ot-file:${f.id})`;

/* ---------- the attachments block ---------- */
function filesHtml(k, id) {
  const o = fileOwner(k, id), fs = filesOf(o), mdOk = k === 'task' || k === 'note', at = `data-k="${k}" data-o="${esc(id)}"`;
  return `<div class="fsec" ${at}><div class="fh"><b>${ic('paperclip', 14)} Attachments</b>${fs.length ? `<span class="fcnt">${fs.length}</span>` : ''}<button type="button" class="btn sm" data-fa="add" ${at}>${ic('plus', 13)} Add file</button></div>`
    + fs.map(f => `<div class="frow" data-fa="open" ${at} data-id="${f.id}" data-file="${f.id}" tabindex="0" role="button" aria-label="Open ${esc(f.name)}">${fileKind(f) === 'image' ? `<img class="fth" data-file="${f.id}" alt="">` : fileBadge(f)}<div class="fn"><b>${esc(f.name)}</b><small>${esc(FILE_KINDS[fileKind(f)][0])} · ${fileSize(f.size)}<em class="fmiss"> · not on this device</em></small></div>${mdOk ? `<button type="button" class="ib sm" data-fa="ins" ${at} data-id="${f.id}" title="Insert a link in the text" aria-label="Insert a link in the text">${ic('link', 15)}</button>` : ''}<button type="button" class="ib sm" data-fa="dl" ${at} data-id="${f.id}" title="Save a copy" aria-label="Save a copy">${ic('download', 15)}</button><button type="button" class="ib sm" data-fa="rm" ${at} data-id="${f.id}" title="Remove" aria-label="Remove">${ic('x', 15)}</button></div>`).join('')
    + `<div class="fdrop hint">${fs.length ? '' : 'PDFs, images, documents, spreadsheets, audio, video… '}Drop files here${mdOk ? ', paste an image into the text' : ''}, or use Add file. Files stay on this device.</div></div>`;
}
function filesRefresh(k, id) {
  $$(`.fsec[data-k="${k}"][data-o="${id}"]`).forEach(el => { el.outerHTML = filesHtml(k, id); });
  filesHydrate(document);
  if (U.page === 'notes' && k === 'note') renderNoteList(); else if (!$('#modal.on')) renderMain();
}
// fill in pictures and mark files that are not on this device (runs on anything that carries data-file)
async function filesHydrate(root) {
  for (const el of $$('[data-file]', root || document)) {
    if (el.dataset.fh) continue; el.dataset.fh = '1'; const id = el.dataset.file;
    if (el.tagName === 'IMG') { const u = await fileUrl(id); if (u) el.src = u; else { el.alt = el.alt || 'Image not on this device'; el.classList.add('fmissing'); } }
    else if (el.classList.contains('frow') || el.classList.contains('fl')) { if (!(await fileGet(id))) el.classList.add('miss'); }
  }
}
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body && document.body.nodeType) {
  new MutationObserver(() => { clearTimeout(U._fh); U._fh = setTimeout(() => filesHydrate(document), 30); }).observe(document.body, { childList: true, subtree: true });
}

/* ---------- viewer ---------- */
async function fileView(k, o, id) {
  const own = fileOwner(k, o), f = filesOf(own).find(x => x.id === id); if (!f) return;
  const blob = await fileGet(id);
  if (!blob) { toast('“' + f.name + '” was attached on another device and is not stored here. Attach it again to open it.'); return; }
  if ($('#modal.on')) { // an editor dialog is open: do not replace it (that would lose the edits), open the file beside it instead
    if (TAURI()) { try { await saveBlob(f.name, blob); } catch (e) { /* cancelled */ } } else window.open(URL.createObjectURL(blob), '_blank');
    return;
  }
  const url = URL.createObjectURL(blob), kind = fileKind(f);
  let body;
  if (kind === 'pdf') body = `<iframe class="fv-pdf" src="${url}" title="${esc(f.name)}"></iframe><p class="hint fv-note">If the PDF stays blank (some phones cannot show PDFs here), use <b>Open</b> or <b>Save</b>.</p>`;
  else if (kind === 'image') body = `<div class="fv-img"><img src="${url}" alt="${esc(f.name)}"></div>`;
  else if (kind === 'audio') body = `<div class="fv-med"><audio controls src="${url}"></audio></div>`;
  else if (kind === 'video') body = `<div class="fv-med"><video controls playsinline src="${url}"></video></div>`;
  else if (kind === 'text' && f.size < 600 * 1024) {
    const txt = await blob.text(), e = FILE_EXT(f.name);
    body = /^(md|markdown)$/.test(e) ? `<div class="md fv-txt">${md(txt)}</div>` : `<pre class="fv-txt">${esc(txt)}</pre>`;
  } else body = `<div class="empty">${fileBadge(f)}<p>No preview for this kind of file.<br>${esc(f.name)} · ${fileSize(f.size)}</p><button class="btn pri" data-fv="save">${ic('download', 16)} Save a copy</button></div>`;
  const done = () => { URL.revokeObjectURL(url); closeModal(); };
  openModal(`<div class="xhead"><button class="ib" data-fv="close" aria-label="Close">${ic('left', 20)}</button><div class="xt"><b>${esc(f.name)}</b><small>${esc(FILE_KINDS[kind][0])} · ${fileSize(f.size)}</small></div><button class="btn hide-m" data-fv="open">Open</button><button class="btn" data-fv="save">${ic('download', 15)} Save</button></div><div class="fv-body">${body}</div>`, m => {
    m.onclick = async e => {
      const b = e.target.closest('[data-fv]');
      if (b && b.dataset.fv === 'save') { try { if (await saveBlob(f.name, blob)) toast('Saved'); } catch (err) { toast('Could not save: ' + (err.message || err)); } }
      else if (b && b.dataset.fv === 'open') { if (TAURI()) { try { await saveBlob(f.name, blob); } catch (err) { /* cancelled */ } } else window.open(url, '_blank'); }
      else if ((b && b.dataset.fv === 'close') || e.target.classList.contains('mback')) done();
    };
  }, 'xl');
}

/* ---------- inserting a link into the text ---------- */
function fileInsert(k, o, id) {
  const own = fileOwner(k, o), f = filesOf(own).find(x => x.id === id); if (!own || !f) return;
  const txt = fileMd(f), ta = k === 'note' ? $('#n-ta') : $('#x-ta') || $('textarea[data-f="notes"]');
  if (ta && ta.setRangeText) {
    const a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, pre = a > 0 && ta.value[a - 1] !== '\n' ? '\n\n' : '';
    ta.setRangeText(pre + txt + '\n', a, ta.selectionEnd == null ? a : ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); toast('Link inserted'); return;
  }
  if (k === 'note') { own.body = (own.body ? own.body.replace(/\s*$/, '\n\n') : '') + txt + '\n'; own.updated = Date.now(); } else own.notes = (own.notes ? own.notes.replace(/\s*$/, '\n\n') : '') + txt + '\n';
  save(); toast('Link added to the notes'); refresh();
}

/* ---------- one handler for every [data-fa] control, in the page or in a dialog ---------- */
async function fileAction(el) {
  const a = el.dataset.fa, k = el.dataset.k, o = el.dataset.o, id = el.dataset.id;
  if (a === 'add') { const fs = await pickFiles(); if (fs.length) await filesAdd(k, o, fs); }
  else if (a === 'open') fileView(k, o, id);
  else if (a === 'ins') fileInsert(k, o, id);
  else if (a === 'dl') { const own = fileOwner(k, o), f = filesOf(own).find(x => x.id === id), b = f && await fileGet(id); if (!b) { toast('This file is not stored on this device'); return; } try { if (await saveBlob(f.name, b)) toast('Saved'); } catch (e) { toast('Could not save: ' + (e.message || e)); } }
  else if (a === 'rm') {
    const own = fileOwner(k, o), f = filesOf(own).find(x => x.id === id); if (!f) return;
    if (!$('#modal.on') && !await askConfirm(`Remove “${f.name}” from this ${k}?`, 'Remove')) return; // inside an editor dialog it is removed straight away
    own.files = filesOf(own).filter(x => x.id !== id); if (k === 'note') own.updated = Date.now(); save(); sfx('trash'); filesRefresh(k, o);
  }
}
// which record a text box belongs to (for pasting or dropping a file into it)
const fileTarget = ta => (ta.id === 'n-ta' ? ['note', U.noteSel] : ta.id === 'x-ta' ? ['task', U.xTask] : ta.dataset && ta.dataset.f === 'notes' ? ['task', U.sel] : null);
async function filesIntoText(ta, list) {
  const t = fileTarget(ta); if (!t || !t[1] || !list.length) return;
  const added = await filesAdd(t[0], t[1], list);
  if (added.length) { ta.focus(); ta.setRangeText((ta.value && !/\n$/.test(ta.value) ? '\n' : '') + added.map(fileMd).join('\n') + '\n', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('paste', e => {
    const ta = e.target && e.target.closest && e.target.closest('textarea[data-md]'), fs = e.clipboardData && e.clipboardData.files && [...e.clipboardData.files];
    if (ta && fs && fs.length) { e.preventDefault(); filesIntoText(ta, fs.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${todayStr()}-${i + 1}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type })))); }
  });
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files') && e.target.closest && e.target.closest('textarea[data-md],.fsec')) { e.preventDefault(); const z = e.target.closest('.fsec'); $$('.fsec.over').forEach(x => { if (x !== z) x.classList.remove('over'); }); if (z) z.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('.fsec'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
  document.addEventListener('drop', e => {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    const ta = e.target.closest && e.target.closest('textarea[data-md]'), z = e.target.closest && e.target.closest('.fsec');
    if (ta) { e.preventDefault(); filesIntoText(ta, [...e.dataTransfer.files]); }
    else if (z) { e.preventDefault(); z.classList.remove('over'); filesAdd(z.dataset.k, z.dataset.o, [...e.dataTransfer.files]); }
  });
  document.addEventListener('keydown', e => { const r = e.target.classList && e.target.classList.contains('frow') ? e.target : null; if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileView(r.dataset.k, r.dataset.o, r.dataset.id); } });
}
