// Cloudflare Pages-fuggveny (a projekt gyokere: medicalpiercing/).
//
// - GET/HEAD: a Wix-szel azonos cimek; telefonon a mobil (dist/_m/), mas eszkozon
//   az asztali (dist/_a/) lap (lib/utvonal.js) - ugyanugy, ahogy a Wix dontott;
// - POST /api/urlap: az oldalak urlapjai (assets/js/klon.js 6.) - e-mail a
//   szalonnak, a feltoltott fajlok mellekletkent (lib/levelek.js);
// - GET /api/kitelepulesek: a videki helyszinek idopontjai a tablazatbol (lib/kitelepulesek.js),
//   a lapok ebbol frissitik a datumokat (assets/js/klon.js 10.);
// - GET /api/ertekeles: a Google-ertekeles (pontszam, vélemenyek szama) a Trustindex fooldali widgetjebol (lib/ertekeles.js),
//   a kategoria-oldalak hosenek ertekeles-sora ebbol frissul (assets/js/uj-fooldal.js 4c.).
// - GET /f/<kod>, /m/<kod>: "A foglalasod" oldal (lib/foglalasom.js) a foglalas -> megjelenes rendszer kozos D1-jebol (LIFECYCLE_DB), csak az MP-foglalasok;
//   /f/minta: bemutato mintaadatokkal;
// - POST /api/lifecycle-kimeno: a foglalas -> megjelenes rendszer (Mosaic-projekt) MP-leveleinek kimeno sora: a motor a kozos D1 mp_kimeno tablajaba
//   irja a levelet, ez ennek a projektnek a Gmail-fiokjabol (SMTP_PASS) kuldi ki (lib/lifecycle-kimeno.js). Kulcs nincs (a tulajdonos dontese):
//   csak a motor altal sorba tett level mehet ki, a valasz csak darabszam.
//
// Csak a lapokra (es a Salonic stiluslapjara: /assets/salonic/) fut (dist/_routes.json): a kepek, betuk, stilusok, szkriptek es
// videok kozvetlenul a Cloudflare tarhelyerol jonnek, fuggvenyhivas nelkul.
//
// Beallitas (Cloudflare: Workers & Pages -> a projekt -> Settings -> Variables and
// Secrets): SMTP_PASS (titkos, Gmail-alkalmazasjelszo), es ha kell: SMTP_USER,
// SMTP_HOST, SMTP_PORT, MAIL_TO, MAIL_FROM (lasd wrangler.toml).
import { WorkerMailer } from 'worker-mailer';
import { utvonal } from '../lib/utvonal.js';
import { level } from '../lib/levelek.js';
import { TABLAZAT_CSV, osszesSor } from '../lib/kitelepulesek.js';
import { TRUSTINDEX_TARTALOM, ertekelesAdat } from '../lib/ertekeles.js';
import { SALONIC_ELOTAG, salonicFajl } from '../lib/salonic-css.js';
import { UJ_ELES } from '../lib/uj-eles.js';
import { foglalasom } from '../lib/foglalasom.js';
import { kimenoFeldolgoz } from '../lib/lifecycle-kimeno.js';

