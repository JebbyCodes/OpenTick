#!/usr/bin/env node
// Checks the pack library in marketplace/: every file in index.json is a clean OpenTick pack (read with the app's own packParse, so what
// passes here is exactly what the app accepts), is not changed by the app's cleaning (no warnings), and agrees with its index entry.
// Run by `npm run packs:check`, by test/packs.mjs and by the CI workflow on every pull request that touches marketplace/.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeApp } from '../../test/harness.mjs';

export const PACK_FILE_MAX = 400 * 1024;          // a pack in the library stays small: it is read on every device that adds it
export const LICENSES = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'MIT', 'Apache-2.0', 'ISC', 'Unlicense'];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateMarketplace(root, parse = makeApp().packParse) {
  const errors = [], notes = [], err = (where, msg) => errors.push(`${where}: ${msg}`);
  const indexPath = join(root, 'index.json');
  if (!existsSync(indexPath)) return { errors: [`${indexPath}: missing`], notes, count: 0 };
  let index; try { index = JSON.parse(readFileSync(indexPath, 'utf8')); } catch (e) { return { errors: [`index.json: not valid JSON (${e.message})`], notes, count: 0 }; }
  if (!index || index.opentick !== 'marketplace' || index.format !== 1 || !Array.isArray(index.packs)) return { errors: ['index.json: must be { "opentick": "marketplace", "format": 1, "packs": [...] }'], notes, count: 0 };
  const ids = new Set(), files = new Set(), packsDir = resolve(root, 'packs');
  for (const [i, e] of index.packs.entries()) {
    const where = `index.json packs[${i}]${e && e.id ? ` (${e.id})` : ''}`;
    if (!e || typeof e !== 'object') { err(where, 'not an object'); continue; }
    if (typeof e.id !== 'string' || !ID.test(e.id) || e.id.length > 40) err(where, 'id must be lower-case words joined by hyphens (40 characters at most)');
    if (ids.has(e.id)) err(where, 'duplicate id'); ids.add(e.id);
    if (typeof e.file !== 'string' || !/^packs\/[a-z0-9-]+\.json$/.test(e.file)) { err(where, 'file must look like "packs/<id>.json"'); continue; }
    if (basename(e.file, '.json') !== e.id) err(where, 'the file name must be the id');
    if (files.has(e.file)) err(where, 'file listed twice'); files.add(e.file);
    const abs = resolve(root, e.file); if (!abs.startsWith(packsDir + sep)) { err(where, 'file is outside packs/'); continue; }
    if (!existsSync(abs)) { err(where, `${e.file} does not exist`); continue; }
    const size = statSync(abs).size; if (size > PACK_FILE_MAX) err(where, `${e.file} is ${Math.round(size / 1024)} KB (the limit is ${PACK_FILE_MAX / 1024} KB)`);
    let r; try { r = parse(readFileSync(abs, 'utf8')); } catch (x) { err(e.file, `the app refuses it: ${x.message}`); continue; }
    const p = r.pack; for (const w of r.warnings) err(e.file, `the app had to change it: ${w}`);
    if (p.id !== e.id) err(e.file, `the pack says id "${p.id}" but the index says "${e.id}"`);
    if (!SEMVER.test(p.version)) err(e.file, `version "${p.version}" is not like 1.2.3`);
    if (!LICENSES.includes(p.license)) err(e.file, `license "${p.license}" is not one of ${LICENSES.join(', ')}`);
    if (!p.author) err(e.file, 'author is missing'); if (p.description.length < 10) err(e.file, 'description is missing or too short');
    for (const k of ['name', 'version', 'author', 'description', 'license']) if (e[k] !== p[k]) err(where, `${k} "${e[k]}" differs from the pack's "${p[k]}"`);
    const c = { sections: p.sections.length, themes: p.themes.length, entries: p.sections.reduce((n, s) => n + s.entries.length, 0) };
    for (const [k, v] of Object.entries(c)) if (e[k] !== v) err(where, `${k} is ${e[k]} in the index but ${v} in the pack`);
    for (const s of p.sections) { if (s.group && !s.fields.some(f => f.key === s.group)) err(e.file, `“${s.name}” groups by a field that does not exist`); if (!s.fields.length) err(e.file, `“${s.name}” has no fields`); }
    notes.push(`${e.id}: ${c.sections} section(s), ${c.themes} theme(s), ${c.entries} entries`);
  }
  if (existsSync(packsDir)) for (const f of readdirSync(packsDir)) if (f.endsWith('.json') && !files.has('packs/' + f)) err('marketplace/packs/' + f, 'is not listed in index.json');
  return { errors, notes, count: index.packs.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'marketplace')), r = validateMarketplace(root);
  for (const n of r.notes) console.log('  ok  ' + n);
  if (r.errors.length) { console.error(`\n${r.errors.length} problem(s) in ${root}:`); for (const e of r.errors) console.error('  ✗ ' + e); process.exit(1); }
  console.log(`Marketplace OK: ${r.count} pack(s).`);
}
