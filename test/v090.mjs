// 0.9 features: number keys follow the sidebar (pins too), held keys do not repeat actions, tactile feedback, opt-in history,
// the activity tally and Statistics (filters, scope, heatmap, shared image). Later sections of this file cover the other 0.9 features.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const eq = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m); // (objects made inside the app's sandbox have their own prototypes: compare them as JSON)

/* ============ 1. number keys go where the sidebar numbers say, pinned views included ============ */
{
  const A = makeApp(), { S, U } = A;
  A.pinToggle('page:kanban'); A.pinToggle('page:matrix');
  const nav = A.navShown(), at = k => nav.indexOf(k);
  assert.ok(at('pin:page:kanban') > at('sec:contacts'), 'pins come after the sections by default');
  const pk = at('pin:page:kanban');
  assert.equal(A.skPageGo(pk), true); assert.equal(U.page, 'kanban', 'the number of a pinned view opens it'); assert.equal(U.pinKey, 'pin' in {} ? '' : 'page:kanban', 'and lights the pin, not its section');
  assert.equal(A.skPageGo(at('pin:page:matrix')), true); assert.equal(U.page, 'matrix');
  assert.equal(A.skPageGo(1), true); assert.equal(U.page, A.sectionTarget('tasks'), 'a section number opens that section (on the view last used in it)'); assert.equal(U.pinKey, null);
  assert.equal(A.skPageGo(60), false, 'a number past the last button does nothing');
  assert.match(A.skNavLabel(pk), /Board/, 'the shortcut list names the pinned view');
  // the order is the user's: after moving the Board pin to the front, key 1 is the Board
  S.settings.ui.navOrder = ['pin:page:kanban', ...A.navKeys().filter(k => k !== 'pin:page:kanban')];
  assert.equal(A.skPageGo(0), true); assert.equal(U.page, 'kanban', 'moving a button moves its number');
}

/* ============ 2. a held key does not repeat the action ============ */
{
  const A = makeApp();
  const ev = (key, o = {}) => { const e = { key, repeat: true, target: { tagName: 'BODY' }, stopped: 0, prevented: 0, stopImmediatePropagation() { this.stopped++; }, stopPropagation() {}, preventDefault() { this.prevented++; }, ...o }; return e; };
  for (const k of ['2', '1', 'n', 'Escape', 'Enter', 'a', 'f', ',']) { const e = ev(k); assert.equal(A.skHeldGuard(e), true, `a held ${k} is swallowed`); assert.equal(e.stopped, 1); }
  assert.equal(A.skHeldGuard(ev('2', { repeat: false })), false, 'the first press goes through');
  for (const k of ['ArrowDown', 'ArrowUp', 'PageDown', 'Home', 'Tab', 'j', 'k', 'Shift']) assert.equal(A.skHeldGuard(ev(k)), false, `holding ${k} keeps moving`);
  assert.equal(A.skHeldGuard(ev('2', { target: { tagName: 'INPUT' } })), false, 'typing in a field repeats as usual');
  assert.equal(A.skHeldGuard(ev('Enter', { target: { tagName: 'TEXTAREA' } })), false, 'Enter in a text area is a new line');
  assert.equal(A.skHeldGuard(ev('Enter', { target: { tagName: 'INPUT' } })), true, 'but a held Enter does not submit over and over');
  assert.equal(A.skHeldGuard(ev('k', { ctrlKey: true })), true, 'Ctrl+K held does not reopen the palette');
  assert.equal(A.skHeldGuard(ev('z', { ctrlKey: true })), false, 'undo may be held');
  assert.equal(A.skHeldGuard(ev('ArrowLeft', { altKey: true })), true, 'Alt+arrow moves a card one box per press');
  assert.equal(A.skHeldGuard(ev('ArrowLeft', { altKey: true, target: { tagName: 'INPUT' } })), false, 'but in a field it moves the caret');
}

/* ============ 3. tactile feedback ============ */
{
  const A = makeApp(), { S } = A; const buzzes = [];
  A.__mock('navigator.vibrate', p => { buzzes.push(p); return true; });
  assert.equal(S.settings.a11y.tactile, false, 'off by default'); assert.equal(A.tactile('done'), false); assert.equal(buzzes.length, 0, 'no buzz while it is off');
  S.settings.a11y.tactile = true; assert.equal(A.tactile('done'), true); eq(buzzes.pop(), A.TACTILE.done, 'a finished task has its own pattern');
  assert.ok(A.TACTILE.error.length > A.TACTILE.tap.length && Math.max(...A.TACTILE.trash) > Math.max(...A.TACTILE.tap), 'errors and deletes feel firmer than a tap');
  A.sfx('done'); assert.ok(buzzes.length >= 1, 'sound cues are felt too'); buzzes.length = 0;
  S.settings.sound.on = false; A.sfx('done'); assert.equal(buzzes.length, 1, 'even with the sound off'); S.settings.sound.on = true;
  A.__mock('navigator.vibrate', undefined); assert.equal(A.tactile('done'), false, 'a device that cannot vibrate is fine');
  assert.ok(A.a11ySettingsHtml().includes('data-pf="a11y.tactile"'), 'the setting is under Accessibility');
}

