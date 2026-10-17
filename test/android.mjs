// Android resources: the notification icon must exist, be a flat white vector, and be the one the app asks for.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname, rd = p => readFileSync(root + p, 'utf8');
const xmlPath = 'src-tauri/android-widgets/res/drawable/ic_stat_opentick.xml';
assert.ok(existsSync(root + xmlPath), 'the drawable exists where android-widgets.mjs copies resources from');
const xml = rd(xmlPath).replace(/<!--[\s\S]*?-->/g, ''); // the comment explains the rules, so it is not checked against them
assert.match(xml, /<vector\b/, 'a vector drawable, not a bitmap or an SVG file'); assert.doesNotMatch(xml, /<svg\b/);
assert.match(xml, /android:width="24dp"/); assert.match(xml, /android:viewportWidth="24"/);
const colors = [...xml.matchAll(/(?:fillColor|strokeColor)="([^"]+)"/g)].map(m => m[1].toUpperCase());
assert.ok(colors.length >= 2 && colors.every(c => c === '#FFFFFFFF'), 'one flat white colour only: Android uses the alpha channel and tints it');
assert.doesNotMatch(xml, /gradient|<aapt:attr|android:fillAlpha="0\.[0-4]/i, 'no gradients or faint fills that Android would drop');
for (const m of xml.matchAll(/strokeWidth="([\d.]+)"/g)) assert.ok(+m[1] >= 2, 'nothing thinner than 2dp survives at status-bar size');
assert.doesNotMatch(xml, /<text|android:text/i);
const main = rd('src/js/main.js'); assert.match(main, /icon = 'ic_stat_opentick'/, 'the app asks for this drawable by name');
assert.match(main, /Android\/i\.test\(navigator\.userAgent/, 'only on Android: other platforms do not get an Android resource name');
assert.match(rd('scripts/android-widgets.mjs'), /readdirSync\(join\(src, 'res'\)\)/, 'every res/<dir>/<file> is copied into the generated project');
assert.match(rd('.github/workflows/build.yml'), /node scripts\/android-widgets\.mjs/, 'CI runs the copy step');
// the capabilities the attachment code needs
const cap = JSON.parse(rd('src-tauri/capabilities/default.json')).permissions;
for (const p of ['fs:allow-read-file', 'fs:allow-write-file', 'fs:allow-read-text-file', 'notification:default', 'dialog:default']) assert.ok(cap.includes(p), 'capability ' + p);
console.log('android resource tests passed');
