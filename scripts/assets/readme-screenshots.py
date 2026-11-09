#!/usr/bin/env python3
"""Makes the screenshots the README shows, from the current build, with made-up demo data and a fixed date, so they can be remade any time:

    npm run build:app && python3 scripts/assets/readme-screenshots.py

Writes docs/images/{tasks,calendar,timeline,pins,sound,watch}.png. Needs Playwright with Chromium and Pillow (the browser tests use both).
Nothing in the demo data is real: names, lists and dates are invented here."""
import io, math, pathlib, struct, sys, wave
from datetime import datetime
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
DIST = ROOT / 'dist' / 'index.html'
OUT = ROOT / 'docs' / 'images'
NOW = datetime(2026, 11, 18, 10, 24)   # a Wednesday, so the week view has days before and after today

# ---- the demo data (runs inside the app) ------------------------------------------------------------------------------------------
DEMO = r"""(() => {
  const d = n => ymd(addDays(new Date(), n)), now = Date.now();
  const mk = (id, title, o = {}) => ({ id: 'demo-' + id, title, notes: '', listId: 'inbox', due: null, time: null, priority: 0, tags: [], subtasks: [], repeat: null, reminder: null, status: 'open', section: null, created: now, order: 0, ...o });
  const st = (id, title, done) => ({ id: 'demo-s' + id, title, done });
  S.lists = [
    { id: 'inbox', name: 'Inbox', color: '#4772fa', sections: [] },
    { id: 'personal', name: 'Personal', color: '#f4a62a', sections: [] },
    { id: 'work', name: 'Work', color: '#34b36b', sections: ['To Do', 'Doing', 'Done'], view: 'kanban' },
    { id: 'study', name: 'Study', color: '#8e5cf7', sections: [] },
  ];
  S.projects = [{ id: 'demo-site', name: 'Website relaunch', color: '#34b36b', listIds: ['work'], created: now }, { id: 'demo-flat', name: 'Moving flat', color: '#f4a62a', listIds: ['personal'], created: now }];
  const T = [
    mk('report', 'Finish the quarterly report', { due: d(0), time: '11:00', dur: 90, priority: 3, listId: 'work', section: 'Doing', tags: ['report'], subtasks: [st(1, 'Collect the figures', true), st(2, 'Write the summary', true), st(3, 'Check the charts', false)] }),
    mk('sam', 'Reply to Sam about the venue', { due: d(0), time: '12:30', dur: 15, priority: 2, listId: 'inbox' }),
    mk('plants', 'Water the plants', { due: d(0), time: '08:00', dur: 15, listId: 'personal', repeat: { every: 3, unit: 'day' }, status: 'done', doneAt: now - 7200000 }),
    mk('dentist', 'Book a dentist appointment', { due: d(0), priority: 2, listId: 'personal' }),
    mk('cards', 'Revise chapter 6 flashcards', { due: d(0), time: '16:00', dur: 45, listId: 'study', tags: ['revision'] }),
    mk('parcel', 'Pick up the parcel', { due: d(0), time: '18:15', dur: 30, priority: 1, listId: 'personal' }),
    mk('insurance', 'Renew the car insurance', { due: d(-1), priority: 3, listId: 'personal', tags: ['bills'] }),
    mk('retro', 'Team retrospective', { due: d(1), time: '15:00', dur: 60, listId: 'work', section: 'To Do' }),
    mk('essay', 'Outline the history essay', { due: d(2), listId: 'study', tags: ['revision'] }),
    mk('boxes', 'Label the boxes for the move', { due: d(3), listId: 'personal' }),
    // a plan for the timeline
    mk('g1', 'Design review', { listId: 'work', section: 'Done', start: d(-9), due: d(-3), astart: d(-9), status: 'done', doneAt: now - 3 * 86400000 }),
    mk('g2', 'Write the new copy', { listId: 'work', section: 'Doing', start: d(-4), due: d(4), astart: d(-3) }),
    mk('g3', 'Build the landing page', { listId: 'work', section: 'Doing', start: d(-1), due: d(9), astart: d(-1) }),
    mk('g4', 'Test on phones and tablets', { listId: 'work', section: 'To Do', start: d(7), due: d(13) }),
    mk('g5', 'Launch', { listId: 'work', section: 'To Do', start: d(14), due: d(14), priority: 3 }),
    mk('g6', 'Pack the kitchen', { listId: 'personal', start: d(2), due: d(6) }),
    mk('g7', 'Hire the van', { listId: 'personal', start: d(8), due: d(8), priority: 2 }),
  ];
  T.forEach((t, i) => { t.order = i * 1000; });
  S.tasks = T; S.notes = [];
  const dow = new Date().getDay(); // the week view shows a lesson timetable
  const slot = (id, title, days, start, end, color, room) => ({ id: 'demo-sl' + id, title, days, start, end, color, loc: room || '', notes: '', remind: null, created: now });
  S.slots = [slot(1, 'Algorithms lecture', [1, 3], '09:00', '10:30', '#4772fa', 'B12'), slot(2, 'Seminar group', [2], '11:00', '12:00', '#34b36b', 'A4'), slot(3, 'Networks lab', [4], '14:00', '16:00', '#8e5cf7', 'Lab 2'),
    slot(4, 'Gym', [1, 3, 5], '07:30', '08:15', '#e5484d'), slot(5, 'Study group', [5], '13:00', '14:30', '#f4a62a', 'Library')];
  S.settings.cal.view = 'week';
  save();
})()"""

