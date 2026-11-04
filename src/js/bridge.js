/* OpenTick Bridge v1: the one, small, documented way other apps talk to OpenTick (and OpenTick to them).
   Full contract: docs/INTEGRATION.md. In short:
   • One command set (brCmds) behind one dispatcher (bridgeCall). Every transport ends there, so behaviour, permissions and limits are identical.
   • Transports: a URL (x-callback-url style: opentick://x-callback-url/<command>?… with x-success / x-error, the de-facto standard that many
     apps already speak; the installable web app also answers web+opentick:), window.postMessage (embeds, popups, companion web apps), and
     the Android link activity, which queues a URL for the app exactly as widget taps are queued.
   • Off by default (Settings → Integrations). An app first asks to pair; you see who is asking and what for, choose the permissions, and the app
     receives a random token. OpenTick keeps only a hash of it, on this device only: the token and the list of connected apps are device settings, never
     part of the synced (and optionally encrypted) data, so syncing never hands one device's pairing to another.
   • Read access is least-privilege: tasks come back without notes unless asked for; the sync passphrase, the vault and the sync file are never reachable.
   • Data stays yours: a connected app can only do what its permissions allow, can be revoked at any time, and nothing here uses the network.
   • The other direction: "openUrl" is a URL template (Settings → Integrations) that opens a task in another app (for example a focus app),
     and task.completed / task.reopened events are posted on BroadcastChannel 'opentick.bridge' and to paired embedding windows. */
const BR_V = 1;
const BR_PERMS = [['tasks:read', 'See your tasks, lists, projects and tags'], ['tasks:write', 'Add tasks and tick them off'], ['focus:write', 'Record focus time on a task'], ['countdowns:read', 'See your countdowns']];
const BR_LIMIT = { perMin: 120, tasks: 500 };
const brCfg = () => { const c = S.settings.bridge || (S.settings.bridge = { on: false, apps: {}, openUrl: '' }); if (!c.apps || typeof c.apps !== 'object') c.apps = {}; return c; };
const brOn = () => !!brCfg().on;
const brErr = (code, message) => ({ ok: false, error: { code, message } });
const brOk = result => ({ ok: true, result });
const brAppId = s => (/^[a-z0-9][a-z0-9._-]{1,39}$/.test(String(s || '')) ? String(s) : '');
async function brHash(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function brToken() { const a = new Uint8Array(24); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
const brHits = new Map();
function brRate(app) { const now = Date.now(), l = (brHits.get(app) || []).filter(t => now - t < 60000); l.push(now); brHits.set(app, l); return l.length <= BR_LIMIT.perMin; }

/* ---------- what goes out ---------- */
function brTask(t, inc = []) {
  const l = S.lists.find(x => x.id === t.listId), o = { id: t.id, title: t.title, status: t.status, due: t.due || null, time: t.time || null, tz: t.tz || null, durationMin: t.dur || null, priority: t.priority || 0, listId: t.listId, list: l ? l.name : null, tags: [...(t.tags || [])], repeats: !!t.repeat, subtasks: (t.subtasks || []).length, created: t.created || null, updated: t.u || null, doneAt: t.doneAt || null };
  if (inc.includes('notes')) o.notes = t.notes || '';
  return o;
}
const brCountdown = c => { const L = cdLeft(c); return { id: c.id, name: c.name, date: L.date, time: c.time || null, tz: c.tz || null, momentMs: L.at, past: L.past, repeat: c.repeat || null, listId: c.listId || null, projectId: c.projectId || null, tags: [...c.tags] }; };
function brDue(t, w) {
  if (!w) return true; const td = todayStr();
  if (w === 'today') return !!t.due && t.due <= td; if (w === 'overdue') return !!t.due && t.due < td;
  if (w === 'week') return !!t.due && t.due >= td && t.due <= ymd(addDays(new Date(), 7)); if (/^\d{4}-\d\d-\d\d$/.test(w)) return t.due === w; return true;
}
const brStr = (v, n) => String(v == null ? '' : v).slice(0, n);
const brList = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,]+/)).map(x => String(x).replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 20);

