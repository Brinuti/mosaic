// A Számlázz.hu Számla Agent modul (netlify/lib/szamlazz-agent.js): az XML felépítése, a válasz értelmezése, a kérés formája.
//   node --test tools/ajandek-teszt/szamlazz-agent.test.mjs
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { szamlaXml, valaszErtelmez, szamlaKiallit, budapestiNap, SZAMLAZZ_URL } from '../../netlify/lib/szamlazz-agent.js';

const ADAT = {
  kulcs: 'agent-kulcs-teszt-1234', nap: '2026-10-07', fizmod: 'Stripe', rendelesSzam: 'MH-ABCD1234', kulsoAzon: 'pi_3UTeszt',
  megjegyzes: 'Ajándékozott neve: Teszt Elek & társa', emailReplyto: 'mosaicheadspa@gmail.com',
  vevo: { nev: 'Kiss Anna', irsz: '1111', telepules: 'Budapest', cim: 'Fő utca 1.', email: 'anna@gmail.com' },
  tetelek: [{ nev: 'MOSAIC lézeres szőrtelenítés ajándékkártya – 30.000 Ft', ft: 30000, afa: 'AAM' }],
};
const tagek = (xml) => [...xml.matchAll(/<([A-Za-z]+)[ >]/g)].map((m) => m[1]);
const sorrendben = (xml, nevek) => { let p = -1; for (const n of nevek) { const i = xml.indexOf('<' + n + '>', p + 1); assert.ok(i > p, `${n} hiányzik vagy rossz helyen van`); p = i; } };

