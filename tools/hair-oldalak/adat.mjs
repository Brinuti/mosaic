// A fodraszat-oldalak (kozponti + Betti + Noel + Evelin) KOZOS adatmodellje: szolgaltatasok, arak, idotartamok, fodraszok, fotok, szovegek.
//
// Egyetlen forras minden oldalhoz (a MOSAIC_Hair_implementation_v2 csomag szabalya: az arakat nem szabad oldalankent beirni):
//   - arak, idotartamok, hajhosszak, ki mit vallal: tools/hair-oldalak/salonic-hair.json (a Salonic pillanatkepe, ugyanez az ar a foglaloban);
//   - fotok: kizarolag a meglevo, valodi MOSAIC-fotok (tools/content/<regi oldal>.json blokk-sorszama szerint), kitalalt/generalt kep nincs;
//   - szovegek: a regi oldalak szovegei (a fodraszok sajat hangja), a doc/prototipus szovegei; szam-allitas (tapasztalati ev, "98%-a visszajar",
//     ertekeles) NINCS: ezek nem igazolhatok (lasd docs/HAIR_OLDALAK.md, "Kihagyott allitasok").
import fs from 'node:fs';
import path from 'node:path';

export const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const olvas = (...p) => JSON.parse(fs.readFileSync(path.join(GYOKER, ...p), 'utf8'));
export const PILLANATKEP = olvas('tools', 'hair-oldalak', 'salonic-hair.json');

// ---- az oldalak -------------------------------------------------------------------------------------------------------------------------
// fajl: az oldal ELES cime (2026-10-09 ota az eredeti cim: a tulajdonos kifejezett kerese); ujCim: az ideiglenes cim, ami 301-gyel ide iranyit (netlify/lib/utvonal.js);
// a regi (Wixes) oldal rejtett cime: /<fajl>-regi (klon/<fajl>-regi.html, noindex)
export const LAPOK = {
  kozpont: { kulcs: 'kozpont', fajl: 'noi-fodraszat-budapest', ujCim: 'noi-fodraszat-budapest-uj', eredeti: 'noi-fodraszat-budapest', regiTartalom: 'noi-fodraszat-budapest', menu: '/noi-fodraszat-budapest' },
  betti: { kulcs: 'betti', fajl: 'noi-fodrasz-budapest-balayage-hajfestes', ujCim: 'noi-fodrasz-budapest-balayage-hajfestes-uj', eredeti: 'noi-fodrasz-budapest-balayage-hajfestes', regiTartalom: 'noi-fodrasz-budapest-balayage-hajfestes', menu: '/noi-fodrasz-budapest-balayage-hajfestes' },
  noel: { kulcs: 'noel', fajl: 'balayage-haj-festes-budapest', ujCim: 'balayage-haj-festes-budapest-uj', eredeti: 'balayage-haj-festes-budapest', regiTartalom: 'balayage-haj-festes-budapest', menu: '/balayage-haj-festes-budapest' },
  evelin: { kulcs: 'evelin', fajl: 'noi-hajfestes-budapest', ujCim: 'noi-hajfestes-budapest-uj', eredeti: 'noi-hajfestes-budapest', regiTartalom: 'noi-hajfestes-budapest', menu: '/noi-hajfestes-budapest' },
};
export const oldalUt = (kulcs) => '/' + LAPOK[kulcs].fajl;

export const SZALON = {
  nev: 'MOSAIC Hair',
  cim: '1023 Budapest, Bécsi út 2.',
  hely: 'a Kolosy tér és a Zsigmond tér között',
  telefon: '06 20 247 4444',
  telefonLink: 'tel:+36202474444',
  nyitva: 'Hétfő–péntek: 8:00–20:00',
  zarva: 'Szombat, vasárnap: zárva',
  terkepKereses: 'MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.',
};
export const TERKEP_LINK = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(SZALON.terkepKereses);
export const GOOGLE_VELEMENYEK_LINK = TERKEP_LINK;

