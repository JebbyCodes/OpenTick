// Pack usage counts (0.9.1, Part H): the opt-in, anonymous "this pack was really used" count (src/js/packstats.js).
// Covers: OFF by default (no state, no token, no request); what counts as use (a library pack's entry saved or ticked, an action run, one of its themes picked) and what
// never does (a pack from a file, a removed or switched-off pack, adding a pack, downloading it); the request is exactly { pack, token } and nothing else; once per pack
// per device; retries keep the SAME token and back off; permanent refusals are dropped; turning it off drops what waits; nothing here is synced; the address the library
// publishes is checked; the Settings text.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeApp, clock } from './harness.mjs';

const fx = n => readFileSync(new URL(`./fixtures/packs/${n}.json`, import.meta.url), 'utf8');
const USAGE = 'https://opentick-usage.example.workers.dev';
const J = o => JSON.parse(JSON.stringify(o)), q = JSON.stringify;
const dev = () => {
  const A = makeApp({ store: {} }); A.calls = []; A.reply = () => 204;
  A.__run('globalThis.__net = []');
  A.__run(`httpx = async (method, url, headers, body) => { __net.push({ method, url, headers, body }); const s = __reply(); if (s === 0) throw new Error('offline'); return { status: s, ok: s >= 200 && s < 300 }; }`);
  A.__run('globalThis.__reply = () => 204');
  A.net = () => J(A.__run('__net')); A.setReply = s => A.__run(`globalThis.__reply = () => ${s}`); A.clear = () => A.__run('__net.length = 0');
  return A;
};
const run = (A, code) => J(A.__run(code));
const install = (A, name, src = { kind: 'library', code: 'ABCD-EFGH', sha256: 'a'.repeat(64), size: 10 }) => { const r = A.packParse(fx(name)); A.packInstall(r.pack, src); return r.pack; };
const settle = () => new Promise(r => setTimeout(r, 15));
const on = A => { A.__run('pkstSetOn(true)'); A.__run(`pkstLearn(${q(USAGE)})`); A.clear(); };
const sec = (A, packId) => A.S.csections.find(s => s.packId === packId);

/* ---------- 1. off by default: nothing stored, nothing made, nothing sent ---------- */
{
  const A = dev(); const pack = install(A, 'garden-journal'), s = sec(A, pack.id);
  assert.equal(A.S.settings.packStats, undefined, 'no state until the person chooses');
  assert.equal(run(A, 'pkstOn()'), false);
  A.__run(`pkstSection(xsById(${q(s.id)}))`); A.__run('pkstTheme("x")'); await settle();
  assert.deepEqual(A.net(), [], 'nothing is sent while it is off');
  assert.equal(A.S.settings.packStats, undefined, 'using a pack while it is off remembers nothing about it');
  A.__run(`pkstLearn(${q(USAGE)})`); assert.equal(A.S.settings.packStats, undefined, 'off: not even the library address is kept');
  assert.match(A.__run('pkstSettingsHtml()'), /Counting is off/); assert.match(A.__run('pkstSettingsHtml()'), /Nothing is sent/);
  assert.match(A.packsSettingsHtml(), /Pack usage counts/, 'it is in Settings > Sections & packs');
}

