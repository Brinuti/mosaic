# GYT gbraid / wbraid feltoltes BEKAPCSOLASA - `GY_GADS_BRAID = "be"` (eles) (2026-10-25, draft)

**Mi valtozik:** egyetlen sor a `gyogytorna/wrangler.toml` ELES (`[vars]`) reszeben: `GY_GADS_BRAID` `ki` -> `be`. Az elonezeti (`[env.preview.vars]`) kornyezet `ki` marad. Kod nem valtozik (a kapcsolo a #480-ban, `ki` alapertekkel elesedett: `782869fa`).

**Engedely:** DECISION #228 4. pont (mehet: Zap publikalas + `GY_GADS_BRAID=be`), a #480 merge UTAN, kulon kis PR-ben. Zap: a `gy-google-ads-szerveres-feltoltes` publikalt verzioja `01a16dfe-dbe6-7bad-a48a-acde85b004da` (a vedohalo egy click-ID-t enged soronkent: gclid / gbraid / wbraid), elesben ellenorizve.

**Hatas:** a csak gbraid / wbraid kattintasu foglalasok is `varakozik` allapotba kerulnek es mennek a masodlagos `7858300772` (ARNYEK, `include_in_conversions_metric=false`) akcioba; a kimeno kerestorzs soronkent egy click-ID-t hordoz. A gclid-es ut, a foglalasi folyamat, a hirdetes, az elo konverzio NEM valtozik. A Zap orankent elobb `validateOnly` kort fut (elutasitas eseten a sor `hiba`, eles kuldes nincs), ez adja a braid-elfogadas elso probajat.

**Rollback:** `GY_GADS_BRAID` = `ki` (merge-commit revert vagy ez a sor), a mar feltoltott konverziokat nem vonja vissza; Zap elozo verzio `01a1624f-eebe-74d9-8759-619ffee77d75`. **Kriterium:** a gclid-sorok elutasitasa no / a gclid-ut valtozik / braid adagszintu hiba. Egyetlen elutasitott braid sor nem ok a visszaallitasra.

**Figyeles:** az elso eles adag utan a gclid vs braid bontas (`gy_feltoltes`: elfogadva / hiba / kihagyva + `google_hibakod`) a #167-be.

**Vedett fajlok:** nem erintettek (`gfeltoltes.js` `6f5deb2070`, `gkiigazitas.js` `016ad1c4cc` valtozatlan). Vendegadat / click-ID nincs a diffben.