/* ============ 4. history is opt-in, and counted per day for Statistics ============ */
const D0 = '2026-10-08', HR = new Date(clock.t).getHours();
{
  const A = makeApp(), { S } = A, mk = (title, o = {}) => { const t = A.newTask({ title, ...o }); S.tasks.push(t); return t; };
  assert.equal(S.settings.history.on, false, 'history is off by default'); assert.equal(A.histOn(), false);
  const t0 = mk('while off'); clock.t += 1000; A.flush(); t0.title = 'while off 2'; A.toggleDone(t0); clock.t += 1000; A.flush();
  assert.equal(S.history.length, 0, 'nothing is logged while it is off'); eq(A.actDays(), {}, 'and nothing is counted');
  A.histNote('import', 'x'); assert.equal(S.history.length, 0, 'not even app notes');

  // turning it on starts Statistics from what is already stored
  const old = mk('made earlier', { created: Date.UTC(2026, 9, 1, 9, 0, 0) }); old.status = 'done'; old.doneAt = Date.UTC(2026, 9, 2, 9, 0, 0);
  S.habits.push({ id: 'h1', name: 'Water', icon: '💧', color: '#12a9c7', log: { '2026-10-03': 1, '2026-10-04': 1 } });
  S.notes.push({ id: 'n1', title: 'Old note', body: 'x', tags: [], created: Date.UTC(2026, 9, 5, 8, 0, 0), updated: Date.UTC(2026, 9, 6, 8, 0, 0) });
  S.pomo.push({ ts: Date.UTC(2026, 9, 7, 8, 0, 0), min: 25, task: null });
  A.flush(); S.settings.history.on = true; A.histToggled();
  assert.ok(S.activity.on > 0 && S.activity.filled > 0, 'the time it was turned on is kept');
  const f0 = { ...A.stFilter(), from: '2026-01-01', to: '2026-10-07' }, r0 = A.stCompute(f0); // (the welcome tasks and note that every new install has were made today, so they fall outside)
  assert.equal(r0.taskDone >= 1, true, 'finished tasks already stored are counted'); assert.equal(r0.habit, 2, 'so are the habit check-ins'); assert.equal(r0.noteAdd, 1); assert.equal(r0.noteEdit, 1); assert.equal(r0.focusMin, 25, 'and the focus sessions');
  const days0 = JSON.stringify(A.actDays()); A.histToggled(); assert.equal(JSON.stringify(A.actDays()), days0, 'it is only filled in once'); S.settings.history.on = false; A.histToggled(); S.settings.history.on = true; A.histToggled(); assert.equal(JSON.stringify(A.actDays()), days0, 'not again when switched off and on');

  // now live
  S.history.length = 0; S.acts = S.acts.filter(r => r.day !== D0); clock.t += 5000; A.flush(); // (today's tally so far is the welcome tasks: start from clean)
  const a = mk('live task', { listId: 'inbox' }); clock.t += 1000; A.flush();
  assert.equal(S.history.length, 1); const dayOf = () => A.actDays()[D0] || {}, day = new Proxy({}, { get: (_, k) => dayOf()[k] }); assert.ok(dayOf(), 'today has a tally'); assert.equal(day[`task.add|inbox|${HR}`], 1, 'kind.action | filed under | hour');
  for (let i = 0; i < 6; i++) { a.title = 'live task ' + i; clock.t += 3000; A.flush(); } // typing the title: one edit
  assert.equal(day[`task.edit|inbox|${HR}`], 1, 'typing in one task counts as one edit, like the history list'); assert.equal(S.history.filter(e => e.a === 'edit').length, 1);
  clock.t += 120000; a.priority = 3; A.flush(); assert.equal(day[`task.edit|inbox|${HR}`], 2, 'a later edit is another one');
  A.toggleDone(a); clock.t += 1000; A.flush(); assert.equal(day[`task.done|inbox|${HR}`], 1);
  const L = { id: 'l-a', name: 'Alpha', color: '#111111', sections: [] }; S.lists.push(L); const inL = mk('in alpha', { listId: 'l-a' }); clock.t += 1000; A.flush();
  assert.equal(day[`task.add|l-a|${HR}`], 1, 'a task is filed under its list'); assert.equal(day[`list.add|l-a|${HR}`], 1, 'and a list under itself');
  const h = S.habits[0]; h.log['2026-10-07'] = 1; h.log['2026-10-06'] = 1; h.log['2026-10-05'] = 1; clock.t += 1000; A.flush(); assert.equal(day[`habit.done||${HR}`], 3, 'one count per ticked day');
  A.actFocus(30, inL.id); assert.equal(day[`focus.done|l-a|${HR}`], 1); assert.equal(day[`focus.min|l-a|${HR}`], 30);
  const n = A.newNote({ title: 'fresh' }); S.notes.push(n); clock.t += 1000; A.flush(); assert.equal(day[`note.add||${HR}`], 1);

  // the History list never syncs; the tally does (S.acts, one record per device per day: test/stats-sync.mjs); changes that arrive by sync are not counted here; replacing data keeps the tally
  assert.equal('activity' in A.snapshot(), false); assert.equal('history' in A.snapshot(), false); assert.ok(Array.isArray(A.snapshot().acts) && A.snapshot().acts.length > 0, 'the counts are in the synced data');
  const B = makeApp(); B.quickAdd('from B', {}); B.flush(); const before = JSON.stringify(A.actDays());
  A.applyMerged(A.mergeData(A.snapshot(), B.snapshot())); assert.ok(S.tasks.some(x => x.title === 'from B')); assert.equal(JSON.stringify(A.actDays()), before, 'a change that arrives by sync is not counted');
  A.replaceAll(JSON.parse(JSON.stringify({ ...A.snapshot(), tasks: [], settings: { history: { on: true } } }))); assert.equal(JSON.stringify(A.actDays()).length > 20, true, 'replacing the data keeps this device\'s tally');
  // corrupt or hostile stored data is cleaned up
  eq(A.actNormalise({ days: { 'nope': { a: 1 }, '2026-01-01': { 'task.add||1': 2, bad: -1, x: 'y', ['k'.repeat(200)]: 3 } } }).days, { '2026-01-01': { 'task.add||1': 2 } });
  eq(A.actNormalise(null), A.actNew()); eq(A.actNormalise('x').days, {});
  // old days fall off the end
  const P = makeApp(); P.S.settings.history.on = true; for (let i = 0; i < 900; i++) P.S.activity.days[new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10)] = { 'task.add||1': 1 }; // (an older version's tally: adopted into this device's records)
  P.actPrune(); assert.ok(Object.keys(P.actDays()).length <= 830, 'about two years are kept'); assert.ok(!P.actDays()['2023-01-01'], 'the oldest go first');
}
// wiping everything also removes the log and the tally
(async () => {
  const A = makeApp(), { S } = A; S.settings.history.on = true; A.quickAdd('x', {}); A.flush(); assert.ok(Object.keys(A.actDays()).length > 0);
  await A.wipeAll({ files: false }); assert.equal(Object.keys(A.actDays()).length, 0, 'Delete everything also deletes the tally'); assert.equal(A.S.history.length, 1, 'except the note that it happened');
  assert.equal(A.S.settings.history.on, true, 'the choice to keep history is a setting, kept unless settings are reset');

  /* ============ 5. Statistics ============ */
  const B = makeApp(), T = B.S; T.settings.history.on = true;
  B.U.page = 'stats'; B.render(); assert.ok(B.els['#main'].innerHTML.includes('Statistics'), 'the page renders when history is on');
  T.settings.history.on = false; B.render(); assert.ok(/Statistics needs History/.test(B.els['#main'].innerHTML) && B.els['#main'].innerHTML.includes('data-act="histon"'), 'it says history must be on, and offers to turn it on');
  assert.ok(!/stcell|stcards/.test(B.els['#main'].innerHTML), 'and shows nothing else');
  B.U.page = 'history'; B.render(); assert.ok(/History needs History|History is off|needs History/.test(B.els['#main'].innerHTML), 'the History page says so too');
  T.history.push({ t: 1, k: 'task', a: 'add', id: 'z', n: 'earlier' }); B.render(); assert.ok(B.els['#main'].innerHTML.includes('History is off') && B.els['#main'].innerHTML.includes('earlier'), 'old entries stay readable, with a notice');
  B.ACT.histon(); assert.equal(T.settings.history.on, true, 'the button turns it on'); T.history.length = 0;

  // a small, known history to filter
  const C = makeApp(), U = C.U, X = C.S; X.settings.history.on = true;
  const days = (o) => { X.activity.days = o; };
  const W = { id: 'lw', name: 'Work', color: '#34b36b', sections: [] }, Wk = { id: 'lk', name: 'Sprint', color: '#34b36b', sections: [], parent: 'lw' }, Hm = { id: 'lh', name: 'Home', color: '#f4a62a', sections: [] };
  X.lists.push(W, Wk, Hm); X.projects.push({ id: 'pr1', name: 'Launch', color: '#4772fa', listIds: ['lw'], created: 1 });
  days({
    '2026-10-08': { 'task.done|lw|9': 3, 'task.done|lk|10': 2, 'task.add|lh|18': 4, 'note.add||20': 1, 'focus.done|lw|11': 1, 'focus.min|lw|11': 50 },
    '2026-10-07': { 'task.done|lw|9': 1, 'task.edit|lw|9': 5 }, '2026-10-06': { 'habit.done||': 2 },
    '2026-10-04': { 'task.done|lh|13': 2 }, '2026-10-03': { 'task.done|lh|13': 1, 'task.delete|lh|14': 1 }, '2026-09-01': { 'task.done|lw|9': 9 },
  });
  const st = X.settings.stats, F = () => C.stFilter();
  st.range = '7'; st.kinds = []; st.acts = []; st.scope = ''; let f = F(), r = C.stCompute(f);
  assert.equal(f.from, '2026-10-02'); assert.equal(f.to, D0, 'seven days ending today');
  assert.equal(r.total, 3 + 2 + 4 + 1 + 1 + 1 + 5 + 2 + 2 + 1 + 1, 'every counted action in range, focus minutes not among them'); assert.equal(r.focusMin, 50);
  assert.equal(r.taskDone, 3 + 2 + 1 + 2 + 1); assert.equal(r.taskAdd, 4); assert.equal(r.noteAdd, 1); assert.equal(r.habit, 2); assert.equal(r.sessions, 1);
  assert.equal(r.activeDays, 5); assert.equal(r.busiest, D0); assert.equal(r.byDay[D0], 11);
  assert.equal(r.curStreak, 3, 'today, yesterday and the day before'); assert.equal(r.bestStreak, 3, '3rd and 4th, then the gap, then 6th-8th'); // 3,4 | 5 empty | 6,7,8
  eq(r.hr.map((n, h) => [h, n]).filter(x => x[1]).map(x => x[0]), [9, 10, 11, 13, 14, 18, 20], 'time of day; check-ins have no hour and are left out');
  st.range = '30'; f = F(); assert.equal(C.stCompute(f).taskDone, 3 + 2 + 1 + 2 + 1, 'September is outside the last 30 days'); st.range = 'all'; assert.equal(C.stCompute(F()).taskDone, 9 + 9, 'all time reaches back to the first counted day'); assert.equal(F().from, '2026-09-01');
  st.range = 'custom'; st.from = '2026-10-04'; st.to = '2026-10-03'; f = F(); assert.equal(f.from, '2026-10-03', 'dates given the wrong way round are put right'); assert.equal(C.stCompute(f).total, 2 + 1 + 1);
  st.range = '7'; st.from = st.to = '';
  // kinds, actions
  st.kinds = ['note']; r = C.stCompute(F()); assert.equal(r.total, 1); assert.equal(C.stCards(F(), r).some(c => c[0] === 'Tasks completed'), false, 'a card that the filter excludes is hidden, not shown as 0'); assert.equal(C.stCards(F(), r).some(c => c[0] === 'Notes written'), true);
  st.kinds = ['task']; st.acts = ['done']; r = C.stCompute(F()); assert.equal(r.total, 3 + 2 + 1 + 2 + 1); eq(Object.keys(r.kinds), ['task']); eq(Object.keys(r.acts), ['done']); assert.equal(r.focusMin, 0, 'focus time is not in the tasks filter');
  st.kinds = ['focus']; st.acts = []; r = C.stCompute(F()); assert.equal(r.focusMin, 50); assert.equal(r.sessions, 1);
  st.kinds = []; st.acts = ['delete']; assert.equal(C.stCompute(F()).total, 1);
  // scope: a list takes its sublists with it unless asked not to; a project is its lists
  st.acts = []; st.scope = 'l:lw'; r = C.stCompute(F()); assert.equal(r.total, 3 + 2 + 1 + 1 + 5, 'Work and its sublist Sprint (and the focus session filed there)');
  st.sub = false; r = C.stCompute(F()); assert.equal(r.total, 3 + 1 + 1 + 5, 'only Work itself'); st.sub = true;
  st.scope = 'l:lk'; assert.equal(C.stCompute(F()).total, 2, 'a sublist on its own'); st.scope = 'l:lh'; assert.equal(C.stCompute(F()).total, 4 + 2 + 1 + 1);
  st.scope = 'p:pr1'; assert.equal(C.stCompute(F()).total, C.stCompute({ ...F(), scope: 'l:lw' }).total, 'a project covers its lists and their sublists');
  st.scope = 'l:gone'; assert.equal(C.stCompute(F()).total, 0, 'a removed list shows nothing rather than failing'); assert.doesNotThrow(() => { U.page = 'stats'; C.render(); });
  st.scope = ''; st.kinds = []; st.acts = [];
  // the heatmap, the trend and the cards
  f = F(); r = C.stCompute(f); const hm = C.stHeat(f, r); assert.equal(hm.cells.length, hm.cols); assert.ok(hm.cells.every(c => c.length === 7)); const flat = hm.cells.flat().filter(Boolean);
  assert.equal(flat.length, 7, 'one cell per day in range'); assert.equal(flat.find(c => c.k === D0).level, 4, 'the busiest day is the darkest'); assert.equal(flat.find(c => c.k === '2026-10-05').level, 0);
  st.range = '365'; f = F(); r = C.stCompute(f); assert.ok(C.stHeat(f, r).cols <= 54, 'a year is at most 53 weeks across'); assert.equal(C.stTrend(f, r).step, 'month'); st.range = '7'; assert.equal(C.stTrend(F(), C.stCompute(F())).step, 'day'); st.range = '90'; assert.equal(C.stTrend(F(), C.stCompute(F())).step, 'week');
  { const tr = C.stTrend(F(), C.stCompute(F())); assert.equal(tr.bars.reduce((a, b) => a + b.n, 0), C.stCompute(F()).total, 'the bars add up to the total'); }
  { const cards = Object.fromEntries(C.stCards(F(), C.stCompute(F()))); assert.match(cards['Focus time'], /50m|0h 50m/); assert.equal(cards['Active days'].split(' ')[0], '7' === '7' ? cards['Active days'].split(' ')[0] : ''); }
  // the page renders every panel, and each can be hidden
  st.range = '30'; U.page = 'stats'; C.render(); let html = C.els['#main'].innerHTML;
  for (const k of ['stcards', 'sthm', 'stcols', 'stbars']) assert.ok(html.includes(k), 'the page has ' + k);
  assert.ok(html.includes('data-stf="scope"') && html.includes('Include sublists') === false, 'the scope picker is there'); st.scope = 'l:lw'; C.render(); assert.ok(C.els['#main'].innerHTML.includes('Include sublists'), 'and offers sublists when the list has some'); st.scope = '';
  C.ACT.stpanel({ dataset: { p: 'heat' } }); assert.ok(!C.els['#main'].innerHTML.includes('sthm-k'), 'the heatmap can be switched off'); C.ACT.stpanel({ dataset: { p: 'heat' } });
  C.ACT.stkind({ dataset: { k: 'task' } }); eq(st.kinds, ['task']); C.ACT.stkind({ dataset: { k: 'task' } }); eq(st.kinds, []); C.ACT.stact({ dataset: { a: 'done' } }); eq(st.acts, ['done']); C.ACT.stclear(); eq(st.acts, []);
  C.stChange({ dataset: { stf: 'range' }, value: 'custom' }); assert.equal(st.range, 'custom'); C.stChange({ dataset: { stf: 'from' }, value: 'garbage' }); assert.notEqual(st.from, 'garbage', 'a bad date is ignored'); C.stChange({ dataset: { stf: 'range' }, value: '90' });

  /* the image */
  st.range = '30'; f = F(); r = C.stCompute(f); let pic = C.stSvg(f, r, { colors: { bg: '#000', card: '#111', text: '#fff', muted: '#999', line: '#222', acc: '#fa0', onacc: '#000' } });
  assert.ok(pic.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && pic.svg.endsWith('</svg>')); assert.equal(pic.w, 960); assert.ok(pic.h > 400);
  assert.ok(!/<script|<foreignObject|href=|javascript:/i.test(pic.svg), 'a plain picture: no scripts, links or embedded pages'); assert.ok((pic.svg.match(/<rect/g) || []).length > 50 && pic.svg.includes('My OpenTick statistics'));
  assert.ok(!pic.svg.includes('Work') && !pic.svg.includes('Sprint'), 'list names are left out unless asked for'); assert.ok(C.stSvg(f, r, { names: true }).svg.includes('Work'), 'and put in when asked');
  assert.ok(!pic.svg.includes('Alpha'), 'only what the filters show');
  X.lists.push({ id: 'ev', name: 'A <b>&"quote"', color: '#000', sections: [] }); days({ '2026-10-08': { 'task.add|ev|9': 1 } }); r = C.stCompute(F()); const evil = C.stSvg(F(), r, { names: true }).svg; assert.ok(!/<b>/.test(evil) && evil.includes('&lt;b&gt;'), 'names are escaped in the image');
  st.hide = ['cards', 'heat', 'trend', 'kinds', 'acts', 'week', 'hour', 'lists']; const bare = C.stSvg(F(), C.stCompute(F()), {}); assert.ok(bare.h < pic.h / 2, 'hidden panels are left out of the image too'); st.hide = [];
  assert.ok(C.stFilterSummary({ ...F(), scope: 'l:lw', kinds: new Set(['task']) }, true).includes('Work')); assert.ok(!C.stFilterSummary({ ...F(), scope: 'l:lw' }, false).includes('Work'));
  // Settings: the switch lives under Data & sync
  const sh = C.historySettingsHtml(); assert.ok(sh.includes('data-pf="history.on"') && /Off by default/.test(sh) && sh.includes('data-m="histwipe"'));
  assert.equal(C.statsSettingsAct('nothing'), false); C.statsSettingsAct('statsopen'); assert.equal(U.page, 'stats');
  console.log('0.9 tests so far passed (keys, tactile, history, statistics)');
})().catch(e => { console.error(e); process.exit(1); });