// ---- foglalo-linkek (a foglalo-motor mar tudja: ?staff=, ?category=, ?service=) -----------------------------------------------------------
export const foglalo = ({ staff, category, service } = {}) => {
  const q = ['business=hair'];
  if (staff) q.push('staff=' + staff);
  if (category) q.push('category=' + category);
  if (service) q.push('service=' + service);
  return '/foglalo-motor?' + q.join('&');
};
export const KONZULT = 'konzultacio'; // a Salonic "Ingyenes Fodrasz konzultacio" szolgaltatas kulcsszava (service= szoreszlet-egyezes)

// ---- fodraszok ---------------------------------------------------------------------------------------------------------------------------
const fodraszAdat = (kulcs) => PILLANATKEP.fodraszok.find((f) => f.kulcs === kulcs);
export const FODRASZOK = {
  betti: {
    kulcs: 'betti', nev: 'Betti', teljesNev: 'Pető Betti', lap: 'betti', rag: { hez: 'Bettihez', vel: 'Bettivel', t: 'Bettit', nal: 'Bettinél' },
    szakterulet: 'Festés, balayage, melír és személyre szabott női frizurák',
    // a mostani (Wixes) oldal cime (a tulajdonos kerese: az eredeti cimek legyenek a H1-ben); kartyaSzoveg: egy sor a kozponti oldal kartyajan; mobil hero: alcim + 2 blokk
    h1: 'Tökéletes festés és vágás 18 év tapasztalattal.', h1Mobil: 'Festés, balayage, tőfestés a te stílusodban', kartyaSzoveg: 'Festés, balayage, melír', alcim: 'Festés, balayage', blokkok: ['Személyre szabott frizurák', 'Részletes konzultáció'],
    rovid: 'Részletes konzultációval és a hozzád illő stílussal várlak.',
    idezet: 'Végre olyan hajad lesz, amilyet megálmodtál!',
    bemutatkozas: [
      'A hajunk az egyik legfontosabb ékszerünk, és egy elrontott szín vagy forma hetekre, akár hónapokra beárnyékolhatja az önbizalmunkat. Pontosan értem, miért érzel így.',
      'Nálam minden az odafigyelésről és a kommunikációról szól. Első alkalommal részletesen megbeszéljük, mit szeretnél és mit kerülnél el, plusz tanácsot is adok, hogy minden úgy sikerüljön, ahogy megálmodtad.',
    ],
    festek: { nev: 'Schwarzkopf Professional Igora Royal', szoveg: 'Azért szeretem, mert tökéletes az őszhaj fedésére, gyönyörű hamvas árnyalatokat lehet vele készíteni, a színe tartós, és mindezt egy prémium márkától kapom. A balayage és a melír technikákhoz használom: természetes, lágy átmeneteket ad, és a haj fényes, egészséges marad a festés után is.' },
    kiemelesek: ['Személyre szabott tanácsadás', 'Prémium hajfestékek', 'Természetes, lágy átmenetek'],
    miert: [
      ['Te vagy a középpontban', 'Minden festésnél alaposan átbeszéljük az elképzeléseidet, és minden tudásommal igyekszem kihozni a legtöbbet a vágyaidból.'],
      ['Minőségi hajfesték', 'Schwarzkopf Professional Igora Royal: tartós szín, gyönyörű, hamvas árnyalatok, őszhaj-fedés.'],
      ['Előbb beszélünk, aztán festünk', 'Az ingyenes konzultáción megnézzük a hajad állapotát, és megbeszéljük, mi a reális.'],
    ],
    szakteruletek: ['balayage', 'festes', 'tofestes', 'ujraepites'],
    gyik: [
      ['Mit hozzak magammal az első alkalomra?', 'Hozz 2–3 inspirációs képet arról, milyen hajszínt vagy fazont szeretnél, és mondd el, mit kerülnél el. Ezt átbeszéljük, és megmondom, mi a reális a hajadból.'],
    ],
  },
  noel: {
    kulcs: 'noel', nev: 'Noel', teljesNev: 'Jakab Noel', lap: 'noel', rag: { hez: 'Noelhez', vel: 'Noellel', t: 'Noelt', nal: 'Noelnél' },
    szakterulet: 'Balayage és precíz festések, természetes hatású árnyalatok',
    h1: 'Természetes hatású festés és vágás 3 év tapasztalattal.', h1Mobil: 'Balayage, festés, tőfestés a te stílusodban', kartyaSzoveg: 'Balayage és precíz festések', alcim: 'Balayage, precíz festés', blokkok: ['Természetes hatású árnyalatok', 'Részletes konzultáció'],
    rovid: 'A balayage és a precíz festések specialistájaként minden vendégemből a legszebb énjét hozom ki.',
    idezet: 'Olyan frizurád lesz, amitől sugározni fogsz.',
    bemutatkozas: [
      'A hajad a megjelenésed egyik legmeghatározóbb része, és egy rosszul sikerült szín vagy fazon hosszú ideig rányomhatja a bélyegét az önbizalmadra. Pontosan tudom, mit érzel ilyenkor, de megnyugodhatsz: nálam biztos kezekben vagy.',
      'Számomra a legfontosabb a figyelem és az őszinte kommunikáció. Az első találkozáskor alaposan átbeszéljük, milyen elképzeléseid vannak, mit szeretnél elkerülni, és hasznos tanácsokkal is ellátlak, hogy a végeredmény pontosan olyan legyen, amilyennek megálmodtad.',
    ],
    festek: null,
    kiemelesek: ['Természetes hatású színek', 'Balayage specialista', 'Figyelem és őszinte kommunikáció'],
    miert: [
      ['A női haj a hivatásom', 'Szenvedélyem a szép hajszínek és természetes hatású árnyalatok megalkotása. Az alkotás számomra nem munka, hanem hivatás, ahol minden egyes tincs számít.'],
      ['Te vagy a középpontban', 'Minden festésnél alaposan átbeszéljük az elképzeléseidet, és mindent megteszek, hogy a végeredmény olyan legyen, amilyennek megálmodtad.'],
      ['Előbb beszélünk, aztán festünk', 'Az ingyenes konzultáción megnézzük a hajad állapotát, és megbeszéljük, mi a reális.'],
    ],
    szakteruletek: ['balayage', 'festes', 'tofestes', 'ujraepites'],
    gyik: [
      ['Miért olcsóbbak Noelnél az árak?', 'Noel jelenleg minden szolgáltatására 20% kedvezményt ad. Ez a foglalóban is látszik: az ár a kedvezménnyel jelenik meg.'],
    ],
  },
  evelin: {
    kulcs: 'evelin', nev: 'Evelin', teljesNev: 'Szaniszló-Cene Evelin', lap: 'evelin', rag: { hez: 'Evelinhez', vel: 'Evelinnel', t: 'Evelint', nal: 'Evelinnél' },
    szakterulet: 'Hajfestés és hajhosszabbítás (póthaj)',
    h1: 'Végre olyan frizurád lesz, amilyet megálmodtál!', h1Mobil: 'Festés, balayage, tőfestés és hajhosszabbítás a te stílusodban', kartyaSzoveg: 'Hajfestés és hajhosszabbítás', alcim: 'Hajfestés, hajhosszabbítás', blokkok: ['Személyre szabott színek', 'Részletes konzultáció'],
    rovid: 'Ingyenes konzultációval és hajhosszabbítással is várlak.',
    idezet: 'Megtaláljuk a hozzád illő színt és vágást, amitől ragyogsz majd!',
    bemutatkozas: [
      'A frizurád az egyik legmeghatározóbb eleme annak, ahogyan mások látnak, és ha a szín vagy a vágás nem sikerül jól, az hosszú távon befolyásolhatja az önbizalmadat. Pontosan átérzem, milyen csalódást tud okozni egy rossz tapasztalat. A jó hír: nálam nyugodt lehetsz.',
      'A legfontosabb számomra, hogy figyeljek rád és valóban megértselek. Az első alkalommal részletesen átbeszéljük az elképzeléseidet, azt is, mit szeretnél elkerülni, és megmutatom, hogyan tudod otthon beállítani a frizurádat.',
    ],
    festek: { nev: 'Schwarzkopf, Luxoya és Fanola', szoveg: 'Mindhárom márka könnyen kezelhető, jól keverhető és kíméletes a hajhoz. Élénk, természetes színeket érünk el velük, az őszhajszálakat gyönyörűen fedik, és a haj puha, selymes marad a tápláló összetevőknek köszönhetően.' },
    kiemelesek: ['Személyre szabott színek', 'Hajhosszabbítás (póthaj)', 'Otthoni beállítási tanácsok'],
    miert: [
      ['Te vagy a középpontban', 'Minden festésnél alaposan átbeszéljük az elképzeléseidet, és minden tudásommal igyekszem kihozni a legtöbbet a vágyaidból.'],
      ['Megmutatom, hogyan tartsd otthon', 'Az első alkalommal azt is megmutatom, hogyan tudod otthon beállítani a frizurádat.'],
      ['Hajhosszabbítás is', 'Póthaj felrakása és leszedése is foglalható nálam.'],
    ],
    szakteruletek: ['festes', 'balayage', 'tofestes', 'pothaj'],
    gyik: [
      ['Hajhosszabbítást is vállalsz?', 'Igen, póthaj felrakását és leszedését is vállalom. A felrakás ára tincsenként 350 Ft; a pontos mennyiséget a konzultáción beszéljük meg.'],
    ],
  },
};
for (const f of Object.values(FODRASZOK)) {
  const p = fodraszAdat(f.kulcs);
  if (!p) throw new Error('a Salonic-pillanatkepben nincs fodrasz: ' + f.kulcs);
  f.id = p.id; f.kedvezmeny = p.kedvezmeny || 0;
}

