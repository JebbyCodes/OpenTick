// 1.0: block editor model, note locations, banners, delete-everything / replace, widgets, the "Edited" label bug.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { makeApp } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const A = makeApp(), S = A.S;
const mkT = (title, o = {}) => { const t = A.newTask({ title, ...o }); S.tasks.push(t); return t; };
const mkN = (o = {}) => { const n = A.newNote(o); S.notes.push(n); return n; };
const ser = d => A.blkSerialize(d);

/* ---- the "Edited just now" bubble that replaced the note: the footer label must not share the editor's id ---- */
{
  const notes = readFileSync(new URL('../src/js/notes.js', import.meta.url), 'utf8'), ui = readFileSync(new URL('../src/js/ui.js', import.meta.url), 'utf8');
  assert.equal((notes.match(/id="\$\{pre\}-ed"/g) || []).length, 1, 'the editor container is #n-ed (built from ${pre}-ed)');
  assert.equal((notes.match(/id="n-ed"/g) || []).length, 0, 'nothing else is called n-ed');
  assert.ok(notes.includes('id="n-when"') && ui.includes("$('#n-when')"), 'the footer label has its own id and the updater uses it');
  assert.ok(!ui.includes("$('#n-ed')"), 'the label updater no longer targets the editor container');
}

/* ---- block model: any note text survives being read into blocks and put back, byte for byte ---- */
{
  const samples = ['', 'a', 'a\n', '\n\na\n\n\nb\n\n', '# T\n\nPara\nsoft\n\n- a\n- b\n  - c\n\n1. x\n2. y\n\n> q1\n> q2\n\n```js\nconst a=1;\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n---\n\n[^1]: note\n',
    '- [ ] one\n- [x] two\n\n- loose\n\n- items\n', '```\nunclosed\n\ntext', '```\n```\n\nafter', 'Setext\n===\n\ntext\n---\n\n    indented\n\n    code\n\nend', 'trailing  \nspaces  \n\n   \n\nws', '>no space\n>second', '> a\n>b', '# A #\n\n## B\n\n#tag', '* s\n+ p\n1) q\n10. t', '- a\n  continued\n- b', 'x\n\n\n\n\ny'];
  for (const s of samples) { const d = A.blkParse(s); assert.equal(d.empty ? '' : ser(d), s, 'roundtrip ' + JSON.stringify(s)); }
  const frag = ['# H', '## h2', 'text', 'more text', '- a', '  - b', '1. n', '- [ ] t', '- [x] d', '> q', '```', '```js', '~~~', '| a | b |', '|---|---|', '| 1 | 2 |', '---', '', '', '', '    ind', '[^1]: f', '[r]: https://x.y', 'a  ', '===', '   ', '\t- tab', '- ', '#', '>'];
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let k = 0; k < 3000; k++) { const s = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => frag[Math.floor(rnd() * frag.length)]).join('\n') + (rnd() < .3 ? '\n' : ''); const d = A.blkParse(s); if (!d.empty) assert.equal(ser(d), s, 'fuzz ' + JSON.stringify(s)); }
  // the shipped cheat-sheet note too
  const sheet = S.notes.find(n => /cheat/i.test(n.title)); if (sheet) assert.equal(ser(A.blkParse(sheet.body)), sheet.body, 'the cheat-sheet note');
}

