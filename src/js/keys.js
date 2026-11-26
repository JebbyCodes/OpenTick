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
/* The number keys follow the buttons as they are drawn: the sidebar's grid (and the phone's tab bar) is ONE list of sections and pinned views, in the
   order the person put them, so key 3 is the third button whatever it is. (Before 0.9.0 only sections were counted, so with a pinned view among them the
   numbers on the buttons and the keys disagreed, and a pinned view could not be reached by its number at all.) */
const skNav = i => { const k = (typeof navShown === 'function' ? navShown() : [])[i]; return k || ''; };
function skNavLabel(i) { const k = skNav(i); if (!k) return ''; if (k.startsWith('pin:')) { const p = pinInfo(k.slice(4)); return p ? p.label : ''; } const s = navSecOf(k); return s ? s[1] : ''; }
function skPageGo(i) {
  const k = skNav(i); if (!k) return false;
  if (k.startsWith('pin:')) { pinGo(k.slice(4)); return true; }
  const sec = k.slice(4); U.pinKey = null; ACT.page({ dataset: { page: sectionTarget(sec), sec } }); return true;
}
// V / Shift+V: the next / previous view of the section you are in (List, Board, Matrix, Timeline …)
function skCycleView(d) { const sec = secOf(U.page); if (!sec) return; const vs = viewsOf(sec); if (vs.length < 2) return; const i = vs.indexOf(U.page); ACT.page({ dataset: { page: vs[(i + d + vs.length) % vs.length] } }); }
const skCalPage = () => U.page === 'calendar' || U.page === 'timetable';
function skShift(d) {
  if (U.page === 'calendar') ACT[d < 0 ? 'calprev' : 'calnext']();
  else if (U.page === 'timetable') { if (typeof schoolOn === 'function' && schoolOn() && S.settings.tt.mode === 'school') SC_ACT.scwk({ dataset: { d } }); else ACT[d < 0 ? 'ttprev' : 'ttnext'](); }
}
function skToday() {
  if (U.page === 'calendar') ACT.caltoday();
  else if (U.page === 'timetable') { if (typeof schoolOn === 'function' && schoolOn() && S.settings.tt.mode === 'school') SC_ACT.scwk({ dataset: { d: 0 } }); else ACT.tttoday(); }
}