// ---- szolgaltatas-csoportok az arlistaban es a kartyakon ----------------------------------------------------------------------------------
export const HOSSZOK = [['rovid', 'Rövid haj'], ['kozepes', 'Közepes haj'], ['hosszu', 'Hosszú haj'], ['extra', 'Extra hosszú haj']];
// a foglalo szandekai (flows/hair.js): balayage | color | cut | szaritas | ujraepites | pothaj
export const SOROK = [
  { csoport: 'balayage', kulcs: 'balayage', cim: 'Balayage / ombre / babylight', alcim: 'vágással, szárítással', ill: (s) => s.kat === 'Balayage' && !/tőfest/i.test(s.nev) },
  { csoport: 'balayage', kulcs: 'balayage-tofestes', cim: 'Balayage + tőfestés', alcim: 'vágással, szárítással', ill: (s) => s.kat === 'Balayage' && /tőfest/i.test(s.nev) },
  { csoport: 'balayage', kulcs: 'melir', cim: 'Teljes melír / airtouch', alcim: 'vágással, szárítással', ill: (s) => s.kat === 'Teljes melír / airtouch + vágás' },
  { csoport: 'balayage', kulcs: 'szokites', cim: 'Teljes szőkítés / korrekció', alcim: 'vágással', ill: (s) => s.kat === 'Teljes szőkítés' },
  { csoport: 'festes', kulcs: 'tofestes', cim: 'Tőfestés', alcim: 'szárítással', ill: (s) => s.kat === 'Tőfestés + szárítás' },
  { csoport: 'festes', kulcs: 'tofestes-vagas', cim: 'Tőfestés + vágás', alcim: 'szárítással', ill: (s) => s.kat === 'Tőfestés + vágás + szárítás' },
  { csoport: 'festes', kulcs: 'teljes-festes', cim: 'Teljes festés / korrekció', alcim: '', ill: (s) => s.kat === 'Elrontott festés korrekció / Teljes festés' },
  { csoport: 'vagas', kulcs: 'noi-vagas', cim: 'Női hajvágás', alcim: 'szárítással', ill: (s) => s.kat === 'Női hajvágás + szárítás' },
  { csoport: 'vagas', kulcs: 'ferfi-vagas', cim: 'Férfi hajvágás', alcim: '', ill: (s) => s.kat === 'Férfi hajvágás' },
  { csoport: 'vagas', kulcs: 'noi-szaritas', cim: 'Női szárítás', alcim: '', ill: (s) => s.kat === 'Női szárítás' },
  { csoport: 'apolas', kulcs: 'joico', cim: 'Joico hajszerkezet-újraépítés', alcim: '4 lépéses kezelés', ill: (s) => s.kat === 'Hajszerkezet újraépítés' },
];
export const CSOPORTOK = [
  { kulcs: 'balayage', cim: 'Balayage és melír', szandek: 'balayage' },
  { kulcs: 'festes', cim: 'Hajfestés', szandek: 'color' },
  { kulcs: 'vagas', cim: 'Hajvágás és szárítás', szandek: 'cut' },
  { kulcs: 'apolas', cim: 'Hajápolás', szandek: 'ujraepites' },
];

