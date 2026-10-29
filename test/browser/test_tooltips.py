"""Tooltips: hover (mouse), press-and-hold (touch) and keyboard focus show what a button does; the hold does not press the button;
the tip stays on screen at every phone width and with the interface zoomed; Settings turns it off."""
from lib import *
with sync_playwright() as p:
    # ---- mouse ----
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("U.page='timetable'; render()"); pg.wait_for_timeout(200)
    btn = pg.locator('[data-act=ttprev]').first; want = btn.get_attribute('title'); assert want, 'the button has a title'
    btn.hover(); pg.wait_for_timeout(700)
    tip = pg.locator('#tip'); assert tip.count() == 1 and tip.inner_text().strip().startswith(want.split(' (')[0]), 'hover shows the title'
    assert btn.get_attribute('title') is None, 'the browser’s own tooltip is held back while ours shows'
    pg.mouse.move(5, 400); pg.wait_for_timeout(400)
    assert pg.locator('#tip').count() == 0, 'it goes away when the mouse leaves'; assert btn.get_attribute('title') == want, 'the title is put back'
    # a shortcut at the end of the title becomes a key cap
    pg.locator('[data-act=settings]').first.hover(); pg.wait_for_timeout(700)
    assert pg.locator('#tip kbd').count() == 1, 'the shortcut is a key cap'; pg.mouse.move(5, 400)
    # keyboard focus
    pg.evaluate("document.activeElement && document.activeElement.blur()"); pg.keyboard.press('Tab'); pg.wait_for_timeout(100)
    for _ in range(12):
        pg.keyboard.press('Tab'); pg.wait_for_timeout(400)
        if pg.locator('#tip').count(): break
    assert pg.locator('#tip').count() == 1, 'Tab onto a labelled button shows its tip'; pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    assert pg.locator('#tip').count() == 0, 'Esc hides it'
    # off in Settings
    pg.evaluate("S.settings.tips.on=false"); pg.locator('[data-act=ttnext]').first.hover(); pg.wait_for_timeout(700); assert pg.locator('#tip').count() == 0, 'off means off'
    assert not pg.errs, pg.errs; b.close()

    # ---- touch: hold ----
    for w, h in ((320, 640), (390, 780)):
        b, ctx, pg = launch(p, mobile=True, w=w, h=h); cdp = ctx.new_cdp_session(pg)
        pg.evaluate("U.page='timetable'; render(); window.__n=0; document.addEventListener('click',e=>{if(e.target.closest('[data-act=ttnext]'))window.__n++},false)"); pg.wait_for_timeout(200)
        x, y = center(pg, '[data-act=ttnext]'); want = pg.locator('[data-act=ttnext]').first.get_attribute('title')
        touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(250); assert pg.locator('#tip').count() == 0, 'a short touch shows nothing yet'
        pg.wait_for_timeout(450); assert pg.locator('#tip').count() == 1, 'holding shows the tip'
        box = pg.locator('#tip').bounding_box(); assert box['x'] >= 0 and box['x'] + box['width'] <= w and box['y'] >= 0, f'the tip is on screen {box}'
        assert box['y'] + box['height'] <= y, 'above the finger'
        touch(cdp, 'touchEnd'); pg.wait_for_timeout(300)
        assert pg.evaluate('window.__n') == 0, 'letting go after a hold does not press the button'
        # a normal tap still works afterwards
        pg.wait_for_timeout(900); touch(cdp, 'touchStart', x, y); touch(cdp, 'touchEnd'); pg.wait_for_timeout(300)
        assert pg.evaluate('window.__n') == 1, 'a normal tap still presses it'
        # moving the finger cancels the hold (a scroll)
        touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(100); touch(cdp, 'touchMove', x, y + 60); pg.wait_for_timeout(600)
        assert pg.locator('#tip').count() == 0, 'scrolling is not a hold'; touch(cdp, 'touchEnd')
        # the hold tips the toolbar buttons that were cut off before
        pg.wait_for_timeout(700); x, y = center(pg, '[data-act=ttview][data-v=week]'); touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(700)
        touch(cdp, 'touchEnd'); assert not pg.errs, pg.errs; b.close()

    # ---- zoomed interface: the tip stays next to its button ----
    b, ctx, pg = launch(p, mobile=False); pg.evaluate("S.settings.scale=1.4; applyScale(1.4,{quiet:true}); U.page='timetable'; render()"); pg.wait_for_timeout(300)
    bb = pg.locator('[data-act=ttnext]').first; bb.hover(); pg.wait_for_timeout(700)
    t = pg.locator('#tip').bounding_box(); r = bb.bounding_box()
    assert abs((t['x'] + t['width'] / 2) - (r['x'] + r['width'] / 2)) < 40 and abs(t['y'] + t['height'] - r['y']) < 40, f'tip {t} sits by its button {r} when zoomed'
    b.close()
print('tooltip browser tests passed')
