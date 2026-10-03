// Az urlap-bekuldesek levelei - kozos a Netlify-fuggvenynek
// (netlify/functions/submission-created.mjs) es a Cloudflare Pages-fuggvenynek
// (functions/[[path]].js). Ugyanazok a levelek, amiket a Wix kuldott, lasd ott.

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

export const URLAPOK = {
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
  // a /foglalo-pmu probaoldal urlapjai (B/D ag: foto; C ag: visszahivas)
  'pmu-proba-foto': {
    targy: '[PRÓBA] Sminktetoválás – fotó érkezett',
    html: (d) => osszefoglalo('A sminktetoválás-foglaló (próba) egy látogatója fotót küldött.', 'Beküldés összefoglalása:', [
      ['ag', 'Ág'], ['nev', 'Név'], ['telefon', 'Telefonszám'], ['email', 'E-mail'], ['kezeles', 'Kezelés / terület'],
      ['idopont', 'Választott időpont'], ...Array.from({ length: 5 }, (_, i) => [`foto${i + 1}`, `Fotó ${i + 1}`]),
    ], d),
  },
  'pmu-proba-visszahivas': {
    targy: '[PRÓBA] Sminktetoválás – visszahívást kértek (10 perces konzultáció)',
    html: (d) => osszefoglalo('A sminktetoválás-foglaló (próba) egy látogatója visszahívást kért.', 'Beküldés összefoglalása:', [
      ['nev', 'Név'], ['telefon', 'Telefonszám'], ['mikor_nap', 'Melyik nap?'], ['mikor_napszak', 'Melyik napszakban?'],
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


// urlap + adatok -> a kikuldendo levelek ({ targy, html, cimzett: 'szalon' | 'vevo' })
export function levelek(urlap, d) {
  const leiras = URLAPOK[urlap];
  if (!leiras) return null;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '') ? d.email : undefined;
  // a pmu-proba-* urlapokat az eles /pmu-sminktetovalas landing is hasznalja (beagyazott foglalo): onnan nem proba
  const targy = d.oldal === 'pmu-sminktetovalas' ? leiras.targy.replace(/^\[PRÓBA\]\s*/, '') : leiras.targy;
  const ki = [{ cimzett: 'szalon', valasz: email, targy, html: leiras.html(d) }];
  if (leiras.vevo && email) {
    ki.push({ cimzett: email, valasz: 'szalon', targy: 'MOSAIC ajándékkártya utalási adatok + infók', html: vevoLevel(d) });
  }
  return ki;
}
