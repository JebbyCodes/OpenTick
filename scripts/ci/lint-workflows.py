#!/usr/bin/env python3
"""Checks the GitHub workflow files for the mistakes that otherwise only show up as a red run after a tag is pushed.

    python3 scripts/ci/lint-workflows.py            lint .github/workflows and .github/actions
    python3 scripts/ci/lint-workflows.py FILE...    lint just these

It is not actionlint (that needs a download), but it catches what has actually gone wrong in this repository: bad YAML, `needs:` on a job
that does not exist, `${{ steps.x.outputs.y }}` with no step x, `${{ inputs.z }}` that the workflow never declares, reusable workflows called
with missing or unknown inputs, local files (scripts, actions, workflows) that are not there, actions that are not pinned to a version,
download-artifact names that no upload-artifact makes, and unbalanced `${{ }}`.
Needs PyYAML (preinstalled on GitHub's runners).
"""
import fnmatch, re, sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
WF = ROOT / '.github' / 'workflows'
errors = []

def err(f, where, msg):
    errors.append(f'{f.relative_to(ROOT)}: {where}: {msg}')

def load(f):
    try:
        return yaml.safe_load(f.read_text(encoding='utf-8'))
    except yaml.YAMLError as e:
        err(f, 'yaml', str(e).replace('\n', ' '))

def triggers(doc):
    on = doc.get('on', doc.get(True))  # PyYAML reads the key `on` as True
    return on if isinstance(on, dict) else {k: None for k in (on if isinstance(on, list) else [on])}

def declared_inputs(doc):
    out = {}
    for t in ('workflow_call', 'workflow_dispatch'):
        for k, v in ((triggers(doc).get(t) or {}).get('inputs') or {}).items():
            out.setdefault(k, {'required': False})
            out[k]['required'] = out[k]['required'] or bool((v or {}).get('required') and 'default' not in (v or {}))
            out[k][t] = True
    return out

def strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)

EXPR = re.compile(r'\$\{\{(.*?)\}\}', re.S)
uploads = []  # artifact name patterns made anywhere

def collect_uploads(doc):
    for job in (doc.get('jobs') or {}).values():
        for s in (job or {}).get('steps') or []:
            if str(s.get('uses', '')).startswith('actions/upload-artifact'):
                n = (s.get('with') or {}).get('name')
                if n:
                    uploads.append(EXPR.sub('*', str(n)))

