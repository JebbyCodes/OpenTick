// Print stylesheet checks that need no browser (the real-PDF checks are test/browser/test_print_borders.py).
// The bug these guard: every printed page had a thick black frame in the dark themes, because the themes set `color-scheme: dark` and print never
// put it back (docs/PRINTING.md). The rules here keep the cause from coming back through a new theme, a new print block or a stray page border.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, ''); // (comments explain the rules and may name the very thing they forbid)
const css = strip(readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')), js = readFileSync(new URL('../src/js/print.js', import.meta.url), 'utf8');

// every top-level @media print { … } block, by brace matching (the file has several, and rules nest one level)
function blocks(text, head) {
  const out = []; let i = 0;
  while ((i = text.indexOf(head, i)) >= 0) {
    let depth = 0, j = text.indexOf('{', i);
    for (let k = j; k < text.length; k++) { if (text[k] === '{') depth++; else if (text[k] === '}' && --depth === 0) { out.push(text.slice(j + 1, k)); i = k; break; } }
    i++;
  }
  return out;
}
const prints = blocks(css, '@media print'), printCss = prints.join('\n');
assert.ok(prints.length >= 3, 'the print blocks were found');

// 1. paper is light: the global print block resets the colour scheme of the page root, and with !important (a theme rule has a higher specificity)
const reset = /(?::root|html)[^{}]*\{[^{}]*color-scheme\s*:\s*light\s*!important/;
assert.ok(reset.test(prints[0]), 'the first (global) @media print block resets color-scheme to light with !important');
assert.ok(/:root\[data-theme\]/.test(prints[0].split('}')[0]), 'and the reset is at least as specific as a theme selector (:root[data-theme=…]), so it also holds for custom themes');

// 2. every theme that is dark on screen is covered by that reset (a new dark theme needs no change: the reset is for all of them)
const darkThemes = [...css.matchAll(/:root\[data-theme=([\w-]+)\]\{[^}]*color-scheme:dark/g)].map(m => m[1]);
assert.ok(darkThemes.length >= 5, 'the dark themes were found: ' + darkThemes);
assert.ok(/data-theme\]/.test(prints[0]), 'the reset targets every [data-theme], not a list of names that a new theme would be missing from');

// 3. nothing in print puts the dark scheme back, or gives the page roots a frame, outline or shadow
assert.ok(!/color-scheme\s*:\s*dark/.test(printCss), 'no print rule switches the dark colour scheme on');
for (const [, sel, body] of printCss.matchAll(/(?:^|[}\n])\s*((?:html|:root|body)(?:\.[\w-]+|\[[^\]]+\])*(?:\s*,\s*(?:html|:root|body)(?:\.[\w-]+|\[[^\]]+\])*)*)\s*\{([^{}]*)\}/g)) {
  assert.ok(!/(^|;)\s*(border|outline|box-shadow)\s*:\s*(?!none|0\b|0px)/.test(body), `a print rule gives the page root a frame, outline or shadow: ${sel} { ${body} }`);
}
// 4. the @page rules are only about paper (size and margin): never a border, outline or background
const pageRules = [...(css + '\n' + js).matchAll(/@page\s*\{([^}]*)\}/g)].map(m => m[1]);
assert.ok(pageRules.length >= 2, '@page rules were found (the CSS one for the guide, print.js for the rest)');
for (const r of pageRules) assert.ok(!/border|outline|background|shadow/.test(r), '@page only sets size and margin: ' + r);
// 5. the margins are real (a page with no margin would print edge to edge and lose text at the printer's unprintable edge)
for (const m of js.matchAll(/margin:\$\{[^}]*\?\s*(\d+)\s*:\s*(\d+)\}mm/g)) assert.ok(+m[1] >= 8 && +m[2] >= 8, 'print margins are at least 8 mm');
// 6. the document being printed keeps its own legitimate borders (the rule under the title, the tick boxes, table grids): they are not removed wholesale
for (const sel of ['.pr-top{', '.pr-box{', '.pr-nb th,.pr-nb td{border:', '.pr-subs .pr-box']) assert.ok(printCss.includes(sel), 'a legitimate print border is kept: ' + sel);
assert.ok(/\.pr-top\{[^}]*border-bottom:1\.5pt solid #000/.test(printCss) && /\.pr-box\{[^}]*border:1pt solid #000/.test(printCss), 'the title rule and the tick boxes are still drawn');
assert.ok(!/(?:^|[;{\s])\*\s*\{[^}]*border\s*:\s*(?:0|none)/.test(printCss), 'borders are not removed with a blanket * rule');
console.log('print stylesheet tests passed (colour-scheme reset, @page, no page frame, content borders kept)');
