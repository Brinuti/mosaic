// Az Evelin-oldal UJ, hirdetesi valtozata (Google Ads FOD-3 landing, brief 4. szakasz): foglalas/noi-hajfestes-evelin-uj.html (noindex, a meglevo /noi-hajfestes-budapest MELLETT).
// A meglevo 4 fodraszat-oldal (tools/hair-oldalak.mjs) kimenete nem valtozik; ez a modul csak OLVASSA az adat.mjs-t / a Salonic-pillanatkepet, es a sablon.mjs kiexportalt darabjait hasznalja
// (sablonReszek). Arak: kizarolag a Salonic-pillanatkepbol (Evelin sajat szolgaltatasai) - kitalalt szam nincs.
//
// Szandekos eltérések a briefhez (a PR leirasaban reszletezve): (1) az "az ar tartalmazza a festeket, a vagast es a szaritast" mondat NEM minden szolgaltatasra igaz (Salonic: "Tofestes + Szaritas"
// nem tartalmaz vagast), ezert pontos megfogalmazas; (2) a balayage "-tol" ara 42 950 Ft (a 39 950 Ft a teljes melir / szokites rovid hajra), ezert kulon sor; (3) a [MEGERŐSÍTENDŐ] tartalom
// (hajhosszabbitas, tapasztalati evek, szombati nyitvatartas) kimarad.
//
// 2026-10-20, a tulajdonos (Feri) visszajelzese: (1) mobilon a hero sorrendje CIM -> KEP -> alcim; (2) a tofestes szolgaltatas-kartyajan lapozhato kepgaleria (a hair-landing.js [data-hero-galeria] komponense);
// (3) az ertekeles es a terkep SEHOL nem visz ki az oldalrol: belso gorgetes a Google-velemenyek / a helyszin-terkep blokkra ([data-gorget] gombok, assets/js/hair-evelin-uj.js; a gomb, nem #horgony-link:
// a GTM History Change minden hash-valtozasra merest inditana); az egyetlen kifele vivo Google-link a terkep-blokk "Utvonaltervezes" gombja (navigalas); (4) mobilon ahol egy-ket szo csuszna at uj sorba, az legyen egy sor
// (assets/css/hair-evelin-uj.css; ellenorzo: tools/hair-teszt/evelin-uj-torott-sor.mjs).
import {
  FODRASZOK, SZALON, TERKEP_LINK, KEPEK, KONZULT, foglalo, arlista, katAdat, konzultacio, galeria, szolgFodrasz, kep, ft, ido, idoTartomany, HOSSZOK,
} from './adat.mjs';
import { sablonReszek as S } from './sablon.mjs';

const { esc, ik, kepTag, gomb, felcim, szekcioFej, kovetkezo, videoDoboz, galeriaSzekcio, lapozGaleria, cellaHtml, egyCella, KARTYA_SZOVEG, KAT_LINK } = S;
const F = 'evelin';
const f = FODRASZOK[F];
const KAT = { festes: 'Elrontott festés korrekció / Teljes festés', tofestes: 'Tőfestés + szárítás', tofestesVagas: 'Tőfestés + vágás + szárítás', balayage: 'Balayage', melir: 'Teljes melír / airtouch + vágás' };
const kat = (k) => { const a = katAdat(KAT[k], F); if (!a) throw new Error('Evelinnek nincs ilyen szolgaltatasa a Salonic-pillanatkepben: ' + KAT[k]); return a; };

export const ERTEKELES = '4,9 – 1 266 Google-értékelés'; // a brief 5. pontja; a build a google-szam.js-sel az AKTUALIS darabszamra cseréli (ugyanaz, mint minden oldalon)
export const HELY_SOR = '1023 Budapest, Bécsi út 2. · a Kolosy tér és a Zsigmond tér között';
export const NYITVA_HETKOZNAP = 'Hétfő–péntek: 8:00–20:00';

export const META_EVELIN_UJ = () => {
  const f1 = kat('festes'), t1 = kat('tofestes');
  return {
    title: 'Hajfestés, tőfestés Budán | Evelin – MOSAIC Hair',
    leiras: `Hajfestés ${ft(f1.tol)}-tól, tőfestés ${ft(t1.tol)}-tól szárítással. 30 perces ingyenes konzultáció Evelinnél a Kolosy térnél.`,
  };
};

