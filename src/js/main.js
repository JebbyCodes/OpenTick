/* OpenTick main: modals, platform bridges, timers, events, startup */
const TAURI = () => window.__TAURI__ || null;
let toastTimer;
function toast(m) { const el = $('#toast'); if (!el) return; el.textContent = m; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2600); }
function applyTheme() {
  const th = THEMES.some(t => t[0] === S.settings.theme) ? S.settings.theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = th;
  try { const c = getComputedStyle(document.documentElement).getPropertyValue('--side').trim(), m = document.querySelector('meta[name=theme-color]'); if (c && m) m.setAttribute('content', c); } catch (e) { /* cosmetic only */ }
}
const refresh = () => { renderSide(); renderMain(); renderDetail(); };

/* ---------- modals ---------- */
function openModal(html, ready, cls = '') { const m = $('#modal'); m.innerHTML = `<div class="mback"><div class="mbox ${cls}">${html}</div></div>`; m.classList.add('on'); if (ready) ready(m); }
function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.innerHTML = ''; m.onclick = m.onchange = m.onkeydown = null; }
const askText = (title, val = '', ph = '') => new Promise(res => {
  openModal(`<h3>${esc(title)}</h3><input id="mt" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off"><div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="ok">OK</button></div>`, m => {
    const i = $('#mt', m), done = v => { closeModal(); res(v); };
    i.focus(); i.select();
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === 'ok' ? i.value.trim() : null); else if (e.target.classList.contains('mback')) done(null); };
    i.onkeydown = e => { if (e.key === 'Enter') done(i.value.trim()); };
  });
});
const askConfirm = (msg, ok = 'Delete') => new Promise(res => {
  openModal(`<p>${esc(msg)}</p><div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="ok">${esc(ok)}</button></div>`, m => {
    const done = v => { closeModal(); res(v); };
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === 'ok'); else if (e.target.classList.contains('mback')) done(false); };
  });
});
const askMenu = (title, items) => new Promise(res => {
  openModal(`<h3>${esc(title)}</h3><div class="menu">${items.map((it, i) => `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.color ? `<i style="background:${it.color}"></i>` : ''}${esc(it.label)}</button>`).join('')}</div>`, m => {
    const done = v => { closeModal(); res(v); };
    m.onclick = e => { const b = e.target.closest('[data-i]'); if (b) done(+b.dataset.i); else if (e.target.classList.contains('mback')) done(null); };
  });
});
const pickColor = (cur = '', allowNone = false) => new Promise(res => {
  const done = v => { closeModal(); res(v); };
  openModal(`<h3>Colour</h3><div class="sw big">${COLORS.map(([c, n]) => `<button style="--c:${c}" class="${c === cur ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div><div class="mrow"><label class="inl">Custom <input type="color" id="pc-cust" value="${/^#[0-9a-f]{6}$/i.test(cur) ? cur : '#4772fa'}"></label>${allowNone ? '<button data-n="1">No colour</button>' : ''}</div><div class="mact"><button data-m="no">Cancel</button></div>`, m => {
    m.onclick = e => { const b = e.target.closest('button'); if (b && b.dataset.c) done(b.dataset.c); else if (b && b.dataset.n) done(''); else if (b || e.target.classList.contains('mback')) done(null); };
    m.onchange = e => { if (e.target.id === 'pc-cust') done(e.target.value); };
  });
});
async function tagMenu(name) {
  const col = tagColor(name), items = [{ label: 'Change colour', color: col || undefined }, ...(col ? [{ label: 'Remove colour' }] : []), { label: 'Rename tag' }];
  const i = await askMenu('#' + name, items); if (i == null) return;
  const lab = items[i].label;
  if (lab === 'Change colour') { const c = await pickColor(col || '', false); if (!c) return; setTagColor(name, c); }
  else if (lab === 'Remove colour') setTagColor(name, null);
  else {
    const n = await askText('Rename tag', name), nn = n && n.toLowerCase().replace(/^#/, '').replace(/[\s,#]+/g, '-').replace(/^-+|-+$/g, '');
    if (!nn || nn === name) return;
    renameTag(name, nn); if (U.nav === 'tag:' + name) U.nav = 'tag:' + nn;
  }
  refresh();
}

/* ---------- links ---------- */
function openExternal(url) {
  const T = TAURI();
  if (T && T.opener && T.opener.openUrl) { T.opener.openUrl(url).catch(() => {}); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/* ---------- files (Tauri dialog+fs, File System Access, or classic download) ---------- */
const pathOf = p => (p && typeof p === 'object' ? p.path : p);
async function saveText(name, text) {
  const T = TAURI();
  if (T && T.dialog && T.fs) { const p = pathOf(await T.dialog.save({ defaultPath: name })); if (!p) return false; await T.fs.writeTextFile(p, text); return true; }
  if (window.showSaveFilePicker) {
    try { const h = await window.showSaveFilePicker({ suggestedName: name }); const w = await h.createWritable(); await w.write(text); await w.close(); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true;
}
async function pickText() {
  const T = TAURI();
  if (T && T.dialog && T.fs) { const p = pathOf(await T.dialog.open({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] })); return p ? T.fs.readTextFile(p) : null; }
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => res(i.files[0] ? await i.files[0].text() : null); i.click(); });
}
async function exportData() { try { if (await saveText(`opentick-${todayStr()}.json`, JSON.stringify(S, null, 1))) toast('Exported'); } catch (e) { toast('Export failed: ' + (e.message || e)); } }
async function importData() {
  try {
    const txt = await pickText(); if (!txt) return;
    const d = JSON.parse(txt);
    if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.lists)) throw new Error('not an OpenTick backup');
    if (!await askConfirm(`Replace everything with this backup (${d.tasks.length} tasks)?`, 'Replace')) return;
    replaceAll(d); applyTheme(); U.nav = 'today'; U.page = 'tasks'; U.sel = null; render(); toast('Imported');
  } catch (e) { toast('Import failed: ' + (e.message || e)); }
}

