// 0.8.0: the sidebar fixes (the Calendar button, the lit button, one order for pins and sections), Contacts (details, available hours, links,
// mentions, quick-add, teachers), custom sections and packs. Contacts and custom sections are synced collections: syncall.mjs puts them
// through the encrypted sync file; this file covers what they do.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const nb = x => String(x).replace(/[\u00a0\u202f]/g, ' '); // times use a non-breaking space before AM/PM
const base0 = () => ({ tasks: [], lists: [], tags: [], habits: [], slots: [], notes: [], projects: [], school: [], templates: [], countdowns: [], zones: [], boards: [], pomo: [], tomb: {} });

/* ============ 1. the sidebar ============ */
{
  const A = makeApp(), { S, U } = A;
  eq(A.sectionsShown().map(s => s[0]), ['home', 'tasks', 'notes', 'calendar', 'habits', 'contacts'], 'Contacts is a section of its own, last');
  assert.ok(A.pagesShown().some(p => p[0] === 'contacts'));
  assert.equal(A.secOf('contacts'), 'contacts');

  // Calendar and Classes are two buttons that share one page: pressing Calendar from Classes opens the Calendar, and lights Calendar
  S.settings.tt.mode = 'school'; U.page = 'timetable'; U.pinKey = null; A.render();
  A.ACT.page({ dataset: { page: 'timetable', sec: 'calendar' } });
  assert.equal(S.settings.tt.mode, 'plan', 'pressing Calendar leaves the Classes view');
  assert.equal(A.schoolOn(), false);
  const html = A.navHtml('side'), btn = k => (html.match(new RegExp(`<button class="pg( on)?"[^>]*data-sec="${k}"`)) || [])[1];
  assert.equal(btn('calendar'), ' on', 'the Calendar button is the lit one'); assert.equal(btn('tasks'), undefined);

  // ...also when the Calendar button lands on the Month page rather than the timetable
  S.settings.tt.mode = 'school'; U.page = 'timetable'; A.ACT.page({ dataset: { page: 'calendar', sec: 'calendar' } });
  assert.equal(U.page, 'calendar'); assert.equal(A.schoolOn(), false, 'the Classes layout is not left switched on behind the Calendar');
  // a pinned view only lights when its own button was pressed
  S.settings.ui.pins = ['school', 'page:kanban']; U.pinKey = null;
  A.ACT.page({ dataset: { page: 'timetable', sec: 'calendar' } });
  assert.equal(A.pinActive(), null); assert.ok(!/class="pg pin on"/.test(A.navHtml('side')), 'no pin is lit while you are in the Calendar');
  A.pinGo('school'); assert.equal(A.pinActive().key, 'school'); assert.equal(A.schoolOn(), true);
  { const h = A.navHtml('side'); assert.ok(/class="pg pin on"[^>]*data-pin="school"/.test(h), 'the pressed pin is lit'); assert.ok(!/class="pg on"[^>]*data-sec="calendar"/.test(h), 'and the Calendar is not'); }
  A.ACT.page({ dataset: { page: 'timetable', sec: 'calendar' } }); assert.equal(A.pinActive(), null); assert.equal(A.schoolOn(), false);
  // a pin that opens an ordinary page (Board) is lit as itself, and the section it belongs to (Tasks) stays quiet
  A.pinGo('page:kanban'); assert.equal(U.page, 'kanban'); assert.equal(U.pinKey, 'page:kanban', 'opening the page does not forget which pin was pressed'); assert.equal(A.pinActive().key, 'page:kanban');
  { const h = A.navHtml('side'); assert.ok(/class="pg pin on"[^>]*data-pin="page:kanban"/.test(h), 'the Board pin is lit'); assert.ok(!/class="pg on"[^>]*data-sec="tasks"/.test(h), 'and Tasks is not'); }
  A.ACT.page({ dataset: { page: 'kanban' } }); assert.equal(A.pinActive(), null, 'reaching the same page any other way lights the section instead');

  // pins and sections are one list, in one order, that can be changed from either side
  S.settings.ui.navOrder = []; const k0 = A.navKeys();
  eq(k0.slice(-2), ['pin:school', 'pin:page:kanban'], 'new pins start after the sections');
  assert.equal(A.navMove('pin:page:kanban', -1), true); assert.equal(A.navMove('pin:page:kanban', -1), true);
  const ks = A.navKeys(); assert.ok(ks.indexOf('pin:page:kanban') < ks.indexOf('sec:contacts'), 'a pin moved up past a section');
  A.navMove('sec:contacts', 1); // already last among the visible ones: pins follow, so it moves below them
  assert.ok(A.navKeys().indexOf('sec:contacts') > A.navKeys().indexOf('pin:school'), 'a section can sit below a pin');
  const order = A.navShown(); eq(A.navHtml('side').match(/data-nk="([^"]+)"/g).map(x => x.slice(9, -1)), order, 'the sidebar draws the stored order');
  eq(A.navHtml('bar').match(/data-nk="([^"]+)"/g).map(x => x.slice(9, -1)), order, 'and so does the phone tab bar');
  A.navReorder('pin:school', 'sec:habits'); assert.ok(A.navKeys().indexOf('pin:school') < A.navKeys().indexOf('sec:habits'), 'dragging a pin onto a section takes that section\'s place');
  eq(S.settings.ui.pins, ['school', 'page:kanban'].filter(k => S.settings.ui.pins.includes(k)).sort((a, b) => A.navKeys().indexOf('pin:' + a) - A.navKeys().indexOf('pin:' + b)), 'ui.pins keeps the pins in their order');
  // unknown, damaged and duplicate entries are ignored; a new section turns up by itself
  S.settings.ui.navOrder = ['pin:nope', 'sec:nope', 7, null, 'sec:notes', 'sec:notes', 'pin:school'];
  { const k = A.navKeys(); assert.equal(k.filter(x => x === 'sec:notes').length, 1); assert.ok(!k.includes('pin:nope') && !k.includes('sec:nope')); for (const s of ['home', 'tasks', 'notes', 'calendar', 'habits', 'contacts']) assert.ok(k.includes('sec:' + s), s + ' is still there'); }
  assert.ok(A.uiSidebarSettings().includes('data-m="xsnew"'), 'Settings → Layout has an Add a section button'); assert.doesNotThrow(() => { A.uiSidebarSettings(); A.render(); });
  // the saved setting is cleaned on load
  const m = A.migrate({ ...base0(), settings: { ui: { navOrder: ['sec:tasks', 'junk', 'pin:page:kanban', 5, 'sec:../x'] } } });
  eq(m.settings.ui.navOrder, ['sec:tasks', 'pin:page:kanban']);
}

