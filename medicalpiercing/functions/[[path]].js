// Cloudflare Pages-fuggveny (a projekt gyokere: medicalpiercing/).
//
// - GET/HEAD: a Wix-szel azonos cimek; telefonon a mobil (dist/_m/), mas eszkozon
//   az asztali (dist/_a/) lap (lib/utvonal.js) - ugyanugy, ahogy a Wix dontott;
// - POST /api/urlap: az oldalak urlapjai (assets/js/klon.js 6.) - e-mail a
//   szalonnak, a feltoltott fajlok mellekletkent (lib/levelek.js).
//
// Csak a lapokra fut (dist/_routes.json): a kepek, betuk, stilusok, szkriptek es
// videok kozvetlenul a Cloudflare tarhelyerol jonnek, fuggvenyhivas nelkul.
//
// Beallitas (Cloudflare: Workers & Pages -> a projekt -> Settings -> Variables and
// Secrets): SMTP_PASS (titkos, Gmail-alkalmazasjelszo), es ha kell: SMTP_USER,
// SMTP_HOST, SMTP_PORT, MAIL_TO, MAIL_FROM (lasd wrangler.toml).
import { WorkerMailer } from 'worker-mailer';
import { utvonal } from '../lib/utvonal.js';
import { level } from '../lib/levelek.js';

// Minden mas host (*.pages.dev elonezetek) probacim: noindex + tilto robots.txt.
const ELES_HOST = /^(www\.)?medicalpiercing\.hu$/;
const TILTO_ROBOTS = 'User-agent: *\nDisallow: /\n';
const MAX_MELLEKLET = 20 * 1024 * 1024; // osszesen; a Gmail 25 MB-ot fogad

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/api/urlap') return urlap(context);
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();

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
  if (!eles) h.set('x-robots-tag', 'noindex, nofollow');
  return new Response(valasz.body, { status, headers: h });
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
  const cimzett = env.MAIL_TO || 'medicalpiercing.hu@gmail.com';
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

function base64(puffer) {
  const b = new Uint8Array(puffer);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
