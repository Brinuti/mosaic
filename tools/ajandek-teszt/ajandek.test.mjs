// A Gift Commerce Engine szerveroldalanak tesztjei (Node beepitett tesztfuttato, nincs uj fuggoseg):
//   node --test "tools/ajandek-teszt/*.test.mjs"
// A kezelot (netlify/lib/ajandek.js) kozvetlenul hivjuk; a Stripe helyett a helyi mock fut
// (mock-stripe.mjs), a STRIPE_API_BASE erre mutat. Valodi halozati forgalom / level nincs.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mockStripeInditas } from './mock-stripe.mjs';
import { ajandekKezel, kuponKod, kiallitToken, kartyaToken, rendelesToken, fotoToken, _korlatAlaphelyzet } from '../../netlify/lib/ajandek.js';
import vm from 'node:vm';
import fs from 'node:fs';
import { MASOL_JS, NYOMTAT_JS, SALONIC_KITOLTO_JS } from '../../netlify/lib/ajandek-levelek.js';
import { utvonal } from '../../netlify/lib/utvonal.js';
import { config as edgeConfig } from '../../netlify/edge-functions/oldal.js';

const ADAT = globalThis.AJANDEK_ADAT;
const SZALON = ADAT.SZALON;
const BAZIS = 'https://teszt.mosaicheadspa.hu';
const WHSEC = 'whsec_teszt_titok';
const TITOK = 'teszt-titok-teszt-titok-teszt-titok-0123456789';
const KOD_RE = /^AK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
// a kereskorlat IP-nkent szamol: alapbol minden hivas sajat (veletlen) IP-rol jon
const veletlenIp = () => `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(256)}`;

let mock;
let ENV;
let levelek = [];

before(async () => {
  mock = await mockStripeInditas();
  ENV = {
    STRIPE_SECRET_KEY: 'sk_test_mock_123',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_123',
    STRIPE_WEBHOOK_SECRET: WHSEC,
    STRIPE_API_BASE: mock.url,
    AJANDEK_TITOK: TITOK,
  };
});
after(async () => { await mock.bezar(); });

async function hiv(method, ut, { body, query, headers = {}, env = ENV, most, kuld, ip } = {}) {
  const url = new URL(BAZIS + '/api/ajandek/' + ut);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const v = await ajandekKezel({
    method, url: url.toString(), headers: { 'content-type': 'application/json', 'x-forwarded-for': veletlenIp(), ...headers }, text, env, most, ip,
    kuld: kuld || (async (l) => { levelek.push(l); }),
  });
  const adat = /json/.test(v.headers['content-type'] || '') ? JSON.parse(v.body) : null;
  return { ...v, adat };
}

const rendelesTorzs = (extra = {}) => ({
  termek: 'egyeni', email: 'vevo@example.com', ajandekozott: 'Kiss Anna', nev: 'Teszt Elek', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.',
  ceges: null,
  attr: { variant_id: 'general', gift_context: 'general', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'oszi', gclid: 'gcl-123', oldal: '/ajandek?utm_source=google' },
  kulcs: 'k-' + crypto.randomUUID(),
  ...extra,
});

// az utalasos igeny nyilvantartasi rekordja (PI) az ATU-azonosito alapjan
const atuPi = (ref) => {
  const x = [...mock.allapot.pik.values()].filter((y) => y.metadata && y.metadata.atu_ref === ref)[0];
  return x ? mock.allapot.pi(x.id) : null;
};

async function ujRendeles(extra) {
  const r = await hiv('POST', 'fizetes', { body: rendelesTorzs(extra) });
  assert.equal(r.status, 200, r.body);
  return r.adat;
}
async function fizetettRendeles(extra, mod = 'card') {
  const r = await ujRendeles(extra);
  mock.allapot.sikeresIt(r.pi, { mod });
  return r;
}

function alairtEsemeny(piId, { titok = WHSEC, ts = Math.floor(Date.now() / 1000), tipus = 'payment_intent.succeeded', metadata } = {}) {
  const pi = mock.allapot.pi(piId);
  const torzs = JSON.stringify({
    id: 'evt_' + crypto.randomUUID().replace(/-/g, ''), object: 'event', type: tipus,
    data: { object: { id: piId, object: 'payment_intent', status: 'succeeded', metadata: metadata ?? pi.metadata } },
  });
  const sig = crypto.createHmac('sha256', titok).update(`${ts}.${torzs}`).digest('hex');
  return { torzs, fejlec: `t=${ts},v1=${sig}` };
}
const webhook = (e, opciok = {}) => hiv('POST', 'webhook', { body: e.torzs, headers: { 'stripe-signature': e.fejlec }, ...opciok });

// fuggetlen (node:crypto) szamitas a kodra, a kezelotol fuggetlenul
function vartKod(titok, piId) {
  const b = crypto.createHmac('sha256', titok).update('kod:' + piId).digest();
  let n = 0n;
  for (let i = 0; i < 5; i++) n = (n << 8n) | BigInt(b[i]);
  const abc = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  for (let i = 7; i >= 0; i--) s += abc[Number((n >> BigInt(5 * i)) & 31n)];
  return `AK-${s.slice(0, 4)}-${s.slice(4)}`;
}

// --- kozos adat -------------------------------------------------------------------------------------------
describe('ajandek-adat: variantFeloldas', () => {
  test('hianyzo / ismeretlen / prototipus-nevek / nagybetus -> general', () => {
    const g = ADAT.VARIANTOK.general;
    for (const x of [undefined, null, '', 'nincs-ilyen', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', {}, 42]) {
      assert.equal(ADAT.variantFeloldas(x), g, `variant: ${String(x)}`);
    }
    assert.equal(ADAT.variantFeloldas('GENERAL'), g);
    assert.equal(ADAT.variantFeloldas('  General '), g);
    assert.equal(ADAT.variantFeloldas('general').variant_id, 'general');
  });
});

describe('variansok (persona): a tulajdonos variant-dokumentuma szerint', () => {
  const VARIANSOK = Object.keys(ADAT.VARIANTOK);
  const G = ADAT.VARIANTOK.general;

  test('hat variant, mindegyik teljes: azonos mezok, a termeksorrend az osszes termek, a bizonyito es a kepek leteznek, nincs nem igazolt igeret', () => {
    assert.deepEqual([...VARIANSOK].sort(), ['for_her', 'friend', 'general', 'last_minute', 'mother', 'partner']);
    const termekek = Object.keys(ADAT.TERMEKEK).sort();
    for (const k of VARIANSOK) {
      const v = ADAT.VARIANTOK[k];
      assert.equal(v.variant_id, k);
      assert.equal(ADAT.variantFeloldas(k), v);
      for (const mezo of ['hero_title', 'hero_subtitle', 'hero_cta']) assert.ok(typeof v[mezo] === 'string' && v[mezo].length > 8, k + ' ' + mezo);
      // a megnyugtato sor: nincs (general / last_minute: a hero ikonos sora mar mondja), vagy rovid persona-sor; ismetlodo szoveg nincs
      assert.ok(v.reassurance === null || (typeof v.reassurance === 'string' && v.reassurance.length > 8 && v.reassurance.length < 90), k + ' reassurance');
      assert.deepEqual([...v.product_order].sort(), termekek, k + ' termeksorrend');
      assert.ok(v.featured_proof in ADAT.PROOFOK, k + ' bizonyito');
      assert.equal(v.hero_trust.length, 4, k + ' bizalmi sor');
      assert.deepEqual([...v.vendeg_sorrend].sort(), ['dori', 'kinga', 'zita', 'zsoka'], k + ' vendeg-sorrend');
      assert.ok(fs.existsSync(new URL('../../' + v.hero_media.src.replace(/^\//, ''), import.meta.url)), k + ' hero-kep');
      assert.ok(v.hero_media.src && ADAT.ASSET_JO[v.hero_media.status], k + ': a megjeleno hero-asset csak jovahagyott lehet');
      // a hero-video (ha van): letezik, a weben konnyu (hero: <= 1,5 MB), nem a tulajdonos eredeti nagy fajlja
      if (v.hero_media.video) {
        const vf = new URL('../../' + v.hero_media.video.src.replace(/^\//, ''), import.meta.url);
        assert.ok(fs.existsSync(vf), k + ' hero-video');
        assert.ok(fs.statSync(vf).size < 1.5e6, k + ' hero-video merete');
      }
      // nem igazolt igeret sehol: nincs "azonnal", "perceken belul", "1 perc alatt", "meg ma"
      assert.doesNotMatch(JSON.stringify(v), /azonnal|perceken belül|perc alatt|még ma/i, k);
    }
  });

  test('az "Ilyen a Head Spa" video es a megjeleno kepek leteznek, a video a weben konnyu; a lejatszo alakja ismert', () => {
    const f = (u) => new URL('../../' + u.replace(/^\//, ''), import.meta.url);
    const hv = ADAT.HEADSPA_VIDEO;
    assert.ok(fs.existsSync(f(hv.src)) && fs.statSync(f(hv.src)).size < 7e6, 'headspa video');
    assert.ok(fs.existsSync(f(hv.poster)), 'headspa poszter');
    assert.ok(['negyzet', 'szeles', undefined].includes(hv.forma), 'lejatszo alakja');
    for (const k of VARIANSOK) assert.ok(fs.existsSync(f(ADAT.VARIANTOK[k].hero_media.src)), k + ' hero-poszter');
    assert.ok(fs.existsSync(f('/assets/img/ajandek/atadas-kartya.jpg')), 'Ezt adod at neki fotoja (DSC01457)');
  });

  test('a kezeles-videok (egyeni / 4 kezes / paros), a szeansz-elemek lapozoja, a galeria es a testimonial-videok leteznek es konnyuek', () => {
    const f = (u) => new URL('../../' + u.replace(/^\//, ''), import.meta.url);
    for (const [id, t] of Object.entries(ADAT.TERMEKEK)) {
      const v = t.kezeles.video;
      assert.ok(v && v.src && v.poster, id + ' kezeles-video');
      assert.ok(fs.existsSync(f(v.src)) && fs.statSync(f(v.src)).size < 4e6, id + ' video letezik, < 4 MB');
      assert.ok(fs.existsSync(f(v.poster)), id + ' poszter');
    }
    assert.equal(ADAT.ELEMEK.length, 15);
    for (const e of ADAT.ELEMEK) {
      assert.ok(fs.existsSync(f(e.video)) && fs.existsSync(f(e.poster)), e.nev);
      assert.match(e.ido, /^\d:\d\d$/);
    }
    assert.ok(ADAT.GALERIA.length >= 12);
    for (const g of ADAT.GALERIA) { assert.ok(fs.existsSync(f(g.src)) && g.alt.length > 5, g.src); assert.ok(fs.statSync(f(g.src)).size < 400e3, g.src + ' < 400 KB'); }
    // a HTML-ben megadott vendeg-videok (8) mind leteznek, es a lapon nincs a szeptemberi akcio / regi ertekeles szoveg
    const html = fs.readFileSync(f('foglalas/ajandek.html'), 'utf8');
    const vendegek = [...html.matchAll(/data-vendeg="(\/assets\/video\/ajandek-vendeg-[a-z]+\.mp4)"/g)].map((m) => m[1]);
    assert.equal(vendegek.length, 8);
    for (const v of vendegek) assert.ok(fs.existsSync(f(v)) && fs.statSync(f(v)).size < 12e6, v);
    assert.doesNotMatch(html, /id="ah-finder-racs"|ah-kezeles-ablak|ah-panel-mellek/, 'a Gift Finder gombjai, a felugro kezeles-ablak es a "Valasztott ajandek" osszegzo kikerult');
    // a valaszto resz a mockup szerint harom lepes (1 elmeny radio | 2 video | 3 atvetel + tovabb); a fizetes: Rendelesed + Adatok + Fizetes
    for (const jel of ['id="ah-lepesek"', 'id="ah-termek-racs"', 'id="ah-kiv-media"', 'id="ah-tovabb-gomb"', 'id="ah-osszesito-forma"', 'class="ah-kartya ah-urlap-adatok"', 'class="ah-kartya ah-urlap-fizetes"']) assert.ok(html.includes(jel), jel);
    assert.ok(html.includes('id="ah-fordit"') && !html.includes('ah-oldal-kapcsolo'), 'a kartya forgathato (Forditsd meg), nincs elol/hat valto');
    assert.ok(!html.includes('ah-hero-ar'), 'a hero-bol az "ar-tol" lekerult');
    // fizetes: az ajandekozott neve, egy fizetesi mod valaszto (kartya / atutalas), nincs kulon "Inkabb atutalassal" link
    for (const jel of ['id="ah-ajandekozott"', 'id="ah-telefon"', 'id="ah-fizmod"', 'name="fizmod" value="kartya"', 'name="fizmod" value="atutalas"', 'id="ah-atu-doboz"', 'id="ah-atutalas"']) assert.ok(html.includes(jel), jel);
    assert.ok(!html.includes('ah-atutalas-gomb') && !html.includes('Inkább átutalással'), 'a regi atutalas-link kikerult');
    // minden kartyan plusz sor: "Hogyan epul fel a kezeles?" (felugro, lepesekkel az eles oldalrol)
    for (const jel of ['id="ah-kez-ablak"', 'id="ah-kez-elemek"', 'id="ah-kez-kep"', 'id="ah-kez-valaszt"']) assert.ok(html.includes(jel), jel);
    // a fizetesi urlap mezoi uresek (nincs peldaszoveg: Kovacs Anna, 1024, Budapest, ...); a tervezo nincs szamlalo, az athelyezes szovegesen
    const urlapHtml = html.slice(html.indexOf('id="ah-urlap"'), html.indexOf('id="ah-feldolgozas"'));
    assert.ok(!/placeholder=/.test(urlapHtml), 'a fizetesi urlapon nincs placeholder');
    assert.ok(!html.includes('id="ah-idezet-db"') && html.includes('id="ah-mozgat-seg"') && html.includes('Helyezd át a képet a kezeddel'), 'nincs karakterszamlalo; az athelyezes szoveges');
    // a felugro: a kep (allo) balra, a szoveg (bevezeto, lista, idotartam) jobbra, a gomb alul; a bezaro X svg (pontosan kozepen), nem betu
    assert.ok(html.indexOf('ah-kez-kepkeret') < html.indexOf('ah-kez-szoveg') && html.indexOf('id="ah-kez-ido"') > html.indexOf('ah-kez-szoveg') && html.indexOf('id="ah-kez-valaszt"') > html.indexOf('id="ah-kez-ido"'), 'kep | szoveg + idotartam | gomb');
    for (const az of ['ah-kez-bezar', 'ah-lb-bezar', 'ah-video-bezar', 'ah-ak-nagy-bezar']) assert.match(html, new RegExp('id="' + az + '"[^>]*><svg class="ah-x-ikon"'), az + ': svg X');
    // kartya-elonezet nagyitasa: nagyito gomb + ablak (elol / hat); a GYIK cime
    for (const jel of ['id="ah-nagyit"', 'id="ah-ak-nagy"', 'id="ah-ak-nagy-kartya"', 'id="ah-ak-nagy-fordit"']) assert.ok(html.includes(jel), jel);
    assert.ok(html.includes('<h2>Kérdésed van? Megválaszoltuk.</h2>') && !html.includes('Gyakori kérdések</h2>'), 'GYIK cim');
    // fizetes: fulek a kartya-urlap felett (kartya, Revolut Pay, Google Pay) - a kartya az alapertelmezett
    const js = fs.readFileSync(new URL('../../assets/js/ajandek.js', import.meta.url), 'utf8');
    assert.ok(/layout: { type: 'tabs', defaultCollapsed: false }/.test(js) && js.includes("paymentMethodOrder: ['card', 'revolut_pay', 'google_pay']"), 'fizetesi elem: fulek, a kartya az elso');
    // a felugro gombja a jobb (szoveg) oszlopban van, a design-valaszto mobilon legordulo, a termekeken rovid mobil szoveg
    assert.ok(html.indexOf('id="ah-kez-valaszt"') > html.indexOf('ah-kez-szoveg') && html.indexOf('id="ah-kez-valaszt"') < html.indexOf('</dialog>', html.indexOf('ah-kez-szoveg')) && html.indexOf('ah-kez-torzs') < html.indexOf('id="ah-kez-valaszt"'), 'az Ezt valasztom a szoveg-oszlopban');
    assert.ok(html.includes('id="ah-tema-nyit"') && html.includes('id="ah-tv-design"'), 'design legordulo');
    for (const t of Object.values(ADAT.TERMEKEK)) assert.ok(t.osszefoglalo_rovid && t.osszefoglalo_rovid.length < t.osszefoglalo.length, t.id + ': rovid osszefoglalo');
    assert.ok(js.includes('function gorgessVideora') && js.includes('kivalaszt(r.value); gorgessVideora();'), 'mobilon a valasztas utan a videohoz gorget');
    for (const [id, t] of Object.entries(ADAT.TERMEKEK)) {
      const m = t.kezeles.menet;
      assert.ok(m && /Head Spa kezelés$/.test(m.nev) && Array.isArray(m.elemek) && m.elemek.length >= 6 && m.elemek.every((x) => typeof x[0] === 'string' && x[0].length > 3), id + ': az arlista kezeles-kartyaja (nev + elemek)');
      assert.ok(/hajszárítás/.test(m.utana) && /50\+30/.test(m.ido), id + ': +30 perc hajszarítas, idotartam');
      assert.doesNotMatch(JSON.stringify(m), /gyógymasszőr/, id + ': profi masszor (nem gyogymasszor)');
    }
    // a harom kezeles szovege kulonbozo (egyeni = Relax, paros, 4 kezes)
    assert.equal(new Set(Object.values(ADAT.TERMEKEK).map((t) => JSON.stringify(t.kezeles.menet))).size, Object.keys(ADAT.TERMEKEK).length, 'minden kezelesnek sajat szovege van');
    assert.ok(ADAT.TERMEKEK.egyeni.kezeles.menet.nev.includes('"Relax"') && ADAT.TERMEKEK['4kezes'].kezeles.menet.nev.includes('"4 Kezes"'));
    assert.ok(fs.readFileSync(new URL('../../assets/js/ajandek.js', import.meta.url), 'utf8').includes('Hogyan épül fel a kezelés?'), 'a kartyak plusz sora');
    // 4. kor: a szemelyre szabo kartyaja fole cim + lefele nyil, fotoathelyezes nyilakkal, nincs "Aktualis ar" es adatok-segedszoveg
    for (const jel of ['class="ah-elo-cim"', 'Így fog kinézni', 'élő előnézet', 'id="ah-mozgat"']) assert.ok(html.includes(jel), jel);
    assert.ok(!html.includes('Aktuális ár') && !html.includes('Add meg az adataidat a vásárláshoz'), 'a torolt szovegek nincsenek');
    // 2026-10-04, 3. kor: uj atadas-kep, pici terkep, nincs gomb Feri alatt, a tervezo gombja es a Kihagyom, a "szemelyre szabashoz" gomb
    for (const jel of ['atadas-szemelyre.jpg', 'id="ah-terkep"', 'openstreetmap.org/export/embed.html', 'class="ah-tv-kihagy"', 'id="ah-tovabb-gomb"><span>Tovább a személyre szabáshoz</span>']) assert.ok(html.includes(jel), jel);
    assert.ok(!html.includes('Ismerd meg a Head Spa-t') && !html.includes('ah-foto-tipp') && !html.includes('Húzással igazíthatod'), 'a Feri alatti gomb es a foto-tipp kikerult');
    assert.ok(fs.existsSync(new URL('../../assets/img/ajandek/atadas-szemelyre.jpg', import.meta.url)), 'az atadas-kep letezik');
    assert.ok(ADAT.TERMEKEK['4kezes'].kezeles.video.ido === '0:40' && fs.statSync(new URL('../../assets/video/ajandek-kezeles-4kezes.mp4', import.meta.url)).size > 2e6, 'a 4 kezes video a teljes (kb. 40 mp-es) valtozat');
    // a kartya-kep a hero aljan "atlog" (felulre es jobbra), a cimbe nem er bele
    const cssTeljes = fs.readFileSync(new URL('../../assets/css/ajandek.css', import.meta.url), 'utf8');
    assert.ok(cssTeljes.includes('.ah-valaszto-kartya { position: absolute; z-index: 4; top: -98px; left: max(412px, 49%); width: 330px;'), 'a kartya a hero aljara log');
    // 2026-10-04, 2. kor: Miert a MOSAIC Headspa (jelveny + alapito), 2 perc..., 2 soros lepes-szovegek, kozepre igazitott kartya-kep, a PMU-oldal gombszine
    for (const jel of ['Miért a MOSAIC Headspa?', 'class="ah-badge"', 'alapito-feri.png', 'Deák Ferenc István', 'Amikor megalapítottam a MOSAIC-ot', '2 perc és már a Tiéd is!']) assert.ok(html.includes(jel), jel);
    assert.ok(fs.existsSync(new URL('../../assets/img/ajandek/alapito-feri.png', import.meta.url)), 'az alapito kepe letezik');
    const hogyan = html.slice(html.indexOf('<ol class="ah-hogyan-lepesek">'), html.indexOf('</ol>', html.indexOf('<ol class="ah-hogyan-lepesek">')));
    const lepesek = hogyan.split('</strong><span>').slice(1).map((r) => r.slice(0, r.indexOf('</span>')));
    assert.equal(lepesek.length, 5);
    for (const sz of lepesek) assert.ok(sz.length <= 56, 'a lepes-szoveg ketsoros: ' + sz);
    const css = fs.readFileSync(new URL('../../assets/css/ajandek.css', import.meta.url), 'utf8');
    assert.ok(css.includes('.ah-gomb-fo { background: linear-gradient(#c6a346, #d9c164)'), 'az elsodleges gomb a PMU-oldal arany atmenete');
    assert.ok(css.includes('.ah-hogyan-lepesek li > span:last-child { display: -webkit-box; -webkit-line-clamp: 2'), 'a lepes-szoveg 2 soros');
    assert.ok(html.includes('csak az utalás visszaigazolása után tudjuk kiállítani') && html.includes('Bankkártyás fizetésnél az ajándékkártyát automatikusan'), 'atutalasi figyelmeztetes');
    for (const t of Object.values(ADAT.TERMEKEK)) assert.ok(typeof t.kartya_sor === 'string' && t.kartya_sor.length > 10, t.id + ' kartya_sor');
  });

  test('a dokumentum szerinti terméksorrend, Gift Finder elovalasztas, szovegek es analitikai mezok', () => {
    const V = ADAT.VARIANTOK;
    for (const k of ['general', 'for_her', 'last_minute']) assert.deepEqual(V[k].product_order, ['egyeni', '4kezes', 'paros'], k);
    for (const k of ['friend', 'mother', 'partner']) assert.deepEqual(V[k].product_order, ['paros', 'egyeni', '4kezes'], k);
    // a dokumentum "together" / "for_one" erteke a FINDER azonositoira kepezve
    assert.deepEqual(Object.fromEntries(VARIANSOK.map((k) => [k, V[k].gift_finder_preselect])), {
      general: null, friend: 'ketten', mother: 'ketten', for_her: 'egyedul', partner: 'ketten', last_minute: null,
    });
    for (const k of VARIANSOK) assert.ok(V[k].gift_finder_preselect === null || ADAT.FINDER.some((f) => f.id === V[k].gift_finder_preselect), k);
    assert.equal(V.general.hero_title, 'Ajándékozz neki 80 percet, ami tényleg csak róla szól.');
    assert.equal(V.general.hero_cta, 'Kiválasztom az ajándékot');
    assert.equal(V.friend.hero_title, 'Ne még egy tárgyat adjatok egymásnak. Menjetek inkább együtt.');
    assert.equal(V.mother.hero_title, 'Adj neki közös időt — ne még egy dolgot.');
    assert.equal(V.for_her.hero_title, 'Adj neki 80 percet, amikor végre semmiről nem kell gondoskodnia.');
    assert.equal(V.partner.hero_title, 'Egy randi, ahol most mindketten kikapcsoltok.');
    assert.equal(V.last_minute.hero_title, 'Ajándékot keresel az utolsó pillanatban?');
    assert.deepEqual(Object.fromEntries(VARIANSOK.map((k) => [k, [V[k].gift_context, V[k].relationship, V[k].occasion]])), {
      general: ['general', null, null], friend: ['together', 'friend', null], mother: ['together', 'mother', null],
      for_her: ['for_her', 'recipient_female', null], partner: ['together', 'partner', null], last_minute: ['last_minute', null, 'dynamic'],
    });
    // a last_minute-ban nincs kulon megnyugtato sor (az ikonos sor mondja: "Online megvasarolhato"); a kezbesitesi idore nincs allitas
    assert.equal(V.last_minute.reassurance, null);
    assert.equal(V.general.reassurance, null, 'a general-ban nincs ismetlodo "6 honapig..." sor');
    // a hero Google-sora link a Google-velemenyek szekciojara
    assert.equal(V.general.hero_trust[0].href, '#ah-google');
  });

  test('asset-validalas: a NEEDS_MANUAL_VALIDATION asset nem jelenik meg - a variant a GENERAL assetet kapja, az eredeti javaslat megmarad; a jovahagyott asset marad', () => {
    const V = ADAT.VARIANTOK;
    for (const k of ['friend', 'for_her', 'partner']) {
      assert.equal(V[k].hero_media, G.hero_media, k + ' fallback a GENERAL hero-assetre');
      assert.equal(V[k].hero_media_javaslat.status, 'NEEDS_MANUAL_VALIDATION', k);
      assert.ok(V[k].hero_media_javaslat.validalas, k + ' validalasi feladat');
    }
    assert.equal(G.hero_media.status, 'APPROVED_BY_METADATA');
    assert.equal(V.mother.hero_media.status, 'APPROVED_BY_EXPLICIT_FILENAME');
    assert.equal(V.last_minute.hero_media.status, 'APPROVED_BY_FOLDER_CONTEXT');
    assert.equal(V.mother.hero_media_javaslat, undefined);
    // a nem validalt elso proof sem jelenik meg (a vendeg-sorrend a koros)
    for (const k of ['general', 'friend', 'mother', 'for_her', 'partner']) assert.equal(V[k].first_proof_javaslat.status, 'NEEDS_MANUAL_VALIDATION', k);
  });

  test('a variant_id es a gift_context a rendeles metadata-jaba kerul (merhetoseg), az ismeretlen variant a GENERAL; a "dynamic" alkalom az URL-bol jon, nem tarolodik betuszerint', async () => {
    for (const [kuldott, vart] of [['friend', 'friend'], ['for_her', 'for_her'], ['last_minute', 'last_minute'], ['together_friend', 'general'], ['nincs-ilyen', 'general'], ['', 'general'], ['__proto__', 'general']]) {
      const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ attr: { variant_id: kuldott, oldal: '/ajandek' } }) });
      assert.equal(r.status, 200, kuldott);
      assert.equal(mock.allapot.pi(r.adat.pi).metadata.variant_id, vart, kuldott);
    }
    const lm = await hiv('POST', 'fizetes', { body: rendelesTorzs({ attr: { variant_id: 'last_minute', oldal: '/ajandek' } }) });
    const md = mock.allapot.pi(lm.adat.pi).metadata;
    assert.equal(md.gift_context, 'last_minute');
    assert.equal(md.occasion, undefined, 'a "dynamic" nem kerul be metadata-ba');
    const lm2 = await hiv('POST', 'fizetes', { body: rendelesTorzs({ attr: { variant_id: 'last_minute', occasion: 'karacsony', oldal: '/ajandek' } }) });
    assert.equal(mock.allapot.pi(lm2.adat.pi).metadata.occasion, 'karacsony');
    const fr = await hiv('POST', 'fizetes', { body: rendelesTorzs({ attr: { variant_id: 'for_her', oldal: '/ajandek' } }) });
    assert.equal(mock.allapot.pi(fr.adat.pi).metadata.relationship, 'recipient_female');
  });
});

describe('utvonal-kizarasok', () => {
  test('az /api/ utak valtozatlanul tovabbmennek (utvonal.js -> null, edge excludedPath)', () => {
    assert.equal(utvonal('/api/ajandek/fizetes', ''), null);
    assert.equal(utvonal('/api/ajandek/kartya', 'iPhone'), null);
    assert.ok(edgeConfig.excludedPath.includes('/api/*'));
    // a tobbi lap valtozatlan
    assert.deepEqual(utvonal('/headspa-budapest', ''), { atir: '/_a/headspa-budapest' });
  });
});

// --- utvalasztas -----------------------------------------------------------------------------------------
describe('utvalasztas', () => {
  test('ismeretlen ut -> 404 JSON, rossz metodus -> 405, minden valasz no-store', async () => {
    for (const ut of ['nincs', 'constructor', '__proto__', 'toString', '']) {
      const r = await hiv('GET', ut);
      assert.equal(r.status, 404, ut);
      assert.deepEqual(r.adat, { hiba: 'nincs' });
      assert.equal(r.headers['cache-control'], 'no-store');
    }
    const r = await hiv('GET', 'fizetes');
    assert.equal(r.status, 405);
    assert.equal(r.headers.allow, 'POST');
    assert.equal((await hiv('POST', 'beallitas')).status, 405);
    assert.equal((await hiv('HEAD', 'kiallit')).status, 405);
    const kivul = await ajandekKezel({ method: 'GET', url: BAZIS + '/api/masik/x', headers: {}, text: '', env: ENV });
    assert.equal(kivul.status, 404);
  });
});

// --- /beallitas --------------------------------------------------------------------------------------------
describe('/beallitas', () => {
  test('mod a kulcs elotagjabol; publikus kulcs csak ha van mod; azonnali_kartya', async () => {
    // (a titok kotelezo; a hianyaval kulon teszt foglalkozik)
    const eset = async (env) => (await hiv('GET', 'beallitas', { env: { AJANDEK_TITOK: TITOK, ...env } })).adat;
    assert.deepEqual(await eset({}), { mod: 'nincs', publikus_kulcs: null, azonnali_kartya: false, foto: false });
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'sk_test_x' })).mod, 'nincs');
    assert.equal((await eset({ STRIPE_PUBLISHABLE_KEY: 'pk_test_x' })).mod, 'nincs');
    assert.deepEqual(await eset({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_y' }), { mod: 'teszt', publikus_kulcs: 'pk_test_y', azonnali_kartya: false, foto: false });
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'rk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_y' })).mod, 'teszt');
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_y' })).mod, 'elo');
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'rk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_y' })).mod, 'elo');
    // vegyes (teszt titkos + eles publikus): a fizetes ugysem mukodne
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_y' })).mod, 'nincs');
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_y' })).mod, 'nincs');
    assert.equal((await eset({ ...ENV, AJANDEK_AZONNALI: '1' })).azonnali_kartya, true);
    assert.equal((await eset({ ...ENV, AJANDEK_AZONNALI: 'true' })).azonnali_kartya, false);
    const r = await hiv('GET', 'beallitas');
    assert.equal(r.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-store');
  });
});

