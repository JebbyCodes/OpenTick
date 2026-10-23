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
// With device encryption on, a file is stored as { enc, at, m (name, type, size: sealed), d (the bytes: sealed) }. The bytes are not compressed
// (attachments already are) and never leave this device. An older plain record ({ blob, name, … }) stays readable until it is sealed.
const fileSealOn = () => vaultScope('local') && !!Vault.key;
async function fileRecord(blob, meta, at) {
  if (!fileSealOn()) return { blob, name: meta.name, type: meta.type, size: meta.size, at };
  return { enc: 1, at, m: await vSeal(JSON.stringify(meta), 'filem'), d: await vSealBin(new Uint8Array(await blob.arrayBuffer()), 'file') };
}
async function filePut(file) {
  const id = uid(), rec = await fileRecord(file, { name: file.name, type: file.type || '', size: file.size }, Date.now());
  await idb('readwrite', s => s.put(rec, 'file:' + id));
  const back = await fileGet(id); // never keep a record whose bytes did not make it into storage
  if (!back || back.size !== file.size) { try { await idb('readwrite', s => s.delete('file:' + id)); } catch (e) { /* nothing to clean */ } throw new Error('the file was not saved completely'); }
  return { id, name: file.name || 'file', type: file.type || '', size: file.size, added: Date.now() };
}
// a stored record -> a Blob (null when it is gone, or sealed with a key this device does not hold)
async function fileOpen(v) {
  if (!v) return null;
  if (!v.enc) return v.blob || null;
  const m = JSON.parse(await vOpen(v.m, 'filem')), bytes = await vOpenBin(v.d, 'file');
  return new Blob([bytes], { type: m.type || '' });
}
async function fileGet(id) { try { return await fileOpen(await idb('readonly', s => s.get('file:' + id))); } catch (e) { return null; } }
// bring one stored file in line with the current settings and key (sealed or plain): used when encryption is turned on, off or re-keyed
async function fileReseal(key) {
  const v = await idb('readonly', s => s.get(key)); if (!v) return;
  const want = fileSealOn();
  if (want === !!v.enc && (!want || (v.d && v.d.vid === Vault.cfg.id))) return;
  const blob = await fileOpen(v); if (!blob) return;
  const meta = v.enc ? JSON.parse(await vOpen(v.m, 'filem')) : { name: v.name, type: v.type, size: v.size };
  const rec = await fileRecord(blob, meta, v.at);
  await idb('readwrite', s => s.put(rec, key));
}
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
/* ---------- choosing files ----------
   Desktop: the native dialog + the fs plugin (a path). Android: the system document picker returns content:// URIs, not paths
   (there is no filesystem path to open); the fs plugin can read them, but only with the `fs:allow-read-file` permission (see
   src-tauri/capabilities/default.json), and the file's real name and type are not part of the URI, so both are recovered here.
   Browser: a hidden <input type="file">. Every failure is turned into a message that says what happened and what to try. */
