// Pack permissions (0.9.1): granular capabilities, enforced inside the app, deny by default, never widened by a merge, audited, undoable, synced and sealed.
// The API calls below are the ones the declared actions of a pack use (src/js/packapi.js); there is no other way for a pack to reach the rest of the app.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB, clock } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const PASS = 'correct horse battery staple', FILE = '/dav/OpenTick/opentick.json', srv = await davServer();
const dev = (folder = 'OpenTick') => { const a = makeApp({ store: {}, indexedDB: fakeIndexedDB() }); Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder, user: 'me', pass: 'secret' } }); return a; };
const sync = async (...ds) => { for (const d of ds) { await d.syncNow(true); assert.equal(d.Sync.state, 'ok', d.Sync.msg); } };
const J = o => JSON.parse(JSON.stringify(o)), q = JSON.stringify, wait = ms => { clock.t += ms; };
const run = (d, code) => J(d.__run(code));
const api = (d, pk, m, ...a) => run(d, `pkApi(${q(pk)}).${m}(...${q(a)})`);
const grant = (d, pk, key, scope = {}) => d.__run(`pkpGrant(${q(pk)}, ${q(key)}, ${q(scope)}, '1.0.0')`);
const st = (d, pk, key) => d.__run(`pkpState(pkpCap(${q(pk)}, ${q(key)}))`);

const PACK = { opentick: 'pack', format: 2, id: 'rt', name: 'Reading tracker', version: '1.0.0',
  permissions: { sections: [
    { id: 'tasks', reason: 'Create and associate reading-related tasks.', capabilities: [
      { id: 'search_records', scope: { fields: ['title'] }, reason: 'To find a task that already exists for a book' }, { id: 'view_record_summary', scope: { fields: ['title', 'status', 'due-date'] } },
      { id: 'create_record', required: true }, { id: 'complete_record', scope: { records: 'pack-linked' } }, { id: 'link_records' }, { id: 'view_relationships' }, { id: 'delete_own_records' }] },
    { id: 'notes', reason: 'Create linked notes.', capabilities: [{ id: 'create_record' }, { id: 'link_records' }] }] },
  sections: [{ name: 'Books', fields: [{ key: 'author', name: 'Author', type: 'text' }, { key: 'finish', name: 'Finish by', type: 'date' }], entries: [{ title: 'Dune', vals: { author: 'Herbert', finish: '2026-12-01' } }],
    actions: [{ id: 'mk-task', name: 'Create reading task', op: 'create_task', map: { title: 'Read {title} by {author}', due: '{finish}' }, link: true }, { id: 'done', name: 'Mark linked tasks done', op: 'complete_linked' }, { id: 'find', name: 'Link a task', op: 'link_task' }, { id: 'mk-note', name: 'Create note', op: 'create_note', map: { title: 'Notes on {title}' }, link: true }],
    related: [{ target: 'tasks', fields: ['title', 'status', 'due-date'], title: 'Reading tasks' }] }] };

/* ---------- 1. manifests: validated, unsupported things are refused out loud ---------- */
const A = dev(), B = dev();
const parsed = A.packParse(JSON.stringify(PACK)); assert.deepEqual(J(parsed.warnings), [], 'a valid manifest raises no warnings');
const pack = J(parsed.pack); assert.equal(pack.permissions.sections[0].capabilities.find(c => c.id === 'search_records').scope.fields[0], 'title');
assert.equal(pack.permissions.sections[0].capabilities.find(c => c.id === 'create_record').required, true); assert.equal(pack.permissions.sections[0].capabilities.find(c => c.id === 'link_records').required, false, 'optional unless the pack says required');
assert.equal(A.__run('packFormatNeeded(' + q(pack) + ')'), 2, 'a pack that uses permissions needs format 2'); assert.equal(pack.sections[0].actions.length, 4); assert.equal(pack.sections[0].related.length, 1);
const bad = A.packParse(JSON.stringify({ ...PACK, id: 'bad', permissions: { sections: [
  { id: 'vault', capabilities: [{ id: 'read_everything' }] }, { id: 'contacts', capabilities: [{ id: 'list_records' }] },
  { id: 'tasks', capabilities: [{ id: 'read_all' }, { id: 'search_records', scope: { fields: ['notes', 'title'], mystery: 1 } }, { id: 'view_record_summary', scope: { fields: ['secret'] } }, { id: 'complete_record', scope: { records: 'user-selected' } }, { id: 'create_record', scope: { fields: ['x'] } }] },
  { id: 'pack:other', capabilities: [{ id: 'search_records' }, { id: 'create_record' }] }] } }));
