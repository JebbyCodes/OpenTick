// 0.6: countdowns, time zones, boards (kanban), the Bridge, and that all of them sync and stay encrypted.
process.env.TZ = 'UTC';
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB, clock } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const J = JSON.stringify;

/* ============ 1. time zone arithmetic ============ */
{
  const A = makeApp(), ms = (...a) => Date.UTC(...a);
  assert.equal(A.tzLocal(), 'UTC');
  assert.equal(A.tzValid('America/New_York'), true); assert.equal(A.tzValid('Mars/Base'), false); assert.equal(A.tzValid(''), false);
  assert.equal(A.tzOffset(ms(2026, 6, 1, 12), 'America/New_York'), -240, 'summer'); assert.equal(A.tzOffset(ms(2026, 0, 1, 12), 'America/New_York'), -300, 'winter');
  assert.equal(A.tzOffset(ms(2026, 6, 1, 12), 'Asia/Kolkata'), 330, 'half-hour zones'); assert.equal(A.tzOffset(ms(2026, 6, 1, 12), 'Asia/Kathmandu'), 345, 'quarter-hour zones');
  assert.equal(A.tzOffset(ms(2026, 0, 1, 12), 'Australia/Sydney'), 660, 'southern summer');
  // a wall-clock time to a moment, and back
  for (const z of ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Lord_Howe', 'Pacific/Auckland', 'America/Sao_Paulo'])
    for (const d of ['2026-01-15', '2026-07-15', '2026-10-08', '2026-12-31']) for (const h of ['00:00', '09:30', '23:45']) {
      const m = A.tzToUtc(d, h, z); assert.equal(A.tzDate(m, z), d, `${z} ${d} ${h} date`); assert.equal(A.tzHM(m, z), h, `${z} ${d} ${h} time`);
    }
  // clocks go forward: 02:30 does not exist in New York on 8 Mar 2026, it lands after the gap (03:30 EDT = 07:30Z)
  assert.equal(new Date(A.tzToUtc('2026-03-08', '02:30', 'America/New_York')).toISOString(), '2026-03-08T07:30:00.000Z');
  // clocks go back: 01:30 happens twice on 1 Nov 2026, the first (EDT) is taken
  assert.equal(new Date(A.tzToUtc('2026-11-01', '01:30', 'America/New_York')).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal(new Date(A.tzToUtc('2026-11-01', '02:30', 'America/New_York')).toISOString(), '2026-11-01T07:30:00.000Z', 'after the repeat hour');
  assert.equal(A.tzOffLabel(ms(2026, 6, 1), 'Asia/Kolkata'), 'UTC+5:30'); assert.equal(A.tzOffLabel(ms(2026, 0, 1), 'America/New_York'), 'UTC−5'); assert.equal(A.tzOffLabel(ms(2026, 0, 1), 'UTC'), 'UTC');
  assert.equal(A.tzOf(''), 'UTC'); assert.equal(A.tzOf('local'), 'UTC'); assert.equal(A.tzOf('Nope/Zone'), 'UTC'); assert.equal(A.tzOf('Asia/Tokyo'), 'Asia/Tokyo');
  assert.equal(A.tzNormalise({ id: 'x', tz: 5, tags: ['A', ''] }).tz, '5'); // junk survives load without throwing
  // the planner: London (BST, +1) and New York (EDT, -4) with working hours 8-18 and a UTC device
  const { S } = A; S.zones.push(A.tzNewZone({ name: 'London', tz: 'Europe/London' }), A.tzNewZone({ name: 'New York', tz: 'America/New_York' }));
  const lon = A.tzRows(clock.t).find(r => r.name === 'London');
  const st = { day: '2026-10-08', time: '13:00', ref: lon.id }, p = A.tzPlan(st, '', clock.t);
  assert.equal(p.rows.length, 3); assert.equal(p.at, ms(2026, 9, 8, 12), '13:00 London is 12:00 UTC');
  assert.equal(J(p.runs), J([[13, 18]]), 'London 13-18 is the only stretch inside everyone’s 8-18 (UTC 12-17)');
  assert.equal(p.grid.find(g => g.row.name === 'New York').cells[13].h, 8, 'New York reads 08:00 at 13:00 London');
  S.settings.tz = { start: 9, end: 17 }; assert.equal(J(A.tzPlan(st, '', clock.t).runs), J([[14, 17]]), 'working hours are a setting (UTC 13-16)');
  assert.match(A.tzSummary(p), /New York: .*08:00|New York: .*8:00/);
  // a scope narrows the rows to the zones of a list, a project or a tag
  S.zones[1].tags = ['family']; assert.equal(A.tzRows(clock.t, 'tag:family').length, 2); assert.equal(A.tzRows(clock.t, 'tag:work').length, 1);
}

/* ============ 2. countdowns ============ */
{
  const A = makeApp(), { S } = A, now = clock.t; // 8 Oct 2026, 10:00 UTC
  const c = A.cdNormalise({ id: 'c1', name: 'Trip', date: '2026-10-18' });
  assert.equal(A.cdLeft(c, now).days, 10); assert.equal(A.cdShort(c, now), '10 days'); assert.equal(A.cdBig(c, now).n, '10');
  assert.equal(A.cdShort({ ...c, date: '2026-10-09' }, now), '1 day'); assert.equal(A.cdShort({ ...c, date: '2026-10-08' }, now), 'Today'); assert.equal(A.cdShort({ ...c, date: '2026-10-05' }, now), '3 days ago');
  // with a time it counts down to the second; a zone makes it one real moment
  const t = A.cdNormalise({ id: 'c2', name: 'Call', date: '2026-10-09', time: '09:00', tz: 'America/New_York' }), L = A.cdLeft(t, now);
  assert.equal(L.at, Date.UTC(2026, 9, 9, 13), '09:00 in New York (EDT) is 13:00 UTC'); assert.equal(L.ms, 27 * 3600000); assert.equal(L.days, 1); assert.equal(L.h, 3);
  assert.equal(A.cdShort(t, now), '1d 3h'); assert.equal(A.cdShort(t, L.at + 61000), '1m 01s ago');
  assert.match(A.cdWhen(t, now).replace(/\u00a0/g, ' '), /9:00 AM New York · .*1:00 PM your time/);
  const floating = A.cdNormalise({ id: 'c3', name: 'F', date: '2026-10-09', time: '09:00' }); assert.equal(A.cdLeft(floating, now).at, Date.UTC(2026, 9, 9, 9), 'no zone = this device’s own time');
  // a yearly one rolls on by itself
  const b = A.cdNormalise({ id: 'c4', name: 'Birthday', date: '2020-03-14', repeat: 'year' });
  assert.equal(A.cdLeft(b, now).date, '2027-03-14'); assert.equal(A.cdLeft(b, Date.UTC(2027, 2, 14, 12)).today, true); assert.equal(A.cdLeft(b, Date.UTC(2027, 2, 15, 12)).date, '2028-03-14');
  assert.equal(A.cdLeft(A.cdNormalise({ id: 'c5', name: 'Leap', date: '2024-02-29', repeat: 'year' }), Date.UTC(2026, 5, 1)).date, '2027-02-28', 'Feb 29 falls back in other years');
  // junk never breaks loading
  const bad = A.cdNormalise({ id: 'x', date: 'soon', time: '25:99', remind: ['a', -1, 60], tags: ['A'], repeat: 'weekly' }); assert.match(bad.date, /^\d{4}-\d\d-\d\d$/); assert.equal(bad.time, ''); assert.equal(J(bad.remind), J([60])); assert.equal(bad.repeat, ''); assert.equal(J(bad.tags), J(['a']));
  // lists, projects and tags
  const lid = S.lists[1].id; S.projects.push({ id: 'p1', name: 'P', color: '#4772fa', listIds: [lid] });
  S.countdowns.push(A.cdNormalise({ id: 'a', name: 'A', date: '2026-11-01', listId: lid }), A.cdNormalise({ id: 'b', name: 'B', date: '2026-11-02', tags: ['trip'] }), A.cdNormalise({ id: 'c', name: 'C', date: '2026-11-03', projectId: 'p1' }), A.cdNormalise({ id: 'd', name: 'D', date: '2026-09-01' }));
  const names = k => A.cdList(now).filter(() => true) && S.countdowns.filter(x => A.scopeHas(k, x)).map(x => x.name).join('');
  assert.equal(names(''), 'ABCD'); assert.equal(names('list:' + lid), 'A'); assert.equal(names('project:p1'), 'AC'); assert.equal(names('tag:trip'), 'B');
  assert.equal(A.cdList(now).map(x => x.name).join(''), 'ABC', 'upcoming, soonest first (the past one is hidden)'); S.settings.cd.show = 'past'; assert.equal(A.cdList(now).map(x => x.name).join(''), 'D');
  S.settings.cd.show = 'upcoming'; S.settings.cd.tag = 'trip'; assert.equal(A.cdList(now).map(x => x.name).join(''), 'B'); S.settings.cd.tag = '';
  assert.match(A.cdStripHtml('list:' + lid, now), /cdchip/); assert.equal(A.cdStripHtml('list:nope', now), ''); assert.equal(A.cdStripHtml('inbox', now), '');
  // reminders: an hour before, for the next occurrence of a yearly one, and 09:00 for a day with no time
  S.countdowns.length = 0;
  S.countdowns.push(A.cdNormalise({ id: 'r1', name: 'Call', date: '2026-10-09', time: '09:00', tz: 'America/New_York', remind: [60] }), A.cdNormalise({ id: 'r2', name: 'Day', date: '2026-10-09', remind: [0] }));
  const es = A.remEntries(now, now + 3 * 864e5).filter(e => e.kind === 'countdown');
  assert.equal(es.length, 2); assert.equal(es.find(e => e.id === 'r1').at, Date.UTC(2026, 9, 9, 12), '1 hour before 13:00Z'); assert.equal(es.find(e => e.id === 'r2').at, Date.UTC(2026, 9, 9, 9), '09:00 on the day');
  // a countdown to a task
  const task = A.newTask({ title: 'Exam', due: '2026-10-20', time: '10:00', tags: ['uni'] }); S.tasks.push(task);
}

/* ============ 3. boards ============ */
{
  const A = makeApp(), { S } = A, mk = (title, o = {}) => { const t = A.newTask({ title, ...o }); S.tasks.push(t); return t; };
  const b = A.kbNewBoard('Sprint', 1); S.boards.push(b); S.settings.ui.board = b.id;
  const [backlog, ready, prog, review, done] = b.cols; assert.equal(done.done, true); assert.equal(b.cols.length, 5);
  const t1 = mk('one'), t2 = mk('two'), t3 = mk('three'); const open0 = S.tasks.filter(t => t.status === 'open').length;
  assert.equal(A.kbTasks(b).length, open0, 'an everything board shows every open task'); assert.equal(A.kbColOf(b, t1).id, backlog.id, 'no place yet = first heading');
  A.kbMove(b, t1, prog.id, null); assert.equal(t1.kb[b.id], prog.id); assert.equal(A.kbColOf(b, t1).id, prog.id);
  // order inside a heading
  A.kbMove(b, t2, prog.id, null); A.kbMove(b, t3, prog.id, t1.id);
  assert.equal(J(A.kbColumns(b).get(prog.id).map(t => t.title)), J(['three', 'one', 'two']), 'dropped before “one”, the other at the end');
  A.kbMove(b, t2, prog.id, t3.id); assert.equal(J(A.kbColumns(b).get(prog.id).map(t => t.title)), J(['two', 'three', 'one']));
  // equal orders are renumbered, never lost
  for (const t of [t1, t2, t3]) t.order = 5; A.kbMove(b, t3, prog.id, t2.id); assert.equal(J(A.kbColumns(b).get(prog.id).map(t => t.title)), J(['one', 'three', 'two']), 'dropped right before “two”');
  // the done heading finishes a task, moving it out reopens it
  A.kbMove(b, t1, done.id, null); assert.equal(t1.status, 'done'); assert.equal(A.kbColOf(b, t1).id, done.id); assert.ok(A.kbTasks(b).includes(t1), 'finished tasks show in the done heading');
  A.kbMove(b, t1, review.id, null); assert.equal(t1.status, 'open'); assert.equal(A.kbColOf(b, t1).id, review.id);
  // a task ticked in the task list lands in the done heading; reopened it goes back to the first
  A.toggleDone(t2); assert.equal(A.kbColOf(b, t2).id, done.id); A.toggleDone(t2); assert.equal(A.kbColOf(b, t2).id, prog.id, 'its old place is kept');
  // a repeating task rolls on instead of finishing
  const rep = mk('daily', { due: '2026-10-08', repeat: { unit: 'day', every: 1 } }); A.kbMove(b, rep, done.id, null);
  assert.equal(rep.status, 'open'); assert.equal(rep.due, '2026-10-09'); assert.equal(A.kbColOf(b, rep).id, backlog.id, 'back to the start for its next round');
  // scope: a list board shows that list only, a tag board that tag, new cards land in the scope
  const lid = S.lists[1].id, inList = mk('in list', { listId: lid }); b.scope = 'list:' + lid; assert.ok(A.kbTasks(b).includes(inList)); assert.ok(!A.kbTasks(b).includes(t3));
  const nt = A.kbAddTask(b, ready.id, '  new card '); assert.equal(nt.title, 'new card'); assert.equal(nt.listId, lid); assert.equal(A.kbColOf(b, nt).id, ready.id);
  b.scope = 'tag:bug'; const bug = A.kbAddTask(b, ready.id, 'crash'); assert.ok(bug.tags.includes('bug')); assert.ok(A.kbTasks(b).includes(bug) && !A.kbTasks(b).includes(inList));
  assert.equal(A.kbAddTask(b, ready.id, '   '), null); const d2 = A.kbAddTask(b, done.id, 'already done'); assert.equal(d2.status, 'done');
  // two boards keep their own places for the same task
  b.scope = ''; const b2 = A.kbNewBoard('Other', 0); S.boards.push(b2); A.kbMove(b2, t3, b2.cols[1].id, null); assert.equal(A.kbColOf(b, t3).id, prog.id); assert.equal(A.kbColOf(b2, t3).id, b2.cols[1].id);
  // steps (keyboard / menu)
  A.kbMoveStep(b, t3, 1); assert.equal(A.kbColOf(b, t3).id, review.id); assert.equal(A.kbMoveStep(b, t3, 9), true); assert.equal(A.kbColOf(b, t3).id, done.id); assert.equal(A.kbMoveStep(b, t3, 1), false);
  // deleting a heading sends its cards to the first; deleting a board cleans the cards
  A.kbMove(b, t3, ready.id, null); const ro = A.kbColumns(b).get(ready.id).length; for (const t of S.tasks) if (t.kb && t.kb[b.id] === ready.id) delete t.kb[b.id]; b.cols.splice(b.cols.indexOf(ready), 1);
  assert.equal(A.kbColumns(b).get(backlog.id).length >= ro, true, 'cards of a removed heading fall back to the first');
  // headings survive loading junk
  const j = A.kbNormalise({ id: 'x', cols: [null, { name: 5, wip: -3 }, 'str'] }); assert.equal(j.cols.length, 1); assert.equal(j.cols[0].wip, 0); assert.equal(A.kbNormalise({ id: 'y', cols: [] }).cols.length, 2, 'an empty board gets starter headings');
  // and the page renders for a board, an empty state, and a board with a huge heading list
  A.U.page = 'kanban'; A.renderMain(); S.boards.length = 0; A.renderMain();
}

/* ============ 4. everything syncs: merge, deletion, schema, encryption ============ */
{
  const A = makeApp(), B = makeApp();
  const base = clock.t - 50000;
  const rec = (o, u) => ({ ...o, u: base + u });
  const D = (o = {}) => ({ tasks: [], lists: [], habits: [], pomo: [], tomb: {}, ...o });
  const cd = (id, name, u) => rec(A.cdNormalise({ id, name, date: '2026-12-25' }), u), z = (id, tz, u) => rec(A.tzNormalise({ id, name: id, tz }), u), bd = (id, name, u) => rec(A.kbNormalise({ id, name }), u);
  let m = A.mergeData(D({ countdowns: [cd('c', 'old', 1)], zones: [z('z', 'Asia/Tokyo', 1)], boards: [bd('b', 'old', 1)] }), D({ countdowns: [cd('c', 'new', 9), cd('c2', 'other', 1)], zones: [z('z', 'Asia/Seoul', 9)], boards: [bd('b', 'new', 9)] }));
  assert.equal(m.countdowns.length, 2); assert.equal(m.countdowns.find(x => x.id === 'c').name, 'new', 'newest edit wins, per record'); assert.equal(m.zones[0].tz, 'Asia/Seoul'); assert.equal(m.boards[0].name, 'new');
  const rev = A.mergeData(D({ countdowns: [cd('c', 'new', 9), cd('c2', 'other', 1)], zones: [z('z', 'Asia/Seoul', 9)], boards: [bd('b', 'new', 9)] }), D({ countdowns: [cd('c', 'old', 1)], zones: [z('z', 'Asia/Tokyo', 1)], boards: [bd('b', 'old', 1)] }));
  assert.equal(A.fingerprint(m), A.fingerprint(rev), 'commutative');
  // a deletion on one device removes the record on the other, an edit after the deletion brings it back
  m = A.mergeData(D({ countdowns: [cd('c', 'x', 5)], zones: [z('z', 'UTC', 5)], boards: [bd('b', 'x', 5)] }), D({ tomb: { c: base + 8, z: base + 8, b: base + 8 } }));
  assert.equal(m.countdowns.length + m.zones.length + m.boards.length, 0, 'deleted after the last edit');
  m = A.mergeData(D({ countdowns: [cd('c', 'x', 9)], zones: [z('z', 'UTC', 9)], boards: [bd('b', 'x', 9)] }), D({ tomb: { c: base + 8, z: base + 8, b: base + 8 } }));
  assert.equal(m.countdowns.length + m.zones.length + m.boards.length, 3, 'edited after the deletion: kept');
  // the live store: save() stamps new records, deleting one leaves a tombstone, undo of a merge covers them
  const { S } = A; const c1 = A.cdNormalise({ id: 'live', name: 'Live', date: '2026-12-25' }); S.countdowns.push(c1); S.zones.push(A.tzNewZone({ name: 'T', tz: 'Asia/Tokyo' })); const bb = A.kbNewBoard('Live board', 0); S.boards.push(bb); A.save(); A.flush();
  assert.ok(c1.u > 0 && S.zones[0].u > 0 && bb.u > 0, 'stamped'); S.countdowns.length = 0; A.save(); A.flush(); assert.ok(S.tomb.live > 0, 'tombstone for a deleted countdown');
  // a task moved on a board changes the task, so it syncs with the task
  const t = A.newTask({ title: 'card' }); S.tasks.push(t); A.save(); A.flush(); const u0 = t.u; clock.t += 5000; t.kb = { [bb.id]: bb.cols[1].id }; A.save(); A.flush(); assert.ok(t.u > u0, 'moving a card stamps the task');
  // the file: written with the new schema, read back, and an older file (without the collections) still loads
  const pl = JSON.parse(A.buildPayload().text); assert.equal(pl.schema, 6); assert.ok(Array.isArray(pl.countdowns) && Array.isArray(pl.zones) && Array.isArray(pl.boards));
  const old = A.parsePayload(J({ app: 'opentick', schema: 5, tasks: [], lists: [] })); assert.equal(J(old.countdowns), '[]'); assert.equal(J(old.boards), '[]'); assert.equal(J(old.zones), '[]');
  // counts and the export / wipe list know about them
  S.countdowns.push(A.cdNormalise({ id: 'k', name: 'K', date: '2026-12-25' })); assert.match(A.dataCountsText(A.dataCounts(S)), /countdown/);
}
{
  // encrypted sync: what reaches the cloud is sealed, the other device gets the new collections after joining
  const SECRET = 'COUNTDOWN-SECRET-81c2', ZONE = 'Zone-Secret-Name', BOARD = 'Board-Secret-Name', HEAD = 'Heading-Secret-Name', PASS = 'correct horse battery staple', SCOPES = { local: true, backup: true, sync: true };
  const srv = await davServer(), FILE = '/dav/OpenTick/opentick.json';
  const link = a => Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder: 'OpenTick', user: 'me', pass: 'secret' } });
  const mk = prev => { const store = prev ? prev.store : {}, indexedDB = prev ? prev.indexedDB : fakeIndexedDB(), a = makeApp({ store, indexedDB }); a.indexedDB = indexedDB; return a; };
  const A = mk(); link(A);
  A.S.countdowns.push(A.cdNormalise({ id: 'cc', name: SECRET, date: '2026-12-25', note: SECRET })); A.S.zones.push(A.tzNewZone({ name: ZONE, tz: 'Asia/Tokyo' }));
  const bd = A.kbNewBoard(BOARD, 0); bd.cols[0].name = HEAD; A.S.boards.push(bd); A.save(); A.flush();
  await A.syncNow(true);
  let body = srv.files.get(FILE).body; for (const s of [SECRET, ZONE, BOARD, HEAD]) assert.ok(body.includes(s), 'without the vault the file is plain JSON: ' + s);
  await A.vaultEnable(PASS, SCOPES, {}); await A.vDrain(); await A.syncNow(true);
  body = srv.files.get(FILE).body; for (const s of [SECRET, ZONE, BOARD, HEAD, 'Asia/Tokyo']) assert.ok(!body.includes(s), 'sealed: ' + s); assert.equal(JSON.parse(body).enc, 1);
  const store = Object.entries(A.store).map(([k, v]) => k + '=' + v).join('\n'); for (const s of [SECRET, ZONE, BOARD, HEAD]) assert.ok(!store.includes(s), 'sealed on this device too: ' + s);
  const hdr = JSON.parse(body).vault, B = mk(); link(B); await B.vaultJoin(hdr, 'p', PASS, { local: false }); await B.syncNow(true);
  assert.equal(B.Sync.state, 'ok'); assert.ok(B.S.countdowns.some(c => c.name === SECRET), 'B received the countdown'); assert.ok(B.S.zones.some(z => z.name === ZONE)); assert.ok(B.S.boards.some(x => x.name === BOARD && x.cols[0].name === HEAD));
  // B changes them, A hears it; a deletion on B reaches A
  B.S.countdowns[0].name = 'renamed'; B.S.boards[0].cols[1].name = 'Moved'; B.save(); B.flush(); await B.syncNow(true); await A.syncNow(true);
  assert.equal(A.S.countdowns.find(c => c.id === 'cc').name, 'renamed'); assert.equal(A.S.boards[0].cols[1].name, 'Moved');
  B.S.zones.length = 0; B.save(); B.flush(); await B.syncNow(true); await A.syncNow(true); assert.equal(A.S.zones.length, 0, 'deleted zone is gone on A');
  // a backup written with the data scope sealed does not contain them either
  const text = await A.vFile(J({ ...A.S, _app: { name: 'OpenTick' } }), 'backup', 4); for (const s of [SECRET, BOARD, HEAD]) assert.ok(!text.includes(s), 'backup sealed: ' + s);
  // device-only: pairing records are settings, which never leave the device
  await A.syncNow(true); A.S.settings.bridge.apps['x.y'] = { name: 'MARKER-APP-NAME', hash: 'h', perms: [] }; A.save(); A.flush(); await A.syncNow(true);
  assert.ok(!srv.files.get(FILE).body.includes('MARKER-APP-NAME') && !A.buildPayload().text.includes('MARKER-APP-NAME'), 'connected apps are never part of the sync file');
  srv.server.close();
}

