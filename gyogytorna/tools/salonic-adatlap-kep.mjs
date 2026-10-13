// A valodi Salonic adatlap a gy.css-sel (foglalas nelkul): node tools/salonic-adatlap-kep.mjs <szelesseg> <magassag> <kimenet.png> [startUnix employeeId]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const [w, h, out] = process.argv.slice(2);
const { createSalonicAdapter } = await import('../public/assets/js/motor/salonic-adapter.js');
const szabad = await createSalonicAdapter({}).getAvailability(8439, '24666', { days: 20 }); // egy MOST szabad idopont (a foglalt idopont visszadob a naptarba)
const slot = szabad[Math.floor(szabad.length / 2)];
const start = slot.start_unix, emp = slot.staff_id;
const css = fs.readFileSync(new URL('../public/salonic/gy.css', import.meta.url), 'utf8');
const b = await chromium.launch({ args: ['--disable-http2'] });
const c = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: +w, height: +h }, isMobile: +w < 600, hasTouch: +w < 600 });
const p = await c.newPage();
await p.goto(`https://gyogytornaszomhu.salonic.hu/guestData/?placeId=8439&serviceId=24666&employeeId=${emp}&startDate=${start}&lang=hu&back=mb_proba123456789012`, { waitUntil: 'load', timeout: 60000 });
if (!process.env.ELO_CSS) await p.addStyleTag({ content: css });
await p.waitForTimeout(1500);
const m = await p.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, innerH: innerHeight, scrollW: document.documentElement.scrollWidth, cookie: !!document.querySelector('.cc-window') && document.querySelector('.cc-window').getBoundingClientRect().height }));
console.log(JSON.stringify(m));
await p.screenshot({ path: out });
await b.close();
