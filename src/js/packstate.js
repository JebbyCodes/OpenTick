/* OpenTick installed packs (0.9.1): what a pack IS on this account, as opposed to the sections and entries it made.
   Until 0.9.1 a pack left nothing behind but its sections (they carry `packId`), and the "Installed" mark of a library pack was a note on the device that
   installed it. Now every pack has one synced record (S.packs, sealed with everything else, merged by COLL_MERGE.packs below):
     { id 'pk-<packId>', packId, name, version, format (the pack format it needs), source { kind 'library' | 'file', code, sha256, size },
       state 'installed' | 'disabled' | 'removed' (worked out from the three registers below, never chosen directly), stateAt, stateDev,
       on 'installed' | 'disabled' + onAt   switched on / off: the later choice wins (tie: off)
       rm, ri                               when it was last removed / last deliberately added (again): each only ever grows; removed means rm > ri
       config {} (pack-wide choices; small), sectionIds [], themes [names], installedAt, dev (the device that installed it), u }
   The DEFINITION of a pack (its sections, fields, templates, view / sort / group choices) and its data are already synced as sections and entries, so another
   device needs no download to have the pack: it arrives with the data, sealed, and this record says which pack it belongs to, what version, and what the
   person decided about it. The library's sha256 and code are kept as provenance (and for update checks); nothing is fetched to "activate" it.
   The three states are different things, on purpose (spec §27):
     disabled   the pack's sections are put away (not in the sidebar, search or pages); nothing is deleted; enabling brings them back
     removed    the pack is no longer installed: its features stop, its sections and entries STAY as ordinary sections of the person (never deleted for them)
                and the record stays, so a removed pack is not quietly brought back by another device (see the merge rule) or by an install without asking
     (data)     deleting a pack's sections and entries is a separate, explicit choice ("Remove and delete its data") with a restore point
   Merge: switching on / off is decided by the later choice; a REMOVAL beats any switching done on another device, and only a deliberate "add it again"
   (ri later than rm) undoes it, so a device that has not heard of the removal cannot bring the pack back by switching it on. Everything else follows the
   newest edit, except that sectionIds only ever grow. A device that is not able to read the pack's format says so and keeps the data untouched.
   Every function here that migrate() reaches while core.js is still loading uses only function declarations and literals (no top-level const of this file). */
function pksNormalise(r) {
  if (!r || typeof r !== 'object') return null;
  const packId = typeof r.packId === 'string' && /^[a-z0-9-]{1,40}$/.test(r.packId) ? r.packId : ''; if (!packId) return null;
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n), src = r.source && typeof r.source === 'object' ? r.source : {};
  r.id = 'pk-' + packId; r.packId = packId; r.name = str(r.name, 60) || packId; r.version = str(r.version, 20);
  r.format = Number.isInteger(r.format) && r.format >= 1 && r.format < 100 ? r.format : 1;
  r.source = { kind: src.kind === 'library' ? 'library' : 'file', code: str(src.code, 20), sha256: /^[0-9a-f]{64}$/.test(src.sha256 || '') ? src.sha256 : '', size: Number.isFinite(src.size) && src.size >= 0 ? Math.round(src.size) : 0 };
  const t = v => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  r.on = r.on === 'disabled' || (r.on == null && r.state === 'disabled') ? 'disabled' : 'installed'; r.onAt = t(r.onAt); r.rm = t(r.rm) || (r.rm == null && r.state === 'removed' ? t(r.stateAt) || 1 : 0); r.ri = t(r.ri);
  r.state = r.rm > r.ri ? 'removed' : r.on; r.stateAt = Math.max(r.onAt, r.rm, r.ri); r.stateDev = str(r.stateDev, 60);
  r.config = r.config && typeof r.config === 'object' && !Array.isArray(r.config) && JSON.stringify(r.config).length <= 4000 ? r.config : {};
  r.sectionIds = [...new Set((Array.isArray(r.sectionIds) ? r.sectionIds : []).filter(x => typeof x === 'string' && x.length <= 60))].sort().slice(0, 60);
  r.themes = [...new Set((Array.isArray(r.themes) ? r.themes : []).map(x => str(x, 40)).filter(Boolean))].slice(0, 12);
  r.installedAt = Number.isFinite(r.installedAt) ? r.installedAt : 0; r.dev = str(r.dev, 60);
  r.perms = pkpNormManifest(r.perms); if (!r.perms) delete r.perms; // what the pack asked for, kept so every device can show it (packperm.js)
  return r;
}
// migrate() hook (core.js): the 0.9.1 collections are cleaned here, and pack records that are not valid are dropped
function pkMigrate(r) {
  const seen = {}; r.packs = (Array.isArray(r.packs) ? r.packs : []).map(pksNormalise).filter(x => x && !seen[x.id] && (seen[x.id] = 1));
  const sp = {}; r.pkperms = (Array.isArray(r.pkperms) ? r.pkperms : []).map(pkpNormalise).filter(x => x && !sp[x.id] && (sp[x.id] = 1)); // (packperm.js)
  r.pkact = pkpCleanAct(r.pkact);
  const sr = {}; r.pkrem = (Array.isArray(r.pkrem) ? r.pkrem : []).map(pkrNormalise).filter(x => x && !sr[x.id] && (sr[x.id] = 1)); // (packrem.js)
}
const pksRec = packId => (S.packs || []).find(r => r.packId === packId) || null;
const pksState = packId => (pksRec(packId) || {}).state || '';
// a section of a disabled pack is put away: not in the sidebar, the tab bar, pages or search
const pksHidden = s => !!(s && s.packId) && pksState(s.packId) === 'disabled';
const pksSections = packId => S.csections.filter(s => s.packId === packId);

