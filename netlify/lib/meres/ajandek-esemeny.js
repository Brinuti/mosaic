// QA-2: az ajandekkartya-vasarlas ARNYEK-esemenyei. NEM uj ut: a #89-es elo szerver-oldali vasarlasmeres (Stripe payment_intent.succeeded -> meresKuld -> Zapier) HELYEN,
// ugyanabbol a webhookbol hivja a netlify/lib/ajandek.js (egy masodik webhook / masodik fogyaszto nincs), ugyanazzal az azonositoval (a Stripe pi_); utalasos kartyanal a sajat
// rendeles-azonosito (ATU-...), es a konverzio a TENYLEGES befizetesnel all elo (a szalon igazolja: kiallit), az igenyles kulon esemeny (bank_transfer_request, a regi ut).
import { elosztas } from './elosztas.js';
import { visszateritesFeldolgoz } from './eletut.js';

const atutalasos = (md) => Boolean(md) && md.fizetesi_mod === 'atutalas';
const charge = (pi) => (pi && pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null);

/** -> { fk } | { kihagyva: 'ok' }. mod: 'kartya' (payment_intent.succeeded) | 'atutalas' (a szalon igazolta a befizetest). */
export function ajandekForras(pi, mod) {
  const md = (pi && pi.metadata) || {};
  const atu = atutalasos(md);
  if (mod === 'kartya' && atu) return { kihagyva: 'utalasos rendeles: a konverzio a tenyleges befizetesnel (kiallit), nem a Stripe-webhooknal' };
  if (mod === 'atutalas' && (!atu || md.atutalas_beerkezett !== '1')) return { kihagyva: 'az utalas meg nem erkezett be' };
  if (mod === 'kartya' && pi.status !== 'succeeded') return { kihagyva: 'a fizetes nem sikeres (' + pi.status + ')' };
  const ch = charge(pi);
  const sourceId = atu ? md.atu_ref : pi.id;
  const ido = atu ? Math.floor(Date.parse(md.atutalas_ekkor || '') / 1000) : Number((ch && ch.created) || pi.created);
  const fillerben = atu ? pi.amount : (pi.amount_received || pi.amount); // a HUF-ot a Stripe fillerben (x100) adja
  const email = String(pi.receipt_email || (ch && ch.billing_details && ch.billing_details.email) || '').trim();
  const telefon = String(md.telefon || (ch && ch.billing_details && ch.billing_details.phone) || '').trim();
  return { fk: { tipus: 'ajandekkartya', uzletag: 'headspa', source_entity_id: sourceId, ertek: Math.round(Number(fillerben) || 0) / 100, ido: Number.isFinite(ido) && ido > 0 ? ido : null, szolgaltatas: md.termek || null, vendeg: { email, telefon, g: null }, forras: atu ? 'atutalas' : 'kartya' } };
}

/** Az "elo allapot": a Stripe-tol UJRA lekerdezett PaymentIntent - sikeres, nem visszateritett / vitatott / visszavont. 'aktiv' | 'torolve'; hiba = kivetel (-> halasztva). */
export const ajandekEloAllapot = (pi, mod) => {
  const md = pi.metadata || {}, ch = charge(pi);
  if (ch && (ch.refunded === true || Number(ch.amount_refunded) > 0 || ch.disputed === true)) return 'torolve';
  if (md.visszavonva) return 'torolve';
  if (mod === 'atutalas') return md.atutalas_beerkezett === '1' ? 'aktiv' : 'torolve';
  return pi.status === 'succeeded' ? 'aktiv' : 'torolve';
};

/** deps: { db, env, pi (Stripe PaymentIntent, latest_charge kibontva), mod, piLeker: async (id) => PaymentIntent, fetchImpl, now, kuldo } */
export async function ajandekEsemenyKuldes({ db, env, pi, mod, piLeker, fetchImpl, now, kuldo }) {
  const f = ajandekForras(pi, mod);
  if (f.kihagyva) return { allapot: 'kihagyva', miert: f.kihagyva };
  const r = await elosztas(db, f.fk, { env, fetchImpl, now, kuldo, eloEllenorzes: async () => ajandekEloAllapot(await piLeker(pi.id), mod) });
  return { ...r, forras: f.fk.forras, ertek: f.fk.ertek };
}

/**
 * VISSZATERITES-korrekcio (DECISION #102): a Stripe-tol UJRA lekerdezett PaymentIntent (latest_charge kibontva) kumulalt visszateritett osszege alapjan: teljes -> Google RETRACTION, reszleges -> Google RESTATEMENT
 * (az uj ertek), mindket esetben GA4 "refund" (lasd eletut.js visszateritesFeldolgoz). Utalasos kartyanal nincs Stripe-visszaterites: kihagyva. Idempotens (a kumulalt osszeg szerint).
 */
export async function ajandekVisszateritesKorrekcio({ db, env, pi, fetchImpl, now, kuldo, forras }) {
  const md = (pi && pi.metadata) || {};
  if (atutalasos(md)) return { allapot: 'kihagyva', miert: 'utalasos rendeles: a visszaterites nem a Stripe-on megy' };
  const ch = charge(pi);
  if (!ch) return { allapot: 'kihagyva', miert: 'nincs (kibontott) terheles a PaymentIntenten' };
  const osszeg = Math.round(Number(pi.amount_received || pi.amount)), vissza = Math.round(Number(ch.amount_refunded) || 0);
  if (!(vissza > 0)) return { allapot: 'kihagyva', miert: 'a terheles nincs visszateritve' };
  return visszateritesFeldolgoz(db, { source_id: pi.id, osszeg_filler: osszeg, visszateritett_filler: vissza, ido: null, forras: forras || 'stripe_webhook' }, { env, fetchImpl, now, kuldo });
}
