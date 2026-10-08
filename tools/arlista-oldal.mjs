// Az /arlista oldal (foglalas/arlista.html) generatora: MINDEN uzletag AKTUALIS arai egy helyen, szurheto listaban.
//
//   node tools/arlista-oldal.mjs
//
// Az arakat NEM ide irjuk be: minden uzletag a sajat, mar meglevo forrasabol jon, igy az ujrafuttatas szinkronba hozza az oldalt a tobbivel
// (a teszt - tools/arlista-teszt/arlista.test.mjs - osszeveti a kimenetet a fajllal, es a forrasokkal is):
//   Head Spa          foglalas/headspa-arak-budapest.html          (a harom csomag: .csomag kartyak)
//   Szortelenites     foglalas/lezeres-szortelenites-budapest.html (#arlista tablazat: data-ar, 8 alkalmas program, kesz csomagok)
//   Fodraszat         tools/hair-oldalak/salonic-hair.json         (a Salonic pillanatkepe, a tools/hair-oldalak/adat.mjs arlista() fuggvenyevel,
//                                                                    ugyanaz, mint a fodrasz-oldalakon; Noel -20%-a a Salonic-felirat szerint)
//   Oxigenterapia     foglalas/oxigenterapia-budapest.html         (.ar-kartya + .berlet-doboz)
//   Sminktetovalas    foglalas/sminktetovalas-budapest.html        (.ar-kartya[data-salonic]) + a SZEMPILLA sor (lasd lent)
//   Ajandekkartya     assets/js/ajandek-adat.js, ajandek-adat-lezer.js, ajandek-adat-oxigen.js (a vasarlo-motor termekei, ar_ft)
// Amit nem lehet az oldalakbol kiolvasni, azt a lenti EGYEDI blokkok tartalmazzak, mindegyik mellett a forras fajl neve (a teszt ellenorzi, hogy a
// szoveg / az ar a forrasban szerepel).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