/* ============ 5. the Bridge ============ */
{
  const A = makeApp(), { S } = A; A.__mock('openExternal', u => { A.opened = A.opened || []; A.opened.push(u); });
  const grant = async (app, perms, name = 'Test app') => { const tok = 'tok-' + app; S.settings.bridge.apps[app] = { name, hash: await A.brHash(tok), perms, at: 0, used: 0, origins: [] }; return tok; };
  const call = (app, token, cmd, args) => A.bridgeCall({ app, token, cmd, args });
  // off by default: nothing answers, not even hello
  assert.equal(S.settings.bridge.on, false); let r = await call('a.b', 'x', 'hello', {}); assert.equal(r.ok, false); assert.equal(r.error.code, 'off');
  S.settings.bridge.on = true;
  r = await call('', '', 'hello', {}); assert.equal(r.ok, true); assert.equal(r.result.bridge, 1); assert.ok(r.result.commands.includes('tasks.add') && r.result.permissions.includes('tasks:read'));
  r = await call('a.b', '', 'tasks.list', {}); assert.equal(r.error.code, 'unauthorized', 'no pairing, no data'); r = await call('a.b', 'whatever', 'nope', {}); assert.equal(r.error.code, 'unknown_command');
  r = await call('a', 'x', 'hello', {}); assert.equal(r.ok, true, 'hello needs no pairing');
  r = await call('A', 'x', 'tasks.list', {}); assert.equal(r.error.code, 'bad_args', 'bad app id');
  const t1 = A.newTask({ title: 'Read me', notes: 'PRIVATE-NOTES', due: '2026-10-08', tags: ['x'] }); S.tasks.push(t1); A.save();
  const read = await grant('reader.app', ['tasks:read']), write = await grant('writer.app', ['tasks:write', 'focus:write', 'countdowns:read']);
  assert.equal((await call('reader.app', 'bad', 'tasks.list', {})).error.code, 'unauthorized', 'wrong token');
  r = await call('reader.app', read, 'tasks.list', { due: 'today' }); assert.equal(r.ok, true); const row = r.result.tasks.find(t => t.id === t1.id); assert.ok(row && row.title === 'Read me');
  assert.ok(!J(r.result).includes('PRIVATE-NOTES'), 'notes are not sent unless asked'); assert.equal((await call('reader.app', read, 'tasks.list', { include: 'notes' })).result.tasks.find(t => t.id === t1.id).notes, 'PRIVATE-NOTES');
  assert.equal((await call('reader.app', read, 'tasks.add', { title: 'no' })).error.code, 'forbidden', 'read-only means read-only'); assert.equal((await call('reader.app', read, 'focus.record', { minutes: 5 })).error.code, 'forbidden'); assert.equal((await call('reader.app', read, 'countdowns.list', {})).error.code, 'forbidden');
  assert.equal((await call('writer.app', write, 'tasks.list', {})).error.code, 'forbidden', 'writers cannot read unless given it');
  // writing
  r = await call('writer.app', write, 'tasks.add', { title: ' From app ', due: '2026-10-10', time: '9:30', tz: 'Asia/Tokyo', tags: '#a,b', priority: 9, durationMin: 45 }); assert.equal(r.ok, true);
  const added = S.tasks.find(t => t.id === r.result.task.id); assert.equal(added.title, 'From app'); assert.equal(added.time, '09:30'); assert.equal(added.tz, 'Asia/Tokyo'); assert.equal(J(added.tags), J(['a', 'b'])); assert.equal(added.priority, 3); assert.equal(added.dur, 45);
  for (const bad of [{}, { title: 'x', due: '10/10' }, { title: 'x', time: '9am' }, { title: 'x', tz: 'Mars/Base' }, { title: 'x', listId: 'nope' }]) assert.equal((await call('writer.app', write, 'tasks.add', bad)).error.code, 'bad_args', J(bad));
  assert.equal((await call('writer.app', write, 'tasks.complete', { id: added.id })).ok, true); assert.equal(added.status, 'done'); assert.equal((await call('writer.app', write, 'tasks.reopen', { id: added.id })).ok, true); assert.equal(added.status, 'open');
  assert.equal((await call('writer.app', write, 'tasks.complete', { id: 'nope' })).error.code, 'not_found');
  // a focus session done elsewhere is recorded in OpenTick's focus history
  r = await call('writer.app', write, 'focus.record', { taskId: added.id, minutes: 25 }); assert.equal(r.ok, true); const last = S.pomo[S.pomo.length - 1]; assert.equal(last.min, 25); assert.equal(last.task, added.id); assert.equal(last.src, 'writer.app');
  for (const bad of [{ minutes: 0 }, { minutes: 9999 }, { minutes: 5, taskId: 'nope' }, { minutes: 5, endedAt: clock.t + 3600000 * 5 }, { minutes: 5, endedAt: clock.t - 40 * 864e5 }]) assert.notEqual((await call('writer.app', write, 'focus.record', bad)).ok, true, J(bad));
  // changes since a time, with deletions
  const since = clock.t; clock.t += 5000; t1.title = 'Edited'; A.save(); A.flush(); const gone = A.newTask({ title: 'gone' }); S.tasks.push(gone); A.save(); A.flush(); S.tasks.splice(S.tasks.indexOf(gone), 1); A.save(); A.flush();
  const all = await grant('sync.app', ['tasks:read']); r = await call('sync.app', all, 'tasks.changes', { since }); assert.ok(r.result.tasks.some(t => t.id === t1.id && t.title === 'Edited')); assert.ok(r.result.deleted.includes(gone.id)); assert.ok(r.result.now >= since);
  // countdowns
  S.countdowns.push(A.cdNormalise({ id: 'cd1', name: 'Launch', date: '2026-12-25', time: '09:00', tz: 'Europe/London', tags: ['t'] })); r = await call('writer.app', write, 'countdowns.list', {}); assert.equal(r.result.countdowns[0].momentMs, Date.UTC(2026, 11, 25, 9)); assert.equal((await call('writer.app', write, 'countdowns.list', { scope: 'tag:none' })).result.countdowns.length, 0);
  // limits
  const lim = await grant('limit.app', ['tasks:read']); let last429; for (let i = 0; i < 130; i++) last429 = await call('limit.app', lim, 'meta.list', {}); assert.equal(last429.error.code, 'rate_limited');
  // revoking removes access at once
  delete S.settings.bridge.apps['reader.app']; assert.equal((await call('reader.app', read, 'tasks.list', {})).error.code, 'unauthorized');
  // switching it off stops everything
  S.settings.bridge.on = false; assert.equal((await call('writer.app', write, 'tasks.list', {})).error.code, 'off'); S.settings.bridge.on = true;
  // locked: no data leaves
  A.Vault.locked = true; assert.equal((await call('writer.app', write, 'countdowns.list', {})).error.code, 'locked'); A.Vault.locked = false;
  // pairing: the person decides which permissions; the token is shown once and only its hash is kept
  A.__mock('formDialog', async o => ({ 'p_tasks:read': true, 'p_tasks:write': false, 'p_focus:write': true, 'p_countdowns:read': false }));
  r = await A.bridgeCall({ app: 'new.app', cmd: 'pair', args: { name: 'New app', permissions: ['tasks:read', 'tasks:write'] } }); assert.equal(r.ok, true); assert.equal(J(r.result.permissions), J(['tasks:read', 'focus:write']), 'the person’s choice wins over the request');
  assert.ok(r.result.token.length >= 30); const rec = S.settings.bridge.apps['new.app']; assert.ok(rec.hash && !J(rec).includes(r.result.token), 'only a hash is stored'); assert.equal((await call('new.app', r.result.token, 'tasks.list', {})).ok, true);
  A.__mock('formDialog', async () => null); r = await A.bridgeCall({ app: 'no.app', cmd: 'pair', args: {} }); assert.equal(r.error.code, 'denied'); assert.ok(!S.settings.bridge.apps['no.app']);
  // postMessage pairing records the origin; a different origin is refused afterwards
  const tok = await grant('web.app', ['tasks:read']); S.settings.bridge.apps['web.app'].origins = ['https://good.example'];
  assert.equal((await A.bridgeCall({ app: 'web.app', token: tok, cmd: 'meta.list' }, { origin: 'https://good.example' })).ok, true); assert.equal((await A.bridgeCall({ app: 'web.app', token: tok, cmd: 'meta.list' }, { origin: 'https://evil.example' })).error.code, 'unauthorized');
}
{
  // URLs: parsing, x-callback replies, and which replies are allowed
  const A = makeApp(), { S } = A; A.__mock('openExternal', u => { A.opened = A.opened || []; A.opened.push(u); }); A.__mock('toast', m => { A.toasts = A.toasts || []; A.toasts.push(m); });
  let p = A.bridgeParseUrl('opentick://x-callback-url/tasks.add?app=my.app&token=T&title=Buy%20milk&x-success=other%3A%2F%2Fok&x-error=other%3A%2F%2Ferr'); assert.equal(p.cmd, 'tasks.add'); assert.equal(p.args.title, 'Buy milk'); assert.equal(p.app, 'my.app'); assert.equal(p.success, 'other://ok'); assert.equal(p.args.token, undefined);
  p = A.bridgeParseUrl('opentick://tasks.list?app=a&args=' + encodeURIComponent(J({ status: 'all', limit: 5 }))); assert.equal(p.cmd, 'tasks.list'); assert.equal(p.args.status, 'all'); assert.equal(p.args.limit, 5);
  p = A.bridgeParseUrl('web+opentick:tasks.add?app=a&title=x'); assert.equal(p.cmd, 'tasks.add'); assert.equal(A.bridgeParseUrl('https://example.com/tasks.add'), null); assert.equal(A.bridgeParseUrl('javascript:alert(1)'), null); assert.ok(A.bridgeParseUrl('opentick://tasks.list?args={bad').bad);
  p = A.bridgeParseUrl('opentick://x-callback-url/pair?app=a&name=Z&permissions=tasks:read,tasks:write'); assert.equal(J(p.args.permissions), J(['tasks:read', 'tasks:write']));
  for (const ok of ['myapp://done', 'https://example.com/cb', 'http://localhost:3000/cb', 'http://127.0.0.1/cb']) assert.equal(A.brCallbackOk(ok), true, ok);
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'blob:x', 'http://example.com/cb', 'ftp://x', 'not a url', '']) assert.equal(A.brCallbackOk(bad), false, bad);
  S.settings.bridge.on = true; const tok = 'T1'; S.settings.bridge.apps['my.app'] = { name: 'My', hash: await A.brHash(tok), perms: ['tasks:write'], at: 0, used: 0, origins: [] };
  const res = await A.bridgeHandleUrl(`opentick://x-callback-url/tasks.add?app=my.app&token=${tok}&title=Via%20URL&x-success=other%3A%2F%2Fok`); assert.equal(res.ok, true); assert.ok(S.tasks.some(t => t.title === 'Via URL'));
  const back = new URL(A.opened.pop()); assert.equal(back.protocol, 'other:'); assert.equal(back.searchParams.get('ok'), '1'); assert.equal(JSON.parse(back.searchParams.get('result')).task.title, 'Via URL');
  await A.bridgeHandleUrl(`opentick://tasks.list?app=my.app&token=${tok}&x-error=other%3A%2F%2Ffail`); const fail = new URL(A.opened.pop()); assert.equal(fail.searchParams.get('ok'), '0'); assert.equal(fail.searchParams.get('errorCode'), 'forbidden');
  const n = A.opened.length; await A.bridgeHandleUrl(`opentick://tasks.list?app=my.app&token=${tok}&x-error=javascript%3Aalert(1)`); assert.equal(A.opened.length, n, 'a reply is never sent to javascript:');
  assert.equal(await A.bridgeHandleUrl('https://example.com'), false);
  // OpenTick → another app: the template
  S.settings.bridge.openUrl = 'focusapp://start?task={id}&title={title}&min={minutes}&tags={tags}'; const task = A.newTask({ title: 'Write & ship', tags: ['a', 'b'], dur: 50 }); S.tasks.push(task);
  assert.equal(A.brOpenUrl(task), `focusapp://start?task=${task.id}&title=Write%20%26%20ship&min=50&tags=a%2Cb`); assert.equal(A.brSendable(), true);
  S.settings.bridge.openUrl = 'javascript:alert({title})'; assert.equal(A.brOpenUrl(task), ''); assert.equal(A.brSendable(), false); S.settings.bridge.openUrl = '';
  // the settings tab shows apps without leaking tokens
  S.settings.bridge.apps['my.app'].hash = 'SECRETHASH'; assert.ok(!A.bridgeSettingsHtml().includes('SECRETHASH')); assert.match(A.bridgeSettingsHtml(), /Disconnect/);
}

