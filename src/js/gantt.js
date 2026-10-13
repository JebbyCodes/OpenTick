/* ---------- Gantt page ----------
   OpenTick's own renderer draws tasks the OpenGantt way (plan bar, striped actual, open-task progress bar, the same table
   columns, custom columns from extra chart keys) and lets you edit by dragging: move a plan bar, pull its edges, pull the
   actual's left edge, drag an undated task from the tray onto the timeline. It also does what the OpenGantt app does around
   the chart: a YAML editor, open / save / copy as an Obsidian block, print, PNG / SVG / CSV export, full screen, a legend
   toggle, a column menu on every heading and a hover card with the details. */
const GT_PPD = { day: 30, week: 14, month: 5, year: 1.7 }, GT_ROW = 30;
const GT_ZOOM = [0.35, 0.5, 0.7, 1, 1.4, 2, 3];
U.gList = 'all'; U.gcol = new Set(); U.ogList = null; U.gRows = []; U.gMeta = null; U.gYaml = false;

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
  actual: ['Actual', 122, d => (d.as ? (d.ae ? (d.as === d.ae ? gtMD(d.ae) : `${gtMD(d.as)} – ${gtMD(d.ae)}`) : `${gtMD(d.as)} – …`) : '')],
  actualStart: ['Start actual', 96, d => (d.as ? gtMD(d.as) : '')],
  actualEnd: ['End actual', 96, d => (d.ae ? gtMD(d.ae) : d.as ? 'ongoing' : '')],
  planDays: ['Planned days', 86, d => (d.ps ? dayDiff(d.pe, d.ps) + 1 : '')],
  actualDays: ['Actual days', 86, d => (d.as ? dayDiff(d.ae || d.today, d.as) + 1 : '')],
  progress: ['Progress', 76, d => { const p = gtPct(d); return p == null ? '' : p + '%'; }],
  variance: ['Variance', 82, d => { if (!d.pe) return ''; if (d.done && d.ae) return gtSigned(dayDiff(d.ae, d.pe)); return d.today > d.pe ? gtSigned(dayDiff(d.today, d.pe)) : ''; }],
  status: ['Status', 116, d => gtStatus(d)[0]],
  notes: ['Notes', 200, (d, x) => mdPlain(String((x && x.notes) || '').replace(/\n+/g, ' ')).slice(0, 140)],
  priority: ['Priority', 78, (d, x) => (x && x.priority ? PRIO[x.priority] : '')],
  tags: ['Tags', 120, (d, x) => ((x && x.tags) || []).map(g => '#' + g).join(' ')],
};
// any extra key of a chart row (kept on the task as `gx`) is a column of its own: "x:owner", "x:cost"…
const gtHuman = k => String(k).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const gtShow = v => (v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v));
const gtCol = k => GT_COLS[k] || (String(k).startsWith('x:') ? [gtHuman(k.slice(2)), 120, (d, x) => gtShow(x && x.gx ? x.gx[k.slice(2)] : '')] : null);
function gtCustomKeys() {
  const out = new Set(), walk = x => { if (x.gx) Object.keys(x.gx).forEach(k => out.add('x:' + k)); (x.children || x.subtasks || []).forEach(walk); };
  S.tasks.filter(t => !t.deleted && !t.log).forEach(walk); return [...out].sort();
}
const gtAllCols = () => [...Object.keys(GT_COLS), ...gtCustomKeys()];
const gtCols = () => { const g = S.settings.gantt; return (Array.isArray(g.cols) ? g.cols : []).filter(k => gtCol(k)); };
const gtColsW = () => gtCols().reduce((n, k) => n + gtCol(k)[1], 0);
function gtSetCols(cols) { const g = S.settings.gantt; g.cols = cols; g.nameW = Math.max(g.nameW || 290, 190 + gtColsW()); save(); }

function openGtCols() {
  const draw = () => {
    const on = gtCols(), rest = gtAllCols().filter(k => !on.includes(k)), g = S.settings.gantt;
    return `<h3>Table columns</h3><p class="hint">Tick the columns to show; the order here is the order in the table. You can also drag a column heading sideways.</p>
<div class="vlist">${[...on, ...rest].map((k, i) => `<div class="vrow"><label><input type="checkbox" data-gc="${k}"${on.includes(k) ? ' checked' : ''}> ${esc(gtCol(k)[0])}</label><span>${on.includes(k) ? `<button class="ib sm" data-gm="${k}" data-d="-1"${i ? '' : ' disabled'} title="Move left">${ic('up', 14)}</button><button class="ib sm" data-gm="${k}" data-d="1"${i < on.length - 1 ? '' : ' disabled'} title="Move right">${ic('down', 14)}</button>` : ''}</span></div>`).join('')}</div>
<div class="mrow"><label class="chkl"><input type="checkbox" data-gx="hatch"${g.hatch !== false ? ' checked' : ''}> Striped actual bars</label><label class="chkl"><input type="checkbox" data-gx="progress"${g.progress !== false ? ' checked' : ''}> Open tasks as progress bar</label></div>
<div class="mrow"><label class="chkl"><input type="checkbox" data-gx="lanes"${g.lanes !== false ? ' checked' : ''}> Plan and actual on separate lanes</label></div>
<div class="mrow"><button data-gq="pva">Plan vs actual</button><button data-gq="all">Show all</button><button data-gq="reset">Reset</button><button data-gq="none">Hide all</button></div><div class="mact"><button class="pri" data-gq="ok">Done</button></div>`;
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
      if (q) { const a = q.dataset.gq; if (a === 'ok') { closeModal(); renderMain(); } else { gtSetCols(a === 'all' ? gtAllCols() : a === 'none' ? [] : a === 'pva' ? ['planStart', 'planEnd', 'actualStart', 'actualEnd', 'variance', 'status'] : ['plan', 'actual']); redraw(); } return; }
      if (e.target.classList.contains('mback')) { closeModal(); renderMain(); }
    };
  });
}

/* ---------- zoom ---------- */
const gtNameW = () => { const g = S.settings.gantt; return g.table === false ? 30 : narrow(700) ? 132 : Math.max(170, g.nameW || 290, 190 + gtColsW()); };
const gtTrayOn = () => (narrow(820) ? !!U.gTrayM : !!S.settings.gantt.tray);
function gtZoom(dir) {
  const g = S.settings.gantt, i = GT_ZOOM.reduce((b, z, k) => (Math.abs(z - g.zoom) < Math.abs(GT_ZOOM[b] - g.zoom) ? k : b), 0);
  const n = Math.max(0, Math.min(GT_ZOOM.length - 1, i + dir)); if (n === i) return;
  gtKeepCenter(); g.zoom = GT_ZOOM[n]; save(); renderMain();
}
function gtFit() {
  const w = $('.gt-wrap'), m = U.gMeta; if (!w || !m) return;
  const g = S.settings.gantt, avail = w.clientWidth - gtNameW() - 40;
  gtKeepCenter(); g.zoom = Math.max(0.1, Math.min(4, avail / (m.span * (GT_PPD[g.scale] || 14)))); save(); renderMain();
  U.gAnchor = null; const nw = $('.gt-wrap'); if (nw) nw.scrollLeft = 0;
}
function gtKeepCenter() {
  const w = $('.gt-wrap'), m = U.gMeta; if (!w || !m) return;
  const nameW = gtNameW(), cx = (w.scrollLeft + nameW + w.clientWidth) / 2 - nameW;
  U.gAnchor = ymd(addDays(pYmd(m.min), Math.round(cx / m.ppd)));
}

