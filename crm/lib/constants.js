// Az Oxigen mini CRM szabaly-konstansai EGY helyen (a MASTERPROMPT 2.2 / 3.4 / 3.7 es a 121 dontes szerint).
// Penz: egesz forint. Ido: epoch masodperc (idotartamok masodpercben vagy napban jelolve). Sehol mashol ne legyen beegetett szam.

export const FIOK_ALAP = 'mosaic-oxigen';      // egyelore EGY Salonic-fiok (a salonic_account tabla tobbet is tud)

export const MASODPERC = { ORA: 3600, NAP: 86400 };

// ---- szolgaltatasok (service_catalog magadatok tukre) ----------------------------------------------------------------------------------
export const SZOLGALTATAS = Object.freeze({
  FIRST_HAIR: 'first_hair',
  FOLLOWUP_HAIR: 'followup_hair',
  CAMERA: 'camera_assessment',
  LEGACY_COMBO: 'legacy_combo_only',
});
export const SZOLGALTATAS_ADAT = Object.freeze({
  first_hair: { perc: 80, ar: 29900, kezeles: true, ertekesitheto: true },
  followup_hair: { perc: null, ar: 26000, kezeles: true, ertekesitheto: true },   // REQUIRES_VERIFICATION: a tovabbi kezeles hossza nincs a specifikacioban
  camera_assessment: { perc: 30, ar: 4990, kezeles: false, ertekesitheto: true },
  legacy_combo_only: { perc: null, ar: null, kezeles: false, ertekesitheto: false },
});

// ---- foglalas allapotgep (3.4) -----------------------------------------------------------------------------------------------------------
export const FOGLALAS_ALLAPOT = Object.freeze({ BOOKED: 'booked', RESCHEDULED: 'rescheduled', CANCELLED: 'cancelled', NO_SHOW: 'no_show', COMPLETED: 'completed' });
export const FOGLALAS_AKTIV = ['booked', 'rescheduled'];
export const FOGLALAS_VEGLEGES = ['cancelled', 'no_show', 'completed'];
/** megengedett atmenetek (a completed NEM innen, hanem csak igazolCompleted-bol johet) */
export const FOGLALAS_ATMENET = Object.freeze({
  booked: ['rescheduled', 'cancelled', 'no_show', 'completed'],
  rescheduled: ['rescheduled', 'cancelled', 'no_show', 'completed'],
  cancelled: [],
  no_show: [],
  completed: [],
});
/** a Salonic-ertesitobol erkezhet ilyen allapot; a completed soha */
export const INGEST_ALLAPOTOK = ['booked', 'rescheduled', 'cancelled', 'no_show'];

// ---- kura ---------------------------------------------------------------------------------------------------------------------------------
export const KURA_ALLAPOT = Object.freeze({ NOT_STARTED: 'not_started', ACTIVE: 'active', COMPLETED_11: 'completed_11', PAUSED: 'paused_clinical', CLOSED: 'closed_individual' });
export const KURA_HOSSZ = 11;                       // teljes kura: 1 + 10 kezeles
export const KAMERA_KOTELEZO_ALKALMAK = [1, 3, 5, 10];   // hajkamera-felvetel (kontroll)
export const KOZBENSO_ERTEKELES_ALKALMAK = [5, 6];  // koztes szakmai ertekeles (5-6 koruli)
export const KURAZARO_ALKALOM = 11;                 // zaras: A5 zarodokumentum, NINCS uj kotelezo kamerakep
export const KEZELES_RITMUS_NAP = 14;               // alapertelmezett ritmus: kethetente
/** melyik alkalom utan milyen kotelezo dokumentum kell (24 oran belul) */
export const DOKUMENTUM_ALKALMANKENT = Object.freeze({ 1: 'plan', 3: 'review', 5: 'review', 10: 'review', 11: 'closing' });
export const DOKUMENTUM_HATARIDO = { KEZELO_RIASZTAS: 24 * 3600, JANKA_RIASZTAS: 48 * 3600 };   // completed + 24h / +48h
export const A5 = Object.freeze({ szelesseg_mm: 148, magassag_mm: 210, kifuto_mm: 3, biztonsagi_zona_mm: 5 });

