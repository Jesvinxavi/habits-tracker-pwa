import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BUDGETS, evaluateBudgets, formatBudgetResult } from './bundleBudgets.mjs';

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
  htmlGzip: html?.gzip,
  fitnessEntryGzip: fitnessEntry?.gzip,
  fitnessModalsGzip: fitnessModals.reduce((total, item) => total + item.gzip, 0),
  largestJavaScriptGzip: largestJavaScript?.gzip,
  // Only a Pages build emits a service worker. A local build has nothing to
  // precache, which is not a regression.
  ...(serviceWorker ? { precacheRaw } : {}),
};
const budgets = { ...BUDGETS };
if (!serviceWorker) delete budgets.precacheRaw;

const { results, failed } = evaluateBudgets(measurements, budgets);
results.forEach((result) => console.log(formatBudgetResult(result)));
if (results.some((result) => result.value === null)) {
  console.error('Expected build artefacts were not found. Run a build before this check.');
}
if (failed) process.exitCode = 1;
