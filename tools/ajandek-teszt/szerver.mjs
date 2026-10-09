// Helyi fejleszto/teszt kiszolgalo a Gift Commerce Engine-hez (NEM kerul az oldalba).
//   node tools/ajandek-teszt/szerver.mjs [port]      (alapbol 4195)
//   KORLAT=1 node tools/ajandek-teszt/szerver.mjs    a kereskorlat is el (alapbol helyben ki van kapcsolva)
//
// - /ajandek            a foglalas/ajandek.html (a build-jelolok nelkul); ?m=1 vagy mobil user agent:
//                       a mobil-oldalak build-atirasat utanozza (/assets/img/ -> /assets/img/m/)
// - /assets/*           a repo assets/ mappaja
// - /api/ajandek/*      a valodi kezelo (netlify/lib/ajandek.js) egy MOCK Stripe-API ellen
// - /lezeres-ajandekkartya + /api/ajandek-lezer/*   a lezeres kereskedo (ajandekMotor + ajandek-adat-lezer.js), ugyanazzal a mock Stripe-pal;
//                       a Szamlazz.hu helyett egy helyi csonk (SZAMLAZZ_AGENT_URL: a /__teszt/szamlazz); a keresek a /__teszt/szamlazz-keresek alatt
// - /oxigen-ajandekkartya + /api/ajandek-oxigen/*   az oxigenterapia kereskedo (ajandekMotor + ajandek-adat-oxigen.js): ugyanaz, mint a lezeres (mock Stripe, Szamlazz-csonk)
// - /__teszt/stripe-mock.js   bongeszos Stripe.js-mock (a valodi js.stripe.com helyett)
// - /__teszt/levelek    a kikuldott (elfogott) e-mailek JSON-ban; DELETE: torles
// - /__teszt/mock/...   a mock Stripe vezerlese (siker / bukas)
//
// Eles kiszolgalon (Netlify / Cloudflare) ezek NEM leteznek: ott a valodi Stripe.js toltodik be.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PORT = +(process.argv[2] || 4195);
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };

const elfogottLevelek = [];

// memoriaban tartott Cloudflare-KV-utanzat (AJANDEK_FOTOK): a szemelyre szabott kartya fotoihoz; ujrainditaskor elvesz.
// TESZT_FOTO=nincs: nincs foto-tarolo (a fotofeltoltes ki van kapcsolva, mint egy KV-kotes nelkuli kornyezetben)
function memoriaKv() {
  const t = new Map();
  return {
    async get(kulcs, opciok) {
      const v = t.get(kulcs);
      if (!v) return null;
      return opciok && opciok.type === 'arrayBuffer' ? v.slice().buffer : new TextDecoder().decode(v);
    },
    async put(kulcs, ertek) { t.set(kulcs, new Uint8Array(ertek instanceof ArrayBuffer ? ertek : ertek.slice().buffer)); },
  };
}
// a regi ajandekkartya-cimek (a build ezeken is az uj oldalt adja, lasd tools/netlify-build.mjs); a '/headspa-ajándékkártya-ezo' NFC-ben, dekodolva
const REGI_CIMEK = new Set(['/headspa-ajandekkartya', '/4-kezes-headspa-ajandekkartya', '/ajandekkartya-szulinapra', '/ajandekkartya-ugc', '/headspa-ajandekkartya-anyukaknak', '/headspa-ajandekkartya-noknek', '/headspa-paros-csajos-ajandekkartya', '/japan-headspa-ajandekkartya',
  // 2026-10-09: a harom korabbi hirdetesi oldal is az uj formatumot adja (a regi peldany a build "-regi" cimen)
  '/headspa-ajándékkártya-ezo', '/headspa-self-care', '/headspa-ajandakkartya-fiataloknak']);
let ajandekKezel = null, korlatAlaphelyzet = null, mock = null, env = {};
let lezerKezel = null, lezerEnv = {};
let oxigenKezel = null, oxigenEnv = {};
const szamlazzKeresek = [];

