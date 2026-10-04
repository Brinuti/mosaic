// Netlify "ignore" parancs (netlify.toml): eldonti, kell-e uj eles deploy.
// Kilepesi kod: 0 = a build kimarad, 1 = a build lefut.
//
// Minden eles deploy kreditbe kerul, ezert csak akkor epitunk, ha a legutobb
// publikalt allapot ota olyan fajl valtozott, ami bekerul a kiszolgalt oldalba.
// Ha csak dokumentacio, mentes vagy segedeszkoz valtozott, a deploy kimarad.
// Ha barmi bizonytalan (elso build, hianyzo commit, hiba), a build lefut.
//
// A Netlify sajat kapcsoloja is mukodik: [skip netlify] a commit-uzenetben.
import { execFileSync } from 'node:child_process';

const OLDALBA_KERUL = [
  /^klon\//, /^assets\//, /^netlify\//, /^foglalas\//, /^salonic\//,
  /^netlify\.toml$/, /^package(-lock)?\.json$/, /^sitemap\.xml$/, /^robots\.txt$/,
  /^tools\/netlify-build\.mjs$/, /^tools\/foglalo-atkotes\.(mjs|json)$/, /^tools\/css-ritkitas\.mjs$/, /^tools\/fejlec-kivonat\.mjs$/,
  /^tools\/lcp-elofeltoltes\.json$/, /^tools\/wix-sitemap\//,
];

const { CONTEXT, CACHED_COMMIT_REF: elozo, COMMIT_REF: most } = process.env;
const epit = (miert) => { console.log('Netlify-build: LEFUT - ' + miert); process.exit(1); };
const kihagy = (miert) => { console.log('Netlify-build: KIMARAD - ' + miert); process.exit(0); };

// az elonezetek (deploy-preview) nem eles deployok, azokat nem korlatozzuk
if (CONTEXT !== 'production') epit(`${CONTEXT} kornyezet`);
if (!elozo || !most || elozo === most) epit('nincs mihez hasonlitani');

let valtozott;
try {
  valtozott = execFileSync('git', ['diff', '--name-only', elozo, most], { encoding: 'utf8' })
    .split('\n').filter(Boolean);
} catch {
  epit('a git diff nem futott le');
}
const lenyeges = valtozott.filter((f) => OLDALBA_KERUL.some((r) => r.test(f)));
if (lenyeges.length) epit(`${lenyeges.length} oldalba kerulo fajl valtozott (pl. ${lenyeges[0]})`);
kihagy(`csak az oldalba nem kerulo fajlok valtoztak (${valtozott.length} db)`);
