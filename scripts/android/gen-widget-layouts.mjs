#!/usr/bin/env node
/* Writes the Android widget layouts, widget-info files and strings (src-tauri/android-widgets/res) for every OpenTick widget.

   How a widget is built (0.6.2):
     • one small SHELL layout per widget: a header, an "empty" line, an empty container for the rows and a "+N more" line;
     • one small ROW layout per kind of row (a task, a list, a note ...), which the Kotlin code fills in and adds to the container with
       RemoteViews.addView(), as many as the widget is tall enough for.
   Before 0.6.2 every row of every widget existed once in a big layout and the Kotlin code showed, hid and looked up each view by name.
   That meant hundreds of views and hundreds of calls for the home screen to inflate and apply for one widget (the calendar had 42 cells x 4 views),
   and a home screen that refused any one of them showed "Can't load widget" for the whole widget. Small layouts built from a few views each,
   and ids named directly in Kotlin (R.id.ot_rt_title), leave far less that can go wrong.

   Run:  node scripts/android/gen-widget-layouts.mjs     The results are committed; test/android.mjs checks Kotlin and layouts agree. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const res = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src-tauri', 'android-widgets', 'res');
mkdirSync(join(res, 'raw'), { recursive: true }); mkdirSync(join(res, 'layout'), { recursive: true }); mkdirSync(join(res, 'xml'), { recursive: true }); mkdirSync(join(res, 'drawable'), { recursive: true });
const URI = 'http://schemas.android.com/apk/res/android';
const NS = `xmlns:android="${URI}"`;
const w = (rel, text) => writeFileSync(join(res, rel), text);
const A = o => Object.entries(o).map(([k, v]) => (k.startsWith('xmlns') ? `${k}="${v}"` : `android:${k}="${v}"`)).join(' ');
const el = (tag, attrs, kids = '') => kids ? `<${tag} ${A(attrs)}>\n${kids}</${tag}>\n` : `<${tag} ${A(attrs)} />\n`;
const M = 'match_parent', W = 'wrap_content';
const iv = (id, o = {}) => el('ImageView', { id: '@+id/' + id, layout_width: o.w || W, layout_height: o.h || W, ...o.x, importantForAccessibility: o.desc ? 'yes' : 'no', ...(o.desc ? { contentDescription: o.desc } : {}), ...(o.src ? { src: '@drawable/' + o.src } : {}), ...(o.fit ? { scaleType: 'fitXY' } : {}) });
const tv = (id, o = {}) => el('TextView', { id: '@+id/' + id, layout_width: o.w || W, layout_height: o.h || W, ...(o.weight ? { layout_weight: o.weight } : {}), textSize: (o.size || 13) + 'sp', ...(o.bold ? { textStyle: 'bold' } : {}), singleLine: o.multi ? 'false' : 'true', ...(o.multi ? {} : { ellipsize: 'end' }), ...(o.gravity ? { gravity: o.gravity } : {}), ...(o.x || {}), ...(o.text ? { text: o.text } : {}) });
const lin = (attrs, kids) => el('LinearLayout', { layout_width: M, layout_height: W, ...attrs }, kids);
const frame = (attrs, kids) => el('FrameLayout', { layout_width: M, layout_height: W, ...attrs }, kids);
const doc = body => `<?xml version="1.0" encoding="utf-8"?>\n` + body;

// ---- the shell: card background, a header, the "empty" line, the row container and the "+N more" line ----
// header: a bold title, a muted subtitle that takes the room, optional previous / next arrows and a round accent "+"
const header = (k, o = {}) => lin({ layout_height: '44dp', orientation: 'horizontal', gravity: 'center_vertical', paddingStart: '10dp', paddingEnd: '2dp' },
  tv(k + '_title', { bold: true, size: 16, h: M, gravity: 'center_vertical', text: o.title || '' }) + tv(k + '_sub', { weight: 1, h: M, size: 12, gravity: 'center_vertical', x: { paddingStart: '8dp' } })
  + (o.weekNav ? iv(k + '_pw', { w: '30dp', h: '34dp', x: { padding: '6dp' }, src: 'ot_widget_prev_week', desc: 'Previous week' }) : '')
  + (o.nav ? iv(k + '_prev', { w: o.weekNav ? '30dp' : '34dp', h: '34dp', x: { padding: o.weekNav ? '6dp' : '8dp' }, src: 'ot_widget_prev', desc: o.navPrev || 'Previous month' }) + iv(k + '_next', { w: o.weekNav ? '30dp' : '34dp', h: '34dp', x: { padding: o.weekNav ? '6dp' : '8dp' }, src: 'ot_widget_next', desc: o.navNext || 'Next month' }) : '')
  + (o.weekNav ? iv(k + '_nw', { w: '30dp', h: '34dp', x: { padding: '6dp' }, src: 'ot_widget_next_week', desc: 'Next week' }) : '')
  + (o.add === false ? '' : frame({ layout_width: '40dp', layout_height: '40dp' }, iv(k + '_add', { w: M, h: M, x: { padding: '7dp' }, src: 'ot_widget_circle', desc: o.addDesc || 'Add' }) + iv(k + '_plus', { w: M, h: M, x: { padding: '12dp' }, src: 'ot_widget_plus' }))));
const empty = k => tv(k + '_empty', { w: M, size: 13, gravity: 'center', multi: true, x: { paddingTop: '16dp', visibility: 'gone' } });
const more = k => tv(k + '_more', { w: M, size: 11, x: { paddingStart: '14dp', paddingTop: '2dp', visibility: 'gone' } });
const list = k => lin({ id: '@+id/' + k + '_list', orientation: 'vertical' });
const root = (k, kids) => doc(el('FrameLayout', { 'xmlns:android': URI, id: '@+id/' + k + '_root', layout_width: M, layout_height: M }, iv(k + '_bg', { w: M, h: M, fit: true, src: 'ot_widget_bg' }) + lin({ layout_height: M, orientation: 'vertical', padding: '6dp' }, kids)));
const shell = (k, o = {}) => root(k, header(k, o) + (o.mid || '') + empty(k) + list(k) + more(k) + (o.tail || ''));

// ---- one row: a rounded card (tinted with the theme's card colour) with the row's own views on top ----
const rowDoc = (k, h, inner) => doc(el('FrameLayout', { 'xmlns:android': URI, id: `@+id/${k}_root`, layout_width: M, layout_height: h, layout_marginBottom: '3dp' }, iv(`${k}_bg`, { w: M, h: M, fit: true, src: 'ot_widget_row' }) + inner));
const hz = (attrs, kids) => lin({ layout_height: M, orientation: 'horizontal', gravity: 'center_vertical', paddingStart: '8dp', paddingEnd: '10dp', ...attrs }, kids);
const vt = (attrs, kids) => lin({ layout_width: '0dp', layout_height: W, layout_weight: '1', orientation: 'vertical', ...attrs }, kids);
const badge = (k, size = '34dp') => frame({ layout_width: size, layout_height: size }, iv(`${k}_icon`, { w: M, h: M, src: 'ot_widget_circle' }) + tv(`${k}_emoji`, { w: M, h: M, size: 15, gravity: 'center' }));

// the widget-info files: sizes, refresh period, and the small safe layout shown before the app has filled the widget in
function info(kind, cx, cy, minW, minH, extra = '') { const rw = Math.min(180, minW), rh = Math.min(110, minH); return `<?xml version="1.0" encoding="utf-8"?>\n<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"\n    android:minWidth="${minW}dp"\n    android:minHeight="${minH}dp"\n    android:minResizeWidth="${rw}dp"\n    android:minResizeHeight="${rh}dp"\n    android:targetCellWidth="${cx}"\n    android:targetCellHeight="${cy}"\n    android:updatePeriodMillis="1800000"\n    android:initialLayout="@layout/ot_widget_loading"\n    android:previewLayout="@layout/ot_widget_loading"\n    android:resizeMode="horizontal|vertical"\n    android:widgetCategory="home_screen"${extra}\n    android:description="@string/ot_widget_${kind}_desc" />\n`; }

// tasks: priority ring, title, list dot and name, due time
w('layout/ot_widget_tasks.xml', shell('ot_ts', { title: 'Today', addDesc: 'Add a task' }));
w('layout/ot_widget_row_task.xml', rowDoc('ot_rt', '42dp', hz({ paddingStart: '4dp' },
  iv('ot_rt_check', { w: '36dp', h: '36dp', x: { padding: '8dp' }, src: 'ot_widget_ring', desc: 'Complete task' })
  + tv('ot_rt_title', { w: '0dp', h: M, weight: 1, size: 14, gravity: 'center_vertical' })
  + iv('ot_rt_dot', { w: '8dp', h: '8dp', x: { layout_marginStart: '6dp' }, src: 'ot_widget_dot' })
  + tv('ot_rt_list', { size: 11, x: { layout_marginStart: '4dp', maxWidth: '72dp' } })
  + tv('ot_rt_when', { size: 11, x: { layout_marginStart: '8dp' } }))));
w('xml/ot_widget_tasks_info.xml', info('tasks', 4, 3, 250, 110));

// lists
w('layout/ot_widget_lists.xml', shell('ot_ls', { title: 'Lists', addDesc: 'New task' }));
w('layout/ot_widget_row_list.xml', rowDoc('ot_rl', '38dp', hz({}, iv('ot_rl_dot', { w: '12dp', h: '12dp', src: 'ot_widget_dot' }) + tv('ot_rl_name', { w: '0dp', weight: 1, size: 14, x: { layout_marginStart: '10dp' } }) + tv('ot_rl_late', { size: 11, bold: true, x: { layout_marginEnd: '8dp' } }) + tv('ot_rl_count', { size: 13 }))));
w('xml/ot_widget_lists_info.xml', info('lists', 3, 3, 180, 110));

// projects: name and percentage, a progress bar, and what is open
w('layout/ot_widget_projects.xml', shell('ot_pr', { title: 'Projects', addDesc: 'New task' }));
w('layout/ot_widget_row_project.xml', rowDoc('ot_rp', '62dp', lin({ layout_height: M, orientation: 'vertical', gravity: 'center_vertical', paddingStart: '12dp', paddingEnd: '12dp' },
  lin({ orientation: 'horizontal', gravity: 'center_vertical' }, tv('ot_rp_name', { w: '0dp', weight: 1, size: 14, bold: true }) + tv('ot_rp_pct', { size: 13, bold: true }))
  + iv('ot_rp_bar', { w: M, h: '8dp', x: { layout_marginTop: '5dp', layout_marginBottom: '4dp' }, fit: true }) + tv('ot_rp_meta', { w: M, size: 11 }))));
w('xml/ot_widget_projects_info.xml', info('projects', 4, 3, 250, 180));

// notes
w('layout/ot_widget_notes.xml', shell('ot_nt', { title: 'Notes', addDesc: 'New note' }));
w('layout/ot_widget_row_note.xml', rowDoc('ot_rn', '56dp', lin({ layout_height: M, orientation: 'vertical', gravity: 'center_vertical', paddingStart: '12dp', paddingEnd: '12dp' }, tv('ot_rn_title', { w: M, size: 14, bold: true }) + tv('ot_rn_snip', { w: M, size: 12 }))));
w('xml/ot_widget_notes_info.xml', info('notes', 3, 3, 180, 110));

// calendar: the shell has the weekday names; each week is one small layout of seven day cells (a month needs four to six of them)
w('layout/ot_widget_calendar.xml', shell('ot_cal', { title: '', nav: true, addDesc: 'New task',
  mid: lin({ orientation: 'horizontal' }, Array.from({ length: 7 }, (_, i) => tv(`ot_cal_w${i}`, { w: '0dp', weight: 1, size: 10, gravity: 'center' })).join('')),
  tail: tv('ot_cal_info', { w: M, size: 12, x: { paddingStart: '10dp', paddingTop: '4dp' } }) }).replace(/(<TextView android:id="@\+id\/ot_cal_empty"[^>]*\/>\n)([\s\S]*?)(<LinearLayout android:id="@\+id\/ot_cal_list")/, '$1$3'));
w('layout/ot_widget_calweek.xml', doc(el('LinearLayout', { 'xmlns:android': URI, layout_width: M, layout_height: '30dp', orientation: 'horizontal' },
  Array.from({ length: 7 }, (_, n) => frame({ layout_width: '0dp', layout_height: M, layout_weight: '1' }, iv(`ot_cw_c${n}`, { w: M, h: M, x: { padding: '2dp' }, src: 'ot_widget_circle' }) + tv(`ot_cw_d${n}`, { w: M, h: M, size: 13, gravity: 'center' }) + iv(`ot_cw_k${n}`, { w: '4dp', h: '4dp', x: { layout_gravity: 'bottom|center_horizontal', layout_marginBottom: '2dp' }, src: 'ot_widget_dot' }))).join(''))));
w('xml/ot_widget_calendar_info.xml', info('calendar', 4, 4, 250, 250));

// timetable: start and end time, a coloured bar, the name, and the room and teacher each on a line of their own (always visible, never hidden by a marquee)
w('layout/ot_widget_timetable.xml', shell('ot_tt', { title: 'Timetable', nav: true, weekNav: true, add: false, navPrev: 'Previous day', navNext: 'Next day' }));
w('layout/ot_widget_row_tt.xml', rowDoc('ot_rx', '58dp', hz({}, tv('ot_rx_time', { w: '46dp', size: 11, multi: true, x: { lines: '2', gravity: 'end', layout_marginEnd: '6dp' } }) + iv('ot_rx_bar', { w: '4dp', h: '40dp', src: 'ot_widget_bar' })
  + vt({ paddingStart: '10dp' }, tv('ot_rx_name', { w: M, size: 14, bold: true }) + tv('ot_rx_room', { w: M, size: 11 }) + tv('ot_rx_who', { w: M, size: 11 })))));
w('xml/ot_widget_timetable_info.xml', info('timetable', 4, 3, 250, 180));

// matrix: the four boxes are part of the layout (always four, three lines each)
const quad = i => frame({ id: `@+id/ot_mx_q${i}`, layout_width: '0dp', layout_height: M, layout_weight: '1', layout_margin: '3dp' },
  iv(`ot_mx_b${i}`, { w: M, h: M, fit: true, src: 'ot_widget_row' }) + iv(`ot_mx_h${i}`, { w: M, h: '4dp', fit: true, src: 'ot_widget_row', x: { layout_gravity: 'top' } })
  + lin({ layout_height: M, orientation: 'vertical', padding: '9dp', paddingTop: '10dp' }, tv(`ot_mx_n${i}`, { w: M, size: 12, bold: true }) + tv(`ot_mx_c${i}`, { w: M, size: 10, x: { paddingBottom: '3dp' } }) + [0, 1, 2].map(j => tv(`ot_mx_t${i}_${j}`, { w: M, size: 12, x: { paddingTop: '2dp' } })).join('')));
w('layout/ot_widget_matrix.xml', root('ot_mx', header('ot_mx', { title: 'Matrix', addDesc: 'New task' }) + lin({ layout_height: '0dp', layout_weight: '1', orientation: 'horizontal' }, quad(0) + quad(1)) + lin({ layout_height: '0dp', layout_weight: '1', orientation: 'horizontal' }, quad(2) + quad(3))));
w('xml/ot_widget_matrix_info.xml', info('matrix', 4, 4, 250, 250));

// habits
w('layout/ot_widget_habits.xml', shell('ot_hb', { title: 'Habit', add: false }));
w('layout/ot_widget_row_habit.xml', rowDoc('ot_rh', '46dp', hz({}, badge('ot_rh') + vt({ paddingStart: '10dp' }, tv('ot_rh_name', { w: M, size: 14, bold: true }) + tv('ot_rh_streak', { w: M, size: 11 })) + iv('ot_rh_check', { w: '36dp', h: '36dp', x: { padding: '4dp' }, src: 'ot_widget_check_off', desc: 'Check in' }))));
w('xml/ot_widget_habits_info.xml', info('habits', 3, 3, 180, 180));

// countdowns
w('layout/ot_widget_countdowns.xml', shell('ot_cd', { title: 'Countdowns', add: false }));
w('layout/ot_widget_row_cd.xml', rowDoc('ot_rc', '50dp', hz({}, badge('ot_rc') + vt({ paddingStart: '10dp' }, tv('ot_rc_name', { w: M, size: 14, bold: true })) + lin({ layout_width: W, layout_height: W, orientation: 'vertical', gravity: 'end', paddingEnd: '6dp' }, tv('ot_rc_value', { w: W, size: 18, bold: true }) + tv('ot_rc_unit', { w: W, size: 10 })))));
w('xml/ot_widget_countdowns_info.xml', info('countdowns', 3, 3, 180, 180));

// focus: a ring, the time (a Chronometer counts down on its own while a session runs) and one button
w('layout/ot_widget_focus.xml', root('ot_fc', header('ot_fc', { title: 'Focus', add: false })
  + frame({ layout_height: '0dp', layout_weight: '1' }, iv('ot_fc_ring', { w: M, h: M, x: { padding: '6dp' } }) + el('Chronometer', { id: '@+id/ot_fc_time', layout_width: M, layout_height: M, gravity: 'center', textSize: '28sp', textStyle: 'bold', visibility: 'gone' }) + tv('ot_fc_text', { w: M, h: M, size: 28, bold: true, gravity: 'center' }))
  + frame({ id: '@+id/ot_fc_btnf', layout_height: '40dp', layout_margin: '4dp' }, iv('ot_fc_btnbg', { w: M, h: M, fit: true, src: 'ot_widget_row' }) + tv('ot_fc_btn', { w: M, h: M, size: 14, bold: true, gravity: 'center' }))));
w('xml/ot_widget_focus_info.xml', info('focus', 2, 3, 130, 180));

// What a widget shows before the app has filled it in, and when filling it in failed: one small layout that cannot go wrong (a plain card and a
// line of text), so a home screen never has to build a big layout just to show "loading". The text is set from Kotlin; the colours here are the
// default theme so it looks right even if nothing could be read.
w('layout/ot_widget_loading.xml', doc(el('FrameLayout', { 'xmlns:android': URI, id: '@+id/ot_ld_root', layout_width: M, layout_height: M },
  iv('ot_ld_bg', { w: M, h: M, fit: true, src: 'ot_widget_bg_loading' }) + tv('ot_ld_text', { w: M, h: M, size: 13, gravity: 'center', multi: true, x: { padding: '12dp', textColor: '#FFEBDBB2', text: 'OpenTick' } }))));
w('drawable/ot_widget_bg_loading.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="rectangle">\n    <solid android:color="#FF282828" />\n    <corners android:radius="22dp" />\n</shape>\n`);
// keeps every widget view, layout and drawable by name when a release build shrinks or renames resources
w('raw/ot_widget_keep.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources xmlns:tools="http://schemas.android.com/tools"\n    tools:keep="@layout/ot_widget_*,@id/ot_*,@drawable/ot_widget_*,@drawable/ic_stat_opentick,@xml/ot_widget_*,@string/ot_widget_*"\n    tools:shrinkMode="safe" />\n`);

// drawables used above
w('drawable/ot_widget_bg.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="rectangle">\n    <solid android:color="#FFFFFFFF" />\n    <corners android:radius="22dp" />\n</shape>\n`);
w('drawable/ot_widget_bg_small.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="rectangle">\n    <solid android:color="#FFFFFFFF" />\n    <corners android:radius="20dp" />\n</shape>\n`);
w('drawable/ot_widget_row.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="rectangle">\n    <solid android:color="#FFFFFFFF" />\n    <corners android:radius="12dp" />\n</shape>\n`);
w('drawable/ot_widget_circle.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="oval">\n    <solid android:color="#FFFFFFFF" />\n</shape>\n`);
w('drawable/ot_widget_dot.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="oval">\n    <size android:width="8dp" android:height="8dp" />\n    <solid android:color="#FFFFFFFF" />\n</shape>\n`);
w('drawable/ot_widget_bar.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="rectangle">\n    <solid android:color="#FFFFFFFF" />\n    <corners android:radius="2dp" />\n</shape>\n`);
const vec = d => `<?xml version="1.0" encoding="utf-8"?>\n<vector ${NS}\n    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n    <path android:fillColor="#FFFFFFFF" android:pathData="${d}" />\n</vector>\n`;
w('drawable/ot_widget_prev.xml', vec('M15.41,7.41L14,6l-6,6 6,6 1.41,-1.41L10.83,12z'));
w('drawable/ot_widget_next.xml', vec('M8.59,16.59L13.17,12 8.59,7.41 10,6l6,6 -6,6z'));
w('drawable/ot_widget_prev_week.xml', vec('M18.41,7.41L17,6l-6,6 6,6 1.41,-1.41L13.83,12zM12.41,7.41L11,6l-6,6 6,6 1.41,-1.41L6.83,12z'));
w('drawable/ot_widget_next_week.xml', vec('M5.59,16.59L10.17,12 5.59,7.41 7,6l6,6 -6,6zM11.59,16.59L16.17,12 11.59,7.41 13,6l6,6 -6,6z'));
w('drawable/ot_widget_plus.xml', vec('M11,4h2v7h7v2h-7v7h-2v-7H4v-2h7z'));
w('drawable/ot_widget_check_off.xml', `<?xml version="1.0" encoding="utf-8"?>\n<vector ${NS}\n    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n    <path android:strokeColor="#FFFFFFFF" android:strokeWidth="2" android:pathData="M12,4a8,8 0 1,0 0.001,0z" />\n</vector>\n`);
w('drawable/ot_widget_check_on.xml', `<?xml version="1.0" encoding="utf-8"?>\n<vector ${NS}\n    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n    <path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="M12,3a9,9 0 1,0 0.001,0zM10.2,15.6l-3.4,-3.4 1.2,-1.2 2.2,2.2 5.8,-5.8 1.2,1.2z" />\n</vector>\n`);
w('drawable/ot_widget_ring.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="oval">\n    <size android:width="20dp" android:height="20dp" />\n    <stroke android:width="2dp" android:color="#FFFFFFFF" />\n</shape>\n`);

// strings
const kinds = [['tasks', 'Today', 'Today\\\'s and overdue tasks. Tick one to complete it.'], ['quick', 'Add a task', 'A quick "Add a task" bar.'], ['lists', 'Lists', 'Your lists and what is open in each.'], ['projects', 'Projects', 'Progress of each project.'], ['notes', 'Notes', 'Pinned and recent notes.'], ['calendar', 'Calendar', 'A month with the days that have tasks.'], ['timetable', 'Timetable', 'Classes, slots and timed tasks with end times. Arrows step a day, double arrows a week; tap the title for today.'], ['matrix', 'Matrix', 'The four boxes of the Eisenhower matrix.'], ['habits', 'Habit', 'Check in today\\\'s habits.'], ['countdowns', 'Countdowns', 'Days and hours left to what you count down to.'], ['focus', 'Focus', 'Your focus timer and today\\\'s minutes.']];
w('values/ot_widget_strings.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${kinds.map(([k, n, d]) => `    <string name="ot_widget_${k}_label">OpenTick · ${n.replace(/"/g, '\\"')}</string>\n    <string name="ot_widget_${k}_desc">${d.replace(/"/g, '\\"')}</string>`).join('\n')}\n</resources>\n`);
console.log('widget layouts written to', res);
