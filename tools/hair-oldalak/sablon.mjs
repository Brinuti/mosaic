// A fodraszat-oldalak szekcio-sablonjai (HTML-szoveg): ugyanabbol a komponens-rendszerbol epul a kozponti oldal es a harom fodrasz-oldal.
// A tartalom a tools/hair-oldalak/adat.mjs-bol jon (arak: Salonic-pillanatkep). Kezzel a generalt oldalakat ne szerkeszd: ide / az adatba ird.
import {
  LAPOK, SZALON, TERKEP_LINK, GOOGLE_VELEMENYEK_LINK, FODRASZOK, HOSSZOK, CSOPORTOK, SZINEK, KEPEK, KONZULT, POTHAJ, PILLANATKEP,
  foglalo, oldalUt, arlista, szandekAdat, katAdat, noiVagasTol, ferfiVagas, konzultacio, galeria, szolgFodrasz, SZOLG_KEP, ft, ido, idoTartomany,
} from './adat.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nyil = '<span class="nyil" aria-hidden="true">→</span>';
const ik = (nev) => `<svg class="ik" aria-hidden="true"><use href="#i-${nev}"/></svg>`;
const SZANDEK_JEL = { balayage: 'balayage', festes: 'color', vagas: 'cut', ujraepites: 'ujraepites', pothaj: 'pothaj' };

export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <symbol id="i-naptar" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12a7 7 0 00-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></symbol>
  <symbol id="i-ollo" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8 7.5L20 18M8 16.5L20 6"/></symbol>
  <symbol id="i-szív" viewBox="0 0 24 24"><path d="M12 20s-7.500-4.600-7.500-10A4.200 4.200 0 0112 7.200 4.200 4.200 0 0119.500 10c0 5.400-7.500 10-7.500 10z"/></symbol>
  <symbol id="i-gyemant" viewBox="0 0 24 24"><path d="M6 4h12l3.500 5L12 20.500 2.500 9z"/><path d="M2.500 9h19M9.500 4L8 9l4 11.500M14.500 4L16 9l-4 11.500"/></symbol>
  <symbol id="i-level" viewBox="0 0 24 24"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c2-4 5-7 9-9"/></symbol>
  <symbol id="i-telefon" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.500 1.500a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></symbol>
  <symbol id="i-pipa" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.500l2.800 2.800 5.700-5.800"/></symbol>
  <symbol id="i-ora" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 11.500a8.500 8.500 0 01-12.400 7.500L3 20.500l1.600-4.800A8.500 8.500 0 1121 11.500z"/><path d="M8.500 11.500h7M8.500 14.500h4"/></symbol>
  <symbol id="i-kep" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.800"/><path d="M4 17l5-4.500 4 3.500 3-2.500 4 3.500"/></symbol>
  <symbol id="i-fej" viewBox="0 0 24 24"><circle cx="12" cy="8.500" r="4"/><path d="M5 21c0-4 3-6.500 7-6.500s7 2.500 7 6.500"/></symbol>
  <symbol id="i-jobb" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
  <symbol id="i-bal" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.500"/><path d="M12 11v6M12 7.500v.1"/></symbol>
</defs></svg>`;

// ---- kozos kis darabok ----------------------------------------------------------------------------------------------------------------
const kepTag = (k, { cls = '', lazy = true, sizes = '', extra = '' } = {}) => `<img${cls ? ` class="${cls}"` : ''} src="${k.src}" alt="${esc(k.alt)}" width="${k.w}" height="${k.h}"${lazy ? ' loading="lazy" decoding="async"' : ' fetchpriority="high"'}${sizes ? ` sizes="${sizes}"` : ''}${k.poz ? ` style="object-position:${k.poz}"` : ''}${extra}>`;
const gomb = (felirat, href, { fajta = 'arany', cta = '', poz = '', extra = '', nyilat = true } = {}) =>
  `<a class="gomb gomb-${fajta}" href="${href}"${cta ? ` data-cta="${cta}"` : ''}${poz ? ` data-poz="${poz}"` : ''}${extra}>${felirat}${nyilat ? ' ' + nyil : ''}</a>`;
const felcim = (s) => `<p class="felcim">${esc(s)}</p>`;
const szekcioFej = (felc, cim, lead = '', id = '') => `<div class="szekcio-fej">${felc ? felcim(felc) : ''}<h2${id ? ` id="${id}"` : ''}>${cim}</h2>${lead ? `<p class="lead">${lead}</p>` : ''}</div>`;

/** A kovetkezo szabad konzultacio sora (a hair-landing.js tolti ki a Salonic naptarabol; nincs adat: rejtve marad, kitalalt idopont nincs). */
const kovetkezo = (fodrasz, cls = '') => `<p class="kovetkezo ${cls}" data-kovetkezo="${fodrasz || ''}" hidden>${ik('naptar')}<span>Legközelebbi szabad konzultáció: <a href="${foglalo({ staff: fodrasz || undefined, service: KONZULT })}" data-cta="kovetkezo-idopont" data-ido-link></a></span></p>`;

const googleChip = () => `<a class="g-chip" id="g-chip" href="${GOOGLE_VELEMENYEK_LINK}" target="_blank" rel="noopener" data-cta="google-ertekeles" hidden aria-label="Google-értékelés">
  <svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8a10 10 0 01-4.4 6.6v5.5h7.1c4.1-3.8 6.5-9.4 6.5-16.1z"/><path d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7A22 22 0 0024 46z"/><path d="M11.8 28.2a13 13 0 010-8.4v-5.7H4.5a22 22 0 000 19.8z"/><path d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3A22 22 0 004.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>
  <span class="g-csillag" id="g-csillag" role="img" aria-label="" style="--ert:100%"></span>
  <span class="g-szoveg" id="g-szoveg"></span>
