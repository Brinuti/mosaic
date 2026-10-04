// A Salonic foglalo-linkek atkotese a kozos foglalora (/foglalo-motor): KOZPONTI TERKEP, uzletagankent kapcsolhato.
//
// Az oldalak (klon/*.html, klon/m/*.html) Wix-bol mentett, sokszor ismetlodo Salonic-linkeket tartalmaznak. Ezeket nem
// kezzel irjuk at: a build (tools/netlify-build.mjs) a kapcsolok (tools/foglalo-atkotes.json) szerint cserel.
// Kikapcsolt kapcsolonal a kimenet BAJTRA azonos a mostanival (az atkot() ilyenkor nem nyul a szovegbe).
//
//   node tools/foglalo-atkotes.mjs --jelentes     melyik oldalon hany link menne at, mi marad Salonic-link
//
// Ami NEM megy at (marad Salonic-link): a PMU foglalo (mosaic-pmu, kulon, mar elo motor), az ajandekkartya-vasarlas (/giftcards),
// a Salonic fooldalai es a naptar-API.
//
// A SAJAT foglalo-oldalakra mutato linkek (a fomenu "FOGLALAS" gombja es az oldalak gombjai: /idpontfoglalas, /mosaic-hair-idopontfoglalas,
// /szortelenites-foglalas, /pmu-foglalas) is a foglalora kotodnek (atkotBelso): a menu az altalanos kezdoallapotra (H0), a gombok az oldal
// uzletagara. A regi foglalo-oldalak maguk megmaradnak (hirdetesi landing, merokod), csak a hozzajuk vezeto linkek valtoznak.
import fs from 'node:fs';
import path from 'node:path';

export const MOTOR = '/foglalo-motor';
export const UZLETAGAK = Object.freeze(['headspa', 'oxigen', 'fodraszat', 'lezer']);
// A kapcsolok: a negy uzletag (Salonic-linkek + oldalgombok) + a PMU (az oldalgombok a PMU foglalo retegere) + a fejlec (a fomenu "FOGLALAS" gombja)
// + a regi (a regi foglalo-oldalak: ures oldal + bezarhatatlan felugro foglalo)
export const KAPCSOLOK = Object.freeze([...UZLETAGAK, 'pmu', 'fejlec', 'regi']);

// A koszonooldalakhoz (success-*, *-ok) a mereshez tartozo oldalak miatt NEM nyulunk: ezeken a linkek maradnak, ahogy vannak.
export const kihagyottOldal = (fajlnev) => /^(success-|.+-ok$|oxigenterapia-masodik$|pmu-vh$)/.test(String(fajlnev).replace(/\.html$/, '')); // + az oxigen visszajaro / PMU visszahivas koszonoje (GTM oldalmegtekintes-triggerek)

const HOST = Object.freeze({
  headspa: 'mosaicheadspa.salonic.hu',
  oxigen: 'mosaic-oxigen.salonic.hu',
  hair: 'mosaic-hair.salonic.hu',
  elysion: 'mosaic-elysion.salonic.hu',
});

