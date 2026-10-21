import { defineDurable } from "@zapier/zapier-durable";
import { createZapierSdk } from "@zapier/zapier-sdk";
import { z } from "zod";

// 2026-10-06 QA-2 ARNYEK-ag. A Cloudflare-szerver (PR #128) ide kuld egy lapos JSON-t:
// { conversion_action_id, gclid|gbraid|wbraid, conversion_date_time, value, currency, order_id, ad_user_data?, dryrun? }
// CSAK a 10 ARNYEK masodlagos akciora tolt fel; minden mas akcio-azonositot elutasit.
// dryrun=true -> semmit nem kuld, visszaadja a kesz kerest (QA-bizonyitek).

const sdk = createZapierSdk();
const GOOGLE_ADS_APP = "GoogleAdsCLIAPI";
const GOOGLE_ADS_CONNECTION = "google_ads_mosaic";
const ADS_CUSTOMER_ID = "6088874770";

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

export default defineDurable<unknown, unknown>("mosaic-arnyek-google-ads", async (ctx, rawInput) => {
  const a = InputSchema.parse(normalizeInput(rawInput));
  const actionId = t(a.conversion_action_id);
  const nev = ARNYEK[actionId];
  if (!nev) return { skipped: true, reason: "nem-arnyek-akcio", actionId };
  const orderId = t(a.order_id);
  if (!orderId) return { skipped: true, reason: "hianyzo-order_id", actionId };
  const ertek = Number(a.value);
  if (!Number.isFinite(ertek) || ertek < 0) return { skipped: true, reason: "rossz-ertek", orderId };
  if (t(a.currency).toUpperCase() !== "HUF") return { skipped: true, reason: "nem-huf", orderId };
  const clickKey = t(a.gclid) ? "gclid" : t(a.wbraid) ? "wbraid" : t(a.gbraid) ? "gbraid" : "";
  if (!clickKey) return { skipped: true, reason: "nincs-kattintas-azonosito", orderId };
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

  if (igaz(a.dryrun)) return { dryrun: true, keres: inputs };

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
    return { sent: true, orderId, actionId, clickKey, consent, valasz: sent.data?.[0] ?? null };
  } catch (e) {
    return { sent: false, orderId, actionId, clickKey, hiba: e instanceof Error ? e.message : String(e) };
  }
});
