#!/usr/bin/env node
/**
 * Serves the built app from dist/ for local testing.
 *
 *   node scripts/preview.mjs            → http://localhost:4180 on this machine
 *   node scripts/preview.mjs --phone    → also reachable from your phone on this Wi-Fi
 *
 * Before serving anything it checks that dist/ was built for a local server. A
 * GitHub Pages build has /<repo>/ baked into every asset URL in index.html, so
 * serving it from the root returns 404 for all of them and the page renders as
 * unstyled HTML that never finishes loading. That failure looks like a broken
 * app rather than a wrong build, so it is caught here instead.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, watch } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'dist', 'index.html');
const phone = process.argv.includes('--phone');
const PORT = 4180;

/**
 * Stops with an explanation instead of serving something that cannot work.
 * @param {string[]} lines Message lines.
 * @returns {never}
 */
function fail(lines) {
  console.error(`\n${lines.join('\n')}\n`);
  process.exit(1);
}

if (!existsSync(indexPath)) {
  fail([
    'No build found at dist/index.html.',
    '',
    '  npm run preview:local   build for a local server, then serve it',
    '  npm run preview:phone   the same, reachable from your phone',
  ]);
}

/**
 * Returns the subpath a build was made for, or null when it targets the root.
 * @param {string} html Contents of dist/index.html.
 * @returns {string|null} The base path, e.g. "/habits-tracker-pwa/".
 */
function subpathOf(html) {
  const assetPath = html.match(/(?:href|src)="(\/[^"]*\/assets\/[^"]+)"/)?.[1];
  return assetPath ? assetPath.slice(0, assetPath.indexOf('/assets/') + 1) : null;
}

const subpath = subpathOf(readFileSync(indexPath, 'utf8'));
if (subpath) {
  fail([
    `dist/ was built for a subpath (${subpath}), not for a local server.`,
    'Served from the root, every stylesheet and script in it 404s.',
    '',
    '  npm run build:local     rebuild for a local server',
    '  npm run build:pages     that subpath build is for GitHub Pages only',
  ]);
}

/**
 * Finds this machine's address on the local network.
 * @returns {string|null} An IPv4 address, or null when offline.
 */
function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

const host = phone ? '0.0.0.0' : '127.0.0.1';
const lan = phone ? lanAddress() : null;

console.log('');
console.log(`  This machine   http://localhost:${PORT}`);
if (phone) {
  console.log(
    lan
      ? `  Your phone     http://${lan}:${PORT}   (same Wi-Fi)`
      : '  Your phone     unavailable — this machine has no network address'
  );
  console.log('');
  console.log('  If the phone shows an old version, clear that site\'s data:');
  console.log('  a service worker from an earlier Pages build may still be cached.');
}
console.log('');

const vite = spawn(
  'npx',
  ['vite', 'preview', '--host', host, '--port', String(PORT), '--strictPort'],
  { cwd: root, stdio: 'inherit' }
);
vite.on('exit', (code) => process.exit(code ?? 0));

// The check above only covers the build that existed at startup. `test:pwa` and
// `check:bundle:pages` both write a Pages build into the same dist/, so a long
// running preview silently starts serving one: index.html loads, every asset
// resolves to the SPA fallback, and the app renders as unstyled HTML on whatever
// device is pointed at it. Watching for it turns a baffling symptom into a line
// of output naming the cause.
let warnedAboutSubpath = false;
watch(indexPath, () => {
  let current;
  try {
    current = subpathOf(readFileSync(indexPath, 'utf8'));
  } catch {
    return; // mid-write; the next event will have the finished file
  }
  if (current && !warnedAboutSubpath) {
    warnedAboutSubpath = true;
    console.error(
      [
        '',
        `  dist/ has been replaced by a subpath build (${current}).`,
        '  This preview is now serving an app whose assets cannot load.',
        '  `npm run test:pwa` and `npm run check:bundle:pages` both do this.',
        '',
        '    npm run build:local     restore a build this server can serve',
        '',
        '  A device that loaded the broken page may also have registered its',
        "  service worker. Clear that site's data there before retrying.",
        '',
      ].join('\n')
    );
  } else if (!current && warnedAboutSubpath) {
    warnedAboutSubpath = false;
    console.log('\n  dist/ is a local build again — reload the page.\n');
  }
});
