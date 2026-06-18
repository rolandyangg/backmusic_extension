// Installs the built app into the local Spicetify CustomApps dir and applies it.
// Run via `npm run install-local` (which builds first).
//
// Resolves the Spicetify config dir from `spicetify path userdir`, falling back to the
// platform default. Copies manifest.json + dist/index.js into CustomApps/backmusic, then
// registers the app and runs `spicetify apply`.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(__dirname, '..');
const APP = 'backmusic';

function sh(args) {
  return execFileSync('spicetify', args, { encoding: 'utf8' }).trim();
}

function configDir() {
  try {
    // Newer Spicetify: prints the user config dir.
    const dir = sh(['path', 'userdir']);
    if (dir && existsSync(dir)) return dir;
  } catch {
    // fall through to defaults
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'spicetify');
  }
  return path.join(os.homedir(), '.config', 'spicetify');
}

const customApps = path.join(configDir(), 'CustomApps');
const dest = path.join(customApps, APP);
mkdirSync(dest, { recursive: true });

cpSync(path.join(repo, 'manifest.json'), path.join(dest, 'manifest.json'));
cpSync(path.join(repo, 'index.js'), path.join(dest, 'index.js'));
console.log(`Copied app → ${dest}`);

try {
  sh(['config', 'custom_apps', APP]);
} catch (e) {
  // Already registered, or config syntax differs across versions — non-fatal.
  console.warn('Could not auto-register custom_apps (may already be set):', e.message);
}

execFileSync('spicetify', ['apply'], { stdio: 'inherit' });
console.log('Applied. Look for the backmusic icon in the Spotify sidebar.');
