/* OpenTick: linking by tags (0.9).
   A tag is a link. Give two things the same tag and each shows the other: tasks, notes, lists, projects, people (Contacts) and
   countdowns can all carry tags. Nothing is stored for the link itself, it is worked out from the tags, so it needs no syncing or
   cleaning up and follows every edit at once. Lists and projects gained a tags field in 0.9 (it is optional, so older data and
   older versions are unaffected: a record without tags simply links to nothing).
   Where it shows up:
     "Linked by tags" in the task panel, in a note's details, and in a person's profile
     "Everything tagged #x" (tlDlg): one tag across every kind, from any tag button or from the tag page
     ![[tag:anna]] / {{tag:anna.count}} inside notes (live), with a toolbar button and a "/" command to insert them */

const TL_KIND = {
  task: { label: 'Tasks', one: 'task', icon: 'check-square', key: 'tasks' },
  note: { label: 'Notes', one: 'note', icon: 'notes', key: 'notes' },
  list: { label: 'Lists', one: 'list', icon: 'list', key: 'lists' },
  project: { label: 'Projects', one: 'project', icon: 'layers', key: 'projects' },
  contact: { label: 'People', one: 'person', icon: 'contact', key: 'people' },
  countdown: { label: 'Countdowns', one: 'countdown', icon: 'hourglass', key: 'countdowns' },
};
const TL_ORDER = Object.keys(TL_KIND);
// what a person may write after the tag name: .tasks, .people ... (also the singular)
const TL_WORD = { tasks: 'task', task: 'task', notes: 'note', note: 'note', lists: 'list', list: 'list', projects: 'project', project: 'project', people: 'contact', person: 'contact', contacts: 'contact', contact: 'contact', countdowns: 'countdown', countdown: 'countdown' };