const EXT_MIME = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif', heic: 'image/heic',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', xml: 'application/xml', html: 'text/html', htm: 'text/html',
  zip: 'application/zip', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf',
};
const mimeFromName = n => EXT_MIME[FILE_EXT(n)] || '';
// the first bytes of a file say what it is, for providers that hand over a name with no extension
function sniffFile(b) {
  const u = b && b.length ? b : new Uint8Array(0), at = (i, ...v) => v.every((x, k) => u[i + k] === x);
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return ['pdf', 'application/pdf'];
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return ['png', 'image/png'];
  if (at(0, 0xff, 0xd8, 0xff)) return ['jpg', 'image/jpeg'];
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return ['gif', 'image/gif'];
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return ['webp', 'image/webp'];
  if (at(0, 0x49, 0x44, 0x33)) return ['mp3', 'audio/mpeg'];
  if (at(4, 0x66, 0x74, 0x79, 0x70)) return ['mp4', 'video/mp4'];
  if (at(0, 0x50, 0x4b, 0x03, 0x04)) return ['zip', 'application/zip']; // also .docx / .xlsx / .pptx: those keep the name they came with
  return null;
}
// "content://…/document/primary%3ADocuments%2Freport.pdf" -> "report.pdf"; "…/msf%3A1042" (a provider id, not a name) -> "" ; "C:\\a\\b.txt" -> "b.txt"
function nameFromPath(p) {
  let s = String(p == null ? '' : p).split(/[?#]/)[0];
  try { s = decodeURIComponent(s); } catch (e) { /* keep it as it is */ }
  const last = s.split(/[\\/]/).pop().split(':').pop().trim();
  return /^(msf|raw|image|video|audio|document)?\d+$/i.test(last) || !last ? '' : last;
}
function fileReadError(kind, name, detail) {
  const e = new Error(({
    permission: `OpenTick is not allowed to read “${name}”. Choose it again from the file picker (for example from Downloads or Documents). If this keeps happening, copy the file to your device's internal storage first.`,
    missing: `“${name}” could not be found. It may have been moved or deleted — pick it again.`,
    provider: `“${name}” could not be opened from its storage provider. If it is in a cloud drive, open the drive app and make it available offline, then try again.`,
    empty: `“${name}” is empty (0 bytes), so nothing was attached.`,
    big: `“${name}” is larger than ${FILE_MAX / 1048576} MB, so it was not attached.`,
    read: `“${name}” could not be read${detail ? ' (' + detail + ')' : ''}. Try picking it again.`,
  })[kind] || `“${name}” could not be read.`);
  e.kind = kind; e.file = name; return e;
}
// what a thrown value from the dialog / fs plugin means for the person
function classifyReadError(err, name) {
  const m = String((err && (err.message || err)) || '');
  if (err && err.kind) return err;
  if (/not allowed|forbidden|denied|permission|scope|securityexception|acl|EACCES|os error 13/i.test(m)) return fileReadError('permission', name);
  if (/not found|no such file|enoent|os error 2\b|does not exist|FileNotFound/i.test(m)) return fileReadError('missing', name);
  if (/provider|offline|network|timeout|timed out|unavailable|EIO|os error 5\b|DeadObject|remote/i.test(m)) return fileReadError('provider', name);
  return fileReadError('read', name, m.slice(0, 120));
}
const toBytes = r => { const t = Object.prototype.toString.call(r); return t === '[object Uint8Array]' ? r : t === '[object ArrayBuffer]' ? new Uint8Array(r) : Array.isArray(r) ? Uint8Array.from(r) : null; };
let PICK_BUSY = false, PICK_N = 0;
// read one path / content URI picked in the native dialog into a File, with a real name and type
async function readPicked(T, p) {
  let name = nameFromPath(p), label = name || 'the selected file';
  try { if (T.fs.stat) { const st = await T.fs.stat(p); if (st && st.size > FILE_MAX) throw fileReadError('big', label); } } catch (e) { if (e && e.kind) throw e; /* a content:// URI may not support stat */ }
  let bytes; try { bytes = toBytes(await T.fs.readFile(p)); } catch (e) { throw classifyReadError(e, label); }
  if (!bytes) throw fileReadError('read', label, 'unexpected data');
  if (!bytes.length) throw fileReadError('empty', label);
  if (bytes.length > FILE_MAX) throw fileReadError('big', label);
  let type = mimeFromName(name); const sn = sniffFile(bytes);
  if (!name) { name = `attachment-${++PICK_N}${sn ? '.' + sn[0] : ''}`; type = sn ? sn[1] : ''; }
  else if (!type && sn) type = sn[1];
  return new File([bytes], name, { type });
}
const pickMsg = (n, fails) => `${fails.length === 1 ? fails[0].message : `${fails.length} of ${n} files could not be attached. ${fails[0].message}`}`;
async function pickFiles(accept = '', multiple = true) {
  const T = TAURI();
  if (T && T.dialog && T.fs) {
    if (PICK_BUSY) return []; // a second tap while the picker is open must not open another one (the native dialog always settles, so the flag cannot stick)
    PICK_BUSY = true;
    try {
      let r; try { r = await T.dialog.open({ multiple }); } catch (e) { toast('The file picker could not be opened: ' + String((e && e.message) || e).slice(0, 120), { label: 'OK', fn() {} }); return []; }
      const paths = [...new Set([].concat(r || []).map(pathOf).filter(Boolean))]; // the same file picked twice counts once
      const out = [], fails = [];
      for (const p of paths) { try { out.push(await readPicked(T, p)); } catch (e) { fails.push(classifyReadError(e, nameFromPath(p) || 'the selected file')); } }
      if (fails.length) toast(pickMsg(paths.length, fails), { label: 'OK', fn() {} });
      return out;
    } finally { PICK_BUSY = false; }
  }
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = multiple; i.hidden = true; if (accept) i.accept = accept;
    let done = false; const end = v => { if (done) return; done = true; i.remove(); res(v); };
    i.onchange = () => end([...(i.files || [])]); i.oncancel = () => end([]);
    (document.body || document.documentElement).append(i); i.click(); // in the page: some WebViews drop the change event of a detached input
  });
}

