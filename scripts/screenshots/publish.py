#!/usr/bin/env python3
"""Puts the screenshots that capture.py took into the repository, but only when they really are new, and says what it did.

    python3 scripts/screenshots/publish.py check --release .build/shots/release.json
    python3 scripts/screenshots/publish.py apply --release .build/shots/release.json --images .build/shots/images [--pr-body .build/shots/pr-body.md] [--dry-run]

check   Do the pictures in the repository already show this release? Prints `needed=true|false` (and writes it to $GITHUB_OUTPUT). It looks only at the release the
        fetch step verified, so the workflow can stop before it installs a browser. A release whose pictures are already published is not captured again (a different
        browser version would redraw the same app with different pixels and fill a pull request with noise); --force captures it anyway. The pictures of an OLDER release
        never replace the pictures of a newer one (--force allows it).
apply   Checks that the pictures are the ones this release's app made (same version, exactly the expected set, right sizes, the checksums capture.py wrote), then writes
          docs/images/screenshots/<viewport>-<page>.png      only the files whose bytes differ
          docs/images/screenshots/metadata.json              which release (tag, version, link, the zip's SHA-256), the fixed date and sizes, every picture's SHA-256
          README.md and docs/SCREENSHOTS.md                  only the parts between the screenshots markers
        and removes the hand-made README pictures these replace (once, the first time). If nothing at all would change it writes nothing and says `changed=false`.
Refuses (exit code 1, with the reason): pictures taken from a local zip instead of a release, a release the fetch step did not verify, pictures that are not that release's.
Standard library only (it reads a PNG's size from its header)."""
import argparse, hashlib, json, os, re, struct, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = 'docs/images/screenshots'
META = DEST + '/metadata.json'
README, DOC = 'README.md', 'docs/SCREENSHOTS.md'
README_MARK = ('<!-- screenshots:start -->', '<!-- screenshots:end -->')
DOC_MARK = ('<!-- screenshots:list:start -->', '<!-- screenshots:list:end -->')
PAGES = ['dashboard', 'tasks', 'notes', 'calendar', 'habits', 'boards', 'sections', 'packs', 'integrations']        # must match SCENES in capture.py (a test checks)
SIZES = {'desktop': (1440, 900), 'mobile': (780, 1688)}                                                              # pixels: 1440x900 at 1x, 390x844 at 2x
EXPECTED = [f'{vp}-{p}.png' for vp in SIZES for p in PAGES]
# what each picture shows, for the alt text and the docs table
WHAT = {
    'dashboard': 'The dashboard: today, the week and the projects at a glance',
    'tasks': "Today's tasks, with one open for editing",
    'notes': 'Notes, with a note open next to the list',
    'calendar': "The calendar's month view with tasks on their days",
    'habits': 'Habits and their streaks',
    'boards': 'A board: cards moving from To do to Done',
    'sections': 'A custom section built from a pack: a reading list',
    'packs': 'Settings: the packs added to the app',
    'integrations': 'Settings: connecting other apps (off until you allow it)',
}
README_DESKTOP = [['dashboard', 'tasks', 'calendar'], ['boards', 'notes', 'habits']]
README_MOBILE = ['dashboard', 'tasks', 'notes', 'habits']
LEGACY = ['docs/images/' + n for n in ('tasks.png', 'calendar.png', 'timeline.png', 'pins.png', 'sound.png')]   # the hand-made README pictures this replaces
SEMVER = re.compile(r'^\d+\.\d+\.\d+$')

def fail(msg):
    if os.environ.get('GITHUB_ACTIONS'): print(f'::error title=Screenshots::{msg}')
    print('ERROR: ' + msg, file=sys.stderr); sys.exit(1)

def say_output(**kv):
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as f:
            for k, v in kv.items(): f.write(f'{k}={v}\n')

def semver(v): return tuple(int(x) for x in v.split('.'))
def sha256(b): return hashlib.sha256(b).hexdigest()

def png_size(data, what):
    if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR': fail(f'{what} is not a PNG picture.')
    return struct.unpack('>II', data[16:24])

