/* OpenTick task references in notes (0.9).
   Two things you can put in any Markdown text (notes, a task's own notes, a contact's notes…):
     ![[task:ID]]              on a line of its own: a live card of that task (tick it, open it). ![[task:ID@2026-10-14]] shows one occurrence of a repeating task.
     {{task:ID.due}}           in a sentence: one property of a task, always up to date (title, status, due, priority, list, tags, subtasks, progress, repeat…).
   ID is the task's id (it survives renaming); a quoted title works too: {{task:"Pay rent".due}}.
   The "Task…" button on the note toolbar and the "/" menu write the syntax for you and let you pick which occurrence of a repeating task.
   md.js asks MD_TASK for the html, so every place that renders Markdown gets this. Nothing here stores anything: the text holds only the reference. */

const TP_REF = /^(?:"([^"]{1,200})"|([\w-]{3,40}))(?:@(\d{4}-\d{2}-\d{2}))?(?:\.([a-z]{2,12}))?$/i;
const tpStatus = t => ({ open: 'Open', done: 'Completed', wontdo: "Won't do" }[t.status] || 'Open');
const tpDay = ms => (ms ? fmtDate(ymd(new Date(ms))) : '');
// every property you can show: [key, label, fn(view) -> text]. `view` is the task, or the occurrence of it that was asked for (see tpOcc)
const TP_PROPS = [
  ['title', 'Title', v => v.title], ['status', 'Status', v => v.occ === 'upcoming' ? 'Upcoming' : v.occ === 'skipped' ? 'Skipped' : tpStatus(v)],
  ['due', 'Due date', v => (v.due ? fmtDate(v.due) : 'No date')], ['time', 'Time', v => (validHM(tmEff(v, v.due)) ? fmtTime(tmEff(v, v.due)) : '')], ['when', 'Due date and time', v => dueLabel({ ...v, time: tmEff(v, v.due) }) || 'No date'],
  ['start', 'Start date', v => (v.start ? fmtDate(v.start) : '')], ['priority', 'Priority', v => PRIO[v.priority] || 'None'],
  ['list', 'List', v => listOf(v.listId).name], ['tags', 'Tags', v => (v.tags || []).map(g => '#' + g).join(' ')],
  ['subtasks', 'Subtasks done', v => { const s = v.subtasks || []; return s.length ? `${s.filter(x => x.done).length}/${s.length}` : ''; }],
  ['progress', 'Progress', v => { const s = v.subtasks || []; return s.length ? Math.round(100 * s.filter(x => x.done).length / s.length) + '%' : v.status === 'done' ? '100%' : '0%'; }],
  ['repeat', 'Repeat', v => repeatFull(v) || 'Does not repeat'], ['next', 'Next occurrence', v => { const n = v.repeat && v.status === 'open' && !v.virtual ? nextOcc(v) : ''; return n ? fmtDate(n) : ''; }],
  ['reminder', 'Reminder', v => (v.reminder != null ? remLabel(v.reminder) : 'None')], ['duration', 'Duration', v => (durEff(v, v.due) ? fmtDur(durEff(v, v.due)) : '')],
  ['created', 'Created', v => tpDay(v.created)], ['completed', 'Completed on', v => tpDay(v.doneAt)], ['overdue', 'Overdue?', v => (v.status === 'open' && v.due && v.due < todayStr() && v.occ !== 'upcoming' ? 'Overdue' : '')],
  ['notes', 'Notes', v => String(v.notes || '').replace(/\s+/g, ' ').trim().slice(0, 300)], ['id', 'Id', v => v.id],
];
const TP_KEYS = Object.fromEntries(TP_PROPS.map(p => [p[0], p]));
const TP_ALIAS = { date: 'due', deadline: 'due', prio: 'priority', tag: 'tags', checklist: 'subtasks', done: 'status', name: 'title', text: 'title', location: 'list', recurrence: 'repeat', repeats: 'repeat', length: 'duration', finished: 'completed' };

