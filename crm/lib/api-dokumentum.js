// A5 dokumentum-tartalom (kuruterv / kontroll / kurazaro) a kezeloi urlap mezoibol + a PDF-hez szukseges betutipusok betoltese.
// A pdf.js (kesz) csak a kirajzolast vegzi; ez a modul a mezo -> szakasz kepezest es a platformfuggo font-betoltest adja.
import { HONAPOK, helyi } from '../../netlify/lib/lifecycle/ido.js';
import { ApiHiba } from './http.js';
import { KEZELES_RITMUS_NAP } from './constants.js';

const FONT_UTAK = { szoveg: 'Jost_400Regular.ttf', felkover: 'Jost_600SemiBold.ttf', cim: 'PlayfairDisplay_500Medium.ttf' };
let fontGyorsitotar = null;   // egy isolate eleteig

/** a PDF-be csak a betutipus altal biztosan tamogatott karakterek kerulnek (kontroll- es ritka unicode-karakterek nem) */
export function pdfSzoveg(s, max = 4000) {
  return String(s ?? '').normalize('NFC').replace(/\r\n?/g, '\n').slice(0, max).replace(/[^\n\u0020-\u007E\u00A0-\u024F\u2010-\u2022\u2026\u20AC]/gu, ' ');
}
const sor = (v) => pdfSzoveg(v, 600).replace(/\n+/g, ' ');

export const magyarDatum = (epoch) => { if (!Number.isFinite(epoch)) return ''; const l = helyi(epoch); return `${l.y}. ${HONAPOK[l.m - 1]} ${l.d}.`; };

/**
 * a5Adat (plan.js) -> pdf.js `dok`. vazlat = true: figyelmeztető cimke (a vazlat nem kuldheto).
 */
export function pdfDokumentum(a5, { vazlat = false } = {}) {
  const m = a5.mezok || {};
  const l = a5.levezetett || {};
  const alcim = `${sor(l.vendeg_nev)} – ${magyarDatum(l.datum)}`;
  const alkalom = ['Kezelés sorszáma', `${l.kezeles_sorszam}. / 11`];
  const kezelo = ['Kezelő', sor(l.kezelo_nev)];
  const cimke = vazlat ? 'VÁZLAT – nem küldhető' : `A5 / ${l.kezeles_sorszam} / 11`;
  const lablec = 'MOSAIC Head Spa and Hair – 1023 Budapest, Becsi ut 2.';
  const szakaszok = [];
  if (a5.kind === 'plan') {
    szakaszok.push({ cim: 'A mai alkalom', sorok: [alkalom, kezelo] });
    szakaszok.push({ cim: 'Főpanasz', bekezdes: pdfSzoveg(m.fo_panasz) });
    if (Array.isArray(m.megfigyelesek)) szakaszok.push({ cim: 'Megfigyelések a hajkamera alapján', lista: m.megfigyelesek.filter((x) => typeof x === 'string' && x.trim()).slice(0, 12).map(sor) });
    szakaszok.push({ cim: 'Cél', bekezdes: pdfSzoveg(m.cel) });
    szakaszok.push({ cim: 'Javasolt kezelési terv', bekezdes: m.teljes_kura_11 === true ? `Teljes, 11 alkalmas kúra, ${m.ritmus_nap || KEZELES_RITMUS_NAP} naponta.` : `${pdfSzoveg(m.egyeni_terv_indok)}${m.ritmus_nap ? `\nRitmus: ${Number(m.ritmus_nap)} naponta.` : ''}` });
    if (m.otthoni_apolas) szakaszok.push({ cim: 'Otthoni Oxygeni-rutin', sorok: [['Termék', sor(m.otthoni_apolas.termek)], ['Használat', sor(m.otthoni_apolas.hasznalat)]] });
    szakaszok.push({ cim: 'Személyes üzenet', bekezdes: pdfSzoveg(m.kezeloi_javaslat) });
    const k = m.kovetkezo_idopont || {};
    szakaszok.push({ cim: 'Következő időpont', bekezdes: k.javasolt_intervallum ? sor(k.javasolt_intervallum) : (k.booking_id ? 'Az időpont le van foglalva.' : '') });
    return { tipus: 'kuruterv', cim: 'Személyes fejbőr-ápolási tervem', alcim, szakaszok, lablec, cimke };
  }
  if (a5.kind === 'review') {
    szakaszok.push({ cim: 'Az alkalom', sorok: [alkalom, kezelo] });
    szakaszok.push({ cim: 'Személyes értékelés', bekezdes: pdfSzoveg(m.ertekeles) });
    szakaszok.push({ cim: 'Otthoni rutin', bekezdes: pdfSzoveg(m.otthoni_rutin_kontroll) });
    return { tipus: 'kuruterv', cim: 'Kontroll-értékelés', alcim, szakaszok, lablec, cimke };
  }
  szakaszok.push({ cim: 'Az alkalom', sorok: [alkalom, kezelo] });
  szakaszok.push({ cim: 'Kiindulási panasz', bekezdes: pdfSzoveg(m.kiindulo_panasz) });
  szakaszok.push({ cim: 'Cél', bekezdes: pdfSzoveg(m.cel) });
  szakaszok.push({ cim: 'Záró értékelés', bekezdes: pdfSzoveg(m.zaro_ertekeles) });
  szakaszok.push({ cim: 'Fenntartási javaslat', bekezdes: pdfSzoveg(m.fenntartasi_javaslat) });
  szakaszok.push({ cim: 'Otthoni rutin', bekezdes: pdfSzoveg(m.otthoni_rutin) });
  if (m.hianyzo_kep_indok) szakaszok.push({ cim: 'Megjegyzés a képekhez', bekezdes: pdfSzoveg(m.hianyzo_kep_indok) });
  return { tipus: 'kuruzaro', cim: 'Kúrazáró dokumentum', alcim, szakaszok, lablec, cimke };
}

/** betutipusok: env.CRM_FONTOK (teszt / dev), env.ASSETS (Cloudflare Pages), kulonben 503 */
export async function fontokBetolt(env, request) {
  if (fontGyorsitotar && !env.CRM_FONTOK) return fontGyorsitotar;
  if (env.CRM_FONTOK) return typeof env.CRM_FONTOK === 'function' ? env.CRM_FONTOK() : env.CRM_FONTOK;
  if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') throw new ApiHiba('PDF_FONT_HIANYZIK', 'A PDF betűtípusai nem érhetők el (ASSETS nincs beállítva).', 503);
  const ki = {};
  for (const [kulcs, fajl] of Object.entries(FONT_UTAK)) {
    const v = await env.ASSETS.fetch(new URL(`/assets/fonts/pdf/${fajl}`, request.url));
    if (!v.ok) throw new ApiHiba('PDF_FONT_HIANYZIK', 'A PDF betűtípusai nem érhetők el.', 503);
    ki[kulcs] = new Uint8Array(await v.arrayBuffer());
  }
  fontGyorsitotar = ki;
  return ki;
}
