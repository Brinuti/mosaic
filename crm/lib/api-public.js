// Publikus (vendeg) vegpontok: CSAK token / egyszer hasznalhato link. Nincs vendegfiok, nincs regisztracio.
// Minden oldal no-store + no-referrer + noindex; a kepek CSAK a tokenes vegponton at (vendegszintu ACL az images.hozzaferes-ben), minden elutasitas auditalt.
import { ApiHiba, html, json, fajl, urlapVagyJson, mediaTipus, limitVagyHiba, uuidE, logikai, szoveges, egyenlo, esc } from './http.js';
import { elso, mind, keszit, sha256, jsonOlvas, normEmail, normTelefon, tranzakcio, CrmHiba } from './db.js';
import { naplo } from './audit.js';
import { KEP_MIME } from './constants.js';
import * as felmero from './assessment.js';
import * as kepek from './images.js';
import * as panasz from './complaint.js';
import * as hozzajarulas from './consent.js';
import { vegleges } from './guest.js';
import { leiratkozasTokenSync } from './api-token.js';
import {
  felmeroOldal, felmeroValaszok, hibaOldal, koszonoOldal, ervenytelenLinkOldal, osszehasonlitasOldal, lejartOldal, ujLinkValaszOldal, ujHozzaferesOldal,
  elegedettsegOldal, leiratkozasOldal, leiratkozasKeszOldal,
} from './public-oldalak.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
const PUBLIKUS_LIMIT = { ablak: 600, max: 90 };           // IP-nkent / 10 perc
const HOZZAJARULAS_LIMIT = { ablak: 3600, max: 30 };
const FUGGO_ERVENYESSEG = 7 * 86400;                      // a landing-hozzajarulas ennyi ideig varhat a foglalas beerkezesere
const KITERJESZTES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const jsonKeres = (c) => mediaTipus(c.request) === 'application/json' || /application\/json/.test(c.request.headers.get('accept') || '');
const oldalValasz = (szoveg, status = 200) => html(szoveg, status);

async function ipLimit(c) { await limitVagyHiba(c.db, `pub:${c.ipHash || 'noip'}`, PUBLIKUS_LIMIT, c.now); }
/** HTML-oldalas hibak: a rate limit is oldalkent jelenik meg */
function oldalHiba(e) {
  if (e instanceof CrmHiba && e.status === 429) return oldalValasz(hibaOldal('Túl sok kérés', 'Túl sok kérés érkezett, kérjük, próbáld meg néhány perc múlva.'), 429);
  throw e;
}
const tokenRendben = (t) => typeof t === 'string' && TOKEN_RE.test(t);

// ---- leiratkozasi token (allapotmentes, HMAC; a szinkron megvalositas az api-token.js-ben) -------------------------------------------------------------
/** leiratkozasi token egy vendeghez: `<guestId>.<alairas>`; nem jar le. Titok: env.CRM_TITOK (hianyaban 503). */
export async function leiratkozasToken(env, guestId) {
  const t = leiratkozasTokenSync(env, guestId);
  if (!t) throw new ApiHiba('NINCS_TITOK', 'A CRM_TITOK nincs beállítva (legalább 16 karakter).', 503);
  return t;
}
export const leiratkozasLink = async (env, origin, guestId) => `${origin}/api/crm/public/leiratkozas/${await leiratkozasToken(env, guestId)}`;
async function leiratkozasVendeg(c, token) {
  const [guestId, alairas] = String(token).split('.');
  if (!uuidE(guestId) || !alairas) return null;
  const vart = leiratkozasTokenSync(c.env, guestId.toLowerCase());
  if (!vart || !egyenlo(vart, `${guestId.toLowerCase()}.${alairas}`)) return null;
  return vegleges(c.db, guestId.toLowerCase());
}

// ---- landing-hozzajarulas (pending_consent a beallitasok tablaban) ---------------------------------------------------------------------------
const pendingKulcs = async (fajta, ertek) => `pending_consent:${fajta}:${await sha256(`pc|${fajta}|${ertek}`)}`;

