// A fejlec "i" ikonjara nyilo Wix-felugro ablak (lightbox "Infó", pageId rk7x7)
// felepitese statikus HTML-be.
//
// Az eles oldalon a felugro ablak tartalmat nem a HTML hozza: a Wix JS-e kattintasra
// tolti le a siteassets.parastorage.com-rol (a komponensfat, a szovegeket es a
// hozza tartozo CSS-t), es ugy rajzolja ki. A ?lightbox=rk7x7 cimre az SSR sem
// rajzolja ki. Ezert ugyanazt a ket valaszt toltjuk le, amit a Wix JS-e, es
// abbol epitjuk fel a DOM-ot ugyanazokkal az id-kkel es data-mesh-id-kkel,
// amikre a Wix CSS-e hivatkozik - igy a Wix sajat elrendezese valtozatlanul ervenyes.
//
//   node tools/popup-info.mjs              a tools/popup/*.json-bol epit
//   node tools/popup-info.mjs --letoltes   elobb ujra letolti oket (siteassets)
//
// Eredmeny: assets/popup/info.html (asztali) es assets/popup/info-mobil.html.
// Ezeket a tools/klon-kiegeszites.mjs <template>-kent szurja be minden oldalba,
// a klon.js pedig kattintasra onnan nyitja meg.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FORRAS = path.join(ROOT, 'tools/popup');
const KI = path.join(ROOT, 'assets/popup');
const POPUP = 'rk7x7';
const CIM = 'Infó';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// --- 0. letoltes (csak --letoltes eseten) -------------------------------
// A features-modul cimet egy lementett oldalbol vesszuk, es csak a pageId-t
// csereljuk a felugro ablak JSON-jara (a pagesMap-bol). A CSS-modul cimet a Wix
// JS-e ugyanebbol rakja ossze a modulesParams.css parametereivel.
async function letoltes() {
  const html = fs.readFileSync(path.join(ROOT, 'tools/raw-mobil/index.html'), 'utf8');
  const dekod = (s) => s.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
  const featCim = [...html.matchAll(/https:\/\/siteassets\.parastorage\.com\/pages\/pages\/thunderbolt\?[^"'\s]+/g)]
    .map((m) => dekod(m[0])).find((c) => c.includes('module=thunderbolt-features'));
  const jsonNev = html.match(new RegExp(`"${POPUP}":"(c2eb0f_[0-9a-f]+_\\d+\\.json)"`))[1];
  const cssFile = html.match(/"thunderbolt-css\\?":\\?"([0-9a-f]+\.bundle\.min)/)[1];
  const stylable = html.match(/"stylableMetadataURLs":(\[[^\]]*\])/)[1].replace(/\\\//g, '/');
  if (!featCim) throw new Error('nincs thunderbolt-features cim a tools/raw-mobil/index.html-ben');

  for (const nezet of ['mobil', 'asztali']) {
    const u = new URL(featCim);
    u.searchParams.set('pageId', jsonNev);
    if (nezet === 'asztali') {
      u.searchParams.set('viewMode', 'desktop');
      u.searchParams.set('formFactor', 'desktop');
      if (u.searchParams.has('deviceType')) u.searchParams.set('deviceType', 'Desktop');
    }
    const css = new URL(u);
    for (const k of ['languageResolutionMethod', 'isMultilingualEnabled', 'disableStaticPagesUrlHierarchy',
      'isTrackClicksAnalyticsEnabled', 'isSocialElementsBlocked']) css.searchParams.delete(k);
    css.searchParams.set('module', 'thunderbolt-css');
    css.searchParams.set('fileId', cssFile);
    css.searchParams.set('shouldRunVsm', 'true');
    css.searchParams.set('shouldRunCssInBrowser', 'false');
    css.searchParams.set('shouldGetCssResultObject', 'false');
    css.searchParams.set('stylableMetadataURLs', stylable);
    css.searchParams.sort();
    for (const [fajta, cim] of [['features', u], ['css', css]]) {
      const v = await fetch(cim, { headers: { 'user-agent': UA, referer: 'https://www.mosaicheadspa.hu/' } });
      if (!v.ok) throw new Error(`${nezet} ${fajta}: HTTP ${v.status}`);
      const t = await v.text();
      JSON.parse(t);
      fs.writeFileSync(path.join(FORRAS, `${POPUP}-${nezet}-${fajta}.json`), t);
      console.log(`letoltve: tools/popup/${POPUP}-${nezet}-${fajta}.json (${(t.length / 1024).toFixed(0)} kB)`);
    }
  }
}

// --- 1. a Wix komponensei -> HTML ---------------------------------------
// A DOM-minta a lementett oldalakban levo ugyanilyen komponensekkel egyezik
// (WRichText, Container/DefaultAreaSkin). A felugro ablak sajat keretenek
// (PopupPage, PopupContainer, bezaro gomb) osztalyai mh-popup-* nevuek, a
// megjelenesuket az alabbi KERET_CSS adja.
function epit(features) {
  const komp = features.structure.components;
  const props = features.props.render.compProps;

  const mesh = (id, belso) =>
    `<div data-mesh-id="${id}inlineContent" data-testid="inline-content" class="">`
    + `<div data-mesh-id="${id}inlineContent-gridContainer" data-testid="mesh-container-content">${belso}</div></div>`;

  // a Group gyerekei (a forgatott elemek sajat burkoloval, ahogy a Wix meshe kiirja)
  const gyerekek = (id) => {
    const forgatott = new Set(props[id]?.meshProps?.rotatedComponents || []);
    return (komp[id].components || []).map((g) => forgatott.has(g)
      ? `<div data-mesh-id="${g}-rotated-wrapper">${rajzol(g)}</div>`
      : rajzol(g)).join('');
  };

  function rajzol(id) {
    const k = komp[id], p = props[id] || {};
    switch (k.componentType) {
      case 'PopupPage':
        return `<div id="${id}" class="mh-popup-oldal">`
          + `<div class="mh-popup-fatyol" data-testid="popupOverlay"></div>`
          + mesh(`Container${id}`, k.components.map(rajzol).join(''))
          + `</div>`;
      case 'PopupContainer':
        // a PopupContainer egyetlen gyereke a "Container<id>" csoport
        return `<div id="${id}" class="mh-popup-doboz ${id}">`
          + `<div class="mh-popup-doboz-hatter"></div>`
          + mesh(k.components[0], gyerekek(k.components[0]))
          + `</div>`;
      case 'Container':
        return `<div id="${id}" class="gpDCD5 ${id}"><div class="jv9xi4 wixui-box" data-testid="container-bg"></div>`
          + mesh(id, gyerekek(id)) + `</div>`;
      case 'WRichText':
        return `<div id="${id}" class="N8MGzv _v6ohL AWXfZq PO9MfV ${id} wixui-rich-text" data-testid="richTextElement">`
          + linkek(p.html) + `</div>`;
      case 'PopupCloseIconButton':
        return `<div id="${id}" class="mh-popup-x ${id}" role="button" tabindex="0" aria-label="${p.translations?.a11yLabel || 'Bezárás'}" data-mh-popup-zar="">`
          + p.svgContent.trim().replace(/role=presentation aria-hidden=true/, 'role="presentation" aria-hidden="true"')
          + `</div>`;
      default:
        throw new Error(`ismeretlen komponens: ${k.componentType} (${id})`);
    }
  }

  return rajzol(POPUP);
}

// A belso linkek teljes Wix-cimrol helyi fajlnevre (ahogy a wix2static.mjs is).
// A mobil oldalak a klon/m/ alatt egymas mellett vannak, ezert a relativ nev
// mindket nezetben jo.
const oldalak = new Set(fs.readdirSync(path.join(ROOT, 'klon')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)));
function linkek(html) {
  return html.replace(/href="https:\/\/www\.mosaicheadspa\.hu\/?([^"#?]*)([^"]*)"/g, (egesz, ut, maradek) => {
    const slug = ut.replace(/^post\//, '').replace(/\/$/, '') || 'index';
    return oldalak.has(slug) ? `href="${slug}.html${maradek}"` : egesz;
  });
}

// --- 2. a Wix CSS-e -------------------------------------------------------
// A Wix @font-face szabalyai (a sajat CDN-jere mutatnak) kimaradnak, ahogy az
// oldalakon is: a klon sajat betukeszlete (lato, lato-light, roboto-thin) adja.
function wixCss(json) {
  return json.css.replace(/@font-face\s*\{[^}]*\}/g, '').replace(/\n{2,}/g, '\n').trim();
}

// --- 3. a felugro ablak kerete -------------------------------------------
// Az eles oldalon a Wix PopupPage/PopupContainer komponensei adjak: a fatyol a
// teljes ablakot takarja (szine a #rk7x7 --bg-overlay-color valtozoja), a doboz
// a racsban a Wix CSS-e szerinti helyen all (asztalin jobbra, fuggolegesen kozepen;
// mobilon kozepen), a beuszast a Wix CSS-eben levo motion-glideIn adja.
// A mesh margoi a szerkesztobeli helyzetet irjak le, a felugro ablakban a
// Wix ezeket nem hasznalja - a doboz helyet a justify-self/align-self adja.
// A Wix-oldalakon mar meglevo Container-osztalyok (gpDCD5, jv9xi4) nem minden
// oldalon szerepelnek, ezert ide is bekerulnek.
const KERET_CSS = `
.mh-popup-gyoker{position:fixed;inset:0;z-index:2147482000;}
.mh-popup-gyoker[hidden]{display:none;}
.mh-popup-oldal{position:absolute;inset:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}
.mh-popup-fatyol{position:fixed;inset:0;background-color:var(--bg-overlay-color);background-image:var(--bg-gradient,none);}
.mh-popup-oldal>[data-mesh-id$=inlineContent]{position:relative;min-height:100%;display:grid;}
.mh-popup-oldal>[data-mesh-id$=inlineContent]>[data-mesh-id$=gridContainer]{min-height:100%;}
.mh-popup-oldal [data-mesh-id$=inlineContent-gridContainer]>.mh-popup-doboz{margin:0!important;left:0!important;}
.mh-popup-doboz{box-sizing:border-box;}
.mh-popup-doboz-hatter{position:absolute;inset:0;background-color:var(--bg-overlay-color);background-image:var(--bg-gradient,none);}
.mh-popup-doboz>[data-mesh-id$=inlineContent]{position:relative;}
.mh-popup-x{cursor:pointer;display:block;}
.mh-popup-x svg{display:block;width:100%;height:100%;fill:var(--fill);fill-opacity:var(--fill-opacity);stroke:var(--stroke);stroke-width:var(--stroke-width);overflow:visible;}
.mh-popup-x:focus-visible{outline:2px solid #116dff;outline-offset:2px;}
.gpDCD5{--container-corvid-border-color:rgba(var(--brd,var(--color_15,color_15)),var(--alpha-brd,1));--container-corvid-border-size:var(--brw,1px);--container-corvid-background-color:rgba(var(--bg,var(--color_11,color_11)),var(--alpha-bg,1));}
.jv9xi4{border:var(--container-corvid-border-width,var(--brw,1px)) solid var(--container-corvid-border-color,rgba(var(--brd,var(--color_15,color_15)),var(--alpha-brd,1)));background-color:var(--container-corvid-background-color,rgba(var(--bg,var(--color_11,color_11)),var(--alpha-bg,1)));backdrop-filter:var(--backdrop-filter,none);background-image:var(--bg-gradient,none);border-radius:var(--rd,5px);box-shadow:var(--shd,0 1px 4px #0009);position:absolute;inset:0;}
`.trim();

// --- futtatas -------------------------------------------------------------
if (process.argv.includes('--letoltes')) await letoltes();
fs.mkdirSync(KI, { recursive: true });
for (const [nezet, fajl] of [['asztali', 'info.html'], ['mobil', 'info-mobil.html']]) {
  const features = JSON.parse(fs.readFileSync(path.join(FORRAS, `${POPUP}-${nezet}-features.json`), 'utf8'));
  const css = JSON.parse(fs.readFileSync(path.join(FORRAS, `${POPUP}-${nezet}-css.json`), 'utf8'));
  const html = [
    `<!-- Wix-felugro ablak "${CIM}" (${POPUP}), ${nezet} nezet - generalta: tools/popup-info.mjs -->`,
    `<div id="POPUPS_ROOT" class="mh-popup-gyoker" data-mh-popup="${POPUP}" role="dialog" aria-modal="true" aria-label="${CIM}" tabindex="-1" hidden>`,
    `<style>${KERET_CSS}\n${wixCss(css)}</style>`,
    epit(features),
    `</div>`,
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(KI, fajl), html);
  console.log(`assets/popup/${fajl.padEnd(16)} ${(html.length / 1024).toFixed(1)} kB`);
}
