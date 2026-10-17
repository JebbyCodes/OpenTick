/* OpenTick layout: resizable + hideable panels, folding sidebar sections, reorderable lists and view tabs.
   Everything here is per device (S.settings.ui / S.settings.gantt) and never synced. */

// One entry per drag handle (`data-rs="<key>"`). `dir` is +1 when the handle sits on the right edge of the thing it resizes.
const UIC = {
  side: { store: () => S.settings.ui, key: 'sideW', cssv: '--sw-u', min: 220, max: 520, dir: 1, def: 300, target: () => document.documentElement, limit: () => zvw() - (S.settings.ui.detail ? S.settings.ui.detailW : 0) - 360 },
  detail: { store: () => S.settings.ui, key: 'detailW', cssv: '--dw-u', min: 300, max: 760, dir: -1, def: 380, target: () => document.documentElement, limit: () => zvw() - (S.settings.ui.side ? S.settings.ui.sideW : 0) - 360 },
  tray: { store: () => S.settings.ui, key: 'trayW', cssv: '--trw', min: 170, max: 460, dir: -1, def: 236, target: () => document.documentElement },
  gtray: { store: () => S.settings.gantt, key: 'trayW', cssv: '--gtw', min: 170, max: 460, dir: -1, def: 220, target: () => document.documentElement },
  gname: { store: () => S.settings.gantt, key: 'nameW', cssv: '--gn', min: 170, max: 760, dir: 1, def: 290, target: () => $('.gt-wrap') || document.documentElement, live: w => { const i = $('.gt-in'); if (i && i.dataset.w) i.style.width = `calc(${w}px + ${i.dataset.w}px)`; } },
};
const narrow = n => (typeof window !== 'undefined' ? window.innerWidth / (typeof Z !== 'undefined' ? Z.z : 1) : 1800) <= n;

function uiApply() {
  const u = S.settings.ui, g = S.settings.gantt, st = document.documentElement.style, b = document.body.classList;
  if (st && st.setProperty) {
    st.setProperty('--sw-u', u.sideW + 'px'); st.setProperty('--dw-u', u.detailW + 'px'); st.setProperty('--trw', u.trayW + 'px'); st.setProperty('--gtw', g.trayW + 'px');
  }
  b.toggle('shide', !u.side); b.toggle('dhide', !u.detail); b.toggle('compact', !!u.compact);
}
function uiInit() {
  const app = $('#app'); if (!app || !app.appendChild) return; // (the test harness has no real DOM)
  for (const [id, k, label] of [['rs-side', 'side', 'sidebar'], ['rs-detail', 'detail', 'details panel']]) {
    const d = document.createElement('div');
    d.className = 'rs'; d.id = id; d.dataset.rs = k; d.tabIndex = 0; d.title = 'Drag to resize · double-click to reset';
    d.setAttribute('role', 'separator'); d.setAttribute('aria-orientation', 'vertical'); d.setAttribute('aria-label', 'Resize ' + label);
    app.appendChild(d);
  }
  const dk = document.createElement('div'); dk.id = 'dock'; dk.innerHTML = '<div id="clock" aria-hidden="true"></div><div id="dsync"></div>'; document.body.appendChild(dk);
  uiApply(); clockPaint(); paintDock();
}

/* ---------- status dock: sync cloud + "Saved" note + clock ----------
   One small strip in the least intrusive spot: the foot of the sidebar, or a faint corner pill when the sidebar is hidden
   or on a phone. The cloud shows whether sync is off / idle / working / has a problem, and a quick "Saved" appears
   whenever a change has been written. Click the cloud to sync now (or to set sync up when it is off). */
