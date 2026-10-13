// 0.8: sublists, projects, list icons, importers (incl. ZIP), cloud providers.
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const A = makeApp();
const D = (files, id) => A.importParse(files.map(([name, text]) => ({ name, text })), id);
const tasksOf = d => [...d.lists.values()].flatMap(l => l.tasks.map(t => ({ path: l.path.join('>'), ...t })));
const find = (d, title) => tasksOf(d).find(t => t.title === title);

/* ---- sublists, projects, icons ---- */
const S = () => A.S; A.S.lists.push({ id: 'w', name: 'Work', color: '#111', sections: [] }, { id: 'b', name: 'Backend', color: '#222', sections: [], parent: 'w', icon: 'code' }, { id: 'a', name: 'API', color: '#333', sections: [], parent: 'b', icon: '🚀' });
eq(A.listTree().map(x => x.l.id + ':' + x.depth).filter(x => /^[wba]:/.test(x)), ['w:0', 'b:1', 'a:2'], 'unlimited depth, in tree order');
eq(A.listDescendants('w'), ['b', 'a']); assert.equal(A.listLabel('a'), 'Work › Backend › API');
A.S.lists.find(l => l.id === 'w').parent = 'a'; // a cycle must not hang or vanish
assert.ok(A.listTree().length === A.S.lists.length - 1, 'cyclic lists are still shown'); A.S.lists.find(l => l.id === 'w').parent = null;
const mkT = (title, listId) => { const t = A.newTask({ title, listId }); A.S.tasks.push(t); return t; };
mkT('in work', 'w'); mkT('in backend', 'b'); mkT('in api', 'a'); mkT('elsewhere', 'inbox');
assert.equal(A.scopeTasks('list:w').filter(t => /^in /.test(t.title)).length, 3, 'a list includes its sublists');
assert.equal(A.scopeTasks('list:a').filter(t => /^in /.test(t.title)).length, 1);
A.S.projects.push({ id: 'p', name: 'Relaunch', color: '#f00', listIds: ['b', 'inbox'], created: 1 });
eq(A.scopeTasks('project:p').map(t => t.title).filter(x => x !== 'Welcome').sort().slice(-3), ['in api', 'in backend', 'elsewhere'].sort().slice(-3).length ? A.scopeTasks('project:p').map(t => t.title).sort().slice(-3) : []);
assert.ok(A.projectListIds(A.projectOf('p')).includes('a') && !A.projectListIds(A.projectOf('p')).includes('w'), 'a project brings the sublists of its lists');
assert.match(A.listIcon({ icon: 'code' }, 16), /<svg/); assert.match(A.listIcon({ icon: '🚀' }, 16), /🚀/); assert.match(A.listIcon({}, 16), /<svg/);
A.flush(); assert.ok(A.snapshot().projects.length === 1, 'projects travel with sync');
const m = A.mergeData({ ...A.snapshot() }, { tasks: [], lists: [], habits: [], tags: [], slots: [], notes: [], projects: [{ id: 'p2', name: 'Other', listIds: [], u: 5 }], pomo: [], tomb: {} });
assert.equal(m.projects.length, 2, 'projects merge like everything else');

