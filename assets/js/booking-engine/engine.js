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
import { CHOOSER, PMU_PATH } from './families.js';
import { IKONOK, hajhosszIkon, kezelesIkon } from './ikonok.js';
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
const NAPTAR_NAP = 92; // a havi naptar (C1) ennyi napra elore keres (mint a PMU-foglalo)
const HETNAPOK = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const NO_STEPS = new Set(['C6']);
const MIN_LEAD_MINUTES = 30; // a fel oran belul kezdodo idopontot nem kinaljuk (mint a PMU foglalo)
const HOLD_MS = 4 * 60 * 1000 + 50 * 1000; // a Salonic 5 percig tartja fenn a megnyitott idopontot
// A Salonic-fiok betolti a MOSAIC kozos stiluslapjat (salonic/mosaic.css, vagy a PMU-nal pmu.css): a fejlec 70 px (a keret 78 px-t vag le),
// a lablec el van rejtve, az adatlap egy kepernyos: az "elkuldes" gomb alja 592 px + 24 px + a Salonic suti-savja (~197 px) = 813 px.
const FRAME_STYLED = Object.freeze({ crop: 78, visible: 735 });

/**
 * A foglalo felulete. Ket modban fut ugyanez a kod:
 *  - mode 'page':  onallo oldal (/foglalo-motor, /foglalas): a fejlec + tartalom a root-ban, az ablak gorgetesevel.
 *  - mode 'layer': a szolgaltatas-oldalon helyben nyilo reteg (assets/js/booking-engine/layer.js): ugyanaz a fejlec (+ bezaras),
 *                  a sajat gorgetoteruleten; a belepesi kontextust a hivo adja (search), a bezarast az onClose / onExit kezeli.
 * defaultBusiness: ha az URL / a hivas nem nevezi meg az uzletagat: 'headspa' (a /foglalo-motor regi alapja) vagy null (-> H0, szolgaltatas-elso).
 */
