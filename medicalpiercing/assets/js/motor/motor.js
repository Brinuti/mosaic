// Medical Piercing foglalomotor - a helyben nyilo foglalo (a MOSAIC Booking Engine MP-adaptacioja).
//
// Lepesek: helyszin -> szolgaltatas -> idopont (havi naptar, szakember) -> a Salonic beagyazott adatlapja -> koszonooldal.
// A foglalast a Salonic adatlapja rogziti (reCAPTCHA mogott); a motor csak olvas a Salonicbol (salonic-adapter.js).
// Sikeres foglalas utan a Salonic a keretben a koszonooldalra (www.medicalpiercing.hu/foglalas-ok*, a divat fulpiercingnel /fulbevalo-ok*) iranyit; az ott futo
// suti.js jelez a motornak, a motor pedig UGYANAZT a koszonooldalt UGYANAZOKKAL a parameterekkel, plusz booking_id-vel,
// a fo ablakban nyitja meg: a meres (Google, Meta, TikTok, GA4, a sajat szerveres meres) pontosan ugy fut, mint a regi uton.
//
// Az URL a foglalo hasznalata alatt nem valtozik (nincs history.pushState): a GTM History Change triggerei igy nem
// kuldenek felesleges oldalmegtekintest. Bezaras: X gomb; vissza: a lepesjelzo / a "Vissza" gomb.
// Hiba eseten (a Salonic nem valaszol, nincs szolgaltatas): a vendeg a Salonic eredeti foglalojat kapja (tartalek-link).
import { createSalonicAdapter, HELYSZINEK, HELYSZIN_SORREND, ANY_STAFF, HOST } from './salonic-adapter.js';
import { createBookingContext } from './booking-id.js';
import { tipusKod } from './tipus.js';

const TOVABB = /^(fbclid|gclid|gbraid|wbraid|ttclid|utm_[a-z_]+)$/i;
const KOSZONO_ORIGIN = /^https:\/\/(www\.)?medicalpiercing\.hu$/;
const NAPOK = 100; // a Salonic ~65-80 napra elore ad idopontot (2026-10-11: legtavolabbi 80 nap); 100 nap bortonosen mindet lefedi
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const NAP_ROVID = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const NAP_NEV = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

const adapter = createSalonicAdapter({ storage: (() => { try { return window.sessionStorage; } catch (e) { return null; } })() });
const foglalas = createBookingContext({ storage: (() => { try { return window.sessionStorage; } catch (e) { return null; } })() });

