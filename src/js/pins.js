/* OpenTick pinned views: any view tab or page title can be added next to the sections (Projects, Tasks, Notes, Calendar, Habits, Contacts …).
   Right-click a tab or a page's title on a computer, or press and hold it on a touch screen, and choose "Pin … to the sidebar" (the tab bar on a
   phone). The pin is a shortcut: the tab stays where it was. Right-click or press and hold the pinned button to move or unpin it.

   A pin is a short key kept in S.settings.ui.pins, so it is a layout choice and stays on this device, like the order of the sections:
     page:<view>        a view of a section: page:kanban, page:matrix, page:gantt, page:templates, page:countdowns, page:zones, page:focus …
     cal:<mode>         one way of looking at the Calendar: cal:month, cal:week, cal:3day, cal:day, cal:agenda
     school             the Classes page (called whatever it was renamed to)
     school:<tab>       one page of Classes: school:exam, school:hw, school:subj …
   Where a pin sits among the buttons is not part of the pin: sections and pins are one list, in one order (ui.js: navKeys), so a pin can be
   put between any two sections, with the arrows in Settings → Layout, with Move earlier / later in the menu, or by dragging.
   A pinned button is lit only when you got there with it. If you press the section it belongs to (Calendar, for a pinned Week or Classes) that
   section is the lit one and the pin is not, even though you may land on the very view that is pinned.
   Nothing here touches the data, so nothing about sync or encryption changes: the list lives in the settings, which are sealed with the rest
   of the data when device encryption is on and are never part of the sync file. */
const PIN_MAX = 10;
const PIN_RE = /^(page:[a-z]{2,12}|cal:[a-z0-9]{2,8}|school(:[a-z]{2,8})?)$/;
const PIN = { press: null, timer: 0, fired: false };
const pinList = () => { const u = S.settings.ui; return Array.isArray(u.pins) ? u.pins : (u.pins = []); };
const pinTouch = () => typeof ctxTouch === 'function' && ctxTouch();
const pinWhere = () => (pinTouch() || (typeof narrow === 'function' && narrow(820)) ? 'tab bar' : 'sidebar');
// the page of Classes that is showing (the same rule renderSchool uses)
const pinSchoolTab = () => (SC_TABS.some(x => x[0] === U.scTab) ? U.scTab : (scHas() ? 'today' : 'week'));
const pinInSchool = () => U.page === 'timetable' && schoolOn();

// key -> { key, label, icon, tip, active(), go() }, or null when the key means nothing (an old or damaged entry is simply not shown)
function pinInfo(key) {
  const m = /^(page|cal|school)(?::([a-z0-9]+))?$/.exec(String(key || '')); if (!m) return null;
  const [, kind, arg] = m;
  if (kind === 'page') {
    if (!arg || !VIEW_TAB[arg] || arg === 'home' || arg === 'calendar' || arg === 'timetable') return null;
    const label = arg === 'tasks' ? 'Task list' : VIEW_TAB[arg][0], sec = SECTIONS.find(s => s[3].includes(arg));
    return { key, label, icon: VIEW_TAB[arg][1], tip: (sec && sec[1] !== label ? sec[1] + ' › ' : '') + label, active: () => U.page === arg, go: () => ACT.page({ dataset: { page: arg }, keepPin: true }) };
  }
  if (kind === 'cal') {
    const c = CAL_MODES.find(x => x[0] === arg); if (!c) return null;
    return { key, label: c[1], icon: c[2], tip: 'Calendar › ' + c[1], active: () => (U.page === 'calendar' || U.page === 'timetable') && calMode() === c[0], go: () => calGo(c[0]) };
  }
  if (!arg) return { key, label: scName(), icon: 'graduation', tip: scName(), active: pinInSchool, go: () => ACT.scmode({ dataset: { m: 'school' } }) };
  const t = SC_TABS.find(x => x[0] === arg); if (!t) return null;
  return { key, label: t[1], icon: t[2], tip: scName() + ' › ' + t[1], active: () => pinInSchool() && pinSchoolTab() === arg, go: () => { U.scTab = arg; ACT.scmode({ dataset: { m: 'school' } }); } };
}
const pinsShown = () => pinList().map(pinInfo).filter(Boolean);
// the pin you got to by pressing it, while you are still on its view (the section's own button then stays quiet, so only one button is lit).
// U.pinKey is set by pinGo and cleared as soon as you go anywhere by another way (a section, a tab, a key, the palette).
const pinActive = () => { const k = U.pinKey; if (!k) return null; const p = pinsShown().find(x => x.key === k); return p && p.active() ? p : null; };
// the key for the page you are on, used by a page's title and the command palette: only pages that are a view of their own
function pinHere() {
  if (U.page === 'timetable') return schoolOn() ? 'school' : 'cal:' + (typeof ttView === 'function' ? ttView() : 'week');
  if (U.page === 'calendar') return 'cal:' + calView();
  return pinInfo('page:' + U.page) && U.page !== 'tasks' ? 'page:' + U.page : null;
}
// the thing under a right-click or a finger -> the key it stands for
function pinKeyOf(el) {
  if (!el || !el.closest) return null;
  const tab = el.closest('.vtabs [role=tab]');
  if (tab) { const a = tab.dataset.act; return a === 'page' ? 'page:' + tab.dataset.page : a === 'calview' || a === 'ttview' ? 'cal:' + tab.dataset.v : a === 'scmode' ? 'school' : null; }
  const sc = el.closest('.sc-tabs [data-act=sctab]'); if (sc) return 'school:' + sc.dataset.t;
  if (el.closest('header.top h1')) return pinHere();
  return null;
}

