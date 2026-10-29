// The release pipeline: the helper scripts the workflows call, and the rules the workflow files must keep (they cannot be run here, so they are checked).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, readdirSync as ls } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { missing, REQUIRED, OPTIONAL } from '../scripts/release/collect-assets.mjs';
import { RULES, buildNotes, downloadsTable } from '../scripts/release/release-notes.mjs';
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
  `OpenTick_${V}_android-eink-universal.apk`, `OpenTick_${V}.aab`, `OpenTick_${V}_ios.ipa`, `OpenTick_${V}_web.zip`, `OpenTick_${V}_web-eink.zip`,
];
let m = missing(FULL, V); assert.deepEqual(m, { required: [], optional: [] }, 'a complete release has nothing missing: ' + JSON.stringify(m));
m = missing(FULL.filter(n => !/x86-setup|arm64\.snap|ios/.test(n)), V);
assert.deepEqual(m.required, [], 'optional targets never block a release'); assert.equal(m.optional.length, 3);
m = missing(FULL.filter(n => !/\.msixbundle|android-universal/.test(n)), V);
assert.deepEqual(m.required, ['Windows MSIX bundle', 'Android universal APK'], 'a missing required file is named');
assert.ok(missing([`OpenTick_0.0.1_x64-setup.exe`], V).required.includes('Windows 64-bit installer'), 'a file from another version does not count');
for (const n of FULL) assert.ok(RULES.some(([, , re]) => re.test(n)), `release notes list ${n}`);
for (const [label] of [...REQUIRED, ...OPTIONAL]) assert.ok(label.length > 3);

/* ---- release notes ---- */
const notes = buildNotes({ tag: 'v' + V, files: FULL.map(name => ({ name, size: 5e6 })), changelog: rd('CHANGELOG.md') });
assert.match(notes, new RegExp(`^## What's new in ${V.replace(/\./g, '\\.')}\\n`), 'the description starts with what is new');
assert.ok(notes.includes('Docker') && notes.includes('SHA256SUMS.txt') && notes.includes('#### Android') && notes.includes('E-ink'), 'downloads, docker and verification are described');
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
assert.equal(flavourOf('x/apk/mystery/app.apk'), null);

/* ---- the workflow files ---- */
const WF = readdirSync(join(root, '.github/workflows')).filter(f => f.endsWith('.yml')), wf = f => rd('.github/workflows/' + f);
assert.deepEqual(WF.sort(), ['build-android.yml', 'build-desktop.yml', 'build-docker.yml', 'build-ios.yml', 'build-snap.yml', 'build-web.yml', 'ci.yml', 'deploy-pages.yml',
  'publish-chocolatey.yml', 'publish-microsoft-store.yml', 'publish-scoop.yml', 'publish-snap-store.yml', 'publish-winget.yml', 'release.yml'], 'workflow files are named build-* / publish-* / deploy-* / ci / release');
