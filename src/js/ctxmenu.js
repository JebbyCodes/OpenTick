/* OpenTick context menus: right-click (or the menu key / Shift+F10) on a task, list, project, tag, note, template, calendar day or timetable
   block opens the same choices as that thing's "⋯" button. Only where there is a mouse: phones and tablets keep long-press as it was.
   Inputs, text areas, links and Shift + right-click keep the browser's own menu (copy, paste, spelling).
   ctxItems(target) -> [{ label, run, danger, icon, keys } | { sep: true }] or null; ctxOpen(x, y, items) draws it. */
let CTX = null; // the open menu: { el, items, i }
const ctxTouch = () => SK_PHONE || (typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches);
function ctxClose() { if (CTX && CTX.el) CTX.el.remove(); CTX = null; }
function ctxOpen(x, y, items) {
  ctxClose(); const real = items.filter(i => !i.sep); if (!real.length) return;
  const el = document.createElement('div'); el.className = 'ctx'; el.setAttribute('role', 'menu');
  el.innerHTML = items.map((it, n) => it.sep ? '<div class="ctx-sep" role="separator"></div>' : `<button class="ctx-i${it.danger ? ' danger' : ''}" role="menuitem" data-n="${n}">${it.icon ? ic(it.icon, 15) : '<span class="ctx-ic"></span>'}<span>${esc(it.label)}</span>${it.keys && skHints() ? skKbd(it.keys) : ''}</button>`).join('');
  document.body.appendChild(el); CTX = { el, items, i: -1 };
  const w = el.offsetWidth || 220, h = el.offsetHeight || 200, vw = window.innerWidth, vh = window.innerHeight;
  el.style.left = Math.max(6, Math.min(x, vw - w - 6)) + 'px'; el.style.top = Math.max(6, Math.min(y, vh - h - 6)) + 'px';
  const f = $('.ctx-i', el); if (f) { f.focus(); CTX.i = 0; }
}
function ctxStep(d) {
  if (!CTX) return; const bs = $$('.ctx-i', CTX.el); if (!bs.length) return;
  CTX.i = (CTX.i + d + bs.length) % bs.length; bs[CTX.i].focus();
}
const ctxRun = n => { const it = CTX && CTX.items[n]; if (!it || it.sep) return; ctxClose(); try { it.run(); } catch (e) { toast('That did not work: ' + (e.message || e)); } };

