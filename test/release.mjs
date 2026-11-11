// The release pipeline: the helper scripts the workflows call, and the rules the workflow files must keep (they cannot be run here, so they are checked).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, readdirSync as ls } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { missing, REQUIRED, OPTIONAL } from '../scripts/release/collect-assets.mjs';
import { RULES, buildNotes, downloadsTable } from '../scripts/release/release-notes.mjs';
import { STAGES, summarise } from '../scripts/release/run-summary.mjs';
import { stagedName, flavourOf } from '../scripts/android/stage-apks.mjs';
const root = new URL('..', import.meta.url).pathname, rd = p => readFileSync(join(root, p), 'utf8');
const V = JSON.parse(rd('package.json')).version;

/* ---- the file names every stage agrees on ---- */
const FULL = [
  `OpenTick_${V}_x64-setup.exe`, `OpenTick_${V}_x64_en-US.msi`, `OpenTick_${V}_x64-portable.zip`, `OpenTick_${V}_x64.msix`, `OpenTick_${V}.msixbundle`,
  `OpenTick_${V}_x86-setup.exe`, `OpenTick_${V}_x86-portable.zip`, `OpenTick_${V}_x86.msix`, `OpenTick_${V}_arm64-setup.exe`, `OpenTick_${V}_arm64-portable.zip`, `OpenTick_${V}_arm64.msix`,
  `OpenTick_${V}_universal.dmg`, `OpenTick_${V}_amd64.AppImage`, `OpenTick_${V}_amd64.deb`, `OpenTick-${V}-1.x86_64.rpm`, `opentick_${V}_amd64.snap`,
  `OpenTick_${V}_aarch64.AppImage`, `OpenTick_${V}_arm64.deb`, `OpenTick-${V}-1.aarch64.rpm`, `opentick_${V}_arm64.snap`,
  `OpenTick_${V}_android-universal.apk`, `OpenTick_${V}_android-arm64-v8a.apk`, `OpenTick_${V}_android-armeabi-v7a.apk`, `OpenTick_${V}_android-x86_64.apk`, `OpenTick_${V}_android-x86.apk`,
  `OpenTick_${V}_android-eink-universal.apk`, `OpenTick_${V}.aab`, `OpenTick_${V}_ios.ipa`, `OpenTick_${V}_web.zip`, `OpenTick_${V}_web-eink.zip`, `OpenTick_${V}_web-watch.zip`,
  `OpenTick_${V}_android-watch-universal.apk`, `OpenTick_${V}_tizen-unsigned.wgt`,
  `OpenTick_${V}_docker-amd64.tar.gz`, `OpenTick_${V}_docker-arm64.tar.gz`, `OpenTick_${V}_docker-armv7.tar.gz`, `OpenTick_${V}_docker-i386.tar.gz`, `OpenTick_${V}_docker-compose.yml`,
];
let m = missing(FULL, V); assert.deepEqual(m, { required: [], optional: [] }, 'a complete release has nothing missing: ' + JSON.stringify(m));
m = missing(FULL.filter(n => !/x86-setup|arm64\.snap|ios|docker-armv7/.test(n)), V);
assert.deepEqual(m.required, [], 'optional targets never block a release'); assert.equal(m.optional.length, 4);
m = missing(FULL.filter(n => !/docker-arm64|docker-compose/.test(n)), V);
assert.deepEqual(m.required, ['Docker image, 64-bit ARM', 'Docker compose file'], 'a release without its Docker files is incomplete');
m = missing(FULL.filter(n => !/android-watch|tizen/.test(n)), V);
assert.deepEqual(m.required, [], 'the Wear OS and Tizen packages are optional: they never block a release'); assert.equal(m.optional.length, 2);
m = missing(FULL.filter(n => !/web-watch/.test(n)), V);
assert.deepEqual(m.required, ['Smartwatch website zip'], 'the watch website zip is built with the other websites, so it is required');
m = missing(FULL.filter(n => !/\.msixbundle|android-universal/.test(n)), V);
assert.deepEqual(m.required, ['Windows MSIX bundle', 'Android universal APK'], 'a missing required file is named');
assert.ok(missing([`OpenTick_0.0.1_x64-setup.exe`], V).required.includes('Windows 64-bit installer'), 'a file from another version does not count');
for (const n of FULL) assert.ok(RULES.some(([, , re]) => re.test(n)), `release notes list ${n}`);
for (const [label] of [...REQUIRED, ...OPTIONAL]) assert.ok(label.length > 3);

