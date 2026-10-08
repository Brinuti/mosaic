// ELETUT-kerelmek (tiszta fuggvenyek, titok nelkul: ez kerul a naploba): Google-korrekcio (Zapier), Meta / TikTok diagnosztikai esemeny, GA4 refund.
// Ugyanazok az ARNYEKMOD-vedelmek, mint a platformok.js-ben: elo pixelre / property-re / akciora a kerelem NEM allithato ossze.
import { ARNYEK, ELO_CELOK, googleIdo, egesz, tisztit } from './platformok.js';

const ARNYEK_AKCIOK = new Set(Object.values(ARNYEK.google.akciok).flatMap((o) => Object.values(o)));
const HET_NAP_MP = 7 * 86400;      // a Meta / TikTok 7 napnal regebbi esemenyt nem fogad
const HETVENKETTO_ORA_MP = 72 * 3600; // a GA4 Measurement Protocol 72 oranal regebbi idobelyeget nem fogad

/**
 * Google-korrekcio a ZAPIER-on at (a 01a0e569 "Google Ads konverzio korrekcio (RETRACTION / RESTATEMENT)" elokeszitett minta szerint; a publikalt Zapet a merasi munkamenet epiti):
 *   POST GOOGLE_KORREKCIO_WEBHOOK_URL { adjustments: [{ type: 'RETRACTION' | 'RESTATEMENT', orderId, conversionActionId, adjustmentDateTime ('yyyy-mm-dd hh:mm:ss+02:00', NEM a jovoben),
 *                                                        value?, currency? (RESTATEMENT), note? }], dryRun }
 * BIZTONSAGI ALAPERTELMEZES: dryRun = true (a Zap validateOnly-t hiv, semmit nem ir); eles korrekcio csak GOOGLE_KORREKCIO_ELES=1 mellett (dryRun: false).
 * Csak az "ARNYEK" masodlagos akciokra (a konverzio akkor is csak ARNYEK-ra ment ki); az order_id = a kikuldott konverzio order_id-ja (= az eredeti event_id).
 * korr: { tipus, orderId, akcioId, idoUnix, ertek (RESTATEMENT: az UJ ertek, HUF), megjegyzes }. -> kerelem | { tiltva }
 */
export function googleKorrekcioKerelem(korr, env = {}, nowSec = Math.floor(Date.now() / 1000)) {
  const { tipus, orderId, akcioId, idoUnix, ertek, megjegyzes } = korr || {};
  if (tipus !== 'RETRACTION' && tipus !== 'RESTATEMENT') return { tiltva: 'ismeretlen korrekcio-tipus' };
  if (!ARNYEK_AKCIOK.has(String(akcioId)) || ELO_CELOK.google_primary.includes(String(akcioId))) return { tiltva: 'a korrekcio csak "ARNYEK" masodlagos akciora mehet (elo akciora nem)' };
  if (!orderId || String(orderId).length > 64) return { tiltva: 'hianyzo / 64 karakternel hosszabb order_id' };
  if (tipus === 'RESTATEMENT' && !(Number(ertek) > 0)) return { tiltva: 'a RESTATEMENT csak pozitiv ertekkel mehet (0 = teljes visszavonas = RETRACTION)' };
  if (!Number.isFinite(idoUnix) || idoUnix > nowSec) return { tiltva: 'a korrekcio idopontja nem lehet a jovoben (Google: LATER_THAN_MAXIMUM_DATE)' };
  const dryRun = String(env && env.GOOGLE_KORREKCIO_ELES) !== '1';
  const adj = tisztit({ type: tipus, orderId: String(orderId), conversionActionId: String(akcioId), adjustmentDateTime: googleIdo(idoUnix),
    value: tipus === 'RESTATEMENT' ? egesz(ertek) : null, currency: tipus === 'RESTATEMENT' ? 'HUF' : null, note: megjegyzes ? String(megjegyzes).slice(0, 200) : null });
  return { platform: 'google', platform_nev: `ARNYEK-${tipus}-${akcioId}`, url: 'zapier-webhook: GOOGLE_KORREKCIO_WEBHOOK_URL (titok, nem naplozott)', webhook_env: 'GOOGLE_KORREKCIO_WEBHOOK_URL', method: 'POST', fejlec_nevek: ['content-type'],
    cel: { customer_id: ARNYEK.google.customerId, conversion_action_id: String(akcioId), athidalas: 'zapier-webhook', muvelet: tipus, dry_run: dryRun }, body: { adjustments: [adj], dryRun } };
}

/**
 * Meta diagnosztikai esemeny (NEM konverzio: nincs value, esemeny_tipus = diagnosztika): "<Uzletag>_Megjelent" / "<Uzletag>_NemJelentMeg".
 * d: { nev, esemenyId, idoUnix, allapot, user (hash-elt user_data: az eredeti, mar kikuldott alapesemenybol), sourceId, uzletag }
 */
