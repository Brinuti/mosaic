// MOSAIC Gift Commerce Engine - a LEZERES SZORTELENITES ajandekkartya Cloudflare Pages-fuggvenye (az /api/ajandek-lezer/* cimek).
// Ugyanaz a motor, mint a HeadSpa /api/ajandek/* (netlify/lib/ajandek.js, ajandekMotor), de sajat kereskedo-adattal
// (assets/js/ajandek-adat-lezer.js), sajat Stripe-fiokkal es sajat Szamlazz.hu-fiokkal (Szamla Agent). A HeadSpa-kartyakat ez nem erinti.
//
// Beallitas (Cloudflare: Workers & Pages -> mosaic -> Settings -> Variables and secrets, Production / Preview kulon, Secret tipussal):
//   LEZER_STRIPE_SECRET_KEY        a lezeres Stripe-fiok KORLATOZOTT kulcsa (rk_live... / rk_test...): PaymentIntents: Write, Charges and Refunds: Read
//   LEZER_STRIPE_WEBHOOK_SECRET    a webhook alairo titka (whsec_...): https://<host>/api/ajandek-lezer/webhook
//   LEZER_SZAMLAZZ_AGENT_KULCS     a Szamlazz.hu Szamla Agent kulcs
// Nem titkos (wrangler.toml [vars] / [env.preview.vars]): LEZER_STRIPE_PUBLISHABLE_KEY (pk_live... / pk_test...), SZAMLA_ELONEZET ('1' = az elonezeten csak
// elonezeti PDF keszul, valodi szamla nem). A level-kuldes (SMTP_*), az AJANDEK_TITOK, az AJANDEK_BAZIS_URL, az AJANDEK_AZONNALI es a KV (AJANDEK_FOTOK)
// KOZOS a HeadSpa-val. A lezeres Stripe-kulcs hianyaban a fuggveny NEM esik vissza a HeadSpa kulcsara: hiba (503) lesz belole.
import { WorkerMailer } from 'worker-mailer';
import '../../../assets/js/ajandek-adat.js';
import '../../../assets/js/ajandek-adat-lezer.js';
import { ajandekMotor, keresTorzs } from '../../../netlify/lib/ajandek.js';
import { lezerKornyezet } from '../../../netlify/lib/ajandek-lezer-env.js';

const motor = ajandekMotor(globalThis.AJANDEK_ADAT_LEZER, { elotag: '/api/ajandek-lezer/' });

// Egy keresen belul egy SMTP-kapcsolat; a levelek sorban mennek ki rajta (ugyanaz, mint a HeadSpa-fuggvenyben).
function postas(env) {
  let kapcsolat = null;
  const SMTP_HOST = env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_USER = env.SMTP_USER || 'mosaicheadspa@gmail.com';
  const szalon = env.MAIL_TO || 'mosaicheadspa@gmail.com';
  const felado = { name: 'MOSAIC Lézeres Szőrtelenítés', email: SMTP_USER };
  if (env.MAIL_FROM) {
    const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(env.MAIL_FROM);
    if (m) { felado.email = m[2]; } else felado.email = String(env.MAIL_FROM).trim();
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

// IDEIGLENES hibakereso (csak az elonezeti / nem eles gazdakon): megmutatja, melyik LEZER_* beallitas van meg a kornyezetben (az ertek SOHA nem latszik,
// csak hogy van-e, a kulcs fajtaja es a hossza). Az eles domainen nem erheto el. A beallitas ellenorzese utan torolni.
function diag(context) {
  const e = context.env || {};
  const j = (n) => {
    const v = String(e[n] || '').trim();
    if (!v) return { van: false };
    const m = /^(sk_test|rk_test|sk_live|rk_live|pk_test|pk_live|whsec)_/.exec(v);
    return { van: true, fajta: m ? m[1] : 'ismeretlen', hossz: v.length };
  };
  return new Response(JSON.stringify({
    kornyezet: e.ESEMENY_IRAS ? 'production-szeru (ESEMENY_IRAS van)' : 'preview-szeru',
    LEZER_STRIPE_SECRET_KEY: j('LEZER_STRIPE_SECRET_KEY'), LEZER_STRIPE_PUBLISHABLE_KEY: j('LEZER_STRIPE_PUBLISHABLE_KEY'),
    LEZER_STRIPE_WEBHOOK_SECRET: j('LEZER_STRIPE_WEBHOOK_SECRET'), LEZER_SZAMLAZZ_AGENT_KULCS: { van: !!String(e.LEZER_SZAMLAZZ_AGENT_KULCS || '').trim(), hossz: String(e.LEZER_SZAMLAZZ_AGENT_KULCS || '').trim().length },
    AJANDEK_TITOK: { van: String(e.AJANDEK_TITOK || '').length >= 32 }, SZAMLA_ELONEZET: String(e.SZAMLA_ELONEZET || ''),
  }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (url.pathname.endsWith('/__diag') && !/^(www\.)?mosaicheadspa\.hu$/.test(url.hostname)) return diag(context);
  const env = lezerKornyezet(context.env || {});
  // a tul nagy torzset be sem olvassuk (content-length, illetve olvasas kozbeni korlat)
  const t = await keresTorzs(request);
  if (t.valasz) return new Response(t.valasz.body, { status: t.valasz.status, headers: t.valasz.headers });
  const p = postas(env);
  let v;
  try {
    v = await motor.ajandekKezel({
      method: request.method, url: request.url, headers: request.headers, text: t.text, env, kuld: (l) => p.kuld(l),
      // a Cloudflare a cf-connecting-ip fejlecet maga allitja be (a kliens erteket felulirja)
      ip: request.headers.get('cf-connecting-ip') || undefined,
    });
  } finally {
    await p.zar();
  }
  return new Response(v.body, { status: v.status, headers: v.headers });
}