/** A fodrasz (vagy null: listaar) ara egy szolgaltatasra; Noelnel a Salonic-felirat szerinti kedvezmennyel (az adatlapon is ez latszik). */
export const ar = (s, fodrasz = null) => {
  const kedv = fodrasz ? FODRASZOK[fodrasz].kedvezmeny : 0;
  return kedv ? Math.round((s.ar * (100 - kedv)) / 100) : s.ar;
};
const kinek = (s, fodrasz) => !fodrasz || s.fodraszok.includes(FODRASZOK[fodrasz].id);
const szolgak = () => PILLANATKEP.szolgaltatasok;

/** Az arlista sorai (csoportonkent): { kulcs, cim, alcim, cellak: {rovid:{ar,regi,perc,id}|null, ...} } - csak amit az adott fodrasz vallal. */
export function arlista(fodrasz = null) {
  const kedv = fodrasz ? FODRASZOK[fodrasz].kedvezmeny : 0;
  return CSOPORTOK.map((cs) => ({
    ...cs,
    sorok: SOROK.filter((r) => r.csoport === cs.kulcs).map((r) => {
      const cellak = {}; let van = false;
      for (const [hk] of HOSSZOK) {
        const s = szolgak().find((x) => r.ill(x) && x.hossz === hk && kinek(x, fodrasz));
        cellak[hk] = s ? { ar: ar(s, fodrasz), regi: kedv ? s.ar : null, perc: s.perc, id: s.id } : null;
        if (s) van = true;
      }
      // hajhossz nelkuli szolgaltatas (pl. Ferfi hajvagas): egyetlen, a teljes sort kitolto cella
      const egy = szolgak().find((x) => r.ill(x) && x.hossz === null && kinek(x, fodrasz));
      if (egy) { cellak.egyseges = { ar: ar(egy, fodrasz), regi: kedv ? egy.ar : null, perc: egy.perc, id: egy.id }; van = true; }
      // a Joico felhosszu haja a "kozepes" oszlopba kerul (a Salonic: felhosszu / hosszu / extra)
      if (r.kulcs === 'joico') {
        const s = szolgak().find((x) => r.ill(x) && x.hossz === 'felhosszu' && kinek(x, fodrasz));
        if (s) { cellak.kozepes = { ar: ar(s, fodrasz), regi: kedv ? s.ar : null, perc: s.perc, id: s.id }; van = true; }
      }
      return { ...r, cellak, van };
    }).filter((r) => r.van),
  })).filter((cs) => cs.sorok.length);
}

