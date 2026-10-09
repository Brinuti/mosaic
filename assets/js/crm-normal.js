// A backend-valaszok egyseges (UI-oldali) alakra hozasa. Tobb mezonevet is elfogad (az API fejlodhet), igy a nezetek nem torhetnek el.
import { pick, lista } from './crm-ui.js';

const nevDe = (x) => (x && typeof x === 'object' ? (x.nev || x.name || null) : (x ?? null));
const idDe = (x) => (x && typeof x === 'object' ? (x.id ?? null) : null);

export function munkalistaSor(s) {
  const felm = pick(s, 'felmero', 'felmero_allapot', 'kerdoiv_allapot');
  const felmAll = felm && typeof felm === 'object' ? felm.allapot : felm;
  const kontra = pick(s, 'kontraindikacio_jelzes', 'kontraindikacio', 'contraindication');
  const allapot = pick(s, 'allapot', 'status');
  return {
    id: pick(s, 'foglalas_id', 'id'), vendegId: pick(s.vendeg, 'id') ?? s.vendeg_id ?? null, vendegNev: nevDe(s.vendeg) || s.vendeg_nev || 'Vendég',
    szolgaltatas: pick(s, 'szolgaltatas', 'service'), kezdes: pick(s, 'kezdes', 'start', 'idopont'), kezelo: nevDe(s.kezelo) || s.kezelo_nev || null,
    felmero: felmAll === undefined || felmAll === null ? null : felmAll, felmeroKitoltve: !!(felm && typeof felm === 'object' ? felm.kitoltve : ['submitted', 'reviewed'].includes(felmAll)),
    felmeroLathato: felm !== null && felm !== undefined, // recepcio: a backend nem adja ki
    jelzes: !!kontra && kontra !== 'cleared' && kontra !== 'nincs', allapot,
    igazolt: s.megjelent_igazolt === true || s.igazolt === true || allapot === 'completed',
    kovetkezo: pick(s, 'kovetkezo_foglalas', 'kovetkezo') ?? null,
    kameraKotelezo: !!s.kamera_kotelezo,
  };
}

export function berlet(b) {
  const sz = b.szamok || {};
  const osszes = pick(b, 'osszes', 'alkalmak') ?? (b.units_total !== undefined ? b.units_total + (b.units_adjust || 0) : undefined);
  return {
    id: b.id, tipus: pick(b, 'tipus', 'package_type', 'type'), ar: pick(b, 'ar', 'price_huf'), osszes,
    vasarolva: pick(b, 'vasarolva', 'paid_at', 'purchased_at', 'fizetes_ideje'), lejarat: pick(b, 'lejarat', 'expires_at'), eredetiLejarat: pick(b, 'eredeti_lejarat', 'original_expires_at'),
    allapot: pick(b, 'allapot', 'status'), szabad: pick(b, 'szabad', 'szabad_alkalom'), hasznalt: pick(b, 'hasznalt', 'felhasznalt') ?? sz.used,
    foglalt: pick(b, 'foglalt', 'fenntartott') ?? sz.reserved, elvesztett: sz.forfeited ?? null, korai: !!pick(b, 'korai', 'early_purchase'),
    ajandekok: lista(b.ajandekok).map((a) => ({ id: a.id, fajta: pick(a, 'fajta', 'kind'), allapot: pick(a, 'allapot', 'status'), atadva: pick(a, 'handed_at', 'atadva_ekkor') ?? null, keszletfuggo: !!a.stock_dependent })),
  };
}
export const AJANDEK_NEV = { shampoo_1l: '1 l sampon', conditioner_1l: '1 l balzsam', extra_small: 'Kis kiszerelésű Oxygeni termék (készletfüggő)' };
export const AJANDEK_ALLAPOT = { due: 'Átadandó', handed_over: 'Átadva', return_due: 'Visszakérendő', returned: 'Visszaadva', kept_opened: 'Felbontva, megtartva', cancelled: 'Törölve' };