/* ---------- owners: task | note | slot ---------- */
const fileOwner = (k, id) => (k === 'task' ? getT(id) : k === 'note' ? noteById(id) : k === 'slot' ? slotById(id) : null);
const filesOf = o => (o && Array.isArray(o.files) ? o.files : []);
// the same bytes under the same name and size are already attached to this record
async function fileDuplicate(o, f) {
  for (const x of filesOf(o)) {
    if (x.name !== f.name || x.size !== f.size) continue;
    const b = await fileGet(x.id); if (!b) continue;
    try { const [p, q] = await Promise.all([b.arrayBuffer(), f.arrayBuffer()]), u = new Uint8Array(p), v = new Uint8Array(q); let same = u.length === v.length; for (let i = 0; same && i < u.length; i++) if (u[i] !== v[i]) same = false; if (same) return true; } catch (e) { /* compare failed: treat it as new */ }
  }
  return false;
}
async function filesAdd(k, id, list) {
  const o = fileOwner(k, id); if (!o) return [];
  const added = [], skipped = [];
  for (const f of list) {
    if (!f || !f.name) continue;
    if (!f.size) { skipped.push(`“${f.name}” is empty`); continue; }
    if (f.size > FILE_MAX) { skipped.push(`“${f.name}” is larger than ${FILE_MAX / 1048576} MB`); continue; }
    if (await fileDuplicate(o, f)) { skipped.push(`“${f.name}” is already attached`); continue; }
    try { const rec = await filePut(f); (o.files = filesOf(o)).push(rec); added.push(rec); } catch (e) { skipped.push('“' + f.name + '” could not be stored: ' + (e.message || 'storage error')); }
  }
  if (added.length) { if (k === 'note') o.updated = Date.now(); save(); sfx('add'); toast(added.length === 1 ? `Attached “${added[0].name}”` : `Attached ${added.length} files`); filesRefresh(k, id); }
  if (skipped.length) toast((added.length ? 'Not attached: ' : '') + skipped.join('; '), { label: 'OK', fn() {} });
  return added;
}
// the kind of an attachment by id (searched across everything that can hold files), '' when unknown
const fileKindById = id => { for (const o of [...S.tasks, ...S.notes, ...S.slots]) { const f = (o.files || []).find(x => x.id === id); if (f) return fileKind(f); } return ''; };
const fileMd = f => `${['image', 'audio', 'video'].includes(fileKind(f)) ? '!' : ''}[${f.name.replace(/[\[\]]/g, '')}](ot-file:${f.id})`;

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
  for (const el of $$('[data-file], [data-fe]', root || document)) {
    if (el.dataset.fh) continue; el.dataset.fh = '1'; const id = el.dataset.file || el.dataset.fe;
    if (el.tagName === 'IMG') { const u = await fileUrl(id); if (u) el.src = u; else { el.alt = el.alt || 'Image not on this device'; el.classList.add('fmissing'); } }
    else if (el.dataset.fe) { const u = await fileUrl(id), k = fileKindById(id); el.innerHTML = !u ? `<span class="hint">${esc(el.dataset.alt || 'File')} is not on this device. Attach it again to play it here.</span>` : k === 'audio' ? `<audio controls preload="metadata" src="${u}"></audio>` : k === 'video' ? `<video controls preload="metadata" playsinline src="${u}"></video>` : `<iframe src="${u}" title="${esc(el.dataset.alt || 'PDF')}" loading="lazy"></iframe>`; el.classList.toggle('miss', !u); }
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
  const txt = fileMd(f), live = BE.cur && ((k === 'note' && BE.cur.o.pre === 'n') || (k === 'task' && BE.cur.o.pre === 'x')) ? $('textarea.bk-t', BE.cur.host) : null, ta = live || (k === 'note' ? $('#n-ta') : $('#x-ta') || $('textarea[data-f="notes"]'));
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
const fileTarget = ta => (ta.dataset && ta.dataset.bk === 'n' ? ['note', U.noteSel] : ta.dataset && ta.dataset.bk === 'x' ? ['task', U.xTask] : ta.id === 'n-ta' ? ['note', U.noteSel] : ta.id === 'x-ta' ? ['task', U.xTask] : ta.dataset && ta.dataset.f === 'notes' ? ['task', U.sel] : null);
async function filesIntoText(ta, list) {
  const t = fileTarget(ta); if (!t || !t[1] || !list.length) return;
  const added = await filesAdd(t[0], t[1], list);
  if (added.length) { ta.focus(); ta.setRangeText((ta.value && !/\n$/.test(ta.value) ? '\n' : '') + added.map(fileMd).join('\n') + '\n', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('paste', e => {
    const ta = e.target && e.target.closest && e.target.closest('textarea[data-md],textarea[data-bk]'), fs = e.clipboardData && e.clipboardData.files && [...e.clipboardData.files];
    if (ta && fs && fs.length) { e.preventDefault(); filesIntoText(ta, fs.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `pasted-${todayStr()}-${i + 1}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: f.type })))); }
  });
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files') && e.target.closest && e.target.closest('textarea[data-md],textarea[data-bk],.fsec')) { e.preventDefault(); const z = e.target.closest('.fsec'); $$('.fsec.over').forEach(x => { if (x !== z) x.classList.remove('over'); }); if (z) z.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('.fsec'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
  document.addEventListener('drop', e => {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    const ta = e.target.closest && e.target.closest('textarea[data-md],textarea[data-bk]'), z = e.target.closest && e.target.closest('.fsec');
    if (ta) { e.preventDefault(); filesIntoText(ta, [...e.dataTransfer.files]); }
    else if (z) { e.preventDefault(); z.classList.remove('over'); filesAdd(z.dataset.k, z.dataset.o, [...e.dataTransfer.files]); }
  });
  document.addEventListener('keydown', e => { const r = e.target.classList && e.target.classList.contains('frow') ? e.target : null; if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileView(r.dataset.k, r.dataset.o, r.dataset.id); } });
}
