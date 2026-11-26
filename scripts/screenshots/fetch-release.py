#!/usr/bin/env python3
"""Fetches the web app of the latest STABLE OpenTick release, checks it, and unpacks it, so the screenshots show the application people actually download.

    python3 scripts/screenshots/fetch-release.py --out .build/shots            latest stable release of JebbyCodes/OpenTick
    python3 scripts/screenshots/fetch-release.py --out .build/shots --tag v0.9.1   one particular stable release

What it does, in order, and what makes it stop (with a message that says what is wrong and exit code 1; there is NO fallback to the source in the repository):
  1. asks the GitHub Releases API for the releases and picks the newest one that is not a draft and not a pre-release (--tag: that one, which must also be stable);
  2. takes the asset named exactly  OpenTick_<version>_web.zip  (never the e-ink or watch editions) and downloads it;
  3. verifies it: the size the API reports, the SHA-256 digest the API reports (when it reports one), and the line for the file in the release's SHA256SUMS.txt. The
     release must publish SHA256SUMS.txt, and every value that exists must agree. (The workflow also verifies the signed build attestation with `gh attestation verify`.)
  4. unpacks it safely (no path outside the folder, no links, bounded size) into <out>/site and checks it is the web edition of THAT version
     (index.html and manifest.webmanifest exist and carry the release's version number; not the e-ink or watch edition);
  5. keeps the verified zip as <out>/OpenTick_<version>_web.zip (the workflow checks its signed attestation with `gh attestation verify`), and writes <out>/release.json:
     which release, which file, its SHA-256, when it was published, and which checks passed.

    --from-zip FILE --version X.Y.Z   FOR LOCAL TRYOUTS ONLY: use a zip you built yourself (see docs/SCREENSHOTS.md). Nothing is verified against a release, release.json says
                                      "local": true, and publish.py refuses to put such screenshots into the repository. The workflow never uses this.
    --wait SECONDS                    when the release is there but its zip or SHA256SUMS.txt is not listed YET (a release published by an event that fires while the files are still uploading),
                                      ask again every 15 seconds (OPENTICK_SHOTS_POLL changes that) for up to this long. Only that case waits; every other problem stops at once, and when the time is up it stops with the same message.
    --api URL                         the API address (tests point it at a stand-in server); --token-env NAME  the variable holding a token (default GITHUB_TOKEN; optional).
Standard library only."""
import argparse, hashlib, json, os, re, shutil, stat, sys, tempfile, time, urllib.error, urllib.request, zipfile
from pathlib import Path

MAX_ZIP = 50 * 1024 * 1024          # the web zip is about 2 MB; anything near this is not it
MAX_UNZIPPED, MAX_FILES = 100 * 1024 * 1024, 500
POLL = float(os.environ.get('OPENTICK_SHOTS_POLL') or 15)   # seconds between asks while --wait is waiting (the tests make it short)
SEMVER = re.compile(r'^\d+\.\d+\.\d+$')

def fail(msg):
    if os.environ.get('GITHUB_ACTIONS'): print(f'::error title=Screenshots::{msg}')
    print('ERROR: ' + msg, file=sys.stderr); sys.exit(1)

def api_get(url, token):
    h = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'opentick-screenshots'}
    if token: h['Authorization'] = 'Bearer ' + token
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60) as r: return json.load(r)
    except urllib.error.HTTPError as e: fail(f'the GitHub API answered {e.code} for {url} ({e.reason}).')
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e: fail(f'could not read {url}: {e}')

def download(url, dest, limit):
    """Streams a file to disk and returns (size, sha256). No Authorization header is sent: release files are public and the address redirects to another host."""
    h, n = hashlib.sha256(), 0
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'opentick-screenshots'}), timeout=120) as r, open(dest, 'wb') as f:
            while True:
                chunk = r.read(65536)
                if not chunk: break
                n += len(chunk)
                if n > limit: fail(f'{url} is bigger than {limit} bytes: refusing it.')
                h.update(chunk); f.write(chunk)
    except urllib.error.HTTPError as e: fail(f'downloading {url} answered {e.code} ({e.reason}).')
    except (urllib.error.URLError, TimeoutError) as e: fail(f'downloading {url} failed: {e}')
    return n, h.hexdigest()

