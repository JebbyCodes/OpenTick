/* OpenTick printing (0.9): print what you are looking at, on paper that looks like paper.

   • Notes and task lists are printed from a clean document built just for the page (#printroot): the note's own text (or all the
     notes in this view, one per page), or the list as a checklist with boxes to tick. Options (notes, subtasks, completed) come from
     the small Print dialog.
   • The grids (calendar, timetable, boards, matrix, habits, countdowns, statistics, the timeline's table) are printed as they are on
     screen: the menus, side panels and buttons are hidden and the scroll boxes are opened up (CSS, body.printing).
   • Everything is done by the print events (beforeprint / afterprint), so the button and the browser's own Ctrl+P give the same page.
   • Nothing here changes any data. The timeline keeps its own Print (it paginates a picture of the chart); the help guide too. */

const PR_DOC = new Set(['tasks', 'notes']); // printed as a document built here
const PR_LIVE = { calendar: 'landscape', timetable: 'landscape', kanban: 'landscape', matrix: 'landscape', habits: 'landscape', countdowns: 'portrait', stats: 'portrait' }; // printed as shown, and on which paper
const prCan = () => typeof window !== 'undefined' && typeof window.print === 'function' && !(typeof isAndroidApp === 'function' && isAndroidApp()) && !(typeof isIosApp === 'function' && isIosApp());
const prPageKind = () => (PR_DOC.has(U.page) ? 'doc' : U.page in PR_LIVE ? 'live' : '');
const prOpts = () => (U.pr = { notes: true, subs: true, done: false, scope: 'this', meta: true, ...(U.pr || {}) });

function prTool() { // the button in a page's header
  if (!prCan() || !prPageKind()) return '';
  return `<button class="ib" data-act="print" title="Print this page…  (Ctrl+P)" aria-label="Print this page">${ic('printer')}</button>`;
}