// --- /fizetes ------------------------------------------------------------------------------------------------
describe('/fizetes', () => {
  test('validacio: rossz e-mail, ismeretlen termek, hianyzo nev/cim -> 400 mezo-hibakkal, PI nem jon letre', async () => {
    const elotte = mock.allapot.pik.size;
    let r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ email: 'nem-email', termek: 'arany', nev: '  ', cim: '' }) });
    assert.equal(r.status, 400);
    assert.equal(r.adat.hiba, 'ervenytelen');
    for (const m of ['email', 'termek', 'nev', 'cim']) assert.equal(typeof r.adat.mezok[m], 'string', m);
    assert.equal(r.adat.mezok.varos, undefined);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ termek: '__proto__' }) });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.termek);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ termek: 'constructor', email: 'a@b', iranyitoszam: '', varos: '' }) });
    assert.deepEqual(Object.keys(r.adat.mezok).sort(), ['email', 'iranyitoszam', 'termek', 'varos']);
    // az ajandekozott (a kartyat kapo) neve kotelezo, legfeljebb 40 karakter
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ ajandekozott: '' }) });
    assert.equal(r.status, 400);
    assert.equal(typeof r.adat.mezok.ajandekozott, 'string');
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ ajandekozott: 'Á'.repeat(41) }) });
    assert.ok(r.adat.mezok.ajandekozott);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ nev: 'x'.repeat(121), email: 'a'.repeat(250) + '@x.hu' }) });
    assert.ok(r.adat.mezok.nev && r.adat.mezok.email);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ ceges: { nev: 'Minta Kft.', adoszam: '' } }) });
    assert.ok(r.adat.mezok['ceges.adoszam']);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ ceges: { nev: '', adoszam: '12345678-1-42' } }) });
    assert.ok(r.adat.mezok['ceges.nev']);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs: 'rossz kulcs <script>' }) });
    assert.ok(r.adat.mezok.kulcs);
    r = await hiv('POST', 'fizetes', { body: '{nem json' });
    assert.equal(r.status, 400);
    assert.equal(r.adat.hiba, 'ervenytelen');
    r = await hiv('POST', 'fizetes', { body: '[1,2]' });
    assert.equal(r.status, 400);
    assert.equal(mock.allapot.pik.size, elotte);
  });

  test('robotcsapda (bot-field) -> 200 ok-nak latszo valasz, de nincs PI', async () => {
    const elotte = mock.allapot.pik.size;
    const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ 'bot-field': 'http://spam' }) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.adat, { ok: true });
    assert.equal(mock.allapot.pik.size, elotte);
  });

  test('nincs Stripe-beallitas -> 503 nincs_beallitva', async () => {
    const r = await hiv('POST', 'fizetes', { body: rendelesTorzs(), env: { STRIPE_API_BASE: mock.url } });
    assert.equal(r.status, 503);
    assert.deepEqual(r.adat, { hiba: 'nincs_beallitva' });
  });

  test('a PI-t a szerver araval hozza letre (a kliens osszege nem szamit), HUF x100, metadata', async () => {
    const torzs = rendelesTorzs({ osszeg: 1, amount: 100, ar_ft: 5, attr: { variant_id: 'NINCS-ILYEN', utm_source: 'meta', fbclid: 'fb-1', relationship: 'Barátnő!!' } });
    const r = await hiv('POST', 'fizetes', { body: torzs });
    assert.equal(r.status, 200);
    assert.match(r.adat.pi, /^pi_/);
    assert.equal(r.adat.client_secret, mock.allapot.pi(r.adat.pi).client_secret);
    assert.equal(r.adat.osszeg, 26900);
    assert.equal(r.adat.penznem, 'HUF');
    assert.equal(r.adat.rendeles_id, ADAT.rendelesAzonosito(r.adat.pi));
    const pi = mock.allapot.pi(r.adat.pi);
    assert.equal(pi.amount, 2690000);
    assert.equal(pi.amount % 100, 0);
    assert.equal(pi.currency, 'huf');
    assert.deepEqual(pi.automatic_payment_methods, { enabled: true });
    assert.equal(pi.receipt_email, 'vevo@example.com');
    assert.equal(pi.description, 'MOSAIC Head Spa ajándékkártya - Egyéni Head Spa');
    assert.equal(pi.metadata.forras, 'ajandek-motor');
    assert.equal(pi.metadata.termek, 'egyeni');
    assert.equal(pi.metadata.product_type, 'egyeni');
    assert.equal(pi.metadata.variant_id, 'general');
    assert.equal(pi.metadata.gift_context, 'general');
    assert.equal(pi.metadata.relationship, undefined, 'ervenytelen azonosito kimarad');
    assert.equal(pi.metadata.utm_source, 'meta');
    assert.equal(pi.metadata.fbclid, 'fb-1');
    assert.equal(pi.metadata.nev, 'Teszt Elek');
    assert.equal(pi.metadata.szemelyre_nev, 'Kiss Anna', 'a megajandekozott neve (ajandekozott) a rekordban');
    assert.equal(pi.metadata.iranyitoszam, '1023');
    assert.equal(pi.metadata.varos, 'Budapest');
    assert.equal(pi.metadata.cim, 'Bécsi út 2.');
    assert.equal(pi.metadata.kartya_cim, 'Egyéni MOSAIC Head Spa ajándékkártya');
    assert.equal(pi.metadata.ceges_nev, undefined, 'ures ertek kihagyva');
    for (const v of Object.values(pi.metadata)) assert.ok(v.length <= 500);
    const keres = mock.allapot.keresek.filter((k) => k.path === '/v1/payment_intents').at(-1);
    assert.equal(keres.idem, 'ah-' + torzs.kulcs);
    assert.ok(keres.verzio, 'Stripe-Version fejlec');
  });

  test('minden termek ara a configbol, x100, 100-zal oszthato; ceges adatok a metadataban', async () => {
    for (const [id, t] of Object.entries(ADAT.TERMEKEK)) {
      const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ termek: id, ceges: { nev: 'Minta Kft.', adoszam: '12345678-1-42' } }) });
      assert.equal(r.status, 200, id);
      const pi = mock.allapot.pi(r.adat.pi);
      assert.equal(pi.amount, t.ar_ft * 100, id);
      assert.equal(pi.amount % 100, 0);
      assert.equal(r.adat.osszeg, t.ar_ft);
      assert.equal(pi.metadata.ceges_nev, 'Minta Kft.');
      assert.equal(pi.metadata.ceges_adoszam, '12345678-1-42');
    }
  });

  test('variant_id: __proto__ / constructor / nagybetus -> general', async () => {
    for (const v of ['__proto__', 'constructor', 'GENERAL', '']) {
      const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ attr: { variant_id: v } }) });
      assert.equal(mock.allapot.pi(r.adat.pi).metadata.variant_id, 'general', v);
    }
    const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ attr: null }) });
    assert.equal(r.status, 200);
    assert.equal(mock.allapot.pi(r.adat.pi).metadata.variant_id, 'general');
  });

  test('ugyanazzal a kulcs-csal idempotens (ugyanaz a PI, nem jon letre masodik)', async () => {
    const torzs = rendelesTorzs();
    const a = await hiv('POST', 'fizetes', { body: torzs });
    const elotte = mock.allapot.pik.size;
    const b = await hiv('POST', 'fizetes', { body: torzs });
    assert.equal(b.status, 200);
    assert.equal(b.adat.pi, a.adat.pi);
    assert.equal(b.adat.client_secret, a.adat.client_secret);
    assert.equal(mock.allapot.pik.size, elotte);
  });

  test('ugyanaz a kulcs mas termekkel pi/cs nelkul -> nem hiba, uj PI a helyes arral', async () => {
    const kulcs = 'k-' + crypto.randomUUID();
    const a = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs }) });
    const b = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: 'paros' }) });
    assert.equal(b.status, 200);
    assert.notEqual(b.adat.pi, a.adat.pi);
    assert.equal(mock.allapot.pi(b.adat.pi).amount, 5380000);
  });

  test('pi+cs es requires_payment_method -> frissites ugyanazon a PI-n (termekvaltas, regi kulcsok torolve)', async () => {
    const kulcs = 'k-' + crypto.randomUUID();
    const a = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, ceges: { nev: 'Minta Kft.', adoszam: '12345678-1-42' } }) });
    assert.equal(mock.allapot.pi(a.adat.pi).metadata.ceges_nev, 'Minta Kft.');
    const elotte = mock.allapot.pik.size;
    const b = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: 'paros', email: 'masik@example.com', pi: a.adat.pi, cs: a.adat.client_secret }) });
    assert.equal(b.status, 200);
    assert.equal(b.adat.pi, a.adat.pi);
    assert.equal(b.adat.client_secret, a.adat.client_secret);
    assert.equal(b.adat.osszeg, 53800);
    assert.equal(mock.allapot.pik.size, elotte);
    const pi = mock.allapot.pi(a.adat.pi);
    assert.equal(pi.amount, 5380000);
    assert.equal(pi.receipt_email, 'masik@example.com');
    assert.equal(pi.metadata.termek, 'paros');
    assert.equal(pi.metadata.kartya_cim, 'Páros MOSAIC Head Spa ajándékkártya');
    assert.equal(pi.metadata.ceges_nev, undefined);
    assert.equal(pi.description, 'MOSAIC Head Spa ajándékkártya - Páros Head Spa');
    // sikertelen probalkozas utan (requires_payment_method + hiba) is frissitheto
    mock.allapot.bukas(a.adat.pi);
    const c = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: '4kezes', pi: a.adat.pi, cs: a.adat.client_secret }) });
    assert.equal(c.adat.pi, a.adat.pi);
    assert.equal(mock.allapot.pi(a.adat.pi).amount, 3990000);
  });

  test('rossz cs -> uj PI (a regi valtozatlan); mar kifizetett PI -> uj PI', async () => {
    const kulcs = 'k-' + crypto.randomUUID();
    const a = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs }) });
    const rossz = a.adat.pi + '_secret_hamis';
    const b = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: 'paros', pi: a.adat.pi, cs: rossz }) });
    assert.equal(b.status, 200);
    assert.notEqual(b.adat.pi, a.adat.pi);
    assert.equal(mock.allapot.pi(a.adat.pi).amount, 2690000);
    assert.equal(mock.allapot.pi(b.adat.pi).amount, 5380000);

    mock.allapot.sikeresIt(b.adat.pi);
    const c = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: 'paros', pi: b.adat.pi, cs: b.adat.client_secret }) });
    assert.equal(c.status, 200);
    assert.notEqual(c.adat.pi, b.adat.pi);
    assert.equal(mock.allapot.pi(c.adat.pi).status, 'requires_payment_method');
    assert.equal(mock.allapot.pi(b.adat.pi).status, 'succeeded');
  });

  test('Stripe 5xx / halozati hiba -> 502 { hiba: stripe }, stack trace nelkul', async () => {
    mock.allapot.kovetkezoHiba(500);
    const r = await hiv('POST', 'fizetes', { body: rendelesTorzs() });
    assert.equal(r.status, 502);
    assert.deepEqual(r.adat, { hiba: 'stripe' });
    const h = await hiv('POST', 'fizetes', { body: rendelesTorzs(), env: { ...ENV, STRIPE_API_BASE: 'http://127.0.0.1:1' } });
    assert.equal(h.status, 502);
    assert.deepEqual(h.adat, { hiba: 'stripe' });
    assert.doesNotMatch(h.body, /at |Error|sk_test/);
  });
});

