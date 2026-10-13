// MEDICAL PIERCING – napi meres-egeszseg riport (GPT 2026-10-12: a primary-csere dontesi alapja is).
// Forrasok napra bontva (Budapest): D1 foglalas (koszonooldal), Salonic-level (igazolas), Google Ads konverziok
// (a Zapier napi workflow tolti be: mp_ads_napi), kiigazitasok. Csak szamok, szemelyes adat nincs.
import { PLATFORMOK, ONBEVALLASOK } from './forras.js';
import { TIKTOK_SEMA } from './tiktok.js';
import { CIMKEK, cimkez, markasListaOlvas, FORRAS_VERZIO } from './cimke.js';

const FORRAS_KULCSOK = [...PLATFORMOK, 'ismeretlen'];
const ONBEVALLAS_KULCSOK = [...ONBEVALLASOK, 'nincs'];
export const ADS_AKCIOK = Object.freeze({ '7468541217': 'all', '7839410357': 'igazolt' });

export const ADS_SEMA = `CREATE TABLE IF NOT EXISTS mp_ads_napi (nap TEXT NOT NULL, akcio TEXT NOT NULL, db REAL NOT NULL, ertek REAL,
  frissitve INTEGER NOT NULL, PRIMARY KEY (nap, akcio))`;

/** Uj vendeg: a Salonic-igazolas szerint (uj_vendeg_igazolt = 1) VAGY a koszonooldal first_booking jelzese szerint (uj_vendeg = 1). */
export const ujVendegE = (s) => s.uj_vendeg_igazolt === 1 || s.uj_vendeg === 1;
const FORRAS_OSZLOPOK = 'utm_source, utm_medium, utm_campaign, kattintas_param, referrer_kat, forras_verzio, forras_platform, forras_keret';
const szazalek = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

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
  await db.prepare(TIKTOK_SEMA).run();
  const tol = most - nap * 86400;
  const napok = {};
  const n = (d) => (napok[d] ||= { nap: d, d1_foglalas: 0, d1_uj: 0, d1_igazolt: 0, d1_nem_igazolt: 0, salonic_level: 0, salonic_parositatlan: 0, ads_all: null, ads_igazolt: null, ads_igazolt_ertek: null, tiktok_naplo: 0,
    ...Object.fromEntries(FORRAS_KULCSOK.flatMap((p) => [[`forras_${p}`, 0], [`forras_${p}_igazolt`, 0]])),
    ...Object.fromEntries(ONBEVALLAS_KULCSOK.map((o) => [`onbevallas_${o}`, 0])),
    // forras v2 (cimke.js): vegso cimke (a tarolt bizonyitekbol, az AKTUALIS markas listaval ujraszamolva), osszes es uj vendeg
    ...Object.fromEntries(CIMKEK.flatMap((c) => [[`cimke_${c}`, 0], [`cimke_${c}_igazolt`, 0], [`uj_cimke_${c}`, 0], [`uj_cimke_${c}_igazolt`, 0]])),
    d1_uj_vendeg: 0, cimkezett: 0, cimkezett_uj: 0,
    // divat fulpiercing (/fulbevalo-ok*, tipus = 'ful'): a fenti szamokban is benne van, ez csak a bontasa
    d1_ful: 0, d1_ful_igazolt: 0, ...Object.fromEntries(CIMKEK.map((c) => [`ful_cimke_${c}`, 0])),
    hozzajarulassal: 0, hozzajarulassal_cimkezett: 0, hozzajarulas_nelkul: 0, hozzajarulas_nelkul_cimkezett: 0,
    uj_hozzajarulassal: 0, uj_hozzajarulassal_cimkezett: 0, uj_hozzajarulas_nelkul: 0, uj_hozzajarulas_nelkul_cimkezett: 0,
    ismeretlen_okok: {} });
  const markas = await markasListaOlvas(db);
  const f = await db.prepare(`SELECT letrehozva, uj_vendeg, uj_vendeg_igazolt, igazolas, onbevallas, hozzajarulas_hirdetes, tipus, ${FORRAS_OSZLOPOK} FROM mp_foglalas WHERE kornyezet = 'eles' AND letrehozva >= ?`).bind(tol).all();
  for (const s of f.results || []) {
    const x = n(napBp(s.letrehozva)); x.d1_foglalas++; if (s.uj_vendeg === 1) x.d1_uj++;
    if (s.igazolas === 'igazolt') x.d1_igazolt++; else if (s.igazolas === 'nem_igazolt') x.d1_nem_igazolt++;
    // forras-cimke (hozzajarulastol fuggetlen csatornanev) szerinti bontas; ebbol Salonic-igazolt (igazolas = 'igazolt')
    const fp = PLATFORMOK.includes(s.forras_platform) ? s.forras_platform : 'ismeretlen';
    x[`forras_${fp}`]++; if (s.igazolas === 'igazolt') x[`forras_${fp}_igazolt`]++;
    x[`onbevallas_${ONBEVALLASOK.includes(s.onbevallas) ? s.onbevallas : 'nincs'}`]++;
    // forras v2: vegso cimke, lefedettseg (cimkezett = nem 'ismeretlen'), hozzajarulas szerinti bontas
    const c = cimkez(s, markas), uj = ujVendegE(s), ig = s.igazolas === 'igazolt', jo = c.forras_cimke !== 'ismeretlen';
    const hz = s.hozzajarulas_hirdetes === 1 ? 'hozzajarulassal' : 'hozzajarulas_nelkul';
    x[`cimke_${c.forras_cimke}`]++; if (ig) x[`cimke_${c.forras_cimke}_igazolt`]++;
    x[hz]++; if (jo) { x.cimkezett++; x[`${hz}_cimkezett`]++; }
    if (uj) {
      x.d1_uj_vendeg++; x[`uj_cimke_${c.forras_cimke}`]++; if (ig) x[`uj_cimke_${c.forras_cimke}_igazolt`]++;
      x[`uj_${hz}`]++; if (jo) { x.cimkezett_uj++; x[`uj_${hz}_cimkezett`]++; }
    }
    if (s.tipus === 'ful') { x.d1_ful++; if (ig) x.d1_ful_igazolt++; x[`ful_cimke_${c.forras_cimke}`]++; }
    if (!jo) x.ismeretlen_okok[c.ismeretlen_ok || 'nincs_jel'] = (x.ismeretlen_okok[c.ismeretlen_ok || 'nincs_jel'] || 0) + 1;
  }
  for (const x of Object.values(napok)) {
    x.lefedettseg_osszes = szazalek(x.cimkezett, x.d1_foglalas);
    x.lefedettseg_uj = szazalek(x.cimkezett_uj, x.d1_uj_vendeg);
    x.lefedettseg_hozzajarulassal = szazalek(x.hozzajarulassal_cimkezett, x.hozzajarulassal);
    x.lefedettseg_hozzajarulas_nelkul = szazalek(x.hozzajarulas_nelkul_cimkezett, x.hozzajarulas_nelkul);
    x.lefedettseg_uj_hozzajarulassal = szazalek(x.uj_hozzajarulassal_cimkezett, x.uj_hozzajarulassal);
    x.lefedettseg_uj_hozzajarulas_nelkul = szazalek(x.uj_hozzajarulas_nelkul_cimkezett, x.uj_hozzajarulas_nelkul);
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
  // TikTok "Schedule": a naplozott (csak naplo modban rogzitett, el nem kuldott) sorok szama naponta
  const tt = await db.prepare("SELECT ido FROM mp_tiktok_feltoltes WHERE allapot = 'naplozva' AND ido >= ?").bind(tol).all();
  for (const s of tt.results || []) n(napBp(s.ido)).tiktok_naplo++;
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
  return { ok: true, nap, sorok, kiigazitas: k.results || [], figyelmeztetesek: figy, google_markas_lista: markas ? markas.length : null };
}

