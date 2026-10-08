// QA-3 tesztszures egysegtesztjei: a Zap tesztFoglalas-szabalya + a negyosztalyos besorolas + a haromutas egyeztetes (DONTES #108)
//   node --test tools/test-qa3-osztaly.mjs
// A tesztekben SZINTETIKUS e-mailek / telefonvegzodesek vannak (a valodi listak szemelyes adatok, kulon fajlban, a repon kivul).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ZAP_NEV_RE, kinyer, zapTalalat, ismertNev, kozeliJelek, probasavban, osztalyoz, haromutas, sorokBetolt, uuidLista } from './meres-proba/qa3-osztaly-lib.mjs';

const SZABALY = { tesztEmailek: ['proba.owner@example.invalid', 'Teszt.Fiok@example.invalid'], telefonVegzodesek: ['123456789', '987654321'], gyanusEmailReszek: ['owner-firm.invalid'] };
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ctx = (extra = {}) => ({ controlled: new Set(), other: new Set(), szabaly: SZABALY, probasavok: [], ...extra });
const gm = (nev, email = 'valodi.vendeg@example.invalid', telefon = '+36 30 111 2222') => ({ nev, email, telefon });

// A Zap kodjanak (01a0e724, tesztFoglalas) szo szerinti masolata a listak parametrezesevel: a lib-et ezzel vetjuk ossze.
function zapReferencia(text, tesztEmailek, vegzodesek) {
  const pick = (t, re) => { const m = t.match(re); return m ? m[1].trim() : ''; };
  const nev = pick(text, /Név:\s*(.+?)\s*Mobiltelefonszám:/);
  const tel = pick(text, /Mobiltelefonszám:\s*(.+?)\s*E-mail cím/).replace(/\D/g, '');
  const mail = pick(text, /E-mail cím:\s*(.+?)\s*Időpont adatok/).toLowerCase();
  return /(^|[\s,.-])teszt($|[\s,.-])/i.test(nev) || tesztEmailek.includes(mail) || new RegExp('(' + vegzodesek.join('|') + ')$').test(tel);
}
const level = (nev, tel, mail) => `Új online foglalás Név: ${nev}   Mobiltelefonszám: ${tel}\n E-mail cím: ${mail}   Időpont adatok Szolgáltatás: X`.replace(/\s+/g, ' ');

test('a Zap nev-szabalya: a "teszt" onallo szo (szokoz, vesszo, pont, kotojel hatarolja)', () => {
  for (const n of ['TESZT – Claude', 'TESZT Claude', 'Feri teszt', 'teszt teszt', 'Teszt', 'Nagy Teszt Anna', 'Kiss-teszt', 'teszt.elek', 'TESZT-Claude']) assert.equal(ZAP_NEV_RE.test(n), true, n);
  // NEM talal (a Zap ezeket valodi foglalasnak veszi): ezek a mi osztalyozonkban kulon sorsra jutnak (lasd lent)
  for (const n of ['Próbafoglalás (TESZT)', 'TESZT–Claude', 'Tesztelek Elek', 'Próba Panni', 'Kovács Anna']) assert.equal(ZAP_NEV_RE.test(n), false, n);
});

test('paritas a Zap kodjaval: ugyanaz az eredmeny szoveges es strukturalt bemenetre is', () => {
  const nevek = ['Kovács Anna', 'TESZT – Claude', 'Feri teszt', 'Próbafoglalás (TESZT)', 'Nagy Teszt Anna', 'Tesztelek Elek', 'teszt.elek'];
  const telek = ['+36 30 111 2222', '06 20 555 123456789', '+36 70 987654321', '+36 1 123 4567', '30/987-6543'];
  const mailek = ['valodi.vendeg@example.invalid', 'PROBA.OWNER@example.invalid', 'teszt.fiok@example.invalid', 'masik@example.invalid'];
  let db = 0;
  for (const nev of nevek) for (const tel of telek) for (const mail of mailek) {
    const szoveg = level(nev, tel, mail);
    const ref = zapReferencia(szoveg, SZABALY.tesztEmailek.map((x) => x.toLowerCase()), SZABALY.telefonVegzodesek);
    assert.equal(zapTalalat(kinyer(szoveg), SZABALY).length > 0, ref, `${nev} | ${tel} | ${mail}`);
    assert.equal(zapTalalat({ nev, telefon: tel, email: mail }, SZABALY).length > 0, ref, `strukturalt: ${nev} | ${tel} | ${mail}`);
    db++;
  }
  assert.equal(db, 7 * 5 * 4);
});

