"""Multi-select: the X must take the toolbar fully off screen (it used to stop 41px short, over the tab bar) and be a real 44px target."""
from lib import *
with sync_playwright() as p:
    for mobile, w in ((True, 390), (True, 320), (False, 1280)):
        b, ctx, pg = launch(p, mobile=mobile, w=w, h=700 if mobile else 800)
        tap = (lambda s: pg.tap(s)) if mobile else (lambda s: pg.click(s))
        tap('[data-act="bstart"]'); pg.wait_for_timeout(400)
        X = pg.locator('#bbar [data-act="bx"]').bounding_box()
        assert X['width'] >= 44 and X['height'] >= 44, f'X is {X["width"]}x{X["height"]} at {w}px'
        bar = pg.locator('#bbar').bounding_box(); assert bar['x'] >= 0 and bar['x'] + bar['width'] <= w, 'toolbar fits the screen'
        for lab in pg.locator('#bbar .bb').all(): assert lab.bounding_box()['width'] >= 44, 'every action is a usable target'
        tap('#bbar [data-act="bx"]'); pg.wait_for_timeout(450)
        assert pg.evaluate('U.bsel') is None and not pg.evaluate("document.body.classList.contains('batch')"), 'selection mode ended'
        assert pg.evaluate("getComputedStyle(document.querySelector('#bbar')).visibility") == 'hidden'
        assert pg.evaluate("document.querySelector('#bbar').getBoundingClientRect().top") >= pg.viewport_size['height'], 'bar is fully off screen'
        assert pg.evaluate("document.activeElement.dataset.act") == 'bstart', 'focus returns to the button that started selecting'
        # the hidden bar must not intercept the tab bar / content below it
        hit = pg.evaluate("""(()=>{const q=getComputedStyle(document.querySelector('#tabbar')).display!=='none'?document.querySelector('#tabbar button:nth-child(2)'):document.querySelector('#main');const r=q.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,Math.min(innerHeight-6,r.bottom-6)).closest('#bbar')?'bbar':'ok'})()""")
        assert hit == 'ok', 'hidden toolbar steals taps'
        tap('[data-act="bstart"]'); pg.wait_for_timeout(300); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        assert pg.evaluate('U.bsel') is None, 'Escape exits too'
        assert not pg.errs, pg.errs; b.close()
print('selection bar browser tests passed')
