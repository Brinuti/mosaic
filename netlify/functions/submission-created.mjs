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

const SZAMLASZAM = '10700378-76447714-51100005';
const TELEFON = '06 20 247 4444';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// a feltoltott fajl a Netlify-adatban objektum ({ url, filename, ... }) vagy URL
const ertek = (v) => {
  if (v && typeof v === 'object') v = v.url || '';
  const t = String(v ?? '');
  return /^https?:\/\//.test(t) ? `<a href="${esc(t)}">${esc(decodeURIComponent(t.split('/').pop().split('?')[0]) || t)}</a>` : esc(t);
};
const betu = 'font:15px/1.6 Arial,Helvetica,sans-serif;color:#222';

// A Wix szalon-ertesitoinek formaja: bevezeto sor, majd "Cimke : ertek" sorok
const osszefoglalo = (bevezeto, cim, mezok, d) => `<div style="${betu}">
<p>${bevezeto}</p>
<p><b>${cim}</b></p>
${mezok.filter(([k]) => d[k]).map(([k, c]) => `<p style="margin:0 0 10px">${esc(c)} : ${ertek(d[k])}</p>`).join('\n')}
<p style="color:#888;font-size:12px">Beküldve innen: ${esc(d.oldal || '')}</p>
</div>`;
const wixBevezeto = (urlapNev) => `A(z) MOSAIC Headspa egy látogatója beküldte az űrlapodat (${esc(urlapNev)})`;

const URLAPOK = {
  ajandekkartya: {
    targy: 'Ajándékkártya  Előreutalásos ajándékkártyát vett',
    html: (d) => osszefoglalo('A site visitor just submitted your form Ajándékkártya on MOSAIC Headspa', 'A vásárlás adatai:', [
      ['ajandekozott', 'Ajándékozott Teljes Neve'], ['vezeteknev', 'Fizető fél Vezetékneve'],
      ['keresztnev', 'Fizető fél Keresztneve'], ['email', 'E-mail cím (Ahova a pdf-et kéred)'],
      ['telefon', 'Telefonszámod amin elérünk'], ['szamlazasi_cim', 'Számlázási cím (magán vagy céges)'],
      ['cegnev', 'Cégnév (Ha céges számlát kérsz)'], ['adoszam', 'Cég adószám (Ha céges számlát kérsz)'],
      ['kartya', 'Milyen kártyát kérsz?'], ['aszf', 'A Mosaic Headspa ÁSZF-jét elolvastam és elfogadom.'],
    ], d),
    vevo: true,
  },
  'pmu-visszahivas': {
    targy: 'Új Smink form-beküldés érkezett',
    html: (d) => osszefoglalo(wixBevezeto('Smink form'), 'Beküldés összefoglalása:', [
      ['nev', 'Név'], ['telefon', 'Telefonszám'], ['szolgaltatas', 'Szolgáltatás'],
      ['volt_mar_tetovalasa', 'Volt már korábban tetoválásod?'], ['megjegyzes', 'Mit beszéljünk át a foglalás előtt?'],
    ], d),
  },
  'fodrasz-jelentkezes': {
    targy: 'Új fodrász jelentkezett',
    html: (d) => osszefoglalo(wixBevezeto('Fodrász'), 'Beküldés összefoglalása:', [
      ['nev', 'Név'], ['email', 'Email'], ['telefon', 'Telefonszám'], ['szuletesi_ev', 'Melyik évben születtél?'],
      ['tapasztalat', 'Hány év tapasztalatod van?'], ['jelenlegi_munkahely', 'Hol dolgozol és miért váltanál?'],
      ['referencia_link', 'Fb / Insta / Tiktok referenciáid linkje:'],
      ...Array.from({ length: 10 }, (_, i) => [`kepek${i + 1}`, `Hajkép ${i + 1}`]),
    ], d),
  },
  'ppc-jelentkezes': {
    targy: 'Új PPC-jelentkezés érkezett',
    html: (d) => osszefoglalo(wixBevezeto('PPC űrlap'), 'Beküldés összefoglalása:', [
      ['nev', 'Név'], ['email', 'Email'], ['telefon', 'Telefonszám'],
      ['google_ads_ev', 'Hány év tapasztalatod van Google Ads kezelésben?'], ['google_ads_iparag', 'Milyen iparágakban hirdettél Google-ön?'],
      ['meta_ads_ev', 'Hány év tapasztalatod van Facebook Ads kezelésben?'], ['meta_ads_iparag', 'Milyen iparágakban hirdettél Facebook-on?'],
      ['wix', 'Milyen tapasztalatod van WIX landingek szerkesztésében?'], ['wordpress', 'Wordpress-ben melyik szerkesztőt használod?'],
      ['jelenlegi_munkahely', 'Hol dolgozol most, és miért váltanál?'], ['motivacio', 'Mi a fő motivációd, hogy ezen az 5 vállalkozáson dolgozz csak?'],
      ['cpa', 'Miért gondolod, hogy alacsonyabb CPA-kat tudnál elérni?'], ['berigeny', 'Havi bérigényed (nettó)'],
    ], d),
  },
};

