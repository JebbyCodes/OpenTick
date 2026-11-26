// Pack reminders (0.9.1): declared on a section, run by the app's existing reminder scheduler (remEntries / checkReminders), never by an engine of their own.
// Covers: date and repeating reminders, the person's own, snooze / dismiss, completed and deleted entries, time zones and daylight saving, duplicate prevention,
// permissions (deny by default, each capability on its own), and sync between two devices (state merges deterministically; each device notifies for itself).
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB, clock } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const srv = await davServer();
const dev = (folder = 'OpenTick') => { const a = makeApp({ store: {}, indexedDB: fakeIndexedDB() }); Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder, user: 'me', pass: 'secret' } }); return a; };
const sync = async (...ds) => { for (const d of ds) { await d.syncNow(true); assert.equal(d.Sync.state, 'ok', d.Sync.msg); } };
const J = o => JSON.parse(JSON.stringify(o)), q = JSON.stringify, run = (d, code) => J(d.__run(code));
const UTC = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);
const grant = (d, pk, key, scope = {}) => d.__run(`pkpGrant(${q(pk)}, ${q(key)}, ${q(scope)}, '1.0.0')`);
const api = (d, m, ...a) => run(d, `pkApi('rd').${m}(...${q(a)})`);
const pk = (d, from = clock.t, days = 14) => J(d.remEntries(from, from + days * 864e5)).filter(e => e.kind === 'pack');
const ALL = ['create_reminder', 'view_own_reminders', 'view_user_reminders', 'edit_own_reminders', 'edit_user_reminders', 'cancel_own_reminders', 'cancel_user_reminders', 'snooze_dismiss'];

const PACK = { opentick: 'pack', format: 2, id: 'rd', name: 'Reading', version: '1.0.0',
  permissions: { sections: [{ id: 'reminders', reason: 'To remind you to read.', capabilities: ALL.map(id => ({ id, ...(id === 'view_user_reminders' ? { scope: { fields: ['time'] } } : {}) })) }] },
  sections: [{ name: 'Books', checkable: true, fields: [{ key: 'finish', name: 'Finish by', type: 'date' }, { key: 'status', name: 'Status', type: 'select', opts: ['Reading', 'Finished'] }],
    entries: [{ title: 'Dune', vals: { finish: '2026-10-20' } }, { title: 'Emma', vals: { finish: '2026-10-12' } }],
    reminders: [
      { id: 'finish', name: 'Finish by', kind: 'date', field: 'finish', before: [0, 1440], time: '09:00', title: 'Finish {title}', skipWhen: { field: 'status', equals: 'Finished' } },
      { id: 'daily', name: 'Read today', kind: 'repeat', every: { n: 1, unit: 'day' }, time: '20:00', scope: 'section', title: 'Time to read' },
      { id: 'weekly', name: 'Update progress', kind: 'repeat', every: { n: 1, unit: 'week' }, days: [0], time: '18:00', title: 'Update {title}' }] }] };

/* ---------- 1. what a pack may declare ---------- */
{
  const A = dev(), p = A.packParse(JSON.stringify(PACK)); assert.deepEqual(J(p.warnings), [], 'a valid pack raises no warnings');
  const rs = J(p.pack).sections[0].reminders; assert.equal(rs.length, 3); assert.deepEqual(rs[0].before, [0, 1440]); assert.equal(rs[1].scope, 'section'); assert.equal(A.__run(`packFormatNeeded(${q(J(p.pack))})`), 2, 'reminders need format 2');
  const noPerm = J(PACK); delete noPerm.permissions; const w1 = J(A.packParse(JSON.stringify(noPerm)).warnings); assert.ok(w1.some(x => /reminders\.create_reminder/.test(x)), 'reminders without the permission are reported and left out'); assert.equal(J(A.packParse(JSON.stringify(noPerm)).pack).sections[0].reminders, undefined);
  const bad = J(PACK); bad.sections[0].reminders = [{ id: 'x', name: 'Bad', kind: 'date', field: 'status' }, { id: 'y', name: 'Odd', kind: 'telepathy' }, { id: 'z', name: 'Ok', kind: 'repeat', every: { n: 2, unit: 'week' }, until: 'status', skipWhen: { field: 'nope', equals: 'x' } }];
  const pb = A.packParse(JSON.stringify(bad)), wb = J(pb.warnings).join(' | '); assert.ok(/needs a date field/.test(wb), wb); assert.ok(/not a date field/.test(wb), wb); assert.ok(/does not have/.test(wb), wb);
  assert.deepEqual(J(pb.pack).sections[0].reminders.map(r => r.id), ['z'], 'only the usable reminder is kept (unknown kinds are dropped silently as unknown data)');
  bad.sections[0].reminders = 'tomorrow'; assert.ok(J(A.packParse(JSON.stringify(bad)).warnings).some(x => /form OpenTick does not understand/.test(x)));
}