/* ---- block kinds, shortcuts and operations ---- */
{
  const kinds = s => A.blkParse(s).blocks.map(b => b.kind).join(',');
  assert.equal(kinds('# H\n\ntext\n\n- a\n- [ ] b\n\n> q\n\n```\nc\n```\n\n| a |\n|---|\n| 1 |\n\n---'), 'h,p,li,li,quote,code,table,raw');
  const b = A.blkDoc('').blocks[0]; b.text = '## Title'; assert.ok(A.blkShortcut(b) && b.kind === 'h' && b.pre === '## ' && b.text === 'Title', '"## " becomes a heading');
  for (const [t, pre] of [['- x', '- '], ['1. x', '1. '], ['[] x', '- [ ] '], ['> x', '> ']]) { const c = A.blkDoc('').blocks[0]; c.text = t; assert.ok(A.blkShortcut(c) && c.pre === pre && c.text === 'x', t + ' converts'); }
  const li = A.blkParse('1. one').blocks[0]; assert.equal(A.liNext(li), '2. ', 'numbers count up'); assert.equal(A.liNext(A.blkParse('- [x] d').blocks[0]), '- [ ] ', 'a new to-do starts unticked');
  // Enter in the middle of a paragraph and of a list item
  let d = A.blkParse('Hello world\n\nnext'); const r = A.blkSplit(d, 0, 5); assert.equal(ser(d), 'Hello\n\n world\n\nnext'); eq(r, { i: 1, pos: 0 });
  d = A.blkParse('- a\n- b'); A.blkSplit(d, 0, 1); assert.equal(ser(d), '- a\n- \n- b');
  // Enter on an empty item leaves the list (an indented one goes out one level first)
  d = A.blkParse('- a\n  - '); A.blkLeaveList(d.blocks[1]); assert.equal(d.blocks[1].pre, '- '); A.blkLeaveList(d.blocks[1]); assert.equal(d.blocks[1].kind, 'p');
  // Backspace at the start joins blocks; code is never glued to its neighbours
  d = A.blkParse('one\n\ntwo'); const m = A.blkMergeUp(d, 1); assert.equal(ser(d), 'onetwo'); eq(m, { i: 0, pos: 3 });
  d = A.blkParse('```\nx\n```\n\ntail'); A.blkMergeUp(d, 1); assert.equal(d.blocks.length, 2, 'code and the paragraph stay separate');
  // turn into / indent / tick / move / duplicate
  d = A.blkParse('plain text'); A.blkTurn(d.blocks[0], 'h2'); assert.equal(ser(d), '## plain text'); A.blkTurn(d.blocks[0], 'todo'); assert.equal(ser(d), '- [ ] plain text'); A.blkTurn(d.blocks[0], 'code'); assert.equal(ser(d), '```\nplain text\n```'); A.blkTurn(d.blocks[0], 'p'); assert.equal(ser(d), 'plain text');
  d = A.blkParse('- [ ] t'); assert.ok(A.liToggle(d.blocks[0])); assert.equal(ser(d), '- [x] t'); assert.ok(A.liShift(d.blocks[0], 1)); assert.equal(ser(d), '  - [x] t'); assert.ok(A.liShift(d.blocks[0], -1) && !A.liShift(d.blocks[0], -1));
  d = A.blkParse('a\n\nb\n\nc'); A.blkMove(d, 0, 2); assert.equal(ser(d), 'b\n\nc\n\na'); A.blkDuplicate(d, 0); assert.equal(ser(d), 'b\n\nb\n\nc\n\na');
  d = A.blkParse('text'); A.blkInsertAfter(d, 0, 'raw', '---'); assert.equal(ser(d), 'text\n\n---', 'a divider goes in with a paragraph after it to carry on typing'); assert.equal(d.blocks.length, 3);
  // a paste that is really several blocks is split up
  const pb = A.blkParse('x').blocks[0]; pb.text = '## Pasted\n\n- a\n- b\n\nend'; assert.equal(A.blkReparse(pb).map(x => x.kind).join(','), 'h,li,li,p');
  // a list next to a paragraph gets a blank line between them once edited
  d = A.blkParse('- a\n- b'); d.blocks[1].kind = 'p'; d.blocks[1].pre = ''; A.blkFixGaps(d, 1); assert.equal(ser(d), '- a\n\nb');
  // the slash menu: filtering, and to-dos / code / dividers are in it
  const itemsFor = q => A.bedMenuItems({ o: { pre: 'n' } }, { type: 'slash', q }).map(x => x.id);
  assert.ok(itemsFor('head').includes('h1') && itemsFor('todo').includes('todo') && itemsFor('div').includes('hr') && itemsFor('tab').includes('table'));
  assert.ok(A.BED_CMDS.some(c => c.id === 'image') && A.BED_CMDS.some(c => c.id === 'note'));
}

