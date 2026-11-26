"""0.9.1 (Part H): the opt-in pack usage count in the real UI. It is OFF until the person turns it on in Settings -> Sections & packs; nothing is sent while it is off
(adding a pack, browsing and saving entries included); once on, the first real use of a library pack (saving an entry, ticking one, choosing one of its colour themes) sends
exactly { pack, token } to the address the library publishes, once; a pack from a file is never counted; the setting survives a reload; turning it off stops it; the Settings
text and the dialogs fit a phone. The library and its usage service are played by the test, so no network is needed."""
import hashlib, json, pathlib
from lib import *

BASE = 'https://jebbycodes.github.io/OpenTick-Packs/'
USAGE = 'https://opentick-usage.example.workers.dev'
FIX = ROOT / 'test' / 'fixtures' / 'packs'
AL = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

def code_of(pid):
    n = int.from_bytes(hashlib.sha256(('opentick-pack:' + pid).encode()).digest()[:5], 'big'); s = ''
    for _ in range(8): s = AL[n & 31] + s; n >>= 5
    return s[:4] + '-' + s[4:]

SERVED, ROWS = {}, []
for f in sorted(FIX.glob('*.json')):
    text = f.read_text(); j = json.loads(text); pid = f.stem; SERVED['packs/' + f.name] = text
    ROWS.append({'code': code_of(pid), 'id': pid, 'file': 'packs/' + f.name, 'name': j['name'], 'version': j['version'], 'author': j['author'], 'description': j['description'], 'license': j['license'],
                 'sections': len(j.get('sections', [])), 'themes': len(j.get('themes', [])), 'entries': sum(len(s.get('entries', [])) for s in j.get('sections', [])), 'tags': []})
INDEX = json.dumps({'opentick': 'pack-index', 'format': 1, 'updated': '2026-11-19', 'packs': ROWS, 'usage': USAGE})
CODE = {r['id']: r['code'] for r in ROWS}
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'}

def serve(ctx, st):
    def lib(route):
        path = route.request.url[len(BASE):]; body = INDEX if path == 'index.json' else SERVED.get(path); st['lib'].append(path)
        h = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
        if body is None: return route.fulfill(status=404, headers=h, body='')
        route.fulfill(status=200, headers=h, body=body)
    def usage(route):
        r = route.request
        if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
        st['use'].append({'method': r.method, 'url': r.url, 'body': r.post_data, 'headers': {k.lower(): v for k, v in r.headers.items()}})
        route.fulfill(status=st['reply'], headers=CORS, body='')
    ctx.route(BASE + '**', lib); ctx.route(USAGE + '/**', usage)

def fits(pg, sel='#modal .mbox'):
    r = pg.evaluate("(s)=>{const b=document.querySelector(s); if(!b) return null; const w=document.documentElement.clientWidth; const bad=[...b.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && (r.right>w+1 || r.left<-1)}).map(e=>e.className||e.tagName).slice(0,5); return {sw:b.scrollWidth,cw:b.clientWidth,bad}}", sel)
    assert r and r['sw'] <= r['cw'] + 1 and not r['bad'], ('the dialog fits the screen', r)

def add_from_library(pg, tap, pid):
    pg.evaluate("openSettings('sections')"); pg.wait_for_selector('#pkl-code'); pg.fill('#pkl-code', CODE[pid]); tap('#modal [data-m=pkgo]')
    pg.wait_for_selector('#modal [data-m=ok]:has-text("Add to OpenTick")'); tap('#modal [data-m=ok]'); pg.wait_for_timeout(450)

def new_entry(pg, tap, title):
    tap('[data-act=xsadd]'); pg.wait_for_selector('#modal [data-k=title]'); pg.fill('#modal [data-k=title]', title); tap('#modal [data-m=save]'); pg.wait_for_timeout(350)
    assert not pg.locator('#modal.on').count(), ('the entry saved', pg.inner_text('#modal') if pg.locator('#modal.on').count() else '')

