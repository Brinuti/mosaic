// MOSAIC Booking Engine V1 - a foglalo felulete (HeadSpa az elso uzletag)
//
// Allapotonkent egy nezet (lasd flow.js): HS1 -> HS2/HS3 -> C1 -> (C2) -> C3 -> C4 -> C5 -> C6, mellettuk A1/A2/A3.
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
import { HEADSPA } from './flows/headspa.js';
import { OXYGEN } from './flows/oxygen.js';
import { HAIR } from './flows/hair.js';
import { LASER } from './flows/laser.js';

const FLOWS = { headspa: HEADSPA, oxygen: OXYGEN, hair: HAIR, laser: LASER };
const PHONE = '06 20 247 4444';
const PHONE_HREF = 'tel:+36202474444';
const STEPS = ['Szolgáltatás', 'Időpont', 'Összegzés', 'Adatok'];
const STEP_OF = { HS1: 0, HS2: 0, HS3: 0, OX1: 0, OX2: 0, HA1: 0, HA2: 0, HA2B: 0, HA3: 0, HA3B: 0, LA1: 0, LA2: 0, LA2B: 0, LA3: 0, C1: 1, C2: 1, A1: 1, A1_SENT: 1, A2: 1, C3: 2, C4: 3, C5: 3, A3: 3, A3U: 3, A3_CB: 3, A3_SENT: 3 };
const NO_STEPS = new Set(['C6']);
const MIN_LEAD_MINUTES = 30; // a fel oran belul kezdodo idopontot nem kinaljuk (mint a PMU foglalo)
const HOLD_MS = 4 * 60 * 1000 + 50 * 1000; // a Salonic 5 percig tartja fenn a megnyitott idopontot
// A Salonic-fiok betolti a MOSAIC kozos stiluslapjat (salonic/mosaic.css, vagy a PMU-nal pmu.css): a fejlec 70 px (a keret 78 px-t vag le),
// a lablec el van rejtve, az adatlap egy kepernyos: az "elkuldes" gomb alja 592 px + 24 px + a Salonic suti-savja (~197 px) = 813 px.
const FRAME_STYLED = Object.freeze({ crop: 78, visible: 735 });

