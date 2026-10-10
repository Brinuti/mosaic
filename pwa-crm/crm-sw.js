// MOSAIC CRM service worker: csak a Megosztas-celpontot kezeli (Androidon a Galeria "Megosztas" -> MOSAIC CRM).
// A kapott kepeket a bongeszo Cache Storage-aba teszi (vendeg nelkul), majd a CRM oldalra iranyit, ami - a belepett munkatars nevében - feltolti a kep-beerkezobe.
// Nem tarol oldalt, nem gyorsitotaraz, a halozati kereseket nem erinti (minden mas kereres valtozatlanul a halozatra megy).
const CACHE = 'crm-megosztas';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'POST' || url.pathname !== '/crm-megosztas') return;
  event.respondWith((async () => {
    try {
      const adat = await req.formData();
      const cache = await caches.open(CACHE);
      let i = Date.now();
      for (const f of adat.getAll('kep')) {
        if (!f || !f.size || !/^image\//.test(f.type || '')) continue;
        await cache.put(`/__megosztott/${i++}`, new Response(f, { headers: { 'content-type': f.type } }));
      }
    } catch { /* hibas kuldes: az oldal ures beerkezot mutat */ }
    return Response.redirect(new URL('/crm#/kepkuldo', self.location.origin).href, 303);
  })());
});
