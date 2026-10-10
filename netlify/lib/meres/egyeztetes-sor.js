// QA-5 FOGLALASONKENTI EGYEZTETO SOR (DECISION-LOG #120 4. pont). Az UJ MERES + a PLATFORM ARNYEK-KEZBESITES oldala, booking_id-nkent egy sor; csak OLVAS (nem ir semmit, nem kuld semmit).
// A teljes egyeztetes: Salonic (a merese oldal adja: kulcs = placeId|employeeId|startUnix, szolgaltatas, ar, uj/visszatero) -> UJ MERES (ez a sor) -> REGI MERES (a merese oldal adja) -> PLATFORM ARNYEK-KEZBESITES (ez a sor).
// A sor fo kulcsai: booking_id, kulcs (a Salonic-oldali osszekapcsolashoz), esemeny_id; mezok: esemenytipus, ertek, uj / visszatero, platformonkent a kezbesitesek szama (pontosan 1 vagy jogos 0).
//
// Platform-cella osztalyozasa (esemeny x platform):
//   'ok'      - pontosan 1 kezbesites (allapot = elkuldve)
//   'jogos_0' - nincs kezbesites, de jogosan: a modell / hozzajarulas / lemondas miatt kihagyva (NEM a veszkapcsolo miatt), vagy a GA4-hez nincs client_id (nincs _ga suti: a latogato adata hianyzik)
//   'hiany'   - minden mas: nincs_hitelesites, hiba, tiltva, halasztva, nyitott, folyamatban, vagy a vészkapcsolo miatt kihagyva, vagy NINCS sor
// Jelzesek (foglalas-szint): tobb_alap_esemeny (rossz tipus / duplikacio gyanu), nincs_esemeny, parositatlan, hianyzo_platform_sor, platform_hiany:<platform>:<esemeny>.
import { meresSema } from './elosztas.js';
import { sema as parositasSema } from '../foglalas-kulcs.js';
import { PLATFORMOK } from './platformok.js';

const sec = (now) => Math.floor(now / 1000);
const UJ_VISSZATERO = Object.freeze({ FoglalasElso: 'uj', Konzultacio: 'uj_konzultacio', Visszajaro: 'visszatero', Ajandekkartya: 'ajandekkartya' });

/** Egy (esemeny, platform) cella osztalyozasa a meres_kuldes sorbol (vagy hianyabol). Tiszta fuggveny. */
export function cellaOsztaly(sor) {
  if (!sor) return { osztaly: 'hiany', ok: 'nincs_sor', kezbesites: 0 };
  if (sor.allapot === 'elkuldve') return { osztaly: 'ok', kezbesites: 1 };
  if (sor.allapot === 'kihagyva' && !/^veszkapcsolo/.test(sor.indok || '')) return { osztaly: 'jogos_0', ok: sor.indok || 'kihagyva', kezbesites: 0 };
  // a GA4 Measurement Protocol client_id (_ga suti) nelkul nem kuldheto: a latogato adata hianyzik (nem rendszerhiba) -> jogos 0, az ok kulon latszik; a tobbi 'tiltva' (vedelem: elo cel, hianyzo teszt-kod) HIANY marad
  if (sor.allapot === 'tiltva' && /^nincs GA4 client_id/.test(sor.indok || '')) return { osztaly: 'jogos_0', ok: String(sor.indok).slice(0, 80), kezbesites: 0 };
  return { osztaly: 'hiany', ok: sor.allapot + (sor.indok ? ': ' + String(sor.indok).slice(0, 80) : ''), kezbesites: 0 };
}