const w = J(bad.warnings).join(' | '), caps = J(bad.pack.permissions.sections.flatMap(s => s.capabilities.map(c => s.id + '.' + c.id)));
assert.ok(/vault/.test(w) && /contacts/.test(w), 'a target that does not exist (the keys, the contacts) is refused with a warning: ' + w); assert.ok(/read_all/.test(w), 'so is a capability that does not exist');
assert.ok(/notes/.test(w) && /mystery/.test(w), 'a field that cannot be shared, and a limit that is unknown, are reported'); assert.ok(/secret/.test(w) && /user-selected/.test(w), 'a scope that OpenTick cannot enforce is refused, not silently widened');
assert.deepEqual(caps.sort(), ['pack:other.search_records', 'tasks.create_record', 'tasks.search_records'], 'only what is real and valid is kept (the one with no usable field and the unsupported scope are dropped)'); assert.deepEqual(J(bad.pack.permissions.sections.find(s => s.id === 'tasks').capabilities.find(c => c.id === 'search_records').scope), { fields: ['title'] });
assert.ok(/does not offer|not exist|cannot be limited/.test(w), 'a limit that does not apply is reported'); assert.ok(!caps.includes('pack:other.create_record'), 'another pack cannot be written to');
// a pack that uses none of it stays format 1 and old packs are unchanged
const plain = A.packParse(JSON.stringify({ opentick: 'pack', format: 1, id: 'plain', name: 'Plain', sections: [{ name: 'S', fields: [] }] })); assert.equal(A.__run('packFormatNeeded(' + q(J(plain.pack)) + ')'), 1); assert.equal(plain.pack.permissions, undefined);
// an action whose permissions the pack does not ask for is reported and left out
const orphan = A.packParse(JSON.stringify({ ...PACK, id: 'orph', permissions: { sections: [{ id: 'tasks', capabilities: [{ id: 'search_records' }] }] } })); assert.ok(J(orphan.warnings).some(x => /needs permissions the pack does not ask for/.test(x)), 'actions need their permissions declared');
assert.equal(orphan.pack.sections[0].actions, undefined); assert.equal(orphan.pack.sections[0].related, undefined);
// unsupported op / garbage
const junk = A.packParse(JSON.stringify({ ...PACK, id: 'junk', sections: [{ name: 'S', fields: [], actions: [{ id: 'x', name: 'Run code', op: 'eval', map: { title: 'x' } }] }] })); assert.ok(J(junk.warnings).some(x => /cannot do/.test(x)));

/* ---------- 2. nothing is allowed until the person says so; every refusal says what is missing and returns nothing ---------- */
await A.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await A.vDrain(); await sync(A);
await B.vaultJoin(JSON.parse(srv.files.get(FILE).body).vault, 'p', PASS, { local: false }); await sync(B);
wait(5000); const existing = A.newTask({ title: 'Secret tax return', notes: 'private notes about money', due: '2026-12-05', tags: ['finance'], priority: 3 }); A.S.tasks.push(existing); A.flush(); const exId = existing.id;
const N0 = A.S.tasks.length; A.packInstall(A.packParse(JSON.stringify(PACK)).pack, { kind: 'file' }); A.flush();
const sec = () => A.S.csections.find(s => s.packId === 'rt'), ent = () => A.S.centries.find(e => e.title === 'Dune');
for (const [m, args] of [['search', ['tasks', 'tax']], ['summary', ['tasks', exId]], ['details', ['tasks', exId]], ['list', ['tasks']], ['create', ['tasks', { title: 'Sneaky' }]], ['complete', ['tasks', exId]], ['remove', ['tasks', exId]], ['link', [ent().id, 'tasks', exId]], ['discover', ['tasks']]]) {
  const r = api(A, 'rt', m, ...args); assert.equal(r.ok, false, m + ' is refused by default'); assert.ok(/^tasks\./.test(r.missing) && r.why, m + ' says which permission is missing: ' + JSON.stringify(r)); assert.equal(r.records, undefined); assert.equal(r.record, undefined, 'and returns no data');
}
assert.equal(A.S.tasks.length, N0, 'nothing was created'); assert.equal(A.S.tasks.find(t => t.id === exId).deleted, undefined);
const refused = J(A.S.pkact).filter(e => !e.ok); assert.ok(refused.length >= 9 && refused.every(e => e.cap && e.why && e.packId === 'rt'), 'every refusal is in the activity list with the permission it lacked');
assert.ok(!JSON.stringify(A.S.pkact).includes('Secret tax return') && !JSON.stringify(A.S.pkact).includes('private notes'), 'the activity list holds no record contents');

