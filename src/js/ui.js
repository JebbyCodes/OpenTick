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
  b.toggle('shide', !u.side); b.toggle('dhide', !u.detail); b.toggle('compact', u.density === 'compact'); b.toggle('roomy', u.density === 'roomy'); b.toggle('dauto', !!(u.autoDetail && !U.sel));
}
function uiInit() {
  const app = $('#app'); if (!app || !app.appendChild) return; // (the test harness has no real DOM)
  for (const [id, k, label] of [['rs-side', 'side', 'sidebar'], ['rs-detail', 'detail', 'details panel']]) {
    const d = document.createElement('div');
    d.className = 'rs'; d.id = id; d.dataset.rs = k; d.tabIndex = 0; d.title = 'Drag to resize · double-click to reset';
    d.setAttribute('role', 'separator'); d.setAttribute('aria-orientation', 'vertical'); d.setAttribute('aria-label', 'Resize ' + label);
    app.appendChild(d);
  }
  const dk = document.createElement('div'); dk.id = 'dock'; dk.innerHTML = '<div id="clock" role="button" tabindex="0" data-act="page" data-page="zones"></div><div id="dsync"></div>'; document.body.appendChild(dk);
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
  if (!Sync.on) { icon = 'cloud'; cls = 'off'; tip = vaultScope('local') ? 'Sync is off — everything is saved on this device, encrypted. Click to set up sync.' : 'Sync is off — everything is saved on this device. Click to set up sync.'; }
  else if (s === 'busy') { icon = 'refresh'; cls = 'busy'; tip = 'Syncing…'; txt = 'Syncing…'; }
  else if (s === 'error' || s === 'offline') { icon = 'cloud-off'; cls = 'err'; tip = Sync.msg || 'Offline'; txt = s === 'offline' ? 'Offline' : 'Sync problem'; }
  else { icon = 'cloud-check'; cls = 'ok'; tip = Sync.cfg.last ? 'Synced ' + ago(Sync.cfg.last) + ' — click to sync now' : 'Sync is on — click to sync now'; }
  if (DOCK.pending && !txt) txt = 'Saving…';
  else if (saved && !txt) txt = 'Saved';
  if (Sync.on) tip += encTip(); // "· Encrypted end to end"
  const html = `<span class="dtxt${txt ? ' show' : ''}${txt === 'Saved' ? ' saved' : ''}${txt === 'Saving…' ? ' saving' : ''}" aria-live="polite">${txt === 'Saved' ? ic('check', 12) : ''}${esc(txt)}</span><button class="ib dsb ${cls}${vaultOn() ? ' enc' : ''}" data-act="syncdock" title="${esc(tip)}" aria-label="${esc(tip)}">${ic(icon, 18)}${encMark()}</button>`;
  if (el._h !== html) { el._h = html; el.innerHTML = html; }
}

/* ---------- date & time readout ----------
   A small, click-through readout. With the sidebar docked it sits at the foot of the sidebar (where nothing else lives);
   with the sidebar hidden, or on a phone, it becomes a faint pill in the bottom-left corner. Settings -> Clock. */
