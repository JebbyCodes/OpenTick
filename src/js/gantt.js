/* ---------- Gantt page ----------
   Two panes share the page:
   - "Tasks": OpenTick's own renderer, which draws tasks the OpenGantt way (plan bar, striped actual, open-task progress bar,
     the same table columns) and lets you edit by dragging: move a plan bar, pull its edges, pull the actual's left edge,
     drag an undated task from the tray onto the timeline.
   - "OpenGantt": the real OpenGantt app (vendored from github.com/JebbyCodes/OpenGantt by `npm run sync:gantt`, shown only
     when the build contains it), seeded with the current list and able to hand its changes back. */
const GT_PPD = { day: 30, week: 14, month: 5, year: 1.7 }, GT_ROW = 30;
const GT_ZOOM = [0.35, 0.5, 0.7, 1, 1.4, 2, 3];
U.gList = 'all'; U.gcol = new Set(); U.ogList = null; U.gpane = 'tasks'; U.gRows = []; U.gMeta = null;

function ganttDates(x, isTask) {
  const done = isTask ? x.status === 'done' : !!x.done, today = todayStr();
  const ps = x.start || x.due || null, pe = x.due || x.start || null;
  let as = x.astart || null, ae = null;
  if (isTask) { if (done) { ae = ymd(new Date(x.doneAt || Date.now())); as = as || x.start || ymd(new Date(x.created || Date.now())); if (as > ae) as = ae; } }
  else if (done && x.aend) { ae = x.aend; as = as || x.start || x.due || x.aend; }
  return { ps, pe, as, ae, done, open: !!as && !ae && !done, single: !!pe && !(x.start && x.due), today };
}
function ganttRows(sel) {
  const rows = [], lists = sel === 'all' ? S.lists : [listOf(sel)];
  const subs = (arr, lv, c, pid) => arr.forEach(s => { const kids = !!(s.children && s.children.length); rows.push({ k: 'sub', s, lv, c, pid, kids }); if (kids && !U.gcol.has(s.id)) subs(s.children, lv + 1, c, pid); });
  for (const l of lists) {
    const ts = S.tasks.filter(t => t.listId === l.id && ogExportable(t)).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!ts.length) continue;
    if (sel === 'all') rows.push({ k: 'list', l });
    for (const t of ts) { const kids = t.subtasks.length > 0; rows.push({ k: 'task', t, lv: sel === 'all' ? 1 : 0, c: l.color, kids }); if (kids && !U.gcol.has(t.id)) subs(t.subtasks, (sel === 'all' ? 1 : 0) + 1, l.color, t.id); }
  }
  return rows;
}

/* ---------- table columns (names follow OpenGantt's `columns:` key) ---------- */
const gtMD = x => { const d = pYmd(x); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };
const gtSigned = n => (n > 0 ? `+${n} d` : n < 0 ? `−${-n} d` : '0 d');
function gtPct(d) { if (d.done) return 100; if (!d.ps || !d.pe) return null; return Math.max(0, Math.min(999, Math.round((dayDiff(d.today, d.ps) + 1) / (dayDiff(d.pe, d.ps) + 1) * 100))); }
function gtStatus(d) {
  if (d.done) return d.ae && d.pe && d.ae > d.pe ? ['Completed late', 'late'] : ['Completed', 'done'];
  if (d.pe && d.today > d.pe) return ['Overdue', 'over'];
  if (d.as || (d.ps && d.today >= d.ps)) return ['In progress', 'prog'];
  return ['Not started', ''];
}
const GT_COLS = {
  plan: ['Plan', 122, d => (d.ps ? (d.single || d.ps === d.pe ? gtMD(d.pe) : `${gtMD(d.ps)} – ${gtMD(d.pe)}`) : '')],
  planStart: ['Start planned', 96, d => (d.ps ? gtMD(d.ps) : '')],
  planEnd: ['End planned', 96, d => (d.pe ? gtMD(d.pe) : '')],
  actualStart: ['Start actual', 96, d => (d.as ? gtMD(d.as) : '')],
  actualEnd: ['End actual', 96, d => (d.ae ? gtMD(d.ae) : d.as ? 'ongoing' : '')],
  planDays: ['Planned days', 86, d => (d.ps ? dayDiff(d.pe, d.ps) + 1 : '')],
  actualDays: ['Actual days', 86, d => (d.as ? dayDiff(d.ae || d.today, d.as) + 1 : '')],
  progress: ['Progress', 76, d => { const p = gtPct(d); return p == null ? '' : p + '%'; }],
  variance: ['Variance', 82, d => { if (!d.pe) return ''; if (d.done && d.ae) return gtSigned(dayDiff(d.ae, d.pe)); return d.today > d.pe ? gtSigned(dayDiff(d.today, d.pe)) : ''; }],
  status: ['Status', 116, d => gtStatus(d)[0]],
};
const GT_COL_IDS = Object.keys(GT_COLS);
const gtCols = () => { const g = S.settings.gantt; return (Array.isArray(g.cols) ? g.cols : []).filter(k => GT_COLS[k]); };
const gtColsW = () => gtCols().reduce((n, k) => n + GT_COLS[k][1], 0);
function gtSetCols(cols) { const g = S.settings.gantt; g.cols = cols; g.nameW = Math.max(g.nameW || 290, 190 + gtColsW()); save(); }

