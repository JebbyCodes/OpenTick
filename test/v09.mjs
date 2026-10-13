// 0.9: notes fixes, durations & reminders, themes, attachments, links, batch editing, edited markers, Gantt tools.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const A = makeApp(), S = A.S;
const mkT = (title, o = {}) => { const t = A.newTask({ title, ...o }); S.tasks.push(t); return t; };
const mkN = (o = {}) => { const n = A.newNote(o); S.notes.push(n); return n; };

/* ---- notes: Write / Split / Preview buttons work on the Notes page; titles render markdown ---- */
{
  let mode = null; const btn = { dataset: { ed: 'n', mode: 'preview' } };
  S.settings.notes = S.settings.notes || {};
  A.U.page = 'notes'; const n = mkN({ title: '', body: '**Bold** plan with `code`' }); A.U.noteSel = n.id; A.renderNotes();
  A.fire('click', { '[data-ed]': btn });
  assert.equal(S.settings.notes.view, 'preview', 'the Preview button changes the mode');
  btn.dataset.mode = 'write'; A.fire('click', { '[data-ed]': btn }); assert.equal(S.settings.notes.view, 'write', 'and so does Write');
  assert.equal(A.noteTitle(n), 'Bold plan with code', 'the plain-text title has no markup');
  assert.match(A.noteTitleHtml(n), /<strong>Bold<\/strong>/, 'the list title is rendered as markdown');
  assert.match(A.els['#main'].innerHTML, /<strong>Bold<\/strong> plan/, 'the notes list shows it');
  const m2 = mkN({ body: '- [ ] **Buy** milk\n\nmore' }); assert.equal(A.noteTitle(m2), 'Buy milk', 'a list marker is removed, the emphasis stays');
  assert.equal(A.noteTitle(mkN({ body: '## Heading *two*' })), 'Heading two');
  assert.equal(A.noteTitle(mkN({ title: '`x` y' })), 'x y');
  assert.equal(A.noteByTitle('Bold plan with code').id, n.id, 'wiki links find a note by its plain title');
  assert.ok(!A.noteSnippet(n).includes('**'), 'snippets are plain text');
}

/* ---- duration: any number of minutes, typed or from presets ---- */
{
  const t = mkT('Dur'); A.U.sel = t.id; A.render();
  const html = A.els['#detail'].innerHTML; assert.ok(html.includes('data-dur="task"') && html.includes('class="dh"') && html.includes('class="dm"'), 'hours + minutes boxes');
  assert.ok(!html.includes('data-f="dur"'), 'no more fixed dropdown');
  const box = n => ({ querySelector: s => ({ '.dh': { value: n[0] }, '.dm': { value: n[1] } }[s]), querySelectorAll: () => [] });
  assert.equal(A.durRead(box(['1', '25'])), 85); assert.equal(A.durRead(box(['', '7'])), 7); assert.equal(A.durRead(box(['', ''])), null); assert.equal(A.durRead(box(['0', '0'])), null);
  assert.equal(A.durRead(box(['2', '90'])), 210, 'minutes may exceed 59');
  assert.ok(A.durHtml('x', 95).includes('value="1"') && A.durHtml('x', 95).includes('value="35"'));
  // typed into the panel
  const dbox = box(['0', '50']); A.fire('input', { '#detail [data-dur=task]': dbox }, { target: { closest: s => (s === '#detail [data-dur=task]' ? dbox : null), dataset: {} } });
  assert.equal(t.dur, 50, 'typing 50 minutes stores 50');
  // preset button
  A.fire('click', { '[data-dp]': { dataset: { dp: '45' }, closest: s => (s === '#detail [data-dur=task]' ? {} : null) } }); assert.equal(t.dur, 45);
}