/* ---------- 2. deny by default; then date and repeating reminders in the scheduler ---------- */
const A = dev(), B = dev(); clock.t = UTC(2026, 10, 8, 10);
A.packInstall(A.packParse(JSON.stringify(PACK)).pack, { kind: 'file' }); A.flush();
const sec = () => A.S.csections.find(s => s.packId === 'rd'), ent = t => A.S.centries.find(e => e.title === t), fid = k => sec().fields.find(f => f.name === k).id;
assert.equal(pk(A).length, 0, 'nothing a pack declares notifies until the person allows it');
const refused = api(A, 'remindCreate', ent('Dune').id, { at: '2026-10-15T09:00' }); assert.equal(refused.ok, false); assert.ok(refused.missing.includes('reminders.create_reminder'));
grant(A, 'rd', 'reminders.create_reminder');
let es = pk(A, clock.t, 14); const by = (k, rid) => es.filter(e => e.rid === rid && e.title === k);
assert.deepEqual(by('Finish Dune', 'finish').map(e => e.at).sort(), [UTC(2026, 10, 19, 9), UTC(2026, 10, 20, 9)], 'a day before and on the day, at the declared time');
assert.ok(/1 day to go/.test(by('Finish Dune', 'finish').find(e => e.at === UTC(2026, 10, 19, 9)).body)); assert.deepEqual(by('Finish Emma', 'finish').map(e => e.at).sort(), [UTC(2026, 10, 11, 9), UTC(2026, 10, 12, 9)]);
assert.equal(es.filter(e => e.rid === 'daily').length, 14, 'a section reminder once a day'); assert.ok(es.filter(e => e.rid === 'daily').every(e => e.id === '' && /entries in Books/.test(e.body)));
assert.deepEqual(es.filter(e => e.rid === 'weekly' && e.title === 'Update Dune').map(e => e.at), [UTC(2026, 10, 11, 18), UTC(2026, 10, 18, 18)], 'weekly on Sunday');
assert.equal(new Set(es.map(e => e.key)).size, es.length, 'every occurrence has its own key (so none can fire twice)');
assert.ok(es.every(e => e.pk === 'rd' && typeof e.occ === 'string'));

/* ---------- 3. completed, finished and deleted entries ---------- */
const emma = ent('Emma'); emma.done = true; A.save(); assert.equal(pk(A).filter(e => /Emma/.test(e.title)).length, 0, 'a ticked entry is not reminded about'); emma.done = false; A.save(); assert.ok(pk(A).some(e => /Emma/.test(e.title)));
emma.vals[fid('Status')] = 'Finished'; A.save(); assert.equal(pk(A).filter(e => /Emma/.test(e.title) && e.rid === 'finish').length, 0, 'skipWhen: the pack says Finished means no more reminders'); assert.ok(pk(A).some(e => e.title === 'Update Emma'), '…for the reminder it applies to only');
emma.vals[fid('Status')] = 'Reading'; A.save();

