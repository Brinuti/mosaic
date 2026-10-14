// A Salonic foglalasi adatlapjanak stiluslapja (assets/salonic/mp.css): a Salonic-fiok "Egyedi CSS URL"-je erre mutat
// (https://www.medicalpiercing.hu/assets/salonic/mp.css, verziojel nelkul), ezert a bongeszo MINDIG ellenorizze (ETag, 304),
// hogy egy modositas azonnal megjelenjen - ne a gyorsitotarbol jojjon a regi stiluslap (Feri kerese, 2026-10-14: a Cloudflare-zona
// "Browser Cache TTL" beallitasa a statikus fajlt 4 orara tarolhatova tette; a zona-beallitast is atallitottuk, ez a masodik vedvonal).
// A functions/[[path]].js hivja; a dist/_routes.json-ben (tools/build.mjs) az /assets/salonic/ nincs kizarva a fuggvenybol.
export const SALONIC_ELOTAG = '/assets/salonic/';

export async function salonicFajl(request, assets) {
  const v = await assets.fetch(request);
  if (!v.ok && v.status !== 304) return v; // pl. 404: valtozatlanul
  const h = new Headers(v.headers);
  h.set('cache-control', 'no-cache');
  h.set('access-control-allow-origin', '*');
  return new Response(v.body, { status: v.status, statusText: v.statusText, headers: h });
}
