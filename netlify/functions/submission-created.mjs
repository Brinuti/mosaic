// Urlap-bekuldesek e-mailben - ugyanazok a levelek, amiket a Wix kuldott
// (a mosaicheadspa@gmail.com postafiokban levo Wix-levelek alapjan):
//   ajandekkartya       vevonek: "MOSAIC ajándékkártya utalási adatok + infók"
//                       szalonnak: "Ajándékkártya  Előreutalásos ajándékkártyát vett"
//   pmu-visszahivas     szalonnak: "Új Smink form-beküldés érkezett"
//   fodrasz-jelentkezes szalonnak: "Új fodrász jelentkezett"
//   ppc-jelentkezes     szalonnak: "Új PPC-jelentkezés érkezett" (a Wixen ehhez nem
//                       volt automatikus level; igy legalabb nem vesz el)
// A kitoltonek csak az ajandekkartyanal megy level, mint a Wixen.
//
// A Netlify minden sikeres urlap-bekuldes utan meghivja ezt a fuggvenyt
// (submission-created esemeny). Beallitas a Netlify feluleten (Environment variables):
//   SMTP_HOST   smtp.gmail.com
//   SMTP_PORT   465
//   SMTP_USER   mosaicheadspa@gmail.com
//   SMTP_PASS   Gmail "alkalmazásjelszó"
//   MAIL_FROM   (nem kotelezo) a felado, alapbol "Mosaic Headspa <SMTP_USER>"
//   MAIL_TO     (nem kotelezo) a szalon cime, alapbol mosaicheadspa@gmail.com
// Ha ezek hianyoznak, a fuggveny csak naplozza a bekuldest; a bekuldes ettol
// meg megjelenik a Netlify Forms listajaban.
import nodemailer from 'nodemailer';
import { levelek } from '../lib/levelek.js';

export default async (req) => {
  const { payload } = await req.json();
  const urlap = payload && payload.form_name;
  const d = (payload && payload.data) || {};
  const lista = levelek(urlap, d);
  if (!lista) return new Response('mas urlap');
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`${urlap}: nincs SMTP-beallitas, e-mail nem ment ki`, JSON.stringify(d));
    return new Response('nincs smtp');
  }
  const port = Number(SMTP_PORT || 465);
  // a Google az alkalmazasjelszot negyes csoportokban, szokozokkel mutatja
  const posta = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, '') } });
  const felado = process.env.MAIL_FROM || `Mosaic Headspa <${SMTP_USER}>`;
  const szalon = process.env.MAIL_TO || 'mosaicheadspa@gmail.com';
  const kuldesek = lista.map((l) => posta.sendMail({
    from: felado,
    to: l.cimzett === 'szalon' ? szalon : l.cimzett,
    replyTo: l.valasz === 'szalon' ? szalon : l.valasz,
    subject: l.targy,
    html: l.html,
  }));
  for (const e of await Promise.allSettled(kuldesek)) if (e.status === 'rejected') console.error(`${urlap}: kuldesi hiba`, e.reason);
  return new Response('ok');
};