/* ---------- 2. the request: exactly { pack, token }, once per pack per device ---------- */
{
  const A = dev(); const pack = install(A, 'garden-journal'), s = sec(A, pack.id); on(A);
  const e = { id: 'e1', sid: s.id, title: 'My secret tomatoes', notes: 'private text', vals: {}, done: false };
  A.S.centries.push(e);
  A.__run(`pkstSection(xsById(${q(s.id)}))`); await settle();
  const n = A.net(); assert.equal(n.length, 1, 'one request');
  assert.equal(n[0].method, 'POST'); assert.equal(n[0].url, USAGE + '/use');
  assert.deepEqual(Object.keys(n[0].headers), ['Content-Type'], 'no cookie, no authorisation, no identifier header');
  const body = JSON.parse(n[0].body); assert.deepEqual(Object.keys(body).sort(), ['pack', 'token'], 'only the pack and the token');
  assert.equal(body.pack, pack.id); assert.match(body.token, /^[0-9a-f]{32}$/);
  for (const secret of ['tomatoes', 'private', 'Garden', 'garden-journal-x', A.S.settings.theme]) if (secret !== body.pack) assert.ok(!n[0].body.includes(secret), 'nothing from the entries or settings is in the request: ' + secret);
  const st = run(A, 'S.settings.packStats'); assert.deepEqual(st.pend, {}, 'the token is deleted once the count is received'); assert.ok(st.done[pack.id] > 0, 'and the pack is marked as counted');
  assert.ok(!JSON.stringify(st).includes(body.token), 'the token is not kept anywhere after the count is received');
  A.clear(); A.__run(`pkstSection(xsById(${q(s.id)}))`); A.__run(`pkstSection(xsById(${q(s.id)}))`); await settle();
  assert.deepEqual(A.net(), [], 'a pack is counted once on this device');
  // a second pack: its own token
  const p2 = install(A, 'study-planner'), s2 = sec(A, p2.id); A.__run(`pkstSection(xsById(${q(s2.id)}))`); await settle();
  const m = A.net(); assert.equal(m.length, 1); assert.notEqual(JSON.parse(m[0].body).token, body.token, 'a different pack never shares a token'); assert.equal(JSON.parse(m[0].body).pack, p2.id);
}

/* ---------- 3. what is not use ---------- */
{
  const A = dev(); on(A);
  const file = install(A, 'garden-journal', { kind: 'file' }), sf = sec(A, file.id);
  A.__run(`pkstSection(xsById(${q(sf.id)}))`); await settle(); assert.deepEqual(A.net(), [], 'a pack from a file is never counted (it may be a changed copy)');
  assert.equal(run(A, 'S.settings.packStats.pend') && Object.keys(run(A, 'S.settings.packStats.pend')).length, 0);
  const lib = install(A, 'home-maintenance'), sl = sec(A, lib.id);
  assert.deepEqual(A.net(), [], 'adding a pack is not use'); // (installing already happened above with counting on)
  A.__run(`pksSetState(${q(lib.id)}, 'disabled')`); A.__run(`pkstSection(xsById(${q(sl.id)}))`); await settle(); assert.deepEqual(A.net(), [], 'a switched-off pack is not counted');
  A.__run(`pksSetState(${q(lib.id)}, 'removed')`); A.__run(`pkstSection(xsById(${q(sl.id)}))`); await settle(); assert.deepEqual(A.net(), [], 'a removed pack is not counted');
  A.__run(`pksSetState(${q(lib.id)}, 'installed')`); A.__run(`pkstSection(xsById(${q(sl.id)}))`); await settle(); assert.equal(A.net().length, 1, 'switched back on: the first real use counts');
  A.clear(); A.__run('pkstSection(null)'); A.__run('pkstSection({})'); A.__run('pkstUse("")'); A.__run('pkstUse("no-such-pack")'); A.__run('pkstUse(7)'); await settle();
  assert.deepEqual(A.net(), [], 'a section that is not a pack\'s, and a pack that is not installed, are not counted');
}