/* ============ 2. contacts: details and available hours ============ */
{
  const A = makeApp(), { S, U } = A;
  const c = A.ctNormalise({ id: 'c1', name: ' Anna [Smith] ', nick: 'an na', role: 'Maths teacher', org: 'Northfield', email: 'anna@x.org', phone: '+44 7700 900123', tags: ['#Class', 'class', 'Tutor Group'], bday: '1990-02-30x',
    avail: { days: { 1: [['09:00', '12:00'], ['11:00', '13:00'], ['15:00', '16:00'], ['17:00', '16:00'], ['x', 'y']], 3: [['9:00', '10:00']], 9: [['09:00', '10:00']] }, note: 'Best by email' } });
  assert.equal(c.name, 'Anna Smith', 'brackets are taken out of names: they would break @[mentions]'); assert.equal(c.nick, 'anna');
  eq(c.emails, [{ l: '', v: 'anna@x.org' }], 'a single older email becomes a list'); eq(c.phones, [{ l: '', v: '+44 7700 900123' }]); assert.equal(c.email, undefined);
  eq(c.tags, ['class', 'tutor-group']); assert.equal(c.bday, '', 'a bad date is dropped');
  eq(c.avail.days[1], [['09:00', '13:00'], ['15:00', '16:00']], 'overlapping stretches join, backwards and unreadable ones go');
  eq(c.avail.days[3], [['09:00', '10:00']], 'H:MM becomes HH:MM'); assert.equal(c.avail.days[9], undefined); assert.equal(Object.keys(c.avail.days).length, 7);
  A.ctNormalise(c); eq(c.avail.days[1], [['09:00', '13:00'], ['15:00', '16:00']], 'normalising twice changes nothing');
  // a record from a newer or damaged file cannot throw
  for (const bad of [{ id: 'x' }, { id: 'x', avail: 5, emails: 'a', phones: [null, 3, {}], tags: 'a', extra: [{ v: 1 }] }, { id: 'x', avail: { days: { 1: 'x' } } }]) assert.doesNotThrow(() => A.ctNormalise(bad));
  S.contacts.push(c);

  // "available now" works from the clock. Hours are local time, so the clock is set to 10:00 local on Thursday 8 Oct 2026 whatever zone the tests run in
  const clock0 = clock.t; clock.t = new Date(2026, 9, 8, 10, 0, 0).getTime();
  assert.equal(A.ctAvail(c).state, 'off'); eq(A.ctAvail(c).next, { off: 4, dow: 1, start: '09:00' }); assert.equal(nb(A.ctAvailText(c)), 'Free Mon from 9:00 AM');
  c.avail.days[4] = [['09:30', '10:30']]; { const a = A.ctAvail(c); assert.equal(a.state, 'on'); assert.equal(a.until, '10:30'); assert.equal(nb(A.ctAvailText(c)), 'Available now · until 10:30 AM'); }
  c.avail.days[4] = [['11:00', '12:00']]; assert.equal(nb(A.ctAvailText(c)), 'Free today from 11:00 AM'); c.avail.days[4] = [['08:00', '09:00']]; assert.match(nb(A.ctAvailText(c)), /^Free (Mon|Wed)/, 'a stretch that already ended is not next');
  c.avail.days[4] = [['09:30', '10:00']]; assert.equal(A.ctAvail(c).state, 'off', 'the end of a stretch is not inside it');
  eq(A.ctAvail(A.ctNormalise({ id: 'n', name: 'N' })), { state: 'none' }); assert.equal(A.ctAvailText(A.ctNormalise({ id: 'n', name: 'N' })), '');
  // in their own time zone: it is 19:00 in Tokyo when it is 10:00 in London
  clock.t = Date.UTC(2026, 9, 8, 10, 0, 0); // (10:00 UTC is 19:00 in Tokyo on the same Thursday)
  const t = A.ctNormalise({ id: 'jp', name: 'Kenji', tz: 'Asia/Tokyo', avail: { days: { 4: [['18:00', '20:00']] } } }); assert.equal(t.tz, 'Asia/Tokyo');
  assert.equal(A.ctAvail(t).state, 'on', 'the hours are read in their zone'); assert.equal(A.ctNormalise({ id: 'z', name: 'Z', tz: 'Mars/Base' }).tz, '');
  // who is on the page
  c.avail.days = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, []])); c.avail.days[1] = [['09:00', '13:00']]; // (nobody else is free "now" in the list tests below)
  S.contacts.push(t, A.ctNormalise({ id: 'c2', name: 'Bob Jones', org: 'Acme', fav: true, tags: ['client'] }));
  U.page = 'contacts'; assert.doesNotThrow(() => A.render());
  const main = () => A.els['#main'].innerHTML;
  for (const n of ['Anna Smith', 'Kenji', 'Bob Jones']) assert.ok(main().includes(n), n + ' is listed');
  assert.ok(/Favourites/.test(main()) && /Everyone else/.test(main()), 'favourites and the rest are grouped');
  S.settings.ct.filter = 'fav'; eq(A.ctVisible().map(x => x.id), ['c2']); S.settings.ct.filter = 'now'; eq(A.ctVisible().map(x => x.id), ['jp']); S.settings.ct.filter = 'tag:client'; eq(A.ctVisible().map(x => x.id), ['c2']);
  S.settings.ct.filter = 'all'; U.ctQ = 'northfield'; eq(A.ctVisible().map(x => x.id), ['c1'], 'search looks at the organisation'); U.ctQ = 'anna@x'; eq(A.ctVisible().map(x => x.id), ['c1'], 'and emails'); U.ctQ = 'zzz'; assert.equal(A.ctVisible().length, 0);
  assert.ok(/Nobody matches/.test((A.renderContacts(), main())), 'an empty search says so'); U.ctQ = '';
  S.settings.ct.sort = 'free'; assert.equal(A.ctVisible()[0].id, 'jp', 'available people first'); S.settings.ct.sort = 'org'; assert.equal(A.ctVisible()[0].id, 'c2'); S.settings.ct.sort = 'name';
  // a missing or odd filter never leaves an empty page
  S.settings.ct.filter = 'tag:gone'; assert.doesNotThrow(() => A.renderContacts()); S.settings.ct.filter = 'all';
  // the profile shows the details and is safe with hostile text
  c.notes = '<img src=x onerror=alert(1)> **bold**'; c.web = 'javascript:alert(1)'; const ph = A.ctProfileHtml(c);
  assert.ok(!/<img src=x/.test(ph), 'notes are rendered as Markdown, never as raw HTML'); assert.ok(!/href="javascript:/i.test(ph), 'a website can only be an http(s) link'); assert.ok(ph.includes('mailto:anna@x.org') && ph.includes('tel:+447700900123'));
  assert.ok(ph.includes('Best by email')); assert.ok(/Mon<\/b><span>[^<]*9:00[^<]*1:00/.test(nb(ph)), 'the week of available hours is shown');
  c.name = '<script>alert(1)</script>'; assert.ok(!A.ctProfileHtml(c).includes('<script>alert') && !A.ctCard(c, clock.t).includes('<script>alert')); c.name = 'Anna Smith'; c.web = ''; c.notes = ''; clock.t = clock0;
}