/* ---------- notifications, sound, reminders ---------- */
async function ensureNotify() {
  try {
    const T = TAURI();
    if (T && T.notification) { let ok = await T.notification.isPermissionGranted(); if (!ok) ok = (await T.notification.requestPermission()) === 'granted'; return ok; }
    if ('Notification' in window) { if (Notification.permission === 'default') await Notification.requestPermission(); return Notification.permission === 'granted'; }
  } catch (e) { /* ignore */ }
  return false;
}
function notify(title, body) {
  try {
    const T = TAURI();
    if (T && T.notification) { T.notification.sendNotification({ title, body }); return; }
    if ('Notification' in window && Notification.permission === 'granted') { new Notification(title, { body, icon: 'icon.svg' }); return; }
  } catch (e) { /* fall through */ }
  toast(`${title}${body ? ' — ' + body : ''}`);
}
function beep() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.2, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.8); o.start(); o.stop(a.currentTime + 0.8); } catch (e) { /* ignore */ }
}
function checkReminders() {
  const now = Date.now(); let changed = false;
  for (const t of S.tasks) {
    if (t.deleted || t.status !== 'open' || !t.due || t.reminder == null) continue;
    const at = new Date(`${t.due}T${t.time || '09:00'}`).getTime() - t.reminder * 60000;
    const key = `${t.id}|${t.due}|${t.time || ''}|${t.reminder}`;
    if (now >= at && now - at < 864e5 && !S.fired[key]) { S.fired[key] = 1; changed = true; notify(t.title, 'Due ' + dueLabel(t)); }
  }
  // timetable slots: remind before they start (today, and tomorrow for slots just after midnight)
  const today = new Date();
  for (const sl of S.slots) {
    if (sl.remind == null) continue;
    for (const off of [0, 1]) {
      const d = addDays(today, off), k = ymd(d); if (!sl.days.includes(d.getDay())) continue;
      const at = new Date(`${k}T${sl.start}`).getTime() - sl.remind * 60000, endAt = new Date(`${k}T${sl.end}`).getTime(), key = `s|${sl.id}|${k}|${sl.start}|${sl.remind}`;
      if (now >= at && now < endAt && !S.fired[key]) { S.fired[key] = 1; changed = true; notify(sl.title, `${sl.start}–${sl.end}${sl.loc ? ' · ' + sl.loc : ''}`); }
    }
  }
  const old = ymd(addDays(today, -2));
  for (const k of Object.keys(S.fired)) if (k.startsWith('s|') && k.split('|')[2] < old) { delete S.fired[k]; changed = true; }
  if (changed) save();
}

/* ---------- pomodoro ---------- */
const P = { mode: 'focus', total: 25 * 60, left: 25 * 60, run: false, end: 0, task: '' };
function pSet(mode) { P.mode = mode; P.total = P.left = S.settings.pomo[mode] * 60; P.run = false; paintClock(); }
function pToggle() {
  if (P.run) { P.left = Math.max(0, Math.round((P.end - Date.now()) / 1000)); P.run = false; }
  else { if (P.left <= 0) P.left = P.total; P.end = Date.now() + P.left * 1000; P.run = true; ensureNotify(); }
}
function pDone() {
  const wasFocus = P.mode === 'focus';
  if (wasFocus) { S.pomo.push({ ts: Date.now(), min: S.settings.pomo.focus, task: P.task || null }); save(); }
  beep(); notify(wasFocus ? 'Focus session complete 🎉' : 'Break is over', wasFocus ? 'Time for a break.' : 'Ready to focus again?');
  const n = S.pomo.filter(p => ymd(new Date(p.ts)) === todayStr()).length;
  pSet(wasFocus ? (n % 4 === 0 ? 'long' : 'short') : 'focus');
  if (U.page === 'focus') renderMain();
}
setInterval(() => {
  if (!P.run) return;
  P.left = Math.max(0, Math.round((P.end - Date.now()) / 1000));
  if (P.left <= 0) pDone(); else paintClock();
}, 250);

