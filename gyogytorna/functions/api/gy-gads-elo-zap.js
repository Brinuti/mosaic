// /api/gy-gads-elo-zap - a logika: lib/google-elo-zap.js (UJ-94 / DECISION #264 (b): validateOnly-proba az ELO akcion, Zapier-mintan; alapbol KI: GY_GADS_ELO_ZAP)
import { burok } from '../../lib/burok.js';
import { eloZapVegpont } from '../../lib/google-elo-zap.js';

export const onRequest = burok('gy-gads-elo-zap', eloZapVegpont);
