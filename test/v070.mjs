// 0.7.0: pinned views, a custom notification sound, an opt-in update check. Each of them is a setting (device-local) or a sealed file:
// none of it enters the sync file, and everything is sealed when device encryption is on.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const eq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), m);
const PASS = 'correct horse battery staple';
// a stand-in for the thing under a right-click: closest(selector) answers for the selectors the code asks about
const fake = (hit, dataset = {}) => ({ dataset, closest: s => (s === hit ? { dataset } : null) });

const base0 = () => ({ tasks: [], lists: [], tags: [], habits: [], slots: [], notes: [], projects: [], school: [], templates: [], countdowns: [], zones: [], boards: [], pomo: [], tomb: {} });
/* ============ 1. pinned views ============ */
{
  const A = makeApp(), { S, U } = A;
  eq(S.settings.ui.pins, [], 'nothing is pinned to begin with');
  // what a key stands for
  assert.equal(A.pinInfo('page:kanban').label, 'Board');
  assert.equal(A.pinInfo('page:matrix').label, 'Matrix');
  assert.equal(A.pinInfo('cal:week').label, 'Week');
  assert.equal(A.pinInfo('school').label, A.scName(), 'Classes keeps whatever name it was given');
  assert.ok(A.pinInfo('school:exam') || A.pinInfo('school:hw'), 'a page of Classes can be pinned');
  for (const bad of ['', null, 'page:', 'page:nope', 'page:home', 'page:calendar', 'page:timetable', 'cal:year', 'school:nope', 'PAGE:kanban', 'x', '../..']) assert.equal(A.pinInfo(bad), null, `"${bad}" means nothing`);

  // pinning, ordering, unpinning
  assert.equal(A.pinToggle('page:kanban'), true); assert.equal(A.pinToggle('school'), true); assert.equal(A.pinToggle('cal:week'), true);
  eq(S.settings.ui.pins, ['page:kanban', 'school', 'cal:week']);
  assert.equal(A.pinToggle('nonsense'), false); eq(S.settings.ui.pins, ['page:kanban', 'school', 'cal:week'], 'a key that means nothing is not added');
  A.pinMove('school', -1); eq(S.settings.ui.pins, ['school', 'page:kanban', 'cal:week']);
  A.pinMove('school', -1); eq(S.settings.ui.pins, ['school', 'page:kanban', 'cal:week'], 'the first cannot move up');
  A.pinMove('cal:week', 1); eq(S.settings.ui.pins, ['school', 'page:kanban', 'cal:week'], 'the last cannot move down');
  A.pinReorder('cal:week', 'school'); eq(S.settings.ui.pins, ['cal:week', 'school', 'page:kanban'], 'drag and drop puts it where it was dropped');
  assert.equal(A.pinToggle('school'), false); eq(S.settings.ui.pins, ['cal:week', 'page:kanban'], 'a second toggle unpins');

  // a limit, so the sidebar cannot be filled by accident
  for (const k of ['page:gantt', 'page:matrix', 'page:habits', 'page:focus', 'page:templates', 'page:countdowns', 'page:zones', 'cal:month']) A.pinToggle(k);
  assert.equal(S.settings.ui.pins.length, A.PIN_MAX, `at most ${A.PIN_MAX}`);
  assert.equal(A.pinToggle('cal:day'), false); assert.equal(S.settings.ui.pins.length, A.PIN_MAX, 'one more is refused');
  assert.ok(!S.settings.ui.pins.includes('cal:day'));
  S.settings.ui.pins = ['page:kanban', 'cal:week'];

  // the buttons: drawn in the sidebar and in the tab bar, one button lit at a time
  U.page = 'kanban';
  assert.equal(A.pinActive().key, 'page:kanban');
  assert.match(A.pinsHtml('side'), /class="pg pin on"[^>]*data-pin="page:kanban"/); assert.doesNotMatch(A.pinsHtml('side'), /data-pin="cal:week"[^>]*class="pg pin on"|class="pg pin on"[^>]*data-pin="cal:week"/);
  assert.match(A.pinsHtml('bar'), /<button class="pin on" data-act="pingo" data-pin="page:kanban">/);
  A.renderSide();
  assert.doesNotMatch(A.pinsHtml('side'), /<script/i);
  // a pin to the Calendar's week is lit on the week view, not on the month
  A.calGo('month'); assert.equal(A.pinActive(), null, 'the month view is not a pinned one');
  A.calGo('week'); assert.equal(A.pinActive().key, 'cal:week');
  // damaged or unknown entries are not shown (and do not throw)
  S.settings.ui.pins = ['page:kanban', 'page:gone', 7, null, 'cal:week']; assert.equal(A.pinsShown().length, 2); assert.doesNotThrow(() => { A.pinsHtml('side'); A.pinsHtml('bar'); A.pinSettingsHtml(); });
  S.settings.ui.pins = ['page:kanban', 'cal:week'];

  // the same key from a tab, a page title and the Classes tabs
  assert.equal(A.pinKeyOf(fake('.vtabs [role=tab]', { act: 'page', page: 'kanban' })), 'page:kanban');
  assert.equal(A.pinKeyOf(fake('.vtabs [role=tab]', { act: 'calview', v: 'agenda' })), 'cal:agenda');
  assert.equal(A.pinKeyOf(fake('.vtabs [role=tab]', { act: 'ttview', v: '3day' })), 'cal:3day');
  assert.equal(A.pinKeyOf(fake('.vtabs [role=tab]', { act: 'scmode' })), 'school');
  assert.equal(A.pinKeyOf(fake('.sc-tabs [data-act=sctab]', { t: 'exam' })), 'school:exam');
  assert.equal(A.pinKeyOf(fake('.vtabs [role=tab]', { act: 'somethingelse' })), null);
  assert.equal(A.pinKeyOf(fake('p')), null, 'ordinary text is not pinnable');
  U.page = 'kanban'; assert.equal(A.pinKeyOf(fake('header.top h1')), 'page:kanban', 'the title of a page pins that page');
  U.page = 'calendar'; assert.match(A.pinKeyOf(fake('header.top h1')), /^cal:/);
  U.page = 'inbox'; assert.equal(A.pinKeyOf(fake('header.top h1')), null, 'a list is not a view of its own');

  // the menu text: pin / unpin, and the pinned button's own menu
  S.settings.ui.pins = [];
  U.page = 'kanban'; let it = A.pinCtxItems(fake('header.top h1')); assert.equal(it.length, 1); assert.match(it[0].label, /^Pin “Board” to the (sidebar|tab bar)$/);
  A.pinToggle('page:kanban'); it = A.pinCtxItems(fake('header.top h1')); assert.equal(it[0].label, 'Unpin “Board”');
  A.pinToggle('cal:week');
  const own = k => ({ dataset: { pin: k }, closest: s => (s.includes('data-pin') ? { dataset: { pin: k } } : null) });
  it = A.pinCtxItems(own('page:kanban')); eq(it.filter(x => !x.sep).map(x => x.label), ['Open', 'Move later', 'Unpin “Board”']);
  it = A.pinCtxItems(own('cal:week')); eq(it.filter(x => !x.sep).map(x => x.label), ['Open', 'Move earlier', 'Unpin “Week”']);
  assert.equal(A.pinCtxItems(fake('p')), null, 'elsewhere the normal menus stay');
  // the shared context menu asks pins first, so a title never gets the menu of the thing behind it
  U.page = 'kanban'; assert.match(A.ctxItems(fake('header.top h1'))[0].label, /Pin|Unpin/);
  // going to a pin runs the view's own navigation
  A.pinGo('cal:day'); assert.equal(A.calMode(), 'day'); A.pinGo('page:matrix'); assert.equal(U.page, 'matrix');

  // old or damaged saved settings are cleaned up on load
  const base = () => ({ tasks: [], lists: [], tags: [], habits: [], slots: [], notes: [], projects: [], school: [], templates: [], countdowns: [], zones: [], boards: [], pomo: [], tomb: {} });
  const raw = A.migrate({ ...base(), settings: { ui: { pins: ['page:kanban', 'bogus', 'page:kanban', 'cal:week', 'SCHOOL', 'school', 'x'.repeat(40), 5, 'school:exam', 'page:a', 'page:b1', 'cal:month', 'page:gantt', 'page:matrix', 'page:habits', 'page:focus', 'page:zones', 'page:tasks'] } } });
  assert.ok(raw.settings.ui.pins.length <= 10); assert.equal(new Set(raw.settings.ui.pins).size, raw.settings.ui.pins.length, 'each once');
  assert.ok(raw.settings.ui.pins.every(k => /^(page:[a-z]{2,12}|cal:[a-z0-9]{2,8}|school(:[a-z]{2,8})?)$/.test(k)), 'only well-formed keys survive');
  eq(raw.settings.ui.pins.slice(0, 4), ['page:kanban', 'cal:week', 'school', 'school:exam']);
  eq(A.migrate({ ...base(), settings: { ui: { pins: 'nope' } } }).settings.ui.pins, [], 'not a list: empty');
  eq(A.migrate(base()).settings.ui.pins, [], 'an older save has none');
}

