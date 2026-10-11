// QA-6: (a) a TikTok InitiateCheckout es a GA4 foglalasinditas (--ga4-esemeny, alap: begin_checkout) foglalasi
// kattintasonkent pontosan egyszer keletkezik, a kiosztas (motor/regi ut) ELOTT;
// (b) a kimeno kerdesekben (Meta, TikTok, Google Ads, GA4) nincs nev, e-mail, telefonszam (nyersen / SHA-256-tal)
// vagy egeszsegugyi szoveg; csak rovid tipuskod lehet.
// Az "esemeny keletkezese" a lapon mert idopont (ttq.track / dataLayer.push), a kiosztas a --kiosztas-kulcs
// irasa vagy az elso motor-API hivas. Hozzajarulas nelkul a TikTok / GA4 0 vagy 1 lehet (nem tobb).
// A (b)-hez: kattintasok + koszonooldal (a Salonic valodi parametereivel: szolgaltatasnev, kategoria, vendegazonosito);
// ha a motor feluletet talalunk, a mezoibe tesztszemelyt irunk (BEKULDES NELKUL); --pii-url 1: a tesztszemely a
// koszonooldal cimeben is (szelsoseges eset).
//   node medicalpiercing/qa/qa6-esemenyek.mjs --url https://<ag>.medicalpiercing.pages.dev
import { argumentumok, beallitas, kontextus, playwright, koszonoUt, egyediStart, salonicLinkek, motorLathato, merokodraVar,
  tiktokEsemenyek, ga4Esemenyek, tiltottLista, tiltottKeres, TESZT_SZEMELY, varj, sor } from './kozos.mjs';

