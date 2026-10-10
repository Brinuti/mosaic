# QA-2 – GOOGLE: pontosan mit küldtünk, mit válaszolt a platform

Forrás: a szerveres naplók (`meres_kuldes` sorai), a teljes kiküldött törzzsel és a platform teljes válaszával. A hitelesítő token (`Access-Token` fejléc) nincs naplózva, csak a fejléc **neve**. Sorok: 12, ebből `elkuldve`: 6.

## FoglalasElso → ARNYEK-7825199989 (`elkuldve`) – sor #139

- esemény-azonosító: `FoglalasElso:mb_0muwxrv832qrxzbicgxjhra`
- naplófájl: `qa2-google-headspa-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:12:29.000Z, küldő: zapier-webhook, próbálkozás: 1
- kérés: `POST zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)`, fejlécek (csak nevek): content-type
- cél: `{"customer_id":"6088874770","conversion_action_id":"7825199989","athidalas":"zapier-webhook"}`

**Kiküldött törzs (teljes):**

```json
{
  "conversion_action_id": "7825199989",
  "wbraid": "CoMKCQ_TESZT_HEADSPA_MUWXRR6Y_WBRAID",
  "conversion_date_time": "2026-10-06 19:11:24+02:00",
  "value": 53800,
  "currency": "HUF",
  "order_id": "FoglalasElso:mb_0muwxrv832qrxzbicgxjhra",
  "ad_user_data": "GRANTED"
}
```

**A platform válasza:** HTTP 200

```json
{"attempt":"01a11233-dde8-07c7-fabd-b843f48281cc","id":"01a11233-dde8-07c7-fabd-b843f48281cc","request_id":"01a11233-dde8-07c7-fabd-b843f48281cc","status":"success"}

```

**A Zap futása (Zapier futás-előzmények, order_id alapján párosítva):**

```json
{
  "run_id": "01a11233-e63a-7c49-941d-8e8d1858e087",
  "status": "finished",
  "input": {
    "value": 53800,
    "wbraid": "CoMKCQ_TESZT_HEADSPA_MUWXRR6Y_WBRAID",
    "currency": "HUF",
    "order_id": "FoglalasElso:mb_0muwxrv832qrxzbicgxjhra",
    "ad_user_data": "GRANTED",
    "conversion_action_id": "7825199989",
    "conversion_date_time": "2026-10-06 19:11:24+02:00",
    "querystring": {}
  },
  "output": {
    "sent": true,
    "valasz": {
      "wbraid": "CoMKCQ_TESZT_HEADSPA_MUWXRR6Y_WBRAID",
      "requestId": "832129d7-57dc-4541-985e-706ba95f1b95",
      "conversionName": "ARNYEK - HeadSpa - Elso foglalas",
      "conversionTime": "2026-10-06 17:11:24+00:00",
      "conversionValue": 53800,
      "conversionAction": "customers/6088874770/conversionActions/7825199989",
      "conversionCurrencyCode": "HUF"
    },
    "consent": "GRANTED",
    "orderId": "FoglalasElso:mb_0muwxrv832qrxzbicgxjhra",
    "actionId": "7825199989",
    "clickKey": "wbraid"
  }
}
```

## Schedule → – (`kihagyva`) – sor #143

- esemény-azonosító: `Schedule:mb_0muwxrv832qrxzbicgxjhra`
- naplófájl: `qa2-google-headspa-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:12:29.000Z, küldő: –, próbálkozás: 1
- indok: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)
- (kérés nem készült)

## Konzultacio → ARNYEK-7825200898 (`elkuldve`) – sor #147

- esemény-azonosító: `Konzultacio:mb_0muwxsqvgpdgxsok1p5zo8n`
- naplófájl: `qa2-google-fodrasz-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:13:09.000Z, küldő: zapier-webhook, próbálkozás: 1
- kérés: `POST zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)`, fejlécek (csak nevek): content-type
- cél: `{"customer_id":"6088874770","conversion_action_id":"7825200898","athidalas":"zapier-webhook"}`

**Kiküldött törzs (teljes):**

```json
{
  "conversion_action_id": "7825200898",
  "wbraid": "CoMKCQ_TESZT_FODRASZ_MUWXSO0J_WBRAID",
  "conversion_date_time": "2026-10-06 19:12:04+02:00",
  "value": 13000,
  "currency": "HUF",
  "order_id": "Konzultacio:mb_0muwxsqvgpdgxsok1p5zo8n",
  "ad_user_data": "DENIED"
}
```

**A platform válasza:** HTTP 200

```json
{"attempt":"01a11234-77fb-b7b0-19d0-3db819c9ec7d","id":"01a11234-77fb-b7b0-19d0-3db819c9ec7d","request_id":"01a11234-77fb-b7b0-19d0-3db819c9ec7d","status":"success"}