function openGtCols() {
  const draw = () => {
    const on = gtCols(), rest = GT_COL_IDS.filter(k => !on.includes(k)), g = S.settings.gantt;
    return `<h3>Table columns</h3><p class="hint">Tick the columns to show; the order here is the order in the table. You can also drag a column heading sideways.</p>
<div class="vlist">${[...on, ...rest].map((k, i) => `<div class="vrow"><label><input type="checkbox" data-gc="${k}"${on.includes(k) ? ' checked' : ''}> ${esc(GT_COLS[k][0])}</label><span>${on.includes(k) ? `<button class="ib sm" data-gm="${k}" data-d="-1"${i ? '' : ' disabled'} title="Move left">${ic('up', 14)}</button><button class="ib sm" data-gm="${k}" data-d="1"${i < on.length - 1 ? '' : ' disabled'} title="Move right">${ic('down', 14)}</button>` : ''}</span></div>`).join('')}</div>
<div class="mrow"><label class="chkl"><input type="checkbox" data-gx="hatch"${g.hatch !== false ? ' checked' : ''}> Striped actual bars</label><label class="chkl"><input type="checkbox" data-gx="progress"${g.progress !== false ? ' checked' : ''}> Open tasks as progress bar</label></div>
<div class="mrow"><button data-gq="all">Show all</button><button data-gq="reset">Reset</button><button data-gq="none">Hide all</button></div><div class="mact"><button class="pri" data-gq="ok">Done</button></div>`;
  };
  openModal(draw(), m => {
    const redraw = () => { m.querySelector('.mbox').innerHTML = draw(); };
    m.onchange = e => {
      const el = e.target, g = S.settings.gantt;
      if (el.dataset.gc) { const on = gtCols(); gtSetCols(el.checked ? [...on, el.dataset.gc] : on.filter(k => k !== el.dataset.gc)); redraw(); }
      else if (el.dataset.gx) { g[el.dataset.gx] = el.checked; save(); }
    };
    m.onclick = e => {
      const mv = e.target.closest('[data-gm]'), q = e.target.closest('[data-gq]');
      if (mv) { const on = gtCols(), i = on.indexOf(mv.dataset.gm), j = i + +mv.dataset.d; if (j >= 0 && j < on.length) { [on[i], on[j]] = [on[j], on[i]]; gtSetCols(on); redraw(); } return; }
      if (q) { const a = q.dataset.gq; if (a === 'ok') { closeModal(); renderMain(); } else { gtSetCols(a === 'all' ? [...GT_COL_IDS] : a === 'none' ? [] : ['plan']); redraw(); } return; }
      if (e.target.classList.contains('mback')) { closeModal(); renderMain(); }
    };
  });
}

