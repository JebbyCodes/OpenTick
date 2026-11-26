# Printing

Printing is done by the browser's own print dialog (or the desktop app's), so the same code gives a paper page, a PDF and the print preview.
`src/js/print.js` builds the page for notes and task lists, the grids (calendar, timetable, boards, matrix, habits, countdowns, statistics) are
printed as they are with the menus hidden, the Help guide has its own rules (`body.on-help`), and the timeline prints through its own page
(`gtPrint` in `src/js/gantt.js`). The print CSS is the `@media print` blocks in `src/styles.css`.

## The "thick black border on every page" bug (fixed in 0.9.1)

**Symptom.** Printing anything, with one of the dark themes selected, put a wide near-black frame around every page: the white page content sat
inside a black margin. Light themes printed correctly, so it looked like a problem with individual screens.

**What it was not.** Not a border, outline or box-shadow on a page wrapper, a table, a card or a pseudo-element: none of them is on the page edge,
and the page root already computed a white background in print (`html, body.printing { background: #fff !important }`).

**Root cause.** The five dark themes (and Match system whenever the computer is set to dark) declare `color-scheme: dark` on `:root` (so scroll bars and form controls match). Nothing put it back for print.
A browser paints the *page margin area* (the part of the paper inside the `@page` margin but outside the page box) with the **canvas colour of the
page's colour scheme**, not with the root element's `background`. With `color-scheme: dark` that canvas is near-black (`#121212`), so the 16 mm
margin (9 mm on grid pages) was black on every page, on every screen, in PDF and on paper.

It was reproduced in headless Chromium by printing to PDF with each theme and measuring the outer edge of every rasterised page: every dark theme
gave a fully dark frame on every page, every light theme gave none. Printing the same page with `color-scheme: light` forced removed the frame
completely, and nothing else did.

**Fix.** One rule in the global `@media print` block (the first one in `src/styles.css`), so it covers every printable view, the browser's own
Ctrl+P, and the desktop app:

```css
@media print { :root, :root[data-theme], :root[data-eink] { color-scheme: light !important } }
```

`!important` is needed because a theme selector (`:root[data-theme=dark]`) is more specific than `html`; `[data-theme]` in the selector also keeps it
at least as specific for imported custom themes. Paper is always light. It does not touch the screen. Borders that belong to the document (the rule
under a list's title, tick boxes, table grids in the guide and in notes) are not removed.

**Not affected.** The timeline's own print page (a separate document built in an `<iframe>`) has no theme at all. Its dark option (*Output → Dark*)
deliberately prints the chart on a dark background.

## Tests

- `test/print.mjs` (part of `npm test`, no browser): the colour-scheme reset exists in the global print block with `!important`; no print rule
  switches the dark scheme on or gives the page root a border, outline or shadow; `@page` rules only set size and margin; the document's own
  borders (title rule, tick boxes, table grids) are still there; no blanket `* { border: 0 }`.
- `test/browser/test_print_borders.py` (`npm run test:browser`): makes **real PDFs** with Chromium for every theme on the main pages and for one
  light and one dark theme on every printable page (task list and notes of several pages, calendar, timetable, boards, matrix, habits,
  countdowns, statistics, the guide), rasterises **every page** and fails if more than 1 % of the outer frame is dark. It also checks that the
  title rule, tick boxes and the guide's table grid are still printed, that the screen is still dark in a dark theme, and runs a **control**: the
  same page with the reset rule removed must show the old black frame, so the check cannot pass by measuring nothing.
- `test/browser/test_print.py` (existing): the words, the page count and the absence of the app's menus in each PDF.

If you add a theme, nothing needs to change: the reset is for every `[data-theme]`. If you add a printable view, add it to `PAGES` in
`test_print_borders.py`.
