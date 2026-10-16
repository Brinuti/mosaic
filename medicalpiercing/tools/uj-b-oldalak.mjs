// A fo oldalak B-valtozatai (a tulajdonos kerese, 2026-10-16: "az osszes oldalbol epits egy B verziot ... ugy, ahogy a PDF-ben van, de utana menj rajta vegig ...
// es formazd meg, mint az akcio oldalt"): a "Medical Piercing – Konverzio-ujratervezes, kepernyotervek (mobil)" PDF oldalai, a szerkezet a tervbol, a kinezet a mostani
// oldal dobozaibol (hos, kat-fej, kat-doboz kat-par, akc-dobozok, gar-racs, helyszin-doboz, videosav, ragados also sav). Rejtett: /b/<ut> (noindex, link nem mutat ra).
//   node tools/uj-b-oldalak.mjs   ->   uj-oldalak/sajat-b/<nev>.html   (a build: tools/uj-fooldal.mjs; a stilus: assets/css/uj-b.css)
// A PDF szabalyai: egy domináns (barna) foglalas-gomb, alatta mikroszoveg + a garancia; ovatos nyelv (nincs "megszunik", "gyogyit", "mukodo", "tobb piercing = erosebb
// hatas"); a tipusoldalakon a disclaimer; a "Kepen meg: …" szovegek es a makett-idopontok nem kerulnek ki; a Feri jovahagyasahoz kotott dijak, idezetek, szakmai adatok
// csak a mar elo oldalon szereplo formajukban. A tenyek egy helyen (T, a PDF C3 "kozponti tenyforrasa").
// Kimaradt (kulon dontes kell): a foglalomotor es a koszonooldal terve (a foglalasi folyamat valtozasa, meres), a "Nem tudom" motor-ag dija, a statikus Google-idezetek.
import fs from 'node:fs';
import path from 'node:path';
import { GOOGLE_DB } from './uj-oldalak/kategoria.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const KI = path.join(ROOT, 'uj-oldalak/sajat-b');
const IK = (n, o = '') => `<svg class="ik${o ? ' ' + o : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const NYIL = IK('chev', 'ik-nyil');

// --- kozponti tenyforras (PDF C3) -------------------------------------------------------------------------------------------------------------------------
const T = {
  dobozok: [
    { db: '1 piercing', ar: '24 900 Ft', al: '27 900 Ft helyett', csomag: '1' },
    { db: '2 piercing', ar: '39 900 Ft', al: 'kb. 19 950 Ft/db', csomag: '2' },
    { db: '3 piercing', ar: '44 900 Ft', al: 'kb. 14 967 Ft/db', csomag: '3', cimke: 'Legkedvezőbb darabár' },
  ],
  artol: '24 900 Ft-tól',
  paros: '79 800 Ft', parosFo: '39 900 Ft',
  ful: [{ db: '1 db fülpiercing', ar: '12 000 Ft', al: 'G23 titán ékszerrel' }, { db: '2 db fülpiercing', ar: '20 000 Ft', al: '24 000 Ft helyett' }, { db: '3 db fülpiercing', ar: '30 000 Ft', al: '36 000 Ft helyett' }],
  pont: '4,8', db: `<span data-ti-darab>${GOOGLE_DB}</span>`, videok: 37,
  helyek: 'Budapest + 14 vidéki helyszín',
  tel: '+36 1 901 7444', telHref: 'tel:+3619017444', telIdo: 'H–P 9:00–17:00',
  garancia: 'ha 6–7 hét után nem tapasztalsz javulást, megerősítő piercinget szúrunk.',   // a tulajdonos szovege (2026-10-16), mint a foglaloban es az akcio-oldalon
  mikro: 'kb. 1 perc, regisztráció nélkül · <b>fizetés a helyszínen</b>',
  csekk: ['G23 titánium ékszer', 'érzéstelenítés', 'gépi bemérés', 'ingyenes kontroll', 'garancia'],
  disclaimer: 'Közérzetjavító ékszer, nem orvosi kezelés. Az eredmény egyénenként eltérhet.',
  kinekNem: 'Bizonyos egészségi állapotokban nem javasolt a szúrás. Ha bizonytalan vagy, foglalás előtt egyeztess velünk.',
};
const GALERIA_KOZOS = ['/assets/img/f18724_6ea547e25b1d4b9b9073ebf522221b83.jpg', '/assets/img/f18724_a72cb347446b4b348cf6a35d08f43dca.webp', '/assets/img/f18724_0a502786784446d6a3c6b60c371ee731.jpg'];
const CSAPAT = '/assets/img/f18724_96a133495fd048b898cf7db68bbb6e67.webp';

// --- elemek ------------------------------------------------------------------------------------------------------------------------------------------------
const cta = (szoveg, { href = '/idopontfoglalas', attr = '', ikon = 'calendar' } = {}) =>
  `<a class="gomb gomb-tomor b-cta" href="${href}"${attr}>${ikon ? IK(ikon) : ''}${szoveg}${NYIL}</a>`;
const cta2 = (szoveg, href) => `<a class="gomb gomb-ures" href="${href}">${szoveg}${NYIL}</a>`;
const garanciaDoboz = () => `<p class="akc-garancia b-garancia">${IK('shield')}<span><b>Garancia:</b> ${T.garancia}</span></p>`;
const mikro = (szoveg = T.mikro) => `<p class="akc-mikro b-mikro">${szoveg}</p>`;
const figyel = (szoveg = T.disclaimer) => `<p class="b-figyel">${szoveg}</p>`;
const arsor = () => `<p class="b-arsor">${T.dobozok.map((d) => `${d.db} <b>${d.ar}</b>`).join('<span aria-hidden="true"> · </span>')}</p>`;
const dobozok = ({ gomb = true, adat = T.dobozok, osztaly = '' } = {}) => `<ul class="akc-dobozok b-dobozok${osztaly ? ' ' + osztaly : ''}">
${adat.map((d) => `          <li class="akc-doboz${d.cimke ? ' akc-kiemelt' : ''}">${d.cimke ? `<span class="akc-cimke">${d.cimke}</span>` : ''}<span class="akc-db">${d.db}</span><b class="akc-ar">${d.ar}</b><span class="akc-al">${d.al}</span>${gomb ? `<a class="gomb gomb-kicsi akc-gomb" href="/idopontfoglalas" data-csomag="${d.csomag}">Ezt foglalom</a>` : ''}</li>`).join('\n')}
        </ul>`;
const csekkek = () => `<ul class="akc-csekk b-csekk">${T.csekk.map((c) => `<li>${IK('check')}${c}</li>`).join('')}</ul>`;
const kar = (kepek, alt) => `<div class="kar kat-hos-kar" data-kar="1"><div class="kar-sav" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Fotók">${kepek.map((k, i) =>
  `<figure class="kar-dia"><img src="${k}" width="800" height="800" alt="${alt} – ${i + 1}. kép a ${kepek.length}-ből"${i ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async" data-nagyit data-grp="g1"></figure>`).join('')}</div><button type="button" class="kar-gomb kar-elozo" aria-label="Előző kép" disabled>${IK('chev')}</button><button type="button" class="kar-gomb kar-kov" aria-label="Következő kép">${IK('chev')}</button><p class="kar-szam"><span data-kar-akt>1</span> / ${kepek.length}</p></div>`;

// hos: H1 + alcim (+ arsor / ardobozok) + a domináns gomb + mikroszoveg (+ disclaimer) + garancia + ertekeles; jobbra kep, galeria vagy video
function hos({ cim, al, sor = false, ardobozok = null, gomb, gomb2 = '', mikroSzoveg, disc = '', garancia = true, kep, galeria, video, osztaly = '' }) {
  const media = galeria ? `<figure class="hos-kep hos-galeria">\n        ${galeria}\n      </figure>`
    : video ? `<figure class="hos-kep">\n        ${video}\n      </figure>`
      : `<figure class="hos-kep">\n        <img src="${kep[0]}" width="${kep[1]}" height="${kep[2]}" alt="${kep[3]}" fetchpriority="high">\n      </figure>`;
  return `  <section class="hos kat-hos kat-hos-b b-hos${osztaly ? ' ' + osztaly : ''}">
    <div class="tarto hos-racs">
      <h1 class="hos-cim">${cim}</h1>
      <div class="hos-szoveg">
        <p class="hos-bevezeto">${al}</p>