async function hatterInditas() {
  try {
    ({ ajandekKezel, _korlatAlaphelyzet: korlatAlaphelyzet } = await import('../../netlify/lib/ajandek.js'));
    const { mockStripeInditas } = await import('./mock-stripe.mjs');
    mock = await mockStripeInditas({ port: 0 });
    env = {
      STRIPE_SECRET_KEY: process.env.TESZT_MOD === 'nincs' ? '' : 'sk_test_mock_dev',
      STRIPE_PUBLISHABLE_KEY: process.env.TESZT_MOD === 'nincs' ? '' : 'pk_test_mock_dev',
      STRIPE_WEBHOOK_SECRET: 'whsec_mock_dev',
      // a kezelo legalabb 32 karakteres titkot ker (kulonben 'nincs' mod)
      AJANDEK_TITOK: 'dev-titok-dev-titok-dev-titok-dev-titok',
      AJANDEK_AZONNALI: process.env.AZONNALI === '1' ? '1' : '',
      AJANDEK_STRIPE_SZAMLA: process.env.SZAMLA === '1' ? '1' : '',
      STRIPE_API_BASE: mock.url,
      ...(process.env.TESZT_FOTO === 'nincs' ? {} : { AJANDEK_FOTOK: memoriaKv() }),
    };
    // a lezeres kereskedo: sajat adat + sajat kornyezet (a HeadSpa kulcsai nincsenek benne)
    await import('../../assets/js/ajandek-adat-lezer.js');
    const { ajandekMotor } = await import('../../netlify/lib/ajandek.js');
    const { lezerKornyezet } = await import('../../netlify/lib/ajandek-lezer-env.js');
    lezerKezel = ajandekMotor(globalThis.AJANDEK_ADAT_LEZER, { elotag: '/api/ajandek-lezer/' }).ajandekKezel;
    lezerEnv = lezerKornyezet({
      LEZER_STRIPE_SECRET_KEY: 'sk_test_mock_dev', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_dev', LEZER_STRIPE_WEBHOOK_SECRET: 'whsec_mock_lezer_dev',
      LEZER_SZAMLAZZ_AGENT_KULCS: 'dev-agent-kulcs', AJANDEK_TITOK: env.AJANDEK_TITOK, AJANDEK_AZONNALI: env.AJANDEK_AZONNALI, STRIPE_API_BASE: mock.url,
      SZAMLAZZ_AGENT_URL: 'http://127.0.0.1:' + PORT + '/__teszt/szamlazz',
      ...(process.env.TESZT_FOTO === 'nincs' ? {} : { AJANDEK_FOTOK: env.AJANDEK_FOTOK }),
    });
    // az oxigenterapia kereskedo: sajat adat + sajat kornyezet (sem a HeadSpa, sem a lezeres kulcsai nincsenek benne)
    await import('../../assets/js/ajandek-adat-oxigen.js');
    const { oxigenKornyezet } = await import('../../netlify/lib/ajandek-oxigen-env.js');
    oxigenKezel = ajandekMotor(globalThis.AJANDEK_ADAT_OXIGEN, { elotag: '/api/ajandek-oxigen/' }).ajandekKezel;
    oxigenEnv = oxigenKornyezet({
      OXIGEN_STRIPE_SECRET_KEY: 'sk_test_mock_dev', OXIGEN_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_dev', OXIGEN_STRIPE_WEBHOOK_SECRET: 'whsec_mock_oxigen_dev',
      OXIGEN_SZAMLAZZ_AGENT_KULCS: 'dev-agent-kulcs', AJANDEK_TITOK: env.AJANDEK_TITOK, AJANDEK_AZONNALI: env.AJANDEK_AZONNALI, STRIPE_API_BASE: mock.url,
      SZAMLAZZ_AGENT_URL: 'http://127.0.0.1:' + PORT + '/__teszt/szamlazz',
      ...(process.env.TESZT_FOTO === 'nincs' ? {} : { AJANDEK_FOTOK: env.AJANDEK_FOTOK }),
    });
    console.log('Backend + mock Stripe indult:', mock.url, '| azonnali kartya:', env.AJANDEK_AZONNALI === '1');
  } catch (e) {
    console.warn('A backend (netlify/lib/ajandek.js / mock-stripe.mjs) nem toltheto be - az /api/ajandek/beallitas "nincs" modot ad:', e.message);
  }
}

