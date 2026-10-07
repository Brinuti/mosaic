// A lifecycle-uzenetkatalogus ellenorzese (netlify/lib/lifecycle/katalog/*.js, formatum: SEMA.md).
// Futtatas: node --test tools/lifecycle-teszt/katalog.test.mjs     (egy uzletag: --test-name-pattern "oxygen")
import test from 'node:test';
import assert from 'node:assert/strict';
import { KATALOG, KOZOS } from '../../netlify/lib/lifecycle/katalog/index.js';
import { HELYORZOK, CSATORNAK, MIKOR_TIPUSOK, SZEGMENSEK, BLOKK_KULCSOK, SMS_MAX_KARAKTER } from '../../netlify/lib/lifecycle/katalog/ertekek.js';

const UZLETAGAK = ['headspa', 'hair', 'oxygen', 'laser', 'pmu'];
const ELOTAG = { headspa: 'HS', hair: 'HAIR', oxygen: 'OX', laser: 'LASER', pmu: 'PMU' };
const KIEGESZITO_ELOTAG = { pmu: ['PMU-KONZ'] }; // a dokumentum tovabbi azonositoi (pl. PMU-KONZ-EMAIL-01)
// legrosszabb eset: milyen hosszu lehet egy helyorzo kitoltve (SMS-hosszhoz)
const LEGHOSSZABB = {
  'keresztnév': 'Alexandra', 'dátum': 'szeptember 30. (csütörtök)', 'dátum_ragos': 'szeptember 30-án', 'nap': 'csütörtök', 'időpont': '16:30',
  'szolgáltatás': 'Balayage / ombre / babylight +tőfestés+ vágás', 'munkatárs': 'Bozsoki-Harangozó Tündi', 'fodrász': 'Bozsoki-Harangozó Tündi',
  'várható_időtartam': '4 óra 30 perc', 'aktuális_ár': '', 'aktuális_ajánlat': '', 'foglalás_részletei_link': 'https://www.mosaicheadspa.hu/f/0123456789',
  'módosítás_link': 'https://www.mosaicheadspa.hu/f/0123456789', 'megerősítés_link': 'https://www.mosaicheadspa.hu/m/0123456789',
  'foglalás_link': 'https://www.mosaicheadspa.hu/oxigenterapia-budapest', 'navigáció_link': 'https://www.mosaicheadspa.hu/n', 'eredmények_link': 'https://www.mosaicheadspa.hu/x',
  'videó_link': 'https://www.mosaicheadspa.hu/x', 'új_dátum': 'szeptember 30. (csütörtök)', 'új_időpont': '16:30', 'telefon': '06 20 247 4444', 'cím': '1023 Budapest, Bécsi út 2.',
};

const helyorzok = (s) => [...String(s).matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]);
function szovegek(uzenet) {
  const ki = [];
  const blokk = (b) => {
    if (typeof b === 'string') ki.push(b);
    else if (b && typeof b === 'object') {
      for (const [k, v] of Object.entries(b)) {
        if (k === 'lista' || k === 'szamozott' || k === 'doboz') ki.push(...v);
        else if (k === 'gomb') ki.push(v.felirat, v.link);
        else if (k === 'alairas') ki.push(v);
      }
    }
  };
  if (uzenet.szoveg) ki.push(uzenet.szoveg);
  if (uzenet.targy) ki.push(uzenet.targy);
  if (uzenet.elotag) ki.push(uzenet.elotag);
  (uzenet.torzs || []).forEach(blokk);
  (uzenet.surgos_kiegeszites || []).forEach(blokk);
  return ki;
}

test('mind az ot uzletag katalogusa meg van irva', () => {
  for (const u of UZLETAGAK) assert.ok(KATALOG[u]?.uzenetek?.length > 0, `${u}: ures katalogus`);
});

