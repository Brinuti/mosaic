# Medical Piercing – TikTok Events API „IgazoltFoglalas” (szerveroldali)

> Eseménynév 2026-10-13 óta saját (custom) `IgazoltFoglalas`, NEM `Schedule`: a kampány a böngészős, URL-szabályos
> (event_id nélküli) SCHEDULE-ra optimalizál, azonos névvel a TikTok nem deduplikálna (dupla számolás). Másodlagos mérés,
> a kampány tanulását nem érinti. Élesítés: `TIKTOK_EVENTS_TOKEN` titok (Cloudflare, Production) + `mp_beallitas.tiktok_mod='eles'`.

Állapot (2026-10-13): **csak napló**. A TikTok felé **semmi nem megy ki**; a rendszer minden jogosult, Salonic által
igazolt foglalásnál feljegyzi, *mit küldene*. Élesítés csak a tulajdonos döntésével (lásd 5. pont).

Kód: `lib/meres/tiktok.js` (törzs, jogosultság, mód), `lib/meres/lanc.js` (indítás), `lib/meres/riport.js` (napi szám).
Teszt: `node --test tools/test-mp-tiktok.mjs`.

## 1. Mikor indul

Ugyanott, ahol a Google-feltöltés: amikor a D1-foglalás **Salonic-igazolt** lesz – mindkét sorrendben
(köszönőoldal előbb → a Salonic-levél indítja; Salonic-levél előbb → a köszönőoldal indítja), valamint a késői
hozzájárulás pótlásakor, ha a sor már igazolt. A Google-lánctól független, saját hibakezeléssel: TikTok-hiba nem
állítja meg a Google-feltöltést.

## 2. Jogosultság (mind kell)

- `kornyezet = 'eles'` (élő oldal, nem előnézet);
- `igazolas = 'igazolt'` (Salonic-levél párosítva);
- `hozzajarulas_hirdetes = 1` (hirdetési hozzájárulás);
- van `tiktok_ttclid` (a `tiktok_ttp` nem kötelező);
- az esemény ideje (a foglalás = Salonic-levél ideje, tartalék: köszönőoldali rögzítés) legfeljebb 7 napos, és ha
  ismert a kattintás ideje, a foglalás a kattintás után 7 napon belül történt (TikTok attribúciós ablak);
- erre a kulcsra még nincs sor az `mp_tiktok_feltoltes` táblában (kulcsonként egyszer); a `kihagyva:<ok>` sor nem számít.

Kihagyás-napló (2026-10-20): ha a küldés kimarad (pl. `nincs_hozzajarulas`, `nincs_azonosito`, `divat_fulpiercing`,
`ablakon_kivul`, `erzekeny_adat`), a táblába `allapot = 'kihagyva:<ok>'` sor kerül, payload nélkül, hogy a napi riport okot
mutasson. Ha ugyanaz a kulcs később kimegy (naplózva / elküldve), felülírja. Nem naplózott: nem éles környezet, `ki` mód,
már rögzített kulcs, váratlan hiba. Ugyanez a minta az `mp_meta_arnyek` táblában (Meta ÁRNYÉK).

## 3. Mit küldene (TikTok Events API 2.0)

`POST https://business-api.tiktok.com/open_api/v1.3/event/track/`, fejléc `Access-Token`:

```json
{ "event_source": "web", "event_source_id": "CU2CR03C77UAQJITQK80",
  "data": [{ "event": "IgazoltFoglalas", "event_time": 1791799100, "event_id": "Foglalas:12169|555|1791800000",
             "user": { "ttclid": "…", "ttp": "…" },
             "page": { "url": "https://www.medicalpiercing.hu/foglalas-ok" },
             "properties": { "currency": "HUF", "value": 24900 } }] }
```