export async function fuggoHozzajarulasMent(db, { email, telefon, emailMarketing, smsMarketing, szovegVerzio, szolgaltatas, now }) {
  const adat = JSON.stringify({ email_marketing: emailMarketing, sms_marketing: smsMarketing, szoveg_verzio: szovegVerzio, szolgaltatas: szolgaltatas || null, rogzitve: now });
  const ut = [keszit(db, 'DELETE FROM beallitasok WHERE kulcs LIKE \'pending_consent:%\' AND frissitve < ?1', now - FUGGO_ERVENYESSEG)];
  for (const [fajta, ertek] of [['e', email], ['t', telefon]]) {
    if (!ertek) continue;
    ut.push(keszit(db, 'INSERT OR REPLACE INTO beallitasok (kulcs, ertek, frissitve, frissitette) VALUES (?1, ?2, ?3, \'public\')', await pendingKulcs(fajta, ertek), adat, now));
  }
  await tranzakcio(db, ut);
}

/**
 * A foglalas beerkezese utan hivando (az /ingest vegpont es az ingest.js): a landingen tett marketing-hozzajarulas a vendeghez kapcsol az e-mail /
 * telefon alapjan. A hozzajarulas SOHA nem elofeltetel: ha nincs fuggo bejegyzes, nem tortenik semmi. Visszaad: a rogzitett csatornak.
 */
export async function fuggoHozzajarulasAlkalmaz(db, { guestId, now, ipHash = null }) {
  const g = await elso(db, 'SELECT * FROM guest WHERE id = ?1 AND status = \'active\'', guestId);
  if (!g) return [];
  const alkalmazott = [];
  for (const [fajta, ertek, csatorna, mezo] of [['e', g.email, 'email_marketing', 'email_marketing'], ['t', g.phone, 'sms_marketing', 'sms_marketing']]) {
    if (!ertek) continue;
    const kulcs = await pendingKulcs(fajta, ertek);
    const sor = await elso(db, 'SELECT ertek FROM beallitasok WHERE kulcs = ?1', kulcs);
    if (!sor) continue;
    const p = jsonOlvas(sor.ertek, null);
    await keszit(db, 'DELETE FROM beallitasok WHERE kulcs = ?1', kulcs).run();
    if (!p || now - p.rogzitve > FUGGO_ERVENYESSEG || p[mezo] !== true || !p.szoveg_verzio) continue;
    if (await hozzajarulas.hozzajarulas(db, g.id, csatorna)) continue;   // mar van ervenyes opt-in
    await hozzajarulas.rogzit(db, { guestId: g.id, csatorna, szovegVerzio: p.szoveg_verzio, forras: 'booking_form', ipHash, now });
    alkalmazott.push(csatorna);
  }
  return alkalmazott;
}

/**
 * Pull-modell: a fuggo landing-hozzajarulasok hozzakapcsolasa a frissen beerkezett foglalasok vendegeihez (e-mail / telefon hash alapjan), az ingest.js /
 * lifecycle-kapocs.js modositasa nelkul. A /tick es az /ingest hivja. Visszaad: a rogzitett (vendeg, csatorna) parok szama.
 */
export async function fuggoHozzajarulasSweep(db, { now, ipHash = null }) {
  const van = await elso(db, 'SELECT 1 AS x FROM beallitasok WHERE kulcs LIKE \'pending_consent:%\' LIMIT 1');
  if (!van) return 0;
  const kulcsok = new Set((await mind(db, 'SELECT kulcs FROM beallitasok WHERE kulcs LIKE \'pending_consent:%\' LIMIT 5000')).map((r) => r.kulcs));
  const vendegek = await mind(db, `SELECT DISTINCT g.id, g.email, g.phone FROM guest g WHERE g.status = 'active' AND (g.created_at >= ?1 OR g.id IN (SELECT guest_id FROM booking WHERE created_at >= ?1)) LIMIT 2000`, now - FUGGO_ERVENYESSEG);
  let db_ = 0;
  for (const g of vendegek) {
    const talal = (g.email && kulcsok.has(await pendingKulcs('e', g.email))) || (g.phone && kulcsok.has(await pendingKulcs('t', g.phone)));
    if (talal) db_ += (await fuggoHozzajarulasAlkalmaz(db, { guestId: g.id, now, ipHash })).length;
  }
  return db_;
}

