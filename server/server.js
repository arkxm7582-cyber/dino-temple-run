// ---------------------------------------------------------------
// server.js  (Week 4 - Interoperability)
// A small Node.js web server for the finished game. It does two jobs:
//   1. sends the built game files from the "dist" folder
//   2. passes /fish-api/api.php on to the real Fish API (a "proxy")
//
// The game normally calls the Fish API directly (the API allows it with
// CORS). This proxy is the backup route, used if a network blocks the
// direct call: the browser asks this server, and this server asks the API.
//
// Run it with:  npm run build  then  npm run serve   (http://localhost:8080)
// ---------------------------------------------------------------
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const FISH_API = 'https://www.marcconrad.com/uob/fish/api.php?out=json&base64=yes';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Job 2: ask the real Fish API and send its answer back to the browser.
async function proxyFishApi(res) {
  try {
    const apiResponse = await fetch(FISH_API, { signal: AbortSignal.timeout(10000) });
    const text = await apiResponse.text();
    res.writeHead(apiResponse.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(text);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Fish API unreachable', detail: err.message }));
  }
}

// Job 1: send a file from the dist folder (index.html if not found).
async function sendFile(res, path) {
  let file = normalize(join(DIST, decodeURIComponent(path)));
  if (!file.startsWith(DIST)) {
    // stops requests like /../../secret.txt from leaving the dist folder
    res.writeHead(403);
    res.end();
    return;
  }
  if (path === '/') file = join(DIST, 'index.html');
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    try {
      res.writeHead(200, { 'Content-Type': TYPES['.html'] });
      res.end(await readFile(join(DIST, 'index.html')));
    } catch {
      res.writeHead(404);
      res.end('Not found - run "npm run build" first.');
    }
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/fish-api/api.php') return proxyFishApi(res);
  return sendFile(res, url.pathname);
}).listen(PORT, () => {
  console.log(`Dino Temple Run running on http://localhost:${PORT}`);
});