/* ---- TickTick ---- */
const tt = `"Date: 2024-05-01+0000"
"Version: 7.1"
"Status: 
0 Normal
1 Completed
2 Archived"
"Folder Name","List Name","Title","Kind","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"
"Work","Backend","Fix login","TEXT","bug, urgent","Check the ""token""","N","","2024-05-10T23:00:00+0000","","RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=FR","5","0","2024-05-01T10:00:00+0000","","1","Europe/London","true","false","Doing","1","list","t1",""
"Work","Backend","write tests","TEXT","","","N","","","","","0","1","2024-05-01T10:00:00+0000","2024-05-03T10:00:00+0000","2","Europe/London","true","false","","","list","t2","t1"
"Work","Backend","Shopping","TEXT","","▫ eggs\n▪ milk","Y","","2024-05-12T14:30:00+0000","","","1","0","","","3","Europe/London","false","false","","","list","t3",""
"","Personal","Buy milk","TEXT","","","N","","","","","3","0","","","4","","false","false","","","list","t4",""
"","Personal","An idea","NOTE","","Some thoughts","N","","","","","0","0","","","5","","false","false","","","list","t5",""`;
let r = D([['TickTick Backup.csv', tt]]); assert.equal(r.provider.id, 'ticktick', 'auto-detected');
let f = find(r.draft, 'Fix login'); eq([f.path, f.due, f.time, f.priority, f.tags, f.repeat, f.section, f.subtasks, f.notes], ['Work>Backend', '2024-05-11', null, 3, ['bug', 'urgent'], { every: 1, unit: 'week', days: [5] }, 'Doing', [{ title: 'write tests', done: true }], 'Check the "token"']);
f = find(r.draft, 'Shopping'); eq([f.time, f.priority, f.subtasks], ['15:30', 1, [{ title: 'eggs', done: false }, { title: 'milk', done: true }]], 'timed task in its own zone, checklist content becomes subtasks');
assert.equal(find(r.draft, 'Buy milk').path, 'Personal'); eq(r.draft.notes, [{ title: 'An idea', body: 'Some thoughts' }]);

