# Foglalás → megjelenés (booking-to-show) emlékeztető-rendszer

Forrás: `MOSAIC_booking_to_show_lifecycle_2026-10-07.pdf` (PLAN-D alapú copy + implementációs szabályok). Épült: 2026-10-07 (Claude, a tulajdonos kérésére).
Cél: a lefoglalt időpontból minél több **megjelenjen**: azonnali visszaigazolás (T0), tartalmi e-mailek, T-72 megerősítés, T-24 végrehajtási SMS, lemondás / áthelyezés kezelése — mind az 5 üzletágra.

## Hogyan működik

```
Salonic (nincs API / webhook)
  └─ szalon-értesítő e-mail (app@salonic.hu → mosaicheadspa@gmail.com): "Új online foglalás érkezett" / "Foglalás módosítva vendég által" / "Foglalás lemondás"
       └─ Zapier: lifecycle-bejovo (Gmail-trigger, ~1-2 perc)  ──POST──►  /api/lifecycle/bejovo   (Cloudflare Pages Function)
                                                                           ├─ értelmezés (netlify/lib/lifecycle/parser.js) → foglalás + küldési sor a D1-ben (LIFECYCLE_DB)
                                                                           └─ az azonnali (T0) SMS / e-mail rögtön kimegy
       └─ Zapier: lifecycle-tick (óránként)  ──POST──►  /api/lifecycle/tick  → az esedékes üzenetek (T-72, T-24, tartalmi levelek) kimennek + napi karbantartás
SMS: SimpleSMS REST (api.simplesms.hu)      E-mail: Gmail SMTP (SMTP_PASS, ugyanaz, mint az űrlap-leveleknél; feladó neve az üzletág)
```

- **Egyedi foglalás-azonosító**: a szalon-értesítő HTML-jében a Salonic foglalás-UUID-ja benne van (`bookingId=`). Ebből áll elő a vendég-link:
  `https://<fiók>.salonic.hu/booking/bookingDetails/<UUID>` (részletek / módosítás), az SMS-ben rövid link: `https://www.mosaicheadspa.hu/f/<kód>` (átirányít ide).
  *Ha a link a Salonic főoldalára visz: a foglalás UUID-ja nem létező / lemondott foglalásé (pl. kitalált teszt-azonosító).*
- **Megerősítő link**: `https://www.mosaicheadspa.hu/m/<kód>` — egykattintásos (botoknak nem erősít meg); a megerősített vendégnek a T-72 SMS kimarad, a T-24 megy.
- A Salonic **minden foglalásról két levelet** küld (két címzett-lista): a motor az azonosító alapján egynek számít (ismétlődés-szűrő).

## Üzemmódok (`LIFECYCLE_MOD`, wrangler.toml)

| mód | jelentés |
|---|---|
| `ki` | semmi nem megy ki (a foglalások rögzülnek) |
| `teszt` | **csak a teszt-vendégeknek** megy üzenet (`deakfi@grantis.hu`, `ferencistvandeak@gmail.com`, `ferraj@gmail.com`, a `+36709420090` telefon, „TESZT …” nevű vendég); a valódi vendégek foglalása rögzül, de nem kap üzenetet |
| `elo` | az `LIFECYCLE_UZLETAGOK`-ban felsorolt üzletágak (headspa, hair, oxygen, laser, pmu) **valódi vendégeinek** is |

Élesítéskor a `teszt` módban rögzített, de még el nem küldött üzenetek közül a T0 12 órán belül, a többi 2 órán belül küldhető ki (a régi, késett üzenet nem megy ki: „késett” → kihagyva).

## Lead-time szabály (dokumentum 1.3)

| időpontig | üzenetek |
|---|---|
| < 30 óra | csak T0 (a kritikus előkészület a T0 e-mailben: `surgos_kiegeszites`) |
| 30–96 óra | T0 + T-24 |
| 5–9 nap | + 1 tartalmi e-mail, T-72 (SMS + prep e-mail), T-24 |
| 10–20 nap | + max. 2 tartalmi e-mail |
| 21+ nap | + max. 3 tartalmi e-mail (az üzletág katalógusának darabszámáig) |

SMS 8:00–20:30, e-mail 7:00–21:00 között (az ablakon kívüli esedékesség a legközelebbi szélre kerül); a T0 azonnali. A tartalmi e-mailek legalább 24 órával a T-72 előtt, és egymástól legalább 24 órára mennek.

## Áthelyezés, lemondás

- **Áthelyezés**: ugyanaz a foglalás új időponttal; a régi időponthoz tartozó függő üzenetek újraszámolódnak (T-72 / T-24 az új időpontra), a már elküldött tartalmi e-mail nem ismétlődik, a T0 nem megy újra; azonnali „megvan az új időpontod” SMS.
- **Lemondás**: minden függő üzenet törlődik; azonnali lemondás-visszaigazolás (SMS + e-mail) átfoglalási linkkel.
- A **„megjelent / no-show”** állapotról a Salonic **nem küld semmit**, ezért a no-show recovery SMS (`COMMON-NOSHOW-SMS`) nincs automatikusan indítva (a katalógusban megvan; kell hozzá egy jelzés a szalonból).

