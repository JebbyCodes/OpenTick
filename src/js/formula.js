/* OpenTick formulas (0.9.1): the safe expression language behind calculated fields.
   A formula is plain text such as   min(100, round(100 * [pages-read] / [total-pages], 1))   that is READ here, never run: a hand-written tokenizer and a
   precedence parser build a small tree of numbers, field references, operators and calls to a fixed list of functions, and a separate evaluator walks that tree.
   There is no eval(), no Function(), no property access and no way to reach anything outside the entry's own numbers, so a formula in a pack from a stranger
   can do nothing but arithmetic. Everything is bounded: the length of the text, the size and depth of the tree, the number of fields.
   What a formula can use:
     numbers 12  3.5  .5      constants pi  e  true  false      field references [Pages read] or [pages-read] (the field's name, its id, or its name as a slug)
     operators  + - * / % ^   (^ is a power)   comparisons < <= > >= = == != <>   (1 for true, 0 for false)   brackets ( )   unary - and +
     functions  min max round(x, digits) abs floor ceil sqrt pow mod sum avg clamp(x, lo, hi) if(test, then, else) and or not n(x) blank(x) today()
   A date field counts as the number of days since 1970-01-01, so  [finished] - [started]  is how many days it took. A tick box is 1 or 0 and a rating is 1 to 5.
   An empty input makes the answer empty (nothing is shown, rather than a made-up 0); n([x]) turns an empty input into 0 where that is what you want.
   Text fields cannot be used in arithmetic: that is reported as an error when the formula is written, not later.
   Everything here is a function declaration or a constant used only at run time, so the section normaliser (which migrate() calls while core.js loads) never touches a constant. */
const XF_LIMIT = { len: 300, nodes: 120, depth: 24 };
const XF_FUNCS = {
  min: { lo: 1, hi: 12 }, max: { lo: 1, hi: 12 }, round: { lo: 1, hi: 2 }, abs: { lo: 1, hi: 1 }, floor: { lo: 1, hi: 1 }, ceil: { lo: 1, hi: 1 }, sqrt: { lo: 1, hi: 1 }, pow: { lo: 2, hi: 2 }, mod: { lo: 2, hi: 2 },
  sum: { lo: 1, hi: 12 }, avg: { lo: 1, hi: 12 }, clamp: { lo: 3, hi: 3 }, if: { lo: 3, hi: 3 }, and: { lo: 1, hi: 12 }, or: { lo: 1, hi: 12 }, not: { lo: 1, hi: 1 }, n: { lo: 1, hi: 1 }, blank: { lo: 1, hi: 1 }, today: { lo: 0, hi: 0 },
};
const XF_CONST = { pi: Math.PI, e: Math.E, true: 1, false: 0 };
const XF_CMP = ['<', '<=', '>', '>=', '==', '!=', '<>', '='];
const xfErr = (msg, pos) => { const e = new Error(msg); e.xf = true; e.pos = pos == null ? -1 : pos; return e; };

/* ---------- reading the text ---------- */
function xfTokens(src) {
  const out = []; let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i; while (j < n && /[0-9]/.test(src[j])) j++; if (src[j] === '.') { j++; while (j < n && /[0-9]/.test(src[j])) j++; }
      const v = Number(src.slice(i, j)); if (!isFinite(v)) throw xfErr('That number is too large', i);
      if (src[j] === '.') throw xfErr('A number cannot have two decimal points', j);
      if (/[A-Za-z_\[]/.test(src[j] || '')) throw xfErr('Put an operator between a number and what follows it, for example 2 * [x]', j);
      out.push({ t: 'num', v, p: i, e: j }); i = j; continue;
    }
    if (c === '[') {
      const j = src.indexOf(']', i + 1); if (j < 0) throw xfErr('A field name is missing its closing ]', i);
      const name = src.slice(i + 1, j).trim(); if (!name) throw xfErr('Empty field reference [ ]', i); if (name.length > 60 || /[\[\n\r]/.test(name)) throw xfErr('That is not a field name', i);
      out.push({ t: 'ref', v: name, p: i, e: j + 1 }); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++; out.push({ t: 'id', v: src.slice(i, j).toLowerCase(), p: i, e: j }); i = j; continue; }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '==' || two === '!=' || two === '<>') { out.push({ t: 'op', v: two, p: i, e: i + 2 }); i += 2; continue; }
    if ('+-*/%^(),<>='.includes(c)) { out.push({ t: 'op', v: c, p: i, e: i + 1 }); i++; continue; }
    if (c === '"' || c === "'") throw xfErr('Formulas work with numbers, dates, tick boxes and ratings, not text', i);
    throw xfErr(`Unexpected “${c}”`, i);
  }
  return out;
}

