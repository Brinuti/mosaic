// QA-1: a 0%-os kapcsoloallasnal minden uj ES korabban kiosztott latogato a regi Salonic-utat kapja.
//
// A kapcsolo modja parameter (a Mosaic ELESITESI_TERV.md mintajara: build-ideju kapcsolo + felulirhato):
//   --kapcsolo-mod query|cookie|localstorage|nincs   (nincs: az elonezet mar 0%-ra van epitve)
//   --kapcsolo-nev mp_motor  --kapcsolo-ertek 0
// A "korabban kiosztott" latogatot a kiosztas taroloval szimulaljuk:
//   --kiosztas-kulcs mp_motor_csoport  --kiosztas-motor motor,uj,B,1  --kiosztas-regi regi  --kiosztas-tarolo mindketto
// Ellenorzes oldalankent (--oldalak): van lathato Salonic-gomb; az elsore kattintva a Salonic nyilik (csonk),
// a motor felulete (--motor-jel) nem jelenik meg, motor-API (--motor-api) nem hivodik, es 0%-nal senki nem kap
// motoros kiosztast (a kulcsba nem irodik motor-ertek).
//   node medicalpiercing/qa/qa1-kapcsolo.mjs --url https://<ag>.medicalpiercing.pages.dev [--nezet mobil]
import { argumentumok, beallitas, kontextus, playwright, salonicLinkek, motorLathato, varj, sor } from './kozos.mjs';

export async function qa1(b, cfg) {
  const ki = [];
  const latogatok = [{ nev: 'uj latogato', ertek: null }, ...cfg.kiosztas.motor.map((v) => ({ nev: `korabban motorra kiosztott (${v})`, ertek: v })), { nev: `korabban regi utra kiosztott (${cfg.kiosztas.regi})`, ertek: cfg.kiosztas.regi }];
  for (const nezet of cfg.nezetek) {
    for (const l of latogatok) {
      const { ctx, naplo, cim } = await kontextus(b, cfg, nezet, { hozzajarulas: true, kiosztas: l.ertek });
      const hibak = [];
      const reszlet = [];
      try {
        for (const oldal of cfg.oldalak) {
          const p = await ctx.newPage();
          await p.goto(cim(oldal), { waitUntil: 'load' });
          await varj(2500);
          const linkek = salonicLinkek(p);
          const db = await linkek.count();
          const motorElotte = await motorLathato(p, cfg);
          if (!db) { hibak.push(`${oldal}: nincs lathato Salonic-gomb`); await p.close(); continue; }
          const i = naplo.length;
          const kezdoUrl = p.url();
          const felugro = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
          await linkek.first().click();
          const uj = await felugro;
          await varj(2500);
          const utana = naplo.slice(i);
          const salonicNav = utana.filter((s) => s.tipus === 'salonic' && s.navig).length;
          const motorApi = naplo.filter((s) => s.tipus === 'sajat-api' && cfg.motorApi.test(s.url));
          const motorUtana = p.isClosed() ? 0 : await motorLathato(p, cfg);
          const iras = p.isClosed() ? [] : await p.evaluate(() => (window.__qa && window.__qa.irasok) || []).catch(() => []);
          const motorIras = iras.filter((x) => cfg.kiosztas.motor.some((m) => x.v === m || x.v.endsWith('=' + m)));
          const atment = salonicNav > 0 || /salonic\.hu/.test((uj && uj.url()) || '') || /salonic\.hu/.test(p.isClosed() ? '' : p.url());
          reszlet.push(`${oldal}: ${db} Salonic-gomb, ${atment ? 'Salonic nyilt' : 'NEM a Salonic nyilt'}${uj ? ' (uj lapon)' : ''}`);
          if (!atment) hibak.push(`${oldal}: a gomb nem a Salonicra vitt (${p.isClosed() ? '-' : p.url()} <- ${kezdoUrl})`);
          if (motorElotte || motorUtana) hibak.push(`${oldal}: motor-felulet lathato (${motorElotte}/${motorUtana})`);
          if (motorApi.length) hibak.push(`${oldal}: motor-API hivas: ${motorApi.map((s) => s.url).join(', ')}`);
          if (motorIras.length) hibak.push(`${oldal}: motoros kiosztas irodott: ${motorIras.map((x) => x.v).join(', ')}`);
          if (uj) await uj.close().catch(() => {});
          if (!p.isClosed()) await p.close();
        }
      } catch (e) { hibak.push('hiba: ' + e.message.split('\n')[0]); }
      await ctx.close();
      ki.push(sor('QA-1', nezet, l.nev, hibak.length ? 'FAIL' : 'PASS', hibak.length ? hibak.join(' | ') : reszlet.join('; ')));
    }
  }
  return ki;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = beallitas(argumentumok());
  const b = await playwright().chromium.launch();
  const r = await qa1(b, cfg);
  await b.close();
  console.table(r);
  process.exit(r.some((x) => x.eredmeny === 'FAIL') ? 1 : 0);
}
