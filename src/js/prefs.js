/* OpenTick preferences added in 0.5: the settings tabs' content for new tasks, notifications, accessibility, keyboard and privacy, and
   the accessibility options themselves (applied as attributes on <html>, styled in styles.css). Every value is per device (S.settings),
   never synced. A field is bound with data-pf="group.key" (checkbox -> true/false, number inputs and data-pfn -> number, else text). */

const prefGet = path => path.split('.').reduce((o, k) => (o == null ? o : o[k]), S.settings);
function prefSet(path, v) {
  const ks = path.split('.'), last = ks.pop(); let o = S.settings; for (const k of ks) { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
  o[last] = v; save(); prefApplied(path);
}
function prefApplied(path) {
  if (path.startsWith('a11y.')) a11yApply();
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
  for (const [k, attr] of Object.entries(A11Y_FLAGS)) set(attr, !!a[k]);
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
      const on = k === 'motion' ? mv : k === 'confirm' ? !!S.settings.tasks.confirmDel : !!a[k], path = k === 'motion' ? '' : k === 'confirm' ? 'tasks.confirmDel' : 'a11y.' + k;
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
<label class="a11y-r tg"><span><b>Show the keys on buttons</b><small>A small key cap next to a button that has a shortcut, and in its tooltip.</small></span><input type="checkbox" data-pf="keys.hints"${S.settings.keys.hints !== false ? ' checked' : ''}></label>
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

/* ---- wiring: the settings window's tabs and the fields above ---- */
function prefTab(k) {
  U.setTab = k; const m = $('#modal'); if (!m) return;
  $$('.stb', m).forEach(b => { const on = b.dataset.stab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $$('.stab', m).forEach(s => { s.hidden = s.dataset.tab !== k; });
  const box = $('.mbox', m); if (box) box.scrollTop = 0;
  prefTabShow(m);
}
// keep the chosen tab visible in the strip (on a phone the strip scrolls sideways)
function prefTabShow(m) { const on = $('.stb.on', m), strip = $('.stabs', m); if (on && strip && on.scrollIntoView) { try { strip.scrollLeft = Math.max(0, on.offsetLeft - strip.clientWidth / 2 + on.offsetWidth / 2); } catch (e) { /* no layout */ } } }
function prefRead(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.pfn || el.type === 'number') return +el.value || 0;
  return el.value;
}
document.addEventListener('click', async e => {
  const t = e.target; if (!t || !t.closest || !$('#modal .stabs')) return;
  const tab = t.closest('[data-stab]'); if (tab) { prefTab(tab.dataset.stab); return; }
  const a = t.closest('[data-pfa]'); if (!a) return;
  const k = a.dataset.pfa;
  if (k === 'testnotif') { await ensureNotify(); notify('OpenTick', 'This is what a reminder looks like.'); sfx('chime'); }
  else if (k === 'shortcuts') { closeModal(); openShortcuts(); }
  else if (k === 'privacy') { closeModal(); openPrivacy(); }
});
document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset || !$('#modal .stabs')) return;
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