/* ---------- 3. the install screen: each permission on its own line, required or optional, with what it really does ---------- */
const html = A.__run(`pkpInstallBlock(${q(pack)})`); assert.ok(/Search tasks/.test(html) && /by their title/.test(html), 'a plain sentence for each: ' + html.slice(0, 300)); assert.ok(/Required/.test(html) && /Optional/.test(html));
assert.ok(/Fields: due date, status, title/.test(html), 'the exact fields are shown'); assert.ok(/Records: made by this pack or linked to it/.test(html) && /It cannot read or change the ones you already have/.test(html), 'what creating does NOT include is said');
assert.ok(!/Access your Tasks/i.test(html), 'no vague wording'); const ticks = [...html.matchAll(/data-pkp="([^"]+)"( checked)?/g)].map(m => [m[1], !!m[2]]);
assert.deepEqual(ticks.filter(t => t[1]).map(t => t[0]), ['tasks.create_record'], 'only the required one is ticked to begin with; nothing else is on until it is ticked');
const dec = Object.fromEntries(ticks.map(([k]) => [k, ['tasks.search_records', 'tasks.view_record_summary', 'tasks.create_record', 'tasks.link_records', 'tasks.view_relationships', 'tasks.complete_record'].includes(k)]));
A.__run(`pkpApplyDecisions(${q(pack)}, ${q(dec)})`); A.flush();
for (const k of Object.keys(dec)) assert.equal(st(A, 'rt', k), dec[k] ? 'granted' : 'denied', k + (dec[k] ? ' ticked → allowed' : ' not ticked → refused (explicitly)'));
assert.equal(api(A, 'rt', 'remove', 'tasks', exId).ok, false, 'a permission that was refused at install stays refused');

/* ---------- 4. granular: search sees titles only; the summary only the granted fields; details are a separate permission ---------- */
let r = api(A, 'rt', 'search', 'tasks', 'tax'); assert.equal(r.ok, true); assert.deepEqual(r.records, [{ id: exId, title: 'Secret tax return' }], 'search returns the id and the searched field, nothing else');
r = api(A, 'rt', 'summary', 'tasks', exId); assert.deepEqual(r.record, { id: exId, title: 'Secret tax return', status: 'open', 'due-date': '2026-12-05' }, 'the summary has exactly the granted fields (no notes, tags or priority)');
assert.equal(api(A, 'rt', 'summary', 'tasks', exId, ['title', 'tags']).ok, false, 'a field outside the grant is refused'); assert.ok(/tags/.test(api(A, 'rt', 'summary', 'tasks', exId, ['title', 'tags']).why));
assert.equal(api(A, 'rt', 'details', 'tasks', exId).ok, false, 'reading a task in full was not allowed'); assert.equal(api(A, 'rt', 'list', 'tasks').ok, false, 'and listing was not asked for'); assert.equal(api(A, 'rt', 'search', 'notes', 'x').ok, false, 'a different section is a different permission');
assert.deepEqual(api(A, 'rt', 'search', 'tasks', '').records, [], 'an empty query finds nothing (no way to dump everything)');
assert.equal(api(A, 'rt', 'search', 'tasks', 'private notes about money').records.length, 0, 'the notes are not searchable through a title-only permission');

/* ---------- 5. creating does not give access to existing records; the pack owns what it makes (as the APP recorded it) ---------- */
r = api(A, 'rt', 'create', 'tasks', { title: 'Read Dune', due: '2026-12-01', owner: 'someone else', pack: 'other', id: 'task-chosen-by-pack' }); assert.equal(r.ok, true); const mine = r.id; assert.notEqual(mine, 'task-chosen-by-pack', 'the app chooses the id');
assert.equal(A.S.tasks.find(t => t.id === mine).title, 'Read Dune'); assert.equal(A.S.tasks.find(t => t.id === mine).owner, undefined, 'claims in the data are not copied onto the record');
assert.equal(A.__run(`pkpOwns('rt', 'tasks', ${q(mine)})`), true, 'ownership is the app\'s own note of who made it'); assert.equal(A.__run(`pkpOwns('rt', 'tasks', ${q(exId)})`), false); assert.equal(A.__run(`pkpOwns('other', 'tasks', ${q(mine)})`), false);