/** Egy foglalas sora a nyers D1-adatokbol. Tiszta fuggveny (a tesztelheto resz). */
export function sorEpit({ booking_id, irat = null, egyeztetes = null, jelleg = null, erkezes = null, kuldesek = [] }) {
  const esemenyek = new Map();
  for (const k of kuldesek) {
    if (!esemenyek.has(k.esemeny_id)) esemenyek.set(k.esemeny_id, { esemeny_id: k.esemeny_id, nev: k.esemeny_nev, tipus: k.esemeny_tipus, ertek: k.ertek, penznem: k.penznem, platformok: {} });
    esemenyek.get(k.esemeny_id).platformok[k.platform] = k;
  }
  const jelzesek = [];
  const lista = [...esemenyek.values()].map((e) => {
    const platformok = {};
    for (const p of PLATFORMOK) {
      const sor = e.platformok[p];
      const c = cellaOsztaly(sor);
      platformok[p] = { ...c, allapot: sor ? sor.allapot : null, http_status: sor ? sor.http_status : null, kuldo: sor ? sor.kuldo : null };
      if (c.osztaly === 'hiany') jelzesek.push(`platform_hiany:${p}:${e.nev}:${c.ok}`);
    }
    return { esemeny_id: e.esemeny_id, nev: e.nev, tipus: e.tipus, ertek: e.ertek, penznem: e.penznem, platformok };
  });
  const alapok = lista.filter((e) => e.tipus === 'alap');
  if (alapok.length > 1) jelzesek.push('tobb_alap_esemeny:' + alapok.map((e) => e.nev).join('+'));
  // a parositas allapota: a (Salonic-levelbol) kikuldott egyeztetes = kuldve; 'fuggoben' = a Zap ujraprobal (1 / 3 / 10 perc) - friss soroknal ez meg nem hiba
  const parositva = !!(egyeztetes && egyeztetes.kuldve);
  if (!lista.length) jelzesek.push(parositva ? 'nincs_esemeny' : egyeztetes ? 'egyeztetes_' + egyeztetes.allapot : 'parositatlan');
  else if (!parositva && booking_id.startsWith('mb_')) jelzesek.push(egyeztetes ? 'egyeztetes_' + egyeztetes.allapot : 'parositatlan');
  const alap = alapok[0] || null;
  return {
    booking_id,
    kulcs: (irat && irat.kulcs) || (egyeztetes && egyeztetes.kulcs) || null,
    uzletag: (erkezes && erkezes.uzletag) || (kuldesek[0] && kuldesek[0].uzletag) || null,
    kulcs_irva: irat ? irat.ido : null,
    parositas: egyeztetes ? { allapot: egyeztetes.allapot, forras: egyeztetes.kulcs_forras || null, kuldve: egyeztetes.kuldve || null, probalkozas: egyeztetes.probalkozas } : null,
    jelleg: jelleg ? { jelleg: jelleg.jelleg, kupon: !!jelleg.kupon, forras: jelleg.forras } : null,
    esemenytipus: alap ? alap.nev : null,
    uj_visszatero: alap ? (UJ_VISSZATERO[alap.nev] || null) : null,
    ertek: alap ? alap.ertek : null,
    penznem: alap ? alap.penznem : null,
    esemenyek: lista,
    jelzesek,
    rendben: !jelzesek.length,
  };
}