for (const f of WF) { const t = wf(f); assert.match(t, /^name: .+/m, f + ' has a name'); if (f !== 'release.yml') assert.ok(!/^\s+tags:\s*\[?'?v/m.test(t), f + ' is started by Release, not by a tag of its own'); }

const rel = wf('release.yml');
assert.match(rel, /on:\n\s+push:\n\s+tags: \['v\[0-9\]\+/, 'git push origin <tag> starts the Release');
for (const f of WF.filter(f => /^(build|publish)-/.test(f))) { assert.match(wf(f), /workflow_call:/, f + ' can be called'); assert.ok(rel.includes('./.github/workflows/' + f), 'Release calls ' + f); }
assert.ok(rel.includes('./.github/workflows/ci.yml'), 'Release runs the tests first');
assert.ok(!/release:\s*\n\s+types:/.test(WF.map(wf).join('\n')), 'nothing waits for a `release: published` event (releases made with GITHUB_TOKEN never send one)');
assert.ok(/needs: \[prepare, release\]/.test(rel) && rel.includes('publish-microsoft-store') && rel.includes('publish-snap'), 'stores run after the GitHub Release exists');
assert.ok(rel.includes('collect-assets.mjs') && rel.includes('release-notes.mjs') && rel.includes('body_path: release-notes.md') && rel.includes('generate_release_notes: true'), 'the release says what is new');
assert.ok(rel.includes('attest-build-provenance'), 'files are attested');
assert.ok(rel.includes('version:check') && rel.includes('Tag does not match'), 'a tag that disagrees with package.json stops the release');
assert.ok(rel.includes("'candidate' || 'beta'") && rel.includes("stable == 'true'"), 'pre-releases skip the stores');

const snap = wf('build-snap.yml');
assert.ok(!/chmod a\+r "\$SNAP/.test(snap) && /sudo chown "\$\(id -u\)/.test(snap) && snap.indexOf('chown') < snap.indexOf('chmod a+r'), 'the Snap is chown\'ed to the runner user before any chmod (root made it)');
assert.ok(!snap.includes('npm test') && !snap.includes('rustup') && snap.includes('download-artifact'), 'the Snap wraps the desktop .deb instead of rebuilding Rust');
assert.ok(rd('snap/ci/snapcraft.yaml').includes("@VERSION@") && rd('snap/ci/snapcraft.yaml').includes('assemble.sh') && rd('snap/snapcraft.yaml').includes('snap/local/assemble.sh'), 'both snapcraft files share assemble.sh');
assert.ok(rd('snap/local/assemble.sh').startsWith('#!/usr/bin/env bash'));

const store = wf('publish-microsoft-store.yml');
assert.ok(store.includes('--inputFile') && store.includes('.msixupload') && store.includes('MS_STORE_APP_ID') && !/submission update/.test(store), 'submits the MSIX, not an EXE/MSI URL');
assert.ok(!store.includes('00014150904955425480'), 'the old product id is gone');

const desk = wf('build-desktop.yml');
for (const t of ['i686-pc-windows-msvc', 'aarch64-pc-windows-msvc', 'universal-apple-darwin', 'ubuntu-22.04-arm', 'build-msix.ps1']) assert.ok(desk.includes(t), 'desktop builds ' + t);
const andr = wf('build-android.yml');
assert.ok(andr.includes('--split-per-abi') && andr.includes('--aab') && andr.includes('OPENTICK_EINK') && andr.includes('check-android-version.mjs --generated') && andr.includes('apksigner'), 'Android builds per-CPU APKs, a bundle, the e-ink APK, and checks version and signature');
const act = rd('.github/actions/setup-android/action.yml');
assert.ok(act.includes('configure-signing.py') && !/storePassword=[^$]/.test(act), 'signing is configured from secrets only');
const dock = wf('build-docker.yml');
assert.ok(dock.includes('linux/arm/v7') && dock.includes('linux/386') && dock.includes('linux/arm64') && existsSync(join(root, 'Dockerfile')) && existsSync(join(root, 'docker/nginx.conf')), 'Docker: 64-bit, ARM and 32-bit images');
assert.ok(rd('Dockerfile').includes('--eink') && rd('docker/nginx.conf').includes('/eink/'), 'the image serves both editions');
for (const f of ['build-ios.yml', 'build-docker.yml']) assert.ok(!/\n\s+(IOS_CERTIFICATE|DOCKERHUB_TOKEN):\s+[^$\s]/.test(wf(f)), 'no secret is written into ' + f);
for (const f of WF) assert.ok(!/(ghp_|github_pat_|-----BEGIN)/.test(wf(f)), f + ' holds no credentials');
for (const f of WF.filter(f => !/^ci|^deploy/.test(f))) assert.ok(/^permissions:/m.test(wf(f)), f + ' sets permissions');
assert.ok(/docker/.test(rd('.github/dependabot.yml')), 'Dependabot watches the Dockerfile');
assert.ok(rd('.gitignore').includes('.build/'), 'MSIX build folders are ignored');

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
console.log('release pipeline tests passed');
