// Advanced fields of custom sections (src/js/xfields.js and its users): validation, defaults, required, shown-when, formatting, groups, multi-select, templates, calculated fields.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const A = makeApp({ store: {} }), J = o => JSON.parse(JSON.stringify(o)), q = JSON.stringify, R = code => { const r = A.__run(code); return r === undefined ? undefined : J(r); };
const S = A.S, U = A.U, eq = assert.deepEqual;
const norm = s => R(`xsNormalise(${q(s)})`);
const state = (s, vals) => R(`(() => { const st = xfdState(${q(s)}, ${q(vals)}); return { vis: { ...st.vis }, eff: { ...st.eff }, calc: { ...st.calc } }; })()`);
const probs = (s, vals) => R(`xfdProblems(${q(s)}, ${q(vals)})`).map(p => p.fid + ':' + p.msg);
const fids = (s, vals) => R(`xfdProblems(${q(s)}, ${q(vals)})`).map(p => p.fid);
const text = (f, v) => R(`xfdText(${q(f)}, ${q(v)})`);
const base = (fields, extra = {}) => ({ id: 'x-t', name: 'T', fields, ...extra });

/* ---------- 1. what is kept and what is cut (the normaliser) ---------- */
{
  const old = norm({ id: 'x-old', name: 'Books', fields: [{ id: 'a', name: 'Author', type: 'text' }, { id: 'st', name: 'Status', type: 'select', opts: ['Read', 'To read'] }, { id: 'n', name: 'Pages', type: 'number' }] });
  eq(old.fields, [{ id: 'a', name: 'Author', type: 'text' }, { id: 'st', name: 'Status', type: 'select', opts: ['Read', 'To read'] }, { id: 'n', name: 'Pages', type: 'number' }], 'a section made before 0.9.1 is exactly as it was: no new keys appear');
  assert.ok(!('fgroups' in old) && !('tpls' in old));
  const s = norm(base([
    { id: 'p', name: 'Pages', type: 'number', desc: '  How many  ', ph: 'e.g. 300', req: true, min: '1', max: 5000, int: true, def: '10', fmt: { unit: 'pages', thou: false, dec: 0, style: 'number' } },
    { id: 'd', name: 'Date', type: 'date', min: '2020-01-01', max: 'today', def: 'today', fmt: { datefmt: 'long' } },
    { id: 't', name: 'Text', type: 'text', minLen: 2, maxLen: 10, def: 'hi', ph: 'x' },
    { id: 'g', name: 'Genres', type: 'multiselect', opts: ['A', 'B', 'C', 'A'], min: 1, max: 2, def: ['B', 'Z'] },
    { id: 'c', name: 'Pct', type: 'calculated', formula: '[p]*2', fmt: { style: 'percent', bar: true, barMax: 50 }, req: true, def: 5, ph: 'no' },
    { id: 'k', name: 'Box', type: 'check', req: true, def: true, ph: 'no', min: 3 },
  ]));
  const f = Object.fromEntries(s.fields.map(x => [x.id, x]));
  eq(f.p, { id: 'p', name: 'Pages', type: 'number', desc: 'How many', ph: 'e.g. 300', req: true, min: 1, max: 5000, int: true, def: 10, fmt: { unit: 'pages', thou: false, dec: 0 } }, 'numbers are numbers, text is trimmed, the default style is not stored');
  eq(f.d, { id: 'd', name: 'Date', type: 'date', min: '2020-01-01', max: 'today', def: 'today', fmt: { datefmt: 'long' } });
  eq(f.t, { id: 't', name: 'Text', type: 'text', ph: 'x', minLen: 2, maxLen: 10, def: 'hi' });
  eq(f.g, { id: 'g', name: 'Genres', type: 'multiselect', opts: ['A', 'B', 'C'], min: 1, max: 2, def: ['B'] }, 'options are unique; a default that is not an option is dropped');
  eq(f.c, { id: 'c', name: 'Pct', type: 'calculated', formula: '[p]*2', fmt: { style: 'percent', bar: true, barMax: 50 } }, 'a calculated field is never required, has no default, no placeholder');
  eq(f.k, { id: 'k', name: 'Box', type: 'check', def: true }, 'a tick box cannot be required and has no limits');
  eq(norm(s), s, 'normalising twice changes nothing');
  // values that do not fit are dropped, not guessed
  const bad = norm(base([{ id: 'n', name: 'N', type: 'number', min: 10, max: 5, def: 'abc', int: 'yes', fmt: 5 }, { id: 'n2', name: 'N2', type: 'number', min: 5, def: 2 }, { id: 'n3', name: 'N3', type: 'number', int: true, def: 2.5 }, { id: 'd', name: 'D', type: 'date', min: '2020-13-45', def: 'tomorrow' }, { id: 's', name: 'S', type: 'select', opts: ['a'], def: 'b' },
    { id: 'm', name: 'M', type: 'text', minLen: 9, maxLen: 3 }, { id: 'r', name: 'R', type: 'rating', def: 9 }, { id: 'u', name: 'U', type: 'url', maxLen: 'x' }]));
  eq(bad.fields[0], { id: 'n', name: 'N', type: 'number' }, 'an impossible range is dropped');
  eq(bad.fields[1], { id: 'n2', name: 'N2', type: 'number', min: 5 }, 'a default outside the field’s own range is dropped');
  eq(bad.fields[2], { id: 'n3', name: 'N3', type: 'number', int: true });
  eq(bad.fields[3], { id: 'd', name: 'D', type: 'date' }); eq(bad.fields[4], { id: 's', name: 'S', type: 'select', opts: ['a'] }); eq(bad.fields[5], { id: 'm', name: 'M', type: 'text' }); eq(bad.fields[6], { id: 'r', name: 'R', type: 'rating' }); eq(bad.fields[7], { id: 'u', name: 'U', type: 'url' });
  // hostile input never throws and never leaks into the prototype
  for (const x of [{ fields: [{ id: '__proto__', name: 'a', type: 'number', when: { field: 'constructor', equals: 1 } }, { id: 'constructor', name: 'b', type: 'calculated', formula: '[__proto__]+1' }] }, { fields: [null, 5, 'x', { when: 7, fmt: [], desc: {}, min: {}, def: {} }], fgroups: 'no', tpls: { a: 1 } }, { fields: Array.from({ length: 40 }, (_, i) => ({ name: 'f' + i, type: 'multiselect', opts: Array.from({ length: 50 }, (_, j) => 'o' + j) })), fgroups: Array.from({ length: 30 }, (_, i) => ({ name: 'g' + i })), tpls: Array.from({ length: 30 }, (_, i) => ({ name: 't' + i })) }])
    assert.doesNotThrow(() => R(`xsNormalise(${q(x)})`));
  assert.equal(({}).polluted, undefined);
  const big = norm({ fields: Array.from({ length: 40 }, (_, i) => ({ name: 'f' + i, type: 'multiselect', opts: Array.from({ length: 50 }, (_, j) => 'o' + j) })), fgroups: Array.from({ length: 30 }, (_, i) => ({ name: 'g' + i })), tpls: Array.from({ length: 30 }, (_, i) => ({ name: 't' + i })) });
  assert.equal(big.fields.length, 24); assert.equal(big.fields[0].opts.length, 30); assert.equal(big.fgroups.length, 8); assert.equal(big.tpls.length, 8);
  // old devices’ copies of a section (no new keys) and new ones side by side: the extra keys are simply ignored by anything that does not know them
  assert.ok(!('def' in norm(base([{ id: 'a', name: 'A', type: 'text', def: '' }])).fields[0]));
}