// --- /rendeles -------------------------------------------------------------------------------------------------
describe('/rendeles', () => {
  test('rossz / hianyzo / mas PI-hez tartozo client_secret -> 403', async () => {
    const a = await ujRendeles();
    const b = await ujRendeles();
    for (const query of [
      { pi: a.pi },
      { pi: a.pi, cs: '' },
      { pi: a.pi, cs: a.pi + '_secret_rossz' },
      { pi: a.pi, cs: b.client_secret },
      { pi: 'nem-pi', cs: 'x' },
      { pi: 'pi_nincsilyenazonosito', cs: 'pi_nincsilyenazonosito_secret_x' },
    ]) {
      const r = await hiv('GET', 'rendeles', { query });
      assert.equal(r.status, 403, JSON.stringify(query));
      assert.deepEqual(r.adat, { hiba: 'tiltott' });
    }
  });

  test('idegen (nem ajandek-motor) PI -> 404', async () => {
    const v = await fetch(mock.url + '/v1/payment_intents', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + ENV.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'amount=1000000&currency=huf&metadata[forras]=fizetolink',
    });
    const idegen = await v.json();
    const r = await hiv('GET', 'rendeles', { query: { pi: idegen.id, cs: idegen.client_secret } });
    assert.equal(r.status, 404);
    assert.deepEqual(r.adat, { hiba: 'nincs' });
  });

  test('allapotok csak a Stripe-tol visszakerdezve: nyitott -> sikertelen / feldolgozas -> fizetve', async () => {
    const a = await ujRendeles({ attr: { variant_id: 'general', utm_source: 'tiktok', ttclid: 'tt-9', gclid: 'g-1', oldal: '/x' } });
    const q = { pi: a.pi, cs: a.client_secret };
    let r = await hiv('GET', 'rendeles', { query: { ...q, allapot: 'fizetve', status: 'succeeded' } });
    assert.equal(r.status, 200);
    assert.equal(r.adat.allapot, 'nyitott');
    assert.equal(r.adat.rendeles_id, a.rendeles_id);
    assert.equal(r.adat.termek, 'egyeni');
    assert.equal(r.adat.termek_nev, 'Egyéni Head Spa');
    assert.equal(r.adat.kartya_cim, 'Egyéni MOSAIC Head Spa ajándékkártya');
    assert.equal(r.adat.osszeg, 26900);
    assert.equal(r.adat.penznem, 'HUF');
    assert.equal(r.adat.email, 'vevo@example.com');
    assert.equal(r.adat.fizetesi_mod, null);
    assert.equal(r.adat.fizetve_ekkor, null);
    assert.deepEqual(Object.keys(r.adat.attr).sort(), ['fbclid', 'gclid', 'gift_context', 'occasion', 'relationship', 'ttclid', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term', 'variant_id']);
    assert.equal(r.adat.attr.utm_source, 'tiktok');
    assert.equal(r.adat.attr.ttclid, 'tt-9');
    assert.equal(r.adat.attr.utm_term, null);
    assert.deepEqual(r.adat.kartya, { allapot: 'keszul', ervenyes_ig: null });
    // a megajandekozott neve mar a rendeleskor megvan (ajandekozott), ez a vasarlas utani szemelyre szabo elotolti
    assert.deepEqual(r.adat.szemelyre, { nev: 'Kiss Anna', uzenet: null, alkalom: null, atadas: null, idezet: null, tema: null, foto: false });
    assert.equal(r.headers['cache-control'], 'no-store');

    mock.allapot.bukas(a.pi);
    assert.equal((await hiv('GET', 'rendeles', { query: q })).adat.allapot, 'sikertelen');
    mock.allapot.feldolgozas(a.pi);
    assert.equal((await hiv('GET', 'rendeles', { query: q })).adat.allapot, 'feldolgozas');
    mock.allapot.sikeresIt(a.pi);
    r = await hiv('GET', 'rendeles', { query: q });
    assert.equal(r.adat.allapot, 'fizetve');
    assert.equal(r.adat.fizetesi_mod, 'card');
    assert.match(r.adat.fizetve_ekkor, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.match(r.adat.kartya.ervenyes_ig, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(r.adat.kartya.allapot, 'keszul');
    assert.equal(r.adat.kartya.kod, undefined, 'a kod csak kesz kartyanal');
    assert.equal(r.adat.kartya.url, undefined);
    assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
  });

  test('ervenyes_ig: a vasarlas BUDAPESTI napjatol 6 honap (honap vegere igazitva)', async () => {
    const eset = async (iso) => {
      const a = await ujRendeles();
      mock.allapot.sikeresIt(a.pi, { created: Math.floor(Date.parse(iso) / 1000) });
      const r = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
      assert.equal(r.adat.fizetve_ekkor, new Date(iso).toISOString());
      return r.adat.kartya.ervenyes_ig;
    };
    assert.equal(await eset('2026-10-02T22:30:00Z'), '2027-04-03'); // Budapesten mar okt. 3., 00:30
    assert.equal(await eset('2026-10-02T21:30:00Z'), '2027-04-02');
    assert.equal(await eset('2026-08-31T10:00:00Z'), '2027-02-28');
  });

  test('fizetesi_mod: apple_pay / google_pay a tarcabol, link a tipusbol', async () => {
    for (const mod of ['apple_pay', 'google_pay', 'link']) {
      const a = await fizetettRendeles({}, mod);
      const r = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
      assert.equal(r.adat.fizetesi_mod, mod);
    }
  });
});

// --- webhook ---------------------------------------------------------------------------------------------------------
describe('/webhook', () => {
  test('ervenytelen / hianyzo / lejart alairas -> 400, levelek nincsenek', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const jo = alairtEsemeny(a.pi);
    assert.equal((await hiv('POST', 'webhook', { body: jo.torzs })).status, 400);
    // a hamis alairas: az elso hex jegy MAS legyen (ha az eredeti is 0 volt, 1-et irunk; a regi "v1=0" 1/16 eséllyel valtozatlan, azaz ervenyes alairas maradt)
    assert.equal((await webhook({ torzs: jo.torzs, fejlec: jo.fejlec.replace(/v1=(.)/, (m, c) => 'v1=' + (c === '0' ? '1' : '0')) })).status, 400);
    assert.equal((await webhook({ torzs: jo.torzs + ' ', fejlec: jo.fejlec })).status, 400);
    assert.equal((await webhook(alairtEsemeny(a.pi, { titok: 'whsec_mas' }))).status, 400);
    const regi = alairtEsemeny(a.pi, { ts: Math.floor(Date.now() / 1000) - 301 });
    const r = await webhook(regi);
    assert.equal(r.status, 400);
    assert.deepEqual(r.adat, { hiba: 'alairas' });
    // a "most" parameterrel a tolerancian belul mar jo
    assert.equal((await webhook(regi, { most: new Date(Date.now() - 200 * 1000) })).status, 200);
    assert.equal(levelek.length, 2);
    levelek = [];
    assert.equal((await hiv('POST', 'webhook', { body: jo.torzs, headers: { 'stripe-signature': jo.fejlec }, env: { ...ENV, STRIPE_WEBHOOK_SECRET: '' } })).status, 503);
    assert.equal(levelek.length, 0);
  });

  test('payment_intent.succeeded -> pontosan EGY szalon- es EGY vevo-level, ketszeri kezbesitesnel is', async () => {
    const a = await fizetettRendeles({ termek: '4kezes', ceges: { nev: 'Minta & Társa Kft.', adoszam: '12345678-1-42' } }, 'apple_pay');
    levelek = [];
    const e = alairtEsemeny(a.pi);
    const r1 = await webhook(e);
    assert.equal(r1.status, 200);
    assert.deepEqual(r1.adat, { ok: true });
    const r2 = await webhook(e);
    assert.equal(r2.status, 200);
    assert.equal((await webhook(alairtEsemeny(a.pi))).status, 200); // uj esemeny-azonosito, ugyanaz a PI
    assert.equal(levelek.length, 2);
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    assert.ok(szalon && vevo);

    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.ertesites, '1');
    const kod = await kuponKod(ENV, a.pi);
    assert.equal(pi.metadata.kod, kod);
    assert.equal(kod, vartKod(ENV.AJANDEK_TITOK, a.pi));

    assert.equal(szalon.targy, `Új ajándékkártya-rendelés (fizetve) – ${a.rendeles_id}`);
    assert.equal(szalon.valasz, 'vevo@example.com');
    assert.ok(szalon.html.includes(kod));
    assert.ok(szalon.html.includes('39.900 Ft'));
    assert.ok(szalon.html.includes('4 kezes Head Spa'));
    assert.ok(szalon.html.includes('Minta &amp; Társa Kft.'));
    assert.ok(szalon.html.includes('12345678-1-42'));
    assert.ok(szalon.html.includes('1023 Budapest, Bécsi út 2.'));
    assert.ok(szalon.html.includes('Apple Pay'));
    assert.match(szalon.html, /100%-os kupont/);
    const token = await kiallitToken(ENV, a.pi);
    assert.ok(szalon.html.includes(`${BAZIS}/api/ajandek/kiallit?pi=${a.pi}&amp;t=${token}`));

    assert.equal(vevo.targy, `Megkaptuk a fizetésed – MOSAIC ajándékkártya (${a.rendeles_id})`);
    assert.equal(vevo.valasz, 'szalon');
    assert.ok(vevo.html.includes(a.rendeles_id));
    assert.ok(vevo.html.includes('39.900 Ft'));
    assert.match(vevo.html, /elkészítésén dolgozunk; amint kész, e-mailben küldjük/);
    // a rendeles-link csak olvaso tokent visz: client_secret / payment_intent NINCS a levelekben
    const rt = await rendelesToken(ENV, a.pi);
    assert.ok(vevo.html.includes(`${BAZIS}/ajandek?rendeles=${a.pi}&amp;rt=${rt}`));
    for (const l of levelek) {
      assert.ok(!l.html.includes('client_secret'), l.targy);
      assert.ok(!l.html.includes('payment_intent='), l.targy);
      assert.ok(!l.html.includes(a.client_secret), l.targy);
      assert.ok(!l.html.includes('_secret_'), l.targy);
    }
    assert.ok(!vevo.html.includes(kod), 'a kod meg nem megy ki a vevonek');
    for (const l of levelek) assert.doesNotMatch(l.html, /perceken belül|azonnal/i);
  });

  test('idegen PI, mas esemenytipus, vagy a Stripe szerint meg nem sikeres PI -> 200, de nincs level', async () => {
    levelek = [];
    const v = await fetch(mock.url + '/v1/payment_intents', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + ENV.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'amount=1000000&currency=huf',
    });
    const idegen = await v.json();
    mock.allapot.sikeresIt(idegen.id);
    assert.equal((await webhook(alairtEsemeny(idegen.id))).status, 200);
    // az esemeny hazudik (forras), de a Stripe-tol visszakerdezett PI nem a miénk
    assert.equal((await webhook(alairtEsemeny(idegen.id, { metadata: { forras: 'ajandek-motor' } }))).status, 200);
    assert.equal(mock.allapot.pi(idegen.id).metadata.ertesites, undefined);

    const a = await fizetettRendeles();
    assert.equal((await webhook(alairtEsemeny(a.pi, { tipus: 'payment_intent.created' }))).status, 200);
    assert.equal((await webhook(alairtEsemeny(a.pi, { tipus: 'charge.refunded' }))).status, 200);
    const nyitott = await ujRendeles();
    assert.equal((await webhook(alairtEsemeny(nyitott.pi))).status, 200);
    assert.equal(levelek.length, 0);
  });

  test('levelkuldesi hiba -> nem 2xx (a Stripe ujraprobalja), es ujraprobalaskor csak a hianyzo level megy ki', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const e = alairtEsemeny(a.pi);
    const r1 = await webhook(e, { kuld: async (l) => { if (l.cimzett !== 'szalon') throw new Error('SMTP le'); levelek.push(l); } });
    assert.equal(r1.status, 500);
    assert.equal(mock.allapot.pi(a.pi).metadata.ertesites, 'szalon');
    const r2 = await webhook(e);
    assert.equal(r2.status, 200);
    assert.deepEqual(levelek.map((l) => l.cimzett), ['szalon', 'vevo@example.com']);
    assert.equal(mock.allapot.pi(a.pi).metadata.ertesites, '1');
    // levelkuldo nelkul (pl. nincs SMTP) sem "nyel el" semmit
    const b = await fizetettRendeles();
    const r3 = await webhook(alairtEsemeny(b.pi), { kuld: async () => { throw new Error('nincs SMTP-beallitas'); } });
    assert.equal(r3.status, 500);
    assert.equal(mock.allapot.pi(b.pi).metadata.ertesites, undefined);
  });

  test('AJANDEK_AZONNALI=1: a webhook kiallitja a kartyat, a vevo-levelben mar a kartya linkje es a kod van', async () => {
    const env = { ...ENV, AJANDEK_AZONNALI: '1' };
    const a = await fizetettRendeles();
    levelek = [];
    assert.equal((await webhook(alairtEsemeny(a.pi), { env })).status, 200);
    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.kartya_kesz, '1');
    assert.ok(pi.metadata.kartya_kiallitva_ekkor);
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    const kod = await kuponKod(env, a.pi);
    assert.ok(vevo.html.includes(`${BAZIS}/api/ajandek/kartya?pi=${a.pi}&amp;t=${await kartyaToken(env, a.pi)}`));
    assert.ok(!vevo.html.includes(a.client_secret), 'a tovabbithato kartya-linkben nincs client_secret');
    assert.ok(vevo.html.includes(kod));
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.match(szalon.html, /már megkapta/);
    for (const l of levelek) assert.doesNotMatch(l.html, /perceken belül|azonnal/i);
    const r = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret }, env });
    assert.equal(r.adat.kartya.allapot, 'kesz');
    assert.equal(r.adat.kartya.kod, kod);
  });
});