export function startEngine({ root, doc = document, win = window, adapter = createSalonicAdapter(), now = () => Date.now(),
  mode = 'page', search = null, defaultBusiness = 'headspa', onClose = null, onExit = null, urlAllapot = null }) {
  const layer = mode === 'layer';
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
  const tracker = createTracker({ ctx, doc, storage: store, now });
  const track = tracker.track;

  const S = {
    ctx, flow, state: null, depth: 0, services: null, voucher: ctx.voucher, service: null, exact: false,
    slots: [], slot: null, day: null, staff: null, place: null, expected: null, guestUrl: null, confirmation: null,
    callbackReason: 'nincs_idopont', slotLostNote: false, intent: null, group: null, staffLabel: null, slotStaff: null, month: null, intentKey: null, staffCache: null,
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
  const bigButton = (title, sub, onclick, { kep = null, ikon = null, ar = null, monogram = null, resz = null } = {}) => {
    const wide = !!sub && (kep || ikon || monogram) && sub.length > 36;
    return h('button', { type: 'button', class: 'be-choice', onclick },
      kep ? h('img', { class: 'be-choice-img', src: KEP_UT + kep + '.jpg', alt: '', width: '56', height: '56', onerror: (e) => e.currentTarget.remove() })
        : ikon ? h('span', { class: 'be-choice-img be-ikon', 'aria-hidden': 'true' }, icon(IKONOK[ikon] || IKONOK.haj, 1.6))
          : monogram ? h('span', { class: 'be-choice-img be-mono', 'aria-hidden': 'true', text: monogram }) : null,
      h('span', { class: 'be-choice-text' }, h('b', { text: title }), sub && !wide ? h('small', { text: sub }) : null),
      ar ? h('span', { class: 'be-choice-ar', text: ar }) : null, chevron(),
      wide ? h('small', { class: 'be-choice-wide', text: sub }) : null,
      resz ? h('span', { class: 'be-reszek' }, resz.map((r) => h('span', { class: 'be-resz' }, icon(IKONOK[r.ikon] || '', 1.6), r.label))) : null);
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
  const closeBtn = layer ? h('button', { type: 'button', class: 'be-icon', id: 'be-close', 'aria-label': 'Bezárás', onclick: () => { if (onClose) onClose(); } }, icon('<path d="M6 6l12 12M18 6L6 18"/>')) : null;
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
    if (!flow.labelOf) return F.displayName(svc.name);
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
      kep ? h('img', { class: 'be-svc-img', src: KEP_UT + kep + '.jpg', alt: '', width: '44', height: '44', onerror: (e) => e.currentTarget.remove() }) : null,
      h('span', { class: 'be-svc-text' }, h('b', { text: nameOf(S.service) }),
        h('small', { text: [durText(S.service), priceNow() || null, curStaffLabel() ? staffName(curStaffLabel()) : null].filter(Boolean).join(' · ') })),
      back ? link('Módosítás', back) : null);
  };
  const summaryRows = (rows) => h('dl', { class: 'be-rows' }, rows.filter(([, v]) => v).map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))));
  const placeText = () => [S.place && S.place.name, S.place && S.place.address].filter(Boolean).join(', ');

  function setView(node, state) {
    mainEl.replaceChildren(node);
    mainEl.classList.toggle('be-main-wide', state === 'PMU');
    shell.classList.toggle('be-shell-pmu', state === 'PMU'); // a PMU-foglalonak sajat fejlece van: a motoreben csak a bezaras marad
    const step = STEP_OF[state];
    const steps = stepsEl;
    if (steps) {
      steps.hidden = NO_STEPS.has(state) || step === undefined;
      steps.replaceChildren(...STEPS.map((t, i) => h('li', { class: i < step ? 'done' : i === step ? 'now' : '', 'aria-current': i === step ? 'step' : false },
        h('i', { text: i < step ? '✓' : String(i + 1) }), h('span', { text: t }))));
    }
    backBtn.style.visibility = S.depth > 0 && state !== 'C6' && !/_SENT$/.test(state) ? 'visible' : 'hidden';
    if (layer) scrollEl.scrollTop = 0; else win.scrollTo(0, 0);
    const t = mainEl.querySelector('.be-title');
    if (t) t.focus({ preventScroll: true });
  }

  // --- navigacio ------------------------------------------------------------------------------------------------------------------
  let renderToken = 0;
  async function show(state) {
    S.state = state;
    win.clearTimeout(S.holdTimer);
    if (S.pmuCleanup) { S.pmuCleanup(); S.pmuCleanup = null; }
    const token = ++renderToken;
    setView(h('p', { class: 'be-loading', role: 'status', text: 'Betöltés…' }), state);
    try {
      const node = await views[state]();
      if (token === renderToken && node) setView(node, state);
    } catch (e) {
      if (token !== renderToken) return;
      console.error(e);
      track('booking_error', { step: state, reason: (e && e.code) || 'load_failed' });
      setView(loadError(), 'A3');
    }
  }
  function go(state, { replace = false } = {}) {
    if (replace) elozmeny('replaceState', { view: state, depth: S.depth, beLayer: layer }, '#' + state);
    else { S.depth += 1; elozmeny('pushState', { view: state, depth: S.depth, beLayer: layer }, '#' + state); }
    return show(state);
  }
  const needs = { C4: () => S.slot && S.service, C1: () => S.service, OX2: () => S.candidates, OXS: () => S.service,
    HA2: () => S.intent, HA2B: () => S.group, LA2B: () => S.laserArea };
  const onPop = (e) => {
    // reteg-modban: a reteg megnyitasa elotti bejegyzesre lepett vissza -> a reteg bezarul (az oldal ugyanott marad)
    if (layer && !(e.state && e.state.beLayer)) { if (onExit) onExit(); return; }
    const view = e.state && e.state.view;
    S.depth = (e.state && e.state.depth) || 0;
    if (!view || (needs[view] && !needs[view]())) { S.depth = 0; show(entry()); return; }
    show(view);
  };
  win.addEventListener('popstate', onPop);

  // --- adat ---------------------------------------------------------------------------------------------------------------------
  async function ensureServices() {
    if (S.services) return S.services;
    S.services = (await adapter.getServices(flow.business)).map((s) => ({ ...s, bookingType: classifyService(flow.business, s).bookingType }));
    return S.services;
  }
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
  async function loadSlots() {
    S.slots = await adapter.getAvailability(flow.business, S.service.serviceId, { days: NAPTAR_NAP, minLeadMinutes: MIN_LEAD_MINUTES });
    S.day = null;
    return S.slots;
  }
  const serviceParams = (svc) => ({ service: nameOf(svc), service_id: svc.serviceId, booking_type: classifyService(flow.business, svc).bookingType, list_price: svc.listPrice, final_price: svc.activePrice, voucher: svc.bookingType === 'voucher_redemption' });
  function chooseService(svc, { exact = false, next = flow.afterService || 'C1' } = {}) {
    S.service = svc; S.exact = exact; S.slot = null; S.slots = []; S.slotStaff = null;
    if (!flow.staffFirst) { S.staff = null; S.staffLabel = null; } // a fodraszatnal a fodrasz-valasztas elobb volt, megmarad
    track('booking_service_selected', serviceParams(svc));
    return go(next);
  }
  // fromFilter: a naptarban (C2) konkret szakembert valasztott a vendeg -> ez vegigmegy az adatlapon;
  // egyebkent "barmely megfelelo szakember" (a Salonic oszt be). Az idopont kivalasztasa utan rogton az adatlap (C4) jon.
  function pickSlot(slot, { fromFilter = false } = {}) {
    S.slot = slot;
    S.slotStaff = fromFilter && S.staff ? { id: String(S.staff), label: slot.staff_label } : null;
    track('booking_slot_selected', { ...serviceParams(S.service), staff_id: S.slotStaff ? S.slotStaff.id : undefined });
    return go('C4');
  }
  const staffRow = () => (flow.showStaffFilter ? (S.slotStaff ? S.slotStaff.label : 'Bármely megfelelő') : '');

  // --- nezetek ------------------------------------------------------------------------------------------------------------------
  const views = {
    // Szolgaltatas-elso kezdo allapot (families.js): aki nem konkret szolgaltatas-oldalrol jon, itt valaszt
    H0: async () => h('section', {}, title(CHOOSER.title), h('div', { class: 'be-list be-egyenlo' }, CHOOSER.families.map((fam) => bigButton(fam.title, fam.sub, () => chooseFamily(fam), { kep: fam.kep })))),

    // PMU: a sajat, kesz foglalo (assets/js/foglalo-pmu.js). Onallo oldalon atlepunk ra; retegben beagyazva nyilik (a sajat folyamata szerint;
    // a vegen a teljes ablakban nyilik a koszonooldal, a meres valtozatlan). A keret magassagat a beagyazott oldal jelzi (postMessage).
    PMU: async () => {
      if (!layer) { win.location.assign(PMU_PATH); return null; }
      const frame = h('iframe', { class: 'be-pmu', title: 'Sminktetoválás időpontfoglalás', src: PMU_PATH + '?beagyazva=1' });
      const loading = h('p', { class: 'be-loading', role: 'status', text: 'Betöltés…' });
      const onMsg = (e) => {
        if (e.origin !== win.location.origin || e.source !== frame.contentWindow || !e.data || !e.data.mhFoglalo) return;
        if (e.data.magassag) frame.style.height = Math.max(e.data.magassag, 320) + 'px';
        loading.hidden = true;
        if (e.data.nezet) scrollEl.scrollTop = 0;
      };
      win.addEventListener('message', onMsg);
      S.pmuCleanup = () => win.removeEventListener('message', onMsg);
      return h('section', { class: 'be-pmu-wrap' }, loading, frame);
    },

    // HeadSpa: az elso kerdes az ajandekkartya (kuponkod); utana az elmeny-valasztas
    HS1: async () => h('section', {}, title(flow.copy.hs1Title), h('div', { class: 'be-list be-egyenlo' }, flow.copy.hs1.map((o) => bigButton(o.title, null, () => {
      track('booking_intent_selected', { step: 'HS1', reason: o.key });
      S.voucher = o.key === 'voucher';
      go(F.next('HS1', o.key));
    }, { ikon: o.ikon })))),
    HS2: () => cardsView('HS2', false),
    HS3: () => cardsView('HS3', true),

    // Oxigen: egy belepesi kerdes; a szandekhez tartozo szolgaltatast a besorolas (bookingType) adja, nem azonositolista
    OX1: async () => {
      await ensureServices();
      const opts = flow.intents.map((intent) => ({ intent, candidates: F.intentCandidates(S.services, intent) })).filter((o) => o.candidates.length);
      if (!opts.length) return loadError();
      return h('section', {}, title(flow.copy.introTitle), h('div', { class: 'be-list be-egyenlo' }, opts.map((o) => bigButton(o.intent.title, o.intent.sub, () => {
        track('booking_intent_selected', { step: 'OX1', reason: o.intent.key });
        if (o.candidates.length === 1) return chooseService(o.candidates[0], { next: F.next('OX1', 'service') });
        S.candidates = o.candidates; // tobb Salonic-valtozat: rovid valasztas (OX2)
        return go(F.next('OX1', 'variant'));
      }, { kep: o.intent.kep, ar: fromPrice(o.candidates) }))));
    },
    OX2: async () => h('section', {}, title(flow.copy.variantTitle), h('div', { class: 'be-list be-egyenlo' }, S.candidates.map((svc) => bigButton(nameOf(svc), durText(svc), () => chooseService(svc, { next: F.next('OX2', 'service') }), { ar: priceText(svc) })))),
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
      return h('section', {}, title(flow.copy.introTitle), h('div', { class: 'be-list be-egyenlo' }, opts.map((o) => bigButton(o.intent.title, o.intent.sub, () => {
        track('booking_intent_selected', { step: 'HA1', reason: o.intent.key });
        if (o.intent.consult) return chooseService(o.services[0], { next: F.next('HA1', 'consult') });
        S.intent = o;
        return go(F.next('HA1', 'intent'));
      }, { kep: o.intent.kep }))));
    },
    // Kezelesek: ikon (nem mindenhova kell foto, de a kulonbseget segiti), cim, jobbra az ar; a rovid jellemzo az idotartam
    HA2: async () => h('section', {}, title(flow.copy.groupTitle), note(S.intent.intent.title),
      h('div', { class: 'be-list' }, F.groupServices(S.intent.services).map((g) => bigButton(g.title, groupDur(g), () => {
        if (g.items.length === 1) return chooseService(g.items[0].service, { next: F.next('HA2', 'service') });
        S.group = g; // tobb hajhossz-valtozat: HA2B
        return go(F.next('HA2', 'group'));
      }, { ikon: kezelesIkon(g.title), ar: groupFrom(g) })))),
    // Hajhosszok: a hossz ikonja segiti a kulonbseget
    HA2B: async () => h('section', {}, title(flow.copy.lengthTitle), note(S.group.title),
      h('div', { class: 'be-list' }, S.group.items.map((it) => bigButton(it.length || nameOf(it.service), durText(it.service), () => chooseService(it.service, { next: F.next('HA2B', 'service') }),
        { ikon: hajhosszIkon(it.length), ar: staffPriceText(it.service) })))),

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
      }, { kep: o.kep }))));
    },
    LA2: () => laserAreas('LA2', 'first_treatment', flow.copy.areaTitle),
    LA3: () => laserAreas('LA3', 'returning_treatment', flow.copy.returningTitle),
    // Kezelesek: ikon + cim + ar; a csomagoknal az "allapotfelmeres + kedvezmeny" helyett a csomag testreszei kis ikonokkal
    LA2B: async () => h('section', {}, title(flow.copy.treatmentTitle), note(S.laserArea.area.title),
      h('div', { class: 'be-list' }, S.laserArea.services.map((svc) => {
        const l = flow.labelOf(svc);
        const csomag = flow.packageOf ? flow.packageOf(svc) : null;
        return bigButton(l.title, csomag && csomag.leiras ? csomag.leiras : durText(svc), () => chooseService(svc, { next: F.next('LA2B', 'service') }),
          { ikon: csomag ? 'csomag' : flow.areaIkon(S.laserArea.area.key), ar: priceText(svc), resz: csomag && csomag.reszek.length ? csomag.reszek : null });
      }))),

    // C1: az idopont-valasztas MINDEN uzletagnal a PMU-foglalo havi naptara (assets/js/foglalo-pmu.js, rajzolNaptar) egy az egyben: csak a szabad napok aktivak,
    // az elso szabad nap elore kivalasztva, a nap idopontjai gombokban; egy erintes az idoponton = tovabb az adatlapra (nincs osszegzo kepernyo).
    C1: async () => {
      if (!S.slots.length) await loadSlots();
      if (!S.slots.length) { track('booking_no_slots', { ...serviceParams(S.service), step: 'C1' }); S.callbackReason = 'nincs_idopont'; go('A1', { replace: true }); return null; }
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
        const lapoz = (d) => h('button', { type: 'button', class: 'be-lapoz', 'aria-label': d < 0 ? 'Előző hónap' : 'Következő hónap', disabled: hk[i + d] === undefined, onclick: () => { S.month = hk[i + d]; paint(); } },
          icon(d < 0 ? '<path d="M14.5 6l-6 6 6 6"/>' : '<path d="M9.5 6l6 6-6 6"/>', 2));
        naptar.replaceChildren(
          h('div', { class: 'be-honap-fej' }, lapoz(-1), h('b', { text: grid.title }), lapoz(1)),
          h('div', { class: 'be-naptar' }, HETNAPOK.map((n) => h('div', { class: 'be-hetnap', text: n })),
            grid.cells.map((c) => (c.blank ? h('div', { class: 'be-nnap be-ures' }) : h('button', { type: 'button', class: 'be-nnap' + (c.free ? ' szabad' : ''), disabled: !c.free,
              'aria-pressed': String(c.key === S.day), 'aria-label': c.n + '. ' + (c.free ? 'szabad időpont van' : 'nem elérhető'), text: String(c.n), onclick: () => { S.day = c.key; paint(); } })))),
          idok.length ? h('div', {}, h('div', { class: 'be-nap-cim', text: F.longDate(idok[0].start_unix) }),
            h('div', { class: 'be-idolista' }, idok.map((s) => h('button', { type: 'button', class: 'be-idogomb', 'aria-pressed': String(!!S.slot && S.slot.start_unix === s.start_unix), text: F.timeLabel(s.start_unix), onclick: () => pickSlot(s, { fromFilter: !!S.staff }) }))))
            : note('Válassz egy zölddel jelölt napot.'));
      };
      paint();
      track('booking_slot_viewed', { ...track0, count: S.day ? F.dayTimes(S.staff ? F.filterSlots(S.slots, { staffId: S.staff }) : S.slots, S.day).length : 0 });
      // a cim a PMU-foglalon sincs kiirva (a lepesjelzo mutatja, hol tart); a kepernyoolvasonak es a fokusznak marad egy rejtett cim
      return h('section', {}, h('h2', { class: 'be-title be-sr', tabindex: '-1', text: 'Válassz időpontot' }),
        S.slotLostNote ? alertBox('Ez az időpont közben elkelt. Válassz egy másikat!') : null, serviceBar(S.exact ? null : () => win.history.back()),
        naptar,
        link('Nem találok megfelelő időpontot', () => { S.callbackReason = 'nincs_idopont'; track('booking_no_slots', { ...track0, reason: 'user' }); go('A1'); }, 'be-link-tavol'));
    },

    C4: async () => {
      // Friss ellenorzes: az idopont meg szabad-e. (Az elkelt idopontnal a Salonic a SAJAT fooldalara dob, ami a keretben nem
      // latszik a motornak; a masik munkamenet altal tartott idopontot a naptar-API nem rejti el, ezt az alabbi segito sor kezeli.)
      if (!S.adapterSample && !(await slotStillFree())) { S.a2Reason = 'taken'; go('A2', { replace: true }); return null; }
      const b = await adapter.beginBooking({ business: flow.business, serviceId: S.service.serviceId, startUnix: S.slot.start_unix, staffId: S.slotStaff ? S.slotStaff.id : -1 });
      // Elvart ar: a szakemberi kedvezmennyel (ha konkret szakembert valasztott); "barmely szakember" eseten a Salonic a kedvezmenyes
      // szakemberhez is oszthat, ezert annak az ara is elfogadhato. Ami eltér, A3U (nem ellenorizheto), nem hamis siker.
      const promoPrices = S.slotStaff ? [] : [...new Set(S.slots.map((s) => F.priceFor(S.service, s.staff_label)).filter((p) => p !== null && p !== S.service.activePrice))];
      S.expected = { ...b.expected, staffName: S.slotStaff ? S.slotStaff.label : undefined, activePrice: F.priceFor(S.service, S.slotStaff ? S.slotStaff.label : null), acceptablePrices: promoPrices };
      S.guestUrl = b.guestDataUrl;
      track('booking_details_started', { ...serviceParams(S.service), step: 'C4' }, { once: S.slot.slot_id });
      // A keret meretezese attol fugg, hogy a Salonic-fiok betolti-e a MOSAIC kozos CSS-et (a Salonic oldalabol felismerjuk).
      let styled = false;
      try { styled = !!(await adapter.getPresentation(flow.business)).customCss; } catch (e) { /* alap meret */ }
      const geo = styled ? FRAME_STYLED : flow.frame;
      const loading = h('p', { class: 'be-loading', role: 'status', text: 'Foglalási űrlap betöltése…' });
      const fallback = h('p', { class: 'be-note be-center', hidden: true }, 'Nem jelenik meg az űrlap? ', h('a', { href: S.guestUrl, target: '_top', text: 'Nyisd meg itt' }), '.');
      // ha az urlap helyett a Salonic fooldala latszik (az idopontot kozben mas foglalta), innen lehet masikat valasztani: link, nem gomb
      const help = h('div', { class: 'be-help', hidden: true }, link('Másik időpontot választok', () => win.history.back()));
      const frame = h('iframe', { class: 'be-iframe', title: 'Foglalás véglegesítése', src: S.guestUrl, style: 'visibility:hidden' });
      const slow = win.setTimeout(() => { fallback.hidden = false; help.hidden = false; }, 6000);
      frame.addEventListener('load', () => { win.clearTimeout(slow); loading.hidden = true; frame.style.visibility = ''; win.setTimeout(() => { help.hidden = false; }, 2500); });
      // A Salonic 5 percig tartja fenn az idopontot, utana a sajat fooldalara dob: ezt mi is figyeljuk (4:50).
      S.holdTimer = win.setTimeout(() => { if (S.state === 'C4') { S.a2Reason = 'expired'; go('A2', { replace: true }); } }, HOLD_MS);
      // Nem eles tartomanyon (elonezet / helyi) a Salonic az ELES koszonooldalra iranyit, ami a keretben nem ertesitheti a motort (idegen eredet), ezert itt a
      // vegen a Salonic / koszonooldal keretbeli tartalma latszik, nem a motor sikerkepernyoje; a foglalas ettol fuggetlenul VALODI.
      return h('section', {}, title('Add meg az adataidat', 'be-title-kozep'),
        // a valasztott idopont osszegzese, mint a PMU-foglalon (kis kepernyon elrejtve: az adatlap egy kepernyore fer); "Modositas" = vissza az idopont-valasztora
        h('div', { class: 'be-mini' }, icon('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>', 1.6),
          h('span', { class: 'be-mini-text' }, h('b', { text: `${F.longDate(S.slot.start_unix)} · ${F.timeLabel(S.slot.start_unix)}` }), h('span', { text: nameOf(S.service) }),
            h('span', { class: 'be-halk', text: [priceNow(), durText(S.service)].filter(Boolean).join(' · ') })),
          link('Módosítás', () => win.history.back())),
        h('div', { class: 'be-frame', 'data-styled': String(styled), style: `--visible:${geo.visible}px;--crop:${geo.crop}px` }, loading, frame), fallback, help);
    },

    C5: async () => h('section', { class: 'be-center' }, h('div', { class: 'be-spinner', 'aria-hidden': 'true' }), title('Időpontod rögzítése…'),
      h('ul', { class: 'be-check' }, h('li', { class: 'ok', text: 'Adatok ellenőrzése' }), h('li', { text: 'Foglalás ellenőrzése' }), h('li', { text: 'Visszaigazolás' }))),

    C6: async () => {
      if (!S.place) { try { S.place = await adapter.getPlace(flow.business); } catch (e) { S.place = null; } } // helyszin: a sikerkepernyohoz es a naptar-fajlhoz (az osszegzo kepernyo mar nincs)
      const c = S.confirmation;
      const rep = c ? c.reported : {};
      const voucher = S.service.bookingType === 'voucher_redemption';
      const price = voucher ? flow.copy.voucherSettled : F.priceLabel(rep.price ?? F.priceFor(S.service, curStaffLabel()), zeroLabel(S.service));
      return h('section', { class: 'be-center be-success' }, h('div', { class: 'be-tick', 'aria-hidden': 'true', text: '✓' }), title('Foglalásod sikeres!'),
        h('div', { class: 'be-card be-left' }, h('b', { class: 'be-card-title', text: nameOf(S.service) }),
          summaryRows([['Időtartam', durText(S.service) || ''], ['Ár', price],
            ['Dátum', F.longDate(S.slot.start_unix)], ['Időpont', F.timeLabel(S.slot.start_unix)], ['Szakember', flow.showStaffFilter ? (rep.employee || staffRow()) : ''], ['Helyszín', placeText()]])),
        h('div', { class: 'be-actions' }, primary('Hozzáadás a naptárhoz', addToCalendar),
          h('a', { class: 'be-btn be-btn-2', href: S.place && S.place.address ? F.mapsUrl(placeText()) : '#', target: '_blank', rel: 'noopener', text: 'Útvonaltervezés', hidden: !(S.place && S.place.address) })),
        note('Időpont módosítása vagy lemondása: a visszaigazoló e-mailben lévő linkkel.'));
    },

    A1: async () => callbackView({ heading: 'Nincs megfelelő időpont?', intro: 'Hagyd meg a telefonszámod, és visszahívunk.' }),
    A1_SENT: async () => sentView(),
    A2: async () => {
      S.slotLostNote = true;
      track('booking_slot_lost', { ...serviceParams(S.service), step: 'C4' }, { once: S.slot && S.slot.slot_id });
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
        salonicFallback(), h('a', { class: 'be-link', href: PHONE_HREF, text: `Hívás: ${PHONE}` }))),
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
      const areas = flow.areas.map((area) => ({ area, services: pool.filter((s) => flow.areaOf(s).key === area.key) })).filter((o) => o.services.length);
      if (!areas.length) return loadError();
      return h('section', {}, title(heading), h('div', { class: 'be-list be-egyenlo' }, areas.map((o) => bigButton(o.area.title, null, () => {
        S.laserArea = o;
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
    let left = new Set(services.flatMap((s) => s.staffIds || []).map(String));
    const picks = []; const rest = [...services];
    while (left.size && rest.length) {
      rest.sort((x, y) => (y.staffIds || []).filter((id) => left.has(String(id))).length - (x.staffIds || []).filter((id) => left.has(String(id))).length);
      const s = rest.shift(); const gain = (s.staffIds || []).filter((id) => left.has(String(id)));
      if (!gain.length) break;
      picks.push(s); gain.forEach((id) => left.delete(String(id)));
    }
    const lists = await Promise.all(picks.map((s) => adapter.getStaff(flow.business, s.serviceId).catch(() => [])));
    const names = new Map();
    for (const l of lists) for (const x of l) if (x.staff_label && !names.has(String(x.staff_id))) names.set(String(x.staff_id), x.staff_label);
    const list = [...names].map(([id, label]) => ({ id, label }));
    S.staffCache = { key, list };
    return list;
  }
  function staffView(services, next) {
    return staffChoices(services).then((list) => {
      if (list.length <= 1) { // nincs mit valasztani: az egyetlen szakember (vagy nincs adat) automatikusan
        S.staff = list[0] ? list[0].id : null; S.staffLabel = list[0] ? list[0].label : null;
        next({ replace: true });
        return null;
      }
      const kartyak = list.map((x) => {
        const nev = staffName(x.label);
        const foto = ((flow.staffPhotos || []).find(([re]) => re.test(nev)) || [])[1];
        return bigButton(nev, staffNote(x.label) || null, () => {
          S.staff = x.id; S.staffLabel = x.label; track('booking_filter_used', { filter: 'staff' });
          next();
        }, foto ? { kep: foto } : { monogram: nev.charAt(0).toUpperCase() });
      });
      kartyak.push(bigButton(flow.copy.staffAny, null, () => { S.staff = null; S.staffLabel = null; track('booking_filter_used', { filter: 'staff_any' }); next(); }, { ikon: 'ora' }));
      return h('section', {}, title(flow.copy.staffListTitle), h('div', { class: 'be-list be-egyenlo' }, kartyak));
    });
  }
  // Tartalek: ha a motor vagy a Salonic adatai nem toltenek be, a vendeg a Salonic eredeti foglalojara kerulhet (nem szakad meg a foglalas)
  const salonicUrl = () => { const c = BUSINESSES[flow.business]; return c ? `${c.host}/selectSpecialization/?placeId=${c.placeId}` : null; };
  const salonicFallback = () => (salonicUrl() ? h('a', { class: 'be-btn be-btn-2', href: salonicUrl(), text: 'Foglalás a Salonic oldalán' }) : null);
  const loadError = () => h('section', {}, title('Most nem sikerült betölteni az időpontokat.'), note(`Kérjük, próbáld újra pár perc múlva, vagy hívj minket: ${PHONE}.`),
    h('div', { class: 'be-actions' }, primary('Újrapróbálom', () => show(S.state)), salonicFallback(), h('a', { class: 'be-btn be-btn-2', href: PHONE_HREF, text: `Hívás: ${PHONE}` })));

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
      if (v('nev').length < 2) { err.append(alertBox('Kérlek, add meg a neved.')); f.elements.nev.focus(); return; }
      if (phoneDigits.length < 9 || phoneDigits.length > 13) { err.append(alertBox('Kérlek, érvényes telefonszámot adj meg.')); f.elements.telefon.focus(); return; }
      if (!f.elements.hozzajarul.checked) { err.append(alertBox('Kérlek, fogadd el az adatkezelést, hogy visszahívhassunk.')); return; }
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Küldés…';
      const body = new URLSearchParams({ 'form-name': 'motor-visszahivas', nev: v('nev'), telefon: v('telefon'), uzletag: flow.business, szolgaltatas: S.service ? nameOf(S.service) : '', ok: S.callbackReason, oldal: layer ? win.location.pathname : 'foglalo-motor', forras: ctx.sourcePage || '' });
      try {
        const ab = new AbortController(); const t = win.setTimeout(() => ab.abort(), 15000);
        const r = await win.fetch('/', { method: 'POST', body, credentials: 'same-origin', signal: ab.signal }).finally(() => win.clearTimeout(t));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        track('booking_callback_requested', { ...(S.service ? serviceParams(S.service) : {}), reason: S.callbackReason });
        go(S.state === 'A3_CB' ? 'A3_SENT' : 'A1_SENT', { replace: true });
      } catch (x) {
        console.error(x); btn.disabled = false; btn.textContent = old;
        err.append(alertBox(`Hiba történt a küldés közben. Kérlek, próbáld újra, vagy hívj minket: ${PHONE}.`));
      }
    } },
      field('Név', 'nev', 'text', 'pl. Kovács Anna', 'name'), field('Telefonszám', 'telefon', 'tel', '+36 30 123 4567', 'tel'),
      h('label', { class: 'be-consent' }, h('input', { type: 'checkbox', name: 'hozzajarul' }), h('span', {}, 'Hozzájárulok, hogy a MOSAIC a visszahíváshoz kezelje az adataimat (', h('a', { href: '/aszf', target: '_blank', rel: 'noopener', text: 'ÁSZF' }), ').')),
      err, h('button', { type: 'submit', class: 'be-btn', text: 'Visszahívást kérek' }));
    return h('section', {}, title(heading), note(intro), form, h('a', { class: 'be-link', href: PHONE_HREF, text: `Vagy hívj most: ${PHONE}` }));
  }
  const sentView = () => h('section', { class: 'be-center' }, h('div', { class: 'be-tick', 'aria-hidden': 'true', text: '✓' }), title('Visszahívást kértél!'), note('Hamarosan hívunk a megadott számon.'));

  // --- naptar-fajl -------------------------------------------------------------------------------------------------------------------
  function addToCalendar() {
    const ics = F.icsFor({ startUnix: S.slot.start_unix, durationMin: dur(S.service) || 60, title: `${flow.brand}: ${nameOf(S.service)}`, location: placeText(), description: `MOSAIC. Tel.: ${PHONE}` });
    const a = h('a', { href: win.URL.createObjectURL(new win.Blob([ics], { type: 'text/calendar' })), download: 'mosaic-foglalas.ics' });
    doc.body.append(a); a.click(); a.remove();
  }

  // --- a Salonic adatlapja utan (C5) -----------------------------------------------------------------------------------------------
  // A suti.js (es ez a modul) a keretben betoltott sajat oldalunk cimet ide jelzi: elkelt idopont, visszaigazolas vagy ismeretlen.
  function onSalonicRedirect(href) {
    go('C5', { replace: true });
    win.setTimeout(() => resolveRedirect(href), 700);
  }
  function resolveRedirect(href) {
    const kind = F.classifyRedirect(href, { enginePath: flow.enginePath });
    if (kind === 'slot_lost') return go('A2', { replace: true });
    if (kind === 'confirmation') {
      // A Salonic csak sikeres foglalas utan iranyit a koszonooldalra, ezert a vendeget ellenorzestol fuggetlenul atadjuk a MEGLEVO
      // koszonooldalnak (eles tartomanyon): a mostani meres (konverziok, pixelek) azon fut valtozatlanul, egyszer, a fo ablakban.
      // Az ellenorzes eredmenye csak a sajat esemenyeinket (booking_completed / booking_error) szabja.
      const v = S.expected ? adapter.verifyConfirmation(href, S.expected) : null;
      if (v && v.ok) confirmed(v);
      else track('booking_error', { ...(S.service ? serviceParams(S.service) : {}), step: 'C5', reason: v ? 'verify_failed' : 'no_expectation',
        filter: v ? Object.entries(v.checks).filter(([, c]) => c.status === 'fail').map(([k]) => k).join(',') : undefined });
      // (a Salonic URL-je valtozatlan marad; csak a motor sajat URL-jen erkezett hirdetesi azonositok kerulnek a vegere, ha a Salonic nem hozta oket)
      if (HANDOFF) { win.location.assign(F.withAttribution(href, win.location.search)); return undefined; }
      // elonezeten / helyben: a motor maga mutatja a sikert (a Salonic az eles koszonooldalra iranyit, onnan nem ertesithetne minket)
      return go(v && v.ok ? 'C6' : 'A3U', { replace: true });
    }
    track('booking_error', { ...serviceParams(S.service), step: 'C5', reason: 'unknown_redirect' });
    return go('A3', { replace: true });
  }
  function confirmed(v) {
    S.confirmation = v;
    const cls = classifyService(flow.business, S.service);
    const type = effectiveType({ bookingType: cls.bookingType, splitByRuntime: cls.splitByRuntime, firstBooking: v.firstBooking });
    track('booking_completed', {
      ...serviceParams(S.service), booking_type: type, booking_id: v.bookingRef, final_price: v.reported.price ?? S.service.activePrice,
      new_or_returning: v.firstBooking ? 'new' : 'returning', acquisition: isAcquisition({ bookingType: cls.bookingType, splitByRuntime: cls.splitByRuntime, firstBooking: v.firstBooking }),
    }, { once: v.bookingRef });
  }
  win.mhKeretbenOldal = onSalonicRedirect;
  const destroy = () => {
    win.removeEventListener('popstate', onPop);
    win.clearTimeout(S.holdTimer);
    if (S.pmuCleanup) { S.pmuCleanup(); S.pmuCleanup = null; }
    renderToken += 1; // a folyamatban levo betoltes eredmenyet mar nem rajzoljuk ki
    if (win.mhKeretbenOldal === onSalonicRedirect) delete win.mhKeretbenOldal;
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
    Object.assign(S, { flow, services: null, voucher: false, service: null, exact: false, slots: [], slot: null, day: null, month: null, staff: null, place: null, expected: null, intentKey: null, staffCache: null,
      guestUrl: null, confirmation: null, intent: null, group: null, staffLabel: null, slotStaff: null, candidates: null, laserArea: null, slotLostNote: false });
    tracker.setBusiness(business);
  }
  function chooseFamily(fam) {
    track('booking_intent_selected', { step: 'H0', reason: fam.key });
    if (fam.key === 'pmu') { ctx.business = 'pmu'; return go('PMU'); }
    setBusiness(fam.business);
    return go(entry());
  }

  async function start() {
    if (ctx.business && ctx.business !== 'pmu' && !flow) { setView(alertBox('Ismeretlen üzletág.'), 'A3'); return; }
    track('booking_open', { entry: ctx.serviceKey ? 'service' : ctx.category ? 'category' : 'generic', reason: layer ? 'layer' : 'page' });
    if (ctx.sample) return sample();
    let first = entry();
    if (!flow) { // H0 vagy PMU: nincs mit pontositani
      elozmeny('replaceState', { view: first, depth: 0, beLayer: layer }, win.location.pathname + win.location.search + '#' + first);
      return show(first);
    }
    // Lezer: ?intent=first | returning -> a terulet-valasztas (LA2 / LA3), a konzultacio-kerdes (LA1) kihagyasaval; konkret szolgaltatas / kategoria elsobbseget elvez
    if (!ctx.serviceKey && !ctx.category && flow.business === 'laser' && (ctx.intent === 'first' || ctx.intent === 'returning')) first = ctx.intent === 'first' ? 'LA2' : 'LA3';
    if (ctx.serviceKey || ctx.category) {
      try {
        await ensureServices();
        // konkret szolgaltatas landing: az uzletag "exact" allapota (Fodraszat: HA3, a konzultacio egyenesen C1); nem kerdezzuk ujra a kezelest
        const svc = ctx.serviceKey ? F.findByKey(S.services, ctx.serviceKey, { voucher: S.voucher }) : null;
        if (svc) {
          S.service = svc; S.exact = true; track('booking_service_selected', serviceParams(svc));
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
          if (services.length === 1) { S.service = services[0]; S.exact = true; first = 'C1'; track('booking_service_selected', serviceParams(S.service)); }
          else if (services.length) { S.laserArea = { area, services }; track('booking_intent_selected', { step: 'landing', reason: area.key }); first = 'LA2B'; }
        }
      } catch (e) { console.error(e); }
    }
    elozmeny('replaceState', { view: first, depth: 0, beLayer: layer }, win.location.pathname + win.location.search + '#' + first);
    return show(first);
  }

  // Mintanezet foglalas nelkul: ?minta=siker|elkelt|hiba|ellenorizetlen|nincs-idopont|visszahivas-kesz
  function sample() {
    const t0 = Math.floor(now() / 86400000 + 2) * 86400 + 8 * 3600;
    S.service = { serviceId: '0', name: 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', durationMin: 80, activePrice: 26900, listPrice: null, bookingType: 'first_treatment' };
    if (!flow) { flow = FLOWS.headspa; S.flow = flow; ctx.business = 'headspa'; } // a mintanezet HeadSpa-adatokkal dolgozik (nincs uzletag-valasztas)
    S.slot = { start_unix: t0, staff_id: '1', staff_label: 'x', slot_id: 'minta' };
    S.slots = [0, 5400, 90000, 93600, 176400].map((d, i) => ({ start_unix: t0 + d, staff_id: '1', staff_label: 'x', slot_id: 'minta' + i, service_id: '0' }));
    S.place = { name: 'Mosaic Headspa', address: '1023 Budapest, Bécsi út 4. földszint 1. ajtó' };
    S.confirmation = { reported: { price: 26900, employee: 'Mirage' } };
    const map = { siker: 'C6', elkelt: 'A2', hiba: 'A3', ellenorizetlen: 'A3U', 'nincs-idopont': 'A1', 'visszahivas-kesz': 'A1_SENT' };
    S.adapterSample = true;
    adapter.getAvailability = async () => S.slots; // mintanezetben nincs halozat
    adapter.getPresentation = async () => ({ customCss: null });
    win.history.replaceState({ view: map[ctx.sample] || 'HS2', depth: 0 }, '', win.location.pathname + win.location.search);
    return show(map[ctx.sample] || 'HS2');
  }

  return { start: start(), state: S, show, go, destroy };
}
