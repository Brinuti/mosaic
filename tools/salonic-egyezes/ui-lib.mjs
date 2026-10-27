// Segedek: a Salonic nyilvanos foglalooldalanak (BOENGESZOS felulet) vegigjarasa; API-t nem hivunk kozvetlenul.
import { createRequire } from 'node:module';
// Playwright: a projekt node_modules-abol, vagy a felhos kornyezet globalis telepitesebol
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire('/opt/node22/lib/node_modules/')('playwright'); }
export const { chromium } = pw;
export const MERO = /googletagmanager|google-analytics|googleadservices|doubleclick|stape|facebook|fbcdn|tiktok|google\.com\/(ccm|rmkt|pagead)|clarity|hotjar|convertize|analytics|cookieconsent/i;
export const H = 'https://mosaic-hair.salonic.hu';
export const PLACE = 10823;
export const BETTI = '23694';

export async function ujKontextus(b) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest' });
  await ctx.route((u) => MERO.test(u.toString()), (r) => r.abort());
  return ctx;
}

const pad = (n) => String(n).padStart(2, '0');
export const hhmm = (unix) => new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(unix * 1000));
export const nap = (unix) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date(unix * 1000));

/**
 * A Salonic foglaloja, vendegkent: szolgaltatas -> szakember-valaszto -> a szakember "Osszes idopont" -> datumvalaszto.
 * Visszaad: { idopontok: Set<unix>, elerheto: bool, hiba?: string }; a datumvalaszton minden elerheto napra rakattint es kiolvassa a gombokat.
 */