// a task by id, else by title (an open one first)
function tpFind(id, title) {
  if (id) { const t = S.tasks.find(x => x.id === id && !x.deleted && !x.log); if (t) return t; }
  if (title) { const q = title.trim().toLowerCase(), c = S.tasks.filter(x => !x.deleted && !x.log && x.title.trim().toLowerCase() === q); return c.find(x => x.status === 'open') || c[0] || null; }
  return null;
}
// finished occurrences of a repeating task (kept as records when it was completed; newer ones point back with `of`)
const tpDone = t => S.tasks.filter(x => x.log && !x.deleted && (x.of === t.id || (!x.of && x.title === t.title && x.listId === t.listId))).sort((a, b) => (b.due || '').localeCompare(a.due || ''));
const tpRepeats = t => !!t.repeat || tpDone(t).length > 0;
// the view of one occurrence: { kind: live | done | upcoming | skipped | none | single, v } (v = what to read properties from)
function tpOcc(t, date) {
  if (!date || !tpRepeats(t) || date === t.due) return { kind: t.repeat ? 'live' : 'single', v: t };
  const rec = tpDone(t).find(x => x.due === date); if (rec) return { kind: 'done', v: rec };
  if (excOf(t, date) && excOf(t, date).skip) return { kind: 'skipped', v: { ...t, due: date, occ: 'skipped', virtual: true } };
  if (t.repeat && date > (t.due || '') && repeatDates(t, t.due, date).includes(date)) return { kind: 'upcoming', v: { ...t, due: date, time: tmEff(t, date), dur: durEff(t, date), status: 'open', occ: 'upcoming', virtual: true, subtasks: (t.subtasks || []).map(s => ({ ...s, done: false })) } };
  return { kind: 'none', v: t };
}
function tpParse(ref) {
  const m = String(ref || '').trim().match(TP_REF); if (!m) return null;
  return { title: m[1] || '', id: m[2] || '', date: m[3] || '', prop: m[4] ? (TP_ALIAS[m[4].toLowerCase()] || m[4].toLowerCase()) : '' };
}
const tpMiss = (what, why) => `<span class="tprop miss" title="${esc(why)}">${esc(what)}</span>`;
// {{task:…}} in a sentence
function tpProp(ref, noLinks) {
  const r = tpParse(ref); if (!r) return tpMiss('{{task:…}}', 'This reference is not written the way {{task:ID.property}} is');
  const t = tpFind(r.id, r.title); if (!t) return tpMiss('task?', 'No task with this ' + (r.title ? 'title' : 'id') + '. It may have been deleted.');
  const key = r.prop || 'title', p = TP_KEYS[key]; if (!p) return tpMiss(key + '?', 'Unknown property “' + key + '”. Try: ' + TP_PROPS.map(x => x[0]).join(', '));
  const o = tpOcc(t, r.date); if (o.kind === 'none') return tpMiss('no such date', 'This task has no occurrence on ' + r.date);
  const text = esc(p[2](o.v));
  return noLinks ? `<span class="tprop">${text}</span>` : `<span class="tprop${key === 'overdue' && text ? ' late' : ''}" data-tk="${esc(t.id)}" role="button" tabindex="0" title="Task: ${esc(t.title)}. Click to open">${text || '<i>–</i>'}</span>`;
}
// ![[task:…]] on a line of its own
function tpEmbed(ref) {
  const r = tpParse(ref); if (!r) return `<div class="embed emb-task miss"><small>Not a task reference: ${esc(ref)}</small></div>`;
  const t = tpFind(r.id, r.title); if (!t) return `<div class="embed emb-task miss"><span class="tprop miss">task?</span><small>No task with this ${r.title ? 'title' : 'id'}. It may have been deleted.</small></div>`;
  const o = tpOcc(t, r.date), v = o.v;
  if (o.kind === 'none') return `<div class="embed emb-task miss"><b class="et-t">${esc(t.title)}</b><small>No occurrence on ${esc(fmtDate(r.date))}</small></div>`;
  const live = (o.kind === 'live' || o.kind === 'single') && !t.deleted, done = v.status === 'done', wd = v.status === 'wontdo';
  const bits = [];
  if (v.due) bits.push(`<span class="et-due${v.status === 'open' && v.due < todayStr() && o.kind !== 'upcoming' ? ' late' : ''}">${ic('calendar', 12)} ${esc(dueLabel({ ...v, time: tmEff(v, v.due) }))}</span>`);
  if (v.priority) bits.push(`<span class="et-p p${v.priority}">${esc(PRIO[v.priority])}</span>`);
  if (t.listId !== 'inbox') bits.push(`<span class="et-l" style="--c:${esc(listOf(t.listId).color)}">${esc(listOf(t.listId).name)}</span>`);
  for (const g of (v.tags || []).slice(0, 4)) bits.push(`<span class="et-g">#${esc(g)}</span>`);
  const sub = TP_KEYS.subtasks[2](v); if (sub) bits.push(`<span class="et-s">${ic('check-square', 12)} ${esc(sub)}</span>`);
  if (t.repeat) bits.push(`<span class="et-r">${ic('repeat', 12)} ${esc(repeatLabel(t.repeat))}</span>`);
  const badge = { done: 'Completed occurrence', upcoming: 'Upcoming occurrence', skipped: 'Skipped occurrence' }[o.kind] || (r.date && o.kind === 'live' ? 'This occurrence' : '');
  return `<div class="embed emb-task${done ? ' fin' : ''}${wd ? ' wd' : ''} p${v.priority || 0}" data-tk="${esc(t.id)}"><button type="button" class="chk${done ? ' on' : ''}" data-tkact="toggle" aria-label="${done ? 'Mark not done' : 'Mark done'}"${live ? '' : ' disabled'}></button>`
    + `<div class="et-b"><a class="et-t" data-tk="${esc(t.id)}" role="button" tabindex="0" title="Open this task">${esc(v.title)}</a>${bits.length ? `<div class="et-m">${bits.join('')}</div>` : ''}${badge ? `<small class="et-o">${badge}${r.date ? ' · ' + esc(fmtDate(r.date)) : ''}</small>` : ''}</div></div>`;
}
MD_TASK = { prop: tpProp, embed: tpEmbed };
// what a block's cached html depends on: the tasks it refers to (so a card in the block editor follows the task)
function tpSig(src) {
  if (!/(?:\{\{|!\[\[)task:/.test(src)) return '';
  let s = ''; for (const m of src.matchAll(/(?:\{\{|!\[\[)task:([^}\]\n|]{1,200})/g)) { const r = tpParse(m[1].replace(/\s+$/, '').replace(/&quot;/g, '"')); const t = r && tpFind(r.id, r.title); s += t ? [t.title, t.status, t.due, t.time, t.priority, t.listId, (t.tags || []).join(), (t.subtasks || []).map(x => +!!x.done).join(''), t.notes && t.notes.length, tpDone(t).length].join('~') : '-'; }
  return s;
}

/* ---------- clicks ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-tkact],.tprop[data-tk],.et-t[data-tk]'); if (!el || !el.closest('.md')) return;
  e.preventDefault(); e.stopPropagation();
  const box = el.closest('[data-tk]'), id = box && box.dataset.tk;
  if (el.dataset.tkact === 'toggle') { const t = getT(id); if (t && !el.disabled) { toggleDone(t); refresh(); if (U.page === 'notes') renderMain(); } return; }
  openTaskById(id);
}, true);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.tprop[data-tk],.et-t[data-tk]')) { e.preventDefault(); e.target.click(); } });

/* ---------- the picker: which task, which occurrence, and what to show ---------- */
function tpSyntax(t, { date = '', prop = '', embed = false, byTitle = false } = {}) {
  const ref = (byTitle ? `"${t.title.replace(/["}\]|]/g, '')}"` : t.id) + (date ? '@' + date : '');
  return embed ? `![[task:${ref}]]` : `{{task:${ref}${prop && prop !== 'title' ? '.' + prop : prop === 'title' ? '.title' : ''}}}`;
}
// the occurrences you can pick for a repeating task: the one coming up, the next ones, and the ones already finished
function tpChoices(t) {
  const out = [['', 'Always the next one (follows the task)']];
  if (!tpRepeats(t)) return out;
  if (t.due && t.status === 'open') out.push([t.due, 'Now: ' + dueLabel({ ...t, time: tmEff(t, t.due) })]);
  if (t.repeat && t.due && t.status === 'open') { const to = ymd(addDays(pYmd(t.due), 400)); for (const d of repeatDates(t, t.due, to).slice(0, 8)) out.push([d, 'Upcoming: ' + fmtDate(d)]); }
  for (const x of tpDone(t).slice(0, 12)) if (x.due) out.push([x.due, 'Completed: ' + fmtDate(x.due)]);
  return out;
}
// opens the picker and calls back with the text to insert (or nothing if it was cancelled)
function taskRefPick(done) {
  const open = S.tasks.filter(t => !t.deleted && !t.log && t.status !== 'wontdo').sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || dueKey(a).localeCompare(dueKey(b)));
  const st = { t: null, date: '', as: 'embed', prop: 'due', title: false };
  const row = t => `<button type="button" class="lprow" data-tp="${t.id}"><span class="lpc">${t.status === 'done' ? ic('check', 14) : ''}</span><span class="lpt">${esc(t.title)}</span><small>${esc(t.repeat ? '↻ ' + repeatLabel(t.repeat) : t.due ? dueLabel(t) : listOf(t.listId).name)}</small></button>`;
  const list = q => { q = q.trim().toLowerCase(); return open.filter(t => !q || (t.title + ' ' + (t.tags || []).join(' ')).toLowerCase().includes(q)).slice(0, 60).map(row).join('') || '<p class="hint">No matching tasks.</p>'; };
  const stage2 = () => {
    const t = st.t, ch = tpChoices(t), view = tpOcc(t, st.date).v;
    return `<p class="hint"><b>${esc(t.title)}</b></p>`
      + (ch.length > 1 ? `<label class="fld">Which occurrence?<select data-tpk="date">${opts(ch, st.date)}</select></label>` : '')
      + `<div class="seg" role="tablist"><button class="${st.as === 'embed' ? 'on' : ''}" data-tpas="embed">Task card</button><button class="${st.as === 'prop' ? 'on' : ''}" data-tpas="prop">One property</button></div>`
      + (st.as === 'prop' ? `<label class="fld">Show<select data-tpk="prop">${opts(TP_PROPS.map(p => [p[0], `${p[1]} — ${esc(String(p[2](view))).slice(0, 40) || '–'}`]), st.prop)}</select></label>` : '')
      + `<label class="chkl"><input type="checkbox" data-tpk="title"${st.title ? ' checked' : ''}> Refer to it by its title instead of its id <small class="hint">(breaks if the task is renamed)</small></label>`
      + `<p class="hint">Preview</p><div class="md tp-pv">${md(tpSyntax(t, { date: st.date, prop: st.prop, embed: st.as === 'embed', byTitle: st.title }))}</div><code class="tp-src">${esc(tpSyntax(t, { date: st.date, prop: st.prop, embed: st.as === 'embed', byTitle: st.title }))}</code>`;
  };
  openModal(`<h3>Insert a task</h3><div id="tp-1"><input id="tp-q" placeholder="Search tasks" autocomplete="off"><div class="lplist" id="tp-l">${list('')}</div></div><div id="tp-2" hidden></div><div class="mact"><button data-m="back" id="tp-back" hidden>Back</button><span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok" id="tp-ok" disabled>Insert</button></div>`, m => {
    const q = $('#tp-q', m), p1 = $('#tp-1', m), p2 = $('#tp-2', m), ok = $('#tp-ok', m), back = $('#tp-back', m);
    if (!narrow(820)) q.focus();
    const paint2 = () => { p2.innerHTML = stage2(); };
    m.oninput = e => { if (e.target.id === 'tp-q') $('#tp-l', m).innerHTML = list(q.value); };
    m.onchange = e => { const k = e.target.dataset.tpk; if (!k) return; st[k] = k === 'title' ? e.target.checked : e.target.value; if (k === 'date') { /* keep the choice */ } paint2(); };
    m.onclick = e => {
      const r = e.target.closest('[data-tp]'); if (r) { st.t = getT(r.dataset.tp); st.date = ''; p1.hidden = true; p2.hidden = false; back.hidden = false; ok.disabled = false; paint2(); return; }
      const as = e.target.closest('[data-tpas]'); if (as) { st.as = as.dataset.tpas; paint2(); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'back') { p1.hidden = false; p2.hidden = true; back.hidden = true; ok.disabled = true; st.t = null; }
      else if (b.dataset.m === 'ok' && st.t) { const text = tpSyntax(st.t, { date: st.date, prop: st.prop, embed: st.as === 'embed', byTitle: st.title }); closeModal(); done(text, st.as === 'embed'); }
    };
  }, 'wide');
}
// toolbar / menu: put the reference into a textarea at the caret (an embed goes on a line of its own)
function taskRefInsert(ta) {
  taskRefPick((text, embed) => {
    if (!ta || !document.body.contains(ta)) { toast('Nowhere to insert it'); return; }
    const v = ta.value, a = ta.selectionStart == null ? v.length : ta.selectionStart, b = ta.selectionEnd == null ? a : ta.selectionEnd;
    const pre = embed && a > 0 && v[a - 1] !== '\n' ? '\n' : '', post = embed ? '\n' : '', ins = pre + text + post;
    ta.value = v.slice(0, a) + ins + v.slice(b); const at = a + ins.length; ta.focus(); ta.setSelectionRange(at, at);
    ta.dispatchEvent(typeof InputEvent === 'function' ? new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }) : new Event('input', { bubbles: true }));
  });
}
// the cheat sheet for the help page and the "copy" button
const TP_HELP = `![[task:ID]]  a live card of a task (on its own line)\n![[task:ID@2026-10-14]]  one occurrence of a repeating task\n{{task:ID.due}}  one property inside a sentence\n{{task:"Pay rent".priority}}  by title instead of id\nProperties: ${TP_PROPS.map(p => p[0]).join(', ')}`;
