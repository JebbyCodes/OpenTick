/* OpenTick blocks: the model behind the block editor (Anytype-style editing of a note).
   A note is still ONE Markdown string. For editing it is split into blocks — paragraphs, headings, list items, quotes, code, tables —
   and every block keeps the exact text it was read from (its marker `pre`, its `text`, a closing `post`), plus the number of line
   breaks that followed it (`gap`). Putting the blocks back together therefore gives the original text again, byte for byte; only blocks
   you change differ. Anything the editor does not understand (setext headings, indented code, definitions, HTML…) is a `raw` block that is
   edited as plain Markdown, so nothing is ever lost or rewritten.
   This file is pure logic (no DOM) so it can be tested on its own. */
const BK_FENCE = /^\s*(`{3,}|~{3,})/;
const BK_ITEM = /^(\s*(?:[-*+]|\d{1,9}[.)])[ \t]+)(.*)$/;
const BK_BOX = /^(\[[ xX]\](?:[ \t]+|$))/;
const BK_DEF = /^ {0,3}\[(?:\^[^\]\s]+|[^\]^][^\]]*)\]:\s*\S/;
const bkId = () => 'b' + Math.random().toString(36).slice(2, 9);
const bkMake = (kind, o = {}) => ({ id: bkId(), kind, pre: '', text: '', post: '', gap: 2, ...o });

// the source text of one block
function blkSrc(b) {
  if (b.kind === 'quote') return b.text.split('\n').map(l => b.pre + l).join('\n');
  return b.pre + b.text + b.post;
}
// text -> { blocks, lead, tail }
function blkParse(src) {
  const text = String(src ?? '').replace(/\r\n?/g, '\n'), L = text.split('\n'), blocks = []; let i = 0, lead = 0, tail = 0;
  while (i < L.length && L[i] === '') { lead++; i++; }
  if (i >= L.length) return { blocks, lead: lead > 0 ? lead - 1 : 0, tail: 0, empty: true };
  const raw = lines => bkMake('raw', { text: lines.join('\n') });
  while (i < L.length) {
    const s = L[i]; let b, m;
    if ((m = s.match(BK_FENCE))) { // fenced code, through the closing fence
      const f = m[1][0], close = new RegExp('^\\s*' + f + '{3,}\\s*$'); let k = i + 1;
      while (k < L.length && !close.test(L[k])) k++;
      const body = L.slice(i + 1, Math.min(k, L.length)), closed = k < L.length;
      b = bkMake('code', { pre: s + (closed || body.length ? '\n' : ''), text: body.join('\n'), post: closed ? (body.length ? '\n' : '') + L[k] : '' });
      i = closed ? k + 1 : L.length;
    } else if (!s.trim()) { b = raw([s]); i++; } // a line of spaces: kept as it is
    else if (s.includes('|') && i + 1 < L.length && L[i + 1].includes('|') && MD_SEP.test(L[i + 1])) {
      const t = [s, L[i + 1]]; i += 2; while (i < L.length && L[i].trim() && L[i].includes('|')) t.push(L[i++]);
      b = bkMake('table', { text: t.join('\n') });
    } else if (/^(?: {4}|\t)\S/.test(s)) { // indented code: raw, with the blank lines inside it
      const t = []; while (i < L.length && (/^(?: {4}|\t)/.test(L[i]) || (L[i] === '' && i + 1 < L.length && /^(?: {4}|\t)\S/.test(L[i + 1])))) t.push(L[i++]);
      b = raw(t);
    } else if ((m = s.match(/^( {0,3}#{1,6}[ \t]+)(.*)$/))) { b = bkMake('h', { pre: m[1], text: m[2] }); i++; }
    else if (MD_HR.test(s)) { b = raw([s]); i++; }
    else if (/^\s*>/.test(s)) {
      const q = []; while (i < L.length && /^\s*>/.test(L[i])) q.push(L[i++]);
      const pre = q[0].match(/^\s*> ?/)[0];
      b = q.every(l => l.startsWith(pre)) ? bkMake('quote', { pre, text: q.map(l => l.slice(pre.length)).join('\n') }) : raw(q);
    } else if ((m = s.match(BK_ITEM)) && !MD_HR.test(s)) {
      let pre = m[1], text = m[2]; const c = text.match(BK_BOX); if (c) { pre += c[1]; text = text.slice(c[1].length); }
      const t = [text]; i++;
      while (i < L.length && L[i].trim() && !BK_ITEM.test(L[i]) && /^\s+\S/.test(L[i]) && !BK_FENCE.test(L[i])) t.push(L[i++]); // indented continuation lines
      b = bkMake('li', { pre, text: t.join('\n') });
    } else if (BK_DEF.test(s)) { b = raw([s]); i++; }
    else if (i + 1 < L.length && /^ {0,3}(=+|-+)\s*$/.test(L[i + 1])) { b = raw([s, L[i + 1]]); i += 2; } // setext heading
    else {
      const p = [s]; i++;
      while (i < L.length && L[i].trim() && !mdBlockStart(L, i)) { if (/^ {0,3}(=+|-+)\s*$/.test(L[i])) { p.push(L[i++]); break; } p.push(L[i++]); }
      b = p.length > 1 && /^ {0,3}(=+|-+)\s*$/.test(p[p.length - 1]) ? raw(p) : bkMake('p', { text: p.join('\n') });
    }
    blocks.push(b);
    let k = 0; while (i + k < L.length && L[i + k] === '') k++;
    if (i + k >= L.length) { tail = k; i = L.length; } else { b.gap = 1 + k; i += k; }
  }
  const last = blocks[blocks.length - 1]; if (last) last.gap = 1;
  return { blocks, lead, tail };
}
// blocks -> text (trailing empty paragraphs are dropped)
function blkSerialize(doc) {
  const bs = doc.blocks.slice(); while (bs.length && bs[bs.length - 1].kind === 'p' && bs[bs.length - 1].text === '' && !bs[bs.length - 1].pre) bs.pop();
  if (!bs.length) return '';
  return '\n'.repeat(doc.lead || 0) + bs.map((b, i) => blkSrc(b) + (i < bs.length - 1 ? '\n'.repeat(Math.max(1, b.gap || 2)) : '')).join('') + '\n'.repeat(doc.tail || 0);
}
// text -> a doc that always has at least one block to type into
function blkDoc(src) {
  const d = blkParse(src); if (!d.blocks.length) d.blocks.push(bkMake('p'));
  return d;
}
// re-read one edited block: it may have become several (a paste), or a different kind. Returns the replacement blocks.
function blkReparse(b) {
  const d = blkParse(blkSrc(b)), bs = d.blocks.length ? d.blocks : [bkMake('p')];
  bs[bs.length - 1].gap = b.gap; bs[0].id = b.id; return bs;
}

/* ---------- list item helpers ---------- */
function liInfo(b) {
  const m = b.pre.match(/^(\s*)([-*+]|(\d{1,9})([.)]))([ \t]+)(\[[ xX]\](?:[ \t]+|$))?$/); if (!m) return null;
  return { ind: m[1], mark: m[2], num: m[3] != null ? +m[3] : null, delim: m[4] || '', sp: m[5], box: m[6] || '', checked: !!m[6] && /[xX]/.test(m[6]) };
}
const liLevel = b => { const i = liInfo(b); return i ? Math.min(6, Math.round(i.ind.replace(/\t/g, '    ').length / 2)) : 0; };
function liNext(b) { // the marker for the item after this one: counts up, and a new to-do starts unticked
  const i = liInfo(b); if (!i) return '- ';
  return i.ind + (i.num != null ? (i.num + 1) + i.delim : i.mark) + i.sp + (i.box ? '[ ] ' : '');
}
function liShift(b, dir) { // indent / outdent by two spaces; false when it cannot move
  if (dir > 0) { if (liLevel(b) >= 6) return false; b.pre = '  ' + b.pre; return true; }
  const n = b.pre.replace(/^( {1,2}|\t)/, ''); if (n === b.pre) return false; b.pre = n; return true;
}
function liToggle(b) { // tick / untick a to-do item
  const i = liInfo(b); if (!i || !i.box) return false;
  b.pre = i.ind + i.mark + i.sp + (i.checked ? '[ ] ' : '[x] '); return true;
}

/* ---------- turning a block into another kind ---------- */
const BK_TURN = [ // [id, label, hint, search words]
  ['p', 'Text', 'Plain paragraph', 'paragraph text plain'], ['h1', 'Heading 1', 'Big section heading', 'heading title h1 #'], ['h2', 'Heading 2', 'Medium heading', 'heading h2 ##'],
  ['h3', 'Heading 3', 'Small heading', 'heading h3 ###'], ['ul', 'Bulleted list', 'A list with bullets', 'bullet list unordered -'], ['ol', 'Numbered list', 'A list with numbers', 'number list ordered 1.'],
  ['todo', 'To-do', 'A checkbox item', 'todo task checkbox check [ ]'], ['quote', 'Quote', 'Set a quotation apart', 'quote blockquote >'], ['code', 'Code', 'A block of code', 'code snippet ```'],
];
const blkPlain = b => (b.kind === 'raw' || b.kind === 'table' ? blkSrc(b) : b.text);
function blkTurn(b, to) {
  const text = blkPlain(b), i = b.kind === 'li' ? liInfo(b) : null, ind = i ? i.ind : '', box = i && i.box ? i.box : '[ ] ';
  b.post = ''; b.text = text;
  if (to === 'p') { b.kind = 'p'; b.pre = ''; }
  else if (/^h[1-6]$/.test(to)) { b.kind = 'h'; b.pre = '#'.repeat(+to[1]) + ' '; b.text = text.replace(/\n+/g, ' '); }
  else if (to === 'ul') { b.kind = 'li'; b.pre = ind + '- '; }
  else if (to === 'ol') { b.kind = 'li'; b.pre = ind + '1. '; }
  else if (to === 'todo') { b.kind = 'li'; b.pre = ind + (i && i.num != null ? i.mark + ' ' : i ? i.mark + i.sp : '- ') + box; }
  else if (to === 'quote') { b.kind = 'quote'; b.pre = '> '; }
  else if (to === 'code') { b.kind = 'code'; b.pre = '```\n'; b.post = '\n```'; }
  else return false;
  if (b.kind !== 'li' && b.kind !== 'quote') b.gap = Math.max(2, b.gap || 2);
  return true;
}
// "# ", "- ", "1. ", "[] ", "> " typed at the start of a paragraph or item turns it into that kind; returns true when it did
function blkShortcut(b) {
  if (b.kind !== 'p' && b.kind !== 'li') return false;
  const t = b.text; let m;
  if (b.kind === 'p') {
    if ((m = t.match(/^(#{1,6}) /))) { b.kind = 'h'; b.pre = m[0]; b.text = t.slice(m[0].length); return true; }
    if ((m = t.match(/^(?:\[\]|\[ \]|- \[ \]) ?(?=\S|$)/)) && /^(?:\[\] |\[ \] |- \[ \] )/.test(t)) { b.kind = 'li'; b.pre = '- [ ] '; b.text = t.slice(m[0].length); return true; }
    if ((m = t.match(/^([-*+]) /))) { b.kind = 'li'; b.pre = m[0]; b.text = t.slice(2); return true; }
    if ((m = t.match(/^(\d{1,9})([.)]) /))) { b.kind = 'li'; b.pre = m[0]; b.text = t.slice(m[0].length); return true; }
    if ((m = t.match(/^> /))) { b.kind = 'quote'; b.pre = '> '; b.text = t.slice(2); return true; }
  } else if (!liInfo(b).box && (m = t.match(/^\[([ xX]?)\] /))) { const i = liInfo(b); b.pre = i.ind + i.mark + i.sp + (/x/i.test(m[1]) ? '[x] ' : '[ ] '); b.text = t.slice(m[0].length); return true; }
  return false;
}

/* ---------- editing operations on a doc (each returns where the caret goes: { i, pos } or null) ---------- */
function blkSplit(doc, i, pos) {
  const b = doc.blocks[i], after = b.text.slice(pos);
  if (b.kind === 'code' || b.kind === 'raw' || b.kind === 'table') return null;
  const n = bkMake(b.kind === 'li' ? 'li' : 'p', { gap: b.gap, text: after });
  if (b.kind === 'li') n.pre = liNext(b);
  b.text = b.text.slice(0, pos); b.gap = b.kind === 'li' ? 1 : 2; if (b.kind === 'li' && (doc.blocks[i + 1] || {}).kind !== 'li' && n.gap < 2) n.gap = 2;
  doc.blocks.splice(i + 1, 0, n); return { i: i + 1, pos: 0 };
}
// Enter on an empty list item: one level out, or out of the list
function blkLeaveList(b) { if (b.kind !== 'li') return false; if (liShift(b, -1)) return true; b.kind = 'p'; b.pre = ''; b.gap = 2; return true; }
function blkMergeUp(doc, i) { // Backspace at the very start of block i
  const b = doc.blocks[i], p = doc.blocks[i - 1]; if (!p) return null;
  const textual = k => k === 'p' || k === 'h' || k === 'li' || k === 'quote';
  if (b.text === '' && b.kind !== 'code' && b.kind !== 'table' && b.kind !== 'raw') { p.gap = b.gap; doc.blocks.splice(i, 1); return { i: i - 1, pos: Infinity }; }
  if (!textual(p.kind) || !textual(b.kind)) return { i: i - 1, pos: Infinity }; // code, tables and raw blocks are not glued to their neighbours
  const at = p.text.length; p.text += b.text; p.gap = b.gap; doc.blocks.splice(i, 1); return { i: i - 1, pos: at };
}
function blkMergeDown(doc, i) { // Delete at the very end of block i
  const b = doc.blocks[i], n = doc.blocks[i + 1]; if (!n) return null;
  const textual = k => k === 'p' || k === 'h' || k === 'li' || k === 'quote';
  if (!textual(b.kind) || !textual(n.kind)) return null;
  const at = b.text.length; b.text += n.text; b.gap = n.gap; doc.blocks.splice(i + 1, 1); return { i, pos: at };
}
function blkMove(doc, i, to) {
  if (to < 0 || to >= doc.blocks.length || to === i) return false;
  const wasLast = doc.blocks[doc.blocks.length - 1], [b] = doc.blocks.splice(i, 1); doc.blocks.splice(to, 0, b);
  if (wasLast !== doc.blocks[doc.blocks.length - 1]) wasLast.gap = wasLast.kind === 'li' ? 1 : 2; // it has a neighbour below now
  const l = doc.blocks[doc.blocks.length - 1]; l.gap = Math.max(1, l.gap || 1);
  return true;
}
function blkDuplicate(doc, i) { const b = doc.blocks[i], c = { ...b, id: bkId() }; b.gap = b.kind === 'li' ? 1 : 2; doc.blocks.splice(i + 1, 0, c); return { i: i + 1, pos: Infinity }; }
// insert a ready-made block after block i (a divider, a table, a picture…), with a paragraph after it to carry on typing
function blkInsertAfter(doc, i, kind, text) {
  const cur = doc.blocks[i], nb = bkMake(kind, { text, gap: 2 });
  if (cur && cur.kind === 'p' && cur.text === '' && !cur.pre) { const g = cur.gap; Object.assign(cur, { kind, text, gap: 2 }); doc.blocks.splice(i + 1, 0, bkMake('p', { gap: g })); return { i: i + 1, pos: 0 }; }
  if (cur) cur.gap = Math.max(2, cur.gap || 2);
  doc.blocks.splice(i + 1, 0, nb, bkMake('p')); return { i: i + 2, pos: 0 };
}

// after an edit around block i: a list and the paragraph, quote… next to it are separated by a blank line (inside a list the items stay tight)
function blkFixGaps(doc, i) {
  for (const k of [i - 1, i]) {
    const a = doc.blocks[k], b = doc.blocks[k + 1]; if (!a || !b) continue;
    if ((a.kind === 'li') !== (b.kind === 'li') && a.gap < 2) a.gap = 2;
    if (a.kind === 'li' && b.kind === 'li' && a.gap > 2) a.gap = 2;
  }
}
