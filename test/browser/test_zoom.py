"""Interface size: persists, resets, breakpoints follow the effective width, nothing overflows, modals fit, hitboxes are where the
controls are drawn, and pointer-driven features (timetable resize, matrix touch drag) give the right answer at the extremes."""
from lib import *
HITS = """(()=>{const bad=[];for(const b of document.querySelectorAll('#app [data-act], #app button, #app input, #app select')){const r=b.getBoundingClientRect();
  if(r.width<4||r.height<4||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth||getComputedStyle(b).visibility==='hidden')continue;
  const x=Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)),y=Math.min(innerHeight-1,Math.max(0,r.top+r.height/2));let clipped=false;for(let a=b.parentElement;a&&a!==document.body;a=a.parentElement){const cs=getComputedStyle(a);if(cs.overflowX!=='visible'||cs.overflowY!=='visible'){const q=a.getBoundingClientRect();if(x<q.left||x>q.right||y<q.top||y>q.bottom){clipped=true;break}}}if(clipped)continue;const e=document.elementFromPoint(x,y);
  if(e&&!(b===e||b.contains(e)||e.contains(b)||(e.closest&&e.closest('label')&&e.closest('label').contains(b))))bad.push(b.outerHTML.slice(0,70))}return bad.slice(0,5)})()"""
