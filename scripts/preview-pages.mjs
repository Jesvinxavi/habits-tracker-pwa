#!/usr/bin/env node
/**
 * Serves a GitHub Pages build at its real repository subpath. Vite preview
 * serves dist at "/", which makes /habits-tracker-pwa/assets/* return 404 and
 * prevents the generated service worker from ever registering.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const base = '/habits-tracker-pwa/';
const port = Number(process.env.PWA_PREVIEW_PORT || 4190);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function sendFile(response, file) {
  response.statusCode = 200;
  response.setHeader('Content-Type', contentTypes[extname(file)] || 'application/octet-stream');
  response.setHeader('Cache-Control', 'no-store');
  if (file.endsWith('/sw.js') || file.endsWith('sw.js')) {
    response.setHeader('Service-Worker-Allowed', base);
  }
  createReadStream(file).pipe(response);
}

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  if (!pathname.startsWith(base)) {
    response.statusCode = 302;
    response.setHeader('Location', base);
    response.end();
    return;
  }

  const relative = pathname.slice(base.length);
  const candidate = normalize(join(root, relative));
  if (!candidate.startsWith(root)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }

  if (relative && existsSync(candidate) && statSync(candidate).isFile()) {
    sendFile(response, candidate);
    return;
  }
  sendFile(response, join(root, 'index.html'));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Pages preview: http://127.0.0.1:${port}${base}`);
});