// Egy szabaly: host + utvonal-elotag (+ lekerdezes-parameterek) -> a foglalo URL-je. A "kapcsolo" a 4 uzletag egyike.
// A foglalo parameterei: business, service (azonosito vagy kulcs), voucher=1, intent (lezer: first | returning), category.
export const SZABALYOK = Object.freeze([
  // --- HeadSpa ---
  { kapcsolo: 'headspa', host: HOST.headspa, utvonal: '/selectSpecialization', cel: { business: 'headspa' } },
  { kapcsolo: 'headspa', host: HOST.headspa, utvonal: '/employees/23532', cel: { business: 'headspa' } }, // a regi, mar nem el ket (a Salonic fooldalara dobna)
  { kapcsolo: 'headspa', host: HOST.headspa, utvonal: '/showServices', parameter: { specId: '39592' }, cel: { business: 'headspa' } }, // normal idopontok
  { kapcsolo: 'headspa', host: HOST.headspa, utvonal: '/showServices', parameter: { specId: '41471' }, cel: { business: 'headspa', voucher: '1' } }, // ajandekkartyas / kuponos beváltás
  { kapcsolo: 'headspa', host: HOST.headspa, utvonal: '/selectDate', parameter: { serviceId: '239336' }, cel: { business: 'headspa', service: 'paros' } }, // az angol oldal "Double Head Spa" gombja (a regi Salonic-szolgaltatas mar nem el)
  // --- Oxigen ---
  { kapcsolo: 'oxigen', host: HOST.oxigen, utvonal: '/selectEmployee', parameter: { serviceId: '466110' }, cel: { business: 'oxygen', service: '466110' } }, // 1. alkalom
  { kapcsolo: 'oxigen', host: HOST.oxigen, utvonal: '/selectEmployee', parameter: { serviceId: '466158' }, cel: { business: 'oxygen', service: '466158' } }, // 2. alkalomtol
  { kapcsolo: 'oxigen', host: HOST.oxigen, utvonal: '/selectEmployee', parameter: { serviceId: '466147' }, cel: { business: 'oxygen', service: '466147' } }, // az uj oxigen-landing "Csak hajkameras allapotfelmeres" (4 990 Ft)
  // --- Fodraszat ---
  { kapcsolo: 'fodraszat', host: HOST.hair, utvonal: '/selectSpecialization', cel: { business: 'hair' } },
  { kapcsolo: 'fodraszat', host: HOST.hair, utvonal: '/showServices', cel: { business: 'hair' } }, // (a regi employeeId=23694 / serviceId=0 link is ide tartozik)
  // --- Lezer: a lezeres oldalak a Hair-fiok rejtett "Ingyenes konzultacio" szolgaltatasara (444584) mutatnak; az Elysion-fiokban is van (476477, DECISIONS 25) ---
  { kapcsolo: 'lezer', host: HOST.hair, utvonal: '/selectDate', parameter: { serviceId: '444584' }, cel: { business: 'laser', service: 'konzult' } },
  { kapcsolo: 'lezer', host: HOST.hair, utvonal: '/selectEmployee', parameter: { serviceId: '444584' }, cel: { business: 'laser', service: 'konzult' } },
  { kapcsolo: 'lezer', host: HOST.elysion, utvonal: '/selectDate', parameter: { serviceId: '476477' }, cel: { business: 'laser', service: 'konzult' } },
  { kapcsolo: 'lezer', host: HOST.elysion, utvonal: '/showServices', parameter: { specId: '66404' }, cel: { business: 'laser', intent: 'first' } }, // "ELSO IDOPONTOK"
  { kapcsolo: 'lezer', host: HOST.elysion, utvonal: '/showServices', parameter: { specId: '66405' }, cel: { business: 'laser', intent: 'returning' } }, // "KEZELES IDOPONTOK"
]);

