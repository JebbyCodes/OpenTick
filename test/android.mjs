// Android resources: the notification icon must exist, be a flat white vector, and be the one the app asks for.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname, rd = p => readFileSync(root + p, 'utf8');
const xmlPath = 'src-tauri/android-widgets/res/drawable/ic_stat_opentick.xml';
assert.ok(existsSync(root + xmlPath), 'the drawable exists where android-widgets.mjs copies resources from');
const xml = rd(xmlPath).replace(/<!--[\s\S]*?-->/g, ''); // the comment explains the rules, so it is not checked against them
assert.match(xml, /<vector\b/, 'a vector drawable, not a bitmap or an SVG file'); assert.doesNotMatch(xml, /<svg\b/);
assert.match(xml, /android:width="24dp"/); assert.match(xml, /android:viewportWidth="24"/);
const colors = [...xml.matchAll(/(?:fillColor|strokeColor)="([^"]+)"/g)].map(m => m[1].toUpperCase());
assert.ok(colors.length >= 2 && colors.every(c => c === '#FFFFFFFF'), 'one flat white colour only: Android uses the alpha channel and tints it');
assert.doesNotMatch(xml, /gradient|<aapt:attr|android:fillAlpha="0\.[0-4]/i, 'no gradients or faint fills that Android would drop');
for (const m of xml.matchAll(/strokeWidth="([\d.]+)"/g)) assert.ok(+m[1] >= 2, 'nothing thinner than 2dp survives at status-bar size');
assert.doesNotMatch(xml, /<text|android:text/i);
const main = rd('src/js/main.js'); assert.match(main, /icon = 'ic_stat_opentick'/, 'the app asks for this drawable by name');
assert.match(main, /Android\/i\.test\(navigator\.userAgent/, 'only on Android: other platforms do not get an Android resource name');
assert.match(rd('scripts/android/android-widgets.mjs'), /readdirSync\(join\(src, 'res'\)\)/, 'every res/<dir>/<file> is copied into the generated project');
assert.match(rd('.github/actions/setup-android/action.yml'), /node scripts\/android\/android-widgets\.mjs/, 'CI runs the copy step');
// the capabilities the attachment code needs
const cap = JSON.parse(rd('src-tauri/capabilities/default.json')).permissions;
for (const p of ['fs:allow-read-file', 'fs:allow-write-file', 'fs:allow-read-text-file', 'notification:default', 'dialog:default']) assert.ok(cap.includes(p), 'capability ' + p);

/* ---- the home-screen widgets: Kotlin, layouts, manifest and the app's data have to agree (Kotlin cannot be compiled in these tests) ---- */
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const wdir = 'src-tauri/android-widgets/', kt = {}, res = {};
for (const f of readdirSync(root + wdir + 'kotlin')) kt[f] = rd(wdir + 'kotlin/' + f);
for (const d of readdirSync(root + wdir + 'res')) for (const f of readdirSync(root + wdir + 'res/' + d)) res[d + '/' + f] = rd(wdir + 'res/' + d + '/' + f);
const layoutText = Object.entries(res).filter(([k]) => k.startsWith('layout/')).map(([, v]) => v).join('\n');
const ids = new Set([...layoutText.matchAll(/@\+id\/([\w]+)/g)].map(m => m[1]));
const allKt = Object.values(kt).join('\n');
// the generated layouts are current
execFileSync(process.execPath, [root + 'scripts/android/gen-widget-layouts.mjs'], { stdio: 'pipe' });
const after = {}; for (const d of readdirSync(root + wdir + 'res')) for (const f of readdirSync(root + wdir + 'res/' + d)) after[d + '/' + f] = rd(wdir + 'res/' + d + '/' + f);
for (const k of Object.keys(res)) assert.equal(after[k], res[k], 'run scripts/android/gen-widget-layouts.mjs: ' + k + ' is out of date');
// every R.id / R.layout / R.drawable / R.xml the Kotlin names exists
for (const m of allKt.matchAll(/R\.id\.(\w+)/g)) assert.ok(ids.has(m[1]), 'R.id.' + m[1] + ' is in a layout');
for (const m of allKt.matchAll(/R\.layout\.(\w+)/g)) assert.ok(res['layout/' + m[1] + '.xml'], 'layout ' + m[1]);
for (const m of allKt.matchAll(/R\.drawable\.(\w+)/g)) assert.ok(res['drawable/' + m[1] + '.xml'], 'drawable ' + m[1]);
// views looked up by name: "ot_ls_n$n" needs ot_ls_n0 ..., "ot_mx_t${i}_$j" needs ot_mx_t0_0, a plain "ot_x_y" needs itself
for (const m of allKt.matchAll(/"(ot_[a-z]+_[a-z]+)(\$[a-z]|\$\{[a-z]\}_\$[a-z])?"/g)) {
  const [, base, tail] = m; const want = !tail ? base : tail.includes('_') ? base + '0_0' : base + '0';
  assert.ok(ids.has(want), `view ${want} (from ${m[0]}) is in a layout`);
}
// layouts only use ids that are unique, and every drawable and string a layout names exists
for (const [k, v] of Object.entries(res)) if (k.startsWith('layout/')) {
  const own = [...v.matchAll(/android:id="@\+id\/(\w+)"/g)].map(m => m[1]); assert.equal(new Set(own).size, own.length, k + ': ids are unique');
  for (const m of v.matchAll(/@drawable\/(\w+)/g)) assert.ok(res['drawable/' + m[1] + '.xml'], k + ' names drawable ' + m[1]);
}
// every widget in the manifest has its class, info file, label and description, and is refreshed with the others
const mf = rd(wdir + 'manifest-snippet.xml'), strings = res['values/ot_widget_strings.xml'];
const recv = [...mf.matchAll(/<receiver android:name="__PACKAGE__\.(\w+)"[^>]*label="@string\/(\w+)"[\s\S]*?resource="@xml\/(\w+)"/g)];
assert.equal(recv.length, 11, 'eleven widgets: tasks, quick add, lists, projects, notes, calendar, timetable, matrix, habits, countdowns, focus');
for (const [, cls, label, info] of recv) {
  assert.ok(kt[cls + '.kt'], cls + '.kt'); assert.match(kt['OtUi.kt'], new RegExp(cls + '::class\\.java'), cls + ' is in OtUi.refreshAll');
  assert.ok(strings.includes(`name="${label}"`) && strings.includes(`name="${label.replace('_label', '_desc')}"`), label + ' and its description');
  const x = res['xml/' + info + '.xml']; assert.ok(x, info); const lay = info.replace(/_info$/, '');
  // what the home screen shows before the app fills a widget in (and for the picker preview) is one small layout that cannot fail, not the big one
  assert.match(x, /initialLayout="@layout\/ot_widget_loading"/, info + ': a small, safe initial layout'); assert.match(x, /previewLayout="@layout\/ot_widget_loading"/, info + ': a preview');
  assert.ok(res['layout/' + lay + '.xml'], 'layout ' + lay);
  assert.match(kt[cls + '.kt'], new RegExp('override val layout = R\\.layout\\.' + lay + '\\b'), cls + ' draws ' + lay);
  // a widget can never be resized smaller than the size it is offered at
  const num = k => +x.match(new RegExp('android:' + k + '="(\\d+)dp"'))[1];
  assert.ok(num('minResizeWidth') <= num('minWidth'), info + ': minResizeWidth is not more than minWidth'); if (/minResizeHeight/.test(x)) assert.ok(num('minResizeHeight') <= num('minHeight'), info + ': minResizeHeight is not more than minHeight');
  assert.match(x, /updatePeriodMillis="(\d+)"/); assert.ok(+x.match(/updatePeriodMillis="(\d+)"/)[1] >= 1800000, 'Android ignores a shorter refresh period');
}
// what a home screen is allowed to build and call: only these view classes can be inflated in a widget, and a call must reach a view of the right type
// (setTextColor on an ImageView, or setColorFilter on a TextView, makes the host refuse the WHOLE widget with "Can't load widget")
{
  const ALLOWED = new Set(['FrameLayout', 'LinearLayout', 'RelativeLayout', 'GridLayout', 'TextView', 'ImageView', 'ImageButton', 'Button', 'Chronometer', 'ProgressBar', 'TextClock', 'AnalogClock', 'ViewFlipper']);
  const typeOf = {};
  for (const [k, v] of Object.entries(res)) if (k.startsWith('layout/')) {
    for (const m of v.matchAll(/<(\w[\w.]*)\b/g)) assert.ok(ALLOWED.has(m[1]), `${k}: <${m[1]}> cannot be used in a widget`);
    for (const m of v.matchAll(/<(\w+)\b[^>]*?android:id="@\+id\/(\w+)"/g)) (typeOf[m[2]] ||= new Set()).add(m[1]);
  }
  const okOn = { setTextViewText: ['TextView', 'Chronometer'], setTextColor: ['TextView', 'Chronometer'], setImageViewBitmap: ['ImageView'], setImageViewResource: ['ImageView'], setColorFilter: ['ImageView'], setChronometer: ['Chronometer'], setChronometerCountDown: ['Chronometer'] };
  let checked = 0;
  for (const src of Object.values(kt)) { // variable names mean different views in different files, so each file is read on its own
    const arrays = {}; for (const m of src.matchAll(/private val (\w+) = intArrayOf\(([^)]*)\)/g)) arrays[m[1]] = [...m[2].matchAll(/R\.id\.(\w+)/g)].map(x => x[1]);
    const vars = {}; for (const m of src.matchAll(/val (\w+) = (OtUi\.rid\(context, "[^"]+"\)|R\.id\.\w+)/g)) vars[m[1]] = m[2];
    const check = (call, arg) => {
      let e = vars[arg] || arg, names;
      const idm = /^R\.id\.(\w+)$/.exec(e), ridm = /^OtUi\.rid\(context, "([^"]+)"\)$/.exec(e), arr = /^(\w+)\[\w+\]$/.exec(e);
      if (idm) names = [idm[1]]; else if (ridm) names = [ridm[1].replace(/\$\{?\w+\}?/g, '0')]; else if (arr && arrays[arr[1]]) names = arrays[arr[1]]; else return; // a parameter (head() builds names itself; checked below)
      for (const n of names) { checked++; assert.ok(typeOf[n], `${call}: view ${n} does not exist`); assert.ok([...typeOf[n]].every(t => okOn[call].includes(t)), `${call} is called on ${n}, which is a ${[...typeOf[n]]}`); }
    };
    for (const m of src.matchAll(/rv\.(setTextViewText|setTextColor|setImageViewBitmap|setImageViewResource|setChronometer|setChronometerCountDown)\(\s*(OtUi\.rid\([^)]*\)|R\.id\.\w+|\w+(?:\[\w+\])?)/g)) check(m[1], m[2]);
    for (const m of src.matchAll(/OtUi\.tint\(\s*rv,\s*(OtUi\.rid\([^)]*\)|R\.id\.\w+|\w+(?:\[\w+\])?)/g)) check('setColorFilter', m[1]);
  }
  assert.ok(checked > 100, 'the type check really ran (' + checked + ' calls)');
  // the shared header / empty / more parts every widget builds by name
  for (const k of ['ot_ls', 'ot_pr', 'ot_nt', 'ot_cal', 'ot_tt', 'ot_mx', 'ot_hb', 'ot_cd', 'ot_fc']) {
    for (const [suf, want] of [['_bg', 'ImageView'], ['_title', 'TextView'], ['_sub', 'TextView']]) assert.deepEqual([...(typeOf[k + suf] || [])], [want], k + suf);
    for (const suf of ['_add', '_plus']) if (typeOf[k + suf]) assert.deepEqual([...typeOf[k + suf]], ['ImageView'], k + suf);
  }
}
// the failure paths: a widget that cannot be drawn shows a plain card with the reason, and nothing in the service can take the process down
assert.ok(res['layout/ot_widget_loading.xml'] && /ot_ld_text/.test(res['layout/ot_widget_loading.xml']), 'the plain card layout');
assert.match(kt['OtBaseWidget.kt'], /fun fallback\(/); assert.match(kt['OtBaseWidget.kt'], /R\.layout\.ot_widget_loading/); assert.doesNotMatch(kt['OtBaseWidget.kt'], /updateAppWidget\(id, RemoteViews\(context\.packageName, layout\)\)/, 'a failed widget no longer falls back to the big unfilled layout (white shapes)');
assert.match(res['raw/ot_widget_keep.xml'], /tools:keep="[^"]*@layout\/ot_widget_\*/, 'release builds keep the widget resources by name (Kotlin finds the rows by name)');
{ const svc = kt['OpenTickBg.kt'], on = svc.slice(svc.indexOf('override fun onStartCommand')); assert.match(on, /plainNotification/, 'the service always has a notification to put up in time'); assert.match(on.slice(0, on.indexOf('override fun onTaskRemoved')), /catch \(e: Throwable\)/, 'nothing escapes onStartCommand');
  assert.match(svc, /ic_dialog_info/, 'the small icon is never 0'); const boot = kt['OpenTickWidgetBoot.kt']; assert.equal((boot.match(/postDelayed\(\{ try/g) || []).length, 4, 'every delayed call in the boot provider is guarded'); }
// braces and parentheses balance in every Kotlin file (a cheap guard against a broken edit)
for (const [f, t] of Object.entries(kt)) { const code = t.replace(/"(\\.|[^"\\])*"/g, '""').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); for (const [a, b] of [['{', '}'], ['(', ')'], ['[', ']']]) assert.equal(code.split(a).length, code.split(b).length, `${f}: ${a}${b} balance`); }
// the data the widgets read is written by the app
const wj = rd('src/js/widget.js');
for (const m of allKt.matchAll(/\bdata\?\.opt(?:JSONArray|JSONObject)\("(\w+)"\)/g)) if (m[1] !== 'theme') assert.match(wj, new RegExp('\\b' + m[1] + ': '), 'the snapshot has "' + m[1] + '"');
for (const op of ['nav', 'page', 'note', 'newnote', 'focus', 'habit']) assert.match(wj, new RegExp("'" + op + "'"), 'the app acts on widget op ' + op);
// the background service: Kotlin parts, manifest entries, and the keys the page writes are the keys Kotlin reads
{
  const bg = kt['OpenTickBg.kt'], bj = rd('src/js/bg.js'), bm = rd(wdir + 'manifest-bg.xml'), bp = rd(wdir + 'manifest-bg-permissions.xml');
  for (const cls of ['OpenTickBgReceiver', 'OpenTickTimetableService']) { assert.match(bg, new RegExp('class ' + cls + '\\b'), cls); assert.match(bm, new RegExp('__PACKAGE__\\.' + cls), cls + ' is in the manifest'); }
  for (const perm of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_SPECIAL_USE', 'SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM']) assert.match(bp, new RegExp('android\\.permission\\.' + perm + '"'), perm);
  assert.match(bm, /BOOT_COMPLETED/); assert.match(bm, /foregroundServiceType="specialUse"/);
  for (const [, k] of bg.matchAll(/optString\("(\w+)"\)|optLong\("(\w+)"\)/g)) void k;
  const planKeys = bj.slice(bj.indexOf('function bgPlan'), bj.indexOf('/* ---- pushing it'));
  for (const k of ['rem', 'tl', 'cfg']) assert.ok(planKeys.includes(k), 'the plan has ' + k);
  assert.match(bj, /BG_FILE = 'opentick-bg\.json'/); assert.match(bg, /PLAN = "opentick-bg\.json"/); assert.match(bj, /BG_FIRED = 'opentick-bg-fired\.json'/); assert.match(bg, /FIRED = "opentick-bg-fired\.json"/);
  for (const f of ['as', 'bs', 'tm', 'n', 'r', 'te', 'k', 't0']) assert.match(bj, new RegExp('\\b' + f + '\\s*[:,}]'), 'the timeline writes "' + f + '"');
  for (const f of ['at', 'exp', 'k', 't', 'b']) assert.match(bj, new RegExp('\\b' + f + '\\s*[:,}]'), 'a reminder carries "' + f + '"');
  assert.equal((bg.match(/\{/g) || []).length, (bg.match(/\}/g) || []).length, 'OpenTickBg.kt braces balance');
  // the foreground service must not depend on there being a timetable (that was why OpenTick never showed under "Active apps")
  const want = bg.slice(bg.indexOf('fun wantsService'), bg.indexOf('private class Rem'));
  assert.ok(want.includes('?: return true'), 'before the first plan is written the service still starts'); assert.ok(!/lessons\(/.test(want), 'wantsService does not need a lesson');
  assert.doesNotMatch(bg, /wantsTimetable/, 'the old lesson-only condition is gone');
  assert.match(bg, /FOREGROUND_SERVICE_IMMEDIATE/, 'the notification shows at once on Android 12+'); assert.match(bg, /override fun onTaskRemoved/, 'it comes back after a swipe from recents');
  assert.match(bg, /ACTION_RESTART/); assert.match(bj, /bgAskOnce/, 'the page asks for notification permission once');
  const rs = rd('src-tauri/src/bg.rs'); assert.equal((rs.match(/\{/g) || []).length, (rs.match(/\}/g) || []).length, 'bg.rs braces balance');
  assert.match(rd('src-tauri/src/lib.rs'), /bg_set, bg::bg_take_fired/); assert.match(bj, /invoke\('bg_set'/); assert.match(bj, /invoke\('bg_take_fired'/);
  assert.match(rd('src-tauri/Cargo.toml'), /"tray-icon"/); assert.match(rd('src-tauri/Cargo.toml'), /serde_json/);
}
console.log('android resource tests passed');