/* ---------- 6. record scope: "pack-linked" covers the pack's own tasks and the ones its entries are linked to, never the rest ---------- */
assert.equal(api(A, 'rt', 'complete', 'tasks', exId).ok, false, 'an unrelated task cannot be completed'); assert.ok(/made or is linked to/.test(api(A, 'rt', 'complete', 'tasks', exId).why));
assert.equal(api(A, 'rt', 'complete', 'tasks', mine).ok, true, 'a task the pack made can be completed (scope: pack-linked includes pack-created)'); assert.equal(A.S.tasks.find(t => t.id === mine).status, 'done');
assert.equal(api(A, 'rt', 'link', ent().id, 'tasks', exId).ok, true, 'link_records was allowed: the entry is now linked to the existing task'); assert.deepEqual(api(A, 'rt', 'links', ent().id, 'tasks').ids, [exId]);
assert.equal(api(A, 'rt', 'complete', 'tasks', exId).ok, true, 'a task the pack\'s entry is linked to can now be completed'); assert.equal(A.S.tasks.find(t => t.id === exId).title, 'Secret tax return', 'and nothing else about it changed');
// narrow the same permission to "only what the pack made": the linked task is no longer covered
wait(1000); grant(A, 'rt', 'tasks.complete_record', { records: 'pack-created' }); A.S.tasks.find(t => t.id === exId).status = 'open';
assert.equal(api(A, 'rt', 'complete', 'tasks', exId).ok, false, 'narrowing takes effect at once'); assert.equal(api(A, 'rt', 'complete', 'tasks', mine).ok, true);
assert.equal(api(A, 'rt', 'reopen', 'tasks', mine).ok, false, 'reopening is its own permission and was not granted');
// modifying fields is a separate permission too
assert.equal(api(A, 'rt', 'update', 'tasks', mine, { title: 'x' }).ok, false);
// delete: separate, own records only, and to the trash
grant(A, 'rt', 'tasks.delete_own_records'); assert.equal(api(A, 'rt', 'remove', 'tasks', exId).ok, false, 'delete only covers what the pack made'); assert.equal(A.S.tasks.find(t => t.id === exId).deleted, undefined);
assert.equal(api(A, 'rt', 'remove', 'tasks', mine).ok, true); assert.ok(A.S.tasks.find(t => t.id === mine).deleted, 'moved to the trash, not erased');

/* ---------- 7. updating specific fields needs the fields to be granted, and only its own records ---------- */
r = api(A, 'rt', 'create', 'tasks', { title: 'Second' }); const second = r.id; grant(A, 'rt', 'tasks.update_specific_fields', { fields: ['title'], records: 'pack-created' });
assert.equal(api(A, 'rt', 'update', 'tasks', second, { title: 'Renamed' }).ok, true); assert.equal(A.S.tasks.find(t => t.id === second).title, 'Renamed');
assert.equal(api(A, 'rt', 'update', 'tasks', second, { 'due-date': '2027-01-01' }).ok, false, 'a field that was not granted'); assert.equal(api(A, 'rt', 'update', 'tasks', exId, { title: 'hacked' }).ok, false, 'a record the pack did not make'); assert.equal(A.S.tasks.find(t => t.id === exId).title, 'Secret tax return');

/* ---------- 8. revocation is immediate; a pack that is switched off or removed can do nothing; packs are isolated from each other ---------- */
assert.equal(api(A, 'rt', 'search', 'tasks', 'tax').ok, true); A.__run(`pkpRevoke('rt', 'tasks.search_records')`); assert.equal(api(A, 'rt', 'search', 'tasks', 'tax').ok, false, 'revoked: refused on the very next call'); assert.equal(st(A, 'rt', 'tasks.search_records'), 'revoked');
assert.ok(/turned this off/.test(api(A, 'rt', 'search', 'tasks', 'tax').why));
grant(A, 'rt', 'tasks.search_records', { fields: ['title'] }); A.__run(`pksSetState('rt', 'disabled')`); assert.equal(api(A, 'rt', 'search', 'tasks', 'tax').ok, false, 'a switched-off pack cannot use its permissions'); assert.ok(/switched off/.test(api(A, 'rt', 'search', 'tasks', 'tax').why));
A.__run(`pksSetState('rt', 'installed')`); assert.equal(api(A, 'rt', 'search', 'tasks', 'tax').ok, true, 'switching it back on does not need new permissions'); A.__run(`pksSetState('rt', 'removed')`); assert.equal(api(A, 'rt', 'search', 'tasks', 'tax').ok, false); assert.ok(/removed/.test(api(A, 'rt', 'search', 'tasks', 'tax').why));
A.__run(`pksSetState('rt', 'installed')`);
const other = A.packParse(JSON.stringify({ ...PACK, id: 'other-pack', name: 'Other' })).pack; A.packInstall(other, { kind: 'file' }); A.flush();
assert.equal(api(A, 'other-pack', 'search', 'tasks', 'tax').ok, false, 'another pack does not inherit these permissions'); assert.equal(api(A, 'nobody', 'search', 'tasks', 'tax').ok, false, 'a pack that is not installed has none');
for (const t of ['settings', 'vault', 'credentials', 'keys', 'files', 'contacts', 'calendar']) { const x = api(A, 'rt', 'discover', t); assert.equal(x.ok, false, t + ' is not something a pack can reach'); assert.ok(/no permission/.test(x.why), t + ': ' + x.why); }
grant(A, 'rt', 'pack:other-pack.search_records', { fields: ['title'] }); // a permission for a pack's sections that is not in its own manifest still needs the pack's own grant, and reads only what it grants
assert.equal(api(A, 'other-pack', 'search', 'pack:rt', 'dune').ok, false, 'the other pack was never granted access to this one');
assert.equal(api(A, 'rt', 'search', 'pack:rt', 'dune').ok, true, 'a pack reading its own sections needs no permission'); assert.equal(api(A, 'rt', 'create', 'pack:rt', {}).ok, false, 'but it cannot write through the API either');

