// MP foglalas-igazolas a Salonic automatikus "Uj online foglalas erkezett" levelebol (atmeneti megoldas a Salonic API-ig,
// Feri dontese 2026-10-12). A Google Ads-be CSAK igazolt foglalas mehet (lanc.js feltoltes), nem pusztan a koszonooldal
// megnyitasa. A levelet a Zapier Gmail-triggere tovabbitja a titkos webhookra (functions/api/mp-salonic-igazolas.js).
//
// Fail-closed: ha a level nem a Salonictol jon, nem MP-s, nem ertelmezheto, vagy nincs hozza D1-sor, nem igazol semmit
// (kevesebb konverzio mehet, hamis nem). Adatminimalizalas: a vendeg neve / telefonja / e-mailje NEM kerul tarolasra,
// csak: Salonic foglalasi azonosito, munkatars-azonosito(k), kezdes, uj paciens jelzes, a level ideje.

/** A Medical Piercing Salonic-munkatarsai (tools/mp-salonic-lekepezes.json). Egy nevhez tobb azonosito is tartozhat (helyszinenkent). */
export const MUNKATARSAK = Object.freeze({
  'kovacs gabriella': ['13509'],
  'kovacs richard': ['17769'],
  'kamilli viktoria': ['19566'],
  'nagy-marko fanni': ['25773'],
  'fekete henrietta': ['27571', '27572', '27575'],
  'szuliman nikoletta': ['27569'],
  'tompek kornelia': ['30145'],
  'szalai nora': ['32224'],
  'mester brigitta': ['20562'],
});

const HONAP = { januar: 1, februar: 2, marcius: 3, aprilis: 4, majus: 5, junius: 6, julius: 7, augusztus: 8, szeptember: 9, oktober: 10, november: 11, december: 12 };
const ekezetNelkul = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const nevKulcs = (s) => ekezetNelkul(s).replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();

/** Europe/Budapest helyi ido -> unix (masodperc), nyari idoszamitassal. */
export function budapestUnix(ev, ho, nap, ora, perc) {
  const utc = Date.UTC(ev, ho - 1, nap, ora, perc);
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const ofszet = (t) => {
    const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
  };
  let t = utc - ofszet(utc);
  t = utc - ofszet(t); // atallasi napok
  return Math.floor(t / 1000);
}

const html2txt = (s) => String(s || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');

/**
 * Egy Salonic-level ertelmezese. be: { from, subject, body, date (ISO vagy ms vagy unix) }.
 * -> { ok: true, bookingId, munkatars, employeeIds, startUnix, ujPaciens (true|null), erkezett } | { ok: false, hiba }
 */
export function levelErtelmezes(be = {}) {
  const from = String(be.from || '');
  const cim = ((from.match(/<([^>]+)>\s*$/) || [])[1] || from).trim().toLowerCase();
  if (cim !== 'app@salonic.hu') return { ok: false, hiba: 'nem_salonic_felado' };
  if (!/medical\s*piercing/i.test(from)) return { ok: false, hiba: 'nem_mp_fiok' };
  const targy = String(be.subject || '');
  if (!/^\s*Új online foglalás érkezett/i.test(targy)) return { ok: false, hiba: 'nem_uj_foglalas' };
  const nyers = String(be.body || '');
  const szoveg = html2txt(nyers);
  const id = (nyers.match(/bookingId(?:%3D|=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1];
  if (!id) return { ok: false, hiba: 'nincs_foglalasi_azonosito' };
  const mt = (szoveg.match(/Munkatárs:\s*(.+?)\s*(?=Kezdő dátum:|Foglalás megtekintése|$)/) || [])[1];
  const kd = szoveg.match(/Kezdő dátum:\s*([a-záéíóöőúüű]+)\s+(\d{1,2})\.\s*(?:\([^)]*\))?\s*(\d{1,2}):(\d{2})/i);
  if (!mt || !kd) return { ok: false, hiba: 'nem_ertelmezheto' };
  const ho = HONAP[ekezetNelkul(kd[1])];
  if (!ho) return { ok: false, hiba: 'nem_ertelmezheto' };
  let erk = be.date;
  if (typeof erk === 'string' && !/^\d+$/.test(erk)) erk = Date.parse(erk) / 1000;
  erk = Number(erk);
  if (erk > 1e12) erk = Math.floor(erk / 1000);
  if (!Number.isFinite(erk) || erk <= 0) return { ok: false, hiba: 'nincs_level_ido' };
  // ev: a level idejehez kepest a kovetkezo ilyen datum (a foglalas mindig jovobeli)
  const erkEv = new Date(erk * 1000).getUTCFullYear();
  let start = budapestUnix(erkEv, ho, +kd[2], +kd[3], +kd[4]);
  if (start < erk - 2 * 86400) start = budapestUnix(erkEv + 1, ho, +kd[2], +kd[3], +kd[4]);
  const ids = MUNKATARSAK[nevKulcs(mt)] || [];
  return {
    ok: true, bookingId: id.toLowerCase(), munkatars: mt.trim(), employeeIds: ids, startUnix: start,
    ujPaciens: /Új páciens\s*-\s*Még nem volt foglalása/i.test(szoveg) ? true : null, erkezett: Math.floor(erk),
  };
}
