// A lifecycle-uzenetkatalogus ellenorzese (netlify/lib/lifecycle/katalog/*.js, formatum: SEMA.md).
// Futtatas: node --test tools/lifecycle-teszt/katalog.test.mjs     (egy uzletag: --test-name-pattern "oxygen")
import test from 'node:test';
import assert from 'node:assert/strict';
import { KATALOG, KOZOS } from '../../netlify/lib/lifecycle/katalog/index.js';
import fs from 'node:fs';
import { HELYORZOK, CSATORNAK, MIKOR_TIPUSOK, SZEGMENSEK, BLOKK_KULCSOK, BLOKK_FELTETEL_KULCSOK, ALAIRAS, SMS_MAX_KARAKTER } from '../../netlify/lib/lifecycle/katalog/ertekek.js';
import { VELEMENYEK } from '../../netlify/lib/lifecycle/katalog/velemenyek.js';

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

// ---- kep / velemeny / video blokkok ellenorzese -------------------------------------------------------------------------------------------------
const EMAIL_KEPEK = new URL('../../assets/email/', import.meta.url);
const KEP_MAX_BAJT = 260 * 1024; // a level betoltese mobilon: kepenkent legfeljebb ennyi
function kepMeret(buf) { // JPEG: SOF jelzo; PNG: IHDR -> { w, h }
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('ismeretlen kepformatum');
}
const dekod = (x) => x.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const egy = (x) => dekod(x).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
function kepEllenor(hol, src, alt, minSzeles) {
  assert.ok(src && !/[^a-z0-9._\/-]/.test(src), `${hol}: a kep fajlneve csak kisbetu / szam / . _ - / lehet (${src})`);
  const fajl = new URL(src, EMAIL_KEPEK);
  assert.ok(fs.existsSync(fajl), `${hol}: nincs meg a kep: assets/email/${src}`);
  const buf = fs.readFileSync(fajl);
  assert.ok(buf.length <= KEP_MAX_BAJT, `${hol}: a kep tul nagy (${Math.round(buf.length / 1024)} KB > ${KEP_MAX_BAJT / 1024} KB): ${src}`);
  const { w } = kepMeret(buf);
  assert.ok(w >= minSzeles, `${hol}: a kep tul keskeny (${w}px < ${minSzeles}px): ${src}`);
  assert.ok(typeof alt === 'string' && alt.trim().length >= 5, `${hol}: a kepnek alt-szoveg kell (${src})`);
}
function kepBlokkEllenor(hol, uzletag, kulcs, b) {
  if (kulcs === 'kep') { kepEllenor(hol, b.kep.src, b.kep.alt, 960); }
  else if (kulcs === 'kepek') {
    assert.ok(Array.isArray(b.kepek) && b.kepek.length >= 2 && b.kepek.length <= 3, `${hol}: a "kepek" 2-3 kep`);
    for (const e of b.kepek) kepEllenor(hol, e.src, e.alt, 540);
  } else if (kulcs === 'video') {
    kepEllenor(hol, b.video.src, b.video.alt, 960);
    assert.ok(b.video.link && b.video.felirat, `${hol}: video link + felirat`);
  } else if (kulcs === 'szemely') {
    kepEllenor(hol, b.szemely.src, b.szemely.nev + ' portre', 232);
    assert.ok(b.szemely.nev && b.szemely.szerep, `${hol}: szemely nev + szerep`);
  } else if (kulcs === 'velemeny') {
    const v = VELEMENYEK[b.velemeny];
    assert.ok(v, `${hol}: ismeretlen velemeny: ${b.velemeny}`);
    assert.ok(uzletag === 'kozos' || v.uzletag === 'altalanos' || v.uzletag === uzletag, `${hol}: a(z) ${b.velemeny} velemeny masik uzletage (${v.uzletag})`);
  }
}

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
        else if (k === 'kep') ki.push(v.alt, v.felirat || '', v.link || '');
        else if (k === 'kepek') for (const e of v) ki.push(e.alt, e.felirat || '');
        else if (k === 'video') ki.push(v.alt, v.felirat, v.link);
        else if (k === 'szemely') ki.push(v.nev, v.szerep, v.szoveg || '');
        else if (k === 'velemeny') ki.push(VELEMENYEK[v]?.szoveg || '');
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
          assert.equal(m.torzs.find((b) => b && b.alairas).alairas, ALAIRAS, `${hol}: az alairas minden levelben "${ALAIRAS}"`);
        }
      }
      if (m.surgos_kiegeszites) assert.ok(m.mikor.tipus === 't0' && m.csatorna === 'email', `${hol}: surgos_kiegeszites csak t0 e-mailen`);

      // blokk-szerkezet
      for (const b of [...(m.torzs || []), ...(m.surgos_kiegeszites || [])]) {
        if (typeof b === 'string') continue;
        const k = Object.keys(b).filter((x) => !BLOKK_FELTETEL_KULCSOK.includes(x));
        assert.equal(k.length, 1, `${hol}: a blokknak egy kulcsa lehet (+ feltetel: ${BLOKK_FELTETEL_KULCSOK.join(', ')})`);
        assert.ok(BLOKK_KULCSOK.includes(k[0]), `${hol}: ismeretlen blokk (${k[0]})`);
        kepBlokkEllenor(hol, kulcs, k[0], b);
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

test('velemenyek: a szoveg SZO SZERINT megtalalhato a forras-oldalon (ahol a forras fajl), nev + nem ures, csak valodi (5 csillagos) velemeny', () => {
  for (const [id, v] of Object.entries(VELEMENYEK)) {
    assert.ok(v.nev && v.szoveg && v.szoveg.length >= 20, `${id}: nev + szoveg`);
    assert.ok(['headspa', 'hair', 'oxygen', 'laser', 'pmu', 'altalanos'].includes(v.uzletag), `${id}: uzletag`);
    assert.ok(!/\d[\d\s.]*\s?(Ft|FT|forint)\b|\d+\s?%/.test(v.szoveg), `${id}: a velemenyben nincs ar / szazalek (elavulhat)`);
    if (v.forras.startsWith('foglalas/')) {
      const oldal = egy(fs.readFileSync(new URL('../../' + v.forras, import.meta.url), 'utf8'));
      assert.ok(oldal.includes(v.szoveg.replace(/\s+/g, ' ').trim()), `${id}: a velemeny szovege nincs meg a forras-oldalon (${v.forras})`);
      assert.ok(oldal.includes(v.nev), `${id}: a velezo neve nincs meg a forras-oldalon`);
    }
  }
});
