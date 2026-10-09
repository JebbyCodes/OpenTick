/* OpenTick views: all rendering lives here */
const IC = {
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  sunrise: '<path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/>',
  slash: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  columns: '<path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  'check-square': '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  'cloud-off': '<path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  gantt: '<line x1="3" y1="6" x2="13" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="5" y1="18" x2="15" y2="18"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  'panel-left': '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
  'panel-right': '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>',
  'zoom-in': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>',
  'zoom-out': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  expand: '<polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>',
  collapse: '<polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M3 8V5a2 2 0 0 1 2-2h3m8 0h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3m-8 0H5a2 2 0 0 1-2-2v-3"/>',
};
const ic = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;

const U = { page: 'tasks', nav: 'today', q: '', sel: null, calM: new Date(), showDone: {}, drag: null, _rn: null, ttDate: null, ttTray: null };
const SMART = [['inbox', 'Inbox', 'inbox'], ['today', 'Today', 'sun'], ['tomorrow', 'Tomorrow', 'sunrise'], ['week', 'Next 7 Days', 'calendar'], ['all', 'All', 'layers']];
const PAGES = [['tasks', 'Tasks', 'check-circle'], ['calendar', 'Calendar', 'calendar'], ['timetable', 'Timetable', 'table'], ['gantt', 'Gantt', 'gantt'], ['matrix', 'Matrix', 'grid'], ['habits', 'Habit', 'activity'], ['focus', 'Focus', 'clock']];
const FLAT = ['done', 'trash', 'wontdo', 'search'];
// inline markdown in titles, never as links (rows are click targets)
const FULLDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// a tag is a coloured pill when it has a colour, plain muted text otherwise
const tagChip = g => { const c = tagColor(g); return `<span class="tag"${c ? ` style="--tc:${c}"` : ''}>#${esc(g)}</span>`; };
// duration + timetable-slot badges shown in a task's meta line
function metaX(t) {
  const sl = t.slotId && slotById(t.slotId);
  return (t.dur ? `<span title="Duration">${ic('clock', 12)} ${fmtDur(t.dur)}</span>` : '') + (sl ? `<span class="slb" style="--tc:${sl.color}" title="Timetable slot">${ic('table', 12)} ${esc(sl.title)}</span>` : '');
}
const titleHtml = t => (t.title && t.title.trim() ? mdInline(t.title, true) : '<i>Untitled</i>');
function noteBadge(t) {
  if (!t.notes || !t.notes.trim()) return '';
  const s = mdStats(t.notes);
  return s.total ? `<span title="Checklist in notes">${ic('check-square', 12)} ${s.done}/${s.total}</span>` : `<span title="Has notes">${ic('file-text', 12)}</span>`;
}
const NOTE_FMT = [['bold', '<span class="f-b">B</span>', 'Bold (Ctrl+B)'], ['italic', '<span class="f-i">I</span>', 'Italic (Ctrl+I)'], ['strike', '<span class="f-s">S</span>', 'Strikethrough'], ['code', '&lt;/&gt;', 'Code'], ['link', 'Link', 'Link (Ctrl+K)'], ['h', 'H', 'Heading'], ['ul', '•', 'Bulleted list'], ['task', '☑', 'Checklist'], ['quote', '❝', 'Quote']];
const opts = (arr, cur) => arr.map(([v, n]) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(n)}</option>`).join('');

/* ---------- data scoping ---------- */
function scopeTasks(nav) {
  const td = todayStr(), tm = ymd(addDays(new Date(), 1)), wk = ymd(addDays(new Date(), 6));
  if (nav === 'trash') return S.tasks.filter(t => t.deleted);
  let r = S.tasks.filter(t => !t.deleted);
  if (nav === 'done') return r.filter(t => t.status === 'done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  if (nav === 'wontdo') return r.filter(t => t.status === 'wontdo');
  if (nav === 'search') { const q = U.q.toLowerCase(); return r.filter(t => t.status !== 'wontdo' && (t.title + ' ' + t.notes + ' ' + t.tags.join(' ')).toLowerCase().includes(q)); }
  r = r.filter(t => t.status !== 'wontdo');
  if (nav === 'inbox') return r.filter(t => t.listId === 'inbox');
  if (nav === 'today') return r.filter(t => t.due && (t.status === 'open' ? t.due <= td : t.due === td));
  if (nav === 'tomorrow') return r.filter(t => t.due === tm);
  if (nav === 'week') return r.filter(t => t.due && t.due >= td && t.due <= wk);
  if (nav.startsWith('list:')) return r.filter(t => t.listId === nav.slice(5));
  if (nav.startsWith('tag:')) return r.filter(t => t.tags.includes(nav.slice(4)));
  return r;
}
const openCount = nav => scopeTasks(nav).filter(t => t.status === 'open').length;
const allTags = () => [...new Set(S.tasks.filter(t => !t.deleted).flatMap(t => t.tags))].sort();
function navTitle(nav) {
  const s = SMART.find(x => x[0] === nav);
  if (s) return s[1];
  if (nav === 'done') return 'Completed';
  if (nav === 'wontdo') return "Won't Do";
  if (nav === 'trash') return 'Trash';
  if (nav === 'search') return 'Search';
  if (nav.startsWith('list:')) return listOf(nav.slice(5)).name;
  if (nav.startsWith('tag:')) return '#' + nav.slice(4);
  return 'Tasks';
}
const dueKey = t => (t.due ? t.due + ' ' + (t.time || '00:00') : '9999');
function sortTasks(a) {
  const m = S.settings.sort;
  const cmp = {
    manual: (x, y) => (x.order || 0) - (y.order || 0),
    due: (x, y) => dueKey(x).localeCompare(dueKey(y)) || y.priority - x.priority,
    priority: (x, y) => y.priority - x.priority || dueKey(x).localeCompare(dueKey(y)),
    title: (x, y) => x.title.localeCompare(y.title),
    created: (x, y) => y.created - x.created,
  }[m] || ((x, y) => 0);
  return [...a].sort(cmp);
}
function groupTasks(a) {
  const g = S.settings.group, td = todayStr();
  if (g === 'none') return [{ title: '', tasks: a }];
  const m = new Map();
  const order = g === 'date' ? ['Overdue', 'Today', 'Tomorrow', 'Next 7 Days', 'Later', 'No Date'] : g === 'priority' ? ['High', 'Medium', 'Low', 'None'] : S.lists.map(l => l.name);
  for (const t of a) {
    let k;
    if (g === 'date') {
      if (!t.due) k = 'No Date'; else if (isOverdue(t)) k = 'Overdue';
      else { const d = dayDiff(t.due, td); k = d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : d < 7 ? 'Next 7 Days' : 'Later'; }
    } else if (g === 'priority') k = ['None', 'Low', 'Medium', 'High'][t.priority];
    else k = listOf(t.listId).name;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  }
  return order.filter(k => m.has(k)).map(k => ({ title: esc(k), tasks: m.get(k) }));
}
const canDrag = () => S.settings.sort === 'manual' && S.settings.group === 'none' && U.page === 'tasks' && !U.q && !FLAT.includes(U.nav);

/* ---------- shell ---------- */
const topHtml = (title, tools = '') => `<header class="top"><button class="ib burger" data-act="burger" aria-label="Menu">${ic('menu', 22)}</button><button class="ib pt pt-side" data-act="uitoggle" data-k="side" title="Show / hide sidebar  [" aria-label="Show or hide the sidebar">${ic('panel-left', 20)}</button><h1>${title}</h1><div class="tools">${tools}</div><button class="ib pt pt-det" data-act="uitoggle" data-k="detail" title="Show / hide task details  ]" aria-label="Show or hide the task details">${ic('panel-right', 20)}</button></header>`;
function render() { renderSide(); renderMain(); renderDetail(); }
function renderMain() { ({ tasks: renderTasks, calendar: renderCal, timetable: renderTimetable, gantt: renderGantt, matrix: renderMatrix, habits: renderHabits, focus: renderFocus })[U.page](); }

function renderSide() {
  const q = $('#q'), keep = q ? q.value : '';
  const on = k => U.page === 'tasks' && U.nav === k && !U.q ? ' on' : '';
  const item = (key, label, icon, color, count, extra = '') => `<button class="nav${on(key)}" data-act="nav" data-nav="${esc(key)}"${extra}><span class="ni"${color ? ` style="color:${color}"` : ''}>${ic(icon, 18)}</span><span class="nl">${esc(label)}</span>${count ? `<span class="cnt">${count}</span>` : ''}</button>`;
  const sec = (k, title, add = '') => `<div class="sec"><button class="sech" data-act="fold" data-k="${k}" aria-expanded="${!folded(k)}">${ic(folded(k) ? 'right' : 'down', 14)}<span>${title}</span></button>${add}</div>`;
  const tags = allTags(), lists = S.lists.filter(l => l.id !== 'inbox');
  $('#side').innerHTML = `