function oldal(ut, mobil, fajl = 'ajandek.html') {
  let h = fs.readFileSync(path.join(ROOT, 'foglalas', fajl), 'utf8');
  // az eles oldal fejlece es lablece, mint a tools/netlify-build.mjs-ben (assets/fejlec/)
  const reszlet = (fajl) => fs.readFileSync(path.join(ROOT, 'assets/fejlec', fajl + '.html'), 'utf8');
  h = h.replace('<!--mh-fejlec-->', () => reszlet(mobil ? 'mobil' : 'asztali')).replace('<!--mh-lablec-->', () => reszlet(mobil ? 'lablec-mobil' : 'lablec-asztali'));
  // a build a sajat szkript/stilus hivatkozasokhoz verziojelet fuz - helyben nem kell
  h = h.replace('<script src="/assets/js/ajandek-adat.js" defer></script>', '<script src="/__teszt/stripe-mock.js"></script>\n<script src="/assets/js/ajandek-adat.js" defer></script>');
  if (mobil) h = h.replace(/(["'(\s,])\/assets\/img\/(?!m\/)/g, '$1/assets/img/m/');
  return h;
}

async function torzs(req) {
  const ch = [];
  for await (const c of req) ch.push(c);
  return Buffer.concat(ch).toString('utf8');
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:' + PORT);
  const ut = decodeURIComponent(u.pathname);
  try {
    if (ut === '/ajandek' || REGI_CIMEK.has(ut)) {
      const mobil = u.searchParams.get('m') === '1' || /iPhone|Android.*Mobile/i.test(req.headers['user-agent'] || '');
      res.writeHead(200, { 'content-type': TIPUS['.html'], 'cache-control': 'no-store' });
      return res.end(oldal(ut, mobil));
    }
    if (ut === '/lezeres-ajandekkartya') {
      const mobil = u.searchParams.get('m') === '1' || /iPhone|Android.*Mobile/i.test(req.headers['user-agent'] || '');
      res.writeHead(200, { 'content-type': TIPUS['.html'], 'cache-control': 'no-store' });
      return res.end(oldal(ut, mobil, 'lezeres-ajandekkartya.html'));
    }
    if (ut === '/oxigen-ajandekkartya') {
      const mobil = u.searchParams.get('m') === '1' || /iPhone|Android.*Mobile/i.test(req.headers['user-agent'] || '');
      res.writeHead(200, { 'content-type': TIPUS['.html'], 'cache-control': 'no-store' });
      return res.end(oldal(ut, mobil, 'oxigen-ajandekkartya.html'));
    }
    // a Szamlazz.hu Szamla Agent helyi csonkja: elmenti a keres XML-jet, sikeres valaszt ad
    if (ut === '/__teszt/szamlazz') {
      const t = await torzs(req);
      const m = /<\?xml[\s\S]*<\/xmlszamla>/.exec(t);
      szamlazzKeresek.push(m ? m[0] : t.slice(0, 500));
      res.writeHead(200, { 'content-type': 'text/xml' });
      return res.end('<xmlszamlavalasz xmlns="http://www.szamlazz.hu/xmlszamlavalasz"><sikeres>true</sikeres><szamlaszam>E-LZ-DEV-' + szamlazzKeresek.length + '</szamlaszam></xmlszamlavalasz>');
    }
    if (ut === '/__teszt/szamlazz-keresek') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(szamlazzKeresek));
    }
    // A regi koszono-oldal helyi helyettese a merokeret-tesztekhez: ugyanazt a suti.js-t tolti be, mint az eles (klon) oldal, es megjegyzi, hogy a
    // keretben lefutott-e (window.__regiKoszono). A valodi oldal csak az eles buildben letezik (klon/success-ajandekkartya-stripe.html).
    if (ut === '/success-ajandekkartya-stripe') {
      res.writeHead(200, { 'content-type': TIPUS['.html'], 'cache-control': 'no-store' });
      return res.end('<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Ajándékkártya: Sikeres vásárlás! (teszt)</title><script src="/assets/js/suti.js"></script></head><body><p>régi köszönőoldal (teszt)</p><script>window.__regiKoszono = { mhSuti: typeof window.mhSuti, rejtett: document.documentElement.style.visibility, keretben: window.top !== window.self };</script></body></html>');
    }
    if (ut === '/__teszt/stripe-mock.js') {
      res.writeHead(200, { 'content-type': TIPUS['.js'], 'cache-control': 'no-store' });
      return res.end(fs.readFileSync(path.join(import.meta.dirname, 'stripe-mock.js')));
    }
    if (ut === '/__teszt/levelek') {
      if (req.method === 'DELETE') { elfogottLevelek.length = 0; res.writeHead(204); return res.end(); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(elfogottLevelek));
    }
    if (ut === '/__teszt/mock/pi-info' && mock) {
      const x = mock.allapot.pi(u.searchParams.get('pi')) || {};
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ tipusok: x.payment_method_types || null, auto: !!(x.automatic_payment_methods && x.automatic_payment_methods.enabled), metadata: x.metadata || null }));
    }
    if (ut.startsWith('/__teszt/mock/') && mock) {
      const pi = u.searchParams.get('pi');
      if (ut.endsWith('/siker')) mock.allapot.sikeresIt(pi, { mod: u.searchParams.get('mod') || 'card' });
      else if (ut.endsWith('/bukas')) mock.allapot.bukas(pi);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{"ok":true}');
    }
    if (ut.startsWith('/api/ajandek-lezer/') && lezerKezel) {
      res.setHeader('cache-control', 'no-store');
      if (process.env.KORLAT !== '1' && korlatAlaphelyzet) korlatAlaphelyzet();
      const szoveg = req.method === 'GET' || req.method === 'HEAD' ? '' : await torzs(req);
      const fejlecek = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
      const v = await lezerKezel({
        method: req.method, url: 'http://localhost:' + PORT + req.url, headers: fejlecek, text: szoveg, env: lezerEnv,
        kuld: async (level) => { elfogottLevelek.push({ ...level, ido: new Date().toISOString() }); },
      });
      res.writeHead(v.status, v.headers);
      return res.end(v.body);
    }
    if (ut.startsWith('/api/ajandek-oxigen/') && oxigenKezel) {
      res.setHeader('cache-control', 'no-store');
      if (process.env.KORLAT !== '1' && korlatAlaphelyzet) korlatAlaphelyzet();
      const szoveg = req.method === 'GET' || req.method === 'HEAD' ? '' : await torzs(req);
      const fejlecek = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
      const v = await oxigenKezel({
        method: req.method, url: 'http://localhost:' + PORT + req.url, headers: fejlecek, text: szoveg, env: oxigenEnv,
        kuld: async (level) => { elfogottLevelek.push({ ...level, ido: new Date().toISOString() }); },
      });
      res.writeHead(v.status, v.headers);
      return res.end(v.body);
    }
    if (ut.startsWith('/api/ajandek/')) {
      res.setHeader('cache-control', 'no-store');
      if (!ajandekKezel) {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ mod: 'nincs', publikus_kulcs: null, azonnali_kartya: false }));
      }
      // helyben minden keres ugyanarrol az IP-rol jon: a kereskorlat (pl. 20 /fizetes / 10 perc) a
      // kezi / Playwright-probat zavarna, ezert alapbol nullazzuk; KORLAT=1-gyel az eles viselkedes
      if (process.env.KORLAT !== '1' && korlatAlaphelyzet) korlatAlaphelyzet();
      const szoveg = req.method === 'GET' || req.method === 'HEAD' ? '' : await torzs(req);
      const fejlecek = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
      const v = await ajandekKezel({
        method: req.method, url: 'http://localhost:' + PORT + req.url, headers: fejlecek, text: szoveg, env,
        kuld: async (level) => { elfogottLevelek.push({ ...level, ido: new Date().toISOString() }); },
      });
      res.writeHead(v.status, v.headers);
      return res.end(v.body);
    }
    // statikus fajlok az assets/ alol
    if (ut.startsWith('/assets/')) {
      let f = path.join(ROOT, ut);
      // a build a mobil-kepmappaba (assets/img/m/) atmasolja azt, ami ott nincs (tools/netlify-build.mjs) - itt visszaesunk az eredetire
      if (ut.startsWith('/assets/img/m/') && !fs.existsSync(f)) f = path.join(ROOT, ut.replace('/assets/img/m/', '/assets/img/'));
      if (f.startsWith(path.join(ROOT, 'assets')) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { 'content-type': TIPUS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'accept-ranges': 'bytes' });
        return fs.createReadStream(f).pipe(res);
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('nincs: ' + ut);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('hiba: ' + e.message);
  }
}).listen(PORT, async () => {
  await hatterInditas();
  console.log('Gift Engine fejleszto kiszolgalo: http://localhost:' + PORT + '/ajandek   (mobil: ?m=1)');
});