/* ============ 6. pages render, with and without data; the layout ============ */
{
  const A = makeApp(), { S, U } = A;
  for (const p of ['countdowns', 'zones', 'kanban']) { U.page = p; A.renderMain(); }
  S.countdowns.push(A.cdNormalise({ id: 'z', name: 'Z', date: '2026-12-25' })); S.zones.push(A.tzNewZone({ name: 'Tokyo', tz: 'Asia/Tokyo' })); S.boards.push(A.kbNewBoard('B', 0));
  for (const p of ['countdowns', 'zones', 'kanban']) { U.page = p; A.renderMain(); }
  assert.equal(S.settings.ui.density, 'roomy', 'roomy spacing is the default'); assert.equal(S.settings.ui.autoDetail, true);
  const old = A.migrate({ tasks: [], lists: [], settings: { ui: { compact: true } } }); assert.equal(old.settings.ui.density, 'compact', 'the old compact switch carries over');
  assert.equal(A.migrate({ tasks: [], lists: [], settings: { ui: { density: 'standard' } } }).settings.ui.density, 'standard');
  assert.ok(A.pagesShown().some(p => p[0] === 'kanban') && A.pagesShown().some(p => p[0] === 'countdowns') && A.pagesShown().some(p => p[0] === 'zones'));
  // a corrupt store with junk in the new collections still loads
  const junk = A.migrate({ tasks: [], lists: [], countdowns: [null, 5, { id: 'q', date: 7 }], zones: 'x', boards: [{ id: 'b', cols: 'no' }] }); assert.equal(junk.countdowns.length, 1); assert.equal(junk.zones.length, 0); assert.equal(junk.boards[0].cols.length, 2);
  // the timetable shows a second zone, and a task planned in another zone shows it
  S.settings.tt.tz2 = 'Asia/Tokyo'; U.page = 'timetable'; A.renderMain();
  const t = A.newTask({ title: 'Call', due: '2026-10-08', time: '14:00', tz: 'America/New_York' }); assert.match(A.metaX(t), /New York/); assert.ok(A.metaX({ ...t, tz: 'Mars/Base' }) !== undefined);
}
/* ============ 7. the timetable widget: weeks ahead never fail ============ */
{
  const A = makeApp(), tt = A.wgTt();
  assert.equal(tt.n, 28); assert.equal(tt.days.length, 28, 'four weeks of days are handed to the widget');
  for (const d of tt.days) assert.ok(Array.isArray(d.items) && typeof d.d === 'string', 'every day is complete');
  const snap = A.widgetSnapshot(); assert.equal(snap.tt.days.length, 28); assert.doesNotThrow(() => JSON.stringify(snap));
  // a broken record must not take the widget down: the day is empty, the rest still drawn
  A.S.tasks.push({ id: 'junk', title: null, due: '2026-10-20', time: '10:00', dur: 'x', status: 'open', tags: null });
  assert.doesNotThrow(() => A.wgTt());
}
/* ============ 8. tasks planned in another zone keep their moment when you travel ============ */
{
  const A = makeApp(), { S } = A, J = JSON.stringify;
  assert.equal(A.tzLocal(), 'UTC');
  const t = A.newTask({ title: 'Call NY', due: '2026-10-09', time: '09:00', tz: 'America/New_York' }); S.tasks.push(t); A.save(); A.flush();
  assert.equal(t.zd, '2026-10-09'); assert.equal(t.zt, '05:00', '09:00 in London/UTC is 05:00 in New York (EDT): that is the anchor'); assert.ok(A.tzAnchored(t));
  // reminders use the anchor, not whatever local time was last worked out
  const base = A.remEntries; A.remsSet(t, [0]); let es = A.remEntries(clock.t, clock.t + 3 * 864e5).filter(e => e.id === t.id); assert.equal(es[0].at, Date.UTC(2026, 9, 9, 9));
  // the device moves to Tokyo (UTC+9): the same moment reads 18:00 there; nothing is stamped as an edit
  A.flush(); const u0 = t.u; process.env.TZ = 'Asia/Tokyo'; assert.equal(A.tzLocal(), 'Asia/Tokyo');
  A.tzWatch(); assert.equal(t.time, '18:00'); assert.equal(t.due, '2026-10-09'); A.flush(); assert.equal(t.u, u0, 'a zone change is not an edit, so nothing to sync');
  assert.equal(t.zt, '05:00', 'the anchor did not move'); es = A.remEntries(clock.t, clock.t + 3 * 864e5).filter(e => e.id === t.id); assert.equal(es[0].at, Date.UTC(2026, 9, 9, 9), 'the reminder is still the same moment');
  // an edit in Tokyo moves the anchor and is synced
  clock.t += 5000; t.time = '19:00'; A.save(); A.flush(); assert.equal(t.zt, '06:00', '19:00 Tokyo = 10:00 UTC = 06:00 New York'); assert.ok(t.u > u0, 'a real edit is stamped');
  // another device (still in UTC) receives it: due / time are worked out for its own clock
  process.env.TZ = 'UTC'; const rec = JSON.parse(J(t)); rec.due = '2026-10-09'; rec.time = '19:00'; // what Tokyo wrote
  const B = makeApp(); B.S.tasks.length = 0; const merged = B.mergeData(B.snapshot(), { ...B.snapshot(), tasks: [rec] }); B.applyMerged(merged);
  const bt = B.S.tasks.find(x => x.id === t.id); assert.equal(bt.time, '10:00', 'UTC reads the same moment as 10:00'); assert.equal(bt.u, rec.u);
  // the fingerprint of an anchored task ignores due / time, so two zones never fight
  const h1 = J({ ...rec, due: 'x', time: 'y' }, function (k, v) { return v; }); assert.notEqual(h1, J(rec));
  // untouched tasks and all-day tasks are left alone; clearing the zone clears the anchor
  const plain = A.newTask({ title: 'plain', due: '2026-10-09', time: '08:00' }), allday = A.newTask({ title: 'allday', due: '2026-10-09', tz: 'Asia/Tokyo' }); S.tasks.push(plain, allday); A.save(); A.flush();
  assert.equal(plain.zd, undefined); assert.equal(allday.zd, undefined); delete t.tz; A.save(); A.flush(); assert.equal(t.zd, undefined, 'no zone, no anchor');
  // a repeating task keeps the zone's own time across a daylight-saving change (NY ends DST on 1 Nov 2026)
  const r = A.newTask({ title: 'Daily NY', due: '2026-10-31', time: '09:00', tz: 'America/New_York', repeat: { unit: 'day', every: 1 } }); S.tasks.push(r); A.save(); A.flush(); assert.equal(r.zt, '05:00');
  A.toggleDone(r); A.flush(); assert.equal(r.due, '2026-11-01'); assert.equal(r.zt, '05:00', 'still 05:00 in New York'); assert.equal(r.time, '10:00', 'so 10:00 here once New York is on winter time');
  // the picker offers saved zones and the current one
  S.zones.push(A.tzNewZone({ name: 'Tokyo', tz: 'Asia/Tokyo' })); const o = A.tzTaskOptions({ tz: 'Europe/Paris' }).map(x => x[0]); assert.ok(o.includes('Asia/Tokyo') && o.includes('Europe/Paris') && o.includes('') && o.includes('__more'));
  // a bad zone name never breaks saving
  const bad = A.newTask({ title: 'bad', due: '2026-10-09', time: '08:00', tz: 'Mars/Base', zd: '2026-10-09', zt: '08:00' }); S.tasks.push(bad); assert.doesNotThrow(() => { A.save(); A.flush(); });
}
{
  // 9. the countdowns mini-widget (desktop window body and the Android snapshot)
  const A = makeApp(), { S } = A, now = clock.t;
  assert.ok(A.WG_KINDS.some(k => k[0] === 'countdowns'), 'the desktop widget list has Countdowns');
  const d = n => A.ymd(new Date(now + n * 864e5));
  S.countdowns.push(A.cdNormalise({ id: 'w1', name: 'Trip', date: d(12), color: '#ff8800' }), A.cdNormalise({ id: 'w2', name: 'Call', date: d(1), time: '09:00', tz: 'America/New_York' }),
    A.cdNormalise({ id: 'w3', name: 'Gone', date: d(-5) }), A.cdNormalise({ id: 'w4', name: 'Old', date: d(3), archived: true }));
  const snap = A.wgCountdowns(); assert.equal(snap.map(x => x.id).join(), 'w2,w1', 'soonest first, past and archived left out');
  assert.equal(snap[0].at, A.cdLeft(S.countdowns[1], now).at); assert.equal(snap[1].w, true); assert.equal(snap[1].d, d(12)); assert.equal(snap[0].z, 'America/New_York'); assert.equal(snap[1].c, '#ff8800');
  for (let i = 0; i < 12; i++) S.countdowns.push(A.cdNormalise({ id: 'm' + i, name: 'M' + i, date: d(20 + i) })); assert.equal(A.wgCountdowns().length, 8, 'at most 8 go to the widget');
  const ws = A.widgetSnapshot(); assert.ok(Array.isArray(ws.cd) && ws.cd.length === 8, 'the snapshot carries cd');
  const body = A.wgBody('countdowns'); assert.equal(body.title, 'Countdowns'); assert.match(body.html, /Trip/); assert.doesNotMatch(body.html, /Gone/);
  S.countdowns.length = 0; assert.match(A.wgBody('countdowns').html, /No countdowns yet/); assert.equal(A.wgCountdowns().length, 0);
}
console.log('0.6 feature tests passed (time zones, countdowns, boards, sync + encryption, bridge)');