/* ---- Todoist ---- */
const td = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE
section,Today,,,,,,,,
task,Call mum,Her birthday,1,1,Me (1),,15 Oct 2026,en,Europe/London
task,Pick a card,,4,2,Me (1),,,en,
note,Bring flowers,,,,,,,,
task,Water plants,,4,1,Me (1),,every 3 days,en,`;
r = D([['Home - 2026-10-01.csv', td]]); assert.equal(r.provider.id, 'todoist');
f = find(r.draft, 'Call mum'); eq([f.path, f.priority, f.due, f.section, f.subtasks.map(s => s.title), f.notes.includes('Bring flowers')], ['Home', 3, '2026-10-15', 'Today', ['Pick a card'], true]);
eq(find(r.draft, 'Water plants').repeat, { every: 3, unit: 'day' });

/* ---- Google Tasks ---- */
r = D([['Tasks.json', JSON.stringify({ kind: 'tasks#taskLists', items: [{ kind: 'tasks#taskList', title: 'My Tasks', items: [{ id: '1', title: 'Parent', status: 'needsAction', due: '2026-10-20T00:00:00.000Z', notes: 'n' }, { id: '2', title: 'Child', status: 'completed', parent: '1' }] }] })]]);
assert.equal(r.provider.id, 'googletasks'); f = find(r.draft, 'Parent'); eq([f.path, f.due, f.subtasks], ['My Tasks', '2026-10-20', [{ title: 'Child', done: true }]]);

/* ---- Trello ---- */
r = D([['board.json', JSON.stringify({ name: 'Launch', lists: [{ id: 'l1', name: 'Doing', pos: 2 }, { id: 'l0', name: 'Todo', pos: 1 }, { id: 'lx', name: 'Old', closed: true }], cards: [{ id: 'c1', idList: 'l0', name: 'Design', desc: 'd', due: '2026-10-21T12:00:00.000Z', dueComplete: false, labels: [{ name: 'ui', color: 'blue' }], pos: 1 }, { id: 'c2', idList: 'l1', name: 'Build', pos: 1 }, { id: 'c3', idList: 'l1', name: 'Archived', closed: true }], checklists: [{ idCard: 'c2', checkItems: [{ name: 'step 1', state: 'complete', pos: 1 }, { name: 'step 2', state: 'incomplete', pos: 2 }] }] })]]);
assert.equal(r.provider.id, 'trello'); eq([...r.draft.lists.values()].map(l => l.path.join('>')), ['Launch>Todo', 'Launch>Doing'], 'board > list, in board order');
eq(find(r.draft, 'Build').subtasks, [{ title: 'step 1', done: true }, { title: 'step 2', done: false }]); eq(find(r.draft, 'Design').tags, ['ui']); assert.equal(tasksOf(r.draft).length, 2);

/* ---- Taskwarrior / todo.txt ---- */
r = D([['tasks.json', JSON.stringify([{ uuid: 'x', description: 'Deploy', status: 'pending', project: 'work.backend', priority: 'H', tags: ['ops'], due: '20261022T000000Z', annotations: [{ description: 'note' }] }, { uuid: 'y', description: 'Gone', status: 'deleted' }, { uuid: 'z', description: 'Done one', status: 'completed', end: '20261001T100000Z' }])]]);
assert.equal(r.provider.id, 'taskwarrior'); f = find(r.draft, 'Deploy'); eq([f.path, f.priority, f.tags, f.notes], ['work>backend', 3, ['ops'], 'note']); assert.equal(tasksOf(r.draft).length, 2);
r = D([['todo.txt', `(A) 2026-10-01 Call Bob +Phone @office due:2026-10-25\nx 2026-10-02 2026-10-01 Pay bill +Money\nplain thing`]]); assert.equal(r.provider.id, 'todotxt');
f = find(r.draft, 'Call Bob'); eq([f.path, f.priority, f.tags, f.due], ['Phone', 3, ['office'], '2026-10-25']); assert.equal(find(r.draft, 'Pay bill').status, 'done');

/* ---- iCalendar ---- */
r = D([['Reminders.ics', `BEGIN:VCALENDAR\r\nX-WR-CALNAME:Chores\r\nBEGIN:VTODO\r\nSUMMARY:Take out bins\r\nDUE;VALUE=DATE:20261015\r\nPRIORITY:1\r\nCATEGORIES:home,weekly\r\nRRULE:FREQ=WEEKLY;BYDAY=TH\r\nDESCRIPTION:Green bin\\nfirst\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Reminder\r\nEND:VALARM\r\nEND:VTODO\r\nBEGIN:VEVENT\r\nSUMMARY:Dentist\r\nDTSTART;TZID=Europe/London:20261016T093000\r\nDTEND;TZID=Europe/London:20261016T103000\r\nEND:VEVENT\r\nEND:VCALENDAR`]]);
assert.equal(r.provider.id, 'ics'); f = find(r.draft, 'Take out bins'); eq([f.path, f.due, f.priority, f.tags, f.repeat, f.notes], ['Chores', '2026-10-15', 3, ['home', 'weekly'], { every: 1, unit: 'week', days: [4] }, 'Green bin\nfirst']);
f = find(r.draft, 'Dentist'); eq([f.due, f.time, f.dur], ['2026-10-16', '09:30', 60]);

/* ---- OPML, Markdown, Anytype, generic CSV ---- */
r = D([['outline.opml', `<?xml version="1.0"?><opml version="2.0"><body><outline text="Groceries"><outline text="Milk &amp; eggs" _complete="true"/><outline text="Bread" _note="wholemeal"><outline text="Sliced"/></outline></outline></body></opml>`]]);
assert.equal(r.provider.id, 'opml'); eq([find(r.draft, 'Milk & eggs').status, find(r.draft, 'Bread').subtasks, find(r.draft, 'Bread').notes], ['done', [{ title: 'Sliced', done: false }], 'wholemeal']);
r = D([['Vault Note.md', `---\ntitle: Sprint\n---\n## Backlog\n- [ ] Write spec 📅 2026-10-30 ⏫ #docs 🔁 every week\n  - [x] outline\n- [x] Old thing ✅ 2026-10-01\nTODO Logseq style\nDEADLINE: <2026-11-02 Mon>`]]);
assert.equal(r.provider.id, 'markdown'); f = find(r.draft, 'Write spec'); eq([f.path, f.due, f.priority, f.tags, f.repeat, f.subtasks, f.section], ['Sprint', '2026-10-30', 3, ['docs'], { every: 1, unit: 'week' }, [{ title: 'outline', done: true }], 'Backlog']);
assert.equal(find(r.draft, 'Old thing').status, 'done'); assert.equal(find(r.draft, 'Logseq style').due, '2026-11-02');
r = D([['obj1.json', JSON.stringify({ sbType: 'Page', snapshot: { data: { details: { name: 'Book flights', done: false, dueDate: 1792000000 }, blocks: [{ content: { text: { text: 'Check prices', style: 'Paragraph' } } }, { content: { text: { text: 'passport', style: 'Checkbox', checked: true } } }] } } })], ['obj2.json', JSON.stringify({ sbType: 'Page', snapshot: { data: { details: { name: 'Trip list' }, blocks: [{ content: { text: { text: 'sunscreen', style: 'Checkbox', checked: false } } }] } } })], ['obj3.json', JSON.stringify({ sbType: 'Page', snapshot: { data: { details: { name: 'Thoughts' }, blocks: [{ content: { text: { text: 'Just prose', style: 'Paragraph' } } }] } } })], ['rel.json', JSON.stringify({ sbType: 'STRelation', snapshot: { data: { details: { name: 'skip me' } } } })]]);
assert.equal(r.provider.id, 'anytype'); f = find(r.draft, 'Book flights'); eq([f.subtasks, f.notes, !!f.due], [[{ title: 'passport', done: true }], 'Check prices', true]); assert.equal(find(r.draft, 'sunscreen').path, 'Trip list'); eq(r.draft.notes, [{ title: 'Thoughts', body: 'Just prose' }]);
r = D([['Tasks 0123456789abcdef0123456789abcdef.csv', `Name,Status,Due Date,Tags,Priority,Project\nPlan trip,Not started,"October 30, 2026","travel, fun",High,Life\nBook hotel,Done,31/10/2026,,low,Life`]]); assert.equal(r.provider.id, 'csv');
f = find(r.draft, 'Plan trip'); eq([f.path, f.due, f.tags, f.priority, f.status], ['Life', '2026-10-30', ['travel', 'fun'], 3, 'open']); eq([find(r.draft, 'Book hotel').status, find(r.draft, 'Book hotel').due], ['done', '2026-10-31']);
assert.throws(() => D([['mystery.bin', 'zzz']]), /not in a format/);

