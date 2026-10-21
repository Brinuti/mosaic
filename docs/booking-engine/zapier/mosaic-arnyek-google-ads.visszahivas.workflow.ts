import { defineDurable } from "@zapier/zapier-durable";
import { createZapierSdk } from "@zapier/zapier-sdk";
import { z } from "zod";

// 2026-10-06 QA-2 ARNYEK-ag. A Cloudflare-szerver (PR #128) ide kuld egy lapos JSON-t:
// { conversion_action_id, gclid|gbraid|wbraid, conversion_date_time, value, currency, order_id, ad_user_data?, dryrun? }
// CSAK a 10 ARNYEK masodlagos akciora tolt fel; minden mas akcio-azonositot elutasit.
// dryrun=true -> semmit nem kuld, visszaadja a kesz kerest (QA-bizonyitek).
//
// 2026-10-21 UJ-11 (DRAFT, #167 6321101806): a feltoltes UTAN visszahivja a szervert (POST /api/meres-google-valasz), hogy a motor
// naplozza a kimenetelt (meres_kuldes.google_reszleges_hiba). A visszahivas SOHA nem befolyasolja a feltoltest:
//  - kulon lepes, kulon try/catch; a hibaja csak a visszaadott objektum `visszahivas` mezojeben latszik;
//  - a Google Ads lepes nem ujraprobalodik emiatt (nincs dupla konverzio);
//  - dryrun-nal nincs visszahivas (a dryrun semmit nem kuld).
// A kulcs a Zapier Storage 'mosaic_google_valasz_kulcs' kulcsan van (a szerver oldalon ennek a SHA-256-ja a MERES_GOOGLE_VALASZ_KULCS_HASH).
// A kulcs olvasasa es a hivas EGY lepesben tortenik (mint a lifecycle-tick workflow-ban), igy a futasnaplo a kulcsot soha nem orzi.
// Kod-szerzodes (kod): "" = a Zapier Google Ads lepese hiba nelkul lefutott; ZAP_HIBA = a lepes hibaval allt le (2 proba utan); ZAP_KIHAGYVA = a kapuk valamelyike eldobta (reason az uzenetben).
// FIGYELEM: a Zapier Google Ads action NEM adja vissza a Google partialFailure objektumot; a "" tehat azt jelenti: "a Zapier action nem dobott hibat", nem azt, hogy a Google minden sort elfogadott.
// Kattintas-azonosito (gclid / wbraid / gbraid / googleClickId), hash, e-mail, IP, user agent SOHA nem megy a visszahivasba.

const sdk = createZapierSdk();
const GOOGLE_ADS_APP = "GoogleAdsCLIAPI";
const GOOGLE_ADS_CONNECTION = "google_ads_mosaic";
const ADS_CUSTOMER_ID = "6088874770";
const VISSZAHIVAS_URL = "https://www.mosaicheadspa.hu/api/meres-google-valasz";
const VISSZAHIVAS_KULCS_NEV = "mosaic_google_valasz_kulcs";

const ARNYEK: Record<string, string> = {
  "7825199989": "ARNYEK - HeadSpa - Elso foglalas",
  "7825199992": "ARNYEK - HeadSpa - Ajandekkartya",
  "7825199995": "ARNYEK - Fodrasz - Elso foglalas",
  "7825200898": "ARNYEK - Fodrasz - Konzultacio",
  "7825200901": "ARNYEK - Oxigen - Elso foglalas",
  "7825200904": "ARNYEK - Oxigen - Konzultacio",
  "7825200907": "ARNYEK - Szor - Elso foglalas",
  "7825200910": "ARNYEK - Szor - Konzultacio",
  "7825200913": "ARNYEK - PMU - Foglalas",
  "7825200916": "ARNYEK - PMU - Konzultacio",
};

const S = z.string().nullable().optional();
const InputSchema = z.object({
  conversion_action_id: z.union([z.string(), z.number()]).nullable().optional(),
  gclid: S, gbraid: S, wbraid: S,
  conversion_date_time: S,
  value: z.union([z.number(), z.string()]).nullable().optional(),
  currency: S,
  order_id: S,
  ad_user_data: S,
  dryrun: z.union([z.boolean(), z.string()]).nullable().optional(),
}).loose();

function normalizeInput(raw: unknown): unknown {
  let v: unknown = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return {}; } }
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  for (const k of ["content", "body", "raw_body"]) {
    if (typeof o[k] === "string") { try { const p = JSON.parse(o[k] as string); if (p && typeof p === "object") return p; } catch { /* */ } }
  }
  return o;
}
const t = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const igaz = (v: unknown): boolean => v === true || (typeof v === "string" && ["true", "1", "igen"].includes(v.trim().toLowerCase()));