<div class="brand"><span class="logo">${ic('check', 16)}</span><b>OpenTick</b>${syncBadge()}<button class="ib" data-act="uitoggle" data-k="side" title="${S.settings.ui.side ? 'Hide sidebar' : 'Dock sidebar'}">${ic('panel-left', 18)}</button><button class="ib" data-act="settings" title="Settings">${ic('sliders', 18)}</button></div>
<div class="search">${ic('search', 16)}<input id="q" placeholder="Search" autocomplete="off"></div>
<div class="pages">${pagesShown().map(([k, n, i]) => `<button class="pg${U.page === k ? ' on' : ''}" data-act="page" data-page="${k}" title="${n} — drag to reorder" draggable="true">${ic(i, 20)}<small>${n}</small></button>`).join('')}</div>
<div class="scroll">
${SMART.map(([k, n, i]) => item(k, n, i, null, openCount(k))).join('')}
${sec('lists', 'Lists', `<button class="ib sm" data-act="addlist" title="New list">${ic('plus', 14)}</button>`)}
${folded('lists') ? '' : lists.map(l => item('list:' + l.id, l.name, 'list', l.color, openCount('list:' + l.id), ` draggable="true" data-lid="${esc(l.id)}"`)).join('')}
${tags.length ? sec('tags', 'Tags') + (folded('tags') ? '' : tags.map(g => item('tag:' + g, g, 'tag', tagColor(g), openCount('tag:' + g))).join('')) : ''}
${sec('more', 'More')}
${folded('more') ? '' : item('done', 'Completed', 'check-circle') + item('wontdo', "Won't Do", 'slash') + item('trash', 'Trash', 'trash')}
</div>`;
  const nq = $('#q'); if (nq) nq.value = keep || U.q;
}

/* ---------- tasks page ---------- */
function rowHtml(t, showList) {
  const l = listOf(t.listId), done = t.subtasks.filter(s => s.done).length, fin = t.status !== 'open';
  return `<div class="task${fin ? ' fin' : ''}${U.sel === t.id ? ' sel' : ''}" data-act="open" data-id="${t.id}"${canDrag() ? ' draggable="true"' : ''}>