/* ---------- the page ---------- */
function renderGantt() {
  const g = S.settings.gantt, ppd = (GT_PPD[g.scale] || 14) * (g.zoom || 1), td = todayStr(), phone = narrow(700), cols = phone ? [] : gtCols(), nameW = gtNameW(), tbl = g.table !== false, lanes = g.mode === 'both' && g.lanes !== false;
  if (U.gList !== 'all' && !S.lists.some(l => l.id === U.gList)) U.gList = 'all';
  const rows = ganttRows(U.gList), D = rows.map(r => (r.k === 'task' ? ganttDates(r.t, true) : r.k === 'sub' ? ganttDates(r.s, false) : null));
  U.gRows = rows; U.gD = D;
  const all = D.filter(Boolean).flatMap(d => [d.ps, d.pe, d.as, d.ae || (d.open ? td : null)]).filter(Boolean).concat([td]);
  const undatedL = S.tasks.filter(t => (U.gList === 'all' || t.listId === U.gList) && !t.deleted && t.status === 'open' && !ogDated(t) && !t.log && !t.slotId);
  const tools = `<select data-gs="list" title="List">${opts([['all', 'All lists'], ...S.lists.map(l => [l.id, l.name])], U.gList)}</select><select data-gs="scale" title="Scale">${opts([['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']], g.scale)}</select><select data-gs="mode" title="Show">${opts([['both', 'Plan + actual'], ['plan', 'Plan'], ['actual', 'Actual']], g.mode)}</select>`
    + `<div class="seg gt-zoom"><button data-act="gzoom" data-d="-1" title="Zoom out (Ctrl + scroll)">${ic('zoom-out', 16)}</button><button data-act="gfit" title="Fit everything in view">${ic('fit', 16)}</button><button data-act="gzoom" data-d="1" title="Zoom in (Ctrl + scroll)">${ic('zoom-in', 16)}</button></div>`
    + `<button class="ib" data-act="gtoday" title="Scroll to today">${ic('calendar')}</button><button class="ib${tbl ? ' on' : ''}" data-act="gtable" title="Show / hide the table">${ic('table')}</button><button class="ib" data-act="gcols" title="Table columns">${ic('columns')}</button><button class="ib" data-act="gexp" data-v="0" title="Expand all">${ic('expand')}</button><button class="ib" data-act="gexp" data-v="1" title="Collapse all">${ic('collapse')}</button>`
    + `<button class="ib${gtTrayOn() ? ' on' : ''}" data-act="uitoggle" data-k="gtray" title="Unscheduled tasks panel">${ic('list')}</button>`
    + `<button class="ib${U.gYaml ? ' on' : ''}" data-act="gyaml" title="YAML editor: the chart as text">${ic('code')}</button><button class="ib" data-act="gexport" title="Print or export (PNG, SVG, CSV)">${ic('download')}</button><button class="ib${U.gFull ? ' on' : ''}" data-act="gfull" title="Full screen">${ic('focus')}</button><button class="ib" data-act="gmenu" title="More: open, save, link a file, legend, reset">${ic('more')}</button>`;
  const old = $('.gt-wrap'), keep = old && !U.gScrollReset ? [old.scrollLeft, old.scrollTop] : null; U.gScrollReset = false;
  const trayHtml = gtTrayOn() && !U.gYaml ? `<aside class="gt-tray"><div class="rs rs-l" data-rs="gtray" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize · double-click to reset"></div><div class="trh"><b>Unscheduled</b><small>${undatedL.length}</small><button class="ib sm" data-act="uitoggle" data-k="gtray" title="Hide this panel">${ic('x', 14)}</button></div><div class="trl">${undatedL.slice(0, 120).map(t => `<div class="tri p${t.priority}${U.sel === t.id ? ' sel' : ''}" draggable="true" data-act="open" data-id="${t.id}"><div class="ttl">${titleHtml(t)}</div>${U.gList === 'all' ? `<div class="meta"><span class="ln"><i style="background:${listOf(t.listId).color}"></i>${esc(listOf(t.listId).name)}</span></div>` : ''}</div>`).join('') || '<p class="hint">Every open task has a date.</p>'}</div><p class="hint">Drag a task onto the timeline to schedule it.</p></aside>` : '';
  if (!rows.some(r => r.k !== 'list')) {
    $('#main').innerHTML = topHtml('Gantt', tools) + `<div class="gt-body"><div class="empty">${ic('table', 44)}<p>No tasks with dates yet.<br>Give a task a start or due date (task details → “Gantt dates”), drag one from the panel, or open a chart file (⋯ menu).</p>${U.gList === 'all' ? '' : `<button class="btn" data-act="ogopen" data-list="${esc(U.gList)}">Import / link a chart</button>`}</div>${trayHtml}</div>`;
    return;
  }
  const min = addDays(pYmd(all.reduce((a, b) => (a < b ? a : b))), -3), max = addDays(pYmd(all.reduce((a, b) => (a > b ? a : b))), 10), span = dayDiff(ymd(max), ymd(min)) + 1, W = Math.round(span * ppd);
  U.gMeta = { min: ymd(min), span, ppd };
  U.gx = { rows, D, min: ymd(min), span, scale: g.scale };
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
  const colHtml = (fn, cls = '') => cols.map(k => `<span class="gt-c ${cls}" style="width:${gtCol(k)[1]}px">${fn(k)}</span>`).join('');
  const body = rows.map((r, i) => {
    if (r.k === 'list') return `<div class="gt-r gt-l"><div class="gt-n"><i style="background:${r.l.color}"></i><b>${esc(r.l.name)}</b></div><div class="gt-t" style="width:${W}px"></div></div>`;
    const isT = r.k === 'task', x = isT ? r.t : r.s, d = D[i], id = isT ? r.t.id : r.pid, key = isT ? r.t.id : r.s.id, pct = d.open ? gtPct(d) : null;
    const hl = '<b class="gh l" data-h="l"></b>', hr = '<b class="gh r" data-h="r"></b>';
    let bars = '', xr = 0;
    if (g.mode !== 'actual' && d.ps) {
      bars += d.single ? `<i class="gt-ms" data-r="${i}" data-p="plan" style="left:${Math.round(X(d.pe) + ppd / 2 - 7)}px;--c:${r.c}"></i>` : `<i class="gt-bp" data-r="${i}" data-p="plan" style="left:${Math.round(X(d.ps))}px;width:${Math.round((dayDiff(d.pe, d.ps) + 1) * ppd)}px;--c:${r.c}">${hl}${hr}</i>`;
      xr = Math.max(xr, X(d.pe) + ppd);
    }
    if (g.mode !== 'plan' && d.as) {
      const end = d.ae || td, w = Math.round(Math.max(1, dayDiff(end, d.as) + 1) * ppd), live = d.open && g.progress !== false;
      const ptxt = live && pct != null ? pct + '%' : '', inside = ptxt && w >= ptxt.length * 6 + 18; // short bars show the figure beside them instead of clipping it
      bars += live ? `<i class="gt-bo" data-r="${i}" data-p="act" style="left:${Math.round(X(d.as))}px;width:${w}px;--c:${r.c}">${hl}${inside ? `<span class="gt-pc">${ptxt}</span>` : ''}</i>${ptxt && !inside ? `<span class="gt-pco" style="left:${Math.round(X(d.as)) + w + 5}px">${ptxt}</span>` : ''}` : `<i class="gt-ba${g.hatch === false ? ' solid' : ''}" data-r="${i}" data-p="act" style="left:${Math.round(X(d.as))}px;width:${w}px;--c:${r.c}">${hl}${d.ae ? hr : ''}</i>`;
      xr = Math.max(xr, X(end) + ppd + (ptxt && !inside ? 34 : 0));
    }
    // overrun: the stretch after the planned end, for a task that finished late or is still open past its date
    const lateTo = d.ae || (!d.done && d.pe && d.today > d.pe ? d.today : null);
    if (g.mode !== 'plan' && d.pe && lateTo && lateTo > d.pe) { bars += `<i class="gt-ov" title="${dayDiff(lateTo, d.pe)} d over plan" style="left:${Math.round(X(d.pe) + ppd)}px;width:${Math.round(dayDiff(lateTo, d.pe) * ppd)}px"></i>`; xr = Math.max(xr, X(lateTo) + ppd); }
    if (g.table === false && xr) bars += `<span class="gt-lbl" style="left:${Math.round(xr) + 6}px">${isT ? titleHtml(r.t) : esc(r.s.title)}</span>`;
    const st = gtStatus(d);
    return `<div class="gt-r${r.k === 'sub' ? ' gt-s' : ''}${isT && U.sel === r.t.id ? ' sel' : ''}${d.done ? ' fin' : ''}" data-act="open" data-id="${id}" data-i="${i}"><div class="gt-n" style="padding-left:${10 + (r.lv || 0) * 16}px">${r.kids ? `<button class="ib sm" data-act="gtog" data-key="${key}">${ic(U.gcol.has(key) ? 'right' : 'down', 14)}</button>` : '<span class="gt-sp"></span>'}<span class="gt-tt">${isT ? titleHtml(r.t) : esc(r.s.title)}</span>${colHtml(k => (k === 'status' ? `<em class="st ${st[1]}">${esc(st[0])}</em>` : esc(String(gtCol(k)[2](d, x)))))}</div><div class="gt-t" style="width:${W}px;${bg}">${bars}<u style="left:${tX}px"></u></div></div>`;
  }).join('');
  const heads = cols.map(k => `<span class="gt-c gt-ch" draggable="true" data-gcol="${k}" style="width:${gtCol(k)[1]}px" title="Click for options · drag to reorder" data-act="gcolmenu">${esc(gtCol(k)[0])}</span>`).join('');
  $('#main').innerHTML = topHtml('Gantt', tools) + (g.legend === false ? '' : gtLegend(g, rows))
    + `<div class="gt-body">${gtYamlHtml()}<div class="gt-wrap${tbl ? '' : ' tbl-off'}${lanes ? ' lanes' : ''}" style="--gn:${tbl ? nameW : 30}px;--gr:${lanes ? 44 : 30}px"><div class="gt-in" data-w="${W}" style="width:calc(var(--gn) + ${W}px)"><div class="gt-h"><div class="gt-n gt-hn"><span class="gt-tt">Task</span>${heads}<i class="rs rs-r" data-rs="gname" role="separator" aria-orientation="vertical" tabindex="0" title="Drag to resize the table · double-click to reset"></i></div><div class="gt-t gt-ht" style="width:${W}px"><div class="gt-h1">${top}</div><div class="gt-h2">${sub}</div><u style="left:${tX}px"></u><em class="gt-tl" style="left:${tX}px">Today</em></div></div>${body}</div></div>${trayHtml}</div>`
    + `<div class="gt-foot hint">${gtSummary(D)}${U.gList !== 'all' && OG.links[U.gList] ? `<span id="ogstate">${ogStateHtml(U.gList)}</span>` : `<span class="gt-help">Drag a bar to move it, pull its edges to change the dates. Open a task to edit plan and actual dates.</span>`}</div>`;
  const wrap = $('.gt-wrap');
  if (wrap) {
    if (U.gAnchor) { const a = U.gAnchor; U.gAnchor = null; wrap.scrollLeft = Math.max(0, 2 * X(a) + nameW - wrap.clientWidth); if (keep) wrap.scrollTop = keep[1]; }
    else if (keep) { wrap.scrollLeft = keep[0]; wrap.scrollTop = keep[1]; } else wrap.scrollLeft = Math.max(0, tX - 220);
  }
}

