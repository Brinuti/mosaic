// MOSAIC Booking Engine V1 - a foglalo felulete (HeadSpa az elso uzletag)
//
// Allapotonkent egy nezet (lasd flow.js): szolgaltatas-valasztok (+ szakember: fodraszatnal elol HA0, oxigennel a szolgaltatas utan OXS) -> C1 (idopont: a PMU-foglalo
// havi naptara) -> C4 -> C5 -> C6, mellettuk A1/A2/A3.
// Nincs osszegzo kepernyo: az idopont kivalasztasa utan rogton a Salonic adatlapja (C4) jon.
// Adat: kizarolag a SalonicAdapter (Salonic nyilvanos oldalai + naptar-API), ar/idotartam/azonosito nincs beleegetve.
// C4: a Salonic beagyazott adatlapja (a foglalast a Salonic rogziti); a sikert a Salonic atiranyitasanak parameterei
// igazoljak (adapter.verifyConfirmation, kliensoldali). Ez a probaoldal NEM nyitja meg az eles koszonooldalt, mert ott mereskod
// futna; elesitesnel kulon dontes (docs/booking-engine/DECISIONS.md).
//
// Minden dinamikus szoveg textContent-tel kerul az oldalra (a Salonic adata sosem HTML-kent).

import { createSalonicAdapter, BUSINESSES } from './salonic-adapter.js';
import { classifyService, effectiveType, isAcquisition } from './business-config.js';
import * as F from './flow.js';
import { createTracker } from './tracking.js';
import { createStepMeter } from './lepes-meres.js';
import { CHOOSER, PMU_PATH } from './families.js';
import { IKONOK, hajhosszIkon, kezelesIkon } from './ikonok.js';
import { koszonoLepesek, VISSZAHIVAS_LEPESEK, LEZER_KEZELO } from './koszono.js';
import { ablakIdopontok, eloAllapot, frissites, ELO_NAP } from './elo-foglaltsag.js';
import { VEGPONT, irasAdat, olvasUrl, utolsoFoglalasPerc } from './jegyzettomb.js';
import { HEADSPA } from './flows/headspa.js';
import { OXYGEN } from './flows/oxygen.js';
import { HAIR } from './flows/hair.js';
import { LASER } from './flows/laser.js';

const FLOWS = { headspa: HEADSPA, oxygen: OXYGEN, hair: HAIR, laser: LASER };
const PHONE = '06 20 247 4444';
const PHONE_HREF = 'tel:+36202474444';
const STEPS = ['Szolgáltatás', 'Időpont', 'Adatok'];
const STEP_OF = { H0: 0, HS1: 0, HS2: 0, HS3: 0, OX1: 0, OX2: 0, OXS: 0, HA0: 0, HA1: 0, HA2: 0, HA2B: 0, LA1: 0, LA2: 0, LA2B: 0, LA3: 0, C1: 1, A1: 1, A1_SENT: 1, A2: 1, C4: 2, C5: 2, A3: 2, A3U: 2, A3_CB: 2, A3_SENT: 2 };
const KEP_UT = '/assets/img/booking/'; // a kartyak kis kepei (tools/booking-kepek.mjs); ha egy kep nem toltodik be, a kartya kep nelkul is rendben van
const KEP_V = '__KEP_VERZIO__'; // a build a kepek tartalom-hash-ere cseréli (a /assets/img/* egy evig tarolhato: a kicserelt kep uj URL-t kapjon)
const kepSrc = (k) => KEP_UT + k + '.jpg?v=' + KEP_V;
const NAPTAR_NAP = 92; // a havi naptar (C1) ennyi napra elore keres (mint a PMU-foglalo)
const HETNAPOK = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const NO_STEPS = new Set(['C6', 'A1_SENT']); // kesz foglalas / kesz visszahivas-keres: nincs mit lepni
const ELO_MS = 60 * 1000; // az "Elo foglaltsag" sav frissitese (csak nyitott naptarnal, lathato lapon); tesztben win.__MH_ELO_MS felulirja
const JEGYZETTOMB_KORONKENT = 5; // a foglalasi jegyzettombot minden 5. frissitesi korben olvassuk ujra (a KV olvasasi keret kimeleseert); a "N perce" szamlalo kozben percenkent leptet
const MIN_LEAD_MINUTES = 30; // a fel oran belul kezdodo idopontot nem kinaljuk (mint a PMU foglalo)
const HOLD_MS = 4 * 60 * 1000 + 50 * 1000; // a Salonic 5 percig tartja fenn a megnyitott idopontot
// A Salonic-fiok betolti a MOSAIC kozos stiluslapjat (salonic/mosaic.css, vagy a PMU-nal pmu.css): a fejlec 70 px (a keret 78 px-t vag le),
// a lablec el van rejtve, az adatlap egy kepernyos: az "elkuldes" gomb alja 592 px + 24 px + a Salonic suti-savja (~197 px) = 813 px.
const FRAME_STYLED = Object.freeze({ crop: 78, visible: 735 });