// [id, keys, label, group, when, run, legacy]. repeat: ms = holding the key keeps going, at most once every so many ms (moving through tasks or weeks);
// without it a held key does its job once (see skHeldGuard below)
const SK_GROUPS = ['Go to', 'Create', 'Search & commands', 'Tasks', 'Calendar & timetable', 'Focus timer', 'Panels', 'Editing', 'This window'];
const SK = [
  ...Array.from({ length: 9 }, (_, i) => ({ id: 'go' + (i + 1), keys: [String(i + 1)], label: () => { const n = skNavLabel(i); return n ? 'Go to ' + n : 'Go to button ' + (i + 1); }, group: 'Go to', run: () => skPageGo(i), when: () => !!skNav(i) })),
  { id: 'viewnext', keys: ['v'], label: 'Next view in this section (List, Board, Matrix …)', group: 'Go to', run: () => skCycleView(1), when: () => { const s = secOf(U.page); return !!s && viewsOf(s).length > 1; } },
  { id: 'viewprev', keys: ['Shift+V'], label: 'Previous view in this section', group: 'Go to', run: () => skCycleView(-1), when: () => { const s = secOf(U.page); return !!s && viewsOf(s).length > 1; } },
  { id: 'newtask', keys: ['n'], label: 'New task', group: 'Create', run: () => { const a = $('#add'); if (a) a.focus(); }, when: () => !!$('#add') },
  { id: 'newnote', keys: ['Shift+N'], label: 'New note', group: 'Create', run: () => { U.page = 'notes'; U.sel = null; render(); ACT.noteadd(); } },
  { id: 'newtpl', keys: ['Shift+T'], label: 'New template', group: 'Create', run: () => TPL_ACT.tpladd() },
  { id: 'newlist', keys: ['Shift+L'], label: 'New list', group: 'Create', run: () => ACT.addlist() },
  { id: 'addtext', keys: ['Shift+A'], label: 'Add several from text (tasks, events, notes, habits …)', group: 'Create', run: () => tbOpen() },
  // (Mod+K is also Link inside a note; skKey leaves it to the editor there)
  { id: 'search', keys: ['Mod+K', '/'], label: 'Search', group: 'Search & commands', typing: true, modal: false, run: () => { const sq = $('#modal.on #setq'); if (sq) { sq.focus(); return; } if (!$('#modal.on')) openSearch(''); } },
  { id: 'palette', keys: ['Mod+Shift+P'], label: 'Command palette', group: 'Search & commands', typing: true, modal: false, run: () => { if (!$('#modal.on')) openPalette(); } },
  { id: 'settings', keys: ['Mod+,'], label: 'Settings', group: 'Search & commands', run: () => openSettings(), modal: false, typing: true },
  { id: 'complete', keys: ['x'], label: 'Complete or reopen the selected task', group: 'Tasks', run: () => { const t = skTask(); if (t) { toggleDone(t); save(); refresh(); } }, when: () => !!skTask() },
  { id: 'trash', keys: ['Delete'], label: 'Move the selected task to the bin', group: 'Tasks', run: () => ACT.del(), when: () => !!skTask() },
  { id: 'duetoday', keys: ['d'], label: 'Due today', group: 'Tasks', run: () => ACT.qdate({ dataset: { w: 'today' } }), when: () => !!skTask() },
  { id: 'duetom', keys: ['Shift+D'], label: 'Due tomorrow', group: 'Tasks', run: () => ACT.qdate({ dataset: { w: 'tomorrow' } }), when: () => !!skTask() },
  { id: 'rename', keys: ['e'], label: 'Edit the title of the selected task', group: 'Tasks', run: () => { const i = $('#detail .dtitle'); if (i) { i.focus(); if (i.select) i.select(); } }, when: () => !!skTask() },
  { id: 'next', keys: ['j'], label: 'Select the next task', group: 'Tasks', run: () => skMove(1), when: () => (U.page === 'tasks' || U.page === 'matrix') && skRow().length > 0, repeat: 60 },
  { id: 'prev', keys: ['k'], label: 'Select the previous task', group: 'Tasks', run: () => skMove(-1), when: () => (U.page === 'tasks' || U.page === 'matrix') && skRow().length > 0, repeat: 60 },
  { id: 'prevp', keys: ['ArrowLeft'], label: 'Previous day, week or month', group: 'Calendar & timetable', run: () => skShift(-1), when: skCalPage, repeat: 180 },
  { id: 'nextp', keys: ['ArrowRight'], label: 'Next day, week or month', group: 'Calendar & timetable', run: () => skShift(1), when: skCalPage, repeat: 180 },
  { id: 'today', keys: ['t'], label: 'Jump to today', group: 'Calendar & timetable', run: () => skToday(), when: skCalPage },
  { id: 'timer', keys: [' '], label: 'Start or pause the timer', group: 'Focus timer', run: () => { ACT.ptoggle(); renderMain(); }, when: () => U.page === 'focus' && !/^(BUTTON|A)$/.test((document.activeElement || {}).tagName || '') },
  { id: 'side', keys: ['['], label: 'Show or hide the sidebar', group: 'Panels', run: () => uiToggle('side') },
  { id: 'detail', keys: [']'], label: 'Show or hide the task details', group: 'Panels', run: () => uiToggle('detail') },
  { id: 'focus', keys: ['\\'], label: 'Focus mode (hide both panels)', group: 'Panels', run: () => uiFocus() },
  { id: 'esc', keys: ['Escape'], label: 'Close a window or the task details', group: 'Panels', legacy: true },
  { id: 'bold', keys: ['Mod+B'], label: 'Bold (in notes)', group: 'Editing', legacy: true },
  { id: 'italic', keys: ['Mod+I'], label: 'Italic (in notes)', group: 'Editing', legacy: true },
  { id: 'link', keys: ['Mod+K'], label: 'Link (in notes)', group: 'Editing', legacy: true, alsoText: true },
  { id: 'indent', keys: ['Tab', 'Shift+Tab'], label: 'Indent or outdent a list item (in notes)', group: 'Editing', legacy: true },
  { id: 'help', keys: ['?'], label: 'Show this list of shortcuts', group: 'This window', run: () => openShortcuts() },
  // more places to go and things to make; no key until the person chooses one (Settings → Keyboard)
  ...[['gotasks', 'tasks', 'Tasks'], ['gonotes', 'notes', 'Notes'], ['gocal', 'calendar', 'Calendar'], ['gohabits', 'habits', 'Habits'], ['goprojects', 'home', 'Projects'], ['gocontacts', 'contacts', 'Contacts'], ['gostats', 'stats', 'Statistics']].map(([id, sec, name]) => ({ id, keys: [], label: 'Go to ' + name, group: 'Go to', run: () => skGoSec(sec), when: () => (typeof secsAll === 'function' ? secsAll().some(x => x[0] === sec) : true) })),
  { id: 'newproject', keys: [], label: 'New project', group: 'Create', run: () => openProjectForm(null) },
];
function skGoSec(sec) { if (typeof secsAll === 'function' && !secsAll().some(x => x[0] === sec)) return; U.pinKey = null; ACT.page({ dataset: { page: sectionTarget(sec), sec } }); }
const skLabel = s => (typeof s.label === 'function' ? s.label() : s.label);