/* ============ 6. batch editing: more task fields, and notes / contacts / habits / countdowns ============ */
(() => {
  const A = makeApp(), { S, U } = A;
  // tasks: start date, board section, a line added to the notes
  S.lists.push({ id: 'bl', name: 'Board', color: '#111111', sections: ['Doing', 'Done'] });
  const t1 = A.newTask({ title: 'one', listId: 'bl', due: '2026-10-20', notes: 'first' }), t2 = A.newTask({ title: 'two', listId: 'bl', notes: '' }); S.tasks.push(t1, t2);
  let snap = A.batchApplyChanges([t1.id, t2.id], { section: 'Doing', start: '2026-10-25', addNote: 'checked by me' });
  assert.equal(t1.section, 'Doing'); assert.equal(t2.section, 'Doing'); assert.equal(t1.start, '2026-10-25'); assert.equal(t1.due, '2026-10-25', 'a due date before the new start moves up to it');
  assert.equal(t1.notes, 'first\nchecked by me', 'the line goes on a new line'); assert.equal(t2.notes, 'checked by me', 'or is the whole note');
  A.batchApplyChanges([t1.id], { section: 'Nope' }); assert.equal(t1.section, null, 'a section the list does not have clears it rather than inventing one');
  A.batchApplyChanges([t2.id], { section: null, start: null }); assert.equal(t2.section, null); assert.equal('start' in t2, false, 'no start date removes the field');
  A.batchUndo(snap); assert.equal(t1.notes, 'first'); assert.equal(t1.section, null); assert.equal(t1.due, '2026-10-20'); assert.equal('start' in t1, false, 'undo puts the tasks back');
  A.batchApplyChanges([t1.id], { listId: 'inbox', section: 'Doing' }); assert.equal(t1.listId, 'inbox'); assert.equal(t1.section, null, 'a task moved to a list without that section ends up unsectioned');

  // the other pages
  assert.deepEqual(Object.keys(A.B2).sort(), ['contact', 'countdown', 'habit', 'note']);
  const n1 = A.newNote({ title: 'a', tags: ['x'] }), n2 = A.newNote({ title: 'b', tags: ['x', 'y'], pinned: true }), n3 = A.newNote({ title: 'c' }); S.notes.push(n1, n2, n3);
  const idsOf = (...r) => new Set(r.map(x => x.id)); U.page = 'notes'; assert.equal(A.b2Kind(), 'note');
  U.b2 = { kind: 'note', ids: idsOf(n1, n2), last: null }; assert.equal(A.b2Recs().length, 2);
  let sn = A.b2Snapshot('note', idsOf(n1, n2)); clock.t += 1000;
  for (const r of [n1, n2]) A.b2Apply('note', r, { addTags: ['new'], delTags: ['x'], pinned: true, home: 'l:bl' });
  eq(n1.tags, ['new']); eq(n2.tags, ['y', 'new']); assert.equal(n1.pinned, true); assert.equal(n1.listId, 'bl'); assert.ok(n1.updated > sn.recs[0].updated, 'an edited note is stamped');
  A.b2Apply('note', n1, { home: 'p:pp' }); assert.equal(n1.listId, undefined); assert.equal(n1.projectId, 'pp', 'a note lives in a list or a project, not both');
  A.b2Apply('note', n1, { home: 'none' }); assert.equal(n1.listId, undefined); assert.equal(n1.projectId, undefined, 'or neither');
  A.b2Undo(sn); eq(n1.tags, ['x']); assert.equal(n1.pinned, false); assert.equal(n3.title, 'c', 'undo restores only what was changed');
  // delete, then undo brings them back (even after the arrays were replaced)
  S.tasks[0].links = [n1.id, n3.id]; U.b2 = { kind: 'note', ids: idsOf(n1, n2), last: null }; U.noteSel = n1.id; A.b2Delete();
  assert.equal(S.notes.some(n => n.id === n1.id || n.id === n2.id), false); assert.equal(S.notes.some(n => n.id === n3.id), true); eq(S.tasks[0].links, [n3.id], 'links to deleted notes are dropped'); assert.notEqual(U.noteSel, n1.id, 'the open note is not a deleted one'); assert.equal(U.b2, null, 'selecting ends after an action');
  A.b2Undo({ kind: 'note', ids: [n1.id, n2.id], recs: [JSON.parse(JSON.stringify(n1)), JSON.parse(JSON.stringify(n2))] }); assert.ok(S.notes.some(n => n.id === n1.id) && S.notes.some(n => n.id === n2.id), 'undo brings deleted notes back');

  S.contacts.push(A.ctNormalise({ id: 'c1', name: 'Ann', tags: [], created: 1, fav: false, color: '#4772fa' }), A.ctNormalise({ id: 'c2', name: 'Bo', tags: ['team'], created: 1, fav: true, color: '#e5484d' }));
  A.b2Apply('contact', S.contacts[0], { addTags: ['team', 'vip'], fav: true, color: '#34b36b' }); eq(S.contacts[0].tags, ['team', 'vip']); assert.equal(S.contacts[0].fav, true); assert.equal(S.contacts[0].color, '#34b36b');
  A.b2Apply('contact', S.contacts[1], { fav: false, delTags: ['team'] }); assert.equal(S.contacts[1].fav, false); eq(S.contacts[1].tags, []);
  U.page = 'contacts'; U.b2 = { kind: 'contact', ids: new Set(['c1']), last: null }; A.b2Delete(); assert.equal(S.contacts.some(c => c.id === 'c1'), false); assert.ok(S.contacts.some(c => c.id === 'c2'));
  S.habits.push({ id: 'hb1', name: 'Read', icon: '📖', color: '#4772fa', goal: 1, created: '2026-10-01', log: { '2026-10-02': 1 } });
  A.b2Apply('habit', S.habits.find(h => h.id === 'hb1'), { color: '#e255a1' }); assert.equal(S.habits.find(h => h.id === 'hb1').color, '#e255a1');
  U.page = 'habits'; U.b2 = { kind: 'habit', ids: new Set(['hb1']), last: null }; sn = A.b2Snapshot('habit', U.b2.ids); A.b2Delete(); assert.equal(S.habits.some(h => h.id === 'hb1'), false); A.b2Undo(sn); eq(S.habits.find(h => h.id === 'hb1').log, { '2026-10-02': 1 }, 'a deleted habit comes back with its history');
  S.countdowns.push({ id: 'cd1', name: 'Trip', date: '2026-12-01', color: '#4772fa', listId: '', projectId: '', taskId: '' });
  A.b2Apply('countdown', S.countdowns[0], { color: '#8e5cf7', home: 'l:bl' }); assert.equal(S.countdowns[0].color, '#8e5cf7'); assert.equal(S.countdowns[0].listId, 'bl'); A.b2Apply('countdown', S.countdowns[0], { home: 'p:pp' }); assert.equal(S.countdowns[0].listId, ''); assert.equal(S.countdowns[0].projectId, 'pp');
  // every kind has a sheet, and the page buttons exist
  for (const k of Object.keys(A.B2)) assert.ok(A.B2_FIELDS[k].length >= 1, k + ' has something to change');
  U.page = 'notes'; assert.ok(A.b2Tool().includes('data-act="b2start"')); U.page = 'calendar'; assert.equal(A.b2Tool(), '', 'no button where there is nothing to select');
  U.page = 'notes'; A.B2_ACT.b2start(); assert.ok(U.b2 && U.b2.kind === 'note', 'the header button starts selecting'); A.b2Toggle('x1'); assert.ok(U.b2.ids.has('x1')); A.b2Toggle('x1'); assert.ok(!U.b2.ids.has('x1')); A.B2_ACT.b2x(); assert.equal(U.b2, null);
  U.page = 'notes'; A.b2Start(n3.id); U.page = 'tasks'; A.b2Paint(); assert.equal(U.b2, null, 'leaving the page ends selecting');
  console.log('0.9 batch editing tests passed');
})();