// the key: what each kind of bar means (only what the current Plan / Actual setting can show)
function gtLegend(g, rows) {
  const item = (cls, label, tip) => `<span class="gl-i" title="${esc(tip || label)}"><i class="lg2 ${cls}"></i>${label}</span>`;
  const plan = g.mode !== 'actual', act = g.mode !== 'plan', lists = U.gList === 'all' ? S.lists.filter(l => rows.some(r => r.k === 'list' && r.l.id === l.id)) : [];
  return `<div class="gt-legend" role="group" aria-label="Chart key">`
    + (plan ? item('plan', 'Planned', 'Planned start to due date: drag to move, pull the edges to resize') + item('ms', 'One-day / milestone', 'A task with a single date') : '')
    + (act ? item('act', 'Actual (finished)', 'Striped: the days the work really took') + item('prog', 'In progress <em>%</em>', 'Dashed: started, not finished. The figure is how much of the plan has elapsed') + item('ov', 'Over plan', 'Red: time after the planned end') : '')
    + item('today', 'Today')
    + (lists.length ? `<span class="gl-i muted">Colour = list:</span>` + lists.map(l => `<span class="gl-i"><i class="gl-dot" style="background:${l.color}"></i>${esc(l.name)}</span>`).join('') : '')
    + `</div>`;
}
// one line of counts above the legend: how the visible tasks are doing
function gtSummary(D) {
  const c = { n: 0, prog: 0, over: 0, done: 0 };
  for (const d of D) { if (!d) continue; c.n++; const k = gtStatus(d)[1]; if (k === 'prog') c.prog++; else if (k === 'over') c.over++; else if (k === 'done' || k === 'late') c.done++; }
  return `<span class="gt-sum"><b>${c.n}</b> rows · <span class="st prog">${c.prog} in progress</span> <span class="st over">${c.over} overdue</span> <span class="st done">${c.done} done</span></span>`;
}
// the task details panel: planned and actual dates side by side, quick buttons, a mini chart and the numbers
function gtDetailHtml(t) {
  const d = ganttDates(t, true), st = gtStatus(d), done = t.status === 'done';
  const days = (a, b) => (a && b ? dayDiff(b, a) + 1 : null), pd = days(d.ps, d.pe), ad = d.as ? days(d.as, d.ae || d.today) : null;
  const vr = GT_COLS.variance[2](d), pct = gtPct(d);
  const lo = [d.ps, d.as].filter(Boolean).sort()[0], hi = [d.pe, d.ae || (d.as ? d.today : null)].filter(Boolean).sort().pop(), span = lo && hi ? dayDiff(hi, lo) + 1 : 0;
  const bar = (a, b, cls) => (a && b && span ? `<i class="gx-b ${cls}" style="left:${(dayDiff(a, lo) / span * 100).toFixed(2)}%;width:${Math.max(1.5, (dayDiff(b, a) + 1) / span * 100).toFixed(2)}%"></i>` : '');
  const late = d.pe && (d.ae || (!done && d.today > d.pe ? d.today : null)); const over = late && late > d.pe ? bar(gtShift(d.pe, 1), late, 'ov') : '';
  return `<details class="gtd gtx"${t.start || t.astart || done ? ' open' : ''}><summary>Plan &amp; actual (Gantt)</summary>
<div class="gx-grid"><div class="gx-col"><h5>Plan</h5><label class="gl">Start<input type="date" data-f="start" value="${t.start || ''}"></label><label class="gl">End <small>(due date)</small><input type="date" data-f="due" value="${t.due || ''}"></label></div>
<div class="gx-col"><h5>Actual</h5><label class="gl">Start<input type="date" data-f="astart" value="${t.astart || ''}"></label><label class="gl">End <small>(completed)</small><input type="date" data-f="aend" value="${done && d.ae ? d.ae : ''}"></label></div></div>
<div class="chips gx-btns"><button class="btn sm" data-act="gxstart"${t.astart === todayStr() ? ' disabled' : ''}>Started today</button><button class="btn sm" data-act="gxend"${done ? ' disabled' : ''}>Finished today</button><button class="btn sm" data-act="gxclear"${t.astart || done ? '' : ' disabled'}>Clear actual</button></div>
${span ? `<div class="gx-mini"><div class="gx-row"><span>Plan</span><div>${bar(d.ps, d.pe, 'plan')}</div></div><div class="gx-row"><span>Actual</span><div>${d.as ? bar(d.as, d.ae || d.today, d.open ? 'live' : 'act') : ''}${over}</div></div><div class="gx-ax"><small>${esc(gtMD(lo))}</small><small>${esc(gtMD(hi))}</small></div></div>` : ''}
<div class="gx-stats"><span class="st ${st[1]}">${esc(st[0])}</span>${pd ? `<span>${pd} d planned</span>` : ''}${ad ? `<span>${ad} d actual</span>` : ''}${vr ? `<span class="${vr[0] === '+' ? 'late' : ''}">${vr} vs plan</span>` : ''}${pct != null && !done ? `<span>${pct}% of plan elapsed</span>` : ''}</div>
<p class="hint">Setting an actual end completes the task; clearing it reopens it. The same dates appear in the Gantt view and in OpenGantt.</p></details>`;
}

