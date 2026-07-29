import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../dist/', import.meta.url);

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

const files = filesBelow(root.pathname);
const artefacts = files.map((path) => {
  const bytes = readFileSync(path);
  return {
    path,
    name: relative(root.pathname, path),
    raw: bytes.length,
    gzip: gzipSync(bytes).length,
  };
});

const html = artefacts.find((item) => item.name === 'index.html');
const fitnessEntry = artefacts.find((item) => /assets\/fitness-core-.*\.js$/.test(item.name));
const fitnessModals = artefacts.filter((item) =>
  /assets\/(?:.*Modal|TimerModule)-.*\.js$/.test(item.name)
);
const largestJavaScript = artefacts
  .filter((item) => item.name.endsWith('.js'))
  .sort((left, right) => right.gzip - left.gzip)[0];
const serviceWorker = artefacts.find((item) => item.name === 'sw.js');

let precacheRaw = 0;
if (serviceWorker) {
  const source = readFileSync(serviceWorker.path, 'utf8');
  const urls = [...source.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]);
  precacheRaw = urls.reduce((total, url) => {
    const relativeUrl = url.replace(/^\/?habits-tracker-pwa\//, '').replace(/^\//, '');
    const match = artefacts.find((item) => item.name === relativeUrl);
    return total + (match?.raw || 0);
  }, 0);
}

const measurements = {
  htmlGzip: html?.gzip || 0,
  fitnessEntryGzip: fitnessEntry?.gzip || 0,
  fitnessModalsGzip: fitnessModals.reduce((total, item) => total + item.gzip, 0),
  largestJavaScriptGzip: largestJavaScript?.gzip || 0,
  precacheRaw,
};
const budgets = {
  htmlGzip: 18_000,
  fitnessEntryGzip: 25_000,
  fitnessModalsGzip: 30_000,
  largestJavaScriptGzip: 650_000,
  precacheRaw: serviceWorker ? 2_500_000 : Number.POSITIVE_INFINITY,
};

let failed = false;
Object.entries(measurements).forEach(([name, value]) => {
  const limit = budgets[name];
  const okay = value <= limit;
  failed ||= !okay;
  console.log(`${okay ? '✓' : '✗'} ${name}: ${value} bytes (budget ${limit})`);
});
if (!fitnessEntry || !html) {
  console.error('Expected build artefacts were not found. Run a build before this check.');
  failed = true;
}
if (failed) process.exitCode = 1;
