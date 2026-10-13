/* OpenTick batch editing: select several tasks and change them together.
   Enter selection with the checkbox button in the Tasks header, by pressing and holding a task (phones), or with Ctrl / Cmd /
   Shift + click (desktop). Taps then pick and unpick tasks (Shift + click picks a range). A bar at the bottom offers Complete,
   Delete and Edit…; the edit sheet changes only the fields you touch and leaves every other field of every task alone.
   After applying, Undo is offered in the message. */
U.bsel = null; // a Set of task ids while selecting, otherwise null
const BATCH_PAGES = ['tasks', 'matrix'];
const bIds = () => (U.bsel ? [...U.bsel].filter(id => getT(id)) : []);
const bVisible = () => [...new Set($$('#main [data-act="open"][data-id]').filter(el => el.classList.contains('task') || el.classList.contains('card')).map(el => el.dataset.id))];

function batchStart(id) {
  if (!BATCH_PAGES.includes(U.page)) return;
  U.bsel = new Set(id ? [id] : []); document.body.classList.add('batch');
  if (U.sel) closeDetail();
  sfx('tick'); renderMain();
}
function batchExit() { if (!U.bsel) return; U.bsel = null; document.body.classList.remove('batch'); renderMain(); }
function batchToggle(id, e) {
  if (!U.bsel) return;
  const vis = bVisible();
  if (e && e.shiftKey && U.bLast && vis.includes(U.bLast) && vis.includes(id)) { // a range from the last tap
    const a = vis.indexOf(U.bLast), b = vis.indexOf(id); for (const x of vis.slice(Math.min(a, b), Math.max(a, b) + 1)) U.bsel.add(x);
  } else if (U.bsel.has(id)) U.bsel.delete(id); else U.bsel.add(id);
  U.bLast = id; sfx('tick');
  $$(`#main [data-id="${id}"]`).forEach(el => { if (el.classList.contains('task') || el.classList.contains('card')) el.classList.toggle('picked', U.bsel.has(id)); });
  if (e && e.shiftKey) renderMain(); else batchPaint();
}
// the bar at the bottom; created on first use
function batchPaint() {
  if (typeof document.getElementById !== 'function') return;
  let bar = document.getElementById('bbar');
  if (!U.bsel) { if (bar) bar.classList.remove('on'); return; }
  if (!bar) { bar = document.createElement('div'); bar.id = 'bbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Batch actions'); document.body.appendChild(bar); }
  const n = bIds().length, off = n ? '' : ' disabled';
  const html = `<button class="ib" data-act="bx" title="Leave selection (Esc)" aria-label="Leave selection">${ic('x', 20)}</button><b class="bc">${n ? `${n} selected` : 'Tap tasks to select'}</b><span class="sp"></span>`
    + `<button class="bb" data-act="ball" title="Select every task shown">${ic('check-square', 20)}<span>All</span></button><button class="bb" data-act="bdone"${off}>${ic('check-circle', 20)}<span>Complete</span></button><button class="bb pri" data-act="bedit"${off}>${ic('sliders', 20)}<span>Edit</span></button><button class="bb danger" data-act="bdel"${off}>${ic('trash', 20)}<span>Delete</span></button>`;
  if (bar._h !== html) { bar._h = html; bar.innerHTML = html; }
  bar.classList.add('on');
}