// ---- bérlet (3.7) ---------------------------------------------------------------------------------------------------------------------------
export const BERLET = Object.freeze({
  package_5: { alkalom: 5, ar: 130000, honap: 6, ajandekok: ['shampoo_1l'] },
  package_10: { alkalom: 10, ar: 260000, honap: 12, ajandekok: ['shampoo_1l', 'conditioner_1l'] },
});
export const BERLET_ALLAPOT = Object.freeze({ ACTIVE: 'paid_active', EXHAUSTED: 'exhausted', EXPIRED: 'expired', EXTENDED: 'extended_by_manager', REFUNDED: 'refunded' });
export const BERLET_ALKALOM_ALLAPOT = Object.freeze({ RESERVED: 'reserved', USED: 'used', RELEASED: 'released', FORFEITED: 'forfeited' });
export const KORAI_AJANDEK = 'extra_small';         // az elso kezeles elott / napjan vasarolt berlethez (kis kiszereles, keszletfuggo)
export const BERLET_LEJARAT_UTANI_ATHELYEZES_MAX = 1;      // lejarat utan legfeljebb egyszer
export const BERLET_LEJARAT_UTANI_ATHELYEZES_NAP = 30;     // max az eredeti slot + 30 nap
export const BERLET_ERTESITO_NAP = { EMAIL: 30, SMS: 7 };  // B30 / B7: lejarat elott
export const LEMONDAS_HATARIDO_ORA = 48;            // kezeles elott legkesobb 48 oraval (csak tajekoztato, nincs penzugyi kovetkezmeny)

// ---- 4 990 Ft felmeres-credit -------------------------------------------------------------------------------------------------------------------
export const CREDIT = Object.freeze({
  osszeg: 4990,
  ablak_naptari_nap: 30,
  allapot: { OPEN: 'open', ELIGIBLE: 'eligible', USED: 'used', EXPIRED: 'expired', VOID: 'void' },
  // teljes lemondas megszunteti a jogosultsagot; igaz = ha az ablakban uj elso foglalas keletkezik, az ujra jogosit (kisebb szigor)
  UJRA_JOGOSULT_LEMONDAS_UTAN: true,
});

// ---- kepek, link ----------------------------------------------------------------------------------------------------------------------------
export const LINK_ERVENYESSEG = 30 * 86400;        // 30 nap
export const ELLENORZO_TOKEN_ERVENYESSEG = 30 * 60;   // uj-link kerese: egyszer hasznalhato e-mail-ellenorzo token, 30 perc
export const UJ_LINK_KERES_LIMIT = { ablak: 3600, max: 5 };   // e-mailenkent es IP-nkent / ora
export const TOKEN_BAJT = 32;
export const KEP_MIME = ['image/jpeg', 'image/png', 'image/webp'];
export const KEP_MAX_BAJT = 15 * 1024 * 1024;
export const ERTEKELES_MONDAT = { min: 2, max: 3 };   // 2-3 mondatos szemelyes kezeloi ertekeles

// ---- elegedettseg, panasz ---------------------------------------------------------------------------------------------------------------------
export const SURVEY_KESLELTETES = 3 * 3600;        // S0: elso completed + 3 ora
export const GOOGLE_KESLELTETES = 24 * 3600;       // G0: elso completed + 24 ora
export const SURVEY_RIASZTAS_PONT = 3;             // 1-3 pont (vagy negativ szoveg) -> Janka-riasztas
export const PANASZ_HATARIDO = 24 * 3600;          // a sajat kezelo 24 oran belul keresi meg a vendeget
export const PANASZ_HIVAS_KISERLET = 2;            // 2 hivas, utana szemelyes e-mail
export const KOMPENZACIO_FAJTA = ['refund', 'free_replacement', 'discount'];

// ---- megorzes ----------------------------------------------------------------------------------------------------------------------------------
export const MEGORZES_HONAP = 36;                  // utolso kezeles + 36 honap (CEL; jogi QA szukseges)

// ---- szerepkorok, hozzajarulas-csatornak ---------------------------------------------------------------------------------------------
export const SZEREPKOROK = ['therapist', 'clinical_lead', 'reception', 'salon_manager', 'marketing', 'admin'];
export const CSATORNA = Object.freeze({ EMAIL: 'email_marketing', SMS: 'sms_marketing', KEP: 'image_marketing', ADATKEZELES: 'privacy' });
export const MARKETING_CSATORNAK = ['email_marketing', 'sms_marketing'];

// ---- REQUIRES_VERIFICATION jelzesek (nem kitalalhato adatok) --------------------------------------------------------------------------
export const REQUIRES_VERIFICATION = Object.freeze([
  'Oxygeni gyartoi protokoll szerinti allapotfelmero kerdesek es ellenjavallati lista (assessment.js)',
  'Salonic API / webhook / foglalasi azonosito (nincs; ertesito-elemzes)',
  'followup_hair kezeles idotartama',
  'gyartoi 2 millio kezeles / 95% definicio',
  'marketing-hozzajarulas jogi szovegverzioi',
]);

/**
 * Marketing-kapcsolo (a tulajdonos dontese, 2026-10-10): az indulaskor MARKETING uzenet (visszahivas, berletajanlo, ujrafoglalas) NEM megy ki, csak a kezeles koruli
 * (tranzakcios, gondozasi, belso) uzenetek. Bekapcsolni csak a tulajdonos kulon, kifejezett kerese utan (be: true); a teszteknel a fixture allitja.
 */
export const MARKETING = { be: false };
