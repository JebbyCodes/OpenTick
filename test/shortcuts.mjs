// Custom keyboard shortcuts (0.9.1): the person chooses the keys; the app keeps them safe.
// Covers: reading and writing a key, the six kinds of conflict (another action, the same key in another place, the app's own keys, the browser, the operating system,
// differences between computers and keyboards), key presses and sequences, the typing guard, defaults and "back to default", per-computer choices, sync between devices
// (merge laws, deletion, a clash that only exists once two devices meet is HELD and never discarded), choices a newer app made, dynamic section actions, export / import,
// and the editor's text.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB, clock } from './harness.mjs';
import { davServer } from './dav-mock.mjs';
const srv = await davServer();
const dev = (folder = 'OpenTick') => { const a = makeApp({ store: {}, indexedDB: fakeIndexedDB() }); Object.assign(a.Sync.cfg, { provider: 'webdav', auto: false, webdav: { url: srv.url(), folder, user: 'me', pass: 'secret' } }); a.els['#modal.on'] = false; return a; };
const sync = async (...ds) => { for (const d of ds) { await d.syncNow(true); assert.equal(d.Sync.state, 'ok', d.Sync.msg); } };
const J = o => JSON.parse(JSON.stringify(o)), q = JSON.stringify, run = (d, code) => J(d.__run(code));
const tick = (s = 60) => { clock.t += s * 1000; }; // (the test clock stands still unless it is moved: each step that must come "later" moves it)
const platform = (d, p) => d.__run(`navigator.platform = ${q({ mac: 'MacIntel', win: 'Win32', linux: 'Linux x86_64' }[p])}`);
const asApp = (d, on) => { if (on) d.win.__TAURI__ = {}; else delete d.win.__TAURI__; };
// a key press as the page sees it (target: where the focus is)
const press = (d, key, o = {}) => { let prevented = false; const tag = o.tag || 'BODY'; d.fire('keydown', {}, { key, code: o.code || '', ctrlKey: !!o.ctrl, metaKey: false, altKey: !!o.alt, shiftKey: !!o.shift, repeat: false, preventDefault: () => { prevented = true; }, target: { tagName: tag, isContentEditable: false, closest: () => null, classList: { contains: () => false }, dataset: {} } }); return prevented; };
const issues = (d, id, key, others = true) => run(d, `skIssues(skById(${q(id)}), ${q(key)}, { others: ${others ? 'skAnalysis().filter(b => !b.off)' : '[]'} })`);
const kinds = (d, id, key, level) => issues(d, id, key).filter(x => !level || x.level === level).map(x => x.kind);
const eff = (d, id) => run(d, `skKeysOf(skById(${q(id)}))`);
const off = (d, id) => run(d, `skAnalysis().filter(b => b.s.id === ${q(id)} && b.off).map(b => b.off)`);
const set = (d, id, keys, only = false) => d.__run(`skSetKeys(${q(id)}, ${q(keys)}, ${only})`);

/* ---------- 1. reading and writing a key ---------- */
{
  const A = dev(), C = k => run(A, `skCanon(${q(k)})`), T = t => run(A, `skFromText(${q(t)})`);
  assert.equal(C('Mod+Shift+p'), 'Mod+Shift+P'); assert.equal(C('n'), 'N'); assert.equal(C('Shift+Alt+Mod+X'), 'Mod+Shift+Alt+X', 'modifiers always in the same order');
  assert.equal(C('g t'), 'G T'); assert.equal(C('Space'), 'Space'); assert.equal(C('Mod+,'), 'Mod+,'); assert.equal(C('Mod++'), 'Mod++'); assert.equal(C('F5'), 'F5'); assert.equal(C('Escape'), 'Escape');
  for (const bad of ['', '  ', 'Ctrl+K', 'Mod+', 'Mod+Hyper+K', 'Mod+Shift', 'a b c d', 'Mod+KK', 'F13', 'Mod+é']) assert.equal(C(bad), '', 'not a key: ' + bad);
  assert.equal(T('Ctrl+Shift+K'), 'Mod+Shift+K'); assert.equal(T('cmd k'), '', 'a modifier word with no + is not guessed (it could be a sequence)'); assert.equal(T('Cmd+K'), 'Mod+K'); assert.equal(T('Ctrl + K'), 'Mod+K'); assert.equal(T('Ctrl + Shift + K'), 'Mod+Shift+K');
  assert.equal(T('g then t'), 'G T'); assert.equal(T('g, t'), 'G T'); assert.equal(T('g > t'), 'G T'); assert.equal(T('Option+P'), 'Alt+P'); assert.equal(T('⌘⇧P'), '', 'run-together symbols are not guessed');
  assert.equal(T('⌘+⇧+P'), 'Mod+Shift+P'); assert.equal(T('ctrl+plus'), 'Mod++'); assert.equal(T('Ctrl++'), 'Mod++'); assert.equal(T('esc'), 'Escape'); assert.equal(T('ctrl+space'), 'Mod+Space'); assert.equal(T('shift+left'), 'Shift+ArrowLeft');
  assert.equal(T('nonsense+++'), ''); assert.equal(T('a b c d'), '', 'at most three steps');
  // two spellings of the same key are the same key
  const same = (a, b) => run(A, `skSame(${q(a)}, ${q(b)})`);
  assert.ok(same('n', 'N')); assert.ok(same('Mod+K', 'Mod+k')); assert.ok(!same('n', 'Shift+N')); assert.ok(same('?', 'Shift+?'), 'Shift does not tell symbols apart'); assert.ok(!same('g t', 'g'));
  assert.ok(run(A, `skPrefix('g', 'g t')`)); assert.ok(!run(A, `skPrefix('g t', 'g')`)); assert.ok(!run(A, `skPrefix('g', 'g')`));
  assert.equal(run(A, `skText('g t')`), 'G then T'); assert.equal(run(A, `skText('Mod+Shift+P')`), 'Ctrl+Shift+P');
}

