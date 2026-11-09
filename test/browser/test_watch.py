"""0.7.0: the smartwatch layout, in the dedicated watch build and switched on in the normal build."""
import os, subprocess, tempfile, pathlib
import lib
from lib import *

ROOTD = lib.ROOT
tmp = tempfile.mkdtemp(prefix='ot-watch-')
subprocess.run(['node', str(ROOTD / 'build-app.mjs'), '--watch', '--out', tmp], check=True, capture_output=True)
WATCH = str(pathlib.Path(tmp) / 'index.html')
SEED = """(()=>{ const td=todayStr();
 S.tasks.push(newTask({title:'Call dentist',due:td,time:'11:00'}), newTask({title:'Overdue report',due:'2020-01-01'}), newTask({title:'Buy milk and a very long second line of text for wrapping',due:td}));
 S.habits.push({id:'h1',name:'Read 20 pages',icon:'book',color:'#34b36b',goal:{per:'day',n:1},created:td,log:{}});
 save(); render(); })()"""
PAGE = "WT.page"
SIZES = [(192, 192), (360, 360), (450, 450), (396, 484)]

def fits(pg, what):
    r = pg.evaluate("""(()=>{ const w=innerWidth,h=innerHeight,bad=[];
      for(const e of document.querySelectorAll('#wapp *')){ const b=e.getBoundingClientRect(); if(!b.width||!b.height) continue;
        if(e.closest('#w-b') && !e.closest('#w-b').contains(e)) continue;
        if(b.right>w+1||b.left<-1) bad.push(e.className+'|'+e.tagName+'|'+Math.round(b.left)+'-'+Math.round(b.right)); }
      const m=document.getElementById('w-b'); return {bad:bad.slice(0,5), over: m.scrollWidth>m.clientWidth+1, page: document.documentElement.scrollWidth>w+1}; })()""")
    assert not r['bad'] and not r['over'] and not r['page'], (what, r)

