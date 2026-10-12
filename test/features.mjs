// 0.6 features: sound, notes page + sync, markdown extras, wide note editor, Gantt actual dates, timetable views.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const A = makeApp(), { S, U } = A;

/* version + sound settings */
assert.equal(A.APP_VERSION, 'dev', 'unbuilt code reports dev');
eq([S.settings.sound.on, S.settings.sound.haptic], [true, true]);
assert.ok(['done', 'undo', 'tick', 'add', 'trash', 'chime', 'error', 'sched', 'start'].every(k => A.SOUNDS[k]), 'every cue is defined');
A.sfx('done'); A.sfx('nope'); S.settings.sound.on = false; A.sfx('done'); // never throws, even without an audio device
S.settings.sound.on = true;

/* notes: model, ordering, search, sync */
assert.ok(S.notes.length >= 1, 'a welcome note is seeded');
const n = A.newNote({ title: 'Plan', body: '# Heading\n\ntext [[Other]]' }); S.notes.push(n);
const o = A.newNote({ title: 'Other', body: 'x', pinned: true }); S.notes.push(o);
assert.equal(A.noteList()[0].id, 'seed-note-md' === A.noteList()[0].id ? 'seed-note-md' : o.id, 'pinned notes come first');
assert.equal(A.noteTitle(A.newNote({ body: '## Hello there\nmore' })), 'Hello there', 'untitled note takes its first line');
U.page = 'notes'; U.noteSel = n.id; A.render();
const html = A.els['#main'].innerHTML;
assert.ok(html.includes('data-f="nbody"') && html.includes('data-act="nfmt"') && html.includes('id="n-pv"'), 'editor, toolbar and preview render');
assert.ok(html.includes('class="wl"'), 'a wiki link to an existing note resolves');
U.nq = 'zzzz'; assert.equal(A.noteList().length, 0); U.nq = '';
A.noteInput('body', 'changed'); assert.equal(n.body, 'changed'); A.flush(); assert.ok(n.u > 0, 'edits are stamped for sync');
const B = makeApp(); const m = B.mergeData(B.snapshot(), A.snapshot());
assert.ok(m.notes.some(x => x.id === n.id), 'notes merge between devices');
S.notes = S.notes.filter(x => x !== o); A.flush(); assert.ok(S.tomb[o.id], 'deleting a note leaves a tombstone');
assert.equal(A.buildPayload().snap.notes.length, S.notes.length, 'notes travel in the sync file');
// a note edited on another device after the deletion resurrects it; an older edit does not
const old = A.parsePayload(JSON.stringify({ app: 'opentick', schema: 2, tasks: [], lists: [] })); eq(old.notes, [], 'an older sync file without notes still parses');

/* markdown extras */
const md = A.md || null;
const R = s => makeApp().md(s);
assert.ok(R('![a](https://x.y/z.png)').includes('<img src="https://x.y/z.png"'));
assert.ok(!R('![a](javascript:alert(1))').includes('<img'), 'only http(s) and inline images');
assert.ok(R('==hi==').includes('<mark>hi</mark>') && R('H~2~O').includes('<sub>2</sub>') && R('x^2^').includes('<sup>2</sup>'));
assert.ok(R('a[^1]\n\n[^1]: note').includes('class="mdfn"'), 'footnotes');
assert.ok(R('[t][r]\n\n[r]: https://e.com').includes('href="https://e.com"'), 'reference links');
assert.ok(R('Title\n=====').includes('<h1>Title</h1>') && R('Title\n-----').includes('<h2>Title</h2>'), 'underlined headings');
assert.ok(R('    code').includes('<pre><code>code</code></pre>'), 'indented code');
assert.ok(R('<https://e.com>').includes('href="https://e.com"') && R(':tada:').includes('🎉'));
assert.ok(!R('<script>alert(1)</script>').includes('<script'), 'raw HTML stays text');
assert.ok(R('- [ ] a\n- [x] b').includes('data-mdl="1"'), 'checkbox line numbers survive definitions being removed');
assert.ok(R('[x]: https://e.com\n- [ ] a').includes('data-mdl="1"'));

/* wide editor + task panel */
const t = A.quickAdd('Write report', {}); t.notes = 'a **b**';
U.page = 'tasks'; U.sel = t.id; A.renderDetail(); U.nMode = 'write'; A.renderDetail();
assert.ok(A.els['#detail'].innerHTML.includes('data-act="nexpand"'), 'task notes have an expand button');
assert.ok(A.els['#detail'].innerHTML.includes('data-md'), 'task notes textarea is a Markdown editor');
A.openNoteExpand(t.id); assert.ok(A.els['#modal'].innerHTML.includes('id="x-ta"') && A.els['#modal'].innerHTML.includes('mbox xl'), 'wide editor opens');

/* Gantt: plan + actual dates, editing the actual end */
t.start = '2026-10-01'; t.due = '2026-10-05'; t.astart = '2026-10-02';
A.renderDetail(); const d = A.els['#detail'].innerHTML;
assert.ok(d.includes('data-f="aend"') && d.includes('data-act="gxstart"') && d.includes('gx-mini'), 'plan & actual panel');
t.status = 'done'; t.doneAt = new Date(2026, 9, 8, 12).getTime();
const gd = A.ganttDates(t, true); eq([gd.ps, gd.pe, gd.as, gd.ae], ['2026-10-01', '2026-10-05', '2026-10-02', '2026-10-08']);
assert.equal(A.gtStatus(gd)[0], 'Completed late');
A.gtApply({ k: 'task', t }, 'act', 'r', -2, gd); assert.equal(new Date(t.doneAt).getDate(), 6, 'pulling the actual bar\'s right edge moves the finish date');
A.gtApply({ k: 'task', t }, 'act', 'r', -50, A.ganttDates(t, true)); assert.equal(new Date(t.doneAt).getDate(), 2, 'finish never goes before the start');
U.page = 'gantt'; U.gList = 'all'; A.render(); const g = A.els['#main'].innerHTML;
assert.ok(g.includes('gt-ba') && g.includes('lanes') && g.includes('gt-sum') && g.includes('Today'), 'gantt renders lanes, summary and today marker');
t.status = 'open'; delete t.doneAt; t.due = '2026-09-01'; t.start = '2026-08-30'; A.render();
assert.ok(A.els['#main'].innerHTML.includes('gt-ov'), 'an overdue open task shows the overrun stretch');
assert.ok(A.GT_COLS.actual, 'combined actual column exists');

/* timetable views */
U.page = 'timetable'; U.ttV = null;
for (const v of ['day', '3day', 'week']) { S.settings.tt.view = v; U.ttV = v; A.render(); }
S.settings.tt.view = '3day'; U.ttV = '3day'; eq(A.ttDays().length, 3);
S.settings.tt.view = 'day'; U.ttV = 'day'; A.render(); assert.ok(A.els['#main'].innerHTML.includes('tt-strip'), 'day view has the week strip');
A.ACT.ttview({ dataset: { v: 'week' } }); assert.equal(A.ttView(), 'week');
console.log('0.6 feature tests passed');
