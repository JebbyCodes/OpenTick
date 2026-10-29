/* OpenTick keyboard shortcuts: one list (SK) says which key does what; the same list drives the keys themselves, the searchable
   "Keyboard shortcuts" window (press ?) and the small key hints drawn on buttons. Phones and tablets without a keyboard never see any of it:
   on Android and iOS the keys are off and no hints are drawn. A setting (Settings → Keyboard) turns the hints off on a computer.

   A key is written 'Mod+Shift+P': Mod is Ctrl (Cmd on a Mac), then Shift / Alt, then the key. legacy: true = the key is handled elsewhere
   (older code in main.js / ui.js) and is listed here so it shows in the window and the hints. */
const SK_PHONE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
const SK_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test((navigator.platform || '') + ' ' + (navigator.userAgent || ''));
const skTyping = e => { const t = e.target || {}; return /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || !!t.isContentEditable; };
const skModal = () => !!$('#modal.on');
const skRow = () => $$('#main .task[data-id]').filter(r => !r.classList.contains('virt'));
function skMove(d) {
  const rows = skRow(); if (!rows.length) return; const i = rows.findIndex(r => r.dataset.id === U.sel), n = rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? (d > 0 ? 0 : rows.length - 1) : i + d))];
  U.sel = n.dataset.id; renderDetail(); $$('#main .task.sel').forEach(x => x.classList.remove('sel')); n.classList.add('sel'); if (n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
}
const skTask = () => (U.page === 'tasks' || U.page === 'calendar' || U.page === 'timetable' || U.page === 'matrix' || U.page === 'home') && U.sel ? getT(U.sel) : null;
const skPageGo = i => { const p = pagesShown()[i]; if (p) ACT.page({ dataset: { page: p[0] } }); };
const skCalPage = () => U.page === 'calendar' || U.page === 'timetable';
function skShift(d) {
  if (U.page === 'calendar') ACT[d < 0 ? 'calprev' : 'calnext']();
  else if (U.page === 'timetable') { if (typeof schoolOn === 'function' && schoolOn() && S.settings.tt.mode === 'school') SC_ACT.scwk({ dataset: { d } }); else ACT[d < 0 ? 'ttprev' : 'ttnext'](); }
}
function skToday() {
  if (U.page === 'calendar') ACT.caltoday();
  else if (U.page === 'timetable') { if (typeof schoolOn === 'function' && schoolOn() && S.settings.tt.mode === 'school') SC_ACT.scwk({ dataset: { d: 0 } }); else ACT.tttoday(); }
}

