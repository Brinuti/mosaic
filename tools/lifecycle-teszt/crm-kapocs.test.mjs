// Az oxigen CRM kapocs a meglevo /api/lifecycle/bejovo vegponton: egy oxigen foglalas ERTESITOJE a lifecycle-ba es (ha van CRM_DB) a CRM-be is bekerul;
// CRM_DB nelkul / hibas CRM mellett a lifecycle valtozatlanul mukodik. Kitalalt vendeg, valodi kuldes nincs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../../netlify/lib/lifecycle/http.js';
import { d1 } from './seged.mjs';
import { ujAdatbazis } from '../../crm/lib/testdb.js';

const html = (sorok, uuid) => `<html><body><table><tr><td>Új online foglalás érkezett az alábbi adatokkal, melyet a rendszer automatikusan jóváhagyott:</td></tr>${sorok.map((s) => `<tr><td>${s}</td></tr>`).join('')}
<tr><td><a href="https://app.salonic.hu/backend/signin/?customer=mosaic-oxigen&amp;redirect=%2Fcalendar%2FshowBooking%2F%3FbookingId%3D${uuid}">Foglalás megtekintése</a></td></tr></table></body></html>`;
const level = (uuid, email) => ({ uzenetId: 'ox-' + uuid, targy: 'Új online foglalás érkezett: Haj Oxigénterápia - 1. alkalom', kuldo: 'Mosaic Oxigen <app@salonic.hu>',
  html: html(['Foglaló adatai:', 'Név: Demo Oxi', 'Mobiltelefonszám: 06301234567', `E-mail cím: ${email}`, 'Időpont adatok:', 'Szolgáltatás: Haj Oxigénterápia - 1. alkalom', 'Munkatárs: Teszt Kezelő', 'Kezdő dátum: november 25. (szerda) 16:00'], uuid) });
const kerees = (torzs, kulcs) => new Request('https://x.test/api/lifecycle/bejovo', { method: 'POST', headers: { 'content-type': 'application/json', 'x-lifecycle-kulcs': kulcs }, body: JSON.stringify(torzs) });
const hash = async (k) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k)))].map((b) => b.toString(16).padStart(2, '0')).join('');

test('K01 oxigen foglalas: a lifecycle ES a CRM is megkapja; ismetelt ertesito nem duplikal', async () => {
  const kulcs = 'tesztkulcs';
  const crm = await ujAdatbazis();
  const env = { LIFECYCLE_DB: d1(), CRM_DB: crm, LIFECYCLE_KULCS_HASH: await hash(kulcs), LIFECYCLE_MOD: 'ki', SMTP_PASS: '' };
  const uuid = '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
  const v1 = await (await api(kerees({ ...level(uuid, 'demo.oxi@example.invalid'), most: Math.floor(Date.now() / 1000) }, kulcs), env)).json();
  assert.equal(v1.ok, true);
  assert.equal((await crm.prepare('SELECT COUNT(*) AS n FROM booking').first()).n, 1);
  assert.equal((await crm.prepare('SELECT COUNT(*) AS n FROM guest').first()).n, 1);
  const v2 = await (await api(kerees({ ...level(uuid, 'demo.oxi@example.invalid'), uzenetId: 'ox-masodik-level', most: Math.floor(Date.now() / 1000) }, kulcs), env)).json();
  assert.equal(v2.ok, true);
  assert.equal((await crm.prepare('SELECT COUNT(*) AS n FROM booking').first()).n, 1, 'a masodik ertesito nem duplikal');
});

test('K02 CRM_DB nelkul / hibas CRM-mel a lifecycle valtozatlanul mukodik', async () => {
  const kulcs = 'tesztkulcs';
  const hashe = await hash(kulcs);
  const uuid = '11111111-2222-4333-8444-555555555555';
  const kozos = { LIFECYCLE_KULCS_HASH: hashe, LIFECYCLE_MOD: 'ki', SMTP_PASS: '' };
  const nincs = await (await api(kerees({ ...level(uuid, 'a@example.invalid') }, kulcs), { ...kozos, LIFECYCLE_DB: d1() })).json();
  assert.equal(nincs.ok, true);
  const rossz = { prepare() { throw new Error('crm halott'); }, batch() { throw new Error('crm halott'); } };
  const hibas = await (await api(kerees({ ...level(uuid.replace('1111', '2222'), 'b@example.invalid') }, kulcs), { ...kozos, LIFECYCLE_DB: d1(), CRM_DB: rossz })).json();
  assert.equal(hibas.ok, true);
});