/* ---- release notes ---- */
const notes = buildNotes({ tag: 'v' + V, files: FULL.map(name => ({ name, size: 5e6 })), changelog: rd('CHANGELOG.md') });
assert.match(notes, new RegExp(`^## What's new in ${V.replace(/\./g, '\\.')}\\n`), 'the description starts with what is new');
assert.ok(notes.includes('Docker') && notes.includes('SHA256SUMS.txt') && notes.includes('#### Android') && notes.includes('E-ink'), 'downloads, docker and verification are described');
assert.ok(notes.includes('#### Docker') && notes.includes(`ghcr.io/jebbycodes/opentick:${V}`) && notes.includes('docker load') && notes.includes('_docker-amd64.tar.gz'), 'the Docker image has its own section: registry command, offline files, compose');
assert.ok(!/TODO/.test(notes.split('## Downloads')[0]), 'no TODO in the notes');
assert.ok(downloadsTable([{ name: 'surprise.bin', size: 10 }], 'v1.0.0').includes('Other files'), 'unknown files are still listed');
assert.equal(spawnSync('node', ['scripts/release/release-notes.mjs', '--tag', 'v' + V, '--check'], { cwd: root }).status, 0, 'this version has release notes');
assert.notEqual(spawnSync('node', ['scripts/release/release-notes.mjs', '--tag', 'v9.9.9', '--check'], { cwd: root }).status, 0, 'a tag with no CHANGELOG section is refused');

/* ---- Android file naming ---- */
assert.equal(stagedName('x/apk/arm64/release/app-arm64-release.apk', V), `OpenTick_${V}_android-arm64-v8a.apk`);
assert.equal(stagedName('x/apk/arm/release/app-arm-release.apk', V), `OpenTick_${V}_android-armeabi-v7a.apk`);
assert.equal(stagedName('x/apk/x86_64/release/app-x86_64-release.apk', V), `OpenTick_${V}_android-x86_64.apk`);
assert.equal(stagedName('x/bundle/universalRelease/app-universal-release.aab', V), `OpenTick_${V}.aab`);
assert.equal(stagedName('x/apk/universal/release/app-universal-release.apk', V, 'eink'), `OpenTick_${V}_android-eink-universal.apk`);
assert.equal(stagedName('x/apk/universal/release/app-universal-release.apk', V, 'watch'), `OpenTick_${V}_android-watch-universal.apk`, 'the Wear OS APK has its own name');
assert.equal(flavourOf('x/apk/mystery/app.apk'), null);

/* ---- the workflow files ---- */
const WF = readdirSync(join(root, '.github/workflows'))
  .filter(f => f.endsWith('.yml'))
  .sort();

const wf = f => rd('.github/workflows/' + f);

const EXPECTED_WORKFLOWS = [
  'build-android.yml',
  'build-desktop.yml',
  'build-docker.yml',
  'build-ios.yml',
  'build-snap.yml',
  'build-watch.yml',
  'build-web.yml',
  'ci.yml',
  'deploy-pages.yml',
  'prepare-release.yml',
  'publish-chocolatey.yml',
  'publish-docker.yml',
  'publish-microsoft-store.yml',
  'publish-scoop.yml',
  'publish-snap-store.yml',
  'publish-winget.yml',
  'release.yml',
];

assert.deepEqual(
  WF,
  EXPECTED_WORKFLOWS,
  'workflow files are named build-* / publish-* / deploy-* / prepare-release / ci / release',
);