```

**A Zap futása (Zapier futás-előzmények, order_id alapján párosítva):**

```json
{
  "run_id": "01a11234-7ca8-7df8-9e99-75c24c9f9772",
  "status": "finished",
  "input": {
    "value": 13000,
    "wbraid": "CoMKCQ_TESZT_FODRASZ_MUWXSO0J_WBRAID",
    "currency": "HUF",
    "order_id": "Konzultacio:mb_0muwxsqvgpdgxsok1p5zo8n",
    "ad_user_data": "DENIED",
    "conversion_action_id": "7825200898",
    "conversion_date_time": "2026-10-06 19:12:04+02:00",
    "querystring": {}
  },
  "output": {
    "sent": true,
    "valasz": {
      "wbraid": "CoMKCQ_TESZT_FODRASZ_MUWXSO0J_WBRAID",
      "requestId": "1479e21a-30c4-4e20-a124-a5851478f68f",
      "conversionName": "ARNYEK - Fodrasz - Konzultacio",
      "conversionTime": "2026-10-06 17:12:04+00:00",
      "conversionValue": 13000,
      "conversionAction": "customers/6088874770/conversionActions/7825200898",
      "conversionCurrencyCode": "HUF"
    },
    "consent": "DENIED",
    "orderId": "Konzultacio:mb_0muwxsqvgpdgxsok1p5zo8n",
    "actionId": "7825200898",
    "clickKey": "wbraid"
  }
}
```

## Fodrasz_AkviziciosFoglalas → – (`kihagyva`) – sor #151

- esemény-azonosító: `Fodrasz_AkviziciosFoglalas:mb_0muwxsqvgpdgxsok1p5zo8n`
- naplófájl: `qa2-google-fodrasz-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:13:09.000Z, küldő: –, próbálkozás: 1
- indok: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)
- (kérés nem készült)

## Konzultacio → ARNYEK-7825200910 (`elkuldve`) – sor #155

- esemény-azonosító: `Konzultacio:mb_0muwxtl8sadwx1nq0uid9fx`
- naplófájl: `qa2-google-szor-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:13:47.000Z, küldő: zapier-webhook, próbálkozás: 1
- kérés: `POST zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)`, fejlécek (csak nevek): content-type
- cél: `{"customer_id":"6088874770","conversion_action_id":"7825200910","athidalas":"zapier-webhook"}`

**Kiküldött törzs (teljes):**

```json
{
  "conversion_action_id": "7825200910",
  "wbraid": "CoMKCQ_TESZT_SZOR_MUWXTIIF_WBRAID",
  "conversion_date_time": "2026-10-06 19:12:43+02:00",
  "value": 27000,
  "currency": "HUF",
  "order_id": "Konzultacio:mb_0muwxtl8sadwx1nq0uid9fx",
  "ad_user_data": "DENIED"
}
```

**A platform válasza:** HTTP 200

```json
{"attempt":"01a11235-0df2-2a05-8244-4c13e5c926f7","id":"01a11235-0df2-2a05-8244-4c13e5c926f7","request_id":"01a11235-0df2-2a05-8244-4c13e5c926f7","status":"success"}

```

**A Zap futása (Zapier futás-előzmények, order_id alapján párosítva):**

```json
{
  "run_id": "01a11235-126d-71c3-bd36-8f28f1f2a630",
  "status": "finished",
  "input": {
    "value": 27000,
    "wbraid": "CoMKCQ_TESZT_SZOR_MUWXTIIF_WBRAID",
    "currency": "HUF",
    "order_id": "Konzultacio:mb_0muwxtl8sadwx1nq0uid9fx",
    "ad_user_data": "DENIED",
    "conversion_action_id": "7825200910",
    "conversion_date_time": "2026-10-06 19:12:43+02:00",
    "querystring": {}
  },
  "output": {
    "sent": true,
    "valasz": {
      "wbraid": "CoMKCQ_TESZT_SZOR_MUWXTIIF_WBRAID",
      "requestId": "95bdf0f3-b924-4712-a540-043310fe9fed",
      "conversionName": "ARNYEK - Szor - Konzultacio",
      "conversionTime": "2026-10-06 17:12:43+00:00",
      "conversionValue": 27000,
      "conversionAction": "customers/6088874770/conversionActions/7825200910",
      "conversionCurrencyCode": "HUF"
    },
    "consent": "DENIED",
    "orderId": "Konzultacio:mb_0muwxtl8sadwx1nq0uid9fx",
    "actionId": "7825200910",
    "clickKey": "wbraid"
  }
}
```

## Schedule → – (`kihagyva`) – sor #159

- esemény-azonosító: `Schedule:mb_0muwxtl8sadwx1nq0uid9fx`
- naplófájl: `qa2-google-szor-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:13:47.000Z, küldő: –, próbálkozás: 1
- indok: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)
- (kérés nem készült)

