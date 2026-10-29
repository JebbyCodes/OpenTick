// E-ink mode and button tooltips: the pure logic, the build flag and the wiring (the real-browser checks are in test/browser).
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, mkdtempSync, readFileSync as rf } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, JS_ORDER } from '../build-app.mjs';
const rd = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function load({ mode = 'auto', meta = null, ua = '', search = '' } = {}) {
  const ctx = vm.createContext({ S: { settings: { eink: { mode, pager: true } } }, OTMETA: meta, navigator: { userAgent: ua }, location: { search, hash: '' }, document: undefined, ic: () => '', opts: () => '', esc: s => s, getComputedStyle: () => ({}) });
  vm.runInContext(rd('src/js/eink.js') + '\n;this.api = { einkOn, einkAuto, einkSettingsHtml };', ctx); return ctx.api;
}
assert.equal(load({}).einkOn(), false, 'a normal phone or computer: off by default');
assert.equal(load({ mode: 'on' }).einkOn(), true); assert.equal(load({ mode: 'off', meta: { eink: true } }).einkOn(), false, 'Off always wins, even in the e-ink build');
assert.equal(load({ meta: { eink: true } }).einkOn(), true, 'the e-ink build starts in e-ink mode');
assert.equal(load({ search: '?eink=1' }).einkOn(), true, '?eink turns it on'); assert.equal(load({ search: '?einkx' }).einkOn(), false);
for (const ua of ['Mozilla/5.0 (Linux; U; en-US) Kindle/3.0', 'Mozilla/5.0 (Linux; Android 11; Kobo) AppleWebKit', 'Mozilla/5.0 (X11; Linux armv7l) reMarkable', 'Mozilla/5.0 (Linux; Android 12; BOOX NoteAir)']) assert.equal(load({ ua }).einkOn(), true, ua);
for (const ua of ['Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Mozilla/5.0 (Linux; Android 9; KFMAWI) Silk/120 like Chrome', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120']) assert.equal(load({ ua }).einkOn(), false, ua);

// the build flag
const dir = mkdtempSync(join(tmpdir(), 'ot-eink-'));
build({ eink: true, out: dir }); const html = rf(join(dir, 'index.html'), 'utf8');
assert.match(html, /"eink":true/, 'the e-ink edition says so'); assert.match(rf(join(dir, 'sw.js'), 'utf8'), /opentick-v[\d.]+-eink/, 'its own cache');
assert.equal(JSON.parse(rf(join(dir, 'manifest.webmanifest'), 'utf8')).name, 'OpenTick (e-ink)');
build({ eink: false, out: dir }); assert.doesNotMatch(rf(join(dir, 'index.html'), 'utf8'), /"eink":true/, 'the normal build does not');

// wiring: files are bundled, the setting has a default, the CSS and the settings page exist
for (const f of ['tips', 'eink']) assert.ok(JS_ORDER.includes(f), f + '.js is bundled');
assert.match(rd('src/js/core.js'), /eink: \{ mode: 'auto'/); assert.match(rd('src/js/core.js'), /tips: \{ on: true \}/);
const css = rd('src/styles.css'); for (const k of ['html[data-eink]', '#einkpg', '.tip{']) assert.ok(css.includes(k), k + ' is styled');
assert.match(rd('src/js/main.js'), /einkSettingsHtml/, 'the Appearance tab shows the e-ink options'); assert.match(rd('src/js/prefs.js'), /Button tooltips/);
assert.match(rd('src/js/prefs.js'), /eink \? \{|ek \? \{/, 'e-ink turns on the accessibility flags it needs');
console.log('e-ink and tooltip tests passed');