/* ---------- the document pages ---------- */
const prDate = () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
function prSubs(t, o) { return o.subs && t.subtasks && t.subtasks.length ? `<ul class="pr-subs">${t.subtasks.map(s => `<li class="${s.done ? 'dn' : ''}"><span class="pr-box${s.done ? ' on' : ''}"></span>${esc(s.title)}</li>`).join('')}</ul>` : ''; }
function prTaskHtml(t, o, showList) {
  const meta = [dueLabel(t), t.repeat ? '↻ ' + repeatLabel(t.repeat) : '', t.priority ? ['', 'Low priority', 'Medium priority', 'High priority'][t.priority] : '', t.tags.map(g => '#' + g).join(' '), showList && t.listId !== 'inbox' ? listLabel(t.listId) : '', t.status === 'wontdo' ? 'Won’t do' : ''].filter(Boolean);
  const notes = o.notes && t.notes && t.notes.trim() ? `<div class="pr-tn md">${md(t.notes)}</div>` : '';
  return `<div class="pr-t${t.status === 'done' ? ' dn' : ''} p${t.priority || 0}"><span class="pr-box${t.status === 'done' ? ' on' : ''}"></span><div class="pr-tb"><div class="pr-tt">${esc(t.title)}</div>${meta.length ? `<div class="pr-tm">${meta.map(esc).join(' · ')}</div>` : ''}${notes}${prSubs(t, o)}</div></div>`;
}
function prTasksHtml(o) {
  const eff = U.q ? 'search' : U.nav, all = tagFiltered(scopeTasks(eff)), isList = eff.startsWith('list:'), isProj = eff.startsWith('project:');
  const open = sortTasks(all.filter(t => t.status === 'open')), fin = all.filter(t => t.status !== 'open');
  const groups = []; // [heading, tasks]
  if (isList || isProj) { // by section (a list) or by list (a project); the section order is the list's own
    const key = t => (isList ? t.section || '' : t.listId), order = isList ? ['', ...(listOf(eff.slice(5)).sections || [])] : ['inbox', ...S.lists.map(l => l.id)];
    const by = new Map(); for (const t of open) { const k = key(t); if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
    for (const k of [...order, ...by.keys()]) if (by.has(k)) { groups.push([isList ? k : listLabel(k), by.get(k)]); by.delete(k); }
  } else groups.push(['', open]);
  const showList = !isList && !isProj;
  const body = groups.map(([h, ts]) => `${h ? `<h2 class="pr-h">${esc(h)}</h2>` : ''}${ts.map(t => prTaskHtml(t, o, showList)).join('')}`).join('') || '<p class="pr-empty">Nothing to do here.</p>';
  const done = o.done && fin.length ? `<h2 class="pr-h">Completed</h2>${fin.map(t => prTaskHtml(t, o, showList)).join('')}` : '';
  return `<header class="pr-top"><h1>${esc(navTitle(eff))}</h1><div class="pr-sub">${open.length} open task${open.length === 1 ? '' : 's'}${U.tagSel.length ? ' · tagged ' + esc(U.tagSel.map(g => '#' + g).join(U.tagMode === 'any' ? ' or ' : ' and ')) : ''} · ${esc(prDate())}</div></header>${body}${done}`;
}
function prNoteHtml(n, o) {
  const h = noteHomeOf(n), home = h.kind ? (h.kind === 'project' ? (projectOf(h.id) || {}).name : listLabel(h.id)) : '';
  const meta = o.meta ? [n.tags.map(g => '#' + g).join(' '), home ? (h.kind === 'project' ? 'Project: ' : 'List: ') + home : '', n.updated ? 'Edited ' + fmtDate(ymd(new Date(n.updated))) : ''].filter(Boolean) : [];
  return `<article class="pr-note"><h1>${noteTitleHtml(n)}</h1>${meta.length ? `<div class="pr-sub">${meta.map(esc).join(' · ')}</div>` : ''}<div class="pr-nb md">${previewHtml(n.body)}</div></article>`;
}
function prNotesHtml(o) {
  const one = o.scope === 'this' && U.noteSel ? noteById(U.noteSel) : null, ns = one ? [one] : noteList().slice(0, 300);
  if (!ns.length) return '<p class="pr-empty">No notes to print.</p>';
  return ns.map(n => prNoteHtml(n, o)).join('');
}
const prDocHtml = o => (U.page === 'notes' ? prNotesHtml(o) : prTasksHtml(o));

/* ---------- getting the page ready, and putting it back ---------- */
let prOn = false;
function prBefore() {
  if (prOn) return; const kind = prPageKind(); if (!kind || typeof document === 'undefined') return;
  prOn = true; const o = prOpts(), b = document.body;
  b.classList.add('printing', 'pr-' + kind, 'pr-p-' + U.page);
  let st = document.getElementById('pr-page'); if (!st) { st = document.createElement('style'); st.id = 'pr-page'; document.head.appendChild(st); }
  st.textContent = `@page{size:${kind === 'live' ? PR_LIVE[U.page] : 'portrait'};margin:${kind === 'live' ? 9 : 16}mm}`; // (no paper size: the printer dialog's own, A4 or Letter, stays)
  if (U.page === 'timetable') { // the time grid is as tall as this screen made it: shrink it to one page (about 720px tall once the title is counted)
    try {
      const main = document.getElementById('main'), sc = main && main.querySelector('.tt-scroll'), inner = main && main.querySelector('.tt-inner');
      if (sc && inner) { const h = main.scrollHeight - sc.clientHeight + inner.offsetHeight + 12, z = Math.max(0.35, Math.min(1, 690 / h)); b.style.setProperty('--pr-zoom', String(z)); b.style.setProperty('--pr-h', Math.round(h) + 'px'); }
    } catch (e) { /* the CSS fallback is used */ }
  }
  if (kind === 'doc') {
    let r = document.getElementById('printroot'); if (!r) { r = document.createElement('div'); r.id = 'printroot'; b.appendChild(r); }
    try { r.innerHTML = prDocHtml(o); } catch (e) { r.innerHTML = '<p class="pr-empty">This page could not be prepared for printing.</p>'; }
  }
}
function prAfter() {
  if (!prOn) return; prOn = false;
  const b = document.body; [...b.classList].filter(c => c === 'printing' || c.startsWith('pr-')).forEach(c => b.classList.remove(c));
  b.style.removeProperty('--pr-zoom'); b.style.removeProperty('--pr-h');
  const r = document.getElementById('printroot'); if (r) r.remove();
  const st = document.getElementById('pr-page'); if (st) st.textContent = '';
}
function prRun() { // the browser's print dialog; the events do the rest. Where they never fire, prepare by hand and clean up after.
  closeModal();
  try {
    setTimeout(() => { try { window.print(); } catch (e) { toast('Printing is not available here.'); } }, 80);
  } catch (e) { toast('Printing is not available here.'); }
}
function prDialog() {
  const o = prOpts(), notes = U.page === 'notes', one = notes && U.noteSel && noteById(U.noteSel);
  const chk = (k, label) => `<label class="pr-opt"><input type="checkbox" data-pr="${k}"${o[k] ? ' checked' : ''}> ${label}</label>`;
  const body = notes
    ? `${one ? `<div class="pr-opt" role="radiogroup" aria-label="What to print"><label><input type="radio" name="pr-scope" data-pr="scope" value="this"${o.scope === 'this' ? ' checked' : ''}> This note</label><label><input type="radio" name="pr-scope" data-pr="scope" value="view"${o.scope === 'view' ? ' checked' : ''}> All ${noteList().length} in this view <small>(one per page)</small></label></div>` : `<p class="hint">Prints the ${noteList().length} note${noteList().length === 1 ? '' : 's'} in this view, one per page.</p>`}${chk('meta', 'Tags, where it is filed and when it was edited')}`
    : `${chk('notes', 'Notes')}${chk('subs', 'Subtasks')}${chk('done', 'Completed tasks')}`;
  openModal(`<h3>${ic('printer', 18)} Print ${esc(notes ? 'notes' : navTitle(U.q ? 'search' : U.nav))}</h3><div class="pr-opts">${body}</div><p class="hint">Opens your browser’s print dialog, where you can also save it as a PDF.</p><div class="mact"><button type="button" data-m="no">Cancel</button><button type="button" class="pri" data-m="ok">${ic('printer', 15)} Print</button></div>`, m => {
    m.onchange = e => { const k = e.target.dataset.pr; if (!k) return; if (k === 'scope') { if (e.target.checked) o.scope = e.target.value; } else o[k] = e.target.checked; };
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; } if (b.dataset.m === 'ok') prRun(); else closeModal(); };
  }, 'pr');
}
const PR_ACT = { print: () => { if (!prCan()) { toast('Printing is not available here.'); return; } if (PR_DOC.has(U.page)) prDialog(); else prRun(); } };
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') { window.addEventListener('beforeprint', prBefore); window.addEventListener('afterprint', prAfter); }