def pick_release(releases, tag):
    stable = [r for r in releases if isinstance(r, dict) and not r.get('draft') and not r.get('prerelease')]
    if tag:
        for r in releases:
            if isinstance(r, dict) and r.get('tag_name') == tag:
                if r.get('draft') or r.get('prerelease'): fail(f'release {tag} is a {"draft" if r.get("draft") else "pre-release"}: screenshots are only taken from stable releases.')
                return r
        fail(f'there is no release with the tag {tag}.')
    if not stable: fail('there is no stable release (every release is a draft or a pre-release, or there is none).')
    return max(stable, key=lambda r: r.get('published_at') or r.get('created_at') or '')

class Missing(Exception):
    """The release exists but a file it must have is not listed (yet)."""

def locate(base, token, tag):
    """The stable release to use and its two files. Raises Missing for a file that is not (yet) there; every other problem stops here with a message."""
    rel = pick_release(api_get(f'{base}/releases?per_page=50', token), tag)
    tg = rel.get('tag_name') or ''; version = tg[1:] if tg.startswith('v') else tg
    if not SEMVER.match(version): fail(f'the release tag {tg!r} is not a plain version like v1.2.3.')
    name = f'OpenTick_{version}_web.zip'
    assets = [x for x in rel.get('assets') or [] if isinstance(x, dict)]
    match = [x for x in assets if x.get('name') == name]
    if not match: raise Missing(f'release {tg} has no {name}. It has: {", ".join(sorted(str(x.get("name")) for x in assets)) or "no files"}. Not falling back to the source: fix the release or run the workflow once it is attached.')
    if len(match) > 1: fail(f'release {tg} has {len(match)} files named {name}.')
    if match[0].get('state') not in (None, 'uploaded'): raise Missing(f'{name} is not fully uploaded (state {match[0].get("state")!r}).')
    sums = [x for x in assets if x.get('name') == 'SHA256SUMS.txt']
    if not sums: raise Missing(f'release {tg} does not publish SHA256SUMS.txt, so {name} cannot be checked against it.')
    if len(sums) > 1: fail(f'release {tg} publishes {len(sums)} files named SHA256SUMS.txt.')
    return rel, tg, version, name, match[0], sums[0]

def sums_line(text, name):
    found = []
    for line in text.splitlines():
        m = re.match(r'^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$', line)
        if m and m.group(2) == name: found.append(m.group(1).lower())
    return found

def unpack(zip_path, dest, version):
    """Unpacks and checks. When anything is wrong the half-unpacked folder is deleted again, so a failed run leaves nothing that looks usable."""
    try: return _unpack(zip_path, dest, version)
    except SystemExit:
        shutil.rmtree(dest, ignore_errors=True); raise