export const GYOKER = path.resolve(import.meta.dirname, '..');
const olvas = (f) => fs.readFileSync(path.join(GYOKER, f), 'utf8').replace(/\r\n/g, '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const szoveg = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
export const szam = (s) => +String(s).replace(/\D/g, '');
/** 26 900 Ft: a csoportositas es a Ft sem torheto sorra (nem-torheto szokoz) */
export const ft = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0Ft';
const NBSP = /\u00a0/g;
/** a kiolvasott szoveg / ar szokoz-egyseges alakja (az ellenorzesekhez) */
export const lapos = (s) => String(s).replace(NBSP, ' ').replace(/\s+/g, ' ').trim();
const kisbetu = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

// ============================================================================================================================================
// EGYEDI BLOKKOK (amit az oldalak nem tartalmaznak kiolvashato alakban). A teszt (FORRAS_ELLENORZES) mindegyiket a megnevezett forrassal veti ossze.
// ============================================================================================================================================
export const EGYEDI = {
  // Head Spa: az egyszeru csomag neve az arak-oldalon csak "Head Spa kezelés"; a Salonic ("EGYENI 50 perces MOSAIC Relax Head Spa") es az ajandekkartya
  // ("Egyéni Head Spa", assets/js/ajandek-adat.js) "egyeni"-nek hivja, hogy a negykezes / paros mellett egyertelmu legyen.
  headspaEgyeniNev: { forras: 'assets/js/ajandek-adat.js', szoveg: 'Egyéni Head Spa' },
  // A paros ara 2 fore szol (53 800 Ft / 2 fo, 26 900 Ft / fo).
  headspaParosFo: { forras: 'foglalas/paros-headspa-budapest-uj.html', szoveg: '53 800 Ft / 2 fő', egyseg: '2 fő' },
  // A "4 Kezes" kartya "Csak ajándékkártya készült" pontja KIMARAD: a foglalo-motor (business=headspa, 4kezes) es a Salonic (431713, 39 900 Ft) szerint
  // a negykezes kezeles ma foglalhato, az arak-oldal ezen pontja elavult (lasd docs/ARLISTA.md, "Eltérések").
  headspaKihagyottPont: /^Csak ajándékkártya készült$/,
  // Szempilla-suritas: a Salonic PMU-szolgaltatasa (481061, 60 perc, 47 000 Ft; "59.000 Ft helyett most") es a regi PMU-urlap (assets/js/klon.js:
  // "Szempilla sűrítés - 47.000 Ft") szerint foglalhato, de a sminktetovalas-oldal arkartyai kozott nincs. Foglalo-pmu.js (kep + leiras) is kezeli.
  pmuSzempilla: { nev: 'Szempilla sűrítés', ar: 47000, ido: '60 perc', leiras: 'Pigmentálás a pillák tövében: sűrűbbnek, dúsabbnak látszó pillasor, smink nélkül is.',
    forras: ['assets/js/klon.js', 'assets/js/foglalo-pmu.js', 'docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json'], arSzoveg: 'Szempilla sűrítés - 47.000 Ft' },
  // A fodraszat: Noel kedvezmenye (a Salonic-felirat "Noel - 20% kedvezmeny!"), a tobbi fodraszat a pillanatkep adja.
};

// ============================================================================================================================================
// FORRAS-KIOLVASAS uzletagankent. Mindegyik { id, cim, al, oldal, oldalSzoveg, foglalas, masodikFoglalas?, csoportok: [{ cim, al, tipus, sorok }], jegyzetek: [] } alakot ad.
// sor (tipus 'sima' | 'prog' | 'hossz'): { nev, al, ar, arSzoveg, regi, egyseg, reszlet: [], prog, id, cellak }
// ============================================================================================================================================
function headspa() {
  const f = 'foglalas/headspa-arak-budapest.html';
  const s = olvas(f);
  const lead = szoveg((s.match(/<p class="lead"><b>([\s\S]*?)<\/b><\/p>/) || [])[1] || '');
  const cikkek = [...s.matchAll(/<article class="csomag[^"]*">([\s\S]*?)<\/article>/g)].map((m) => m[1]);
  if (cikkek.length !== 3) throw new Error(`${f}: ${cikkek.length} csomag-kartya, 3 volt a varhato`);
  const sorok = cikkek.map((c) => {
    const h3 = c.match(/<h3>([\s\S]*?)<\/h3>/)[1];
    const nyers = szoveg(h3.replace(/<small>[\s\S]*?<\/small>/, ''));
    const kulcs = /4 Kezes/i.test(nyers) ? '4kezes' : /Páros/i.test(nyers) ? 'paros' : 'egyeni';
    const pipak = [...(c.match(/<ul class="pipak">([\s\S]*?)<\/ul>/) || ['', ''])[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => ({ szoveg: szoveg(m[1]), kiemelt: /<b>/.test(m[1]) }));
    const leiras = (c.match(/class="csomag-leiras">([\s\S]*?)<\/p>/) || [])[1];
    const kiemeltLeiras = leiras && (leiras.match(/<b>([\s\S]*?)<\/b>/) || [])[1];
    const idoSor = szoveg(c.match(/class="ar-ido">([\s\S]*?)<\/p>/)[1]).replace(/^Időtartam:\s*/, '');
    const lista = pipak.filter((p) => !EGYEDI.headspaKihagyottPont.test(p.szoveg)).map((p) => p.szoveg);
    // rovid alcim: a kartya kiemelt leirasa, ennek hianyaban a kiemelt (<b>) pontok
    const rovid = kiemeltLeiras ? szoveg(kiemeltLeiras) : pipak.filter((p) => p.kiemelt).map((p, i) => (i ? kisbetu(p.szoveg) : p.szoveg)).join(', ');
    return {
      kulcs, nev: kulcs === 'egyeni' ? EGYEDI.headspaEgyeniNev.szoveg + ' kezelés' : nyers,
      al: [idoSor, rovid].filter(Boolean).join(' · '),
      ar: szam(c.match(/class="ar-uj">([\s\S]*?)<\/span>/)[1]), regi: szam(c.match(/<s>([\s\S]*?)<\/s>/)[1]),
      egyseg: kulcs === 'paros' ? EGYEDI.headspaParosFo.egyseg : '', reszlet: lista, id: kulcs === 'paros' ? 'paros' : '',
    };
  }).sort((a, b) => a.ar - b.ar);
  return {
    id: 'headspa', cim: 'Head Spa', al: 'Egyedül, négy kézzel vagy párosan: 50 perc kezelés + 30 perc hajszárítás',
    oldal: '/', oldalSzoveg: 'Head Spa', foglalas: '/foglalo-motor?business=headspa',
    masodikFoglalas: { href: '/foglalo-motor?business=headspa&service=paros', szoveg: 'Páros időpont' },
    csoportok: [{ cim: '', al: '', tipus: 'sima', sorok }],
    elol: { pill: lead.replace(/!$/, ''), szoveg: '' }, // az áthúzott eredeti árat a tulajdonos kérésére (2026-10-08) nem mutatjuk
    jegyzetek: ['A 30 perces hajszárítás az ár része, külön felár nincs', 'SZÉP kártyát is elfogadunk'],
    forras: f,
  };
}

function szortelenites() {
  const f = 'foglalas/lezeres-szortelenites-budapest.html';
  const s = olvas(f);
  const i = s.indexOf('<section class="arlista" id="arlista"');
  if (i < 0) throw new Error(`${f}: nincs #arlista szekcio`);
  const sz = s.slice(i, s.indexOf('</section>', i));
  const bevezeto = szoveg(sz.match(/class="arlista-bevezeto">([\s\S]*?)<\/p>/)[1]);
  const csoportok = [...sz.matchAll(/<article class="ar-csoport[^"]*">([\s\S]*?)<\/article>/g)].map((m) => {
    const c = m[1];
    const cim = szoveg(c.match(/class="csoport-nev">([\s\S]*?)<\/span>/)[1]);
    const al = szoveg(((c.match(/<h3>[\s\S]*?<\/h3>/) || [''])[0].match(/<small>([\s\S]*?)<\/small>/) || [])[1] || '').replace(/^\(|\)$/g, '');
    const sorok = [...c.matchAll(/<tr data-kulcs="([^"]+)"([^>]*)>([\s\S]*?)<\/tr>/g)].map((r) => {
      const attr = (n) => (r[2].match(new RegExp(n + '="([^"]*)"')) || [])[1];
      const th = r[3].match(/<th scope="row">([\s\S]*?)<\/th>/)[1];
      const csomag = /data-csomag="1"/.test(r[2]);
      const nev = szoveg(th.replace(/<small>[\s\S]*?<\/small>/, ''));
      const regiHtml = (r[3].match(/<s class="regi-ar">([\s\S]*?)<\/s>/) || [])[1];
      return {
        kulcs: r[1], nev: csomag ? nev + ' csomag' : nev, al: szoveg((th.match(/<small>([\s\S]*?)<\/small>/) || [])[1] || ''),
        ar: szam(attr('data-ar')), regi: regiHtml ? szam(szoveg(regiHtml).replace(/^Külön-külön:/, '')) : 0,
        prog: szam(szoveg(r[3].match(/<td class="ar-prog">([\s\S]*?)<\/td>/)[1])), elso: attr('data-elso'), csomag,
      };
    });
    return { cim, al, tipus: 'prog', sorok };
  });
  if (csoportok.length !== 7) throw new Error(`${f}: ${csoportok.length} arcsoport, 7 volt a varhato`);
  return {
    id: 'szortelenites', cim: 'Szőrtelenítés', al: 'Alkalmanként fizetsz, a 8 alkalmas programban csak 6 alkalmat',
    oldal: '/lezeres-szortelenites-budapest', oldalSzoveg: 'Szőrtelenítés', foglalas: '/foglalo-motor?business=laser',
    csoportok,
    elol: { pill: 'Az első kezelés 20% kedvezménnyel', szoveg: bevezeto },
    jegyzetek: ['Több területnél a legdrágább területet teljes áron fizeted, minden továbbira 50% kedvezményt kapsz'],
    kalkulator: { href: '/lezeres-szortelenites-budapest#szamolo', szoveg: 'Árkalkulátor több területhez' },
    forras: f,
  };
}

