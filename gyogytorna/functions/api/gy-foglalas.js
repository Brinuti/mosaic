// /api/gy-foglalas - a logika: lib/motor-szerver.js (foglalasVegpont)
import { foglalasVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';
import { eloUtan } from '../../lib/elo-burok.js'; // UJ-72: csere nelkuli potlas az elo akcion (alapbol KI: GY_GADS_ELO)

export const onRequest = eloUtan(burok('gy-foglalas', foglalasVegpont));
