#!/usr/bin/env node
// Writes the status table that closes every Release run: one line per stage, what it did, and whether it was needed.
// A release run has about twenty jobs, so "which one went wrong, and did it matter?" is otherwise a hunt through the run graph.
//
//   NEEDS='<toJSON(needs)>' node scripts/release/run-summary.mjs >> "$GITHUB_STEP_SUMMARY"
//
// NEEDS is GitHub's own `needs` context for the job: { "<job>": { "result": "success|failure|cancelled|skipped", "outputs": { ... } }, ... }.
// The script only reads and prints; it exits 0 whatever the results are, because the run is already red when a required stage failed.
import { fileURLToPath } from 'node:url';

// [job id, what it is, group, how much it matters]  required = the release is not made without it; optional = it may fail or be skipped.
export const STAGES = [
  ['prepare', 'Tag, code and CHANGELOG agree', 'Check', 'required'],
  ['tests', 'Unit, browser and Rust tests', 'Check', 'required'],
  ['desktop', 'Windows, macOS and Linux', 'Build', 'required'],
  ['android', 'Android APKs and App Bundle', 'Build', 'required'],
  ['web', 'Website zips', 'Build', 'required'],
  ['docker', 'Docker image files', 'Build', 'required'],
  ['snap', 'Snap packages', 'Build', 'required'],
  ['msix-bundle', 'Microsoft Store bundle', 'Build', 'required'],
  ['ios', 'iPhone / iPad (.ipa)', 'Build', 'optional'],
  ['watch', 'Wear OS and Tizen packages', 'Build', 'optional'],
  ['release', 'GitHub Release', 'Release', 'required'],
  ['publish-docker', 'Docker registry (ghcr.io)', 'Publish', 'optional'],
  ['publish-snap', 'Snap Store', 'Publish', 'optional'],
  ['publish-microsoft-store', 'Microsoft Store', 'Publish', 'optional'],
  ['publish-chocolatey', 'Chocolatey', 'Publish', 'optional'],
  ['publish-scoop', 'Scoop', 'Publish', 'optional'],
  ['publish-winget', 'Winget', 'Publish', 'optional'],
];

const ICON = { success: '✅', failure: '❌', cancelled: '🚫', skipped: '⏭️' };
const WORD = { success: 'passed', failure: 'failed', cancelled: 'cancelled', skipped: 'skipped' };
const icon = r => ICON[r] || '❔';

// `needs` is the parsed context. Returns the markdown and the lists a caller (or a test) may want.
export function summarise(needs, { repo = '', runUrl = '' } = {}) {
  needs = needs || {};
  const out = (needs.prepare && needs.prepare.outputs) || {};
  const tag = out.tag || '', publish = out.publish === 'true', stable = out.stable !== 'false';
  const res = id => (needs[id] && needs[id].result) || 'skipped';
  const failedRequired = [], failedOptional = [];
  for (const [id, , , level] of STAGES) if (res(id) === 'failure' || res(id) === 'cancelled') (level === 'required' ? failedRequired : failedOptional).push(id);
  const released = res('release') === 'success';

  let headline;
  if (released) headline = `✅ **${tag || 'The release'} was released.**`;
  else if (res('prepare') !== 'success') headline = '❌ **Nothing was built: the tag could not be checked.** Read the *Check the tag* job.';
  else if (failedRequired.length) headline = `❌ **No release was made.** A required stage failed: ${failedRequired.map(s => '`' + s + '`').join(', ')}.`;
  else if (!publish) headline = '🧪 **Dry run: everything was built and tested, nothing was released.** The files are in this run\'s artifacts.';
  else headline = '⚠️ **The release was not made** although no stage failed. Open the *GitHub Release* job.';

  const lines = [`## ${tag ? 'Release ' + tag : 'Release'}`, '', headline, ''];
  if (released && failedOptional.length) lines.push(`Optional stages that did not work: ${failedOptional.map(s => '`' + s + '`').join(', ')}. The release was still made; their files (or store uploads) are missing.`, '');
  if (released && !stable) lines.push('This is a **pre-release**: it goes to the Snap Store `beta` channel and is not sent to the Microsoft Store, Chocolatey, Scoop or Winget.', '');

  let group = '';
  lines.push('| Stage | Result | What it is |', '|---|---|---|');
  for (const [id, what, g, level] of STAGES) {
    const r = res(id);
    // a stable-only publisher that was skipped on a pre-release is expected, not a gap
    const note = r === 'skipped' && !stable && /^publish-(microsoft-store|chocolatey|scoop|winget)$/.test(id) ? ' (stable releases only)'
      : r === 'skipped' && id.startsWith('publish-') && !released ? ' (waits for the release)' : '';
    const label = (g !== group ? `**${g}** · ` : '') + '`' + id + '`' + (level === 'optional' ? ' *(optional)*' : '');
    group = g;
    lines.push(`| ${label} | ${icon(r)} ${WORD[r] || r} | ${what}${note} |`);
  }
  lines.push('');
  if (runUrl) lines.push(`[Open this run](${runUrl})${repo ? ' · ' + repo : ''}`, '');
  return { markdown: lines.join('\n'), released, failedRequired, failedOptional, publish, stable, tag };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let needs = {};
  try { needs = JSON.parse(process.env.NEEDS || '{}'); } catch (e) { console.error('NEEDS is not JSON: ' + e.message); }
  const repo = process.env.GITHUB_REPOSITORY || '', run = process.env.GITHUB_RUN_ID || '', srv = process.env.GITHUB_SERVER_URL || 'https://github.com';
  process.stdout.write(summarise(needs, { repo, runUrl: repo && run ? `${srv}/${repo}/actions/runs/${run}` : '' }).markdown + '\n');
}
