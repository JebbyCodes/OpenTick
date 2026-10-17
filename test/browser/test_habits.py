"""Habits in a real browser: the strip follows the chosen date, the picker reaches any date, history cells are keyboard/touch usable."""
from lib import *
SEED = """(()=>{const d=new Date();const k=n=>ymd(new Date(d.getFullYear(),d.getMonth(),d.getDate()-n));const log=a=>Object.fromEntries(a.map(n=>[k(n),1]));
 S.habits=[{id:'h1',name:'Read',icon:'R',color:'#4772fa',goal:{per:'day',n:1},created:k(400),log:log([0,1,2,3,5,8,9,10,40,200])},
  {id:'h2',name:'Gym',icon:'G',color:'#34b36b',goal:{per:'week',n:3},created:k(200),log:log([1,3,5,8])}];
 U.page='habits'; render();})()"""
with sync_playwright() as p:
    for mobile, w in ((True, 390), (False, 1280)):
        b, ctx, pg = launch(p, mobile=mobile, w=w); pg.evaluate(SEED)
        strip = lambda: pg.evaluate("[...document.querySelectorAll('.habit')[0].querySelectorAll('.hd')].map(b=>b.dataset.d)")
        s0 = strip(); assert len(s0) == 7 and s0[-1] == pg.evaluate('todayStr()')
        pg.click('[data-act="hnav"][data-n="-7"]'); s1 = strip(); assert s1 != s0 and s1[-1] == pg.evaluate("ymd(addDays(pYmd(todayStr()),-7))"), 'previous week shows different days'
        assert pg.evaluate("document.activeElement.dataset.n") == '-7', 'keyboard focus stays on the button that was used'
        # jump to a date across a year end and a leap day with the date picker
        pg.fill('[data-hjump]', '2024-02-29'); pg.wait_for_timeout(100); s2 = strip(); assert s2[-1] == '2024-02-29' and '2024-02-23' == s2[0], s2
        pg.fill('[data-hjump]', '2023-01-03'); pg.wait_for_timeout(100); s3 = strip(); assert s3[0] == '2022-12-28' and s3[-1] == '2023-01-03', s3
        # old dates can be checked in and unchecked, and the record is kept per day
        pg.click('.habit .hd[data-d="2023-01-02"]'); assert pg.evaluate("S.habits[0].log['2023-01-02']") == 1
        pg.click('.habit .hd[data-d="2023-01-02"]'); assert not pg.evaluate("S.habits[0].log['2023-01-02']")
        # future days are viewable but cannot be checked in
        pg.fill('[data-hjump]', pg.evaluate("ymd(addDays(pYmd(todayStr()),30))")); pg.wait_for_timeout(100)
        assert pg.locator('.habit .hd.fut:disabled').count() >= 1 and pg.locator('.habit .hcheck:disabled').count() == 2
        pg.click('[data-act="htoday"]'); assert strip()[-1] == pg.evaluate('todayStr()'), 'Today goes back'
        assert pg.locator('[data-act="htoday"]:disabled').count() == 1
        # history
        pg.click('[data-act="hview"][data-v="map"]'); pg.wait_for_selector('.hm-cell')
        assert pg.locator('.hm-cells .hm-cell').count() == 371
        today = pg.evaluate('todayStr()'); cell = pg.locator(f'.hm-cell[data-d="{today}"]'); assert 'sel' in cell.get_attribute('class')
        assert pg.evaluate("document.querySelector('.hm-scroll').scrollLeft") > 0 or w > 900, 'opens on the latest weeks'
        d5 = pg.evaluate("ymd(addDays(pYmd(todayStr()),-5))"); (pg.tap if mobile else pg.click)(f'.hm-cell[data-d="{d5}"]')
        assert d5 in pg.inner_text('.hm-detail') or pg.evaluate("document.querySelector('.hm-detail').textContent.length")>20
        assert pg.locator(f'.hm-cell[data-d="{d5}"].sel').count() == 1 and pg.locator('.hm-cell.sel').count() == 1
        pg.keyboard.press('ArrowLeft'); assert pg.evaluate("document.activeElement.dataset.d") == pg.evaluate("ymd(addDays(pYmd(todayStr()),-12))"), 'left = a week earlier'
        pg.keyboard.press('ArrowDown'); assert pg.evaluate("document.activeElement.dataset.d") == pg.evaluate("ymd(addDays(pYmd(todayStr()),-11))")
        # every cell says what it is in words (not by colour alone)
        assert pg.evaluate("[...document.querySelectorAll('.hm-cell[data-d]')].every(c=>/checked in|upcoming|no habit|nothing due/.test(c.getAttribute('aria-label')))")
        # a single habit is a plain done / not done graph
        pg.select_option('[data-hmhabit]', 'h2'); assert pg.locator('.hm-cells .hm-cell.l2,.hm-cells .hm-cell.l3,.hm-cells .hm-cell.l1').count() == 0, 'one habit: no partial shades'
        # earlier / later windows
        pg.click('[data-act="hmnav"][data-n="-1"]'); assert pg.evaluate("U.hMapEnd !== null")
        pg.click('[data-act="htoday"]'); assert pg.evaluate("U.hMapEnd") is None
        # 'Open this day' routes to the check-in view at that date
        pg.click('.hm-cell[data-d="%s"]' % d5); pg.click('[data-act="hmopen"]'); pg.wait_for_timeout(100)
        assert pg.evaluate("U.hView") == 'track' and strip()[-1] == d5
        # habits are unchanged by looking
        assert pg.evaluate("Object.keys(S.habits[1].log).length") == 4
        assert not pg.errs, pg.errs; b.close()
print('habit browser tests passed')