test('a talalat okkodjai: nev / email / telefon kulon-kulon', () => {
  assert.deepEqual(zapTalalat(gm('Feri teszt'), SZABALY), ['zap:nev']);
  assert.deepEqual(zapTalalat(gm('Kovács Anna', 'Proba.Owner@Example.invalid'), SZABALY), ['zap:email']);
  assert.deepEqual(zapTalalat(gm('Kovács Anna', 'x@example.invalid', '+36 30 1 23456789'), SZABALY), ['zap:telefon']);
  assert.deepEqual(zapTalalat(gm('Teszt Anna', 'proba.owner@example.invalid', '06-20-987654321'), SZABALY), ['zap:nev', 'zap:email', 'zap:telefon']);
  assert.deepEqual(zapTalalat(gm('Kovács Anna'), SZABALY), []);
});

test('osztalyozas: a precedencia CONTROLLED_TEST > OTHER_TEST (lista) > OTHER_TEST (Zap-szabaly / ismert nev) > UNKNOWN > REAL', () => {
  const c = ctx({ controlled: new Set([U(1)]), other: new Set([U(2)]) });
  assert.equal(osztalyoz({ uuid: U(1), gmail: gm('Feri teszt') }, c).osztaly, 'CONTROLLED_TEST'); // a futtato listaja nyer akkor is, ha a Zap-szabaly is talal
  assert.equal(osztalyoz({ uuid: U(2), gmail: gm('Kovács Anna') }, c).osztaly, 'OTHER_TEST'); // korabbi QA-UUID
  assert.deepEqual(osztalyoz({ uuid: U(3), gmail: gm('Feri teszt') }, c), { osztaly: 'OTHER_TEST', alosztaly: 'zap-szabaly', okok: ['zap:nev'] });
  assert.deepEqual(osztalyoz({ uuid: U(4), gmail: gm('Próbafoglalás (TESZT)') }, c), { osztaly: 'OTHER_TEST', alosztaly: 'ismert-nev', okok: ['ismert-nev'] }); // a Zap ezt nem fogja meg, a #108 neve viszont OTHER_TEST
  assert.equal(osztalyoz({ uuid: U(5), gmail: gm('Kovács Anna') }, c).osztaly, 'REAL');
});

test('UNKNOWN, soha nem REAL: nem szokott teszt-azonosito / gyanus / nem ertekelheto', () => {
  const c = ctx();
  for (const [nev, email, tel] of [['TESZT–Claude', undefined, undefined], ['Tesztelek Elek', undefined, undefined], ['Próba Panni', undefined, undefined], ['Kovács Anna', 'anna.test@example.invalid', undefined], ['Kovács Anna', 'x@owner-firm.invalid', undefined], ['Kovács Anna', 'x@example.invalid', '+36 70 000 654321']]) {
    const o = osztalyoz({ uuid: U(9), gmail: gm(nev, email, tel) }, c);
    assert.equal(o.osztaly, 'UNKNOWN', `${nev} | ${email} | ${tel}`);
    assert.ok(o.okok.length > 0);
  }
  assert.deepEqual(osztalyoz({ uuid: U(9) }, c), { osztaly: 'UNKNOWN', alosztaly: null, okok: ['nincs-gmail-adat'] }); // nincs Gmail-adat -> nem allithato REAL-nek
  assert.deepEqual(osztalyoz({ uuid: U(9), gmail: { nev: '', email: '', telefon: '' } }, c).okok, ['hianyzo:nev', 'hianyzo:email-es-telefon']);
  assert.deepEqual(kozeliJelek(gm('Kovács Anna', 'x@example.invalid', '+36 70 000 654321'), SZABALY), ['kozeli:telefon']);
});

