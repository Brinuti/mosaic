// A kategoria-oldalak (migren / shenmen / klimax / slim piercing) uj, a fooldal stilusaban epulo sablonja.
//
// Az eredeti (Wix) oldalak ugyanazokbol a blokkokbol allnak: hos, "igy mukodik" (video), Google-velemenyek, "miert mukodnek", Facebook-kommentek,
// "nem hozzaerto kezekben", 93%, media, ekszerek, arlista + akcio, csapat, helyszinek, hosszu szoveg. A kinyert tartalom (uj-oldalak/tartalom/*.json)
// faja ebbol blokkokat ismer fel; a hos a fooldal hosevel azonos meretu es felepitesu, az ekszer / akcio / ar / media / csapat / helyszin blokk
// PONTOSAN a fooldal dobozaval (uj-oldalak/reszek/*.html, a fooldal is ezeket hasznalja) jelenik meg, a tobbi egyedi, a fooldal stilusu doboz.
// Ami nem ismerheto fel, valtozatlanul, az altalanos tukor-sablonnal jelenik meg (nincs elveszett tartalom).
// Tiszta fuggveny (nincs benne bongeszo): a Cloudflare-build is futtatja (tools/uj-fooldal.mjs -> sablon.mjs).

// a fejlec "Piercingek" menujenek oldalai. A "Divat fulpiercing" kimarad: kulon arlistaja van (12.000 Ft), a fooldal arai nem igazak ra.
import fs from 'node:fs';
import path from 'node:path';

export const KATEGORIA_UTAK = new Set(['/migren-piercing', '/shenmen-piercing', '/klimax-piercing', '/slim-etvagycsokkento-piercing',
  '/allergia-piercing', '/maj-piercing', '/pajzsmirigy-piercing', '/lep-piercing', '/vastagbel-piercing']);
// A "B" valtozat: az eredeti "-b" oldalak (galeria a hosben, az o szekcio-sorrendjuk es szovegeik) a kategoria-dizajnnal. A tulajdonos donteseert (2026-10-13)
// EZ AZ ALAP: az uj /uj/migren-piercing, /uj/shenmen-piercing, /uj/klimax-piercing, /uj/slim-etvagycsokkento-piercing oldal a -b oldal tartalmabol epul
// (a cim "b" nelkuli, a menu es a belso linkek ugyanide mutatnak). A tartalom: uj-oldalak/tartalom/*-piercing-b.json. A tobbi kategoria-oldalnak
// (allergia, maj, pajzsmirigy, lep, vastagbel) nincs -b oldala: azok a regi kategoria-sablonnal maradnak.
// a Google-velemenyek szama: build ideju tartalek (2026-10-16: 5 030), az oldal betoltesekor a /api/ertekeles mostani szama irja felul (uj-fooldal.js 4c.)
export const GOOGLE_DB = '5030';

export const B_ALAP = new Map([
  ['/migren-piercing', '/migren-piercing-b'],
  ['/shenmen-piercing', '/shenmen-piercing-b'],
  ['/klimax-piercing', '/klimax-piercing-b'],
  ['/slim-etvagycsokkento-piercing', '/slim-piercing-b'],
  // Gabi tortenete ("Igy szabadultam meg a migrentol"): a sajat tartalmabol, a B oldalak dizajnjaval (a tulajdonos kerese, 2026-10-16)
  ['/igy-szabadultam-meg-a-migrentol', '/igy-szabadultam-meg-a-migrentol'],
  // Rolunk es az oszi akcio oldala: ugyanigy (a tulajdonos kerese, 2026-10-16)
  ['/rolunk', '/rolunk'],
  ['/3-piercing-2-araert-regi', '/3-piercing-2-araert-regi'],
]);
export const KATEGORIA_B_UTAK = new Set(B_ALAP.values());
// a B oldal sajat hos-cime (ahol az eredeti cim egy hosszu mondat): az eredeti mondat a bevezetobe kerul
const HOS_CIM = new Map([
  ['/rolunk', { cim: '11 év migrén után <em>végre szabad vagyok</em>' }],
  ['/3-piercing-2-araert-regi', { cim: 'Most megéri 2 vagy 3 <em>piercinget szúratni!</em>' }],
  ['/igy-szabadultam-meg-a-migrentol', { cimBevezetobe: true, cim: 'Így szabadultam meg <em>a migréntől</em>', kep: { src: '/assets/img/f18724_54b61499c5b84a13a36273a398325981.webp', nw: 1000, nh: 963, alt: 'Kovács Gabriella, a Medical Piercing alapítója, munka közben' } }],
]);

// A hosszu szoveg fo-cimeinek helye (csomopont-indexek): h (1-2. szint), a szamozott cimek ("10. ...": a Wixen neha csak bekezdes, vagy 3. szintu cim) akkor,
// ha a szamuk folytatja a sort (az "a) ..." / "1. 2. 3." alpontok nem fo-cimek)
const foCimIndexek = (nodes, T) => {
  const fo = new Set();
  let utolso = 0;
  nodes.forEach((x, i) => {
    const t = T.szovegTiszta(x.html || '');
    const m = /^(\d{1,2})\.\s\S/.exec(t);
    const szam = m ? +m[1] : 0;
    if (x.t === 'h' && x.n <= 2) { fo.add(i); if (szam) utolso = szam; return; }
    const folytatja = szam > utolso && szam <= utolso + 3;
    if (x.t === 'h' && folytatja) { fo.add(i); utolso = szam; return; }
    if (x.t === 'p' && folytatja && t.length <= 90 && !/[.!?:]$/.test(t)) { fo.add(i); utolso = szam; }
  });
  return fo;
};

const laposit = (n, ki = []) => { if (n.k) n.k.forEach((x) => laposit(x, ki)); else ki.push(n); return ki; };
const gyerekek = (fa) => (fa.t === 'verem' ? fa.k : [fa]);

