// One version everywhere, and the build wires the logo + version in.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { versions } from '../scripts/bump-version.mjs';
import { build, readVersion } from '../build-app.mjs';
const v = versions(), set = new Set(Object.values(v));
assert.equal(set.size, 1, 'all manifests share one version: ' + JSON.stringify(v));
build();
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
assert.ok(html.includes(`"version":"${readVersion()}"`), 'version injected into the page');
assert.ok(!html.includes('%%'), 'no unreplaced placeholders');
assert.ok(readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8').includes(`opentick-v${readVersion()}`), 'cache name carries the version');
const man = JSON.parse(readFileSync(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'));
assert.equal(man.version, readVersion()); assert.ok(man.icons.length >= 1);
assert.ok(existsSync(new URL('../dist/' + man.icons[0].src, import.meta.url)), 'manifest icon is shipped');
import { androidVersionCode, parseProps, problems } from '../scripts/check-android-version.mjs';
assert.equal(androidVersionCode('0.2.4'), 2004); assert.equal(androidVersionCode('1.12.3'), 1012003); assert.equal(androidVersionCode('2.0.0-beta.1'), 2000000); assert.equal(androidVersionCode('x'), null);
assert.ok(androidVersionCode('0.2.5') > androidVersionCode('0.2.4') && androidVersionCode('0.3.0') > androidVersionCode('0.2.99') && androidVersionCode('1.0.0') > androidVersionCode('0.999.999'), 'the code always rises with the version');
const pv = readVersion(), conf = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
assert.deepEqual(problems({ pkgVersion: pv, tauriConf: conf, props: null }), [], 'the repository has no Android version override');
const props = v => parseProps(`# generated\ntauri.android.versionName=${v}\ntauri.android.versionCode=${androidVersionCode(v)}\n`);
assert.deepEqual(problems({ pkgVersion: pv, tauriConf: conf, props: props(pv) }), [], 'a correctly generated project passes');
assert.equal(problems({ pkgVersion: pv, tauriConf: conf, props: props('0.0.1') }).length, 2, 'a stale generated project is caught (name and code)');
assert.ok(problems({ pkgVersion: pv, tauriConf: { ...conf, bundle: { android: { versionCode: 7 } } }, props: null }).some(x => /overrides/.test(x)), 'a hand-written versionCode is caught');
assert.ok(problems({ pkgVersion: pv, tauriConf: { ...conf, version: '9.9.9' }, props: null }).some(x => /differs/.test(x)), 'tauri.conf.json drift is caught');
assert.match(readFileSync(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8'), /check-android-version\.mjs --generated/, 'CI runs the check after the APK build');
// the app reads its version from the build, never from a typed-in string
for (const f of ['src/js/help.js', 'src/js/about.js']) assert.ok(!/['"`]v?\d+\.\d+\.\d+['"`]/.test(readFileSync(new URL('../' + f, import.meta.url), 'utf8')), f + ' has no hard-coded version');
console.log('version + build tests passed (v' + readVersion() + ')');