test('probasav: Feri jelzett probaideje csak REAL -> UNKNOWN iranyba hat; a jelolt teszt marad teszt', () => {
  const c = ctx({ probasavok: [{ tol: '2026-10-08T09:00:00Z', ig: '2026-10-08T09:30:00Z', megjegyzes: 'Feri probaja' }] });
  assert.equal(probasavban('2026-10-08 09:10:00', c.probasavok), true); // D1 datetime() formatum (UTC)
  assert.equal(probasavban('2026-10-08 09:30:00', c.probasavok), false); // a sav also hatara zart, felso nyitott
  assert.equal(probasavban(Date.parse('2026-10-08T09:05:00Z') / 1000, c.probasavok), true); // epoch masodperc
  const benne = osztalyoz({ uuid: U(1), d1: { letrehozva: '2026-10-08 09:10:00' }, gmail: gm('Kovács Anna') }, c);
  assert.deepEqual(benne, { osztaly: 'UNKNOWN', alosztaly: null, okok: ['probasav'] });
  assert.equal(osztalyoz({ uuid: U(2), d1: { letrehozva: '2026-10-08 11:00:00' }, gmail: gm('Kovács Anna') }, c).osztaly, 'REAL');
  assert.equal(osztalyoz({ uuid: U(3), d1: { letrehozva: '2026-10-08 09:10:00' }, gmail: gm('Feri teszt') }, c).osztaly, 'OTHER_TEST');
});

test('a level szovegebol kinyert mezok ugyanazt adjak, mint a strukturalt bemenet', () => {
  const sz = level('TESZT – Claude', '+36 30 111 2222', 'a@example.invalid');
  assert.deepEqual(kinyer(sz), { nev: 'TESZT – Claude', telefon: '+36 30 111 2222', email: 'a@example.invalid' });
  assert.equal(osztalyoz({ uuid: U(1), gmail: { szoveg: sz } }, ctx()).alosztaly, 'zap-szabaly');
  assert.equal(osztalyoz({ uuid: U(2), gmail: { szoveg: level('Kovács Anna', '+36 30 111 2222', 'a@example.invalid') } }, ctx()).osztaly, 'REAL');
  assert.equal(ismertNev('próbafoglalás  (teszt)'), true);
  assert.equal(ismertNev(''), false);
});

test('haromutas: OTHER_TEST kulon sor, a REAL szamba nem kerul; lab-matrix; UNKNOWN kulon', () => {
  const d1 = [1, 2, 3, 4, 5, 6].map((n) => ({ uuid: U(n), allapot: 'parositatlan', letrehozva: '2026-10-08 10:00:00', kuldesi_sorok: 0 }));
  const gmail = [
    { uuid: U(1), ...gm('Kovács Anna') }, { uuid: U(2), ...gm('Nagy Béla') }, { uuid: U(3), ...gm('Feri teszt') },
    { uuid: U(4), ...gm('TESZT–Claude') }, { uuid: U(5), ...gm('Próbafoglalás (TESZT)') }, { uuid: U(7), ...gm('Szabó Cili') },
  ];
  const salonic = [{ uuid: U(1), allapot: 'aktiv' }, { uuid: U(2), allapot: 'torolt' }, { uuid: U(3), allapot: 'aktiv' }, { uuid: U(4), allapot: 'aktiv' }, { uuid: U(5), allapot: 'aktiv' }, { uuid: U(8), allapot: 'aktiv' }];
  const r = haromutas({ d1, gmail, salonic }, ctx({ controlled: new Set([U(6)]), other: new Set([U(10)]) }));
  assert.deepEqual(r.osszesito, { CONTROLLED_TEST: 1, OTHER_TEST: 2, REAL: 3, UNKNOWN: 2 }); // U(10) csak a listan van: nem sor; U(8) csak Salonic + nincs Gmail -> UNKNOWN
  assert.equal(r.real_szam, 3);
  assert.deepEqual(r.other_test_bontas, { 'zap-szabaly': 1, 'ismert-nev': 1 });
  const m = (u) => r.sorok.find((s) => s.uuid === u);
  assert.equal(m(U(3)).osztaly, 'OTHER_TEST'); assert.equal(m(U(3)).labak, 'SGD');
  assert.equal(m(U(4)).osztaly, 'UNKNOWN');
  assert.equal(m(U(6)).osztaly, 'CONTROLLED_TEST'); assert.equal(m(U(6)).labak, 'D');
  assert.equal(m(U(7)).labak, 'G'); assert.equal(m(U(7)).osztaly, 'REAL'); // csak Gmail: REAL, de a "csak Gmail" labon (hianyzo lab)
  assert.equal(m(U(8)).labak, 'S'); assert.equal(m(U(8)).osztaly, 'UNKNOWN'); assert.deepEqual(m(U(8)).okok, ['nincs-gmail-adat']);
  assert.equal(m(U(10)).labak, ''); assert.equal(m(U(10)).osztaly, 'OTHER_TEST');
  assert.equal(r.matrix.REAL.SGD, 2); assert.equal(r.matrix.REAL.G, 1); assert.equal(r.matrix.OTHER_TEST.SGD, 2);
  assert.equal(r.sorok.filter((s) => s.osztaly === 'REAL').length, r.real_szam);
});

