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

async function hiv(method, path, body) {
  try {
    const r = await fetch(api + path, {
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
const gyujt = await hiv("GET", "/collections");
const gyujtLista = dokumentumok(gyujt.json);
console.log(`GET /collections -> ${gyujt.status}${gyujtLista ? `, ${gyujtLista.length} kollekcio` : ""}${gyujt.hiba ? " " + gyujt.hiba : ""}`);
if (gyujtLista) {
  const nevek = gyujtLista.map((c) => (c && (c.name || c.id || c.collection)) || "?").slice(0, 50);
  console.log(`  kollekcio-nevek: ${nevek.join(", ")}`);
}

const hatar = Date.now() - NAPOK * 86400000;
for (const kol of KOLLEKCIOK) {
  const e = encodeURIComponent(kol);
  const probak = [
    ["POST", `/collections/${e}/documents/filter`, { limit: 1000 }],
    ["POST", `/collections/${e}/documents/filter`, {}],
    ["GET", `/collections/${e}/documents?limit=1000`, undefined],
    ["GET", `/collections/${e}/documents`, undefined],
  ];
  let docs = null;
  for (const [m, p, b] of probak) {
    const r = await hiv(m, p, b);
    const d = dokumentumok(r.json);
    console.log(`${kol}: ${m} ${p.replace(e, "<kol>")} -> ${r.status}${d ? `, ${d.length} dokumentum` : ""}${r.hiba ? " " + r.hiba : ""}`);
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
