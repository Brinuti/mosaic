// /api/gy-idopont-ellenorzes - a logika: lib/motor-szerver.js (idopontEllenorzesVegpont)
import { idopontEllenorzesVegpont } from '../../lib/motor-szerver.js';
import { burok } from '../../lib/burok.js';

export const onRequest = burok('gy-idopont-ellenorzes', idopontEllenorzesVegpont);
