// The smartwatch edition: the build flag, the Tizen package and the Wear OS manifest. (The layout itself is tested in test/v070.mjs and test/browser/test_watch.py.)
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync as rf, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build, JS_ORDER } from '../build-app.mjs';
import { tizenConfig, tizenVersion, stageTizen, makeTizen, TIZEN_PACKAGE, TIZEN_ID } from '../scripts/watch/make-tizen-wgt.mjs';
const root = new URL('..', import.meta.url).pathname, rd = p => rf(join(root, p), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'ot-watch-'));

/* ---- the build ---- */
const dir = join(tmp, 'w');
build({ watch: true, out: dir });
const html = rf(join(dir, 'index.html'), 'utf8');
assert.match(html, /"watch":true/, 'the watch edition says so'); assert.doesNotMatch(html, /"eink":true/, 'and is not the e-ink edition');
assert.match(rf(join(dir, 'sw.js'), 'utf8'), /opentick-v[\d.]+-watch/, 'it has its own cache, so /watch/ never shares one with the normal app');
const man = JSON.parse(rf(join(dir, 'manifest.webmanifest'), 'utf8'));
assert.equal(man.name, 'OpenTick (watch)'); assert.equal(man.background_color, '#000000', 'black, so an OLED watch face is not lit up while the app loads');
build({ watch: false, out: dir }); assert.doesNotMatch(rf(join(dir, 'index.html'), 'utf8'), /"watch":true/, 'the normal build is not the watch edition');
assert.equal(spawnSync('node', ['build-app.mjs', '--watch', '--out', join(tmp, 'cli')], { cwd: root }).status, 0); assert.match(rf(join(tmp, 'cli/index.html'), 'utf8'), /"watch":true/, '--watch on the command line');
const env = spawnSync('node', ['build-app.mjs', '--out', join(tmp, 'env')], { cwd: root, env: { ...process.env, OPENTICK_WATCH: '1' } });
assert.equal(env.status, 0); assert.match(rf(join(tmp, 'env/index.html'), 'utf8'), /"watch":true/, 'OPENTICK_WATCH=1 (what the Wear OS build sets)');
for (const f of ['watch', 'csound', 'update', 'pins']) assert.ok(JS_ORDER.includes(f), f + '.js is bundled');

/* ---- the Tizen package ---- */
assert.equal(TIZEN_PACKAGE.length, 10, 'a Tizen package id is exactly 10 characters'); assert.match(TIZEN_PACKAGE, /^[A-Za-z0-9]{10}$/); assert.equal(TIZEN_ID, TIZEN_PACKAGE + '.OpenTick');
assert.equal(tizenVersion('0.7.0'), '0.7.0'); assert.equal(tizenVersion('0.8.0-beta.1'), '0.8.0', 'a pre-release suffix is left off'); assert.throws(() => tizenVersion('next'));
const cfg = tizenConfig('0.7.0');
for (const k of ['version="0.7.0"', 'tizen:profile name="wearable"', 'http://tizen.org/privilege/internet', '<content src="index.html"/>', '<icon src="icon.png"/>', `package="${TIZEN_PACKAGE}"`, `id="${TIZEN_ID}"`, '<name>OpenTick</name>']) assert.ok(cfg.includes(k), 'config.xml has ' + k);
assert.ok(!/privilege\/(?!internet)/.test(cfg), 'it asks for the network and nothing else');
assert.equal((cfg.match(/<widget\b/g) || []).length, 1); assert.equal((cfg.match(/<\/widget>/g) || []).length, 1);
const td = join(tmp, 'tizen'); mkdirSync(td);
const names = stageTizen(td, '0.7.0');
assert.deepEqual(names, ['config.xml', 'icon.png', 'index.html', 'logo.png', 'manifest.webmanifest'], 'the package holds the config, the icon and the app (no service worker)');
assert.match(rf(join(td, 'index.html'), 'utf8'), /"watch":true/, 'and it is the watch edition');
const z = spawnSync('zip', ['-v']);
if (z.error) console.log('zip not found: the .wgt zip check was skipped');
else {
  const r = makeTizen({ version: '0.7.0', out: join(tmp, 'staged') });
  assert.ok(r.wgt.endsWith('OpenTick_0.7.0_tizen-unsigned.wgt') && existsSync(r.wgt), 'the .wgt is made and named like the release expects');
  const l = spawnSync('unzip', ['-Z1', r.wgt], { encoding: 'utf8' });
  if (!l.error) { assert.deepEqual(l.stdout.split('\n').filter(Boolean).sort(), names, 'the .wgt holds exactly those files'); assert.ok(!/META-INF|author-signature|signature1/.test(l.stdout), 'it is unsigned, and says so in its name'); }
}

/* ---- the Wear OS manifest ---- */
const gen = join(tmp, 'gen'), mfDir = join(gen, 'app/src/main'); mkdirSync(join(mfDir, 'java/com/opentick/app'), { recursive: true }); writeFileSync(join(mfDir, 'java/com/opentick/app/MainActivity.kt'), '');
const MF = '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <uses-permission android:name="android.permission.INTERNET" />\n    <application android:label="OpenTick">\n        <activity android:name=".MainActivity" android:exported="true" />\n    </application>\n</manifest>\n';
const mf = join(mfDir, 'AndroidManifest.xml'), plain = join(tmp, 'plain'); mkdirSync(join(plain, 'app/src/main/java'), { recursive: true }); writeFileSync(join(plain, 'app/src/main/AndroidManifest.xml'), MF);
writeFileSync(mf, MF);
const run = (...a) => spawnSync('node', ['scripts/android/android-widgets.mjs', ...a], { cwd: root, encoding: 'utf8' });
assert.equal(run('--watch', gen).status, 0); assert.equal(run('--watch', gen).status, 0, 'running it again is fine');
const x = rf(mf, 'utf8'), count = s => x.split(s).length - 1;
assert.equal(count('android.hardware.type.watch'), 1, 'marked as a watch app, once'); assert.equal(count('com.google.android.wearable.standalone'), 1, 'and as working without a phone, once');
assert.ok(x.indexOf('android.hardware.type.watch') < x.indexOf('<application'), 'the feature sits before <application>'); assert.ok(x.indexOf('wearable.standalone') > x.indexOf('<application'), 'the standalone flag is inside it');
assert.equal(count('OpenTickBgReceiver'), 1, 'the background service (reminders) is still there'); assert.match(x, /POST_NOTIFICATIONS/, 'and may post notifications');
assert.equal(run(join(plain, '')).status, 0); assert.doesNotMatch(rf(join(plain, 'app/src/main/AndroidManifest.xml'), 'utf8'), /type\.watch|wearable/, 'the normal Android build is not marked as a watch app');
const act = rd('.github/actions/setup-android/action.yml'); assert.ok(/watch:\n\s+description:[^\n]*\n\s+default: 'false'/.test(act) && act.includes('android-widgets.mjs --watch'), 'the Android setup action can mark the project as Wear OS');

/* ---- every place the web edition is served ---- */
assert.ok(rd('.github/workflows/deploy-pages.yml').includes('--watch --out site/watch') && rd('.github/workflows/deploy-pages.yml').includes('test -f site/watch/index.html'));
assert.ok(rd('.github/workflows/build-web.yml').includes('_web-watch.zip') && rd('.github/workflows/build-web.yml').includes('--watch --out site-watch'));
assert.ok(rd('docker/nginx.conf').includes('location /watch/ { try_files $uri $uri/ /watch/index.html; }'));
assert.ok(rd('.gitignore').includes('site-watch/'));

rmSync(tmp, { recursive: true, force: true });
console.log('watch edition tests passed');
