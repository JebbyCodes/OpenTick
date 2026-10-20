#!/usr/bin/env node
/* Writes the Android widget layouts, widget-info files and strings (src-tauri/android-widgets/res) for every OpenTick widget.
   The layouts are long and repetitive (a RemoteViews widget cannot have a list built at run time without an adapter service, so each
   row exists once in the layout and the Kotlin code shows, hides and fills them), so they are generated rather than typed.
   Run:  node scripts/gen-widget-layouts.mjs     The results are committed; test/android.mjs checks Kotlin and layouts agree. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const res = join(dirname(fileURLToPath(import.meta.url)), '..', 'src-tauri', 'android-widgets', 'res');
mkdirSync(join(res, 'layout'), { recursive: true }); mkdirSync(join(res, 'xml'), { recursive: true }); mkdirSync(join(res, 'drawable'), { recursive: true });
const NS = 'xmlns:android="http://schemas.android.com/apk/res/android"';
const w = (rel, text) => writeFileSync(join(res, rel), text);
const A = o => Object.entries(o).map(([k, v]) => (k.startsWith('xmlns') ? `${k}="${v}"` : `android:${k}="${v}"`)).join(' ');
const el = (tag, attrs, kids = '') => kids ? `<${tag} ${A(attrs)}>\n${kids}</${tag}>\n` : `<${tag} ${A(attrs)} />\n`;
const M = 'match_parent', W = 'wrap_content';
const iv = (id, o = {}) => el('ImageView', { id: '@+id/' + id, layout_width: o.w || W, layout_height: o.h || W, ...o.x, importantForAccessibility: o.desc ? 'yes' : 'no', ...(o.desc ? { contentDescription: o.desc } : {}), ...(o.src ? { src: '@drawable/' + o.src } : {}), ...(o.fit ? { scaleType: 'fitXY' } : {}) });
const tv = (id, o = {}) => el('TextView', { id: '@+id/' + id, layout_width: o.w || W, layout_height: o.h || W, ...(o.weight ? { layout_weight: o.weight } : {}), textSize: (o.size || 13) + 'sp', ...(o.bold ? { textStyle: 'bold' } : {}), singleLine: o.multi ? 'false' : 'true', ...(o.multi ? {} : { ellipsize: 'end' }), ...(o.gravity ? { gravity: o.gravity } : {}), ...(o.x || {}), ...(o.text ? { text: o.text } : {}) });
const lin = (attrs, kids) => el('LinearLayout', { layout_width: M, layout_height: W, ...attrs }, kids);
const frame = (attrs, kids) => el('FrameLayout', { layout_width: M, layout_height: W, ...attrs }, kids);
const root = (id, kids) => `<?xml version="1.0" encoding="utf-8"?>\n` + el('FrameLayout', { ...Object.fromEntries([['xmlns:android', 'http://schemas.android.com/apk/res/android']]), id: '@+id/' + id + '_root', layout_width: M, layout_height: M }, iv(id + '_bg', { w: M, h: M, fit: true, src: 'ot_widget_bg' }) + lin({ layout_height: M, orientation: 'vertical', padding: '6dp' }, kids));
// header: a bold title, a muted subtitle that takes the room, optional previous / next arrows and a round accent "+"
const header = (k, o = {}) => lin({ layout_height: '44dp', orientation: 'horizontal', gravity: 'center_vertical', paddingStart: '10dp', paddingEnd: '2dp' },
  tv(k + '_title', { bold: true, size: 16, h: M, gravity: 'center_vertical', text: o.title || '' }) + tv(k + '_sub', { weight: 1, h: M, size: 12, gravity: 'center_vertical', x: { paddingStart: '8dp' } })
  + (o.nav ? iv(k + '_prev', { w: '34dp', h: '34dp', x: { padding: '8dp' }, src: 'ot_widget_prev', desc: 'Previous month' }) + iv(k + '_next', { w: '34dp', h: '34dp', x: { padding: '8dp' }, src: 'ot_widget_next', desc: 'Next month' }) : '')
  + (o.add === false ? '' : frame({ layout_width: '40dp', layout_height: '40dp', id: '@+id/' + k + '_addf', clickable: 'false' }, iv(k + '_add', { w: M, h: M, x: { padding: '7dp' }, src: 'ot_widget_circle', desc: o.addDesc || 'Add' }) + iv(k + '_plus', { w: M, h: M, x: { padding: '12dp' }, src: 'ot_widget_plus' }))));
const empty = k => tv(k + '_empty', { w: M, size: 13, gravity: 'center', multi: true, x: { paddingTop: '16dp', visibility: 'gone' } });
const more = k => tv(k + '_more', { w: M, size: 11, x: { paddingStart: '14dp', paddingTop: '2dp', visibility: 'gone' } });
const row = (k, n, h, inner) => frame({ id: `@+id/${k}_r${n}`, layout_height: h, layout_marginBottom: '3dp', visibility: 'gone' }, iv(`${k}_b${n}`, { w: M, h: M, fit: true, src: 'ot_widget_row' }) + inner);
const rows = (k, count, h, inner) => Array.from({ length: count }, (_, n) => row(k, n, h, inner(n))).join('');
const hz = (attrs, kids) => lin({ layout_height: M, orientation: 'horizontal', gravity: 'center_vertical', paddingStart: '8dp', paddingEnd: '10dp', ...attrs }, kids);
const vt = (attrs, kids) => lin({ layout_width: '0dp', layout_height: W, layout_weight: '1', orientation: 'vertical', ...attrs }, kids);

// tasks (ids kept from the first widget: ot_r0, ot_c0, ot_t0, ot_d0, ot_title, ot_count, ot_add, ot_empty, ot_more, ot_bg)
const N_TASKS = 10;
const tHead = lin({ layout_height: '44dp', orientation: 'horizontal', gravity: 'center_vertical', paddingStart: '10dp', paddingEnd: '2dp' },
  tv('ot_title', { bold: true, size: 16, h: M, gravity: 'center_vertical', text: 'Today' }) + tv('ot_count', { weight: 1, h: M, size: 12, gravity: 'center_vertical', x: { paddingStart: '8dp' } })
  + frame({ layout_width: '40dp', layout_height: '40dp' }, iv('ot_add', { w: M, h: M, x: { padding: '7dp' }, src: 'ot_widget_circle', desc: 'Add a task' }) + iv('ot_addp', { w: M, h: M, x: { padding: '12dp' }, src: 'ot_widget_plus' })));
const tRows = Array.from({ length: N_TASKS }, (_, n) => frame({ id: `@+id/ot_r${n}`, layout_height: '42dp', layout_marginBottom: '3dp', visibility: 'gone' },
  iv(`ot_rb${n}`, { w: M, h: M, fit: true, src: 'ot_widget_row' })
  + hz({ paddingStart: '4dp' }, iv(`ot_c${n}`, { w: '36dp', h: '36dp', x: { padding: '8dp' }, src: 'ot_widget_ring', desc: 'Complete task' })
    + tv(`ot_t${n}`, { w: '0dp', h: M, weight: 1, size: 14, gravity: 'center_vertical' })
    + iv(`ot_k${n}`, { w: '8dp', h: '8dp', x: { layout_marginStart: '6dp' }, src: 'ot_widget_dot' })
    + tv(`ot_l${n}`, { size: 11, x: { layout_marginStart: '4dp', maxWidth: '72dp' } })
    + tv(`ot_d${n}`, { size: 11, x: { layout_marginStart: '8dp' } })))).join('');
const tBody = lin({ layout_height: M, orientation: 'vertical', padding: '6dp' }, tHead + tv('ot_empty', { w: M, size: 13, gravity: 'center', multi: true, x: { paddingTop: '16dp', visibility: 'gone' } }) + tRows + more('ot'));
w('layout/ot_widget_tasks.xml', `<?xml version="1.0" encoding="utf-8"?>\n` + el('FrameLayout', { 'xmlns:android': 'http://schemas.android.com/apk/res/android', layout_width: M, layout_height: M }, iv('ot_bg', { w: M, h: M, fit: true, src: 'ot_widget_bg' }) + tBody));
w('xml/ot_widget_tasks_info.xml', info('tasks', 4, 3, 250, 110));

function info(kind, cx, cy, minW, minH, extra = '') { return `<?xml version="1.0" encoding="utf-8"?>\n<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"\n    android:minWidth="${minW}dp"\n    android:minHeight="${minH}dp"\n    android:minResizeWidth="180dp"\n    android:minResizeHeight="110dp"\n    android:targetCellWidth="${cx}"\n    android:targetCellHeight="${cy}"\n    android:updatePeriodMillis="1800000"\n    android:initialLayout="@layout/ot_widget_${kind}"\n    android:resizeMode="horizontal|vertical"\n    android:widgetCategory="home_screen"${extra}\n    android:description="@string/ot_widget_${kind}_desc" />\n`; }

// lists
w('layout/ot_widget_lists.xml', root('ot_ls', header('ot_ls', { title: 'Lists', addDesc: 'New task' }) + empty('ot_ls') + rows('ot_ls', 9, '38dp', n => hz({}, iv(`ot_ls_k${n}`, { w: '12dp', h: '12dp', src: 'ot_widget_dot' }) + tv(`ot_ls_n${n}`, { w: '0dp', weight: 1, size: 14, x: { layout_marginStart: '10dp' } }) + tv(`ot_ls_l${n}`, { size: 11, bold: true, x: { layout_marginEnd: '8dp' } }) + tv(`ot_ls_c${n}`, { size: 13 }))) + more('ot_ls')));
w('xml/ot_widget_lists_info.xml', info('lists', 3, 3, 180, 110));
// projects
w('layout/ot_widget_projects.xml', root('ot_pr', header('ot_pr', { title: 'Projects', addDesc: 'New task' }) + empty('ot_pr') + rows('ot_pr', 5, '62dp', n => vt({ layout_height: M, gravity: 'center_vertical', paddingStart: '12dp', paddingEnd: '12dp', layout_width: M, layout_weight: '0' },
  lin({ orientation: 'horizontal', gravity: 'center_vertical' }, tv(`ot_pr_n${n}`, { w: '0dp', weight: 1, size: 14, bold: true }) + tv(`ot_pr_p${n}`, { size: 13, bold: true }))
  + iv(`ot_pr_g${n}`, { w: M, h: '8dp', x: { layout_marginTop: '5dp', layout_marginBottom: '4dp' }, fit: true }) + tv(`ot_pr_m${n}`, { w: M, size: 11 }))) + more('ot_pr')));
w('xml/ot_widget_projects_info.xml', info('projects', 4, 3, 250, 180));
// notes
w('layout/ot_widget_notes.xml', root('ot_nt', header('ot_nt', { title: 'Notes', addDesc: 'New note' }) + empty('ot_nt') + rows('ot_nt', 6, '56dp', n => vt({ layout_height: M, gravity: 'center_vertical', paddingStart: '12dp', paddingEnd: '12dp', layout_width: M, layout_weight: '0' }, tv(`ot_nt_t${n}`, { w: M, size: 14, bold: true }) + tv(`ot_nt_s${n}`, { w: M, size: 12 }))) + more('ot_nt')));
w('xml/ot_widget_notes_info.xml', info('notes', 3, 3, 180, 110));
// calendar
const cell = n => frame({ id: `@+id/ot_cal_f${n}`, layout_width: '0dp', layout_height: '34dp', layout_weight: '1' }, iv(`ot_cal_c${n}`, { w: M, h: M, x: { padding: '2dp' }, src: 'ot_widget_circle' }) + tv(`ot_cal_d${n}`, { w: M, h: M, size: 13, gravity: 'center' }) + iv(`ot_cal_k${n}`, { w: '4dp', h: '4dp', x: { layout_gravity: 'bottom|center_horizontal', layout_marginBottom: '3dp' }, src: 'ot_widget_dot' }));
w('layout/ot_widget_calendar.xml', root('ot_cal', header('ot_cal', { title: '', nav: true, addDesc: 'New task' })
  + lin({ orientation: 'horizontal' }, Array.from({ length: 7 }, (_, i) => tv(`ot_cal_w${i}`, { w: '0dp', weight: 1, size: 10, gravity: 'center' })).join(''))
  + Array.from({ length: 6 }, (_, r) => lin({ orientation: 'horizontal' }, Array.from({ length: 7 }, (_, c) => cell(r * 7 + c)).join(''))).join('')
  + tv('ot_cal_info', { w: M, size: 12, x: { paddingStart: '10dp', paddingTop: '4dp' } })));
w('xml/ot_widget_calendar_info.xml', info('calendar', 4, 4, 250, 250));
// timetable
w('layout/ot_widget_timetable.xml', root('ot_tt', header('ot_tt', { title: 'Timetable', addDesc: 'Open the timetable' }) + empty('ot_tt') + rows('ot_tt', 8, '44dp', n => hz({}, tv(`ot_tt_t${n}`, { w: '44dp', size: 11 }) + iv(`ot_tt_k${n}`, { w: '4dp', h: '28dp', src: 'ot_widget_bar' }) + vt({ paddingStart: '10dp' }, tv(`ot_tt_n${n}`, { w: M, size: 14, bold: true }) + tv(`ot_tt_s${n}`, { w: M, size: 11 })))) + more('ot_tt')));
w('xml/ot_widget_timetable_info.xml', info('timetable', 4, 3, 250, 180));
// matrix
const quad = i => frame({ id: `@+id/ot_mx_q${i}`, layout_width: '0dp', layout_height: M, layout_weight: '1', layout_margin: '3dp' },
  iv(`ot_mx_b${i}`, { w: M, h: M, fit: true, src: 'ot_widget_row' }) + iv(`ot_mx_h${i}`, { w: M, h: '4dp', fit: true, src: 'ot_widget_row', x: { layout_gravity: 'top' } })
  + lin({ layout_height: M, orientation: 'vertical', padding: '9dp', paddingTop: '10dp' }, tv(`ot_mx_n${i}`, { w: M, size: 12, bold: true }) + tv(`ot_mx_c${i}`, { w: M, size: 10, x: { paddingBottom: '3dp' } }) + [0, 1, 2].map(j => tv(`ot_mx_t${i}_${j}`, { w: M, size: 12, x: { paddingTop: '2dp' } })).join('')));
w('layout/ot_widget_matrix.xml', root('ot_mx', header('ot_mx', { title: 'Matrix', addDesc: 'New task' }) + lin({ layout_height: '0dp', layout_weight: '1', orientation: 'horizontal' }, quad(0) + quad(1)) + lin({ layout_height: '0dp', layout_weight: '1', orientation: 'horizontal' }, quad(2) + quad(3))));
w('xml/ot_widget_matrix_info.xml', info('matrix', 4, 4, 250, 250));
// habits
w('layout/ot_widget_habits.xml', root('ot_hb', header('ot_hb', { title: 'Habit', add: false }) + empty('ot_hb') + rows('ot_hb', 7, '46dp', n => hz({}, frame({ layout_width: '34dp', layout_height: '34dp' }, iv(`ot_hb_i${n}`, { w: M, h: M, src: 'ot_widget_circle' }) + tv(`ot_hb_e${n}`, { w: M, h: M, size: 15, gravity: 'center' })) + vt({ paddingStart: '10dp' }, tv(`ot_hb_n${n}`, { w: M, size: 14, bold: true }) + tv(`ot_hb_s${n}`, { w: M, size: 11 })) + iv(`ot_hb_c${n}`, { w: '36dp', h: '36dp', x: { padding: '4dp' }, src: 'ot_widget_check_off', desc: 'Check in' }))) + more('ot_hb')));
w('xml/ot_widget_habits_info.xml', info('habits', 3, 3, 180, 180));
// focus
w('layout/ot_widget_focus.xml', root('ot_fc', header('ot_fc', { title: 'Focus', add: false })
  + frame({ layout_height: '0dp', layout_weight: '1' }, iv('ot_fc_ring', { w: M, h: M, x: { padding: '6dp' } }) + el('Chronometer', { id: '@+id/ot_fc_time', layout_width: M, layout_height: M, gravity: 'center', textSize: '28sp', textStyle: 'bold', visibility: 'gone' }) + tv('ot_fc_text', { w: M, h: M, size: 28, bold: true, gravity: 'center' }))
  + frame({ id: '@+id/ot_fc_btnf', layout_height: '40dp', layout_margin: '4dp' }, iv('ot_fc_btnbg', { w: M, h: M, fit: true, src: 'ot_widget_row' }) + tv('ot_fc_btn', { w: M, h: M, size: 14, bold: true, gravity: 'center' }))));
w('xml/ot_widget_focus_info.xml', info('focus', 2, 3, 130, 180));

// the quick-add bar keeps its own small layout; drawables used above
w('drawable/ot_widget_row.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="rectangle">\n    <solid android:color="#FFFFFFFF" />\n    <corners android:radius="12dp" />\n</shape>\n`);
w('drawable/ot_widget_circle.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="oval">\n    <solid android:color="#FFFFFFFF" />\n</shape>\n`);
w('drawable/ot_widget_dot.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="oval">\n    <size android:width="8dp" android:height="8dp" />\n    <solid android:color="#FFFFFFFF" />\n</shape>\n`);
w('drawable/ot_widget_bar.xml', `<?xml version="1.0" encoding="utf-8"?>\n<shape ${NS} android:shape="rectangle">\n    <solid android:color="#FFFFFFFF" />\n    <corners android:radius="2dp" />\n</shape>\n`);
const vec = d => `<?xml version="1.0" encoding="utf-8"?>\n<vector ${NS}\n    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n    <path android:fillColor="#FFFFFFFF" android:pathData="${d}" />\n</vector>\n`;
w('drawable/ot_widget_prev.xml', vec('M15.41,7.41L14,6l-6,6 6,6 1.41,-1.41L10.83,12z'));
w('drawable/ot_widget_next.xml', vec('M8.59,16.59L13.17,12 8.59,7.41 10,6l6,6 -6,6z'));
w('drawable/ot_widget_check_off.xml', `<?xml version="1.0" encoding="utf-8"?>\n<vector ${NS}\n    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n    <path android:strokeColor="#FFFFFFFF" android:strokeWidth="2" android:pathData="M12,4a8,8 0 1,0 0.001,0z" />\n</vector>\n`);
w('drawable/ot_widget_check_on.xml', `<?xml version="1.0" encoding="utf-8"?>\n<vector ${NS}\n    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n    <path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="M12,3a9,9 0 1,0 0.001,0zM10.2,15.6l-3.4,-3.4 1.2,-1.2 2.2,2.2 5.8,-5.8 1.2,1.2z" />\n</vector>\n`);

// strings
const kinds = [['tasks', 'Today', 'Today\\\'s and overdue tasks. Tick one to complete it.'], ['quick', 'Add a task', 'A quick "Add a task" bar.'], ['lists', 'Lists', 'Your lists and what is open in each.'], ['projects', 'Projects', 'Progress of each project.'], ['notes', 'Notes', 'Pinned and recent notes.'], ['calendar', 'Calendar', 'A month with the days that have tasks.'], ['timetable', 'Timetable', 'Today\\\'s timetable, or your school day.'], ['matrix', 'Matrix', 'The four boxes of the Eisenhower matrix.'], ['habits', 'Habit', 'Check in today\\\'s habits.'], ['focus', 'Focus', 'Your focus timer and today\\\'s minutes.']];
w('values/ot_widget_strings.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${kinds.map(([k, n, d]) => `    <string name="ot_widget_${k}_label">OpenTick · ${n.replace(/"/g, '\\"')}</string>\n    <string name="ot_widget_${k}_desc">${d.replace(/"/g, '\\"')}</string>`).join('\n')}\n</resources>\n`);
console.log('widget layouts written to', res);