describe('szamlaXml', () => {
  test('az XSD sorrendje: beállítások, fejléc, eladó, vevő, tételek; AAM tétel: nettó = bruttó, ÁFA 0', () => {
    const xml = szamlaXml(ADAT);
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?><xmlszamla xmlns="http:\/\/www\.szamlazz\.hu\/xmlszamla"/);
    sorrendben(xml, ['beallitasok', 'szamlaagentkulcs', 'eszamla', 'szamlaLetoltes', 'valaszVerzio', 'szamlaKulsoAzon', 'fejlec', 'keltDatum', 'teljesitesDatum',
      'fizetesiHataridoDatum', 'fizmod', 'penznem', 'szamlaNyelve', 'megjegyzes', 'rendelesSzam', 'fizetve', 'elado', 'vevo', 'nev', 'orszag', 'irsz', 'telepules', 'cim',
      'email', 'sendEmail', 'tetelek', 'tetel', 'megnevezes', 'mennyiseg', 'mennyisegiEgyseg', 'nettoEgysegar', 'afakulcs', 'nettoErtek', 'afaErtek', 'bruttoErtek']);
    assert.match(xml, /<eszamla>true<\/eszamla><szamlaLetoltes>false<\/szamlaLetoltes><valaszVerzio>2<\/valaszVerzio>/);
    assert.match(xml, /<keltDatum>2026-10-07<\/keltDatum><teljesitesDatum>2026-10-07<\/teljesitesDatum><fizetesiHataridoDatum>2026-10-07<\/fizetesiHataridoDatum>/);
    assert.match(xml, /<fizmod>Stripe<\/fizmod><penznem>Ft<\/penznem><szamlaNyelve>hu<\/szamlaNyelve>/);
    assert.match(xml, /<nettoEgysegar>30000<\/nettoEgysegar><afakulcs>AAM<\/afakulcs><nettoErtek>30000<\/nettoErtek><afaErtek>0<\/afaErtek><bruttoErtek>30000<\/bruttoErtek>/);
    assert.match(xml, /<fizetve>true<\/fizetve>/);
    assert.doesNotMatch(xml, /elonezetpdf/);
    assert.doesNotMatch(xml, /adoszam/, 'magánszemély: nincs adószám a számlán');
  });
  test('az XML-speciális karakterek kiesnek (a megjegyzésben & és idézőjel), a vezérlőkarakterek eldobódnak', () => {
    const xml = szamlaXml({ ...ADAT, megjegyzes: 'A & B <x> "y" \'z\'\u0001' });
    assert.match(xml, /<megjegyzes>A &amp; B &lt;x&gt; &quot;y&quot; &apos;z&apos;<\/megjegyzes>/);
    assert.doesNotMatch(xml, /\u0001/);
  });
  test('előnézet mód: elonezetpdf a fejléc végén (a fizetve után), egyébként nincs', () => {
    const xml = szamlaXml({ ...ADAT, elonezet: true });
    assert.match(xml, /<fizetve>true<\/fizetve><elonezetpdf>true<\/elonezetpdf><\/fejlec>/);
  });
  test('27%-os tétel: az összeg bruttó, a nettó és az ÁFA a bruttóból számolódik; több tétel is mehet', () => {
    const xml = szamlaXml({ ...ADAT, tetelek: [{ nev: 'A', ft: 12700, afa: '27' }, { nev: 'B', ft: 5000, afa: 'AAM' }] });
    assert.match(xml, /<nettoEgysegar>10000<\/nettoEgysegar><afakulcs>27<\/afakulcs><nettoErtek>10000<\/nettoErtek><afaErtek>2700<\/afaErtek><bruttoErtek>12700<\/bruttoErtek>/);
    assert.equal((xml.match(/<tetel>/g) || []).length, 2);
  });
  test('e-mail nélkül nincs sendEmail; az e-mailes vevőnek a Számlázz.hu elküldi a számlát', () => {
    assert.match(szamlaXml({ ...ADAT, vevo: { ...ADAT.vevo, email: '' } }), /<sendEmail>false<\/sendEmail>/);
    assert.match(szamlaXml(ADAT), /<email>anna@gmail\.com<\/email><sendEmail>true<\/sendEmail>/);
  });
  test('hibás bemenet: hiányzó kulcs / tétel / dátum / összeg dob', () => {
    assert.throws(() => szamlaXml({ ...ADAT, kulcs: '' }), /kulcs/);
    assert.throws(() => szamlaXml({ ...ADAT, tetelek: [] }), /tetel/);
    assert.throws(() => szamlaXml({ ...ADAT, nap: '2026.10.07' }), /datum/);
    assert.throws(() => szamlaXml({ ...ADAT, tetelek: [{ nev: 'A', ft: 0 }] }), /osszeg/);
    assert.throws(() => szamlaXml({ ...ADAT, tetelek: [{ nev: 'A', ft: 'x' }] }), /osszeg/);
  });
  test('a tagek mind az XSD nevei (nincs elgépelt elem)', () => {
    const ismert = new Set(['xmlszamla', 'beallitasok', 'szamlaagentkulcs', 'eszamla', 'szamlaLetoltes', 'valaszVerzio', 'szamlaKulsoAzon', 'fejlec', 'keltDatum', 'teljesitesDatum',
      'fizetesiHataridoDatum', 'fizmod', 'penznem', 'szamlaNyelve', 'megjegyzes', 'rendelesSzam', 'fizetve', 'elonezetpdf', 'elado', 'emailReplyto', 'vevo', 'nev', 'orszag', 'irsz',
      'telepules', 'cim', 'email', 'sendEmail', 'tetelek', 'tetel', 'megnevezes', 'mennyiseg', 'mennyisegiEgyseg', 'nettoEgysegar', 'afakulcs', 'nettoErtek', 'afaErtek', 'bruttoErtek']);
    for (const n of tagek(szamlaXml({ ...ADAT, elonezet: true }))) assert.ok(ismert.has(n), 'ismeretlen elem: ' + n);
  });
});

describe('valaszErtelmez', () => {
  const xmlOk = '<?xml version="1.0"?><xmlszamlavalasz xmlns="http://www.szamlazz.hu/xmlszamlavalasz"><sikeres>true</sikeres><szamlaszam>E-SZ-2026-7</szamlaszam><szamlabrutto>30000</szamlabrutto></xmlszamlavalasz>';
  test('sikeres XML-válasz: a számlaszám', () => {
    assert.deepEqual(valaszErtelmez(200, new Headers(), xmlOk), { ok: true, szamlaszam: 'E-SZ-2026-7' });
  });
  test('előnézet: sikeres, de nincs számlaszám', () => {
    const r = valaszErtelmez(200, new Headers(), '<xmlszamlavalasz xmlns="x"><sikeres>true</sikeres><pdf>AAAA</pdf></xmlszamlavalasz>');
    assert.equal(r.ok, true);
    assert.equal(r.elonezet, true);
  });
  test('sikertelen XML-válasz: hibakód + üzenet', () => {
    const r = valaszErtelmez(200, new Headers(), '<xmlszamlavalasz xmlns="x"><sikeres>false</sikeres><hibakod>57</hibakod><hibauzenet>Hib&amp;s k&lt;lcs</hibauzenet></xmlszamlavalasz>');
    assert.deepEqual(r, { ok: false, hibakod: '57', hibauzenet: 'Hib&s k<lcs' });
  });
  test('fejléces hiba (szlahu_error) elsőbbséget élvez; a régi fejléces siker is elfogadott', () => {
    const h = new Headers({ szlahu_error: 'Hib%C3%A1s+kulcs', szlahu_error_code: '3' });
    assert.deepEqual(valaszErtelmez(200, h, ''), { ok: false, hibakod: '3', hibauzenet: 'Hibás kulcs' });
    assert.deepEqual(valaszErtelmez(200, new Headers({ szlahu_szamlaszam: 'SZ-2026-9' }), 'PDF'), { ok: true, szamlaszam: 'SZ-2026-9' });
  });
  test('ismeretlen formátum NEM siker', () => {
    assert.equal(valaszErtelmez(200, new Headers(), '<html>valami</html>').ok, false);
    assert.equal(valaszErtelmez(502, new Headers(), '').ok, false);
  });
});

