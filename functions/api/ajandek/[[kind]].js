// MOSAIC Gift Commerce Engine - Cloudflare Pages-fuggveny (az /api/ajandek/* cimek).
// Ugyanaz, mint a Netlifyn a netlify/functions/ajandek.mjs: a logika a kozos kezeloben van
// (netlify/lib/ajandek.js), itt csak a Request -> kezelo -> Response atalakitas es a
// levelkuldes (worker-mailer, ugyanugy, mint a functions/[[path]].js urlapkezelese).
// Ez az utvonal pontosabb, mint a functions/[[path]].js, ezert az /api/ajandek/* ide jut.
//
// Beallitas (Cloudflare: Workers & Pages -> a projekt -> Settings -> Variables and Secrets):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, AJANDEK_TITOK (KOTELEZO, legalabb 32 karakter), SMTP_PASS (titkos);
//   STRIPE_PUBLISHABLE_KEY, AJANDEK_BAZIS_URL, AJANDEK_AZONNALI (nem titkos: a wrangler.toml [vars]
//   reszebe, mert ha van wrangler.toml, a feluleten megadott nem titkos valtozokat a Cloudflare torli).
import { WorkerMailer } from 'worker-mailer';
import { ajandekKezel, keresTorzs } from '../../../netlify/lib/ajandek.js';

// Egy keresen belul egy SMTP-kapcsolat; a levelek sorban mennek ki rajta.
function postas(env) {
  let kapcsolat = null;
  const SMTP_HOST = env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_USER = env.SMTP_USER || 'mosaicheadspa@gmail.com';
  const szalon = env.MAIL_TO || 'mosaicheadspa@gmail.com';
  const felado = { name: 'Mosaic Headspa', email: SMTP_USER };
  if (env.MAIL_FROM) {
    const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(env.MAIL_FROM);
    if (m) { felado.name = m[1] || felado.name; felado.email = m[2]; } else felado.email = String(env.MAIL_FROM).trim();
  }
  return {
    async kuld(l) {
      if (!env.SMTP_PASS) throw new Error('nincs SMTP-beallitas');
      if (!kapcsolat) {
        const port = Number(env.SMTP_PORT || 465);
        kapcsolat = WorkerMailer.connect({
          host: SMTP_HOST, port, secure: port === 465, startTls: port !== 465,
          credentials: { username: SMTP_USER, password: String(env.SMTP_PASS).replace(/\s+/g, '') },
          authType: 'plain',
        });
        kapcsolat.catch(() => {}); // a hibat a lenti await adja tovabb
      }
      let posta;
      try {
        posta = await kapcsolat;
      } catch (e) {
        kapcsolat = null; // a kovetkezo level ujra probal kapcsolodni
        throw e;
      }
      const valasz = l.valasz === 'szalon' ? szalon : l.valasz;
      await posta.send({
        from: felado,
        to: l.cimzett === 'szalon' ? szalon : l.cimzett,
        ...(valasz ? { reply: valasz } : {}),
        subject: l.targy,
        html: l.html,
      });
    },
    async zar() {
      if (!kapcsolat) return;
      try { await (await kapcsolat).close(); } catch { /* mar lezarult */ }
    },
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  // a tul nagy torzset be sem olvassuk (content-length, illetve olvasas kozbeni korlat)
  const t = await keresTorzs(request);
  if (t.valasz) return new Response(t.valasz.body, { status: t.valasz.status, headers: t.valasz.headers });
  const p = postas(env);
  let v;
  try {
    v = await ajandekKezel({
      method: request.method, url: request.url, headers: request.headers, text: t.text, env, kuld: (l) => p.kuld(l),
      // a Cloudflare a cf-connecting-ip fejlecet maga allitja be (a kliens erteket felulirja)
      ip: request.headers.get('cf-connecting-ip') || undefined,
    });
  } finally {
    await p.zar();
  }
  return new Response(v.body, { status: v.status, headers: v.headers });
}
