/* OpenTick bed: the block editor you see (Anytype-style editing of a note's Markdown).
   Every block is shown rendered; the one you are in turns into a text box. Type "/" for a menu of blocks, "# ", "- ", "1. ", "[] ", "> " or
   "```" to start a heading, list, to-do, quote or code block, select text for a small formatting bar, use the handle beside a block to
   turn, move, duplicate or delete it. It edits the same Markdown text as the Source / Split / Preview views (see blocks.js), so nothing
   about a note is lost by editing it this way. One editor at a time is live (BE.cur): the Notes page ('n') or the wide task-notes window ('x'). */
const BE = { cur: null };
const BED_CMDS = [
  ...BK_TURN.map(([id, label, hint, words]) => ({ id, label, hint, words, turn: true })),
  { id: 'hr', label: 'Divider', hint: 'A horizontal line', words: 'divider line rule hr ---' },
  { id: 'table', label: 'Table', hint: 'Rows and columns', words: 'table grid columns' },
  { id: 'image', label: 'Image', hint: 'Attach a picture and show it here', words: 'image picture photo upload' },
  { id: 'file', label: 'File', hint: 'Attach a PDF, document…', words: 'file attach pdf document upload' },
  { id: 'note', label: 'Link to a note', hint: 'A [[link]] to another note', words: 'link note wiki mention [[' },
  { id: 'task', label: 'Link a task', hint: 'Connect a task to this note', words: 'link task connect', only: 'n' },
  { id: 'date', label: "Today's date", hint: 'Type the date', words: 'date today' },
];
const bedHead = b => (b.kind === 'h' ? Math.min(6, (b.pre.match(/#/g) || []).length) : 0);
const bedOwner = inst => (inst.o.pre === 'n' ? ['note', U.noteSel] : ['task', U.xTask]);

/* ---------- drawing ---------- */
function bedDefs(inst) { // reference-link and footnote definitions are shared by every block, so each block is rendered with them in front
  const L = inst.doc.blocks.filter(b => b.kind === 'raw' && BK_DEF.test(b.text)).map(b => b.text.split('\n')[0]);
  inst.defN = L.length; return L.length ? L.join('\n') + '\n' : '';
}
function bedView(inst, b) {
  const src = blkSrc(b), key = inst.defs + '\u0001' + src;
  if (b._k !== key) { try { b._h = md(inst.defs + src); } catch (e) { b._h = '<p>' + esc(src) + '</p>'; } b._k = key; }
  let h = b._h;
  if (!String(h).trim()) h = b.kind === 'raw' && src.trim() ? `<div class="bk-def">${esc(src)}</div>` : inst.doc.blocks.length === 1 ? `<p class="bk-ph">${esc(inst.o.ph || "Type '/' for blocks…")}</p>` : '<p class="bk-gap">&nbsp;</p>';
  return `<div class="md bk-r">${h}</div>`;
}
function bedMarker(b) {
  if (b.kind !== 'li') return ''; const i = liInfo(b); if (!i) return '';
  if (i.box) return `<button type="button" class="bk-m bk-cb${i.checked ? ' on' : ''}" data-bk="cb" tabindex="-1" aria-label="${i.checked ? 'Untick' : 'Tick'}">${i.checked ? ic('check', 12) : ''}</button>`;
  return `<span class="bk-m">${i.num != null ? i.num + i.delim : '•'}</span>`;
}
function bedEdit(inst, b) {
  const code = b.kind === 'code', lang = code ? (b.pre.match(/^\s*(?:`{3,}|~{3,})\s*(.*?)\s*\n?$/) || [, ''])[1] : '';
  const val = b.kind === 'raw' || b.kind === 'table' ? blkSrc(b) : b.text;
  const ph = b.kind === 'p' && !b.text ? (inst.doc.blocks.length === 1 ? inst.o.ph || "Type '/' for blocks…" : "Type '/' for blocks…") : b.kind === 'h' ? 'Heading' : '';
  return (code ? `<div class="bk-lang">${ic('code', 13)}<input data-bk="lang" value="${esc(lang)}" placeholder="language" autocomplete="off" spellcheck="false" aria-label="Code language"></div>` : '')
    + `<div class="bk-e">${bedMarker(b)}<textarea class="bk-t" data-bk-ta data-bk="${inst.o.pre}" rows="1" spellcheck="${code || b.kind === 'table' || b.kind === 'raw' ? 'false' : 'true'}" placeholder="${esc(ph)}" aria-label="Block text">${esc(val)}</textarea></div>`;
}
function bedBlockEl(inst, b, i) {
  const on = i === inst.act, h = bedHead(b);
  return `<div class="bk bk-${b.kind}${h ? ' bk-h' + h : ''}${on ? ' on' : ''}" data-b="${b.id}" style="--lv:${b.kind === 'li' ? liLevel(b) : 0}"><div class="bk-g"><button type="button" class="bk-plus" data-bk="plus" tabindex="-1" title="Add a block below" aria-label="Add a block below">${ic('plus', 14)}</button><button type="button" class="bk-grip" data-bk="grip" draggable="true" tabindex="-1" title="Drag to move · click for options" aria-label="Block options">${ic('grip', 14)}</button></div><div class="bk-c">${on ? bedEdit(inst, b) : bedView(inst, b)}</div></div>`;
}
function bedPaint(inst, focus) {
  const inn = inst.host.querySelector('.bed-in'); if (!inn) return;
  inst.defs = bedDefs(inst);
  inn.innerHTML = inst.doc.blocks.map((b, i) => bedBlockEl(inst, b, i)).join('') + '<div class="bed-end" data-bk="end" aria-hidden="true"></div>';
  inst.host.classList.toggle('has-act', inst.act >= 0);
  if (focus) bedFocus(inst, focus.pos);
  else $$('textarea.bk-t', inn).forEach(bedFit);
}
function bedFit(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(24, ta.scrollHeight) + 'px'; }
function bedFocus(inst, pos) {
  const ta = inst.host.querySelector('.bk.on textarea.bk-t'); if (!ta) return;
  bedFit(ta); ta.focus({ preventScroll: true });
  const p = pos == null || pos === Infinity ? ta.value.length : Math.max(0, Math.min(ta.value.length, pos)); ta.setSelectionRange(p, p);
  const bk = ta.closest('.bk'); if (bk && bk.scrollIntoView) bk.scrollIntoView({ block: 'nearest' });
}
const bedIdx = (inst, id) => inst.doc.blocks.findIndex(b => b.id === id);
const bedCur = inst => inst.doc.blocks[inst.act] || null;
const bedTa = inst => inst.host.querySelector('.bk.on textarea.bk-t');

/* ---------- state: commit, undo, activate ---------- */
function bedCommit(inst) { if (inst.act >= 0) blkFixGaps(inst.doc, inst.act); const t = blkSerialize(inst.doc); if (t !== inst.cur) { inst.cur = t; inst.o.set(t); } }
function bedSnap(inst) { // an undo step: the text and which block / where the caret was
  const ta = bedTa(inst); inst.undo.push({ t: blkSerialize(inst.doc), k: inst.act, pos: ta ? ta.selectionStart : 0 }); if (inst.undo.length > 120) inst.undo.shift(); inst.redo = []; inst.tt = Date.now();
}
function bedUndo(inst, redo) {
  const from = redo ? inst.redo : inst.undo, to = redo ? inst.undo : inst.redo, s = from.pop(); if (!s) return;
  const ta = bedTa(inst); to.push({ t: blkSerialize(inst.doc), k: inst.act, pos: ta ? ta.selectionStart : 0 });
  inst.doc = blkDoc(s.t); inst.act = Math.max(0, Math.min(inst.doc.blocks.length - 1, s.k < 0 ? 0 : s.k)); bedPaint(inst, { pos: s.pos }); bedCommit(inst);
}
// leave the active block: tidy it (a paste may have made several blocks, an empty paragraph disappears) and show it rendered
function bedLeave(inst) {
  if (inst.act < 0) return;
  const b = bedCur(inst); let i = inst.act;
  if (b) {
    if (b.kind === 'raw' || b.kind === 'table' || b.kind === 'code') { /* kept as typed */ }
    const bs = blkReparse(b); if (bs.length !== 1 || bs[0].kind !== b.kind || (b.kind === 'raw' && bs[0].kind !== 'raw')) inst.doc.blocks.splice(i, 1, ...bs);
    const c = inst.doc.blocks[i]; if (c && c.kind === 'p' && c.text === '' && inst.doc.blocks.length > 1) inst.doc.blocks.splice(i, 1);
  }
  inst._lastAct = inst.act; inst.act = -1; bedClosePop(inst); bedPaint(inst); bedCommit(inst);
}
function bedActivate(inst, i, pos) {
  i = Math.max(0, Math.min(inst.doc.blocks.length - 1, i)); const id = inst.doc.blocks[i].id;
  if (inst.act >= 0 && inst.act !== i) { const was = inst.doc.blocks[inst.act]; const wid = was && was.id; bedLeaveKeep(inst); const k = bedIdx(inst, id); i = k < 0 ? Math.min(i, inst.doc.blocks.length - 1) : k; void wid; }
  inst.act = i; bedClosePop(inst); bedPaint(inst, { pos });
}
function bedLeaveKeep(inst) { // like bedLeave, but the caller goes on to activate another block straight away
  const b = bedCur(inst), i = inst.act; if (!b) { inst.act = -1; return; }
  const bs = blkReparse(b); if (bs.length !== 1 || bs[0].kind !== b.kind) inst.doc.blocks.splice(i, 1, ...bs);
  const c = inst.doc.blocks[i]; if (c && c.kind === 'p' && c.text === '' && inst.doc.blocks.length > 1) inst.doc.blocks.splice(i, 1);
  inst.act = -1;
}
function bedGo(inst, i, pos) { // move the caret to another block (arrow keys, Enter, Backspace…)
  if (i < 0 || i >= inst.doc.blocks.length) return; inst.act = i; bedClosePop(inst); bedPaint(inst, { pos }); bedCommit(inst);
}
function bedReload(inst) { // the text was changed from outside (a file inserted, Source view…): read it again
  const t = inst.o.get(); if (t === inst.cur) return; inst.doc = blkDoc(t); inst.cur = t; inst.act = -1; bedPaint(inst);
}

/* ---------- popups: slash menu, wiki-link menu, formatting bar, block menu ---------- */
function bedPop(inst) { return inst.host.querySelector('.bed-pops'); }
function bedClosePop(inst) { inst.menu = null; const p = bedPop(inst); if (p) p.innerHTML = ''; }
function bedPlace(inst, el, below) { // under (or above) the active block
  const bk = inst.host.querySelector('.bk.on') || inst.host.querySelector('.bk'); if (!bk) return;
  el.style.left = Math.max(8, Math.min(bk.offsetLeft + 38, Math.max(8, inst.host.clientWidth - 280))) + 'px';
  el.style.top = (below ? bk.offsetTop + bk.offsetHeight + 4 : Math.max(2, bk.offsetTop - 42)) + 'px';
}
function bedMenuHtml(inst) {
  const m = inst.menu; if (!m) return '';
  return `<div class="bed-pop bed-menu" role="listbox">${m.items.map((c, n) => `<button type="button" class="bm-i${n === m.sel ? ' on' : ''}" data-bm="${n}" role="option"><b>${esc(c.label)}</b><small>${esc(c.hint || '')}</small></button>`).join('') || '<p class="hint">Nothing matches.</p>'}</div>`;
}
function bedShowMenu(inst) {
  const p = bedPop(inst); if (!p) return; p.innerHTML = bedMenuHtml(inst); const el = p.firstChild; if (!el) return;
  bedPlace(inst, el, true); const on = $('.bm-i.on', p); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
}
function bedMenuItems(inst, m) {
  const q = m.q.trim().toLowerCase();
  if (m.type === 'wiki') { const me = inst.o.pre === 'n' ? U.noteSel : ''; return S.notes.filter(n => n.id !== me && (!q || noteTitle(n).toLowerCase().includes(q))).sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 8).map(n => ({ id: n.id, label: noteTitle(n), hint: noteWhen(n.updated), note: n })); }
  if (m.type === 'turn') return BK_TURN.map(([id, label, hint]) => ({ id, label, hint, turn: true }));
  return BED_CMDS.filter(c => (!c.only || c.only === inst.o.pre) && (!q || (c.label + ' ' + c.words).toLowerCase().includes(q))).slice(0, 12);
}
function bedOpenMenu(inst, type, start) {
  inst.menu = { type, start, q: '', sel: 0, items: [] }; inst.menu.items = bedMenuItems(inst, inst.menu); bedShowMenu(inst);
}
function bedMenuUpdate(inst) {
  const m = inst.menu, ta = bedTa(inst); if (!m || !ta) return;
  const caret = ta.selectionStart, open = m.type === 'wiki' ? '[[' : '/';
  if (m.start < 0 || ta.value.slice(m.start, m.start + open.length) !== open || caret < m.start + open.length) { bedClosePop(inst); return; }
  m.q = ta.value.slice(m.start + open.length, caret);
  if (m.type === 'slash' && /\s/.test(m.q.trim()) && !bedMenuItems(inst, m).length) { bedClosePop(inst); return; }
  if (m.q.length > 24) { bedClosePop(inst); return; }
  m.items = bedMenuItems(inst, m); m.sel = Math.min(m.sel, Math.max(0, m.items.length - 1)); bedShowMenu(inst);
}
async function bedPickMenu(inst, n) {
  const m = inst.menu, c = m && m.items[n]; if (!c) return;
  const i = inst.act, b = bedCur(inst), ta = bedTa(inst); if (!b || !ta) return;
  const caret = ta.selectionStart, start = m.start, type = m.type, open = type === 'wiki' ? '[[' : '/';
  bedSnap(inst);
  if (type === 'wiki') { // [[Title]] in place of "[[query"
    const ins = `[[${c.label}]]`; b.text = b.text.slice(0, start) + ins + b.text.slice(caret); bedClosePop(inst); bedPaint(inst, { pos: start + ins.length }); bedCommit(inst); return;
  }
  b.text = b.text.slice(0, start) + b.text.slice(caret); bedClosePop(inst); // the "/query" is gone
  if (type === 'turn') { blkTurn(b, c.id); bedPaint(inst, { pos: Infinity }); bedCommit(inst); return; }
  if (c.turn) { blkTurn(b, c.id); bedPaint(inst, { pos: Math.min(start, b.text.length) }); bedCommit(inst); return; }
  if (c.id === 'hr') { const f = blkInsertAfter(inst.doc, i, 'raw', '---'); inst.act = f.i; bedPaint(inst, { pos: 0 }); bedCommit(inst); return; }
  if (c.id === 'table') { const f = blkInsertAfter(inst.doc, i, 'table', '| Column | Column |\n|---|---|\n|  |  |'); inst.act = f.i; bedPaint(inst, { pos: 0 }); bedCommit(inst); return; }
  if (c.id === 'date') { const d = new Date(), ins = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; b.text = b.text.slice(0, start) + ins + b.text.slice(start); bedPaint(inst, { pos: start + ins.length }); bedCommit(inst); return; }
  if (c.id === 'note') { bedPaint(inst, { pos: start }); const t2 = bedTa(inst); if (t2) { const cur = bedCur(inst); cur.text = cur.text.slice(0, start) + '[[' + cur.text.slice(start); bedPaint(inst, { pos: start + 2 }); bedOpenMenu(inst, 'wiki', start); } return; }
  if (c.id === 'task') { bedPaint(inst, { pos: start }); bedCommit(inst); openLinkPicker('note', U.noteSel); return; }
  if (c.id === 'image' || c.id === 'file') {
    bedPaint(inst, { pos: start }); bedCommit(inst);
    const [k, id] = bedOwner(inst), files = await pickFiles(c.id === 'image' ? 'image/*' : ''); if (!files.length) return;
    const added = await filesAdd(k, id, files); if (!added.length) return;
    const cur = inst.doc.blocks.findIndex(x => x.id === b.id), at = cur < 0 ? inst.doc.blocks.length - 1 : cur; let f = null;
    for (const rec of added) f = blkInsertAfter(inst.doc, f ? f.i - 1 : at, 'p', fileMd(rec));
    inst.act = f ? f.i : at; bedPaint(inst, { pos: 0 }); bedCommit(inst);
  }
}
// formatting bar over the selection
function bedBar(inst) {
  const ta = bedTa(inst), p = bedPop(inst); if (!p) return;
  const old = p.querySelector('.bed-bar'); if (inst.menu) { if (old) old.remove(); return; }
  if (!ta || ta.selectionStart === ta.selectionEnd || (bedCur(inst) || {}).kind === 'code') { if (old) old.remove(); return; }
  if (old) return;
  const el = document.createElement('div'); el.className = 'bed-pop bed-bar'; el.setAttribute('role', 'toolbar');
  el.innerHTML = [['bold', ic('bold', 15), 'Bold'], ['italic', ic('italic', 15), 'Italic'], ['strike', ic('strike', 15), 'Strikethrough'], ['code', ic('code', 15), 'Code'], ['mark', ic('highlight', 15), 'Highlight'], ['link', ic('link', 15), 'Link']].map(([k, l, t]) => `<button type="button" data-bf="${k}" title="${t}" aria-label="${t}">${l}</button>`).join('') + `<span class="sep"></span><button type="button" data-bf="turn" title="Turn into…" aria-label="Turn into">Turn into ${ic('down', 12)}</button>`;
  p.appendChild(el); bedPlace(inst, el, false);
}
function bedBlockMenu(inst, id, anchor) {
  const i = bedIdx(inst, id); if (i < 0) return; const b = inst.doc.blocks[i], textual = ['p', 'h', 'li', 'quote', 'code'].includes(b.kind);
  const items = [...(textual ? BK_TURN.map(([k, l]) => ({ id: 'turn:' + k, label: 'Turn into ' + l.toLowerCase() })) : []), { id: 'dup', label: 'Duplicate' }, { id: 'up', label: 'Move up' }, { id: 'down', label: 'Move down' }, { id: 'copy', label: 'Copy as Markdown' }, { id: 'del', label: 'Delete block' }];
  inst.menu = { type: 'block', bid: id, start: -1, q: '', sel: 0, items: items.map(x => ({ ...x, hint: '' })) };
  const p = bedPop(inst); p.innerHTML = bedMenuHtml(inst); const el = p.firstChild, bk = inst.host.querySelector(`.bk[data-b="${id}"]`);
  el.classList.add('bed-bm'); el.style.left = Math.max(8, Math.min((bk ? bk.offsetLeft : 0) + 8, inst.host.clientWidth - 250)) + 'px'; el.style.top = (bk ? bk.offsetTop + 28 : 0) + 'px';
}
async function bedBlockAct(inst, c) {
  const id = inst.menu.bid, i = bedIdx(inst, id); bedClosePop(inst); if (i < 0) return; const b = inst.doc.blocks[i];
  bedSnap(inst);
  if (c.id.startsWith('turn:')) { blkTurn(b, c.id.slice(5)); inst.act = i; bedPaint(inst, { pos: Infinity }); }
  else if (c.id === 'dup') { const f = blkDuplicate(inst.doc, i); inst.act = f.i; bedPaint(inst, { pos: Infinity }); }
  else if (c.id === 'up' || c.id === 'down') { blkMove(inst.doc, i, i + (c.id === 'up' ? -1 : 1)); inst.act = -1; bedPaint(inst); }
  else if (c.id === 'copy') { try { await navigator.clipboard.writeText(blkSrc(b)); toast('Copied'); } catch (e) { toast('Could not copy'); } return; }
  else if (c.id === 'del') { inst.doc.blocks.splice(i, 1); if (!inst.doc.blocks.length) inst.doc.blocks.push(bkMake('p')); inst.act = -1; bedPaint(inst); }
  bedCommit(inst);
}

/* ---------- keys ---------- */
function bedEnter(inst, ta) {
  const i = inst.act, b = bedCur(inst); let pos = ta.selectionStart; if (!b) return;
  bedSnap(inst);
  if (ta.selectionEnd !== pos) { b.text = ta.value.slice(0, pos) + ta.value.slice(ta.selectionEnd); } else b.text = ta.value;
  if (b.kind === 'li' && b.text.trim() === '') { blkLeaveList(b); bedPaint(inst, { pos: 0 }); bedCommit(inst); return; }
  const t = b.text.trim(), f = b.kind === 'p' && t.match(/^(```|~~~)([\w+#.-]*)$/);
  if (f) { b.kind = 'code'; b.pre = f[1] + f[2] + '\n'; b.text = ''; b.post = '\n' + f[1]; b.gap = 2; bedPaint(inst, { pos: 0 }); bedCommit(inst); return; }
  if (b.kind === 'p' && /^(?:---|\*\*\*|___)$/.test(t)) { const g = b.gap; b.kind = 'raw'; b.text = t; b.pre = ''; b.gap = 2; const n = bkMake('p', { gap: g }); inst.doc.blocks.splice(i + 1, 0, n); inst.act = i + 1; bedPaint(inst, { pos: 0 }); bedCommit(inst); return; }
  const r = blkSplit(inst.doc, i, pos); if (!r) return; inst.act = r.i; bedPaint(inst, { pos: r.pos }); bedCommit(inst);
}
function bedBackspace(inst, ta, e) {
  const b = bedCur(inst), i = inst.act; if (!b || ta.selectionStart !== 0 || ta.selectionEnd !== 0) return false;
  bedSnap(inst); b.text = ta.value;
  if (b.kind === 'li') { if (!liShift(b, -1)) { b.kind = 'p'; b.pre = ''; b.gap = 2; } bedPaint(inst, { pos: 0 }); bedCommit(inst); return true; }
  if (b.kind === 'h' || b.kind === 'quote') { b.kind = 'p'; b.pre = ''; bedPaint(inst, { pos: 0 }); bedCommit(inst); return true; }
  if (b.kind === 'code' || b.kind === 'raw' || b.kind === 'table') { if (blkPlain(b) === '' || (b.kind === 'raw' && /^(?:---|\*\*\*|___)$/.test(b.text))) { inst.doc.blocks.splice(i, 1); if (!inst.doc.blocks.length) inst.doc.blocks.push(bkMake('p')); const k = Math.max(0, i - 1); inst.act = k; bedPaint(inst, { pos: Infinity }); bedCommit(inst); return true; } return true; }
  const r = blkMergeUp(inst.doc, i); if (!r) return false; inst.act = r.i; bedPaint(inst, { pos: r.pos }); bedCommit(inst); return true;
}
function bedKey(inst, e) {
  const ta = e.target; if (!ta.matches || !ta.matches('textarea.bk-t')) return;
  inst.shift = e.shiftKey; const b = bedCur(inst); if (!b) return;
  const mod = e.ctrlKey || e.metaKey, m = inst.menu;
  if (m && (m.type === 'slash' || m.type === 'wiki' || m.type === 'turn')) { // a menu is open: it takes the arrows, Enter and Escape
    if (e.key === 'ArrowDown') { e.preventDefault(); m.sel = (m.sel + 1) % Math.max(1, m.items.length); bedShowMenu(inst); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); m.sel = (m.sel - 1 + m.items.length) % Math.max(1, m.items.length); bedShowMenu(inst); return; }
    if ((e.key === 'Enter' || e.key === 'Tab') && m.items.length && !e.isComposing) { e.preventDefault(); e.stopPropagation(); bedPickMenu(inst, m.sel); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); bedClosePop(inst); return; }
  }
  if (mod && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); bedUndo(inst, e.shiftKey); return; }
    if (k === 'y') { e.preventDefault(); bedUndo(inst, true); return; }
    const f = { b: 'bold', i: 'italic', k: 'link' }[k]; if (f && b.kind !== 'code') { e.preventDefault(); bedSnap(inst); mdFormat(f, ta); return; }
    if (k === 'enter' && (b.kind === 'code' || b.kind === 'raw' || b.kind === 'table')) { e.preventDefault(); const n = bkMake('p', { gap: b.gap }); b.gap = 2; inst.doc.blocks.splice(inst.act + 1, 0, n); b.text = b.kind === 'raw' ? ta.value : ta.value; inst.act++; bedPaint(inst, { pos: 0 }); bedCommit(inst); return; }
    return;
  }
  if (e.isComposing) return;
  const sel0 = ta.selectionStart === ta.selectionEnd, atStart = sel0 && ta.selectionStart === 0, atEnd = sel0 && ta.selectionStart === ta.value.length;
  if (e.key === 'Enter') {
    if (b.kind === 'code' || b.kind === 'raw' || b.kind === 'table') return; // a new line inside the block
    e.preventDefault();
    if (e.shiftKey) { const p = ta.selectionStart, ind = b.kind === 'li' ? ' '.repeat(b.pre.replace(/\t/g, '    ').length) : ''; ta.setRangeText('\n' + ind, p, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
    bedEnter(inst, ta); return;
  }
  if (e.key === 'Backspace' && atStart) { if (bedBackspace(inst, ta, e)) e.preventDefault(); return; }
  if (e.key === 'Delete' && atEnd) { const r = blkMergeDown(inst.doc, inst.act); if (r) { e.preventDefault(); bedSnap(inst); b.text = ta.value; const r2 = blkMergeDown(inst.doc, inst.act); if (r2) { bedPaint(inst, { pos: r2.pos }); bedCommit(inst); } } return; }
  if (e.key === 'Tab') {
    if (b.kind === 'li') { e.preventDefault(); b.text = ta.value; const p = ta.selectionStart; bedSnap(inst); if (liShift(b, e.shiftKey ? -1 : 1)) { bedPaint(inst, { pos: p }); bedCommit(inst); } return; }
    if (b.kind === 'code' || b.kind === 'raw') { e.preventDefault(); if (e.shiftKey) { const p = ta.selectionStart, s0 = ta.value.lastIndexOf('\n', p - 1) + 1; if (/^ {1,2}/.test(ta.value.slice(s0))) { const n = ta.value.slice(s0).match(/^ {1,2}/)[0].length; ta.setRangeText('', s0, s0 + n, 'preserve'); ta.setSelectionRange(Math.max(s0, p - n), Math.max(s0, p - n)); ta.dispatchEvent(new Event('input', { bubbles: true })); } } else { ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); } }
    return;
  }
  const one = bedOneRow(ta);
  if (e.key === 'ArrowUp' && sel0 && !e.shiftKey && inst.act > 0 && (ta.selectionStart === 0 || (one && ta.value.lastIndexOf('\n', ta.selectionStart - 1) === -1))) { e.preventDefault(); b.text = ta.value; bedGo(inst, inst.act - 1, Infinity); return; }
  if (e.key === 'ArrowDown' && sel0 && !e.shiftKey && inst.act < inst.doc.blocks.length - 1 && (atEnd || (one && ta.value.indexOf('\n', ta.selectionStart) === -1))) { e.preventDefault(); b.text = ta.value; bedGo(inst, inst.act + 1, 0); return; }
  if (e.key === 'ArrowLeft' && atStart && !e.shiftKey && inst.act > 0) { e.preventDefault(); b.text = ta.value; bedGo(inst, inst.act - 1, Infinity); return; }
  if (e.key === 'ArrowRight' && atEnd && !e.shiftKey && inst.act < inst.doc.blocks.length - 1) { e.preventDefault(); b.text = ta.value; bedGo(inst, inst.act + 1, 0); return; }
  if (e.key === 'Escape') { ta.blur(); bedLeave(inst); }
}
// a block that fits on one row: Up / Down leave it at once instead of first moving the caret to its edge
function bedOneRow(ta) { const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22; return ta.scrollHeight <= lh * 1.5; }

/* ---------- input ---------- */
function bedInput(inst, ta, e) {
  const b = bedCur(inst); if (!b) return;
  if (Date.now() - inst.tt > 900) { inst.undo.push({ t: inst.cur, k: inst.act, pos: Math.min(ta.selectionStart, ta.value.length) }); if (inst.undo.length > 120) inst.undo.shift(); inst.redo = []; inst.tt = Date.now(); } // a typing pause starts a new undo step
  if (b.kind === 'raw' || b.kind === 'table') { b.text = ta.value; b.pre = ''; b.post = ''; }
  else { b.text = ta.value; if (b.kind === 'code' && b.post && !b.post.startsWith('\n') && b.text) b.post = '\n' + b.post; }
  const caret = ta.selectionStart;
  if (!b.text.includes('\n') && blkShortcut(b)) { bedPaint(inst, { pos: 0 }); bedCommit(inst); return; }
  // pasted or inserted text with several blocks in it: split it up now
  if (b.kind !== 'code' && b.kind !== 'raw' && b.kind !== 'table' && b.text.includes('\n') && (b.kind !== 'p' || /\n\s*\n|\n(?:#{1,6} |[-*+] |\d{1,9}[.)] |> |```|~~~)/.test(b.text) || (e && /^insertFromPaste|^insertFromDrop/.test(e.inputType || '')))) {
    const bs = blkReparse(b); if (bs.length > 1 || bs[0].kind !== b.kind) { const at = inst.act; inst.doc.blocks.splice(at, 1, ...bs); inst.act = at + bs.length - 1; bedPaint(inst, { pos: Infinity }); bedCommit(inst); return; }
  }
  // "/" starts the block menu, "[[" the note-link menu
  if (inst.menu) bedMenuUpdate(inst);
  else if (e && /^insert/.test(e.inputType || '') && b.kind !== 'code' && b.kind !== 'raw' && b.kind !== 'table') {
    if (ta.value[caret - 1] === '/' && (caret === 1 || /\s/.test(ta.value[caret - 2]))) bedOpenMenu(inst, 'slash', caret - 1);
    else if (ta.value.slice(caret - 2, caret) === '[[') bedOpenMenu(inst, 'wiki', caret - 2);
  }
  bedFit(ta); bedBar(inst); bedCommit(inst);
}

/* ---------- placing the caret where a rendered block was clicked ---------- */
function bedCaretFromClick(e, b) {
  try {
    const at = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null, box = e.target.closest('.bk-r'); if (!at || !box) return Infinity;
    const r = document.createRange(); r.setStart(box, 0); r.setEnd(at.startContainer, at.startOffset);
    const n = r.toString().length, total = box.textContent.length || 1, len = blkPlain(b).length;
    return Math.max(0, Math.min(len, Math.round(len * (n / total))));
  } catch (err) { return Infinity; }
}

/* ---------- mounting ---------- */
// o = { pre: 'n' | 'x', host, get(), set(text), ph }
function bedMount(o) {
  const host = o.host; if (!host) return null;
  host.innerHTML = '<div class="bed-in"></div><div class="bed-pops"></div>';
  const inst = { o, host, doc: blkDoc(o.get()), cur: o.get(), act: -1, defs: '', undo: [], redo: [], tt: 0, shift: false, menu: null, hold: 0 };
  BE.cur = inst; bedPaint(inst);
  if (typeof host.addEventListener !== 'function') return inst; // (the test harness has no real DOM)
  host.addEventListener('mousedown', e => { inst.hold = Date.now(); if (e.target.closest('.bed-pop')) e.preventDefault(); });
  host.addEventListener('touchstart', () => { inst.hold = Date.now(); }, { passive: true });
  host.addEventListener('click', e => {
    const pop = e.target.closest('.bed-pop');
    if (pop) {
      const mi = e.target.closest('[data-bm]'), bf = e.target.closest('[data-bf]');
      if (mi && inst.menu) { const n = +mi.dataset.bm; if (inst.menu.type === 'block') bedBlockAct(inst, inst.menu.items[n]); else bedPickMenu(inst, n); }
      else if (bf) {
        const ta = bedTa(inst); if (!ta) return;
        if (bf.dataset.bf === 'turn') { inst.menu = { type: 'turn', start: -1, q: '', sel: 0, items: [] }; inst.menu.items = bedMenuItems(inst, inst.menu); const bar = bedPop(inst).querySelector('.bed-bar'); if (bar) bar.remove(); bedShowMenu(inst); }
        else { bedSnap(inst); mdFormat(bf.dataset.bf, ta); bedBar(inst); }
      }
      return;
    }
    const act = e.target.closest('[data-bk]');
    if (act && act.dataset.bk === 'plus') { // a new empty block below this one, with the block menu open
      const bk = act.closest('.bk'), i = bedIdx(inst, bk.dataset.b); if (i < 0) return;
      if (inst.act >= 0) { const was = bedCur(inst); if (was) was.text = (bedTa(inst) || { value: was.text }).value; }
      bedSnap(inst); const cur = inst.doc.blocks[i], n = bkMake('p', { gap: cur.gap }); cur.gap = cur.kind === 'li' ? 1 : 2; inst.doc.blocks.splice(i + 1, 0, n); inst.act = i + 1; bedPaint(inst, { pos: 0 });
      const ta = bedTa(inst); if (ta) { ta.value = '/'; ta.setSelectionRange(1, 1); n.text = '/'; bedOpenMenu(inst, 'slash', 0); } return;
    }
    if (act && act.dataset.bk === 'grip') { const bk = act.closest('.bk'); if (inst.menu && inst.menu.type === 'block') bedClosePop(inst); else bedBlockMenu(inst, bk.dataset.b, act); return; }
    if (act && act.dataset.bk === 'cb') { const bk = act.closest('.bk'), b = inst.doc.blocks[bedIdx(inst, bk.dataset.b)]; if (b) { const ta = bedTa(inst); if (ta && bedCur(inst) === b) b.text = ta.value; bedSnap(inst); liToggle(b); sfx('tick'); bedPaint(inst, inst.act >= 0 ? { pos: ta ? ta.selectionStart : Infinity } : null); bedCommit(inst); } return; }
    if (act && act.dataset.bk === 'end') { const last = inst.doc.blocks[inst.doc.blocks.length - 1]; if (last && last.kind === 'p' && last.text === '') bedActivate(inst, inst.doc.blocks.length - 1, 0); else { bedSnap(inst); inst.doc.blocks.push(bkMake('p')); bedActivate(inst, inst.doc.blocks.length - 1, 0); } return; }
    if (e.target.closest('textarea,input')) return;
    const c = e.target.closest('.bk-c'); if (!c || e.target.closest('a,img,.mdchk,.fl,.wl')) return;
    const sel = window.getSelection && window.getSelection(); if (sel && !sel.isCollapsed && sel.toString().length > 0) return; // selecting text to copy it
    const bk = c.closest('.bk'), i = bedIdx(inst, bk.dataset.b); if (i < 0) return;
    if (i === inst.act) return;
    bedActivate(inst, i, bedCaretFromClick(e, inst.doc.blocks[i]));
  });
  host.addEventListener('change', e => { // a to-do ticked in its rendered form (the page-wide handler is for task notes, so it must not see this)
    const el = e.target; if (!(el.classList && el.classList.contains('mdchk'))) return; e.stopPropagation();
    const bk = el.closest('.bk'), b = bk && inst.doc.blocks[bedIdx(inst, bk.dataset.b)]; if (!b) return;
    const ln = +el.dataset.mdl - (inst.defN || 0); bedSnap(inst);
    const src = mdToggleLine(blkSrc(b), ln), nb = blkReparse({ ...b, kind: b.kind, pre: '', text: src, post: '', id: b.id, gap: b.gap });
    inst.doc.blocks.splice(bedIdx(inst, b.id), 1, ...nb.map((x, k) => (k === 0 ? { ...x, id: b.id } : x))); sfx(el.checked ? 'done' : 'undo'); bedPaint(inst); bedCommit(inst);
  });
  host.addEventListener('input', e => { const t = e.target; if (t.matches && t.matches('textarea.bk-t')) bedInput(inst, t, e); else if (t.dataset && t.dataset.bk === 'lang') { const b = bedCur(inst); if (b && b.kind === 'code') { const f = (b.pre.match(/^\s*(`{3,}|~{3,})/) || [, '```'])[1]; b.pre = f + t.value.trim() + '\n'; bedCommit(inst); } } });
  host.addEventListener('keydown', e => bedKey(inst, e));
  host.addEventListener('beforeinput', e => { // soft keyboards often send Enter / Backspace only as input events
    const ta = e.target; if (!ta.matches || !ta.matches('textarea.bk-t') || e.isComposing) return; const b = bedCur(inst); if (!b) return;
    if ((e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') && !inst.shift && !['code', 'raw', 'table'].includes(b.kind)) { e.preventDefault(); if (inst.menu && inst.menu.items.length && inst.menu.type !== 'block') bedPickMenu(inst, inst.menu.sel); else bedEnter(inst, ta); }
    else if (e.inputType === 'deleteContentBackward' && ta.selectionStart === 0 && ta.selectionEnd === 0) { if (bedBackspace(inst, ta, e)) e.preventDefault(); }
  });
  const upd = () => setTimeout(() => { const ta = bedTa(inst); if (ta && document.activeElement === ta) { if (inst.menu) bedMenuUpdate(inst); bedBar(inst); } }, 0);
  host.addEventListener('mouseup', upd); host.addEventListener('keyup', e => { if (e.key !== 'Shift') upd(); inst.shift = e.shiftKey; }); host.addEventListener('touchend', upd);
  host.addEventListener('focusout', () => setTimeout(() => {
    if (Date.now() - inst.hold < 500 || host.contains(document.activeElement)) return;
    if (inst.menu && inst.menu.type === 'block') return;
    bedLeave(inst);
  }, 60));
  host.addEventListener('paste', e => { const cd = e.clipboardData; if (cd && cd.files && cd.files.length) return; /* pictures: the file handler takes it */ });
  // drag a block by its handle
  host.addEventListener('dragstart', e => { const g = e.target.closest && e.target.closest('.bk-grip'); if (!g) return; const bk = g.closest('.bk'); inst.drag = bk.dataset.b; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'block'); bk.classList.add('drag'); });
  host.addEventListener('dragover', e => { if (!inst.drag) return; const bk = e.target.closest('.bk'); if (!bk) return; e.preventDefault(); $$('.drop-t,.drop-b', host).forEach(x => x.classList.remove('drop-t', 'drop-b')); const r = bk.getBoundingClientRect(); bk.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-t' : 'drop-b'); });
  host.addEventListener('drop', e => {
    if (!inst.drag) return; const bk = e.target.closest('.bk'); if (!bk) return; e.preventDefault();
    const from = bedIdx(inst, inst.drag), r = bk.getBoundingClientRect(), to0 = bedIdx(inst, bk.dataset.b), after = e.clientY >= r.top + r.height / 2; inst.drag = null; if (from < 0 || to0 < 0) return;
    let to = to0 + (after ? 1 : 0); if (from < to) to--; bedSnap(inst); if (blkMove(inst.doc, from, to)) { inst.act = -1; bedPaint(inst); bedCommit(inst); }
  });
  host.addEventListener('dragend', () => { inst.drag = null; $$('.drag,.drop-t,.drop-b', host).forEach(x => x.classList.remove('drag', 'drop-t', 'drop-b')); });
  return inst;
}
// toolbar buttons of the Notes page (the same ones Source view uses) act on the live block editor
function bedFormat(kind) {
  const inst = BE.cur; if (!inst) return false;
  let ta = bedTa(inst); if (!ta) { bedActivate(inst, inst.act >= 0 ? inst.act : Math.max(0, inst.doc.blocks.length - 1), Infinity); ta = bedTa(inst); } if (!ta) return true;
  const b = bedCur(inst), turn = { h: 'h2', ul: 'ul', ol: 'ol', task: 'todo', quote: 'quote' }[kind];
  if (turn) { bedSnap(inst); b.text = ta.value; if (b.kind === 'code' || b.kind === 'raw' || b.kind === 'table') return true; const same = (turn === 'h2' && b.kind === 'h') || (turn === 'ul' && b.kind === 'li' && !liInfo(b).box && liInfo(b).num == null) || (turn === 'ol' && b.kind === 'li' && liInfo(b).num != null) || (turn === 'todo' && b.kind === 'li' && liInfo(b).box) || (turn === 'quote' && b.kind === 'quote'); blkTurn(b, same ? 'p' : turn); bedPaint(inst, { pos: Infinity }); bedCommit(inst); return true; }
  if (kind === 'hr') { bedSnap(inst); b.text = ta.value; const f = blkInsertAfter(inst.doc, inst.act, 'raw', '---'); inst.act = f.i; bedPaint(inst, { pos: 0 }); bedCommit(inst); return true; }
  if (kind === 'table') { bedSnap(inst); b.text = ta.value; const f = blkInsertAfter(inst.doc, inst.act, 'table', '| Column | Column |\n|---|---|\n|  |  |'); inst.act = f.i; bedPaint(inst, { pos: 0 }); bedCommit(inst); return true; }
  bedSnap(inst); mdFormat(kind, ta); return true;
}
