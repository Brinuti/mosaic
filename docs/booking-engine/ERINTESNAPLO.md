# Érintésnapló (UJ-80, #495) – látogatói útvonal a konverzióig

**MÉRÉST ÉRINTŐ változás, alapból KI** (`MERES_VID_BE` hiányzik). Kérés: Feri (a tulajdonos), #167 (6421054226, 6422678769, 6425327241, 6425836936). Éles bekapcsolás nem előbb, mint a T2 lezárása (≤ 10-29), külön döntéssel. A változás **nem hoz létre és nem cserél élő konverziót, hirdetési fiókhoz / GTM-hez / pixelhez nem nyúl**, a foglalási folyamat nem változik. Napló: [meres-naplo/2026-10-27-uj80-erintesnaplo.md](../../meres-naplo/2026-10-27-uj80-erintesnaplo.md).

## Mi ez

Egy látogató több érintését (hirdetési kattintás, organikus / direkt visszatérés) egy véletlen azonosító köti össze, hogy a konverziónál látszódjon az útvonal, és havi riportban a hirdetések **utolsó / első / segítő / lineáris** kreditet kapjanak.

```
landing (?gclid/fbclid/ttclid/utm | organikus) ──► POST /api/mosaic-forras ──► Set-Cookie: mh_vid (HttpOnly, 30 nap gördülő) + meres_erintes sor
koszonooldal ──► POST /api/meres-erkezes (változatlan) + additív: meres_vid_erkezes (source_id → vid_hash) + az útvonal lezárása (meres_utvonal)
riport: GET /api/mosaic-erintes-riport?honap=EEEE-HH   (fejléc-kulcs, csak olvasható)
```

## Süti és adatvédelem

* `mh_vid=<22 kar. base64url, 16 véletlen bájt>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`. Minden érintésnél újraírva (30 nap gördülő).
* Csak **marketing-hozzájárulással** (`adv`) jön létre; elutasításkor / visszavonáskor a szerver törli az `mh_vid`-et és az `mh_lpt`-t is. Kapcsoló nélkül is töröl.
* `vid_hash = HMAC-SHA256(MERES_VID_KULCS, "vid|" + vid)`. A nyers vid, a nyers kattintásazonosító és a kulcs **soha nem kerül a D1-be**; a kattintásazonosítónak csak a **típusa** (`gclid|gbraid|wbraid|fbclid|ttclid`) és egy dedup-hash (`HMAC(kulcs, "klikk|típus|érték")`) tárolódik.
* **Fail-closed:** kapcsoló nélkül, vagy 16 karakternél rövidebb / hiányzó kulccsal nincs süti, nincs sor, nincs tábla.
* A süti-tájékoztató (`foglalas/suti-tajekoztato.html`) tartalmazza az `mh_vid` bejegyzést (Feri jóváhagyta a szöveget, #167).

## Táblák (`KULCS_DB`, `CREATE IF NOT EXISTS`, csak kapcsolóval)

| tábla | tartalom | megőrzés |
|---|---|---|
| `meres_erintes` | vid_hash, idő, platform (`meta|tiktok|google_markas|google_nem_markas|organikus_direkt`), fizetett, UTM-ek, kampány / csoport / hirdetés azonosító, kattintás-típus + hash, landing útvonal (query nélkül), üzletág-becslés, dedup-kulcs | 90 nap |
| `meres_vid_erkezes` | source_id → vid_hash (az első írás nyer) | 90 nap |
| `meres_utvonal` | konverziónként az útvonal (idősorrend, ≤ 30 nap, a konverzióig): üzletág, konverzió-típus, érintések JSON, első / utolsó platform, napok az első érintés óta, 7 napnál hosszabb-e. **Nincs benne vid.** | tartós |

Dedup: ugyanaz a kattintás 30 percen belül nem duplázódik; organikus legfeljebb napi 1 sor. Írási plafon: 10 percben legfeljebb 3000 új sor (visszaélés-védelem).

## Riport (`/api/mosaic-erintes-riport`)

Kulcs csak a `x-egyeztetes-kulcs` fejlécben (a `?kulcs=` nem fogadható el), különben 404. Csak GET. Hónap = a konverzió ideje szerint, **Europe/Budapest**. Tartalom: konverziók száma, hirdetés-, hirdetéscsoport- és kampányszintű kreditek (üzletág × konverzió-típus szerint: utolsó / első / segítő / lineáris), top 20 útvonal (az organikus érintés látszik, de kreditet nem kap), a napok eloszlása. A függő útvonalakat a hívás lezárja.

## Rollback

* Azonnal: `MERES_VID_BE` sor törlése (vagy `MOSAIC_LPT_KI="1"`) + deploy – a szerver nem ír sütit és sort; a meglévő sütit visszavonáskor törli. A kliens 7 napra visszahúzódik (`mh_vid_ki`).
* A táblák adatbázis-oldalon érintetlenül maradhatnak (nincs rajtuk függés); a kód revert-PR-rel visszavonható.

## Tesztek

`node --test tools/test-erintesnaplo.mjs` (26 teszt: tiszta függvények, végpont, útvonal-zárás, riport, kliens) és `tools/test-lpt-forras.mjs` (58).

## Hirdetéscsoport-szint és a hirdetés forrása (mérési spec-ellenőrzés, #498)

Az útvonal-JSON érintésenként `g = adgroupid || utm_term` (hirdetéscsoport) és `af` (a hirdetés forrása: `adid` | `utm_content`) mezőt is tartalmaz; a riport `hirdetescsoport` listája `platform|kampany|csoport` kulccsal ad kreditet. A 4 kis Google-kampány suffixében (`utm_content={adgroupid}`) az `utm_content` hirdetéscsoport-azonosító, nem hirdetés: ezért a Google `utm_content` forrású hirdetés-szintű sorok `szint_bizonytalan: true` jelzést kapnak, a szintet nem találgatjuk. A kis Google-kampányok listáját a mérés adja át (nem kell a kódba).
