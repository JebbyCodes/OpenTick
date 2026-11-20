"""0.9: the pack library in the real UI. Type a code (any case, no dash) in Settings -> Sections & packs, look at the pack, add it; an unknown
code and a library that cannot be reached give a plain message; Browse lists, searches and filters, marks what is installed and goes back to
where it was; a link with ?pack=CODE opens the pack; nothing is requested until you ask; the dialogs fit a phone.
The library is played by the test (the requests to its address are answered from test/fixtures/packs), so no network is needed."""
import hashlib, json, pathlib
from lib import *

BASE = 'https://jebbycodes.github.io/OpenTick-Packs/'
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
                 'sections': len(j.get('sections', [])), 'themes': len(j.get('themes', [])), 'entries': sum(len(s.get('entries', [])) for s in j.get('sections', [])), 'tags': (['themes'] if j.get('themes') else ['home', 'study']), 'size': len(text.encode()), 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'updated': '2026-11-18'})
INDEX = json.dumps({'opentick': 'pack-index', 'format': 1, 'updated': '2026-11-19', 'packs': ROWS})
CODE = {r['id']: r['code'] for r in ROWS}

def serve(ctx, state):
    def handler(route):
        url = route.request.url; state['urls'].append(url); path = url[len(BASE):]
        if state['down']: return route.abort()
        body = INDEX if path == 'index.json' else SERVED.get(path)
        h = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
        if body is None: return route.fulfill(status=404, headers=h, body='')
        route.fulfill(status=200, headers=h, body=body)
    ctx.route(BASE + '**', handler)

def settings(pg):
    pg.evaluate("openSettings('sections')"); pg.wait_for_selector('#pkl-code'); pg.wait_for_timeout(150)

def fits(pg, sel='#modal .mbox'):
    r = pg.evaluate("(s)=>{const b=document.querySelector(s); if(!b) return null; const w=document.documentElement.clientWidth; const bad=[...b.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && (r.right>w+1||r.left<-1)}).map(e=>e.className||e.tagName); return {sw:b.scrollWidth,cw:b.clientWidth,bad:bad.slice(0,5)}}", sel)
    assert r and r['sw'] <= r['cw'] + 1 and not r['bad'], ('the dialog fits the screen', r)

