// Playwright betoltese: a projekt node_modules-abol, vagy a felhos kornyezet
// globalis telepitesebol (/opt/node22/lib/node_modules).
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire('/opt/node22/lib/node_modules/')('playwright'); }
export const { chromium, devices } = pw;
