#!/usr/bin/env node
// Gathers everything the build jobs made into one flat folder for the GitHub Release, checks nothing expected is missing, and writes SHA256SUMS.txt.
//   node scripts/release/collect-assets.mjs --from release-assets --to release-files --version 0.5.1
// Required files fail the release when absent; optional ones (32-bit, ARM, iOS, x86 phones…) only raise a warning, so a flaky
// secondary target never blocks a release, but is never silently forgotten either.
import { readdirSync, statSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const EXT = /\.(apk|aab|ipa|exe|msi|msix|msixbundle|deb|rpm|AppImage|dmg|snap|zip|nupkg)$/i;
// [label, test(version)] — what a complete release holds
const R = (re) => v => new RegExp(re.replace(/\{v\}/g, v.replace(/\./g, '\\.')));
export const REQUIRED = [
  ['Windows 64-bit installer', R('^OpenTick_{v}_x64-setup\\.exe$')], ['Windows 64-bit MSI', R('^OpenTick_{v}_x64_en-US\\.msi$')],
  ['Windows 64-bit portable', R('^OpenTick_{v}_x64-portable\\.zip$')], ['Windows 64-bit MSIX', R('^OpenTick_{v}_x64\\.msix$')],
  ['Windows MSIX bundle', R('^OpenTick_{v}\\.msixbundle$')],
  ['macOS .dmg', R('^OpenTick_{v}_universal\\.dmg$')],
  ['Linux 64-bit AppImage', R('^OpenTick_{v}_amd64\\.AppImage$')], ['Linux 64-bit .deb', R('^OpenTick_{v}_amd64\\.deb$')],
  ['Linux 64-bit .rpm', R('^OpenTick-{v}-\\d+\\.x86_64\\.rpm$')], ['Linux 64-bit Snap', R('^opentick_{v}_amd64\\.snap$')],
  ['Android universal APK', R('^OpenTick_{v}_android-universal\\.apk$')], ['Android arm64 APK', R('^OpenTick_{v}_android-arm64-v8a\\.apk$')],
  ['Android 32-bit ARM APK', R('^OpenTick_{v}_android-armeabi-v7a\\.apk$')], ['Android App Bundle', R('^OpenTick_{v}\\.aab$')],
  ['Android e-ink APK', R('^OpenTick_{v}_android-eink-universal\\.apk$')],
  ['Website zip', R('^OpenTick_{v}_web\\.zip$')], ['E-ink website zip', R('^OpenTick_{v}_web-eink\\.zip$')],
];
export const OPTIONAL = [
  ['Windows 32-bit installer', R('^OpenTick_{v}_x86-setup\\.exe$')], ['Windows 32-bit portable', R('^OpenTick_{v}_x86-portable\\.zip$')], ['Windows 32-bit MSIX', R('^OpenTick_{v}_x86\\.msix$')],
  ['Windows ARM64 installer', R('^OpenTick_{v}_arm64-setup\\.exe$')], ['Windows ARM64 portable', R('^OpenTick_{v}_arm64-portable\\.zip$')], ['Windows ARM64 MSIX', R('^OpenTick_{v}_arm64\\.msix$')],
  ['Linux ARM64 AppImage', R('^OpenTick_{v}_aarch64\\.AppImage$')], ['Linux ARM64 .deb', R('^OpenTick_{v}_arm64\\.deb$')], ['Linux ARM64 .rpm', R('^OpenTick-{v}-\\d+\\.aarch64\\.rpm$')], ['Linux ARM64 Snap', R('^opentick_{v}_arm64\\.snap$')],
  ['Android x86_64 APK', R('^OpenTick_{v}_android-x86_64\\.apk$')], ['Android x86 APK', R('^OpenTick_{v}_android-x86\\.apk$')],
  ['iOS .ipa (needs Apple secrets)', R('^OpenTick_{v}_ios\\.ipa$')],
];
export function missing(names, version) {
  const has = ([, f]) => names.some(n => f(version).test(n));
  return { required: REQUIRED.filter(x => !has(x)).map(x => x[0]), optional: OPTIONAL.filter(x => !has(x)).map(x => x[0]) };
}
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (n, d = '') => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
  const from = arg('from', 'release-assets'), to = arg('to', 'release-files'), version = arg('version');
  if (!version) { console.error('--version is required'); process.exit(2); }
  mkdirSync(to, { recursive: true });
  const seen = new Map();
  for (const f of walk(from).sort().filter(f => EXT.test(f))) {
    const n = basename(f);
    if (seen.has(n)) { console.error(`::error::Two build jobs made a file called ${n}:\n  ${seen.get(n)}\n  ${f}`); process.exit(1); }
    seen.set(n, f); copyFileSync(f, join(to, n));
  }
  const names = [...seen.keys()].sort();
  if (!names.length) { console.error(`::error::No packages were found under ${from}`); process.exit(1); }
  const { required, optional } = missing(names, version);
  const sums = names.map(n => `${createHash('sha256').update(readFileSync(join(to, n))).digest('hex')}  ${n}`).join('\n') + '\n';
  writeFileSync(join(to, 'SHA256SUMS.txt'), sums);
  console.log(`${names.length} files:\n` + names.map(n => `  ${n}`).join('\n'));
  for (const o of optional) console.log(`::warning title=Not in this release::${o} was not built.`);
  if (required.length) { console.error(`::error title=Release is incomplete::Missing required files: ${required.join('; ')}`); process.exit(1); }
}