for (const [kulcs, kat] of [...Object.entries(KATALOG), ['kozos', KOZOS]]) {
  test(`${kulcs}: szerkezet es szovegek`, { skip: kat.uzenetek.length === 0 ? 'meg nincs megirva' : false }, () => {
    assert.equal(kat.uzletag, kulcs);
    const idk = new Set();
    for (const m of kat.uzenetek) {
      const hol = `${kulcs}/${m.id}`;
      assert.match(m.id, /^[A-Z]+(-[A-Z]+)*-(SMS|EMAIL|CALL)-\d{2}[A-Z]?$|^COMMON-[A-Z-]+$/, `${hol}: hibas azonosito`);
      if (kulcs !== 'kozos') {
        const elotagok = [ELOTAG[kulcs], ...(KIEGESZITO_ELOTAG[kulcs] || [])];
        assert.ok(elotagok.some((e) => m.id.startsWith(e + '-')), `${hol}: az azonosito elotagja ${elotagok.join('/')} legyen`);
      }
      assert.ok(!idk.has(m.id), `${hol}: ismetlodo azonosito`); idk.add(m.id);
      assert.ok(CSATORNAK.includes(m.csatorna), `${hol}: ismeretlen csatorna`);
      assert.ok(m.mikor && MIKOR_TIPUSOK.includes(m.mikor.tipus), `${hol}: ismeretlen mikor.tipus`);
      if (m.mikor.tipus === 'tartalom') {
        assert.equal(m.csatorna, 'email', `${hol}: tartalmi uzenet csak e-mail lehet`);
        assert.ok(Number.isFinite(m.mikor.utan_napok) !== Number.isFinite(m.mikor.elott_napok), `${hol}: pontosan egy: utan_napok VAGY elott_napok`);
        assert.ok(Number.isFinite(m.mikor.min_lead_nap), `${hol}: min_lead_nap kell`);
        assert.ok(Number.isFinite(m.sorrend), `${hol}: sorrend kell`);
      }
      if (m.mikor.tipus === 'feladat') assert.ok(Number.isFinite(m.mikor.elott_ora), `${hol}: elott_ora kell`);
      if (m.csatorna === 'feladat') assert.ok(['feladat', 'feladat_t0'].includes(m.mikor.tipus), `${hol}: a feladat mikor.tipusa feladat/feladat_t0`);
      for (const mezo of ['szegmensek', 'nem_szegmensek']) for (const s of m[mezo] || []) assert.ok(SZEGMENSEK.includes(s), `${hol}: ismeretlen szegmens (${s})`);

      if (m.csatorna === 'sms') {
        assert.equal(typeof m.szoveg, 'string', `${hol}: SMS-hez szoveg kell`);
        assert.ok(!m.torzs && !m.targy, `${hol}: SMS-nek nincs torzse/targya`);
      } else {
        assert.equal(typeof m.targy, 'string', `${hol}: targy kell`);
        assert.ok(Array.isArray(m.torzs) && m.torzs.length > 0, `${hol}: torzs kell`);
        if (m.csatorna === 'email') {
          assert.equal(typeof m.elotag, 'string', `${hol}: elotag (preheader) kell`);
          assert.ok(m.torzs.some((b) => b && b.alairas), `${hol}: alairas-blokk kell`);
        }
      }
      if (m.surgos_kiegeszites) assert.ok(m.mikor.tipus === 't0' && m.csatorna === 'email', `${hol}: surgos_kiegeszites csak t0 e-mailen`);

      // blokk-szerkezet
      for (const b of [...(m.torzs || []), ...(m.surgos_kiegeszites || [])]) {
        if (typeof b === 'string') continue;
        const k = Object.keys(b);
        assert.equal(k.length, 1, `${hol}: a blokknak egy kulcsa lehet`);
        assert.ok(BLOKK_KULCSOK.includes(k[0]), `${hol}: ismeretlen blokk (${k[0]})`);
        if (k[0] === 'gomb') assert.ok(b.gomb.felirat && b.gomb.link, `${hol}: gomb felirat+link`);
        if (['lista', 'szamozott', 'doboz'].includes(k[0])) assert.ok(Array.isArray(b[k[0]]) && b[k[0]].length > 0, `${hol}: ures ${k[0]}`);
      }

      // helyorzok, fix ar / kedvezmeny nincs a szovegben
      for (const s of szovegek(m)) {
        for (const h of helyorzok(s)) assert.ok(HELYORZOK[h], `${hol}: ismeretlen helyorzo {${h}}`);
        assert.ok(!/\d[\d\s.]*\s?(Ft|FT|forint)\b/.test(s.replace(/\{[^}]+\}/g, '')) && !/\d+\s?%/.test(s), `${hol}: fix ar / kedvezmeny a szovegben (tilos): "${s.slice(0, 80)}"`);
        assert.ok(!/\b(június|július|augusztus|szeptember)i?\s+(akció|kedvezmény)|júniusban/i.test(s), `${hol}: lejart honapnevu akcio`);
      }
      if (m.csatorna === 'sms') {
        assert.ok(!helyorzok(m.szoveg).some((h) => ['aktuális_ár', 'aktuális_ajánlat'].includes(h)), `${hol}: SMS-ben nincs ar/ajanlat`);
        const kitoltve = m.szoveg.replace(/\{([^{}]+)\}/g, (_, h) => LEGHOSSZABB[h] ?? '');
        assert.ok([...kitoltve].length <= SMS_MAX_KARAKTER, `${hol}: az SMS tul hosszu (${[...kitoltve].length} > ${SMS_MAX_KARAKTER})`);
      }
    }
  });
}
