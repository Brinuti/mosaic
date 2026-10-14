// public/ -> dist/ : a launcher.js-be beirja a kapcsolot (motor-kapcsolo.json) es a motor verziojat (a motor fajljainak hash-e).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const gyoker = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(gyoker, 'public');
const DIST = path.join(gyoker, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUB, DIST, { recursive: true });
const motorMappa = path.join(DIST, 'assets/js/motor');
const hash = crypto.createHash('sha256');
for (const f of fs.readdirSync(motorMappa).sort()) hash.update(fs.readFileSync(path.join(motorMappa, f)));
const verzio = hash.digest('hex').slice(0, 10);
const kapcsoloJson = JSON.parse(fs.readFileSync(path.join(PUB, 'motor-kapcsolo.json'), 'utf8'));
const kapcsolo = kapcsoloJson.arany;
const hivas = kapcsoloJson.hivas === 1 ? 1 : 0; // a visszahivas-kero lehetoseg (gomb az elso lepesben)
if (!Number.isInteger(kapcsolo) || kapcsolo < 0 || kapcsolo > 100) throw new Error('motor-kapcsolo.json: arany 0..100 egesz szam');
const l = path.join(DIST, 'assets/js/launcher.js');
fs.writeFileSync(l, fs.readFileSync(l, 'utf8').replaceAll('__GY_KAPCSOLO__', String(kapcsolo)).replaceAll('__GY_HIVAS__', String(hivas)).replaceAll('__GY_VERZIO__', verzio));
console.log(`dist kesz (kapcsolo ${kapcsolo}%, hivas ${hivas}, motor v${verzio})`);
