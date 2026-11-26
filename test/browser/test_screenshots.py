"""0.9.1 (Part I): the automated screenshots of the released app (scripts/screenshots/). The real scripts are run, against a stand-in for GitHub:
  fetch-release.py   picks the newest STABLE release (not a draft, not a pre-release); needs its OpenTick_<v>_web.zip and SHA256SUMS.txt; stops, with a message and
                     WITHOUT using the source, for every way the release can be wrong; unpacks safely; waits for files only when asked
  publish.py         writes only what changed; an identical run changes nothing; an older release never replaces a newer one; local, unverified or foreign pictures are
                     refused and then nothing at all is written; stale pictures go; the hand-made ones are replaced once
  capture.py         the whole set in a real browser from a downloaded zip, the same pixels on a second run, and a stop for an app error or a request to anywhere else
It cannot test GitHub itself (the real Releases API, `gh attestation verify`, the pull request): docs/SCREENSHOTS.md says so."""
import atexit, hashlib, http.server, importlib.util, io, json, os, re, shutil, stat, subprocess, sys, tempfile, threading, time, zipfile
from pathlib import Path
from PIL import Image
from lib import ROOT

SHOTS = ROOT / 'scripts' / 'screenshots'
TMP = Path(tempfile.mkdtemp(prefix='ot-shots-')); atexit.register(lambda: shutil.rmtree(TMP, ignore_errors=True))
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
sha = lambda b: hashlib.sha256(b).hexdigest()

def py(script, *args, env=None):
    e = {k: v for k, v in os.environ.items() if k not in ('GITHUB_TOKEN', 'GITHUB_ACTIONS', 'GITHUB_OUTPUT')}; e.update(env or {})
    return subprocess.run([sys.executable, '-I', str(SHOTS / script), *map(str, args)], capture_output=True, text=True, env=e, timeout=900)

def load(name):
    spec = importlib.util.spec_from_file_location('shots_' + name.replace('-', '_'), SHOTS / (name + '.py')); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
pub, cap = load('publish'), load('capture')

# ---------- the app, zipped the way the release zips it ----------
def build(folder, *flags):
    subprocess.run(['node', str(ROOT / 'build-app.mjs'), *flags, '--out', str(folder)], check=True, capture_output=True, cwd=ROOT)
def make_zip(folder, extra=None):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(Path(folder).rglob('*')):
            if f.is_file(): z.write(f, f.relative_to(folder).as_posix())
        for n, data in (extra or {}).items(): z.writestr(n, data)
    return b.getvalue()
def custom_zip(entries):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        for n, data in entries.items():
            if isinstance(n, zipfile.ZipInfo): z.writestr(n, data)
            else: z.writestr(n, data)
    return b.getvalue()
build(TMP / 'site'); build(TMP / 'eink', '--eink')
WEB, EINK = make_zip(TMP / 'site'), make_zip(TMP / 'eink')