const SALONIC_URL = /https?:\/\/[a-z0-9.-]*salonic\.hu[^"'<>\s)\\]*/gi;

export const celUrl = (cel, motor = MOTOR) => motor + '?' + Object.entries(cel).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

/** Egy Salonic-URL -> { kapcsolo, cel (a foglalo URL-je) } vagy null (marad Salonic-link). */
export function celra(url, motor = MOTOR) {
  let u;
  try { u = new URL(String(url).replace(/&amp;/g, '&')); } catch (e) { return null; }
  const utvonal = u.pathname.replace(/\/+$/, '');
  for (const r of SZABALYOK) {
    if (u.hostname !== r.host) continue;
    if (utvonal !== r.utvonal && !utvonal.startsWith(r.utvonal + '/')) continue;
    if (r.parameter && !Object.entries(r.parameter).every(([k, v]) => u.searchParams.get(k) === v)) continue;
    return { kapcsolo: r.kapcsolo, cel: celUrl(r.cel, motor) };
  }
  return null;
}

const normKapcsolok = (kapcsolok) => (kapcsolok instanceof Set ? kapcsolok : new Set(Object.entries(kapcsolok || {}).filter(([, be]) => be).map(([k]) => k)));
const jegyzek = (lista = UZLETAGAK) => Object.fromEntries(lista.map((k) => [k, 0]));

/**
 * HTML-oldal: minden href="<Salonic-URL>" ertekere, ha a szabaly uzletaganak kapcsoloja be van kapcsolva, a foglalo URL-je kerul
 * (az & HTML-ben &amp;). A tobbi attributum (target, rel, ...) es minden mas valtozatlan. Kikapcsolva a bemenet marad.
 * @returns {{ html: string, db: Record<string, number> }}
 */
export function atkot(html, kapcsolok, motor = MOTOR) {
  const be = normKapcsolok(kapcsolok);
  const db = jegyzek();
  if (!be.size) return { html, db };
  const ujHtml = html.replace(/href="(https?:\/\/[a-z0-9.-]*salonic\.hu[^"]*)"/gi, (egesz, url) => {
    const t = celra(url, motor);
    if (!t || !be.has(t.kapcsolo)) return egesz;
    db[t.kapcsolo]++;
    return `href="${t.cel.replace(/&/g, '&amp;')}"`;
  });
  return { html: ujHtml, db };
}

/** Szkript (JS-szoveg, pl. assets/js/gyik.js: HTML-t tartalmazo karakterlancok): a Salonic-URL-ek ugyanilyen cserevel, idezojel/backslash megtartasaval. */
export function atkotSzoveg(szoveg, kapcsolok, motor = MOTOR) {
  const be = normKapcsolok(kapcsolok);
  const db = jegyzek();
  if (!be.size) return { szoveg, db };
  const uj = szoveg.replace(SALONIC_URL, (url) => {
    const t = celra(url, motor);
    if (!t || !be.has(t.kapcsolo)) return url;
    db[t.kapcsolo]++;
    return t.cel;
  });
  return { szoveg: uj, db };
}

