/* OpenTick boards: kanban boards with headings of your own.
   S.boards is a synced collection (merged by newest edit, tombstoned on delete, encrypted with everything else):
     { id, name, icon, color, scope '' | 'list:ID' | 'project:ID' | 'tag:name', cols: [{ id, name, color, done, wip }], created, u }
   • A board shows the open tasks of its scope: everything, one list (with its sublists), one project, or one tag. A done heading also shows finished tasks.
   • Where a task sits on a board is task.kb[boardId] = heading id, so a task can be on several boards (a project board and a tag board), keeps
     its place when it moves between them, and syncs like every other task field. A task with no place yet appears under the first heading.
   • A heading marked "done" finishes a task that is dropped on it (repeating tasks roll on to their next date, as when ticked) and reopens it
     when it is moved out again, so a board and the task lists never disagree.
   • Headings are yours: add, rename, recolour, reorder, delete (its cards fall back to the first heading), and set a work-in-progress limit.
   • Moving: drag with a mouse or pen, press and hold on a touch screen, Alt + arrow keys, or the ⋯ menu on a card. All end in kbMove().
   The normaliser is a function declaration on purpose: migrate() calls it while core.js is still loading. */
function kbNormalise(b) {
  b.name = String(b.name || '').slice(0, 80); b.icon = typeof b.icon === 'string' ? b.icon : ''; b.color = typeof b.color === 'string' && b.color ? b.color : '#4772fa';
  b.scope = typeof b.scope === 'string' ? b.scope : '';
  b.cols = (Array.isArray(b.cols) ? b.cols : []).filter(c => c && typeof c === 'object').map(c => ({ id: c.id || uid(), name: String(c.name || '').slice(0, 60), color: typeof c.color === 'string' ? c.color : '', done: !!c.done, wip: Number.isFinite(+c.wip) && +c.wip > 0 ? Math.floor(+c.wip) : 0 }));
  if (!b.cols.length) b.cols = [{ id: uid(), name: 'To do', color: '', done: false, wip: 0 }, { id: uid(), name: 'Done', color: '', done: true, wip: 0 }];
  b.created = b.created || Date.now();
  return b;
}