/* ---------- zoom ---------- */
function gtZoom(dir) {
  const g = S.settings.gantt, i = GT_ZOOM.reduce((b, z, k) => (Math.abs(z - g.zoom) < Math.abs(GT_ZOOM[b] - g.zoom) ? k : b), 0);
  const n = Math.max(0, Math.min(GT_ZOOM.length - 1, i + dir)); if (n === i) return;
  gtKeepCenter(); g.zoom = GT_ZOOM[n]; save(); renderMain();
}
function gtFit() {
  const w = $('.gt-wrap'), m = U.gMeta; if (!w || !m) return;
  const g = S.settings.gantt, avail = w.clientWidth - (g.nameW || 290) - 40;
  gtKeepCenter(); g.zoom = Math.max(0.1, Math.min(4, avail / (m.span * (GT_PPD[g.scale] || 14)))); save(); renderMain();
  U.gAnchor = null; const nw = $('.gt-wrap'); if (nw) nw.scrollLeft = 0;
}
function gtKeepCenter() {
  const w = $('.gt-wrap'), m = U.gMeta; if (!w || !m) return;
  const nameW = S.settings.gantt.nameW || 290, cx = (w.scrollLeft + nameW + w.clientWidth) / 2 - nameW;
  U.gAnchor = ymd(addDays(pYmd(m.min), Math.round(cx / m.ppd)));
}

