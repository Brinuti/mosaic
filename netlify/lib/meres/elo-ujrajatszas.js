// UJ-82 (01-MERES 10-27, ChatGPT 19:46): ELONEZETI ujrajatszo ut a Meta ELO-modul 3/3 mintajahoz. A mar meglevo, Salonic-igazolt (forras 'motor' + salonic_uuid) foglalasok
//   (HeadSpa, PMU) legutobbi N tetelet ugyanazon a szerveres payload-uton (metaEloKerelem) KIZAROLAG Test Events kodos kuldessel jatssza ujra, es visszaadja: event_id, http_status, events_received, kihagyva ok.
// Vedelmek: csak ELO_CSAK_TESZT="1" mellett (az eles [vars]-ban nincs), csak a datasetenkenti Test Events kodjal (hianyzo kod = nincs kuldes), META_ELO_BE + META_ELO_TOKEN kell.
//   A forras-adatbazis (KULCS_DB_OLV = az eles foglalas-kulcs DB, csak az ELONEZETI kotesben) KIZAROLAG SELECT-tel olvasott: nincs iras, nincs claim (meres_meta_elo-ba sem), a foglalasi folyamat nem erintett.
//   A valasz nem tartalmaz foglalas-azonositot, IP-t, user agentet, nevet / e-mailt / telefont: csak a kozos event_id (bongeszo-kulcs), a HTTP-statusz es az events_received.
//   Hash-elt e-mail / telefon NEM megy (a foglalas_vendeg csak HMAC-indexet tarol, a nyers adat nincs meg): ez az ut az event_id / dataset / teszt-kod / fogadas igazolasa, az EMQ-t nem.
import { ELO_DATASETEK, ELO_META_UZLETAGOK, metaEloKerelem, metaEloTesztKod, metaEloUzletagok } from './meta-elo.js';
import { bongeszoMetaKulcs } from './meta-bongeszo-kulcs.js';
import { hozzajarulasTisztit } from './hozzajarulas.js';

export const UJRAJATSZAS_MAX = 3;
const ESEMENY_ABLAK_MP = 6 * 86400; // a Meta a 7 napnal regebbi event_time-ot elutasitja: regebbi tetelnel az ido a kuldes pillanata ('most')
const jsonVagyNull = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

/** Csak olvas. Visszaadja a mintak listajat (legfeljebb `db`), vagy { hiba } ha a kapuk valamelyike zart. */
export async function eloUjrajatszas(env, { uzletag, db = UJRAJATSZAS_MAX } = {}, deps = {}) {
  if (!env || String(env.ELO_CSAK_TESZT || '') !== '1') return { hiba: 'nem_elerheto' };
  if (!ELO_META_UZLETAGOK.includes(uzletag)) return { hiba: 'ismeretlen_uzletag' };
  if (!env.KULCS_DB_OLV) return { hiba: 'nincs_forras_adatbazis' };
  if (!metaEloUzletagok(env).includes(uzletag)) return { hiba: 'kapcsolo_ki' };
  const teszt = metaEloTesztKod(env, uzletag);
  if (!teszt) return { hiba: 'nincs_teszt_kod' };
  const n = Math.max(1, Math.min(UJRAJATSZAS_MAX, Number.isInteger(Number(db)) ? Number(db) : UJRAJATSZAS_MAX));
  const most = Math.floor((deps.now ? deps.now() : Date.now()) / 1000);
  const f = deps.fetchImpl || fetch;
  const { results } = await env.KULCS_DB_OLV.prepare(
    `SELECT k.source_id AS source_id, max(k.letrehozva) AS ido, e.attr AS attr, e.hozz AS hozz, e.ua AS ua, e.ip AS ip, e.oldal AS oldal, e.bongeszo AS bongeszo
       FROM meres_kuldes k JOIN meres_erkezes e ON e.source_id = k.source_id
      WHERE k.uzletag = ?1 AND k.esemeny_tipus = 'ernyo' AND k.platform = 'meta' AND k.allapot = 'elkuldve' AND k.forras = 'motor' AND k.salonic_uuid IS NOT NULL AND e.bongeszo IS NOT NULL AND e.bongeszo <> ''
      GROUP BY k.source_id ORDER BY max(k.letrehozva) DESC LIMIT ?2`).bind(uzletag, n * 6).all();
  const minták = [];
  for (const r of results || []) {
    if (minták.length >= n) break;
    const bongeszo = jsonVagyNull(r.bongeszo); const eventId = bongeszoMetaKulcs(bongeszo);
    if (!eventId) continue; // nincs kozos (bongeszos) event_id: az eles modul sem kuldene
    if (hozzajarulasTisztit(jsonVagyNull(r.hozz)).adv === false) continue; // explicit marketing-elutasitas: az eles modul sem kuldene
    const eredeti = Number(r.ido) || most; const regi = most - eredeti > ESEMENY_ABLAK_MP;
    const k = metaEloKerelem({ dataset: ELO_DATASETEK[uzletag], event_id: eventId, ido: regi ? most : eredeti, hash: null, erk: jsonVagyNull(r.attr) || {}, ip: r.ip, ua: r.ua, oldal: r.oldal, teszt, apiVerzio: env.META_API_VERSION });
    const minta = { uzletag, sorszam: minták.length + 1, event_id: eventId, esemeny: 'Schedule', dataset: ELO_DATASETEK[uzletag], ido: regi ? 'most' : 'eredeti', teszt_kod: true };
    try {
      const v = await f(`${k.url}?access_token=${encodeURIComponent(env.META_ELO_TOKEN)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(k.body) });
      let j = null; try { j = await v.json(); } catch (e) { j = null; }
      minta.http_status = v.status; minta.events_received = j && Number.isFinite(j.events_received) ? j.events_received : 0;
      minta.allapot = v.status >= 200 && v.status < 300 && minta.events_received >= 1 ? 'elkuldve' : 'hiba';
      if (minta.allapot === 'hiba' && j && j.error) minta.hiba_kod = j.error.code;
    } catch (e) { minta.allapot = 'hiba'; minta.http_status = null; minta.events_received = 0; }
    minták.push(minta);
  }
  return { ok: true, uzletag, kert: n, kuldve: minták.length, mintak: minták, kihagyva_ok: minták.length < n ? 'nincs elegendo kozos event_id-s, Salonic-igazolt tetel' : null };
}
