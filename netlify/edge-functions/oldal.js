// Netlify edge-fuggveny: a Wix-szel azonos URL-ek (lasd netlify/lib/utvonal.js).
// A segedmodul szandekosan nincs az edge-functions mappaban: ott minden fajl
// kulon edge-fuggvenynek szamit.
import { utvonal } from '../lib/utvonal.js';

// Az eles domain. Minden mas host (mosaicheadspa.netlify.app, deploy-preview-...)
// probacim: noindex + mindent tilto robots.txt, akkor is, ha az ELES=1 build
// mar az indexelheto valtozatot publikalja.
const ELES_HOST = /^(www\.)?mosaicheadspa\.hu$/;
const TILTO_ROBOTS = 'User-agent: *\nDisallow: /\n';

export default async (req, context) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  const url = new URL(req.url);
  const eles = ELES_HOST.test(url.hostname);
  if (!eles && url.pathname === '/robots.txt') {
    return new Response(TILTO_ROBOTS, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
  }
  const d = utvonal(decodeURIComponent(url.pathname), req.headers.get('user-agent'));
  if (!d) return;
  if (d.atiranyit) {
    return new Response(null, { status: 301, headers: { location: encodeURI(d.atiranyit) + url.search } });
  }
  const cel = new URL(encodeURI(d.atir) + url.search, req.url);
  // context.rewrite: a valaszhoz hozzaadhatjuk a Vary fejlecet; ha nincs, sima atiras
  if (typeof context.rewrite !== 'function') return cel;
  const valasz = await context.rewrite(cel);
  if (valasz.status === 404) return; // nincs ilyen oldal: a Netlify sajat 404-e
  const h = new Headers(valasz.headers);
  // ugyanaz a cim mobilon es asztalin mast ad - a gyorsitotar ezt tudja
  h.set('vary', 'User-Agent');
  if (!eles) h.set('x-robots-tag', 'noindex, nofollow');
  return new Response(valasz.body, { status: valasz.status, headers: h });
};

export const config = { path: '/*', excludedPath: ['/assets/*', '/.netlify/*', '/_a/*', '/_m/*'] };
