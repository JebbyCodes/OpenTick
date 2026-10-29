/* OpenTick background service.
   The goal: no reminder is missed, and the timetable is on screen without opening the app.
   The app builds a plan (the next 14 days of reminders, and the next 3 days of lessons) and hands it to the part of the system that stays alive:
     • Android  the plan goes into opentick-bg.json in the app-data folder. A Kotlin receiver (AlarmManager, restarted after a reboot) shows the
                reminders, and an optional foreground service keeps a persistent notification: the lesson you are in or the next one, with the
                whole day when expanded, and the room as its small icon.
     • Desktop  the Rust side (src-tauri/src/bg.rs) keeps a tray icon with the day's timetable, can stay running when the window is closed,
                can start when you sign in, and shows reminders while the window is hidden.
     • iOS      the next reminders are scheduled as local notifications (the system delivers them; iOS has no background service).
     • Web/PWA  a browser cannot promise to wake a closed page. Reminders arrive while OpenTick is open, in the background or not; the page
                asks for notification permission and the service worker shows them when the browser lets it.
   The plan is plain JSON on this device only. With encryption on, it carries no titles or room names (unless widgets are allowed to show them).
   Settings are per device (S.settings.svc). Nothing here is synced. */
const BG_FILE = 'opentick-bg.json', BG_FIRED = 'opentick-bg-fired.json', BG_DAYS = 14, BG_MAX = 300;
const bgPlat = () => { const T = TAURI(), ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''; return !T ? 'web' : /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'desktop'; };
const svcCfg = () => ({ on: true, tray: true, autostart: false, persist: true, keep: true, ...((S.settings && S.settings.svc) || {}) });
// whether the system side (not this page) is in charge of showing reminders while the page is hidden
const bgNative = () => { const p = bgPlat(); return svcCfg().on && (p === 'android' || p === 'desktop'); };

/* ---- the plan ---- */
function bgTimeline(now) {
  if (typeof ttItems !== 'function' || typeof scHas !== 'function') return [];
  const out = [], day0 = new Date(now); day0.setHours(0, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const d = addDays(day0, i), k = ymd(d), t = ttItems(d), items = [];
    if (!t.off) for (const it of t.items) {
      if (it.k !== 'lesson' && it.k !== 'slot') continue;
      const lsn = it.k === 'lesson', te = lsn ? (scTeacherOf(it.l, it.s) || {}).name || '' : '';
      items.push({ as: new Date(`${k}T${fmtHM(it.a)}`).getTime(), bs: new Date(`${k}T${fmtHM(it.b)}`).getTime(), tm: fmtRange(fmtHM(it.a), fmtHM(it.b)), n: lsn ? scLessonName(it) : it.s.title, r: lsn ? scRoom(it.l, it.s) : (it.s.loc || ''), te, c: cssHex(lsn ? (it.s ? it.s.color : '#888888') : it.s.color, '#888888') });
    }
    items.sort((a, b) => a.as - b.as);
    out.push({ k, t0: d.getTime(), off: t.off ? holName(t.off) : '', items });
  }
  return out;
}
function bgPlan(now = Date.now()) {
  const c = svcCfg(), locked = widgetLocked(), generic = !!(Vault.cfg && Vault.cfg.scopes && Vault.cfg.scopes.local && !Vault.cfg.widgets) || !!Vault.locked;
  const plan = { v: 1, at: now, plat: bgPlat(), cfg: { on: !!c.on, tray: !!c.tray, close: !!c.keep, autostart: !!c.autostart, persist: !!c.persist }, locked, rem: [], tl: [] };
  if (!c.on || Vault.locked) return plan;
  plan.rem = remEntries(now, now + BG_DAYS * 864e5).filter(e => !S.fired[e.key]).slice(0, BG_MAX)
    .map(e => ({ k: e.key, at: e.at, exp: e.exp, t: generic ? 'OpenTick reminder' : e.title, b: generic ? 'Open OpenTick to see it' : e.body, kind: e.kind }));
  if (c.persist && !generic) plan.tl = wgSafe(() => bgTimeline(now), []);
  return plan;
}

