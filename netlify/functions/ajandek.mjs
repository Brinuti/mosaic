// MOSAIC Gift Commerce Engine - Netlify-fuggveny (az /api/ajandek/* cimek).
// A teljes logika a kozos kezeloben van (netlify/lib/ajandek.js); ez csak a Netlify Request ->
// kezelo -> Response atalakitas es a levelkuldes (nodemailer, mint a submission-created.mjs).
//
// Beallitas a Netlify feluleten (Environment variables):
//   STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, AJANDEK_TITOK,
//   (nem kotelezo) AJANDEK_BAZIS_URL, AJANDEK_AZONNALI
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO - ugyanazok, mint az urlapoknal.
// Ha nincs SMTP-beallitas, a levelkuldes hibat dob: a webhook ilyenkor nem 2xx-et ad, igy a
// Stripe kesobb ujraprobalja (egy fizetett rendeles ertesitoje nem veszhet el csendben).
import nodemailer from 'nodemailer';
import { ajandekKezel } from '../lib/ajandek.js';

function levelkuldo() {
  let posta = null;
  return async (l) => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error('nincs SMTP-beallitas');
    if (!posta) {
      const port = Number(SMTP_PORT || 465);
      // a Google az alkalmazasjelszot negyes csoportokban, szokozokkel mutatja
      posta = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, '') } });
    }
    const felado = process.env.MAIL_FROM || `Mosaic Headspa <${SMTP_USER}>`;
    const szalon = process.env.MAIL_TO || 'mosaicheadspa@gmail.com';
    await posta.sendMail({
      from: felado,
      to: l.cimzett === 'szalon' ? szalon : l.cimzett,
      replyTo: l.valasz === 'szalon' ? szalon : l.valasz,
      subject: l.targy,
      html: l.html,
    });
  };
}

export default async (req) => {
  const headers = {};
  for (const [k, v] of req.headers) headers[k.toLowerCase()] = v;
  const text = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text();
  const v = await ajandekKezel({ method: req.method, url: req.url, headers, text, env: process.env, kuld: levelkuldo() });
  return new Response(v.body, { status: v.status, headers: v.headers });
};

export const config = { path: '/api/ajandek/*' };