def load_release(path):
    try: r = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError) as e: fail(f'cannot read {path}: {e}')
    if not isinstance(r, dict): fail(f'{path} is not what fetch-release.py writes.')
    if r.get('local'): fail('these pictures were taken from a LOCAL zip, not from a release: they are never published.')
    v, a, ok = r.get('version'), r.get('asset') or {}, r.get('verified') or {}
    if not isinstance(v, str) or not SEMVER.match(v) or r.get('tag') != 'v' + v: fail(f'{path}: the release has no plain version (tag {r.get("tag")!r}, version {v!r}).')
    if not (isinstance(a.get('sha256'), str) and re.fullmatch(r'[0-9a-f]{64}', a['sha256']) and a.get('name') == f'OpenTick_{v}_web.zip' and isinstance(a.get('size'), int)): fail(f'{path}: the web zip is not described properly.')
    if not (ok.get('size') and ok.get('sha256sums')): fail('the web zip was not verified against the release (its size and the SHA256SUMS.txt line must both have been checked), so nothing is published.')
    return r

def read_meta(root):
    p = root / META
    if not p.is_file(): return None
    try: m = json.loads(p.read_text(encoding='utf-8'))
    except ValueError: return None
    rel = m.get('release') if isinstance(m, dict) else None
    return m if isinstance(rel, dict) and isinstance(rel.get('version'), str) and isinstance((rel.get('asset') or {}).get('sha256'), str) else None

def cmd_check(a):
    rel, root = load_release(a.release), Path(a.repo_root).resolve()
    cur = read_meta(root); need, why = True, f'no pictures are published yet; OpenTick {rel["version"]} is the first set' if cur is None else ''
    if cur is not None:
        cv, cs = cur['release']['version'], cur['release']['asset']['sha256']
        if a.force: why = f'--force: capturing {rel["version"]} again (published: {cv})'
        elif cs == rel['asset']['sha256']: need, why = False, f'the pictures in the repository already show this release ({rel["tag"]}, the same zip, SHA-256 {cs[:12]}…): nothing to do'
        elif SEMVER.match(cv) and semver(cv) > semver(rel['version']): need, why = False, f'the pictures in the repository show OpenTick {cv}, which is newer than {rel["version"]}: they are not replaced (--force does it)'
        else: why = f'the pictures show OpenTick {cv}; the release is {rel["version"]}'
    print(('capture needed: ' if need else 'up to date: ') + why)
    say_output(needed='true' if need else 'false', version=rel['version'], tag=rel['tag'])

# ---------- what the repository gets ----------
def metadata(rel, man, sizes):
    return {'opentick': 'screenshots', 'format': 1,
            'release': {'version': rel['version'], 'tag': rel['tag'], 'url': rel.get('url') or '', 'publishedAt': rel.get('publishedAt') or '',
                        'asset': {'name': rel['asset']['name'], 'size': rel['asset']['size'], 'sha256': rel['asset']['sha256']}},
            'capture': {'frozenAt': man.get('frozenAt'), 'viewports': man.get('viewports')},
            'images': {n: {'sha256': man['images'][n]['sha256'], 'width': sizes[n][0], 'height': sizes[n][1]} for n in EXPECTED}}

def alt(vp, p): return f'{WHAT[p]} ({"phone" if vp == "mobile" else "desktop"})'
def img(vp, p, width, base=DEST): return f'<img src="{base}/{vp}-{p}.png" width="{width}" alt="{alt(vp, p)}">'

def readme_block(meta):
    v = meta['release']['version']
    rows = ['<p align="center">\n  ' + '\n  '.join(img('desktop', p, '32%') for p in row) + '\n</p>' for row in README_DESKTOP]
    rows.append('<p align="center">\n  ' + '\n  '.join(img('mobile', p, '19%') for p in README_MOBILE) + '\n</p>')
    rows.append(f'<p align="center"><sub>Screenshots of OpenTick {v}, taken automatically from the released web app (<a href="docs/SCREENSHOTS.md">how</a>). Everything in them is invented demo data.</sub></p>')
    return '<!-- Generated by scripts/screenshots/publish.py (workflow "Update screenshots"). Edit the workflow or the scenes, not this block. -->\n' + '\n'.join(rows)