def wav(seconds=0.9, hz=880, rate=22050):
    b = io.BytesIO(); w = wave.open(b, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(b''.join(struct.pack('<h', int(9000 * math.sin(2 * math.pi * hz * i / rate) * math.exp(-3 * i / (rate * seconds)))) for i in range(int(rate * seconds)))); w.close()
    return list(b.getvalue())

def page(b, w, h, dsf):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf, locale='en-GB', timezone_id='Europe/London', reduced_motion='reduce')   # reduced motion: scrolling text and animations stand still in the picture
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.clock.set_fixed_time(NOW)
    pg.goto('file://' + str(DIST) + ('?watch' if w < 600 else '')); pg.wait_for_selector('#main, #wapp', state='attached'); pg.wait_for_timeout(300)
    pg.evaluate(DEMO); pg.errs = errs
    return ctx, pg

def squeeze(path):
    im = Image.open(path).convert('RGB'); im.save(path, optimize=True)

def shot(pg, name):
    pg.mouse.move(700, 880); pg.wait_for_timeout(150)   # nothing hovered, so no tooltip is in the picture
    pg.screenshot(path=str(OUT / name)); squeeze(OUT / name)

def desktop(b):
    ctx, pg = page(b, 1440, 900, 1.5)
    pg.evaluate("S.settings.ui.pins = ['page:kanban']; save(); U.page = 'calendar'; render()"); pg.wait_for_timeout(500)
    # calendar: the week, with lessons and timed tasks
    pg.locator('.vtabs [role=tab]', has_text='Week').first.click(); pg.wait_for_timeout(700)
    shot(pg, 'calendar.png')
    # pinning: right-click Classes
    tab = pg.locator('.vtabs [role=tab]', has_text='Classes').first; box = tab.bounding_box()
    tab.click(button='right', position={'x': 40, 'y': box['height'] - 3}); pg.wait_for_timeout(900)   # low in the tab, so the menu opens below the tab strip
    pg.screenshot(path=str(OUT / 'pins.png')); squeeze(OUT / 'pins.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    # timeline
    pg.evaluate("S.settings.ui.pins = ['page:kanban', 'school']; save(); U.page = 'gantt'; U.gList = 'work'; render()"); pg.wait_for_timeout(900)
    tray = pg.get_by_text('Unscheduled', exact=True).locator('xpath=..').locator('button')
    if tray.count(): tray.first.click(); pg.wait_for_timeout(400)
    shot(pg, 'timeline.png')
    # the reminder sound
    pg.evaluate("openSettings('sound')"); pg.wait_for_timeout(300)
    pg.evaluate("(async b => { await csoundSet(new File([new Uint8Array(b)], 'soft-bell.wav', { type: 'audio/wav' })); await csoundRefresh(); })", wav()); pg.wait_for_timeout(500)
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    shot(pg, 'sound.png')
    pg.evaluate("closeModal()"); pg.wait_for_timeout(200)
    # tasks: Today, with a task open on the right
    pg.evaluate("U.page = 'tasks'; U.list = 'today'; render()"); pg.wait_for_timeout(500)
    pg.locator('#main', has_text='Finish the quarterly report').locator('text=Finish the quarterly report').first.click(); pg.wait_for_timeout(500)
    shot(pg, 'tasks.png')
    ctx.close()

def watch(b):
    shots = []
    for name in ('now', 'tasks', 'next'):
        ctx, pg = page(b, 396, 396, 2)
        pg.evaluate("S.settings.watch.mode = 'on'; S.settings.watch.shape = 'round'; watchApply()"); pg.wait_for_timeout(300)
        if name != 'now': pg.evaluate(f"watchGo('{name}')"); pg.wait_for_timeout(300)
        p = OUT / f'_watch-{name}.png'; pg.screenshot(path=str(p)); shots.append(p); ctx.close()
    size, gap, ring = 792, 56, 28   # 396 CSS px at 2x
    W = len(shots) * (size + 2 * ring) + (len(shots) - 1) * gap; H = size + 2 * ring
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for i, p in enumerate(shots):
        x = i * (size + 2 * ring + gap)
        bezel = Image.new('RGBA', (H, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(bezel)
        dr.ellipse((0, 0, H - 1, H - 1), fill=(34, 34, 38, 255)); dr.ellipse((6, 6, H - 7, H - 7), fill=(12, 12, 14, 255))
        face = Image.open(p).convert('RGBA').resize((size, size), Image.LANCZOS)
        mask = Image.new('L', (size * 4, size * 4), 0); ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255); mask = mask.resize((size, size), Image.LANCZOS)
        bezel.paste(face, (ring, ring), mask); sheet.alpha_composite(bezel, (x, 0)); p.unlink()
    sheet.save(OUT / 'watch.png', optimize=True)

if __name__ == '__main__':
    if not DIST.exists(): sys.exit('Build the app first: npm run build:app')
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(); desktop(b); watch(b); b.close()
    print('wrote', ', '.join(sorted(f.name for f in OUT.glob('*.png') if not f.name.startswith('get-it') and f.name != 'banner.png')))