// Minden mas host (*.pages.dev elonezetek) probacim: noindex + tilto robots.txt.
const ELES_HOST = /^(www\.)?medicalpiercing\.hu$/;
const TILTO_ROBOTS = 'User-agent: *\nDisallow: /\n';
// Rejtett lapok: az eles domainen is noindex (a lap meta robots-a mellett fejlecben is). Az uj oldalak elesitese utan (lib/uj-eles.js) a rejtett
// a regi Wix-klon (/regi/<eredeti utvonal>) es a link-index (/uj-oldalak); elotte az uj stilusu tukor (/uj/<eredeti utvonal>, /uj-fooldal)
const REJTETT_LAPOK = new Set(['/uj-fooldal', '/uj-oldalak']);
const REJTETT_ELOTAG = UJ_ELES ? /^\/regi(\/|$)/ : /^\/uj(\/|$)/;
const MAX_MELLEKLET = 20 * 1024 * 1024; // osszesen; a Gmail 25 MB-ot fogad

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/api/urlap') return urlap(context);
  if (request.method === 'GET' && url.pathname === '/api/kitelepulesek') return kitelepulesek();
  if (request.method === 'GET' && url.pathname === '/api/ertekeles') return ertekeles();
  if (url.pathname === '/api/lifecycle-kimeno') return request.method === 'POST' ? lifecycleKimenoVegpont(context) : new Response('POST kell', { status: 405, headers: { allow: 'POST' } });
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();
  if (/^\/[fm]\//.test(url.pathname) && url.hostname !== 'medicalpiercing.hu') { // "A foglalasod" (a statikus oldalak elott; a gyoker domain lent www-re iranyit)
    const v = await foglalasom(request, context.env);
    if (v) return v;
  }
  // a Salonic adatlap stiluslapja: a bongeszo mindig ellenorzi (lib/salonic-css.js)
  if (url.pathname.startsWith(SALONIC_ELOTAG)) return salonicFajl(request, context.env.ASSETS);

  const eles = ELES_HOST.test(url.hostname);
  // a gyoker domain 301-gyel a www-re, mint a Wixen
  if (url.hostname === 'medicalpiercing.hu') {
    return Response.redirect('https://www.medicalpiercing.hu' + url.pathname + url.search, 301);
  }
  if (!eles && url.pathname === '/robots.txt') {
    return new Response(TILTO_ROBOTS, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
  }
  let ut;
  try { ut = decodeURIComponent(url.pathname); } catch { ut = url.pathname; }
  const d = utvonal(ut, request.headers.get('user-agent'));
  if (!d) return context.next();
  if (d.atiranyit) {
    return new Response(null, { status: 301, headers: { location: encodeURI(d.atiranyit) + url.search } });
  }
  let valasz = await context.env.ASSETS.fetch(new URL(encodeURI(d.atir) + url.search, request.url), request);
  let status = valasz.status;
  if (status === 404) {
    // nincs ilyen oldal: a Wix 404-es lapja, ugyanugy asztali vagy mobil valtozatban
    valasz = await context.env.ASSETS.fetch(new URL(d.atir.slice(0, 4) + '404', request.url), request);
    if (!valasz.ok) return context.next();
    status = 404;
  }
  const h = new Headers(valasz.headers);
  // ugyanaz a cim mobilon es asztalin mast ad - a gyorsitotar ezt tudja
  h.set('vary', 'User-Agent');
  if (!eles || REJTETT_LAPOK.has(ut) || REJTETT_ELOTAG.test(ut)) h.set('x-robots-tag', 'noindex, nofollow');
  return new Response(valasz.body, { status, headers: h });
}