/* ---------- applying changes, with undo ---------- */
function batchSnapshot(ids) { return { before: new Set(S.tasks.map(t => t.id)), tasks: ids.map(id => JSON.parse(JSON.stringify(getT(id)))) }; }
function batchUndo(snap) {
  S.tasks = S.tasks.filter(t => snap.before.has(t.id)); // drop occurrences a repeating task logged when it was completed
  for (const old of snap.tasks) { const cur = getT(old.id); if (!cur) { S.tasks.push(old); continue; } for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, old); }
  save(); sfx('undo'); toast('Undone'); refresh();
}
function batchApplyChanges(ids, ch) {
  const snap = batchSnapshot(ids), td = todayStr();
  for (const id of ids) {
    const t = getT(id); if (!t) continue;
    if ('priority' in ch) t.priority = ch.priority;
    if ('due' in ch) { t.due = ch.due; if (!t.due) { t.time = null; t.repeat = null; } else if (t.start && t.due < t.start) t.start = t.due; }
    if ('shift' in ch && t.due) { t.due = ymd(addDays(pYmd(t.due), ch.shift)); if (t.start) t.start = ymd(addDays(pYmd(t.start), ch.shift)); }
    if ('time' in ch) { t.time = ch.time; if (ch.time && !t.due) t.due = td; }
    if ('dur' in ch) t.dur = ch.dur;
    if ('reminder' in ch) { t.reminder = ch.reminder; if (ch.reminder != null && !t.due) t.due = td; }
    if ('listId' in ch && t.listId !== ch.listId) { t.listId = ch.listId; t.section = null; }
    if ('repeat' in ch) { if (ch.repeat === 'none') t.repeat = null; else { t.repeat = JSON.parse(JSON.stringify(REPS[ch.repeat])); if (!t.due) t.due = td; } }
    if (ch.addTags && ch.addTags.length) t.tags = [...new Set([...t.tags, ...ch.addTags])];
    if (ch.delTags && ch.delTags.length) t.tags = t.tags.filter(g => !ch.delTags.includes(g));
    if (ch.status === 'done' && t.status === 'open') toggleDone(t);
    else if (ch.status === 'open' && t.status !== 'open') { t.status = 'open'; delete t.doneAt; }
    else if (ch.status === 'wontdo') t.status = 'wontdo';
  }
  if (ch.reminder != null) ensureNotify();
  save(); return snap;
}
function batchAfter(snap, verb, n) {
  sfx('sched');
  const e = U.bsel; U.bsel = null; document.body.classList.remove('batch'); if (e) e.clear();
  refresh();
  toast(`${verb} ${n} task${n === 1 ? '' : 's'}`, { label: 'Undo', fn: () => batchUndo(snap) });
}

