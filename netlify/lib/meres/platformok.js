// QA-2 platform-keresek (ARNYEKMOD): Meta CAPI, TikTok Events API, Google Ads (feltoltott kattintas-konverzio) es GA4 Measurement Protocol.
// A kerest egy TISZTA fuggveny allitja ossze (titok nelkul: ez kerul a naploba is); a hitelesitest (token, api_secret) csak a szallito (kuldes) adja hozza a kornyezetbol.
//
// ARNYEKMOD VEDELMEK (a kodban, nem csak beallitasban): a celpont kizarolag az arnyek-celpont; el pixelre / property-re / elo konverzios akciora a keres NEM allithato ossze:
//   Meta: csak a "MOSAIC ARNYEK meres-teszt" dataset (28616665324611098) + KOTELEZO test_event_code; TikTok: csak az "ARNYEK" pixel + test_event_code;
//   Google Ads: csak a 7825199989-7825200916 "ARNYEK - ..." masodlagos UPLOAD_CLICKS akciok (Zapier-webhookon at); GA4: csak teszt-property (az elo G-H4206SQ0Q7 tiltott).
import { metaNev } from './esemeny-modell.js';
import { googleKattintas, metaFbc } from './erkezes.js';

export const ARNYEK = Object.freeze({
  meta: Object.freeze({ datasetId: '28616665324611098', nev: 'MOSAIC ARNYEK meres-teszt', apiVerzio: 'v23.0' }), // a Graph API verzio felulirhato: META_API_VERSION (a v21.0 2026 oktoberben lejar)
  tiktok: Object.freeze({ pixelCode: 'DB2GTTJC77UE4D1NE4MG', pixelId: '7693568787819921416', nev: 'MOSAIC ARNYEK meres-teszt' }),
  google: Object.freeze({
    customerId: '6088874770',
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

const GA4_NEV = { FoglalasElso: 'foglalas_elso', Konzultacio: 'konzultacio', Visszajaro: 'visszajaro', Ajandekkartya: 'purchase' };

/**
 * ADATMINIMALIZALAS (a meresi oldal SPEC-je, #167 120. komment, GPT atnezte): a harmadik felnek (Meta, TikTok, GA4) a Salonic-szolgaltatas teljes neve (egeszsegkozeli: PMU, oxigen, lezer) SOHA nem megy;
 * helyette ez az egyedi, nem-szemelyes kod: `${uzletag}_${e.nev}` kisbetuvel (pl. headspa_foglalaselso), ajandekkartyanal 'ajandekkartya'. Az esemeny, az ertek es az order_id valtozatlan.
 * A D1-ben a nyers szolgaltatas belso egyeztetesre marad (fk.szolgaltatas), de a kimeno kerelem- / naplo-torzsben (meres_kuldes.kerelem) csak ez a kod szerepel.
 */
export function platformKod(e, ctx) {
  return ctx.fk.tipus === 'ajandekkartya' ? 'ajandekkartya' : `${ctx.fk.uzletag}_${e.nev}`.toLowerCase();
}

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
 * DECISION #202 tartalek-torzs: a kibovitett (nev / orszag / user_id / user_data ...) torzs mellett a REGI (bovites nelkuli) torzs, amellyel a szallito egyszer ujraprobal, ha a platform a kibovitett torzset
 * kifejezetten elutasitja (4xx / 200 + hibakod). Nem felsorolhato (non-enumerable): nem kerul a naploba, a golden-kepbe es a JSON-ba; csak a `kuldes()` olvassa.
 */
/** DECISION #202 visszagorgetes deploy-kodvaltoztatas nelkul (env-bol): MERES_GAZDAGITAS=0 -> a bovitett mezok (nev / orszag / varos / iranyitoszam / fbc-potlas, Google hash + IP / UA, GA4 user_id / user_data, TikTok nev) kimaradnak; a regi mezok valtozatlanok. */
const gazdagitas = (env) => String((env || {}).MERES_GAZDAGITAS) !== '0';

function tartalekkal(kerelem, tartalekBody) {
  if (tartalekBody) Object.defineProperty(kerelem, 'tartalek_body', { value: tartalekBody, enumerable: false });
  return kerelem;
}

/**
 * ctx: { fk, erk (tisztitott erkezes), hash: { em, ph_meta, ph_e164, ext, em_ads, em_ga4, fn, ln, country, uid }, hozz (platformSzabaly eredmenye platformonkent), ua, ip, oldal, teszt: { meta, tiktok } }
 * -> { platform, platform_nev, url, method, fejlec_nevek, body, cel } | { tiltva: 'ok' } (vedelem fogta meg) | { kihagyva: 'ok' } (a modell szerint ide nem megy)
 */
export function metaKerelem(e, ctx, env = {}) {
  const dataset = (env && env.META_ARNYEK_DATASET) || ARNYEK.meta.datasetId;
  if (ELO_CELOK.meta.includes(dataset) || dataset !== ARNYEK.meta.datasetId) return { tiltva: 'a celpont nem az ARNYEK dataset (elo pixelre nem kuldunk)' };
  const teszt = env && env.META_TESZT_KOD;
  if (!teszt) return { tiltva: 'nincs META_TESZT_KOD: Meta-nak csak tesztkoddal kuldunk' };
  const szab = ctx.hozz.meta;
  const sd = ctx.fk.forras === 'salonic_direct'; // Salonic-direct safety net (DECISION #127 (b)): nincs bongeszo (IP / user agent / URL / fbp), ezeket NEM talaljuk ki
  const fh = szab.felhasznaloi_adat;
  const udAlap = tisztit({
    em: ctx.hash.em && fh ? [ctx.hash.em] : null, ph: ctx.hash.ph_meta && fh ? [ctx.hash.ph_meta] : null,
    external_id: ctx.hash.ext ? [ctx.hash.ext] : null, client_ip_address: ctx.ip, client_user_agent: ctx.ua, fbc: metaFbc(ctx.erk), fbp: ctx.erk.fbp,
  });
  // DECISION #202: maximalis (hash-elt) adatatadas - keresztnev / vezeteknev (csak ha van hasznalhato nev; hianyzo / null / ures nev = NINCS nev-hash, a tobbi mezo megy), orszag (hu), varos / iranyitoszam (ha van forras), fbc potlasa az fbclid-bol (az esemeny idejevel, ha nincs kattintas-idobelyeg)
  const udBov = !gazdagitas(env) ? {} : tisztit({
    fn: ctx.hash.fn && fh ? [ctx.hash.fn] : null, ln: ctx.hash.ln && fh ? [ctx.hash.ln] : null, country: ctx.hash.country && fh ? [ctx.hash.country] : null,
    ct: ctx.hash.ct && fh ? [ctx.hash.ct] : null, zp: ctx.hash.zp && fh ? [ctx.hash.zp] : null, // varos / iranyitoszam: csak az ajandekkartya-vasarlasnal van forras (a PI metadata); egyebkent kimarad
    fbc: metaFbc(ctx.erk, ctx.fk.ido * 1000),
  });
  const nev = metaNev(e, ctx.fk.uzletag);
  const adatEpit = (ud) => tisztit({
    event_name: nev, event_time: ctx.fk.ido, event_id: e.esemeny_id, action_source: sd ? 'other' : 'website', event_source_url: sd ? null : ctx.oldal,
    user_data: ud,
    // e.ertek_nelkul (D5, DECISION #131): ismeretlen tenyleges ar -> az esemeny ERTEK NELKUL megy (value / currency / salonic_ar kimarad), lista- / activePrice SOHA nem tenyleges arkent
    custom_data: tisztit({ value: e.ertek_nelkul ? null : egesz(e.ertek), currency: e.ertek_nelkul ? null : 'HUF', order_id: ctx.fk.source_entity_id, content_name: platformKod(e, ctx), content_category: ctx.fk.uzletag, esemeny_tipus: e.tipus, ertek_forras: e.ertek_forras, salonic_ar: e.ertek_nelkul ? null : e.salonic_ar, utm_source: ctx.erk.utm_utolso && ctx.erk.utm_utolso.source, utm_campaign: ctx.erk.utm_utolso && ctx.erk.utm_utolso.campaign,
      forras: sd ? 'salonic_direct' : null, attr_minoseg: sd ? ctx.fk.attr_minoseg : null, ertek_minoseg: sd ? ctx.fk.ertek_minoseg : null }),
  });
  const alap = (adat) => ({ data: [adat], test_event_code: teszt, partner_agent: 'mosaic-qa2-arnyek' });
  const ud = { ...udAlap, ...udBov };
  return tartalekkal({ platform: 'meta', platform_nev: nev, url: `https://graph.facebook.com/${(env && env.META_API_VERSION) || ARNYEK.meta.apiVerzio}/${dataset}/events`, method: 'POST', fejlec_nevek: ['content-type'], cel: { dataset, nev: ARNYEK.meta.nev, test_event_code: teszt }, body: alap(adatEpit(ud)) },
    Object.keys(udBov).some((k) => !(k in udAlap) || udAlap[k] !== udBov[k]) ? alap(adatEpit(udAlap)) : null);
}

export function tiktokKerelem(e, ctx, env = {}) {
  const pixel = (env && env.TIKTOK_ARNYEK_PIXEL) || ARNYEK.tiktok.pixelCode;
  if (ELO_CELOK.tiktok.includes(pixel) || pixel !== ARNYEK.tiktok.pixelCode) return { tiltva: 'a celpont nem az ARNYEK pixel (elo pixelre nem kuldunk)' };
  const teszt = env && env.TIKTOK_TESZT_KOD;
  if (!teszt) return { tiltva: 'nincs TIKTOK_TESZT_KOD: TikToknak csak tesztkoddal kuldunk' };
  const szab = ctx.hozz.tiktok;
  // MINDEN uzletag megy az ARNYEK pixelre (jovahagyott architektura 7. pont). Alapesemeny: a Meta-val egyezo egyedi nev (Fodrasz_Konzultacio, Szor_FoglalasElso ...);
  // ernyo: HeadSpa = CompletePayment (kompatibilitas), a tobbi uzletag = Schedule. Nem-HeadSpa esemeny SOHA nem lehet CompletePayment (DECISION 10-06, MERES-KONVERZIO-TERKEP 4. pont).
  const nev = e.tipus === 'ernyo' ? (ctx.fk.uzletag === 'headspa' ? 'CompletePayment' : 'Schedule') : metaNev(e, ctx.fk.uzletag);
  if (nev === 'CompletePayment' && ctx.fk.uzletag !== 'headspa') return { tiltva: 'nem-HeadSpa esemeny nem lehet CompletePayment' };
  // DECISION #131 / GPT: a TikTok CompletePayment ERTEKHORDOZO esemeny - csak determinisztikusan ismert tenyleges arral megy; a base / lifecycle esemeny ettol meg mehet ertek nelkul
  if (nev === 'CompletePayment' && ctx.fk.ertek_minoseg && ctx.fk.ertek_minoseg !== 'exact') return { kihagyva: `ertek_ismeretlen (${ctx.fk.ertek_minoseg}): az ertekhordozo CompletePayment csak ismert tenyleges arral megy` };
  const userAlap = tisztit({ email: ctx.hash.em && szab.felhasznaloi_adat ? ctx.hash.em : null, phone: ctx.hash.ph_e164 && szab.felhasznaloi_adat ? ctx.hash.ph_e164 : null, external_id: ctx.hash.ext, ttclid: ctx.erk.tiktok && ctx.erk.tiktok.ttclid && ctx.erk.tiktok.ttclid.ertek, ttp: ctx.erk.ttp, ip: ctx.ip, user_agent: ctx.ua });
  // DECISION #202 (Feri 2. szabaly): a TikTok nev-mezoi OPT-IN jelzo mogott (TIKTOK_NEV_MEZOK=1): a hivatalos Events API user-kulcsai (email, phone, external_id, ttclid, ttp, ip, user_agent) kozott a nev nem szerepel, ezert alapbol nem megy; ha a jelzo be van kapcsolva es a TikTok elutasitja, a tartalek-torzs (nev nelkul) egyszer ujraprobal. ct / zp: nincs forras, kimarad.
  const userBov = gazdagitas(env) && String((env || {}).TIKTOK_NEV_MEZOK) === '1' && szab.felhasznaloi_adat ? tisztit({ first_name: ctx.hash.fn, last_name: ctx.hash.ln }) : {};
  const kod = platformKod(e, ctx); // adatminimalizalas: a nyers szolgaltatasnev (content_name) sem megy, fallback sincs
  const adatEpit = (user) => tisztit({
    event: nev, event_time: ctx.fk.ido, event_id: e.esemeny_id, user,
    properties: { ...(e.ertek_nelkul ? {} : { currency: 'HUF', value: egesz(e.ertek) }), content_type: 'product', contents: [{ content_id: kod, content_name: kod, quantity: 1, ...(e.ertek_nelkul ? {} : { price: egesz(e.ertek) }) }], order_id: ctx.fk.source_entity_id },
    page: ctx.fk.forras === 'salonic_direct' && !ctx.oldal ? null : { url: ctx.oldal }, // Salonic-direct: nincs bongeszo -> nincs oldal-URL (nem talaljuk ki); a motoros ag valtozatlan
  });
  const alap = (adat) => ({ event_source: 'web', event_source_id: pixel, test_event_code: teszt, data: [adat] });
  return tartalekkal({ platform: 'tiktok', platform_nev: nev, url: 'https://business-api.tiktok.com/open_api/v1.3/event/track/', method: 'POST', fejlec_nevek: ['content-type', 'access-token'], cel: { pixel_code: pixel, nev: ARNYEK.tiktok.nev, test_event_code: teszt }, body: alap(adatEpit({ ...userAlap, ...userBov })) },
    Object.keys(userBov).length ? alap(adatEpit(userAlap)) : null);
}

/**
 * Google Ads (ARNYEK masodlagos akciok): a szerver NEM hiv kozvetlenul Google-t (az OAuth access token 1 ora utan lejar); a #89-es minta szerint egy ZAPIER-WEBHOOKNAK szol
 * (GOOGLE_ARNYEK_WEBHOOK_URL, titok); a Zap (csak a 10 ARNYEK akciora ir, elo azonositot visszautasit) tolti fel a masodlagos ARNYEK akciokba. A torzs PONTOSAN a Zap mezoi:
 * { conversion_action_id, gclid | wbraid | gbraid (egy), conversion_date_time, value, currency: 'HUF', order_id (= event_id), ad_user_data: 'GRANTED' | 'DENIED', ad_personalization: 'GRANTED' | 'DENIED' }.
 * ad_user_data / ad_personalization = a hozzajarulas-szabaly jele (hozzajarulas.js): DECISION #202 ota (nincs sutisav, elfogadott hozzajarulas) GRANTED, ha nincs rogzitett elutasito dontes (azt a valos jel adja: DENIED); MERES_HOZZAJARULAS_VALOS=1 mellett a regi, valos-jel szerinti szabaly (dontes nelkul DENIED).
 * DECISION #202 mezoi (csak GRANTED-es szabalynal, hash-elve): hashed_email (Ads-normalizalt SHA-256), hashed_phone_number (E.164 SHA-256), user_identifiers [{hashed_email}, {hashed_phone_number}] (max. 5), user_ip_address / user_agent (amit a motor rogzitett).
 */
export function googleKerelem(e, ctx, env = {}) {
  if (e.tipus !== 'alap' || e.nev === 'Visszajaro') return { kihagyva: 'a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)' };
  const akcioId = ARNYEK.google.akciok[ctx.fk.uzletag] && ARNYEK.google.akciok[ctx.fk.uzletag][e.nev];
  if (!akcioId) return { kihagyva: `nincs "ARNYEK" masodlagos akcio ehhez: ${ctx.fk.uzletag} / ${e.nev}` };
  if (ELO_CELOK.google_primary.includes(akcioId)) return { tiltva: 'elo konverzios akcio: nem kuldhetunk' };
  const click = googleKattintas(ctx.erk);
  if (!click) return { kihagyva: 'nincs Google-kattintasazonosito (gclid / gbraid / wbraid): a feltoltes kattintas-alapu' };
  const szab = ctx.hozz.google;
  // DECISION #202: felhasznaloi azonositok CSAK hash-elve (SHA-256, Google-normalizalt e-mail; telefon E.164) es csak ha a hozzajarulas-szabaly engedi (rogzitett elutasitasnal nem);
  // a Zap a hashed_email / hashed_phone_number mezoket (vagy a user_identifiers listat) kepezi az ARNYEK feltoltes user_identifiers-ebe. user_ip_address / user_agent: amit a motor rogzitett (erkezes-sor), kitalalni nem talaljuk ki.
  const fh = szab.felhasznaloi_adat && gazdagitas(env);
  const azon = fh ? tisztit({ hashed_email: ctx.hash.em_ads, hashed_phone_number: ctx.hash.ph_e164 }) : {};
  const body = tisztit({
    conversion_action_id: akcioId, [click.tipus]: click.ertek, conversion_date_time: googleIdo(ctx.fk.ido), value: egesz(e.ertek), currency: 'HUF', order_id: e.esemeny_id,
    ad_user_data: szab.jel.ad_user_data === 'GRANTED' ? 'GRANTED' : 'DENIED', ad_personalization: szab.jel.ad_personalization === 'GRANTED' ? 'GRANTED' : 'DENIED',
    ...azon, user_identifiers: Object.entries(azon).map(([k, v]) => ({ [k]: v })), user_ip_address: fh ? ctx.ip : null, user_agent: fh ? ctx.ua : null,
  });
  return { platform: 'google', platform_nev: `ARNYEK-${akcioId}`, url: 'zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)', method: 'POST', fejlec_nevek: ['content-type'], cel: { customer_id: ARNYEK.google.customerId, conversion_action_id: akcioId, athidalas: 'zapier-webhook' }, body };
}

export function ga4Kerelem(e, ctx, env = {}) {
  if (e.tipus !== 'alap') return { kihagyva: 'a GA4-be csak alapesemeny megy (az ernyo nem)' };
  // DECISION #127 D3 (GPT: jogos_0): Salonic-direct foglalasnak nincs bongeszos client_id-je; a Measurement Protocol client_id nelkul nem kuldheto, szintetikus / ujrahasznositott client_id TILOS.
  // Ha ugyanahhoz a bookinghoz bizonyitott valodi client_id mégis rendelkezesre all, a normal GA4-szabaly ervenyes.
  if (ctx.fk.forras === 'salonic_direct' && !(ctx.erk && ctx.erk.ga4 && ctx.erk.ga4.client_id)) return { kihagyva: 'salonic_direct: nincs GA4 client_id (a Measurement Protocol client_id nelkul nem kuldheto; szintetikus / ujrahasznositott client_id tilos)' };
  const mid = env && env.GA4_TESZT_MEASUREMENT_ID;
  if (!mid) return { tiltva: 'nincs GA4_TESZT_MEASUREMENT_ID (teszt-property): a GA4-be csak teszt-property-be kuldunk' };
  if (ELO_CELOK.ga4.includes(mid)) return { tiltva: 'az elo GA4 property tiltott' };
  const ga = ctx.erk.ga4 || {};
  if (!ga.client_id) return { tiltva: 'nincs GA4 client_id (nincs _ga suti): a Measurement Protocol client_id nelkul nem kuldheto' };
  const szab = ctx.hozz.ga4;
  const params = tisztit({ session_id: ga.session_id, engagement_time_msec: 1, value: e.ertek_nelkul ? null : egesz(e.ertek), currency: e.ertek_nelkul ? null : 'HUF', transaction_id: e.nev === 'Ajandekkartya' ? ctx.fk.source_entity_id : null, esemeny_id: e.esemeny_id, uzletag: ctx.fk.uzletag, ertek_forras: e.ertek_forras, salonic_ar: e.salonic_ar,
    items: e.nev === 'Ajandekkartya' ? [{ item_id: platformKod(e, ctx), item_name: platformKod(e, ctx), price: egesz(e.ertek), quantity: 1 }] : null,
    source: ctx.erk.utm_utolso && ctx.erk.utm_utolso.source, medium: ctx.erk.utm_utolso && ctx.erk.utm_utolso.medium, campaign: ctx.erk.utm_utolso && ctx.erk.utm_utolso.campaign });
  const consent = szab.jel.ad_user_data === 'UNSPECIFIED' ? null : { ad_user_data: szab.jel.ad_user_data, ad_personalization: szab.jel.ad_personalization };
  // DECISION #202: user_id (HMAC-alapu alvezetett azonosito, nem visszafejtheto) + user_data (SHA-256 e-mail, telefon E.164), csak ha a hozzajarulas-szabaly engedi; nev / cim nem megy (iranyitoszam / varos forras nincs)
  const fh = szab.felhasznaloi_adat && gazdagitas(env);
  const userData = fh ? tisztit({ sha256_email_address: ctx.hash.em_ga4 ? [ctx.hash.em_ga4] : null, sha256_phone_number: ctx.hash.ph_e164 ? [ctx.hash.ph_e164] : null }) : {};
  const userId = fh ? ctx.hash.uid : null;
  const alap = { client_id: ga.client_id, timestamp_micros: String(ctx.fk.ido * 1_000_000), consent, events: [{ name: GA4_NEV[e.nev], params }] };
  const bovitett = Object.keys(userData).length || userId;
  return tartalekkal({ platform: 'ga4', platform_nev: GA4_NEV[e.nev], url: `https://www.google-analytics.com/mp/collect?measurement_id=${mid}`, method: 'POST', fejlec_nevek: ['content-type'], cel: { measurement_id: mid }, body: tisztit({ client_id: alap.client_id, user_id: userId, timestamp_micros: alap.timestamp_micros, consent, user_data: userData, events: alap.events }) },
    bovitett ? tisztit({ ...alap }) : null);
}
export const KEREM_EPITO = { meta: metaKerelem, tiktok: tiktokKerelem, google: googleKerelem, ga4: ga4Kerelem };

const ZAPIER_HOOK_RE = /^(https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[A-Za-z0-9_-]+\/?|http:\/\/127\.0\.0\.1:\d+\/.*)$/; // a loopback csak a tesztekhez (mint az ajandek.js MERES_HOOK_RE)
/**
 * Szallito: a titkokat (token / api_secret / webhook-cim) CSAK itt, a kornyezetbol adjuk a kereshez; a naplozott kerelembe nem kerulnek.
 * Google: a Zapier-webhook (2xx = atvette). GA4: elobb a Measurement Protocol VALIDALO vegpontja (/debug/mp/collect), csak tiszta validacio utan a valodi /mp/collect.
 * -> { allapot: 'elkuldve' | 'hiba' | 'nincs_hitelesites', http_status, valasz (szoveg, max 2000), kuldo }
 * DECISION #202 tartalek: ha a kerelemnek van `tartalek_body`-ja (a kibovitett mezok nelkuli, regi torzs) ES a platform VALASZOLT, de kifejezetten elutasitotta (nem 5xx, nem halozati hiba / idotullepes),
 * a szallito EGYSZER ujraprobal a regi torzzsel (az esemeny nem kerult feldolgozasra; az event_id / order_id azonos, a platform dedup-ja ugyanugy vedi); a hiba szovege a platform_valaszban marad.
 */
export async function kuldes(kerelem, env = {}, fetchImpl = fetch, ms = 8000) {
  const elso = hibaMaszk(await kuldesEgy(kerelem, env, fetchImpl, ms));
  if (elso.allapot !== 'hiba' || !kerelem.tartalek_body || elso.http_status === null || elso.http_status >= 500) return elso;
  const masodik = hibaMaszk(await kuldesEgy({ ...kerelem, body: kerelem.tartalek_body }, env, fetchImpl, ms));
  const elsoHiba = String(elso.valasz || '').slice(0, 250);
  return { ...masodik, valasz: JSON.stringify({ tartalek_ujraprobalas: true, elso_kiserlet: { http_status: elso.http_status, valasz: elsoHiba }, masodik_kiserlet: { http_status: masodik.http_status, allapot: masodik.allapot, valasz: String(masodik.valasz || '').slice(0, 600) } }) }; // 250 + 600 karakter: az escape-elessel is 2000 alatt (ervenyes JSON marad)
}
/** DECISION #202: hiba eseten a platform valaszszovege a D1-be kerul; ha a platform visszhangozza a mezoertekeket, a hash-szeru (32-64 hexa) ertekek maszkoltak. */
const hibaMaszk = (r) => (r.allapot === 'hiba' && typeof r.valasz === 'string' ? { ...r, valasz: r.valasz.replace(/\b[0-9a-f]{32,64}\b/gi, '[hash]') } : r);

async function kuldesEgy(kerelem, env = {}, fetchImpl = fetch, ms = 8000) {
  const titkos = { meta: env.META_CAPI_TOKEN, tiktok: env.TIKTOK_EVENTS_TOKEN, google: env.GOOGLE_ARNYEK_WEBHOOK_URL, ga4: env.GA4_TESZT_API_SECRET };
  if (!titkos[kerelem.platform]) return { allapot: 'nincs_hitelesites', http_status: null, valasz: null, kuldo: 'kozvetlen' };
  let url = kerelem.url; const fejlec = { 'content-type': 'application/json' };
  if (kerelem.platform === 'meta') url += '?access_token=' + encodeURIComponent(env.META_CAPI_TOKEN);
  if (kerelem.platform === 'tiktok') fejlec['access-token'] = env.TIKTOK_EVENTS_TOKEN;
  if (kerelem.platform === 'google') { url = String(env.GOOGLE_ARNYEK_WEBHOOK_URL).trim(); if (!ZAPIER_HOOK_RE.test(url)) return { allapot: 'hiba', http_status: null, valasz: 'ervenytelen GOOGLE_ARNYEK_WEBHOOK_URL formatum', kuldo: 'zapier' }; }
  if (kerelem.platform === 'ga4') url += '&api_secret=' + encodeURIComponent(env.GA4_TESZT_API_SECRET);
  const kuldo = kerelem.platform === 'google' ? 'zapier-webhook' : 'kozvetlen';
  const ab = new AbortController(); const t = setTimeout(() => ab.abort(), ms);
  try {
    let elozo = null;
    if (kerelem.platform === 'ga4' && String(env.GA4_VALIDALAS) !== '0') {
      const dr = await fetchImpl(url.replace('/mp/collect', '/debug/mp/collect'), { method: 'POST', headers: fejlec, body: JSON.stringify(kerelem.body), signal: ab.signal });
      const dszoveg = (await dr.text()).slice(0, 1500); let dj = null; try { dj = JSON.parse(dszoveg); } catch (x) { /* nem JSON */ }
      if (!(dr.status >= 200 && dr.status < 300) || !dj || (dj.validationMessages || []).length) return { allapot: 'hiba', http_status: dr.status, valasz: 'GA4 validacio (/debug/mp/collect): ' + dszoveg, kuldo };
      elozo = { ga4_validacio: { vegpont: '/debug/mp/collect', validationMessages: dj.validationMessages || [] } };
    }
    const r = await fetchImpl(url, { method: kerelem.method, headers: fejlec, body: JSON.stringify(kerelem.body), signal: ab.signal });
    const szoveg = (await r.text()).slice(0, 2000);
    let j = null; try { j = JSON.parse(szoveg); } catch (x) { /* nem JSON */ }
    const ok = r.status >= 200 && r.status < 300 && (kerelem.platform === 'meta' ? j && j.events_received >= 1 : kerelem.platform === 'tiktok' ? j && j.code === 0 : true);
    const valasz = elozo ? JSON.stringify({ ...elozo, collect_status: r.status, collect_valasz: szoveg }) : szoveg;
    return { allapot: ok ? 'elkuldve' : 'hiba', http_status: r.status, valasz, kuldo };
  } catch (e) { return { allapot: 'hiba', http_status: null, valasz: 'halozati hiba: ' + String(e && e.message || e).slice(0, 200), kuldo }; } finally { clearTimeout(t); }
}