let hairModul = null;
async function hairAdat() {
  if (!hairModul) hairModul = await import(pathToFileURL(path.join(GYOKER, 'tools', 'hair-oldalak', 'adat.mjs')).href);
  return hairModul;
}

/** { id, nev } a fodraszokhoz es kik vallalnak egy szolgaltatast (a pillanatkepbol) */
function fodrasz(h) {
  const nevek = Object.fromEntries(h.PILLANATKEP.fodraszok.map((x) => [x.id, x.nev]));
  const osszes = h.PILLANATKEP.fodraszok.map((x) => x.id);
  return { nevek, osszes };
}

async function fodraszat() {
  const h = await hairAdat();
  const lista = h.arlista(null); const noel = h.arlista('noel');
  const noelKedv = h.FODRASZOK.noel.kedvezmeny;
  const { nevek, osszes } = fodrasz(h);
  const szolg = h.PILLANATKEP.szolgaltatasok;
  const csoportok = lista.map((cs) => ({
    cim: cs.cim, al: '', tipus: 'hossz',
    sorok: cs.sorok.map((r) => {
      const nr = (noel.find((x) => x.kulcs === cs.kulcs) || { sorok: [] }).sorok.find((x) => x.kulcs === r.kulcs);
      const cellak = {}; const percek = [];
      for (const [hk] of [...h.HOSSZOK, ['egyseges']]) {
        const c = r.cellak[hk]; if (!c) { if (hk !== 'egyseges') cellak[hk] = null; continue; }
        const n = nr && nr.cellak[hk];
        cellak[hk] = { ar: c.ar, noel: n ? n.ar : null, perc: c.perc, id: c.id };
        percek.push(c.perc);
      }
      return { kulcs: r.kulcs, nev: r.cim, al: [r.alcim, h.idoTartomany(Math.min(...percek), Math.max(...percek))].filter(Boolean).join(' · '), cellak, noelNincs: !nr };
    }),
  }));
  // egyeb tetelek: konzultacio (ingyenes, 9 900 Ft helyett), poethaj
  const konz = h.konzultacio();
  const leszed = szolg.find((x) => /leszed/i.test(x.nev)); const felrak = szolg.find((x) => /felrak/i.test(x.nev));
  const kuld = (x) => x.fodraszok.length === osszes.length ? '' : ' · csak ' + x.fodraszok.map((i) => nevek[i]).join(' és ');
  const egyeb = [
    { nev: 'Ingyenes fodrász-konzultáció', al: h.ido(konz.perc) + ' · reális terv és ár előre', ar: 0, arSzoveg: 'Ingyenes', regi: konz.regiAr, id: 'fodrasz-konzultacio' },
    { nev: 'Póthaj leszedés', al: h.ido(leszed.perc) + kuld(leszed), ar: leszed.ar, regi: 0 },
    { nev: 'Póthaj felrakás', al: h.ido(felrak.perc) + kuld(felrak) + ' · a foglalóban ' + ft(felrak.ar) + ' látszik, a pontos mennyiséget a konzultáción beszéljük meg', ar: h.POTHAJ.felrakasTincs, arSzoveg: ft(h.POTHAJ.felrakasTincs), egyseg: 'tincsenként', regi: 0 },
  ];
  // ki mit vallal: csak az eltero esetek (szolgaltatas + haj hossza + fodraszok)
  const csopNev = { rovid: 'rövid', kozepes: 'közepes', hosszu: 'hosszú', extra: 'extra hosszú' };
  const eltero = new Map();
  for (const r of h.SOROK) {
    for (const hk of [...Object.keys(csopNev), null]) {
      const x = szolg.find((s) => r.ill(s) && (s.hossz === hk || (hk === 'kozepes' && r.kulcs === 'joico' && s.hossz === 'felhosszu')));
      if (!x || x.fodraszok.length === osszes.length) continue;
      const kulcs = r.cim + '|' + x.fodraszok.join(',');
      if (!eltero.has(kulcs)) eltero.set(kulcs, { nev: r.cim, kik: x.fodraszok.map((i) => nevek[i]), hosszak: [] });
      eltero.get(kulcs).hosszak.push(hk ? csopNev[hk] : '');
    }
  }
  const kiMit = [...eltero.values()].map((e) => {
    const hosszak = e.hosszak.filter(Boolean);
    return `${e.nev}${hosszak.length ? ' (' + hosszak.join(', ') + ' haj)' : ''}: csak ${e.kik.join(' és ')}`;
  });
  return {
    id: 'fodraszat', cim: 'Fodrászat', al: 'Az ár a haj hosszától függ: rövid, közepes, hosszú és extra hosszú haj árai',
    oldal: '/noi-fodraszat-budapest', oldalSzoveg: 'Fodrászat', foglalas: '/foglalo-motor?business=hair',
    masodikFoglalas: { href: '/foglalo-motor?business=hair&service=konzultacio', szoveg: 'Ingyenes konzultáció' },
    csoportok: [...csoportok, { cim: 'Konzultáció és póthaj', al: '', tipus: 'sima', sorok: egyeb }],
    noelKedvezmeny: noelKedv,
    kiMit,
    jegyzetek: ['A festések ára a hajfestéket, a vágást és a szárítást is tartalmazza; ha az átlagosnál több festékre van szükség, az ár kis mértékben nőhet. A hajvágás ára a szárítást is tartalmazza',
      'Ugyanezek az árak jelennek meg a foglalóban'],
    forras: 'tools/hair-oldalak/salonic-hair.json',
    hossz: h.HOSSZOK.map(([k, n]) => [k, n]),
  };
}

