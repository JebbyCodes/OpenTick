#!/usr/bin/env node
// Gives the APKs / AABs Tauri leaves in gen/android/app/build/outputs the names the release uses, and fails if one that must exist is missing.
//   node scripts/android/stage-apks.mjs --version 0.5.1 --out staged [--edition eink] [--require universal,arm64]
// Tauri's product flavours are named after the ABI folder: universal, arm64, arm, x86, x86_64.
import { readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = 'src-tauri/gen/android/app/build/outputs';
export const ABI = { universal: 'universal', arm64: 'arm64-v8a', arm: 'armeabi-v7a', x86_64: 'x86_64', x86: 'x86' };

// the flavour is the path segment that names an ABI: apk/arm64/release/app-arm64-release.apk, bundle/universalRelease/app-universal-release.aab
export function flavourOf(path) {
  const parts = path.split(/[\\/]/);
  for (const p of parts.slice(0, -1)) { const k = p.replace(/(Release|Debug)$/i, ''); if (ABI[k]) return k; }
  const m = /app-([a-z0-9_]+?)-(?:release|debug)/i.exec(basename(path)); return m && ABI[m[1]] ? m[1] : null;
}
export function stagedName(path, version, edition = '') {
  const flavour = flavourOf(path); if (!flavour) return null;
  const ext = path.toLowerCase().endsWith('.aab') ? 'aab' : 'apk';
  const ed = edition ? edition + '-' : '';
  return ext === 'aab' ? `OpenTick_${version}.aab` : `OpenTick_${version}_android-${ed}${ABI[flavour]}.apk`;
}
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (n, d = '') => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
  const version = arg('version'), out = arg('out', 'staged'), edition = arg('edition'), need = arg('require', 'universal').split(',').filter(Boolean);
  if (!version) { console.error('--version is required'); process.exit(2); }
  mkdirSync(out, { recursive: true });
  const got = new Set();
  for (const f of walk(join(root, OUT_DIR)).filter(f => /\.(apk|aab)$/i.test(f) && !/unsigned|debug/i.test(basename(f)))) {
    const n = stagedName(f, version, edition); if (!n) { console.log(`skipped ${f}`); continue; }
    copyFileSync(f, join(out, n)); got.add(flavourOf(f)); console.log(`${f} -> ${n}`);
  }
  const missing = need.filter(k => !got.has(k));
  if (missing.length) { console.error(`::error::Missing Android build output for: ${missing.join(', ')}`); process.exit(1); }
}