/* ---------- the edit sheet ---------- */
function openBatchEdit() {
  const ids = bIds(); if (!ids.length) return;
  const ts = ids.map(getT), ch = {}, rm = new Set(), td = new Date();
  const common = (f, show = x => x) => { const v = new Set(ts.map(t => JSON.stringify(f(t)))); return v.size === 1 ? show(f(ts[0])) : 'Mixed'; };
  const tagsIn = [...new Set(ts.flatMap(t => t.tags))].sort();
  const seg = (k, arr) => `<div class="seg bseg" data-bk="${k}">${arr.map(([v, n, c]) => `<button type="button" data-bv="${esc(v)}" class="${c || ''}">${n}</button>`).join('')}</div>`;
  const grp = (k, title, cur, body) => `<section class="bg" data-g="${k}"><div class="bgh"><b>${title}</b><small>${esc(cur)}</small><button type="button" class="bgx" data-bx="${k}" title="Undo this change" aria-label="Undo this change" hidden>${ic('x', 13)}</button></div>${body}</section>`;
  const dateIn = `<input type="date" class="bd" data-bk="duedate">`;
  const listSel = `<select data-bk="list"><option value="">— Keep —</option>${listOpts().map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join('')}</select>`;
  const repSel = `<select data-bk="repeat">${opts([['', '— Keep —'], ['none', 'Does not repeat'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']], '')}</select>`;
  openModal(`<h3>Edit ${ids.length} task${ids.length === 1 ? '' : 's'}</h3><p class="hint">Only the fields you change are applied; the rest stay as they are.</p><div class="bsheet">`
    + grp('priority', 'Priority', common(t => t.priority, p => PRIO[p]), seg('priority', [[3, 'High', 'p3'], [2, 'Medium', 'p2'], [1, 'Low', 'p1'], [0, 'None']]))
    + grp('due', 'Due date', common(t => t.due, d => (d ? fmtDate(d) : 'None')), `<div class="chips nopad">${[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['next', 'Next week'], ['none', 'No date']].map(([v, n]) => `<button type="button" class="btn sm" data-bk="due" data-bv="${v}">${n}</button>`).join('')}${[[1, '+1 day'], [7, '+1 week']].map(([v, n]) => `<button type="button" class="btn sm" data-bk="shift" data-bv="${v}">${n}</button>`).join('')}</div>${dateIn}`)
    + grp('time', 'Time', common(t => t.time, x => x || 'None'), `<div class="rowf"><input type="time" data-bk="time"><button type="button" class="btn sm" data-bk="timeclear">Clear time</button></div>`)
    + grp('dur', 'Duration', common(t => t.dur, x => (x ? fmtDur(x) : 'None')), durHtml('b', 0))
    + grp('reminder', 'Reminder', common(t => t.reminder, x => (x == null ? 'None' : remLabel(x))), remHtml('b', undefined, false, true))
    + grp('tags', 'Tags', tagsIn.length ? tagsIn.map(g => '#' + g).join(' ') : 'None yet', `<input data-bk="addtags" placeholder="Add tags: #home #urgent" autocomplete="off">${tagsIn.length ? `<div class="chips nopad btags"><small class="hint">Tap to remove from all:</small>${tagsIn.map(g => `<button type="button" class="tag tagb" data-bk="deltag" data-bv="${esc(g)}"${tagColor(g) ? ` style="--tc:${tagColor(g)}"` : ''}>#${esc(g)}</button>`).join('')}</div>` : ''}`)
    + grp('list', 'List', common(t => t.listId, id => listOf(id).name), listSel)
    + grp('repeat', 'Repeat', common(t => repeatLabel(t.repeat) || 'None', x => x), repSel)
    + grp('status', 'Status', common(t => t.status, x => ({ open: 'Open', done: 'Completed', wontdo: "Won't do" }[x])), seg('status', [['done', 'Complete'], ['open', 'Reopen'], ['wontdo', "Won't do"]]))
    + `</div><div class="mact"><span class="bn" id="b-n">No changes yet</span><span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok" id="b-ok" disabled>Apply</button></div>`, m => {
    const dbox = $('[data-dur=b]', m), rbox = $('[data-rem=b]', m);
    const mark = k => { const g = $(`.bg[data-g="${k}"]`, m); if (g) { g.classList.add('chg'); const x = $('.bgx', g); if (x) x.hidden = false; } paint(); };
    const unmark = k => {
      const map = { priority: ['priority'], due: ['due', 'shift'], time: ['time'], dur: ['dur'], reminder: ['reminder'], tags: ['addTags', 'delTags'], list: ['listId'], repeat: ['repeat'], status: ['status'] };
      (map[k] || []).forEach(x => delete ch[x]); if (k === 'tags') { rm.clear(); $$('[data-bk=deltag]', m).forEach(b => b.classList.remove('on')); const i = $('[data-bk=addtags]', m); if (i) i.value = ''; }
      const g = $(`.bg[data-g="${k}"]`, m); if (g) { g.classList.remove('chg'); const x = $('.bgx', g); if (x) x.hidden = true; $$('.on', g).forEach(b => { if (b.dataset.bk || b.dataset.bv) b.classList.remove('on'); }); }
      if (k === 'dur' && dbox) durSet(dbox, 0); if (k === 'reminder' && rbox) { rbox.querySelector('.rsel').value = 'keep'; remSync(rbox); } paint();
    };
    const paint = () => { const n = Object.keys(ch).length; $('#b-n', m).textContent = n ? `${n} field${n === 1 ? '' : 's'} to change` : 'No changes yet'; $('#b-ok', m).disabled = !n; };
    const setSeg = (el, k) => { $$('.on', el.parentElement).forEach(b => b.classList.remove('on')); el.classList.add('on'); };
    m.oninput = e => {
      const el = e.target;
      if (el.closest('[data-dur=b]')) { ch.dur = durRead(dbox); durMark(dbox, ch.dur || 0); mark('dur'); }
      else if (el.dataset.bk === 'addtags') { const v = el.value.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean); if (v.length) ch.addTags = [...new Set(v)]; else delete ch.addTags; mark('tags'); if (!ch.addTags && !ch.delTags) unmark('tags'); }
    };
    m.onchange = e => {
      const el = e.target, k = el.dataset.bk;
      if (el.closest('[data-dur=b]')) { ch.dur = durRead(dbox); durSet(dbox, ch.dur || 0); mark('dur'); return; }
      if (el.closest('[data-rem=b]')) { remSync(rbox); const r = remRead(rbox); if (r === undefined) { unmark('reminder'); return; } ch.reminder = r; mark('reminder'); return; }
      if (k === 'duedate') { if (el.value) { ch.due = el.value; delete ch.shift; $$('[data-bk=due],[data-bk=shift]', m).forEach(b => b.classList.remove('on')); mark('due'); } }
      else if (k === 'time') { ch.time = el.value || null; mark('time'); }
      else if (k === 'list') { if (el.value) { ch.listId = el.value; mark('list'); } else unmark('list'); }
      else if (k === 'repeat') { if (el.value) { ch.repeat = el.value; mark('repeat'); } else unmark('repeat'); }
    };
    m.onclick = e => {
      const x = e.target.closest('[data-bx]'); if (x) { unmark(x.dataset.bx); return; }
      const dp = e.target.closest('[data-dp]'); if (dp) { ch.dur = +dp.dataset.dp || null; durSet(dbox, ch.dur || 0); mark('dur'); return; }
      const sg = e.target.closest('.bseg button[data-bv]'); // priority / status choices
      if (sg) { const k = sg.parentElement.dataset.bk, v = sg.dataset.bv; if (k === 'priority') ch.priority = +v; else ch.status = v; setSeg(sg); mark(k); return; }
      const b = e.target.closest('[data-bk],[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      const k = b.dataset.bk, v = b.dataset.bv;
      if (b.dataset.m === 'no') { closeModal(); return; }
      if (b.dataset.m === 'ok') {
        const n = ids.length; closeModal(); const snap = batchApplyChanges(ids, ch); batchAfter(snap, 'Updated', n); return;
      }
      if (k === 'due') { const d = new Date(); ch.due = v === 'today' ? ymd(d) : v === 'tomorrow' ? ymd(addDays(d, 1)) : v === 'next' ? ymd(addDays(d, ((8 - d.getDay()) % 7) || 7)) : null; delete ch.shift; $$('[data-bk=due],[data-bk=shift]', m).forEach(c => c.classList.toggle('on', c === b)); const di = $('[data-bk=duedate]', m); if (di) di.value = ch.due || ''; mark('due'); }
      else if (k === 'shift') { ch.shift = +v; delete ch.due; $$('[data-bk=due],[data-bk=shift]', m).forEach(c => c.classList.toggle('on', c === b)); mark('due'); }
      else if (k === 'timeclear') { ch.time = null; const ti = $('[data-bk=time]', m); if (ti) ti.value = ''; mark('time'); }
      else if (k === 'deltag') { const g = v; if (rm.has(g)) rm.delete(g); else rm.add(g); b.classList.toggle('on', rm.has(g)); if (rm.size) ch.delTags = [...rm]; else delete ch.delTags; mark('tags'); if (!ch.addTags && !ch.delTags) unmark('tags'); }
    };
  }, 'wide');
}