const KB_PRESETS = [
  ['Simple', 'To do, Doing, Done', [['To do'], ['Doing'], ['Done', 1]]],
  ['Workflow', 'Backlog, Ready, In progress, Review, Done', [['Backlog'], ['Ready'], ['In progress'], ['Review'], ['Done', 1]]],
  ['This week', 'This week, Today, Waiting, Done', [['This week'], ['Today'], ['Waiting'], ['Done', 1]]],
  ['Blank', 'Start with one heading', [['Ideas']]],
];
const kbById = id => S.boards.find(b => b.id === id);
const kbCol = (b, id) => b.cols.find(c => c.id === id);
function kbNewBoard(name, preset = 0, scope = '') {
  const p = KB_PRESETS[preset] || KB_PRESETS[0];
  return kbNormalise({ id: uid(), name, scope, color: COLORS[S.boards.length % COLORS.length][0], created: Date.now(), cols: p[2].map(([n, d]) => ({ id: uid(), name: n, color: '', done: !!d, wip: 0 })) });
}
// the board on screen (this device remembers it)
function kbCurrent() {
  const id = S.settings.ui.board; let b = id && kbById(id);
  if (!b) b = S.boards[0]; return b || null;
}
// the tasks a board shows: open ones of its scope, and the finished ones when it has a done heading
function kbTasks(b) {
  const hasDone = b.cols.some(c => c.done);
  return S.tasks.filter(t => !t.deleted && !t.log && (t.status === 'open' || (t.status === 'done' && hasDone)) && scopeHas(b.scope, t));
}
// the heading a task sits under on a board
function kbColOf(b, t) {
  const id = t.kb && t.kb[b.id];
  if (id && kbCol(b, id)) { const c = kbCol(b, id); if (t.status === 'done' ? c.done : !c.done) return c; }
  if (t.status === 'done') return b.cols.find(c => c.done) || null;
  return b.cols.find(c => !c.done) || b.cols[0];
}
const kbSort = (a, b) => (a.order || 0) - (b.order || 0) || (a.created || 0) - (b.created || 0);
function kbColumns(b) {
  const by = new Map(b.cols.map(c => [c.id, []]));
  for (const t of kbTasks(b)) { const c = kbColOf(b, t); if (c) by.get(c.id).push(t); }
  for (const l of by.values()) l.sort(kbSort);
  return by;
}
// a new task made on a board lands in the scope it shows
function kbHome(b) {
  const sc = b.scope || '';
  if (sc.startsWith('list:')) return { listId: sc.slice(5), tags: [] };
  if (sc.startsWith('project:')) { const p = projectOf(sc.slice(8)); return { listId: (p && projectListIds(p)[0]) || 'inbox', tags: [] }; }
  if (sc.startsWith('tag:')) return { listId: 'inbox', tags: [sc.slice(4)] };
  return { listId: 'inbox', tags: [] };
}
function kbAddTask(b, colId, title) {
  const col = kbCol(b, colId); title = String(title || '').trim(); if (!col || !title) return null;
  const h = kbHome(b), t = newTask({ title, listId: h.listId, tags: h.tags });
  prefNewTask(t, {}); t.listId = h.listId; if (h.tags.length) t.tags = [...new Set([...(t.tags || []), ...h.tags])];
  const last = kbColumns(b).get(col.id).slice(-1)[0]; t.order = last ? (last.order || 0) + 1000 : 0;
  t.kb = { [b.id]: col.id }; S.tasks.push(t);
  if (col.done) toggleDone(t); // a task added straight to a done heading is already done
  save(); return t;
}
// move a task under a heading, before another card (or at the end). The one place every way of moving ends in.
function kbMove(b, t, colId, beforeId) {
  const col = kbCol(b, colId); if (!col || t.deleted) return false;
  t.kb = { ...(t.kb || {}), [b.id]: col.id };
  if (col.done && t.status === 'open') { toggleDone(t); if (t.status === 'open') t.kb[b.id] = (b.cols.find(c => !c.done) || col).id; } // a repeating task rolls on instead of finishing
  else if (!col.done && t.status === 'done') toggleDone(t);
  // order: between the card before and the card after the drop place
  const sib = (kbColumns(b).get(t.kb[b.id]) || []).filter(x => x.id !== t.id);
  let at = beforeId ? sib.findIndex(x => x.id === beforeId) : -1; if (at < 0) at = sib.length;
  const prev = sib[at - 1], next = sib[at];
  if (prev && next) { if ((next.order || 0) - (prev.order || 0) < 1e-6) { sib.splice(at, 0, t); sib.forEach((x, i) => { x.order = i * 1000; }); } else t.order = ((prev.order || 0) + (next.order || 0)) / 2; }
  else if (next) t.order = (next.order || 0) - 1000;
  else if (prev) t.order = (prev.order || 0) + 1000;
  else t.order = 0;
  save();
  return true;
}
function kbMoveStep(b, t, step) {
  const c = kbColOf(b, t), i = c ? b.cols.indexOf(c) : -1, j = Math.max(0, Math.min(b.cols.length - 1, i + step)); if (i < 0 || j === i) return false;
  return kbMove(b, t, b.cols[j].id, null);
}
function kbWipOver(b, c, n) { return c.wip > 0 && !c.done && n > c.wip; }

