// Gyogytornaszom.hu foglalomotor - a helyben nyilo foglalo (a MOSAIC Booking Engine / Medical Piercing motor adaptacioja).
//
// Lepesek: szolgaltatas -> (valtozat) -> helyszin -> szakember -> idopont (havi naptar) -> a Salonic beagyazott adatlapja -> koszonooldal.
// A foglalast a Salonic adatlapja rogziti (reCAPTCHA mogott); a motor csak olvas a Salonicbol (salonic-adapter.js). A motor semmilyen mero-esemenyt
// nem kuld a lepesekrol (nincs view_item / select_employee / foglalas_inditasa): CSAK a sikeres foglalas utan, a koszonooldalon, az egyszeri
// tokennel egyetlen dataLayer.push({event:'foglalas_kesz', tipus, ertek, tranzakcio_id}) (GY-15 5. pont; a launcher.js tolti be).
//
// A foglalo az URL-t NEM irja at (nincs history.pushState / replaceState): a GTM History Change triggerei igy nem kuldenek felesleges esemenyt.
// Bezaras: X gomb / Esc; vissza: a lepesjelzo / a "Vissza" gomb. Mobilon teljes kepernyos reteg, asztalon kozepre nyilo panel.
// Hiba eseten (a Salonic nem valaszol): a vendeg a Salonic eredeti foglalojat kapja (tartalek-link).
// Egeszsegugyi adatot a motor nem kerdez es nem tarol: panaszt a Salonic adatlapja kerdezhet, az a Salonicnal marad.
import { createSalonicAdapter, HELYSZINEK, HELYSZIN_SORREND, ANY_STAFF, HOST, foglalasTipus } from './salonic-adapter.js';
import { createBookingContext } from './booking-id.js';

const TOVABB = /^(utm_[a-z_]+)$/i; // a Salonic-adatlapra csak az utm_* megy tovabb (a Google click-ID NEM: az a sajat tartomanyon, a Workernel marad)
const NAPOK = 100; // a Salonic ~65-80 napra elore ad idopontot; 100 nap biztosan mindet lefedi
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const NAP_ROVID = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const NAP_NEV = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const TOKEN_KULCS = 'gy_tk';
const tarolo = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();

// A szolgaltatasok csoportositasa a "Mire szeretnel idopontot?" kartyakhoz. CSAK megjelenites: az ar, az idotartam, a szakemberek, a helyszinek mindig a
// Salonicbol jonnek; ami itt nem szerepel (uj Salonic-szolgaltatas), az "Egyeb szolgaltatas" alatt latszik, igy semmi nem tunik el.
const CSALADOK = [
  { kod: 'allapotfelmeres', nev: 'Állapotfelmérés', leiras: 'Első alkalom: részletes vizsgálat és személyre szabott terv', ids: ['24666', '416586'], kiemelt: true },
  { kod: 'gyogytorna', nev: 'Gyógytorna kezelés', leiras: 'Visszatérő vendégeknek, a 2. alkalomtól', ids: ['24667'] },
  { kod: 'allkapocs', nev: 'Állkapocs kezelés', leiras: 'Állkapocs-kezelés gyógytornásszal', ids: ['27315'] },
  { kod: 'gyogymasszazs', nev: 'Gyógymasszázs', leiras: 'Gyógymasszázs', ids: ['173650', '234838', '438133'] },
  { kod: 'online', nev: 'Online gyógytorna', leiras: 'Videóhíváson keresztül, otthonról', ids: ['36855'] },
];
// Kiemelt szakember (uzleti dontes, Feri 2026-10-13): a Batthyany teri rendeloben az akcios allapotfelmeresre Nora fogad legkorabban - a szakember- es a helyszin-lepesen
// narancs dobozzal kiemeljuk ("Ajanlott", "Rugalmasan elerheto idopontok", legkorabbi idopont: a Salonic ELO adataibol). Ha a Salonicban a szolgaltatas / szakember /
// helyszin kapcsolata megvaltozik, a kiemeles magatol eltunik (csak akkor jelenik meg, ha a szakember tenyleg elerheto a szolgaltatashoz).
const KIEMELT = [{ serviceId: '416586', placeId: 418, staffId: '33185', cimke: 'Ajánlott', alcim: 'Rugalmasan elérhető időpontok' }];
const kiemeltFor = (serviceId, placeId) => KIEMELT.find((k) => k.serviceId === String(serviceId) && (placeId === undefined || k.placeId === +placeId)) || null;
const csaladId = (s) => (CSALADOK.find((c) => c.ids.includes(s.serviceId)) || { kod: 'egyeb' }).kod;

const adapter = createSalonicAdapter({ storage: tarolo });
const foglalas = createBookingContext({ storage: tarolo });

