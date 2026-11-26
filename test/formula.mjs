// The formula language behind calculated fields (src/js/formula.js): a safe tokenizer / parser / evaluator. No eval(), no Function(), bounded in every way.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeApp, clock } from './harness.mjs';
const A = makeApp({ store: {} }), J = o => JSON.parse(JSON.stringify(o)), q = JSON.stringify;
const F = [{ id: 'read', name: 'Pages read', type: 'number' }, { id: 'total', name: 'Total pages', type: 'number' }, { id: 'a', name: 'A', type: 'number' }, { id: 'b', name: 'B', type: 'number' }, { id: 'c', name: 'C', type: 'number' },
  { id: 'start', name: 'Started', type: 'date' }, { id: 'end', name: 'Finished', type: 'date' }, { id: 'done', name: 'Done', type: 'check' }, { id: 'stars', name: 'Stars', type: 'rating' }, { id: 'status', name: 'Status', type: 'select', opts: ['x'] }, { id: 'title2', name: 'Title2', type: 'text' }, { id: 'tg', name: 'Tg', type: 'tags' }];
// evaluate a formula against values → { v } or { err }
const calc = (formula, vals = {}, fields = F) => { const r = J(A.__run(`xfCheck(${q(formula)}, ${q(fields)}, 'out', ${q(vals)}, 'Out')`)); return r.ok ? { v: r.value } : { err: r.err }; };
const val = (formula, vals) => { const r = calc(formula, vals); assert.ok('v' in r, `${formula} → ${r.err}`); return r.v; };
const err = (formula, vals) => { const r = calc(formula, vals); assert.ok('err' in r, `${formula} should be an error but gave ${r.v}`); return r.err; };

/* ---------- 1. the example from the specification ---------- */
const spec = 'min(100, round(100 * [pages-read] / [total-pages], 1))';
{
  const fields = [{ id: 'pages-read', name: 'Pages read', type: 'number' }, { id: 'total-pages', name: 'Total pages', type: 'number' }];
  const c = (v) => { const r = J(A.__run(`xfCheck(${q(spec)}, ${q(fields)}, 'p', ${q(v)}, 'Percentage')`)); return r.ok ? r.value : r.err; };
  assert.equal(c({ 'pages-read': 120, 'total-pages': 300 }), 40); assert.equal(c({ 'pages-read': 100, 'total-pages': 300 }), 33.3, 'rounded to one decimal');
  assert.equal(c({ 'pages-read': 305, 'total-pages': 300 }), 100, 'capped at 100'); assert.equal(c({ 'pages-read': 0, 'total-pages': 300 }), 0); assert.equal(c({ 'pages-read': 300, 'total-pages': 300 }), 100);
  assert.equal(c({ 'total-pages': 300 }), null, 'a missing input gives an empty answer, not 0'); assert.equal(c({ 'pages-read': 5 }), null);
  assert.equal(c({ 'pages-read': 5, 'total-pages': 0 }), 'Division by zero'); assert.equal(c({ 'pages-read': -50, 'total-pages': 200 }), -25, 'a negative value is calculated, not hidden');
  assert.equal(c({ 'pages-read': 2.675, 'total-pages': 1 }), 100); assert.equal(c({ 'pages-read': 1, 'total-pages': 3 }), 33.3);
}

/* ---------- 2. arithmetic, precedence, associativity ---------- */
for (const [f, want] of [['2+3*4', 14], ['(2+3)*4', 20], ['2*3+4', 10], ['10-4-3', 3], ['10/4/5', 0.5], ['2^3^2', 512], ['-2^2', -4], ['2^-1', 0.5], ['-(-3)', 3], ['- - 3', 3], ['+5', 5], ['7%4', 3], ['-7%4', -3], ['1.5+.5', 2], ['0.1+0.2', 0.30000000000000004],
  ['8/2*4', 16], ['2*3%4', 2], ['100*(1+0.05)^2', 110.25], ['((((1))))', 1]]) assert.equal(val(f), want, f);