/* ---------- 2. validation: required, limits, kinds of value ---------- */
{
  const s = norm(base([
    { id: 'p', name: 'Pages', type: 'number', req: true, min: 1, max: 100, int: true }, { id: 'when', name: 'When', type: 'date', min: '2020-01-01', max: 'today' }, { id: 't', name: 'Code', type: 'text', minLen: 3, maxLen: 5 }, { id: 'g', name: 'Genres', type: 'multiselect', opts: ['A', 'B', 'C'], min: 1, max: 2 }, { id: 'tg', name: 'Tags', type: 'tags', max: 2 },
    { id: 'u', name: 'Site', type: 'url' }, { id: 's', name: 'Kind', type: 'select', opts: ['x', 'y'] }, { id: 'r', name: 'Stars', type: 'rating' }]));
  eq(fids(s, { p: 5 }), [], 'a valid entry has no problems'); eq(fids(s, {}), ['p'], 'a required field that is empty is the only problem of an empty entry');
  assert.match(probs(s, {})[0], /“Pages” is required/);
  assert.match(probs(s, { p: 0 })[0], /at least 1/); assert.match(probs(s, { p: 101 })[0], /at most 100/); assert.match(probs(s, { p: 2.5 })[0], /whole number/); eq(fids(s, { p: 1 }), []); eq(fids(s, { p: 100 }), [], 'the limits themselves are allowed');
  assert.match(probs(s, { p: 'abc' })[0], /must be a number/);
  eq(fids(s, { p: 1, when: '2019-12-31' }), ['when']); eq(fids(s, { p: 1, when: '2020-01-01' }), []); eq(fids(s, { p: 1, when: '2999-01-01' }), ['when'], 'a date after today when the latest day is today'); eq(fids(s, { p: 1, when: 'not a date' }), ['when']);
  eq(fids(s, { p: 1, t: 'ab' }), ['t']); eq(fids(s, { p: 1, t: 'abc' }), []); eq(fids(s, { p: 1, t: 'abcdef' }), ['t']); eq(fids(s, { p: 1, t: 'abcde' }), []);
  eq(fids(s, { p: 1, g: ['A', 'B', 'C'] }), ['g']); eq(fids(s, { p: 1, g: ['A'] }), []); eq(fids(s, { p: 1, g: ['Z'] }), ['g'], 'a choice that is not in the list'); eq(fids(s, { p: 1, tg: ['a', 'b', 'c'] }), ['tg']);
  eq(fids(s, { p: 1, u: 'https://example.com/a?b=1' }), []); eq(fids(s, { p: 1, u: 'example.com' }), []); eq(fids(s, { p: 1, u: 'not a url' }), ['u']); eq(fids(s, { p: 1, u: 'javascript:alert(1)' }), ['u']); eq(fids(s, { p: 1, u: 'ftp://x.org' }), ['u']);
  eq(fids(s, { p: 1, s: 'z' }), ['s']); eq(fids(s, { p: 1, s: 'x' }), []); eq(fids(s, { p: 1, r: 9 }), ['r']); eq(fids(s, { p: 1, r: 5 }), []);
  // a minimum of 1 choice does not make the field required, a required field without a minimum needs at least one
  eq(fids(s, { p: 1 }), [], 'a field with a minimum count is only checked when something is chosen');
  const r2 = norm(base([{ id: 'g', name: 'G', type: 'multiselect', opts: ['A'], req: true }, { id: 'tg', name: 'T', type: 'tags', req: true }, { id: 'tx', name: 'X', type: 'text', req: true }]));
  eq(fids(r2, {}), ['g', 'tg', 'tx']); eq(fids(r2, { g: [], tg: [], tx: '' }), ['g', 'tg', 'tx'], 'empty is empty'); eq(fids(r2, { g: ['A'], tg: ['a'], tx: 'x' }), []);
  // what a field says does not depend on the language of the person: a message names the field
  assert.match(probs(s, { p: 1, t: 'a' })[0], /“Code” needs at least 3 characters/);
}

