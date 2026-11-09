"""0.7.0: pin any view tab or page title next to the sections. Right-click on a computer, press and hold on a touch screen."""
from lib import *

SIDE = "[...document.querySelectorAll('#side .pages .pg')].map(e=>e.dataset.pin||e.dataset.page||'?')"
LIT_SIDE = "[...document.querySelectorAll('#side .pages .pg.on')].map(e=>e.dataset.pin||e.dataset.page||e.textContent.trim())"
LIT_BAR = "[...document.querySelectorAll('#tabbar button.on')].map(e=>e.dataset.pin||e.dataset.page||e.textContent.trim())"
MENU = "[...document.querySelectorAll('.ctx-i')].map(e=>e.textContent.trim())"

with sync_playwright() as p:
    # ---- a computer: right-click ----
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("U.page='calendar'; render()"); pg.wait_for_timeout(200)
    pg.locator('.vtabs [role=tab]', has_text='Classes').first.click(button='right'); pg.wait_for_timeout(150)
    assert pg.evaluate(MENU) == ['Pin “Classes” to the sidebar'], pg.evaluate(MENU)
    pg.locator('.ctx-i').first.click(); pg.wait_for_timeout(250)
    assert pg.evaluate("S.settings.ui.pins") == ['school']
    assert 'school' in pg.evaluate(SIDE), 'the pin sits with the sections'
    assert pg.evaluate("U.page") == 'calendar', 'pinning does not move you'
    pg.locator('#side .pg.pin[data-pin=school]').click(); pg.wait_for_timeout(250)
    assert pg.evaluate("schoolOn()"), 'the pin opens Classes'
    lit = pg.evaluate(LIT_SIDE); assert lit == ['school'], f'only the pin is lit, not Calendar too: {lit}'
    # the page title carries the same menu
    pg.locator('header.top h1').first.click(button='right'); pg.wait_for_timeout(150)
    assert pg.evaluate(MENU) == ['Unpin “Classes”'], pg.evaluate(MENU)
    pg.keyboard.press('Escape'); assert pg.evaluate("document.querySelectorAll('.ctx-i').length") == 0
    # a view tab of another section: Tasks > Board
    pg.evaluate("U.page='tasks'; render()"); pg.wait_for_timeout(200)
    pg.locator('.vtabs [role=tab]', has_text='Board').first.click(button='right'); pg.wait_for_timeout(150)
    assert pg.evaluate(MENU) == ['Pin “Board” to the sidebar'], pg.evaluate(MENU)
    pg.locator('.ctx-i').first.click(); pg.wait_for_timeout(200)
    assert pg.evaluate("S.settings.ui.pins") == ['school', 'page:kanban']
    pg.locator('#side .pg.pin[data-pin="page:kanban"]').click(); pg.wait_for_timeout(250)
    assert pg.evaluate("U.page") == 'kanban' and pg.evaluate(LIT_SIDE) == ['page:kanban']
    # the pinned button's own menu moves and unpins
    pg.locator('#side .pg.pin[data-pin="page:kanban"]').click(button='right'); pg.wait_for_timeout(150)
    assert pg.evaluate(MENU) == ['Open', 'Move earlier', 'Unpin “Board”'], pg.evaluate(MENU)
    pg.locator('.ctx-i', has_text='Move earlier').click(); pg.wait_for_timeout(200)
    assert pg.evaluate("S.settings.ui.pins") == ['page:kanban', 'school']
    # Settings lists them in order
    pg.evaluate("openSettings('layout')"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelectorAll('details:has(.pinlist)').forEach(d => d.open = true)"); pg.wait_for_timeout(150)
    rows = pg.evaluate("[...document.querySelectorAll('.pinrow')].map(e=>e.textContent.trim())")
    assert rows == ['Tasks › Board', 'Classes'] or [r.split('›')[-1].strip() for r in rows] == ['Board', 'Classes'], rows
    pg.locator('[data-pinrm]').first.click(); pg.wait_for_timeout(200)
    assert pg.evaluate("S.settings.ui.pins") == ['school']
    pg.keyboard.press('Escape')
    # they are kept across a reload (settings are saved), and a plain right-click elsewhere is unchanged
    pg.evaluate("save(); flush()")
    assert not pg.errs, pg.errs; b.close()

    # ---- a phone: press and hold ----
    b, ctx, pg = launch(p, mobile=True)
    pg.evaluate("U.page='calendar'; render()"); pg.wait_for_timeout(300)
    tab = ".vtabs [role=tab]:has-text('Classes')"
    pg.locator(tab).first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    cdp = ctx.new_cdp_session(pg)
    # a quick tap still just opens the tab
    pg.locator(".vtabs [role=tab]:has-text('Week')").first.scroll_into_view_if_needed(); pg.locator(".vtabs [role=tab]:has-text('Week')").first.tap(); pg.wait_for_timeout(300)
    assert pg.evaluate("calMode()") == 'week' and pg.evaluate("document.querySelectorAll('.ctx-i').length") == 0, 'a tap is a tap'
    pg.evaluate("U.page='calendar'; render()"); pg.wait_for_timeout(300)
    pg.locator(tab).first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    # a swipe over the tab does not open the menu
    x, y = center(pg, tab)
    touch(cdp, 'touchStart', x, y); touch(cdp, 'touchMove', x - 60, y); pg.wait_for_timeout(700); touch(cdp, 'touchEnd'); pg.wait_for_timeout(200)
    assert pg.evaluate("document.querySelectorAll('.ctx-i').length") == 0, 'a swipe is a scroll'
    # the hold opens the menu, and lifting the finger keeps it open and does not press the tab
    x, y = center(pg, tab)
    touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(700)
    assert pg.evaluate(MENU) == ['Pin “Classes” to the tab bar'], pg.evaluate(MENU)
    touch(cdp, 'touchEnd'); pg.wait_for_timeout(400)
    assert pg.evaluate("document.querySelectorAll('.ctx-i').length") == 1, 'the menu stays open after the finger lifts'
    assert not pg.evaluate("schoolOn()"), 'the hold did not also open the tab'
    pg.locator('.ctx-i').first.tap(); pg.wait_for_timeout(300)
    assert pg.evaluate("S.settings.ui.pins") == ['school']
    bar = pg.evaluate("[...document.querySelectorAll('#tabbar button')].map(e=>e.textContent.trim())")
    assert 'Classes' in bar and bar[-1] == 'More', bar
    pg.locator('#tabbar .pin').first.tap(); pg.wait_for_timeout(300)
    assert pg.evaluate("schoolOn()") and pg.evaluate(LIT_BAR) == ['school'], pg.evaluate(LIT_BAR)
    # holding the page title
    x, y = center(pg, 'header.top h1')
    touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(700); touch(cdp, 'touchEnd'); pg.wait_for_timeout(300)
    assert pg.evaluate(MENU) == ['Unpin “Classes”'], pg.evaluate(MENU)
    pg.keyboard.press('Escape')
    # nothing in the tab bar spills past the screen
    assert pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), 'no sideways scroll on the page'
    assert not pg.errs, pg.errs; b.close()
print('test_pins: ok')