/* ---------- the commands ---------- */
const BR_CMDS = {
  hello: { auth: false, run: () => ({ app: 'OpenTick', bridge: BR_V, version: typeof APP_VERSION === 'string' ? APP_VERSION : '', commands: Object.keys(BR_CMDS), permissions: BR_PERMS.map(p => p[0]) }) },
  pair: { auth: false, run: null }, // handled in bridgeCall: it needs the person
  'meta.list': { perm: 'tasks:read', run: () => ({ lists: S.lists.map(l => ({ id: l.id, name: l.name, parent: l.parent || null, color: l.color })), projects: S.projects.map(p => ({ id: p.id, name: p.name, listIds: projectListIds(p) })), tags: allTags() }) },
  'tasks.list': { perm: 'tasks:read', run: a => {
    const sc = brStr(a.scope, 120), st = a.status || 'open', lim = Math.max(1, Math.min(BR_LIMIT.tasks, +a.limit || 100)), q = brStr(a.q, 100).toLowerCase(), since = +a.since || 0, inc = brList(a.include);
    const l = S.tasks.filter(t => !t.deleted && !t.log && (st === 'all' || t.status === st) && scopeHas(sc, t) && brDue(t, a.due) && (!q || t.title.toLowerCase().includes(q)) && (!since || (t.u || 0) > since)).sort((x, y) => (x.due || '9') < (y.due || '9') ? -1 : (x.due || '9') > (y.due || '9') ? 1 : (x.order || 0) - (y.order || 0));
    return { count: l.length, tasks: l.slice(0, lim).map(t => brTask(t, inc)) };
  } },
  'tasks.get': { perm: 'tasks:read', run: a => { const t = getT(brStr(a.id, 40)); if (!t || t.deleted) throw brErr('not_found', 'No such task'); return { task: brTask(t, brList(a.include)) }; } },
  // everything that changed since a time, and the ids that were deleted: the way to keep a companion app in step without a server
  'tasks.changes': { perm: 'tasks:read', run: a => {
    const since = +a.since || 0, now = Date.now(), inc = brList(a.include);
    return { now, tasks: S.tasks.filter(t => !t.log && (t.u || 0) > since).slice(0, BR_LIMIT.tasks).map(t => brTask(t, inc)), deleted: Object.entries(S.tomb).filter(([, ts]) => ts > since).map(([id]) => id).slice(0, 2000) };
  } },
  'tasks.add': { perm: 'tasks:write', run: a => {
    const title = brStr(a.title, 500).trim(); if (!title) throw brErr('bad_args', 'title is required');
    const o = { title, notes: brStr(a.notes, 20000), tags: brList(a.tags), priority: Math.max(0, Math.min(3, +a.priority || 0)) };
    if (a.listId) { if (!S.lists.some(l => l.id === a.listId)) throw brErr('bad_args', 'Unknown listId'); o.listId = a.listId; }
    if (a.due) { if (!/^\d{4}-\d\d-\d\d$/.test(a.due)) throw brErr('bad_args', 'due must be YYYY-MM-DD'); o.due = a.due; }
    if (a.time) { if (!validHM(a.time)) throw brErr('bad_args', 'time must be HH:MM'); o.time = a.time.length === 4 ? '0' + a.time : a.time; if (!o.due) o.due = todayStr(); }
    if (a.tz) { if (!tzValid(a.tz)) throw brErr('bad_args', 'Unknown tz'); o.tz = a.tz; }
    if (+a.durationMin > 0) o.dur = Math.min(1440, Math.floor(+a.durationMin));
    const t = newTask(o); prefNewTask(t, {}); S.tasks.push(t); save(); if (typeof refresh === 'function') refresh();
    return { task: brTask(t) };
  } },
  'tasks.complete': { perm: 'tasks:write', run: a => { const t = getT(brStr(a.id, 40)); if (!t || t.deleted) throw brErr('not_found', 'No such task'); if (t.status === 'open') { toggleDone(t); save(); if (typeof refresh === 'function') refresh(); } return { task: brTask(t) }; } },
  'tasks.reopen': { perm: 'tasks:write', run: a => { const t = getT(brStr(a.id, 40)); if (!t || t.deleted) throw brErr('not_found', 'No such task'); if (t.status === 'done') { toggleDone(t); save(); if (typeof refresh === 'function') refresh(); } return { task: brTask(t) }; } },
  // a focus session done in another app, logged with OpenTick's own focus history
  'focus.record': { perm: 'focus:write', run: (a, app) => {
    const min = Math.round(+a.minutes), ts = +a.endedAt || Date.now(); if (!(min >= 1 && min <= 600)) throw brErr('bad_args', 'minutes must be 1 to 600');
    const task = a.taskId ? getT(brStr(a.taskId, 40)) : null; if (a.taskId && (!task || task.deleted)) throw brErr('not_found', 'No such task');
    if (ts > Date.now() + 6e4 || ts < Date.now() - 30 * 864e5) throw brErr('bad_args', 'endedAt must be within the last 30 days');
    S.pomo.push({ ts, min, task: task ? task.id : null, src: app }); save(); return { recorded: true };
  } },
  'countdowns.list': { perm: 'countdowns:read', run: a => ({ countdowns: S.countdowns.filter(c => !c.archived && scopeHas(brStr(a.scope, 120), c)).map(brCountdown) }) },
  // bring OpenTick forward on a task, page or list
  'app.open': { perm: 'tasks:read', run: a => {
    const op = ['open', 'page', 'nav'].includes(a.op) ? a.op : 'open'; if (op === 'open' && !getT(brStr(a.id, 40))) throw brErr('not_found', 'No such task');
    if (typeof wgRunCommand === 'function') wgRunCommand(JSON.stringify({ op, id: a.id, nav: a.id, page: a.id })); return { opened: true };
  } },
};

