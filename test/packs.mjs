// Packs: the sample packs in test/fixtures/packs/ install cleanly (the app reads them with no warnings), and the library client (src/js/packlib.js):
// codes, the index, asking the library, checking what comes back, what is shown and what is installed. The library itself is the repository
// OpenTick-Packs; its checks import this repository's harness, so what passes there is exactly what the app accepts.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeApp, clock } from './harness.mjs';

const dir = new URL('./fixtures/packs/', import.meta.url).pathname, files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
assert.ok(files.length >= 4, 'there are sample packs');
const J = x => JSON.parse(JSON.stringify(x)); // (values made inside the app's VM have that VM's Array and Object, which deepEqual tells apart)
const read = f => readFileSync(dir + f, 'utf8'), sha = t => createHash('sha256').update(t).digest('hex');

// ---------- every sample pack installs and its sections open without error; themes arrive but are not switched to ----------
{
  const A = makeApp(), { U } = A;
  for (const f of files) {
    const { pack, warnings } = A.packParse(read(f)); assert.equal(warnings.length, 0, f + ': the app changes nothing in it');
    const theme0 = A.S.settings.theme, n0 = A.S.csections.length, r = A.packInstall(pack);
    assert.equal(A.S.csections.length, n0 + pack.sections.length, f); assert.equal(A.S.settings.theme, theme0, f + ' leaves the theme alone');
    for (const s of A.S.csections.slice(n0)) {
      assert.equal(s.packId, pack.id, 'a section remembers which pack it came from'); assert.equal(s.packVer, pack.version);
      for (const view of ['list', 'cards', 'table']) { s.view = view; U.page = s.id; assert.doesNotThrow(() => A.render(), `${f} ${view}`); } assert.ok(A.navKeys().includes('sec:' + s.id));
    }
    assert.equal(r.themes, pack.themes.length); assert.equal(A.S.settings.packsDone[pack.id].v, pack.version, 'this device remembers it, so a colour-only pack also shows as installed');
  }
  assert.ok(A.S.settings.customThemes.length >= 3, 'the themes are installed as custom themes');
  for (const t of A.S.settings.customThemes) assert.ok(!/url\(|@import|expression|javascript/i.test(t.css), t.name);
  const out = A.packFromSections(A.S.csections, { name: 'Everything', author: 'Test', version: '1.0.0', license: 'CC0-1.0' }, true);
  assert.ok(A.packParse(JSON.stringify(out)).warnings.length === 0, 'an exported pack is clean');
  // the origin survives a save and a reload (xsNormalise keeps it), and a bad one is dropped
  assert.equal(A.xsNormalise({ id: 'x', name: 'n', packId: 'study-planner', packVer: '1.2.3' }).packId, 'study-planner'); assert.equal(A.xsNormalise({ id: 'x', name: 'n', packId: '../etc' }).packId, '');
}

// ---------- codes ----------
{
  const A = makeApp();
  for (const [typed, code] of [['K7QM-3XRD', 'K7QM-3XRD'], ['k7qm3xrd', 'K7QM-3XRD'], ['  k7qm 3xrd ', 'K7QM-3XRD'], ['K7QM–3XRD'.replace('–', '-'), 'K7QM-3XRD'], ['KO1L-3XRD', 'K011-3XRD'], ['', ''], ['K7QM', ''], ['K7QM-3XR', ''], ['K7QM-3XRDD', ''], ['K7QU-3XRD', ''], ['{"a":1}', ''], [null, ''], [undefined, ''], [12345678, '1234-5678']]) assert.equal(A.pkCode(typed), code, `pkCode(${JSON.stringify(typed)})`);
  assert.equal(A.pkTyping('k7qm3xrdzz'), 'K7QM-3XRD', 'typing is cut at 8 and the dash is put in'); assert.equal(A.pkTyping('k7q'), 'K7Q'); assert.equal(A.pkTyping('k7qmo'), 'K7QM-0'); assert.equal(A.pkTyping('k7qm-3x'), 'K7QM-3X');
}

// ---------- a library to talk to: index.json and packs/<id>.json, served from memory ----------
const code = id => { let n = 0n; for (const b of createHash('sha256').update('opentick-pack:' + id).digest().subarray(0, 5)) n = (n << 8n) | BigInt(b); const al = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; let s = ''; for (let i = 0; i < 8; i++) { s = al[Number(n & 31n)] + s; n >>= 5n; } return s.slice(0, 4) + '-' + s.slice(4); };
function library(extra = {}) {
  const served = {}, calls = [], rows = [];
  for (const f of files) {
    const text = read(f), p = JSON.parse(text), id = f.replace('.json', '');
    served['packs/' + f] = text;
    rows.push({ code: code(id), id, file: 'packs/' + f, name: p.name, version: p.version, author: p.author, description: p.description, license: p.license, sections: (p.sections || []).length, themes: (p.themes || []).length, entries: (p.sections || []).reduce((n, s) => n + (s.entries || []).length, 0), tags: ['study', 'Home'], size: text.length, sha256: sha(text), updated: '2026-11-18' });
  }
  const state = { index: { opentick: 'pack-index', format: 1, updated: '2026-11-19', packs: rows }, served, calls, rows, fail: null, ...extra };
  state.fetch = async (url, opt) => {
    calls.push(url); const path = String(url).replace('https://jebbycodes.github.io/OpenTick-Packs/', '');
    if (state.fail === 'offline') throw new TypeError('Failed to fetch');
    if (typeof state.fail === 'number') return { ok: false, status: state.fail, text: async () => '' };
    const body = path === 'index.json' ? (typeof state.indexText === 'string' ? state.indexText : JSON.stringify(state.index)) : served[path];
    if (body === undefined) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
  };
  return state;
}
const flush = () => new Promise(r => setTimeout(r, 15));
const rejects = async (p, re, what) => { try { await p; } catch (e) { assert.ok(e.pk, what + ': a sentence fit to show, not a crash (' + e.message + ')'); assert.match(e.message, re, what); return; } assert.fail(what + ': expected a refusal'); };

// nothing is asked until you ask
{
  const L = library(), A = makeApp({ fetch: L.fetch });
  A.packsSettingsHtml(); A.packLibHtml(); A.packsImportHtml(); A.paletteItems(''); A.render(); await flush();
  assert.deepEqual(L.calls, [], 'opening Settings, the palette or the New section dialog contacts nobody');
  const html = A.packsSettingsHtml(); assert.ok(html.includes('id="pkl-code"') && html.includes('data-m="pklib"') && html.includes('Pack library'), 'Settings has the code box and Browse');
  assert.ok(A.paletteItems('pack').some(i => /by code/.test(i.label)) && A.paletteItems('pack').some(i => /library/.test(i.label)), 'the palette has both commands');
}

// the index: clean rows only
{
  const A = makeApp(), good = { code: 'k7qm 3xrd', id: 'study-planner', file: 'packs/study-planner.json', name: '  Study\u0000 planner ', version: '1.0.0', author: 'A', description: 'd'.repeat(500), license: 'CC0-1.0', sections: 1.9, themes: -4, entries: 'x', tags: ['Study', ' ', 'x'.repeat(50), 1, 2, 3, 4, 5, 6, 7], size: 10, sha256: 'A'.repeat(64), updated: '2026-11-18' };
  const r = A.pkIndexClean({ opentick: 'pack-index', format: 1, updated: '2026-11-19T10:00:00Z', packs: [good, { ...good, id: 'dup', file: 'packs/dup.json' }, { ...good, code: 'ZZZZ-ZZZZ', file: 'packs/other.json' }, { ...good, code: 'ABCD-EFGH', id: '../x', file: 'packs/../x.json' }, { ...good, code: 'AAAA-AAAA', id: 'Bad_Id', file: 'packs/Bad_Id.json' }, { ...good, code: 'BBBB-BBBB', id: 'ok-two', file: 'https://evil.example/x.json' }, { ...good, code: 'nope', id: 'ok-three', file: 'packs/ok-three.json' }, null, 'x', 7, { ...good, code: 'CCCC-CCCC', id: 'ok-four', file: 'packs/ok-four.json', sha256: 'nothex' }]});
  assert.deepEqual(J(r.packs.map(p => p.id)), ['study-planner', 'ok-four'], 'a duplicate code, a file that is not packs/<id>.json, a bad id, a bad code and junk rows are dropped'); assert.equal(r.skipped, 9);
  const p = r.packs[0]; assert.equal(p.code, 'K7QM-3XRD', 'the code is normalised'); assert.equal(p.name, 'Study planner'); assert.equal(p.description.length, 300); assert.equal(p.sections, 1); assert.equal(p.themes, 0); assert.equal(p.entries, 0);
  assert.equal(p.tags.length, 6); assert.ok(p.tags.every(t => t === t.toLowerCase() && t.length <= 24)); assert.equal(p.sha, '', 'an upper-case hash is not a hash'); assert.equal(r.packs[1].sha, '');
  assert.equal(r.updated, '2026-11-19');
  for (const bad of [null, [], 'x', {}, { opentick: 'marketplace', format: 1, packs: [] }, { opentick: 'pack-index', packs: [] }, { opentick: 'pack-index', format: 0, packs: [] }]) assert.throws(() => A.pkIndexClean(bad), e => e.pk, 'not an index: ' + JSON.stringify(bad));
  assert.throws(() => A.pkIndexClean({ opentick: 'pack-index', format: 2, packs: [] }), /update OpenTick/, 'a newer format is refused politely');
  assert.deepEqual(J(A.pkIndexClean({ opentick: 'pack-index', format: 1 }).packs), [], 'no packs is fine');
  // rows are shown as text
  const html = A.pkRowHtml({ ...r.packs[0], name: '<img src=x onerror=alert(1)>', author: '"><script>x</script>', description: '<b>hi</b>', tags: [], code: 'K7QM-3XRD' });
  assert.ok(!/<img|<script/.test(html) && !html.includes('<b>hi</b>') && html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'a pack can not put markup on the screen: ' + html);
}

// asking: the index, errors, the cache
{
  const L = library(), A = makeApp({ fetch: L.fetch });
  const idx = await A.pkIndex(); assert.equal(idx.packs.length, files.length); assert.deepEqual(L.calls, ['https://jebbycodes.github.io/OpenTick-Packs/index.json']);
  await A.pkIndex(); assert.equal(L.calls.length, 1, 'a second look within ten minutes uses what it has'); await A.pkIndex(true); assert.equal(L.calls.length, 2, 'Refresh asks again');
  clock.t += 11 * 60 * 1000; await A.pkIndex(); assert.equal(L.calls.length, 3, 'after ten minutes it asks again');
  const fresh = () => { const l = library(), a = makeApp({ fetch: l.fetch }); return [l, a]; };
  { const [l, a] = fresh(); l.fail = 'offline'; await rejects(a.pkIndex(), /Could not reach the pack library/, 'offline'); }
  { const [l, a] = fresh(); l.fail = 404; await rejects(a.pkIndex(), /not in the library/, '404'); }
  { const [l, a] = fresh(); l.fail = 429; await rejects(a.pkIndex(), /limiting requests/, 'rate limit'); }
  { const [l, a] = fresh(); l.fail = 503; await rejects(a.pkIndex(), /answered 503/, '503'); }
  { const [l, a] = fresh(); l.indexText = '<html>not json'; await rejects(a.pkIndex(), /not a pack index/, 'not JSON'); }
  { const [l, a] = fresh(); l.indexText = JSON.stringify({ opentick: 'pack-index', format: 1, packs: [], pad: 'x'.repeat(2.1 * 1024 * 1024) }); await rejects(a.pkIndex(), /larger than a pack/, 'a huge index'); }
  { const [l, a] = fresh(); l.index = { opentick: 'pack-index', format: 9, packs: [] }; await rejects(a.pkIndex(), /newer format/, 'newer format'); }
  { const [l, a] = fresh(); await a.pkIndex(); l.fail = 'offline'; assert.ok((await a.pkIndex()).packs.length, 'a copy that is still fresh keeps working offline'); }
}

// finding a code (a miss looks once more when the copy is old)
{
  const L = library(), A = makeApp({ fetch: L.fetch }), sp = L.rows.find(r => r.id === 'study-planner');
  assert.equal((await A.pkFind(sp.code)).id, 'study-planner'); assert.equal(await A.pkFind('ZZZZ-ZZZZ'), null); assert.equal(L.calls.length, 1, 'a miss in a fresh copy does not ask again');
  L.rows.push({ ...sp, id: 'brand-new', code: 'NEW1-C0DE', file: 'packs/brand-new.json' }); clock.t += 60 * 1000;
  assert.equal((await A.pkFind('NEW1-C0DE')).id, 'brand-new', 'a pack published a minute ago is found: the old copy is replaced'); assert.equal(L.calls.length, 2);
}

// the pack file: size, hash, id, content
{
  const mk = () => { const L = library(), A = makeApp({ fetch: L.fetch }); return [L, A, L.rows.find(r => r.id === 'study-planner')]; };
  { const [L, A, row] = mk(); const e = (await A.pkIndex()).packs.find(p => p.id === row.id); const r = await A.pkFetchPack(e); assert.equal(r.pack.id, 'study-planner'); assert.equal(r.warnings.length, 0); assert.equal(r.entry.code, row.code); }
  { const [L, A, row] = mk(); const e = (await A.pkIndex()).packs.find(p => p.id === row.id); L.served[row.file] = L.served[row.file].replace('Study planner', 'Evil planner'); await rejects(A.pkFetchPack(e), /does not match the library/, 'a file that is not the one in the index'); }
  { const [L, A, row] = mk(); // updated just now: the cached index is stale, the library's new index lists the new file
    const e = (await A.pkIndex()).packs.find(p => p.id === row.id), j = JSON.parse(L.served[row.file]); j.version = '1.0.1'; const text = JSON.stringify(j, null, 2); L.served[row.file] = text; L.rows.find(r => r.id === row.id).sha256 = sha(text); L.rows.find(r => r.id === row.id).version = '1.0.1';
    const r = await A.pkFetchPack(e); assert.equal(r.pack.version, '1.0.1', 'one fresh look at the index, then the new file is accepted'); assert.equal(r.entry.version, '1.0.1'); }
  { const [L, A, row] = mk(); const e = (await A.pkIndex()).packs.find(p => p.id === row.id); const bytes = L.served[row.file]; L.served[row.file] = bytes + ' '; const before = L.calls.length; await rejects(A.pkFetchPack(e), /does not match/, 'the index never catches up'); assert.ok(L.calls.length - before <= 3, 'it looks again once, not forever'); }
  { const [L, A, row] = mk(); const e = { ...(await A.pkIndex()).packs.find(p => p.id === row.id), sha: '' }; L.served[row.file] = L.served[row.file].replace('"id": "study-planner"', '"id": "someone-else"'); await rejects(A.pkFetchPack(e), /not the pack the library lists/, 'an id that differs'); }
  { const [L, A, row] = mk(); const e = { ...(await A.pkIndex()).packs.find(p => p.id === row.id), sha: '' }; L.served[row.file] = 'x'.repeat(A.PACK_MAX_BYTES + 1); await rejects(A.pkFetchPack(e), /larger than a pack/, 'an oversize file'); }
  { const [L, A, row] = mk(); const e = { ...(await A.pkIndex()).packs.find(p => p.id === row.id), sha: '' }; L.served[row.file] = '<html>404</html>'; await rejects(A.pkFetchPack(e), /could not be read/, 'not a pack'); }
  { const [L, A, row] = mk(); const e = { ...(await A.pkIndex()).packs.find(p => p.id === row.id), sha: '' }; const j = JSON.parse(L.served[row.file]); j.sections[0].fields[0].type = 'hologram'; L.served[row.file] = JSON.stringify(j); const r = await A.pkFetchPack(e); assert.ok(r.warnings.length, 'what the app has to change is reported, the same as for a file'); }
  { const [L, A, row] = mk(); const e = (await A.pkIndex()).packs.find(p => p.id === row.id); delete L.served[row.file]; await rejects(A.pkFetchPack(e), /not in the library/, 'a pack taken out of the library'); }
}

// what is shown, what is installed, "Installed" and updates
{
  const L = library(), A = makeApp({ fetch: L.fetch }), { S } = A, rows = (await A.pkIndex()).packs, sp = rows.find(r => r.id === 'study-planner'), ct = rows.find(r => r.id === 'calm-themes');
  assert.equal(A.pkInstalled(sp), null); assert.equal(A.pkInstalled(ct), null);
  const r = await A.pkFetchPack(sp), n0 = S.csections.length; A.packInstall(r.pack);
  assert.equal(S.csections.length, n0 + 1); assert.deepEqual(J(A.pkInstalled(sp)), { ver: '1.0.0', newer: false }); assert.ok(A.pkRowHtml(sp).includes('Installed'));
  assert.equal(A.pkInstalled({ ...sp, version: '1.1.0' }).newer, true, 'a newer version in the library is noticed'); assert.ok(A.pkRowHtml({ ...sp, version: '1.1.0' }).includes('Update 1.1.0'));
  A.packInstall((await A.pkFetchPack(ct)).pack); assert.equal(A.pkInstalled(ct).ver, '1.0.0', 'a themes-only pack is remembered on this device');
  // the search and the filters
  const all = J(rows), m = (q, kind = 'all', tag = '') => all.filter(p => A.pkMatches(p, { q, kind, tag })).map(p => p.id);
  assert.deepEqual(m(''), all.map(p => p.id)); assert.deepEqual(m('planner'), ['study-planner']); assert.deepEqual(m('STUDY PLANNER'), ['study-planner'], 'case does not matter, all the words must match'); assert.deepEqual(m('planner garden'), []);
  assert.deepEqual(m(sp.code.toLowerCase().replace('-', ' ')), ['study-planner'], 'a code in the search box finds its pack'); assert.deepEqual(m('', 'themes'), ['calm-themes']); assert.ok(!m('', 'sections').includes('calm-themes')); assert.equal(m('', 'all', 'nothing').length, 0); assert.equal(m('', 'all', 'study').length, all.length);
}

// the dialogs, end to end (the harness keeps what the modal was given)
{
  const L = library(), A = makeApp({ fetch: L.fetch }), { S, els } = A, sp = L.rows.find(r => r.id === 'study-planner'), modal = () => els['#modal'] || (els['#modal'] = {});
  const click = (m, extra = {}) => modal().onclick({ target: { closest: s => (s === '[data-m]' ? { dataset: { m } } : null), classList: { contains: () => false } }, ...extra });
  A.packCodeOpen(sp.code.toLowerCase()); await flush(); await flush(); await flush();
  const html = modal().innerHTML; assert.ok(html.includes('Study planner') && html.includes(sp.code) && html.includes('Add to OpenTick'), 'a code that is given is looked up and the pack is shown before anything is added: ' + html.slice(0, 200));
  assert.equal(S.csections.length, 0, 'nothing is added until you say so'); const wasCalls = L.calls.slice();
  assert.ok(wasCalls[0].endsWith('index.json') && wasCalls[1].endsWith('packs/study-planner.json'), wasCalls.join(' '));
  click('ok'); assert.equal(S.csections.length, 1); assert.equal(S.csections[0].packId, 'study-planner');
  // an unknown code stays in the dialog with a message
  A.packCodeOpen('ZZZZ-ZZZZ'); await flush(); await flush(); await flush();
  // a pasted code in "Paste a pack" is treated as a code, and pasted JSON as a pack
  const calls0 = L.calls.length; A.packOpenText('  ' + sp.code + ' '); await flush(); await flush(); await flush(); assert.ok(L.calls.length > calls0, 'a pasted code is looked up'); assert.ok(modal().innerHTML.includes('Study planner'));
  const calls1 = L.calls.length; A.packOpenText(read('study-planner.json')); assert.equal(L.calls.length, calls1, 'pasted pack text is read here and goes nowhere'); assert.ok(modal().innerHTML.includes('Add to OpenTick'));
  // the browser opens, lists the packs and a row opens a pack
  A.packLibraryOpen(); await flush(); await flush(); assert.ok(modal().innerHTML.includes('pkl-q'));
  assert.doesNotThrow(() => A.packLibraryOpen(), 'opening it twice is fine');
  // the Settings block
  const calls2 = L.calls.length, opened = []; A.win.open = u => opened.push(u);
  assert.equal(A.packLibAct('pksite', {}, {}, () => {}), true); assert.equal(A.packLibAct('pkmake', {}, {}, () => {}), true); assert.deepEqual(opened, ['https://jebbycodes.github.io/OpenTick-Packs/', 'https://github.com/JebbyCodes/OpenTick-Packs/blob/main/CONTRIBUTING.md']); assert.equal(A.packLibAct('nonsense', {}, {}, () => {}), false); assert.equal(L.calls.length, calls2);
}

console.log('pack tests passed (samples, codes, index, library client)');
