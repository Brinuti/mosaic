import { defineDurable } from "@zapier/zapier-durable";
import { createZapierSdk } from "@zapier/zapier-sdk";
import { z } from "zod";

// 2026-10-11 MP ARNYEK (Feri "mehet a Google-feltoltes elesitese" 10:11). A Medical Piercing Cloudflare-szervere
// (medicalpiercing/lib/meres/google-ads.js zapierTorzs) ide kuld egy lapos JSON-t:
// { customer_id, conversion_action_id, gclid|gbraid|wbraid, conversion_date_time, order_id, ad_user_data, value?, currency?, dryrun? }
// CSAK a 2626380837 fiok 3 ARNYEK masodlagos akciojara tolt fel; minden mast elutasit. A Mosaic Zapjatol fuggetlen.
// dryrun=true -> semmit nem kuld, a kesz kerest adja vissza (kattintasazonosito kitakarva).
//
// 2026-10-24 UJ-61 (DRAFT, #167 6384194904 / 6384788538): a feltoltes UTAN visszahivja a szervert (POST /api/mp-google-valasz), hogy a Worker
// tartosan naplozza a kimenetelt (mp_google_valasz: requestId + kod). A visszahivas SOHA nem befolyasolja a feltoltest:
//  - kulon lepes, kulon try/catch; a hibaja csak a visszaadott objektum `visszahivas` mezojeben latszik;
//  - a Google Ads lepes nem ujraprobalodik emiatt (nincs dupla konverzio);
//  - dryrun-nal nincs visszahivas (a dryrun semmit nem kuld); order_id nelkuli / nem MP kerelemre sincs (nincs mit parositani).
// A kulcs a Zapier Storage 'mp_google_valasz_kulcs' kulcsan van (a Worker oldalon ennek a SHA-256-ja a MP_GOOGLE_VALASZ_KULCS_HASH).
// A kulcs olvasasa es a hivas EGY lepesben tortenik, igy a futasnaplo a kulcsot soha nem orzi.
// Kod-szerzodes (kod): "" = a Zapier Google Ads lepese hiba nelkul lefutott; ZAP_HIBA = a lepes hibaval allt le (2 proba utan); ZAP_KIHAGYVA = a kapuk valamelyike eldobta (a reason az uzenetben).
// FIGYELEM: a Zapier Google Ads action NEM adja vissza a Google partialFailure objektumot; a "" tehat azt jelenti: "a Zapier action nem dobott hibat" (+ request_id),
// nem azt, hogy a Google minden sort elfogadott. A valodi partialFailure-kodokhoz kozvetlen Google Ads API-hivas kellene (kulon dontes).
// Kattintas-azonosito (gclid / wbraid / gbraid / googleClickId), hash, e-mail, IP, user agent SOHA nem megy a visszahivasba.

const sdk = createZapierSdk();
const GOOGLE_ADS_APP = "GoogleAdsCLIAPI";
const GOOGLE_ADS_CONNECTION = "google_ads_mp";
const ADS_CUSTOMER_ID = "2626380837";
const VISSZAHIVAS_URL = "https://www.medicalpiercing.hu/api/mp-google-valasz";
const VISSZAHIVAS_KULCS_NEV = "mp_google_valasz_kulcs";

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

type Visszahivas = { order_id: string; conversion_action_id: string; kod: string; request_id?: string; uzenet?: string; elfogadva?: number; elutasitva?: number };

// A visszahivas: a feltoltes kimenetelenek jelzese a Workernek. Soha nem dob, csak leirja, mi tortent.
async function visszahiv(ctx: any, torzs: Visszahivas): Promise<Record<string, unknown>> {
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
          inputs: { method: "POST", url: VISSZAHIVAS_URL, data: JSON.stringify(torzs), headers: { "content-type": "application/json", "x-mp-google-kulcs": kulcs }, return_raw_response: "yes" },
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

export default defineDurable<unknown, unknown>("mp-arnyek-google-ads", async (ctx, rawInput) => {
  const a = InputSchema.parse(normalizeInput(rawInput));
  const dry = igaz(a.dryrun);
  const cust = t(a.customer_id).replace(/\D/g, "");
  if (cust && cust !== ADS_CUSTOMER_ID) return { skipped: true, reason: "nem-mp-fiok" };
  const actionId = t(a.conversion_action_id);
  const nev = ARNYEK[actionId];
  if (!nev) return { skipped: true, reason: "nem-mp-arnyek-akcio", actionId };
  const orderId = t(a.order_id);
  if (!orderId) return { skipped: true, reason: "hianyzo-order_id", actionId };
  // innentol a Worker sora ismert (order_id + akcio): minden kapu-kihagyas is visszajelzest kap (ZAP_KIHAGYVA), hogy az "elkuldve" ne tunjon elfogadottnak
  const kihagy = async (reason: string) => {
    const vh = dry ? null : await visszahiv(ctx, { order_id: orderId, conversion_action_id: actionId, kod: "ZAP_KIHAGYVA", uzenet: reason });
    return { skipped: true, reason, orderId, ...(vh ? { visszahivas: vh } : {}) };
  };
  if (t(a.ad_user_data).toUpperCase() !== "GRANTED") return await kihagy("nincs-hirdetesi-hozzajarulas");
  const clickKey = t(a.gclid) ? "gclid" : t(a.wbraid) ? "wbraid" : t(a.gbraid) ? "gbraid" : "";
  if (!clickKey) return await kihagy("nincs-kattintas-azonosito");
  const click = t((a as Record<string, unknown>)[clickKey]);
  if (!ID_MINTA.test(click)) return await kihagy("rossz-kattintas-azonosito");
  const vanErtek = a.value !== null && a.value !== undefined && t(a.value) !== "";
  const ertek = Number(a.value);
  if (vanErtek && (!Number.isFinite(ertek) || ertek < 0)) return await kihagy("rossz-ertek");
  if (vanErtek && t(a.currency).toUpperCase() !== "HUF") return await kihagy("nem-huf");

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

  if (dry) return { dryrun: true, keres: { ...inputs, [clickKey]: "[kattintas-id]" } };

  let eredmeny: Record<string, unknown>;
  let kod = "";
  let requestId: string | undefined;
  let uzenet: string | undefined;
  let elfogadva: number | undefined;
  let elutasitva: number | undefined;
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
    const valasz = sent.data?.[0] ?? null;
    eredmeny = { sent: true, orderId, actionId, clickKey, valasz };
    elfogadva = 1; elutasitva = 0;
    if (valasz && valasz.requestId) requestId = String(valasz.requestId).slice(0, 64); // a googleClickId-t SZANDEKOSAN nem visszuk
  } catch (e) {
    const hiba = (e instanceof Error ? e.message : String(e)).split(click).join("[kattintas-id]");
    eredmeny = { sent: false, orderId, actionId, clickKey, hiba };
    kod = "ZAP_HIBA"; uzenet = hiba.slice(0, 200); elfogadva = 0; elutasitva = 1;
  }
  // A feltoltes eredmenye mar eldolt; a visszahivas hibaja nem valtoztat rajta.
  const vh = await visszahiv(ctx, { order_id: orderId, conversion_action_id: actionId, kod, request_id: requestId, uzenet, elfogadva, elutasitva });
  return { ...eredmeny, visszahivas: vh };
});
