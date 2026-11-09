#!/usr/bin/env node
/* Adds the OpenTick home-screen widgets to the generated Android project (src-tauri/gen/android).
   That folder is created by `tauri android init` and is not kept in git, so the widget sources live in src-tauri/android-widgets and are
   copied in (and the manifest patched) after init. Safe to run again: files are overwritten, the manifest is patched once.
   Usage:  node scripts/android/android-widgets.mjs [--watch] [path-to-gen/android]
   --watch  also marks the app as a Wear OS (smartwatch) app: it can then be installed on a watch and the Play Store treats it as one. The
            widgets are still added (Wear OS simply ignores them) so the code and the background service stay exactly the same.   */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2), WATCH = args.includes('--watch');
const gen = args.find(a => !a.startsWith('--')) || join(root, 'src-tauri', 'gen', 'android');
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
// background service: receiver + service inside <application>, permissions before it. Each patched once.
{
  let x = readFileSync(mf, 'utf8'), changed = false;
  if (!x.includes('OpenTickBgReceiver')) { x = x.replace('</application>', fill(readFileSync(join(src, 'manifest-bg.xml'), 'utf8')) + '    </application>'); changed = true; }
  if (!x.includes('OpenTick background service permissions')) { x = x.replace(/<application\b/, fill(readFileSync(join(src, 'manifest-bg-permissions.xml'), 'utf8')) + '    <application'); changed = true; }
  if (changed) { writeFileSync(mf, x); console.log('Patched AndroidManifest.xml for the background service.'); } else console.log('Manifest already has the background service.');
}
// smartwatch edition: a Wear OS app says so (required feature) and that it works without a phone (standalone). Each patched once.
if (WATCH) {
  let x = readFileSync(mf, 'utf8'), changed = false;
  if (!x.includes('OpenTick watch edition (features)')) {
    x = x.replace(/<application\b/, '    <!-- OpenTick watch edition (features) -->\n    <uses-feature android:name="android.hardware.type.watch" android:required="true" />\n    <!-- /OpenTick watch edition (features) -->\n    <application'); changed = true;
  }
  if (!x.includes('OpenTick watch edition (application)')) {
    x = x.replace('</application>', '        <!-- OpenTick watch edition (application) -->\n        <uses-library android:name="com.google.android.wearable" android:required="false" />\n        <meta-data android:name="com.google.android.wearable.standalone" android:value="true" />\n        <!-- /OpenTick watch edition (application) -->\n    </application>'); changed = true;
  }
  if (changed) { writeFileSync(mf, x); console.log('Patched AndroidManifest.xml for Wear OS.'); } else console.log('Manifest already marked for Wear OS.');
}
console.log(`Widgets installed for ${pkg}: ${readdirSync(join(src, 'kotlin')).length} Kotlin files in ${ktDir.replace(gen, '.')}, ${n} resource files.`);