// [id, keys, label, group, when, run, legacy]
const SK_GROUPS = ['Go to', 'Create', 'Search & commands', 'Tasks', 'Calendar & timetable', 'Focus timer', 'Panels', 'Editing', 'This window'];
const SK = [
  ...Array.from({ length: 9 }, (_, i) => ({ id: 'go' + (i + 1), keys: [String(i + 1)], label: () => { const p = pagesShown()[i]; return p ? 'Go to ' + p[1] : 'Go to view ' + (i + 1); }, group: 'Go to', run: () => skPageGo(i), when: () => !!pagesShown()[i] })),
  { id: 'newtask', keys: ['n'], label: 'New task', group: 'Create', legacy: true },
  { id: 'newnote', keys: ['Shift+N'], label: 'New note', group: 'Create', run: () => { U.page = 'notes'; U.sel = null; render(); ACT.noteadd(); } },
  { id: 'newtpl', keys: ['Shift+T'], label: 'New template', group: 'Create', run: () => TPL_ACT.tpladd() },
  { id: 'newlist', keys: ['Shift+L'], label: 'New list', group: 'Create', run: () => ACT.addlist() },
  { id: 'search', keys: ['Mod+K', '/'], label: 'Search', group: 'Search & commands', legacy: true },
  { id: 'palette', keys: ['Mod+Shift+P'], label: 'Command palette', group: 'Search & commands', legacy: true },
  { id: 'settings', keys: ['Mod+,'], label: 'Settings', group: 'Search & commands', run: () => openSettings(), modal: false, typing: true },
  { id: 'complete', keys: ['x'], label: 'Complete or reopen the selected task', group: 'Tasks', run: () => { const t = skTask(); if (t) { toggleDone(t); save(); refresh(); } }, when: () => !!skTask() },
  { id: 'trash', keys: ['Delete'], label: 'Move the selected task to the bin', group: 'Tasks', run: () => ACT.del(), when: () => !!skTask() },
  { id: 'duetoday', keys: ['d'], label: 'Due today', group: 'Tasks', run: () => ACT.qdate({ dataset: { w: 'today' } }), when: () => !!skTask() },
  { id: 'duetom', keys: ['Shift+D'], label: 'Due tomorrow', group: 'Tasks', run: () => ACT.qdate({ dataset: { w: 'tomorrow' } }), when: () => !!skTask() },
  { id: 'rename', keys: ['e'], label: 'Edit the title of the selected task', group: 'Tasks', run: () => { const i = $('#detail .dtitle'); if (i) { i.focus(); if (i.select) i.select(); } }, when: () => !!skTask() },
  { id: 'next', keys: ['j'], label: 'Select the next task', group: 'Tasks', run: () => skMove(1), when: () => (U.page === 'tasks' || U.page === 'matrix') && skRow().length > 0 },
  { id: 'prev', keys: ['k'], label: 'Select the previous task', group: 'Tasks', run: () => skMove(-1), when: () => (U.page === 'tasks' || U.page === 'matrix') && skRow().length > 0 },
  { id: 'prevp', keys: ['ArrowLeft'], label: 'Previous day, week or month', group: 'Calendar & timetable', run: () => skShift(-1), when: skCalPage },
  { id: 'nextp', keys: ['ArrowRight'], label: 'Next day, week or month', group: 'Calendar & timetable', run: () => skShift(1), when: skCalPage },
  { id: 'today', keys: ['t'], label: 'Jump to today', group: 'Calendar & timetable', run: () => skToday(), when: skCalPage },
  { id: 'timer', keys: [' '], label: 'Start or pause the timer', group: 'Focus timer', run: () => { ACT.ptoggle(); renderMain(); }, when: () => U.page === 'focus' && !/^(BUTTON|A)$/.test((document.activeElement || {}).tagName || '') },
  { id: 'side', keys: ['['], label: 'Show or hide the sidebar', group: 'Panels', legacy: true },
  { id: 'detail', keys: [']'], label: 'Show or hide the task details', group: 'Panels', legacy: true },
  { id: 'focus', keys: ['\\'], label: 'Focus mode (hide both panels)', group: 'Panels', legacy: true },
  { id: 'esc', keys: ['Escape'], label: 'Close a window or the task details', group: 'Panels', legacy: true },
  { id: 'bold', keys: ['Mod+B'], label: 'Bold (in notes)', group: 'Editing', legacy: true },
  { id: 'italic', keys: ['Mod+I'], label: 'Italic (in notes)', group: 'Editing', legacy: true },
  { id: 'link', keys: ['Mod+K'], label: 'Link (in notes)', group: 'Editing', legacy: true, alsoText: true },
  { id: 'indent', keys: ['Tab', 'Shift+Tab'], label: 'Indent or outdent a list item (in notes)', group: 'Editing', legacy: true },
  { id: 'help', keys: ['?'], label: 'Show this list of shortcuts', group: 'This window', legacy: true },
];
const skLabel = s => (typeof s.label === 'function' ? s.label() : s.label);