def run(mobile):
    with sync_playwright() as p:
        b, ctx, pg = launch(p, mobile=mobile, w=390 if mobile else 1280, h=780 if mobile else 850)
        st = {'lib': [], 'use': [], 'reply': 204}; serve(ctx, st)
        tap = (lambda s: pg.tap(s)) if mobile else (lambda s: pg.click(s))
        # ---- off: it says so, and nothing is sent however a pack is used ----
        pg.evaluate("openSettings('sections')"); pg.wait_for_selector('#pkl-code'); pg.wait_for_timeout(150)
        txt = pg.inner_text('#modal'); assert 'pack usage counts' in txt.lower() and 'Counting is off' in txt and 'Nothing is sent' in txt, txt
        assert pg.locator('#modal [data-m=pkstog]').inner_text().strip() == 'Turn on'; assert pg.evaluate("S.settings.packStats") is None, 'no state until the person chooses'
        fits(pg, '#modal .stab:not([hidden])')
        pg.evaluate("document.querySelector('.pkst-d').open = true"); fits(pg, '#modal .stab:not([hidden])'); t2 = pg.inner_text('#modal .pkst-d'); assert 'Never sent' in t2 and 'random code' in t2 and 'IP address' in t2
        pg.evaluate("document.querySelector('.pkst-d').open = false")
        add_from_library(pg, tap, 'study-planner'); assert pg.evaluate("S.csections.length") == 1
        new_entry(pg, tap, 'Revise chapter 3'); pg.wait_for_timeout(300)
        assert st['use'] == [], ('off: saving an entry of a library pack sends nothing', st['use']); assert pg.evaluate("S.settings.packStats") is None
        # ---- turn it on: asks only for the public index (to learn the address), counts nothing yet ----
        pg.evaluate("openSettings('sections')"); pg.wait_for_selector('[data-m=pkstog]'); n0 = len(st['lib']); tap('#modal [data-m=pkstog]'); pg.wait_for_timeout(500)
        assert pg.evaluate("S.settings.packStats.on") is True and pg.evaluate("S.settings.packStats.url") == USAGE, pg.evaluate("S.settings.packStats")
        assert set(st['lib'][n0:]) <= {'index.json'}, ('turning it on asks the library for at most its public index (it may already have it) and nothing else', st['lib'][n0:])
        assert st['use'] == [], 'turning it on sends nothing: only use does'
        pg.evaluate("openSettings('sections')"); pg.wait_for_selector('[data-m=pkstog]'); txt = pg.evaluate("document.querySelector('#modal').textContent"); assert 'Counting is on' in txt and 'opentick-usage.example.workers.dev' in txt, txt  # (the address is in the closed details: textContent)
        assert pg.locator('#modal [data-m=pkstog]').inner_text().strip() == 'Turn off'; fits(pg, '#modal .stab:not([hidden])')
        pg.evaluate("closeModal()"); pg.wait_for_timeout(200)
        # ---- a real use: a new entry in the pack's section ----
        pg.evaluate("U.page = S.csections[0].id; render()"); pg.wait_for_selector('[data-act=xsadd]')
        new_entry(pg, tap, 'Past papers'); pg.wait_for_timeout(500)
        assert len(st['use']) == 1, st['use']; u = st['use'][0]; body = json.loads(u['body'])
        assert u['method'] == 'POST' and u['url'] == USAGE + '/use'; assert sorted(body) == ['pack', 'token'] and body['pack'] == 'study-planner' and len(body['token']) == 32, body
        assert 'Past papers' not in u['body'] and 'Revise' not in u['body'], 'no entry text is sent'
        for h in ('cookie', 'authorization'): assert h not in u['headers'], ('no identifying header', u['headers'])
        sp = pg.evaluate("S.settings.packStats"); assert sp['pend'] == {} and 'study-planner' in sp['done'], sp
        assert body['token'] not in json.dumps(pg.evaluate("[localStorage.getItem('opentick'), Object.keys(localStorage).map(k => localStorage.getItem(k))]")), 'the token is not left on the device once it is received'
        new_entry(pg, tap, 'More'); pg.wait_for_timeout(300); assert len(st['use']) == 1, 'once per pack on this device'
        # ---- ticking counts for a second pack; a pack from a file is not counted ----
        pg.evaluate("S.csections.forEach(s => s.checkable = true); save()")
        add_from_library(pg, tap, 'home-maintenance'); pg.wait_for_selector('[data-act=xsadd]'); new_entry(pg, tap, 'Check the boiler'); pg.wait_for_timeout(500)
        assert len(st['use']) == 2 and json.loads(st['use'][1]['body'])['pack'] == 'home-maintenance', st['use']
        assert json.loads(st['use'][1]['body'])['token'] != body['token'], 'every pack has its own token'
        pg.evaluate("packInstall(packParse(%s).pack, { kind: 'file' })" % json.dumps((FIX / 'garden-journal.json').read_text())); pg.wait_for_timeout(200)
        pg.evaluate("U.page = S.csections.find(s => s.packId === 'garden-journal').id; render()"); pg.wait_for_selector('[data-act=xsadd]')
        new_entry(pg, tap, 'Sow the beans'); pg.wait_for_timeout(400); assert len(st['use']) == 2, ('a pack from a file is never counted', st['use'])
        # ---- a colour theme from a library pack ----
        add_from_library(pg, tap, 'calm-themes'); assert len(st['use']) == 2, 'adding a pack is not use'
        pg.evaluate("openSettings('appearance')"); pg.wait_for_selector('#thsec .ct-sel'); tap('#thsec .ct-sel >> nth=0'); pg.wait_for_timeout(500)
        assert len(st['use']) == 3 and json.loads(st['use'][2]['body'])['pack'] == 'calm-themes', st['use']
        # ---- the setting is kept across a reload; the counted packs are not counted again ----
        pg.evaluate("flush && flush()"); pg.reload(); pg.wait_for_selector('#main'); pg.wait_for_timeout(300)
        assert pg.evaluate("S.settings.packStats.on") is True and sorted(pg.evaluate("Object.keys(S.settings.packStats.done)")) == ['calm-themes', 'home-maintenance', 'study-planner']
        pg.evaluate("U.page = S.csections.find(s => s.packId === 'study-planner').id; render()"); pg.wait_for_selector('[data-act=xsadd]'); new_entry(pg, tap, 'After reload'); pg.wait_for_timeout(300)
        assert len(st['use']) == 3, 'still counted once'
        # ---- the service is down: nothing is lost, nothing is shown, and the count goes through later ----
        st['reply'] = 503
        add_from_library(pg, tap, 'garden-journal'); pg.evaluate("U.page = S.csections.filter(s => s.packId === 'garden-journal' && s.pack).pop().id; render()")
        # (a second copy of garden-journal from the library: its record is a library one now, so its first use counts)
        pg.wait_for_selector('[data-act=xsadd]'); new_entry(pg, tap, 'Water the ferns'); pg.wait_for_timeout(500)
        assert len(st['use']) == 4, st['use']; pend = pg.evaluate("S.settings.packStats.pend"); assert list(pend) == ['garden-journal'] and pend['garden-journal']['next'] > 0, pend
        assert not pg.locator('.toast.on, #toast.on').count() or 'count' not in (pg.evaluate("document.querySelector('.toast, #toast') && document.querySelector('.toast, #toast').innerText") or '').lower(), 'a failed count is never shown as an error'
        st['reply'] = 204; pg.evaluate("S.settings.packStats.pend['garden-journal'].next = 0; pkstFlush()"); pg.wait_for_timeout(500)
        assert len(st['use']) == 5 and st['use'][4]['body'] == st['use'][3]['body'], 'the retry carries the very same pack and token'
        assert pg.evaluate("S.settings.packStats.pend") == {} and 'garden-journal' in pg.evaluate("S.settings.packStats.done")
        # ---- off again: nothing more is sent ----
        pg.evaluate("openSettings('sections')"); pg.wait_for_selector('[data-m=pkstog]'); tap('#modal [data-m=pkstog]'); pg.wait_for_timeout(300)
        assert pg.evaluate("S.settings.packStats.on") is False and pg.evaluate("S.settings.packStats.url") == ''
        pg.evaluate("openSettings('sections')"); pg.wait_for_selector('[data-m=pkstog]'); assert 'Counting is off' in pg.inner_text('#modal'); fits(pg, '#modal .stab:not([hidden])'); pg.evaluate("closeModal()")
        pg.evaluate("U.page = S.csections.find(s => s.packId === 'study-planner').id; render()"); pg.wait_for_selector('[data-act=xsadd]'); new_entry(pg, tap, 'Off again'); pg.wait_for_timeout(300)
        assert len(st['use']) == 5, 'off: nothing more'
        bad = [e for e in pg.errs if not ('503' in e and USAGE + '/use' in e)]; assert not bad, bad  # (the browser logs the 503 the test sends on purpose; the app logs and throws nothing)
        assert len([e for e in pg.errs if '503' in e]) <= 2
        b.close()

run(False)
run(True)
print('pack usage counts passed in the real UI (off by default, nothing sent until real use, exactly pack + token, once per pack, file packs never, themes, reload, service down and retry, off again; desktop and phone)')