const DOCK = { saved: 0, timer: 0, pending: false };
// the small "Saving… / Saved" note: in the dock, and beside the title of the task or note being edited ([data-sv])
function svPaint(txt, ok) { $$('[data-sv]').forEach(el => { el.textContent = txt; el.classList.toggle('ok', !!ok); el.classList.toggle('pend', txt === 'Saving…'); }); }
function savePending() { DOCK.pending = true; paintDock(); svPaint('Saving…'); }
function dockSaved(quiet) {
  DOCK.pending = false; if (!quiet) DOCK.saved = Date.now(); paintDock(); svPaint(quiet ? '' : '✓ Saved', true);
  clearTimeout(DOCK.timer); DOCK.timer = setTimeout(() => { paintDock(); svPaint(''); editedLabels(); }, 1800);
}
// recently edited records get an "Edited" marker for a couple of minutes (rows, cards, blocks, chips, notes); labels say how long ago
function editedPaint() {
  const now = Date.now();
  for (const [id, ts] of EDITED) {
    if (now - ts >= EDIT_SHOW) { EDITED.delete(id); continue; }
    $$(`${['.task', '.card', '.blk', '.chip', '.tri', '.nti'].map(c => `${c}[data-id="${id}"]`).join(',')},.blk[data-sid="${id}"]`).forEach(el => { if (!el.classList.contains('edited')) { el.classList.add('edited'); } });
  }
  editedLabels();
}
function editedSweep() { for (const [id, ts] of EDITED) if (Date.now() - ts >= EDIT_SHOW) { EDITED.delete(id); $$(`[data-id="${id}"].edited,[data-sid="${id}"].edited`).forEach(el => el.classList.remove('edited')); } editedLabels(); }
function editedLabels() {
  const t = getT(U.sel), el = $('#d-ed'); if (el && t) el.innerHTML = editedText(t);
  const n = noteById(U.noteSel), ne = $('#n-when'); if (ne && n) ne.innerHTML = editedText(n, true);
}
const editedText = (o, note) => { const mine = EDITED.has(o.id) && Date.now() - EDITED.get(o.id) < EDIT_SHOW, at = note ? o.updated : o.u; return at ? `<span class="edtag${mine ? ' now' : ''}">${mine ? ic('check', 11) + ' ' : ''}Edited ${esc(ago(at))}</span>` : ''; };
function paintDock() {
  const el = document.getElementById ? document.getElementById('dsync') : null; if (!el) return;
  const s = Sync.state, saved = Date.now() - DOCK.saved < 1750; let icon, cls, tip, txt = '';
  if (!Sync.on) { icon = 'cloud'; cls = 'off'; tip = 'Sync is off — everything is saved on this device. Click to set up sync.'; }
  else if (s === 'busy') { icon = 'refresh'; cls = 'busy'; tip = 'Syncing…'; txt = 'Syncing…'; }
  else if (s === 'error' || s === 'offline') { icon = 'cloud-off'; cls = 'err'; tip = Sync.msg || 'Offline'; txt = s === 'offline' ? 'Offline' : 'Sync problem'; }
  else { icon = 'cloud-check'; cls = 'ok'; tip = Sync.cfg.last ? 'Synced ' + ago(Sync.cfg.last) + ' — click to sync now' : 'Sync is on — click to sync now'; }
  if (DOCK.pending && !txt) txt = 'Saving…';
  else if (saved && !txt) txt = 'Saved';
  const html = `<span class="dtxt${txt ? ' show' : ''}${txt === 'Saved' ? ' saved' : ''}${txt === 'Saving…' ? ' saving' : ''}" aria-live="polite">${txt === 'Saved' ? ic('check', 12) : ''}${esc(txt)}</span><button class="ib dsb ${cls}" data-act="syncdock" title="${esc(tip)}" aria-label="${esc(tip)}">${ic(icon, 18)}</button>`;
  if (el._h !== html) { el._h = html; el.innerHTML = html; }
}

/* ---------- date & time readout ----------
   A small, click-through readout. With the sidebar docked it sits at the foot of the sidebar (where nothing else lives);
   with the sidebar hidden, or on a phone, it becomes a faint pill in the bottom-left corner. Settings -> Clock. */
