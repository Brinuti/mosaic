// Az elhagyott fizetes emlekeztetoi (POST /api/ajandek/emlekeztetok) - Node beepitett tesztfuttato:
//   node --test "tools/ajandek-teszt/emlekezteto.test.mjs"
// A kezelot kozvetlenul hivjuk, a Stripe helyett a helyi mock fut (mock-stripe.mjs: a PaymentIntent-lista is), levelet a "kuld" fuggveny gyujti.
// Az idot a "most" parameter adja (budapesti delben), a rendelesek letrehozasi idejet a mock.allapot.korBeallit allitja.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { mockStripeInditas } from './mock-stripe.mjs';
import { ajandekKezel, _korlatAlaphelyzet } from '../../netlify/lib/ajandek.js';

const BAZIS = 'https://teszt.mosaicheadspa.hu';
const TITOK = 'teszt-titok-teszt-titok-teszt-titok-0123456789';
const KULCS = 'emlekezteto-kulcs-teszt-0123456789abcdef';
const DEL = new Date('2026-10-07T10:00:00Z');   // 12:00 budapesti ido (CEST)
const mp = (d) => Math.floor(d.getTime() / 1000);
const orakKorabban = (o) => mp(DEL) - Math.round(o * 3600);
const veletlenIp = () => `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(256)}`;

let mock, ENV;
let levelek = [];

