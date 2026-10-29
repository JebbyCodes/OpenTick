/* OpenTick Projects home: an overview of every project (progress, lists, what is next), the lists that are not in a project,
   and today's tasks. It is an ordinary page, and Settings → Start screen can make it the one OpenTick opens on. */
const homeGreeting = () => { const h = new Date().getHours(); return h < 5 ? 'Still up?' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
function homeStats(tasks) {
  const open = tasks.filter(t => t.status === 'open'), done = tasks.length - open.length - tasks.filter(t => t.status === 'wontdo').length;
  const live = tasks.filter(t => t.status !== 'wontdo'), pct = live.length ? Math.round(done / live.length * 100) : 0;
  const late = open.filter(isOverdue).length, next = open.filter(t => t.due).sort((a, b) => (a.due + (tmEff(a) || '')).localeCompare(b.due + (tmEff(b) || '')))[0] || open[0] || null;
  return { open: open.length, done, late, pct, next, total: live.length };
}
function homeProjectCard(p) {
  const st = homeStats(scopeTasks('project:' + p.id)), ls = (p.listIds || []).filter(id => S.lists.some(l => l.id === id));
  const chips = ls.slice(0, 4).map(id => { const l = listOf(id); return `<button type="button" class="pchip" style="--c:${l.color}" data-act="nav" data-nav="list:${esc(l.id)}" title="Open ${esc(listLabel(l.id))}"><span>${listIcon(l, 13)}</span>${esc(l.name)}</button>`; }).join('') + (ls.length > 4 ? `<span class="hint">+${ls.length - 4}</span>` : '');
  return `<article class="pcard" style="--c:${p.color}" data-act="nav" data-nav="project:${esc(p.id)}" tabindex="0" role="button" aria-label="Open project ${esc(p.name)}">
<div class="pc-h"><span class="pc-ic">${listIcon(p, 20)}</span><b class="pc-n mq">${esc(p.name)}</b><span class="pc-pct">${st.pct}%</span></div>
<div class="pbar" role="progressbar" aria-valuenow="${st.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${st.pct}%"></i></div>
<div class="pc-s"><span>${st.open} open</span><span>${st.done} done</span>${st.late ? `<span class="late">${st.late} overdue</span>` : ''}</div>
<div class="pc-l">${chips || '<span class="hint">No lists linked yet</span>'}</div>
${st.next ? `<div class="pc-x"><span>Next</span><b class="mq">${esc(st.next.title || 'Untitled')}</b>${st.next.due ? `<em class="${isOverdue(st.next) ? 'late' : ''}">${esc(dueLabel(st.next))}</em>` : ''}</div>` : ''}</article>`;
}
function homeListCard(l) {
  const st = homeStats(scopeTasks('list:' + l.id));
  return `<button type="button" class="lcard" style="--c:${l.color}" data-act="nav" data-nav="list:${esc(l.id)}"><span class="lc-ic">${listIcon(l, 18)}</span><span class="lc-n mq">${esc(listLabel(l.id))}</span><span class="lc-c">${st.late ? `<i class="late">${st.late}</i>` : ''}${st.open}</span></button>`;
}
function renderHome() {
  const td = todayStr(), all = S.tasks.filter(t => !t.deleted), open = all.filter(t => t.status === 'open');
  const dueToday = open.filter(t => t.due === td).length, late = open.filter(isOverdue).length;
  const inProj = new Set(S.projects.flatMap(p => projectListIds(p)));
  const loose = S.lists.filter(l => l.id !== 'inbox' && !inProj.has(l.id) && !l.parent);
  const focus = open.filter(t => t.due && t.due <= td).sort((a, b) => (a.due + (tmEff(a) || '')).localeCompare(b.due + (tmEff(b) || '')) || b.priority - a.priority).slice(0, 6);
  const tools = `<button class="btn" data-act="addlist">${ic('plus', 15)}<span class="hide-m"> List</span></button><button class="btn pri" data-act="addproject">${ic('plus', 15)}<span class="hide-m"> Project</span></button>`;
  const stat = (n, label, ico, cls = '') => `<button type="button" class="hstat ${cls}" data-act="nav" data-nav="${label === 'Overdue' || label === 'Due today' ? 'today' : 'all'}">${ic(ico, 18)}<b>${n}</b><span>${label}</span></button>`;
  $('#main').innerHTML = topHtml('Projects', tools)
    + `<div class="body home"><div class="hgreet"><h2>${homeGreeting()}</h2><p>${esc(FULLDAYS[new Date().getDay()])}, ${new Date().getDate()} ${esc(MONTHS[new Date().getMonth()])}</p></div>`
    + `<div class="hstats">${stat(dueToday, 'Due today', 'sun')}${stat(late, 'Overdue', 'flag', late ? 'late' : '')}${stat(open.length, 'Open tasks', 'check-circle')}${stat(S.projects.length, 'Projects', 'layers')}</div>`
    + `<h3 class="hh">${ic('layers', 16)} Projects</h3>`
    + (S.projects.length ? `<div class="pgrid">${S.projects.map(homeProjectCard).join('')}</div>` : `<div class="hempty"><p>Projects bring several lists together, with one progress bar.</p><button class="btn pri" data-act="addproject">${ic('plus', 15)} Create a project</button></div>`)
    + (loose.length ? `<h3 class="hh">${ic('list', 16)} Lists</h3><div class="lgrid">${loose.map(homeListCard).join('')}</div>` : '')
    + (focus.length ? `<h3 class="hh">${ic('sun', 16)} Needs attention</h3><div class="hfocus">${focus.map(t => rowHtml(t, true)).join('')}</div>` : '')
    + `</div>`;
}
document.addEventListener('keydown', e => { const c = e.target && e.target.classList && e.target.classList.contains('pcard') ? e.target : null; if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.click(); } });

