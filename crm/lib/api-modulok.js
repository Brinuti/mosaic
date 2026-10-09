// Opcionalis modulok (masik fejleszto irja: motor, ingest, merok, demo, dashboard): hianyuk NEM hiba, hanem 501.
// FIGYELEM: literal import()-ok, LEXIKALISAN try/catch-ben (a csomagolo/esbuild igy a hianyzo modult csak figyelmeztetesnek veszi, nem buildhibanak).
import { ApiHiba } from './http.js';

const hianyzik = (e, nev) => (e?.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes(`${nev}.js`)) || /Failed to resolve|Could not resolve|No such module/i.test(String(e?.message));
const BETOLTOK = {
  async motor() { try { return await import('./motor.js'); } catch (e) { if (hianyzik(e, 'motor')) return null; throw e; } },
  async ingest() { try { return await import('./ingest.js'); } catch (e) { if (hianyzik(e, 'ingest')) return null; throw e; } },
  async merok() { try { return await import('./merok.js'); } catch (e) { if (hianyzik(e, 'merok')) return null; throw e; } },
  async demo() { try { return await import('./demo.js'); } catch (e) { if (hianyzik(e, 'demo')) return null; throw e; } },
  async dashboard() { try { return await import('./dashboard.js'); } catch (e) { if (hianyzik(e, 'dashboard')) return null; throw e; } },
};
const gyorsitotar = new Map();

/** a nev szerinti opcionalis modul, vagy null ha (meg) nincs meg */
export async function opcionalisModul(nev) {
  if (gyorsitotar.has(nev)) return gyorsitotar.get(nev);
  const m = await BETOLTOK[nev]();
  if (m) gyorsitotar.set(nev, m);
  return m;
}
/** opcionalis modul fuggvenye (az elso letezo nev), vagy 501 (a modul hianyzik / nem tartalmazza a fuggvenyt) */
export async function modulFuggveny(modulNev, nevek) {
  const m = await opcionalisModul(modulNev);
  if (!m) throw new ApiHiba('MODUL_HIANYZIK', `Ez a funkció még nem érhető el (a(z) ${modulNev} modul nincs telepítve).`, 501);
  const f = nevek.map((n) => m[n]).find((x) => typeof x === 'function');
  if (!f) throw new ApiHiba('FUGGVENY_HIANYZIK', `Ez a funkció még nem érhető el (a(z) ${modulNev} modul nem tartalmazza: ${nevek[0]}).`, 501);
  return f;
}
export const MODULOK = Object.freeze(Object.keys(BETOLTOK));