test('bemenet-betoltes: D1 MCP kimenet-alakok, UUID-lista', () => {
  const sor = { uuid: U(1) };
  assert.deepEqual(sorokBetolt([sor]), [sor]); assert.deepEqual(sorokBetolt({ results: [sor] }), [sor]); assert.deepEqual(sorokBetolt([{ results: [sor] }]), [sor]); assert.deepEqual(sorokBetolt({ result: [{ results: [sor] }] }), [sor]);
  assert.deepEqual([...uuidLista(`# megjegyzes\n${U(1)}\n${U(2).toUpperCase()} # sorvegi\nnem-uuid\n`)], [U(1), U(2)]);
});

test('CLI: a kimenetben nincs vendegadat (nev, e-mail, telefon, e-mail-lista, telefonvegzodes)', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'qa3-osztaly-'));
  const w = (n, v) => { const f = path.join(d, n); fs.writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v)); return f; };
  const gmail = [{ uuid: U(1), nev: 'Titkos Vendég Aladár', email: 'titkos.vendeg@example.invalid', telefon: '+36 30 999 8877' }, { uuid: U(2), nev: 'Feri teszt', email: 'proba.owner@example.invalid', telefon: '+36 70 123456789' }];
  const args = ['tools/meres-proba/qa3-haromutas.mjs', '--d1', w('d1.json', [{ uuid: U(1), allapot: 'parositatlan', letrehozva: '2026-10-08 10:00:00' }, { uuid: U(2), allapot: 'parositatlan', letrehozva: '2026-10-08 10:05:00' }]),
    '--gmail', w('gmail.json', gmail), '--salonic', w('salonic.json', [{ uuid: U(1), allapot: 'aktiv' }, { uuid: U(2), allapot: 'aktiv' }]), '--szabaly', w('szabaly.json', SZABALY),
    '--controlled', w('c.txt', ''), '--other', w('o.txt', ''), '--nap', 'teszt', '--ki-mappa', d + path.sep, '--felszabadult', '2'];
  const p = spawnSync(process.execPath, args, { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const kimenet = fs.readFileSync(path.join(d, 'qa3-haromutas-teszt.json'), 'utf8') + fs.readFileSync(path.join(d, 'qa3-haromutas-teszt.md'), 'utf8') + p.stdout;
  for (const titok of ['Titkos', 'Aladár', 'titkos.vendeg', '999 8877', 'proba.owner', '123456789', 'Feri teszt', 'owner-firm']) assert.equal(kimenet.includes(titok), false, titok);
  const j = JSON.parse(fs.readFileSync(path.join(d, 'qa3-haromutas-teszt.json'), 'utf8'));
  assert.equal(j.real_szam, 1); assert.deepEqual(j.osszesito, { CONTROLLED_TEST: 0, OTHER_TEST: 1, REAL: 1, UNKNOWN: 0 }); assert.equal(j.felszabadult_kulcsok, 2);
  fs.rmSync(d, { recursive: true, force: true });
});