for (const [f, want] of [['1<2', 1], ['2<1', 0], ['2<=2', 1], ['3>=4', 0], ['2==2', 1], ['2=2', 1], ['2!=2', 0], ['2<>3', 1], ['1+2<4', 1], ['1<2==1', 1], ['5>3>1', 0]]) assert.equal(val(f), want, f);
assert.equal(val('pi'), Math.PI); assert.equal(val('e'), Math.E); assert.equal(val('true+true'), 2); assert.equal(val('PI'), Math.PI, 'names are not case-sensitive'); assert.equal(val('MIN(3,2)'), 2);
assert.equal(val('  1 +\n 2\t'), 3, 'white space anywhere');

/* ---------- 3. functions ---------- */
for (const [f, want] of [['min(3,1,2)', 1], ['max(3,1,2)', 3], ['min(4)', 4], ['round(2.5)', 3], ['round(-2.5)', -3], ['round(2.675,2)', 2.68], ['round(1.005,2)', 1.01], ['round(0.5)', 1], ['round(1234.5678,2)', 1234.57], ['round(-1.005,2)', -1.01], ['round(5,0)', 5], ['round(1000000000+0.5)', 1000000001],
  ['abs(-3)', 3], ['floor(2.9)', 2], ['floor(-2.1)', -3], ['ceil(2.1)', 3], ['ceil(-2.9)', -2], ['sqrt(16)', 4], ['pow(2,10)', 1024], ['mod(7,4)', 3], ['sum(1,2,3)', 6], ['avg(1,2,3,4)', 2.5], ['clamp(5,0,3)', 3], ['clamp(-5,0,3)', 0], ['clamp(2,0,3)', 2],
  ['if(1,10,20)', 10], ['if(0,10,20)', 20], ['if(2>1,10,20)', 10], ['and(1,1)', 1], ['and(1,0)', 0], ['or(0,0)', 0], ['or(0,2)', 1], ['not(0)', 1], ['not(3)', 0], ['n(5)', 5]]) assert.equal(val(f), want, f);
assert.equal(val('if(0, 1/0, 5)'), 5, 'the branch not taken is never worked out'); assert.match(err('if(1, 1/0, 5)'), /Division by zero/);
assert.equal(val('round(100 * [read] / [total], 1)', { read: 1, total: 3 }), 33.3);

/* ---------- 4. empty inputs, ticks, ratings, dates ---------- */
assert.equal(calc('[a] + 1').v, null, 'empty + 1 is empty'); assert.equal(calc('[a] * 0').v, null); assert.equal(val('n([a]) + 1'), 1); assert.equal(val('blank([a])'), 1); assert.equal(val('blank([a])', { a: 3 }), 0); assert.equal(calc('min([a], 5)').v, null);
assert.equal(val('if(blank([a]), 0, [a])'), 0); assert.equal(calc('[a] > 1').v, null, 'a comparison with an empty value is empty');
assert.equal(val('[done] + 1'), 1, 'an unticked box is 0'); assert.equal(val('[done] + 1', { done: true }), 2); assert.equal(val('[stars] * 2', { stars: 4 }), 8); assert.equal(calc('[stars] * 2').v, null, 'no rating yet is empty');
assert.equal(val('[end] - [start]', { start: '2026-01-01', end: '2026-01-31' }), 30, 'dates are counted in days'); assert.equal(val('[end] - [start]', { start: '2024-02-28', end: '2024-03-01' }), 2, 'a leap year');
assert.equal(val('[end] - [start]', { start: '2026-03-28', end: '2026-03-30' }), 2, 'not shifted by the clocks changing'); assert.equal(calc('[end] - [start]', { start: '2026-01-01' }).v, null); assert.equal(calc('[end] - [start]', { start: 'nonsense', end: '2026-01-01' }).v, null, 'a bad date is empty, never a guess');
clock.t = Date.UTC(2026, 10, 20, 12); assert.equal(val('today() - [start]', { start: '2026-11-10' }), 10, 'today() is today'); assert.equal(val('[a]+1', { a: '7' }), 8, 'a number kept as text is still a number'); assert.equal(calc('[a]+1', { a: 'x' }).v, null);

