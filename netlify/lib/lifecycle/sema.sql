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

CREATE TABLE IF NOT EXISTS beallitasok (
  kulcs TEXT PRIMARY KEY,
  ertek TEXT,
  frissitve INTEGER
);
