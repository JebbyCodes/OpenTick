// One version number for the whole project.
//   npm run bump -- 0.7.0     set package.json, package-lock.json, src-tauri/tauri.conf.json and src-tauri/Cargo.toml (and the README's "What's new in" heading)
//                             Android versionName / versionCode follow tauri.conf.json automatically; scripts/check-android-version.mjs proves it
//   npm run bump -- --check   exit 1 if they disagree (the test suite runs this)
//   npm run version:sync      re-write every manifest from package.json's version (the single source of truth); no argument needed
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = f => join(root, f), rd = f => readFileSync(P(f), 'utf8');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const cargoVersion = t => (t.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m) || [])[1];

export function versions() {
  const lock = JSON.parse(rd('package-lock.json'));
  return {
    'package.json': JSON.parse(rd('package.json')).version,
    'package-lock.json': lock.version,
    'package-lock.json (root package)': lock.packages && lock.packages[''] ? lock.packages[''].version : undefined,
    'src-tauri/tauri.conf.json': JSON.parse(rd('src-tauri/tauri.conf.json')).version,
    'src-tauri/Cargo.toml': cargoVersion(rd('src-tauri/Cargo.toml')),
    'README.md ("What\'s new in …")': (rd('README.md').match(/^## What's new in (\S+)/m) || [])[1], // the release notes must describe this version
  };
}
export function setVersion(v) {
  if (!SEMVER.test(v)) throw new Error(`"${v}" is not a version like 1.2.3`);
  const sub = (f, fn) => writeFileSync(P(f), fn(rd(f)));
  sub('package.json', t => t.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`));
  sub('package-lock.json', t => { const j = JSON.parse(t); j.version = v; if (j.packages && j.packages['']) j.packages[''].version = v; return JSON.stringify(j, null, 2) + '\n'; });
  sub('src-tauri/tauri.conf.json', t => t.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`));
  sub('src-tauri/Cargo.toml', t => t.replace(/(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m, `$1${v}$2`));
  sub('README.md', t => t.replace(/^(## What's new in )\S+/m, `$1${v}`));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--sync') {
    const v = JSON.parse(rd('package.json')).version;
    setVersion(v);
    const after = versions(), bad = Object.entries(after).filter(([, x]) => x !== v);
    for (const [f, x] of Object.entries(after)) console.log(`${String(x).padEnd(10)} ${f}`);
    if (bad.length) { console.error('Sync failed for: ' + bad.map(b => b[0]).join(', ')); process.exit(1); }
    console.log(`All manifests synced to ${v} (from package.json).`);
  } else if (arg === '--check' || !arg) {
    const v = versions(), vals = new Set(Object.values(v));
    for (const [f, x] of Object.entries(v)) console.log(`${String(x).padEnd(10)} ${f}`);
    if (vals.size !== 1) { console.error('Versions disagree. Run: npm run bump -- X.Y.Z'); process.exit(1); }
  } else { setVersion(arg); console.log(`Version set to ${arg}. Commit, then tag it:  git tag v${arg}`); }
}