/* ---------- 2. what ships: defaults agree with each other, and nothing needs attention ---------- */
{
  const A = dev(), all = run(A, `skAnalysis().map(b => ({ id: b.s.id, canon: b.canon, off: b.off, custom: b.custom }))`);
  assert.ok(all.length >= 30, 'the defaults are all there');
  assert.ok(all.every(b => !b.off && !b.custom), 'no default is switched off');
  for (const x of all) for (const y of all) if (x.id < y.id) { // two defaults never meet where both work (so there is nothing to fix after installing)
    const meet = run(A, `skOverlap(skCtxOf(skById(${q(x.id)})), skCtxOf(skById(${q(y.id)}))) && (skSame(${q(x.canon)}, ${q(y.canon)}) || skPrefix(${q(x.canon)}, ${q(y.canon)}) || skPrefix(${q(y.canon)}, ${q(x.canon)}))`);
    assert.ok(!meet, `defaults ${x.id} (${x.canon}) and ${y.id} (${y.canon}) meet`);
  }
  assert.equal(A.S.shortcuts.length, 0, 'a fresh install has no records: every key is the default');
  assert.deepEqual(eff(A, 'newtask'), ['n']); assert.deepEqual(eff(A, 'palette'), ['Mod+Shift+P']);
}

/* ---------- 3. key presses ---------- */
{
  const A = dev(), S = A.S, U = A.U; U.page = 'tasks';
  const t = A.newTask({ title: 'press' }); S.tasks.push(t); U.sel = t.id;
  assert.ok(press(A, 'x'), 'x is taken (the page does not also get it)'); assert.equal(t.status, 'done', 'the default x completes the selected task'); press(A, 'x'); assert.equal(t.status, 'open', 'and again reopens it');
  // typing in a field never triggers a bare key
  t.status = 'open'; assert.ok(!press(A, 'x', { tag: 'INPUT' })); assert.equal(t.status, 'open', 'typing x in a text box does not complete a task');
  // a choice: Shift+Q completes
  set(A, 'complete', ['Shift+Q']); assert.deepEqual(eff(A, 'complete'), ['Shift+Q']);
  assert.ok(!press(A, 'x'), 'x no longer does it'); assert.ok(press(A, 'Q', { shift: true })); assert.equal(t.status, 'done', 'the new key does');
  // a sequence
  t.status = 'open'; set(A, 'complete', ['g c']);
  assert.ok(press(A, 'g'), 'the first key of a sequence is held back'); assert.equal(t.status, 'open', 'and does nothing yet'); assert.ok(press(A, 'c')); assert.equal(t.status, 'done', 'the second key completes it');
  t.status = 'open'; press(A, 'g'); press(A, 'z'); press(A, 'c'); assert.equal(t.status, 'open', 'a wrong second key starts over, and c alone is nothing');
  // a wrong second key that is itself a shortcut still works (starts over with it)
  press(A, 'g'); press(A, 'd'); assert.equal(t.due, A.todayStr(), 'g then d: d (due today) still works');
  // sequences never start while typing
  t.status = 'open'; press(A, 'g', { tag: 'TEXTAREA' }); press(A, 'c', { tag: 'TEXTAREA' }); assert.equal(t.status, 'open');
  // a chord with Ctrl works in a field only for an action made for it (search, palette, settings)
  set(A, 'complete', ['Mod+Shift+X']); assert.ok(!press(A, 'x', { ctrl: true, shift: true, tag: 'INPUT' }), 'not in a field'); assert.equal(t.status, 'open'); assert.ok(press(A, 'x', { ctrl: true, shift: true })); assert.equal(t.status, 'done');
  // two keys for one action; removing one keeps the other
  t.status = 'open'; set(A, 'complete', ['Mod+Shift+X', 'Shift+Y']); assert.ok(press(A, 'Y', { shift: true })); assert.equal(t.status, 'done');
  A.__run(`skRemoveKey('complete', 1, false)`); assert.deepEqual(eff(A, 'complete'), ['Mod+Shift+X']); t.status = 'open'; assert.ok(!press(A, 'Y', { shift: true }));
  // a window that is open stops the keys (except those made to work there)
  A.els['#modal.on'] = true; t.status = 'open'; press(A, 'x', { ctrl: true, shift: true }); assert.equal(t.status, 'open', 'no shortcut works behind a window'); A.els['#modal.on'] = false;
  // a held key does not repeat an action that is not made for it
  t.status = 'open'; let n = 0; const orig = A.SK.find(s => s.id === 'complete').run; A.SK.find(s => s.id === 'complete').run = () => { n++; };
  press(A, 'x', { ctrl: true, shift: true }); A.fire('keydown', {}, { key: 'x', ctrlKey: true, shiftKey: true, repeat: true, preventDefault() {}, target: { tagName: 'BODY', closest: () => null, dataset: {} } }); assert.equal(n, 1, 'holding the key does it once'); A.SK.find(s => s.id === 'complete').run = orig;
  // a key that does nothing here is not swallowed
  assert.ok(!press(A, 'F9'), 'an unused key is left to the browser');
}