# ---------- a stand-in for the GitHub Releases API and the release downloads ----------
class Fake:
    def __init__(self):
        self.files, self.releases, self.status, self.requests, self.hook = {}, [], 200, 0, None
        fake = self
        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def send(self, code, body, ctype='application/json'):
                self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
            def do_GET(self):
                if self.path.startswith('/repos/test/OpenTick/releases'):
                    fake.requests += 1
                    if fake.hook: fake.hook(fake)
                    return self.send(fake.status, json.dumps(fake.releases).encode() if fake.status == 200 else b'{"message":"boom"}')
                if self.path.startswith('/dl/') and self.path[4:] in fake.files: return self.send(200, fake.files[self.path[4:]], 'application/octet-stream')
                self.send(404, b'{}')
        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H); threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f'http://127.0.0.1:{self.srv.server_address[1]}'
    def asset(self, name, data, size=None, digest='ok', state='uploaded'):
        self.files[name] = data
        return {'name': name, 'size': len(data) if size is None else size, 'state': state, 'digest': 'sha256:' + sha(data) if digest == 'ok' else digest, 'browser_download_url': f'{self.base}/dl/{name}'}
    def release(self, tag, assets=(), draft=False, pre=False, published='2026-11-10T10:00:00Z'):
        return {'tag_name': tag, 'name': 'OpenTick ' + tag.lstrip('v'), 'draft': draft, 'prerelease': pre, 'published_at': published, 'html_url': f'https://github.com/test/OpenTick/releases/tag/{tag}', 'assets': list(assets)}
    def good(self, zipbytes, version=VERSION, sums='ok', **assetkw):
        name = f'OpenTick_{version}_web.zip'
        line = f'{sha(zipbytes) if sums == "ok" else "0" * 64}  {name}\n'.encode()
        stable = self.release('v' + version, [self.asset(name, zipbytes, **assetkw), self.asset('SHA256SUMS.txt', line)])
        # newer drafts and pre-releases and an older stable release, in an order that is not "newest first": only the right one may be chosen
        self.releases = [self.release('v0.0.1', [self.asset('OpenTick_0.0.1_web.zip', b'junk')], published='2025-01-01T00:00:00Z'),
                         self.release('v9.9.9', [self.asset('OpenTick_9.9.9_web.zip', b'draft')], draft=True, published='2026-11-24T00:00:00Z'),
                         stable,
                         self.release('v9.9.9-beta.1', [self.asset('OpenTick_9.9.9-beta.1_web.zip', b'beta')], pre=True, published='2026-11-23T00:00:00Z')]
        return stable
    def stop(self): self.srv.shutdown()

def fetch(fake, out, *args, env=None):
    return py('fetch-release.py', '--repo', 'test/OpenTick', '--api', fake.base, '--out', out, *args, env=env)

# ===== fetch-release.py =====
fake = Fake(); fake.good(WEB); out = TMP / 'ok'
r = fetch(fake, out); assert r.returncode == 0, r.stderr + r.stdout
info = json.loads((out / 'release.json').read_text())
assert info['tag'] == 'v' + VERSION and info['version'] == VERSION and info['local'] is False and info['verified'] == {'size': True, 'digest': True, 'sha256sums': True}, info
assert info['asset'] == {'name': f'OpenTick_{VERSION}_web.zip', 'size': len(WEB), 'sha256': sha(WEB)}, 'the stable release was chosen over the newer draft and pre-release and the older stable one'
assert (out / 'site' / 'index.html').is_file() and (out / 'site' / 'manifest.webmanifest').is_file(), 'unpacked'
assert (out / f'OpenTick_{VERSION}_web.zip').read_bytes() == WEB, 'the verified zip is kept for the attestation check'
r = fetch(fake, TMP / 'ok-tag', '--tag', 'v' + VERSION); assert r.returncode == 0, r.stderr
fake.stop()

def fails(label, setup, phrase, *args, env=None, tag=False):
    f = Fake(); setup(f); out = TMP / ('fail-' + label)
    r = fetch(f, out, *args, env=env); f.stop()
    assert r.returncode == 1, (label, r.returncode, r.stdout[-300:], r.stderr[-300:])
    assert phrase in r.stderr, (label, 'wanted', phrase, 'got', r.stderr[-400:])
    assert not (out / 'release.json').exists() and not (out / 'site' / 'index.html').exists(), label + ': nothing is unpacked or recorded, and nothing falls back to the source'
    return out

def drop(f, name):
    for rel in f.releases:
        rel['assets'] = [a for a in rel['assets'] if a['name'] != name]
def edit_asset(f, name, **kv):
    for rel in f.releases:
        for a in rel['assets']:
            if a['name'] == name: a.update(kv)
