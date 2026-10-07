// Kuldok: e-mail (Gmail SMTP, ugyanaz a fiok es SMTP_PASS, mint az urlap-levelek: functions/[[path]].js) es SMS (SimpleSMS REST).
// Az engine a kuldoket kapja parameterkent (a tesztekben hamis kuldok), igy az engine tiszta marad.
import { simpleSmsBontas } from './telefon.js';

const SMS_ALAP = 'https://api.simplesms.hu/rest/SMSapi';

/** A SimpleSMS beallitasai a kornyezetbol: felhasznalo + domain nem titkos (wrangler.toml), a jelszo Secret. */
export function smsBeallitas(env) {
  return { felhasznalo: env.SIMPLESMS_FELHASZNALO || 'mosaic', domain: env.SIMPLESMS_DOMAIN || 'mosaicheadspa.hu', jelszo: String(env.SIMPLESMS_JELSZO || '').trim() };
}
export const smsKesz = (env) => !!smsBeallitas(env).jelszo;
export const emailKesz = (env) => !!env.SMTP_PASS;

let tokenGyorsitotar = null; // { token, lejar } - egy isolate eleteig
async function smsToken(env, fetchFn) {
  if (tokenGyorsitotar && tokenGyorsitotar.lejar > Date.now() + 60000) return tokenGyorsitotar.token;
  const b = smsBeallitas(env);
  if (!b.jelszo) throw new Error('SIMPLESMS_JELSZO nincs beallitva');
  const r = await fetchFn(`${SMS_ALAP}/connect`, { method: 'POST', body: new URLSearchParams({ username: b.felhasznalo, password: b.jelszo, domain: b.domain }) });
  const szoveg = await r.text();
  let j; try { j = JSON.parse(szoveg); } catch { j = null; }
  const token = j && (j.access_token || j.data?.access_token);
  if (!token) throw new Error(`SimpleSMS connect hiba: ${szoveg.slice(0, 160)}`);
  const lejar = j.expires_in ? Date.parse(j.expires_in) : NaN;
  tokenGyorsitotar = { token, lejar: Number.isFinite(lejar) ? lejar : Date.now() + 10 * 60000 };
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
export async function smsKuld(env, { telefon, szoveg }, fetchFn = fetch) {
  const bontas = simpleSmsBontas(telefon);
  if (!bontas) throw Object.assign(new Error('nem magyar mobilszam'), { vegleges: true });
  const token = await smsToken(env, fetchFn);
  const r = await fetchFn(`${SMS_ALAP}/sendSMS`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: new URLSearchParams({ ...bontas, message: szoveg }) });
  const t = (await r.text()).trim();
  let j; try { j = JSON.parse(t); } catch { j = null; }
  const hiba = !r.ok || (j && (j.error || j.errors || j.status === 'error')) || /^\s*(error|hiba)/i.test(t);
  if (hiba) { if (r.status === 401) tokenGyorsitotar = null; throw new Error(`SimpleSMS sendSMS hiba: ${t.slice(0, 200)}`); }
  const id = j ? (j.sms_id ?? j.id ?? j.data?.sms_id ?? j.data ?? t) : t;
  return { id: String(typeof id === 'object' ? JSON.stringify(id) : id).slice(0, 80) };
}

/** A SimpleSMS egyenlege (Ft vagy kredit - a szolgaltato mertekegysegeben), vagy null. */
export async function smsEgyenleg(env, fetchFn = fetch) {
  const token = await smsToken(env, fetchFn);
  const r = await fetchFn(`${SMS_ALAP}/getCreditNumber`, { headers: { Authorization: `Bearer ${token}` } });
  const t = (await r.text()).trim();
  let j; try { j = JSON.parse(t); } catch { j = null; }
  const v = j ? (j.credit ?? j.balance ?? j.data ?? j.response ?? Object.values(j)[0]) : t;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * A kuldok keszlete egy tick idejere: az SMTP-kapcsolatot egyszer nyitjuk. A felado: a szalon Gmail-fiokja (SMTP_USER), a megjelenitett nev az uzletag.
 * Hasznalat: const k = kuldokKeszit(env); await k.email({...}); await k.lezar();
 */
export function kuldokKeszit(env, { fetchFn = fetch } = {}) {
  let posta = null;
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
    async email({ to, targy, html, szoveg, felado, valasz }) {
      if (!emailKesz(env)) throw new Error('SMTP_PASS nincs beallitva');
      const p = await kapcsolat();
      const user = env.SMTP_USER || 'mosaicheadspa@gmail.com';
      await p.send({ from: { name: felado || 'MOSAIC', email: user }, to, ...(valasz ? { reply: valasz } : {}), subject: targy, html, text: szoveg });
      return { id: 'smtp' };
    },
    async lezar() { if (posta) { try { await posta.close(); } catch { /* mar lezarult */ } posta = null; } },
  };
}
