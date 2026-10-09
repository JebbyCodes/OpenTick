// OpenGantt interop: YAML subset, Markdown fence, task <-> row mapping, and the two-way linked-file sync.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);

const README = `title: Plan
scale: week
rows:
  - label: Stage 1 - Complete Initial Ideas   # comment
    plan: [2026-09-07, 2026-09-12]
    fact: [2026-09-07, 2026-09-14]
    children:
      - label: Complete Initial/Title Section
        plan: [2026-09-07, 2026-09-10]
        fact: [2026-09-07]
  - label: "Launch: day"
    plan: [2026-10-01]
    owner: Sam
    tags: [a, "b c"]
    notes: |
      line one
      # not a comment

      last
`;

/* ---------- YAML ---------- */
{
  const { ogYamlParse } = makeApp();
  const d = ogYamlParse(README);
  assert.equal(d.title, 'Plan'); assert.equal(d.rows.length, 2);
  eq(d.rows[0].plan, ['2026-09-07', '2026-09-12']);
  assert.equal(d.rows[0].label, 'Stage 1 - Complete Initial Ideas');
  eq(d.rows[0].children[0].fact, ['2026-09-07']);
  assert.equal(d.rows[1].label, 'Launch: day'); eq(d.rows[1].tags, ['a', 'b c']); assert.equal(d.rows[1].owner, 'Sam');
  assert.equal(d.rows[1].notes, 'line one\n# not a comment\n\nlast\n');
  eq(ogYamlParse('rows:\n- label: a\n  plan: [2026-01-01]\n- label: b\n'), { rows: [{ label: 'a', plan: ['2026-01-01'] }, { label: 'b' }] }); // unindented sequence
  eq(ogYamlParse('a: {x: 1, y: [1, 2]}\nb: "q\\"x"\nc: \'it\'\'s\'\nd: 3.5\ne: yes please'), { a: { x: 1, y: [1, 2] }, b: 'q"x', c: "it's", d: 3.5, e: 'yes please' });
  eq(ogYamlParse(''), {}); eq(ogYamlParse('# only a comment\n'), {});
  assert.throws(() => ogYamlParse('rows:\n\t- a'), /tabs/);
  assert.throws(() => ogYamlParse('a: 1\n   b: 2'), /unexpected indentation|expected/);
}
{ // writer round-trips awkward strings
  const { ogYamlParse, ogEmitRows, ogMergeYaml } = makeApp();
  const labels = ['plain', 'has: colon', 'a # hash', '123', 'true', ' lead', 'trail ', '"quoted"', "it's", '- dash', '[x]', 'ünï', '', 'multi\nline'];
  const rows = labels.map((l, i) => ({ label: l, plan: ['2026-01-0' + (i % 9 + 1)], notes: i % 2 ? 'n\nm' : 'single', tags: ['x', 'y, z'], children: i === 0 ? [{ label: 'kid', fact: ['2026-01-01', '2026-01-02'] }] : undefined }));
  rows.forEach(r => { if (!r.children) delete r.children; });
  const y = ogMergeYaml('', rows, ['title: T']), back = ogYamlParse(y);
  eq(back.rows.map(r => r.label), labels); eq(back.rows.map(r => r.notes.replace(/\n$/, '')), rows.map(r => r.notes)); eq(back.rows[0].children, rows[0].children); eq(back.rows[1].tags, ['x', 'y, z']);
  // other keys + trailing keys survive a rows rewrite
  const y2 = ogMergeYaml('# my chart\nscale: month\ncolumns: [progress, owner]\nrows:\n  - label: old\n    plan: [2026-01-01]\n\nheight: 700\n', [{ label: 'new' }], []);
  assert.ok(y2.startsWith('# my chart\nscale: month\ncolumns: [progress, owner]\nrows:\n  - label: new\n')); assert.ok(y2.includes('height: 700')); assert.ok(!y2.includes('old'));
  assert.equal(ogYamlParse(ogMergeYaml('', [], ['title: x'])).rows.length, 0);
}

/* ---------- Markdown note ---------- */
{
  const { ogExtract, ogCompose, ogMergeYaml, ogYamlParse } = makeApp();
  const note = '---\ntags: [x]\n---\n# Project\n\nBefore\n\n```gantt\nscale: week\nrows:\n  - label: a\n    plan: [2026-01-01]\n```\n\n```js\nconsole.log(1)\n```\n\nAfter\n';
  const ex = ogExtract(note, 'md'); assert.equal(ex.kind, 'md'); assert.ok(ex.yaml.startsWith('scale: week'));
  const out = ogCompose(note, ogMergeYaml(ex.yaml, [{ label: 'b', plan: ['2026-02-02'] }], []), 'md', 'P');
  assert.ok(out.startsWith('---\ntags: [x]\n---\n# Project\n\nBefore\n\n```gantt\nscale: week\nrows:\n  - label: b')); assert.ok(out.endsWith('```\n\n```js\nconsole.log(1)\n```\n\nAfter\n'));
  assert.equal(ogYamlParse(ogExtract(out, 'md').yaml).rows[0].label, 'b');
  const fresh = ogCompose('# Notes\n\ntext\n', 'rows: []\n', 'md', 'P'); assert.equal(fresh, '# Notes\n\ntext\n\n```gantt\nrows: []\n```\n');
  assert.ok(ogCompose('', 'rows: []\n', 'md', 'My list').startsWith('# My list\n\n```gantt\n'));
  const crlf = note.replace(/\n/g, '\r\n'), o2 = ogCompose(crlf, 'rows:\n  - label: c\n', 'md', 'P'); assert.ok(!/[^\r]\n/.test(o2), 'keeps CRLF'); assert.ok(o2.includes('After'));
  const e = ogCompose('```gantt\n```\n', 'rows: []\n', 'md', 'P'); assert.equal(e, '```gantt\nrows: []\n```\n'); // empty block
  assert.equal(ogCompose('whatever', 'rows: []\n', 'yaml', 'P'), 'rows: []\n');
  assert.equal(makeApp().ogFmtOf('x.MD'), 'md'); assert.equal(makeApp().ogFmtOf('x.yaml'), 'yaml');
}

