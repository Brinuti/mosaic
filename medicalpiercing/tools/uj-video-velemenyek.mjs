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
  tobb: 'Akik 2-3 piercinget szúrattak',
};
// a "tobb" sav (az oszi akcio oldala, a tulajdonos kerese, 2026-10-17: "az osszes testimonial videot nezd at, es tedd ide azokat, amelyikben azt mondja el
// valaki, hogy harom piercinget, vagy kettot szuratott"): a leiratok szerint ezekben mondja a vendeg, hogy 2 vagy 3 piercinget kapott (elol a harom piercinges);
// a 21-es es a 36-os vendeg masodik piercingje megerosito migren piercing
const TOBB = ['20', '02', '19', '31', '14', '34', '15', '36', '21'];
const TOBB_CIMKE = { '21': 'Migrén + megerősítő piercing', '36': 'Migrén + megerősítő piercing' };
const IK = (n) => `<svg class="ik" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const felirat = (kat) => `${kat.map((k) => NEV[k]).join(' + ')} piercing`;

for (const [kulcs, cim] of Object.entries(TEMAK)) {
  // a tema videoi: elol azok, amelyeknek ez a fo temaja, utana a tobbi (amelyekben szinten szoba kerul)
  const lista = kulcs === 'tobb' ? TOBB.map((nn) => VIDEOK.find(([n]) => n === nn)) : kulcs === 'mind' ? [...VIDEOK] : [...VIDEOK.filter(([, k]) => k[0] === kulcs), ...VIDEOK.filter(([, k]) => k[0] !== kulcs && k.includes(kulcs))];
  // a tervezett boritoju video(k) elol (a tulajdonos ellenorzi a probat)
  const tervElol = (nn) => (fs.existsSync(path.join(ROOT, `assets/img/uj-velemeny-${nn}-terv.webp`)) ? 0 : 1);
  lista.sort((a, b) => tervElol(a[0]) - tervElol(b[0]));
  for (const [nn] of lista) {
    for (const f of [`assets/video/uj-velemeny-${nn}.mp4`, `assets/img/uj-velemeny-${nn}.webp`]) if (!fs.existsSync(path.join(ROOT, f))) throw new Error(`hianyzik: ${f}`);
  }
  // tervezett borito (a tulajdonos kerese, 2026-10-16, 4. kor: a 09-es proba utan mind a 37; tools/uj-velemeny-borito.mjs): GPT-hatter + a video valodi
  // kepkockaja + a vendeg legerosebb mondata + alul a keresztneve ("Katinak így segített a migrén piercing");
  // a lejatszas-jel es a cimke a kepen van (vsav-terv: az oldal sajatja rejtett)
  const terv = (nn) => fs.existsSync(path.join(ROOT, `assets/img/uj-velemeny-${nn}-terv.webp`));
  const cimke = (nn, kat) => (kulcs === 'tobb' && TOBB_CIMKE[nn]) || felirat(kat);
  const elemek = lista.map(([nn, kat]) => `      <li class="vsav-elem"><button type="button" class="vsav-gomb${terv(nn) ? ' vsav-terv' : ''}" data-vsav-video="/assets/video/uj-velemeny-${nn}.mp4" aria-label="Videó lejátszása: ${cimke(nn, kat)}"><img src="/assets/img/uj-velemeny-${nn}${terv(nn) ? '-terv' : ''}.webp" alt="" width="540" height="960" loading="lazy" decoding="async"><span class="lejatszo">${IK('play')}</span><span class="vsav-cimke">${cimke(nn, kat)}</span></button></li>`);
  const alcim = kulcs === 'tobb' ? `${lista.length} vendégünk mesél arról, hogyan hatott nála több piercing együtt` : kulcs === 'mind' ? `${lista.length} vendégünk mesél a tapasztalatairól` : lista.length > 1 ? `${lista.length} videós beszámoló` : '';
  const html = `  <!-- a vendegek videos beszamoloi (${kulcs}): tools/uj-video-velemenyek.mjs (ne kezzel szerkeszd) -->
  <section class="tarto" id="videok-${kulcs}"><div class="kat-doboz vsav-doboz">
    <h2>${cim}</h2>
    ${alcim ? `<p class="vsav-alcim">${alcim}</p>` : ''}
    <div class="vsav${lista.length < 4 ? ' vsav-keves' : ''}" data-vsav>
      <button type="button" class="vsav-nyil vsav-elozo" aria-label="Előző videók">${IK('chev')}</button>
      <ul class="vsav-sav">
${elemek.join('\n')}
      </ul>
      <button type="button" class="vsav-nyil vsav-kov" aria-label="Következő videók">${IK('chev')}</button>
    </div>
    <p class="velemeny-osszes"><a class="szoveg-link" href="/migren-shenmen-piercing-velemenyek">Tovább az összes véleményhez »</a></p>
  </div></section>
`;
  fs.writeFileSync(path.join(ROOT, `uj-oldalak/reszek/video-velemeny-${kulcs}.html`), html);
  console.log(`${kulcs}: ${lista.length} video`);
}