${sor ? '        ' + arsor() + '\n' : ''}${ardobozok ? '        ' + ardobozok + '\n' : ''}        <div class="gombsor">${gomb}${gomb2}</div>
        ${mikro(mikroSzoveg)}
${disc ? '        ' + figyel(disc) + '\n' : ''}${garancia ? '        ' + garanciaDoboz() + '\n' : ''}<!--#ertekeles-->
      </div>
      ${media}
    </div>
  </section>`;
}
const fej = (felirat, ikon, cim, al = '') => `    <div class="kat-fej">
      <p class="felirat felirat-kozep">${IK(ikon)}${felirat}</p>
      <h2>${cim}</h2>${al ? `\n      <p class="kat-alcim">${al}</p>` : ''}
    </div>`;
// ketfele kethasabos doboz: szoveg + kep (a "nem lehet ures a doboz" szabaly: rovid szoveg mellett kicsi kep, b-kicsi-kep)
const par = ({ id = '', felirat, ikon, cim, test, kep, ford = false, kicsi = true, osztaly = '' }) => `  <section class="tarto"${id ? ` id="${id}"` : ''}>
    <article class="kat-doboz ${ford ? 'kat-par-ford' : 'kat-par'}${kicsi ? ' b-kicsi-kep' : ''}${osztaly ? ' ' + osztaly : ''}">
      <div class="kat-doboz-szoveg">
        <p class="felirat">${IK(ikon)}${felirat}</p>
        <h2>${cim}</h2>
${test}
      </div>
      <img class="kat-par-kep" src="${kep[0]}" width="${kep[1]}" height="${kep[2]}" alt="${kep[3]}" loading="lazy" decoding="async">
    </article>
  </section>`;
const lepesek = ({ id = '', felirat, ikon, cim, al = '', elemek, lab = '' }) => `  <section class="tarto"${id ? ` id="${id}"` : ''}>
${fej(felirat, ikon, cim, al)}
    <ol class="b-lepesek b-lepesek-${elemek.length}">
${elemek.map(([c, p], i) => `      <li><span class="b-szam">${i + 1}</span><h3>${c}</h3>${p ? `<p>${p}</p>` : ''}</li>`).join('\n')}
    </ol>${lab ? '\n    ' + lab : ''}
  </section>`;
const gyik = (elemek, cim = 'Gyakori kérdések') => `  <section class="tarto" id="kerdesek">
${fej('Kérdések', 'steth', cim)}
    <ul class="gar-racs">
${elemek.map(([k, v]) => `      <li>\n        <h3>${k}</h3>\n        <p>${v}</p>\n      </li>`).join('\n')}
    </ul>
  </section>`;
const G = {
  faj: ['Fáj a szúrás?', 'A szúrás pár másodperc, érzéstelenítést használunk; az érzés egyénenként eltér.'],
  gyogyul: ['Mennyi idő alatt gyógyul?', 'A közérzetjavító piercinget porcba szúrjuk, ezért lassabban gyógyul, mint egy fülbevaló: a duzzanat akár 3–5 hétig is fennállhat, a teljes gyógyulás akár 6 hónap. Az ingyenes kontrollon segítünk. <a class="szoveg-link" href="/a-migren-es-shenmen-piercing-utoapolasa">Utóápolás »</a>'],
  kinek: ['Kinek nem ajánljuk?', `${T.kinekNem} <a class="szoveg-link" href="/a-szuras-folyamata">Részletek »</a>`],
  ar: ['Mit tartalmaz az ár?', `${T.csekk[0]}, ${T.csekk.slice(1).join(', ')}. A fizetés a helyszínen, előleg nélkül.`],
  mennyi: ['Mennyibe kerül?', `${T.dobozok.map((d) => `${d.db} ${d.ar}`).join(', ')}. A fizetés a helyszínen, előleg nélkül.`],
  garancia: ['Mi a garancia?', `${T.garancia[0].toUpperCase()}${T.garancia.slice(1)} <a class="szoveg-link" href="/migren-es-shenmen-piercing-garancia">A garancia részletei »</a>`],
  fizet: ['Mikor fizetek?', 'A foglalás online, a fizetés a helyszínen, előleg nélkül – készpénzzel vagy bankkártyával.'],
};
// ar-szakasz: a 3 csomag "Ezt foglalom" gombbal + mit tartalmaz az ar (PDF C4)
const arSzakasz = ({ cim = 'Csomagárak – több piercing, alacsonyabb darabár', al = '', id = 'arak' } = {}) => `  <section class="tarto" id="${id}">
    <div class="kat-doboz b-arak">
${fej('Árak', 'percent', cim, al)}
      ${dobozok()}
      <p class="b-arak-cim">Az ár tartalmazza:</p>
      ${csekkek()}
      ${mikro()}
      ${garanciaDoboz()}
    </div>
  </section>`;
// "Hol es mikor?": Budapest + a ket legkozelebbi kitelepulesi nap (a tablazatbol, uj-fooldal.js 4f.), alatta a megszokott helyszin-doboz, vegig lathato
const helyek = () => `  <section class="tarto" id="idopontok">
    <div class="akc-hol">
${fej('Időpontok', 'calendar', 'Hol és mikor?', `${T.helyek}. A kitelepüléseken a megadott napokon fogadunk, a szabad időpontokat a foglalóban látod.`).replace('<p class="kat-alcim">', '<p class="kat-alcim akc-hol-al">')}
      <ul class="akc-helyek" data-akc-helyek>
        <li class="akc-hely"><div><b>Budapest</b><span>állandó szalon · H–P 9–19, Szo 9–18</span></div><a class="gomb gomb-kicsi" href="https://medicalpiercing.salonic.hu/selectEmployee/?placeId=6029">Foglalás</a></li>
      </ul>
    </div>
  </section>
