// Kinyert oldal-blokkok tomor kiiratasa: node tools/dump.mjs <oldal> [kezdet] [darab]
import { readFile } from 'node:fs/promises';
const [name, from = 0, count = 500] = process.argv.slice(2);
const raw = JSON.parse(await readFile(`tools/content/${name}.json`, 'utf8'));
const arr = Array.isArray(raw) ? raw : (raw.blocks || []);

const ent = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&([a-zA-Z]+);/g, (m, n) => ({
    oacute:'ó',aacute:'á',eacute:'é',iacute:'í',uacute:'ú',uuml:'ü',ouml:'ö',
    Oacute:'Ó',Aacute:'Á',Eacute:'É',Iacute:'Í',Uacute:'Ú',Uuml:'Ü',Ouml:'Ö',
    udblac:'ű',odblac:'ő',Udblac:'Ű',Odblac:'Ő',lt:'<',gt:'>',hellip:'…',
    ndash:'–',mdash:'—',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',euro:'€',
  }[n] || m));

function flat(html) {
  return ent(html)
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
    .replace(/<(h[1-6])[^>]*>/gi, (m, t) => `[${t.toUpperCase()}] `)
    .replace(/<li[^>]*>/gi, '[LI] ')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>/gi, '[a:$1]')
    .replace(/<[^>]+>/g, '')
    .split('\n').map((s) => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n     ');
}

console.log(`# ${name} - ${arr.length} blokk`);
arr.slice(+from, +from + +count).forEach((x, i) => {
  const n = +from + i;
  if (x.t === 'text') console.log(`${n}|T| ${flat(x.html)}`);
  else if (x.t === 'img') console.log(`${n}|I| ${x.local || x.src} :: ${x.alt || ''}`);
  else if (x.t === 'link') console.log(`${n}|L| ${(x.label || '').trim()} -> ${x.href}`);
});