/* ---------- the page ---------- */
function kbScopeLabel(sc) { const o = scopeOptions().find(x => x[0] === sc); return o ? o[1].replace(/^\S+ ·  */, '') : 'Everything'; }
function kbCardHtml(b, t, ci, n) {
  const col = b.cols[ci], tags = (t.tags || []).map(g => (typeof tagChip === 'function' ? tagChip(g) : `<span class="tg">#${esc(g)}</span>`)).join('');
  const l = t.listId !== 'inbox' && S.lists.some(x => x.id === t.listId) ? listOf(t.listId) : null, home = !b.scope || b.scope.startsWith('tag:') || b.scope.startsWith('project:') ? l : null;
  const subs = (t.subtasks || []).length ? `<span class="kcs">${ic('check', 11)} ${t.subtasks.filter(s => s.done).length}/${t.subtasks.length}</span>` : '';
  return `<div class="kncard p${t.priority}${t.status === 'done' ? ' done' : ''}${U.sel === t.id ? ' sel' : ''}${editedCls(t.id)}" tabindex="0" data-act="open" data-id="${esc(t.id)}" data-col="${esc(col.id)}" role="group" aria-label="${esc(t.title)}, in ${esc(col.name)}">`
    + `<div class="ttl">${typeof taskIcon === 'function' ? taskIcon(t) : ''}${typeof titleHtml === 'function' ? titleHtml(t) : esc(t.title)}</div>`
    + `<div class="meta">${t.due ? `<span class="due${isOverdue(t) ? ' late' : ''}">${esc(dueLabel(t))}</span>` : ''}${subs}${home ? `<span class="nh" style="--c:${home.color}"><span>${esc(home.name)}</span></span>` : ''}${tags}</div>`
    + `<button class="ib sm knmv" data-act="knmove" data-id="${esc(t.id)}" title="Move to…" aria-label="Move ${esc(t.title)} to another heading">${ic('more', 14)}</button></div>`;
}
function kbColHtml(b, c, ci, list) {
  const over = kbWipOver(b, c, list.length), col = c.color || '';
  return `<section class="knc${c.done ? ' isdone' : ''}${over ? ' wip' : ''}" data-col="${esc(c.id)}" style="${col ? `--kc:${esc(col)}` : ''}" aria-label="${esc(c.name)}">`
    + `<header class="knh"><span class="knd"></span><b title="${esc(c.name)}">${esc(c.name || 'Untitled')}</b>${c.done ? `<span class="kdn" title="Finishes tasks dropped here">${ic('check', 12)}</span>` : ''}<span class="knn${over ? ' over' : ''}" title="${c.wip ? `Limit ${c.wip}` : ''}">${list.length}${c.wip ? '/' + c.wip : ''}</span><button class="ib sm" data-act="kncolmenu" data-col="${esc(c.id)}" title="Heading options" aria-label="Options for ${esc(c.name)}">${ic('more', 14)}</button></header>`
    + `<div class="knb" data-col="${esc(c.id)}">${list.map(t => kbCardHtml(b, t, ci)).join('') || '<p class="knempty">Drop cards here</p>'}</div>`
    + (c.done ? '' : `<input class="knadd" data-col="${esc(c.id)}" placeholder="+ Add a card" autocomplete="off" aria-label="Add a card to ${esc(c.name)}">`) + `</section>`;
}
function renderKanbanPage() {
  const b = kbCurrent();
  if (!b) {
    $('#main').innerHTML = topHtml('Boards', '') + `<div class="body"><div class="empty">${ic('columns', 40)}<p>A board for your tasks, with headings of your own. Pick a start, then rename, add or remove headings any time.</p><div class="knpre">${KB_PRESETS.map((p, i) => `<button class="btn" data-act="knnew" data-preset="${i}"><b>${esc(p[0])}</b><small>${esc(p[1])}</small></button>`).join('')}</div></div></div>`;
    return;
  }
  const by = kbColumns(b), total = [...by.values()].reduce((a, l) => a + l.length, 0);
  const tabs = S.boards.map(x => `<button class="knt${x.id === b.id ? ' on' : ''}" data-act="knpick" data-id="${esc(x.id)}" style="--c:${esc(x.color)}" aria-pressed="${x.id === b.id}">${x.icon ? iconAny(x.icon, 14) : ''}<span>${esc(x.name || 'Board')}</span></button>`).join('');
  const tools = `<button class="ib" data-act="knedit" title="Board settings" aria-label="Board settings">${ic('sliders')}</button><button class="btn pri" data-act="knnew">${ic('plus', 16)}<span class="hide-m"> Board</span></button>`;
  $('#main').innerHTML = topHtml('Boards', tools)
    + `<div class="knbar"><div class="knts" role="tablist" aria-label="Boards">${tabs}</div><label class="knsc" title="What this board shows">${ic(b.scope.startsWith('tag:') ? 'tag' : b.scope.startsWith('project:') ? 'layers' : 'list', 14)}<select data-kns aria-label="What this board shows">${opts(scopeOptions('Everything'), b.scope)}</select></label><span class="knct">${total} card${total === 1 ? '' : 's'}</span></div>`
    + `<div class="body knbody"><div class="kn" data-board="${esc(b.id)}">${b.cols.map((c, i) => kbColHtml(b, c, i, by.get(c.id))).join('')}<div class="knc knnewc"><input class="knnew" placeholder="+ Add a heading" autocomplete="off" aria-label="Add a heading"></div></div></div>`;
}