<!--#helyszinek-->`;
const videok = (resz, link = '') => `  <div class="akc-videok b-videok">
<!--#${resz}-->
  </div>${link ? `\n  <p class="tarto b-videok-link">${link}</p>` : ''}`;
// ragados also sav (mobilon; PDF C1)
const sav = (bal, al, gomb = 'Időpontot foglalok', attr = '') => `  <div class="akc-sav" data-akc-sav>
    <div class="akc-sav-ar"><b>${bal}</b><span>${al}</span></div>
    <a class="akc-sav-tel" href="${T.telHref}" aria-label="Telefon: ${T.tel}">${IK('phone')}</a>
    <a class="gomb akc-sav-gomb" href="/idopontfoglalas"${attr}>${gomb}</a>
  </div>`;
const elso = (meta, megj) => `<!--oldal ${JSON.stringify(meta)} -->\n  <!-- B-valtozat (rejtett, /b/...): ${megj} A generator: tools/uj-b-oldalak.mjs (ne kezzel szerkeszd). -->\n`;

// --- a piercing-tipusok (PDF 05) ---------------------------------------------------------------------------------------------------------------------------
const SZAKEMBER = {
  gabi: { kep: ['/assets/img/f18724_54b61499c5b84a13a36273a398325981.webp', 1000, 963, 'Kovács Gabriella munka közben'], nev: 'Kovács Gabriella', szerep: 'a Medical Piercing alapítója · egészségügyi szakember, fül-addiktológus képzéssel',
    szoveg: '20 évet dolgozott az egészségügyben, okleveles ápolóként, majd osztályvezető ápolóként. Fül-addiktológus képzést végzett, és akupunktúrás piercer képesítést szerzett.', link: ['/piercer-kovacs-gabriella', 'Gabi bemutatkozása »'] },
  ricsi: { kep: ['/assets/img/f18724_934eb02c7f7440a9b97932a3d6a66909.webp', 1000, 1000, 'Kovács Richárd munka közben'], nev: 'Kovács Richárd', szerep: 'fülakupunktúrás addiktológus, gyógymasszőr',
    szoveg: 'A felmérésen mindig átbeszéljük, mire számíthatsz – és mire nem. Gyógymasszőri végzettsége révén alaposan ismeri a test anatómiáját.', link: ['/piercer-kovacs-richard', 'Ricsi bemutatkozása »'] },
  brigi: { kep: ['/assets/img/f18724_ceb9d9dee26d47738ddde803fd53e4a4.webp', 1000, 1000, 'Mester Brigitta, a soproni szalon szakértője'], nev: 'Mester Brigitta', szerep: 'AcuPiercer, fülakupunktúrás addiktológus · korábban főápoló',
    szoveg: 'Fontos, hogy a vendég pontosan értse, mi történik a szúrás során, és mire számíthat. Ápoló szakon végzett, Sopronban főápolóként dolgozott.', link: ['/piercer-mester-brigitta', 'Brigi bemutatkozása »'] },
  viki: { kep: ['/assets/img/f18724_82ec0f0190fc482fa2aa112d0fe1e884.webp', 1258, 1258, 'Kamilli Viktória munka közben'], nev: 'Kamilli Viktória', szerep: 'a Medical Piercing szakértője · fogászati asszisztens háttérrel',
    szoveg: 'A felmérésen átbeszéljük a behelyezés lehetőségeit, az utóápolást és a kérdéseidet. Fogászati asszisztensként kórházak különböző osztályain szerzett egészségügyi tapasztalatot.', link: ['/piercer-kamilli-viktoria', 'Viki bemutatkozása »'] },
  fanni: { kep: ['/assets/img/f18724_f9c0a8fd686f422482c6a443ea951b6d.webp', 1000, 1000, 'Nagy-Markó Fanni a budapesti szalonban'], nev: 'Nagy-Markó Fanni', szerep: 'a Medical Piercing szakértője · Budapest, Jászai Mari tér',
    szoveg: 'Ha nem tudod, melyik pont illik hozzád, a felmérésen megnézzük együtt. Több hónapos képzés után közel két éve erősíti a csapatot.', link: ['/piercer-fanni', 'Fanni bemutatkozása »'] },
};
const szakember = (k) => { const s = SZAKEMBER[k]; return par({ id: 'szakember', felirat: 'Szakemberünk', ikon: 'userc', cim: s.nev, ford: true, osztaly: 'b-szakember',
  test: `        <p class="b-szerep">${s.szerep}</p>\n        <p>${s.szoveg}</p>\n        <a class="szoveg-link" href="${s.link[0]}">${s.link[1]}</a>`, kep: s.kep }); };
const hova = (kulcs, nev) => par({ id: 'hova', felirat: 'A pont helye', ikon: 'ear', cim: 'Hova szúrjuk?', osztaly: 'b-hova',
  test: `        <ul class="b-lista">\n          <li>A ${nev} pontját gépi bemérés jelöli ki</li>\n          <li>Érzéstelenítés után szúrjuk</li>\n          <li>G23 titánium ékszert helyezünk be</li>\n          <li>A teljes alkalom kb. 30 perc</li>\n        </ul>\n        <a class="szoveg-link" href="/a-szuras-folyamata">A szúrás folyamata lépésről lépésre »</a>`,
  kep: [`/assets/img/uj-galeria-${kulcs}-pont.webp`, 600, 600, `A ${nev} helye a fülön`] });   // (a hos fulfotojanak kozeli kivagasa, hogy ne ismetlodjon)