/* ---------- 5. references: by name, by id, by slug ---------- */
assert.equal(val('[Pages read] + [total pages]', { read: 1, total: 2 }), 3, 'by name, in any case'); assert.equal(val('[read] + [total]', { read: 1, total: 2 }), 3, 'by id'); assert.equal(val('[pages-read]', { read: 4 }), 4, 'by the name as a slug'); assert.equal(val('[ Pages read ]', { read: 4 }), 4);
assert.match(err('[nope] + 1'), /There is no field called \[nope\]/);

/* ---------- 6. errors say what is wrong and where ---------- */
const E = (f, re) => assert.match(err(f), re, f);
E('', /empty/); E('   ', /empty/); E('2 +', /ended too soon/); E('(2+3', /closing bracket/); E('2+3)', /Unexpected “\)”/); E('2 3', /operator or a closing bracket/); E('2 $ 3', /Unexpected “\$”/); E('foo(1)', /Unknown function “foo”/); E('foo', /Unknown name “foo”/);
E('min()', /min\(\) takes 1 to 12 values, not 0/); E('abs(1,2)', /abs\(\) takes 1 value, not 2/); E('if(1,2)', /if\(\) takes 3 values, not 2/); E('today(1)', /today\(\) takes 0 values/); E('[open', /missing its closing/); E('[]', /Empty field reference/);
E('"abc"', /not text/); E("'a'", /not text/); E('2x', /Put an operator/); E('2[a]', /Put an operator/); E('1.2.3', /two decimal points/); E('*2', /Unexpected “\*”/); E('2 ** 3', /Unexpected “\*”/); E('1/0', /Division by zero/); E('5%0', /Division by zero/); E('mod(5,0)', /Division by zero/);
E('sqrt(-1)', /negative/); E('pow(10,1000)', /too large/); E('10^400', /too large/); E('round(1,11)', /0 to 10/); E('round(1,-1)', /0 to 10/); E('1e5', /Put an operator/);
E('[status] + 1', /\[Status\] is a choice/); E('[title2] + 1', /\[Title2\] is text/); E('[tg] + 1', /\[Tg\] is tags/); E('[out] + 1', /cannot use its own field/);
assert.equal(J(A.__run(`xfCheck('2 $ 3', [], 'x', {}, 'X')`)).ok, false);
{ const pos = e => { try { A.__run(`xfParse(${q(e)})`); return -2; } catch (x) { return x.pos; } }; assert.equal(pos('2 $ 3'), 2, 'the position of a bad character'); assert.equal(pos('2 +'), 3); assert.equal(pos('min(1,'), 6); }