- `event_id` = a meglévő `esemenyId(kulcs)` (ugyanaz, mint a böngésző deduplikációs azonosítója, ha van).
- `user`: **csak** `ttclid` és `ttp`. Nincs e-mail, telefon, external_id, IP, user agent.
- `properties`: csak ha az érték ismert; nincs szolgáltatásnév, kategória, típus, helyszín, új/visszatérő jelölés.
- A nem-azonosító mezőkön a `vanErzekeny` védőháló fut; találat esetén semmi nem épül és semmi nem rögzül.

## 4. Mód és napló

`mp_beallitas.tiktok_mod`: `ki` | `naplo` | `eles`. **Hiányzó vagy ismeretlen érték = `naplo`.**

- `naplo`: a törzs a `mp_tiktok_feltoltes (kulcs PK, mod, allapot, payload_maszkolt, ido)` táblába kerül, a `ttclid` /
  `ttp` maszkolva (`h:xxxxxxxx`); hálózati hívás nincs.
- `ki`: semmi nem történik.
- `eles`: csak akkor küld, ha a mód kifejezetten `eles`, **és** létezik a `TIKTOK_EVENTS_TOKEN` titok, **és** az élő
  hoszton fut. Bármelyik hiányában `naplo`-ként viselkedik. Hibás küldés (`allapot = 'hiba'`) újrapróbálható, a sikeres
  (`elkuldve`) nem megy ki újra. A naplóba már bekerült kulcsok élesítés után sem mennek ki utólag.

A napi riport (`riport.js`) soronként `tiktok_naplo` számot ad (az adott napon naplózott sorok). A sorok 120 nap után törlődnek.

## 5. Élesítés (a tulajdonos döntése)

1. Néhány nap napló után a riport `tiktok_naplo` számai és a `payload_maszkolt` tartalma átnézve.
2. TikTok Events Managerben a `CU2CR03C77UAQJITQK80` pixelhez Events API access token generálása.
3. Cloudflare → Pages → `medicalpiercing` → Settings → Variables and Secrets: `TIKTOK_EVENTS_TOKEN` (Secret, Production).
4. D1 (`mp-meres`): `INSERT OR REPLACE INTO mp_beallitas (kulcs, ertek) VALUES ('tiktok_mod', 'eles');`
5. Visszakapcsolás: `UPDATE mp_beallitas SET ertek = 'naplo' WHERE kulcs = 'tiktok_mod';` (vagy `ki`).

## Élesítés

- 2026-10-13: Feri beállította a `TIKTOK_EVENTS_TOKEN` titkot (Production). `mp_beallitas.tiktok_mod = 'eles'`. Az esemény neve `IgazoltFoglalas` (másodlagos, a kampány optimalizációs eseménye változatlan). Visszakapcsolás: `tiktok_mod = 'naplo'`.

## Igazolatlan Salonic-forrású foglalás: `kihagyva:nem_igazolt` napló (2026-10-24, DRAFT)

A TikTok-lépés csak Salonic-igazoláskor indul (`lanc.js` `igazolasErkezes` / új foglalásnál `if (ig)`), ezért a Salonic-forrású (booking_id nélküli, `forras='salonic'`) foglalásnak, amelyhez nem érkezik igazolás, eddig nem maradt nyoma a `mp_tiktok_feltoltes` táblában. Új: `nemIgazoltNaplo` (`lanc.js`), a karbantartás előtt fut egy új foglalás rögzítésekor: az éles, `forras='salonic'`, legfeljebb 14 napos, napló-sor nélküli foglalásokra, amelyek 48 óra után igazolatlanok (vagy már `nem_igazolt`), a meglévő `tiktokLepes`-t hívja `igazolas='nem_igazolt'`-tal → `kihagyva:nem_igazolt` sor, payload nélkül (a fül típus a meglévő sorrend szerint `kihagyva:divat_fulpiercing`). **Küldés nem változik**: az `igazolas` mezőt csak a hívás másolatán állítja, a táblát a karbantartás állítja; ki módban semmi nem történik; a hiba elnyelt; idempotens. Későbbi igazolás esetén a `naplozva` sor felülírja a kihagyva-sort (meglévő viselkedés).