function oxigenterapia() {
  const f = 'foglalas/oxigenterapia-budapest.html';
  const s = olvas(f);
  const i = s.indexOf('<section class="arak" id="arak"');
  const arak = s.slice(i, s.indexOf('</section>', i));
  const kartyak = [...arak.matchAll(/<article class="ar-kartya[^"]*">([\s\S]*?)<\/article>/g)].map((m) => {
    const c = m[1];
    return { nev: szoveg(c.match(/<h3>([\s\S]*?)<\/h3>/)[1]), rovid: szoveg((c.match(/class="rovid">([\s\S]*?)<\/p>/) || [])[1] || ''), ar: szam(c.match(/class="osszeg">([\s\S]*?)<\/p>/)[1]), masodik: szoveg((c.match(/class="masodik">([\s\S]*?)<\/p>/) || [])[1] || '') };
  });
  if (kartyak.length !== 2) throw new Error(`${f}: ${kartyak.length} ar-kartya, 2 volt a varhato`);
  const [elso, kamera] = kartyak;   // az oldalon: elso kezeles, majd a csak-felmeres
  // az idotartamok az ajandekkartya-motor adatabol (assets/js/ajandek-adat-oxigen.js: Salonic 466147 = 30 perc, 466110 / 466158 = 80 perc); az oxigen-oldalon nincsenek kiirva
  const ajandek = ajandekTermekek('ajandek-adat-oxigen.js');
  const idoSzoveg = (id, re) => { const t = ajandek.find((x) => x.id === id); const m = t && t.tartalom.map((x) => x.match(re)).find(Boolean); if (!m) throw new Error('ajandek-adat-oxigen.js: nincs idotartam: ' + id); return +m[1]; };
  const kameraPerc = idoSzoveg('kamera', /^Kb\. (\d+) perc$/); const kezelesPerc = idoSzoveg('ot', /^Alkalmanként kb\. (\d+) perc$/);
  const m2 = elso.masodik.match(/^2\. alkalomtól:\s*([\d\s\u00a0]+)Ft \/ alkalom$/);
  if (!m2) throw new Error(`${f}: a "2. alkalomtól" sor szerkezete valtozott`);
  const masodikAr = szam(m2[1]);
  const b0 = s.indexOf('<div class="berlet-sor">'); const b1 = s.indexOf('<p class="aj-megj">', b0);
  const berletek = s.slice(b0, b1).split('<div class="berlet-doboz').slice(1).map((d) => ({
    nev: szoveg(d.match(/class="b-cim">([\s\S]*?)<\/p>/)[1]), ar: szam(d.match(/class="b-ar">([\s\S]*?)<\/p>/)[1]), szamitas: szoveg(d.match(/class="b-szamitas">([\s\S]*?)<\/p>/)[1]),
    ajandek: [...d.matchAll(/class="b-tn">([\s\S]*?)<\/span>/g)].map((x) => szoveg(x[1])), ertek: szam(d.match(/class="b-sporolas"><span>[\s\S]*?<\/span><b>([\s\S]*?)<\/b>/)[1]),
  }));
  if (berletek.length !== 2) throw new Error(`${f}: ${berletek.length} berlet, 2 volt a varhato`);
  return {
    id: 'oxigenterapia', cim: 'Oxigénterápia', al: 'Hajhullás ellen: hajkamerás állapotfelméréssel indulunk, utána alkalmanként fizetsz',
    oldal: '/oxigenterapia-budapest', oldalSzoveg: 'Oxigénterápia', foglalas: '/foglalo-motor?business=oxygen',
    csoportok: [
      { cim: 'Kezelések', al: '', tipus: 'sima', sorok: [
        { nev: kamera.nev, al: 'kb. ' + kameraPerc + ' perc · ' + kisbetu(kamera.rovid.split(/\.\s+/).pop().replace(/\.$/, '')), ar: kamera.ar, regi: 0 },
        { nev: elso.nev, al: elso.rovid.replace(/^Teljes értékű, /, '').replace(/\.$/, '').replace(/^./, (c) => c.toUpperCase()), ar: elso.ar, regi: 0 },
        { nev: 'Oxigénterápia a 2. alkalomtól', al: kezelesPerc + ' perces kezelés · alkalmanként fizetsz', ar: masodikAr, egyseg: 'alkalmanként', regi: 0 },
      ] },
      { cim: 'Bérlet (nem kötelező)', al: 'a további alkalmakra szól, az első kezelés külön van', tipus: 'sima', sorok: berletek.map((b) => ({
        nev: b.nev, al: `${b.szamitas}, ajándékba ${b.ajandek.join(' és ')} (${ft(b.ertek)} értékben)`, ar: b.ar, regi: 0,
      })) },
    ],
    jegyzetek: ['Nincs kötelező bérlet: alkalmanként fizetsz, csak azért, amit igénybe veszel', 'SZÉP kártyával is fizethetsz'],
    forras: f,
    _ellenorzes: { masodikAr },
  };
}

