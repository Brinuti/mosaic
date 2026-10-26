# GYT gbraid / wbraid feltoltes BEKAPCSOLASA - `GY_GADS_BRAID = "be"` (eles) (2026-10-25, draft)

**Mi valtozik:** egyetlen sor a `gyogytorna/wrangler.toml` ELES (`[vars]`) reszeben: `GY_GADS_BRAID` `ki` -> `be`. Az elonezeti (`[env.preview.vars]`) kornyezet `ki` marad. Kod nem valtozik (a kapcsolo a #480-ban, `ki` alapertekkel elesedett: `782869fa`).

**Engedely:** DECISION #228 4. pont (mehet: Zap publikalas + `GY_GADS_BRAID=be`), a #480 merge UTAN, kulon kis PR-ben. Zap: a `gy-google-ads-szerveres-feltoltes` publikalt verzioja `01a16dfe-dbe6-7bad-a48a-acde85b004da` (a vedohalo egy click-ID-t enged soronkent: gclid / gbraid / wbraid), elesben ellenorizve.

**Hatas:** a csak gbraid / wbraid kattintasu foglalasok is `varakozik` allapotba kerulnek es mennek a masodlagos `7858300772` (ARNYEK, `include_in_conversions_metric=false`) akcioba; a kimeno kerestorzs soronkent egy click-ID-t hordoz. A gclid-es ut, a foglalasi folyamat, a hirdetes, az elo konverzio NEM valtozik. A Zap orankent elobb `validateOnly` kort fut (elutasitas eseten a sor `hiba`, eles kuldes nincs), ez adja a braid-elfogadas elso probajat.

**Bekapcsolaskor (egyszeri hatas, a review eszrevetele):** eles modban a legutobbi 7 nap `kihagyva_braid` sorai torlodnek, es a felvetel a teljes ellenorzesekkel (click-ID hossz >= 20 / karakterkeszlet / TESZT-karanten / idosorrend) ujra letrehozza oket; a consent is ujraszamolodik (GRANTED, ha a latogato nem utasitotta el; tesztfoglalas kizarva). A 7 napnal regebbi sorok `kihagyva_braid`-ben maradnak. A braid-foglalasok 2026-10-21 ota gyulnek, ezert a visszamenoleges adag nehany napnyi braid sor: egy futas legfeljebb 10 sort kuld (`GFELT.adag`), orankent, igy napokig urul. **Varhato:** a Google soronkent elutasithat (pl. `ONE_PER_CLICK_CONVERSION_ACTION_NOT_PERMITTED_WITH_BRAID`, `EXPIRED_EVENT`, `CONVERSION_PRECEDES_EVENT`) - ez vegleges `hiba`, nincs ujrakuldes, a `validateOnly` kor az eles kuldes elott elfogja, es `partialFailure` miatt a gclid-sorokat nem akasztja meg.

**Figyelem:** a `tools/gfeltoltes-hid.mjs` `terv` parancsa a braid-agat nem ismeri (`kuldesElotti` braid nelkul), ezert braid-ag mellett a hidat nem szabad hasznalni; az elo ut a Zap + Worker.

**Rollback:** `GY_GADS_BRAID` = `ki` (merge-commit revert vagy ez a sor), a mar feltoltott konverziokat nem vonja vissza; Zap elozo verzio `01a1624f-eebe-74d9-8759-619ffee77d75`. **Kriterium:** a gclid-sorok elutasitasa no / a gclid-ut valtozik / braid adagszintu hiba. Egyetlen elutasitott braid sor nem ok a visszaallitasra.

**Figyeles:** az elso eles adag utan a gclid vs braid bontas (`gy_feltoltes`: elfogadva / hiba / kihagyva + `google_hibakod`) a #167-be.

**Vedett fajlok:** nem erintettek (`gfeltoltes.js` `6f5deb2070`, `gkiigazitas.js` `016ad1c4cc` valtozatlan). Vendegadat / click-ID nincs a diffben.
