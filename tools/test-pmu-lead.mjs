// PM-3: a /foglalo-pmu masodlagos lead-esemenyei (pmu_foto_lead, pmu_visszahivas_lead) a dataLayerbe.
// A segedfuggveny a assets/js/foglalo-pmu.js PM3-BEGIN / PM3-END jelolesei kozott van; itt onallo vm-sandboxban futtatjuk (nincs bongeszo / halozat),
// plusz forras-ellenorzes: a hivasok a SIKERES bekuld() utan, a tovabblepes / atiranyitas elott allnak, az esemeny nem tartalmaz szemelyes adatot.
// Futtatas: node --test tools/test-pmu-lead.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const FORRAS = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'assets/js/foglalo-pmu.js'), 'utf8');
const RESZ = FORRAS.slice(FORRAS.indexOf('// PM3-BEGIN'), FORRAS.indexOf('// PM3-END'));

function vilag({ ana = true, proba = false, suti = true, tarolo = true } = {}) {
  const window = { dataLayer: [] };
  if (suti) window.mhSuti = { engedely: (k) => (k === 'ana' ? ana : false) };
  const localStorage = tarolo ? { getItem: (k) => (k === 'mhProba' && proba ? '1' : null) } : { getItem() { throw new Error('tiltott'); } };
  const ctx = vm.createContext({ window, localStorage, crypto: globalThis.crypto, Date, Math, Uint8Array, Array, Number, Object, RegExp, Set, String });
  const pmuLead = vm.runInContext(`${RESZ}\n pmuLead;`, ctx);
  return { window, pmuLead, dl: () => window.dataLayer };
}

const TILTOTT = /@|\+?\d{6,}|https?:|\/\/|nev|telefon|email|foto_url|kezeles|idopont\b/i;

test('a PM3 szakasz megvan, a segedfuggveny kiolvashato', () => {
  assert.ok(RESZ.includes('const pmuLead'), 'PM3-BEGIN / PM3-END jelolesek kozott van a segedfuggveny');
});

test('foto: hozzajarulassal pontosan 1 esemeny, zart mezokkel, szemelyes adat nelkul', () => {
  const { pmuLead, dl } = vilag();
  const id = pmuLead.ujAzonosito();
  pmuLead('foto', { id, ag: 'D', fotoDb: 3, idopontKert: true, nev: 'Teszt Elek', email: 'x@y.hu', telefon: '06201234567' });
  assert.equal(dl().length, 1);
  const e = dl()[0];
  assert.deepEqual(Object.keys(e).sort(), ['ag', 'business', 'event', 'event_id', 'foto_db', 'idopont_kert', 'lead_type', 'source_page'].sort());
  assert.deepEqual({ ...e }, { event: 'pmu_foto_lead', business: 'pmu', lead_type: 'foto', source_page: '/foglalo-pmu', event_id: id, ag: 'D', foto_db: 3, idopont_kert: 1 });
  // a PII-minta az event_id nelkuli ertekeken fut (a veletlen hex azonosito szamjegy-sorozata fals talalat lenne); az event_id-t kulon regex ellenorzi
  assert.equal(TILTOTT.test(JSON.stringify(Object.entries(e).filter(([k]) => k !== 'event_id').map(([, v]) => v))), false, JSON.stringify(e));
  assert.match(e.event_id, /^pl_[a-z0-9]{8,24}$/);
});

test('foto: ag csak B / D, foto_db 1..5 korlatozott, idopont_kert 0 / 1', () => {
  const { pmuLead, dl } = vilag();
  pmuLead('foto', { ag: 'X', fotoDb: 99, idopontKert: false });
  pmuLead('foto', { ag: 'B', fotoDb: 0, idopontKert: 1 });
  pmuLead('foto', { ag: undefined, fotoDb: 'nem szam' });
  assert.deepEqual(dl().map((e) => [e.ag, e.foto_db, e.idopont_kert]), [['B', 5, 0], ['B', 1, 1], ['B', 1, 0]]);
});