/* ---------- 9. declared actions: they ask for everything they need before doing anything ---------- */
const run1 = (a, e = ent()) => J(A.__run(`pkaRun(S.csections.find(s => s.packId === 'rt'), S.centries.find(e => e.id === ${q(e.id)}), S.csections.find(s => s.packId === 'rt').actions.find(a => a.id === ${q(a)}))`));
const before = A.S.tasks.length; let x = run1('mk-task'); assert.equal(x.ok, true); const made = A.S.tasks.find(t => t.id === x.made);
assert.equal(made.title, 'Read Dune by Herbert', 'fields of the entry are filled into the task'); assert.equal(made.due, '2026-12-01'); assert.equal(A.S.tasks.length, before + 1); assert.ok(J(A.S.centries.find(e => e.title === 'Dune').links).some(l => l.id === made.id), 'and the entry is linked to it');
const nn0 = A.S.notes.length; x = run1('mk-note'); assert.equal(x.ok, false, 'the note action needs notes.create_record, which was not allowed'); assert.ok(x.missing.includes('notes.create_record')); assert.equal(A.S.notes.length, nn0, 'nothing was made: an action either has everything it needs or does nothing');
x = run1('done'); assert.equal(x.ok, true); assert.ok(x.changed >= 1); assert.equal(A.S.tasks.find(t => t.id === made.id).status, 'done', 'complete_linked marks what the entry is linked to');
// the related panel shows only the granted fields and says what is missing otherwise
let rel = A.__run(`pkpRelatedHtml(S.csections.find(s => s.packId === 'rt'), S.centries.find(e => e.title === 'Dune'))`); assert.ok(rel.includes('Read Dune by Herbert') && /status: done/.test(rel) && /due date: 2026-12-01/.test(rel) && !/priority/.test(rel), 'the related panel: title, status, due date');
A.__run(`pkpRevoke('rt', 'tasks.view_record_summary')`); rel = A.__run(`pkpRelatedHtml(S.csections.find(s => s.packId === 'rt'), S.centries.find(e => e.title === 'Dune'))`); assert.ok(/You turned this off/.test(rel) && /Review permissions/.test(rel) && !rel.includes('Read Dune'), 'revoked: the panel shows nothing of the task and offers a review');
// the action buttons in the entry dialog
const block = A.__run(`pkpEntryBlock(S.csections.find(s => s.packId === 'rt'), S.centries.find(e => e.title === 'Dune'))`); assert.ok(block.includes('Create reading task') && block.includes('Link a task') && block.includes('data-pkpa="mk-task"'));
assert.equal(A.__run(`pkpEntryBlock(S.csections.find(s => s.packId === 'rt'), { id: 'x' })`).includes('pkp-ent'), true); assert.equal(A.__run(`pkpEntryBlock({ name: 'plain', packId: '', fields: [] }, { id: 'x' })`), '', 'sections without actions have no block');

/* ---------- 10. undo: what the app can put back; once, on every device ---------- */
const ev = A.S.pkact.find(e => e.op === 'create' && e.target === 'tasks' && e.ok && !e.undone && e.rec === made.id); assert.ok(ev);
assert.equal(A.__run(`pkpUndo(${q(ev.id)})`).ok, true); assert.ok(A.S.tasks.find(t => t.id === made.id).deleted, 'undo moved the created task to the trash'); assert.equal(A.__run(`pkpUndo(${q(ev.id)})`).ok, false, 'a second undo does nothing'); assert.equal(A.S.pkact.find(e => e.id === ev.id).undone, true);
assert.equal(A.__run(`pkpOwns('rt', 'tasks', ${q(made.id)})`), false, 'an undone creation is no longer "made by the pack"');
assert.equal(A.__run(`pkpUndo(${q(A.S.pkact.find(e => e.op === 'grant').id)})`).ok, false, 'only creations can be undone');
const act = A.__run('pkpActivityHtml("rt", "all")'); assert.ok(/Undo/.test(act) && /refused/.test(act) && /Created a record/.test(act), 'the activity list shows what was done, what was refused, and Undo where it applies');