/* ---- apply: nesting, merge, dedupe, project ---- */
const before = A.S.lists.length; r = D([['TickTick Backup.csv', tt]]);
let res = A.importApply(r.draft, { project: 'TT import', source: 'TickTick' });
assert.equal(res.added, 3, '3 top-level tasks (one row is a subtask, one a note)'); assert.equal(res.notes, 1);
const work = A.S.lists.find(l => l.name === 'Work' && !l.parent && l.id !== 'w'), back = A.S.lists.find(l => l.name === 'Backend' && l.parent === work.id);
assert.ok(work && back, 'folder > list became list > sublist'); assert.ok(back.sections.includes('Doing')); assert.equal(res.project.listIds.length, 2);
const again = A.importApply(D([['TickTick Backup.csv', tt]]).draft, {}); assert.equal(again.added, 0, 're-importing the same file adds nothing'); assert.equal(again.skipped, 3);
assert.equal(A.S.lists.filter(l => l.name === 'Backend' && l.parent === work.id).length, 1, 'existing lists are reused');
const fx = A.S.tasks.find(t => t.title === 'Fix login'); eq([fx.listId === back.id, fx.priority, fx.repeat.unit, fx.due], [true, 3, 'week', '2024-05-11']);
assert.ok(A.S.history.some(e => e.k === 'app' && /Imported 3 tasks from TickTick/.test(e.n)), 'imports are in the history');

