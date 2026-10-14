// A Salonic adatlap stiluslapjanak kiszolgalasa (lib/salonic-css.js + dist/_routes.json + functions/[[path]].js): a bongeszo MINDIG ellenorizzen
// (Cache-Control: no-cache), a tobbi /assets/ fajl valtozatlanul kozvetlenul a tarhelyrol jojjon (nem a fuggvenyen at).
//   node tools/build.mjs && node tools/salonic-css-teszt.mjs
import fs from 'node:fs';
import path from 'node:path';
import { salonicFajl, SALONIC_ELOTAG } from '../lib/salonic-css.js';
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; };
const kerekles = new Request('https://www.medicalpiercing.hu/assets/salonic/mp.css');

// 1. 200: no-cache + CORS, az ETag, a tipus es a tartalom megmarad
{
  const assets = { fetch: async () => new Response('body{color:red}', { status: 200, headers: { 'content-type': 'text/css; charset=utf-8', etag: '"abc"', 'cache-control': 'public, max-age=600' } }) };
  const v = await salonicFajl(kerekles, assets);
  ok('200: Cache-Control: no-cache (a regi max-age felulirva)', v.status === 200 && v.headers.get('cache-control') === 'no-cache', v.headers.get('cache-control'));
  ok('200: CORS (Access-Control-Allow-Origin: *), ETag es content-type megmarad', v.headers.get('access-control-allow-origin') === '*' && v.headers.get('etag') === '"abc"' && /text\/css/.test(v.headers.get('content-type')));
  ok('200: a tartalom valtozatlan', (await v.text()) === 'body{color:red}');
}
// 2. 304 (feltetelezett keres): marad 304, no-cache, torzs nelkul
{
  const assets = { fetch: async () => new Response(null, { status: 304, headers: { etag: '"abc"' } }) };
  const v = await salonicFajl(new Request(kerekles, { headers: { 'if-none-match': '"abc"' } }), assets);
  ok('304: marad 304, no-cache, torzs nelkul', v.status === 304 && v.headers.get('cache-control') === 'no-cache' && v.body === null);
}
// 3. 404: valtozatlanul tovabbadjuk (nem irjuk ra a fejlecet)
{
  const assets = { fetch: async () => new Response('nincs', { status: 404, headers: { 'cache-control': 'public, max-age=0, must-revalidate' } }) };
  const v = await salonicFajl(kerekles, assets);
  ok('404: valtozatlan valasz', v.status === 404 && v.headers.get('cache-control') === 'public, max-age=0, must-revalidate' && (await v.text()) === 'nincs');
}
// 4. a build kimenete: a fuggveny az /assets/salonic/-re fut, a tobbi /assets/ kizart
{
  const ut = JSON.parse(fs.readFileSync(new URL('../dist/_routes.json', import.meta.url), 'utf8'));
  const assetek = fs.readdirSync(new URL('../dist/assets', import.meta.url), { withFileTypes: true });
  const vart = assetek.filter((e) => e.name !== 'salonic').map((e) => (e.isDirectory() ? `/assets/${e.name}/*` : `/assets/${e.name}`));
  ok('_routes.json: a lapcimek mellett az /assets/salonic/ nincs kizarva (ide fut a fuggveny)', ut.include.includes('/*') && !ut.exclude.some((x) => x === '/assets/*' || x.startsWith('/assets/salonic')), JSON.stringify(ut.exclude));
  ok('_routes.json: a tobbi /assets/ (img, js, css, fonts, video, ...) kizart, kozvetlenul a tarhelyrol jon', vart.length >= 6 && vart.every((x) => ut.exclude.includes(x)), vart.join(' '));
  ok('az mp.css a dist-ben megvan (/assets/salonic/mp.css)', fs.existsSync(path.join(new URL('../dist/assets/salonic', import.meta.url).pathname, 'mp.css')));
}
// 5. a fuggveny a Salonic-utat a metodus-szuro ELOTT / az utvonal-logika elott kezeli
{
  const f = fs.readFileSync(new URL('../functions/[[path]].js', import.meta.url), 'utf8');
  const i = f.indexOf('salonicFajl(request, context.env.ASSETS)');
  ok('functions/[[path]].js: importalja es hivja a salonicFajl-t az /assets/salonic/ utvonalra', f.includes("from '../lib/salonic-css.js'") && i > 0 && f.indexOf(SALONIC_ELOTAG) > 0);
  ok('functions/[[path]].js: a Salonic-agat a lapcim-utvonal (utvonal()) ele tettuk', i > 0 && i < f.indexOf('utvonal(ut, request.headers'));
}
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