/* ---------- mapping ---------- */
{
  const A = makeApp(), S = A.S;
  const t = A.quickAdd('Write thesis #uni !high', { due: '2026-10-30' });
  Object.assign(t, { start: '2026-10-05', astart: '2026-10-06', notes: 'chapter 1\n- [ ] draft', gx: { owner: 'Sam', est: 3 }, subtasks: [{ id: 'sa', title: 'Outline', done: true, start: '2026-10-05', due: '2026-10-07', astart: '2026-10-05', aend: '2026-10-08', children: [{ id: 'sb', title: 'Deep', done: false, due: '2026-10-07' }] }, { id: 'sc', title: 'Plain done', done: true }, { id: 'sd', title: 'Plain open', done: false }] });
  const row = A.ogRowOfTask(t);
  eq(row.plan, ['2026-10-05', '2026-10-30']); eq(row.fact, ['2026-10-06']); assert.equal(row.priority, 'High'); eq(row.tags, ['uni']); assert.equal(row.owner, 'Sam'); assert.equal(row.otid, t.id);
  eq(row.children[0].fact, ['2026-10-05', '2026-10-08']); eq(row.children[0].children[0].plan, ['2026-10-07']); assert.equal(row.children[1].done, true); assert.equal(row.children[2].done, undefined);
  // through YAML text and back: identical hash
  const yaml = A.ogMergeYaml('', [row], []), back = A.ogYamlParse(yaml).rows[0];
  assert.equal(A.ogHash(A.ogFields(back)), A.ogTaskHash(t), 'task -> yaml -> row hashes equal');
  // finishing: done tasks get a fact [start, done date]
  t.status = 'done'; t.doneAt = new Date(2026, 9, 20, 15).getTime(); eq(A.ogRowOfTask(t).fact, ['2026-10-06', '2026-10-20']);
  // import: applying a row onto a fresh task reproduces it
  const r = A.ogImportText('rows:\n  - label: Imported\n    plan: [2026-11-01, 2026-11-09]\n    fact: [2026-11-01, 2026-11-05]\n    priority: Medium\n    owner: Kim\n    children:\n      - label: kid\n        plan: [2026-11-02]\n', 'chart.yaml', null);
  assert.ok(r.created && r.added === 1); const it = S.tasks.find(x => x.title === 'Imported');
  eq([it.start, it.due, it.astart, it.status, it.priority, it.gx, it.subtasks.length, it.subtasks[0].due], ['2026-11-01', '2026-11-09', '2026-11-01', 'done', 2, { owner: 'Kim' }, 1, '2026-11-02']);
  assert.equal(new Date(it.doneAt).getDate(), 5); assert.equal(it.listId, r.list.id); assert.equal(r.list.name, 'chart');
  assert.throws(() => A.ogImportText('# a note\nno chart', 'n.md', null), /No ```gantt/);
  assert.throws(() => A.ogImportText('a: 1', 'x.yaml', null), /rows/);
  // import is idempotent when the chart carries otid
  const again = A.ogImportText(A.ogMergeYaml('', [A.ogRowOfTask(it)], []), 'chart.yaml', r.list.id); assert.equal(again.added, 0); assert.equal(again.pulled, 0);
}

/* ---------- linked file sync (in-memory file) ---------- */
{
  const A = makeApp(), S = A.S;
  let file = null, writes = 0; // the "file on disk"
  A.OGIO.read = async () => file; A.OGIO.write = async (id, text) => { file = text; writes++; };
  const list = { id: 'L1', name: 'Thesis', color: '#4772fa', sections: [] }; S.lists.push(list);
  const mk = (title, o = {}) => { const t = A.quickAdd(title, { listId: 'L1' }); Object.assign(t, o); return t; };
  const a = mk('Alpha', { start: '2026-10-01', due: '2026-10-05' }), b = mk('Beta', { due: '2026-10-09' }), u = mk('Undated');
  A.flush();
  A.OG.links.L1 = { name: 'thesis.md', fmt: 'md', auto: true, base: {}, last: 0 };
  let st = await A.ogSync('L1', true);
  assert.equal(writes, 1); assert.ok(file.startsWith('# Thesis\n\n```gantt\ntitle: Thesis\n')); assert.ok(file.includes(`otid: ${a.id}`)); assert.ok(!file.includes('Undated'), 'undated tasks are not exported');
  const w0 = writes; await A.ogSync('L1'); assert.equal(writes, w0, 'nothing changed -> file not rewritten');

  // edit in OpenGantt: move Alpha, add a row, delete Beta, add a note and a custom column
  const doc = A.ogYamlParse(A.ogExtract(file, 'md').yaml);
  const ar = doc.rows.find(r => r.label === 'Alpha'); ar.plan = ['2026-10-02', '2026-10-08']; ar.owner = 'Sam';
  doc.rows = doc.rows.filter(r => r.label !== 'Beta'); doc.rows.push({ label: 'Gamma (new)', plan: ['2026-10-12', '2026-10-14'], fact: ['2026-10-12'] });
  file = file.replace(/```gantt\n[\s\S]*?\n```/, '```gantt\n' + A.ogMergeYaml('', doc.rows, ['title: Thesis', 'scale: month']) + '```');
  st = await A.ogSync('L1', true);
  eq([a.start, a.due, a.gx], ['2026-10-02', '2026-10-08', { owner: 'Sam' }]);
  assert.equal(b.deleted > 0, true, 'a row removed in OpenGantt trashes the task'); assert.equal(u.deleted, undefined, 'unexported tasks are never trashed');
  const g = S.tasks.find(t => t.title === 'Gamma (new)'); assert.ok(g && g.listId === 'L1' && g.astart === '2026-10-12' && g.status === 'open');
  assert.ok(file.includes('scale: month'), 'header keys of the chart are kept'); assert.ok(file.includes(`otid: ${g.id}`), 'new rows get an id written back');
  assert.ok(file.startsWith('# Thesis\n\n```gantt'));

  // edit in OpenTick: finish Alpha, add a subtask, add a task
  a.status = 'done'; a.doneAt = new Date(2026, 9, 7, 10).getTime(); a.subtasks.push({ id: 's1', title: 'Part 1', done: false, due: '2026-10-04' }); const d2 = mk('Delta', { due: '2026-10-20' });
  A.flush(); await A.ogSync('L1');
  const rows2 = A.ogYamlParse(A.ogExtract(file, 'md').yaml).rows;
  eq(rows2.find(r => r.label === 'Alpha').fact, ['2026-10-02', '2026-10-07']); assert.equal(rows2.find(r => r.label === 'Alpha').children[0].label, 'Part 1'); assert.ok(rows2.some(r => r.label === 'Delta'));
  eq(rows2.map(r => r.label), ['Alpha', 'Gamma (new)', 'Delta'], 'file order is kept, new tasks are appended');

  // both sides change the same task: OpenTick wins, counted
  const gRow = () => A.ogYamlParse(A.ogExtract(file, 'md').yaml);
  let dd = gRow(); dd.rows.find(r => r.label === 'Delta').plan = ['2026-10-21']; file = file.replace(/```gantt\n[\s\S]*?\n```/, '```gantt\n' + A.ogMergeYaml('', dd.rows, ['title: Thesis']) + '```');
  d2.due = '2026-10-25'; A.flush(); st = await A.ogSync('L1');
  assert.equal(st.conflicts, 1); assert.equal(d2.due, '2026-10-25'); assert.ok(file.includes('2026-10-25'));
  // a task that loses its dates is not mistaken for a deletion
  g.start = g.due = g.astart = null; A.flush(); await A.ogSync('L1'); assert.equal(g.deleted, undefined); assert.ok(!file.includes('Gamma'));
  // a deleted task leaves the file
  d2.deleted = Date.now(); A.flush(); await A.ogSync('L1'); assert.ok(!file.includes('Delta'));
  // garbage in the file never overwrites it
  file = '```gantt\nrows: [oops\n```\n'; const keep = file; st = await A.ogSync('L1'); assert.equal(st, null); assert.equal(file, keep); assert.equal(A.OG.links.L1.status, 'error');
  // a plain .yaml link
  A.OG.links.L1 = { name: 'c.yaml', fmt: 'yaml', auto: true, base: {} }; file = null; await A.ogSync('L1'); assert.ok(file.startsWith('title: Thesis\nscale: week\nmode: both\nrows:\n'));
  // gantt page renders list + tasks, with every mode and scale
  for (const scale of ['day', 'week', 'month']) for (const mode of ['both', 'plan', 'actual']) { S.settings.gantt = { scale, mode }; for (const sel of ['all', 'L1']) { A.U.page = 'gantt'; A.U.gList = sel; A.render(); } }
  const html = A.els['#main'].innerHTML; assert.ok(html.includes('Alpha') && html.includes('gt-bp') || html.includes('gt-ba'));
  assert.ok(A.ganttRows('L1').some(r => r.k === 'sub' && r.s.title === 'Part 1'));
}
console.log('OpenGantt interop tests passed');
