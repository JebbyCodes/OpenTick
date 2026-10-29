// One version number for the whole project. package.json is the single source of truth.
//
//   npm run bump -- 0.6.0     set package.json to 0.6.0, then write that version into EVERY file that carries one (see FILES below)
//   npm run version:sync      re-write every file from package.json's current version (use after editing package.json by hand)
//   npm run version:check     exit 1 if any file disagrees or a per-release file is missing (the test suite and CI run this)
//
// Files that carry the version, and what is done to each:
//   package.json, package-lock.json (twice)         "version"
//   src-tauri/tauri.conf.json                       "version"  (Android versionName / versionCode are generated from it)
//   src-tauri/Cargo.toml and Cargo.lock             the opentick crate's version (a stale Cargo.lock breaks `cargo build --locked`)
//   snap/snapcraft.yaml                             version: 'x.y.z'
//   packaging/msix/Package.appxmanifest             Identity Version="x.y.z.0" (the Microsoft Store wants four numbers)
//   docs/fdroid/com.opentick.app.yml                the newest build's versionName / versionCode / commit and CurrentVersion / CurrentVersionCode
//   README.md                                       the "What's new in x.y.z" section (the previous one is kept as "What was new in …")
//   CHANGELOG.md                                    a "## x.y.z" section ("## Unreleased" is renamed; otherwise a stub is added)
//   fastlane/metadata/android/en-GB/changelogs/<versionCode>.txt   F-Droid's per-release notes, made from the CHANGELOG section
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { androidVersionCode } from '../android/check-android-version.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = f => join(root, f), rd = f => readFileSync(P(f), 'utf8'), wr = (f, t) => writeFileSync(P(f), t);
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const FILES = {
  pkg: 'package.json', lock: 'package-lock.json', tauri: 'src-tauri/tauri.conf.json', cargo: 'src-tauri/Cargo.toml', cargoLock: 'src-tauri/Cargo.lock',
  snap: 'snap/snapcraft.yaml', msix: 'packaging/msix/Package.appxmanifest', fdroid: 'docs/fdroid/com.opentick.app.yml',
  readme: 'README.md', changelog: 'CHANGELOG.md', fastlaneDir: 'fastlane/metadata/android/en-GB/changelogs',
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cargoVersion = t => (t.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m) || [])[1];
const cargoLockVersion = t => (t.match(/\[\[package\]\]\r?\nname = "opentick"\r?\nversion = "([^"]+)"/) || [])[1];
const msixVersion = t => { const m = t.match(/<Identity\b[^>]*\bVersion="(\d+\.\d+\.\d+)\.\d+"/); return m && m[1]; };
const snapVersion = t => (t.match(/^version:\s*'?"?([^'"\s#]+)/m) || [])[1];
const fdroidBuilds = t => [...t.matchAll(/^ {2}- versionName: (\S+)\r?\n\s+versionCode: (\d+)\r?\n\s+commit: (\S+)/gm)];
export const msixFour = v => v.replace(/-.*$/, '') + '.0';
export const readmeVersion = t => (t.match(/^## What's new in (\S+)/m) || [])[1];

/* ---- the CHANGELOG ---- */
export const changelogSection = (text, v) => {
  const m = new RegExp(`^## v?${esc(v)}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(text);
  return m ? m[1].trim() : null;
};
export const changelogBullets = body => (body || '').split(/\r?\n/).filter(l => /^\s*[-*] /.test(l)).map(l => l.replace(/^\s*[-*] /, '').trim());
const plain = s => s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
// F-Droid shows at most 500 bytes of changelog per release
export function fastlaneText(body) {
  const out = []; let size = 0;
  for (const b of changelogBullets(body)) {
    const line = '• ' + plain(b), add = Buffer.byteLength(line + '\n');
    if (size + add > 490) { const room = 490 - size - 4; if (!out.length && room > 20) out.push(line.slice(0, room) + '…'); break; }
    out.push(line); size += add;
  }
  return (out.join('\n') || '• See the release notes on GitHub') + '\n';
}

/* ---- what each file says now ---- */
export function versions() {
  const lock = JSON.parse(rd(FILES.lock)), fd = existsSync(P(FILES.fdroid)) ? rd(FILES.fdroid) : '', builds = fdroidBuilds(fd);
  const v = {
    'package.json': JSON.parse(rd(FILES.pkg)).version,
    'package-lock.json': lock.version,
    'package-lock.json (root package)': lock.packages && lock.packages[''] ? lock.packages[''].version : undefined,
    'src-tauri/tauri.conf.json': JSON.parse(rd(FILES.tauri)).version,
    'src-tauri/Cargo.toml': cargoVersion(rd(FILES.cargo)),
    'src-tauri/Cargo.lock': existsSync(P(FILES.cargoLock)) ? cargoLockVersion(rd(FILES.cargoLock)) : undefined,
    'snap/snapcraft.yaml': snapVersion(rd(FILES.snap)),
    'packaging/msix/Package.appxmanifest': msixVersion(rd(FILES.msix)),
    'README.md ("What\'s new in …")': readmeVersion(rd(FILES.readme)),
  };
  if (builds.length) v['docs/fdroid (newest build)'] = builds[builds.length - 1][1];
  return v;
}
// everything that is not a plain version string: per-release files that must exist and agree
export function problems(v = JSON.parse(rd(FILES.pkg)).version) {
  const out = [], code = androidVersionCode(v);
  const cl = rd(FILES.changelog);
  if (changelogSection(cl, v) == null) out.push(`CHANGELOG.md has no "## ${v}" section (write what is new, or run: npm run version:sync)`);
  if (code != null && !existsSync(P(`${FILES.fastlaneDir}/${code}.txt`))) out.push(`fastlane changelog ${code}.txt is missing (run: npm run version:sync)`);
  if (existsSync(P(FILES.fdroid))) {
    const b = fdroidBuilds(rd(FILES.fdroid)).pop(), fd = rd(FILES.fdroid);
    if (b && String(code) !== b[2]) out.push(`docs/fdroid versionCode is ${b[2]}, expected ${code}`);
    if (b && b[3] !== 'v' + v) out.push(`docs/fdroid commit is ${b[3]}, expected v${v}`);
    const cv = (fd.match(/^CurrentVersion:\s*(\S+)/m) || [])[1], cc = (fd.match(/^CurrentVersionCode:\s*(\S+)/m) || [])[1];
    if (cv !== v || String(cc) !== String(code)) out.push(`docs/fdroid CurrentVersion is ${cv} (${cc}), expected ${v} (${code})`);
  }
  return out;
}

/* ---- writing it everywhere ---- */
export function setVersion(v) {
  if (!SEMVER.test(v)) throw new Error(`"${v}" is not a version like 1.2.3`);
  const sub = (f, fn) => { if (!existsSync(P(f))) return; const a = rd(f), b = fn(a); if (a !== b) wr(f, b); };
  const code = androidVersionCode(v);
  sub(FILES.pkg, t => t.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`));
  sub(FILES.lock, t => { const j = JSON.parse(t); j.version = v; if (j.packages && j.packages['']) j.packages[''].version = v; return JSON.stringify(j, null, 2) + '\n'; });
  sub(FILES.tauri, t => t.replace(/("version"\s*:\s*")[^"]+(")/, `$1${v}$2`));
  sub(FILES.cargo, t => t.replace(/(^\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m, `$1${v}$2`));
  sub(FILES.cargoLock, t => t.replace(/(\[\[package\]\]\r?\nname = "opentick"\r?\nversion = ")[^"]+(")/, `$1${v}$2`));
  sub(FILES.snap, t => t.replace(/^(version:\s*)'?"?[^'"\s#]+'?"?/m, `$1'${v}'`));
  sub(FILES.msix, t => t.replace(/(<Identity\b[^>]*\bVersion=")[^"]+(")/, `$1${msixFour(v)}$2`));
  sub(FILES.fdroid, t => {
    const last = fdroidBuilds(t).pop(); if (!last) return t;
    const fixed = last[0].replace(/versionName: \S+/, `versionName: ${v}`).replace(/versionCode: \d+/, `versionCode: ${code}`).replace(/commit: \S+/, `commit: v${v}`);
    return (t.slice(0, last.index) + fixed + t.slice(last.index + last[0].length))
      .replace(/^CurrentVersion:.*$/m, `CurrentVersion: ${v}`).replace(/^CurrentVersionCode:.*$/m, `CurrentVersionCode: ${code}`);
  });
  // CHANGELOG: "## Unreleased" becomes this version; with no section at all, a stub (the release check refuses to publish a TODO)
  sub(FILES.changelog, t => {
    if (changelogSection(t, v) != null) return t;
    if (/^## Unreleased\b/mi.test(t)) return t.replace(/^## Unreleased\b[^\n]*/mi, `## ${v}`);
    const stub = `## ${v}\n\n- TODO: describe what is new in this release.\n\n`;
    return /^# Changelog\s*\n/.test(t) ? t.replace(/^(# Changelog\s*\n+)/, `$1${stub}`) : stub + t;
  });
  const body = changelogSection(rd(FILES.changelog), v);
  // README: this version's "What's new" on top; the one that was there becomes "What was new in …"
  sub(FILES.readme, t => {
    const old = readmeVersion(t); if (old === v) return t;
    const bullets = changelogBullets(body).map(b => `- ${b}`).join('\n') || '- See [CHANGELOG.md](CHANGELOG.md).';
    const fresh = `## What's new in ${v}\n\n${bullets}\n\nEarlier releases are listed in [CHANGELOG.md](CHANGELOG.md).\n\n`;
    return old ? t.replace(/^## What's new in (\S+)/m, m => fresh + m.replace("What's new in", 'What was new in')) : t;
  });
  if (code != null) { const f = `${FILES.fastlaneDir}/${code}.txt`; if (!existsSync(P(f))) wr(f, fastlaneText(body)); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  const report = () => {
    const want = JSON.parse(rd(FILES.pkg)).version, after = versions(), bad = Object.entries(after).filter(([, x]) => x !== want);
    for (const [f, x] of Object.entries(after)) console.log(`${String(x).padEnd(10)} ${f}${x === want ? '' : '   <-- differs'}`);
    const more = problems(want); for (const m of more) console.error('! ' + m);
    return { want, bad, more };
  };
  if (arg === '--sync') {
    setVersion(JSON.parse(rd(FILES.pkg)).version);
    const { want, bad, more } = report();
    if (bad.length || more.length) { console.error('Sync did not finish for: ' + [...bad.map(b => b[0]), ...more].join('; ')); process.exit(1); }
    console.log(`Every file now says ${want} (from package.json).`);
  } else if (arg === '--check' || !arg) {
    const { bad, more } = report();
    if (bad.length || more.length) { console.error('Versions disagree. Run: npm run version:sync   (or: npm run bump -- X.Y.Z)'); process.exit(1); }
  } else {
    setVersion(arg); const { want, bad, more } = report();
    if (bad.length || more.length) process.exit(1);
    console.log(`Version set to ${want} everywhere. Fill in CHANGELOG.md if it says TODO, commit, then:  git tag v${want} && git push origin v${want}`);
  }
}
