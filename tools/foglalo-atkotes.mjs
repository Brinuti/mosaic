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
import fs from 'node:fs';
import path from 'node:path';

export const MOTOR = '/foglalo-motor';
export const UZLETAGAK = Object.freeze(['headspa', 'oxigen', 'fodraszat', 'lezer']);

// A koszonooldalakhoz (success-*, *-ok) a mereshez tartozo oldalak miatt NEM nyulunk: ezeken a linkek maradnak, ahogy vannak.
export const kihagyottOldal = (fajlnev) => /^(success-|.+-ok$)/.test(String(fajlnev).replace(/\.html$/, ''));

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
const jegyzek = () => Object.fromEntries(UZLETAGAK.map((k) => [k, 0]));

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

export const osszead = (a, b) => Object.fromEntries(UZLETAGAK.map((k) => [k, (a[k] || 0) + (b[k] || 0)]));

/**
 * A build kapcsoloi: tools/foglalo-atkotes.json "kapcsolok" (eles). Eloneztet / helyi buildnel (nem eles) az "elonezetBe": true
 * mindent bekapcsol, hogy a PR elonezeten kiprobalhato legyen. A FOGLALO_ATKOTES kornyezeti valtozo felulir: "all" | "none" | "headspa,lezer".
 */
export function kapcsolokBuildhez({ eles, env = process.env, konfig = beolvasKonfig() } = {}) {
  const ki = new Set();
  const felulir = (env.FOGLALO_ATKOTES || '').trim().toLowerCase();
  if (felulir === 'all') return new Set(UZLETAGAK);
  if (felulir === 'none') return ki;
  if (felulir) return new Set(felulir.split(/[\s,]+/).filter((k) => UZLETAGAK.includes(k)));
  if (!eles && konfig.elonezetBe) return new Set(UZLETAGAK);
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