/* ============ 2. pins are device-local, and sealed with the rest when device encryption is on ============ */
const srv0 = await davServer();
{
  const srv = srv0, FILE = '/dav/OpenTick/opentick.json';
  const a = makeApp({ store: {}, indexedDB: fakeIndexedDB() });
  Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder: 'OpenTick', user: 'me', pass: 'secret' } });
  a.S.tasks.push(a.newTask({ title: 'something to sync' })); a.pinToggle('page:kanban'); a.pinToggle('cal:week'); a.save(); a.flush();
  assert.ok(!JSON.stringify(a.snapshot()).includes('page:kanban'), 'pins are not part of the data that syncs');
  await a.syncNow(true); assert.equal(a.Sync.state, 'ok', a.Sync.msg);
  const body = srv.files.get(FILE).body;
  assert.ok(!body.includes('page:kanban') && !body.includes('cal:week') && !body.includes('"pins"'), 'nothing about pins in the sync file');
  // with device encryption on, the saved settings are not readable in storage and come back after a restart
  const store = {}, indexedDB = fakeIndexedDB(), d = makeApp({ store, indexedDB });
  d.pinToggle('school'); d.pinToggle('page:gantt'); d.save(); d.flush();
  assert.ok(Object.values(store).join('\n').includes('page:gantt'), 'before: readable in storage');
  await d.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await d.vDrain();
  assert.ok(!Object.entries(store).map(([k, v]) => k + '=' + v).join('\n').includes('page:gantt'), 'after: sealed');
  const d2 = makeApp({ store, indexedDB }); await new Promise(r => setTimeout(r, 40)); await d2.vaultUnlockWith('p', PASS);
  eq(d2.S.settings.ui.pins, ['school', 'page:gantt'], 'the pins come back after unlocking');
}