const tlName = g => String(g == null ? '' : g).trim().replace(/^#+/, '').toLowerCase();
// "#a #b, c" -> ['a','b','c'] (what a tags field holds), the same rule the task and note fields use
const tlParse = s => [...new Set(String(s || '').split(/[\s,]+/).map(tlName).filter(Boolean))].slice(0, 30);
const tlTags = r => (r && Array.isArray(r.tags) ? r.tags : []);
const tlColl = k => k === 'task' ? S.tasks.filter(t => !t.deleted && !t.log) : k === 'note' ? S.notes : k === 'list' ? S.lists : k === 'project' ? S.projects : k === 'contact' ? (S.contacts || []) : (S.countdowns || []).filter(c => !c.archived);
const tlPlain = (k, r) => k === 'task' ? (r.title || 'Untitled') : k === 'note' ? noteTitle(r) : (r.name || 'Untitled');
const tlLabel = (k, r) => k === 'task' ? titleHtml(r) : k === 'note' ? noteTitleHtml(r) : esc(r.name || 'Untitled');
const tlIco = (k, r) => k === 'list' || k === 'project' ? listIcon(r, 13) : k === 'task' ? ic(r.status === 'done' ? 'check-circle' : 'check-square', 13) : k === 'countdown' && r.icon ? iconAny(r.icon, 13, 'hourglass') : ic(TL_KIND[k].icon, 13);
// a stable, readable order inside one kind: open tasks by date, notes by last edit, everything else by name
function tlSort(k, rs) {
  const a = rs.slice();
  if (k === 'task') return a.sort((x, y) => (x.status === 'open' ? 0 : 1) - (y.status === 'open' ? 0 : 1) || String(x.due || '9').localeCompare(String(y.due || '9')) || String(x.title).localeCompare(String(y.title)));
  if (k === 'note') return a.sort((x, y) => (y.updated || 0) - (x.updated || 0));
  return a.sort((x, y) => String(tlPlain(k, x)).localeCompare(String(tlPlain(k, y))));
}
// every tag in use, anywhere, with how many things carry it: [[tag, count]] most used first
function tlAllTags() {
  const n = new Map();
  for (const k of TL_ORDER) for (const r of tlColl(k)) for (const g of tlTags(r)) n.set(g, (n.get(g) || 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
// everything that carries a tag: [{k, r}] (kinds: an optional list of kinds to look at)
function tlWith(tag, kinds) {
  tag = tlName(tag); const out = [];
  if (!tag) return out;
  for (const k of (kinds || TL_ORDER)) for (const r of tlSort(k, tlColl(k).filter(x => tlTags(x).includes(tag)))) out.push({ k, r });
  return out;
}
// everything else that shares a tag with this record: [{k, r, shared}], most shared tags first inside each kind
function tlRelated(k0, rec) {
  const mine = tlTags(rec), out = [];
  if (!mine.length) return out;
  for (const k of TL_ORDER) {
    const rows = [];
    for (const r of tlSort(k, tlColl(k))) { if (r === rec || (k === k0 && r.id === rec.id)) continue; const shared = tlTags(r).filter(g => mine.includes(g)); if (shared.length) rows.push({ k, r, shared }); }
    rows.sort((a, b) => b.shared.length - a.shared.length); out.push(...rows);
  }
  return out;
}

/* ---------- the "Linked by tags" block ---------- */
const tlChip = (k, r, shared) => `<span class="lchip${k === 'task' && r.status !== 'open' ? ' fin' : ''}"><button type="button" class="lc-b" data-tlk="${k}" data-tlid="${esc(r.id)}" title="${esc(TL_KIND[k].one)}">${tlIco(k, r)}<span>${tlLabel(k, r)}</span>${shared && shared.length ? `<small>${esc(shared.slice(0, 2).map(g => '#' + g).join(' '))}</small>` : ''}</button></span>`;
function tlGroups(rel, tags, cap = 8) {
  const by = {}; for (const x of rel) (by[x.k] = by[x.k] || []).push(x);
  return TL_ORDER.filter(k => by[k]).map(k => {
    const rows = by[k], more = rows.length - cap;
    return `<div class="tl-g"><small>${esc(TL_KIND[k].label)}<span class="fcnt">${rows.length}</span></small><div class="lchips">${rows.slice(0, cap).map(x => tlChip(x.k, x.r, x.shared)).join('')}${more > 0 ? `<button type="button" class="btn sm" data-tlall="${esc(tags.join(','))}" data-tlkind="${k}">+${more} more</button>` : ''}</div></div>`;
  }).join('');
}
// o.skip: a Set of 'kind:id' already shown somewhere else on the same screen
function tlBlock(k0, rec, o = {}) {
  const mine = tlTags(rec), rel = tlRelated(k0, rec).filter(x => !(o.skip && o.skip.has(x.k + ':' + x.r.id)));
  const head = `<div class="fh"><b>${ic('hash', 14)} Linked by tags</b>${rel.length ? `<span class="fcnt">${rel.length}</span>` : ''}${mine.length ? `<button type="button" class="btn sm" data-tlall="${esc(mine.join(','))}">See all</button>` : ''}</div>`;
  if (!mine.length) return `<div class="lnks tl-card">${head}<p class="hint">Give this a tag, like #anna, and every task, note, list, project, person and countdown with the same tag shows up here.</p></div>`;
  if (!rel.length) return `<div class="lnks tl-card">${head}<p class="hint">Nothing else has ${esc(mine.map(g => '#' + g).join(' '))} yet.</p></div>`;
  return `<div class="lnks tl-card">${head}${tlGroups(rel, mine)}</div>`;
}
// the same thing as a section of a person's profile (explicit links are listed above it, so they are not repeated)
function tlSection(k0, rec, skip) {
  const mine = tlTags(rec), rel = tlRelated(k0, rec).filter(x => !(skip && skip.has(x.k + ':' + x.r.id)));
  return `<section class="pe-s"><h4>${ic('hash', 15)} Linked by tags${rel.length ? `<span class="fcnt">${rel.length}</span>` : ''}${mine.length ? `<button type="button" class="btn sm" data-tlall="${esc(mine.join(','))}">See all</button>` : ''}</h4>`
    + (!mine.length ? '<p class="hint">Edit the contact and give them a tag, like #anna. Everything else with that tag appears here, so tasks, notes, lists and projects can be tied to a person by a tag alone.</p>' : !rel.length ? `<p class="hint">Nothing else has ${esc(mine.map(g => '#' + g).join(' '))} yet.</p>` : tlGroups(rel, mine)) + '</section>';
}

/* ---------- opening things ---------- */
function tlOpen(k, id) {
  if ($('#modal.on')) closeModal();
  if (k === 'task') openTaskById(id);
  else if (k === 'note') openNoteById(id);
  else if (k === 'list') setNav('list:' + id);
  else if (k === 'project') setNav('project:' + id);
  else if (k === 'contact') ctProfile(id);
  else if (k === 'countdown') { const c = cdById(id); if (c) { U.page = 'countdowns'; U.pinKey = null; U.sel = null; render(); cdForm(c); } }
}
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-tlk],[data-tlall]'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  if (t.dataset.tlk) tlOpen(t.dataset.tlk, t.dataset.tlid);
  else tlDlg(t.dataset.tlall.split(',').filter(Boolean), t.dataset.tlkind || '');
}, true);
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.tprop[data-tlall]')) { e.preventDefault(); e.target.click(); } });

/* ---------- Everything tagged #x ---------- */
function tlRowsHtml(items) {
  const meta = (k, r) => k === 'task' ? (r.due ? dueLabel(r) : listOf(r.listId).name) : k === 'note' ? (r.tags.length ? '' : '') : k === 'contact' ? (typeof ctSub === 'function' ? ctSub(r) : '') : k === 'countdown' ? (r.date ? fmtDate(r.date) : '') : (r.name ? '' : '');
  return items.map(({ k, r }) => `<button type="button" class="lprow tl-row${k === 'task' && r.status !== 'open' ? ' fin' : ''}" data-tlk="${k}" data-tlid="${esc(r.id)}"><span class="lpc">${tlIco(k, r)}</span><span class="lpt">${tlLabel(k, r)}</span><small>${esc(meta(k, r) || TL_KIND[k].one)}</small></button>`).join('');
}
function tlDlg(tags, kind) {
  tags = (tags || []).map(tlName).filter(Boolean); if (!tags.length) return;
  const st = { tag: tags[0], kind: TL_WORD[kind] || '' };
  const body = () => {
    const all = tlWith(st.tag), items = st.kind ? all.filter(x => x.k === st.kind) : all;
    const counts = TL_ORDER.map(k => [k, all.filter(x => x.k === k).length]).filter(x => x[1]);
    return `<div class="seg tl-seg" role="tablist"><button class="${st.kind ? '' : 'on'}" data-tlf="">All <span class="fcnt">${all.length}</span></button>${counts.map(([k, n]) => `<button class="${st.kind === k ? 'on' : ''}" data-tlf="${k}">${esc(TL_KIND[k].label)} <span class="fcnt">${n}</span></button>`).join('')}</div>`
      + `<div class="lplist tl-list">${items.length ? tlRowsHtml(items) : `<p class="hint">Nothing has #${esc(st.tag)} yet. Add it to a task, note, list, project, person or countdown.</p>`}</div>`
      + `<p class="hint">In a note, <code>![[tag:${esc(st.tag)}]]</code> shows this as a live list, and <code>{{tag:${esc(st.tag)}.count}}</code> shows how many.</p>`;
  };
  openModal(`<h3>${ic('hash', 18)} Everything tagged</h3>${tags.length > 1 ? `<div class="tl-tags" id="tl-tags"></div>` : ''}<div id="tl-body"></div><div class="mact"><button data-m="copy">Copy <code>![[tag:${esc(st.tag)}]]</code></button><span class="sp"></span><button class="pri" data-m="ok">Close</button></div>`, m => {
    const paint = () => {
      const tg = $('#tl-tags', m); if (tg) tg.innerHTML = tags.map(g => `<button type="button" class="tag${g === st.tag ? ' on' : ''}" data-tlt="${esc(g)}">#${esc(g)}</button>`).join('');
      $('#tl-body', m).innerHTML = body();
      const cp = $('[data-m=copy]', m); if (cp) cp.innerHTML = `Copy <code>![[tag:${esc(st.tag)}]]</code>`;
    };
    paint();
    m.onclick = async e => {
      const f = e.target.closest('[data-tlf]'); if (f) { st.kind = f.dataset.tlf; paint(); return; }
      const g = e.target.closest('[data-tlt]'); if (g) { st.tag = g.dataset.tlt; st.kind = ''; paint(); return; }
      const row = e.target.closest('[data-tlk]'); if (row) { tlOpen(row.dataset.tlk, row.dataset.tlid); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'ok') closeModal();
      else if (b.dataset.m === 'copy') { try { await navigator.clipboard.writeText(`![[tag:${st.tag}]]`); toast('Copied. Paste it into a note.'); } catch (x) { toast('Could not copy'); } }
    };
  }, 'wide');
}

/* ---------- inside notes: ![[tag:anna]] and {{tag:anna.count}} ---------- */
function tlRef(ref) { // 'anna' | '#anna' | 'anna.tasks' | 'anna.count' | 'anna.open'
  const m = String(ref).trim().match(/^#?([\p{L}\p{N}_-]{1,60})(?:\.([a-z]{3,10}))?$/iu); if (!m) return null;
  const what = (m[2] || '').toLowerCase();
  if (what && what !== 'count' && what !== 'open' && !TL_WORD[what]) return { bad: 'Unknown word after the tag: .' + what };
  return { tag: tlName(m[1]), what, kind: TL_WORD[what] || '' };
}
function tlEmbed(ref) {
  const r = tlRef(ref); if (!r || r.bad) return `<div class="embed emb-tag miss"><small>${esc(r ? r.bad : 'Not a tag reference: ' + ref)}</small></div>`;
  const items = tlWith(r.tag, r.kind ? [r.kind] : null), cap = 14, shown = items.slice(0, cap);
  const head = `<div class="emb-h">${ic('hash', 14)}<a class="wl" data-tlall="${esc(r.tag)}"${r.kind ? ` data-tlkind="${r.kind}"` : ''} role="button" tabindex="0">#${esc(r.tag)}${r.kind ? ' · ' + esc(TL_KIND[r.kind].label.toLowerCase()) : ''}</a><small>${items.length} ${items.length === 1 ? 'item' : 'items'}</small></div>`;
  return `<div class="embed emb-tag">${head}${shown.length ? `<div class="lplist tl-list">${tlRowsHtml(shown)}</div>` : `<p class="hint">Nothing has #${esc(r.tag)} yet.</p>`}${items.length > cap ? `<a class="wl tl-more" data-tlall="${esc(r.tag)}" role="button" tabindex="0">+${items.length - cap} more</a>` : ''}</div>`;
}
function tlProp(ref, noLinks) {
  const r = tlRef(ref); if (!r || r.bad) return `<span class="tprop miss" title="${esc(r ? r.bad : 'Not a tag reference')}">tag?</span>`;
  const items = tlWith(r.tag), n = !r.what ? null : r.what === 'count' ? items.length : r.what === 'open' ? items.filter(x => x.k === 'task' && x.r.status === 'open').length : items.filter(x => x.k === r.kind).length;
  const text = n == null ? '#' + r.tag : String(n);
  return noLinks ? `<span class="tprop">${esc(text)}</span>` : `<span class="tprop" data-tlall="${esc(r.tag)}" role="button" tabindex="0" title="Everything tagged #${esc(r.tag)}">${esc(text)}</span>`;
}
MD_TAG = { prop: tlProp, embed: tlEmbed };
// what a block's cached html depends on (so a tag card in the block editor follows the tag)
function tlSig(src) {
  if (!/(?:\{\{|!\[\[)tag:/.test(src)) return '';
  let s = ''; for (const m of src.matchAll(/(?:\{\{|!\[\[)tag:([^}\]\n|]{1,100})/g)) { const r = tlRef(m[1].replace(/\s+$/, '')); s += r && !r.bad ? tlWith(r.tag).map(x => x.k + x.r.id + (x.r.status || '') + tlPlain(x.k, x.r)).join('~') : '-'; }
  return s;
}

/* ---------- the picker: pick a tag, what to show of it ---------- */
const TL_HELP = '![[tag:anna]]  a live list of everything with the tag #anna\n![[tag:anna.tasks]]  only its tasks (also .notes .lists .projects .people .countdowns)\n{{tag:anna.count}}  how many things have it (also .open for open tasks, .tasks .notes ...)\n{{tag:anna}}  the tag itself, as a link to everything with it';
function tagRefPick(done) {
  const tags = tlAllTags(), st = { tag: '', as: 'embed', kind: '' };
  const row = ([g, n]) => `<button type="button" class="lprow" data-tg="${esc(g)}"><span class="lpc">${ic('hash', 14)}</span><span class="lpt">#${esc(g)}</span><small>${n} ${n === 1 ? 'item' : 'items'}</small></button>`;
  const list = q => { q = tlName(q); return tags.filter(([g]) => !q || g.includes(q)).slice(0, 80).map(row).join('') || '<p class="hint">No tag like that yet. Type a new one below to use it anyway.</p>'; };
  const text = () => st.as === 'embed' ? `![[tag:${st.tag}${st.kind ? '.' + TL_KIND[st.kind].key : ''}]]` : `{{tag:${st.tag}${st.as === 'link' ? '' : '.' + (st.as === 'open' ? 'open' : st.kind ? TL_KIND[st.kind].key : 'count')}}}`;
  const stage2 = () => `<p class="hint"><b>#${esc(st.tag)}</b></p>`
    + `<div class="seg" role="tablist"><button class="${st.as === 'embed' ? 'on' : ''}" data-tgas="embed">List</button><button class="${st.as === 'count' ? 'on' : ''}" data-tgas="count">A number</button><button class="${st.as === 'open' ? 'on' : ''}" data-tgas="open">Open tasks</button><button class="${st.as === 'link' ? 'on' : ''}" data-tgas="link">Tag link</button></div>`
    + (st.as === 'embed' || st.as === 'count' ? `<label class="fld">Of<select data-tgk="kind">${[['', 'Everything'], ...TL_ORDER.map(k => [k, TL_KIND[k].label])].map(([v, l]) => `<option value="${v}"${st.kind === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : '')
    + `<p class="hint">Preview</p><div class="md tp-pv">${md(text())}</div><code class="tp-src">${esc(text())}</code>`;
  openModal(`<h3>Insert a tag</h3><div id="tg-1"><input id="tg-q" placeholder="Search tags, or type a new one" autocomplete="off"><div class="lplist" id="tg-l">${list('')}</div></div><div id="tg-2" hidden></div><div class="mact"><button data-m="back" id="tg-back" hidden>Back</button><span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok" id="tg-ok" disabled>Insert</button></div>`, m => {
    const q = $('#tg-q', m), p1 = $('#tg-1', m), p2 = $('#tg-2', m), ok = $('#tg-ok', m), back = $('#tg-back', m);
    if (!narrow(820)) q.focus();
    const go = g => { st.tag = tlName(g); if (!st.tag) return; p1.hidden = true; p2.hidden = false; back.hidden = false; ok.disabled = false; p2.innerHTML = stage2(); };
    m.oninput = e => { if (e.target.id === 'tg-q') $('#tg-l', m).innerHTML = list(q.value); };
    m.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'tg-q') { e.preventDefault(); const first = $('#tg-l [data-tg]', m); go(first ? first.dataset.tg : q.value); } };
    m.onchange = e => { if (e.target.dataset.tgk) { st.kind = e.target.value; p2.innerHTML = stage2(); } };
    m.onclick = e => {
      const r = e.target.closest('[data-tg]'); if (r) { go(r.dataset.tg); return; }
      const as = e.target.closest('[data-tgas]'); if (as) { st.as = as.dataset.tgas; p2.innerHTML = stage2(); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') closeModal();
      else if (b.dataset.m === 'back') { p1.hidden = false; p2.hidden = true; back.hidden = true; ok.disabled = true; st.tag = ''; }
      else if (b.dataset.m === 'ok' && st.tag) { const t = text(), embed = st.as === 'embed'; closeModal(); done(t, embed); }
    };
  }, 'wide');
}
// toolbar / menu: put the reference into a textarea at the caret (a list goes on a line of its own)
function tagRefInsert(ta) {
  tagRefPick((text, embed) => {
    if (!ta || !document.body.contains(ta)) { toast('Nowhere to insert it'); return; }
    const v = ta.value, a = ta.selectionStart == null ? v.length : ta.selectionStart, b = ta.selectionEnd == null ? a : ta.selectionEnd;
    const pre = embed && a > 0 && v[a - 1] !== '\n' ? '\n' : '', post = embed ? '\n' : '', ins = pre + text + post;
    ta.value = v.slice(0, a) + ins + v.slice(b); const at = a + ins.length; ta.focus(); ta.setSelectionRange(at, at);
    ta.dispatchEvent(typeof InputEvent === 'function' ? new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }) : new Event('input', { bubbles: true }));
  });
}

// the line under a list's / project's tags field: how much is linked to it already
function tlFormHint(rec) {
  const mine = tlTags(rec), k = rec.listIds ? 'project' : 'list', n = tlRelated(k, rec).length;
  return mine.length && n ? `<p class="hint">${n} other ${n === 1 ? 'thing shares' : 'things share'} these tags. <button type="button" class="btn sm" data-tlall="${esc(mine.join(','))}">See them</button></p>` : '<p class="hint">Everything with the same tag is linked to this: tasks, notes, people, projects and lists.</p>';
}