<button class="chk p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 13) : t.status === 'wontdo' ? ic('slash', 13) : ''}</button>
<div class="tb"><div class="ttl">${titleHtml(t)}</div><div class="meta">${t.due ? `<span class="due${isOverdue(t) ? ' late' : ''}">${esc(dueLabel(t))}</span>` : ''}${t.repeat ? ic('repeat', 12) : ''}${metaX(t)}${t.reminder != null ? ic('bell', 12) : ''}${noteBadge(t)}${t.subtasks.length ? `<span>${ic('list', 12)} ${done}/${t.subtasks.length}</span>` : ''}${t.tags.map(tagChip).join('')}</div></div>
${showList ? `<span class="ln"><i style="background:${l.color}"></i>${esc(l.name)}</span>` : ''}</div>`;
}
function cardHtml(t) {
  return `<div class="card p${t.priority}${U.sel === t.id ? ' sel' : ''}" draggable="true" data-act="open" data-id="${t.id}"><div class="ttl">${titleHtml(t)}</div><div class="meta">${t.due ? `<span class="due${isOverdue(t) ? ' late' : ''}">${esc(dueLabel(t))}</span>` : ''}${noteBadge(t)}${t.tags.map(tagChip).join('')}</div></div>`;
}
function renderKanban(list, open) {
  const sec = t => (list.sections.includes(t.section) ? t.section : '');
  const cols = [{ id: '', name: 'Not Sectioned' }, ...list.sections.map(s => ({ id: s, name: s }))];
  return `<div class="kan">${cols.map(c => {
    const ts = sortTasks(open.filter(t => sec(t) === c.id));
    return `<div class="col" data-sec="${esc(c.id)}"><div class="chead"><b>${esc(c.name)}</b><span>${ts.length}</span>${c.id ? `<button class="ib sm" data-act="secdel" data-sec="${esc(c.id)}" title="Delete section">${ic('x', 14)}</button>` : ''}</div><div class="cbody">${ts.map(cardHtml).join('')}</div><input class="kadd" data-sec="${esc(c.id)}" placeholder="+ Add task" autocomplete="off"></div>`;
  }).join('')}<button class="col addcol" data-act="secadd">${ic('plus', 16)} Add section</button></div>`;
}
function renderTasks() {
  const draft = U._rn === U.nav && $('#add') ? $('#add').value : ''; U._rn = U.nav;
  const eff = U.q ? 'search' : U.nav, isList = eff.startsWith('list:'), list = isList ? listOf(eff.slice(5)) : null;
  const all = scopeTasks(eff), flat = FLAT.includes(eff);
  const open = all.filter(t => t.status === 'open'), fin = all.filter(t => t.status !== 'open');
  const kan = isList && list.view === 'kanban';
  let tools = '';
  if (isList) tools += `<button class="ib${OG.links[list.id] ? ' on' : ''}" data-act="ogopen" data-list="${esc(list.id)}" title="OpenGantt: link, import or export">${ic('link')}</button>`;
  if (isList) tools += `<button class="ib${!kan ? ' on' : ''}" data-act="view" data-v="list" title="List view">${ic('list')}</button><button class="ib${kan ? ' on' : ''}" data-act="view" data-v="kanban" title="Board view">${ic('columns')}</button>`;
  if (!flat && !kan) tools += `<select data-sel="group" title="Group by">${opts([['none', 'No grouping'], ['date', 'Group: date'], ['priority', 'Group: priority'], ['list', 'Group: list']], S.settings.group)}</select><select data-sel="sort" title="Sort by">${opts([['manual', 'Sort: manual'], ['due', 'Sort: due date'], ['priority', 'Sort: priority'], ['title', 'Sort: title'], ['created', 'Sort: newest']], S.settings.sort)}</select>`;
  if (isList && list.id !== 'inbox') tools += `<button class="ib" data-act="listmenu" title="List options">${ic('more')}</button>`;
  if (eff.startsWith('tag:')) tools += `<button class="ib" data-act="tagmenu" data-tag="${esc(eff.slice(4))}" title="Tag colour & name">${ic('more')}</button>`;
  if (eff === 'trash' && all.length) tools += `<button class="btn" data-act="emptytrash">Empty trash</button>`;
  if (eff === 'done' && all.length) tools += `<button class="btn" data-act="cleardone">Clear</button>`;
  let body;
  if (!all.length) body = `<div class="empty">${ic('check-circle', 44)}<p>${eff === 'search' ? 'No matches' : eff === 'trash' ? 'Trash is empty' : 'Nothing here yet'}</p></div>`;
  else if (kan) body = renderKanban(list, open);
  else if (flat) body = all.map(t => rowHtml(t, true)).join('');
  else {
    body = groupTasks(sortTasks(open)).map(g => (g.title ? `<div class="grp">${g.title}<span>${g.tasks.length}</span></div>` : '') + g.tasks.map(t => rowHtml(t, !isList)).join('')).join('');
    if (fin.length) body += `<button class="grp tog" data-act="showdone">${ic(U.showDone[eff] ? 'down' : 'right', 14)} Completed<span>${fin.length}</span></button>` + (U.showDone[eff] ? fin.map(t => rowHtml(t, !isList)).join('') : '');
  }
  const tgt = isList ? list.name : 'Inbox';
  $('#main').innerHTML = topHtml(U.q ? `Search “${esc(U.q)}”` : (eff.startsWith('tag:') && tagColor(eff.slice(4)) ? `<span style="color:${tagColor(eff.slice(4))}">${esc(navTitle(eff))}</span>` : esc(navTitle(eff))), tools)
    + (flat || kan ? '' : `<div class="quick"><input id="add" autocomplete="off" placeholder="+ Add task to “${esc(tgt)}” — try “Pay rent every month !high #bills”"></div>`)
    + `<div class="body${kan ? ' kb' : ''}">${body}</div>`;
  if (draft && $('#add')) $('#add').value = draft;
}

/* ---------- calendar ---------- */
function renderCal() {
  const m = U.calM, y = m.getFullYear(), mo = m.getMonth(), ws = +S.settings.weekStart, td = todayStr();
  const first = new Date(y, mo, 1), start = addDays(first, -((first.getDay() - ws + 7) % 7));
  const by = {};
  S.tasks.filter(t => !t.deleted && t.due && t.status !== 'wontdo').forEach(t => { (by[t.due] = by[t.due] || []).push(t); });
  const head = Array.from({ length: 7 }, (_, i) => `<div class="dow">${DAYS[(ws + i) % 7]}</div>`).join('');
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i)).map(d => {
    const k = ymd(d), ts = (by[k] || []).sort((a, b) => (a.time || '').localeCompare(b.time || '') || b.priority - a.priority);
    return `<div class="day${d.getMonth() !== mo ? ' out' : ''}${k === td ? ' today' : ''}" data-act="calday" data-d="${k}"><span class="dn">${d.getDate()}</span>${ts.slice(0, 3).map(t => `<div class="chip p${t.priority}${t.status !== 'open' ? ' fin' : ''}${U.sel === t.id ? ' sel' : ''}" data-act="open" data-id="${t.id}">${mdInline(t.title, true)}</div>`).join('')}${ts.length > 3 ? `<div class="more">+${ts.length - 3} more</div>` : ''}</div>`;
  }).join('');
  $('#main').innerHTML = topHtml(`${MONTHS[mo]} ${y}`, `<button class="ib" data-act="calprev">${ic('left')}</button><button class="btn" data-act="caltoday">Today</button><button class="ib" data-act="calnext">${ic('right')}</button>`)
    + `<div class="cal"><div class="dows">${head}</div><div class="cgrid">${cells}</div></div>`;
}

/* ---------- eisenhower matrix ---------- */
function renderMatrix() {
  const td = todayStr(), open = S.tasks.filter(t => !t.deleted && t.status === 'open');
  const urg = t => !!(t.due && t.due <= td), imp = t => t.priority >= 2;
  const Q = [
    ['Urgent & Important', 'Do first', 'var(--red)', t => imp(t) && urg(t), { priority: 3, due: td }],
    ['Not Urgent & Important', 'Schedule', 'var(--p2)', t => imp(t) && !urg(t), { priority: 3 }],
    ['Urgent & Not Important', 'Delegate', 'var(--p1)', t => !imp(t) && urg(t), { due: td }],
    ['Not Urgent & Not Important', 'Eliminate', 'var(--muted)', t => !imp(t) && !urg(t), {}],
  ];
  $('#main').innerHTML = topHtml('Matrix') + `<div class="matrix">${Q.map(([n, sub, c, f], i) => {
    const ts = sortTasks(open.filter(f));
    return `<div class="quad" style="--c:${c}"><div class="qh"><b>${n}</b><small>${sub} · ${ts.length}</small></div><div class="qb">${ts.map(t => rowHtml(t, true)).join('')}</div><input class="qadd" data-q="${i}" placeholder="+ Add task" autocomplete="off"></div>`;
  }).join('')}</div><p class="hint pad">Urgent = due today or overdue · Important = medium or high priority</p>`;
  U.matrixCtx = Q.map(q => q[4]);
}

/* ---------- habits ---------- */
function streak(h) {
  let d = new Date(), n = 0;
  if (!h.log[ymd(d)]) d = addDays(d, -1);
  while (h.log[ymd(d)]) { n++; d = addDays(d, -1); }
  return n;
}
function renderHabits() {
  const now = new Date(), days = Array.from({ length: 7 }, (_, i) => addDays(now, i - 6)), tk = ymd(now);
  const cards = S.habits.map(h => `<div class="habit" style="--c:${h.color}"><div class="hh"><span class="hi">${esc(h.icon || '✓')}</span><div class="hn" data-act="hmenu" data-id="${h.id}"><b>${esc(h.name)}</b><small>${streak(h)} day streak · ${Object.keys(h.log).length} check-ins</small></div><button class="hcheck${h.log[tk] ? ' on' : ''}" data-act="hday" data-id="${h.id}" data-d="${tk}" aria-label="Check in today">${ic('check', 20)}</button></div><div class="hstrip">${days.map(d => `<button class="hd${h.log[ymd(d)] ? ' on' : ''}" data-act="hday" data-id="${h.id}" data-d="${ymd(d)}"><small>${DAYS[d.getDay()]}</small>${d.getDate()}</button>`).join('')}</div></div>`).join('');
  $('#main').innerHTML = topHtml('Habit', `<button class="btn pri" data-act="haddlg">${ic('plus', 16)} New habit</button>`)
    + `<div class="body habits">${cards || `<div class="empty">${ic('activity', 44)}<p>Build a streak — add your first habit</p></div>`}</div>`;
}

/* ---------- focus (pomodoro) ---------- */
const fmtClock = s => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
function renderFocus() {
  const C = 2 * Math.PI * 110, td = todayStr();
  const mins = d => S.pomo.filter(p => ymd(new Date(p.ts)) === d).reduce((a, p) => a + p.min, 0);
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(new Date(), i - 6); return { d, m: mins(ymd(d)) }; });
  const mx = Math.max(30, ...week.map(x => x.m));
  const openT = S.tasks.filter(t => !t.deleted && t.status === 'open');
  $('#main').innerHTML = topHtml('Focus') + `<div class="body focus">
