// The pack library in marketplace/ and the checker CI runs on it. Every sample pack must be accepted by the app unchanged, install cleanly
// and show up as working sections and themes; the checker must catch each way an entry or file can be wrong.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeApp } from './harness.mjs';
import { validateMarketplace, LICENSES } from '../scripts/packs/validate-packs.mjs';

const root = new URL('../marketplace/', import.meta.url).pathname;
const real = validateMarketplace(root);
assert.deepEqual(real.errors, [], 'the library in the repository is clean:\n' + real.errors.join('\n')); assert.ok(real.count >= 4, 'there are sample packs');

// every sample pack installs and its sections open without error; themes arrive but are not switched to
{
  const A = makeApp(), { U } = A, index = JSON.parse(readFileSync(root + 'index.json', 'utf8'));
  for (const e of index.packs) {
    const text = readFileSync(root + e.file, 'utf8'), { pack, warnings } = A.packParse(text); assert.equal(warnings.length, 0, e.id + ': the app changes nothing in it');
    const theme0 = A.S.settings.theme, n0 = A.S.csections.length, r = A.packInstall(pack);
    assert.equal(A.S.csections.length, n0 + pack.sections.length, e.id); assert.equal(A.S.settings.theme, theme0, e.id + ' leaves the theme alone');
    for (const s of A.S.csections.slice(n0)) { for (const view of ['list', 'cards', 'table']) { s.view = view; U.page = s.id; assert.doesNotThrow(() => A.render(), `${e.id} ${view}`); } assert.ok(A.navKeys().includes('sec:' + s.id)); }
    assert.equal(r.themes, pack.themes.length);
  }
  assert.ok(A.S.settings.customThemes.length >= 3, 'the three themes are installed as custom themes');
  for (const t of A.S.settings.customThemes) assert.ok(!/url\(|@import|expression|javascript/i.test(t.css), t.name);
  // round trip: export what was installed and check the library would still accept it
  const out = A.packFromSections(A.S.csections, { name: 'Everything', author: 'Test', version: '1.0.0', license: 'CC0-1.0' }, true);
  assert.ok(A.packParse(JSON.stringify(out)).warnings.length === 0, 'an exported pack is clean');
}

// the checker finds each kind of mistake
{
  const tmp = mkdtempSync(join(tmpdir(), 'opentick-packs-')); const fresh = () => { rmSync(join(tmp, 'm'), { recursive: true, force: true }); cpSync(root, join(tmp, 'm'), { recursive: true }); return join(tmp, 'm'); };
  const edit = (dir, file, f) => { const p = join(dir, file), j = JSON.parse(readFileSync(p, 'utf8')); f(j); writeFileSync(p, JSON.stringify(j, null, 2)); };
  const bad = (what, change, re) => { const d = fresh(); change(d); const r = validateMarketplace(d); assert.ok(r.errors.some(e => re.test(e)), `${what}: expected ${re}, got\n${r.errors.join('\n')}`); };
  assert.deepEqual(validateMarketplace(fresh()).errors, [], 'the copy starts clean');
  bad('a licence that is not allowed', d => edit(d, 'packs/study-planner.json', j => { j.license = 'All rights reserved'; }), /license/);
  bad('a version that is not semver', d => edit(d, 'packs/study-planner.json', j => { j.version = 'v1'; }), /version/);
  bad('a pack whose id differs from its file', d => edit(d, 'packs/study-planner.json', j => { j.id = 'other'; }), /says id/);
  bad('a missing file', d => rmSync(join(d, 'packs/garden-journal.json')), /does not exist/);
  bad('a file nobody lists', d => writeFileSync(join(d, 'packs/extra.json'), '{}'), /not listed/);
  bad('an entry that disagrees with its pack', d => edit(d, 'index.json', j => { j.packs[0].entries = 99; }), /entries is 99/);
  bad('a duplicate id', d => edit(d, 'index.json', j => { j.packs.push({ ...j.packs[0] }); }), /duplicate id/);
  bad('a path that leaves packs/', d => edit(d, 'index.json', j => { j.packs[0].file = '../index.json'; }), /file must look like/);
  bad('a file that is not a pack', d => writeFileSync(join(d, 'packs/study-planner.json'), '{"hello":1}'), /refuses it/);
  bad('a pack the app has to change (an unknown field type)', d => edit(d, 'packs/study-planner.json', j => { j.sections[0].fields[0].type = 'hologram'; }), /had to change it/);
  bad('an unsafe theme colour', d => edit(d, 'packs/calm-themes.json', j => { j.themes[0].vars['--card'] = 'url(http://evil)'; }), /not a plain colour or shadow/);
  bad('a group that is not a field', d => edit(d, 'packs/study-planner.json', j => { j.sections[0].group = 'nope'; }), /not one of its choice or tick-box fields/);
  bad('a sort by a field that does not exist', d => edit(d, 'packs/study-planner.json', j => { j.sections[0].sort.f = 'nope'; }), /sorted by/);
  bad('a value that does not fit its field', d => edit(d, 'packs/study-planner.json', j => { j.sections[0].entries[0].vals.conf = 9; }), /did not fit their field/);
  bad('a value for a field that is not there', d => edit(d, 'packs/study-planner.json', j => { j.sections[0].entries[0].vals.ghost = 'x'; }), /did not fit their field/);
  bad('a bad index', d => writeFileSync(join(d, 'index.json'), '{"packs":[]}'), /must be/);
  bad('no index', d => rmSync(join(d, 'index.json')), /missing/);
  assert.ok(LICENSES.includes('CC0-1.0'));
  rmSync(tmp, { recursive: true, force: true });
}
console.log('pack library tests passed');
