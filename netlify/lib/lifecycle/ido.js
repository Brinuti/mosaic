// Idokezeles (Europe/Budapest): epoch <-> helyi ido, magyar datum-szovegek, "-an/-en" ragozas.
// Minden idopont epoch MASODPERC; a helyi ido mindig budapesti (nyari / teli ido a Intl-bol).

export const TZ = 'Europe/Budapest';
export const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
export const NAPOK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat']; // Date#getUTCDay sorrendje

const FORMAZO = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** epoch mp -> { y, m (1-12), d, h, mi, nap (0=vasarnap), kulcs: 'YYYY-MM-DD HH:MM' } budapesti helyi ido */
export function helyi(epoch) {
  const p = Object.fromEntries(FORMAZO.formatToParts(new Date(epoch * 1000)).map((x) => [x.type, x.value]));
  const y = +p.year, m = +p.month, d = +p.day, h = +p.hour % 24, mi = +p.minute;
  return { y, m, d, h, mi, nap: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), kulcs: `${p.year}-${p.month}-${p.day} ${String(h).padStart(2, '0')}:${p.minute}` };
}

/** budapesti helyi ido -> epoch mp (nyari/teli ido-valtast kezeli; az atmeneti "lyuk" a korabbi idore esik) */
export function helyiEpoch(y, m, d, h = 0, mi = 0) {
  const alap = Date.UTC(y, m - 1, d, h, mi) / 1000;
  for (const eltolas of [7200, 3600]) {
    const t = alap - eltolas;
    const l = helyi(t);
    if (l.y === y && l.m === m && l.d === d && l.h === h && l.mi === mi) return t;
  }
  return alap - 3600;
}

const HONAP_INDEX = Object.fromEntries(HONAPOK.map((n, i) => [n, i + 1]));
const NAP_INDEX = Object.fromEntries(NAPOK.map((n, i) => [n, i]));
const norm = (s) => String(s || '').toLowerCase();

/**
 * Salonic-datum ("november 25. (szerda) 16:00") -> epoch mp. Az ev nincs a szovegben: azt az evet valasztjuk
 * (a "most" korul), amelyikben a hetnap egyezik; ha egyik sem, a legkozelebbi jovobeli datum.
 * Visszaad null-t, ha nem ertelmezheto.
 */
export function huDatumEpoch(szoveg, most) {
  // a honapnevet a lista alapjan keressuk (a "lemondvaoktober 31." tipusu, szokoz nelkul odaragadt szovegben is)
  const m = new RegExp(`(${HONAPOK.join('|')})\\s+(\\d{1,2})\\.?\\s*\\(([a-záéíóöőúüű]+)\\)\\s*(\\d{1,2}):(\\d{2})`, 'i').exec(String(szoveg || ''));
  if (!m) return null;
  const ho = HONAP_INDEX[norm(m[1])];
  if (!ho) return null;
  const nap = +m[2], h = +m[4], mi = +m[5];
  const hetnap = NAP_INDEX[norm(m[3])];
  const ev0 = helyi(most).y;
  let legjobb = null;
  for (const ev of [ev0 - 1, ev0, ev0 + 1]) {
    const dt = new Date(Date.UTC(ev, ho - 1, nap));
    if (dt.getUTCMonth() !== ho - 1 || dt.getUTCDate() !== nap) continue; // pl. feb. 30.
    if (hetnap !== undefined && dt.getUTCDay() !== hetnap) continue;
    const ep = helyiEpoch(ev, ho, nap, h, mi);
    // a legkozelebbi a "most"-hoz (a foglalasok a koruli idoszakra szolnak)
    if (legjobb === null || Math.abs(ep - most) < Math.abs(legjobb - most)) legjobb = ep;
  }
  return legjobb;
}

/** A nap sorszama alapjan "-an/-en/-jen" (a datum ragozasa: 25 -> "-en", 2 -> "-an", 1 -> "-jen"). */
export function napRag(nap) {
  if (nap === 1) return '-jén';
  return [2, 3, 6, 8, 13, 16, 18, 20, 23, 26, 28, 30].includes(nap) ? '-án' : '-én';
}

/** "november 25-én" */
export function datumRagos(epoch) {
  const l = helyi(epoch);
  return `${HONAPOK[l.m - 1]} ${l.d}${napRag(l.d)}`;
}

/** "november 25. (szerda)" */
export function datumSzoveg(epoch) {
  const l = helyi(epoch);
  return `${HONAPOK[l.m - 1]} ${l.d}. (${NAPOK[l.nap]})`;
}

/** "16:00" */
export function idopontSzoveg(epoch) {
  const l = helyi(epoch);
  return `${String(l.h).padStart(2, '0')}:${String(l.mi).padStart(2, '0')}`;
}

/** hetnap neve ("szerda") */
export function napNev(epoch) { return NAPOK[helyi(epoch).nap]; }

/** "1 óra 20 perc" / "50 perc" / "2 óra" */
export function idotartamSzoveg(perc) {
  if (!Number.isFinite(perc) || perc <= 0) return null;
  const o = Math.floor(perc / 60), p = perc % 60;
  return [o ? `${o} óra` : '', p ? `${p} perc` : ''].filter(Boolean).join(' ');
}

/**
 * Az esedekes idopont betartatasa egy napszak-ablakkal (helyi ora): ha az ablakon kivul esik, a legkozelebbi ablak-szelre
 * mozgatjuk (hajnali/ejszakai uzenet helyett). {tol, ig} oraban (tort is lehet: 20.5 = 20:30).
 */
export function ablakba(epoch, tol, ig) {
  const l = helyi(epoch);
  const ora = l.h + l.mi / 60;
  if (ora >= tol && ora <= ig) return epoch;
  if (ora < tol) return helyiEpoch(l.y, l.m, l.d, Math.floor(tol), Math.round((tol % 1) * 60));
  return helyiEpoch(l.y, l.m, l.d, Math.floor(ig), Math.round((ig % 1) * 60));
}

/** A helyi nap (YYYY-MM-DD) kezdete epoch-ban. */
export function napKezdet(epoch) { const l = helyi(epoch); return helyiEpoch(l.y, l.m, l.d, 0, 0); }

/** n munkanappal kesobb 10:00 (hetvege kimarad), pl. a no-show kovetes. */
export function kovetkezoMunkanap(epoch, ora = 10, nap = 1) {
  let t = epoch;
  for (let i = 0; i < nap; i++) {
    do { t += 86400; } while ([0, 6].includes(helyi(t).nap));
  }
  const l = helyi(t);
  return helyiEpoch(l.y, l.m, l.d, ora, 0);
}