</a>`;

// ---- szolgaltatas-kartya ----------------------------------------------------------------------------------------------------------------
const KARTYA_SZOVEG = {
  balayage: { cim: 'Balayage / ombre / melír', szoveg: 'Lágy átmenetek, hozzád illő árnyalat, természetes hatás. A balayage lágy átmenetet ad, az ombre mélyebb kontrasztot, a melír precíz csíkokat.', gomb: 'Balayage időpontok' },
  color: { cim: 'Hajfestés / őszfedés', szoveg: 'Egységes, fényes hajszín és pontos őszfedés. Tőfestés, ha csak a lenövést kell eltüntetni; teljes festés, ha új színt szeretnél.', gomb: 'Festés időpontok' },
  cut: { cim: 'Hajvágás', szoveg: 'Az arcodhoz és a hajad természetes eséséhez illő fazon, amit könnyű otthon is formázni.', gomb: 'Hajvágás időpontok' },
  ujraepites: { cim: 'Joico hajszerkezet-újraépítés', szoveg: 'Négy lépéses hajújraépítő kezelés a fáradt, megviselt hajra.', gomb: 'Újraépítés időpontok' },
  pothaj: { cim: 'Hajhosszabbítás (póthaj)', szoveg: 'Póthaj felrakása és leszedése is foglalható.', gomb: 'Póthaj időpontok' },
};
const idoSzoveg = (a) => (a ? idoTartomany(a.percTol, a.percIg) : '');

function szolgKartyaKozpont(szandek) {
  const t = KARTYA_SZOVEG[szandek], a = szandekAdat(szandek);
  let arSor = `${ft(a.tol)}-tól`;
  if (szandek === 'cut') arSor = `Női: ${ft(noiVagasTol())}-tól · Férfi: ${ft(ferfiVagas())}`;
  return `<article class="szolg-kartya">
    <div class="szolg-kep">${kepTag(SZOLG_KEP(szandek === 'color' ? 'color' : szandek === 'cut' ? 'cut' : 'balayage'), { sizes: '(min-width:900px) 25vw, 90vw' })}</div>
    <div class="szolg-torzs">
      <p class="kartya-cimke">Szolgáltatás</p>
      <h3>${t.cim}</h3>
      <p>${t.szoveg}</p>
      <p class="szolg-adat"><span>${arSor}</span><span class="szolg-ido">${ik('ora')}${idoSzoveg(a)}</span></p>
      ${gomb(t.gomb, foglalo({ category: szandek }), { fajta: 'arany', cta: 'szolgaltatas-' + szandek, extra: ` data-service="${szandek}"` })}
    </div>
  </article>`;
}
function konzultKartya() {
  const k = konzultacio();
  return `<article class="szolg-kartya szolg-konzult">
    <div class="szolg-kep">${kepTag(KEPEK.szolgaltatas.konzultacio(), { sizes: '(min-width:900px) 25vw, 90vw' })}</div>
    <div class="szolg-torzs">
      <p class="kartya-cimke">Ha még nem tudod</p>
      <h3>Ingyenes fodrász konzultáció</h3>
      <p>${ido(k.perc)} alatt megnézzük a hajad, átbeszéljük az elképzeléseidet, és együtt kiválasztjuk a számodra megfelelő szolgáltatást.</p>
      <p class="szolg-adat"><span>Ingyenes</span><span class="szolg-ido">${ik('ora')}${ido(k.perc)}</span></p>
      ${gomb('Segítsetek választani', foglalo({ service: KONZULT }), { fajta: 'korvonal', cta: 'szolgaltatas-konzultacio', extra: ' data-konzult="1"' })}
    </div>
  </article>`;
}

// ---- galeria + lightbox --------------------------------------------------------------------------------------------------------------------
function galeriaSzekcio(kulcs, { felc, cim, lead, szuro = true, db = 8 }) {
  const lista = galeria(kulcs);
  const szinek = [...new Set(lista.map((g) => g.szin))].filter((s) => lista.filter((g) => g.szin === s).length >= 2);
  const szurok = szuro && szinek.length > 1
    ? `<div class="szurok" role="group" aria-label="Munkák szűrése"><button type="button" class="szuro aktiv" data-szuro="" aria-pressed="true">Összes</button>${['s', 'b', 'c', 'v'].filter((s) => szinek.includes(s)).map((s) => `<button type="button" class="szuro" data-szuro="${s}" aria-pressed="false">${SZINEK[s]}</button>`).join('')}</div>`
    : '';
  return `<section class="szekcio halvany" id="munkak-szekcio" aria-labelledby="munkak-cim" data-galeria data-db="${db}">
  <div class="tartalom">
    ${szekcioFej(felc, cim, lead, 'munkak-cim')}
    ${szurok}
    <ul class="galeria-racs" id="galeria-racs">
${lista.map((g, i) => `      <li data-szin="${g.szin}"><button type="button" class="kep-gomb" data-nagy="${g.src}" data-alt="${esc(g.alt)}" data-sorszam="${i}" aria-label="Munka nagyítása: ${esc(g.alt)}">${kepTag(g, { sizes: '(min-width:900px) 22vw, 46vw' })}<span class="nagyit" aria-hidden="true">${ik('kep')}</span></button></li>`).join('\n')}
    </ul>
    <p class="galeria-tobb-sor"><button type="button" class="gomb gomb-korvonal" id="galeria-tobb" hidden>További munkák <span class="nyil" aria-hidden="true">↓</span></button></p>
  </div>
</section>`;
}
export const LIGHTBOX = `<dialog class="lb" id="lb" aria-label="Munka nagyítva">
  <button type="button" class="lb-zar" id="lb-zar" aria-label="Bezárás">${ik('x')}</button>
  <button type="button" class="lb-elozo" id="lb-elozo" aria-label="Előző kép">${ik('bal')}</button>
  <figure class="lb-kep"><img id="lb-img" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="><figcaption id="lb-cim"></figcaption></figure>
  <button type="button" class="lb-kovetkezo" id="lb-kovetkezo" aria-label="Következő kép">${ik('jobb')}</button>
