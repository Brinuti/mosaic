// A vendégek videós beszámolói piercing-típusonként (a tulajdonos Drive-járól, 2026-10-16): közös részek a Vélemények oldalra és a piercing-oldalakra.
// A videók webes változata: assets/video/uj-velemeny-<kulcs>-<n>.mp4 (480 px széles, H.264), a borítókép: assets/img/uj-velemeny-<kulcs>-<n>.webp.
// A besorolás a videók leirata alapján készült (mit mond a vendég: migrén / shenmen / slim / klimax). A fájlnevekben nincs vendégnév.
//
//   node tools/uj-video-velemenyek.mjs   ->  uj-oldalak/reszek/video-velemeny-<kulcs>.html
import fs from 'node:fs';
import path from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;

export const VIDEO_VELEMENYEK = {
  migren: { db: 6, cim: 'Vendégeink a migrén piercingről' },
  shenmen: { db: 2, cim: 'Vendégeink a shenmen piercingről' },
  slim: { db: 3, cim: 'Vendégeink a slim piercingről' },
  klimax: { db: 1, cim: 'Vendégünk a klimax piercingről' },
};

for (const [kulcs, { db, cim }] of Object.entries(VIDEO_VELEMENYEK)) {
  const elemek = [];
  for (let n = 1; n <= db; n++) {
    const video = `/assets/video/uj-velemeny-${kulcs}-${n}.mp4`, kep = `/assets/img/uj-velemeny-${kulcs}-${n}.webp`;
    if (!fs.existsSync(path.join(ROOT, video)) || !fs.existsSync(path.join(ROOT, kep))) throw new Error(`hianyzik: ${video} vagy ${kep}`);
    elemek.push(`      <li><video src="${video}" poster="${kep}" controls preload="none" playsinline></video></li>`);
  }
  const html = `  <!-- a vendegek videos beszamoloi (${kulcs}): tools/uj-video-velemenyek.mjs -->
  <section class="tarto"><div class="kat-doboz kat-videok kat-video-velemeny${db < 3 ? ' kat-video-keves' : ''}">
    <p class="felirat"><svg class="ik" aria-hidden="true"><use href="#i-play"/></svg>Videós beszámolók</p>
    <h2>${cim}</h2>
    <ul class="kat-video-racs">
${elemek.join('\n')}
    </ul>
  </div></section>
`;
  fs.writeFileSync(path.join(ROOT, `uj-oldalak/reszek/video-velemeny-${kulcs}.html`), html);
  console.log(`${kulcs}: ${db} video`);
}