## Üzenet-katalógus

`netlify/lib/lifecycle/katalog/` (`SEMA.md` a formátum; üzletáganként egy fájl + `kozos.js`). A szöveg a dokumentum szerint; **fix ár / százalék / hónapnév nincs a szövegben** (a dokumentum szabálya; a katalógus-teszt ellenőrzi); az `{aktuális_ár}` / `{aktuális_ajánlat}` soraiból jelenleg semmi nem jelenik meg (nincs garantáltan aktuális ár-forrás). A „48 órás lemondási szabály” **nincs** sehol (tulajdonosi döntés).
A telefonos hívások (HeadSpa páros/négykezes, fodrász konzultáció/nagy festés, oxigén új vendég, lézer új vendég, PMU minden online foglaló) **belső feladat-e-mailek a szalonnak** (`csatorna: 'feladat'`): a motor nem hív, jelzi, kit érdemes hívni a szkripttel. Teszt-vendégnél a feladat-e-mail a teszt-címre megy.
Ékezetes SMS-nél (UCS-2) **70 karakter / szegmens (összefűzve 67)**: a hosszú SMS-ek 3–5 szegmensnek számítanak a SimpleSMS-ben (a tényleges szegmensszám a `kuldesek.szegmens_db`-ben van).

## Konfiguráció

`wrangler.toml` (nem titkos): `LIFECYCLE_MOD`, `LIFECYCLE_UZLETAGOK`, `LIFECYCLE_KULCS_HASH` (a belépő kulcs SHA-256-ja), `SIMPLESMS_FELHASZNALO` (`mosaic`), `SIMPLESMS_DOMAIN` (`mosaicheadspa.hu`), D1: `LIFECYCLE_DB` (eles: `mosaic-lifecycle`, előnézet: `mosaic-lifecycle-elonezet`).
Titkok (Cloudflare, Secret, **Production és Preview külön**): `SIMPLESMS_JELSZO` (a SimpleSMS API-jelszó), `SMTP_PASS` (meglévő). A belépő kulcs a két Zapier-láncban van beágyazva (a repóban csak a hash-e).
Opcionális: `LIFECYCLE_SZALON_EMAIL` (alap: mosaicheadspa@gmail.com), `LIFECYCLE_TESZT_EMAIL`, `LIFECYCLE_TESZT_TELEFON`, `LIFECYCLE_NAPI_PLAFON` (alap 80 befogadás / nap), `LIFECYCLE_SMS_KUSZOB` (alacsony egyenleg-riasztás, alap 3000), `LIFECYCLE_BASE_URL`.
Zapier: `lifecycle-bejovo` (id `01a1168a-afbf-7ee9-94c3-6e5be524b6be`) és `lifecycle-tick` (id `01a1169c-7353-708d-8801-912e783e8424`); a **cél-cím** (`CEL`) a kódjukban van: előnézet → éles átállásnál új verzióban `https://www.mosaicheadspa.hu`-ra kell átírni. A sandbox csak engedélyezett hosztokat ér el, ezért a hívás a „Webhooks by Zapier” (custom request) akción megy.

## Üzem

- Állapot (személyes adat nélkül): `GET /api/lifecycle/allapot` + `x-lifecycle-kulcs` fejléc.
- SMS-egyenleg: naponta egyszer ellenőrzi; a küszöb alatt e-mail megy a szalonnak.
- Adatvédelem: a foglalás személyes adatai (név, telefon, e-mail) az időpont után **60 nappal törlődnek** (napi karbantartás); a tranzakciós üzenetekhez nem kell marketing-hozzájárulás.
- Régi, generikus Salonic T-48 e-mail emlékeztetők: élesítéskor a Salonicban ki kell kapcsolni (különben az új T-72 / T-24 lánccal párhuzamosan mennek).
- Napi 80 befogadásnál (és a napi SimpleSMS-egyenleg-riasztásnál) kisebb a visszaélés kockázata is: a belépő kulcs ismerete nélkül nincs hívható végpont.

## Tesztek

```
node --test tools/lifecycle-teszt/motor.test.mjs tools/lifecycle-teszt/katalog.test.mjs
```
Értelmező (3 értesítő-típus, összeragadt cimkék, HTML), időkezelés (nyári/téli idő, magyar dátum, ragozás), ütemező (lead-time), kirajzolás (minden üzenet minden szegmensre), motor (befogadás, küldés, ismétlődés / egyidejű levelek, áthelyezés, lemondás, T-72/T-24, hibák), HTTP.
Valódi próba: `tools/meres-proba/reteg-foglalas.mjs` (valódi próbafoglalás, „TESZT – Claude”), lemondás: `lemond.mjs`.