/* ---------- 11. sync: the permissions, their state and the activity travel sealed; undo is applied once; a new device confirms first ---------- */
A.flush(); await sync(A, B);
assert.equal(st(B, 'rt', 'tasks.create_record'), 'granted'); assert.equal(st(B, 'rt', 'tasks.delete_own_records'), 'granted'); assert.equal(st(B, 'rt', 'tasks.search_records'), 'granted'); assert.deepEqual(J(B.S.pkperms[0].caps['tasks.complete_record'].scope), { records: 'pack-created' }, 'scopes arrive as they are');
assert.equal(B.S.pkact.find(e => e.id === ev.id).undone, true, 'the undo arrived as history'); assert.ok(B.S.tasks.find(t => t.id === made.id).deleted, 'the task is in the trash there because the TASK synced, not because the event ran again');
assert.equal(B.__run(`pkpUndo(${q(ev.id)})`).ok, false, 'and it cannot be undone a second time on the other device'); const sealed = srv.files.get(FILE).body; assert.ok(!sealed.includes('pp-rt') && !sealed.includes('tasks.create_record') && !sealed.includes('Read Dune'), 'sealed in the cloud file');
assert.equal(B.__run('pkpUnconfirmed()'), true, 'a device that joined later has not confirmed the permissions yet'); const bx = api(B, 'rt', 'search', 'tasks', 'tax'); assert.equal(bx.ok, false); assert.ok(/new to your account/.test(bx.why), 'and says why: ' + bx.why);
assert.ok(/Confirm/.test(B.__run('pkpSettingsNote()')), 'Settings offers to confirm'); B.__run('pkpConfirmDevice()'); assert.equal(api(B, 'rt', 'search', 'tasks', 'tax').ok, true, 'after confirming it works there too, without asking again');
assert.equal(A.__run('pkpUnconfirmed()'), false, 'the device that decided never has to confirm');
// revoking on one device takes effect on the other as soon as they sync
wait(3000); B.__run(`pkpRevoke('rt', 'tasks.search_records')`); B.flush(); await sync(B, A); assert.equal(api(A, 'rt', 'search', 'tasks', 'tax').ok, false, 'revoked on B, refused on A');
// applying a synced event never runs anything: an event that says "create" does not create
const nTasks = B.S.tasks.length; B.S.pkact.push({ id: 'pa-forged1', packId: 'rt', op: 'create', target: 'tasks', rec: 'ghost', ts: 1, ok: true, cap: 'tasks.create_record', dev: 'x', undone: false }); B.flush(); assert.equal(B.S.tasks.length, nTasks, 'events are history, never commands');

