// A helyszin-valaszto mini terkep-ikonjai: Magyarorszag korvonala, a kivalasztott varos pontosan (foldrajzi koordinataval) megjelolve.
// Programozottan keszul (SVG), igy a pont mindig a valodi helyen van, a fajlok pici (~1 KB), es a szinek a motor szinei.
//
//   node tools/helyszin-ikonok.mjs          ->  assets/img/helyszin/<place_id>.svg  (15 db)
//
// A korvonal a johan/world.geo.json (HUN) egyszerusitett hatara, lent beepitve (nincs halozati fuggoseg).
import fs from 'node:fs';
import path from 'node:path';
const KI = new URL('../assets/img/helyszin/', import.meta.url).pathname;

const HATAR = [[16.202298, 46.852386], [16.534268, 47.496171], [16.340584, 47.712902], [16.903754, 47.714866], [16.979667, 48.123497], [17.488473, 47.867466], [17.857133, 47.758429], [18.696513, 47.880954], [18.777025, 48.081768], [19.174365, 48.111379], [19.661364, 48.266615], [19.769471, 48.202691], [20.239054, 48.327567], [20.473562, 48.56285], [20.801294, 48.623854], [21.872236, 48.319971], [22.085608, 48.422264], [22.64082, 48.15024], [22.710531, 47.882194], [22.099768, 47.672439], [21.626515, 46.994238], [21.021952, 46.316088], [20.220192, 46.127469], [19.596045, 46.17173], [18.829838, 45.908878], [18.456062, 45.759481], [17.630066, 45.951769], [16.882515, 46.380632], [16.564808, 46.503751], [16.370505, 46.841327]];
// place_id -> [varos, szelesseg, hosszusag]
const VAROSOK = {
  6029: ['Budapest', 47.4979, 19.0402], 11424: ['Debrecen', 47.5316, 21.6273], 13422: ['Békéscsaba', 46.6735, 21.0877], 14144: ['Kaposvár', 46.3594, 17.7968],
  10330: ['Kecskemét', 46.8964, 19.6897], 10329: ['Keszthely', 46.7684, 17.2427], 10357: ['Miskolc', 48.1035, 20.7784], 12348: ['Nagykanizsa', 46.459, 16.9897],
  12353: ['Nyíregyháza', 47.9495, 21.7244], 12236: ['Pécs', 46.0727, 18.2323], 9067: ['Sopron', 47.6817, 16.5845], 12169: ['Szeged', 46.253, 20.1414],
  14145: ['Székesfehérvár', 47.186, 18.4221], 14229: ['Szombathely', 47.2307, 16.6218], 12237: ['Zalaegerszeg', 46.8417, 16.8416],
};
const SZIN = { tolt: '#f2dfdb', vonal: '#d7aba8', pont: '#ab6354', gyuru: '#ffffff' };

// egyenteru (equirectangular) vetites a 47 fok szelessegen: x = (lon - lon0) * cos(47 fok), y = (lat1 - lat)
const K = Math.cos((47.2 * Math.PI) / 180);
const lon0 = Math.min(...HATAR.map((p) => p[0])), lon1 = Math.max(...HATAR.map((p) => p[0]));
const lat0 = Math.min(...HATAR.map((p) => p[1])), lat1 = Math.max(...HATAR.map((p) => p[1]));
const SK = 100 / ((lon1 - lon0) * K); // 100 egyseg szeles
const W = 100, H = Math.round((lat1 - lat0) * SK * 10) / 10, P = 14; // P: a pont (gyuru) miatti szel
const px = (lon) => Math.round((P + (lon - lon0) * K * SK) * 10) / 10;
const py = (lat) => Math.round((P + (lat1 - lat) * SK) * 10) / 10;
const ut = HATAR.map(([lo, la], i) => `${i ? 'L' : 'M'}${px(lo)} ${py(la)}`).join('') + 'Z';

fs.mkdirSync(KI, { recursive: true });
for (const [id, [varos, la, lo]] of Object.entries(VAROSOK)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 2 * P} ${H + 2 * P}" width="${W + 2 * P}" height="${H + 2 * P}" role="img" aria-label="${varos} a térképen"><path d="${ut}" fill="${SZIN.tolt}" stroke="${SZIN.vonal}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="${px(lo)}" cy="${py(la)}" r="13" fill="${SZIN.pont}" fill-opacity=".22"/><circle cx="${px(lo)}" cy="${py(la)}" r="7.6" fill="${SZIN.pont}" stroke="${SZIN.gyuru}" stroke-width="2.6"/></svg>\n`;
  fs.writeFileSync(path.join(KI, `${id}.svg`), svg);
}
console.log(`${Object.keys(VAROSOK).length} ikon: ${KI}`);
