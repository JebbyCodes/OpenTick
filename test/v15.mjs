// 0.3: icons, embeds, the Projects home screen, folding sections, the school timetable, and the data the widgets read.
import assert from 'node:assert/strict';
import { makeApp } from './harness.mjs';
const app = makeApp(), { S, U } = app;

/* ---- icons ---- */
assert.ok(app.ICON_CATS.length >= 6);
const allIcons = app.ICON_CATS.flatMap(c => c[1]);
for (const k of allIcons) assert.ok(app.IC[k], `icon "${k}" is drawn`);
assert.equal(new Set(allIcons).size, allIcons.length, 'no icon listed twice');
assert.ok(allIcons.length >= 120, 'a big library: ' + allIcons.length);
assert.equal(app.LIST_ICONS.length, allIcons.length, 'lists and projects offer every icon');
for (const v of Object.values(app.IC)) assert.ok(!/<script|on\w+=/i.test(v), 'icons are plain shapes');
assert.match(app.iconAny('rocket', 18), /<svg/); assert.match(app.iconAny('🎯', 18), /🎯/); assert.equal(app.iconAny('', 18), ''); assert.match(app.iconAny('', 18, 'list'), /<svg/);
assert.match(app.iconAny('<img onerror=1>', 18), /&lt;img/, 'an emoji field is escaped');
{ const t = app.newTask({ title: 'x', icon: 'rocket' }); assert.match(app.taskIcon(t), /class="tic"/); assert.equal(app.taskIcon(app.newTask({ title: 'y' })), ''); }