/* ============ 3. a custom notification sound ============ */
// a stand-in for the browser's audio: a file whose bytes start with "BAD" cannot be decoded, and one byte is a millisecond of sound
const wait = (ms = 40) => new Promise(r => setTimeout(r, ms));
const idbText = a => [...a.indexedDB.kv.entries()].map(([k, v]) => k + '=' + JSON.stringify(v, (_, x) => (x instanceof Uint8Array ? 'u8:' + x.length : x))).join('\n');
const dev = prev => { const store = prev ? prev.store : {}, indexedDB = prev ? prev.indexedDB : fakeIndexedDB(), a = makeApp({ store, indexedDB }); a.store = store; a.indexedDB = indexedDB; return a; };
const BASE = () => ({ tasks: [], lists: [], tags: [], habits: [], slots: [], notes: [], projects: [], school: [], templates: [], countdowns: [], zones: [], boards: [], pomo: [], tomb: {} });
const audioMock = A => {
  const log = { started: [], osc: 0, gains: [] };
  const ctx = {
    state: 'running', currentTime: 0, destination: {},
    decodeAudioData: async ab => { const u = new Uint8Array(ab); if (u[0] === 66 && u[1] === 65 && u[2] === 68) throw new Error('EncodingError'); return { duration: u.length / 1000 }; },
    createGain: () => { const g = { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; log.gains.push(g); return g; },
    createBufferSource: () => { const x = { connect() {}, stop() { x.stopped = true; }, start() { log.started.push(x); } }; return x; },
    createOscillator: () => { log.osc++; return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; },
  };
  A.__mock('sfxCtx', () => ctx); A.SFX.master = { gain: { setValueAtTime() {} }, connect() {} };
  return log;
};
const snd = (n, tag = 'RIFF') => { const u = new Uint8Array(n); u.set([...tag].map(c => c.charCodeAt(0))); return u; };
const SNAME = 'SECRET-ding-4c1e.mp3', PASS2 = 'a different passphrase entirely';
const good = () => new File([snd(5000)], SNAME, { type: 'audio/mpeg' });
{
  const A = dev(), { S } = A, log = audioMock(A);
  assert.equal(S.settings.sound.custom, null, 'no custom sound to begin with');
  assert.match(A.csoundSettingsHtml(), /built-in chime/); assert.match(A.csoundSettingsHtml(), /data-csnd="pick"/);
  A.sfx('chime', true); assert.ok(log.osc > 0, 'nothing chosen: the built-in chime is synthesized'); assert.equal(log.started.length, 0);

  // choosing a sound
  const r = await A.csoundSet(good()); assert.equal(r.ok, true, r.error);
  eq(Object.keys(S.settings.sound.custom).sort(), ['at', 'name', 'size', 'type'], 'the settings keep a name and a size, no audio');
  assert.equal(S.settings.sound.custom.name, SNAME); assert.equal(S.settings.sound.custom.size, 5000);
  const rec = A.indexedDB.kv.get('sound:custom'); assert.ok(rec && rec.blob && rec.name === SNAME, 'stored in IndexedDB, under its own key');
  assert.ok(![...A.indexedDB.kv.keys()].some(k => /^file:/.test(k)), 'not among the attachments, so clearing unused attachments never touches it');
  // reminders, the timer and the test notification all use the chime cue, so all of them play it
  log.osc = 0; A.sfx('chime', true);
  assert.equal(log.started.length, 1, 'the chosen sound plays in place of the chime'); assert.equal(log.osc, 0, 'and the synthesized chime does not');
  assert.ok(Math.abs(log.gains.at(-1).gain.value - 0.7 ** 1.6) < 1e-9, 'at the volume setting');
  S.settings.sound.vol = 0.3; A.sfx('chime', true); assert.ok(Math.abs(log.gains.at(-1).gain.value - 0.3 ** 1.6) < 1e-9, 'a quieter setting is quieter'); S.settings.sound.vol = 0.7;
  const n0 = log.started.length; S.settings.sound.on = false; A.sfx('chime'); assert.equal(log.started.length, n0, 'sound effects off: silent'); S.settings.sound.on = true;
  A.sfx('chime', true); assert.equal(log.started.at(-2).stopped, true, 'a new reminder stops the one still playing');
  const n1 = log.started.length; log.osc = 0; A.sfx('done', true); assert.equal(log.started.length, n1, 'the other cues are not touched'); assert.ok(log.osc > 0);
  assert.ok(A.sfxDuration('chime') > 4.9 && A.sfxDuration('chime') < 5.2, 'the play button lasts as long as the sound');
  assert.ok(A.csoundSettingsHtml().includes(SNAME) && A.csoundSettingsHtml().includes('data-csnd="rm"'));

  // what is refused leaves the current choice alone
  for (const [file, re] of [
    [new File([], 'empty.mp3'), /empty/], [new File([new Uint8Array(A.CS_MAX + 1)], 'huge.wav'), /larger than 5 MB/],
    [new File([snd(4000, 'BAD')], 'notsound.mp3'), /could not be read as sound/], [new File([snd(31000)], 'long.wav'), /31 seconds long.*up to 30 seconds/], [null, /empty/],
  ]) { const bad = await A.csoundSet(file); assert.equal(bad.ok, false); assert.match(bad.error, re); assert.equal(S.settings.sound.custom.name, SNAME, 'the earlier sound is still the one in use'); }
  assert.equal((await A.csoundSet(new File([snd(30000)], 'thirty.wav'))).ok, true, 'exactly 30 seconds is allowed');
  assert.equal(A.indexedDB.kv.get('sound:custom').name, 'thirty.wav', 'choosing another replaces the stored file'); assert.equal([...A.indexedDB.kv.keys()].filter(k => /^sound:/.test(k)).length, 1);

  // settings that arrive without the file (a restored backup, another phone): the built-in chime, and the page says so
  await A.csoundRemove(); assert.equal(S.settings.sound.custom, null); assert.equal(A.indexedDB.kv.get('sound:custom'), undefined, 'removing deletes the file');
  S.settings.sound.custom = { name: 'from-elsewhere.mp3', type: 'audio/mpeg', size: 99, at: 1 }; A.CS.buf = null;
  assert.equal(await A.csoundLoad(true), false); log.osc = 0; const n2 = log.started.length; A.sfx('chime', true);
  assert.ok(log.osc > 0 && log.started.length === n2, 'no file here: the built-in chime');
  assert.equal(await A.csoundHave(), false); assert.match(A.csoundSettingsHtml(false), /not on this device/); assert.match(A.csoundSettingsHtml(false), /data-csnd="play" disabled/);
  await A.csoundRemove(); assert.equal(A.sfxDuration('chime') < 2, true, 'the built-in chime is short');

  // a damaged setting is cleaned up on load, and an older save has none
  eq(A.migrate({ ...BASE(), settings: { sound: { custom: 'nope' } } }).settings.sound.custom, null);
  eq(A.migrate({ ...BASE(), settings: { sound: { custom: { name: '' } } } }).settings.sound.custom, null);
  eq(A.migrate({ ...BASE(), settings: { sound: { custom: { name: 'x'.repeat(300), size: 'big', evil: '<script>', blob: 'AAAA' } } } }).settings.sound.custom, { name: 'x'.repeat(120), type: '', size: 0, at: 0 }, 'only a name, type, size and time are kept');
  eq(A.migrate(BASE()).settings.sound.custom, null);
  // clicking the buttons in Settings goes through csoundAction
  await A.csoundSet(good()); await A.csoundAction({ dataset: { csnd: 'rm' } }); assert.equal(S.settings.sound.custom, null);
  // "reset the settings" takes the sound with it, and "delete everything" alone leaves it
  await A.csoundSet(good()); await A.wipeAll({}); assert.equal(A.S.settings.sound.custom?.name, SNAME, 'deleting the data keeps the settings, and so the sound'); assert.ok(A.indexedDB.kv.get('sound:custom'));
  await A.wipeAll({ settings: true }); assert.equal(A.S.settings.sound.custom, null); assert.equal(A.indexedDB.kv.get('sound:custom'), undefined, 'a full reset removes the file as well');
}

/* ============ 4. the sound and encryption: sealed at rest, back after unlocking, never in the sync file ============ */
{
  const SCOPES = { local: true, backup: true, sync: true };
  const D = dev(); audioMock(D);
  await D.csoundSet(good());
  assert.ok(D.indexedDB.kv.get('sound:custom').blob, 'before: stored as it is');
  // not in what syncs, whatever the encryption setting
  assert.ok(!JSON.stringify(D.snapshot()).includes(SNAME), 'not in the data that syncs');
  assert.ok(!JSON.stringify(D.buildPayload ? D.buildPayload() : {}).includes(SNAME), 'not in the sync payload');
  await D.vaultEnable(PASS, SCOPES, {}); await D.vDrain();
  let raw = D.indexedDB.kv.get('sound:custom'); assert.equal(raw.enc, 1, 'sealed once device encryption is on'); assert.equal(raw.blob, undefined); assert.equal(raw.name, undefined, 'even the name is sealed');
  assert.ok(!idbText(D).includes(SNAME), 'nothing readable in IndexedDB'); assert.ok(!Object.entries(D.store).map(([k, v]) => k + '=' + v).join('\n').includes(SNAME), 'nor in local storage (the settings are sealed)');
  // a restart: locked, the file cannot be opened; unlocked, it plays
  const E = dev(D), logE = audioMock(E); await wait();
  assert.equal(E.Vault.locked, true); assert.equal(await E.csoundLoad(), false, 'locked');
  await E.vaultUnlockWith('p', PASS); await wait(50);
  assert.equal(E.S.settings.sound.custom.name, SNAME); assert.equal(await E.csoundLoad(true), true, 'unlocked: the sealed file opens'); E.sfx('chime', true); assert.equal(logE.started.length, 1);
  // a new passphrase does not touch the file; the new one opens it
  await E.vaultChangePass(PASS, 'p', PASS2); await E.vDrain();
  const F = dev(E), logF = audioMock(F); await wait(); await F.vaultUnlockWith('p', PASS2); await wait(50);
  assert.equal(await F.csoundLoad(true), true); F.sfx('chime', true); assert.equal(logF.started.length, 1, 'plays after the passphrase changed');
  // device encryption off for the data: the file is plain again; back on: sealed again
  await F.vaultSetScopes({ local: false, backup: true, sync: true }); await F.vDrain(); await wait(50);
  raw = F.indexedDB.kv.get('sound:custom'); assert.equal(raw.enc, undefined); assert.ok(raw.blob && raw.name === SNAME, 'unsealed with the rest');
  await F.vaultSetScopes(SCOPES); await F.vDrain(); await wait(50);
  raw = F.indexedDB.kv.get('sound:custom'); assert.equal(raw.enc, 1); assert.equal(raw.name, undefined);
  F.CS.buf = null; assert.equal(await F.csoundLoad(true), true, 'still opens after being sealed again');
  await F.vaultDisable(); await F.vDrain(); await wait(50);
  raw = F.indexedDB.kv.get('sound:custom'); assert.equal(raw.enc, undefined); assert.ok(raw.blob, 'encryption off: stored as it is');
  F.CS.buf = null; assert.equal(await F.csoundLoad(true), true, 'and still plays');
}
{
  // two devices syncing: the sound stays on the device that chose it, and nothing about it is in the cloud file
  const srv = srv0, FILE = '/dav/OpenTick/opentick.json';
  const mk = () => { const a = dev(); audioMock(a); Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder: 'OpenTick', user: 'me', pass: 'secret' } }); return a; };
  const X = mk(), Y = mk(); X.S.tasks.push(X.newTask({ title: 'shared task' })); await X.csoundSet(good()); X.save(); X.flush();
  await X.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await X.vDrain();
  await X.syncNow(true); assert.equal(X.Sync.state, 'ok', X.Sync.msg);
  const body = srv.files.get(FILE).body; assert.ok(!body.includes(SNAME) && !body.includes('"sound"') && !body.includes('custom'), 'nothing about the sound in the cloud file');
  const env = JSON.parse(body); await Y.vaultJoin(env.vault, 'p', PASS, { local: false }); await Y.syncNow(true); assert.equal(Y.Sync.state, 'ok', Y.Sync.msg);
  assert.ok(Y.S.tasks.some(t => t.title === 'shared task'), 'the data arrived'); assert.equal(Y.S.settings.sound.custom, null, 'the sound did not: it is a setting of the device that chose it');
  assert.equal(Y.indexedDB.kv.get('sound:custom'), undefined);
}


