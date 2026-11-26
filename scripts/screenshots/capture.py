#!/usr/bin/env python3
"""Takes the screenshots of an OpenTick web app that is already unpacked in a folder (fetch-release.py puts the released one in <out>/site).

    python3 scripts/screenshots/capture.py --site .build/shots/site --out .build/shots/images

It serves the folder on 127.0.0.1, then for EVERY picture opens a brand-new browser profile (nothing remembered from any other picture), loads the demo data
(demo.js: invented names, lists, notes and dates, stored by the app itself), freezes the clock at Wednesday 18 November 2026 10:24, switches animations off, and takes a
genuine screenshot of the app, at a desktop size and a phone size. The pictures:

    dashboard  tasks  notes  calendar  habits  boards  sections  packs  integrations     ->  desktop-<name>.png and mobile-<name>.png, plus manifest.json

The capture stops with a message (exit code 1) if the app throws an error, logs a console error, tries to reach anything but this computer, or a picture comes out blank.
Needs Playwright with Chromium and Pillow. --only NAME[,NAME] takes just those pictures; --keep-going is not offered: one bad picture means the set is not trusted."""
import argparse, functools, hashlib, http.server, json, sys, threading
from datetime import datetime
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
NOW = datetime(2026, 11, 18, 10, 24)   # a Wednesday, so the calendar has days before and after today
KEY = 'opentick.v1'
VIEWPORTS = {'desktop': dict(width=1440, height=900, dsf=1, mobile=False), 'mobile': dict(width=390, height=844, dsf=2, mobile=True)}
FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'

# name -> (what to do in the page to get there, a text that must be on screen so a blank or wrong page is caught[, the same for a phone, where it differs])
SCENES = {
    'dashboard':    ("U.page = 'home'; render()", None),
    'tasks':        ("U.page = 'tasks'; U.list = 'today'; render()", 'Finish the quarterly report'),
    'notes':        ("U.page = 'notes'; U.noteSel = 'demo-n-trip'; render()", 'Weekend in Lisbon', "U.page = 'notes'; U.noteSel = null; render()", 'Weekend in Lisbon'),   # (a phone shows the list first)
    'calendar':     ("S.settings.cal.view = 'month'; U.page = 'calendar'; render()", None),
    'habits':       ("U.page = 'habits'; render()", 'Read for 20 minutes'),
    'boards':       ("U.page = 'kanban'; render()", 'Build the landing page'),
    'sections':     ("U.page = 'x-demo-reading'; render()", 'A Field Guide to Quiet'),
    'packs':        ("openSettings('sections')", 'Study planner'),
    'integrations': ("openSettings('integrations')", None),
}

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.webmanifest': 'application/manifest+json', '.js': 'text/javascript'}

def serve(folder):
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(folder)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

class Run:
    def __init__(self, browser, base, seed=None):
        self.browser, self.base, self.seed, self.problems = browser, base, seed, []
    def page(self, vp):
        v = VIEWPORTS[vp]
        kw = dict(viewport={'width': v['width'], 'height': v['height']}, device_scale_factor=v['dsf'], locale='en-GB', timezone_id='Europe/London', reduced_motion='reduce', service_workers='block', color_scheme='light')
        if v['mobile']: kw.update(has_touch=True, is_mobile=True)
        ctx = self.browser.new_context(**kw)           # a new context is a clean profile: no storage, no cookies, no cache
        def gate(route):                               # only this computer is reachable
            if route.request.url.startswith(self.base): route.continue_()
            else: self.problems.append('tried to reach ' + route.request.url[:100]); route.abort()
        ctx.route('**/*', gate)
        if self.seed: ctx.add_init_script(f"try {{ if (!localStorage.getItem({json.dumps(KEY)})) localStorage.setItem({json.dumps(KEY)}, {json.dumps(self.seed)}); }} catch (e) {{}}")
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: self.problems.append('page error: ' + str(e)))
        pg.on('console', lambda m: self.problems.append('console.error: ' + m.text[:200]) if m.type == 'error' else None)
        pg.clock.set_fixed_time(NOW)
        pg.goto(self.base + '/index.html'); pg.wait_for_selector('#main', state='attached'); pg.wait_for_timeout(400)
        pg.add_style_tag(content=FREEZE)
        return ctx, pg