function sminktetovalas() {
  const f = 'foglalas/sminktetovalas-budapest.html';
  const s = olvas(f);
  const kartyak = [...s.matchAll(/<article class="ar-kartya" data-salonic="([^"]+)">([\s\S]*?)<\/article>/g)].map((m) => {
    const c = m[2];
    const desc = (c.match(/class="ar-ido">[\s\S]*?<\/p><p>([\s\S]*?)<\/p>/) || [])[1];
    return { kulcs: m[1], nev: szoveg(c.match(/<h3>([\s\S]*?)<\/h3>/)[1]), ar: szam(c.match(/class="ar-most">([\s\S]*?)<\/span>/)[1]), ido: szoveg(c.match(/class="ar-ido">([\s\S]*?)<\/p>/)[1]), leiras: szoveg(desc || '') };
  });
  if (kartyak.length !== 5) throw new Error(`${f}: ${kartyak.length} ar-kartya, 5 volt a varhato`);
  const sorok = kartyak.map((k) => ({ kulcs: k.kulcs, nev: k.nev.replace(' – ', ': '), al: k.ido + ' · ' + k.leiras, ar: k.ar, regi: 0 }));
  // a Salonic szerint foglalhato szempilla-suritas az arkartyak utan (lasd EGYEDI.pmuSzempilla)
  const sz = EGYEDI.pmuSzempilla;
  sorok.push({ kulcs: 'szempilla', nev: sz.nev, al: sz.ido + ' · ' + sz.leiras, ar: sz.ar, regi: 0 });
  const konz = { kulcs: 'konzultacio', nev: 'Személyes konzultáció', al: 'Megtervezem és berajzolom, hogyan fog kinézni · kötelezettség nélkül', ar: 0, arSzoveg: 'Ingyenes', regi: 0 };
  return {
    id: 'sminktetovalas', cim: 'Sminktetoválás', al: 'Természetes szemöldök-, ajak- és szemhéjtetoválás Töreki Melittával',
    oldal: '/sminktetovalas-budapest', oldalSzoveg: 'Sminktetoválás', foglalas: '/sminktetovalas-budapest#foglalas',
    csoportok: [{ cim: '', al: '', tipus: 'sima', sorok: [konz, ...sorok] }],
    jegyzetek: ['A 4–7 hét múlva esedékes korrekció az árban van', 'Időpontfoglaláskor nincs előleg: a kezelés díját a helyszínen, a szolgáltatás után fizeted'],
    forras: f,
  };
}

/** a vasarlo-motor termekei (a bongeszoben window.AJANDEK_ADAT; itt vm-ben, mellekhatas nelkul) */
function ajandekTermekek(extra) {
  const win = {}; const ctx = { window: win, console: { log() {}, warn() {}, error() {} } };
  win.window = win; ctx.globalThis = win; ctx.self = win; vm.createContext(ctx);
  for (const f of ['ajandek-adat.js', extra].filter(Boolean)) vm.runInContext(fs.readFileSync(path.join(GYOKER, 'assets', 'js', f), 'utf8'), ctx);
  return Object.values(win.AJANDEK_ADAT.TERMEKEK).map((t) => ({ id: t.id, nev: t.nev, ar: t.ar_ft, osszefoglalo: t.osszefoglalo, tartalom: t.tartalom }));
}

