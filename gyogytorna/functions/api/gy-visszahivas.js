// /api/gy-visszahivas - a logika: lib/motor-szerver.js (visszahivasVegpont)
import { visszahivasVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';

export const onRequest = burok('gy-visszahivas', visszahivasVegpont);