/* ---------- 4. the six kinds of conflict ---------- */
{
  const A = dev();
  // 1. another action
  let c = issues(A, 'newnote', 'n').find(x => x.kind === 'action'); assert.ok(c && c.level === 'conflict' && c.with === 'newtask', 'n is New task'); assert.match(c.text, /already used for “New task”/);
  assert.deepEqual(kinds(A, 'newnote', 'Shift+N', 'conflict'), [], 'its own key is no conflict');
  // 2. the same key in another place
  c = issues(A, 'timer', 'ArrowLeft'); assert.ok(c.some(x => x.kind === 'context' && x.level === 'info' && x.with === 'prevp'), 'the Focus page and the calendar never meet'); assert.ok(!c.some(x => x.level === 'conflict'));
  assert.ok(issues(A, 'complete', 'ArrowLeft').some(x => x.kind === 'action' && x.level === 'conflict'), 'a selected task can be on the calendar page: they do meet');
  // prefix: a sequence that starts with another action's whole key, and the other way round
  c = issues(A, 'newlist', 'n t').find(x => x.kind === 'prefix'); assert.ok(c && c.level === 'conflict' && c.with === 'newtask' && /could never be reached/.test(c.text));
  set(A, 'newlist', ['g n']); c = issues(A, 'newtask', 'g').find(x => x.kind === 'prefix'); assert.ok(c && c.level === 'conflict' && /start of “New list”/.test(c.text));
  A.S.shortcuts.length = 0; A.__run('skDirty()');
  // 3. the app's own keys
  for (const k of ['Escape', 'Enter', 'Tab', 'Backspace', 'Mod+B', 'Mod+I', 'Mod+K', 'Mod+Z', 'Mod+C', 'Mod+V', 'Mod+A']) assert.ok(kinds(A, 'today', k, 'block').includes('app'), k + ' belongs to the app');
  assert.ok(kinds(A, 'today', 'Escape g', 'block').includes('app'), 'a sequence cannot start with Esc'); assert.ok(!kinds(A, 'today', 'g Escape', 'block').includes('app'), 'only the start of a sequence is a problem');
  // 4. the browser: in a browser the tab keys are blocked and print is a warning; in the app they are only information
  assert.equal(run(A, 'skEnv()'), 'browser');
  for (const k of ['Mod+T', 'Mod+W', 'Mod+N', 'Mod+Shift+N', 'Mod+Tab', 'Mod+1', 'Mod+9', 'Alt+ArrowLeft']) assert.ok(kinds(A, 'today', k, 'block').includes('browser'), k + ' blocked in a browser');
  for (const k of ['Mod+P', 'Mod+S', 'Mod+F', 'Mod+L', 'F5', 'F12']) { assert.ok(kinds(A, 'today', k, 'warn').includes('browser'), k + ' warned in a browser'); assert.ok(!kinds(A, 'today', k, 'block').includes('browser')); }
  asApp(A, true); assert.equal(run(A, 'skEnv()'), 'app');
  assert.ok(!kinds(A, 'today', 'Mod+T', 'block').includes('browser'), 'the app can take Ctrl+T'); assert.ok(kinds(A, 'today', 'Mod+T', 'info').includes('browser'), 'and says it would not work in a browser');
  assert.ok(!kinds(A, 'today', 'Mod+P', 'warn').includes('browser')); asApp(A, false);
  // 5. the operating system
  platform(A, 'win'); assert.ok(kinds(A, 'today', 'Alt+Tab', 'block').includes('os') && kinds(A, 'today', 'Alt+F4', 'block').includes('os')); assert.ok(kinds(A, 'today', 'Mod+Shift+Escape', 'warn').includes('os'), 'a warning where it only usually works');
  assert.match(issues(A, 'today', 'Alt+Tab').find(x => x.kind === 'os').text, /Windows reserves Alt\+Tab: it switches windows\./);
  platform(A, 'mac'); assert.ok(kinds(A, 'today', 'Mod+Space', 'block').includes('os') && kinds(A, 'today', 'Mod+Q', 'block').includes('os') && kinds(A, 'today', 'Mod+Tab', 'block').includes('os')); assert.ok(!kinds(A, 'today', 'Alt+Tab', 'block').includes('os'), 'Alt+Tab is nothing special on a Mac');
  assert.ok(kinds(A, 'today', 'Mod+Shift+4', 'warn').includes('os'), 'screenshots');
  platform(A, 'linux'); assert.ok(kinds(A, 'today', 'Alt+F4', 'block').includes('os')); assert.ok(kinds(A, 'today', 'Mod+Alt+T', 'warn').includes('os')); assert.ok(!kinds(A, 'today', 'Mod+Space', 'block').includes('os'));
  // 6. computers and keyboards
  platform(A, 'mac'); assert.ok(kinds(A, 'today', 'Alt+P', 'warn').includes('platform'), 'Option+letter on a Mac');
  platform(A, 'win'); assert.ok(kinds(A, 'today', 'Mod+Alt+P', 'warn').includes('platform'), 'Ctrl+Alt is AltGr on many Windows keyboards'); assert.ok(!kinds(A, 'today', 'Alt+P', 'warn').includes('platform'), 'Option+letter is a Mac thing');
  platform(A, 'linux'); assert.ok(kinds(A, 'today', '[', 'warn').includes('platform'), 'a key that needs AltGr on many layouts'); assert.ok(kinds(A, 'today', '`', 'warn').includes('platform')); assert.ok(!kinds(A, 'today', 'Mod+[', 'warn').includes('platform'), 'with Ctrl the key is fine');
  assert.ok(kinds(A, 'today', 'F8', 'info').includes('platform'), 'function keys');
  assert.ok(kinds(A, 'today', 'g t', 'info').includes('platform'), 'a sequence is explained'); assert.ok(kinds(A, 'today', 'ArrowDown', 'warn').includes('app'), 'a bare arrow key also scrolls');
  // the order: what blocks comes before conflicts, then warnings, then notes
  const lv = issues(A, 'newnote', 'n').map(x => x.level); assert.deepEqual(lv, [...lv].sort((a, b) => ['block', 'conflict', 'warn', 'info'].indexOf(a) - ['block', 'conflict', 'warn', 'info'].indexOf(b)));
  // suggestions are free keys
  const sug = run(A, `skSuggest('newnote', 'N')`); assert.ok(sug.length > 0, 'there are suggestions'); for (const k of sug) assert.ok(!issues(A, 'newnote', k).some(x => x.level === 'block' || x.level === 'conflict'), k + ' is free');
}