// ---------------------------------------------------------------------------------------------------------------------------------------
// a blokkok felismerese
export function kategoriaBlokkok(adat, T, B = false) {
  const tisztit = (n) => T.szovegTiszta(n.html || '');
  const szekciok = adat.szekciok;
  if (!szekciok.length) return null;
  const hero = B ? heroElemzesB(szekciok[0], T) : heroElemzes(szekciok[0], T);
  if (!hero) return null;

  const videoIfr = (n) => n.t === 'iframe' && (n.fajta === 'yt' || n.fajta === 'egyeb');
  const velemenyIfr = (n) => n && n.t === 'iframe' && n.fajta === 'beagyazas' && (n.h || 0) >= 500;
  const vanVideo = (n) => laposit(n).some(videoIfr);
  const hCim = (n, re) => n && n.t === 'h' && re.test(tisztit(n));
  const sorKepVerem = (n) => n && n.t === 'sor' && n.k.length === 2 && n.k[0].t === 'kep' && n.k[1].t === 'verem' ? n.k[1] : null;
  const elsoP = (v) => (v && v.k[0] && v.k[0].t === 'p' ? tisztit(v.k[0]) : '');

  // --- a "B" oldalak (az eredeti -b oldalak) sajat blokkjai; ami itt nem ismerheto fel, az az altalanos felismerore marad ---
  const pipaRe = /^\s*(?:✅|✔️?|☑️?)\s*/u;
  const pipaP = (x) => x.t === 'p' && pipaRe.test(tisztit(x));
  const par = (x) => x && x.t === 'sor' && x.k.length === 2 && ((x.k[0].t === 'kep' && x.k[1].t === 'verem') || (x.k[0].t === 'verem' && x.k[1].t === 'kep')) && laposit(x).some((y) => y.t === 'h');
  function felismerB(k, i) {
    const n = k[i];
    const vege = k.length - i;
    const kov = k[i + 1];
    // --- Gabi tortenete (es a hasonlo felepitesu B oldalak) ---
    // a Common Ninja GYIK-widget helyett (fizetos kulso szolgaltatas) a sajat GYIK-oldalunk
    if (hCim(n, /^Gyakori Kérdések írásosan/i)) return { tip: 'gyiklink', cim: n, hossz: vege };
    // a csonka "9 ok, amiert minket valassz" (az eredetin is csak az 1. ok van meg) kimarad
    if (hCim(n, /^\d+ ok, amiért/i)) return { tip: 'kihagy', hossz: vege };
    if (hCim(n, /^Milyen ékszerek közül/i)) return { tip: 'ekszer', hossz: vege };
    // a regi (tavaszi) arlista egy verem belsejeben: a fooldal mostani akcio- es ar-doboza valtja
    if (n.t === 'verem' && laposit(n).some((x) => hCim(x, /^Árlista/i))) return { tip: 'ar', hossz: vege, nodes: k.slice(i) };
    // vertikalis video-beszamolok (borito kep + mp4 parok)
    if (n.t === 'h' && /videó beszámol/i.test(tisztit(n))) {
      const lv = k.slice(i + 1).flatMap((x) => laposit(x));
      const elemek = [];
      lv.forEach((x, j) => { if (x.t === 'video') { const kp = lv[j - 1] && lv[j - 1].t === 'kep' ? lv[j - 1] : null; elemek.push({ video: x, kep: kp }); } });
      if (elemek.length) return { tip: 'videok', cim: n, elemek, hossz: vege };
    }
    // az akcio feltetelei: ekszer-galeria + szoveg ("Tobb piercing = Erosebb hatas") -> a fooldal akcio- es ar-doboza, ekszer-galeriaja es a feltetelek
    if (n.t === 'sor' && n.k.some((x) => x.t === 'galeria')) {
      const v = n.k.find((x) => x.t === 'verem');
      const lv = v ? laposit(v) : [];
      const h = lv.find((x) => x.t === 'h');
      if (h) return { tip: 'akciofelt', cim: h, nodes: lv.filter((x) => x !== h), hossz: 1 };
    }
    // "Vendegeim ezt tapasztaljak ...:" + gondolatjeles sorok
    if (n.t === 'p' && /:\s*$/.test(tisztit(n)) && kov && kov.t === 'p' && /^\s*-\s/.test(tisztit(kov))) {
      let j = i + 1;
      const elemek = [];
      while (k[j] && k[j].t === 'p' && /^\s*-\s/.test(tisztit(k[j]))) elemek.push(tisztit(k[j++]).replace(/^\s*-\s*/, ''));
      return { tip: 'tapasztalat', cim: n, elemek, hossz: vege };
    }
    // nagy kep + egy mondat (Gabi a fulakupunkturas bizonyitvanyaval)
    if (n.t === 'kep' && (n.nw || 0) >= 500 && kov && kov.t === 'p' && vege === 2) return { tip: 'biztos', kep: n, cim: kov, szovegek: [], pipak: [], hossz: 2 };
    // "biztonsagos es termeszetes modszer": kep + cim + bevezeto + pipas sorok
    if (n.t === 'sor' && n.k.length === 2 && n.k[0].t === 'kep' && n.k[1].t === 'verem') {
      const lv = laposit(n.k[1]);
      const h = lv.find((x) => x.t === 'h');
      const pipak = lv.filter(pipaP);
      if (h && pipak.length >= 2) return { tip: 'biztos', kep: n.k[0], cim: h, szovegek: lv.filter((x) => x.t === 'p' && !pipaP(x) && tisztit(x)), pipak, hossz: 1 };
    }
    // video + szoveg (a cim itt nem "mukodik"-es: "Engem 11 ev migrentol szabaditott meg.")
    if (n.t === 'sor' && n.k.length === 2 && vanVideo(n)) {
      const szoveges = n.k.find((x) => !vanVideo(x));
      const lv = szoveges ? laposit(szoveges) : [];
      const h = lv.find((x) => x.t === 'h');
      if (h) return { tip: 'video', cim: h, video: laposit(n).find(videoIfr), szovegek: lv.filter((x) => x !== h), hossz: 1 };
    }
    // szoveg + kep parok egymas utan ("Hova szurjuk?", "Hogy nez ki a szuras?", "Mennyibe kerul?")
    if (par(n)) {
      let j = i;
      const elemek = [];
      while (par(k[j])) {
        const x = k[j++];
        elemek.push({ kep: x.k.find((y) => y.t === 'kep'), balKep: x.k[0].t === 'kep', nodes: laposit(x.k.find((y) => y.t === 'verem')) });
      }
      return { tip: 'parok', elemek, hossz: j - i };
    }
    // a fuggoleges bemutato video ("Igy nez ki egy ... piercing behelyezes"); a video nelkuli cim (klimax) kimarad
    if (n.t === 'sor') {
      const lv = laposit(n);
      const v = lv.find((x) => x.t === 'video'), h = lv.find((x) => x.t === 'h');
      if (v && h) return { tip: 'bevideo', cim: h, video: v, kep: lv.find((x) => x.t === 'kep'), hossz: 1 };
    }
    if (hCim(n, /^Így néz ki/i) && vege === 1) return { tip: 'bevideo', cim: n, video: null, hossz: 1 };
    // "Miert a Medical Piercinget valaszd?": cim + ikonos racs
    if (hCim(n, /^Miért a Medical Piercing/i) && k[i + 1] && k[i + 1].t === 'racs') return { tip: 'bizalom', cim: n, racs: k[i + 1], hossz: 2 };
    // az orvosi ajanlas kepe (onallo szekcio)
    if (n.t === 'kep' && k.length === 1 && (n.nw || 0) >= 500) return { tip: 'ajanlas', kep: n, hossz: 1 };
    // "Budapesten a Jaszainal varunk": cim, cim / elerhetoseg / nyitvatartas, terkep, kozossegi ikonok, galeria
    if (hCim(n, /^Budapesten\b.*várunk/i)) return { tip: 'elerhetoseg', cim: n, nodes: k.slice(i + 1), hossz: vege };
    return null;
  }

  // a B oldalak kesoi szabalyai (Gabi tortenete): csak ha sem a B, sem az altalanos felismero nem talalt semmit
  function felismerKesoi(k, i) {
    const n = k[i];
    const kov = k[i + 1];
    // Google / Facebook-velemeny widget: cim + tobb bekezdes + a beagyazas
    if (n.t === 'h' && kov && kov.t === 'p') {
      let j = i + 1;
      while (k[j] && k[j].t === 'p') j++;
      if (velemenyIfr(k[j]) && j - i > 2) return { tip: 'velemeny', cim: n, alcim: kov, link: null, ifr: k[j], hossz: j - i + 1 };
    }
    // cim + video (kozvetlenul, vagy egy bekezdes utan), illetve cim + (szoveg + video) sor
    const gombUtan = (j) => (k[j] && k[j].t === 'gomb' ? 1 : 0);
    if (n.t === 'h' && (kov && videoIfr(kov))) return { tip: 'video', cim: n, video: kov, szovegek: [], hossz: 2 + gombUtan(i + 2) };
    if (n.t === 'h' && kov && kov.t === 'p' && (k[i + 2] && videoIfr(k[i + 2]))) return { tip: 'video', cim: n, video: k[i + 2], szovegek: [kov], hossz: 3 + gombUtan(i + 3) };
    if (n.t === 'h' && kov && kov.t === 'sor' && vanVideo(kov)) {
      const lv = laposit(kov);
      return { tip: 'video', cim: n, video: lv.find(videoIfr), szovegek: lv.filter((x) => x.t === 'p' || x.t === 'ul'), hossz: 2 + gombUtan(i + 2) };
    }
    // cim + (kep + szoveg) sor + forras-bekezdesek ("Igy mukodik a migren piercing")
    if (n.t === 'h' && sorKepVerem(kov)) {
      let j = i + 2;
      while (k[j] && k[j].t === 'p') j++;
      return { tip: 'video', cim: n, video: null, kep: kov.k[0], szovegek: [...laposit(kov.k[1]).filter((x) => x.t === 'p' || x.t === 'ul'), ...k.slice(i + 2, j)], hossz: j - i };
    }
    return null;
  }

  function felismer(k, i) {
    if (B) { const b = felismerB(k, i); if (b) return b; }
    const n = k[i], kov = k[i + 1], kov2 = k[i + 2];
    const vege = k.length - i;   // "a szekcio vegeig"

    // Google-velemenyek: cim + (alcim) + a nagy beagyazott widget + "Tovabb az osszes velemenyhez"
    if (n.t === 'h' && (velemenyIfr(kov) || (kov && kov.t === 'p' && velemenyIfr(kov2)))) {
      const alcim = kov.t === 'p' ? kov : null;
      const utan = k[i + (alcim ? 3 : 2)];
      const link = utan && utan.t === 'p' && /Tovább az összes/i.test(tisztit(utan)) ? utan : null;
      return { tip: 'velemeny', cim: n, alcim, link, ifr: alcim ? kov2 : kov, hossz: (alcim ? 3 : 2) + (link ? 1 : 0) };
    }
    // "Igy mukodik": video + szoveg
    if (n.t === 'sor' && n.k.length === 2 && vanVideo(n)) {
      const szoveges = n.k.find((x) => !vanVideo(x));
      const lv = szoveges ? laposit(szoveges) : [];
      const h = lv.find((x) => x.t === 'h');
      if (h && /műk[öo]dik/i.test(tisztit(h))) return { tip: 'video', cim: h, video: laposit(n).find(videoIfr), szovegek: lv.filter((x) => x !== h), hossz: 1 };
    }
    if (n.t === 'sor' && n.k.length >= 2) {
      // a "hatter-*.png" dekoracios hatterkep, nem a tartalom kepe
      const kepN = n.k.filter((x) => x.t === 'kep' && (x.nw || 0) >= 300 && !/hatter/i.test(x.alt || '')).sort((a, b) => (b.nw * b.nh) - (a.nw * a.nh))[0];
      const szoveges = n.k.find((x) => x.t === 'verem');
      const lv = szoveges ? laposit(szoveges) : [];
      const h = lv.find((x) => x.t === 'h');
      if (kepN && h && /műk[öo]dik/i.test(tisztit(h))) return { tip: 'video', cim: h, kep: kepN, szovegek: lv.filter((x) => x !== h), hossz: 1 };
    }
    if (n.t === 'h' && /műk[öo]dik/i.test(tisztit(n)) && kov && videoIfr(kov)) return { tip: 'video', cim: n, video: kov, szovegek: [], hossz: 2 };
    if (n.t === 'h' && /műk[öo]dik/i.test(tisztit(n)) && kov && kov.t === 'sor' && vanVideo(kov)) {
      const lv = laposit(kov);
      const video = lv.find(videoIfr);
      return { tip: 'video', cim: n, video, szovegek: lv.filter((x) => x !== video && x.t !== 'gomb'), hossz: kov2 && kov2.t === 'gomb' ? 3 : 2 };
    }
    // "Miert mukodnek a piercingjeink?"
    const v = sorKepVerem(n);
    if (v && /^Miért működnek/i.test(elsoP(v))) return { tip: 'miert', kep: n.k[0], cim: v.k[0], lista: v.k.find((x) => x.t === 'ul'), hossz: 1 };
    // "Nem hozzaerto kezekben..."
    if (v && /^Nem hozzáértő/i.test(elsoP(v))) return { tip: 'figyelem', kep: n.k[0], cim: v.k[0], lista: v.k.find((x) => x.t === 'ul'), szovegek: v.k.filter((x) => x.t === 'p').slice(1), hossz: 1 };
    // 93% statisztika
    if (v && /^\d{2,3}\s*%$/.test(elsoP(v))) return { tip: 'stat', kep: n.k[0], szovegek: v.k.filter((x) => x.t === 'p'), hossz: 1 };
    // panaszok listaja (a vendegek javulasa)
    if (v && v.k.some((x) => x.t === 'h' && /panasz/i.test(tisztit(x)))) return { tip: 'panasz', kep: n.k[0], cim: v.k.find((x) => x.t === 'h'), szovegek: v.k.filter((x) => x.t !== 'h'), hossz: 1 };
    // Facebook-kommentek: cim + bevezeto + kepek (galeria vagy egy kep) + (kattints a nagyitashoz)
    if (hCim(n, /facebook vélemények/i)) {
      let j = i + 1;
      const bev = k[j] && k[j].t === 'p' ? k[j++] : null;
      const kepek = k[j] && (k[j].t === 'galeria' || k[j].t === 'kep') ? k[j++] : null;
      const tipp = k[j] && k[j].t === 'p' && /Kattints/i.test(tisztit(k[j])) ? k[j++] : null;
      if (kepek) return { tip: 'fb', cim: n, bev, kepek, tipp, hossz: j - i };
    }
    // a hosszu szoveges resz ("... tudastar" / osszefoglalo / informaciok): cim + egy nagy szoveg-verem, sok szamozott / fo-cimmel -> harmonika
    if (n.t === 'h' && kov && kov.t === 'verem' && foCimIndexek(kov.k, T).size >= 4) return { tip: 'tudastar', cim: n, torzs: kov.k, tobbi: k.slice(i + 2), hossz: vege };
    // a fooldal dobozaval megjeleno blokkok
    if (hCim(n, /legmagasabb minőségű ékszerek/i)) {
      let j = i + 1;
      while (j < k.length && !hCim(k[j], /^(Árlista|AKCIÓ)/i)) j++;
      return { tip: 'ekszer', hossz: j - i, nodes: k.slice(i, j) };
    }
    if (hCim(n, /^Árlista/i)) {
      // a B oldalakon az "Arlista + AKCIO" resz a "Miert a Medical Piercinget valaszd?" cimig tart (az onallo blokk)
      const veg = B ? k.findIndex((x, j) => j > i && hCim(x, /^Miért a Medical Piercing/i)) : -1;
      const hossz = veg > i ? veg - i : vege;
      const szoveg = JSON.stringify(k.slice(i, i + hossz));
      // a fooldal arai: 1 piercing 24.900, 2 piercing 39.900, 3 piercing 44.900 Ft; mas arlistat nem cserelunk le
      return ['24.900 Ft', '39.900 Ft', '44.900 Ft'].every((a) => szoveg.includes(a)) ? { tip: 'ar', hossz, nodes: k.slice(i, i + hossz) } : null;
    }
    if (hCim(n, /médiában/i)) return { tip: 'media', hossz: vege, nodes: k.slice(i) };
    if (hCim(n, /Ismerd meg csapatunkat/i)) return { tip: 'csapat', hossz: vege, nodes: k.slice(i) };
    if (hCim(n, /^Már \d+ városban/i)) return { tip: 'helyszin', hossz: vege, nodes: k.slice(i) };
    return B ? felismerKesoi(k, i) : null;
  }

  const blokkok = [];
  for (let si = 1; si < szekciok.length; si++) {
    const k = gyerekek(szekciok[si].fa);
    let egyeb = [];
    const urit = () => { if (egyeb.length) { blokkok.push({ tip: 'egyeb', nodes: egyeb }); egyeb = []; } };
    for (let i = 0; i < k.length;) {
      const b = felismer(k, i);
      if (b) { urit(); blokkok.push(b); i += b.hossz; } else { egyeb.push(k[i]); i++; }
    }
    urit();
  }
  return { hero, blokkok };
}