/** Legolcsobb ar + idotartam-tartomany egy szandekra (a foglalo "X Ft-tol" kartyaja): a Salonic-kategoriak szerint. */
const SZANDEK_KAT = {
  balayage: ['Balayage', 'Teljes szőkítés', 'Teljes melír / airtouch + vágás'],
  // a Hajfestés kártya a teljes festést mutatja, a Tőfestés külön kártya (a foglaló "Hajfestés" kategóriája mindháromat tartalmazza)
  color: ['Elrontott festés korrekció / Teljes festés'],
  tofestes: ['Tőfestés + szárítás'],
  cut: ['Női hajvágás + szárítás', 'Férfi hajvágás'],
  szaritas: ['Női szárítás'],
  ujraepites: ['Hajszerkezet újraépítés'],
  pothaj: ['Póthaj'],
};
export function szandekAdat(szandek, fodrasz = null) {
  const lista = szolgak().filter((s) => SZANDEK_KAT[szandek].includes(s.kat) && kinek(s, fodrasz));
  if (!lista.length) return null;
  const arak = lista.map((s) => ar(s, fodrasz));
  const percek = lista.map((s) => s.perc);
  return { tol: Math.min(...arak), regiTol: fodrasz && FODRASZOK[fodrasz].kedvezmeny ? Math.min(...lista.map((s) => s.ar)) : null, percTol: Math.min(...percek), percIg: Math.max(...percek), db: lista.length };
}
/** Egy Salonic-kategoria legolcsobb ara + idotartam-tartomanya (pl. a GYIK szovegeihez). */
export function katAdat(kat, fodrasz = null) {
  const lista = szolgak().filter((s) => s.kat === kat && kinek(s, fodrasz));
  if (!lista.length) return null;
  return { tol: Math.min(...lista.map((s) => ar(s, fodrasz))), percTol: Math.min(...lista.map((s) => s.perc)), percIg: Math.max(...lista.map((s) => s.perc)) };
}
export const noiVagasTol = (fodrasz = null) => { const l = szolgak().filter((s) => s.kat === 'Női hajvágás + szárítás' && kinek(s, fodrasz)); return l.length ? Math.min(...l.map((s) => ar(s, fodrasz))) : null; };
export const ferfiVagas = (fodrasz = null) => { const s = szolgak().find((x) => x.kat === 'Férfi hajvágás' && kinek(x, fodrasz)); return s ? ar(s, fodrasz) : null; };
export const POTHAJ = { felrakasTincs: 350, leszedes: (szolgak().find((s) => /leszed/i.test(s.nev)) || {}).ar || null };
export const konzultacio = () => szolgak().find((s) => /konzult/i.test(s.nev));