/* ---------- 5. a choice that cannot run is kept and flagged, never re-assigned or dropped ---------- */
{
  const A = dev();
  // a key the browser keeps: stored, but off here, with the reason
  set(A, 'today', ['Mod+T']); assert.deepEqual(eff(A, 'today'), ['Mod+T']); assert.ok(off(A, 'today')[0].includes('browser keeps'), off(A, 'today')[0]); assert.ok(!run(A, `skBindings().some(b => b.s.id === 'today')`), 'it does not run');
  asApp(A, true); assert.deepEqual(off(A, 'today'), [], 'the same choice works in the app'); assert.ok(run(A, `skBindings().some(b => b.s.id === 'today')`)); asApp(A, false);
  // a choice that meets a default: the default keeps the key; the choice waits
  A.S.shortcuts.length = 0; set(A, 'newlist', ['n']); assert.ok(off(A, 'newlist')[0].includes('Clashes with “New task”'), off(A, 'newlist')[0]); assert.deepEqual(off(A, 'newtask'), [], 'the default is untouched'); assert.ok(run(A, `skBindings().some(b => b.s.id === 'newtask')`));
  // two choices that meet are both held (so it does not matter which device was first)
  A.S.shortcuts.length = 0; set(A, 'newlist', ['Shift+Q']); set(A, 'newnote', ['Shift+Q']); assert.ok(off(A, 'newlist').length && off(A, 'newnote').length, 'both are on hold');
  assert.deepEqual(eff(A, 'newlist'), ['Shift+Q']); assert.deepEqual(eff(A, 'newnote'), ['Shift+Q'], 'and both choices are still there');
  // fixing one frees the other
  set(A, 'newnote', ['Shift+W']); assert.deepEqual(off(A, 'newlist'), []); assert.deepEqual(off(A, 'newnote'), []);
  // the order of the actions makes no difference: the other way round gives the same answer
  A.S.shortcuts.length = 0; set(A, 'newnote', ['Shift+Q']); set(A, 'newlist', ['Shift+Q']); assert.ok(off(A, 'newlist').length && off(A, 'newnote').length);
  // sequences that meet
  A.S.shortcuts.length = 0; set(A, 'newlist', ['z']); set(A, 'newnote', ['z y']); assert.ok(off(A, 'newlist').length && off(A, 'newnote').length, 'a key and a sequence that starts with it');
  // the editor says so
  const html = A.__run('skEditorHtml("")'); assert.match(html, /Needs attention: Clashes with/); assert.match(html, /switched off until you choose another key/); assert.match(html, /2 shortcuts need attention/);
  // what the page sees: neither runs
  const t = A.newTask({ title: 'k' }); A.S.tasks.push(t); A.U.page = 'tasks'; A.U.sel = t.id; assert.ok(!press(A, 'z'), 'a held shortcut is not swallowed');
}

