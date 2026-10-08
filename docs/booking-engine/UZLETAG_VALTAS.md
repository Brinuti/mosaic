# Üzletág-váltás a foglalóban

**Miért:** aki egy üzletág oldalán (pl. Head Spa) nyomja meg az „Időpontfoglalás" gombot, annak az az üzletág nyílik meg. De ha mégsem azt szeretné foglalni, váltani tud, anélkül hogy bezárná a foglalót. (Feri kérése, 2026-10-06.)

## Mit lát a vendég
- **A fejlécben az üzletág neve kattintható** („Időpontfoglalás · Fodrászat ⌄ · Noel"): rákoppintva az **üzletág-választó** jön („Mit szeretnél foglalni?"), ugyanaz, mint a főoldali foglalásnál.
- **A legelső képernyőn is van vissza nyíl** (ott, ahol eddig nem volt, mert nem volt hova visszalépni): az is az üzletág-választóra visz. A nyíl felirata ilyenkor „Másik üzletág választása" (képernyőolvasónak), később „Vissza".
- A választón:
  - **másik üzletágat** választva az új üzletág folyamata indul **elölről** (az előző üzletág adatai – kezelés, munkatárs, időpont – nem maradnak meg), a fejléc az új üzletágat mutatja;
  - **ugyanazt az üzletágat** választva **oda lép vissza, ahol tartott** (a naptár, a kiválasztott munkatárs megmarad);
  - a vissza nyíl (vagy a böngésző vissza gombja) a választóról oda viszi vissza, ahol volt.
- A választón a cím csak „Időpontfoglalás" (nincs üzletág a címben).

## Hol nem lehet váltani (a név sima szöveg, nincs nyíl)
- **Az adatlapon** (a Salonic űrlap, ahol a vendég adatokat ír be): ott a név nem gomb, hogy egy véletlen koppintás ne dobja el a beírt adatokat; a vissza nyíl a naptárra lép, onnan már lehet váltani.
- Foglalás rögzítése közben, a kész foglalás képernyőn, a visszahívás-kérés elküldése után.
- A sminktetoválás saját foglalójában (az saját fejlécet és folyamatot használ).

## Hogyan működik (kódhoz)
- `engine.js`: `switchBusiness()` az üzletág-választóra (H0) lép (`go('H0')`), és megjegyzi, honnan (`S.switchFrom`); `chooseFamily` ugyanazt az üzletágat választva `history.back()`, másikat választva `setBusiness` + a belépő képernyő. `valthato(state)` dönti el, hol van váltás.
- A böngészőtörténet-bejegyzések hordozzák az üzletágat (`biz`): ha a vendég a váltás előtti üzletág egy korábbi bejegyzésére lép vissza, a választó jön (nem a régi üzletág nézete, ami már nem érvényes).
- Fejléc: a név `button.be-h1-valt` lenyíló nyíllal; a cím-illesztés (`fitHead`) ezt is méri.

## Mérés
Új mérési esemény nincs; a választó meglévő `booking_intent_selected` (régi, nem bekötött szerződés) és a lépés-mérés `booking_business` eseménye (az új üzletágra; munkamenetenként üzletáganként egyszer) a megszokott módon fut.

## Tesztek
- `node tools/meres-proba/uzletag-valto-proba.mjs --overlay dist [--mobil 1]`: üzletág-oldalról nyitva, fejlécből váltás másik üzletágra, ugyanazt választva marad, adatlapon nincs váltás, kezdőképernyőről indulva, önálló oldalon (`/foglalo-motor`); X után az oldal ugyanott. 26 ellenőrzés asztali, 26 mobil, 0 hiba.
- `node tools/meres-proba/fejlec-proba.mjs`: a fejléc (a nyíllal együtt) telefonon is egy sorban, nem vágódik le.