// A vevo levele - a Wix "MOSAIC ajándékkártya utalási adatok + infók" levelenek szovege
const cim = (s) => `<p style="margin:28px 0 8px;font-weight:bold;letter-spacing:.5px">${s}</p>`;
const vevoLevel = (d) => {
  const kartya = String(d.kartya || '').replace(/\s+-\s+[\d.]+\s*Ft.*$/, '').trim();
  return `<div style="${betu};max-width:600px">
<p>Kedves ${esc(d.keresztnev || d.vezeteknev || '')}!</p>
<p>Köszönjük, hogy megvásároltad a "${esc(kartya)}" ajándékkártyát! :)</p>
<p>A vásárlás véglegesítéséhez a banki utalást ide várjuk:</p>
${cim('BANKI UTALÁSI ADATOK')}
<p>Kedvezményezett: Big In Japan Kft.<br>Számlaszám: ${SZAMLASZAM}</p>
<p>Közlemény: Az ajándékozott neve</p>
<p>Összeg:</p>
<ul>
<li>LIMITÁLT 50 perces 4 kezes Head Spa ajándékkártya esetén: 39.900 Ft</li>
<li>50 perces egyéni Head Spa kezelés esetén: 26.900 Ft</li>
<li>50 perces páros Head Spa kezelés esetén: 53.800 Ft</li>
</ul>
${cim('IDE KÜLDD A BIZONYLATOT')}
<p>Kérlek, hogy amint teljesítetted az utalást az alábbi e-mail címre küldd meg számunkra az utalási bizonylatot:</p>
<p><a href="mailto:mosaicheadspa@gmail.com">mosaicheadspa@gmail.com</a></p>
${cim('NYOMTATHATÓ FORMÁTUMBAN ELKÜLDJÜK AZ E-MAIL CÍMEDRE')}
<p>Ezt követően az ajándékkártyát elküldjük az e-mail címedre digitális (pdf) formátumban is, amit könnyen ki tudsz nyomtatni akár otthon is és már mehet is a borítékba :)</p>
${cim('SZEMÉLYESEN IS ÁTVEHETED SZALONUNKBAN')}
<p>Ha nincs nyomtatód, vagy papír alapon szeretnéd átvenni, azt pedig megteheted nálunk, a MOSAIC Headspa-ban:</p>
<p>1023 Budapest - Bécsi út 2.</p>
<p>Csak mondd be az ajándékozott nevét és a recepción odaadjuk neked a kártyát.</p>
${cim('ÍGY TUDOD FELHASZNÁLNI')}
<p>Az ajándékkártyán pedig fogsz találni egy kódot, amit az online foglalásnál tudsz majd érvényesíteni a "kuponkód" mezőbe történő beírással.</p>
<p>Ha kérdésed van, csak írj nekünk! :)</p>
<p style="margin-top:28px;font-size:13px;color:#555"><b>Budapest, 2 kerület, Bécsi út, 1023 Hungary</b><br>
<b>${TELEFON}</b><br>
<a href="https://www.mosaicheadspa.hu/"><b>Időpont foglalás</b></a></p>
</div>`;
};

export default async (req) => {
  const { payload } = await req.json();
  const urlap = payload && payload.form_name;
  const leiras = URLAPOK[urlap];
  if (!leiras) return new Response('mas urlap');
  const d = payload.data || {};
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
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '') ? d.email : undefined;

  const kuldesek = [posta.sendMail({ from: felado, to: szalon, replyTo: email, subject: leiras.targy, html: leiras.html(d) })];
  if (leiras.vevo && email) {
    kuldesek.push(posta.sendMail({
      from: felado, to: email, replyTo: szalon,
      subject: 'MOSAIC ajándékkártya utalási adatok + infók',
      html: vevoLevel(d),
    }));
  }
  for (const e of await Promise.allSettled(kuldesek)) if (e.status === 'rejected') console.error(`${urlap}: kuldesi hiba`, e.reason);
  return new Response('ok');
};
