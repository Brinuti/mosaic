-- Foglalas -> megjelenes (booking-to-show) lifecycle: Cloudflare D1 (wrangler.toml: LIFECYCLE_DB; eles es elonezet kulon adatbazis)
-- Szemelyes adat: nev, telefon, e-mail (a kuldeshez kell); az idopont utan 60 nappal a tick torli (lasd engine.js: takaritas).

CREATE TABLE IF NOT EXISTS foglalasok (
  id TEXT PRIMARY KEY,                      -- a Salonic foglalas-azonositoja (UUID), ennek hianyaban szintetikus hash
  uzletag TEXT NOT NULL,                    -- headspa | hair | oxygen | laser | pmu
  fiok TEXT NOT NULL,                       -- a Salonic-fiok neve (pl. mosaicheadspa) - a vendeg-linkek hostja
  nev TEXT,
  keresztnev TEXT,                          -- NULL, ha nem allapithato meg biztosan
  telefon TEXT,                             -- normalizalt: +36701234567
  email TEXT,
  szolgaltatas TEXT NOT NULL,               -- a Salonic szolgaltatas-neve (nyers)
  szegmens TEXT,                            -- uzletagonkent: pl. konzultacio | elso | visszatero | fizetos | korrekcio | eltavolitas
  munkatars TEXT,
  kezdet INTEGER NOT NULL,                  -- az idopont kezdete (epoch masodperc)
  letrehozva INTEGER NOT NULL,              -- mikor jutott el hozzank a foglalas (epoch masodperc)
  modositva INTEGER,
  allapot TEXT NOT NULL DEFAULT 'aktiv',    -- aktiv | lemondva | megjelent | nem_jelent_meg
  megerositve INTEGER,                      -- a vendeg a megerosito linkre kattintott (epoch)
  token TEXT NOT NULL,                      -- veletlen, a megerosito link azonositoja
  teszt INTEGER NOT NULL DEFAULT 0,         -- 1 = teszt-vendeg (a teszt modban csak ezeknek megy uzenet)
  elo INTEGER NOT NULL DEFAULT 0            -- 1 = az uzenetek ennek a foglalasnak tenyleg kimennek
);
CREATE INDEX IF NOT EXISTS idx_fogl_allapot_kezdet ON foglalasok (allapot, kezdet);
CREATE INDEX IF NOT EXISTS idx_fogl_email ON foglalasok (email);

CREATE TABLE IF NOT EXISTS kuldesek (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  foglalas_id TEXT NOT NULL,
  uzenet_id TEXT NOT NULL,                  -- a katalogus azonositoja (pl. HS-SMS-03)
  csatorna TEXT NOT NULL,                   -- sms | email | feladat (belso e-mail a szalonnak: hivando vendeg)
  esedekes INTEGER NOT NULL,                -- epoch masodperc
  allapot TEXT NOT NULL DEFAULT 'fuggoben', -- fuggoben | elkuldve | kihagyva | torolve | hiba
  ok TEXT,                                  -- miert kihagyva / torolve
  probalkozas INTEGER NOT NULL DEFAULT 0,
  elkuldve INTEGER,
  szolgaltato_id TEXT,                      -- SimpleSMS sms_id / SMTP uzenet-azonosito
  szegmens_db INTEGER,                      -- SMS: hany szegmens (koltseg)
  hiba TEXT,
  UNIQUE (foglalas_id, uzenet_id)
);
CREATE INDEX IF NOT EXISTS idx_kuld_esedekes ON kuldesek (allapot, esedekes);

CREATE TABLE IF NOT EXISTS esemenyek (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ido INTEGER NOT NULL,
  tipus TEXT NOT NULL,                      -- ingest:foglalt | ingest:athelyezve | ingest:lemondva | ingest:ismeretlen | ...
  foglalas_id TEXT,
  forras_id TEXT UNIQUE,                    -- a Gmail-uzenet azonositoja (ismetlodes-szuro)
  reszlet TEXT                              -- rovid, szemelyes adat nelkuli JSON
);

-- Leiratkozas az automatikus e-mailekrol (/u/<kod>, leiratkozas.js): CSAK az e-mail SHA-256 hash-e (kisbetusitve), a foglalas torlese ezt nem erinti.
CREATE TABLE IF NOT EXISTS leiratkozasok (
  email_h TEXT PRIMARY KEY,
  ido INTEGER NOT NULL,                     -- epoch masodperc
  forras TEXT                               -- link | kezi
);

CREATE TABLE IF NOT EXISTS beallitasok (
  kulcs TEXT PRIMARY KEY,
  ertek TEXT,
  frissitve INTEGER
);

-- Medical Piercing (uzletag 'mp'): a levelek valodi Google-velemeny idezetei. NEM a nyilvanos repoban vannak: a sablon {vélemény:<kulcs>} helyorzoje
-- kuldeskor innen toltodik ki (render.js htmlKitolt); ha a sor hianyzik, a velemeny-blokk kimarad. Feltoltes: wrangler d1 execute (kezzel / a tulajdonos jovahagyasaval).
CREATE TABLE IF NOT EXISTS mp_velemenyek (
  kulcs TEXT PRIMARY KEY,                   -- a sablon kulcsa: v01 ... v24 (medicalpiercing/tools/levelek/general.py)
  szoveg TEXT,                              -- a velemeny szo szerint
  nev TEXT                                  -- a velemenyezo neve, ahogy a Google-on latszik
);

-- Medical Piercing (uzletag 'mp'): a kimeno levelek sora. A motor (kuldok.js mpSorba) ide irja a kesz levelet, a medicalpiercing Pages-projekt
-- POST /api/lifecycle-kimeno vegpontja (medicalpiercing/lib/lifecycle-kimeno.js) a sajat Gmail-fiokjabol kuldi ki. Kulcs / jelszo itt nincs.
-- elkuldve: NULL = var, < 0 = folyamatban (-<felvetel ideje>), > 0 = elkuldve (unix mp); probak: legfeljebb 5.
CREATE TABLE IF NOT EXISTS mp_kimeno (
  id TEXT PRIMARY KEY,
  cimzett TEXT NOT NULL,
  targy TEXT NOT NULL,
  html TEXT NOT NULL,
  szoveg TEXT,
  valasz TEXT,
  letrehozva INTEGER NOT NULL,
  elkuldve INTEGER,
  hiba TEXT,
  probak INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mp_kimeno_var ON mp_kimeno (elkuldve, letrehozva);
