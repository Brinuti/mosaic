// MEDICAL PIERCING – napi meres-egeszseg riport (GPT 2026-10-12: a primary-csere dontesi alapja is).
// Forrasok napra bontva (Budapest): D1 foglalas (koszonooldal), Salonic-level (igazolas), Google Ads konverziok
// (a Zapier napi workflow tolti be: mp_ads_napi), kiigazitasok. Csak szamok, szemelyes adat nincs.
export const ADS_AKCIOK = Object.freeze({ '7468541217': 'all', '7839410357': 'igazolt' });

export const ADS_SEMA = `CREATE TABLE IF NOT EXISTS mp_ads_napi (nap TEXT NOT NULL, akcio TEXT NOT NULL, db REAL NOT NULL, ertek REAL,
  frissitve INTEGER NOT NULL, PRIMARY KEY (nap, akcio))`;

const napBp = (unix) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date(unix * 1000));

/** A Google googleAds:search valaszabol (segments.date, conversionAction, all_conversions) -> mp_ads_napi sorok. */
export function adsSorok(valasz) {
  const ki = [];
  for (const r of (valasz && valasz.results) || []) {
    const akcio = /(\d+)$/.exec((r.segments && r.segments.conversionAction) || '');
    const nap = r.segments && r.segments.date;
    if (!akcio || !ADS_AKCIOK[akcio[1]] || !/^\d{4}-\d{2}-\d{2}$/.test(nap || '')) continue;
    ki.push({ nap, akcio: akcio[1], db: Number(r.metrics && r.metrics.allConversions) || 0, ertek: Number(r.metrics && r.metrics.allConversionsValue) || 0 });
  }
  return ki;
}

export async function adsMentes(db, sorok, most) {
  await db.prepare(ADS_SEMA).run();
  for (const s of sorok) {
    await db.prepare('INSERT INTO mp_ads_napi (nap, akcio, db, ertek, frissitve) VALUES (?,?,?,?,?) ON CONFLICT (nap, akcio) DO UPDATE SET db = excluded.db, ertek = excluded.ertek, frissitve = excluded.frissitve')
      .bind(s.nap, s.akcio, s.db, s.ertek, most).run();
  }
  return sorok.length;
}

/**
 * Napi riport + figyelmeztetesek (nap darab nap, a mai is). A szamok kicsik: abszolut kuszobokkel is.
 */
export async function riport(db, most, nap = 14) {
  await db.prepare(ADS_SEMA).run();
  const tol = most - nap * 86400;
  const napok = {};
  const n = (d) => (napok[d] ||= { nap: d, d1_foglalas: 0, d1_uj: 0, d1_igazolt: 0, d1_nem_igazolt: 0, salonic_level: 0, salonic_parositatlan: 0, ads_all: null, ads_igazolt: null, ads_igazolt_ertek: null });
  const f = await db.prepare("SELECT letrehozva, uj_vendeg, igazolas FROM mp_foglalas WHERE kornyezet = 'eles' AND letrehozva >= ?").bind(tol).all();
  for (const s of f.results || []) {
    const x = n(napBp(s.letrehozva)); x.d1_foglalas++; if (s.uj_vendeg === 1) x.d1_uj++;
    if (s.igazolas === 'igazolt') x.d1_igazolt++; else if (s.igazolas === 'nem_igazolt') x.d1_nem_igazolt++;
  }
  const l = await db.prepare('SELECT erkezett, rogzitve, kulcs FROM mp_salonic_igazolas WHERE erkezett >= ?').bind(tol).all();
  let parositatlanRegi = 0;
  for (const s of l.results || []) {
    const x = n(napBp(s.erkezett)); x.salonic_level++;
    if (!s.kulcs) { x.salonic_parositatlan++; if (s.rogzitve < most - 2 * 3600) parositatlanRegi++; }
  }
  const a = await db.prepare('SELECT nap, akcio, db, ertek FROM mp_ads_napi WHERE nap >= ?').bind(napBp(tol)).all();
  for (const s of a.results || []) {
    const x = n(s.nap);
    if (ADS_AKCIOK[s.akcio] === 'all') x.ads_all = Math.round(s.db * 100) / 100;
    if (ADS_AKCIOK[s.akcio] === 'igazolt') { x.ads_igazolt = Math.round(s.db * 100) / 100; x.ads_igazolt_ertek = Math.round(s.ertek); }
  }
  const sorok = Object.values(napok).sort((p, q) => (p.nap < q.nap ? 1 : -1));
  const k = await db.prepare('SELECT mod, allapot, COUNT(*) AS db FROM mp_kiigazitas WHERE ido >= ? GROUP BY 1, 2').bind(tol).all();

  // figyelmeztetesek (csak a lezart napokra: tegnap es korabban)
  const ma = napBp(most);
  const figy = [];
  for (const x of sorok.filter((s) => s.nap < ma)) {
    if (x.d1_foglalas >= 3 && x.salonic_level === 0 && x.nap >= '2026-10-13') figy.push({ nap: x.nap, kod: 'nincs_salonic_level', leiras: `${x.d1_foglalas} foglalas, de 0 Salonic-level (Zapier / Gmail lanc?)` });
    if (x.salonic_level >= 3 && x.d1_foglalas === 0) figy.push({ nap: x.nap, kod: 'nincs_d1_foglalas', leiras: `${x.salonic_level} Salonic-level, de 0 koszonooldali foglalas (oldal / suti.js?)` });
    if (x.ads_all > 0 && x.ads_igazolt === 0 && x.nap >= '2026-10-13') figy.push({ nap: x.nap, kod: 'igazolt_cimke_nulla', leiras: `All ${x.ads_all}, igazolt 0 (GTM-cimke?)` });
  }
  if (parositatlanRegi > 0) figy.push({ nap: ma, kod: 'parositatlan_salonic_level', leiras: `${parositatlanRegi} Salonic-levelhez 2 oran tul sincs koszonooldali foglalas (lefedettsegi res)` });
  const regiNap = sorok.filter((s) => s.nap < ma).map((s) => s.ads_all).filter((v) => v != null);
  if (!(regiNap.length)) figy.push({ nap: ma, kod: 'nincs_ads_adat', leiras: 'nincs betoltott Google Ads napi adat (Zapier napi futas?)' });
  return { ok: true, nap, sorok, kiigazitas: k.results || [], figyelmeztetesek: figy };
}
