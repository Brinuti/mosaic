-- Oxigen mini CRM - teljes alap-semma (Cloudflare D1 / SQLite). Ujrafuttathato: minden CREATE ... IF NOT EXISTS, a magadatok INSERT OR IGNORE.
-- Szabalyok: ID = UUID (TEXT; kivetel: salonic_account.id, role.id, service_catalog.code = olvashato kulcs), ido = epoch MASODPERC (INTEGER),
-- penz = egesz forint (INTEGER). Az audit-jellegu tablak (security_audit, booking_event, merge_audit, consent_event, package_adjustment,
-- complaint_contact_attempt, message_ledger) csak hozzafuzhetok (UPDATE / DELETE trigger tiltja). A guest_id-ra mutato tablak listaja a
-- crm/lib/merge.js MERGE_TABLAK-ban van (osszevonaskor ezek kerulnek at).
-- A konstans-ertekek (arak, idotartamok) a crm/lib/constants.js-ben vannak; az itteni magadatok ezzel megegyeznek (teszt ellenorzi).


-- ---------------------------------------------------------------------------------------------------------------------------------
-- Munkatarsak, szerepkorok
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,                 -- egyeni belepes: kisbetus e-mail
  name TEXT NOT NULL,
  salonic_name TEXT,                          -- a kezelo neve a Salonicban (szakembermap)
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS role (
  id TEXT PRIMARY KEY CHECK (id IN ('therapist', 'clinical_lead', 'reception', 'salon_manager', 'marketing', 'admin')),
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_role (
  staff_id TEXT NOT NULL REFERENCES staff_user (id),
  role_id TEXT NOT NULL REFERENCES role (id),
  granted_by TEXT,
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (staff_id, role_id)
);

-- Belepes: e-mailes egyszeri kod + munkamenet (jelszo nincs)
CREATE TABLE IF NOT EXISTS login_otp (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,                    -- SHA-256, a kod maga nem tarolodik
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at INTEGER,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_login_otp_email ON login_otp (email, created_at);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  staff_id TEXT NOT NULL REFERENCES staff_user (id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at INTEGER,
  ip_hash TEXT,
  ua_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_session_staff ON session (staff_id);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Vendeg, Salonic-fiokok, azonossagok, osszevonas
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guest (
  id TEXT PRIMARY KEY,                        -- ez a guest_key (belso UUID)
  name TEXT,
  email TEXT,                                 -- normalizalt (kisbetus)
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  phone TEXT,                                 -- normalizalt E.164 (+36...)
  phone_verified INTEGER NOT NULL DEFAULT 0 CHECK (phone_verified IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'deleted')),
  merged_into TEXT REFERENCES guest (id),
  therapist_id TEXT REFERENCES staff_user (id),   -- megszokott / legutobbi kezelo
  clinical_stop TEXT CHECK (clinical_stop IS NULL OR clinical_stop IN ('contraindication', 'adverse_reaction', 'medical_referral')),
  clinical_stop_at INTEGER,
  last_treatment_at INTEGER,                  -- retention: utolso igazolt kezeles
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_guest_email ON guest (email);
CREATE INDEX IF NOT EXISTS idx_guest_phone ON guest (phone);
CREATE INDEX IF NOT EXISTS idx_guest_status ON guest (status);

CREATE TABLE IF NOT EXISTS salonic_account (
  id TEXT PRIMARY KEY,                        -- fiok-kulcs (slug), pl. 'mosaic-oxigen'; tobb fiok is felveheto
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'INTEGRATION_BLOCKED',  -- integracios allapot (nincs Salonic API: az ertesito-elemzes adja az adatot)
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS salonic_guest_identity (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL REFERENCES salonic_account (id),
  external_id TEXT NOT NULL,                  -- Salonic vendegazonosito; ha nincs: 'email:<cim>' vagy 'tel:<szam>'
  guest_id TEXT NOT NULL REFERENCES guest (id),
  name TEXT,
  email TEXT,
  phone TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (account, external_id)
);
CREATE INDEX IF NOT EXISTS idx_identity_guest ON salonic_guest_identity (guest_id);

CREATE TABLE IF NOT EXISTS identity_merge_request (
  id TEXT PRIMARY KEY,
  source_guest_id TEXT NOT NULL REFERENCES guest (id),   -- ez olvad be
  target_guest_id TEXT NOT NULL REFERENCES guest (id),   -- ebbe
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reverted')),
  email_match INTEGER NOT NULL DEFAULT 0,
  phone_match INTEGER NOT NULL DEFAULT 0,
  name_match INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  involved_staff TEXT,                        -- JSON: az erintett kezelok (staff_user.id)
  requested_at INTEGER NOT NULL,
  decided_by TEXT REFERENCES staff_user (id),
  decided_at INTEGER,
  decision_note TEXT,
  CHECK (source_guest_id <> target_guest_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_merge_pending ON identity_merge_request (source_guest_id, target_guest_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_merge_status ON identity_merge_request (status, requested_at);

CREATE TABLE IF NOT EXISTS merge_audit (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('auto_link', 'auto_merge', 'manual_merge', 'revert')),
  request_id TEXT,
  source_guest_id TEXT NOT NULL,
  target_guest_id TEXT NOT NULL,
  reverts_id TEXT UNIQUE,                     -- revert: melyik osszevonast vonja vissza (egyszer lehet)
  snapshot TEXT,                              -- JSON: athelyezett sor-azonositok tablankent (a visszaforditashoz)
  staff_id TEXT,
  at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Szolgaltatas-katalogus, foglalas
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_catalog (
  code TEXT PRIMARY KEY CHECK (code IN ('first_hair', 'followup_hair', 'camera_assessment', 'legacy_combo_only')),
  name TEXT NOT NULL,
  duration_min INTEGER,
  price_huf INTEGER,
  counts_as_treatment INTEGER NOT NULL CHECK (counts_as_treatment IN (0, 1)),
  sellable INTEGER NOT NULL CHECK (sellable IN (0, 1)),
  salonic_service_ids TEXT NOT NULL DEFAULT '{}',   -- JSON: {"<fiok>": ["<salonic szolgaltatas-id>", ...]} (read-only kontroll)
  note TEXT
);

CREATE TABLE IF NOT EXISTS booking (
  id TEXT PRIMARY KEY,                        -- booking_uuid
  account TEXT NOT NULL REFERENCES salonic_account (id),
  external_id TEXT NOT NULL,                  -- Salonic foglalas-azonosito (vagy a lifecycle szintetikus hash-e)
  guest_id TEXT NOT NULL REFERENCES guest (id),
  service_code TEXT NOT NULL REFERENCES service_catalog (code),
  therapist_id TEXT REFERENCES staff_user (id),
  therapist_name TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'rescheduled', 'cancelled', 'no_show', 'completed')),
  version INTEGER NOT NULL DEFAULT 1,         -- optimista zaras
  booked_at INTEGER NOT NULL,                 -- a foglalas letrehozasa (Salonic-oldal, ennek hianyaban az elso latas)
  original_start_at INTEGER NOT NULL,
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  cancelled_at INTEGER,
  no_show_at INTEGER,
  completed_at INTEGER,
  completed_by TEXT REFERENCES staff_user (id),
  duplicate_of TEXT REFERENCES booking (id),  -- osszevonaskor kiszurt dupla (ugyanaz a foglalas 2 fiokban)
  last_event_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (account, external_id),
  CHECK (status <> 'completed' OR (completed_by IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_booking_guest ON booking (guest_id, start_at);
CREATE INDEX IF NOT EXISTS idx_booking_status_start ON booking (status, start_at);
CREATE INDEX IF NOT EXISTS idx_booking_therapist ON booking (therapist_id, start_at);
-- ugyanaz a vendeg ugyanarra az idopontra, ugyanarra a szolgaltatasra nem lehet ketszer aktiv (2 fiokban sem)
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_guest_slot ON booking (guest_id, service_code, start_at)
  WHERE status IN ('booked', 'rescheduled', 'completed') AND duplicate_of IS NULL;

CREATE TABLE IF NOT EXISTS booking_event (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,                         -- booked | rescheduled | cancelled | no_show | completed | stale | duplicate_ignored | invalid_transition | salonic_attended_hint
  from_status TEXT,
  to_status TEXT,
  old_start_at INTEGER,
  new_start_at INTEGER,
  actor TEXT NOT NULL DEFAULT 'system',       -- 'system' vagy staff_user.id
  event_at INTEGER NOT NULL,
  detail TEXT,                                -- JSON, szemelyes adat nelkul
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_booking_event_booking ON booking_event (booking_id, event_at);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Kura, kezeles
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'active', 'completed_11', 'paused_clinical', 'closed_individual')),
  treatment_index INTEGER NOT NULL DEFAULT 0 CHECK (treatment_index BETWEEN 0 AND 11),   -- az igazolt, teljesitett kezelesek szama
  started_at INTEGER,
  completed_at INTEGER,
  paused_at INTEGER,
  paused_reason TEXT,
  closed_at INTEGER,
  closed_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- vendegenkent egyszerre egy nyitott kura
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_open ON course (guest_id) WHERE status IN ('not_started', 'active', 'paused_clinical');

CREATE TABLE IF NOT EXISTS treatment_session (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES booking (id),      -- egy foglalas = legfeljebb egy kezeles (duplazodas ellen)
  course_id TEXT NOT NULL REFERENCES course (id),
  guest_id TEXT NOT NULL REFERENCES guest (id),
  treatment_index INTEGER NOT NULL CHECK (treatment_index BETWEEN 1 AND 11),
  therapist_id TEXT NOT NULL REFERENCES staff_user (id),
  confirmed_by TEXT NOT NULL REFERENCES staff_user (id),
  confirmed_at INTEGER NOT NULL,
  camera_required INTEGER NOT NULL DEFAULT 0 CHECK (camera_required IN (0, 1)),
  created_at INTEGER NOT NULL,
  UNIQUE (course_id, treatment_index)
);
CREATE INDEX IF NOT EXISTS idx_session_guest ON treatment_session (guest_id);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Berlet, ajandek
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS package_purchase (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  package_type TEXT NOT NULL CHECK (package_type IN ('package_5', 'package_10')),
  price_huf INTEGER NOT NULL,
  units_total INTEGER NOT NULL,
  units_adjust INTEGER NOT NULL DEFAULT 0,    -- kezi korrekcio (package_adjustment) osszege
  channel TEXT NOT NULL DEFAULT 'in_person' CHECK (channel = 'in_person'),   -- csak szemelyes vasarlas
  paid_upfront INTEGER NOT NULL DEFAULT 1 CHECK (paid_upfront = 1),          -- teljes dij elore
  paid_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  original_expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid_active' CHECK (status IN ('paid_active', 'exhausted', 'expired', 'extended_by_manager', 'refunded')),
  early_purchase INTEGER NOT NULL DEFAULT 0 CHECK (early_purchase IN (0, 1)),   -- az elso kezeles elott / napjan vasarolt
  recorded_by TEXT NOT NULL REFERENCES staff_user (id),
  idempotency_key TEXT UNIQUE,
  refunded_at INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_package_guest ON package_purchase (guest_id);
CREATE INDEX IF NOT EXISTS idx_package_expiry ON package_purchase (status, expires_at);

CREATE TABLE IF NOT EXISTS package_redemption (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES package_purchase (id),
  booking_id TEXT NOT NULL UNIQUE REFERENCES booking (id),      -- egy foglalas legfeljebb egy bérletalkalmat fogyaszt
  guest_id TEXT NOT NULL REFERENCES guest (id),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'used', 'released', 'forfeited')),
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'staff')),
  reserved_at INTEGER NOT NULL,
  used_at INTEGER,
  released_at INTEGER,
  forfeited_at INTEGER,
  expiry_reschedules INTEGER NOT NULL DEFAULT 0,   -- lejarat utani athelyezesek szama (max 1)
  policy_violation TEXT,                      -- pl. 'masodik_athelyezes', 'tul_keso_athelyezes'
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_redemption_purchase ON package_redemption (purchase_id, status);

CREATE TABLE IF NOT EXISTS package_adjustment (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES package_purchase (id),
  kind TEXT NOT NULL CHECK (kind IN ('extension', 'refund_full', 'refund_individual', 'manual_correction', 'gift_return')),
  delta_units INTEGER,
  old_expires_at INTEGER,
  new_expires_at INTEGER,
  amount_huf INTEGER,
  reason TEXT NOT NULL,
  approved_by TEXT NOT NULL REFERENCES staff_user (id),
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_adjustment_purchase ON package_adjustment (purchase_id);

CREATE TABLE IF NOT EXISTS package_gift (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES package_purchase (id),
  kind TEXT NOT NULL CHECK (kind IN ('shampoo_1l', 'conditioner_1l', 'extra_small')),
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'handed_over', 'return_due', 'returned', 'kept_opened', 'cancelled')),
  stock_dependent INTEGER NOT NULL DEFAULT 0 CHECK (stock_dependent IN (0, 1)),
  handed_at INTEGER,
  handed_by TEXT REFERENCES staff_user (id),
  returned_at INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gift_purchase ON package_gift (purchase_id);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Digitalis allapotfelmero, kontraindikacio
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment (               -- a kerdoiv VERZIOI
  id TEXT PRIMARY KEY,
  question_version TEXT NOT NULL UNIQUE,
  questions TEXT NOT NULL,                    -- JSON: kerdescsoportok (REQUIRES_VERIFICATION jeloltekkel)
  approved_by_clinical_lead INTEGER NOT NULL DEFAULT 0 CHECK (approved_by_clinical_lead IN (0, 1)),
  approved_by TEXT REFERENCES staff_user (id),
  approved_at INTEGER,
  retired_at INTEGER,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  CHECK (approved_by_clinical_lead = 0 OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS assessment_submission (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES assessment (id),
  guest_id TEXT NOT NULL REFERENCES guest (id),
  booking_id TEXT REFERENCES booking (id),
  token_hash TEXT UNIQUE,                     -- a kitoltesi link tokenjenek hash-e
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'submitted', 'reviewed')),
  answers TEXT,                               -- JSON (egeszsegi adat!)
  privacy_accepted_at INTEGER,                -- adatkezelesi tajekoztato elfogadasa (NEM marketing-hozzajarulas)
  safety_flag INTEGER NOT NULL DEFAULT 0 CHECK (safety_flag IN (0, 1)),
  flagged_questions TEXT,                     -- JSON: a jelzest kivalto kerdes-kulcsok
  issued_at INTEGER NOT NULL,
  submitted_at INTEGER,
  reviewed_by TEXT REFERENCES staff_user (id),
  reviewed_at INTEGER,
  review_outcome TEXT CHECK (review_outcome IS NULL OR review_outcome IN ('cleared', 'consult', 'postponed', 'contraindicated')),
  review_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_submission_guest ON assessment_submission (guest_id);
CREATE INDEX IF NOT EXISTS idx_submission_booking ON assessment_submission (booking_id);

CREATE TABLE IF NOT EXISTS contraindication_alert (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE REFERENCES assessment_submission (id),
  guest_id TEXT NOT NULL REFERENCES guest (id),
  booking_id TEXT REFERENCES booking (id),
  therapist_id TEXT REFERENCES staff_user (id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'cleared', 'clinical_stop')),
  flagged TEXT,                               -- JSON: kerdes-kulcsok
  created_at INTEGER NOT NULL,
  acknowledged_by TEXT REFERENCES staff_user (id),
  acknowledged_at INTEGER,
  resolved_by TEXT REFERENCES staff_user (id),
  resolved_at INTEGER,
  resolution TEXT
);
CREATE INDEX IF NOT EXISTS idx_alert_status ON contraindication_alert (status, created_at);

-- 4 990 Ft hajkamera-beszamitas
CREATE TABLE IF NOT EXISTS assessment_credit (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  camera_booking_id TEXT NOT NULL UNIQUE REFERENCES booking (id),
  amount_huf INTEGER NOT NULL,
  window_start INTEGER NOT NULL,              -- a felmeres idopontja
  window_end INTEGER NOT NULL,                -- +30 naptari nap (budapesti nap vege)
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'eligible', 'used', 'expired', 'void')),
  first_booking_id TEXT REFERENCES booking (id),
  eligible_at INTEGER,
  used_at INTEGER,
  used_booking_uuid TEXT,
  used_by_staff_id TEXT REFERENCES staff_user (id),
  created_at INTEGER NOT NULL,
  CHECK ((status = 'used') = (used_at IS NOT NULL)),
  CHECK (used_at IS NULL OR (used_booking_uuid IS NOT NULL AND used_by_staff_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_used_booking ON assessment_credit (used_booking_uuid) WHERE used_booking_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_guest ON assessment_credit (guest_id, status);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Kuraterv, jegyzet
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatment_plan (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES treatment_session (id),
  guest_id TEXT NOT NULL REFERENCES guest (id),
  course_id TEXT NOT NULL REFERENCES course (id),
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'review', 'closing')),     -- plan = 1. alkalom A5; review = 3/5/10 kontroll; closing = 11. kurazaro
  status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('missing', 'draft', 'therapist_final', 'generated_pdf', 'sent')),
  therapist_id TEXT REFERENCES staff_user (id),
  fields TEXT,                                -- JSON: a digitalis urlap mezoi
  version INTEGER NOT NULL DEFAULT 1,
  due_at INTEGER NOT NULL,                    -- teljesites + 24 ora
  final_at INTEGER,
  approved_by TEXT REFERENCES staff_user (id),
  pdf_file_id TEXT,
  pdf_generated_at INTEGER,
  recipient_email TEXT,
  sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_plan_status ON treatment_plan (status, due_at);

CREATE TABLE IF NOT EXISTS treatment_note (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES treatment_session (id),
  guest_id TEXT NOT NULL REFERENCES guest (id),
  therapist_id TEXT NOT NULL REFERENCES staff_user (id),
  kind TEXT NOT NULL CHECK (kind IN ('camera_review', 'general', 'adverse_reaction')),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  created_at INTEGER NOT NULL,
  final_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_note_session ON treatment_note (session_id);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Kepek, osszehasonlitas, megosztas
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS camera_image (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  session_id TEXT NOT NULL REFERENCES treatment_session (id),
  treatment_index INTEGER NOT NULL CHECK (treatment_index IN (1, 3, 5, 10)),
  capture_point TEXT NOT NULL,                -- ugyanaz a rogzitesi pont az osszehasonlithatosaghoz
  storage_key TEXT NOT NULL UNIQUE,           -- privat R2 kulcs (a tartalom nem az adatbazisban van)
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT,
  taken_by TEXT NOT NULL REFERENCES staff_user (id),
  taken_at INTEGER NOT NULL,
  deleted_at INTEGER,
  UNIQUE (session_id, capture_point)
);
CREATE INDEX IF NOT EXISTS idx_image_guest ON camera_image (guest_id, treatment_index);

CREATE TABLE IF NOT EXISTS image_comparison (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  image_a_id TEXT NOT NULL REFERENCES camera_image (id),
  image_b_id TEXT NOT NULL REFERENCES camera_image (id),
  note TEXT,                                  -- 2-3 mondatos szemelyes kezeloi ertekeles
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  author_id TEXT NOT NULL REFERENCES staff_user (id),
  created_at INTEGER NOT NULL,
  final_at INTEGER,
  CHECK (image_a_id <> image_b_id)
);
CREATE INDEX IF NOT EXISTS idx_comparison_guest ON image_comparison (guest_id);

CREATE TABLE IF NOT EXISTS share_grant (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  comparison_id TEXT REFERENCES image_comparison (id),
  token_hash TEXT NOT NULL UNIQUE,            -- csak a SHA-256 hash tarolodik
  email_at_issue TEXT NOT NULL,               -- a kiadaskori cimzett; e-mailvaltozasnal a grant ervenytelen
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  revoke_reason TEXT,
  last_access_at INTEGER,
  access_count INTEGER NOT NULL DEFAULT 0,
  issued_by TEXT NOT NULL DEFAULT 'system',
  renewed_from TEXT REFERENCES share_grant (id)
);
CREATE INDEX IF NOT EXISTS idx_grant_guest ON share_grant (guest_id);

CREATE TABLE IF NOT EXISTS share_verification (       -- uj link kerese: egyszer hasznalhato e-mail-ellenorzo token
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  origin_grant_id TEXT REFERENCES share_grant (id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  ip_hash TEXT
);

CREATE TABLE IF NOT EXISTS rate_limit (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Hozzajarulas, leiratkozas
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_event (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  channel TEXT NOT NULL CHECK (channel IN ('email_marketing', 'sms_marketing', 'image_marketing', 'privacy')),
  action TEXT NOT NULL CHECK (action IN ('granted', 'withdrawn')),
  text_version TEXT NOT NULL,
  text_snapshot TEXT,
  source TEXT NOT NULL,                       -- booking_form | staff | unsubscribe_link | sms_stop | assessment | admin
  recorded_by TEXT,
  ip_hash TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consent_guest ON consent_event (guest_id, channel, at);

CREATE TABLE IF NOT EXISTS unsubscribe (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  channel TEXT NOT NULL CHECK (channel IN ('email_marketing', 'sms_marketing', 'image_marketing')),
  source TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_unsub_guest ON unsubscribe (guest_id, channel, at);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Elegedettseg, panasz
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS survey_response (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  booking_id TEXT NOT NULL UNIQUE REFERENCES booking (id),        -- az elso completed kezeles
  therapist_id TEXT REFERENCES staff_user (id),                   -- kezelo-attribucio
  token_hash TEXT UNIQUE,
  score INTEGER CHECK (score IS NULL OR score BETWEEN 1 AND 5),
  comment TEXT,
  negative INTEGER NOT NULL DEFAULT 0 CHECK (negative IN (0, 1)),
  issued_at INTEGER NOT NULL,
  submitted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_survey_therapist ON survey_response (therapist_id, submitted_at);

CREATE TABLE IF NOT EXISTS review_request (            -- Google-ertekeleskeres: minden elso vendegnek, pontszamtol fuggetlenul
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  booking_id TEXT NOT NULL UNIQUE REFERENCES booking (id),
  due_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped')),
  sent_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS complaint (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  booking_id TEXT REFERENCES booking (id),
  survey_id TEXT UNIQUE REFERENCES survey_response (id),
  therapist_id TEXT NOT NULL REFERENCES staff_user (id),          -- a SAJAT kezelo a felelos
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  source TEXT NOT NULL CHECK (source IN ('survey', 'staff', 'email', 'phone')),
  description TEXT,
  opened_at INTEGER NOT NULL,
  due_at INTEGER NOT NULL,                                        -- megnyitas + 24 ora
  first_contact_at INTEGER,
  resolution TEXT,
  guest_satisfied INTEGER CHECK (guest_satisfied IS NULL OR guest_satisfied IN (0, 1)),
  resolved_by TEXT REFERENCES staff_user (id),
  resolved_at INTEGER,
  CHECK (status <> 'resolved' OR (resolution IS NOT NULL AND guest_satisfied = 1 AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_complaint_guest ON complaint (guest_id, status);

CREATE TABLE IF NOT EXISTS complaint_contact_attempt (
  id TEXT PRIMARY KEY,
  complaint_id TEXT NOT NULL REFERENCES complaint (id),
  kind TEXT NOT NULL CHECK (kind IN ('call', 'email')),
  outcome TEXT NOT NULL CHECK (outcome IN ('reached', 'no_answer', 'sent', 'bounced')),
  note TEXT,
  staff_id TEXT NOT NULL REFERENCES staff_user (id),
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempt_complaint ON complaint_contact_attempt (complaint_id, at);

CREATE TABLE IF NOT EXISTS compensation_approval (
  id TEXT PRIMARY KEY,
  complaint_id TEXT NOT NULL REFERENCES complaint (id),
  kind TEXT NOT NULL CHECK (kind IN ('refund', 'free_replacement', 'discount')),
  amount_huf INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by TEXT NOT NULL REFERENCES staff_user (id),
  requested_at INTEGER NOT NULL,
  decided_by TEXT REFERENCES staff_user (id),
  decided_at INTEGER,
  decision_note TEXT,
  CHECK (status = 'pending' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL))
);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Uzenetek (a motort a crm/lib/messages/ adja; a tablak itt vannak, hogy egy migracio legyen)
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_template (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL,                 -- pl. T0-F, R1
  version INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'internal')),
  grp TEXT NOT NULL CHECK (grp IN ('transactional', 'care', 'marketing', 'internal')),
  subject TEXT,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  UNIQUE (template_key, version)
);

CREATE TABLE IF NOT EXISTS message_job (
  id TEXT PRIMARY KEY,
  guest_id TEXT REFERENCES guest (id),
  template_key TEXT NOT NULL,
  template_version INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'internal')),
  context_id TEXT,                            -- pl. booking_id / purchase_id (az "alkalom")
  idempotency_key TEXT NOT NULL UNIQUE,       -- guest_key + template_key + context_id + template_version
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'sent', 'dry_run', 'skipped', 'blocked', 'failed', 'dead', 'cancelled')),
  stop_reason TEXT,                           -- SKIPPED_CONSENT_OR_STATE | BLOCKED_MISSING_DATA | SANDBOX_ONLY | ...
  run_at INTEGER NOT NULL,
  claimed_at INTEGER,
  claimed_by TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at INTEGER,
  payload TEXT,                               -- JSON, szemelyes adat nelkul
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_job_due ON message_job (status, run_at);
CREATE INDEX IF NOT EXISTS idx_job_guest ON message_job (guest_id);

CREATE TABLE IF NOT EXISTS message_ledger (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES message_job (id),
  guest_id TEXT,
  template_key TEXT NOT NULL,
  channel TEXT NOT NULL,
  context_id TEXT,
  outcome TEXT NOT NULL,                      -- sent | dry_run | skipped | blocked | failed
  stop_reason TEXT,
  provider_id TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_guest ON message_ledger (guest_id, at);

CREATE TABLE IF NOT EXISTS outbox_event (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,                   -- pl. booking.confirmed, complaint.opened, alert.negative_survey
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  guest_id TEXT,
  payload TEXT,                               -- JSON, szemelyes adat nelkul
  dedupe_key TEXT NOT NULL UNIQUE,            -- egy esemenybol soha nem lesz ket uzenet
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  processed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_event (status, created_at);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Megorzes, audit, beallitasok
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retention_purge_job (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest (id),
  planned_at INTEGER NOT NULL,                -- utolso kezeles + 36 honap
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'requested', 'blocked_legal', 'executed', 'cancelled')),
  reason TEXT NOT NULL,                       -- retention | erasure_request
  legal_note TEXT,
  requested_by TEXT,
  executed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_purge_open ON retention_purge_job (guest_id) WHERE status IN ('planned', 'requested', 'blocked_legal');

CREATE TABLE IF NOT EXISTS security_audit (          -- nincs FK: a naplo a vendeg torlese utan is megmarad
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  staff_id TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  guest_id TEXT,
  result TEXT NOT NULL CHECK (result IN ('ok', 'denied', 'error')),
  detail TEXT,                                -- JSON, szemelyes adat nelkul
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON security_audit (at);
CREATE INDEX IF NOT EXISTS idx_audit_guest ON security_audit (guest_id, at);
CREATE INDEX IF NOT EXISTS idx_audit_staff ON security_audit (staff_id, at);

CREATE TABLE IF NOT EXISTS beallitasok (
  kulcs TEXT PRIMARY KEY,
  ertek TEXT,
  frissitve INTEGER,
  frissitette TEXT
);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Triggerek: csak hozzafuzheto naplok, kredit-immutabilitas, foglalas-allapot vedelem
-- ---------------------------------------------------------------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_security_audit_append_only_upd BEFORE UPDATE ON security_audit BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_security_audit_append_only_del BEFORE DELETE ON security_audit BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_booking_event_append_only_upd BEFORE UPDATE ON booking_event BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_booking_event_append_only_del BEFORE DELETE ON booking_event BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_merge_audit_append_only_upd BEFORE UPDATE ON merge_audit BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_merge_audit_append_only_del BEFORE DELETE ON merge_audit BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
-- a guest_id kivetelevel nem modosithato (osszevonaskor a vendeg-hozzarendeles athelyezheto)
CREATE TRIGGER IF NOT EXISTS trg_consent_event_append_only_upd BEFORE UPDATE ON consent_event
WHEN NEW.id IS NOT OLD.id OR NEW.channel IS NOT OLD.channel OR NEW.action IS NOT OLD.action OR NEW.text_version IS NOT OLD.text_version
  OR NEW.text_snapshot IS NOT OLD.text_snapshot OR NEW.source IS NOT OLD.source OR NEW.recorded_by IS NOT OLD.recorded_by OR NEW.ip_hash IS NOT OLD.ip_hash OR NEW.at IS NOT OLD.at
BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_consent_event_append_only_del BEFORE DELETE ON consent_event BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_package_adjustment_append_only_upd BEFORE UPDATE ON package_adjustment BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_package_adjustment_append_only_del BEFORE DELETE ON package_adjustment BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_contact_attempt_append_only_upd BEFORE UPDATE ON complaint_contact_attempt BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_contact_attempt_append_only_del BEFORE DELETE ON complaint_contact_attempt BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_ledger_append_only_upd BEFORE UPDATE ON message_ledger
WHEN NEW.id IS NOT OLD.id OR NEW.job_id IS NOT OLD.job_id OR NEW.template_key IS NOT OLD.template_key OR NEW.channel IS NOT OLD.channel OR NEW.context_id IS NOT OLD.context_id
  OR NEW.outcome IS NOT OLD.outcome OR NEW.stop_reason IS NOT OLD.stop_reason OR NEW.provider_id IS NOT OLD.provider_id OR NEW.at IS NOT OLD.at
BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;
CREATE TRIGGER IF NOT EXISTS trg_ledger_append_only_del BEFORE DELETE ON message_ledger BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;

-- a felhasznalt 4 990 Ft-os credit nem modosithato es nem torolheto (ketszer SOHA)
CREATE TRIGGER IF NOT EXISTS trg_credit_used_immutable BEFORE UPDATE ON assessment_credit
WHEN OLD.used_at IS NOT NULL AND (NEW.used_at IS NOT OLD.used_at OR NEW.used_booking_uuid IS NOT OLD.used_booking_uuid
  OR NEW.used_by_staff_id IS NOT OLD.used_by_staff_id OR NEW.status <> 'used' OR NEW.amount_huf <> OLD.amount_huf)
BEGIN SELECT RAISE(ABORT, 'credit_immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_credit_used_no_delete BEFORE DELETE ON assessment_credit WHEN OLD.used_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'credit_immutable'); END;
-- levonni csak jogosult (eligible) creditet lehet
CREATE TRIGGER IF NOT EXISTS trg_credit_use_needs_eligible BEFORE UPDATE ON assessment_credit
WHEN OLD.used_at IS NULL AND NEW.used_at IS NOT NULL AND OLD.status <> 'eligible'
BEGIN SELECT RAISE(ABORT, 'credit_not_eligible'); END;

-- veglegesen lezart foglalas allapota nem valtozhat (completed duplazodas / feltamadas ellen)
CREATE TRIGGER IF NOT EXISTS trg_booking_terminal BEFORE UPDATE OF status ON booking
WHEN OLD.status IN ('cancelled', 'no_show', 'completed') AND NEW.status <> OLD.status
BEGIN SELECT RAISE(ABORT, 'booking_terminal_state'); END;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- Magadatok
-- ---------------------------------------------------------------------------------------------------------------------------------
INSERT OR IGNORE INTO role (id, description) VALUES
  ('therapist', 'Oxygeni-kezelo: kezelesi dokumentacio, kepek, allapotfelmero'),
  ('clinical_lead', 'Szakmai vezeto (Janka): szakmai riasztasok, kerdoiv-jovahagyas'),
  ('reception', 'Recepcio: idopont, berlet, ajandek, credit - minimalis kereskedelmi adat'),
  ('salon_manager', 'Szalonvezeto: penzugyi jovahagyas (hosszabbitas, refund, kompenzacio)'),
  ('marketing', 'Marketing: csak aggregalt statisztika'),
  ('admin', 'Rendszergazda: hozzaferes, beallitasok, audit-export');

-- EGY Salonic-fiok (tulajdonosi pontositas); tobb fiok is felveheto a salonic_account tablaban
INSERT OR IGNORE INTO salonic_account (id, label, active, status, created_at) VALUES ('mosaic-oxigen', 'MOSAIC Oxygeni (Salonic)', 1, 'INTEGRATION_BLOCKED', 0);

INSERT OR IGNORE INTO service_catalog (code, name, duration_min, price_huf, counts_as_treatment, sellable, note) VALUES
  ('first_hair', 'Elso hajoxigenterapias kezeles', 80, 29900, 1, 1, 'index 1; helyben fizetendo kezeles utan'),
  ('followup_hair', 'Tovabbi hajoxigenterapias kezeles', NULL, 26000, 1, 1, 'index 2..11'),
  ('camera_assessment', 'Hajkamerás allapotfelmeres', 30, 4990, 0, 1, 'NEM kezeles-alkalom; helyben fizetendo'),
  ('legacy_combo_only', 'Megszunt kombinalt arc+haj kezeles', NULL, NULL, 0, 0, 'csak a korabban visszaigazolt foglalasok teljesitesere; ujra nem ertekesitheto');
