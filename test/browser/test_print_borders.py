"""0.9.1: the printed page has no thick black frame. Regression test for the bug where every printed page (a task list, a note, the calendar, the
guide, any grid) came out with a wide near-black border whenever one of the dark themes was in use.

Root cause (see docs/PRINTING.md): the five dark themes (and Match system when the computer is set to dark) declare `color-scheme: dark` on :root. In print, the browser paints the page MARGIN (the
@page margin area, outside the white page box) with the canvas colour of that colour scheme, so the margin was near-black even though html and
body were already forced to a white background. The fix resets `color-scheme` to light in the global @media print block.

This test looks at the real printed output, not the screen: for every theme and every kind of printable page it makes a real PDF with Chromium,
rasterises EVERY page, and measures the outer frame of each one. It also checks that the borders that belong to the content (the rule under a
list's title, the tick boxes, a table's grid) are still there, and runs the same measurement on a deliberately broken page to prove the detector can
actually see the old bug (so the test cannot pass by measuring nothing)."""
import glob, os, subprocess, tempfile
from lib import *
from PIL import Image

SETUP = """(() => {
  S.lists.push({ id: 'lp', name: 'Print list', color: '#4772fa', sections: ['Design', 'Launch'] });
  const mk = o => { const t = newTask({ listId: 'lp', ...o }); S.tasks.push(t); return t; };
  for (let i = 0; i < 70; i++) mk({ title: 'Task number ' + i + ' with a reasonably long title so the list needs more than one page', section: i % 2 ? 'Design' : 'Launch', due: todayStr(), priority: i % 4, tags: ['t' + (i % 3)], notes: 'Some **notes** for ' + i });
  S.slots = [{ id: 's1', title: 'Maths lecture', days: [new Date().getDay()], start: '09:00', end: '10:30', color: '#4772fa', loc: 'B12', notes: '', created: 1 }];
  for (let i = 0; i < 4; i++) S.notes.push(newNote({ title: 'Note ' + i, body: '## Agenda\\n\\n| a | b |\\n|---|---|\\n| 1 | 2 |\\n\\n' + 'Lorem ipsum dolor sit amet. '.repeat(30), tags: ['meeting'] }));
  flush(); return true; })()"""

PAGES = {
    'list':       "U.page='tasks'; U.nav='list:lp'; U.q=''; U.pr={notes:true,subs:true,done:false}; render()",
    'notes-all':  "U.page='notes'; U.noteSel=null; U.pr={scope:'view',meta:true}; render()",
    'calendar':   "U.page='calendar'; render()",
    'timetable':  "U.page='timetable'; render()",
    'kanban':     "U.page='kanban'; render()",
    'matrix':     "U.page='matrix'; render()",
    'habits':     "U.page='habits'; render()",
    'countdowns': "U.page='countdowns'; render()",
    'stats':      "U.page='stats'; render()",
    'help':       "U.page='help'; render()",
}
# every theme, on the pages most likely to differ; the two representative themes (one light, one dark) on every page
ALL_THEMES_ON = ('list', 'notes-all', 'calendar', 'help')
DPI = 40          # a 16 mm margin is about 25 px at this size, so a frame is unmistakable and a PDF page is cheap to read
FRAME_PX = 4      # how deep into each edge we look: inside the margin, outside any content
MAX_DARK = 0.01   # at most 1 % of the frame may be dark (anti-aliasing, a stray hairline)

def rasterise(pdf):
    d = tempfile.mkdtemp(); subprocess.run(['pdftoppm', '-r', str(DPI), '-png', pdf, os.path.join(d, 'p')], check=True)
    return sorted(glob.glob(os.path.join(d, 'p*.png')))

def frame_dark(png):
    im = Image.open(png).convert('L'); w, h = im.size; px = im.load(); m = FRAME_PX
    cells = [(x, y) for y in range(h) for x in list(range(m)) + list(range(w - m, w))] + [(x, y) for x in range(m, w - m) for y in list(range(m)) + list(range(h - m, h))]
    return sum(px[x, y] < 100 for x, y in cells) / len(cells)