// ---- hero ---------------------------------------------------------------------------------------------------------------------------------------
function hero() {
  const f1 = kat('festes'), t1 = kat('tofestes');
  const p = KEPEK.portre[F]();
  return `<section class="hero hero-fodrasz hero-ads">
  <div class="tartalom hero-racs">
    <div class="hero-szoveg">
      <h1>Hajfestés, tőfestés és őszfedés Evelinnél – Budán</h1>
      <p class="lead">${f.teljesNev} a MOSAIC Hairben vár, a Kolosy tér és a Zsigmond tér között. A festék és a szárítás az árban van.</p>
      <ul class="ar-sav" aria-label="Árak">
        <li><b>Hajfestés / őszfedés</b><span>${ft(f1.tol)}-tól</span></li>
        <li><b>Tőfestés</b><span>${ft(t1.tol)}-tól</span></li>
      </ul>
      <div class="cta-sor">
        ${gomb('30 perces ingyenes konzultáció Evelinnel', foglalo({ staff: F, service: KONZULT }), { cta: 'hero-konzultacio', poz: 'hero', extra: ' data-konzult="1"' })}
        ${gomb('Festés és tőfestés időpontok', foglalo({ staff: F, category: 'color' }), { fajta: 'korvonal', cta: 'hero-festes-idopontok', poz: 'hero', extra: ` data-service="color" data-staff-cta="${F}"`, nyilat: false })}
      </div>
      <p class="hely-sor">${ik('pin')}<span>${HELY_SOR}</span><button type="button" class="link-gomb" data-gorget="hely" data-cta="hero-terkep-lejjebb">Térkép</button></p>
      <p class="ert-sor"><span class="g-csillag" role="img" aria-label="5 csillagból 4,9" style="--ert:98%"></span><button type="button" class="link-gomb" data-gorget="velemenyek" data-cta="hero-velemenyek-lejjebb">${ERTEKELES}</button></p>
      ${kovetkezo(F)}
    </div>
    <figure class="hero-kep">${kepTag(p, { lazy: false, sizes: '(min-width:900px) 45vw, 100vw' })}</figure>
  </div>
</section>`;
}

// ---- szolgaltatasok + arak (A) --------------------------------------------------------------------------------------------------------------------
// A tofestes kartya kepgaleriaja (Feri kerese, 2026-10-20): Evelin SAJAT, valodi munkai a regi /noi-hajfestes-budapest oldal galeriajabol (tools/content/noi-hajfestes-budapest.json 41., 42., 53., 52., 39., 49. blokk).
// A repoban NINCS kifejezetten "tofestes"-ként cimkezett Evelin-foto (a regi oldal tofestes-szekciojaban nincs kep), ezert olyan kesz munkak, ahol a szin a tovektol egyenletes. A kartya szovege nem allitja,
// hogy a kepek tofestes-eredmenyek: valodi vendegmunkak. A kepek teteje latszik (object-position), mert a tofestesnel a tovek szamitanak.
const TOFESTES_KEPEK = () => [
  kep('evelin', 41, { poz: '50% 10%', alt: 'Sötétbarna, fényes haj egyenletes színnel a tövektől – valódi MOSAIC Hair vendégmunka' }),
  kep('evelin', 42, { poz: '50% 10%', alt: 'Hamvas, barnás-szőke haj egyenletes színnel – valódi MOSAIC Hair vendégmunka' }),
  kep('evelin', 53, { poz: '50% 10%', alt: 'Világos szőke, fényes haj egyenletes színnel a tövektől – valódi MOSAIC Hair vendégmunka' }),
  kep('evelin', 52, { poz: '50% 10%', alt: 'Aranyszőke, fényes haj egyenletes színnel – valódi MOSAIC Hair vendégmunka' }),
  kep('evelin', 39, { poz: '50% 10%', alt: 'Mély, sötétbarna hullámos haj – valódi MOSAIC Hair vendégmunka' }),
  kep('evelin', 49, { poz: '50% 10%', alt: 'Hamvas szőke, sima haj – valódi MOSAIC Hair vendégmunka' }),
];
/** Lapozhato kepgaleria a szolgaltatas-kartyaban: scroll-snap (ujjal huzva), asztalon nyilak, pottyok, a sav tabindex=0 es a bal/jobb nyil billentyu lapoz. A mukodest a hair-landing.js
 *  [data-hero-galeria] komponense adja (ugyanaz, mint a kozponti hero-ban es az "Itt talalsz meg" szekcioban); itt MINDEN kep lusta betoltesu (a kartya a hajtas alatt van), a keparany fix (CSS). */