/* ---------- 4. the person's choices: whole section, one entry, a time; precedence ---------- */
A.__run(`pkrSet('rd', '', 'finish', { tm: '08:30' })`); es = pk(A); assert.ok(es.filter(e => e.rid === 'finish').every(e => new Date(e.at).getUTCMinutes() === 30 && new Date(e.at).getUTCHours() === 8), 'the section-wide time applies');
A.__run(`pkrSet('rd', ${q(ent('Dune').id)}, 'finish', { tm: '07:15', bf: [0] })`); es = pk(A); assert.deepEqual(es.filter(e => e.title === 'Finish Dune').map(e => e.at), [UTC(2026, 10, 20, 7, 15)], 'the entry’s own choice beats the section’s (time and offsets)');
assert.ok(es.filter(e => e.title === 'Finish Emma').every(e => new Date(e.at).getUTCHours() === 8), 'other entries keep the section choice');
A.__run(`pkrSet('rd', ${q(ent('Dune').id)}, 'finish', { on: false })`); assert.equal(pk(A).filter(e => e.title === 'Finish Dune').length, 0, 'switched off for one entry'); assert.ok(pk(A).some(e => e.title === 'Finish Emma'));
A.__run(`pkrSet('rd', '', 'weekly', { on: false })`); assert.equal(pk(A).filter(e => e.rid === 'weekly').length, 0, 'switched off for the whole section'); A.__run(`pkrSet('rd', '', 'weekly', { on: true })`);
A.__run(`pkrSet('rd', ${q(ent('Dune').id)}, 'finish', { on: null, tm: '', bf: null })`); A.__run(`pkrSet('rd', '', 'finish', { tm: '' })`);
assert.deepEqual(pk(A).filter(e => e.title === 'Finish Dune').map(e => e.at).sort(), [UTC(2026, 10, 19, 9), UTC(2026, 10, 20, 9)], 'back to what the pack declared');

/* ---------- 5. firing: once, with an open-the-entry action; nothing repeats ---------- */
clock.t = UTC(2026, 10, 19, 9, 0) + 30000; A.checkReminders();
const fired = () => Object.keys(A.S.fired).filter(k => k.startsWith('p|'));
assert.ok(fired().length >= 1, 'it fired'); const n1 = fired().length; A.checkReminders(); A.checkReminders(); assert.equal(fired().length, n1, 'checking again does not fire it again');
assert.ok(/Finish Dune/.test(A.els['#toast'].textContent || ''), 'the person is told'); const rec = A.S.pkrem.find(r => r.eid === ent('Dune').id && r.rid === 'finish'); assert.ok(rec && Object.values(rec.ack).some(a => a.s === 'n'), 'and the other devices can learn it was shown');
// and after the day a reminder is only for a day: nothing is replayed days later
clock.t = UTC(2026, 10, 25, 9); const before = fired().length; A.checkReminders(); assert.ok(!fired().slice(before).some(k => /Finish/.test(k)), 'late ones are not replayed');
clock.t = UTC(2026, 10, 8, 10);

/* ---------- 6. snooze and dismiss: kept, and shared between devices ---------- */
A.__run(`S.settings.pkrPolicy = 'all'`); A.S.fired = {}; for (const k of Object.keys(A.S.pkrem)) delete A.S.pkrem[k]; A.S.pkrem.length = 0;
await sync(A); await sync(B); grant(B, 'rd', 'reminders.create_reminder'); // (B: a new device; the person confirms the permissions there)
assert.equal(pk(B).length, 0, 'a device that is new to the account does not notify for a pack until its permissions are confirmed there'); B.__run('pkpConfirmDevice()');
assert.equal(pk(B).length > 0, true);
const dune = ent('Dune'), up = () => run(A, `pkrUpcoming(S.csections.find(s => s.packId === 'rd'), S.centries.find(e => e.title === 'Dune'), 6)`);
const first = up()[0]; assert.equal(first.title, 'Update Dune');
A.__run(`pkrAckOcc(${q(up()[0])}, 'd')`); assert.ok(!pk(A).some(e => e.key === first.key), 'dismissed here'); await sync(A); await sync(B); assert.ok(!pk(B).some(e => e.key === first.key), 'dismissed on the other device too');
// snooze on A, concurrently dismiss on B for another one: merges, and a dismissal beats a snooze of the same occurrence
const second = up()[0]; const eid = dune.id;
A.__run(`pkrAckOcc(${q(second)}, 'z', 90)`); B.__run(`pkrAckOcc(${q(second)}, 'd')`); await sync(A); await sync(B); await sync(A);
for (const D of [A, B]) assert.ok(!pk(D).some(e => e.key === second.key || e.key.startsWith(second.key + '|z')), 'dismissed wins over a snooze, on both devices, and stays so');
const third = up()[0]; A.__run(`pkrAckOcc(${q(third)}, 'z', 90)`); await sync(A); await sync(B);
const snz = pk(B).filter(e => e.key.startsWith(third.key + '|z')); assert.equal(snz.length, 1, 'a snooze replaces the original with one later occurrence'); assert.ok(snz[0].at > clock.t); assert.ok(!pk(B).some(e => e.key === third.key));
assert.equal(A.S.pkrem.length, B.S.pkrem.length, 'same records on both devices');