/* ============ 5. the update check: off until asked, one small request, nothing followed that is not this project's ============ */
{
  const calls = []; let reply = () => new Response(JSON.stringify({ tag_name: 'v99.0.0', html_url: 'https://github.com/JebbyCodes/OpenTick/releases/tag/v99.0.0' }), { status: 200 });
  const fetchMock = async (url, init) => { calls.push({ url, init }); const r = reply(); if (r instanceof Error) throw r; return r; };
  const A = makeApp({ fetch: fetchMock }), say = []; A.__mock('toast', (m, act) => say.push({ m, act })); A.__mock('updHave', () => '0.6.2');
  const opened = []; A.__mock('openExternal', u => opened.push(u));
  const tag = (t, url) => { reply = () => new Response(JSON.stringify({ tag_name: t, html_url: url ?? `https://github.com/JebbyCodes/OpenTick/releases/tag/${t}` }), { status: 200 }); };

  // versions
  eq(A.updParse('v0.7.0'), { n: [0, 7, 0], pre: '' }); eq(A.updParse('1.20.3-rc.1+build5'), { n: [1, 20, 3], pre: 'rc.1' });
  for (const bad of ['', null, 'latest', '1.2', '1.2.3.4', 'v1.2.x', '1.2.3-<b>', '99999.0.0', '../../1.0.0']) assert.equal(A.updParse(bad), null, `"${bad}" is not a version`);
  const NEWER = [['0.7.1', '0.7.0'], ['0.10.0', '0.9.9'], ['1.0.0', '0.99.99'], ['0.8.0', '0.8.0-rc.1'], ['0.8.0-rc.2', '0.8.0-rc.1'], ['0.8.0-rc.10', '0.8.0-rc.9'], ['v1.0.0', '0.9.0']];
  for (const [a, b] of NEWER) { assert.equal(A.updNewer(a, b), true, `${a} is newer than ${b}`); assert.equal(A.updNewer(b, a), false, `${b} is not newer than ${a}`); }
  for (const [a, b] of [['0.7.0', '0.7.0'], ['v0.7.0', '0.7.0'], ['0.7.0-rc.1', '0.7.0-rc.1'], ['junk', '0.7.0'], ['0.7.0', 'junk']]) assert.equal(A.updNewer(a, b), false);
  // only this project's own pages are opened
  const PG = A.UPD_PAGE; assert.equal(A.updLink('https://github.com/JebbyCodes/OpenTick/releases/tag/v1.0.0'), 'https://github.com/JebbyCodes/OpenTick/releases/tag/v1.0.0');
  for (const evil of ['javascript:alert(1)', 'https://evil.example/', 'https://github.com/someone-else/OpenTick/releases', 'https://github.com/JebbyCodes/OpenTick-Scoop/x', 'https://github.com/JebbyCodes/OpenTick/x" onclick="1', 'https://github.com/JebbyCodes/OpenTick/ x', '', null, 5, {}]) assert.equal(A.updLink(evil), PG, `${evil} is never followed`);

  // off by default: nothing is sent, however the app runs
  assert.equal(A.S.settings.upd.auto, false); assert.equal(A.updDue(Date.now() + 1e12), false, 'never due while off');
  assert.equal(await A.updAuto(), null); assert.equal(calls.length, 0, 'no request while it is off');
  assert.match(A.updSettingsHtml(), /data-upd="auto">/); assert.doesNotMatch(A.updSettingsHtml(), /data-upd="auto" checked/); assert.match(A.updSettingsHtml(), /Off by default/); assert.match(A.updSettingsHtml(), /Not checked yet/);

  // "Check now" works with it off, and sends one plain request that says nothing about the person
  A.S.tasks.push(A.newTask({ title: 'PRIVATE-TASK-TITLE' })); A.S.notes.push(A.newNote({ title: 'n', body: 'PRIVATE-NOTE' }));
  let r = await A.updCheck(); assert.equal(calls.length, 1); assert.equal(r.state, 'new'); assert.equal(r.version, '99.0.0'); assert.equal(r.url, 'https://github.com/JebbyCodes/OpenTick/releases/tag/v99.0.0');
  assert.equal(calls[0].url, A.UPD_API); assert.equal(calls[0].init.method, 'GET'); assert.equal(calls[0].init.body, undefined, 'no body');
  eq(Object.keys(calls[0].init.headers).sort(), ['Accept', 'X-GitHub-Api-Version'], 'no login, no cookie, no identifier');
  assert.ok(!JSON.stringify(calls[0]).includes('PRIVATE'), 'nothing of the person is in the request'); assert.ok(new URL(calls[0].url).host === 'api.github.com');
  assert.equal(A.S.settings.upd.auto, false, 'a manual check does not turn the automatic one on'); assert.equal(A.S.settings.upd.found, '99.0.0'); assert.ok(A.S.settings.upd.last > 0 && A.S.settings.upd.ok);
  assert.match(A.updStatusHtml(r), /Version 99\.0\.0 is available/); assert.match(A.updStatusHtml(r), /data-updact="open"/);
  tag('v0.6.2'); r = await A.updCheck(); assert.equal(r.state, 'current'); assert.equal(A.S.settings.upd.found, '', 'nothing newer'); assert.match(A.updStatusHtml(r), /latest version/);
  tag('v0.0.1'); assert.equal((await A.updCheck()).state, 'current', 'an older tag is not an update');
  tag('v0.99.0-rc.1'); assert.equal((await A.updCheck()).state, 'new', 'a newer pre-release counts when GitHub offers it as the latest');

  // answers that are not what they should be: a clear message, nothing stored as "found", never a throw
  const bad = [
    [() => new Response('{}', { status: 403 }), /limiting requests/], [() => new Response('{}', { status: 429 }), /limiting requests/], [() => new Response('{}', { status: 404 }), /No release/], [() => new Response('oops', { status: 500 }), /500/],
    [() => new Response('not json', { status: 200 }), /Could not reach GitHub/], [() => new Response(JSON.stringify({ tag_name: '<script>alert(1)</script>' }), { status: 200 }), /could not be understood/], [() => new Response(JSON.stringify({}), { status: 200 }), /could not be understood/],
    [() => new Response('null', { status: 200 }), /could not be understood/], [() => Object.assign(new Error('fetch failed'), {}), /Could not reach GitHub. Are you online/],
  ];
  for (const [mk, re] of bad) { reply = mk; r = await A.updCheck(); assert.equal(r.state, 'error'); assert.match(r.error, re); assert.equal(A.S.settings.upd.ok, false); assert.doesNotMatch(r.error, /<script/); }
  assert.doesNotMatch(A.updStatusHtml({ state: 'error', error: 'x' }), /<script/);
  // a hostile link in an otherwise good answer is replaced by the project's own release page, and the page is what Open uses
  tag('v99.1.0', 'https://evil.example/phish'); r = await A.updCheck(); assert.equal(r.state, 'new'); assert.equal(r.url, PG);
  await A.updAction({ dataset: { updact: 'open' }, getAttribute: () => 'javascript:alert(1)' }); eq(opened, [PG], 'Open only ever opens a release page of this project');
  // the buttons in Settings
  tag('v99.2.0'); const before = calls.length; await A.updAction({ dataset: { updact: 'check' } }); assert.equal(calls.length, before + 1); await A.updAction({ dataset: { updact: 'nothing' } }); assert.equal(calls.length, before + 1);

  // turning the automatic check on: one check straight away, then at most once a day (two hours after a failure), and each version is announced once
  const B = makeApp({ fetch: fetchMock }), shout = []; B.__mock('toast', (m, act) => shout.push({ m, act })); B.__mock('updHave', () => '0.6.2'); B.__mock('openExternal', u => opened.push(u));
  tag('v99.0.0'); calls.length = 0;
  B.updToggle(true); assert.equal(B.S.settings.upd.auto, true); await wait(700); assert.equal(calls.length, 1, 'switching it on checks once');
  assert.equal(shout.length, 1); assert.match(shout[0].m, /OpenTick 99\.0\.0 is available/); assert.ok(shout[0].act && typeof shout[0].act.fn === 'function'); shout[0].act.fn(); assert.equal(opened.at(-1), 'https://github.com/JebbyCodes/OpenTick/releases/tag/v99.0.0');
  const t0 = B.S.settings.upd.last; assert.equal(B.updDue(t0 + 23 * 36e5), false, 'not again within a day'); assert.equal(B.updDue(t0 + 24 * 36e5), true, 'again after a day');
  assert.equal(await B.updAuto(), null, 'not due yet: no request'); assert.equal(calls.length, 1);
  B.S.settings.upd.last = 1; await B.updAuto(); assert.equal(calls.length, 2); assert.equal(shout.length, 1, 'the same version is not announced twice');
  tag('v99.5.0'); B.S.settings.upd.last = 1; await B.updAuto(); assert.equal(shout.length, 2, 'a newer one is'); assert.match(shout[1].m, /99\.5\.0/);
  reply = () => new Response('{}', { status: 500 }); B.S.settings.upd.last = 1; await B.updAuto(); const tf = B.S.settings.upd.last;
  assert.equal(B.updDue(tf + 1 * 36e5), false); assert.equal(B.updDue(tf + 2 * 36e5), true, 'after a failure it tries again in two hours, not a day');
  B.updToggle(false); assert.equal(B.S.settings.upd.auto, false); const n = calls.length; assert.equal(await B.updAuto(), null); assert.equal(calls.length, n, 'switched off again: silent');
  assert.match(B.updSettingsHtml(), /data-upd="auto">/);
  B.updToggle('true'); assert.equal(B.S.settings.upd.auto, false, 'only a real yes counts');

  // a saved setting that is damaged or from an older version
  const base = () => ({ tasks: [], lists: [], tags: [], habits: [], slots: [], notes: [], projects: [], school: [], templates: [], countdowns: [], zones: [], boards: [], pomo: [], tomb: {} });
  eq(A.migrate(base()).settings.upd, { auto: false, last: 0, ok: false, seen: '', found: '' }, 'an older save: off');
  eq(A.migrate({ ...base(), settings: { upd: { auto: 'yes', last: 'x', seen: '<b>', found: '1'.repeat(40), ok: 1, extra: 1 } } }).settings.upd, { auto: false, last: 0, ok: false, seen: '', found: '' });
  eq(A.migrate({ ...base(), settings: { upd: { auto: true, last: 5, ok: true, seen: '0.8.0', found: '0.8.0' } } }).settings.upd, { auto: true, last: 5, ok: true, seen: '0.8.0', found: '0.8.0' });
  eq(A.migrate({ ...base(), settings: { upd: 'nope' } }).settings.upd.auto, false);

  // device-local like every setting: not in the data that syncs, and sealed when device encryption is on
  assert.ok(!JSON.stringify(A.snapshot()).includes('"upd"') && !JSON.stringify(A.snapshot()).includes('99.0.0'));
  const store = {}, indexedDB = fakeIndexedDB(), C = makeApp({ store, indexedDB, fetch: fetchMock }); C.__mock('updHave', () => '0.6.2'); C.updToggle(true); await wait(50); C.save(); C.flush();
  assert.ok(Object.values(store).join('\n').includes('"upd"'), 'before: readable in storage');
  await C.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await C.vDrain();
  assert.ok(!Object.entries(store).map(([k, v]) => k + '=' + v).join('\n').includes('"upd"'), 'sealed with the rest of the settings');
}