def lint_workflow(f, doc, all_docs):
    if not isinstance(doc, dict):
        return err(f, 'file', 'not a mapping')
    for k in ('name', 'jobs'):
        if k not in doc:
            err(f, 'top level', f'missing `{k}`')
    if 'permissions' not in doc:
        err(f, 'top level', 'no top-level `permissions:` (default token rights are too wide)')
    if not triggers(doc):
        err(f, 'top level', 'no `on:`')
    jobs = doc.get('jobs') or {}
    inputs = declared_inputs(doc)
    for name, job in jobs.items():
        w = f'job {name}'
        if not isinstance(job, dict):
            err(f, w, 'not a mapping'); continue
        if ('runs-on' in job) == ('uses' in job):
            err(f, w, 'needs exactly one of `runs-on` or `uses`')
        needs = job.get('needs') or []
        for n in ([needs] if isinstance(needs, str) else needs):
            if n not in jobs:
                err(f, w, f'needs unknown job `{n}`')
        if 'uses' in job:
            target = ROOT / str(job['uses'])[2:]
            if not str(job['uses']).startswith('./') or not target.exists():
                err(f, w, f'`uses: {job["uses"]}` is not a workflow in this repository')
            else:
                callee = all_docs.get(target)
                cin = declared_inputs(callee) if isinstance(callee, dict) else {}
                given = job.get('with') or {}
                for k in given:
                    if k not in cin:
                        err(f, w, f'passes input `{k}` that {target.name} does not declare')
                for k, v in cin.items():
                    if v['required'] and v.get('workflow_call') and k not in given:
                        err(f, w, f'does not pass required input `{k}` to {target.name}')
                if isinstance(callee, dict) and 'workflow_call' not in triggers(callee):
                    err(f, w, f'{target.name} has no `workflow_call:` trigger')
        ids = set()
        for i, s in enumerate(job.get('steps') or []):
            sw = f'{w}, step {i + 1} ({s.get("name") or s.get("uses") or "run"})'
            if s.get('id'):
                if s['id'] in ids:
                    err(f, sw, f'duplicate step id `{s["id"]}`')
                ids.add(s['id'])
            u = s.get('uses')
            if u:
                if u.startswith('./'):
                    if not (ROOT / u[2:] / 'action.yml').exists():
                        err(f, sw, f'local action {u} has no action.yml')
                elif '@' not in u:
                    err(f, sw, f'`uses: {u}` is not pinned to a version')
                elif u.split('@')[1] in ('main', 'master', 'latest'):
                    err(f, sw, f'`uses: {u}` follows a moving branch')
                if u.startswith('actions/download-artifact'):
                    w2 = s.get('with') or {}
                    raw = str(w2.get('name') or w2.get('pattern') or '')
                    mx = (job.get('strategy') or {}).get('matrix') or {}
                    names = [raw]
                    m = re.fullmatch(r'\$\{\{\s*matrix\.([\w-]+)\s*\}\}', raw)
                    if m:  # one name per matrix row
                        names = [str(inc[m.group(1)]) for inc in mx.get('include', []) if m.group(1) in inc]
                    for pat in filter(None, (EXPR.sub('*', n) for n in names)):
                        if not any(fnmatch.fnmatch(x, pat) or fnmatch.fnmatch(pat, x) for x in uploads):
                            err(f, sw, f'downloads artifact `{pat}` but nothing uploads one with that name')
            if not u and 'run' not in s:
                err(f, sw, 'has neither `uses` nor `run`')
            for m in re.finditer(r'(?:node|python3?|bash|pwsh)\s+(\./)?((?:scripts|packaging|snap|docker)/[\w./-]+)', str(s.get('run', ''))):
                if not (ROOT / m.group(2)).exists():
                    err(f, sw, f'runs {m.group(2)}, which does not exist')
            for m in re.finditer(r'(?<![\w/])\./((?:scripts|packaging)/[\w./-]+\.(?:ps1|sh|mjs|py))', str(s.get('run', ''))):
                if not (ROOT / m.group(1)).exists():
                    err(f, sw, f'runs ./{m.group(1)}, which does not exist')
            for m in re.finditer(r'steps\.([\w-]+)\.outputs', ' '.join(strings(s))):
                if m.group(1) not in {x.get('id') for x in job.get('steps') or []}:
                    err(f, sw, f'refers to steps.{m.group(1)}, which is not a step id in this job')
    # expressions anywhere in the file
    text = f.read_text(encoding='utf-8')
    if text.count('${{') != text.count('}}') - len(re.findall(r'\}\}\}', text)) * 0 and text.count('${{') > text.count('}}'):
        err(f, 'expressions', 'unbalanced `${{ }}`')
    for m in re.finditer(r'\binputs\.([\w-]+)', ' '.join(EXPR.findall(text))):
        if m.group(1) not in inputs:
            err(f, 'expressions', f'`inputs.{m.group(1)}` is never declared under on.workflow_call / on.workflow_dispatch')
    for m in re.finditer(r'needs\.([\w-]+)\.(?:outputs\.([\w-]+)|result)', ' '.join(EXPR.findall(text))):
        j = jobs.get(m.group(1))
        if j is None:
            err(f, 'expressions', f'`needs.{m.group(1)}` is not a job')
        elif m.group(2) and m.group(2) not in (j.get('outputs') or {}):
            err(f, 'expressions', f'`needs.{m.group(1)}.outputs.{m.group(2)}` is not an output of that job')
    for m in re.finditer(r'\bmatrix\.([\w-]+)', ' '.join(EXPR.findall(text))):
        keys = set()
        for job in jobs.values():
            mx = ((job or {}).get('strategy') or {}).get('matrix') or {}
            keys |= set(mx) | {k for inc in mx.get('include', []) for k in inc}
        if m.group(1) not in keys:
            err(f, 'expressions', f'`matrix.{m.group(1)}` is not a matrix key anywhere in this file')

def lint_action(f, doc):
    if not isinstance(doc, dict) or doc.get('runs', {}).get('using') != 'composite':
        return err(f, 'file', 'expected a composite action')
    for i, s in enumerate(doc['runs'].get('steps') or []):
        if 'run' in s and 'shell' not in s:
            err(f, f'step {i + 1}', 'composite `run` steps need `shell:`')
        for m in re.finditer(r'\binputs\.([\w-]+)', ' '.join(strings(s))):
            if m.group(1) not in (doc.get('inputs') or {}):
                err(f, f'step {i + 1}', f'`inputs.{m.group(1)}` is not declared')

def main():
    wfs = [Path(a).resolve() for a in sys.argv[1:]] or sorted(WF.glob('*.y*ml'))
    acts = sorted((ROOT / '.github' / 'actions').glob('*/action.y*ml')) if not sys.argv[1:] else []
    docs = {f: load(f) for f in sorted(WF.glob('*.y*ml'))}
    for f in wfs:
        docs.setdefault(f, load(f))
    for d in docs.values():
        if isinstance(d, dict):
            collect_uploads(d)
    for f in wfs:
        if docs.get(f) is not None:
            lint_workflow(f, docs[f], docs)
    for f in acts:
        d = load(f)
        if d is not None:
            lint_action(f, d)
    if errors:
        print('\n'.join(errors)); print(f'\n{len(errors)} problem(s) in the workflow files.'); sys.exit(1)
    print(f'{len(wfs)} workflow file(s) and {len(acts)} action(s) look consistent.')

main()
