// 0.5: reminders, repeat end dates + exceptions, holidays, templates, shortcuts, accessibility, background service, privacy, F-Droid.
import assert from 'node:assert/strict';
import { makeApp, clock } from './harness.mjs';
const app = makeApp(), { S, U } = app;
const J = JSON.stringify;

/* ---- repeat end date + exceptions ---- */
{
  const p = app.parseQuick('Water plants every week until 31 Dec 2026', S.lists, new Date(Date.UTC(2026, 9, 8)));
  assert.equal(p.until, '2026-12-31'); assert.ok(p.repeat);
  const t = app.newTask({ title: 'Rep', due: '2026-10-08', time: '09:00', repeat: { unit: 'day', every: 1 }, until: '2026-10-10', exc: { '2026-10-09': { time: '14:30', dur: 45 } } });
  S.tasks.push(t);
  assert.equal(app.tmEff(t, '2026-10-09'), '14:30'); assert.equal(app.tmEff(t, '2026-10-08'), '09:00'); assert.equal(app.durEff(t, '2026-10-09'), 45);
  assert.equal(J(app.repeatDates(t, '2026-10-08', '2026-10-20')), J(['2026-10-09', '2026-10-10']), 'stops at the end date');
  t.exc['2026-10-09'].skip = true;
  assert.equal(J(app.repeatDates(t, '2026-10-08', '2026-10-20')), J(['2026-10-10']), 'a skipped date is left out');
  assert.equal(app.nextOcc(t), '2026-10-10');
  app.toggleDone(t); assert.equal(t.due, '2026-10-10');
  app.toggleDone(t); assert.equal(t.status, 'done', 'the last one finishes the task');
}

/* ---- reminders: several, custom, exact ---- */
{
  const t = app.newTask({ title: 'Call', due: '2026-10-09', time: '10:00' }); S.tasks.push(t);
  app.remsSet(t, [60, 7, '2026-10-08T12:00', 7]);
  assert.equal(J(app.remsOf(t)), J([7, 60, '2026-10-08T12:00'])); assert.equal(t.reminder, 7);
  const es = app.remEntries(clock.t, clock.t + 7 * 864e5).filter(e => e.id === t.id);
  assert.equal(es.length, 3);
  assert.ok(es.some(e => e.at === new Date('2026-10-08T12:00').getTime()), 'an exact moment');
  assert.ok(es.some(e => e.at === new Date('2026-10-09T09:00').getTime()), '1 hour before');
  app.remsSet(t, []); assert.equal(t.reminder, null); assert.equal(app.remsOf(t).length, 0);
  // quiet hours hold a reminder back
  S.settings.quiet = { on: true, from: '22:00', to: '07:00' };
  assert.equal(app.quietShift(new Date('2026-10-09T23:30').getTime()), new Date('2026-10-10T07:00').getTime());
  assert.equal(app.quietShift(new Date('2026-10-09T03:30').getTime()), new Date('2026-10-09T07:00').getTime());
  assert.equal(app.quietShift(new Date('2026-10-09T12:00').getTime()), new Date('2026-10-09T12:00').getTime());
  S.settings.quiet = { on: false };
}