function kartyaGaleria(kepek, { nev, felirat, sizes }) {
  return `<figure class="szolg-galeria hero-galeria" data-hero-galeria="${nev}">
        <ul class="hg-sav" tabindex="0" aria-label="${esc(felirat)}">
${kepek.map((k) => `          <li>${kepTag(k, { sizes })}</li>`).join('\n')}
        </ul>
        <button type="button" class="hg-nyil hg-elozo" aria-label="Előző kép">${ik('bal')}</button>
        <button type="button" class="hg-nyil hg-kovetkezo" aria-label="Következő kép">${ik('jobb')}</button>
        <div class="hg-pontok" aria-hidden="true">${kepek.map((k, i) => `<span${i === 0 ? ' class="aktiv"' : ''}></span>`).join('')}</div>
      </figure>`;
}
function szolgKartya({ cim, szoveg, kep: kepAdat, galeria: galKepek, arSor, perc, gombCim, href, cta, szandek }) {
  const kepResz = galKepek
    ? kartyaGaleria(galKepek, { nev: szandek, felirat: `${cim}: Evelin munkái, lapozható képgaléria (balra-jobbra húzással vagy a nyilakkal lapozhatsz)`, sizes: '(min-width:900px) 30vw, 100vw' })
    : kepTag(kepAdat, { sizes: '(min-width:900px) 30vw, 40vw' });
  return `<article class="szolg-kartya${galKepek ? ' szolg-galeria-kartya' : ''}">
    <div class="szolg-kep">${kepResz}</div>
    <div class="szolg-torzs">
      <h3>${cim}</h3>
      <p>${szoveg}</p>
      <p class="szolg-adat"><span>${arSor}</span><span class="szolg-ido">${ik('ora')}${perc}</span></p>
      ${gomb(gombCim, href, { fajta: 'korvonal', cta, extra: ` data-service="${szandek}" data-staff-cta="${F}"` })}
    </div>
  </article>`;
}
function kartyak() {
  const f1 = kat('festes'), t1 = kat('tofestes'), b1 = kat('balayage'), m1 = kat('melir');
  const tv = kat('tofestesVagas');
  return `<div class="kartya-racs harom">
      ${szolgKartya({ cim: 'Hajfestés&nbsp;/ őszfedés', szoveg: KARTYA_SZOVEG.color.szoveg, kep: szolgFodrasz(F, 'color'), arSor: `${ft(f1.tol)}-tól`, perc: idoTartomany(f1.percTol, f1.percIg), gombCim: 'Festés időpontok', href: foglalo({ staff: F, category: 'color' }), cta: 'szolgaltatas-festes', szandek: 'color' })}
      ${szolgKartya({ cim: 'Tőfestés', szoveg: `${KARTYA_SZOVEG.tofestes.szoveg} Tőfestés + szárítás: ${ft(t1.tol)}-tól, vágással: ${ft(tv.tol)}-tól.`, galeria: TOFESTES_KEPEK(), arSor: `${ft(t1.tol)}-tól`, perc: idoTartomany(t1.percTol, t1.percIg), gombCim: 'Tőfestés időpontok', href: foglalo({ staff: F, category: KAT_LINK.tofestes }), cta: 'szolgaltatas-tofestes', szandek: 'tofestes' })}
      ${szolgKartya({ cim: 'Balayage&nbsp;/ ombre&nbsp;/ melír', szoveg: `${KARTYA_SZOVEG.balayage.szoveg} Teljes melír / airtouch: ${ft(m1.tol)}-tól.`, kep: szolgFodrasz(F, 'balayage'), arSor: `${ft(b1.tol)}-tól`, perc: idoTartomany(b1.percTol, b1.percIg), gombCim: 'Balayage időpontok', href: foglalo({ staff: F, category: 'balayage' }), cta: 'szolgaltatas-balayage', szandek: 'balayage' })}
    </div>`;
}
function arTabla() {
  const lista = arlista(F);
  const fulek = lista.map((cs, i) => `<button type="button" class="ar-ful${i === 0 ? ' aktiv' : ''}" role="tab" id="arful-${cs.kulcs}" aria-controls="arcsop-${cs.kulcs}" aria-selected="${i === 0}" data-ar-ful="${cs.kulcs}">${cs.cim}</button>`).join('');
  const csoportok = lista.map((cs, i) => `<div class="ar-csop" id="arcsop-${cs.kulcs}" role="tabpanel" aria-labelledby="arful-${cs.kulcs}" data-ar-csop="${cs.kulcs}"${i === 0 ? '' : ' hidden'}>
      <table class="ar-tabla">
        <thead><tr><th scope="col">Szolgáltatás</th>${HOSSZOK.map(([, c]) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
        <tbody>
${cs.sorok.map((r) => `          <tr><th scope="row">${r.cim}${r.alcim ? `<small>${r.alcim}</small>` : ''}</th>${r.cellak.egyseges ? egyCella(r.cellak.egyseges) : HOSSZOK.map(([hk, c]) => cellaHtml(r.cellak[hk], c)).join('')}</tr>`).join('\n')}
        </tbody>
      </table>
      <p class="ar-gomb-sor">${gomb(`${cs.cim}: szabad időpontok`, foglalo({ staff: F, category: cs.szandek }), { fajta: 'arany', cta: 'ar-' + cs.kulcs, extra: ` data-service="${cs.szandek}" data-staff-cta="${F}"` })}</p>
    </div>`).join('\n');
  return `<div class="ar-ful-sor-cim"><h3>Teljes árlista hajhossz szerint</h3></div>
    <div class="ar-fulek" role="tablist" aria-label="Szolgáltatáscsoportok">${fulek}</div>
${csoportok}`;
}
function arSzekcio() {
  return `<section class="szekcio" id="szolgaltatasok" aria-labelledby="szolg-cim" data-ar>
  <div class="tartalom">
    ${szekcioFej('Szolgáltatások és árak', 'Evelin árai hajhossz szerint', 'Ugyanezeket az árakat és időtartamokat látod a foglalóban is.', 'szolg-cim')}
    ${kartyak()}
    ${arTabla()}
    <ul class="ar-megj">
      <li>${ik('info')}<span>A festések ára a hajfestéket és a szárítást is tartalmazza; a vágás ott van az árban, ahol a szolgáltatás neve is jelzi (például balayage, teljes melír, tőfestés + vágás). A hajvágás ára a szárítást is tartalmazza.</span></li>
      <li>${ik('info')}<span>Az ár a haj hosszától függ (rövid, közepes, hosszú, extra hosszú haj). Ha az átlagosnál több festékre van szükség, az ár kis mértékben nőhet. A végleges időtartam a haj hosszától és állapotától függ.</span></li>
      <li>${ik('info')}<span>Készpénzzel és bankkártyával is fizethetsz.</span></li>
    </ul>
    <p class="cta-sor">${gomb('Evelin összes időpontja', foglalo({ staff: F }), { cta: 'ar-osszes-idopont', poz: 'arak', extra: ` data-staff-cta="${F}"` })}</p>
  </div>
</section>`;
}