const TIPUSOK = [
  { ut: 'migren-piercing', kulcs: 'migren', kod: 'mi', nev: 'Migrén piercing', kis: 'migrén piercing', cimEm: 'egészségügyi szakemberektől, garanciával',
    al: `Ismerd meg vendégeink beszámolóit és a behelyezés menetét. ${T.artol}, ingyenes kontrollal.`, szak: 'gabi', video: 'video-velemeny-migren' },
  { ut: 'shenmen-piercing', kulcs: 'shenmen', kod: 'sh', nev: 'Shenmen piercing', kis: 'shenmen piercing', cimEm: 'egészségügyi szakemberektől',
    al: `Ismerd meg vendégeink beszámolóit és a behelyezés menetét. ${T.artol} · fizetés a helyszínen · ingyenes kontroll.`, szak: 'ricsi', video: 'video-velemeny-shenmen' },
  { ut: 'klimax-piercing', kulcs: 'klimax', kod: 'kl', nev: 'Klimax piercing', kis: 'klimax piercing', cimEm: 'egészségügyi szakemberektől',
    al: `Ismerd meg vendégeink beszámolóit és a behelyezés menetét. ${T.artol}, ingyenes kontrollal.`, disc: 'Közérzetjavító ékszer, nem hormonkezelés és nem orvosi terápia. Az eredmény egyénenként eltérhet.', szak: 'brigi', video: 'video-velemeny-klimax' },
  { ut: 'slim-etvagycsokkento-piercing', kulcs: 'slim', kod: 'sl', nev: 'Slim piercing', kis: 'slim piercing', cimEm: 'egészségügyi szakemberektől',
    al: `Ismerd meg a Slim néven kínált közérzetjavító fülpiercinget, a behelyezés menetét és vendégeink beszámolóit. ${T.artol}.`, disc: 'Nem fogyasztószer és nem orvosi kezelés. Az eredmény egyénenként eltérhet.', szak: 'viki', video: 'video-velemeny-slim-b' },
];
const KISEBB = [['allergia-piercing', 'allergia', 'al', 'Allergia piercing'], ['maj-piercing', 'maj', 'mj', 'Máj piercing'], ['pajzsmirigy-piercing', 'pajzsmirigy', 'pm', 'Pajzsmirigy piercing'],
  ['lep-piercing', 'lep', 'lp', 'Lép piercing'], ['vastagbel-piercing', 'vastagbel', 'vb', 'Vastagbél piercing']].map(([ut, kulcs, kod, nev]) => ({ ut, kulcs, kod, nev, kis: nev.toLowerCase(), kisebb: true, cimEm: 'egészségügyi szakemberektől',
  al: `Ismerd meg vendégeink beszámolóit és a behelyezés menetét. ${T.artol}, ingyenes kontrollal.`, szak: 'fanni', video: kulcs === 'allergia' ? 'video-velemeny-allergia-b' : 'video-velemeny-mind' }));

function tipusOldal(t) {
  const rovid = t.nev.replace(' piercing', '');
  const fo = [
    hos({ cim: `${t.nev} <em>${t.cimEm}</em>`, al: t.al, gomb: cta(`${t.nev}et foglalok`, { attr: ' data-csomag="1"' }),
      disc: t.disc || T.disclaimer, galeria: kar([`/assets/img/uj-galeria-${t.kulcs}-2.webp`, ...GALERIA_KOZOS], t.nev) }),
    szakember(t.szak),
    videok(t.video),
    hova(t.kulcs, t.kis),
    arSzakasz({ cim: 'Csomagárak', al: 'Több piercing, alacsonyabb darabár: 2 piercing 39 900 Ft, 3 piercing 44 900 Ft. A behelyezés lehetőségeit az állapotfelmérésen egyeztetjük.' }),
    gyik([G.faj, G.kinek, G.mennyi, G.garancia]),
    sav(`${rovid} · ${T.dobozok[0].ar}`, `★ ${T.pont} · ingyenes kontroll`, 'Foglalás', ' data-csomag="1"'),
  ];
  return elso({ cim: `${t.nev} egészségügyi szakemberektől | Medical Piercing`, leiras: `${t.nev}: ${T.artol}, ingyenes kontrollal és garanciával. Ismerd meg vendégeink beszámolóit és a behelyezés menetét.`, akciosav: 'akcio-sav-b' },
    `a PDF ${t.kisebb ? '05 (kisebb tipusoldalak)' : '05 (tipusoldal-sablon)'} terve.`) + fo.join('\n\n') + '\n';
}

// --- a tobbi oldal -------------------------------------------------------------------------------------------------------------------------------------------
const OLDALAK = {};

OLDALAK.fooldal = () => elso({ cim: 'Közérzetjavító fülpiercing egészségügyi szakemberektől | Medical Piercing', leiras: `Közérzetjavító fülpiercing egészségügyi szakemberektől: ${T.artol}, ingyenes kontroll, garancia. ${T.helyek}.`, akciosav: 'akcio-sav-b' }, 'a PDF 02 (fooldal) terve.') + [
  hos({ cim: 'Közérzetjavító fülpiercing <em>egészségügyi szakemberektől</em>', al: 'Migrén · Shenmen · Klimax · Slim · egyéb közérzetjavító fülpiercingek.', sor: true,
    gomb: cta('Szabad időpontot keresek'), kep: [CSAPAT, 1200, 1091, 'A Medical Piercing csapata a budapesti szalonban'] }),
  `  <section class="tarto" id="miben">
${fej('Piercingek', 'ear', 'Miben segíthetünk?', 'Válaszd ki, mi miatt érkeznél – a típusoldalon mindent megmutatunk.')}
    <ul class="b-csempek">
      <li><a href="/migren-piercing"><img src="/assets/img/menu-ikon/migren.webp" alt="" width="48" height="48" loading="lazy"><b>Migrén, fejfájás</b><span>Migrén piercing</span></a></li>
      <li><a href="/shenmen-piercing"><img src="/assets/img/menu-ikon/shenmen.webp" alt="" width="48" height="48" loading="lazy"><b>Stressz, alvás</b><span>Shenmen piercing</span></a></li>
      <li><a href="/klimax-piercing"><img src="/assets/img/menu-ikon/klimax.webp" alt="" width="48" height="48" loading="lazy"><b>Klimax</b><span>Klimax piercing</span></a></li>
      <li><a href="/slim-etvagycsokkento-piercing"><img src="/assets/img/menu-ikon/slim.webp" alt="" width="48" height="48" loading="lazy"><b>Étvágykontroll</b><span>Slim piercing</span></a></li>
      <li class="b-csempe-tobb"><img src="/assets/img/menu-ikon/allergia.webp" alt="" width="48" height="48" loading="lazy"><b>Egyéb panaszok</b><span><a href="/allergia-piercing">Allergia</a> · <a href="/maj-piercing">Máj</a> · <a href="/pajzsmirigy-piercing">Pajzsmirigy</a> · <a href="/lep-piercing">Lép</a> · <a href="/vastagbel-piercing">Vastagbél</a></span></li>
      <li><a href="/ful-piercing-beloves-budapest"><img src="/assets/img/menu-ikon/divat.webp" alt="" width="48" height="48" loading="lazy"><b>Divat fülpiercing</b><span>Fülbevaló, fülpiercing</span></a></li>
      <li class="b-csempe-nemtudom"><a href="/idopontfoglalas"><b>Nem tudom, melyik kell</b><span>Foglalj időpontot – a helyszínen segítünk választani.</span></a></li>
    </ul>
  </section>`,
  par({ id: 'hogyan', felirat: 'A szúrás', ikon: 'check', cim: 'Hogy zajlik?', kicsi: true,
    test: `        <ol class="b-lista">\n          <li><b>Állapotfelmérés</b> – átbeszéljük a kérdéseidet</li>\n          <li><b>Gépi bemérés</b> – a pontot műszer jelöli ki</li>\n          <li><b>Szúrás + utóápolás</b> – kb. 30 perc az egész</li>\n        </ol>\n        <p class="b-kepalairas">Az 5 fős szakmai csapat · egészségügyi végzettség</p>\n        <a class="szoveg-link" href="/a-szuras-folyamata">A szúrás folyamata »</a>`,
    kep: ['/assets/img/f18724_934eb02c7f7440a9b97932a3d6a66909.webp', 1000, 1000, 'Szúrás a Medical Piercing szalonjában'] }),   // (a csapatkep 3:2-es vagasan a fali logo felbe vagodott)
  videok('video-velemeny-mind'),
  arSzakasz(),
  helyek(),
  gyik([G.faj, G.gyogyul, G.kinek, G.ar]),
  sav(T.artol, `★ ${T.pont} · ${T.db} vélemény`, 'Foglalás'),
].join('\n\n') + '\n';

