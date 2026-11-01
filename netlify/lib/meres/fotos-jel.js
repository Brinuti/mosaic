// PMU fotos foglalas: PII-MENTES jelzes (Feri 2026-11-01, #588; 01-MERES #167 6562358324 + Feri 6562391072): aki fotoval foglal, azt NEM merjuk konverzionak.
// A jelzes a fotos urlap (pmu-proba-foto) szerveroldali fogadasakor keletkezik (functions/[[path]].js), a bongeszo / a foglalo-pmu.js (VEDETT) valtozatlan.
// Tarolt adat: HMAC(telefon) - UGYANAZ a keplet, mint a vendeg-hash tel_h-ja (salonic-direct.js vendegHash: HMAC-SHA256(GUEST_HMAC_KEY_V1, "v1|t|<szamjegy>"), 32 hex) -,
// idobelyeg, a foglalassal-jelzo, es (ha parosithato) a Salonic-foglalas UUID-ja + ara a december 1-i kiertekeleshez. Nyers telefon / nev / e-mail SOHA nem kerul a D1-be.
// Egyezes: a Salonic-foglalas letrehozo levelenek ideje [jelzes - 1 ora, jelzes + 7 nap] kozott. Megorzes: a parositatlan jelzes 30 nap, a parositott 90 nap.
import { telefonSzamjegy } from './hash.js';

export const FOTOS_ELOTT_MP = 3600;          // a jelzes elotti 1 ora is szamit (a vendeg foglalhat a fotok elkuldese elott pillanatokkal)
export const FOTOS_UTAN_MP = 7 * 86400;      // a jelzes utani 7 nap
export const FOTOS_MEGORZES_MP = 30 * 86400; // parositatlan jelzes
export const FOTOS_PAROSITOTT_MEGORZES_MP = 90 * 86400; // parositott jelzes (a december 1-i kiertekeleshez)
export const FOTOS_INDOK = 'fotos_foglalas: nem konverzio';

const titokOk = (v) => typeof v === 'string' && v.length >= 16;
async function hmacHex(titok, szoveg) {
  const kulcs = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(titok)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const jel = await crypto.subtle.sign('HMAC', kulcs, new TextEncoder().encode(String(szoveg)));
  return [...new Uint8Array(jel)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** A telefon vendeg-hash-e (32 hex) - a salonic-direct.js vendegHash tel_h-javal AZONOS; null, ha nincs titok vagy ervenyes telefon. */
export async function telH(env, telefon) {
  if (!titokOk(env && env.GUEST_HMAC_KEY_V1)) return null;
  const x = telefonSzamjegy(telefon);
  return x ? (await hmacHex(env.GUEST_HMAC_KEY_V1, `v1|t|${x}`)).slice(0, 32) : null;
}

export const fotosJelBe = (env) => String((env && env.PMU_FOTOS_JEL) || '') === '1';

export async function fotosSema(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS pmu_fotos_jel (id INTEGER PRIMARY KEY AUTOINCREMENT, tel_h TEXT NOT NULL, ido INTEGER NOT NULL, lejar INTEGER NOT NULL, foglalassal INTEGER NOT NULL DEFAULT 0, salonic_uuid TEXT, ertek INTEGER, parositva INTEGER)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS pmu_fotos_jel_tel ON pmu_fotos_jel (tel_h, ido)').run();
}

/** A fotos urlap fogadasakor: HMAC(telefon) + ido. Hiba SOHA nem dobodik (a levelkuldest nem akadalyozhatja). -> { ok, miert? } */
export async function fotosJelIr(db, env, { telefon, foglalassal = false, now = Date.now() } = {}) {
  try {
    if (!fotosJelBe(env) || !db) return { ok: false, miert: 'ki' };
    const h = await telH(env, telefon);
    if (!h) return { ok: false, miert: 'nincs titok vagy ervenyes telefon' };
    await fotosSema(db);
    const t = Math.floor(now / 1000);
    await db.prepare('DELETE FROM pmu_fotos_jel WHERE lejar < ?1').bind(t).run();
    await db.prepare('INSERT INTO pmu_fotos_jel (tel_h, ido, lejar, foglalassal) VALUES (?1, ?2, ?3, ?4)').bind(h, t, t + FOTOS_MEGORZES_MP, foglalassal ? 1 : 0).run();
    return { ok: true };
  } catch (e) { return { ok: false, miert: 'hiba: ' + String((e && e.message) || e).slice(0, 80) }; }
}

/**
 * A Salonic-foglalas (PMU) fotos-e? t0 = a letrehozo level ideje (unix mp). -> null | { id }.
 * iras = true (eles ut): az egyezo jelzesre rogzul a Salonic UUID + az ar (parositas); szaraz terv: irasmentes. Hiba / hianyzo tabla / kapcsolo KI: null (a foglalas normalisan megy tovabb).
 * FAIL-OPEN szandekos: a jelzes hianya nem blokkol (a kizaras kiegeszito szabaly), de a hiba naplozando a hivonal.
 */
export async function fotosJelEgyezik(db, env, { vendeg = {}, t0, uuid = null, ertek = null, iras = true } = {}) {
  try {
    if (!fotosJelBe(env) || !db || !Number.isFinite(t0)) return null;
    const h = await telH(env, vendeg && vendeg.telefon);
    if (!h) return null;
    const sor = await db.prepare('SELECT id FROM pmu_fotos_jel WHERE tel_h = ?1 AND ?2 >= ido - ?3 AND ?2 <= ido + ?4 ORDER BY ido DESC LIMIT 1').bind(h, t0, FOTOS_ELOTT_MP, FOTOS_UTAN_MP).first();
    if (!sor) return null;
    if (iras && uuid) {
      const t = Math.floor(Date.now() / 1000);
      await db.prepare('UPDATE pmu_fotos_jel SET salonic_uuid = ?2, ertek = ?3, parositva = 1, lejar = MAX(lejar, ?4) WHERE id = ?1 AND (salonic_uuid IS NULL OR salonic_uuid = ?2)').bind(sor.id, String(uuid).toLowerCase(), Number.isFinite(Number(ertek)) ? Math.round(Number(ertek)) : null, t + FOTOS_PAROSITOTT_MEGORZES_MP).run();
    }
    return { id: sor.id };
  } catch (e) { return null; /* a tabla meg nincs (nem volt fotos jelzes) vagy atmeneti hiba */ }
}
