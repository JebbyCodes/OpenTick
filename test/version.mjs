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
console.log('version + build tests passed (v' + readVersion() + ')');
