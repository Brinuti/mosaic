// Kuldok: e-mail (Gmail SMTP, ugyanaz a fiok es SMTP_PASS, mint az urlap-levelek: functions/[[path]].js) es SMS (SimpleSMS REST).
// Az engine a kuldoket kapja parameterkent (a tesztekben hamis kuldok), igy az engine tiszta marad.
import { simpleSmsBontas } from './telefon.js';

const SMS_ALAP = 'https://api.simplesms.hu/rest/SMSapi';

/** A SimpleSMS beallitasai a kornyezetbol: felhasznalo + domain nem titkos (wrangler.toml), a jelszo Secret.
 *  uzletag 'mp': ugyanaz a fiok; ha kesobb sajat domaint kap (MP_SIMPLESMS_DOMAIN), azzal csatlakozik (kulon token). */
export function smsBeallitas(env, uzletag = null) {
  const alapDomain = env.SIMPLESMS_DOMAIN || 'mosaicheadspa.hu';
  const domain = uzletag === 'mp' && env.MP_SIMPLESMS_DOMAIN ? env.MP_SIMPLESMS_DOMAIN : alapDomain;
  return { felhasznalo: env.SIMPLESMS_FELHASZNALO || 'ferraj@gmail.com', domain, jelszo: String(env.SIMPLESMS_JELSZO || '').trim() };
}
export const smsKesz = (env) => !!smsBeallitas(env).jelszo;
export const emailKesz = (env) => !!env.SMTP_PASS;

const tokenGyorsitotar = new Map(); // "felhasznalo|domain" -> { token, lejar } - egy isolate eleteig (uzletagonkent kulon domain is lehet)
async function smsToken(env, fetchFn, uzletag = null) {
  const b = smsBeallitas(env, uzletag);
  const kulcs = `${b.felhasznalo}|${b.domain}`;
  const t = tokenGyorsitotar.get(kulcs);
  if (t && t.lejar > Date.now() + 60000) return t.token;
  if (!b.jelszo) throw new Error('SIMPLESMS_JELSZO nincs beallitva');
  const r = await fetchFn(`${SMS_ALAP}/connect`, { method: 'POST', body: new URLSearchParams({ username: b.felhasznalo, password: b.jelszo, domain: b.domain }) });
  const szoveg = await r.text();
  let j; try { j = JSON.parse(szoveg); } catch { j = null; }
  const token = j && (j.access_token || j.data?.access_token);
  if (!token) throw new Error(`SimpleSMS connect hiba: ${szoveg.slice(0, 160)}`);
  const lejar = j.expires_in ? Date.parse(j.expires_in) : NaN;
  tokenGyorsitotar.set(kulcs, { token, lejar: Number.isFinite(lejar) ? lejar : Date.now() + 10 * 60000 });
  return token;
}

/** Diagnosztika: a megadott felhasznalonevvel sikerul-e a connect (a token nem tarolodik, a jelszo nem jelenik meg). */
export async function smsConnectProba(env, felhasznalo, fetchFn = fetch) {
  const b = smsBeallitas(env);
  if (!b.jelszo) return { felhasznalo, ok: false, uzenet: 'SIMPLESMS_JELSZO nincs beallitva' };
  const r = await fetchFn(`${SMS_ALAP}/connect`, { method: 'POST', body: new URLSearchParams({ username: felhasznalo, password: b.jelszo, domain: b.domain }) });
  const t = (await r.text()).trim();
  let j; try { j = JSON.parse(t); } catch { j = null; }
  const token = j && (j.access_token || j.data?.access_token);
  return { felhasznalo, ok: !!token, uzenet: token ? 'connect ok' : t.slice(0, 160), jelszoHossz: b.jelszo.length };
}

/** SMS kuldese. telefon: '+36301234567'. Visszaad: { id } vagy hibat dob. */
export async function smsKuld(env, { telefon, szoveg, uzletag = null }, fetchFn = fetch) {
  const bontas = simpleSmsBontas(telefon);
  if (!bontas) throw Object.assign(new Error('nem magyar mobilszam'), { vegleges: true });
  const token = await smsToken(env, fetchFn, uzletag);
  const r = await fetchFn(`${SMS_ALAP}/sendSMS`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: new URLSearchParams({ ...bontas, message: szoveg }) });
  const t = (await r.text()).trim();
  let j; try { j = JSON.parse(t); } catch { j = null; }
  const hiba = !r.ok || (j && (j.error || j.errors || j.status === 'error')) || /^\s*(error|hiba)/i.test(t);
  if (hiba) { if (r.status === 401) tokenGyorsitotar.delete(`${smsBeallitas(env, uzletag).felhasznalo}|${smsBeallitas(env, uzletag).domain}`); throw new Error(`SimpleSMS sendSMS hiba: ${t.slice(0, 200)}`); }
  const id = j ? (j.sms_id ?? j.id ?? j.response ?? j.data?.sms_id ?? j.data ?? t) : t;
  return { id: String(typeof id === 'object' ? JSON.stringify(id) : id).slice(0, 80) };
}

