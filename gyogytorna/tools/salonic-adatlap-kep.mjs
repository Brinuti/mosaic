// A valodi Salonic adatlap a gy.css-sel (foglalas nelkul): node tools/salonic-adatlap-kep.mjs <szelesseg> <magassag> <kimenet.png> [startUnix employeeId]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const [w, h, out] = process.argv.slice(2);
const { createSalonicAdapter } = await import('../public/assets/js/motor/salonic-adapter.js');
const szabad = await createSalonicAdapter({}).getAvailability(8439, '24666', { days: 20 }); // egy MOST szabad idopont (a foglalt idopont visszadob a naptarba)
const slot = szabad[Math.floor(szabad.length * (0.3 + 0.5 * Math.random()))];
const start = slot.start_unix, emp = slot.staff_id;
const css = fs.readFileSync(new URL('../public/salonic/gy.css', import.meta.url), 'utf8');
const b = await chromium.launch({ args: ['--disable-http2'] });
const c = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: +w, height: +h }, isMobile: +w < 600, hasTouch: +w < 600 });
const p = await c.newPage();
for (let kiserlet = 0; kiserlet < 6; kiserlet++) { // a sandbox-halozat miatt a Salonic sajat stiluslapja neha nem toltodik be: ujraprobalkozas
try { await p.goto(`https://gyogytornaszomhu.salonic.hu/guestData/?placeId=8439&serviceId=24666&employeeId=${emp}&startDate=${start}&lang=hu&back=mb_proba123456789012`, { waitUntil: 'load', timeout: 60000 }); } catch (e) { continue; }
await p.waitForTimeout(1500);
const jo = await p.evaluate(() => performance.getEntriesByType('resource').some((r) => /widget\.min\.css/.test(r.name) && r.decodedBodySize > 0) && typeof window.jQuery === 'function');
if (jo) break; }
await p.waitForTimeout(2500);
if (!/guestData/.test(p.url())) { console.log('atiranyitva:', p.url()); process.exit(2); }
if (!process.env.ELO_CSS) await p.addStyleTag({ content: css });
await p.waitForTimeout(1500);
const m = await p.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, innerH: innerHeight, scrollW: document.documentElement.scrollWidth, cookie: !!document.querySelector('.cc-window') && document.querySelector('.cc-window').getBoundingClientRect().height }));
console.log(JSON.stringify(m));
if (process.env.OSZTALY) console.log(await p.evaluate(() => { const o = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (/ perc/.test(n.textContent)) { let e = n.parentElement; for (let i = 0; i < 7 && e && e !== document.body; i++, e = e.parentElement) o.push(e.tagName + '.' + String(e.className).replace(/ /g, '.') + ' mb=' + getComputedStyle(e).marginBottom + ' pb=' + getComputedStyle(e).paddingBottom); break; } } return o.join('\n'); }));
await p.screenshot({ path: out });
await b.close();