OLDALAK['kozerzetjavito-piercing-soft-akcio'] = () => elso({ cim: 'Közérzetjavító piercing - Most akciósan!', leiras: 'Közérzetjavító fülpiercing profi szakemberektől, akciós csomagárakkal.', landolo: true, akciosav: 'akcio-sav-landolo-b' },
  'a PDF 03 (TikTok-akcio) terve, a TikTok-landolo szabalyaival (medicalpiercing/CLAUDE.md: tiltott szo sehol, videoborito sem; a garancia-mondat "javulas" szava miatt helyette az ingyenes kontroll). A PDF videos hose nelkul: minden meglevo videonkban (kep, felirat, hang) tiltott szo van.') + [
  hos({ cim: 'Láttad TikTokon? <em>Itt tudsz időpontot foglalni.</em>', al: 'Közérzetjavító fülpiercing profi szakemberektől – akciós csomagárakkal.', ardobozok: dobozok(),
    gomb: cta('Megnézem a szabad időpontokat'), mikroSzoveg: `${T.mikro} · ingyenes kontroll`, garancia: false, kep: [CSAPAT, 1200, 1091, 'A Medical Piercing csapata a budapesti szalonban'] }).replace('<section class="hos', '<section id="arlista" class="hos'),
  lepesek({ id: 'igy', felirat: 'Foglalás', ikon: 'calendar', cim: 'Így foglalsz', elemek: [['Város', `${T.helyek}`], ['Piercing', 'vagy „nem tudom” – a helyszínen segítünk választani'], ['Időpont', 'kb. 1 perc, regisztráció nélkül']],
    lab: `<p class="b-kozep">${cta('Megnézem a szabad időpontokat')}</p>` }),
  `  <section class="tarto tt-velemeny" id="velemenyek">
${fej('Vélemények', 'star', 'Ők már kipróbálták', 'Sokan számolnak be pozitív élményről – nézd meg a több ezer vendégünk véleményét!')}
    <div class="velemeny-fej tt-velemeny-fej">
      <span class="google" aria-label="Google"><i>G</i><i>o</i><i>o</i><i>g</i><i>l</i><i>e</i></span>
      <span class="pontszam">${T.pont}</span>
      <span class="csillagok" role="img" aria-label="5 csillagból ${T.pont}">${IK('star').repeat(5)}</span>
      <span class="darab">Kiváló · ${T.db} vélemény</span>
    </div>
    <p class="velemeny-osszes"><a class="szoveg-link" href="/migren-shenmen-piercing-velemenyek">Összes vélemény »</a></p>
  </section>`,
  sav('Akciós csomagok', `1 db ${T.dobozok[0].ar} · 3 db ${T.dobozok[2].ar}`, 'Foglalok'),
].join('\n\n') + '\n';

OLDALAK['3-piercing-2-araert'] = () => elso({ cim: `Páros akció: ketten 4 piercing ${T.paros} | Medical Piercing`, leiras: `Gyertek ketten: 4 piercing ${T.paros}, fejenként 2 piercing ${T.parosFo}. Egy foglalás, egy látogatás.`, akciosav: 'akcio-sav-b-paros' }, 'a PDF 03 (paros akcio) terve.') + [
  hos({ cim: `Gyertek ketten: <em>4 piercing ${T.paros}</em>`, al: `Fejenként 2 piercing ${T.parosFo} (kb. 19 950 Ft/db). Páros foglalásnál két vendég számára, egy látogatásra keresünk megfelelő időpontot.`,
    gomb: cta('Páros időpontot foglalok', { attr: ' data-csomag="ketto"', ikon: 'users' }), kep: ['/assets/img/f18724_795214e2dfad4d02a9f54204a6420d8c.webp', 1000, 1000, 'Vendégeink a Medical Piercing szalonjában'] }),
  par({ id: 'kinek', felirat: 'Páros akció', ikon: 'users', cim: 'Kinek jó?', ford: true,
    test: `        <p>Egy foglalás, egy látogatás: mindketten 2–2 piercinget választotok, fejenként ${T.parosFo}-ért.</p>\n        <ul class="akc-tipusok b-chipek"><li><span>Barátok</span></li><li><span>Anya és lánya</span></li><li><span>Párok</span></li><li><span>Kollégák</span></li></ul>\n        <ul class="akc-csekk b-csekk">${['G23 titán ékszer', 'ingyenes kontroll', 'garancia', 'fizetés a helyszínen'].map((c) => `<li>${IK('check')}${c}</li>`).join('')}</ul>`,
    kep: ['/assets/img/f18724_f7c33e18e72747eb8f1d4711758cd69b.webp', 1000, 667, 'Konzultáció a szúrás előtt'] }),
  lepesek({ id: 'hogyan', felirat: 'Páros foglalás', ikon: 'calendar', cim: 'Hogy működik?', elemek: [['Egy foglalás', 'a foglalóban a „2 személynek” lehetőséggel'], ['Két vendég egy látogatáson', 'egy alkalomra keresünk időpontot mindkettőtöknek'], ['Saját felmérés', 'mindkét vendég saját állapotfelmérése és beleegyezése']],
    lab: `<p class="b-kozep">${cta('Páros időpontot foglalok', { attr: ' data-csomag="ketto"', ikon: 'users' })}</p>` }),
  helyek(),
  sav(`Ketten ${T.paros}`, `4 piercing · fejenként ${T.parosFo}`, 'Foglalok', ' data-csomag="ketto"'),
].join('\n\n') + '\n';