/* ---------- changing the list ---------- */
function pinRefresh() { if (typeof renderSide === 'function') renderSide(); if (typeof renderTabbar === 'function') renderTabbar(); const b = typeof $ === 'function' ? $('#sbv') : null; if (b && typeof uiSidebarSettings === 'function') b.innerHTML = uiSidebarSettings(); }
function pinToggle(key) {
  const p = pinInfo(key); if (!p) return false;
  const ks = pinList(), i = ks.indexOf(key);
  if (i >= 0) { ks.splice(i, 1); S.settings.ui.navOrder = (S.settings.ui.navOrder || []).filter(k => k !== 'pin:' + key); /* pinning it again puts it last */ save(); pinRefresh(); toast(`Unpinned “${p.label}”`); return false; }
  if (ks.length >= PIN_MAX) { toast(`You can pin up to ${PIN_MAX} views. Unpin one first.`); return false; }
  ks.push(key); save(); pinRefresh(); sfx('add'); toast(`Pinned “${p.label}” next to the other sections. ${pinTouch() ? 'Press and hold' : 'Right-click'} it to unpin.`);
  return true;
}
// moving a pin is moving a button: the pin sits in the same list as the sections
function pinMove(key, d) { if (navMove('pin:' + key, d)) pinRefresh(); }
function pinReorder(from, to) { if (navReorder('pin:' + from, 'pin:' + to)) pinRefresh(); }
function pinGo(key) {
  const p = pinInfo(key); if (!p) return;
  if (U.bsel) { U.bsel = null; document.body.classList.remove('batch'); }
  U.sel = null; document.body.classList.remove('drawer'); U.pinKey = key; p.go();
}
const PIN_ACT = { pingo: el => pinGo(el.dataset.pin) };

/* ---------- the buttons ---------- */
// one pinned button; where = 'side' (the grid under the search box) or 'bar' (the phone's tab bar)
function pinButtonHtml(p, where) {
  const on = p.active() && U.pinKey === p.key, nk = 'pin:' + p.key;
  return where === 'bar'
    ? `<button class="pin${on ? ' on' : ''}" data-act="pingo" data-pin="${esc(p.key)}" data-nk="${esc(nk)}">${ic(p.icon, 22)}<small>${esc(p.label)}</small></button>`
    : `<button class="pg pin${on ? ' on' : ''}" data-act="pingo" data-pin="${esc(p.key)}" data-nk="${esc(nk)}"${pinTouch() ? '' : ` title="${esc(p.tip)} (pinned) — drag to reorder, right-click to unpin" draggable="true"`}>${ic(p.icon, 20)}<small>${esc(p.label)}</small></button>`;
}
const pinsHtml = where => pinsShown().map(p => pinButtonHtml(p, where)).join('');

/* ---------- Settings → Layout ---------- */
// the pins are listed with the sections, in their one order (ui.js: uiSidebarSettings); this is the line that explains how to add one
function pinSettingsHtml() {
  return `<p class="hint">Right-click (or press and hold) any view tab or page title, such as Board, Week or ${esc(typeof scName === 'function' ? scName() : 'Classes')}, and choose Pin to put it next to the sections. Pins are kept on this device.</p>`;
}