// --- /kiallit es /kartya ------------------------------------------------------------------------------------------------
// a megerosito oldal urlapja: application/x-www-form-urlencoded POST ugyanarra az utra
// kod: alapbol a javasolt (AK-) kod, mint amikor a szalon nem irja at; a Salonicban kapott kodot az opciok.kod adja
const kiallitPost = async (pi, t, opciok = {}) => {
  const { kod, ...tobbi } = opciok;
  return hiv('POST', 'kiallit', {
    body: new URLSearchParams({ pi, t, kod: kod ?? await kuponKod(ENV, pi) }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, ...tobbi,
  });
};
const rosszTokenek = async (piId, jo) => ['', 'abc', jo.replace(/^./, (c) => (c === '0' ? '1' : '0')), await kiallitToken(ENV, 'pi_masikazonosito123')];

describe('/kiallit', () => {
  test('GET: hibas token 403; nem fizetett 409; jo token -> csak megerosito oldal (POST-urlap), NEM allit ki es NEM kuld levelet', async () => {
    const a = await fizetettRendeles();
    const token = await kiallitToken(ENV, a.pi);
    levelek = [];
    for (const t of await rosszTokenek(a.pi, token)) {
      const r = await hiv('GET', 'kiallit', { query: { pi: a.pi, t } });
      assert.equal(r.status, 403, t);
      assert.match(r.headers['content-type'], /^text\/html; charset=utf-8/);
      assert.doesNotMatch(r.body, /<form/);
    }
    const nyitott = await ujRendeles();
    assert.equal((await hiv('GET', 'kiallit', { query: { pi: nyitott.pi, t: await kiallitToken(ENV, nyitott.pi) } })).status, 409);

    const metaElotte = mock.allapot.pi(a.pi).metadata;
    for (let i = 0; i < 3; i++) { // pl. levelszkenner + linkelonezet + a szalon kattintasa
      const r = await hiv('GET', 'kiallit', { query: { pi: a.pi, t: token } });
      assert.equal(r.status, 200);
      assert.match(r.body, /Kiállítod az ajándékkártyát\?/);
      assert.match(r.body, /<form method="post" action="\/api\/ajandek\/kiallit">/);
      assert.ok(r.body.includes(`<input type="hidden" name="pi" value="${a.pi}">`));
      assert.ok(r.body.includes(`<input type="hidden" name="t" value="${token}">`));
      assert.ok(r.body.includes('A kupon kész – kiküldjük a kártyát'));
      assert.ok(r.body.includes(await kuponKod(ENV, a.pi)));
      assert.ok(r.body.includes('vevo@example.com'));
      assert.ok(r.body.includes(a.rendeles_id));
      assert.match(r.headers['content-security-policy'], /form-action 'self'/);
    }
    assert.deepEqual(mock.allapot.pi(a.pi).metadata, metaElotte, 'a GET nem modosit');
    assert.equal(levelek.length, 0, 'a GET nem kuld levelet');
  });

  test('POST: hibas token 403; jo token -> kartya_kesz=1 + vevo-level a kartya linkjevel; ketszer sem kuld ketszer', async () => {
    const a = await fizetettRendeles();
    const token = await kiallitToken(ENV, a.pi);
    levelek = [];
    for (const t of await rosszTokenek(a.pi, token)) {
      const r = await kiallitPost(a.pi, t);
      assert.equal(r.status, 403, t);
    }
    assert.equal((await hiv('POST', 'kiallit', { body: 'nem urlap', headers: { 'content-type': 'application/json' } })).status, 403);
    assert.equal(mock.allapot.pi(a.pi).metadata.kartya_kesz, undefined);
    assert.equal(levelek.length, 0);

    const most = new Date('2026-10-03T12:00:00Z');
    const r = await kiallitPost(a.pi, token, { most });
    assert.equal(r.status, 200);
    assert.match(r.body, /Kiállítva, a vevő megkapta a levelet/);
    assert.match(r.headers['content-security-policy'], /form-action 'none'/);
    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.kartya_kesz, '1');
    assert.equal(pi.metadata.kartya_kiallitva_ekkor, most.toISOString());
    assert.equal(levelek.length, 1);
    const l = levelek[0];
    assert.equal(l.cimzett, 'vevo@example.com');
    assert.equal(l.valasz, 'szalon');
    const kod = await kuponKod(ENV, a.pi);
    const kt = await kartyaToken(ENV, a.pi);
    assert.ok(l.html.includes(`${BAZIS}/api/ajandek/kartya?pi=${a.pi}&amp;t=${kt}`));
    assert.ok(!l.html.includes(a.client_secret), 'a tovabbithato kartya-linkben nincs client_secret');
    assert.ok(l.html.includes(kod));
    assert.doesNotMatch(l.html, /perceken belül|azonnal/i);

    const r2 = await kiallitPost(a.pi, token);
    assert.equal(r2.status, 200);
    assert.match(r2.body, /már ki van állítva/);
    assert.equal(levelek.length, 1);
    // kiallitas utan a GET is csak a "mar kiallitva" oldalt adja, gomb nelkul
    const g = await hiv('GET', 'kiallit', { query: { pi: a.pi, t: token } });
    assert.equal(g.status, 200);
    assert.match(g.body, /már ki van állítva/);
    assert.doesNotMatch(g.body, /<form/);
    assert.match(g.headers['content-security-policy'], /form-action 'none'/);
    assert.equal(levelek.length, 1);

    const rr = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
    assert.equal(rr.adat.kartya.allapot, 'kesz');
    assert.equal(rr.adat.kartya.kod, kod);
    assert.match(rr.adat.kartya.kod, KOD_RE);
    assert.equal(rr.adat.kartya.url, `${BAZIS}/api/ajandek/kartya?pi=${a.pi}&t=${kt}`);
    assert.doesNotMatch(rr.adat.kartya.url, /cs=|_secret_/);
  });

  test('POST JSON-nal is mukodik; nem fizetett PI -> 409', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const r = await hiv('POST', 'kiallit', { body: { pi: a.pi, t: await kiallitToken(ENV, a.pi), kod: 'GYOR1865' } });
    assert.equal(r.status, 200);
    assert.equal(mock.allapot.pi(a.pi).metadata.kartya_kesz, '1');
    assert.equal(levelek.length, 1);
    const nyitott = await ujRendeles();
    assert.equal((await kiallitPost(nyitott.pi, await kiallitToken(ENV, nyitott.pi))).status, 409);
    assert.equal(levelek.length, 1);
  });

  test('levelkuldesi hiba eseten nem allitja kesznek (a szalon ujraprobalhatja)', async () => {
    const a = await fizetettRendeles();
    const t = await kiallitToken(ENV, a.pi);
    const r = await kiallitPost(a.pi, t, { kuld: async () => { throw new Error('SMTP le'); } });
    assert.equal(r.status, 502);
    assert.equal(mock.allapot.pi(a.pi).metadata.kartya_kesz, undefined);
  });
});

describe('/szemelyre', () => {
  test('nem fizetett PI -> 409; rossz cs -> 403', async () => {
    const a = await ujRendeles();
    let r = await hiv('POST', 'szemelyre', { body: { pi: a.pi, cs: a.client_secret, nev: 'Anna' } });
    assert.equal(r.status, 409);
    r = await hiv('POST', 'szemelyre', { body: { pi: a.pi, cs: a.pi + '_secret_x', nev: 'Anna' } });
    assert.equal(r.status, 403);
  });

  test('validacio: nev<=80, uzenet<=300, alkalom/atadas csak a listabol', async () => {
    const a = await fizetettRendeles();
    const alap = { pi: a.pi, cs: a.client_secret };
    for (const [mezo, ertek] of [['nev', 'x'.repeat(81)], ['uzenet', 'y'.repeat(301)], ['alkalom', 'hapci'], ['alkalom', '__proto__'], ['atadas', 'galamb'], ['atadas', 'constructor']]) {
      const r = await hiv('POST', 'szemelyre', { body: { ...alap, [mezo]: ertek } });
      assert.equal(r.status, 400, mezo + '=' + ertek);
      assert.ok(r.adat.mezok[mezo]);
    }
    assert.equal(mock.allapot.pi(a.pi).metadata.szemelyre_nev, 'Kiss Anna'); // a rendeleskor megadott nev valtozatlan
  });

  test('fizetett PI-n ment, a valasz a /rendeles formaja; fizikai atadasnal szalon-ertesito (modositaskor ujra)', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const alap = { pi: a.pi, cs: a.client_secret };
    let r = await hiv('POST', 'szemelyre', { body: { ...alap, nev: '  Kiss  Anna ', uzenet: 'Boldog\r\nszülinapot!\u0007', alkalom: 'szuletesnap', atadas: 'digitalis' } });
    assert.equal(r.status, 200);
    assert.equal(r.adat.allapot, 'fizetve');
    assert.deepEqual(r.adat.szemelyre, { nev: 'Kiss Anna', uzenet: 'Boldog\nszülinapot!', alkalom: 'szuletesnap', atadas: 'digitalis', tema: null, idezet: null, foto: false });
    assert.equal(levelek.length, 0);
    const md = mock.allapot.pi(a.pi).metadata;
    assert.equal(md.szemelyre_nev, 'Kiss Anna');
    assert.equal(md.szemelyre_alkalom, 'szuletesnap');

    r = await hiv('POST', 'szemelyre', { body: { ...alap, nev: 'Kiss Anna', uzenet: 'Boldog\nszülinapot!', alkalom: 'szuletesnap', atadas: 'fizikai' } });
    assert.equal(r.status, 200);
    assert.equal(levelek.length, 1);
    assert.equal(levelek[0].cimzett, 'szalon');
    assert.match(levelek[0].targy, /^Fizikai ajándékkártyát kértek – /);
    assert.ok(levelek[0].html.includes('Kiss Anna'));
    assert.ok(levelek[0].html.includes(await kuponKod(ENV, a.pi)));
    // ugyanaz megint: nincs uj level
    await hiv('POST', 'szemelyre', { body: { ...alap, nev: 'Kiss Anna', uzenet: 'Boldog\nszülinapot!', alkalom: 'szuletesnap', atadas: 'fizikai' } });
    assert.equal(levelek.length, 1);
    // modositott nev: a szalon ujra ertesul
    await hiv('POST', 'szemelyre', { body: { ...alap, nev: 'Kiss Anikó', uzenet: 'Boldog\nszülinapot!', alkalom: 'szuletesnap', atadas: 'fizikai' } });
    assert.equal(levelek.length, 2);
    assert.match(levelek[1].targy, /^Módosult/);
    // torles: ures mezok -> szemelyre null
    r = await hiv('POST', 'szemelyre', { body: { ...alap, nev: '', uzenet: '', alkalom: '', atadas: '' } });
    assert.equal(r.adat.szemelyre, null);
  });
});