export async function qa6(b, cfg) {
  const ki = [];
  if (!cfg.alias) return [sor('QA-6', '-', '-', 'N/A', '--alias 0: a merokodok csak eles cimkent futnak')];
  const tiltott = tiltottLista(cfg);
  for (const nezet of cfg.nezetek) {
    for (const hozz of [true, false]) {
      const eset = hozz ? 'hozzajarulassal' : 'hozzajarulas nelkul';
      const { ctx, naplo, cim } = await kontextus(b, cfg, nezet, { hozzajarulas: hozz });
      const hibakA = [], infoA = [];
      let motorVolt = false, ga4Volt = false, kiosztasVolt = false;
      try {
        const p = await ctx.newPage();
        await p.goto(cim(cfg.ctaOldal), { waitUntil: 'load' });
        await merokodraVar(p);
        for (let k = 0; k < 2; k++) {
          const i = naplo.length;
          const lapE = await p.evaluate(() => window.__qa.esemenyek.length);
          const lapI = await p.evaluate(() => window.__qa.irasok.length);
          const t0 = Date.now();
          const linkek = salonicLinkek(p);
          const motorGomb = p.locator(cfg.motorJel).filter({ visible: true });
          const cel = (await linkek.count()) > k ? linkek.nth(k) : linkek.first();
          if (!(await linkek.count()) && !(await motorGomb.count())) { hibakA.push('nincs foglalasi gomb'); break; }
          const felugro = ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null);
          await cel.click();
          const uj = await felugro;
          await varj(3500);
          if (await motorLathato(p, cfg)) motorVolt = true;
          const kifele = naplo.slice(i);
          const tt = tiktokEsemenyek(kifele).filter((e) => e.event === 'InitiateCheckout');
          const ga = ga4Esemenyek(kifele).filter((e) => cfg.ga4Esemeny.test(e.en));
          const lap = (await p.evaluate(() => window.__qa).catch(() => ({ esemenyek: [], irasok: [] })));
          const lapEsem = lap.esemenyek.slice(lapE);
          const ttLap = lapEsem.filter((e) => e.forras === 'ttq' && e.nev === 'InitiateCheckout');
          const gaLap = lapEsem.filter((e) => e.forras === 'dataLayer' && cfg.ga4Esemeny.test(e.nev));
          const kiosztas = [...lap.irasok.slice(lapI).map((x) => x.t), ...naplo.filter((s) => s.t >= t0 && s.tipus === 'sajat-api' && cfg.motorApi.test(s.url)).map((s) => s.t)];
          const kT = kiosztas.length ? Math.min(...kiosztas) : null;
          if (kT) kiosztasVolt = true;
          const ttDb = Math.max(tt.length, ttLap.length), gaDb = Math.max(ga.length, gaLap.length);
          if (gaDb) ga4Volt = true;
          infoA.push(`${k + 1}. katt: TikTok IC ${tt.length} keres/${ttLap.length} ttq, GA4 ${ga.length} keres/${gaLap.length} dataLayer${kT ? `, kiosztas +${kT - t0} ms` : ''}`);
          if (hozz && ttDb !== 1) hibakA.push(`${k + 1}. katt: TikTok InitiateCheckout ${ttDb}x`);
          if (!hozz && ttDb > 1) hibakA.push(`${k + 1}. katt: TikTok InitiateCheckout ${ttDb}x hozzajarulas nelkul`);
          if (gaDb > 1) hibakA.push(`${k + 1}. katt: GA4 ${gaDb}x`);
          for (const e of tt) {
            const pr = e.properties || {};
            for (const [kk, v] of Object.entries(pr)) if (/content_(name|category|type|id)/.test(kk) && !/^[a-z0-9_]{1,24}$/.test(String(v))) hibakA.push(`TikTok ${kk}="${v}" nem rovid tipuskod`);
          }
          if (kT) {
            const elsoE = [...ttLap, ...gaLap].map((e) => e.t);
            if (elsoE.length && Math.min(...elsoE) > kT) hibakA.push(`${k + 1}. katt: az esemeny a kiosztas UTAN keletkezett`);
          }
          if (uj) await uj.close().catch(() => {});
          if (p.url() !== cim(cfg.ctaOldal)) { await p.goto(cim(cfg.ctaOldal), { waitUntil: 'load' }); await merokodraVar(p); }
        }
        // (b) motor-urlap (ha van): tesztszemely a mezokbe, bekuldes NELKUL
        let urlap = 'nincs motor-urlap';
        if (motorVolt) {
          const keret = p.locator(cfg.motorJel).filter({ visible: true }).first();
          const mezok = [['input[type=email]', TESZT_SZEMELY.email], ['input[type=tel]', TESZT_SZEMELY.telefon], ['input[name*=nev i], input[name*=name i], input[autocomplete=name]', TESZT_SZEMELY.nev]];
          let db = 0;
          for (const [sel, v] of mezok) {
            const m = keret.locator(sel).filter({ visible: true });
            if (await m.count()) { await m.first().fill(v); await m.first().blur().catch(() => {}); db++; }
          }
          await varj(3000);
          urlap = `motor-urlap: ${db} mezo kitoltve (bekuldes nelkul)`;
        }
        const extra = cfg.piiUrl ? { nev: TESZT_SZEMELY.nev, email: TESZT_SZEMELY.email, phone: TESZT_SZEMELY.telefon } : {};
        await p.goto(cim(koszonoUt(cfg, { start: egyediStart(), bookingId: `QA6-${Date.now()}`, extra })), { waitUntil: 'load' });
        await varj(cfg.varas);
        const talalat = tiltottKeres(naplo, tiltott);
        const egyedi = [...new Map(talalat.map((x) => [`${x.plat}|${x.fajta}|${x.ertek}`, x])).values()];
        ki.push(sor('QA-6b', nezet, eset, egyedi.length ? 'FAIL' : 'PASS',
          egyedi.length ? egyedi.slice(0, 6).map((x) => `${x.plat}: ${x.fajta} "${x.ertek}" … ${x.reszlet}`).join(' | ') : `${naplo.filter((s) => s.tipus === 'kifele').length} kimeno keres atnezve; ${urlap}`));
        if (!motorVolt) ki.push(sor('QA-6b', nezet, eset + ', motor-urlap', 'MOTORFUGGO', 'a motor feluletet nem talaltuk (0% / meg nincs motor): a vendegadatok utja a motor-urlapbol elore nem tesztelheto'));
      } catch (e) { hibakA.push('hiba: ' + e.message.split('\n')[0]); }
      await ctx.close();
      const allapot = hibakA.length ? 'FAIL' : 'PASS';
      ki.push(sor('QA-6a', nezet, eset, allapot, (hibakA.length ? hibakA.join(' | ') + ' || ' : '') + infoA.join('; ')));
      if (!ga4Volt && hozz) ki.push(sor('QA-6a', nezet, eset + ', GA4 foglalasinditas', 'NINCS', `GA4 ${cfg.ga4Esemeny} nem keletkezett a kattintasra (az oldal meg nem kuldi / mas a neve: --ga4-esemeny)`));
      if (!kiosztasVolt) ki.push(sor('QA-6a', nezet, eset + ', sorrend a kiosztashoz', 'MOTORFUGGO', 'kiosztas nem tortent (0% / nincs motor): a "kiosztas elott" sorrend csak >0%-nal merheto'));
    }
  }
  return ki;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = beallitas(argumentumok());
  const b = await playwright().chromium.launch();
  const r = await qa6(b, cfg);
  await b.close();
  console.table(r);
  process.exit(r.some((x) => x.eredmeny === 'FAIL') ? 1 : 0);
}