zipname = f'OpenTick_{VERSION}_web.zip'
fails('no-zip', lambda f: (f.good(WEB), drop(f, zipname)), f'has no {zipname}')
fails('no-sums', lambda f: (f.good(WEB), drop(f, 'SHA256SUMS.txt')), 'SHA256SUMS.txt')
fails('bad-sums', lambda f: f.good(WEB, sums='bad'), 'is not the one in SHA256SUMS.txt')
fails('bad-digest', lambda f: f.good(WEB, digest='sha256:' + '0' * 64), 'is not the digest GitHub lists')
fails('bad-size', lambda f: f.good(WEB, size=len(WEB) + 1), 'the download is damaged')
fails('not-uploaded', lambda f: f.good(WEB, state='starter'), 'is not fully uploaded')
fails('only-unstable', lambda f: setattr(f, 'releases', [f.release('v9.9.9', [], draft=True), f.release('v9.9.9-beta.1', [], pre=True)]), 'there is no stable release')
fails('tag-pre', lambda f: f.good(WEB), 'is a pre-release', '--tag', 'v9.9.9-beta.1')
fails('tag-draft', lambda f: f.good(WEB), 'is a draft', '--tag', 'v9.9.9')
fails('tag-unknown', lambda f: f.good(WEB), 'there is no release with the tag v8.8.8', '--tag', 'v8.8.8')
fails('eink', lambda f: f.good(EINK), 'e-ink')
fails('wrong-version', lambda f: f.good(WEB, version='0.0.7'), f'index.html is OpenTick {VERSION}, but the release is 0.0.7')
fails('not-a-zip', lambda f: f.good(b'hello'), 'not a zip file')
fails('no-index', lambda f: f.good(custom_zip({'manifest.webmanifest': '{}'})), 'no index.html')
fails('api-500', lambda f: setattr(f, 'status', 500), 'the GitHub API answered 500')
fails('traversal', lambda f: f.good(make_zip(TMP / 'site', {'../evil.txt': 'x'})), 'unsafe path'); assert not (TMP / 'evil.txt').exists(), 'nothing was written outside the folder'
def link_zip():
    i = zipfile.ZipInfo('sneaky'); i.external_attr = (stat.S_IFLNK | 0o777) << 16
    return custom_zip({'index.html': 'x', i: '/etc/passwd'})
fails('symlink', lambda f: f.good(link_zip()), 'contains a link')
# an API that cannot be reached at all stops too (no server there)
r = py('fetch-release.py', '--repo', 'test/OpenTick', '--api', 'http://127.0.0.1:9', '--out', TMP / 'fail-down'); assert r.returncode == 1 and 'could not read' in r.stderr, r.stderr

# waiting: only for a file that is not listed YET, only when asked
def late(f):
    f.good(WEB); real = f.releases; f.releases = [f.release('v' + VERSION, [], published='2026-11-10T10:00:00Z')]
    f.hook = lambda s: setattr(s, 'releases', real) if s.requests >= 3 else None
f = Fake(); late(f); t0 = time.time()
r = fetch(f, TMP / 'wait-ok', '--tag', 'v' + VERSION, '--wait', '30', env={'OPENTICK_SHOTS_POLL': '0.2'}); f.stop()
assert r.returncode == 0 and 'waiting for the release files' in r.stdout and f.requests >= 3, (r.stdout[-300:], r.stderr[-300:])
f = Fake(); f.releases = [f.release('v' + VERSION, [])]
r = fetch(f, TMP / 'wait-never', '--tag', 'v' + VERSION, '--wait', '1', env={'OPENTICK_SHOTS_POLL': '0.3'}); f.stop()
assert r.returncode == 1 and f'has no {zipname}' in r.stderr and f.requests >= 2, 'it waited, then stopped with the same message'
f = Fake(); f.good(WEB, sums='bad'); t0 = time.time()
r = fetch(f, TMP / 'wait-fast-fail', '--wait', '60', env={'OPENTICK_SHOTS_POLL': '5'}); f.stop()
assert r.returncode == 1 and 'SHA256SUMS.txt' in r.stderr and time.time() - t0 < 20, 'a wrong checksum is not something to wait for'
f = Fake(); f.good(WEB); drop(f, zipname)
r = fetch(f, TMP / 'nowait', '--tag', 'v' + VERSION, env={'OPENTICK_SHOTS_POLL': '0.2'}); f.stop(); assert r.returncode == 1 and f.requests == 1 and 'waiting' not in r.stdout, 'without --wait it asks once'
# a local zip is allowed for trying only, and says so
r = py('fetch-release.py', '--out', TMP / 'local', '--from-zip', TMP / 'ok' / zipname, '--version', VERSION); assert r.returncode == 0 and 'NOT a release' in r.stdout
assert json.loads((TMP / 'local' / 'release.json').read_text())['local'] is True

