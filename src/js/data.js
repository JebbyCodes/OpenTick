/* OpenTick data: deleting everything, and imports that replace what is there.
   Both go through one confirmation dialog and one function (wipeAll). Before anything is deleted a restore point is written
   (a tagged automatic backup the daily copy cannot overwrite), and the toast that follows offers Undo. */

// what a person would call their data, counted the way they see it (no Inbox, no trash, no finished repeats)
function dataCounts() {
  const t = S.tasks.filter(x => !x.deleted && !x.log).length;
  return { tasks: t, lists: S.lists.filter(l => l.id !== 'inbox').length, notes: S.notes.length, templates: (S.templates || []).length, habits: S.habits.length, projects: S.projects.length, slots: S.slots.length, school: S.school.filter(r => r.k !== 'cfg' && r.k !== 'period').length, classes: S.school.filter(r => r.k === 'subject').length, lessons: S.school.filter(r => r.k === 'lesson').length,
    files: [...S.tasks, ...S.notes, ...S.slots].reduce((n, o) => n + ((o.files || []).length), 0) };
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function dataCountsText(c = dataCounts()) {
  const out = [];
  if (c.tasks) out.push(plural(c.tasks, 'task')); if (c.lists) out.push(plural(c.lists, 'list')); if (c.projects) out.push(plural(c.projects, 'project'));
  if (c.notes) out.push(plural(c.notes, 'note')); if (c.templates) out.push(plural(c.templates, 'template')); if (c.habits) out.push(plural(c.habits, 'habit')); if (c.slots) out.push(plural(c.slots, 'timetable slot')); if (c.classes) out.push(`${c.classes} class${c.classes === 1 ? '' : 'es'}`); if (c.lessons) out.push(plural(c.lessons, 'lesson'));
  { const rest = (c.school || 0) - (c.classes || 0) - (c.lessons || 0); if (rest > 0) out.push(plural(rest, 'other class item')); } if (c.files) out.push(plural(c.files, 'attached file'));
  return out.length ? out.join(', ') : 'nothing yet';
}
// the bytes of attachments live in IndexedDB; this drops every one of them
async function filesWipe() {
  try {
    const keys = (await idb('readonly', s => s.getAllKeys())) || [];
    for (const k of keys) if (/^file:/.test(k)) await idb('readwrite', s => s.delete(k));
    if (typeof FILE_URL !== 'undefined') { for (const u of FILE_URL.values()) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } } FILE_URL.clear(); }
  } catch (e) { /* storage is optional */ }
}
const EMPTY_DATA = () => ({ v: 1, tasks: [], lists: [], habits: [], tags: [], slots: [], notes: [], projects: [], school: [], pomo: [], templates: [] });
// Delete everything: tasks, lists, projects, notes, habits, timetable, tags, focus log and history. Sync sees it as a deliberate deletion.
//   o.settings  also reset the settings (theme, layout, sounds)       o.files  also delete the attachments' bytes (default yes)
// Resolves to the key of the restore point (or '' when none could be written).
async function wipeAll(o = {}) {
  let key = ''; try { key = (await snapSave(true, 'before-delete')) || ''; } catch (e) { key = ''; }
  const d = EMPTY_DATA(); if (!o.settings) d.settings = S.settings;
  S.history = [];
  replaceAll(d);
  if (o.files !== false) await filesWipe();
  S.fired = {}; histNote('delete', 'Everything was deleted'); save(); flush();
  U.nav = 'today'; U.page = 'tasks'; U.sel = null; U.noteSel = null; U.q = ''; U.tagSel = []; U.bsel = null;
  if (typeof applyTheme === 'function') applyTheme();
  return key;
}

/* ---------- the confirmation dialog ----------
   askWipe({ title, lead, ok, typed, settings }) -> null (cancelled) or { settings, files }.
   typed: the button stays off until DELETE is typed. */
function askWipe(o = {}) {
  const c = dataCounts();
  return new Promise(res => {
    const done = v => { closeModal(); res(v); };
    openModal(`<h3 class="wipe-h">${ic('alert', 20)} ${esc(o.title || 'Delete everything?')}</h3>
<p>${o.lead || 'This permanently deletes everything on this device.'}</p>
<div class="wipe-now"><small>Right now you have</small><b>${esc(dataCountsText(c))}</b></div>
${Sync.on ? `<p class="wipe-warn">${ic('cloud', 14)} Sync is on, so this deletion will be sent to your other devices too.</p>` : ''}
<div class="wipe-opts">${c.files ? '<label class="chkl"><input type="checkbox" data-w="files" checked> Also remove the attached files from this device</label>' : ''}${o.settings ? '<label class="chkl"><input type="checkbox" data-w="settings"> Also reset the settings (theme, layout, sounds)</label>' : ''}</div>
<p class="hint">A restore point is saved first: <b>Settings → Automatic backups</b>, or tap Undo straight afterwards.</p>
${o.typed ? '<label class="wipe-type"><span>Type <b>DELETE</b> to confirm</span><input id="wipe-t" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DELETE"></label>' : ''}
<div class="mact"><button data-m="no" autofocus>Cancel</button><button class="danger" data-m="ok"${o.typed ? ' disabled' : ''}>${esc(o.ok || 'Delete everything')}</button></div>`, m => {
      const ok = $('[data-m=ok]', m), t = $('#wipe-t', m), no = $('[data-m=no]', m); if (no && no.focus) no.focus();
      const read = () => ({ settings: !!(($('[data-w=settings]', m) || {}).checked), files: !$('[data-w=files]', m) || $('[data-w=files]', m).checked });
      if (t) t.oninput = () => { ok.disabled = t.value.trim().toUpperCase() !== 'DELETE'; };
      m.onclick = e => { const b = e.target.closest('[data-m]'); if (b) { if (b.dataset.m === 'ok' && !b.disabled) done(read()); else if (b.dataset.m === 'no') done(null); } else if (e.target.classList.contains('mback')) done(null); };
    }, 'wipe');
  });
}
const afterWipe = (key, what) => { sfx('trash'); refresh(); toast(what, key ? { label: 'Undo', fn: async () => { try { await snapRestore(key); U.nav = 'today'; U.page = 'tasks'; render(); toast('Restored'); } catch (e) { toast('Could not undo: ' + (e.message || e)); } } } : undefined); };
async function deleteEverything() {
  const o = await askWipe({ title: 'Delete everything?', lead: 'Every task, list, project, note, habit and timetable slot is deleted from this device. This cannot be undone once the restore point expires.', ok: 'Delete everything', typed: true, settings: true });
  if (!o) return false;
  const key = await wipeAll(o); afterWipe(key, 'Everything was deleted'); return true;
}