/* ---------- drag bars: move / resize the plan, pull the actual's start or end ---------- */
const gtShift = (d, n) => ymd(addDays(pYmd(d), n));
function gtApply(row, p, mode, dd, d) {
  const x = row.k === 'task' ? row.t : row.s;
  if (p === 'act') {
    if (mode === 'r') { const ne = gtShift(d.ae, dd), end = ne < d.as ? d.as : ne; if (row.k === 'task') x.doneAt = ogNoon(end); else x.aend = end; return; } // pull the finish date
    const na = gtShift(d.as, dd); x.astart = d.ae && na > d.ae ? d.ae : na; return;
  }
  if (d.single) { const f = x.start && !x.due ? 'start' : 'due'; x[f] = gtShift(f === 'start' ? d.ps : d.pe, dd); return; }
  if (mode === 'move') { x.start = gtShift(d.ps, dd); x.due = gtShift(d.pe, dd); }
  else if (mode === 'l') { const n = gtShift(d.ps, dd); x.start = n > d.pe ? d.pe : n; }
  else { const n = gtShift(d.pe, dd); x.due = n < d.ps ? d.ps : n; }
}
document.addEventListener('pointerdown', e => {
  const bar = e.target.closest && e.target.closest('.gt-bp,.gt-ms,.gt-ba,.gt-bo'); if (!bar || e.button > 0) return;
  const row = U.gRows[+bar.dataset.r], d = U.gD && U.gD[+bar.dataset.r], m = U.gMeta; if (!row || !d || !m) return;
  const p = bar.dataset.p, hd = e.target.dataset && e.target.dataset.h, mode = p === 'act' ? (hd === 'l' ? 'l' : hd === 'r' && d.ae ? 'r' : null) : (d.single ? 'move' : hd || 'move');
  if (!mode) return; // an actual bar is only dragged by its edges; a click still opens the task
  e.stopPropagation();
  const x0 = e.clientX, left0 = parseFloat(bar.style.left), w0 = parseFloat(bar.style.width) || 14, ppd = m.ppd;
  let dd = 0, on = false, tip = null;
  if (bar.setPointerCapture) { try { bar.setPointerCapture(e.pointerId); } catch (_) { /* synthetic event */ } }
  const label = () => {
    let s = d.ps, en = d.pe;
    if (p === 'act') { s = mode === 'r' ? d.as : gtShift(d.as, dd); en = mode === 'r' ? gtShift(d.ae, dd) : d.ae || d.today; if (en < s) en = s; } else if (d.single) { s = en = gtShift(d.pe, dd); }
    else { if (mode !== 'r') s = gtShift(d.ps, dd); if (mode !== 'l') en = gtShift(d.pe, dd); if (mode === 'l' && s > d.pe) s = d.pe; if (mode === 'r' && en < d.ps) en = d.ps; }
    return s === en ? gtMD(s) : `${gtMD(s)} → ${gtMD(en)} · ${dayDiff(en, s) + 1} d`;
  };
  const mv = ev => {
    if (!on && Math.abs(ev.clientX - x0) < 4) return;
    if (!on) { on = true; document.body.classList.add('gtdrag'); bar.classList.add('dragging'); tip = document.createElement('div'); tip.className = 'gt-tip'; document.body.appendChild(tip); }
    dd = Math.round((ev.clientX - x0) / ppd);
    const lim = d.single || (p === 'act' && mode === 'l') ? Infinity : Math.round(w0 / ppd) - 1;
    if (!d.single && mode === 'l') dd = Math.min(dd, lim); if (!d.single && mode === 'r') dd = Math.max(dd, -lim);
    if (d.single) bar.style.left = (left0 + dd * ppd) + 'px';
    else if (p === 'act' && mode === 'r') bar.style.width = Math.max(ppd, w0 + dd * ppd) + 'px';
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


/* ---------- chart options carried by a chart file (OpenGantt's block keys: scale, mode, progress, hatch, table, columns, collapsed) ---------- */
function ogApplyOpts(doc, listId) {
  if (!doc || typeof doc !== 'object') return;
  const g = S.settings.gantt;
  if (['day', 'week', 'month', 'year'].includes(doc.scale)) g.scale = doc.scale;
  const mm = { plan: 'plan', planned: 'plan', actual: 'actual', both: 'both' }[String(doc.mode || '').toLowerCase()]; if (mm) g.mode = mm;
  for (const k of ['progress', 'hatch', 'table']) if (typeof doc[k] === 'boolean') g[k] = doc[k];
  if (Array.isArray(doc.columns)) {
    const known = new Map(gtAllCols().map(k => [k.toLowerCase(), k])), cols = [];
    for (const c of doc.columns) { const k = known.get(String(c).toLowerCase().replace(/^x:/, '').replace(/\s+/g, '')) || known.get('x:' + String(c).toLowerCase()); if (k && !cols.includes(k)) cols.push(k); }
    if (cols.length) gtSetCols(cols);
  }
  if (doc.collapsed === true && listId) { for (const t of S.tasks.filter(t => t.listId === listId && t.subtasks.length)) U.gcol.add(t.id); }
}

/* ---------- the chart as text ---------- */
function gtYamlCheck(text) {
  try { const d = ogYamlParse(text); if (!d || typeof d !== 'object' || Array.isArray(d) || !Array.isArray(d.rows)) return '<span class="bad">Needs a “rows:” list</span>'; return `<span class="ok">${d.rows.length} rows · ready to apply</span>`; } catch (e) { return `<span class="bad">${esc(e.message || String(e))}</span>`; }
}
function gtYamlHtml() {
  if (!U.gYaml) return '';
  const head = (name, dis) => `<div class="gy-h"><b>${ic('code', 14)} YAML${name ? ' · ' + esc(name) : ''}</b><span class="sp"></span>${name ? `<button class="btn sm" data-act="gyrevert"${dis}>Revert</button><button class="btn sm pri" data-act="gyapply"${dis}>Apply</button>` : ''}<button class="ib sm" data-act="gyaml" title="Hide the editor" aria-label="Hide the editor">${ic('x', 14)}</button></div>`;
  if (U.gList === 'all') return `<aside class="gt-yaml">${head('', '')}<p class="hint gy-p">Pick one list in the list menu to edit its chart as text.</p></aside>`;
  const list = listOf(U.gList), text = U.gYDirty ? U.gYText : ogBuild(list, '').yaml, dis = U.gYDirty ? '' : ' disabled';
  return `<aside class="gt-yaml">${head(list.name, dis)}<textarea id="gt-ya" spellcheck="false" wrap="off" aria-label="Chart as YAML">${esc(text)}</textarea><div class="gy-f" id="gy-err">${U.gYDirty ? gtYamlCheck(text) : 'Edit the chart as text, then Apply. Rows keep their link to the task through <code>otid</code>.'}</div></aside>`;
}
document.addEventListener('input', e => {
  if (!e.target || e.target.id !== 'gt-ya') return;
  U.gYDirty = true; U.gYText = e.target.value; const er = $('#gy-err'); if (er) er.innerHTML = gtYamlCheck(U.gYText);
  $$('[data-act="gyapply"],[data-act="gyrevert"]').forEach(b => { b.disabled = false; });
});
document.addEventListener('keydown', e => { // Tab indents inside the editor instead of leaving it
  if (e.key === 'Tab' && e.target && e.target.id === 'gt-ya' && !e.shiftKey) { e.preventDefault(); const t = e.target; t.setRangeText('  ', t.selectionStart, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input', { bubbles: true })); }
});

/* ---------- rendering the chart as an SVG (print, PNG, SVG) ---------- */
const GT_THEME = {
  light: { bg: '#ffffff', text: '#1f2328', muted: '#6b7280', line: '#e3e5e8', we: '#f4f5f7', head: '#f7f8fa', red: '#e5484d' },
  dark: { bg: '#1b1d21', text: '#e8eaee', muted: '#8d93a0', line: '#2d3036', we: '#212429', head: '#23262b', red: '#ff6b6b' },
};
const gtOut = () => Object.assign({ orient: 'landscape', dark: false, title: true, legend: true }, (S.settings.gantt || {}).out);
const gtX = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function gtModel() {
  const x = U.gx, g = S.settings.gantt; if (!x || !x.rows.some(r => r.k !== 'list')) return null;
  const cols = gtCols(); let ppd = (GT_PPD[g.scale] || 14) * (g.zoom || 1); if (x.span * ppd > 7000) ppd = 7000 / x.span; // keeps images and prints a sane size
  return { ...x, g, cols, ppd, lanes: g.mode === 'both' && g.lanes !== false, title: U.gList === 'all' ? 'All lists' : listOf(U.gList).name };
}
// rows [a, b) of the chart as one SVG; the title goes on the first page and the key on the last
function gtSvg(M, o, a = 0, b = M.rows.length, first = true, last = true) {
  const T = GT_THEME[o.dark ? 'dark' : 'light'], g = M.g, ppd = M.ppd, PAD = 16, rowH = M.lanes ? 40 : 30, headH = 44, titleH = o.title && first ? 34 : 0, legH = o.legend && last ? 34 : 0;
  const rows = M.rows.slice(a, b), D = M.D.slice(a, b);
  const nameW = Math.max(150, Math.min(340, Math.max(...rows.map(r => (r.k === 'list' ? r.l.name.length * 7.4 + 30 : (r.k === 'task' ? r.t.title : r.s.title).length * 6.5 + 28 + (r.lv || 0) * 14)))));
  const cols = g.table === false ? [] : M.cols, tblW = g.table === false ? nameW : nameW + cols.reduce((n, k) => n + gtCol(k)[1], 0), tlW = Math.round(M.span * ppd);
  const W = PAD * 2 + tblW + tlW, H = PAD * 2 + titleH + headH + rows.length * rowH + legH, x0 = PAD + tblW, y0 = PAD + titleH, td = todayStr();
  const X = d => x0 + dayDiff(d, M.min) * ppd, tr = (str, px, cw = 6.3) => { str = String(str); const n = Math.max(1, Math.floor(px / cw)); return str.length > n ? str.slice(0, n - 1) + '…' : str; };
  let o2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-size="12">`
    + `<defs><pattern id="hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.5" height="6" fill="#fff" fill-opacity=".38"/></pattern></defs><rect width="${W}" height="${H}" fill="${T.bg}"/>`;
  if (titleH) o2 += `<text x="${PAD}" y="${PAD + 18}" font-size="18" font-weight="700" fill="${T.text}">${gtX(M.title)}</text>`;
  // header band, weekend shading, and the labels (same rules as the screen)
  o2 += `<rect x="${PAD}" y="${y0}" width="${tblW + tlW}" height="${headH}" fill="${T.head}"/><text x="${PAD + 10}" y="${y0 + 27}" font-weight="600" fill="${T.muted}">Task</text>`;
  let cx = PAD + nameW; for (const k of cols) { o2 += `<text x="${cx + 8}" y="${y0 + 27}" font-weight="600" fill="${T.muted}">${gtX(tr(gtCol(k)[0], gtCol(k)[1] - 12))}</text>`; cx += gtCol(k)[1]; }
  const min = pYmd(M.min), ws = +S.settings.weekStart, bodyTop = y0 + headH, bodyH = rows.length * rowH;
  for (let i = 0; i < M.span; i++) {
    const d = addDays(min, i), x = x0 + i * ppd;
    if (g.scale === 'day' && (d.getDay() === 0 || d.getDay() === 6)) o2 += `<rect x="${x.toFixed(1)}" y="${bodyTop}" width="${ppd.toFixed(1)}" height="${bodyH}" fill="${T.we}"/>`;
    if (g.scale === 'month' || g.scale === 'year') {
      if (d.getDate() === 1 || i === 0) { o2 += `<text x="${x.toFixed(1)}" y="${y0 + 38}" fill="${T.muted}" font-size="11">${ppd * 30 < 36 ? MONTHS[d.getMonth()][0] : MONTHS[d.getMonth()].slice(0, 3)}</text>`; if (d.getMonth() === 0 || i === 0) o2 += `<text x="${x.toFixed(1)}" y="${y0 + 15}" font-weight="600" fill="${T.text}">${d.getFullYear()}</text>`; }
    } else {
      const left = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
      if (d.getDate() === 1 || (i === 0 && left * ppd >= 130)) o2 += `<text x="${x.toFixed(1)}" y="${y0 + 15}" font-weight="600" fill="${T.text}">${MONTHS[d.getMonth()]} ${d.getFullYear()}</text>`;
      if (g.scale === 'day') { if (ppd >= 14) o2 += `<text x="${(x + ppd / 2).toFixed(1)}" y="${y0 + 38}" text-anchor="middle" fill="${T.muted}" font-size="11">${d.getDate()}</text>`; }
      else if (d.getDay() === ws) { o2 += `<text x="${x.toFixed(1)}" y="${y0 + 38}" fill="${T.muted}" font-size="11">${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}</text><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${bodyTop}" y2="${bodyTop + bodyH}" stroke="${T.line}" stroke-opacity=".6"/>`; }
    }
  }
  rows.forEach((r, n) => {
    const y = bodyTop + n * rowH, d = D[n];
    o2 += `<line x1="${PAD}" x2="${W - PAD}" y1="${y + rowH}" y2="${y + rowH}" stroke="${T.line}"/>`;
    if (r.k === 'list') { o2 += `<circle cx="${PAD + 14}" cy="${y + rowH / 2}" r="5" fill="${r.l.color}"/><text x="${PAD + 26}" y="${y + rowH / 2 + 4}" font-weight="700" fill="${T.text}">${gtX(tr(r.l.name, nameW - 30))}</text>`; return; }
    const isT = r.k === 'task', x = isT ? r.t : r.s, c = r.c || '#3b82f6', title = mdPlain(x.title), fin = d.done;
    o2 += `<text x="${PAD + 10 + (r.lv || 0) * 14}" y="${y + rowH / 2 + 4}" ${r.lv ? '' : 'font-weight="500"'} fill="${fin ? T.muted : T.text}">${gtX(tr(title, nameW - 18 - (r.lv || 0) * 14, 7.1))}</text>`;
    let tx = PAD + nameW; for (const k of cols) { const v = gtCol(k)[2](d, x); if (v !== '' && v != null) o2 += `<text x="${tx + 8}" y="${y + rowH / 2 + 4}" fill="${T.muted}">${gtX(tr(v, gtCol(k)[1] - 12))}</text>`; tx += gtCol(k)[1]; }
    const by = M.lanes ? y + 6 : y + 8, bh = M.lanes ? 11 : 14, ay = M.lanes ? y + 22 : y + 8;
    if (g.mode !== 'actual' && d.ps) {
      if (d.single) { const cxm = X(d.pe) + ppd / 2, cy = (M.lanes ? y + 11.5 : y + rowH / 2); o2 += `<polygon points="${cxm},${cy - 7} ${cxm + 7},${cy} ${cxm},${cy + 7} ${cxm - 7},${cy}" fill="${c}"/>`; }
      else o2 += `<rect x="${X(d.ps).toFixed(1)}" y="${by}" width="${Math.max(3, (dayDiff(d.pe, d.ps) + 1) * ppd).toFixed(1)}" height="${bh}" rx="4" fill="${c}"/>`;
    }
    if (g.mode !== 'plan' && d.as) {
      const end = d.ae || td, w = Math.max(3, (dayDiff(end, d.as) + 1) * ppd), live = d.open && g.progress !== false, ya = g.mode === 'both' ? ay : by;
      if (live) { const p = gtPct(d); o2 += `<rect x="${X(d.as).toFixed(1)}" y="${ya}" width="${w.toFixed(1)}" height="${bh}" rx="4" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-dasharray="4 3"/>${p != null ? `<text x="${(X(d.as) + w + 5).toFixed(1)}" y="${ya + bh - 2}" font-size="10" fill="${T.muted}">${p}%</text>` : ''}`; }
      else o2 += `<rect x="${X(d.as).toFixed(1)}" y="${ya}" width="${w.toFixed(1)}" height="${bh}" rx="4" fill="${c}"/>${g.hatch === false ? '' : `<rect x="${X(d.as).toFixed(1)}" y="${ya}" width="${w.toFixed(1)}" height="${bh}" rx="4" fill="url(#hx)"/>`}`;
    }
    const lateTo = d.ae || (!d.done && d.pe && td > d.pe ? td : null);
    if (g.mode !== 'plan' && d.pe && lateTo && lateTo > d.pe) o2 += `<rect x="${(X(d.pe) + ppd).toFixed(1)}" y="${M.lanes ? ay : by}" width="${(dayDiff(lateTo, d.pe) * ppd).toFixed(1)}" height="${bh}" rx="3" fill="${T.red}" fill-opacity=".8"/>`;
  });
  o2 += `<line x1="${x0}" x2="${x0}" y1="${y0}" y2="${bodyTop + bodyH}" stroke="${T.line}"/>`;
  if (td >= M.min && dayDiff(td, M.min) < M.span) { const tx = X(td) + ppd / 2; o2 += `<line x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="${y0}" y2="${bodyTop + bodyH}" stroke="${T.red}" stroke-width="1.5"/><text x="${(tx + 4).toFixed(1)}" y="${y0 + 12}" font-size="10" fill="${T.red}">Today</text>`; }
  if (legH) {
    const ly = bodyTop + bodyH + 22; let lx = PAD; const it = (kind, label) => { let sw = '';
      if (kind === 'plan') sw = `<rect x="${lx}" y="${ly - 9}" width="20" height="10" rx="3" fill="#7c8cff"/>`; else if (kind === 'ms') sw = `<polygon points="${lx + 8},${ly - 10} ${lx + 15},${ly - 4} ${lx + 8},${ly + 2} ${lx + 1},${ly - 4}" fill="#7c8cff"/>`;
      else if (kind === 'act') sw = `<rect x="${lx}" y="${ly - 9}" width="20" height="10" rx="3" fill="#7c8cff"/><rect x="${lx}" y="${ly - 9}" width="20" height="10" rx="3" fill="url(#hx)"/>`; else if (kind === 'prog') sw = `<rect x="${lx}" y="${ly - 9}" width="20" height="10" rx="3" fill="#7c8cff" fill-opacity=".22" stroke="#7c8cff" stroke-dasharray="3 2"/>`;
      else if (kind === 'ov') sw = `<rect x="${lx}" y="${ly - 9}" width="20" height="10" rx="3" fill="${T.red}" fill-opacity=".8"/>`; else sw = `<line x1="${lx + 4}" x2="${lx + 4}" y1="${ly - 11}" y2="${ly + 3}" stroke="${T.red}" stroke-width="1.5"/>`;
      o2 += sw + `<text x="${lx + 26}" y="${ly}" fill="${T.muted}" font-size="11">${label}</text>`; lx += 26 + label.length * 6.2 + 18; };
    if (g.mode !== 'actual') { it('plan', 'Planned'); it('ms', 'Milestone'); }
    if (g.mode !== 'plan') { it('act', 'Actual'); it('prog', 'In progress'); it('ov', 'Over plan'); }
    it('today', 'Today');
  }
  return { svg: o2 + '</svg>', w: W, h: H };
}
// split the rows over pages that keep the page's shape; list headings stay with their rows
function gtPages(M, o) {
  const one = gtSvg(M, o, 0, M.rows.length, true, true);
  if (!o.paged) return [one];
  const asp = o.orient === 'portrait' ? 1.38 : 0.66, rowH = M.lanes ? 40 : 30, avail = one.w * asp - 32 - 44 - 34 - 34, per = Math.max(4, Math.floor(avail / rowH)), pages = [];
  for (let a = 0; a < M.rows.length; a += per) pages.push([a, Math.min(M.rows.length, a + per)]);
  return pages.map(([a, b], i) => gtSvg(M, o, a, b, i === 0, i === pages.length - 1));
}
const gtFileBase = () => (U.gList === 'all' ? 'gantt' : (listOf(U.gList).name.replace(/[^\w\- ]+/g, '').trim() || 'gantt'));
function gtPrint() {
  const M = gtModel(); if (!M) { toast('Nothing to print yet'); return; }
  const o = { ...gtOut(), paged: true }; o.dark = o.dark === true;
  const pages = gtPages(M, o), bg = GT_THEME[o.dark ? 'dark' : 'light'].bg;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${gtX(M.title)}</title><style>@page{size:A4 ${o.orient};margin:8mm}html,body{margin:0;background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact}.pg{page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}.pg svg{width:100%;height:auto;display:block}</style></head><body>${pages.map(p => `<div class="pg">${p.svg}</div>`).join('')}</body></html>`;
  const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  const w = f.contentWindow, d = f.contentDocument || w.document; d.open(); d.write(html); d.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) { toast('Printing is not available here. Export a PNG or SVG instead.'); } setTimeout(() => f.remove(), 60000); }, 300);
}
async function gtPng() {
  const M = gtModel(); if (!M) { toast('Nothing to export yet'); return; }
  const o = gtOut(), r = gtSvg(M, o), sc = Math.min(2, 15000 / Math.max(r.w, r.h)) || 1;
  try {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg); await img.decode();
    const c = document.createElement('canvas'); c.width = Math.round(r.w * sc); c.height = Math.round(r.h * sc); const x = c.getContext('2d'); x.scale(sc, sc); x.drawImage(img, 0, 0, r.w, r.h);
    const blob = await new Promise(res => c.toBlob(res, 'image/png')); if (!blob) throw new Error('the image is too large');
    if (await saveBlob(gtFileBase() + '.png', blob)) toast('PNG saved');
  } catch (e) { toast('Could not make the image: ' + (e.message || e)); }
}
async function gtSvgFile() {
  const M = gtModel(); if (!M) { toast('Nothing to export yet'); return; }
  try { if (await saveBlob(gtFileBase() + '.svg', new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n` + gtSvg(M, gtOut()).svg], { type: 'image/svg+xml' }))) toast('SVG saved'); } catch (e) { toast('Could not save: ' + (e.message || e)); }
}
// values for the table file: real dates and numbers, not the short labels of the screen
function gtRaw(k, d, x) {
  const n = (a, b) => (a && b ? dayDiff(b, a) : '');
  switch (k) {
    case 'planStart': return d.ps || ''; case 'planEnd': return d.pe || ''; case 'actualStart': return d.as || ''; case 'actualEnd': return d.ae || '';
    case 'plan': return d.ps ? (d.ps === d.pe ? d.pe : `${d.ps} → ${d.pe}`) : ''; case 'actual': return d.as ? `${d.as} → ${d.ae || ''}` : '';
    case 'planDays': return d.ps ? n(d.ps, d.pe) + 1 : ''; case 'actualDays': return d.as ? n(d.as, d.ae || d.today) + 1 : '';
    case 'progress': { const p = gtPct(d); return p == null ? '' : p; }
    case 'variance': return d.pe ? (d.done && d.ae ? dayDiff(d.ae, d.pe) : d.today > d.pe ? dayDiff(d.today, d.pe) : '') : '';
    case 'notes': return (x && x.notes) || '';
    default: return gtCol(k)[2](d, x);
  }
}
async function gtCsv() {
  const M = gtModel(); if (!M) { toast('Nothing to export yet'); return; }
  const cols = M.cols.length ? M.cols : ['planStart', 'planEnd', 'actualStart', 'actualEnd', 'progress', 'status', 'notes'], q = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [['Task', 'Level', ...cols.map(k => gtCol(k)[0])].map(q).join(',')];
  M.rows.forEach((r, i) => { if (r.k === 'list') return; const x = r.k === 'task' ? r.t : r.s; lines.push([mdPlain(x.title), r.lv || 0, ...cols.map(k => gtRaw(k, M.D[i], x))].map(q).join(',')); });
  try { if (await saveBlob(gtFileBase() + '.csv', new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], { type: 'text/csv' }))) toast('CSV saved'); } catch (e) { toast('Could not save: ' + (e.message || e)); }
}
function openGtExport() {
  const o = gtOut(), seg = (k, arr) => `<div class="seg" data-ok="${k}">${arr.map(([v, n]) => `<button type="button" data-ov="${v}" class="${String(o[k]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  openModal(`<h3>Print or export</h3><p class="hint">Exports the chart as it is on screen: scale, zoom, columns and collapsed rows.</p><div class="form one"><div class="lbl">Page${seg('orient', [['landscape', 'Landscape'], ['portrait', 'Portrait']])}</div><div class="lbl">Image colours${seg('dark', [[false, 'Light'], [true, 'Dark']])}</div><div class="mrow"><label class="chkl"><input type="checkbox" data-oc="title"${o.title ? ' checked' : ''}> Title</label><label class="chkl"><input type="checkbox" data-oc="legend"${o.legend ? ' checked' : ''}> Legend</label></div></div>
<div class="gx-btns"><button class="btn pri" data-gx="print">${ic('file-text', 16)} Print…</button><button class="btn" data-gx="png">${ic('camera', 16)} PNG image</button><button class="btn" data-gx="svg">${ic('download', 16)} SVG file</button><button class="btn" data-gx="csv">${ic('table', 16)} CSV table</button></div><div class="mact"><button data-m="no">Close</button></div>`, m => {
    m.onchange = e => { const c = e.target.dataset.oc; if (c) { S.settings.gantt.out = { ...gtOut(), [c]: e.target.checked }; save(); } };
    m.onclick = async e => {
      const ov = e.target.closest('[data-ov]'); if (ov) { const k = ov.parentElement.dataset.ok, v = ov.dataset.ov; S.settings.gantt.out = { ...gtOut(), [k]: v === 'true' ? true : v === 'false' ? false : v }; save(); $$('button', ov.parentElement).forEach(b => b.classList.toggle('on', b === ov)); return; }
      const b = e.target.closest('[data-gx]'); if (!b) { if (e.target.closest('[data-m]') || e.target.classList.contains('mback')) closeModal(); return; }
      closeModal(); const a = b.dataset.gx; if (a === 'print') gtPrint(); else if (a === 'png') await gtPng(); else if (a === 'svg') await gtSvgFile(); else gtCsv();
    };
  }, 'wide');
}

/* ---------- full screen ---------- */
function gtFull(on) {
  U.gFull = on == null ? !U.gFull : on; document.body.classList.toggle('gtfull', U.gFull);
  try { if (U.gFull && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else if (!U.gFull && document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* the in-window version still works */ }
  renderMain();
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && U.gFull) gtFull(false); });

/* ---------- menus ---------- */
async function gtColMenu(k) {
  const on = gtCols(), i = on.indexOf(k); if (i < 0) return;
  const it = [{ label: 'Move left' }, { label: 'Move right' }, { label: 'Hide this column' }, { label: 'Choose columns…' }];
  const r = await askMenu(gtCol(k)[0], it); if (r == null) return;
  if (r === 0 && i > 0) { [on[i], on[i - 1]] = [on[i - 1], on[i]]; gtSetCols(on); } else if (r === 1 && i < on.length - 1) { [on[i], on[i + 1]] = [on[i + 1], on[i]]; gtSetCols(on); }
  else if (r === 2) gtSetCols(on.filter(x => x !== k)); else if (r === 3) { openGtCols(); return; }
  renderMain();
}
function gtExampleYaml() {
  const d = n => ymd(addDays(new Date(), n));
  return `title: Example project\nscale: week\nmode: both\nrows:\n  - label: Kick-off\n    plan: [${d(-12)}]\n    fact: [${d(-12)}, ${d(-12)}]\n  - label: Design\n    plan: [${d(-11)}, ${d(-2)}]\n    fact: [${d(-11)}, ${d(1)}]\n    notes: Wireframes, review and sign-off\n    owner: Sam\n    children:\n      - label: Wireframes\n        plan: [${d(-11)}, ${d(-6)}]\n        fact: [${d(-11)}, ${d(-5)}]\n      - label: Review\n        plan: [${d(-5)}, ${d(-2)}]\n        fact: [${d(-4)}, ${d(1)}]\n  - label: Build\n    plan: [${d(-1)}, ${d(14)}]\n    fact: [${d(0)}]\n    owner: Alex\n  - label: Launch\n    plan: [${d(18)}]\n    priority: High\n`;
}
async function gtMore() {
  const one = U.gList !== 'all', g = S.settings.gantt;
  const items = [{ label: 'Open a chart file…' }, { label: 'Save the chart as a file…' }, { label: 'Copy as an Obsidian block' }, { label: 'Link to a file (auto-sync)…' }, { label: 'Create an example chart' }, { label: g.legend === false ? 'Show the legend' : 'Hide the legend' }, { label: 'Reset the view' }];
  const r = await askMenu('Gantt', items); if (r == null) return;
  const need = () => { if (!one) { toast('Pick one list first'); return false; } return true; };
  if (r === 0) ogImport(one ? U.gList : null);
  else if (r === 1) { if (need()) ogExport(U.gList, false); }
  else if (r === 2) { if (need()) ogExport(U.gList, true); }
  else if (r === 3) { if (need()) openOG(U.gList); }
  else if (r === 4) { try { const res = ogImportText(gtExampleYaml(), 'Example project.yaml', null); U.gList = res.list.id; refresh(); toast('Example chart created'); } catch (e) { toast('Could not create it: ' + (e.message || e)); } }
  else if (r === 5) { g.legend = g.legend === false; save(); renderMain(); }
  else if (r === 6) { Object.assign(g, { scale: 'week', zoom: 1, mode: 'both', cols: ['plan', 'actual'], table: true, legend: true, hatch: true, progress: true, lanes: true }); U.gcol.clear(); save(); U.gScrollReset = true; renderMain(); toast('View reset'); }
}

/* ---------- hover card (mouse only; on touch a tap opens the task) ---------- */
(() => {
  let tip = null, cur = -1;
  const hide = () => { if (tip) tip.hidden = true; cur = -1; };
  const html = i => {
    const r = U.gRows[i], d = U.gD && U.gD[i]; if (!r || !d || r.k === 'list') return '';
    const x = r.k === 'task' ? r.t : r.s, st = gtStatus(d), pct = gtPct(d), vr = GT_COLS.variance[2](d), gx = x.gx ? Object.entries(x.gx) : [];
    const row = (k, v) => (v === '' || v == null ? '' : `<div><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`);
    return `<div class="gtp-t">${mdInline(x.title, true)}</div>${row('Plan', d.ps ? (d.single ? gtMD(d.pe) : `${gtMD(d.ps)} → ${gtMD(d.pe)} (${dayDiff(d.pe, d.ps) + 1} d)`) : '')}${row('Actual', d.as ? `${gtMD(d.as)} → ${d.ae ? gtMD(d.ae) : 'ongoing'} (${dayDiff(d.ae || d.today, d.as) + 1} d)` : '')}${row('Status', st[0])}${row('Progress', pct == null ? '' : pct + '%')}${row('Variance', vr)}${r.k === 'task' ? row('Priority', x.priority ? PRIO[x.priority] : '') + row('Tags', (x.tags || []).map(g => '#' + g).join(' ')) : ''}${gx.map(([k, v]) => row(gtHuman(k), gtShow(v))).join('')}${x.notes && x.notes.trim() ? `<p>${esc(mdPlain(x.notes.replace(/\n+/g, ' ')).slice(0, 220))}</p>` : ''}`;
  };
  document.addEventListener('pointermove', e => {
    if (U.page !== 'gantt' || e.pointerType === 'touch' || e.buttons) { hide(); return; }
    const r = e.target.closest && e.target.closest('.gt-r[data-i]'); if (!r) { hide(); return; }
    const i = +r.dataset.i; if (!tip) { tip = document.createElement('div'); tip.className = 'gtp'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    if (i !== cur) { const h = html(i); if (!h) { hide(); return; } tip.innerHTML = h; cur = i; }
    tip.hidden = false; const w = tip.offsetWidth || 260, h = tip.offsetHeight || 120;
    tip.style.left = Math.max(8, Math.min(e.clientX + 16, window.innerWidth - w - 8)) + 'px'; tip.style.top = Math.max(8, Math.min(e.clientY + 16, window.innerHeight - h - 8)) + 'px';
  });
  document.addEventListener('pointerleave', hide, true); document.addEventListener('scroll', hide, true); document.addEventListener('pointerdown', hide, true);
})();

/* ---------- keyboard: Ctrl/Cmd + P print, O open, S save (like the OpenGantt app) ---------- */
document.addEventListener('keydown', e => {
  if (U.page !== 'gantt' || !(e.ctrlKey || e.metaKey) || e.altKey || $('#modal.on') || (e.target.closest && e.target.closest('input,textarea,select'))) return;
  const k = e.key.toLowerCase(), one = U.gList !== 'all';
  if (k === 'p' && !e.shiftKey) { e.preventDefault(); gtPrint(); }
  else if (k === 'o') { e.preventDefault(); ogImport(one ? U.gList : null); }
  else if (k === 's' && one) { e.preventDefault(); ogExport(U.gList, false); }
});

const GT_ACT = {
  gyaml: () => { U.gYaml = !U.gYaml; if (!U.gYaml) U.gYDirty = false; renderMain(); },
  gyapply: () => {
    try { const r = ogImportText(U.gYText, 'chart.yaml', U.gList); U.gYDirty = false; refresh(); toast(`Applied: ${r.added} new, ${r.pulled} updated`); } catch (e) { toast('Could not apply: ' + (e.message || e)); }
  },
  gyrevert: () => { U.gYDirty = false; renderMain(); },
  gexport: () => openGtExport(),
  gfull: () => gtFull(),
  gmenu: () => gtMore(),
  gcolmenu: el => gtColMenu(el.dataset.gcol),
};