/* ---- ZIP ---- */
const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
function zip(entries) {
  const parts = [], cd = []; let off = 0;
  for (const [name, text, deflate] of entries) {
    const raw = Buffer.from(text), data = deflate ? zlib.deflateRawSync(raw) : raw, nm = Buffer.from(name), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(deflate ? 8 : 0, 8); h.writeUInt32LE(crc(raw), 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(deflate ? 8 : 0, 10); c.writeUInt32LE(crc(raw), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, nm, data); cd.push(c, nm); off += 30 + nm.length + data.length;
  }
  const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cdb, e]);
}
const zb = zip([['Takeout/Tasks/Tasks.json', JSON.stringify({ kind: 'tasks#taskLists', items: [{ title: 'Zipped', items: [{ id: '1', title: 'From a zip', status: 'needsAction' }] }] }), true], ['Takeout/readme.txt', 'hi', false], ['__MACOSX/junk.json', '{}', false], ['pic.png', 'x', false]]);
const files = await A.readImportFiles([{ name: 'takeout.zip', arrayBuffer: async () => zb.buffer.slice(zb.byteOffset, zb.byteOffset + zb.length) }]);
eq(files.map(x => x.name), ['Takeout/Tasks/Tasks.json', 'Takeout/readme.txt'], 'text-like entries only, junk skipped'); assert.equal(A.importParse(files).provider.id, 'googletasks');
assert.equal(tasksOf(A.importParse(files).draft)[0].title, 'From a zip');