/* ---------- the dispatcher: every transport ends here ---------- */
async function brPairDialog(req, origin) {
  const want = (Array.isArray(req.args && req.args.permissions) ? req.args.permissions : []).filter(p => BR_PERMS.some(x => x[0] === p));
  const name = brStr((req.args && req.args.name) || req.app, 60), where = origin ? ` (${origin})` : '';
  const v = await formDialog({ title: 'Connect an app', ok: 'Allow', fields: [
    { k: 'h', type: 'hint', label: `“${name}”${where} wants to connect to OpenTick. Choose what it may do. You can disconnect it in Settings → Integrations at any time.` },
    ...BR_PERMS.map(([k, n]) => ({ k: 'p_' + k, type: 'check', label: n, v: want.includes(k) })),
  ], check: x => (BR_PERMS.some(([k]) => x['p_' + k]) ? '' : 'Choose at least one permission, or press Cancel') });
  if (!v) return null;
  return { name, perms: BR_PERMS.map(p => p[0]).filter(k => v['p_' + k]) };
}
/* req = { app, token, cmd, args }; ctx = { origin } (set by the postMessage transport). Resolves to { ok, result } or { ok:false, error:{ code, message } }. */
async function bridgeCall(req, ctx = {}) {
  try {
    const cfg = brCfg(), cmd = String(req && req.cmd || ''), def = BR_CMDS[cmd], args = req && req.args && typeof req.args === 'object' ? req.args : {};
    if (!cfg.on) return brErr('off', 'Integrations are switched off in OpenTick (Settings → Integrations).');
    if (typeof Vault !== 'undefined' && Vault.locked) return brErr('locked', 'OpenTick is locked. Unlock it and try again.');
    if (!def) return brErr('unknown_command', 'Unknown command: ' + cmd);
    if (cmd === 'hello') return brOk(def.run());
    const app = brAppId(req.app); if (!app) return brErr('bad_args', 'app must be 2 to 40 characters: a-z, 0-9, dot, dash, underscore');
    if (!brRate(app)) return brErr('rate_limited', 'Too many requests');
    if (cmd === 'pair') {
      const g = await brPairDialog({ ...req, app }, ctx.origin); if (!g) return brErr('denied', 'The person declined.');
      const token = brToken(); cfg.apps[app] = { name: g.name, hash: await brHash(token), perms: g.perms, at: Date.now(), used: 0, origins: ctx.origin ? [ctx.origin] : [] }; save();
      return brOk({ token, permissions: g.perms });
    }
    const rec = cfg.apps[app]; if (!rec || !req.token || (await brHash(req.token)) !== rec.hash) return brErr('unauthorized', 'Unknown app or wrong token. Pair again.');
    if (ctx.origin && !(rec.origins || []).includes(ctx.origin)) return brErr('unauthorized', 'This app is paired for a different origin.');
    if (def.perm && !rec.perms.includes(def.perm)) return brErr('forbidden', `This app was not given “${def.perm}”.`);
    rec.used = Date.now();
    const out = def.run(args, app); brSaveSoon();
    return brOk(out);
  } catch (e) { return e && e.ok === false ? e : brErr('error', String(e && e.message || e)); }
}
let brSaveT = 0; const brSaveSoon = () => { clearTimeout(brSaveT); brSaveT = setTimeout(() => { try { save(); } catch (e) { /* later */ } }, 2000); };

