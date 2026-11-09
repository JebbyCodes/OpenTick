/* OpenTick preferences added in 0.5: the settings tabs' content for new tasks, notifications, accessibility, keyboard and privacy, and
   the accessibility options themselves (applied as attributes on <html>, styled in styles.css). Every value is per device (S.settings),
   never synced. A field is bound with data-pf="group.key" (checkbox -> true/false, number inputs and data-pfn -> number, else text). */

const prefGet = path => path.split('.').reduce((o, k) => (o == null ? o : o[k]), S.settings);
function prefSet(path, v) {
  const ks = path.split('.'), last = ks.pop(); let o = S.settings; for (const k of ks) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
  o[last] = v; save(); prefApplied(path);
}
function prefApplied(path) {
  if (path === 'bridge.on' && typeof bridgeNative === 'function') bridgeNative(); // register (or remove) the opentick:// scheme with the system
  if (path.startsWith('ui.')) { uiApply(); if (path === 'ui.density' || path === 'ui.autoDetail') { S.settings.ui.compact = S.settings.ui.density === 'compact'; renderDetail(); } }
  else if (path.startsWith('a11y.')) a11yApply();
  else if (path.startsWith('eink.')) { motionApply(); a11yApply(); }
  else if (path.startsWith('watch.')) watchApply();
  else if (path.startsWith('keys.')) skHintsRefresh();
  else if (path.startsWith('svc.') && typeof bgSync === 'function') bgSync(true);
  else if ((path.startsWith('quiet.') || path.startsWith('digest.')) && typeof bgSync === 'function') bgSync(true);
}