/* ---------- dialogs ---------- */
async function kbBoardForm(b) {
  const isNew = !b, d = b || kbNewBoard('', 0, '');
  const v = await formDialog({ title: isNew ? 'New board' : 'Board settings', ok: isNew ? 'Create' : 'Save', del: !isNew, fields: [
    { k: 'name', label: 'Name', type: 'text', v: d.name, ph: 'e.g. Website relaunch' },
    { k: 'scope', label: 'Shows', type: 'select', v: d.scope, opts: scopeOptions('Everything (all lists)') },
    ...(isNew ? [{ k: 'preset', label: 'Start from', type: 'select', v: 0, opts: KB_PRESETS.map((p, i) => [i, `${p[0]}: ${p[1]}`]) }] : []),
    { k: 'icon', label: 'Icon', type: 'icon', v: d.icon },
    { k: 'color', label: 'Colour', type: 'color', v: d.color },
  ], check: x => (x.name.trim() ? '' : 'Give the board a name') });
  if (!v) return null;
  if (v._del) { S.boards = S.boards.filter(x => x !== b); for (const t of S.tasks) if (t.kb && t.kb[b.id] !== undefined) { t.kb = { ...t.kb }; delete t.kb[b.id]; if (!Object.keys(t.kb).length) delete t.kb; } save(); return { deleted: true }; }
  if (isNew) { const nb = kbNewBoard(v.name.trim(), +v.preset, v.scope); nb.icon = v.icon || ''; nb.color = v.color; S.boards.push(nb); S.settings.ui.board = nb.id; save(); return nb; }
  Object.assign(b, kbNormalise({ ...b, name: v.name.trim(), scope: v.scope, icon: v.icon || '', color: v.color })); save(); return b;
}
async function kbColForm(b, c) {
  const v = await formDialog({ title: 'Heading', ok: 'Save', fields: [
    { k: 'name', label: 'Name', type: 'text', v: c.name, ph: 'e.g. In review' },
    { k: 'color', label: 'Colour', type: 'color', v: c.color || '' },
    { k: 'done', label: 'Cards dropped here are finished', type: 'check', v: c.done },
    { k: 'wip', label: 'Limit (cards at once, 0 = none)', type: 'number', v: c.wip || 0, min: 0, max: 99 },
  ], check: x => (x.name.trim() ? '' : 'Give the heading a name') });
  if (!v) return false;
  c.name = v.name.trim(); c.color = v.color || ''; c.done = !!v.done; c.wip = Math.max(0, Math.floor(+v.wip || 0)); save(); return true;
}