for (const f of WF) {
  const t = wf(f);

  assert.match(t, /^name: .+/m, f + ' has a name');

  // the `on:` block is everything between `on:` and the next top-level key
  const on = (/^on:\n((?:[ \t].*\n|\n)*)/m.exec(t) || [])[1] || '';

  if (f !== 'release.yml') {
    assert.ok(
      !/^\s+tags:/m.test(on),
      f + ' is started by Release, not by a tag of its own',
    );
  }
}

const rel = wf('release.yml');

assert.match(
  rel,
  /on:\n\s+push:\n\s+tags: \['v\[0-9\]\+/,
  'git push origin <tag> starts the Release',
);

for (const f of WF.filter(f => /^(build|publish)-/.test(f))) {
  assert.match(wf(f), /workflow_call:/, f + ' can be called');
  assert.ok(
    rel.includes('./.github/workflows/' + f),
    'Release calls ' + f,
  );
}

assert.ok(
  rel.includes('./.github/workflows/ci.yml'),
  'Release runs the tests first',
);

assert.ok(
  !/release:\s*\n\s+types:/.test(WF.map(wf).join('\n')),
  'nothing waits for a release: published event',
);

assert.ok(
  !WF.includes('build.yml') && !WF.includes('deploy-web.yml') && !WF.includes('update-scoop-bucket.yml') && !WF.includes('test-snap.yml'),
  'the old duplicate workflows (a second tag release, a second Pages deploy, a second Scoop updater, a manual Snap test) stay deleted',
);

assert.equal(
  WF.filter(f => /actions\/deploy-pages@/.test(wf(f))).length,
  1,
  'exactly one workflow deploys GitHub Pages',
);

/* ---- Docker is part of the release ---- */
assert.ok(
  rel.includes('./.github/workflows/build-docker.yml') &&
  rel.includes('./.github/workflows/publish-docker.yml') &&
  /needs\.docker\.result == 'success'/.test(rel),
  'the release builds the Docker files, needs them, and then publishes the image',
);

assert.ok(
  /needs: \[prepare, release\]\s*\n\s+if: \$\{\{ !cancelled\(\) && needs\.release\.result == 'success' \}\}\s*\n\s+permissions:\s*\n\s+contents: read\s*\n\s+packages: write\s*\n\s+uses: \.\/\.github\/workflows\/publish-docker\.yml/.test(rel),
  'the image is pushed to the registry only after the GitHub Release exists',
);

const dockerBuild = wf('build-docker.yml');
assert.ok(
  !/push:\s*true/.test(dockerBuild) && dockerBuild.includes('type=docker,dest=') && dockerBuild.includes('/healthz'),
  'Build / Docker makes files and tests the image; it does not push',
);

const dockerPublish = wf('publish-docker.yml');
assert.ok(
  dockerPublish.includes('packages: write') && /push:\s*true/.test(dockerPublish) && dockerPublish.includes(':latest') && dockerPublish.includes('STABLE'),
  'Publish / Docker pushes, and only stable releases move `latest`',
);

/* ---- the Snap Store takes every .snap, and pre-release tags ---- */
const snapStore = wf('publish-snap-store.yml');
assert.ok(
  !/Expected exactly one/.test(snapStore) && /for snap_file in snaps\/\*\.snap/.test(snapStore) && snapStore.includes('(-[0-9A-Za-z.-]+)?$'),
  'every .snap in the release is uploaded (amd64 and arm64), and a pre-release tag is accepted',
);

/* ---- a missing store secret skips a publisher, it never fails it ---- */
assert.ok(
  !/throw "Missing GitHub secrets/.test(wf('publish-microsoft-store.yml')) && wf('publish-microsoft-store.yml').includes('Microsoft Store skipped'),
  'the Microsoft Store publisher skips with a warning when its secrets are missing, like the others',
);

assert.ok(
  /needs: \[prepare, release\]/.test(rel) &&
  rel.includes('publish-microsoft-store') &&
  rel.includes('publish-snap'),
  'stores run after the GitHub Release exists',
);

assert.ok(
  rel.includes('collect-assets.mjs') &&
  rel.includes('release-notes.mjs') &&
  rel.includes('body_path: release-notes.md') &&
  rel.includes('generate_release_notes: true'),
  'the release says what is new',
);

assert.ok(rel.includes('attest-build-provenance'));

/* ---- the smartwatch packages are part of the release, but never hold it back ---- */
assert.ok(/\n  watch:\n[^\n]*\n    needs: prepare\n    uses: \.\/\.github\/workflows\/build-watch\.yml/.test(rel), 'Release builds the smartwatch packages');
assert.ok(/needs: \[prepare, tests, desktop, android, web, docker, snap, msix-bundle, ios, watch\]/.test(rel) && !/needs\.watch\.result == 'success'/.test(rel), 'the release waits for the watch builds but does not need them to succeed (like iOS)');
assert.ok(notes.includes('#### Smartwatch') && notes.includes('_tizen-unsigned.wgt') && notes.includes('not signed') && notes.includes('_android-watch-universal.apk'), 'the release description explains the watch downloads');
assert.ok(notes.includes('/watch/') && notes.includes('_web-watch.zip'), 'the watch website is listed');
const wbuild = wf('build-watch.yml');
assert.ok(wbuild.includes("watch: 'true'") && wbuild.includes('OPENTICK_WATCH') && wbuild.includes('--edition watch') && wbuild.includes('make-tizen-wgt.mjs') && wbuild.includes('name: pkg-android-watch') && wbuild.includes('name: pkg-tizen'), 'Build / Smartwatch makes the Wear OS APK and the Tizen package');
for (const f of ['deploy-pages.yml', 'build-web.yml']) assert.ok(wf(f).includes('--watch --out'), f + ' builds the watch edition');
assert.ok(wf('build-docker.yml').includes('/watch/') && rd('Dockerfile').includes('--watch --out site/watch') && rd('docker/nginx.conf').includes('location /watch/'), 'the Docker image serves /watch/ and the release checks it');

assert.ok(
  rel.includes('version:check') &&
  rel.includes('Tag does not match'),
  'a tag that disagrees with package.json stops the release',
);

assert.ok(
  rel.includes("'candidate' || 'beta'") &&
  rel.includes("stable == 'true'"),
  'pre-releases skip the stores',
);

const snap = wf('build-snap.yml');

assert.ok(
  !/chmod a\+r "\$SNAP/.test(snap) &&
  /sudo chown "\$\(id -u\)/.test(snap) &&
  snap.indexOf('chown') < snap.indexOf('chmod a+r'),
  'the Snap is chowned to the runner user before chmod',
);

assert.ok(
  !snap.includes('npm test') &&
  !snap.includes('rustup') &&
  snap.includes('download-artifact'),
  'the Snap wraps the desktop .deb instead of rebuilding Rust',
);

assert.ok(
  rd('snap/ci/snapcraft.yaml').includes('@VERSION@') &&
  rd('snap/ci/snapcraft.yaml').includes('assemble.sh') &&
  rd('snap/snapcraft.yaml').includes('snap/local/assemble.sh'),
  'both snapcraft files share assemble.sh',
);

assert.ok(
  rd('snap/local/assemble.sh').startsWith('#!/usr/bin/env bash'),
);

/* ---- CI installs everything the browser tests use ---- */
// The browser job once crashed because test_background.py imports Pillow and test_help_about.py runs pdfinfo, and neither is on a GitHub runner.
// Read the tests themselves, so a new dependency that CI does not install is caught here and not as a red run.
const ci = wf('ci.yml');
const browserTests = readdirSync(join(root, 'test/browser')).filter(f => f.endsWith('.py')).map(f => rd('test/browser/' + f)).join('\n');
const needs = [
  [/^\s*(from|import) PIL\b/m, /pip install[^\n]*\bPillow\b/, 'Pillow (the tests import PIL)'],
  [/['"]pdfinfo['"]|['"]pdftotext['"]/, /apt-get install[^\n]*poppler-utils/, 'poppler-utils (the tests run pdfinfo / pdftotext)'],
  [/from playwright\b/, /pip install[^\n]*\bplaywright\b/, 'Playwright (the tests import it)'],
];
for (const [used, installed, what] of needs) {
  if (used.test(browserTests)) assert.ok(installed.test(ci), 'ci.yml installs ' + what);
}

/* ---- the linter itself ---- */
const lint = spawnSync('python3', ['scripts/ci/lint-workflows.py'], { cwd: root, encoding: 'utf8' });
if (lint.error) console.log('python3 not found: workflow lint skipped'); else assert.equal(lint.status, 0, 'workflow lint:\n' + lint.stdout + lint.stderr);

/* ---- collect-assets end to end ---- */
const tmp = mkdtempSync(join(tmpdir(), 'ot-rel-')); mkdirSync(join(tmp, 'a/x'), { recursive: true }); mkdirSync(join(tmp, 'b'), { recursive: true });
for (const [i, n] of FULL.entries()) writeFileSync(join(tmp, i % 2 ? 'a/x' : 'b', n), 'file ' + n);
writeFileSync(join(tmp, 'a/x', 'notes.txt'), 'ignored'); writeFileSync(join(tmp, 'b', 'OpenTick.AppImage.sig'), 'ignored');
let r = spawnSync('node', ['scripts/release/collect-assets.mjs', '--from', join(tmp, '.'), '--to', join(tmp, 'out'), '--version', V], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 0, r.stdout + r.stderr);
const out = ls(join(tmp, 'out')); assert.ok(out.includes('SHA256SUMS.txt') && out.length === FULL.length + 1 + 0, 'every package plus the checksums: ' + out.length);
assert.ok(readFileSync(join(tmp, 'out/SHA256SUMS.txt'), 'utf8').split('\n').filter(Boolean).every(l => /^[0-9a-f]{64}  \S+$/.test(l)), 'checksums are in sha256sum format');
writeFileSync(join(tmp, 'b', FULL[0]), 'dup'); mkdirSync(join(tmp, 'c')); writeFileSync(join(tmp, 'c', FULL[0]), 'dup2');
r = spawnSync('node', ['scripts/release/collect-assets.mjs', '--from', join(tmp, '.'), '--to', join(tmp, 'out2'), '--version', V], { cwd: root, encoding: 'utf8' });
assert.notEqual(r.status, 0, 'two jobs making the same file name is an error');
/* ---- Prepare release: the version bump from the Actions tab ---- */
const prep = wf('prepare-release.yml');
assert.match(prep, /on:\n\s+workflow_dispatch:/, 'Prepare release is started by hand');
assert.ok(!/^\s+(push|pull_request|schedule):/m.test((/^on:\n((?:[ \t].*\n|\n)*)/m.exec(prep) || [])[1] || ''), 'Prepare release has no other trigger');
assert.match(prep, /npm run --silent bump -- "\$VERSION"/, 'it runs the same bump as `npm run bump`');
assert.match(prep, /npm run --silent version:check/, 'and proves every file agrees afterwards');
assert.ok(!/\$\{\{\s*inputs\.version\s*\}\}/.test(prep.split('\n').filter(l => !/^\s*(VERSION_INPUT|description):/.test(l)).join('\n')), 'the typed version is only read through an environment variable, never pasted into a script');
assert.match(prep, /release\/v/, 'it works on a release/vX.Y.Z branch');
assert.match(prep, /pull-requests: write/); assert.match(prep, /ls-remote --exit-code --tags/, 'it refuses a version whose tag already exists');
assert.ok(!/gh release|git tag |git push [^\n]*--tags|git push origin "?v/.test(prep.replace(/^\s*(#|echo ).*$/gm, '')), 'it prepares a release; it never tags or publishes one');

/* ---- the release run's status table ---- */
const relJobs = [...rel.slice(rel.indexOf('\njobs:')).matchAll(/^  ([a-z][a-z-]*):\s*$/gm)].map(x => x[1]);
assert.deepEqual([...relJobs].sort(), [...STAGES.map(s => s[0]), 'summary'].sort(), 'every job in release.yml has a line in the status table, and the table has no stale lines');
const sumNeeds = (/\n  summary:[\s\S]*?needs: \[([^\]]+)\]/.exec(rel) || [])[1] || '';
assert.deepEqual(sumNeeds.split(',').map(s => s.trim()).sort(), STAGES.map(s => s[0]).sort(), 'the summary job waits for every stage');
assert.match(rel, /\n  summary:[\s\S]*?if: \$\{\{ always\(\) \}\}/, 'and runs even when one failed');
const ok = Object.fromEntries(STAGES.map(s => [s[0], { result: 'success', outputs: {} }]));
ok.prepare.outputs = { tag: 'v9.9.9', publish: 'true', stable: 'true' };
let sm = summarise(ok);
assert.ok(sm.released && sm.failedRequired.length === 0 && /was released/.test(sm.markdown) && /v9\.9\.9/.test(sm.markdown), 'a clean release says so');
assert.equal(sm.markdown.split('\n').filter(l => /^\| \*\*|^\| `/.test(l)).length, STAGES.length, 'one table row per stage');
sm = summarise({ ...ok, desktop: { result: 'failure' }, release: { result: 'skipped' } });
assert.deepEqual(sm.failedRequired, ['desktop']); assert.ok(!sm.released && /No release was made/.test(sm.markdown) && /`desktop`/.test(sm.markdown), 'a failed required stage is named');
sm = summarise({ ...ok, ios: { result: 'failure' }, watch: { result: 'skipped' }, 'publish-scoop': { result: 'failure' } });
assert.ok(sm.released && sm.failedRequired.length === 0 && JSON.stringify(sm.failedOptional) === JSON.stringify(['ios', 'publish-scoop']) && /Optional stages that did not work/.test(sm.markdown), 'an optional stage failing does not stop the release but is reported');
sm = summarise({ ...ok, prepare: { result: 'success', outputs: { tag: 'v9.9.9', publish: 'false', stable: 'true' } }, release: { result: 'skipped' } });
assert.ok(/Dry run/.test(sm.markdown) && !sm.released, 'a dry run is called one');
sm = summarise({ ...ok, prepare: { result: 'success', outputs: { tag: 'v9.9.9-beta.1', publish: 'true', stable: 'false' } }, 'publish-scoop': { result: 'skipped' } });
assert.ok(/pre-release/.test(sm.markdown) && /stable releases only/.test(sm.markdown), 'a pre-release explains why the stores were skipped');
assert.ok(/Tag, code and CHANGELOG/.test(summarise({ prepare: { result: 'failure' } }).markdown) || /could not be checked/.test(summarise({ prepare: { result: 'failure' } }).markdown), 'a failed tag check is reported first');
assert.doesNotThrow(() => summarise(undefined), 'no data at all still produces a table');
r = spawnSync('node', ['scripts/release/run-summary.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, NEEDS: JSON.stringify(ok), GITHUB_REPOSITORY: 'a/b', GITHUB_RUN_ID: '7' } });
assert.equal(r.status, 0, r.stderr); assert.ok(r.stdout.includes('actions/runs/7') && r.stdout.includes('| Stage | Result |'), 'the command line prints the table');
r = spawnSync('node', ['scripts/release/run-summary.mjs'], { cwd: root, encoding: 'utf8', env: { ...process.env, NEEDS: 'not json' } });
assert.equal(r.status, 0, 'a broken NEEDS never fails the run');

/* ---- GitHub's release-notes categories, and the checks CI makes ---- */
const rn = rd('.github/release.yml');
assert.match(rn, /^changelog:/m); assert.match(rn, /labels: \["\*"\]/, 'unlabelled pull requests still land somewhere');
for (const label of ['contacts', 'sections', 'packs', 'themes', 'sync', 'encryption', 'security', 'bug', 'documentation', 'dependencies']) assert.ok(new RegExp('\\b' + label + '\\b').test(rn), 'release notes have a place for the ' + label + ' label');
assert.ok(rd('docs/RELEASING.md').includes('.github/release.yml'), 'RELEASING.md explains the release-notes categories');
assert.match(ci, /npm run packs:check/, 'CI checks the pack library'); assert.match(rd('.github/workflows/deploy-pages.yml'), /site\/marketplace/, 'the website serves the pack library');

console.log('release pipeline tests passed');