function ajandekkartya() {
  const hs = ajandekTermekek(null); const lz = ajandekTermekek('ajandek-adat-lezer.js'); const ox = ajandekTermekek('ajandek-adat-oxigen.js');
  const sorSzol = (t, al) => ({ nev: t.nev, al, ar: t.ar, regi: 0 });
  return {
    id: 'ajandekkartya', cim: 'Ajándékkártya', al: 'Head Spa, szőrtelenítés vagy oxigénterápia: 6 hónapig felhasználható',
    oldal: '/ajandekkartya', oldalSzoveg: 'Ajándékkártya-választó', foglalas: '/ajandekkartya', foglalasSzoveg: 'Ajándékkártyát választok',
    csoportok: [
      { cim: 'Head Spa ajándékkártya', al: '', tipus: 'sima', link: { href: '/headspa-ajandekkartya', szoveg: 'Head Spa kártyák' }, sorok: hs.map((t) => sorSzol(t, t.osszefoglalo + (t.id === 'paros' ? ' · 2 vendégnek' : ''))) },
      { cim: 'Szőrtelenítés ajándékkártya', al: 'az első kezelés + állapotfelmérés', tipus: 'sima', link: { href: '/lezeres-ajandekkartya', szoveg: 'Szőrtelenítés kártyák' }, sorok: lz.map((t) => sorSzol(t, t.osszefoglalo)) },
      { cim: 'Oxigénterápia ajándékkártya', al: '', tipus: 'sima', link: { href: '/oxigen-ajandekkartya', szoveg: 'Oxigénterápia kártyák' }, sorok: ox.map((t) => sorSzol(t, t.osszefoglalo)) },
    ],
    jegyzetek: ['Online megvásárolható, digitális vagy nyomtatott kártyán', 'Minden ajándékkártya 6 hónapig felhasználható'],
    forras: 'assets/js/ajandek-adat.js',
    _termekek: { hs, lz, ox },
  };
}

/** Minden uzletag adata, a chipek / szekciok sorrendjeben. */
export async function osszegyujt() {
  return [headspa(), szortelenites(), await fodraszat(), oxigenterapia(), sminktetovalas(), ajandekkartya()];
}

// ============================================================================================================================================
// HTML
// ============================================================================================================================================
const arHtml = (s, kiemelt = true) => {
  // az áthúzott eredeti ár nincs kiírva (a tulajdonos kérése, 2026-10-08): csak az aktuális ár látszik
  const uj = `<b class="arl-uj${s.arSzoveg && !/\d/.test(s.arSzoveg) ? ' arl-ingyen' : ''}">${s.arSzoveg || ft(s.ar)}</b>`;
  const egyseg = s.egyseg ? `<small class="arl-egyseg">${esc(s.egyseg)}</small>` : '';
  const prog = s.prog ? `<small class="arl-prog"><span class="arl-prog-cim">8 alkalom:</span> ${ft(s.prog)}</small>` : '';
  return `<p class="arl-ar">${uj}${egyseg}${prog}</p>`;
};

function simaSor(r, tipus) {
  const reszlet = r.reszlet && r.reszlet.length ? `\n        <details class="arl-reszlet"><summary>Mit tartalmaz?</summary><ul class="arl-pipak">${r.reszlet.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>` : '';
  return `      <li class="arl-sor"${r.id ? ` id="${r.id}"` : ''}>
        <div class="arl-szoveg"><span class="arl-nev">${esc(r.nev)}</span>${r.al ? `<span class="arl-al">${esc(r.al)}</span>` : ''}${reszlet}</div>
        ${arHtml(r)}
      </li>`;
}

function hosszSor(r, hossz) {
  const cellak = hossz.map(([k, n]) => {
    const c = r.cellak[k];
    const rovidNev = { rovid: 'Rövid', kozepes: 'Közepes', hosszu: 'Hosszú', extra: 'Extra' }[k];
    if (!c) return `<span class="arl-cella arl-na" data-hossz="${esc(n)}"><span class="hk">${rovidNev}</span><span class="arl-ures" aria-label="nem elérhető">–</span></span>`;
    const noel = c.noel !== null
      ? `<span class="arl-noel-ar"><b class="arl-uj">${ft(c.noel)}</b></span>` : '<span class="arl-noel-ar"><span class="arl-ures" aria-label="nem elérhető">–</span></span>';
    return `<span class="arl-cella" data-hossz="${esc(n)}"><span class="hk">${rovidNev}<span class="sr"> haj</span></span><b class="arl-uj arl-lista-ar">${ft(c.ar)}</b>${noel}</span>`;
  }).join('');
  const egy = r.cellak.egyseges;
  if (egy) {
    const noel = egy.noel !== null ? `<span class="arl-noel-ar"><b class="arl-uj">${ft(egy.noel)}</b></span>` : '<span class="arl-noel-ar"><span class="arl-ures" aria-label="nem elérhető">–</span></span>';
    return `      <li class="arl-sor arl-hossz-sor arl-egyseges"${r.noelNincs ? ' data-noel-nincs' : ''}>
        <div class="arl-szoveg"><span class="arl-nev">${esc(r.nev)}</span><span class="arl-al">${esc(r.al)} · hajhossztól független</span></div>
        <p class="arl-ar"><b class="arl-uj arl-lista-ar">${ft(egy.ar)}</b>${noel}</p>
      </li>`;
  }
  return `      <li class="arl-sor arl-hossz-sor"${r.noelNincs ? ' data-noel-nincs' : ''}>
        <div class="arl-szoveg"><span class="arl-nev">${esc(r.nev)}</span>${r.al ? `<span class="arl-al">${esc(r.al)}</span>` : ''}</div>
        <div class="arl-cellak">${cellak}</div>
      </li>`;
}

