import { defineDurable } from "@zapier/zapier-durable";
import { createZapierSdk } from "@zapier/zapier-sdk";
import { z } from "zod";

// 2026-10-11 MP ARNYEK (Feri "mehet a Google-feltoltes elesitese" 10:11). A Medical Piercing Cloudflare-szervere
// (medicalpiercing/lib/meres/google-ads.js zapierTorzs) ide kuld egy lapos JSON-t:
// { customer_id, conversion_action_id, gclid|gbraid|wbraid, conversion_date_time, order_id, ad_user_data, value?, currency?, dryrun? }
// CSAK a 2626380837 fiok 3 ARNYEK masodlagos akciojara tolt fel; minden mast elutasit. A Mosaic Zapjatol fuggetlen.
// dryrun=true -> semmit nem kuld, a kesz kerest adja vissza (kattintasazonosito kitakarva).

const sdk = createZapierSdk();
const GOOGLE_ADS_APP = "GoogleAdsCLIAPI";
const GOOGLE_ADS_CONNECTION = "google_ads_mp";
const ADS_CUSTOMER_ID = "2626380837";

const ARNYEK: Record<string, string> = {
  "7834926162": "ARNYEK - MP - Foglalas",
  "7834926165": "ARNYEK - MP - Foglalas - uj vendeg",
  "7834926168": "ARNYEK - MP - Foglalas - visszatero",
};

const S = z.string().nullable().optional();
const InputSchema = z.object({
  customer_id: z.union([z.string(), z.number()]).nullable().optional(),
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
const ID_MINTA = /^[A-Za-z0-9_-]{8,512}$/;

export default defineDurable<unknown, unknown>("mp-arnyek-google-ads", async (ctx, rawInput) => {
  const a = InputSchema.parse(normalizeInput(rawInput));
  const cust = t(a.customer_id).replace(/\D/g, "");
  if (cust && cust !== ADS_CUSTOMER_ID) return { skipped: true, reason: "nem-mp-fiok" };
  const actionId = t(a.conversion_action_id);
  const nev = ARNYEK[actionId];
  if (!nev) return { skipped: true, reason: "nem-mp-arnyek-akcio", actionId };
  const orderId = t(a.order_id);
  if (!orderId) return { skipped: true, reason: "hianyzo-order_id", actionId };
  if (t(a.ad_user_data).toUpperCase() !== "GRANTED") return { skipped: true, reason: "nincs-hirdetesi-hozzajarulas", orderId };
  const clickKey = t(a.gclid) ? "gclid" : t(a.wbraid) ? "wbraid" : t(a.gbraid) ? "gbraid" : "";
  if (!clickKey) return { skipped: true, reason: "nincs-kattintas-azonosito", orderId };
  const click = t((a as Record<string, unknown>)[clickKey]);
  if (!ID_MINTA.test(click)) return { skipped: true, reason: "rossz-kattintas-azonosito", orderId };
  const vanErtek = a.value !== null && a.value !== undefined && t(a.value) !== "";
  const ertek = Number(a.value);
  if (vanErtek && (!Number.isFinite(ertek) || ertek < 0)) return { skipped: true, reason: "rossz-ertek", orderId };
  if (vanErtek && t(a.currency).toUpperCase() !== "HUF") return { skipped: true, reason: "nem-huf", orderId };

  const ido = await ctx.step("capture-conversion-time", async () => {
    const ms = Date.parse(t(a.conversion_date_time).replace(" ", "T"));
    return (Number.isFinite(ms) ? new Date(ms) : new Date()).toISOString();
  });

  const inputs: Record<string, unknown> = {
    mainAccountId: ADS_CUSTOMER_ID,
    managedAccountId: ADS_CUSTOMER_ID,
    name: actionId + "::" + nev,
    identifier_source: [clickKey],
    [clickKey]: click,
    order_id: orderId,
    time: ido,
    currency: "HUF",
    adUserData: "GRANTED",
  };
  if (vanErtek && ertek > 0) inputs.value = ertek;

  if (igaz(a.dryrun)) return { dryrun: true, keres: { ...inputs, [clickKey]: "[kattintas-id]" } };

  try {
    const sent = await ctx.step({
      name: "send-google-ads-mp-arnyek-conversion",
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
    return { sent: true, orderId, actionId, clickKey, valasz: sent.data?.[0] ?? null };
  } catch (e) {
    return { sent: false, orderId, actionId, clickKey, hiba: (e instanceof Error ? e.message : String(e)).split(click).join("[kattintas-id]") };
  }
});