describe('/kartya', () => {
  test('kesz allapotig 409 barati HTML (frissitessel); rossz cs -> 403 HTML', async () => {
    const nyitott = await ujRendeles();
    let r = await hiv('GET', 'kartya', { query: { pi: nyitott.pi, cs: nyitott.client_secret } });
    assert.equal(r.status, 409);
    const a = await fizetettRendeles();
    r = await hiv('GET', 'kartya', { query: { pi: a.pi, cs: a.client_secret } });
    assert.equal(r.status, 409);
    assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.match(r.body, /Készítjük az ajándékkártyádat…/);
    assert.match(r.body, /<meta http-equiv="refresh" content="20">/);
    assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    r = await hiv('GET', 'kartya', { query: { pi: a.pi, cs: a.pi + '_secret_x' } });
    assert.equal(r.status, 403);
    assert.match(r.headers['content-type'], /text\/html/);
  });

  test('kartya-token (t): kesz allapotban 200 cs nelkul; rossz / mas celu token 403; nem-kesz allapotban sincs kod; /rendeles es /szemelyre nem fogadja el', async () => {
    const a = await fizetettRendeles();
    const t = await kartyaToken(ENV, a.pi);
    // nem-kesz allapotban a token sem adja ki a kodot
    let r = await hiv('GET', 'kartya', { query: { pi: a.pi, t } });
    assert.equal(r.status, 409);
    assert.match(r.body, /Készítjük az ajándékkártyádat…/);
    assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    // rossz token, masik PI tokenje, a kiallito token, nagybetus hamis, hianyzo pi
    const masik = await fizetettRendeles();
    for (const query of [
      { pi: a.pi, t: t.replace(/^./, (c) => (c === '0' ? '1' : '0')) },
      { pi: a.pi, t: await kartyaToken(ENV, masik.pi) },
      { pi: a.pi, t: await kiallitToken(ENV, a.pi) },
      { pi: a.pi, t: 'abc' },
      { pi: masik.pi, t },
      { t },
    ]) {
      r = await hiv('GET', 'kartya', { query });
      assert.equal(r.status, 403, JSON.stringify(query));
      assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    }
    assert.equal((await kiallitPost(a.pi, await kiallitToken(ENV, a.pi))).status, 200);
    r = await hiv('GET', 'kartya', { query: { pi: a.pi, t } });
    assert.equal(r.status, 200);
    assert.ok(r.body.includes(await kuponKod(ENV, a.pi)));
    assert.ok(!r.body.includes(a.client_secret));
    assert.ok(!r.body.includes('vevo@example.com'), 'a kartya-oldal nem mutatja a vevo e-mailjet');
    // nagybetus hex is ugyanaz a token
    assert.equal((await hiv('GET', 'kartya', { query: { pi: a.pi, t: t.toUpperCase() } })).status, 200);
    // a regi pi+cs format tovabbra is mukodik, ugyanazt az oldalt adja
    const regi = await hiv('GET', 'kartya', { query: { pi: a.pi, cs: a.client_secret } });
    assert.equal(regi.status, 200);
    assert.equal(regi.body, r.body);
    // a kartya-token NEM hitelesit a /rendeles-hez es a /szemelyre-hez
    for (const query of [{ pi: a.pi, t }, { pi: a.pi, cs: t }, { pi: a.pi, t, cs: '' }]) {
      const rr = await hiv('GET', 'rendeles', { query });
      assert.equal(rr.status, 403, JSON.stringify(query));
      assert.deepEqual(rr.adat, { hiba: 'tiltott' });
    }
    for (const body of [{ pi: a.pi, t, nev: 'Betolakodo' }, { pi: a.pi, cs: t, nev: 'Betolakodo' }]) {
      const sz = await hiv('POST', 'szemelyre', { body });
      assert.equal(sz.status, 403);
    }
    assert.equal(mock.allapot.pi(a.pi).metadata.szemelyre_nev, 'Kiss Anna'); // a rendeleskor megadott nev valtozatlan
    // a /rendeles valasza valtozatlan alaku: kartya.kod + kartya.url (a t-s link)
    const rr = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
    assert.deepEqual(Object.keys(rr.adat.kartya).sort(), ['allapot', 'ervenyes_ig', 'kod', 'url']);
    assert.equal(rr.adat.kartya.url, `${BAZIS}/api/ajandek/kartya?pi=${a.pi}&t=${t}`);
  });

  test('kesz kartya: 200 nyomtathato HTML a koddal, a szemelyre szabassal, escape-elve (XSS-proba)', async () => {
    const a = await fizetettRendeles({ termek: 'paros' });
    const alap = { pi: a.pi, cs: a.client_secret };
    const xssNev = '"><img src=x onerror=alert(1)>';
    const xssUzenet = '<script>alert("x")</script>\nSzeretettel & puszi \'<b>\'';
    let r = await hiv('POST', 'szemelyre', { body: { ...alap, nev: xssNev, uzenet: xssUzenet, alkalom: 'szuletesnap', atadas: 'nyomtatott' } });
    assert.equal(r.status, 200);
    assert.equal((await kiallitPost(a.pi, await kiallitToken(ENV, a.pi))).status, 200);
    r = await hiv('GET', 'kartya', { query: { pi: a.pi, t: await kartyaToken(ENV, a.pi) } });
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.match(r.headers['content-security-policy'], /default-src 'none'/);
    assert.match(r.headers['content-security-policy'], /form-action 'none'/);
    assert.match(r.headers['content-security-policy'], /script-src 'sha256-[A-Za-z0-9+/=]+'/);
    const h = r.body;
    const kod = await kuponKod(ENV, a.pi);
    assert.ok(h.includes(kod));
    // a MOSAIC sajat (Canva-s) kartyaterve a hatter, a valtozo szovegeket a rendszer irja ra
    assert.ok(h.includes(`${BAZIS}/assets/img/ajandek/kartya-hatter.jpg`));
    assert.ok(h.includes('páros MOSAIC'));
    assert.ok(h.includes('HEAD SPA KEZELÉS (2 FŐ)'));
    assert.ok(h.includes('53.800 Ft'));
    assert.ok(h.includes('mosaicheadspa.hu/idpontfoglalas'));
    assert.ok(h.includes(`${BAZIS}/assets/fonts/hanken-grotesk-600-latin.woff2`));
    assert.match(r.headers['content-security-policy'], /font-src 'self'/);
    assert.ok(h.includes('Nyomtatás / Mentés PDF-ként'));
    assert.match(h, /@media print\{[^}]*\{[^}]*\}[^]*\.nem-nyomtat\{display:none!important\}/);
    // XSS: a nyers jelolok nem kerulhetnek az oldalba
    assert.ok(!h.includes('<img src=x'));
    assert.ok(!h.includes('<script>alert'));
    assert.ok(!h.includes("'<b>'"));
    assert.ok(h.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(h.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
    assert.ok(h.includes('Szeretettel &amp; puszi &#39;&lt;b&gt;&#39;'));
    // pontosan egy <script> (a nyomtatogomb), es annak hash-e szerepel a CSP-ben
    assert.equal(h.match(/<script>/g).length, 1);
    const js = /<script>([^<]*)<\/script>/.exec(h)[1];
    const hash = crypto.createHash('sha256').update(js).digest('base64');
    assert.ok(r.headers['content-security-policy'].includes(`'sha256-${hash}'`));
    // ervenyesseg: a vasarlas napjatol 6 honap
    const rr = await hiv('GET', 'rendeles', { query: alap });
    const [ev, ho, nap] = rr.adat.kartya.ervenyes_ig.split('-').map(Number);
    const honapok = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
    assert.ok(h.includes(`${ev}. ${honapok[ho - 1]} ${nap}-ig`));
  });
});


// --- /atutalas ---------------------------------------------------------------------------------------------------------
// A "MOSAIC kitolto" szkript futtatasa DOM-csonkokkal (vm): { elemek, naplo }
function kitoltoFuttat(szkript, hash, hostname) {
  const elemek = {};
  for (const [kulcs, tipus] of Object.entries({ nameTo: 'text', nameFrom: 'text', emailFrom: 'email', phoneFrom: 'tel', paymentType: 'select-one', sendCC: 'checkbox', message: 'textarea' })) {
    elemek['GiftCardBuyForm_' + kulcs] = { type: tipus, value: kulcs === 'paymentType' ? '1' : '', checked: true, esemenyek: [], dispatchEvent(e) { this.esemenyek.push(e.type); } };
  }
  const naplo = { alert: [], banner: null, kuldes: 0 };
  vm.runInNewContext(szkript, {
    location: { hash, hostname },
    document: {
      getElementById: (id) => elemek[id] || null,
      createElement: () => ({ style: {}, remove() {} }),
      body: { appendChild(bn) { naplo.banner = bn; } },
      forms: [{ submit() { naplo.kuldes++; } }],
    },
    Event: class { constructor(t) { this.type = t; } },
    alert: (m) => naplo.alert.push(m),
    setTimeout: () => 0,
  });
  return { elemek, naplo };
}

describe('/atutalas', () => {
  const TEL = '+36 20 123 4567';
  test('levelek a vevonek es a szalonnak (kiallito linkkel), a Stripe-ban nyilvantartasi rekord (nem fizetheto); a vevo-levelben nincs szabad szoveg', async () => {
    levelek = [];
    const torzs = rendelesTorzs({ termek: '4kezes', nev: 'Kattints <a href="http://csalo.example">ide</a>', megajandekozott: 'Nagy Mária <b>', uzenet: 'Boldog <i>szülinapot</i>', telefon: TEL, osszeg: 1 });
    delete torzs.kulcs;
    const r = await hiv('POST', 'atutalas', { body: torzs });
    assert.equal(r.status, 200);
    assert.equal(r.adat.ok, true);
    assert.equal(r.adat.osszeg, 39900);
    assert.match(r.adat.rendeles_ref, /^ATU-[A-Z0-9]{6}$/);
    // a kozlemeny CSAK a sajat azonosito
    assert.deepEqual(r.adat.utalas, {
      kedvezmenyezett: ADAT.BANK.kedvezmenyezett, szamlaszam: ADAT.BANK.szamlaszam, osszeg_ft: 39900, kozlemeny: r.adat.rendeles_ref,
    });
    // nyilvantartasi rekord: PI, amit senki nem tud kifizetni; az ar a szerveren szamolt
    const pi = atuPi(r.adat.rendeles_ref);
    assert.ok(pi, 'letrejott a rekord');
    assert.equal(pi.status, 'requires_payment_method');
    assert.equal(pi.amount, 3990000);
    assert.equal(pi.metadata.fizetesi_mod, 'atutalas');
    assert.equal(pi.metadata.telefon, TEL);
    assert.equal(pi.metadata.szemelyre_nev, 'Nagy Mária <b>');
    assert.equal(pi.metadata.forras, 'ajandek-motor');
    assert.equal(pi.receipt_email, 'vevo@example.com');
    assert.equal(levelek.length, 2);
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.ok(vevo && szalon);
    assert.equal(vevo.valasz, 'szalon');
    assert.equal(szalon.valasz, 'vevo@example.com');
    assert.ok(vevo.html.includes('Kedves Vásárló!'));
    assert.ok(vevo.html.includes('39.900 Ft'));
    assert.ok(!vevo.html.includes('26.900 Ft') && !vevo.html.includes('53.800 Ft'), 'csak a valasztott termek ara');
    assert.ok(vevo.html.includes(ADAT.BANK.szamlaszam));
    assert.ok(vevo.html.includes(r.adat.rendeles_ref));
    // a kitolto altal beirt szoveg (nev, megajandekozott, uzenet, telefon) semmilyen formaban nincs a vevo levelében
    for (const tilos of ['Kattints', 'csalo.example', 'Nagy Mária', 'szülinapot', '123 4567', '&lt;a', '&lt;b']) assert.ok(!vevo.html.includes(tilos), tilos);
    assert.ok(!vevo.targy.includes('Kattints') && !vevo.targy.includes('Nagy'));
    // a szalon levelében escape-elve megmarad, es ott van a kiallito gomb + a Salonic-utalvany linkje
    assert.match(szalon.targy, /^Új ajándékkártya-igény \(átutalás, még nincs kifizetve\)/);
    assert.ok(szalon.html.includes(r.adat.rendeles_ref));
    assert.ok(szalon.html.includes('4 kezes Head Spa'));
    assert.ok(szalon.html.includes('Nagy Mária &lt;b&gt;'));
    assert.ok(szalon.html.includes('Boldog &lt;i&gt;szülinapot&lt;/i&gt;'));
    assert.ok(szalon.html.includes(TEL));
    assert.ok(szalon.html.includes('Kattints &lt;a href=&quot;http://csalo.example&quot;&gt;ide&lt;/a&gt;'));
    assert.ok(!szalon.html.includes('<a href="http://csalo.example">'));
    assert.ok(szalon.html.includes('https://app.salonic.hu/promotion/giftCard/sale/4000#mosaic='));
    assert.ok(szalon.html.includes(SZALON.email), 'a szalon-level megmondja, hogy a szalon cime kerul az ajandekozo e-mail mezobe');
    assert.ok(szalon.html.includes('MOSAIC kitöltő'));
    const token = await kiallitToken(ENV, pi.id);
    assert.ok(szalon.html.includes(`${BAZIS}/api/ajandek/kiallit?pi=${pi.id}&amp;t=${token}`));
    assert.ok(szalon.html.includes('Az utalás beérkezett – kiállítom a kártyát'));
  });

  test('validacio 400 (telefon kotelezo); robotcsapda -> 200 levelek nelkul; szalon-level hibaja -> 502', async () => {
    levelek = [];
    let r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ email: 'rossz', termek: 'x', megajandekozott: 'n'.repeat(81), uzenet: 'u'.repeat(301), telefon: 'nincs' }) });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.email && r.adat.mezok.termek && r.adat.mezok.megajandekozott && r.adat.mezok.uzenet && r.adat.mezok.telefon);
    r = await hiv('POST', 'atutalas', { body: rendelesTorzs() });
    assert.equal(r.status, 400, 'telefon nelkul nem megy');
    r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ 'bot-field': 'x', telefon: TEL }) });
    assert.equal(r.status, 200);
    assert.equal(levelek.length, 0);
    r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ telefon: TEL }), kuld: async () => { throw new Error('SMTP le'); } });
    assert.equal(r.status, 502);
  });

  test('utalasos kiallitas: a szalon beirja a Salonic-utalvanykodot -> a rendeles "fizetve", a vevo megkapja a kartyat a SZALON kodjaval; egyszer', async () => {
    levelek = [];
    const r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ termek: 'paros', megajandekozott: 'Anna', uzenet: 'Boldog születésnapot!', telefon: TEL, nev: 'Teszt Vevő' }) });
    assert.equal(r.status, 200);
    const pi = atuPi(r.adat.rendeles_ref);
    const t = await kiallitToken(ENV, pi.id);
    levelek = [];
    // a kartya-oldal addig nem "kesz"
    let g = await hiv('GET', 'kartya', { query: { pi: pi.id, t: await kartyaToken(ENV, pi.id) } });
    assert.equal(g.status, 409);
    assert.doesNotMatch(g.body, /AK-/);
    // GET: megerosito oldal, ures kod-mezo, a vevo/megajandekozott adataival es a Salonic-linkkel; nem modosit, nem kuld
    const meta0 = JSON.stringify(mock.allapot.pi(pi.id).metadata);
    g = await hiv('GET', 'kiallit', { query: { pi: pi.id, t } });
    assert.equal(g.status, 200);
    assert.match(g.body, /Az utalás beérkezett – kiállítod a kártyát\?/);
    assert.match(g.body, /name="kod" value=""/);
    assert.ok(g.body.includes('Teszt Vevő') && g.body.includes('Anna') && g.body.includes(TEL));
    assert.ok(g.body.includes(r.adat.rendeles_ref));
    assert.ok(g.body.includes('https://app.salonic.hu/promotion/giftCard/sale/4081'));
    assert.ok(!g.body.includes('AK-'), 'utalasnal nincs javasolt AK- kod');
    // Salonic: egy kattintasos kitolto (a link hash-e), nincs soronkenti masolas, az uzenet nem latszik
    assert.ok(g.body.includes('#mosaic='));
    assert.ok(!g.body.includes('data-masol'));
    assert.ok(!g.body.includes('Boldog születésnapot!'));
    assert.ok(!/<script/.test(g.body));
    assert.match(g.headers['content-security-policy'], /script-src 'sha256-[A-Za-z0-9+/=]+' 'sha256-[A-Za-z0-9+/=]+';/);
    assert.ok(!/script-src[^;]*unsafe/.test(g.headers['content-security-policy']));
    assert.equal(JSON.stringify(mock.allapot.pi(pi.id).metadata), meta0, 'a GET nem modosit');
    assert.equal(levelek.length, 0);
    // POST kod nelkul / hibas kodra: 400 es ujra az urlap, semmi nem tortenik
    for (const rossz of ['', 'ab', 'GY OR!', '<script>', 'x'.repeat(41)]) {
      const p = await kiallitPost(pi.id, t, { kod: rossz });
      assert.equal(p.status, 400, rossz);
      assert.match(p.body, /Add meg a kódot/);
      assert.ok(p.body.includes('<form'));
    }
    assert.equal(JSON.stringify(mock.allapot.pi(pi.id).metadata), meta0);
    assert.equal(levelek.length, 0);
    // jo kod (a szokozok kikerulnek)
    const most = new Date('2026-10-05T08:30:00Z');
    const p = await kiallitPost(pi.id, t, { kod: ' GYOR 1865 ', most });
    assert.equal(p.status, 200, p.body);
    assert.match(p.body, /Kiállítva, a vevő megkapta a levelet/);
    assert.ok(p.body.includes('GYOR1865'));
    const md = mock.allapot.pi(pi.id).metadata;
    assert.equal(md.atutalas_beerkezett, '1');
    assert.equal(md.atutalas_ekkor, most.toISOString());
    assert.equal(md.kod, 'GYOR1865');
    assert.equal(md.kartya_kesz, '1');
    assert.equal(levelek.length, 1);
    const l = levelek[0];
    assert.equal(l.cimzett, 'vevo@example.com');
    assert.ok(l.html.includes('GYOR1865'));
    assert.ok(!l.html.includes('AK-'));
    assert.ok(l.html.includes(`${BAZIS}/api/ajandek/kartya?pi=${pi.id}&amp;t=${await kartyaToken(ENV, pi.id)}`));
    assert.ok(l.html.includes('2027. április 5-ig'), 'ervenyesseg a jovahagyas napjatol 6 honap');
    // masodszor nem megy ujabb level, a kod nem valtozik
    const p2 = await kiallitPost(pi.id, t, { kod: 'MAS12345' });
    assert.equal(p2.status, 200);
    assert.match(p2.body, /már ki van állítva/);
    assert.equal(levelek.length, 1);
    assert.equal(mock.allapot.pi(pi.id).metadata.kod, 'GYOR1865');
    // a kartya-oldal: a szalon kodja, a megajandekozott neve, az uzenet, a termek es az ar
    g = await hiv('GET', 'kartya', { query: { pi: pi.id, t: await kartyaToken(ENV, pi.id) } });
    assert.equal(g.status, 200);
    assert.ok(g.body.includes('GYOR1865') && g.body.includes('Anna') && g.body.includes('Boldog születésnapot!'));
    assert.ok(g.body.includes('53.800 Ft') && g.body.includes('páros MOSAIC'));
    assert.ok(g.body.includes('Érvényes: 2027. április 5-ig'));
  });

  // A Salonic-link adata a #mosaic= reszben: az "Ajandekozo" = a vevo, az e-mail a SZALON cime (a Salonic ne irjon a vevonek), az uzenet NINCS benne
  const salonicAdat = (html) => {
    const m = /href="(https:\/\/app\.salonic\.hu\/promotion\/giftCard\/sale\/(\d+))#mosaic=([^"]+)"/.exec(html);
    assert.ok(m, 'a Salonic-link az adatokkal');
    return { id: m[2], adat: JSON.parse(decodeURIComponent(m[3].replace(/&#39;/g, "'"))) };
  };

  test('Salonic-kitolto: a link hash-e a vevo adatait, a szalon e-mailjet es az Atutalas fizetesi modot hordozza; az uzenet nem; a nev 40 karakterre vagva', async () => {
    const hosszuNev = 'Á'.repeat(41) + 'x';
    const r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ termek: 'egyeni', nev: 'Vevő Béla', megajandekozott: hosszuNev, uzenet: 'Titkos üzenet a kártyára', telefon: TEL }) });
    assert.equal(r.status, 200);
    const pi = atuPi(r.adat.rendeles_ref);
    const g = await hiv('GET', 'kiallit', { query: { pi: pi.id, t: await kiallitToken(ENV, pi.id) } });
    const { id, adat } = salonicAdat(g.body);
    assert.equal(id, '4040');
    assert.deepEqual(adat, { nameFrom: 'Vevő Béla', emailFrom: SZALON.email, phoneFrom: TEL, nameTo: 'Á'.repeat(40), paymentType: '14', sendCC: 0 });
    assert.ok(!JSON.stringify(adat).includes('Titkos'), 'az uzenet nem kerul a Salonicba');
    assert.ok(!g.body.includes('Titkos üzenet'), 'a kiallito oldal sem mutatja');
    // a kartyara a teljes uzenet kerul (a rekordban megmarad)
    assert.equal(mock.allapot.pi(pi.id).metadata.szemelyre_uzenet, 'Titkos üzenet a kártyára');
    // kifejezett megajandekozott nelkul a nameTo az ajandekozott mezo (a rendeleskor megadott nev)
    const r2 = await hiv('POST', 'atutalas', { body: rendelesTorzs({ termek: 'egyeni', telefon: TEL }) });
    const pi2 = atuPi(r2.adat.rendeles_ref);
    const g2 = await hiv('GET', 'kiallit', { query: { pi: pi2.id, t: await kiallitToken(ENV, pi2.id) } });
    assert.equal(salonicAdat(g2.body).adat.nameTo, 'Kiss Anna');
  });

  test('az ajandekozott neve atutalasnal is kotelezo, a rekordba (szemelyre_nev) kerul', async () => {
    let r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ ajandekozott: '', telefon: TEL }) });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.ajandekozott);
    r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ ajandekozott: 'Péter Zsófia', telefon: TEL }) });
    assert.equal(r.status, 200);
    assert.equal(atuPi(r.adat.rendeles_ref).metadata.szemelyre_nev, 'Péter Zsófia');
  });

  test('"MOSAIC kitolto" konyvjelzo: javascript: href (biztonsagos karakterek), a CSP-ben nincs unsafe-inline, a kiallito oldalon nincs szkript', async () => {
    const r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ termek: 'paros', telefon: TEL }) });
    const pi = atuPi(r.adat.rendeles_ref);
    const g = await hiv('GET', 'kiallit', { query: { pi: pi.id, t: await kiallitToken(ENV, pi.id) } });
    assert.ok(/^[\x20-\x7e]+$/.test(SALONIC_KITOLTO_JS), 'csak ASCII');
    assert.ok(!/[%"<>\r\n]/.test(SALONIC_KITOLTO_JS), 'nincs % " < > sortores');
    const m = /class="kitolto-gomb" href="javascript:([^"]*)"/.exec(g.body);
    assert.ok(m, 'a konyvjelzo-link');
    const dekodolt = m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    assert.equal(dekodolt, SALONIC_KITOLTO_JS);
    assert.ok(g.body.includes('MOSAIC kitöltő'));
    assert.ok(!/<script/.test(g.body), 'atutalasos kiallito oldalon nincs szkript');
    assert.ok(!/script-src[^;]*unsafe/.test(g.headers['content-security-policy']));
  });

  test('"MOSAIC kitolto" futtatasa (vm, DOM-csonkokkal): kitolti a mezoket, a masolat-jelolot kiveszi, semmit nem kuld; rossz oldalon / hash nelkul csak figyelmeztet', async () => {
    const r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ termek: '4kezes', nev: 'Vevő Béla', megajandekozott: 'Kovács Anna', telefon: TEL }) });
    const pi = atuPi(r.adat.rendeles_ref);
    const g = await hiv('GET', 'kiallit', { query: { pi: pi.id, t: await kiallitToken(ENV, pi.id) } });
    const link = new URL(/href="(https:\/\/app\.salonic\.hu[^"]+)"/.exec(g.body)[1].replace(/&#39;/g, "'"));
    const futtat = (hash, hostname) => kitoltoFuttat(SALONIC_KITOLTO_JS, hash, hostname);
    const ok = futtat(link.hash, 'app.salonic.hu');
    const e = (k) => ok.elemek['GiftCardBuyForm_' + k];
    assert.equal(e('nameFrom').value, 'Vevő Béla');
    assert.equal(e('emailFrom').value, SZALON.email);
    assert.equal(e('phoneFrom').value, TEL);
    assert.equal(e('nameTo').value, 'Kovács Anna');
    assert.equal(e('paymentType').value, '14');
    assert.equal(e('sendCC').checked, false, 'a masolat-jelolo ures');
    assert.equal(e('message').value, '', 'az uzenet mezo erintetlen');
    assert.deepEqual(e('nameFrom').esemenyek, ['input', 'change']);
    assert.equal(ok.naplo.alert.length, 0);
    assert.equal(ok.naplo.kuldes, 0, 'nem kuld el semmit');
    assert.match(ok.naplo.banner.textContent, /^MOSAIC: 6 mező kitöltve\. Ellenőrizd, majd kattints az Előnézetre\.$/);
    // masik oldalon / hash nelkul / serult adattal: figyelmeztetes, semmi nem toltodik ki
    for (const [hash, host] of [[link.hash, 'masik.example'], ['', 'app.salonic.hu'], ['#mosaic=%7Brossz', 'app.salonic.hu']]) {
      const x = futtat(hash, host);
      assert.equal(x.naplo.alert.length, 1, `${host} ${hash}`);
      assert.equal(x.elemek.GiftCardBuyForm_nameFrom.value, '');
      assert.equal(x.naplo.banner, null);
    }
  });

  test('kartyas rendelesnel a szalon felulirhatja a javasolt kodot: az kerul a levelbe es a kartyara', async () => {
    const a = await fizetettRendeles({ termek: 'egyeni' });
    await webhook(alairtEsemeny(a.pi));
    levelek = [];
    const t = await kiallitToken(ENV, a.pi);
    const g = await hiv('GET', 'kiallit', { query: { pi: a.pi, t } });
    assert.ok(g.body.includes(`name="kod" value="${await kuponKod(ENV, a.pi)}"`), 'alapbol a javasolt kod');
    assert.ok(!g.body.includes('promotion/giftCard/sale'), 'kartyas fizetesnel nincs utalvany-ertekesites');
    assert.deepEqual([...g.body.matchAll(/data-masol="([^"]*)"/g)].map((m) => m[1]), [await kuponKod(ENV, a.pi)], 'a javasolt kuponkod masolhato');
    const p = await kiallitPost(a.pi, t, { kod: 'SajatKupon-7' });
    assert.equal(p.status, 200);
    assert.equal(mock.allapot.pi(a.pi).metadata.kod, 'SajatKupon-7');
    assert.ok(levelek[0].html.includes('SajatKupon-7'));
    const k = await hiv('GET', 'kartya', { query: { pi: a.pi, t: await kartyaToken(ENV, a.pi) } });
    assert.ok(k.body.includes('SajatKupon-7'));
    assert.ok(!k.body.includes(await kuponKod(ENV, a.pi)));
  });
});


// --- szemelyre szabott (otthon nyomtatott) kartya: atvetel, design, idezet, foto (KV) ----------------------------------------
// KV-mock: a Cloudflare KV get / put (type: arrayBuffer, expirationTtl) felulete
function ujKv() {
  const t = new Map();
  return {
    t,
    async get(kulcs, opciok) {
      const v = t.get(kulcs);
      if (!v) return null;
      return opciok && opciok.type === 'arrayBuffer' ? v.bajtok.slice().buffer : new TextDecoder().decode(v.bajtok);
    },
    async put(kulcs, ertek, opciok) {
      t.set(kulcs, { bajtok: new Uint8Array(ertek instanceof ArrayBuffer ? ertek : ertek.buffer ? ertek.slice().buffer : ertek), ttl: opciok && opciok.expirationTtl });
    },
  };
}
const jpegAdat = (meret = 4000) => {
  const b = Buffer.alloc(meret, 7);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0; b[meret - 2] = 0xff; b[meret - 1] = 0xd9;
  return 'data:image/jpeg;base64,' + b.toString('base64');
};
const NAP = 24 * 3600;