function clockParts(d = new Date()) {
  const c = S.settings.clock, h = d.getHours();
  const time = (c.h24 ? pad(h) : String(h % 12 || 12)) + ':' + pad(d.getMinutes()) + (c.sec ? ':' + pad(d.getSeconds()) : '');
  return { time, ap: c.h24 ? '' : h < 12 ? 'AM' : 'PM', date: `${FULLDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, short: `${FULLDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}` };
}
function clockPaint() {
  const el = document.getElementById ? document.getElementById('clock') : null; if (!el) return;
  const on = S.settings.clock.on !== false; el.hidden = !on; if (!on) return;
  const p = clockParts(), html = `<b>${p.time}${p.ap ? `<span>${p.ap}</span>` : ''}</b><small class="cd-l">${p.date}</small><small class="cd-s">${p.short}</small>`;
  if (el._h !== html) { el._h = html; el.innerHTML = html; }
  // the clock is the way in to Time zones: its tip lists the saved places and what time it is there
  let tip = 'Time zones'; try { const z = (S.zones || []).filter(x => tzValid(x.tz)).slice(0, 5); if (z.length) tip += ': ' + z.map(x => `${tzLabel(x)} ${tzFmt(Date.now(), x.tz)}`).join(' · '); } catch (e) { /* the plain tip */ }
  if (el._t !== tip) { el._t = tip; el.title = tip; el.setAttribute('aria-label', tip + '. ' + p.time + (p.ap || '') + ', ' + p.date); }
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
/* Sections: the groups the sidebar and tab bar show. A view is hidden with its checkbox in Settings → Layout; a section shows while any of its
   views does (and always while you are in it). The built-in sections are SECTIONS; the ones a person (or a pack) made are in S.csections and
   look the same here: [id, name, icon, [id]] with the section's own id as its one page (xsections.js). */
const secsAll = () => (typeof csecEntries === 'function' ? SECTIONS.concat(csecEntries()) : SECTIONS);
const secOf = page => { const s = secsAll().find(x => x[3].includes(page)); return s ? s[0] : null; };
// the name and icon of a view, built in or not: [label, icon]
const viewTab = k => VIEW_TAB[k] || (typeof csecEntries === 'function' ? (csecEntries().find(s => s[0] === k) || []).slice(1, 3) : []);

/* ---------- the order of the buttons ----------
   Everything in the sidebar's button grid and the phone's tab bar is one ordered list of "nav keys": 'sec:<id>' for a section (a built-in one
   or a custom one) and 'pin:<key>' for a pinned view (pins.js). They are mixed freely, so a pin can sit between two sections. The order is a
   layout choice, kept per device in S.settings.ui.navOrder. Until it is first changed (and for anyone coming from an older version) the
   sections follow the old saved page order, with the pins after them. Whatever is missing from the saved list is added, whatever no longer
   exists is dropped: a new section joins after the last section, a new pin goes to the end. */
function navSectionsDefault() {
  const order = pageOrder(), at = s => { const i = Math.min(...s[3].map(k => order.indexOf(k))); return i < 0 ? 1e6 : i; };
  return secsAll().slice().sort((a, b) => at(a) - at(b)); // (stable: sections made later stay in the order they were made)
}
function navKeys() {
  const u = S.settings.ui, secs = navSectionsDefault().map(s => 'sec:' + s[0]), pins = (typeof pinList === 'function' ? pinList() : []).filter(k => typeof pinInfo !== 'function' || pinInfo(k)).map(k => 'pin:' + k);
  const valid = new Set([...secs, ...pins]), out = [], have = new Set();
  for (const k of Array.isArray(u.navOrder) ? u.navOrder : []) if (typeof k === 'string' && valid.has(k) && !have.has(k)) { have.add(k); out.push(k); }
  if (!out.length) return [...secs, ...pins];
  const lastSec = out.map(k => k.startsWith('sec:')).lastIndexOf(true), newSecs = secs.filter(k => !have.has(k));
  out.splice(lastSec + 1, 0, ...newSecs);
  return [...out, ...pins.filter(k => !have.has(k))];
}
const navSecOf = k => (k.startsWith('sec:') ? secsAll().find(s => s[0] === k.slice(4)) || null : null);
function navSave(keys) {
  const u = S.settings.ui; u.navOrder = keys;
  // the old page order is kept in step (it is what older saved layouts and the sections' own order are read from)
  u.pageOrder = keys.filter(k => k.startsWith('sec:')).flatMap(k => (SECTIONS.find(s => s[0] === k.slice(4)) || [, , , []])[3]);
  // and the pinned views keep their own order too (relative to each other), which is what ui.pins holds
  if (Array.isArray(u.pins)) { const po = keys.filter(k => k.startsWith('pin:')).map(k => k.slice(4)); u.pins = [...po.filter(k => u.pins.includes(k)), ...u.pins.filter(k => !po.includes(k))]; }
  save();
}
// is this button showing? a section with every view hidden is not (but is while you are in it); a pin shows while it still means something
const navVisible = k => (k.startsWith('sec:') ? !!navSecOf(k) && viewsOf(k.slice(4)).length > 0 : typeof pinInfo === 'function' && !!pinInfo(k.slice(4)));
const navShown = () => navKeys().filter(navVisible);
function sectionsAll() { return navKeys().filter(k => k.startsWith('sec:')).map(navSecOf).filter(Boolean); }
const viewsOf = sec => {
  const s = secsAll().find(x => x[0] === sec), hid = S.settings.ui.hidePages; if (!s) return [];
  const out = s[3].filter(k => !hid.includes(k) || k === U.page);
  // the Calendar is one view whose week and day are the old Timetable: it shows unless both of those were hidden (older saved layouts have two switches)
  if (sec === 'calendar') { const rest = out.filter(k => k !== 'timetable'); if (!rest.includes('calendar') && out.includes('timetable')) rest.unshift('calendar'); return rest; }
  return out;
};
const sectionsShown = () => sectionsAll().filter(s => viewsOf(s[0]).length);
// the view a section opens on: the one you used last in it, else its first
function sectionTarget(sec) {
  const vs = viewsOf(sec), last = (U.secLast || {})[sec];
  return vs.includes(last) || (last === 'timetable' && vs.includes('calendar')) ? last : vs[0] || (secsAll().find(x => x[0] === sec) || [, , , ['tasks']])[3][0];
}
// move one button up (d = -1) or down (d = 1) among the ones that show: hidden sections are stepped over, so a press always changes something you can see
function navMove(key, d) {
  const all = navKeys(), i = all.indexOf(key); if (i < 0) return false;
  let j = i + d; if (j < 0 || j >= all.length) return false;
  if (Math.abs(d) === 1) { while (j >= 0 && j < all.length && !navVisible(all[j])) j += d; if (j < 0 || j >= all.length) return false; }
  all.splice(i, 1); all.splice(j, 0, key); navSave(all); return true;
}
// put `key` where `to` is (drag and drop: it takes the place of the one it lands on)
function navReorder(key, to) {
  const all = navKeys(), i = all.indexOf(key), j = all.indexOf(to); if (i < 0 || j < 0 || i === j) return false;
  all.splice(i, 1); all.splice(j, 0, key); navSave(all); return true;
}
const uiMoveSection = (sec, d) => navMove('sec:' + sec, d);
// Settings → Appearance: how much space the interface leaves around things, and whether the details panel waits for a task
function densitySetting() {
  const u = S.settings.ui;
  return `<div class="a11y-r"><span><b>Spacing</b><small>Roomy gives lists, menus and panels more air. Compact fits more on screen.</small></span><select data-pf="ui.density">${opts([['roomy', 'Roomy'], ['standard', 'Standard'], ['compact', 'Compact']], u.density)}</select></div>`
    + `<label class="a11y-r tg"><span><b>Show the details panel only when a task is picked</b><small>Gives the main view the full width the rest of the time.</small></span><input type="checkbox" data-pf="ui.autoDetail"${u.autoDetail ? ' checked' : ''}></label>`;
}
// the page grid shows two rows of four; the rest sit behind "More" (the page you are on is always shown)
const PG_MAX = 8;
function pagesGrid() { return sectionsShown().map(([k, n, i]) => [k, n, i]); }
const pagesMoreBtn = () => '';
// one button of the grid or the tab bar: a section or a pinned view (where = 'side' or 'bar')
function navButtonHtml(key, where) {
  if (key.startsWith('pin:')) { const p = pinInfo(key.slice(4)); return p ? pinButtonHtml(p, where) : ''; }
  const s = navSecOf(key); if (!s) return '';
  const [k, n, i] = s, on = secOf(U.page) === k && !pinActive(), ico = (typeof iconAny === 'function' ? iconAny : (x, z) => ic(x, z));
  return where === 'bar'
    ? `<button class="${on ? 'on' : ''}" data-act="page" data-page="${esc(sectionTarget(k))}" data-sec="${esc(k)}" data-nk="${esc(key)}">${ico(i, 22)}<small>${esc(n)}</small></button>`
    : `<button class="pg${on ? ' on' : ''}" data-act="page" data-page="${esc(sectionTarget(k))}" data-sec="${esc(k)}" data-nk="${esc(key)}" title="${esc(n)} — drag to reorder" draggable="true">${ico(i, 20)}<small>${esc(n)}</small></button>`;
}
const navHtml = where => navShown().map(k => navButtonHtml(k, where)).join('');
// Settings → Layout: every button in the order it has, each with the arrows that move it; sections also list their views
function uiSidebarSettings() {
  const u = S.settings.ui, keys = navKeys().filter(navVisible), arrows = (k, label, i) => `<span><button class="ib sm" data-navmv="${esc(k)}" data-d="-1"${i ? '' : ' disabled'} title="Move up" aria-label="Move ${esc(label)} up">${ic('up', 14)}</button><button class="ib sm" data-navmv="${esc(k)}" data-d="1"${i < keys.length - 1 ? '' : ' disabled'} title="Move down" aria-label="Move ${esc(label)} down">${ic('down', 14)}</button></span>`;
  const ico = (x, z) => (typeof iconAny === 'function' ? iconAny(x, z) : ic(x, z));
  const row = (k, i) => {
    if (k.startsWith('pin:')) { const p = pinInfo(k.slice(4)); return `<div class="vsec pinsec"><div class="vrow vsh"><b class="pinrow">${ic('pin', 14)} ${ico(p.icon, 15)} ${esc(p.tip)}</b><span class="pinact">${arrows(k, p.label, i)}<button class="ib sm" data-pinrm="${esc(k.slice(4))}" title="Unpin" aria-label="Unpin ${esc(p.label)}">${ic('x', 14)}</button></span></div></div>`; }
    const s = navSecOf(k), id = s[0];
    return `<div class="vsec"><div class="vrow vsh"><b>${ico(s[2], 16)} ${esc(s[1])}</b>${arrows(k, s[1], i)}</div>${s[3].length > 1 || s[3][0] !== id ? s[3].filter(v => v !== 'timetable').map(v => `<div class="vrow vsub"><label><input type="checkbox" data-pg="${esc(v)}"${(v === 'calendar' ? u.hidePages.includes('calendar') && u.hidePages.includes('timetable') : u.hidePages.includes(v)) ? '' : ' checked'}> ${ico(viewTab(v)[1], 15)} ${esc(viewTab(v)[0])}</label></div>`).join('') : `<div class="vrow vsub"><label><input type="checkbox" data-pg="${esc(s[3][0])}"${u.hidePages.includes(s[3][0]) ? '' : ' checked'}> Show in the sidebar</label></div>`}</div>`;
  };
  // a section that is hidden is not in the list above, so it is offered here to be brought back
  const hidden = navKeys().filter(k => k.startsWith('sec:') && !navVisible(k)).map(navSecOf).filter(Boolean);
  return `<div class="vlist navlist pinlist">${keys.map(row).join('')}</div>${hidden.length ? `<div class="vlist"><div class="vsec"><div class="vrow vsh"><b>Hidden</b></div>${hidden.map(s => `<div class="vrow vsub"><label><input type="checkbox" data-showsec="${esc(s[0])}"> ${ico(s[2], 15)} ${esc(s[1])}</label></div>`).join('')}</div></div>` : ''}<p class="hint">Related views share one place: Tasks holds the list, board, matrix and timeline; Calendar holds the month, week, 3 days, day and agenda, plus countdowns and time zones. Untick a view to hide its tab. Move the buttons with the arrows, or drag them in the sidebar: pinned views and sections can be put in any order together.</p>${typeof xsNew === 'function' ? `<div class="vadd"><button type="button" class="btn sm" data-m="xsnew">${ic('plus', 13)} Add a section…</button><small class="hint">Make your own: books, recipes, spending… or add one someone shared (Settings → Sections &amp; packs).</small></div>` : ''}${typeof pinSettingsHtml === 'function' ? pinSettingsHtml() : ''}`;
}
function uiMovePage(k, d) {
  const u = S.settings.ui, order = pageOrder();
  const i = order.indexOf(k), j = i + d; if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]]; u.pageOrder = order; u.navOrder = []; save(); // a page order set by hand wins over a saved button order
}

/* ---------- reorder: lists in the sidebar, view tabs, and dropping a task on a sidebar entry ---------- */
document.addEventListener('dragstart', e => {
  const l = e.target.closest && e.target.closest('.navrow[data-lid]');
  if (l) { U.ldrag = l.dataset.lid; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'list:' + U.ldrag); l.classList.add('drag'); return; }
  const p = e.target.closest && e.target.closest('.pg[data-nk]'); // a section or a pinned view: they are reordered together
  if (p) { U.pdrag = p.dataset.nk; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'nav:' + U.pdrag); p.classList.add('drag'); }
});
document.addEventListener('dragover', e => {
  const t = e.target.closest && e.target.closest('.navrow[data-lid],.pg[data-nk],.sech[data-k="lists"]');
  if (U.ldrag && t && (t.dataset.lid || t.dataset.k)) { // a list over a list: top / bottom edge = reorder next to it, middle = move inside it
    const bad = new Set([U.ldrag, ...listDescendants(U.ldrag)]); if (t.dataset.lid && bad.has(t.dataset.lid)) return;
    e.preventDefault(); $$('.over,.dz-b,.dz-a,.dz-in').forEach(x => x.classList.remove('over', 'dz-b', 'dz-a', 'dz-in'));
    if (t.dataset.lid) { const r = t.getBoundingClientRect(), y = (zc(e.clientY) - r.top) / r.height; t.classList.add(y < 0.28 ? 'dz-b' : y > 0.72 ? 'dz-a' : 'dz-in'); } else t.classList.add('over');
  } else if (t && U.pdrag && t.dataset.nk) { e.preventDefault(); $$('.over').forEach(x => x.classList.remove('over')); t.classList.add('over'); }
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
    const t = e.target.closest('.pg[data-nk]');
    if (t && t.dataset.nk !== U.pdrag) { e.preventDefault(); if (navReorder(U.pdrag, t.dataset.nk)) { renderSide(); if (typeof renderTabbar === 'function') renderTabbar(); const b = $('#sbv'); if (b) b.innerHTML = uiSidebarSettings(); } }
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
function uiCompact(on) { const u = S.settings.ui; u.density = (on == null ? u.density !== 'compact' : on) ? 'compact' : 'roomy'; u.compact = u.density === 'compact'; save(); uiApply(); }
function paletteItems(q) {
  const go = (label, hint, run) => ({ label, hint, run });
  const out = [
    ...PAGES.map(([k, n]) => go('Go to ' + n, 'View', () => { U.page = k; U.sel = null; render(); })),
    ...(typeof csecEntries === 'function' ? csecEntries().map(([k, n]) => go('Go to ' + n, 'Section', () => { U.page = k; U.sel = null; render(); })) : []),
    go('Go to History', 'View', () => { U.page = 'history'; U.sel = null; render(); }),
    ...(typeof pinHere === 'function' && pinHere() ? [go(pinList().includes(pinHere()) ? 'Unpin this view from the ' + pinWhere() : 'Pin this view to the ' + pinWhere(), 'View', () => pinToggle(pinHere()))] : []),
    ...SMART.map(([k, n]) => go('Open ' + n, 'List', () => setNav(k))),
    ...S.lists.filter(l => l.id !== 'inbox').map(l => go('Open list: ' + listLabel(l.id), 'List', () => setNav('list:' + l.id))),
    ...S.projects.map(p => go('Open project: ' + p.name, 'Project', () => setNav('project:' + p.id))),
    go('Import from another app…', 'Action', () => openImport()), go('New list…', 'Action', () => openListForm(null, '')), go('New project…', 'Action', () => openProjectForm(null)),
    go('Open Completed', 'List', () => setNav('done')), go('Open Trash', 'List', () => setNav('trash')),
    go('Toggle sidebar', '[', () => uiToggle('side')), go('Toggle task details', ']', () => uiToggle('detail')),
    go('Focus mode: hide both panels', '\\', uiFocus),
    go('Toggle compact density', 'Layout', () => { uiCompact(); render(); }),
    ...(typeof xsNew === 'function' ? [go('New section…', 'Action', () => { xsNew(); }), go('New contact…', 'Action', () => { U.page = 'contacts'; U.sel = null; render(); ctEditForm(null); })] : []),
    go('New list…', 'Action', () => ACT.addlist()), go('New template…', 'Action', () => TPL_ACT.tpladd()), go('New note', 'Action', () => { U.page = 'notes'; U.sel = null; render(); ACT.noteadd(); }), go('Settings…', 'Action', openSettings),
    go('Keyboard shortcuts', '?', openShortcuts), go('Help & user guide', 'Help', () => openHelp()), go('About OpenTick: version, licences, credits', 'Help', () => openAbout()),
    go('Interface size…', 'Appearance', openSettings), go('Background effects…', 'Appearance', openBgSettings),
    go('Timeline: zoom in', 'Timeline', () => { U.page = 'gantt'; render(); gtZoom(1); }), go('Timeline: zoom out', 'Timeline', () => { U.page = 'gantt'; render(); gtZoom(-1); }),
    go('Timeline: choose table columns…', 'Timeline', () => { U.page = 'gantt'; render(); openGtCols(); }),
    go('Timeline: print / save as PDF', 'Timeline', () => { U.page = 'gantt'; render(); setTimeout(gtPrint, 100); }), go('Timeline: export…', 'Timeline', () => { U.page = 'gantt'; render(); openGtExport(); }),
    ...themeList().map(t => go('Theme: ' + t[1], 'Theme', () => { S.settings.theme = t[0]; applyTheme(); save(); })),
  ];
  q = q.toLowerCase().trim();
  const hit = out.filter(i => !q || i.label.toLowerCase().includes(q));
  const tpls = q.length > 0 ? S.templates.filter(x => (x.name + ' ' + x.tags.join(' ')).toLowerCase().includes(q)).slice(0, 6).map(x => go('Use template: ' + (x.name || 'Untitled'), 'Template', () => tplFill(x.id))) : [];
  const notes = q.length > 1 ? S.notes.filter(n => (noteTitle(n) + ' ' + n.body).toLowerCase().includes(q)).slice(0, 5).map(n => go(noteTitle(n), 'Note', () => openNoteById(n.id))) : [];
  const tasks = q.length > 1 ? S.tasks.filter(t => !t.deleted && !t.log && (t.title || '').toLowerCase().includes(q)).slice(0, 8).map(t => go(t.title, 'Task', () => { setNav(t.listId === 'inbox' ? 'inbox' : 'list:' + t.listId); U.sel = t.id; renderMain(); renderDetail(); })) : [];
  const people = q.length > 1 && typeof ctMatch === 'function' ? S.contacts.filter(c => ctMatch(c, q)).slice(0, 5).map(c => go(c.name, 'Contact', () => { U.page = 'contacts'; U.sel = null; render(); ctProfile(c.id); })) : [];
  return [...hit, ...tpls, ...notes, ...people, ...tasks].slice(0, 14);
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
// openShortcuts lives in keys.js
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); if (!$('#modal.on')) openPalette(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '');
  if (e.key === '?' && !typing && !$('#modal.on')) { e.preventDefault(); openShortcuts(); }
});

// the clock is a button: Enter or Space opens Time zones from the keyboard
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.id === 'clock') { e.preventDefault(); e.target.click(); } });