/* ---------- 7. one reminder per device: the delivery policy ---------- */
{
  clock.t = UTC(2026, 10, 11, 18, 0) + 20000; const key = k => pk(A, clock.t - 1000, 1).filter(e => e.rid === 'weekly').map(e => e.key);
  A.S.fired = {}; B.S.fired = {}; A.checkReminders(); assert.ok(Object.keys(A.S.fired).some(k => k.startsWith('p|')), 'A notified');
  await sync(A); await sync(B);
  B.__run(`S.settings.pkrPolicy = 'first'`); B.checkReminders(); assert.equal(Object.keys(B.S.fired).filter(k => k.startsWith('p|') && /weekly|18:00/.test(k)).length, 0, 'policy “first”: B knows A showed it, so it stays quiet');
  B.__run(`S.settings.pkrPolicy = 'all'`); B.checkReminders(); assert.ok(Object.keys(B.S.fired).some(k => k.startsWith('p|')), 'policy “all” (the default): every device notifies for itself');
  clock.t = UTC(2026, 10, 8, 10);
}

/* ---------- 8. the person's own reminders on an entry ---------- */
{
  const e = ent('Emma'), s = sec(); A.S.fired = {};
  const id = A.__run(`pkrRemindMe(S.csections.find(s => s.packId === 'rd'), S.centries.find(e => e.title === 'Emma'), '2026-10-09T08:00', 'Return to the library')`); assert.ok(id && id.includes('.'));
  let mine = pk(A).filter(x => x.title === 'Return to the library'); assert.equal(mine.length, 1); assert.equal(mine[0].at, UTC(2026, 10, 9, 8)); assert.equal(mine[0].id, e.id, 'it opens that entry');
  A.__run(`pkrRemindMe(S.csections.find(s => s.packId === 'rd'), S.centries.find(e => e.title === 'Emma'), '2026-10-10T08:00', 'Second one')`); assert.equal(pk(A).filter(x => x.id === e.id && ['Return to the library', 'Second one'].includes(x.title)).length, 2, 'several per entry');
  A.__run(`pkrEditOnce(${q(id)}, { at: '2026-10-09T09:30' })`); assert.equal(pk(A).find(x => x.title === 'Return to the library').at, UTC(2026, 10, 9, 9, 30), 'edited');
  A.__run(`S.packs.find(p => p.packId === 'rd').state = 'removed'`); assert.equal(pk(A).filter(x => x.title === 'Return to the library').length, 1, 'the person’s own reminders survive removing the pack (the entries are theirs)'); assert.equal(pk(A).filter(x => x.rid === 'finish').length, 0, '…what the pack declared does not');
  A.__run(`S.packs.find(p => p.packId === 'rd').state = 'disabled'`); assert.equal(pk(A).length, 0, 'switched off: nothing'); A.__run(`S.packs.find(p => p.packId === 'rd').state = 'installed'`);
  e.done = true; A.save(); assert.equal(pk(A).filter(x => x.title === 'Return to the library').length, 0, 'ticked as done: quiet'); e.done = false; A.save();
  A.__run(`pkrDelOnce(${q(id)})`); assert.equal(pk(A).filter(x => x.title === 'Return to the library').length, 0, 'cancelled');
  // it travels: the other device has the same, and dismissing it there removes it here
  const keep = A.__run(`pkrRemindMe(S.csections.find(s => s.packId === 'rd'), S.centries.find(e => e.title === 'Emma'), '2026-10-09T10:00', 'Shared')`); await sync(A); await sync(B);
  assert.equal(pk(B).filter(x => x.title === 'Shared').length, 1, 'arrived on the other device'); const u = run(B, `pkrUpcoming(S.csections.find(s => s.packId === 'rd'), S.centries.find(e => e.title === 'Emma'), 10)`).find(x => x.title === 'Shared'); B.__run(`pkrAckOcc(${q(u)}, 'd')`); await sync(B); await sync(A);
  assert.equal(pk(A).filter(x => x.title === 'Shared').length, 0, 'dismissed on B → gone on A');
  assert.equal(new Set(A.S.pkrem.map(r => r.id)).size, A.S.pkrem.length, 'no duplicate records');
}