def doc_block(meta):
    r = meta['release']; link = f'[{r["tag"]}]({r["url"]})' if r.get('url') else r['tag']
    out = ['<!-- Generated by scripts/screenshots/publish.py. Edit the workflow or the scenes, not this block. -->',
           f'These are pictures of **OpenTick {r["version"]}** ({link}), taken from that release\'s web zip `{r["asset"]["name"]}` (SHA-256 `{r["asset"]["sha256"]}`), '
           f'with invented data and the clock stopped at {meta["capture"]["frozenAt"]}. [`metadata.json`](images/screenshots/metadata.json) records this and a SHA-256 for every picture.', '',
           '| Page | Desktop | Phone |', '|---|---|---|']
    for p in PAGES: out.append(f'| **{p.capitalize()}**<br>{WHAT[p]} | {img("desktop", p, "420", "images/screenshots")} | {img("mobile", p, "130", "images/screenshots")} |')
    return '\n'.join(out)

def replace_block(text, marks, block, where):
    s, e = marks
    if text.count(s) != 1 or text.count(e) != 1 or text.index(s) > text.index(e): fail(f'{where} must contain exactly one {s} followed by one {e}. Put them back around the screenshots and run again.')
    i, j = text.index(s) + len(s), text.index(e)
    return text[:i] + '\n' + block + '\n' + text[j:]

def pr_body(meta, rel, written, removed, legacy):
    r = meta['release']; ok = ', '.join(k for k, v in (rel.get('verified') or {}).items() if v)
    lines = [f'Fresh screenshots of **OpenTick {r["version"]}**, taken automatically from the released web app.', '',
             f'- Release: {r["url"] or r["tag"]}', f'- Web zip: `{r["asset"]["name"]}`, SHA-256 `{r["asset"]["sha256"]}`', f'- Checked before use: {ok} (the workflow also verified the signed build attestation)',
             f'- Viewports: desktop {SIZES["desktop"][0]}×{SIZES["desktop"][1]}, phone 390×844 at 2×; clock stopped at {meta["capture"]["frozenAt"]}; clean browser profile for every picture; invented demo data only',
             f'- Pictures that changed: {len(written)} of {len(EXPECTED)}' + (f' ({", ".join(written)})' if written and len(written) < len(EXPECTED) else '')]
    if removed: lines.append(f'- Removed pictures that no page or release shows any more: {", ".join(removed)}')
    if legacy: lines.append(f'- Replaced the hand-made README pictures ({", ".join(Path(p).name for p in legacy)}); the smartwatch picture is still made by hand')
    lines += ['', 'Please look at the pictures in the *Files changed* tab before merging: this workflow checks that they are of the right release and that the app raised no errors, not that they look right.', '',
              'Generated by `.github/workflows/update-screenshots.yml`. Nothing here was written by a person.']
    return '\n'.join(lines) + '\n'

