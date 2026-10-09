// Konnyu helyi szerver a Head Spa oldalak tesztjehez: NINCS dist/ (a build ~600 MB), a foglalas/*.html oldalakat a build logikajaval allitja ossze
// (fejlec / lablec / kozos CSS / aktiv menupont), az /assets, /salonic mappakat egyenesen a repobol szolgalja ki.
// A foglalo-reteg (launcher) a build resze, ezert itt nincs: a foglalo-gombok linkjeit a teszt maga ellenorzi.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain' };

export async function szerverInditas() {
  const { fejlecAtalakit, ANGOL_JELOLO, headspaJelolo } = await import(pathToFileURL(path.join(GYOKER, 'tools/fejlec-menu.mjs')).href);
  const fejlecCss = fs.readFileSync(path.join(GYOKER, 'assets/css/fejlec-lablec.css'), 'utf8');
  const aktivMenu = (fejlec, utvonal, mobil) => {
    const ut = utvonal.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    if (mobil) return fejlec;
    return fejlec.replace(/ data-is-current="true" aria-current="true"/g, ' data-is-current="false" aria-current="false"').replace(/ itemDepth02233374943--isCurrentPage/g, '')
      .replace(new RegExp(`( data-is-current=)"false"( aria-current=)"false"(><div class="itemShared2352141355__rootContainer(?: itemShared2352141355--isRow)?"><a data-item-label="true" data-testid="linkElement" href="${ut}" target="_self")`, 'g'), '$1"true"$2"true"$3');
  };
  const oldal = (nev, mobil) => {
    const f = path.join(GYOKER, 'foglalas', nev + '.html');
    if (!fs.existsSync(f)) return null;
    const forras = fs.readFileSync(f, 'utf8');
    const aktiv = (forras.match(/<!--mh-menu-aktiv:([^>]+?)-->/) || [])[1];
    const m = mobil ? 'mobil' : 'asztali';
    const resz = (jel, fajl) => (forras.includes(jel) ? fs.readFileSync(path.join(GYOKER, 'assets/fejlec', fajl + '.html'), 'utf8') : '');
    const angol = forras.includes(ANGOL_JELOLO);
    let fejlec = fejlecAtalakit(resz('<!--mh-fejlec-->', m), mobil, angol);
    if (mobil) fejlec = fejlec.replace('Októberi akció! - 20% kedvezmény minden headspa foglalásra + ajándékkártyára!', 'Októberi akció! 20% kedvezmény minden headspa + ajándékkártyára'); // mint a build mobil fejlece
    if (aktiv && fejlec) fejlec = aktivMenu(fejlec, aktiv, mobil);
    let lablec = fejlecAtalakit(resz('<!--mh-lablec-->', 'lablec-' + m), mobil, angol);
    const kozos = '<style data-forras="fejlec-lablec">' + fejlecCss + '</style>';
    if (fejlec) fejlec += kozos; else if (lablec) lablec += kozos;
    return headspaJelolo(forras.replace('<!--mh-fejlec-->', () => fejlec).replace('<!--mh-lablec-->', () => lablec), nev);
  };
  const szerver = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const mobil = /Mobile/i.test(req.headers['user-agent'] || '');
    if (p.startsWith('/assets/') || p.startsWith('/salonic/')) {
      const f = path.resolve(GYOKER, '.' + p);
      if (!f.startsWith(GYOKER) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nincs'); }
      const meret = fs.statSync(f).size; const t = TIPUS[path.extname(f)] || 'application/octet-stream';
      const range = req.headers.range;
      if (range) { const [a, b] = range.replace('bytes=', '').split('-'); const s = +a; const e = b ? +b : meret - 1; res.writeHead(206, { 'content-type': t, 'content-range': `bytes ${s}-${e}/${meret}`, 'accept-ranges': 'bytes', 'content-length': e - s + 1 }); return fs.createReadStream(f, { start: s, end: e }).pipe(res); }
      res.writeHead(200, { 'content-type': t, 'accept-ranges': 'bytes', 'content-length': meret }); return fs.createReadStream(f).pipe(res);
    }
    const h = oldal(p.replace(/^\/|\/$/g, '') || 'index', mobil);
    if (h === null) { res.writeHead(404); return res.end('nincs'); }
    res.writeHead(200, { 'content-type': TIPUS['.html'] }); res.end(h);
  }).listen(0);
  await new Promise((ok) => szerver.once('listening', ok));
  return { szerver, bazis: 'http://localhost:' + szerver.address().port };
}
