// UJ-11 (#167 6321101806): Google ARNYEK feltoltes VALASZ-NAPLO. A Google-feltoltest egy Zapier-webhook vegzi (platformok.js, GOOGLE_ARNYEK_WEBHOOK_URL); a Zap a Google Ads lepese
// UTAN egy masodik lepesben (Webhooks POST) visszahivja ezt a vegpontot a feltoltes eredmenyevel (partialFailure kod / uzenet, elfogadott / elutasitott darab, vagy ZAP_HIBA).
//   POST /api/meres-google-valasz  fejlec: x-meres-google-kulcs (a kulcs SHA-256-ja a MERES_GOOGLE_VALASZ_KULCS_HASH env-ben; kulcs nelkul / rossz kulccsal 404)
//   torzs: { esemeny_id (= a Zap order_id-ja) | id (meres_kuldes.id), kod, uzenet?, elfogadva?, elutasitva? }   kod: '' = a Google elfogadta; egyebkent rovid kod (CONSENT_DENIED, UNPARSEABLE_GCLID, EXPIRED, ZAP_HIBA ...)
// Csak a meres_kuldes MEGLEVO google sorat egesziti ki (google_reszleges_hiba + a platform_valasz vegere maszkolt uzenet); uj sort nem hoz letre, mast nem ir. Az ELSO visszajelzes marad (ujrajatszas nem irja felul).
// A kuldeskori ad_user_data a kuldeskor kerul a sorba (elosztas.js). Nincs click ID / gclid / e-mail-hash / vendegadat a naploban: az uzenet maszkolt, hossza korlatozott.
import { valasz } from '../foglalas-kulcs.js';
import { valaszMaszk } from './platformok.js';
import { meresSema } from './elosztas.js';

