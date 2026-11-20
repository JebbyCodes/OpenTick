/* OpenTick batch editing for notes, contacts, habits and countdowns (0.9).
   Tasks have their own, richer sheet (batch.js). The other pages share this one: a button in the page header (or Ctrl / Cmd / Shift + click
   on a computer, press and hold on a touch screen) starts selecting; taps pick and unpick; a bar at the bottom offers All, Edit… and Delete.
   The edit sheet changes only the fields you touch. Everything can be undone from the message that follows.
   One table (B2) says what each kind of thing is, how to find its rows on the page, and what can be changed together. */
U.b2 = null; // { kind, ids: Set } while selecting, otherwise null

const B2 = {
  note: { page: 'notes', noun: 'note', coll: () => S.notes, row: '#nt-items .nti[data-id]', id: el => el.dataset.id, icon: 'file-text' },
  contact: { page: 'contacts', noun: 'contact', coll: () => S.contacts, row: '#main .pe-card[data-ctid]', id: el => el.dataset.ctid, icon: 'contact' },
  habit: { page: 'habits', noun: 'habit', coll: () => S.habits, row: '#main .habit[data-id]', id: el => el.dataset.id, icon: 'activity' },
  countdown: { page: 'countdowns', noun: 'countdown', coll: () => S.countdowns, row: '#main .cdc[data-cdid]', id: el => el.dataset.cdid, icon: 'hourglass' },
};
const b2Kind = () => Object.keys(B2).find(k => B2[k].page === U.page) || null;
const b2Recs = () => (U.b2 ? B2[U.b2.kind].coll().filter(r => U.b2.ids.has(r.id)) : []);
const b2Rows = () => (U.b2 ? $$(B2[U.b2.kind].row) : []);
const b2Plural = (k, n) => `${n} ${B2[k].noun}${n === 1 ? '' : 's'}`;
// the header button that starts selecting (added by topHead)
function b2Tool() {
  const k = b2Kind(); if (!k) return '';
  return `<button class="ib${U.b2 ? ' on' : ''}" data-act="b2start" title="Select several ${B2[k].noun}s to edit them together" aria-label="Select several ${B2[k].noun}s">${ic('check-square')}</button>`;
}
function b2Start(id) {
  const k = b2Kind(); if (!k) return;
  if (U.bsel) batchExit();
  U.b2 = { kind: k, ids: new Set(id ? [id] : []), last: id || null }; document.body.classList.add('batch'); sfx('tick'); renderMain();
}
function b2Exit() { if (!U.b2) return; U.b2 = null; document.body.classList.remove('batch'); renderMain(); }
function b2Toggle(id, e) {
  const B = U.b2; if (!B) return;
  const ids = b2Rows().map(el => B2[B.kind].id(el));
  if (e && e.shiftKey && B.last && ids.includes(B.last) && ids.includes(id)) { const a = ids.indexOf(B.last), z = ids.indexOf(id); for (const x of ids.slice(Math.min(a, z), Math.max(a, z) + 1)) B.ids.add(x); }
  else if (B.ids.has(id)) B.ids.delete(id); else B.ids.add(id);
  B.last = id; sfx('tick'); b2Paint();
}
// marks the picked rows and draws the bar; called after every page render (batchPaint hands over to it)
function b2Paint() {
  if (U.b2 && U.b2.kind !== b2Kind()) { U.b2 = null; document.body.classList.remove('batch'); } // the page changed under it
  const B = U.b2; if (typeof document.getElementById !== 'function') return;
  let bar = document.getElementById('bbar');
  if (!B) { if (bar) { bar.classList.remove('on'); bar.setAttribute('aria-hidden', 'true'); } return; }
  const rows = b2Rows(); rows.forEach(el => el.classList.toggle('picked', B.ids.has(B2[B.kind].id(el))));
  if (!bar) { bar = document.createElement('div'); bar.id = 'bbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Batch actions'); document.body.appendChild(bar); }
  const n = b2Recs().length, off = n ? '' : ' disabled';
  const html = `<button class="ib" data-act="b2x" title="Leave selection (Esc)" aria-label="Leave selection">${ic('x', 20)}</button><b class="bc">${n ? `${n} selected` : `Tap ${B2[B.kind].noun}s to select`}</b><span class="sp"></span>`
    + `<button class="bb" data-act="b2all" title="Select every ${B2[B.kind].noun} shown">${ic('check-square', 20)}<span>All</span></button><button class="bb pri" data-act="b2edit"${off}>${ic('edit', 20)}<span>Edit…</span></button><button class="bb dz" data-act="b2del"${off}>${ic('trash', 20)}<span>Delete</span></button>`;
  if (bar._h !== html) { bar._h = html; bar.innerHTML = html; }
  bar.classList.add('on'); bar.removeAttribute('aria-hidden');
}

