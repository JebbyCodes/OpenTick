// Times: formatted the way the Clock setting says, never raw or NaN; blocks never overlap once their drawn height is counted.
import assert from 'node:assert/strict';
import { makeApp } from './harness.mjs';

const app = makeApp(), NB = '\u00a0';
const set24 = v => { app.S.settings.clock.h24 = v; };

/* ---- 12-hour (the default) ---- */
set24(false);
assert.equal(app.fmtTime('09:05'), `9:05${NB}AM`);
assert.equal(app.fmtTime('00:00'), `12:00${NB}AM`, 'midnight');
assert.equal(app.fmtTime('12:00'), `12:00${NB}PM`, 'noon');
assert.equal(app.fmtTime('23:59'), `11:59${NB}PM`);
assert.equal(app.fmtTime('7:30'), `7:30${NB}AM`, 'a single-digit hour is accepted');
assert.equal(app.fmtRange('09:00', '10:30'), `9:00–10:30${NB}AM`, 'the same side of noon shares one AM / PM');
assert.equal(app.fmtRange('11:30', '13:00'), `11:30${NB}AM–1:00${NB}PM`, 'across noon both are spelled out');
assert.equal(app.fmtRange(23 * 60, 1440), `11:00${NB}PM–12:00${NB}AM`, 'a block that ends at midnight');
assert.equal(app.fmtRange(0, 30), `12:00–12:30${NB}AM`);
assert.equal(app.fmtRange(12 * 60, 12 * 60 + 30), `12:00–12:30${NB}PM`);
assert.equal(app.fmtHour(0), `12${NB}AM`); assert.equal(app.fmtHour(12), `12${NB}PM`); assert.equal(app.fmtHour(15), `3${NB}PM`); assert.equal(app.fmtHour(24), `12${NB}AM`);

/* ---- 24-hour ---- */
set24(true);
assert.equal(app.fmtTime('09:05'), '09:05'); assert.equal(app.fmtTime('00:00'), '00:00'); assert.equal(app.fmtTime('23:59'), '23:59');
assert.equal(app.fmtRange('09:00', '10:30'), '09:00–10:30'); assert.equal(app.fmtRange(23 * 60, 1440), '23:00–00:00');
assert.equal(app.fmtHour(7), '07:00'); assert.equal(app.fmtHour(24), '00:00');

/* ---- bad input is shown as nothing, not as "NaN:NaN" ---- */
for (const bad of [undefined, null, '', 'abc', '25:00', '12:60', '9', '12:5', NaN]) { assert.equal(app.fmtTime(bad), '', String(bad)); assert.equal(app.validHM(bad), false); }
assert.equal(app.fmtRange('x', '10:00'), ''); assert.equal(app.fmtRange('09:00', undefined), '09:00', 'no end: just the start');
assert.equal(app.fmtRange('10:00', '09:00'), '10:00', 'a backwards range shows the start only');
assert.equal(app.fmtMin(NaN), ''); assert.equal(app.fmtMin(Infinity), '');
assert.equal(app.fmtMin(-30), '23:30', 'wraps rather than printing a negative time');

/* ---- task labels follow the setting too ---- */
const t = { due: '2026-10-15', time: '17:05' };
set24(true); assert.match(app.dueLabel(t), /17:05$/);
set24(false); assert.match(app.dueLabel(t), new RegExp(`5:05${NB}PM$`));
assert.equal(app.dueLabel({ due: '2026-10-15', time: 'garbage' }).includes('garbage'), false);
assert.equal(app.dueLabel({ due: null, time: '10:00' }), '');

/* ---- layout: a block drawn taller than its time does not sit on top of the next one ---- */
const slot = (a, b) => ({ k: 'slot', a, b });
const col = items => items.map(i => `${i.col}/${i.n}`).join(' ');
// three back-to-back 15-minute items, each drawn at least 34px tall at 44px/hour (= 46 minutes): without the minimum they would all share column 0
const ppm = 44 / 60, minMin = 34 / ppm;
let a = [slot(600, 615), slot(615, 630), slot(630, 645)];
app.ttLayout(a); assert.equal(col(a), '0/1 0/1 0/1', 'by time alone they do not overlap');
a = [slot(600, 615), slot(615, 630), slot(630, 645)];
app.ttLayout(a, minMin);
const cols = new Set(a.map(i => i.col)); assert.ok(cols.size >= 2, 'drawn heights are counted: ' + col(a));
for (const x of a) for (const y of a) if (x !== y) assert.ok(x.col !== y.col || Math.max(x.eb, x.b) <= y.a || Math.max(y.eb, y.b) <= x.a, 'no two blocks in a column overlap in drawing');
// a long block is unaffected, and `clash` still reflects real times only
a = [slot(540, 630), slot(660, 690)]; app.ttLayout(a, minMin); assert.equal(col(a), '0/1 0/1'); assert.equal(a[0].clash, false);
a = [slot(540, 600), slot(570, 630)]; app.ttLayout(a, minMin); assert.equal(a[0].clash && a[1].clash, true);
a = [slot(600, 615), slot(615, 630)]; app.ttLayout(a, minMin); assert.equal(a[0].clash, false, 'close together is not a clash');
app.ttLayout([], minMin);

/* ---- fitting the hours to the screen ---- */
assert.equal(app.ttFitHH(900, 12 * 60), 75); assert.equal(app.ttFitHH(300, 16 * 60), 44, 'never tighter than the readable minimum');
assert.equal(app.ttFitHH(5000, 8 * 60), 92, 'never absurdly tall'); assert.equal(app.ttFitHH(0, 60), 44);
assert.deepEqual([...app.TT_AUTO], [6, 22]);
console.log('time display tests passed');