// ---- miert Evelin (C, E) ----------------------------------------------------------------------------------------------------------------------------
function miert() {
  const kartya = (ikon, c, sz) => `<li class="mini-kartya">${ik(ikon)}<h3>${c}</h3><p>${sz}</p></li>`;
  return `<section class="szekcio" aria-labelledby="miert-cim">
  <div class="tartalom">
    ${szekcioFej('Miért érdemes?', `Miért válaszd ${f.rag.t}?`, '', 'miert-cim')}
    <ul class="kartya-racs negy kicsi-kartyak">
      ${kartya('chat', 'Te vagy a középpontban', f.miert[0][1])}
      ${kartya('gyemant', 'Vendégeim 90%-a évek óta visszajár', 'Vendégeim 90%-a évek óta visszajár hozzám, mert tudják, mire számíthatnak.')}
      ${kartya('level', 'Ajándék fejmasszázs', 'A hajmosást relaxáló fejmasszázzsal egészítjük ki, hogy a kezelés rögtön kikapcsolódással kezdődjön. Ez ajándék.')}
      ${kartya('ollo', f.miert[1][0], f.miert[1][1])}
    </ul>
  </div>
</section>`;
}
function festek() {
  return `<section class="szekcio halvany" aria-labelledby="festek-cim">
  <div class="tartalom festek">
    <div class="festek-kep">${kepTag(KEPEK.festek[F](), { sizes: '(min-width:900px) 30vw, 90vw' })}</div>
    <div>
      ${felcim('A legmagasabb minőségű hajfestékkel dolgozom')}
      <h2 id="festek-cim">${f.festek.nev}</h2>
      <p class="lead">${f.festek.szoveg}</p>
    </div>
  </div>
</section>`;
}