## FoglalasElso → ARNYEK-7825200901 (`elkuldve`) – sor #163

- esemény-azonosító: `FoglalasElso:mb_0muwxueqp8bxx0lz7gw3ghk`
- naplófájl: `qa2-google-oxigen-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:14:26.000Z, küldő: zapier-webhook, próbálkozás: 1
- kérés: `POST zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)`, fejlécek (csak nevek): content-type
- cél: `{"customer_id":"6088874770","conversion_action_id":"7825200901","athidalas":"zapier-webhook"}`

**Kiküldött törzs (teljes):**

```json
{
  "conversion_action_id": "7825200901",
  "wbraid": "CoMKCQ_TESZT_OXIGEN-ELSO_MUWXUBW7_WBRAID",
  "conversion_date_time": "2026-10-06 19:13:22+02:00",
  "value": 29900,
  "currency": "HUF",
  "order_id": "FoglalasElso:mb_0muwxueqp8bxx0lz7gw3ghk",
  "ad_user_data": "DENIED"
}
```

**A platform válasza:** HTTP 200

```json
{"attempt":"01a11235-a87f-a1d3-f010-9223bde870e0","id":"01a11235-a87f-a1d3-f010-9223bde870e0","request_id":"01a11235-a87f-a1d3-f010-9223bde870e0","status":"success"}

```

**A Zap futása (Zapier futás-előzmények, order_id alapján párosítva):**

```json
{
  "run_id": "01a11235-ad72-7e88-a9ac-bdea06e4d335",
  "status": "finished",
  "input": {
    "value": 29900,
    "wbraid": "CoMKCQ_TESZT_OXIGEN-ELSO_MUWXUBW7_WBRAID",
    "currency": "HUF",
    "order_id": "FoglalasElso:mb_0muwxueqp8bxx0lz7gw3ghk",
    "ad_user_data": "DENIED",
    "conversion_action_id": "7825200901",
    "conversion_date_time": "2026-10-06 19:13:22+02:00",
    "querystring": {}
  },
  "output": {
    "sent": true,
    "valasz": {
      "wbraid": "CoMKCQ_TESZT_OXIGEN-ELSO_MUWXUBW7_WBRAID",
      "requestId": "2c8c6ac9-dbdc-4532-a3d5-cf1f7508183f",
      "conversionName": "ARNYEK - Oxigen - Elso foglalas",
      "conversionTime": "2026-10-06 17:13:22+00:00",
      "conversionValue": 29900,
      "conversionAction": "customers/6088874770/conversionActions/7825200901",
      "conversionCurrencyCode": "HUF"
    },
    "consent": "DENIED",
    "orderId": "FoglalasElso:mb_0muwxueqp8bxx0lz7gw3ghk",
    "actionId": "7825200901",
    "clickKey": "wbraid"
  }
}
```

## Oxigen_AkviziciosFoglalas → – (`kihagyva`) – sor #167

- esemény-azonosító: `Oxigen_AkviziciosFoglalas:mb_0muwxueqp8bxx0lz7gw3ghk`
- naplófájl: `qa2-google-oxigen-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:14:26.000Z, küldő: –, próbálkozás: 1
- indok: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)
- (kérés nem készült)

## FoglalasElso → ARNYEK-7825200913 (`elkuldve`) – sor #171

- esemény-azonosító: `FoglalasElso:mb_0muwxvbonkqeqrc1dejjgdr`
- naplófájl: `qa2-google-pmu-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:15:07.000Z, küldő: zapier-webhook, próbálkozás: 1
- kérés: `POST zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)`, fejlécek (csak nevek): content-type
- cél: `{"customer_id":"6088874770","conversion_action_id":"7825200913","athidalas":"zapier-webhook"}`

**Kiküldött törzs (teljes):**

```json
{
  "conversion_action_id": "7825200913",
  "wbraid": "CoMKCQ_TESZT_PMU-KEZELES_MUWXV6KW_WBRAID",
  "conversion_date_time": "2026-10-06 19:14:03+02:00",
  "value": 99000,
  "currency": "HUF",
  "order_id": "FoglalasElso:mb_0muwxvbonkqeqrc1dejjgdr",
  "ad_user_data": "GRANTED"
}
```

**A platform válasza:** HTTP 200

```json
{"attempt":"01a11236-48ee-b9d2-133d-1feb292e2753","id":"01a11236-48ee-b9d2-133d-1feb292e2753","request_id":"01a11236-48ee-b9d2-133d-1feb292e2753","status":"success"}

