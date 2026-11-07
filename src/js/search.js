/* OpenTick search: one box for everything. Press / or Ctrl+K (or click the search box in the sidebar) and type: tasks, notes, templates, lists,
   projects, habits, countdowns, time zones, boards, timetable slots, tags, the pages themselves, commands and settings all answer from the same
   place, grouped, with the matching words marked. ↑ ↓ choose, Enter opens, Esc closes. "See all tasks" hands the words to the Tasks page's own search.
   Nothing here changes data: it only finds things and takes you to them. */
const SRCH_SCOPES = [['all', 'Everything'], ['tasks', 'Tasks'], ['notes', 'Notes & templates'], ['items', 'Lists & more'], ['app', 'Pages & settings']];
const SRCH_CAP = 7; // results per group before "see all"
const srchWords = q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
const srchHas = (hay, words) => words.every(w => hay.includes(w));
// the text with the searched words marked (escaped first, so nothing typed can become markup)
function srchHl(text, words) {
  const t = String(text || ''); if (!words.length) return esc(t);
  const re = new RegExp('(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
  return t.split(re).map((p, i) => (i % 2 ? `<mark>${esc(p)}</mark>` : esc(p))).join('');
}
// a short piece of a long text around the first match
function srchSnip(text, words, len = 120) {
  const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return '';
  const low = t.toLowerCase(); let at = -1; for (const w of words) { const i = low.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return t.slice(0, len);
  const from = Math.max(0, at - 30); return (from ? '…' : '') + t.slice(from, from + len) + (from + len < t.length ? '…' : '');
}
const srchRank = (title, words) => { const t = String(title || '').toLowerCase(); return words.every(w => t.includes(w)) ? (words.some(w => t.startsWith(w)) ? 0 : 1) : 2; };

function srchTask(t) {
  closeModal(); document.body.classList.remove('drawer');
  const list = S.lists.some(l => l.id === t.listId) ? (t.listId === 'inbox' ? 'inbox' : 'list:' + t.listId) : 'all';
  setNav(t.status === 'done' ? 'done' : t.status === 'wontdo' ? 'wontdo' : list); U.sel = t.id; renderSide(); renderMain(); renderDetail();
}
const srchGo = (page, fn) => () => { closeModal(); document.body.classList.remove('drawer'); U.page = page; U.sel = null; if (fn) fn(); render(); };

// the groups for a query: [{ k, scope, title, icon, rows: [{ label, sub, icon, hint, run }], more }]
function srchGroups(q, scope) {
  const words = srchWords(q), out = [], want = s => scope === 'all' || scope === s;
  const add = (k, sc, title, icon, rows, more) => { if (rows.length && want(sc)) out.push({ k, scope: sc, title, icon, rows: rows.slice(0, more ? SRCH_CAP : 12), more }); };
  if (!words.length) { // nothing typed yet: the places you are most likely to want
    const pages = sectionsShown().map(([k, n, i]) => ({ label: n, sub: 'Open this view', icon: i, hint: '', run: () => { closeModal(); document.body.classList.remove('drawer'); U.page = sectionTarget(k); U.sel = null; render(); } }));
    const smart = SMART.map(([k, n, i]) => ({ label: n, sub: 'Tasks', icon: i, hint: '', run: () => { closeModal(); document.body.classList.remove('drawer'); setNav(k); } }));
    const lists = S.lists.filter(l => l.id !== 'inbox').slice(0, 6).map(l => ({ label: listLabel(l.id), sub: 'List', icon: 'list', hint: '', run: () => { closeModal(); document.body.classList.remove('drawer'); setNav('list:' + l.id); } }));
    out.push({ k: 'jump', scope: 'all', title: 'Go to', icon: 'right', rows: [...pages, ...smart, ...lists] });
    return scope === 'all' || scope === 'app' ? out : [];
  }
  // tasks: open ones first, then by how well the title matches
  const tasks = S.tasks.filter(t => !t.deleted && !t.log && srchHas((t.title + ' ' + (t.notes || '') + ' ' + (t.tags || []).join(' ') + ' ' + (t.files || []).map(f => f.name).join(' ') + ' ' + (t.subtasks || []).map(s => s.title).join(' ')).toLowerCase(), words))
    .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || srchRank(a.title, words) - srchRank(b.title, words) || (dueKey(a) || '').localeCompare(dueKey(b) || ''));
  add('tasks', 'tasks', 'Tasks', 'check-circle', tasks.map(t => ({
    label: t.title, html: srchHl(t.title, words), icon: t.status === 'done' ? 'check' : 'circle', hint: t.status === 'done' ? 'Done' : t.due ? fmtDate(t.due) : '',
    sub: `${listLabel(t.listId)}${t.notes && !srchHas(String(t.title).toLowerCase(), words) ? ' · ' + srchSnip(t.notes, words, 80) : ''}`, run: () => srchTask(t),
  })), tasks.length);
  if (tasks.length > SRCH_CAP && want('tasks')) { const g = out.find(x => x.k === 'tasks'); if (g) g.all = { label: `See all ${tasks.length} tasks`, run: () => { closeModal(); document.body.classList.remove('drawer'); U.q = String(q).trim(); U.page = 'tasks'; U.sel = null; renderSide(); renderMain(); renderDetail(); } }; }
  const notes = S.notes.filter(n => !n.deleted && srchHas((noteTitle(n) + ' ' + (n.body || '') + ' ' + (n.tags || []).join(' ')).toLowerCase(), words)).sort((a, b) => srchRank(noteTitle(a), words) - srchRank(noteTitle(b), words) || (b.updated || b.u || 0) - (a.updated || a.u || 0));
  add('notes', 'notes', 'Notes', 'notes', notes.map(n => ({ label: noteTitle(n), html: srchHl(noteTitle(n), words), icon: 'notes', hint: '', sub: srchSnip(mdPlain(String(n.body || '').replace(/^#.*\n?/, '')), words, 110), run: () => openNoteById(n.id) })), notes.length);
  const tpls = S.templates.filter(x => srchHas(((x.name || '') + ' ' + (x.body || '') + ' ' + (x.tags || []).join(' ')).toLowerCase(), words));
  add('tpls', 'notes', 'Templates', 'copy', tpls.map(x => ({ label: x.name || 'Untitled template', html: srchHl(x.name || 'Untitled template', words), icon: 'copy', hint: 'Template', sub: srchSnip(x.body, words, 100), run: srchGo('templates', () => { U.tplSel = x.id; }) })), tpls.length);
  const lists = S.lists.filter(l => l.id !== 'inbox' && srchHas(listLabel(l.id).toLowerCase(), words));
  add('lists', 'items', 'Lists', 'list', lists.map(l => ({ label: listLabel(l.id), html: srchHl(listLabel(l.id), words), icon: 'list', hint: '', sub: `${S.tasks.filter(t => !t.deleted && t.listId === l.id && t.status === 'open').length} open`, run: () => { closeModal(); document.body.classList.remove('drawer'); setNav('list:' + l.id); } })), lists.length);
  const projs = S.projects.filter(p => srchHas((p.name || '').toLowerCase(), words));
  add('projs', 'items', 'Projects', 'dashboard', projs.map(p => ({ label: p.name, html: srchHl(p.name, words), icon: 'dashboard', hint: '', sub: 'Project', run: () => { closeModal(); document.body.classList.remove('drawer'); setNav('project:' + p.id); } })), projs.length);
  const tags = [...new Set(S.tasks.filter(t => !t.deleted).flatMap(t => t.tags || []))].filter(t => srchHas(t.toLowerCase(), words)).sort();
  add('tags', 'items', 'Tags', 'tag', tags.map(t => ({ label: '#' + t, html: '#' + srchHl(t, words), icon: 'tag', hint: '', sub: 'Tasks with this tag', run: () => { closeModal(); document.body.classList.remove('drawer'); setNav('tag:' + t); } })), tags.length);
  const hab = S.habits.filter(h => !h.deleted && srchHas((h.name || '').toLowerCase(), words));
  add('habits', 'items', 'Habits', 'activity', hab.map(h => ({ label: h.name, html: srchHl(h.name, words), icon: 'activity', hint: '', sub: 'Habit', run: srchGo('habits') })), hab.length);
  const cds = S.countdowns.filter(c => srchHas((c.name || '').toLowerCase(), words));
  add('cds', 'items', 'Countdowns', 'hourglass', cds.map(c => ({ label: c.name, html: srchHl(c.name, words), icon: 'hourglass', hint: fmtDate(c.date), sub: 'Countdown', run: srchGo('countdowns') })), cds.length);
  const zs = S.zones.filter(z => srchHas(((z.name || '') + ' ' + (z.tz || '')).toLowerCase(), words));
  add('zones', 'items', 'Time zones', 'globe', zs.map(z => ({ label: z.name || z.tz, html: srchHl(z.name || z.tz, words), icon: 'globe', hint: '', sub: z.tz, run: srchGo('zones') })), zs.length);
  const bds = S.boards.filter(b => srchHas((b.name || '').toLowerCase(), words));
  add('boards', 'items', 'Boards', 'columns', bds.map(b => ({ label: b.name, html: srchHl(b.name, words), icon: 'columns', hint: '', sub: 'Board', run: srchGo('kanban', () => { S.settings.ui.board = b.id; }) })), bds.length);
  const slots = S.slots.filter(s => srchHas(((s.title || '') + ' ' + (s.loc || '')).toLowerCase(), words));
  add('slots', 'items', 'Timetable', 'table', slots.map(s => ({ label: s.title, html: srchHl(s.title, words), icon: 'table', hint: '', sub: 'Weekly slot' + (s.loc ? ' · ' + s.loc : ''), run: () => { closeModal(); document.body.classList.remove('drawer'); calGo('week'); } })), slots.length);
  // pages, the calendar's views, and commands
  const pageRows = [
    ...sectionsShown().map(([k, n, i]) => ({ label: n, i, run: () => { closeModal(); document.body.classList.remove('drawer'); U.page = sectionTarget(k); U.sel = null; render(); }, sub: 'View' })),
    ...CAL_MODES.map(([v, n, i]) => ({ label: 'Calendar: ' + n, i, run: () => { closeModal(); document.body.classList.remove('drawer'); calGo(v); }, sub: 'Calendar view' })),
    ...SMART.concat([['done', 'Completed', 'check-circle'], ['wontdo', "Won't Do", 'slash'], ['trash', 'Trash', 'trash']]).map(([k, n, i]) => ({ label: n, i, run: () => { closeModal(); document.body.classList.remove('drawer'); setNav(k); }, sub: 'Tasks' })),
    ...[['kanban', 'Board'], ['matrix', 'Matrix'], ['gantt', 'Timeline'], ['focus', 'Focus timer'], ['history', 'History']].map(([k, n]) => ({ label: n, i: (PAGES.find(p => p[0] === k) || [0, 0, 'eye'])[2], run: srchGo(k), sub: 'View' })),
  ].filter(r => srchHas(r.label.toLowerCase(), words));
  add('pages', 'app', 'Pages & views', 'eye', pageRows.map(r => ({ label: r.label, html: srchHl(r.label, words), icon: r.i, hint: '', sub: r.sub, run: r.run })), pageRows.length);
  const cmds = paletteItems(q).filter(i => !['View', 'List', 'Project', 'Task', 'Note', 'Template', 'Theme'].includes(i.hint));
  add('cmds', 'app', 'Commands', 'sliders', cmds.map(i => ({ label: i.label, html: srchHl(i.label, words), icon: 'chevron-right', hint: i.hint, sub: '', run: () => { closeModal(); i.run(); } })), cmds.length);
  const sets = SET_TABS.filter(([k, n]) => srchHas((n + ' ' + (SET_ALIAS[k] || '')).toLowerCase(), words));
  const setRows = sets.map(([k, n, i]) => ({ label: n, html: srchHl(n, words), icon: i, hint: 'Settings', sub: 'Open this section of Settings', run: () => { closeModal(); openSettings(k); } }));
  setRows.push({ label: `Search settings for “${String(q).trim()}”`, html: `Search settings for “${esc(String(q).trim())}”`, icon: 'search', hint: 'Settings', sub: 'Every setting, with what it does', run: () => { closeModal(); openSettings(); const m = $('#modal'), i = $('#setq', m); if (i) { i.value = String(q).trim(); setSearchRun(m); i.focus(); } } });
  add('set', 'app', 'Settings', 'sliders', setRows, 0);
  return out;
}

function openSearch(prefill = '') {
  let scope = 'all', sel = 0, flat = [];
  const paint = (m) => {
    const q = $('#gs-q', m).value, groups = srchGroups(q, scope), words = srchWords(q); flat = [];
    const l = $('#gs-l', m);
    l.innerHTML = groups.length ? groups.map(g => `<div class="gs-g"><div class="gs-gh">${ic(g.icon, 14)}<span>${esc(g.title)}</span>${g.more > g.rows.length ? `<small>${g.more}</small>` : ''}</div>${g.rows.map(r => { const n = flat.push(r) - 1; return `<button class="gs-r${n === sel ? ' on' : ''}" data-n="${n}">${ic(r.icon || 'circle', 16)}<span class="gs-t"><b>${r.html || esc(r.label)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>${r.hint ? `<i class="gs-h">${esc(r.hint)}</i>` : ''}</button>`; }).join('')}${g.all ? (() => { const n = flat.push(g.all) - 1; return `<button class="gs-r gs-all${n === sel ? ' on' : ''}" data-n="${n}">${ic('right', 16)}<span class="gs-t"><b>${esc(g.all.label)}</b></span></button>`; })() : ''}</div>`).join('')
      : `<p class="hint gs-none">${words.length ? `Nothing found for “${esc(q.trim())}”. Check the spelling, or try fewer words.` : 'Type to search.'}</p>`;
    if (sel >= flat.length) sel = Math.max(0, flat.length - 1);
    const on = $('.gs-r.on', m); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  };
  const mark = m => { $$('.gs-r', m).forEach(b => b.classList.toggle('on', +b.dataset.n === sel)); const on = $('.gs-r.on', m); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' }); };
  const run = n => { const r = flat[n]; if (r) r.run(); };
  openModal(`<div class="gs-top">${ic('search', 18)}<input id="gs-q" placeholder="Search tasks, notes, templates, settings…" aria-label="Search everything" autocomplete="off" spellcheck="false" value="${esc(prefill)}"><button class="ib sm" data-gs="close" title="Close" aria-label="Close search">${ic('x', 16)}</button></div>
<div class="gs-chips" role="tablist" aria-label="What to search">${SRCH_SCOPES.map(([k, n]) => `<button role="tab" class="${k === scope ? 'on' : ''}" aria-selected="${k === scope}" data-gs-scope="${k}">${n}</button>`).join('')}</div>
<div id="gs-l" class="gs-l" role="listbox"></div><div class="gs-foot"><span><kbd>↑</kbd><kbd>↓</kbd> choose</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>`, m => {
    const q = $('#gs-q', m); paint(m); q.focus(); q.select();
    let tm = 0; q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { sel = 0; paint(m); }, 40); };
    m.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(flat.length - 1, sel + 1); mark(m); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(m); }
      else if (e.key === 'Enter' && e.target.id === 'gs-q') { e.preventDefault(); run(sel); }
    };
    m.onclick = e => {
      const r = e.target.closest('.gs-r'); if (r) { run(+r.dataset.n); return; }
      const c = e.target.closest('[data-gs-scope]'); if (c) { scope = c.dataset.gsScope; sel = 0; $$('.gs-chips button', m).forEach(b => { const on = b === c; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); paint(m); q.focus(); return; }
      if (e.target.closest('[data-gs=close]') || e.target.classList.contains('mback')) closeModal();
    };
    m.onmousemove = e => { const r = e.target.closest('.gs-r'); if (r && +r.dataset.n !== sel) { sel = +r.dataset.n; $$('.gs-r', m).forEach(b => b.classList.toggle('on', b === r)); } };
  }, 'gs');
}
// the search box in the sidebar opens it (it is a button that looks like a box), by click or by Enter once it has the keyboard
document.addEventListener('click', e => { const t = e.target; if (t && t.closest && t.closest('#side .search') && !t.closest('[data-act]')) { e.preventDefault(); if (!$('#modal.on')) openSearch(U.q || ''); } });
document.addEventListener('keydown', e => { const t = e.target; if (t && t.id === 'q' && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') && !$('#modal.on')) { e.preventDefault(); openSearch(U.q || ''); } });