def _unpack(zip_path, dest, version):
    if dest.exists(): shutil.rmtree(dest)
    dest.mkdir(parents=True)
    try: z = zipfile.ZipFile(zip_path)
    except zipfile.BadZipFile: fail('the downloaded file is not a zip file.')
    with z:
        infos = z.infolist()
        if len(infos) > MAX_FILES: fail(f'the zip holds {len(infos)} files; the web edition has a handful.')
        if sum(i.file_size for i in infos) > MAX_UNZIPPED: fail('the zip would unpack to more than 100 MB: refusing it.')
        root = dest.resolve()
        for i in infos:
            name = i.filename
            if name.startswith(('/', '\\')) or '\\' in name or re.match(r'^[A-Za-z]:', name) or '..' in Path(name).parts: fail(f'the zip has an unsafe path ({name!r}): refusing it.')
            if stat.S_ISLNK(i.external_attr >> 16): fail(f'the zip contains a link ({name!r}): refusing it.')
            target = (root / name).resolve()
            if root != target and root not in target.parents: fail(f'the zip has a path outside its folder ({name!r}): refusing it.')
            if i.is_dir(): target.mkdir(parents=True, exist_ok=True); continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(i) as src, open(target, 'wb') as out: shutil.copyfileobj(src, out)
    for need in ('index.html', 'manifest.webmanifest'):
        if not (dest / need).is_file(): fail(f'the web zip has no {need} at its top level: it is not the OpenTick web edition.')
    html = (dest / 'index.html').read_text(encoding='utf-8', errors='replace')
    found = re.search(r'window\.OT=(\{.*?\});?</script>', html, re.S)   # the build puts {version, built, logo, [eink|watch]} here
    try: meta = json.loads(found.group(1)) if found else None
    except ValueError: meta = None
    if not isinstance(meta, dict) or not isinstance(meta.get('version'), str): fail('index.html does not say which OpenTick version it is.')
    if meta['version'] != version: fail(f'index.html is OpenTick {meta["version"]}, but the release is {version}.')
    if meta.get('eink') or meta.get('watch'): fail('this is the e-ink or smartwatch edition, not the standard web edition.')
    try: manifest = json.loads((dest / 'manifest.webmanifest').read_text(encoding='utf-8'))
    except ValueError: fail('manifest.webmanifest is not valid JSON.')
    if manifest.get('version') != version: fail(f'manifest.webmanifest says version {manifest.get("version")!r}, not {version}.')
    return meta

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--repo', default='JebbyCodes/OpenTick'); ap.add_argument('--out', required=True); ap.add_argument('--tag', default='')
    ap.add_argument('--api', default='https://api.github.com'); ap.add_argument('--token-env', default='GITHUB_TOKEN'); ap.add_argument('--wait', type=int, default=0)
    ap.add_argument('--from-zip', default=''); ap.add_argument('--version', default='')
    a = ap.parse_args()
    out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        if a.from_zip:
            if not SEMVER.match(a.version): fail('--from-zip needs --version X.Y.Z.')
            zp = Path(tmp) / 'local.zip'; shutil.copyfile(a.from_zip, zp); size, sha = zp.stat().st_size, hashlib.sha256(zp.read_bytes()).hexdigest()
            print('WARNING: using a local zip. This is NOT a release: nothing is verified and these screenshots cannot be published.')
            unpack(zp, out / 'site', a.version)
            info = {'local': True, 'repo': '', 'tag': '', 'version': a.version, 'asset': {'name': Path(a.from_zip).name, 'size': size, 'sha256': sha}, 'verified': {'size': False, 'digest': False, 'sha256sums': False}}
        else:
            token = os.environ.get(a.token_env, '')
            base = f'{a.api.rstrip("/")}/repos/{a.repo}'
            deadline = time.monotonic() + max(0, a.wait)
            while True:
                try: rel, tag, version, name, asset, sums_asset = locate(base, token, a.tag); break
                except Missing as e:
                    if time.monotonic() >= deadline: fail(str(e))
                    print(f'waiting for the release files: {e}', flush=True); time.sleep(POLL)
            zp = Path(tmp) / name
            size, sha = download(asset['browser_download_url'], zp, MAX_ZIP)
            checks = {}
            if asset.get('size') is None: fail(f'the API does not report a size for {name}.')
            if size != asset['size']: fail(f'{name} is {size} bytes but the release says {asset["size"]}: the download is damaged.')
            checks['size'] = True
            dig = asset.get('digest')
            if dig:
                if not str(dig).startswith('sha256:') or str(dig)[7:].lower() != sha: fail(f'the SHA-256 of {name} ({sha}) is not the digest GitHub lists ({dig}).')
                checks['digest'] = True
            else: checks['digest'] = False
            sp = Path(tmp) / 'SHA256SUMS.txt'; download(sums_asset['browser_download_url'], sp, 1024 * 1024)
            found = sums_line(sp.read_text(encoding='utf-8', errors='replace'), name)
            if len(found) != 1: fail(f'SHA256SUMS.txt has {len(found)} lines for {name}; expected exactly one.')
            if found[0] != sha: fail(f'the SHA-256 of {name} ({sha}) is not the one in SHA256SUMS.txt ({found[0]}).')
            checks['sha256sums'] = True
            unpack(zp, out / 'site', version)
            shutil.copyfile(zp, out / name)   # kept (outside site/) so the workflow can check its signed attestation: the same bytes that were just verified
            info = {'local': False, 'repo': a.repo, 'tag': tag, 'version': version, 'name': rel.get('name') or '', 'url': rel.get('html_url') or '', 'publishedAt': rel.get('published_at') or '',
                    'asset': {'name': name, 'size': size, 'sha256': sha}, 'verified': checks}
    (out / 'release.json').write_text(json.dumps(info, indent=2) + '\n', encoding='utf-8')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as f: f.write(f'version={info["version"]}\ntag={info["tag"]}\n')
    print(f'OpenTick {info["version"]}: {info["asset"]["name"]} ({info["asset"]["size"]} bytes, sha256 {info["asset"]["sha256"][:16]}…) verified: ' + ', '.join(k for k, v in info['verified'].items() if v) + (' (LOCAL ZIP: nothing verified)' if info['local'] else '') + f' -> {out / "site"}')

if __name__ == '__main__':
    main()
