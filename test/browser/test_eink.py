"""E-ink mode: black on white whatever the theme, no animation, marks instead of colour, page buttons that scroll, nothing cut off on a phone."""
from lib import *
import re
def rgb(s): return tuple(int(x) for x in re.findall(r'\d+', s)[:3])
with sync_playwright() as p:
    b, ctx, pg = launch(p, mobile=False)
    assert pg.evaluate("document.documentElement.dataset.eink") is None and pg.locator('#einkpg').count() == 0, 'off by default'
    pg.evaluate(TT_FIXTURE); pg.evaluate("S.settings.theme='dracula'; applyTheme && applyTheme(); S.settings.eink.mode='on'; a11yApply(); motionApply(); U.page='tasks'; render()"); pg.wait_for_timeout(300)
    assert pg.evaluate("document.documentElement.dataset.eink") == 'on'
    assert rgb(pg.evaluate("getComputedStyle(document.body).backgroundColor")) == (255, 255, 255), 'white, even with a dark theme chosen'
    assert rgb(pg.evaluate("getComputedStyle(document.body).color")) == (0, 0, 0)
    assert pg.evaluate("[...document.querySelectorAll('.task,.btn,.ib')].every(e=>getComputedStyle(e).transitionDuration==='0s')"), 'no transitions'
    assert pg.evaluate("motionOK()") is False, 'JS animations are off too'
    assert pg.evaluate("document.documentElement.dataset.nocol") is not None and pg.evaluate("document.documentElement.dataset.tap") is not None, 'marks instead of colour, big targets'
    # page buttons scroll the list
    pg.evaluate("for (let i=0;i<60;i++) S.tasks.push(newTask({title:'Filler '+i,due:todayStr()})); render()"); pg.wait_for_timeout(300)
    assert pg.locator('#einkpg button').count() == 2
    sc = pg.evaluate("(()=>{const s=einkScroller(); return s? s.className||s.tagName : null})()"); assert sc, 'a scrolling area is found'
    before = pg.evaluate("einkScroller().scrollTop"); pg.click('#einkpg [data-pg="1"]'); pg.wait_for_timeout(100)
    after = pg.evaluate("einkScroller().scrollTop"); assert after > before + 100, f'page down scrolled {before} -> {after}'
    pg.click('#einkpg [data-pg="-1"]'); pg.wait_for_timeout(100); assert pg.evaluate("einkScroller().scrollTop") < after
    # Off turns everything back
    pg.evaluate("S.settings.eink.mode='off'; a11yApply(); motionApply()"); pg.wait_for_timeout(100)
    assert pg.evaluate("document.documentElement.dataset.eink") is None and pg.locator('#einkpg').count() == 0
    assert not pg.errs, pg.errs; b.close()
    # a phone: the toolbar still fits and the page buttons do not push the page sideways
    for w in (320, 390):
        b, ctx, pg = launch(p, mobile=True, w=w, h=700); pg.evaluate(TT_FIXTURE)
        pg.evaluate("S.settings.eink.mode='on'; a11yApply(); U.page='timetable'; render()"); pg.wait_for_timeout(300)
        assert pg.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"), f'{w}px: no sideways scroll'
        assert pg.evaluate("(()=>{const r=document.querySelector('[data-act=ttview][data-v=week]').getBoundingClientRect(); return r.right<=innerWidth && r.width>0})()"), f'{w}px: Week button on screen'
        assert not pg.errs, pg.errs; b.close()
print('e-ink browser tests passed')
