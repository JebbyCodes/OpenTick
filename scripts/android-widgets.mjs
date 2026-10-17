#!/usr/bin/env node
/* Adds the OpenTick home-screen widgets to the generated Android project (src-tauri/gen/android).
   That folder is created by `tauri android init` and is not kept in git, so the widget sources live in src-tauri/android-widgets and are
   copied in (and the manifest patched) after init. Safe to run again: files are overwritten, the manifest is patched once.
   Usage:  node scripts/android-widgets.mjs [path-to-gen/android]   */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gen = process.argv[2] || join(root, 'src-tauri', 'gen', 'android');
const src = join(root, 'src-tauri', 'android-widgets');
const conf = JSON.parse(readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const pkg = String(conf.identifier).replace(/-/g, '_');
const main = join(gen, 'app', 'src', 'main');
if (!existsSync(main)) { console.error(`Android project not found at ${main}. Run "npx tauri android init" first.`); process.exit(1); }

const fill = t => t.replaceAll('__PACKAGE__', pkg);
const put = (to, text) => { mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, text); };

// Kotlin: next to the generated MainActivity when it can be found, otherwise under java/<package>/
let ktDir = null;
(function find(d, depth) {
  if (ktDir || depth > 8 || !existsSync(d)) return;
  for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) find(p, depth + 1); else if (e === 'MainActivity.kt' && !ktDir) ktDir = d; }
})(join(main, 'java'), 0);
if (!ktDir) ktDir = join(main, 'java', ...pkg.split('.'));
for (const f of readdirSync(join(src, 'kotlin'))) put(join(ktDir, f), fill(readFileSync(join(src, 'kotlin', f), 'utf8')));

// resources
let n = 0;
for (const dir of readdirSync(join(src, 'res'))) for (const f of readdirSync(join(src, 'res', dir))) { put(join(main, 'res', dir, f), fill(readFileSync(join(src, 'res', dir, f), 'utf8'))); n++; }

// manifest
const mf = join(main, 'AndroidManifest.xml'); let xml = readFileSync(mf, 'utf8');
if (xml.includes('OpenTickTasksWidget')) console.log('Manifest already has the widgets.');
else {
  if (!xml.includes('</application>')) { console.error('Could not find </application> in AndroidManifest.xml'); process.exit(1); }
  xml = xml.replace('</application>', fill(readFileSync(join(src, 'manifest-snippet.xml'), 'utf8')) + '    </application>'); writeFileSync(mf, xml);
  console.log('Patched AndroidManifest.xml.');
}
console.log(`Widgets installed for ${pkg}: ${readdirSync(join(src, 'kotlin')).length} Kotlin files in ${ktDir.replace(gen, '.')}, ${n} resource files.`);