/* ---------- 3. shown when ---------- */
{
  const s = norm(base([
    { id: 'st', name: 'Status', type: 'select', opts: ['To read', 'Reading', 'Finished'] },
    { id: 'fin', name: 'Finished on', type: 'date', req: true, when: { field: 'st', equals: 'Finished' } },
    { id: 'why', name: 'Why', type: 'text', req: true, when: { field: 'st', in: ['To read', 'Reading'] } },
    { id: 'no', name: 'Not finished', type: 'text', when: { field: 'st', notEquals: 'Finished' } },
    { id: 'nin', name: 'None of', type: 'text', when: { field: 'st', notIn: ['To read'] } },
    { id: 'fl', name: 'Has status', type: 'text', when: { field: 'st', filled: true } },
    { id: 'em', name: 'No status', type: 'text', when: { field: 'st', filled: false } },
    { id: 'b', name: 'Bought', type: 'check' }, { id: 'bn', name: 'Receipt', type: 'text', when: { field: 'b', equals: true } },
    { id: 'n', name: 'N', type: 'number' }, { id: 'big', name: 'Big', type: 'text', when: { field: 'n', equals: 0 } },
    { id: 'both', name: 'Both', type: 'text', when: { all: [{ field: 'st', equals: 'Finished' }, { field: 'b', equals: true }] } },
    { id: 'either', name: 'Either', type: 'text', when: { any: [{ field: 'st', equals: 'Reading' }, { field: 'b', equals: true }] } },
  ]));
  eq(Object.keys(state(s, {}).vis).sort(), ['b', 'big', 'bn', 'both', 'either', 'em', 'fin', 'fl', 'n', 'nin', 'no', 'st', 'why']);
  const shown = v => { const x = state(s, v).vis; return ['fin', 'why', 'no', 'nin', 'fl', 'em', 'bn', 'big', 'both', 'either'].filter(k => x[k]); };
  eq(shown({}), ['no', 'nin', 'em'], 'with nothing chosen: "not Finished", "not in [To read]" and "empty" fields are shown, the others hidden');
  eq(shown({ st: 'Finished' }), ['fin', 'nin', 'fl'], 'Finished'); eq(shown({ st: 'Reading' }), ['why', 'no', 'nin', 'fl', 'either']); eq(shown({ st: 'To read' }), ['why', 'no', 'fl']);
  eq(shown({ st: 'Finished', b: true }), ['fin', 'nin', 'fl', 'bn', 'both', 'either']); eq(shown({ n: 0 }), ['no', 'nin', 'em', 'big']);
  // a required field that is hidden does not block saving; one that is shown does
  eq(fids(s, { st: 'Finished' }), ['fin']); eq(fids(s, { st: 'To read' }), ['why']); eq(fids(s, { st: 'To read', why: 'x' }), []); eq(fids(s, {}), [], 'hidden and required: no problem');
  // a hidden field keeps what was typed (the entry is not touched) but counts as empty everywhere
  const hidden = { st: 'To read', why: 'x', fin: '2026-01-01' }; eq(state(s, hidden).eff.fin, undefined); eq(fids(s, { ...hidden, fin: 'garbage' }), [], 'a hidden value is not validated');
  eq(state(s, { ...hidden, st: 'Finished' }).eff.fin, '2026-01-01', 'it comes back when the field is shown again');
  // "is not" an empty value means "has a value"; for a tick box it follows the box
  const ne = norm(base([{ id: 'st', name: 'Status', type: 'select', opts: ['x'] }, { id: 'f', name: 'F', type: 'text', when: { field: 'st', notEquals: '' } }, { id: 'e', name: 'E', type: 'text', when: { field: 'st', equals: '' } }, { id: 'k', name: 'K', type: 'check' }, { id: 'nk', name: 'NK', type: 'text', when: { field: 'k', notEquals: true } }, { id: 'ny', name: 'NY', type: 'text', when: { field: 'k', equals: false } }]));
  eq(state(ne, {}).vis, { st: true, f: false, e: true, k: true, nk: true, ny: true }); eq(state(ne, { st: 'x', k: true }).vis, { st: true, f: true, e: false, k: true, nk: false, ny: false });
  // chains: a field shown by a field that is itself hidden is hidden too
  const ch = norm(base([{ id: 'a', name: 'A', type: 'select', opts: ['x', 'y'] }, { id: 'b', name: 'B', type: 'select', opts: ['p', 'q'], when: { field: 'a', equals: 'x' } }, { id: 'c', name: 'C', type: 'text', when: { field: 'b', equals: 'p' } }]));
  eq(state(ch, { a: 'y', b: 'p' }).vis, { a: true, b: false, c: false }, 'B is hidden so C does not see its old value'); eq(state(ch, { a: 'x', b: 'p' }).vis, { a: true, b: true, c: true });
  // loops, a field that needs itself, a field that does not exist
  const lp = norm(base([{ id: 'a', name: 'A', type: 'text', when: { field: 'b', filled: true } }, { id: 'b', name: 'B', type: 'text', when: { field: 'a', filled: true } }, { id: 'c', name: 'C', type: 'text', when: { field: 'c', filled: true } }, { id: 'd', name: 'D', type: 'text', when: { field: 'gone', equals: 1 } }, { id: 'e', name: 'E', type: 'text', when: { field: 'a', filled: true } }]));
  eq(lp.fields.filter(f => f.when).map(f => f.id), ['e'], 'the conditions of a loop, of a field on itself and of a field that is not there are all removed; E, which only waits for the loop, keeps its own');
  eq(state(lp, {}).vis, { a: true, b: true, c: true, d: true, e: false }, 'the fields of a loop are all shown; E still waits for A');
  // a loop through a formula (A is shown when Calc > 0, Calc uses A) is found at run time and the condition is set aside, so both can be shown
  const fl = { id: 'x', name: 'x', fields: [{ id: 'a', name: 'A', type: 'number', when: { field: 'c', filled: true } }, { id: 'c', name: 'C', type: 'calculated', formula: '[a] + 1' }] };
  assert.doesNotThrow(() => state(fl, { a: 1 })); eq(state(fl, { a: 1 }).vis.a, true, 'the condition that makes a circle is not applied');
  assert.match(R(`xfdPlan(${q(fl)}).loops.a`), /depends on it/);
  eq(state(fl, { a: 1 }).calc.c, { v: 2, err: '' }, 'and the formula is worked out after the field it needs, not before');
  // a condition that a section of another device holds on the field itself would hide it for ever: it is set aside
  const selfRef = { id: 'x', name: 'x', fields: [{ id: 'a', name: 'A', type: 'text', when: { field: 'a', filled: true } }] }; eq(state(selfRef, {}).vis.a, true, 'a field that waits for itself is shown'); assert.match(R(`xfdPlan(${q(selfRef)}).loops.a`), /by itself/);
  // the editor refuses to save it (xfeProblem)
  assert.match(R(`xfeProblem({ fields: ${q(fl.fields)} }).msg`), /depends on it/);
  // conditions are cut to what is sound
  const odd = norm(base([{ id: 'a', name: 'A', type: 'text' }, { id: 'b', name: 'B', type: 'text', when: { all: [{ field: 'a', equals: 'x' }, { all: [{ field: 'a', equals: 'y' }] }] } }, { id: 'c', name: 'C', type: 'text', when: { field: 'a' } }, { id: 'd', name: 'D', type: 'text', when: { field: 'a', in: [] } }, { id: 'e', name: 'E', type: 'text', when: { field: 'a', equals: { x: 1 } } }]));
  eq(odd.fields[1].when, { field: 'a', equals: 'x' }, 'a nested group is not allowed (one level); what remains is kept'); for (const i of [2, 3, 4]) assert.ok(!odd.fields[i].when, 'a condition that says nothing is dropped');
}

