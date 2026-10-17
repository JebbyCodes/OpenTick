"""Matrix: touch press-and-hold drag, scroll gestures left alone, cancel, persistence, keyboard moves, desktop drag."""
from lib import *
with sync_playwright() as p:
    b, ctx, pg = launch(p, mobile=True)
    pg.evaluate("U.page='matrix'; render()"); pg.wait_for_selector('.matrix .task'); cdp = ctx.new_cdp_session(pg)
    assert pg.evaluate("document.querySelector('.matrix .task').getAttribute('draggable')") is None, 'no competing native drag on touch screens'
    qi = lambda t: pg.evaluate(f"mxOf(getT('{t}'))")
    tid = pg.locator('.quad[data-qi="0"] .task').first.get_attribute('data-id')
    x, y = center(pg, f'.task[data-id="{tid}"]')
    touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(100); touch(cdp, 'touchMove', x, y - 60); pg.wait_for_timeout(600); touch(cdp, 'touchEnd')
    assert qi(tid) == 0 and pg.locator('.tghost').count() == 0, 'a scroll gesture must not pick a task up'
    pg.evaluate("document.querySelector('.matrix').scrollTop=0")
    q1 = pg.locator('.quad[data-qi="1"] .qb').bounding_box(); x, y = center(pg, f'.task[data-id="{tid}"]')
    touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(650)
    assert pg.evaluate('U.tdrag') and pg.locator('.tghost').count() == 1, 'press and hold picks the task up'
    ty = q1['y'] + q1['height'] / 2
    for i in range(1, 6): touch(cdp, 'touchMove', x, y + (ty - y) * i / 5); pg.wait_for_timeout(40)
    assert pg.evaluate("[...document.querySelectorAll('.quad.over')].map(q=>q.dataset.qi)") == ['1']
    touch(cdp, 'touchEnd'); pg.wait_for_timeout(300)
    assert qi(tid) == 1, 'dropped into the box under the finger'
    assert not pg.evaluate('U.tdrag') and pg.locator('.tghost').count() == 0 and not pg.evaluate('U.sel'), 'no ghost, no stuck drag, the task did not open'
    pg.evaluate('flush && flush()'); pg.reload(); pg.wait_for_selector('#main'); pg.evaluate("U.page='matrix'; render()")
    assert qi(tid) == 1, 'the move survives a reload'
    x, y = center(pg, f'.task[data-id="{tid}"]'); touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(650); touch(cdp, 'touchMove', x, y + 300); touch(cdp, 'touchCancel'); pg.wait_for_timeout(200)
    assert qi(tid) == 1 and pg.locator('.tghost').count() == 0 and not pg.evaluate('U.tdrag'), 'a cancelled drag changes nothing'
    pg.locator(f'.task[data-id="{tid}"]').focus(); pg.keyboard.press('Alt+ArrowDown'); pg.wait_for_timeout(200)
    assert qi(tid) == 2 and pg.evaluate(f"document.activeElement.dataset.id==='{tid}'"), 'keyboard move keeps focus on the task'
    assert not pg.errs, pg.errs; b.close()
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("U.page='matrix'; render()"); pg.wait_for_selector('.matrix .task')
    tid = pg.locator('.quad[data-qi="0"] .task').first.get_attribute('data-id'); pg.locator(f'.task[data-id="{tid}"]').focus(); seq = []
    for k in ('Alt+ArrowRight', 'Alt+ArrowRight', 'Alt+ArrowDown', 'Alt+ArrowLeft', 'Alt+ArrowUp'):
        pg.keyboard.press(k); pg.wait_for_timeout(120); seq.append(pg.evaluate(f"mxOf(getT('{tid}'))"))
    assert seq == [1, 1, 3, 2, 0], seq
    src = pg.locator('.quad[data-qi="0"] .task').first; t2 = src.get_attribute('data-id'); src.drag_to(pg.locator('.quad[data-qi="3"] .qb')); pg.wait_for_timeout(300)
    assert pg.evaluate(f"mxOf(getT('{t2}'))") == 3, 'mouse drag and drop still works'
    assert not pg.errs, pg.errs; b.close()
print('matrix browser tests passed')