# ===== publish.py =====
def mk_repo(d):
    d = Path(d); (d / 'docs' / 'images').mkdir(parents=True)
    (d / 'README.md').write_text('# Title\n\nBefore.\n\n<!-- screenshots:start -->\n<img src="docs/images/tasks.png">\n<!-- screenshots:end -->\n<img src="docs/images/watch.png">\n\n## Download\n')
    (d / 'docs' / 'SCREENSHOTS.md').write_text('# S\n\nHand-written text.\n\n<!-- screenshots:list:start -->\nnone yet\n<!-- screenshots:list:end -->\n\nMore hand-written text.\n')
    for n in ['tasks', 'calendar', 'timeline', 'pins', 'sound', 'watch']: (d / 'docs' / 'images' / f'{n}.png').write_bytes(b'hand-made ' + n.encode())
    return d
def snap(d): return {str(p.relative_to(d)): (sha(p.read_bytes()), p.stat().st_mtime_ns) for p in sorted(Path(d).rglob('*')) if p.is_file()}
def mk_shots(d, version=VERSION, tweak=(), size_of=None):
    d = Path(d); d.mkdir(parents=True); images = {}
    for n in pub.EXPECTED:
        w, h = pub.SIZES[n.split('-')[0]]; seed = int(sha((n + ('x' if n in tweak else '')).encode())[:6], 16)
        im = Image.new('RGB', (w, h), (seed >> 16 & 255, seed >> 8 & 255, seed & 255)); im.putpixel((3, 3), (1, 2, 3)); im.save(d / n)
        images[n] = {'sha256': sha((d / n).read_bytes()), 'size': [w, h]}
    (d / 'manifest.json').write_text(json.dumps({'appVersion': version, 'frozenAt': '2026-11-18T10:24:00', 'viewports': {'desktop': {'width': 1440, 'height': 900, 'scale': 1}, 'mobile': {'width': 390, 'height': 844, 'scale': 2}}, 'images': images}))
    return d
def rel_json(d, version=VERSION, **over):
    r = {'local': False, 'repo': 'test/OpenTick', 'tag': 'v' + version, 'version': version, 'name': 'OpenTick ' + version, 'url': f'https://github.com/test/OpenTick/releases/tag/v{version}', 'publishedAt': '2026-11-10T10:00:00Z',
         'asset': {'name': f'OpenTick_{version}_web.zip', 'size': 1234, 'sha256': sha(('zip' + version).encode())}, 'verified': {'size': True, 'digest': True, 'sha256sums': True}}
    r.update(over); p = Path(d) / f'release-{version}.json'; p.write_text(json.dumps(r)); return p
def outputs(text): return dict(l.split('=', 1) for l in text.splitlines() if '=' in l)
def publish(cmd, repo, rel, shots=None, *extra):
    o = TMP / f'out-{time.time_ns()}'; o.write_text('')
    a = [cmd, '--release', rel, '--repo-root', repo, *extra] + (['--images', shots] if shots else [])
    r = py('publish.py', *a, env={'GITHUB_OUTPUT': str(o)}); return r, outputs(o.read_text())

