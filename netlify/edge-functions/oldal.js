// Netlify edge-fuggveny: a Wix-szel azonos URL-ek (lasd utvonal.js).
import { utvonal } from './utvonal.js';

export default async (req, context) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  const url = new URL(req.url);
  const d = utvonal(decodeURIComponent(url.pathname), req.headers.get('user-agent'));
  if (!d) return;
  if (d.atiranyit) {
    return new Response(null, { status: 301, headers: { location: encodeURI(d.atiranyit) + url.search } });
  }
  const valasz = await context.rewrite(encodeURI(d.atir) + url.search);
  if (valasz.status === 404) return; // nincs ilyen oldal: a Netlify sajat 404-e
  const h = new Headers(valasz.headers);
  // ugyanaz a cim mobilon es asztalin mast ad - a gyorsitotar ezt tudja
  h.set('vary', 'User-Agent');
  return new Response(valasz.body, { status: valasz.status, headers: h });
};

export const config = { path: '/*', excludedPath: ['/assets/*', '/.netlify/*', '/_a/*', '/_m/*'] };
