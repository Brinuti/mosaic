// Medical Piercing (uzletag 'mp') a lifecycle-motorban: felismeres (customer=medicalpiercing), szegmensek, utemezes a lead-time szerint,
// a kesz HTML-sablonok kitoltese (helyorzo nem marad), velemenyek a D1-bol, a kuldes a relay-en at (soha nem a MOSAIC postafiokjabol),
// sajat lemondas / athelyezes uzenetek, a MOSAIC /f es /m linkje az MP-oldalra iranyit. Futtatas: node --test tools/lifecycle-teszt/mp.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { d1, hamisKuldok, MOST, ORA, NAP, UUID1, szam } from './seged.mjs';
import { ertelmez } from '../../netlify/lib/lifecycle/parser.js';
import { ingest, tick } from '../../netlify/lib/lifecycle/engine.js';
import { tervez } from '../../netlify/lib/lifecycle/terv.js';
import { KATALOG } from '../../netlify/lib/lifecycle/katalog/index.js';
import { ertekek, emailKirajzol, smsKirajzol } from '../../netlify/lib/lifecycle/render.js';
import { szegmensek, uzletagFelismer, mpHelyszin } from '../../netlify/lib/lifecycle/uzletag.js';
import { kuldokKeszit } from '../../netlify/lib/lifecycle/kuldok.js';
import { reszletek, megerosites } from '../../netlify/lib/lifecycle/http.js';
import { helyi } from '../../netlify/lib/lifecycle/ido.js';

