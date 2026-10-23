// A76 Stape Store szamlalo (01-MERES, A76-3) – CSAK OLVAS, CSAK DARABSZAMOT IR KI.
//
// Bemenet (kornyezeti valtozok):
//   STAPE_KEY   – az A76 sGTM kontener "Container API Key"-e (GitHub secret, soha nem irjuk ki)
//   STAPE_BASE  – a kontener domainje, alap: https://stape.a76.hu
//   KOLLEKCIOK  – vesszovel elvalasztva, alap: a76_schedule_log,a76_foglalas_forras
//   NAPOK       – hany napra visszamenoleg szamoljunk, alap: 7
//
// Kimenet: vegpontonkent HTTP-statusz, kollekcionkent dokumentumszam, a dokumentumok
// MEZONEVEI (ertek nelkul) es napi (budapesti) darabszam, ha talal idobelyeg-mezot.
// Vendegadat, azonosito, ertek NEM kerul a naploba.

const KEY = process.env.STAPE_KEY || "";
const BASE = (process.env.STAPE_BASE || "https://stape.a76.hu").replace(/\/+$/, "");
const KOLLEKCIOK = (process.env.KOLLEKCIOK || "a76_schedule_log,a76_foglalas_forras")
  .split(",").map((s) => s.trim()).filter(Boolean);
const NAPOK = Math.max(1, Math.min(60, Number(process.env.NAPOK || 7)));

if (!KEY) {
  console.log("HIBA: a STAPE_KEY (secret STAPE_A76_CONTAINER_KEY) nincs beallitva.");
  process.exit(1);
}

const api = `${BASE}/stape-api/${KEY}/v2/store`;
const rejt = (s) => String(s).split(KEY).join("***");

async function hiv(method, path, body) { return hivUrl(method, api + path, body); }
async function hivUrl(method, url, body) {
  try {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* nem JSON */ }
    return { status: r.status, json };
  } catch (e) {
    return { status: 0, json: null, hiba: rejt(e && e.message ? e.message : e) };
  }
}

// Dokumentumlista kikeresese tetszoleges valaszformabol.
function dokumentumok(json) {
  if (!json) return null;
  if (Array.isArray(json)) return json;
  for (const k of ["data", "documents", "items", "results", "docs"]) {
    const v = json[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      const belso = dokumentumok(v);
      if (belso) return belso;
    }
  }
  return null;
}

const IDO_MEZOK = /^(timestamp|ts|time|created|created_at|createdAt|updated_at|updatedAt|date|datum|ido|event_time|t)$/i;

function idobelyeg(doc) {
  const forrasok = [doc, doc && doc.data, doc && doc.document, doc && doc.fields].filter(
    (x) => x && typeof x === "object",
  );
  for (const f of forrasok) {
    for (const [k, v] of Object.entries(f)) {
      if (!IDO_MEZOK.test(k)) continue;
      let ms = null;
      if (typeof v === "number") ms = v > 1e12 ? v : v * 1000;
      else if (typeof v === "string" && /^\d{10,13}$/.test(v)) ms = Number(v) > 1e12 ? Number(v) : Number(v) * 1000;
      else if (typeof v === "string" && !Number.isNaN(Date.parse(v))) ms = Date.parse(v);
      if (ms) return { mezo: k, ms };
    }
  }
  return null;
}

function mezonevek(docs) {
  const nevek = new Set();
  for (const d of docs.slice(0, 50)) {
    for (const f of [d, d && d.data].filter((x) => x && typeof x === "object")) {
      for (const k of Object.keys(f)) nevek.add(k);
    }
  }
  return [...nevek].sort();
}

const budapestNap = (ms) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(new Date(ms));

console.log(`A76 Stape Store szamlalo – ${new Date().toISOString()} – ${NAPOK} nap`);

