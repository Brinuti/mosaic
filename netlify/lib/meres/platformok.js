// QA-2 platform-keresek (ARNYEKMOD): Meta CAPI, TikTok Events API, Google Ads (feltoltott kattintas-konverzio) es GA4 Measurement Protocol.
// A kerest egy TISZTA fuggveny allitja ossze (titok nelkul: ez kerul a naploba is); a hitelesitest (token, api_secret) csak a szallito (kuldes) adja hozza a kornyezetbol.
//
// ARNYEKMOD VEDELMEK (a kodban, nem csak beallitasban): a celpont kizarolag az arnyek-celpont; el pixelre / property-re / elo konverzios akciora a keres NEM allithato ossze:
//   Meta: csak a "MOSAIC ARNYEK meres-teszt" dataset (28616665324611098) + KOTELEZO test_event_code; TikTok: csak az "ARNYEK" pixel + test_event_code;
//   Google Ads: csak a 7825199989-7825200916 "ARNYEK - ..." masodlagos UPLOAD_CLICKS akciok; GA4: csak teszt-property (az elo G-H4206SQ0Q7 tiltott).
import { metaNev } from './esemeny-modell.js';
import { googleKattintas, metaFbc } from './erkezes.js';

export const ARNYEK = Object.freeze({
  meta: Object.freeze({ datasetId: '28616665324611098', nev: 'MOSAIC ARNYEK meres-teszt', apiVerzio: 'v21.0' }),
  tiktok: Object.freeze({ pixelCode: 'DB2GTTJC77UE4D1NE4MG', pixelId: '7693568787819921416', nev: 'MOSAIC ARNYEK meres-teszt' }),
  google: Object.freeze({
    customerId: '6088874770', apiVerzio: 'v21',
    // alapesemeny -> "ARNYEK - ..." masodlagos UPLOAD_CLICKS akcio (a Google-ban visszajaro / ernyo arnyek-akcio nincs: oda nem kuldunk)
    akciok: Object.freeze({
      headspa: { FoglalasElso: '7825199989', Ajandekkartya: '7825199992' },
      fodrasz: { FoglalasElso: '7825199995', Konzultacio: '7825200898' },
      oxigen: { FoglalasElso: '7825200901', Konzultacio: '7825200904' },
      szor: { FoglalasElso: '7825200907', Konzultacio: '7825200910' },
      pmu: { FoglalasElso: '7825200913', Konzultacio: '7825200916' },
    }),
  }),
});
export const ELO_CELOK = Object.freeze({
  meta: ['3473839859576758', '1361403694872594', '643342342027957', '1019878750660854', '729596671946533'],
  tiktok: ['CTDGK5BC77U0PIODKP30'], ga4: ['G-H4206SQ0Q7'],
  google_primary: ['7030256606', '7497019094', '7497204933', '7497204930', '7821698547', '7801471836', '7801343216', '7803645055', '7803499839'],
});
export const PLATFORMOK = Object.freeze(['meta', 'tiktok', 'google', 'ga4']);
// melyik uzletagnal melyik platformra kuldunk alapbol (a veszkapcsolo ezt tovabb szukitheti): a TikTok csak a HeadSpa-ra hirdet (DECISION #5)
export const ALAP_UZLETAG_PLATFORM = Object.freeze({ meta: ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu'], tiktok: ['headspa'], google: ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu'], ga4: ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu'] });

const GA4_NEV = { FoglalasElso: 'foglalas_elso', Konzultacio: 'konzultacio', Visszajaro: 'visszajaro', Ajandekkartya: 'purchase' };

function googleIdo(unix) { // "yyyy-mm-dd hh:mm:ss+02:00" (Europe/Budapest)
  const d = new Date(unix * 1000);
  const r = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map((p) => [p.type, p.value]));
  const helyi = Date.UTC(+r.year, +r.month - 1, +r.day, +r.hour, +r.minute, +r.second);
  const eltolasPerc = Math.round((helyi - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const ei = Math.abs(eltolasPerc);
  return `${r.year}-${r.month}-${r.day} ${r.hour}:${r.minute}:${r.second}${eltolasPerc < 0 ? '-' : '+'}${String(Math.floor(ei / 60)).padStart(2, '0')}:${String(ei % 60).padStart(2, '0')}`;
}
export { googleIdo };

const egesz = (v) => Math.max(0, Math.round(Number(v) || 0));
const tisztit = (o) => { for (const k of Object.keys(o)) { const v = o[k]; if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) delete o[k]; } return o; };

/**
 * ctx: { fk, erk (tisztitott erkezes), hash: { em, ph_meta, ph_e164, ext }, hozz (platformSzabaly eredmenye platformonkent), ua, ip, oldal, teszt: { meta, tiktok } }
 * -> { platform, platform_nev, url, method, fejlec_nevek, body, cel } | { tiltva: 'ok' } (vedelem fogta meg) | { kihagyva: 'ok' } (a modell szerint ide nem megy)
 */
export function metaKerelem(e, ctx, env = {}) {
  const dataset = (env && env.META_ARNYEK_DATASET) || ARNYEK.meta.datasetId;
  if (ELO_CELOK.meta.includes(dataset) || dataset !== ARNYEK.meta.datasetId) return { tiltva: 'a celpont nem az ARNYEK dataset (elo pixelre nem kuldunk)' };
  const teszt = env && env.META_TESZT_KOD;
  if (!teszt) return { tiltva: 'nincs META_TESZT_KOD: Meta-nak csak tesztkoddal kuldunk' };
  const szab = ctx.hozz.meta;
  const ud = tisztit({
    em: ctx.hash.em && szab.felhasznaloi_adat ? [ctx.hash.em] : null, ph: ctx.hash.ph_meta && szab.felhasznaloi_adat ? [ctx.hash.ph_meta] : null,
    external_id: ctx.hash.ext ? [ctx.hash.ext] : null, client_ip_address: ctx.ip, client_user_agent: ctx.ua, fbc: metaFbc(ctx.erk), fbp: ctx.erk.fbp,
  });
  const nev = metaNev(e, ctx.fk.uzletag);
  const adat = tisztit({
    event_name: nev, event_time: ctx.fk.ido, event_id: e.esemeny_id, action_source: 'website', event_source_url: ctx.oldal,
    user_data: ud,
    custom_data: tisztit({ value: egesz(e.ertek), currency: 'HUF', order_id: ctx.fk.source_entity_id, content_name: ctx.fk.szolgaltatas, content_category: ctx.fk.uzletag, esemeny_tipus: e.tipus, utm_source: ctx.erk.utm_utolso && ctx.erk.utm_utolso.source, utm_campaign: ctx.erk.utm_utolso && ctx.erk.utm_utolso.campaign }),
  });
  return { platform: 'meta', platform_nev: nev, url: `https://graph.facebook.com/${ARNYEK.meta.apiVerzio}/${dataset}/events`, method: 'POST', fejlec_nevek: ['content-type'], cel: { dataset, nev: ARNYEK.meta.nev, test_event_code: teszt }, body: { data: [adat], test_event_code: teszt, partner_agent: 'mosaic-qa2-arnyek' } };
}

export function tiktokKerelem(e, ctx, env = {}) {
  const pixel = (env && env.TIKTOK_ARNYEK_PIXEL) || ARNYEK.tiktok.pixelCode;
  if (ELO_CELOK.tiktok.includes(pixel) || pixel !== ARNYEK.tiktok.pixelCode) return { tiltva: 'a celpont nem az ARNYEK pixel (elo pixelre nem kuldunk)' };
  const teszt = env && env.TIKTOK_TESZT_KOD;
  if (!teszt) return { tiltva: 'nincs TIKTOK_TESZT_KOD: TikToknak csak tesztkoddal kuldunk' };
  const szab = ctx.hozz.tiktok;
  // HeadSpa ernyo (uj vendeg foglalas + ajandekkartya) = CompletePayment (DECISION: a CompletePayment csak ez); minden mas egyedi esemenynev
  const nev = e.tipus === 'ernyo' && ctx.fk.uzletag === 'headspa' ? 'CompletePayment' : metaNev(e, ctx.fk.uzletag);
  const user = tisztit({ email: ctx.hash.em && szab.felhasznaloi_adat ? ctx.hash.em : null, phone: ctx.hash.ph_e164 && szab.felhasznaloi_adat ? ctx.hash.ph_e164 : null, external_id: ctx.hash.ext, ttclid: ctx.erk.tiktok && ctx.erk.tiktok.ttclid && ctx.erk.tiktok.ttclid.ertek, ttp: ctx.erk.ttp, ip: ctx.ip, user_agent: ctx.ua });
  const kod = ctx.fk.tipus === 'ajandekkartya' ? 'ajandekkartya' : `${ctx.fk.uzletag}_${e.nev}`.toLowerCase();
  const adat = tisztit({
    event: nev, event_time: ctx.fk.ido, event_id: e.esemeny_id, user,
    properties: { currency: 'HUF', value: egesz(e.ertek), content_type: 'product', contents: [{ content_id: kod, content_name: ctx.fk.szolgaltatas || kod, quantity: 1, price: egesz(e.ertek) }], order_id: ctx.fk.source_entity_id },
    page: { url: ctx.oldal },
  });
  return { platform: 'tiktok', platform_nev: nev, url: 'https://business-api.tiktok.com/open_api/v1.3/event/track/', method: 'POST', fejlec_nevek: ['content-type', 'access-token'], cel: { pixel_code: pixel, nev: ARNYEK.tiktok.nev, test_event_code: teszt }, body: { event_source: 'web', event_source_id: pixel, test_event_code: teszt, data: [adat] } };
}

export function googleKerelem(e, ctx, env = {}) {
  if (e.tipus !== 'alap' || e.nev === 'Visszajaro') return { kihagyva: 'a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)' };
  const akcioId = ARNYEK.google.akciok[ctx.fk.uzletag] && ARNYEK.google.akciok[ctx.fk.uzletag][e.nev];
  if (!akcioId) return { kihagyva: `nincs "ARNYEK" masodlagos akcio ehhez: ${ctx.fk.uzletag} / ${e.nev}` };
  if (ELO_CELOK.google_primary.includes(akcioId)) return { tiltva: 'elo konverzios akcio: nem kuldhetunk' };
  const szab = ctx.hozz.google;
  const click = googleKattintas(ctx.erk);
  const azon = [];
  if (szab.felhasznaloi_adat) { if (ctx.hash.em) azon.push({ hashedEmail: ctx.hash.em }); if (ctx.hash.ph_e164) azon.push({ hashedPhoneNumber: ctx.hash.ph_e164 }); }
  const konv = tisztit({
    conversionAction: `customers/${ARNYEK.google.customerId}/conversionActions/${akcioId}`, conversionDateTime: googleIdo(ctx.fk.ido), conversionValue: egesz(e.ertek), currencyCode: 'HUF', orderId: ctx.fk.source_entity_id,
    gclid: click && click.tipus === 'gclid' ? click.ertek : null, wbraid: click && click.tipus === 'wbraid' ? click.ertek : null, gbraid: click && click.tipus === 'gbraid' ? click.ertek : null,
    userIdentifiers: azon,
    consent: { adUserData: szab.jel.ad_user_data, adPersonalization: szab.jel.ad_personalization },
  });
  const validateOnly = !(env && String(env.GOOGLE_ADS_ELES_KULDES) === '1'); // alap: csak ervenyesites (validateOnly) - a masodlagos akcioba valodi feltoltest csak kifejezetten engedelyezve
  return { platform: 'google', platform_nev: `ARNYEK-${akcioId}`, url: `https://googleads.googleapis.com/${ARNYEK.google.apiVerzio}/customers/${ARNYEK.google.customerId}:uploadClickConversions`, method: 'POST', fejlec_nevek: ['content-type', 'authorization', 'developer-token', 'login-customer-id'], cel: { customer_id: ARNYEK.google.customerId, conversion_action: akcioId, validate_only: validateOnly }, body: { conversions: [konv], partialFailure: true, validateOnly } };
}

export function ga4Kerelem(e, ctx, env = {}) {
  if (e.tipus !== 'alap') return { kihagyva: 'a GA4-be csak alapesemeny megy (az ernyo nem)' };
  const mid = env && env.GA4_TESZT_MEASUREMENT_ID;
  if (!mid) return { tiltva: 'nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-property-be kuldunk' };
  if (ELO_CELOK.ga4.includes(mid)) return { tiltva: 'az elo GA4 property tiltott' };
  const ga = ctx.erk.ga4 || {};
  if (!ga.client_id) return { tiltva: 'nincs GA4 client_id (nincs _ga suti): a Measurement Protocol client_id nelkul nem kuldheto' };
  const szab = ctx.hozz.ga4;
  const params = tisztit({ session_id: ga.session_id, engagement_time_msec: 1, value: egesz(e.ertek), currency: 'HUF', transaction_id: e.nev === 'Ajandekkartya' ? ctx.fk.source_entity_id : null, esemeny_id: e.esemeny_id, uzletag: ctx.fk.uzletag,
    items: e.nev === 'Ajandekkartya' ? [{ item_id: ctx.fk.szolgaltatas || 'ajandekkartya', item_name: ctx.fk.szolgaltatas || 'Ajandekkartya', price: egesz(e.ertek), quantity: 1 }] : null,
    source: ctx.erk.utm_utolso && ctx.erk.utm_utolso.source, medium: ctx.erk.utm_utolso && ctx.erk.utm_utolso.medium, campaign: ctx.erk.utm_utolso && ctx.erk.utm_utolso.campaign });
  const consent = szab.jel.ad_user_data === 'UNSPECIFIED' ? null : { ad_user_data: szab.jel.ad_user_data, ad_personalization: szab.jel.ad_personalization };
  return { platform: 'ga4', platform_nev: GA4_NEV[e.nev], url: `https://www.google-analytics.com/mp/collect?measurement_id=${mid}`, method: 'POST', fejlec_nevek: ['content-type'], cel: { measurement_id: mid }, body: tisztit({ client_id: ga.client_id, timestamp_micros: String(ctx.fk.ido * 1_000_000), consent, events: [{ name: GA4_NEV[e.nev], params }] }) };
}
export const KEREM_EPITO = { meta: metaKerelem, tiktok: tiktokKerelem, google: googleKerelem, ga4: ga4Kerelem };

/**
 * Szallito: a titkokat (token / api_secret) CSAK itt, a kornyezetbol adjuk a kereshez; a naplozott kerelembe nem kerulnek.
 * -> { allapot: 'elkuldve' | 'hiba' | 'nincs_hitelesites', http_status, valasz (szoveg, max 2000), kuldo }
 */
export async function kuldes(kerelem, env = {}, fetchImpl = fetch, ms = 8000) {
  const titkos = { meta: env.META_CAPI_TOKEN, tiktok: env.TIKTOK_EVENTS_TOKEN, google: env.GOOGLE_ADS_ACCESS_TOKEN && env.GOOGLE_ADS_DEVELOPER_TOKEN, ga4: env.GA4_TESZT_API_SECRET };
  if (!titkos[kerelem.platform]) return { allapot: 'nincs_hitelesites', http_status: null, valasz: null, kuldo: 'kozvetlen' };
  let url = kerelem.url; const fejlec = { 'content-type': 'application/json' };
  if (kerelem.platform === 'meta') url += '?access_token=' + encodeURIComponent(env.META_CAPI_TOKEN);
  if (kerelem.platform === 'tiktok') fejlec['access-token'] = env.TIKTOK_EVENTS_TOKEN;
  if (kerelem.platform === 'google') { fejlec.authorization = 'Bearer ' + env.GOOGLE_ADS_ACCESS_TOKEN; fejlec['developer-token'] = env.GOOGLE_ADS_DEVELOPER_TOKEN; if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) fejlec['login-customer-id'] = env.GOOGLE_ADS_LOGIN_CUSTOMER_ID; }
  if (kerelem.platform === 'ga4') url += '&api_secret=' + encodeURIComponent(env.GA4_TESZT_API_SECRET);
  const ab = new AbortController(); const t = setTimeout(() => ab.abort(), ms);
  try {
    const r = await fetchImpl(url, { method: kerelem.method, headers: fejlec, body: JSON.stringify(kerelem.body), signal: ab.signal });
    const szoveg = (await r.text()).slice(0, 2000);
    let j = null; try { j = JSON.parse(szoveg); } catch (x) { /* nem JSON */ }
    const ok = r.status >= 200 && r.status < 300 && (kerelem.platform === 'meta' ? j && j.events_received >= 1 : kerelem.platform === 'tiktok' ? j && j.code === 0 : kerelem.platform === 'google' ? !(j && j.partialFailureError) : true);
    return { allapot: ok ? 'elkuldve' : 'hiba', http_status: r.status, valasz: szoveg, kuldo: 'kozvetlen' };
  } catch (e) { return { allapot: 'hiba', http_status: null, valasz: 'halozati hiba: ' + String(e && e.message || e).slice(0, 200), kuldo: 'kozvetlen' }; } finally { clearTimeout(t); }
}