/* ---------- the page ---------- */
function renderGantt() {
  if (U.gpane === 'og' && window.OG_UPSTREAM) { renderGanttUpstream(); return; }
  U.gpane = 'tasks';
  const g = S.settings.gantt, ppd = (GT_PPD[g.scale] || 14) * (g.zoom || 1), td = todayStr(), cols = gtCols(), nameW = Math.max(170, g.nameW || 290), tbl = g.table !== false;
  if (U.gList !== 'all' && !S.lists.some(l => l.id === U.gList)) U.gList = 'all';
  const rows = ganttRows(U.gList), D = rows.map(r => (r.k === 'task' ? ganttDates(r.t, true) : r.k === 'sub' ? ganttDates(r.s, false) : null));
  U.gRows = rows; U.gD = D;
  const all = D.filter(Boolean).flatMap(d => [d.ps, d.pe, d.as, d.ae || (d.open ? td : null)]).filter(Boolean).concat([td]);
  const undatedL = S.tasks.filter(t => (U.gList === 'all' || t.listId === U.gList) && !t.deleted && t.status === 'open' && !ogDated(t) && !t.log && !t.slotId);
  const seg = window.OG_UPSTREAM ? `<div class="seg"><button class="on" data-act="gpane" data-p="tasks">Tasks</button><button data-act="gpane" data-p="og" title="The OpenGantt app itself">OpenGantt</button></div>` : '';
  const tools = `${seg}<select data-gs="list" title="List">${opts([['all', 'All lists'], ...S.lists.map(l => [l.id, l.name])], U.gList)}</select><select data-gs="scale" title="Scale">${opts([['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']], g.scale)}</select><select data-gs="mode" title="Show">${opts([['both', 'Plan + actual'], ['plan', 'Plan'], ['actual', 'Actual']], g.mode)}</select>`
    + `<div class="seg gt-zoom"><button data-act="gzoom" data-d="-1" title="Zoom out (Ctrl + scroll)">${ic('zoom-out', 16)}</button><button data-act="gfit" title="Fit everything in view">${ic('fit', 16)}</button><button data-act="gzoom" data-d="1" title="Zoom in (Ctrl + scroll)">${ic('zoom-in', 16)}</button></div>`
    + `<button class="ib" data-act="gtoday" title="Scroll to today">${ic('calendar')}</button><button class="ib${tbl ? ' on' : ''}" data-act="gtable" title="Show / hide the table">${ic('table')}</button><button class="ib" data-act="gcols" title="Table columns">${ic('columns')}</button><button class="ib" data-act="gexp" data-v="0" title="Expand all">${ic('expand')}</button><button class="ib" data-act="gexp" data-v="1" title="Collapse all">${ic('collapse')}</button>`
    + `<button class="ib${g.tray ? ' on' : ''}" data-act="uitoggle" data-k="gtray" title="Unscheduled tasks panel">${ic('list')}</button>`
    + `${U.gList !== 'all' ? `<button class="btn${OG.links[U.gList] ? ' on' : ''}" data-act="ogopen" data-list="${esc(U.gList)}" title="Link, import or export an OpenGantt chart">${ic('link', 16)} OpenGantt</button>` : ''}`;
  const old = $('.gt-wrap'), keep = old && !U.gScrollReset ? [old.scrollLeft, old.scrollTop] : null; U.gScrollReset = false;
  const trayHtml = g.tray ? `<aside class="gt-tray"><div class="rs rs-l" data-rs="gtray" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize · double-click to reset"></div><div class="trh"><b>Unscheduled</b><small>${undatedL.length}</small><button class="ib sm" data-act="uitoggle" data-k="gtray" title="Hide this panel">${ic('x', 14)}</button></div><div class="trl">${undatedL.slice(0, 120).map(t => `<div class="tri p${t.priority}${U.sel === t.id ? ' sel' : ''}" draggable="true" data-act="open" data-id="${t.id}"><div class="ttl">${titleHtml(t)}</div>${U.gList === 'all' ? `<div class="meta"><span class="ln"><i style="background:${listOf(t.listId).color}"></i>${esc(listOf(t.listId).name)}</span></div>` : ''}</div>`).join('') || '<p class="hint">Every open task has a date.</p>'}</div><p class="hint">Drag a task onto the timeline to schedule it.</p></aside>` : '';
  if (!rows.some(r => r.k !== 'list')) {
    $('#main').innerHTML = topHtml('Gantt', tools) + `<div class="gt-body"><div class="empty">${ic('table', 44)}<p>No tasks with dates yet.<br>Give a task a start or due date (task details → “Gantt dates”), drag one from the panel, or import an OpenGantt chart.</p>${U.gList === 'all' ? '' : `<button class="btn" data-act="ogopen" data-list="${esc(U.gList)}">Import / link a chart</button>`}</div>${trayHtml}</div>`;
    return;
  }
  const min = addDays(pYmd(all.reduce((a, b) => (a < b ? a : b))), -3), max = addDays(pYmd(all.reduce((a, b) => (a > b ? a : b))), 10), span = dayDiff(ymd(max), ymd(min)) + 1, W = Math.round(span * ppd);
  U.gMeta = { min: ymd(min), span, ppd };
  const X = d => dayDiff(d, ymd(min)) * ppd, ws = +S.settings.weekStart;
  // header: months (or years) on top, days / weeks / months below
  let top = '', sub = '';
  for (let i = 0; i < span; i++) {
    const d = addDays(min, i), x = Math.round(i * ppd);
    if (g.scale === 'month' || g.scale === 'year') {
      if (d.getDate() === 1 || i === 0) { sub += `<span style="left:${x}px">${ppd * 30 < 36 ? MONTHS[d.getMonth()][0] : MONTHS[d.getMonth()].slice(0, 3)}</span>`; if (d.getMonth() === 0 || i === 0) top += `<span style="left:${x}px">${d.getFullYear()}</span>`; }
    } else {
      const left = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
      if (d.getDate() === 1 || (i === 0 && left * ppd >= 130)) top += `<span style="left:${x}px">${MONTHS[d.getMonth()]} ${d.getFullYear()}</span>`;
      if (g.scale === 'day') sub += `<span class="${d.getDay() === 0 || d.getDay() === 6 ? 'we' : ''}" style="left:${x}px;width:${Math.round(ppd)}px">${ppd >= 14 ? d.getDate() : ''}</span>`;
      else if (d.getDay() === ws) sub += `<span style="left:${x}px">${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}</span>`;
    }
  }
  const tX = Math.round(X(td)), bg = g.scale === 'day' ? `background-size:${ppd}px 100%` : g.scale === 'week' ? `background-size:${7 * ppd}px 100%;background-position:${(((ws - min.getDay()) + 7) % 7) * ppd}px 0` : 'background-image:none';
  const colHtml = (fn, cls = '') => cols.map(k => `<span class="gt-c ${cls}" style="width:${GT_COLS[k][1]}px">${fn(k)}</span>`).join('');
  const body = rows.map((r, i) => {
    if (r.k === 'list') return `<div class="gt-r gt-l"><div class="gt-n"><i style="background:${r.l.color}"></i><b>${esc(r.l.name)}</b></div><div class="gt-t" style="width:${W}px"></div></div>`;
    const isT = r.k === 'task', x = isT ? r.t : r.s, d = D[i], id = isT ? r.t.id : r.pid, key = isT ? r.t.id : r.s.id, pct = d.open ? gtPct(d) : null;
    const tip = esc(`${x.title}\nPlan: ${d.ps ? (d.single ? d.pe : d.ps + ' → ' + d.pe) : '—'}\nActual: ${d.as ? d.as + (d.ae ? ' → ' + d.ae : ' → ongoing') : '—'}${gtStatus(d)[0] ? '\n' + gtStatus(d)[0] : ''}`);
    const hl = '<b class="gh l" data-h="l"></b>', hr = '<b class="gh r" data-h="r"></b>';
    let bars = '';
    if (g.mode !== 'actual' && d.ps) bars += d.single ? `<i class="gt-ms" data-r="${i}" data-p="plan" style="left:${Math.round(X(d.pe) + ppd / 2 - 7)}px;--c:${r.c}"></i>` : `<i class="gt-bp" data-r="${i}" data-p="plan" style="left:${Math.round(X(d.ps))}px;width:${Math.round((dayDiff(d.pe, d.ps) + 1) * ppd)}px;--c:${r.c}">${hl}${hr}</i>`;
    if (g.mode !== 'plan' && d.as) {
      const end = d.ae || td, w = Math.round(Math.max(1, dayDiff(end, d.as) + 1) * ppd), live = d.open && g.progress !== false;
      bars += live ? `<i class="gt-bo" data-r="${i}" data-p="act" style="left:${Math.round(X(d.as))}px;width:${w}px;--c:${r.c}">${hl}${pct != null && w > 30 ? pct + '%' : ''}</i>` : `<i class="gt-ba${g.hatch === false ? ' solid' : ''}" data-r="${i}" data-p="act" style="left:${Math.round(X(d.as))}px;width:${w}px;--c:${r.c}">${hl}</i>`;
    }
    const st = gtStatus(d);
    return `<div class="gt-r${r.k === 'sub' ? ' gt-s' : ''}${isT && U.sel === r.t.id ? ' sel' : ''}${d.done ? ' fin' : ''}" data-act="open" data-id="${id}" title="${tip}"><div class="gt-n" style="padding-left:${10 + (r.lv || 0) * 16}px">${r.kids ? `<button class="ib sm" data-act="gtog" data-key="${key}">${ic(U.gcol.has(key) ? 'right' : 'down', 14)}</button>` : '<span class="gt-sp"></span>'}<span class="gt-tt">${isT ? titleHtml(r.t) : esc(r.s.title)}</span>${colHtml(k => (k === 'status' ? `<em class="st ${st[1]}">${esc(st[0])}</em>` : esc(String(GT_COLS[k][2](d)))))}</div><div class="gt-t" style="width:${W}px;${bg}">${bars}<u style="left:${tX}px"></u></div></div>`;
  }).join('');
  const heads = cols.map(k => `<span class="gt-c gt-ch" draggable="true" data-gcol="${k}" style="width:${GT_COLS[k][1]}px" title="Drag to reorder">${esc(GT_COLS[k][0])}</span>`).join('');
  $('#main').innerHTML = topHtml('Gantt', tools)
    + `<div class="gt-body"><div class="gt-wrap${tbl ? '' : ' tbl-off'}" style="--gn:${tbl ? nameW : 30}px"><div class="gt-in" data-w="${W}" style="width:calc(var(--gn) + ${W}px)"><div class="gt-h"><div class="gt-n gt-hn"><span class="gt-tt">Task</span>${heads}<i class="rs rs-r" data-rs="gname" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize the table · double-click to reset"></i></div><div class="gt-t gt-ht" style="width:${W}px"><div class="gt-h1">${top}</div><div class="gt-h2">${sub}</div><u style="left:${tX}px"></u></div></div>${body}</div></div>${trayHtml}</div>`
    + `<div class="gt-foot hint">${U.gList !== 'all' && OG.links[U.gList] ? `<span id="ogstate">${ogStateHtml(U.gList)}</span>` : 'Drag a bar to move it, pull its edges to change the dates, or pull the left edge of an actual bar. Bars follow OpenGantt: plan, actual (striped), and open tasks as a progress bar up to today.'}</div>`;
  const wrap = $('.gt-wrap');
  if (wrap) {
    if (U.gAnchor) { const a = U.gAnchor; U.gAnchor = null; wrap.scrollLeft = Math.max(0, 2 * X(a) + nameW - wrap.clientWidth); if (keep) wrap.scrollTop = keep[1]; }
    else if (keep) { wrap.scrollLeft = keep[0]; wrap.scrollTop = keep[1]; } else wrap.scrollLeft = Math.max(0, tX - 220);
  }
}