/* ---- reminder: presets and any amount before ---- */
{
  eq(A.remParts(90), { n: 90, u: 1 }); eq(A.remParts(120), { n: 2, u: 60 }); eq(A.remParts(2880), { n: 2, u: 1440 }); eq(A.remParts(20160), { n: 2, u: 10080 });
  assert.equal(A.remLabel(null), 'No reminder'); assert.equal(A.remLabel(0), 'On time'); assert.equal(A.remLabel(45), '45 minutes before'); assert.equal(A.remLabel(60), '1 hour before'); assert.equal(A.remLabel(4320), '3 days before');
  assert.match(A.remHtml('task', 45), /Custom…/); assert.ok(!/class="remc" hidden/.test(A.remHtml('task', 45)), 'a value outside the presets opens the custom fields');
  assert.ok(/class="remc" hidden/.test(A.remHtml('task', 30)), 'a preset keeps them closed');
  const rb = (v, n, u) => ({ querySelector: s => ({ '.rsel': { value: v }, '.rn': { value: n }, '.ru': { value: u } }[s]) });
  assert.equal(A.remRead(rb('', 1, 1)), null); assert.equal(A.remRead(rb('15', 1, 1)), 15); assert.equal(A.remRead(rb('custom', '2.5', '60')), 150); assert.equal(A.remRead(rb('custom', '3', '1440')), 4320); assert.equal(A.remRead(rb('keep', 1, 1)), undefined);
  const t = mkT('Rem', { due: '2026-10-20' }); A.U.sel = t.id; A.render();
  const box = rb('custom', '40', '1');
  A.fire('change', {}, { target: { closest: s => (s === '#detail [data-rem=task]' ? box : null), classList: { contains: c => c === 'rsel' }, value: 'custom', dataset: {} } });
  assert.equal(t.reminder, 40, 'a custom lead time is stored in minutes');
}

/* ---- timetable: whole day by default ---- */
{
  const old = A.migrate({ tasks: [], lists: [], settings: { tt: { from: 7, to: 21 } } }); assert.deepEqual([old.settings.tt.from, old.settings.tt.to], [0, 24], 'the old default range becomes the whole day');
  const kept = A.migrate({ tasks: [], lists: [], settings: { tt: { from: 9, to: 17, v: 2 } } }); assert.deepEqual([kept.settings.tt.from, kept.settings.tt.to], [9, 17], 'a range chosen afterwards is respected');
  assert.deepEqual([S.settings.tt.from, S.settings.tt.to], [0, 24]);
  const t = mkT('All day thing', { due: A.todayStr ? A.todayStr() : '2026-10-08' }); A.U.page = 'timetable'; A.renderTimetable();
  const h = A.els['#main'].innerHTML; assert.ok(h.includes('00:00') && h.includes('23:00'), 'every hour is drawn'); assert.ok(h.includes('class="chip adc'), 'all-day tasks are real, tappable rows');
  assert.ok(/class="chk sm[^"]*" data-act="toggle"/.test(h), 'with a checkbox');
  assert.ok(A.TT_MINH() >= 30, 'blocks have a minimum height');
}

