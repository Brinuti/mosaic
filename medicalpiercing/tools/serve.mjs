// Helyi kiszolgalo a dist/ mappahoz, ugyanazzal az utvonal-logikaval, mint a
// Cloudflare-fuggveny (lib/utvonal.js).
//
//   node tools/build.mjs && node tools/serve.mjs     -> http://localhost:4290/
//
// A mobil valtozat a bongeszo azonositojatol fugg (telefonos user agent), vagy
// probahoz a ?nezet=mobil lekerdezessel is kerheto.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { utvonal } from '../lib/utvonal.js';
import { TABLAZAT_CSV, osszesSor } from '../lib/kitelepulesek.js';
import { TRUSTINDEX_TARTALOM, ertekelesAdat } from '../lib/ertekeles.js';

// DIST=<mappa> mas build kiszolgalasara (pl. elotte / utana osszeveteshez, tools/klon-regresszio.mjs)
const DIST = process.env.DIST ? path.resolve(process.env.DIST) : path.resolve(import.meta.dirname, '../dist');
const PORT = +process.env.PORT || 4290;
const TIPUS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };

const kuld = (res, f, status = 200) => {
  res.writeHead(status, { 'content-type': TIPUS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(f).pipe(res);
};
createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  // az urlap-vegpont helyben csak naplozza a bekuldest (elesben: functions/[[path]].js -> e-mail)
  if (req.method === 'POST' && url.pathname === '/api/urlap') {
    let n = 0;
    req.on('data', (d) => { n += d.length; });
    req.on('end', () => { console.log(`urlap bekuldve (${n} bajt)`); res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); });
    return;
  }
  // a kitelepulesek idopontjai a tablazatbol (elesben: functions/[[path]].js)
  if (req.method === 'GET' && url.pathname === '/api/kitelepulesek') {
    fetch(TABLAZAT_CSV).then((v) => (v.ok ? v.text() : Promise.reject(new Error('HTTP ' + v.status))))
      .then((csv) => { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(osszesSor(csv))); })
      .catch((e) => { res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ hiba: e.message })); });
    return;
  }
  // a Google-ertekeles a Trustindex-widgetbol (elesben: functions/[[path]].js)
  if (req.method === 'GET' && url.pathname === '/api/ertekeles') {
    fetch(TRUSTINDEX_TARTALOM).then((v) => (v.ok ? v.text() : Promise.reject(new Error('HTTP ' + v.status))))
      .then((h) => { const a = ertekelesAdat(h); if (!a) throw new Error('a widget fejlece nem olvashato'); res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(a)); })
      .catch((e) => { res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ hiba: e.message })); });
    return;
  }
  // a modellnap foglaloja (/api/modell/*, /mf/<kod>): helyben memoriaban futo SQLite-tal (tools/modell-d1.mjs); a host localhost, ezert elonezeti kornyezet (level nem megy ki)
  if (url.pathname.startsWith('/api/modell/') || url.pathname.startsWith('/mf/')) {
    const chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', async () => {
      try {
        const { d1 } = await import('./modell-d1.mjs');
        const { api, foglalasOldal } = await import('../lib/modell/vegpont.js');
        globalThis.__modellDb ??= d1();
        const env = { MP_MERES_DB: globalThis.__modellDb, MP_MERES_ADMIN_KULCS: 'helyi-teszt' };
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const request = new Request('http://localhost:' + PORT + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
        const valasz = url.pathname.startsWith('/mf/') ? await foglalasOldal(request, env) : await api(request, env, {});
        res.writeHead(valasz.status, Object.fromEntries(valasz.headers));
        res.end(Buffer.from(await valasz.arrayBuffer()));
      } catch (e) { console.error('modell:', e); res.writeHead(500); res.end('hiba'); }
    });
    return;
  }
  let ut; try { ut = decodeURIComponent(url.pathname); } catch { ut = url.pathname; }
  const ua = url.searchParams.get('nezet') === 'mobil' ? 'iPhone' : req.headers['user-agent'];
  const d = utvonal(ut, ua);
  if (d && d.atiranyit) { res.writeHead(301, { location: encodeURI(d.atiranyit) + url.search }); return res.end(); }
  const f = path.join(DIST, d ? d.atir + '.html' : ut);
  if (f.startsWith(DIST) && existsSync(f) && statSync(f).isFile()) return kuld(res, f);
  // nincs ilyen oldal: a Wix 404-es lapja a nezetnek megfeleloen (mint a functions/[[path]].js)
  if (d && existsSync(path.join(DIST, d.atir.slice(0, 4) + '404.html'))) return kuld(res, path.join(DIST, d.atir.slice(0, 4) + '404.html'), 404);
  if (existsSync(path.join(DIST, '404.html'))) return kuld(res, path.join(DIST, '404.html'), 404);
  res.writeHead(404); res.end('404');
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
