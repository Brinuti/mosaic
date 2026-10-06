// QA-2 vegpontok: /api/meres-erkezes (a bongeszo irja: kattintasazonositok, UTM, sutik, hozzajarulas) es /api/meres-admin (kulcsos: naplo, vészkapcsolo, kulso szallito visszaigazolasa)
import { azonosEredet, kulcsEllenorzes, valasz } from '../foglalas-kulcs.js';
import { erkezesMent, fuggoKuldesek, kapcsoloBeallit, kapcsolokOlvas, kuldesMegerosit, naploLeker } from './elosztas.js';

/** POST /api/meres-erkezes (azonos eredet; a bongeszo nem ker valaszt a foglalas folyamataban: a hiba nem akaszthat meg semmit). A "ip" / "ua" a keresbol jon, nem a torzsbol. */
export async function kezelErkezes(request, env, deps = {}) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!azonosEredet(request)) return valasz(403, { ok: false, miert: 'csak azonos eredetrol' });
  const szoveg = await request.text();
  if (szoveg.length > 8000) return valasz(413, { ok: false, miert: 'tul nagy' });
  let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
  if (!o || typeof o !== 'object') return valasz(400, { ok: false, miert: 'nem objektum' });
  const ip = request.headers.get('cf-connecting-ip') || '';
  const r = await erkezesMent(env.KULCS_DB, { ...o, ua: request.headers.get('user-agent') || '', ip }, deps.now ? deps.now() : Date.now());
  return valasz(r.ok ? 200 : 422, r);
}

/** /api/meres-admin (kulcsos, mint a /api/foglalas-egyeztetes): GET ?source_id=.. (naplo) | ?fuggo=1 (kuldesre varo kerelmek) | ?kapcsolok=1;  POST {muvelet:'kapcsolo'|'megerosit', ...} */
export async function kezelAdmin(request, env, deps = {}) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (!(await kulcsEllenorzes(request, env))) return valasz(404, { ok: false });
  const url = new URL(request.url);
  if (request.method === 'GET') {
    if (url.searchParams.get('kapcsolok') === '1') return valasz(200, { ok: true, kapcsolok: await kapcsolokOlvas(env.KULCS_DB) });
    if (url.searchParams.get('fuggo') === '1') return valasz(200, { ok: true, fuggo: await fuggoKuldesek(env.KULCS_DB) });
    const sid = url.searchParams.get('source_id') || '';
    if (!sid) return valasz(400, { ok: false, miert: 'source_id / fuggo / kapcsolok kell' });
    return valasz(200, { ok: true, ...(await naploLeker(env.KULCS_DB, sid)) });
  }
  if (request.method === 'POST') {
    const szoveg = await request.text(); if (szoveg.length > 20000) return valasz(413, { ok: false });
    let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
    const most = deps.now ? deps.now() : Date.now();
    if (o.muvelet === 'kapcsolo') return valasz(200, await kapcsoloBeallit(env.KULCS_DB, { uzletag: o.uzletag || null, platform: o.platform || null, be: o.be === true, ok: typeof o.ok === 'string' ? o.ok.slice(0, 200) : null }, most));
    if (o.muvelet === 'megerosit') return valasz(200, await kuldesMegerosit(env.KULCS_DB, { id: Number(o.id), allapot: o.allapot, http_status: o.http_status, valasz: o.valasz, kuldo: o.kuldo }, most));
    return valasz(400, { ok: false, miert: 'ismeretlen muvelet' });
  }
  return valasz(405, { ok: false });
}