/* ---- no feature of the old editor was dropped: Source / Split / Preview, toolbar, shortcuts, files are still wired ---- */
{
  const notes = readFileSync(new URL('../src/js/notes.js', import.meta.url), 'utf8');
  for (const m of ["'blocks', 'Edit'", "'write', 'Source'", "'split', 'Split'", "'preview', 'Preview'"]) assert.ok(notes.includes(m), 'mode button ' + m);
  const main = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8'), files = readFileSync(new URL('../src/js/files.js', import.meta.url), 'utf8');
  assert.ok(main.includes("mdTab") && main.includes('mdEnter'), 'list continuation and Tab indentation remain for Source view');
  assert.ok(files.includes('textarea[data-bk]'), 'pasting / dropping files works inside blocks');
  A.U.page = 'notes'; const n = mkN({ title: 'Blocks', body: '# H\n\n- [ ] t' }); A.U.noteSel = n.id; A.renderNotes();
  const html = A.els['#main'].innerHTML; assert.ok(html.includes('id="n-bed"') && html.includes('id="n-ta"') && html.includes('id="n-pv"') && html.includes('ed-blocks'), 'Edit mode keeps the Source box and preview pane in the page');
  assert.ok(html.includes('data-act="nfmt"'), 'the formatting toolbar is still there');
}

/* ---- notes live in a list or a project ---- */
{
  const l1 = { id: 'l1', name: 'Work', color: '#4772fa', sections: [], created: 1, parent: null }, l2 = { id: 'l2', name: 'Sub', color: '#e5484d', sections: [], created: 1, parent: 'l1' }, l3 = { id: 'l3', name: 'Home', color: '#2ea043', sections: [], created: 1, parent: null };
  S.lists.push(l1, l2, l3); S.projects.push({ id: 'p1', name: 'Launch', color: '#8e5cf7', listIds: ['l3'], created: 1 });
  const a = mkN({ title: 'A' }), b = mkN({ title: 'B', listId: 'l1' }), c = mkN({ title: 'C', listId: 'l2' }), d = mkN({ title: 'D', projectId: 'p1' }), e = mkN({ title: 'E', listId: 'l3' });
  const ids = sc => S.notes.filter(n => A.noteInScope(n, sc)).map(n => n.title).filter(t => 'ABCDE'.includes(t)).sort().join('');
  assert.equal(ids(''), 'ABCDE'); assert.equal(ids('none'), 'A'); assert.equal(ids('list:l1'), 'BC', 'a list includes its sublists'); assert.equal(ids('list:l2'), 'C');
  assert.equal(ids('project:p1'), 'DE', 'a project includes notes filed in its lists');
  assert.equal(A.noteHomeValue(b), 'l:l1'); assert.equal(A.noteHomeValue(d), 'p:p1'); assert.equal(A.noteHomeValue(a), '');
  A.noteSetHome(a, 'p:p1'); assert.equal(a.projectId, 'p1'); assert.ok(!a.listId); A.noteSetHome(a, 'l:l2'); assert.equal(a.listId, 'l2'); assert.ok(!a.projectId, 'one home at a time'); A.noteSetHome(a, ''); assert.equal(A.noteHomeValue(a), '');
  eq(A.noteHomePatch('list:l1'), { listId: 'l1' }); eq(A.noteHomePatch('project:p1'), { projectId: 'p1' }); eq(A.noteHomePatch(''), {});
  // scope filtering in the list, and a scope that points at something deleted falls back to all notes
  S.settings.notes.scope = 'list:l1'; assert.equal(A.noteList().filter(n => 'ABCDE'.includes(n.title)).map(n => n.title).sort().join(''), 'BC');
  S.settings.notes.scope = 'list:gone'; assert.equal(A.noteScope(), '', 'a deleted scope shows everything again'); S.settings.notes.scope = '';
  // grouping by home puts a heading over each group
  S.settings.notes.group = true; const gh = A.noteListHtml(); assert.ok(gh.includes('Launch') && gh.includes('Work') && gh.includes('Not in a list or project'), 'grouped by project / list'); S.settings.notes.group = false;
  // deleting a list or project unfiles its notes
  A.notesDetach('list', 'l1'); assert.ok(!b.listId && c.listId === 'l2'); A.notesDetach('project', 'p1'); assert.ok(!d.projectId);
  S.lists = S.lists.filter(l => !['l1', 'l2', 'l3'].includes(l.id)); S.projects = []; S.notes = S.notes.filter(n => !'ABCDE'.includes(n.title));
}