const MINTA = JSON.parse(fs.readFileSync(new URL('./fixtures/mp-ertesitok.json', import.meta.url), 'utf8'));
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const NAPOK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
/** a Salonic-datum ("október 22. (csütörtök) 14:30") a MOST + leadOra-hoz (14:30-ra kerekitve) */
function salonicDatum(leadNap) {
  const l = helyi(MOST + leadNap * NAP);
  return `${HONAP[l.m - 1]} ${l.d}. (${NAPOK[l.nap]}) 14:30`;
}
const level = (minta, { datum, uuid = UUID1, uzenetId, munka, szolg } = {}) => {
  let html = minta.html.replace('{DATUM}', datum).replace('{UUID}', uuid);
  if (munka) html = html.replace('Munkatárs: Kovács Gabriella', `Munkatárs: ${munka}`);
  if (szolg) html = html.split('1 db Fejfájás / Migrén Piercing').join(szolg);
  return { ...minta, uzenetId: uzenetId || minta.uzenetId, targy: szolg ? minta.targy.replace('1 db Fejfájás / Migrén Piercing', szolg) : minta.targy, html };
};
const HELYORZO_MARADT = /\{[\p{L}_]+\}|\{vélemény:|<!--\?|<!--\|-->|undefined|null/u;

test('mp: felismeres a Salonic-fiokbol (customer=medicalpiercing); a felado-nev csak pontos egyezessel; a MOSAIC valtozatlan', () => {
  const e = ertelmez(level(MINTA.foglalt, { datum: salonicDatum(10) }), MOST);
  assert.equal(e.ok, true); assert.equal(e.uzletag, 'mp'); assert.equal(e.fiok, 'medicalpiercing'); assert.equal(e.foglalasId, UUID1); assert.equal(e.munkatars, 'Kovács Gabriella');
  // a lemondas-ertesitoben nincs customer= link: a feladó PONTOS neve dont
  assert.equal(ertelmez(level(MINTA.lemondott, { datum: salonicDatum(10) }), MOST).uzletag, 'mp');
  assert.equal(uzletagFelismer({ kuldo: 'Medical Piercing Kft. <app@salonic.hu>' }), null, 'nem pontos nev: nem iranyit felre');
  assert.equal(uzletagFelismer({ fiok: 'mosaic-hair', kuldo: 'Medical Piercing <app@salonic.hu>' }), 'hair', 'a fiok dont, nem a felado');
  assert.equal(uzletagFelismer({ kuldo: 'Mosaic Hair <app@salonic.hu>' }), 'hair');
});

test('mp: szegmensek (piercing-tipus + bp/videk a munkatarsbol)', () => {
  assert.deepEqual(szegmensek('mp', '1 db Fejfájás / Migrén Piercing', 'Kovács Gabriella'), ['migren', 'bp']);
  assert.deepEqual(szegmensek('mp', '🔥 3 PIERCING - A HARMADIK 5.000 Ft!🔥', 'Nagy -Markó Fanni'), ['shenmen', 'bp']);
  assert.deepEqual(szegmensek('mp', '🔥 2 PIERCING A 2.FÉLÁRON! 🔥', 'Fekete Henrietta'), ['shenmen', 'videk']);
  assert.deepEqual(szegmensek('mp', '1 db Klimax- / Változókor piercing', 'Mester Brigitta'), ['klimax', 'videk']);
  assert.deepEqual(szegmensek('mp', '1 db Slim- / Étvágycsökkentő piercing', 'Kamilli Viktória'), ['slim', 'bp']); // ket helyszinen dolgozik: bp-valtozat, helyszin-sorok nelkul
  assert.equal(mpHelyszin('Kamilli Viktória'), null);
  assert.deepEqual(szegmensek('mp', '1+1 db Allergia piercing', ''), ['allergia', 'bp']);
  assert.deepEqual(szegmensek('mp', '1 db Máj Piercing', 'Kovács Richárd'), ['egyeb', 'bp']);
  assert.deepEqual(szegmensek('mp', '3 db Fülbevaló- / Divat fülpiercing szúrás', 'Szalai Nóra'), ['egyeb', 'videk']);
});

test('mp: utemezes a lead-time szerint (T0 e-mail+SMS; T-24 SMS; 3+ nap T-48 level; 4+ nap T-72 SMS; 5+ nap E1; 7+ nap E2; 14+ nap E3)', () => {
  const idk = (leadOra, szeg = ['migren', 'bp']) => tervez({ uzletag: 'mp', szegmensek: szeg, kezdet: MOST + leadOra * ORA }, MOST).terv.map((x) => x.uzenet_id).sort();
  assert.deepEqual(idk(20), ['MP-EMAIL-01', 'MP-SMS-01']);
  assert.deepEqual(idk(48), ['MP-EMAIL-01', 'MP-SMS-01', 'MP-SMS-03']);
  assert.deepEqual(idk(80), ['MP-EMAIL-01', 'MP-EMAIL-10', 'MP-SMS-01', 'MP-SMS-03']);
  assert.deepEqual(idk(100), ['MP-EMAIL-01', 'MP-EMAIL-10', 'MP-SMS-01', 'MP-SMS-02', 'MP-SMS-03']);
  assert.deepEqual(idk(6 * 24), ['MP-EMAIL-01', 'MP-EMAIL-03', 'MP-EMAIL-10', 'MP-SMS-01', 'MP-SMS-02', 'MP-SMS-03']);
  assert.deepEqual(idk(8 * 24), ['MP-EMAIL-01', 'MP-EMAIL-03', 'MP-EMAIL-08', 'MP-EMAIL-10', 'MP-SMS-01', 'MP-SMS-02', 'MP-SMS-03']);
  assert.deepEqual(idk(15 * 24), ['MP-EMAIL-01', 'MP-EMAIL-03', 'MP-EMAIL-08', 'MP-EMAIL-09', 'MP-EMAIL-10', 'MP-SMS-01', 'MP-SMS-02', 'MP-SMS-03']);
  // videk: a videki T0 / T-48; tipus szerinti E1; az "egyeb" (pl. maj, divat) nem kap E1-et
  assert.deepEqual(idk(15 * 24, ['klimax', 'videk']), ['MP-EMAIL-02', 'MP-EMAIL-05', 'MP-EMAIL-08', 'MP-EMAIL-09', 'MP-EMAIL-11', 'MP-SMS-01', 'MP-SMS-02', 'MP-SMS-03']);
  assert.ok(!idk(15 * 24, ['egyeb', 'bp']).some((x) => ['MP-EMAIL-03', 'MP-EMAIL-04', 'MP-EMAIL-05', 'MP-EMAIL-06', 'MP-EMAIL-07'].includes(x)));
  // idopontok: E1 a foglalas utan 1 nappal, a T-48 48 oraval elotte, a tartalmi levelek 24 oranal nem kozelebb egymashoz, az utolso legalabb 96 oraval elotte
  const kezdet = MOST + 15 * NAP;
  const t = tervez({ uzletag: 'mp', szegmensek: ['migren', 'bp'], kezdet }, MOST).terv;
  const ido = (id) => t.find((x) => x.uzenet_id === id).esedekes;
  assert.equal(helyi(ido('MP-EMAIL-03')).kulcs, helyi(MOST + NAP).kulcs.slice(0, 10) + ' 10:00');
  assert.equal(ido('MP-EMAIL-10'), kezdet - 48 * ORA);
  assert.ok(ido('MP-EMAIL-08') - ido('MP-EMAIL-03') >= 24 * ORA && ido('MP-EMAIL-09') - ido('MP-EMAIL-08') >= 24 * ORA && ido('MP-EMAIL-09') <= kezdet - 96 * ORA);
  // a MOSAIC keretje valtozatlan (oxigen: 7 nap = 1 tartalmi level)
  assert.equal(tervez({ uzletag: 'oxygen', szegmensek: ['elso'], kezdet: MOST + 7 * NAP }, MOST).terv.filter((x) => ['OX-EMAIL-02', 'OX-EMAIL-03'].includes(x.uzenet_id)).length, 1);
});

test('mp: minden sablon kitoltve hibatlan (bp / videk / ismeretlen munkatars, nevvel / nev nelkul); MOSAIC-adat nincs benne; a velemeny a D1-bol jon vagy kimarad', () => {
  const vel = { v01: { szoveg: 'Proba-velemeny <b>escape</b>', nev: 'Proba Vendég' } };
  let darab = 0;
  for (const munkatars of ['Kovács Gabriella', 'Fekete Henrietta', 'Kamilli Viktória', '']) {
    for (const keresztnev of ['Elek', null]) {
      for (const szolgaltatas of ['1 db Fejfájás / Migrén Piercing', '🔥 3 PIERCING - A HARMADIK 5.000 Ft!🔥']) {
        const f = { uzletag: 'mp', nev: 'TESZT Elek', keresztnev, munkatars, szolgaltatas, token: 'abcdef0123', kezdet: MOST + 10 * NAP, letrehozva: MOST, telefon: '+36301234567', email: 'a@b.hu' };
        for (const uz of KATALOG.mp.uzenetek) {
          const ert = ertekek(f, uz.csatorna, { most: MOST, ujKezdet: MOST + 11 * NAP, velemenyek: vel, googleVelemenyek: 5033 });
          if (uz.csatorna === 'sms') {
            const k = smsKirajzol(uz, ert);
            assert.ok(!HELYORZO_MARADT.test(k.szoveg) && k.szegmens === 1 && / - Medical Piercing$/.test(k.szoveg), `${uz.id}: ${k.szoveg}`);
            assert.ok(!/ !|\s,|\s\.|\.\./.test(k.szoveg), `${uz.id}: irasjel-hiba: ${k.szoveg}`);
            assert.ok(!/mosaic/i.test(k.szoveg) && (!/\/[fm]\//.test(k.szoveg) || /medicalpiercing\.hu\/[fm]\/abcdef0123/.test(k.szoveg)), `${uz.id}: MP-link: ${k.szoveg}`);
          } else {
            const k = emailKirajzol(uz, ert);
            assert.ok(!HELYORZO_MARADT.test(k.html + k.targy + k.szoveg), `${uz.id} (${munkatars || '-'}, ${keresztnev}): maradt helyorzo: ${(k.html.match(HELYORZO_MARADT) || [])[0]}`);
            assert.ok(!/mosaic|Bécsi út/i.test(k.html), `${uz.id}: MOSAIC-adat az MP-levelben`);
            assert.ok(!/MOSAIC Head Spa and Hair/.test(k.html) && /<div class="wrap">/.test(k.html), `${uz.id}: nem a MOSAIC-keretben`);
            if (/href="[^"]*\/[fm]\//.test(k.html)) assert.ok(/href="https:\/\/www\.medicalpiercing\.hu\/[fm]\/abcdef0123"/.test(k.html), `${uz.id}: a /f /m link az MP-oldalra`);
            if (KATALOG.mp.uzenetek.find((u) => u.id === uz.id).html.includes('{vélemény:v01}')) assert.ok(k.html.includes('Proba-velemeny &lt;b&gt;escape&lt;/b&gt;'), `${uz.id}: a D1-velemeny (escape-elve)`);
            assert.ok(!/v0[2-9]|v1\d|v2\d/.test(k.html.match(/class="velem"[\s\S]*?<\/div>/g)?.join('') || ''), 'a hianyzo velemeny kimarad');
            const bp = mpHelyszin(munkatars) === 'bp';
            if (/^MP-EMAIL-(01|10)$/.test(uz.id)) assert.equal(/Újpesti rakpart/.test(k.html), bp, `${uz.id}: a budapesti cim csak biztos budapesti munkatarsnal`);
            if (/^MP-EMAIL-(01|02)$/.test(uz.id)) { assert.equal(/Megvan az időpontod, <span class="dyn">Elek<\/span>!/.test(k.html), !!keresztnev); assert.equal(/<h1>Megvan az időpontod!<\/h1>/.test(k.html), !keresztnev); }
            if (uz.id === 'MP-EMAIL-01') assert.ok(/5 033/.test(k.html) && /3 db piercing \(csomag\)|1 db Fejfájás \/ Migrén Piercing/.test(k.html) && !/5\.000 Ft/.test(k.html));
            if (uz.id === 'MP-EMAIL-01' && munkatars === 'Kovács Gabriella') assert.ok(/f18724_3ae9dfe53a07477fae1a816f79be5098\.jpg/.test(k.html), 'a piercer fotoja az alairasban');
            if (uz.id === 'MP-EMAIL-01' && !munkatars) assert.ok(/Szeretettel vár: <b>a Medical Piercing csapata<\/b>/.test(k.html) && !/<img src="" /.test(k.html));
          }
          darab += 1;
        }
      }
    }
  }
  assert.ok(darab >= 300, String(darab));
});

test('mp: befogadas -> T0 a relay-en (uzletag mp, MP-felado / valaszcim), a velemenyek a D1 mp_velemenyek tablajabol; tick a lead-time szerint', async () => {
  const db = d1();
  db.sqlite.prepare("INSERT INTO mp_velemenyek (kulcs, szoveg, nev) VALUES ('v13', 'Nagyon kedvesek voltak, semmi nem fajt.', 'Proba Anna')").run();
  const k = hamisKuldok();
  const env = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'headspa,hair,oxygen,laser,pmu' }; // az mp NEM elo: csak a teszt-vendeg (TESZT nev) kap uzenetet
  const r = await ingest(db, env, level(MINTA.foglalt, { datum: salonicDatum(15) }), MOST);
  assert.equal(r.ok, true); assert.equal(r.foglalasId, UUID1);
  const f = szam(db, 'SELECT * FROM foglalasok WHERE id = ?1', UUID1);
  assert.equal(f.uzletag, 'mp'); assert.equal(f.fiok, 'medicalpiercing'); assert.equal(f.szegmens, 'migren,bp'); assert.equal(f.teszt, 1);
  const tervezett = db.sqlite.prepare("SELECT uzenet_id FROM kuldesek WHERE foglalas_id = ?1 AND allapot = 'fuggoben' ORDER BY uzenet_id").all(UUID1).map((x) => x.uzenet_id);
  assert.deepEqual(tervezett, ['MP-EMAIL-01', 'MP-EMAIL-03', 'MP-EMAIL-08', 'MP-EMAIL-09', 'MP-EMAIL-10', 'MP-SMS-01', 'MP-SMS-02', 'MP-SMS-03']);
  const t = await tick(db, env, k, MOST, { foglalasId: UUID1, mpErtekeles: async () => 5033 });
  assert.equal(t.elkuldve, 2);
  const mail = k.ki.email[0];
  assert.equal(mail.uzletag, 'mp'); assert.equal(mail.felado, 'Medical Piercing'); assert.equal(mail.valasz, 'medicalpiercing.hu@gmail.com');
  assert.match(mail.targy, /^Visszaigazoltuk az időpontodat: október 22\. \(csütörtök\), 14:30$/);
  assert.ok(!HELYORZO_MARADT.test(mail.html) && /Nagyon kedvesek voltak, semmi nem fajt\./.test(mail.html) && /Proba Anna/.test(mail.html) && /5 033/.test(mail.html));
  assert.ok(/Kovács Gabriella/.test(mail.html) && /Újpesti rakpart 7/.test(mail.html) && /href="https:\/\/www\.medicalpiercing\.hu\/f\/[0-9a-f]{10}"/.test(mail.html));
  assert.equal(k.ki.sms[0].uzletag, 'mp');
  assert.match(k.ki.sms[0].szoveg, /^Szia Elek! Megvan az idopontod: oktober 22\. \(csutortok\) 14:30, Ujpesti rakpart 7\. Reszletek: medicalpiercing\.hu\/f\/[0-9a-f]{10} - Medical Piercing$/);
  // a kesobbi uzenetek az idejukben: E1 masnap 10:00, a T-48 level, a T-24 SMS
  await tick(db, env, k, MOST + NAP + 600);
  assert.ok(k.ki.email.some((m) => /így készül a migrén piercinged/.test(m.targy) || /migrén piercing/.test(m.targy)), JSON.stringify(k.ki.email.map((m) => m.targy)));
  await tick(db, env, k, MOST + 15 * NAP - 48 * ORA + 4.5 * ORA + 600);
  assert.ok(k.ki.email.some((m) => /Két nap múlva találkozunk/.test(m.targy) && /href="https:\/\/www\.medicalpiercing\.hu\/m\/[0-9a-f]{10}">Ott leszek/.test(m.html)));
  // nem teszt-vendeg: az mp nincs a LIFECYCLE_UZLETAGOK-ban -> semmi nem megy ki
  const db2 = d1(); const k2 = hamisKuldok();
  const valodi = level(MINTA.foglalt, { datum: salonicDatum(15), uzenetId: 'mp-g9' });
  valodi.html = valodi.html.replace('TESZT Elek', 'Kiss Réka');
  await ingest(db2, env, valodi, MOST); await tick(db2, env, k2, MOST);
  assert.equal(k2.ki.email.length + k2.ki.sms.length, 0);
});

test('mp: sajat lemondas / athelyezes uzenetek (nem a MOSAIC COMMON-*), az ujratervezes nem torli oket', async () => {
  const db = d1(); const k = hamisKuldok(); const env = { LIFECYCLE_MOD: 'teszt' };
  await ingest(db, env, level(MINTA.foglalt, { datum: salonicDatum(10) }), MOST);
  await tick(db, env, k, MOST);
  // athelyezes (vendeg altal): a Salonic "Foglalás módosítva" levele
  const regi = salonicDatum(10), uj = salonicDatum(12);
  const ath = { uzenetId: 'mp-m1', targy: 'Foglalás módosítva vendég által: 1 db Fejfájás / Migrén Piercing', kuldo: 'Medical Piercing <app@salonic.hu>',
    html: `<table><tr><td>Foglaló adatai:</td></tr><tr><td>Név: TESZT Elek</td></tr><tr><td>Mobiltelefonszám: 06301234567</td></tr><tr><td>E-mail cím: teszt.elek@example.com</td></tr><tr><td>RÉGI dátum: ${regi}</td></tr><tr><td>Új dátum: ${uj}</td></tr><tr><td>1. Szolgáltatás: 1 db Fejfájás / Migrén Piercing</td></tr><tr><td>Munkatárs: Kovács Gabriella</td></tr><tr><td><a href="https://app.salonic.hu/backend/signin/?customer=medicalpiercing&amp;redirect=%2Fcalendar%2FshowBooking%2F%3FbookingId%3D${UUID1}">Foglalás megtekintése</a></td></tr></table>` };
  const r = await ingest(db, env, ath, MOST + ORA);
  assert.equal(r.tipus, 'athelyezve');
  await tick(db, env, k, MOST + ORA);
  assert.ok(k.ki.sms.some((s) => /Megvan az uj idopontod/.test(s.szoveg) && / - Medical Piercing$/.test(s.szoveg)));
  assert.ok(k.ki.email.some((m) => /^Megvan az új időpontod: / .test(m.targy) && m.uzletag === 'mp'));
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-%'").n, 0);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'MP-SMS-05#%' OR uzenet_id LIKE 'MP-EMAIL-12#%'").n, 2);
  // ugyanaz a level masodszor: duplikalt, nincs uj uzenet
  assert.equal((await ingest(db, env, { ...ath, uzenetId: 'mp-m1b' }, MOST + ORA + 60)).duplikalt, true);
  // lemondas
  const lr = await ingest(db, env, level(MINTA.lemondott, { datum: uj }), MOST + 2 * ORA);
  assert.equal(lr.tipus, 'lemondva');
  await tick(db, env, k, MOST + 2 * ORA);
  assert.ok(k.ki.sms.some((s) => /^Szia Elek! Toroltuk a/.test(s.szoveg) && /medicalpiercing\.hu\/idopontfoglalas - Medical Piercing$/.test(s.szoveg)));
  assert.ok(k.ki.email.some((m) => /Töröltük az időpontodat/.test(m.targy) && /href="https:\/\/www\.medicalpiercing\.hu\/idopontfoglalas"/.test(m.html)));
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE allapot = 'fuggoben'").n, 0);
});

test('mp: kuldo - az e-mail a relay-en at megy (x-relay-kulcs), kulcs nelkul NEM megy ki es nem a MOSAIC SMTP-jen; SMS: a fiok kozos, kesobbi sajat domain kulon tokennel', async () => {
  const hivasok = [];
  const fetchFn = async (url, o) => { hivasok.push({ url, o }); if (/connect$/.test(url)) return new Response(JSON.stringify({ access_token: `tok-${new URLSearchParams(o.body).get('domain')}` })); if (/sendSMS$/.test(url)) return new Response(JSON.stringify({ sms_id: 7 })); return new Response(JSON.stringify({ ok: true, id: 'relay-1' })); };
  const k = kuldokKeszit({ MP_RELAY_KULCS: 'titok', SMTP_PASS: 'mosaic-jelszo', SIMPLESMS_JELSZO: 'x', MP_SIMPLESMS_DOMAIN: 'medicalpiercing.hu' }, { fetchFn });
  const v = await k.email({ to: 'a@b.hu', targy: 'T', html: '<p>h</p>', szoveg: 'h', felado: 'Medical Piercing', valasz: 'medicalpiercing.hu@gmail.com', uzletag: 'mp' });
  assert.equal(v.id, 'relay-1');
  assert.equal(hivasok[0].url, 'https://www.medicalpiercing.hu/api/lifecycle-level');
  assert.equal(hivasok[0].o.headers['x-relay-kulcs'], 'titok');
  assert.deepEqual(JSON.parse(hivasok[0].o.body), { to: 'a@b.hu', subject: 'T', html: '<p>h</p>', text: 'h', replyTo: 'medicalpiercing.hu@gmail.com' });
  await k.sms({ telefon: '+36301234567', szoveg: 'x - Medical Piercing', uzletag: 'mp' });
  await k.sms({ telefon: '+36301234567', szoveg: 'y', uzletag: 'hair' });
  const connect = hivasok.filter((h) => /connect$/.test(h.url)).map((h) => new URLSearchParams(h.o.body).get('domain'));
  assert.deepEqual(connect, ['medicalpiercing.hu', 'mosaicheadspa.hu']);
  // kulcs nelkul: vegleges hiba, a fetch / SMTP nem hivodik
  const h2 = [];
  const k2 = kuldokKeszit({ SMTP_PASS: 'mosaic-jelszo' }, { fetchFn: async (u) => { h2.push(u); return new Response('{}'); } });
  await assert.rejects(k2.email({ to: 'a@b.hu', targy: 'T', html: 'h', szoveg: 'h', uzletag: 'mp' }), (e) => e.vegleges === true && /MP_RELAY_KULCS/.test(e.message));
  assert.equal(h2.length, 0);
  // a motorban: a kuldes "hiba" allapotba kerul (nem probalja ujra, nem megy mas uton)
  const db = d1(); const env = { LIFECYCLE_MOD: 'teszt' };
  await ingest(db, env, level(MINTA.foglalt, { datum: salonicDatum(10) }), MOST);
  const kk = { ...kuldokKeszit({ SMTP_PASS: 'mosaic-jelszo' }, { fetchFn: async () => new Response('{}') }), sms: async () => ({ id: 's' }) };
  await tick(db, env, kk, MOST);
  const sor = szam(db, "SELECT allapot, hiba FROM kuldesek WHERE uzenet_id = 'MP-EMAIL-01'");
  assert.equal(sor.allapot, 'hiba'); assert.match(sor.hiba, /MP_RELAY_KULCS/);
});

test('mp: a MOSAIC /f es /m linkje MP-foglalasnal az MP-oldalra iranyit (302), es itt nem ir', async () => {
  const db = d1(); const env = { LIFECYCLE_DB: db, LIFECYCLE_MOD: 'teszt' };
  await ingest(db, env, level(MINTA.foglalt, { datum: salonicDatum(10) }), MOST);
  const token = szam(db, 'SELECT token FROM foglalasok WHERE id = ?1', UUID1).token;
  const f = await reszletek(new Request(`https://www.mosaicheadspa.hu/f/${token}`), env);
  assert.equal(f.status, 302); assert.equal(f.headers.get('location'), `https://www.medicalpiercing.hu/f/${token}`);
  const m = await megerosites(new Request(`https://www.mosaicheadspa.hu/m/${token}`, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone)' } }), env);
  assert.equal(m.status, 302); assert.equal(m.headers.get('location'), `https://www.medicalpiercing.hu/m/${token}`);
  assert.equal(szam(db, 'SELECT megerositve FROM foglalasok WHERE id = ?1', UUID1).megerositve, null);
});