// Az eredeti blokkok szovegei, amiket a fooldal dobozai valtottak fel (ekszer, akcio / arlista, media, csapat, helyszin): a tukor-teszt szoveg-lefedettsegi
// ellenorzese ezeket nem varja el az uj oldalon (a fooldal szovege jelenik meg helyettuk).
export function kategoriaCserelt(adat, T, B = false) {
  const p = kategoriaBlokkok(adat, T, B);
  if (!p) return null;
  const szovegek = [];
  for (const b of p.blokkok) {
    if (!['ekszer', 'ar', 'media', 'csapat', 'helyszin'].includes(b.tip)) continue;
    for (const l of b.nodes.flatMap((n) => laposit(n))) {
      if (l.t === 'h' || l.t === 'p') szovegek.push(T.szovegTiszta(l.html || ''));
      else if (l.t === 'ul') szovegek.push(...l.elemek.map((e) => T.szovegTiszta(e)));
      else if (l.t === 'gomb') szovegek.push(l.szoveg);
    }
  }
  return szovegek.filter(Boolean);
}

// a hos tartalma: cim, bevezeto, gomb, ertekeles, kep, idezet
function heroElemzes(szekcio, T) {
  const tisztit = (n) => T.szovegTiszta(n.html || '');
  const lv = laposit(szekcio.fa);
  const h1 = lv.find((x) => x.t === 'h' && x.n === 1) || lv.find((x) => x.t === 'h');
  const kep = lv.filter((x) => x.t === 'kep').sort((a, b) => (b.nw || 0) - (a.nw || 0)).find((x) => (x.nw || 0) >= 500);
  if (!h1 || !kep) return null;
  const ps = lv.filter((x) => x.t === 'p' && tisztit(x));
  const ert = ps.find((p) => /^Kiváló/i.test(tisztit(p)) || (/\d[.,]\d/.test(tisztit(p)) && /vélemény|értékelés/i.test(tisztit(p))));
  const tag = ps.find((p) => /csak\s+e[üu]\s+szakember/i.test(tisztit(p)));
  const hIdezet = lv.find((x) => x.t === 'h' && x !== h1);
  const idezetP = hIdezet ? lv.slice(lv.indexOf(hIdezet) + 1).find((x) => x.t === 'p') : null;
  const extra = ps.filter((p) => p !== ert && p !== tag && p !== idezetP && T.csakLink(p.html) && !/^Kiváló/i.test(tisztit(p)));
  const bev = ps.find((p) => lv.indexOf(p) > lv.indexOf(h1) && p !== ert && p !== tag && p !== idezetP && !extra.includes(p));
  return { h1, kep, gomb: lv.find((x) => x.t === 'gomb'), ert, tag, bev, extra, idezetH: hIdezet, idezetP };
}