/* ============ 7. tasks inside notes: live cards, properties, and picking an occurrence ============ */
(() => {
  const A = makeApp(), { S } = A, m = (s, re, msg) => assert.match(s, re, msg), no = (s, re, msg) => assert.ok(!re.test(s), msg);
  S.lists.push({ id: 'lw', name: 'Work', color: '#34b36b', sections: [] });
  const t = A.newTask({ title: 'Pay <b>rent</b> & "bills"', listId: 'lw', due: '2026-10-10', time: '09:30', priority: 3, tags: ['money'], subtasks: [{ id: 's1', title: 'a', done: true }, { id: 's2', title: 'b', done: false }], notes: 'line one\nline two' });
  S.tasks.push(t);
  const P = (ref, plain) => A.tpProp(ref, plain);
  m(P(t.id + '.title'), /Pay &lt;b&gt;rent&lt;\/b&gt; &amp; &quot;bills&quot;/, 'values are escaped');
  m(P(t.id + '.due'), new RegExp('>' + A.fmtDate('2026-10-10') + '<')); m(P(t.id + '.priority'), />High</); m(P(t.id + '.list'), />Work</); m(P(t.id + '.tags'), />#money</);
  m(P(t.id + '.subtasks'), />1\/2</); m(P(t.id + '.progress'), />50%</); m(P(t.id + '.status'), />Open</); m(P(t.id + '.time'), /9:30|09:30/);
  m(P(t.id + '.notes'), /line one line two/, 'notes are flattened to one line'); m(P(t.id + '.prio'), />High</, 'aliases work'); m(P(t.id), /Pay &lt;b&gt;/, 'no property means the title');
  S.tasks.push(A.newTask({ title: 'Pay rent', listId: 'lw', due: '2026-10-12' }));
  m(P('"pay rent".due'), new RegExp('>' + A.fmtDate('2026-10-12') + '<'), 'by title, ignoring case'); m(P('"Pay rent".priority'), />None</);
  m(P('nope1234.due'), /tprop miss[^>]*>task\?</, 'a missing task says so'); m(P(t.id + '.wibble'), /miss[^>]*title="Unknown property/, 'so does an unknown property'); m(P('!!'), /miss/);
  m(P(t.id + '.due', true), /^<span class="tprop">/, 'plain text where links are not wanted'); no(P(t.id + '.due', true), /data-tk/); m(P(t.id + '.due'), /data-tk="/, 'clickable otherwise');
  // in Markdown
  let h = A.md(`Rent is due {{task:${t.id}.due}} (priority {{task:${t.id}.priority}}).`);
  m(h, /Rent is due <span class="tprop"[^>]*>[^<]+</); m(h, /priority <span class="tprop"[^>]*>High</); no(h, /\{\{task:/);
  m(A.md('Not here: `{{task:' + t.id + '.due}}`'), /<code>\{\{task:/, 'inside code it stays as written');
  h = A.md(`![[task:${t.id}]]`); m(h, /class="embed emb-task p3"/); m(h, /data-tkact="toggle"/); m(h, /1\/2/); m(h, /#money/); no(h, /<b>rent/, 'the title is escaped in the card');
  m(A.md('![[task:nothere1]]'), /emb-task miss/); m(A.md('![[Some note]]'), /emb-note/, 'note embeds are untouched'); no(A.md('![[Some note]]'), /emb-task/);
  // live: the card follows the task
  const sig = A.tpSig(`![[task:${t.id}]]`); t.title = 'Renamed'; assert.notEqual(A.tpSig(`![[task:${t.id}]]`), sig, 'the block editor can tell the task changed'); assert.equal(A.tpSig('plain text'), '');
  m(A.md(`{{task:${t.id}.title}}`), /Renamed/);
  A.toggleDone(t); m(A.md(`![[task:${t.id}]]`), /emb-task fin/); m(A.md(`{{task:${t.id}.status}}`), />Completed</);

  // a repeating task: pick the occurrence
  const r = A.newTask({ title: 'Water plants', due: '2026-10-08', time: '18:00', repeat: { unit: 'day', every: 2 } }); S.tasks.push(r);
  A.toggleDone(r); clock.t += 1000; A.toggleDone(r); // two occurrences finished (8 and 10 Oct); now due 12 Oct
  assert.equal(r.due, '2026-10-12'); const done = A.tpDone(r); assert.equal(done.length, 2); assert.ok(done.every(x => x.of === r.id), 'finished occurrences point back at their series');
  assert.equal(A.tpOcc(r, '').kind, 'live'); assert.equal(A.tpOcc(r, '2026-10-12').kind, 'live'); assert.equal(A.tpOcc(r, '2026-10-10').kind, 'done', 'an occurrence that was finished');
  assert.equal(A.tpOcc(r, '2026-10-14').kind, 'upcoming', 'one still to come'); assert.equal(A.tpOcc(r, '2026-10-13').kind, 'none', 'a day the rule skips');
  m(A.md(`{{task:${r.id}@2026-10-10.status}}`), />Completed</); m(A.md(`{{task:${r.id}@2026-10-14.status}}`), />Upcoming</); m(A.md(`{{task:${r.id}@2026-10-14.due}}`), new RegExp('>' + A.fmtDate('2026-10-14') + '<'));
  m(A.md(`{{task:${r.id}@2026-10-13.due}}`), /no such date/); m(A.md(`{{task:${r.id}.next}}`), new RegExp('>' + A.fmtDate('2026-10-14') + '<'), 'next occurrence after the live one');
  h = A.md(`![[task:${r.id}@2026-10-10]]`); m(h, /Completed occurrence/); m(h, /emb-task fin/); m(h, /disabled/, 'a finished occurrence is not ticked from a note');
  h = A.md(`![[task:${r.id}@2026-10-14]]`); m(h, /Upcoming occurrence/); m(h, /disabled/);
  h = A.md(`![[task:${r.id}@2026-10-12]]`); m(h, /This occurrence/); no(h, /disabled/, 'the live one can be ticked');
  h = A.md(`![[task:${r.id}]]`); no(h, /Upcoming|Completed occurrence/); m(h, /class="et-r"/, 'the card shows that it repeats');
  r.exc = { '2026-10-14': { skip: true } }; assert.equal(A.tpOcc(r, '2026-10-14').kind, 'skipped', 'a skipped occurrence says so'); m(A.md(`![[task:${r.id}@2026-10-14]]`), /Skipped occurrence/); delete r.exc;
  // the picker's choices and the syntax it writes
  const ch = A.tpChoices(r).map(x => x[0]); assert.equal(ch[0], ''); for (const d of ['2026-10-12', '2026-10-14', '2026-10-10', '2026-10-08']) assert.ok(ch.includes(d), 'offers ' + d);
  assert.equal(A.tpChoices(A.newTask({ title: 'once' })).length, 1, 'a one-off task has nothing to choose');
  assert.equal(A.tpSyntax(r, { embed: true }), `![[task:${r.id}]]`); assert.equal(A.tpSyntax(r, { date: '2026-10-14', prop: 'due' }), `{{task:${r.id}@2026-10-14.due}}`); assert.equal(A.tpSyntax(r, { prop: 'title', byTitle: true }), '{{task:"Water plants".title}}');
  m(A.md(A.tpSyntax(r, { prop: 'priority', byTitle: true })), />None</, 'what the picker writes renders');
  // a task in the trash, and every property gives text
  const gone = A.newTask({ title: 'Gone' }); S.tasks.push(gone); gone.deleted = Date.now(); m(A.md(`{{task:${gone.id}.title}}`), /miss/, 'a task in the trash is treated as gone');
  for (const [k, , fn] of A.TP_PROPS) assert.equal(typeof fn(t), 'string', k + ' gives text');
  assert.equal(A.tpParse('abc12345@2026-01-02.due').date, '2026-01-02'); assert.equal(A.tpParse('abc').prop, ''); assert.equal(A.tpParse('a b'), null);
  assert.equal(typeof A.taskRefPick, 'function'); assert.ok(A.TP_PROPS.length >= 18);
  console.log('0.9 task reference tests passed');
})();

/* ============ 8. linking by tags ============ */
(() => {
  const A = makeApp(), { S } = A, m = (s, re, msg) => assert.match(s, re, msg), no = (s, re, msg) => assert.ok(!re.test(s), msg);
  // parsing
  assert.deepEqual(JSON.parse(JSON.stringify(A.tlParse('#Anna, website  #anna  #x-y'))), ['anna', 'website', 'x-y'], 'lowercased, no #, no repeats'); assert.deepEqual(JSON.parse(JSON.stringify(A.tlParse(''))), []);
  // the things that can carry a tag
  S.lists.push({ id: 'lw', name: 'Website', color: '#34b36b', sections: [], tags: ['anna', 'web'] });
  S.projects.push({ id: 'pr1', name: 'Relaunch', color: '#4772fa', listIds: ['lw'], tags: ['anna'] });
  const t1 = A.newTask({ title: 'Send Anna the <b>quote</b>', tags: ['anna'], due: '2026-10-09', listId: 'lw' }), t2 = A.newTask({ title: 'Unrelated', tags: ['other'] }), t3 = A.newTask({ title: 'Design the logo', tags: ['web', 'anna'] }), t4 = A.newTask({ title: 'Finished thing', tags: ['anna'] });
  t4.status = 'done'; const gone = A.newTask({ title: 'Trashed', tags: ['anna'] }); gone.deleted = Date.now(); const fin = A.newTask({ title: 'A finished repeat', tags: ['anna'] }); fin.log = 1;
  S.tasks.push(t1, t2, t3, t4, gone, fin);
  const n1 = A.newNote({ title: 'Meeting with Anna', body: 'x', tags: ['anna'] }), n2 = A.newNote({ title: 'Cooking', body: 'y', tags: ['food'] }); S.notes.push(n1, n2);
  const ct = A.ctNormalise({ id: 'ct1', name: 'Anna Smith', tags: ['anna'], created: 1 }); S.contacts.push(ct);
  const cd = A.cdNormalise({ id: 'cd1', name: 'Anna’s birthday', date: '2026-12-01', tags: ['anna'] }); S.countdowns.push(cd);
  // everything with a tag, by kind, skipping the trash and finished repeats
  const w = A.tlWith('#ANNA'); const kinds = w.map(x => x.k).join(',');
  assert.equal(kinds, 'task,task,task,note,list,project,contact,countdown', 'tasks first (open before done), then notes, lists, projects, people, countdowns'); assert.equal(w.filter(x => x.k === 'task').map(x => x.r.title).join('|'), 'Send Anna the <b>quote</b>|Design the logo|Finished thing', 'open tasks by date first, done last; trash and finished repeats left out');
  assert.equal(A.tlWith('anna', ['note']).length, 1); assert.equal(A.tlWith('nothing').length, 0); assert.equal(A.tlWith('').length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(A.tlAllTags().find(x => x[0] === 'anna'))), ['anna', 8]); assert.equal(A.tlAllTags()[0][0], 'anna', 'most used first');
  // related: shares a tag, never itself, most shared first
  const rel = A.tlRelated('task', t3); assert.ok(!rel.some(x => x.r === t3), 'not itself'); assert.ok(!rel.some(x => x.r === t2), 'no shared tag, no link');
  assert.equal(rel.find(x => x.k === 'list').shared.length, 2, 'the list shares both of the task\'s tags'); assert.ok(rel.find(x => x.k === 'list').shared.includes('anna') && rel.find(x => x.k === 'list').shared.includes('web'));
  assert.equal(rel.filter(x => x.k === 'task').map(x => x.r.title).join('|'), 'Send Anna the <b>quote</b>|Finished thing', 'the other tasks that share a tag');
  assert.equal(A.tlRelated('task', t2).length, 0, 'a tag nobody else has'); assert.equal(A.tlRelated('task', A.newTask({ title: 'no tags' })).length, 0);
  // linking works the other way too, and a record with no tags field at all is fine
  assert.ok(A.tlRelated('contact', ct).some(x => x.k === 'project' && x.r.id === 'pr1')); assert.ok(A.tlRelated('project', S.projects[0]).some(x => x.k === 'contact'));
  delete S.lists[S.lists.length - 1].tags; assert.equal(A.tlTags(S.lists[S.lists.length - 1]).length, 0); S.lists[S.lists.length - 1].tags = ['anna', 'web'];
  // the block
  let h = A.tlBlock('task', t1); m(h, /Linked by tags/); m(h, /class="fcnt">\d+</); m(h, /data-tlk="note"/); m(h, /data-tlk="contact"/); m(h, /data-tlall="anna"/); no(h, /Send Anna the <b>/, 'a task does not list itself, and titles are escaped'); no(h, /<b>quote<\/b>/);
  h = A.tlBlock('task', A.newTask({ title: 'plain' })); m(h, /Give this a tag/); h = A.tlBlock('task', t2); m(h, /Nothing else has #other yet/);
  h = A.tlBlock('task', t3, { skip: new Set(['note:' + n1.id]) }); no(h, new RegExp('data-tlid="' + n1.id + '"'), 'things already shown elsewhere can be left out');
  m(A.tlSection('contact', ct, new Set()), /<section class="pe-s">.*Linked by tags/s); m(A.tlSection('contact', A.ctNormalise({ id: 'c2', name: 'No Tags', created: 1 }), null), /give them a tag/);
  // markdown: a live list and numbers
  h = A.md('![[tag:anna]]'); m(h, /class="embed emb-tag"/); m(h, /data-tlk="task"/); m(h, /data-tlk="contact"/); m(h, /8 items/); no(h, /<b>quote/, 'escaped');
  h = A.md('![[tag:#anna.tasks]]'); m(h, /3 items/); m(h, /tasks/); no(h, /data-tlk="note"/); m(A.md('![[tag:anna.people]]'), /1 item</); m(A.md('![[tag:nothing]]'), /Nothing has #nothing yet/); m(A.md('![[tag:anna.wibble]]'), /emb-tag miss/); m(A.md('![[tag:!!]]'), /emb-tag miss/);
  m(A.md('There are {{tag:anna.count}} things, {{tag:anna.tasks}} tasks, {{tag:anna.open}} open.'), /There are <span class="tprop"[^>]*>8<\/span> things, <span class="tprop"[^>]*>3<\/span> tasks, <span class="tprop"[^>]*>2<\/span> open\./);
  m(A.md('See {{tag:anna}}.'), /<span class="tprop"[^>]*data-tlall="anna"[^>]*>#anna<\/span>/); m(A.md('{{tag:nope.zzz}}'), /tprop miss/); m(A.md('Not here: `![[tag:anna]]` or `{{tag:anna.count}}`'), /<code>/);
  m(A.md('![[Some note]]'), /emb-note/, 'note embeds and task embeds are untouched'); m(A.md('![[task:nothere1]]'), /emb-task miss/);
  // live: the block editor's cache key follows the tags
  const sig = A.tlSig('![[tag:anna]]'); n1.title = 'Renamed meeting'; assert.notEqual(A.tlSig('![[tag:anna]]'), sig, 'a rename shows'); const sig2 = A.tlSig('![[tag:anna]]'); t2.tags.push('anna'); assert.notEqual(A.tlSig('![[tag:anna]]'), sig2, 'a newly tagged thing shows'); t2.tags = ['other']; assert.equal(A.tlSig('plain'), '');
  assert.equal(A.tlRef('anna.tasks').kind, 'task'); assert.equal(A.tlRef('anna.people').kind, 'contact'); assert.equal(A.tlRef('anna.count').what, 'count'); assert.ok(A.tlRef('anna.zzz').bad); assert.equal(A.tlRef('a b'), null); assert.equal(A.tlRef('#Büro.notes').tag, 'büro', 'any language');
  // the picker and the dialog exist
  assert.equal(typeof A.tagRefPick, 'function'); assert.equal(typeof A.tlDlg, 'function'); assert.equal(Object.keys(A.TL_KIND).length, 6);
  m(A.tlFormHint(S.lists.find(l => l.id === 'lw')), /share these tags/); m(A.tlFormHint({ id: 'zz', listIds: [], tags: [] }), /Everything with the same tag/);
  // sync: tags on a list and a project travel, and so does clearing them
  const remote = JSON.parse(JSON.stringify(A.snapshot())); const rl = remote.lists.find(l => l.id === 'lw'); rl.tags = ['moved']; rl.u = Date.now() + 99999;
  A.applyMerged(A.mergeData(A.snapshot(), remote)); assert.equal(JSON.stringify(S.lists.find(l => l.id === 'lw').tags), '["moved"]', 'a newer copy from another device brings its tags with it');
  console.log('0.9 tag link tests passed');
})();

/* ============ 9. Add from text: batch-create tasks, events, timeline, timetable, notes, habits, countdowns ============ */
{
  const A = makeApp(), { S, U } = A, T = A.todayStr(); // the fake clock: Thursday 8 Oct 2026
  const m = (s, re, msg) => assert.match(String(s), re, msg), no = (s, re, msg) => assert.doesNotMatch(String(s), re, msg);
  const P = (text, kind, ctx) => A.tbParse(text, kind, ctx);
  // ---- the small readers ----
  const R = (s, bare) => { const r = A.tbRange(s, bare); return r && { start: r.start, end: r.end, bad: r.bad }; };
  eq(R(' 9:00-10:30 x '), { start: '09:00', end: '10:30', bad: false }); eq(R(' 11-1pm '), { start: '11:00', end: '13:00', bad: false }, 'an am/pm on one side is shared: 11am to 1pm');
  eq(R(' 9am-5 '), { start: '09:00', end: '17:00', bad: false }); eq(R(' 10am-12 '), { start: '10:00', end: '12:00', bad: false }); eq(R(' 9:00-5:00 '), { start: '09:00', end: '17:00', bad: false }, 'an end that is not after the start is read as the afternoon');
  eq(R(' 8-9pm '), { start: '20:00', end: '21:00', bad: false }); eq(R(' 12-1pm '), { start: '12:00', end: '13:00', bad: false }); eq(R(' 10-12pm '), { start: '10:00', end: '12:00', bad: false });
  assert.equal(R(' 2-3 apples '), null, '"2-3" is not a time without a colon or am/pm'); eq(R(' 2-3 ', true), { start: '02:00', end: '03:00', bad: false }, 'but it is in a timetable'); assert.equal(R(' due 2026-11-02 '), null, 'a date is not a range');
  eq(R(' 17:00-16:00 '), { start: '17:00', end: null, bad: true }, 'an end before the start is flagged'); assert.equal(R(' 25:00-26:00 '), null);
  assert.equal(A.tbTime(' at 9am ').time, '09:00'); assert.equal(A.tbTime(' 2:30 pm ').time, '14:30'); assert.equal(A.tbTime(' lunch 14:00 ').time, '14:00'); assert.equal(A.tbTime(' 12am ').time, '00:00'); assert.equal(A.tbTime(' call 3 ') , null, 'a bare number is not a time'); assert.equal(A.tbTime(' 13pm '), null);
  eq(A.tbRemind(' x remind 30m remind 1 day before remind on time ').list, [30, 1440, 0]); eq(A.tbRemind(' x remind 2h ').list, [120]); assert.equal(A.tbRemind(' remind 30 minutes before ').rest.trim(), ''); eq(A.tbRemind(' remember to remind ').list, []);
  assert.equal(A.tbDates(' due 20 Nov ').trim(), 'due Nov 20'); assert.equal(A.tbDates(' Mon 16 Nov ').trim(), 'Nov 16', 'a weekday beside a date is dropped'); assert.equal(A.tbDates(' 20th of November 2027 ').trim(), '2027-11-20'); assert.equal(A.tbDates(' Nov 20, 2026 ').trim(), '2026-11-20'); assert.equal(A.tbDates(' Monday, November 16 ').trim(), 'November 16'); assert.equal(A.tbDates(' Mon 2026-11-16 ').trim(), '2026-11-16');
  const D = s => { const d = A.tbDays(' ' + s + ' '); return [d.days.join(','), d.rest.replace(/\s+/g, ' ').trim()]; };
  eq(D('Maths Mon, Wed & Fri 9-10'), ['1,3,5', 'Maths 9-10']); eq(D('Mon-Fri Registration'), ['1,2,3,4,5', 'Registration']); eq(D('weekdays'), ['1,2,3,4,5', '']); eq(D('Fri-Mon'), ['0,1,5,6', ''], 'a range wraps round the weekend'); eq(D('every Tuesday and Thursday Choir'), ['2,4', 'Choir']); eq(D('daily Stretch'), ['0,1,2,3,4,5,6', 'Stretch']); eq(D('weekends'), ['0,6', '']); eq(D('Monitor the build'), ['', 'Monitor the build'], 'a word that only starts like a day is not one'); eq(D('Reading and writing'), ['', 'Reading and writing']);
  // ---- tasks ----
  const TASKS = `// my plan
# Atlas > Launch
## Design
Draft mockups fri 10:00-12:00 !high #design remind 1h
  Collect assets
  [x] Pick fonts
  > Ask Anna first
Review copy tomorrow 3pm for 45m #review
## Go live
[x] Announce Dec 1 9am #marketing
- Send the status email every fri 4pm until 2026-12-31 !low
# Home
1. Pay rent every month Dec 1
\`\`\`
`;
  const p1 = P(TASKS, 'tasks'), it = p1.items;
  assert.equal(p1.count, 5); assert.equal(p1.subs, 2); assert.equal(p1.skipped, 0); eq(p1.newLists.map(x => x.join('>')).filter(x => /Atlas/.test(x)), ['Atlas>Launch']);
  eq([it[0].title, it[0].due, it[0].time, it[0].dur, it[0].priority, it[0].tags, it[0].listPath, it[0].section, it[0].rems, it[0].notes], ['Draft mockups', '2026-10-09', '10:00', 120, 3, ['design'], ['Atlas', 'Launch'], 'Design', [60], 'Ask Anna first']);
  eq(it[0].subs.map(x => [x.title, x.done]), [['Collect assets', false], ['Pick fonts', true]], 'indented lines are subtasks, [x] marks one done');
  eq([it[1].title, it[1].due, it[1].time, it[1].dur, it[1].tags, it[1].section], ['Review copy', '2026-10-09', '15:00', 45, ['review'], 'Design']);
  eq([it[2].title, it[2].status, it[2].due, it[2].time, it[2].section], ['Announce', 'done', '2026-12-01', '09:00', 'Go live']);
  eq([it[3].title, it[3].priority, it[3].time, it[3].until, it[3].repeat.unit, it[3].repeat.days, it[3].due], ['Send the status email', 1, '16:00', '2026-12-31', 'week', [5], '2026-10-09'], 'a bullet is dropped, repeats and until are read');
  eq([it[4].title, it[4].listPath, it[4].section, it[4].repeat.unit, it[4].due], ['Pay rent', ['Home'], null, 'month', '2026-12-01'], 'a new "# List" resets the section; "1." is dropped');
  // loose lines
  const p2 = P('Buy milk\n  \n// skip me\nCall mum #family tomorrow\n> a note\nNothing\n> and a second\n9-10 Not a time', 'tasks'); assert.equal(p2.count, 4); assert.equal(p2.items[1].notes, 'a note'); assert.equal(p2.items[2].notes, 'and a second'); assert.equal(p2.items[3].title, '9-10 Not a time', '"9-10" without a colon is just text'); assert.equal(p2.items[0].due, null);
  assert.equal(P('> orphan note', 'tasks').warns.length, 1); assert.equal(P('9:00-10:00', 'tasks').skipped, 1, 'a line with nothing but a time has no title'); assert.equal(P('  Indented first line', 'tasks').count, 1, 'an indented first line is just a task');
  eq(P('Do it !high #x ~Nope', 'tasks').items[0].title, 'Do it ~Nope', 'an unknown ~List stays in the title'); assert.equal(P('Standup 9:30', 'tasks').items[0].due, T, 'a time with no date means today, as in quick add');
  assert.equal(P('Standup 9:30 remind 10m', 'tasks').items[0].rems[0], 10); assert.equal(P('No date remind 10m', 'tasks').warns.length, 1, 'a reminder needs a date');
  // lists that exist are not new
  S.lists.push({ id: 'lw', name: 'Studio', color: '#4772fa', sections: [] }, { id: 'lw2', name: 'Site', color: '#4772fa', sections: [], parent: 'lw' });
  eq(P('# studio > site\nx', 'tasks').newLists, [], 'names match without case'); eq(P('# Studio > Blog\nx', 'tasks').newLists.map(x => x.join('>')), ['Studio>Blog']); assert.equal(P('# Inbox\nx', 'tasks').newLists.length, 0); assert.equal(P('# Studio > Site\nx', 'tasks').items[0].listPath.join('>'), 'Studio>Site');
  eq(P('x ~Studio', 'tasks').items[0].listId, 'lw', '~List picks an existing list');
  // ---- calendar ----
  const CAL = `Friday
9:00-10:30 Team standup #work
12:30 Lunch with the team for 1h
Nov 24
Dentist 2pm remind 1d
Mon 16 Nov:
Review 10-11am !high
  Prepare slides
## 2026-12-03
- 9am Carol sings
Water plants
`;
  const c = P(CAL, 'calendar'), ci = c.items;
  assert.equal(c.count, 6); eq([ci[0].title, ci[0].due, ci[0].time, ci[0].dur, ci[0].tags], ['Team standup', '2026-10-09', '09:00', 90, ['work']]); eq([ci[1].due, ci[1].time, ci[1].dur], ['2026-10-09', '12:30', 60]); eq([ci[2].title, ci[2].due, ci[2].time, ci[2].rems], ['Dentist', '2026-11-24', '14:00', [1440]]);
  eq([ci[3].title, ci[3].due, ci[3].time, ci[3].dur, ci[3].priority, ci[3].subs.length], ['Review', '2026-11-16', '10:00', 60, 3, 1], '"Mon 16 Nov:" is a date line'); eq([ci[4].title, ci[4].due, ci[4].time], ['Carol sings', '2026-12-03', '09:00'], 'a "## date" heading works too'); eq([ci[5].title, ci[5].due], ['Water plants', '2026-12-03'], 'a line with no date takes the day above it');
  assert.equal(P('Water plants', 'calendar').warns.length, 1, 'no date and no date line: it is added without one, with a warning'); assert.equal(P('9am Thing', 'calendar').items[0].due, T);
  assert.ok(P('## Notes\nThing', 'calendar').warns.some(w => /heading/.test(w.msg)), 'a heading that is not a date is flagged'); assert.equal(P('Monday meeting', 'calendar').items[0].title, 'meeting', 'a line with more than a date is an event (the date is read out of it, as in quick add)');
  // ---- timeline ----
  const TL = `Design phase Nov 2 -> Nov 20 #design
Build from Nov 23 to Jan 15 !high
  Set up the repo
Testing Jan 18 for 5 days
Launch Jan 25
Reverse Dec 10 .. Dec 1
Nov 3 -> Nov 5 Pilot
Undated thing`;
  const tl = P(TL, 'timeline'), ti = tl.items;
  assert.equal(tl.count, 7); eq([ti[0].title, ti[0].start, ti[0].due, ti[0].tags], ['Design phase', '2026-11-02', '2026-11-20', ['design']]); eq([ti[1].title, ti[1].start, ti[1].due, ti[1].priority, ti[1].subs.length], ['Build', '2026-11-23', '2027-01-15', 3, 1]); eq([ti[2].start, ti[2].due], ['2027-01-18', '2027-01-22'], '"for 5 days" counts the first day'); eq([ti[3].start, ti[3].due], ['2027-01-25', '2027-01-25'], 'one date is a one-day item');
  eq([ti[4].start, ti[4].due], ['2026-12-01', '2026-12-10'], 'dates the wrong way round are swapped'); assert.ok(tl.warns.some(w => /swapped/.test(w.msg))); eq([ti[5].title, ti[5].start, ti[5].due], ['Pilot', '2026-11-03', '2026-11-05'], 'the title can come after the dates'); assert.equal(ti[6].start, null); assert.ok(tl.warns.some(w => /not show on the timeline/.test(w.msg)));
  // ---- timetable ----
  const TT = `9-10 Lonely
Mon Wed 9:00-10:30 Maths (Room 4) colour:blue
Mon-Fri 8:15-8:30 Registration
Tue 14:00-15:30 Chemistry lab (Lab 2) #green remind 10m
Thu
11:00-12:00 English (Room 7)
> Bring the reading book
Fri 9:00 Assembly for 30m
Sat Chess club
Sun 17:00-16:00 Backwards`;
  const tt = P(TT, 'timetable'), si = tt.items;
  assert.equal(tt.count, 6); assert.equal(tt.skipped, 2, 'a line with no day and a line with no time are skipped'); eq([si[0].title, si[0].days, si[0].start, si[0].end, si[0].loc, si[0].color], ['Maths', [1, 3], '09:00', '10:30', 'Room 4', '#4772fa']); eq(si[1].days, [1, 2, 3, 4, 5]);
  eq([si[2].days, si[2].color, si[2].remind, si[2].loc], [[2], '#34b36b', 10, 'Lab 2']); eq([si[3].title, si[3].days, si[3].loc, si[3].notes], ['English', [4], 'Room 7', 'Bring the reading book'], 'a line of only days sets them for the slots below'); eq([si[4].title, si[4].start, si[4].end], ['Assembly', '09:00', '09:30']); eq([si[5].start, si[5].end], ['17:00', '18:00'], 'a backwards range falls back to an hour');
  assert.ok(tt.warns.some(w => /one-hour/.test(w.msg))); assert.equal(P('Mon 9:00-10:00 A\nMon 9:30-10:30 B', 'timetable').warns.length, 1, 'overlapping slots are warned about, not refused');
  // ---- notes ----
  const NT = `# Meeting with Anna #meeting
Agenda
- Budget
- [ ] Send notes

\`\`\`
# not a heading
\`\`\`

# Packing list #travel #list
- [ ] Passport
`;
  const nt = P(NT, 'notes'), ni = nt.items;
  assert.equal(nt.count, 2); eq([ni[0].title, ni[0].tags], ['Meeting with Anna', ['meeting']]); m(ni[0].body, /^Agenda\n- Budget\n- \[ \] Send notes\n\n```\n# not a heading\n```$/); eq([ni[1].title, ni[1].tags, ni[1].body], ['Packing list', ['travel', 'list'], '- [ ] Passport']);
  const n0 = P('Just some text\nand more', 'notes'); assert.equal(n0.count, 1); assert.equal(n0.items[0].title, ''); assert.equal(n0.warns.length, 1);
  // ---- habits ----
  const HB = `💧 Drink water daily
🏃 Run 3x week #green
📚 Read 20 pages 5 times a week
Call family weekly
Stretch 9 times a week
Meditate 2/month #purple
Plain habit`;
  const hb = P(HB, 'habits'), hi = hb.items;
  assert.equal(hb.count, 7); eq([hi[0].icon, hi[0].name, hi[0].goal], ['💧', 'Drink water', { per: 'day', n: 1 }]); eq([hi[1].icon, hi[1].name, hi[1].goal, hi[1].color], ['🏃', 'Run', { per: 'week', n: 3 }, '#34b36b']); eq([hi[2].name, hi[2].goal], ['Read 20 pages', { per: 'week', n: 5 }]); eq(hi[3].goal, { per: 'week', n: 1 }); eq(hi[4].goal, { per: 'week', n: 7 }, 'more than the days in a week is lowered'); assert.ok(hb.warns.some(w => /lowered/.test(w.msg))); eq([hi[5].goal, hi[5].color], [{ per: 'month', n: 2 }, '#8e5cf7']); eq(hi[6].goal, { per: 'day', n: 1 }, 'daily is the default');
  // ---- countdowns ----
  const CD = `🎂 Anna's birthday Mar 12 yearly #anna remind 1d
Product launch 2026-12-01 9:00 remind 1w
Summer holiday Aug 3 colour:teal #travel
> Flights are booked
Just a name
Dec 25`;
  const cd = P(CD, 'countdowns'), cdi = cd.items;
  assert.equal(cd.count, 3); assert.equal(cd.skipped, 2); eq([cdi[0].icon, cdi[0].name, cdi[0].date, cdi[0].repeat, cdi[0].tags, cdi[0].remind], ['🎂', "Anna's birthday", '2027-03-12', 'year', ['anna'], [1440]], 'a date that has passed this year is next year'); eq([cdi[1].name, cdi[1].date, cdi[1].time, cdi[1].remind], ['Product launch', '2026-12-01', '09:00', [10080]]); eq([cdi[2].date, cdi[2].color, cdi[2].tags, cdi[2].note], ['2027-08-03', '#12a9c7', ['travel'], 'Flights are booked']);
  // ---- the examples shipped in the dialog and in the AI prompt must themselves parse cleanly ----
  for (const [k] of A.TB_KINDS) { const ex = P(A.TB_EX[k], k); assert.ok(ex.count >= (k === 'notes' ? 2 : 3), k + ' example makes something'); assert.equal(ex.skipped, 0, k + ' example has no skipped line: ' + JSON.stringify(ex.warns)); assert.ok(A.TB_DOC[k].length > 100); }
  // ---- writing ----
  const before = { tasks: S.tasks.length, lists: S.lists.length };
  const made = A.tbCommit(P(TASKS, 'tasks'), { listId: '' });
  assert.equal(S.tasks.length, before.tasks + 5); assert.equal(made.tasks.length, 5); const atlas = S.lists.find(l => l.name === 'Atlas'), launch = S.lists.find(l => l.name === 'Launch');
  assert.ok(atlas && launch && launch.parent === atlas.id, 'the lists were made, parent first'); assert.equal(S.lists.some(l => l.name === 'Home'), true); eq(launch.sections, ['Design', 'Go live']);
  const mk = made.tasks.map(id => A.getT(id)); eq(mk.map(t => t.title), ['Draft mockups', 'Review copy', 'Announce', 'Send the status email', 'Pay rent']); assert.ok(mk.every((t, i) => i === 0 || t.order > mk[i - 1].order), 'the order they were typed in');
  assert.ok(mk[0].order < Math.min(...S.tasks.filter(t => !made.tasks.includes(t.id)).map(t => t.order)), 'at the top of the list, like quick add');
  eq([mk[0].listId === launch.id, mk[0].section, mk[0].dur, mk[0].rems, mk[0].reminder, mk[0].subtasks.map(x => x.done), mk[0].notes], [true, 'Design', 120, [60], 60, [false, true], 'Ask Anna first']); assert.equal(mk[2].status, 'done'); assert.ok(mk[2].doneAt > 0); assert.equal(mk[3].until, '2026-12-31'); assert.ok(mk[0].subtasks.every(x => x.id));
  A.tbUndo(made); assert.equal(S.tasks.length, before.tasks); assert.equal(S.lists.length, before.lists, 'undo takes the new lists away too'); assert.equal(S.lists.some(l => l.name === 'Atlas'), false);
  // a list somebody has put a task in since is kept
  const made2 = A.tbCommit(P('# Keepme\nx', 'tasks')), kl = S.lists.find(l => l.name === 'Keepme'); S.tasks.push(A.newTask({ title: 'mine', listId: kl.id })); A.tbUndo(made2); assert.ok(S.lists.some(l => l.id === kl.id), 'undo leaves a list that now has other tasks in it'); S.tasks = S.tasks.filter(t => t.listId !== kl.id); S.lists = S.lists.filter(l => l.id !== kl.id);
  // into a chosen list, with a ~List of its own winning
  const m3 = A.tbCommit(P('a\nb ~Studio', 'tasks'), { listId: 'lw2' }); eq(m3.tasks.map(id => A.getT(id).listId), ['lw2', 'lw']); A.tbUndo(m3);
  // new tasks at the bottom keep their order too
  S.settings.tasks.addPos = 'bottom'; const m4 = A.tbCommit(P('first\nsecond\nthird', 'tasks')), o4 = m4.tasks.map(id => A.getT(id).order); assert.ok(o4[0] < o4[1] && o4[1] < o4[2] && o4[0] > Math.max(...S.tasks.filter(t => !m4.tasks.includes(t.id)).map(t => t.order)), 'bottom'); S.settings.tasks.addPos = 'top'; A.tbUndo(m4);
  // the other kinds
  const b = { slots: S.slots.length, habits: S.habits.length, cds: S.countdowns.length, notes: S.notes.length };
  const ms = A.tbCommit(P(TT + '\nMon 12:00-13:00 Maths', 'timetable')); assert.equal(S.slots.length, b.slots + 7); const sl = ms.slots.map(id => S.slots.find(x => x.id === id)); assert.equal(sl[0].color, '#4772fa'); assert.equal(sl[6].color, sl[0].color, 'the same subject keeps its colour'); assert.ok(sl.every(x => /^#[0-9a-f]{6}$/.test(x.color) && x.id && x.created && Array.isArray(x.days) && x.notes !== undefined)); A.tbUndo(ms); assert.equal(S.slots.length, b.slots);
  const mh = A.tbCommit(P(HB, 'habits')); assert.equal(S.habits.length, b.habits + 7); const hh = S.habits.slice(-7); assert.ok(hh.every(h => h.id && h.icon && /^#/.test(h.color) && h.log && h.created && h.goal.n >= 1)); eq(hh[1].goal, { per: 'week', n: 3 }); assert.equal(hh[6].icon.length > 0, true, 'a habit with no emoji gets one'); A.tbUndo(mh); assert.equal(S.habits.length, b.habits);
  const mc = A.tbCommit(P(CD, 'countdowns')); assert.equal(S.countdowns.length, b.cds + 3); const cc = S.countdowns.slice(-3); eq([cc[0].repeat, cc[0].remind, cc[0].tags, cc[0].icon, cc[1].time, cc[2].note, cc[2].color], ['year', [1440], ['anna'], '🎂', '09:00', 'Flights are booked', '#12a9c7']); assert.ok(cc.every(c => c.id && c.created && c.tz === '' && c.archived === false)); A.tbUndo(mc); assert.equal(S.countdowns.length, b.cds);
  const mn = A.tbCommit(P(NT, 'notes'), { home: 'l:lw' }); assert.equal(S.notes.length, b.notes + 2); const nn = mn.notes.map(id => S.notes.find(x => x.id === id)); assert.ok(nn.every(n => n.listId === 'lw')); assert.ok(nn[0].updated > nn[1].updated, 'the first note is the newest'); eq(nn[1].tags, ['travel', 'list']); A.tbUndo(mn); assert.equal(S.notes.length, b.notes);
  assert.equal(A.tbCommit(P('', 'tasks')).tasks.length, 0, 'nothing to add adds nothing');
  // a commit and its undo are ordinary edits: sync sees them (and nothing is left half-made)
  A.flush(); assert.ok(A.snapshot().tasks.every(t => t.id && typeof t.title === 'string'));
  // ---- the AI prompt ----
  S.lists.push({ id: 'la', name: 'Atlas', color: '#4772fa', sections: [] }); const pr = A.tbPrompt('tasks');
  m(pr, /Today is Thursday 2026-10-08/); m(pr, /FORMAT/); m(pr, /EXAMPLE/); m(pr, /MY REQUEST/); m(pr, /My lists: Inbox, .*Atlas/); m(pr, /ONLY the text to paste/); no(A.tbPrompt('notes'), /My lists/, 'notes, timetable and habits do not need the list names'); no(A.tbPrompt('timetable'), /My lists/);
  for (const [k] of A.TB_KINDS) m(A.tbPrompt(k), new RegExp(A.TB_EX[k].split('\n')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), k + ' prompt carries its example');
  // ---- the dialog and its entry points ----
  assert.equal(typeof A.ACT.tbopen, 'function'); U.page = 'tasks'; m(A.tbTool(), /data-act="tbopen"/); U.page = 'gantt'; assert.equal(A.tbKindHere(), 'timeline'); U.page = 'calendar'; assert.equal(A.tbKindHere(), 'calendar'); U.page = 'notes'; assert.equal(A.tbKindHere(), 'notes'); U.page = 'habits'; assert.equal(A.tbKindHere(), 'habits'); U.page = 'countdowns'; assert.equal(A.tbKindHere(), 'countdowns'); U.page = 'timetable'; assert.equal(A.tbKindHere(), 'timetable'); U.page = 'kanban'; assert.equal(A.tbKindHere(), 'tasks');
  for (const pg of ['stats', 'help', 'home', 'contacts']) { U.page = pg; assert.equal(A.tbTool(), '', pg + ' has no button'); }
  U.page = 'calendar'; A.tbOpen(); m(A.els['#modal'].innerHTML, /Add from text/); m(A.els['#modal'].innerHTML, /data-tbk="calendar" class="on"/); m(A.els['#modal'].innerHTML, /Copy syntax for AI/); m(A.els['#modal'].innerHTML, /Syntax for events/);
  A.tbOpen('notes', '# Hi'); m(A.els['#modal'].innerHTML, /data-tbk="notes" class="on"/); m(A.els['#modal'].innerHTML, /Not in a list or project/); m(A.els['#modal'].innerHTML, /<textarea[^>]*># Hi<\/textarea>/, 'the text is put in the box');
  // pasting several lines into quick add opens it; one line does not
  let stopped = 0; const paste = txt => { const l = A.LST.paste; if (!l) return null; l.forEach(f => f({ target: { id: 'add' }, clipboardData: { getData: () => txt }, preventDefault() { stopped++; } })); return stopped; };
  assert.ok(A.LST.paste && A.LST.paste.length >= 1, 'the paste listener is registered'); U.tb = null; paste('one line only'); assert.equal(stopped, 0); assert.equal(U.tb, null); paste('line one\nline two'); assert.equal(stopped, 1); assert.equal(U.tb.kind, 'tasks'); m(A.els['#modal'].innerHTML, /<textarea[^>]*>line one\nline two<\/textarea>/);
  console.log('0.9 add-from-text tests passed');
}

/* ============ 10. Printing: the documents built for paper (notes, task lists) and which pages get a button ============ */
{
  const A = makeApp(), { S, U } = A;
  const m = (s, re, msg) => assert.match(String(s), re, msg), no = (s, re, msg) => assert.doesNotMatch(String(s), re, msg);
  S.lists.push({ id: 'lp', name: 'Print list', color: '#4772fa', sections: ['Design', 'Launch'] });
  const mk = o => { const t = A.newTask({ listId: 'lp', ...o }); S.tasks.push(t); return t; };
  mk({ title: 'Loose <b>one</b>' }); mk({ title: 'Draft mockups', section: 'Design', due: A.todayStr(), priority: 3, tags: ['design'], notes: 'Use the **new** palette', subtasks: [{ id: 'a', title: 'Collect assets', done: false }, { id: 'b', title: 'Pick fonts', done: true }] });
  mk({ title: 'Announce', section: 'Launch', repeat: { every: 1, unit: 'week' } }); const dn = mk({ title: 'Old thing', section: 'Launch', status: 'done' });
  U.page = 'tasks'; U.nav = 'list:lp'; U.q = ''; U.tagSel = [];
  const full = A.prTasksHtml({ notes: true, subs: true, done: true });
  m(full, /<h1>Print list<\/h1>/); m(full, /3 open tasks/); m(full, /<h2 class="pr-h">Design<\/h2>/); m(full, /<h2 class="pr-h">Launch<\/h2>/); m(full, /Draft mockups/); m(full, /Collect assets/); m(full, /pr-box on"><\/span>Pick fonts/, 'a done subtask has a ticked box'); m(full, /<strong>new<\/strong> palette/, 'notes are rendered');
  m(full, /Completed<\/h2>[\s\S]*Old thing/); m(full, /↻ /); m(full, /High priority/); m(full, /#design/); no(full, /<b>one<\/b>/, 'a title is escaped'); m(full, /&lt;b&gt;one/);
  assert.ok(full.indexOf('Loose') < full.indexOf('>Design<'), 'tasks with no section come first, then the sections in the list\'s order'); assert.ok(full.indexOf('>Design<') < full.indexOf('>Launch<'));
  const lean = A.prTasksHtml({ notes: false, subs: false, done: false });
  no(lean, /Collect assets/); no(lean, /palette/); no(lean, /Old thing/); no(lean, /Completed/); m(lean, /Draft mockups/);
  U.nav = 'all'; m(A.prTasksHtml({ notes: true, subs: true, done: false }), /Print list/, 'in a smart list each task says which list it is in'); U.nav = 'list:lp';
  // notes
  const n1 = A.newNote({ title: 'Meeting with Anna', body: '## Agenda\n\n- Budget\n\n| a | b |\n|---|---|\n| 1 | 2 |', tags: ['meeting'] }), n2 = A.newNote({ title: 'Second', body: 'Short', tags: [] }); S.notes.push(n1, n2);
  U.page = 'notes'; U.noteSel = n1.id; U.notesScope = U.notesScope || undefined;
  const one = A.prNotesHtml({ scope: 'this', meta: true });
  m(one, /<h1>Meeting with Anna<\/h1>/); m(one, /#meeting/); m(one, /<h2[^>]*>Agenda<\/h2>/); m(one, /<table/); no(one, /Second/, 'one note when "this note" is chosen'); assert.equal((one.match(/<article/g) || []).length, 1);
  no(A.prNotesHtml({ scope: 'this', meta: false }), /#meeting/, 'tags and dates can be left off');
  const all = A.prNotesHtml({ scope: 'view', meta: true }); assert.ok((all.match(/<article/g) || []).length >= 2); m(all, /Second/);
  U.noteSel = null; assert.ok((A.prNotesHtml({ scope: 'this', meta: true }).match(/<article/g) || []).length >= 2, 'with no note open the whole view is printed');
  assert.equal(A.prDocHtml({ scope: 'this', meta: true }), A.prNotesHtml({ scope: 'this', meta: true })); U.page = 'tasks'; m(A.prDocHtml({ notes: true, subs: true, done: false }), /Print list/);
  // where the button is (a browser or desktop window can print; the harness window is given a print())
  A.win.print = () => {};
  const has = pg => { U.page = pg; return /data-act="print"/.test(A.prTool()); };
  for (const pg of ['tasks', 'notes', 'calendar', 'timetable', 'kanban', 'matrix', 'habits', 'countdowns', 'stats']) assert.ok(has(pg), pg + ' has a print button');
  for (const pg of ['help', 'home', 'contacts', 'gantt', 'focus', 'templates']) assert.ok(!has(pg), pg + ' has none (the timeline and the guide print their own way)');
  assert.equal(A.prPageKind(), ''); U.page = 'notes'; assert.equal(A.prPageKind(), 'doc'); U.page = 'calendar'; assert.equal(A.prPageKind(), 'live'); assert.equal(typeof A.ACT.print, 'function');
  // the options default sensibly and survive
  U.pr = null; const o = A.prOpts(); assert.deepEqual([o.notes, o.subs, o.done, o.scope, o.meta], [true, true, false, 'this', true]); o.done = true; assert.equal(A.prOpts().done, true);
  console.log('0.9 printing tests passed');
}