// Nyilvanos OpenAPI-leiras (kulcs NELKUL): csak az utvonal-listat irjuk ki,
// hogy a "Filter documents" pontos utvonala kiderudjon (fejleszto javaslata, #167 6362376438).
const DOC_JELOLTEK = [
  "https://store-api.stape.io/v2/doc/json",
  "https://store-api.stape.io/v2/doc-json",
  "https://store-api.stape.io/v2/openapi.json",
  "https://store-api.stape.io/v2/swagger.json",
  "https://store-api.stape.io/v2/docs/json",
  "https://store-api.stape.io/doc-json",
  "https://store-api.stape.io/v2/doc/openapi.json",
  "https://store-api.stape.io/v2/doc/swagger.json",
  "https://store-api.stape.io/v2/doc",
];
for (const url of DOC_JELOLTEK) {
  let status = 0, json = null, tipus = "", szovegHossz = 0, hivatkozasok = [];
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    status = r.status;
    tipus = r.headers.get("content-type") || "";
    const t = await r.text();
    szovegHossz = t.length;
    try { json = JSON.parse(t); } catch {
      // HTML eseten a beagyazott spec-hivatkozasokat irjuk ki (json/yaml)
      hivatkozasok = [...new Set((t.match(/["'(][^"'()\s]*\.(?:json|ya?ml)[^"'()\s]*["')]/g) || []).map((s) => s.slice(1, -1)))].slice(0, 10);
    }
  } catch (e) { tipus = "hiba: " + (e && e.message ? e.message : e); }
  console.log(`OPENAPI ${url} -> ${status} ${tipus} (${szovegHossz} karakter)${hivatkozasok.length ? " spec-hivatkozasok: " + hivatkozasok.join(" ") : ""}`);
  if (json && json.paths && typeof json.paths === "object") {
    for (const [p, ops] of Object.entries(json.paths)) {
      for (const [m, op] of Object.entries(ops || {})) {
        if (!/^(get|post|put|patch|delete)$/i.test(m)) continue;
        const cim = (op && (op.summary || op.operationId)) || "";
        console.log(`  ${m.toUpperCase()} ${p} – ${cim}`);
        if (/filter|search|documents/i.test(p + " " + cim) && op && op.requestBody) {
          console.log(`    body: ${JSON.stringify(op.requestBody).slice(0, 800)}`);
        }
      }
    }
    break;
  }
}
const gyujt = await hiv("GET", "/collections");
const gyujtLista = dokumentumok(gyujt.json);
console.log(`GET /collections -> ${gyujt.status}${gyujtLista ? `, ${gyujtLista.length} kollekcio` : ""}${gyujt.hiba ? " " + gyujt.hiba : ""}`);
const talaltNevek = [];
if (gyujtLista) {
  const elso = gyujtLista[0];
  console.log(`  kollekcio-objektum mezonevei: ${elso && typeof elso === "object" ? Object.keys(elso).join(", ") : typeof elso}`);
  for (const c of gyujtLista.slice(0, 50)) {
    if (typeof c === "string") { talaltNevek.push(c); continue; }
    const nev = c && Object.entries(c).find(([k, v]) => /name|collection|title|slug|key/i.test(k) && typeof v === "string");
    if (nev) talaltNevek.push(nev[1]);
  }
  console.log(`  kollekcio-nevek: ${talaltNevek.join(", ") || "-"}`);
}

const hatar = Date.now() - NAPOK * 86400000;
const vizsgalt = [...new Set([...KOLLEKCIOK, ...talaltNevek.filter((n) => /a76/i.test(n))])];
for (const kol of vizsgalt) {
  const e = encodeURIComponent(kol);
  const v1 = api.replace(/\/v2\/store$/, "/v1/store");
  const probak = [
    ["POST", `/collections/${e}/documents/filter`, { limit: 1000 }],
    ["POST", `/${e}/documents/filter`, { limit: 1000 }],
    ["POST", `/${e}/filter`, { limit: 1000 }],
    ["GET", `/${e}/documents`, undefined],
    ["GET", `/${e}`, undefined],
    ["POST", `/documents/filter`, { collection_name: kol, limit: 1000 }],
    ["GET", `/documents?collection_name=${e}&limit=1000`, undefined],
    ["GET", `/collections/${e}/documents?page=1&per_page=100`, undefined],
    ["GET", `/collections/${e}/documents`, undefined],
    ["POST", `/collections/${e}/documents/search`, { limit: 100 }],
    ["POST", `/collections/${e}/filter`, { limit: 100 }],
    ["POST", `/collections/${e}/search`, { limit: 100 }],
    ["POST", `/collections/${e}/documents/list`, { limit: 100 }],
    ["POST", `/documents/search`, { collection_name: kol, limit: 100 }],
    ["POST", `/filter`, { collection_name: kol, limit: 100 }],
    ["V1GET", `/${e}`, undefined],
    ["V1POST", `/${e}/search`, {}],
  ];
  let docs = null;
  for (const [m, p, b] of probak) {
    const r = m.startsWith("V1") ? await hivUrl(m.slice(2), v1 + p, b) : await hiv(m, p, b);
    const d = dokumentumok(r.json);
    const uzenet = r.json && typeof r.json === "object" && typeof (r.json.message || r.json.error) === "string" ? ` uzenet: ${rejt(String(r.json.message || r.json.error)).slice(0, 120)}` : "";
    const kulcsok = (!d && r.json && typeof r.json === "object" ? ` (valasz-mezok: ${Object.keys(r.json).join(", ")})` : "") + uzenet;
    console.log(`${kol}: ${m} ${p.split(e).join("<kol>")} -> ${r.status}${d ? `, ${d.length} dokumentum` : ""}${kulcsok}${r.hiba ? " " + r.hiba : ""}`);
    if (r.status >= 200 && r.status < 300 && d) { docs = d; break; }
  }
  if (!docs) { console.log(`${kol}: nem sikerult listazni.`); continue; }
  console.log(`${kol}: mezonevek (ertek nelkul): ${mezonevek(docs).join(", ") || "-"}`);
  const napi = {};
  let idoNelkul = 0;
  let idoMezo = null;
  for (const d of docs) {
    const t = idobelyeg(d);
    if (!t) { idoNelkul++; continue; }
    idoMezo = idoMezo || t.mezo;
    if (t.ms < hatar) continue;
    const nap = budapestNap(t.ms);
    napi[nap] = (napi[nap] || 0) + 1;
  }
  console.log(`${kol}: idobelyeg-mezo: ${idoMezo || "nincs"}; ido nelkuli dokumentum: ${idoNelkul}`);
  for (const nap of Object.keys(napi).sort()) console.log(`  ${nap}: ${napi[nap]}`);
}
