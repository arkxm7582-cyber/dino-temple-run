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

async function sendFile(res, path) {
  let file = normalize(join(DIST, decodeURIComponent(path)));
  if (!file.startsWith(DIST)) {
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