// ---- formazas -------------------------------------------------------------------------------------------------------------------------
export const ft = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft'; // 7 450 Ft: a csoportositas es a Ft sem torheto sorra
export const ido = (perc) => {
  if (perc < 60) return perc + ' perc';
  const ora = Math.floor(perc / 60), maradek = perc % 60;
  return maradek === 0 ? ora + ' óra' : maradek === 30 ? ora + ',5 óra' : ora + ' óra ' + maradek + ' perc';
};
export const idoTartomany = (a, b) => (a === b ? ido(a) : (a < 60 || b < 60 ? ido(a) + ' – ' + ido(b) : ido(a).replace(' óra', '') + '–' + ido(b)));

// ---- fotok: a regi oldalak valodi kepei (tools/content/*.json blokk-sorszam) ---------------------------------------------------------------
const tartalom = Object.fromEntries(Object.values(LAPOK).map((l) => [l.kulcs, olvas('tools', 'content', l.regiTartalom + '.json')]));
function jpegMeret(fajl) {
  const b = fs.readFileSync(path.join(GYOKER, fajl));
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  throw new Error('ismeretlen kepformatum: ' + fajl);
}
export function kep(lap, blokk, extra = {}) {
  const b = tartalom[lap].blocks[blokk];
  if (!b || b.t !== 'img') throw new Error(`a(z) ${lap} oldal ${blokk}. blokkja nem kep`);
  return { src: '/' + b.local, ...jpegMeret(b.local), ...extra };
}

export const SZINEK = { s: 'Szőke / világos', b: 'Barna / karamell', c: 'Vörös / színes', v: 'Hajvágás' };
const ALT = {
  s: 'Világos, szőke hajszín – valódi MOSAIC Hair vendégmunka',
  b: 'Barna, karamellárnyalatú haj – valódi MOSAIC Hair vendégmunka',
  c: 'Vörös, színes hajfestés – valódi MOSAIC Hair vendégmunka',
  v: 'Frissen vágott női fazon – valódi MOSAIC Hair vendégmunka',
};
// [blokk-sorszam, szin]: a szint a fotok megnezese alapjan jeloltem (s = szoke/vilagos, b = barna/karamell, c = voros/szines, v = vagas)
const GALERIA = {
  kozpont: ['kozpont', [[38, 'b'], [39, 'b'], [40, 'c'], [41, 's'], [42, 's'], [43, 'c'], [44, 'c'], [45, 'c'], [46, 'b'], [47, 'b'], [48, 's'], [49, 'c'], [50, 's'], [51, 's'], [52, 's'], [53, 's'], [54, 's'], [55, 'v'], [56, 'b']]],
  betti: ['betti', [[38, 'b'], [39, 'b'], [40, 's'], [41, 's'], [42, 'b'], [43, 's'], [44, 'c'], [45, 'b'], [46, 's'], [47, 's'], [48, 'b'], [49, 'b'], [50, 'v'], [51, 's'], [52, 's'], [53, 'b'], [54, 'c'], [55, 's']]],
  noel: ['noel', [[38, 's'], [39, 'b'], [40, 's'], [41, 'b'], [42, 'b'], [43, 's'], [44, 's'], [45, 's'], [46, 's']]],
  evelin: ['evelin', [[38, 's'], [39, 'b'], [40, 's'], [41, 'b'], [42, 's'], [43, 'b'], [44, 'c'], [45, 'b'], [46, 'b'], [47, 'b'], [48, 's'], [49, 's'], [50, 'b'], [51, 's'], [52, 'b'], [53, 's']]],
};
export const galeria = (kulcs) => GALERIA[kulcs][1].map(([blokk, szin]) => kep(GALERIA[kulcs][0], blokk, { szin, alt: ALT[szin] }));

