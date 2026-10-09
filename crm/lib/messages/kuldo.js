// Kuldo-adapterek: a motor (outbox) ezen a feluleten at kuld. Alapertelmezett: DRY_RUN (naplozza, NEM kuld).
//
//   adapter.kuld({ csatorna, cimzett, targy, html, szoveg }) -> Promise<{ allapot, szolgaltato_id, ... }>
//   csatorna: 'email' | 'sms' | 'internal' (a belso ertesites e-mailkent megy a cimzett.email-re)
//   cimzett:  string (e-mail cim / telefonszam) VAGY { email?, telefon?, teszt_only? }
//   allapot:  'DRY_RUN' | 'SENT' | 'FAILED'
//
// Az `eles` adapter KERET: csak akkor kuld valodit, ha konfig.kuldes === 'eles' ES a cimzett nem `teszt_only`. Alapbol (es hibas konfignal) mindig DRY_RUN.
// A tenyleges SMTP / SimpleSMS hivast a meglevo netlify/lib/lifecycle/kuldok.js vegzi (kuldokKeszit); teszthez cserelheto (kuldokGyar).
import { kuldokKeszit } from '../../../netlify/lib/lifecycle/kuldok.js';
import { normalizal } from '../../../netlify/lib/lifecycle/telefon.js';

export const KULDES_DRY = 'dry';
export const KULDES_ELES = 'eles';

/** Konfiguracio a kornyezetbol: CRM_KULDES=dry|eles (barmi mas = dry). */
export function konfigEnvbol(env = {}) {
  return { kuldes: env.CRM_KULDES === KULDES_ELES ? KULDES_ELES : KULDES_DRY };
}

const cimzettBontas = (cimzett) => {
  if (typeof cimzett === 'string') return cimzett.includes('@') ? { email: cimzett } : { telefon: cimzett };
  return cimzett || {};
};
const emailRe = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function ellenoriz({ csatorna, cimzett, szoveg, targy, html }) {
  const c = cimzettBontas(cimzett);
  if (csatorna === 'sms') {
    if (!szoveg) return 'hianyzo SMS-szoveg';
    if (!normalizal(c.telefon)) return 'ervenytelen telefonszam';
  } else if (csatorna === 'email' || csatorna === 'internal') {
    if (!emailRe.test(String(c.email || ''))) return 'ervenytelen e-mail cim';
    if (!targy || !(html || szoveg)) return 'hianyzo targy / torzs';
  } else return `ismeretlen csatorna: ${csatorna}`;
  return null;
}

/**
 * DRY_RUN adapter: nem kuld semmit, a hivasokat a `naplo` tombbe teszi (teszthez / helyi demohoz / a motor probajahoz).
 * @param {{naplo?: object[], most?: () => number}} [opc]
 */
export function dryRunAdapter(opc = {}) {
  const naplo = opc.naplo || [];
  let sorszam = 0;
  return {
    nev: 'dry_run',
    naplo,
    async kuld(uzenet, ok = 'dry_run') {
      const hiba = ellenoriz(uzenet);
      if (hiba) return { allapot: 'FAILED', szolgaltato_id: null, hiba, vegleges: true };
      sorszam += 1;
      const id = `dry-${sorszam}`;
      naplo.push({ id, ok, ido: opc.most ? opc.most() : null, csatorna: uzenet.csatorna, cimzett: uzenet.cimzett, targy: uzenet.targy || null, szoveg: uzenet.szoveg || null });
      return { allapot: 'DRY_RUN', szolgaltato_id: id, ok };
    },
    async lezar() {},
  };
}

/**
 * Eles adapter KERET. Csak akkor kuld valodit, ha:
 *   - konfig.kuldes === 'eles' (pontosan), es
 *   - a cimzett nem teszt_only (cimzett.teszt_only !== true).
 * Minden mas esetben a `tartalek` (DRY_RUN) adapterre esik vissza, es ezt az `ok` jelzi.
 * @param {{env: object, konfig: {kuldes: string}, kuldokGyar?: (env:object)=>object, tartalek?: object}} p
 *   kuldokGyar: alapbol a lifecycle kuldokKeszit(env) - { email({to,targy,html,szoveg,felado}), sms({telefon,szoveg}), lezar() }
 */
export function elesAdapterKeszit({ env, konfig, kuldokGyar = kuldokKeszit, tartalek = dryRunAdapter() }) {
  let kuldok = null;
  const kuldokok = () => (kuldok ||= kuldokGyar(env));
  return {
    nev: 'eles',
    tartalek,
    async kuld(uzenet) {
      if (!konfig || konfig.kuldes !== KULDES_ELES) return tartalek.kuld(uzenet, 'config_not_eles');
      const c = cimzettBontas(uzenet.cimzett);
      if (c.teszt_only === true) return tartalek.kuld(uzenet, 'teszt_only');
      const hiba = ellenoriz(uzenet);
      if (hiba) return { allapot: 'FAILED', szolgaltato_id: null, hiba, vegleges: true };
      try {
        if (uzenet.csatorna === 'sms') {
          const r = await kuldokok().sms({ telefon: normalizal(c.telefon), szoveg: uzenet.szoveg });
          return { allapot: 'SENT', szolgaltato_id: r.id };
        }
        const r = await kuldokok().email({ to: c.email, targy: uzenet.targy, html: uzenet.html, szoveg: uzenet.szoveg, felado: 'MOSAIC' });
        return { allapot: 'SENT', szolgaltato_id: r.id };
      } catch (e) {
        return { allapot: 'FAILED', szolgaltato_id: null, hiba: String(e && e.message || e).slice(0, 300), vegleges: !!(e && e.vegleges) };
      }
    },
    async lezar() { if (kuldok) await kuldok.lezar(); await tartalek.lezar(); },
  };
}

/** Konfig szerinti adapter: `kuldes: 'eles'` eseten az eles keret (tovabbra is csak nem teszt_only cimzettnek), kulonben DRY_RUN. */
export function kuldoKeszit({ env = {}, konfig = konfigEnvbol(env), kuldokGyar, naplo } = {}) {
  const dry = dryRunAdapter({ naplo });
  if (konfig.kuldes !== KULDES_ELES) return dry;
  return elesAdapterKeszit({ env, konfig, kuldokGyar, tartalek: dry });
}
