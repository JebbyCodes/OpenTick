// Tiny dev server for `tauri dev` and browser testing: rebuilds on change, serves dist/ on :1420.
import { createServer } from 'node:http';
import { readFileSync, existsSync, watch } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build-app.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json' };
build();
let t; watch(join(root, 'src'), { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => { try { build(); } catch (e) { console.error(e); } }, 100); });
createServer((req, res) => {
  const p = join(root, 'dist', req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!p.startsWith(join(root, 'dist')) || !existsSync(p)) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(readFileSync(p));
}).listen(1420, '0.0.0.0', () => console.log('dev server on http://localhost:1420'));