/* ---------- the screen OpenTick opens on ---------- */
const HOME_SCREENS = [['tasks:today', 'Today'], ['home', 'Projects (home screen)'], ['tasks:inbox', 'Inbox'], ['tasks:tomorrow', 'Tomorrow'], ['tasks:week', 'Next 7 Days'], ['tasks:all', 'All tasks'], ['notes', 'Notes'], ['templates', 'Templates'], ['calendar', 'Calendar'], ['timetable', 'Timetable'], ['gantt', 'Gantt'], ['matrix', 'Matrix'], ['habits', 'Habit'], ['focus', 'Focus']];
function homeValid(v) {
  if (typeof v !== 'string') return false;
  if (HOME_SCREENS.some(x => x[0] === v)) return true;
  if (v.startsWith('tasks:list:')) return S.lists.some(l => l.id === v.slice(11));
  if (v.startsWith('tasks:project:')) return S.projects.some(p => p.id === v.slice(14));
  return false;
}
function homeApply() { // sets the first page and nav from the setting (a deleted list or project falls back to Today)
  const v = homeValid(S.settings.home) ? S.settings.home : 'tasks:today';
  if (v.startsWith('tasks:')) { U.page = 'tasks'; U.nav = v.slice(6); } else U.page = v;
}
function homeSelectHtml() {
  const cur = homeValid(S.settings.home) ? S.settings.home : 'tasks:today', o = (v, n) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(n)}</option>`;
  return `<select data-sx="home" aria-label="Start screen">${HOME_SCREENS.map(([v, n]) => o(v, n)).join('')}${S.lists.filter(l => l.id !== 'inbox').length ? `<optgroup label="A list">${S.lists.filter(l => l.id !== 'inbox').map(l => o('tasks:list:' + l.id, listLabel(l.id))).join('')}</optgroup>` : ''}${S.projects.length ? `<optgroup label="A project">${S.projects.map(p => o('tasks:project:' + p.id, p.name)).join('')}</optgroup>` : ''}</select>`;
}