/* ---------- 6. defaults, per computer and for all ---------- */
{
  const A = dev(); const rec = id => J(A.S.shortcuts.find(r => r.action === id) || null);
  set(A, 'newtask', ['Shift+K']); assert.equal(A.S.shortcuts.length, 1); assert.equal(rec('newtask').id, 'sc-' + A.__run(`pkrHash('newtask')`));
  assert.deepEqual(rec('newtask').keys, ['Shift+K']); assert.ok(rec('newtask').ku > 0 && rec('newtask').u > 0);
  // setting it back to what the default is leaves no record
  set(A, 'newtask', ['n']); assert.equal(A.S.shortcuts.length, 0, 'the same as the default is no choice at all'); assert.deepEqual(eff(A, 'newtask'), ['n']);
  set(A, 'newtask', ['Shift+K']); A.__run(`skReset('newtask', false)`); assert.equal(A.S.shortcuts.length, 0); assert.deepEqual(eff(A, 'newtask'), ['n']);
  // no shortcut at all is a choice too
  set(A, 'newtask', []); assert.deepEqual(eff(A, 'newtask'), []); assert.deepEqual(rec('newtask').keys, []); assert.ok(!press(A, 'n'), 'n does nothing');
  A.__run(`skReset('newtask', false)`);
  // this kind of computer only
  platform(A, 'mac'); set(A, 'newtask', ['Shift+M'], true); assert.deepEqual(eff(A, 'newtask'), ['Shift+M']); assert.equal(rec('newtask').keys, null, 'nothing for the others'); assert.deepEqual(rec('newtask').pf.mac.k, ['Shift+M']);
  platform(A, 'win'); assert.deepEqual(eff(A, 'newtask'), ['n'], 'a Windows computer keeps the default'); platform(A, 'linux'); assert.deepEqual(eff(A, 'newtask'), ['n']);
  // for all computers, with a different one for Mac
  set(A, 'newtask', ['Shift+K']); assert.deepEqual(eff(A, 'newtask'), ['Shift+K']); platform(A, 'mac'); assert.deepEqual(eff(A, 'newtask'), ['Shift+M'], 'the Mac choice stays');
  // setting for all computers while on the Mac replaces the Mac's own choice (no surprise: what you just chose is what you get here)
  set(A, 'newtask', ['Shift+J']); assert.deepEqual(eff(A, 'newtask'), ['Shift+J']); assert.equal(rec('newtask').pf.mac.k, null, 'the Mac part says "no choice of its own"'); platform(A, 'win'); assert.deepEqual(eff(A, 'newtask'), ['Shift+J']);
  // taking back the Mac-only choice falls to the shared one
  platform(A, 'mac'); set(A, 'newtask', ['Shift+M'], true); A.__run(`skReset('newtask', true)`); assert.deepEqual(eff(A, 'newtask'), ['Shift+J'], 'back to the shared choice'); assert.equal(A.S.shortcuts.length, 1);
  A.__run(`skReset('newtask', false)`); assert.equal(A.S.shortcuts.length, 0); platform(A, 'linux');
  // restore everything
  set(A, 'newtask', ['Shift+K']); set(A, 'newnote', ['Shift+W']); A.__run('skResetAll()'); assert.equal(A.S.shortcuts.length, 0);
  // a key added to one that has several; "replace" takes the key from the other action
  set(A, 'newlist', ['Shift+Q']); A.__run(`skAddKey('newnote', 'Shift+W', false)`); assert.deepEqual(eff(A, 'newnote'), ['Shift+N', 'Shift+W'], 'added next to the default');
  A.__run(`skReplace('newnote', 'Shift+Q', ['newlist'], false)`); assert.deepEqual(eff(A, 'newlist'), [], 'taken from the other action'); assert.ok(eff(A, 'newnote').includes('Shift+Q'));
  // at most six keys per action, no duplicates
  set(A, 'newlist', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'a']); assert.equal(eff(A, 'newlist').length, 6);
  // the button hints follow the choice (the shortest key)
  A.__run(`skReset('newlist', false)`); set(A, 'newlist', ['g n', 'Mod+Shift+L', 'Shift+L']); assert.equal(run(A, `skHintKey('newlist')`), 'Shift+L'); set(A, 'newlist', ['g n']); assert.equal(run(A, `skHintKey('newlist')`), 'G N');
  A.__run(`skResetAll()`);
}

