#!/usr/bin/env node
// Writes the body of a GitHub release: what is new (from CHANGELOG.md), a downloads table built from the files that really exist,
// and how to verify them. GitHub's own "What's changed" list (commits and pull requests) is appended by the release step.
//
//   node scripts/release/release-notes.mjs --tag v0.5.1 --dir release-files --out release-notes.md
//   node scripts/release/release-notes.mjs --tag v0.5.1 --check          fail if the changelog has no section for the tag, or still says TODO
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changelogSection } from './bump-version.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (n, d = '') => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const REPO = process.env.GITHUB_REPOSITORY || 'JebbyCodes/OpenTick';

// [platform, label, filename test]. The first rule that matches a file wins; the order is the order of the table.
export const RULES = [
  ['Windows', '64-bit installer (.exe)', /_x64-setup\.exe$/], ['Windows', '64-bit installer (.msi)', /_x64_en-US\.msi$/], ['Windows', '64-bit portable (.zip)', /_x64-portable\.zip$/], ['Windows', '64-bit Store package (.msix)', /_x64\.msix$/],
  ['Windows', '32-bit installer (.exe)', /_x86-setup\.exe$/], ['Windows', '32-bit portable (.zip)', /_x86-portable\.zip$/], ['Windows', '32-bit Store package (.msix)', /_x86\.msix$/],
  ['Windows', 'ARM64 installer (.exe)', /_arm64-setup\.exe$/], ['Windows', 'ARM64 portable (.zip)', /_arm64-portable\.zip$/], ['Windows', 'ARM64 Store package (.msix)', /_arm64\.msix$/],
  ['Windows', 'Store bundle, all CPUs (.msixbundle)', /\.msixbundle$/],
  ['macOS', 'Apple Silicon + Intel (.dmg)', /\.dmg$/],
  ['Linux', '64-bit AppImage', /_amd64\.AppImage$/], ['Linux', '64-bit Debian / Ubuntu (.deb)', /_amd64\.deb$/], ['Linux', '64-bit Fedora / openSUSE (.rpm)', /\.x86_64\.rpm$/], ['Linux', '64-bit Snap', /_amd64\.snap$/],
  ['Linux', 'ARM64 AppImage', /_aarch64\.AppImage$/], ['Linux', 'ARM64 Debian / Ubuntu (.deb)', /_arm64\.deb$/], ['Linux', 'ARM64 Fedora / openSUSE (.rpm)', /\.aarch64\.rpm$/], ['Linux', 'ARM64 Snap', /_arm64\.snap$/],
  ['Android', 'Any phone (universal .apk)', /_android-universal\.apk$/], ['Android', 'Modern phones, 64-bit ARM (.apk)', /_android-arm64-v8a\.apk$/], ['Android', 'Older phones, 32-bit ARM (.apk)', /_android-armeabi-v7a\.apk$/],
  ['Android', 'Intel / emulator 64-bit (.apk)', /_android-x86_64\.apk$/], ['Android', 'Intel 32-bit (.apk)', /_android-x86\.apk$/], ['Android', 'E-ink devices (.apk)', /_android-eink-universal\.apk$/], ['Android', 'App Bundle for stores (.aab)', /\.aab$/],
  ['iOS', 'iPhone / iPad (.ipa)', /\.ipa$/],
  ['Docker', '64-bit Intel / AMD image (.tar.gz)', /_docker-amd64\.tar\.gz$/], ['Docker', '64-bit ARM image (.tar.gz)', /_docker-arm64\.tar\.gz$/],
  ['Docker', '32-bit ARM image, ARMv7 (.tar.gz)', /_docker-armv7\.tar\.gz$/], ['Docker', '32-bit Intel image (.tar.gz)', /_docker-i386\.tar\.gz$/],
  ['Docker', 'Compose file for this version (.yml)', /_docker-compose\.yml$/],
  ['Web / self-hosting', 'Static website (.zip)', /_web\.zip$/], ['Web / self-hosting', 'E-ink website (.zip)', /_web-eink\.zip$/],
  ['Packages', 'Chocolatey (.nupkg)', /\.nupkg$/],
];
// Docker's text needs the version and the registry address, so it is built from the tag
const dockerNote = tag => {
  const v = tag.replace(/^v/, ''), image = `ghcr.io/${REPO.split('/')[0].toLowerCase()}/opentick`;
  return `**From the registry** (one tag covers every CPU; Docker picks the right one):\n\n\`\`\`sh\ndocker run -d -p 8080:8080 --name opentick ${image}:${v}\n\`\`\`\n\n`
    + `Open http://localhost:8080 (the e-ink edition is at \`/eink/\`). \`${image}:latest\` always follows the newest stable release. Registry page: https://github.com/${REPO}/pkgs/container/opentick\n\n`
    + `**Without registry access:** download the file for your CPU, then \`gunzip -c OpenTick_${v}_docker-<cpu>.tar.gz | docker load\` and run it as above. Not sure which CPU? Run \`uname -m\`: x86_64 is **amd64**, aarch64 is **arm64**, armv7l is **armv7**, i686 is **i386**. `
    + `The compose file starts it with \`docker compose -f OpenTick_${v}_docker-compose.yml up -d\`.`;
};
const NOTES = {
  Windows: 'Pick the **installer** unless you know you want something else. The `.msix` files are for the Microsoft Store; the portable zip needs no install (settings are kept in your user profile).',
  macOS: 'One download for both Apple Silicon and Intel. The app is not notarised: right-click it and choose Open the first time.',
  Linux: 'The AppImage runs anywhere: `chmod +x` it and run it. There is no 32-bit desktop build (the Tauri web view does not support it): use the Docker image or the web app on those machines.',
  Android: 'Android 7 or newer. Not sure which? Take **universal**. 32-bit phones need the `armeabi-v7a` file. The e-ink build starts in [e-ink mode](https://github.com/' + REPO + '#e-ink); it can be switched off in Settings.',
  Docker: dockerNote,
  iOS: 'Built and signed with the maintainers\' Apple developer account, so it installs only on devices that account has registered (or through TestFlight). Without that, build it yourself: see docs/RELEASING.md.',
};
const fmtSize = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