OLDALAK['arlista-garancia'] = () => elso({ cim: 'Piercingárak és csomagtartalom | Medical Piercing', leiras: `Piercingárak: 1 piercing ${T.dobozok[0].ar}, 2 piercing ${T.dobozok[1].ar}, 3 piercing ${T.dobozok[2].ar}. Páros: ketten 4 piercing ${T.paros}.`, akciosav: 'akcio-sav-b' }, 'a PDF 06 (arlista) terve; a kiegeszito dijak az elo arlista szerint.') + [
  hos({ cim: 'Piercingárak <em>és csomagtartalom</em>', al: 'Nézd meg a csomagárakat és azt, mit tartalmaznak.', ardobozok: dobozok(), gomb: '', kep: ['/assets/img/uj-ful-akcio.webp', 460, 553, 'Fül több piercinggel'] })
    .replace('        <div class="gombsor"></div>\n', `        <p class="b-arak-cim">Az ár tartalmazza:</p>\n        ${csekkek()}\n`),
  `  <section class="tarto">
    <article class="panel garancia b-paros-doboz">
      <div class="panel-szoveg">
        <p class="felirat">${IK('users')}Páros akció</p>
        <h2>Ketten jöttök?</h2>
        <p>4 piercing ketten ${T.paros} – fejenként 2 piercing, ${T.parosFo}/fő.</p>
        ${cta('Páros időpontot foglalok', { attr: ' data-csomag="ketto"', ikon: 'users' })}
      </div>
      <div class="pecset" aria-hidden="true">${IK('users')}<b>2 × 2</b></div>
    </article>
  </section>`,
  `  <section class="tarto" id="dijak">
    <div class="kat-doboz kat-par b-dijak">
      <div class="kat-doboz-szoveg">
        <p class="felirat">${IK('steth')}További szolgáltatások</p>
        <h2>Kiegészítő díjak</h2>
        <p>Már nálunk szúrattál? A kontroll ingyenes. Ékszercserét és sebkezelést is vállalunk; a garanciális megerősítő piercing munkadíja ingyenes, csak az új ékszer árát számoljuk.</p>
        <a class="gomb gomb-ures" href="/kontroll">Kontrollt foglalok${NYIL}</a>
      </div>
      <ul class="csere-arak">
        <li><span>Kontroll meglévő vendégeknek</span><b>Ingyenes</b></li>
        <li><span>Konzultáció új vendégeknek</span><b>5 000 Ft</b></li>
        <li><span>Garanciális megerősítő piercing (ékszerár, munkadíj nélkül)</span><b>5 000 Ft</b></li>
        <li><span>Ékszercsere nálunk vásárolt ékszerrel</span><b>5 000 Ft</b></li>
        <li><span>Ékszercsere hozott ékszerrel</span><b>2 000 Ft</b></li>
        <li><span>Sebkezelés, tisztítás</span><b>2 000 Ft</b></li>
      </ul>
    </div>
  </section>`,
  gyik([G.ar, G.fizet, G.garancia, G.kinek]),
  sav(`3 piercing ${T.dobozok[2].ar}`, 'fizetés a helyszínen', 'Foglalás', ' data-csomag="3"'),
].join('\n\n') + '\n';

const KATEGORIAK = [['migren', 'Migrén', 'mi', 'video-velemeny-migren', 'Migrén piercinget foglalok'], ['shenmen', 'Shenmen', 'sh', 'video-velemeny-shenmen', 'Shenmen piercinget foglalok'],
  ['klimax', 'Klimax', 'kl', 'video-velemeny-klimax', 'Klimax piercinget foglalok'], ['slim', 'Slim', 'sl', 'video-velemeny-slim-b', 'Slim piercinget foglalok'], ['egyeb', 'Egyéb', '', '', 'Időpontot foglalok']];
OLDALAK['migren-shenmen-piercing-velemenyek'] = () => elso({ cim: 'Vendégvélemények piercingtípus szerint | Medical Piercing', leiras: `★ ${T.pont} · ${GOOGLE_DB} Google-vélemény · ${T.videok} videós beszámoló, piercingtípus szerint.`, akciosav: 'akcio-sav-b' }, 'a PDF 06 (velemenyek) terve.') + [
  `  <section class="hos kat-hos b-hos b-hos-szoveg">
    <div class="tarto">
      <h1 class="hos-cim">Vendégvélemények <em>piercingtípus szerint</em></h1>
      <p class="hos-bevezeto">★ ${T.pont} · ${T.db} Google-vélemény · ${T.videok} videós beszámoló. Az eredmény egyénenként eltérhet.</p>
      <ul class="akc-tipusok b-chipek b-ugras">${KATEGORIAK.map(([k, n]) => `<li><a href="#videok-${k}">${n}</a></li>`).join('')}</ul>
    </div>
  </section>`,
  ...KATEGORIAK.map(([k, n, kod, resz, gomb]) => (resz ? `${videok(resz)}\n  <p class="tarto b-kozep b-kat-cta">${cta(gomb, { attr: ` data-tipus="${kod}" data-csomag="1"` })}</p>`
    // az egyeb tipusokrol egy videonk van (Shenmen + Allergia, a shenmen-savban): nem kap kulon, ures videodobozt (a "nem lehet ures a doboz" szabaly)
    : `  <section class="tarto" id="videok-${k}">
    <div class="kat-doboz b-egyeb">
${fej('Egyéb', 'ear', 'Egyéb közérzetjavító piercingek', 'Allergia, máj, pajzsmirigy, lép és vastagbél piercing – vendégeink beszámolói a fenti videókban és a Google-véleményekben.')}
      <ul class="akc-tipusok b-ugras"><li><a href="/allergia-piercing">Allergia</a></li><li><a href="/maj-piercing">Máj</a></li><li><a href="/pajzsmirigy-piercing">Pajzsmirigy</a></li><li><a href="/lep-piercing">Lép</a></li><li><a href="/vastagbel-piercing">Vastagbél</a></li></ul>
      <p class="b-kozep">${cta(gomb)}</p>
    </div>
  </section>`)),
  `  <section class="tarto" id="google">
${fej('Google', 'star', 'Általános Google-vélemények a szalonról', 'Ezek a vélemények a szalonról szólnak, nem egy-egy piercingtípusról.')}
  </section>
<!--#velemenyek-->`,
  sav(T.artol, `★ ${T.pont} · ${T.db} vélemény`, 'Foglalás'),
].join('\n\n') + '\n';

OLDALAK['migren-es-shenmen-piercing-garancia'] = () => elso({ cim: 'Garancia – mit vállalunk pontosan? | Medical Piercing', leiras: 'Ha 6 hét után sem tapasztalsz javulást, 6 hónapon belül megerősítő piercinget kérhetsz 5 000 Ft ékszeráron, munkadíj nélkül.', akciosav: 'akcio-sav-b' }, 'a PDF 06 (garancia) terve; a feltetelek az elo garancia-oldal szerint.') + [
  hos({ cim: 'Garancia – <em>mit vállalunk pontosan?</em>', al: 'Ha 6 hét után sem tapasztalsz javulást, 6 hónapon belül megerősítő piercinget kérhetsz 5 000 Ft ékszeráron, munkadíj nélkül.',
    gomb: cta('Garanciális időpontot kérek', { ikon: 'shield' }), gomb2: cta2('Még nincs piercingem – az árakat nézem', '/arlista-garancia'), mikroSzoveg: 'Meglévő vendégeknek · kb. 1 perc · regisztráció nélkül', garancia: false,
    kep: ['/assets/img/f18724_8f68571b702840ad91675ad6b3133513.webp', 1936, 1291, 'Kovács Gabriella, a Medical Piercing alapítója a budapesti szalonban'] }),
  lepesek({ id: 'feltetelek', felirat: 'Garancia', ikon: 'shield', cim: 'A feltételek', elemek: [['Legalább 6 hét', 'telt el az első szúrás óta, és nem tapasztalsz javulást'], ['6 hónapon belül', 'jelentkezz a garanciális szúrásra'], ['5 000 Ft ékszerár', 'munkadíj nélkül; a pontot a felmérésen egyeztetjük']] }),
  gyik([['Mikor kérhetem?', 'Ha az első szúrás után 6 héttel sem tapasztalsz javulást, 6 hónapon belül kérhetsz megerősítő piercinget a garancia feltételeivel.'],
    ['Mennyibe kerül?', 'A garanciális megerősítő piercing munkadíja ingyenes, csak az új ékszer árát számoljuk: 5 000 Ft.'],
    ['Hová kerül a megerősítő piercing?', 'A pontot a felmérésen egyeztetjük. Féloldali tüneteknél előfordulhat, hogy a másik fülbe javasoljuk az ékszert.'],
    ['Mikor nem érvényesíthető?', 'Ha a piercingnek van hatása, de nem az igazi, a megerősítő szúrás nem biztos, hogy erősít rajta – a felmérésen átbeszéljük. <a class="szoveg-link" href="/migren-es-shenmen-piercing-garancia">A garancia teljes leírása »</a>']]),
  sav('Garanciális szúrás', '5 000 Ft ékszerár', 'Garanciális időpont'),
].join('\n\n') + '\n';