/* ---------- what can be changed together ---------- */
const B2_HOMES = () => [['', '— Keep —'], ['none', 'Not in a list or project'], ...listOpts().map(([v, n]) => ['l:' + v, n]), ...S.projects.map(p => ['p:' + p.id, 'Project: ' + p.name])];
const B2_COLOR = { k: 'color', title: 'Colour', type: 'color', get: r => r.color, show: c => (c ? (COLORS.find(x => x[0] === c) || [0, c])[1] : 'None') };
const B2_FIELDS = {
  note: [
    { k: 'tags', title: 'Tags', type: 'tags', get: r => r.tags || [] },
    { k: 'pinned', title: 'Pin', type: 'seg', opts: [['1', 'Pin'], ['0', 'Unpin']], get: r => !!r.pinned, show: v => (v ? 'Pinned' : 'Not pinned') },
    { k: 'home', title: 'List or project', type: 'select', opts: B2_HOMES, get: r => noteHomeValue(r), show: v => (v ? (B2_HOMES().find(x => x[0] === v) || [0, 'Mixed'])[1] : 'Not filed') },
  ],
  contact: [
    { k: 'tags', title: 'Tags', type: 'tags', get: r => r.tags || [] },
    { k: 'fav', title: 'Favourite', type: 'seg', opts: [['1', 'Favourite'], ['0', 'Not a favourite']], get: r => !!r.fav, show: v => (v ? 'Favourite' : 'No') },
    B2_COLOR,
  ],
  habit: [B2_COLOR],
  countdown: [
    B2_COLOR,
    { k: 'home', title: 'List or project', type: 'select', opts: () => [['', '— Keep —'], ['none', 'Not linked'], ...listOpts().filter(x => x[0] !== 'inbox').map(([v, n]) => ['l:' + v, n]), ...S.projects.map(p => ['p:' + p.id, 'Project: ' + p.name])], get: r => (r.projectId ? 'p:' + r.projectId : r.listId ? 'l:' + r.listId : ''), show: v => (v ? 'Linked' : 'Not linked') },
  ],
};
// apply one change set to one record
function b2Apply(kind, r, ch) {
  const now = Date.now();
  if (ch.addTags && ch.addTags.length) r.tags = [...new Set([...(r.tags || []), ...ch.addTags])];
  if (ch.delTags && ch.delTags.length) r.tags = (r.tags || []).filter(g => !ch.delTags.includes(g));
  if ('pinned' in ch) r.pinned = !!ch.pinned;
  if ('fav' in ch) r.fav = !!ch.fav;
  if ('color' in ch) r.color = ch.color;
  if ('home' in ch) {
    const v = ch.home, set = (l, p) => { if (kind === 'note') { delete r.listId; delete r.projectId; if (l) r.listId = l; if (p) r.projectId = p; } else { r.listId = l || ''; r.projectId = p || ''; } };
    if (v === 'none') set('', ''); else if (v.startsWith('l:')) set(v.slice(2), ''); else if (v.startsWith('p:')) set('', v.slice(2));
  }
  if (kind === 'note') r.updated = now;
  if (kind === 'contact') r.u = now;
}
function b2Snapshot(kind, ids) { return { kind, ids: [...ids], recs: B2[kind].coll().filter(r => ids.has(r.id)).map(r => JSON.parse(JSON.stringify(r))) }; }
function b2Undo(snap) {
  const coll = B2[snap.kind].coll();
  for (const old of snap.recs) { const cur = coll.find(r => r.id === old.id); if (cur) { for (const k of Object.keys(cur)) delete cur[k]; Object.assign(cur, old); } else coll.push(old); }
  if (snap.kind === 'note' && U.noteSel && !noteById(U.noteSel)) U.noteSel = null;
  save(); sfx('undo'); toast('Undone'); refresh();
}
function b2After(snap, verb) {
  const n = snap.recs.length; sfx('sched'); U.b2 = null; document.body.classList.remove('batch'); refresh();
  toast(`${verb} ${b2Plural(snap.kind, n)}`, { label: 'Undo', fn: () => b2Undo(snap) });
}
function b2Delete() {
  const B = U.b2, recs = b2Recs(); if (!recs.length) return;
  const snap = b2Snapshot(B.kind, new Set(recs.map(r => r.id))), ids = new Set(snap.ids);
  if (B.kind === 'note') { S.tasks.forEach(t => { if (t.links) t.links = t.links.filter(x => !ids.has(x)); }); S.notes = S.notes.filter(n => !ids.has(n.id)); if (ids.has(U.noteSel)) U.noteSel = null; }
  else if (B.kind === 'contact') { S.contacts = S.contacts.filter(c => !ids.has(c.id)); for (const id of ids) if (typeof ctCleanRefs === 'function') ctCleanRefs(id); }
  else if (B.kind === 'habit') S.habits = S.habits.filter(h => !ids.has(h.id));
  else S.countdowns = S.countdowns.filter(c => !ids.has(c.id));
  save(); sfx('trash'); b2After(snap, 'Deleted');
}

