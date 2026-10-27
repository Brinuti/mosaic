import { burok } from '../../lib/burok.js';
import { igazolasVegpont } from '../../lib/motor-szerver.js';
import { eloUtan } from '../../lib/elo-burok.js'; // UJ-72: csere nelkuli potlas az elo akcion (alapbol KI: GY_GADS_ELO)
export const onRequest = eloUtan(burok('gy-salonic-igazolas', igazolasVegpont));
