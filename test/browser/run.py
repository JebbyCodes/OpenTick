import subprocess, sys, pathlib
here = pathlib.Path(__file__).parent; bad = 0
for t in sorted(here.glob('test_*.py')):
    r = subprocess.run([sys.executable, str(t)], cwd=here, capture_output=True, text=True); print(r.stdout.strip() or f'{t.name}: (no output)')
    if r.returncode: bad += 1; print(f'FAILED {t.name}\n{r.stderr[-1500:]}')
sys.exit(1 if bad else 0)
