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
import { existsSync, readFileSync } from 'node:fs';
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

const html = readFileSync(indexPath, 'utf8');
const assetPath = html.match(/(?:href|src)="(\/[^"]*\/assets\/[^"]+)"/)?.[1];
if (assetPath) {
  fail([
    `dist/ was built for a subpath (${assetPath.slice(0, assetPath.indexOf('/assets/') + 1)}), not for a local server.`,
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