/* ---- reading a key ---- */
const SK_NAMES = { ' ': 'Space', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', escape: 'Esc', delete: 'Del', tab: 'Tab', enter: 'Enter' };
function skParse(combo) {
  const parts = combo === '+' ? ['+'] : combo.split('+').filter(Boolean), key = parts.pop(), mods = new Set(parts); return { mod: mods.has('Mod'), shift: mods.has('Shift'), alt: mods.has('Alt'), key };
}
function skMatch(e, combo) {
  const c = skParse(combo), k = e.key == null ? '' : e.key;
  if (c.mod !== !!(e.ctrlKey || e.metaKey) || c.alt !== !!e.altKey) return false;
  const alnum = /^[a-z0-9]$/i.test(c.key);
  if (alnum || c.key.length > 1) { if (c.shift !== !!e.shiftKey) return false; } // letters, digits and named keys need Shift to match; symbols like ? and / ignore it
  return k.toLowerCase() === c.key.toLowerCase();
}
// how a key is shown: ['Ctrl', 'Shift', 'P'] or ['⌘', '⇧', 'P']
function skCaps(combo) {
  const c = skParse(combo), out = [];
  if (c.mod) out.push(SK_MAC ? '⌘' : 'Ctrl'); if (c.alt) out.push(SK_MAC ? '⌥' : 'Alt'); if (c.shift) out.push(SK_MAC ? '⇧' : 'Shift');
  out.push(SK_NAMES[c.key.toLowerCase()] || (c.key.length === 1 ? c.key.toUpperCase() : c.key)); return out;
}
const skKbd = combo => `<span class="skk">${skCaps(combo).map(x => `<kbd>${esc(x)}</kbd>`).join('')}</span>`;
const skById = id => SK.find(s => s.id === id);
const skFirst = id => { const s = skById(id); return s ? s.keys[0] : ''; };
const skText = combo => skCaps(combo).join(SK_MAC ? '' : '+');
const skOn = () => !SK_PHONE;
const skHints = () => skOn() && !((S.settings || {}).keys && S.settings.keys.hints === false);

/* ---- the keys ---- */
function skKey(e) {
  if (!skOn() || e.defaultPrevented || e.isComposing) return;
  const typing = skTyping(e), modal = skModal();
  for (const s of SK) {
    if (s.legacy || !s.run) continue;
    if (!s.keys.some(k => skMatch(e, k))) continue;
    if (typing && !s.typing) continue;
    if (modal && s.modal !== false) continue;
    if (s.when && !s.when()) continue;
    e.preventDefault(); s.run(e); return;
  }
}
document.addEventListener('keydown', skKey);

/* ---- hints on buttons: a small key cap, drawn after each render ----
   [selector, shortcut id or a function giving the combo]. The hint is only added once and never inside an input. */
const SK_HINTS = [
  ['#side .pages .pg', (el, i) => (i < 9 ? String(i + 1) : '')],
  ['[data-act=uitoggle][data-k=side]', () => '['], ['[data-act=uitoggle][data-k=detail]', () => ']'], ['[data-act=settings]', () => skFirst('settings')],
  ['#side .search', () => '/'], ['#add', () => 'n'],
  ['[data-act=noteadd]', () => 'Shift+N'], ['[data-act=tpladd]', () => 'Shift+T'], ['[data-act=addlist]', () => 'Shift+L'],
  ['[data-act=calprev],[data-act=ttprev]', () => 'ArrowLeft'], ['[data-act=calnext],[data-act=ttnext]', () => 'ArrowRight'], ['[data-act=caltoday],[data-act=tttoday]', () => 't'],
  ['[data-act=ptoggle]', () => ' '], ['#detail [data-act=del]', () => 'Delete'],
];
function skApplyHints(root) {
  if (typeof document === 'undefined' || !root || !root.querySelectorAll) return;
  const on = skHints(); document.documentElement.dataset.skhints = on ? 'on' : 'off'; if (!on) return;
  for (const [sel, fn] of SK_HINTS) {
    let els; try { els = [...root.querySelectorAll(sel)]; } catch (e) { continue; }
    els.forEach((el, i) => {
      if (el.dataset.skd || el.closest('input,textarea,select')) return;
      if (!el.dataset.lbl) el.dataset.lbl = el.title || el.getAttribute('aria-label') || '';
      const combo = fn(el, i); if (!combo) return; el.dataset.skd = '1';
      const tip = skText(combo); el.title = (el.title ? el.title.replace(/\s*\(.{1,24}\)$/, '') : el.getAttribute('aria-label') || '') + (el.title || el.getAttribute('aria-label') ? ' ' : '') + `(${tip})`;
      if (el.tagName === 'INPUT') { el.setAttribute('aria-keyshortcuts', tip); return; }
      el.setAttribute('aria-keyshortcuts', tip.replace(/\+/g, '+'));
      el.insertAdjacentHTML('beforeend', `<span class="skh" aria-hidden="true">${skCaps(combo).map(x => `<kbd>${esc(x)}</kbd>`).join('')}</span>`);
    });
  }
}
function skHintsStart() {
  if (typeof MutationObserver === 'undefined' || typeof window === 'undefined' || !skOn()) return;
  let t = 0; const roots = ['main', 'side', 'detail'].map(id => document.getElementById(id)).filter(Boolean);
  const run = () => { for (const r of roots) skApplyHints(r); };
  const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { obs.disconnect(); try { run(); } catch (e) { /* cosmetic */ } obs.takeRecords(); for (const r of roots) obs.observe(r, { childList: true, subtree: true }); }, 60); });
  for (const r of roots) obs.observe(r, { childList: true, subtree: true });
  setTimeout(run, 120);
}
function skHintsRefresh() { // after the setting changed: take the chips away or draw them
  $$('.skh').forEach(x => x.remove()); $$('[data-skd]').forEach(x => delete x.dataset.skd);
  skApplyHints(document.body);
}

