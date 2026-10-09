// Bundles src/ into one standalone dist/index.html (+ PWA files). No dependencies.
// If vendor/opengantt/Gantt.html exists (npm run sync:gantt) it is shipped as dist/OpenGantt.html and the Gantt page
// gets an "OpenGantt" pane that runs the real app.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url)), src = join(root, 'src'), dist = join(root, 'dist'), vend = join(root, 'vendor', 'opengantt');
export const JS_ORDER = ['core', 'md', 'views', 'sync', 'og', 'gantt', 'ui', 'main'];
export function build() {
  mkdirSync(dist, { recursive: true });
  const js = JS_ORDER.map(n => readFileSync(join(src, 'js', n + '.js'), 'utf8')).join('\n');
  const css = readFileSync(join(src, 'styles.css'), 'utf8');
  let upstream = 'null';
  if (existsSync(join(vend, 'Gantt.html'))) {
    copyFileSync(join(vend, 'Gantt.html'), join(dist, 'OpenGantt.html'));
    let meta = {}; try { meta = JSON.parse(readFileSync(join(vend, 'UPSTREAM.json'), 'utf8')); } catch (e) { /* no metadata */ }
    upstream = JSON.stringify({ file: 'OpenGantt.html', sha: meta.commit || '', fetched: meta.fetched || '' });
  }
  const html = readFileSync(join(src, 'index.html'), 'utf8').replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js).replace('/*__OGU__*/null', () => upstream);
  writeFileSync(join(dist, 'index.html'), html);
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) copyFileSync(join(src, f), join(dist, f));
  console.log(`built dist/index.html (${(html.length / 1024).toFixed(1)} KB)${upstream === 'null' ? '' : ' + OpenGantt.html'}`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) build();