/* ---- embeds ---- */
assert.match(app.mdEmbed('https://youtu.be/dQw4w9WgXcQ?t=42', 'clip'), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?start=42/);
assert.match(app.mdEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ', ''), /embed\/dQw4w9WgXcQ"/);
assert.match(app.mdEmbed('https://vimeo.com/123456789', ''), /player\.vimeo\.com\/video\/123456789/);
assert.match(app.mdEmbed('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', ''), /open\.spotify\.com\/embed\/track\/4uLU6hMCjMI75M1A2tKUQC/);
assert.match(app.mdEmbed('https://example.com/a.mp4?x=1', ''), /<video controls/); assert.match(app.mdEmbed('https://example.com/a.mp3', ''), /<audio controls/); assert.match(app.mdEmbed('https://example.com/a.pdf', 'Doc'), /<iframe src="https:\/\/example\.com\/a\.pdf"/);
for (const bad of ['https://example.com/page', 'javascript:alert(1)', 'data:text/html,<b>', 'ftp://x/a.mp4', 'https://youtu.be/short', '']) assert.equal(app.mdEmbed(bad, ''), null, 'not an embed: ' + bad);
{ const h = app.mdEmbed('https://example.com/a.mp4?q="onload="x', '"><script>'); assert.ok(h && h.includes('&quot;onload=&quot;x') && !h.includes('"onload="') && !h.includes('"><script>'), 'attributes are escaped'); }
assert.match(app.md('![video](https://youtu.be/dQw4w9WgXcQ)'), /class="embed emb-video"/);
assert.match(app.md('text ![](https://example.com/a.mp3) text'), /<audio/, 'inline too');
assert.match(app.md('![pic](https://example.com/x.png)'), /<img/, 'a plain image stays an image');
assert.doesNotMatch(app.mdInline('![v](https://youtu.be/dQw4w9WgXcQ)', true), /iframe/, 'titles never embed');
{ // another note, in place
  const inner = app.newNote({ title: 'Inner', body: 'Hello **there**\n\n![[Outer]]' }), outer = app.newNote({ title: 'Outer', body: '![[Inner]]\n\n![[Nope]]' });
  S.notes.push(inner, outer);
  const h = app.md(outer.body);
  assert.match(h, /class="embed emb-note"/); assert.match(h, /<strong>there<\/strong>/, 'the embedded note is rendered'); assert.match(h, /not repeated here/, 'a note inside itself stops'); assert.match(h, /No note with this title/);
  assert.match(app.md('![[Inner|alias]]'), /Hello/);
  assert.match(app.md('# T\n\n![[Inner]]\n\nafter'), /<h1[^>]*>T<\/h1>[\s\S]*emb-note[\s\S]*after/, 'it sits between blocks');
}

/* ---- the matrix no longer relies on the browser's drag and drop ---- */
U.page = 'matrix'; assert.doesNotMatch(app.rowHtml(app.newTask({ title: 'm', id: 'mm' }), true), /draggable/); U.page = 'tasks';

/* ---- Projects home + start screen ---- */
S.lists.push({ id: 'wk', name: 'Work', color: '#e5484d', sections: [] }, { id: 'wk2', name: 'Plan', color: '#30a46c', sections: [], parent: 'wk' });
S.projects.push({ id: 'pr', name: 'Launch', color: '#4772fa', listIds: ['wk'] });
for (const [l, n] of [['wk', 'A'], ['wk2', 'B'], ['wk2', 'C']]) S.tasks.push(app.newTask({ title: n, listId: l, id: 'tt' + n }));
assert.equal(app.homeValid('home'), true); assert.equal(app.homeValid('tasks:project:pr'), true); assert.equal(app.homeValid('tasks:list:gone'), false); assert.equal(app.homeValid('nope'), false);
S.settings.home = 'home'; app.homeApply(); assert.equal(U.page, 'home');
S.settings.home = 'tasks:project:pr'; app.homeApply(); assert.equal(U.page, 'tasks'); assert.equal(U.nav, 'project:pr');
S.settings.home = 'tasks:list:gone'; app.homeApply(); assert.equal(U.nav, 'today', 'a deleted list falls back to Today');
S.settings.home = 'calendar'; app.homeApply(); assert.equal(U.page, 'calendar'); U.page = 'tasks';
app.renderHome(); // runs against the fake page
const st = app.homeStats(app.scopeTasks('project:pr')); assert.equal(st.open, 3); assert.equal(st.pct, 0);
assert.match(app.homeProjectCard(S.projects[0]), /Launch/);

/* ---- folding sections ---- */
{ const open = S.tasks.filter(t => ['wk', 'wk2'].includes(t.listId)), html = app.treeSections(open, 'project:pr', ['wk'], false);
  assert.match(html, /gtog/); assert.equal((html.match(/class="grp gtog/g) || []).length, 2, 'the list and its sublist are both sections');
  assert.ok(html.indexOf('>Work<') < html.indexOf('>Plan<'), 'the sublist sits inside its list');
  S.settings.ui.fold[app.secKey('project:pr', 'wk2')] = true;
  assert.match(app.treeSections(open, 'project:pr', ['wk'], false), /gtog closed/, 'a folded section is marked closed');
  const own = app.treeSections(open, 'list:wk', ['wk'], true); assert.ok(own.indexOf('data-id="ttA"') < own.indexOf('gtog'), "a list's own tasks come before its sublists");
}

/* ---- school timetable ---- */
{
  const tasksBefore = S.tasks.length, n0 = S.school.length;
  assert.equal(app.schoolOn(), false); S.settings.tt.mode = 'school'; assert.equal(app.schoolOn(), true);
  app.scSeedPeriods(); const per = app.scPeriods(); assert.ok(per.length >= 8 && per.some(p => p.brk) && per.some(p => !p.brk));
  assert.equal(JSON.stringify(per.map(p => p.start)), JSON.stringify([...per.map(p => p.start)].sort()), 'periods are in time order');
  S.school.push({ id: 'su1', k: 'subject', name: 'Maths', color: '#e5484d', icon: 'calculator', room: 'R1' }, { id: 'te1', k: 'teacher', name: 'Ms Lee' });
  const lessonP = per.find(p => !p.brk);
  for (const d of [1, 2, 3, 4, 5]) S.school.push({ id: 'l' + d, k: 'lesson', day: d, periodId: lessonP.id, subjectId: 'su1', week: 0 });
  const mon = new Date(2026, 9, 19); // a Monday
  assert.equal(app.scDayLessons(mon).length, 1); assert.equal(app.scDayLessons(new Date(2026, 9, 18)).length, 0, 'no lessons on Sunday');
  assert.equal(app.scWeekType(mon), 0, 'weeks do not alternate until asked');
  app.scCfgSet({ ab: true }); const w1 = app.scWeekType(mon), w2 = app.scWeekType(new Date(2026, 9, 26)); assert.ok([1, 2].includes(w1) && [1, 2].includes(w2) && w1 !== w2, 'A and B alternate');
  app.scCfgSet({ swap: true }); assert.notEqual(app.scWeekType(mon), w1, 'swap flips them');
  S.school.push({ id: 'lb', k: 'lesson', day: 1, periodId: lessonP.id, subjectId: 'su1', week: 1 }); // week A only, replaces the every-week lesson in A weeks
  const aDay = [mon, new Date(2026, 9, 26)].find(d => app.scWeekType(d) === 1); assert.equal(app.scLesson(1, lessonP.id, 1).id, 'lb', 'a week-A lesson wins in week A');
  app.scCfgSet({ ab: false });
  assert.equal(app.scDue(app.todayStr()), 'Today'); assert.equal(app.scDue(app.ymd(app.addDays(app.pYmd(app.todayStr()), 1))), 'Tomorrow');
  // school things are not tasks
  assert.equal(S.tasks.length, tasksBefore, 'no tasks were made'); assert.ok(S.school.length > n0);
  assert.ok(!S.tasks.some(t => /Maths|lesson/i.test(t.title)));
  // they travel with the backup and the merge
  const snap = app.snapshot(); assert.ok(snap.school.length === S.school.length, 'in the snapshot');
  const other = JSON.parse(JSON.stringify(snap)); other.school = [{ id: 'hw9', k: 'homework', title: 'Read ch 4', due: '2026-10-22', subjectId: 'su1', done: false, u: Date.now() + 5000 }];
  const merged = app.mergeData(snap, other); assert.ok(merged.school.some(r => r.id === 'hw9') && merged.school.some(r => r.id === 'su1'), 'a merge keeps both sides');
  assert.match(app.dataCountsText ? String(app.dataCountsText(app.dataCounts())) : 'school item', /school item|task/);
  // deleting a subject takes its lessons with it and unlinks homework
  S.school.push({ id: 'hw1', k: 'homework', title: 'x', subjectId: 'su1', done: false });
  app.scRemove(app.scGet('su1')); assert.ok(!S.school.some(r => r.k === 'lesson' && r.subjectId === 'su1')); assert.equal(app.scGet('hw1').subjectId, '');
  app.renderSchool(); for (const t of ['week', 'today', 'hw', 'exam', 'subj', 'teach', 'note']) assert.equal(typeof app.scTabHtml(t), 'string');
  S.settings.tt.mode = 'plan';
}

/* ---- what the widgets read ---- */
{
  S.habits.push({ id: 'h1', name: 'Read', color: '#34b36b', icon: 'book', log: {}, goal: { per: 'day', n: 1 }, created: 1 });
  const snap = app.widgetSnapshot();
  for (const k of ['tasks', 'theme', 'lists', 'projects', 'notes', 'cal', 'tt', 'mx', 'hb', 'fc']) assert.ok(k in snap, 'snapshot has ' + k);
  assert.ok(snap.lists.length >= 2 && snap.lists.every(l => /^#[0-9a-f]{6}$/i.test(l.c) && typeof l.o === 'number'));
  assert.equal(snap.mx.length, 4); assert.ok(snap.mx.every(q => Array.isArray(q.items) && q.items.length <= 3));
  assert.ok(snap.projects[0].pct >= 0 && snap.projects[0].n === 'Launch');
  const mine = snap.hb.find(h => h.id === 'h1'); assert.equal(mine.e, '', 'a drawn icon has no emoji'); assert.equal(mine.d, false); assert.ok(snap.hb.some(h => h.e), 'an emoji icon is passed on');
  assert.ok(snap.cal.days && typeof snap.cal.ws === 'number'); assert.ok(snap.tt.kind === 'plan' || snap.tt.kind === 'school');
  assert.equal(typeof snap.fc.tot, 'number'); assert.ok(snap.notes.every(n => typeof n.t === 'string'));
  assert.ok(JSON.stringify(snap).length < 40000, 'small enough to read quickly');
  assert.equal(app.WG_KINDS.length, 9);
}
console.log('0.3 feature tests passed');