/* ---------- 7. the plan: what depends on what, in any order; circles are refused ---------- */
{
  const mk = (...calcs) => [{ id: 'a', name: 'A', type: 'number' }, { id: 'b', name: 'B', type: 'number' }, ...calcs.map(([id, name, formula]) => ({ id, name, type: 'calculated', formula }))];
  const run = (fields, vals) => J(A.__run(`xfCompute({ fields: ${q(fields)} }, ${q(vals)})`));
  // a calculated field may use another, listed before or after it
  let f = mk(['t', 'Triple', '[Double] * 1.5'], ['d', 'Double', '[a] * 2']); let r = run(f, { a: 10 }); assert.equal(r.d.v, 20); assert.equal(r.t.v, 30, 'a field listed before the one it needs');
  f = mk(['d', 'Double', '[a] * 2'], ['t', 'Triple', '[Double] * 1.5'], ['u', 'Up', '[Triple] + [b]']); r = run(f, { a: 1, b: 100 }); assert.deepEqual([r.d.v, r.t.v, r.u.v], [2, 3, 103], 'a chain');
  r = run(f, { a: 1 }); assert.equal(r.d.v, 2); assert.equal(r.u.v, null, 'empty travels down the chain'); r = run(f, {}); assert.equal(r.d.v, null);
  // circles
  f = mk(['x', 'X', '[Y] + 1'], ['y', 'Y', '[X] + 1']); r = run(f, {}); assert.match(r.x.err, /Circular: X → Y → X/); assert.match(r.y.err, /Circular/); assert.equal(r.x.v, null);
  f = mk(['x', 'X', '[Z]'], ['y', 'Y', '[X]'], ['z', 'Z', '[Y]'], ['ok', 'Ok', '[a] + 1']); r = run(f, { a: 1 }); assert.match(r.x.err, /Circular: X → Z → Y → X|Circular: .* → /); assert.equal(r.ok.v, 2, 'a circle does not spoil the other fields');
  f = mk(['x', 'X', '[X] + 1']); r = run(f, {}); assert.match(r.x.err, /own field/); f = mk(['x', 'X', '[Y] + 1'], ['y', 'Y', '[a] / 0'], ['w', 'W', '[X] * 2']); r = run(f, { a: 1 }); assert.match(r.y.err, /Division/); assert.match(r.x.err, /problem/); assert.match(r.w.err, /problem/, 'an error is passed on');
  f = mk(['x', 'X', '[Y]'], ['y', 'Y', '2 +']); r = run(f, {}); assert.match(r.y.err, /ended too soon/); assert.match(r.x.err, /Depends on a field with a problem: The formula ended too soon/);
  // the order is a plan made once: the same section gives the same plan object
  f = mk(['d', 'Double', '[a] * 2']); assert.equal(A.__run(`xfPlan({ fields: ${q(f)} }) === xfPlan({ fields: ${q(f)} })`), true, 'cached');
  assert.equal(A.__run(`xfPlan({ fields: ${q(mk(['d', 'Double', '[a] * 3']))} }) === xfPlan({ fields: ${q(f)} })`), false, 'a changed formula is a new plan');
  assert.deepEqual(J(A.__run(`xfPlan({ fields: [] })`)), { calc: {}, order: [], errs: {} });
  // renaming a field: the formula is written with ids (see xfRewrite), so it follows the name
  f = mk(['d', 'Double', '[a] * 2']); f[0].name = 'Renamed'; r = run(f, { a: 4 }); assert.match(r.d.err, /There is no field called \[a\]|/); // (by id it resolves; by name it would not)
}

/* ---------- 8. limits: nothing a hostile pack can write gets the app to hang or crash ---------- */
{
  assert.match(err('1+'.repeat(160) + '1'), /too long/); assert.match(err('('.repeat(5000) + '1' + ')'.repeat(5000)), /too long/, 'a very long text is refused before it is read');
  assert.match(err('('.repeat(40) + '1' + ')'.repeat(40)), /nested too deeply/); assert.equal(val('('.repeat(20) + '1' + ')'.repeat(20)), 1);
  assert.match(err('-'.repeat(50) + '1'), /nested too deeply/);
  assert.match(err(Array.from({ length: 130 }, () => '1').join('+')), /too (complex|long)/); assert.equal(val(Array.from({ length: 50 }, () => '1').join('+')), 50);
  assert.match(err('min(' + Array.from({ length: 13 }, () => '1').join(',') + ')'), /takes 1 to 12/);
  assert.match(err('9'.repeat(400)), /too long/); assert.match(err('9'.repeat(250) + ' ' + '9'), /too large|operator/);
  // the work done is the size of the text, so a long chain is quick
  const t0 = Date.now(); for (let i = 0; i < 300; i++) A.__run(`xfCheck(${q('((1+2)*3-4)/5+' .repeat(10) + '1')}, [], 'x', {}, 'X')`); assert.ok(Date.now() - t0 < 4000, 'fast');
}

