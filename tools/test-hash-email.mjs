// DECISION #192 / F1: az e-mail normalizalas a kuponos Salonic-level "E-mail cim:" mezojere ("<e-mail> Kupon kod: <KOD>", elvalaszto nelkul is).
//   node --test tools/test-hash-email.mjs
// A regi viselkedes (egyetlen e-mail token) valtozatlan; a kuponkod sosem kerul a hash-be.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emailNormal, hashEmail, kuponNelkul, sha256hex } from '../netlify/lib/meres/hash.js';

const regi = (e) => { const s = String(e || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null; }; // a F1 elotti emailNormal, szo szerint
const TISZTA = 'teszt.claude@example.com';

test('visszafele kompatibilis: ahol a regi emailNormal nem null (egyetlen e-mail token), az ujja pontosan ugyanaz; valtozatlan: ures / nem e-mail', () => {
  const jok = [TISZTA, ' Teszt.Claude@Example.COM ', 'a@b.hu', 'a+b@c-d.co.uk', 'x_y@z.io', 'kuponkod@gmail.com', 'a@b.hu,', "o'neil@pelda.hu", 'a@b.huKupon', 'nev@xn--e1afmkfd.xn--p1ai'];
  for (const j of jok) { assert.notEqual(regi(j), null, j); assert.equal(emailNormal(j), regi(j), j); }
  for (const rossz of ['', ' ', null, undefined, 0, 'x', 'nincs kukac', '@x.hu', 'a@b', 'a@', '@', 'a @b.hu']) assert.equal(emailNormal(rossz), null, String(rossz));
  // veletlen egy-tokenes bemenetek: ahol a regi elfogad, az uj azonos
  let allapot = 12345; const kov = () => (allapot = (allapot * 1103515245 + 12345) % 2147483648);
  const abc = 'ab@.-_+ ';
  for (let i = 0; i < 3000; i++) {
    let s = ''; const n = 1 + (kov() % 14); for (let k = 0; k < n; k++) s += abc[kov() % abc.length];
    if (regi(s) !== null) assert.equal(emailNormal(s), regi(s), JSON.stringify(s));
  }
});

test('a kuponos level e-mail mezoje: az e-mail, kozvetlenul utana a "Kupon kod: <KOD>" sor (szokozzel, ujsorral, elvalaszto nelkul, nagybetuvel, ekezet nelkul, angol cimkevel) -> a tiszta e-mail, a kuponkod nelkul', () => {
  const kodok = ['KUPXYZ9', 'AB12CD', 'Q1', '9876543210'];
  const cimkek = ['Kupon kód:', 'KUPON KÓD:', 'Kupon kod:', 'kupon kód :', 'Kuponkód:', 'Coupon code:', 'COUPON CODE:'];
  const elvalasztok = [' ', '\n', '\r\n', '\t', '   ', '']; // az utolso: osszeerve (a HTML->szoveg utan nincs biztos elvalaszto)
  for (const kod of kodok) for (const c of cimkek) for (const el of elvalasztok) {
    for (const utan of [' ', '', '\n']) {
      const mezo = `${TISZTA}${el}${c}${utan}${kod}`;
      assert.equal(emailNormal(mezo), TISZTA, JSON.stringify(mezo));
      assert.ok(!emailNormal(mezo).includes(kod.toLowerCase()), 'a kuponkod nincs a kimenetben');
    }
  }
  assert.equal(emailNormal(`  ${TISZTA.toUpperCase()}   KUPON KÓD:  ABC123 `), TISZTA);
  assert.equal(emailNormal('Kupon kód: ABC123 ' + TISZTA), TISZTA, 'ha a cimke az e-mail elott all, a teljes szovegbol');
  assert.equal(emailNormal('kuponkod@gmail.com Kupon kód: ABC123'), 'kuponkod@gmail.com', 'a "kuponkod" nevu cim nem a cimke (a cimke utan kettospont kell)');
  assert.equal(emailNormal('kuponkod@gmail.comKupon kód: ABC123'), 'kuponkod@gmail.com');
});

test('nincs e-mail-szeru token -> null (a kuponkod sosem lesz e-mail); az elso e-mail-szeru token nyer', () => {
  for (const mezo of ['Kupon kód: ABC123', 'Kupon kód:', 'Coupon code: ABC123', 'kupon kód', 'ABC123', 'Teszt Claude', '@ Kupon kód: X']) assert.equal(emailNormal(mezo), null, mezo);
  assert.equal(emailNormal('elso@pelda.hu masodik@pelda.hu'), 'elso@pelda.hu');
  assert.equal(emailNormal('Teszt Claude teszt@pelda.hu'), 'teszt@pelda.hu');
});

test('kuponNelkul (az external_id tartalek-aga): a kuponkod-cimketol kezdve semmi nem marad; a cimke nelkuli szoveg valtozatlan', () => {
  assert.equal(kuponNelkul('Kupon kód: ABC123'), '');
  assert.equal(kuponNelkul(`${TISZTA} Kupon kód: ABC123`), `${TISZTA} `);
  assert.equal(kuponNelkul(`${TISZTA}KUPON KÓD:ABC123`), TISZTA);
  assert.equal(kuponNelkul('x'), 'x'); assert.equal(kuponNelkul(''), ''); assert.equal(kuponNelkul(null), ''); assert.equal(kuponNelkul('kuponkod@gmail.com'), 'kuponkod@gmail.com');
});

test('hashEmail: a kuponos mezo hash-e pontosan a tiszta e-mail SHA-256-ja; a kuponkod nincs a hash bemenetben', async () => {
  const elvart = await sha256hex(TISZTA);
  assert.equal(await hashEmail(TISZTA), elvart);
  for (const mezo of [`${TISZTA} Kupon kód: KUPXYZ9`, `${TISZTA}\nKupon kód: KUPXYZ9`, `${TISZTA}Kupon kód: KUPXYZ9`]) assert.equal(await hashEmail(mezo), elvart, JSON.stringify(mezo));
  assert.equal(await hashEmail('Kupon kód: KUPXYZ9'), null);
  assert.equal(await hashEmail(''), null);
});
