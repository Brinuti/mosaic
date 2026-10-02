// A Wix-oldalakba agyazott CSS ritkitasa (a netlify-build.mjs hivja oldalankent).
//
// A Wix minden oldalba bemasolta az osszes komponens stilusat (a nyitooldalon ~960 KB),
// a nagy resze olyan osztalyokra vonatkozik, amelyek az oldalon nincsenek. Ez lassitja az
// elso megjelenitest (a bongeszonek az egeszet fel kell dolgoznia).
//
// Ovatos szabaly: egy szelektort csak akkor hagyunk el, ha van benne olyan osztaly vagy
// azonosito, amely sem az oldal HTML-jeben, sem a sajat szkriptekben nem fordul elo
// semmilyen formaban (szokent). A zarojeles pszeudo-osztalyok (:not, :is, :has...) belsejet
// nem vesszuk figyelembe, az @font-face, @keyframes es tarsai valtozatlanok maradnak.
// Az azonos tartalmu <style> blokkokbol csak az elso marad meg.

const SZO = /[A-Za-z0-9_-]+/g;

// a szoveg minden "szava" (osztaly- es azonosito-jelolt)
export function szavak(...szovegek) {
  const s = new Set();
  for (const t of szovegek) for (const m of t.matchAll(SZO)) s.add(m[0]);
  return s;
}

// felso szintu darabolas egy elvalaszto menten (zarojelek, idezojelek figyelembevetelevel)
function darabol(t, jel) {
  const ki = [];
  let mely = 0, idez = null, eleje = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (idez) { if (c === '\\') i++; else if (c === idez) idez = null; continue; }
    if (c === '"' || c === "'") idez = c;
    else if (c === '(' || c === '[') mely++;
    else if (c === ')' || c === ']') mely--;
    else if (c === jel && mely === 0) { ki.push(t.slice(eleje, i)); eleje = i + 1; }
  }
  ki.push(t.slice(eleje));
  return ki;
}

// a szelektor kotelezo osztalyai/azonositoi; null, ha nem ertelmezheto (akkor megtartjuk)
function kotelezo(sel) {
  let s = '', mely = 0, idez = null;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (idez) { if (c === '\\') i++; else if (c === idez) idez = null; continue; }
    if (c === '"' || c === "'") { idez = c; continue; }
    if (c === '(' || c === '[') { mely++; continue; }
    if (c === ')' || c === ']') { mely--; continue; }
    if (mely === 0) s += c;
  }
  if (s.includes('\\')) return null;
  const ki = [...s.matchAll(/[.#](-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);
  // pontos egyezesu attributum a felso szinten, pl. [data-mesh-id=comp-xyzinlineContent]
  for (const m of sel.replace(/\([^()]*\)/g, '').matchAll(/\[[\w-]+="?([\w-]+)"?\]/g)) ki.push(m[1]);
  return ki;
}

function ritkitBlokk(css, van) {
  let ki = '', i = 0;
  const n = css.length;
  while (i < n) {
    // bevezeto resz a kovetkezo { vagy ; jelig (megjegyzesek es idezojelek atlepese)
    let j = i, idez = null, mely = 0;
    while (j < n) {
      const c = css[j];
      if (idez) { if (c === '\\') j++; else if (c === idez) idez = null; j++; continue; }
      if (c === '/' && css[j + 1] === '*') { const v = css.indexOf('*/', j + 2); j = v < 0 ? n : v + 2; continue; }
      if (c === '"' || c === "'") idez = c;
      else if (c === '(') mely++;
      else if (c === ')') mely--;
      else if (mely === 0 && (c === '{' || c === ';' || c === '}')) break;
      j++;
    }
    if (j >= n) { ki += css.slice(i); break; }
    if (css[j] !== '{') { ki += css.slice(i, j + 1); i = j + 1; continue; }
    // a hozza tartozo } megkeresese
    let k = j + 1, d = 1; idez = null;
    while (k < n && d > 0) {
      const c = css[k];
      if (idez) { if (c === '\\') k++; else if (c === idez) idez = null; k++; continue; }
      if (c === '/' && css[k + 1] === '*') { const v = css.indexOf('*/', k + 2); k = v < 0 ? n : v + 2; continue; }
      if (c === '"' || c === "'") idez = c;
      else if (c === '{') d++;
      else if (c === '}') d--;
      k++;
    }
    const elo = css.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const belso = css.slice(j + 1, k - 1);
    if (elo.startsWith('@')) {
      if (/^@(media|supports|container|layer|document)\b/i.test(elo)) {
        const r = ritkitBlokk(belso, van);
        if (r.trim()) ki += elo + '{' + r + '}';
      } else ki += elo + '{' + belso + '}';
    } else {
      const maradt = darabol(elo, ',').filter((sel) => {
        const kell = kotelezo(sel);
        return !kell || kell.every((x) => van.has(x));
      });
      if (maradt.length) ki += maradt.map((x) => x.trim()).join(',') + '{' + belso + '}';
    }
    i = k;
  }
  return ki;
}

export function ritkit(html, sajatJs) {
  const stilusNelkul = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const van = szavak(stilusNelkul, sajatJs);
  const latott = new Set();
  return html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (egesz, nyit, css, zar) => {
    if (latott.has(css)) return '';
    latott.add(css);
    return nyit + ritkitBlokk(css, van) + zar;
  });
}
