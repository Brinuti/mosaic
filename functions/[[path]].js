// Cloudflare Pages-fuggveny: ugyanaz, amit a Netlifyn az edge-fuggveny
// (netlify/edge-functions/oldal.js) es az urlapkezeles (Netlify Forms +
// netlify/functions/submission-created.mjs) ad.
//
// - GET/HEAD: a Wix-szel azonos, kiterjesztes nelkuli cimek; telefonon a mobil
//   (dist/_m/), mas eszkozon az asztali (dist/_a/) lap (netlify/lib/utvonal.js);
// - POST "/" form-name mezovel: az oldalak urlapjai (klon.js, foglalo-pmu.js)
//   ide kuldenek - a levelek a Wix-levelek szerint (netlify/lib/levelek.js),
//   a feltoltott fajlok mellekletkent.
//
// Csak a lapokra fut (dist/_routes.json, tools/netlify-build.mjs): a kepek, a
// stilusok es a szkriptek kozvetlenul a Cloudflare tarhelyerol jonnek, fuggveny-
// hivas nelkul.
//
// Beallitas (Cloudflare: Workers & Pages -> a projekt -> Settings -> Variables
// and Secrets): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (titkos),
// MAIL_FROM, MAIL_TO (nem kotelezo) - ugyanazok, mint a Netlifyn.
import { WorkerMailer } from 'worker-mailer';
import { utvonal } from '../netlify/lib/utvonal.js';
import { levelek } from '../netlify/lib/levelek.js';

// Minden mas host (*.pages.dev elonezetek) probacim: noindex + tilto robots.txt.
const ELES_HOST = /^(www\.)?mosaicheadspa\.hu$/;
const TILTO_ROBOTS = 'User-agent: *\nDisallow: /\n';
const MAX_MELLEKLET = 20 * 1024 * 1024; // osszesen; a Gmail 25 MB-ot fogad

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'POST') return urlap(context);
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next();

  const url = new URL(request.url);
  const eles = ELES_HOST.test(url.hostname);
  // a gyoker domain 301-gyel a www-re, mint a Wixen
  if (url.hostname === 'mosaicheadspa.hu') {
    return Response.redirect('https://www.mosaicheadspa.hu' + url.pathname + url.search, 301);
  }
  if (!eles && url.pathname === '/robots.txt') {
    return new Response(TILTO_ROBOTS, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
  }
  const d = utvonal(decodeURIComponent(url.pathname), request.headers.get('user-agent'));
  if (!d) return context.next();
  if (d.atiranyit) {
    return new Response(null, { status: 301, headers: { location: encodeURI(d.atiranyit) + url.search } });
  }
  const valasz = await context.env.ASSETS.fetch(new URL(encodeURI(d.atir) + url.search, request.url), request);
  if (valasz.status === 404) return context.next(); // nincs ilyen oldal: a 404-es lap
  const h = new Headers(valasz.headers);
  // ugyanaz a cim mobilon es asztalin mast ad - a gyorsitotar ezt tudja
  h.set('vary', 'User-Agent');
  if (!eles) h.set('x-robots-tag', 'noindex, nofollow');
  return new Response(valasz.body, { status: valasz.status, headers: h });
}

async function urlap(context) {
  const { request, env } = context;
  let adat;
  try { adat = await request.formData(); } catch { return new Response('rossz keres', { status: 400 }); }
  const nev = adat.get('form-name');
  if (!nev) return new Response('ismeretlen urlap', { status: 404 });
  if (adat.get('bot-field')) return new Response('ok'); // csapda-mezo: robot

  const d = {}, mellekletek = [];
  let meret = 0;
  for (const [k, v] of adat.entries()) {
    if (k === 'form-name' || k === 'bot-field') continue;
    if (typeof v === 'string') { d[k] = v; continue; }
    if (!v || !v.size) continue;
    d[k] = v.name;
    meret += v.size;
    if (meret > MAX_MELLEKLET) continue; // ami nem fer bele, csak a neve megy at
    mellekletek.push({ filename: v.name || k, content: base64(await v.arrayBuffer()), mimeType: v.type || undefined });
  }

  const lista = levelek(nev, d);
  if (!lista) return new Response('ok');
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`${nev}: nincs SMTP-beallitas, e-mail nem ment ki`, JSON.stringify(d));
    return new Response('ok');
  }
  const port = Number(SMTP_PORT || 465);
  const szalon = env.MAIL_TO || 'mosaicheadspa@gmail.com';
  const felado = { name: 'Mosaic Headspa', email: SMTP_USER };
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
    for (const l of lista) {
      const valasz = l.valasz === 'szalon' ? szalon : l.valasz;
      try {
        await posta.send({
          from: felado,
          to: l.cimzett === 'szalon' ? szalon : l.cimzett,
          ...(valasz ? { reply: valasz } : {}),
          subject: l.targy,
          html: l.html,
          ...(l.cimzett === 'szalon' && mellekletek.length ? { attachments: mellekletek } : {}),
        });
      } catch (e) {
        console.error(`${nev}: kuldesi hiba`, e && e.message);
      }
    }
    await posta.close();
  } catch (e) {
    console.error(`${nev}: SMTP-hiba`, e && e.message);
  }
  // a bekuldo oldal (klon.js) csak a sikeres valaszt nezi, utana a koszonooldalra lep
  return new Response('ok');
}

function base64(puffer) {
  const b = new Uint8Array(puffer);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
