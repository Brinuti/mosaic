// Telefonszam-kezeles: a Salonic-ban a vendeg ugy adja meg, ahogy akarja (06..., +36..., 0036..., szokozokkel).
// Kimenet: normalizalt "+36701234567" es a SimpleSMS-nek kello (country_code, area_code, number) bontas.

// A teszt-vendeg telefonszama a Salonicban "0044709420090" (a tulajdonos szama, 06 70 942 0090): ezt a magyar szamra kepezzuk le.
const TESZT_ATIRAS = { '0044709420090': '+36709420090' };

export const MAGYAR_MOBIL_KORZETEK = ['20', '30', '31', '50', '70'];

/** nyers szam -> '+36...' (magyar mobil) | '+<orszag>...' (kulfoldi) | null (ertelmezhetetlen) */
export function normalizal(nyers) {
  const s = String(nyers ?? '').replace(/[\s()\-./]/g, '');
  if (!s) return null;
  if (TESZT_ATIRAS[s]) return TESZT_ATIRAS[s];
  let p = s;
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('00')) p = p.slice(2);
  else if (p.startsWith('06')) p = '36' + p.slice(2);
  else if (/^(20|30|31|50|70)\d{7}$/.test(p)) p = '36' + p; // korzetszammal kezdodik, orszagkod nelkul
  else return null;
  if (!/^\d{8,15}$/.test(p)) return null;
  return '+' + p;
}

/** '+36301234567' -> { country_code: '36', area_code: '30', number: '1234567' } (csak magyar mobil), egyebkent null */
export function simpleSmsBontas(e164) {
  const m = /^\+36(20|30|31|50|70)(\d{7})$/.exec(e164 || '');
  return m ? { country_code: '36', area_code: m[1], number: m[2] } : null;
}

/** Vendeg-azonosito a foglalasok egyeztetesehez: e-mail, ennek hianyaban a telefon. */
export function vendegKulcs(email, telefon) {
  const e = String(email || '').trim().toLowerCase();
  return e || String(telefon || '');
}

/** Az SMS szegmenseinek szama (a SimpleSMS UTF8-ban: 70 karakter / szegmens, tobbszegmensnel 67). */
export function smsSzegmens(szoveg) {
  const hossz = [...String(szoveg)].length;
  const gsm = /^[\x20-\x7e\n\r]*$/.test(szoveg); // ekezet nelkuli szoveg: 160 / 153
  const [egy, tobb] = gsm ? [160, 153] : [70, 67];
  return hossz <= egy ? 1 : Math.ceil(hossz / tobb);
}