/* ---- accessibility ---- */
const A11Y_FLAGS = { contrast: 'hc', bold: 'bold', dys: 'dys', links: 'links', nocol: 'nocol', gray: 'gray', tap: 'tap', focus: 'focus', labels: 'labels', notrans: 'notrans' };
function a11yApply() {
  if (typeof document === 'undefined' || !document.documentElement || !document.documentElement.setAttribute) return;
  const r = document.documentElement, a = (S.settings && S.settings.a11y) || {};
  const set = (k, on, v = '') => { if (on) r.setAttribute('data-' + k, v); else if (r.removeAttribute) r.removeAttribute('data-' + k); };
  const ek = typeof einkOn === 'function' && einkOn(); // e-ink mode turns on what e-paper needs: strong contrast, marks instead of colour, no transparency, big targets
  const eff = ek ? { ...a, contrast: true, nocol: true, notrans: true, tap: true } : a;
  for (const [k, attr] of Object.entries(A11Y_FLAGS)) set(attr, !!eff[k]);
  const pg = ek && ((S.settings.eink || {}).pager !== false); set('eink', ek, 'on'); set('pager', pg, 'on'); if (typeof einkPager === 'function') einkPager(pg);
  set('spc', a.spacing && a.spacing !== 'normal', a.spacing); set('cursor', a.cursor && a.cursor !== 'normal', a.cursor);
}
const A11Y_GROUPS = [
  ['Seeing', [
    ['contrast', 'check', 'High contrast', 'Stronger text, borders and focus. Also follows your system’s “increase contrast” setting.'],
    ['bold', 'check', 'Bold text', 'Heavier letters everywhere.'],
    ['dys', 'check', 'Easier-to-read font', 'A wide, open font stack (Atkinson Hyperlegible, Lexend or OpenDyslexic if installed, otherwise Verdana or Tahoma) with more letter spacing. Fonts are not bundled, to keep the app small and offline.'],
    ['spacing', 'select', 'Text spacing', '', [['normal', 'Normal'], ['relaxed', 'Relaxed'], ['loose', 'Loose']]],
    ['links', 'check', 'Underline links', 'Links are always underlined, not only on hover.'],
    ['nocol', 'check', 'Do not rely on colour', 'Adds marks for priority (!, !!, !!!), overdue dates and completed tasks, so they read without colour.'],
    ['gray', 'check', 'Greyscale', 'Removes all colour from the app.'],
    ['cursor', 'select', 'Mouse pointer', '', [['normal', 'Normal'], ['large', 'Large']]],
    ['labels', 'check', 'Text labels on icon buttons', 'Shows the name next to every icon-only button.'],
    ['notrans', 'check', 'Reduce transparency and background effects', 'Solid panels and no moving background shapes.'],
  ]],
  ['Moving and tapping', [
    ['tap', 'check', 'Larger tap targets', 'Buttons, rows and fields are at least 44 px tall.'],
    ['focus', 'check', 'Strong focus outline', 'A thick, bright outline around whatever the keyboard is on.'],
    ['tips', 'check', 'Button tooltips', 'Hover a button, or press and hold it on a touch screen, to see what it does.'],
  ]],
  ['Thinking and focus', [
    ['motion', 'check', 'Reduce motion', 'Turns the animations off (same as Appearance → Animations).'],
    ['confirm', 'check', 'Ask before moving a task to the bin', 'A confirmation before deleting.'],
    ['toast', 'select', 'Messages stay for', 'How long the small pop-up messages stay on screen.', [[3, '3 seconds'], [6, '6 seconds'], [12, '12 seconds'], [0, 'Until I dismiss them']]],
  ]],
  ['Screen readers and keyboard', [
    ['info', 'note', '', 'Messages are announced (live regions), buttons have names, dialogs trap focus, and everything can be done from the keyboard. Press ? for the shortcuts. Dates and times are read in your device’s language and clock.'],
  ]],
];
function a11ySettingsHtml() {
  const a = S.settings.a11y, mv = S.settings.motion === 'off';
  return `<p class="hint">These options are saved on this device. Interface size (zoom) is in <button class="linkb" data-stab="appearance">Appearance</button>.</p>`
    + A11Y_GROUPS.map(([g, rows]) => `<h4 class="mh${g === 'Seeing' ? ' first' : ''}">${g}</h4>` + rows.map(([k, type, label, hint, optsx]) => {
      if (type === 'note') return `<p class="hint">${esc(hint)}</p>`;
      if (type === 'select') return `<label class="a11y-r"><span><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span><select data-pf="a11y.${k}"${k === 'toast' ? ' data-pfn="1"' : ''}>${opts(optsx, a[k])}</select></label>`;
      const on = k === 'motion' ? mv : k === 'confirm' ? !!S.settings.tasks.confirmDel : k === 'tips' ? S.settings.tips.on !== false : !!a[k], path = k === 'motion' ? '' : k === 'confirm' ? 'tasks.confirmDel' : k === 'tips' ? 'tips.on' : 'a11y.' + k;
      return `<label class="a11y-r tg"><span><b>${esc(label)}</b><small>${esc(hint)}</small></span><input type="checkbox" ${k === 'motion' ? 'data-pfa="motion"' : `data-pf="${path}"`}${on ? ' checked' : ''}></label>`;
    }).join('')).join('');
}