/* ---- custom themes ---- */
{
  const r = A.themeImport('/* @name: Ocean */\n/* @base: dark */\n:root{--bg:#101820;--text:#e8eef5;--acc:#4cc9f0}\n.task{border-radius:14px}', 'ocean.css');
  assert.equal(r.rec.id, 'custom:ocean'); assert.equal(S.settings.theme, 'custom:ocean'); assert.equal(r.rec.base, 'dark');
  assert.ok(S.settings.customThemes.length === 1); assert.equal(A.customTheme('custom:ocean').name, 'Ocean');
  const css = A.themeScope(r.rec.css, r.rec.id);
  assert.ok(css.includes('html:root[data-custom="custom:ocean"]{--bg:#101820'), ':root is scoped to the theme'); assert.ok(css.includes('html:root[data-custom="custom:ocean"] .task'), 'other rules are scoped too');
  assert.ok(A.themeList().some(x => x[0] === 'custom:ocean' && x[2] === '#101820'), 'it appears in the theme list with its colours');
  assert.ok(A.themeSectionHtml().includes('custom:ocean'));
  // safety
  const bad = A.themeNormalise('@import url(https://evil.example/x.css);:root{--bg:#000;background:url(https://evil.example/a.png);x:expression(alert(1))}', 'bad.css').css;
  assert.ok(!/@import|evil\.example|expression\(/i.test(bad), 'imports, remote urls and scripts are dropped');
  // other forms
  assert.ok(A.themeNormalise('--bg: #fff; --text: #111;', 'bare.css').css.startsWith(':root{'), 'bare declarations are accepted');
  assert.equal(A.themeNormalise('{"name":"Json","base":"light","vars":{"bg":"#fafafa","--acc":"#c00"}}', 'x.json').css.includes('--bg:#fafafa'), true, 'a JSON theme works');
  assert.throws(() => A.themeNormalise('   ', 'e.css'), /empty/); assert.throws(() => A.themeNormalise('x'.repeat(300000), 'big.css'), /too large/);
  // media queries and several selectors
  const sc = A.themeScope('@media (max-width:600px){.a,.b{color:red}} [data-theme="x"] .c{top:0} html{--a:1}', 'custom:t');
  assert.ok(sc.includes('@media (max-width:600px){html:root[data-custom="custom:t"] .a,html:root[data-custom="custom:t"] .b{color:red}}'), sc); assert.ok(sc.includes('html:root[data-custom="custom:t"] .c'), sc);
  A.themeRemove('custom:ocean'); assert.equal(S.settings.theme !== 'custom:ocean', true); assert.equal(S.settings.customThemes.length, 0);
  const mig = A.migrate({ tasks: [], lists: [], settings: { theme: 'custom:zzz', customThemes: [{ id: 'custom:zzz', name: 'Z', css: ':root{}' }] } }); assert.equal(mig.settings.theme, 'custom:zzz', 'a saved custom theme survives loading');
  assert.notEqual(A.migrate({ tasks: [], lists: [], settings: { theme: 'custom:gone' } }).settings.theme, 'custom:gone', 'a missing one falls back');
}

/* ---- attachments ---- */
{
  assert.equal(A.fileKind({ name: 'Report.PDF' }), 'pdf'); assert.equal(A.fileKind({ name: 'a.png', type: 'image/png' }), 'image'); assert.equal(A.fileKind({ name: 'b.docx' }), 'doc'); assert.equal(A.fileKind({ name: 'c.xlsx' }), 'sheet'); assert.equal(A.fileKind({ name: 'd.mp3' }), 'audio'); assert.equal(A.fileKind({ name: 'e.md' }), 'text'); assert.equal(A.fileKind({ name: 'f.bin' }), 'other');
  assert.equal(A.fileSize(500), '500 B'); assert.equal(A.fileSize(1536), '1.5 KB'); assert.equal(A.fileSize(5 * 1048576), '5.0 MB');
  const t = mkT('With file'); t.files = [{ id: 'f1', name: 'Plan.pdf', type: 'application/pdf', size: 20480, added: 1 }, { id: 'f2', name: 'pic.png', type: 'image/png', size: 100, added: 2 }];
  const h = A.filesHtml('task', t.id); assert.ok(h.includes('Plan.pdf') && h.includes('data-fa="open"') && h.includes('data-fa="rm"') && h.includes('data-fa="ins"'), 'rows can open, remove and insert');
  assert.ok(h.includes('class="fth" data-file="f2"'), 'pictures get a thumbnail'); assert.ok(h.includes('fext'), 'PDFs get a badge');
  assert.equal(A.fileMd(t.files[0]), '[Plan.pdf](ot-file:f1)'); assert.equal(A.fileMd(t.files[1]), '![pic.png](ot-file:f2)');
  // markdown
  assert.match(A.md('[Plan.pdf](ot-file:f1)'), /<a class="fl" data-file="f1"/); assert.match(A.md('![pic](ot-file:f2)'), /<img class="fimg" data-file="f2"/);
  assert.ok(!A.md('[x](ot-file:../evil)').includes('data-file'), 'only plain ids are accepted');
  assert.equal(A.mdInline('[Plan.pdf](ot-file:f1)', true), 'Plan.pdf', 'titles never become links');
  assert.match(A.noteBadge(t), /paperclip|2/, 'the row shows an attachment count');
  assert.ok(A.scopeTasks('all').length >= 0);
  // pasted files in a note go to the note
  const n = mkN({ title: 'N' }); assert.ok(A.filesHtml('note', n.id).includes('data-k="note"'));
}

/* ---- links between notes and tasks; repeating tasks keep notes ---- */
{
  const n = mkN({ title: 'Spec', body: 'long text' }), t = mkT('Write spec', { due: '2026-10-09' });
  A.setLink(t, n.id, true); eq(t.links, [n.id]); A.setLink(t, n.id, true); assert.equal(t.links.length, 1, 'linking twice is one link');
  eq(A.linkedNotes(t).map(x => x.id), [n.id]); eq(A.linkedTasks(n).map(x => x.id), [t.id], 'the other direction is derived');
  assert.ok(A.linkedNotesHtml(t).includes('Spec') && A.linkedNotesHtml(t).includes('data-act="lnkopen"')); assert.ok(A.noteLinksHtml(n).includes('Write spec') && A.noteLinksHtml(n).includes('data-act="nlnkopen"'));
  assert.match(A.noteBadge(t), /1/, 'task rows show the linked-note count');
  // repeating
  const r = mkT('Weekly review', { due: '2026-10-09', repeat: { every: 1, unit: 'week' }, notes: '- [x] inbox zero\n- [ ] plan\nkeep this' }); A.setLink(r, n.id, true); r.files = [{ id: 'ff', name: 'a.pdf', type: '', size: 1, added: 1 }];
  A.toggleDone(r);
  assert.equal(r.status, 'open'); assert.ok(r.due > '2026-10-09', 'rolled to the next date');
  assert.equal(r.notes.includes('keep this'), true, 'notes persist'); eq(r.links, [n.id], 'the link persists'); assert.equal(r.files.length, 1, 'attachments persist');
  assert.match(r.notes, /- \[ \] inbox zero/, 'checked items start again');
  const rec = S.tasks.find(x => x.log && x.title === 'Weekly review'); assert.ok(rec && /- \[x\] inbox zero/.test(rec.notes), 'the finished occurrence keeps what was ticked'); eq(rec.links, [n.id]); assert.notEqual(rec.links, r.links, 'and its own copy of the list');
  // deleting a note drops the link
  A.U.noteSel = n.id; A.fire('click', {}, {}); S.notes = S.notes.filter(x => x !== n); eq(A.linkedNotes(t), [], 'a deleted note simply drops out');
}

/* ---- batch editing ---- */
{
  S.lists.push({ id: 'L2', name: 'Other', color: '#123', sections: [] });
  const a = mkT('A', { due: '2026-10-10', priority: 1 }), b = mkT('B', { priority: 2, tags: ['x'] }), c = mkT('C', { due: '2026-10-12', time: '09:00' });
  A.U.page = 'tasks'; A.batchStart(a.id); assert.ok(A.U.bsel.has(a.id));
  A.U.bsel.add(b.id); A.U.bsel.add(c.id); assert.equal(A.bIds().length, 3);
  const snap = A.batchApplyChanges([a.id, b.id, c.id], { priority: 3, reminder: 45, dur: 90, addTags: ['urgent'], delTags: ['x'], listId: 'L2', shift: 1 });
  assert.deepEqual([a.priority, b.priority, c.priority], [3, 3, 3]); assert.deepEqual([a.reminder, b.reminder, c.reminder], [45, 45, 45]); assert.deepEqual([a.dur, c.dur], [90, 90]);
  assert.ok(a.tags.includes('urgent') && b.tags.includes('urgent') && !b.tags.includes('x'), 'tags are added and removed'); assert.equal(a.listId, 'L2');
  assert.equal(a.due, '2026-10-11', 'dates move by a day'); assert.equal(c.due, '2026-10-13'); assert.ok(b.due, 'a task without a date given a reminder gets today');
  A.batchUndo(snap); const a2 = A.getT(a.id); assert.equal(a2.priority, 1, 'undo restores every field'); assert.equal(a2.due, '2026-10-10'); assert.equal(a2.reminder == null, true); assert.equal(A.getT(b.id).tags.join(), 'x');
  // keep/untouched fields stay
  A.batchApplyChanges([c.id], { due: null }); assert.equal(A.getT(c.id).due, null); assert.equal(A.getT(c.id).time, null, 'clearing the date clears the time');
  A.batchApplyChanges([a.id, b.id], { status: 'done' }); assert.equal(A.getT(a.id).status, 'done'); A.batchApplyChanges([a.id], { status: 'open' }); assert.equal(A.getT(a.id).status, 'open');
  // exit
  A.BATCH_ACT.bx(); assert.equal(A.U.bsel, null);
  // toggling by tap in selection mode
  A.U.page = 'tasks'; A.batchStart(null); A.fire('click', { '#main [data-act="open"][data-id],#main [data-act="toggle"][data-id]': { dataset: { id: b.id }, classList: { contains: () => false } } });
  assert.ok(A.U.bsel.has(b.id), 'a tap selects instead of opening'); A.BATCH_ACT.bx();
  A.openBatchEdit; assert.equal(typeof A.openBatchEdit, 'function');
}

/* ---- "edited" markers ---- */
{
  const t = mkT('Marked'); A.flush(); assert.equal(A.editedCls(t.id), '', 'new tasks are not "edited"');
  t.title = 'Marked again'; A.flush(); assert.equal(A.editedCls(t.id), ' edited', 'a change made here is flagged');
  assert.match(A.editedText(t), /Edited/); A.U.sel = t.id; A.render(); assert.ok(A.els['#detail'].innerHTML.includes('id="d-ed"') && A.els['#detail'].innerHTML.includes('data-sv'), 'the panel shows when it was edited and the save state');
  A.U.nav = 'all'; A.U.page = 'tasks'; A.renderTasks(); assert.ok(/class="task[^"]*edited/.test(A.els['#main'].innerHTML), 'the row is marked');
  A.EDITED.set(t.id, clock.t - 999999); assert.equal(A.editedCls(t.id), '', 'markers expire');
}

