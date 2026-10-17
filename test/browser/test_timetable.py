"""Timetable: every block shows its time range in every size class, 12/24-hour follows Settings, no overlaps, more of the day fits."""
from lib import *
with sync_playwright() as p:
    for name, mobile, w, h, min_hours in (('phone', True, 390, 780, 9), ('small phone', True, 320, 640, 6), ('desktop', False, 1280, 800, 10)):
        b, ctx, pg = launch(p, mobile=mobile, w=w, h=h)
        pg.evaluate(TT_FIXTURE); pg.wait_for_timeout(300)
        hours = pg.evaluate("(()=>{const sc=document.querySelector('.tt-scroll'),top=document.querySelector('.tt-top');return (sc.clientHeight-top.offsetHeight)/TT_HH})()")
        assert hours >= min_hours, f'{name}: only {hours:.1f} hours of the grid visible'
        for blk in pg.locator('.blk').all():
            info = blk.evaluate("""b=>{const vis=['.tt-tm','.bm'].map(s=>{const e=b.querySelector(s);return getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0&&e.textContent.trim().length>0});
              return {vis:vis.some(Boolean), txt:b.textContent, clipV:b.scrollHeight>b.clientHeight+1, label:b.getAttribute('aria-label')}}""")
            assert info['vis'], f'{name}: no visible time in {info["txt"]!r}'
            assert not info['clipV'], f'{name}: content clipped in {info["txt"]!r}'
            assert any(c.isdigit() for c in info['label']), 'screen readers get the time too'
        # no two blocks overlap
        boxes = pg.evaluate("[...document.querySelectorAll('.blk')].map(b=>{const r=b.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]})")
        for i, a in enumerate(boxes):
            for c in boxes[i + 1:]: assert a[2] <= c[0] + 1 or c[2] <= a[0] + 1 or a[3] <= c[1] + 1 or c[3] <= a[1] + 1, f'{name}: blocks overlap {a} {c}'
        t12 = pg.evaluate("[...document.querySelectorAll('.blk .bm, .blk .tt-tm')].map(e=>e.textContent).join(' ')")
        assert 'AM' in t12 or 'PM' in t12, t12
        pg.evaluate('S.settings.clock.h24=true; render()'); pg.wait_for_timeout(200)
        t24 = pg.evaluate("[...document.querySelectorAll('.blk .bm, .blk .tt-tm')].map(e=>e.textContent).join(' ')")
        assert 'AM' not in t24 and 'PM' not in t24 and '09:00–10:30' in t24, t24
        assert pg.evaluate("[...document.querySelectorAll('.tt-gut span')].every(s=>/^\\d\\d:00$/.test(s.textContent))")
        assert not pg.errs, pg.errs; b.close()
    # a saved custom range is kept (auto off); a fresh profile hides quiet hours
    b, ctx, pg = launch(p, mobile=False, init="localStorage.setItem('opentick.v1', JSON.stringify({v:1,tasks:[],lists:[],settings:{tt:{from:9,to:17,v:2}}}))")
    assert pg.evaluate('S.settings.tt.auto') is False, 'customised hours are respected'; b.close()
    # the all-day row collapses and the choice survives a re-render
    b, ctx, pg = launch(p, mobile=True); pg.evaluate(TT_FIXTURE); pg.click('[data-act="ttad"]'); pg.wait_for_timeout(200)
    assert pg.evaluate("S.settings.tt.adOpen") is False and pg.evaluate("getComputedStyle(document.querySelector('.tt-ad')).display") == 'none'
    assert pg.evaluate("document.querySelector('.adtog').getAttribute('aria-expanded')") == 'false'; b.close()
print('timetable browser tests passed')
