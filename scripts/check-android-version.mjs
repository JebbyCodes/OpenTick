#!/usr/bin/env node
// Android's versionName / versionCode must follow package.json, the single source of the version.
// Tauri generates both from `version` in src-tauri/tauri.conf.json (itself kept equal to package.json by `npm run bump`):
//   versionName = version,   versionCode = major * 1,000,000 + minor * 1,000 + patch   (it must rise with every release)
// So nothing here sets them by hand. This script makes sure that stays true:
//   node scripts/check-android-version.mjs            config check (always safe): no hand-written override that could disagree
//   node scripts/check-android-version.mjs --generated  also check the generated project's tauri.properties; used in CI after the APK build,
//                                                      where that file exists, and fails if it is missing
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), rd = p => readFileSync(join(root, p), 'utf8');
export const androidVersionCode = v => { const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || '')); return m ? +m[1] * 1000000 + +m[2] * 1000 + +m[3] : null; };
export function parseProps(text) { const o = {}; for (const l of String(text || '').split(/\r?\n/)) { const m = /^\s*([\w.]+)\s*=\s*(.*?)\s*$/.exec(l); if (m && !l.trim().startsWith('#')) o[m[1]] = m[2]; } return o; }
export function problems({ pkgVersion, tauriConf, props }) {
  const out = [], want = androidVersionCode(pkgVersion);
  if (want == null) out.push(`package.json version "${pkgVersion}" is not major.minor.patch`);
  if (tauriConf.version !== pkgVersion) out.push(`tauri.conf.json version ${tauriConf.version} differs from package.json ${pkgVersion} (run: npm run bump -- ${pkgVersion})`);
  const ov = tauriConf.bundle && tauriConf.bundle.android && tauriConf.bundle.android.versionCode;
  if (ov !== undefined && ov !== want) out.push(`bundle.android.versionCode ${ov} overrides the derived value ${want}; remove it so it follows the version`);
  if (props) {
    const name = props['tauri.android.versionName'], code = props['tauri.android.versionCode'];
    if (name !== pkgVersion) out.push(`generated versionName is ${name}, expected ${pkgVersion}`);
    if (String(code) !== String(want)) out.push(`generated versionCode is ${code}, expected ${want}`);
  }
  return out;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const gen = process.argv.includes('--generated'), propsPath = 'src-tauri/gen/android/app/tauri.properties';
  let props = null;
  if (gen) { if (!existsSync(join(root, propsPath))) { console.error(`${propsPath} not found: run this after the Android build`); process.exit(1); } props = parseProps(rd(propsPath)); }
  const pkgVersion = JSON.parse(rd('package.json')).version, bad = problems({ pkgVersion, tauriConf: JSON.parse(rd('src-tauri/tauri.conf.json')), props });
  if (bad.length) { console.error(bad.map(b => '✗ ' + b).join('\n')); process.exit(1); }
  console.log(`Android version OK: versionName ${pkgVersion}, versionCode ${androidVersionCode(pkgVersion)}${gen ? ' (generated project checked)' : ''}`);
}