W = TMP / 'pub'; W.mkdir(); repo = mk_repo(W / 'repo'); shots = mk_shots(W / 'shots'); rel = rel_json(W)
DEST = repo / pub.DEST
# the first run
r, o = publish('apply', repo, rel, shots, '--pr-body', W / 'pr.md'); assert r.returncode == 0 and o['changed'] == 'true', r.stderr + r.stdout
assert sorted(p.name for p in DEST.glob('*.png')) == sorted(pub.EXPECTED), 'all 18 pictures'
meta = json.loads((DEST / 'metadata.json').read_text())
assert meta['release']['version'] == VERSION and meta['release']['tag'] == 'v' + VERSION and meta['release']['asset']['sha256'] == sha(('zip' + VERSION).encode()) and meta['capture']['frozenAt'] == '2026-11-18T10:24:00'
assert all(meta['images'][n]['sha256'] == sha((DEST / n).read_bytes()) for n in pub.EXPECTED) and 'capturedAt' not in json.dumps(meta), 'a checksum for every picture, and no capture time (so a re-run changes nothing)'
rd = (repo / 'README.md').read_text()
assert 'docs/images/screenshots/desktop-dashboard.png' in rd and f'OpenTick {VERSION}' in rd and rd.startswith('# Title\n\nBefore.\n\n<!-- screenshots:start -->') and rd.endswith('<!-- screenshots:end -->\n<img src="docs/images/watch.png">\n\n## Download\n'), 'the generated block sits exactly between the markers'
assert 'docs/images/tasks.png' not in rd and 'docs/images/watch.png' in rd and rd.count('<!-- screenshots:start -->') == 1 and rd.count('<!-- screenshots:end -->') == 1 and '# Title\n\nBefore.' in rd and '## Download' in rd, 'the README block is replaced and the rest kept'
assert len(re.findall(r'<img ', rd.split('<!-- screenshots:end -->')[0])) == sum(map(len, pub.README_DESKTOP)) + len(pub.README_MOBILE), 'the README shows the chosen pictures'
for m in re.findall(r'src="(docs/images/screenshots/[^"]+)"', rd): assert (repo / m).is_file(), 'README picture exists: ' + m
dc = (repo / 'docs' / 'SCREENSHOTS.md').read_text()
assert 'Hand-written text.' in dc and 'More hand-written text.' in dc and len(re.findall(r'^\| \*\*[A-Z]\w+\*\*<br>', dc, re.M)) == len(pub.PAGES) and 'none yet' not in dc and meta['release']['asset']['sha256'] in dc, 'the docs block is filled, the rest kept'
assert [p.name for p in (repo / 'docs' / 'images').glob('*.png')] == ['watch.png'], 'the five hand-made pictures are gone, the smartwatch one stays'
body = (W / 'pr.md').read_text(); assert f'OpenTick {VERSION}' in body and meta['release']['asset']['sha256'] in body and f'Pictures that changed: {len(pub.EXPECTED)} of {len(pub.EXPECTED)}' in body and 'Replaced the hand-made README pictures' in body and 'look at the pictures' in body

# the same release again: nothing at all changes
before = snap(repo); time.sleep(0.05)
r, o = publish('apply', repo, rel, shots); assert r.returncode == 0 and o['changed'] == 'false' and 'no changes' in r.stdout and snap(repo) == before, 'an identical run writes nothing (not even a timestamp)'
r, o = publish('check', repo, rel); assert o['needed'] == 'false' and 'nothing to do' in r.stdout, r.stdout
r, o = publish('check', repo, rel, None, '--force'); assert o['needed'] == 'true'

# a new release where one picture changed: only that picture is written
shots2 = mk_shots(W / 'shots2', '0.9.2', tweak=['desktop-habits.png']); rel2 = rel_json(W, '0.9.2')
r, o = publish('check', repo, rel2); assert o['needed'] == 'true' and o['version'] == '0.9.2', r.stdout
before = snap(repo); time.sleep(0.05)
r, o = publish('apply', repo, rel2, shots2, '--pr-body', W / 'pr2.md'); assert r.returncode == 0 and o['changed'] == 'true', r.stderr
after = snap(repo); moved = sorted(k for k in after if before.get(k, ('', 0))[1] != after[k][1])
assert moved == sorted(['README.md', 'docs/SCREENSHOTS.md', pub.META, f'{pub.DEST}/desktop-habits.png']), ('only the changed picture, the metadata and the two pages were written', moved)
assert json.loads((DEST / 'metadata.json').read_text())['release']['version'] == '0.9.2' and 'OpenTick 0.9.2' in (repo / 'README.md').read_text()
b2 = (W / 'pr2.md').read_text(); assert 'Pictures that changed: 1 of 18 (desktop-habits.png)' in b2 and 'hand-made' not in b2, b2