/* ---- the window: searchable, grouped, with key caps ---- */
function skRowsHtml(q) {
  q = (q || '').toLowerCase().trim(); let h = '';
  for (const g of SK_GROUPS) {
    const rows = SK.filter(s => s.group === g && (!q || (skLabel(s) + ' ' + s.keys.map(skText).join(' ')).toLowerCase().includes(q)));
    if (!rows.length) continue;
    h += `<h4 class="sk-g">${esc(g)}</h4>` + rows.map(s => `<div class="sk-r"><span class="sk-l">${esc(skLabel(s))}</span><span class="sk-keys">${s.keys.filter(k => !(s.hide || []).includes(k)).map((k, i) => (i ? '<em>or</em>' : '') + skKbd(k)).join('')}</span></div>`).join('');
  }
  return h || '<p class="hint">No shortcut matches.</p>';
}
function openShortcuts() {
  const extra = [['Alt + arrow keys', 'Move the focused matrix task to another box'], ['Arrow keys (habit history)', 'Move between days'], ['Ctrl + scroll (Gantt)', 'Zoom the timeline'], ['Right-click', 'The same menu as the ⋯ button']];
  const on = !((S.settings.keys) && S.settings.keys.hints === false);
  openModal(`<h3>Keyboard shortcuts</h3>${skOn() ? '' : '<p class="hint">Keyboard shortcuts are for computers. They are switched off on phones and tablets.</p>'}
<div class="search sk-s">${ic('search', 16)}<input id="sk-q" placeholder="Find a shortcut" autocomplete="off" aria-label="Find a shortcut"></div>
<div class="sk-list" id="sk-l">${skRowsHtml('')}</div>
<div class="sk-extra">${extra.map(([k, d]) => `<div class="sk-r"><span class="sk-l">${esc(d)}</span><span class="sk-keys"><span class="sk-t">${esc(k)}</span></span></div>`).join('')}</div>
<label class="chkl sk-opt"><input type="checkbox" id="sk-hints"${on ? ' checked' : ''}> Show the keys on buttons</label>
<div class="mact"><span class="hint">Press <kbd>?</kbd> any time to open this.</span><span class="sp"></span><button class="pri" data-m="ok">Done</button></div>`, m => {
    const q = $('#sk-q', m); if (q && !narrow(700)) q.focus();
    m.oninput = e => { if (e.target.id === 'sk-q') $('#sk-l', m).innerHTML = skRowsHtml(e.target.value); };
    m.onchange = e => { if (e.target.id === 'sk-hints') { S.settings.keys = { ...(S.settings.keys || {}), hints: e.target.checked }; save(); skHintsRefresh(); } };
    m.onclick = e => { if (e.target.closest('[data-m=ok]') || e.target.classList.contains('mback')) closeModal(); };
  });
}
