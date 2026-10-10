// GA4 VALIDATION_REPLAY - LEZARVA (GPT-dontes #231, 2026-10-10). A kuldesi felulet (az ga4_validation_replay admin-op es a GA4-ujrajatszo fuggveny) ELTAVOLITVA; a replay nem kellett:
// a titokcsere (2026-10-11 kornyezeteben: 2026-10-10 11:03:18 UTC) utan TERMESZETES GA4-jogosult foglalas ment ki sikeresen az eles dispatcheren at (lasd docs/booking-engine/QA4_ELESITES.md).
// Ez a modul mar csak OLVAS: a (korabbi, ha lett volna) ujrajatszasok kizart tetelkent valo listazasa az egyezteto osszegzesehez (osszegzes.validation_replay). Kuldo kod nincs benne.
// A visszaallitas a git-tortenetbol lehetseges (PR #231 / #234), uj dontes + uj telepites kell hozza.
export const REPLAY_JEL = 'validation_replay';

/** Az ujrajatszasok listaja (az egyezteto osszegzesehez): a tabla hianya = ures lista. Csak olvas. */
export async function replayLista(db) {
  try {
    const { results } = await db.prepare('SELECT id, source_id, esemeny_id, platform, jel, allapot, http_status, kuldve FROM meres_validation_replay ORDER BY id').all();
    return (results || []).map((r) => ({ ...r, kuldve_utc: new Date(r.kuldve * 1000).toISOString(), kizarva_a_mintabol: true }));
  } catch (e) { return []; }
}