const KOD_MINTA = /^[A-Z][A-Z0-9_]{0,39}$/;
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function kulcsEgyezik(request, env) {
  const hash = env && env.MERES_GOOGLE_VALASZ_KULCS_HASH;
  const adott = request.headers.get('x-meres-google-kulcs') || ''; // CSAK fejlecben (a query-kulcs naplokba kerulhet)
  if (!hash || !adott) return false;
  const a = await sha256hex(adott); let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return d === 0 && a.length === hash.length;
}
// a Google / Zap uzenetbol kiszedjuk a click ID-ket es a hash-eket (a naploba nem kerulhetnek): hosszu hex (hash), gclid / gbraid / wbraid ertek, e-mail
// A click ID-t MINDEN alakban kivesszuk (review 6322303663): kulcs + barmilyen elvalaszto (szokoz, =, :, idezojel, JSON, URL-kodolt %3D / %22 / %3A) + ertek; googleClickId / wbraid is;
// kulcs nelkuli ertek (pl. "UNPARSEABLE_GCLID EAIa...") es altalanos tartalek: minden >=20 karakteres vegyes kis/nagybetus, vagy >=24 karakteres szam+betu token.
const CLICK_KULCS = '(gclid|gbraid|wbraid|googleclickid|google_click_id)';
const ELVALASZTO = '[\\s"\':=,{}\\[\\]]*(?:%3[dD]|%22|%3[aA]|%27)*[\\s"\']*';
const CLICK_RE = new RegExp(CLICK_KULCS + ELVALASZTO + '([A-Za-z0-9_-]{6,})', 'gi');
const idSzeru = (x) => /\d/.test(x) || (/[a-z]/.test(x) && /[A-Z]/.test(x)); // "expired" / "not" nem click ID: csak a szam-tartalmu vagy vegyes kis/nagybetus ertek
const hosszuToken = (x) => x.length >= 20 && ((/[a-z]/.test(x) && /[A-Z]/.test(x)) || (x.length >= 24 && /\d/.test(x) && /[A-Za-z]/.test(x)));
// Telefonszam (01-MERES review 6463412395): >= 9 szamjegy, szokoz / kotojel / pont / zarojel elvalasztoval, +36 / 06 elotaggal is; NEV: kulcs-ertek alakban (name / first_name / last_name / full_name / nev / keresztnev / vezeteknev), mert szabad szovegben a nev nem ismerheto fel mintaval.
const TEL_RE = /(?<![0-9A-Za-z])\+?\d(?:[\s().-]{0,2}\d){8,}(?![0-9A-Za-z])/g;
const NEV_RE = /\b(first_?name|last_?name|full_?name|given_?name|family_?name|name|nev|keresztnev|vezeteknev)\b(\s*[:=]\s*|["']\s*:\s*)(["']?)([^",}\]\n;&]{1,60})/gi;
const uzenetTisztit = (s) => valaszMaszk(String(s || ''))
  .replace(CLICK_RE, (m, kulcs, ertek) => (idSzeru(ertek) ? kulcs + '=[click]' : m))
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
  .replace(NEV_RE, (m, kulcs, elv, idezo) => `${kulcs}${elv}${idezo}[nev]`)
  .replace(TEL_RE, '[tel]')
  .replace(/[A-Za-z0-9_-]{20,}/g, (x) => (hosszuToken(x) ? '[token]' : x))
  .replace(/\s+/g, ' ').trim().slice(0, 300);
const darab = (v) => (Number.isInteger(v) && v >= 0 && v <= 1000 ? v : null);

/** A tiszta muvelet (tesztelheto): -> { status, body }. */
export async function googleValaszRogzit(db, o, now = Date.now()) {
  await meresSema(db);
  if (!o || typeof o !== 'object') return { status: 400, body: { ok: false, miert: 'nem objektum' } };
  const kod = o.kod == null ? '' : String(o.kod);
  if (kod !== '' && !KOD_MINTA.test(kod)) return { status: 422, body: { ok: false, miert: 'kod: ures (elfogadva) vagy NAGYBETUS_KOD (max 40)' } };
  let sor = null;
  if (typeof o.esemeny_id === 'string' && o.esemeny_id.length <= 120) sor = await db.prepare("SELECT id, google_reszleges_hiba, platform_valasz FROM meres_kuldes WHERE esemeny_id = ?1 AND platform = 'google'").bind(o.esemeny_id).first();
  else if (Number.isInteger(o.id)) sor = await db.prepare("SELECT id, google_reszleges_hiba, platform_valasz FROM meres_kuldes WHERE id = ?1 AND platform = 'google'").bind(o.id).first();
  else return { status: 400, body: { ok: false, miert: 'esemeny_id (a Zap order_id-ja) vagy id kell' } };
  if (!sor) return { status: 404, body: { ok: false, miert: 'nincs ilyen google sor' } };
  if (sor.google_reszleges_hiba !== null && sor.google_reszleges_hiba !== undefined) return { status: 200, body: { ok: true, id: sor.id, mar_rogzitve: true } }; // az elso visszajelzes marad
  const reszek = [`google_valasz:${kod || 'OK'}`];
  const el = darab(o.elfogadva), ki = darab(o.elutasitva);
  if (el !== null) reszek.push(`elfogadva=${el}`);
  if (ki !== null) reszek.push(`elutasitva=${ki}`);
  const uz = uzenetTisztit(o.uzenet); if (uz) reszek.push(uz);
  const folyt = String(sor.platform_valasz || '');
  const uj = (folyt ? folyt.slice(0, 1700) + ' | ' : '') + reszek.join(' ');
  const r = await db.prepare('UPDATE meres_kuldes SET google_reszleges_hiba = ?2, platform_valasz = ?3, frissitve = ?4 WHERE id = ?1 AND google_reszleges_hiba IS NULL').bind(sor.id, kod, uj.slice(0, 2000), Math.floor(now / 1000)).run();
  return { status: 200, body: { ok: true, id: sor.id, rogzitve: !!(r.meta && r.meta.changes > 0), kod } };
}

/** POST /api/meres-google-valasz */
export async function kezelGoogleValasz(request, env, deps = {}) {
  if (!(await kulcsEgyezik(request, env))) return valasz(404, { ok: false }); // a kulcsellenorzes ELOL (kulcs nelkul mindig 404, a beallitasokrol / a D1-rol semmi nem derul ki)
  if (!env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (request.method !== 'POST') return valasz(405, { ok: false });
  const szoveg = await request.text();
  if (szoveg.length > 4000) return valasz(413, { ok: false, miert: 'tul nagy' });
  let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
  let r; try { r = await googleValaszRogzit(env.KULCS_DB, o, deps.now ? deps.now() : Date.now()); } catch (e) { return valasz(500, { ok: false, miert: 'adatbazis-hiba' }); }
  return valasz(r.status, r.body);
}
