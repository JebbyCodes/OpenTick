"""Ambient background: layering, no input capture, motion states, settings, persistence, and real rendered contrast on every theme."""
import io, itertools
from lib import *
from PIL import Image

def lum(c):
    f = lambda x: (x / 255) / 12.92 if x / 255 <= 0.03928 else (((x / 255) + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
def ratio(a, b):
    x, y = lum(a), lum(b); return (max(x, y) + 0.05) / (min(x, y) + 0.05)
def hexrgb(h):
    h = h.strip().lstrip('#'); h = ''.join(c * 2 for c in h) if len(h) == 3 else h; return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

with sync_playwright() as p:
    b, ctx, pg = launch(p, mobile=False)
    assert pg.evaluate("S.settings.bg.on") is True and pg.locator('#bgfx i').count() == 5, 'on by default on desktop'
    st = pg.evaluate("(()=>{const e=document.getElementById('bgfx'),i=e.querySelector('i'),c=getComputedStyle(e),ci=getComputedStyle(i);return {z:c.zIndex,pe:c.pointerEvents,pos:c.position,anim:ci.animationName,op:+ci.opacity,aria:e.getAttribute('aria-hidden'),first:document.body.firstElementChild===e}})()")
    assert st['z'] == '-1' and st['pe'] == 'none' and st['pos'] == 'fixed' and st['anim'] != 'none' and st['aria'] == 'true' and st['first'] and 0 < st['op'] < 0.2, st
    # never the target of a click, drag or scroll
    hit = pg.evaluate("(()=>{let bad=0;for(let x=10;x<innerWidth;x+=97)for(let y=10;y<innerHeight;y+=89){const e=document.elementFromPoint(x,y);if(e&&e.closest('#bgfx'))bad++}return bad})()")
    assert hit == 0, 'the background takes no pointer events'
    # modals and menus sit above it
    pg.evaluate('openSettings()'); pg.wait_for_timeout(150)
    assert pg.evaluate("(()=>{const m=document.querySelector('.mbox').getBoundingClientRect();const e=document.elementFromPoint(m.left+m.width/2,m.top+30);return !!e.closest('.mbox')})()")
    # settings dialog: open the background section
    pg.click('[data-m="bgfx"]'); pg.wait_for_selector('#bgprev')
    assert pg.locator('input[data-bg="style"]').count() == 4 and pg.locator('input[data-bg="shape"]').count() == 3
    pg.locator('label.bg-opt', has_text='Aurora').click(); pg.locator('label.bg-opt', has_text='Flowing forms').click(); pg.wait_for_timeout(100)
    assert pg.evaluate("[document.getElementById('bgfx').dataset.style, document.getElementById('bgfx').dataset.shape, document.getElementById('bgprev').dataset.style, document.getElementById('bgprev').dataset.shape]") == ['aurora', 'flow', 'aurora', 'flow'], 'page and preview update live'
    pg.evaluate("(()=>{const r=document.querySelector('#bg-int');r.value=80;r.dispatchEvent(new Event('input',{bubbles:true}))})()")
    assert pg.evaluate("document.querySelector('#bg-int-o').textContent") == '80%' and pg.evaluate("getComputedStyle(document.getElementById('bgfx')).getPropertyValue('--bgfx-o')").strip() == '0.80'
    pg.evaluate("(()=>{const r=document.querySelector('#bg-sp');r.value=50;r.dispatchEvent(new Event('input',{bubbles:true}));r.dispatchEvent(new Event('change',{bubbles:true}))})()")
    d1 = pg.evaluate("getComputedStyle(document.querySelector('#bgfx i')).animationDuration"); pg.evaluate("S.settings.bg.speed=200; bgApply()"); d2 = pg.evaluate("getComputedStyle(document.querySelector('#bgfx i')).animationDuration")
    assert float(d1[:-1]) > float(d2[:-1]) * 3.5, ('slower speed = longer cycle', d1, d2)
    pg.evaluate("S.settings.bg.speed=50; bgApply()")
    pg.click('[data-m="back"]'); pg.wait_for_selector('[data-m="bgfx"]'); pg.keyboard.press('Escape')
    pg.evaluate('flush && flush()'); pg.reload(); pg.wait_for_selector('#main')
    assert pg.evaluate("(({style,shape,intensity,speed})=>[style,shape,intensity,speed])(S.settings.bg)") == ['aurora', 'flow', 80, 50], 'persisted'
    assert pg.evaluate("document.getElementById('bgfx').dataset.shape") == 'flow'
    # 'Let it move' off = still; paused while hidden
    pg.evaluate("S.settings.bg.animate=false; bgApply()"); assert pg.evaluate("getComputedStyle(document.querySelector('#bgfx i')).animationName") == 'none' and pg.evaluate("document.documentElement.classList.contains('bgfx-still')")
    pg.evaluate("S.settings.bg.animate=true; bgApply()"); assert pg.evaluate("getComputedStyle(document.querySelector('#bgfx i')).animationName") != 'none'
    pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
    assert pg.evaluate("getComputedStyle(document.querySelector('#bgfx i')).animationPlayState") == 'paused', 'no animation work while hidden'
    pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'))")
    assert pg.evaluate("getComputedStyle(document.querySelector('#bgfx i')).animationPlayState") == 'running'
    # off removes it entirely and gives the solid colours back
    pg.evaluate("S.settings.bg.on=false; bgApply()"); assert pg.locator('#bgfx').count() == 0 and not pg.evaluate("document.documentElement.classList.contains('bgfx')")
    assert pg.evaluate("getComputedStyle(document.body).backgroundColor") != 'rgba(0, 0, 0, 0)'
    assert not pg.errs, pg.errs; b.close()
    # the system asks for reduced motion: a genuinely static picture, and the dialog says why
    b, ctx, pg = launch(p, mobile=False, reduced_motion='reduce')
    assert pg.evaluate("getComputedStyle(document.querySelector('#bgfx i')).animationName") == 'none' and pg.evaluate("document.documentElement.classList.contains('bgfx-still')")
    pg.evaluate('openSettings()'); pg.click('[data-m="bgfx"]'); pg.wait_for_selector('#bgprev')
    assert pg.locator('input[data-bg="animate"]:disabled').count() == 1 and 'reduce motion' in pg.inner_text('.mbox')
    assert pg.evaluate("getComputedStyle(document.querySelector('#bgprev i')).animationName") == 'none'; b.close()
    # the Android app starts with it off (battery); a fresh profile elsewhere starts with it on
    b, ctx, pg = launch(p, mobile=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36')
    assert pg.evaluate("S.settings.bg.on") is False and pg.locator('#bgfx').count() == 0; b.close()
    # real pixels: the strongest setting never takes a theme's text below the contrast the theme itself has (minus 10%) or 4.5:1
    worst = 99; themes = ['gruvbox-dark', 'gruvbox-light', 'light', 'dark', 'nord', 'solarized-dark', 'dracula']
    b, ctx, pg = launch(p, mobile=False, w=500, h=360); pg.add_style_tag(content='body.only-bg > *:not(#bgfx){visibility:hidden!important}')  # measure the background layer by itself
    for th in themes:
        pg.evaluate(f"S.settings.theme='{th}'; applyTheme()")
        tv = pg.evaluate("(()=>{const c=getComputedStyle(document.documentElement);return {bg:c.getPropertyValue('--bg'),text:c.getPropertyValue('--text')}})()")
        bg, text = hexrgb(tv['bg']), hexrgb(tv['text']); t0 = ratio(text, bg)
        for style, shape in itertools.chain(((s, 'blobs') for s in ('accent', 'aurora', 'dusk', 'mist')), (('accent', s) for s in ('circles', 'flow'))):
            pg.evaluate(f"S.settings.bg={{on:true,animate:false,style:'{style}',shape:'{shape}',intensity:100,speed:100}}; bgApply(); document.body.classList.add('only-bg')")
            img = Image.open(io.BytesIO(pg.screenshot())).convert('RGB'); px = list(img.resize((125, 90)).get_flattened_data() if hasattr(img, 'get_flattened_data') else img.resize((125, 90)).getdata())
            low = min(ratio(text, c) for c in px); worst = min(worst, low / min(4.5, t0 * 0.9))
            assert low >= min(4.5, t0 * 0.9) - 0.05, f'{th}/{style}/{shape}: worst rendered background gives text {low:.2f}:1 (theme itself {t0:.2f}:1)'
            pg.evaluate("document.body.classList.remove('only-bg')")
    assert not pg.errs, pg.errs; b.close()
print(f'background browser tests passed (rendered worst case {worst:.2f}x of the required contrast, {len(themes)} themes x 6 looks)')