function clockParts(d = new Date()) {
  const c = S.settings.clock, h = d.getHours();
  const time = (c.h24 ? pad(h) : String(h % 12 || 12)) + ':' + pad(d.getMinutes()) + (c.sec ? ':' + pad(d.getSeconds()) : '');
  return { time, ap: c.h24 ? '' : h < 12 ? 'AM' : 'PM', date: `${FULLDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
}
function clockPaint() {
  const el = document.getElementById ? document.getElementById('clock') : null; if (!el) return;
  const on = S.settings.clock.on !== false; el.hidden = !on; if (!on) return;
  const p = clockParts(), html = `<b>${p.time}${p.ap ? `<span>${p.ap}</span>` : ''}</b><small>${p.date}</small>`;
  if (el._h !== html) { el._h = html; el.innerHTML = html; }
}

/* ---------- hide / show ---------- */
function uiToggle(k) {
  const u = S.settings.ui;
  if (k === 'side') {
    if (narrow(820)) { document.body.classList.add('drawer'); return; }
    u.side = !u.side; document.body.classList.remove('drawer');
  } else if (k === 'detail') {
    if (narrow(1100)) { if (U.sel) closeDetail(); return; }
    u.detail = !u.detail;
  } else if (k === 'tray') { U.ttTray = !ttTrayOn(); renderMain(); return; }
  else if (k === 'gtray') { if (narrow(820)) U.gTrayM = !U.gTrayM; else { S.settings.gantt.tray = !S.settings.gantt.tray; save(); } renderMain(); return; }
  save(); uiApply();
  if (!u.detail && U.sel) closeDetail(); // hiding the panel must not pop it back up as an overlay
}
// focus mode: hide both panels, press again to bring back what was visible before
function uiFocus() {
  const u = S.settings.ui;
  if (u.side || u.detail) { U.focusBack = { side: u.side, detail: u.detail }; u.side = false; u.detail = false; }
  else { const b = U.focusBack || { side: true, detail: true }; u.side = b.side; u.detail = b.detail; }
  save(); uiApply();
  if (!u.detail && U.sel) closeDetail();
}

/* ---------- drag handles ---------- */
function uiSetWidth(c, w) {
  const lim = Math.min(c.max, c.limit ? c.limit() : c.max);
  w = Math.round(Math.max(c.min, Math.min(Math.max(c.min, lim), w)));
  const t = c.target(); if (t && t.style && t.style.setProperty) t.style.setProperty(c.cssv, w + 'px');
  if (c.live) c.live(w);
  return w;
}
document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('[data-rs]'); if (!h) return;
  const c = UIC[h.dataset.rs]; if (!c) return;
  e.preventDefault(); e.stopPropagation();
  const st = c.store(), x0 = e.clientX, w0 = st[c.key] || c.def; let w = w0;
  h.classList.add('on'); document.body.classList.add('rsing');
  if (h.setPointerCapture) { try { h.setPointerCapture(e.pointerId); } catch (_) { /* synthetic event */ } }
  const mv = ev => { w = uiSetWidth(c, w0 + c.dir * zd(ev.clientX - x0)); };
  const up = () => {
    h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    h.classList.remove('on'); document.body.classList.remove('rsing');
    if (w !== w0) { st[c.key] = w; save(); }
    U.suppress = Date.now();
  };
  h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
});
document.addEventListener('dblclick', e => {
  const h = e.target.closest && e.target.closest('[data-rs]'); if (!h || !UIC[h.dataset.rs]) return;
  const c = UIC[h.dataset.rs]; c.store()[c.key] = c.def; uiSetWidth(c, c.def); save();
});
document.addEventListener('keydown', e => {
  const h = e.target.closest && e.target.closest('[data-rs]'); if (!h || !UIC[h.dataset.rs]) return;
  const c = UIC[h.dataset.rs], st = c.store();
  const step = (e.shiftKey ? 64 : 16) * (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0) * c.dir;
  if (e.key === 'Home') { e.preventDefault(); st[c.key] = c.def; uiSetWidth(c, c.def); save(); }
  else if (step) { e.preventDefault(); st[c.key] = uiSetWidth(c, (st[c.key] || c.def) + step); save(); }
});

/* ---------- sidebar: folding sections, view tabs ---------- */
const folded = k => !!S.settings.ui.fold[k];
const pageOrder = () => { const u = S.settings.ui; return u.pageOrder.filter(k => PAGES.some(p => p[0] === k)).concat(PAGES.map(p => p[0]).filter(k => !u.pageOrder.includes(k))); };
function pagesShown() {
  const u = S.settings.ui, order = pageOrder();
  return order.map(k => PAGES.find(p => p[0] === k)).filter(p => !u.hidePages.includes(p[0]) || p[0] === U.page);
}
function uiSidebarSettings() {
  const u = S.settings.ui, order = pageOrder();
  return `<div class="vlist">${order.map((k, i) => { const p = PAGES.find(x => x[0] === k); return `<div class="vrow"><label><input type="checkbox" data-pg="${k}"${u.hidePages.includes(k) ? '' : ' checked'}> ${ic(p[2], 16)} ${esc(p[1])}</label><span><button class="ib sm" data-pgmv="${k}" data-d="-1"${i ? '' : ' disabled'} title="Move up">${ic('up', 14)}</button><button class="ib sm" data-pgmv="${k}" data-d="1"${i < order.length - 1 ? '' : ' disabled'} title="Move down">${ic('down', 14)}</button></span></div>`; }).join('')}</div><p class="hint">Hide the views you do not use. You can also drag the tabs in the sidebar to reorder them.</p>`;
}
function uiMovePage(k, d) {
  const u = S.settings.ui, order = pageOrder();
  const i = order.indexOf(k), j = i + d; if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]]; u.pageOrder = order; save();
}

/* ---------- reorder: lists in the sidebar, view tabs, and dropping a task on a sidebar entry ---------- */
document.addEventListener('dragstart', e => {
  const l = e.target.closest && e.target.closest('.navrow[data-lid]');
  if (l) { U.ldrag = l.dataset.lid; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'list:' + U.ldrag); l.classList.add('drag'); return; }
  const p = e.target.closest && e.target.closest('.pg[data-page]');
  if (p) { U.pdrag = p.dataset.page; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'page:' + U.pdrag); p.classList.add('drag'); }
});
document.addEventListener('dragover', e => {
  const t = e.target.closest && e.target.closest('.navrow[data-lid],.pg[data-page],.sech[data-k="lists"]');
  if (U.ldrag && t && (t.dataset.lid || t.dataset.k)) { // a list over a list: top / bottom edge = reorder next to it, middle = move inside it
    const bad = new Set([U.ldrag, ...listDescendants(U.ldrag)]); if (t.dataset.lid && bad.has(t.dataset.lid)) return;
    e.preventDefault(); $$('.over,.dz-b,.dz-a,.dz-in').forEach(x => x.classList.remove('over', 'dz-b', 'dz-a', 'dz-in'));
    if (t.dataset.lid) { const r = t.getBoundingClientRect(), y = (zc(e.clientY) - r.top) / r.height; t.classList.add(y < 0.28 ? 'dz-b' : y > 0.72 ? 'dz-a' : 'dz-in'); } else t.classList.add('over');
  } else if (t && U.pdrag && t.dataset.page) { e.preventDefault(); $$('.over').forEach(x => x.classList.remove('over')); t.classList.add('over'); }
});
document.addEventListener('drop', e => {
  if (U.ldrag) {
    const t = e.target.closest('.navrow[data-lid],.sech[data-k="lists"]'), src = S.lists.find(l => l.id === U.ldrag);
    if (t && src) {
      e.preventDefault();
      const bad = new Set([src.id, ...listDescendants(src.id)]);
      if (t.dataset.lid) {
        if (bad.has(t.dataset.lid)) return;
        const dst = S.lists.find(l => l.id === t.dataset.lid), r = t.getBoundingClientRect(), y = (zc(e.clientY) - r.top) / r.height;
        S.lists.splice(S.lists.indexOf(src), 1);
        if (y >= 0.28 && y <= 0.72) { src.parent = dst.id; S.lists.push(src); S.settings.ui.fold['l:' + dst.id] = false; } // inside: last sublist
        else { src.parent = dst.parent || null; S.lists.splice(S.lists.indexOf(dst) + (y > 0.72 ? 1 : 0), 0, src); } // next to it, sharing its parent
      } else { src.parent = null; S.lists.splice(S.lists.indexOf(src), 1); S.lists.push(src); } // dropped on the "Lists" heading: top level
      save(); renderSide();
    }
  } else if (U.pdrag) {
    const t = e.target.closest('.pg[data-page]');
    if (t && t.dataset.page !== U.pdrag) {
      e.preventDefault();
      const u = S.settings.ui, order = pageOrder();
      const to = order.indexOf(t.dataset.page); order.splice(order.indexOf(U.pdrag), 1); order.splice(to, 0, U.pdrag); u.pageOrder = order; save(); renderSide();
    }
  }
});
document.addEventListener('dragend', () => { U.ldrag = U.pdrag = null; });

// a task dropped on the sidebar: onto a list (move it), Inbox, Today, Tomorrow, Completed or Trash
function uiNavDrop(el) {
  const t = getT(U.drag); if (!t) return false;
  const nav = el.dataset.nav;
  if (nav.startsWith('list:')) { if (!S.lists.some(l => l.id === nav.slice(5))) return false; t.listId = nav.slice(5); t.section = null; toast('Moved to “' + listOf(t.listId).name + '”'); }
  else if (nav === 'inbox') { t.listId = 'inbox'; t.section = null; toast('Moved to Inbox'); }
  else if (nav === 'today') { t.due = todayStr(); toast('Due today'); }
  else if (nav === 'tomorrow') { t.due = ymd(addDays(new Date(), 1)); toast('Due tomorrow'); }
  else if (nav === 'trash') { t.deleted = Date.now(); if (U.sel === t.id) U.sel = null; toast('Moved to Trash'); }
  else if (nav === 'done') { if (t.status === 'open') toggleDone(t); }
  else return false;
  save(); refresh(); return true;
}

/* ---------- command palette (Ctrl+Shift+P), shortcut help (?), compact density, print ---------- */
function uiCompact(on) { const u = S.settings.ui; u.compact = on == null ? !u.compact : on; save(); document.body.classList.toggle('compact', !!u.compact); }
function paletteItems(q) {
  const go = (label, hint, run) => ({ label, hint, run });
  const out = [
    ...PAGES.map(([k, n]) => go('Go to ' + n, 'View', () => { U.page = k; U.sel = null; render(); })),
    go('Go to History', 'View', () => { U.page = 'history'; U.sel = null; render(); }),
    ...SMART.map(([k, n]) => go('Open ' + n, 'List', () => setNav(k))),
    ...S.lists.filter(l => l.id !== 'inbox').map(l => go('Open list: ' + listLabel(l.id), 'List', () => setNav('list:' + l.id))),
    ...S.projects.map(p => go('Open project: ' + p.name, 'Project', () => setNav('project:' + p.id))),
    go('Import from another app…', 'Action', () => openImport()), go('New list…', 'Action', () => openListForm(null, '')), go('New project…', 'Action', () => openProjectForm(null)),
    go('Open Completed', 'List', () => setNav('done')), go('Open Trash', 'List', () => setNav('trash')),
    go('Toggle sidebar', '[', () => uiToggle('side')), go('Toggle task details', ']', () => uiToggle('detail')),
    go('Focus mode: hide both panels', '\\', uiFocus),
    go('Toggle compact density', 'Layout', () => { uiCompact(); render(); }),
    go('New list…', 'Action', () => ACT.addlist()), go('New note', 'Action', () => { U.page = 'notes'; U.sel = null; render(); ACT.noteadd(); }), go('Settings…', 'Action', openSettings),
    go('Keyboard shortcuts', '?', openShortcuts), go('Help & user guide', 'Help', () => openHelp()), go('About OpenTick: version, licences, credits', 'Help', () => openAbout()),
    go('Interface size…', 'Appearance', openSettings), go('Background effects…', 'Appearance', openBgSettings),
    go('Gantt: zoom in', 'Gantt', () => { U.page = 'gantt'; render(); gtZoom(1); }), go('Gantt: zoom out', 'Gantt', () => { U.page = 'gantt'; render(); gtZoom(-1); }),
    go('Gantt: choose table columns…', 'Gantt', () => { U.page = 'gantt'; render(); openGtCols(); }),
    go('Gantt: print / save as PDF', 'Gantt', () => { U.page = 'gantt'; render(); setTimeout(gtPrint, 100); }), go('Gantt: export…', 'Gantt', () => { U.page = 'gantt'; render(); openGtExport(); }), go('Gantt: show / hide the YAML editor', 'Gantt', () => { U.page = 'gantt'; U.gYaml = !U.gYaml; render(); }),
    ...themeList().map(t => go('Theme: ' + t[1], 'Theme', () => { S.settings.theme = t[0]; applyTheme(); save(); })),
  ];
  q = q.toLowerCase().trim();
  const hit = out.filter(i => !q || i.label.toLowerCase().includes(q));
  const notes = q.length > 1 ? S.notes.filter(n => (noteTitle(n) + ' ' + n.body).toLowerCase().includes(q)).slice(0, 5).map(n => go(noteTitle(n), 'Note', () => openNoteById(n.id))) : [];
  const tasks = q.length > 1 ? S.tasks.filter(t => !t.deleted && !t.log && (t.title || '').toLowerCase().includes(q)).slice(0, 8).map(t => go(t.title, 'Task', () => { setNav(t.listId === 'inbox' ? 'inbox' : 'list:' + t.listId); U.sel = t.id; renderMain(); renderDetail(); })) : [];
  return [...hit, ...notes, ...tasks].slice(0, 14);
}
function openPalette() {
  let sel = 0, items = paletteItems('');
  const list = () => items.map((i, n) => `<div class="pal-i${n === sel ? ' on' : ''}" data-n="${n}"><span>${esc(i.label)}</span><small>${esc(i.hint)}</small></div>`).join('') || '<p class="hint">Nothing matches.</p>';
  const run = n => { const it = items[n]; if (!it) return; closeModal(); it.run(); };
  openModal(`<input id="pal-q" class="pal-q" placeholder="Type a command, view, list or task…" autocomplete="off"><div id="pal-l" class="pal-l">${list()}</div>`, m => {
    const q = $('#pal-q', m), l = $('#pal-l', m), paint = () => { l.innerHTML = list(); const on = $('.pal-i.on', m); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' }); };
    q.focus();
    m.oninput = () => { items = paletteItems(q.value); sel = 0; paint(); };
    m.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    };
    m.onclick = e => { const i = e.target.closest('.pal-i'); if (i) run(+i.dataset.n); else if (e.target.classList.contains('mback')) closeModal(); };
  }, 'pal');
}
function openShortcuts() {
  const rows = [['Ctrl/Cmd + Shift + P', 'Command palette'], ['Ctrl/Cmd + K  or  /', 'Search'], ['N', 'New task'], ['[', 'Show / hide sidebar'], [']', 'Show / hide task details'], ['\\', 'Focus mode (hide both panels)'], ['Esc', 'Close dialog / details'], ['?', 'This list of shortcuts'], ['Alt + arrow keys', 'Move the focused matrix task to another box'], ['Arrow keys (habit history)', 'Move between days'], ['Settings → Help & user guide', 'The full, printable guide'], ['Ctrl/Cmd + B / I / K', 'Bold / italic / link in notes'], ['Tab / Shift+Tab', 'Indent / outdent list items in notes'], ['Ctrl + scroll (Gantt)', 'Zoom the timeline'], ['Drag a handle', 'Resize a panel · double-click to reset']];
  openModal(`<h3>Keyboard shortcuts</h3><div class="vlist">${rows.map(([k, d]) => `<div class="vrow"><span><kbd>${esc(k)}</kbd></span><span>${esc(d)}</span></div>`).join('')}</div><div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => { m.onclick = e => { if (e.target.closest('[data-m=ok]') || e.target.classList.contains('mback')) closeModal(); }; });
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); if (!$('#modal.on')) openPalette(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '');
  if (e.key === '?' && !typing && !$('#modal.on')) { e.preventDefault(); openShortcuts(); }
});
