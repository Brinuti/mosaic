// A Pages Functions vegpontok kozos burka: a belso hiba SOHA nem tartalmaz kerest, cookie-t, UUID-t vagy vendegadatot (csak a vegpont neve + rovid hibauzenet).
export const burok = (nev, fn) => async (context) => {
  try {
    return await fn({ request: context.request, env: context.env });
  } catch (e) {
    console.error(`${nev}: belso hiba`, String((e && e.message) || e).slice(0, 120));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store' } });
  }
};