/* ---------- drag bars: move / resize the plan, pull the actual's start ---------- */
const gtShift = (d, n) => ymd(addDays(pYmd(d), n));
function gtApply(row, p, mode, dd, d) {
  const x = row.k === 'task' ? row.t : row.s;
  if (p === 'act') { const na = gtShift(d.as, dd); x.astart = d.ae && na > d.ae ? d.ae : na; return; }
  if (d.single) { const f = x.start && !x.due ? 'start' : 'due'; x[f] = gtShift(f === 'start' ? d.ps : d.pe, dd); return; }
  if (mode === 'move') { x.start = gtShift(d.ps, dd); x.due = gtShift(d.pe, dd); }
  else if (mode === 'l') { const n = gtShift(d.ps, dd); x.start = n > d.pe ? d.pe : n; }
  else { const n = gtShift(d.pe, dd); x.due = n < d.ps ? d.ps : n; }
}
document.addEventListener('pointerdown', e => {
  const bar = e.target.closest && e.target.closest('.gt-bp,.gt-ms,.gt-ba,.gt-bo'); if (!bar || e.button > 0) return;
  const row = U.gRows[+bar.dataset.r], d = U.gD && U.gD[+bar.dataset.r], m = U.gMeta; if (!row || !d || !m) return;
  const p = bar.dataset.p, hd = e.target.dataset && e.target.dataset.h, mode = p === 'act' ? (hd === 'l' ? 'l' : null) : (d.single ? 'move' : hd || 'move');
  if (!mode) return; // an actual bar is only dragged by its left edge; a click still opens the task
  e.stopPropagation();
  const x0 = e.clientX, left0 = parseFloat(bar.style.left), w0 = parseFloat(bar.style.width) || 14, ppd = m.ppd;
  let dd = 0, on = false, tip = null;
  if (bar.setPointerCapture) { try { bar.setPointerCapture(e.pointerId); } catch (_) { /* synthetic event */ } }
  const label = () => {
    let s = d.ps, en = d.pe;
    if (p === 'act') { s = gtShift(d.as, dd); en = d.ae || d.today; } else if (d.single) { s = en = gtShift(d.pe, dd); }
    else { if (mode !== 'r') s = gtShift(d.ps, dd); if (mode !== 'l') en = gtShift(d.pe, dd); if (mode === 'l' && s > d.pe) s = d.pe; if (mode === 'r' && en < d.ps) en = d.ps; }
    return s === en ? gtMD(s) : `${gtMD(s)} → ${gtMD(en)} · ${dayDiff(en, s) + 1} d`;
  };
  const mv = ev => {
    if (!on && Math.abs(ev.clientX - x0) < 4) return;
    if (!on) { on = true; document.body.classList.add('gtdrag'); bar.classList.add('dragging'); tip = document.createElement('div'); tip.className = 'gt-tip'; document.body.appendChild(tip); }
    dd = Math.round((ev.clientX - x0) / ppd);
    const lim = d.single || p === 'act' ? Infinity : Math.round(w0 / ppd) - 1;
    if (!d.single && mode === 'l') dd = Math.min(dd, lim); if (!d.single && mode === 'r') dd = Math.max(dd, -lim);
    if (d.single) bar.style.left = (left0 + dd * ppd) + 'px';
    else if (p === 'act') { bar.style.left = (left0 + dd * ppd) + 'px'; bar.style.width = Math.max(ppd, w0 - dd * ppd) + 'px'; }
    else if (mode === 'move') bar.style.left = (left0 + dd * ppd) + 'px';
    else if (mode === 'l') { bar.style.left = (left0 + dd * ppd) + 'px'; bar.style.width = (w0 - dd * ppd) + 'px'; }
    else bar.style.width = (w0 + dd * ppd) + 'px';
    tip.textContent = label(); tip.style.left = ev.clientX + 14 + 'px'; tip.style.top = ev.clientY + 16 + 'px';
  };
  const up = () => {
    bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
    document.body.classList.remove('gtdrag'); if (tip) tip.remove();
    if (!on) return;
    U.suppress = Date.now();
    if (dd) { gtApply(row, p, mode, dd, d); save(); }
    renderMain(); if (U.sel) renderDetail();
  };
  bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
});