// ---- bemutatkozas + video ---------------------------------------------------------------------------------------------------------------------------
function bemutat() {
  return `<section class="szekcio" aria-labelledby="bemutat-cim">
  <div class="tartalom bemutat-racs">
    <div class="bemutat">
      ${felcim('Fodrászt váltani nagy döntés')}
      <h2 id="bemutat-cim">Ingyenes konzultációval várlak</h2>
${f.bemutatkozas.map((t) => `      <p class="lead">${t}</p>`).join('\n')}
      <p class="alairas">${f.teljesNev}<span>fodrász</span></p>
      <p class="cta-sor">${gomb(`${konzultacio().perc} perces ingyenes konzultáció`, foglalo({ staff: F, service: KONZULT }), { cta: 'bemutat-konzultacio', extra: ' data-konzult="1"' })}</p>
    </div>
    ${videoDoboz(KEPEK.videok[F])}
  </div>
</section>`;
}

// ---- vendegvelemenyek: a Trustindex-beagyazas (a hair-landing.js tolti) AZ OLDALON BELUL; a hero ertekeles-sora ide gorget. A kozos sablon "Tovabbi velemenyek a Google-on" gombja (kifele vivo link) itt NINCS.
const velemenyekSzekcio = () => `<section class="szekcio halvany" id="velemenyek" aria-labelledby="velemenyek-cim">
  <div class="tartalom">
    ${szekcioFej('Vendégeim mondták', 'Valódi vendégek, valódi vélemények', 'A MOSAIC Google-értékelései és vendégvéleményei – szerkesztés és válogatás nélkül.', 'velemenyek-cim')}
    <div class="ti-doboz" id="ti-doboz" data-forras="/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html"></div>
  </div>
</section>`;

// ---- GYIK (F): a Noel-oldal mintaja, Evelinre (a hajhosszabbitas es a szombati nyitvatartas nelkul) --------------------------------------------------------
export function gyikLista() {
  const ba = kat('balayage'), melir = kat('melir'), tof = kat('tofestes');
  return [
    ['Mennyibe kerül pontosan?', `Az ár a szolgáltatástól és a haj hosszától függ. Például a tőfestés ${ft(tof.tol)}-tól, a teljes melír ${ft(melir.tol)}-tól, a balayage ${ft(ba.tol)}-tól kapható. Az árlistában minden szolgáltatást hajhossz szerint látsz, és ugyanez az ár jelenik meg a foglalóban is.`],
    ['Mennyi ideig tart?', `Szolgáltatástól és hajhossztól függ: a tőfestés szárítással kb. ${idoTartomany(tof.percTol, tof.percIg)}, a balayage kb. ${idoTartomany(ba.percTol, ba.percIg)}. A foglalásnál mindig a kiválasztott szolgáltatás pontos időtartamát látod.`],
    ['Mit tartalmaz az ár?', 'A festések ára a hajfestéket és a szárítást is tartalmazza; a vágás ott van az árban, ahol a szolgáltatás neve is jelzi. A hajmosást relaxáló fejmasszázzsal egészítjük ki, ez ajándék. Készpénzzel és bankkártyával is fizethetsz.'],
    ['Károsítja-e a szőkítés a hajam?', 'A haj állapotát előbb felmérjük, és csak reálisan vállalható eredményt javaslunk. Sötétből nagyon világos hajra váltásnál, korábbi sokszori festésnél vagy színkorrekciónál előfordulhat, hogy a kívánt eredmény több alkalmat igényel. Ezt a kezelés előtt megbeszéljük.'],
    ['Mi történik, ha nem tudom, mit foglaljak?', `Foglalhatsz ${konzultacio().perc} perces ingyenes fodrász konzultációt: megnézzük a hajad, átbeszéljük az elképzeléseidet, és megmondjuk, melyik szolgáltatás való neked, és mennyibe kerül.`],
    ['Hol található a szalon?', `${SZALON.cim} ${SZALON.hely[0].toUpperCase() + SZALON.hely.slice(1)}, a 2. és 3. kerület határán. Nyitvatartás: hétfőtől péntekig 8:00–20:00.`],
  ];
}
const gyik = () => `<section class="szekcio" id="gyik" aria-labelledby="gyik-cim">
  <div class="tartalom keskeny">
    ${szekcioFej('Gyakori kérdések', 'Ami még a foglalás előtt felmerülhet', '', 'gyik-cim')}
    <div class="gyik-lista">
${gyikLista().map(([k, v]) => `      <details><summary>${esc(k)}</summary><p>${v}</p></details>`).join('\n')}
    </div>
  </div>
</section>`;