/* ---------- the tree: { k: 'n' v } { k: 'r' ref } { k: 'u' op a } { k: 'b' op a b } { k: 'f' name args } ---------- */
function xfParse(src) {
  src = String(src == null ? '' : src); if (!src.trim()) throw xfErr('The formula is empty', 0); if (src.length > XF_LIMIT.len) throw xfErr(`The formula is too long (the limit is ${XF_LIMIT.len} characters)`, XF_LIMIT.len);
  const toks = xfTokens(src); let i = 0, nodes = 0;
  const peek = () => toks[i], isOp = v => toks[i] && toks[i].t === 'op' && toks[i].v === v, end = () => src.length;
  const mk = o => { if (++nodes > XF_LIMIT.nodes) throw xfErr(`The formula is too complex (the limit is ${XF_LIMIT.nodes} parts)`, o.p == null ? 0 : o.p); return o; };
  const at = () => (toks[i] ? toks[i].p : end());
  const need = (v, what) => { if (!isOp(v)) throw xfErr(`Expected ${what || '“' + v + '”'}${toks[i] ? ` but found “${src.slice(toks[i].p, toks[i].e)}”` : ' but the formula ended'}`, at()); i++; };
  const cmp = d => { let a = add(d); while (toks[i] && toks[i].t === 'op' && XF_CMP.includes(toks[i].v)) { const t = toks[i++]; a = mk({ k: 'b', op: t.v === '=' ? '==' : t.v === '<>' ? '!=' : t.v, a, b: add(d), p: t.p }); } return a; };
  const add = d => { let a = mul(d); while (isOp('+') || isOp('-')) { const t = toks[i++]; a = mk({ k: 'b', op: t.v, a, b: mul(d), p: t.p }); } return a; };
  const mul = d => { let a = unary(d); while (isOp('*') || isOp('/') || isOp('%')) { const t = toks[i++]; a = mk({ k: 'b', op: t.v, a, b: unary(d), p: t.p }); } return a; };
  const unary = d => { if (d > XF_LIMIT.depth) throw xfErr(`The formula is nested too deeply (the limit is ${XF_LIMIT.depth} levels)`, at()); if (isOp('-') || isOp('+')) { const t = toks[i++]; return mk({ k: 'u', op: t.v, a: unary(d + 1), p: t.p }); } return pow(d); };
  const pow = d => { const a = primary(d); if (isOp('^')) { const t = toks[i++]; return mk({ k: 'b', op: '^', a, b: unary(d + 1), p: t.p }); } return a; };
  const primary = d => {
    const t = toks[i]; if (!t) throw xfErr('The formula ended too soon: something is missing at the end', end());
    if (t.t === 'num') { i++; return mk({ k: 'n', v: t.v, p: t.p }); }
    if (t.t === 'ref') { i++; return mk({ k: 'r', ref: t.v, p: t.p }); }
    if (t.t === 'id') {
      i++;
      if (isOp('(')) {
        if (!Object.prototype.hasOwnProperty.call(XF_FUNCS, t.v)) throw xfErr(`Unknown function “${t.v}”. You can use ${Object.keys(XF_FUNCS).join(', ')}`, t.p);
        i++; const args = []; if (!isOp(')')) { for (;;) { args.push(cmp(d + 1)); if (isOp(',')) { i++; continue; } break; } } need(')', 'a closing bracket “)”');
        const f = XF_FUNCS[t.v]; if (args.length < f.lo || args.length > f.hi) throw xfErr(`${t.v}() takes ${f.lo === f.hi ? f.lo : f.lo + ' to ' + f.hi} value${f.hi === 1 ? '' : 's'}, not ${args.length}`, t.p);
        return mk({ k: 'f', name: t.v, args, p: t.p });
      }
      if (Object.prototype.hasOwnProperty.call(XF_CONST, t.v)) return mk({ k: 'n', v: XF_CONST[t.v], p: t.p });
      throw xfErr(`Unknown name “${t.v}”. A field goes in square brackets, like [${t.v}]`, t.p);
    }
    if (t.v === '(') { i++; const a = cmp(d + 1); need(')', 'a closing bracket “)”'); return a; }
    throw xfErr(`Unexpected “${src.slice(t.p, t.e)}”${t.v === ')' ? ': there is no matching opening bracket' : ''}`, t.p);
  };
  const tree = cmp(0); if (toks[i]) throw xfErr(`Unexpected “${src.slice(toks[i].p, toks[i].e)}”: an operator or a closing bracket was expected`, toks[i].p);
  return tree;
}
function xfRefs(tree, out = []) { if (!tree) return out; if (tree.k === 'r') { if (!out.includes(tree.ref)) out.push(tree.ref); } else if (tree.k === 'u') xfRefs(tree.a, out); else if (tree.k === 'b') { xfRefs(tree.a, out); xfRefs(tree.b, out); } else if (tree.k === 'f') for (const a of tree.args) xfRefs(a, out); return out; }