OLDALAK['ful-piercing-beloves-budapest'] = () => elso({ cim: 'Fülpiercing biztonságosan, egészségügyi szemlélettel | Medical Piercing', leiras: `Fülpiercing és fülbevaló-behelyezés G23 titánium ékszerrel: 1 db ${T.ful[0].ar}, 2 db ${T.ful[1].ar}, 3 db ${T.ful[2].ar}.`, akciosav: 'nincs', lablec: 'lablec-divat' },
  'a PDF 07 (fulpiercing) terve: kulon tolcser, kozerzetjavito akcios sav nelkul, sajat lablec.') + [
  hos({ cim: 'Fülpiercing <em>biztonságosan, egészségügyi szemlélettel</em>', al: 'G23 titánium ékszer, érzéstelenítés, ingyenes kontroll – Budapesten és vidéken.', ardobozok: dobozok({ gomb: false, adat: T.ful }),
    gomb: cta('Fülpiercing időpontot kérek'), garancia: false, kep: ['/assets/img/f18724_4fe4b7dfedac4ad5b2272ed429928d46.webp', 1024, 1536, 'Fülpiercing és fülbevaló a Medical Piercing szalonjában'] }),
  `  <section class="tarto" id="ekszerek" data-ekszer-galeria>
    <div class="premium tt-akcio b-ekszer">
      <div class="premium-szoveg">
        <p class="felirat">${IK('gem')}Ékszerek</p>
        <h2>Ékszerek</h2>
        <p>Kizárólag tanúsítvánnyal rendelkező, antiallergén G23 titánium ékszerekkel dolgozunk, autoklávban fertőtlenítve. Női és férfi fülékszereket is találsz.</p>
        <a class="szoveg-link" href="/uj/ekszereink">Az összes ékszer »</a>
      </div>
      <!--#ekszer-galeria-->
    </div>
  </section>`,
  gyik([['Fáj?', 'A szúrás pár másodperc, érzéstelenítést használunk; az érzés egyénenként eltér.'],
    ['Meddig gyógyul?', 'A fülcimpa puha szövet, ezért gyorsabban gyógyul, mint a porcba szúrt piercing; a pontos teendőket és a kontroll időpontját a szúráskor megbeszéljük.'],
    ['Hogyan ápoljam?', 'Ne mozgasd, ne forgasd az ékszert, és kövesd az utóápolási útmutatót, amelyet a szúrás után e-mailben is elküldünk. <a class="szoveg-link" href="/a-migren-es-shenmen-piercing-utoapolasa">Utóápolás »</a>']]),
  sav(`Fülpiercing ${T.ful[0].ar}-tól`, 'titán ékszerrel', 'Foglalás'),
].join('\n\n') + '\n';

OLDALAK.elerhetosegek = () => elso({ cim: 'Helyszínek és elérhetőségek | Medical Piercing', leiras: `Budapesten állandó szalon, vidéken 14 helyszínen, előre meghirdetett napokon. Telefon: ${T.tel} (${T.telIdo}).`, akciosav: 'akcio-sav-b' }, 'a PDF 07 (uj helyszinoldal) terve.') + [
  hos({ cim: 'Helyszínek <em>és elérhetőségek</em>', al: 'Budapesten állandó szalon, vidéken 14 helyszínen, előre meghirdetett napokon.', gomb: cta('Időpont Budapestre', { href: 'https://medicalpiercing.salonic.hu/selectEmployee/?placeId=6029', ikon: 'pin' }),
    gomb2: cta2('Vidéki helyszínek', '#helyszinek'), mikroSzoveg: 'Budapest, 1137 Újpesti rakpart 7. 5./25. · H–P 9:00–19:00, Szo 9:00–18:00', garancia: false,
    kep: ['/assets/img/f18724_e08a1bb28d4f4548b0b2d0fc06f811c3.webp', 1000, 667, 'A budapesti szalon'] }),
  helyek(),
  `  <section class="tarto">
    <div class="kat-doboz b-telefon">
      <div class="kat-doboz-szoveg">
        <p class="felirat">${IK('phone')}Kérdésed van?</p>
        <h2>Telefonon hétköznap 9:00–17:00</h2>
        <p><a class="gomb gomb-ures" href="${T.telHref}">${IK('phone')}${T.tel}</a></p>
      </div>
    </div>
  </section>`,
  sav('Válassz várost', '15 helyszín közül', 'Foglalás'),
].join('\n\n') + '\n';

OLDALAK.kontroll = () => elso({ cim: 'Kontroll időpont meglévő vendégeknek | Medical Piercing', leiras: 'Új piercing után ingyenes kontrollal segítünk, hogy biztonságosan gyógyuljon.', akciosav: 'akcio-sav-b' }, 'a PDF 07 (/kontroll) terve; a gombok a foglalo kontroll-agat nyitjak.') + [
  hos({ cim: 'Kontroll időpont <em>meglévő vendégeknek</em>', al: 'Új piercing után ingyenes kontrollal segítünk, hogy biztonságosan gyógyuljon.', gomb: cta('Kontrollt foglalok', { ikon: 'check' }),
    mikroSzoveg: 'Ingyenes meglévő vendégeknek · kb. 1 perc · regisztráció nélkül', garancia: false, kep: ['/assets/img/f18724_edff433a1f464bc4b1b4c75371c773be.webp', 1000, 1000, 'Ingyenes kontroll a budapesti szalonban'] }),
  `  <section class="tarto" id="mikor">
${fej('Kontroll', 'calendar', 'Mikor gyere?')}
    <ul class="gar-racs b-mikor">
      <li><h3>Duzzanat vagy érzékenység</h3><p>A porc lassan gyógyul; ha bizonytalan vagy, nézzük meg együtt.</p></li>
      <li><h3>Kérdés a gyógyulásról</h3><p>Ha bizonytalan vagy a gyógyulással kapcsolatban, egyeztess velünk telefonon: <a class="szoveg-link" href="${T.telHref}">${T.tel}</a> (${T.telIdo}).</p></li>
      <li><h3>Ékszer-ellenőrzés</h3><p>Megnézzük, jól ül-e az ékszer, és szükség esetén cseréljük.</p></li>
      <li class="b-orvosi"><h3>Mikor kérj orvosi segítséget?</h3><p>Erősödő fájdalom, terjedő bőrpír, gennyes váladékozás vagy láz esetén kérj orvosi segítséget. A piercingkontroll nem helyettesíti az orvosi vizsgálatot.</p></li>
    </ul>
  </section>`,
  `  <section class="tarto">
    <article class="panel garancia b-uj-vendeg">
      <div class="panel-szoveg">
        <p class="felirat">${IK('percent')}Új vendégeknek</p>
        <h2>Még nincs piercinged?</h2>
        <p>${T.artol}, ingyenes kontrollal.</p>
        <a class="gomb gomb-ures" href="/arlista-garancia">Az árakat nézem${NYIL}</a>
      </div>
      <div class="pecset" aria-hidden="true">${IK('check')}<b>Ingyenes</b></div>
    </article>
  </section>`,
  sav('Ingyenes kontroll', 'meglévő vendégeknek', 'Kontroll foglalás'),
].join('\n\n') + '\n';