/* ---------- the edit sheet ---------- */
function b2EditOpen() {
  const B = U.b2, kind = B && B.kind, recs = b2Recs(); if (!recs.length) return;
  const ids = new Set(recs.map(r => r.id)), ch = {}, rm = new Set(), fields = B2_FIELDS[kind];
  const common = (f, show = x => x) => { const v = new Set(recs.map(r => JSON.stringify(f(r)))); return v.size === 1 ? show(f(recs[0])) : 'Mixed'; };
  const tagsIn = [...new Set(recs.flatMap(r => r.tags || []))].sort();
  const grp = (f, cur, body) => `<section class="bg" data-g="${f.k}"><div class="bgh"><b>${f.title}</b><small>${esc(cur)}</small><button type="button" class="bgx" data-bx="${f.k}" title="Undo this change" aria-label="Undo this change" hidden>${ic('x', 13)}</button></div>${body}</section>`;
  const body = f => {
    if (f.type === 'tags') return grp(f, tagsIn.length ? tagsIn.map(g => '#' + g).join(' ') : 'None yet', `<input data-bk="addtags" placeholder="Add tags: #home #urgent" autocomplete="off">${tagsIn.length ? `<div class="chips nopad btags"><small class="hint">Tap to remove from all:</small>${tagsIn.map(g => `<button type="button" class="tag tagb" data-bk="deltag" data-bv="${esc(g)}"${tagColor(g) ? ` style="--tc:${tagColor(g)}"` : ''}>#${esc(g)}</button>`).join('')}</div>` : ''}`);
    if (f.type === 'seg') return grp(f, common(f.get, f.show), `<div class="seg bseg">${f.opts.map(([v, n]) => `<button type="button" data-bk="${f.k}" data-bv="${esc(v)}">${esc(n)}</button>`).join('')}</div>`);
    if (f.type === 'select') return grp(f, common(f.get, f.show), `<select data-bk="${f.k}">${opts(f.opts(), '')}</select>`);
    if (f.type === 'color') return grp(f, common(f.get, f.show), `<div class="chips nopad bcol">${COLORS.map(([c, n]) => `<button type="button" class="cdot" data-bk="color" data-bv="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>`);
    return '';
  };
  openModal(`<h3>Edit ${b2Plural(kind, recs.length)}</h3><p class="hint">Only the fields you change are applied; the rest stay as they are.</p><div class="bsheet">${fields.map(body).join('')}</div><div class="mact"><span class="bn" id="b-n">No changes yet</span><span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok" id="b-ok" disabled>Apply</button></div>`, m => {
    const paint = () => { const n = Object.keys(ch).length; $('#b-n', m).textContent = n ? `${n} field${n === 1 ? '' : 's'} to change` : 'No changes yet'; $('#b-ok', m).disabled = !n; };
    const mark = k => { const g = $(`.bg[data-g="${k}"]`, m); if (g) { g.classList.add('chg'); const x = $('.bgx', g); if (x) x.hidden = false; } paint(); };
    const unmark = k => {
      const map = { tags: ['addTags', 'delTags'], pinned: ['pinned'], fav: ['fav'], color: ['color'], home: ['home'] };
      (map[k] || []).forEach(x => delete ch[x]);
      const g = $(`.bg[data-g="${k}"]`, m); if (g) { g.classList.remove('chg'); const x = $('.bgx', g); if (x) x.hidden = true; $$('.on', g).forEach(b => b.classList.remove('on')); const i = $('input', g); if (i) i.value = ''; const s = $('select', g); if (s) s.value = ''; }
      if (k === 'tags') rm.clear(); paint();
    };
    m.oninput = e => { const el = e.target; if (el.dataset.bk === 'addtags') { const v = el.value.split(/[\s,]+/).map(x => x.replace(/^#/, '').toLowerCase()).filter(Boolean); if (v.length) ch.addTags = [...new Set(v)]; else delete ch.addTags; if (ch.addTags || ch.delTags) mark('tags'); else unmark('tags'); } };
    m.onchange = e => { const el = e.target; if (el.tagName === 'SELECT' && el.dataset.bk) { if (el.value) { ch[el.dataset.bk] = el.value; mark(el.dataset.bk); } else unmark(el.dataset.bk); } };
    m.onclick = e => {
      const x = e.target.closest('[data-bx]'); if (x) { unmark(x.dataset.bx); return; }
      const b = e.target.closest('[data-bk],[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      const k = b.dataset.bk || (b.parentElement && b.parentElement.dataset.bk), v = b.dataset.bv;
      if (b.dataset.m === 'no') { closeModal(); return; }
      if (b.dataset.m === 'ok') { closeModal(); const snap = b2Snapshot(kind, ids); for (const r of B2[kind].coll()) if (ids.has(r.id)) b2Apply(kind, r, ch); save(); b2After(snap, 'Updated'); return; }
      if (b.tagName !== 'BUTTON') return;
      if (b.dataset.bk === 'deltag') { if (rm.has(v)) rm.delete(v); else rm.add(v); b.classList.toggle('on', rm.has(v)); if (rm.size) ch.delTags = [...rm]; else delete ch.delTags; if (ch.addTags || ch.delTags) mark('tags'); else unmark('tags'); }
      else if (b.dataset.bk === 'color') { ch.color = v; $$('.bcol .cdot', m).forEach(c => c.classList.toggle('on', c === b)); mark('color'); }
      else if (b.closest('.bseg') && v != null) { ch[k] = v === '1'; $$('.on', b.parentElement).forEach(c => c.classList.remove('on')); b.classList.add('on'); mark(k); }
    };
  }, 'wide');
}

/* ---------- actions, and the ways in ---------- */
const B2_ACT = {
  b2start: () => (U.b2 ? b2Exit() : b2Start(null)), b2x: () => b2Exit(),
  b2all: () => { const B = U.b2; if (!B) return; const ids = b2Rows().map(el => B2[B.kind].id(el)), all = ids.length && ids.every(id => B.ids.has(id)); if (all) B.ids.clear(); else ids.forEach(id => B.ids.add(id)); sfx('tick'); b2Paint(); },
  b2edit: () => b2EditOpen(),
  async b2del() { const n = b2Recs().length; if (!n) return; if (await askConfirm(`Delete ${b2Plural(U.b2.kind, n)}? You can undo this straight afterwards.`, 'Delete')) b2Delete(); },
};
(() => {
  const rowOf = el => { const k = b2Kind(); if (!k || !el || !el.closest) return null; const r = el.closest(B2[k].row); return r ? { r, id: B2[k].id(r) } : null; };
  // while selecting, a click on a row picks it instead of opening it
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('#bbar,header.top,#modal')) return;
    if (U.b2) { const x = rowOf(e.target); if (x) { e.preventDefault(); e.stopPropagation(); b2Toggle(x.id, e); } return; }
    if ((e.ctrlKey || e.metaKey || e.shiftKey) && b2Kind()) { const x = rowOf(e.target); if (x && !e.target.closest('input,select,textarea,a')) { e.preventDefault(); e.stopPropagation(); b2Start(x.id); } }
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && U.b2 && !$('#modal.on')) b2Exit(); });
  // press and hold on a touch screen
  let h = null, fired = false;
  document.addEventListener('touchstart', e => {
    if (U.b2 || U.bsel || e.touches.length !== 1 || !b2Kind() || (e.target.closest && e.target.closest('input,select,textarea,button:not(.pe-main):not(.cdmain)'))) return;
    const x = rowOf(e.target); if (!x) return; const t = e.touches[0], src = e.target;
    h = { x: t.clientX, y: t.clientY, timer: setTimeout(() => {
      fired = true; h = null; b2Start(x.id); try { if (!tactileOn() && navigator.vibrate) navigator.vibrate(20); } catch (_) { /* optional */ }
      const end = () => { fired = false; U.suppress = Date.now(); src.removeEventListener('touchend', end); src.removeEventListener('touchcancel', end); };
      src.addEventListener('touchend', end); src.addEventListener('touchcancel', end);
    }, 520) };
  }, { passive: true });
  const stop = () => { if (h) { clearTimeout(h.timer); h = null; } if (fired) { fired = false; U.suppress = Date.now(); } };
  document.addEventListener('touchmove', e => { if (h && Math.hypot(e.touches[0].clientX - h.x, e.touches[0].clientY - h.y) > 10) { clearTimeout(h.timer); h = null; } }, { passive: true });
  document.addEventListener('touchend', stop); document.addEventListener('touchcancel', stop);
})();