def make_seed(run, pack_text):
    """Opens a clean profile, runs demo.js in the app, lets the app save, and returns what it stored."""
    ctx, pg = run.page('desktop')
    pg.evaluate((HERE / 'demo.js').read_text(encoding='utf-8'), {'pack': pack_text})
    pg.evaluate('flush()'); pg.wait_for_timeout(300)
    seed = pg.evaluate(f'localStorage.getItem({json.dumps(KEY)})'); version = pg.evaluate('window.OT && window.OT.version')
    ctx.close()
    if not seed or '"demo-' not in seed: sys.exit('ERROR: the app did not store the demo data.')
    return seed, version

def check_not_blank(path, what):
    c = Image.open(path).convert('RGB').resize((96, 60)).getcolors(1 << 16); colours = len(c) if c else 1 << 16
    if colours < 12: sys.exit(f'ERROR: {what} is blank or nearly blank ({colours} colours): the page did not draw.')

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--site', required=True); ap.add_argument('--out', required=True); ap.add_argument('--only', default='')
    a = ap.parse_args()
    site, out = Path(a.site).resolve(), Path(a.out).resolve()
    if not (site / 'index.html').is_file(): sys.exit(f'ERROR: {site / "index.html"} does not exist: unpack the web app there first (fetch-release.py).')
    names = [n for n in (a.only.split(',') if a.only else SCENES) if n]
    for n in names:
        if n not in SCENES: sys.exit(f'ERROR: no picture called {n!r}; the pictures are: {", ".join(SCENES)}')
    out.mkdir(parents=True, exist_ok=True)
    pack_text = (HERE / 'demo' / 'study-planner.pack.json').read_text(encoding='utf-8')
    srv = serve(site); base = f'http://127.0.0.1:{srv.server_address[1]}'
    manifest = {'viewports': {k: {'width': v['width'], 'height': v['height'], 'scale': v['dsf']} for k, v in VIEWPORTS.items()}, 'frozenAt': NOW.isoformat(), 'images': {}}
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            run = Run(b, base); seed, version = make_seed(run, pack_text); run.seed = seed; manifest['appVersion'] = version
            for vp in VIEWPORTS:
                for name in names:
                    sc = SCENES[name]; js, must = (sc[2], sc[3]) if vp == 'mobile' and len(sc) > 2 else (sc[0], sc[1])
                    ctx, pg = run.page(vp)
                    pg.evaluate(js); pg.wait_for_timeout(600)
                    if vp == 'desktop' and name == 'tasks': pg.locator('#main', has_text='Finish the quarterly report').locator('text=Finish the quarterly report').first.click(); pg.wait_for_timeout(500)
                    if must and not pg.get_by_text(must).first.is_visible(): sys.exit(f'ERROR: {vp}-{name}: the text {must!r} is not on screen, so the page is not the one expected.')
                    pg.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()"); pg.mouse.move(2, 2); pg.wait_for_timeout(150)   # nothing focused or hovered: no ring, no tooltip
                    path = out / f'{vp}-{name}.png'; pg.screenshot(path=str(path)); check_not_blank(path, path.name)
                    im = Image.open(path).convert('RGB'); im.save(path, optimize=True)
                    manifest['images'][path.name] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'size': list(im.size)}
                    ctx.close()
            b.close()
    finally:
        srv.shutdown()
    if run.problems:
        uniq = list(dict.fromkeys(run.problems))
        sys.exit('ERROR: the app misbehaved during the capture, so these pictures are not trusted:\n  ' + '\n  '.join(uniq[:12]))
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(f'captured {len(manifest["images"])} pictures of OpenTick {version} into {out}')

if __name__ == '__main__':
    main()