OLDALAK['a-szuras-folyamata'] = () => elso({ cim: 'Így történik a szúrás lépésről lépésre | Medical Piercing', leiras: 'Állapotfelmérés, bemérés, érzéstelenítés, steril szúrás, utóápolási tanácsok – kb. 30 perc.', akciosav: 'akcio-sav-b' }, 'a PDF 07 (/a-szuras-folyamata) terve.') + [
  hos({ cim: 'Így történik a szúrás <em>lépésről lépésre</em>', al: 'Állapotfelmérés, bemérés, érzéstelenítés, steril szúrás, utóápolási tanácsok – kb. 30 perc.', gomb: cta('Időpontot foglalok'),
    video: '<a class="video" href="https://www.youtube.com/watch?v=GCO50aHDAyU" target="_blank" rel="noopener" data-embed="https://www.youtube-nocookie.com/embed/GCO50aHDAyU?autoplay=1&amp;rel=0" data-cim="Így néz ki egy behelyezés" aria-label="Videó lejátszása: így néz ki egy behelyezés"><span class="video-kep"><img src="/assets/img/uj-szuras-video.webp" width="1280" height="720" alt="" fetchpriority="high"><span class="lejatszo"><svg class="ik" aria-hidden="true"><use href="#i-play"/></svg></span></span></a>' }),
  lepesek({ id: 'lepesek', felirat: 'A folyamat', ikon: 'check', cim: '4 lépés', elemek: [['Állapotfelmérés', 'kérdések, ellenjavallatok'], ['Gépi bemérés', 'a pontot műszer jelöli ki'], ['Érzéstelenítés, majd szúrás', 'steril, egyszer használatos eszközökkel'], ['Kontroll és utóápolás', 'ingyenes kontroll, írásos útmutató']] }),
  par({ id: 'faj', felirat: 'Fáj?', ikon: 'heart', cim: 'Fáj a szúrás?', ford: true,
    test: `        <p>A szúrás pár másodperc, érzéstelenítést használunk; az érzés egyénenként eltér.</p>\n        <ul class="akc-csekk b-csekk"><li>${IK('check')}Steril, egyszer használatos eszközök</li></ul>\n        ${cta('Időpontot foglalok')}\n        ${mikro()}`,
    kep: ['/assets/img/f18724_e620113496614be4918babe7e01bfb65.webp', 1000, 1000, 'Steril, egyszer használatos eszközök'] }),
  sav(`${T.artol} · ★ ${T.pont}`, 'fizetés a helyszínen', 'Foglalás'),
].join('\n\n') + '\n';

// --- kiiras ----------------------------------------------------------------------------------------------------------------------------------------------------
fs.mkdirSync(KI, { recursive: true });
const kesz = [];
for (const t of [...TIPUSOK, ...KISEBB]) { fs.writeFileSync(path.join(KI, t.ut + '.html'), tipusOldal(t)); kesz.push(t.ut); }
for (const [nev, f] of Object.entries(OLDALAK)) { fs.writeFileSync(path.join(KI, nev + '.html'), f()); kesz.push(nev); }
// a slim videosav semleges boritokkal (a PDF: a slim belyegkepeken nincs fogyasigeret): a -semleges boritot a tools/uj-velemeny-borito.mjs rajzolja (idezet nelkul)
const slim = fs.readFileSync(path.join(ROOT, 'uj-oldalak/reszek/video-velemeny-slim.html'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'uj-oldalak/reszek/video-velemeny-slim-b.html'), slim.replace('(slim): tools/uj-video-velemenyek.mjs', '(slim, B-valtozat: semleges boritok): tools/uj-b-oldalak.mjs')
  .replace(/uj-velemeny-(\d+)-terv\.webp/g, (m, nn) => (fs.existsSync(path.join(ROOT, `assets/img/uj-velemeny-${nn}-semleges.webp`)) ? `uj-velemeny-${nn}-semleges.webp` : m)));
// az allergia egyetlen videoja kethasabos, kompakt dobozban (a "nem lehet ures a doboz" szabaly: egy keskeny videokartya ne alljon egy szeles, ures dobozban)
const allergia = fs.readFileSync(path.join(ROOT, 'uj-oldalak/reszek/video-velemeny-allergia.html'), 'utf8');
const egyVideo = (allergia.match(/<li class="vsav-elem">[\s\S]*?<\/li>/) || [''])[0];
if (!egyVideo) throw new Error('video-velemeny-allergia.html: nincs videokartya');
fs.writeFileSync(path.join(ROOT, 'uj-oldalak/reszek/video-velemeny-allergia-b.html'), `  <!-- a vendeg videos beszamoloja (allergia, B-valtozat: kompakt, kethasabos doboz): tools/uj-b-oldalak.mjs (ne kezzel szerkeszd) -->
  <section class="tarto" id="videok-allergia"><div class="kat-doboz vsav-doboz b-video-egy">
    <div class="b-video-egy-szoveg">
      <p class="felirat">${IK('play')}Videós beszámoló</p>
      <h2>Vendégünk az allergiáról</h2>
      <p>Attila a shenmen és az allergia piercinggel szerzett saját tapasztalatáról mesél. Az eredmény egyénenként eltérhet.</p>
      <p class="velemeny-osszes"><a class="szoveg-link" href="/migren-shenmen-piercing-velemenyek">Tovább az összes véleményhez »</a></p>
      ${cta('Allergia piercinget foglalok', { attr: ' data-csomag="1"' })}
    </div>
    <div class="vsav vsav-keves" data-vsav>
      <ul class="vsav-sav">
      ${egyVideo}
      </ul>
    </div>
  </div></section>
`);
console.log(`${kesz.length} B-oldal: ` + kesz.map((n) => '/b/' + n).join(' '));