describe('szamlaKiallit', () => {
  const valasz = (status, torzs, fejlec = {}) => new Response(torzs, { status, headers: fejlec });
  test('a kérés: POST a Számlázz.hu címére, multipart, az action-xmlagentxmlfile mezőben a számla XML-je', async () => {
    let latott = null;
    const r = await szamlaKiallit(ADAT, { fetchFn: async (url, opt) => { latott = { url, opt }; return valasz(200, '<xmlszamlavalasz xmlns="x"><sikeres>true</sikeres><szamlaszam>E-SZ-2026-8</szamlaszam></xmlszamlavalasz>'); } });
    assert.deepEqual(r, { ok: true, szamlaszam: 'E-SZ-2026-8' });
    assert.equal(latott.url, SZAMLAZZ_URL);
    assert.equal(latott.opt.method, 'POST');
    const fajl = latott.opt.body.get('action-xmlagentxmlfile');
    assert.ok(fajl && typeof fajl.text === 'function');
    assert.match(await fajl.text(), /<rendelesSzam>MH-ABCD1234<\/rendelesSzam>/);
  });
  test('hálózati hiba / időtúllépés: átmeneti (újrapróbálható)', async () => {
    const r = await szamlaKiallit(ADAT, { fetchFn: async () => { throw new Error('connect ETIMEDOUT'); } });
    assert.equal(r.ok, false);
    assert.equal(r.ujraproba, true);
    assert.equal(r.hibakod, 'halozat');
  });
  test('5xx: újrapróbálható; érvénytelen kulcs / adat (200 + hibakód): végleges', async () => {
    assert.equal((await szamlaKiallit(ADAT, { fetchFn: async () => valasz(503, 'Service Unavailable') })).ujraproba, true);
    const veglegesXml = '<xmlszamlavalasz xmlns="x"><sikeres>false</sikeres><hibakod>3</hibakod><hibauzenet>Hibás kulcs</hibauzenet></xmlszamlavalasz>';
    const r = await szamlaKiallit(ADAT, { fetchFn: async () => valasz(200, veglegesXml) });
    assert.equal(r.ok, false);
    assert.equal(r.ujraproba, false);
    assert.equal(r.hibakod, '3');
  });
  test('rendelésszám-ismétlődés: a számla már megvan (duplikált), nem hiba-újrapróba', async () => {
    const xml = '<xmlszamlavalasz xmlns="x"><sikeres>false</sikeres><hibakod>339</hibakod><hibauzenet>A rendelésszám már szerepel egy másik számlán: MH-ABCD1234</hibauzenet></xmlszamlavalasz>';
    const r = await szamlaKiallit(ADAT, { fetchFn: async () => valasz(200, xml) });
    assert.equal(r.ok, false);
    assert.equal(r.duplikalt, true);
    assert.equal(r.ujraproba, false);
  });
});

describe('budapestiNap', () => {
  test('a magyarországi nap (nyári időszámítás: UTC+2, tél: UTC+1)', () => {
    assert.equal(budapestiNap(new Date('2026-10-06T22:30:00Z')), '2026-10-07');
    assert.equal(budapestiNap(new Date('2026-10-06T21:59:00Z')), '2026-10-06');
    assert.equal(budapestiNap(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
    assert.equal(budapestiNap('2026-07-01T12:00:00Z'), '2026-07-01');
  });
});