// --- segedek ------------------------------------------------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ft = (n) => (n === null || n === undefined ? '' : n.toLocaleString('hu-HU').replace(/\s/g, '.') + ' Ft');
// a budapesti ido (a Salonic idopontjai unix mp-ben; a vendeg Magyarorszagon van, de a gep ideje mas lehet)
// EU-szabaly: a nyari ido (CEST, UTC+2) marcius utolso vasarnapjan 01:00 UTC-tol oktober utolso vasarnapjan 01:00 UTC-ig tart, egyebkent CET (UTC+1).
// (Szamolt, nem Intl: a naptar tobb ezer idopontra hivja minden kattintaskor; az Intl-es valtozat ~50 us / hivas volt. Egyezes az Intl-lel: tools/motor-bp-teszt.mjs.)
const DST = {};
const utolsoVasarnap = (ev, ho) => { const u = new Date(Date.UTC(ev, ho + 1, 0)); return Date.UTC(ev, ho, u.getUTCDate() - u.getUTCDay(), 1) / 1000; };
const nyariIdo = (unix) => { const ev = new Date(unix * 1000).getUTCFullYear(); const h = DST[ev] || (DST[ev] = [utolsoVasarnap(ev, 2), utolsoVasarnap(ev, 9)]); return unix >= h[0] && unix < h[1]; };
const k2 = (n) => (n < 10 ? '0' + n : '' + n);
const bp = (unix) => {
  const t = new Date((unix + (nyariIdo(unix) ? 7200 : 3600)) * 1000);
  const ev = t.getUTCFullYear(), ho = t.getUTCMonth() + 1, d = t.getUTCDate();
  return { nap: `${ev}-${k2(ho)}-${k2(d)}`, ido: `${k2(t.getUTCHours())}:${k2(t.getUTCMinutes())}`, ev, ho, d };
};
// az idopont budapesti napja / ideje egyszer szamolva (a cache-elt idopont-objektumon marad, igy a naptar-ujrarajzolasok olcsok)
const sb = (x) => x._b || (x._b = bp(x.start_unix));
const napCim = (nap) => { const [e, h, d] = nap.split('-').map(Number); const w = new Date(Date.UTC(e, h - 1, d)).getUTCDay(); return `${HONAP[h - 1]} ${d}., ${NAP_NEV[w]}`; };
const gtagEsemeny = (nev, param) => { try { if (typeof window.gtag === 'function') window.gtag('event', nev, { send_to: 'G-SJT2RN62H8', ...param }); } catch (e) { /* a meres nem allithatja meg a foglalast */ } };

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.fatyol { position: fixed; inset: 0; z-index: 2147483000; background: rgba(39, 40, 52, .55); display: flex; align-items: center; justify-content: center; font-family: 'helvetica-w01-light', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #454659; }
.ablak { background: #fff; width: min(620px, 100vw); height: min(860px, 100dvh); display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; box-shadow: 0 18px 60px rgba(0,0,0,.25); }
@media (max-width: 700px) { .ablak { width: 100vw; height: 100dvh; border-radius: 0; } }
@media (min-width: 701px) { .hely-racs { grid-template-columns: repeat(3, 1fr); } .szolg-racs { grid-template-columns: 1fr 1fr; } .os-szolg { font-size: 14px; } }
@media (max-width: 700px) { .lepesek .sz { display: none; } }
button, a { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
/* fejlec: a cim KOZEPEN, a vissza (balra) es a bezaras (jobbra) 44 px-es, ujjal kenyelmesen talalhato; a vissza gomb helye az elso lepesnel is megmarad (a cim kozepen marad) */
.fej { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid #ece7e6; background: #fff; }
.fej h2 { margin: 0; text-align: center; font: 600 18px/1.25 'poppins-semibold', Poppins, Arial, sans-serif; }
.gomb-ikon { border: 0; background: #f6efee; color: #454659; width: 44px; height: 44px; border-radius: 50%; font-size: 22px; line-height: 44px; padding: 0; cursor: pointer; flex: none; }
.gomb-ikon[hidden] { display: block; visibility: hidden; }
.gomb-ikon:hover { background: #f5d3ca; }
/* lepesjelzo: a teljes sav (min. 44 px magas) kattinthato, nem csak a felirat */
.lepesek { display: flex; gap: 6px; padding: 0 16px; font-size: 12px; }
.lepesek button { flex: 1 1 auto; min-height: 44px; border: 0; background: none; padding: 15px 0 9px; border-bottom: 3px solid #ece7e6; color: #9a9aa8; font: inherit; cursor: default; text-align: left; white-space: nowrap; }
.lepesek button.kesz { border-color: #d7aba8; color: #454659; cursor: pointer; }
.lepesek button.most { border-color: #ab6354; color: #454659; font-weight: 700; }
.tartalom { flex: 1; overflow: auto; padding: 14px 16px; -webkit-overflow-scrolling: touch; outline: none; }
.osszegzes { background: #faf4f3; border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; font-size: 14px; line-height: 1.4; }
.osszegzes b { font-family: 'poppins-semibold', Poppins, Arial, sans-serif; font-weight: 600; }
.os-sor { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.os-ar { font-weight: 700; color: #ab6354; white-space: nowrap; }
.os-ar s.athuzott { margin-right: 4px; font-weight: 400; color: #9a9aa8; }
/* a szolgaltatas neve MINDIG egy sorban (a betumeret a kepernyo szelessegehez igazodik; vegso esetben kipontozva) */
.os-szolg { font-size: clamp(11px, 3.5vw, 14px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lista { display: grid; gap: 10px; }
.kartya { display: block; width: 100%; text-align: left; border: 1px solid #e8e6e6; border-radius: 12px; background: #fff; padding: 13px 14px; font: inherit; color: inherit; cursor: pointer; }
.kartya:hover, .kartya:focus-visible { border-color: #d7aba8; box-shadow: 0 0 0 3px #f5d3ca; outline: none; }
.kartya .nev { font: 600 16px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; }
.kartya .reszlet { margin-top: 3px; font-size: 13px; color: #6b6c80; }
.kartya .ar { float: right; font-weight: 700; color: #ab6354; margin-left: 10px; }
/* 1. lepes: az osszes helyszin egy kepernyon (mobilon 2 oszlop, asztalon 3), felirat nelkul */
.kicsi.bevezeto { margin: 0 0 10px; }
.hely-racs { grid-template-columns: 1fr 1fr; gap: 8px; }
.kartya.hely { display: flex; align-items: center; height: clamp(44px, 7dvh, 56px); padding: 0 12px; border-radius: 10px; }
.kartya.hely .nev { font-size: 15px; }
.kartya.hely .terkep { flex: none; width: auto; height: 26px; margin-right: 9px; }
.ikon { flex: none; width: 20px; height: 20px; object-fit: contain; }
.kartya.szolg .nev { display: flex; align-items: center; gap: 6px; }
/* 2. lepes: TOMOR szolgaltatas-sorok. Mobilon egysoros (nev + ar), hogy a lista a lehetosegek szerint egy kepernyore keruljon; asztalon 2 oszlop,
   ar + idotartam jobbra. Az akcios szolgaltatasok (3 piercing, 2 piercing, ket szemelynek) athuzott arral */
.szolg-racs { gap: 2px; }
.kartya.szolg { display: grid; grid-template-columns: 1fr auto; grid-template-areas: "nev ar"; column-gap: 8px; align-items: center; min-height: 28px; padding: 1px 9px; border-radius: 8px; }
.kartya.szolg .nev { grid-area: nev; font-size: clamp(11px, 3.1vw, 12.5px); line-height: 1.12; }
.kartya.szolg .ar { grid-area: ar; float: none; margin: 0; text-align: right; font-size: clamp(11.5px, 3.3vw, 13px); white-space: nowrap; }
.kartya.szolg .ar s { margin-right: 6px; font-weight: 400; color: #9a9aa8; }
.kartya.szolg .reszlet { display: none; }
.kartya.szolg.akcios { border-color: #d7aba8; background: #fff8f6; }
.cimke { display: inline-block; margin-top: 6px; font-size: 12px; background: #f5d3ca; color: #78463e; border-radius: 99px; padding: 2px 9px; }
.alcim { margin: 18px 0 8px; font: 600 14px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; color: #6b6c80; text-transform: uppercase; letter-spacing: .04em; }
.chipek { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #e8e6e6; background: #fff; border-radius: 99px; padding: 3px 13px 3px 3px; font: inherit; font-size: 14px; cursor: pointer; color: inherit; }
.chip .fejkep { flex: none; width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: #f0e6e4; color: #78463e; display: inline-flex; align-items: center; justify-content: center; font: 600 11px/1 'poppins-semibold', Poppins, Arial, sans-serif; }
.chip .fejkep img { display: block; width: 100%; height: 100%; object-fit: cover; }
.chip.valasztott .fejkep { box-shadow: 0 0 0 2px #fff; }
.chip.egy { cursor: default; }
@media (max-width: 700px) {
  .chipek { gap: 5px; }
  .chip { gap: 4px; padding: 2px 8px 2px 2px; font-size: 13px; }
  .chip .fejkep { width: 24px; height: 24px; font-size: 10px; }
  .kartya.szolg .ar s { font-size: .8em; margin-right: 3px; }
}
.chip.valasztott { background: #454659; color: #fff; border-color: #454659; }
.honap-fej { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 8px; font: 600 16px/1 'poppins-semibold', Poppins, Arial, sans-serif; }
.racs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
.racs .fejnap { font-size: 12px; color: #9a9aa8; padding: 4px 0; }
.nap { border: 0; background: none; height: 42px; border-radius: 10px; font: inherit; font-size: 15px; color: #c5c5ce; cursor: default; }
.nap.van { background: #faf0ee; color: #454659; font-weight: 700; cursor: pointer; }
.nap.van:hover { background: #f5d3ca; }
.nap.valasztott { background: #ab6354; color: #fff; }
.idok { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; margin-top: 10px; }
.ido { border: 1px solid #d7aba8; background: #fff; border-radius: 10px; padding: 10px 0; font: 600 15px/1 'poppins-semibold', Poppins, Arial, sans-serif; color: #454659; cursor: pointer; }
.ido:hover, .ido:focus-visible { background: #d7aba8; color: #fff; outline: none; }
.gomb { display: inline-block; border: 0; border-radius: 99px; background: #d7aba8; color: #fff; padding: 12px 22px; font: 600 15px/1 'poppins-semibold', Poppins, Arial, sans-serif; cursor: pointer; text-decoration: none; }
.gomb.masodlagos { background: #f6efee; color: #454659; }
.uzenet { padding: 18px 4px; line-height: 1.5; }
.toltes { padding: 30px 0; text-align: center; color: #6b6c80; }
.toltes::before { content: ''; display: block; width: 28px; height: 28px; margin: 0 auto 10px; border: 3px solid #f5d3ca; border-top-color: #ab6354; border-radius: 50%; animation: forog .8s linear infinite; }
@keyframes forog { to { transform: rotate(360deg); } }
iframe.adatlap { width: 100%; height: 100%; border: 0; display: block; }
.adatlap-burok { margin: 0 -16px -16px; }
/* adatlap: a Salonic-keret kitolti a maradek helyet (a hosszabb tartalom a keretben gorget). Mobilon a lepesjelzo, az osszegzes es a
   sugo rejtve (a fejlec a helyszint mutatja, a vissza gomb az idopontokhoz visz): ha a Salonic-fiok betolti az MP stiluslapjat
   (assets/salonic/mp.css), az adatlap a "Foglalas elkuldese" gombbal egyutt egy kepernyore fer, gorgetes nelkul. */
.ablak[data-lepes="adatlap"] .tartalom { display: flex; flex-direction: column; overflow: hidden; }
.ablak[data-lepes="adatlap"] .adatlap-burok { flex: 1; min-height: 0; }
/* ha a Salonic-fiok betolti az MP stiluslapjat, a Salonic tomor osszegzoje (kezeles, nap, ido, ar) es a fejlec (helyszin) eleg: asztalon is */
.ablak[data-lepes="adatlap"][data-stilus="1"] .osszegzes, .ablak[data-lepes="adatlap"][data-stilus="1"] .adatlap-sugo { display: none; }
@media (max-width: 700px) {
  .ablak[data-lepes="adatlap"] .lepesek, .ablak[data-lepes="adatlap"] .osszegzes, .ablak[data-lepes="adatlap"] .adatlap-sugo { display: none; }
  .ablak[data-lepes="adatlap"] .tartalom { padding: 0; }
  .ablak[data-lepes="adatlap"] .adatlap-burok { margin: 0; }
  .ablak[data-lepes="adatlap"] .fej { padding: 10px 12px; }
}
/* 0. lepes: mire foglalsz? (a foglalo fo oldala: 4 szolgaltatas). Az urlapos opciok (kontroll / ekszercsere / garancia) NEM naptarbol foglalnak */
.ablak[data-lepes="tipus"] .lepesek { display: none; }
.tipus-racs { grid-template-columns: 1fr; gap: 10px; }
.kartya.tipus { padding: 14px 16px; border-radius: 12px; }
.kartya.tipus .nev { display: block; font-size: 17px; }
.kartya.tipus .reszlet { margin-top: 3px; font-size: 13px; }
@media (min-width: 701px) { .tipus-racs { grid-template-columns: 1fr 1fr; } .ablak[data-lepes="tipus"] { height: auto; }
  .szolg-racs { gap: 6px; }
  .kartya.szolg { padding: 7px 12px; border-radius: 10px; }
  .kartya.szolg .nev, .kartya.szolg .ar { font-size: 14px; }
  .ikon { width: 28px; height: 28px; }
  .kartya.hely .terkep { height: 30px; }
  .kartya.szolg .ar s { display: block; margin: 0; font-size: 12px; } }
/* visszahivas-kero urlap (kontroll / ekszercsere / garancia): ugyanaz az urlap es vegpont (/api/urlap), mint a regi /kontroll oldalon.
   TOMOR: asztalon sehol nem logki (2 oszlop), mobilon egy kepernyore torekszik (mint a Salonic-adatlap: nincs lepesjelzo, kisebb fejlec,
   a ket rovid mezo - datum, varos - egymas mellett, rovid kepfeltoltes-felirat) */
.urlap-fej { margin: 0 0 8px; font-size: 13px; line-height: 1.35; }
.urlap { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; position: relative; }
.urlap .mezo { grid-column: 1 / -1; min-width: 0; }
.urlap .mezo.m-fel { grid-column: auto; }
.mezo .cimke-szoveg { display: block; margin: 0 0 2px; font: 600 12px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; }
.mezo input, .mezo select, .mezo textarea { width: 100%; font: inherit; font-size: 16px; line-height: 1.3; padding: 7px 10px; border: 1px solid #d9d4d3; border-radius: 8px; background: #fff; color: #454659; }
.mezo input[type="file"] { padding: 4px 8px; font-size: 13px; }
.mezo textarea { min-height: 54px; resize: vertical; }
.mezo input:focus, .mezo select:focus, .mezo textarea:focus { outline: none; border-color: #ab6354; box-shadow: 0 0 0 3px #f5d3ca; }
.mezo .hiba-uzenet { display: none; margin-top: 2px; font-size: 11.5px; line-height: 1.25; color: #b3261e; }
.mezo.hibas input, .mezo.hibas select, .mezo.hibas textarea { border-color: #b3261e; }
.mezo.hibas .hiba-uzenet { display: block; }
.tel-sor { display: grid; grid-template-columns: minmax(96px, 34%) 1fr; gap: 8px; }
.cimke-szoveg .rovid { display: none; }
.csapda { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.urlap .gomb, .urlap .kuld-uzenet { grid-column: 1 / -1; }
.gomb.teljes { width: 100%; padding: 11px 22px; font-size: 15px; }
.gomb[disabled] { opacity: .6; cursor: default; }
.kuld-uzenet { min-height: 16px; text-align: center; font-size: 13px; color: #6b6c80; }
.kuld-uzenet.hiba { color: #b3261e; }
@media (max-width: 700px) {
  .ablak[data-lepes="urlap"] .lepesek, .ablak[data-lepes="tipus"] .lepesek { display: none; }
  .ablak[data-lepes="urlap"] .fej { padding: 4px 10px; }
  .ablak[data-lepes="urlap"] .tartalom { padding: 10px 14px 12px; }
  .cimke-szoveg .hosszu { display: none; } .cimke-szoveg .rovid { display: inline; }
  .ablak[data-lepes="szolg"] .osszegzes { padding: 4px 10px; margin-bottom: 6px; font-size: 13px; line-height: 1.3; }
}
@media (max-width: 359px) {
  .urlap .mezo.m-fel { grid-column: 1 / -1; }
  .urlap { gap: 6px; }
  .urlap-fej { margin-bottom: 4px; font-size: 12.5px; line-height: 1.3; }
  .mezo input, .mezo select, .mezo textarea { padding: 5px 9px; }
  .mezo textarea { min-height: 44px; }
  .mezo .cimke-szoveg { margin-bottom: 1px; }
}
@media (min-width: 701px) {
  .urlap { column-gap: 12px; row-gap: 10px; }
  .urlap .mezo.d-fel { grid-column: auto; }
  .mezo input, .mezo select, .mezo textarea { padding: 8px 12px; }
}
.kicsi { font-size: 13px; color: #6b6c80; }
.kicsi.tovabbi { margin: -4px 0 6px; text-align: center; font-size: 12px; }
`;

// A foglalo fo oldala: mire foglalsz? (a regi koztes oldal, /idopontfoglalas, 4 kartyaja). Az uj piercing a naptaras utat inditja
// (helyszin -> piercing -> idopont -> Salonic-adatlap); a tobbi urlapos (visszahivas-kero), nincs naptar.
const TIPUSOK = [
  { kod: 'uj', nev: 'Új piercing', leiras: '1 vagy több piercing behelyezése' },
  { kod: 'kontroll', nev: 'Kontroll', leiras: 'Nézzünk rá a meglévő piercingeidre?' },
  { kod: 'ekszercsere', nev: 'Ékszercsere', leiras: 'Cseréljük ki újra vagy szilikonra?' },
  { kod: 'garancia', nev: 'Garancia', leiras: 'Letelt a 6 hét és szúrjunk megerősítőt?' },
];
// "Mire kérsz időpontot?" - a regi /kontroll legordulo 6 lehetosege (a szoveg valtozatlan: ez kerul a szalon e-mailjebe), tipusonkent
const LEHETOSEG = {
  kontroll: ['Kontroll - Meglévő vendégeknek - 0 Ft', 'Konzultáció - Új vendégeknek - 5.000 Ft', 'Sebkezelés / Tisztítás  - 2.000 Ft'],
  ekszercsere: ['Ékszer csere - Nálunk vásárolt ékszerrel - 5.000 Ft', 'Ékszer csere - Hozott ékszerrel - 2.000 Ft'],
  garancia: ['Garanciális szúrás - 5.000 Ft'],
};
// az urlap kotelezo mezoi: nev -> [tipus, hibauzenet] (a regi /kontroll urlap szabalyai)
const URLAP_KOTELEZO = {
  nev: ['sor', 'Add meg a neved.'], tel: ['telefon', 'Add meg a telefonszámot.'],
  email: ['email', 'Add meg az e-mail-címet (például pelda@webhelyem.com).'], mikor: ['datum', 'Válassz dátumot.'],
  varos: ['sor', 'Írd be a választ.'], miben: ['szoveg', 'Írd be a választ.'],
};
// Az "eredeti" (athuzott) ar: a Salonic NEM adja (csak az aktualis ar van: data-price), ezert a weboldal arlistaja szerinti listaarakat tartjuk itt
// (a fooldal / arlista oldalak "X Ft helyett Y Ft" jelzesei: 1 db 27.900, 2 db 55.800, 3 db 83.700, 4 db 111.600, 6 db 167.400 Ft; 27.900 Ft / piercing).
// [nev-minta, eredeti ar Ft]; a nem szereplo szolgaltatasnak (1+1 allergia, fulbevalo) nincs athuzott ara. A "korabbi ar" jelzesre fogyasztovedelmi szabalyok vonatkoznak:
// csak olyan listaar kerulhet ide, amit a weboldal is hirdet. Ha a Salonic-szolgaltatas neveben "X Ft helyett" van, azt a motor magatol felveszi (listPrice).
const EREDETI_AR = [[/3 PIERCING/i, 83700], [/2 PIERCING/i, 55800], [/2 szem\S*ynek\s*[-–]\s*2 db/i, 55800], [/2 szem\S*ynek\s*[-–]\s*4 db/i, 111600], [/2 szem\S*ynek\s*[-–]\s*6 db/i, 167400], [/^1 db (?!f\S*lbeval)/i, 27900]];
const eredetiAr = (s) => { const t = EREDETI_AR.find(([re]) => re.test(s.name)); return t ? t[1] : s.listPrice || null; };
// a csapat tagjai (a fooldal csapat-szekcioja szerinti beceneven, fejkeppel): a Salonic-nev -> becenev, kep (assets/img/csapat/)
const ekezetNelkul = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const CSAPAT = [[/kamilli\s+viktoria/, 'Viki', 'viki'], [/kovacs\s+gabriella/, 'Gabi', 'gabi'], [/nagy\W*marko\s+fanni/, 'Fanni', 'fanni'], [/kovacs\s+richard/, 'Ricsi', 'ricsi'], [/mester\s+brigitta/, 'Brigi', 'brigi']];
const csapattag = (nev) => {
  const t = CSAPAT.find(([re]) => re.test(ekezetNelkul(nev)));
  const szavak = String(nev || '').trim().split(/\s+/).filter((x) => /\p{L}/u.test(x));
  return t ? { rovid: t[1], kep: `/assets/img/csapat/${t[2]}.webp` } : { rovid: szavak[szavak.length - 1] || String(nev), kep: null, kezdo: (szavak[szavak.length - 1] || String(nev) || '?')[0].toUpperCase() };
};
// a szakember-csempe tartalma: kis kerek fejkep (vagy monogram) + becenev
const szakemberJel = (nev) => { const t = csapattag(nev); return `<span class="fejkep" aria-hidden="true">${t.kep ? `<img src="${t.kep}" alt="" width="28" height="28" loading="lazy">` : esc(t.kezdo)}</span><span>${esc(t.rovid)}</span>`; };
// szolgaltatas-ikonok (assets/img/ikon/<kod>.webp, AI-val generalt csomag): a piercing tipus-kodja szerint; a csomagok sajat ikont kapnak, a tobbinek nincs
const IKONOS = new Set(['mi', 'sh', 'kl', 'sl', 'al', 'mj', 'vb', 'lp', 'pm', 'divat']);
const ikonKod = (s) => (/szem\S*ynek/i.test(s.name) ? 'ketto' : /3 PIERCING|2 PIERCING|harmadik|f\S*laron/i.test(s.name) ? 'akcio' : IKONOS.has(tipusKod(s.name)) ? tipusKod(s.name) : null);
const szolgIkon = (s) => { const k = ikonKod(s); return k ? `<img class="ikon" src="/assets/img/ikon/${k}.webp" alt="" width="22" height="22" decoding="async">` : ''; };
// a Salonic-nevben levo emoji (lang, ket szemely) helyett az ikon latszik
const szepNev = (n) => String(n || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
let orszagLista = [['HU', 'HUN', 'Magyarország', '+36']];
const orszagokBetolt = () => fetch('/assets/data/orszagok.json').then((v) => v.json()).then((d) => { if (d && Array.isArray(d.orszagok) && d.orszagok.length) orszagLista = d.orszagok; return orszagLista; }).catch(() => orszagLista);

let nyitott = null;

/**
 * A foglalo megnyitasa. ctx: { placeId?, employeeId?, serviceId?, specId?, oldalTipus, link (a kattintott Salonic-link), forras (oldal utvonala) }.
 */
export function nyit(ctx) {
  if (nyitott) nyitott.bezar();
  const host = document.createElement('div');
  host.setAttribute('data-mp-motor', '');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${CSS}</style><div class="fatyol" role="dialog" aria-modal="true" aria-label="Időpontfoglalás"><div class="ablak"><div class="fej"><button class="gomb-ikon" data-vissza aria-label="Vissza" hidden>‹</button><h2>Időpontfoglalás</h2><button class="gomb-ikon" data-bezar aria-label="Bezárás">×</button></div><div class="lepesek"></div><div class="tartalom" tabindex="-1"></div></div></div>`;
  document.body.appendChild(host);
  const elozoOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  // A mobil lapok (Wix-minta) rogzitett 320 px-es nezetszelesseggel epulnek, amit a telefon felnagyit: a motor (es benne a Salonic-
  // adatlap) igy csak 320 x ~590 CSS-pixelt kapna. Amig a motor nyitva van, a valodi eszkozszelesseget adjuk (a teljes kepernyos
  // motor alatt a lap nem latszik); bezaraskor visszaallitjuk.
  const nezet = document.querySelector('meta[name="viewport"]');
  const nezetEredeti = nezet ? nezet.getAttribute('content') : null;
  if (nezet && /width=320\b/.test(nezetEredeti || '')) nezet.setAttribute('content', 'width=device-width, initial-scale=1');
  const $ = (s) => shadow.querySelector(s);
  const tartalom = $('.tartalom');
  const link = (() => { try { return new URL(ctx.link || HOST + '/selectLocation'); } catch (e) { return new URL(HOST + '/selectLocation'); } })();
  // a Salonic-adatlap a Google-kattintasazonositot nem kapja meg (klon.js: GOOGLE_KATT); a koszonooldal (sajat tartomany) igen, lent
  const GOOGLE_KATT = /^(gclid|gbraid|wbraid)$/i;
  const tovabbi = [...link.searchParams].filter(([k]) => TOVABB.test(k) && !GOOGLE_KATT.test(k));
  const googleKatt = [...new URLSearchParams(location.search)].filter(([k, v]) => GOOGLE_KATT.test(k) && /^[A-Za-z0-9_-]{8,512}$/.test(v));
  const all = {
    lepes: 'hely', placeId: HELYSZINEK[ctx.placeId] ? +ctx.placeId : null, serviceId: ctx.serviceId || null,
    staffId: ctx.employeeId ? String(ctx.employeeId) : null, nap: null, honap: null, slotok: null, szolg: null, bookingId: null, expected: null,
    tipus: null, urlapAdat: null, merve: !ctx.merjen,
  };
  const ctxFoglalas = foglalas.begin({ business: 'mp', source_page: ctx.forras || location.pathname });
  all.bookingId = ctxFoglalas.id;
  // belepes: a foglalo fo oldala a tipus-valaszto. Kozvetlenul a naptaras (uj piercing) utra lep, ha a link mar konkret helyszint /
  // szolgaltatast / szakembert ad, vagy a kattintott oldal egy konkret piercingrol szol (ott a vendeg mar tudja, mire foglal)
  const kozvetlen = !!(all.placeId || all.serviceId || all.staffId) || (!!ctx.oldalTipus && ctx.oldalTipus !== 'alt');
  if (ctx.tipusLepes || !kozvetlen) all.lepes = 'tipus'; else { all.tipus = 'uj'; if (ctx.merjen) setTimeout(() => meres(), 0); }
  let lezart = false;

  const tartalek = () => {
    // a Salonic eredeti foglaloja, ugyanazzal a cimmel, amire a vendeg kattintott
    return `<p class="uzenet">Most nem sikerült betölteni a foglalót. A foglalást a Salonic oldalán is el tudod végezni:</p><p><a class="gomb" href="${esc(link.href)}" target="_blank" rel="noopener">Tovább a foglaláshoz</a></p>`;
  };
  const hiba = (ok, e) => {
    gtagEsemeny('motor_hiba', { hiba_tipus: ok });
    try { console.warn('[mp-motor]', ok, e && (e.code || e.message)); } catch (x) { /* */ }
    tartalom.innerHTML = tartalek();
  };

  // --- lepesjelzo ---
  const LEPESEK_UJ = [['tipus', 'Szolgáltatás'], ['hely', 'Helyszín'], ['szolg', 'Piercing'], ['ido', 'Időpont'], ['adatlap', 'Adatok']];
  const LEPESEK_URLAP = [['tipus', 'Szolgáltatás'], ['urlap', 'Adatok']];
  const lepesek = () => (all.tipus && all.tipus !== 'uj' ? LEPESEK_URLAP : LEPESEK_UJ);
  const lepesjelzo = () => {
    const i = lepesek().findIndex(([k]) => k === all.lepes);
    $('.lepesek').innerHTML = lepesek().map(([k, n], j) => `<button data-lepes="${k}" class="${j < i ? 'kesz' : j === i ? 'most' : ''}" ${j < i ? '' : 'tabindex="-1"'}><span class="sz">${j + 1}. </span>${n}</button>`).join('');
    $('[data-vissza]').hidden = i <= 0;
    $('.ablak').dataset.lepes = all.lepes;
    const h = all.lepes === 'adatlap' && all.placeId && HELYSZINEK[all.placeId];
    $('.fej h2').textContent = h ? `${h.varos} · Adatok` : 'Időpontfoglalás';
  };
  const ugrik = (lepes) => { all.lepes = lepes; rajzol(); };
  // visszalepes (lepesjelzo, "Vissza" gomb, "Masik ..." gombok): a cel lepes utani valasztasokat eldobja. A "Vissza" gomb korabban a
  // helyszin-valasztasig nem jutott el (a megmaradt helyszin miatt a rajzol() azonnal visszaugrott a szolgaltatasokhoz).
  const visszaLep = (lepes) => {
    if (lepes === 'tipus') { all.tipus = null; all.placeId = null; all.szolg = null; all.slot = null; all.nap = null; all.honap = null; }
    if (lepes === 'hely') { all.placeId = null; all.szolg = null; all.slot = null; all.nap = null; all.honap = null; }
    if (lepes === 'szolg') { all.szolg = null; all.slot = null; all.nap = null; all.honap = null; }
    if (lepes === 'ido') { all.slot = null; }
    ugrik(lepes);
  };
  const vissza = () => {
    const i = lepesek().findIndex(([k]) => k === all.lepes);
    if (i > 0) visszaLep(lepesek()[i - 1][0]);
  };

  const osszegzes = () => {
    const h = all.placeId && HELYSZINEK[all.placeId];
    const s = all.szolg;
    const sor = [];
    if (h) sor.push(`<div class="os-sor"><span><b>${esc(h.varos)}</b>${s && s.durationMin ? `<span class="kicsi"> · ${s.durationMin} perc</span>` : ''}</span>${s ? `<span class="os-ar">${eredetiAr(s) ? `<s class="athuzott">${ft(eredetiAr(s))}</s> ` : ''}${ft(s.activePrice)}</span>` : ''}</div>`);
    if (s) sor.push(`<div class="os-szolg" title="${esc(szepNev(s.name))}">${esc(szepNev(s.name))}</div>`);
    if (all.slot) sor.push(`<div>${napCim(bp(all.slot.start_unix).nap)}, <b>${bp(all.slot.start_unix).ido}</b></div>`);
    return sor.length ? `<div class="osszegzes">${sor.join('')}</div>` : '';
  };

  // --- 0. mire foglalsz? (a foglalo fo oldala) ---
  function tipusLepes() {
    tartalom.innerHTML = `<p class="kicsi bevezeto">Mire szeretnél időpontot foglalni?</p><div class="lista tipus-racs">${TIPUSOK.map((t) => `<button class="kartya tipus" data-tipus="${t.kod}"><span class="nev">${esc(t.nev)}</span><div class="reszlet">${esc(t.leiras)}</div></button>`).join('')}</div>`;
  }
  // a foglalasindulas merese (TikTok InitiateCheckout + GA4 foglalas_inditasa) a suti.js-ben: Salonic-linkre kattintaskor ott fut; ha a motor
  // belso linkrol (/idopontfoglalas, /kontroll) vagy a lapbetoltesen nyilt, az "Uj piercing" valasztasakor itt (ugyanaz az esemeny, egyszer)
  const meres = () => {
    if (all.merve) return;
    all.merve = true;
    try { if (window.mpSuti && typeof window.mpSuti.foglalasInditas === 'function') window.mpSuti.foglalasInditas(); } catch (e) { /* a meres nem allithatja meg a foglalast */ }
  };

  // --- kontroll / ekszercsere / garancia: NEM naptaras foglalas, hanem visszahivas-kero urlap (a /kontroll oldal urlapja) ---
  let kuldes = false;
  const mezoJo = (el) => {
    const k = URLAP_KOTELEZO[el.name];
    if (!k) return true;
    const v = el.value.trim();
    if (!v) return false;
    if (k[0] === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (k[0] === 'telefon') return (v.match(/\d/g) || []).length >= 6;
    return true;
  };
  const hibaAllit = (el, van) => {
    const m = el.closest('.mezo');
    if (!m) return;
    m.classList.toggle('hibas', van);
    el.setAttribute('aria-invalid', String(van));
    const u = m.querySelector('.hiba-uzenet');
    if (u) u.textContent = van ? URLAP_KOTELEZO[el.name][1] : '';
  };
  function urlapLepes() {
    const t = TIPUSOK.find((x) => x.kod === all.tipus) || TIPUSOK[1];
    const lehet = LEHETOSEG[t.kod] || [];
    const adat = all.urlapAdat || (all.urlapAdat = {});
    const ma = new Date();
    const maStr = `${ma.getFullYear()}-${String(ma.getMonth() + 1).padStart(2, '0')}-${String(ma.getDate()).padStart(2, '0')}`;
    // fel: 'd' = asztalon ketto egy sorban, 'm' = mobilon is (a ket rovid mezo: datum, varos); rovid: a hosszu felirat mobilos valtozata
    const mezo = (id, cimke, kotelezo, bemenet, fel, rovid) => `<div class="mezo${fel ? ' d-fel' : ''}${fel === 'm' ? ' m-fel' : ''}"><label class="cimke-szoveg" for="mp-${id}">${rovid ? `<span class="hosszu">${esc(cimke)}</span><span class="rovid">${esc(rovid)}</span>` : esc(cimke)}${kotelezo ? ' *' : ''}</label>${bemenet}<div class="hiba-uzenet" role="alert"></div></div>`;
    const orszagok = (lista) => lista.map(([iso, , nev, hivo]) => `<option value="${esc(iso)}" title="${esc(nev)}"${iso === (adat.orszag || 'HU') ? ' selected' : ''}>${esc(iso)} ${esc(hivo)}</option>`).join('');
    tartalom.innerHTML = `<p class="urlap-fej"><b>${esc(t.nev)}</b>: töltsd ki az űrlapot, és 24 órán belül visszahívunk és egyeztetünk egy időpontot!</p>`
      + `<form class="urlap" novalidate><div class="csapda" aria-hidden="true"><label>Ne töltsd ki <input type="text" name="bot-field" tabindex="-1" autocomplete="off"></label></div>`
      + mezo('nev', 'Név', true, '<input id="mp-nev" type="text" name="nev" autocomplete="name">', 'd')
      + mezo('tel', 'Telefonszám', true, `<div class="tel-sor"><select name="orszag" aria-label="Országkód">${orszagok(orszagLista)}</select><input id="mp-tel" type="tel" name="tel" inputmode="tel" autocomplete="tel-national"></div>`, 'd')
      + mezo('email', 'E-mail cím', true, '<input id="mp-email" type="email" name="email" autocomplete="email">', 'd')
      + mezo('mikor', 'Mikor voltál nálunk?', true, `<input id="mp-mikor" type="date" name="mikor" max="${maStr}">`, 'm')
      + mezo('varos', 'Melyik városban voltál?', true, `<input id="mp-varos" type="text" name="varos" list="mp-varosok" autocomplete="off"><datalist id="mp-varosok">${HELYSZIN_SORREND.map((id) => `<option value="${esc(HELYSZINEK[id].varos)}"></option>`).join('')}</datalist>`, 'm')
      + mezo('mire', 'Mire kérsz időpontot?', false, `<select id="mp-mire" name="mire">${lehet.map((o) => `<option value="${esc(o)}"${(adat.mire && lehet.includes(adat.mire) ? adat.mire : lehet[0]) === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`, 'd')
      + mezo('miben', 'Miben segíthetünk?', true, '<textarea id="mp-miben" name="miben"></textarea>')
      + mezo('kep', 'Kérlek csatolj egy képet a füledről (Opcionális)', false, '<input id="mp-kep" type="file" name="kep" accept="image/*" multiple>', false, 'Kép a füledről (opcionális)')
      + '<button type="button" class="gomb teljes" data-kuld>Visszahívást kérek!</button><div class="kuld-uzenet" role="status"></div></form>';
    const f = tartalom.querySelector('form.urlap');
    for (const [k, v] of Object.entries(adat)) { const el = f.elements[k]; if (el && k !== 'mire' && k !== 'orszag') el.value = v; }
    // az orszagkod-lista (238 orszag) kesobb toltodik: addig a Magyarorszag
    orszagokBetolt().then((lista) => { if (f.isConnected && lista.length > 1) f.elements.orszag.innerHTML = orszagok(lista); });
    f.addEventListener('input', (e) => {
      const el = e.target;
      if (el.name && el.type !== 'file') adat[el.name] = el.value;
      if (el.getAttribute('aria-invalid') === 'true' && mezoJo(el)) hibaAllit(el, false);
    });
    f.addEventListener('change', (e) => { if (e.target.name) adat[e.target.name] = e.target.type === 'file' ? '' : e.target.value; });
    // mezo elhagyasakor a Wix is ellenorzott (a datumot nem: azt csak bekuldeskor)
    f.addEventListener('focusout', (e) => { const el = e.target; if (URLAP_KOTELEZO[el.name] && el.name !== 'mikor') hibaAllit(el, !mezoJo(el)); });
  }
  async function urlapKuld() {
    const f = tartalom.querySelector('form.urlap');
    if (!f || kuldes || lezart) return;
    const uz = f.querySelector('.kuld-uzenet'), gomb = f.querySelector('[data-kuld]');
    let elso = null;
    for (const k of Object.keys(URLAP_KOTELEZO)) { const el = f.elements[k]; const jo = mezoJo(el); hibaAllit(el, !jo); if (!jo && !elso) elso = el; }
    if (elso) { elso.focus({ preventScroll: true }); elso.closest('.mezo').scrollIntoView({ block: 'center', behavior: 'smooth' }); uz.textContent = ''; return; }
    const e = f.elements;
    const hivo = (orszagLista.find((x) => x[0] === e.orszag.value) || orszagLista[0])[3];
    // orszagkod nelkul gepelt szam: a valasztott orszagkod ele; magyar szamnal a "06" / "0" korzet-elohivo es a "36" orszagkod elhagyva
    // (a "36" csak akkor, ha a szam igy is hosszu: Eger korzetszama is 36). Ha a vendeg "+"-szal kezdte, marad, ahogy irta.
    let tel = e.tel.value.trim();
    if (tel && !tel.startsWith('+')) {
      let sz = tel.replace(/\D/g, '');
      if (hivo === '+36') sz = /^06/.test(sz) ? sz.slice(2) : /^0/.test(sz) ? sz.slice(1) : /^36/.test(sz) && sz.length >= 10 ? sz.slice(2) : sz;
      else sz = sz.replace(/^0+/, '');
      tel = hivo + ' ' + sz;
    }
    const [ev, ho, nap] = e.mikor.value.split('-');
    let oldal = location.pathname;
    try { oldal = decodeURIComponent(location.pathname); } catch (x) { /* marad */ }
    // ugyanazok a mezonevek / sorrend, mint a regi /kontroll urlapon (igy a szalon e-mailje valtozatlan)
    const fd = new FormData();
    fd.append('form-name', 'kontroll-visszahivas');
    fd.append('oldal', oldal);
    fd.append('bot-field', e['bot-field'].value);
    fd.append('Név', e.nev.value.trim());
    fd.append('Telefonszám', tel);
    fd.append('E-mail cím', e.email.value.trim());
    fd.append('Mikor voltál nálunk?', `${ev}. ${ho}. ${nap}.`);
    fd.append('Melyik városban voltál?', e.varos.value.trim());
    fd.append('Miben segíthetünk?', e.miben.value.trim());
    fd.append('Mire kérsz időpontot?', e.mire.value || '-');
    for (const x of e.kep.files) fd.append('Kép', x);
    kuldes = true; gomb.disabled = true; uz.className = 'kuld-uzenet'; uz.textContent = 'Küldés…';
    try {
      const v = await fetch('/api/urlap', { method: 'POST', body: fd });
      if (!v.ok) throw new Error(String(v.status));
      // mint a regi urlapnal: a /kontroll-ok koszonooldal (301 -> /kontroll-xyz), ahol a konverzio-meres fut
      lezart = true;
      tartalom.innerHTML = '<div class="toltes">Köszönjük, megkaptuk! Egy pillanat…</div>';
      location.assign('/kontroll-ok');
    } catch (x) {
      gtagEsemeny('motor_hiba', { hiba_tipus: 'urlap' });
      kuldes = false; gomb.disabled = false; uz.className = 'kuld-uzenet hiba'; uz.textContent = 'Hiba történt, próbáld újra!';
    }
  }

  // --- 1. helyszin ---
  function helyszinLepes() {
    tartalom.innerHTML = `<p class="kicsi bevezeto">Válaszd ki, hol szeretnéd a piercinget.</p><div class="lista hely-racs">${HELYSZIN_SORREND.map((id) => {
      const h = HELYSZINEK[id];
      return `<button class="kartya hely" data-hely="${id}"><img class="terkep" src="/assets/img/helyszin/${id}.svg" alt="" width="36" height="26" decoding="async"><span class="nev">${esc(h.varos)}</span></button>`;
    }).join('')}</div>`;
  }

  // --- 2. szolgaltatas ---
  async function szolgaltatasLepes() {
    tartalom.innerHTML = osszegzes() + '<div class="toltes">A piercingek betöltése…</div>';
    let lista;
    try { lista = await adapter.getServices(all.placeId); } catch (e) { return hiba('szolgaltatasok', e); }
    if (all.lepes !== 'szolg' || lezart) return;
    // ha a link mar konkret szolgaltatast adott: kozvetlenul a naptar
    if (all.serviceId) {
      const s = lista.find((x) => x.serviceId === String(all.serviceId));
      all.serviceId = null;
      if (s) { all.szolg = s; return ugrik('ido'); }
    }
    const t = ctx.oldalTipus && ctx.oldalTipus !== 'alt' ? ctx.oldalTipus : null;
    const kiemelt = (s) => /3 PIERCING|2 PIERCING|szem\S*ynek/i.test(s.name); // az akcios csomagok enyhe kiemelessel (a tobbi sor csak athuzott arat kap)
const kartya = (s) => { const e = eredetiAr(s); return `<button class="kartya szolg${e && kiemelt(s) ? ' akcios' : ''}" data-szolg="${esc(s.serviceId)}"><span class="ar">${e ? `<s>${ft(e)}</s>` : ''}${ft(s.activePrice)}</span><span class="nev">${szolgIkon(s)}<span>${esc(szepNev(s.name))}</span></span><div class="reszlet">${s.durationMin ? s.durationMin + ' perc' : ''}</div></button>`; };
    const ajanlott = t ? lista.filter((s) => tipusKod(s.name) === t) : [];
    const tobbi = lista.filter((s) => !ajanlott.includes(s));
    tartalom.innerHTML = osszegzes() + (ajanlott.length ? `<div class="alcim">Ajánlott</div><div class="lista szolg-racs">${ajanlott.map(kartya).join('')}</div><div class="alcim">További piercingek</div>` : '') + `<div class="lista szolg-racs">${tobbi.map(kartya).join('')}</div>`;
    tartalom._lista = lista;
  }

  // --- 3. idopont ---
  async function idopontLepes() {
    const s = all.szolg;
    const kulcs = `${all.placeId}:${s.serviceId}`;
    // visszalepes az adatlaprol / masik napra: az ugyanahhoz a helyszinhez + piercinghez nemrég betoltott idopontokat nem toltjuk ujra (90 mp, mint az adapter cache-e)
    if (all.slotok && all.slotokKulcs === kulcs && Date.now() - all.slotokT < 90000) return naptar();
    tartalom.innerHTML = osszegzes() + '<div class="toltes">A szabad időpontok betöltése…</div>';
    all.tovabbi = true; $('.ablak').dataset.tovabbi = '1';
    const kesz = () => { all.tovabbi = false; const a = $('.ablak'); if (a) a.dataset.tovabbi = '0'; };
    let elso;
    try {
      elso = await adapter.getAvailability(all.placeId, s.serviceId, {
        days: NAPOK, firstDays: 21, minLeadMinutes: 30,
        onMore: (l) => { kesz(); if (l && all.szolg === s && !lezart) { all.slotok = l; all.slotokKulcs = kulcs; all.slotokT = Date.now(); } if (all.lepes === 'ido' && all.szolg === s && !lezart && all.slotok) naptar(); },
      });
    } catch (e) { kesz(); return hiba('idopontok', e); }
    if (all.lepes !== 'ido' || all.szolg !== s || lezart) return;
    all.slotok = elso; all.slotokKulcs = kulcs; all.slotokT = Date.now();
    naptar();
  }
  function naptar() {
    const s = all.szolg;
    const munkatarsak = [...new Map(all.slotok.filter((x) => x.staff_label).map((x) => [x.staff_id, x.staff_label])).entries()];
    if (all.staffId && !munkatarsak.some(([id]) => id === all.staffId)) all.staffId = null; // a linkbeli szakembernek nincs ideje: barki
    const sajat = all.staffId ? all.slotok.filter((x) => x.staff_id === all.staffId) : all.slotok;
    const napok = new Map();
    for (const x of sajat) { const b = sb(x); if (!napok.has(b.nap)) napok.set(b.nap, []); napok.get(b.nap).push(x); }
    if (!sajat.length) {
      tartalom.innerHTML = osszegzes() + `<p class="uzenet">A következő ${NAPOK} napban ezen a helyszínen erre a piercingre nincs szabad időpont.${munkatarsak.length > 1 && all.staffId ? '' : ''}</p><p><button class="gomb masodlagos" data-lepes="szolg">Másik piercing</button> <button class="gomb masodlagos" data-lepes="hely">Másik helyszín</button></p>`;
      return;
    }
    const kulcsok = [...napok.keys()].sort();
    if (!all.nap || !napok.has(all.nap)) all.nap = kulcsok[0];
    if (!all.honap) all.honap = all.nap.slice(0, 7);
    const [ev, ho] = all.honap.split('-').map(Number);
    const elsoNap = new Date(Date.UTC(ev, ho - 1, 1));
    const napokSzama = new Date(Date.UTC(ev, ho, 0)).getUTCDate();
    const eltolas = (elsoNap.getUTCDay() + 6) % 7;
    const honapok = [...new Set(kulcsok.map((k) => k.slice(0, 7)))];
    const hi = honapok.indexOf(all.honap);
    let racs = NAP_ROVID.map((n) => `<div class="fejnap">${n}</div>`).join('') + '<div></div>'.repeat(eltolas);
    for (let d = 1; d <= napokSzama; d++) {
      const k = `${all.honap}-${String(d).padStart(2, '0')}`;
      const van = napok.has(k);
      racs += `<button class="nap${van ? ' van' : ''}${k === all.nap ? ' valasztott' : ''}" ${van ? `data-nap="${k}" aria-label="${esc(napCim(k))}"` : 'disabled'}>${d}</button>`;
    }
    const idok = [...new Map(napok.get(all.nap).map((x) => [sb(x).ido, x])).values()].sort((a, b) => a.start_unix - b.start_unix);
    tartalom.innerHTML = osszegzes()
      + (munkatarsak.length > 1 ? `<div class="alcim">Szakember</div><div class="chipek"><button class="chip${all.staffId ? '' : ' valasztott'}" data-staff=""><span class="fejkep" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM9 13c-2.7 0-5 1.4-5 3.5V18h10v-1.5C14 14.4 11.7 13 9 13Zm6.5.5c-.5 0-1 .1-1.4.2 1 .8 1.6 1.8 1.6 2.8V18H20v-1.2c0-1.8-2-3.3-4.5-3.3Z"/></svg></span><span>Bárki</span></button>${munkatarsak.map(([id, n]) => `<button class="chip${all.staffId === id ? ' valasztott' : ''}" data-staff="${esc(id)}" title="${esc(n)}" aria-label="${esc(n)}">${szakemberJel(n)}</button>`).join('')}</div>`
        // ha egy helyszinen csak egy szakember van, nem valasztatunk, de kijelolve mutatjuk (fejkep + nev), hogy a vendeg lassa, kihez megy
        : munkatarsak.length === 1 ? `<div class="alcim">Szakember</div><div class="chipek"><span class="chip valasztott egy" title="${esc(munkatarsak[0][1])}" aria-label="Szakember: ${esc(munkatarsak[0][1])}">${szakemberJel(munkatarsak[0][1])}</span></div>` : '')
      + `<div class="honap-fej"><button class="gomb-ikon" data-honap="${hi > 0 ? honapok[hi - 1] : ''}" ${hi > 0 ? '' : 'disabled style="visibility:hidden"'} aria-label="Előző hónap">‹</button><span>${ev}. ${HONAP[ho - 1]}</span><button class="gomb-ikon" data-honap="${hi < honapok.length - 1 ? honapok[hi + 1] : ''}" ${hi < honapok.length - 1 ? '' : 'disabled style="visibility:hidden"'} aria-label="Következő hónap">›</button></div>`
      + `<div class="racs">${racs}</div>${all.tovabbi ? '<div class="kicsi tovabbi">További napok betöltése…</div>' : ''}<div class="alcim">${esc(napCim(all.nap))}</div><div class="idok">${idok.map((x) => `<button class="ido" data-slot="${x.start_unix}">${sb(x).ido}</button>`).join('')}</div>`;
  }

  // --- 4. adatlap (a Salonic beagyazott urlapja) ---
  async function adatlapLepes() {
    tartalom.innerHTML = osszegzes() + '<div class="toltes">Az adatlap betöltése…</div>';
    let b;
    try {
      b = await adapter.beginBooking({ placeId: all.placeId, serviceId: all.szolg.serviceId, startUnix: all.slot.start_unix, staffId: all.staffId ? +all.staffId : ANY_STAFF, bookingId: all.bookingId });
    } catch (e) { return hiba('adatlap', e); }
    if (all.lepes !== 'adatlap' || lezart) return;
    all.expected = b.expected;
    const u = new URL(b.guestDataUrl);
    for (const [k, v] of tovabbi) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    foglalas.update({ business: 'mp', service_id: all.szolg.serviceId, slot_unix: all.slot.start_unix, staff_id: all.staffId || '-1', carrier: 'back', sent_at: Date.now() });
    let stilus = null;
    try { stilus = (await adapter.getPresentation()).customCss; } catch (e) { /* alap kinezet */ }
    if (all.lepes !== 'adatlap' || lezart) return;
    $('.ablak').dataset.stilus = stilus ? '1' : '0';
    tartalom.innerHTML = osszegzes() + `<p class="kicsi adatlap-sugo" style="margin:0 0 8px">Add meg az adataidat, és véglegesítsd a foglalást. Ha az időpont közben elkelt, <button class="chip" data-lepes="ido">válassz másikat</button>.</p><div class="adatlap-burok"><iframe class="adatlap" title="Foglalási adatlap" src="${esc(u.href)}" allow="payment"></iframe></div>`;
  }

  async function rajzol() {
    lepesjelzo();
    tartalom.scrollTop = 0;
    if (all.lepes === 'tipus') return tipusLepes();
    if (all.lepes === 'urlap') return urlapLepes();
    if (all.lepes === 'hely') { if (all.placeId) { all.lepes = 'szolg'; return rajzol(); } return helyszinLepes(); }
    if (all.lepes === 'szolg') return szolgaltatasLepes();
    if (all.lepes === 'ido') return idopontLepes();
    if (all.lepes === 'adatlap') return adatlapLepes();
  }

  // --- esemenyek ---
  shadow.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.hasAttribute('data-bezar')) return bezar();
    if (t.hasAttribute('data-vissza')) return vissza();
    const d = t.dataset;
    if (d.tipus) { all.tipus = d.tipus; if (d.tipus === 'uj') { meres(); return ugrik('hely'); } return ugrik('urlap'); }
    if (d.kuld !== undefined) return urlapKuld();
    if (d.lepes && (t.classList.contains('kesz') || !t.closest('.lepesek'))) return visszaLep(d.lepes);
    if (d.hely) { all.placeId = +d.hely; all.szolg = null; all.nap = null; all.honap = null; all.staffId = null; return ugrik('szolg'); }
    if (d.szolg) { all.szolg = (tartalom._lista || []).find((x) => x.serviceId === d.szolg) || null; all.nap = null; all.honap = null; if (all.szolg) ugrik('ido'); return; }
    if (d.staff !== undefined) { all.staffId = d.staff || null; all.nap = null; all.honap = null; return naptar(); }
    if (d.honap) { all.honap = d.honap; const elso = [...new Set(all.slotok.map((x) => sb(x).nap))].sort().find((k) => k.startsWith(d.honap)); if (elso) all.nap = elso; return naptar(); }
    if (d.nap) { all.nap = d.nap; return naptar(); }
    if (d.slot) {
      const unix = +d.slot;
      all.slot = (all.staffId ? all.slotok.filter((x) => x.staff_id === all.staffId) : all.slotok).find((x) => x.start_unix === unix) || null;
      if (all.slot) ugrik('adatlap');
    }
  });
  const billentyu = (e) => { if (e.key === 'Escape' && all.lepes !== 'adatlap') bezar(); };
  document.addEventListener('keydown', billentyu);

  // --- a koszonooldal jelzese (a keretben futo suti.js kuldi) ---
  const uzenet = (e) => {
    // a koszonooldal az eles tartomanyon nyilik (a Salonic oda iranyit); a sajat tartomany a helyi probahoz kell
    if (!(KOSZONO_ORIGIN.test(e.origin) || e.origin === location.origin) || !e.data || e.data.tipus !== 'mp-foglalas-ok' || typeof e.data.url !== 'string') return;
    const iframe = shadow.querySelector('iframe.adatlap');
    if (!iframe || e.source !== iframe.contentWindow) return;
    let u;
    try { u = new URL(e.data.url); } catch (x) { return; }
    // a Salonic szolgaltatasonkent iranyit: /foglalas-ok* (gyogypiercingek), /fulbevalo-ok, -ok2, -ok3 (divat fulpiercing 1/2/3 db)
    if (!/^\/(foglalas-ok[a-z0-9-]*|fulbevalo-ok\d*)\/?$/i.test(u.pathname)) return;
    try { e.source.postMessage({ tipus: 'mp-motor-atvette' }, e.origin); } catch (x) { /* */ }
    let ell = null;
    try { ell = all.expected ? adapter.verifyConfirmation(u.href, all.expected) : null; } catch (x) { /* */ }
    foglalas.complete(ell ? ell.bookingId : null);
    u.searchParams.set('booking_id', all.bookingId);
    // a lap sajat cimeben levo Google-kattintasazonosito a koszonooldalra (sajat tartomany; ott csak hozzajarulassal hasznalt)
    for (const [k, v] of googleKatt) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    lezart = true;
    tartalom.innerHTML = '<div class="toltes">Sikeres foglalás, egy pillanat…</div>';
    // ugyanaz a koszonooldal, ugyanazokkal a parameterekkel, a fo ablakban (a sajat tartomanyon: elonezeten az elonezet)
    location.assign(location.origin + u.pathname + u.search);
  };
  window.addEventListener('message', uzenet);

  function bezar() {
    lezart = true;
    window.removeEventListener('message', uzenet);
    document.removeEventListener('keydown', billentyu);
    document.documentElement.style.overflow = elozoOverflow;
    if (nezet && nezetEredeti !== null && nezet.getAttribute('content') !== nezetEredeti) nezet.setAttribute('content', nezetEredeti);
    host.remove();
    if (nyitott && nyitott.host === host) nyitott = null;
  }
  nyitott = { host, bezar };
  rajzol();
  $('.tartalom').focus({ preventScroll: true });
  return nyitott;
}

/** Elomelegites (a gomb fole vitt egerre / erintesre): a helyszin szolgaltatasai. */
export function melegit(placeId) {
  if (HELYSZINEK[placeId]) adapter.getServices(placeId).catch(() => {});
}