// --- a sajat foglalo-oldalakra mutato linkek (menu + oldalgombok) ----------------------------------------------------------------------------
const BELSO_FOGLALAS = /^(?:https?:\/\/(?:www\.)?mosaicheadspa\.hu)?(\/(?:idpontfoglalas|mosaic-hair-idopontfoglalas|szortelenites-foglalas|pmu-foglalas))\/?(?:[?#].*)?$/i;

/** Az oldal uzletaga a fajlnev alapjan (a gombok celja ettol fugg); null = nem ismert (HeadSpa az alapertelmezes az /idpontfoglalas gombjainal). */
export function oldalUzletag(fajlnev) {
  const n = String(fajlnev).replace(/\.html$/, '').replace(/^.*\//, '');
  if (/^sminktetovalas/.test(n)) return 'pmu';
  if (/^(lezeres-|szortelenites-|szőrtelenítés|szor-konzi|vegleges-)/.test(n)) return 'lezer';
  if (/^oxigenterapia-/.test(n)) return 'oxigen';
  if (/^(noi-fodrasz|noi-hajfestes|balayage-|30szazalek|fodrasz-|fodraszat-)/.test(n)) return 'fodraszat';
  if (/^(headspa|head-spa|paros-headspa|4-kezes|home$|index$|ajandekkartya|japan-headspa)/.test(n)) return 'headspa';
  return null;
}
const kategoriaOldal = (fajlnev) => {
  const n = String(fajlnev).replace(/\.html$/, '').replace(/^.*\//, '');
  if (/balayage/.test(n)) return 'balayage';
  if (/^noi-hajfestes/.test(n)) return 'color';
  return null;
};
const BETU = { '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&ouml;': 'ö', '&odblac;': 'ő', '&uacute;': 'ú', '&uuml;': 'ü', '&udblac;': 'ű', '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó', '&Ouml;': 'Ö', '&Odblac;': 'Ő', '&Uacute;': 'Ú', '&Uuml;': 'Ü', '&Udblac;': 'Ű', '&amp;': '&', '&gt;': '>', '&nbsp;': ' ' };
const felirat = (belso, attrs) => (String(belso).replace(/<[^>]+>/g, '').replace(/&[a-zA-Z#0-9]+;/g, (e) => BETU[e] || e).replace(/\s+/g, ' ').trim()
  || (/aria-label="([^"]*)"/.exec(attrs) || [])[1] || '');
const FEJLEC_FELIRAT = /^foglalás$/i; // a fomenu (asztali + mobil) gombja: a felirata pontosan "FOGLALÁS" / "Foglalás"

/**
 * Egy belso foglalo-link celja: { kapcsolo, cel } vagy null (marad). Kontextus: az oldal fajlneve + a link felirata.
 *  - /idpontfoglalas "FOGLALÁS" (fomenu)            -> /foglalo-motor            (kapcsolo: fejlec)  altalanos kezdoallapot (Mit szeretnél foglalni?)
 *  - /idpontfoglalas egyeb gomb                      -> az oldal uzletaga (alap: HeadSpa), "PÁROS ..." -> paros
 *  - /mosaic-hair-idopontfoglalas                    -> oxigen oldalon oxygen, egyebkent hair (konzultacio-felirat: service=konzult; balayage / hajfestes oldal: service_category)
 *  - /szortelenites-foglalas                         -> laser
 *  - /pmu-foglalas                                   -> pmu
 * A sajat oldalra mutato link (fuleken, onhivatkozas) nem valtozik; a fomenu-gomb mindenhol atkothetö.
 */
export function belsoCel(href, fajlnev, szoveg, motor = MOTOR) {
  const m = BELSO_FOGLALAS.exec(String(href).replace(/&amp;/g, '&'));
  if (!m) return null;
  const celOldal = m[1].toLowerCase();
  const sajat = '/' + String(fajlnev).replace(/\.html$/, '').replace(/^.*\//, '');
  const oldal = oldalUzletag(fajlnev);
  const sz = String(szoveg || '');
  if (celOldal === '/idpontfoglalas' && FEJLEC_FELIRAT.test(sz)) return { kapcsolo: 'fejlec', cel: motor };
  if (celOldal === sajat) return null; // onhivatkozas (fulek a foglalo-oldalon): nem a foglalo gombja
  if (celOldal === '/idpontfoglalas') {
    if (/páros/i.test(sz)) return { kapcsolo: 'headspa', cel: celUrl({ business: 'headspa', service: 'paros' }, motor) };
    const kapcsolo = oldal || 'headspa'; // az oldal uzletaga (ismeretlen oldalon HeadSpa)
    const business = { headspa: 'headspa', fodraszat: 'hair', oxigen: 'oxygen', lezer: 'laser', pmu: 'pmu' }[kapcsolo];
    return { kapcsolo, cel: celUrl({ business }, motor) };
  }
  if (celOldal === '/mosaic-hair-idopontfoglalas') {
    if (oldal === 'oxigen') return { kapcsolo: 'oxigen', cel: celUrl({ business: 'oxygen' }, motor) };
    const cel = { business: 'hair' };
    if (/konzult|kontult/i.test(sz)) cel.service = 'konzult';
    else if (kategoriaOldal(fajlnev)) cel.service_category = kategoriaOldal(fajlnev);
    return { kapcsolo: 'fodraszat', cel: celUrl(cel, motor) };
  }
  if (celOldal === '/szortelenites-foglalas') return { kapcsolo: 'lezer', cel: celUrl({ business: 'laser' }, motor) };
  if (celOldal === '/pmu-foglalas') return { kapcsolo: 'pmu', cel: celUrl({ business: 'pmu' }, motor) };
  return null;
}

/**
 * HTML-oldal: a belso foglalo-linkek (fomenu + oldalgombok) a foglalora kotese, a kapcsolok szerint. Csak ott, ahol a foglalo-reteg indito is rajta van
 * (launcher: false -> valtozatlan; pl. koszonooldalak, a sajat foglalo-oldalak). A tobbi attributum es minden mas valtozatlan.
 * @returns {{ html: string, db: Record<string, number> }}
 */
export function atkotBelso(html, fajlnev, kapcsolok, { launcher = true, motor = MOTOR } = {}) {
  const be = normKapcsolok(kapcsolok);
  const db = jegyzek(KAPCSOLOK);
  if (!be.size || !launcher) return { html, db };
  const ujHtml = html.replace(/<a\b([^>]*?)\bhref="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (egesz, elo, href, utan, belso) => {
    const t = belsoCel(href, fajlnev, felirat(belso, elo + ' ' + utan), motor);
    if (!t || !be.has(t.kapcsolo)) return egesz;
    db[t.kapcsolo]++;
    return `<a${elo}href="${t.cel.replace(/&/g, '&amp;')}"${utan}>${belso}</a>`;
  });
  return { html: ujHtml, db };
}

// --- a regi foglalo-oldalak: ures oldal + bezarhatatlan felugro foglalo ------------------------------------------------------------------------
// A cim megmarad (hirdetes-szoveg, Google-profil, Instagram, konyvjelzo, e-mail), a tartalom el van rejtve, a foglalo magatol megnyilik, nincs X;
// a mero kod (GTM, suti-sav, pixel) az oldalon marad, igy a latogatas tovabbra is szamit. Kulcs: a fajlnev kiterjesztes nelkul; ertek: a foglalo kontextusa.
export const URES_OLDALAK = Object.freeze({
  idpontfoglalas: {}, // az altalanos kezdoallapot: "Mit szeretnel foglalni?"
  'mosaic-hair-idopontfoglalas': { business: 'oxygen' }, // a rajta futo (4) Meta-hirdetes oxigenterapia (a tulajdonos dontese)
  'szortelenites-foglalas': { business: 'laser' },
  'pmu-foglalas': { business: 'pmu' },
  'smink-foglalas': { business: 'pmu' },
  naptar: {},
});

/**
 * HTML-oldal: a regi foglalo-oldal "ures oldal + bezarhatatlan felugro" valtozata. Csak a "regi" kapcsolo mellett, csak ott, ahol a launcher rajta van.
 * A tartalom (#SITE_CONTAINER) el van rejtve; a suti-sav marad es a foglalo FOLOTT latszik; JS nelkul a latogato a /foglalas oldalra es a telefonszamra kap utalast.
 * @returns {{ html: string, db: Record<string, number> }}
 */
export function uresOldal(html, fajlnev, kapcsolok) {
  const db = jegyzek(KAPCSOLOK);
  const nev = String(fajlnev).replace(/\.html$/, '').replace(/^.*\//, '');
  if (!normKapcsolok(kapcsolok).has('regi') || !(nev in URES_OLDALAK) || !html.includes('booking-launcher.js') || !html.includes('</head>') || !html.includes('</body>')) return { html, db };
  const ctx = JSON.stringify(URES_OLDALAK[nev]);
  const stilus = '<style id="mh-ures">#SITE_CONTAINER{display:none!important}html,body{background:#fff!important}#mh-cc,#mh-cc-reopen{z-index:2147483001!important}</style>';
  const nincsJs = '<noscript><div style="max-width:520px;margin:64px auto;padding:0 20px;text-align:center;font-family:Jost,Arial,sans-serif;color:#1f2d2b;line-height:1.5"><h1 style="font-size:22px;font-weight:500">Időpontfoglalás</h1>'
    + '<p><a href="/foglalas" style="color:#1f2d2b">Foglalj időpontot itt</a>, vagy hívj minket: <a href="tel:+36202474444" style="color:#1f2d2b">06 20 247 4444</a>.</p></div></noscript>';
  const nyito = '<script type="module">window.openBooking(' + ctx + ',{zarhatatlan:true});</script>'; // a launcher modul (elozo script) mar definialta az openBooking-ot
  const uj = html.replace('</head>', () => stilus + '</head>').replace('</body>', () => nincsJs + nyito + '</body>');
  db.regi++;
  return { html: uj, db };
}

export const osszead = (a, b) => Object.fromEntries(KAPCSOLOK.map((k) => [k, (a[k] || 0) + (b[k] || 0)]));

/**
 * A build kapcsoloi: tools/foglalo-atkotes.json "kapcsolok" (eles). Eloneztet / helyi buildnel (nem eles) az "elonezetBe": true
 * mindent bekapcsol, hogy a PR elonezeten kiprobalhato legyen. A FOGLALO_ATKOTES kornyezeti valtozo felulir: "all" | "none" | "headspa,lezer".
 */
export function kapcsolokBuildhez({ eles, env = process.env, konfig = beolvasKonfig() } = {}) {
  const ki = new Set();
  const felulir = (env.FOGLALO_ATKOTES || '').trim().toLowerCase();
  if (felulir === 'all') return new Set(KAPCSOLOK);
  if (felulir === 'none') return ki;
  if (felulir) return new Set(felulir.split(/[\s,]+/).filter((k) => KAPCSOLOK.includes(k)));
  if (!eles && konfig.elonezetBe) return new Set(KAPCSOLOK);
  return normKapcsolok(konfig.kapcsolok);
}

export function beolvasKonfig(fajl = path.join(import.meta.dirname, 'foglalo-atkotes.json')) {
  return JSON.parse(fs.readFileSync(fajl, 'utf8'));
}

// --- jelentes (CLI) -------------------------------------------------------------------------------------------------------------
function jelentes() {
  const gyoker = path.resolve(import.meta.dirname, '..');
  const sor = [];
  const maradt = new Map();
  let osszes = jegyzek();
  for (const mappa of ['klon', 'klon/m']) {
    for (const f of fs.readdirSync(path.join(gyoker, mappa)).filter((x) => x.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(gyoker, mappa, f), 'utf8');
      if (kihagyottOldal(f)) {
        const n = Object.values(atkot(html, new Set(UZLETAGAK)).db).reduce((a, b) => a + b, 0);
        if (n) sor.push(`${(mappa + '/' + f).padEnd(60)} KIHAGYVA (koszonooldal): ${n} link marad Salonic-link`);
        continue;
      }
      const { db } = atkot(html, new Set(UZLETAGAK));
      for (const m of html.matchAll(/href="(https?:\/\/[a-z0-9.-]*salonic\.hu[^"]*)"/gi)) {
        if (!celra(m[1])) { const k = m[1].replace(/&amp;/g, '&').replace(/startDate=\d+/, 'startDate=N').replace(/&back=.*/, ''); maradt.set(k, (maradt.get(k) || 0) + 1); }
      }
      const n = Object.values(db).reduce((a, b) => a + b, 0);
      if (n) sor.push(`${(mappa + '/' + f).padEnd(60)} ${UZLETAGAK.map((k) => `${k}:${db[k]}`).join(' ')}`);
      osszes = osszead(osszes, db);
    }
  }
  console.log(sor.join('\n'));
  console.log('\nOsszesen atkotheto (asztali + mobil oldalakon):', UZLETAGAK.map((k) => `${k}:${osszes[k]}`).join(' '));
  console.log('\nMarad Salonic-link (nincs szabaly):');
  for (const [u, n] of [...maradt].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), u);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename) && process.argv.includes('--jelentes')) jelentes();
