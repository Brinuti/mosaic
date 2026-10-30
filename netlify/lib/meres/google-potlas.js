// UJ-63 / #502 (Mosaic HeadSpa, VAZLAT): KEZI, kulcs-listas potlas-vegpont a google-elo.js moduljahoz (az MP /api/mp-potlas mintaja). NINCS hatterbeli hivasi pont: csak ez a kulcsos POST hivhatja.
//   POST /api/mosaic-potlas   fejlec: x-egyeztetes-kulcs (CSAK fejlecben; kulcs nelkul / rossz kulccsal / mas metodussal 404)
//   torzs: { esemeny_idk: [legfeljebb 3 esemeny-azonosito], mod: 'dry' | 'eles' }
//   Kapuk: a globalis MOSAIC_GADS_ELO nem lehet 'ki'; a kert mod nem lehet erosebb a globalisnal; 'eles' csak ha elesKuldesE (engedely-jelzo + eles host). A valasz csak darabszamokat ad (kattintas / vendegadat nincs).
import { kulcsEllenorzes, valasz } from '../foglalas-kulcs.js';
import { eloMod, eloPotlas, elesKuldesE } from './google-elo.js';

export async function potlasVegpont({ request, env = {}, deps = {} }) {
  if (request.method !== 'POST' || !(await kulcsEllenorzes(request, env)) || !request.headers.get('x-egyeztetes-kulcs')) return valasz(404, { ok: false });
  if (!env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  let torzs; try { torzs = await request.json(); } catch (e) { return valasz(400, { ok: false, hiba: 'ervenytelen_json' }); }
  const idk = torzs && torzs.esemeny_idk;
  if (!Array.isArray(idk) || !idk.length || idk.length > 3 || idk.some((x) => typeof x !== 'string' || !/^[A-Za-z0-9_.:-]{3,80}$/.test(x))) return valasz(400, { ok: false, hiba: 'esemeny_idk: 1-3 azonosito' });
  if (new Set(idk).size !== idk.length) return valasz(400, { ok: false, hiba: 'esemeny_idk: ismetlodo elem' });
  const kert = torzs.mod;
  if (kert !== 'dry' && kert !== 'eles') return valasz(400, { ok: false, hiba: 'mod: dry | eles' });
  const globalis = eloMod(env);
  if (globalis === 'ki') return valasz(409, { ok: false, hiba: 'MOSAIC_GADS_ELO=ki' });
  const host = new URL(request.url).hostname;
  if (kert === 'eles' && !elesKuldesE(env, host)) return valasz(409, { ok: false, hiba: 'eles_kapu_zarva' });
  const r = await eloPotlas({ db: env.KULCS_DB, env: { ...env, MOSAIC_GADS_ELO: kert }, host: kert === 'eles' ? host : '', most: deps.most, fetchImpl: deps.fetchImpl || fetch, limit: 3, esemenyIdk: idk });
  return valasz(200, { ok: true, mod: kert, allapot: r.allapot, feldolgozva: r.feldolgozva || 0, eredmenyek: r.eredmenyek || {} });
}