/* ============ 6. the smartwatch layout: when it is on, what the pages show, and that it uses the app's own data, sync and encryption ============ */
{
  const A = makeApp(), { S } = A; A.__mock('watchRender', () => {}); // (the pages are drawn in the browser tests; here the data behind them)
  // when it is on
  eq(S.settings.watch, { mode: 'auto', shape: 'auto' }); assert.equal(A.watchOn(), false, 'an ordinary build does not start on the watch layout');
  S.settings.watch.mode = 'on'; assert.equal(A.watchOn(), true); S.settings.watch.mode = 'off'; assert.equal(A.watchOn(), false); S.settings.watch.mode = 'auto';
  eq(A.migrate({ ...base0(), settings: { watch: { mode: 'bogus', shape: 7, extra: 1 } } }).settings.watch, { mode: 'auto', shape: 'auto' }, 'a damaged setting falls back');
  eq(A.migrate({ ...base0(), settings: { watch: { mode: 'on', shape: 'round' } } }).settings.watch, { mode: 'on', shape: 'round' });
  eq(A.migrate(base0()).settings.watch, { mode: 'auto', shape: 'auto' }, 'an older save');
  assert.ok(/data-pf="watch.mode"/.test(A.watchSettingsHtml()) && /data-pf="watch.shape"/.test(A.watchSettingsHtml()));
  eq(A.WATCH_PAGES.map(p => p[0]), ['now', 'tasks', 'next', 'habits', 'focus', 'more']);

  // the pages come out of the app's own data
  A.S.tasks.push(A.newTask({ title: 'Call dentist', due: A.todayStr(), time: '11:00' }), A.newTask({ title: 'Overdue <b>report</b>', due: '2020-01-01' }), A.newTask({ title: 'Later', due: '2999-01-01' }));
  A.S.habits.push({ id: 'h1', name: 'Read 20 pages', icon: 'book', color: '#34b36b', goal: { per: 'day', n: 1 }, created: A.todayStr(), log: {} });
  const T = A.watchBody('tasks'); assert.equal(T.title, 'Tasks'); assert.match(T.sub, /^[2-9] to do$/); assert.match(T.html, /Call dentist/); assert.match(T.html, /Overdue/); assert.ok(!T.html.includes('Later'), 'only what is due');
  assert.ok(!T.html.includes('<b>report</b>') && T.html.includes('&lt;b&gt;report&lt;/b&gt;'), 'a task title is never markup');
  assert.match(T.html, /data-act="wtoggle" data-id=/); assert.match(T.html, /data-act="wadd"/);
  const H = A.watchBody('habits'); assert.match(H.html, /Read 20 pages/); assert.match(H.html, /Not yet/); assert.match(H.html, /aria-pressed="false"/);
  assert.match(A.watchBody('now').html, /id="w-time"/); assert.match(A.watchBody('focus').html, /id="pclock"/); assert.match(A.watchBody('more').html, /data-act="wfull"/);
  assert.match(A.watchBody('next').title, /Timetable|.+/); assert.ok(A.watchBody('nonsense').html.includes('could not be drawn'), 'a page that fails still draws something and offers the way back');
  // the buttons change the app's data, like the full app's buttons do
  const id = A.S.tasks.find(t => t.title === 'Call dentist').id; A.WATCH_ACT.wtoggle({ dataset: { id } }); assert.notEqual(A.getT(id).status, 'open', 'the tick completes the task');
  A.WATCH_ACT.wtoggle({ dataset: { id } }); assert.equal(A.getT(id).status, 'open', 'and ticks it back');
  const hb = () => A.S.habits.find(h => h.id === 'h1'); A.WATCH_ACT.whday({ dataset: { id: 'h1' } }); assert.equal(!!hb().log[A.todayStr()], true, 'a habit is checked in for today'); assert.match(A.watchBody('habits').html, /aria-pressed="true"/); A.WATCH_ACT.whday({ dataset: { id: 'h1' } }); assert.equal(!!hb().log[A.todayStr()], false);
  const t = A.watchAdd('  Call mum tomorrow !high  '); assert.ok(t && t.title === 'Call mum' && t.priority > 0 && t.due, 'the quick-add text is understood'); assert.ok(A.S.tasks.some(x => x.title === 'Call mum'));
  assert.equal(A.watchAdd('   '), null, 'an empty box adds nothing');
  A.WATCH_ACT.wpmode({ dataset: { m: 'short' } }); assert.equal(A.P.mode, 'short'); A.WATCH_ACT.wptoggle(); assert.equal(A.P.run, true, 'the timer starts'); A.WATCH_ACT.wptoggle(); assert.equal(A.P.run, false);
  A.WATCH_ACT.wgo({ dataset: { p: 'habits' } }); assert.equal(A.WT.page, 'habits'); A.watchGo(null, 1); assert.equal(A.WT.page, 'focus'); A.watchGo(null, 10); assert.equal(A.WT.page, 'focus', 'no page past the last'); A.watchGo('now'); assert.equal(A.WT.page, 'now');
  A.WATCH_ACT.wfull(); assert.equal(A.S.settings.watch.mode, 'off', 'the way back to the full app');
}