before(async () => {
  mock = await mockStripeInditas();
  ENV = { STRIPE_SECRET_KEY: 'sk_test_mock_emlekezteto', STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_emlekezteto', STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK, AJANDEK_EMLEKEZTETO_KULCS: KULCS };
});
after(async () => { await mock.bezar(); });

async function hiv(method, ut, { body, headers = {}, env = ENV, most = DEL, kuld } = {}) {
  _korlatAlaphelyzet();
  const url = new URL(BAZIS + '/api/ajandek/' + ut);
  const text = body === undefined ? '' : JSON.stringify(body);
  const v = await ajandekKezel({
    method, url: url.toString(), headers: { 'content-type': 'application/json', 'x-forwarded-for': veletlenIp(), ...headers }, text, env, most,
    kuld: kuld || (async (l) => { levelek.push(l); }),
  });
  return { ...v, adat: /json/.test(v.headers['content-type'] || '') ? JSON.parse(v.body) : null };
}
const futtat = (opc = {}) => hiv('POST', 'emlekeztetok', { headers: { authorization: 'Bearer ' + KULCS }, ...opc });
const torzs = (extra = {}) => ({
  termek: 'egyeni', email: 'vendeg@gmail.com', ajandekozott: 'Kiss Anna', nev: 'Nagy Dorottya', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.',
  ceges: null, attr: { variant_id: 'general', oldal: '/headspa-ajandekkartya' }, mer: { ana: false, adv: false }, kulcs: 'k-' + crypto.randomUUID(), ...extra,
});
// elhagyott rendeles: a PI letrejon (a vevo megadta az adatait), de nem fizet; a letrehozasi idot "orakKorabban" oraval allitjuk vissza
async function elhagyott(extra = {}, kor = 2) {
  const r = await hiv('POST', 'fizetes', { body: torzs(extra) });
  assert.equal(r.status, 200, r.body);
  mock.allapot.korBeallit(r.adat.pi, orakKorabban(kor));
  return r.adat.pi;
}
const tiszta = () => { for (const [id, pi] of [...mock.allapot.pik]) { if (pi.status !== 'canceled') { pi.status = 'canceled'; } } levelek = []; };
const meta = (pi) => mock.allapot.pi(pi).metadata;

describe('emlekezteto: jogosultsag', () => {
  test('kulcs nelkul 503, rossz kulccsal 401, rossz modszerrel 405; jo kulccsal 200', async () => {
    assert.equal((await hiv('POST', 'emlekeztetok', { env: { ...ENV, AJANDEK_EMLEKEZTETO_KULCS: '' }, headers: { authorization: 'Bearer valami' } })).status, 503);
    assert.equal((await hiv('POST', 'emlekeztetok', { env: { ...ENV, AJANDEK_EMLEKEZTETO_KULCS: 'rovid' }, headers: { authorization: 'Bearer rovid' } })).status, 503);
    assert.equal((await hiv('POST', 'emlekeztetok', {})).status, 401);
    assert.equal((await hiv('POST', 'emlekeztetok', { headers: { authorization: 'Bearer ' + KULCS + 'x' } })).status, 401);
    assert.equal((await hiv('GET', 'emlekeztetok', { headers: { authorization: 'Bearer ' + KULCS } })).status, 405);
    tiszta();
    const r = await futtat();
    assert.equal(r.status, 200);
    assert.equal(r.adat.kuldve, 0);
  });
});

describe('emlekezteto: kuldes', () => {
  test('az elso level kb. 1 ora mulva megy: 30 perc utan meg nem, 2 ora utan igen; a bejegyzes megvan, ismetelt futas nem kuld ujra', async () => {
    tiszta();
    const korai = await elhagyott({ email: 'korai@gmail.com' }, 0.5);
    assert.equal((await futtat()).adat.kuldve, 0);
    assert.equal(levelek.length, 0);
    mock.allapot.korBeallit(korai, orakKorabban(2));
    const r = await futtat();
    assert.equal(r.adat.kuldve, 1);
    assert.equal(levelek.length, 1);
    const l = levelek[0];
    assert.equal(l.cimzett, 'korai@gmail.com');
    assert.equal(l.valasz, 'szalon');
    assert.match(l.targy, /^Elakadt az ajándékkártya megvásárlása\?/);
    assert.match(l.html, /Kedves Nagy Dorottya!/);
    assert.match(l.html, /Egyéni MOSAIC Head Spa ajándékkártya/);
    assert.match(l.html, /\(Kiss Anna részére\)/);
    assert.match(l.html, /26\.900 Ft/);
    assert.match(l.html, /https:\/\/teszt\.mosaicheadspa\.hu\/headspa-ajandekkartya\?utm_source=emlekezteto&amp;utm_medium=email&amp;utm_campaign=ajandek-elhagyott-1/);
    assert.match(l.html, /Folytatom a vásárlást/);
    assert.doesNotMatch(l.html, /több levelet nem küldünk/);
    assert.match(meta(korai).emlekezteto_1, /^2026-10-07T10:00:00/);
    assert.equal(meta(korai).emlekezteto_2, undefined);
    // ugyanabban a percben ujra: nincs masodik level
    const ujra = await futtat();
    assert.equal(ujra.adat.kuldve, 0);
    assert.equal(levelek.length, 1);
  });

  test('a masodik level az elso utan >= 22 orara megy (21 ora: meg nem), "nem kuldunk tobbet" mondattal; harmadik nincs', async () => {
    tiszta();
    const pi = await elhagyott({ email: 'masodik@gmail.com' }, 30);
    // az elso level 21 oraja ment ki: meg nem esedekes a masodik
    mock.allapot.pik.get(pi).metadata.emlekezteto_1 = new Date(DEL.getTime() - 21 * 3600 * 1000).toISOString();
    assert.equal((await futtat()).adat.kuldve, 0);
    mock.allapot.pik.get(pi).metadata.emlekezteto_1 = new Date(DEL.getTime() - 23 * 3600 * 1000).toISOString();
    const r = await futtat();
    assert.equal(r.adat.kuldve, 1);
    const l = levelek.find((x) => x.cimzett === 'masodik@gmail.com');
    assert.match(l.targy, /^Még aktuális az ajándékkártya\?/);
    assert.match(l.html, /utm_campaign=ajandek-elhagyott-2/);
    assert.match(l.html, /több levelet nem küldünk/);
    assert.match(meta(pi).emlekezteto_2, /^2026-10-07T10:00:00/);
    assert.equal((await futtat()).adat.kuldve, 0, 'harmadik level nincs');
    assert.equal(levelek.filter((x) => x.cimzett === 'masodik@gmail.com').length, 1);
  });

  test('nem kuld: ha a vevo kozben (ugyanazzal az e-maillel) fizetett; ha tesztrendeles; ha atutalas; ha tul regi; ha nem a motor rendelese', async () => {
    tiszta();
    // 1) kozben fizetett: elhagyott + utana sikeres ugyanazzal az e-maillel
    const a = await elhagyott({ email: 'fizetett@gmail.com' }, 3);
    const b = await elhagyott({ email: 'fizetett@gmail.com' }, 2);
    mock.allapot.sikeresIt(b, { mod: 'card' });
    // 2) tesztrendeles (nev / example.com)
    await elhagyott({ email: 'teszt@gmail.com', nev: 'TESZT Elek' });
    await elhagyott({ email: 'valaki@example.com' });
    // 3) atutalas
    const atu = await elhagyott({ email: 'atutal@gmail.com' });
    mock.allapot.pik.get(atu).metadata.fizetesi_mod = 'atutalas';
    // 4) tul regi (50 ora; az elso level 48 oran tul mar nem megy)
    await elhagyott({ email: 'regi@gmail.com' }, 50);
    // 5) nem a motor rendelese (a Stripe-fiokban mas PI is lehet)
    const idegen = await fetch(mock.url + '/v1/payment_intents', { method: 'POST', headers: { authorization: 'Bearer sk_test_mock_emlekezteto', 'content-type': 'application/x-www-form-urlencoded' }, body: 'amount=1000000&currency=huf&receipt_email=idegen%40gmail.com&description=nem+ajandek' }).then((r) => r.json());
    mock.allapot.korBeallit(idegen.id, orakKorabban(3));
    const r = await futtat();
    assert.equal(r.adat.kuldve, 0, JSON.stringify(r.adat));
    assert.equal(levelek.length, 0);
    assert.equal(mock.allapot.pi(a).metadata.emlekezteto_1, undefined);
  });

  test('e-mailenkent egy level: ha ugyanaz a vevo tobb befejezetlen rendelest kezdett, a legujabbrol szol', async () => {
    tiszta();
    await elhagyott({ email: 'ketto@gmail.com', termek: 'egyeni' }, 5);
    const uj = await elhagyott({ email: 'ketto@gmail.com', termek: 'paros' }, 2);
    const r = await futtat();
    assert.equal(r.adat.kuldve, 1);
    assert.equal(levelek.length, 1);
    assert.match(levelek[0].html, /Páros MOSAIC Head Spa ajándékkártya/);
    assert.ok(meta(uj).emlekezteto_1);
  });

  test('ejszaka (budapesti 3:00) nem kuld, reggel (8:00) igen', async () => {
    tiszta();
    const pi = await elhagyott({ email: 'ejjel@gmail.com' }, 3);
    const reggelMost = new Date('2026-10-07T06:00:00Z');    // 8:00 (CEST)
    mock.allapot.korBeallit(pi, mp(reggelMost) - 3 * 3600);  // a rendeles a futas idejehez kepest 3 oras
    const ejjel = await futtat({ most: new Date('2026-10-07T01:00:00Z') });   // 3:00 (CEST)
    assert.equal(ejjel.adat.kihagyva, 'ejszaka');
    assert.equal(levelek.length, 0);
    assert.equal(meta(pi).emlekezteto_1, undefined);
    const reggel = await futtat({ most: reggelMost });
    assert.equal(reggel.adat.kuldve, 1, JSON.stringify(reggel.adat));
    // 20:00 (CEST) utan megint nem
    tiszta();
    const este = await elhagyott({ email: 'este@gmail.com' }, 3);
    const esteMost = new Date('2026-10-07T18:30:00Z');       // 20:30 (CEST)
    mock.allapot.korBeallit(este, mp(esteMost) - 3 * 3600);
    assert.equal((await futtat({ most: esteMost })).adat.kihagyva, 'ejszaka');
  });

  test('sikertelen kuldes (SMTP le): a bejegyzes visszavonodik, a kovetkezo futas ujraprobal', async () => {
    tiszta();
    const pi = await elhagyott({ email: 'smtp@gmail.com' }, 2);
    const r = await futtat({ kuld: async () => { throw new Error('SMTP le'); } });
    assert.equal(r.status, 200);
    assert.equal(r.adat.kuldve, 0);
    assert.equal(r.adat.kihagyva.hiba, 1);
    assert.equal(meta(pi).emlekezteto_1, undefined, 'a bejegyzes nem maradhat meg');
    const ujra = await futtat();
    assert.equal(ujra.adat.kuldve, 1);
    assert.ok(meta(pi).emlekezteto_1);
  });

  test('egy futasban legfeljebb 20 level', async () => {
    tiszta();
    for (let i = 0; i < 22; i++) await elhagyott({ email: `tomeg${i}@gmail.com` }, 2);
    const r = await futtat();
    assert.equal(r.adat.kuldve, 20);
    assert.equal((await futtat()).adat.kuldve, 2);
  });
});

describe('emlekezteto: bekotes', () => {
  test('az idozitett GitHub-feladat a motor vegpontjait hivja a titkos kulccsal (a kulcs nincs a fajlban)', () => {
    const y = fs.readFileSync(new URL('../../.github/workflows/ajandek-emlekeztetok.yml', import.meta.url), 'utf8');
    assert.match(y, /cron: '\*\/30 \* \* \* \*'/);
    assert.match(y, /secrets\.AJANDEK_EMLEKEZTETO_KULCS/);
    assert.match(y, /for ut in ajandek ajandek-lezer ajandek-oxigen/);
    assert.match(y, /api\/\$ut\/emlekeztetok/);
    assert.doesNotMatch(y, /Bearer [A-Za-z0-9]{20,}/);
  });
});