/* ---- templates ---- */
{
  const n = app.newNote({ title: 'Signature', body: 'Best,\nAda' }); S.notes.push(n);
  const t = app.newTemplate({ name: 'Email', body: 'Hi {{Name}}, re {{topic|your request}} on {{date}}.\n{{note:Signature}}\nAgain {{name}} {{pick}} {{today}}' }); S.templates.push(t);
  app.tplSyncVars(t);
  assert.equal(J(t.vars.map(v => v.key)), J(['name', 'topic', 'pick']), 'blanks become questions once, case-insensitively; built-ins and notes are not asked');
  assert.equal(app.tplAsked(t).length, 3);
  t.vars[2].type = 'note'; t.vars[2].use = 'title';
  const out = app.tplRender(t, { name: 'Bo', pick: n.id });
  assert.match(out, /^Hi Bo, re your request on \d{4}-\d\d-\d\d\./, 'a fallback fills an empty blank'); assert.ok(out.includes('Best,\nAda'), 'another note is put in'); assert.ok(out.includes('Again Bo Signature'), 'a note answer (title)');
  assert.ok(!out.includes('{{'), 'no blank is left');
  assert.match(app.tplRender(t, {}, true), /‹Name›/, 'the preview shows what is missing');
  t.vars[0].type = 'yesno'; assert.equal(app.tplRender({ ...t, body: '{{name}}' }, { name: true }), 'Yes');
  t.tags = ['work']; t.listId = 'inbox';
  assert.equal(app.tplFor('tag:work').length, 1); assert.equal(app.tplFor('list:inbox').length, 1); assert.match(app.tplStripHtml('tag:work'), /Email/);
  assert.ok(app.tplAllTags().includes('work'));
  // templates sync: they travel in the snapshot, merge by newest edit, and a deletion wins
  const snap = app.snapshot(); assert.ok(snap.templates.some(x => x.id === t.id));
  const other = { ...snap, templates: [{ ...t, name: 'Email v2', u: (t.u || 0) + 5 }], tomb: {} };
  assert.equal(app.mergeData(snap, other).templates.find(x => x.id === t.id).name, 'Email v2');
  assert.equal(app.mergeData(snap, { ...snap, templates: [], tomb: { [t.id]: Date.now() + 1e6 } }).templates.length, 0, 'deleted on the other device');
  U.page = 'templates'; U.tplSel = null; app.renderTemplates(); assert.match(app.els['#main'].innerHTML, /Email/);
  U.tplSel = t.id; app.renderTemplates(); assert.match(app.els['#main'].innerHTML, /data-vk="name"/);
  app.tplToTask(t, 'x'); assert.ok(S.tasks.some(x => x.notes === 'x' && x.tags.includes('work')));
  U.page = 'tasks';
}

/* ---- keyboard shortcuts ---- */
{
  const ev = (key, o = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });
  assert.ok(app.skMatch(ev('n'), 'n')); assert.ok(!app.skMatch(ev('N', { shiftKey: true }), 'n'), 'Shift+N is not n'); assert.ok(app.skMatch(ev('N', { shiftKey: true }), 'Shift+N'));
  assert.ok(app.skMatch(ev('?', { shiftKey: true }), '?'), 'symbols ignore Shift'); assert.ok(app.skMatch(ev('p', { ctrlKey: true, shiftKey: true }), 'Mod+Shift+P')); assert.ok(app.skMatch(ev('P', { metaKey: true, shiftKey: true }), 'Mod+Shift+P'));
  assert.ok(!app.skMatch(ev('n', { ctrlKey: true }), 'n'), 'a modifier changes the key'); assert.ok(app.skMatch(ev('ArrowLeft'), 'ArrowLeft')); assert.ok(app.skMatch(ev(' '), ' '));
  assert.equal(app.skCaps('Mod+Shift+P').join('+'), 'Ctrl+Shift+P'); assert.equal(app.skCaps('ArrowLeft')[0], '←');
  const ids = app.SK.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'every shortcut has its own id');
  // no two working (non-legacy) shortcuts share a key, and none of them steals a key the editor needs
  const seen = new Map(); for (const sh of app.SK.filter(x => x.run)) for (const k of sh.keys) { assert.ok(!seen.has(k), 'key used twice: ' + k); seen.set(k, sh.id); }
  for (const sh of app.SK.filter(x => x.run)) for (const k of sh.keys) assert.ok(!['Mod+B', 'Mod+I', 'Mod+K', 'Tab', 'Escape'].includes(k), sh.id + ' must not take ' + k);
  assert.match(app.skRowsHtml(''), /Command palette/); assert.ok(!/Command palette/.test(app.skRowsHtml('timer')), 'searching narrows the list'); assert.match(app.skRowsHtml('timer'), /Start or pause the timer/); assert.match(app.skRowsHtml('zzzz'), /No shortcut matches/);
  assert.equal(app.skOn(), true, 'a desktop browser has the keys');
  const t = app.newTask({ title: 'k' }); S.tasks.push(t); U.page = 'tasks'; U.sel = t.id;
  app.SK.find(x => x.id === 'complete').run(); assert.equal(t.status, 'done', 'x completes the selected task'); app.SK.find(x => x.id === 'duetoday').run(); assert.equal(t.due, app.todayStr());
  U.sel = null;
}