// Ctrl + scroll zooms the timeline
document.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey) || U.page !== 'gantt' || !(e.target.closest && e.target.closest('.gt-wrap'))) return;
  e.preventDefault(); const now = Date.now(); if (U.gWheel && now - U.gWheel < 120) return; U.gWheel = now; gtZoom(e.deltaY < 0 ? 1 : -1);
}, { passive: false });

// reorder table columns by dragging their headings
document.addEventListener('dragstart', e => {
  const h = e.target.closest && e.target.closest('.gt-ch[data-gcol]'); if (!h) return;
  U.gcdrag = h.dataset.gcol; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'col:' + U.gcdrag);
});
document.addEventListener('dragover', e => { const h = U.gcdrag && e.target.closest && e.target.closest('.gt-ch[data-gcol]'); if (h) { e.preventDefault(); $$('.over').forEach(x => x.classList.remove('over')); h.classList.add('over'); } });
document.addEventListener('drop', e => {
  const h = U.gcdrag && e.target.closest && e.target.closest('.gt-ch[data-gcol]'); if (!h) return;
  e.preventDefault(); const on = gtCols(), a = on.indexOf(U.gcdrag), b = on.indexOf(h.dataset.gcol);
  if (a >= 0 && b >= 0 && a !== b) { on.splice(a, 1); on.splice(b, 0, U.gcdrag); S.settings.gantt.cols = on; save(); renderMain(); }
});
document.addEventListener('dragend', () => { U.gcdrag = null; });

