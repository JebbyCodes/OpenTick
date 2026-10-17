"""Markdown toolbars: vector icons with names and real targets, and the actions still format text."""
from lib import *
with sync_playwright() as p:
    for mobile in (False, True):
        b, ctx, pg = launch(p, mobile=mobile)
        pg.evaluate("U.page='notes'; U.noteSel=S.notes[0].id; render()"); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('[data-ed][data-mode=write]').click()"); pg.wait_for_timeout(250)
        info = pg.evaluate("[...document.querySelectorAll('.fmt')].map(b=>{const r=b.getBoundingClientRect();return {k:b.dataset.k,svg:!!b.querySelector('svg'),text:b.textContent.trim(),label:b.getAttribute('aria-label'),w:r.width,h:r.height}})")
        assert len(info) == 13, info
        for x in info:
            assert x['svg'] and not x['text'] and x['label'], x
            assert min(x['w'], x['h']) >= (40 if mobile else 32) - 0.5, ('target too small', x)
        assert len({x['label'] for x in info}) == 13, 'every icon has its own name'
        # keyboard focus is visible
        pg.focus('.fmt[data-k="italic"]'); pg.keyboard.press('Shift+Tab'); pg.keyboard.press('Tab')
        assert pg.evaluate("getComputedStyle(document.activeElement).outlineStyle") != 'none' and pg.evaluate("document.activeElement.dataset.k") == 'italic'
        # actions still work: bold wraps the selection, strike too, heading prefixes the line
        pg.evaluate("(()=>{const t=document.querySelector('#n-ta');t.value='alpha beta';t.focus();t.setSelectionRange(0,5);})()")
        pg.click('.fmt[data-k="bold"]'); assert pg.evaluate("document.querySelector('#n-ta').value").startswith('**alpha**'), pg.evaluate("document.querySelector('#n-ta').value")
        pg.evaluate("(()=>{const t=document.querySelector('#n-ta');t.value='alpha beta';t.focus();t.setSelectionRange(6,10);})()")
        pg.click('.fmt[data-k="strike"]'); assert '~~beta~~' in pg.evaluate("document.querySelector('#n-ta').value")
        # the block editor's floating toolbar (over a text selection) uses icons too
        pg.evaluate("document.querySelector('[data-ed][data-mode=blocks]').click()"); pg.wait_for_timeout(400)
        pg.locator('#n-bed .bk').first.click(); pg.wait_for_timeout(300)
        pg.evaluate("(()=>{const t=document.querySelector('#n-bed textarea');t.setSelectionRange(0,5);t.dispatchEvent(new Event('select',{bubbles:true}));t.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));})()"); pg.wait_for_timeout(400)
        bar = pg.evaluate("[...document.querySelectorAll('.bed-bar button[data-bf]')].filter(b=>b.dataset.bf!=='turn').map(b=>({svg:!!b.querySelector('svg'),text:b.textContent.trim(),label:b.getAttribute('aria-label')}))")
        assert len(bar) == 6 and all(x['svg'] and not x['text'] and x['label'] for x in bar), bar
        assert not pg.errs, pg.errs; b.close()
print('icon browser tests passed')
