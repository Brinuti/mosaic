// Belso tipusstatisztika (Feri, 2026-10-14 22:47: "mehet a belso tipusmeres", csak sajat statisztika).
// Adatvedelem: a tipus a foglalasi sorba tovabbra SEM kerul (MP-16, tarolhatoTipus). Itt egy KULCS NELKULI szamlalo van:
// nap + kornyezet + forras_cimke + helyszin + tipus_kod -> darab. Nincs foglalas-azonosito, suti, kattintas-ID, idopont,
// ertek, nev/e-mail/telefon - igy nem kotheto szemelyhez. Kifele (Meta/Google/TikTok) SEMMI nem olvassa.
// Riport: csak osszesitett, az OSSZEVONAS_KUSZOB alatti cellak "egyeb" sorba vonva.

/** Fordito: normalizalt tipus (meres.js tipusNormal) -> szamkod. Az adatbazisban csak a szam van. */
export const TIPUS_KOD = Object.freeze({
  migren: 1, shenmen: 2, klimax: 3, slim: 4, allergia: 5, maj: 6, lep: 7, vastagbel: 8, pajzsmirigy: 9, paros: 10,
  '2piercing': 11, '3piercing': 12, '4piercing': 13, '6piercing': 14, egyeb: 15, ful: 16,
});
export const tipusKod = (t) => TIPUS_KOD[t] ?? TIPUS_KOD.egyeb;
export const OSSZEVONAS_KUSZOB = 5;

export const TIPUS_STAT_SEMA = `CREATE TABLE IF NOT EXISTS mp_tipus_stat (nap TEXT NOT NULL, kornyezet TEXT NOT NULL, forras_cimke TEXT NOT NULL,
  helyszin TEXT NOT NULL, tipus_kod INTEGER NOT NULL, db INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (nap, kornyezet, forras_cimke, helyszin, tipus_kod))`;

/** Budapesti nap (YYYY-MM-DD) unix masodpercbol. */
export function budapestiNap(unix) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(unix * 1000));
}

/** Egy uj foglalas szamlalasa. Soha nem dob. sor: a foglalasi sor (kornyezet, forras_cimke, helyszin, letrehozva); tipus: tipusNormal kimenete. */
export async function tipusSzamlal(db, sor, tipus) {
  try {
    await db.prepare(TIPUS_STAT_SEMA).run();
    await db.prepare(`INSERT INTO mp_tipus_stat (nap, kornyezet, forras_cimke, helyszin, tipus_kod, db) VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT (nap, kornyezet, forras_cimke, helyszin, tipus_kod) DO UPDATE SET db = db + 1`)
      .bind(budapestiNap(sor.letrehozva), sor.kornyezet || 'elonezet', sor.forras_cimke || 'ismeretlen', sor.helyszin || 'ismeretlen', tipusKod(tipus)).run();
    return true;
  } catch (e) {
    console.error('mp-meres: tipus-stat hiba', String(e && e.message || e).slice(0, 120));
    return false;
  }
}

/**
 * Osszesito riport (tiszta fuggveny): sorok [{forras_cimke, helyszin, tipus_kod, db}] -> ugyanilyen sorok, ahol a kuszob alatti
 * cellak forrasonkent egy 'egyeb' (helyszin='egyeb', tipus_kod=0) sorba vonodnak.
 */
export function tipusRiport(sorok, kuszob = OSSZEVONAS_KUSZOB) {
  const cella = new Map();
  for (const s of sorok) {
    const k = `${s.forras_cimke}|${s.helyszin}|${s.tipus_kod}`;
    cella.set(k, (cella.get(k) || 0) + Number(s.db || 0));
  }
  const ki = [], egyeb = new Map();
  for (const [k, db] of cella) {
    const [forras_cimke, helyszin, tipus_kod] = k.split('|');
    if (db >= kuszob) ki.push({ forras_cimke, helyszin, tipus_kod: Number(tipus_kod), db });
    else egyeb.set(forras_cimke, (egyeb.get(forras_cimke) || 0) + db);
  }
  for (const [forras_cimke, db] of egyeb) ki.push({ forras_cimke, helyszin: 'egyeb', tipus_kod: 0, db });
  return ki.sort((a, b) => b.db - a.db);
}