// a B oldalak hosenek tartalma: cim, bevezeto, gomb, ertekeles-sor, linkek, galeria (az idezet / egyetlen kep helyett)
function heroElemzesB(szekcio, T) {
  const tisztit = (n) => T.szovegTiszta(n.html || '');
  const lv = laposit(szekcio.fa);
  const h1 = lv.find((x) => x.t === 'h' && x.n === 1) || lv.find((x) => x.t === 'h');
  const gal0 = lv.find((x) => x.t === 'galeria');
  const gal = gal0 && gal0.kepek.length >= 2 ? gal0 : null;
  // galeria nelkuli B hos (Gabi tortenete): az elso nagy kep a hos kepe
  const kep = gal ? null : lv.find((x) => x.t === 'kep' && (x.nw || 0) >= 500);
  // kep nelkuli B hos (Rolunk): a hos YouTube-videoja
  const video = gal || kep ? null : lv.find((x) => x.t === 'iframe' && x.fajta === 'yt');
  if (!h1 || (!gal && !kep && !video)) return null;
  const ps = lv.filter((x) => x.t === 'p' && tisztit(x));
  const ert = ps.find((p) => /vélemény alapján|\d értékelés|\d vélemény/i.test(tisztit(p)));
  const extra = ps.filter((p) => p !== ert && T.csakLink(p.html));
  const bev = ps.find((p) => p !== ert && !extra.includes(p));
  return { h1, gal, kep, video, gomb: lv.find((x) => x.t === 'gomb'), ert, extra, bev };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// megjelenites
export function kategoriaFo(ROOT, adat, c, T, opciok = {}) {
  const B = !!opciok.b;   // a "B" valtozat: az eredeti -b oldal szerkezete es szovege (lasd KATEGORIA_B_UTAK)
  if (!(B ? KATEGORIA_B_UTAK : KATEGORIA_UTAK).has(adat.ut)) return null;
  const p = kategoriaBlokkok(adat, T, B);
  if (!p) return null;
  const { esc, IK, szovegLink, szovegTiszta, belso } = T;
  const van = new Set(p.blokkok.map((b) => b.tip));
  c.h1 = true;       // a hos h1-e mar megvan
  c.kepSzam = 1;     // a hos kepe az elso (a tobbi lusta toltesu)

  // az eredeti fooldal szalon-fotogaleriaja (a tartalom-JSON-ban: a cim nelkuli, 10-nel tobb kepes galeria)
  let fooldaliGaleria = null;
  try {
    const fo = JSON.parse(fs.readFileSync(path.join(ROOT, 'uj-oldalak/tartalom/index.json'), 'utf8'));
    const keres = (n) => (n.t === 'galeria' ? [n] : (n.k || []).flatMap(keres));
    const cimes = (n) => n.t === 'h' || (n.k || []).some(cimes);
    for (const sz of fo.szekciok) { if (cimes(sz.fa)) continue; const g = keres(sz.fa).find((x) => x.kepek.length >= 10); if (g) { fooldaliGaleria = g; break; } }
  } catch { /* marad az eredeti galeria */ }

  const lista = (n, osztaly = 'pipak') => `<ul class="${osztaly}">${n.elemek.map((e) => `<li>${osztaly === 'pipak' ? IK('check') : ''}${szovegLink(e)}</li>`).join('')}</ul>`;
  const bekezd = (n) => `<p>${szovegLink(n.html)}</p>`;
  const gombHtml = (szoveg, href, kicsi = true) => `<a class="gomb ${kicsi ? 'gomb-kicsi' : 'gomb-tomor'}" href="${esc(href)}">${esc(szoveg)}${IK('chev', 'ik-nyil')}</a>`;
  const reszlet = (nev) => T.partial(ROOT, nev);
  const keparany = (n) => (n.nw && n.nh ? ` width="${n.nw}" height="${n.nh}"` : '');

  // --- hos: ugyanaz a felepites, mint az uj fooldalon ---
  const hos = () => {
    const h = p.hero;
    let cim = szovegLink(h.h1.html);
    if (!/</.test(cim)) cim = cim.replace(/(garanci.*|egészségügyi tapasztalattal\.?)$/i, '<em>$1</em>');
    const gomb = h.gomb ? h.gomb : { szoveg: 'Időpontot foglalok', href: '/idopontfoglalas' };
    const linkek = [`<li><a href="/migren-es-shenmen-piercing-garancia">Garancia »</a></li>`];
    if (van.has('helyszin')) linkek.push('<li><a href="#helyszinek">Helyszíneink »</a></li>');
    for (const e of h.extra) linkek.push(`<li>${szovegLink(e.html)}</li>`);
    const csill = Array.from({ length: 5 }, () => IK('star')).join('');
    // a pontszam es a vélemenyek szama a Trustindex-widget fejlecebol jon (assets/js/uj-fooldal.js 4c.: /api/ertekeles); a szoveg itt csak tartalek
    const ert = `<p class="kat-ertekeles"><span class="csillagok" role="img" aria-label="5 csillagból 4,8">${csill}</span><a href="/migren-shenmen-piercing-velemenyek" data-ti-ertekeles>Kiváló – 4,8 – ${GOOGLE_DB} vélemény »</a></p>`;
    return `<section class="hos kat-hos">
    <div class="tarto hos-racs">
      <h1 class="hos-cim">${cim}</h1>
      <div class="hos-szoveg">
        ${h.bev ? `<p class="hos-bevezeto">${szovegLink(h.bev.html)}</p>` : ''}
        ${h.idezetP ? `<p class="hos-alcim">${szovegLink(h.idezetP.html)}</p>` : ''}
        <div class="gombsor">
          <a class="gomb gomb-tomor" href="${esc(belso(gomb.href))}">${IK('calendar')}${esc(gomb.szoveg.replace(/!$/, ''))}${IK('chev', 'ik-nyil')}</a>
          ${van.has('ar') || van.has('akciofelt') ? `<a class="gomb gomb-ures" href="#arak">Árak és akciók${IK('chev', 'ik-nyil')}</a>` : ''}
        </div>
        ${ert}
        <ul class="hos-linkek">${linkek.join('')}</ul>
        <!--#bizalom-->
      </div>
      <figure class="hos-kep">
        <img src="${esc(h.kep.src)}"${keparany(h.kep)} alt="${esc(h.kep.alt || adat.cim)}"${h.kep.nh > h.kep.nw ? ' style="object-position:50% 40%"' : ''} fetchpriority="high">
        ${h.idezetH ? `<figcaption class="hos-idezet"><span class="hos-idezet-cim">${szovegLink(h.idezetH.html)}</span>${h.idezetP ? `<small>${szovegLink(h.idezetP.html)}</small>` : ''}</figcaption>` : ''}
        <div class="hos-pecset" aria-hidden="true">${IK('shield')}<span>20 év<br>alapítói<br>egészségügyi<br>tapasztalat</span></div>
      </figure>
    </div>
  </section>`;
  };

  // --- B hos: ugyanaz a felepites, de a kep helyett galeria (az eredeti -b oldal 5 kepe), idezet-doboz nelkul ---
  const hosB = () => {
    const h = p.hero;
    // az eredeti cim diszito emojikat (ful, pipa) tartalmaz: a szoveg marad, a dísz nem
    const diszRe = /^[\s\u{1F442}\u2705\uFE0F]+|[\s\u{1F442}\u2705\uFE0F]+$/gu;
    let cim = szovegLink(h.h1.html).replace(diszRe, '');
    if (!/</.test(cim)) cim = cim.replace(/(garanci.*)$/i, '<em>$1</em>');
    // a sajat cimu B oldalak (Gabi tortenete): az eredeti hos-cim (egy hosszu mondat) a bevezetobe kerul, a kerdes ele
    const sajatCim = HOS_CIM.get(adat.ut);
    let bevHtml = h.bev ? szovegLink(h.bev.html) : '';
    if (sajatCim && sajatCim.cimBevezetobe) {
      const kerdes = laposit(adat.szekciok[0].fa).find((x) => x.t === 'p' && /\?\s*$/.test(szovegTiszta(x.html)));
      bevHtml = (kerdes ? `<b>${szovegLink(kerdes.html)}</b> ` : '') + szovegLink(h.h1.html);
    }
    if (sajatCim) {
      cim = sajatCim.cim;
      if (sajatCim.kep) h.kep = sajatCim.kep;
    }
    const gomb = h.gomb ? h.gomb : { szoveg: 'Időpontot foglalok', href: '/idopontfoglalas' };
    const linkek = [`<li><a href="/migren-es-shenmen-piercing-garancia">Garancia »</a></li>`];
    if (van.has('helyszin')) linkek.push('<li><a href="#helyszinek">Helyszíneink »</a></li>');
    // az eredeti "Mutasd az ekszereket es az arakat >>" link az oldal sajat reszere mutat: a lapon belul az ekszerekhez ugrik
    // mobilon a hosszu szoveg helyett a rovid ("Ekszerek es arak") latszik, hogy a 3 link egy sorba ferjen
    for (const e of h.extra) linkek.push(`<li><a href="${van.has('ekszer') ? '#ekszerek' : '#arak'}"><span class="hosszu">${esc(szovegTiszta(e.html).replace(/\s*(?:>>|&gt;&gt;)\s*$/, ''))}</span><span class="rovid">Ékszerek és árak</span> »</a></li>`);
    const csill = Array.from({ length: 5 }, () => IK('star')).join('');
    const ert = `<p class="kat-ertekeles"><span class="csillagok" role="img" aria-label="5 csillagból 4,8">${csill}</span><a href="/migren-shenmen-piercing-velemenyek" data-ti-ertekeles>Kiváló – 4,8 – ${GOOGLE_DB} vélemény »</a></p>`;
    const id = ++c.galeriaSzam;
    const db = h.gal ? h.gal.kepek.length : 0;
    // az elso kep eredetileg "<- Lapozz balra" jelzest hordoz: a tools/uj-b-hos-kep.py "Lapozz jobbra ->" jelzesu valtozatot keszit (assets/img/uj-hos-01.webp)
    const hosKep = (src) => (/54ef80f3849d46cfa63ae77598afbcf7/.test(src) && fs.existsSync(path.join(ROOT, 'assets/img/uj-hos-01.webp')) ? '/assets/img/uj-hos-01.webp' : src);
    const dia = (k, i) => `<figure class="kar-dia"><img src="${esc(hosKep(k.src))}" width="800" height="800" alt="${esc(`Medical Piercing – ${i + 1}. kép a ${db}-ből`)}"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" data-nagyit data-grp="g${id}"></figure>`;
    const galeria = !h.gal && !h.kep ? T.iframe(h.video) : !h.gal ? `<img src="${esc(h.kep.src)}"${keparany(h.kep)} alt="${esc(h.kep.alt && !/^\d+_|\.(?:jpe?g|png|webp)$/i.test(h.kep.alt) ? h.kep.alt : adat.cim)}" fetchpriority="high">` : `<div class="kar kat-hos-kar" data-kar="${id}"><div class="kar-sav" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Fotók a kezelésről">${h.gal.kepek.map(dia).join('')}</div>`
      + `<button type="button" class="kar-gomb kar-elozo" aria-label="Előző kép" disabled>${IK('chev')}</button><button type="button" class="kar-gomb kar-kov" aria-label="Következő kép">${IK('chev')}</button><p class="kar-szam"><span data-kar-akt>1</span> / ${db}</p></div>`;
    return `<section class="hos kat-hos kat-hos-b">
    <div class="tarto hos-racs">
      <h1 class="hos-cim">${cim}</h1>
      <div class="hos-szoveg">
        ${bevHtml ? `<p class="hos-bevezeto">${bevHtml}</p>` : ''}
        <div class="gombsor">
          <a class="gomb gomb-tomor" href="${esc(belso(gomb.href))}">${IK('calendar')}${esc(gomb.szoveg.replace(/!$/, ''))}${IK('chev', 'ik-nyil')}</a>
          ${van.has('ar') || van.has('akciofelt') ? `<a class="gomb gomb-ures" href="#arak">Árak és akciók${IK('chev', 'ik-nyil')}</a>` : ''}
        </div>
        <div class="hos-ertek-sav">
          ${ert}
          <ul class="hos-linkek">${linkek.join('')}</ul>
        </div>
        <!--#bizalom-->
      </div>
      <figure class="hos-kep${h.gal ? ' hos-galeria' : !h.kep ? ' hos-video' : ''}">
        ${galeria}
        <div class="hos-pecset" aria-hidden="true">${IK('shield')}<span>20 év<br>alapítói<br>egészségügyi<br>tapasztalat</span></div>
      </figure>
    </div>
  </section>`;
  };

  // --- B: "A migren piercing biztonsagos es termeszetes modszer": kep + szoveg + pipas lista ---
  const pipaTisztit = (html) => html.replace(/(?:\u2705|\u2714\uFE0F?|\u2611\uFE0F?)\s*/u, '');   // a pipa-emoji a linkbe is kerulhet: az elso elofordulast vesszuk ki
  // a kep (Kovacs Gabriella a fulakupunkturas bizonyitvanyaval) fontos: kattintasra nagyban nyilik, egy jelzes mutatja, hogy nagyithato
  const biztos = (b) => `<section class="tarto"><article class="kat-doboz kat-biztos">
    <figure class="kat-biztos-fig"><img class="kat-biztos-kep" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt && !/^\d+_/.test(b.kep.alt) ? b.kep.alt : 'Kovács Gabriella a fülakupunktúrás bizonyítványával')}" loading="lazy" decoding="async" data-nagyit><span class="kat-nagyit-jel" aria-hidden="true"><svg class="ik" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M10.5 8v5M8 10.5h5"/></svg>Nagyítás</span></figure>
    <div class="kat-doboz-szoveg">
      <h2>${szovegLink(b.cim.html)}</h2>
      ${b.szovegek.map(bekezd).join('\n      ')}
      <ul class="pipak">${b.pipak.map((x) => `<li>${IK('check')}${pipaTisztit(szovegLink(x.html))}</li>`).join('')}</ul>
    </div>
  </article></section>`;

  // --- B: a Common Ninja GYIK-widget helyett a sajat GYIK-oldal ---
  const gyikLink = (b) => `<section class="tarto"><article class="kat-doboz kat-gyiklink">
    <div class="kat-doboz-szoveg">
      <p class="felirat">${IK('play')}GYIK</p>
      <h2>${szovegLink(b.cim.html)}</h2>
      <p>Előre megválaszoltuk a 33 leggyakoribb kérdést: fájdalom, gyógyulás, utóápolás, garancia, ékszercsere.</p>
      <a class="gomb gomb-kicsi" href="/akupunkturas-piercing-tudastar-video">Gyakori kérdések${IK('chev', 'ik-nyil')}</a>
    </div>
  </article></section>`;

  // --- B: vertikalis video-beszamolok (borito kep + mp4), racsban ---
  const videok = (b) => `<section class="tarto"><div class="kat-doboz kat-videok">
    <p class="felirat">${IK('play')}Videók</p>
    <h2>${szovegLink(b.cim.html)}</h2>
    <ul class="kat-video-racs">${b.elemek.map((e) => `<li><video src="${esc(e.video.src)}"${e.kep ? ` poster="${esc(e.kep.src)}"` : ''} controls preload="none" playsinline></video></li>`).join('')}</ul>
    <a class="gomb gomb-kicsi" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
  </div></section>`;

  // --- B: az akcio feltetelei (szoveg + gomb) ---
  const akcioFelt = (b) => `<section class="tarto"><article class="kat-doboz kat-akciofelt">
    <div class="kat-doboz-szoveg">
      <p class="felirat">${IK('sparkles')}Az akció feltételei</p>
      <h2>${szovegLink(b.cim.html)}</h2>
      ${b.nodes.map((x) => (x.t === 'p' && szovegTiszta(x.html) ? bekezd(x) : x.t === 'ul' ? lista(x) : '')).join('\n      ')}
      <a class="gomb gomb-kicsi" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
    </div>
  </article></section>`;

  // --- B: "Vendegeim ezt tapasztaljak ...": pipas lista ---
  const tapasztalat = (b) => `<section class="tarto"><article class="kat-doboz kat-tapasztalat">
    <div class="kat-doboz-szoveg">
      <p class="felirat">${IK('userc')}Vendégeink tapasztalata</p>
      <h2>${esc(szovegTiszta(b.cim.html).replace(/:\s*$/, ''))}</h2>
      <ul class="pipak">${b.elemek.map((e) => `<li>${IK('check')}${esc(e)}</li>`).join('')}</ul>
      <a class="gomb gomb-kicsi" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
    </div>
  </article></section>`;

  // --- B: szoveg + kep parok (hova szurjuk / hogy nez ki / mennyibe kerul): a kep oldala valtakozik, ahogy az eredetin ---
  const parok = (b) => `<section class="tarto kat-parok">${b.elemek.map((e) => {
    const cim = e.nodes.find((x) => x.t === 'h');
    const torzs = e.nodes.filter((x) => x !== cim).map((x) => {
      if (x.t === 'p') return szovegTiszta(x.html) ? bekezd(x) : '';
      if (x.t === 'ul') return lista(x);
      if (x.t === 'gomb') return gombHtml(x.szoveg.replace(/!$/, ''), belso(x.href));
      return '';
    }).join('\n      ');
    return `
  <article class="kat-doboz kat-par${e.balKep ? ' kat-par-ford' : ''}">
    <div class="kat-doboz-szoveg">
      <h2>${szovegLink(cim.html)}</h2>
      ${torzs}
    </div>
    <img class="kat-par-kep" src="${esc(e.kep.src)}"${keparany(e.kep)} alt="${esc(e.kep.alt || szovegTiszta(cim.html))}" loading="lazy" decoding="async" data-nagyit>
  </article>`;
  }).join('')}
  </section>`;

  // --- B: fuggoleges bemutato video (mp4) ---
  const bevideo = (b) => (b.video ? `<section class="tarto"><article class="kat-doboz kat-bevideo">
    <div class="kat-doboz-szoveg">
      <p class="felirat">${IK('play')}Videó</p>
      <h2>${szovegLink(b.cim.html)}</h2>
      <a class="gomb gomb-kicsi" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
    </div>
    <div class="kat-bevideo-kep"><video src="${esc(b.video.src)}"${b.kep ? ` poster="${esc(b.kep.src)}"` : ''} controls preload="none" playsinline></video></div>
  </article></section>` : '');

  // --- B: "Miert a Medical Piercinget valaszd?": ikonos racs (az ikonok a fooldal paletajaban: tools/uj-b-ikonok.py -> assets/img/uj-biz-<hash8>.webp) ---
  const ikonUj = (src) => {
    const m = /\/[^/_]+_([0-9a-f]{8})[0-9a-f]*\.webp$/i.exec(src);
    const cel = m ? `/assets/img/uj-biz-${m[1]}.webp` : null;
    return cel && fs.existsSync(path.join(ROOT, cel)) ? cel : src;
  };
  const bizalom = (b) => `<section class="tarto"><div class="kat-doboz kat-bizalom">
    <h2>${szovegLink(b.cim.html)}</h2>
    <ul class="kat-biz-racs">${b.racs.k.map((v) => {
    const l = laposit(v), ps = l.filter((x) => x.t === 'p'), k = l.find((x) => x.t === 'kep');
    return `
      <li>${k ? `<img src="${esc(ikonUj(k.src))}"${keparany(k)} alt="" loading="lazy" decoding="async">` : ''}<div><b>${szovegLink(ps[0] ? ps[0].html : '')}</b>${ps[1] ? `<span>${szovegLink(ps[1].html)}</span>` : ''}</div></li>`;
  }).join('')}
    </ul>
  </div></section>`;

  // --- B: az orvosi ajanlas (maga a kep tartalmazza a szoveget) ---
  const ajanlas = (b) => `<section class="tarto"><figure class="kat-ajanlas">
    <img src="${esc(b.kep.src)}"${keparany(b.kep)} alt="Orvosi ajánlás – Dr. Schmolcz Gergely: A Medical Piercing ékszer behelyezési folyamata teljes mértékben megfelel a higiéniai és biztonsági előírásoknak. Orvosként büszkén támogatom a csapatot szakmai mentorként." loading="lazy" decoding="async" data-nagyit>
  </figure></section>`;

  // --- B: "Budapesten a Jaszainal varunk": cim / elerhetoseg / nyitvatartas + terkep, kozossegi ikonok, gomb; alatta a szalon-galeria ---
  const elerhetoseg = (b) => {
    const lv = b.nodes.flatMap((n) => laposit(n));
    const ps = lv.filter((x) => x.t === 'p');
    const cimP = ps.find((x) => /^\d{4}\s/.test(szovegTiszta(x.html)));
    const TEL = /(?:\+36|\b06)[\d\s]{8,}\d/;   // +36 1 901 7444 vagy 06 70 789 7477 (oldalankent mas a szam)
    const telP = ps.find((x) => TEL.test(szovegTiszta(x.html)));
    const mailP = ps.find((x) => /@/.test(szovegTiszta(x.html)));
    const terkep = lv.find((x) => x.t === 'iframe' && x.fajta === 'terkep');
    const gomb = lv.find((x) => x.t === 'gomb');
    const kozosseg = lv.filter((x) => x.t === 'kep' && x.link);
    // nyitvatartas: a cimkek ("H-P", "SZO<br>VAS") es az idok ("09:00 - 19:00", ...) egy-egy oszlop, sor-soronkent egymas mellett
    const sorKi = (html) => html.split(/<br\s*\/?>/i).map((x) => szovegTiszta(x)).filter(Boolean);
    const oszlopok = lv.filter((x) => x.t === 'p' && /^(H\s*[-–]\s*P|SZO|VAS|\d{2}:\d{2}|ZÁRVA)/i.test(szovegTiszta(x.html)));
    const cimkek = oszlopok.filter((x) => /^(H\s*[-–]\s*P|SZO|VAS)/i.test(szovegTiszta(x.html))).flatMap((x) => sorKi(x.html));
    const idok = oszlopok.filter((x) => !/^(H\s*[-–]\s*P|SZO|VAS)/i.test(szovegTiszta(x.html))).flatMap((x) => sorKi(x.html));
    if (!cimP || !terkep || !cimkek.length || cimkek.length !== idok.length) {   // nem a megszokott felepites: valtozatlan tartalom
      return `<section class="tarto" id="elerhetoseg"><div class="sz kat-doboz kat-egyeb"><h2 class="cim">${szovegLink(b.cim.html)}</h2>${b.nodes.map((n) => T.csomopont(n, c)).join('\n')}</div></section>`;
    }
    const tel = telP ? szovegLink(telP.html).replace(TEL, (m) => `<a href="tel:${m.replace(/\s/g, '')}">${m.trim()}</a>`) : '';
    const ikonNev = (u) => (/facebook/i.test(u) ? 'fb' : /instagram/i.test(u) ? 'ig' : /tiktok/i.test(u) ? 'tt' : /youtube/i.test(u) ? 'yt' : 'link');
    const mail = mailP ? szovegTiszta(mailP.html) : '';
    const galeria = fooldaliGaleria ? `<section class="tarto"><div class="sz kat-doboz kat-egyeb">${T.csomopont(fooldaliGaleria, c)}</div></section>` : '';
    return `<section class="tarto" id="elerhetoseg"><div class="kat-doboz kat-elerh">
    <h2>${szovegLink(b.cim.html)}</h2>
    <div class="kat-elerh-racs">
      <div class="kat-elerh-adat">
        <div class="kat-elerh-sor">${IK('pin')}<div><h3>Címe</h3><p>${szovegLink(cimP.html)}</p></div></div>
        <div class="kat-elerh-sor">${IK('phone')}<div><h3>Elérhetőségei</h3>${tel ? `<p>${tel}</p>` : ''}${mail ? `<p><a href="mailto:${esc(mail)}">${esc(mail)}</a></p>` : ''}</div></div>
        <div class="kat-elerh-sor">${IK('clock')}<div><h3>Nyitvatartása</h3><dl class="kat-nyitva">${cimkek.map((x, i) => `<div><dt>${esc(x.replace(/\s*[-–]\s*/, '–'))}</dt><dd>${esc(idok[i].replace(/\s*[-–]\s*/, '–'))}</dd></div>`).join('')}</dl></div></div>
        <div class="kat-elerh-akcio">
          ${gomb ? `<a class="gomb gomb-tomor" href="${esc(belso(gomb.href))}">${esc(gomb.szoveg.replace(/!$/, ''))}${IK('chev', 'ik-nyil')}</a>` : ''}
          <ul class="kat-kozosseg">${kozosseg.map((k) => `<li><a href="${esc(k.link)}" target="_blank" rel="noopener" aria-label="${esc((k.alt || '').trim() || ikonNev(k.link))}">${IK(ikonNev(k.link))}</a></li>`).join('')}</ul>
        </div>
      </div>
      <div class="kat-elerh-terkep">${T.iframe(terkep)}</div>
    </div>
  </div></section>
  ${galeria}`;
  };

  // --- "Igy mukodik": video + szoveg doboz ---
  const video = (b) => {
    const szovegek = [];
    const sorok = b.szovegek.filter((n) => (n.t === 'p' && szovegTiszta(n.html)) || n.t === 'ul');
    const gondolatjel = (x) => x.t === 'p' && /^\s*-\s/.test(szovegTiszta(x.html));
    for (let i = 0; i < sorok.length; i++) {
      const n = sorok[i];
      if (n.t === 'ul') { szovegek.push(lista(n)); continue; }
      if (gondolatjel(n)) {   // a "- Hohullamok," sorokbol lista lesz
        const elemek = [];
        let j = i;
        while (j < sorok.length && gondolatjel(sorok[j])) elemek.push(esc(szovegTiszta(sorok[j++].html).replace(/^\s*-\s*/, '')));
        szovegek.push(lista({ elemek }));
        i = j - 1;
        continue;
      }
      szovegek.push(bekezd(n));
    }
    const egyedul = !szovegek.length;
    const bal = b.video ? T.iframe(b.video) : `<img class="kat-video-img" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt || '')}" loading="lazy" decoding="async" data-nagyit>`;
    return `<section class="tarto"><article class="kat-doboz kat-video${egyedul ? ' kat-video-egy' : ''}${b.video ? '' : ' kat-video-kepes'}">
    <div class="kat-video-kep">${bal}</div>
    <div class="kat-doboz-szoveg">
      <p class="felirat">${IK(b.video ? 'play' : 'sparkles')}${b.video ? 'Videó' : 'Röviden'}</p>
      <h2>${szovegLink(b.cim.html)}</h2>
      ${szovegek.join('\n      ')}
      <a class="gomb gomb-kicsi" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
    </div>
  </article></section>`;
  };

  // --- Google-velemenyek: cim + a fooldal Trustindex-doboza + tovabb link ---
  const velemeny = (b) => {
    // az eredeti oldal beagyazasa (assets/embed/*.html) az oldal sajat Trustindex-widgetjet toltotte (pl. a migren-oldalon elol a migrenes velemenyek): ugyanazt a kulcsot hasznaljuk
    let kulcs = null;
    try { kulcs = /loader\.js\?([a-z0-9]+)/.exec(fs.readFileSync(path.join(ROOT, b.ifr.src.replace(/^\//, '')), 'utf8'))?.[1] || null; } catch { /* a fooldali widget marad */ }
    const widget = kulcs ? reszlet('velemenyek').replace(/loader\.js\?[a-z0-9]+/, 'loader.js?' + kulcs) : reszlet('velemenyek');
    const l = b.link && T.csakLink(b.link.html) ? szovegLink(b.link.html).trim().replace(/^<a /, '<a class="szoveg-link" ') : '';
    // a B oldalakon a cim szama ("... 4.183 vendegunk leirta") is a Trustindex-widget mostani szamabol frissul (uj-fooldal.js 4c.)
    const cimHtml = B ? szovegLink(b.cim.html).replace(/(\d[\d.\s]*\d)(?=\s+vendég)/, `<span data-ti-darab>${GOOGLE_DB}</span>`) : szovegLink(b.cim.html);
    return `<section class="kat-blokk">
    <div class="tarto kat-fej"><h2>${cimHtml}</h2>${b.alcim ? `<p class="kat-alcim">${szovegLink(b.alcim.html)}</p>` : ''}</div>
${widget}
    ${l ? `<div class="tarto kat-tovabb">${l}</div>` : ''}
  </section>`;
  };

  const miert = (b) => `<section class="tarto"><article class="kat-doboz kat-miert">
    <img class="kat-miert-kep" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt || '')}" loading="lazy" decoding="async">
    <div class="kat-doboz-szoveg">
      <h2>${szovegLink(b.cim.html)}</h2>
      ${b.lista ? lista(b.lista) : ''}
    </div>
  </article></section>`;

  // --- Facebook-kommentek: kartyas, lapozhato, kattintasra nagyit ---
  const fb = (b) => {
    const kepek = b.kepek.t === 'galeria' ? b.kepek.kepek : [b.kepek];
    const id = ++c.galeriaSzam;
    const dia = (k) => `<figure class="kar-dia"><img src="${esc(k.src)}" alt="${esc(k.alt || 'Vendég Facebook-kommentje')}" loading="lazy" decoding="async" data-nagyit data-grp="g${id}"></figure>`;
    const db = kepek.length;
    const sav = `<div class="kar kat-fb-kar" data-kar="${id}"><div class="kar-sav" tabindex="0" aria-label="Facebook-kommentek">${kepek.map(dia).join('')}</div>`
      + (db > 1 ? `<button type="button" class="kar-gomb kar-elozo" aria-label="Előző képek" disabled>${IK('chev')}</button><button type="button" class="kar-gomb kar-kov" aria-label="Következő képek">${IK('chev')}</button><p class="kar-szam"><span data-kar-akt>1</span> / ${db}</p>` : '') + '</div>';
    return `<section class="tarto"><div class="kat-doboz kat-fb">
    <p class="felirat">${IK('fb')}Facebook</p>
    <h2>${szovegLink(b.cim.html)}</h2>
    ${b.bev ? `<p class="kat-fb-bev">${szovegLink(b.bev.html)}</p>` : ''}
    ${sav}
    ${b.tipp ? `<p class="kat-tipp">${szovegLink(b.tipp.html)}</p>` : ''}
  </div></section>`;
  };

  const figyelem = (b) => `<section class="tarto"><article class="kat-doboz kat-figyelem">
    <img class="kat-figyelem-kep" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="" loading="lazy" decoding="async">
    <div class="kat-doboz-szoveg">
      <h2>${szovegLink(b.cim.html)}</h2>
      ${b.lista ? lista(b.lista, 'kat-hiba') : ''}
      ${b.szovegek.map(bekezd).join('\n      ')}
    </div>
  </article></section>`;

  const stat = (b) => {
    const [szam, szoveg, ...lab] = b.szovegek;
    return `<section class="tarto"><article class="kat-doboz kat-stat">
    <img class="kat-stat-kep" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt || '')}" loading="lazy" decoding="async">
    <div class="kat-doboz-szoveg">
      <p class="kat-szam">${szovegLink(szam.html)}</p>
      ${szoveg ? `<p class="kat-szam-szoveg">${szovegLink(szoveg.html)}</p>` : ''}
      ${lab.map((x) => `<p class="kat-lab">${szovegLink(x.html)}</p>`).join('')}
    </div>
  </article></section>`;
  };

  // a vendegek panaszai: a fooldal "panel" stilusa (szoveg + elhalvanyodo kep)
  const panasz = (b) => `<section class="tarto"><article class="panel kat-panasz">
    <div class="panel-szoveg">
      <p class="felirat">${IK('userc')}Vendégeink tapasztalata</p>
      <h2>${szovegLink(b.cim.html)}</h2>
      ${b.szovegek.map((x) => (x.t === 'ul' ? lista(x) : x.t === 'p' ? bekezd(x) : '')).join('\n      ')}
      <a class="gomb gomb-kicsi" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
    </div>
    <img src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt || '')}" loading="lazy" decoding="async">
  </article></section>`;

  // a hosszu szoveges resz harmonikaban: csak a fo-cimek latszanak, a tartalom csukva (nativ <details>, nincs hozza szkript)
  const tudastar = (b) => {
    const elemek = [];
    const bevezeto = [];
    let akt = null;
    const fo = foCimIndexek(b.torzs, T);
    for (const [i, n] of b.torzs.entries()) {
      if (fo.has(i)) { akt = { cim: n.html, nodes: [] }; elemek.push(akt); } else if (akt) akt.nodes.push(n); else bevezeto.push(n);
    }
    if (bevezeto.length) elemek.unshift({ cim: 'Bevezető', nodes: bevezeto });
    // az eredeti oldalon a "pont helye" abra a szoveg vegere csuszott: oda tesszuk, ahova tartozik (a "helye / hova szurjak" resz, ennek hianyaban a "mukodese")
    const lent = [];
    for (const kep of b.tobbi.filter((x) => x.t === 'kep')) {
      const hova = (re) => elemek.findIndex((e) => !e.kep && re.test(szovegTiszta(e.cim)));
      const i = [hova(/helye|hova |hol /i), hova(/műk[öo]d[ée]s/i)].find((x) => x >= 0);
      if (i === undefined) lent.push(kep); else elemek[i].kep = kep;
    }
    const kepHtml = (kep) => `<figure class="kat-elem-kep"><img src="${esc(kep.src)}"${keparany(kep)} alt="${esc(kep.alt || '')}" loading="lazy" decoding="async" data-nagyit></figure>`;
    const torzs = (e) => {
      const r = [];
      let kepBent = !e.kep;
      for (const n of e.nodes) {
        r.push(T.csomopont(n, c));
        if (!kepBent && n.t === 'p') { r.push(kepHtml(e.kep)); kepBent = true; }   // a "lasd a kepen" bekezdes utan
      }
      if (!kepBent) r.push(kepHtml(e.kep));
      return r.join('\n');
    };
    const gomb = b.tobbi.find((x) => x.t === 'gomb');
    return `<section class="tarto kat-tudastar">
    <h2 class="kat-tudastar-cim">${szovegLink(b.cim.html)}</h2>
    <div class="kat-harmonika">
      ${elemek.map((e) => `<details class="kat-elem"><summary><span class="kat-elem-cim">${String(e.cim).replace(/<[^>]+>/g, '')}</span><span class="kat-elem-nyil" aria-hidden="true">${IK('chev')}</span></summary><div class="sz kat-elem-torzs">${torzs(e)}</div></details>`).join('\n      ')}
    </div>
    ${lent.map((k) => kepHtml(k)).join('')}
    <div class="kat-tudastar-gomb"><a class="gomb gomb-tomor" href="${esc(gomb ? belso(gomb.href) : '/idopontfoglalas')}">${esc((gomb ? gomb.szoveg : 'Időpontot foglalok').replace(/!$/, ''))}${IK('chev', 'ik-nyil')}</a></div>
  </section>`;
  };

  // minden mas: az altalanos tukor-sablon, a fooldal stilusu keretben (a hosszu szoveg keret nelkul)
  const egyeb = (b) => {
    const lathato = [];
    const lattak = new Set();
    // a szalon-fotogaleria (csak egy nagy galeria, nincs mellette cim): az eredeti FOOLDAL mostani kepei jelennek meg (a regi kepeken mar nem dolgozo kolleganok is vannak)
    if (b.nodes.length === 1 && b.nodes[0].t === 'galeria' && b.nodes[0].kepek.length >= 10 && fooldaliGaleria) return `<section class="tarto"><div class="sz kat-doboz kat-egyeb">${T.csomopont(fooldaliGaleria, c)}</div></section>`;
    for (const n of b.nodes) {   // az ismetlodo, azonos gombokbol (a Wix-oldalon egymas alatt halmozva) egy marad
      if (n.t === 'gomb') { const kulcs = n.szoveg + '|' + n.href; if (lattak.has(kulcs)) continue; lattak.add(kulcs); }
      lathato.push(n);
    }
    const tartalom = lathato.map((n) => T.csomopont(n, c)).join('\n');
    if (!tartalom.replace(/<[^>]+>/g, '').trim() && !/<(img|iframe|video|a )/.test(tartalom)) return '';
    const hossz = tartalom.replace(/<[^>]+>/g, '').length;   // a lathato szoveg hossza
    return hossz > 2500
      ? `<section class="sz kat-cikk"><div class="tarto">${tartalom}</div></section>`
      : `<section class="tarto"><div class="sz kat-doboz kat-egyeb">${tartalom}</div></section>`;
  };

  const resz = [B ? hosB() : hos()];
  // a vendegek panaszai ("az alabbi panaszokon ertek el javulast") rogton a Google-velemenyek alatt
  const sorrend = [...p.blokkok];
  const pi = sorrend.findIndex((b) => b.tip === 'panasz'), vi = sorrend.findIndex((b) => b.tip === 'velemeny');
  if (!B && pi >= 0 && vi >= 0) sorrend.splice(vi + 1, 0, ...sorrend.splice(pi, 1));
  for (const b of sorrend) {
    switch (b.tip) {
      case 'video': resz.push(video(b)); break;
      case 'velemeny': resz.push(velemeny(b)); break;
      case 'miert': resz.push(miert(b)); break;
      case 'fb': resz.push(fb(b)); break;
      case 'figyelem': resz.push(figyelem(b)); break;
      case 'stat': resz.push(stat(b)); break;
      case 'panasz': resz.push(panasz(b)); break;
      case 'ekszer': resz.push(reszlet('ekszerek')); break;
      case 'ar': resz.push(reszlet('akcio'), reszlet('arak')); break;
      case 'tudastar': resz.push(tudastar(b)); break;
      case 'biztos': resz.push(biztos(b)); break;
      case 'parok': resz.push(parok(b)); break;
      case 'bevideo': resz.push(bevideo(b)); break;
      case 'bizalom': resz.push(bizalom(b)); break;
      case 'ajanlas': resz.push(ajanlas(b)); break;
      case 'elerhetoseg': resz.push(elerhetoseg(b)); break;
      case 'media': resz.push(`<section class="tarto kat-egy">\n${reszlet('media')}\n  </section>`); break;
      case 'csapat': resz.push(`<section class="tarto kat-egy">\n${reszlet('csapat')}\n  </section>`); break;
      case 'helyszin': resz.push(reszlet('helyszinek')); break;
      case 'kihagy': break;
      case 'gyiklink': resz.push(gyikLink(b)); break;
      case 'videok': resz.push(videok(b)); break;
      case 'tapasztalat': resz.push(tapasztalat(b)); break;
      case 'akciofelt': resz.push(reszlet('akcio'), reszlet('arak'), akcioFelt(b), reszlet('ekszerek')); break;
      default: resz.push(egyeb(b));
    }
  }
  const html = resz.filter(Boolean).join('\n\n');
  return { html, nagyito: van.has('ekszer') || van.has('akciofelt'), helyiIdk: new Set([...html.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1])) };
}