/* ---- Gantt: columns, svg export, yaml, options ---- */
{
  S.settings.gantt.cols = ['plan', 'notes', 'priority', 'x:owner']; const t = mkT('Chart', { start: '2026-10-05', due: '2026-10-12', notes: 'some **notes**', priority: 3 }); t.gx = { owner: 'Sam' };
  assert.ok(A.gtAllCols().includes('x:owner'), 'extra chart keys become columns'); assert.equal(A.gtCol('x:owner')[0], 'Owner');
  const d = A.ganttDates(t, true); assert.equal(A.gtCol('notes')[2](d, t), 'some notes'); assert.equal(A.gtCol('priority')[2](d, t), 'High'); assert.equal(A.gtCol('x:owner')[2](d, t), 'Sam');
  A.U.page = 'gantt'; A.U.gList = 'all'; A.renderGantt();
  assert.ok(!A.els['#main'].innerHTML.includes('OpenGantt</button>') && !A.els['#main'].innerHTML.includes('data-act="gpane"'), 'the embedded OpenGantt pane is gone');
  for (const x of ['data-act="gyaml"', 'data-act="gexport"', 'data-act="gfull"', 'data-act="gmenu"', 'data-act="gcolmenu"', 'data-i="']) assert.ok(A.els['#main'].innerHTML.includes(x), x);
  const M = A.gtModel(); assert.ok(M && M.rows.length > 1); const svg = A.gtSvg(M, { dark: false, title: true, legend: true });
  assert.ok(svg.svg.startsWith('<svg') && svg.svg.includes('Chart') && svg.svg.includes('Today') && svg.svg.includes('Planned'), 'the chart renders as a standalone SVG');
  assert.ok(A.gtSvg(M, { dark: true, title: false, legend: false }).svg.includes('#1b1d21'), 'dark colours'); assert.ok(!A.gtSvg(M, { title: false, legend: false }).svg.includes('Planned'), 'no legend when switched off');
  assert.ok(A.gtPages(M, { orient: 'landscape', paged: true }).length >= 1);
  assert.equal(A.gtRaw('planStart', d, t), '2026-10-05'); assert.equal(A.gtRaw('planDays', d, t), 8);
  // yaml editor
  A.U.gYaml = true; A.U.gList = S.lists[0].id; assert.match(A.gtYamlHtml(), /<textarea id="gt-ya"/); assert.match(A.gtYamlCheck('rows:\n  - label: x\n'), /1 rows/); assert.match(A.gtYamlCheck('title: x'), /rows/); A.U.gYaml = false;
  // chart file options
  A.ogApplyOpts({ scale: 'month', mode: 'planned', progress: false, columns: ['status', 'notes', 'planStart'] });
  assert.equal(S.settings.gantt.scale, 'month'); assert.equal(S.settings.gantt.mode, 'plan'); assert.equal(S.settings.gantt.progress, false); eq(S.settings.gantt.cols, ['status', 'notes', 'planStart'], 'columns from the file');
  // import applies them
  const text = 'title: Opts\nscale: year\nmode: actual\nrows:\n  - label: One\n    plan: [2026-10-01, 2026-10-03]\n';
  A.ogImportText(text, 'o.yaml', null); assert.equal(S.settings.gantt.scale, 'year'); assert.equal(S.settings.gantt.mode, 'actual');
}

console.log('0.9 feature tests passed');