test('visszahivas: hozzajarulassal pontosan 1 esemeny, napszak zart listabol', () => {
  const { pmuLead, dl } = vilag();
  const id = pmuLead.ujAzonosito();
  pmuLead('visszahivas', { id, napszak: 'Kora délután (12–15)', telefon: '06301112233' });
  assert.equal(dl().length, 1);
  const e = dl()[0];
  assert.deepEqual(Object.keys(e).sort(), ['business', 'event', 'event_id', 'lead_type', 'mikor_napszak', 'source_page']);
  assert.deepEqual({ ...e }, { event: 'pmu_visszahivas_lead', business: 'pmu', lead_type: 'visszahivas', source_page: '/foglalo-pmu', event_id: id, mikor_napszak: 'kora_delutan' });
  const { pmuLead: p2, dl: dl2 } = vilag();
  for (const n of ['Délelőtt (9–12)', 'Délután (15–18)', 'Bármikor', 'valami mas', undefined, '__proto__']) p2('visszahivas', { napszak: n });
  assert.deepEqual(dl2().map((x) => x.mikor_napszak), ['delelott', 'delutan', 'barmikor', 'barmikor', 'barmikor', 'barmikor']);
});

test('hozzajarulas nelkul, probajeles bongeszoben, mhSuti nelkul, ismeretlen tipusnal: 0 esemeny', () => {
  for (const v of [vilag({ ana: false }), vilag({ proba: true }), vilag({ suti: false })]) {
    v.pmuLead('foto', { ag: 'B', fotoDb: 1 });
    v.pmuLead('visszahivas', { napszak: 'Bármikor' });
    assert.equal(v.dl().length, 0);
  }
  const v = vilag();
  v.pmuLead('mas', {}); v.pmuLead(undefined, {}); v.pmuLead('__proto__', {});
  assert.equal(v.dl().length, 0);
});

test('azonos azonositoval masodszor nem pushol (beadasonkent egyszer); uj beadas uj azonositot kap', () => {
  const { pmuLead, dl } = vilag();
  const id = pmuLead.ujAzonosito();
  pmuLead('foto', { id, ag: 'B', fotoDb: 1 });
  pmuLead('foto', { id, ag: 'B', fotoDb: 1 });
  assert.equal(dl().length, 1);
  const masik = pmuLead.ujAzonosito();
  assert.notEqual(masik, id);
  pmuLead('foto', { id: masik, ag: 'B', fotoDb: 1 });
  assert.equal(dl().length, 2);
  // ervenytelen / kitalalt azonosito (pl. szemelyes adat) nem kerul az esemenybe
  pmuLead('visszahivas', { id: 'Teszt Elek 06201234567', napszak: 'Bármikor' });
  assert.match(dl()[2].event_id, /^pl_[a-z0-9]{8,24}$/);
  assert.notEqual(dl()[2].event_id, 'Teszt Elek 06201234567');
});

test('tiltott localStorage: nem dob, az esemeny megy (nem proba)', () => {
  const { pmuLead, dl } = vilag({ tarolo: false });
  assert.doesNotThrow(() => pmuLead('foto', { ag: 'B', fotoDb: 1 }));
  assert.equal(dl().length, 1);
});

test('forras: a hivasok a sikeres bekuld() UTAN, a tovabblepes / atiranyitas ELOTT allnak; a hivasok szama pontosan 2', () => {
  assert.equal((FORRAS.match(/pmuLead\('(foto|visszahivas)'/g) || []).length, 2);
  const foto = FORRAS.indexOf("await bekuld(adat, gomb, $('foto-kuld-hiba'))");
  const fotoLead = FORRAS.indexOf("pmuLead('foto'");
  const fotoTorol = FORRAS.indexOf('allapot.fotok = [];', fotoLead);
  assert.ok(foto > 0 && fotoLead > foto && fotoTorol > fotoLead, 'foto: bekuld -> pmuLead -> fotok torlese');
  const vh = FORRAS.indexOf("await bekuld(adat, gomb, $('c-kuld-hiba'))");
  const vhLead = FORRAS.indexOf("pmuLead('visszahivas'");
  const atir = FORRAS.indexOf("window.top.location.assign('/pmu-vh')");
  assert.ok(vh > 0 && vhLead > vh && atir > vhLead, 'visszahivas: bekuld -> pmuLead -> atiranyitas');
  // a hivasok a sikertelen kuldesnel (return false) nem futnak: kozvetlenul a `) return;` sor utan allnak
  assert.match(FORRAS, /if \(!\(await bekuld\(adat, gomb, \$\('foto-kuld-hiba'\)\)\)\) return;\n    pmuLead\('foto'/);
  assert.match(FORRAS, /if \(!\(await bekuld\(adat, gomb, \$\('c-kuld-hiba'\)\)\)\) return;\n    pmuLead\('visszahivas'/);
});

test('forras: a segedfuggveny nem kuld halozati kerest, nem ir sutit / tarolot (csak dataLayer)', () => {
  assert.doesNotMatch(RESZ, /fetch\(|sendBeacon|XMLHttpRequest|document\.cookie|sessionStorage\.setItem|localStorage\.setItem|location\./);
});
