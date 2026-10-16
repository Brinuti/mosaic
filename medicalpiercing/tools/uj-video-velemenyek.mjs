// A vendegek videos beszamoloi (a tulajdonos Drive-janak "Testimonial videok" mappajabol, 2026-10-16: mind a 37 vendeg-video; egy, a "Slim hirdetes"
// ugyanannak a videonak a vagott valtozata volt). A webes valtozat: assets/video/uj-velemeny-<nn>.mp4 (480 px szeles, H.264), a boritokep:
// assets/img/uj-velemeny-<nn>.webp. A besorolas a videok leirata alapjan keszult (mirol beszel a vendeg); egy video tobb piercingrol is szolhat.
// A fajlnevekben nincs vendegnev. A blokk: lapozhato sav (vsav: assets/js/uj-fooldal.js 4e., assets/css/uj-fooldal.css), csak a boritokep
// toltodik (lustan), a video kattintasra indul helyben.
//
//   node tools/uj-video-velemenyek.mjs   ->  uj-oldalak/reszek/video-velemeny-<kulcs>.html  (migren, shenmen, klimax, slim, allergia, mind)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;

// sorszam -> a piercingek, amelyekrol a vendeg beszel (az elso a fo tema); a sorrend a "mind" sav sorrendje (vegyesen a temak)
export const VIDEOK = [
  ['01', ['migren']], ['02', ['slim', 'klimax']], ['03', ['shenmen']], ['04', ['klimax']], ['05', ['migren']], ['06', ['slim']], ['07', ['shenmen']],
  ['08', ['klimax']], ['09', ['migren']], ['10', ['slim']], ['11', ['shenmen', 'allergia']], ['12', ['klimax']], ['13', ['migren']], ['14', ['shenmen', 'slim']],
  ['15', ['klimax', 'migren']], ['16', ['slim']], ['17', ['migren']], ['18', ['shenmen']], ['19', ['klimax', 'shenmen']], ['20', ['migren', 'shenmen', 'slim']],
  ['21', ['migren']], ['22', ['shenmen']], ['23', ['klimax']], ['24', ['slim']], ['25', ['migren']], ['26', ['shenmen']], ['27', ['slim', 'klimax']],
  ['28', ['migren']], ['29', ['migren']], ['30', ['shenmen']], ['31', ['klimax', 'slim']], ['32', ['migren']], ['33', ['migren']], ['34', ['migren', 'shenmen']],
  ['35', ['migren']], ['36', ['migren']], ['37', ['migren']],
];
const NEV = { migren: 'Migrén', shenmen: 'Shenmen', klimax: 'Klimax', slim: 'Slim', allergia: 'Allergia' };
export const TEMAK = {
  migren: 'Vendégeink a migrén piercingről',
  shenmen: 'Vendégeink a shenmen piercingről',
  klimax: 'Vendégeink a klimax piercingről',
  slim: 'Vendégeink a slim piercingről',
  allergia: 'Vendégünk az allergiáról',
  mind: 'Vendégeink videón',
};
const IK = (n) => `<svg class="ik" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const felirat = (kat) => `${kat.map((k) => NEV[k]).join(' + ')} piercing`;

for (const [kulcs, cim] of Object.entries(TEMAK)) {
  // a tema videoi: elol azok, amelyeknek ez a fo temaja, utana a tobbi (amelyekben szinten szoba kerul)
  const lista = kulcs === 'mind' ? VIDEOK : [...VIDEOK.filter(([, k]) => k[0] === kulcs), ...VIDEOK.filter(([, k]) => k[0] !== kulcs && k.includes(kulcs))];
  for (const [nn] of lista) {
    for (const f of [`assets/video/uj-velemeny-${nn}.mp4`, `assets/img/uj-velemeny-${nn}.webp`]) if (!fs.existsSync(path.join(ROOT, f))) throw new Error(`hianyzik: ${f}`);
  }
  const elemek = lista.map(([nn, kat]) => `      <li class="vsav-elem"><button type="button" class="vsav-gomb" data-vsav-video="/assets/video/uj-velemeny-${nn}.mp4" aria-label="Videó lejátszása: ${felirat(kat)}"><img src="/assets/img/uj-velemeny-${nn}.webp" alt="" width="540" height="960" loading="lazy" decoding="async"><span class="lejatszo">${IK('play')}</span><span class="vsav-cimke">${felirat(kat)}</span></button></li>`);
  const alcim = kulcs === 'mind' ? `${lista.length} vendégünk mesél a tapasztalatairól` : lista.length > 1 ? `${lista.length} videós beszámoló` : '';
  const html = `  <!-- a vendegek videos beszamoloi (${kulcs}): tools/uj-video-velemenyek.mjs (ne kezzel szerkeszd) -->
  <section class="tarto"><div class="kat-doboz vsav-doboz">
    <h2>${cim}</h2>
    ${alcim ? `<p class="vsav-alcim">${alcim}</p>` : ''}
    <div class="vsav${lista.length < 4 ? ' vsav-keves' : ''}" data-vsav>
      <button type="button" class="vsav-nyil vsav-elozo" aria-label="Előző videók">${IK('chev')}</button>
      <ul class="vsav-sav">
${elemek.join('\n')}
      </ul>
      <button type="button" class="vsav-nyil vsav-kov" aria-label="Következő videók">${IK('chev')}</button>
    </div>
  </div></section>
`;
  fs.writeFileSync(path.join(ROOT, `uj-oldalak/reszek/video-velemeny-${kulcs}.html`), html);
  console.log(`${kulcs}: ${lista.length} video`);
}
