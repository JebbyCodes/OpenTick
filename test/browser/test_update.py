"""0.7.0: the update check is off by default (no request at all), and works from Settings -> About & privacy."""
import json
from lib import *

def api(reqs, tag):
    def handler(route):
        reqs.append(route.request.url)
        route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'},
                      body=json.dumps({'tag_name': tag, 'html_url': f'https://github.com/JebbyCodes/OpenTick/releases/tag/{tag}'}))
    return handler

with sync_playwright() as p:
    for mobile in (False, True):
        b, ctx, pg = launch(p, mobile=mobile)
        reqs = []; ctx.route('https://api.github.com/**', api(reqs, 'v99.0.0'))
        pg.wait_for_timeout(1500)
        assert not reqs, f'no request is made until asked: {reqs}'
        pg.evaluate("openSettings('about')"); pg.wait_for_timeout(300)
        assert pg.evaluate("S.settings.upd.auto") is False
        box = pg.locator('[data-upd=auto]'); assert not box.is_checked(), 'off by default'
        assert 'Not checked yet' in pg.inner_text('#upd .updst')
        pg.locator('[data-updact=check]').click(); pg.wait_for_timeout(600)
        assert len(reqs) == 1, reqs
        st = pg.inner_text('#upd .updst'); assert 'Version 99.0.0 is available' in st, st
        assert pg.evaluate("S.settings.upd.auto") is False, 'checking by hand does not turn the automatic check on'
        pg.screenshot(path=f'/tmp/claude-0/-home-claude/da1f3941-7fd6-5dd8-8906-6c2b051e6940/scratchpad/shots/update-{"phone" if mobile else "desk"}.png')
        # the automatic check: one request straight away, an announcement, and it stays off after a reload only if it was turned off
        box.check(); pg.wait_for_timeout(1200)
        assert pg.evaluate("S.settings.upd.auto") is True and len(reqs) == 2, reqs
        assert 'OpenTick 99.0.0 is available' in pg.inner_text('#toast'), pg.inner_text('#toast')
        box.uncheck(); pg.wait_for_timeout(300)
        assert pg.evaluate("S.settings.upd.auto") is False
        assert pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        assert not pg.errs, pg.errs; b.close()
    # a failing network: the page says so and nothing is stored as an update
    b, ctx, pg = launch(p, mobile=False)
    ctx.route('https://api.github.com/**', lambda r: r.abort())
    pg.evaluate("openSettings('about')"); pg.wait_for_timeout(300)
    pg.locator('[data-updact=check]').click(); pg.wait_for_timeout(600)
    assert 'Could not reach GitHub' in pg.inner_text('#upd .updst'), pg.inner_text('#upd .updst')
    assert pg.evaluate("S.settings.upd.found") == ''
    b.close()
print('test_update: ok')