/* ---------- 4. calculated fields ---------- */
{
  const s = norm(base([
    { id: 'read', name: 'Pages read', type: 'number', min: 0 }, { id: 'total', name: 'Total pages', type: 'number', min: 1, int: true },
    { id: 'pct', name: 'Progress', type: 'calculated', formula: 'min(100, round(100 * [read] / [total], 1))', fmt: { style: 'percent', bar: true } },
    { id: 'left', name: 'Left', type: 'calculated', formula: '[total] - [read]' }, { id: 'half', name: 'Half of left', type: 'calculated', formula: '[left] / 2' },
    { id: 'st', name: 'Status', type: 'select', opts: ['Reading', 'Finished'] }, { id: 'when', name: 'Started', type: 'date' },
    { id: 'days', name: 'Days', type: 'calculated', formula: 'today() - [when]', when: { field: 'st', equals: 'Reading' } }]));
  const c = (v, id) => state(s, v).calc[id];
  eq(c({ read: 120, total: 300 }, 'pct'), { v: 40, err: '' }); eq(c({ read: 100, total: 300 }, 'pct').v, 33.3); eq(c({ read: 999, total: 300 }, 'pct').v, 100); eq(c({ total: 300 }, 'pct').v, null, 'a missing input: empty, not 0');
  eq(c({ read: 1, total: 0 }, 'pct').err, 'Division by zero'); eq(c({ read: 50, total: 100 }, 'half').v, 25, 'a formula can use another calculated field'); eq(c({ read: 50 }, 'half').v, null);
  eq(state(s, { read: 120, total: 300 }).eff.pct, 40, 'its value counts for conditions and other formulas');
  // hidden: nothing, and a formula that uses it sees an empty field
  eq(c({ when: '2026-10-01', st: 'Finished' }, 'days'), { v: null, err: '' }, 'a hidden calculated field is empty'); eq(c({ when: '2026-10-01', st: 'Reading' }, 'days').v, 7, 'today is the day the clock says (8 Oct 2026)');
  const hid = norm(base([{ id: 'sw', name: 'Switch', type: 'check' }, { id: 'a', name: 'A', type: 'number', when: { field: 'sw', equals: true } }, { id: 'c', name: 'C', type: 'calculated', formula: 'n([a]) + 1' }]));
  eq(state(hid, { sw: false, a: 41 }).calc.c.v, 1, 'a hidden field is empty to a formula'); eq(state(hid, { sw: true, a: 41 }).calc.c.v, 42);
  // formula problems are reported on the field, not thrown
  const er = norm(base([{ id: 'a', name: 'A', type: 'number' }, { id: 't', name: 'Name', type: 'text' }, { id: 'c1', name: 'C1', type: 'calculated', formula: '[nope] + 1' }, { id: 'c2', name: 'C2', type: 'calculated', formula: '[t] + 1' }, { id: 'c3', name: 'C3', type: 'calculated', formula: '' }, { id: 'c4', name: 'C4', type: 'calculated', formula: '[c5] + 1' }, { id: 'c5', name: 'C5', type: 'calculated', formula: '[c4] + 1' }, { id: 'c6', name: 'C6', type: 'calculated', formula: 'eval("1")' }, { id: 'c7', name: 'C7', type: 'calculated', formula: '[a] +' }]));
  const sts = state(er, { a: 1, t: 'x' }).calc; for (const id of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']) assert.ok(sts[id].err && sts[id].v === null, id + ': ' + JSON.stringify(sts[id]));
  assert.match(sts.c4.err, /Circular/); assert.match(R(`xfeProblem({ fields: ${q(er.fields)} }).msg`), /^The formula of “C1”/, 'the editor will not save a formula that does not work');
  // a calculated field is not a problem for the entry, and cannot be required
  eq(fids(er, { a: 1 }), [], 'a broken formula is shown on the field, it does not stop an entry being saved');
  // a field turned into a calculated one: stored values are taken out (xsRevalidate), other fields are not touched
  const sec = norm(base([{ id: 'a', name: 'A', type: 'number' }, { id: 'c', name: 'C', type: 'calculated', formula: '[a]*2' }])); S.csections.push(sec);
  S.centries.push(A.xeNormalise({ id: 'e1', sid: 'x-t', title: 'one', vals: { a: 2, c: 99 } }));
  assert.equal(A.__run(`xsRevalidate(xsById('x-t'))`), 1); eq(J(S.centries[S.centries.length - 1].vals), { a: 2 }); S.csections.pop(); S.centries.pop();
  // the same section with the specification’s own example, by name and by id
  const fields = [{ id: 'pages-read', name: 'Pages read', type: 'number' }, { id: 'total-pages', name: 'Total pages', type: 'number' }, { id: 'pc', name: 'Percentage', type: 'calculated', formula: 'min(100, round(100 * [pages-read] / [total-pages], 1))' }];
  eq(state(base(fields), { 'pages-read': 45, 'total-pages': 300 }).calc.pc.v, 15);
}

/* ---------- 5. how a value looks ---------- */
{
  const n = (fmt, v) => text({ type: 'number', fmt }, v);
  assert.equal(n(undefined, 1234.5), '1,234.5'); assert.equal(n({ thou: false }, 1234.5), '1234.5'); assert.equal(n({ prefix: '$', dec: 2 }, 3), '$3.00'); assert.equal(n({ unit: 'kg' }, 70), '70 kg'); assert.equal(n({ suffix: ' / month', prefix: '€' }, 9), '€9 / month');
  assert.equal(n({ style: 'percent' }, 45), '45%'); assert.equal(n({ style: 'ratio' }, 0.456), '45.6%'); assert.equal(n({ style: 'ratio', dec: 0 }, 0.456), '46%'); assert.equal(n({ style: 'integer' }, 2.6), '3'); assert.equal(n({ dec: 0 }, 2.5), '3'); assert.equal(n(undefined, 0), '0'); assert.equal(n(undefined, -5), '-5');
  assert.equal(n(undefined, ''), ''); assert.equal(n(undefined, null), '');
  assert.equal(text({ type: 'calculated', fmt: { style: 'percent', dec: 1 } }, 33.3), '33.3%');
  assert.equal(text({ type: 'calculated', fmt: { style: 'date', datefmt: 'iso' } }, 20000), '2024-10-04');
  assert.equal(text({ type: 'date', fmt: { datefmt: 'iso' } }, '2026-01-15'), '2026-01-15'); assert.match(text({ type: 'date', fmt: { datefmt: 'long' } }, '2026-01-15'), /January/); assert.equal(text({ type: 'date' }, 'garbage'), 'garbage');
  assert.equal(text({ type: 'multiselect' }, ['a', 'b']), 'a, b'); assert.equal(text({ type: 'tags' }, ['a', 'b']), 'a b'); assert.equal(text({ type: 'check' }, true), 'Yes');
  // progress bar: a share of 0 to 100
  const bar = (f, v) => R(`xfdBar(${q(f)}, ${q(v)})`);
  eq([bar({ fmt: { bar: true } }, 50), bar({ fmt: { bar: true } }, 150), bar({ fmt: { bar: true } }, -5), bar({ fmt: { bar: true, barMax: 20 } }, 5), bar({ fmt: { bar: true, style: 'ratio' } }, 0.25), bar({}, 5), bar({ fmt: { bar: true } }, null)], [50, 100, 0, 25, 25, null, null]);
  // on the screen: everything a person controls is escaped
  const f = { id: 'p', name: '<b>x</b>', type: 'number', fmt: { prefix: '<img src=x onerror=1>', unit: '"><script>', bar: true } };
  const html = R(`xsShow(${q(f)}, 12)`); assert.ok(!/<img|<script/.test(html), html); assert.match(html, /role="progressbar"/); assert.match(html, /aria-valuenow="12"/);
  const e1 = R(`xsShow(${q({ id: 'g', name: 'G', type: 'multiselect' })}, ['<i>a</i>', 'b'])`); assert.ok(!/<i>/.test(e1) && (e1.match(/xs-chip/g) || []).length === 2, e1);
  // an invalid web address is not turned into a link
  assert.ok(!/<a /.test(R(`xsShow({ id: 'u', name: 'U', type: 'url' }, 'javascript:alert(1)')`)));
}

/* ---------- 6. templates and defaults ---------- */
{
  const s = norm(base([{ id: 'st', name: 'Status', type: 'select', opts: ['To read', 'Reading'], def: 'To read' }, { id: 'd', name: 'Added', type: 'date', def: 'today' }, { id: 'g', name: 'Genres', type: 'multiselect', opts: ['A', 'B'], def: ['A'] }, { id: 'n', name: 'Pages', type: 'number' }, { id: 'c', name: 'C', type: 'calculated', formula: '[n]' }, { id: 'nt', name: 'Why', type: 'text' }],
    { tpls: [{ id: 't1', name: 'Novel', desc: 'A long read', title: 'New novel', notes: 'Notes…', vals: { st: 'Reading', g: ['B', 'Zz'], n: '350', c: 5, gone: 'x', nt: 'because' } }, { name: '' }, { id: 't2', name: 'Bad', vals: { st: 'nope', n: 'abc' } }] }));
  eq(s.tpls[0], { id: 't1', name: 'Novel', desc: 'A long read', title: 'New novel', notes: 'Notes…', vals: { st: 'Reading', g: ['B'], n: 350, nt: 'because' } }, 'a template keeps only values that fit a field that exists (never a calculated one)');
  const lim = norm(base([{ id: 'n', name: 'N', type: 'number', min: 5 }], { tpls: [{ id: 'a', name: 'A', vals: { n: 2 } }, { id: 'b', name: 'B', vals: { n: 7 } }] })); eq(lim.tpls.map(t => t.vals), [{}, { n: 7 }], 'a template cannot fill in a value its field would refuse');
  eq(s.tpls[1], { id: 't2', name: 'Bad', vals: {} }); assert.equal(s.tpls.length, 2, 'a template needs a name');
  eq(R(`xfdStart(${q(s)})`), { st: 'To read', d: '2026-10-08', g: ['A'] }, 'a new entry starts with the defaults (today is the day the clock says)');
  eq(R(`xfdStart(${q(s)}, ${q(s.tpls[0])})`), { st: 'Reading', d: '2026-10-08', g: ['B'], n: 350, nt: 'because' }, 'a template’s values come over the defaults');
  // applying a template to what is there: fill the empty and the still-default, never overwrite
  const fill = (e, t) => R(`(() => { const e = ${q(e)}; const n = xfdFillEmpty(${q(s)}, e, ${q(t)}); return { e, n }; })()`);
  let r = fill({ title: '', notes: '', vals: { st: 'To read', d: '2026-10-08', g: ['A'] } }, s.tpls[0]);
  eq(r.e.vals, { st: 'Reading', d: '2026-10-08', g: ['B'], n: 350, nt: 'because' }); assert.equal(r.e.title, 'New novel'); assert.equal(r.e.notes, 'Notes…'); eq(r.n, { vals: 4, title: true, notes: true });
  r = fill({ title: 'Mine', notes: 'my notes', vals: { st: 'Reading', n: 12, nt: 'typed', g: ['A', 'B'] } }, s.tpls[0]);
  eq(r.e.vals, { st: 'Reading', n: 12, nt: 'typed', g: ['A', 'B'] }, 'what was typed stays'); assert.equal(r.e.title, 'Mine'); assert.equal(r.e.notes, 'my notes'); eq(r.n, { vals: 0, title: false, notes: false });
  // the entry editor starts from the defaults, and an entry made of defaults only is still "empty"
  assert.equal(R(`xfdIsDefault(${q(s.fields[1])}, '2026-10-08')`), true); assert.equal(R(`xfdIsDefault(${q(s.fields[1])}, '2026-10-07')`), false); assert.equal(R(`xfdIsDefault(${q(s.fields[0])}, 'Reading')`), false);
}

/* ---------- 7. the list, the sort, the search ---------- */
{
  const sec = norm({ id: 'x-v', name: 'Tracker', title: 'Book', view: 'list', sort: { f: 'pct', dir: 'desc' }, fields: [
    { id: 'read', name: 'Read', type: 'number' }, { id: 'total', name: 'Total', type: 'number', req: true }, { id: 'pct', name: 'Progress', type: 'calculated', formula: 'round(100 * [read] / [total])', fmt: { style: 'percent', bar: true } },
    { id: 'st', name: 'Status', type: 'select', opts: ['Reading', 'Done'] }, { id: 'when', name: 'Done on', type: 'date', when: { field: 'st', equals: 'Done' } }, { id: 'gn', name: 'Genres', type: 'multiselect', opts: ['Sci-fi', 'Poetry'] }] });
  S.csections.push(sec);
  const add = (id, title, vals) => S.centries.push(A.xeNormalise({ id, sid: 'x-v', title, vals, created: 1000 + S.centries.length }));
  add('v1', 'Low', { read: 10, total: 100, st: 'Reading' }); add('v2', 'High', { read: 90, total: 100, st: 'Done', when: '2026-09-01', gn: ['Poetry'] }); add('v3', 'None', { st: 'Reading', total: 50 }); add('v4', 'Hidden date', { read: 5, total: 50, st: 'Reading', when: '2026-01-01' }); add('v5', 'Broken', { read: 1 });
  U.page = 'x-v'; U.xsQ = {}; U.xsAttn = {};
  const order = () => R(`xsVisible(xsById('x-v')).map(e => e.title)`);
  eq(order(), ['High', 'Low', 'Hidden date', 'None', 'Broken'], 'sorted by the calculated progress, highest first; equal ones in the order they were added; entries with no result last');
  S.csections[S.csections.length - 1].sort = { f: 'pct', dir: 'asc' }; eq(order(), ['Low', 'Hidden date', 'High', 'None', 'Broken'], 'lowest first, and the empty ones are still last');
  // search finds a calculated result and what is shown, and not what is hidden
  const find = t => { U.xsQ = { 'x-v': t }; return order(); };
  eq(find('90%').slice(0, 1), ['High']); eq(find('poetry'), ['High']); eq(find('2026-09'), ['High'], 'a date that is shown is searched'); eq(find('2026-01'), [], 'a value that is hidden is not'); U.xsQ = {};
  // "needs attention": the entry with a required field empty
  eq(R(`xsAttention(xsById('x-v'))`), 1); U.xsAttn = { 'x-v': true }; eq(order(), ['Broken']); const html = R(`xsBodyHtml(xsById('x-v'))`); assert.match(html, /xs-warn/); assert.match(html, /“Total” is required/); U.xsAttn = {};
  // the screen: a bar, the percentage, and the hidden date is not shown
  S.csections[S.csections.length - 1].view = 'table'; const page = R(`xsBodyHtml(xsById('x-v'))`); assert.match(page, /role="progressbar"/); assert.match(page, /90%/); assert.ok(!/Jan/.test(page) && /Sep/.test(page), 'the date that is shown is on the screen, the hidden one is not');
  for (const view of ['list', 'cards', 'table']) { S.csections[S.csections.length - 1].view = view; assert.doesNotThrow(() => A.render(), view); assert.match(R(`xsBodyHtml(xsById('x-v'))`), /90%/, view); }
  // grouping by a field that is hidden for an entry puts the entry under "no value"
  const g = S.csections[S.csections.length - 1]; g.group = 'st'; assert.doesNotThrow(() => R(`xsBodyHtml(xsById('x-v'))`)); g.group = '';
  // a section with nothing special costs nothing: no state is worked out
  assert.equal(R(`xfdAdvanced({ fields: [{ id: 'a', type: 'text' }] })`), false); assert.equal(R(`xfdRules({ fields: [{ id: 'a', type: 'text' }] })`), false); assert.equal(R(`xfdRules({ fields: [{ id: 'a', type: 'url' }] })`), true);
  S.csections.pop(); while (S.centries.some(e => e.sid === 'x-v')) S.centries.splice(S.centries.findIndex(e => e.sid === 'x-v'), 1);
}

/* ---------- 7b. what reminders and actions read: hidden is empty, calculated is a result in text, never a date ---------- */
{
  const sec = norm({ id: 'x-r', name: 'R', fields: [{ id: 'st', name: 'Status', type: 'select', opts: ['Open', 'Done'] }, { id: 'd', name: 'Due', type: 'date', when: { field: 'st', equals: 'Open' } }, { id: 'n', name: 'N', type: 'number' }, { id: 'c', name: 'C', type: 'calculated', formula: '[n] * 2', fmt: { unit: 'pt' } }, { id: 'g', name: 'G', type: 'multiselect', opts: ['a', 'b'] }] });
  S.csections.push(sec);
  const done = { id: 'e1', sid: 'x-r', title: 'T', vals: { st: 'Done', d: '2026-11-01', n: 4, g: ['a', 'b'] } }, open = { ...done, vals: { ...done.vals, st: 'Open' } };
  const call = (fn, ...a) => R(`${fn}(...${q(a)})`);
  assert.equal(call('xfdStored', sec, done, 'd'), undefined); assert.equal(call('xfdStored', sec, open, 'd'), '2026-11-01', 'a hidden date is no date for a reminder; shown again, it is'); assert.equal(call('xfdStored', sec, open, 'c'), undefined, 'a reminder never follows a calculated field'); assert.equal(call('xfdStored', sec, open, 'n'), 4);
  assert.equal(call('pkrFill', '{d} {n} {c} {g}', sec, done), '4 8 pt a b', 'a message leaves out a hidden field and shows a calculated one as it is shown'); assert.match(call('pkrFill', '{d}', sec, open), /\d/);
  assert.equal(call('pkaFill', '{d} {n} {c} {g}', sec, done), '4 8 pt a b'); assert.equal(call('pkaFill', '{d}', sec, open), '2026-11-01');
  assert.equal(call('pkrDone', { skipWhen: { field: 'd', equals: '' } }, sec, done), false, 'a hidden field is empty to "skip when it is filled in"'); assert.equal(call('pkrDone', { skipWhen: { field: 'd', equals: '' } }, sec, open), true);
  S.csections.pop();
}

/* ---------- 8. the entry form (the markup; the live behaviour is tested in a real browser) ---------- */
{
  const s = norm(base([{ id: 'st', name: 'Status', type: 'select', opts: ['A', 'B'], desc: 'Where it is' }, { id: 'n', name: 'Pages', type: 'number', req: true, min: 1, max: 9, int: true, ph: 'e.g. 3', fg: 'g1' }, { id: 'x', name: 'X <b>', type: 'text', when: { field: 'st', equals: 'B' }, fg: 'g1' }, { id: 'g', name: 'Genres', type: 'multiselect', opts: Array.from({ length: 10 }, (_, i) => 'o' + i), fg: 'g2' }, { id: 'c', name: 'Calc', type: 'calculated', formula: '[n]*2', fg: 'g2' }, { id: 'k', name: 'Done', type: 'check' }],
    { fgroups: [{ id: 'g1', name: 'The book', desc: 'Basics' }, { id: 'g2', name: 'Extras' }, { id: 'g3', name: 'Empty group' }], tpls: [{ id: 't', name: 'Novel', vals: { st: 'A' } }] }));
  const html = R(`xfuCoreHtml(${q(s)}, { title: '', notes: '', done: false, vals: { st: 'A', n: 4 } })`);
  assert.ok(html.indexOf('data-fld="st"') < html.indexOf('data-fgrp="g1"'), 'ungrouped fields come first, then each group'); assert.ok(html.indexOf('data-fld="k"') < html.indexOf('data-fgrp="g1"'));
  assert.match(html, /<fieldset class="xs-fg" data-fgrp="g1"><legend>The book<\/legend>/); assert.ok(!/Empty group/.test(html), 'a group with no field is not drawn');
  assert.match(html, /data-fld="x" hidden/, 'a field whose condition is not met is drawn hidden'); assert.ok(!/data-fld="st" hidden/.test(html));
  assert.match(html, /aria-required="true"/); assert.match(html, /class="xs-rq" aria-hidden="true">\*/); assert.match(html, /min="1" max="9"/); assert.match(html, /step="1" inputmode="numeric"/); assert.match(html, /placeholder="e\.g\. 3"/);
  assert.match(html, /aria-describedby="xd-st xe-st"/); assert.match(html, /id="xd-st">Where it is/); assert.match(html, /id="xe-n" hidden/);
  assert.match(html, /data-xms="g"/, 'more than 8 options: a search box'); assert.match(html, /None selected/); assert.match(html, /data-xc="c"[^>]*>8/, 'the calculated value is there from the start'); assert.ok(!/data-xv="c"/.test(html), 'and has no input');
  assert.match(html, /X &lt;b&gt;/, 'a field name is escaped');
  assert.match(R(`xfuTemplatePicker(${q(s)})`), /Novel/); assert.equal(R(`xfuTemplatePicker({ tpls: [] })`), '');
  const all = R(`xfuCoreHtml(${q({ ...s, fgroups: undefined })}, { title: '', notes: '', done: false, vals: {} })`); assert.ok(all.includes('data-fld="n"') && !all.includes('data-fgrp'), 'fields whose group is gone are shown loose');
}

/* ---------- 9. sync and a round trip ---------- */
{
  const sec = norm({ id: 'x-sync', name: 'Sync', fields: [{ id: 'a', name: 'A', type: 'number', req: true, min: 0, fmt: { unit: 'kg' }, fg: 'g' }, { id: 'c', name: 'C', type: 'calculated', formula: '[a]*2', when: { field: 'a', filled: true } }, { id: 'm', name: 'M', type: 'multiselect', opts: ['x', 'y'], def: ['x'] }], fgroups: [{ id: 'g', name: 'G' }], tpls: [{ id: 't', name: 'T', vals: { a: 1, m: ['y'] } }] });
  S.csections.push(sec); S.centries.push(A.xeNormalise({ id: 'e-sync', sid: 'x-sync', title: 't', vals: { a: 3, m: ['x', 'y'] } }));
  const pl = JSON.parse(A.buildPayload().text), got = pl.csections.find(x => x.id === 'x-sync'); eq(got.fields, sec.fields); eq(got.fgroups, sec.fgroups); eq(got.tpls, sec.tpls); eq(pl.centries.find(e => e.id === 'e-sync').vals, { a: 3, m: ['x', 'y'] });
  // another device that only knows about version 0.9.0 data reads the same file: the extra keys are inert, and the 0.9.1 reader tolerates a 0.9.0 section
  eq(norm(J(got)), J(got), 'what is synced is stable under the normaliser');
  S.csections.pop(); S.centries.pop();
}
/* ---------- 10. packs: reading, installing, exporting ---------- */
{
  const tracker = () => ({ opentick: 'pack', format: 2, id: 'reading-tracker', name: 'Reading tracker', version: '1.0.0', sections: [{
    name: 'Books', icon: 'book-open', color: '#8e5cf7', title: 'Title', view: 'cards', group: 'status', sort: { f: 'percentage-done', dir: 'desc' },
    groups: [{ key: 'info', name: 'Book information', description: 'What it is' }, { key: 'progress', name: 'Reading progress' }],
    fields: [
      { key: 'author', name: 'Author', type: 'text', group: 'info', placeholder: 'Who wrote it' },
      { key: 'status', name: 'Status', type: 'select', opts: ['To read', 'Reading', 'Finished'], default: 'To read', required: true, group: 'progress' },
      { key: 'total-pages', name: 'Total pages', type: 'number', min: 1, integer: true, group: 'progress', format: { thousands: true, unit: 'pages' } },
      { key: 'pages-read', name: 'Pages read', type: 'number', min: 0, integer: true, group: 'progress', description: 'Where you are now' },
      { key: 'percentage-done', name: 'Percentage done', type: 'calculated', formula: 'min(100, round(100 * [pages-read] / [total-pages], 1))', format: { style: 'percent', decimals: 1, progress: true }, group: 'progress', opts: [] },
      { key: 'date-finished', name: 'Date finished', type: 'date', visibleWhen: { field: 'status', equals: 'Finished' }, group: 'progress', format: { dateFormat: 'long' } },
      { key: 'genres', name: 'Genres', type: 'multiselect', opts: ['Fiction', 'Science', 'History'], min: 0, max: 2 }, { key: 'link', name: 'Link', type: 'url' }],
    templates: [{ key: 'ebook', name: 'Ebook', description: 'On a device', values: { status: 'Reading', genres: ['Fiction'] } }, { key: 'audio', name: 'Audiobook', title: 'Audiobook:', values: { status: 'Reading', 'total-pages': 300 } }],
    entries: [{ title: 'Dune', vals: { author: 'Herbert', status: 'Finished', 'total-pages': 600, 'pages-read': 600, 'date-finished': '2026-02-01', genres: ['Fiction'] } }] }] });
  const clean = (raw) => R(`(() => { const r = packClean(${q(raw)}); return { pack: r.pack, warnings: r.warnings }; })()`);
  const r = clean(tracker()); eq(r.warnings, [], 'a pack that does everything right has nothing to warn about'); const sec = r.pack.sections[0];
  eq(sec.fields.find(f => f.key === 'percentage-done'), { key: 'percentage-done', name: 'Percentage done', type: 'calculated', opts: [], formula: 'min(100, round(100 * [pages-read] / [total-pages], 1))', fmt: { style: 'percent', dec: 1, bar: true }, fg: 'progress' });
  eq(sec.fields.find(f => f.key === 'date-finished').when, { field: 'status', equals: 'Finished' }); eq(sec.groups, [{ id: 'info', name: 'Book information', desc: 'What it is' }, { id: 'progress', name: 'Reading progress' }]);
  eq(sec.templates[1].vals, { status: 'Reading', 'total-pages': 300 }); assert.equal(R(`packFormatNeeded(${q(r.pack)})`), 2);
  // installing: every key becomes the section's own id, in the formula, the condition and the templates
  const before = S.csections.length; const inst = R(`(() => { const r = packInstall(packClean(${q(tracker())}).pack, { kind: 'file' }); const s = r.sections[0]; return { s, e: S.centries.filter(e => e.sid === s.id) }; })()`);
  const s = inst.s, byName = n => s.fields.find(f => f.name === n); assert.equal(S.csections.length, before + 1);
  assert.match(byName('Percentage done').formula, /^min\(100, round\(100 \* \[f\w+\] \/ \[f\w+\], 1\)\)$/); assert.ok(!/pages-read|total-pages/.test(byName('Percentage done').formula), 'no key is left in the formula');
  assert.ok(byName('Percentage done').formula.includes('[' + byName('Pages read').id + ']') && byName('Percentage done').formula.includes('[' + byName('Total pages').id + ']'));
  eq(byName('Date finished').when, { field: byName('Status').id, equals: 'Finished' }); eq(s.sort, { f: byName('Percentage done').id, dir: 'desc' }); assert.equal(s.group, byName('Status').id);
  assert.ok(s.fgroups.length === 2 && byName('Pages read').fg === 'progress'); eq(s.tpls[1].vals, { [byName('Status').id]: 'Reading', [byName('Total pages').id]: 300 }, 'template values follow the new ids');
  eq(inst.e[0].vals, { [byName('Author').id]: 'Herbert', [byName('Status').id]: 'Finished', [byName('Total pages').id]: 600, [byName('Pages read').id]: 600, [byName('Date finished').id]: '2026-02-01', [byName('Genres').id]: ['Fiction'] });
  eq(R(`(() => { const s = xsById(${q(s.id)}); const st = xfdState(s, ${q(inst.e[0].vals)}); return st.calc[${q(byName('Percentage done').id)}]; })()`), { v: 100, err: '' }, 'and the formula works on the installed section');
  // the specification’s own example: 120 of 300 pages is 40%
  eq(state(s, { [byName('Pages read').id]: 120, [byName('Total pages').id]: 300 }).calc[byName('Percentage done').id].v, 40);
  // installing twice: a second copy, with its own ids
  const again = R(`packInstall(packClean(${q(tracker())}).pack).sections[0]`); assert.notEqual(again.id, s.id); assert.notEqual(again.fields[0].id, s.fields[0].id);
  // export → read → install gives back the same section (apart from the ids)
  const shape = x => { const nm = id => (x.fields.find(f => f.id === id) || {}).name || id, m = c => (c.all || c.any ? { [c.all ? 'all' : 'any']: (c.all || c.any).map(m) } : { ...c, field: nm(c.field) }); return J({ name: x.name, group: nm(x.group), sort: x.sort.f === 'created' || x.sort.f === 'title' ? x.sort.f : nm(x.sort.f), view: x.view, fgroups: x.fgroups, tpls: (x.tpls || []).map(t => ({ ...t, vals: Object.fromEntries(Object.entries(t.vals).map(([k, v]) => [nm(k), v])) })), fields: x.fields.map(f => { const { id, ...o } = f; if (o.when) o.when = m(o.when); if (o.formula) o.formula = o.formula.replace(/\[([^\]]+)\]/g, (_, k) => '[' + nm(k) + ']'); return o; }) }); };
  const out = R(`packFromSections([xsById(${q(s.id)})], { name: 'Reading tracker' }, true)`); assert.equal(out.format, 2); const f0 = out.sections[0].fields.find(f => f.name === 'Date finished'); assert.equal(f0.visibleWhen.equals, 'Finished'); assert.equal(f0.format.dateFormat, 'long'); eq(out.sections[0].fields.find(f => f.name === 'Percentage done').format, { style: 'percent', decimals: 1, progress: true });
  assert.equal(out.sections[0].groups[0].description, 'What it is'); assert.equal(out.sections[0].templates[1].title, 'Audiobook:');
  const back = R(`(() => { const r = packClean(JSON.parse(${q(JSON.stringify(out))})); const i = packInstall(r.pack, {}); return { s: i.sections[0], w: r.warnings, e: S.centries.filter(e => e.sid === i.sections[0].id).length }; })()`);
  eq(back.w, [], 'what the app writes, the app reads without a word'); eq(shape(back.s), shape(s), 'the section survives export and import: fields, rules, formats, groups, templates, conditions and formulas'); assert.equal(back.e, 1);
  // a pack that uses nothing new stays format 1 (it keeps working in 0.9.0)
  const plain = { opentick: 'pack', format: 1, id: 'plain', name: 'Plain', sections: [{ name: 'S', fields: [{ key: 'a', name: 'A', type: 'text' }, { key: 'b', name: 'B', type: 'select', opts: ['x'] }] }] };
  assert.equal(R(`packFormatNeeded(packClean(${q(plain)}).pack)`), 1); assert.equal(R(`packFromSections([xsNormalise({ id: 'x-p', name: 'S', fields: [{ id: 'a', name: 'A', type: 'text' }] })], {}, false).format`), 1);
  // things that go wrong are said, one by one, and the rest is kept
  const bad = tracker(); const bs = bad.sections[0]; bad.format = 1;
  bs.fields[2].min = 10; bs.fields[2].max = 5; bs.fields[0].description = { x: 1 }; bs.fields[0].colour = 'red'; bs.fields[0].group = 'nope'; bs.fields[5].visibleWhen = { field: 'ghost', equals: 1 }; bs.fields[4].formula = '[pages-read] / ';
  bs.fields.push({ key: 'a1', name: 'A1', type: 'text', visibleWhen: { field: 'a2', filled: true } }, { key: 'a2', name: 'A2', type: 'text', visibleWhen: { field: 'a1', filled: true } }, { key: 'ck', name: 'Box', type: 'check', required: true, placeholder: 'x' });
  bs.templates[0].values = { status: 'Nope', 'total-pages': 'abc', ghost: 1 };
  bs.entries.push({ title: 'Bad', vals: { 'pages-read': -4, status: 'Maybe', link: 'not a url', genres: ['Fiction', 'Zzz'], 'percentage-done': 50, 'date-finished': 'soon' } }, { title: 'No status', vals: { 'total-pages': 10 } });
  const rb = clean(bad), bw = rb.warnings.join('\n'); const bsec = rb.pack.sections[0];
  for (const re of [/format 2 but says format 1/, /“Total pages” in “Books”: .*did not fit|min, max/, /“Author” in “Books”: description/, /propert(y|ies) this version .*colour/, /group “nope”/, /visibleWhen condition that is not valid/, /formula of “Percentage done” in “Books” does not work/, /led back to themselves/, /“Box” in “Books”: placeholder, required/, /templates of “Books”/, /calculated fields in “Books” .*ignored/, /missing a required value/, /did not fit their field/]) assert.match(bw, re, String(re) + '\n' + bw);
  assert.ok(bsec.fields.length === 11 && bsec.entries.length === 3, 'nothing else is lost: every field and every entry is still there'); assert.equal(bsec.entries[1].vals['pages-read'], undefined, 'a value that breaks the field’s rule is left out'); eq(bsec.entries[1].vals, {}, 'and so is everything else in that entry that does not fit'); assert.equal(bsec.entries[2].title, 'No status', 'an entry missing a required value is kept (it is marked on the screen)');
  assert.ok(!bsec.fields.find(f => f.key === 'a1').when && !bsec.fields.find(f => f.key === 'a2').when, 'a loop of conditions is removed');
  // it is data: a formula is never run, whatever it says
  const evil = tracker(); evil.sections[0].fields[4].formula = 'eval("process.exit()") + constructor.constructor("return 1")()'; const ev = clean(evil); assert.ok(ev.warnings.some(w => /does not work/.test(w))); assert.equal(R(`xfdState({ fields: ${q(ev.pack.sections[0].fields.map(f => ({ ...f, id: f.key })))} }, {}).calc['percentage-done'].v`), null);
  // a newer format than this app knows is still refused politely
  assert.throws(() => R(`packClean(${q({ ...tracker(), format: 3 })})`), /newer OpenTick/);
  // limits
  const huge = tracker(); huge.sections[0].groups = Array.from({ length: 20 }, (_, i) => ({ key: 'g' + i, name: 'G' + i })); huge.sections[0].templates = Array.from({ length: 20 }, (_, i) => ({ key: 't' + i, name: 'T' + i })); const hw = clean(huge); assert.equal(hw.pack.sections[0].groups.length, 8); assert.equal(hw.pack.sections[0].templates.length, 8); assert.ok(hw.warnings.some(w => /groups of “Books”/.test(w)) && hw.warnings.some(w => /templates of “Books”/.test(w)));
  while (S.csections.length > before) S.csections.pop(); S.centries.length = 0;
}
console.log('advanced field tests passed (cleaning, validation, shown-when, calculated, formats, templates, views, form markup, sync)');