/* ---------- 4. the other kinds of use: a tick, an action's result, a theme ---------- */
{
  const A = dev(); on(A); const pack = install(A, 'study-planner'), s = sec(A, pack.id);
  const e = A.S.centries.find(x => x.sid === s.id) || (() => { const x = { id: 'e9', sid: s.id, title: 't', vals: {}, notes: '', done: false, contactIds: [], created: 1 }; A.S.centries.push(x); return x; })();
  A.__run(`XS_ACT.xsdone({ dataset: { id: ${q(e.id)} } })`); await settle();
  assert.equal(A.net().length, 1, 'ticking an entry of a pack\'s section is use'); assert.equal(JSON.parse(A.net()[0].body).pack, pack.id);
  const B = dev(); on(B); const ct = install(B, 'calm-themes'); const names = ct.themes.map(t => t.name);
  assert.ok(names.length, 'the fixture has themes'); const th = run(B, 'S.settings.customThemes').find(c => c.name === names[0]); assert.ok(th, 'the pack\'s theme was added');
  B.__run('pkstTheme("gruvbox-dark")'); await settle(); assert.deepEqual(B.net(), [], 'a built-in theme is nobody\'s pack');
  B.__run(`pkstTheme(${q(th.id)})`); await settle(); assert.equal(B.net().length, 1, 'picking a pack\'s theme is use'); assert.equal(JSON.parse(B.net()[0].body).pack, ct.id);
  // a theme the person made themselves, and a theme from a pack that came from a file, are nobody's library pack
  const C = dev(); on(C); C.__run(`themeImport(${q(JSON.stringify({ name: 'My own', base: 'gruvbox-dark', vars: {} }))}, 'My own', false)`);
  const mine = run(C, 'S.settings.customThemes').find(c => c.name === 'My own'); assert.ok(mine, 'a theme of their own');
  C.__run(`pkstTheme(${q(mine.id)})`); await settle(); assert.deepEqual(C.net(), [], 'a theme the person made is not counted');
  const f = install(C, 'calm-themes', { kind: 'file' }); const ft = run(C, 'S.settings.customThemes').find(c => c.name === f.themes[0].name);
  C.__run(`pkstTheme(${q(ft.id)})`); await settle(); assert.deepEqual(C.net(), [], 'a theme from a pack that came from a file is not counted');
}

/* ---------- 5. failures: the same token is kept, retries back off, refusals are dropped ---------- */
{
  const A = dev(); const pack = install(A, 'garden-journal'), s = sec(A, pack.id); on(A);
  for (const status of [500, 429, 503, 0]) {
    A.clear(); A.setReply(status); A.__run('clearTimeout(PKST.timer)');
    if (status === 500) { A.__run(`pkstSection(xsById(${q(s.id)}))`); } else { A.__run('Object.values(S.settings.packStats.pend).forEach(p => p.next = 0)'); A.__run('pkstFlush()'); }
    await settle(); await settle();
    assert.equal(A.net().length, 1, 'tried once for ' + status);
    const st = run(A, 'S.settings.packStats'); assert.ok(st.pend[pack.id], 'a count that could not be sent is kept (' + status + ')'); assert.equal(st.done[pack.id], undefined, 'and is not marked as counted');
    assert.ok(st.pend[pack.id].next > clock.t, 'and is not retried at once'); assert.equal(st.pend[pack.id].n, status === 500 ? 1 : st.pend[pack.id].n);
  }
  const tok = JSON.parse(A.net()[0].body).token, p1 = run(A, 'S.settings.packStats.pend')[pack.id];
  assert.equal(p1.t, tok, 'the token is the same on every retry'); assert.equal(p1.n, 4);
  // not due yet: a use or a restart sends nothing
  A.clear(); A.setReply(204); A.__run(`pkstSection(xsById(${q(s.id)}))`); A.__run('pkstFlush()'); await settle(); assert.deepEqual(A.net(), [], 'waiting for its time');
  clock.t += 7 * 3600e3; A.__run('pkstFlush()'); await settle();
  assert.equal(A.net().length, 1); assert.equal(JSON.parse(A.net()[0].body).token, tok, 'finally sent, with the very same token');
  assert.deepEqual(run(A, 'S.settings.packStats.pend'), {}); assert.ok(run(A, 'S.settings.packStats.done')[pack.id]);
  for (const bad of [400, 404, 413, 422]) {
    const B = dev(); const p = install(B, 'garden-journal'), sb = sec(B, p.id); on(B); B.setReply(bad); B.__run(`pkstSection(xsById(${q(sb.id)}))`); await settle();
    assert.equal(B.net().length, 1); assert.deepEqual(run(B, 'S.settings.packStats.pend'), {}, `${bad}: the service will never take it, so it is dropped, not retried for ever`);
    B.clear(); B.__run(`pkstSection(xsById(${q(sb.id)}))`); await settle(); assert.deepEqual(B.net(), [], 'and not tried again');
  }
}