def cmd_apply(a):
    rel, root = load_release(a.release), Path(a.repo_root).resolve(); imgs = Path(a.images).resolve()
    try: man = json.loads((imgs / 'manifest.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as e: fail(f'cannot read {imgs / "manifest.json"}: {e} (run capture.py first).')
    if man.get('appVersion') != rel['version']: fail(f'the pictures were taken of OpenTick {man.get("appVersion")!r} but the release is {rel["version"]}: they are not this release\'s.')
    if sorted((man.get('images') or {})) != sorted(EXPECTED): fail(f'the pictures are not the expected set. Expected {len(EXPECTED)}: {", ".join(EXPECTED)}.')
    present = sorted(f.name for f in imgs.glob('*.png'))
    if present != sorted(EXPECTED): fail(f'the folder {imgs} holds {", ".join(present) or "no pictures"}, not exactly the expected set.')
    data, sizes = {}, {}
    for n in EXPECTED:
        b = (imgs / n).read_bytes(); w, h = png_size(b, n)
        if sha256(b) != man['images'][n]['sha256']: fail(f'{n} is not the file capture.py wrote (its SHA-256 differs from manifest.json).')
        if (w, h) != SIZES[n.split('-')[0]]: fail(f'{n} is {w}×{h} pixels, not {SIZES[n.split("-")[0]][0]}×{SIZES[n.split("-")[0]][1]}.')
        data[n], sizes[n] = b, (w, h)
    cur = read_meta(root)
    if cur is not None and not a.force and semver(cur['release']['version']) > semver(rel['version']): fail(f'the repository shows OpenTick {cur["release"]["version"]}, newer than {rel["version"]}: not replacing it (--force does).')

    meta = metadata(rel, man, sizes); meta_text = json.dumps(meta, indent=2, sort_keys=True) + '\n'
    plan = {}                                                   # path (relative to the repo) -> new bytes
    written = [n for n in EXPECTED if not (root / DEST / n).is_file() or (root / DEST / n).read_bytes() != data[n]]
    for n in written: plan[f'{DEST}/{n}'] = data[n]
    if not (root / META).is_file() or (root / META).read_text(encoding='utf-8') != meta_text: plan[META] = meta_text.encode('utf-8')
    texts = {}
    for path, marks, block in ((README, README_MARK, readme_block(meta)), (DOC, DOC_MARK, doc_block(meta))):
        p = root / path
        if not p.is_file(): fail(f'{path} does not exist.')
        old = p.read_text(encoding='utf-8'); new = replace_block(old, marks, block, path)
        if new != old: plan[path] = new.encode('utf-8'); texts[path] = new
    destdir = root / DEST
    removed = sorted(f.name for f in destdir.glob('*.png') if f.name not in EXPECTED) if destdir.is_dir() else []
    readme_after = texts.get(README) or (root / README).read_text(encoding='utf-8')
    legacy = [p for p in LEGACY if (root / p).is_file() and p not in readme_after]   # only when nothing in the README shows them any more (the full path: `desktop-tasks.png` is not `tasks.png`)
    if not plan and not removed and not legacy:
        print(f'no changes: the pictures, metadata and pages for OpenTick {rel["version"]} are exactly what the repository already has.')
        say_output(changed='false', version=rel['version'], tag=rel['tag']); return
    print(f'OpenTick {rel["version"]}: ' + (f'{len(written)} picture(s) changed' if written else 'no picture changed') + (f', {len(removed)} removed' if removed else '') + (f', {len(legacy)} hand-made picture(s) replaced' if legacy else '') + '; ' + ', '.join(sorted(plan)))
    if a.pr_body: Path(a.pr_body).write_text(pr_body(meta, rel, written, removed, legacy), encoding='utf-8')
    if a.dry_run: print('(dry run: nothing written)'); say_output(changed='true', version=rel['version'], tag=rel['tag']); return
    destdir.mkdir(parents=True, exist_ok=True)
    for path, b in plan.items():
        t = root / path; t.parent.mkdir(parents=True, exist_ok=True); tmp = t.with_name(t.name + '.tmp'); tmp.write_bytes(b); os.replace(tmp, t)
    for n in removed: (destdir / n).unlink()
    for p in legacy: (root / p).unlink()
    say_output(changed='true', version=rel['version'], tag=rel['tag'])

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0]); sub = ap.add_subparsers(dest='cmd', required=True)
    for name, fn in (('check', cmd_check), ('apply', cmd_apply)):
        p = sub.add_parser(name); p.set_defaults(fn=fn)
        p.add_argument('--release', required=True); p.add_argument('--repo-root', default=str(ROOT)); p.add_argument('--force', action='store_true')
        if name == 'apply': p.add_argument('--images', required=True); p.add_argument('--pr-body', default=''); p.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(); a.fn(a)

if __name__ == '__main__':
    main()