async function adatkezelesVerzio(c) {
  const s = await elso(c.db, 'SELECT ertek FROM beallitasok WHERE kulcs = \'adatkezelesi_tajekoztato_verzio\'');
  const v = s ? jsonOlvas(s.ertek, s.ertek) : null;
  return typeof v === 'string' && v ? v.slice(0, 60) : 'REQUIRES_VERIFICATION';
}

// ---- vegpontok -------------------------------------------------------------------------------------------------------------------------------
async function felmeroBetolt(c, token) {
  if (!tokenRendben(token)) return null;
  const s = await elso(c.db, `SELECT s.id, s.status, s.guest_id, a.questions, a.approved_by_clinical_lead AS jovahagyott FROM assessment_submission s JOIN assessment a ON a.id = s.assessment_id WHERE s.token_hash = ?1`, await sha256(token));
  if (!s || s.status !== 'issued' || s.jovahagyott !== 1) return null;   // jovahagyatlan verzio vendegnek nem adhato ki
  return { ...s, definicio: jsonOlvas(s.questions, { csoportok: [] }) };
}
const felmeroAction = (token) => `/api/crm/public/felmero/${encodeURIComponent(token)}`;

export const utak = [
  // ---- allapotfelmero ----------------------------------------------------------------------------------------------------------------------
  ['GET', '/public/felmero/:token', async (c) => {
    try { await ipLimit(c); } catch (e) { return oldalHiba(e); }
    const s = await felmeroBetolt(c, c.params.token);
    if (!s) { await naploElutasitas(c, 'public.felmero_denied'); return oldalValasz(ervenytelenLinkOldal(), 404); }
    return oldalValasz(felmeroOldal({ definicio: s.definicio, action: felmeroAction(c.params.token) }));
  }],
  ['POST', '/public/felmero/:token', async (c) => {
    const token = c.params.token;
    const json_ = jsonKeres(c);
    try { await ipLimit(c); } catch (e) { if (json_) throw e; return oldalHiba(e); }
    const s = await felmeroBetolt(c, token);
    if (!s) { await naploElutasitas(c, 'public.felmero_denied'); if (json_) throw new ApiHiba('ISMERETLEN_LINK', 'Érvénytelen kitöltési link.', 404); return oldalValasz(ervenytelenLinkOldal(), 404); }
    const urlap = await urlapVagyJson(c.request);
    const valaszok = json_ ? (urlap.valaszok && typeof urlap.valaszok === 'object' ? urlap.valaszok : urlap) : felmeroValaszok(s.definicio, urlap);
    try {
      await felmero.bead(c.db, { token, valaszok, adatkezelesVerzio: await adatkezelesVerzio(c), now: c.now, ipHash: c.ipHash });
    } catch (e) {
      if (!(e instanceof CrmHiba)) throw e;
      if (json_) throw e;
      if (['ADATKEZELES_KELL', 'ERVENYTELEN_VALASZ'].includes(e.kod)) {
        const hibak = e.kod === 'ADATKEZELES_KELL' ? ['Az adatkezelési tájékoztató elfogadása kötelező.'] : (Array.isArray(e.reszlet) ? e.reszlet.map((h) => `Hibás vagy hiányzó válasz: ${String(h).split(':')[0]}`) : ['Hibás válasz.']);
        return oldalValasz(felmeroOldal({ definicio: s.definicio, ertekek: valaszok, hibak, action: felmeroAction(token) }), 422);
      }
      if (e.kod === 'MAR_BEADVA') return oldalValasz(hibaOldal('Már kitöltötted', 'Ezt a kérdőívet már beküldted, köszönjük.'), 409);
      return oldalValasz(ervenytelenLinkOldal(), e.status === 404 ? 404 : 409);
    }
    // a vendegnek NEM mutatunk klinikai ertekelest / jelzest: csak koszonet
    if (json_) return json({ ok: true });
    return oldalValasz(koszonoOldal('Köszönjük!', 'A kérdőívet megkaptuk. A kezelésed előtt a kezelőd átnézi, ha kérdése lenne, felvesszük veled a kapcsolatot.'));
  }],

  // ---- kepek ------------------------------------------------------------------------------------------------------------------------------------
  ['GET', '/public/kep/:token', async (c) => {
    try { await ipLimit(c); } catch (e) { return oldalHiba(e); }
    const token = c.params.token;
    if (!tokenRendben(token)) { await naploElutasitas(c, 'public.kep_denied'); return oldalValasz(ervenytelenLinkOldal(), 404); }
    const r = await kepek.hozzaferes(c.db, { token, ipHash: c.ipHash, now: c.now });   // tarolo nincs: az oldal csak metaadatot kap
    if (r.ok) return oldalValasz(osszehasonlitasOldal({ token, osszehasonlitas: r.osszehasonlitas, lejar: r.lejar }));
    if (r.status === 410) return oldalValasz(lejartOldal({ token }), 410);
    return oldalValasz(ervenytelenLinkOldal(), 404);
  }],
  ['GET', '/public/kep/:token/:imageId', async (c) => {
    try { await ipLimit(c); } catch { return new Response('Túl sok kérés', { status: 429, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }); }
    const { token, imageId } = c.params;
    const nincs = () => new Response('Nem található', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    if (!tokenRendben(token) || !uuidE(imageId)) { await naploElutasitas(c, 'public.kep_denied'); return nincs(); }
    const r = await kepek.hozzaferes(c.db, { token, imageId: imageId.toLowerCase(), tarolo: c.tarolo, ipHash: c.ipHash, now: c.now });
    if (!r.ok || !r.kep?.bajtok) return nincs();
    const mime = KEP_MIME.includes(r.kep.mime) ? r.kep.mime : 'application/octet-stream';
    return fajl(r.kep.bajtok, mime, `kep.${KITERJESZTES[mime] || 'bin'}`, { inline: true });
  }],
  ['POST', '/public/uj-link', async (c) => {
    const json_ = jsonKeres(c);
    try { await ipLimit(c); } catch (e) { if (json_) throw e; return oldalHiba(e); }
    const t = await urlapVagyJson(c.request);
    const r = await kepek.ujLinkKeres(c.db, { token: typeof t.token === 'string' ? t.token : '', email: typeof t.email === 'string' ? t.email : '', ipHash: c.ipHash, now: c.now });
    if (r.belso && typeof c.kuldok.vendeg === 'function') {
      // a levelkuldes a valasz utan fut (idozites nem arul el semmit); a kuldo nincs: DRY, a link nem megy ki
      const kuld = Promise.resolve().then(() => c.kuldok.vendeg({
        to: r.belso.to, targy: 'MOSAIC – új hozzáférés a képeidhez',
        szoveg: `Szia!\n\nA megerősítéshez nyisd meg ezt a hivatkozást (30 percig érvényes, egyszer használható):\n${c.url.origin}/api/crm/public/uj-link/${r.belso.verificationToken}\n\nHa nem te kérted, hagyd figyelmen kívül ezt a levelet.\n\nMOSAIC Head Spa and Hair`,
        html: `<p>Szia!</p><p>A megerősítéshez nyisd meg ezt a hivatkozást (30 percig érvényes, egyszer használható):</p><p><a href="${esc(c.url.origin)}/api/crm/public/uj-link/${esc(r.belso.verificationToken)}">Új hozzáférés kérése</a></p><p>Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.</p><p>MOSAIC Head Spa and Hair</p>`,
      })).catch((e) => console.error('crm: az uj-link level kuldese sikertelen:', e?.name || 'hiba'));
      if (typeof c.ctx.waitUntil === 'function') c.ctx.waitUntil(kuld); else await kuld;
    }
    return json_ ? json(r.valasz) : oldalValasz(ujLinkValaszOldal());   // MINDIG ugyanaz
  }],
  ['GET', '/public/uj-link/:verifikacios_token', async (c) => {
    try { await ipLimit(c); } catch (e) { return oldalHiba(e); }
    const t = c.params.verifikacios_token;
    if (!tokenRendben(t)) { await naploElutasitas(c, 'public.uj_link_denied'); return oldalValasz(ervenytelenLinkOldal(), 404); }
    const r = await kepek.ujLinkEllenoriz(c.db, { verifikaciosToken: t, ipHash: c.ipHash, now: c.now });
    if (!r.ok) return oldalValasz(ervenytelenLinkOldal(), 404);
    return oldalValasz(ujHozzaferesOldal({ token: r.token, lejar: r.expiresAt }));
  }],

  // ---- elegedettseg --------------------------------------------------------------------------------------------------------------------------
  ['GET', '/public/elegedettseg/:token', async (c) => {
    try { await ipLimit(c); } catch (e) { return oldalHiba(e); }
    const t = c.params.token;
    const s = tokenRendben(t) ? await elso(c.db, 'SELECT id FROM survey_response WHERE token_hash = ?1 AND score IS NULL', await sha256(t)) : null;
    if (!s) { await naploElutasitas(c, 'public.elegedettseg_denied'); return oldalValasz(ervenytelenLinkOldal(), 404); }
    return oldalValasz(elegedettsegOldal({ action: `/api/crm/public/elegedettseg/${encodeURIComponent(t)}` }));
  }],
  ['POST', '/public/elegedettseg/:token', async (c) => {
    const t = c.params.token;
    const json_ = jsonKeres(c);
    try { await ipLimit(c); } catch (e) { if (json_) throw e; return oldalHiba(e); }
    const urlap = await urlapVagyJson(c.request);
    const pont = typeof urlap.pont === 'string' ? Number(urlap.pont) : urlap.pont;
    const komment = typeof urlap.komment === 'string' ? urlap.komment : null;
    const action = `/api/crm/public/elegedettseg/${encodeURIComponent(t)}`;
    if (!Number.isInteger(pont) || pont < 1 || pont > 5) {
      if (json_) throw new ApiHiba('ERVENYTELEN_PONT', 'A pontszám 1 és 5 közötti egész szám.', 422);
      return oldalValasz(elegedettsegOldal({ action, hibak: ['Kérjük, válassz 1 és 5 közötti pontszámot.'], komment: komment || '' }), 422);
    }
    try {
      if (!tokenRendben(t)) throw new CrmHiba('ISMERETLEN_LINK', 'ervenytelen kerdoiv-link', 404);
      await panasz.surveyBead(c.db, { token: t, pont, komment, now: c.now, ipHash: c.ipHash });
    } catch (e) {
      if (!(e instanceof CrmHiba)) throw e;
      await naploElutasitas(c, 'public.elegedettseg_denied');
      if (json_) throw e;
      if (e.kod === 'MAR_BEADVA') return oldalValasz(hibaOldal('Már értékeltél', 'Az értékelésedet már megkaptuk, köszönjük.'), 409);
      return oldalValasz(e.status === 404 ? ervenytelenLinkOldal() : hibaOldal('Sajnos nem sikerült', 'Az értékelést most nem tudtuk rögzíteni. Kérjük, keress minket telefonon.'), e.status === 404 ? 404 : 409);
    }
    // a vendegnek minden pontszamnal ugyanaz a koszonet (a panasz-folyamat belso)
    return json_ ? json({ ok: true }) : oldalValasz(koszonoOldal('Köszönjük az értékelést!', 'A visszajelzésedet megkaptuk.'));
  }],

  // ---- leiratkozas ----------------------------------------------------------------------------------------------------------------------------
  ['GET', '/public/leiratkozas/:token', async (c) => {
    try { await ipLimit(c); } catch (e) { return oldalHiba(e); }
    const gid = await leiratkozasVendeg(c, c.params.token).catch(() => null);
    if (!gid) { await naploElutasitas(c, 'public.leiratkozas_denied'); return oldalValasz(ervenytelenLinkOldal(), 404); }
    const allapotok = {};
    for (const cs of ['email_marketing', 'sms_marketing', 'image_marketing']) allapotok[cs] = await hozzajarulas.hozzajarulas(c.db, gid, cs);
    return oldalValasz(leiratkozasOldal({ action: `/api/crm/public/leiratkozas/${c.params.token}`, allapotok }));
  }],
  ['POST', '/public/leiratkozas/:token', async (c) => {
    const json_ = jsonKeres(c);
    try { await ipLimit(c); } catch (e) { if (json_) throw e; return oldalHiba(e); }
    const gid = await leiratkozasVendeg(c, c.params.token).catch(() => null);
    if (!gid) { await naploElutasitas(c, 'public.leiratkozas_denied'); if (json_) throw new ApiHiba('ISMERETLEN_LINK', 'Érvénytelen leiratkozási link.', 404); return oldalValasz(ervenytelenLinkOldal(), 404); }
    const urlap = await urlapVagyJson(c.request);
    let kert = urlap.csatorna;
    if (kert === undefined && !Object.keys(urlap).length) kert = ['email_marketing'];   // egykattintasos leiratkozas (RFC 8058): torzs nelkul az e-mail marketing
    kert = (Array.isArray(kert) ? kert : kert ? [kert] : []).filter((x, i, t) => ['email_marketing', 'sms_marketing', 'image_marketing'].includes(x) && t.indexOf(x) === i);
    const leiratkozott = [];
    for (const cs of kert) {
      const utolso = await hozzajarulas.utolsoEsemeny(c.db, gid, cs);
      if (utolso?.action === 'withdrawn') { leiratkozott.push(cs); continue; }   // mar leiratkozott: nincs duplikalt naplo-sor
      await hozzajarulas.leiratkozas(c.db, { guestId: gid, csatorna: cs, forras: 'unsubscribe_link', ipHash: c.ipHash, now: c.now });
      leiratkozott.push(cs);
    }
    return json_ ? json({ ok: true, csatornak: leiratkozott }) : oldalValasz(leiratkozasKeszOldal(leiratkozott));
  }],

  // ---- landing: marketing-hozzajarulas (soha nem elofeltetel) -------------------------------------------------------------------------------
  ['POST', '/public/hozzajarulas', async (c) => {
    await limitVagyHiba(c.db, `hjar:${c.ipHash || 'noip'}`, HOZZAJARULAS_LIMIT, c.now);
    const t = await c.torzs();
    const emailMk = logikai(t, 'email_marketing', { kotelezo: true });
    const smsMk = logikai(t, 'sms_marketing', { kotelezo: true });
    const k = t.kapcsolat && typeof t.kapcsolat === 'object' && !Array.isArray(t.kapcsolat) ? t.kapcsolat : {};
    const szolgaltatas = szoveges(t, 'selected_service', { max: 60 });
    if (emailMk || smsMk) {
      const verzio = szoveges(t, 'szoveg_verzio', { kotelezo: true, max: 60, min: 1 });
      const email = normEmail(k.email);
      const telefon = normTelefon(k.telefon);
      if (emailMk && !email) throw new ApiHiba('ERVENYTELEN_EMAIL', 'Az e-mailes hozzájáruláshoz érvényes e-mail-cím kell.', 422);
      if (smsMk && !telefon) throw new ApiHiba('ERVENYTELEN_TELEFON', 'Az SMS-es hozzájáruláshoz érvényes telefonszám kell.', 422);
      await fuggoHozzajarulasMent(c.db, { email: emailMk ? email : null, telefon: smsMk ? telefon : null, emailMarketing: emailMk, smsMarketing: smsMk, szovegVerzio: verzio, szolgaltatas, now: c.now });
    }
    // MINDIG ugyanaz a valasz, akar tortent bejegyzes, akar nem, akar letezik mar a vendeg (a foglalas ettol fuggetlen)
    return { ok: true };
  }],
];

async function naploElutasitas(c, muvelet) {
  await naplo(c.db, { action: muvelet, resource: 'public', result: 'denied', ipHash: c.ipHash, now: c.now });
}