/* ---------- 9. deleted entries and removed packs leave nothing behind ---------- */
{
  const dune = ent('Dune'); A.__run(`pkrSet('rd', ${q(dune.id)}, 'finish', { on: false })`); assert.ok(A.S.pkrem.some(r => r.eid === dune.id));
  A.S.centries = A.S.centries.filter(x => x !== dune); A.save(); assert.equal(A.__run('pkrGc()'), 0, 'not before the deletion is certain (it may be a sync still on its way)');
  A.S.tomb[dune.id] = Date.now(); assert.ok(A.__run('pkrGc()') >= 1, 'once the entry is known to be deleted its reminder state is cleared'); assert.ok(!A.S.pkrem.some(r => r.eid === dune.id));
  assert.equal(pk(A).filter(e => /Dune/.test(e.title)).length, 0);
}

/* ---------- 10. permissions: each one on its own, never implied by another ---------- */
{
  const C = dev('rem-perm'); clock.t = UTC(2026, 10, 8, 10); C.packInstall(C.packParse(JSON.stringify(PACK)).pack, { kind: 'file' }); C.flush();
  const E = C.S.centries.find(e => e.title === 'Emma').id, D = C.S.centries.find(e => e.title === 'Dune').id, call = (m, ...a) => run(C, `pkApi('rd').${m}(...${q(a)})`);
  for (const [m, a, need] of [['remindCreate', [E, { at: '2026-10-15T09:00' }], 'create_reminder'], ['remindList', [], 'view_own_reminders'], ['remindListUser', [], 'view_user_reminders'], ['remindEdit', ['x', { time: '10:00' }], 'edit_own_reminders'], ['remindEditUser', ['x', { add: 5 }], 'edit_user_reminders'], ['remindCancel', ['x'], 'cancel_own_reminders'], ['remindCancelUser', ['x'], 'cancel_user_reminders'], ['remindSnooze', ['x', 10], 'snooze_dismiss'], ['remindDismiss', ['x'], 'snooze_dismiss']]) {
    const r = call(m, ...a); assert.equal(r.ok, false, m + ' is refused by default'); assert.ok(r.missing.includes('reminders.' + need), `${m} names ${need}`);
  }
  assert.ok(C.S.pkact.filter(e => !e.ok && /^remind/.test(e.op)).length >= 9, 'every refusal is in the activity list');
  grant(C, 'rd', 'reminders.create_reminder'); const mk = call('remindCreate', E, { at: '2026-10-15T09:00', title: 'From the pack' }); assert.ok(mk.ok && mk.id.includes('.'));
  assert.equal(call('remindCreate', 'not-an-entry', { at: '2026-10-15T09:00' }).ok, false, 'only its own entries'); assert.equal(call('remindCreate', E, { at: 'tomorrow' }).ok, false, 'a real date and time');
  assert.equal(call('remindList').ok, false, 'being allowed to create does not let it look'); assert.equal(call('remindCancel', mk.id).ok, false, '…or cancel what it created'); assert.equal(call('remindEdit', mk.id, { at: '2026-10-16T09:00' }).ok, false, '…or edit it');
  grant(C, 'rd', 'reminders.view_own_reminders'); assert.deepEqual(call('remindList').reminders.filter(r => r.at).map(r => r.title), ['From the pack']);
  grant(C, 'rd', 'reminders.edit_own_reminders', { records: 'pack-created' }); assert.ok(call('remindEdit', mk.id, { at: '2026-10-16T09:00' }).ok); assert.equal(C.S.pkrem.find(r => mk.id.startsWith(r.id)).once[mk.id.split('.')[1]].at, '2026-10-16T09:00');
  // the person's own reminder is not "created by the pack": the pack's own-reminder permissions do not reach it
  const mine = C.__run(`pkrRemindMe(S.csections.find(s => s.packId === 'rd'), S.centries.find(e => e.title === 'Emma'), '2026-10-17T08:00', 'Mine')`); grant(C, 'rd', 'reminders.cancel_own_reminders', { records: 'pack-created' }); grant(C, 'rd', 'reminders.snooze_dismiss', { records: 'pack-created' });
  assert.equal(call('remindCancel', mine).ok, false, 'a reminder the person made is not the pack’s to cancel'); assert.equal(call('remindEdit', mine, { at: '2026-10-18T08:00' }).ok, false);
  grant(C, 'rd', 'reminders.cancel_user_reminders'); assert.ok(call('remindCancelUser', mine).ok, 'with its own permission it can'); assert.equal(C.S.pkrem.find(r => mine.startsWith(r.id)).once[mine.split('.')[1]].x, true);
  // snooze and dismiss only touch its own
  const mk2 = call('remindCreate', E, { at: '2026-10-09T12:00', title: 'Soon' }); assert.ok(call('remindSnooze', mk2.id, 30).ok); const u0 = pk(C, clock.t, 3).filter(e => e.title === 'Soon'); assert.equal(u0.length, 1); assert.ok(u0[0].key.includes('|z'), 'snoozed to later'); assert.ok(call('remindDismiss', mk2.id).ok); assert.equal(pk(C, clock.t, 3).filter(e => e.title === 'Soon').length, 0);
  // the person's reminders on tasks: seen only with the permission, only the fields allowed, and changed only with theirs
  const t = C.newTask({ title: 'Pay rent', due: '2026-10-10' }); C.S.tasks.push(t); C.__run(`remsSet(S.tasks.find(x => x.id === ${q(t.id)}), [60])`); C.save();
  assert.equal(call('remindListUser').ok, false, 'not granted'); grant(C, 'rd', 'reminders.view_user_reminders', { fields: ['time'] }); const lu = call('remindListUser'); assert.ok(lu.ok && lu.reminders.length && lu.reminders.every(r => r.time && r.title === undefined), 'times only, no titles');
  assert.equal(call('remindEditUser', t.id, { add: 15 }).ok, false); grant(C, 'rd', 'reminders.edit_user_reminders'); assert.ok(call('remindEditUser', t.id, { add: 15 }).ok); assert.deepEqual(J(C.S.tasks.find(x => x.id === t.id).rems).sort((a, b) => a - b), [15, 60]);
  assert.ok(call('remindCancelUser', t.id, { minutes: 15 }).ok); assert.deepEqual(J(C.S.tasks.find(x => x.id === t.id).rems), [60], 'one reminder of the task, nothing else of it');
  // isolation: another pack's permissions do not help this one, and a revoked one stops at once
  C.__run(`pkpRevoke('rd', 'reminders.create_reminder', 'r')`); assert.equal(call('remindCreate', E, { at: '2026-10-15T09:00' }).ok, false, 'revoked'); assert.equal(pk(C).filter(e => e.rid === 'finish').length, 0, 'and what it declared stops too');
  // the manager screen can show and reach the settings
  assert.ok(/Reminders · Reading/.test(C.__run(`pkrSettingsHtml('rd')`)) && /data-pkrpol/.test(C.__run(`pkrSettingsHtml('rd')`)));
  const blk = C.__run(`pkrEntryBlock(S.csections.find(s => s.packId === 'rd'), S.centries.find(e => e.title === 'Emma'))`); assert.ok(/Review permissions/.test(blk) && /Remind me/.test(blk), 'the entry shows what is missing and how to add its own');
}