{
  // a task added on the watch reaches the phone through encrypted sync, and the layout choice stays on the watch
  const srv = srv0, FILE = '/dav/WatchTest/opentick.json', WORD = 'ZEBRA-from-the-wrist';
  const mk = () => { const a = dev(); a.__mock('watchRender', () => {}); Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder: 'WatchTest', user: 'me', pass: 'secret' } }); return a; };
  const W = mk(), Ph = mk(); W.S.settings.watch.mode = 'on'; W.S.settings.watch.shape = 'round';
  await W.vaultEnable(PASS, { local: true, backup: true, sync: true }, {}); await W.vDrain();
  W.watchAdd(WORD + ' tomorrow'); const done = W.S.tasks.find(t => t.title.startsWith(WORD)); assert.ok(done);
  W.WATCH_ACT.wtoggle({ dataset: { id: done.id } }); W.watchAdd('Second ' + WORD);
  W.save(); W.flush(); await W.syncNow(true); assert.equal(W.Sync.state, 'ok', W.Sync.msg);
  const body = srv.files.get(FILE).body; assert.ok(!body.includes(WORD), 'the sync file is encrypted: nothing readable'); assert.ok(!body.includes('"watch"') && !body.includes('round'), 'the layout choice is not in it either');
  assert.ok(!JSON.stringify(W.snapshot()).includes('"watch"'), 'not in the data that syncs');
  await Ph.vaultJoin(JSON.parse(body).vault, 'p', PASS, { local: false }); await Ph.syncNow(true); assert.equal(Ph.Sync.state, 'ok', Ph.Sync.msg);
  assert.ok(Ph.S.tasks.some(t => t.title.startsWith(WORD) && t.status !== 'open'), 'the task finished on the watch is finished on the phone'); assert.ok(Ph.S.tasks.some(t => t.title === 'Second ' + WORD), 'and the other one arrived');
  assert.equal(Ph.S.settings.watch.mode, 'auto', 'the phone keeps its own layout');
  // device encryption seals the choice with the rest of the settings
  assert.ok(!Object.entries(W.store).map(([k, v]) => k + '=' + v).join('\n').includes('"shape"'), 'sealed in local storage');
}

srv0.server.close();
console.log('v070: ok');