// ---- foglalas, hely ---------------------------------------------------------------------------------------------------------------------------------
const foglalasSzekcio = () => `<section class="szekcio sotet" id="foglalas" aria-labelledby="foglalas-cim">
  <div class="tartalom foglalo-doboz">
    ${felcim('Időpontfoglalás')}
    <h2 id="foglalas-cim">Foglalj időpontot ${f.rag.hez}</h2>
    <p class="lead">Válaszd ki a számodra megfelelő időpontot, és tedd meg az első lépést a gyönyörű haj felé. A foglalóban ${f.nev} saját szabad időpontjait látod.</p>
    <p class="cta-sor kozepre">${gomb('30 perces ingyenes konzultáció Evelinnel', foglalo({ staff: F, service: KONZULT }), { cta: 'foglalas-konzultacio', poz: 'foglalas', extra: ' data-konzult="1"' })}${gomb('Evelin összes időpontja', foglalo({ staff: F }), { fajta: 'vilagos', cta: 'foglalas-doboz', poz: 'foglalas', extra: ` data-staff-cta="${F}"`, nyilat: false })}</p>
  </div>
</section>`;
const helySzekcio = () => `<section class="szekcio halvany" id="hely" aria-labelledby="hely-cim">
  <div class="tartalom hely-racs">
    <div class="hely-bal">
      <div class="hely-szoveg">
        ${felcim('Itt találsz meg')}
        <h2 id="hely-cim">${SZALON.nev}</h2>
        <ul class="hely-lista">
          <li>${ik('pin')}<span>${SZALON.cim}<br><span class="halk">${SZALON.hely[0].toUpperCase() + SZALON.hely.slice(1)}</span></span></li>
          <li>${ik('ora')}<span>${NYITVA_HETKOZNAP}</span></li>
          <li>${ik('telefon')}<span><a href="${SZALON.telefonLink}" data-cta="telefon">${SZALON.telefon}</a></span></li>
        </ul>
        <p class="cta-sor">${gomb('Útvonaltervezés', TERKEP_LINK, { fajta: 'korvonal', cta: 'utvonal', extra: ' target="_blank" rel="noopener"' })}${gomb(`Foglalok ${f.rag.hez}`, foglalo({ staff: F }), { cta: 'hely-foglalas', extra: ` data-staff-cta="${F}"` })}</p>
      </div>
      <div class="terkep" id="terkep">
        <div class="terkep-hely" id="terkep-hely">
          <span class="ikon-kor">${ik('pin')}</span>
          <p><b>MOSAIC</b><br>${SZALON.cim}</p>
          <button type="button" class="gomb gomb-korvonal gomb-kicsi" id="terkep-gomb">Google térkép megjelenítése</button>
        </div>
      </div>
    </div>
    ${lapozGaleria(KEPEK.szalon.map((x) => x()), { cls: 'hely-galeria', nev: 'hely', felirat: 'A MOSAIC Hair fodrászatának képei: lapozható galéria', sizes: '(min-width:900px) 50vw, 100vw' })}
  </div>
</section>`;

export const stickyEvelinUj = () => `<div class="sticky-cta" id="sticky-cta" aria-hidden="true">
  <a class="gomb gomb-arany" href="${foglalo({ staff: F, service: KONZULT })}" data-cta="sticky-konzultacio" data-konzult="1" tabindex="-1">Ingyenes konzultáció <span class="nyil" aria-hidden="true">→</span></a>
  <a class="sticky-masodlagos" href="${foglalo({ staff: F })}" data-cta="sticky-idopontok" data-staff-cta="${F}" tabindex="-1">Evelin időpontjai</a>
</div>`;

export function evelinUjTorzs() {
  return `<main class="hl hl-fodrasz hl-evelin hl-evelin-uj" id="top" data-landing="hair-evelin-ads" data-intent="staff" data-staff="${F}">
<!-- ============ HERO ============ -->
${hero()}

<!-- ============ SZOLGALTATASOK + ARAK ============ -->
${arSzekcio()}

${galeriaSzekcio(F, { felc: 'Evelin munkái', cim: 'Valódi vendégek, valódi eredmények', lead: 'Minden kép Evelin vendégének hajáról készült.', db: 8 })}

${miert()}

${festek()}

${bemutat()}

${velemenyekSzekcio()}

${foglalasSzekcio()}

${gyik()}

${helySzekcio()}
</main>`;
}