/** A SimpleSMS egyenlege (Ft vagy kredit - a szolgaltato mertekegysegeben), vagy null. */
export async function smsEgyenleg(env, fetchFn = fetch) {
  const token = await smsToken(env, fetchFn);
  const r = await fetchFn(`${SMS_ALAP}/getCreditNumber`, { headers: { Authorization: `Bearer ${token}` } });
  const t = (await r.text()).trim();
  let j; try { j = JSON.parse(t); } catch { j = null; }
  const v = j ? (j.credit ?? j.balance ?? j.response ?? j.data ?? Object.values(j)[0]) : t;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** A Medical Piercing leveleit a sajat Gmail-fiokja kuldi: a motor a kozos D1 mp_kimeno tablajaba teszi a kesz levelet, a medicalpiercing
 *  Pages-projekt POST /api/lifecycle-kimeno vegpontja (kulcs nelkul; csak a sorban levot kuldheti) onnan kuldi ki (ott van az SMTP_PASS). */
export const MP_KIMENO_URL = 'https://www.medicalpiercing.hu/api/lifecycle-kimeno';
export const MP_KIMENO_SEMA = `CREATE TABLE IF NOT EXISTS mp_kimeno (id TEXT PRIMARY KEY, cimzett TEXT NOT NULL, targy TEXT NOT NULL, html TEXT NOT NULL, szoveg TEXT, valasz TEXT,
  letrehozva INTEGER NOT NULL, elkuldve INTEGER, hiba TEXT, probak INTEGER DEFAULT 0)`;

/** A kimeno sor "megbokese" (best-effort): hiba nem szamit; waitUntil-lal a valasz utan fut, nelkule megvarjuk (legfeljebb 5 mp). */
export function mpKimenoPing(env, { fetchFn = fetch, waitUntil = null } = {}) {
  const ab = typeof AbortController === 'function' ? new AbortController() : null;
  const idozito = ab ? setTimeout(() => ab.abort(), 5000) : null;
  const p = Promise.resolve()
    .then(() => fetchFn(env.MP_KIMENO_URL || MP_KIMENO_URL, { method: 'POST', ...(ab ? { signal: ab.signal } : {}) }))
    .then((r) => { try { r?.body?.cancel?.(); } catch { /* nem szamit */ } })
    .catch(() => { /* best-effort */ })
    .finally(() => { if (idozito) clearTimeout(idozito); });
  if (typeof waitUntil === 'function') { try { waitUntil(p); return Promise.resolve(); } catch { /* nincs futasi kontextus */ } }
  return p;
}

/** Az MP-level a sorba (soha nem a MOSAIC postafiokjabol). Ha a tabla meg nincs, letrehozza. Visszaad: { id: 'mp-sor:<id>' }. */
export async function mpSorba(db, { to, targy, html, szoveg, valasz }, most = Math.floor(Date.now() / 1000)) {
  if (!db) throw Object.assign(new Error('LIFECYCLE_DB nincs (az MP-level nem ment ki)'), { vegleges: true });
  const id = crypto.randomUUID();
  const beir = () => db.prepare('INSERT INTO mp_kimeno (id, cimzett, targy, html, szoveg, valasz, letrehozva, probak) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)')
    .bind(id, String(to || ''), String(targy || ''), String(html || ''), szoveg == null ? null : String(szoveg), valasz || 'medicalpiercing.hu@gmail.com', most).run();
  try { await beir(); } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await db.prepare(MP_KIMENO_SEMA).run();
    await beir();
  }
  return { id: `mp-sor:${id}` };
}

/**
 * A kuldok keszlete egy tick idejere: az SMTP-kapcsolatot egyszer nyitjuk. A felado: a szalon Gmail-fiokja (SMTP_USER), a megjelenitett nev az uzletag.
 * Hasznalat: const k = kuldokKeszit(env); await k.email({...}); await k.lezar();
 */
export function kuldokKeszit(env, { fetchFn = fetch, db = env.LIFECYCLE_DB, waitUntil = null } = {}) {
  let posta = null;
  let mpSorban = 0;
  const kapcsolat = async () => {
    if (posta) return posta;
    const { WorkerMailer } = await import('worker-mailer');
    const port = Number(env.SMTP_PORT || 465);
    posta = await WorkerMailer.connect({
      host: env.SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465, startTls: port !== 465,
      credentials: { username: env.SMTP_USER || 'mosaicheadspa@gmail.com', password: String(env.SMTP_PASS || '').replace(/\s+/g, '') }, authType: 'plain',
    });
    return posta;
  };
  return {
    sms: (adat) => smsKuld(env, adat, fetchFn),
    async email({ to, targy, html, szoveg, felado, valasz, uzletag }) {
      if (uzletag === 'mp') { // soha nem a MOSAIC postafiokjabol: a D1-sorba, az MP-projekt kuldi ki
        const v = await mpSorba(db, { to, targy, html, szoveg, valasz });
        mpSorban += 1;
        await mpKimenoPing(env, { fetchFn, waitUntil });
        return v;
      }
      if (!emailKesz(env)) throw new Error('SMTP_PASS nincs beallitva');
      const p = await kapcsolat();
      const user = env.SMTP_USER || 'mosaicheadspa@gmail.com';
      await p.send({ from: { name: felado || 'MOSAIC', email: user }, to, ...(valasz ? { reply: valasz } : {}), subject: targy, html, text: szoveg });
      return { id: 'smtp' };
    },
    /** hany MP-level kerult a sorba ezzel a keszlettel */
    get mpSorban() { return mpSorban; },
    /** a kimeno sor megbokese (best-effort) */
    mpPing: () => mpKimenoPing(env, { fetchFn, waitUntil }),
    async lezar() { if (posta) { try { await posta.close(); } catch { /* mar lezarult */ } posta = null; } },
  };
}