// --- megosztott adapter + elomelegites ------------------------------------------------------------------------------------------------------------------
// Egyetlen adapter (es gyorsitotar) az oldal elettartamara: az elomelegites (CTA fole vitt eger / erintes) altal elindult kereseket a megnyilo foglalo megkapja.
// A tartos (sessionStorage) gyorsitotar a szolgaltatas-listat ket oldalbetoltes kozott is megtartja.
let megosztottAdapter = null;
const tarolo = () => { try { return globalThis.sessionStorage || null; } catch (e) { return null; } };
export const sharedAdapter = () => (megosztottAdapter ||= createSalonicAdapter({ storage: tarolo() }));
// A Salonic-hosztok elore felepitett kapcsolata (DNS + TLS): az elso kereses nem varja be
const elokapcsol = (doc, href) => {
  try {
    if (!doc || !doc.head || doc.head.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
    const l = doc.createElement('link'); l.rel = 'preconnect'; l.href = href; l.crossOrigin = 'anonymous'; doc.head.append(l);
  } catch (e) { /* nem kritikus */ }
};
/** Elomelegites a CTA kontextusabol (uzletag, szolgaltatas): kapcsolat + szolgaltatas-lista, konkret szolgaltatasnal az elso 14 nap idopontjai is. */
export function warmUp(opts = {}, doc = globalThis.document) {
  elokapcsol(doc, 'https://api.salonic.hu');
  const biz = opts.business; const cfg = biz && BUSINESSES[biz];
  if (!cfg || !FLOWS[biz]) return;
  elokapcsol(doc, cfg.host);
  const ad = sharedAdapter();
  ad.getServices(biz).then((list) => {
    if (!opts.service) return;
    const szolg = list.map((s) => ({ ...s, bookingType: classifyService(biz, s).bookingType }));
    const s = F.findByKey(szolg, opts.service, { voucher: !!opts.voucher });
    if (s) ad.getAvailability(biz, s.serviceId, { days: 14 }).catch(() => {});
  }).catch(() => {});
}
const SNAP_KEY = 'mhFoglaloAllapot'; // a foglalo allapota (hol tart a vendeg): bezaras / ujranyitas utan folytathato
const SNAP_MS = 30 * 60 * 1000;
const SNAP_VIEWS = new Set(['PMU', 'HS2', 'HS3', 'OX2', 'OXS', 'HA1', 'HA2', 'HA2B', 'LA2', 'LA3', 'LA2B', 'C1', 'C4']);

/**
 * A foglalo felulete. Ket modban fut ugyanez a kod:
 *  - mode 'page':  onallo oldal (/foglalo-motor, /foglalas): a fejlec + tartalom a root-ban, az ablak gorgetesevel.
 *  - mode 'layer': a szolgaltatas-oldalon helyben nyilo reteg (assets/js/booking-engine/layer.js): ugyanaz a fejlec (+ bezaras),
 *                  a sajat gorgetoteruleten; a belepesi kontextust a hivo adja (search), a bezarast az onClose / onExit kezeli.
 * defaultBusiness: ha az URL / a hivas nem nevezi meg az uzletagat: 'headspa' (a /foglalo-motor regi alapja) vagy null (-> H0, szolgaltatas-elso).
 */
export function startEngine({ root, doc = document, win = window, adapter = sharedAdapter(), now = () => Date.now(),
  mode = 'page', search = null, defaultBusiness = 'headspa', onClose = null, onExit = null, urlAllapot = null, closable = true }) {
  const layer = mode === 'layer';
  // destroyed: a bezart (destroy-olt) motor aszinkron utotagja (pl. a naptar adata a bezaras utan erkezik meg) mar semmit nem irhat: se elozmenyt, se mentett allapotot, se idozitot
  let destroyed = false;
  elokapcsol(doc, 'https://api.salonic.hu');
  // urlAllapot: a lepesek (#H0, #C1, ...) az URL-be kerulnek-e. Onallo oldalon igen (ott nincs GTM); a retegben alapbol NEM: a GTM History Change
  // triggerei minden URL-valtozasnal (pushState / replaceState / hash / vissza) Meta PageView-t, GA4 page_view / visit-et es Google Ads page_view-t inditanak.
  const urlbe = urlAllapot === null ? !layer : !!urlAllapot;
  const elozmeny = (mod, allapot, url) => (urlbe ? win.history[mod](allapot, '', url) : win.history[mod](allapot, '')); // URL nelkul: a cim nem valtozik
  const ctx = F.parseContext(search !== null ? search : win.location.search, doc.referrer, win.location.origin, { defaultBusiness });
  let flow = ctx.business ? FLOWS[ctx.business] : null;
  const nowUnix = () => Math.floor(now() / 1000);
  const HANDOFF = F.shouldHandoff(win.location.hostname, win.location.search); // eles tartomanyon: atadas a meglevo koszonooldalnak

  // A sajat kereteben nyiltunk meg (a Salonic atiranyitotta az adatlapot): nem rajzolunk, szolunk a szulonek.
  try {
    if (!layer && win.top !== win.self && win.parent.location.hostname === win.location.hostname) {
      doc.documentElement.style.visibility = 'hidden';
      if (typeof win.parent.mhKeretbenOldal === 'function') win.parent.mhKeretbenOldal(win.location.href);
      return null;
    }
  } catch (e) { /* idegen oldal kereteben */ }

  const store = (() => { try { return win.sessionStorage; } catch (e) { return null; } })();
  // Kuponkod: a linkbol / CTA-bol (ctx.coupon), vagy amit az oldalra erkezeskor a launcher megjegyzett (munkamenet). A kod sehova nem kerul meresbe.
  const KUPON_KULCS = 'mh_kupon';
  try { if (ctx.coupon && store) store.setItem(KUPON_KULCS, ctx.coupon); else if (!ctx.coupon && store) ctx.coupon = F.cleanCoupon(store.getItem(KUPON_KULCS)); } catch (e) { /* nem kritikus */ }
  const tracker = createTracker({ ctx, doc, storage: store, now });
  const track = tracker.track;
  // A lepes-meres (DECISION-LOG #88): GA4 dataLayer (csak statisztikai hozzajarulassal) + nevtelen belso szamlalo; lasd lepes-meres.js, docs/booking-engine/LEPES_MERES.md
  const meter = createStepMeter({ win, ctx, ido: now });
  const hibaTipus = (e) => (e && e.code === 'TIMEOUT' ? 'timeout' : e && e.code ? 'salonic_api' : 'client_error'); // a Salonic-adapter hibakodjai; minden mas (pl. rajzolasi hiba) client_error

  const S = {
    sig: [ctx.business || '', ctx.serviceKey || '', ctx.category || '', ctx.intent || '', ctx.voucher ? '1' : '', ctx.staffKey || ''].join('|'), nav: [], slotsFull: true, fullP: null, slotsToken: 0, servicesP: null,
    ctx, flow, state: null, depth: 0, services: null, voucher: ctx.voucher, service: null, exact: false,
    slots: [], slot: null, day: null, staff: null, place: null, expected: null, guestUrl: null, confirmation: null,
    callbackReason: 'nincs_idopont', slotLostNote: false, intent: null, group: null, staffLabel: null, slotStaff: null, month: null, intentKey: null, staffCache: null, variants: null,
  };

  // --- DOM-segedek ---------------------------------------------------------------------------------------------------------
  const h = (tag, attrs = {}, ...kids) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : doc.createTextNode(String(c)));
    return e;
  };
  let shell = null;
  const $ = (id) => (shell ? shell.querySelector('#' + id) : null); // a sajat shellben keres (a reteg Shadow DOM-jaban a doc.getElementById nem latna)
  const chevron = () => h('span', { class: 'be-chev', 'aria-hidden': 'true', text: '›' });
  // Valasztokartya: bal oldalt kis kep (vagy monogram), kozepen a cim + egy sor, jobbra az ar (ha van) es a nyil
  // (a hosszabb egysoros magyarazat a kartya aljan, teljes szelessegben all, nem a szuk szovegoszlopban)
  // resz: testresz-jelvenyek a kartya aljan ([{ ikon, label }]; lezer-csomagok). ikon: ikonok.js kulcsa (ahol nincs jo foto, de a kulonbseget segiti).
  // pre: a kartyahoz tartozo szolgaltatasok: ra-vitt egerre / erintesre az idopontjaik elore toltodnek (a naptar azonnal megnyilik)
  const bigButton = (title, sub, onclick, { kep = null, ikon = null, ar = null, monogram = null, resz = null, pre = null } = {}) => {
    const wide = !!sub && (kep || ikon || monogram) && sub.length > 36;
    return h('button', { type: 'button', class: 'be-choice', onclick, ...(pre ? { onpointerenter: () => prefetch(pre), ontouchstart: () => prefetch(pre) } : {}) },
      kep ? h('img', { class: 'be-choice-img', src: kepSrc(kep), alt: '', width: '56', height: '56', onerror: (e) => e.currentTarget.remove() })
        : ikon ? h('span', { class: 'be-choice-img be-ikon', 'aria-hidden': 'true' }, icon(IKONOK[ikon] || IKONOK.haj, 1.6))
          : monogram ? h('span', { class: 'be-choice-img be-mono', 'aria-hidden': 'true', text: monogram }) : null,
      h('span', { class: 'be-choice-text' }, h('b', { text: title }), sub && !wide ? h('small', { text: sub }) : null),
      ar ? h('span', { class: 'be-choice-ar', text: ar }) : null, chevron(),
      wide ? h('small', { class: 'be-choice-wide', text: sub }) : null,
      resz ? h('span', { class: 'be-reszek' }, resz.map((r) => h('span', { class: 'be-resz' }, r.kep ? h('img', { class: 'be-resz-kep', src: kepSrc(r.kep), alt: '', width: '28', height: '28', onerror: (e) => e.currentTarget.remove() }) : icon(IKONOK[r.ikon] || '', 1.6), r.label))) : null);
  };
  const primary = (text, onclick, extra = {}) => h('button', { type: 'button', class: 'be-btn', onclick, ...extra }, text);
  const secondary = (text, onclick) => h('button', { type: 'button', class: 'be-btn be-btn-2', onclick }, text);
  const link = (text, onclick, cls = '') => h('button', { type: 'button', class: ('be-link ' + cls).trim(), onclick, text });
  const note = (text, cls = '') => h('p', { class: ('be-note ' + cls).trim(), text });
  const alertBox = (text) => h('div', { class: 'be-alert', role: 'alert' }, text);
  const title = (text, cls = '') => h('h2', { class: ('be-title ' + cls).trim(), tabindex: '-1', text });

  // --- shell: fejlec (vissza, cim, hivas, [bezaras]) + lepesjelzo + gorgetheto tartalom ----------------------------------------------
  // Statikus ikon-szovegek (nem a Salonic adata): <template>-bol, mert az SVG-hez nevterezett elem kell.
  const icon = (inner, w = 2) => { const tpl = doc.createElement('template'); tpl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w + '" aria-hidden="true">' + inner + '</svg>'; return tpl.content.firstChild; };
  // closable: false = bezarhatatlan reteg (a regi foglalo-cimek ures oldalai): nincs X, a callback utani "Bezaras" helyett "Vissza a fooldalra"
  const closeBtn = layer && closable ? h('button', { type: 'button', class: 'be-icon', id: 'be-close', 'aria-label': 'Bezárás', onclick: () => { if (onClose) onClose(); } }, icon('<path d="M6 6l12 12M18 6L6 18"/>')) : null;
  const backBtn = h('button', { type: 'button', class: 'be-icon', id: 'be-back', 'aria-label': 'Vissza', style: 'visibility:hidden', onclick: () => win.history.back() }, icon('<path d="M15 5l-7 7 7 7"/>'));
  const stepsEl = h('ol', { class: 'be-steps', id: 'be-steps', 'aria-label': 'Hol tartasz', hidden: true });
  const mainEl = h('main', { class: 'be-main', id: 'be-root' }, h('p', { class: 'be-loading', role: 'status', text: 'Betöltés…' }));
  const scrollEl = h('div', { class: 'be-scroll' }, mainEl);
  shell = h('div', { class: 'be-shell' + (layer ? ' be-shell-layer' : '') },
    h('header', { class: 'be-head' },
      h('div', { class: 'be-head-row' }, backBtn, h('h1', { class: 'be-h1', id: 'be-h1', text: 'Időpontfoglalás' }),
        h('div', { class: 'be-head-right' }, h('a', { class: 'be-icon', href: PHONE_HREF, 'aria-label': 'Hívás: ' + PHONE }, icon('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/>', 1.8)), closeBtn)),
      stepsEl),
    scrollEl);
  root.replaceChildren(shell);

  // --- megjelenites -------------------------------------------------------------------------------------------------------------
  // 0 Ft: a konzultacio "Ingyenes", az egyedi csomag (a vegso arat a helyszinen allitjak) "Egyedi ar" (flow.zeroPriceLabel)
  const zeroLabel = (svc) => (svc.bookingType === 'consultation' ? 'Ingyenes' : flow.zeroPriceLabel || 'Ingyenes');
  const priceText = (svc) => (svc.bookingType === 'voucher_redemption' ? flow.copy.voucherSettled : F.priceLabel(svc.activePrice, zeroLabel(svc)));
  // Lezer: a Salonic-nev elotag/akcios szoveg nelkul, a terulettel ("Kar - Alkar"); egyebkent a tiszta Salonic-nev
  const nameOf = (svc) => {
    if (!flow.labelOf) return flow.egyesit ? flow.egyesit(F.displayName(svc.name)) : F.displayName(svc.name);
    const a = flow.areaOf(svc); const t = flow.labelOf(svc).title;
    return a && a.key !== 'tobb' ? `${a.title} – ${t}` : t;
  };
  // Idotartam: a Salonic ideje (a HeadSpa-nal 1 ora 20 perc: a tulajdonos megerositette)
  const dur = (svc) => svc.durationMin || 0;
  const durText = (svc) => (dur(svc) ? F.durationLabel(dur(svc)) : null);
  const serviceFacts = (svc) => [durText(svc), priceText(svc) || null].filter(Boolean).join(' · ');
  // A szakemberi kedvezmeny (pl. "Noel - 20% kedvezmeny!") az arban is latszik, ha a fodraszt elore valasztotta
  const priceOf = (svc) => F.priceFor(svc, S.staff ? S.staffLabel : null);
  const staffPriceText = (svc) => (svc.bookingType === 'voucher_redemption' ? flow.copy.voucherSettled : F.priceLabel(priceOf(svc), zeroLabel(svc)));
  // Kezelescsoport (hajhossz-valtozatok): tomor idotartam ("3 ora 30 perc" / "3-4 ora") es legalacsonyabb ar ("42 950 Ft-tol")
  const oraSzam = (m) => String(m / 60).replace('.', ',');
  const groupDur = (g) => {
    const d = g.items.map((i) => i.service.durationMin).filter(Boolean);
    if (!d.length) return null;
    const lo = Math.min(...d); const hi = Math.max(...d);
    return lo === hi ? F.durationLabel(lo) : `${oraSzam(lo)}–${oraSzam(hi)} óra`;
  };
  const groupFrom = (g) => {
    const ps = g.items.map((i) => priceOf(i.service)).filter((p) => p !== null && p !== undefined);
    if (!ps.length) return null;
    const lo = Math.min(...ps);
    return F.formatPrice(lo) + (lo === Math.max(...ps) ? '' : '-tól');
  };
  // A valasztott fodrasz kezelesei ("mindegy" = mind); a szolgaltatasok szakember-azonositoi a Salonic-listabol jonnek
  const poolServices = () => (S.staff ? S.services.filter((s) => (s.staffIds || []).map(String).includes(String(S.staff))) : S.services);
  // Egy valasztokartya ara tobb szolgaltatas-valtozatnal: egyforma ar = az ar; kulonbozo = "X Ft-tol" (a Salonic aktualis araibol)
  const fromPrice = (svcs) => {
    const ps = svcs.map((s) => s.activePrice).filter((p) => p !== null && p !== undefined);
    if (!ps.length) return null;
    const lo = Math.min(...ps);
    return F.priceLabel(lo, zeroLabel(svcs[0])) + (lo === Math.max(...ps) || lo === 0 ? '' : '-tól');
  };
  // A kivalasztott szakember (a naptarban vagy a HA3-ban) cimkeje; a szakemberi kedvezmeny (pl. "Noel - 20% kedvezmeny!") az arban is latszik.
  const curStaffLabel = () => (S.slotStaff ? S.slotStaff.label : S.staff ? S.staffLabel : null);
  const priceNow = () => (S.service.bookingType === 'voucher_redemption' ? flow.copy.voucherSettled : F.priceLabel(F.priceFor(S.service, curStaffLabel()), zeroLabel(S.service)));
  // A HeadSpa-kartya kepe (mint a PMU-foglalo "valasztott" kartyaja); a tobbi uzletagnal nincs kartya-kep, ott a sav kep nelkul all
  const kepOf = (svc) => { const c = (flow.cards || []).find((x) => x.test(F.displayName(svc.name))); return c ? c.kep : null; };
  const serviceBar = (back) => {
    const kep = kepOf(S.service);
    return h('div', { class: 'be-svc' },
      kep ? h('img', { class: 'be-svc-img', src: kepSrc(kep), alt: '', width: '44', height: '44', onerror: (e) => e.currentTarget.remove() }) : null,
      h('span', { class: 'be-svc-text' }, h('b', { text: nameOf(S.service) }),
        h('small', { text: [durText(S.service), priceNow() || null, curStaffLabel() ? staffName(curStaffLabel()) : null].filter(Boolean).join(' · ') })),
      back ? link('Módosítás', back) : null);
  };
  const summaryRows = (rows) => h('dl', { class: 'be-rows' }, rows.filter(([, v]) => v).map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))));
  const placeText = () => [S.place && S.place.name, S.place && S.place.address].filter(Boolean).join(', ');

  function setView(node, state) {
    S.shown = state; // az utoljara megjelent nezet kodja (a hibakepernyo is: A3): a booking_close step-je ez
    mainEl.replaceChildren(node);
    mainEl.classList.toggle('be-main-wide', state === 'PMU');
    mainEl.classList.toggle('be-main-kompakt', state === 'C4'); // az adatlap-keret a kepernyo aljaig er (mobilon egy kepernyo)
    shell.classList.toggle('be-shell-pmu', state === 'PMU'); // a PMU-foglalonak sajat fejlece van: a motoreben csak a bezaras marad
    const step = STEP_OF[state];
    const steps = stepsEl;
    if (steps) {
      steps.hidden = NO_STEPS.has(state) || step === undefined;
      steps.replaceChildren(...STEPS.map((t, i) => {
        const bel = [h('i', { text: i < step ? '✓' : String(i + 1) }), h('span', { text: t })];
        // a kesz (kattinthato) lepes gomb: a legutobbi ilyen lepesre lep vissza
        return h('li', { class: i < step ? 'done' : i === step ? 'now' : '', 'aria-current': i === step ? 'step' : false },
          i < step ? h('button', { type: 'button', class: 'be-step-btn', 'aria-label': t + ': vissza erre a lepesre', onclick: () => gotoStep(i) }, bel) : bel);
      }));
    }
    backBtn.style.visibility = S.depth > 0 && state !== 'C6' && !/_SENT$/.test(state) ? 'visible' : 'hidden';
    if (layer) scrollEl.scrollTop = 0; else win.scrollTo(0, 0);
    const t = mainEl.querySelector('.be-title');
    if (t) t.focus({ preventScroll: true });
  }

  // --- navigacio ------------------------------------------------------------------------------------------------------------------
  let renderToken = 0;
  async function show(state) {
    if (destroyed) return undefined;
    S.state = state;
    win.clearTimeout(S.holdTimer);
    win.clearInterval(S.eloTimer); S.eloBar = null;
    if (S.pmuCleanup) { S.pmuCleanup(); S.pmuCleanup = null; }
    if (S.kuponCleanup) { S.kuponCleanup(); S.kuponCleanup = null; }
    const token = ++renderToken;
    saveSnapshot(state);
    setView(skeleton[state] && S.service ? skeleton[state]() : h('p', { class: 'be-loading', role: 'status', text: 'Betöltés…' }), state);
    try {
      const node = await views[state]();
      if (token === renderToken && node) setView(node, state);
    } catch (e) {
      if (token !== renderToken) return;
      console.error(e);
      track('booking_error', { step: state, reason: (e && e.code) || 'load_failed' });
      meter.error(hibaTipus(e), state);
      setView(loadError(), 'A3');
    }
  }
  function go(state, { replace = false } = {}) {
    if (destroyed) return undefined;
    if (replace) { elozmeny('replaceState', { view: state, depth: S.depth, beLayer: layer }, '#' + state); S.nav[S.depth] = state; }
    else { S.depth += 1; elozmeny('pushState', { view: state, depth: S.depth, beLayer: layer }, '#' + state); S.nav[S.depth] = state; S.nav.length = S.depth + 1; }
    return show(state);
  }
  // A lepesjelzo kesz lepesere kattintva: vissza a legutobbi olyan nezetre, ami ahhoz a lepeshez tartozik (history.go: a popstate rajzol)
  function gotoStep(k) {
    for (let i = S.depth - 1; i >= 0; i--) if (STEP_OF[S.nav[i]] === k) { win.history.go(i - S.depth); return; }
  }
  const needs = { C4: () => S.slot && S.service, C1: () => S.service, OX2: () => S.candidates, OXS: () => S.service,
    HA2: () => S.intent, HA2B: () => S.group, LA2B: () => S.laserArea };
  const onPop = (e) => {
    // reteg-modban: a reteg megnyitasa elotti bejegyzesre lepett vissza -> a reteg bezarul (az oldal ugyanott marad)
    if (layer && (S.closing || !(e.state && e.state.beLayer))) { if (onExit) onExit(); return; }
    const view = e.state && e.state.view;
    S.depth = (e.state && e.state.depth) || 0;
    // a sminktetovalo-keret egyik lepesere lepett vissza / elore: a keret mutatja a nezetet (nem rajzoljuk ujra a keretet)
    if (view === 'PMU' && S.state === 'PMU' && S.pmuFrame && S.pmuFrame.contentWindow) {
      S.nav.length = S.depth + 1;
      S.pmuFrame.contentWindow.postMessage({ mhPmuNezet: e.state.pmu || 'kezdo', idx: e.state.pidx || 0 }, win.location.origin);
      return;
    }
    if (!view || (needs[view] && !needs[view]())) { S.depth = 0; S.nav = [entry()]; show(S.nav[0]); return; }
    show(view);
  };
  win.addEventListener('popstate', onPop);
  const onResize = () => { if (S.state === 'C4' && S.fitFrame) S.fitFrame(); };
  win.addEventListener('resize', onResize);

  // --- adat ---------------------------------------------------------------------------------------------------------------------
  async function ensureServices() {
    if (S.services) return S.services;
    const biz = flow.business; // (egy kozos betoltes: a parhuzamos hivasok nem toltik ketszer)
    return (S.servicesP ||= adapter.getServices(biz).then((list) => (S.services = list.map((s) => ({ ...s, bookingType: classifyService(biz, s).bookingType })))).catch((e) => { S.servicesP = null; throw e; }));
  }
  // Elozetes betoltes: a lathato szolgaltatasok kovetkezo 14 napjanak idopontjai (kb. 0,3-1 mp): mire a vendeg valaszt, a naptar adata megvan
  const prefetch = (svcs) => { if (S.adapterSample) return; for (const s of (svcs || []).slice(0, 4)) adapter.getAvailability(flow.business, s.serviceId, { days: 14 }).catch(() => {}); };
  // Elkeltnek csak akkor mondjuk, ha a Salonic ket egymas utani valasza is adott idopontokat a napra, de a kivalasztott nem volt
  // koztuk. Ures valasz vagy hiba nem dont (ilyenkor megprobaljuk az adatlapot): egy esetleges hibas valasz ne ejtsen at szabad idopontot.
  async function slotStillFree() {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await adapter.getAvailability(flow.business, S.service.serviceId, { from: S.slot.start_unix - 3600, days: 1, minLeadMinutes: 0, staffId: S.slotStaff ? S.slotStaff.id : -1 });
        if (!r.length || r.some((s) => s.start_unix === S.slot.start_unix)) return true;
      } catch (e) { return true; }
      if (i === 0) await new Promise((ok) => win.setTimeout(ok, 400));
    }
    return false;
  }
  // A szolgaltatas valtozatai: ahol a business egyesit-ove tesz ket Salonic-szolgaltatast egyne (HeadSpa Egyeni Relax / Hair), azonos nevu, azonos fajtaju (kuponos / normal) tarsak
  const variantsFor = (svc) => {
    if (!flow.egyesit) return [svc];
    const kupon = svc.bookingType === 'voucher_redemption'; const kulcs = flow.egyesit(F.displayName(svc.name));
    const mind = (S.services || []).filter((x) => (x.bookingType === 'voucher_redemption') === kupon && flow.egyesit(F.displayName(x.name)) === kulcs);
    return mind.length > 1 ? [svc, ...mind.filter((x) => x.serviceId !== svc.serviceId)] : [svc];
  };
  // --- Elo foglaltsag sav (a naptar alatt): a szolgaltatashoz tartozo valodi szabad idopontok a kovetkezo 7 napra (elo-foglaltsag.js) ---------------------------
  const eloPool = () => (S.staff ? F.filterSlots(S.slots, { staffId: S.staff }) : S.slots);
  function eloSav() {
    const pont = h('span', { class: 'be-elo-pont', 'aria-hidden': 'true' });
    const cim = h('b', { class: 'be-elo-cim' }); const uz = h('span', { class: 'be-elo-uzenet' }); const extra = h('span', { class: 'be-elo-extra' }); const also = h('i', { class: 'be-elo-also' });
    const el = h('div', { class: 'be-elo jo', role: 'status', 'aria-live': 'polite' }, pont, h('div', { class: 'be-elo-szoveg' }, cim, uz, extra, also));
    let elozoUzenet = null; let elozoExtra = ''; let frissultAmig = 0;
    const rajzol = (valtozas = null) => {
      if (valtozas) { frissultAmig = now() + 12000; win.setTimeout(() => { if (el.isConnected) rajzol(); }, 12100); } // 12 mp-ig "Most frissult", utana vissza "Elo foglaltsag"-ra
      const pool = eloPool(); const idok = ablakIdopontok(pool, nowUnix(), ELO_NAP);
      const elso = pool.length ? F.uniqueTimes(pool)[0] : null;
      const a = eloAllapot({ szabad: idok.length, kovetkezo: !idok.length && elso ? F.longDate(elso.start_unix) : null, frissult: now() < frissultAmig ? 'valtozas' : null,
        utolsoFoglalasPerc: S.utolso ? utolsoFoglalasPerc(S.utolso.valasz, S.utolso.mikor, now()) : null }); // csak a jegyzettombbol (valodi foglalasi esemeny); nincs adat = nincs sor
      el.className = 'be-elo ' + a.hangulat;
      cim.textContent = a.cim; also.textContent = a.also;
      const extraSzoveg = a.extra.join('\n');
      if (extraSzoveg !== elozoExtra) { extra.replaceChildren(...a.extra.map((s) => h('span', { class: 'be-elo-sor', text: s }))); elozoExtra = extraSzoveg; } // csak valodi valtozaskor nyulunk a DOM-hoz (a kepernyoolvaso sem szol feleslegesen)
      if (a.uzenet !== elozoUzenet) { uz.textContent = a.uzenet; if (elozoUzenet !== null) { uz.classList.remove('valt'); void uz.offsetWidth; uz.classList.add('valt'); } elozoUzenet = a.uzenet; }
    };
    return { el, rajzol };
  }
  // A foglalasi jegyzettomb (jegyzettomb.js, szerver-oldali, VALODI foglalasi esemenyek): mikor foglaltak utoljara erre a kezelesre (a kezeles osszes valtozata kozul a legujabb).
  // Hiba / nincs bejegyzes / nincs szerver-oldali tarolo: a sav ezt a sort nem mutatja (nem talalunk ki erteket).
  async function jegyzettombOlvas() {
    if (destroyed || S.adapterSample || !S.service || !S.eloBar || typeof win.fetch !== 'function') return;
    const bar = S.eloBar; const token = renderToken;
    try {
      const vs = S.variants && S.variants.length > 1 ? S.variants : [S.service];
      const r = await win.fetch(olvasUrl(flow.business, vs.map((v) => v.serviceId)), { cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) return;
      const valasz = await r.json();
      if (destroyed || token !== renderToken || S.eloBar !== bar) return;
      S.utolso = { valasz, mikor: now() };
      bar.rajzol();
    } catch (e) { /* nincs adat: a sav ezt a sort nem mutatja */ }
  }
  // Percenkent (csak nyitott naptarnal, lathato lapon): friss lekeres a kovetkezo 7 napra; ha a szabad idopontok halmaza tenylegesen valtozott, a naptar es a sav helyben frissul
  async function eloFrissit() {
    if (destroyed || doc.hidden || S.state !== 'C1' || !S.eloBar || !S.service || S.eloBusy) return;
    S.eloTick = (S.eloTick || 0) + 1;
    S.eloBar.rajzol(); // a "N perce foglaltak" szamlalo percenkent leptet (a szoveg csak akkor valtozik, ha a perc valtozott)
    if (S.eloTick % JEGYZETTOMB_KORONKENT === 0) jegyzettombOlvas();
    S.eloBusy = true; const bar = S.eloBar; const token = renderToken;
    try {
      const vs = S.variants && S.variants.length > 1 ? S.variants : [S.service];
      const lists = await Promise.all(vs.map((v) => adapter.getAvailability(flow.business, v.serviceId, { days: ELO_NAP + 1, minLeadMinutes: MIN_LEAD_MINUTES, fresh: true })));
      if (token !== renderToken || S.eloBar !== bar) return;
      const uj = vs.length > 1 ? F.mergeVariantSlots(lists) : lists[0];
      const hatar = nowUnix() + ELO_NAP * 86400;
      const regi = ablakIdopontok(S.slots, nowUnix(), ELO_NAP); const ujIdok = ablakIdopontok(uj, nowUnix(), ELO_NAP);
      const v = frissites(regi, ujIdok);
      if (!v.valtozas) return;
      S.slots = S.slots.filter((s) => s.start_unix > hatar).concat(uj.filter((s) => s.start_unix <= hatar)).sort((x, y) => x.start_unix - y.start_unix || String(x.staff_id).localeCompare(String(y.staff_id)));
      if (S.repaint) S.repaint(); // a naptar (szabad napok, a nap idopontjai) helyben frissul
      bar.rajzol(v.valtozas);
    } catch (e) { /* a kovetkezo korben ujra probalja; a sav a legutobbi valodi allapotot mutatja */ } finally { S.eloBusy = false; }
  }

  // Idopontok: az elso 14 nap azonnal (a naptar megnyilik), a tobbi (92 napig) parhuzamos reszekben, hatterben erkezik; megerkezesekor a naptar helyben frissul.
  async function loadSlots() {
    const t0 = now();
    const vs = S.variants && S.variants.length > 1 ? S.variants : [S.service];
    const token = (S.slotsToken += 1);
    const full = vs.map(() => null); const eleje = [];
    let kesz; S.fullP = new Promise((ok) => { kesz = ok; }); S.slotsFull = false;
    const osszeall = () => {
      if (!full.every(Boolean)) return;
      if (token === S.slotsToken) { S.slots = vs.length > 1 ? F.mergeVariantSlots(full) : full[0]; S.slotsFull = true; if (S.onMore) S.onMore(); }
      kesz();
    };
    const lists = await Promise.all(vs.map(async (v, i) => {
      const l = await adapter.getAvailability(flow.business, v.serviceId, { days: NAPTAR_NAP, firstDays: 14, minLeadMinutes: MIN_LEAD_MINUTES,
        onMore: (all, err) => { if (err) console.error(err); full[i] = all || eleje[i] || []; osszeall(); } });
      eleje[i] = l; return l;
    }));
    if (!S.slotsFull || token !== S.slotsToken) S.slots = vs.length > 1 ? F.mergeVariantSlots(lists) : lists[0];
    S.day = null;
    if (!destroyed && !S.adapterSample) meter.slotsLoaded(now() - t0); // az elso adat (14 nap) megerkezett: ennyi ideig tartott a vendegnek
    return S.slots;
  }
  const serviceParams = (svc) => ({ service: nameOf(svc), service_id: svc.serviceId, booking_type: classifyService(flow.business, svc).bookingType, list_price: svc.listPrice, final_price: svc.activePrice, voucher: svc.bookingType === 'voucher_redemption' });
  function chooseService(svc, { exact = false, next = flow.afterService || 'C1' } = {}) {
    S.service = svc; S.exact = exact; S.slot = null; S.slots = []; S.slotStaff = null; S.variants = variantsFor(svc); S.slotsToken += 1; S.slotsFull = true;
    if (!flow.staffFirst) { S.staff = null; S.staffLabel = null; } // a fodraszatnal a fodrasz-valasztas elobb volt, megmarad
    track('booking_service_selected', serviceParams(svc));
    meter.service(svc.serviceId);
    return go(next);
  }
  // fromFilter: a naptarban (C2) konkret szakembert valasztott a vendeg -> ez vegigmegy az adatlapon;
  // egyebkent "barmely megfelelo szakember" (a Salonic oszt be). Az idopont kivalasztasa utan rogton az adatlap (C4) jon.
  function pickSlot(slot, { fromFilter = false } = {}) {
    S.slot = slot;
    // tobb valtozat (Egyeni Relax / Hair): a foglalas arra a valtozatra megy, amelyiknek az idopontja ez
    if (S.variants && S.variants.length > 1) { const v = S.variants.find((x) => String(x.serviceId) === String(slot.service_id)); if (v) S.service = v; }
    S.slotStaff = fromFilter && S.staff ? { id: String(S.staff), label: slot.staff_label } : null;
    track('booking_slot_selected', { ...serviceParams(S.service), staff_id: S.slotStaff ? S.slotStaff.id : undefined });
    meter.slot();
    return go('C4');
  }
  const staffRow = () => (flow.showStaffFilter ? (S.slotStaff ? S.slotStaff.label : 'Bármely megfelelő') : '');

  // --- allapot-megjegyzes: bezaras / ujranyitas utan ott folytatja, ahol tartott (ugyanabbol a belepesi kontextusbol, 30 percig) ---------------------------------------
  function saveSnapshot(state) {
    if (destroyed || !store || S.adapterSample) return;
    try {
      if (state === 'PMU' && !flow) { store.setItem(SNAP_KEY, JSON.stringify({ sig: S.sig, t: now(), business: 'pmu', view: 'PMU', path: [] })); return; } // a keret sajat allapota: foglalo-pmu.js
      if (!flow || !SNAP_VIEWS.has(state)) { store.removeItem(SNAP_KEY); return; } // belepo allapot / kesz foglalas: nincs mit visszaallitani
      store.setItem(SNAP_KEY, JSON.stringify({
        sig: S.sig, t: now(), business: flow.business, view: state === 'C4' ? 'C1' : state, voucher: !!S.voucher, serviceId: S.service ? S.service.serviceId : null, exact: !!S.exact,
        staff: S.staff, staffLabel: S.staffLabel, intentKey: S.intent ? S.intent.intent.key : null, groupKey: S.group ? S.group.key : null,
        areaKey: S.laserArea ? S.laserArea.area.key : null, laserType: S.laserType || null, candKey: S.candKey || null, day: S.day, month: S.month,
        path: S.nav.slice(1, S.depth + 1).filter((v) => v !== 'C4'), // a belepo allapot utani nezetek: ujranyitas utan a vissza gomb / lepesjelzo ezeken lep vissza
      }));
    } catch (e) { /* tele / tiltott tarolo */ }
  }
  // gyors, halozat nelkuli ellenorzes: van-e ehhez a belepeshez friss, ervenyes mentett allapot
  function peekSnapshot() {
    if (!store) return null;
    try {
      const snap = JSON.parse(store.getItem(SNAP_KEY));
      if (!snap || snap.sig !== S.sig || now() - snap.t > SNAP_MS || !SNAP_VIEWS.has(snap.view) || (snap.business !== 'pmu' && !FLOWS[snap.business])) return null;
      if (flow && flow.business !== snap.business) return null;
      return snap;
    } catch (e) { return null; }
  }
  // A mentett allapot visszaepitese a Salonic aktualis adataibol (szolgaltatas-azonosito, szandek / csoport / terulet kulcsa); sikertelen = null (a belepo allapot jon)
  async function restoreSnapshot(snap) {
    const volt = flow;
    try {
      if (!flow) setBusiness(snap.business);
      await ensureServices();
      S.voucher = !!snap.voucher; S.staff = snap.staff || null; S.staffLabel = snap.staffLabel || null;
      if (snap.intentKey) {
        const intent = (flow.intents || []).find((i) => i.key === snap.intentKey);
        if (!intent) throw new Error('szandek');
        S.intent = { intent, services: F.intentServices(poolServices(), flow.intents, intent) };
      }
      if (snap.groupKey && S.intent) S.group = F.groupServices(S.intent.services).find((g) => g.key === snap.groupKey) || null;
      if (snap.areaKey) {
        const area = (flow.areas || []).find((a) => a.key === snap.areaKey);
        if (!area || !snap.laserType) throw new Error('terulet');
        S.laserType = snap.laserType;
        S.laserArea = { area, services: S.services.filter((s) => s.bookingType === snap.laserType && flow.areaOf(s).key === area.key) };
      }
      if (snap.candKey) { const intent = (flow.intents || []).find((i) => i.key === snap.candKey); S.candKey = snap.candKey; S.candidates = intent ? F.intentCandidates(S.services, intent) : null; }
      if (snap.serviceId) {
        const svc = S.services.find((s) => s.serviceId === String(snap.serviceId));
        if (!svc) throw new Error('szolgaltatas');
        S.service = svc; S.exact = !!snap.exact; S.variants = variantsFor(svc);
      }
      S.restoreDay = snap.day || null; S.restoreMonth = snap.month || null;
      if (needs[snap.view] && !needs[snap.view]()) throw new Error('hianyzo adat');
      return snap.view;
    } catch (e) {
      if (!volt) { flow = null; ctx.business = null; S.flow = null; S.services = null; S.servicesP = null; }
      return null;
    }
  }

  // --- nezetek ------------------------------------------------------------------------------------------------------------------
  // Betoltes alatti vaz (azonnal latszik, amig az adatok jonnek): az idopont-naptar racsa
  const skeleton = {
    C1: () => {
      const hk = F.monthList(nowUnix(), NAPTAR_NAP); const grid = F.monthGrid(hk[0], new Set());
      return h('section', {}, h('h2', { class: 'be-title be-sr', tabindex: '-1', text: 'Válassz időpontot' }), serviceBar(null),
        h('div', { class: 'be-honap-fej' }, h('span', { class: 'be-lapoz be-lapoz-ures' }), h('b', { class: 'be-toltes', text: grid.title }), h('span', { class: 'be-lapoz be-lapoz-ures' })),
        h('div', { class: 'be-naptar be-vaz', 'aria-hidden': 'true' }, HETNAPOK.map((n) => h('div', { class: 'be-hetnap', text: n })),
          grid.cells.map((c) => (c.blank ? h('div', { class: 'be-nnap be-ures' }) : h('div', { class: 'be-nnap', text: String(c.n) })))));
    },
  };
  const views = {
    // Szolgaltatas-elso kezdo allapot (families.js): aki nem konkret szolgaltatas-oldalrol jon, itt valaszt
    H0: async () => h('section', {}, title(CHOOSER.title), h('div', { class: 'be-list be-egyenlo' }, CHOOSER.families.map((fam) => bigButton(fam.title, fam.sub, () => chooseFamily(fam), { kep: fam.kep })))),

    // PMU: a sajat, kesz foglalo (assets/js/foglalo-pmu.js). Onallo oldalon atlepunk ra; retegben beagyazva nyilik (a sajat folyamata szerint;
    // a vegen a teljes ablakban nyilik a koszonooldal, a meres valtozatlan). A keret magassagat a beagyazott oldal jelzi (postMessage).
    PMU: async () => {
      if (!layer) { win.location.assign(PMU_PATH); return null; }
      const frame = h('iframe', { class: 'be-pmu', title: 'Sminktetoválás időpontfoglalás', src: PMU_PATH + '?beagyazva=1&reteg=1' });
      const loading = h('p', { class: 'be-loading', role: 'status', text: 'Betöltés…' });
      const onMsg = (e) => {
        if (e.origin !== win.location.origin || e.source !== frame.contentWindow || !e.data || !e.data.mhFoglalo) return;
        if (e.data.magassag) frame.style.height = Math.max(e.data.magassag, 320) + 'px';
        loading.hidden = true;
        if (e.data.nezet) scrollEl.scrollTop = 0;
        // uj lepes a keretben (a vendeg tovabblepett / a lepesjelzore kattintott): sajat elozmeny-bejegyzes, igy a bongeszo vissza gombja es a bezaras is pontos
        if (e.data.nezet && e.data.uj && S.state === 'PMU' && !S.closing) {
          S.depth += 1;
          elozmeny('pushState', { view: 'PMU', pmu: e.data.nezet, pidx: e.data.idx || 0, depth: S.depth, beLayer: layer }, '#PMU');
          S.nav[S.depth] = 'PMU'; S.nav.length = S.depth + 1;
        }
      };
      win.addEventListener('message', onMsg);
      S.pmuFrame = frame;
      S.pmuCleanup = () => { win.removeEventListener('message', onMsg); if (S.pmuFrame === frame) S.pmuFrame = null; };
      return h('section', { class: 'be-pmu-wrap' }, loading, frame);
    },

    // HeadSpa: az elso kerdes az ajandekkartya (kuponkod); utana az elmeny-valasztas
    HS1: async () => h('section', {}, title(flow.copy.hs1Title), h('div', { class: 'be-list be-egyenlo' }, flow.copy.hs1.map((o) => bigButton(o.title, null, () => {
      track('booking_intent_selected', { step: 'HS1', reason: o.key });
      S.voucher = o.key === 'voucher';
      go(F.next('HS1', o.key));
    }, { kep: o.kep, ikon: o.ikon })))),
    HS2: () => cardsView('HS2', false),
    HS3: () => cardsView('HS3', true),

    // Oxigen: egy belepesi kerdes; a szandekhez tartozo szolgaltatast a besorolas (bookingType) adja, nem azonositolista
    OX1: async () => {
      await ensureServices();
      const opts = flow.intents.map((intent) => ({ intent, candidates: F.intentCandidates(S.services, intent) })).filter((o) => o.candidates.length);
      if (!opts.length) return loadError();
      prefetch(opts.flatMap((o) => o.candidates)); // a harom valasztas idopontjai elore toltodnek
      return h('section', {}, title(flow.copy.introTitle), h('div', { class: 'be-list be-egyenlo' }, opts.map((o) => bigButton(o.intent.title, o.intent.sub, () => {
        track('booking_intent_selected', { step: 'OX1', reason: o.intent.key });
        if (o.candidates.length === 1) return chooseService(o.candidates[0], { next: F.next('OX1', 'service') });
        S.candidates = o.candidates; S.candKey = o.intent.key; // tobb Salonic-valtozat: rovid valasztas (OX2)
        return go(F.next('OX1', 'variant'));
      }, { kep: o.intent.kep, ar: fromPrice(o.candidates) }))));
    },
    OX2: async () => { prefetch(S.candidates); return h('section', {}, title(flow.copy.variantTitle), h('div', { class: 'be-list be-egyenlo' }, S.candidates.map((svc) => bigButton(nameOf(svc), durText(svc), () => chooseService(svc, { next: F.next('OX2', 'service') }), { ar: priceText(svc) })))); },
    // Oxigen: szakember-valaszto az idopont elott (kepes kartyak, nem legordulo); a szolgaltatas szakemberei kozul
    OXS: async () => {
      if (!S.service) { S.depth = 0; go(entry(), { replace: true }); return null; }
      return staffView([S.service], (o) => go(F.next('OXS', 'next'), o));
    },

    // Noi fodraszat: a BELEPO PONT a fodrasz-valaszto (HA0), csak utana a szolgaltatas. Nem mutatunk 40+ nyers Salonic-szolgaltatast: a szandekek a jovahagyott
    // kategoria-csoportok (flows/hair.js); a konzultacio egyenesen C1-re megy; a kezelesek hajhossz szerint egy csoportban vannak (HA2 -> HA2B).
    // A valasztott fodrasz kezeleseit mutatjuk (poolServices); "mindegy" = mindet.
    HA0: async () => {
      await ensureServices();
      const intent = S.intentKey ? flow.intents.find((i) => i.key === S.intentKey) : null;
      const exact = S.exact && S.service; // konkret szolgaltatas landing: csak az o fodraszai
      const scope = exact ? [S.service] : intent ? F.intentServices(S.services, flow.intents, intent) : S.services;
      return staffView(scope, (o) => {
        if (exact) return go(F.next('HA0', 'service'), o);
        if (intent) { // kategoria-landing: a kezeles-pontositas a valasztott fodrasz kezeleseibol
          const services = F.intentServices(poolServices(), flow.intents, intent);
          if (services.length) { S.intent = { intent, services }; return go(F.next('HA0', 'intent'), o); }
        }
        return go(F.next('HA0', 'all'), o);
      });
    },
    HA1: async () => {
      await ensureServices();
      const pool = poolServices();
      const opts = flow.intents.map((intent) => ({ intent, services: intent.consult ? pool.filter((s) => s.bookingType === 'consultation') : F.intentServices(pool, flow.intents, intent) })).filter((o) => o.services.length);
      if (!opts.length) return loadError();
      // surun (mobilon gorgetes nelkul): a szandekok (7-8 kartya) kisebb kartyakon
      return h('section', {}, title(flow.copy.introTitle), h('div', { class: 'be-list be-egyenlo be-suru' }, opts.map((o) => bigButton(o.intent.title, o.intent.sub, () => {
        track('booking_intent_selected', { step: 'HA1', reason: o.intent.key });
        if (o.intent.consult) return chooseService(o.services[0], { next: F.next('HA1', 'consult') });
        S.intent = o;
        // egyetlen kezelesnel / egyetlen hajhossz-csoportnal nincs mit pontositani: rogton tovabb
        const csoportok = F.groupServices(o.services);
        if (csoportok.length === 1) {
          if (csoportok[0].items.length === 1) return chooseService(csoportok[0].items[0].service, { next: F.next('HA2', 'service') });
          S.group = csoportok[0];
          return go(F.next('HA2', 'group'));
        }
        return go(F.next('HA1', 'intent'));
      }, { kep: o.intent.kep, ikon: o.intent.ikon, pre: o.intent.consult ? o.services.slice(0, 1) : null }))));
    },
    // Kezelesek: ikon (nem mindenhova kell foto, de a kulonbseget segiti), cim, jobbra az ar; a rovid jellemzo az idotartam
    HA2: async () => h('section', {}, title(flow.copy.groupTitle), note(S.intent.intent.title),
      h('div', { class: 'be-list' }, F.groupServices(S.intent.services).map((g) => bigButton(g.title, groupDur(g), () => {
        if (g.items.length === 1) return chooseService(g.items[0].service, { next: F.next('HA2', 'service') });
        S.group = g; // tobb hajhossz-valtozat: HA2B
        return go(F.next('HA2', 'group'));
      }, { kep: flow.kezelesKep ? flow.kezelesKep(g.title) : null, ikon: kezelesIkon(g.title), ar: groupFrom(g), pre: g.items.map((it) => it.service) })))),
    // Hajhosszok: a hossz ikonja segiti a kulonbseget
    HA2B: async () => { prefetch(S.group.items.map((it) => it.service)); return h('section', {}, title(flow.copy.lengthTitle), note(S.group.title),
      h('div', { class: 'be-list' }, S.group.items.map((it) => bigButton(it.length || nameOf(it.service), durText(it.service), () => chooseService(it.service, { next: F.next('HA2B', 'service') }),
        { kep: flow.hajhosszKep ? flow.hajhosszKep(S.intent && S.intent.intent.key, it.length) : null, ikon: hajhosszIkon(it.length), ar: staffPriceText(it.service) })))); },

    // Lezer: konzultacio (egyenesen C1) / "Mar tudom" -> terulet -> kezeles / "Mar jarok" -> terulet -> kezeles (2. alkalomtol arak)
    LA1: async () => {
      await ensureServices();
      const consult = S.services.find((s) => s.bookingType === 'consultation');
      const has = { consult: !!consult, known: S.services.some((s) => s.bookingType === 'first_treatment'), returning: S.services.some((s) => s.bookingType === 'returning_treatment') };
      const opts = flow.copy.intro.filter((o) => has[o.key]);
      if (!opts.length) return loadError();
      return h('section', {}, title(flow.copy.introTitle), h('div', { class: 'be-list be-egyenlo' }, opts.map((o) => bigButton(o.title, o.sub, () => {
        track('booking_intent_selected', { step: 'LA1', reason: o.key });
        if (o.key === 'consult') return chooseService(consult, { next: F.next('LA1', 'consult') });
        return go(F.next('LA1', o.key));
      }, { kep: o.kep, pre: o.key === 'consult' ? [consult] : null }))));
    },
    LA2: () => laserAreas('LA2', 'first_treatment', flow.copy.areaTitle),
    LA3: () => laserAreas('LA3', 'returning_treatment', flow.copy.returningTitle),
    // Kezelesek: ikon + cim + ar; a csomagoknal az "allapotfelmeres + kedvezmeny" helyett a csomag testreszei kis ikonokkal
    LA2B: async () => {
      const csomagos = S.laserArea.services.some((svc) => { const c = flow.packageOf ? flow.packageOf(svc) : null; return c && c.reszek.length; });
      return h('section', { class: csomagos ? 'be-csomagok' : '' }, title(flow.copy.treatmentTitle), note(S.laserArea.area.title),
        h('div', { class: 'be-list' }, S.laserArea.services.map((svc) => {
          const l = flow.labelOf(svc);
          const csomag = flow.packageOf ? flow.packageOf(svc) : null;
          const kep = (S.laserArea.area.key === 'tobb' && flow.packageKep ? flow.packageKep(svc) : null) || S.laserArea.area.kep;
          return bigButton(l.title, csomag && csomag.leiras ? csomag.leiras : durText(svc), () => chooseService(svc, { next: F.next('LA2B', 'service') }),
            { kep, ikon: csomag ? 'csomag' : flow.areaIkon(S.laserArea.area.key), ar: priceText(svc), resz: csomag && csomag.reszek.length ? csomag.reszek : null, pre: [svc] });
        })));
    },

    // C1: az idopont-valasztas MINDEN uzletagnal a PMU-foglalo havi naptara (assets/js/foglalo-pmu.js, rajzolNaptar) egy az egyben: csak a szabad napok aktivak,
    // az elso szabad nap elore kivalasztva, a nap idopontjai gombokban; egy erintes az idoponton = tovabb az adatlapra (nincs osszegzo kepernyo).
    C1: async () => {
      if (!S.slots.length) await loadSlots();
      if (destroyed) return null;
      if (!S.slots.length && !S.slotsFull) await S.fullP; // az elso 14 napban nincs idopont: megvarjuk a teljes listat, mielott "nincs idopont"-ot mondunk
      if (S.restoreDay && !S.slotsFull && S.restoreDay > F.dayKey(nowUnix() + 14 * 86400)) await S.fullP; // a korabban nezett nap az elso 14 napon tul van: megvarjuk a teljes listat
      if (S.restoreDay) { S.day = S.restoreDay; S.month = S.restoreMonth; S.restoreDay = null; S.restoreMonth = null; } // visszaallitott allapot: a korabban nezett nap
      if (!S.slots.length) { track('booking_no_slots', { ...serviceParams(S.service), step: 'C1' }); meter.error('no_slots', 'C1'); S.callbackReason = 'nincs_idopont'; go('A1', { replace: true }); return null; }
      const hk = F.monthList(nowUnix(), NAPTAR_NAP);
      const track0 = { ...serviceParams(S.service), step: 'C1' };
      // honap- / nap- / szakembervaltasnal helyben rajzolunk ujra (nincs betoltes-villanas, a gorgetes marad), mint a PMU-foglalo
      const naptar = h('div', {});
      const paint = () => {
        // a valasztott szakember idopontjai (HA0 / OXS); ha neki nincs, felkinaljuk a "barmely szakember"-t
        const pool = S.staff ? F.filterSlots(S.slots, { staffId: S.staff }) : S.slots;
        if (!pool.length) {
          naptar.replaceChildren(alertBox(`${S.staffLabel || 'A kiválasztott szakembernek'} most nincs szabad időpontja.`),
            h('div', { class: 'be-actions' }, primary('Bármely szakember', () => { S.staff = null; S.staffLabel = null; S.day = null; paint(); })));
          return;
        }
        const szabad = new Set(pool.map((s) => F.dayKey(s.start_unix)));
        if (!S.day || !szabad.has(S.day)) { S.day = F.dayKey(F.uniqueTimes(pool)[0].start_unix); S.month = null; }
        if (!S.month || !hk.includes(S.month)) S.month = hk.includes(S.day.slice(0, 7)) ? S.day.slice(0, 7) : hk[0];
        const i = hk.indexOf(S.month);
        const grid = F.monthGrid(S.month, szabad);
        const idok = F.dayTimes(pool, S.day);
        if (S.state === 'C1') saveSnapshot('C1'); // a nezett nap / honap is megmarad (bezaras utan ugyanazt a napot mutatja)
        const lapoz = (d) => h('button', { type: 'button', class: 'be-lapoz', 'aria-label': d < 0 ? 'Előző hónap' : 'Következő hónap', disabled: hk[i + d] === undefined, onclick: () => { S.month = hk[i + d]; paint(); } },
          icon(d < 0 ? '<path d="M14.5 6l-6 6 6 6"/>' : '<path d="M9.5 6l6 6-6 6"/>', 2));
        naptar.replaceChildren(
          h('div', { class: 'be-honap-fej' }, lapoz(-1), h('b', { class: S.slotsFull ? '' : 'be-toltes', text: grid.title }), lapoz(1)),
          h('div', { class: 'be-naptar' }, HETNAPOK.map((n) => h('div', { class: 'be-hetnap', text: n })),
            grid.cells.map((c) => (c.blank ? h('div', { class: 'be-nnap be-ures' }) : h('button', { type: 'button', class: 'be-nnap' + (c.free ? ' szabad' : ''), disabled: !c.free,
              'aria-pressed': String(c.key === S.day), 'aria-label': c.n + '. ' + (c.free ? 'szabad időpont van' : 'nem elérhető'), text: String(c.n), onclick: () => { S.day = c.key; paint(); } })))),
          idok.length ? h('div', {}, h('div', { class: 'be-nap-cim', text: F.longDate(idok[0].start_unix) }),
            h('div', { class: 'be-idolista' }, idok.map((s) => h('button', { type: 'button', class: 'be-idogomb', 'aria-pressed': String(!!S.slot && S.slot.start_unix === s.start_unix), text: F.timeLabel(s.start_unix), onclick: () => pickSlot(s, { fromFilter: !!S.staff }) }))))
            : note('Válassz egy zölddel jelölt napot.'));
      };
      paint();
      S.repaint = paint; // a hatterben megerkezo tovabbi napok helyben frissitik a naptarat
      S.onMore = () => { if (S.state === 'C1' && S.repaint && naptar.isConnected) S.repaint(); };
      S.utolso = null; S.eloTick = 0; // a jegyzettomb-adat a mostani kezeleshez tartozik: ujraolvassuk
      const elo = eloSav(); S.eloBar = elo; elo.rajzol(); jegyzettombOlvas();
      win.clearInterval(S.eloTimer); if (!destroyed) S.eloTimer = win.setInterval(eloFrissit, win.__MH_ELO_MS || ELO_MS);
      track('booking_slot_viewed', { ...track0, count: S.day ? F.dayTimes(S.staff ? F.filterSlots(S.slots, { staffId: S.staff }) : S.slots, S.day).length : 0 });
      // a cim a PMU-foglalon sincs kiirva (a lepesjelzo mutatja, hol tart); a kepernyoolvasonak es a fokusznak marad egy rejtett cim
      return h('section', {}, h('h2', { class: 'be-title be-sr', tabindex: '-1', text: 'Válassz időpontot' }),
        S.slotLostNote ? alertBox('Ez az időpont közben elkelt. Válassz egy másikat!') : null, serviceBar(S.exact ? null : () => win.history.back()),
        naptar, elo.el,
        link('Nem találok megfelelő időpontot', () => { S.callbackReason = 'nincs_idopont'; track('booking_no_slots', { ...track0, reason: 'user' }); go('A1'); }, 'be-link-tavol'));
    },

    C4: async () => {
      // Friss ellenorzes: az idopont meg szabad-e. (Az elkelt idopontnal a Salonic a SAJAT fooldalara dob, ami a keretben nem
      // latszik a motornak; a masik munkamenet altal tartott idopontot a naptar-API nem rejti el, ezt az alabbi segito sor kezeli.)
      const slotAtStart = S.slot; // az ellenorzes az adatlap betoltesevel parhuzamosan fut: elkelt idopontnal az eredmeny erkezesekor lep at az A2-re
      if (!S.adapterSample) slotStillFree().then((szabad) => { if (!szabad && S.state === 'C4' && S.slot === slotAtStart) { S.a2Reason = 'taken'; go('A2', { replace: true }); } });
      const b = await adapter.beginBooking({ business: flow.business, serviceId: S.service.serviceId, startUnix: S.slot.start_unix, staffId: S.slotStaff ? S.slotStaff.id : -1 });
      // Elvart ar: a szakemberi kedvezmennyel (ha konkret szakembert valasztott); "barmely szakember" eseten a Salonic a kedvezmenyes
      // szakemberhez is oszthat, ezert annak az ara is elfogadhato. Ami eltér, A3U (nem ellenorizheto), nem hamis siker.
      const promoPrices = S.slotStaff ? [] : [...new Set(S.slots.map((s) => F.priceFor(S.service, s.staff_label)).filter((p) => p !== null && p !== S.service.activePrice))];
      S.expected = { ...b.expected, staffName: S.slotStaff ? S.slotStaff.label : undefined, activePrice: F.priceFor(S.service, S.slotStaff ? S.slotStaff.label : null), acceptablePrices: promoPrices };
      S.guestUrl = b.guestDataUrl;
      track('booking_details_started', { ...serviceParams(S.service), step: 'C4' }, { once: S.slot.slot_id });
      meter.formStart(S.slot.slot_id);
      // A keret meretezese attol fugg, hogy a Salonic-fiok betolti-e a MOSAIC kozos CSS-et (a Salonic oldalabol felismerjuk).
      let styled = false;
      try { styled = !!(await adapter.getPresentation(flow.business)).customCss; } catch (e) { /* alap meret */ }
      const geo = styled ? FRAME_STYLED : flow.frame;
      const loading = h('p', { class: 'be-loading', role: 'status', text: 'Foglalási űrlap betöltése…' });
      const fallback = h('p', { class: 'be-note be-center', hidden: true }, 'Nem jelenik meg az űrlap? ', h('a', { href: S.guestUrl, target: '_top', text: 'Nyisd meg itt' }), '.');
      // ha az urlap helyett a Salonic fooldala latszik (az idopontot kozben mas foglalta), innen lehet masikat valasztani: link, nem gomb
      const help = h('div', { class: 'be-help', hidden: true }, link('Másik időpontot választok', () => win.history.back()));
      // Kuponkod: a Salonic nem veszi at a linkbol, ezert a keret NEVEBEN (window.name) adjuk at: nincs az URL-ben (nem kerul analitikaba / referrerbe); az adatlapon futo
      // kis szkript (a GTM-ben: salonic/gtm-kupon-kitolto.html) beirja a kupon mezobe, es visszaszol (postMessage), hogy megtortent.
      const kupon = flow.acceptsCoupon === false ? null : ctx.coupon || null;
      const frame = h('iframe', { class: 'be-iframe', title: 'Foglalás véglegesítése', src: S.guestUrl, ...(kupon ? { name: 'mhk:' + kupon } : {}), style: 'visibility:hidden' });
      let kuponSor = null;
      if (kupon) {
        const allapot = h('span', { class: 'be-kupon-allapot' });
        const masol = h('button', { type: 'button', class: 'be-link', hidden: true, text: 'Másolás', onclick: async () => {
          try { await win.navigator.clipboard.writeText(kupon); masol.textContent = 'Kimásolva ✓'; } catch (e) { masol.textContent = kupon; }
        } });
        kuponSor = h('p', { class: 'be-kupon', role: 'status' }, 'Kuponkód: ', h('b', { text: kupon }), allapot, ' ', masol);
        let beirva = false;
        const onKupon = (e) => {
          if (e.source !== frame.contentWindow || !e.data || e.data.mhKupon !== 'ok') return;
          beirva = true; allapot.textContent = ' · beírtuk az űrlapba ✓'; masol.hidden = true; if (S.fitFrame) S.fitFrame();
        };
        win.addEventListener('message', onKupon);
        // ha az adatlap betoltese utan nem jon visszajelzes (pl. a hirdetes-blokkolo letiltotta a szkriptet): kezi tartalek, a kod egy erintessel kimasolhato
        let kesleltetes = null;
        frame.addEventListener('load', () => { kesleltetes = win.setTimeout(() => { if (!beirva) { allapot.textContent = ' · ha nem látod az űrlapban, másold be a Kupon mezőbe: '; masol.hidden = false; if (S.fitFrame) S.fitFrame(); } }, 4000); });
        S.kuponCleanup = () => { win.removeEventListener('message', onKupon); if (kesleltetes) win.clearTimeout(kesleltetes); };
      }
      const slow = win.setTimeout(() => { fallback.hidden = false; help.hidden = false; }, 6000);
      frame.addEventListener('load', () => { win.clearTimeout(slow); loading.hidden = true; frame.style.visibility = ''; win.setTimeout(() => { help.hidden = false; }, 2500); });
      // A Salonic 5 percig tartja fenn az idopontot, utana a sajat fooldalara dob: ezt mi is figyeljuk (4:50).
      S.holdTimer = win.setTimeout(() => { if (S.state === 'C4') { S.a2Reason = 'expired'; go('A2', { replace: true }); } }, HOLD_MS);
      // Nem eles tartomanyon (elonezet / helyi) a Salonic az ELES koszonooldalra iranyit, ami a keretben nem ertesitheti a motort (idegen eredet), ezert itt a
      // vegen a Salonic / koszonooldal keretbeli tartalma latszik, nem a motor sikerkepernyoje; a foglalas ettol fuggetlenul VALODI.
      const box = h('div', { class: 'be-frame', 'data-styled': String(styled), style: `--visible:${geo.visible}px;--crop:${geo.crop}px` }, loading, frame);
      // Kis kepernyon (mobil) az adatlap egy kepernyore fer, gorgetes nelkul: a keret a gorgetheto terulet aljaig er, a hosszabb tartalom a keretben gorget.
      // (A Salonic suti-savja a keret aljan fekszik: a keret merete legfeljebb a stilusos adatlap teljes merete.)
      const fit = () => {
        if (!box.isConnected) return;
        if (!win.matchMedia('(max-width: 699px)').matches) { box.style.setProperty('--visible', geo.visible + 'px'); return; }
        const alja = layer ? scrollEl.getBoundingClientRect().bottom : win.innerHeight;
        box.style.setProperty('--visible', Math.round(Math.max(440, Math.min(geo.visible, alja - box.getBoundingClientRect().top - 2))) + 'px');
      };
      S.fitFrame = fit;
      win.setTimeout(fit, 60);
      return h('section', {}, h('h2', { class: 'be-title be-sr', tabindex: '-1', text: 'Add meg az adataidat' }), // a cim nincs kiirva (egy kepernyore ferjen); a kepernyoolvasonak marad
        // a valasztott idopont osszegzese, mint a PMU-foglalon (kis kepernyon elrejtve: az adatlap egy kepernyore fer); "Modositas" = vissza az idopont-valasztora
        h('div', { class: 'be-mini' }, icon('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', 1.6),
          h('span', { class: 'be-mini-text' }, h('b', { text: `${F.longDate(S.slot.start_unix)} · ${F.timeLabel(S.slot.start_unix)}` }), h('span', { text: nameOf(S.service) }),
            h('span', { class: 'be-halk', text: [priceNow(), durText(S.service)].filter(Boolean).join(' · ') })),
          link('Módosítás', () => win.history.back())),
        kuponSor, box, fallback, help);
    },

    C5: async () => h('section', { class: 'be-center' }, h('div', { class: 'be-spinner', 'aria-hidden': 'true' }), title('Időpontod rögzítése…'),
      h('ul', { class: 'be-check' }, h('li', { class: 'ok', text: 'Adatok ellenőrzése' }), h('li', { text: 'Foglalás ellenőrzése' }), h('li', { text: 'Visszaigazolás' }))),

    C6: async () => {
      if (!S.place) { try { S.place = await adapter.getPlace(flow.business); } catch (e) { S.place = null; } } // helyszin: a sikerkepernyohoz es a naptar-fajlhoz (az osszegzo kepernyo mar nincs)
      const c = S.confirmation;
      const rep = c ? c.reported : {};
      const voucher = S.service.bookingType === 'voucher_redemption';
      const price = voucher ? flow.copy.voucherSettled : F.priceLabel(rep.price ?? F.priceFor(S.service, curStaffLabel()), zeroLabel(S.service));
      // Mint a sminktetovalo-foglalo koszonoje: kartya + terkep, a kezelo (kep + nev), "Ott leszek", naptar, "Mi tortenik most?"
      const mikor = `${F.longDate(S.slot.start_unix)} · ${F.timeLabel(S.slot.start_unix)}`;
      const hely = placeText();
      const terkep = hely ? h('a', { class: 'be-terkep', href: F.mapsUrl(hely), target: '_blank', rel: 'noopener', 'aria-label': 'Megnyitás térképen' },
        h('iframe', { src: 'https://www.google.com/maps?q=' + encodeURIComponent(hely) + '&z=15&output=embed', loading: 'lazy', tabindex: '-1', title: 'Térkép' })) : null;
      const kezelo = thanksPractitioner(rep.employee);
      // a kezelo (kep + nev + "var teged") a kartyan belul all, a szoveg es a terkep kozott
      const kartya = h('div', { class: 'be-kosz-kartya' + (kezelo ? ' van-kezelo' : '') }, h('span', { class: 'be-kosz-adat' }, h('b', { text: mikor }), h('b', { text: nameOf(S.service) }),
        [price, durText(S.service)].filter(Boolean).join(' · '), S.place && S.place.address ? h('span', { class: 'be-kosz-cim', text: S.place.address }) : null),
      kezelo ? practitionerCell(kezelo, 'vár téged') : null, terkep);
      const ott = h('button', { type: 'button', class: 'be-btn be-ott', text: 'Ott leszek ✓', onclick: (e) => {
        const g = e.currentTarget; g.textContent = 'Köszönöm, várunk! ✓'; g.disabled = true; g.classList.add('kesz');
        if (S.adapterSample) return; // mintanezet: nincs kuldes (nem megy e-mail a szalonnak)
        const body = new URLSearchParams({ 'form-name': 'motor-megerosites', idopont: mikor, szolgaltatas: nameOf(S.service), uzletag: flow.business, szakember: kezelo ? kezelo.name : '', oldal: layer ? win.location.pathname : 'foglalo-motor' });
        win.fetch('/', { method: 'POST', body, credentials: 'same-origin' }).catch((err) => console.error(err));
      } });
      const naptarba = h('button', { type: 'button', class: 'be-naptar-link', onclick: addToCalendar }, icon('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', 1.8), 'Naptárba teszem');
      return h('section', { class: 'be-center be-success' }, h('div', { class: 'be-tick', 'aria-hidden': 'true', text: '✓' }), title('Sikeres foglalás!'),
        kartya,
        h('p', { class: 'be-megerosit' }, 'Erősítsd meg egy érintéssel, hogy jössz! ', h('span', { 'aria-hidden': 'true', text: '↓' })),
        h('div', { class: 'be-ott-sor' }, ott, naptarba),
        note('Időpont módosítása vagy lemondása: a visszaigazoló e-mailben lévő linkkel.', 'be-kicsi'),
        h('h3', { class: 'be-h3', text: 'Mi történik most?' }), stepList(koszonoLepesek(flow.business, S.service.bookingType)));
    },

    A1: async () => callbackView({ heading: 'Nincs megfelelő időpont?', intro: 'Hagyd meg a telefonszámod, és visszahívunk.' }),
    A1_SENT: async () => sentView(),
    A2: async () => {
      S.slotLostNote = true;
      track('booking_slot_lost', { ...serviceParams(S.service), step: 'C4' }, { once: S.slot && S.slot.slot_id });
      meter.error(S.a2Reason === 'expired' ? 'hold_expired' : 'slot_lost', 'C4');
      await loadSlots();
      const alts = F.uniqueTimes(S.slots).slice(0, 4);
      const expired = S.a2Reason === 'expired';
      return h('section', {}, title(expired ? 'A foglalási idő lejárt.' : 'Ez az időpont közben elkelt.'),
        note(expired ? 'A Salonic 5 percig tartja fenn a kiválasztott időpontot. Válassz újra:' : 'Válassz egy másik időpontot:'),
        alts.length ? h('div', { class: 'be-times be-grid' }, alts.map((s) => h('button', { type: 'button', class: 'be-time', text: `${F.dayLabel(s.start_unix, nowUnix())} ${F.timeLabel(s.start_unix)}`, onclick: () => { S.slotLostNote = false; S.staff = null; pickSlot(s); } }))) : null,
        h('div', { class: 'be-actions' }, secondary('Másik nap…', () => { S.slotLostNote = false; go('C1'); }),
          alts.length ? null : link('Nincs megfelelő időpont', () => { S.callbackReason = 'nincs_idopont'; go('A1'); })));
    },
    A3: async () => h('section', {}, title('Most nem tudjuk véglegesíteni az online foglalást.'), note(`Kérjük, próbáld újra, vagy kérj visszahívást, esetleg hívj minket: ${PHONE}.`),
      h('div', { class: 'be-actions' }, primary('Próbálom újra', () => retry()), secondary('Hívjatok vissza', () => { S.callbackReason = 'technikai_hiba'; go('A3_CB'); }),
        restartLink(), h('a', { class: 'be-link', href: PHONE_HREF, text: `Hívás: ${PHONE}` }))),
    A3_CB: async () => callbackView({ heading: 'Visszahívást kérsz?', intro: 'Hagyd meg a telefonszámod, és visszahívunk.' }),
    A3U: async () => h('section', {}, title('A foglalásodat feldolgoztuk.'),
      note('A visszaigazolást nem tudtuk automatikusan ellenőrizni. Kérjük, nézd meg az e-mailedet: ott találod a foglalásod adatait. Ha nem érkezik levél, hívj minket.'),
      h('div', { class: 'be-actions' }, h('a', { class: 'be-btn', href: PHONE_HREF, text: `Hívás: ${PHONE}` }), secondary('Új időpontot foglalok', () => { S.slot = null; go('C1'); }))),
    A3_SENT: async () => sentView(),
  };
  // Lezer terulet-valaszto (LA2: elso kezeles, LA3: visszajaro): csak azok a teruletek, ahol van szolgaltatas az adott tipusbol
  function laserAreas(state, type, heading) {
    return ensureServices().then(() => {
      const pool = S.services.filter((s) => s.bookingType === type);
      const areas = flow.areas.map((area) => ({ area, services: pool.filter((s) => flow.areaOf(s).key === area.key) })).filter((o) => o.services.length)
        .sort((x, y) => (y.area.elol ? 1 : 0) - (x.area.elol ? 1 : 0)); // a "Csomagok" elol
      if (!areas.length) return loadError();
      return h('section', {}, title(heading), h('div', { class: 'be-list be-egyenlo' }, areas.map((o) => bigButton(o.area.title, null, () => {
        S.laserArea = o; S.laserType = type;
        track('booking_filter_used', { filter: 'area' });
        if (o.services.length === 1) return chooseService(o.services[0], { next: F.next(state, 'service') }); // egy szolgaltatas: nincs mit pontositani
        return go(F.next(state, 'area'));
      }, { kep: o.area.kep }))));
    });
  }

  function cardsView(state, voucher) {
    return ensureServices().then(() => {
      const cards = F.cardsFor(S.services, flow.cards, { voucher });
      if (!cards.length) return loadError();
      prefetch(cards.flatMap((c) => c.services)); // a kartyak szolgaltatasainak idopontjai elore toltodnek
      // mint a PMU-foglalo kezelesvalasztoja: kep, cim + idotartam, jobbra az ar (ajandekkartyanal: "Kuponkoddal")
      return h('section', {}, title(voucher ? flow.copy.hs3Title : flow.copy.hs2Title), voucher ? note(flow.copy.hs3Note) : null,
        h('div', { class: 'be-list be-egyenlo' }, cards.map(({ card, service }) => bigButton(card.title, durText(service), () => chooseService(service),
          { kep: card.kep, ar: voucher ? flow.copy.voucherSettled : F.formatPrice(service.activePrice) }))));
    });
  }

  // --- szakember-valaszto (kepes kartyak): fodraszatnal a belepo pont (HA0), oxigennel a szolgaltatas utan (OXS) --------------------------
  // A szakemberek a szolgaltatasok szakember-azonositoinak unioja; a neveket (es a kedvezmeny-cimket) a naptar-API adja: annyi lekeressel, ahany
  // szolgaltatas az osszes azonosito lefedesehez kell. Csak az jelenik meg, akinek van szabad ideje.
  const staffName = (label) => String(label).replace(/\s*-\s*\d{1,2}\s*%\s*kedvezm.*$/i, '').trim();
  const staffNote = (label) => { const p = F.staffDiscountPercent(label); return p ? `${p}% kedvezmény` : ''; };
  async function staffChoices(services) {
    const key = services.map((s) => s.serviceId).join(',');
    if (S.staffCache && S.staffCache.key === key) return S.staffCache.list;
    const tkulcs = 'mhSzakember:' + flow.business + ':' + services.length + ':' + [...key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); // tartos (sessionStorage) gyorsitotar, 1 oraig
    try { const m = JSON.parse(store && store.getItem(tkulcs)); if (m && now() - m.t < 3600000) { S.staffCache = { key, list: m.list }; return m.list; } } catch (e) { /* nincs / hibas */ }
    const picks = F.staffCoverServices(services); // (a mohó lefedes a flow.js-ben: a munkatars-link lista-keszitoje is ezt hasznalja)
    const lists = await Promise.all(picks.map((s) => adapter.getStaff(flow.business, s.serviceId, { days: 14 }).catch(() => []))); // a nevek 14 nap idopontjaibol (gyors); aki ket hétig nem foglalhato, nem lathato
    const names = new Map();
    for (const l of lists) for (const x of l) if (x.staff_label && !names.has(String(x.staff_id))) names.set(String(x.staff_id), x.staff_label);
    const list = [...names].map(([id, label]) => ({ id, label }));
    S.staffCache = { key, list };
    if (list.length && store) { try { store.setItem(tkulcs, JSON.stringify({ t: now(), list })); } catch (e) { /* tele */ } }
    return list;
  }
  function staffView(services, next) {
    return staffChoices(services).then((list) => {
      if (list.length <= 1) { // nincs mit valasztani: az egyetlen szakember (vagy nincs adat) automatikusan
        S.staff = list[0] ? list[0].id : null; S.staffLabel = list[0] ? list[0].label : null;
        next({ replace: true });
        return null;
      }
      // munkatars-link (?staff=betti): ha a link egy szakembert nevez meg, es o a listaban van, a valaszto kimarad (mint az egyetlen szakembernel); nincs ilyen / nem egyertelmu: a valaszto jelenik meg
      const linkelt = ctx.staffKey ? F.findStaff(list, ctx.staffKey) : null;
      if (linkelt) { S.staff = linkelt.id; S.staffLabel = linkelt.label; track('booking_filter_used', { filter: 'staff_link' }); next({ replace: true }); return null; }
      const kartyak = list.map((x) => {
        const nev = staffName(x.label);
        const foto = ((flow.staffPhotos || []).find(([re]) => re.test(nev)) || [])[1];
        return bigButton(nev, staffNote(x.label) || null, () => {
          S.staff = x.id; S.staffLabel = x.label; track('booking_filter_used', { filter: 'staff' });
          next();
        }, foto ? { kep: foto } : { monogram: nev.charAt(0).toUpperCase() });
      });
      // "Mindegy: a legkorabbi idopont erdekel" legfelul, elsodleges opcioke (kiemelt kartya); utana a szakemberek
      const mindegy = bigButton(flow.copy.staffAny, null, () => { S.staff = null; S.staffLabel = null; track('booking_filter_used', { filter: 'staff_any' }); next(); }, { kep: 'ik-mindegy', ikon: 'ora' });
      mindegy.classList.add('be-choice-fo');
      return h('section', {}, title(flow.copy.staffListTitle), ctx.staffKey ? note('A linkben megadott munkatársat most nem találjuk (vagy nincs szabad időpontja). Válassz az alábbiak közül:') : null, h('div', { class: 'be-list be-egyenlo' }, [mindegy, ...kartyak]));
    });
  }
  // Tartalek: ha a motor vagy a Salonic adatai nem toltenek be, a vendeg a motor oldalan ujrakezdheti a foglalast (teljes oldalbetoltes), vagy hivhat.
  // Kozvetlen Salonic-link NINCS: a Salonic sajat sikeroldalan vegzodo foglalas a koszonooldalon futo meresben nem latszik (2026-10-05: egy fodraszati foglalas igy maradt ki).
  const restartUrl = () => `${flow.enginePath || '/foglalo-motor'}?business=${encodeURIComponent(flow.business)}`;
  const restartLink = () => h('a', { class: 'be-btn be-btn-2', href: restartUrl(), text: 'Foglalás újrakezdése' });
  const loadError = () => h('section', {}, title('Most nem sikerült betölteni az időpontokat.'), note(`Kérjük, próbáld újra pár perc múlva, vagy hívj minket: ${PHONE}.`),
    h('div', { class: 'be-actions' }, primary('Újrapróbálom', () => show(S.state)), restartLink(), h('a', { class: 'be-btn be-btn-2', href: PHONE_HREF, text: `Hívás: ${PHONE}` })));

  function retry() {
    if (S.slot && S.service) return go('C4', { replace: true }); // az adatlap ujratoltese; ha kozben mar rogzult, a Salonic elkelt idopontot jelez (A2)
    return go(S.service ? 'C1' : entry());
  }

  // --- visszahivas-kero urlap (A1 / A3) --------------------------------------------------------------------------------------------
  function callbackView({ heading, intro }) {
    const err = h('div', { id: 'be-cb-err' });
    const field = (label, name, type, ph, auto) => h('label', { class: 'be-field' }, h('span', { text: label }), h('input', { name, type, placeholder: ph, autocomplete: auto, required: true }));
    const form = h('form', { class: 'be-form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const f = e.currentTarget; const v = (n) => f.elements[n].value.trim();
      err.replaceChildren();
      const phoneDigits = v('telefon').replace(/\D/g, '');
      if (v('nev').length < 2) { meter.error('validation', S.state); err.append(alertBox('Kérlek, add meg a neved.')); f.elements.nev.focus(); return; }
      if (phoneDigits.length < 9 || phoneDigits.length > 13) { meter.error('validation', S.state); err.append(alertBox('Kérlek, érvényes telefonszámot adj meg.')); f.elements.telefon.focus(); return; }
      if (!f.elements.hozzajarul.checked) { meter.error('validation', S.state); err.append(alertBox('Kérlek, fogadd el az adatkezelést, hogy visszahívhassunk.')); return; }
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Küldés…';
      const body = new URLSearchParams({ 'form-name': 'motor-visszahivas', nev: v('nev'), telefon: v('telefon'), uzletag: flow.business, szolgaltatas: S.service ? nameOf(S.service) : '', ok: S.callbackReason, oldal: layer ? win.location.pathname : 'foglalo-motor', forras: ctx.sourcePage || '' });
      try {
        const ab = new AbortController(); const t = win.setTimeout(() => ab.abort(), 15000);
        const r = await win.fetch('/', { method: 'POST', body, credentials: 'same-origin', signal: ab.signal }).finally(() => win.clearTimeout(t));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        track('booking_callback_requested', { ...(S.service ? serviceParams(S.service) : {}), reason: S.callbackReason });
        go(S.state === 'A3_CB' ? 'A3_SENT' : 'A1_SENT', { replace: true });
      } catch (x) {
        console.error(x); meter.error('callback_failed', S.state); btn.disabled = false; btn.textContent = old;
        err.append(alertBox(`Hiba történt a küldés közben. Kérlek, próbáld újra, vagy hívj minket: ${PHONE}.`));
      }
    } },
      field('Név', 'nev', 'text', 'pl. Kovács Anna', 'name'), field('Telefonszám', 'telefon', 'tel', '+36 30 123 4567', 'tel'),
      h('label', { class: 'be-consent' }, h('input', { type: 'checkbox', name: 'hozzajarul' }), h('span', {}, 'Hozzájárulok, hogy a MOSAIC a visszahíváshoz kezelje az adataimat (', h('a', { href: '/aszf', target: '_blank', rel: 'noopener', text: 'ÁSZF' }), ').')),
      err, h('button', { type: 'submit', class: 'be-btn', text: 'Visszahívást kérek' }));
    return h('section', {}, title(heading), note(intro), form, h('a', { class: 'be-link', href: PHONE_HREF, text: `Vagy hívj most: ${PHONE}` }));
  }
  // A koszono kepernyok kozos reszei: szamozott lista, a kezelo sora (kep + nev), a kezelo azonositasa
  const stepList = (items) => h('ol', { class: 'be-lepesek' }, items.map((t) => h('li', { text: t })));
  const practitionerCell = (p, szoveg) => h('span', { class: 'be-kezelo' },
    p.foto ? h('img', { class: 'be-kezelo-kep', src: kepSrc(p.foto), alt: p.name, width: '44', height: '44', onerror: (e) => e.currentTarget.remove() })
      : h('span', { class: 'be-kezelo-kep', 'aria-hidden': 'true', text: p.name.charAt(0).toUpperCase() }),
    h('b', { text: p.name }), h('small', { text: szoveg }));
  // Ahol van kezelo (fodraszat, oxigen: a valasztott / a Salonic altal jelzett szakember, fotoval; lezer: Zsofi), ott a koszonoben is megjelenik; a HeadSpanal szobak vannak, nem kezelok.
  function thanksPractitioner(reported) {
    if (flow.business === 'laser') return LEZER_KEZELO;
    if (!flow.staffPhotos) return null;
    const label = curStaffLabel() || reported;
    if (!label) return null;
    const name = staffName(label);
    const foto = (flow.staffPhotos.find(([re]) => re.test(name)) || [])[1];
    return foto ? { name, foto } : null;
  }
  const sentView = () => h('section', { class: 'be-center be-success' }, h('div', { class: 'be-tick', 'aria-hidden': 'true', text: '✓' }), title('Visszahívást kértél!'),
    note('Hamarosan hívunk a megadott számon.'),
    h('h3', { class: 'be-h3', text: 'Mi történik most?' }), stepList(VISSZAHIVAS_LEPESEK),
    layer ? h('div', { class: 'be-actions' }, closable ? secondary('Bezárás', () => { if (onClose) onClose(); }) : secondary('Vissza a főoldalra', () => win.location.assign('/'))) : null);

  // --- naptar-fajl -------------------------------------------------------------------------------------------------------------------
  function addToCalendar() {
    const ics = F.icsFor({ startUnix: S.slot.start_unix, durationMin: dur(S.service) || 60, title: `${flow.brand}: ${nameOf(S.service)}`, location: placeText(), description: `MOSAIC. Tel.: ${PHONE}` });
    const a = h('a', { href: win.URL.createObjectURL(new win.Blob([ics], { type: 'text/calendar' })), download: 'mosaic-foglalas.ics' });
    doc.body.append(a); a.click(); a.remove();
  }

  // --- a Salonic adatlapja utan (C5) -----------------------------------------------------------------------------------------------
  // A suti.js (es ez a modul) a keretben betoltott sajat oldalunk cimet ide jelzi: elkelt idopont, visszaigazolas vagy ismeretlen.
  function onSalonicRedirect(href) {
    meter.submit(S.slot && S.slot.slot_id); // az adatlap a sajat oldalunkra iranyitott vissza: a vendeg beadta (a Salonic-gomb nem megfigyelheto)
    go('C5', { replace: true });
    win.setTimeout(() => resolveRedirect(href), 700);
  }
  function resolveRedirect(href) {
    const kind = F.classifyRedirect(href, { enginePath: flow.enginePath });
    if (kind === 'slot_lost') { meter.error('slot_lost', 'C5'); return go('A2', { replace: true }); }
    if (kind === 'confirmation') {
      // A Salonic csak sikeres foglalas utan iranyit a koszonooldalra, ezert a vendeget ellenorzestol fuggetlenul atadjuk a MEGLEVO
      // koszonooldalnak (eles tartomanyon): a mostani meres (konverziok, pixelek) azon fut valtozatlanul, egyszer, a fo ablakban.
      // Az ellenorzes eredmenye csak a sajat esemenyeinket (booking_completed / booking_error) szabja.
      const v = S.expected ? adapter.verifyConfirmation(href, S.expected) : null;
      if (v && v.ok) confirmed(v);
      else meter.error('verify_failed', 'C5');
      if (!(v && v.ok)) track('booking_error', { ...(S.service ? serviceParams(S.service) : {}), step: 'C5', reason: v ? 'verify_failed' : 'no_expectation',
        filter: v ? Object.entries(v.checks).filter(([, c]) => c.status === 'fail').map(([k]) => k).join(',') : undefined });
      // (a Salonic URL-je valtozatlan marad; csak a motor sajat URL-jen erkezett hirdetesi azonositok kerulnek a vegere, ha a Salonic nem hozta oket)
      if (HANDOFF) { win.location.assign(F.withAttribution(href, win.location.search)); return undefined; }
      // elonezeten / helyben: a motor maga mutatja a sikert (a Salonic az eles koszonooldalra iranyit, onnan nem ertesithetne minket)
      return go(v && v.ok ? 'C6' : 'A3U', { replace: true });
    }
    track('booking_error', { ...serviceParams(S.service), step: 'C5', reason: 'unknown_redirect' });
    meter.error('unknown_redirect', 'C5');
    return go('A3', { replace: true });
  }
  function confirmed(v) {
    S.confirmation = v;
    meter.success(v.bookingRef);
    try { if (store) store.removeItem(KUPON_KULCS); } catch (e) { /* nem kritikus */ } // a kupon elfogyott: a kovetkezo foglalasra nem tesszuk be ujra
    try { if (store) store.removeItem(SNAP_KEY); } catch (e) { /* nem kritikus */ }
    const cls = classifyService(flow.business, S.service);
    const type = effectiveType({ bookingType: cls.bookingType, splitByRuntime: cls.splitByRuntime, firstBooking: v.firstBooking });
    track('booking_completed', {
      ...serviceParams(S.service), booking_type: type, booking_id: v.bookingRef, final_price: v.reported.price ?? S.service.activePrice,
      new_or_returning: v.firstBooking ? 'new' : 'returning', acquisition: isAcquisition({ bookingType: cls.bookingType, splitByRuntime: cls.splitByRuntime, firstBooking: v.firstBooking }),
    }, { once: v.bookingRef });
    jegyzettombIr(v);
  }
  // A foglalasi jegyzettombbe (szerver) kerul: a VALODI, ellenorzott foglalas ideje (a sav "N perce foglaltak utoljara" sorahoz). Szemelyes adat nelkul; a szerver az eles
  // domainen alapbol nem tarol (ESEMENY_IRAS kapcsolo), a hiba nem akadalyozza a vendeget. keepalive: az eles atiranyitas (HANDOFF) kozben is elmegy.
  function jegyzettombIr(v) {
    if (S.adapterSample || typeof win.fetch !== 'function') return;
    const adat = irasAdat(flow.business, S.expected, v);
    if (!adat) return;
    try { win.fetch(VEGPONT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(adat), keepalive: true, credentials: 'same-origin' }).catch(() => {}); } catch (e) { /* nem kritikus */ }
  }
  win.mhKeretbenOldal = onSalonicRedirect;
  const destroy = () => {
    if (layer && !destroyed) meter.close(S.shown || S.state); // a reteg bezarult: step = a nezet, ahol a vendeg bezarta
    destroyed = true;
    win.removeEventListener('popstate', onPop);
    win.removeEventListener('resize', onResize);
    win.clearTimeout(S.holdTimer); win.clearInterval(S.eloTimer);
    if (S.pmuCleanup) { S.pmuCleanup(); S.pmuCleanup = null; }
    if (S.kuponCleanup) { S.kuponCleanup(); S.kuponCleanup = null; }
    renderToken += 1; // a folyamatban levo betoltes eredmenyet mar nem rajzoljuk ki
    if (win.mhKeretbenOldal === onSalonicRedirect) delete win.mhKeretbenOldal;
    S.onMore = null; S.repaint = null; S.fitFrame = null;
    root.replaceChildren();
  };

  // --- belepes ------------------------------------------------------------------------------------------------------------------------
  function entry() {
    if (!flow) return ctx.business === 'pmu' ? 'PMU' : 'H0'; // nincs uzletag: szolgaltatas-elso kezdo allapot
    return F.entryState({ hasService: false, voucher: S.voucher, first: flow.firstState, voucherState: flow.voucherState, exact: flow.exactState });
  }

  // Uzletag-valtas (a szolgaltatas-elso kezdo allapotbol): az elozo uzletag adatai nem maradhatnak meg
  function setBusiness(business) {
    flow = FLOWS[business];
    ctx.business = business;
    Object.assign(S, { flow, services: null, voucher: false, service: null, exact: false, slots: [], slot: null, day: null, month: null, staff: null, place: null, expected: null, intentKey: null, staffCache: null, variants: null, servicesP: null, slotsFull: true,
      guestUrl: null, confirmation: null, intent: null, group: null, staffLabel: null, slotStaff: null, candidates: null, laserArea: null, slotLostNote: false });
    tracker.setBusiness(business);
    meter.business(business);
    if (BUSINESSES[business]) elokapcsol(doc, BUSINESSES[business].host);
  }
  function chooseFamily(fam) {
    track('booking_intent_selected', { step: 'H0', reason: fam.key });
    if (fam.key === 'pmu') { ctx.business = 'pmu'; meter.business('pmu'); return go('PMU'); }
    setBusiness(fam.business);
    return go(entry());
  }

  async function start() {
    if (ctx.business && ctx.business !== 'pmu' && !flow) { setView(alertBox('Ismeretlen üzletág.'), 'A3'); return; }
    track('booking_open', { entry: ctx.serviceKey ? 'service' : ctx.category ? 'category' : 'generic', reason: layer ? 'layer' : 'page' });
    if (ctx.sample) return sample();
    meter.open(); // (mintanezetben nincs meres)
    if (ctx.business) meter.business(ctx.business); // a link mar megmondta az uzletagat: ez is az uzletag-lepes (a kezdo kepernyon valasztva a setBusiness / chooseFamily adja)
    let first = entry();
    // Mentett allapot (bezaras / ujranyitas): ha van ehhez a belepeshez, a skeleton alatt visszaepitjuk, es ott folytatja, ahol tartott
    const snap = peekSnapshot();
    const folytat = async () => {
      if (snap.view === 'PMU') { S.nav = [first]; ctx.business = 'pmu'; return go('PMU'); } // a sminktetovalo-keret maga folytatja
      const nezet = await restoreSnapshot(snap);
      if (!nezet) return show(first);
      S.nav = [first];
      if (nezet === first) return show(nezet);
      // a korabbi utvonal visszaepitese (csak tortenet-bejegyzesek): a vissza gomb es a lepesjelzo a megelozo nezetekre lep, nem a belepo allapotra
      const ut = (snap.path || []).filter((v) => v !== nezet && v !== first && (!needs[v] || needs[v]()));
      for (const v of ut) { S.depth += 1; elozmeny('pushState', { view: v, depth: S.depth, beLayer: layer }, '#' + v); S.nav[S.depth] = v; }
      return go(nezet);
    };
    if (!flow) { // H0 vagy PMU: nincs mit pontositani
      elozmeny('replaceState', { view: first, depth: 0, beLayer: layer }, win.location.pathname + win.location.search + '#' + first);
      S.nav = [first];
      if (snap && first === 'H0') { setView(h('p', { class: 'be-loading', role: 'status', text: 'Betöltés…' }), first); return folytat(); }
      return show(first);
    }
    ensureServices().catch(() => {}); // az uzletag szolgaltatas-listaja azonnal indul (a CTA-n tortent elomelegites mar elindithatta)
    // Lezer: ?intent=first | returning -> a terulet-valasztas (LA2 / LA3), a konzultacio-kerdes (LA1) kihagyasaval; konkret szolgaltatas / kategoria elsobbseget elvez
    if (!ctx.serviceKey && !ctx.category && flow.business === 'laser' && (ctx.intent === 'first' || ctx.intent === 'returning')) first = ctx.intent === 'first' ? 'LA2' : 'LA3';
    if (ctx.serviceKey || ctx.category) {
      try {
        await ensureServices();
        // konkret szolgaltatas landing: az uzletag "exact" allapota (Fodraszat: HA3, a konzultacio egyenesen C1); nem kerdezzuk ujra a kezelest
        const svc = ctx.serviceKey ? F.findByKey(S.services, ctx.serviceKey, { voucher: S.voucher }) : null;
        if (svc) {
          S.service = svc; S.exact = true; S.variants = variantsFor(svc); track('booking_service_selected', serviceParams(svc)); meter.service(svc.serviceId);
          first = svc.bookingType === 'consultation' ? 'C1' : F.entryState({ hasService: true, voucher: S.voucher, first: flow.firstState, voucherState: flow.voucherState, exact: flow.exactState });
        } else if (ctx.category && flow.intents) {
          // kategoria landing (?category=<szandek kulcsa>): csak a kategoria ismert -> a kezeles-pontositasra (HA2)
          const intent = flow.intents.find((i) => i.key === ctx.category && !i.consult);
          const services = intent ? F.intentServices(S.services, flow.intents, intent) : [];
          if (services.length) { S.intentKey = intent.key; track('booking_intent_selected', { step: 'landing', reason: intent.key }); first = 'HA0'; } // elobb a fodrasz-valaszto, utana a kezeles-pontositas (HA2)
        } else if (ctx.category && flow.areas) {
          // Lezer kategoria-landing (?category=<terulet kulcsa>, pl. arc): csak a terulet ismert -> a kezeles-pontositasra (LA2B)
          const area = flow.areas.find((a) => a.key === ctx.category);
          const services = area ? S.services.filter((s) => s.bookingType === 'first_treatment' && flow.areaOf(s).key === area.key) : [];
          if (services.length === 1) { S.service = services[0]; S.exact = true; first = 'C1'; track('booking_service_selected', serviceParams(S.service)); meter.service(S.service.serviceId); }
          else if (services.length) { S.laserArea = { area, services }; track('booking_intent_selected', { step: 'landing', reason: area.key }); first = 'LA2B'; }
        }
      } catch (e) { console.error(e); }
    }
    // munkatars-link + egyenesen az idopont-naptarra (pl. konzultacio): a szakember beallitasa (a szakember-valaszto ilyenkor nem jon elo)
    if (ctx.staffKey && first === 'C1' && S.service && flow.showStaffFilter && !S.staff) {
      try { const m = F.findStaff(await staffChoices([S.service]), ctx.staffKey); if (m) { S.staff = m.id; S.staffLabel = m.label; track('booking_filter_used', { filter: 'staff_link' }); } } catch (e) { /* a naptar szakember nelkul is megnyilik */ }
    }
    elozmeny('replaceState', { view: first, depth: 0, beLayer: layer }, win.location.pathname + win.location.search + '#' + first);
    S.nav = [first];
    if (snap) { setView(h('p', { class: 'be-loading', role: 'status', text: 'Betöltés…' }), first); return folytat(); }
    return show(first);
  }

  // Mintanezet foglalas nelkul: ?minta=siker|elkelt|hiba|ellenorizetlen|nincs-idopont|visszahivas-kesz
  function sample() {
    adapter = createSalonicAdapter(); // a mintanezet sajat, halozat-nelkuli adaptert hasznal (a megosztottat nem modositjuk)
    const t0 = Math.floor(now() / 86400000 + 2) * 86400 + 8 * 3600;
    if (!flow) { flow = FLOWS.headspa; S.flow = flow; ctx.business = 'headspa'; } // alapbol HeadSpa-adatokkal (?business=hair|oxygen|laser: az adott uzletag mintaadataival)
    const MINTA = {
      headspa: { svc: { name: 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', durationMin: 80, activePrice: 26900 }, staff: null, employee: 'Mirage' },
      hair: { svc: { name: 'Női hajvágás', durationMin: 60, activePrice: 12900 }, staff: 'Betti', employee: 'Betti' },
      oxygen: { svc: { name: 'Első oxigénterápiás kezelés', durationMin: 45, activePrice: 9900 }, staff: 'Bozsoki - Harangozó Tündi', employee: 'Bozsoki - Harangozó Tündi' },
      laser: { svc: { name: 'ARC - Teljes arc', durationMin: 30, activePrice: 24000 }, staff: null, employee: 'Zsófi' },
    }[flow.business] || { svc: { name: 'Minta kezelés', durationMin: 60, activePrice: 10000 }, staff: null, employee: null };
    S.service = { serviceId: '0', listPrice: null, bookingType: 'first_treatment', ...MINTA.svc };
    if (MINTA.staff) S.slotStaff = { id: '1', label: MINTA.staff };
    S.slot = { start_unix: t0, staff_id: '1', staff_label: 'x', slot_id: 'minta' };
    S.slots = [0, 5400, 90000, 93600, 176400].map((d, i) => ({ start_unix: t0 + d, staff_id: '1', staff_label: 'x', slot_id: 'minta' + i, service_id: '0' }));
    S.place = { name: 'Mosaic Headspa', address: '1023 Budapest, Bécsi út 4. földszint 1. ajtó' };
    S.confirmation = { reported: { price: S.service.activePrice, employee: MINTA.employee } };
    const map = { siker: 'C6', elkelt: 'A2', hiba: 'A3', ellenorizetlen: 'A3U', 'nincs-idopont': 'A1', 'visszahivas-kesz': 'A1_SENT' };
    S.adapterSample = true;
    adapter.getAvailability = async () => S.slots; // mintanezetben nincs halozat
    adapter.getPresentation = async () => ({ customCss: null });
    win.history.replaceState({ view: map[ctx.sample] || 'HS2', depth: 0 }, '', win.location.pathname + win.location.search);
    return show(map[ctx.sample] || 'HS2');
  }

  return { start: start(), state: S, show, go, destroy };
}
