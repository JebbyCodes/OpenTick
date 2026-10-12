// Generates every platform icon (src-tauri/icons) from your logo: src/logo.png, or the src/icon.svg placeholder.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const logo = existsSync(join(root, 'src', 'logo.png')) ? 'src/logo.png' : 'src/icon.svg';
if (logo.endsWith('.svg')) console.warn('! src/logo.png not found: generating icons from the src/icon.svg placeholder.');
console.log('icons from', logo);
const r = spawnSync('npx', ['tauri', 'icon', logo], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
