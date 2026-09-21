// Wix rich-text blokk -> tiszta, sajat stilusu HTML
const PAGES = new Set([
  'headspa-budapest','paros-headspa-budapest','headspa-ferfiaknak','headspa-arak-budapest',
  'head-spa-kedvezmeny','head-spa-velemenyek','headspa-termekek-oxygeni',
  'lezeres-szortelenites-budapest','noi-fodraszat-budapest',
  'noi-fodrasz-budapest-balayage-hajfestes','balayage-haj-festes-budapest',
  'noi-hajfestes-budapest','oxigenterapia-budapest','sminktetovalas-budapest',
  'headspa-ajandekkartya','4-kezes-headspa-ajandekkartya','idpontfoglalas','aszf','impresszum',
]);

export function localHref(href = '') {
  const m = href.match(/^https?:\/\/(?:www\.)?mosaicheadspa\.hu\/?([^?#]*)([?#].*)?$/i);
  if (!m) return href;
  const slug = (m[1] || '').replace(/\/$/, '');
  const hash = m[2] || '';
  if (!slug) return 'index.html' + hash;
  return (PAGES.has(slug) ? slug + '.html' : '/' + slug) + hash;
}

export function clean(html = '') {
  let s = html
    .replace(/\s(?:data-auto-recognition|data-testid|dir|class)="[^"]*"/gi, '')
    .replace(/\sstyle="[^"]*"/gi, '')
    .replace(/<span>\s*<\/span>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<h[1-6]>\s*<\/h[1-6]>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '');

  s = s.replace(/<a\s+([^>]*?)href="([^"]*)"([^>]*)>/gi, (m, a, href, b) => {
    const to = localHref(href);
    const ext = /^https?:/i.test(to);
    const rest = (a + b).replace(/\starget="[^"]*"/gi, '').replace(/\srel="[^"]*"/gi, '').trim();
    return `<a href="${to}"${rest ? ' ' + rest : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>`;
  });

  return s.replace(/\s{2,}/g, ' ').replace(/>\s+</g, '>\n<').trim();
}