</dialog>`;

// ---- arlista ----------------------------------------------------------------------------------------------------------------------------------
function cellaHtml(c, hk) {
  if (!c) return `<td class="nincs" data-label="${hk}"><span aria-label="nem elérhető">–</span></td>`;
  return `<td data-label="${hk}">${c.regi ? `<s class="regi-ar">${ft(c.regi)}</s>` : ''}<span class="ar">${ft(c.ar)}</span><span class="perc">${ido(c.perc)}</span></td>`;
}
const egyCella = (c) => `<td class="egy" colspan="4" data-label="Ár">${c.regi ? `<s class="regi-ar">${ft(c.regi)}</s>` : ''}<span class="ar">${ft(c.ar)}</span><span class="perc">${ido(c.perc)} · hajhossztól független</span></td>`;
function arSzekcio(fodrasz, { felc, cim, lead }) {
  const lista = arlista(fodrasz);
  const kedv = fodrasz ? FODRASZOK[fodrasz].kedvezmeny : 0;
  const nev = fodrasz ? FODRASZOK[fodrasz].nev : null;
  const fulek = lista.map((cs, i) => `<button type="button" class="ar-ful${i === 0 ? ' aktiv' : ''}" role="tab" id="arful-${cs.kulcs}" aria-controls="arcsop-${cs.kulcs}" aria-selected="${i === 0}" data-ar-ful="${cs.kulcs}">${cs.cim}</button>`).join('');
  const csoportok = lista.map((cs, i) => `<div class="ar-csop" id="arcsop-${cs.kulcs}" role="tabpanel" aria-labelledby="arful-${cs.kulcs}" data-ar-csop="${cs.kulcs}"${i === 0 ? '' : ' hidden'}>
      <table class="ar-tabla">
        <thead><tr><th scope="col">Szolgáltatás</th>${HOSSZOK.map(([, c]) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
        <tbody>
${cs.sorok.map((r) => `          <tr><th scope="row">${r.cim}${r.alcim ? `<small>${r.alcim}</small>` : ''}</th>${r.cellak.egyseges ? egyCella(r.cellak.egyseges) : HOSSZOK.map(([hk, c]) => cellaHtml(r.cellak[hk], c)).join('')}</tr>`).join('\n')}
        </tbody>
      </table>
      <p class="ar-gomb-sor">${gomb(`${cs.cim}: szabad időpontok`, foglalo({ staff: fodrasz || undefined, category: cs.szandek }), { fajta: 'arany', cta: 'ar-' + cs.kulcs, extra: ` data-service="${cs.szandek}"` })}</p>
    </div>`).join('\n');
  const noelMegj = kedv ? `<p class="ar-kedvezmeny">${ik('pipa')}<span><b>${nev} jelenleg ${kedv}% kedvezménnyel dolgozik</b> – az árak már a kedvezménnyel értendők, az áthúzott a listaár.</span></p>` : '';
  const kozpontMegj = !fodrasz && PILLANATKEP.fodraszok.some((f) => f.kedvezmeny)
    ? `<p class="ar-kedvezmeny">${ik('pipa')}<span><b>Noelnél jelenleg ${FODRASZOK.noel.kedvezmeny}% kedvezmény van</b> – az ő árait a saját oldalán és a foglalóban a kedvezménnyel látod.</span></p>` : '';
  return `<section class="szekcio" id="arak-szekcio" aria-labelledby="arak-cim" data-ar>
  <div class="tartalom">
    ${szekcioFej(felc, cim, lead, 'arak-cim')}
    ${noelMegj}${kozpontMegj}
    <div class="hossz-segedlet" aria-hidden="true">
      <figure><img src="/assets/img/booking/hh-rovid.jpg" alt="" width="96" height="96" loading="lazy"><figcaption>Rövid</figcaption></figure>
      <figure><img src="/assets/img/booking/hh-kozepes.jpg" alt="" width="96" height="96" loading="lazy"><figcaption>Közepes</figcaption></figure>
      <figure><img src="/assets/img/booking/hh-hosszu.jpg" alt="" width="96" height="96" loading="lazy"><figcaption>Hosszú</figcaption></figure>
      <figure><img src="/assets/img/booking/hh-extra.jpg" alt="" width="96" height="96" loading="lazy"><figcaption>Extra hosszú</figcaption></figure>
    </div>
    <div class="ar-fulek" role="tablist" aria-label="Szolgáltatáscsoportok">${fulek}</div>
${csoportok}
    <ul class="ar-megj">
      <li>${ik('info')}<span>A festések ára a hajfestéket, a vágást és a szárítást is tartalmazza; ha az átlagosnál több festékre van szükség, az ár kis mértékben nőhet. A hajvágás ára a szárítást is tartalmazza.</span></li>
      <li>${ik('info')}<span>Ugyanezek az árak és időtartamok jelennek meg a foglalóban. A végleges időtartam a haj hosszától és állapotától függ. Készpénzzel és bankkártyával is fizethetsz.</span></li>
    </ul>
  </div>
</section>`;
}

// ---- folyamat, realitas, konzultacio ------------------------------------------------------------------------------------------------------------
const LEPESEK = [
  ['Átbeszéljük', 'Mit szeretnél, és mit szeretnél elkerülni.'],
  ['Felmérjük', 'A hajad állapotát és előzményeit.'],
  ['Tervet kapsz', 'Reális eredmény, idő és várható ár.'],
  ['Elkészítjük', 'A választott szolgáltatást.'],
  ['Fenntartás', 'Megmutatjuk az otthoni ápolás irányát.'],
];
const folyamatSzekcio = () => `<section class="szekcio sotet" aria-labelledby="folyamat-cim">
  <div class="tartalom">
    ${szekcioFej('A folyamat', 'Pontosan tudd, mi történik', 'Nincs meglepetés: minden lépést előre megbeszélünk.', 'folyamat-cim')}
    <ol class="lepesek">
${LEPESEK.map(([c, sz], i) => `      <li><span class="lepes-szam">${String(i + 1).padStart(2, '0')}</span><h3>${c}</h3><p>${sz}</p></li>`).join('\n')}
    </ol>
  </div>
</section>`;
const realitasSzekcio = () => `<section class="szekcio" aria-labelledby="realitas-cim">
  <div class="tartalom realitas">
    <div class="realitas-jel" aria-hidden="true">${ik('pajzs')}<span>Haj<br>biztonság</span></div>
    <div>
      ${felcim('Realitás')}
      <h2 id="realitas-cim">Nem ígérünk olyat, amit a hajad nem bír el</h2>
      <p class="lead">Sötétből nagyon világos hajra váltásnál, korábbi sokszori festésnél vagy színkorrekciónál előfordulhat, hogy a kívánt eredmény több alkalmat igényel. Ezt még a kezelés megkezdése előtt egyeztetjük.</p>
    </div>
  </div>
</section>`;
function konzultSzekcio(fodrasz) {
  const k = konzultacio(), f = fodrasz ? FODRASZOK[fodrasz] : null;
  return `<section class="szekcio" id="konzultacio" aria-labelledby="konzult-cim">
  <div class="tartalom konzult">
    <div class="konzult-kep">${kepTag(KEPEK.szolgaltatas.konzultacio(), { sizes: '(min-width:900px) 40vw, 90vw' })}<span class="kep-cimke">Ingyenes konzultáció</span></div>
    <div class="konzult-szoveg">
      ${felcim(`${ido(k.perc)} · 0 Ft`)}
      <h2 id="konzult-cim">${f ? `Nem kell tudnod a szolgáltatás nevét – ${f.nev} segít` : 'Nem kell tudnod a fodrászati szolgáltatás nevét'}</h2>
      <p class="lead">Lehet, hogy tudod, milyen hajat szeretnél, de azt nem, hogy ehhez balayage, melír, teljes festés vagy színkorrekció kell. Ez teljesen rendben van.</p>
      <p class="konzult-cim2">Az ingyenes konzultáción:</p>
      <ul class="pipak">
        <li>${ik('pipa')}<span>megnézzük a hajad állapotát</span></li>
        <li>${ik('pipa')}<span>átbeszéljük a kívánt eredményt</span></li>
        <li>${ik('pipa')}<span>elmondjuk, mi érhető el biztonságosan</span></li>
        <li>${ik('pipa')}<span>és megmondjuk a várható árat</span></li>
      </ul>
      <p class="cta-sor">${gomb(`${k.perc} perces ingyenes konzultáció`, foglalo({ staff: fodrasz || undefined, service: KONZULT }), { cta: 'konzultacio-szekcio', extra: ' data-konzult="1"' })}</p>
      ${kovetkezo(fodrasz)}
    </div>
  </div>
</section>`;
}

// ---- velemenyek, gyik, hely -------------------------------------------------------------------------------------------------------------------
const velemenyekSzekcio = (fodrasz) => {
  const kepek = fodrasz && KEPEK.velemenyek[fodrasz];
  const nev = fodrasz ? FODRASZOK[fodrasz].nev : null;
  return `<section class="szekcio halvany" id="velemenyek" aria-labelledby="velemenyek-cim">
  <div class="tartalom">
    ${szekcioFej(nev ? 'Vendégeim mondták' : 'Mit mondanak rólunk?', nev ? 'Valódi vendégek, valódi vélemények' : 'Valódi vendégeink véleménye', 'A MOSAIC Google-értékelései és vendégvéleményei – szerkesztés és válogatás nélkül.', 'velemenyek-cim')}
    ${kepek ? `<ul class="velemeny-racs" aria-label="Vendégvélemények ${nev}ről">
${kepek.map(([blokk, alt]) => { const k = tartalomKep(fodrasz, blokk); return `      <li><img src="${k.src}" alt="${esc(alt)}" width="${k.w}" height="${k.h}" loading="lazy" decoding="async"></li>`; }).join('\n')}
    </ul>` : ''}
    <div class="ti-doboz" id="ti-doboz" data-forras="/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html"></div>
    <p class="cta-sor kozepre">${gomb('További vélemények a Google-on', GOOGLE_VELEMENYEK_LINK, { fajta: 'korvonal', cta: 'velemenyek-google', extra: ' target="_blank" rel="noopener"' })}</p>
  </div>
</section>`;
};
import { kep as tartalomKep } from './adat.mjs';

function gyikLista(extra = [], fodrasz = null) {
  const ba = katAdat('Balayage', fodrasz), melir = katAdat('Teljes melír / airtouch + vágás', fodrasz), tof = katAdat('Tőfestés + szárítás', fodrasz), vag = katAdat('Női hajvágás + szárítás', fodrasz);
  return [
    ['Mennyibe kerül pontosan?', `Az ár a szolgáltatástól és a haj hosszától függ. Például a női hajvágás szárítással ${ft(vag.tol)}-tól, a tőfestés ${ft(tof.tol)}-tól, a teljes melír ${ft(melir.tol)}-tól, a balayage ${ft(ba.tol)}-tól kapható. Az árlistában minden szolgáltatást hajhossz szerint látsz, és ugyanez az ár jelenik meg a foglalóban is.`],
    ['Mennyi ideig tart?', `Szolgáltatástól és hajhossztól függ: a tőfestés szárítással kb. ${idoTartomany(tof.percTol, tof.percIg)}, a balayage vágással és szárítással kb. ${idoTartomany(ba.percTol, ba.percIg)}, a női hajvágás szárítással ${idoTartomany(vag.percTol, vag.percIg)}. A foglalásnál mindig a kiválasztott szolgáltatás pontos időtartamát látod.`],
    ['Mit tartalmaz az ár?', 'A festések ára a hajfestéket, a vágást és a szárítást is tartalmazza, a hajvágás ára a szárítást. A hajmosást relaxáló fejmasszázzsal egészítjük ki, ez ajándék. Készpénzzel és bankkártyával is fizethetsz.'],
    ['Károsítja-e a szőkítés a hajam?', 'A haj állapotát előbb felmérjük, és csak reálisan vállalható eredményt javaslunk. Sötétből nagyon világos hajra váltásnál, korábbi sokszori festésnél vagy színkorrekciónál előfordulhat, hogy a kívánt eredmény több alkalmat igényel. Ezt a kezelés előtt megbeszéljük.'],
    ['Muszáj fodrászt választanom?', 'Nem. Ha nem számít, kihez mész, a foglalóban válaszd a „Mindegy – a legkorábbi időpont érdekel” lehetőséget, és a legkorábbi szabad időpontot mutatjuk.'],
    ['Mi történik, ha nem tudom, mit foglaljak?', `Foglalhatsz ${konzultacio().perc} perces ingyenes fodrász konzultációt: megnézzük a hajad, átbeszéljük az elképzeléseidet, és megmondjuk, melyik szolgáltatás való neked, és mennyibe kerül.`],
    ...extra,
    ['Hol található a szalon?', `${SZALON.cim} ${SZALON.hely[0].toUpperCase() + SZALON.hely.slice(1)}, a 2. és 3. kerület határán. Nyitvatartás: hétfőtől péntekig 8:00–20:00, szombaton és vasárnap zárva vagyunk.`],
  ];
}
const gyikSzekcio = (extra = [], { felc = 'Gyakori kérdések', cim = 'Ami még a foglalás előtt felmerülhet' } = {}, fodrasz = null) => `<section class="szekcio" id="gyik" aria-labelledby="gyik-cim">
  <div class="tartalom keskeny">
    ${szekcioFej(felc, cim, '', 'gyik-cim')}
    <div class="gyik-lista">
${gyikLista(extra, fodrasz).map(([k, v]) => `      <details><summary>${esc(k)}</summary><p>${v}</p></details>`).join('\n')}
    </div>
  </div>
</section>`;

const helySzekcio = (fodrasz) => `<section class="szekcio halvany" id="hely" aria-labelledby="hely-cim">
  <div class="tartalom hely-racs">
    <div class="hely-szoveg">
      ${felcim('Itt találsz meg')}
      <h2 id="hely-cim">${SZALON.nev}</h2>
      <ul class="hely-lista">
        <li>${ik('pin')}<span>${SZALON.cim}<br><span class="halk">${SZALON.hely[0].toUpperCase() + SZALON.hely.slice(1)}</span></span></li>
        <li>${ik('ora')}<span>${SZALON.nyitva}<br><span class="halk">${SZALON.zarva}</span></span></li>
        <li>${ik('telefon')}<span><a href="${SZALON.telefonLink}" data-cta="telefon">${SZALON.telefon}</a></span></li>
      </ul>
      <p class="cta-sor">${gomb('Útvonaltervezés', TERKEP_LINK, { fajta: 'korvonal', cta: 'utvonal', extra: ' target="_blank" rel="noopener"' })}${gomb(fodrasz ? `Foglalok ${FODRASZOK[fodrasz].rag.hez}` : 'Szabad időpontok', foglalo({ staff: fodrasz || undefined }), { cta: 'hely-foglalas' })}</p>
    </div>
    <div class="hely-kepek">
      <div class="terkep" id="terkep">
        <div class="terkep-hely" id="terkep-hely">
          <span class="ikon-kor">${ik('pin')}</span>
          <p><b>MOSAIC</b><br>${SZALON.cim}</p>
          <button type="button" class="gomb gomb-korvonal gomb-kicsi" id="terkep-gomb">Google térkép megjelenítése</button>
        </div>
      </div>
      <ul class="szalon-kepek">
${KEPEK.szalon.map((f) => { const k = f(); return `        <li>${kepTag(k, { sizes: '(min-width:900px) 18vw, 45vw' })}</li>`; }).join('\n')}
      </ul>
    </div>
  </div>
</section>`;

const sticky = (fodrasz) => `<div class="sticky-cta" id="sticky-cta" aria-hidden="true">
  <a class="gomb gomb-arany" href="${foglalo({ staff: fodrasz || undefined })}" data-cta="sticky-idopontok" tabindex="-1">${fodrasz ? `${FODRASZOK[fodrasz].nev} időpontjai` : 'Szabad időpontok'} ${nyil}</a>
  <a class="sticky-masodlagos" href="${foglalo({ staff: fodrasz || undefined, service: KONZULT })}" data-cta="sticky-konzultacio" data-konzult="1" tabindex="-1">Ingyenes<br>konzultáció</a>
</div>`;

// ---- KOZPONTI OLDAL --------------------------------------------------------------------------------------------------------------------------
function fodraszKartyaKozpont(kulcs) {
  const f = FODRASZOK[kulcs], p = KEPEK.portre[kulcs]();
  const sz = f.szakteruletek.slice(0, 3).map((s) => szolgFodrasz(kulcs, SZANDEK_JEL[s]));
  const a = szandekAdat('balayage', kulcs);
  return `<article class="fodrasz-kartya">
    <a class="fk-kep" href="${oldalUt(kulcs)}" data-cta="fodrasz-oldal-${kulcs}" tabindex="-1" aria-hidden="true">${kepTag(p, { sizes: '(min-width:900px) 30vw, 90vw' })}</a>
    <div class="fk-torzs">
      <h3><a href="${oldalUt(kulcs)}" data-cta="fodrasz-nev-${kulcs}">${f.nev}</a></h3>
      <p class="fk-szak">${f.szakterulet}</p>
      <ul class="fk-minik" aria-hidden="true">${sz.map((k) => `<li>${kepTag(k, { sizes: '90px' })}</li>`).join('')}</ul>
      ${f.kedvezmeny ? `<p class="fk-jelzo">${ik('pipa')}Jelenleg ${f.kedvezmeny}% kedvezménnyel</p>` : ''}
      ${kovetkezo(kulcs, 'kicsi')}
      <p class="fk-gombok">${gomb(`Foglalok ${f.rag.hez}`, foglalo({ staff: kulcs }), { cta: 'fodrasz-foglalas-' + kulcs, extra: ` data-staff-cta="${kulcs}"` })}<a class="cta-link" href="${oldalUt(kulcs)}" data-cta="fodrasz-oldal-${kulcs}">${f.nev} munkái és árai</a></p>
    </div>
  </article>`;
}
export function kozpontOldal() {
  const hero = KEPEK.kozpontHero();
  const esetek = ['balayage', 'color', 'cut'];
  return `<main class="hl hl-kozpont" id="top" data-landing="hair-general" data-intent="general">
<!-- ============ HERO ============ -->
<section class="hero">
  <div class="tartalom hero-racs">
    <div class="hero-szoveg">
      ${felcim('Női fodrászat Budán · Bécsi út 2.')}
      <h1>Találd meg azt a hajszínt és fazont, ami tényleg jól áll neked</h1>
      <p class="lead">Balayage, hajfestés és női hajvágás személyre szabva. Megbeszéljük, mit szeretnél, megmutatjuk, mi reális a hajadból, és előre látod, mire számíthatsz.</p>
      <div class="cta-sor">
        ${gomb('Mutasd a szabad időpontokat', foglalo(), { cta: 'hero-idopontok', poz: 'hero' })}
        ${gomb('Nem tudom, mit foglaljak – ingyenes konzultáció', foglalo({ service: KONZULT }), { fajta: 'korvonal', cta: 'hero-konzultacio', poz: 'hero', extra: ' data-konzult="1"', nyilat: false })}
      </div>
      ${googleChip()}
      <ul class="jelvenyek">
        <li>${ik('pin')}Bécsi út 2. · Kolosy tér</li>
        <li>${ik('kep')}Valódi vendégmunkák</li>
        <li>${ik('chat')}Festés előtt konzultáció</li>
        <li>${ik('pipa')}Ugyanaz az ár, mint a foglalóban</li>
      </ul>
    </div>
    <figure class="hero-kep">${kepTag(hero, { lazy: false, sizes: '(min-width:900px) 45vw, 100vw' })}<figcaption class="kep-cimke">Valódi MOSAIC-vendégmunka</figcaption></figure>
  </div>
</section>

<section class="bizalom" aria-label="Röviden rólunk">
  <ul class="tartalom bizalom-lista">
    <li>${ik('csillag')}<span class="bz-szoveg"><b>Google-vélemények</b><span>valódi vendégektől</span></span></li>
    <li>${ik('pin')}<span class="bz-szoveg"><b>Bécsi út 2.</b><span>Kolosy tér mellett</span></span></li>
    <li>${ik('kep')}<span class="bz-szoveg"><b>Valódi munkák</b><span>nem stockfotók</span></span></li>
    <li>${ik('chat')}<span class="bz-szoveg"><b>Ingyenes konzultáció</b><span>reális terv és ár előre</span></span></li>
  </ul>
</section>

<!-- ============ SZOLGALTATASOK ============ -->
<section class="szekcio" id="szolgaltatasok" aria-labelledby="szolg-cim">
  <div class="tartalom">
    ${szekcioFej('Mit szeretnél?', 'Válaszd ki, miben segíthetünk', 'Csak azt kérdezzük meg, amit még nem tudunk rólad.', 'szolg-cim')}
    <div class="kartya-racs negy">
${esetek.map((e) => '      ' + szolgKartyaKozpont(e)).join('\n')}
      ${konzultKartya()}
    </div>
    <p class="szolg-tovabbi">Női szárítás és Joico hajszerkezet-újraépítés is foglalható – az árakat lent találod. Hajhosszabbítás (póthaj): <a href="${oldalUt('evelin')}" data-cta="fodrasz-oldal-evelin">Evelinnél</a>, felrakás ${POTHAJ.felrakasTincs} Ft / tincs.</p>
  </div>
</section>

${galeriaSzekcio('kozpont', { felc: 'Valódi eredmények', cim: 'Előbb nézd meg a munkáinkat', lead: 'Minden kép valódi MOSAIC-vendég hajáról készült.', db: 8 })}

<!-- ============ FODRASZOK ============ -->
<section class="szekcio" id="fodraszaink" aria-labelledby="fodraszok-cim">
  <div class="tartalom">
    ${szekcioFej('Fodrászaink', 'Kihez szeretnél menni?', 'Három fodrász, három saját stílus. Ha nem számít, a legkorábbi szabad időpontot is megmutatjuk.', 'fodraszok-cim')}
    <figure class="csapat-kep">${kepTag(KEPEK.csapat(), { sizes: '(min-width:900px) 50vw, 90vw' })}<figcaption>Betti, Noel és Evelin – a MOSAIC Hair csapata</figcaption></figure>
    <div class="kartya-racs harom">
${['betti', 'noel', 'evelin'].map((k) => '      ' + fodraszKartyaKozpont(k)).join('\n')}
    </div>
    <div class="mindegy-doboz">
      <div><b>Nem fontos, kihez megyek</b><span>A legkorábbi elérhető fodrász időpontját mutatjuk.</span></div>
      ${gomb('Mutasd a legkorábbi időpontot', foglalo(), { cta: 'mindegy-fodrasz', poz: 'fodraszok' })}
    </div>
  </div>
</section>

${arSzekcio(null, { felc: 'Átlátható árak', cim: 'Tudd előre, mire számíthatsz', lead: 'Egyetlen árforrás: ugyanezt az árat látod a foglalóban is.' })}

${konzultSzekcio(null)}
${folyamatSzekcio()}
${realitasSzekcio()}

<!-- ============ MITOL MAS ============ -->
<section class="szekcio halvany" aria-labelledby="mitol-cim">
  <div class="tartalom">
    ${szekcioFej('Mitől más a MOSAIC Hair?', 'Ahol te vagy a középpontban', '', 'mitol-cim')}
    <ul class="kartya-racs negy kicsi-kartyak">
      <li class="mini-kartya">${ik('chat')}<h3>Te vagy a középpontban</h3><p>Minden festésnél és vágásnál alaposan átbeszéljük az elképzeléseidet, és minden tudásunkkal igyekszünk kihozni a legtöbbet a vágyaidból.</p></li>
      <li class="mini-kartya">${ik('gyemant')}<h3>Minőségi hajfestékek</h3><p>Schwarzkopf, Luxoya és Fanola: tartós, természetes színek, gyönyörű őszhaj-fedés.</p></li>
      <li class="mini-kartya">${ik('level')}<h3>Ajándék fejmasszázs</h3><p>A hajmosást relaxáló fejmasszázzsal egészítjük ki, hogy a kezelés rögtön kikapcsolódással kezdődjön.</p></li>
      <li class="mini-kartya">${ik('ollo')}<h3>Tökéletes beszárítás</h3><p>A szárítás a forma és a tartás megteremtése is: napokig élvezheted a gyönyörű, életteli frizurádat.</p></li>
    </ul>
  </div>
</section>

${velemenyekSzekcio(null)}
${gyikSzekcio([['Férfi hajvágást is vállaltok?', `Igen, férfi hajvágás Bettinél és Evelinnél foglalható (${ft(ferfiVagas())}).`]])}
${helySzekcio(null)}
</main>`;
}

// ---- FODRASZ-OLDAL ---------------------------------------------------------------------------------------------------------------------------
function szakteruletKartya(fodrasz, jel) {
  const szandek = SZANDEK_JEL[jel], t = KARTYA_SZOVEG[szandek], a = szandekAdat(szandek, fodrasz);
  if (!a) return '';
  const f = FODRASZOK[fodrasz];
  let szoveg = t.szoveg, arSor = `${ft(a.tol)}-tól`;
  if (szandek === 'pothaj') arSor = `Felrakás: ${POTHAJ.felrakasTincs} Ft / tincs · Leszedés: ${ft(POTHAJ.leszedes)}`;
  if (szandek === 'cut') { const n = noiVagasTol(fodrasz), m = ferfiVagas(fodrasz); arSor = `Női: ${ft(n)}-tól${m ? ` · Férfi: ${ft(m)}` : ''}`; }
  const k = szolgFodrasz(fodrasz, szandek);
  const regi = a.regiTol && szandek !== 'pothaj' && szandek !== 'cut' ? `<s class="regi-ar">${ft(a.regiTol)}</s> ` : '';
  return `<article class="szolg-kartya vizszintes">
    <div class="szolg-kep">${kepTag(k, { sizes: '(min-width:900px) 18vw, 40vw' })}</div>
    <div class="szolg-torzs">
      <h3>${t.cim}</h3>
      <p>${szoveg}</p>
      <p class="szolg-adat"><span>${regi}${arSor}</span>${szandek === 'pothaj' ? '' : `<span class="szolg-ido">${ik('ora')}${idoSzoveg(a)}</span>`}</p>
      ${gomb(t.gomb, foglalo({ staff: fodrasz, category: szandek }), { fajta: 'korvonal', cta: 'szakterulet-' + szandek, extra: ` data-service="${szandek}" data-staff-cta="${fodrasz}"` })}
    </div>
  </article>`;
}
export function fodraszOldal(fodrasz) {
  const f = FODRASZOK[fodrasz], p = KEPEK.portre[fodrasz]();
  const masok = Object.keys(FODRASZOK).filter((k) => k !== fodrasz);
  const festek = f.festek ? `<section class="szekcio halvany" aria-labelledby="festek-cim">
  <div class="tartalom festek">
    <div class="festek-kep">${KEPEK.festek[fodrasz] ? kepTag(KEPEK.festek[fodrasz](), { sizes: '(min-width:900px) 30vw, 90vw' }) : ''}</div>
    <div>
      ${felcim('A legmagasabb minőségű hajfestékkel dolgozom')}
      <h2 id="festek-cim">${f.festek.nev}</h2>
      <p class="lead">${f.festek.szoveg}</p>
    </div>
  </div>
</section>` : '';
  const folyamat = KEPEK.folyamat[fodrasz] ? `<ul class="folyamat-kepek">${KEPEK.folyamat[fodrasz].map((k) => `<li>${kepTag(k(), { sizes: '(min-width:900px) 22vw, 45vw' })}</li>`).join('')}</ul>` : '';
  return `<main class="hl hl-fodrasz hl-${fodrasz}" id="top" data-landing="hair-${fodrasz}" data-intent="staff" data-staff="${fodrasz}">
<!-- ============ HERO ============ -->
<section class="hero hero-fodrasz">
  <div class="tartalom hero-racs">
    <div class="hero-szoveg">
      ${felcim('MOSAIC Hair · fodrász')}
      <h1>${f.nev}<span class="h1-ala">női fodrász Budapesten · Bécsi út 2.</span></h1>
      <p class="hero-alcim">${f.szakterulet}</p>
      <blockquote class="hero-idezet">„${f.idezet}”<cite>${f.teljesNev}, fodrász</cite></blockquote>
      <p class="lead">${f.rovid}</p>
      <div class="cta-sor">
        ${gomb(`${f.nev} időpontjai`, foglalo({ staff: fodrasz }), { cta: 'hero-idopontok', poz: 'hero', extra: ` data-staff-cta="${fodrasz}"` })}
        ${gomb(`Előbb konzultálnék ${f.rag.vel}`, foglalo({ staff: fodrasz, service: KONZULT }), { fajta: 'korvonal', cta: 'hero-konzultacio', poz: 'hero', extra: ' data-konzult="1"', nyilat: false })}
      </div>
      ${kovetkezo(fodrasz)}
      ${googleChip()}
      <ul class="kiemelesek">
${f.kiemelesek.map((t, i) => `        <li>${ik(['gyemant', 'szív', 'level'][i])}<span>${t}</span></li>`).join('\n')}
      </ul>
    </div>
    <figure class="hero-kep">${kepTag(p, { lazy: false, sizes: '(min-width:900px) 45vw, 100vw' })}<figcaption class="kep-cimke">MOSAIC Hair · ${f.nev}</figcaption></figure>
  </div>
</section>

<!-- ============ BEMUTATKOZAS ============ -->
<section class="szekcio" aria-labelledby="bemutat-cim">
  <div class="tartalom keskeny bemutat">
    ${felcim('Fodrászt váltani nagy döntés')}
    <h2 id="bemutat-cim">Ingyenes konzultációval várlak</h2>
${f.bemutatkozas.map((t) => `    <p class="lead">${t}</p>`).join('\n')}
    <p class="alairas">${f.teljesNev}<span>fodrász</span></p>
    <p class="cta-sor">${gomb('Ingyenes konzultáció', foglalo({ staff: fodrasz, service: KONZULT }), { fajta: 'korvonal', cta: 'bemutat-konzultacio', extra: ' data-konzult="1"' })}</p>
  </div>
</section>

<!-- ============ SZAKTERULETEK ============ -->
<section class="szekcio halvany" id="szakteruletek" aria-labelledby="szakter-cim">
  <div class="tartalom">
    ${szekcioFej(`${f.nev} specializációi`, 'Azok a szolgáltatások, amelyekben a legjobban tudok segíteni', 'Az árak már a foglalóban látható árak.', 'szakter-cim')}
    <div class="kartya-racs ketto">
${f.szakteruletek.map((j) => szakteruletKartya(fodrasz, j)).join('\n')}
    </div>
  </div>
</section>

${galeriaSzekcio(fodrasz, { felc: `${f.nev} munkái`, cim: 'Valódi vendégek, valódi eredmények', lead: `Minden kép ${f.nev} vendégének hajáról készült.`, db: 8 })}
${folyamat ? `<section class="szekcio"><div class="tartalom">${felcim('Munka közben')}${folyamat}</div></section>` : ''}
${arSzekcio(fodrasz, { felc: 'Szolgáltatások és árak', cim: `${f.nev} árlistája`, lead: 'Hajhossz szerint, ugyanazokkal az árakkal, mint a foglalóban.' })}
${velemenyekSzekcio(fodrasz)}

<!-- ============ MIERT ============ -->
<section class="szekcio" aria-labelledby="miert-cim">
  <div class="tartalom">
    ${szekcioFej('Miért érdemes?', `Miért válaszd ${f.rag.t}?`, '', 'miert-cim')}
    <ul class="kartya-racs harom kicsi-kartyak">
${f.miert.map(([c, sz], i) => `      <li class="mini-kartya">${ik(['chat', 'gyemant', 'level'][i])}<h3>${c}</h3><p>${sz}</p></li>`).join('\n')}
    </ul>
  </div>
</section>

${festek}

<!-- ============ FOGLALAS ============ -->
<section class="szekcio sotet" id="foglalas" aria-labelledby="foglalas-cim">
  <div class="tartalom foglalo-doboz">
    ${felcim('Időpontfoglalás')}
    <h2 id="foglalas-cim">Foglalj időpontot ${f.rag.hez}</h2>
    <p class="lead">Válaszd ki a számodra megfelelő időpontot, és tedd meg az első lépést a gyönyörű haj felé. A foglalóban ${f.nev} saját szabad időpontjait látod.</p>
    <p class="cta-sor kozepre">${gomb(`${f.nev} elérhető időpontjai`, foglalo({ staff: fodrasz }), { cta: 'foglalas-doboz', poz: 'foglalas', extra: ` data-staff-cta="${fodrasz}"` })}${gomb('Ingyenes konzultáció', foglalo({ staff: fodrasz, service: KONZULT }), { fajta: 'vilagos', cta: 'foglalas-konzultacio', poz: 'foglalas', extra: ' data-konzult="1"', nyilat: false })}</p>
  </div>
</section>

${gyikSzekcio(f.gyik, { felc: 'Gyakori kérdések', cim: 'Ami még a foglalás előtt felmerülhet' }, fodrasz)}

<!-- ============ MAS FODRASZOK ============ -->
<section class="szekcio halvany" aria-labelledby="masok-cim">
  <div class="tartalom">
    ${szekcioFej('Ismerd meg a többieket is', 'A MOSAIC Hair fodrászai', '', 'masok-cim')}
    <ul class="masok">
${masok.map((k) => { const m = FODRASZOK[k], pk = KEPEK.portre[k](); return `      <li><a href="${oldalUt(k)}" data-cta="masik-fodrasz-${k}">${kepTag(pk, { sizes: '90px', cls: 'mas-kep' })}<span><b>${m.nev}</b><small>${m.szakterulet}</small></span>${ik('jobb')}</a></li>`; }).join('\n')}
      <li><a href="${oldalUt('kozpont')}" data-cta="vissza-kozpont"><span class="mas-ikon">${ik('naptar')}</span><span><b>Minden szolgáltatás és fodrász</b><small>A MOSAIC Hair női fodrászata</small></span>${ik('jobb')}</a></li>
    </ul>
  </div>
</section>

${helySzekcio(fodrasz)}
</main>`;
}

export const sablonSegedek = { sticky, esc, kepTag };