/* ---------- 7. records: normal form, merge laws, a newer app's choices ---------- */
{
  const A = dev(), N = r => run(A, `skNormalise(${q(r)})`);
  assert.equal(N({}), null); assert.equal(N({ action: 'a b', keys: ['n'] }), null, 'the action must be a plain word'); assert.equal(N({ action: 'x' }), null, 'no keys, no platform part: nothing');
  assert.deepEqual(N({ action: 'x', keys: ['ctrl+K', 'N', 'n', 'Mod+k', '', 7] }).keys, ['ctrl+K', 'N', 'Mod+K'], 'spellings are made the same, duplicates dropped, empty and non-text ignored; what is not understood (ctrl+K) is kept as typed');
  assert.deepEqual(N({ action: 'x', keys: ['Hyper+Q'] }).keys, ['Hyper+Q'], 'a key from a newer app is kept');
  assert.deepEqual(N({ action: 'x', pf: { mac: { k: null, u: 3 }, amiga: { k: ['n'], u: 1 }, win: { k: 'n' } } }).pf, { mac: { k: null, u: 3 } }, 'only real platforms, only lists or null');
  assert.equal(N({ action: 'x', keys: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }).keys.length, 6);
  assert.equal(N({ action: 'x', keys: ['n'], u: -5, ku: 'x' }).u, 0);
  // merge: newest part wins, each part on its own
  const mk = (keys, ku, pf, u) => N({ action: 'm', keys, ku, pf, u }), mg = (x, y) => run(A, `COLL_MERGE.shortcuts(${q(x)}, ${q(y)}, ${q(x.u >= y.u ? x : y)})`);
  const a = mk(['Shift+A'], 10, { mac: { k: ['Alt+A'], u: 5 } }, 10), b = mk(['Shift+B'], 20, { win: { k: ['Alt+B'], u: 6 } }, 20);
  const ab = mg(a, b); assert.deepEqual(ab.keys, ['Shift+B'], 'the newer shared choice'); assert.deepEqual(ab.pf.mac.k, ['Alt+A']); assert.deepEqual(ab.pf.win.k, ['Alt+B'], 'a Mac choice and a Windows choice made on two devices both survive');
  assert.ok(ab.u > 20, 'a result neither device has must travel (its time is raised)');
  // laws: commutative, associative, idempotent (also with a removal "k: null")
  const c = mk(['Shift+C'], 15, { mac: { k: null, u: 9 }, linux: { k: ['Alt+C'], u: 2 } }, 15);
  const eq = (x, y) => { const c = r => { const o = J(r); delete o.u; return o; }; assert.deepEqual(c(x), c(y)); }; // (the laws are about what the record SAYS; its time only says which copy is newer)
  eq(mg(a, b), mg(b, a)); eq(mg(mg(a, b), c), mg(a, mg(b, c))); eq(mg(mg(a, b), c), mg(mg(c, a), b)); eq(mg(a, a), a); eq(mg(mg(a, b), mg(a, b)), mg(a, b)); eq(mg(mg(a, b), a), mg(a, b));
  assert.equal(mg(mg(a, b), c).pf.mac.k, null, 'a later "no Mac choice" wins over an earlier Mac choice');
  // ties are settled the same way on both devices
  const t1 = mk(['Shift+X'], 7, {}, 7), t2 = mk(['Shift+Y'], 7, {}, 7); eq(mg(t1, t2), mg(t2, t1));
  // a record that is not a shortcut at all leaves the winner alone
  assert.doesNotThrow(() => run(A, `COLL_MERGE.shortcuts({ id: 'sc-1' }, { id: 'sc-1' }, { id: 'sc-1' })`));
  // migrate: junk is dropped, one record per action (the newest), unknown actions and keys survive
  const m = J(A.migrate({ tasks: [], shortcuts: [{ id: 'a' }, null, { id: 'sc-z', action: 'zzz', keys: ['Hyper+Q'], u: 4 }, N({ action: 'dup', keys: ['m'], u: 9 }), N({ action: 'dup', keys: ['n'], u: 1 }), { id: 'b', action: 'nokeys' }] }));
  assert.deepEqual(m.shortcuts.map(r => r.action).sort(), ['dup', 'zzz']); assert.deepEqual(m.shortcuts.find(r => r.action === 'dup').keys, ['M'], 'the newer of two for the same action');
  assert.deepEqual(m.shortcuts.find(r => r.action === 'zzz').keys, ['Hyper+Q']);
  // and a key this version cannot read is shown as such, off
  A.S.shortcuts.push(N({ action: 'today', keys: ['Hyper+Q'], ku: 1, u: 1 })); A.__run('skDirty()'); assert.ok(off(A, 'today')[0].includes('does not understand'), off(A, 'today')[0]);
}

/* ---------- 8. sync: every device gets every choice ---------- */
{
  const A = dev('sk1'), B = dev('sk1'); platform(A, 'mac'); platform(B, 'win');
  tick(); set(A, 'newtask', ['Shift+K']); set(A, 'search', ['Mod+Shift+F', '/']); set(A, 'palette', ['Mod+Shift+O'], true); A.flush();
  await sync(A, B); assert.deepEqual(eff(B, 'newtask'), ['Shift+K'], 'the choice for all computers arrived'); assert.deepEqual(eff(B, 'search'), ['Mod+Shift+F', '/']);
  assert.deepEqual(eff(B, 'palette'), ['Mod+Shift+P'], 'a Mac-only choice does not change a Windows computer'); assert.deepEqual(eff(A, 'palette'), ['Mod+Shift+O']);
  assert.deepEqual(J(B.S.shortcuts.find(r => r.action === 'palette').pf.mac.k), ['Mod+Shift+O'], 'but it is there, ready for the Mac');
  // each device adds its own for its kind of computer: both survive
  tick(); set(B, 'palette', ['Mod+Shift+K'], true); B.flush(); await sync(B, A); await sync(A, B);
  assert.deepEqual(eff(B, 'palette'), ['Mod+Shift+K']); assert.deepEqual(eff(A, 'palette'), ['Mod+Shift+O']); assert.equal(J(A.S.shortcuts.find(r => r.action === 'palette').pf.win.k)[0], 'Mod+Shift+K');
  // the keys are the same on both after syncing again (nothing keeps changing)
  const before = J(A.S.shortcuts); await sync(A, B); await sync(B, A); assert.deepEqual(J(A.S.shortcuts), before, 'nothing moves once they agree'); assert.deepEqual(J(B.S.shortcuts), before);
  // going back to the default on one device is a deletion everywhere
  tick(); A.__run(`skReset('newtask', false)`); A.flush(); await sync(A, B); assert.deepEqual(eff(B, 'newtask'), ['n'], 'restored on the other device too'); assert.ok(!B.S.shortcuts.some(r => r.action === 'newtask'));
  // a stale copy cannot bring it back
  await sync(B, A); assert.ok(!A.S.shortcuts.some(r => r.action === 'newtask'));
  // taking a computer-only choice back reaches the other device too
  tick(); A.__run(`skReset('palette', true)`); A.flush(); await sync(A, B); await sync(B, A); assert.deepEqual(eff(A, 'palette'), ['Mod+Shift+P'], 'the Mac is back to the default'); assert.deepEqual(eff(B, 'palette'), ['Mod+Shift+K'], 'the Windows choice is untouched');
}

