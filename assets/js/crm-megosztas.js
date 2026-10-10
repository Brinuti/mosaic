// A Megosztas-celpont (crm-sw.js) altal a Cache Storage-ba tett, vendeg nelkuli kepek atvetele; a feltoltest a belepett munkatars nevében a kepkuldo nezet vegzi.
const CACHE = 'crm-megosztas';

export function swRegisztral() {
  try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/crm-sw.js', { scope: '/crm' }).catch(() => {}); } catch { /* nincs service worker */ }
}
export async function varakozoMegosztasok() {
  try { if (!('caches' in self)) return []; return await (await caches.open(CACHE)).keys(); } catch { return []; }
}
export async function megosztottBlob(kereses) {
  const c = await caches.open(CACHE); const v = await c.match(kereses); return v ? v.blob() : null;
}
export async function megosztottTorol(kereses) {
  try { await (await caches.open(CACHE)).delete(kereses); } catch { /* mar nincs */ }
}