// A Trustindex-widget fejleceben latszo ertekeles (a widget ugyanezt a szamot mutatja): egy oran at tarolodik.
async function ertekeles() {
  try {
    const v = await fetch(TRUSTINDEX_TARTALOM, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!v.ok) throw new Error('HTTP ' + v.status);
    const adat = ertekelesAdat(await v.text());
    if (!adat) throw new Error('a widget fejlece nem olvashato');
    return new Response(JSON.stringify(adat), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  } catch (e) {
    console.error('ertekeles: nem olvashato', e && e.message);
    return new Response(JSON.stringify({ hiba: 'az ertekeles most nem olvashato' }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
}

// A tablazatot a Cloudflare 5 percig tarolja: egy modositas legkesobb ennyi ido mulva latszik.
async function kitelepulesek() {
  try {
    const v = await fetch(TABLAZAT_CSV, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!v.ok) throw new Error('HTTP ' + v.status);
    return new Response(JSON.stringify(osszesSor(await v.text())), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  } catch (e) {
    console.error('kitelepulesek: a tablazat nem olvashato', e && e.message);
    return new Response(JSON.stringify({ hiba: 'a tablazat most nem olvashato' }), {
      status: 502, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}

async function urlap(context) {
  const { request, env } = context;
  let adat;
  try { adat = await request.formData(); } catch { return new Response('rossz keres', { status: 400 }); }
  const nev = adat.get('form-name');
  if (!nev) return new Response('ismeretlen urlap', { status: 404 });
  if (adat.get('bot-field')) return new Response('ok'); // csapda-mezo: robot

  const mezok = [], mellekletek = [];
  let meret = 0;
  for (const [k, v] of adat.entries()) {
    if (k === 'form-name' || k === 'bot-field') continue;
    if (typeof v === 'string') { mezok.push([k, v]); continue; }
    if (!v || !v.size) continue;
    mezok.push([k, v.name]);
    meret += v.size;
    if (meret > MAX_MELLEKLET) continue; // ami nem fer bele, csak a neve megy at
    mellekletek.push({ filename: v.name || k, content: base64(await v.arrayBuffer()), mimeType: v.type || undefined });
  }

  const l = level(String(nev), mezok);
  const SMTP_HOST = env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_USER = env.SMTP_USER || 'medicalpiercing.hu@gmail.com';
  const { SMTP_PORT, SMTP_PASS } = env;
  if (!SMTP_PASS) {
    // amig nincs beallitva, a bekuldes a Cloudflare naplojaban latszik
    console.log(`${nev}: nincs SMTP_PASS, e-mail nem ment ki`, JSON.stringify(mezok));
    return new Response('ok');
  }
  const port = Number(SMTP_PORT || 465);
  // a kiemelt vendég-visszajelzés (/uj/visszajelzes) a tulajdonoshoz megy, ha a MAIL_TO_TULAJDONOS be van allitva
  const cimzett = (nev === 'tulajdonosi-visszajelzes' && env.MAIL_TO_TULAJDONOS) || env.MAIL_TO || 'medicalpiercing.hu@gmail.com';
  const felado = { name: 'Medical Piercing weboldal', email: SMTP_USER };
  if (env.MAIL_FROM) {
    const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(env.MAIL_FROM);
    if (m) { felado.name = m[1] || felado.name; felado.email = m[2]; } else felado.email = env.MAIL_FROM.trim();
  }
  try {
    const posta = await WorkerMailer.connect({
      host: SMTP_HOST, port, secure: port === 465, startTls: port !== 465,
      credentials: { username: SMTP_USER, password: SMTP_PASS.replace(/\s+/g, '') },
      authType: 'plain',
    });
    await posta.send({
      from: felado, to: cimzett,
      ...(l.valasz ? { reply: l.valasz } : {}),
      subject: l.targy, html: l.html,
      ...(mellekletek.length ? { attachments: mellekletek } : {}),
    });
    await posta.close();
  } catch (e) {
    console.error(`${nev}: SMTP-hiba`, e && e.message);
    return new Response('kuldesi hiba', { status: 502 });
  }
  return new Response('ok');
}

// ---- a foglalas -> megjelenes rendszer MP-leveleinek kimeno sora (lib/lifecycle-kimeno.js) -------------------------------------------------------
const valaszJson = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export async function lifecycleKimenoVegpont(context) {
  const { env } = context;
  if (!env.LIFECYCLE_DB) return valaszJson({ hiba: 'nincs_db' }, 503);
  if (!env.SMTP_PASS) { console.log('lifecycle-kimeno: nincs SMTP_PASS, a sor marad'); return valaszJson({ hiba: 'nincs SMTP_PASS' }, 503); }
  const SMTP_USER = env.SMTP_USER || 'medicalpiercing.hu@gmail.com';
  const port = Number(env.SMTP_PORT || 465);
  let posta = null;
  const kuld = async ({ to, subject, html, text, reply }) => {
    if (!posta) {
      posta = await WorkerMailer.connect({
        host: env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465, startTls: port !== 465,
        credentials: { username: SMTP_USER, password: String(env.SMTP_PASS).replace(/\s+/g, '') }, authType: 'plain',
      });
    }
    try {
      await posta.send({ from: { name: 'Medical Piercing', email: SMTP_USER }, to, reply: reply || SMTP_USER, subject, html, ...(text ? { text } : {}) });
    } catch (e) { try { await posta.close(); } catch { /* mar lezarult */ } posta = null; throw e; }
  };
  try {
    return valaszJson(await kimenoFeldolgoz(env.LIFECYCLE_DB, kuld));
  } catch (e) {
    console.error('lifecycle-kimeno: hiba', e && e.message);
    return valaszJson({ hiba: 'feldolgozasi hiba' }, 500);
  } finally { if (posta) { try { await posta.close(); } catch { /* mar lezarult */ } } }
}

function base64(puffer) {
  const b = new Uint8Array(puffer);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
