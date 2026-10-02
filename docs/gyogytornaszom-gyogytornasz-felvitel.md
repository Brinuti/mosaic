# Gyógytornász felvitele a gyogytornaszom.hu WordPress-be

Bemenet a felhasználótól: fotók, Salonic-link, bemutatkozó (docx), `Weboldalválasztó` Excel.
Jelszót ide soha ne írj; a WP alkalmazásjelszót a felhasználó adja meg a sessionben
(felhasználó: `feri`, admin). A belépési oldal rejtett (WPS Hide Login), a REST API elérhető.

## Hozzáférés
- A felhőkörnyezetből a `gyogytornaszom.hu` közvetlenül nem érhető el (proxy 403). Minden
  kérést a Composio `COMPOSIO_REMOTE_BASH_TOOL` sandboxából futtass (python `requests`,
  Basic auth `feri:<alkalmazásjelszó>`), a `session_id`-val.
- Az oldal 429-et ad, ha gyorsan kérdezed: kérések között 1–2 mp szünet, hosszú futásnál
  háttérfolyamat (`nohup`) és poll (a tool 60 mp után időtúllép).
- Sandbox → fájlátvitel: base64 a parancsban megbízhatatlan. A képeket ideiglenesen töltsd fel
  a repó fejlesztői ágára (`Brinuti/mosaic` publikus), töltsd le a sandboxban a
  `raw.githubusercontent.com/.../<commit>/...` címről, majd töröld a commitban.

## Lépések
1. **Minta:** másold le a legfrissebb, azonos rendelőjű tagot (post type `member`, REST:
   `/wp/v2/member`). Rendelők Salonic `placeId`: Nyugati 2581, Oktogon 8439, Batthyány 418.
   A tartalom Gutenberg blokk (`content.raw`): hero (carousel/media-text), bemutatkozó
   (text-media + tabs: Szakterületeim, Tanulmányaim, Kezeléseim, Rólam), panasz-accordion,
   foglalás gombok. Cseréhez regexet használj; `re.sub` lambdában `m.expand()` kell a
   visszahivatkozásokhoz (egyszer elromlott).
2. **Képek:** hős négyzet 800×800 (`<név>_retusalt_800x800.jpg`, kiemelt kép), fekvő 900×600
   (`<név>_retusalt_fekvo.jpg`). `POST /wp/v2/media` binárissal + `Content-Disposition`.
3. **Taxonómiák:** `besorolas` (hierarchikus; a főkategóriát SOHA nem jelöljük, csak az
   alkategóriát; az Excel adott oszlopában csak a ZÖLD cellák, nem az "x"), `kezeles`
   (jobb oldali címkék a bemutatkozó kezeléseiből; a "Kezelések-Terápiák" Excel-sorok ide
   tartoznak), `member_lang` (HU 602, EN 603).
4. **Meta:** `experience` (a diplomázás óta eltelt évek, ha nincs évszám: üresen hagyni és
   rákérdezni), `short_desc`, `first_consultation_price` (17.600 Ft), `highlighted_kezeles`
   (3 term ID), `member_lang_order`. Ezek REST-en át írhatók.
5. **Nem REST-es meta:** `external_link` (a Salonic foglalási link), `_yoast_wpseo_primary_besorolas`,
   `_yoast_wpseo_focuskw`, `_yoast_wpseo_metadesc`. Ezek íráshoz ideiglenesen telepítsd a
   `code-snippets` bővítményt (`POST /wp/v2/plugins {slug, status:active}`), és egy
   snippetben `register_post_meta('member', $k, ['show_in_rest'=>true,...])`. Ha kész:
   snippet törlése, bővítmény inaktiválás + törlés.
6. **Élesítés:** `POST /wp/v2/member` `status: publish`, slug a keresztnév. Utána ellenőrzés
   a frontenden (a `?v=2` paraméter megkerüli a cache-t; a `/gyogytornaszok/` lista cache-ét
   a 22537-es oldal újramentése üríti), kártya és adatlap szövegei, képek 200-ak.
7. Végén jelezd a felhasználónak, mit találtál ki te (pl. címsor, meta-leírás), és mi hiányzott.