/** A csere idopontja: unix masodperc (szam / szamjegyes szoveg) vagy ISO-datum; ervenytelen -> null. */
export function csereIdo(v) {
  if (v === null || v === undefined || v === '') return null;
  if (/^\d{9,11}$/.test(String(v))) return Number(v);
  const t = Date.parse(String(v)); return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

/**
 * GA4 Measurement Protocol titokcsere jelolese (GPT-dontes, 2026-10-10): a csere ELOTTI utolso es az UTANI elso SIKERES (allapot = elkuldve) GA4 arnyek-esemeny,
 * valamint a csere utani, az elso sikeresig kelt sikertelen GA4 cellak szama. A kuldes ideje: meres_kuldes.frissitve (a sikeres kuldeskor frissul). Csak olvas.
 * Ketto valtozat: barmely GA4 arnyek-esemeny, es csak a foglalasok (source_id = mb_...).
 */
export async function ga4Csere(db, ido) {
  await meresSema(db);
  const MEZOK = "SELECT id, esemeny_id, esemeny_nev, source_id, uzletag, http_status, frissitve FROM meres_kuldes WHERE platform = 'ga4' AND allapot = 'elkuldve'";
  const jel = (r) => (r ? { esemeny_id: r.esemeny_id, esemeny: r.esemeny_nev, source_id: r.source_id, tipus: String(r.source_id).startsWith('mb_') ? 'foglalas' : 'ajandekkartya', uzletag: r.uzletag, http_status: r.http_status, kuldve: r.frissitve, kuldve_utc: new Date(r.frissitve * 1000).toISOString() } : null);
  const elso = async (felt, sorrend) => jel(await db.prepare(`${MEZOK} ${felt} ORDER BY frissitve ${sorrend}, id ${sorrend} LIMIT 1`).bind(ido).first());
  const FOGL = " AND source_id LIKE 'mb\\_%' ESCAPE '\\'";
  const out = {
    ido, ido_utc: new Date(ido * 1000).toISOString(),
    utolso_sikeres_elotte: await elso('AND frissitve < ?1', 'DESC'), elso_sikeres_utana: await elso('AND frissitve >= ?1', 'ASC'),
    foglalas_utolso_sikeres_elotte: await elso(FOGL + ' AND frissitve < ?1', 'DESC'), foglalas_elso_sikeres_utana: await elso(FOGL + ' AND frissitve >= ?1', 'ASC'),
  };
  const veg = out.elso_sikeres_utana ? out.elso_sikeres_utana.kuldve : null;
  const h = await db.prepare("SELECT COUNT(*) n FROM meres_kuldes WHERE platform = 'ga4' AND allapot IN ('hiba','nincs_hitelesites','tiltva') AND frissitve >= ?1 AND (?2 IS NULL OR frissitve <= ?2)").bind(ido, veg).first();
  out.sikertelen_ga4_cella_a_csere_utan_az_elso_sikeresig = h ? h.n : 0;
  return out;
}

/** Az idoszak (unix mp, [tol, ig)) foglalasai: a koszonooldali iras, a levelparositas vagy a kuldes alapjan. Csak OLVAS. */
export async function egyeztetoSorok(db, { tol, ig, uzletag = null, limit = 500, utan = '', ga4_csere = null } = {}) {
  await meresSema(db); await parositasSema(db);
  const t0 = Math.floor(Number(tol)), t1 = Math.floor(Number(ig));
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return { ok: false, miert: 'tol / ig: unix masodperc, ig > tol' };
  const lim = Math.min(Math.max(Math.floor(Number(limit)) || 500, 1), 1000);
  const { results: idk } = await db.prepare(`SELECT booking_id FROM (
      SELECT booking_id FROM foglalas_kulcs_irasok WHERE ido >= ?1 AND ido < ?2
      UNION SELECT booking_id FROM foglalas_egyeztetes WHERE booking_id IS NOT NULL AND letrehozva >= ?1 AND letrehozva < ?2
      UNION SELECT source_id FROM meres_kuldes WHERE source_id LIKE 'mb\\_%' ESCAPE '\\' AND letrehozva >= ?1 AND letrehozva < ?2
    ) WHERE booking_id > ?3 ORDER BY booking_id LIMIT ?4`).bind(t0, t1, String(utan || ''), lim + 1).all();
  const mind = (idk || []).map((r) => r.booking_id);
  const oldal = mind.slice(0, lim);
  const sorok = [];
  for (const id of oldal) {
    const [irat, egyeztetes, jelleg, erkezes, kuld] = await Promise.all([
      db.prepare('SELECT kulcs, service_id, ido FROM foglalas_kulcs_irasok WHERE booking_id = ?1').bind(id).first(),
      db.prepare('SELECT uuid, allapot, probalkozas, kulcs, kulcs_forras, kuldve, riasztas FROM foglalas_egyeztetes WHERE booking_id = ?1 ORDER BY kuldve IS NULL, kuldve DESC LIMIT 1').bind(id).first(),
      db.prepare('SELECT jelleg, kupon, forras FROM meres_jelleg WHERE source_id = ?1').bind(id).first().catch(() => null), // a meres_jelleg tabla az elso jelleg-rogzitesnel jon letre (olvasaskor nem hozzuk letre)
      db.prepare('SELECT uzletag, tipus, ido FROM meres_erkezes WHERE source_id = ?1').bind(id).first(),
      db.prepare('SELECT esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, allapot, indok, ertek, penznem, http_status, kuldo FROM meres_kuldes WHERE source_id = ?1 ORDER BY id').bind(id).all(),
    ]);
    const sor = sorEpit({ booking_id: id, irat, egyeztetes, jelleg, erkezes, kuldesek: (kuld && kuld.results) || [] });
    if (uzletag && sor.uzletag !== uzletag) continue;
    sorok.push(sor);
  }
  const osszegzes = { foglalas: sorok.length, rendben: sorok.filter((s) => s.rendben).length, jelzett: sorok.filter((s) => !s.rendben).length, platformonkent: {} };
  for (const p of PLATFORMOK) osszegzes.platformonkent[p] = { ok: 0, jogos_0: 0, hiany: 0 };
  osszegzes.jogos_0_okok = Object.fromEntries(PLATFORMOK.map((p) => [p, {}])); // a jogos 0-k okai platformonkent (a QA-oldal ebbol latja, mi van mogotte)
  for (const s of sorok) for (const e of s.esemenyek) for (const p of PLATFORMOK) {
    const c = e.platformok[p]; osszegzes.platformonkent[p][c.osztaly]++;
    if (c.osztaly === 'jogos_0') osszegzes.jogos_0_okok[p][c.ok] = (osszegzes.jogos_0_okok[p][c.ok] || 0) + 1;
  }
  const cs = csereIdo(ga4_csere);
  if (ga4_csere !== null && ga4_csere !== undefined && ga4_csere !== '' && cs === null) return { ok: false, miert: 'ga4_csere: unix masodperc vagy ISO-datum' };
  if (cs !== null) { // a GA4 titokcsere jelolese: osszegzes + a jelolt esemeny cellaja az oldalon (ha ott van)
    osszegzes.ga4_csere = await ga4Csere(db, cs);
    const jelolok = { [(osszegzes.ga4_csere.utolso_sikeres_elotte || {}).esemeny_id]: 'csere_elotti_utolso', [(osszegzes.ga4_csere.elso_sikeres_utana || {}).esemeny_id]: 'csere_utani_elso' };
    const fogl = { [(osszegzes.ga4_csere.foglalas_utolso_sikeres_elotte || {}).esemeny_id]: 'foglalas_csere_elotti_utolso', [(osszegzes.ga4_csere.foglalas_elso_sikeres_utana || {}).esemeny_id]: 'foglalas_csere_utani_elso' };
    for (const sor of sorok) for (const e of sor.esemenyek) {
      const m = [jelolok[e.esemeny_id], fogl[e.esemeny_id]].filter(Boolean);
      if (m.length) { e.platformok.ga4.csere_jelolo = m; (sor.ga4_csere_jelolo = sor.ga4_csere_jelolo || []).push(...m); }
    }
  }
  return { ok: true, tol: t0, ig: t1, sorok, osszegzes, kovetkezo: mind.length > lim ? oldal[oldal.length - 1] : null };
}

const CSV_OSZLOPOK = ['booking_id', 'kulcs', 'uzletag', 'esemenytipus', 'uj_visszatero', 'ertek', 'penznem', 'parositas_allapot', 'parositas_forras', 'kulcs_irva', 'esemeny_id', ...PLATFORMOK.map((p) => `${p}_kezbesites`), ...PLATFORMOK.map((p) => `${p}_osztaly`), 'ga4_csere_jelolo', 'jelzesek'];
const csvMezo = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/** CSV (foglalas x esemeny egy sor): a tabla a QA-5 tablazatba masolhato. */
export function egyeztetoCsv(sorok) {
  const sorokCsv = [CSV_OSZLOPOK.join(';')];
  for (const s of sorok) {
    const lista = s.esemenyek.length ? s.esemenyek : [null];
    for (const e of lista) {
      const o = {
        booking_id: s.booking_id, kulcs: s.kulcs, uzletag: s.uzletag, esemenytipus: e ? e.nev : s.esemenytipus, uj_visszatero: s.uj_visszatero, ertek: e ? e.ertek : s.ertek, penznem: e ? e.penznem : s.penznem,
        parositas_allapot: s.parositas ? s.parositas.allapot : '', parositas_forras: s.parositas ? s.parositas.forras : '', kulcs_irva: s.kulcs_irva, esemeny_id: e ? e.esemeny_id : '', ga4_csere_jelolo: e && e.platformok.ga4.csere_jelolo ? e.platformok.ga4.csere_jelolo.join(' | ') : '', jelzesek: s.jelzesek.join(' | '),
      };
      for (const p of PLATFORMOK) { o[`${p}_kezbesites`] = e ? e.platformok[p].kezbesites : ''; o[`${p}_osztaly`] = e ? e.platformok[p].osztaly : ''; }
      sorokCsv.push(CSV_OSZLOPOK.map((k) => csvMezo(o[k])).join(';'));
    }
  }
  return sorokCsv.join('\n') + '\n';
}