const ctxPrio = (id, p) => ({ label: ['No priority', 'Low priority', 'Medium priority', 'High priority'][p], icon: 'flag', run: () => { const t = getT(id); if (t) { t.priority = p; save(); refresh(); } } });
function ctxTask(id) {
  const t = getT(id); if (!t) return null; const open = t.status === 'open';
  return [
    { label: 'Open', icon: 'eye', run: () => { U.sel = id; renderDetail(); $$('#main .task.sel').forEach(x => x.classList.remove('sel')); const r = $(`#main [data-id="${id}"]`); if (r) r.classList.add('sel'); } },
    { label: open ? 'Complete' : 'Reopen', icon: 'check-circle', keys: 'x', run: () => { toggleDone(t); save(); refresh(); } },
    { sep: true },
    { label: 'Due today', icon: 'calendar', run: () => { t.due = todayStr(); save(); refresh(); } },
    { label: 'Due tomorrow', icon: 'calendar', run: () => { t.due = ymd(addDays(new Date(), 1)); save(); refresh(); } },
    ...(t.due ? [{ label: 'No due date', icon: 'x', run: () => { t.due = null; t.time = null; t.repeat = null; delete t.until; delete t.exc; save(); refresh(); } }] : []),
    { sep: true }, ctxPrio(id, 3), ctxPrio(id, 2), ctxPrio(id, 1), ctxPrio(id, 0),
    { sep: true },
    { label: 'Move to a list…', icon: 'list', run: async () => { const ls = S.lists; const i = await askMenu('Move to', ls.map(l => ({ label: listLabel(l.id), color: l.color }))); if (i != null) { t.listId = ls[i].id; t.section = null; save(); refresh(); toast('Moved to “' + ls[i].name + '”'); } } },
    { label: 'Duplicate', icon: 'copy', run: () => { U.sel = id; ACT.dup(); } },
    { label: 'Copy the title', icon: 'copy', run: () => tplCopy(t.title) },
    { sep: true },
    { label: 'Move to bin', icon: 'trash', danger: true, keys: 'Delete', run: () => { U.sel = id; ACT.del(); } },
  ];
}
function ctxItems(target) {
  const g = sel => target.closest(sel);
  let el;
  if ((el = g('.task[data-id]:not(.virt),.card[data-id],.blk.tk[data-id],.chip[data-act=open][data-id],.tri[data-id],.bl[data-id]'))) { return ctxTask(el.dataset.id); }
  if ((el = g('.virt[data-id]'))) return ctxTask(el.dataset.id);
  if ((el = g('.navrow[data-lid]'))) {
    const id = el.dataset.lid; if (id === 'inbox') return null;
    return [{ label: 'Open', icon: 'list', run: () => setNav('list:' + id) }, { label: 'Edit list (name, icon, colour, parent)…', icon: 'sliders', run: () => ACT.listmenu({ dataset: { lid: id, pick: 0 } }) }, { label: 'Add a sublist…', icon: 'plus', run: () => ACT.listmenu({ dataset: { lid: id, pick: 1 } }) }, { label: 'Banner…', icon: 'image', run: () => ACT.listmenu({ dataset: { lid: id, pick: 2 } }) }, { sep: true }, { label: 'Delete list', icon: 'trash', danger: true, run: () => ACT.listmenu({ dataset: { lid: id, pick: 3 } }) }];
  }
  if ((el = g('.navrow.proj'))) { const b = el.querySelector('[data-nav^="project:"]'); const id = b ? b.dataset.nav.slice(8) : ''; if (id) return [{ label: 'Open', icon: 'layers', run: () => setNav('project:' + id) }, { label: 'Edit project…', icon: 'sliders', run: () => ACT.projmenu({ dataset: { pid: id } }) }, { label: 'Banner…', icon: 'image', run: () => openBannerDialog('project', id) }]; }
  if ((el = g('[data-act=nav][data-nav^="tag:"]'))) { const tag = el.dataset.nav.slice(4); return [{ label: 'Show this tag', icon: 'tag', run: () => setNav('tag:' + tag) }, { label: 'Colour and name…', icon: 'sliders', run: () => tagMenu(tag) }]; }
  if ((el = g('.pages .pg[data-page]'))) { const pg = el.dataset.page; return [{ label: 'Open', icon: 'eye', run: () => ACT.page({ dataset: { page: pg } }) }, { label: 'Hide this view', icon: 'x', run: () => { const h = S.settings.ui.hidePages; if (!h.includes(pg)) h.push(pg); save(); if (U.page === pg) { U.page = 'tasks'; } render(); toast('Hidden. Settings → Layout brings it back.'); } }]; }
  if ((el = g('.nti[data-id]'))) {
    const id = el.dataset.id, n = noteById(id); if (!n) return null;
    const pick = k => () => { U.noteSel = id; renderMain(); NOTE_ACT.notemenu({ dataset: { pickk: k } }); };
    return [{ label: 'Open', icon: 'eye', run: () => { U.noteSel = id; renderMain(); } }, { label: n.pinned ? 'Unpin from the top' : 'Pin to the top', icon: 'star', run: () => { n.pinned = !n.pinned; save(); renderMain(); } }, { sep: true }, { label: 'Copy as Markdown', icon: 'copy', run: pick('copy') }, { label: 'Export as Markdown file…', icon: 'download', run: pick('export') }, { label: 'Duplicate', icon: 'copy', run: pick('dup') }, { sep: true }, { label: 'Delete', icon: 'trash', danger: true, run: pick('del') }];
  }
  if ((el = g('.tplc[data-id]'))) {
    const id = el.dataset.id, t = tplById(id); if (!t) return null;
    return [{ label: 'Use', icon: 'sparkles', run: () => tplFill(id) }, { label: 'Edit', icon: 'sliders', run: () => TPL_ACT.tplopen({ dataset: { id } }) }, { label: t.pinned ? 'Unpin' : 'Pin to the top', icon: 'star', run: () => TPL_ACT.tplpin({ dataset: { id } }) }, { label: 'Duplicate', icon: 'copy', run: () => TPL_ACT.tpldup({ dataset: { id } }) }, { sep: true }, { label: 'Delete', icon: 'trash', danger: true, run: () => TPL_ACT.tpldel({ dataset: { id } }) }];
  }
  if ((el = g('.blk[data-act=ttslot]'))) { const id = el.dataset.sid; return [{ label: 'Edit slot', icon: 'sliders', run: () => ACT.ttslot({ dataset: { sid: id } }) }]; }
  if ((el = g('.blk.lsn[data-lid],.sc-c.has[data-lid],.sc-ag.lsn[data-lid]'))) { const lid = el.dataset.lid, date = el.dataset.date; return [{ label: 'Open this lesson', icon: 'eye', run: () => SC_ACT.sclesson({ dataset: { lid, date } }) }, { label: 'Edit the lesson…', icon: 'sliders', run: () => SC_ACT.scedit({ dataset: { id: lid } }) }]; }
  if ((el = g('.day[data-d],.wk-col[data-d]'))) { const d = el.dataset.d, ho = holOn(d); return [{ label: 'Add a task on ' + fmtDate(d), icon: 'plus', run: () => ACT.calday({ dataset: { d } }) }, { label: 'Open this day', icon: 'calendar', run: () => ACT.calgo({ dataset: { d } }) }, { sep: true }, { label: ho ? 'Edit holidays…' : 'Add a holiday…', icon: 'sun', run: () => (ho ? scOffDlg(ho, holDlg) : scOffDlg(null, holDlg, { from: d })) }]; }
  if ((el = g('.tt-col[data-d]'))) { const d = el.dataset.d; return [{ label: 'Add to the timetable…', icon: 'plus', run: () => ACT.ttadd() }, { label: 'Holidays…', icon: 'sun', run: () => holDlg() }]; }
  return null;
}
document.addEventListener('contextmenu', e => {
  if (ctxTouch() || e.shiftKey || !e.target || !e.target.closest) return;
  if (e.target.closest('input,textarea,select,[contenteditable=true],a[href],.ctx,#modal')) return;
  let items = null; try { items = ctxItems(e.target); } catch (x) { items = null; }
  if (!items) return; e.preventDefault(); ctxOpen(e.clientX, e.clientY, items);
});
// the keyboard's menu key / Shift+F10 opens it for the focused row
document.addEventListener('keydown', e => {
  if (CTX) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ctxClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); ctxStep(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); ctxStep(-1); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); CTX.i = e.key === 'Home' ? -1 : 0; ctxStep(e.key === 'Home' ? 1 : -1); }
    else if (e.key === 'Tab') ctxClose();
    return;
  }
  if ((e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) && !ctxTouch() && !skTyping(e)) {
    const f = document.activeElement || e.target, items = f && f.closest ? ctxItems(f) : null; if (!items) return;
    e.preventDefault(); const r = f.getBoundingClientRect(); ctxOpen(r.left + 24, r.top + Math.min(r.height, 40), items);
  }
}, true);
document.addEventListener('mousedown', e => { if (CTX && !(e.target.closest && e.target.closest('.ctx'))) ctxClose(); }, true);
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.ctx-i'); if (b && CTX) { e.preventDefault(); ctxRun(+b.dataset.n); } else if (CTX) ctxClose(); }, true);
window.addEventListener('blur', ctxClose); window.addEventListener('resize', ctxClose); window.addEventListener('scroll', ctxClose, true);
