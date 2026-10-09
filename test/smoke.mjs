// Node smoke test: parser, repeat rules, and every page render against a fake DOM.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const eq = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));
const code = ['core', 'md', 'views', 'sync', 'og', 'gantt', 'ui', 'main'].map(n => readFileSync(new URL(`../src/js/${n}.js`, import.meta.url), 'utf8')).join('\n');
const els = {};
const el = () => ({ innerHTML: '', value: '', dataset: {}, style: {}, textContent: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, focus() {}, select() {}, setAttribute() {}, click() {} });
const store = {};
const ctx = vm.createContext({
  console, setTimeout, clearTimeout, setInterval: () => 0, URL, Date, Math, JSON, Intl, Promise,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
  navigator: { language: 'en-GB' }, location: { protocol: 'file:' },
  window: { addEventListener() {} },
  document: {
    querySelector: s => (els[s] ??= el()), querySelectorAll: () => [], addEventListener() {}, activeElement: null, hidden: false, title: '',
    documentElement: { dataset: {} }, body: { classList: { toggle() {}, add() {}, remove() {} } }, createElement: el,
  },
});
const api = vm.runInContext(code + '\n;({parseQuick,nextDue,toggleDone,newTask,quickAdd,render,renderMain,renderDetail,renderSide,U,P,get S(){return S},pSet,pToggle,checkReminders,reorder,sortTasks,scopeTasks,repeatKey,repeatLabel})', ctx);
const { parseQuick, U } = api;
const base = new Date(2026, 9, 8); // Thu 8 Oct 2026
const lists = [{ id: 'inbox', name: 'Inbox' }, { id: 'p', name: 'Personal' }];
let p = parseQuick('Call mum tomorrow 5pm !high #family ~personal', lists, base);
eq([p.title, p.due, p.time, p.priority, p.tags, p.listId], ['Call mum', '2026-10-09', '17:00', 3, ['family'], 'p']);
p = parseQuick('Pay rent every month', lists, base); eq([p.title, p.due, p.repeat], ['Pay rent', '2026-10-08', { every: 1, unit: 'month' }]);
p = parseQuick('Gym every mon, wed 7:30', lists, base); eq([p.title, p.due, p.time, p.repeat], ['Gym', '2026-10-12', '07:30', { every: 1, unit: 'week', days: [1, 3] }]);
p = parseQuick('Report on friday', lists, base); eq([p.title, p.due], ['Report', '2026-10-09']);
p = parseQuick('Dentist dec 5', lists, base); eq([p.title, p.due], ['Dentist', '2026-12-05']);
p = parseQuick('Buy market 5 things', lists, base); assert.equal(p.due, null);
p = parseQuick('Review in 2 weeks', lists, base); assert.equal(p.due, '2026-10-22');
p = parseQuick('Standup every weekday 9am', lists, base); eq(p.repeat, { every: 1, unit: 'week', days: [1, 2, 3, 4, 5] });
assert.equal(api.nextDue({ due: '2026-01-31', repeat: { every: 1, unit: 'month' } }), '2026-02-28');
assert.equal(api.nextDue({ due: '2026-10-09', repeat: { every: 1, unit: 'week', days: [1, 5] } }), '2026-10-12');
assert.equal(api.repeatKey({ every: 1, unit: 'week', days: [1, 2, 3, 4, 5] }), 'weekdays');
// recurring completion keeps task open and logs a copy
const S = api.S, n0 = S.tasks.length, rec = S.tasks.find(t => t.repeat);
const old = rec.due; api.toggleDone(rec);
assert.equal(rec.status, 'open'); assert.notEqual(rec.due, old); assert.equal(S.tasks.length, n0 + 1);
// add + render every page, with and without a selected task
const t = api.quickAdd('Test task tomorrow !high #x', {}); 
for (const nav of ['inbox', 'today', 'tomorrow', 'week', 'all', 'done', 'wontdo', 'trash', 'tag:x', ...S.lists.map(l => 'list:' + l.id)]) {
  U.page = 'tasks'; U.nav = nav; U.sel = null; api.render(); U.sel = t.id; api.renderDetail();
}
for (const g of ['none', 'date', 'priority', 'list']) for (const s of ['manual', 'due', 'priority', 'title', 'created']) { S.settings.group = g; S.settings.sort = s; U.nav = 'all'; api.renderMain(); }
U.q = 'test'; api.renderMain(); U.q = '';
for (const page of ['calendar', 'matrix', 'habits', 'focus']) { U.page = page; api.render(); }
api.pSet('focus'); api.pToggle(); assert.equal(api.P.run, true);
t.reminder = 0; t.due = new Date().toISOString().slice(0, 10); t.time = '00:00'; api.checkReminders(); assert.ok(Object.keys(S.fired).length === 1);
console.log('all smoke tests passed;', S.tasks.length, 'tasks');
