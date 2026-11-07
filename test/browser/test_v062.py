"""0.6.2 in a real browser: one Calendar, the settings strip that stays put, search in the app and in Settings, Templates in Notes,
headings that match their buttons, and key caps that are always shown (never only on hover)."""
from lib import *
with sync_playwright() as p:
    # ---- desktop
    b, ctx, pg = launch(p, w=1280, h=800); pg.wait_for_timeout(300)
    # the Calendar: Month by default is the calendar; Week, 3 days and Day are the time grid
    pg.evaluate("U.page='calendar'; render()"); pg.wait_for_timeout(150)
    tabs = pg.evaluate("[...document.querySelectorAll('#main > .vtabs button')].map(b => b.innerText.trim())")
    assert tabs == ['Month', 'Week', '3 days', 'Day', 'Agenda', 'Countdowns', 'Time zones'], tabs
    pg.click('#main > .vtabs [data-v=week]'); pg.wait_for_selector('.tt-scroll'); assert pg.evaluate('U.page') == 'timetable'
    assert pg.evaluate("document.querySelector('#main > .vtabs button.on').innerText.trim()") == 'Week'
    assert pg.locator('#main > header.top [data-act=ttview], #main > header.top [data-act=calview]').count() == 0, 'the view buttons are not repeated on the toolbar'
    pg.click('#main > .vtabs [data-v="3day"]'); pg.wait_for_timeout(150); assert pg.evaluate("document.querySelectorAll('.tt-col').length") == 3
    pg.click('#main > .vtabs [data-v=month]'); pg.wait_for_timeout(150); assert pg.evaluate('U.page') == 'calendar' and pg.locator('.tt-scroll').count() == 0
    # one Add, one More: the Classes view is inside More, not a button of its own
    assert pg.locator('[data-act=caladd]').count() == 1 and pg.locator('[data-act=calmore]').count() == 1 and pg.locator('[data-act=scmode]').count() == 0
    pg.click('[data-act=calmore]'); assert pg.locator('.ctx-i').count() >= 2; pg.keyboard.press('Escape')
    # headings say what the button says
    for page, label in (('gantt', 'Timeline'), ('kanban', 'Board'), ('matrix', 'Matrix'), ('habits', 'Habits')):
        pg.evaluate(f"U.page='{page}'; render()"); pg.wait_for_timeout(100)
        assert pg.evaluate("document.querySelector('#main h1').innerText.trim()") == label, (page, label)
    # Templates are one tap from Notes, even while a note is open
    pg.evaluate("U.page='notes'; U.noteSel=S.notes[0].id; render()"); pg.wait_for_timeout(150)
    assert pg.locator('#main > .vtabs:visible').count() == 1, 'the Notes tabs stay visible with a note open'
    pg.click('#main > .vtabs button:has-text("Templates")'); pg.wait_for_timeout(150); assert pg.evaluate('U.page') == 'templates'
    pg.evaluate("U.page='notes'; U.noteSel=null; render()"); assert pg.locator('[data-act=notetpl]').count() >= 1, 'a template button on the Notes page'
    # search everywhere: "/" and Ctrl+K open it, typing finds a task, Enter opens it, Esc closes
    pg.evaluate("document.activeElement && document.activeElement.blur(); U.page='tasks'; render()")
    pg.keyboard.press('/'); pg.wait_for_selector('.mbox.gs'); assert pg.evaluate("document.activeElement.id") == 'gs-q', 'the search box has the focus'
    pg.keyboard.type('welcome'); pg.wait_for_selector('.gs-r:has-text("Welcome to OpenTick")'); assert pg.locator('.gs-r').count() >= 1
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200); assert pg.locator('.mbox.gs').count() == 0 and pg.evaluate("U.sel") is not None, 'Enter opens the first hit'
    pg.keyboard.press('Control+k'); pg.wait_for_selector('.mbox.gs'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); assert pg.locator('.mbox.gs').count() == 0
    pg.click('#side .search input'); pg.wait_for_selector('.mbox.gs'); pg.keyboard.press('Escape')  # the sidebar box opens the same search
    # settings search
    pg.evaluate("openSettings('general')"); pg.wait_for_selector('#setq'); pg.fill('#setq', 'zoom'); pg.wait_for_selector('.sr-i')
    assert pg.locator('.sr-i').count() >= 1; pg.locator('.sr-i').first.click(); pg.wait_for_timeout(250)
    assert pg.evaluate("U.setTab") == 'appearance', 'a result opens its section'
    # key caps: shown without hovering, and hovering adds only the tooltip (never another cap)
    caps = pg.evaluate("[...document.querySelectorAll('#side .skh')].filter(e => e.getBoundingClientRect().width > 0).length")
    assert caps >= 1, 'the shortcuts are visible while they are switched on'
    pg.evaluate('closeModal()')
    btn = pg.locator('#side .pg').first; btn.hover(); pg.wait_for_timeout(700)
    assert pg.evaluate("[...document.querySelectorAll('#side .skh')].filter(e => e.getBoundingClientRect().width > 0).length") == caps, 'hovering does not add key caps'
    assert not pg.errs, pg.errs; b.close()

    # ---- phone: the settings strip does not jump when a section is tapped
    b, ctx, pg = launch(p, mobile=True, w=390, h=780)
    pg.evaluate("openSettings('general')"); pg.wait_for_selector('.set-n'); pg.wait_for_timeout(300)
    inside = pg.evaluate("!!document.querySelector('#setc .set-n')"); assert not inside, 'the strip is outside the part that scrolls'
    pg.evaluate("document.querySelector('.set-n').scrollLeft = 90"); pg.wait_for_timeout(100)
    x0 = pg.evaluate("document.querySelector('.set-n').scrollLeft")
    visible = pg.evaluate("""(() => { const s = document.querySelector('.set-n'), v = s.getBoundingClientRect(); return [...s.querySelectorAll('.stb')].map((b, i) => [i, b.getBoundingClientRect()]).filter(([i, r]) => r.left >= v.left && r.right <= v.right).map(([i]) => i) })()""")
    assert len(visible) >= 2, visible
    for i in (visible[0], visible[-1]):
        pg.locator('.set-n .stb').nth(i).click(); pg.wait_for_timeout(250)
        x1 = pg.evaluate("document.querySelector('.set-n').scrollLeft"); assert abs(x1 - x0) <= 1, f'the strip jumped from {x0} to {x1} when a visible section was tapped'
        assert pg.evaluate("document.documentElement.scrollWidth") <= 391
    assert not pg.errs, pg.errs; b.close()
print('0.6.2 browser tests passed (Calendar, headings, Templates in Notes, search, settings search, key caps, settings strip)')