# an older release does not replace a newer one
rel0 = rel_json(W, '0.9.0'); shots0 = mk_shots(W / 'shots0', '0.9.0')
r, o = publish('check', repo, rel0); assert o['needed'] == 'false' and 'newer' in r.stdout, r.stdout
before = snap(repo); r, o = publish('apply', repo, rel0, shots0); assert r.returncode == 1 and 'newer than 0.9.0' in r.stderr and snap(repo) == before
fr = shutil.copytree(repo, W / 'forced'); r, o = publish('apply', fr, rel0, shots0, '--force'); assert r.returncode == 0 and json.loads((fr / pub.META).read_text())['release']['version'] == '0.9.0', '--force does it'

# refusals, each one writing nothing
def refuses(label, phrase, make):
    rp = mk_repo(W / ('r-' + label)); sh = mk_shots(W / ('sh-' + label)); rj = rel_json(W, VERSION)
    rj, sh = make(rp, sh, rj); before = snap(rp)
    r, o = publish('apply', rp, rj, sh); assert r.returncode == 1 and phrase in r.stderr, (label, r.returncode, r.stderr[-300:])
    assert snap(rp) == before and not (rp / pub.DEST).exists(), label + ': nothing written'
def manifest_edit(sh, f):
    p = sh / 'manifest.json'; m = json.loads(p.read_text()); f(m); p.write_text(json.dumps(m))
refuses('local', 'LOCAL zip', lambda rp, sh, rj: (rel_json(W, VERSION, local=True), sh))
refuses('unverified', 'not verified', lambda rp, sh, rj: (rel_json(W, VERSION, verified={'size': True, 'digest': True, 'sha256sums': False}), sh))
refuses('no-sums-check', 'not verified', lambda rp, sh, rj: (rel_json(W, VERSION, verified={}), sh))
refuses('bad-tag', 'no plain version', lambda rp, sh, rj: (rel_json(W, VERSION, tag='v1.0.0'), sh))
refuses('foreign-version', "not this release's", lambda rp, sh, rj: (rj, (manifest_edit(sh, lambda m: m.update(appVersion='0.0.5')), sh)[1]))
refuses('missing-picture', 'expected set', lambda rp, sh, rj: (rj, ((sh / 'mobile-notes.png').unlink(), sh)[1]))
refuses('missing-in-manifest', 'expected set', lambda rp, sh, rj: (rj, (manifest_edit(sh, lambda m: m['images'].pop('mobile-notes.png')), sh)[1]))
refuses('extra-picture', 'not exactly the expected set', lambda rp, sh, rj: (rj, ((sh / 'extra.png').write_bytes((sh / 'mobile-notes.png').read_bytes()), sh)[1]))
refuses('tampered', 'differs from manifest.json', lambda rp, sh, rj: (rj, ((sh / 'desktop-tasks.png').write_bytes((sh / 'desktop-tasks.png').read_bytes() + b'x'), sh)[1]))
def small(rp, sh, rj):
    Image.new('RGB', (100, 100), (9, 9, 9)).save(sh / 'desktop-tasks.png'); manifest_edit(sh, lambda m: m['images']['desktop-tasks.png'].update(sha256=sha((sh / 'desktop-tasks.png').read_bytes()))); return rj, sh