/* ---------- 12. the merge rule: never widens, revocation wins, a deliberate re-grant works; commutative, associative, idempotent ---------- */
const cap = (o = {}) => ({ rv: 0, rk: '', gr: 0, e: 0, scope: {}, ver: '1', dev: 'd', ...o }), rec = (c, u = 1) => ({ id: 'pp-m', packId: 'm', caps: { 'tasks.search_records': c }, u });
const merge = (a, b) => J(A.mergeData({ ...A.snapshot(), pkperms: [rec(a)], tomb: {} }, { ...A.snapshot(), pkperms: [rec(b, 2)], tomb: {} }).pkperms[0].caps['tasks.search_records']);
const state = c => A.__run(`pkpState(${q(c)})`);
const g1 = cap({ gr: 100, e: 0, scope: { fields: ['title', 'tags'] } }), rev = cap({ rv: 200, rk: 'r', gr: 0 }), blind = cap({ gr: 300, e: 0, scope: { fields: ['title'] } }), knowing = cap({ rv: 200, rk: 'r', gr: 400, e: 200, scope: { fields: ['title'] } });
assert.equal(state(merge(g1, rev)), 'revoked', 'one device granted, another revoked: revoked on both'); assert.equal(state(merge(rev, g1)), 'revoked');
assert.equal(state(merge(rev, blind)), 'revoked', 'a grant made WITHOUT knowing about the revocation does not undo it'); assert.equal(state(merge(g1, knowing)), 'granted', 'a deliberate grant made after seeing the revocation does'); assert.deepEqual(merge(g1, knowing).scope, { fields: ['title'] });
assert.deepEqual(merge(g1, cap({ gr: 150, e: 0, scope: { fields: ['title', 'priority'] } })).scope, { fields: ['title'] }, 'two grants of one epoch with different scopes: only what both allow');
const den = cap({ rv: 90, rk: 'd' }); assert.equal(state(merge(den, g1)), 'denied', 'a grant made without knowing about a refusal does not undo it'); assert.equal(state(merge(g1, den)), 'denied', 'in either order'); assert.equal(state(merge(cap({ rv: 500, rk: 'd' }), knowing)), 'denied', 'a denial made later than the grant wins');
// property test over many random states: no merge ever grants more than both sides allowed, and the laws hold
let seed = 7; const rnd = n => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n, fieldsOf = () => ['title', 'tags', 'status'].filter(() => rnd(2));
const rc = () => { const rv = rnd(3) * 100, gr = rnd(3) ? (rnd(4) + 1) * 90 : 0, e = rnd(3) * 100; return cap({ rv, rk: rv ? (rnd(2) ? 'r' : 'd') : '', gr, e: gr ? e : 0, scope: gr ? { fields: fieldsOf().sort() } : {}, dev: 'd' + rnd(2) }); };
const sameC = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (let i = 0; i < 400; i++) {
  const a = rc(), b = rc(), c = rc(), ab = merge(a, b), ba = merge(b, a);
  assert.ok(sameC({ ...ab, dev: '', ver: '' }, { ...ba, dev: '', ver: '' }), 'commutative'); assert.ok(sameC(merge(ab, ab), ab), 'idempotent'); assert.ok(sameC({ ...merge(ab, c), dev: '', ver: '' }, { ...merge(a, merge(b, c)), dev: '', ver: '' }), 'associative ' + JSON.stringify([a, b, c]));
  if (state(ab) === 'granted') { assert.ok(state(a) === 'granted' || state(b) === 'granted'); for (const f of ab.scope.fields || []) assert.ok([a, b].filter(x => state(x) === 'granted').some(x => (x.scope.fields || []).includes(f)), 'never more than a side allowed'); }
}

/* ---------- 13. the settings screens ---------- */
const man = A.__run(`pkpManagerHtml('rt')`); assert.ok(/Allowed/.test(man) && /Not allowed/.test(man) && /Turn off/.test(man) && /Allow/.test(man) && /Why: To find a task/.test(man), 'each permission, its state, its reason, and the controls'); assert.ok(/data-pkf="tasks.view_record_summary"/.test(man), 'the fields can be limited one by one');
assert.equal(A.__run(`pkpRevokeAll('rt')`) >= 1, true, 'turn everything off'); for (const k of Object.keys(A.S.pkperms[0].caps)) assert.notEqual(st(A, 'rt', k), 'granted'); assert.equal(api(A, 'rt', 'create', 'tasks', { title: 'z' }).ok, false);
const diffPack = J(A.packParse(JSON.stringify({ ...PACK, version: '1.1.0', permissions: { sections: [{ id: 'tasks', capabilities: [{ id: 'search_records', scope: { fields: ['title', 'tags'] } }, { id: 'create_record' }, { id: 'delete_own_records' }, { id: 'update_specific_fields', scope: { fields: ['title'] } }] }] } })).pack);
grant(A, 'rt', 'tasks.search_records', { fields: ['title'] }); grant(A, 'rt', 'tasks.create_record'); grant(A, 'rt', 'tasks.link_records'); const dhtml = A.__run(`pkpInstallBlock(${q(diffPack)})`);
assert.ok(/What changed in its permissions/.test(dhtml) && /Already allowed/.test(dhtml) && /Wider than before/.test(dhtml) && /New in this version/.test(dhtml), 'an update shows the difference'); assert.ok(/No longer asks for/.test(dhtml) || /no longer asks for/.test(dhtml), 'and what it stopped asking for');
const dticks = [...dhtml.matchAll(/data-pkp="([^"]+)"( checked)?( disabled)?/g)].map(m => [m[1], !!m[2], !!m[3]]); assert.deepEqual(dticks.filter(t => t[1] && !t[2]).map(t => t[0]), [], 'nothing new or wider starts ticked'); assert.ok(dticks.find(t => t[0] === 'tasks.create_record')[2], 'what was already allowed is shown but not re-asked');
assert.equal(st(A, 'rt', 'tasks.link_records'), 'granted'); A.__run(`pkpApplyDecisions(${q(diffPack)}, ${q({ 'tasks.search_records': false, 'tasks.delete_own_records': true, 'tasks.update_specific_fields': false })})`);
assert.deepEqual(J(A.S.pkperms[0].caps['tasks.search_records'].scope), { fields: ['title'] }, 'a wider request that was not ticked leaves the old, narrower permission alone'); assert.equal(st(A, 'rt', 'tasks.delete_own_records'), 'granted'); assert.equal(st(A, 'rt', 'tasks.update_specific_fields'), 'revoked', 'one that was switched off earlier and is not ticked again stays off');
assert.equal(st(A, 'rt', 'tasks.link_records'), 'revoked', 'a permission the new version no longer asks for is switched off');
// HTML in a pack's text is escaped
const evil = J(A.packParse(JSON.stringify({ ...PACK, id: 'evil', name: '<img src=x onerror=alert(1)>', permissions: { sections: [{ id: 'tasks', reason: '<script>x</script>', capabilities: [{ id: 'search_records', reason: '"><b>hi</b>' }] }] } })).pack);
const eh = A.__run(`pkpInstallBlock(${q(evil)})`); assert.ok(!/<script|<b>hi|<img/.test(eh), 'text a pack supplies is never inserted as HTML');