export const KEPEK = {
  // a kozponti oldal nyitokepe: valodi hajeredmeny (a kozponti oldal 1440 px-es kepei kozul: szoke, hullamos haj)
  kozpontHero: () => kep('kozpont', 42, { alt: 'Hosszú, hullámos, szőke haj balayage-átmenettel – valódi MOSAIC Hair vendégmunka', poz: '50% 12%' }),
  // a kozponti oldal hero-kepgaleriaja (lapozhato): valodi vendegmunkak, az elso a nyitokep
  kozpontHeroGaleria: () => [
    KEPEK.kozpontHero(),
    kep('kozpont', 46, { alt: 'Gazdag, meleg barna-réz hajszín hullámokkal – valódi MOSAIC Hair vendégmunka', poz: '50% 12%' }),
    kep('kozpont', 40, { alt: 'Vörös-réz árnyalatú, hullámos haj – valódi MOSAIC Hair vendégmunka', poz: '50% 12%' }),
    kep('kozpont', 51, { alt: 'Hosszú, egyenes, szőke haj lágy átmenettel – valódi MOSAIC Hair vendégmunka', poz: '50% 12%' }),
    kep('kozpont', 48, { alt: 'Hamvas szőke, hullámos haj – valódi MOSAIC Hair vendégmunka', poz: '50% 12%' }),
  ],
  // a fodraszok sajat kartyai: a sajat, valodi munkaik (nagyobb felbontasu kepek)
  fodraszSzolg: {
    betti: { balayage: [40, 's'], color: [45, 'b'], tofestes: [54, 'c'], ujraepites: [52, 's'] },
    noel: { balayage: [38, 's'], color: [39, 'b'], tofestes: [41, 'b'], ujraepites: [45, 's'] },
    evelin: { balayage: [38, 's'], color: [45, 'b'], tofestes: [41, 'b'], pothaj: [48, 's'], ujraepites: [51, 's'] },
  },
  csapat: () => kep('kozpont', 33, { alt: 'A MOSAIC Hair csapata: Betti, Noel és Evelin' }),
  portre: {
    betti: () => kep('betti', 32, { alt: 'Betti, a MOSAIC Hair fodrásza', poz: '50% 22%' }),
    noel: () => kep('noel', 32, { alt: 'Noel, a MOSAIC Hair fodrásza egy vendég hajával dolgozik', poz: '50% 14%' }),
    evelin: () => kep('evelin', 32, { alt: 'Evelin, a MOSAIC Hair fodrásza hajfestés közben', poz: '30% 40%' }),
  },
  // a fodraszat sajat helyisege (tukros fodraszhelyek); a Head Spa-s varo / recepcio kepei nem kerulnek ide
  szalon: [
    () => kep('betti', 80, { alt: 'A MOSAIC Hair fodrászhelyei: tükrös munkaasztal és zöld fotel' }),
    () => kep('betti', 81, { alt: 'Tükrös fodrászhely zöld fotellel a MOSAIC Hair szalonban' }),
    () => kep('betti', 82, { alt: 'A MOSAIC Hair szalon fodrászterme tükrös munkahelyekkel' }),
  ],
  // a kozponti oldal szolgaltatas-kartyai
  szolgaltatas: {
    balayage: () => kep('kozpont', 50, { alt: 'Szőke, hullámos haj lágy balayage-átmenettel' }),
    color: () => kep('kozpont', 46, { alt: 'Gazdag, meleg barna-réz hajszín hullámokkal' }),
    tofestes: () => kep('kozpont', 52, { alt: 'Egységes, ezüstös hajszín tőtől a hajvégig' }),
    konzultacio: () => kep('noel', 54, { alt: 'Noel konzultáció közben mutat egy referenciaképet a vendégnek' }),
  },
  szolgFodrasz: (fodrasz, szandek) => {
    const [blokk, szin] = KEPEK.fodraszSzolg[fodrasz][szandek];
    return kep(fodrasz, blokk, { szin, alt: ALT[szin] });
  },
  // Betti mostani oldalan levo valodi Google-velemeny kepernyomentesek (az olvashatok; a tobbi tul kicsi)
  velemenyek: {
    betti: [
      [61, 'Google-vélemény Bettiről, 5 csillag: egy vendég, akinek csupa foltos hajából gyönyörű barna babylights lett'],
      [62, 'Google-vélemény Bettiről, 5 csillag: igényes, precíz munka, mindig szép végeredmény'],
      [64, 'Google-vélemény Bettiről, 5 csillag: rugalmas időpont-egyeztetés, csodaszép festés és vágás'],
      [60, 'Vendégüzenet Bettiről: szakmaisága kifogástalan, gyors, precíz, megbízható'],
    ],
  },
  // a regi oldalakon a "Fodraszt valtani nagy dontes. Ingyenes konzultacioval varlak!" resz mellett allo videok (kattintasra indul, hanggal)
  videok: {
    betti: { src: '/assets/video/c2eb0f_d0737d55559445caa0687b3c2017518a.mp4', poster: '/assets/img/c2eb0f_d0737d55559445caa0687b3c2017518af002.jpg', w: 674, h: 1198, felirat: 'Pető Betti üzenete az ingyenes konzultációról' },
    noel: { src: '/assets/video/c2eb0f_1f095db5b74d4ceea9ddf64a78da9586.mp4', poster: '/assets/img/c2eb0f_1f095db5b74d4ceea9ddf64a78da9586f000.jpg', w: 726, h: 1291, felirat: 'Jakab Noel üzenete az ingyenes konzultációról' },
    evelin: { src: '/assets/video/c2eb0f_d1d7131a5e48466599172992ad24c321.mp4', poster: '/assets/img/c2eb0f_d1d7131a5e48466599172992ad24c321f000.jpg', w: 576, h: 1024, felirat: 'Szaniszló-Cene Evelin üzenete az ingyenes konzultációról' },
    // a kozponti oldalon a regi oldalon ketto volt (Betti, Evelin); a tulajdonos kerese (2026-10-09): Noel videoja is - mindharom fodrasz
    kozpont: [
      { nev: 'Betti', src: '/assets/video/c2eb0f_d0737d55559445caa0687b3c2017518a.mp4', poster: '/assets/img/c2eb0f_d0737d55559445caa0687b3c2017518af000.jpg', w: 560, h: 996, felirat: 'Betti üzenete az ingyenes konzultációról' },
      { nev: 'Noel', src: '/assets/video/c2eb0f_1f095db5b74d4ceea9ddf64a78da9586.mp4', poster: '/assets/img/c2eb0f_1f095db5b74d4ceea9ddf64a78da9586f000.jpg', w: 726, h: 1291, felirat: 'Noel üzenete az ingyenes konzultációról' },
      { nev: 'Evelin', src: '/assets/video/c2eb0f_02d4a83e09c84997a1af28ff3d2f4516.mp4', poster: '/assets/img/c2eb0f_02d4a83e09c84997a1af28ff3d2f4516f002.jpg', w: 560, h: 996, felirat: 'Evelin üzenete az ingyenes konzultációról' },
    ],
  },
  festek: {
    betti: () => kep('betti', 152, { alt: 'Schwarzkopf Igora Royal hajfestékek' }),
    evelin: () => kep('evelin', 141, { alt: 'Luxoya és Fanola hajfestékek' }),
  },
};
export const SZOLG_KEP = (kulcs) => KEPEK.szolgaltatas[kulcs]();
export const szolgFodrasz = (fodrasz, szandek) => KEPEK.szolgFodrasz(fodrasz, szandek);