export function downloadsTable(files, tag) {
  const sizes = new Map(files.map(f => [f.name, f.size])), used = new Set(), by = new Map();
  for (const [platform, label, re] of RULES) for (const f of files) if (re.test(f.name) && !used.has(f.name)) { used.add(f.name); (by.get(platform) || by.set(platform, []).get(platform)).push([label, f.name]); }
  const dl = n => `https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(n)}`;
  let out = '';
  for (const [platform, rows] of by) {
    out += `\n#### ${platform}\n\n| Download | File | Size |\n|---|---|---|\n` + rows.map(([l, n]) => `| ${l} | [${n}](${dl(n)}) | ${fmtSize(sizes.get(n))} |`).join('\n') + '\n';
    const note = typeof NOTES[platform] === 'function' ? NOTES[platform](tag) : NOTES[platform];
    if (note) out += `\n${note}\n`;
  }
  const rest = files.filter(f => !used.has(f.name) && f.name !== 'SHA256SUMS.txt');
  if (rest.length) out += `\n#### Other files\n\n` + rest.map(f => `- [${f.name}](${dl(f.name)}) (${fmtSize(f.size)})`).join('\n') + '\n';
  return out;
}

export function buildNotes({ tag, files, changelog }) {
  const v = tag.replace(/^v/, ''), body = changelogSection(changelog, v);
  const h = [];
  h.push(`## What's new in ${v}\n\n${body || '_No release notes were written for this version._'}`);
  if (files.length) h.push(`## Downloads\n${downloadsTable(files, tag)}`);
  h.push(`## Also available\n\n- **Microsoft Store**, **Chocolatey** (\`choco install opentick\`), **Scoop**, **Winget**: Windows\n- **Snap Store** (\`sudo snap install opentick\`): Linux\n- **Web app**: https://${REPO.split('/')[0].toLowerCase()}.github.io/${REPO.split('/')[1]}/ ([e-ink version](https://${REPO.split('/')[0].toLowerCase()}.github.io/${REPO.split('/')[1]}/eink/))`);
  h.push(`## Verify your download\n\nEvery file is listed in \`SHA256SUMS.txt\` (\`sha256sum -c SHA256SUMS.txt\`) and carries a signed build-provenance attestation: \`gh attestation verify <file> --repo ${REPO}\`.`);
  return h.join('\n\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tag = arg('tag'); if (!/^v\d+\.\d+\.\d+/.test(tag)) { console.error('--tag vX.Y.Z is required'); process.exit(2); }
  const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), v = tag.replace(/^v/, ''), sec = changelogSection(changelog, v);
  if (process.argv.includes('--check')) {
    if (sec == null) { console.error(`CHANGELOG.md has no "## ${v}" section. Write what is new (or run: npm run version:sync), commit, and move the tag.`); process.exit(1); }
    if (/\bTODO\b/.test(sec)) { console.error(`CHANGELOG.md "## ${v}" still says TODO. Describe the release, commit, and move the tag.`); process.exit(1); }
    console.log(`Release notes for ${tag}: ${sec.split('\n').filter(l => /^\s*[-*] /.test(l)).length} items.`); process.exit(0);
  }
  const dir = arg('dir'), files = dir && existsSync(dir) ? readdirSync(dir).filter(n => !n.startsWith('.')).sort().map(n => ({ name: n, size: readFileSync(join(dir, n)).length })) : [];
  const md = buildNotes({ tag, files, changelog }); writeFileSync(arg('out', 'release-notes.md'), md); console.log(`Wrote ${arg('out', 'release-notes.md')} (${files.length} files listed).`);
}
