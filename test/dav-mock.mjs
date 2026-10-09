// Minimal in-memory WebDAV server for tests. Behaves like SabreDAV/Nextcloud where it matters:
// ETags, If-Match / If-None-Match (412), 409 for a missing parent folder, 405 for an existing one, Basic auth.
// Run standalone for manual testing:  node test/dav-mock.mjs   (http://127.0.0.1:8080/dav, user "me", password "secret", CORS on)
import http from 'node:http';
import { fileURLToPath } from 'node:url';
export function davServer({ user = 'me', pass = 'secret', etags = true, dirs = ['/dav'], cors = false, port = 0 } = {}) {
  const files = new Map(), D = new Set(dirs), log = []; let n = 0; const srv = { files, log, beforePut: null };
  srv.server = http.createServer((req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]), parent = path.replace(/\/[^/]*$/, '') || '/';
    log.push(req.method + ' ' + path);
    // cors: behave like a server configured for browser clients (preflight + exposed ETag)
    const CORS = cors ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'ETag' } : {};
    const done = (c, h = {}, b) => { res.writeHead(c, { ...CORS, ...h }); res.end(b); };
    if (req.method === 'OPTIONS') return cors ? done(204, { 'Access-Control-Allow-Methods': 'GET, PUT, MKCOL, PROPFIND, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, If-None-Match' }) : done(405);
    if (req.headers.authorization !== 'Basic ' + Buffer.from(user + ':' + pass).toString('base64')) return done(401);
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const f = files.get(path), tag = f && etags ? { ETag: f.etag } : {};
      if (req.method === 'GET') {
        if (!f) return done(404);
        if (etags && req.headers['if-none-match'] === f.etag) return done(304, tag);
        return done(200, { 'Content-Type': 'application/json', ...tag }, f.body);
      }
      if (req.method === 'MKCOL') { if (D.has(path)) return done(405); if (!D.has(parent)) return done(409); D.add(path); return done(201); }
      if (req.method === 'PUT') {
        if (srv.beforePut) { const h = srv.beforePut; srv.beforePut = null; h(path); }
        const cur = files.get(path);
        if (!D.has(parent)) return done(409);
        if (req.headers['if-none-match'] === '*' && cur) return done(412);
        if (etags && req.headers['if-match'] && (!cur || cur.etag !== req.headers['if-match'])) return done(412);
        const etag = `"${++n}"`; files.set(path, { body, etag });
        return done(cur ? 204 : 201, etags ? { ETag: etag } : {});
      }
      done(405);
    });
  });
  srv.url = () => `http://127.0.0.1:${srv.server.address().port}/dav`;
  srv.count = m => log.filter(l => l.startsWith(m)).length;
  return new Promise(r => srv.server.listen(port, '127.0.0.1', () => r(srv)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await davServer({ cors: true, port: 8080, dirs: ['/dav'] });
  console.log('WebDAV mock on ' + s.url() + '  (user me / password secret)');
}
