// A Meta ARNYEK-esemeny event_id-ja a motoros (mb_) agon = a bongeszos tag (GTM web 213, 182-es valtozo) kulcsa:
//   <a koszonooldal utvonalabol a nem alfanumerikus karakterek torlese, az elso 12 karakter>-<g, "g:" nelkul>-<serviceId>-<startDate>
// A bemenet a meres_erkezes.bongeszo MEGLEVO mezoi (oldal, g, bookingUrl): uj adatgyujtes nincs, szemelyes adat nincs (a g a Salonic vendegazonosito, a bongeszo ugyanezt a kulcsot kuldi a pixelnek).
// Ha barmelyik resz hianyzik, null (a hivo marad az eddigi esemeny_id-nal): a bongeszo ilyenkor veletlen kulcsot kepez, parosithato kulcs nincs.
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