/* ============ 3. contacts: links, mentions, quick-add ============ */
{
  const A = makeApp(), { S, U } = A;
  S.contacts.push(A.ctNormalise({ id: 'c1', name: 'Anna Smith', nick: 'anna' }), A.ctNormalise({ id: 'c2', name: 'Bob Jones' }), A.ctNormalise({ id: 'c3', name: 'Bobby Tables' }), A.ctNormalise({ id: 'c4', name: 'Ann Lee' }));
  // quick-add: +name
  const q = (text) => A.parseQuick(text, S.lists, new Date(clock.t), { subjects: [], contacts: S.contacts });
  eq([q('Send report +anna tomorrow').title, q('Send report +anna tomorrow').contactIds], ['Send report', ['c1']], 'a nickname');
  eq(q('Call +annasmith now').contactIds, ['c1'], 'a whole name with the space left out');
  eq(q('Lunch +annsmith').contactIds, [], 'a misspelt name matches nobody'); assert.equal(q('Lunch +annsmith').title, 'Lunch +annsmith', 'and stays in the title');
  eq(q('Call +bob now').contactIds, [], '"bob" starts two names (Bob Jones, Bobby Tables): nobody is picked'); assert.equal(q('Call +bob now').title, 'Call +bob now', 'and the word stays in the title');
  eq(q('Call +ann now').contactIds, [], '"ann" starts Anna Smith and Ann Lee: nobody is picked'); eq(q('Call +annlee now').contactIds, ['c4']);
  eq(q('Call +bobjones now').contactIds, ['c2'], 'the full name without the space');
  eq(q('Call +bobby now').contactIds, ['c3']); eq(q('Call +anna +bobjones now').contactIds, ['c1', 'c2']);
  assert.equal(q('Learn C++ basics').title, 'Learn C++ basics', 'a plus sign that names nobody is left alone');
  eq(A.parseQuick('Plain task', S.lists, new Date(clock.t), {}).contactIds, [], 'works without a contacts list');
  // quickAdd stores the link, and only when there is one
  A.quickAdd('Send the report +anna', {}); A.quickAdd('No one here', {});
  const t1 = S.tasks.find(t => t.title === 'Send the report'), t2 = S.tasks.find(t => t.title === 'No one here');
  eq(t1.contactIds, ['c1']); assert.equal(t2.contactIds, undefined, 'tasks without people carry no field');
  A.quickAdd('Project call', { contactIds: ['c2'] }); eq(S.tasks.find(t => t.title === 'Project call').contactIds, ['c2'], 'a task made from a contact is linked to it');

  // links are stored on the task, note and class; the contact side is worked out
  const note = A.newNote({ title: 'Meeting', body: 'Notes with @[Anna Smith] and @[anna smith] and email a@b.c @[Nobody]' }); S.notes.push(note);
  const task2 = A.newTask({ title: 'Mentioned', notes: 'ask @[Bob Jones]' }); S.tasks.push(task2);
  eq(A.ctTasks(S.contacts[0]).map(t => t.title), ['Send the report'], 'tasks linked to Anna'); eq(A.ctTasks(S.contacts[1]).map(t => t.title).sort(), ['Mentioned', 'Project call'], 'a mention in a task\'s notes counts');
  eq(A.ctNotes(S.contacts[0]).map(n => n.title), ['Meeting'], 'a mention in a note counts, whatever the case'); assert.equal(A.ctNotes(S.contacts[1]).length, 0);
  A.ctSetLink(note, 'c2', true); A.ctSetLink(note, 'c2', true); eq(note.contactIds, ['c2'], 'linking twice links once'); assert.equal(A.ctNotes(S.contacts[1]).length, 1);
  A.ctSetLink(note, 'c2', false); eq(note.contactIds, []);
  eq(A.ctPeople('note', note).map(x => [x.c.id, x.link]), [['c1', false]], 'a mention is shown but cannot be unlinked');
  A.ctSetLink(note, 'c1', true); eq(A.ctPeople('note', note).map(x => [x.c.id, x.link]), [['c1', true]], 'a person who is both linked and mentioned shows once, as linked');
  // rendered mentions
  const h = A.md(note.body); assert.ok(h.includes('class="ctm" data-ct="c1"'), 'a mention is a link to the person'); assert.ok(h.includes('class="ctm miss">@Nobody'), 'an unknown name stays plain text'); assert.ok(!h.includes('a@b.c <a'), 'an email address is not a mention');
  assert.ok(!A.mdInline('hello @[Anna Smith]', true).includes('data-ct'), 'where links are not wanted (titles) it is plain text');
  assert.ok(!A.md('x @[<img src=x onerror=1>]').includes('<img'), 'the name in a mention cannot inject HTML');
  assert.ok(A.md('[a](https://x.y) @[Anna Smith](z)').includes('href="https://x.y"'), 'ordinary links still work');
  // renaming a person moves their mentions
  const c1 = S.contacts[0]; c1.name = 'Anna Brown'; A.ctRenameRefs('Anna Smith', 'Anna Brown');
  assert.ok(note.body.includes('@[Anna Brown] and @[Anna Brown]') && note.body.includes('@[Nobody]'), 'mentions follow the new name'); assert.equal(A.ctNotes(c1).length, 1);
  // the task panel shows the people and the buttons
  const th = A.ctPeopleHtml('task', t1); assert.ok(th.includes('Anna Brown') && th.includes('data-act="ctunlink"') && th.includes('data-act="ctpick"'));
  assert.ok(A.ctNoteRowHtml(note).includes('People')); assert.ok(A.ctPeopleHtml('task', t2).includes('Add a person'));
  U.sel = t1.id; U.page = 'tasks'; assert.doesNotThrow(() => A.renderDetail()); assert.ok(A.els['#detail'].innerHTML.includes('pe-people'), 'the task panel has a People block');
  // unlink through the page action
  A.CT_ACT.ctunlink({ dataset: { k: 'task', id: t1.id, cid: 'c1' } }); eq(t1.contactIds, []);
  // deleting a person cleans the links
  A.ctSetLink(t1, 'c2', true); A.flush(); /* (saved once, so the sync knows the person) */ A.ctDelete(S.contacts.find(c => c.id === 'c2'));
  assert.ok(!S.contacts.some(c => c.id === 'c2')); eq(t1.contactIds, [], 'tasks lose the link'); A.flush(); assert.ok(S.tomb['c2'], 'the deletion is recorded, so other devices delete the person too');
  // the link survives a round trip through migrate (a file from the sync, a backup)
  const m = A.migrate({ ...base0(), tasks: [{ ...t2, contactIds: ['a', 'a', 5, '', 'b'] }], notes: [{ ...note, contactIds: 'oops' }], school: [{ id: 'su1', k: 'subject', name: 'Maths', contactIds: ['c1', 'c1', null] }] });
  eq(m.tasks[0].contactIds, ['a', 'b']); eq(m.notes[0].contactIds, []); eq(m.school.find(x => x.id === 'su1').contactIds, ['c1']);
  assert.ok(Array.isArray(m.contacts) && Array.isArray(m.csections) && Array.isArray(m.centries), 'an older file gets the new collections');
  // the notes toolbar has a mention button, and the help knows the syntax
  assert.ok(A.NOTE_FMT.some(f => f[0] === 'mention'), 'a Mention button in the note toolbar');
}

