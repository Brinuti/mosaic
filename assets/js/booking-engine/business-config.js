// MOSAIC Booking Engine V1 - uzletagi besorolas (booking_type, acquisition)
//
// A tulajdonos 2026-10-03-i jovahagyasa szerint (docs/booking-engine/DECISIONS.md). Szabalyalapu, nem ID-lista: a Salonic
// aktualis szolgaltatasaira (kategoria-azonosito + nev) alkalmazzuk, igy uj szolgaltatas is besorolodik, es ami egyik
// szabalyba sem fer, azt `unclassified` jeloli (a tesztek ezt megbuktatjak, nem talalunk ki tipust).
//
// A PMU szakmai routingja (YES/NO ag, foto/konzultacio) NEM itt van, es valtozatlan marad.

export const BOOKING_TYPES = Object.freeze({
  consultation: 'consultation',
  first_treatment: 'first_treatment',
  returning_treatment: 'returning_treatment',
  voucher_redemption: 'voucher_redemption',
  correction: 'correction',
});

// PMU: ezek nem Salonic-foglalasok, soha nem lehetnek booking_completed (a PMU audit 2.4 es a 3. dontes szerint).
export const NON_BOOKING_OUTCOMES = Object.freeze({ pmu: ['photo_review_lead', 'removal'] });

// Kategoria-azonositok (specId): a Salonic kategoriaoldalaibol (docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json)
const SPEC = Object.freeze({
  headspa: { normal: '39592', voucher: '41471' },
  oxygen: { first: '64122', returning: '64128' },
  laser: { first: '66404', returning: '66405' }, // idpontfoglalas.html: "Szortelenites 1. alkalom" / "2. alkalomtol"
});

const CONSULT = /konzult|hajkamer/i; // az Oxigen hajkamerás vizsgalat (jovahagyott) konzultacio-tipusu
const CORRECTION = /korrekci/i;

/**
 * service: az adapter szolgaltatas-objektuma ({ specId, name, activePrice }). Visszaad: { bookingType, bookable, splitByRuntime, flags }.
 * splitByRuntime: a Salonic nem bontja kategoriara az elso es a kovetkezo alkalmat; ha a foglalas utan first_booking=false,
 * a foglalas visszateronek szamit (lasd isAcquisition / effectiveType).
 */
export function classifyService(business, service) {
  const name = String(service.name || '');
  const spec = service.specId === null || service.specId === undefined ? null : String(service.specId);
  const flags = [];
  if (service.activePrice === null || service.activePrice === undefined || service.activePrice === 0) flags.push('price_not_readable');
  const out = (bookingType, extra = {}) => ({ bookingType, bookable: true, splitByRuntime: false, flags, ...extra });

  switch (business) {
    case 'headspa':
      if (spec === SPEC.headspa.voucher) return out(BOOKING_TYPES.voucher_redemption);
      if (spec === SPEC.headspa.normal) return out(BOOKING_TYPES.first_treatment, { splitByRuntime: true });
      break;
    case 'hair':
      if (CONSULT.test(name)) return out(BOOKING_TYPES.consultation);
      return out(BOOKING_TYPES.first_treatment, { splitByRuntime: true });
    case 'oxygen':
      if (CONSULT.test(name)) return out(BOOKING_TYPES.consultation);
      if (spec === SPEC.oxygen.first) return out(BOOKING_TYPES.first_treatment);
      if (spec === SPEC.oxygen.returning) return out(BOOKING_TYPES.returning_treatment);
      break;
    case 'laser':
      if (CONSULT.test(name)) return out(BOOKING_TYPES.consultation);
      if (spec === SPEC.laser.first) return out(BOOKING_TYPES.first_treatment);
      if (spec === SPEC.laser.returning) return out(BOOKING_TYPES.returning_treatment);
      break;
    case 'pmu':
      if (CONSULT.test(name)) return out(BOOKING_TYPES.consultation);
      if (CORRECTION.test(name)) return out(BOOKING_TYPES.correction, { bookable: false }); // a foglalo szandekosan elrejti: elobb foto kell
      return out(BOOKING_TYPES.first_treatment, { splitByRuntime: true });
    default:
      throw new Error('Ismeretlen uzletag: ' + business);
  }
  return { bookingType: 'unclassified', bookable: false, splitByRuntime: false, flags: [...flags, 'unclassified'] };
}

/** A foglalas vegso tipusa a Salonic atiranyitasa utan: ha a Salonic szerint nem elso foglalas, az "elso kezeles" visszatero lesz. */
export function effectiveType({ bookingType, splitByRuntime = false, firstBooking }) {
  if (bookingType === BOOKING_TYPES.first_treatment && splitByRuntime && firstBooking === false) return BOOKING_TYPES.returning_treatment;
  return bookingType;
}

/**
 * Szamit-e uj vendeg szerzesenek (hirdetesi konverzio)? Nem szamit: kupon/ajandekkartya bevaltas, visszatero, korrekcio,
 * es az sem, ha a Salonic szerint nem elso foglalas. A konzultacio es az elso kezeles igen (a jelenlegi mereshez hasonloan
 * a konzultacio kulon esemenykent, kulon ertekkel; ezt a merest nem ez a modul irja).
 */
export function isAcquisition({ bookingType, splitByRuntime = false, firstBooking }) {
  const t = effectiveType({ bookingType, splitByRuntime, firstBooking });
  if (t !== BOOKING_TYPES.first_treatment && t !== BOOKING_TYPES.consultation) return false;
  return firstBooking === true;
}