/* ---- the other settings tabs ---- */
function tasksSettingsHtml() {
  const t = S.settings.tasks;
  return `<h4 class="mh">New tasks</h4><div class="form">
<label>Default list<select data-pf="tasks.defList">${opts([['', 'Inbox'], ...S.lists.filter(l => l.id !== 'inbox').map(l => [l.id, listLabel(l.id)])], t.defList)}</select></label>
<label>Default priority<select data-pf="tasks.defPrio" data-pfn="1">${opts([[0, 'None'], [1, 'Low'], [2, 'Medium'], [3, 'High']], t.defPrio)}</select></label>
<label>Default length (for tasks with a time)<select data-pf="tasks.defDur" data-pfn="1">${opts([[0, 'No length'], [15, '15 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], [90, '1 hour 30'], [120, '2 hours']], t.defDur)}</select></label>
<label>New tasks go to the<select data-pf="tasks.addPos">${opts([['top', 'Top of the list'], ['bottom', 'Bottom of the list']], t.addPos)}</select></label></div>
<div class="lbl" style="margin-top:8px">Default reminder for tasks with a date${remHtml('defrem', t.defRem)}</div>
<div class="mrow tight" style="margin-top:10px"><label class="chkl"><input type="checkbox" data-pf="tasks.confirmDel"${t.confirmDel ? ' checked' : ''}> Ask before moving a task to the bin</label><label class="chkl"><input type="checkbox" data-pf="ui.schoolOpen"${S.settings.ui.schoolOpen ? ' checked' : ''}> Keep the School options open in the task panel</label></div>
<p class="hint">The School block (class, homework, exam) is folded away in a task’s details unless you open it. Tick the last box to have it open by default.</p>`;
}
function notifSettingsHtml() {
  const q = S.settings.quiet, d = S.settings.digest;
  return `<div class="dgrid"><button data-m="notif">${ic('bell', 18)}<span><b>Allow notifications</b><small>Ask the system for permission</small></span></button><button data-pfa="testnotif">${ic('send', 18)}<span><b>Send a test</b><small>See what a reminder looks like</small></span></button></div>
${typeof svcSettingsHtml === 'function' ? svcSettingsHtml() : ''}
<h4 class="mh">Quiet hours</h4>
<div class="mrow tight"><label class="chkl"><input type="checkbox" data-pf="quiet.on"${q.on ? ' checked' : ''}> Hold reminders back between</label><input type="time" data-pf="quiet.from" value="${esc(q.from)}" aria-label="From"> and <input type="time" data-pf="quiet.to" value="${esc(q.to)}" aria-label="Until"></div>
<p class="hint">A reminder that falls inside is delivered when the quiet hours end.</p>
<h4 class="mh">Morning summary</h4>
<div class="mrow tight"><label class="chkl"><input type="checkbox" data-pf="digest.on"${d.on ? ' checked' : ''}> A daily summary of tasks and lessons at</label><input type="time" data-pf="digest.at" value="${esc(d.at)}" aria-label="Time"></div>
<p class="hint">Lesson reminders are set in the Classes settings (any amount of time before). A task’s reminders are in its details: add as many as you like, a time before or an exact date and time.</p>`;
}
function keysSettingsHtml() {
  return `<p class="hint">${skOn() ? 'Keyboard shortcuts work on computers. They are not used on phones and tablets.' : 'Keyboard shortcuts are for computers; they are switched off on phones and tablets.'}</p>
<label class="a11y-r tg"><span><b>Show the keys on buttons</b><small>A small key cap on the pages in the sidebar, the search box and buttons with words on them. An icon button names its shortcut in its tooltip.</small></span><input type="checkbox" data-pf="keys.hints"${S.settings.keys.hints !== false ? ' checked' : ''}></label>
<div class="dgrid"><button data-pfa="shortcuts">${ic('code', 18)}<span><b>See every shortcut</b><small>Searchable · or press ? anywhere</small></span></button></div>
<p class="hint">Right-click a task, list, note, template, calendar day or timetable block for the same choices as its ⋯ button. Press Shift while right-clicking to get the browser’s own menu.</p>`;
}
function privacySettingsHtml() {
  return `<h4 class="mh">Privacy</h4><p class="hint">OpenTick has no account, no analytics and no tracking. Your data stays on this device unless you turn on sync, and can be encrypted.</p>
<div class="dgrid"><button data-pfa="privacy">${ic('shield', 18)}<span><b>Privacy policy</b><small>What OpenTick does and does not do with your data</small></span></button></div>`;
}
function openPrivacy() {
  openModal(`<h3>${ic('shield', 18)} Privacy policy</h3><div class="md priv">${md(PRIVACY_MD)}</div><div class="mact"><button class="pri" data-m="ok">Close</button></div>`, m => { m.onclick = e => { if (e.target.closest('[data-m=ok]') || e.target.classList.contains('mback')) closeModal(); }; }, 'wide');
}

/* ---- wiring: the settings window's sections, its search, and the fields above ----
   On a computer the sections are a list down the left; on a phone a strip across the top that stays where it is when you tap (it sits outside the
   part that scrolls, and is only moved when the section you tapped is partly out of view). */
