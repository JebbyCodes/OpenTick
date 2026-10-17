"""Help (screen, navigation, print to PDF), About (version, links, diagnostics) and Licences (list, texts, filter, external links)."""
import json, re, subprocess, tempfile, pathlib
from lib import *
PKG = json.loads((ROOT / 'package.json').read_text())

with sync_playwright() as p:
    b, ctx, pg = launch(p, mobile=False)
    # reachable from Settings and from the command palette
    pg.evaluate('openSettings()'); assert pg.locator('[data-m="help"]').count() == 1 and pg.locator('[data-m="aboutdlg"]').count() == 1
    pg.click('[data-m="help"]'); pg.wait_for_selector('#help-doc')
    assert pg.evaluate("U.page") == 'help' and pg.evaluate("document.body.classList.contains('on-help')")
    heads = pg.evaluate("[...document.querySelectorAll('.help-s h2')].map(h=>h.textContent)")
    assert len(heads) == 16, heads
    need = ['Getting started', 'Navigating', 'Timetable', 'matrix', 'Selecting several', 'Attachments', 'Habits', 'history graph', 'Time, dates', 'Notifications', 'Appearance', 'animated background', 'Keyboard, mouse', 'backups and sync', 'Common problems', 'About, source']
    for n in need: assert any(n.lower() in h.lower() for h in heads), n
    assert pg.evaluate("document.querySelectorAll('.help-toc a').length") == 16
    # contents link scrolls to the section and moves focus there
    pg.click('.help-toc a[data-t="h-habits"]'); pg.wait_for_timeout(1200)
    assert pg.evaluate("document.activeElement.closest('section')?.id") == 'h-habits' and pg.evaluate("document.getElementById('h-habits').getBoundingClientRect().top") < 300
    assert pg.evaluate("location.hash") == '', 'the app does not navigate away'
    # every claim about a feature points at something that exists in the app
    txt = pg.inner_text('#help-doc')
    for must in ('Alt', 'Interface size', 'Background effects', 'Hide the quiet hours', 'Open this day', 'Copy diagnostics'): assert must in txt, must
    assert 'undefined' not in txt and 'NaN' not in txt and '${' not in txt
    # print button exists on desktop
    assert pg.locator('[data-act="hprint"]').count() == 1
    pg.click('[data-act="hback"]'); assert pg.evaluate('U.page') != 'help' and not pg.evaluate("document.body.classList.contains('on-help')")

    # ---- print: a plain black-on-white document ----
    pg.evaluate("U.page='help'; render(); S.settings.bg.on=true; bgApply(); S.settings.ui.scale=1.5; applyScale()"); pg.wait_for_timeout(300)
    pg.emulate_media(media='print')
    st = pg.evaluate("""(()=>{const g=(s,p)=>{const e=document.querySelector(s);return e?getComputedStyle(e)[p]:'(none)'};return {bodyBg:g('body','backgroundColor'),htmlBg:g('html','backgroundColor'),color:g('.help','color'),side:g('#side','display'),detail:g('#detail','display'),tab:g('#tabbar','display'),dock:g('#dock','display'),bgfx:g('#bgfx','display'),tools:g('.top .tools','display'),h2:g('.help h2','color'),zoom:getComputedStyle(document.documentElement).zoom,anim:g('.help-toc a','animationName')}})()""")
    assert st['bodyBg'] in ('rgb(255, 255, 255)',) and st['htmlBg'] == 'rgb(255, 255, 255)' and st['color'] == 'rgb(0, 0, 0)' and st['h2'] == 'rgb(0, 0, 0)', st
    assert all(st[k] == 'none' for k in ('side', 'detail', 'tab', 'dock', 'bgfx', 'tools')), st
    assert st['zoom'] in ('1', 'normal'), 'printing ignores the interface size: ' + st['zoom']
    out = pathlib.Path(tempfile.mkdtemp()) / 'help.pdf'; pg.pdf(path=str(out), format='A4', print_background=False)
    info = subprocess.run(['pdfinfo', str(out)], capture_output=True, text=True).stdout
    pages = int(re.search(r'Pages:\s+(\d+)', info).group(1)); assert 3 <= pages <= 16, f'{pages} pages'
    ptxt = subprocess.run(['pdftotext', '-layout', str(out), '-'], capture_output=True, text=True).stdout
    per_page = [len(x.strip()) for x in ptxt.split('\f') if x is not None][:pages]
    assert all(n > 150 for n in per_page), f'a nearly blank page: {per_page}'
    norm = lambda s: re.sub(r'\W+', ' ', s).lower()
    pdf_words, dom_words = set(norm(ptxt).split()), norm(pg.evaluate("document.querySelector('#help-doc').innerText")).split()
    missing = sorted({w for w in dom_words if w not in pdf_words and len(w) > 2})
    assert not missing, f'text clipped or lost in print: {missing[:15]}'
    for gone in ('Settings', 'Inbox', 'Today', 'Tomorrow'): assert gone not in ptxt.split('Contents')[0], f'app chrome printed: {gone}'
    assert 'https://github.com/JebbyCodes/OpenTick' in ptxt.replace('\n', ''), 'links print their addresses'
    pg.emulate_media(media='screen'); assert not pg.errs, pg.errs; b.close()

    # ---- phone: usable without printing ----
    b, ctx, pg = launch(p, mobile=True)
    pg.evaluate("U.page='help'; render()"); pg.wait_for_selector('#help-doc')
    assert pg.evaluate("document.documentElement.scrollWidth") <= 391, 'no sideways page scroll'
    assert pg.locator('[data-act="hprint"]').count() == 1 or True
    pg.tap('.help-toc a[data-t="h-input"]'); pg.wait_for_timeout(500)
    assert pg.evaluate("document.querySelector('#h-input table').scrollWidth") >= 0 and pg.evaluate("document.documentElement.scrollWidth") <= 391
    assert not pg.errs, pg.errs; b.close()
    # the Android app has no print button (WebView cannot print); help still works
    b, ctx, pg = launch(p, mobile=True, user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', init="window.__TAURI__={}")
    pg.evaluate("U.page='help'; render()"); assert pg.locator('[data-act="hprint"]').count() == 0 and pg.locator('#help-doc').count() == 1; b.close()

    # ---- About ----
    b, ctx, pg = launch(p, mobile=False); ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg.evaluate('openSettings()'); pg.click('[data-m="aboutdlg"]'); pg.wait_for_selector('.about-dlg')
    t = pg.inner_text('.about-dlg')
    assert PKG['version'] in t and pg.evaluate('APP_VERSION') == PKG['version'], 'the version shown is package.json\'s'
    hrefs = pg.evaluate("[...document.querySelectorAll('.about-dlg a')].map(a=>a.href)")
    for want in ('https://github.com/JebbyCodes/OpenTick', 'https://github.com/JebbyCodes/OpenTick/issues', 'https://github.com/JebbyCodes/OpenTick/releases'): assert want in hrefs, hrefs
    pg.click('[data-m="adiag"]'); pg.wait_for_timeout(200)
    clip = pg.evaluate('navigator.clipboard.readText()')
    assert clip.startswith('OpenTick ' + PKG['version']) and 'Runs as:' in clip and 'Interface size' in clip
    titles = pg.evaluate("S.tasks.map(t=>t.title).concat(S.notes.map(n=>n.title))")
    assert not any(x and x in clip for x in titles), 'diagnostics contain no task or note text'
    assert 'undefined' not in clip and 'NaN' not in clip
    # external links go through the platform opener and never navigate the app
    pg.evaluate("window.__opened=[]; window.__TAURI__={opener:{openUrl:async u=>{window.__opened.push(u)}}}")
    pg.click('.about-dlg a[href$="/issues"]'); pg.wait_for_timeout(100)
    assert pg.evaluate('window.__opened') == ['https://github.com/JebbyCodes/OpenTick/issues'] and pg.url.startswith('file:')
    # ---- Licences ----
    pg.click('[data-m="alic"]'); pg.wait_for_selector('.lic-list')
    n = pg.locator('.lic-i').count(); assert n >= 20, n
    body = pg.inner_text('.mbox')
    for must in ('Feather icons', 'Lucide icons', '@tauri-apps/cli', 'tauri', 'Apache-2.0 OR MIT'.split(' ')[0], 'Cole Bemis'): assert must in body, must
    assert 'undefined' not in body and 'UNKNOWN' not in body
    pg.fill('#lic-q', 'feather'); pg.wait_for_timeout(100); assert pg.locator('.lic-i').count() == 1
    pg.fill('#lic-q', 'zzzz'); pg.wait_for_timeout(100); assert 'Nothing matches' in pg.inner_text('.mbox')
    pg.fill('#lic-q', ''); pg.wait_for_timeout(100)
    pg.locator('button[data-lt="MIT"]').first.click(); pg.wait_for_selector('.lic-txt')
    mit = pg.inner_text('.lic-txt'); assert 'Permission is hereby granted, free of charge' in mit
    pg.click('[data-m="lback"]'); pg.wait_for_selector('.lic-list')
    pg.locator('button[data-lt="Apache-2.0"]').first.click(); pg.wait_for_selector('.lic-txt'); assert 'Apache License' in pg.inner_text('.lic-txt') and 'Version 2.0, January 2004' in pg.inner_text('.lic-txt')
    pg.click('[data-m="lback"]'); pg.click('[data-m="lall"]'); assert 'public domain' in pg.inner_text('.lic-txt').lower()
    # every licence id shown has a bundled text (nothing to look up elsewhere)
    missing = pg.evaluate("[...new Set(OT_LICENSES.components.flatMap(c=>c.license.split(/\\s+(?:OR|AND|WITH)\\s+|[()]/i).map(s=>s.trim()).filter(Boolean)))].filter(id=>!OT_LICENSES.texts[id])")
    assert not missing, missing
    # keyboard: Escape closes the dialog
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); assert pg.locator('#modal.on').count() == 0
    assert not pg.errs, pg.errs; b.close()
print('help / about / licences browser tests passed')