refuses('wrong-size', '100×100 pixels, not 1440×900', small)
def not_png(rp, sh, rj):
    (sh / 'desktop-tasks.png').write_bytes(b'not a picture at all, just text'); manifest_edit(sh, lambda m: m['images']['desktop-tasks.png'].update(sha256=sha((sh / 'desktop-tasks.png').read_bytes()))); return rj, sh
refuses('not-png', 'is not a PNG', not_png)
def no_markers(rp, sh, rj): (rp / 'README.md').write_text('# no markers here\n'); return rj, sh
refuses('no-markers', 'must contain exactly one', no_markers)
def two_markers(rp, sh, rj): p = rp / 'docs' / 'SCREENSHOTS.md'; p.write_text(p.read_text() + '\n<!-- screenshots:list:start -->\n<!-- screenshots:list:end -->\n'); return rj, sh
refuses('two-markers', 'must contain exactly one', two_markers)
# stale pictures go, other files stay; a dry run writes nothing
rp = mk_repo(W / 'stale'); (rp / pub.DEST).mkdir(parents=True); (rp / pub.DEST / 'old-thing.png').write_bytes(b'old'); (rp / pub.DEST / 'notes.txt').write_text('keep')
before = snap(rp); r, o = publish('apply', rp, rel, shots, '--dry-run', '--pr-body', W / 'dry.md'); assert r.returncode == 0 and o['changed'] == 'true' and 'dry run' in r.stdout and snap(rp) == before and (W / 'dry.md').is_file()
r, o = publish('apply', rp, rel, shots); assert r.returncode == 0 and not (rp / pub.DEST / 'old-thing.png').exists() and (rp / pub.DEST / 'notes.txt').read_text() == 'keep' and 'removed' in r.stdout

# the tools agree with each other
assert list(cap.SCENES) == pub.PAGES, 'capture.py and publish.py photograph and publish the same pages, in the same order'
assert {vp: (v['width'] * v['dsf'], v['height'] * v['dsf']) for vp, v in cap.VIEWPORTS.items()} == pub.SIZES, 'the sizes publish.py expects are the ones capture.py makes'
assert set(pub.WHAT) == set(pub.PAGES) and all(p in pub.PAGES for row in pub.README_DESKTOP for p in row) and all(p in pub.PAGES for p in pub.README_MOBILE)
demo = (SHOTS / 'demo.js').read_text() + (SHOTS / 'demo' / 'study-planner.pack.json').read_text()
assert not re.search(r'[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d ()-]{8,}\d|https?://(?!github\.com/JebbyCodes/)', demo), 'the demo data holds no e-mail address, phone number or web address that is not this project\'s'

# ===== capture.py, in a real browser, from a downloaded zip =====
fake = Fake(); fake.good(WEB); out = TMP / 'pipe'
r = fetch(fake, out); fake.stop(); assert r.returncode == 0, r.stderr
t0 = time.time(); r = py('capture.py', '--site', out / 'site', '--out', out / 'images'); assert r.returncode == 0, r.stderr[-800:] + r.stdout[-300:]
man = json.loads((out / 'images' / 'manifest.json').read_text())
assert man['appVersion'] == VERSION and sorted(man['images']) == sorted(pub.EXPECTED) and man['frozenAt'] == '2026-11-18T10:24:00', man
assert len({v['sha256'] for v in man['images'].values()}) == len(pub.EXPECTED), 'no two pictures are the same (nothing redundant, nothing that failed to navigate)'
for n, v in man['images'].items():
    im = Image.open(out / 'images' / n); assert list(im.size) == v['size'] == list(pub.SIZES[n.split('-')[0]]), n
