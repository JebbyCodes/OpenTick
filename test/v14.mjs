// Background effects: settings are normalised, and the strongest possible effect never costs a theme its text contrast.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeApp } from './harness.mjs';

const app = makeApp(), N = o => ({ ...app.bgNorm(o) });
/* ---- settings from anywhere end up valid ---- */
assert.deepEqual(N(undefined), { ...app.BG_DEF }); assert.deepEqual(N(null), { ...app.BG_DEF });
let c = N({ on: 0, animate: false, style: 'nope', shape: 'cube', intensity: 9999, speed: -5 });
assert.equal(c.on, false); assert.equal(c.animate, false); assert.equal(c.style, 'accent'); assert.equal(c.shape, 'blobs'); assert.equal(c.intensity, 100); assert.equal(c.speed, 25);
c = N({ intensity: 'abc', speed: NaN }); assert.equal(c.intensity, app.BG_DEF.intensity); assert.equal(c.speed, 100);
c = N({ intensity: 3 }); assert.equal(c.intensity, 10, 'never fully invisible via the slider: switch it off instead');
for (const [k] of app.BG_STYLES) assert.equal(N({ style: k }).style, k); for (const [k] of app.BG_SHAPES) assert.equal(N({ shape: k }).shape, k);
assert.equal(app.S.settings.bg.animate, true, 'a fresh profile has the setting');
// the migration of an old backup without the setting
assert.equal(typeof app.migrate({ tasks: [], lists: [], settings: {} }).settings.bg, 'object');
assert.equal(app.migrate({ tasks: [], lists: [], settings: { bg: 'junk' } }).settings.bg.on, true, 'a junk value is replaced, not kept');
assert.equal(app.migrate({ tasks: [], lists: [], settings: { bg: { on: false } } }).settings.bg.on, false, 'a saved choice is kept');

/* ---- contrast ---- */
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const themes = {}; for (const m of css.matchAll(/:root\[data-theme=([a-z-]+)\]\{([^}]*)\}/g)) { const v = {}; for (const d of m[2].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)) v[d[1]] = d[2]; themes[m[1]] = v; }
assert.ok(Object.keys(themes).length >= 8, 'found the built-in themes: ' + Object.keys(themes));
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const hsl = (H, S, L) => { S /= 100; L /= 100; const k = n => (n + H / 30) % 12, a = S * Math.min(L, 1 - L), f = n => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map(x => Math.round(x * 255)); };
const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (bg, c, a) => bg.map((v, i) => v * (1 - a) + c[i] * a);
let worst = 99, minA = 1;
const check = (name, tv, expectVisible) => {
  const am = app.bgAmax(tv), bg = rgb(tv.bg), text = rgb(tv.text), muted = rgb(tv.muted || tv.text);
  const glows = [tv.acc, tv.p1, tv.p2, tv.muted].filter(Boolean).map(rgb).concat([hsl(205, 85, 58), hsl(168, 70, 48), hsl(265, 75, 66), hsl(268, 70, 62), hsl(335, 75, 62), hsl(32, 90, 58)]);
  assert.ok(am >= 0 && am <= 0.16, `${name}: strength ${am} is within bounds`);
  if (expectVisible) assert.ok(am >= 0.05, `${name}: the effect is still visible (${am})`);
  for (const g of glows) {
    const x = over(over(over(bg, g, am), g, am * 0.45), g, am * 0.45), t0 = ratio(text, bg), m0 = ratio(muted, bg), rt = ratio(text, x), rm = ratio(muted, x);
    assert.ok(rt >= Math.min(4.5, t0 * 0.9) - 0.02, `${name}: body text ${t0.toFixed(2)} -> ${rt.toFixed(2)}`);
    assert.ok(rm >= Math.min(3, m0 * 0.8) - 0.02, `${name}: secondary text ${m0.toFixed(2)} -> ${rm.toFixed(2)}`);
    worst = Math.min(worst, rt / Math.min(4.5, t0 * 0.9));
  }
  minA = Math.min(minA, am); return am;
};
for (const [name, t] of Object.entries(themes)) if (t.bg && t.text && t.acc) check(name, t, true);
// awkward themes: very low contrast, pure black / white, a bright accent on a mid-tone background, junk values
check('low-contrast', { bg: '#777777', text: '#888888', muted: '#808080', acc: '#ff0', p1: '#0ff', p2: '#f0f' }, false);
check('black', { bg: '#000', text: '#fff', muted: '#999', acc: '#fff', p1: '#fff', p2: '#fff' }, true);
check('white', { bg: '#fff', text: '#000', muted: '#666', acc: '#000', p1: '#000', p2: '#000' }, true);
assert.equal(app.bgAmax({ bg: 'nonsense', text: '#fff' }), 0.12, 'unparseable colours fall back to a cautious value');
assert.ok(app.bgAmax({ bg: 'rgb(30, 30, 40)', text: 'rgb(240, 240, 240)', acc: 'rgb(250, 190, 40)' }) > 0, 'rgb() colours (as some imported themes use) are understood');
console.log(`background tests passed (${Object.keys(themes).length} themes + 3 stress themes; weakest allowed peak ${(minA * 100).toFixed(0)}%)`);