// A visszahivas: a feltoltes kimenetelenek jelzese a motornak. Soha nem dob (a hivo ugyis try/catch-ben van), csak leirja, mi tortent.
async function visszahiv(ctx: any, torzs: { esemeny_id: string; kod: string; uzenet?: string; elfogadva?: number; elutasitva?: number }): Promise<Record<string, unknown>> {
  try {
    return await ctx.step({
      name: "visszahivas-szerver",
      maxAttempts: 3,
      retryDelaySeconds: 30,
      run: async () => {
        const s: any = await sdk.runAction({ appKey: "StorageCLIAPI", actionType: "search", actionKey: "get_value", connection: "storage", inputs: { key: VISSZAHIVAS_KULCS_NEV } });
        const row = s?.data?.[0] ?? {};
        const kulcs = String(row.value ?? row[VISSZAHIVAS_KULCS_NEV] ?? "");
        if (kulcs.length < 32) throw new Error(VISSZAHIVAS_KULCS_NEV + " hianyzik a Storage-bol");
        const r: any = await sdk.runAction({
          appKey: "WebHookCLIAPI", actionType: "write", actionKey: "custom",
          inputs: { method: "POST", url: VISSZAHIVAS_URL, data: JSON.stringify(torzs), headers: { "content-type": "application/json", "x-meres-google-kulcs": kulcs }, return_raw_response: "yes" },
        });
        const d = r?.data?.[0] ?? {};
        const status = Number(d.status ?? 0);
        if (!(status >= 200 && status < 300)) throw new Error("visszahivas " + status + ": " + String(d.response ?? "").slice(0, 120));
        return { ok: true, status };
      },
    });
  } catch (e) {
    return { ok: false, hiba: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
}

export default defineDurable<unknown, unknown>("mosaic-arnyek-google-ads", async (ctx, rawInput) => {
  const a = InputSchema.parse(normalizeInput(rawInput));
  const actionId = t(a.conversion_action_id);
  const nev = ARNYEK[actionId];
  if (!nev) return { skipped: true, reason: "nem-arnyek-akcio", actionId };
  const orderId = t(a.order_id);
  if (!orderId) return { skipped: true, reason: "hianyzo-order_id", actionId };
  const dry = igaz(a.dryrun);
  const kihagy = async (reason: string) => {
    const vh = dry ? null : await visszahiv(ctx, { esemeny_id: orderId, kod: "ZAP_KIHAGYVA", uzenet: reason });
    return { skipped: true, reason, orderId, ...(vh ? { visszahivas: vh } : {}) };
  };
  const ertek = Number(a.value);
  if (!Number.isFinite(ertek) || ertek < 0) return await kihagy("rossz-ertek");
  if (t(a.currency).toUpperCase() !== "HUF") return await kihagy("nem-huf");
  const clickKey = t(a.gclid) ? "gclid" : t(a.wbraid) ? "wbraid" : t(a.gbraid) ? "gbraid" : "";
  if (!clickKey) return await kihagy("nincs-kattintas-azonosito");
  const consent = ["GRANTED", "DENIED"].includes(t(a.ad_user_data).toUpperCase()) ? t(a.ad_user_data).toUpperCase() : "UNSPECIFIED";

  const ido = await ctx.step("capture-conversion-time", async () => {
    const ms = Date.parse(t(a.conversion_date_time));
    return (Number.isFinite(ms) ? new Date(ms) : new Date()).toISOString();
  });

  const inputs: Record<string, unknown> = {
    mainAccountId: ADS_CUSTOMER_ID,
    managedAccountId: ADS_CUSTOMER_ID,
    name: actionId + "::" + nev,
    identifier_source: [clickKey],
    [clickKey]: t((a as Record<string, unknown>)[clickKey]),
    order_id: orderId,
    time: ido,
    value: ertek,
    currency: "HUF",
    adUserData: consent,
  };

  if (dry) return { dryrun: true, keres: inputs };

  let eredmeny: Record<string, unknown>;
  let kod = "";
  let uzenet: string | undefined;
  let elfogadva: number | undefined;
  let elutasitva: number | undefined;
  try {
    const sent = await ctx.step({
      name: "send-google-ads-arnyek-conversion",
      maxAttempts: 2,
      retryDelaySeconds: 30,
      run: async () => sdk.runAction({
        appKey: GOOGLE_ADS_APP,
        actionType: "write",
        actionKey: "send_offline_conversion_v2",
        connection: GOOGLE_ADS_CONNECTION,
        inputs,
      }),
    });
    const valasz = sent.data?.[0] ?? null;
    eredmeny = { sent: true, orderId, actionId, clickKey, consent, valasz };
    elfogadva = 1; elutasitva = 0;
    if (valasz && valasz.requestId) uzenet = "requestId=" + String(valasz.requestId).slice(0, 60); // a googleClickId-t SZANDEKOSAN nem visszuk
  } catch (e) {
    const hiba = e instanceof Error ? e.message : String(e);
    eredmeny = { sent: false, orderId, actionId, clickKey, hiba };
    kod = "ZAP_HIBA"; uzenet = hiba.slice(0, 200); elfogadva = 0; elutasitva = 1;
  }
  // A feltoltes eredmenye mar eldolt; a visszahivas hibaja nem valtoztat rajta.
  const vh = await visszahiv(ctx, { esemeny_id: orderId, kod, uzenet, elfogadva, elutasitva });
  return { ...eredmeny, visszahivas: vh };
});