```

**A Zap futása (Zapier futás-előzmények, order_id alapján párosítva):**

```json
{
  "run_id": "01a11236-dc40-7fde-941f-55c95a07f2ee",
  "status": "finished",
  "input": {
    "value": 99000,
    "wbraid": "CoMKCQ_TESZT_PMU-KEZELES_MUWXV6KW_WBRAID",
    "currency": "HUF",
    "order_id": "FoglalasElso:mb_0muwxvbonkqeqrc1dejjgdr",
    "ad_user_data": "GRANTED",
    "conversion_action_id": "7825200913",
    "conversion_date_time": "2026-10-06 19:14:03+02:00",
    "querystring": {}
  },
  "output": {
    "sent": true,
    "valasz": {
      "wbraid": "CoMKCQ_TESZT_PMU-KEZELES_MUWXV6KW_WBRAID",
      "requestId": "a26ced1a-b050-47c9-8922-ee4495b5c296",
      "conversionName": "ARNYEK - PMU - Foglalas",
      "conversionTime": "2026-10-06 17:14:03+00:00",
      "conversionValue": 99000,
      "conversionAction": "customers/6088874770/conversionActions/7825200913",
      "conversionCurrencyCode": "HUF"
    },
    "consent": "GRANTED",
    "orderId": "FoglalasElso:mb_0muwxvbonkqeqrc1dejjgdr",
    "actionId": "7825200913",
    "clickKey": "wbraid"
  }
}
```

## Schedule → – (`kihagyva`) – sor #175

- esemény-azonosító: `Schedule:mb_0muwxvbonkqeqrc1dejjgdr`
- naplófájl: `qa2-google-pmu-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:15:07.000Z, küldő: –, próbálkozás: 1
- indok: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)
- (kérés nem készült)

## Ajandekkartya → ARNYEK-7825199992 (`elkuldve`) – sor #179

- esemény-azonosító: `Ajandekkartya:pi_3UNbxjFv8vc2ArnL0z1wtc1M`
- naplófájl: `qa2-google-kartya-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:16:40.000Z, küldő: zapier-webhook, próbálkozás: 1
- kérés: `POST zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)`, fejlécek (csak nevek): content-type
- cél: `{"customer_id":"6088874770","conversion_action_id":"7825199992","athidalas":"zapier-webhook"}`

**Kiküldött törzs (teljes):**

```json
{
  "conversion_action_id": "7825199992",
  "wbraid": "CoMKCQ_TESZT_AJANDEK_MUWXW2N0_WBRAID",
  "conversion_date_time": "2026-10-06 19:15:42+02:00",
  "value": 26900,
  "currency": "HUF",
  "order_id": "Ajandekkartya:pi_3UNbxjFv8vc2ArnL0z1wtc1M",
  "ad_user_data": "GRANTED"
}
```

**A platform válasza:** HTTP 200

```json
{"attempt":"01a11237-b145-6f88-b839-9a12b6772cba","id":"01a11237-b145-6f88-b839-9a12b6772cba","request_id":"01a11237-b145-6f88-b839-9a12b6772cba","status":"success"}

```

**A Zap futása (Zapier futás-előzmények, order_id alapján párosítva):**

```json
{
  "run_id": "01a11237-b811-7e1e-b14b-d87d1adb6350",
  "status": "finished",
  "input": {
    "value": 26900,
    "wbraid": "CoMKCQ_TESZT_AJANDEK_MUWXW2N0_WBRAID",
    "currency": "HUF",
    "order_id": "Ajandekkartya:pi_3UNbxjFv8vc2ArnL0z1wtc1M",
    "ad_user_data": "GRANTED",
    "conversion_action_id": "7825199992",
    "conversion_date_time": "2026-10-06 19:15:42+02:00",
    "querystring": {}
  },
  "output": {
    "sent": true,
    "valasz": {
      "wbraid": "CoMKCQ_TESZT_AJANDEK_MUWXW2N0_WBRAID",
      "requestId": "cbc572fb-4352-44a3-bad6-c9fe34ff0369",
      "conversionName": "ARNYEK - HeadSpa - Ajandekkartya",
      "conversionTime": "2026-10-06 17:15:42+00:00",
      "conversionValue": 26900,
      "conversionAction": "customers/6088874770/conversionActions/7825199992",
      "conversionCurrencyCode": "HUF"
    },
    "consent": "GRANTED",
    "orderId": "Ajandekkartya:pi_3UNbxjFv8vc2ArnL0z1wtc1M",
    "actionId": "7825199992",
    "clickKey": "wbraid"
  }
}
```

## Schedule → – (`kihagyva`) – sor #183

- esemény-azonosító: `Schedule:pi_3UNbxjFv8vc2ArnL0z1wtc1M`
- naplófájl: `qa2-google-kartya-szerver-2026-10-06.json`, küldve (UTC): 2026-10-06T17:16:40.000Z, küldő: –, próbálkozás: 1
- indok: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)
- (kérés nem készült)
