-- Privat fajltarolo D1-ben (amig az R2 nincs engedelyezve): a kep / PDF bajtok base64 darabokban, a hozzaferes-ellenorzes a crm/lib/api.js-ben.
-- A camera_image / treatment_plan csak a storage_key-t tarolja; R2-re valtaskor csak a crm/lib/tarolo.js cserelodik.
CREATE TABLE IF NOT EXISTS crm_fajl (
  storage_key TEXT NOT NULL,
  seq INTEGER NOT NULL,            -- darab sorszama (0-tol)
  mime TEXT,
  meret INTEGER,                   -- az egesz fajl merete bajtban (minden darabnal azonos)
  adat TEXT NOT NULL,              -- base64
  letrehozva INTEGER NOT NULL,
  PRIMARY KEY (storage_key, seq)
);