/* ---------- fields: which field does [text] mean, and what number does a value make ---------- */
const xfSlug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
function xfResolve(ref, fields) { // its id, else its name, else the name written as a slug (pages-read for "Pages read")
  const r = String(ref).trim(), low = r.toLowerCase(), sl = xfSlug(r);
  return fields.find(f => f.id === r) || fields.find(f => String(f.name).trim().toLowerCase() === low) || fields.find(f => xfSlug(f.name) === sl && sl) || null;
}
const XF_NUMERIC = ['number', 'rating', 'check', 'date', 'calculated'];
function xfDays(iso) { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(iso || '')); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return Number.isFinite(t) ? Math.round(t / 864e5) : null; }
function xfFromDays(n) { if (!Number.isFinite(n)) return ''; const d = new Date(Math.round(n) * 864e5); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : ''; }
function xfNum(f, v) { // the number a stored value stands for; null = empty
  if (f.type === 'check') return v ? 1 : 0;
  if (v == null || v === '') return null;
  if (f.type === 'date') return xfDays(v);
  const x = typeof v === 'number' ? v : Number(v); return Number.isFinite(x) ? x : null;
}

/* ---------- the plan for a section: parse every calculated field once, find what depends on what, and refuse circles ---------- */
const XF_CACHE = new Map();
function xfPlan(s) {
  const fields = s.fields || [], calc = fields.filter(f => f.type === 'calculated');
  if (!calc.length) return { calc: Object.create(null), order: [], errs: Object.create(null) };
  const sig = JSON.stringify(fields.map(f => [f.id, f.name, f.type, f.formula || '']));
  const hit = XF_CACHE.get(sig); if (hit) return hit;
  const plan = { calc: Object.create(null), order: [], errs: Object.create(null) }; // (maps keyed by a field id, which a pack chooses: no inherited names such as constructor)
  for (const f of calc) {
    const p = { ast: null, deps: [], err: '' };
    try {
      p.ast = xfParse(f.formula || '');
      for (const ref of xfRefs(p.ast)) {
        const t = xfResolve(ref, fields);
        if (!t) throw xfErr(`There is no field called [${ref}]`, -1);
        if (t.id === f.id) throw xfErr('A formula cannot use its own field', -1);
        if (!XF_NUMERIC.includes(t.type)) throw xfErr(`[${t.name}] is ${t.type === 'select' || t.type === 'multiselect' ? 'a choice' : t.type === 'tags' ? 'tags' : 'text'}, and formulas work with numbers, dates, tick boxes and ratings`, -1);
        if (!p.deps.includes(t.id)) p.deps.push(t.id);
      }
    } catch (e) { if (!e.xf) throw e; p.err = e.message; p.pos = e.pos; p.ast = null; }
    plan.calc[f.id] = p;
  }
  // circles: a depth-first walk over the calculated fields; every field on a circle (and everything that needs one) gets the error
  const state = Object.create(null), name = id => (fields.find(f => f.id === id) || {}).name || id;
  const visit = (id, path) => {
    const p = plan.calc[id]; if (!p || p.err) return; if (state[id] === 2) return;
    if (state[id] === 1) { const cyc = path.slice(path.indexOf(id)).concat(id), msg = 'Circular: ' + cyc.map(name).join(' → '); for (const c of cyc) if (plan.calc[c] && !plan.calc[c].err) plan.calc[c].err = msg; return; }
    state[id] = 1; for (const d of p.deps) visit(d, path.concat(id)); state[id] = 2;
  };
  for (const f of calc) visit(f.id, []);
  for (let again = true; again;) { again = false; for (const f of calc) { const p = plan.calc[f.id]; if (p.err) continue; const bad = p.deps.map(d => plan.calc[d]).find(q => q && q.err); if (bad) { p.err = 'Depends on a field with a problem: ' + bad.err; again = true; } } }
  const done = new Set(); const put = id => { if (done.has(id)) return; done.add(id); const p = plan.calc[id]; if (p && !p.err) for (const d of p.deps) put(d); if (p) plan.order.push(id); }; for (const f of calc) put(f.id);
  for (const f of calc) if (plan.calc[f.id].err) plan.errs[f.id] = plan.calc[f.id].err;
  if (XF_CACHE.size > 60) XF_CACHE.clear(); XF_CACHE.set(sig, plan); return plan;
}