<div class="modes">${[['focus', 'Focus'], ['short', 'Short break'], ['long', 'Long break']].map(([k, n]) => `<button class="${P.mode === k ? 'on' : ''}" data-act="pmode" data-m="${k}">${n}</button>`).join('')}</div>
<div class="ring"><svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="110" class="bg"/><circle id="pring" cx="120" cy="120" r="110" class="fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - P.left / P.total)}" transform="rotate(-90 120 120)"/></svg><div id="pclock">${fmtClock(P.left)}</div></div>
<div class="pctl"><button class="btn pri big" data-act="ptoggle">${P.run ? 'Pause' : P.left < P.total ? 'Resume' : 'Start'}</button><button class="btn big" data-act="preset">Reset</button><button class="btn big" data-act="pskip">Skip</button></div>
<select data-sel="ptask"><option value="">No task linked</option>${openT.map(t => `<option value="${t.id}"${P.task === t.id ? ' selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
<div class="stats"><div><b>${mins(td)}</b><small>min today</small></div><div><b>${S.pomo.filter(p => ymd(new Date(p.ts)) === td).length}</b><small>sessions today</small></div><div><b>${Math.round(S.pomo.reduce((a, p) => a + p.min, 0) / 6) / 10}</b><small>hours total</small></div></div>
<div class="bars">${week.map(x => `<div><i style="height:${Math.round(x.m / mx * 100)}%"></i><small>${DAYS[x.d.getDay()]}</small></div>`).join('')}</div></div>`;
}
function paintClock() {
  const c = $('#pclock'), r = $('#pring');
  if (c) c.textContent = fmtClock(P.left);
  if (r) r.setAttribute('stroke-dashoffset', 2 * Math.PI * 110 * (1 - P.left / P.total));
  document.title = P.run ? `${fmtClock(P.left)} · OpenTick` : 'OpenTick';
}

/* ---------- task detail ---------- */
function notesHtml(t) {
  const mode = U.nMode || (t.notes.trim() ? 'preview' : 'write');
  const seg = (m, n) => `<button class="${mode === m ? 'on' : ''}" data-act="nmode" data-m="${m}">${n}</button>`;
  return `<div class="notes"><div class="nbar"><div class="seg">${seg('write', 'Write')}${seg('preview', 'Preview')}</div>${mode === 'write' ? NOTE_FMT.map(([k, l, tt]) => `<button class="fmt" data-act="nfmt" data-k="${k}" title="${tt}">${l}</button>`).join('') : ''}</div>`
    + (mode === 'write'
      ? `<textarea data-f="notes" placeholder="Notes — Markdown supported">${esc(t.notes)}</textarea>`
      : `<div class="nprev md" id="nprev" data-act="nedit" title="Click to edit">${t.notes.trim() ? md(t.notes) : '<span class="hint">Nothing to preview yet</span>'}</div>`) + '</div>';
}
function renderDetail() {
  const t = getT(U.sel), el = $('#detail');
  if (U._dsel !== U.sel) { U._dsel = U.sel; U.nMode = null; } // opening another task starts in the default mode
  document.body.classList.toggle('dopen', !!t);
  if (!t) { el.innerHTML = `<div class="empty">${ic('check-circle', 44)}<p>Select a task to see details</p></div>`; return; }
  const rk = repeatKey(t.repeat), l = listOf(t.listId), secs = l.sections || [];
  const td = todayStr(), tm = ymd(addDays(new Date(), 1)), nw = ymd(addDays(new Date(), ((8 - new Date().getDay()) % 7) || 7));
  const DURS = [15, 30, 45, 60, 90, 120, 180, 240]; if (t.dur && !DURS.includes(t.dur)) DURS.push(t.dur);
  const slots = [...S.slots].sort((a, b) => (a.days[0] || 0) - (b.days[0] || 0) || a.start.localeCompare(b.start));
  const RN = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
  el.innerHTML = `
<div class="dhead"><button class="chk p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 13) : ''}</button><input class="dtitle" data-f="title" value="${esc(t.title)}" placeholder="Task title"><button class="ib mob" data-act="closedetail" aria-label="Close">${ic('x', 20)}</button></div>
<div class="dbody">
<div class="dr"><span>${ic('calendar', 16)}</span><input type="date" data-f="due" value="${t.due || ''}"><input type="time" data-f="time" value="${t.time || ''}"${t.due ? '' : ' disabled'}></div>
<div class="chips"><button class="btn sm${t.due === td ? ' on' : ''}" data-act="qdate" data-w="today">Today</button><button class="btn sm${t.due === tm ? ' on' : ''}" data-act="qdate" data-w="tomorrow">Tomorrow</button><button class="btn sm${t.due === nw ? ' on' : ''}" data-act="qdate" data-w="next">Next week</button><button class="btn sm${!t.due ? ' on' : ''}" data-act="qdate" data-w="none">No date</button></div>
<div class="dr"><span>${ic('clock', 16)}</span><select data-f="dur">${opts([['', 'No duration'], ...DURS.sort((a, b) => a - b).map(m => [m, m < 60 ? m + ' minutes' : m === 60 ? '1 hour' : fmtDur(m)])], t.dur || '')}</select></div>${slots.length ? `<div class="dr"><span>${ic('table', 16)}</span><select data-f="slot" title="Timetable slot">${opts([['', 'No timetable slot'], ...slots.map(x => [x.id, `${x.title} · ${x.days.map(d => DAYS[d]).join('/')} ${x.start}`])], t.slotId && slotById(t.slotId) ? t.slotId : '')}</select></div>` : ''}
<div class="dr"><span>${ic('flag', 16)}</span><div class="pri">${[3, 2, 1, 0].map(p => `<button class="pf p${p}${t.priority === p ? ' on' : ''}" data-act="prio" data-p="${p}">${PRIO[p]}</button>`).join('')}</div></div>
<div class="dr"><span>${ic('list', 16)}</span><select data-f="list">${opts(S.lists.map(x => [x.id, x.name]), t.listId)}</select>${secs.length ? `<select data-f="section">${opts([['', 'Not sectioned'], ...secs.map(s => [s, s])], t.section || '')}</select>` : ''}</div>
<div class="dr"><span>${ic('repeat', 16)}</span><select data-f="repeat">${opts([['none', 'Does not repeat'], ...Object.keys(RN).map(k => [k, RN[k]]), ...(rk === 'custom' ? [['custom', repeatLabel(t.repeat)]] : [])], rk)}</select></div>
<div class="dr"><span>${ic('bell', 16)}</span><select data-f="reminder">${opts([['', 'No reminder'], [0, 'On time'], [5, '5 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [1440, '1 day before']], t.reminder == null ? '' : t.reminder)}</select></div>
<div class="dr"><span>${ic('tag', 16)}</span><input data-f="tags" value="${esc(t.tags.map(g => '#' + g).join(' '))}" placeholder="#tags"></div>
<details class="gtd"${t.start || t.astart ? ' open' : ''}><summary>Gantt dates</summary><div class="dr"><span title="Planned start">${ic('calendar', 16)}</span><label class="gl">Start<input type="date" data-f="start" value="${t.start || ''}"></label><label class="gl">Actual start<input type="date" data-f="astart" value="${t.astart || ''}"></label></div><p class="hint">Plan = start → due date. Actual = actual start → the day you finish. Shown in the Gantt view and in OpenGantt.</p></details>
${t.tags.length ? `<div class="chips tg">${t.tags.map(g => `<button class="tag tagb"${tagColor(g) ? ` style="--tc:${tagColor(g)}"` : ''} data-act="tagcolor" data-tag="${esc(g)}" title="Colour this tag">#${esc(g)}</button>`).join('')}<small class="hint">tap a tag to colour it</small></div>` : ''}
${notesHtml(t)}
<div class="subs"><h4>Subtasks</h4>${t.subtasks.map(s => `<div class="sub"><button class="chk sm${s.done ? ' on' : ''}" data-act="subtog" data-sid="${s.id}">${s.done ? ic('check', 11) : ''}</button><input data-sf="${s.id}" value="${esc(s.title)}" class="${s.done ? 'fin' : ''}">${s.start || s.due ? `<small class="sd" title="Edit subtask dates in OpenGantt">${esc(s.start && s.due ? fmtDate(s.start) + ' – ' + fmtDate(s.due) : fmtDate(s.start || s.due))}</small>` : ''}<button class="ib sm" data-act="subdel" data-sid="${s.id}">${ic('x', 14)}</button></div>`).join('')}<input id="d-subnew" placeholder="+ Add subtask" autocomplete="off"></div>
</div>
<div class="dfoot">${t.deleted ? `<button class="btn" data-act="restore">Restore</button><button class="btn danger" data-act="purge">Delete forever</button>` : `<button class="btn" data-act="wontdo">${t.status === 'wontdo' ? 'Reopen' : "Won't do"}</button><button class="btn" data-act="dup">Duplicate</button><button class="btn danger" data-act="del">Delete</button>`}</div>`;
}

/* ---------- timetable ----------
   Slots (S.slots) repeat every week on their days. Tasks join the grid by date: a task with a time becomes a block
   (its duration, default 30 min), one without a time sits in the all-day row, and a task linked to a slot is listed
   inside that slot's block on its due date. */
const TT_HH = 52; // px per hour
function ttDays() {
  const tt = S.settings.tt, b = U.ttDate || new Date(), base = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  if (tt.view === 'day') return [base];
  const ws = +S.settings.weekStart, start = addDays(base, -((base.getDay() - ws + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter(d => tt.weekends || (d.getDay() !== 0 && d.getDay() !== 6));
}
function ttItems(d) {
  const k = ymd(d), items = [], allday = [];
  for (const s of S.slots) if (s.days.includes(d.getDay())) items.push({ k: 'slot', s, a: toMin(s.start), b: Math.max(toMin(s.end), toMin(s.start) + 15), tasks: [] });
  for (const t of S.tasks) {
    if (t.deleted || t.status === 'wontdo' || t.due !== k) continue;
    const host = t.slotId && items.find(o => o.k === 'slot' && o.s.id === t.slotId);
    if (host) host.tasks.push(t);
    else if (t.time) { const a = toMin(t.time); items.push({ k: 'task', t, a, b: Math.min(1440, a + (t.dur || 30)) }); }
    else allday.push(t);
  }
  return { items, allday };
}
// side-by-side columns for overlapping blocks; marks slots that overlap another slot
function ttLayout(items) {
  items.sort((x, y) => x.a - y.a || y.b - x.b);
  let cluster = [], end = 0;
  const flush = () => { const n = Math.max(1, ...cluster.map(i => i.col + 1)); cluster.forEach(i => { i.n = n; }); cluster = []; };
  for (const it of items) {
    if (cluster.length && it.a >= end) { flush(); end = 0; }
    const used = cluster.filter(c => c.b > it.a).map(c => c.col);
    let col = 0; while (used.includes(col)) col++;
    it.col = col; cluster.push(it); end = Math.max(end, it.b);
  }
  flush();
  const sl = items.filter(i => i.k === 'slot');
  sl.forEach(i => { i.clash = sl.some(o => o !== i && i.a < o.b && o.a < i.b); });
}
function ttRange(days) {
  const a = days[0], b = days[days.length - 1];
  if (days.length === 1) return `${FULLDAYS[a.getDay()]} ${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}` : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
}
function renderTimetable() {
  const tt = S.settings.tt, view = tt.view === 'day' ? 'day' : 'week', days = ttDays(), ppm = TT_HH / 60, td = todayStr();
  const data = days.map(d => { const r = ttItems(d); ttLayout(r.items); return { d, k: ymd(d), ...r }; });
  let from = tt.from * 60, to = tt.to * 60, firstA = 1440;
  for (const x of data) for (const it of x.items) { from = Math.min(from, Math.floor(it.a / 60) * 60); to = Math.max(to, Math.ceil(it.b / 60) * 60); firstA = Math.min(firstA, it.a); }
  from = Math.max(0, from); to = Math.min(1440, Math.max(to, from + 60));
  const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes(), showsToday = data.some(x => x.k === td);
  const pos = it => `top:${(it.a - from) * ppm}px;height:${Math.max(18, (it.b - it.a) * ppm - 2)}px;left:calc(${(it.col / it.n) * 100}% + 1px);width:calc(${100 / it.n}% - 3px)`;
  const taskLine = t => `<div class="bl${t.status !== 'open' ? ' fin' : ''}" data-act="open" data-id="${t.id}"><button class="chk sm p${t.priority}${t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="Complete task">${t.status === 'done' ? ic('check', 11) : ''}</button><span>${titleHtml(t)}</span></div>`;
  const block = (it, d) => it.k === 'slot'
    ? `<div class="blk slot${it.clash ? ' clash' : ''}" style="${pos(it)};--c:${it.s.color}" data-act="ttslot" data-sid="${it.s.id}" data-day="${d.getDay()}" data-a="${it.a}" data-b="${it.b}" draggable="true" title="${esc(it.s.title)} ${it.s.start}–${it.s.end}${it.clash ? ' (overlaps another slot)' : ''}"><div class="bt">${it.clash && it.n === 1 ? ic('alert', 12) + ' ' : ''}<span class="tt-t">${esc(it.s.title)}</span></div><div class="bm">${it.s.start}–${it.s.end}${it.s.loc ? ` · ${ic('pin', 11)} ${esc(it.s.loc)}` : ''}</div>${it.tasks.map(taskLine).join('')}<i class="rz" data-k="slot" data-id="${it.s.id}"></i></div>`
    : `<div class="blk tk p${it.t.priority}${it.t.status !== 'open' ? ' fin' : ''}${U.sel === it.t.id ? ' sel' : ''}" style="${pos(it)}" data-act="open" data-id="${it.t.id}" data-a="${it.a}" data-b="${it.b}" draggable="true"><div class="bt"><button class="chk sm p${it.t.priority}${it.t.status === 'done' ? ' on' : ''}" data-act="toggle" data-id="${it.t.id}" aria-label="Complete task">${it.t.status === 'done' ? ic('check', 11) : ''}</button> <span class="tt-t">${titleHtml(it.t)}</span></div><div class="bm">${it.t.time}${it.t.dur ? ' · ' + fmtDur(it.t.dur) : ''}</div><i class="rz" data-k="task" data-id="${it.t.id}"></i></div>`;
  const head = `<div class="tt-row"><div class="tt-cor"></div>${data.map(x => `<button class="tt-dh${x.k === td ? ' today' : ''}" data-act="ttday" data-d="${x.k}" title="Open this day"><small>${DAYS[x.d.getDay()]}</small><b>${x.d.getDate()}</b></button>`).join('')}</div>`;
  const allday = `<div class="tt-row tt-adrow"><div class="tt-cor"><small>all day</small></div>${data.map(x => `<div class="tt-ad" data-d="${x.k}">${x.allday.map(t => `<div class="chip p${t.priority}${t.status !== 'open' ? ' fin' : ''}${U.sel === t.id ? ' sel' : ''}" data-act="open" data-id="${t.id}" draggable="true">${titleHtml(t)}</div>`).join('')}</div>`).join('')}</div>`;
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => `<span style="top:${i * TT_HH}px">${pad(from / 60 + i)}:00</span>`).join('');
  const cols = data.map(x => `<div class="tt-col${x.k === td ? ' today' : ''}" data-act="ttcell" data-d="${x.k}" data-from="${from}">${x.items.map(it => block(it, x.d)).join('')}${x.k === td && nowM >= from && nowM <= to ? `<div class="tt-now" style="top:${(nowM - from) * ppm}px"></div>` : ''}</div>`).join('');
  const trayOn = U.ttTray == null ? window.innerWidth >= 1700 : U.ttTray;
  const un = S.tasks.filter(t => !t.deleted && t.status === 'open' && !t.time).sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || b.priority - a.priority);
  const tray = trayOn ? `<aside class="tray"><div class="rs rs-l" data-rs="tray" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize · double-click to reset"></div><div class="trh"><b>Tasks</b><small>${un.length} without a time</small><button class="ib sm" data-act="tttray" title="Hide this panel">${ic('x', 14)}</button></div><input class="tradd" placeholder="+ New task  (try “Study 4pm for 90min”)" autocomplete="off"><div class="trl">${un.slice(0, 80).map(t => `<div class="tri p${t.priority}${U.sel === t.id ? ' sel' : ''}" draggable="true" data-act="open" data-id="${t.id}"><div class="ttl">${titleHtml(t)}</div><div class="meta">${t.due ? `<span class="due${isOverdue(t) ? ' late' : ''}">${esc(dueLabel(t))}</span>` : ''}${metaX(t)}</div></div>`).join('') || '<p class="hint">Nothing waiting — nice.</p>'}</div><p class="hint">Drag a task onto the grid to give it a time, or onto “all day”. Pull a block’s bottom edge to resize it.</p></aside>` : '';
  const step = view === 'day' ? 'day' : 'week';
  const tools = `<button class="ib" data-act="ttprev" title="Previous ${step}">${ic('left')}</button><button class="btn" data-act="tttoday">Today</button><button class="ib" data-act="ttnext" title="Next ${step}">${ic('right')}</button><div class="seg"><button class="${view === 'week' ? 'on' : ''}" data-act="ttview" data-v="week">Week</button><button class="${view === 'day' ? 'on' : ''}" data-act="ttview" data-v="day">Day</button></div><button class="btn pri" data-act="ttadd">${ic('plus', 16)} Slot</button><button class="ib${trayOn ? ' on' : ''}" data-act="tttray" title="Task list">${ic('list')}</button><button class="ib" data-act="ttset" title="Timetable settings">${ic('sliders')}</button>`;
  const old = $('.tt-scroll'), keep = old ? old.scrollTop : null;
  const draft = $('.tradd') ? $('.tradd').value : '';
  $('#main').innerHTML = topHtml(esc(ttRange(days)), tools)
    + (S.slots.length ? '' : '<p class="hint pad">Click anywhere on the grid to add a weekly slot (a class, shift, routine…). Tasks with a time appear here too.</p>')
    + `<div class="tt"><div class="tt-scroll"><div class="tt-inner" style="--n:${data.length};--cw:${view === 'day' ? 0 : 96}px;--hh:${TT_HH}px"><div class="tt-top">${head}${allday}</div><div class="tt-body" style="height:${(to - from) * ppm}px"><div class="tt-gut">${hours}</div>${cols}</div></div></div>${tray}</div>`;
  const sc = $('.tt-scroll');
  if (sc) sc.scrollTop = keep != null ? keep : Math.max(0, ((showsToday ? nowM - 60 : (firstA < 1440 ? firstA : 8 * 60) - 30) - from) * ppm);
  if (draft && $('.tradd')) $('.tradd').value = draft;
}