describe('szemelyre szabott kartya (otthon nyomtatott)', () => {
  test('/beallitas: foto csak akkor, ha van KV-tarolo', async () => {
    assert.equal((await hiv('GET', 'beallitas')).adat.foto, false);
    assert.equal((await hiv('GET', 'beallitas', { env: { ...ENV, AJANDEK_FOTOK: ujKv() } })).adat.foto, true);
    assert.equal((await hiv('GET', 'beallitas', { env: { AJANDEK_FOTOK: ujKv() } })).adat.foto, false, 'Stripe nelkul (mod nincs) nincs foto sem');
  });

  test('/foto feltoltes: JPEG (data URL) -> id, 3 napos ervenyesseggel; ervenytelen / nagy / nem JPEG / KV nelkul elutasitva', async () => {
    const kv = ujKv();
    const env = { ...ENV, AJANDEK_FOTOK: kv };
    const ip = '10.77.1.1';
    _korlatAlaphelyzet();
    const jo = await hiv('POST', 'foto', { body: { kep: jpegAdat() }, env, ip });
    assert.equal(jo.status, 200, jo.body);
    assert.match(jo.adat.id, /^[A-Z0-9]{24}$/);
    const tarolt = kv.t.get('foto:' + jo.adat.id);
    assert.ok(tarolt && tarolt.bajtok.length === 4000);
    assert.equal(tarolt.ttl, 3 * NAP);
    for (const [kep, status] of [
      ['', 400], ['nem-data-url', 400], ['data:image/png;base64,AAAA', 400], ['data:image/jpeg;base64,@@@', 400],
      ['data:image/jpeg;base64,' + Buffer.alloc(3000, 1).toString('base64'), 400], // nem JPEG-fejlec
      ['data:image/jpeg;base64,' + Buffer.alloc(300, 1).toString('base64'), 400],  // tul kicsi
    ]) {
      const r = await hiv('POST', 'foto', { body: { kep }, env, ip });
      assert.equal(r.status, status, kep.slice(0, 30));
    }
    const nagy = await hiv('POST', 'foto', { body: { kep: jpegAdat(700 * 1024 + 10) }, env, ip });
    assert.equal(nagy.status, 413);
    assert.equal((await hiv('POST', 'foto', { body: { kep: jpegAdat() }, ip })).status, 503, 'KV nelkul');
    assert.equal((await hiv('POST', 'foto', { body: 'nem json', headers: { 'content-type': 'text/plain' }, env, ip })).status, 415);
  });

  test('/foto feltoltes: kereskorlat (12 / 10 perc IP-nkent)', async () => {
    const env = { ...ENV, AJANDEK_FOTOK: ujKv() };
    _korlatAlaphelyzet();
    const ip = '10.77.2.2';
    for (let i = 0; i < 12; i++) assert.equal((await hiv('POST', 'foto', { body: { kep: jpegAdat() }, env, ip })).status, 200);
    const r = await hiv('POST', 'foto', { body: { kep: jpegAdat() }, env, ip });
    assert.equal(r.status, 429);
    assert.ok(r.headers['retry-after']);
    _korlatAlaphelyzet();
  });

  test('/fizetes + szemelyre szabas: metadata, a foto hosszu ervenyessegre kotve; a vegleges kartya a valasztott designnal, idezettel, fotoval, kodja a szaloné', async () => {
    const kv = ujKv();
    const env = { ...ENV, AJANDEK_FOTOK: kv };
    _korlatAlaphelyzet();
    const f = await hiv('POST', 'foto', { body: { kep: jpegAdat(5000) }, env });
    const fotoId = f.adat.id;
    const r = await hiv('POST', 'fizetes', { env, body: rendelesTorzs({
      termek: 'paros', atvetel: 'otthon',
      szemelyre: { tema: 'krem', idezet: 'A legszebb ajándék <b>te</b> vagy!\nPihenj sokat.', nev: 'Kovács Anna', foto_id: fotoId, foto_poz: '40,35,1.3' },
    }) });
    assert.equal(r.status, 200, r.body);
    const md = mock.allapot.pi(r.adat.pi).metadata;
    assert.equal(md.atvetel, 'otthon');
    assert.equal(md.kartya_tema, 'krem');
    assert.equal(md.kartya_idezet, 'A legszebb ajándék <b>te</b> vagy!\nPihenj sokat.');
    assert.equal(md.szemelyre_nev, 'Kovács Anna');
    assert.equal(md.foto_id, fotoId);
    assert.equal(md.foto_poz, '40.0,35.0,1.30');
    assert.equal(kv.t.get('foto:' + fotoId).ttl, 400 * NAP, 'a rendeleshez kotes hosszu ervenyessegre ujrairja');

    mock.allapot.sikeresIt(r.adat.pi, { mod: 'card' });
    levelek = [];
    assert.equal((await webhook(alairtEsemeny(r.adat.pi), { env })).status, 200);
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.ok(szalon.html.includes('E-mailben, otthon kinyomtatja'));
    assert.ok(szalon.html.includes('Krém') && szalon.html.includes('Pihenj sokat'));
    const elonezetUrl = /href="([^"]*\/api\/ajandek\/elonezet\?[^"]+)"/.exec(szalon.html)[1].replace(/&amp;/g, '&');
    assert.ok(elonezetUrl.startsWith(BAZIS));

    // kiallitas a szalon kodjaval
    const t = await kiallitToken(env, r.adat.pi);
    const g = await hiv('GET', 'kiallit', { query: { pi: r.adat.pi, t }, env });
    assert.ok(g.body.includes('Kártya-design') && g.body.includes('Krém'));
    assert.ok(g.body.includes('/api/ajandek/elonezet?pi='), 'a kiallito oldalon az elonezet linkje');
    const p = await kiallitPost(r.adat.pi, t, { kod: 'GYOR1865', env });
    assert.equal(p.status, 200, p.body);

    const k = await hiv('GET', 'kartya', { query: { pi: r.adat.pi, t: await kartyaToken(env, r.adat.pi) }, env });
    assert.equal(k.status, 200);
    assert.ok(k.body.includes('ak-t-krem'), 'a valasztott design');
    assert.ok(k.body.includes('GYOR1865') && k.body.includes('Kovács Anna') && k.body.includes('Pihenj sokat'));
    assert.ok(k.body.includes('A legszebb ajándék &lt;b&gt;te&lt;/b&gt; vagy!'), 'az idezet escape-elve');
    assert.ok(!k.body.includes('<b>te</b>'));
    const fotoUrl = /<img src="([^"]*\/api\/ajandek\/foto\?[^"]+)"/.exec(k.body)[1].replace(/&amp;/g, '&');
    assert.ok(fotoUrl.startsWith(BAZIS + '/api/ajandek/foto?id=' + fotoId + '&t='));
    assert.ok(k.body.includes('object-position:40% 35%') && k.body.includes('scale(1.3)'), 'a fotokivagas');
    assert.ok(!k.body.includes('kartya-hatter.jpg'), 'nem a klasszikus Canva-hatter');
    assert.match(k.headers['content-security-policy'], /img-src 'self'/);

    // a fotot csak az id + token mutatja meg
    const kep = await hiv('GET', 'foto', { query: { id: fotoId, t: fotoUrl.split('&t=')[1] }, env });
    assert.equal(kep.status, 200);
    assert.equal(kep.headers['content-type'], 'image/jpeg');
    assert.equal(kep.body.length, 5000);
    assert.equal((await hiv('GET', 'foto', { query: { id: fotoId, t: '0'.repeat(64) }, env })).status, 403);
    assert.equal((await hiv('GET', 'foto', { query: { id: 'A'.repeat(24), t: await fotoToken(env, 'A'.repeat(24)) }, env })).status, 404);
    assert.equal((await hiv('GET', 'foto', { query: { id: fotoId, t: fotoUrl.split('&t=')[1] } })).status, 404, 'KV nelkul nincs kep');

    // a szalon elonezete (kiallit-tokennel): a kiallitas elott is megnezheto
    const e = await hiv('GET', 'elonezet', { query: { pi: r.adat.pi, t }, env });
    assert.equal(e.status, 200);
    assert.ok(e.body.includes('Előnézet a szalonnak') && e.body.includes('ak-t-krem'));
    assert.equal((await hiv('GET', 'elonezet', { query: { pi: r.adat.pi, t: await kartyaToken(env, r.adat.pi) }, env })).status, 403, 'a kartya-token nem jo elonezethez');
  });

  test('/fizetes + szemelyre szabas: ervenytelen adatok 400 (design, idezet, nev, foto-id, szemelyre szabas szemelyes atvetelnel)', async () => {
    const env = { ...ENV, AJANDEK_FOTOK: ujKv() };
    const jo = { tema: 'smaragd', idezet: 'Szia', nev: 'Anna' };
    const proba = async (extra) => hiv('POST', 'fizetes', { env, body: rendelesTorzs(extra) });
    for (const [extra, mezo] of [
      [{ atvetel: 'otthon', szemelyre: { ...jo, tema: 'nincs-ilyen' } }, 'szemelyre.tema'],
      [{ atvetel: 'otthon', szemelyre: { ...jo, idezet: 'x'.repeat(161) } }, 'szemelyre.idezet'],
      [{ atvetel: 'otthon', szemelyre: { ...jo, nev: 'x'.repeat(41) } }, 'szemelyre.nev'],
      [{ atvetel: 'otthon', szemelyre: { ...jo, foto_id: 'rovid' } }, 'szemelyre.foto'],
      [{ atvetel: 'szemelyesen', szemelyre: jo }, 'szemelyre'],
      [{ szemelyre: jo }, 'szemelyre'],
      [{ atvetel: 'posta' }, 'atvetel'],
    ]) {
      const r = await proba(extra);
      assert.equal(r.status, 400, JSON.stringify(extra));
      assert.ok(mezo in r.adat.mezok, `${mezo}: ${JSON.stringify(r.adat.mezok)}`);
    }
    // olyan foto-id, ami nincs a tarolban (lejart / kitalalt)
    const nincs = await proba({ atvetel: 'otthon', szemelyre: { ...jo, foto_id: 'A'.repeat(24) } });
    assert.equal(nincs.status, 400);
    assert.ok(nincs.adat.mezok.foto);
    // KV nelkul a foto-id sem jo
    const kvNelkul = await hiv('POST', 'fizetes', { body: rendelesTorzs({ atvetel: 'otthon', szemelyre: { ...jo, foto_id: 'A'.repeat(24) } }) });
    assert.equal(kvNelkul.status, 503);
  });

  test('szemelyre szabas nelkul (otthon, de semmit nem adott meg) es szemelyes atvetelnel a MOSAIC klasszikus kartyaja jar; a szalon levele az atvetelt jelzi', async () => {
    _korlatAlaphelyzet();
    const otthon = await hiv('POST', 'fizetes', { body: rendelesTorzs({ atvetel: 'otthon' }) });
    assert.equal(otthon.status, 200);
    assert.equal(mock.allapot.pi(otthon.adat.pi).metadata.atvetel, 'otthon');
    assert.equal(mock.allapot.pi(otthon.adat.pi).metadata.kartya_tema, undefined);
    const szem = await hiv('POST', 'fizetes', { body: rendelesTorzs({ atvetel: 'szemelyesen' }) });
    assert.equal(szem.status, 200);
    assert.equal(mock.allapot.pi(szem.adat.pi).metadata.atvetel, 'szemelyesen');
    mock.allapot.sikeresIt(szem.adat.pi, { mod: 'card' });
    levelek = [];
    await webhook(alairtEsemeny(szem.adat.pi));
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.ok(szalon.html.includes('Személyesen, a szalonban'));
    assert.ok(!szalon.html.includes('Kártya-design'));
    const t = await kiallitToken(ENV, szem.adat.pi);
    assert.equal((await kiallitPost(szem.adat.pi, t)).status, 200);
    const k = await hiv('GET', 'kartya', { query: { pi: szem.adat.pi, t: await kartyaToken(ENV, szem.adat.pi) } });
    assert.ok(k.body.includes('kartya-hatter.jpg'));
    assert.equal((await hiv('GET', 'elonezet', { query: { pi: szem.adat.pi, t } })).status, 404, 'nincs mit elonezni');
  });

  test('/atutalas + szemelyre szabas: a rekord metadata-ja, a szalon levele az elonezet linkjevel, a nev a tervezobol; a Salonic-link nameTo-ja a tervezo neve', async () => {
    const kv = ujKv();
    const env = { ...ENV, AJANDEK_FOTOK: kv };
    _korlatAlaphelyzet();
    const f = await hiv('POST', 'foto', { body: { kep: jpegAdat() }, env });
    levelek = [];
    const r = await hiv('POST', 'atutalas', { env, body: { ...rendelesTorzs({
      termek: 'egyeni', telefon: '+36 30 123 4567', atvetel: 'otthon',
      szemelyre: { tema: 'homok', idezet: 'Pihenj egy jót!', nev: 'Nagy Mária', foto_id: f.adat.id, foto_poz: '50,50,1' },
    }), kulcs: undefined } });
    assert.equal(r.status, 200, r.body);
    const pi = atuPi(r.adat.rendeles_ref);
    assert.equal(pi.metadata.atvetel, 'otthon');
    assert.equal(pi.metadata.kartya_tema, 'homok');
    assert.equal(pi.metadata.szemelyre_nev, 'Nagy Mária');
    assert.equal(pi.metadata.foto_id, f.adat.id);
    assert.equal(kv.t.get('foto:' + f.adat.id).ttl, 400 * NAP);
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.ok(szalon.html.includes('Homok') && szalon.html.includes('Pihenj egy jót!') && szalon.html.includes('/api/ajandek/elonezet?pi='));
    const salonic = /href="https:\/\/app\.salonic\.hu[^"]+#mosaic=([^"]+)"/.exec(szalon.html);
    assert.equal(JSON.parse(decodeURIComponent(salonic[1].replace(/&#39;/g, "'"))).nameTo, 'Nagy Mária');
    // a kiallito oldal es az elonezet (kod nelkul, utalasnal a kod a kiallitaskor kerul ra)
    const t = await kiallitToken(env, pi.id);
    const g = await hiv('GET', 'kiallit', { query: { pi: pi.id, t }, env });
    assert.ok(g.body.includes('Kártya-design') && g.body.includes('Homok'));
    const e = await hiv('GET', 'elonezet', { query: { pi: pi.id, t }, env });
    assert.equal(e.status, 200);
    assert.ok(e.body.includes('A KÓD KIÁLLÍTÁSKOR KERÜL RÁ') && e.body.includes('ak-t-homok'));
    // kiallitas -> a vevo kartyaja a szemelyre szabott
    assert.equal((await kiallitPost(pi.id, t, { kod: 'GYOR2000', env })).status, 200);
    const k = await hiv('GET', 'kartya', { query: { pi: pi.id, t: await kartyaToken(env, pi.id) }, env });
    assert.ok(k.body.includes('ak-t-homok') && k.body.includes('GYOR2000') && k.body.includes('Nagy Mária'));
  });
});

// --- visszaeles elleni vedelem ---------------------------------------------------------------------------------------------
describe('visszaeles-vedelem (/fizetes, /szemelyre, /atutalas)', () => {
  const VEDETT = ['fizetes', 'szemelyre', 'atutalas'];
  const csapda = () => rendelesTorzs({ 'bot-field': 'x' }); // a robotcsapda nem hiv Stripe-ot es nem kuld levelet

  test('csak application/json torzs: mas content-type -> 415 (es semmi nem tortenik)', async () => {
    levelek = [];
    const elotte = mock.allapot.pik.size;
    for (const ut of VEDETT) {
      for (const tipus of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', '', 'application/jsonx']) {
        const r = await hiv('POST', ut, { body: rendelesTorzs(), headers: { 'content-type': tipus } });
        assert.equal(r.status, 415, `${ut} ${tipus}`);
        assert.deepEqual(r.adat, { hiba: 'tipus' });
      }
      const r = await hiv('POST', ut, { body: csapda(), headers: { 'content-type': 'Application/JSON; charset=utf-8' } });
      assert.notEqual(r.status, 415, ut);
    }
    assert.equal(mock.allapot.pik.size, elotte);
    assert.equal(levelek.length, 0);
  });

  test('kulso oldalrol inditott keres (Origin mas host / null, Sec-Fetch-Site: cross-site) -> 403', async () => {
    for (const ut of VEDETT) {
      for (const fejlec of [
        { origin: 'https://gonosz.example' },
        { origin: 'https://teszt.mosaicheadspa.hu.gonosz.example' },
        { origin: 'null' },
        { origin: 'nem-url' },
        { 'sec-fetch-site': 'cross-site' },
        { origin: BAZIS, 'sec-fetch-site': 'cross-site' },
      ]) {
        const r = await hiv('POST', ut, { body: csapda(), headers: fejlec });
        assert.equal(r.status, 403, `${ut} ${JSON.stringify(fejlec)}`);
        assert.deepEqual(r.adat, { hiba: 'tiltott' });
      }
      // sajat oldal (azonos host), vagy Origin nelkul (pl. regi bongeszo): mehet
      // (a /szemelyre-n valodi, fizetett rendelessel: ott a kapu utan a client_secret is kell)
      const torzs = ut === 'szemelyre'
        ? await fizetettRendeles().then((a) => ({ pi: a.pi, cs: a.client_secret, nev: 'Anna' }))
        : csapda();
      for (const fejlec of [{ origin: BAZIS, 'sec-fetch-site': 'same-origin' }, { origin: 'http://teszt.mosaicheadspa.hu' }, {}, { 'sec-fetch-site': 'same-site' }]) {
        const r = await hiv('POST', ut, { body: torzs, headers: fejlec });
        assert.equal(r.status, 200, `${ut} ${JSON.stringify(fejlec)}`);
      }
    }
  });

  test('kereskorlat IP-nkent: /fizetes 20 / 10 perc -> 429 + retry-after; masik IP es a kovetkezo ablak mehet', async () => {
    _korlatAlaphelyzet();
    const t0 = new Date('2026-10-03T10:00:00Z');
    const ip = { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' };
    for (let i = 0; i < 20; i++) assert.equal((await hiv('POST', 'fizetes', { body: csapda(), headers: ip, most: t0 })).status, 200, `#${i + 1}`);
    const r = await hiv('POST', 'fizetes', { body: csapda(), headers: ip, most: new Date(t0.getTime() + 60 * 1000) });
    assert.equal(r.status, 429);
    assert.deepEqual(r.adat, { hiba: 'tul_sok_keres' });
    assert.equal(r.headers['retry-after'], '540');
    // ugyanaz az IP (az x-forwarded-for elso eleme szamit) mas proxy-lanccal is korlatozva
    assert.equal((await hiv('POST', 'fizetes', { body: csapda(), headers: { 'x-forwarded-for': '203.0.113.7' }, most: t0 })).status, 429);
    // masik IP mehet; a mas vegpontok szamlaloja kulon el
    assert.equal((await hiv('POST', 'fizetes', { body: csapda(), headers: { 'x-forwarded-for': '203.0.113.8' }, most: t0 })).status, 200);
    assert.equal((await hiv('POST', 'szemelyre', { body: {}, headers: ip, most: t0 })).status, 403);
    // 10 perc utan uj ablak
    assert.equal((await hiv('POST', 'fizetes', { body: csapda(), headers: ip, most: new Date(t0.getTime() + 10 * 60 * 1000) })).status, 200);
    _korlatAlaphelyzet();
  });

  test('kereskorlat: /szemelyre 30 / 10 perc; az IP forrasa: ip parameter > cf-connecting-ip > x-nf-client-connection-ip > x-forwarded-for', async () => {
    _korlatAlaphelyzet();
    const t0 = new Date('2026-10-03T11:00:00Z');
    for (let i = 0; i < 30; i++) {
      // a cf-connecting-ip szamit, a (hamisithato) x-forwarded-for valtozhat
      const r = await hiv('POST', 'szemelyre', { body: {}, headers: { 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': veletlenIp() }, most: t0 });
      assert.equal(r.status, 403, `#${i + 1}`);
    }
    assert.equal((await hiv('POST', 'szemelyre', { body: {}, headers: { 'cf-connecting-ip': '198.51.100.9' }, most: t0 })).status, 429);
    // az adapter altal adott ip parameter elsobbseget elvez a fejlecekkel szemben
    for (let i = 0; i < 3; i++) {
      const r = await hiv('POST', 'atutalas', { body: csapda(), ip: '192.0.2.50', headers: { 'cf-connecting-ip': veletlenIp(), 'x-nf-client-connection-ip': veletlenIp() }, most: t0 });
      assert.equal(r.status, 200);
    }
    assert.equal((await hiv('POST', 'atutalas', { body: csapda(), ip: '192.0.2.50', headers: { 'cf-connecting-ip': veletlenIp() }, most: t0 })).status, 429);
    _korlatAlaphelyzet();
  });

  test('/atutalas: 3 / 10 perc IP-nkent, es a peldanyon osszesen 30 / ora', async () => {
    _korlatAlaphelyzet();
    levelek = [];
    const t0 = new Date('2026-10-03T12:00:00Z');
    const ip = (n) => ({ 'x-forwarded-for': `192.0.2.${n}` });
    for (let i = 0; i < 3; i++) assert.equal((await hiv('POST', 'atutalas', { body: csapda(), headers: ip(1), most: t0 })).status, 200);
    let r = await hiv('POST', 'atutalas', { body: csapda(), headers: ip(1), most: t0 });
    assert.equal(r.status, 429);
    assert.equal(r.headers['retry-after'], '600');
    // tovabbi 27 kulonbozo IP-rol -> osszesen 30
    for (let i = 0; i < 27; i++) assert.equal((await hiv('POST', 'atutalas', { body: csapda(), headers: ip(10 + i), most: t0 })).status, 200, `#${i}`);
    r = await hiv('POST', 'atutalas', { body: csapda(), headers: ip(99), most: new Date(t0.getTime() + 5 * 60 * 1000) });
    assert.equal(r.status, 429, 'a peldany-szintu felso korlat');
    assert.equal(r.headers['retry-after'], String(55 * 60));
    // egy ora mulva ujra mehet
    assert.equal((await hiv('POST', 'atutalas', { body: csapda(), headers: ip(99), most: new Date(t0.getTime() + 61 * 60 * 1000) })).status, 200);
    assert.equal(levelek.length, 0, 'a robotcsapda nem kuldott levelet');
    _korlatAlaphelyzet();
  });

  test('a szamlalo-tabla kicsi marad (sok kulonbozo IP)', async () => {
    _korlatAlaphelyzet();
    const t0 = new Date('2026-10-03T13:00:00Z');
    for (let i = 0; i < 6000; i++) {
      await ajandekKezel({ method: 'POST', url: BAZIS + '/api/ajandek/fizetes', headers: { 'content-type': 'application/json' }, text: '{"bot-field":"x"}', env: ENV, ip: `ip-${i}`, most: t0 });
    }
    const { _korlatMeret } = await import('../../netlify/lib/ajandek.js');
    assert.ok(_korlatMeret() <= 5000, String(_korlatMeret()));
    // a legujabb IP-k szamlaloja megvan: a 20. keres utan korlatoz
    for (let i = 0; i < 19; i++) await ajandekKezel({ method: 'POST', url: BAZIS + '/api/ajandek/fizetes', headers: { 'content-type': 'application/json' }, text: '{"bot-field":"x"}', env: ENV, ip: 'ip-5999', most: t0 });
    const v = await ajandekKezel({ method: 'POST', url: BAZIS + '/api/ajandek/fizetes', headers: { 'content-type': 'application/json' }, text: '{"bot-field":"x"}', env: ENV, ip: 'ip-5999', most: t0 });
    assert.equal(v.status, 429);
    _korlatAlaphelyzet();
  });
});

// --- /rendeles csak olvaso tokennel ------------------------------------------------------------------------------------------
describe('/rendeles?rt= (csak olvaso token)', () => {
  test('rt jo -> 200, ugyanaz a valasz, mint cs-sel; rossz / mas celu / mas PI-hez tartozo rt -> 403', async () => {
    const a = await fizetettRendeles();
    const rt = await rendelesToken(ENV, a.pi);
    const r = await hiv('GET', 'rendeles', { query: { pi: a.pi, rt } });
    assert.equal(r.status, 200);
    const cs = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
    assert.deepEqual(r.adat, cs.adat);
    assert.equal(r.adat.allapot, 'fizetve');
    assert.ok(!r.body.includes(a.client_secret), 'a valasz nem adja ki a client_secret-et');
    const masik = await fizetettRendeles();
    for (const query of [
      { pi: a.pi, rt: rt.replace(/^./, (c) => (c === '0' ? '1' : '0')) },
      { pi: a.pi, rt: await rendelesToken(ENV, masik.pi) },
      { pi: a.pi, rt: await kartyaToken(ENV, a.pi) },
      { pi: a.pi, rt: await kiallitToken(ENV, a.pi) },
      { pi: a.pi, rt: 'abc' },
      { pi: masik.pi, rt },
      { rt },
    ]) {
      const x = await hiv('GET', 'rendeles', { query });
      assert.equal(x.status, 403, JSON.stringify(query));
      assert.deepEqual(x.adat, { hiba: 'tiltott' });
    }
    // az rt nem kartya-token es nem kiallito token
    assert.equal((await hiv('GET', 'kartya', { query: { pi: a.pi, t: rt } })).status, 403);
    assert.equal((await hiv('GET', 'kiallit', { query: { pi: a.pi, t: rt } })).status, 403);
  });

  test('az rt a /szemelyre-hez es a /fizetes-hez NEM jo', async () => {
    const a = await fizetettRendeles();
    const rt = await rendelesToken(ENV, a.pi);
    for (const body of [{ pi: a.pi, rt, nev: 'Betolakodo' }, { pi: a.pi, cs: rt, nev: 'Betolakodo' }]) {
      const r = await hiv('POST', 'szemelyre', { body });
      assert.equal(r.status, 403);
    }
    assert.equal(mock.allapot.pi(a.pi).metadata.szemelyre_nev, 'Kiss Anna'); // a rendeleskor megadott nev valtozatlan
    // nyitott PI: az rt-vel nem lehet a meglevo PI-t modositani (uj PI jon letre)
    const b = await ujRendeles();
    const brt = await rendelesToken(ENV, b.pi);
    const f = await hiv('POST', 'fizetes', { body: rendelesTorzs({ termek: 'paros', pi: b.pi, cs: brt, rt: brt }) });
    assert.equal(f.status, 200);
    assert.notEqual(f.adat.pi, b.pi);
    assert.equal(mock.allapot.pi(b.pi).amount, 2690000);
  });
});

// --- visszaterites / vita -----------------------------------------------------------------------------------------------------
function alairtTorzs(obj, tipus, titok = WHSEC) {
  const torzs = JSON.stringify({ id: 'evt_' + crypto.randomUUID().replace(/-/g, ''), object: 'event', type: tipus, data: { object: obj } });
  const ts = Math.floor(Date.now() / 1000);
  return { torzs, fejlec: `t=${ts},v1=${crypto.createHmac('sha256', titok).update(`${ts}.${torzs}`).digest('hex')}` };
}

describe('visszaterites / vita (chargeback)', () => {
  test('visszaterites: kartya.allapot visszavonva (kod es url nelkul), /kartya 409, a kiallitas tiltva', async () => {
    const a = await fizetettRendeles();
    const alap = { pi: a.pi, cs: a.client_secret };
    let r = await hiv('GET', 'rendeles', { query: alap });
    assert.equal(r.adat.visszavonva, false);
    // kiallitas, majd visszaterites
    assert.equal((await kiallitPost(a.pi, await kiallitToken(ENV, a.pi))).status, 200);
    assert.equal((await hiv('GET', 'rendeles', { query: alap })).adat.kartya.allapot, 'kesz');
    mock.allapot.visszaterites(a.pi);
    r = await hiv('GET', 'rendeles', { query: alap });
    assert.equal(r.status, 200);
    assert.equal(r.adat.allapot, 'fizetve');
    assert.equal(r.adat.visszavonva, true);
    assert.deepEqual(Object.keys(r.adat.kartya).sort(), ['allapot', 'ervenyes_ig']);
    assert.equal(r.adat.kartya.allapot, 'visszavonva');
    assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    assert.doesNotMatch(r.body, /api\/ajandek\/kartya/);
    // a kartya-oldal (t es cs) 409 barati oldal, kod nelkul
    for (const query of [{ pi: a.pi, t: await kartyaToken(ENV, a.pi) }, alap]) {
      const k = await hiv('GET', 'kartya', { query });
      assert.equal(k.status, 409);
      assert.match(k.body, /visszatérítés\/vita tartozik, a kártya nem használható/);
      assert.doesNotMatch(k.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    }
    // szemelyre szabas sem
    assert.equal((await hiv('POST', 'szemelyre', { body: { ...alap, nev: 'X' } })).status, 409);
  });

  test('reszleges visszaterites es vita is visszavon; a kiallitas (GET/POST) nem allit ki visszavont rendelest', async () => {
    const a = await fizetettRendeles();
    mock.allapot.visszaterites(a.pi, { osszeg: 100000 });
    let r = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
    assert.equal(r.adat.visszavonva, true);
    assert.equal(r.adat.kartya.allapot, 'visszavonva');
    const b = await fizetettRendeles();
    mock.allapot.vita(b.pi);
    r = await hiv('GET', 'rendeles', { query: { pi: b.pi, rt: await rendelesToken(ENV, b.pi) } });
    assert.equal(r.adat.visszavonva, true);
    levelek = [];
    const t = await kiallitToken(ENV, b.pi);
    const g = await hiv('GET', 'kiallit', { query: { pi: b.pi, t } });
    assert.equal(g.status, 409);
    assert.doesNotMatch(g.body, /<form/);
    const p = await kiallitPost(b.pi, t);
    assert.equal(p.status, 409);
    assert.equal(levelek.length, 0);
    assert.equal(mock.allapot.pi(b.pi).metadata.kartya_kesz, undefined);
    // a sikeres fizetes esemenye mar visszavont rendelesnel nem kuld sikerlevelet
    assert.equal((await webhook(alairtEsemeny(b.pi))).status, 200);
    assert.equal(levelek.length, 0);
  });

  test('webhook charge.refunded -> EGY szalon-level "toroljek a kuponkodot", ketszeri kezbesitesnel is', async () => {
    const a = await fizetettRendeles({ termek: 'paros' });
    await webhook(alairtEsemeny(a.pi));
    await kiallitPost(a.pi, await kiallitToken(ENV, a.pi));
    const ch = mock.allapot.visszaterites(a.pi);
    levelek = [];
    const e = alairtTorzs(ch, 'charge.refunded');
    assert.equal((await webhook(e)).status, 200);
    assert.equal((await webhook(e)).status, 200);
    assert.equal((await webhook(alairtTorzs(ch, 'charge.refunded'))).status, 200);
    assert.equal(levelek.length, 1);
    const kod = await kuponKod(ENV, a.pi);
    const l = levelek[0];
    assert.equal(l.cimzett, 'szalon');
    assert.equal(l.targy, `Visszatérítés / vita – töröld a kuponkódot: ${kod}`);
    assert.ok(l.html.includes(kod));
    assert.ok(l.html.includes(a.rendeles_id));
    assert.ok(l.html.includes('Páros Head Spa'));
    assert.ok(l.html.includes('53.800 Ft'));
    assert.match(l.html, /visszatérítés/);
    assert.match(l.html, /már megkapta/);
    const md = mock.allapot.pi(a.pi).metadata;
    assert.equal(md.visszavonas_ertesites, '1');
    assert.equal(md.visszavonva, 'visszaterites');
  });

  test('webhook charge.dispute.created (PI-vel, vagy csak charge-dzsal) -> szalon-level a vitarol', async () => {
    const a = await fizetettRendeles();
    const dp = mock.allapot.vita(a.pi);
    levelek = [];
    assert.equal((await webhook(alairtTorzs(dp, 'charge.dispute.created'))).status, 200);
    assert.equal(levelek.length, 1);
    assert.match(levelek[0].html, /vitát \(chargeback\)/);
    assert.equal(mock.allapot.pi(a.pi).metadata.visszavonva, 'vita');
    // regebbi vita-objektum: csak a charge azonosito -> a terhelesbol keressuk vissza a PI-t
    const b = await fizetettRendeles();
    const dp2 = mock.allapot.vita(b.pi);
    delete dp2.payment_intent;
    assert.equal((await webhook(alairtTorzs(dp2, 'charge.dispute.created'))).status, 200);
    assert.equal(levelek.length, 2);
    assert.ok(levelek[1].html.includes(await kuponKod(ENV, b.pi)));
  });

  test('idegen PI, vagy a Stripe szerint nem visszaterített terheles -> nincs level; levelkuldesi hiba -> 500, ujrakuldeskor egyszer', async () => {
    levelek = [];
    const v = await fetch(mock.url + '/v1/payment_intents', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + ENV.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'amount=1000000&currency=huf&metadata[forras]=fizetolink',
    });
    const idegen = await v.json();
    mock.allapot.sikeresIt(idegen.id);
    const ich = mock.allapot.visszaterites(idegen.id);
    assert.equal((await webhook(alairtTorzs(ich, 'charge.refunded'))).status, 200);
    // az esemeny visszateritest allit, de a Stripe-tol visszakerdezett terheles nem az
    const a = await fizetettRendeles();
    const ch = mock.allapot.charge(mock.allapot.pi(a.pi).latest_charge);
    assert.equal((await webhook(alairtTorzs({ ...ch, refunded: true, amount_refunded: ch.amount }, 'charge.refunded'))).status, 200);
    assert.equal(levelek.length, 0);
    assert.equal(mock.allapot.pi(a.pi).metadata.visszavonas_ertesites, undefined);
    // kuldesi hiba
    mock.allapot.visszaterites(a.pi);
    const e = alairtTorzs(mock.allapot.charge(ch.id), 'charge.refunded');
    assert.equal((await webhook(e, { kuld: async () => { throw new Error('SMTP le'); } })).status, 500);
    assert.equal(mock.allapot.pi(a.pi).metadata.visszavonas_ertesites, undefined);
    assert.equal((await webhook(e)).status, 200);
    assert.equal((await webhook(e)).status, 200);
    assert.equal(levelek.length, 1);
  });
});

// --- AJANDEK_TITOK kotelezo ------------------------------------------------------------------------------------------------------
describe('AJANDEK_TITOK kotelezo (legalabb 32 karakter, fail closed)', () => {
  test('hianyzo vagy rovid titok: mod nincs; fizetes/rendeles/webhook 503 JSON; kiallit/kartya 503 HTML; nincs SHA-256(sk) tartalek', async () => {
    const a = await fizetettRendeles();
    const jo = { pi: a.pi, cs: a.client_secret };
    const kt = await kartyaToken(ENV, a.pi);
    const it = await kiallitToken(ENV, a.pi);
    for (const titok of [undefined, '', 'rovid', 'x'.repeat(31), ' '.repeat(40)]) {
      const env = { ...ENV, AJANDEK_TITOK: titok };
      const cimke = JSON.stringify(titok);
      assert.deepEqual((await hiv('GET', 'beallitas', { env })).adat, { mod: 'nincs', publikus_kulcs: null, azonnali_kartya: false, foto: false }, cimke);
      let r = await hiv('POST', 'fizetes', { body: rendelesTorzs(), env });
      assert.equal(r.status, 503, cimke);
      assert.deepEqual(r.adat, { hiba: 'nincs_beallitva' });
      r = await hiv('GET', 'rendeles', { query: jo, env });
      assert.equal(r.status, 503, cimke);
      assert.deepEqual(r.adat, { hiba: 'nincs_beallitva' });
      assert.equal((await hiv('GET', 'rendeles', { query: { pi: a.pi, rt: 'a'.repeat(64) }, env })).status, 503);
      assert.equal((await hiv('POST', 'szemelyre', { body: { ...jo, nev: 'X' }, env })).status, 503);
      r = await webhook(alairtEsemeny(a.pi), { env });
      assert.equal(r.status, 503, cimke);
      assert.deepEqual(r.adat, { hiba: 'nincs_beallitva' });
      for (const [m, ut, opciok] of [
        ['GET', 'kiallit', { query: { pi: a.pi, t: it } }],
        ['GET', 'kartya', { query: { pi: a.pi, t: kt } }],
        ['GET', 'kartya', { query: jo }],
      ]) {
        r = await hiv(m, ut, { ...opciok, env });
        assert.equal(r.status, 503, `${ut} ${cimke}`);
        assert.match(r.headers['content-type'], /text\/html/);
      }
      r = await kiallitPost(a.pi, it, { env });
      assert.equal(r.status, 503);
      await assert.rejects(kuponKod(env, a.pi), /AJANDEK_TITOK/);
      await assert.rejects(kartyaToken(env, a.pi), /AJANDEK_TITOK/);
    }
    // pontosan 32 karakter mar eleg
    assert.equal((await hiv('GET', 'beallitas', { env: { ...ENV, AJANDEK_TITOK: 'y'.repeat(32) } })).adat.mod, 'teszt');
    // az atutalas is a Stripe-rekordra es a titok-fuggo kiallito linkre epul: titok nelkul nem megy
    assert.equal((await hiv('POST', 'atutalas', { body: rendelesTorzs({ telefon: '+36 20 123 4567' }), env: { ...ENV, AJANDEK_TITOK: '' } })).status, 503);
  });
});

// --- metadata-iras levelenkent (dupla level ellen) -----------------------------------------------------------------------------
describe('metadata-iras minden level utan (nincs dupla level)', () => {
  test('webhook: a szalon-level utan mar rogzitve van a reszallapot, mielott a vevo-level kimegy', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const allapotKuldeskor = [];
    const r = await webhook(alairtEsemeny(a.pi), {
      kuld: async (l) => { allapotKuldeskor.push([l.cimzett, mock.allapot.pi(a.pi).metadata.ertesites]); levelek.push(l); },
    });
    assert.equal(r.status, 200);
    assert.deepEqual(allapotKuldeskor, [['szalon', undefined], ['vevo@example.com', 'szalon']]);
    assert.equal(mock.allapot.pi(a.pi).metadata.ertesites, '1');
    assert.ok(mock.allapot.pi(a.pi).metadata.kod, 'a kod mar a levelek elott rogzitve');
  });

  test('webhook: ha a levelek kimentek, de a metadata-iras hibazik -> naplo + 200 (nem 500, ne kuldje ujra a Stripe)', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    mock.allapot.hibaSzabaly((k) => (k.method === 'POST' && k.params.metadata && k.params.metadata.ertesites ? 500 : 0));
    try {
      const r = await webhook(alairtEsemeny(a.pi));
      assert.equal(r.status, 200);
      assert.equal(levelek.length, 2);
    } finally {
      mock.allapot.hibaSzabaly(null);
    }
  });

  test('webhook: ha mar az elozetes (kod) rogzites hibazik -> 502 es egyetlen level sem megy ki', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    mock.allapot.hibaSzabaly((k) => (k.method === 'POST' && k.params.metadata && k.params.metadata.kod ? 500 : 0));
    try {
      const r = await webhook(alairtEsemeny(a.pi));
      assert.equal(r.status, 502);
      assert.deepEqual(r.adat, { hiba: 'stripe' });
      assert.equal(levelek.length, 0);
    } finally {
      mock.allapot.hibaSzabaly(null);
    }
    assert.equal((await webhook(alairtEsemeny(a.pi))).status, 200);
    assert.equal(levelek.length, 2);
  });

  test('kiallit: a jelzo a level ELOTT all be; amig friss, ujabb POST/GET nem kuld (folyamatban oldal); 15 perc utan ujra lehet', async () => {
    const a = await fizetettRendeles();
    const t = await kiallitToken(ENV, a.pi);
    levelek = [];
    const t0 = new Date('2026-10-03T14:00:00Z');
    // 1) a level kuldesekor a jelzo mar a metadataban van; a vegso rogzites (mindket probalkozas) hibazik
    mock.allapot.hibaSzabaly((k) => (k.method === 'POST' && k.params.metadata && k.params.metadata.kartya_kesz ? 500 : 0));
    let jelzoKuldeskor = null;
    let r;
    try {
      r = await kiallitPost(a.pi, t, { most: t0, kuld: async (l) => { jelzoKuldeskor = mock.allapot.pi(a.pi).metadata.kiallitas_folyamatban; levelek.push(l); } });
    } finally {
      mock.allapot.hibaSzabaly(null);
    }
    assert.equal(jelzoKuldeskor, t0.toISOString());
    assert.equal(r.status, 502);
    assert.match(r.body, /A levél kiment, de a kiállítást nem sikerült rögzíteni/);
    assert.equal(levelek.length, 1);
    // 2) azonnal ujra (dupla kattintas / parhuzamos keres): nincs uj level
    const t1 = new Date(t0.getTime() + 2 * 60 * 1000);
    r = await kiallitPost(a.pi, t, { most: t1 });
    assert.equal(r.status, 409);
    assert.match(r.body, /A kiállítás folyamatban van/);
    const g = await hiv('GET', 'kiallit', { query: { pi: a.pi, t }, most: t1 });
    assert.equal(g.status, 409);
    assert.doesNotMatch(g.body, /<form/);
    assert.equal(levelek.length, 1);
    // 3) 15 perc utan a beragadt jelzo nem blokkol tovabb: ujra kiallithato (a vevo meg egy levelet kap)
    const t2 = new Date(t0.getTime() + 16 * 60 * 1000);
    assert.match((await hiv('GET', 'kiallit', { query: { pi: a.pi, t }, most: t2 })).body, /<form/);
    r = await kiallitPost(a.pi, t, { most: t2 });
    assert.equal(r.status, 200);
    assert.equal(levelek.length, 2);
    const md = mock.allapot.pi(a.pi).metadata;
    assert.equal(md.kartya_kesz, '1');
    assert.equal(md.kiallitas_folyamatban, undefined);
  });

  test('kiallit: levelkuldesi hiba -> a jelzo torlodik, azonnal ujra lehet probalni', async () => {
    const a = await fizetettRendeles();
    const t = await kiallitToken(ENV, a.pi);
    levelek = [];
    const r = await kiallitPost(a.pi, t, { kuld: async () => { throw new Error('SMTP le'); } });
    assert.equal(r.status, 502);
    assert.equal(mock.allapot.pi(a.pi).metadata.kiallitas_folyamatban, undefined);
    assert.equal((await kiallitPost(a.pi, t)).status, 200);
    assert.equal(levelek.length, 1);
  });
});

// --- kuponkod ------------------------------------------------------------------------------------------------------------------
describe('kuponkod', () => {
  test('determinisztikus, AK-XXXX-XXXX Crockford, az AJANDEK_TITOK HMAC-javal', async () => {
    const k1 = await kuponKod(ENV, 'pi_3UMSqdTesztAzonosito');
    assert.equal(k1, await kuponKod(ENV, 'pi_3UMSqdTesztAzonosito'));
    assert.match(k1, KOD_RE);
    assert.equal(k1, vartKod(TITOK, 'pi_3UMSqdTesztAzonosito'));
    assert.notEqual(k1, await kuponKod(ENV, 'pi_3UMSqdMasikAzonosito'));
    assert.notEqual(k1, await kuponKod({ ...ENV, AJANDEK_TITOK: TITOK + 'x' }, 'pi_3UMSqdTesztAzonosito'));
    for (let i = 0; i < 200; i++) assert.match(await kuponKod(ENV, 'pi_' + i.toString(36).padStart(10, 'x')), KOD_RE);
  });
});

describe('kartya-sablon: FEKVO, felbehajtott A4 (2026-10-04)', () => {
  const K = globalThis.AJANDEK_KARTYA;
  const minta = { tema: 'krem', idezet: 'Ez a személyes idézet', nev: 'Nagy Mária', fotoSrc: null, felirat: ['50+30 perces egyéni MOSAIC', 'HEAD SPA KEZELÉS'], ertek: '26.900 Ft', kod: 'AK-TEST-0001', ervenyes: '2027. április 4.', minta: false };

  test('az A4-es lapon ket fekvo lap van: felul a hatoldal (180 fokkal elforgatva), alul az elolap; a lapok aranya a felbehajtott A4 (794 : 561,5)', () => {
    const h = K.html(minta);
    assert.ok(h.includes('class="ak-lap"'));
    assert.ok(h.indexOf('ak-hat') < h.indexOf('ak-elol'), 'a hatoldal van felul');
    assert.match(K.CSS, /\.ak-lap>\.ak-hat\{transform:rotate\(180deg\)\}/);
    assert.match(K.CSS, /aspect-ratio:794\/561\.5/);
    // az elolap a szemelyre szabott resz, a hatoldal az adatok
    const elol = K.html({ ...minta, oldal: 'elol' }), hat = K.html({ ...minta, oldal: 'hat' });
    assert.ok(elol.includes('ak-elol') && !elol.includes('ak-hat') && elol.includes('Ez a személyes idézet') && elol.includes('Nagy Mária') && !elol.includes('AK-TEST-0001'));
    assert.ok(hat.includes('ak-hat') && !hat.includes('ak-elol') && hat.includes('AK-TEST-0001') && hat.includes('26.900 Ft') && hat.includes('2027. április 4.') && !hat.includes('Ez a személyes idézet'));
  });

  test('KEPES dizajn (smaragd, a tulajdonos terve): sajat aranyu lap, szovegmentes hatterkepek, a fotohely az ivben, a szovegek a biztonsagos teruleten', () => {
    const t = K.tema('smaragd');
    assert.ok(t && t.hatter && t.w === 1491 && t.h === 1055, 'a smaragd a feltoltott terv (1491 x 1055, A5 vaszon)');
    for (const fajl of [t.hatter.elol, t.hatter.hat]) {
      const ut = new URL('../../' + fajl.replace(/^\//, ''), import.meta.url);
      assert.ok(fs.existsSync(ut), fajl + ' letezik');
      assert.ok(fs.statSync(ut).size < 400 * 1024, fajl + ' kicsi (< 400 KB)');
    }
    const h = K.html({ ...minta, tema: 'smaragd' });
    assert.ok(h.includes('aspect-ratio:1491/1055'), 'a lap sajat aranyu');
    assert.ok(h.indexOf('ak-hat') < h.indexOf('ak-elol') && h.includes('kartya-smaragd-elol-a5.jpg') && h.includes('kartya-smaragd-hat-a5.jpg'));
    const elol = K.html({ ...minta, tema: 'smaragd', oldal: 'elol' }), hat = K.html({ ...minta, tema: 'smaragd', oldal: 'hat' });
    assert.ok(elol.includes('Ez a személyes idézet') && elol.includes('Nagy Mária') && !elol.includes('AK-TEST-0001') && !elol.includes('<small>NEKI</small>'), 'a "NEKI" a hatterkepen van');
    for (const x of ['AK-TEST-0001', '26.900 Ft', '2027. április 4.', '50+30 perces egyéni MOSAIC', 'HEAD SPA KEZELÉS']) assert.ok(hat.includes(x), x);
    // a fotohely a keretiven (a hatterkepen levo vekony arany vonalon) belul van, az ivbe illo: a fele szelessege <= a magassag
    assert.ok(t.kep.alak === 'iv' && t.kep.h >= t.kep.w / 2);
    // az idezet es a nev a fotohelytol jobbra, a hatterkep dobozaiban; egymast nem fedik, a lap szelen belul vannak
    const atfed = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    assert.ok(t.idezet.x >= t.kep.x + t.kep.w && t.nevHely.x >= t.kep.x + t.kep.w);
    assert.ok(!atfed(t.idezet, t.nevHely));
    assert.ok(t.idezet.x + t.idezet.w <= 1325 && t.nevHely.x + t.nevHely.w <= 1325, 'nem er a jobb oldali levelekre / veneres teruletre');
  });

  test('KEPES dizajn: a betumeret a szoveg hosszatol (es a sorok szamatol) fugg, a leghosszabb idezet / nev is belefer a dobozba', () => {
    const t = K.tema('smaragd');
    const px = (html, osztaly) => Number(new RegExp('class="' + osztaly + '"[^>]*font-size:([0-9.]+)cqw').exec(html)[1]) * (t.w / 100);
    const idezetPx = (szoveg) => px(K.html({ ...minta, tema: 'smaragd', idezet: szoveg, oldal: 'elol' }), 'ak-idezet');
    const nevPx = (szoveg) => px(K.html({ ...minta, tema: 'smaragd', nev: szoveg, oldal: 'elol' }), 'ak-nev');
    // folyamatosan csokken
    let elozo = Infinity;
    for (const n of [10, 40, 60, 90, 120, 160]) { const p = idezetPx('a'.repeat(n)); assert.ok(p <= elozo, 'az idezet merete nem no a hosszal'); elozo = p; }
    // becsles: sorszam * sormagassag <= a doboz magassaga, es a karakterszam beleferjen (Playfair italic ~ 0.5 em atlagos szelesseg)
    for (const n of [20, 40, 70, 100, 130, 160]) {
      const p = idezetPx('a'.repeat(n)), sor = Math.floor(t.idezet.h / (p * 1.3)), sorban = Math.floor(t.idezet.w / (p * 0.5));
      assert.ok(sor * sorban >= n * 1.12, n + ' karakter belefer (' + sor + ' sor x ' + sorban + ' karakter, ' + p.toFixed(1) + ' px)');
    }
    // kezi sortores: 6 rovid sor is a legkisebb lepcsot kapja, es a sorok beleferjenek
    assert.equal(idezetPx(['a', 'b', 'c', 'd', 'e'].join(String.fromCharCode(10))), idezetPx('a'.repeat(160)));
    // nev: egy sorban, a doboz szelessegen belul (a leggyakoribb hosszu es a legszelesebb betuk)
    for (const n of [8, 16, 24, 32, 40]) {
      const p = nevPx('n'.repeat(n));
      assert.ok(n * p * 0.5 <= t.nevHely.w * 1.01, n + ' karakteres nev (' + p + ' px)');
      assert.ok(p * 1.15 <= t.nevHely.h, 'a sor magassaga belefer');
    }
    assert.ok(K.CSS.includes('.ak-kepes .ak-nev{') && /white-space:nowrap/.test(K.CSS) && /overflow:hidden/.test(K.CSS));
  });

  test('a szerver-oldal (nyomtato oldal) az A4-es lap felein kozepre igazitja a dizajn sajat aranyu lapjait', async () => {
    const L = await import('../../netlify/lib/ajandek-levelek.js');
    const oldal = L.szemelyreSzabottKartyaOldal({ bazis: 'https://pelda.hu', tema: 'smaragd', idezet: 'Szia', nev: 'Réka', kartya_felirat: ['A', 'B'], ar_szoveg: '26.900 Ft', kod: 'AAAA-BBBB', ervenyes_ig: '2027-04-04' });
    assert.ok(oldal.includes('aspect-ratio:794/1123;grid-template-rows:1fr 1fr;align-items:center') && oldal.includes('.ak-lap>.ak{width:min(100%,calc(70.71cqw * var(--ak-ar,1.4141)))'), 'a ket fel kozepre igazitva, a magasabb lapok is elferjenek');
    assert.ok(oldal.includes('aspect-ratio:1491/1055') && oldal.includes('/assets/img/ajandek/kartya-smaragd-hat-a5.jpg'));
    assert.ok(oldal.includes('Réka') && oldal.includes('AAAA-BBBB'));
  });

  test('minden KEPES dizajn (smaragd, szalag, virag): hatterkepek, alak, szovegdobozok a biztonsagos teruleten, a betumeret-lepcsok a dobozba illenek, a szinek a tervbol', () => {
    const kepesek = K.TEMAK.filter((t) => t.hatter);
    assert.deepEqual(kepesek.map((t) => t.id), ['smaragd', 'szalag', 'virag'], 'a harom feltoltott terv (sorrend: zold, szalag, virag)');
    assert.deepEqual(K.TEMAK.map((t) => t.id), ['smaragd', 'szalag', 'virag', 'krem', 'homok', 'feher'], 'a maradek harom elozetes marad');
    const atfed = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    // MINDEN dizajn A5 fekvo (210 x 148,5 mm): a lapok keparanya azonos, a nyomtato oldal felen pontosan elfer
    for (const t of K.TEMAK) assert.ok(Math.abs((t.w || K.LAP_W) / (t.h || K.LAP_H) - 210 / 148.5) < 0.002, t.id + ' A5 keparany: ' + ((t.w || K.LAP_W) / (t.h || K.LAP_H)).toFixed(4));
    for (const t of kepesek) {
      for (const fajl of [t.hatter.elol, t.hatter.hat]) {
        const ut = new URL('../../' + fajl.replace(/^\//, ''), import.meta.url);
        assert.ok(fs.existsSync(ut) && fs.statSync(ut).size < 400 * 1024, t.id + ': ' + fajl);
        // a JPEG fejlece (SOF) szerinti meret = a dizajn meret: a hatter a feltoltott A5 vaszon, nem vagott, nem nyujtott
        const buf = fs.readFileSync(ut);
        let o = 2, jw = 0, jh = 0;
        while (o < buf.length) { if (buf[o] !== 0xff) { o++; continue; } const mk = buf[o + 1]; if (mk >= 0xc0 && mk <= 0xc3) { jh = buf.readUInt16BE(o + 5); jw = buf.readUInt16BE(o + 7); break; } o += 2 + buf.readUInt16BE(o + 2); }
        assert.deepEqual([jw, jh], [t.w, t.h], t.id + ': ' + fajl + ' merete = a dizajn merete');
      }
      assert.ok(['iv', 'kor', 'sarok'].includes(t.kep.alak), t.id + ' alak');
      if (t.kep.alak === 'kor') assert.ok(Math.abs(t.kep.w - t.kep.h) < 1, t.id + ': a kor ablak kor alaku');
      for (const [nev, r] of [['kep', t.kep], ['idezet', t.idezet], ['nevHely', t.nevHely], ...Object.entries(t.hat).filter(([k]) => k !== 'meret' && k !== 'betu')]) {
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= t.w && r.y + r.h <= t.h, t.id + '.' + nev + ' a lapon belul');
      }
      assert.ok(!atfed(t.kep, t.idezet) && !atfed(t.kep, t.nevHely) && !atfed(t.idezet, t.nevHely), t.id + ': nincs atfedes');
      // a lepcsok: minden karakterszamhoz az idezet / a nev beleferjen a dobozba (modell: 0,5 em szelesseg, 1,3 em sormagassag, 12% tordelesi veszteseg)
      for (const [n, px] of t.idezet.lepcso) assert.ok(Math.floor(t.idezet.w / (px * 0.5)) * Math.floor(t.idezet.h / (px * 1.3)) >= 1.12 * n, t.id + ' idezet ' + n + ' kar. ' + px + ' px');
      for (const [n, px] of t.nevHely.lepcso) assert.ok(n * px * 0.5 <= t.nevHely.w + 0.5 && px * 1.15 <= t.nevHely.h + 0.1, t.id + ' nev ' + n + ' kar. ' + px + ' px');
      const elol = K.html({ ...minta, tema: t.id, oldal: 'elol', fotoSrc: null }), hat = K.html({ ...minta, tema: t.id, oldal: 'hat' });
      assert.ok(elol.includes('aspect-ratio:' + t.w + '/' + t.h) && elol.includes('--ak-ar:'), t.id + ' sajat keparany');
      assert.ok(elol.includes('Ez a személyes idézet') && elol.includes('Nagy Mária') && hat.includes('AK-TEST-0001') && hat.includes('26.900 Ft'), t.id + ' tartalom');
      if (t.szin) for (const k of ['idezet', 'nev']) assert.ok(elol.includes('color:' + t.szin[k]), t.id + ' ' + k + ' szin a tervbol');
      // a stilus-attributum nem szakad meg (a betucsalad egyes idezojeles): a betutav / betucsalad / szin mind benne van az elemben
      assert.ok(!/font-family:"/.test(hat) && !/font-family:"/.test(elol), t.id + ': nincs dupla idezojeles font-family a style attributumban');
      const bt = t.hat.betu || {};
      for (const [k, osztaly] of [['termek', 'ak-h-termek'], ['kod', 'ak-h-kod'], ['erv', 'ak-h-erv']]) {
        if (!bt[k]) continue;
        const m = new RegExp('class="' + osztaly + '" style="([^"]*)"').exec(hat);
        assert.ok(m, t.id + ' ' + k + ' elem');
        if (bt[k].ls != null) assert.ok(m[1].includes('letter-spacing:' + bt[k].ls + 'em;padding-left:' + bt[k].ls + 'em'), t.id + ' ' + k + ' betutav + kiegyenlito kitoltes');
        if (bt[k].fam === 'serif') assert.ok(m[1].includes("font-family:'Playfair Display'"), t.id + ' ' + k + ' Playfair');
        assert.ok(m[1].includes('color:' + t.szin[k === 'erv' ? 'erv' : k]), t.id + ' ' + k + ' szin');
      }
    }
    // a mintaszoveg pontosan olyan szinu, mint a beirt (nem halvany)
    assert.ok(K.CSS.includes('.ak-halvany{opacity:1}'));
    // a szalag (kor) es a virag (lekerekitett teglalap) fotohelye
    assert.ok(K.html({ ...minta, tema: 'szalag', oldal: 'elol' }).includes('ak-kor ak-nincs-keret'));
    assert.match(K.html({ ...minta, tema: 'virag', oldal: 'elol' }), /ak-sarok ak-nincs-keret" style="[^"]*border-radius:/);
  });

  test('minden dizajn fekvo lapon fer el: a fotohely, az idezet es a nev a lapon belul van, az idezet es a nev nem er a fotohelyre', () => {
    for (const t of K.TEMAK) {
      for (const [nev, r] of [['kep', t.kep], ['idezet', t.idezet], ['nevHely', t.nevHely]]) {
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= (t.w || K.LAP_W) && r.y + r.h <= (t.h || K.LAP_H), `${t.id}.${nev} a lapon belul`);
      }
      const atfed = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!atfed(t.kep, t.idezet) && !atfed(t.kep, t.nevHely), `${t.id}: a szoveg nem fedi a fotot`);
    }
  });
});