/* ============ 4. teachers are contacts ============ */
{
  const A = makeApp(); // (replaceAll swaps the data for a new object, so S is read through A each time)
  // an older teacher (from 0.7) gets a contact once; the contact id is made from the teacher's, so two devices that do it agree
  const old = { ...base0(), school: [{ id: 'te1', k: 'teacher', name: 'Ms Hale', email: 'hale@school.edu', phone: '0123' }, { id: 'su1', k: 'subject', name: 'Chemistry', teacherId: 'te1', color: '#e5484d' }, { id: 'su2', k: 'subject', name: 'Art' }] };
  const m1 = A.migrate(JSON.parse(JSON.stringify(old))), m2 = A.migrate(JSON.parse(JSON.stringify(old)));
  eq(m1.contacts.map(c => c.id), ['ct-te1']); eq(m1.contacts, m2.contacts.map(c => ({ ...c })).map((c, i) => ({ ...c, created: m1.contacts[i].created, u: m1.contacts[i].u })), 'both devices make the same contact');
  assert.equal(m1.school.find(x => x.id === 'te1').contactId, 'ct-te1'); eq(m1.contacts[0].emails, [{ l: 'School', v: 'hale@school.edu' }]); eq(m1.contacts[0].phones, [{ l: 'School', v: '0123' }]);
  const again = A.migrate(JSON.parse(JSON.stringify(m1))); assert.equal(again.contacts.length, 1, 'migrating again adds nothing');
  // a contact the person deleted does not come back (the teacher remembers it was linked)
  const gone = A.migrate({ ...JSON.parse(JSON.stringify(m1)), contacts: [], tomb: { 'ct-te1': Date.now() } }); assert.equal(gone.contacts.length, 0);
  const gone2 = A.migrate({ ...JSON.parse(JSON.stringify(m1)), contacts: [], tomb: {} }); assert.equal(gone2.contacts.length, 0, 'even after the tombstone has expired');
  const nt = A.migrate({ ...old, tomb: { 'ct-te1': 1 }, contacts: [] }); assert.equal(nt.contacts.length, 0, 'a tombstoned contact is not recreated'); assert.equal(nt.school.find(x => x.id === 'te1').contactId, 'ct-te1');

  A.replaceAll(JSON.parse(JSON.stringify(m1))); A.initSeen();
  const c = A.S.contacts.find(x => x.id === 'ct-te1');
  assert.equal(A.ctIsClass(c), true, 'a teacher is a class contact'); eq(A.ctClasses(c).map(x => [x.s.name, x.role]), [['Chemistry', 'Teacher']]);
  // a lesson with its own teacher counts too
  A.S.school.push({ id: 'le1', k: 'lesson', subjectId: 'su2', teacherId: 'te1', day: 1, start: '09:00', end: '10:00' }); eq(A.ctClasses(c).map(x => x.s.name), ['Art', 'Chemistry']);
  // another kind of class contact is linked by hand and shows its own role
  const ta = A.ctNormalise({ id: 'c9', name: 'Tutor Tom' }); A.S.contacts.push(ta); assert.equal(A.ctIsClass(ta), false); A.ctSetLink(A.S.school.find(x => x.id === 'su2'), 'c9', true);
  assert.equal(A.ctIsClass(ta), true); eq(A.ctClasses(ta).map(x => [x.s.name, x.role]), [['Art', 'Class contact']]);
  // the page groups them
  A.S.settings.ct.filter = 'class'; eq(A.ctVisible().map(x => x.id).sort(), ['c9', 'ct-te1']); A.S.settings.ct.filter = 'all'; A.U.page = 'contacts'; A.render();
  assert.ok(A.els['#main'].innerHTML.includes('Class contacts'), 'Class contacts has its own group');
  // name, email and phone stay in step both ways
  c.name = 'Mrs Hale'; c.emails = [{ l: 'Work', v: 'new@school.edu' }]; c.phones = []; A.ctTeacherPull(c);
  { const t = A.S.school.find(x => x.id === 'te1'); assert.equal(t.name, 'Mrs Hale'); assert.equal(t.email, 'new@school.edu'); assert.equal(t.phone, '', 'the timetable shows the teacher the contact describes'); }
  const rec = { id: 'te1', k: 'teacher', name: 'Dr Hale', email: 'dr@school.edu', phone: '999', contactId: 'ct-te1' }; A.ctTeacherPush(rec);
  assert.equal(c.name, 'Dr Hale'); eq(c.emails, [{ l: 'Work', v: 'dr@school.edu' }], 'the label is kept'); eq(c.phones, [{ l: 'School', v: '999' }]);
  const fresh = { id: 'te2', k: 'teacher', name: 'Mr New', email: '', phone: '' }; A.ctTeacherPush(fresh);
  assert.equal(fresh.contactId, 'ct-te2'); assert.ok(A.S.contacts.some(x => x.id === 'ct-te2' && x.name === 'Mr New'), 'a teacher added in Classes is a contact straight away');
  // the Teachers tab points at Contacts, and the old teacher lookups still work
  assert.ok(A.scTabHtml('teach').includes('data-page="contacts"'), 'the Teachers tab links to Contacts');
  assert.equal(A.scGet('te1').name, 'Mrs Hale', 'teacher lookups still find the record');
}

