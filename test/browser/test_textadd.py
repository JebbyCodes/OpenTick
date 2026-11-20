"""0.9: "Add from text" in the real UI (desktop and phone): the header button and Shift+A, the kind tabs, a live preview with warnings,
the example, "Copy syntax for AI", adding with Undo, pasting several lines into quick add, and nothing cut off at phone width."""
from lib import *

AUDIT = """(root) => { const vw = document.documentElement.clientWidth, out = [];
  const R = document.querySelector(root); if (!R) return ['missing ' + root];
  const lim = Math.min(vw, R.getBoundingClientRect().right) + 1;
  for (const e of R.querySelectorAll('*')) { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || s.display === 'none' || e.closest('[hidden]') || e.closest('svg') || e.closest('textarea')) continue;
    if (r.right > lim || r.left < -1) out.push(`${e.tagName}.${String(e.className || '').slice(0, 24)} ${Math.round(r.left)}..${Math.round(r.right)} (screen ${vw})`); }
  for (const sc of [R, ...R.querySelectorAll('.mbox')]) if (sc.scrollWidth > sc.clientWidth + 1) out.push(`${sc.className || sc.tagName} is ${sc.scrollWidth}px wide in a ${sc.clientWidth}px box`);
  return out; }"""

with sync_playwright() as p:
    for mobile in (False, True):
        tag = 'phone' if mobile else 'desktop'
        b, ctx, pg = launch(p, mobile=mobile, w=360 if mobile else 1280, h=740 if mobile else 850)
        try: ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        except Exception: pass
        n0 = pg.evaluate("S.tasks.length")
        # ---- the header button opens it on the page you are on ----
        pg.evaluate("U.page='gantt'; render()"); pg.wait_for_timeout(250)
        pg.locator('#main [data-act=tbopen]').first.click(); pg.wait_for_timeout(250)
        assert pg.locator('#modal [data-tbk=timeline].on').count() == 1, (tag, 'the timeline page should open the Timeline tab')
        bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, 'dialog overflow (empty)', bad)
        assert 'Nothing yet' in pg.inner_text('#atx-prev'), (tag, pg.inner_text('#atx-prev'))
        assert pg.is_disabled('#atx-ok'), 'Add is disabled with nothing to add'
        # ---- type, and the preview follows ----
        pg.fill('#atx-ta', 'Design phase Nov 2 -> Nov 20 #design\nBuild from Nov 23 to Jan 15 !high\n  Set up the repo\nReverse Dec 10 .. Dec 1\nUndated thing'); pg.wait_for_timeout(300)
        prev = pg.inner_text('#atx-prev')
        assert 'Design phase' in prev and 'Build' in prev and 'Set up the repo' in prev and '#design' in prev and 'swapped' in prev and 'timeline' in prev.lower(), (tag, prev)
        assert pg.inner_text('#atx-ok') == 'Add 4 items', (tag, pg.inner_text('#atx-ok'))
        bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, 'dialog overflow (timeline preview)', bad)
        # ---- the tabs keep what was typed ----
        pg.locator('#modal [data-tbk=timetable]').click(); pg.wait_for_timeout(200)
        assert pg.input_value('#atx-ta') == '', (tag, 'a new tab starts empty')
        pg.fill('#atx-ta', 'Mon Wed 9:00-10:30 Maths (Room 4) colour:blue\nSat Chess club\nTue 14-15:30 Lab #green'); pg.wait_for_timeout(300)
        prev = pg.inner_text('#atx-prev'); assert 'Maths' in prev and 'Room 4' in prev and 'Needs a time' in prev and 'skipped' in prev and 'Lab' in prev, (tag, prev)
        assert pg.inner_text('#atx-ok') == 'Add 2 slots'
        bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, 'dialog overflow (timetable preview)', bad)
        pg.locator('#modal [data-tbk=timeline]').click(); pg.wait_for_timeout(200)
        assert 'Design phase' in pg.input_value('#atx-ta'), (tag, 'the timeline text was not kept when switching tabs')
        # ---- the example, and every kind's example previews with no skipped line ----
        for k in ['tasks', 'calendar', 'timeline', 'timetable', 'notes', 'habits', 'countdowns']:
            pg.locator(f'#modal [data-tbk={k}]').click(); pg.wait_for_timeout(120)
            pg.fill('#atx-ta', ''); pg.locator('#modal [data-m=ex]').click(); pg.wait_for_timeout(300)
            assert pg.input_value('#atx-ta').strip() != '', (tag, k, 'Example put nothing in the box')
            prev = pg.inner_text('#atx-prev'); assert '(skipped)' not in prev, (tag, k, prev)
            assert not pg.is_disabled('#atx-ok'), (tag, k)
            bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, k, 'dialog overflow with the example', bad)
        # ---- copy syntax for AI ----
        pg.locator('#modal [data-tbk=tasks]').click(); pg.wait_for_timeout(150)
        pg.evaluate("S.lists.push({ id: 'la', name: 'Atlas', color: '#4772fa', sections: [] })")
        pg.locator('#modal [data-m=ai]').click(); pg.wait_for_timeout(300)
        clip = ''
        try: clip = pg.evaluate("navigator.clipboard.readText()")
        except Exception: clip = pg.input_value('#atx-ta')
        assert 'FORMAT' in clip and 'EXAMPLE' in clip and 'Today is' in clip and 'Atlas' in clip and 'MY REQUEST' in clip, (tag, clip[:300])
        # ---- add tasks, in the order typed, with Undo ----
        pg.fill('#atx-ta', '# Browser test list\n## First\nOne fri 10:00-11:00 !high #bt remind 1h\n  Sub A\n  [x] Sub B\nTwo tomorrow\n> a note for two\nThree'); pg.wait_for_timeout(300)
        assert pg.inner_text('#atx-ok') == 'Add 3 tasks', pg.inner_text('#atx-ok'); assert 'Browser test list' in pg.inner_text('#atx-prev')
        pg.keyboard.press('Control+Enter') if not mobile else pg.click('#atx-ok'); pg.wait_for_timeout(400)
        assert pg.locator('#modal.on').count() == 0, (tag, 'the dialog did not close')
        assert pg.evaluate("S.tasks.length") == n0 + 3, (tag, pg.evaluate("S.tasks.length"), n0)
        got = pg.evaluate("(() => { const l = S.lists.find(x => x.name === 'Browser test list'); return { list: !!l, sec: l && l.sections, titles: S.tasks.filter(t => l && t.listId === l.id).sort((a, b) => a.order - b.order).map(t => t.title), subs: S.tasks.find(t => t.title === 'One').subtasks.map(s => s.title + (s.done ? '*' : '')), note: S.tasks.find(t => t.title === 'Two').notes, rems: S.tasks.find(t => t.title === 'One').rems, dur: S.tasks.find(t => t.title === 'One').dur }; })()")
        assert got['list'] and got['sec'] == ['First'] and got['titles'] == ['One', 'Two', 'Three'] and got['subs'] == ['Sub A', 'Sub B*'] and got['note'] == 'a note for two' and got['rems'] == [60] and got['dur'] == 60, (tag, got)
        assert 'Added 3 tasks' in pg.inner_text('#toast'), (tag, pg.inner_text('#toast'))
        pg.locator('#toast button').click(); pg.wait_for_timeout(300)
        assert pg.evaluate("S.tasks.length") == n0 and pg.evaluate("S.lists.some(x => x.name === 'Browser test list')") is False, (tag, 'Undo did not take it all back')
        # ---- Shift+A opens it anywhere, Esc closes it ----
        pg.evaluate("U.page='notes'; render()"); pg.wait_for_timeout(200); pg.evaluate("document.activeElement && document.activeElement.blur()")
        pg.keyboard.press('Shift+A'); pg.wait_for_timeout(250)
        assert pg.locator('#modal [data-tbk=notes].on').count() == 1, (tag, 'Shift+A did not open the Notes tab on the notes page')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200); assert pg.locator('#modal.on').count() == 0, (tag, 'Esc did not close it')
        # ---- pasting several lines into quick add opens it with those lines ----
        pg.evaluate("U.page='tasks'; U.nav='inbox'; render()"); pg.wait_for_timeout(250)
        pg.evaluate("(() => { const el = document.querySelector('#add'); el.focus(); const dt = new DataTransfer(); dt.setData('text', 'Buy bread\\nCall mum tomorrow'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()"); pg.wait_for_timeout(300)
        assert pg.locator('#modal [data-tbk=tasks].on').count() == 1 and 'Buy bread' in pg.input_value('#atx-ta') and 'Call mum' in pg.input_value('#atx-ta'), (tag, 'pasting lines into quick add did not open the box')
        bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, 'dialog overflow after paste', bad)
        pg.keyboard.press('Escape')
        assert not pg.errs, pg.errs
        b.close()
print('Add from text passed in the real UI (desktop and phone): button, Shift+A, tabs, preview, examples, AI prompt, add and undo, paste into quick add')