/* ---- right-click menus ---- */
{
  const t = app.newTask({ title: 'ctx' }); S.tasks.push(t);
  const items = app.ctxTask(t.id); const labels = items.filter(i => !i.sep).map(i => i.label);
  for (const w of ['Open', 'Complete', 'Due today', 'Duplicate', 'Move to bin']) assert.ok(labels.includes(w), 'task menu has ' + w);
  items.find(i => i.label === 'Due tomorrow').run(); assert.equal(t.due, app.ymd(app.addDays(app.pYmd(app.todayStr()), 1)));
  items.find(i => i.label === 'High priority').run(); assert.equal(t.priority, 3);
  const fake = (sel, data) => ({ closest: s => (s.split(',').some(x => sel.includes(x.trim())) ? { dataset: data } : null) });
  assert.ok(app.ctxItems(fake('.task[data-id]:not(.virt)', { id: t.id })), 'a task row has a menu');
  assert.ok(app.ctxItems(fake('.tplc[data-id]', { id: 'nope' })) === null, 'an unknown template has none');
  assert.equal(app.ctxItems({ closest: () => null }), null, 'elsewhere the normal browser menu stays');
}

/* ---- settings, accessibility, privacy ---- */
{
  assert.equal(app.prefGet('a11y.contrast'), false); app.prefSet('a11y.contrast', true); assert.equal(S.settings.a11y.contrast, true, 'stored per device');
  assert.equal(app.prefGet('nope.deep.path'), undefined); app.prefSet('x.y', 3); assert.equal(S.settings.x.y, 3);
  const keys = app.A11Y_GROUPS.flatMap(g => g[1]).map(r => r[0]); for (const k of ['contrast', 'bold', 'dys', 'spacing', 'links', 'nocol', 'gray', 'cursor', 'labels', 'notrans', 'tap', 'focus', 'motion', 'toast']) assert.ok(keys.includes(k), 'accessibility option ' + k);
  assert.ok(!JSON.stringify(app.snapshot ? app.snapshot() : {}).includes('"a11y"'), 'accessibility choices are not synced');
  assert.match(app.PRIVACY_MD, /Notifications and the background service/); assert.match(app.PRIVACY_MD, /AES-256-GCM/);
}

/* ---- background service plan ---- */
{
  S.settings.svc = { on: true, tray: true, autostart: false, persist: true, keep: true };
  const due = app.ymd(app.addDays(app.pYmd(app.todayStr()), 1));
  const t = app.newTask({ title: 'Pay rent', due, time: '09:00' }); t.rems = [30, 1440]; S.tasks.push(t);
  const plan = app.bgPlan(); assert.equal(plan.v, 1); assert.equal(plan.plat, 'web');
  const mine = plan.rem.filter(r => r.t === 'Pay rent'); assert.equal(mine.length, 2, 'both reminders are in the plan');
  assert.ok(mine.every(r => r.exp >= plan.at && r.exp >= r.at && typeof r.k === 'string'));
  S.fired[mine[0].k] = 1; assert.equal(app.bgPlan().rem.filter(r => r.t === 'Pay rent').length, 1, 'a reminder already shown is not planned again');
  S.settings.svc.on = false; assert.equal(app.bgPlan().rem.length, 0, 'off means an empty plan'); S.settings.svc.on = true;
  assert.match(app.svcSettingsHtml(), /Run in the background/); assert.equal(app.bgNative(), false, 'a plain browser has no native service');
  t.deleted = true;
}

console.log('0.5 feature tests passed');