const KB_ACT = {
  knpick(el) { S.settings.ui.board = el.dataset.id; save(); renderMain(); },
  async knnew(el) {
    if (el && el.dataset && el.dataset.preset !== undefined) { const b = kbNewBoard(S.boards.length ? 'Board ' + (S.boards.length + 1) : 'My board', +el.dataset.preset); S.boards.push(b); S.settings.ui.board = b.id; save(); renderMain(); return; }
    const b = await kbBoardForm(null); if (b) { sfx('add'); renderMain(); }
  },
  async knedit() { const b = kbCurrent(); if (!b) return; const r = await kbBoardForm(b); if (r) { if (r.deleted) S.settings.ui.board = ''; renderMain(); } },
  async kncolmenu(el) {
    const b = kbCurrent(), c = b && kbCol(b, el.dataset.col); if (!c) return; const i = b.cols.indexOf(c);
    const items = [{ label: 'Rename, colour, limit…' }, { label: 'Move left', disabled: i === 0 }, { label: 'Move right', disabled: i === b.cols.length - 1 }, { label: 'Delete heading', danger: true, disabled: b.cols.length < 2 }];
    const r = await askMenu(c.name || 'Heading', items); if (r == null) return;
    if (r === 0) { if (!(await kbColForm(b, c))) return; }
    else if (r === 1 || r === 2) { const j = i + (r === 1 ? -1 : 1); if (j < 0 || j >= b.cols.length) return; b.cols.splice(j, 0, b.cols.splice(i, 1)[0]); save(); }
    else if (r === 3) {
      if (b.cols.length < 2) { toast('A board needs at least one heading'); return; }
      const n = kbColumns(b).get(c.id).length;
      for (const t of S.tasks) if (t.kb && t.kb[b.id] === c.id) { t.kb = { ...t.kb }; delete t.kb[b.id]; }
      b.cols.splice(i, 1); save(); toast(n ? `Deleted “${c.name}”. Its ${n} card${n === 1 ? '' : 's'} moved to “${(b.cols.find(x => !x.done) || b.cols[0]).name}”` : `Deleted “${c.name}”`);
    }
    renderMain(); renderSide();
  },
  async knmove(el) {
    const b = kbCurrent(), t = getT(el.dataset.id); if (!b || !t) return;
    const cur = kbColOf(b, t), r = await askMenu('Move to', b.cols.map(c => ({ label: c.name + (cur && cur.id === c.id ? ' ✓' : ''), color: c.color || b.color })));
    if (r == null) return; kbMove(b, t, b.cols[r].id, null); sfx('sched'); renderMain(); renderSide();
  },
};
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || el.dataset.kns === undefined || U.page !== 'kanban') return;
  const b = kbCurrent(); if (!b) return; b.scope = el.value; save(); renderMain();
});
document.addEventListener('keydown', e => {
  if (U.page !== 'kanban' || !e.target || !e.target.closest) return;
  const b = kbCurrent(); if (!b) return;
  if (e.target.classList.contains('knadd') && e.key === 'Enter') {
    e.preventDefault(); const v = e.target.value.trim(); if (!v) return;
    const col = e.target.dataset.col, t = kbAddTask(b, col, v); if (!t) return; sfx('add'); renderMain(); renderSide();
    const inp = $(`#main .knadd[data-col="${col}"]`); if (inp) inp.focus(); return;
  }
  if (e.target.classList.contains('knnew') && e.key === 'Enter') {
    e.preventDefault(); const v = e.target.value.trim(); if (!v) return;
    b.cols.push({ id: uid(), name: v.slice(0, 60), color: '', done: false, wip: 0 }); save(); renderMain();
    const inp = $('#main .knnew'); if (inp) { inp.focus(); inp.scrollIntoView && inp.scrollIntoView({ inline: 'end', block: 'nearest' }); } return;
  }
  // Alt + arrows move the focused card: left / right between headings, up / down within one
  const card = e.target.closest('#main .kncard[data-id]');
  if (card && e.altKey && /^Arrow/.test(e.key) && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
    const t = getT(card.dataset.id); if (!t) return; e.preventDefault();
    let moved = false;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') moved = kbMoveStep(b, t, e.key === 'ArrowLeft' ? -1 : 1);
    else { const c = kbColOf(b, t), l = c ? kbColumns(b).get(c.id) : [], i = l.findIndex(x => x.id === t.id), j = i + (e.key === 'ArrowUp' ? -1 : 1); if (i >= 0 && j >= 0 && j < l.length) { const ref = e.key === 'ArrowUp' ? l[j].id : (l[j + 1] ? l[j + 1].id : null); moved = kbMove(b, t, c.id, ref); } }
    if (moved) { sfx('sched'); const c = kbColOf(b, t); toast(`Moved “${t.title.slice(0, 40)}” to “${c ? c.name : ''}”`); renderMain(); renderSide(); const r = $(`#main .kncard[data-id="${t.id}"]`); if (r) r.focus(); }
  }
});