export function startEngine({ root, doc = document, win = window, adapter = createSalonicAdapter(), now = () => Date.now() }) {
  const ctx = F.parseContext(win.location.search, doc.referrer, win.location.origin);
  const flow = FLOWS[ctx.business];
  const nowUnix = () => Math.floor(now() / 1000);
  const HANDOFF = F.shouldHandoff(win.location.hostname, win.location.search); // eles tartomanyon: atadas a meglevo koszonooldalnak

  // A sajat kereteben nyiltunk meg (a Salonic atiranyitotta az adatlapot): nem rajzolunk, szolunk a szulonek.
  try {
    if (win.top !== win.self && win.parent.location.hostname === win.location.hostname) {
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
    slots: [], slot: null, daypart: 'any', day: null, staff: null, place: null, expected: null, guestUrl: null, confirmation: null,
    callbackReason: 'nincs_idopont', slotLostNote: false, intent: null, group: null, staffLabel: null, slotStaff: null,
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
  const $ = (id) => doc.getElementById(id);
  const chevron = () => h('span', { class: 'be-chev', 'aria-hidden': 'true', text: '›' });
  const bigButton = (title, sub, onclick) => h('button', { type: 'button', class: 'be-choice', onclick },
    h('span', { class: 'be-choice-text' }, h('b', { text: title }), sub ? h('small', { text: sub }) : null), chevron());
  const primary = (text, onclick, extra = {}) => h('button', { type: 'button', class: 'be-btn', onclick, ...extra }, text);
  const secondary = (text, onclick) => h('button', { type: 'button', class: 'be-btn be-btn-2', onclick }, text);
  const link = (text, onclick) => h('button', { type: 'button', class: 'be-link', onclick, text });
  const note = (text, cls = '') => h('p', { class: ('be-note ' + cls).trim(), text });
  const alertBox = (text) => h('div', { class: 'be-alert', role: 'alert' }, text);
  const title = (text) => h('h2', { class: 'be-title', tabindex: '-1', text });

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
  const serviceFacts = (svc) => [svc.durationMin ? F.durationLabel(svc.durationMin) : null, priceText(svc) || null].filter(Boolean).join(' · ');
  // A kivalasztott szakember (a naptarban vagy a HA3-ban) cimkeje; a szakemberi kedvezmeny (pl. "Noel - 20% kedvezmeny!") az arban is latszik.
  const curStaffLabel = () => (S.slotStaff ? S.slotStaff.label : S.staff ? S.staffLabel : null);
  const priceNow = () => (S.service.bookingType === 'voucher_redemption' ? flow.copy.voucherSettled : F.priceLabel(F.priceFor(S.service, curStaffLabel()), zeroLabel(S.service)));
  const staffNote = () => { const p = F.staffDiscountPercent(curStaffLabel()); return p ? `${p}% szakemberi kedvezménnyel` : ''; };
  const serviceBar = (back) => h('div', { class: 'be-svc' },
    h('span', { class: 'be-svc-text' }, h('b', { text: nameOf(S.service) }),
      h('small', { text: [S.service.durationMin ? F.durationLabel(S.service.durationMin) : null, priceNow() || null, curStaffLabel()].filter(Boolean).join(' · ') })),
    back ? link('Módosítás', back) : null);
  const summaryRows = (rows) => h('dl', { class: 'be-rows' }, rows.filter(([, v]) => v).map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: v }))));
  const placeText = () => [S.place && S.place.name, S.place && S.place.address].filter(Boolean).join(', ');

  function setView(node, state) {
    root.replaceChildren(node);
    const step = STEP_OF[state];
    const steps = $('be-steps');
    if (steps) {
      steps.hidden = NO_STEPS.has(state) || step === undefined;
      steps.replaceChildren(...STEPS.map((t, i) => h('li', { class: i < step ? 'done' : i === step ? 'now' : '', 'aria-current': i === step ? 'step' : false },
        h('i', { text: i < step ? '✓' : String(i + 1) }), h('span', { text: t }))));
    }
    const back = $('be-back');
    if (back) back.style.visibility = S.depth > 0 && state !== 'C6' && !/_SENT$/.test(state) ? 'visible' : 'hidden';
    win.scrollTo(0, 0);
    const t = root.querySelector('.be-title');
    if (t) t.focus({ preventScroll: true });
  }

  // --- navigacio ------------------------------------------------------------------------------------------------------------------
  let renderToken = 0;
  async function show(state) {
    S.state = state;
    win.clearTimeout(S.holdTimer);
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
    if (replace) win.history.replaceState({ view: state, depth: S.depth }, '', '#' + state);
    else { S.depth += 1; win.history.pushState({ view: state, depth: S.depth }, '', '#' + state); }
    return show(state);
  }
  const needs = { C3: () => S.slot && S.service, C4: () => S.slot && S.service, C1: () => S.service, C2: () => S.service && S.slots.length, OX2: () => S.candidates,
    HA2: () => S.intent, HA2B: () => S.group, HA3: () => S.service, HA3B: () => S.service, LA2B: () => S.laserArea };
  win.addEventListener('popstate', (e) => {
    const view = e.state && e.state.view;
    S.depth = (e.state && e.state.depth) || 0;
    if (!view || (needs[view] && !needs[view]())) { S.depth = 0; show(entry()); return; }
    show(view);
  });
  $('be-back') && $('be-back').addEventListener('click', () => win.history.back());

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
    S.slots = await adapter.getAvailability(flow.business, S.service.serviceId, { days: 30, minLeadMinutes: MIN_LEAD_MINUTES });
    S.day = null;
    return S.slots;
  }
  const serviceParams = (svc) => ({ service: nameOf(svc), service_id: svc.serviceId, booking_type: classifyService(flow.business, svc).bookingType, list_price: svc.listPrice, final_price: svc.activePrice, voucher: svc.bookingType === 'voucher_redemption' });
  function chooseService(svc, { exact = false, next = 'C1' } = {}) {
    S.service = svc; S.exact = exact; S.slot = null; S.slots = []; S.staff = null; S.staffLabel = null; S.slotStaff = null;
    track('booking_service_selected', serviceParams(svc));
    return go(next);
  }
  // fromFilter: a naptarban (C2) konkret szakembert valasztott a vendeg -> ez vegigmegy az osszegzesen es az adatlapon;
  // egyebkent "barmely megfelelo szakember" (a Salonic oszt be).
  function pickSlot(slot, { fromFilter = false } = {}) {
    S.slot = slot;
    S.slotStaff = fromFilter && S.staff ? { id: String(S.staff), label: slot.staff_label } : null;
    track('booking_slot_selected', { ...serviceParams(S.service), staff_id: S.slotStaff ? S.slotStaff.id : undefined });
    return go('C3');
  }
  const staffRow = () => (flow.showStaffFilter ? (S.slotStaff ? S.slotStaff.label : 'Bármely megfelelő') : '');

  // --- nezetek ------------------------------------------------------------------------------------------------------------------
  const views = {
    HS1: async () => h('section', {}, title(flow.copy.hs1Title), h('div', { class: 'be-list' }, flow.copy.hs1.map((o) => bigButton(o.title, null, () => {
      track('booking_intent_selected', { step: 'HS1', reason: o.key });
      if (o.key === 'giftcard') { win.location.assign(flow.giftCardUrl); return; } // nem foglalasi allapot: kilep a Gift Card funnelbe
      S.voucher = o.key === 'voucher';
      go(F.next('HS1', o.key));
    })))),

    HS2: () => cardsView('HS2', false),
    HS3: () => cardsView('HS3', true),

    // Oxigen: egy belepesi kerdes; a szandekhez tartozo szolgaltatast a besorolas (bookingType) adja, nem azonositolista
    OX1: async () => {
      await ensureServices();
      const opts = flow.intents.map((intent) => ({ intent, candidates: F.intentCandidates(S.services, intent) })).filter((o) => o.candidates.length);
      if (!opts.length) return loadError();
      return h('section', {}, title(flow.copy.introTitle), h('div', { class: 'be-list' }, opts.map((o) => bigButton(o.intent.title, o.intent.sub, () => {
        track('booking_intent_selected', { step: 'OX1', reason: o.intent.key });
        if (o.candidates.length === 1) return chooseService(o.candidates[0]);
        S.candidates = o.candidates; // tobb Salonic-valtozat: rovid valasztas (OX2)
        return go(F.next('OX1', 'variant'));
      }))));
    },
    OX2: async () => h('section', {}, title(flow.copy.variantTitle), h('div', { class: 'be-list' }, S.candidates.map((svc) => bigButton(nameOf(svc), serviceFacts(svc), () => chooseService(svc))))),

    // Noi fodraszat: nem mutatunk 40+ nyers Salonic-szolgaltatast. A szandekek a jovahagyott kategoria-csoportok (flows/hair.js);
    // a konzultacio egyenesen C1-re megy; a kezelesek hajhossz szerint egy csoportban vannak (HA2 -> HA2B).
    HA1: async () => {
      await ensureServices();
      const opts = flow.intents.map((intent) => ({ intent, services: intent.consult ? S.services.filter((s) => s.bookingType === 'consultation') : F.intentServices(S.services, flow.intents, intent) })).filter((o) => o.services.length);
      if (!opts.length) return loadError();
      return h('section', {}, title(flow.copy.introTitle), h('div', { class: 'be-list' }, opts.map((o) => bigButton(o.intent.title, o.intent.sub, () => {
        track('booking_intent_selected', { step: 'HA1', reason: o.intent.key });
        if (o.intent.consult) return chooseService(o.services[0], { next: F.next('HA1', 'consult') });
        S.intent = o;
        return go(F.next('HA1', 'intent'));
      }))));
    },
    HA2: async () => h('section', {}, title(flow.copy.groupTitle), note(S.intent.intent.title),
      h('div', { class: 'be-list' }, F.groupServices(S.intent.services).map((g) => bigButton(g.title, F.groupFacts(g), () => {
        if (g.items.length === 1) return chooseService(g.items[0].service, { next: F.next('HA2', 'service') });
        S.group = g; // tobb hajhossz-valtozat: HA2B
        return go(F.next('HA2', 'group'));
      })))),
    HA2B: async () => h('section', {}, title(flow.copy.lengthTitle), note(S.group.title),
      h('div', { class: 'be-list' }, S.group.items.map((it) => bigButton(it.length || nameOf(it.service), serviceFacts(it.service), () => chooseService(it.service, { next: F.next('HA2B', 'service') }))))),
    // "Van valasztott fodraszod?": nem kotelezo; ha a szolgaltatashoz csak egy szakember tartozik, nincs mit valasztani
    HA3: async () => {
      if (S.service.staffIds.length <= 1) { go(F.next('HA3', 'any'), { replace: true }); return null; }
      return h('section', {}, title(flow.copy.staffTitle), serviceBar(null),
        h('div', { class: 'be-list' }, bigButton(flow.copy.staffNone, null, () => { S.staff = null; S.staffLabel = null; go(F.next('HA3', 'any')); }),
          bigButton(flow.copy.staffChoose, null, () => go(F.next('HA3', 'choose')))));
    },
    HA3B: async () => {
      const staff = (await adapter.getStaff(flow.business, S.service.serviceId)).filter((x) => x.staff_label); // a nevet a naptar-API adja (csak akinek van szabad ideje)
      if (!staff.length) return h('section', {}, title(flow.copy.staffListTitle), note('Most egyik fodrásznak sincs szabad időpontja ehhez a kezeléshez.'),
        h('div', { class: 'be-actions' }, primary('Bármely fodrász', () => { S.staff = null; S.staffLabel = null; go('C1'); })));
      return h('section', {}, title(flow.copy.staffListTitle), h('div', { class: 'be-list' }, staff.map((x) => bigButton(x.staff_label, null, () => {
        S.staff = x.staff_id; S.staffLabel = x.staff_label;
        track('booking_filter_used', { filter: 'staff' });
        go(F.next('HA3B', 'staff'));
      }))));
    },

    // Lezer: konzultacio (egyenesen C1) / "Mar tudom" -> terulet -> kezeles / "Mar jarok" -> terulet -> kezeles (2. alkalomtol arak)
    LA1: async () => {
      await ensureServices();
      const consult = S.services.find((s) => s.bookingType === 'consultation');
      const has = { consult: !!consult, known: S.services.some((s) => s.bookingType === 'first_treatment'), returning: S.services.some((s) => s.bookingType === 'returning_treatment') };
      const opts = flow.copy.intro.filter((o) => has[o.key]);
      if (!opts.length) return loadError();
      return h('section', {}, title(flow.copy.introTitle), h('div', { class: 'be-list' }, opts.map((o) => bigButton(o.title, o.sub, () => {
        track('booking_intent_selected', { step: 'LA1', reason: o.key });
        if (o.key === 'consult') return chooseService(consult, { next: F.next('LA1', 'consult') });
        return go(F.next('LA1', o.key));
      }))));
    },
    LA2: () => laserAreas('LA2', 'first_treatment', flow.copy.areaTitle),
    LA3: () => laserAreas('LA3', 'returning_treatment', flow.copy.returningTitle),
    LA2B: async () => h('section', {}, title(flow.copy.treatmentTitle), note(S.laserArea.area.title),
      h('div', { class: 'be-list' }, S.laserArea.services.map((svc) => {
        const l = flow.labelOf(svc);
        return bigButton(l.title, [serviceFacts(svc), l.tags.join(', ')].filter(Boolean).join(' · '), () => chooseService(svc, { next: F.next('LA2B', 'service') }));
      }))),

    C1: async () => {
      if (!S.slots.length) await loadSlots();
      if (!S.slots.length) { track('booking_no_slots', { ...serviceParams(S.service), step: 'C1' }); S.callbackReason = 'nincs_idopont'; go('A1', { replace: true }); return null; }
      // a valasztott szakember idopontjai (HA3 / naptar); ha neki nincs, felkinaljuk a "barmely szakember"-t
      const pool = S.staff ? F.filterSlots(S.slots, { staffId: S.staff }) : S.slots;
      if (!pool.length) return h('section', {}, title('Legközelebbi szabad időpontok'), serviceBar(() => win.history.back()),
        alertBox(`${S.staffLabel || 'A kiválasztott szakembernek'} most nincs szabad időpontja.`),
        h('div', { class: 'be-actions' }, primary('Bármely szakember', () => { S.staff = null; S.staffLabel = null; show('C1'); }),
          link('Nem találok megfelelő időpontot', () => { S.callbackReason = 'nincs_idopont'; go('A1'); })));
      const groups = F.quickSlots(pool, { max: 5, nowUnix: nowUnix() });
      track('booking_slot_viewed', { ...serviceParams(S.service), step: 'C1', count: groups.reduce((n, g) => n + g.items.length, 0) });
      return h('section', {}, title('Legközelebbi szabad időpontok'), serviceBar(S.exact ? null : () => win.history.back()),
        S.slotLostNote ? alertBox('Ez az időpont közben elkelt. Válassz egy másikat!') : null,
        h('div', { class: 'be-days' }, groups.map((g) => h('div', { class: 'be-day' }, h('b', { text: g.label }),
          h('div', { class: 'be-times' }, g.items.map((i) => h('button', { type: 'button', class: 'be-time', text: i.time, onclick: () => pickSlot(i.slot, { fromFilter: !!S.staff }) })))))),
        h('div', { class: 'be-actions' }, secondary('További időpontok', () => go('C2')),
          link('Nem találok megfelelő időpontot', () => { S.callbackReason = 'nincs_idopont'; track('booking_no_slots', { ...serviceParams(S.service), step: 'C1', reason: 'user' }); go('A1'); })));
    },

    C2: async () => {
      if (!S.slots.length) await loadSlots();
      const days = F.availableDays(S.slots);
      if (!days.length) { S.callbackReason = 'nincs_idopont'; go('A1', { replace: true }); return null; }
      if (!S.day || !days.some((d) => d.key === S.day)) S.day = days[0].key;
      const staffOptions = flow.showStaffFilter ? [...new Map(S.slots.map((s) => [s.staff_id, s.staff_label])).entries()] : [];
      const list = F.uniqueTimes(F.filterSlots(S.slots, { day: S.day, daypart: S.daypart, staffId: S.staff || null }));
      track('booking_slot_viewed', { ...serviceParams(S.service), step: 'C2', count: list.length });
      const redraw = (filter) => { if (filter) track('booking_filter_used', { filter }); show('C2'); };
      return h('section', {}, title('Válassz időpontot'), serviceBar(() => win.history.back()),
        h('div', { class: 'be-strip', role: 'group', 'aria-label': 'Nap' }, days.map((d) => h('button', { type: 'button', class: 'be-chip', 'aria-pressed': String(d.key === S.day), text: d.label, onclick: () => { S.day = d.key; redraw('day'); } }))),
        h('p', { class: 'be-label', text: 'Napszak' }),
        h('div', { class: 'be-strip', role: 'group', 'aria-label': 'Napszak' }, F.DAYPARTS.map(([k, t]) => h('button', { type: 'button', class: 'be-chip', 'aria-pressed': String(k === S.daypart), text: t, onclick: () => { S.daypart = k; redraw('daypart'); } }))),
        staffOptions.length > 1 ? h('label', { class: 'be-label' }, 'Szakember', h('select', { class: 'be-select', onchange: (e) => { S.staff = e.target.value || null; S.staffLabel = S.staff ? e.target.selectedOptions[0].textContent : null; redraw('staff'); } },
          h('option', { value: '', text: 'Bármely megfelelő szakember' }), staffOptions.map(([id, label]) => h('option', { value: id, selected: String(S.staff) === String(id), text: label || id })))) : null,
        list.length ? h('div', { class: 'be-times be-grid' }, list.map((s) => h('button', { type: 'button', class: 'be-time', text: F.timeLabel(s.start_unix), onclick: () => pickSlot(s, { fromFilter: true }) })))
          : h('div', {}, note('Erre a napszakra nincs szabad időpont.'), link('Nem találok megfelelő időpontot', () => { S.callbackReason = 'nincs_idopont'; go('A1'); })));
    },

    C3: async () => {
      if (!S.place) { try { S.place = await adapter.getPlace(flow.business); } catch (e) { S.place = null; } }
      return h('section', {}, title('A választásod'),
        h('div', { class: 'be-card' }, h('b', { class: 'be-card-title', text: nameOf(S.service) }),
          summaryRows([['Időtartam', S.service.durationMin ? F.durationLabel(S.service.durationMin) : ''], ['Ár', [priceNow(), staffNote() && `(${staffNote()})`].filter(Boolean).join(' ')],
            ['Dátum', F.longDate(S.slot.start_unix)], ['Időpont', F.timeLabel(S.slot.start_unix)],
            ['Szakember', staffRow()], ['Helyszín', placeText()]])),
        h('div', { class: 'be-actions' }, primary('Tovább az adatokhoz', () => go(F.next('C3', 'next'))), link('Másik időpontot választok', () => win.history.back())));
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
      const fallback = h('p', { class: 'be-note', hidden: true }, 'Nem jelenik meg az űrlap? ', h('a', { href: S.guestUrl, target: '_top', text: 'Nyisd meg itt' }), '.');
      const help = h('div', { class: 'be-help', hidden: true }, note('Ha az űrlap helyett a Salonic főoldala látszik, az időpontot épp valaki más foglalja. Válassz másik időpontot.'),
        secondary('Másik időpontot választok', () => go('C1')));
      const frame = h('iframe', { class: 'be-iframe', title: 'Foglalás véglegesítése', src: S.guestUrl, style: 'visibility:hidden' });
      const slow = win.setTimeout(() => { fallback.hidden = false; help.hidden = false; }, 6000);
      frame.addEventListener('load', () => { win.clearTimeout(slow); loading.hidden = true; frame.style.visibility = ''; win.setTimeout(() => { help.hidden = false; }, 2500); });
      // A Salonic 5 percig tartja fenn az idopontot, utana a sajat fooldalara dob: ezt mi is figyeljuk (4:50).
      S.holdTimer = win.setTimeout(() => { if (S.state === 'C4') { S.a2Reason = 'expired'; go('A2', { replace: true }); } }, HOLD_MS);
      return h('section', {}, title('Add meg az adataidat'),
        h('div', { class: 'be-mini' }, h('b', { text: `${F.longDate(S.slot.start_unix)} · ${F.timeLabel(S.slot.start_unix)}` }), h('span', { text: nameOf(S.service) }),
          link('Módosítás', () => win.history.go(-2))),
        h('div', { class: 'be-frame', 'data-styled': String(styled), style: `--visible:${geo.visible}px;--crop:${geo.crop}px` }, loading, frame), fallback, help);
    },

    C5: async () => h('section', { class: 'be-center' }, h('div', { class: 'be-spinner', 'aria-hidden': 'true' }), title('Időpontod rögzítése…'),
      h('ul', { class: 'be-check' }, h('li', { class: 'ok', text: 'Adatok ellenőrzése' }), h('li', { text: 'Foglalás ellenőrzése' }), h('li', { text: 'Visszaigazolás' }))),

    C6: async () => {
      const c = S.confirmation;
      const rep = c ? c.reported : {};
      const voucher = S.service.bookingType === 'voucher_redemption';
      const price = voucher ? flow.copy.voucherSettled : F.priceLabel(rep.price ?? F.priceFor(S.service, curStaffLabel()), zeroLabel(S.service));
      return h('section', { class: 'be-center be-success' }, h('div', { class: 'be-tick', 'aria-hidden': 'true', text: '✓' }), title('Foglalásod sikeres!'),
        h('div', { class: 'be-card be-left' }, h('b', { class: 'be-card-title', text: nameOf(S.service) }),
          summaryRows([['Időtartam', S.service.durationMin ? F.durationLabel(S.service.durationMin) : ''], ['Ár', price],
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
        h('div', { class: 'be-actions' }, secondary('Másik nap…', () => { S.slotLostNote = false; go('C2'); }),
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
      return h('section', {}, title(heading), h('div', { class: 'be-list' }, areas.map((o) => bigButton(o.area.title, null, () => {
        S.laserArea = o;
        track('booking_filter_used', { filter: 'area' });
        if (o.services.length === 1) return chooseService(o.services[0], { next: F.next(state, 'service') }); // egy szolgaltatas: nincs mit pontositani
        return go(F.next(state, 'area'));
      }))));
    });
  }

  function cardsView(state, voucher) {
    return ensureServices().then(() => {
      const cards = F.cardsFor(S.services, flow.cards, { voucher });
      if (!cards.length) return loadError();
      return h('section', {}, title(voucher ? flow.copy.hs3Title : flow.copy.hs2Title), voucher ? note(flow.copy.hs3Note) : null,
        h('div', { class: 'be-list' }, cards.map(({ card, service }) => bigButton(card.title,
          [service.durationMin ? F.durationLabel(service.durationMin) : null, voucher ? flow.copy.voucherSettled : F.formatPrice(service.activePrice)].filter(Boolean).join(' · '),
          () => chooseService(service)))));
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
      const body = new URLSearchParams({ 'form-name': 'motor-visszahivas', nev: v('nev'), telefon: v('telefon'), uzletag: flow.business, szolgaltatas: S.service ? nameOf(S.service) : '', ok: S.callbackReason, oldal: 'foglalo-motor', forras: ctx.sourcePage || '' });
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
    const ics = F.icsFor({ startUnix: S.slot.start_unix, durationMin: S.service.durationMin || 60, title: `${flow.brand}: ${nameOf(S.service)}`, location: placeText(), description: `MOSAIC. Tel.: ${PHONE}` });
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
      if (HANDOFF) { win.location.assign(href); return undefined; }
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

  // --- belepes ------------------------------------------------------------------------------------------------------------------------
  function entry() { return F.entryState({ hasService: false, voucher: S.voucher, first: flow.firstState, voucherState: flow.voucherState, exact: flow.exactState }); }

  async function start() {
    if (!flow) { setView(alertBox('Ismeretlen üzletág.'), 'A3'); return; }
    track('booking_open', { entry: ctx.serviceKey ? 'service' : ctx.category ? 'category' : 'generic' });
    if (ctx.sample) return sample();
    let first = entry();
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
          if (services.length) { S.intent = { intent, services }; track('booking_intent_selected', { step: 'landing', reason: intent.key }); first = 'HA2'; }
        } else if (ctx.category && flow.areas) {
          // Lezer kategoria-landing (?category=<terulet kulcsa>, pl. arc): csak a terulet ismert -> a kezeles-pontositasra (LA2B)
          const area = flow.areas.find((a) => a.key === ctx.category);
          const services = area ? S.services.filter((s) => s.bookingType === 'first_treatment' && flow.areaOf(s).key === area.key) : [];
          if (services.length === 1) { S.service = services[0]; S.exact = true; first = 'C1'; track('booking_service_selected', serviceParams(S.service)); }
          else if (services.length) { S.laserArea = { area, services }; track('booking_intent_selected', { step: 'landing', reason: area.key }); first = 'LA2B'; }
        }
      } catch (e) { console.error(e); }
    }
    win.history.replaceState({ view: first, depth: 0 }, '', win.location.pathname + win.location.search + '#' + first);
    return show(first);
  }

  // Mintanezet foglalas nelkul: ?minta=siker|elkelt|hiba|ellenorizetlen|nincs-idopont|visszahivas-kesz
  function sample() {
    const t0 = Math.floor(now() / 86400000 + 2) * 86400 + 8 * 3600;
    S.service = { serviceId: '0', name: 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', durationMin: 80, activePrice: 26900, listPrice: null, bookingType: 'first_treatment' };
    S.slot = { start_unix: t0, staff_id: '1', staff_label: 'x', slot_id: 'minta' };
    S.slots = [0, 5400, 90000, 93600, 176400].map((d, i) => ({ start_unix: t0 + d, staff_id: '1', staff_label: 'x', slot_id: 'minta' + i, service_id: '0' }));
    S.place = { name: 'Mosaic Headspa', address: '1023 Budapest, Bécsi út 4. földszint 1. ajtó' };
    S.confirmation = { reported: { price: 26900, employee: 'Mirage' } };
    const map = { siker: 'C6', elkelt: 'A2', hiba: 'A3', ellenorizetlen: 'A3U', 'nincs-idopont': 'A1', 'visszahivas-kesz': 'A1_SENT' };
    S.adapterSample = true;
    adapter.getAvailability = async () => S.slots; // mintanezetben nincs halozat
    adapter.getPresentation = async () => ({ customCss: null });
    win.history.replaceState({ view: map[ctx.sample] || 'HS1', depth: 0 }, '', win.location.pathname + win.location.search);
    return show(map[ctx.sample] || 'HS1');
  }

  return { start: start(), state: S, show, go };
}