def print_pdf(pg, name, extra_css=''):
    """What the printer gets: the app's own print events, print media, a real PDF with the page's own @page rules and backgrounds."""
    pg.evaluate("window.dispatchEvent(new Event('beforeprint'))")
    pg.evaluate("document.getElementById('xtest') && document.getElementById('xtest').remove()")
    if extra_css: pg.evaluate("(c) => { const s = document.createElement('style'); s.id = 'xtest'; s.textContent = c; document.head.appendChild(s); }", extra_css)
    pg.emulate_media(media='print'); pg.wait_for_timeout(200)
    f = os.path.join(tempfile.mkdtemp(), name + '.pdf'); pg.pdf(path=f, prefer_css_page_size=True, print_background=True)
    scheme = pg.evaluate("getComputedStyle(document.documentElement).colorScheme")
    pg.emulate_media(media='screen'); pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
    pg.evaluate("document.getElementById('xtest') && document.getElementById('xtest').remove()")
    return f, scheme

def dark_pages(pdf):
    pngs = rasterise(pdf); return pngs, [round(frame_dark(p), 3) for p in pngs]

with sync_playwright() as p:
    b, ctx, pg = launch(p, mobile=False, w=1280, h=850)
    pg.evaluate(SETUP)
    themes = pg.evaluate("THEMES.map(t => t[0])")
    dark_themes = pg.evaluate("THEMES.filter(t => getComputedStyle(document.documentElement).colorScheme && (document.documentElement.dataset.theme = t[0], getComputedStyle(document.documentElement).colorScheme === 'dark')).map(t => t[0])")
    pg.evaluate("applyTheme()")
    assert len(themes) >= 8 and len(dark_themes) >= 5, ('the test must cover light and dark themes', themes, dark_themes)
    light_rep = next(t for t in themes if t not in dark_themes); dark_rep = dark_themes[0]
    checked = 0

    # ---- 0. the detector sees the old bug (control): the same page printed WITHOUT the colour-scheme reset (the stylesheet as it was before the fix) has a dark frame ----
    pg.evaluate(f"S.settings.theme = '{dark_rep}'; applyTheme()"); pg.evaluate(PAGES['list']); pg.wait_for_timeout(250)
    removed = pg.evaluate("""(() => { window.__rm = []; for (const s of document.styleSheets) for (const r of s.cssRules) if (r.type === 4 && /print/.test(r.media.mediaText))
      for (let i = r.cssRules.length - 1; i >= 0; i--) if (/color-scheme:\\s*light/.test(r.cssRules[i].cssText)) { window.__rm.push([r, i, r.cssRules[i].cssText]); r.deleteRule(i); } return window.__rm.length; })()""")
    assert removed >= 1, 'the reset rule is in the stylesheet (and was taken out for the control)'
    f, scheme = print_pdf(pg, 'control')
    pg.evaluate("window.__rm.reverse().forEach(([r, i, t]) => r.insertRule(t, i))")
    assert scheme == 'dark', ('without the reset the dark colour scheme reaches the printer', scheme)
    _, frames = dark_pages(f)
    assert frames and min(frames) > 0.5, ('the detector must see the old bug: a dark colour scheme in print gives a dark frame on every page', frames)

    # ---- 1. every theme x the main pages, and the two representative themes x every page; every PAGE of every PDF is measured ----
    for theme in themes:
        for name, js in PAGES.items():
            if theme not in (light_rep, dark_rep) and name not in ALL_THEMES_ON: continue
            pg.evaluate(f"S.settings.theme = '{theme}'; applyTheme()"); pg.evaluate(js); pg.wait_for_timeout(250)
            f, scheme = print_pdf(pg, f'{theme}_{name}')
            assert scheme == 'light', (theme, name, 'paper is always light: the page must print with the light colour scheme', scheme)
            pngs, frames = dark_pages(f)
            assert pngs, (theme, name, 'no pages')
            bad = [(i + 1, fr) for i, fr in enumerate(frames) if fr > MAX_DARK]
            assert not bad, (theme, name, 'a printed page has a dark frame around it (page, share of the frame that is dark):', bad)
            checked += len(pngs)
            if name in ('list', 'notes-all'): assert len(pngs) >= 2, (theme, name, 'the multi-page documents must really be several pages', len(pngs))

    # ---- 2. what is part of the content keeps its borders ----
    pg.evaluate(f"S.settings.theme = '{dark_rep}'; applyTheme()"); pg.evaluate(PAGES['list']); pg.wait_for_timeout(250)
    f, _ = print_pdf(pg, 'content_list')
    subprocess.run(['pdftoppm', '-r', '100', '-png', '-f', '1', '-l', '1', f, f[:-4] + '_hi'], check=True)
    im = Image.open(sorted(glob.glob(f[:-4] + '_hi*.png'))[0]).convert('L'); w, h = im.size; px = im.load()
    inner = range(int(w * 0.12), int(w * 0.88))
    rows = [y for y in range(int(h * 0.05), int(h * 0.95)) if sum(px[x, y] < 100 for x in inner) > 0.6 * len(inner)]
    assert rows, 'the rule under the list title (a border that belongs to the document) is still printed'
    boxes = sum(1 for y in range(int(h * 0.1), int(h * 0.9), 2) if sum(px[x, y] < 100 for x in range(int(w * 0.08), int(w * 0.16))) >= 3)
    assert boxes > 20, ('the tick boxes of the tasks keep their borders', boxes)
    pg.evaluate(PAGES['help']); pg.wait_for_timeout(300)
    f, _ = print_pdf(pg, 'content_help')
    subprocess.run(['pdftoppm', '-r', '100', '-png', '-f', '1', '-l', '3', f, f[:-4] + '_hi'], check=True)
    # (the guide's tables and contents box have a grey 0.5pt grid: at least one page must show a long thin horizontal line that is neither the frame nor text)
    lines = 0
    for png in glob.glob(f[:-4] + '_hi*.png'):
        im = Image.open(png).convert('L'); w, h = im.size; px = im.load()
        lines += sum(1 for y in range(int(h * 0.06), int(h * 0.94)) if sum(px[x, y] < 190 for x in range(int(w * 0.15), int(w * 0.85))) > 0.7 * int(w * 0.7))
    assert lines >= 2, ('the guide keeps its rules and table borders', lines)

    # ---- 3. the screen is not affected: the colour scheme is only reset for print ----
    pg.evaluate(f"S.settings.theme = '{dark_rep}'; applyTheme()"); pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
    assert pg.evaluate("getComputedStyle(document.documentElement).colorScheme") == 'dark', 'on screen a dark theme is still dark'
    assert not pg.errs, pg.errs
    b.close()

    # ---- 4. "Match system" on a dark operating system is the sixth case that declares a dark colour scheme (through prefers-color-scheme) ----
    b, ctx, pg = launch(p, mobile=False, w=1280, h=850, color_scheme='dark')
    pg.evaluate(SETUP); pg.evaluate("S.settings.theme = 'auto'; applyTheme()"); pg.evaluate(PAGES['list']); pg.wait_for_timeout(250)
    assert pg.evaluate("getComputedStyle(document.documentElement).colorScheme") == 'dark', 'the control: with a dark system, Match system really is dark on screen'
    for name in ('list', 'notes-all', 'calendar'):
        pg.evaluate(f"S.settings.theme = 'auto'; applyTheme()"); pg.evaluate(PAGES[name]); pg.wait_for_timeout(250)
        f, scheme = print_pdf(pg, f'auto_dark_{name}')
        assert scheme == 'light', (name, 'Match system on a dark system still prints on light paper', scheme)
        pngs, frames = dark_pages(f); assert pngs, name
        bad = [(i + 1, fr) for i, fr in enumerate(frames) if fr > MAX_DARK]
        assert not bad, ('Match system on a dark system: a printed page has a dark frame', name, bad)
        checked += len(pngs)
    assert not pg.errs, pg.errs; b.close()
print(f'print borders: {checked} printed pages in real PDFs across {len(themes)} themes ({len(dark_themes)} dark, and Match system on a dark system) have clean margins; content borders kept; the detector sees the old bug')