/* ---- pushing it ---- */
let bgTimer = 0, bgLastBody = '', bgPushed = false;
function bgSync(now) {
  if (typeof WIDGET !== 'undefined' && WIDGET) return; clearTimeout(bgTimer);
  bgTimer = setTimeout(bgPush, now ? 0 : 2000);
}
async function bgPush() {
  const T = TAURI(), plat = bgPlat();
  try {
    const plan = bgPlan(), body = JSON.stringify({ ...plan, at: 0 });
    if (body === bgLastBody && bgPushed) return; bgLastBody = body; bgPushed = true;
    if (plat === 'android') { const p = await widgetPath(BG_FILE); if (p) await T.fs.writeTextFile(p, JSON.stringify(plan)); }
    else if (plat === 'desktop' && T.core && T.core.invoke) await T.core.invoke('bg_set', { plan: JSON.stringify(plan) });
    else if (plat === 'ios') await bgIosSchedule(plan);
  } catch (e) { /* the service is optional; the page still shows reminders while it is open */ }
}
// iOS: local notifications scheduled ahead (the system keeps a limit of about 64)
async function bgIosSchedule(plan) {
  const N = TAURI().notification; if (!N || !N.sendNotification || !N.Schedule) return;
  try { if (N.cancelAll) await N.cancelAll(); } catch (e) { /* nothing was scheduled */ }
  if (!plan.cfg.on) return;
  plan.rem.filter(r => r.at > Date.now() + 5000).slice(0, 60).forEach((r, i) => { try { N.sendNotification({ id: 1000 + i, title: r.t, body: r.b, schedule: N.Schedule.at(new Date(r.at), false, true) }); } catch (e) { /* skip this one */ } });
}

/* what the system side showed while the page was hidden, so the page does not show it a second time */
async function bgTakeFired() {
  const T = TAURI(), plat = bgPlat(); if (!svcCfg().on) return;
  try {
    let keys = [];
    if (plat === 'desktop' && T.core && T.core.invoke) keys = await T.core.invoke('bg_take_fired');
    else if (plat === 'android') {
      const p = await widgetPath(BG_FIRED); if (!p) return;
      try { keys = JSON.parse(await T.fs.readTextFile(p) || '[]'); } catch (e) { return; }
      if (Array.isArray(keys) && keys.length) await T.fs.writeTextFile(p, '[]');
    }
    if (!Array.isArray(keys) || !keys.length) return;
    const now = Date.now(); for (const k of keys) if (typeof k === 'string') S.fired[k] = now;
    save();
  } catch (e) { /* ignore */ }
}

/* ---- the settings block (shown inside Settings → Notifications) ---- */
function svcSettingsHtml() {
  const c = svcCfg(), p = bgPlat(), row = (k, label, hint, on) => `<label class="a11y-r tg"><span><b>${label}</b><small>${hint}</small></span><input type="checkbox" data-pf="svc.${k}"${on ? ' checked' : ''}></label>`;
  const status = p === 'android' ? 'Reminders are scheduled with the system alarm clock, and come back after the phone restarts.'
    : p === 'desktop' ? 'Reminders are shown by OpenTick’s background part even when the window is closed to the tray.'
      : p === 'ios' ? 'Upcoming reminders are handed to iOS as scheduled notifications. iOS decides how many it keeps (about 60).'
        : 'In a browser, reminders can only arrive while OpenTick is open (in a tab, in the background or installed as an app). Install it as an app and allow notifications for the best result. For reminders with the page closed, use the Android or desktop app.';
  return `<h4 class="mh">Background service</h4><p class="hint">${status}</p>
${row('on', 'Run in the background', 'Keeps reminders and the timetable going when OpenTick is not on screen.', c.on)}
${p === 'desktop' ? row('keep', 'Keep running when the window is closed', 'Closing the window hides OpenTick to the system tray instead of quitting. Quit from the tray menu.', c.keep) + row('tray', 'Tray icon with today’s timetable', 'Shows the current and next lesson (and today’s whole timetable) from the tray. The room is shown as its title where the system allows.', c.tray) + row('autostart', 'Start when I sign in', 'Starts hidden in the tray so reminders are never missed.', c.autostart) : ''}
${p === 'android' ? row('persist', 'Persistent timetable notification', 'An ongoing notification showing the lesson you are in, or the next one. Expand it for the whole day. The room is its icon.', c.persist) : ''}
<p class="hint">Nothing is sent anywhere: the schedule stays on this device. With encryption on, background notifications are generic unless you allow widgets to show a summary.</p>`;
}

/* the page side: start, and keep the plan fresh */
function bgStart() {
  if (typeof WIDGET !== 'undefined' && WIDGET) return;
  bgSync(false); bgTakeFired();
  setInterval(() => { if (svcCfg().on) bgSync(false); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bgTakeFired(); else bgSync(true); });
  window.addEventListener('focus', bgTakeFired);
}
