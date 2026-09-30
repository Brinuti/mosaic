// Urlap-bekuldesek e-mailben: az ajandekkartya-rendelesrol a vevonek es a
// szalonnak, a PMU-visszahivaskeresrol (pmu-foglalas) a szalonnak.
//
// A Netlify minden sikeres urlap-bekuldes utan meghivja ezt a fuggvenyt
// (submission-created esemeny). Az eles Wix-oldal ugyanigy mukodik: a vevo a
// koszonooldalon latja az utalasi adatokat, es e-mailben is megkapja; a szalon
// e-mailben kapja a rendelest.
//
// Beallitas a Netlify feluleten (Site configuration > Environment variables):
//   SMTP_HOST   pl. smtp.gmail.com
//   SMTP_PORT   pl. 465
//   SMTP_USER   pl. mosaicheadspa@gmail.com
//   SMTP_PASS   Gmailnel "alkalmazásjelszó" (nem a sima jelszo)
//   MAIL_FROM   (nem kotelezo) a felado, alapbol SMTP_USER
//   MAIL_TO     (nem kotelezo) a szalon cime, alapbol mosaicheadspa@gmail.com
// Ha ezek hianyoznak, a fuggveny csak naplozza a bekuldest; a rendeles ettol
// meg megjelenik a Netlify Forms listajaban.
import nodemailer from 'nodemailer';

const MEZOK = [
  ['kartya', 'Ajándékkártya'],
  ['ajandekozott', 'Ajándékozott neve'],
  ['vezeteknev', 'Vezetéknév'],
  ['keresztnev', 'Keresztnév'],
  ['email', 'E-mail'],
  ['telefon', 'Telefon'],
  ['szamlazasi_cim', 'Számlázási cím'],
  ['cegnev', 'Cégnév'],
  ['adoszam', 'Adószám'],
  ['oldal', 'Oldal'],
];

const PMU_MEZOK = [
  ['nev', 'Név'],
  ['telefon', 'Telefon'],
  ['szolgaltatas', 'Szolgáltatás'],
  ['volt_mar_tetovalasa', 'Volt már tetoválása'],
  ['megjegyzes', 'Mit beszéljünk át'],
  ['oldal', 'Oldal'],
];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const tablazat = (d, mezok = MEZOK) => '<table cellpadding="6" style="border-collapse:collapse;font:14px Arial,sans-serif">' +
  mezok.filter(([k]) => d[k]).map(([k, c]) => `<tr><td style="color:#666">${c}</td><td><b>${esc(d[k])}</b></td></tr>`).join('') +
  '</table>';

const vevoLevel = (d) => `<div style="font:15px/1.5 Arial,sans-serif;color:#183033;max-width:600px">
<p>Kedves ${esc(d.keresztnev || d.vezeteknev)}!</p>
<p>🙏 Köszönjük a vásárlást! Ahhoz, hogy átvehesd az ajándékkártyádat, kérlek, hogy a vásárlás összegét utald el a MOSAIC Headspa bankszámlájára:</p>
<h3>1. Utalási adatok</h3>
<p>Kedvezményezett neve: <b>Big In Japan Kft</b><br>
Számlaszáma: <b>10700378-76447714-51100005</b><br>
Összeg:<br>
50 perces 4 kezes Head spa kezelés esetén: <b>39.900 Ft</b><br>
50 perces egyéni Head Spa kezelés esetén: <b>26.900 Ft</b><br>
Páros Head Spa kezelés esetén: <b>53.800 Ft</b><br>
Közlemény: <b>${esc(d.ajandekozott || 'az ajándékozott(ak) neve')}</b></p>
<h3>2. Bizonylat küldés</h3>
<p>Utána küldd el kérlek az utalási bizonylatot e-mailben a <a href="mailto:mosaicheadspa@gmail.com">mosaicheadspa@gmail.com</a> címre.</p>
<h3>3. Megkapod e-mailben az ajándékkártyát</h3>
<p>Ezt követően átküldjük az e-mail címedre az ajándékkártyád nyomtatható verzióját, amely tartalmazza a kuponkódot a foglaláshoz.</p>
<h3>4. Átveheted személyesen is papír alapon</h3>
<p>Papír alapon, szép díszes borítékban is átveheted az ajándékkártyát nyitvatartási időben: 1023 Budapest, Bécsi út 2. - MOSAIC Headspa</p>
<h3>5. Kérdésed van?</h3>
<p>Írj nekünk: <a href="mailto:mosaicheadspa@gmail.com">mosaicheadspa@gmail.com</a>, vagy hívj minket: 06 20 247 4444</p>
<h3>A rendelésed</h3>
${tablazat(d)}
<p>Szeretettel:<br>A MOSAIC Headspa csapata</p>
</div>`;

export default async (req) => {
  const { payload } = await req.json();
  const urlap = payload && payload.form_name;
  if (urlap !== 'ajandekkartya' && urlap !== 'pmu-visszahivas') return new Response('mas urlap');
  const d = payload.data || {};
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(`${urlap}: nincs SMTP-beallitas, e-mail nem ment ki`, JSON.stringify(d));
    return new Response('nincs smtp');
  }
  const port = Number(SMTP_PORT || 465);
  const posta = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  const felado = process.env.MAIL_FROM || `MOSAIC Headspa <${SMTP_USER}>`;
  const szalon = process.env.MAIL_TO || 'mosaicheadspa@gmail.com';

  if (urlap === 'pmu-visszahivas') {
    try {
      await posta.sendMail({
        from: felado, to: szalon,
        subject: `PMU visszahívás: ${d.nev || ''} - ${d.telefon || ''}`,
        html: `<p style="font:15px Arial,sans-serif">Új visszahíváskérés érkezett a PMU-oldalról (1 munkanapon belül hívd vissza):</p>${tablazat(d, PMU_MEZOK)}`,
      });
    } catch (e) {
      console.error('pmu-visszahivas: kuldesi hiba', e);
    }
    return new Response('ok');
  }
  const nev = `${d.vezeteknev || ''} ${d.keresztnev || ''}`.trim();

  const kuldesek = [posta.sendMail({
    from: felado, to: szalon, replyTo: d.email || undefined,
    subject: `Új ajándékkártya-rendelés: ${d.kartya || ''} - ${nev}`,
    html: `<p style="font:15px Arial,sans-serif">Új ajándékkártya-rendelés érkezett a weboldalról:</p>${tablazat(d)}`,
  })];
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) {
    kuldesek.push(posta.sendMail({
      from: felado, to: d.email, replyTo: szalon,
      subject: 'Ajándékkártya: Sikeres vásárlás! - MOSAIC Headspa',
      html: vevoLevel(d),
    }));
  }
  const eredmeny = await Promise.allSettled(kuldesek);
  for (const e of eredmeny) if (e.status === 'rejected') console.error('ajandekkartya: kuldesi hiba', e.reason);
  return new Response('ok');
};