/* ============ 5. custom sections ============ */
{
  const A = makeApp(), { S, U } = A;
  const s = A.xsNormalise({ id: 'x-1', name: '  Reading  ', icon: 'book-open', color: '#8e5cf7', fields: [{ id: 'a', name: 'Author', type: 'text' }, { id: 'a', name: 'Dup id', type: 'zzz' }, { id: 'st', name: 'Status', type: 'select', opts: ['To read', 'Reading', 'To read', ' ', 'Done'] }, { id: 'r', name: 'Rating', type: 'rating' }, null, 7], view: 'wat', group: 'nope', sort: { f: 'x', dir: 'up' } });
  assert.equal(s.name, 'Reading'); eq(s.fields.map(f => f.type), ['text', 'text', 'select', 'rating']); assert.equal(new Set(s.fields.map(f => f.id)).size, 4, 'field ids are unique'); eq(s.fields[2].opts, ['To read', 'Reading', 'Done']);
  assert.equal(s.view, 'list'); assert.equal(s.group, '', 'a group that is not a field goes'); eq(s.sort, { f: 'x', dir: 'desc' });
  assert.equal(A.xsNormalise({ id: 'x', fields: Array.from({ length: 60 }, (_, i) => ({ name: 'f' + i })) }).fields.length, 24, 'at most 24 fields');
  for (const bad of [{ id: 'x' }, { id: 'x', fields: 'a', sort: 5, group: 7 }]) assert.doesNotThrow(() => A.xsNormalise(bad));
  s.group = 'st'; s.sort = { f: 'r', dir: 'desc' }; S.csections.push(s);
  const mk = (title, vals, o = {}) => { const e = A.xeNormalise({ id: 'e-' + title, sid: 'x-1', title, vals, created: Date.now() + S.centries.length, ...o }); S.centries.push(e); return e; };
  mk('Dune', { a: 'Herbert', st: 'Done', r: 5 }); mk('Emma', { a: 'Austen', st: 'To read', r: 3 }); mk('Ulysses', { st: 'To read' }); mk('Hobbit', { a: 'Tolkien', st: 'Reading', r: 4, x: 'not a field' });
  eq(S.centries.find(e => e.title === 'Hobbit').vals.x, 'not a field', 'a value is kept even if the field is gone: it returns with the field');
  assert.equal(A.xeNormalise({ id: 'e', sid: 'x-1', vals: { a: { evil: 1 }, b: NaN, c: [1, 'two', null], d: true } }).vals.a, undefined, 'objects are not values');
  // sorting: by rating, empty last
  eq(A.xsVisible(s).map(e => e.title), ['Dune', 'Hobbit', 'Emma', 'Ulysses']); s.sort.dir = 'asc'; eq(A.xsVisible(s).map(e => e.title), ['Emma', 'Hobbit', 'Dune', 'Ulysses'], 'empty values stay last either way');
  s.sort = { f: 'title', dir: 'asc' }; eq(A.xsVisible(s).map(e => e.title), ['Dune', 'Emma', 'Hobbit', 'Ulysses']); s.sort = { f: 'st', dir: 'asc' }; eq(A.xsVisible(s).map(e => e.title)[0], 'Emma', 'a choice sorts in the order of its options');
  s.checkable = true; S.centries.find(e => e.title === 'Dune').done = true; assert.equal(A.xsVisible(s).slice(-1)[0].title, 'Dune', 'done entries go to the bottom'); s.checkable = false; S.centries.find(e => e.title === 'Dune').done = false;
  U.xsQ = { 'x-1': 'tolkien' }; eq(A.xsVisible(s).map(e => e.title), ['Hobbit'], 'search looks at the values'); U.xsQ = {};
  // the page, in each view, grouped and not; hostile text is escaped
  S.centries.push(A.xeNormalise({ id: 'ev', sid: 'x-1', title: '<img src=x onerror=alert(1)>', vals: { a: '<b>x</b>' }, notes: '<script>1</script>' }));
  S.csections.push(A.xsNormalise({ id: 'x-2', name: 'Other' })); S.centries.push(A.xeNormalise({ id: 'e-other', sid: 'x-2', title: 'Elsewhere' }));
  assert.ok(A.csecOn('x-1') && !A.csecOn('tasks')); eq(A.csecEntries().map(x => x[0]), ['x-1', 'x-2']);
  U.page = 'x-1';
  for (const view of ['list', 'cards', 'table']) for (const group of ['', 'st']) { s.view = view; s.group = group; assert.doesNotThrow(() => A.render(), view + group); const h = A.els['#main'].innerHTML; assert.ok(h.includes('Dune') && !h.includes('Elsewhere'), 'only this section\'s entries'); assert.ok(!h.includes('<img src=x') && !h.includes('<script>1') && !h.includes('<b>x</b>'), view + ': text is escaped'); }
  s.group = 'st'; s.view = 'cards'; A.render(); assert.ok(A.els['#main'].innerHTML.includes('To read') && A.els['#main'].innerHTML.includes('No status'), 'groups follow the options, plus the ones with none');
  assert.equal(A.xsHref('javascript:alert(1)'), '', 'a link field is only ever an http(s) link'); assert.equal(A.xsHref('example.com/a'), 'https://example.com/a');
  assert.ok(A.xsShow({ type: 'url' }, 'javascript:alert(1)').indexOf('href') < 0);
  // it is a section like any other: in the sidebar, in the order, hidden and pinned like the rest
  assert.ok(A.sectionsShown().some(x => x[0] === 'x-1'), 'it is in the sidebar'); assert.ok(A.navKeys().includes('sec:x-1')); assert.ok(A.navHtml('side').includes('data-sec="x-1"') && A.navHtml('bar').includes('data-sec="x-1"'), 'and in the phone tab bar');
  assert.equal(A.secOf('x-1'), 'x-1'); eq(A.viewsOf('x-1'), ['x-1']);
  A.navMove('sec:x-1', -1); { const k = A.navKeys(); assert.ok(k.indexOf('sec:x-1') < k.indexOf('sec:contacts')); }
  S.settings.ui.hidePages = ['x-1']; U.page = 'tasks'; assert.ok(!A.sectionsShown().some(x => x[0] === 'x-1'), 'it can be hidden'); S.settings.ui.hidePages = [];
  assert.ok(A.uiSidebarSettings().includes('x-1')); assert.doesNotThrow(() => A.render());
  // the actions
  U.page = 'x-1'; A.XS_ACT.xsview({ dataset: { v: 'table' } }); assert.equal(s.view, 'table'); A.XS_ACT.xsdir({}); assert.equal(s.sort.dir, 'desc');
  const du = S.centries.find(e => e.title === 'Dune'); s.checkable = true; A.XS_ACT.xsdone({ dataset: { id: du.id } }); assert.equal(du.done, true);
  // a section arriving from sync with the wrong shape cannot break the page
  S.csections.push({ id: 'x-bad', name: 5, fields: 'x', sort: null }); A.xsNormalise(S.csections[S.csections.length - 1]); U.page = 'x-bad'; assert.doesNotThrow(() => A.render()); U.page = 'x-1';
  // templates make sensible sections
  for (const t of A.XS_TEMPLATES) { const x = A.xsFromTemplate(t); assert.ok(x.id.startsWith('x-') && x.name, t.id); assert.ok(x.fields.every(f => f.id && f.name), t.id); if (t.group) assert.ok(x.group, t.id + ' groups by a real field'); if (t.sort && t.sort.f && t.sort.f !== 'created') assert.ok(x.sort.f === 'created' || x.sort.f === 'title' || x.fields.some(f => f.id === x.sort.f), t.id + ' sorts by a real field'); S.csections.push(x); U.page = x.id; assert.doesNotThrow(() => A.render(), t.id); }
  // it can be the screen OpenTick opens on, and falls back to Today if it is deleted
  S.settings.home = 'x-1'; assert.equal(A.homeValid('x-1'), true); assert.ok(A.homeSelectHtml().includes('value="x-1" selected')); A.homeApply(); assert.equal(U.page, 'x-1'); assert.equal(A.homeValid('contacts'), true);
  // deleting removes its entries and its place in the sidebar
  const nb = S.centries.length, mine = S.centries.filter(e => e.sid === 'x-1').length; U.page = 'x-1'; A.xsDelete(s);
  assert.equal(S.centries.length, nb - mine); assert.ok(!S.csections.some(x => x.id === 'x-1')); assert.ok(!A.navKeys().includes('sec:x-1')); assert.notEqual(U.page, 'x-1', 'you are not left on a page that is gone'); assert.equal(A.homeValid('x-1'), false, 'a deleted section is no longer a start screen'); S.settings.home = 'tasks:today';
  // an entry can name people
  const c = A.ctNormalise({ id: 'c1', name: 'Anna' }); S.contacts.push(c); const en = S.centries.find(e => e.id === 'e-other'); A.ctSetLink(en, 'c1', true); eq(A.ctOf(en).map(x => x.id), ['c1']);
}

