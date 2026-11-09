#!/usr/bin/env node
/* Packages the smartwatch edition as a Tizen web app (.wgt) for Samsung Galaxy Watch models that run Tizen (Galaxy Watch, Watch Active, Watch3 and
   earlier, Gear S3 / Sport / S2). Newer Galaxy Watches (4 and later) run Wear OS and use the Android APK instead.

     node scripts/watch/make-tizen-wgt.mjs --version 0.7.0 [--out staged] [--keep tizen-build]

   Writes <out>/OpenTick_<version>_tizen-unsigned.wgt. The package is UNSIGNED on purpose: a Tizen app is signed with the developer's own
   certificate (Samsung's), which this repository does not have and must not hold. To install it, sign it with your certificate in Tizen Studio
   or with the `tizen package` command, then install it on a watch in developer mode (see docs/WATCHES.md). It is the same app as the /watch/ web
   edition: one index.html that holds everything, so there is nothing else to fetch and the data stays on the watch. */
import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from '../../build-app.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TIZEN_PACKAGE = 'OpenTickWt'; // a Tizen package id is exactly 10 letters or digits
export const TIZEN_ID = `${TIZEN_PACKAGE}.OpenTick`;

// Tizen wants a plain x.y.z; a pre-release suffix (0.8.0-beta.1) is left off
export const tizenVersion = v => { const m = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})/.exec(String(v || '')); if (!m) throw new Error(`"${v}" is not a version number (x.y.z)`); return `${m[1]}.${m[2]}.${m[3]}`; };

export function tizenConfig(version) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="https://github.com/JebbyCodes/OpenTick" version="${tizenVersion(version)}" viewmodes="maximized">
  <tizen:application id="${TIZEN_ID}" package="${TIZEN_PACKAGE}" required_version="4.0"/>
  <content src="index.html"/>
  <feature name="http://tizen.org/feature/screen.size.all"/>
  <icon src="icon.png"/>
  <name>OpenTick</name>
  <description>Open-source to-do, calendar, notes, habit and focus app (smartwatch edition)</description>
  <tizen:profile name="wearable"/>
  <!-- network: only for the WebDAV sync address you enter (and the optional update check) -->
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <access origin="*" subdomains="true"/>
  <tizen:setting screen-orientation="portrait" context-menu="disable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable"/>
</widget>
`;
}

// builds the watch edition into `dir` and adds config.xml and the icon; returns the file names that make up the package
export function stageTizen(dir, version) {
  build({ watch: true, out: dir });
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.webmanifest'), 'utf8')), logo = manifest.icons && manifest.icons[0] && manifest.icons[0].src;
  if (!logo || !existsSync(join(dir, logo))) throw new Error('the watch build has no icon');
  copyFileSync(join(dir, logo), join(dir, 'icon.png'));
  writeFileSync(join(dir, 'config.xml'), tizenConfig(version));
  // a service worker does nothing in a Tizen app (the files are local) and would only be dead weight
  rmSync(join(dir, 'sw.js'), { force: true });
  return readdirSync(dir).sort();
}

export function makeTizen({ version, out = 'staged', keep = '' }) {
  const dir = keep ? resolve(keep) : mkdtempSync(join(tmpdir(), 'ot-tizen-'));
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const files = stageTizen(dir, version);
  mkdirSync(out, { recursive: true });
  const wgt = resolve(out, `OpenTick_${version}_tizen-unsigned.wgt`); rmSync(wgt, { force: true });
  try { execFileSync('zip', ['-X', '-q', '-r', wgt, ...files], { cwd: dir, stdio: 'inherit' }); }
  catch (e) { throw new Error(`could not zip the package (is the "zip" command installed?): ${e.message}`); }
  if (!keep) rmSync(dir, { recursive: true, force: true });
  return { wgt, files };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (n, d = '') => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
  const version = arg('version'); if (!version) { console.error('--version is required'); process.exit(2); }
  try { const r = makeTizen({ version, out: arg('out', 'staged'), keep: arg('keep') }); console.log(`${r.wgt}  (${r.files.join(', ')})`); }
  catch (e) { console.error(`::error::${e.message}`); process.exit(1); }
}