function csoportHtml(u, cs) {
  const fej = cs.cim ? `    <div class="arl-csoport-fej"><h3 class="arl-csoport-cim">${esc(cs.cim)}</h3>${cs.al ? `<span class="arl-csoport-al">${esc(cs.al)}</span>` : ''}${cs.link ? `<a class="arl-csoport-link" href="${esc(cs.link.href)}">${esc(cs.link.szoveg)} <span class="nyil" aria-hidden="true">→</span></a>` : ''}</div>\n` : '';
  const oszlopok = cs.tipus === 'hossz'
    ? `\n      <li class="arl-oszlopok" aria-hidden="true"><span>A haj hossza</span>${u.hossz.map(([k, n]) => `<span>${esc(n.replace(/ haj$/, ''))}</span>`).join('')}</li>` : '';
  const sorok = cs.sorok.map((r) => (cs.tipus === 'hossz' ? hosszSor(r, u.hossz) : simaSor(r, cs.tipus))).join('\n');
  return `  <div class="arl-csoport${cs.tipus === 'hossz' ? ' arl-hossz' : ''}" data-arl-csoport>
${fej}    <ul class="arl-lista">${oszlopok}
${sorok}
    </ul>
  </div>`;
}

function szekcioHtml(u) {
  const noel = u.noelKedvezmeny
    ? `\n    <div class="arl-noel" data-arl-noel hidden>
      <p><b>Noelnél jelenleg ${u.noelKedvezmeny}% kedvezmény van.</b> Melyik árakat mutassuk?</p>
      <div class="arl-kapcsolo" role="group" aria-label="Fodrász"><button type="button" class="arl-kapcs aktiv" data-noel="0" aria-pressed="true">Betti és Evelin</button><button type="button" class="arl-kapcs" data-noel="1" aria-pressed="false">Noel (−${u.noelKedvezmeny}%)</button></div>
    </div>
    <p class="arl-noel-szoveg" data-arl-noel-szoveg><b>Noelnél jelenleg ${u.noelKedvezmeny}% kedvezmény van</b> – az ő árait a saját oldalán és a foglalóban a kedvezménnyel látod.</p>` : '';
  const kimit = u.kiMit && u.kiMit.length
    ? `\n    <details class="arl-kimit"><summary>Ki mit vállal?</summary><ul>${u.kiMit.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></details>` : '';
  const elol = u.elol ? `
    <div class="arl-elol"><p class="arl-pill">${esc(u.elol.pill)}</p>${u.elol.szoveg ? `<p class="arl-elol-szoveg">${esc(u.elol.szoveg)}</p>` : ''}</div>` : '';
  const kalk = u.kalkulator ? `\n    <p class="arl-kalk"><a href="${esc(u.kalkulator.href)}">${esc(u.kalkulator.szoveg)} <span class="nyil" aria-hidden="true">→</span></a></p>` : '';
  const masodik = u.masodikFoglalas ? `<a class="gomb gomb-korvonal" href="${esc(u.masodikFoglalas.href)}">${esc(u.masodikFoglalas.szoveg)} <span class="nyil" aria-hidden="true">→</span></a>` : '';
  return `<section class="arl-szekcio" id="${u.id}" aria-labelledby="${u.id}-cim" data-arl-szekcio>
  <div class="arl-tartalom">
    <header class="arl-fej">
      <h2 id="${u.id}-cim">${esc(u.cim)}</h2>
      <p class="arl-fej-al">${esc(u.al)}</p>
    </header>${elol}${noel}
${u.csoportok.map((cs) => csoportHtml(u, cs)).join('\n')}${kimit}${kalk}
    <ul class="arl-jegyzet">
${u.jegyzetek.map((j) => `      <li>${esc(j)}</li>`).join('\n')}
    </ul>
    <div class="arl-lab">
      <a class="gomb gomb-arany" href="${esc(u.foglalas)}">${esc(u.foglalasSzoveg || 'Időpontfoglalás')} <span class="nyil" aria-hidden="true">→</span></a>${masodik ? '\n      ' + masodik : ''}
      <a class="arl-tovabb" href="${esc(u.oldal)}">${esc(u.oldalSzoveg)}: minden részlet az oldalán <span class="nyil" aria-hidden="true">→</span></a>
    </div>
  </div>
</section>`;
}