/* ---------- 9. sync: a clash that only exists once two devices meet is held, not decided for you ---------- */
{
  const A = dev('sk2'), B = dev('sk2');
  await sync(A, B);
  tick(); set(A, 'newlist', ['Shift+Q']); A.flush(); tick(); set(B, 'newnote', ['Shift+Q']); B.flush(); // chosen apart, in good faith
  await sync(A, B); await sync(B, A);
  for (const d of [A, B]) { assert.deepEqual(eff(d, 'newlist'), ['Shift+Q']); assert.deepEqual(eff(d, 'newnote'), ['Shift+Q'], 'both choices are kept'); assert.ok(off(d, 'newlist')[0].includes('Clashes') && off(d, 'newnote')[0].includes('Clashes'), 'and both are held, on both devices'); assert.match(d.__run('skEditorHtml("")'), /Needs attention/); }
  // resolving it on one device resolves it on both
  tick(); set(A, 'newnote', ['Shift+W']); A.flush(); await sync(A, B); await sync(B, A);
  for (const d of [A, B]) { assert.deepEqual(off(d, 'newlist'), []); assert.deepEqual(off(d, 'newnote'), []); }
  // a choice that takes a key another device's DEFAULT has: the default wins, nothing is lost
  tick(); set(A, 'newlist', ['n']); A.flush(); await sync(A, B); assert.ok(off(B, 'newlist')[0].includes('“New task”')); assert.deepEqual(off(B, 'newtask'), []);
  // the same choice on a computer where it is not allowed is held there only
  const C = dev('sk2'); platform(C, 'mac'); await sync(C); tick(); set(A, 'today', ['Mod+Space']); A.flush(); await sync(A, C); // Ctrl+Space is free on Linux; Cmd+Space is Spotlight on a Mac
  assert.deepEqual(eff(C, 'today'), ['Mod+Space'], 'the choice is kept on the Mac'); assert.match(off(C, 'today')[0], /macOS reserves Cmd\+Space|macOS reserves Ctrl\+Space/, 'but held there, with the reason'); assert.deepEqual(off(A, 'today'), [], 'and it works where it is allowed');
  assert.ok(!run(C, `skBindings().some(b => b.s.id === 'today')`) && run(A, `skBindings().some(b => b.s.id === 'today')`));
}

/* ---------- 10. a section of your own or a pack: Go to / New entry ---------- */
{
  const A = dev(); A.S.csections.push(A.xsNormalise({ id: 'x-bk', name: 'Books <b>', fields: [{ id: 'f', name: 'Title', type: 'text' }] }));
  const ids = run(A, `skAll().map(s => s.id)`); assert.ok(ids.includes('sec.go.x-bk') && ids.includes('sec.new.x-bk'));
  assert.equal(run(A, `skLabel(skById('sec.go.x-bk'))`), 'Go to Books <b>'); assert.deepEqual(eff(A, 'sec.go.x-bk'), [], 'no key until the person chooses one');
  set(A, 'sec.go.x-bk', ['g b']); assert.ok(press(A, 'g')); assert.ok(press(A, 'b')); assert.equal(A.U.page, 'x-bk', 'the shortcut opens the section');
  const html = A.__run('skEditorHtml("")'); assert.match(html, /Go to Books &lt;b&gt;/, 'names are escaped'); assert.ok(!/Go to Books <b>/.test(html));
  assert.match(html, /Pack &amp; custom sections/);
  // a section that is deleted: its choice stays (it may come back), and is simply not shown or bound
  A.S.csections.length = 0; assert.ok(!run(A, `skAll().some(s => s.id === 'sec.go.x-bk')`)); assert.ok(!run(A, `skBindings().some(b => b.s.id === 'sec.go.x-bk')`)); assert.equal(A.S.shortcuts.filter(r => r.action === 'sec.go.x-bk').length, 1, 'the record is kept');
  // a hidden pack section has no actions
  A.S.csections.push(A.xsNormalise({ id: 'x-pk', name: 'Hidden', packId: 'some-pack' })); A.S.packs.push({ id: 'pk-some-pack', packId: 'some-pack', name: 'Some', version: '1', state: 'disabled' });
  assert.equal(run(A, `pksHidden(S.csections.find(s => s.id === 'x-pk'))`), true); assert.ok(!run(A, `skAll().some(s => s.id === 'sec.go.x-pk' || s.id === 'sec.new.x-pk')`), 'a disabled pack adds no actions');
}