/* ============ 6. packs ============ */
{
  const A = makeApp(), { S, U } = A;
  const good = () => ({ opentick: 'pack', format: 1, id: 'Reading List!', name: 'Reading list', version: '1.2.0', author: 'Someone', description: 'Books', license: 'CC0-1.0', homepage: 'https://example.com/x',
    sections: [{ name: 'Books', icon: 'book-open', color: '#8e5cf7', title: 'Title', view: 'cards', checkable: false, sort: { f: 'rate', dir: 'desc' }, group: 'status',
      fields: [{ key: 'author', name: 'Author', type: 'text' }, { key: 'status', name: 'Status', type: 'select', opts: ['To read', 'Done'] }, { key: 'rate', name: 'Rating', type: 'rating' }, { key: 'link', name: 'Link', type: 'url' }],
      entries: [{ title: 'Dune', vals: { author: 'Herbert', status: 'Done', rate: 5, link: 'https://x.y', nope: 'ignored' }, notes: 'great', done: false }, { title: 'Emma', vals: { rate: 9, status: 'To read' } }] }],
    themes: [{ name: 'Ocean', base: 'dark', vars: { '--bg': '#101820', '--text': '#e8eef5', '--acc': '#4cc9f0', '--evil': '#fff', '--shadow': '0 10px 30px rgba(0,0,0,.4)', '--red': 'url(http://evil/x)' } }] });
  const r = A.packClean(good()), p = r.pack;
  assert.equal(p.id, 'reading-list'); assert.equal(p.sections[0].fields.length, 4); eq(p.sections[0].entries[0].vals, { author: 'Herbert', status: 'Done', rate: 5, link: 'https://x.y' }, 'values of unknown fields are dropped');
  eq(p.sections[0].entries[1].vals, { status: 'To read' }, 'a rating of 9 is not a rating'); eq(p.themes[0].vars, { '--bg': '#101820', '--text': '#e8eef5', '--acc': '#4cc9f0', '--shadow': '0 10px 30px rgba(0,0,0,.4)' }, 'only known variables with safe values');
  assert.equal(A.packCounts(p).entries, 2);
  // it is data only: nothing is carried over that the format does not name
  const evil = good(); evil.sections[0].onload = 'alert(1)'; evil.sections[0].fields[0].html = '<script>'; evil.__proto__ = { x: 1 }; evil.sections[0].name = 'A\u0000B<b>'; evil.sections[0].entries[0].title = '<img src=x onerror=1>';
  { const e = A.packClean(JSON.parse(JSON.stringify(evil))).pack; assert.equal(e.sections[0].onload, undefined); assert.equal(e.sections[0].fields[0].html, undefined); assert.equal(e.sections[0].name, 'AB<b>', 'control characters go; markup is kept as text and escaped where it is shown'); }
  for (const v of ['url(x)', 'var(--x)', 'expression(1)', '#fff;}body{display:none', 'red"x', '@import', 'a'.repeat(200)]) assert.equal(A.pkThemeVal(v), '', 'unsafe theme value: ' + v.slice(0, 20));
  for (const v of ['#fff', 'rgba(0, 0, 0, .3)', 'hsl(200 50% 40%)', '0 10px 30px rgba(0,0,0,.4)']) assert.notEqual(A.pkThemeVal(v), '', v);
  // refusals say what is wrong
  const no = (x, re, m) => assert.throws(() => (typeof x === 'string' ? A.packParse(x) : A.packClean(x)), re, m);
  no('', /empty/i); no('{nope', /not a pack file/i); no('[]', /not an OpenTick pack/); no({ format: 1 }, /not an OpenTick pack/); no({ opentick: 'pack' }, /format/); no({ opentick: 'pack', format: 2, sections: [{ name: 'x' }] }, /newer OpenTick/);
  no({ opentick: 'pack', format: 1 }, /nothing|no sections/i); no({ opentick: 'pack', format: 1, sections: [{ fields: [] }] }, /no sections or themes/); no({ opentick: 'pack', format: 1, themes: [{ name: 'T', vars: { '--bg': '#000' } }] }, /no sections or themes/, 'a theme needs --bg, --text and --acc');
  no('x'.repeat(2 * 1024 * 1024 + 5), /too large/);
  // limits
  const big = { opentick: 'pack', format: 1, sections: Array.from({ length: 30 }, (_, i) => ({ name: 'S' + i, fields: Array.from({ length: 40 }, (_, j) => ({ name: 'f' + j })), entries: Array.from({ length: 600 }, (_, j) => ({ title: 'e' + j })) })) };
  { const b = A.packClean(big); assert.equal(b.pack.sections.length, A.PACK_LIMIT.sections); assert.equal(b.pack.sections[0].fields.length, 24); assert.equal(b.pack.sections[0].entries.length, A.PACK_LIMIT.entries); assert.ok(b.warnings.length >= 2, 'it says what it cut'); }
  assert.ok(A.packParse(JSON.stringify(good())).pack.name === 'Reading list');

  // installing: new ids for everything, entries remapped to the new field ids, the theme added but not switched to
  const before = { s: S.csections.length, e: S.centries.length, th: S.settings.theme }, inst = A.packInstall(p);
  assert.equal(S.csections.length, before.s + 1); assert.equal(S.centries.length, before.e + 2); assert.equal(inst.themes, 1);
  const sec = S.csections[S.csections.length - 1]; assert.ok(sec.id.startsWith('x-')); assert.equal(sec.pack, 'Reading list'); assert.equal(sec.view, 'cards');
  const fa = sec.fields.find(f => f.name === 'Author'), fs = sec.fields.find(f => f.name === 'Status'), fr = sec.fields.find(f => f.name === 'Rating');
  assert.ok(!['author', 'status', 'rate'].includes(fa.id), 'field ids are made fresh'); assert.equal(sec.group, fs.id, 'group follows the field'); eq(sec.sort, { f: fr.id, dir: 'desc' }, 'sort follows the field');
  const dune = S.centries.find(e => e.sid === sec.id && e.title === 'Dune'); assert.equal(dune.vals[fa.id], 'Herbert'); assert.equal(dune.vals[fr.id], 5); assert.equal(dune.notes, 'great');
  assert.equal(S.settings.theme, before.th, 'a pack never changes the theme in use'); assert.ok(S.settings.customThemes.some(t => t.name === 'Ocean'), 'but the theme is there to pick');
  { const t = S.settings.customThemes.find(x => x.name === 'Ocean'); assert.ok(t.css.includes('--bg') && !/url\(|evil/.test(t.css)); }
  const inst2 = A.packInstall(p); assert.equal(S.csections.length, before.s + 2, 'installing twice makes a second copy and leaves the first alone'); assert.notEqual(inst2.sections[0].id, sec.id);
  assert.equal(S.centries.filter(e => e.sid === sec.id).length, 2);
  U.page = sec.id; assert.doesNotThrow(() => A.render());
  // export, and back in
  A.xsEntries(sec).forEach(e => { e.contactIds = ['c-private']; });
  const out = A.packFromSections([sec], { name: 'Mine', author: 'Me' }, true), outText = JSON.stringify(out);
  assert.equal(out.opentick, 'pack'); assert.equal(out.format, 1); assert.ok(!outText.includes('c-private') && !outText.includes('contactIds'), 'people linked to entries are never exported');
  { const back = A.packClean(JSON.parse(outText)).pack; assert.equal(back.sections[0].entries.length, 2); assert.equal(back.sections[0].fields.length, 4); assert.equal(back.sections[0].group, fs.id, 'keys are the old field ids'); eq(back.sections[0].entries.find(e => e.title === 'Dune').vals, { [fa.id]: 'Herbert', [fs.id]: 'Done', [fr.id]: 5, [sec.fields.find(f => f.name === 'Link').id]: 'https://x.y' }); }
  assert.equal(A.packFromSections([sec], { name: 'Mine' }, false).sections[0].entries.length, 0, 'the entries are optional');
  // the settings page and the New section dialog
  assert.ok(A.packsSettingsHtml().includes('Marketplace') && A.packsSettingsHtml().includes('Reading')); assert.ok(A.packsImportHtml().includes('data-m="packfile"'));
  assert.equal(A.packsSettingsAct('nothing', { dataset: {} }), false);
  // none of it is device-local state that leaks: the packs themselves are ordinary synced sections
  const snap = A.snapshot(); assert.ok(snap.csections.length >= 2 && snap.centries.length >= 4 && Array.isArray(snap.contacts));
  const pl = JSON.parse(A.buildPayload().text); assert.equal(pl.schema, 7); for (const k of ['contacts', 'csections', 'centries']) assert.ok(Array.isArray(pl[k]), k + ' is in the sync file');
  // an older app (schema 6) sends no new collections: they stay as they are here
  const merged = A.mergeData(A.snapshot(), { ...base0() }); assert.ok(Array.isArray(merged.csections));
}

/* ============ 7. counts and history know the new kinds ============ */
{
  const A = makeApp(), { S } = A;
  S.contacts.push(A.ctNormalise({ id: 'c1', name: 'Anna' })); S.csections.push(A.xsNormalise({ id: 'x-1', name: 'Books' })); S.centries.push(A.xeNormalise({ id: 'e1', sid: 'x-1', title: 'Dune' }));
  const dc = A.dataCountsText(A.dataCounts()); assert.ok(/1 contact/.test(dc), dc); assert.ok(/1 custom section/.test(dc), dc); assert.ok(/1 custom entry/.test(dc), dc);
  eq([A.HIST_KIND.contacts, A.HIST_KIND.csections, A.HIST_KIND.centries], ['contact', 'section', 'entry']);
}
/* ============ 8. search and the command palette find people and section entries ============ */
{
  const A = makeApp(), { S } = A;
  S.contacts.push(A.ctNormalise({ id: 'c1', name: 'Anna Smith', role: 'Maths teacher', emails: [{ l: '', v: 'anna@school.edu' }] }), A.ctNormalise({ id: 'c2', name: 'Bob Jones' }));
  const sec = A.xsFromTemplate(A.XS_TEMPLATES.find(t => t.id === 'reading')); S.csections.push(sec); S.centries.push(A.xeNormalise({ id: 'e1', sid: sec.id, title: 'Annabel Lee', vals: {}, notes: 'a poem' }), A.xeNormalise({ id: 'e2', sid: sec.id, title: 'Dune', vals: {} }));
  const g = A.srchGroups('anna', 'all'), by = k => g.find(x => x.k === k);
  eq(by('people').rows.map(r => r.label), ['Anna Smith'], 'a person is found by name'); eq(by('entries').rows.map(r => [r.label, r.hint]), [['Annabel Lee', sec.name]], 'and an entry of a section, with the section named');
  eq(A.srchGroups('school.edu', 'all').find(x => x.k === 'people').rows.map(r => r.label), ['Anna Smith'], 'people are found by email too'); assert.ok(!A.srchGroups('anna', 'tasks').some(x => x.k === 'people'), 'the Tasks scope leaves them out');
  assert.ok(A.srchGroups('anna', 'all').flatMap(x => x.rows).every(r => typeof r.run === 'function'));
  assert.ok(!A.srchGroups('<img src=x>', 'all').some(x => x.rows.some(r => /<img/.test(r.html || ''))), 'nothing typed becomes markup');
  const pal = q => A.paletteItems(q).map(i => i.label + '|' + i.hint);
  assert.ok(pal('new section').some(x => x.startsWith('New section')), 'New section… is a command'); assert.ok(pal('new contact').some(x => x.startsWith('New contact')));
  assert.ok(pal('bob').includes('Bob Jones|Contact'), 'a person is in the palette'); assert.ok(pal('go to ' + sec.name.toLowerCase()).some(x => x.endsWith('|Section')), 'and so is a section');
}

/* ============ 9. no two files declare the same name (they all share one script scope: a clash stops the whole app from loading) ============ */
{
  const { JS_ORDER } = await import('../build-app.mjs'); const fs = await import('node:fs'); const seen = new Map(), dup = [];
  for (const f of JS_ORDER) {
    const text = fs.readFileSync(new URL(`../src/js/${f}.js`, import.meta.url), 'utf8');
    for (const m of text.matchAll(/^(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) { const n = m[1]; if (seen.has(n) && seen.get(n) !== f) dup.push(`${n} (${seen.get(n)}.js and ${f}.js)`); else if (seen.has(n) && /^(?:const|let|class)/.test(m[0])) dup.push(`${n} twice in ${f}.js`); else seen.set(n, f); }
  }
  assert.deepEqual(dup, [], 'declared more than once: ' + dup.join(', '));
}
console.log('0.8.0 tests passed (sidebar, contacts, mentions, teachers, custom sections, packs)');