/* ---------- dragging: mouse / pen at once, touch after a half-second press (so the board can still scroll), same end point ---------- */
const KB_DRAG = { s: null };
function kbDragStart(card, e) {
  const s = KB_DRAG.s; if (!s || s.on) return; s.on = true; U.kbDrag = true;
  const r = card.getBoundingClientRect(), g = card.cloneNode(true);
  g.className += ' knghost'; g.removeAttribute('data-act'); g.style.width = r.width + 'px'; g.style.left = '0'; g.style.top = '0';
  s.dx = s.x - r.left; s.dy = s.y - r.top; document.body.appendChild(g); s.ghost = g; card.classList.add('dragging');
  s.ind = document.createElement('div'); s.ind.className = 'knind'; if (navigator.vibrate && s.type === 'touch') { try { navigator.vibrate(12); } catch (x) { /* no buzz */ } }
  kbDragMove(e);
}
function kbDragMove(e) {
  const s = KB_DRAG.s; if (!s || !s.on) return;
  s.ghost.style.transform = `translate(${e.clientX - s.dx}px,${e.clientY - s.dy}px) rotate(2deg)`;
  const kn = $('#main .kn'); if (!kn) return;
  const kr = kn.getBoundingClientRect(); // the board scrolls by itself near its sides
  if (e.clientX > kr.right - 50) kn.scrollLeft += 16; else if (e.clientX < kr.left + 50) kn.scrollLeft -= 16;
  const el = document.elementFromPoint(e.clientX, e.clientY), col = el && el.closest ? el.closest('#main .knc[data-col]') : null;
  $$('#main .knc.over').forEach(x => x.classList.remove('over'));
  if (!col) { s.ind.remove(); s.target = null; return; }
  col.classList.add('over');
  const body = $('.knb', col), cards = $$('.kncard:not(.dragging)', body), pr = body.getBoundingClientRect();
  if (e.clientY > pr.bottom - 36) body.scrollTop += 12; else if (e.clientY < pr.top + 36) body.scrollTop -= 12;
  let before = null; for (const c of cards) { const r = c.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { before = c; break; } }
  const em = $('.knempty', body); if (em) em.remove();
  if (before) body.insertBefore(s.ind, before); else body.appendChild(s.ind);
  s.target = { col: col.dataset.col, before: before ? before.dataset.id : null };
}
function kbDragEnd(e, drop) {
  const s = KB_DRAG.s; KB_DRAG.s = null; if (!s) return;
  clearTimeout(s.timer); U.kbDrag = false;
  if (!s.on) return;
  U.suppress = Date.now(); // the click that ends the drag must not open the card
  if (s.ghost) s.ghost.remove(); if (s.ind) s.ind.remove();
  $$('#main .knc.over').forEach(x => x.classList.remove('over')); $$('#main .kncard.dragging').forEach(x => x.classList.remove('dragging'));
  const b = kbCurrent(), t = getT(s.id);
  if (drop && s.target && b && t) { kbMove(b, t, s.target.col, s.target.before); sfx('sched'); }
  renderMain(); renderSide();
}
document.addEventListener('pointerdown', e => {
  if (U.page !== 'kanban' || e.button > 0 || !e.target.closest || $('#modal.on')) return;
  const card = e.target.closest('#main .kncard[data-id]'); if (!card || e.target.closest('button,input,select,textarea,a')) return;
  const s = KB_DRAG.s = { id: card.dataset.id, x: e.clientX, y: e.clientY, type: e.pointerType || 'mouse', on: false, card };
  if (s.type === 'touch') s.timer = setTimeout(() => { if (KB_DRAG.s === s) kbDragStart(card, { clientX: s.x, clientY: s.y }); }, 480);
});
document.addEventListener('pointermove', e => {
  const s = KB_DRAG.s; if (!s) return;
  if (!s.on) {
    const far = Math.hypot(e.clientX - s.x, e.clientY - s.y) > (s.type === 'touch' ? 10 : 6);
    if (s.type === 'touch') { if (far) { clearTimeout(s.timer); KB_DRAG.s = null; } return; } // a finger that moves before the press counts is a scroll
    if (far) kbDragStart(s.card, e); else return;
  }
  e.preventDefault(); kbDragMove(e);
});
document.addEventListener('pointerup', e => kbDragEnd(e, true));
document.addEventListener('pointercancel', e => kbDragEnd(e, false));
document.addEventListener('touchmove', e => { if (KB_DRAG.s && KB_DRAG.s.on && e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && KB_DRAG.s && KB_DRAG.s.on) kbDragEnd(e, false); });
document.addEventListener('contextmenu', e => { if (KB_DRAG.s && KB_DRAG.s.type === 'touch') e.preventDefault(); }, true);
