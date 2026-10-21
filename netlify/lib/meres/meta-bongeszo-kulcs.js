// A Meta ARNYEK-esemeny event_id-ja a motoros (mb_) agon = a bongeszos tag (GTM web 213, 182-es valtozo) kulcsa:
//   <a koszonooldal utvonalabol a nem alfanumerikus karakterek torlese, az elso 12 karakter>-<g, "g:" nelkul>-<serviceId>-<startDate>
// A bemenet a meres_erkezes.bongeszo MEGLEVO mezoi (oldal, g, bookingUrl): uj adatgyujtes nincs, szemelyes adat nincs (a g a Salonic vendegazonosito, a bongeszo ugyanezt a kulcsot kuldi a pixelnek).
// Ha barmelyik resz hianyzik, null (a hivo marad az eddigi esemeny_id-nal): a bongeszo ilyenkor veletlen kulcsot kepez, parosithato kulcs nincs.
// A Meta dedup (event_name + event_id) miatt a szerveres ARNYEK eseménynév egyezzen a bongeszoevel (GTM web 213). Egyetlen eltérés a PMU: a bongeszo az elso foglalasra ES a
// konzultaciora is `PMU_Foglalas` nevet kuld (a visszajaro `PMU_Visszajaro`), a szerver eddig `PMU_FoglalasElso` / `PMU_Konzultacio`-t. Egy foglalashoz egy alapesemeny tartozik,
// ezert a ketto azonos nevre kepzese nem utkozik; a kulonbseg a custom_data.esemeny_tipus-ban megmarad. Csak a Meta ARNYEK neve valtozik (TikTok / Google / GA4 nem).
// KAPCSOLO (alapbol KI, a MERES_GAZDAGITAS=0 golden kepe ettol bajtra valtozatlan): META_PMU_BONGESZOS_NEV=1 (wrangler.toml, DECISION utan); rollback: a valtozo torlese.
export const bongeszoMetaNev = (e, uzletag, env = {}) => (String((env || {}).META_PMU_BONGESZOS_NEV) === '1' && uzletag === 'pmu' && e && e.tipus === 'alap' && (e.nev === 'FoglalasElso' || e.nev === 'Konzultacio') ? 'PMU_Foglalas' : null);

export function bongeszoMetaKulcs(b) {
  if (!b || typeof b !== 'object') return null;
  const g = String(b.g || '').replace(/^g:/, '');
  if (!g || !b.bookingUrl) return null;
  let utvonal; let bu;
  try { utvonal = new URL(String(b.oldal || '')).pathname; bu = new URL(String(b.bookingUrl)); } catch (e) { return null; }
  const serviceId = bu.searchParams.get('serviceId');
  const startDate = bu.searchParams.get('startDate');
  if (!serviceId || !startDate) return null;
  const elotag = (utvonal || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'x';
  return `${elotag}-${g}-${serviceId}-${startDate}`;
}
