// QA-5: a gclid / gbraid es a booking_id atmegy a koszonooldalra es a /api/mp-foglalas hivasba
// (PR #242 vegpontja: POST { ut, p: { bookingUrl, price, first_booking, booking_id, ... }, kattintas: { gclid|gbraid|wbraid: { ertek, ido } } | null }).
// Hozzajarulas nelkul nincs kattintasazonosito (sem a keresben, sem az mp_gk taroloban).
// A vegpont alapbol mockolt (semmi nem irodik); --api elonezet: az elonezet valodi fuggvenye (D1, kornyezet=elonezet),
// ekkor a valaszt is nezzuk (elso: uj=true, frissites: uj=false).
// Motorfuggo (elore nem tesztelheto): hogy a MOTOR a valodi foglalas utan booking_id-vel iranyit a koszonooldalra.
// Itt a motor atadasat a koszonooldal-cim szimulalja (booking_id parameterrel).
//   node medicalpiercing/qa/qa5-azonositok.mjs --url https://<ag>.medicalpiercing.pages.dev
import { bongeszo, argumentumok, beallitas, kontextus, playwright, koszonoUt, egyediStart, varj, sor } from './kozos.mjs';

export async function qa5(b, cfg) {
  const ki = [];
  for (const nezet of cfg.nezetek) {
    for (const azon of ['gclid', 'gbraid']) {
      for (const hozz of [true, false]) {
        const eset = `${azon}, ${hozz ? 'hozzajarulassal' : 'hozzajarulas nelkul'}`;
        const { ctx, naplo, api, cim } = await kontextus(b, cfg, nezet, { hozzajarulas: hozz });
        const ertek = `QA5${azon}${Date.now()}`;
        const bookingId = `QA5-${nezet}-${Date.now()}`;
        const hibak = [];
        let info = '';
        try {
          const p = await ctx.newPage();
          await p.goto(cim(`${cfg.ctaOldal}?${azon}=${ertek}`), { waitUntil: 'load' });
          await varj(1500);
          const meroBetolt = naplo.some((s) => s.tipus === 'sajat' && /mp-meres\.js/.test(s.url));
          const tarolt = await p.evaluate(() => localStorage.getItem('mp_gk')).catch(() => null);
          const kut = koszonoUt(cfg, { start: egyediStart(), bookingId });
          const valasz1 = cfg.api === 'elonezet' ? p.waitForResponse((r) => /\/api\/mp-foglalas$/.test(r.url()), { timeout: 12000 }).catch(() => null) : null;
          await p.goto(cim(kut), { waitUntil: 'load' });
          await varj(5000); // az mp-meres.js legfeljebb 4 mp-et var a CookieYes-dontesre
          const v1 = valasz1 ? await (await valasz1)?.json().catch(() => null) : null;
          const hivasok = api.filter((s) => /^\/api\/mp-foglalas/.test(s.url) && s.method === 'POST');
          if (!meroBetolt && !hivasok.length) {
            await ctx.close();
            ki.push(sor('QA-5', nezet, eset, 'NINCS', 'az oldalon meg nincs mp-meres.js / /api/mp-foglalas (PR #242 nincs a main-en): a lanc nem fut'));
            continue;
          }
          const url = new URL(p.url());
          if (url.searchParams.get('booking_id') !== bookingId) hibak.push(`a koszonooldal cimeben nincs meg a booking_id (${p.url()})`);
          if (hivasok.length !== 1) hibak.push(`/api/mp-foglalas hivasok szama: ${hivasok.length} (vart: 1)`);
          const t = (() => { try { return JSON.parse(hivasok[0]?.post || '{}'); } catch { return {}; } })();
          if (t.p?.booking_id !== bookingId) hibak.push(`a keresben booking_id=${t.p?.booking_id}`);
          if (!/^\/foglalas-ok/.test(t.ut || '')) hibak.push(`ut=${t.ut}`);
          if (hozz) {
            if (!tarolt || !tarolt.includes(ertek)) hibak.push('hozzajarulassal az mp_gk-ban nincs meg az azonosito');
            if (t.kattintas?.[azon]?.ertek !== ertek) hibak.push(`a keresben kattintas.${azon}=${JSON.stringify(t.kattintas)}`);
          } else {
            if (tarolt) hibak.push('hozzajarulas nelkul van mp_gk: ' + tarolt);
            if (t.kattintas != null) hibak.push('hozzajarulas nelkul a keresben kattintas=' + JSON.stringify(t.kattintas));
            if (JSON.stringify(t).includes(ertek)) hibak.push('hozzajarulas nelkul az azonosito a keresben');
          }
          const kulcsok = Object.keys(t.p || {}).sort().join(',');
          const torzs = JSON.stringify(t);
          for (const tilt of ['Migr', 'service', 'category', '2038420', 'employee']) if (torzs.includes(tilt)) hibak.push('a keresben tiltott mezo/szoveg: ' + tilt);
          info = `p: ${kulcsok}; kattintas: ${t.kattintas ? Object.keys(t.kattintas).join(',') : 'null'}`;
          if (cfg.api === 'elonezet') {
            if (!v1 || v1.ok !== true || v1.uj !== true) hibak.push('elonezeti valasz (elso): ' + JSON.stringify(v1));
            const w2 = p.waitForResponse((r) => /\/api\/mp-foglalas$/.test(r.url()), { timeout: 12000 }).catch(() => null);
            await p.reload({ waitUntil: 'load' });
            const v2 = await (await w2)?.json().catch(() => null);
            if (!v2 || v2.uj !== false) hibak.push('frissites: nem deduplikalt: ' + JSON.stringify(v2));
            info += `; valasz: ${JSON.stringify(v1)} -> ${JSON.stringify(v2)}`;
          }
        } catch (e) { hibak.push('hiba: ' + e.message.split('\n')[0]); }
        await ctx.close();
        ki.push(sor('QA-5', nezet, eset, hibak.length ? 'FAIL' : 'PASS', hibak.length ? hibak.join(' | ') + ' || ' + info : info));
      }
    }
    ki.push(sor('QA-5', nezet, 'motor -> koszonooldal booking_id-vel', 'MOTORFUGGO', 'valodi motoros foglalas kell hozza (elore nem tesztelheto; a fenti esetek a koszonooldal-cimmel szimulaljak)'));
  }
  return ki;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = beallitas(argumentumok());
  const b = await bongeszo();
  const r = await qa5(b, cfg);
  await b.close();
  console.table(r);
  process.exit(r.some((x) => x.eredmeny === 'FAIL') ? 1 : 0);
}