/* ---------- settings ---------- */
function openSettings() {
  const s = S.settings;
  openModal(`<h3>Settings</h3><div class="themes">${THEMES.map(([k, n, b, t, a]) => `<button class="thm${s.theme === k ? ' on' : ''}" data-th="${k}" style="--b:${b};--t:${t};--a:${a}" title="${n}"><i></i><span>${n}</span></button>`).join('')}</div><div class="form">
<label>Week starts on<select data-s="weekStart">${opts([[1, 'Monday'], [0, 'Sunday'], [6, 'Saturday']], s.weekStart)}</select></label>
<label>Focus (min)<input type="number" min="1" max="180" data-p="focus" value="${s.pomo.focus}"></label>
<label>Short break (min)<input type="number" min="1" max="60" data-p="short" value="${s.pomo.short}"></label>
<label>Long break (min)<input type="number" min="1" max="120" data-p="long" value="${s.pomo.long}"></label></div>
<details class="gtd" style="margin-top:12px"><summary>Sidebar views</summary><div id="sbv">${uiSidebarSettings()}</div></details>
<div class="mrow"><button data-m="export">Export backup</button><button data-m="import">Import backup</button><button data-m="notif">Enable notifications</button><button data-m="sync">Sync${Sync.on ? ' · on' : '…'}</button><button data-m="oginport">Import OpenGantt chart…</button></div>
<p class="hint">OpenTick 0.4 · your data lives on this device. Turn on Sync to share it between devices, or export a JSON backup. Theme and view settings stay per device.</p>
<div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => {
    m.onchange = e => {
      const el = e.target;
      if (el.dataset.pg) { const h = S.settings.ui.hidePages; if (el.checked) S.settings.ui.hidePages = h.filter(k => k !== el.dataset.pg); else if (!h.includes(el.dataset.pg)) h.push(el.dataset.pg); save(); const b = $('#sbv', m); if (b) b.innerHTML = uiSidebarSettings(); return; }
      if (el.dataset.s) { S.settings[el.dataset.s] = +el.value; }
      if (el.dataset.p) { S.settings.pomo[el.dataset.p] = Math.max(1, Math.min(180, +el.value || 25)); if (!P.run) pSet(P.mode); }
      save();
    };
    m.onclick = async e => {
      const mvb = e.target.closest('[data-pgmv]');
      if (mvb) { uiMovePage(mvb.dataset.pgmv, +mvb.dataset.d); const b = $('#sbv', m); if (b) b.innerHTML = uiSidebarSettings(); return; }
      const th = e.target.closest('[data-th]');
      if (th) { S.settings.theme = th.dataset.th; applyTheme(); save(); $$('.thm', m).forEach(x => x.classList.toggle('on', x === th)); return; }
      const b = e.target.closest('[data-m]');
      if (!b) { if (e.target.classList.contains('mback')) { closeModal(); render(); } return; }
      const a = b.dataset.m;
      if (a === 'ok') { closeModal(); render(); }
      else if (a === 'export') exportData();
      else if (a === 'import') { closeModal(); importData(); }
      else if (a === 'sync') { closeModal(); openSync(); }
      else if (a === 'oginport') { closeModal(); ogImport(null); }
      else if (a === 'notif') toast((await ensureNotify()) ? 'Notifications enabled' : 'Notifications are blocked');
    };
  });
}

/* ---------- actions ---------- */
function addCtx() {
  const n = U.nav;
  if (n.startsWith('list:')) return { listId: n.slice(5) };
  if (n === 'today' || n === 'week') return { due: todayStr() };
  if (n === 'tomorrow') return { due: ymd(addDays(new Date(), 1)) };
  if (n.startsWith('tag:')) return { tags: [n.slice(4)] };
  return {};
}
function quickAdd(text, ctx = {}) {
  const p = parseQuick(text, S.lists);
  const t = newTask({ title: p.title, due: p.due || ctx.due || null, time: p.time, ...(p.dur || ctx.dur ? { dur: p.dur || ctx.dur } : {}), priority: p.priority || ctx.priority || 0, tags: [...new Set([...(ctx.tags || []), ...p.tags])], listId: p.listId || ctx.listId || 'inbox', repeat: p.repeat, section: ctx.section || null });
  S.tasks.push(t); save(); return t;
}
function reorder(dragId, beforeId) {
  if (dragId === beforeId) return;
  const eff = U.nav, ids = sortTasks(scopeTasks(eff).filter(t => t.status === 'open')).map(t => t.id).filter(i => i !== dragId);
  const idx = ids.indexOf(beforeId); ids.splice(idx < 0 ? ids.length : idx, 0, dragId);
  ids.forEach((id, i) => { getT(id).order = i * 1000; });
  save(); renderMain();
}
const closeDetail = () => { U.sel = null; $$('.sel').forEach(x => x.classList.remove('sel')); renderDetail(); };
const setNav = nav => { U.page = 'tasks'; U.nav = nav; U.q = ''; U.sel = null; document.body.classList.remove('drawer'); render(); };

/* ---------- timetable: slot editor, settings, drag & resize ---------- */
function slotClashes(d) {
  const a = toMin(d.start), b = toMin(d.end), out = [];
  for (const o of S.slots) {
    if (o.id === d.id) continue;
    const shared = o.days.filter(x => d.days.includes(x));
    if (shared.length && a < toMin(o.end) && toMin(o.start) < b) out.push(`${o.title || 'Untitled'} (${shared.map(x => DAYS[x]).join(', ')})`);
  }
  return out;
}
function openSlot(s, pre = {}) {
  const isNew = !s, ws = +S.settings.weekStart, order = Array.from({ length: 7 }, (_, i) => (ws + i) % 7);
  const d = s ? { ...s, days: [...s.days] } : { id: uid(), title: '', days: pre.days || [new Date().getDay()], start: pre.start || '09:00', end: pre.end || '10:00', color: COLORS[S.slots.length % COLORS.length][0], loc: '', notes: '', remind: null, created: Date.now() };
  const linked = () => { const ts = S.tasks.filter(t => !t.deleted && t.slotId === d.id); return ts.length ? ts.map(t => `<div class="lt${t.status !== 'open' ? ' fin' : ''}" data-act="open" data-id="${t.id}"><span>${titleHtml(t)}</span><small>${t.due ? esc(dueLabel(t)) : 'no date'}</small></div>`).join('') : '<p class="hint">No tasks linked yet.</p>'; };
  const read = () => { d.title = $('#sl-title').value.trim(); d.start = $('#sl-start').value || d.start; d.end = $('#sl-end').value || d.end; d.loc = $('#sl-loc').value.trim(); d.notes = $('#sl-notes').value; const r = $('#sl-rem').value; d.remind = r === '' ? null : +r; };
  const warn = () => { read(); const bad = toMin(d.end) <= toMin(d.start) ? 'End time must be after the start time.' : '', cl = bad ? [] : slotClashes(d); $('#sl-warn').innerHTML = bad ? `<span class="bad">${bad}</span>` : cl.length ? `<span class="bad">${ic('alert', 13)} Overlaps with ${esc(cl.join(', '))}</span>` : ''; };
  openModal(`<h3>${isNew ? 'New timetable slot' : 'Edit slot'}</h3><div class="form one">
<label>Title<input id="sl-title" value="${esc(d.title)}" placeholder="e.g. Maths, Gym, Deep work" autocomplete="off"></label>
<div class="lbl">Repeats weekly on<div class="dayp">${order.map(n => `<button type="button" class="dp${d.days.includes(n) ? ' on' : ''}" data-d="${n}">${DAYS[n]}</button>`).join('')}</div></div>
<div class="two"><label>Start<input type="time" id="sl-start" value="${d.start}"></label><label>End<input type="time" id="sl-end" value="${d.end}"></label></div>
<div id="sl-warn" class="hint"></div>
<div class="lbl">Colour<div class="sw">${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === d.color ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}<input type="color" id="sl-cust" value="${/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#4772fa'}" title="Custom colour"></div></div>
<label>Location<input id="sl-loc" value="${esc(d.loc)}" placeholder="Room, address or link" autocomplete="off"></label>
<label>Reminder<select id="sl-rem">${opts([['', 'No reminder'], [0, 'At start'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before']], d.remind == null ? '' : d.remind)}</select></label>
<label>Notes<textarea id="sl-notes" placeholder="Anything to remember">${esc(d.notes)}</textarea></label></div>
${isNew ? '<p class="hint">Save the slot first, then you can attach tasks to it.</p>' : `<div class="lbl tl">Tasks for this slot<div id="sl-tasks">${linked()}</div><input id="sl-tadd" placeholder="+ Add a task  (lands on the next ${esc(DAYS[nextSlotDate(d).getDay()])})" autocomplete="off"></div>`}
<div class="mact">${isNew ? '' : '<button class="danger" data-m="del">Delete</button><button data-m="dup">Duplicate</button>'}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="save">Save</button></div>`, m => {
    warn(); if (isNew) $('#sl-title').focus();
    m.onchange = e => { if (e.target.id === 'sl-cust') { d.color = e.target.value; $$('.sw button', m).forEach(x => x.classList.remove('on')); } else if (/^sl-(start|end)$/.test(e.target.id)) warn(); };
    m.onkeydown = e => {
      if (e.key !== 'Enter' || e.isComposing) return;
      if (e.target.id === 'sl-tadd' && e.target.value.trim()) { const t = quickAdd(e.target.value.trim(), { due: ymd(nextSlotDate(d)) }); t.slotId = d.id; save(); e.target.value = ''; $('#sl-tasks').innerHTML = linked(); renderSide(); }
      else if (e.target.id === 'sl-title') $('[data-m=save]', m).click();
    };
    m.onclick = async e => {
      const b = e.target.closest('button');
      if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.d != null) { const n = +b.dataset.d; d.days = d.days.includes(n) ? d.days.filter(x => x !== n) : [...d.days, n].sort((x, y) => x - y); b.classList.toggle('on', d.days.includes(n)); warn(); }
      else if (b.dataset.c) { d.color = b.dataset.c; $$('.sw button', m).forEach(x => x.classList.toggle('on', x === b)); }
      else if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'save') {
        read();
        if (!d.title) { toast('Give the slot a title'); $('#sl-title').focus(); return; }
        if (!d.days.length) { toast('Pick at least one day'); return; }
        if (toMin(d.end) <= toMin(d.start)) { toast('End must be after the start'); return; }
        if (isNew) S.slots.push(d); else Object.assign(s, d);
        save(); closeModal(); refresh();
      } else if (b.dataset.m === 'dup') {
        read(); S.slots.push({ ...d, id: uid(), title: (d.title || 'Slot') + ' (copy)', days: [...d.days], created: Date.now() }); save(); closeModal(); refresh(); toast('Duplicated');
      } else if (b.dataset.m === 'del') {
        closeModal();
        if (await askConfirm(`Delete “${s.title}”? Tasks linked to it stay, just unlinked.`)) { S.tasks.forEach(t => { if (t.slotId === s.id) t.slotId = null; }); S.slots = S.slots.filter(x => x !== s); save(); refresh(); } else openSlot(s);
      }
    };
  }, 'wide');
}
function openTTSettings() {
  const tt = S.settings.tt, hrs = n => Array.from({ length: n }, (_, i) => [i, `${pad(i)}:00`]);
  openModal(`<h3>Timetable settings</h3><div class="form"><label>Day starts at<select data-t="from">${opts(hrs(23), tt.from)}</select></label><label>Day ends at<select data-t="to">${opts(hrs(25).slice(1), tt.to)}</select></label><label class="inl"><input type="checkbox" data-t="weekends"${tt.weekends ? ' checked' : ''}> Show weekends</label></div><p class="hint">The grid grows by itself if something is scheduled outside these hours.</p><div class="mact"><button class="pri" data-m="ok">Done</button></div>`, m => {
    m.onchange = e => {
      const k = e.target.dataset.t; if (!k) return;
      if (k === 'weekends') tt.weekends = e.target.checked; else tt[k] = +e.target.value;
      let fix = false;
      if (tt.to <= tt.from) { if (k === 'from') tt.to = Math.min(24, tt.from + 1); else tt.from = Math.max(0, tt.to - 1); fix = true; }
      save(); if (fix) { closeModal(); openTTSettings(); }
    };
    m.onclick = e => { if (e.target.closest('[data-m]') || e.target.classList.contains('mback')) { closeModal(); renderMain(); } };
  });
}
const ttShift = n => { U.ttDate = addDays(U.ttDate || new Date(), n * (S.settings.tt.view === 'day' ? 1 : 7)); renderMain(); };
// dropping a task or slot block on the grid: set its day and (snapped to 15 min) time
function ttDrop(e, el) {
  const date = el.dataset.d, isAd = el.classList.contains('tt-ad');
  let m = 0;
  if (!isAd) m = Math.max(0, Math.min(1439, +el.dataset.from + Math.round((e.clientY - el.getBoundingClientRect().top - (U.dragOff || 0)) / (TT_HH / 60) / 15) * 15));
  if (String(U.drag).startsWith('slot:')) {
    if (isAd) return;
    const [, sid, day] = U.drag.split(':'), sl = slotById(sid); if (!sl) return;
    const len = toMin(sl.end) - toMin(sl.start), st = Math.min(m, 1424), nd = pYmd(date).getDay();
    sl.start = fromMin(st); sl.end = fromMin(Math.min(1439, st + len));
    sl.days = sl.days.length === 1 ? [nd] : [...new Set(sl.days.map(x => (x === +day ? nd : x)))].sort((a, b) => a - b);
  } else {
    const t = getT(U.drag); if (!t) return;
    t.due = date; t.slotId = null;
    if (isAd) t.time = null; else { t.time = fromMin(m); t.dur = t.dur || 30; }
  }
  save(); renderSide(); renderMain(); renderDetail();
}

const gantt_parents = () => [...S.tasks.filter(t => t.listId && !t.deleted && t.subtasks && t.subtasks.length).map(t => t.id), ...S.tasks.flatMap(t => { const out = []; const walk = a => (a || []).forEach(x => { if (x.children && x.children.length) { out.push(x.id); walk(x.children); } }); walk(t.subtasks); return out; })];
const ACT = {
  nav: el => setNav(el.dataset.nav),
  page: el => { U.page = el.dataset.page; U.sel = null; document.body.classList.remove('drawer'); render(); },
  burger: () => document.body.classList.add('drawer'),
  scrim: () => { document.body.classList.remove('drawer'); closeDetail(); },
  open: el => { U.sel = el.dataset.id; $$('.sel').forEach(x => x.classList.remove('sel')); $$(`[data-act="open"][data-id="${U.sel}"]`).forEach(x => x.classList.add('sel')); renderDetail(); },
  closedetail: closeDetail,
  toggle: el => { toggleDone(getT(el.dataset.id)); refresh(); },
  settings: openSettings,
  async addlist() {
    const n = await askText('New list'); if (!n) return;
    const l = { id: uid(), name: n, color: COLORS[S.lists.length % COLORS.length][0], sections: [], created: Date.now() };
    S.lists.push(l); save(); setNav('list:' + l.id);
  },
  async listmenu() {
    const l = listOf(U.nav.slice(5));
    const i = await askMenu(l.name, [{ label: 'Rename' }, { label: 'Change color' }, { label: 'Delete list', danger: true }]);
    if (i === 0) { const n = await askText('Rename list', l.name); if (n) { l.name = n; save(); refresh(); } }
    else if (i === 1) { const c = await pickColor(); if (c) { l.color = c; save(); refresh(); } }
    else if (i === 2 && await askConfirm(`Delete “${l.name}” and move its tasks to Trash?`)) {
      S.tasks.filter(t => t.listId === l.id).forEach(t => { t.deleted = Date.now(); });
      S.lists = S.lists.filter(x => x.id !== l.id); save(); setNav('today');
    }
  },
  view: el => { listOf(U.nav.slice(5)).view = el.dataset.v; save(); renderMain(); },
  async secadd() { const n = await askText('New section'); if (!n) return; const l = listOf(U.nav.slice(5)); if (!l.sections.includes(n)) l.sections.push(n); save(); renderMain(); },
  async secdel(el) {
    const l = listOf(U.nav.slice(5)), s = el.dataset.sec;
    if (!await askConfirm(`Delete section “${s}”? Its tasks stay in the list.`)) return;
    l.sections = l.sections.filter(x => x !== s); S.tasks.forEach(t => { if (t.listId === l.id && t.section === s) t.section = null; }); save(); renderMain();
  },
  showdone: () => { const k = U.q ? 'search' : U.nav; U.showDone[k] = !U.showDone[k]; renderMain(); },
  emptytrash: async () => { if (await askConfirm('Permanently delete everything in Trash?')) { S.tasks = S.tasks.filter(t => !t.deleted); U.sel = null; save(); refresh(); } },
  cleardone: async () => { if (await askConfirm('Move all completed tasks to Trash?', 'Clear')) { S.tasks.forEach(t => { if (!t.deleted && t.status === 'done') t.deleted = Date.now(); }); save(); refresh(); } },
  // detail actions
  prio: el => { getT(U.sel).priority = +el.dataset.p; save(); refresh(); },
  qdate: el => {
    const t = getT(U.sel), w = el.dataset.w, d = new Date();
    t.due = w === 'today' ? ymd(d) : w === 'tomorrow' ? ymd(addDays(d, 1)) : w === 'next' ? ymd(addDays(d, ((8 - d.getDay()) % 7) || 7)) : null;
    if (!t.due) { t.time = null; t.repeat = null; }
    save(); refresh();
  },
  subtog: el => { const s = getT(U.sel).subtasks.find(x => x.id === el.dataset.sid); s.done = !s.done; save(); refresh(); },
  subdel: el => { const t = getT(U.sel); t.subtasks = t.subtasks.filter(x => x.id !== el.dataset.sid); save(); refresh(); },
  del: () => { getT(U.sel).deleted = Date.now(); toast('Moved to Trash'); closeDetail(); save(); renderSide(); renderMain(); },
  restore: () => { delete getT(U.sel).deleted; save(); closeDetail(); renderSide(); renderMain(); },
  purge: () => { S.tasks = S.tasks.filter(t => t.id !== U.sel); save(); closeDetail(); renderSide(); renderMain(); },
  wontdo: () => { const t = getT(U.sel); t.status = t.status === 'wontdo' ? 'open' : 'wontdo'; save(); refresh(); },
  dup: () => { const t = getT(U.sel), c = newTask({ ...t, id: uid(), title: t.title + ' (copy)', status: 'open', created: Date.now(), subtasks: t.subtasks.map(s => ({ ...s, id: uid(), done: false })), tags: [...t.tags] }); delete c.doneAt; delete c.deleted; S.tasks.push(c); U.sel = c.id; save(); refresh(); },
  // calendar
  calprev: () => { U.calM = new Date(U.calM.getFullYear(), U.calM.getMonth() - 1, 1); renderMain(); },
  calnext: () => { U.calM = new Date(U.calM.getFullYear(), U.calM.getMonth() + 1, 1); renderMain(); },
  caltoday: () => { U.calM = new Date(); renderMain(); },
  async calday(el) {
    const d = el.dataset.d, txt = await askText('Add task on ' + fmtDate(d), '', 'e.g. Dentist 3pm !high');
    if (!txt) return;
    quickAdd(txt, { due: d }); renderSide(); renderMain();
  },
  // habits
  async haddlg() {
    const n = await askText('New habit', '', 'e.g. Read 20 pages'); if (!n) return;
    const icons = ['💧', '📚', '🏃', '🧘', '💤', '🥗', '✍️', '🎸'];
    S.habits.push({ id: uid(), name: n, icon: icons[S.habits.length % icons.length], color: COLORS[(S.habits.length + 5) % COLORS.length][0], log: {} }); save(); renderMain();
  },
  hday: el => { const h = S.habits.find(x => x.id === el.dataset.id), d = el.dataset.d; if (h.log[d]) delete h.log[d]; else h.log[d] = 1; (h.logU = h.logU || {})[d] = Date.now(); save(); renderMain(); }, // logU lets sync merge check-ins day by day
  async hmenu(el) {
    const h = S.habits.find(x => x.id === el.dataset.id);
    const i = await askMenu(h.name, [{ label: 'Rename' }, { label: 'Change color' }, { label: 'Delete habit', danger: true }]);
    if (i === 0) { const n = await askText('Rename habit', h.name); if (n) h.name = n; }
    else if (i === 1) { const c = await pickColor(); if (c) h.color = c; }
    else if (i === 2 && await askConfirm(`Delete “${h.name}” and its history?`)) S.habits = S.habits.filter(x => x !== h);
    save(); renderMain();
  },
  // notes + sync
  nmode: el => { U.nMode = el.dataset.m; renderDetail(); if (U.nMode === 'write') { const ta = $('textarea[data-f="notes"]'); if (ta) ta.focus(); } },
  nedit: (el, e) => {
    if (e.target.closest('a,input')) return; // links and checkboxes act on their own
    U.nMode = 'write'; renderDetail(); const ta = $('textarea[data-f="notes"]'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  },
  nfmt: el => mdFormat(el.dataset.k),
  syncnow: () => syncNow(true),
  // tags
  tagmenu: el => tagMenu(el.dataset.tag),
  tagcolor: el => tagMenu(el.dataset.tag),
  // timetable
  ttprev: () => ttShift(-1), ttnext: () => ttShift(1),
  tttoday: () => { U.ttDate = new Date(); renderMain(); },
  ttview: el => { S.settings.tt.view = el.dataset.v; save(); renderMain(); },
  ttday: el => { U.ttDate = pYmd(el.dataset.d); S.settings.tt.view = 'day'; save(); renderMain(); },
  tttray: () => { U.ttTray = !(U.ttTray == null ? window.innerWidth >= 1700 : U.ttTray); renderMain(); },
  ttset: openTTSettings,
  ttadd: () => { const n = new Date(), m = Math.min(1380, Math.max(S.settings.tt.from * 60, n.getMinutes() > 30 ? (n.getHours() + 1) * 60 : n.getHours() * 60)); openSlot(null, { days: [(U.ttDate || n).getDay()], start: fromMin(m), end: fromMin(m + 60) }); },
  ttslot: el => openSlot(slotById(el.dataset.sid)),
  ttcell: (el, e) => {
    const y = e.clientY - el.getBoundingClientRect().top, m = Math.min(1380, +el.dataset.from + Math.floor(y / (TT_HH / 60) / 30) * 30);
    openSlot(null, { days: [pYmd(el.dataset.d).getDay()], start: fromMin(m), end: fromMin(Math.min(1439, m + 60)) });
  },
  // gantt / OpenGantt
  ogopen: el => openOG(el.dataset.list),
  gtog: (el, e) => { e.stopPropagation(); const k = el.dataset.key; if (U.gcol.has(k)) U.gcol.delete(k); else U.gcol.add(k); renderMain(); },
  fold: el => { const f = S.settings.ui.fold; f[el.dataset.k] = !f[el.dataset.k]; save(); renderSide(); },
  uitoggle: el => uiToggle(el.dataset.k),
  gzoom: el => gtZoom(+el.dataset.d),
  gfit: gtFit,
  gtable: () => { const g = S.settings.gantt; g.table = g.table === false; save(); renderMain(); },
  gcols: openGtCols,
  gexp: el => {
    if (el.dataset.v === '0') U.gcol.clear();
    else gantt_parents().forEach(id => U.gcol.add(id));
    renderMain();
  },
  gpane: el => { U.gpane = el.dataset.p; U.gScrollReset = true; renderMain(); },
  ogsend: () => ogSeedFrame(false),
  ogpull: ogPullFrame,
  async ogcopy() { const y = ogUpstreamYaml(); if (!y) return; try { await navigator.clipboard.writeText(y.yaml); toast('Chart YAML copied'); } catch (e) { toast('Could not copy: ' + (e.message || e)); } },
  gtoday: () => { const w = $('.gt-wrap'), u = $('.gt-h .gt-ht u'); if (w && u) w.scrollLeft = Math.max(0, parseFloat(u.style.left) - 220); },
  // focus
  pmode: el => { pSet(el.dataset.m); renderMain(); },
  ptoggle: () => { pToggle(); renderMain(); },
  preset: () => { pSet(P.mode); renderMain(); },
  pskip: () => { pSet(P.mode === 'focus' ? 'short' : 'focus'); renderMain(); },
};
document.addEventListener('click', e => {
  if (U.suppress && Date.now() - U.suppress < 80) { U.suppress = 0; e.preventDefault(); return; } // the click that ends a block resize
  const a = e.target.closest('a[href]');
  if (a && a.closest('.md')) { e.preventDefault(); openExternal(a.href); return; }
  if (e.target.closest('#modal')) return;
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (fn) fn(el, e);
});

/* ---------- inputs ---------- */
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'q') { U.q = el.value.trim(); if (U.q) U.page = 'tasks'; U.sel = null; renderSide(); renderMain(); renderDetail(); $('#q').focus(); return; }
  const t = getT(U.sel);
  if (el.dataset.f === 'title' && t) { t.title = el.value; save(); $$(`.task[data-id="${t.id}"] .ttl, .card[data-id="${t.id}"] .ttl`).forEach(x => { x.innerHTML = titleHtml(t); }); }
  else if (el.dataset.f === 'notes' && t) { t.notes = el.value; U.nMode = 'write'; save(); }
  else if (el.dataset.sf && t) { const s = t.subtasks.find(x => x.id === el.dataset.sf); if (s) { s.title = el.value; save(); } }
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.closest('#modal')) return;
  if (el.classList && el.classList.contains('mdchk')) {
    const t = getT(U.sel); if (!t) return;
    t.notes = mdToggleLine(t.notes, +el.dataset.mdl); save();
    const pv = $('#nprev'); if (pv) pv.innerHTML = md(t.notes);
    renderMain(); return;
  }
  if (el.dataset.gs) { if (el.dataset.gs === 'list') U.gList = el.value; else { S.settings.gantt[el.dataset.gs] = el.value; save(); } U.gScrollReset = true; renderMain(); return; }
  if (el.dataset.sel) {
    if (el.dataset.sel === 'ptask') P.task = el.value; else { S.settings[el.dataset.sel] = el.value; save(); renderMain(); }
    return;
  }
  const f = el.dataset.f, t = getT(U.sel); if (!f || !t) return;
  const v = el.value;
  if (f === 'due') { t.due = v || null; if (!v) { t.time = null; t.repeat = null; } }
  else if (f === 'time') t.time = v || null;
  else if (f === 'list') { t.listId = v; t.section = null; }
  else if (f === 'section') t.section = v || null;
  else if (f === 'repeat') { if (v === 'none') t.repeat = null; else if (REPS[v]) { t.repeat = JSON.parse(JSON.stringify(REPS[v])); if (!t.due) t.due = todayStr(); } }
  else if (f === 'reminder') { t.reminder = v === '' ? null : +v; if (t.reminder != null) { if (!t.due) t.due = todayStr(); ensureNotify(); } }
  else if (f === 'start') t.start = v || null;
  else if (f === 'astart') t.astart = v || null;
  else if (f === 'dur') t.dur = v ? +v : null;
  else if (f === 'slot') { t.slotId = v || null; const sl = v && slotById(v); if (sl && !t.due) t.due = ymd(nextSlotDate(sl)); }
  else if (f === 'tags') t.tags = [...new Set(v.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean))];
  else return;
  save(); refresh();
});
document.addEventListener('keydown', e => {
  const el = e.target;
  if (e.key === 'Enter' && !e.isComposing) {
    if (el.id === 'add' && el.value.trim()) { const t = quickAdd(el.value.trim(), addCtx()); el.value = ''; renderSide(); renderMain(); $('#add').focus(); toast('Added “' + t.title + '”'); }
    else if (el.classList.contains('kadd') && el.value.trim()) { const sec = el.dataset.sec; quickAdd(el.value.trim(), { listId: U.nav.slice(5), section: sec || null }); renderSide(); renderMain(); const n = $$('.kadd').find(x => x.dataset.sec === sec); if (n) n.focus(); }
    else if (el.classList.contains('tradd') && el.value.trim()) { quickAdd(el.value.trim(), {}); renderSide(); renderMain(); const n = $('.tradd'); if (n) n.focus(); }
    else if (el.classList.contains('qadd') && el.value.trim()) { const i = el.dataset.q; quickAdd(el.value.trim(), U.matrixCtx[i]); renderSide(); renderMain(); $$('.qadd')[i].focus(); }
    else if (el.dataset.f === 'notes') mdEnter(el, e);
    else if (el.id === 'd-subnew' && el.value.trim()) { getT(U.sel).subtasks.push({ id: uid(), title: el.value.trim(), done: false }); save(); renderDetail(); renderMain(); $('#d-subnew').focus(); }
    return;
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  if (el.dataset && el.dataset.f === 'notes' && (e.ctrlKey || e.metaKey) && !e.altKey) {
    const k = { b: 'bold', i: 'italic', k: 'link' }[e.key.toLowerCase()];
    if (k) { e.preventDefault(); mdFormat(k); return; }
  }
  if (e.key === 'Escape') { if ($('#modal.on')) { const b = $('.mback'); if (b) b.click(); } else if (U.sel) closeDetail(); else document.body.classList.remove('drawer'); return; }
  if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); document.body.classList.add('drawer'); const q = $('#q'); if (q) q.focus(); return; }
  if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && !($('#modal.on'))) {
    if (e.key === '[') { e.preventDefault(); uiToggle('side'); return; }
    if (e.key === ']') { e.preventDefault(); uiToggle('detail'); return; }
    if (e.key === '\\') { e.preventDefault(); uiFocus(); return; }
  }
  if (e.key === 'n' && !typing && !e.ctrlKey && !e.metaKey) { const a = $('#add'); if (a) { e.preventDefault(); a.focus(); } }
});

/* ---------- notes editing helpers ---------- */
function mdFormat(kind) {
  const ta = $('textarea[data-f="notes"]'), t = getT(U.sel); if (!ta || !t) return;
  let a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
  const sel = v.slice(a, b);
  const wrap = (l, r, ph) => { const inner = sel || ph; v = v.slice(0, a) + l + inner + r + v.slice(b); a += l.length; b = a + inner.length; };
  // add `pre` to every selected line, or strip it again if all of them already have it
  const lines = (has, add, strip) => {
    const s0 = v.lastIndexOf('\n', a - 1) + 1; let e0 = v.indexOf('\n', b); if (e0 < 0) e0 = v.length;
    const ls = v.slice(s0, e0).split('\n'), blk = (ls.every(l => has.test(l)) ? ls.map(l => l.replace(strip, '')) : ls.map(l => add + l.replace(strip, ''))).join('\n');
    v = v.slice(0, s0) + blk + v.slice(e0); a = b = s0 + blk.length; // caret after the block, so typing continues the line instead of replacing it
  };
  const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/;
  if (kind === 'bold') wrap('**', '**', 'bold');
  else if (kind === 'italic') wrap('*', '*', 'italic');
  else if (kind === 'strike') wrap('~~', '~~', 'text');
  else if (kind === 'code') { if (sel.includes('\n')) wrap('```\n', '\n```', ''); else wrap('`', '`', 'code'); }
  else if (kind === 'link') { const txt = sel || 'link'; v = v.slice(0, a) + '[' + txt + '](https://)' + v.slice(b); a += txt.length + 3; b = a + 8; }
  else if (kind === 'ul') lines(/^\s*[-*+]\s+(?!\[[ xX]\])/, '- ', ITEM);
  else if (kind === 'task') lines(/^\s*[-*+]\s+\[[ xX]\]\s/, '- [ ] ', ITEM);
  else if (kind === 'quote') lines(/^>\s?/, '> ', /^>\s?/);
  else if (kind === 'h') lines(/^#{1,6}\s/, '## ', /^#{1,6}\s+/);
  ta.value = v; ta.setSelectionRange(a, b); ta.focus(); t.notes = v; U.nMode = 'write'; save();
}
// Enter at the end of a list item continues the list (an empty item ends it)
function mdEnter(ta, e) {
  if (e.shiftKey || ta.selectionStart !== ta.selectionEnd) return;
  const v = ta.value, p = ta.selectionStart, eol = v.indexOf('\n', p);
  if (eol !== -1 && eol !== p) return;
  const s0 = v.lastIndexOf('\n', p - 1) + 1, m = v.slice(s0, p).match(/^(\s*)([-*+]|(\d+)([.)]))\s+(\[[ xX]\]\s+)?(.*)$/);
  if (!m) return;
  e.preventDefault();
  if (!m[6].trim()) ta.setRangeText('', s0, p, 'end'); // empty item: drop the marker and leave the list
  else ta.setRangeText('\n' + m[1] + (m[3] ? (+m[3] + 1) + m[4] : m[2]) + ' ' + (m[5] ? '[ ] ' : ''), p, p, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ---------- drag & drop (reorder rows, move cards between board columns) ---------- */
document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.fmt,.rz')) e.preventDefault(); });
document.addEventListener('dragstart', e => {
  const r = e.target.closest('[data-id][draggable],[data-sid][draggable]'); if (!r) return;
  if (e.target.closest('.rz')) { e.preventDefault(); return; }
  U.drag = r.dataset.sid ? `slot:${r.dataset.sid}:${r.dataset.day}` : r.dataset.id;
  U.dragOff = r.classList.contains('blk') ? e.clientY - r.getBoundingClientRect().top : 0; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', U.drag); r.classList.add('drag');
});
document.addEventListener('dragend', () => { U.drag = null; $$('.drag,.over').forEach(x => x.classList.remove('drag', 'over')); });
document.addEventListener('dragover', e => {
  if (!U.drag) return;
  const tgt = e.target.closest('.task[draggable],.col[data-sec],.tt-col,.tt-ad,.nav[data-nav],.gt-t');
  if (tgt) { e.preventDefault(); $$('.over').forEach(x => x.classList.remove('over')); tgt.classList.add('over'); }
});
document.addEventListener('drop', e => {
  if (!U.drag) return;
  const tt = e.target.closest('.tt-col,.tt-ad');
  if (tt) { e.preventDefault(); ttDrop(e, tt); return; }
  const nv = e.target.closest('.nav[data-nav]');
  if (nv && getT(U.drag)) { e.preventDefault(); uiNavDrop(nv); return; }
  const gt = e.target.closest('.gt-t');
  if (gt && getT(U.drag)) { e.preventDefault(); gtDrop(e, gt); return; }
  const col = e.target.closest('.col[data-sec]'), row = e.target.closest('.task[draggable]');
  if (col) { e.preventDefault(); const t = getT(U.drag); t.section = col.dataset.sec || null; save(); renderMain(); }
  else if (row) { e.preventDefault(); reorder(U.drag, row.dataset.id); }
});

// resize a timetable block by its bottom edge (slot end time / task duration), 15-minute steps
document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('.rz'); if (!h) return;
  e.preventDefault(); e.stopPropagation();
  const blk = h.parentElement, a = +blk.dataset.a, ppm = TT_HH / 60, y0 = e.clientY, h0 = (+blk.dataset.b - a) * ppm;
  let dur = Math.round(h0 / ppm);
  if (h.setPointerCapture) h.setPointerCapture(e.pointerId);
  const mv = ev => { dur = Math.max(15, Math.min(1439 - a, Math.round((h0 + ev.clientY - y0) / ppm / 15) * 15)); blk.style.height = Math.max(18, dur * ppm - 2) + 'px'; };
  const up = () => {
    h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
    U.suppress = Date.now();
    if (h.dataset.k === 'slot') { const sl = slotById(h.dataset.id); if (sl) sl.end = fromMin(a + dur); } else { const t = getT(h.dataset.id); if (t) t.dur = dur; }
    save(); renderMain();
  };
  h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
});

/* ---------- startup ---------- */
applyTheme();
uiInit();
render();
checkReminders();
setInterval(checkReminders, 20000);
ogSchedule(1500); setInterval(() => ogSchedule(10), 180000);
// keep the timetable's "now" line moving (not while typing, in a dialog, or mid-drag)
setInterval(() => { if (U.page === 'timetable' && !U.drag && !$('#modal.on') && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) renderMain(); }, 60000);
window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); initSeen(); applyTheme(); render(); } });
window.addEventListener('pagehide', flush);
startSync();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); ogSchedule(300); if (!document.activeElement || !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) render(); } });
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__TAURI__) navigator.serviceWorker.register('sw.js').catch(() => {});
