// Vendor the latest published stable OpenGantt release into vendor/opengantt/.
// OpenTick bundles the resulting standalone HTML locally, so runtime use is offline.
//
//   npm run sync:gantt            fetch and validate the latest stable release
//   npm run check:gantt           exit 1 if a newer stable release is available
//   node scripts/sync-opengantt.mjs --ref main   explicitly track a branch/commit instead
//
// The release tag is resolved to a commit SHA before downloading either file. Both
// Gantt.html and README.upstream.md therefore come from the same immutable commit.
// Files are only replaced after the release metadata, HTML, and format checks succeed.
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, unlinkSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const REPO = 'JebbyCodes/OpenGantt';
export const API = 'https://api.github.com';

// The subset of OpenGantt's documented chart format that OpenTick currently understands.
export const SUPPORTED = {
  rowKeys: ['label', 'plan', 'fact', 'children', 'notes'],
  scales: ['day', 'week', 'month', 'year'],
  options: ['scale', 'mode', 'height', 'padding', 'hatch', 'progress', 'collapsed', 'columns', 'table', 'title'],
  columns: ['progress', 'planStart', 'planEnd', 'actualStart', 'actualEnd', 'planDays', 'actualDays', 'variance', 'status', 'notes'],
  ignored: ['start', 'days', 'timezone', 'workdayStart', 'workdayEnd', 'today', 'events'],
};

const uniq = values => [...new Set(values)];
const ticks = value => [...value.matchAll(/`([^`]+)`/g)].map(match => match[1]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Extract the chart-format information documented in the upstream README. */
export function extractSpec(readme) {
  const spec = { rowKeys: [], scales: [], options: [], columns: [] };
  const rowKeys = readme.match(/Row keys:\s*([^\n]+)/i);
  if (rowKeys) spec.rowKeys = uniq(ticks(rowKeys[1]));
  const lines = readme.split(/\r?\n/);
  const isRow = line => /^\s*\|/.test(line);
  const cells = line => line.split('|').slice(1, -1).map(cell => cell.trim());
  const clean = cell => cell.replace(/[↕▾−⚙]/g, '').trim();
  let mode = null;
  for (const line of lines) {
    if (isRow(line)) {
      const columns = cells(line).map(clean);
      if (/^key\b/i.test(columns[0]) && /values/i.test(columns[1] || '')) { mode = 'options'; continue; }
      if (/^column\b/i.test(columns[0]) && /columns:/i.test(columns.join(' '))) { mode = 'columns'; continue; }
      if (/^-+$/.test((columns[0] || '').replace(/[:\s]/g, ''))) continue;
      if (mode === 'options') {
        const key = ticks(columns[0] || '')[0] || (columns[0] || '').replace(/[`−]/g, '').trim();
        if (key) {
          spec.options.push(key);
          if (key === 'scale') spec.scales = uniq(ticks(columns[1] || ''));
        }
      } else if (mode === 'columns') {
        for (const names of ticks(columns[columns.length - 1] || '')) {
          spec.columns.push(...names.split('/').map(name => name.trim()));
        }
      }
    } else if (mode) mode = null;
  }
  spec.options = uniq(spec.options);
  spec.columns = uniq(spec.columns);
  return spec;
}

/** Return upstream README features that OpenTick does not currently support. */
export function drift(spec, supported = SUPPORTED) {
  const result = [];
  const reportMissing = (what, found, known, extra = []) => {
    for (const key of found) if (!known.includes(key) && !extra.includes(key)) result.push(`${what} “${key}”`);
  };
  reportMissing('row key', spec.rowKeys, supported.rowKeys);
  reportMissing('scale', spec.scales, supported.scales);
  reportMissing('chart option', spec.options, supported.options, supported.ignored);
  reportMissing('table column', spec.columns, supported.columns);
  return result;
}

/** Compare version metadata without depending on the fetch timestamp. */
export function isSameUpstream(current, target) {
  if (!current || !target || current.commit !== target.sha) return false;
  if (target.kind === 'release') return current.release?.tag === target.release.tag;
  return current.ref === target.ref;
}

const here = dirname(fileURLToPath(import.meta.url));
const vend = join(here, '..', 'vendor', 'opengantt');
const metaPath = join(vend, 'UPSTREAM.json');

function headers(url, accept) {
  return {
    'user-agent': 'opentick-opengantt-sync',
    ...(accept ? { accept } : {}),
    ...(process.env.GITHUB_TOKEN && url.startsWith(API + '/') ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
}
async function get(url, accept) {
  const response = await fetch(url, { headers: headers(url, accept) });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.text()).slice(0, 300); } catch { /* no response body */ }
    throw new Error(`${url} → HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }
  return response;
}

/** GitHub's /releases/latest endpoint excludes drafts and prereleases. */
export async function latestStableRelease() {
  const release = await (await get(`${API}/repos/${REPO}/releases/latest`, 'application/vnd.github+json')).json();
  if (!release.tag_name || release.draft || release.prerelease) {
    throw new Error('GitHub did not return a published stable OpenGantt release');
  }
  const commit = await (await get(`${API}/repos/${REPO}/commits/${encodeURIComponent(release.tag_name)}`, 'application/vnd.github+json')).json();
  if (!commit.sha) throw new Error(`Could not resolve OpenGantt release tag ${release.tag_name} to a commit`);
  return {
    kind: 'release',
    ref: release.tag_name,
    sha: commit.sha,
    date: commit.commit?.committer?.date || '',
    message: (commit.commit?.message || '').split('\n')[0],
    release: {
      tag: release.tag_name,
      name: release.name || release.tag_name,
      url: release.html_url || `https://github.com/${REPO}/releases/tag/${encodeURIComponent(release.tag_name)}`,
      publishedAt: release.published_at || '',
    },
  };
}