/* ---------- 11. export and import ---------- */
{
  const A = dev(), B = dev(); set(A, 'newtask', ['Shift+K']); set(A, 'palette', ['Mod+Shift+O'], true); set(A, 'newlist', ['Shift+Q']); set(A, 'newnote', ['Shift+Q']);
  const text = A.__run('skExport()'), j = JSON.parse(text); assert.equal(j.opentick, 'shortcuts'); assert.equal(j.shortcuts.length, 4); assert.ok(!/"u"|"ku"/.test(text), 'times are not exported');
  const r = run(B, `skImport(${q(text)})`); assert.deepEqual([r.ok, r.added, r.skipped], [true, 4, 0]); assert.equal(r.needAttention, 2, 'the two that clash are imported and flagged'); assert.deepEqual(eff(B, 'newtask'), ['Shift+K']); assert.deepEqual(eff(B, 'newlist'), ['Shift+Q']);
  assert.ok(B.S.shortcuts.every(x => x.u > 0 && x.ku >= 0), 'imported records have times so they sync');
  for (const bad of ['', 'nope', '{}', '{"opentick":"tasks"}', '{"opentick":"shortcuts","shortcuts":"x"}']) assert.equal(run(B, `skImport(${q(bad)})`).ok, false, 'refused: ' + bad);
  assert.equal(run(B, `skImport(${q(JSON.stringify({ opentick: 'shortcuts', shortcuts: [{ action: 'newtask', keys: ['Shift+Z'] }, { nope: 1 }, null, { action: 'x y', keys: ['n'] }] }))})`).skipped, 3, 'what is not a shortcut is skipped');
  assert.deepEqual(eff(B, 'newtask'), ['Shift+Z'], 'an import replaces the choice for that action');
}

/* ---------- 12. the editor ---------- */
{
  const A = dev(); const html = A.__run('skEditorHtml("")');
  for (const g of ['Navigation', 'Tasks', 'Notes', 'Calendar', 'Habits', 'Projects', 'General', 'Editing']) assert.match(html, new RegExp('<h4 class="sk-g">' + g), 'group ' + g);
  assert.match(html, /aria-label="Set a shortcut for Go to Tasks"/, 'an action with no key says "Set"'); assert.match(html, /aria-label="Add another shortcut for New task"/);
  assert.match(html, /<span class="sk-fx">Fixed<\/span>/, 'the editor keys are shown, fixed'); assert.ok(!/data-ska="rec" data-id="bold"/.test(html), 'and cannot be recorded');
  assert.ok(!/Default: /.test(html), 'defaults show no "Default:" line');
  set(A, 'newtask', ['Shift+K']); const h2 = A.__run('skEditorHtml("")'); assert.match(h2, /Default: <span class="skk"><kbd>N<\/kbd>/, 'a changed one shows its default'); assert.match(h2, /aria-label="Restore the default for New task"/);
  // search: by name, by description, by key
  assert.match(A.__run('skEditorHtml("calendar")'), /Previous day, week or month/); assert.ok(!/Command palette/.test(A.__run('skEditorHtml("calendar")'))); assert.match(A.__run('skEditorHtml("shift+k")'), /New task/); assert.match(A.__run('skEditorHtml("zzzzz")'), /No shortcut matches/);
  // the settings page carries it
  assert.match(A.__run('keysSettingsHtml()'), /id="sk-ed"/); assert.match(A.__run('keysSettingsHtml()'), /Choose your own keys/); assert.match(A.__run('keysSettingsHtml()'), /data-pf="keys.hints"/, 'the old switch is still there');
  // phones and tablets: no keys, so nothing is bound on a device that has none (the window says so)
  assert.equal(run(A, 'skOn()'), true);
}

/* ---------- 13. what a person does is what they keep: the record is the only thing that changes ---------- */
{
  const A = dev(); set(A, 'newtask', ['Shift+K']);
  const snap = J(A.snapshot()); assert.equal(snap.shortcuts.length, 1, 'the snapshot (sync and backup) has the choices'); assert.equal(J(A.S.settings.keys || {}).shortcuts, undefined, 'and settings hold nothing about them');
  const B = dev(); B.replaceAll(snap); assert.deepEqual(eff(B, 'newtask'), ['Shift+K'], 'a restored backup brings them back');
  // wiping all data removes them (they are data); a fresh start has the defaults
  await B.wipeAll(); assert.equal(B.S.shortcuts.length, 0, 'deleting all data removes them'); assert.deepEqual(eff(B, 'newtask'), ['n'], 'and the defaults are back');
}

srv.server.close();
console.log('shortcuts: OK');
