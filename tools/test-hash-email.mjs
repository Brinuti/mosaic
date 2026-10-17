// DECISION #192 / F1: az e-mail normalizalas a kuponos Salonic-level "E-mail cim:" mezojere ("<e-mail> Kupon kod: <KOD>", elvalaszto nelkul is).
//   node --test tools/test-hash-email.mjs
// A regi viselkedes (egyetlen e-mail token) valtozatlan; a felismert kuponkod-cimke utani szoveg (a kuponkod) sosem kerul a kimenetbe; cimke nelkul fail-closed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KUPON_CIMKE, emailNormal, hashEmail, kuponNelkul, sha256hex } from '../netlify/lib/meres/hash.js';

const regi = (e) => { const s = String(e || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null; }; // a F1 elotti emailNormal, szo szerint
const TISZTA = 'teszt.claude@example.com';
const CIMKE_RE = KUPON_CIMKE; // a modul sajat (exportalt) cimke-regexe: nincs drift a teszt es a kod kozott

function mulberry32(mag) { let a = mag >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('visszafele kompatibilis: ahol a regi emailNormal nem null (egyetlen e-mail token), az uj pontosan ugyanaz; valtozatlan: ures / nem e-mail', () => {
  const jok = [TISZTA, ' Teszt.Claude@Example.COM ', 'a@b.hu', 'a+b@c-d.co.uk', 'x_y@z.io', 'kuponkod@example.com', 'kupon@kupon.hu', 'a@b.hu,', "o'neil@pelda.hu", 'nev@xn--e1afmkfd.xn--p1ai',
    'x.kuponkod:y@b.hu', 'a@kuponkod:.hu', 'kuponkod:x@b.hu', 'a:b@c.hu', 'user:pass@h.hu', 'x.kupon:y@b.hu']; // az utolso 6: kettospontos (nem valos, de a regi elfogadta), a szigoru ellenorzes megtartja
  for (const j of jok) { assert.notEqual(regi(j), null, j); assert.equal(emailNormal(j), regi(j), j); }
  for (const rossz of ['', ' ', null, undefined, 0, 'x', 'nincs kukac', '@x.hu', 'a@b', 'a@', '@', 'a @b.hu']) assert.equal(emailNormal(rossz), null, String(rossz));
});

test('visszafele kompatibilis (veletlen): seedelt PRNG-vel generalt, @-ot / pontot / kettospontot / szokozt tartalmazo bemenetek; ahol a regi nem-null es nincs felismert cimke, az uj azonos; ahol a regi null es nincs cimke, az uj is null (fail-closed)', () => {
  const rnd = mulberry32(20261017);
  const elemek = ['a', 'b', 'kupon', 'kod', 'x', '@', '@', '.', '.', '-', '_', '+', ':', ' ', ' ', 'hu', 'com', 'e', '\t', '\n'];
  let regiNemNull = 0, regiNull = 0, cimkes = 0;
  for (let i = 0; i < 40000; i++) {
    const n = 1 + Math.floor(rnd() * 14); let s = '';
    for (let k = 0; k < n; k++) s += elemek[Math.floor(rnd() * elemek.length)];
    if (CIMKE_RE.test(s)) { cimkes++; continue; }
    if (regi(s) !== null) { regiNemNull++; assert.equal(emailNormal(s), regi(s), JSON.stringify(s)); } else { regiNull++; assert.equal(emailNormal(s), null, JSON.stringify(s)); }
  }
  assert.ok(regiNemNull >= 200, `a veletlen generator tenyleg ad elfogadott e-mailt (${regiNemNull})`); // a teszt nem lehet ures
  assert.ok(regiNull >= 10000, `es elutasitottat is (${regiNull})`);
  assert.ok(cimkes >= 1, 'a cimkes bemenetek kimaradtak, de voltak');
});

test('a kuponos level e-mail mezoje: az e-mail, kozvetlenul utana a kuponkod-sor (szokozzel, ujsorral, elvalaszto nelkul, nagybetuvel, ekezet nelkul, angol / rovid cimkevel) -> a tiszta e-mail, a kuponkod nelkul', () => {
  const kodok = ['KUPXYZ9', 'AB12CD', 'Q1', '9876543210'];
  const cimkek = ['Kupon kód:', 'KUPON KÓD:', 'Kupon kod:', 'kupon kód :', 'Kuponkód:', 'Kupon:', 'Coupon code:', 'COUPON CODE:', 'Coupon:'];
  const elvalasztok = [' ', '\n', '\r\n', '\t', '   ', '']; // az utolso: osszeerve (a HTML->szoveg utan nincs biztos elvalaszto)
  for (const kod of kodok) for (const c of cimkek) for (const el of elvalasztok) {
    for (const utan of [' ', '', '\n']) {
      const mezo = `${TISZTA}${el}${c}${utan}${kod}`;
      assert.equal(emailNormal(mezo), TISZTA, JSON.stringify(mezo));
    }
  }
  assert.equal(emailNormal(`  ${TISZTA.toUpperCase()}   KUPON KÓD:  ABC123 `), TISZTA);
  assert.equal(emailNormal('Teszt Elek ' + TISZTA + ' Kupon kód: ABC123'), TISZTA, 'cimkevel egyutt a cimke elotti resz elso e-mail-szeru tokenje');
  assert.equal(emailNormal('kuponkod@example.com Kupon kód: ABC123'), 'kuponkod@example.com', 'a "kuponkod" nevu cim nem a cimke (a cimke utan kettospont kell)');
  assert.equal(emailNormal('kuponkod@example.comKupon kód: ABC123'), 'kuponkod@example.com');
});

test('fail-closed: nincs e-mail-szeru token, vagy nincs felismert cimke a tobbtokenes szovegben, vagy a cimkevel kezdodik a mezo, vagy tul hosszu -> null (a kuponkod sosem lesz e-mail)', () => {
  for (const mezo of ['Kupon kód: ABC123', 'Kupon kód:', 'Coupon code: ABC123', 'kupon kód', 'ABC123', 'Teszt Claude', '@ Kupon kód: X', 'Kupon kód: abc@kupon.hu', 'Kupon kód: ABC123 ' + TISZTA]) assert.equal(emailNormal(mezo), null, mezo);
  // cimke nelkul a tobbtokenes szoveg tovabbra is elutasitott (a regi viselkedes): az elso token NEM nyer
  for (const mezo of ['elso@pelda.hu masodik@pelda.hu', 'Teszt Claude teszt@pelda.hu', 'Nev: Teszt Elek ' + TISZTA, '"x y"@z.hu', TISZTA + ' Cim: Budapest']) assert.equal(emailNormal(mezo), null, mezo);
  // hosszkorlat: 320 karakter
  const hossz = (n) => 'a'.repeat(n - '@b.hu'.length) + '@b.hu';
  assert.equal(emailNormal(hossz(320)), hossz(320)); assert.equal(emailNormal(hossz(321)), null); assert.equal(emailNormal(hossz(5000)), null);
  // a hosszkorlat a vizsgalt (cimke elotti) reszre vonatkozik: a cimke utani szoveg hossza nem szamit
  assert.equal(emailNormal(`${TISZTA} Kupon kód: ${'x'.repeat(5000)}`), TISZTA, 'hosszu kod / szemet a cimke utan nem veszejti el az e-mailt');
  assert.equal(emailNormal(`${hossz(321)} Kupon kód: X`), null, 'a cimke elotti resz tul hosszu');
});

test('ReDoS-vedelem: az EMAIL_TOKEN masodfoku visszalepeset kivalto hosszu, sok pontos, @-os mezo gyorsan (hosszkorlat) null', () => {
  const rossz = ['a@' + '.x'.repeat(50000) + '@', 'a@x.' + 'x.'.repeat(60000), 'Kupon kód: ' + 'a@x.x'.repeat(30000)];
  const t0 = Date.now();
  for (const m of rossz) assert.equal(emailNormal(m), null);
  assert.ok(Date.now() - t0 < 500, `gyors: ${Date.now() - t0} ms`);
});

test('kuponNelkul (az external_id tartalek-aga): a felismert cimketol kezdve semmi; cimke nelkuli kupon / coupon szoveg es a "csak E-mail cim:" maradek ures; a tobbi valtozatlan', () => {
  for (const m of ['Kupon kód: ABC123', ' Kupon kód: ABC123', '\nKupon kód: ABC123', 'E-mail cím: Kupon kód: ABC123', 'E-mail cim:Kupon:X', 'Kuponkód ABC123', 'Kupon: X', 'KUPON ABC', 'Coupon code X', 'semmi kupon itt']) assert.equal(kuponNelkul(m), '', JSON.stringify(m));
  assert.equal(kuponNelkul(`${TISZTA} Kupon kód: ABC123`), TISZTA);
  assert.equal(kuponNelkul(`${TISZTA}KUPON KÓD:ABC123`), TISZTA);
  assert.equal(kuponNelkul('x'), 'x'); assert.equal(kuponNelkul(''), ''); assert.equal(kuponNelkul(null), ''); assert.equal(kuponNelkul(' '), ' ', 'cimke / kupon-szo nelkul a regi viselkedes');
  assert.equal(kuponNelkul('Teszt Elek'), 'Teszt Elek');
  assert.equal(kuponNelkul('Kupon ABC123 Kupon kód: X'), '', 'a kupon-szo a cimke ELOTTI reszben is: a kod szovege nem hash-elodik');
  assert.equal(kuponNelkul('Coupon ABC Coupon code: X'), '');
  assert.equal(kuponNelkul('nincs Teszt Elek Kupon kód: X'), 'nincs Teszt Elek', 'a nem-kupon elotag valtozatlan (a regi viselkedes, nem kuponspecifikus)');
});

test('hashEmail: a kuponos mezo hash-e pontosan a tiszta e-mail SHA-256-ja; a kuponkod nincs a hash bemenetben', async () => {
  const elvart = await sha256hex(TISZTA);
  assert.equal(await hashEmail(TISZTA), elvart);
  for (const mezo of [`${TISZTA} Kupon kód: KUPXYZ9`, `${TISZTA}\nKupon kód: KUPXYZ9`, `${TISZTA}Kupon kód: KUPXYZ9`, `${TISZTA}Kupon:KUPXYZ9`, `${TISZTA}Kuponkód:KUPXYZ9`]) assert.equal(await hashEmail(mezo), elvart, JSON.stringify(mezo));
  assert.equal(await hashEmail('Kupon kód: KUPXYZ9'), null);
  assert.equal(await hashEmail(''), null);
});