// two copies of one pack record: on / off by the later choice, removal beats switching (only a later deliberate add undoes it), sections only ever grow
COLL_MERGE.packs = (x, y, w) => {
  const ox = x.onAt || 0, oy = y.onAt || 0, o = ox !== oy ? (ox > oy ? x : y) : x.on === 'disabled' ? x : y, last = [x, y].sort((a, b) => (b.stateAt || 0) - (a.stateAt || 0) || (a.stateDev < b.stateDev ? -1 : 1))[0];
  const m = pksNormalise({ ...w, on: o.on, onAt: o.onAt || 0, rm: Math.max(x.rm || 0, y.rm || 0), ri: Math.max(x.ri || 0, y.ri || 0), stateDev: last.stateDev || '',
    sectionIds: [...(x.sectionIds || []), ...(y.sectionIds || [])], themes: [...(x.themes || []), ...(y.themes || [])],
    installedAt: (ia => (ia.length ? Math.min(...ia) : 0))([x.installedAt, y.installedAt].filter(n => n > 0)) });
  m.u = w.u; if (prefCanon({ ...m, u: 0 }) !== prefCanon({ ...w, u: 0 })) m.u = Math.max(x.u || 0, y.u || 0) + 1; // differs from the winner → must propagate
  return m;
};
// sections made by a pack before 0.9.1 (or that arrived before their pack's record) get a record: the same content on every device, so two devices agree
function pksAdopt() {
  const by = {}; for (const s of S.csections) if (s.packId) (by[s.packId] = by[s.packId] || []).push(s);
  for (const packId of Object.keys(by)) {
    if (S.packs.some(r => r.packId === packId)) continue;
    const list = by[packId].sort((a, b) => (a.created || 0) - (b.created || 0) || (a.id < b.id ? -1 : 1)), first = list[0];
    const r = pksNormalise({ packId, name: first.pack || packId, version: first.packVer || '', on: 'installed', onAt: 0, rm: 0, ri: 0, sectionIds: list.map(s => s.id), installedAt: first.created || 0, source: { kind: 'file' } });
    if (r) S.packs.push(r);
  }
}
// installing: one record per pack id (installing the same pack again adds to it, and brings a removed or disabled pack back because the person asked for it)
function pksRecordInstall(pack, made, src = {}) {
  const now = Date.now(), dev = actDev(), id = 'pk-' + pack.id, need = typeof packFormatNeeded === 'function' ? packFormatNeeded(pack) : 1;
  let r = S.packs.find(x => x.id === id);
  const fresh = { packId: pack.id, name: pack.name, version: pack.version, format: need, source: { kind: src.kind === 'library' ? 'library' : 'file', code: src.code || '', sha256: src.sha256 || '', size: src.size || 0 }, themes: pack.themes.map(t => t.name), perms: pack.permissions || null };
  if (!r) { r = pksNormalise({ ...fresh, on: 'installed', onAt: now, rm: 0, ri: now, stateDev: dev, sectionIds: made.map(s => s.id), installedAt: now, dev }); S.packs.push(r); return r; }
  Object.assign(r, fresh, { sectionIds: [...r.sectionIds, ...made.map(s => s.id)], themes: [...r.themes, ...fresh.themes], on: 'installed', onAt: Math.max(now, r.onAt + 1), ri: Math.max(now, r.rm + 1, r.ri + 1), stateDev: dev });
  return pksNormalise(r); // (adding a pack on purpose also brings back one that was removed or switched off)
}
function pksSetState(packId, state) {
  const r = pksRec(packId); if (!r || !['installed', 'disabled', 'removed'].includes(state) || r.state === state) return false;
  const now = Date.now();
  if (state === 'removed') r.rm = Math.max(now, r.rm + 1, r.ri + 1);
  else { if (r.state === 'removed') r.ri = Math.max(now, r.rm + 1); r.on = state; r.onAt = Math.max(now, r.onAt + 1); } // "add it back" is a deliberate add (ri); switching is not
  r.stateDev = actDev(); pksNormalise(r); save(); return true;
}
// removing never deletes what the person made; `deleteData` is the separate, explicit choice
async function pksRemove(packId, deleteData) {
  const r = pksRec(packId); if (!r) return false;
  let key = ''; if (deleteData) { try { key = (await snapSave(true, 'before-pack-delete')) || ''; } catch (e) { key = ''; } }
  pksSetState(packId, 'removed');
  if (typeof pkpRevokeAll === 'function' && pkpRevokeAll(packId)) pkAudit({ packId, op: 'revoke-all', ok: true, cap: '' }); // what it was allowed to do ends with it: adding it again asks again
  if (deleteData) { const ids = new Set(pksSections(packId).map(s => s.id)); S.centries = S.centries.filter(e => !ids.has(e.sid)); S.csections = S.csections.filter(s => !ids.has(s.id)); if (ids.has(U.page)) U.page = 'tasks'; save(); flush(); }
  return key || true;
}
const pksNeedsNewer = r => r.format > (typeof PACK_FORMAT !== 'undefined' ? PACK_FORMAT : 1);
const pksWhen = t => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/* ---------- Settings: the installed packs ---------- */
function pksSettingsHtml() {
  const rows = S.packs.slice().sort((a, b) => a.name.localeCompare(b.name)).map(r => {
    const secs = pksSections(r.packId), n = secs.reduce((t, s) => t + xsEntries(s).length, 0), here = r.dev && r.dev === actDev();
    const badge = r.state === 'installed' ? '' : `<span class="pks-b ${r.state}">${r.state === 'disabled' ? 'Switched off' : 'Removed'}</span>`;
    const note = [r.version ? 'v' + esc(r.version) : '', plural(secs.length, 'section'), plural(n, 'entry').replace('entrys', 'entries'), r.source.kind === 'library' && r.source.code ? 'library code ' + esc(r.source.code) : 'from a file', r.dev ? (here ? 'added on this device' : 'added on another of your devices') : ''].filter(Boolean).join(' · ');
    const warn = pksNeedsNewer(r) ? `<small class="pks-w">${ic('alert', 12)} This pack needs a newer OpenTick than this one. Its sections and entries are kept exactly as they are and still sync; update OpenTick to use it.</small>` : '';
    const stateNote = r.state === 'removed' ? `<small>Removed${r.stateAt ? ' on ' + esc(pksWhen(r.stateAt)) : ''}. ${secs.length ? 'Its sections and entries are still yours.' : 'It has no sections here.'}</small>` : '';
    const acts = r.state === 'removed' ? (secs.length ? `<button type="button" class="btn sm" data-m="pksre" data-id="${esc(r.packId)}">Add it back</button>` : '') + `<button type="button" class="btn sm" data-m="pksdrop" data-id="${esc(r.packId)}" title="Forget that this pack was removed (so it can be added again without asking)">Forget</button>`
      : `<button type="button" class="btn sm" data-m="${r.state === 'disabled' ? 'pksen' : 'pksdis'}" data-id="${esc(r.packId)}">${r.state === 'disabled' ? 'Switch on' : 'Switch off'}</button>` + (typeof pkpPermBtn === 'function' ? pkpPermBtn(r.packId) : '') + (typeof pkrSettingsBtn === 'function' ? pkrSettingsBtn(r.packId) : '') + `<button type="button" class="btn sm danger" data-m="pksrm" data-id="${esc(r.packId)}">Remove…</button>`;
    return `<div class="pk-r pks-r ${r.state}"><span class="pk-ic">${ic('package', 18)}</span><span class="pk-n"><b>${esc(r.name)}</b>${badge}<small>${note}</small>${stateNote}${warn}</span>${acts}</div>`;
  }).join('');
  return `<h4 class="mh">Installed packs</h4>${typeof pkpSettingsNote === 'function' ? pkpSettingsNote() : ''}<p class="hint">What a pack is on your account. It is shared, sealed, between your devices: a pack you add here appears on your other devices with its sections and entries, and switching it off or removing it applies everywhere. <b>Removing a pack never deletes your sections or entries</b>; deleting those is a separate choice.</p>`
    + (rows ? `<div class="pk-rows">${rows}</div>` : '<p class="hint">No pack is installed. Packs you add from the library, a file or a code are listed here.</p>');
}
function pksAct(a, b, m, back) {
  const id = b && b.dataset ? b.dataset.id : '', r = pksRec(id);
  if (a === 'pksdis' || a === 'pksen') { if (r) { pksSetState(id, a === 'pksdis' ? 'disabled' : 'installed'); if (a === 'pksdis' && pksSections(id).some(s => s.id === U.page)) U.page = 'tasks'; render(); toast(a === 'pksdis' ? `${r.name} is switched off. Nothing was deleted.` : `${r.name} is switched on.`); } back(); return true; }
  if (a === 'pkrset') { pkrManager(id, back); return true; }
  if (a === 'pksre') { if (r) { pksSetState(id, 'installed'); render(); toast(`${r.name} is installed again.`); } back(); return true; }
  if (a === 'pksdrop') { if (r) { const i = S.packs.indexOf(r); S.packs.splice(i, 1); save(); } back(); return true; }
  if (a === 'pksrm' && r) {
    const secs = pksSections(id), n = secs.reduce((t, s) => t + xsEntries(s).length, 0);
    openModal(`<h3>Remove ${esc(r.name)}?</h3><p>The pack stops being installed on all your devices. <b>Your ${esc(plural(secs.length, 'section'))} and ${esc(plural(n, 'entry').replace('entrys', 'entries'))} stay</b> as ordinary sections, so nothing you wrote is lost.</p><p class="hint">Tasks, notes and other things a pack created for you are yours too and are never touched.</p>`
      + `<div class="mact"><button type="button" data-m="no">Cancel</button><span class="sp"></span><button type="button" class="btn danger" data-m="del">Remove and delete its data…</button><button type="button" class="pri" data-m="keep">Remove, keep my data</button></div>`, mm => {
      mm.onclick = async e => {
        const x = e.target.closest('[data-m]'); if (!x) { if (e.target.classList.contains('mback')) { closeModal(); back(); } return; }
        if (x.dataset.m === 'keep') { closeModal(); await pksRemove(id, false); render(); toast(`${r.name} was removed. Your data is still here.`); back(); }
        else if (x.dataset.m === 'del') { closeModal(); if (await askConfirm(`Delete ${plural(secs.length, 'section')} and ${plural(n, 'entry').replace('entrys', 'entries')} that came from ${r.name}? A restore point is made first.`, 'Delete them')) { const key = await pksRemove(id, true); render(); toast(`${r.name} and its data were deleted`, typeof key === 'string' && key ? { label: 'Undo', fn: async () => { try { await snapRestore(key); render(); } catch (e2) { toast('Could not undo: ' + (e2.message || e2)); } } } : undefined); } back(); }
        else { closeModal(); back(); }
      };
    });
    return true;
  }
  return false;
}
// "this pack was removed": install it again only when the person says so
async function pksConfirmReinstall(pack) {
  const r = pksRec(pack.id); if (!r || r.state !== 'removed') return true;
  return askConfirm(`You removed ${pack.name} on ${pksWhen(r.stateAt) || 'an earlier day'}. Add it again?`, 'Add it again');
}