export function credit(c) {
  return {
    id: pick(c, 'creditId', 'id', 'credit_id'), allapot: pick(c, 'allapot', 'status'), osszeg: pick(c, 'osszeg', 'amount_huf'), hatarido: pick(c, 'hatarido', 'window_end'),
    maradekNap: c.maradekNap ?? null, elsoFoglalas: pick(c, 'firstBookingId', 'first_booking_id', 'first_booking', 'booking_id'), felhasznalva: pick(c, 'felhasznalva', 'used_at', 'felhasznalva_at'),
    jogosult: pick(c, 'jogosult', 'credit_eligible') === true || pick(c, 'allapot', 'status') === 'eligible', fizetendo: pick(c, 'fizetendoAzElsoKezelesre'),
  };
}
export const CREDIT_ALLAPOT = { eligible: 'Jogosult', open: 'Függőben (nincs első kezelési foglalás)', used: 'Felhasználva', expired: 'Lejárt', cancelled: 'Megszűnt' };

export function kura(k) {
  if (!k) return null;
  return {
    id: pick(k, 'courseId', 'id', 'course_id'), allapot: pick(k, 'status', 'allapot'), sorszam: pick(k, 'treatmentIndex', 'kezeles_sorszam', 'treatment_index', 'index') ?? 0,
    kovetkezo: pick(k, 'kovetkezoAlkalom', 'kovetkezo_alkalom'), kameraKotelezo: pick(k, 'kameraKotelezo', 'kamera_kotelezo'), ajanlhato: pick(k, 'kuraAjanlhato'),
    kezelesek: lista(k.kezelesek).map((s) => ({ id: s.id, sorszam: pick(s, 'sorszam', 'treatment_index'), igazolva: s.igazolva ?? null, kameraKotelezo: !!pick(s, 'kamera_kotelezo', 'camera_required') })),
  };
}

export function hozzajarulas(v) {
  const ki = { csatornak: {}, tortenet: [] };
  if (!v) return ki;
  const cs = v.csatornak || v.hozzajarulasok || {};
  for (const [k, e] of Object.entries(cs)) {
    if (e && typeof e === 'object') ki.csatornak[k] = { allapot: pick(e, 'action', 'allapot', 'status'), verzio: pick(e, 'szovegVerzio', 'szoveg_verzio', 'text_version'), ido: pick(e, 'at', 'ido') };
    else if (e !== null && e !== undefined) ki.csatornak[k] = { allapot: e, verzio: null, ido: null };
  }
  const t = lista(Array.isArray(v) ? v : (v.tortenet || v.esemenyek || v.events));
  ki.tortenet = t.map((e) => ({ csatorna: pick(e, 'channel', 'csatorna'), allapot: pick(e, 'action', 'allapot', 'status'), verzio: pick(e, 'text_version', 'szoveg_verzio'), forras: pick(e, 'source', 'forras'), ido: pick(e, 'at', 'ido') }));
  return ki;
}
export const aktivHozzajarulas = (a) => a === 'granted' || a === true || a === 'opt_in';

export function panasz(p) {
  return {
    id: p.id, vendegId: pick(p.vendeg, 'id') ?? p.guest_id ?? null, vendegNev: nevDe(p.vendeg) || p.vendeg_nev || null, allapot: pick(p, 'allapot', 'status'), forras: pick(p, 'forras', 'source'), leiras: pick(p, 'leiras', 'description'),
    megnyitva: pick(p, 'megnyitva', 'opened_at'), hatarido: pick(p, 'hatarido', 'due_at'), elsoKapcsolat: pick(p, 'elso_kapcsolat', 'first_contact_at'), felelosId: pick(p.felelos, 'id') ?? p.felelos_id ?? p.therapist_id ?? null,
    felelosNev: nevDe(p.felelos) || p.kezelo_nev || null, sajat: p.sajat === true, keso: p.keso === true, megoldas: p.megoldas ?? p.resolution ?? null, lezarva: pick(p, 'lezarva', 'resolved_at'),
    probalkozasok: lista(pick(p, 'probalkozasok', 'kiserletek', 'attempts')).map((k) => ({ ido: pick(k, 'ido', 'at'), tipus: pick(k, 'tipus', 'kind'), eredmeny: pick(k, 'eredmeny', 'outcome'), megjegyzes: pick(k, 'megjegyzes', 'note') })),
    kompenzaciok: lista(pick(p, 'kompenzaciok', 'kompenzacio')).map((k) => ({ id: k.id, tipus: pick(k, 'tipus', 'kind'), osszeg: pick(k, 'osszeg', 'amount_huf'), allapot: pick(k, 'allapot', 'status') })),
    pont: pick(p, 'pont', 'score') ?? null,
  };
}