/* ---------- working it out ---------- */
function xfRun(t, get, today) {
  const num = x => { if (x === null) return null; if (!Number.isFinite(x)) throw xfErr('The result is not a number'); return x; };
  const ev = n => {
    switch (n.k) {
      case 'n': return n.v;
      case 'r': return get(n.ref);
      case 'u': { const a = ev(n.a); return a === null ? null : n.op === '-' ? -a : a; }
      case 'b': {
        const a = ev(n.a), b = ev(n.b); if (a === null || b === null) return null;
        switch (n.op) {
          case '+': return num(a + b); case '-': return num(a - b); case '*': return num(a * b);
          case '/': if (b === 0) throw xfErr('Division by zero', n.p); return num(a / b);
          case '%': if (b === 0) throw xfErr('Division by zero', n.p); return num(a % b);
          case '^': { const r = Math.pow(a, b); if (!Number.isFinite(r)) throw xfErr('That power is not a number or is too large', n.p); return r; }
          case '<': return a < b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>': return a > b ? 1 : 0; case '>=': return a >= b ? 1 : 0; case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0;
        }
        return null;
      }
      case 'f': {
        if (n.name === 'if') { const c = ev(n.args[0]); return c === null ? null : ev(c !== 0 ? n.args[1] : n.args[2]); }
        if (n.name === 'today') return today();
        const a = n.args.map(ev);
        if (n.name === 'n') return a[0] === null ? 0 : a[0];
        if (n.name === 'blank') return a[0] === null ? 1 : 0;
        if (n.name === 'and') return a.every(x => x !== null && x !== 0) ? 1 : 0;
        if (n.name === 'or') return a.some(x => x !== null && x !== 0) ? 1 : 0;
        if (n.name === 'not') return a[0] === null || a[0] === 0 ? 1 : 0;
        if (a.some(x => x === null)) return null;
        switch (n.name) {
          case 'min': return Math.min(...a); case 'max': return Math.max(...a);
          case 'sum': return num(a.reduce((p, q) => p + q, 0)); case 'avg': return num(a.reduce((p, q) => p + q, 0) / a.length);
          case 'abs': return Math.abs(a[0]); case 'floor': return Math.floor(a[0]); case 'ceil': return Math.ceil(a[0]);
          case 'sqrt': if (a[0] < 0) throw xfErr('The square root of a negative number is not a number', n.p); return Math.sqrt(a[0]);
          case 'pow': { const r = Math.pow(a[0], a[1]); if (!Number.isFinite(r)) throw xfErr('That power is not a number or is too large', n.p); return r; }
          case 'mod': if (a[1] === 0) throw xfErr('Division by zero', n.p); return num(a[0] % a[1]);
          case 'clamp': return Math.min(Math.max(a[0], a[1]), a[2]);
          case 'round': { const d = a.length > 1 ? Math.trunc(a[1]) : 0; if (d < 0 || d > 10) throw xfErr('round() can keep 0 to 10 decimal places', n.p); const k = Math.pow(10, d), r = Math.round(Math.abs(a[0]) * k * (1 + 1e-15)) / k; return a[0] < 0 ? -r : r; } // (halves go away from zero, and 2.675 is 2.68 as a person expects, not the 2.67 that its binary form would give)
        }
        return null;
      }
    }
    return null;
  };
  return num(ev(t));
}
const xfToday = () => { const d = new Date(); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
// every calculated value of one entry's values: { fieldId: { v: number | null, err: '' } }; a value is empty (null) when something it needs is empty
function xfCompute(s, vals) {
  const plan = xfPlan(s), out = Object.create(null), fields = s.fields || [], own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  for (const id of Object.keys(plan.errs)) out[id] = { v: null, err: plan.errs[id] };
  for (const id of plan.order) {
    const p = plan.calc[id]; if (p.err) continue;
    const get = ref => { const f = xfResolve(ref, fields); if (!f) throw xfErr(`There is no field called [${ref}]`); if (f.type === 'calculated') { const r = out[f.id]; if (!r || r.err) throw xfErr('Depends on a field with a problem'); return r.v; } return xfNum(f, own(vals, f.id) ? vals[f.id] : undefined); };
    try { out[id] = { v: xfRun(p.ast, get, xfToday), err: '' }; } catch (e) { if (!e.xf) throw e; out[id] = { v: null, err: e.message }; }
  }
  return out;
}

/* ---------- writing one: is it valid, what does it depend on, and what would it give? (the section editor's live check) ---------- */
function xfCheck(formula, fields, selfId, vals, selfName) {
  const id = selfId || '_new', others = (fields || []).filter(f => f.id !== id), sec = { fields: [...others, { id, name: selfName || 'this field', type: 'calculated', formula: String(formula || '') }] }, plan = xfPlan(sec);
  if (plan.errs[id]) return { ok: false, err: plan.errs[id] };
  const r = xfCompute(sec, vals || {})[id]; return r.err ? { ok: false, err: r.err, deps: plan.calc[id].deps } : { ok: true, value: r.v, deps: plan.calc[id].deps };
}
// rewrite the [references] of a formula without touching anything else (used to turn pack keys into field ids, and ids into names for the editor)
function xfRewrite(src, fn) {
  src = String(src == null ? '' : src); let toks; try { toks = xfTokens(src); } catch (e) { return src; }
  let out = '', last = 0; for (const t of toks) if (t.t === 'ref') { const r = fn(t.v); if (typeof r === 'string') { out += src.slice(last, t.p) + '[' + r + ']'; last = t.e; } }
  return out + src.slice(last);
}