// --- segedek ------------------------------------------------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ft = (n) => (n === null || n === undefined ? '' : n.toLocaleString('hu-HU').replace(/\s/g, '.') + ' Ft');
// a budapesti ido (a Salonic idopontjai unix mp-ben; a vendeg Magyarorszagon van, de a gep ideje mas lehet). EU-szabaly: nyari ido marcius utolso
// vasarnapjan 01:00 UTC-tol oktober utolso vasarnapjan 01:00 UTC-ig. Szamolt, nem Intl (a naptar tobb ezer idopontra hivja minden kattintaskor).
const DST = {};
const utolsoVasarnap = (ev, ho) => { const u = new Date(Date.UTC(ev, ho + 1, 0)); return Date.UTC(ev, ho, u.getUTCDate() - u.getUTCDay(), 1) / 1000; };
const nyariIdo = (unix) => { const ev = new Date(unix * 1000).getUTCFullYear(); const h = DST[ev] || (DST[ev] = [utolsoVasarnap(ev, 2), utolsoVasarnap(ev, 9)]); return unix >= h[0] && unix < h[1]; };
const k2 = (n) => (n < 10 ? '0' + n : '' + n);
export const bp = (unix) => {
  const t = new Date((unix + (nyariIdo(unix) ? 7200 : 3600)) * 1000);
  const ev = t.getUTCFullYear(), ho = t.getUTCMonth() + 1, d = t.getUTCDate();
  return { nap: `${ev}-${k2(ho)}-${k2(d)}`, ido: `${k2(t.getUTCHours())}:${k2(t.getUTCMinutes())}`, ev, ho, d };
};
const napSzoveg = (unix) => { // "ma 16:00" / "holnap 14:30" / "október 27., kedd 10:00"
  const b = bp(unix), most = Math.floor(Date.now() / 1000);
  if (b.nap === bp(most).nap) return `ma ${b.ido}`;
  if (b.nap === bp(most + 86400).nap) return `holnap ${b.ido}`;
  return `${napCim(b.nap)} ${b.ido}`;
};
const sb = (x) => x._b || (x._b = bp(x.start_unix));
const napCim = (nap) => { const [e, h, d] = nap.split('-').map(Number); const w = new Date(Date.UTC(e, h - 1, d)).getUTCDay(); return `${HONAP[h - 1]} ${d}., ${NAP_NEV[w]}`; };
const ekezetNelkul = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// a Salonic-nev elejen levo "1. alkalom - " / "2. alkalomtol - " jeloles nem kell a vendegnek (a kartya mar megmondja)
const szepNev = (n) => {
  let t = String(n || '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();
  // "Egyéni 20% Akciós Állapotfelmérés" -> "20% akciós állapotfelmérés" (a százalék-jelölés elöl; a Salonic neve csupa nagybetűs szavakból áll)
  const m = /^Egy[ée]ni\s+(\d+\s*%)\s+Akci[óo]s\s+(.+)$/i.exec(t);
  if (m) t = `${m[1].replace(/\s+/g, '')} akciós ${m[2].toLowerCase()}`;
  return t;
};
const akcioSzazalek = (n) => { const m = /(\d+)\s*%/.exec(String(n || '')); return /akci/i.test(String(n || '')) && m ? m[1] + '%' : null; };
const monogram = (nev) => { const sz = String(nev || '').trim().split(/\s+/).filter((x) => /\p{L}/u.test(x)); return (sz[sz.length > 1 ? 1 : 0] || '?')[0].toUpperCase(); };
const keresztnev = (nev) => { const sz = String(nev || '').trim().split(/\s+/).filter((x) => /\p{L}/u.test(x)); return sz.length > 1 ? sz.slice(1).join(' ') : sz[0] || ''; };

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.fatyol { position: fixed; inset: 0; z-index: 2147483000; background: rgba(1, 30, 60, .55); display: flex; align-items: center; justify-content: center; font-family: 'Poppins', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1b2733; }
.ablak { background: #fff; width: min(640px, 100vw); height: min(860px, 100dvh); display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; box-shadow: 0 18px 60px rgba(0,0,0,.28); }
@media (max-width: 700px) { .ablak { width: 100vw; height: 100dvh; border-radius: 0; } }
button, a { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
button:focus-visible, a:focus-visible { outline: 3px solid #70c69c; outline-offset: 2px; }
.fej { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid #e3ebf2; background: #fff; }
.fej h2 { margin: 0; text-align: center; font: 600 18px/1.25 'Poppins', 'Segoe UI', Arial, sans-serif; color: #0c4c8a; }
.gomb-ikon { border: 0; background: #eef4f9; color: #0c4c8a; width: 44px; height: 44px; border-radius: 50%; font-size: 24px; line-height: 44px; padding: 0; cursor: pointer; flex: none; }
.gomb-ikon[hidden] { display: block; visibility: hidden; }
.gomb-ikon:hover { background: #d9e8f4; }
.lepesek { display: flex; gap: 6px; padding: 0 16px; font-size: 12px; }
.lepesek button { flex: 1 1 auto; min-height: 44px; border: 0; background: none; padding: 15px 0 9px; border-bottom: 3px solid #e3ebf2; color: #8493a1; font: inherit; cursor: default; text-align: left; white-space: nowrap; }
.lepesek button.kesz { border-color: #70c69c; color: #1b2733; cursor: pointer; }
.lepesek button.most { border-color: #0c4c8a; color: #1b2733; font-weight: 700; }
@media (max-width: 700px) { .lepesek .sz { display: none; } }
.tartalom { flex: 1; overflow: auto; padding: 14px 16px; -webkit-overflow-scrolling: touch; outline: none; }
.osszegzes { background: #f3f8fc; border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; font-size: 14px; line-height: 1.4; }
.os-sor { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.os-ar { font-weight: 700; color: #0c4c8a; white-space: nowrap; }
.os-szolg { font-size: clamp(11px, 3.5vw, 14px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kicsi { font-size: 13px; color: #55687a; }
.kicsi.bevezeto { margin: 0 0 10px; font-size: 15px; color: #1b2733; font-weight: 600; }
.lista { display: grid; gap: 10px; }
.kartya { display: block; width: 100%; text-align: left; border: 1px solid #dbe5ee; border-radius: 12px; background: #fff; padding: 13px 14px; font: inherit; color: inherit; cursor: pointer; }
.kartya:hover, .kartya:focus-visible { border-color: #70c69c; box-shadow: 0 0 0 3px #d9f1e6; outline: none; }
.kartya .nev { font: 600 16px/1.3 'Poppins', 'Segoe UI', Arial, sans-serif; }
.kartya .reszlet { margin-top: 3px; font-size: 13px; color: #55687a; }
.kartya .ar { float: right; font-weight: 700; color: #0c4c8a; margin-left: 10px; white-space: nowrap; }
.kartya.kiemelt { border: 2px solid #0c4c8a; background: #f3f8fc; }
.cimke { display: inline-block; margin-top: 6px; font-size: 12px; background: #e69500; color: #fff; border-radius: 99px; padding: 2px 10px; font-weight: 600; }
.elonezet-figy { background: #fff3cd; color: #664d03; border: 1px solid #ffda6a; border-radius: 8px; padding: 6px 10px; margin: 0 0 8px; font-size: 13px; }
.ablak[data-lepes="adatlap"] .tartalom > .elonezet-figy { flex: none; }
@media (max-width: 700px) { .ablak[data-lepes="adatlap"] .tartalom > .elonezet-figy { margin: 6px 10px 4px; } }
.kartya.szak.kiemelt { border: 2px solid #e69500; background: #fff8ea; }
.kartya.szak .cimke { margin-top: 0; }
.kartya.szak .kicsi { font-size: 11.5px; line-height: 1.3; }
.kiemelt-doboz { display: flex; gap: 12px; align-items: center; margin-top: 12px; border: 2px solid #e69500; background: #fff8ea; }
.kiemelt-doboz .szoveg { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
.kiemelt-doboz .kn { font-size: 15px; }
.kiemelt-doboz:hover, .kiemelt-doboz:focus-visible { border-color: #e69500; box-shadow: 0 0 0 3px #fbe3b3; }
.kartya.akcio { border: 2px solid #e69500; background: #fff8ea; }
.kartya.akcio:hover, .kartya.akcio:focus-visible { border-color: #e69500; box-shadow: 0 0 0 3px #fbe3b3; }
.cimke.zold { background: #70c69c; color: #06331e; }
.hely-racs { grid-template-columns: 1fr; }
@media (min-width: 701px) { .hely-racs { grid-template-columns: repeat(3, minmax(0, 1fr)); } .tipus-racs { grid-template-columns: 1fr 1fr; } .tipus-racs .kartya.kiemelt { grid-column: 1 / -1; } }
.kartya.hely .cim { margin-top: 3px; font-size: 12.5px; color: #55687a; }
.szak-racs { grid-template-columns: 1fr 1fr; gap: 8px; }
@media (min-width: 701px) { .szak-racs { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.kartya.szak { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 10px 6px; }
.kartya.szak.mindegy { grid-column: 1 / -1; flex-direction: row; justify-content: center; text-align: left; background: #f3f8fc; border: 2px solid #0c4c8a; padding: 12px; }
.fejkep { flex: none; width: 56px; height: 56px; border-radius: 50%; overflow: hidden; background: #dbe8f3; color: #0c4c8a; display: inline-flex; align-items: center; justify-content: center; font: 600 18px/1 'Poppins', Arial, sans-serif; }
.fejkep img { display: block; width: 100%; height: 100%; object-fit: cover; }
.kartya.szak .nev { font-size: 13.5px; line-height: 1.25; }
.kartya.szak.mindegy .nev { font-size: 15px; }
.alcim { margin: 18px 0 8px; font: 600 14px/1.3 'Poppins', Arial, sans-serif; color: #55687a; text-transform: uppercase; letter-spacing: .04em; }
.chipek { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #dbe5ee; background: #fff; border-radius: 99px; padding: 3px 13px 3px 3px; font: inherit; font-size: 14px; cursor: pointer; color: inherit; }
.chip .fejkep { width: 28px; height: 28px; font-size: 11px; }
.chip.valasztott { background: #0c4c8a; color: #fff; border-color: #0c4c8a; }
.honap-fej { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 8px; font: 600 16px/1 'Poppins', Arial, sans-serif; }
.racs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
.racs .fejnap { font-size: 12px; color: #8493a1; padding: 4px 0; }
.nap { border: 0; background: none; height: 42px; border-radius: 10px; font: inherit; font-size: 15px; color: #c3ced8; cursor: default; }
.nap.van { background: #eaf6f0; color: #1b2733; font-weight: 700; cursor: pointer; }
.nap.van:hover { background: #cdeadc; }
.nap.valasztott { background: #0c4c8a; color: #fff; }
.idok { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; margin-top: 10px; }
.ido { border: 1px solid #70c69c; background: #fff; border-radius: 10px; padding: 10px 0; font: 600 15px/1 'Poppins', Arial, sans-serif; color: #1b2733; cursor: pointer; }
.ido:hover, .ido:focus-visible { background: #70c69c; color: #06331e; outline: none; }
.gomb { display: inline-block; border: 0; border-radius: 99px; background: #e69500; color: #fff; padding: 12px 22px; font: 600 15px/1 'Poppins', Arial, sans-serif; cursor: pointer; text-decoration: none; }
.gomb.masodlagos { background: #eef4f9; color: #0c4c8a; }
.uzenet { padding: 18px 4px; line-height: 1.5; }
.toltes { padding: 30px 0; text-align: center; color: #55687a; }
.toltes::before { content: ''; display: block; width: 28px; height: 28px; margin: 0 auto 10px; border: 3px solid #d9f1e6; border-top-color: #0c4c8a; border-radius: 50%; animation: forog .8s linear infinite; }
@keyframes forog { to { transform: rotate(360deg); } }
.kicsi.tovabbi { margin: -4px 0 6px; text-align: center; font-size: 12px; }
iframe.adatlap { width: 100%; height: 100%; border: 0; display: block; }
.adatlap-burok { margin: 0 -16px -16px; }
.ablak[data-lepes="adatlap"] .tartalom { display: flex; flex-direction: column; overflow: hidden; }
.ablak[data-lepes="adatlap"] .adatlap-burok { flex: 1; min-height: 0; }
.ablak[data-lepes="adatlap"][data-stilus="1"] .osszegzes, .ablak[data-lepes="adatlap"][data-stilus="1"] .adatlap-sugo { display: none; }
@media (max-width: 700px) {
  .ablak[data-lepes="adatlap"] .osszegzes, .ablak[data-lepes="adatlap"] .adatlap-sugo { display: none; }
  .ablak[data-lepes="adatlap"] .lepesek button { min-height: 36px; padding-top: 8px; }
  .ablak[data-lepes="adatlap"] .tartalom { padding: 0; }
  .ablak[data-lepes="adatlap"] .adatlap-burok { margin: 0; }
}
.ablak[data-lepes="szolg"] .lepesek { display: none; }
`;

let nyitott = null;

/**
 * A foglalo megnyitasa. ctx: { placeId?, employeeId?, serviceId?, startUnix?, csalad? (allapotfelmeres|...), link (a kattintott Salonic-link), forras (oldal utvonala), bezarasUtan? }.
 * Az URL-ben megadott hely / szolgaltatas / szakember elore kitoltodik es a megfelelo lepes kimarad.
 */
export function nyit(ctx = {}) {
  if (nyitott) nyitott.bezar();
  const host = document.createElement('div');
  host.setAttribute('data-gy-motor', '');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${CSS}</style><div class="fatyol" role="dialog" aria-modal="true" aria-label="Időpontfoglalás"><div class="ablak"><div class="fej"><button class="gomb-ikon" data-vissza aria-label="Vissza" hidden>‹</button><h2>Időpontfoglalás</h2><button class="gomb-ikon" data-bezar aria-label="Bezárás">×</button></div><div class="lepesek"></div><div class="tartalom" tabindex="-1"></div></div></div>`;
  const elozoFokusz = document.activeElement;
  document.body.appendChild(host);
  // a hatter nem kezelheto: a host testvereit inert-te tesszuk (nyitott allapot alatt), bezaraskor visszaallitjuk; gorgetes-zar: csak overflow (nem body-fixed: ez okozta a Mosaic feher kepernyos hibajat)
  const inertek = [...document.body.children].filter((el) => el !== host && !el.inert && el.tagName !== 'SCRIPT').map((el) => { el.inert = true; return el; });
  const elozoOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  const nezet = document.querySelector('meta[name="viewport"]');
  const nezetEredeti = nezet ? nezet.getAttribute('content') : null;
  if (nezet && /width=320\b/.test(nezetEredeti || '')) nezet.setAttribute('content', 'width=device-width, initial-scale=1');
  const $ = (s) => shadow.querySelector(s);
  const tartalom = $('.tartalom');
  const link = (() => { try { return new URL(ctx.link || HOST + '/selectLocation'); } catch (e) { return new URL(HOST + '/selectLocation'); } })();
  const tovabbi = [...link.searchParams].filter(([k]) => TOVABB.test(k));
  const all = {
    lepes: 'szolg', csalad: null, placeId: HELYSZINEK[ctx.placeId] ? +ctx.placeId : null, serviceId: ctx.serviceId ? String(ctx.serviceId) : null,
    staffId: ctx.employeeId && +ctx.employeeId > 0 ? String(ctx.employeeId) : null, szolg: null, slot: null, nap: null, honap: null, slotok: null, expected: null,
    bookingId: null, startUnix: Number.isInteger(+ctx.startUnix) && +ctx.startUnix > 0 ? +ctx.startUnix : null, mindegy: false,
  };
  const ctxFoglalas = foglalas.begin({ business: 'gyogytorna', source_page: ctx.forras || location.pathname });
  all.bookingId = ctxFoglalas.id;
  let lezart = false;

  const tartalek = () => `<p class="uzenet">Most nem sikerült betölteni a foglalót. A foglalást a Salonic oldalán is el tudod végezni:</p><p><a class="gomb" href="${esc(link.href)}" target="_blank" rel="noopener">Tovább a foglaláshoz</a></p>`;
  const hiba = (ok, e) => {
    try { console.warn('[gy-motor]', ok, e && (e.code || e.message)); } catch (x) { /* */ }
    tartalek && (tartalom.innerHTML = tartalek());
  };

  // --- lepesjelzo ---
  const lepesek = () => {
    const l = [['szolg', 'Szolgáltatás']];
    if (all.csalad && (csaladSzolgak().length > 1)) l.push(['valt', 'Típus']);
    l.push(['hely', 'Helyszín'], ['szakember', 'Szakember'], ['ido', 'Időpont'], ['adatlap', 'Adatok']);
    return l;
  };
  const lepesjelzo = () => {
    const l = lepesek();
    const i = l.findIndex(([k]) => k === all.lepes);
    $('.lepesek').innerHTML = l.map(([k, n], j) => `<button data-lepes="${k}" class="${j < i ? 'kesz' : j === i ? 'most' : ''}" ${j < i ? '' : 'tabindex="-1"'}><span class="sz">${j + 1}. </span>${n}</button>`).join('');
    $('[data-vissza]').hidden = i <= 0;
    $('.ablak').dataset.lepes = all.lepes;
    const h = all.lepes === 'adatlap' && all.placeId && HELYSZINEK[all.placeId];
    $('.fej h2').textContent = h ? `${h.nev} · Adatok` : 'Időpontfoglalás';
  };
  const ugrik = (lepes) => { all.lepes = lepes; rajzol(); };
  // visszalepes: a cel lepes utani valasztasokat eldobja
  const visszaLep = (lepes) => {
    if (lepes === 'szolg') { all.csalad = null; all.szolg = null; all.serviceId = null; all.placeId = null; all.staffId = null; all.mindegy = false; all.slot = null; all.nap = null; all.honap = null; all.slotok = null; }
    if (lepes === 'valt') { all.szolg = null; all.serviceId = null; all.placeId = null; all.staffId = null; all.mindegy = false; all.slot = null; all.nap = null; all.honap = null; all.slotok = null; }
    if (lepes === 'hely') { all.placeId = null; all.staffId = null; all.mindegy = false; all.slot = null; all.nap = null; all.honap = null; all.slotok = null; }
    if (lepes === 'szakember') { all.staffId = null; all.mindegy = false; all.slot = null; all.nap = null; all.honap = null; all.slotok = null; }
    if (lepes === 'ido') { all.slot = null; }
    ugrik(lepes);
  };
  const vissza = () => { const l = lepesek(); const i = l.findIndex(([k]) => k === all.lepes); if (i > 0) visszaLep(l[i - 1][0]); };

  const osszegzes = () => {
    const h = all.placeId && HELYSZINEK[all.placeId];
    const s = all.szolg;
    const sor = [];
    if (h) sor.push(`<div class="os-sor"><span><b>${esc(h.nev)}</b>${s && s.durationMin ? `<span class="kicsi"> · ${s.durationMin} perc</span>` : ''}</span>${s ? `<span class="os-ar">${ft(s.activePrice)}</span>` : ''}</div>`);
    if (s) sor.push(`<div class="os-szolg" title="${esc(szepNev(s.name))}">${esc(szepNev(s.name))}</div>`);
    if (all.slot) sor.push(`<div>${napCim(bp(all.slot.start_unix).nap)}, <b>${bp(all.slot.start_unix).ido}</b></div>`);
    return sor.length ? `<div class="osszegzes">${sor.join('')}</div>` : '';
  };

  // --- az osszes helyszin szolgaltatasai (a csaladkartyakhoz); parhuzamos, az adapter cache-eli ---
  let mindSzolg = null;
  const osszesSzolgaltatas = async () => {
    if (mindSzolg) return mindSzolg;
    const lista = await Promise.all(HELYSZIN_SORREND.map((id) => adapter.getServices(id).then((l) => [id, l], () => [id, null])));
    if (lista.every(([, l]) => !l)) throw new Error('nincs_szolgaltatas');
    mindSzolg = Object.fromEntries(lista.filter(([, l]) => l));
    return mindSzolg;
  };
  const csaladSzolgak = () => {
    if (!mindSzolg || !all.csalad) return [];
    const egyedi = new Map();
    for (const [pid, l] of Object.entries(mindSzolg)) for (const s of l) if (csaladId(s) === all.csalad) { const e = egyedi.get(s.serviceId) || { ...s, helyek: [] }; e.helyek.push(+pid); egyedi.set(s.serviceId, e); }
    return [...egyedi.values()];
  };

  // --- 1. szolgaltatas (a foglalo fo oldala) ---
  async function szolgLepes() {
    tartalom.innerHTML = '<div class="toltes">A szolgáltatások betöltése…</div>';
    let m;
    try { m = await osszesSzolgaltatas(); } catch (e) { return hiba('szolgaltatasok', e); }
    if (all.lepes !== 'szolg' || lezart) return;
    // a link konkret szolgaltatast / helyet adott: a megfelelo lepes kimarad
    if (all.serviceId && !all.szolg) {
      for (const [pid, l] of Object.entries(m)) {
        const s = l.find((x) => x.serviceId === all.serviceId);
        if (s && (!all.placeId || all.placeId === +pid)) { all.csalad = csaladId(s); all.szolg = s; if (!all.placeId) all.placeId = +pid; break; }
      }
      if (all.szolg) return ugrik(all.staffId ? 'ido' : 'szakember');
      all.serviceId = null;
    }
    const jelen = new Set();
    for (const l of Object.values(m)) for (const s of l) jelen.add(csaladId(s));
    const kartyak = CSALADOK.filter((c) => jelen.has(c.kod)).map((c) => ({ ...c }));
    if (jelen.has('egyeb')) kartyak.push({ kod: 'egyeb', nev: 'Egyéb szolgáltatás', leiras: 'További szolgáltatásaink' });
    // az ajanlott csalad (a belepesi link kontextusa: pl. allapotfelmeres-landing) elore kerul
    if (ctx.csalad) kartyak.sort((a, b) => (b.kod === ctx.csalad) - (a.kod === ctx.csalad));
    tartalom.innerHTML = `<p class="kicsi bevezeto">Mire szeretnél időpontot foglalni?</p><div class="lista tipus-racs">${kartyak.map((c) => `<button class="kartya${c.kiemelt ? ' kiemelt' : ''}" data-csalad="${c.kod}"><span class="nev">${esc(c.nev)}</span>${c.kiemelt ? '<span class="cimke zold">Első alkalom</span>' : ''}<div class="reszlet">${esc(c.leiras)}</div></button>`).join('')}</div>`;
  }

  // --- 2. valtozat (ha a csaladban tobb szolgaltatas van: pl. allapotfelmeres normal / akcios) ---
  function valtLepes() {
    const l = csaladSzolgak().sort((a, b) => (akcioSzazalek(b.name) ? 1 : 0) - (akcioSzazalek(a.name) ? 1 : 0)); // az akcios valtozat elol
    const csalad = CSALADOK.find((c) => c.kod === all.csalad);
    tartalom.innerHTML = `<p class="kicsi bevezeto">${esc(csalad ? csalad.nev : 'Szolgáltatás')}: melyiket választod?</p><div class="lista">${l.map((s) => `<button class="kartya${akcioSzazalek(s.name) ? ' akcio' : ''}" data-valt="${esc(s.serviceId)}"><span class="ar">${ft(s.activePrice)}</span><span class="nev">${esc(szepNev(s.name))}</span>${akcioSzazalek(s.name) ? `<span class="cimke">${akcioSzazalek(s.name)} akció</span>` : ''}<div class="reszlet">${s.durationMin ? s.durationMin + ' perc' : ''}${akcioSzazalek(s.name) ? ' · csak bizonyos gyógytornászoknál' : ''}</div></button>`).join('')}</div>`;
  }

  // --- a kiemelt szakember legkorabbi idopontja (a Salonic ELO naptarabol; gyors, csak az o szabad idopontjai) ---
  all.kiem = {};
  const kiemeltIdo = (k) => {
    const kulcs = `${k.placeId}:${k.serviceId}:${k.staffId}`;
    if (!all.kiem[kulcs]) {
      all.kiem[kulcs] = adapter.getAvailability(k.placeId, k.serviceId, { staffId: +k.staffId, days: 21, minLeadMinutes: 30 })
        .then((l) => (l.length ? l.reduce((m, x) => (x.start_unix < m ? x.start_unix : m), l[0].start_unix) : null), () => null);
    }
    return all.kiem[kulcs];
  };
  // a "Legkorabbi idopont: holnap 14:30" sor kitoltese (aszinkron; ha nincs szabad idopont, a sor eltunik)
  const kiemeltIdoKitolt = (k) => {
    kiemeltIdo(k).then((t) => {
      for (const el of shadow.querySelectorAll(`[data-kiem-ido="${k.placeId}:${k.staffId}"]`)) {
        if (t) el.innerHTML = `Legkorábbi időpont: <b>${esc(napSzoveg(t))}</b>`; else el.remove();
      }
    });
  };
  const kiemeltFejkep = (e, nev) => `<span class="fejkep" aria-hidden="true">${e && e.foto ? `<img src="${esc(e.foto)}" alt="" width="56" height="56" loading="lazy" decoding="async">` : esc(monogram(nev))}</span>`;

  // --- 3. helyszin (csak ahol a valasztott szolgaltatas elerheto) ---
  function helyLepes() {
    const l = csaladSzolgak();
    const s = all.szolg ? l.find((x) => x.serviceId === all.szolg.serviceId) : null;
    const helyek = HELYSZIN_SORREND.filter((id) => (s ? s.helyek.includes(id) : l.some((x) => x.helyek.includes(id))));
    if (helyek.length === 1) { all.placeId = helyek[0]; return ugrik('szakember'); }
    const k = s && kiemeltFor(s.serviceId) && helyek.includes(kiemeltFor(s.serviceId).placeId) && s.helyek.includes(kiemeltFor(s.serviceId).placeId) ? kiemeltFor(s.serviceId) : null;
    tartalom.innerHTML = osszegzes() + `<p class="kicsi bevezeto">Melyik rendelőbe szeretnél menni?</p><div class="lista hely-racs">${helyek.map((id) => { const h = HELYSZINEK[id]; return `<button class="kartya hely" data-hely="${id}"><span class="nev">${esc(h.nev)}</span><div class="cim">${esc(h.cim)}</div></button>`; }).join('')}</div>` + (k ? '<div data-kiem-doboz></div>' : '');
    if (k) kiemeltDoboz(k);
  }
  // a rendelok ala kerulo narancs doboz: a kiemelt szakember, a rendelo es a legkorabbi idopont; kattintasra egybol az idopont-valasztora visz
  async function kiemeltDoboz(k) {
    let staff = {};
    try { staff = await adapter.getStaff(); } catch (e) { /* foto nelkul is megy */ }
    const e = staff[k.staffId];
    let eleres = false;
    try { const sv = (await adapter.getServices(k.placeId)).find((x) => x.serviceId === k.serviceId); eleres = !!(sv && sv.staffIds.includes(k.staffId)); } catch (x) { /* nincs doboz */ }
    const hely = shadow.querySelector('[data-kiem-doboz]');
    if (!e || !eleres || !hely || all.lepes !== 'hely' || lezart) return;
    hely.outerHTML = `<button class="kartya kiemelt-doboz" data-kiemelt="${k.placeId}:${k.staffId}">${kiemeltFejkep(e, e.nev)}<span class="szoveg"><span class="cimke">${esc(k.cimke)}</span><b class="kn">${esc(e.nev)} · ${esc(HELYSZINEK[k.placeId].nev)}</b><span class="kicsi">${esc(k.alcim)}</span><span class="kicsi" data-kiem-ido="${k.placeId}:${k.staffId}">Legkorábbi időpont betöltése…</span><span class="kicsi">A ${esc(HELYSZINEK[k.placeId].nev)} rendelőben ${esc(keresztnev(e.nev))} tud legelőször fogadni.</span></span></button>`;
    kiemeltIdoKitolt(k);
  }



  // --- 4. szakember (a "Mindegy - a legkorabbi idopont" legfelul) ---
  async function szakemberLepes() {
    tartalom.innerHTML = osszegzes() + '<div class="toltes">A szakemberek betöltése…</div>';
    let szolgLista, staff = {};
    try { szolgLista = await adapter.getServices(all.placeId); } catch (e) { return hiba('szolgaltatasok', e); }
    try { staff = await adapter.getStaff(); } catch (e) { /* fotok nelkul is megy: a nevek az idopont-lekeresbol jonnek */ }
    if (all.lepes !== 'szakember' || lezart) return;
    const s = szolgLista.find((x) => x.serviceId === all.szolg.serviceId);
    if (!s) return hiba('szolgaltatas', new Error('nincs_a_helyszinen'));
    all.szolg = s;
    elolt(s); // a szabad idopontok elotoltese, amig a vendeg szakembert valaszt
    const ok = s.staffIds;
    tartalom._staff = staff;
    const kiem = kiemeltFor(s.serviceId, all.placeId);
    const kartya = (id) => { const e = staff[id]; const nev = e ? e.nev : null; const kk = kiem && kiem.staffId === String(id) ? kiem : null; return `<button class="kartya szak${kk ? ' kiemelt' : ''}" data-szak="${esc(id)}"${nev ? ` title="${esc(nev)}"` : ''}><span class="fejkep" aria-hidden="true">${e && e.foto ? `<img src="${esc(e.foto)}" alt="" width="56" height="56" loading="lazy" decoding="async">` : esc(monogram(nev))}</span><span class="nev">${esc(nev ? keresztnev(nev) : 'Szakember')}</span>${kk ? `<span class="cimke">${esc(kk.cimke)}</span><span class="kicsi">${esc(kk.alcim)}</span><span class="kicsi" data-kiem-ido="${kk.placeId}:${kk.staffId}">Legkorábbi időpont betöltése…</span>` : ''}</button>`; };
    const sorrend = kiem && ok.includes(kiem.staffId) ? [kiem.staffId, ...ok.filter((i) => i !== kiem.staffId)] : ok;
    tartalom.innerHTML = osszegzes() + `<p class="kicsi bevezeto">Kihez szeretnél menni?</p><div class="lista szak-racs"><button class="kartya szak mindegy" data-szak=""><span class="fejkep" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM9 13c-2.7 0-5 1.4-5 3.5V18h10v-1.5C14 14.4 11.7 13 9 13Zm6.5.5c-.5 0-1 .1-1.4.2 1 .8 1.6 1.8 1.6 2.8V18H20v-1.2c0-1.8-2-3.3-4.5-3.3Z"/></svg></span><span class="nev"><b>Mindegy</b><br><span class="kicsi">a legkorábbi időpont érdekel</span></span></button>${sorrend.map(kartya).join('')}</div>`;
    if (kiem && ok.includes(kiem.staffId)) kiemeltIdoKitolt(kiem);
  }

  // --- 5. idopont ---
  // A szabad idopontokat mar a szakember-lepesnel elkezdjuk tolteni (a vendeg addig valaszt): az elso 7 nap ~0,5 mp, a tobbi resz parhuzamosan jon.
  const elolt = (s) => {
    const kulcs = `${all.placeId}:${s.serviceId}`;
    if (all.pre && all.pre.kulcs === kulcs && Date.now() - all.pre.t < 90000) return all.pre;
    const pre = { kulcs, t: Date.now(), kesz: false, lista: null, figyel: null };
    pre.elso = adapter.getAvailability(all.placeId, s.serviceId, {
      days: NAPOK, firstDays: 7, minLeadMinutes: 30,
      onMore: (l) => { pre.kesz = true; if (l) pre.lista = l; if (pre.figyel) pre.figyel(); },
    }).then((l) => { if (!pre.kesz && !pre.lista) pre.lista = l; return l; });
    pre.elso.catch(() => { if (all.pre === pre) all.pre = null; });
    all.pre = pre;
    return pre;
  };
  async function idopontLepes() {
    const s = all.szolg;
    const pre = elolt(s);
    if (!pre.lista) {
      tartalom.innerHTML = osszegzes() + '<div class="toltes">A szabad időpontok betöltése…</div>';
      try { await pre.elso; } catch (e) { return hiba('idopontok', e); }
      if (all.lepes !== 'ido' || all.szolg !== s || lezart) return;
    }
    all.slotok = pre.lista;
    all.tovabbi = !pre.kesz;
    pre.figyel = () => { if (all.lepes === 'ido' && all.szolg === s && !lezart && pre.lista) { all.slotok = pre.lista; all.tovabbi = false; naptar(); } };
    naptar();
  }
  function naptar() {
    const munkatarsak = [...new Map(all.slotok.filter((x) => x.staff_label).map((x) => [x.staff_id, x.staff_label])).entries()];
    if (all.staffId && !munkatarsak.some(([id]) => id === all.staffId)) all.staffId = null; // a valasztott szakembernek nincs ideje: barki
    const sajat = all.staffId ? all.slotok.filter((x) => x.staff_id === all.staffId) : all.slotok;
    const napok = new Map();
    for (const x of sajat) { const b = sb(x); if (!napok.has(b.nap)) napok.set(b.nap, []); napok.get(b.nap).push(x); }
    if (!sajat.length) {
      tartalom.innerHTML = osszegzes() + `<p class="uzenet">A következő ${NAPOK} napban ezen a helyszínen erre a szolgáltatásra nincs szabad időpont.</p><p><button class="gomb masodlagos" data-lepes="szakember">Másik szakember</button> <button class="gomb masodlagos" data-lepes="hely">Másik helyszín</button></p>`;
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
    const staff = tartalom._staff || {};
    const nevVal = all.staffId ? (staff[all.staffId] ? staff[all.staffId].nev : (munkatarsak.find(([id]) => id === all.staffId) || [])[1]) : null;
    tartalom.innerHTML = osszegzes()
      + (nevVal ? `<div class="kicsi">Szakember: <b>${esc(nevVal)}</b> · <button class="chip" data-lepes="szakember">másik szakember</button></div>` : all.mindegy ? '<div class="kicsi">Szakember: <b>mindegy, a legkorábbi időpont</b> · <button class="chip" data-lepes="szakember">szakembert választok</button></div>' : '')
      + `<div class="honap-fej"><button class="gomb-ikon" data-honap="${hi > 0 ? honapok[hi - 1] : ''}" ${hi > 0 ? '' : 'disabled style="visibility:hidden"'} aria-label="Előző hónap">‹</button><span>${ev}. ${HONAP[ho - 1]}</span><button class="gomb-ikon" data-honap="${hi < honapok.length - 1 ? honapok[hi + 1] : ''}" ${hi < honapok.length - 1 ? '' : 'disabled style="visibility:hidden"'} aria-label="Következő hónap">›</button></div>`
      + `<div class="racs">${racs}</div>${all.tovabbi ? '<div class="kicsi tovabbi">További napok betöltése…</div>' : ''}<div class="alcim">${esc(napCim(all.nap))}</div><div class="idok">${idok.map((x) => `<button class="ido" data-slot="${x.start_unix}">${sb(x).ido}</button>`).join('')}</div>`;
  }

  // --- 6. adatlap (a Salonic beagyazott urlapja) ---
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
    foglalas.update({ business: 'gyogytorna', service_id: all.szolg.serviceId, slot_unix: all.slot.start_unix, staff_id: all.staffId || '-1', carrier: 'back', sent_at: Date.now() });
    let stilus = null;
    try { stilus = (await adapter.getPresentation()).customCss; } catch (e) { /* alap kinezet */ }
    if (all.lepes !== 'adatlap' || lezart) return;
    $('.ablak').dataset.stilus = stilus ? '1' : '0';
    const elonezet = !/(^|\.)gyogytornaszom\.hu$/.test(location.hostname); // elonezeten / helyben: figyelmeztetes a veglegesito gomb elott
    tartalom.innerHTML = (elonezet ? '<div class="elonezet-figy" role="alert"><b>Előnézet:</b> ez valódi Salonic-foglalást hoz létre!</div>' : '') + osszegzes() + `<p class="kicsi adatlap-sugo" style="margin:0 0 8px">Add meg az adataidat, és véglegesítsd a foglalást. Ha az időpont közben elkelt, <button class="chip" data-lepes="ido">válassz másikat</button>.</p><div class="adatlap-burok"><iframe class="adatlap" name="gy-adatlap" title="Foglalási adatlap" src="${esc(u.href)}" allow="payment"></iframe></div>`;
  }

  async function rajzol() {
    lepesjelzo();
    tartalom.scrollTop = 0;
    if (all.lepes === 'szolg') return szolgLepes();
    if (all.lepes === 'valt') { if (all.szolg) { all.lepes = 'hely'; return rajzol(); } if (csaladSzolgak().length <= 1) { const l = csaladSzolgak(); all.szolg = l[0] || null; all.lepes = 'hely'; return rajzol(); } return valtLepes(); }
    if (all.lepes === 'hely') { if (all.placeId) { all.lepes = 'szakember'; return rajzol(); } return helyLepes(); }
    if (all.lepes === 'szakember') { if (all.staffId || all.mindegy) { all.lepes = 'ido'; return rajzol(); } return szakemberLepes(); }
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
    if (d.csalad) { all.csalad = d.csalad; all.szolg = null; all.placeId = null; all.staffId = null; return ugrik('valt'); }
    if (d.valt) { all.szolg = csaladSzolgak().find((x) => x.serviceId === d.valt) || null; all.placeId = null; if (all.szolg) return ugrik('hely'); return; }
    if (d.lepes && (t.classList.contains('kesz') || !t.closest('.lepesek'))) return visszaLep(d.lepes);
    if (d.kiemelt) { const [pid, sid] = d.kiemelt.split(':'); all.placeId = +pid; all.staffId = sid; all.mindegy = false; all.nap = null; all.honap = null; all.slotok = null; return ugrik('ido'); }
    if (d.hely) { all.placeId = +d.hely; all.staffId = null; all.mindegy = false; return ugrik('szakember'); }
    if (d.szak !== undefined) { all.staffId = d.szak || null; all.mindegy = !d.szak; all.nap = null; all.honap = null; all.slotok = null; return ugrik('ido'); }
    if (d.honap) { all.honap = d.honap; const elso = [...new Set(all.slotok.map((x) => sb(x).nap))].sort().find((k) => k.startsWith(d.honap)); if (elso) all.nap = elso; return naptar(); }
    if (d.nap) { all.nap = d.nap; return naptar(); }
    if (d.slot) {
      const unix = +d.slot;
      all.slot = (all.staffId ? all.slotok.filter((x) => x.staff_id === all.staffId) : all.slotok).find((x) => x.start_unix === unix) || null;
      if (all.slot) ugrik('adatlap');
    }
  });
  // fokuszcsapda: Tab / Shift+Tab a retegen belul marad (a Shadow DOM-ban a document.activeElement a host, a shadow.activeElement a belso elem)
  const billentyu = (e) => {
    if (e.key === 'Escape' && all.lepes !== 'adatlap') return bezar();
    if (e.key !== 'Tab') return;
    const f = [...shadow.querySelectorAll('button:not([disabled]):not([hidden]):not([tabindex="-1"]), a[href], iframe')].filter((el) => el.offsetParent !== null || el.tagName === 'IFRAME');
    if (!f.length) return;
    const elso = f[0], utolso = f[f.length - 1], aktiv = shadow.activeElement;
    if (e.shiftKey && (aktiv === elso || !aktiv)) { e.preventDefault(); utolso.focus(); } else if (!e.shiftKey && aktiv === utolso) { e.preventDefault(); elso.focus(); }
  };
  document.addEventListener('keydown', billentyu);

  // --- a koszonooldal jelzese (a Salonic a keretben a koszonooldalra iranyit; az ott futo launcher.js uzen a motornak) ---
  const KERET_ORIGIN = new Set([location.origin, 'https://www.gyogytornaszom.hu', 'https://gyogytornaszom.hu']);
  const uzenet = async (e) => {
    if (!KERET_ORIGIN.has(e.origin) || !e.data || e.data.tipus !== 'gy-foglalas-ok' || typeof e.data.url !== 'string') return;
    const iframe = shadow.querySelector('iframe.adatlap');
    if (!iframe || e.source !== iframe.contentWindow || lezart) return;
    if (!all.expected || !all.slot) return;
    lezart = true;
    const url = e.data.url;
    tartalom.innerHTML = '<div class="toltes">Sikeres foglalás, egy pillanat…</div>';
    const ell = (() => { try { return adapter.verifyConfirmation(url, all.expected); } catch (x) { return null; } })();
    foglalas.complete(ell ? ell.bookingId : null);
    // a szerver ellenorzi (Salonic elo adataival) es egyszeri koszono-tokent ad; hiba eseten a vendeg akkor is a koszonooldalra jut (esemeny nelkul)
    let ut = foglalasTipus(all.szolg.serviceId) === 'allapotfelmeres' ? '/allapot-ok/' : '/foglalas-ok/';
    try {
      const v = await fetch((ctx.apiBase || '') + '/api/gy-foglalas', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uuid: all.bookingId, place_id: all.placeId, service_id: all.szolg.serviceId, staff_id: all.staffId || '-1', start_unix: all.slot.start_unix, redirect_url: url }),
      });
      const j = v.ok ? await v.json() : null;
      if (j && typeof j.koszono === 'string' && /^\/(allapot-ok|foglalas-ok)\/$/.test(j.koszono)) ut = j.koszono;
      if (j && j.token && tarolo) { try { tarolo.setItem(TOKEN_KULCS, JSON.stringify({ token: j.token, t: Date.now() })); } catch (x) { /* privat mod: esemeny nelkul */ } }
    } catch (x) { /* a vendeg foglalasa megvan a Salonicban; a koszonooldal esemeny nelkul nyilik */ }
    // URL-parameter NELKUL (egeszsegugyi / foglalasi adat nem kerulhet URL-be): a token a sessionStorage-ban (fulenkent kulon), a koszonooldal POST-tal kapja az esemenyt
    location.assign(location.origin + ut);
  };
  window.addEventListener('message', uzenet);

  function bezar() {
    lezart = true;
    window.removeEventListener('message', uzenet);
    document.removeEventListener('keydown', billentyu);
    document.documentElement.style.overflow = elozoOverflow;
    for (const el of inertek) el.inert = false;
    if (nezet && nezetEredeti !== null && nezet.getAttribute('content') !== nezetEredeti) nezet.setAttribute('content', nezetEredeti);
    host.remove();
    if (nyitott && nyitott.host === host) nyitott = null;
    try { if (elozoFokusz && elozoFokusz.focus) elozoFokusz.focus({ preventScroll: true }); } catch (e) { /* */ }
    try { if (typeof ctx.bezarasUtan === 'function') ctx.bezarasUtan(); } catch (e) { /* */ }
  }
  nyitott = { host, bezar, destroyed: false };
  rajzol();
  $('.tartalom').focus({ preventScroll: true });
  return nyitott;
}

/** Elomelegites (a gomb fole vitt egerre / erintesre): a helyszinek szolgaltatasai + a munkatarsak. */
export function melegit(placeId) {
  const ids = HELYSZINEK[placeId] ? [placeId] : HELYSZIN_SORREND;
  for (const id of ids) adapter.getServices(id).catch(() => {});
  adapter.getStaff().catch(() => {});
}

export { ekezetNelkul as _ekezetNelkul };