with sync_playwright() as p:
    for (w, h) in SIZES:
        b, ctx, pg = launch(p, mobile=True, w=w, h=h, ready='#wapp', dist=WATCH)
        assert pg.evaluate("document.documentElement.classList.contains('wmode')") and pg.evaluate("watchOn()")
        assert not pg.is_visible('#main') and not pg.is_visible('#tabbar') and not pg.is_visible('#dock'), 'the full app is hidden'
        pg.evaluate(SEED); pg.wait_for_timeout(200)
        assert pg.locator('.w-n button').count() == 6 and pg.evaluate(PAGE) == 'now'
        for page in ['now', 'tasks', 'next', 'habits', 'focus', 'more']:
            pg.evaluate(f"WT.page='{page}'; WT.add=false; render()"); pg.wait_for_timeout(80); fits(pg, f'{w}x{h} {page}')
            # every button and tick is big enough for a finger (44 CSS px, a bit less on the very smallest screens)
            small = pg.evaluate("[...document.querySelectorAll('#wapp .w-chk,#wapp .w-btn,#wapp .w-row,#wapp .w-modes button')].map(e=>e.getBoundingClientRect()).filter(r=>r.height&&r.height<43).length")
            assert small == 0, (w, h, page, 'targets under 43px', small)
        pg.evaluate("WT.page='tasks'; WT.add=true; render()"); pg.wait_for_timeout(120); fits(pg, f'{w}x{h} add')
        assert not pg.errs, pg.errs; b.close()

    # ---- the interactions, on a round 360 x 360 watch ----
    b, ctx, pg = launch(p, mobile=True, w=360, h=360, ready='#wapp', dist=WATCH)
    pg.evaluate(SEED); pg.wait_for_timeout(200)
    cdp = ctx.new_cdp_session(pg)
    def swipe(x1, y1, x2, y2):
        touch(cdp, 'touchStart', x1, y1); touch(cdp, 'touchMove', (x1 + x2) / 2, (y1 + y2) / 2); touch(cdp, 'touchMove', x2, y2); touch(cdp, 'touchEnd'); pg.wait_for_timeout(250)
    swipe(280, 180, 80, 184); assert pg.evaluate(PAGE) == 'tasks', 'a swipe left goes to the next page'
    swipe(80, 180, 280, 176); assert pg.evaluate(PAGE) == 'now', 'a swipe right goes back'
    swipe(180, 300, 180, 120); assert pg.evaluate(PAGE) == 'now', 'a vertical swipe only scrolls'
    swipe(80, 180, 280, 176); assert pg.evaluate(PAGE) == 'now', 'no page before the first'
    pg.keyboard.press('ArrowRight'); assert pg.evaluate(PAGE) == 'tasks'; pg.keyboard.press('ArrowLeft'); assert pg.evaluate(PAGE) == 'now'
    pg.locator('.w-n button').nth(1).tap(); pg.wait_for_timeout(150); assert pg.evaluate(PAGE) == 'tasks', 'the dots switch pages'
    # tasks: tick one
    before = pg.evaluate("S.tasks.filter(t=>t.status==='open').length")
    pg.locator('.w-chk').first.tap(); pg.wait_for_timeout(250)
    assert pg.evaluate("S.tasks.filter(t=>t.status==='open').length") == before - 1, 'the tick finishes the task'
    # tasks: add one by typing, with the quick-add words understood
    pg.locator('.w-b >> text=New task').tap(); pg.wait_for_selector('#w-in'); assert pg.evaluate("document.activeElement.id") == 'w-in', 'the box is ready to type or dictate into'
    pg.fill('#w-in', 'Call mum tomorrow !high'); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    t = pg.evaluate("S.tasks.find(t=>t.title==='Call mum')"); assert t and t['priority'] > 0 and t['due'], t
    assert pg.evaluate("WT.add") is False and pg.locator('#w-in').count() == 0, 'back to the list'
    pg.locator('.w-b >> text=New task').tap(); pg.wait_for_selector('#w-in'); pg.locator('text=Cancel').tap(); pg.wait_for_timeout(150); assert pg.locator('#w-in').count() == 0
    # habits
    pg.locator('.w-n button').nth(3).tap(); pg.wait_for_timeout(150)
    pg.locator('.w-hab', has_text='Read 20 pages').tap(); pg.wait_for_timeout(250)
    assert pg.evaluate("!!S.habits.find(h=>h.id==='h1').log[todayStr()]"), 'the habit is checked in'
    assert pg.locator('.w-hab.on', has_text='Read 20 pages').count() == 1
    # focus
    pg.locator('.w-n button').nth(4).tap(); pg.wait_for_timeout(150)
    pg.locator('.w-btn.pri').tap(); pg.wait_for_timeout(250); assert pg.evaluate("P.run") is True and 'Pause' in pg.inner_text('.w-btn.pri')
    pg.wait_for_timeout(1300); assert pg.inner_text('#pclock') != '25:00', 'the clock runs'
    pg.locator('.w-btn.pri').tap(); pg.wait_for_timeout(200); assert pg.evaluate("P.run") is False
    pg.locator('.w-modes button', has_text='Short').tap(); pg.wait_for_timeout(150); assert pg.inner_text('#pclock') in ('5:00', '05:00')
    # more: settings, and the way back to the full app
    pg.locator('.w-n button').nth(5).tap(); pg.wait_for_timeout(150)
    pg.locator('.w-btn', has_text='Settings').tap(); pg.wait_for_selector('#modal.on .mbox'); pg.wait_for_timeout(200)
    assert pg.is_visible('#modal .mbox'), 'the full Settings opens over the watch'
    pg.evaluate("openSettings('appearance')"); pg.wait_for_timeout(200)
    assert pg.locator('[data-pf="watch.mode"]').count() == 1 and pg.locator('[data-pf="watch.shape"]').count() == 1
    pg.select_option('[data-pf="watch.shape"]', 'square'); pg.wait_for_timeout(150)
    assert pg.evaluate("document.getElementById('wapp').className") == 'w-square'
    pg.select_option('[data-pf="watch.mode"]', 'off'); pg.wait_for_timeout(300)
    assert pg.evaluate("!document.documentElement.classList.contains('wmode')") and pg.locator('#wapp').count() == 0, 'switched off: the full app is back'
    pg.select_option('[data-pf="watch.mode"]', 'on'); pg.wait_for_timeout(300)
    assert pg.evaluate("document.documentElement.classList.contains('wmode')") and pg.locator('#wapp').count() == 1, 'and on again'
    assert not pg.errs, pg.errs; b.close()

    # ---- the normal build: not a watch unless asked ----
    b, ctx, pg = launch(p, mobile=False)
    assert pg.evaluate("watchOn()") is False and pg.is_visible('#main')
    pg.evaluate("S.settings.watch.mode='on'; watchApply()"); pg.wait_for_timeout(300)
    assert pg.is_visible('#wapp') and not pg.is_visible('#main'), 'On puts a watch face on any screen'
    assert pg.evaluate("document.getElementById('wapp').getBoundingClientRect().width") <= 480, 'and keeps it watch-sized on a big screen'
    pg.evaluate("S.settings.watch.mode='off'; watchApply()"); pg.wait_for_timeout(300); assert pg.is_visible('#main')
    pg.evaluate("S.settings.watch.mode='auto'; location.hash='#watch'; watchApply()"); pg.wait_for_timeout(300); assert pg.evaluate("watchOn()"), 'the address can ask for it'
    assert not pg.errs, pg.errs; b.close()
print('test_watch: ok')
