"""0.9.0: the task panel (where a task is created and edited) fits every phone width, and its rows line up.
Failures this guards against: a control wider than the screen (the reminder picker was cut off on the right), rows that sit at
different indents (duration and reminders had picked up the page header's padding), blocks with different frames.
Also audits the dialogs that create things (timetable, repeat, weekly slot, task reference)."""
from lib import *

AUDIT = """(root) => { const vw = document.documentElement.clientWidth, out = [];
  const R = document.querySelector(root); if (!R) return ['missing ' + root];
  const rr = R.getBoundingClientRect(), lim = Math.min(vw, rr.right) + 1;
  for (const e of R.querySelectorAll('*')) {
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || s.display === 'none' || s.visibility === 'hidden' || e.closest('[hidden]') || e.closest('svg')) continue;
    if (r.right > lim || r.left < -1) out.push(`${e.tagName}.${String(e.className || '').slice(0, 24)}[${e.dataset.f || e.dataset.act || e.id || ''}] ${Math.round(r.left)}..${Math.round(r.right)} (screen ${vw})`);
  }
  if (document.documentElement.scrollWidth > vw + 1) out.push('the page scrolls sideways: ' + document.documentElement.scrollWidth + ' > ' + vw);
  for (const sc of [R, ...R.querySelectorAll('.dbody, .mbox')]) if (sc.scrollWidth > sc.clientWidth + 1) out.push(`${sc.className || sc.tagName} is ${sc.scrollWidth}px wide in a ${sc.clientWidth}px box`);
  return out; }"""

FIX = """(() => { const td = todayStr();
  S.slots = [{ id: 'sl1', title: 'Quarterly planning workshop with the whole leadership team', days: [1, 3], start: '09:00', end: '10:30', color: '#4772fa' }];
  const rich = newTask({ title: 'Prepare the quarterly report for the whole team meeting', due: td, time: '09:30', dur: 90, priority: 2, tags: ['work', 'quarterly', 'finance', 'a-rather-long-tag-name'], repeat: { every: 2, unit: 'week', days: [1, 3] }, until: ymd(addDays(new Date(), 90)), rems: [0, 30, ymd(addDays(new Date(), 30)) + 'T09:00'], notes: 'some notes', slotId: 'sl1' });
  rich.subtasks = [{ id: 'a', title: 'A subtask with a fairly long title that has to wrap somewhere sensible', done: false, start: td, due: td }, { id: 'b', title: 'done one', done: true }]; rich.exc = {}; rich.exc[ymd(addDays(new Date(), 2))] = { time: '10:30' };
  const bare = newTask({ title: 'Just a title' }), dated = newTask({ title: 'Dated', due: td }), gone = newTask({ title: 'In the trash', deleted: Date.now() });
  S.tasks.push(rich, bare, dated, gone); return [rich.id, bare.id, dated.id, gone.id]; })()"""

# every row's icon sits in one column and its control in the next, whatever the row holds
ALIGN = """() => { const rows = [...document.querySelectorAll('#detail .dbody > .dr')].filter(r => !r.classList.contains('sub') && r.getBoundingClientRect().height > 0);
  const out = []; let ic = null, ct = null;
  for (const r of rows) { const svg = r.querySelector(':scope > span svg'); if (!svg) continue; const c = r.querySelector(':scope > input, :scope > select, :scope > .pri, :scope > .remf, :scope > .durf, :scope > .btn');
    const a = Math.round(svg.getBoundingClientRect().left), b = c ? Math.round(c.getBoundingClientRect().left) : a + 28; ic = ic == null ? a : ic; ct = ct == null ? b : ct;
    if (Math.abs(a - ic) > 1 || Math.abs(b - ct) > 1) out.push(`${r.className}: icon ${a} (want ${ic}), control ${b} (want ${ct})`); }
  return out; }"""

bad = []
with sync_playwright() as p:
    for w, h, mob in ((320, 640, True), (360, 740, True), (390, 780, True), (412, 915, True), (1280, 900, False)):
        b, ctx, pg = launch(p, mobile=mob, w=w, h=h); ids = pg.evaluate(FIX)
        for name, tid in zip(('rich', 'bare', 'dated', 'trashed'), ids):
            pg.evaluate(f"U.sel='{tid}'; render()"); pg.wait_for_timeout(250)
            for m in pg.evaluate(AUDIT, '#detail'): bad.append(f'{w}px {name} task: {m}')
            if name in ('rich', 'bare', 'dated'):
                for m in pg.evaluate(ALIGN): bad.append(f'{w}px {name} task rows: {m}')
        # open the two reminder forms: they are the widest things in the panel
        pg.evaluate(f"U.sel='{ids[0]}'; render()"); pg.wait_for_timeout(200)
        for choice in ('custom', 'abs'):
            pg.select_option('#detail .rsel', choice); pg.wait_for_timeout(120)
            for m in pg.evaluate(AUDIT, '#detail'): bad.append(f'{w}px reminder form ({choice}): {m}')
            vis = pg.evaluate("[...document.querySelectorAll('#detail .remc, #detail .rema')].filter(e => !e.hidden).length"); assert vis == 1, (choice, vis)
        # the blocks under the rows share one frame
        fr = pg.evaluate("""() => ['.notes', '.lnks:not(.pe-people):not(.subs)', '.pe-people', '.fsec', '.subs'].map(s => { const e = document.querySelector('#detail ' + s); if (!e) return [s, 'missing']; const c = getComputedStyle(e); return [s, c.borderTopStyle, c.borderTopLeftRadius]; })""")
        miss = [f for f in fr if f[1] == 'missing']; assert not miss, miss
        styles = {(f[1], f[2]) for f in fr};
        if len(styles) != 1: bad.append(f'{w}px blocks have different frames: {fr}')
        # dialogs that create things
        if mob:
            for label, js in (('add to timetable', "openTTCreate({})"), ('repeat', f"repeatDlg(getT('{ids[0]}'))"), ('weekly slot', "openSlot(null, {})"), ('task reference', "taskRefPick(() => {})")):
                pg.evaluate("closeModal(); U.sel = null; render()"); pg.evaluate(js); pg.wait_for_timeout(250)
                for m in pg.evaluate(AUDIT, '#modal .mbox'): bad.append(f'{w}px dialog "{label}": {m}')
        assert not pg.errs, pg.errs
        b.close()
if bad:
    print('\n'.join(sorted(set(bad)))); raise SystemExit(f'{len(set(bad))} task panel layout problems')
print('task panel audit passed (4 phone widths + desktop, rich / bare / dated / trashed tasks, reminder forms, creation dialogs)')
