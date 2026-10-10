// QA-2 vegpontok: /api/meres-erkezes (a bongeszo irja: kattintasazonositok, UTM, sutik, hozzajarulas) es /api/meres-admin (kulcsos: naplo, vészkapcsolo, kulso szallito visszaigazolasa)
import { azonosEredet, kulcsEllenorzes, valasz } from '../foglalas-kulcs.js';
import { egyeztetoSorok, egyeztetoCsv } from './egyeztetes-sor.js';
import { erkezesMent, fuggoKuldesek, kapcsoloBeallit, kapcsolokOlvas, kuldesMegerosit, naploLeker } from './elosztas.js';
import { irasKi, irasKapcsolo, IRAS_KI_VALASZ } from './iras-kapcsolo.js';

/** POST /api/meres-erkezes (azonos eredet; a bongeszo nem ker valaszt a foglalas folyamataban: a hiba nem akaszthat meg semmit). A "ip" / "ua" a keresbol jon, nem a torzsbol. */
export async function kezelErkezes(request, env, deps = {}) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!azonosEredet(request)) return valasz(403, { ok: false, miert: 'csak azonos eredetrol' });
  if (await irasKi(env.KULCS_DB, env)) return valasz(503, IRAS_KI_VALASZ); // QA-4 veszkapcsolo: az uj erkezesi irasok leallnak
  const szoveg = await request.text();
  if (szoveg.length > 8000) return valasz(413, { ok: false, miert: 'tul nagy' });
  let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
  if (!o || typeof o !== 'object') return valasz(400, { ok: false, miert: 'nem objektum' });
  const ip = request.headers.get('cf-connecting-ip') || '';
  let r; try { r = await erkezesMent(env.KULCS_DB, { ...o, ua: request.headers.get('user-agent') || '', ip }, deps.now ? deps.now() : Date.now()); }
  catch (e) { return valasz(500, { ok: false, miert: 'adatbazis-hiba' }); } // fail-open: a hiba JSON-valasz, soha nem kivetel (a bongeszo nem var valaszt)
  return valasz(r.ok ? 200 : 422, r);
}

/** /api/meres-admin (kulcsos, mint a /api/foglalas-egyeztetes): GET ?source_id=.. (naplo) | ?fuggo=1 (kuldesre varo kerelmek) | ?kapcsolok=1 | ?egyeztetes=1&tol=<unix>&ig=<unix>[&uzletag=..][&formatum=csv][&utan=<booking_id>] (QA-5 foglalasonkenti egyeztetosor, csak olvas);  POST {muvelet:'kapcsolo'|'megerosit', ...} */
export async function kezelAdmin(request, env, deps = {}) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (!(await kulcsEllenorzes(request, env))) return valasz(404, { ok: false });
  const url = new URL(request.url);
  if (request.method === 'GET') {
    if (url.searchParams.get('kapcsolok') === '1') return valasz(200, { ok: true, kapcsolok: await kapcsolokOlvas(env.KULCS_DB) });
    if (url.searchParams.get('fuggo') === '1') return valasz(200, { ok: true, fuggo: await fuggoKuldesek(env.KULCS_DB) });
    if (url.searchParams.get('egyeztetes') === '1') {
      const q = url.searchParams;
      const r = await egyeztetoSorok(env.KULCS_DB, { tol: q.get('tol'), ig: q.get('ig'), uzletag: q.get('uzletag') || null, limit: q.get('limit'), utan: q.get('utan') || '' });
      if (!r.ok) return valasz(400, r);
      if (q.get('formatum') === 'csv') return new Response(egyeztetoCsv(r.sorok), { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store', 'x-kovetkezo': r.kovetkezo || '' } });
      return valasz(200, r);
    }
    const sid = url.searchParams.get('source_id') || '';
    if (!sid) return valasz(400, { ok: false, miert: 'source_id / fuggo / kapcsolok kell' });
    return valasz(200, { ok: true, ...(await naploLeker(env.KULCS_DB, sid)) });
  }
  if (request.method === 'POST') {
    const szoveg = await request.text(); if (szoveg.length > 20000) return valasz(413, { ok: false });
    let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
    const most = deps.now ? deps.now() : Date.now();
    if (o.muvelet === 'iras') return valasz(200, await irasKapcsolo(env.KULCS_DB, { be: o.be === true, ok: typeof o.ok === 'string' ? o.ok.slice(0, 200) : null }, most)); // QA-4: az UJ IRASOK veszkapcsoloja (be:false = leall)
    if (o.muvelet === 'kapcsolo') return valasz(200, await kapcsoloBeallit(env.KULCS_DB, { uzletag: o.uzletag || null, platform: o.platform || null, be: o.be === true, ok: typeof o.ok === 'string' ? o.ok.slice(0, 200) : null }, most));
    // ajandekkartya: a webhook-ut MANUALIS ujrajatszasa (pl. elonezeten, ahol a Stripe nem erte el a webhookot): ugyanaz a kod fut (arnyekMeres), a PaymentIntentet a Stripe-tol kerdezi; kulcsos, csak MERES_ELOSZTO=1 mellett kuld
    if (o.muvelet === 'ajandek_ujra') {
      if (!deps.ajandekUjra) return valasz(501, { ok: false, miert: 'nincs ajandek-ujrajatszas' });
      if (!/^pi_[A-Za-z0-9]{8,80}$/.test(String(o.pi || ''))) return valasz(400, { ok: false, miert: 'ervenytelen pi' });
      return valasz(200, { ok: true, allapot: await deps.ajandekUjra(env, o.pi, o.mod === 'atutalas' ? 'atutalas' : 'kartya', new Date(most)) });
    }
    if (o.muvelet === 'megerosit') return valasz(200, await kuldesMegerosit(env.KULCS_DB, { id: Number(o.id), allapot: o.allapot, http_status: o.http_status, valasz: o.valasz, kuldo: o.kuldo }, most));
    return valasz(400, { ok: false, miert: 'ismeretlen muvelet' });
  }
  return valasz(405, { ok: false });
}