export async function salonicIdopontok(page, serviceId, staffId = BETTI, { maxHonap = 9 } = {}) {
  const ki = new Set();
  if (String(staffId) === '-1') await page.goto(`${H}/selectDate/?employeeId=-1&placeId=${PLACE}&serviceId=${serviceId}&mh_nincs_atiranyitas=1`, { waitUntil: 'load', timeout: 60000 });
  else await page.goto(`${H}/selectEmployee/?placeId=${PLACE}&serviceId=${serviceId}&mh_nincs_atiranyitas=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1500);
  // a szakember kartyaja: ha csak egy szakember van, a Salonic egybol a datumvalasztora ugrik
  let href = null;
  if (/selectEmployee/.test(page.url())) {
    href = await page.evaluate((id) => { const a = [...document.querySelectorAll('a')].find((x) => /selectDate/.test(x.getAttribute('href') || '') && new RegExp('employeeId=' + id + '(&|$)').test(x.getAttribute('href'))); return a ? a.getAttribute('href') : null; }, staffId);
    if (!href) return { idopontok: ki, elerheto: false, hiba: 'a szakember nincs a szakember-valasztoban' };
    await page.locator(`a[href*="employeeId=${staffId}&"][href*="selectDate"]`).first().click();
  }
  await page.waitForSelector('.mbsc-calendar-cell, [aria-label*="2026"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const olvas = () => page.evaluate(() => [...document.querySelectorAll('a[href*="guestData"]')].map((a) => +(new URL(a.href).searchParams.get('startDate'))).filter(Boolean));
  page.__emp = new Map();
  const empJegyez = async () => { for (const [u, e] of await page.evaluate(() => [...document.querySelectorAll('a[href*="guestData"]')].map((a) => [+(new URL(a.href).searchParams.get('startDate')), new URL(a.href).searchParams.get('employeeId')])) ) page.__emp.set(u, e); };
  // csak az AKTIV honap sajat napjai (a szomszedos honap "kulso" napjaira kattintva nem toltodik az idopont-lista)
  const kattinthato = () => page.evaluate(() => {
    const out = [];
    for (const c of document.querySelectorAll('.mbsc-calendar-slide-active .mbsc-calendar-cell')) {
      if (c.classList.contains('mbsc-calendar-day-outer')) continue;
      const t = c.querySelector('[role=button][aria-label]'); if (!t) continue;
      if (t.getAttribute('aria-disabled') === 'true') continue;
      out.push(t.getAttribute('aria-label'));
    }
    return [...new Set(out)];
  });
  const honapFej = () => page.evaluate(() => (document.querySelector('.mbsc-calendar-year')?.textContent || '') + (document.querySelector('.mbsc-calendar-month')?.textContent || ''));
  const latott = new Set();
  for (let ho = 0; ho < maxHonap; ho++) {
    // a honap elerheto napjai kesve (a Salonic hatterbol tolti) kapcsolodnak be: tobb korben olvassuk, amig nem jon uj nap
    for (let kor = 0; kor < 4; kor++) {
      const uj = (await kattinthato()).filter((l) => !latott.has(l));
      if (!uj.length) { if (kor >= 1) break; await page.waitForTimeout(1500); continue; }
      for (const label of uj) {
        latott.add(label);
        // a kattintott nap datuma (label: "Pentek, November 6, 2026"); az idopont-lista csak akkor szamit, ha a gombok a NAP datumara esnek (a lista kesve frissul)
        const m = label.match(/([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]+) (\d{1,2}), (\d{4})$/);
        const cel = m ? `${m[3]}-${String(HONAP[ekezetnelkul(m[1])]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}` : null;
        const napiak = () => olvas().then((l) => l.filter((u) => nap(u) === cel));
        let ol = [];
        // ha a kattintas tul hamar jon az elozo nap betoltese utan, a Salonic elnyeli: ujraprobaljuk (legfeljebb 3-szor)
        for (let proba = 0; proba < 3 && !ol.length; proba++) {
          await page.waitForTimeout(proba ? 1500 : 700);
          await page.locator(`.mbsc-calendar-slide-active .mbsc-calendar-cell:not(.mbsc-calendar-day-outer) [role=button][aria-label="${label}"]`).first().click({ force: true });
          for (let i = 0; i < 20; i++) { await page.waitForTimeout(250); ol = await napiak(); if (ol.length) break; }
        }
        if (ol.length) { await page.waitForTimeout(400); ol = await napiak(); } // a lista teljes betoltese
        if (process.env.DBG) console.log('  nap', label, 'cel', cel, '->', ol.map(hhmm).join(' ') || '(nincs)', '| lathato anchorok:', (await olvas()).map((u) => nap(u) + 'T' + hhmm(u)).join(' '), '| url', page.url().slice(-60));
        await empJegyez();
        for (const u of ol) ki.add(u);
      }
      await page.waitForTimeout(1200);
    }
    const kov = page.locator('.mbsc-calendar-button-next, [aria-label*="Next" i], [aria-label*="Következő" i]').first();
    if (!(await kov.count()) || (await kov.isDisabled().catch(() => false)) || (await kov.getAttribute('aria-disabled')) === 'true') break;
    const fejElotte = await honapFej();
    await kov.click({ force: true }).catch(() => {});
    await page.waitForFunction((x) => (document.querySelector('.mbsc-calendar-year')?.textContent || '') + (document.querySelector('.mbsc-calendar-month')?.textContent || '') !== x, fejElotte, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  return { idopontok: ki, elerheto: true, napok: latott.size };
}

const HONAP = { januar: 1, februar: 2, marcius: 3, aprilis: 4, majus: 5, junius: 6, julius: 7, augusztus: 8, szeptember: 9, oktober: 10, november: 11, december: 12 };
const ekezetnelkul = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const MOTOR = process.env.MOTOR_URL || 'https://www.mosaicheadspa.hu';

/**
 * A Mosaic foglalomotor, vendegkent: konkret szolgaltatas -> a fodrasz-valaszto "Betti" -> naptar. Minden "szabad" napra rakattint, kiolvassa az idopont-gombokat.
 * Visszaad: { idopontok: Set<"YYYY-MM-DD HH:MM">, napok }.
 */
export async function motorIdopontok(page, serviceId, staffName = 'Betti', { maxHonap = 9 } = {}) {
  const ki = new Set();
  await page.goto(`${MOTOR}/foglalo-motor?business=hair&service=${serviceId}`, { waitUntil: 'load', timeout: 60000 });
  // a fodrasz-valaszto (ha a kezelesnek tobb fodrasza van); egy fodrasznal / a konzultacional a motor egybol a naptarra ugrik (ilyenkor NEM szurunk fodraszra)
  let valaszto = false;
  for (let i = 0; i < 120; i++) {
    if (await page.locator('.be-nnap').count()) break;
    if (await page.getByText('Melyik fodrászt választod').count()) { await page.waitForTimeout(500); await page.getByText(staffName, { exact: false }).first().click(); valaszto = true; break; }
    await page.waitForTimeout(250);
  }
  const van = await page.waitForSelector('.be-nnap', { state: 'attached', timeout: 45000 }).then(() => true).catch(() => false);
  if (!van) return { idopontok: ki, napok: 0, hiba: 'a naptar nem toltodott be' };
  await page.waitForTimeout(2500); // a tovabbi honapok idopontjai kesobb erkeznek (onMore)
  const fej = () => page.evaluate(() => { const t = document.body.innerText; const m = t.match(/(20\d\d)\.\s*([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]+)/); return m ? [m[1], m[2]] : null; });
  const latott = new Set();
  for (let ho = 0; ho < maxHonap; ho++) {
    const f = await fej();
    if (!f) break;
    const ev = +f[0], hon = HONAP[ekezetnelkul(f[1])];
    const napok = await page.evaluate(() => [...document.querySelectorAll('.be-nnap.szabad')].map((e) => e.textContent.trim()));
    for (const d of napok) {
      const kulcs = `${ev}-${hon}-${d}`;
      if (latott.has(kulcs)) continue;
      latott.add(kulcs);
      await page.locator('.be-nnap.szabad', { hasText: new RegExp('^' + d + '$') }).first().click({ force: true });
      await page.waitForTimeout(250);
      const ts = await page.evaluate(() => [...document.querySelectorAll('.be-idogomb')].map((e) => e.textContent.trim()));
      for (const t of ts) ki.add(`${ev}-${String(hon).padStart(2, '0')}-${String(d).padStart(2, '0')} ${t}`);
    }
    const kov = page.locator('button[aria-label="Következő hónap"]').first();
    if (!(await kov.count()) || (await kov.isDisabled().catch(() => false))) break;
    await kov.click({ force: true });
    await page.waitForTimeout(700);
  }
  return { idopontok: ki, napok: latott.size, valaszto };
}