// drop an unscheduled task on the timeline: it gets a one-day bar on that date
function gtDrop(e, el) {
  const t = getT(U.drag), m = U.gMeta; if (!t || !m) return false;
  const day = Math.max(0, Math.floor((e.clientX - el.getBoundingClientRect().left) / m.ppd)), d = gtShift(m.min, day);
  t.start = d; t.due = d; save(); refresh(); toast(`Scheduled “${t.title}” on ${gtMD(d)}`); return true;
}

/* ---------- the OpenGantt app itself ---------- */
function ogUpstreamYaml() {
  const id = U.gList === 'all' ? null : U.gList; if (!id) return null;
  const list = listOf(id);
  return { list, yaml: ogBuild(list, '').yaml };
}
function renderGanttUpstream() {
  const meta = window.OG_UPSTREAM || {}, picked = U.gList !== 'all';
  const tools = `<div class="seg"><button data-act="gpane" data-p="tasks">Tasks</button><button class="on" data-act="gpane" data-p="og">OpenGantt</button></div><select data-gs="list" title="List">${opts([['all', 'Pick a list…'], ...S.lists.map(l => [l.id, l.name])], U.gList)}</select>`
    + (picked ? `<button class="btn" data-act="ogsend" title="Replace the chart in OpenGantt with this list's tasks">${ic('refresh', 16)} Send tasks</button><button class="btn pri" data-act="ogpull" title="Bring the chart's changes back into this list">Apply to OpenTick</button><button class="ib" data-act="ogcopy" title="Copy the chart YAML">${ic('file-text')}</button>` : '');
  $('#main').innerHTML = topHtml('Gantt · OpenGantt', tools)
    + (picked ? `<div class="gt-body og-body"><iframe id="ogframe" class="og-frame" title="OpenGantt" src="${esc(meta.file || 'OpenGantt.html')}"></iframe></div>`
      : `<div class="gt-body"><div class="empty">${ic('gantt', 44)}<p>Pick a list above to open it in OpenGantt.</p></div></div>`)
    + `<div class="gt-foot hint">OpenGantt ${meta.sha ? `· upstream ${esc(String(meta.sha).slice(0, 7))}` : ''}${meta.fetched ? ` · fetched ${esc(String(meta.fetched).slice(0, 10))}` : ''}<span id="ogupd">${U.ogNewer ? ` · <b>newer upstream ${esc(U.ogNewer.slice(0, 7))}</b> — it ships with the next OpenTick build (or run <code>npm run sync:gantt</code>)` : ''}</span>. <b>Send tasks</b> puts this list in the editor; edit there, then <b>Apply to OpenTick</b> to bring the changes back.</div>`;
  ogCheckUpstream();
  const fr = $('#ogframe');
  if (fr) fr.addEventListener('load', () => setTimeout(() => ogSeedFrame(true), 150));
}
function ogFrameEditor() {
  const fr = $('#ogframe'); if (!fr || !fr.contentWindow) return null;
  try { const w = fr.contentWindow, ta = w.document.querySelector('textarea'); return ta ? { w, ta } : null; } catch (e) { return null; }
}
function ogSeedFrame(quiet) {
  const y = ogUpstreamYaml(); if (!y) return;
  const ed = ogFrameEditor();
  if (!ed) { if (!quiet) { try { navigator.clipboard.writeText(y.yaml); } catch (e) { /* ignore */ } toast('Could not reach the editor — the chart YAML is copied, paste it in'); } return; }
  ed.ta.value = y.yaml; ed.ta.dispatchEvent(new ed.w.Event('input', { bubbles: true }));
  if (!quiet) toast('Sent “' + y.list.name + '” to OpenGantt');
}
function ogPullFrame() {
  const ed = ogFrameEditor(), y = ogUpstreamYaml(); if (!y) return;
  if (!ed) { toast('Could not read the OpenGantt editor — use Link to a file instead'); return; }
  try { const r = ogImportText(ed.ta.value, 'chart.yaml', y.list.id); refresh(); toast(`Applied: ${r.added} new, ${r.pulled} updated`); } catch (e) { toast('Could not apply: ' + (e.message || e)); }
}

// once per session, say so when GitHub has a newer OpenGantt than the copy this build carries
async function ogCheckUpstream() {
  const m = window.OG_UPSTREAM; if (!m || !m.sha || U.ogChecked || typeof fetch !== 'function') return; U.ogChecked = true;
  try {
    const r = await fetch('https://api.github.com/repos/JebbyCodes/OpenGantt/commits/main', { headers: { accept: 'application/vnd.github+json' } });
    if (!r.ok) return; const j = await r.json();
    if (j.sha && j.sha !== m.sha) { U.ogNewer = j.sha; const el = $('#ogupd'); if (el) el.innerHTML = ` · <b>newer upstream ${esc(j.sha.slice(0, 7))}</b> — it ships with the next OpenTick build (or run <code>npm run sync:gantt</code>)`; }
  } catch (e) { /* offline or rate limited: stay quiet */ }
}