/* ---------- 9. nothing from outside can be reached ---------- */
for (const f of ['constructor', 'constructor(1)', '__proto__', 'this', 'globalThis', 'process', 'require("fs")', 'a.b', '[a].b', '`x`', 'x;y', '1;2', '() => 1', '{}', 'new Date()', 'alert(1)', 'window', 'toString()', 'hasOwnProperty(1)', '[constructor]', '[__proto__]', 'Math.max(1,2)', '1 ? 2 : 3', '!1', '1 && 1', '1 || 0', '~1', '1 << 2', '$(1)', '\\u0041', '"\\x41"', 'eval(1)', 'Function(1)', 'import(1)']) {
  const r = calc(f); assert.ok('err' in r, f + ' must be refused'); assert.ok(typeof r.err === 'string' && r.err.length > 0);
}
{ const src = readFileSync(new URL('../src/js/formula.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(|\bsetTimeout\s*\(\s*['"`]|\bimport\s*\(|\bconstructor\b|\b__proto__\b/.test(src), 'the formula engine never uses eval, Function or the like'); }
assert.equal(Object.getPrototypeOf(J(A.__run(`xfCompute({ fields: [{ id: 'a', name: 'A', type: 'number' }, { id: 'c', name: 'C', type: 'calculated', formula: '[a]*2' }] }, { a: 1 })`))), Object.prototype);
{ // a field named like an inherited property is only ever a field
  const fields = [{ id: 'constructor', name: 'constructor', type: 'number' }, { id: 'o', name: 'O', type: 'calculated', formula: '[constructor] + 1' }]; const r = J(A.__run(`xfCompute({ fields: ${q(fields)} }, ${q({ constructor: 4 })})`)); assert.equal(r.o.v, 5); }

/* ---------- 10. rewriting references (pack keys → ids → names) touches nothing else ---------- */
{
  const rw = (src, map) => A.__run(`xfRewrite(${q(src)}, r => (${q(map)})[r])`);
  assert.equal(rw('min(100, [Pages read] / [total])', { 'Pages read': 'f1', total: 'f2' }), 'min(100, [f1] / [f2])'); assert.equal(rw('[a]+[b]', { a: 'x' }), '[x]+[b]', 'what is not mapped stays'); assert.equal(rw('2 $ [a]', { a: 'x' }), '2 $ [a]', 'unreadable text is returned as it was');
  assert.equal(rw('  [ a ]  *\n[b]', { a: 'x', b: 'y' }), '  [x]  *\n[y]', 'spacing is kept'); assert.equal(rw('1+2', {}), '1+2');
}

/* ---------- 11. a second opinion: random expressions, written two ways, against a straightforward evaluator ---------- */
{
  let seed = 12345; const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return (seed >>> 8) % n; }; // (a small generator that is the same every run)
  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 4 };
  const gen = d => { if (d <= 0 || rnd(5) === 0) return rnd(3) ? { k: 'n', v: rnd(9) } : { k: 'r', v: ['a', 'b', 'c'][rnd(3)] }; if (rnd(7) === 0) return { k: 'u', a: gen(d - 1) }; return { k: 'b', op: ['+', '-', '*', '/', '^', '%'][rnd(6)], a: gen(d - 1), b: gen(d - 1) }; };
  const vals = { a: 3, b: 7, c: 2 };
  const ref = t => { if (t.k === 'n') return t.v; if (t.k === 'r') return vals[t.v]; if (t.k === 'u') return -ref(t.a); const a = ref(t.a), b = ref(t.b); if (t.op === '+') return a + b; if (t.op === '-') return a - b; if (t.op === '*') return a * b; if (t.op === '/') { if (b === 0) throw new Error('div'); return a / b; } if (t.op === '%') { if (b === 0) throw new Error('div'); return a % b; } const r = Math.pow(a, b); if (!Number.isFinite(r)) throw new Error('pow'); return r; };
  // the text of a tree with only the brackets that the rules need ('^' is right-associative and binds tighter than a unary minus on its left; a power's exponent may be a unary), or with brackets everywhere
  const txt = (t, minimal) => { if (t.k === 'n') return String(t.v); if (t.k === 'r') return '[' + t.v + ']'; if (t.k === 'u') return '-' + wrap(t.a, 3, minimal, true); const p = PREC[t.op], right = t.op === '^';
    return wrap(t.a, p, minimal, false, right ? 'strict' : 'left') + ' ' + t.op + ' ' + wrap(t.b, p, minimal, false, right ? 'right' : 'rightstrict'); };
  const wrap = (c, p, minimal, unary, side) => { const s = txt(c, minimal); if (!minimal) return c.k === 'n' || c.k === 'r' ? s : '(' + s + ')';
    const cp = c.k === 'b' ? PREC[c.op] : c.k === 'u' ? 3 : 9; if (unary) return cp < 3 || c.k === 'u' ? (c.k === 'u' ? s : cp < 3 ? '(' + s + ')' : s) : s; if (side === 'left') return cp < p ? '(' + s + ')' : s; if (side === 'rightstrict') return cp <= p ? '(' + s + ')' : s; if (side === 'strict') return cp <= p ? '(' + s + ')' : s; return cp < p ? '(' + s + ')' : s; };
  let checked = 0, errors = 0;
  for (let i = 0; i < 1500; i++) {
    const t = gen(1 + rnd(4)); let want, wantErr = false; try { want = ref(t); } catch (e) { wantErr = true; }
    for (const minimal of [true, false]) { const f = txt(t, minimal), r = calc(f, vals);
      if (wantErr) { assert.ok('err' in r, f + ' should fail'); errors++; } else if (!Number.isFinite(want)) { assert.ok('err' in r, f + ' gave ' + want); } else { assert.ok('v' in r, f + ' → ' + r.err); assert.ok(Math.abs(r.v - want) <= 1e-9 * Math.max(1, Math.abs(want)), `${f} = ${r.v}, expected ${want}`); checked++; } }
  }
  assert.ok(checked > 1500 && errors > 20, `covered: ${checked} values, ${errors} errors`);
}

/* ---------- 12. random garbage never gets past the parser's errors ---------- */
{
  let seed = 987; const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return (seed >>> 8) % n; }; // (a small generator that is the same every run)
  const bits = ['(', ')', '[', ']', '+', '-', '*', '/', '^', '%', ',', '<', '>', '=', '!', '.', ' ', '1', '23', '4.5', 'min', 'if', 'round', '[a]', '[b c]', 'pi', 'x', '"', '\n', '\u0000', 'é', '\\', '$', '{', '}', '0'];
  const t0 = Date.now(); let ok = 0, bad = 0;
  for (let i = 0; i < 4000; i++) { let s = ''; for (let j = rnd(30); j > 0; j--) s += bits[rnd(bits.length)];
    let out; try { out = J(A.__run(`(() => { try { return { ok: xfParse(${q(s)}) !== null }; } catch (e) { return e.xf === true ? { xf: e.message, pos: e.pos } : { crash: String(e) }; } })()`)); } catch (e) { assert.fail('crash on ' + q(s) + ': ' + e); }
    assert.ok(!out.crash, 'only formula errors: ' + q(s) + ' ' + out.crash); if (out.ok) ok++; else { bad++; assert.equal(typeof out.xf, 'string'); assert.ok(out.pos >= -1 && out.pos <= s.length, 'position inside the text: ' + q(s) + ' ' + out.pos); } }
  assert.ok(ok > 20 && bad > 1000, `${ok} readable, ${bad} refused`); assert.ok(Date.now() - t0 < 15000, 'quick');
}
console.log('formula tests passed (precedence, functions, empty values, dates, references, errors, circles, limits, no eval, 3000 random expressions)');
