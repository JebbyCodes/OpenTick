"""0.6.1 in a real browser: the clock on phones, key hints that stay in view, scrolling that goes one way only, and the section navigation.
Run alone:  python3 test/browser/test_v061.py   (also part of  python3 test/browser/run.py)"""
from lib import *
import re

with sync_playwright() as p:
    # ---- phone: the clock is shown beside the sync cloud, inside the screen
    for w in (320, 390, 412):
        b, ctx, pg = launch(p, mobile=True, w=w, h=780)
        r = pg.evaluate("""(() => { const c = document.getElementById('clock'), d = document.getElementById('dock'), cs = getComputedStyle(c), r = c.getBoundingClientRect(), dr = d.getBoundingClientRect();
          return { shown: cs.display !== 'none' && r.width > 0, text: c.innerText.trim(), right: dr.right, vw: document.documentElement.clientWidth, left: dr.left } })()""")
        assert r['shown'] and r['text'], f'{w}px: the clock is hidden or empty: {r}'
        assert re.search(r'\d{1,2}:\d\d', r['text']), f'{w}px: no time in the clock: {r}'
        assert r['left'] >= 0 and r['right'] <= r['vw'] + 1, f'{w}px: the clock pill leaves the screen: {r}'
        # while syncing the pill still keeps the time
        pg.evaluate("Sync.on = true; Sync.state = 'busy'; paintDock(); clockPaint()"); pg.wait_for_timeout(350)
        r2 = pg.evaluate("(() => { const d = document.getElementById('dock').getBoundingClientRect(), c = document.getElementById('clock'); return { right: d.right, vw: document.documentElement.clientWidth, shown: c.getBoundingClientRect().width > 0 } })()")
        assert r2['shown'] and r2['right'] <= r2['vw'] + 1, f'{w}px while syncing: {r2}'
        b.close()
    import re
    # ---- desktop: no key cap spills out of a small button; every hint that exists stays inside the sidebar / window
    b, ctx, pg = launch(p, w=1280, h=800); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelectorAll('[data-skd]').length")  # hints have been applied
    out = pg.evaluate("""(() => { const bad = [], vw = innerWidth, side = document.getElementById('side').getBoundingClientRect();
      for (const h of document.querySelectorAll('.skh')) { const r = h.getBoundingClientRect(); if (!r.width) continue; const inSide = h.closest('#side');
        if (r.right > vw + 1 || r.left < -1 || (inSide && (r.right > side.right + 1))) bad.push((h.parentElement.getAttribute('data-act') || h.parentElement.className) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); }
      const plus = document.querySelector('#side [data-act=addlist]'); return { bad, plusHint: !!(plus && plus.querySelector('.skh')), plusTitle: plus ? plus.title : '' } })()""")
    assert not out['bad'], f'key hints outside the screen or sidebar: {out["bad"]}'
    assert not out['plusHint'], 'the small "+" beside Lists must not carry key caps'
    assert 'Shift+L' in out['plusTitle'], f'but its tooltip still names the shortcut: {out["plusTitle"]}'
    # ---- scrolling goes one way only
    css = pg.evaluate("""(() => { const g = (s, f) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return f.map(k => c[k]); };
      const F = ['overflowX', 'overflowY', 'overscrollBehaviorX'], o = {};
      U.page = 'tasks'; render(); o.side = g('#side .scroll', F); o.body = g('#main .body', F);
      U.page = 'kanban'; render(); o.kan = g('.kn', F); return o })()""")
    assert css['side'][0] == 'hidden' and css['side'][2] != 'auto', f'the sidebar list can move sideways: {css}'
    assert css['body'] and css['body'][0] == 'hidden', f'the task list can move sideways: {css}'
    if css['kan']: assert css['kan'][1] == 'hidden' and css['kan'][0] in ('auto', 'scroll'), f'the board strip should only go sideways: {css}'
    assert pg.evaluate("getComputedStyle(document.documentElement).overscrollBehaviorX") == 'none'
    # ---- sections: five places in the sidebar, a switcher inside each
    pg.evaluate("U.page = 'tasks'; render()")
    names = pg.evaluate("[...document.querySelectorAll('#side .pages .pg')].map(b => b.innerText.trim())")
    assert names == ['Projects', 'Tasks', 'Notes', 'Calendar', 'Habits'], names
    tabs = pg.evaluate("[...document.querySelectorAll('#main > .vtabs button')].map(b => b.innerText.trim())")
    assert tabs == ['List', 'Board', 'Matrix', 'Timeline'], tabs
    pg.click('#main > .vtabs button:has-text("Matrix")'); pg.wait_for_selector('.matrix')
    assert pg.evaluate("U.page") == 'matrix' and pg.evaluate("document.querySelectorAll('#main > .vtabs button.on').length") == 1
    assert pg.evaluate("document.querySelector('#side .pages .pg.on').innerText.trim()") == 'Tasks', 'the section stays lit while you move between its views'
    pg.click('#side .pages .pg:has-text("Calendar")'); pg.wait_for_timeout(200)
    pg.click('#main > .vtabs button:has-text("Time zones")'); pg.wait_for_selector('.tzgrid')
    pg.click('#side .pages .pg:has-text("Tasks")'); pg.wait_for_timeout(200)
    assert pg.evaluate("U.page") == 'matrix', 'Tasks reopens on the view used last'
    pg.keyboard.press('v'); pg.wait_for_timeout(150); assert pg.evaluate("U.page") == 'gantt', 'V steps to the next view'
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.click('#clock'); pg.wait_for_selector('.tzgrid'); assert pg.evaluate("U.page") == 'zones', 'the clock opens Time zones'
    b.close()
    # ---- phone: the tab bar has the five sections, every page fits, the switcher scrolls sideways only
    b, ctx, pg = launch(p, mobile=True, w=360, h=740)
    tb = pg.evaluate("[...document.querySelectorAll('#tabbar button')].map(b => b.innerText.trim())")
    assert tb == ['Projects', 'Tasks', 'Notes', 'Calendar', 'Habits', 'More'], tb
    pg.evaluate("U.page = 'calendar'; render()")
    r = pg.evaluate("(() => { const t = document.querySelector('#main > .vtabs'); const o = [...t.querySelectorAll('button')].map(b => b.getBoundingClientRect()); return { n: o.length, w: t.clientWidth, sw: t.scrollWidth, oy: getComputedStyle(t).overflowY, doc: document.documentElement.scrollWidth, vw: innerWidth } })()")
    assert r['n'] == 4 and r['oy'] == 'hidden' and r['doc'] <= r['vw'] + 1, r
    b.close()
print('0.6.1 browser tests passed (clock on phones, key hints, one-way scrolling, sections)')