# the pictures go into a copy of the REAL README and docs page (their markers are exercised), then a second identical run changes nothing
real = W / 'real'; shutil.copytree(ROOT / 'docs' / 'images', real / 'docs' / 'images')
for rel_path in ['README.md', 'docs/SCREENSHOTS.md']: shutil.copy(ROOT / rel_path, real / rel_path)
assert (real / 'docs' / 'images' / 'tasks.png').is_file() and not (real / 'docs' / 'images' / 'screenshots').exists(), 'the copy starts as the repository is today: the hand-made pictures, no release pictures'
rr = out / 'release.json'
r, o = publish('check', real, rr); assert o['needed'] == 'true', r.stdout
r, o = publish('apply', real, rr, out / 'images', '--pr-body', out / 'pr.md'); assert r.returncode == 0 and o['changed'] == 'true', r.stderr + r.stdout
rd = (real / 'README.md').read_text(); assert 'docs/images/screenshots/desktop-dashboard.png' in rd and 'docs/images/tasks.png' not in rd and 'docs/images/watch.png' in rd and '## Download' in rd
for m in re.findall(r'(?:src|href)="(docs/[^"#]+)"', rd): assert (real / m).is_file(), 'README file exists: ' + m
assert not [p.name for p in (real / 'docs' / 'images').glob('*.png') if p.name in ('tasks.png', 'calendar.png', 'timeline.png', 'pins.png', 'sound.png')], 'the five hand-made pictures were replaced'
assert len(re.findall(r'^\| \*\*[A-Z]\w+\*\*<br>', (real / 'docs' / 'SCREENSHOTS.md').read_text(), re.M)) == len(pub.PAGES)
before = snap(real); r, o = publish('apply', real, rr, out / 'images'); assert o['changed'] == 'false' and snap(real) == before, 'a second publish of the same pictures changes nothing'
r, o = publish('check', real, rr); assert o['needed'] == 'false'
# the same pixels on a second capture (and a clean profile for each picture, so nothing carries over)
again = TMP / 'again'; r = py('capture.py', '--site', out / 'site', '--out', again, '--only', 'dashboard,tasks,habits,boards'); assert r.returncode == 0, r.stderr[-600:]
for n in ['desktop-dashboard.png', 'desktop-tasks.png', 'desktop-habits.png', 'desktop-boards.png', 'mobile-dashboard.png', 'mobile-tasks.png', 'mobile-habits.png', 'mobile-boards.png']:
    assert (again / n).read_bytes() == (out / 'images' / n).read_bytes(), 'identical on a second run: ' + n
r = py('capture.py', '--site', out / 'site', '--out', TMP / 'bad-name', '--only', 'nope'); assert r.returncode == 1 and 'no picture called' in r.stderr
r = py('capture.py', '--site', TMP / 'empty', '--out', TMP / 'bad-site'); assert r.returncode == 1 and 'does not exist' in r.stderr

# it stops, and writes no manifest, when the app misbehaves or reaches out
def poisoned(label, script):
    d = TMP / ('site-' + label); shutil.copytree(out / 'site', d); p = d / 'index.html'; h = p.read_text(encoding='utf-8'); assert '</body>' in h
    p.write_text(h.replace('</body>', f'<script>{script}</script></body>'), encoding='utf-8'); o = TMP / ('out-' + label)
    r = py('capture.py', '--site', d, '--out', o, '--only', 'dashboard'); assert r.returncode == 1 and not (o / 'manifest.json').exists(), (label, r.returncode, r.stdout[-200:], r.stderr[-300:])
    return r.stderr
e = poisoned('error', "setTimeout(function () { throw new Error('boom from the app'); }, 50)"); assert 'misbehaved' in e and 'boom from the app' in e, e
e = poisoned('console', "setTimeout(function () { console.error('the app complains'); }, 50)"); assert 'the app complains' in e, e
e = poisoned('reach-out', "fetch('https://example.invalid/track').catch(function () {})"); assert 'tried to reach https://example.invalid/track' in e, e

print(f'automated screenshots passed (fetch: newest stable release only, every wrong release stops without a fallback, safe unzip, waiting only when asked; publish: only changed pictures, identical run writes nothing, older never replaces newer, foreign/local/unverified refused with nothing written; capture: 18 distinct pictures in {time.time() - t0:.0f}s, identical on a second run, stops on an app error or an outside request)')
