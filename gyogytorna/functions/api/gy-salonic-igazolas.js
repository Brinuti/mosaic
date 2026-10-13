import { burok } from '../../lib/burok.js';
import { igazolasVegpont } from '../../lib/motor-szerver.js';
export const onRequest = burok('gy-salonic-igazolas', igazolasVegpont);