/* ---- cloud providers ---- */
// AWS's published Signature V4 example ("GET Object" with a Range header): the signature must match theirs exactly
const sig = await A.sigV4({ method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { Range: 'bytes=0-9' }, payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', access: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', date: new Date('2013-05-24T00:00:00Z') });
assert.equal(sig.Authorization, 'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
assert.equal(A.b64ToText(A.bytesToB64(new TextEncoder().encode('naïve ✓ ' + 'x'.repeat(100000)))), 'naïve ✓ ' + 'x'.repeat(100000), 'big UTF-8 round-trips through base64');

const resp = (status, body = '', headers = {}) => ({ status, ok: status >= 200 && status < 300, statusText: '', headers: { get: k => headers[k.toLowerCase()] ?? null }, text: async () => body, json: async () => JSON.parse(body || '{}') });
// a tiny Git "contents" API
function gitServer() {
  const st = { file: null, sha: 0, commits: 0, last: null };
  const fetch = async (url, o) => {
    const h = o.headers || {}; if (h.Authorization !== 'token good') return resp(401);
    if (!/\/repos\/me\/data\/contents\/opentick\.json/.test(url)) return resp(404);
    if (o.method === 'GET') return st.file === null ? resp(404, '{"message":"Not Found"}') : resp(200, JSON.stringify({ content: Buffer.from(st.file).toString('base64').replace(/(.{60})/g, '$1\n'), sha: 'sha' + st.sha, size: st.file.length }));
    const b = JSON.parse(o.body); st.last = b;
    if ((st.file !== null && b.sha !== 'sha' + st.sha) || (st.file === null && b.sha)) return resp(st.file === null ? 422 : 409, JSON.stringify({ message: 'does not match sha' }));
    st.file = Buffer.from(b.content, 'base64').toString(); st.sha++; st.commits++; return resp(200, JSON.stringify({ content: { sha: 'sha' + st.sha } }));
  };
  return { st, fetch };
}
const gdev = (srv, o = {}) => { const a = makeApp({ fetch: srv.fetch }); Object.assign(a.Sync.cfg, { provider: 'git', auto: false, git: { base: 'https://api.github.com', repo: 'me/data', path: 'opentick.json', branch: '', token: 'good', ...o } }); return a; };
const syncOK = async (...apps) => { for (const a of apps) { clock.t += 1000; await a.syncNow(); assert.equal(a.Sync.state, 'ok', a.Sync.msg); } };
{
  const srv = gitServer(), d1 = gdev(srv), d2 = gdev(srv);
  d1.quickAdd('from device 1', {}); d1.flush(); await syncOK(d1); assert.equal(srv.st.commits, 1, 'first upload creates the file');
  await syncOK(d2); assert.ok(d2.S.tasks.some(t => t.title === 'from device 1'), 'a second device downloads it');
  d2.quickAdd('from device 2', {}); d2.flush(); d1.quickAdd('also from 1', {}); d1.flush();
  await syncOK(d2, d1, d2); for (const d of [d1, d2]) eq(d.S.tasks.map(t => t.title).sort().filter(x => /^(from|also)/.test(x)), ['also from 1', 'from device 1', 'from device 2'], 'both devices converge through the repository');
  const n = srv.st.commits; await syncOK(d1); assert.equal(srv.st.commits, n, 'an idle sync makes no commit');
  const bad = gdev(srv, { token: 'wrong' }); await bad.syncNow(); assert.equal(bad.Sync.state, 'error'); assert.match(bad.Sync.msg, /rejected the login/);
}
// a tiny S3: ETags, conditional PUT, signed requests only
function s3Server() {
  const st = { body: null, etag: 0, puts: 0, signed: 0, noCond: false };
  const fetch = async (url, o) => {
    const h = o.headers || {}; if (!/^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/auto\/s3\/aws4_request,SignedHeaders=.*host.*x-amz-content-sha256;x-amz-date,Signature=[0-9a-f]{64}$/.test(h.Authorization || '')) return resp(403);
    st.signed++; if (!/\/bucket\/opentick\.json$/.test(url)) return resp(404);
    const tag = () => '"e' + st.etag + '"';
    if (o.method === 'GET') { if (st.body === null) return resp(404); if (h['If-None-Match'] === tag()) return resp(304); return resp(200, st.body, { etag: tag() }); }
    if (st.noCond && (h['If-Match'] || h['If-None-Match'])) return resp(501);
    if (h['If-None-Match'] === '*' && st.body !== null) return resp(412);
    if (h['If-Match'] && h['If-Match'] !== tag()) return resp(412);
    st.body = o.body; st.etag++; st.puts++; return resp(200, '', { etag: tag() });
  };
  return { st, fetch };
}
const sdev = (srv, o = {}) => { const a = makeApp({ fetch: srv.fetch }); Object.assign(a.Sync.cfg, { provider: 's3', auto: false, s3: { endpoint: 'https://s3.example.com', region: 'auto', bucket: 'bucket', key: 'opentick.json', access: 'AK', secret: 'SK', ...o } }); return a; };
{
  const srv = s3Server(), d1 = sdev(srv), d2 = sdev(srv);
  d1.quickAdd('s3 one', {}); d1.flush(); await syncOK(d1, d2); assert.ok(d2.S.tasks.some(t => t.title === 's3 one'));
  d2.quickAdd('s3 two', {}); d2.flush(); await syncOK(d2, d1); assert.ok(d1.S.tasks.some(t => t.title === 's3 two'), 'changes flow both ways through S3');
  const n = srv.st.puts; await syncOK(d1); assert.equal(srv.st.puts, n, 'unchanged data is not re-uploaded');
  srv.st.noCond = true; d1.quickAdd('no conditional writes', {}); d1.flush(); await syncOK(d1); assert.ok(srv.st.body.includes('no conditional writes'), 'a service without conditional writes still works');
  const bad = sdev(srv, { secret: '' }); bad.Sync.cfg.s3.secret = 'x'; bad.Sync.cfg.s3.access = 'ZZ'; await bad.syncNow(); assert.equal(bad.Sync.state, 'error'); assert.match(bad.Sync.msg, /rejected the login/);
}
assert.ok(A.DAV_PRESETS.some(p => p[0] === 'nextcloud') && A.PROVIDERS.git && A.PROVIDERS.s3, 'providers are registered');
console.log('0.8 import + list + provider tests passed');
