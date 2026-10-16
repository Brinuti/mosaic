// A foglalas -> megjelenes rendszer (Mosaic-projekt, netlify/lib/lifecycle) MP-leveleinek kimeno sora: a motor a kozos D1 (LIFECYCLE_DB)
// mp_kimeno tablajaba irja a kesz levelet, ez a modul (POST /api/lifecycle-kimeno, functions/[[path]].js) ennek a projektnek a Gmail-fiokjabol kuldi ki.
// Kulcs nincs (a tulajdonos dontese, 2026-10-16): a vegpont csak azt kuldheti, amit a motor a sorba tett; a valasz csak darabszam, soha nem sor-tartalom.
export const MAX_PROBA = 5;
export const KOTEG = 20;
export const BENNRAGADT_MP = 10 * 60; // ennyi masodperc utan a "folyamatban" (negativ elkuldve) sor ujra felveheto

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[A-Za-z]{2,}$/;

/**
 * A sor feldolgozasa. db: D1; kuld({ to, subject, html, text, reply }) egy level (hibat dob, ha nem ment ki); most: unix mp.
 * Visszaad: { felvett, elkuldve, hiba, visszavett } (csak szamok).
 */
export async function kimenoFeldolgoz(db, kuld, most = Math.floor(Date.now() / 1000)) {
  // bennragadt (pl. megszakadt futas) sorok visszavetele: elkuldve = -<felvetel ideje>
  const vissza = await db.prepare('UPDATE mp_kimeno SET elkuldve = NULL WHERE elkuldve < 0 AND -elkuldve < ?1').bind(most - BENNRAGADT_MP).run();
  // atomikus felvetel: ket parhuzamos hivas nem veheti fel ugyanazt a sort
  const { results: sorok } = await db.prepare(
    'UPDATE mp_kimeno SET elkuldve = ?1, probak = probak + 1 WHERE id IN (SELECT id FROM mp_kimeno WHERE elkuldve IS NULL AND probak < ?2 ORDER BY letrehozva LIMIT ?3) AND elkuldve IS NULL RETURNING *',
  ).bind(-most, MAX_PROBA, KOTEG).all();
  let elkuldve = 0, hiba = 0;
  const sorrend = [...(sorok || [])].sort((a, b) => (a.letrehozva - b.letrehozva) || String(a.id).localeCompare(String(b.id))); // a RETURNING sorrendje nem garantalt
  for (const s of sorrend) {
    try {
      const to = String(s.cimzett || '').trim(), valasz = String(s.valasz || '').trim();
      if (!EMAIL_RE.test(to) || !s.targy || /[\r\n]/.test(s.targy) || !s.html) throw new Error('hibas sor');
      await kuld({ to, subject: s.targy, html: s.html, text: s.szoveg || '', reply: EMAIL_RE.test(valasz) ? valasz : null });
      await db.prepare('UPDATE mp_kimeno SET elkuldve = ?2, hiba = NULL WHERE id = ?1').bind(s.id, most).run();
      elkuldve += 1;
    } catch (e) {
      await db.prepare('UPDATE mp_kimeno SET elkuldve = NULL, hiba = ?2 WHERE id = ?1').bind(s.id, String((e && e.message) || e).slice(0, 300)).run();
      hiba += 1;
    }
  }
  return { felvett: (sorok || []).length, elkuldve, hiba, visszavett: Number(vissza?.meta?.changes || 0) };
}
