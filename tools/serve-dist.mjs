// A dist/ helyi kiszolgalasa pontosan ugy, ahogy a Netlify edge-fuggvenye teszi
// (Wix-szel azonos, kiterjesztes nelkuli cimek, mobil/asztali a user agent szerint).
//   node tools/serve-dist.mjs [port]      (alapbol 4191)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { utvonal } from '../netlify/edge-functions/utvonal.js';

const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const PORT = +(process.argv[2] || 4191);
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml',
  '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

export function fajlUtvonal(pathname, ua) {
  const d = utvonal(pathname, ua);
  if (d && d.atiranyit) return { atiranyit: d.atiranyit };
  let f = d ? d.atir : pathname;
  if (!path.extname(f)) f += '.html';
  return { fajl: path.join(DIST, f) };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST') { res.writeHead(200); return res.end('ok'); }
    const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers['user-agent']);
    if (e.atiranyit) { res.writeHead(301, { location: encodeURI(e.atiranyit) + u.search }); return res.end(); }
    fs.readFile(e.fajl, (hiba, adat) => {
      if (hiba) { res.writeHead(404); return res.end('nincs'); }
      res.writeHead(200, { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream' });
      res.end(adat);
    });
  }).listen(PORT, () => console.log('http://localhost:' + PORT));
}