with sync_playwright() as p:
    for name, mobile, w, h in (('desktop', False, 1280, 800), ('phone', True, 390, 780), ('small phone', True, 320, 640)):
        for z in (0.8, 1.5):
            b, ctx, pg = launch(p, mobile=mobile, w=w, h=h)
            # the reference: a real window of the effective size (w/z x h/z) at 100%. A scaled window must lay out the same way.
            rb, rctx, ref = launch(p, mobile=mobile, w=round(w / z), h=round(h / z))
            for q in (pg, ref): q.add_style_tag(content='*{transition:none!important;animation:none!important}')  # measure the settled layout, not a panel mid-slide
            pg.evaluate(f"S.settings.ui.scale={z}; applyScale(); render()"); pg.wait_for_timeout(250)
            m = pg.evaluate("({z:Z.z,r:Z.r,sh:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,eff:innerWidth/Z.z})")
            assert abs(m['z'] - z) < 1e-6 and m['sh'] <= h + 1 and m['sw'] <= w + 1, f'{name} {z}: page overflows {m}'
            for page in ('tasks', 'notes', 'calendar', 'timetable', 'gantt', 'matrix', 'habits'):
                ref.evaluate("U.page='%s'; render()" % page); ref.wait_for_timeout(100); base = set(ref.evaluate(HITS))
                pg.evaluate("U.page='%s'; render()" % page); pg.wait_for_timeout(120)
                ref_over = ref.evaluate("document.documentElement.scrollWidth") > round(w / z) + 1  # a real window this narrow overflows too: not a zoom problem
                assert ref_over or pg.evaluate("document.documentElement.scrollWidth") <= w + 1, f'{name} {z} {page}: sideways overflow that a real {round(w/z)}px window does not have'
                if ref_over: print(f'  note: {page} also overflows sideways in a real {round(w/z)}px-wide window (effective width of {name} at {int(z*100)}%)')
                bad = [x for x in pg.evaluate(HITS) if x not in base]; assert not bad, f'{name} {z} {page}: controls under other pixels, but not in a real {round(w/z)}px window: {bad}'
                # same pane layout as the real window (main area width in layout px)
                a1, a2 = pg.evaluate("document.querySelector('#main').getBoundingClientRect().width / Z.z"), ref.evaluate("document.querySelector('#main').getBoundingClientRect().width")
                assert abs(a1 - a2) <= 2, f'{name} {z} {page}: main area is {a1:.0f}px layout, a real window gives {a2:.0f}'
            pg.evaluate("openSettings('appearance')"); pg.wait_for_timeout(200)
            r = pg.evaluate("(()=>{const m=document.querySelector('.mbox').getBoundingClientRect();return [m.top,m.bottom,m.left,m.right]})()")
            assert r[0] >= -1 and r[1] <= h + 1 and r[2] >= -1 and r[3] <= w + 1, f'{name} {z}: settings dialog {r} does not fit'
            assert not pg.errs and not ref.errs, (pg.errs, ref.errs); b.close(); rb.close()
    # breakpoints follow the effective width: a 1100px window at 150% is a 733px layout
    b, ctx, pg = launch(p, mobile=False, w=1100, h=800)
    assert pg.evaluate("getComputedStyle(document.querySelector('#tabbar')).display") == 'none'
    pg.evaluate("S.settings.ui.scale=1.5; applyScale(); render()"); pg.wait_for_timeout(200)
    assert pg.evaluate("getComputedStyle(document.querySelector('#tabbar')).display") != 'none' and pg.evaluate('narrow(820)'), 'phone layout at 733 effective px'
    pg.evaluate("S.settings.ui.scale=1; applyScale(); render()"); pg.wait_for_timeout(200)
    assert pg.evaluate("getComputedStyle(document.querySelector('#tabbar')).display") == 'none', 'and back again (the originals are kept)'; b.close()
    # slider, buttons, reset, persistence
    b, ctx, pg = launch(p, mobile=False); pg.evaluate("openSettings('appearance')")
    assert pg.evaluate("document.querySelector('#zval').textContent") == '100%' and pg.locator('[data-zreset]:disabled').count() == 1
    pg.click('[data-zstep="1"]'); pg.wait_for_timeout(200); assert pg.evaluate('S.settings.ui.scale') == 1.05 and pg.evaluate("document.documentElement.style.zoom") == '1.05'
    pg.evaluate("(()=>{const r=document.querySelector('#zrange');r.value=140;r.dispatchEvent(new Event('input',{bubbles:true}));})()")
    assert pg.evaluate("Z.z") == 1.05, 'dragging only changes the number, the page is resized when the slider is released'
    assert pg.evaluate("document.querySelector('#zval').textContent") == '140%'
    pg.evaluate("document.querySelector('#zrange').dispatchEvent(new Event('change',{bubbles:true}))"); pg.wait_for_timeout(200); assert pg.evaluate('Z.z') == 1.4
    pg.evaluate('flush && flush()'); pg.reload(); pg.wait_for_selector('#main'); assert pg.evaluate('Z.z') == 1.4 and pg.evaluate("document.documentElement.style.zoom") == '1.4', 'persisted'
    pg.evaluate("openSettings('appearance')"); pg.click('[data-zreset]'); pg.wait_for_timeout(200); assert pg.evaluate('Z.z') == 1 and pg.evaluate("document.documentElement.style.zoom") == '', 'reset restores the default'
    for lit, want in (('9', 1.5), ('0.1', 0.8), ("'x'", 1), ('null', 1), ('NaN', 1), ('1.07', 1.05)): assert pg.evaluate('clampScale(' + lit + ')') == want, lit
    assert not pg.errs, pg.errs; b.close()
    # pointer maths at 150%: resize a timed task by dragging its bottom edge down one hour of *drawn* pixels
    for z in (0.8, 1.5):
        b, ctx, pg = launch(p, mobile=False); pg.evaluate(TT_FIXTURE); pg.evaluate(f"S.settings.ui.scale={z}; applyScale(); render()"); pg.wait_for_timeout(300)
        blk = pg.locator('.blk.tk[data-id="t1"], .blk[data-id="t1"]').first; blk.hover()
        h = blk.locator('.rz:not(.rz-t)').first.bounding_box(); x, y = h['x'] + h['width'] / 2, h['y'] + h['height'] / 2
        one_hour = pg.evaluate('TT_HH') * z
        pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y + one_hour / 2); pg.mouse.move(x, y + one_hour); pg.mouse.up(); pg.wait_for_timeout(250)
        assert pg.evaluate("getT('t1').dur") == 90, f'zoom {z}: dragged one hour, duration is {pg.evaluate("getT(\'t1\').dur")} (expected 90)'
        assert not pg.errs, pg.errs; b.close()
    # matrix touch drag at 150% on a phone
    b, ctx, pg = launch(p, mobile=True); pg.evaluate("S.settings.ui.scale=1.5; applyScale(); U.page='matrix'; render()"); pg.wait_for_selector('.matrix .task'); cdp = ctx.new_cdp_session(pg)
    tid = pg.locator('.quad[data-qi="0"] .task').first.get_attribute('data-id'); pg.evaluate("document.querySelector('.matrix').scrollTop=0")
    q1 = pg.locator('.quad[data-qi="1"] .qb').bounding_box(); x, y = center(pg, f'.task[data-id="{tid}"]')
    touch(cdp, 'touchStart', x, y); pg.wait_for_timeout(650)
    g = pg.locator('.tghost').bounding_box(); assert abs((g['x'] + g['width'] / 2) - x) < 3 and abs((g['y'] + g['height'] / 2) - y) < 3, f'ghost under the finger at 150%: {g} vs {x},{y}'
    mb = pg.evaluate("(()=>{const r=document.querySelector('.matrix').getBoundingClientRect();return [r.top,r.bottom]})()")
    qt = pg.locator('.quad[data-qi="1"]').bounding_box()['y']
    ty = qt + 20  # just inside the second box, inside the scrolling grid and clear of its auto-scroll edge zones
    assert mb[0] + 105 < ty < mb[1] - 105, ('target is in the grid, outside the scroll zones', mb, ty)
    for i in range(1, 6): touch(cdp, 'touchMove', x, y + (ty - y) * i / 5); pg.wait_for_timeout(40)
    touch(cdp, 'touchEnd'); pg.wait_for_timeout(250)
    assert pg.evaluate(f"mxOf(getT('{tid}'))") == 1, 'dropped in the right box at 150%'
    assert not pg.errs, pg.errs; b.close()
print('zoom browser tests passed')