/* ---- reading a key ---- */
const SK_NAMES = { ' ': 'Space', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', escape: 'Esc', delete: 'Del', tab: 'Tab', enter: 'Enter' };
function skParse(combo) {
  combo = String(combo == null ? '' : combo); // (one step of a shortcut: 'Mod+Shift+P'; the key may be '+' itself, and Space is written ' ' or 'Space')
  const parts = combo === '+' ? ['+'] : combo.length > 1 && combo.endsWith('+') ? [...combo.slice(0, -1).split('+').filter(Boolean), '+'] : combo.split('+').filter(Boolean), key = parts.pop(), mods = new Set(parts); return { mod: mods.has('Mod'), shift: mods.has('Shift'), alt: mods.has('Alt'), key: key === 'Space' ? ' ' : key };
}
// the key an event stands for. Option (Alt) on a Mac types another character (Option+P is π) and a layout of another script types its own letters, so there the physical key decides.
function skKeyOf(e) {
  const k = e.key == null ? '' : String(e.key), code = e.code || '';
  if (code && (/^Key[A-Z]$/.test(code) || /^Digit\d$/.test(code)) && ((e.altKey && SK_MAC) || (k.length === 1 && k.charCodeAt(0) > 127))) return code.slice(-1).toLowerCase();
  return k;
}
function skMatch(e, combo) {
  const c = skParse(combo), k = skKeyOf(e);
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
const skKbd = combo => (typeof skSteps === 'function' ? skSteps(combo) : [combo]).map(st => `<span class="skk">${skCaps(st).map(x => `<kbd>${esc(x)}</kbd>`).join('')}</span>`).join('<em>then</em>');
// every action: the built-in ones, and "Go to / New entry in" for each custom or pack section (shortcuts.js)
const skAll = () => (typeof skDyn === 'function' ? SK.concat(skDyn()) : SK);
const skById = id => skAll().find(s => s.id === id);
// the keys an action answers to on this device: the default, or what the person chose (S.shortcuts, shortcuts.js)
const skKeysOf = s => (typeof skEffective === 'function' ? skEffective(s) : s.keys);
const skFirst = id => { const s = skById(id); return s ? skKeysOf(s)[0] || '' : ''; };
// the key shown on a button: the shortest one (a single key before a chord before a sequence)
function skHintKey(id) { const s = skById(id); if (!s) return ''; return skKeysOf(s).filter(k => skCanonSafe(k)).sort((a, b) => skWeight(a) - skWeight(b))[0] || ''; }
const skCanonSafe = k => (typeof skCanon === 'function' ? skCanon(k) : k);
const skWeight = k => { const st = typeof skSteps === 'function' ? skSteps(k) : [k]; return st.length * 10 + st.reduce((n, x) => { const c = skParse(x); return n + (c.mod ? 1 : 0) + (c.alt ? 1 : 0) + (c.shift ? 1 : 0); }, 0); };
const skText = combo => (typeof skSteps === 'function' ? skSteps(combo) : [combo]).map(st => skCaps(st).join(SK_MAC ? '' : '+')).join(' then ');
const skOn = () => !SK_PHONE;
const skHints = () => skOn() && !((S.settings || {}).keys && S.settings.keys.hints === false);

/* ---- the keys ----
   A shortcut is one key or chord ('Mod+Shift+P') or a sequence of them written with a space ('g t': press g, then t within a second and a half). The bindings
   come from skBindings() (shortcuts.js): defaults, the person's own choices, minus anything that conflicts or is not allowed on this computer. While you type in
   a field only a chord with Ctrl/Cmd or Alt can run, and only for an action made for it; inside a note the editor's own keys (bold, italic, link, indent) come first. */
const SKQ = { cands: null, n: 0, timer: 0 };
const skSeqReset = () => { SKQ.cands = null; SKQ.n = 0; clearTimeout(SKQ.timer); };
const skTypingOk = step => { const c = skParse(step); return c.mod || c.alt || /^F([1-9]|1[0-2])$/.test(c.key); }; // a bare key would be a letter being typed
const skEditing = e => { const t = e.target || {}; return !!(t.dataset && t.dataset.md !== undefined) || !!(t.closest && t.closest('.bed')); }; // a note being written
const SK_EDITOR_OWN = ['Mod+B', 'Mod+I', 'Mod+K', 'Tab', 'Shift+Tab'];
function skKey(e) {
  if (!skOn() || e.defaultPrevented || e.isComposing || (typeof SKR !== 'undefined' && SKR.on)) return;
  if (/^(Shift|Control|Alt|Meta|AltGraph|CapsLock|Dead)$/.test(e.key)) return;
  const typing = skTyping(e), modal = skModal(), editor = skEditing(e) && SK_EDITOR_OWN.some(k => skMatch(e, k));
  const B = typeof skBindings === 'function' ? skBindings() : [];
  const ok = b => !(typing && !(b.s.typing && skTypingOk(b.steps[0]))) && !(modal && b.s.modal !== false) && !editor;
  let n = SKQ.cands ? SKQ.n : 0, alive = (SKQ.cands || B).filter(b => b.steps[n] && skMatch(e, b.steps[n]) && ok(b));
  if (SKQ.cands && !alive.length) { skSeqReset(); if (e.key === 'Escape') return; n = 0; alive = B.filter(b => b.steps[0] && skMatch(e, b.steps[0]) && ok(b)); } // a wrong second key: start over with this one
  const full = alive.filter(b => b.steps.length === n + 1 && (!b.s.when || b.s.when())), part = alive.filter(b => b.steps.length > n + 1 && (!b.s.when || b.s.when()));
  if (full.length) {
    const s = full[0].s; skSeqReset(); e.preventDefault();
    if (e.repeat) { if (!s.repeat) return; const now = Date.now(); if (now - (s._at || 0) < s.repeat) return; s._at = now; } else if (s.repeat) s._at = Date.now(); // (a held key goes on only for the shortcuts made for it)
    s.run(e); return;
  }
  if (part.length && !e.repeat) { SKQ.cands = part; SKQ.n = n + 1; clearTimeout(SKQ.timer); SKQ.timer = setTimeout(skSeqReset, 1500); e.preventDefault(); return; }
  if (SKQ.cands) skSeqReset();
}
document.addEventListener('keydown', skKey);

/* ---- a held key is not a stream of presses ----
   Holding 2 used to go to Tasks over and over (the page flickered), holding Space started and paused the timer, holding Enter on a button clicked it again and
   again. Keys are repeated by the system while they are held; this runs before everything else (the capture phase of the window) and drops the repeats that
   mean nothing: the first press has already done its job. What stays: anything typed into a field (a held letter types more letters, Enter in a text box adds
   lines), moving (arrows, Page Up / Down, Home / End, Tab), j and k, which step through tasks, and Ctrl + Z / Y (undo as far as you like). Escape and Enter in a
   one-line field never repeat, and neither do the keys that open or toggle something (Ctrl + K, Ctrl + B ...). */
const SK_HOLD = /^(Arrow(Up|Down|Left|Right)|Page(Up|Down)|Home|End|Tab|Shift|Control|Alt|Meta|CapsLock)$/;
function skHeldGuard(e) {
  if (!e || !e.repeat) return false;
  const k = String(e.key == null ? '' : e.key), t = e.target || {}, tag = t.tagName || '';
  const area = tag === 'TEXTAREA' || !!t.isContentEditable, field = area || /^(INPUT|SELECT)$/.test(tag);
  let stop;
  if (k === 'Escape') stop = true;
  else if (k === 'Enter') stop = !area;               // Enter in a text area or the block editor is a new line; anywhere else it presses a button or submits a form once
  else if ((e.ctrlKey || e.metaKey) && /^[kpbi,]$/i.test(k)) stop = true;
  else if (e.altKey && /^Arrow/.test(k) && !field) stop = true; // Alt + arrows move a card or a task to another box: one step per press
  else if (field || SK_HOLD.test(k) || (/^[jk]$/.test(k) && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(k))) stop = false;
  else stop = true;
  if (!stop) return false;
  if (e.stopImmediatePropagation) e.stopImmediatePropagation(); if (e.stopPropagation) e.stopPropagation();
  if ((k !== ' ' || (typeof U !== 'undefined' && U.page === 'focus')) && e.preventDefault) e.preventDefault(); // (Space is left alone elsewhere, so that a held Space still scrolls a page)
  return true;
}
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', skHeldGuard, true);

/* ---- hints on buttons, drawn after each render ----
   [selector, shortcut or a function giving it]. Two kinds, so a shortcut is never shown twice at once:
   • where a label has room (the pages in the sidebar, a button with words on it, the search box) a small key cap sits there all the time;
   • an icon button has no room, so its shortcut is written at the end of its tooltip, "Settings (Ctrl+,)", and shows only while you hover it.
   Hovering therefore shows nothing but the tooltip. A hint is only added once and never inside an input. */
const SK_HINTS = [ // (the key shown is whatever the person has chosen for that action)
  ['#side .pages .pg', (el, i) => (i < 9 ? skHintKey('go' + (i + 1)) : '')],
  ['[data-act=uitoggle][data-k=side]', () => skHintKey('side')], ['[data-act=uitoggle][data-k=detail]', () => skHintKey('detail')], ['[data-act=settings]', () => skHintKey('settings')],
  ['#side .search', () => skHintKey('search')], ['#add', () => skHintKey('newtask')],
  ['[data-act=noteadd]', () => skHintKey('newnote')], ['[data-act=tpladd]', () => skHintKey('newtpl')], ['[data-act=addlist]', () => skHintKey('newlist')],
  ['[data-act=calprev],[data-act=ttprev]', () => skHintKey('prevp')], ['[data-act=calnext],[data-act=ttnext]', () => skHintKey('nextp')], ['[data-act=caltoday],[data-act=tttoday]', () => skHintKey('today')],
  ['[data-act=ptoggle]', () => skHintKey('timer')], ['#detail [data-act=del]', () => skHintKey('trash')],
];
// does this element have room for a key cap of its own? (icon buttons and the tiny "+" beside a heading do not)
const skRoomy = el => !(el.closest('.sec') || el.classList.contains('ib') || (el.tagName === 'INPUT'));
function skApplyHints(root) {
  if (typeof document === 'undefined' || !root || !root.querySelectorAll) return;
  const on = skHints(); document.documentElement.dataset.skhints = on ? 'on' : 'off'; if (!on) return;
  for (const [sel, fn] of SK_HINTS) {
    let els; try { els = [...root.querySelectorAll(sel)]; } catch (e) { continue; }
    els.forEach((el, i) => {
      if (el.dataset.skd || el.closest('input,textarea,select')) return;
      const combo = fn(el, i); if (!combo) return; el.dataset.skd = '1';
      const tip = skText(combo), flat = (typeof skSteps === 'function' ? skSteps(combo) : [combo]).flatMap(st => skCaps(st)); if (flat.length === skCaps(combo).length) el.setAttribute('aria-keyshortcuts', tip);
      if (el.tagName === 'INPUT' || skRoomy(el)) {
        if (el.tagName !== 'INPUT') el.insertAdjacentHTML('beforeend', `<span class="skh" aria-hidden="true">${flat.map(x => `<kbd>${esc(x)}</kbd>`).join('')}</span>`);
        return;
      }
      const base = (el.getAttribute('title') || el.getAttribute('aria-label') || '').replace(/\s*\(.{1,24}\)$/, '');
      if (!el.dataset.lbl) el.dataset.lbl = base; el.dataset.sktBase = el.getAttribute('title') || ''; el.dataset.skt = tip; el.setAttribute('title', base ? `${base} (${tip})` : `(${tip})`);
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
function skHintsRefresh() { // after the setting changed: take the chips and the tooltip keys away, or draw them
  $$('.skh').forEach(x => x.remove());
  $$('[data-skd]').forEach(x => { if (x.dataset.skt != null) { if (x.dataset.sktBase) x.setAttribute('title', x.dataset.sktBase); else x.removeAttribute('title'); delete x.dataset.skt; delete x.dataset.sktBase; } x.removeAttribute('aria-keyshortcuts'); delete x.dataset.skd; });
  skApplyHints(document.body);
}

/* ---- the window: searchable, grouped, with key caps ---- */
const SK_CATS = ['Navigation', 'Tasks', 'Notes', 'Calendar', 'Habits', 'Projects', 'General', 'Editing', 'Pack & custom sections'];
const SK_CAT = { viewnext: 'Navigation', viewprev: 'Navigation', gotasks: 'Navigation', gonotes: 'Navigation', gocal: 'Navigation', gohabits: 'Navigation', goprojects: 'Navigation', gocontacts: 'Navigation', gostats: 'Navigation',
  newtask: 'Tasks', newlist: 'Tasks', complete: 'Tasks', trash: 'Tasks', duetoday: 'Tasks', duetom: 'Tasks', rename: 'Tasks', next: 'Tasks', prev: 'Tasks', newnote: 'Notes', newtpl: 'Notes', prevp: 'Calendar', nextp: 'Calendar', today: 'Calendar',
  timer: 'Habits', newproject: 'Projects', bold: 'Editing', italic: 'Editing', link: 'Editing', indent: 'Editing' };
const skCat = s => s.cat || (/^go\d$/.test(s.id) ? 'Navigation' : SK_CAT[s.id]) || 'General';
const skFixed = s => !!s.legacy; // handled by the editor or by the window itself (Esc, bold, italic, link, indent): shown, not changeable
function skRowsHtml(q) {
  q = (q || '').toLowerCase().trim(); let h = '';
  for (const g of SK_CATS) {
    const rows = skAll().filter(s => skCat(s) === g && (!q || (skLabel(s) + ' ' + (typeof SK_DESC !== 'undefined' ? SK_DESC[s.id] || '' : '') + ' ' + skKeysOf(s).map(skText).join(' ')).toLowerCase().includes(q)));
    if (!rows.length) continue;
    h += `<h4 class="sk-g">${esc(g)}</h4>` + rows.map(s => { const ks = skKeysOf(s).filter(k => !(s.hide || []).includes(k)); return `<div class="sk-r"><span class="sk-l">${esc(skLabel(s))}</span><span class="sk-keys">${ks.length ? ks.map((k, i) => (i ? '<em>or</em>' : '') + skKbd(k)).join('') : '<span class="sk-t">no shortcut</span>'}</span></div>`; }).join('');
  }
  return h || '<p class="hint">No shortcut matches.</p>';
}
function openShortcuts() {
  const extra = [['Alt + arrow keys', 'Move the focused matrix task to another box'], ['Arrow keys (habit history)', 'Move between days'], ['Ctrl + scroll (Timeline)', 'Zoom the timeline'], ['Right-click', 'The same menu as the ⋯ button']];
  const on = !((S.settings.keys) && S.settings.keys.hints === false);
  openModal(`<h3>Keyboard shortcuts</h3>${skOn() ? '' : '<p class="hint">Keyboard shortcuts are for computers. They are switched off on phones and tablets.</p>'}
<div class="search sk-s">${ic('search', 16)}<input id="sk-q" placeholder="Find a shortcut" autocomplete="off" aria-label="Find a shortcut"></div>
<div class="sk-list" id="sk-l">${skRowsHtml('')}</div>
<div class="sk-extra">${extra.map(([k, d]) => `<div class="sk-r"><span class="sk-l">${esc(d)}</span><span class="sk-keys"><span class="sk-t">${esc(k)}</span></span></div>`).join('')}</div>
<label class="chkl sk-opt"><input type="checkbox" id="sk-hints"${on ? ' checked' : ''}> Show the keys on buttons</label>
<div class="mact"><span class="hint">Press <kbd>?</kbd> any time to open this.</span><span class="sp"></span><button data-m="custom">Change them…</button><button class="pri" data-m="ok">Done</button></div>`, m => {
    const q = $('#sk-q', m); if (q && !narrow(700)) q.focus();
    m.oninput = e => { if (e.target.id === 'sk-q') $('#sk-l', m).innerHTML = skRowsHtml(e.target.value); };
    m.onchange = e => { if (e.target.id === 'sk-hints') { S.settings.keys = { ...(S.settings.keys || {}), hints: e.target.checked }; save(); skHintsRefresh(); } };
    m.onclick = e => { if (e.target.closest('[data-m=custom]')) { closeModal(); openSettings('keys'); } else if (e.target.closest('[data-m=ok]') || e.target.classList.contains('mback')) closeModal(); };
  });
}