/* ---------- 5b. no random source: no count, never a weak token ---------- */
{
  const A = dev(); const pack = install(A, 'garden-journal'), s = sec(A, pack.id); on(A);
  A.__run('globalThis.__crypto = globalThis.crypto; globalThis.crypto = { getRandomValues() { throw new Error("none") } }');
  assert.equal(A.__run('pkstToken()'), '', 'no random source, no token');
  A.__run(`pkstSection(xsById(${q(s.id)}))`); await settle(); assert.deepEqual(A.net(), [], 'nothing is sent without a proper random token'); assert.deepEqual(run(A, 'S.settings.packStats.pend'), {});
}

/* ---------- 6. no address, no request; the address is learned only from the library and only while on ---------- */
{
  const A = dev(); const pack = install(A, 'garden-journal'), s = sec(A, pack.id); A.__run('pkstSetOn(true)'); A.clear();
  A.__run(`pkstSection(xsById(${q(s.id)}))`); await settle();
  assert.deepEqual(A.net(), [], 'the library has published no address: nothing is sent');
  assert.ok(run(A, 'S.settings.packStats.pend')[pack.id], 'the count waits on this device'); assert.match(A.__run('pkstSettingsHtml()'), /1 count waiting/); assert.match(A.__run('pkstSettingsHtml()'), /has not published one/);
  A.__run(`pkstLearn(${q(USAGE)})`); A.__run('pkstFlush()'); await settle(); assert.equal(A.net().length, 1, 'the address arrives: it is sent'); assert.equal(A.net()[0].url, USAGE + '/use');
  assert.match(A.__run('pkstSettingsHtml()'), /opentick-usage\.example\.workers\.dev/, 'Settings shows where counts go');
  const ok = u => run(A, `pkstUrlOk(${q(u)})`);
  assert.equal(ok('https://a.example/x/'), 'https://a.example/x'); assert.equal(ok('https://a.example'), 'https://a.example');
  for (const bad of ['http://a.example', 'https://user:pw@a.example', 'https://a.example/?k=v', 'https://a.example/#x', 'ftp://a.example', 'javascript:alert(1)', 'https://localhost', '//a.example', '', null, 7, {}, 'https://' + 'a'.repeat(250) + '.example'])
    assert.equal(ok(bad), '', 'not accepted as the usage address: ' + String(bad).slice(0, 40));
  const ix = good => A.pkIndexClean({ opentick: 'pack-index', format: 1, updated: '2026-11-19', packs: [], ...(good === undefined ? {} : { usage: good }) });
  assert.equal(ix(USAGE).usage, USAGE); assert.equal(ix().usage, '', 'an index without an address'); assert.equal(ix('http://insecure.example').usage, '', 'an unsafe address in the index is ignored');
  A.__run(`pkstLearn('')`); assert.equal(run(A, 'S.settings.packStats.url'), '', 'a library that stops publishing an address is believed');
}