/* ---------- 14. exporting sections with actions writes the manifest they need, and it reads back clean ---------- */
const exp = J(A.__run(`packFromSections(S.csections.filter(s => s.packId === 'rt'), { name: 'My books', id: 'my-books' })`)); assert.equal(exp.format, 2); assert.ok(exp.permissions.sections.some(s => s.id === 'tasks' && s.capabilities.some(c => c.id === 'create_record')));
const back = A.packParse(JSON.stringify(exp)); assert.deepEqual(J(back.warnings), [], 'an exported pack with actions reads back without warnings'); assert.equal(back.pack.sections[0].actions.length, 4);
const plainExp = J(A.__run(`packFromSections([S.csections.find(s => s.packId === 'other-pack' )].map(s => ({ ...s, actions: undefined, related: undefined })), { name: 'Plain' })`)); assert.equal(plainExp.format, 1, 'sections without actions still export as format 1, readable by 0.9.0');

/* ---------- 15. the real install screen: what is ticked is what is granted; removing a pack ends its permissions ---------- */
{
  const C = makeApp({ store: {}, indexedDB: fakeIndexedDB() }), m = () => C.els['#modal'] || (C.els['#modal'] = {}), keys = ['tasks.search_records', 'tasks.view_record_summary', 'tasks.create_record', 'tasks.complete_record', 'tasks.link_records', 'tasks.view_relationships', 'tasks.delete_own_records', 'notes.create_record', 'notes.link_records'];
  const click = what => m().onclick({ target: { closest: sel => (sel === '[data-m]' ? { dataset: { m: what } } : null), classList: { contains: () => false } } });
  const pk = J(C.packParse(JSON.stringify(PACK)).pack); C.packPreview(pk, [], null);
  assert.ok(/What it asks to be allowed to do/.test(m().innerHTML) && /Add tasks/.test(m().innerHTML) && /beyond the permissions you allow above/.test(m().innerHTML), 'the install screen lists the permissions');
  const ticked = new Set(['tasks.create_record', 'tasks.search_records']); m().querySelectorAll = sel => (sel === '[data-pkp]' ? keys.map(k => ({ dataset: { pkp: k }, checked: ticked.has(k), disabled: false })) : []);
  click('ok'); assert.equal(C.__run(`pksState('rt')`), 'installed');
  for (const k of keys) assert.equal(C.__run(`pkpState(pkpCap('rt', ${q(k)}))`), ticked.has(k) ? 'granted' : 'denied', k);
  assert.equal(C.__run('pkpUnconfirmed()'), false, 'the person who ticked them has seen them');
  assert.equal(J(C.__run(`pkApi('rt').search('tasks', 'nothing-here')`)).ok, true, 'what was ticked works at once'); assert.equal(J(C.__run(`pkApi('rt').list('tasks')`)).ok, false, 'what was not ticked does not');
  await C.__run(`pksRemove('rt', false)`); assert.equal(J(C.__run(`pkApi('rt').search('tasks', 'x')`)).ok, false, 'a removed pack can do nothing');
  assert.equal(C.__run(`pkpState(pkpCap('rt', 'tasks.search_records'))`), 'revoked', 'and its permissions are off, so adding it again asks again');
  C.packPreview(pk, [], null); m().querySelectorAll = () => []; click('ok');
  assert.equal(C.__run(`pkpState(pkpCap('rt', 'tasks.search_records'))`) !== 'granted', true, 'nothing came back by itself');
}

srv.server.close();
console.log('pack permission tests passed (manifests, default deny, granular scopes, ownership, revocation, isolation, actions, undo, sync, merge laws, UI)');