/* ---------- importing a backup: merge or replace ---------- */
// merge: records from the file are combined with yours (the more recently edited copy of the same item wins); nothing is deleted
function backupMerge(d) {
  const before = dataCounts(); applyMerged(mergeData(snapshot(), d)); save(); flush();
  const after = dataCounts(); return { tasks: Math.max(0, after.tasks - before.tasks), notes: Math.max(0, after.notes - before.notes) };
}
// a backup file's text -> the data (null when the person cancels the passphrase). An encrypted backup is opened with this vault's key, or the passphrase / recovery key typed for it.
async function backupParse(txt) {
  let d; try { d = JSON.parse(txt); } catch (e) { throw new Error('not an OpenTick backup'); }
  if (d && d.app === 'opentick' && d.enc) {
    if (!vIsEnv(d)) throw new Error('this encrypted backup is damaged');
    if (!vaultAvail()) throw new Error('this backup is encrypted, and this browser cannot decrypt it (that needs https)');
    const plain = await vaultOpenFile(d, 'backup'); if (plain == null) return null;
    d = JSON.parse(plain);
  }
  return d;
}
async function importData() {
  try {
    const txt = await pickText(); if (!txt) return;
    const d = await backupParse(txt); if (d === null) return;
    if (d) delete d._app;
    if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.lists)) throw new Error('not an OpenTick backup');
    const n = d.tasks.filter(t => !t.deleted && !t.log).length, nn = (d.notes || []).length;
    const how = await new Promise(res => {
      const done = v => { closeModal(); res(v); };
      openModal(`<h3>Import this backup</h3><p>The file has <b>${plural(n, 'task')}</b>${nn ? ` and <b>${plural(nn, 'note')}</b>` : ''}. You have <b>${esc(dataCountsText())}</b> now.</p>
<div class="imp-how2" role="radiogroup"><label class="opt on"><input type="radio" name="bk" value="merge" checked><span><b>Merge into what I have</b><small>Adds what is new. If an item is in both, the copy edited most recently wins. Nothing is deleted.</small></span></label>
<label class="opt rep"><input type="radio" name="bk" value="replace"><span><b>Replace everything</b><small>Deletes everything first, then imports the file, so you end up with exactly its contents.</small></span></label></div>
<div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="ok">Merge</button></div>`, m => {
        const ok = $('[data-m=ok]', m), sel = () => ($('input[name=bk]:checked', m) || {}).value || 'merge';
        m.onchange = e => { if (e.target.name !== 'bk') return; $$('.opt', m).forEach(l => l.classList.toggle('on', l.contains(e.target))); const r = sel() === 'replace'; ok.textContent = r ? 'Replace everything…' : 'Merge'; ok.classList.toggle('danger', r); ok.classList.toggle('pri', !r); };
        m.onclick = e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === 'ok' ? sel() : null); else if (e.target.classList.contains('mback')) done(null); };
      });
    });
    if (!how) return;
    if (how === 'merge') { const r = backupMerge(d); histNote('import', `Backup merged (${r.tasks} new tasks)`); save(); applyTheme(); sfx('done'); refresh(); toast(`Merged: ${plural(r.tasks, 'new task')}${r.notes ? `, ${plural(r.notes, 'new note')}` : ''}`); return; }
    const o = await askWipe({ title: 'Replace everything with this backup?', lead: `Everything you have is deleted first, then the backup (${esc(plural(n, 'task'))}) is imported.`, ok: 'Replace everything' });
    if (!o) return;
    const key = await wipeAll({ settings: false, files: o.files });
    replaceAll(d); histNote('import', `Backup imported (${n} tasks)`); save(); applyTheme(); U.nav = 'today'; U.page = 'tasks'; U.sel = null; render(); afterWipe(key, `Replaced with the backup (${plural(n, 'task')})`);
  } catch (e) { toast('Import failed: ' + (e.message || e)); }
}
