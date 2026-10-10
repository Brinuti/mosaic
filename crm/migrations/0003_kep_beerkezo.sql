-- Kep-beerkezo: a tablet (amelyikhez a hajkamera csatlakozik) ide tolti fel a kepeket vendeg megadasa NELKUL;
-- a kezelo (akar masik eszkozon) a kepet nezi meg es rendeli a vendeg / alkalom ala. Nem hozzarendelt kep rovid ido utan torlodik.
CREATE TABLE IF NOT EXISTS image_inbox (
  id TEXT PRIMARY KEY,
  storage_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  uploaded_by TEXT NOT NULL REFERENCES staff_user (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbox_lejarat ON image_inbox (expires_at);