/* ---------- transport 1: URLs ---------- */
const BR_RESERVED = ['app', 'token', 'args', 'x-success', 'x-error', 'x-cancel', 'x-source'];
function bridgeParseUrl(raw) {
  let u; try { u = new URL(String(raw)); } catch (e) { return null; }
  if (!/^(opentick|web\+opentick):$/.test(u.protocol)) return null;
  let cmd = u.hostname === 'x-callback-url' ? u.pathname.replace(/^\/+/, '') : (u.hostname || '') + (u.pathname || '').replace(/\/+$/, ''); cmd = decodeURIComponent(cmd).replace(/^\/+/, '');
  if (!cmd && u.protocol === 'web+opentick:') cmd = u.pathname.replace(/^\/+/, '');
  const q = u.searchParams; let args = {};
  try { if (q.get('args')) args = JSON.parse(q.get('args')); } catch (e) { return { cmd, bad: 'args is not valid JSON' }; }
  if (!args || typeof args !== 'object' || Array.isArray(args)) args = {};
  for (const [k, v] of q) if (!BR_RESERVED.includes(k) && args[k] === undefined) args[k] = v;
  if (cmd === 'pair' && typeof args.permissions === 'string') args.permissions = args.permissions.split(/[\s,]+/).filter(Boolean);
  return { cmd, args, app: q.get('app') || '', token: q.get('token') || '', success: q.get('x-success') || '', error: q.get('x-error') || '', cancel: q.get('x-cancel') || '' };
}
// a reply may only go to a custom scheme or https (or http on this device): never to javascript:, data:, file: and the like
function brCallbackOk(u) {
  try { const x = new URL(u); if (/^(javascript|data|file|blob|vbscript|about|ws|wss|ftp):$/i.test(x.protocol)) return false; if (x.protocol === 'http:') return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(x.hostname); return true; } catch (e) { return false; }
}
function brReply(base, params) {
  if (!base || !brCallbackOk(base)) return false;
  const u = new URL(base); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  openExternal(u.toString()); return true;
}
async function bridgeHandleUrl(raw) {
  const r = bridgeParseUrl(raw); if (!r) return false;
  const res = r.bad ? brErr('bad_args', r.bad) : await bridgeCall({ app: r.app, token: r.token, cmd: r.cmd, args: r.args });
  if (res.ok) { if (!brReply(r.success, { ok: '1', result: JSON.stringify(res.result) })) toast('Done: ' + r.cmd); }
  else { const done = brReply(res.error.code === 'denied' ? (r.cancel || r.error) : r.error, { ok: '0', errorCode: res.error.code, errorMessage: res.error.message }); if (!done) toast(res.error.message); }
  return res;
}

/* ---------- transport 2: postMessage ---------- */
window.addEventListener('message', async ev => {
  const m = ev.data; if (!m || typeof m !== 'object' || m.opentick !== 1 || !ev.source || typeof ev.source.postMessage !== 'function') return;
  if (WIDGET) return;
  const origin = ev.origin && ev.origin !== 'null' ? ev.origin : '', res = origin ? await bridgeCall({ app: m.app, token: m.token, cmd: m.cmd, args: m.args }, { origin }) : brErr('bad_origin', 'Messages from an opaque origin are not accepted.');
  if (!origin) return;
  try { ev.source.postMessage({ opentick: 1, id: m.id == null ? null : m.id, ...res }, origin); } catch (e) { /* the sender went away */ }
});

/* ---------- events out ---------- */
let brChan = null; try { if (typeof BroadcastChannel === 'function') brChan = new BroadcastChannel('opentick.bridge'); } catch (e) { brChan = null; }
function brEvent(type, t) {
  if (!brOn() || WIDGET) return;
  const msg = { opentick: 1, event: type, task: brTask(t), at: Date.now() };
  try { if (brChan) brChan.postMessage(msg); } catch (e) { /* ignore */ }
  const origins = new Set(); for (const a of Object.values(brCfg().apps)) if (a.perms && a.perms.includes('tasks:read')) (a.origins || []).forEach(o => origins.add(o));
  for (const w of [window.opener, window.parent !== window ? window.parent : null]) if (w) for (const o of origins) { try { w.postMessage(msg, o); } catch (e) { /* not that origin */ } }
}

/* ---------- OpenTick → another app: the URL template ---------- */
function brOpenUrl(t) {
  const tpl = String(brCfg().openUrl || '').trim(); if (!tpl) return '';
  const l = S.lists.find(x => x.id === t.listId), p = S.projects.find(x => projectListIds(x).includes(t.listId)), f = (v) => encodeURIComponent(String(v == null ? '' : v));
  const url = tpl.replace(/\{(id|title|minutes|list|project|tags|due)\}/g, (_, k) => f({ id: t.id, title: t.title, minutes: t.dur || 25, list: l ? l.name : '', project: p ? p.name : '', tags: (t.tags || []).join(','), due: t.due || '' }[k]));
  return brCallbackOk(url) ? url : '';
}
const brSendable = () => { const u = String(brCfg().openUrl || '').trim(); return !!u && brCallbackOk(u.replace(/\{[a-z]+\}/g, 'x')); };