/* ---------- the menus ---------- */
// the buttons of the grid and the tab bar (sections and pins alike): open, move, and hide or unpin
function pinCtxItems(target) {
  if (!target || !target.closest) return null;
  const own = target.closest('.pg[data-nk],#tabbar [data-nk]');
  if (own) {
    const nk = own.dataset.nk, all = navShown(), i = all.indexOf(nk); if (i < 0) return null;
    const move = [...(i > 0 ? [{ label: 'Move earlier', icon: 'left', run: () => { navMove(nk, -1); pinRefresh(); } }] : []), ...(i < all.length - 1 ? [{ label: 'Move later', icon: 'right', run: () => { navMove(nk, 1); pinRefresh(); } }] : [])];
    if (nk.startsWith('pin:')) { const key = nk.slice(4), p = pinInfo(key); if (!p) return null; return [{ label: 'Open', icon: 'eye', run: () => pinGo(key) }, ...move, { sep: true }, { label: `Unpin “${p.label}”`, icon: 'x', run: () => pinToggle(key) }]; }
    const sec = nk.slice(4), s = navSecOf(nk); if (!s) return null;
    return [{ label: 'Open', icon: 'eye', run: () => ACT.page({ dataset: { page: sectionTarget(sec) } }) }, ...move, { sep: true },
      { label: 'Hide this section', icon: 'x', run: () => { const h = S.settings.ui.hidePages; for (const k of s[3]) if (!h.includes(k)) h.push(k); save(); if (secOf(U.page) === sec) { U.page = sec === 'tasks' ? 'home' : 'tasks'; } render(); toast('Hidden. Settings → Layout brings it back.'); } }];
  }
  const key = pinKeyOf(target), p = key && pinInfo(key); if (!p) return null;
  return [{ label: pinList().includes(key) ? `Unpin “${p.label}”` : `Pin “${p.label}” to the ${pinWhere()}`, icon: 'pin', run: () => pinToggle(key) }];
}

/* ---------- touch: press and hold ----------
   A finger that moves before the hold counts is a scroll or a swipe and does nothing. The hold opens the same menu a right-click does and the
   lift that ends it is not a tap. This file is loaded before ctxmenu.js so that this click handler runs first. */
const PIN_HOLD = '.pg[data-nk],#tabbar [data-nk],.vtabs [role=tab],.sc-tabs [data-act=sctab],header.top h1';
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || e.isPrimary === false || !e.target || !e.target.closest) return;
  clearTimeout(PIN.timer); PIN.press = null; PIN.fired = false;
  const el = e.target.closest(PIN_HOLD); if (!el) return;
  PIN.press = { el, x: e.clientX, y: e.clientY };
  PIN.timer = setTimeout(() => {
    const p = PIN.press; if (!p) return;
    let items = null; try { items = pinCtxItems(p.el); } catch (x) { items = null; }
    if (!items) { PIN.press = null; return; }
    PIN.fired = true; PIN.press = null;
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (x) { /* no vibration */ }
    ctxOpen(p.x, p.y + 10, items);
  }, 480);
}, true);
document.addEventListener('pointermove', e => {
  if (!PIN.press || e.pointerType !== 'touch') return;
  if (Math.abs(e.clientX - PIN.press.x) > 10 || Math.abs(e.clientY - PIN.press.y) > 10) { clearTimeout(PIN.timer); PIN.press = null; }
}, true);
const pinLift = () => { clearTimeout(PIN.timer); PIN.press = null; if (PIN.fired) setTimeout(() => { PIN.fired = false; }, 700); };
document.addEventListener('pointerup', pinLift, true);
document.addEventListener('pointercancel', pinLift, true);
document.addEventListener('click', e => { if (PIN.fired) { PIN.fired = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
// some browsers still send the mouse events after a long press; the one that would close the menu we just opened is dropped here
document.addEventListener('mousedown', e => { if (PIN.fired) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
document.addEventListener('contextmenu', e => { if (PIN.press || PIN.fired) e.preventDefault(); }, true); // the system's own text menu must not open over ours

/* Dragging a pinned button (or a section) to reorder is one handler for both: ui.js. */
