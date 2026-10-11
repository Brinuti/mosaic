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
const NAPOK = 62;
const HONAP = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
const NAP_ROVID = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const NAP_NEV = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

const adapter = createSalonicAdapter({ storage: (() => { try { return window.sessionStorage; } catch (e) { return null; } })() });
const foglalas = createBookingContext({ storage: (() => { try { return window.sessionStorage; } catch (e) { return null; } })() });

// --- segedek ------------------------------------------------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ft = (n) => (n === null || n === undefined ? '' : n.toLocaleString('hu-HU').replace(/\s/g, '.') + ' Ft');
// a budapesti ido (a Salonic idopontjai unix mp-ben; a vendeg Magyarorszagon van, de a gep ideje mas lehet)
const bp = (unix) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(unix * 1000)).map((x) => [x.type, x.value]));
  return { nap: `${p.year}-${p.month}-${p.day}`, ido: `${p.hour}:${p.minute}`, ev: +p.year, ho: +p.month, d: +p.day };
};
const napCim = (nap) => { const [e, h, d] = nap.split('-').map(Number); const w = new Date(Date.UTC(e, h - 1, d)).getUTCDay(); return `${HONAP[h - 1]} ${d}., ${NAP_NEV[w]}`; };
const gtagEsemeny = (nev, param) => { try { if (typeof window.gtag === 'function') window.gtag('event', nev, { send_to: 'G-SJT2RN62H8', ...param }); } catch (e) { /* a meres nem allithatja meg a foglalast */ } };

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.fatyol { position: fixed; inset: 0; z-index: 2147483000; background: rgba(39, 40, 52, .55); display: flex; align-items: center; justify-content: center; font-family: 'helvetica-w01-light', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #454659; }
.ablak { background: #fff; width: min(620px, 100vw); height: min(860px, 100dvh); display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; box-shadow: 0 18px 60px rgba(0,0,0,.25); }
@media (max-width: 700px) { .ablak { width: 100vw; height: 100dvh; border-radius: 0; } }
.fej { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #ece7e6; background: #fff; }
.fej h2 { flex: 1; margin: 0; font: 600 18px/1.25 'poppins-semibold', Poppins, Arial, sans-serif; }
.gomb-ikon { border: 0; background: #f6efee; color: #454659; width: 38px; height: 38px; border-radius: 50%; font-size: 20px; line-height: 38px; cursor: pointer; flex: none; }
.gomb-ikon:hover { background: #f5d3ca; }
.lepesek { display: flex; gap: 6px; padding: 10px 16px 0; font-size: 12px; }
.lepesek button { flex: 1; border: 0; background: none; padding: 0 0 8px; border-bottom: 3px solid #ece7e6; color: #9a9aa8; font: inherit; cursor: default; text-align: left; }
.lepesek button.kesz { border-color: #d7aba8; color: #454659; cursor: pointer; }
.lepesek button.most { border-color: #ab6354; color: #454659; font-weight: 700; }
.tartalom { flex: 1; overflow: auto; padding: 16px; -webkit-overflow-scrolling: touch; outline: none; }
.osszegzes { background: #faf4f3; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; font-size: 14px; line-height: 1.45; }
.osszegzes b { font-family: 'poppins-semibold', Poppins, Arial, sans-serif; font-weight: 600; }
.lista { display: grid; gap: 10px; }
.kartya { display: block; width: 100%; text-align: left; border: 1px solid #e8e6e6; border-radius: 12px; background: #fff; padding: 13px 14px; font: inherit; color: inherit; cursor: pointer; }
.kartya:hover, .kartya:focus-visible { border-color: #d7aba8; box-shadow: 0 0 0 3px #f5d3ca; outline: none; }
.kartya .nev { font: 600 16px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; }
.kartya .reszlet { margin-top: 3px; font-size: 13px; color: #6b6c80; }
.kartya .ar { float: right; font-weight: 700; color: #ab6354; margin-left: 10px; }
.cimke { display: inline-block; margin-top: 6px; font-size: 12px; background: #f5d3ca; color: #78463e; border-radius: 99px; padding: 2px 9px; }
.alcim { margin: 18px 0 8px; font: 600 14px/1.3 'poppins-semibold', Poppins, Arial, sans-serif; color: #6b6c80; text-transform: uppercase; letter-spacing: .04em; }
.chipek { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.chip { border: 1px solid #e8e6e6; background: #fff; border-radius: 99px; padding: 7px 13px; font: inherit; font-size: 14px; cursor: pointer; color: inherit; }
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
.kicsi { font-size: 13px; color: #6b6c80; }
`;

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
  const tovabbi = [...link.searchParams].filter(([k]) => TOVABB.test(k));
  const all = {
    lepes: 'hely', placeId: HELYSZINEK[ctx.placeId] ? +ctx.placeId : null, serviceId: ctx.serviceId || null,
    staffId: ctx.employeeId ? String(ctx.employeeId) : null, nap: null, honap: null, slotok: null, szolg: null, bookingId: null, expected: null,
  };
  const ctxFoglalas = foglalas.begin({ business: 'mp', source_page: ctx.forras || location.pathname });
  all.bookingId = ctxFoglalas.id;
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
  const LEPESEK = [['hely', 'Helyszín'], ['szolg', 'Kezelés'], ['ido', 'Időpont'], ['adatlap', 'Adatok']];
  const lepesjelzo = () => {
    const i = LEPESEK.findIndex(([k]) => k === all.lepes);
    $('.lepesek').innerHTML = LEPESEK.map(([k, n], j) => `<button data-lepes="${k}" class="${j < i ? 'kesz' : j === i ? 'most' : ''}" ${j < i ? '' : 'tabindex="-1"'}>${j + 1}. ${n}</button>`).join('');
    $('[data-vissza]').hidden = i <= 0;
    $('.ablak').dataset.lepes = all.lepes;
    const h = all.lepes === 'adatlap' && all.placeId && HELYSZINEK[all.placeId];
    $('.fej h2').textContent = h ? `${h.varos} · Adatok` : 'Időpontfoglalás';
  };
  const ugrik = (lepes) => { all.lepes = lepes; rajzol(); };
  const vissza = () => {
    const i = LEPESEK.findIndex(([k]) => k === all.lepes);
    if (i > 0) ugrik(LEPESEK[i - 1][0]);
  };

  const osszegzes = () => {
    const h = all.placeId && HELYSZINEK[all.placeId];
    const s = all.szolg;
    const sor = [];
    if (h) sor.push(`<b>${esc(h.varos)}</b>`);
    if (s) sor.push(`${esc(s.name)} · ${ft(s.activePrice)}`);
    if (all.slot) sor.push(`${napCim(bp(all.slot.start_unix).nap)}, <b>${bp(all.slot.start_unix).ido}</b>`);
    return sor.length ? `<div class="osszegzes">${sor.join('<br>')}</div>` : '';
  };

  // --- 1. helyszin ---
  function helyszinLepes() {
    tartalom.innerHTML = `<p class="kicsi" style="margin-top:0">Válaszd ki, hol szeretnéd a piercinget.</p><div class="lista">${HELYSZIN_SORREND.map((id) => {
      const h = HELYSZINEK[id];
      return `<button class="kartya" data-hely="${id}"><span class="nev">${esc(h.varos)}</span><div class="reszlet">${h.kitelepules ? 'Kitelepülés: a következő szabad napok a naptárban' : 'Állandó rendelő'}</div></button>`;
    }).join('')}</div>`;
  }

  // --- 2. szolgaltatas ---
  async function szolgaltatasLepes() {
    tartalom.innerHTML = osszegzes() + '<div class="toltes">A kezelések betöltése…</div>';
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
    const kartya = (s) => `<button class="kartya" data-szolg="${esc(s.serviceId)}"><span class="ar">${ft(s.activePrice)}</span><span class="nev">${esc(s.name)}</span><div class="reszlet">${s.durationMin ? s.durationMin + ' perc' : ''}${s.listPrice ? ` · <s>${ft(s.listPrice)}</s>` : ''}</div></button>`;
    const ajanlott = t ? lista.filter((s) => tipusKod(s.name) === t) : [];
    const tobbi = lista.filter((s) => !ajanlott.includes(s));
    tartalom.innerHTML = osszegzes() + (ajanlott.length ? `<div class="alcim">Ajánlott</div><div class="lista">${ajanlott.map(kartya).join('')}</div><div class="alcim">További kezelések</div>` : '') + `<div class="lista">${tobbi.map(kartya).join('')}</div>`;
    tartalom._lista = lista;
  }

  // --- 3. idopont ---
  async function idopontLepes() {
    tartalom.innerHTML = osszegzes() + '<div class="toltes">A szabad időpontok betöltése…</div>';
    const s = all.szolg;
    let elso;
    try {
      elso = await adapter.getAvailability(all.placeId, s.serviceId, {
        days: NAPOK, firstDays: 21, minLeadMinutes: 30,
        onMore: (l) => { if (l && all.lepes === 'ido' && all.szolg === s && !lezart) { all.slotok = l; naptar(); } },
      });
    } catch (e) { return hiba('idopontok', e); }
    if (all.lepes !== 'ido' || all.szolg !== s || lezart) return;
    all.slotok = elso;
    naptar();
  }
  function naptar() {
    const s = all.szolg;
    const munkatarsak = [...new Map(all.slotok.filter((x) => x.staff_label).map((x) => [x.staff_id, x.staff_label])).entries()];
    if (all.staffId && !munkatarsak.some(([id]) => id === all.staffId)) all.staffId = null; // a linkbeli szakembernek nincs ideje: barki
    const sajat = all.staffId ? all.slotok.filter((x) => x.staff_id === all.staffId) : all.slotok;
    const napok = new Map();
    for (const x of sajat) { const b = bp(x.start_unix); if (!napok.has(b.nap)) napok.set(b.nap, []); napok.get(b.nap).push(x); }
    if (!sajat.length) {
      tartalom.innerHTML = osszegzes() + `<p class="uzenet">A következő ${NAPOK} napban ezen a helyszínen erre a kezelésre nincs szabad időpont.${munkatarsak.length > 1 && all.staffId ? '' : ''}</p><p><button class="gomb masodlagos" data-lepes="szolg">Másik kezelés</button> <button class="gomb masodlagos" data-lepes="hely">Másik helyszín</button></p>`;
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
    const idok = [...new Map(napok.get(all.nap).map((x) => [bp(x.start_unix).ido, x])).values()].sort((a, b) => a.start_unix - b.start_unix);
    tartalom.innerHTML = osszegzes()
      + (munkatarsak.length > 1 ? `<div class="alcim">Szakember</div><div class="chipek"><button class="chip${all.staffId ? '' : ' valasztott'}" data-staff="">Bárki</button>${munkatarsak.map(([id, n]) => `<button class="chip${all.staffId === id ? ' valasztott' : ''}" data-staff="${esc(id)}">${esc(n)}</button>`).join('')}</div>` : '')
      + `<div class="honap-fej"><button class="gomb-ikon" data-honap="${hi > 0 ? honapok[hi - 1] : ''}" ${hi > 0 ? '' : 'disabled style="visibility:hidden"'} aria-label="Előző hónap">‹</button><span>${ev}. ${HONAP[ho - 1]}</span><button class="gomb-ikon" data-honap="${hi < honapok.length - 1 ? honapok[hi + 1] : ''}" ${hi < honapok.length - 1 ? '' : 'disabled style="visibility:hidden"'} aria-label="Következő hónap">›</button></div>`
      + `<div class="racs">${racs}</div><div class="alcim">${esc(napCim(all.nap))}</div><div class="idok">${idok.map((x) => `<button class="ido" data-slot="${x.start_unix}">${bp(x.start_unix).ido}</button>`).join('')}</div>`;
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
    if (d.lepes && (t.classList.contains('kesz') || !t.closest('.lepesek'))) {
      if (d.lepes === 'hely') { all.placeId = null; all.szolg = null; all.slot = null; all.nap = null; all.honap = null; }
      if (d.lepes === 'szolg') { all.szolg = null; all.slot = null; all.nap = null; all.honap = null; }
      if (d.lepes === 'ido') { all.slot = null; }
      return ugrik(d.lepes);
    }
    if (d.hely) { all.placeId = +d.hely; all.szolg = null; all.nap = null; all.honap = null; all.staffId = null; return ugrik('szolg'); }
    if (d.szolg) { all.szolg = (tartalom._lista || []).find((x) => x.serviceId === d.szolg) || null; all.nap = null; all.honap = null; if (all.szolg) ugrik('ido'); return; }
    if (d.staff !== undefined) { all.staffId = d.staff || null; all.nap = null; all.honap = null; return naptar(); }
    if (d.honap) { all.honap = d.honap; const elso = [...new Set(all.slotok.map((x) => bp(x.start_unix).nap))].sort().find((k) => k.startsWith(d.honap)); if (elso) all.nap = elso; return naptar(); }
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
