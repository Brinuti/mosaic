// Helyi dev-szerver a CRM-hez (a UI fejlesztesehez es a Playwright-tesztekhez). Kulso halozat NINCS.
//   node tools/crm-dev.mjs [--port=4210] [--db=fajl.sqlite]
// - http://localhost:4210/api/crm/...  a crm/lib/api.js (memoria-SQLite, minden migracioval; --db: fajlba mentve)
// - http://localhost:4210/crm          a foglalas/crm.html (ha mar letezik)
// - http://localhost:4210/assets/...   a repo assets/ mappaja
// Belepes: POST /api/crm/auth/demo {"szerep":"therapist"} (a CRM_DEMO=1 es localhost miatt engedett), vagy e-mailes kod:
//   admin@dev.local -> POST /api/crm/auth/kod-keres; a 6 jegyu kodot a valasz `demo_kod` mezoje es ez a konzol is mutatja.
// A suti localhoston Secure nelkul megy ki (CRM_DEV=1), a CSRF-token a belepes valaszaban van (X-CRM-CSRF fejlec).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { api, demoAdatBetoltDb } from '../crm/lib/api.js';
import { TestDb } from '../crm/lib/testdb.js';
import { sha256 } from '../crm/lib/db.js';
import { CSP_CRM } from '../crm/lib/http.js';

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (nev, alap) => (process.argv.find((a) => a.startsWith(`--${nev}=`)) || '').split('=')[1] || alap;
const PORT = Number(arg('port', process.env.PORT || 4210));
const DB_FAJL = arg('db', process.env.CRM_DEV_DB || ':memory:');
const DEV_KULCS = 'dev-gepi-kulcs';

const TIPUSOK = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4' };

// ---- adatbazis: memoria (vagy fajl), minden migracioval; a batch-ek sorosak (mint a D1-en) -------------------------------------------------------
const db = new TestDb(DB_FAJL);
for (const f of fs.readdirSync(path.join(GYOKER, 'crm/migrations')).filter((x) => x.endsWith('.sql')).sort()) db.d.exec(fs.readFileSync(path.join(GYOKER, 'crm/migrations', f), 'utf8'));
{
  const eredeti = db.batch.bind(db);
  let sor = Promise.resolve();
  db.batch = (u) => { const kov = sor.then(() => eredeti(u)); sor = kov.catch(() => {}); return kov; };
}

// ---- ASSETS-szimulacio (a PDF betutipusokhoz): ugyanaz a felulet, mint a Cloudflare Pages ASSETS bindingja -----------------------------------------------
function fajlUt(urlUt, mappa) {
  let ut;
  try { ut = decodeURIComponent(urlUt); } catch { return null; }
  const teljes = path.resolve(GYOKER, `.${ut}`);
  const gyoker = path.resolve(GYOKER, mappa);
  return teljes.startsWith(gyoker + path.sep) && fs.existsSync(teljes) && fs.statSync(teljes).isFile() ? teljes : null;
}
const ASSETS = { async fetch(keres) {
  const f = fajlUt(new URL(typeof keres === 'string' ? keres : keres.url).pathname, 'assets');
  return f ? new Response(fs.readFileSync(f), { headers: { 'Content-Type': TIPUSOK[path.extname(f)] || 'application/octet-stream' } }) : new Response('nincs', { status: 404 });
} };

const env = {
  CRM_DB: db, ASSETS, CRM_DEMO: '1', CRM_DEV: '1', CRM_ADMIN_EMAILS: 'admin@dev.local', CRM_TITOK: 'dev-titok-dev-titok-dev-titok', CRM_KULCS_HASH: await sha256(DEV_KULCS),
  CRM_SO: 'dev', CRM_KULDES: 'dry',
};

const demo = await demoAdatBetoltDb(db, { now: Math.floor(Date.now() / 1000), env }).catch((e) => { console.error('demo-adat betoltese sikertelen:', e.message); return false; });

// ---- node:http <-> Web Request/Response ---------------------------------------------------------------------------------------------------------
async function kezel(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  try {
    if (url.pathname === '/' ) { res.writeHead(302, { Location: '/crm' }); return res.end(); }
    if (url.pathname === '/crm' || url.pathname === '/crm/') {
      const f = path.join(GYOKER, 'foglalas/crm.html');
      const tartalom = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.from('<!doctype html><meta charset="utf-8"><title>CRM</title><p>A foglalas/crm.html még nem létezik (a UI fejlesztés alatt).</p>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP_CRM, 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow' });
      return res.end(tartalom);
    }
    if (url.pathname.startsWith('/assets/')) {
      const f = fajlUt(url.pathname, 'assets');
      if (!f) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('nincs'); }
      res.writeHead(200, { 'Content-Type': TIPUSOK[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(fs.readFileSync(f));
    }
    if (url.pathname.startsWith('/api/crm')) {
      const fejlecek = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) fejlecek.set(k, Array.isArray(v) ? v.join(', ') : v);
      const iro = !['GET', 'HEAD'].includes(req.method);
      const keres = new Request(url, { method: req.method, headers: fejlecek, body: iro ? Readable.toWeb(req) : undefined, duplex: iro ? 'half' : undefined });
      const valasz = await api(keres, env, { waitUntil: (p) => { Promise.resolve(p).catch(() => {}); } });
      const ki = [...valasz.headers].filter(([k]) => k !== 'set-cookie');
      const sutik = valasz.headers.getSetCookie?.() || [];
      res.writeHead(valasz.status, [...ki, ...sutik.map((s) => ['set-cookie', s])].flat());
      const test = Buffer.from(await valasz.arrayBuffer());
      if (url.pathname.endsWith('/auth/kod-keres')) { try { const j = JSON.parse(test.toString()); if (j.demo_kod) console.log(`[crm-dev] belépési kód: ${j.demo_kod}`); } catch { /* nem JSON */ } }
      return res.end(req.method === 'HEAD' ? undefined : test);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('nincs ilyen útvonal (csak /crm, /assets/*, /api/crm/*)');
  } catch (e) {
    console.error('[crm-dev] hiba:', e);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('belső hiba');
  }
}

const szerver = http.createServer((req, res) => { kezel(req, res); });
szerver.listen(PORT, '127.0.0.1', () => {
  console.log(`[crm-dev] http://localhost:${PORT}/crm   (API: /api/crm, db: ${DB_FAJL === ':memory:' ? 'memória' : DB_FAJL})`);
  console.log(`[crm-dev] demo-belépés: POST /api/crm/auth/demo {"szerep":"therapist|clinical_lead|reception|salon_manager|marketing|admin"}; kód-belépés: admin@dev.local`);
  console.log(`[crm-dev] demo-adat: ${demo ? 'betöltve' : 'nincs (a crm/lib/demo.js még nem létezik, vagy már be volt töltve)'}; gépi kulcs (X-CRM-KULCS): ${DEV_KULCS}`);
});
export { szerver };