def run(mobile):
    with sync_playwright() as p:
        b, ctx, pg = launch(p, mobile=mobile, w=390 if mobile else 1280, h=780 if mobile else 850)
        st = {'urls': [], 'down': False}; serve(ctx, st)
        tap = (lambda s: pg.tap(s)) if mobile else (lambda s: pg.click(s))
        settings(pg)
        assert st['urls'] == [], 'opening Settings asks the library nothing'
        assert 'pack library' in pg.inner_text('#modal').lower() and pg.locator('#modal [data-m=pklib]').count() == 1
        # ---- type a code the way people do: lower case, no dash ----
        pg.fill('#pkl-code', ''); pg.type('#pkl-code', CODE['study-planner'].replace('-', '').lower())
        assert pg.input_value('#pkl-code') == CODE['study-planner'], ('it is tidied as it is typed', pg.input_value('#pkl-code'))
        tap('#modal [data-m=pkgo]'); pg.wait_for_selector('#modal [data-m=ok]:has-text("Add to OpenTick")'); pg.wait_for_timeout(200)
        txt = pg.inner_text('#modal'); assert 'Study planner' in txt and CODE['study-planner'] in txt and 'Version' in txt, txt
        assert [u[len(BASE):] for u in st['urls']] == ['index.json', 'packs/study-planner.json'], st['urls']
        assert pg.evaluate("S.csections.length") == 0, 'nothing is added until you say so'
        fits(pg)
        tap('#modal [data-m=ok]'); pg.wait_for_timeout(400)
        assert pg.evaluate("S.csections.length") == 1 and pg.evaluate("S.csections[0].packId") == 'study-planner'
        assert not pg.locator('#modal.on').count(), 'the dialog closes and the new section is shown'
        # ---- an unknown code, a malformed one, and the library not being reachable ----
        pg.evaluate("openSettings('sections')"); pg.wait_for_selector('#pkl-code')
        pg.fill('#pkl-code', 'zzzzzzzz'); tap('#modal [data-m=pkgo]'); pg.wait_for_selector('#pkl-e.bad'); assert 'No pack has the code ZZZZ-ZZZZ' in pg.inner_text('#pkl-e'), pg.inner_text('#pkl-e')
        pg.fill('#pkl-c', 'abc'); tap('#pkl-ok'); pg.wait_for_timeout(150); assert '8 letters and digits' in pg.inner_text('#pkl-e')
        pg.fill('#pkl-c', ''); tap('#pkl-ok'); pg.wait_for_timeout(150); assert 'Type the pack' in pg.inner_text('#pkl-e')
        fits(pg)
        st['down'] = True; PKL_RESET = "PKL.idx=null; PKL.at=0"; pg.evaluate(PKL_RESET)
        pg.fill('#pkl-c', CODE['garden-journal']); tap('#pkl-ok'); pg.wait_for_selector('#pkl-e.bad'); assert 'Could not reach the pack library' in pg.inner_text('#pkl-e'), pg.inner_text('#pkl-e')
        assert pg.evaluate("document.getElementById('pkl-ok').disabled") is False, 'you can try again'
        st['down'] = False; tap('#pkl-ok'); pg.wait_for_selector('#modal [data-m=ok]:has-text("Add to OpenTick")'); assert 'Garden' in pg.inner_text('#modal') or 'garden' in pg.inner_text('#modal').lower()
        tap('#modal [data-m=no]'); pg.wait_for_timeout(250); assert pg.evaluate("S.csections.length") == 1, 'Cancel adds nothing'
        # ---- browse ----
        pg.evaluate("openSettings('sections')"); pg.wait_for_selector('#pkl-code'); tap('#modal [data-m=pklib]'); pg.wait_for_selector('#pkl-list .pkl-row')
        assert pg.locator('#pkl-list .pkl-row').count() == len(ROWS), pg.locator('#pkl-list .pkl-row').count()
        sp = pg.locator(f'#pkl-list .pkl-row[data-code="{CODE["study-planner"]}"]'); assert 'Installed' in sp.inner_text(), 'what is already added is marked'
        fits(pg)
        pg.fill('#pkl-q', 'garden'); pg.wait_for_timeout(150); assert pg.locator('#pkl-list .pkl-row').count() == 1 and 'Garden' in pg.inner_text('#pkl-list')
        pg.fill('#pkl-q', 'zzzz nothing'); pg.wait_for_timeout(150); assert pg.locator('#pkl-list .pkl-row').count() == 0 and 'Nothing matches' in pg.inner_text('#pkl-list')
        pg.fill('#pkl-q', CODE['calm-themes'].lower()); pg.wait_for_timeout(150); assert pg.locator('#pkl-list .pkl-row').count() == 1, 'a code in the search box finds its pack'
        pg.fill('#pkl-q', ''); tap('#pkl-chips [data-chip=kind][data-v=themes]'); pg.wait_for_timeout(150); rows = pg.locator('#pkl-list .pkl-row'); assert rows.count() == 1 and 'themes' in pg.inner_text('#pkl-list').lower()
        tap('#pkl-chips [data-chip=kind][data-v=all]'); pg.wait_for_timeout(100); assert pg.locator('#pkl-list .pkl-row').count() == len(ROWS)
        tap('#pkl-list .pkl-row >> nth=0'); pg.wait_for_selector('#modal [data-m=ok]:has-text("Add to OpenTick")'); fits(pg)
        tap('#modal [data-m=no]'); pg.wait_for_selector('#pkl-list .pkl-row'); assert pg.locator('#pkl-list .pkl-row').count() == len(ROWS), 'Cancel on a pack goes back to the list'
        # the library gone: a message and Try again
        st['down'] = True; tap('#modal [data-m=pkref]'); pg.wait_for_selector('#pkl-list .pkl-msg.bad'); assert 'Could not reach' in pg.inner_text('#pkl-list')
        st['down'] = False; tap('#pkl-list [data-m=pkref]'); pg.wait_for_selector('#pkl-list .pkl-row')
        tap('#modal [data-m=no]'); pg.wait_for_timeout(200)
        assert pg.locator('#modal.on #pkl-code').count() == 1, 'Close goes back to Settings'
        bad = [e for e in pg.errs if 'ERR_FAILED' not in e]; assert not bad, bad  # (the two aborted requests are the test pulling the plug on purpose)
        assert len([e for e in pg.errs if 'ERR_FAILED' in e]) <= 3
        b.close()

    # ---- a link with ?pack=CODE opens that pack, and the address is tidied ----
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1280, 'height': 850}); st = {'urls': [], 'down': False}; serve(ctx, st)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('file://' + DIST + '?pack=' + CODE['calm-themes'].lower()); pg.wait_for_selector('#modal [data-m=ok]:has-text("Add to OpenTick")', timeout=15000)
        assert 'Calm' in pg.inner_text('#modal') or 'calm' in pg.inner_text('#modal').lower(); assert 'pack=' not in pg.url, pg.url
        pg.click('#modal [data-m=ok]'); pg.wait_for_timeout(300); assert pg.evaluate("S.settings.customThemes.length") >= 1
        assert not errs, errs; b.close()

run(False)
run(True)
print('pack library passed in the real UI (code box, unknown and unreachable, browse and search, installed marks, ?pack= link; desktop and phone)')