// ---------------- havi pillanatkep (forras v2) ----------------

/** A Budapest szerinti honap [tol, ig) unix-hatarai ("YYYY-MM"), vagy null. */
export function honapHatar(ho) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(ho || ''));
  if (!m) return null;
  const bp = (y, mo) => {
    // a honap elso napjanak 00:00 (Budapest) ideje: UTC-ejfel minus a budapesti eltolas
    const utc = Date.UTC(y, mo - 1, 1);
    const resz = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hour: '2-digit', hourCycle: 'h23' }).format(new Date(utc));
    return Math.floor(utc / 1000) - Number(resz) * 3600;
  };
  const y = +m[1], mo = +m[2];
  return { tol: bp(y, mo), ig: mo === 12 ? bp(y + 1, 1) : bp(y, mo + 1) };
}

export const HAVI_FEJLEC = ['ho', 'forras_cimke', 'foglalas', 'igazolt', 'uj_vendeg', 'uj_vendeg_igazolt', 'hozzajarulassal', 'verzio', 'pillanatkep'];

/**
 * Havi CSV-pillanatkep (szemelyes adat nelkul): cimkenkent foglalas, Salonic-igazolt, uj vendeg, uj vendeg ES igazolt,
 * hirdetesi hozzajarulassal. Csak eles (kornyezet = 'eles') sorok; a cimke az aktualis markas listaval ujraszamolva.
 */
export async function haviCsv(db, ho, most) {
  const h = honapHatar(ho);
  if (!h) return null;
  const markas = await markasListaOlvas(db);
  const r = await db.prepare(`SELECT uj_vendeg, uj_vendeg_igazolt, igazolas, hozzajarulas_hirdetes, ${FORRAS_OSZLOPOK} FROM mp_foglalas
    WHERE kornyezet = 'eles' AND letrehozva >= ? AND letrehozva < ?`).bind(h.tol, h.ig).all();
  const t = Object.fromEntries(CIMKEK.map((c) => [c, { foglalas: 0, igazolt: 0, uj_vendeg: 0, uj_vendeg_igazolt: 0, hozzajarulassal: 0 }]));
  for (const s of r.results || []) {
    const x = t[cimkez(s, markas).forras_cimke];
    const ig = s.igazolas === 'igazolt', uj = ujVendegE(s);
    x.foglalas++; if (ig) x.igazolt++; if (uj) x.uj_vendeg++; if (uj && ig) x.uj_vendeg_igazolt++; if (s.hozzajarulas_hirdetes === 1) x.hozzajarulassal++;
  }
  const pk = new Date(most * 1000).toISOString();
  const sorok = CIMKEK.map((c) => [ho, c, t[c].foglalas, t[c].igazolt, t[c].uj_vendeg, t[c].uj_vendeg_igazolt, t[c].hozzajarulassal, FORRAS_VERZIO, pk]);
  return [HAVI_FEJLEC, ...sorok].map((s) => s.join(',')).join('\n') + '\n';
}