function prefTab(k) {
  U.setTab = k; const m = $('#modal'); if (!m) return;
  const q = $('#setq', m); if (q && q.value) { q.value = ''; setSearchRun(m); } // picking a section ends a search
  $$('.stb', m).forEach(b => { const on = b.dataset.stab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $$('.stab', m).forEach(s => { s.hidden = s.dataset.tab !== k; });
  const c = $('#setc', m); if (c) c.scrollTop = 0;
  prefTabShow(m, true);
}
// keep the chosen section visible in the phone strip: only when it is partly out of view, and without the page jumping
function prefTabShow(m, tapped) {
  const on = $('.stb.on', m), strip = $('.set-n', m); if (!on || !strip || strip.scrollWidth <= strip.clientWidth + 2) return;
  const l = on.offsetLeft, r = l + on.offsetWidth, v0 = strip.scrollLeft, v1 = v0 + strip.clientWidth;
  if (tapped && l >= v0 && r <= v1) return;
  try { strip.scrollLeft = l < v0 || !tapped ? Math.max(0, l - 12) : r - strip.clientWidth + 12; } catch (e) { /* no layout */ }
}
/* search: every setting is an entry (its label, the small print under it and its section's name and keywords); a result switches to the
   section and flashes the setting. The entries are read from the page each time, so they always match what is there. */
const SET_ALIAS = {
  general: 'start screen home week monday sunday clock time 24-hour banners sidebar views default list priority reminder tasks pin pinned views shortcuts layout sections order',
  appearance: 'theme dark light colours colors font size zoom scale density spacing animation motion background effects e-ink eink smartwatch watch wear os round square wrist',
  notifications: 'reminders alerts notify notifications push banner',
  access: 'accessibility contrast reduce motion large text tap targets screen reader dyslexia',
  sound: 'sound volume vibrate haptic focus pomodoro timer break chime custom notification sound ringtone reminder tone audio file mp3',
  keys: 'keyboard shortcuts keys hotkeys hints key caps',
  data: 'data sync backup export import encryption vault passphrase delete wipe webdav git s3 restore snapshot',
  widgets: 'widgets home screen android floating window',
  integrations: 'integrations bridge api link tools connect',
  about: 'about privacy policy help guide version licence license credits update updates upgrade new version release check for updates automatically',
};
const SET_ITEM = 'h4.mh, label, .a11y-r, .dgrid > button, details > summary, .vrow.vsh, .about';
const SET_OUTER = 'label, .a11y-r, .dgrid > button, summary';
function setLabelOf(el) {
  const b = el.querySelector('b,strong'); if (b && !el.matches('h4,summary')) return b.textContent.replace(/\s+/g, ' ').trim();
  if (el.matches('h4,summary,.about')) return el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
  let t = ''; el.childNodes.forEach(n => { if (n.nodeType === 3) t += n.textContent; else if (n.nodeType === 1 && !/^(SELECT|INPUT|TEXTAREA|BUTTON|SVG)$/i.test(n.tagName) && !n.querySelector('select,input,textarea')) t += ' ' + n.textContent; });
  t = t.replace(/\s+/g, ' ').trim();
  return t || el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
}
function setIndex(m) {
  const out = [];
  for (const [k, name] of SET_TABS.map(t => [t[0], t[1]])) {
    out.push({ tab: k, tabName: name, label: name, hint: 'Section', hay: (name + ' ' + (SET_ALIAS[k] || '')).toLowerCase(), el: null });
    const sec = $(`.stab[data-tab="${k}"]`, m); if (!sec) continue;
    for (const el of sec.querySelectorAll(SET_ITEM)) {
      if (el.parentElement && el.parentElement.closest(SET_OUTER) && !el.matches('h4.mh')) continue; // only the outermost block of a setting
      const label = setLabelOf(el); if (!label) continue;
      const sm = el.querySelector('small'), hint = sm ? sm.textContent.replace(/\s+/g, ' ').trim() : '';
      out.push({ tab: k, tabName: name, label, hint, hay: (label + ' ' + hint).toLowerCase(), el });
    }
  }
  return out;
}
function setSearchRun(m) {
  const q = $('#setq', m), box = $('#setres', m); if (!q || !box) return;
  const words = q.value.toLowerCase().split(/\s+/).filter(Boolean), tabs = $$('.stab', m);
  if (!words.length) { box.hidden = true; box.innerHTML = ''; tabs.forEach(s => { s.hidden = s.dataset.tab !== U.setTab; }); return; }
  tabs.forEach(s => { s.hidden = true; });
  const hits = setIndex(m).filter(e => words.every(w => e.hay.includes(w))), seen = new Set(), list = [];
  for (const e of hits) { const key = e.tab + '|' + e.label; if (seen.has(key)) continue; seen.add(key); list.push(e); }
  // a section's own entry comes first only when nothing inside it matched better
  box._hits = list.slice(0, 40); box.hidden = false;
  box.innerHTML = box._hits.length ? box._hits.map((e, i) => `<button class="sr-i" data-sres="${i}"><span class="sr-t">${esc(e.label)}</span><small>${e.hint === 'Section' ? 'Settings section' : esc(e.tabName) + (e.hint ? ' · ' + esc(e.hint.slice(0, 90)) : '')}</small></button>`).join('')
    : `<p class="hint sr-none">No setting matches “${esc(q.value.trim())}”. Try another word, like “sync”, “dark” or “reminder”.</p>`;
}
function setSearchGo(m, i) {
  const box = $('#setres', m), e = box && box._hits && box._hits[i]; if (!e) return;
  prefTab(e.tab); // ends the search and shows the section
  const el = e.el; if (!el || !el.isConnected) return;
  const d = el.closest('details'); if (d) d.open = true;
  try { el.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (err) { /* no layout */ }
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800);
}
document.addEventListener('input', e => { const t = e.target; if (t && t.id === 'setq') { const m = $('#modal'); if (m) setSearchRun(m); } });
document.addEventListener('keydown', e => {
  const t = e.target; if (!t || t.id !== 'setq') return; const m = $('#modal');
  if (e.key === 'Enter') { e.preventDefault(); setSearchGo(m, 0); }
  else if (e.key === 'Escape' && t.value) { e.preventDefault(); e.stopPropagation(); t.value = ''; setSearchRun(m); }
}, true);
function prefRead(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.pfn || el.type === 'number') return +el.value || 0;
  return el.value;
}
document.addEventListener('click', async e => {
  const t = e.target; if (!t || !t.closest || !$('#modal .set-n')) return;
  const tab = t.closest('[data-stab]'); if (tab) { prefTab(tab.dataset.stab); return; }
  const sr = t.closest('[data-sres]'); if (sr) { setSearchGo($('#modal'), +sr.dataset.sres); return; }
  const a = t.closest('[data-pfa]'); if (!a) return;
  const k = a.dataset.pfa;
  if (k === 'testnotif') { await ensureNotify(); notify('OpenTick', 'This is what a reminder looks like.'); sfx('chime'); }
  else if (k === 'shortcuts') { closeModal(); openShortcuts(); }
  else if (k === 'privacy') { closeModal(); openPrivacy(); }
});
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || !$('#modal .set-n')) return;
  if (el.dataset.pfa === 'motion') { S.settings.motion = el.checked ? 'off' : 'normal'; motionApply(); save(); return; }
  if (el.dataset.pf) {
    prefSet(el.dataset.pf, prefRead(el));
    if (el.dataset.pf === 'tasks.confirmDel') { const o = $$('[data-pf="tasks.confirmDel"]').find(x => x !== el); if (o) o.checked = el.checked; }
    return;
  }
  const rb = el.closest && el.closest('[data-rem=defrem]');
  if (rb) { remSync(rb); prefSet('tasks.defRem', remRead(rb)); }
});

// what new tasks start with (quick add and the + buttons)
function prefNewTask(t, parsed) {
  const p = S.settings.tasks; if (!p) return t;
  if (!t.priority && p.defPrio) t.priority = p.defPrio;
  if (t.time && !t.dur && p.defDur) t.dur = p.defDur;
  if (t.due && p.defRem != null && !remsOf(t).length) remsSet(t, [p.defRem]);
  if (p.addPos === 'bottom') t.order = Math.max(0, ...S.tasks.map(x => x.order || 0)) + 1000;
  return t;
}
