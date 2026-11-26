/* OpenTick custom keyboard shortcuts (0.9.1): the person chooses the keys; the app keeps them safe.
   keys.js has the registry (SK: what every action is and its default key) and the key handler. This file adds:
     · the person's choices, S.shortcuts: one small record per action (the keys for every computer, and optionally keys only for macOS / Windows / Linux),
       synced like the rest (a record is deleted to go back to the default); records merge per part so a Mac choice and a Windows choice made on two devices both survive
     · skEffective(): the keys an action answers to on THIS computer; skBindings(): what the key handler matches (conflicts and things not allowed here are left out, never silently re-assigned)
     · skIssues(): the six kinds of conflict, before a key is taken – another action, the same key in another context, keys the app needs, keys the browser keeps, keys the
       operating system keeps, and things that differ between keyboards and computers (Option on a Mac, AltGr on Windows, layouts)
     · the editor in Settings → Keyboard: record a key (or type it), sequences ('g' then 't'), add several keys to one action, restore defaults, export / import
   A key is 'Mod+Shift+P' (Mod = Ctrl, Cmd on a Mac); a sequence is its steps with a space ('g t'). */

/* ---------- reading and writing a key (function declarations only: S.shortcuts is checked by migrate() while core.js is still loading) ---------- */
function skSteps(combo) { const c = String(combo == null ? '' : combo); return c === ' ' ? [' '] : c.trim().split(/\s+/).filter(Boolean); }
function skCanonStep(step) {
  step = String(step == null ? '' : step); if (step === ' ') return 'Space';
  if (step.length > 1 && step.endsWith('+') && !step.endsWith('++')) return ''; // ("Mod+" is not a key: the + key is written Mod++)
  const parts = step === '+' ? ['+'] : step.length > 1 && step.endsWith('+') ? [...step.slice(0, -1).split('+').filter(Boolean), '+'] : step.split('+').filter(Boolean), key = parts.pop();
  if (!key) return ''; const mods = new Set(parts); for (const m of mods) if (m !== 'Mod' && m !== 'Shift' && m !== 'Alt') return '';
  let k = key; if (/^[a-z]$/.test(k)) k = k.toUpperCase();
  const named = /^(Arrow(Up|Down|Left|Right)|Home|End|PageUp|PageDown|Delete|Insert|Backspace|Enter|Tab|Space|Escape|F([1-9]|1[0-2]))$/.test(k), sym = k.length === 1 && /[!-\/:-@\[-`{-~]/.test(k);
  if (!(/^[A-Z0-9]$/.test(k) || named || sym)) return '';
  return [mods.has('Mod') ? 'Mod' : '', mods.has('Shift') ? 'Shift' : '', mods.has('Alt') ? 'Alt' : '', k].filter(Boolean).join('+');
}
function skCanon(combo) { const st = skSteps(combo); if (!st.length || st.length > 3) return ''; const c = st.map(skCanonStep); return c.every(Boolean) ? c.join(' ') : ''; }
// one step reduced to what a key press can tell apart (Shift is ignored for symbols such as ? and /, as skMatch does)
function skStepId(step) { const c = skParse(step), alnum = /^[a-z0-9]$/i.test(c.key), sh = alnum || c.key.length > 1 ? c.shift : false; return `${c.mod ? 'M' : ''}${c.alt ? 'A' : ''}${sh ? 'S' : ''}+${c.key.toLowerCase()}`; }
const skSame = (a, b) => { const x = skSteps(a).map(skStepId), y = skSteps(b).map(skStepId); return x.length === y.length && x.every((v, i) => v === y[i]); };
const skPrefix = (a, b) => { const x = skSteps(a).map(skStepId), y = skSteps(b).map(skStepId); return x.length < y.length && x.every((v, i) => v === y[i]); }; // a is the start of b
// what a person types → a key: "Ctrl+Shift+K", "cmd k", "g then t", "Option+P"
function skFromText(text) {
  const MODS = 'ctrl|control|cmd|command|meta|mod|option|opt|alt|shift|⌘|⌥|⇧';
  let t = String(text || '').trim().replace(new RegExp('(' + MODS + ')\\s*\\+\\s*', 'gi'), '$1+').replace(/\s*(?:,|>|\bthen\b)\s*/gi, ' ').replace(/\s+/g, ' '); if (!t) return '';
  const NAMED = { space: 'Space', esc: 'Escape', del: 'Delete', return: 'Enter', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', plus: '+', comma: ',', period: '.', slash: '/' };
  const MAP = { ctrl: 'Mod', control: 'Mod', cmd: 'Mod', command: 'Mod', '⌘': 'Mod', meta: 'Mod', mod: 'Mod', option: 'Alt', opt: 'Alt', alt: 'Alt', '⌥': 'Alt', shift: 'Shift', '⇧': 'Shift' };
  const step = s => { const parts = s.endsWith('++') ? [...s.slice(0, -2).split('+'), '+'] : s.split('+'); const key = parts.pop(); if (!key) return ''; const mods = parts.filter(Boolean).map(p => MAP[p.toLowerCase()] || p); return skCanonStep([...mods, NAMED[key.toLowerCase()] || key].join('+')); };
  const c = t.split(' ').filter(Boolean).map(step); return c.length && c.every(Boolean) && c.length <= 3 ? c.join(' ') : '';
}

/* ---------- the record ---------- */
function skClean(list) { const out = []; for (const k of Array.isArray(list) ? list : []) { const s = typeof k === 'string' ? k.trim().slice(0, 40) : ''; if (!s) continue; const c = skCanon(s) || s; if (!out.includes(c)) out.push(c); if (out.length >= 6) break; } return out; } // (a key this version does not understand is KEPT, so a newer app's choice is not lost; it just does not run here)
function skNormalise(r) {
  if (!r || typeof r !== 'object' || !/^[\w.:-]{1,90}$/.test(r.action || '')) return null;
  const n = v => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0), pf = {};
  // (a platform part with k: null means "no choice just for this kind of computer": it is kept, so that taking a choice back reaches the other devices too)
  for (const p of ['mac', 'win', 'linux']) { const v = r.pf && r.pf[p]; if (v && typeof v === 'object' && (Array.isArray(v.k) || v.k === null)) pf[p] = { k: v.k === null ? null : skClean(v.k), u: n(v.u) }; }
  const keys = Array.isArray(r.keys) ? skClean(r.keys) : null; if (keys === null && !Object.keys(pf).length) return null;
  return { id: 'sc-' + pkrHash(r.action), action: r.action, keys, ku: n(r.ku), pf, u: n(r.u) };
}
// run by migrate(): every record is cleaned, and an action has one record (the newest)
function skMigrate(r) {
  const by = new Map(); for (const x of r.shortcuts) { const n = skNormalise(x); if (!n) continue; const o = by.get(n.id); if (!o || n.u > o.u) by.set(n.id, n); }
  r.shortcuts = [...by.values()];
}
COLL_MERGE.shortcuts = (x, y, w) => {
  const a = skNormalise({ ...x }), b = skNormalise({ ...y }), nw = skNormalise({ ...w }); if (!a || !b || !nw) return w;
  const pick = (p, q) => (p.u !== q.u ? (p.u > q.u ? p : q) : (prefCanon(p) <= prefCanon(q) ? p : q)), top = a.ku !== b.ku ? (a.ku > b.ku ? a : b) : prefCanon(a.keys) <= prefCanon(b.keys) ? a : b, pf = {};
  for (const p of ['mac', 'win', 'linux']) pf[p] = !a.pf[p] ? b.pf[p] : !b.pf[p] ? a.pf[p] : pick(a.pf[p], b.pf[p]);
  for (const p of Object.keys(pf)) if (!pf[p]) delete pf[p];
  const m = skNormalise({ ...w, keys: top.keys, ku: top.ku, pf }) || nw; m.u = w.u;
  if (prefCanon({ ...m, u: 0 }) !== prefCanon({ ...nw, u: 0 })) m.u = Math.max(x.u || 0, y.u || 0) + 1; // differs from the winner → it has to travel
  return m;
};
const skPlat = () => { const n = typeof navigator !== 'undefined' ? (navigator.platform || '') + ' ' + (navigator.userAgent || '') : ''; return /Mac|iPhone|iPad/i.test(n) ? 'mac' : /Win/i.test(n) ? 'win' : 'linux'; };
const skPlatName = p => ({ mac: 'macOS', win: 'Windows', linux: 'Linux' }[p] || p);
const skEnv = () => (typeof TAURI === 'function' && TAURI() ? 'app' : 'browser');
const skRecOf = id => (S.shortcuts || []).find(r => r.action === id) || null;
// the keys of an action here: this kind of computer's own choice, else the choice for all of them, else the default
function skEffective(s) { const r = skRecOf(s.id); if (!r) return s.keys; const p = r.pf && r.pf[skPlat()]; return p && p.k !== null ? p.k : r.keys !== null ? r.keys : s.keys; }
const skCustomOf = id => { const r = skRecOf(id), p = r && r.pf && r.pf[skPlat()]; return r && ((p && p.k !== null) || r.keys !== null) ? r : null; };
const skPlatOnly = id => { const r = skRecOf(id), p = r && r.pf && r.pf[skPlat()]; return !!(p && p.k !== null); };
const skDirty = () => { SKB.sig = ''; };

/* ---------- Go to / New entry in each section of your own or a pack ---------- */
function skDyn() {
  const out = [];
  for (const s of S.csections) {
    if (pksHidden(s)) continue; const tag = s.packId ? ' (' + ((typeof pksRec === 'function' && pksRec(s.packId) || {}).name || 'pack') + ')' : '';
    out.push({ id: 'sec.go.' + s.id, keys: [], label: 'Go to ' + s.name + tag, cat: 'Pack & custom sections', group: 'Sections', run: () => skGoSec(s.id) },
      { id: 'sec.new.' + s.id, keys: [], label: 'New entry in ' + s.name + tag, cat: 'Pack & custom sections', group: 'Sections', run: () => { const q = S.csections.find(x => x.id === s.id); if (!q) return; skGoSec(q.id); xsEditEntry(q, null); } });
  }
  return out;
}

/* ---------- what is meant, in words, and where each action works ---------- */
const SK_DESC = { viewnext: 'Step through the views of the section you are in', viewprev: 'Step back through the views', gotasks: 'Open the Tasks section', gonotes: 'Open the Notes section', gocal: 'Open the Calendar section', gohabits: 'Open the Habits section', goprojects: 'Open the Projects overview', gocontacts: 'Open Contacts', gostats: 'Open Statistics',
  newtask: 'Put the cursor in the box for a new task', newnote: 'Start a new note', newtpl: 'Start a new template', newlist: 'Add a list to a project', addtext: 'Paste or type several items at once', search: 'Find tasks, notes and more', palette: 'Run any command by name', settings: 'Open Settings',
  complete: 'Tick or untick the selected task', trash: 'Put the selected task in the bin', duetoday: 'Set the selected task due today', duetom: 'Set the selected task due tomorrow', rename: 'Edit the title of the selected task', next: 'Move down the list', prev: 'Move up the list',
  prevp: 'Go back in the calendar or timetable', nextp: 'Go forward in the calendar or timetable', today: 'Go to today', timer: 'Start or pause the focus timer', newproject: 'Start a new project', side: 'Show or hide the sidebar', detail: 'Show or hide the details panel', focus: 'Hide both panels', help: 'Show the list of shortcuts',
  esc: 'Closes windows and the details panel (fixed)', bold: 'Bold in a note (fixed)', italic: 'Italic in a note (fixed)', link: 'Insert a link in a note (fixed)', indent: 'Indent in a note (fixed)' };
// where an action works: 'global' anywhere; the others only on some pages. Two actions with the same key clash only where both work.
const SK_CTX = { complete: 'task', trash: 'task', duetoday: 'task', duetom: 'task', rename: 'task', next: 'list', prev: 'list', prevp: 'cal', nextp: 'cal', today: 'cal', timer: 'focus' };
const SK_PAGES = { task: ['tasks', 'calendar', 'timetable', 'matrix', 'home'], list: ['tasks', 'matrix'], cal: ['calendar', 'timetable'], focus: ['focus'] };
const skCtxOf = s => SK_CTX[s.id] || 'global';
const skCtxName = c => ({ task: 'when a task is selected', list: 'in a task list', cal: 'in the calendar and timetable', focus: 'on the Focus page', global: 'everywhere' }[c] || c);
const skOverlap = (a, b) => a === 'global' || b === 'global' || (SK_PAGES[a] || []).some(p => (SK_PAGES[b] || []).includes(p));

/* ---------- keys that belong to something else ---------- */
// the app itself (fixed: the editor, the windows, the way a keyboard moves around)
const SK_APP = [['Escape', 'closes windows and panels'], ['Enter', 'activates buttons and confirms'], ['Tab', 'moves between fields and indents in a note'], ['Shift+Tab', 'moves back between fields'], ['Backspace', 'deletes while you type'],
  ['Mod+B', 'is Bold inside a note'], ['Mod+I', 'is Italic inside a note'], ['Mod+K', 'is Link inside a note'], ['Mod+Z', 'is Undo'], ['Mod+Shift+Z', 'is Redo'], ['Mod+Y', 'is Redo'], ['Mod+A', 'selects all'], ['Mod+C', 'copies'], ['Mod+X', 'cuts'], ['Mod+V', 'pastes']];
// a web page cannot take these from a browser at all
const SK_BROWSER_HARD = ['Mod+T', 'Mod+W', 'Mod+N', 'Mod+Shift+N', 'Mod+Shift+T', 'Mod+Shift+W', 'Mod+Tab', 'Mod+Shift+Tab', 'Mod+PageUp', 'Mod+PageDown', 'Mod+1', 'Mod+2', 'Mod+3', 'Mod+4', 'Mod+5', 'Mod+6', 'Mod+7', 'Mod+8', 'Mod+9', 'Alt+ArrowLeft', 'Alt+ArrowRight'];
// a page can take these, but then the browser's own feature stops working
const SK_BROWSER_SOFT = ['Mod+P', 'Mod+S', 'Mod+F', 'Mod+G', 'Mod+D', 'Mod+L', 'Mod+R', 'Mod+Shift+R', 'Mod+U', 'Mod+O', 'Mod+J', 'Mod+H', 'Mod+E', 'Mod+Shift+I', 'Mod+Shift+J', 'Mod+Shift+C', 'Mod+Shift+Delete', 'Mod+=', 'Mod+-', 'Mod+0', 'Mod++', 'F1', 'F3', 'F5', 'F6', 'F7', 'F11', 'F12', 'Alt+D', 'Alt+Home'];
// the operating system keeps these whatever the app does
const SK_OS = { win: [['Alt+Tab', 'switches windows'], ['Alt+F4', 'closes the window'], ['Alt+Escape', 'switches windows'], ['Alt+Space', 'opens the window menu'], ['Mod+Escape', 'opens the Start menu'], ['Mod+Shift+Escape', 'opens Task Manager'], ['Mod+Alt+Delete', 'shows the security screen']],
  mac: [['Mod+Space', 'opens Spotlight'], ['Mod+Alt+Space', 'opens a Finder search'], ['Mod+Tab', 'switches apps'], ['Mod+Shift+Tab', 'switches apps'], ['Mod+Q', 'quits the app'], ['Mod+H', 'hides the app'], ['Mod+Alt+H', 'hides other apps'], ['Mod+M', 'minimises the window'], ['Mod+Shift+3', 'takes a screenshot'], ['Mod+Shift+4', 'takes a screenshot'], ['Mod+Shift+5', 'opens the screenshot tools'], ['Mod+Alt+Escape', 'opens Force Quit'], ['Mod+Shift+Q', 'logs you out'], ['Mod+`', 'switches windows of the app']],
  linux: [['Alt+Tab', 'switches windows'], ['Alt+F4', 'closes the window'], ['Alt+F2', 'opens the run prompt on many desktops'], ['Alt+Space', 'opens the window menu on many desktops'], ['Mod+Alt+T', 'opens a terminal on many desktops'], ['Mod+Alt+Delete', 'opens the session menu on many desktops'], ['Mod+Alt+L', 'locks the screen on many desktops'], ['Mod+Alt+ArrowLeft', 'switches workspace on many desktops'], ['Mod+Alt+ArrowRight', 'switches workspace on many desktops'], ['Mod+Alt+ArrowUp', 'switches workspace on many desktops'], ['Mod+Alt+ArrowDown', 'switches workspace on many desktops']] };
const SK_HARD_OS = { win: ['Alt+Tab', 'Alt+F4', 'Mod+Alt+Delete'], mac: ['Mod+Space', 'Mod+Tab', 'Mod+Q', 'Mod+H', 'Mod+M'], linux: ['Alt+Tab', 'Alt+F4'] }; // (what a program never sees: blocked; the rest are only warned about, desktops differ)
const SK_AWKWARD = '[]\\`~|@#{}^'; // keys that need Shift or AltGr on many keyboard layouts

/* ---------- is this key a good idea? → [{ kind, level, text, with }]; level: block (not allowed) · conflict (another action has it) · warn · info ---------- */
// `others`: the bindings to compare with, [{ s, canon, off }]
function skIssues(s, canon, o) {
  const out = [], plat = o.plat || skPlat(), env = o.env || skEnv(), steps = skSteps(canon), add = (kind, level, text, w) => out.push({ kind, level, text, with: w ? w.id : '' });
  const first = skParse(steps[0]), id0 = skStepId(steps[0]), hasStep = k => steps.some(st => skStepId(st) === skStepId(k));
  // 3. the app's own keys
  for (const [k, why] of SK_APP) if (steps.length === 1 && skStepId(k) === id0) add('app', 'block', `OpenTick keeps ${skText(k)} for itself: it ${why}.`);
  if (steps.length > 1 && skStepId('Escape') === id0) add('app', 'block', 'A sequence cannot start with Esc: it closes windows.');
  // typing and sequences
  if (steps.length > 1) add('platform', 'info', 'A sequence: press the keys one after the other, each within a second and a half. It does not work while you are typing in a field.');
  else if (!first.mod && !first.alt && !/^F([1-9]|1[0-2])$/.test(first.key)) add('platform', 'info', 'This key does nothing while you are typing in a text field, so typing is never interrupted.');
  if (steps.length === 1 && !first.mod && !first.alt && /^(ArrowUp|ArrowDown|Home|End|PageUp|PageDown| )$/.test(first.key)) add('app', 'warn', `${skText(steps[0])} also scrolls and moves around lists; using it for an action takes that away.`);
  // 4. the browser
  const hard = SK_BROWSER_HARD.find(hasStep), soft = SK_BROWSER_SOFT.find(hasStep);
  if (hard) add('browser', env === 'browser' ? 'block' : 'info', env === 'browser' ? `A browser keeps ${skText(hard)} (tabs and windows); a web page never receives it.` : `Browsers keep ${skText(hard)}. It can work in the OpenTick app, but not in a web browser, so it would not work everywhere you use OpenTick.`);
  else if (soft) add('browser', env === 'browser' ? 'warn' : 'info', `Browsers use ${skText(soft)} for something of their own; taking it here switches that off while OpenTick is open.`);
  // 5. the operating system
  for (const [k, why] of SK_OS[plat] || []) if (hasStep(k)) add('os', (SK_HARD_OS[plat] || []).includes(k) ? 'block' : 'warn', `${skPlatName(plat)} reserves ${skText(k)}: it ${why}.`);
  // 6. differences between computers and keyboards
  if (steps.some(st => { const c = skParse(st); return plat === 'mac' && c.alt && !c.mod && /^[a-z0-9]$/i.test(c.key); })) add('platform', 'warn', 'On a Mac, Option+letter types a special character in a text field. OpenTick reads the physical key, so it works, but it can feel odd while typing.');
  if (plat === 'win' && steps.some(st => { const c = skParse(st); return c.mod && c.alt; })) add('platform', 'warn', 'On many Windows keyboard layouts Ctrl+Alt is the same as AltGr, which types symbols. Prefer Ctrl+Shift or Alt+Shift.');
  if (steps.some(st => { const c = skParse(st); return !c.mod && !c.alt && c.key.length === 1 && SK_AWKWARD.includes(c.key); })) add('platform', 'warn', 'This key needs Shift or AltGr on many keyboard layouts, so it may not be where you expect on a different keyboard.');
  if (steps.some(st => /^F([1-9]|1[0-2])$/.test(skParse(st).key))) add('platform', 'info', 'Function keys need Fn on many laptops, and are media keys by default on some.');
  // 1 and 2. the other actions, and the same key in another place
  const ctx = skCtxOf(s);
  for (const b of o.others || []) {
    if (b.s.id === s.id || !b.canon) continue; const bctx = skCtxOf(b.s), over = skOverlap(ctx, bctx), name = skLabel(b.s);
    if (skSame(canon, b.canon)) { if (over) add('action', 'conflict', `${skText(canon)} is already used for “${name}”.`, b.s); else add('context', 'info', `${skText(canon)} is also “${name}”, but ${skCtxName(bctx)}; the two never work at the same time, so this is fine.`, b.s); }
    else if (over && skPrefix(b.canon, canon)) add('prefix', 'conflict', `“${name}” is ${skText(b.canon)} on its own, so ${skText(canon)} could never be reached: the first key would act at once.`, b.s);
    else if (over && skPrefix(canon, b.canon)) add('prefix', 'conflict', `${skText(canon)} is the start of “${name}” (${skText(b.canon)}); pressing it alone would wait for the next key instead of acting.`, b.s);
  }
  const rank = { block: 0, conflict: 1, warn: 2, info: 3 }; return out.sort((p, q) => rank[p.level] - rank[q.level]);
}

/* ---------- what the key handler matches ---------- */
const SKB = { sig: '', all: [], on: [] };
function skBuild() {
  const plat = skPlat(), env = skEnv(), rows = skAll().filter(s => s.run && !skFixed(s)), all = [];
  for (const s of rows) { const custom = !!skCustomOf(s.id); for (const k of skKeysOf(s)) { const canon = skCanon(k); all.push({ s, key: k, canon, steps: canon ? skSteps(canon) : [], custom, off: '', clash: '' }); } }
  for (const b of all) { // a choice that is not valid here is kept but does not run, and the editor says why
    if (!b.canon) { b.off = 'This version of OpenTick does not understand that key.'; continue; }
    if (!b.custom) continue;
    const blk = skIssues(b.s, b.canon, { plat, env, others: [] }).find(x => x.level === 'block'); if (blk) b.off = blk.text;
  }
  // clashes. A default keeps its key; a choice of the person's that meets a default is put on hold; two choices that meet are BOTH put on hold until they decide.
  // (judged against the same starting list for everybody, so the order of the actions never decides who wins)
  const live = all.filter(b => !b.off), meet = (b, c) => c.s.id !== b.s.id && skOverlap(skCtxOf(b.s), skCtxOf(c.s)) && (skSame(b.canon, c.canon) || skPrefix(b.canon, c.canon) || skPrefix(c.canon, b.canon));
  for (const b of live) { if (!b.custom) continue; const c = live.find(x => meet(b, x)); if (c) { b.clash = c.s.id; b.off = `Clashes with “${skLabel(c.s)}” (${skText(c.canon)}).`; } }
  SKB.all = all; SKB.on = all.filter(b => !b.off);
}
function skBindings() {
  const sig = JSON.stringify(S.shortcuts || []) + '|' + S.csections.map(s => s.id).join(',') + '|' + skPlat() + '|' + skEnv();
  if (SKB.sig !== sig) { skBuild(); SKB.sig = sig; } return SKB.on;
}
const skAnalysis = () => { skBindings(); return SKB.all; };
const skProblem = id => skAnalysis().find(b => b.s.id === id && b.off) || null;

/* ---------- changing a key ---------- */
const skTick = prev => Math.max(Date.now(), (prev || 0) + 1);
// write the key list of one action. `only`: true → this kind of computer only; else every computer (and a choice made just for this kind of computer gives way)
const skSameKeys = (a, b) => a.length === b.length && a.every(k => b.some(j => skSame(k, j)));
function skSetKeys(id, keys, only) {
  const s = skById(id); if (!s) return false; keys = skClean(keys); const plat = skPlat();
  let r = skRecOf(id); const fresh = !r; if (fresh) r = { id: 'sc-' + pkrHash(id), action: id, keys: null, ku: 0, pf: {}, u: 0 };
  if (only) r.pf[plat] = { k: keys, u: skTick((r.pf[plat] || {}).u) };
  else { r.keys = keys; r.ku = skTick(r.ku); if (r.pf[plat]) r.pf[plat] = { k: null, u: skTick(r.pf[plat].u) }; }
  r.u = skTick(r.u);
  if (fresh) S.shortcuts.push(r);
  skPrune(r, s); skDirty(); save(); return true;
}
// a record that says nothing different from the default is removed (a deletion syncs like any other, and wins over older copies)
function skPrune(r, s) {
  const mine = Object.values(r.pf).some(p => p.k !== null);
  if (!mine && (r.keys === null || skSameKeys(r.keys, s.keys))) S.shortcuts = S.shortcuts.filter(x => x !== r);
}
const skAddKey = (id, canon, only, at) => { const s = skById(id); if (!s) return false; const cur = skKeysOf(s).slice(); if (at != null && at >= 0 && at < cur.length) cur[at] = canon; else cur.push(canon); return skSetKeys(id, cur, only); };
const skRemoveKey = (id, i, only) => { const s = skById(id); if (!s) return false; const cur = skKeysOf(s).slice(); cur.splice(i, 1); return skSetKeys(id, cur, only); };
function skReset(id, onlyThisPlatform) {
  const r = skRecOf(id), s = skById(id); if (!r || !s) return;
  if (onlyThisPlatform) { const plat = skPlat(); if (r.pf[plat] && r.pf[plat].k !== null) { r.pf[plat] = { k: null, u: skTick(r.pf[plat].u) }; r.u = skTick(r.u); skPrune(r, s); } }
  else S.shortcuts = S.shortcuts.filter(x => x !== r);
  skDirty(); save();
}
function skResetAll() { S.shortcuts = []; skDirty(); save(); }
// take a key away from the action that has it (the person said "replace"), then give it to this one
function skReplace(id, canon, owners, only, at) { for (const w of owners) { const o = skById(w); if (!o) continue; const keep = skKeysOf(o).filter(k => !(skSame(k, canon) || skPrefix(k, canon) || skPrefix(canon, k))); skSetKeys(w, keep, only); } return skAddKey(id, canon, only, at); }
// a few free alternatives to suggest next to a refused key
function skSuggest(id, canon) {
  const s = skById(id), steps = skSteps(canon), last = steps[steps.length - 1], c = skParse(last), others = skAnalysis().filter(b => !b.off), base = steps.slice(0, -1), out = [];
  const tries = [{ ...c, shift: true }, { ...c, mod: true, shift: true }, { ...c, alt: true }, { ...c, mod: true, alt: false, shift: false }].map(t => skCanonStep([t.mod ? 'Mod' : '', t.shift ? 'Shift' : '', t.alt ? 'Alt' : '', t.key === ' ' ? 'Space' : t.key].filter(Boolean).join('+')));
  for (const t of tries) { if (!t) continue; const cand = [...base, t].join(' '); if (cand === canon || out.includes(cand)) continue; if (!skIssues(s, cand, { others }).some(x => x.level === 'block' || x.level === 'conflict')) out.push(cand); if (out.length >= 3) break; }
  return out;
}

/* ---------- export and import ---------- */
function skExport() { return JSON.stringify({ opentick: 'shortcuts', version: 1, from: skPlat(), shortcuts: S.shortcuts.map(r => ({ action: r.action, keys: r.keys, pf: Object.fromEntries(Object.entries(r.pf).filter(([, v]) => v.k !== null).map(([p, v]) => [p, { k: v.k }])) })).filter(x => x.keys !== null || Object.keys(x.pf).length) }, null, 2); } // (no times: an import is a new choice, made now)
// → { added, skipped, warnings }. Choices that clash or are not allowed here are KEPT and marked in the editor, never dropped.
function skImport(text) {
  let j; try { j = JSON.parse(text); } catch (e) { return { ok: false, error: 'That is not a shortcuts file.' }; }
  if (!j || j.opentick !== 'shortcuts' || !Array.isArray(j.shortcuts)) return { ok: false, error: 'That is not a shortcuts file.' };
  let added = 0, skipped = 0; const now = Date.now();
  for (const x of j.shortcuts.slice(0, 400)) {
    const n = skNormalise({ action: x && x.action, keys: x && x.keys, ku: now, pf: Object.fromEntries(Object.entries((x && x.pf) || {}).map(([p, v]) => [p, { k: v && v.k, u: now }])), u: now }); if (!n) { skipped++; continue; }
    const cur = skRecOf(n.action); if (cur) S.shortcuts = S.shortcuts.filter(r => r !== cur); S.shortcuts.push(n); added++;
  }
  skDirty(); save(); const bad = skAnalysis().filter(b => b.off && b.custom).length;
  return { ok: true, added, skipped, needAttention: bad };
}

/* ---------- Settings → Keyboard ---------- */
const SKR = { on: false, listen: false, id: '', at: -1, only: false, steps: [], timer: 0, held: null, res: null };
const skLive = msg => { const el = $('#sk-live'); if (el) el.textContent = msg || ''; };
function skEditorHtml(q) {
  q = (q || '').toLowerCase().trim(); const plat = skPlat(), all = skAll(), probs = skAnalysis().filter(b => b.off && b.custom).length;
  const row = s => {
    const ks = skKeysOf(s), fixed = skFixed(s), prob = skProblem(s.id), custom = !!skCustomOf(s.id), rec = skRecOf(s.id), platOnly = skPlatOnly(s.id);
    const def = s.keys.length ? s.keys.map(skKbd).join('<em>or</em>') : '<span class="sk-t">none</span>', name = esc(skLabel(s));
    const chips = ks.map((k, i) => `<span class="sk-ch${skAnalysis().some(b => b.s.id === s.id && b.key === k && b.off) ? ' bad' : ''}">${skKbd(k)}${fixed ? '' : `<button type="button" class="sk-x" data-ska="del" data-id="${esc(s.id)}" data-i="${i}" aria-label="Remove ${esc(skText(k))} from ${name}" title="Remove">${ic('x', 11)}</button>`}</span>`).join('') || '<span class="sk-t">no shortcut</span>';
    const act = fixed ? '<span class="sk-fx">Fixed</span>' : `<button type="button" class="btn sm" data-ska="rec" data-id="${esc(s.id)}" data-i="-1" aria-label="${ks.length ? 'Add another shortcut for' : 'Set a shortcut for'} ${name}">${ic('plus', 12)} ${ks.length ? 'Add' : 'Set'}</button>${custom ? `<button type="button" class="btn sm" data-ska="reset" data-id="${esc(s.id)}" aria-label="${platOnly && rec.keys !== null ? 'Use the shared choice for' : 'Restore the default for'} ${name}">${platOnly && rec.keys !== null ? 'Shared' : 'Default'}</button>` : ''}`;
    const note = prob ? `<div class="sk-bad" role="note">${ic('alert', 13)} Needs attention: ${esc(prob.off)} It is switched off until you choose another key. <button type="button" class="btn sm" data-ska="rec" data-id="${esc(s.id)}" data-i="${skKeysOf(s).indexOf(prob.key)}">Change it</button></div>` : '';
    return `<div class="sk-er" role="group" aria-label="${name}" data-skrow="${esc(s.id)}"><div class="sk-en"><b>${name}</b><small>${esc(SK_DESC[s.id] || (s.id.startsWith('sec.') ? (s.id.startsWith('sec.go.') ? 'Open that section' : 'Start a new entry there') : ''))}</small></div><div class="sk-ek">${chips}${act}</div><div class="sk-df">${custom ? `Default: ${def}${platOnly ? ` · set only for ${skPlatName(plat)}` : ''}` : ''}</div>${note}<div class="sk-rec" data-skrec="${esc(s.id)}"></div></div>`;
  };
  let h = '';
  for (const g of SK_CATS) { const rows = all.filter(s => skCat(s) === g && (!q || (skLabel(s) + ' ' + (SK_DESC[s.id] || '') + ' ' + skKeysOf(s).map(skText).join(' ')).toLowerCase().includes(q))); if (rows.length) h += `<h4 class="sk-g">${esc(g)}</h4>` + rows.map(row).join(''); }
  return (probs ? `<p class="sk-bad" role="status">${ic('alert', 14)} ${plural(probs, 'shortcut')} need${probs === 1 ? 's' : ''} attention (marked below). They are switched off, not lost.</p>` : '') + (h || '<p class="hint">No shortcut matches.</p>');
}
function skSettingsHtml() {
  return `<h4 class="mh">${ic('code', 15)} Choose your own keys</h4>
  <p class="hint">A shortcut can be one key, a chord (Ctrl+Shift+K) or a sequence (press <kbd>g</kbd> then <kbd>t</kbd>). Your choices sync to your other devices. OpenTick checks a key before it takes it, tells you if something else needs it (another shortcut, the app, your browser or your operating system), and never changes a shortcut without telling you.</p>
  <div class="sk-tools"><input type="search" id="sk-find" placeholder="Find an action or a key" aria-label="Find an action or a key" autocomplete="off"><button type="button" class="btn sm" data-ska="export">${ic('download', 12)} Export</button><button type="button" class="btn sm" data-ska="import">${ic('upload', 12)} Import</button><button type="button" class="btn sm" data-ska="resetall">Restore all defaults</button></div>
  <div id="sk-live" class="sr-only" role="status" aria-live="polite"></div>
  <div id="sk-ed" class="sk-ed">${skEditorHtml('')}</div>`;
}
const skRepaint = () => { const el = $('#sk-ed'); if (el) el.innerHTML = skEditorHtml(($('#sk-find') || {}).value || ''); if (typeof skHintsRefresh === 'function') skHintsRefresh(); };
// recording. With the mouse, the next keys pressed become the shortcut (a sequence if you press several one after the other). With the keyboard, nothing is captured until
// "Record keys" is pressed, so Tab can still walk to the text box and the buttons; Esc always leaves the recorder (and only the recorder).
function skRecStart(id, at, byKeyboard) {
  skRecStop(); const slot = $(`[data-skrec="${CSS.escape ? CSS.escape(id) : id}"]`); if (!slot) return;
  SKR.on = true; SKR.id = id; SKR.at = at; SKR.steps = []; SKR.only = false; SKR.res = null; SKR.listen = !byKeyboard;
  slot.innerHTML = `<div class="sk-recbox" role="group" tabindex="-1" aria-label="Choose a shortcut for ${esc(skLabel(skById(id)))}"><p><b>Press the keys you want</b>, or several one after the other for a sequence. <kbd>Esc</kbd> cancels. Your browser keeps a few keys (such as Ctrl+T); type those in to see why.</p>
    <div class="sk-pre" aria-live="polite">…</div>
    <div class="sk-ra"><button type="button" class="btn sm" data-ska="listen" aria-pressed="${SKR.listen}">Record keys</button></div>
    <label>Or type it: <input data-sktype maxlength="40" placeholder="Ctrl+Shift+K  or  g then t" autocomplete="off" spellcheck="false" aria-label="Type the shortcut"></label>
    <label class="chk"><input type="checkbox" data-skonly> Only on ${esc(skPlatName(skPlat()))}</label>
    <div class="sk-ra"><button type="button" class="btn sm pri" data-ska="use">Use this key</button><button type="button" class="btn sm" data-ska="cancel">Cancel</button></div><div class="sk-ver" data-skver></div></div>`;
  const box = $('.sk-recbox', slot), t = $('[data-sktype]', slot); if (SKR.listen) { if (box) box.focus(); skLive('Listening: press the keys you want.'); } else if (t) t.focus();
}
function skRecStop() { SKR.on = false; SKR.listen = false; SKR.steps = []; clearTimeout(SKR.timer); $$('.sk-rec').forEach(e => { e.innerHTML = ''; }); }
const skRecBtn = id => $(`[data-skrow="${CSS.escape ? CSS.escape(id) : id}"] [data-ska="rec"]`);
const skPreview = () => { const el = $('.sk-pre'); if (el) el.innerHTML = SKR.steps.length ? SKR.steps.map(skKbd).join('<em>then</em>') : '…'; };
// the verdict for the key being chosen, with what to do about it
function skVerdict(canon) {
  const s = skById(SKR.id), issues = skIssues(s, canon, { others: skAnalysis().filter(b => !b.off) }), el = $('[data-skver]'); if (!el) return issues;
  const block = issues.filter(x => x.level === 'block'), conf = issues.filter(x => x.level === 'conflict'), warn = issues.filter(x => x.level === 'warn'), info = issues.filter(x => x.level === 'info'), sug = block.length || conf.length ? skSuggest(s.id, canon) : [];
  SKR.res = { canon, block: block.length, conf: conf.map(x => x.with), warn: warn.length };
  el.innerHTML = `<p class="sk-vk">${skKbd(canon)}</p>` + [...block, ...conf].map(x => `<p class="sk-bad" role="alert">${ic('alert', 13)} ${esc(x.text)}</p>`).join('') + warn.map(x => `<p class="sk-warn">${ic('info', 13)} ${esc(x.text)}</p>`).join('') + info.map(x => `<p class="hint">${esc(x.text)}</p>`).join('')
    + (conf.length && !block.length ? `<div class="sk-ra"><button type="button" class="btn sm pri" data-ska="replace">Take it from ${esc(conf.map(x => '“' + skLabel(skById(x.with)) + '”').filter((v, i, a) => a.indexOf(v) === i).join(', '))}</button></div>` : '')
    + (sug.length ? `<div class="sk-ra"><span class="hint">Try instead:</span>${sug.map(k => `<button type="button" class="btn sm" data-ska="try" data-k="${esc(k)}">${skKbd(k)}</button>`).join('')}</div>` : '');
  skLive((block[0] || conf[0] || warn[0] || { text: 'Free to use.' }).text);
  return issues;
}
function skCommit(canon, replace) {
  const only = !!($('[data-skonly]') || {}).checked, id = SKR.id, at = SKR.at;
  if (replace) skReplace(id, canon, (SKR.res ? SKR.res.conf : []).filter(Boolean), only, at); else skAddKey(id, canon, only, at);
  skRecStop(); skRepaint(); const nb = skRecBtn(id); if (nb) nb.focus(); skLive(`${skLabel(skById(id))}: ${skText(canon)}`); toast('Shortcut saved'); if (typeof sfx === 'function') sfx('add');
}
// the key pressed while recording (capture phase: nothing else sees it)
function skRecKey(e) {
  if (!SKR.on) return; const t = e.target || {};
  if (!$('.sk-recbox')) { SKR.on = false; SKR.listen = false; return; } // (the window was closed or redrawn: stop listening, never hold the keyboard)
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const id = SKR.id; skRecStop(); skRepaint(); const b = id && skRecBtn(id); if (b) b.focus(); return; }
  if (t.hasAttribute && t.hasAttribute('data-sktype')) { if (e.key === 'Enter') { e.preventDefault(); const c = skFromText(t.value); if (c) { SKR.steps = skSteps(c); skPreview(); skVerdict(c); } else { const v = $('[data-skver]'); if (v) v.innerHTML = '<p class="sk-bad" role="alert">That is not a key OpenTick understands. Try Ctrl+Shift+K, or g then t.</p>'; skLive('That is not a key OpenTick understands.'); } } return; }
  if (!SKR.listen) return; // (not recording: the keyboard works as usual)
  e.preventDefault(); e.stopPropagation();
  if (/^(Shift|Control|Alt|Meta|AltGraph|CapsLock|Dead)$/.test(e.key) || e.repeat) return;
  const k = skKeyOf(e), mods = [e.ctrlKey || e.metaKey ? 'Mod' : '', e.shiftKey ? 'Shift' : '', e.altKey ? 'Alt' : ''].filter(Boolean), step = skCanonStep([...mods, k === ' ' ? 'Space' : k].join('+'));
  if (!step) { skLive('That key cannot be used.'); return; } if (SKR.steps.length >= 3) SKR.steps = [];
  SKR.steps.push(step); skPreview(); skLive(SKR.steps.map(skText).join(' then ')); clearTimeout(SKR.timer); SKR.timer = setTimeout(() => { if (SKR.on && SKR.steps.length) skVerdict(SKR.steps.join(' ')); }, 900);
}
document.addEventListener('keydown', skRecKey, true);
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-ska]'); if (!b || !b.closest('#sk-ed, .sk-tools')) return; const a = b.dataset.ska, id = b.dataset.id;
  if (a === 'rec') skRecStart(id, +b.dataset.i, e.detail === 0); // (detail 0: pressed with the keyboard)
  else if (a === 'listen') { SKR.listen = !SKR.listen; b.setAttribute('aria-pressed', SKR.listen); if (SKR.listen) { SKR.steps = []; skPreview(); const box = $('.sk-recbox'); if (box) box.focus(); skLive('Listening: press the keys you want. Esc stops.'); } else skLive('Not listening.'); }
  else if (a === 'cancel') { const rid = SKR.id; skRecStop(); skRepaint(); const nb = rid && skRecBtn(rid); if (nb) nb.focus(); }
  else if (a === 'use') { const c = SKR.steps.length ? SKR.steps.join(' ') : ''; if (!c) { skLive('Press the keys first, or type them.'); return; } const iss = skVerdict(c); if (!iss.some(x => x.level === 'block' || x.level === 'conflict')) skCommit(c, false); }
  else if (a === 'try') { SKR.steps = skSteps(b.dataset.k); skPreview(); skVerdict(b.dataset.k); }
  else if (a === 'replace') { if (SKR.res) skCommit(SKR.res.canon, true); }
  else if (a === 'del') { skRemoveKey(id, +b.dataset.i, !!(skRecOf(id) && skRecOf(id).pf && skRecOf(id).pf[skPlat()])); skRepaint(); toast('Shortcut removed'); }
  else if (a === 'reset') { skReset(id, skPlatOnly(id)); skRepaint(); toast('Back to the default'); }
  else if (a === 'resetall') askConfirm('Restore every shortcut to its default? Your own choices are removed on all your devices.', 'Restore').then(ok => { if (ok) { skResetAll(); toast('All shortcuts restored'); } openSettings('keys'); }); // (the question replaces the Settings window, so Settings is opened again)
  else if (a === 'export') saveText('opentick-shortcuts.json', skExport()).then(ok => { if (ok) toast('Shortcuts saved'); });
  else if (a === 'import') pickText(['json', 'txt'], 'OpenTick shortcuts').then(f => { if (!f) return; const r = skImport(f); if (!r.ok) { toast(r.error); return; } skRepaint(); toast(`${plural(r.added, 'shortcut')} imported${r.needAttention ? `; ${r.needAttention} need attention` : ''}`); }).catch(() => toast('Could not read that file'));
});
document.addEventListener('input', e => { const t = e.target; if (t && t.id === 'sk-find') { const el = $('#sk-ed'); if (el) el.innerHTML = skEditorHtml(t.value); } });