/* ---------- 11. time zones and daylight saving: one occurrence per day, at the wall-clock time ---------- */
{
  const old = process.env.TZ; process.env.TZ = 'America/New_York';
  try {
    const D = dev('rem-dst'); const P = J(PACK); P.sections[0].reminders = [{ id: 'nightly', name: 'Night', kind: 'repeat', every: { n: 1, unit: 'day' }, time: '02:30', title: 'Night {title}' }]; P.sections[0].entries = [{ title: 'Moby' }];
    clock.t = UTC(2027, 3, 12, 12); D.packInstall(D.packParse(JSON.stringify(P)).pack, { kind: 'file' }); D.S.centries.forEach(e => { e.created = UTC(2027, 3, 1); }); D.flush(); grant(D, 'rd', 'reminders.create_reminder');
    const occ = (from, days) => pk(D, from, days).filter(e => e.rid === 'nightly'), dayOf = e => e.occ.split('|')[0];
    let o = occ(UTC(2027, 3, 13, 5), 3); const spring = o.filter(e => dayOf(e) === '2027-03-14'); assert.equal(spring.length, 1, 'the day the clocks go forward: 02:30 does not exist, yet the reminder comes exactly once'); assert.ok(spring[0].at > UTC(2027, 3, 14, 6) && spring[0].at <= UTC(2027, 3, 14, 8), 'at the first moment that day that is 02:30 or later');
    assert.equal(new Set(o.map(dayOf)).size, o.length, 'never twice for a day');
    clock.t = UTC(2026, 10, 30, 12); const D2 = dev('rem-dst2'); D2.packInstall(D2.packParse(JSON.stringify(P)).pack, { kind: 'file' }); D2.S.centries.forEach(e => { e.created = UTC(2026, 10, 1); }); D2.flush(); grant(D2, 'rd', 'reminders.create_reminder');
    const P2 = J(P); P2.sections[0].reminders[0].time = '01:30'; const D3 = dev('rem-dst3'); D3.packInstall(D3.packParse(JSON.stringify(P2)).pack, { kind: 'file' }); D3.S.centries.forEach(e => { e.created = UTC(2026, 10, 1); }); D3.flush(); grant(D3, 'rd', 'reminders.create_reminder');
    const fall = pk(D3, UTC(2026, 10, 31, 12), 3).filter(e => e.rid === 'nightly' && dayOf(e) === '2026-11-01'); assert.equal(fall.length, 1, 'the day the clocks go back: 01:30 happens twice, the reminder once');
    // checkReminders fires it once even if it is run through that hour twice
    clock.t = fall[0].at + 1000; D3.checkReminders(); const n = Object.keys(D3.S.fired).filter(k => k.startsWith('p|')).length; clock.t += 3600 * 1000; D3.checkReminders(); assert.equal(Object.keys(D3.S.fired).filter(k => k.startsWith('p|') && k.includes('2026-11-01')).length, 1, 'fired once for the day');
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  clock.t = UTC(2026, 10, 8, 10);
}

/* ---------- 12. merge laws of the reminder state (commutative, associative, idempotent) ---------- */
{
  let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const mkRec = () => { const r = { packId: 'rd', eid: 'e1', rid: 'finish', cfg: { on: [null, true, false][rnd(3)], tm: ['', '08:00', '09:30'][rnd(3)], bf: [null, [0], [0, 60], [1440]][rnd(4)] }, cu: rnd(5), ack: {}, once: {}, u: 1 + rnd(9) };
    for (const k of ['a', 'b', 'c']) if (rnd(2)) r.ack[k] = { s: ['d', 'z', 'n'][rnd(3)], t: 1 + rnd(4), z: rnd(3) * 1000, dev: ['d1', 'd2'][rnd(2)] };
    for (const k of ['x', 'y']) if (rnd(2)) r.once[k] = { at: ['2026-10-09T08:00', '2026-10-10T09:00'][rnd(2)], t: ['', 'A', 'B'][rnd(3)], by: ['user', 'pack'][rnd(2)], x: rnd(3) === 0, u: 1 + rnd(4) };
    return J(A.__run(`pkrNormalise(${q(r)})`)); };
  const m = (x, y) => run(A, `COLL_MERGE.pkrem(${q(x)}, ${q(y)}, ${q(x.u >= y.u ? x : y)})`), canon = r => { const c = J(r); delete c.u; return JSON.stringify(c); };
  for (let i = 0; i < 400; i++) {
    const a = mkRec(), b = mkRec(), c = mkRec(); assert.equal(canon(m(a, b)), canon(m(b, a)), 'commutative'); assert.equal(canon(m(m(a, b), c)), canon(m(a, m(b, c))), 'associative'); assert.equal(canon(m(a, a)), canon(a), 'idempotent');
    const ab = m(a, b); for (const k of Object.keys(a.ack)) if (a.ack[k].s === 'd') assert.equal(ab.ack[k].s, 'd', 'a dismissal is never lost');
  }
}

/* ---------- 12b. repeat rules, and an acknowledgement never goes backwards ---------- */
{
  const on = (def, start, k, until = '') => A.__run(`pkrRepeatsOn(${q({ days: [], ...def })}, ${q(start)}, ${q(k)}, ${q(until)})`), days = (def, start, from, n, until) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(2026, 9, from + i)).toISOString().slice(0, 10); return on(def, start, d, until) ? d : null; }).filter(Boolean);
  assert.deepEqual(days({ every: { n: 3, unit: 'day' } }, '2026-10-08', 8, 10), ['2026-10-08', '2026-10-11', '2026-10-14', '2026-10-17'], 'every 3 days');
  assert.deepEqual(days({ every: { n: 2, unit: 'week' }, days: [0] }, '2026-10-08', 8, 30), ['2026-10-18', '2026-11-01'], 'every other Sunday, counting weeks from the start');
  assert.deepEqual(days({ every: { n: 1, unit: 'week' }, days: [1, 3] }, '2026-10-08', 8, 7), ['2026-10-12', '2026-10-14'], 'chosen weekdays');
  assert.deepEqual(days({ every: { n: 1, unit: 'month' } }, '2026-01-31', 1, 1).concat([on({ every: { n: 1, unit: 'month' } }, '2026-01-31', '2026-02-28') ? 'feb-28' : '', on({ every: { n: 1, unit: 'month' } }, '2026-01-31', '2026-02-27') ? 'bad' : '']).filter(Boolean), ['feb-28'], 'the 31st lands on the last day of a shorter month');
  assert.equal(on({ every: { n: 1, unit: 'day' } }, '2026-10-08', '2026-10-07'), false, 'not before the start'); assert.equal(on({ every: { n: 1, unit: 'day' } }, '2026-10-08', '2026-10-20', '2026-10-15'), false, 'not after the end date');
  const D = dev('rem-ack'); D.packInstall(D.packParse(JSON.stringify(PACK)).pack, { kind: 'file' }); const eid = D.S.centries[0].id;
  D.__run(`pkrAck('rd', ${q(eid)}, 'finish', 'k1', 'd')`); D.__run(`pkrAck('rd', ${q(eid)}, 'finish', 'k1', 'z', ${clock.t + 5000})`); D.__run(`pkrAck('rd', ${q(eid)}, 'finish', 'k1', 'n')`);
  assert.equal(D.S.pkrem.find(r => r.eid === eid).ack.k1.s, 'd', 'once dismissed, a later snooze or "shown" does not bring it back');
}

/* ---------- 13. the pack survives export and import with its reminders and the permission they need ---------- */
{
  const C = dev('rem-exp'); C.packInstall(C.packParse(JSON.stringify(PACK)).pack, { kind: 'file' }); const out = J(C.packFromSections(C.S.csections.filter(s => s.packId === 'rd'), { name: 'Reading again' }, true));
  assert.equal(out.format, 2); assert.equal(out.sections[0].reminders.length, 3); assert.ok(out.permissions.sections.some(s => s.id === 'reminders' && s.capabilities.some(c => c.id === 'create_reminder')), 'an exported pack asks for what its reminders need');
  assert.deepEqual(J(C.packParse(JSON.stringify(out)).warnings), [], 'and reads back cleanly');
  // an older app that only knows format 1 refuses format 2 rather than dropping the reminders silently
  assert.equal(C.__run(`packFormatNeeded(${q(out)})`), 2);
}

srv.server.close();
console.log('pack reminders: OK');
