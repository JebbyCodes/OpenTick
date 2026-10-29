// Bundles src/ into one standalone dist/index.html (+ PWA files). No dependencies.
// - The version comes from package.json (the single source of truth; `npm run bump -- X.Y.Z` keeps every manifest in step).
// - The logo is src/logo.png. If it is missing the build falls back to src/icon.svg and says so.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url)), src = join(root, 'src'), dist = join(root, 'dist');
export const JS_ORDER = ['vault', 'core', 'sfx', 'md', 'files', 'views', 'icons', 'home', 'notes', 'templates', 'blocks', 'bed', 'banner', 'batch', 'zoom', 'bgfx', 'help', 'licenses.gen', 'privacy.gen', 'about', 'mxdrag', 'habitmap', 'sync', 'import', 'gantt', 'school', 'holiday', 'remind', 'recur', 'ui', 'keys', 'ctxmenu', 'prefs', 'marquee', 'themes', 'data', 'widget', 'bg', 'vaultui', 'main'];
const INLINE_MAX = 200 * 1024; // logos up to this size are embedded in index.html, so the single file still stands alone

export const readVersion = () => JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
// width/height of a PNG, read from its header (no image library needed)
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
export function resolveLogo() {
  const png = join(src, 'logo.png');
  if (existsSync(png)) {
    const buf = readFileSync(png), size = pngSize(buf);
    return { file: 'logo.png', path: png, mime: 'image/png', buf, size, placeholder: false };
  }
  const svg = join(src, 'icon.svg');
  return { file: 'icon.svg', path: svg, mime: 'image/svg+xml', buf: readFileSync(svg), size: null, placeholder: true };
}

export function build() {
  mkdirSync(dist, { recursive: true });
  const version = readVersion(), logo = resolveLogo(), built = new Date().toISOString().slice(0, 10);
  if (logo.placeholder) console.warn('! src/logo.png not found: using the src/icon.svg placeholder. Add your logo as src/logo.png and rebuild.');
  else if (logo.size && logo.size.w !== logo.size.h) console.warn(`! logo.png is ${logo.size.w}x${logo.size.h}; a square image looks best as an app icon.`);
  const js = JS_ORDER.map(n => readFileSync(join(src, 'js', n + '.js'), 'utf8')).join('\n');
  const css = readFileSync(join(src, 'styles.css'), 'utf8');
  const logoHref = logo.buf.length <= INLINE_MAX ? `data:${logo.mime};base64,${logo.buf.toString('base64')}` : logo.file;
  const meta = JSON.stringify({ version, built, logo: logoHref, logoFile: logo.file });
  const html = readFileSync(join(src, 'index.html'), 'utf8')
    .replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js)
    .replace('/*__META__*/null', () => meta).replace(/%%LOGO%%/g, () => logoHref).replace(/%%VERSION%%/g, () => version);
  writeFileSync(join(dist, 'index.html'), html);
  // PWA manifest: generated so the name, version and icon always match
  const icon = logo.placeholder
    ? [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
    : [{ src: logo.file, sizes: logo.size ? `${logo.size.w}x${logo.size.h}` : 'any', type: logo.mime, purpose: 'any' }];
  writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify({
    name: 'OpenTick', short_name: 'OpenTick', description: 'Open-source to-do, calendar, notes, habit and focus app', version,
    start_url: '.', display: 'standalone', background_color: '#1d2021', theme_color: '#1d2021', icons: icon,
  }, null, 2));
  // service worker: the cache name carries the version, so every release drops the old cache
  const files = ['./', 'index.html', 'manifest.webmanifest', logo.file];
  writeFileSync(join(dist, 'sw.js'), readFileSync(join(src, 'sw.js'), 'utf8').replace(/__VERSION__/g, version).replace('__FILES__', JSON.stringify(files)));
  copyFileSync(logo.path, join(dist, logo.file));
  console.log(`built OpenTick v${version} -> dist/index.html (${(html.length / 1024).toFixed(1)} KB, logo: ${logo.file})`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) build();
