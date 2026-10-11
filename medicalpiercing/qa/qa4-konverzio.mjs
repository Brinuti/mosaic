// QA-4: a koszonooldalon a Google Ads cimke (AW-11097894040, "All - Idopontfoglalas") foglalasonkent pontosan
// egyszer sul el; frissiteskor, vissza-elore lepeskor es a koszonooldal ujranyitasakor nincs ujabb
// beszamithato konverzio. Hozzajarulassal es anelkul (CookieYes-suti) is.
//
// Lepesek nezetenkent es hozzajarulasonkent: hirdetesi erkezes (?gclid) -> koszonooldal (Salonic-referrerrel)
// -> frissites -> masik oldal + Vissza -> Elore + Vissza -> ugyanaz a koszonooldal uj lapon.
// Kisules = a cimke konverzio-hivasa (pagead/conversion, 1p-conversion, ccm: csatornankent szamolva).
// "Beszamithato" ismetles: ujabb kisules, amelynek oid-ja (transaction_id) ures vagy elter az elsotol
// (azonos oid-t a Google deduplikal). --szigoru 1: ismetleskor semmilyen kisules nem lehet.
// --aw-cimke <label>: ha ismert az "All - Idopontfoglalas" cimkeje; nelkule minden konverzio-cimkere
// ugyanaz a szabaly (a GTM-ben 5 AW-cimke van: README.md).
// Hozzajarulas nelkul az elso betoltesnel 0 vagy 1 kisules elfogadott (1 = cookieless ping, gcs=G100), de
// gcs=G1x1 (hirdetesi hozzajarulas megadva) FAIL.
//   node medicalpiercing/qa/qa4-konverzio.mjs --url https://<ag>.medicalpiercing.pages.dev
import { bongeszo, argumentumok, beallitas, kontextus, playwright, koszonoUt, egyediStart, googleAdsKonverziok, varj, sor, SALONIC } from './kozos.mjs';

export async function qa4(b, cfg) {
  const ki = [];
  if (!cfg.alias) return [sor('QA-4', '-', '-', 'N/A', '--alias 0: a merokodok csak eles cimkent futnak')];
  for (const nezet of cfg.nezetek) {
    for (const hozz of [true, false]) {
      const eset = hozz ? 'hozzajarulassal' : 'hozzajarulas nelkul';
      const { ctx, naplo, cim } = await kontextus(b, cfg, nezet, { hozzajarulas: hozz });
      const lepesek = [];
      try {
        const p = await ctx.newPage();
        await p.goto(cim(`/?gclid=QA4TESZT${Date.now()}`), { waitUntil: 'load' });
        await varj(2000);
        const kut = cim(koszonoUt(cfg, { start: egyediStart(), bookingId: `QA4-${Date.now()}` }));
        const meres = async (nev, fn) => {
          const i = naplo.length;
          await fn();
          await varj(cfg.varas);
          lepesek.push({ nev, konv: googleAdsKonverziok(naplo.slice(i), cfg.awId) });
        };
        await meres('elso betoltes', () => p.goto(kut, { waitUntil: 'load', referer: SALONIC + '/' }));
        await meres('frissites', () => p.reload({ waitUntil: 'load' }));
        await p.goto(cim('/rolunk'), { waitUntil: 'load' });
        await varj(1500);
        await meres('vissza', () => p.goBack({ waitUntil: 'load' }));
        await p.goForward({ waitUntil: 'load' }).catch(() => {});
        await varj(1500);
        await meres('elore + vissza', () => p.goBack({ waitUntil: 'load' }));
        const p2 = await ctx.newPage();
        await meres('ujranyitas uj lapon', () => p2.goto(kut, { waitUntil: 'load' }));
      } catch (e) { lepesek.push({ nev: 'hiba', hiba: e.message.split('\n')[0] }); }
      await ctx.close();

      const hiba = lepesek.find((l) => l.hiba);
      if (hiba) { ki.push(sor('QA-4', nezet, eset, 'FAIL', hiba.hiba)); continue; }
      const [elso, ...tobbi] = lepesek;
      const szuro = (k) => Object.fromEntries(Object.entries(k).filter(([l]) => !cfg.awCimke || l === cfg.awCimke));
      const e1 = szuro(elso.konv);
      const cimkek = Object.keys(e1);
      const gyujt = [];
      let ok = true;
      if (hozz) {
        if (!cimkek.length) { ok = false; gyujt.push('elso betoltes: nincs konverzio-kisules'); }
        for (const l of cimkek) if (e1[l].db !== 1) { ok = false; gyujt.push(`elso betoltes: ${l} ${e1[l].db}x`); }
      } else {
        for (const l of cimkek) {
          if (e1[l].db > 1) { ok = false; gyujt.push(`elso betoltes: ${l} ${e1[l].db}x`); }
          if (e1[l].gcs.some((g) => /^G1.1$/.test(g))) { ok = false; gyujt.push(`${l}: hozzajarulas nelkul gcs=${e1[l].gcs.join(',')}`); }
        }
      }
      for (const lep of tobbi) {
        const k = szuro(lep.konv);
        for (const [l, v] of Object.entries(k)) {
          const elsoOid = (e1[l]?.oid || []).filter(Boolean);
          const azonosOid = elsoOid.length && v.oid.every((o) => o && elsoOid.includes(o));
          if (cfg.szigoru || !azonosOid) { ok = false; gyujt.push(`${lep.nev}: ${l} ujra ${v.db}x (oid: ${v.oid.join(',') || 'nincs'})`); }
          else gyujt.push(`${lep.nev}: ${l} ujra, de azonos oid (Google deduplikal)`);
        }
      }
      const osszeg = `elso: ${cimkek.map((l) => `${l} ${e1[l].db}x gcs=${e1[l].gcs.join('/') || '-'} oid=${e1[l].oid.join('/') || '-'}`).join('; ') || 'nincs'}; ismetlesek: ${tobbi.map((l) => `${l.nev}=${Object.values(szuro(l.konv)).reduce((a, v) => a + v.db, 0)}`).join(', ')}`;
      ki.push(sor('QA-4', nezet, eset, ok ? 'PASS' : 'FAIL', (gyujt.length ? gyujt.join(' | ') + ' || ' : '') + osszeg));
    }
  }
  return ki;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = beallitas(argumentumok());
  const b = await bongeszo();
  const r = await qa4(b, cfg);
  await b.close();
  console.table(r);
  process.exit(r.some((x) => x.eredmeny === 'FAIL') ? 1 : 0);
}