/* ---------- actions ---------- */
const BATCH_ACT = {
  bstart: () => (U.bsel ? batchExit() : batchStart(null)),
  bx: () => batchExit(),
  ball: () => { const vis = bVisible(), all = vis.every(id => U.bsel.has(id)); if (all) U.bsel.clear(); else vis.forEach(id => U.bsel.add(id)); sfx('tick'); renderMain(); },
  bedit: () => openBatchEdit(),
  bdone: () => { const ids = bIds(); if (!ids.length) return; const snap = batchApplyChanges(ids, { status: 'done' }); batchAfter(snap, 'Completed', ids.length); },
  async bdel() {
    const ids = bIds(); if (!ids.length) return;
    const snap = batchSnapshot(ids); ids.forEach(id => { getT(id).deleted = Date.now(); }); save(); sfx('trash'); batchAfter(snap, 'Moved to Trash:', ids.length);
  },
};

// press and hold a task to start selecting (touch); Ctrl / Cmd / Shift + click does the same with a mouse
(() => {
  let h = null, fired = false;
  const rowOf = el => el && el.closest && el.closest('#main .task[data-id],#main .card[data-id]');
  document.addEventListener('touchstart', e => {
    if (!BATCH_PAGES.includes(U.page) || U.bsel || e.touches.length !== 1 || (e.target.closest && e.target.closest('input,select,textarea,.chk'))) return;
    const r = rowOf(e.target); if (!r) return; const t = e.touches[0];
    const src = e.target; // the list is redrawn when selecting starts, which detaches this element: its own touchend still arrives, the document's does not
    h = { x: t.clientX, y: t.clientY, timer: setTimeout(() => {
      fired = true; h = null; batchStart(r.dataset.id); try { if (navigator.vibrate) navigator.vibrate(20); } catch (_) { /* optional */ }
      const end = () => { fired = false; U.suppress = Date.now(); src.removeEventListener('touchend', end); src.removeEventListener('touchcancel', end); };
      src.addEventListener('touchend', end); src.addEventListener('touchcancel', end);
    }, 520) };
  }, { passive: true });
  const stop = () => { if (h) { clearTimeout(h.timer); h = null; } if (fired) { fired = false; U.suppress = Date.now(); } }; // the click that ends the press must not also toggle the row
  document.addEventListener('touchmove', e => { if (h && Math.hypot(e.touches[0].clientX - h.x, e.touches[0].clientY - h.y) > 10) { clearTimeout(h.timer); h = null; } }, { passive: true });
  document.addEventListener('touchend', stop); document.addEventListener('touchcancel', stop);
  document.addEventListener('contextmenu', e => { if (h || fired) e.preventDefault(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && U.bsel && !$('#modal.on')) batchExit(); });
  document.addEventListener('click', e => {
    if (!U.bsel && (e.ctrlKey || e.metaKey || e.shiftKey) && BATCH_PAGES.includes(U.page)) { const r = rowOf(e.target); if (r && !e.target.closest('input,select,textarea,a')) { e.preventDefault(); e.stopPropagation(); batchStart(r.dataset.id); } }
  }, true);
})();
