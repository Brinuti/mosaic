// UJ-72: a Pages Function-burok utan (alapbol KI: GY_GADS_ELO) a csere nelkuli potlas sweep-je waitUntil-lel. A valasz nem fugg tole, a hiba elnyelt.
import { eloPotlas, eloMod } from './google-elo.js';
import { budapestIdo } from './motor-szerver.js';

export const eloUtan = (alap) => async (context) => {
  const valasz = await alap(context);
  try {
    if (context.waitUntil && context.env && context.env.GY_DB && eloMod(context.env) !== 'ki') context.waitUntil(eloPotlas({ db: context.env.GY_DB, env: context.env, budapestIdo, host: new URL(context.request.url).hostname }));
  } catch (e) { /* a potlas hibaja nem erintheti a valaszt */ }
  return valasz;
};