/* ---------- 7. off: what waits is dropped, nothing more is sent, nothing is remembered but the "already counted" marks ---------- */
{
  const A = dev(); const pack = install(A, 'garden-journal'), s = sec(A, pack.id); A.__run('pkstSetOn(true)'); A.clear();
  A.__run(`pkstSection(xsById(${q(s.id)}))`); assert.ok(run(A, 'S.settings.packStats.pend')[pack.id], 'waiting (no address yet)');
  A.__run(`pkstLearn(${q(USAGE)})`); A.__run('pkstSetOn(false)'); assert.equal(run(A, 'pkstOn()'), false);
  const st = run(A, 'S.settings.packStats'); assert.deepEqual(st.pend, {}, 'turned off: the waiting count is dropped'); assert.equal(st.url, '', 'and the address is forgotten');
  A.__run(`pkstLearn(${q(USAGE)})`); A.__run('pkstFlush()'); A.__run(`pkstSection(xsById(${q(s.id)}))`); await settle(); assert.deepEqual(A.net(), [], 'nothing is sent after it was turned off');
  assert.ok(!JSON.stringify(run(A, 'S.settings.packStats')).match(/[0-9a-f]{32}/), 'no token is left on the device');
  // a request that is in flight when it is turned off: the answer changes nothing and nothing new is kept
  const B = dev(); const p = install(B, 'garden-journal'), sb = sec(B, p.id); on(B);
  B.__run(`httpx = async () => { pkstSetOn(false); return { status: 204 }; }`); B.__run(`pkstSection(xsById(${q(sb.id)}))`); await settle();
  assert.deepEqual(run(B, 'S.settings.packStats.pend'), {}); assert.equal(run(B, 'S.settings.packStats.done')[p.id], undefined, 'turned off during the request: nothing is recorded');
  // on again: a pack counted before is not counted twice; a new one is
  const C = dev(); const p1 = install(C, 'garden-journal'), s1 = sec(C, p1.id); on(C); C.__run(`pkstSection(xsById(${q(s1.id)}))`); await settle(); assert.equal(C.net().length, 1);
  C.__run('pkstSetOn(false)'); C.__run('pkstSetOn(true)'); C.__run(`pkstLearn(${q(USAGE)})`); C.clear(); C.__run(`pkstSection(xsById(${q(s1.id)}))`); await settle(); assert.deepEqual(C.net(), [], 'turning it off and on does not count the same pack twice');
}

/* ---------- 8. never synced, never in a sync payload ---------- */
{
  const A = dev(); const pack = install(A, 'garden-journal'), s = sec(A, pack.id); on(A);
  A.setReply(500); A.__run(`pkstSection(xsById(${q(s.id)}))`); await settle();
  const tok = run(A, 'S.settings.packStats.pend')[pack.id].t; assert.match(tok, /^[0-9a-f]{32}$/);
  assert.ok(!('packStats' in run(A, 'PREF_SYNC')), 'packStats is not in the list of preferences that sync');
  const payload = JSON.stringify(A.buildPayload()); assert.ok(!payload.includes(tok), 'the token is not in what sync uploads'); assert.ok(!payload.includes('packStats'), 'nor is the setting');
  assert.ok(!JSON.stringify(run(A, 'S.prefs || null')).includes('packStats'));
  // a damaged stored value never breaks anything
  for (const junk of [null, 7, 'x', [], { on: 'yes' }, { on: true, pend: [], done: 5, url: 3 }]) { A.S.settings.packStats = junk; A.__run('pkstUse("garden-journal")'); A.__run('pkstSettingsHtml()'); }
}

/* ---------- 9. the text ---------- */
{
  const A = dev(); const h0 = A.__run('pkstSettingsHtml()');
  for (const t of [/off<\/b> unless you turn it on/, /Exactly what is sent/, /Never sent/, /random code/, /IP address/, /a pack from a file is never counted/]) assert.match(h0, t);
  assert.match(h0, /data-m="pkstog"/); assert.match(h0, /Turn on/);
  let said = ''; A.__run('globalThis.__said = []'); A.__run('toast = m => __said.push(m)');
  A.__run(`pkstAct('pkstog', null, null, null)`); assert.equal(run(A, 'pkstOn()'), true); assert.match(A.__run('pkstSettingsHtml()'), /Counting is on/); assert.match(A.__run('pkstSettingsHtml()'), /Turn off/);
  A.__run(`pkstAct('pkstog', null, null, null)`); assert.equal(run(A, 'pkstOn()'), false); assert.deepEqual(run(A, '__said').map(x => /on/.test(x) ? 'on' : 'off'), ['on', 'off']);
  assert.equal(A.__run(`pkstAct('something-else')`), false);
}
console.log('packstats: ok');