export function metaDiagKerelem(d, env = {}, nowSec = Math.floor(Date.now() / 1000)) {
  const dataset = (env && env.META_ARNYEK_DATASET) || ARNYEK.meta.datasetId;
  if (ELO_CELOK.meta.includes(dataset) || dataset !== ARNYEK.meta.datasetId) return { tiltva: 'a celpont nem az ARNYEK dataset (elo pixelre nem kuldunk)' };
  const teszt = env && env.META_TESZT_KOD;
  if (!teszt) return { tiltva: 'nincs META_TESZT_KOD: Meta-nak csak tesztkoddal kuldunk' };
  if (!d.user || !Object.keys(d.user).length) return { kihagyva: 'nincs felhasznaloi adat (az eredeti alapesemeny nem ment ki Metara, es vendeg-adat sem erkezett)' };
  if (nowSec - d.idoUnix > HET_NAP_MP) return { kihagyva: 'az esemeny 7 napnal regebbi: a Meta nem fogadja el' };
  // a megjelenes a szalonban tortenik (physical_store); a meg nem jelent vendeg nincs sehol: other. event_source_url nincs (nem weboldali esemeny).
  const adat = tisztit({ event_name: d.nev, event_time: d.idoUnix, event_id: d.esemenyId, action_source: d.allapot === 'megjelent' ? 'physical_store' : 'other', user_data: d.user,
    custom_data: tisztit({ esemeny_tipus: 'diagnosztika', eletut_allapot: d.allapot, order_id: d.sourceId, content_category: d.uzletag }) });
  return { platform: 'meta', platform_nev: d.nev, url: `https://graph.facebook.com/${(env && env.META_API_VERSION) || ARNYEK.meta.apiVerzio}/${dataset}/events`, method: 'POST', fejlec_nevek: ['content-type'],
    cel: { dataset, nev: ARNYEK.meta.nev, test_event_code: teszt }, body: { data: [adat], test_event_code: teszt, partner_agent: 'mosaic-qa2-arnyek' } };
}

/** TikTok diagnosztikai esemeny (NEM konverzio: nincs value / currency). d: mint a metaDiagKerelem, user = a TikTok "user" objektum (hash-elt, az eredeti alapesemenybol). */
export function tiktokDiagKerelem(d, env = {}, nowSec = Math.floor(Date.now() / 1000)) {
  const pixel = (env && env.TIKTOK_ARNYEK_PIXEL) || ARNYEK.tiktok.pixelCode;
  if (ELO_CELOK.tiktok.includes(pixel) || pixel !== ARNYEK.tiktok.pixelCode) return { tiltva: 'a celpont nem az ARNYEK pixel (elo pixelre nem kuldunk)' };
  const teszt = env && env.TIKTOK_TESZT_KOD;
  if (!teszt) return { tiltva: 'nincs TIKTOK_TESZT_KOD: TikToknak csak tesztkoddal kuldunk' };
  if (!d.user || !Object.keys(d.user).length) return { kihagyva: 'nincs felhasznaloi adat (az eredeti alapesemeny nem ment ki TikTokra, es vendeg-adat sem erkezett)' };
  if (nowSec - d.idoUnix > HET_NAP_MP) return { kihagyva: 'az esemeny 7 napnal regebbi: a TikTok nem fogadja el' };
  const adat = tisztit({ event: d.nev, event_time: d.idoUnix, event_id: d.esemenyId, user: d.user, properties: tisztit({ order_id: d.sourceId, content_type: 'product' }) });
  return { platform: 'tiktok', platform_nev: d.nev, url: 'https://business-api.tiktok.com/open_api/v1.3/event/track/', method: 'POST', fejlec_nevek: ['content-type', 'access-token'],
    cel: { pixel_code: pixel, nev: ARNYEK.tiktok.nev, test_event_code: teszt }, body: { event_source: 'web', event_source_id: pixel, test_event_code: teszt, data: [adat] } };
}

/**
 * GA4 "refund" (Measurement Protocol): a visszaterites ERTEKE (delta), a tranzakcio azonositoja = az eredeti purchase transaction_id-je (a pi_). Csak teszt-property.
 * d: { transactionId, ertek (HUF, a visszaterites osszege), idoUnix, client: { client_id, session_id }, consent, esemenyId }
 */
export function ga4RefundKerelem(d, env = {}, nowSec = Math.floor(Date.now() / 1000)) {
  const mid = env && env.GA4_TESZT_MEASUREMENT_ID;
  if (!mid) return { tiltva: 'nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-property-be kuldunk' };
  if (ELO_CELOK.ga4.includes(mid)) return { tiltva: 'az elo GA4 property tiltott' };
  if (!d.client || !d.client.client_id) return { tiltva: 'nincs GA4 client_id (az eredeti purchase-bol): a Measurement Protocol client_id nelkul nem kuldheto' };
  if (!(Number(d.ertek) > 0)) return { kihagyva: 'nincs visszaterites-osszeg' };
  if (nowSec - d.idoUnix > HETVENKETTO_ORA_MP) return { kihagyva: 'a GA4 Measurement Protocol 72 oranal regebbi idobelyeget nem fogad' };
  const params = tisztit({ session_id: d.client.session_id, engagement_time_msec: 1, transaction_id: d.transactionId, value: egesz(d.ertek), currency: 'HUF', esemeny_id: d.esemenyId });
  return { platform: 'ga4', platform_nev: 'refund', url: `https://www.google-analytics.com/mp/collect?measurement_id=${mid}`, method: 'POST', fejlec_nevek: ['content-type'], cel: { measurement_id: mid },
    body: tisztit({ client_id: d.client.client_id, timestamp_micros: String(d.idoUnix * 1_000_000), consent: d.consent || null, events: [{ name: 'refund', params }] }) };
}