/* ---------- Settings → Integrations ---------- */
function brAppsHtml() {
  const apps = Object.entries(brCfg().apps);
  return apps.length ? apps.map(([id, a]) => `<div class="vrow br-app"><span><b>${esc(a.name || id)}</b> <small>${esc(id)}</small><br><small>${a.perms.map(p => esc((BR_PERMS.find(x => x[0] === p) || [p, p])[1])).join(' · ') || 'No permissions'}${a.used ? ' · last used ' + esc(new Date(a.used).toLocaleString()) : ' · not used yet'}</small></span><button class="btn sm danger" data-act="brrevoke" data-app="${esc(id)}">Disconnect</button></div>`).join('') : '<p class="hint">No apps are connected.</p>';
}
function bridgeSettingsHtml() {
  const c = brCfg(), rows = brAppsHtml();
  return `<h4 class="mh">Connect other apps</h4><p class="hint" style="margin-top:0">Lets an app you trust read or add tasks, tick them off or log focus time, using one documented interface. Nothing is shared until you approve an app, and everything stays on this device.</p>`
    + `<label class="a11y-r tg"><span><b>Allow other apps to connect</b><small>Off by default. Switching it off stops every app at once.</small></span><input type="checkbox" data-pf="bridge.on"${c.on ? ' checked' : ''}></label>`
    + `<h4 class="mh">Connected apps</h4><div class="vlist" id="br-apps">${rows}</div>`
    + `<h4 class="mh">Open a task in another app</h4><label class="form one"><span class="hint">A link OpenTick opens from a task’s menu. Use {id} {title} {minutes} {list} {project} {tags} {due}.</span><input data-pf="bridge.openUrl" value="${esc(c.openUrl || '')}" placeholder="myapp://focus?title={title}&minutes={minutes}" autocomplete="off" spellcheck="false"></label>`
    + `<p class="hint">Developers: the interface is described in docs/INTEGRATION.md in the OpenTick source.</p>`;
}
const BR_ACT = {
  brrevoke(el) { const c = brCfg(), id = el.dataset.app; if (c.apps[id]) { delete c.apps[id]; save(); const b = $('#br-apps'); if (b) b.innerHTML = brAppsHtml(); toast('Disconnected'); } },
  bropen(el) { const t = getT(el.dataset.id); const u = t && brOpenUrl(t); if (u) openExternal(u); else toast('Set the link in Settings → Integrations first'); },
};

/* ---------- desktop and iOS apps: links arrive from the shell ----------
   The Rust side (src-tauri/src/link.rs) keeps links that came before the page was ready; link_take hands them over and from then on each
   one arrives as the "opentick-link" event. The scheme itself is registered for this user (Windows registry, Linux desktop entry) only
   while integrations are switched on; macOS and iOS declare it in Info.plist, Android in its manifest. */
let brNativeOn = false;
async function bridgeNative() {
  const T = typeof TAURI === 'function' ? TAURI() : null;
  if (!T || !T.core || !T.core.invoke || (typeof WIDGET !== 'undefined' && WIDGET) || (typeof isAndroidApp === 'function' && isAndroidApp())) return;
  try {
    if (!brNativeOn) {
      brNativeOn = true;
      if (T.event && T.event.listen) await T.event.listen('opentick-link', e => bridgeHandleUrl(String(e && e.payload || '')));
      for (const u of (await T.core.invoke('link_take')) || []) bridgeHandleUrl(String(u));
    }
    if (typeof desktopApp === 'function' && desktopApp()) await T.core.invoke('link_scheme', { on: brOn() });
  } catch (e) { brNativeOn = false; /* an older shell without the commands: links simply do not arrive */ }
}

/* ---------- starting points: a link the installed web app was opened with ---------- */
if (typeof location !== 'undefined' && typeof setTimeout === 'function') setTimeout(() => {
  if (typeof WIDGET !== 'undefined' && WIDGET) return;
  try { const q = new URLSearchParams(location.search).get('link'); if (q) { history.replaceState(null, '', location.pathname); bridgeHandleUrl(q); } } catch (e) { /* no link */ }
  bridgeNative();
}, 900);