const CIM = 'Árlista – MOSAIC Head Spa, szőrtelenítés, fodrászat, oxigénterápia, sminktetoválás';
const LEIRAS = 'A MOSAIC összes szolgáltatásának aktuális árai egy helyen: Head Spa és páros Head Spa, lézeres szőrtelenítés, fodrászat, oxigénterápia, sminktetoválás és ajándékkártya. Szűrhető, telefonon is könnyen olvasható.';

export function oldal(adat) {
  const chips = adat.map((u) => `<a class="arl-chip" href="#${u.id}" data-szuro="${u.id}">${esc(u.cim)}</a>`).join('\n        ');
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(CIM)}</title>
<meta name="description" content="${esc(LEIRAS)}">
<link rel="canonical" href="https://www.mosaicheadspa.hu/arlista">
<meta property="og:title" content="${esc(CIM)}">
<meta property="og:description" content="${esc(LEIRAS)}">
<meta property="og:image" content="https://www.mosaicheadspa.hu/assets/img/c2eb0f_0df44a446cba4ed087342e76f3eb1a77.png">
<meta property="og:url" content="https://www.mosaicheadspa.hu/arlista">
<meta property="og:site_name" content="MOSAIC Headspa">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/img/c2eb0f_b001e2c55098446da3e38ff055e20354.png" type="image/png">
<link rel="preload" href="/assets/fonts/playfair-display-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/headspa-oldal.css">
<link rel="stylesheet" href="/assets/css/arlista.css">
<script src="/assets/js/suti.js"></script>
</head>
<body>
<!--
  MOSAIC - Arlista (/arlista): az OSSZES uzletag aktualis arai egy helyen (a tulajdonos kerese, 2026-10-07: tobb uzletag lett, kell egy arlista oldal, szurheto, telefonon is jol olvashato).
  GENERALT: node tools/arlista-oldal.mjs (docs/ARLISTA.md). Az arak a meglevo oldalak / adatfajlok szerint jonnek, kezzel ne szerkeszd.
  A szuro es a kereso: assets/js/arlista.js (JS nelkul minden uzletag latszik, a chipek az uzletag-szekciokra ugranak).
-->

<!--mh-fejlec-->
<!--mh-menu-aktiv:/arlista-->

<main id="top" class="arl-oldal">
<section class="oldal-fej">
  <div class="tartalom">
    <h1>Árlista</h1>
    <span class="rombusz" aria-hidden="true"></span>
    <p class="lead">Minden szolgáltatásunk aktuális ára egy helyen. Válaszd ki, mi érdekel, vagy keress rá.</p>
    <div class="arl-kereso">
      <label class="sr" for="arl-q">Keress az árak között</label>
      <input type="search" id="arl-q" placeholder="Keress, pl. hónalj, balayage, páros" autocomplete="off" enterkeyhint="search">
      <span class="arl-talalat" id="arl-talalat" aria-live="polite"></span>
    </div>
  </div>
</section>

<nav class="arl-szuro" id="arl-szuro" aria-label="Üzletágak">
  <div class="arl-szuro-sav" id="arl-szuro-sav">
    <a class="arl-chip aktiv" href="#arak" data-szuro="mind" aria-current="true">Mind</a>
        ${chips}
  </div>
  <button type="button" class="arl-szuro-nyil" id="arl-szuro-nyil" aria-label="Tovább a többi kategóriához" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
</nav>

<div class="arl-lista-kozep" id="arak">
${adat.map(szekcioHtml).join('\n\n')}

<section class="arl-nincs" id="arl-nincs" aria-live="polite">
  <div class="arl-tartalom">
    <p>Erre a keresésre nem találtunk árat. Próbálj másik szót, vagy hívj minket!</p>
  </div>
</section>
</div>

<section class="arl-vege" aria-labelledby="arl-vege-cim">
  <div class="tartalom">
    <h2 id="arl-vege-cim">Nem találod, amit keresel?</h2>
    <p>Hívj minket a 06 20 247 4444-es számon, vagy írj nekünk, szívesen segítünk.</p>
    <div class="cta-sor">
      <a class="gomb gomb-arany" href="tel:+36202474444">Hívás: 06 20 247 4444</a>
      <a class="gomb gomb-korvonal" href="/kapcsolat">Üzenetet küldök <span class="nyil" aria-hidden="true">→</span></a>
    </div>
    <p class="arl-vege-link"><a href="/gyik">Gyakori kérdések <span class="nyil" aria-hidden="true">→</span></a></p>
  </div>
</section>
</main>

<!--mh-lablec-->

<script src="/assets/js/klon.js" defer></script>
<script src="/assets/js/arlista.js" defer></script>
</body>
</html>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const adat = await osszegyujt();
  const ki = path.join(GYOKER, 'foglalas', 'arlista.html');
  fs.writeFileSync(ki, oldal(adat), 'utf8');
  console.log('irva:', ki, '|', adat.map((u) => `${u.cim}: ${u.csoportok.reduce((n, c) => n + c.sorok.length, 0)}`).join(', '));
}