/* ---- banners ---- */
{
  assert.equal(A.bannerCss({ type: 'color', c: '#336699' }), 'background:#336699');
  assert.match(A.bannerCss({ type: 'gradient', a: '#112233', b: '#445566', angle: 90 }), /linear-gradient\(90deg,#112233,#445566\)/);
  assert.match(A.bannerCss({ type: 'pattern', c: '#336699', pat: 'waves' }), /background-image:url\("data:image\/svg\+xml,/);
  assert.match(A.bannerCss({ type: 'image', img: 'data:image/jpeg;base64,AAAA', y: 30 }), /center 30%/);
  // values from a synced record are checked before they reach CSS
  assert.equal(A.bannerCss({ type: 'color', c: 'red;background:url(x)' }, '#111111'), 'background:#111111', 'a hostile colour is replaced');
  assert.equal(A.bannerCss({ type: 'image', img: 'javascript:alert(1)' }), '', 'only data:image pictures are drawn');
  assert.equal(A.bannerCss({ type: 'image', img: 'data:image/jpeg;base64,AAAA");x:url("' }), '');
  assert.equal(A.bannerCss({ type: 'nonsense' }), ''); assert.equal(A.bannerCss(null), '');
  const o = { id: 'x' }; A.bannerSet(o, { type: 'color', c: '#336699', size: 'slim' }); assert.equal(o.banner.size, 'slim'); A.bannerSet(o, { type: 'none' }); assert.ok(!('banner' in o), 'None removes it');
  S.settings.banners = true; assert.ok(A.bannerHtml('list', { id: 'a', name: 'A', color: '#111111', banner: { type: 'color', c: '#222222' } }).includes('class="bnr'));
  S.settings.banners = false; assert.equal(A.bannerHtml('list', { id: 'a', color: '#111111', banner: { type: 'color', c: '#222222' } }), '', 'the setting hides all banners'); S.settings.banners = true;
  assert.ok(A.BANNER_GRADS.length >= 8);
  // shown above a list's header
  const l = { id: 'lb', name: 'Banner list', color: '#4772fa', sections: [], created: 1, parent: null, banner: { type: 'gradient', a: '#112233', b: '#445566', angle: 120 } }; S.lists.push(l);
  A.U.page = 'tasks'; A.U.nav = 'list:lb'; A.renderMain(); assert.ok(A.els['#main'].innerHTML.includes('class="bnr'), 'the banner is drawn above the list');
  S.lists = S.lists.filter(x => x.id !== 'lb'); A.U.nav = 'today';
}

/* ---- delete everything, and replace on import ---- */
(async () => {
  const B = makeApp(), T = B.S; B.U.page = 'notes';
  T.tasks.push(B.newTask({ title: 'keep me?' })); T.notes.push(B.newNote({ title: 'n1' })); T.projects.push({ id: 'pp', name: 'P', color: '#111111', listIds: [], created: 1 });
  const c = B.dataCounts(); assert.ok(c.tasks >= 1 && c.notes >= 2 && c.projects === 1); assert.match(B.dataCountsText(c), /task/);
  T.settings.theme = 'light'; const key = await B.wipeAll({ files: false });
  const S2 = B.S; assert.equal(B.dataCounts().tasks, 0, 'no tasks left'); assert.equal(S2.notes.length, 0); assert.equal(S2.projects.length, 0); assert.equal(S2.habits.length, 0);
  assert.ok(S2.lists.some(l => l.id === 'inbox') && S2.lists.length === 1, 'only the Inbox remains'); assert.equal(S2.settings.theme, 'light', 'settings are kept unless asked');
  assert.ok(Object.keys(S2.tomb).length > 0, 'deletions are recorded so sync passes them on'); assert.equal(S2.history.length, 1, 'the history log starts afresh'); assert.equal(typeof key, 'string');
  await B.wipeAll({ settings: true, files: false }); assert.notEqual(B.S.settings.theme, 'light', 'reset settings on request');
  // merging a backup into existing data keeps both; the file's items arrive
  const C = makeApp(), U2 = C.S; U2.tasks.push(C.newTask({ title: 'mine' }));
  const other = makeApp(); other.S.tasks.push(other.newTask({ title: 'theirs' })); const snap = JSON.parse(JSON.stringify(other.snapshot()));
  const r = C.backupMerge(snap); assert.ok(C.S.tasks.some(t => t.title === 'mine') && C.S.tasks.some(t => t.title === 'theirs'), 'merge keeps both'); assert.ok(r.tasks >= 1);
  // the confirmation dialog: both flows go through askWipe, and typing DELETE is required for delete-all
  const data = readFileSync(new URL('../src/js/data.js', import.meta.url), 'utf8'), imp = readFileSync(new URL('../src/js/import.js', import.meta.url), 'utf8');
  assert.ok(/typed: true/.test(data) && /toUpperCase\(\) !== 'DELETE'/.test(data), 'delete-all needs DELETE typed');
  assert.ok(/askWipe\(/.test(imp) && /wipeAll\(/.test(imp), 'the import-and-replace option asks first, then clears everything');
  assert.ok(/data-o="replace"/.test(imp), 'the option is in the import dialog');
  console.log('1.0 data tests passed');
  await widgets();
})().catch(e => { console.error(e); process.exit(1); });

/* ---- widgets ---- */
async function widgets() {
  const W = makeApp(), T = W.S, td = W.todayStr();
  T.tasks.length = 0; const day = n => new Date(Date.parse(td + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10), yest = day(-1), tom = day(1);
  const add = (title, o) => { const t = W.newTask({ title, ...o }); T.tasks.push(t); return t; };
  add('today late', { due: td, time: '18:00', priority: 1 }); add('today early', { due: td, time: '08:00', priority: 3 }); add('overdue', { due: yest }); add('tomorrow', { due: tom }); add('no date'); const dn = add('done', { due: td }); dn.status = 'done';
  assert.equal(W.widgetTasks().map(t => t.t).join('|'), 'overdue|today early|today late', 'overdue first, then by time; later and undated tasks are left out');
  const snap = W.widgetSnapshot(); assert.equal(snap.total, 3); assert.ok(/^#[0-9a-f]{6}$/i.test(snap.theme.bg) || snap.theme.bg, 'a theme is included');
  assert.equal(W.cssHex('nonsense-colour', '#123456'), '#123456');
  // Android sources: placeholders, manifest entries and XML are all there
  const base = new URL('../src-tauri/android-widgets/', import.meta.url);
  for (const f of ['kotlin/OpenTickWidgetData.kt', 'kotlin/OpenTickTasksWidget.kt', 'kotlin/OpenTickQuickWidget.kt', 'kotlin/OpenTickWidgetActivity.kt', 'kotlin/OpenTickWidgetBoot.kt', 'res/layout/ot_widget_tasks.xml', 'res/layout/ot_widget_quick.xml', 'res/xml/ot_widget_tasks_info.xml', 'res/xml/ot_widget_quick_info.xml', 'manifest-snippet.xml']) assert.ok(existsSync(new URL(f, base)), f + ' exists');
  const mf = readFileSync(new URL('manifest-snippet.xml', base), 'utf8'); for (const c of ['OpenTickTasksWidget', 'OpenTickQuickWidget', 'OpenTickWidgetActivity', 'OpenTickWidgetBoot']) assert.ok(mf.includes(c), c + ' is registered');
  const lay = readFileSync(new URL('res/layout/ot_widget_tasks.xml', base), 'utf8'), kt = readFileSync(new URL('kotlin/OpenTickTasksWidget.kt', base), 'utf8');
  for (let i = 0; i < 8; i++) for (const p of ['r', 'c', 't', 'd']) { assert.ok(lay.includes(`@+id/ot_${p}${i}"`), `row ${i} id ${p}`); assert.ok(kt.includes(`R.id.ot_${p}${i}`), `Kotlin uses ${p}${i}`); }
  const ci = readFileSync(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8'); assert.ok(ci.includes('scripts/android-widgets.mjs'), 'CI installs the widgets');
  const cap = JSON.parse(readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8')); assert.ok(cap.permissions.some(p => p === 'fs:allow-mkdir') && cap.permissions.some(p => p.identifier === 'fs:scope'), 'the app may write its widget file');
  console.log('1.0 feature tests passed');
}