/** Explicit ref override for maintainers who intentionally want a branch/commit. */
export async function resolveRef(ref) {
  const commit = await (await get(`${API}/repos/${REPO}/commits/${encodeURIComponent(ref)}`, 'application/vnd.github+json')).json();
  if (!commit.sha) throw new Error(`Could not resolve OpenGantt ref ${ref}`);
  return {
    kind: 'ref', ref, sha: commit.sha,
    date: commit.commit?.committer?.date || '',
    message: (commit.commit?.message || '').split('\n')[0],
    release: null,
  };
}

function readMeta() {
  try { return JSON.parse(readFileSync(metaPath, 'utf8')); } catch { return null; }
}

function validateHtml(buffer) {
  const html = buffer.toString('utf8');
  if (buffer.length < 5000 || buffer.length > 16 * 1024 * 1024 || !/<html[\s>]/i.test(html) || !/rows/.test(html)) {
    throw new Error('dist/Gantt.html does not look like the OpenGantt standalone app; no files were changed');
  }
}

function writeAtomically(files) {
  const temps = [];
  try {
    for (const [path, contents] of files) {
      mkdirSync(dirname(path), { recursive: true });
      const temp = `${path}.tmp-${process.pid}`;
      writeFileSync(temp, contents);
      temps.push([temp, path]);
    }
    for (const [temp, path] of temps) renameSync(temp, path);
  } catch (error) {
    for (const [temp] of temps) { try { unlinkSync(temp); } catch { /* already renamed or removed */ } }
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const refIndex = args.indexOf('--ref');
  const explicitRef = refIndex >= 0 ? args[refIndex + 1] : null;
  if (refIndex >= 0 && (!explicitRef || explicitRef.startsWith('--'))) {
    throw new Error('--ref requires a branch, tag, or commit SHA');
  }
  const checkOnly = args.includes('--check');
  const target = explicitRef ? await resolveRef(explicitRef) : await latestStableRelease();
  const current = readMeta();

  if (checkOnly) {
    if (isSameUpstream(current, target)) {
      console.log(`OpenGantt is up to date (${target.kind === 'release' ? target.release.tag : target.ref}, ${target.sha.slice(0, 7)}).`);
      return;
    }
    const installed = current ? `${current.release?.tag || current.ref || 'unknown'} / ${(current.commit || '').slice(0, 7)}` : 'nothing';
    const wanted = target.kind === 'release' ? `${target.release.tag} / ${target.sha.slice(0, 7)}` : `${target.ref} / ${target.sha.slice(0, 7)}`;
    console.log(`OpenGantt update available: installed ${installed}; latest target ${wanted}. Run: npm run sync:gantt`);
    process.exitCode = 1;
    return;
  }

  if (isSameUpstream(current, target) && existsSync(join(vend, 'Gantt.html')) && existsSync(join(vend, 'README.upstream.md'))) {
    console.log(`unchanged: OpenGantt ${target.kind === 'release' ? target.release.tag : target.ref} (${target.sha.slice(0, 7)})`);
    return;
  }

  // Fetch both files by immutable SHA so they cannot come from different upstream versions.
  const raw = path => `https://raw.githubusercontent.com/${REPO}/${target.sha}/${path}`;
  const html = Buffer.from(await (await get(raw('dist/Gantt.html'))).arrayBuffer());
  const readme = await (await get(raw('README.md'))).text();
  validateHtml(html);
  if (!readme.includes('OpenGantt') || readme.length < 1000) throw new Error('Upstream README.md failed validation; no files were changed');
  const spec = extractSpec(readme);
  const differences = drift(spec);
  const metadata = {
    repo: REPO,
    source: target.kind,
    ref: target.ref,
    commit: target.sha,
    commitDate: target.date,
    message: target.message,
    release: target.release,
    fetched: new Date().toISOString(),
    bytes: html.length,
    sha256: sha256(html),
    spec,
    drift: differences,
  };

  writeAtomically([
    [join(vend, 'Gantt.html'), html],
    [join(vend, 'README.upstream.md'), readme],
    [metaPath, `${JSON.stringify(metadata, null, 2)}\n`],
  ]);

  console.log(`updated: OpenGantt ${target.kind === 'release' ? target.release.tag : target.ref} (${target.sha.slice(0, 7)}, ${(html.length / 1024).toFixed(0)} KB)`);
  if (differences.length) {
    console.warn(`\nThe upstream README documents features OpenTick does not yet understand:\n  - ${differences.join('\n  - ')}\nThe upstream standalone pane is still bundled, but review these changes before merging.`);
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `drift=${differences.length}\n`, { flag: 'a' });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => { console.error(`OpenGantt sync failed: ${error.message || error}`); process.exit(1); });
}
