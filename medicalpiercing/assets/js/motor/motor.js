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
import { tipusKod, oldalTipus } from './tipus.js';

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
@media (min-width: 701px) { .hely-racs { grid-template-columns: repeat(3, minmax(0, 1fr)); } .szolg-racs { grid-template-columns: 1fr 1fr; } .os-szolg { font-size: 14px; } }
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
.kartya { display: block; width: 100%; text-align: left; border: 1.5px solid #d9c9c5; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(69, 70, 89, .1); padding: 13px 14px; font: inherit; color: inherit; cursor: pointer; }
.kartya:hover, .kartya:focus-visible { border-color: #d7aba8; box-shadow: 0 0 0 3px #f5d3ca; outline: none; }
.kartya .nev { font: 600 16px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; }
.kartya .reszlet { margin-top: 3px; font-size: 13px; color: #6b6c80; }
.kartya .ar { float: right; font-weight: 700; color: #ab6354; margin-left: 10px; }
/* 1. lepes: az osszes helyszin egy kepernyon (mobilon 2 oszlop, asztalon 3), felirat nelkul */
.kicsi.bevezeto { margin: 0 0 10px; }
.hely-racs { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
.kartya.hely { display: flex; align-items: center; min-width: 0; height: clamp(38px, 6dvh, 48px); padding: 0 8px; border-radius: 10px; }
.kartya.hely .nev { min-width: 0; font-size: clamp(12.5px, 3.8vw, 14.5px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kartya.hely .terkep { flex: none; width: auto; height: 22px; margin-right: 6px; }
@media (max-width: 380px) { .kartya.hely { padding: 0 6px; } .kartya.hely .terkep { height: 18px; margin-right: 5px; } .kartya.hely .nev { font-size: 12.5px; } }
@media (max-width: 340px) { .kartya.hely .terkep { height: 16px; margin-right: 4px; } .kartya.hely .nev { font-size: 11.8px; } }
.ikon { flex: none; width: 20px; height: 20px; object-fit: contain; }
.kartya.szolg .nev { display: flex; align-items: center; gap: 6px; }
/* 2. lepes: TOMOR szolgaltatas-sorok. Mobilon egysoros (nev + ar), hogy a lista a lehetosegek szerint egy kepernyore keruljon; asztalon 2 oszlop,
   ar + idotartam jobbra. Az akcios szolgaltatasok (3 piercing, 2 piercing, ket szemelynek) athuzott arral */
.szolg-racs { gap: 2px; }
.kartya.szolg { display: grid; grid-template-columns: 1fr auto; grid-template-areas: "nev ar"; column-gap: 8px; align-items: center; min-height: 27px; padding: 1px 9px; border-radius: 8px; }
.kartya.szolg .nev { grid-area: nev; font-size: clamp(11px, 3.1vw, 12.5px); line-height: 1.12; color: #a35a4b; }
.kartya.szolg .ar { grid-area: ar; float: none; margin: 0; text-align: right; font-size: clamp(11.5px, 3.3vw, 13px); white-space: nowrap; color: #454659; }
.kartya.szolg .ar s { margin-right: 6px; font-weight: 400; color: #9a9aa8; }
.kartya.szolg .reszlet { display: none; }
.kartya.szolg.akcios { border-color: #d7aba8; background: #fff8f6; }
.cimke { display: inline-block; margin-top: 6px; font-size: 12px; background: #f5d3ca; color: #78463e; border-radius: 99px; padding: 2px 9px; }
.szuro { margin: 0 0 4px; }
.szuro-sor { margin-bottom: 16px; }
.szuro-cimke, .lista-fej { display: block; font: 600 11px/1.25 'poppins-semibold', Poppins, Arial, sans-serif; color: #6b6c80; text-transform: uppercase; letter-spacing: .03em; }
.szuro-cimke { margin: 0 0 7px; }
.szuro-sor + .szuro-sor .szuro-cimke { margin-bottom: 12px; } /* a "legjobban megéri" jelzo a gombsor tetejere lóg: ne takarja a cimkét */
.lista-fej { display: flex; justify-content: space-between; align-items: center; margin: 14px 0 6px; }
.szam { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-right: 7px; border-radius: 50%; background: #a35a4b; color: #fff; font: 700 11px/1 'poppins-semibold', Poppins, Arial, sans-serif; letter-spacing: 0; vertical-align: middle; }
.szeg { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; }
.szeg button { position: relative; min-height: 38px; padding: 0 5px; border: 1px solid #d8d1cf; border-radius: 9px; background: #fff; box-shadow: 0 1px 2px rgba(69, 70, 89, .09); font: 600 12px/1.1 'poppins-semibold', Poppins, Arial, sans-serif; color: #454659; cursor: pointer; white-space: nowrap; }
.szeg button.on { background: #fdece7; border-color: #d98f7c; box-shadow: 0 0 0 1px #d98f7c; color: #a35a4b; }
.szeg button[disabled] { opacity: .38; cursor: default; box-shadow: none; }
.szeg button i { position: absolute; top: -7px; right: 4px; padding: 0 5px; border-radius: 99px; background: #a35a4b; color: #fff; font: 600 8px/13px 'poppins-semibold', Poppins, Arial, sans-serif; font-style: normal; letter-spacing: .02em; text-transform: uppercase; }
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
.adatlap-szakember { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; }
.adatlap-szakember .kicsi { font-size: 13px; }
.adatlap-szakember .chip { margin: 0; }
@media (max-width: 700px) { .ablak[data-lepes="adatlap"] .adatlap-szakember { margin: 0; padding: 8px 12px 6px; background: #fff; } }
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
.kartya.tipus { padding: 16px 18px; border: 2px solid #c9a399; border-radius: 14px; box-shadow: 0 2px 6px rgba(69, 70, 89, .12); }
.kartya.tipus .nev { display: block; font-size: 18px; }
.kartya.tipus .reszlet { margin-top: 4px; font-size: 14px; }
@media (min-width: 701px) { .tipus-racs { grid-template-columns: 1fr 1fr; } .ablak[data-lepes="tipus"] { height: auto; }
  .szolg-racs { gap: 6px; }
  .kartya.szolg { padding: 7px 12px; border-radius: 10px; }
  .kartya.szolg .nev, .kartya.szolg .ar { font-size: 14px; }
  .ikon { width: 28px; height: 28px; }
  .kartya.hely { height: 46px; padding: 0 12px; }
  .kartya.hely .nev { font-size: 15px; }
  .kartya.hely .terkep { height: 28px; margin-right: 9px; }
  .kartya.szolg .ar s { display: block; margin: 0; font-size: 12px; }
  .ablak[data-lepes="szolg"] .osszegzes { margin-bottom: 18px; }
  .szuro-sor { margin-bottom: 22px; }
  .szuro-cimke { margin-bottom: 10px; }
  .szuro-sor + .szuro-sor .szuro-cimke { margin-bottom: 14px; }
  .lista-fej { margin: 20px 0 10px; }
  .szeg { gap: 12px; }
  .szeg button { min-height: 46px; font-size: 14px; }
  .szuro-cimke, .lista-fej { font-size: 12px; }
  .szam { width: 20px; height: 20px; margin-right: 8px; font-size: 12px; } }
/* MOBIL (Feri 2026-10-13): az elsodleges a nagy, jol olvashato elem - ha kell, gorgetni lehet. Helyszinek: egy oszlop, nagy cellak; piercingek:
   nagy betu, magas sorok (a hosszabb nev ket sorba tores is elfer), nagy szuro-gombok. A tomor, egykepernyos elrendezes csak asztalon marad. */
@media (max-width: 700px) {
  .hely-racs { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .kartya.hely { height: 58px; padding: 0 14px; border-radius: 12px; }
  .kartya.hely .nev { font-size: 18px; }
  .kartya.hely .terkep { height: 34px; margin-right: 12px; }
  .szolg-racs { gap: 10px; }
  .kartya.szolg { min-height: 60px; padding: 8px 12px; border-radius: 12px; column-gap: 10px; }
  .kartya.szolg .nev { gap: 10px; font-size: 16.5px; line-height: 1.22; }
  .kartya.szolg .ar { font-size: 16px; }
  .kartya.szolg .ar s { display: block; margin: 0; font-size: 12.5px; }
  .ikon { width: 30px; height: 30px; }
  .szuro-sor { margin-bottom: 20px; }
  .szuro-cimke, .lista-fej { font-size: 13px; }
  .szam { width: 22px; height: 22px; margin-right: 8px; font-size: 13px; }
  .szeg { gap: 10px; }
  .szeg button { min-height: 50px; padding: 0 6px; border-width: 1.5px; font-size: 15px; line-height: 1.15; white-space: normal; }
  .szeg button i { top: -8px; font-size: 9px; line-height: 15px; }
  .szeg.harom { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr); grid-auto-flow: row; gap: 8px; }
  .szeg.harom button { font-size: 14.5px; white-space: nowrap; }
}
@media (max-width: 359px) { .szeg.harom button { font-size: 13.5px; padding: 0 3px; } .szeg.harom { gap: 6px; } .szuro-cimke, .lista-fej { font-size: 12px; letter-spacing: .01em; } .lista-fej span:last-child { white-space: nowrap; } }
/* visszahivas-kero urlap (kontroll / ekszercsere / garancia): ugyanaz az urlap es vegpont (/api/urlap), mint a regi /kontroll oldalon.
   TOMOR: asztalon sehol nem logki (2 oszlop), mobilon egy kepernyore torekszik (mint a Salonic-adatlap: nincs lepesjelzo, kisebb fejlec,
   a ket rovid mezo - datum, varos - egymas mellett, rovid kepfeltoltes-felirat) */
.urlap-fej { margin: 0 0 8px; font-size: 13px; line-height: 1.35; }
.urlap { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; position: relative; }
.urlap .mezo { grid-column: 1 / -1; min-width: 0; }
.urlap .mezo.m-fel { grid-column: auto; }
.mezo .cimke-szoveg { display: block; margin: 0 0 2px; font: 600 12px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; }
.mezo input, .mezo select, .mezo textarea { width: 100%; font: inherit; font-size: 16px; line-height: 1.3; padding: 7px 10px; border: 1px solid #d9d4d3; border-radius: 8px; background: #fff; color: #454659; }
/* egyseges betu minden mezoben (iOS-en a datum- es a valaszto mezo kulonben a rendszer betujevel latszik) */
.mezo input, .mezo select, .mezo textarea { font-family: 'helvetica-w01-light', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 400; }
.mezo input[type="date"] { color: #454659; }
.mezo input[type="date"]::-webkit-datetime-edit, .mezo input[type="date"]::-webkit-datetime-edit-fields-wrapper { font: inherit; color: inherit; }
.mezo input[type="date"]:invalid::-webkit-datetime-edit { color: #8a8b99; }
/* kepfeltoltes: a bongeszo "Fajl kivalasztasa" gombja helyett sajat gomb + a kivalasztott kep neve */
.feltolto { position: relative; display: flex; align-items: center; gap: 10px; min-width: 0; padding: 5px 6px; border: 1px dashed #d9c9c5; border-radius: 10px; background: #fbf7f6; }
.feltolto input[type="file"] { position: absolute; width: 1px; height: 1px; padding: 0; border: 0; opacity: 0; pointer-events: none; }
.feltolto-gomb { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 99px; background: #d7aba8; color: #fff; font: 600 13px/1.2 'poppins-semibold', Poppins, Arial, sans-serif; cursor: pointer; white-space: nowrap; }
.feltolto-gomb svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; }
.feltolto-gomb:hover { background: #c99b97; }
.feltolto:focus-within { border-color: #ab6354; box-shadow: 0 0 0 3px #f5d3ca; }
.feltolto-nev { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #6b6c80; }
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
  /* iOS Safari: a datummezo a sajat oszlopa FOLE nyulik (a width:100% mellett a belso margo is hozzaadodik, es magasabb a tobbi mezonel): ugyanolyan dobozmodell, fix magassag */
  .mezo input[type="date"] { -webkit-appearance: none; appearance: none; display: block; box-sizing: border-box !important; width: 100% !important; min-width: 0 !important; max-width: 100% !important; height: 37px; line-height: 1.3; text-align: left; }
  .mezo input[type="date"]::-webkit-date-and-time-value { text-align: left; min-height: 1.3em; margin: 0; padding: 0; }
  .mezo input[type="date"]::-webkit-datetime-edit { padding: 0; }
  .urlap .mezo.m-fel input { min-width: 0; max-width: 100%; }
  .ablak[data-lepes="szolg"] .osszegzes { padding: 9px 12px; margin-bottom: 20px; font-size: 15px; line-height: 1.3; }
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

/* --- 2. lepes: a piercing-kartyak (a tulajdonos latvanyterve es kerese, 2026-10-16): tomor szurosor, a 4,8 mellett a felugro szuras-video, kicsi
   "Az ár tartalmazza", minden lehetoseg kartyaja; minden kartyan "Részletek" (lenyitja) + "Időpontot választok" (tovabb); csomagoknal a kedvezmeny magyarazata --- */
.pk-szuro { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 8px; margin: 0 0 10px; }
.pk-szuro .szeg { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid #e6d9d6; border-radius: 99px; background: #faf6f5; }
.pk-szuro .szeg button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 99px; background: none; box-shadow: none; font-size: 12.5px; line-height: 1; white-space: nowrap; color: #454659; }
.pk-szuro .szeg button.on { background: #454659; border: 0; box-shadow: none; color: #fff; }
.pk-szuro .szeg button[disabled] { opacity: .38; }
.pk-info { margin: 0 0 12px; text-align: center; }
.pk-info p { margin: 0; }
.pk-info-sor { display: flex; flex-wrap: nowrap; align-items: center; justify-content: center; gap: 12px; margin: 0 0 6px !important; font-size: 12.5px; line-height: 1.2; white-space: nowrap; color: #454659; }
.pk-csillag { color: #c99b3c; }
.pk-szuras { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 11px 0 4px; border: 1px solid #ecd2cc; border-radius: 99px; background: #fff; font: 600 12.5px/1 'poppins-semibold', Poppins, Arial, sans-serif; color: #a35a4b; cursor: pointer; white-space: nowrap; }
.pk-szuras:hover { background: #fdf3f0; }
.pk-play { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #a35a4b; color: #fff; }
.pk-play svg { width: 8px; height: 10px; margin-left: 2px; fill: currentColor; }
.pk-tart { font-size: 11.5px; line-height: 1.4; color: #6b6c80; }
.pk-tart b { font-weight: 600; color: #454659; }
.pk-felugro { position: fixed; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center; padding: 20px 16px; background: rgba(39, 40, 52, .78); }
.pk-felugro-doboz { position: relative; width: min(100%, 380px, calc((100dvh - 110px) * 9 / 16)); }
.pk-felugro-cim { margin: 0 0 10px; text-align: center; font: 600 15px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; color: #fff; }
.pk-felugro video { display: block; width: 100%; aspect-ratio: 9 / 16; border-radius: 16px; background: #2f3044; object-fit: cover; }
.pk-felugro-x { position: absolute; top: 22px; right: -10px; display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; padding: 0; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 4px 14px rgba(0, 0, 0, .3); font: 400 28px/1 Arial, sans-serif; color: #454659; cursor: pointer; }
@media (max-width: 420px) { .pk-felugro-x { right: -4px; } }
.pk-lista { display: grid; gap: 10px; }
.pk { border: 1.5px solid #ecdcd8; border-radius: 16px; background: #fff; box-shadow: 0 1px 3px rgba(69, 70, 89, .08); }
.pk.nyitva { border-color: #c99b97; box-shadow: 0 6px 18px rgba(163, 90, 75, .12); }
.pk-fej { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 12px 14px 8px; border: 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.pk-ikon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: #f6e5e0; }
.pk-ikon img { width: 26px; height: 26px; object-fit: contain; }
.pk-cim { min-width: 0; }
.pk-cim b { display: block; font: 600 16.5px/1.25 'poppins-semibold', Poppins, Arial, sans-serif; color: #2f3044; }
.pk-cim small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #6b6c80; }
.pk-ar { display: grid; justify-items: end; gap: 1px; white-space: nowrap; }
.pk-ar s { font-size: 12px; color: #9a9aa8; }
.pk-ar b { font: 600 15.5px/1.2 'poppins-semibold', Poppins, Arial, sans-serif; color: #2f3044; }
.pk-test { padding: 4px 14px 2px; }
.pk-pont { display: grid; grid-template-columns: minmax(96px, 34%) minmax(0, 1fr); gap: 12px; align-items: start; margin-bottom: 10px; }
.pk-pont img { display: block; width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 12px; background: #f6e5e0; }
.pk-pont b { display: block; margin-bottom: 4px; font: 600 13.5px/1.35 'poppins-semibold', Poppins, Arial, sans-serif; color: #2f3044; }
.pk-pont p { margin: 0; font-size: 13.5px; line-height: 1.45; }
.pk-kedv { margin-bottom: 10px; padding: 12px 14px; border-radius: 12px; background: #fbf3f1; font-size: 13.5px; line-height: 1.45; }
.pk-kedv-cim { margin: 0 0 6px; font: 600 13.5px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; color: #a35a4b; }
.pk-kedv ul { margin: 0 0 8px; padding: 0; list-style: none; }
.pk-kedv li { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; border-bottom: 1px dashed #ead6d1; }
.pk-kedv li b { font-weight: 600; white-space: nowrap; color: #2f3044; }
.pk-kedv li.pk-ossz { border-bottom: 0; padding-top: 5px; font: 600 14px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; }
.pk-kedv li.pk-ossz b { color: #a35a4b; }
.pk-kedv p { margin: 0; }
.pk-kedv p b { color: #3c7a4f; }
.pk-csomag { margin: 0 0 10px; font-size: 13px; line-height: 1.45; color: #6b6c80; }
.pk-csomag p { margin: 0 0 6px; } .pk-csomag p:last-child { margin: 0; }
.pk-garancia { margin: 0 0 10px; padding: 10px 12px; border-radius: 12px; background: #eef3ec; font-size: 13px; line-height: 1.45; color: #3c4a3f; }
.pk-gombok { display: flex; gap: 8px; padding: 4px 12px 12px; }
.pk-reszlet { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 16px; border: 1.5px solid #e3cfca; border-radius: 99px; background: #fff; font: 600 14px/1 'poppins-semibold', Poppins, Arial, sans-serif; color: #a35a4b; cursor: pointer; white-space: nowrap; }
.pk-reszlet svg { width: 15px; height: 15px; transition: transform .2s; }
.pk-reszlet[aria-expanded="true"] svg { transform: rotate(180deg); }
.pk-reszlet:hover { border-color: #d7aba8; background: #fdf3f0; }
.pk-valaszt { flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 0; min-height: 44px; padding: 0 16px; border: 0; border-radius: 99px; background: #a35a4b; box-shadow: 0 4px 12px rgba(163, 90, 75, .3); color: #fff; font: 600 14.5px/1 'poppins-semibold', Poppins, Arial, sans-serif; cursor: pointer; white-space: nowrap; }
.pk-valaszt:hover { background: #8e4a3d; }
.pk-valaszt svg { flex: none; width: 14px; height: 14px; }
.rejtett { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.pk-fej:focus-visible, .pk-valaszt:focus-visible, .pk-reszlet:focus-visible, .pk-szuras:focus-visible, .pk-felugro-x:focus-visible { outline: 3px solid #f5d3ca; outline-offset: 2px; }
@media (max-width: 380px) { .pk-fej { gap: 9px; padding: 10px 11px 6px; } .pk-ikon { width: 38px; height: 38px; } .pk-cim b { font-size: 15.5px; } .pk-gombok { gap: 6px; padding: 4px 10px 10px; } .pk-reszlet { padding: 0 12px; font-size: 13px; } .pk-valaszt { padding: 0 12px; font-size: 13.5px; gap: 6px; } .pk-szuro .szeg button { padding: 0 10px; font-size: 12px; } .pk-info-sor { gap: 8px; font-size: 11.5px; } .pk-szuras { font-size: 11.5px; } }
@media (max-width: 460px) { .pk-ertek-hosszu { display: none; } .pk-info-sor { gap: 8px; } }
@media (max-width: 340px) { .pk-valaszt svg { display: none; } .pk-szuras { padding-right: 8px; } }
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
// a "Barki" csempe tartalma (altalanos ember-ikon): az idopont-lepes szakember-valasztojaban es az adatlap tetején, ha nincs kijelolt szakember
const BARKI_JEL = '<span class="fejkep" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM9 13c-2.7 0-5 1.4-5 3.5V18h10v-1.5C14 14.4 11.7 13 9 13Zm6.5.5c-.5 0-1 .1-1.4.2 1 .8 1.6 1.8 1.6 2.8V18H20v-1.2c0-1.8-2-3.3-4.5-3.3Z"/></svg></span><span>Bárki</span>';
// a szakember-csempe tartalma: kis kerek fejkep (vagy monogram) + becenev
const szakemberJel = (nev) => { const t = csapattag(nev); return `<span class="fejkep" aria-hidden="true">${t.kep ? `<img src="${t.kep}" alt="" width="28" height="28" loading="lazy">` : esc(t.kezdo)}</span><span>${esc(t.rovid)}</span>`; };
// szolgaltatas-ikonok (assets/img/ikon/<kod>.webp, AI-val generalt csomag): a piercing tipus-kodja szerint; a csomagok sajat ikont kapnak, a tobbinek nincs
const IKONOS = new Set(['mi', 'sh', 'kl', 'sl', 'al', 'mj', 'vb', 'lp', 'pm', 'divat']);
const ikonKod = (s) => (/szem\S*ynek/i.test(s.name) ? 'ketto' : /3 PIERCING|2 PIERCING|harmadik|f\S*laron/i.test(s.name) ? 'akcio' : IKONOS.has(tipusKod(s.name)) ? tipusKod(s.name) : null);
const szolgIkon = (s) => { const k = ikonKod(s); return k ? `<img class="ikon" src="/assets/img/ikon/${k}.webp" alt="" width="22" height="22" decoding="async">` : ''; };
// a Salonic-nevben levo emoji (lang, ket szemely) helyett az ikon latszik
const szepNev = (n) => String(n || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
// a lista soraiban rovidebb megjelenitesi nev (egy sorba ferjen); a pontos Salonic-nev a sor title-jeben, az osszegzesben es az adatlapon latszik
const rovidNev = (n) => {
  const t = szepNev(n);
  let m;
  if ((m = /^(\d)\s*piercing\s*[-–]\s*a harmadik\s*5\.000\s*Ft!?$/i.exec(t))) return `${m[1]} piercing – harmadik 5.000 Ft`;
  if (/^2\s*piercing a 2\.\s*f[ée]l[áa]ron!?$/i.test(t)) return '2 piercing – a 2. féláron';
  if ((m = /^2 szem\S*ynek\s*[-–]\s*(\d) db piercing$/i.exec(t))) return `2 személynek – ${m[1]} db`;
  if ((m = /^(\d) db f\S*lbeval\S*[\s\-/]*divat f\S*lpiercing sz\S*r\S*s$/i.exec(t))) return `Fülbevaló / divat fül – ${m[1]} db`;
  if (/^1\+1 db /i.test(t)) return t.replace(/\s*piercing$/i, '');
  if (/^1 db /i.test(t)) return t.replace(/^1 db\s+/i, '').replace(/\s*piercing$/i, '').replace(/-\s*\//g, ' /');
  return t;
};
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
  document.documentElement.setAttribute('data-mp-motor-nyitva', ''); // amig a foglalo nyitva van, a suti-sav rejtve (suti.js)
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
    tipus: null, urlapAdat: null, merve: !ctx.merjen, kinek: 'magamnak', mit: oldalTipus(ctx.forras || '') === '3pc' ? 'tobb' : 'egy',
    oldalTipus: oldalTipus(ctx.forras || ''), nyitott: null, arak: null,
  };
  const ctxFoglalas = foglalas.begin({ business: 'mp', source_page: ctx.forras || location.pathname });
  all.bookingId = ctxFoglalas.id;
  // belepes: a foglalo fo oldala a tipus-valaszto
  // Minden altalanos "idopontfoglalas" gomb / link ugyanazt kapja: a tipus-valaszto (Uj piercing / Kontroll / Ekszercsere / Garancia), akarhonnan kattint
  // (a link helyszine / szolgaltatasa / szakembere megmarad, az "Uj piercing" utan ervenyes). Az a link, amelyik konkretan kontrollt, ekszercserét vagy
  // garanciat emlit (ctx.tipus), egybol a visszahivas-kero urlapot nyitja.
  if (['kontroll', 'ekszercsere', 'garancia'].includes(ctx.tipus)) { all.tipus = ctx.tipus; all.lepes = 'urlap'; } else all.lepes = 'tipus';
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
      + mezo('kep', 'Kérlek csatolj egy képet a füledről (Opcionális)', false, '<span class="feltolto"><input id="mp-kep" type="file" name="kep" accept="image/*" multiple><label class="feltolto-gomb" for="mp-kep"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Kép kiválasztása</label><span class="feltolto-nev" data-fajlnev>Nincs kiválasztott kép</span></span>', false, 'Kép a füledről (opcionális)')
      + '<button type="button" class="gomb teljes" data-kuld>Visszahívást kérek!</button><div class="kuld-uzenet" role="status"></div></form>';
    const f = tartalom.querySelector('form.urlap');
    for (const [k, v] of Object.entries(adat)) { const el = f.elements[k]; if (el && k !== 'mire' && k !== 'orszag' && el.type !== 'file') el.value = v; }
    // a sajat feltolto gomb mellett a kivalasztott kep(ek) neve
    const kepMezo = f.elements.kep, fajlNev = f.querySelector('[data-fajlnev]');
    if (kepMezo && fajlNev) kepMezo.addEventListener('change', () => { const n = kepMezo.files.length; fajlNev.textContent = !n ? 'Nincs kiválasztott kép' : n === 1 ? kepMezo.files[0].name : `${n} kép kiválasztva`; });
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
    tartalom._lista = lista;
    szolgRajzol();
  }
  // A piercing-lista ket kerdesre szurve (mindenhonnan ugyanaz): 1. Kinek? (magamnak / ket szemelynek), 2. Milyen szolgaltatas? (1 piercing / tobb piercing / fulbevalo).
  // A kategoria a Salonic-szolgaltatas nevebol jon; a "2 szemelynek - 2 db" fejenkent 1 piercing, a 4 es 6 db tobb piercing.
  const kategoria = (s) => {
    const n = szepNev(s.name);
    if (/szem\S*ynek/i.test(n)) return { kinek: 'ketto', mit: +((/(\d+)\s*db/i.exec(n) || [])[1]) <= 2 ? 'egy' : 'tobb' };
    if (/f\S*lbeval/i.test(n)) return { kinek: 'magamnak', mit: 'fulbevalo' };
    if (/3 PIERCING|2 PIERCING|^1\+1/i.test(n)) return { kinek: 'magamnak', mit: 'tobb' };
    return { kinek: 'magamnak', mit: 'egy' };
  };
  const MIT = [['egy', '1 piercing'], ['tobb', 'Több piercing'], ['fulbevalo', 'Fülbevaló']];
  // A piercing-kartyak (a tulajdonos latvanyterve es kerese, 2026-10-16): tomor szurosor (Kinek? / Milyen?), a 4,8-as ertekeles mellett a "Hogy néz ki egy szúrás?"
  // (felugro, bezarhato video), kicsi "Az ár tartalmazza", alatta MINDEN lehetoseg kartyaja (nincs rejtett "+ tobbi"). Minden kartyan ket gomb: "Részletek"
  // (lenyitja: a pont helye valodi fulfotoval, mire jo, garancia; a csomagoknal a kedvezmeny magyarazata) es "Időpontot választok" (a regi [data-szolg]:
  // title = a teljes Salonic-nev, .nev > span = a rovid nev, .ar = az ar; a tesztek es a foglalasi logika ugyanaz). A kartya feje is nyit / zar (data-nyit).
  function szolgRajzol() {
    const lista = tartalom._lista || [];
    const kat = lista.map((s) => [s, kategoria(s)]);
    const db = (k, m) => kat.filter(([, c]) => c.kinek === k && (!m || c.mit === m)).length;
    if (!db(all.kinek, all.mit)) { const m = MIT.find(([k]) => db(all.kinek, k)); if (m) all.mit = m[0]; else { all.kinek = 'magamnak'; all.mit = (MIT.find(([k]) => db('magamnak', k)) || ['egy'])[0]; } }
    let mutat = kat.filter(([, c]) => c.kinek === all.kinek && c.mit === all.mit).map(([s]) => s);
    // a tipusoldal piercingje elol (pl. a lep-oldalrol nyitva a Lep)
    const sajat = (s) => all.mit === 'egy' && tipusKod(s.name) === all.oldalTipus;
    mutat = [...mutat.filter(sajat), ...mutat.filter((s) => !sajat(s))];
    // null: az alapertelmezett kartya nyilik le (a szuro valtasakor is); '': a vendeg bezarta, mind csukva marad
    if (all.nyitott === null || (all.nyitott && !mutat.some((s) => s.serviceId === all.nyitott))) all.nyitott = (all.oldalTipus === '3pc' && mutat.find((s) => /3 PIERCING/i.test(s.name)) || mutat[0] || {}).serviceId || null;
    all.arak = arakBol(lista);
    const kozerzet = all.mit !== 'fulbevalo';
    const gomb = (attr, k, nev, on, tilt) => `<button class="${on ? 'on' : ''}" data-${attr}="${k}" aria-pressed="${on}"${tilt ? ' disabled' : ''}>${nev}</button>`;
    tartalom.innerHTML = `<div class="pk-szuro"><div class="szeg">${gomb('kinek', 'magamnak', 'Magamnak', all.kinek === 'magamnak', false)}${gomb('kinek', 'ketto', 'Két személynek', all.kinek === 'ketto', !db('ketto'))}</div>`
      + `<div class="szeg harom">${MIT.map(([k, n]) => gomb('mit', k, n === 'Több piercing' ? '2–3 piercing' : n, all.mit === k, !db(all.kinek, k))).join('')}</div></div>`
      + `<div class="pk-info"><p class="pk-info-sor"><span class="pk-ertek"><b class="pk-csillag" aria-hidden="true">★</b> 4,8 · 5000+ <span class="pk-ertek-hosszu">Google-</span>értékelés</span><button class="pk-szuras" data-szuras aria-haspopup="dialog"><span class="pk-play">${PLAY}</span>Hogy néz ki egy szúrás?</button></p>`
      + `<p class="pk-tart"><b>Az ár tartalmazza:</b> ${kozerzet ? 'titán ékszer · érzéstelenítő spray · gépi bemérés · ingyenes kontroll · garancia' : 'steril szúrás · G23 titánium ékszer vagy a hozott fülbevalód · ingyenes kontroll'}</p></div>`
      + `<div class="pk-lista">${mutat.map((s) => pkKartya(s)).join('')}</div>`;
  }
  const SZURAS_VIDEO = '<video src="/assets/video/f18724_e7b1f3b8462543879dbec7bbe759b379.mp4" poster="/assets/img/f18724_e7b1f3b8462543879dbec7bbe759b379f000.webp" controls autoplay playsinline preload="auto"></video>';
  const PLAY = '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>';
  const NYIL_LE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const NYIL_JOBBRA = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // egy kartya: fej (ikon, nev, rovid leiras, ar) + lenyithato test + a ket gomb (Részletek / Időpontot választok)
  function pkKartya(s) {
    const a = pkAdat(s);
    const e = eredetiAr(s);
    const nyitva = all.nyitott === s.serviceId;
    const ikon = ikonKod(s);
    const id = esc(s.serviceId);
    const fej = `<button class="pk-fej" data-nyit="${id}" aria-expanded="${nyitva}" aria-controls="pk-t-${id}"><span class="pk-ikon">${ikon ? `<img src="/assets/img/ikon/${ikon}.webp" alt="" width="26" height="26" decoding="async">` : ''}</span>`
      + `<span class="pk-cim"><b>${esc(a.nev)}</b><small>${esc(a.rovid)}</small></span><span class="pk-ar">${e ? `<s>${ft(e)}</s>` : ''}<b>${ft(s.activePrice)}</b></span></button>`;
    let test = '';
    if (a.foto) test += `<div class="pk-pont"><img src="/assets/img/uj-galeria-${a.foto}-2.webp" alt="A ${esc(a.nev.toLowerCase())} piercing helye a fülön" width="300" height="300" loading="lazy" decoding="async"><div><b>Vendégeink általában ezeken érnek el javulást:</b><p>${esc(a.javulas)}</p></div></div>`;
    if (a.kedvezmeny) test += a.kedvezmeny;
    if (a.csomag) test += `<div class="pk-csomag">${a.csomag}</div>`;
    if (a.garancia) test += '<p class="pk-garancia"><b>Garancia:</b> ha 6 hét után nem tapasztalsz javulást, 6 hónapon belül megerősítő piercinget kapsz, csak az új ékszer áráért.</p>';
    const gombok = `<div class="pk-gombok"><button class="pk-reszlet" data-nyit="${id}" aria-expanded="${nyitva}" aria-controls="pk-t-${id}">${nyitva ? 'Bezár' : 'Részletek'}${NYIL_LE}</button>`
      + `<button class="pk-valaszt" data-szolg="${id}" title="${esc(szepNev(s.name))}">Időpontot választok${NYIL_JOBBRA}<span class="rejtett"><span class="nev"><span>${esc(rovidNev(s.name))}</span></span><span class="ar">${e ? `<s>${ft(e)}</s>` : ''}${ft(s.activePrice)}</span></span></button></div>`;
    return `<div class="pk${nyitva ? ' nyitva' : ''}" data-pk="${id}">${fej}<div class="pk-test" id="pk-t-${id}"${nyitva ? '' : ' hidden'}>${test}</div>${gombok}</div>`;
  }
  // a kartya szovegei a Salonic-szolgaltatasbol: tipus (1 piercing), csomag (2 / 3 piercing, ket szemelynek), fulbevalo
  const PK = {
    mi: ['Migrén', 'fejfájás, migrén, frontérzékenység', 'migrénes, tenziós és cluster fejfájás, frontérzékenység', 'migren'],
    sh: ['Shenmen', 'stressz, alvászavar, szorongás', 'stressz, alvászavar, szorongás, nyugtalanság, pánikrohamok', 'shenmen'],
    kl: ['Klimax', 'hőhullám, izzadás, alvászavar', 'a változókor tünetei: hőhullám, izzadás, alvászavar, hangulatingadozás', 'klimax'],
    sl: ['Slim', 'étvágy, édesség utáni vágy', 'megnövekedett étvágy, falási rohamok, édesség utáni vágy', 'slim'],
    al: ['Allergia', 'szénanátha, tüsszögés, szemviszketés', 'légúti allergia, szénanátha, tüsszögés, szemszárazság, szemviszketés', 'allergia'],
    mj: ['Máj', 'puffadás, fáradtság, ingerlékenység', 'puffadás, emésztési panaszok, hormonális egyensúlyzavar, fáradtság', 'maj'],
    lp: ['Lép', 'puffadás, fáradtság, gyenge immunrendszer', 'puffadás étkezések után, állandó fáradtság, legyengült immunrendszer, PMS', 'lep'],
    vb: ['Vastagbél', 'székrekedés, puffadás, bőrproblémák', 'székrekedés, hasi feszülés, bőrproblémák, bélflóra-egyensúlytalanság', 'vastagbel'],
    pm: ['Pajzsmirigy', 'fáradékonyság, hormonproblémák', 'pajzsmirigy-rendellenesség, fáradékonyság, hormonproblémák, hajhullás', 'pajzsmirigy'],
  };
  // a csomag-kedvezmeny magyarazata (a tulajdonos kerese, 2026-10-16): mennyibe kerulne kulon-kulon, mennyi most, mennyit sporol – a helyszin mostani
  // Salonic-araibol (egy = a legolcsobb 1 db kozerzetjavito piercing, ketto / harom = a 2 / 3 piercinges csomag, ful = 1 db fulbevalo)
  const arakBol = (lista) => {
    const ar = (re) => { const s = lista.find((x) => re.test(szepNev(x.name))); return s ? s.activePrice : null; };
    const egyek = lista.filter((x) => /^1 db /i.test(szepNev(x.name)) && PK[tipusKod(x.name)]).map((x) => x.activePrice).filter((x) => x > 0);
    return { egy: egyek.length ? Math.min(...egyek) : null, ketto: ar(/^2 PIERCING/i), harom: ar(/^3 PIERCING/i), ful: ar(/^1 db f\S*lbeval/i) };
  };
  const kedvezmeny = (sorok, ossz, db, egyAr, tobbes) => {
    const kulon = db * egyAr, sp = kulon - ossz;
    return `<div class="pk-kedv"><p class="pk-kedv-cim">${sp > 0 ? 'Így jön ki a kedvezmény' : 'Így jön ki az ár'}</p><ul>${sorok.map(([n, v]) => `<li><span>${n}</span><b>${v}</b></li>`).join('')}`
      + `<li class="pk-ossz"><span>Összesen most</span><b>${ft(ossz)}</b></li></ul>`
      + (sp > 0 ? `<p>Külön-külön ${db} × ${ft(egyAr)} = ${ft(kulon)} lenne. <b>Így ${ft(sp)}-ot spórol${tobbes ? 'tok' : 'sz'}.</b></p>` : '') + '</div>';
  };
  function pkAdat(s) {
    const n = szepNev(s.name);
    const A = all.arak || {};
    const p = s.activePrice;
    let m;
    if ((m = /(\d)\s*PIERCING/i.exec(n)) && !/szem\S*ynek/i.test(n)) {
      const d = +m[1];
      let rovid = d === 3 ? 'a harmadik csak 5000 Ft' : 'a második féláron', sorok = [];
      if (d === 2 && A.egy && p > A.egy) { sorok = [['1. piercing', ft(A.egy)], ['2. piercing', '+ ' + ft(p - A.egy)]]; rovid = `a 2. piercing csak ${ft(p - A.egy)}`; }
      if (d === 3 && A.egy && A.ketto > A.egy && p > A.ketto) { sorok = [['1. piercing', ft(A.egy)], ['2. piercing', '+ ' + ft(A.ketto - A.egy)], ['3. piercing', '+ ' + ft(p - A.ketto)]]; rovid = `a 3. piercing csak ${ft(p - A.ketto)}`; }
      return { nev: `${d} piercing`, rovid, garancia: true, kedvezmeny: sorok.length ? kedvezmeny(sorok, p, d, A.egy) : '',
        csomag: `<p>Bármelyik ${d === 3 ? 'három' : 'két'} piercinget választhatod; ha még nem tudod, melyiket, a szalonban segítünk.</p>` };
    }
    if ((m = /szem\S*ynek\s*[-–]\s*(\d)\s*db/i.exec(n))) {
      const d = +m[1], k = d / 2, fo = p / 2;
      const csomagAr = k === 1 ? A.egy : k === 2 ? A.ketto : k === 3 ? A.harom : null;
      const sorok = [[`1. személy · ${k} piercing`, ft(fo)], [`2. személy · ${k} piercing`, ft(fo)]];
      return { nev: `2 személynek – ${d} db`, rovid: `egy időpontra jöttök, fejenként ${k} piercing`, garancia: true,
        kedvezmeny: A.egy && Number.isInteger(fo) ? kedvezmeny(sorok, p, d, A.egy, true) : '',
        csomag: `<p>${k > 1 && csomagAr && csomagAr * 2 === p ? `Mintha mindketten a ${k} piercinges csomagot vennétek. ` : ''}Bármelyik típusból választhattok; a szalonban segítünk dönteni.</p>` };
    }
    if ((m = /^(\d)\s*db\s*f\S*lbeval/i.exec(n))) {
      const d = +m[1];
      return { nev: `Fülbevaló – ${m[1]} db`, rovid: 'divat fülpiercing, saját vagy hozott ékszerrel', garancia: false,
        kedvezmeny: d > 1 && A.ful && p > A.ful ? kedvezmeny([['1. fülbevaló', ft(A.ful)], [`további ${d - 1} db`, '+ ' + ft(p - A.ful)]], p, d, A.ful) : '',
        csomag: '<p>Nem közérzetjavító piercing: a fülcimpába kerül, steril és biztonságos behelyezéssel, G23 titánium ékszerrel vagy a hozott fülbevalóddal.</p>' };
    }
    if (/^1\+1/i.test(n)) return { nev: 'Allergia 1+1', rovid: 'két allergia piercing egy időpontban', garancia: true, csomag: '',
      kedvezmeny: A.egy && p > A.egy ? kedvezmeny([['1. allergia piercing', ft(A.egy)], ['2. allergia piercing', '+ ' + ft(p - A.egy)]], p, 2, A.egy) : '' };
    const t = PK[tipusKod(n)];
    if (t) return { nev: t[0], rovid: t[1], javulas: t[2], foto: t[3], garancia: true };
    return { nev: rovidNev(n), rovid: '', garancia: false };
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
      + (munkatarsak.length > 1 ? `<div class="alcim">Szakember</div><div class="chipek"><button class="chip${all.staffId ? '' : ' valasztott'}" data-staff="">${BARKI_JEL}</button>${munkatarsak.map(([id, n]) => `<button class="chip${all.staffId === id ? ' valasztott' : ''}" data-staff="${esc(id)}" title="${esc(n)}" aria-label="${esc(n)}">${szakemberJel(n)}</button>`).join('')}</div>`
        // ha egy helyszinen csak egy szakember van, nem valasztatunk, de kijelolve mutatjuk (fejkep + nev), hogy a vendeg lassa, kihez megy
        : munkatarsak.length === 1 ? `<div class="alcim">Szakember</div><div class="chipek"><span class="chip valasztott egy" title="${esc(munkatarsak[0][1])}" aria-label="Szakember: ${esc(munkatarsak[0][1])}">${szakemberJel(munkatarsak[0][1])}</span></div>` : '')
      + `<div class="honap-fej"><button class="gomb-ikon" data-honap="${hi > 0 ? honapok[hi - 1] : ''}" ${hi > 0 ? '' : 'disabled style="visibility:hidden"'} aria-label="Előző hónap">‹</button><span>${ev}. ${HONAP[ho - 1]}</span><button class="gomb-ikon" data-honap="${hi < honapok.length - 1 ? honapok[hi + 1] : ''}" ${hi < honapok.length - 1 ? '' : 'disabled style="visibility:hidden"'} aria-label="Következő hónap">›</button></div>`
      + `<div class="racs">${racs}</div>${all.tovabbi ? '<div class="kicsi tovabbi">További napok betöltése…</div>' : ''}<div class="alcim">${esc(napCim(all.nap))}</div><div class="idok">${idok.map((x) => `<button class="ido" data-slot="${x.start_unix}">${sb(x).ido}</button>`).join('')}</div>`;
  }

  // az adatlap tetejen: melyik szakemberhez szol a foglalas (a kijelolt szakember, vagy a helyszin egyetlen szakembere, kulonben "Barki" - ilyenkor a Salonic
  // osztja ki); a Salonic adatlapja a szakembert nem mutatja
  const adatlapSzakember = () => {
    const mt = [...new Map((all.slotok || []).filter((x) => x.staff_label).map((x) => [x.staff_id, x.staff_label])).entries()];
    const nev = all.staffId ? ((mt.find(([id]) => id === all.staffId) || [])[1] || (all.slot && all.slot.staff_label) || null) : mt.length === 1 ? mt[0][1] : null;
    return `<div class="adatlap-szakember"><span class="kicsi">Szakember</span><span class="chip valasztott egy" title="${esc(nev || 'Bármelyik szabad szakember')}" aria-label="Szakember: ${esc(nev || 'Bárki')}">${nev ? szakemberJel(nev) : BARKI_JEL}</span></div>`;
  };

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
    tartalom.innerHTML = osszegzes() + adatlapSzakember() + `<p class="kicsi adatlap-sugo" style="margin:0 0 8px">Add meg az adataidat, és véglegesítsd a foglalást. Ha az időpont közben elkelt, <button class="chip" data-lepes="ido">válassz másikat</button>.</p><div class="adatlap-burok"><iframe class="adatlap" title="Foglalási adatlap" src="${esc(u.href)}" allow="payment"></iframe></div>`;
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
    if (e.target.classList && e.target.classList.contains('pk-felugro')) return szurasZar();
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.hasAttribute('data-szuras-bezar')) return szurasZar();
    if (t.hasAttribute('data-bezar')) return bezar();
    if (t.hasAttribute('data-vissza')) return vissza();
    const d = t.dataset;
    if (d.tipus) { all.tipus = d.tipus; if (d.tipus === 'uj') { meres(); return ugrik('hely'); } return ugrik('urlap'); }
    if (d.kuld !== undefined) return urlapKuld();
    if (d.lepes && (t.classList.contains('kesz') || !t.closest('.lepesek'))) return visszaLep(d.lepes);
    if (d.hely) { all.placeId = +d.hely; all.szolg = null; all.nap = null; all.honap = null; all.staffId = null; return ugrik('szolg'); }
    if (d.kinek) { all.kinek = d.kinek; all.nyitott = null; return szolgRajzol(); }
    if (d.mit) { all.mit = d.mit; all.nyitott = null; return szolgRajzol(); }
    if (d.nyit) { all.nyitott = all.nyitott === d.nyit ? '' : d.nyit; szolgRajzol(); const k = shadow.querySelector(`.pk[data-pk="${d.nyit}"]`); if (k && all.nyitott) k.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if (d.szuras !== undefined) return szurasNyit(t);
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
  // "Hogy néz ki egy szúrás?": felugro, bezarhato video (a tulajdonos kerese, 2026-10-16); az X, a hatterre kattintas vagy az Esc zarja (a foglalo nyitva marad)
  let szurasNyito = null;
  function szurasZar() {
    const f = shadow.querySelector('.pk-felugro');
    if (!f) return false;
    const v = f.querySelector('video'); if (v) v.pause();
    f.remove();
    if (szurasNyito && szurasNyito.isConnected) szurasNyito.focus({ preventScroll: true });
    szurasNyito = null;
    return true;
  }
  function szurasNyit(gomb) {
    szurasZar();
    szurasNyito = gomb;
    const f = document.createElement('div');
    f.className = 'pk-felugro'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-label', 'Hogy néz ki egy szúrás?');
    f.innerHTML = `<div class="pk-felugro-doboz"><p class="pk-felugro-cim">Hogy néz ki egy szúrás?</p>${SZURAS_VIDEO}<button class="pk-felugro-x" data-szuras-bezar aria-label="Bezárás">×</button></div>`;
    $('.fatyol').appendChild(f);
    const v = f.querySelector('video');
    const p = v.play();
    if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => {}); });
    f.querySelector('.pk-felugro-x').focus({ preventScroll: true });
  }
  const billentyu = (e) => { if (e.key !== 'Escape') return; if (szurasZar()) return; if (all.lepes !== 'adatlap') bezar(); };
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
    document.documentElement.removeAttribute('data-mp-motor-nyitva');
    if (nyitott && nyitott.host === host) nyitott = null;
    try { if (typeof ctx.bezarasUtan === 'function') ctx.bezarasUtan(); } catch (e) { /* */ }
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
