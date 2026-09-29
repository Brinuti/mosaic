// Statikus kiszolgalo a klon/ mappanak (a kepek/betuk a projekt gyokerebol jonnek).
// node tools/serve-klon.mjs   ->  http://localhost:4180/index.html
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const TIPUS = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.woff2':'font/woff2', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif',
  '.svg':'image/svg+xml', '.webp':'image/webp', '.avif':'image/avif', '.mp4':'video/mp4', '.webm':'video/webm', '.ico':'image/x-icon' };
createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  // /eredeti-mobil/<oldal>.html : az erintetlen Wix mobil-mentes
  if (p.startsWith('/eredeti-mobil/')) {
    const ny = path.join(ROOT, 'tools/raw-mobil', p.slice('/eredeti-mobil/'.length));
    if (existsSync(ny)) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return createReadStream(ny).pipe(res); }
  }
  // /mobil/<oldal>.html : a mobil klon
  if (p.startsWith('/mobil/')) {
    const mo = path.join(ROOT, 'klon-mobil', p.slice('/mobil/'.length));
    if (existsSync(mo)) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return createReadStream(mo).pipe(res); }
  }
  // /eredeti/<oldal>.html : az erintetlen Wix-mentes, osszehasonlitasi alapnak
  if (p.startsWith('/eredeti/')) {
    const nyers = path.join(ROOT, "tools/raw", p.slice('/eredeti/'.length));
    if (existsSync(nyers)) { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); return createReadStream(nyers).pipe(res); }
  }
  const jeloltek = [path.join(ROOT, 'klon', p), path.join(ROOT, p), path.join(ROOT, 'klon', p + '.html')];
  const f = jeloltek.find((x) => existsSync(x) && statSync(x).isFile());
  if (!f) { res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); return res.end('Nincs ilyen fajl: ' + p); }
  res.writeHead(200, { 'content-type': TIPUS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(f).pipe(res);
}).listen(4180, () => console.log('Klon: http://localhost:4180/index.html'));
