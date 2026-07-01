-- =====================================================================
--  IPAK YO'LI — EKSPORT ORKESTRATSIYA CRM
--  Ma'lumotlar bazasi sxemasi (SQLite)   ·   001_init
--
--  PostgreSQL sxemasidan ko'chirilgan:
--   · ENUM turlari -> TEXT (+ CHECK cheklovlari)
--   · uuid DEFAULT gen_random_uuid() -> TEXT DEFAULT (randomblob asosidagi UUIDv4)
--   · timestamptz DEFAULT now() -> TEXT DEFAULT (CURRENT_TIMESTAMP)
--   · jsonb -> TEXT (JSON matni)
--   · massivlar (storage_class[], transport_mode[]) -> TEXT (JSON massiv)
--   · numeric -> NUMERIC/REAL, boolean -> INTEGER (0/1)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
--  1) IDENTITY & KATALOG
-- ---------------------------------------------------------------------

-- Eksport-operator
CREATE TABLE operator (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  name         TEXT NOT NULL,
  bank         TEXT,
  license      TEXT,
  type         TEXT NOT NULL DEFAULT 'hokimlik' CHECK (type IN ('hokimlik','cooperative','spv')),
  created_at   TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Korxona (verified_by -> app_user, lekin sikl bo'lgani uchun FK qo'yilmaydi)
CREATE TABLE company (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  name          TEXT NOT NULL,
  stir          TEXT UNIQUE NOT NULL,
  legal_form    TEXT NOT NULL DEFAULT 'mchj' CHECK (legal_form IN ('mchj','yatt','qk','aj','other')),
  company_type  TEXT NOT NULL DEFAULT 'producer' CHECK (company_type IN ('producer','aggregator','both')),
  region        TEXT,
  verified_by   TEXT,
  rating        NUMERIC NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Foydalanuvchi
CREATE TABLE app_user (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  role          TEXT NOT NULL CHECK (role IN ('super_admin','exporter','importer','logistics','warehouse','embassy')),
  company_id    TEXT REFERENCES company(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT UNIQUE,
  password_hash TEXT,
  created_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Mahsulot katalogi
CREATE TABLE product (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  name               TEXT NOT NULL,
  hs_code            TEXT NOT NULL,
  kind               TEXT NOT NULL CHECK (kind IN ('agri','industrial')),
  storage_class      TEXT NOT NULL DEFAULT 'ambient' CHECK (storage_class IN ('ambient','chilled','frozen','ca','gdp','hazmat','bonded','food_grade')),
  temp_min           NUMERIC,
  temp_max           NUMERIC,
  food_grade         INTEGER NOT NULL DEFAULT 0,
  hazmat             INTEGER NOT NULL DEFAULT 0,
  season             TEXT,
  avg_price_usd_ton  NUMERIC,
  created_at         TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Spetsifikatsiya shabloni
CREATE TABLE spec_template (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  product_id  TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  schema      TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Koridor
CREATE TABLE corridor (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  name             TEXT NOT NULL,
  waypoints        TEXT NOT NULL DEFAULT '[]',
  entry_point      TEXT,
  rate_per_ton_km  NUMERIC,
  freight_per_feu_min NUMERIC,
  freight_per_feu_max NUMERIC,
  transit_days     INTEGER
);

-- Bozor
CREATE TABLE market (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  country       TEXT NOT NULL,
  corridor_id   TEXT REFERENCES corridor(id) ON DELETE SET NULL,
  tariff_pct    NUMERIC NOT NULL DEFAULT 0,
  demand_notes  TEXT
);

-- Bozorga kirish (svetofor)
CREATE TABLE market_access (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  hs_chapter  TEXT NOT NULL,
  market_id   TEXT NOT NULL REFERENCES market(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('open','conditional','closed')),
  reason      TEXT,
  UNIQUE (hs_chapter, market_id)
);

-- Omborxona (storage_classes -> JSON massiv matni)
CREATE TABLE warehouse (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  name             TEXT NOT NULL,
  lat              NUMERIC,
  lng              NUMERIC,
  region           TEXT,
  storage_classes  TEXT NOT NULL DEFAULT '[]',
  temp_min         NUMERIC,
  temp_max         NUMERIC,
  food_grade       INTEGER NOT NULL DEFAULT 0,
  hazmat           INTEGER NOT NULL DEFAULT 0,
  bonded           INTEGER NOT NULL DEFAULT 0,
  capacity_free_t  NUMERIC,
  storage_rate_usd_ton_month NUMERIC,
  rating           NUMERIC NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5)
);

-- Logistika provayderi (modes -> JSON massiv matni)
CREATE TABLE logistics_provider (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  name        TEXT NOT NULL,
  modes       TEXT NOT NULL DEFAULT '[]',
  cold_chain  INTEGER NOT NULL DEFAULT 0,
  rating      NUMERIC NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5)
);

-- Provayder <-> koridor
CREATE TABLE logistics_corridor (
  provider_id  TEXT NOT NULL REFERENCES logistics_provider(id) ON DELETE CASCADE,
  corridor_id  TEXT NOT NULL REFERENCES corridor(id) ON DELETE CASCADE,
  PRIMARY KEY (provider_id, corridor_id)
);

-- Sertifikat talabi
CREATE TABLE certification (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  market_id   TEXT REFERENCES market(id) ON DELETE CASCADE,
  hs_chapter  TEXT,
  cert_type   TEXT NOT NULL,
  issuer      TEXT,
  required    INTEGER NOT NULL DEFAULT 1,
  est_cost_usd NUMERIC,
  est_days     INTEGER,
  CHECK (market_id IS NOT NULL OR hs_chapter IS NOT NULL)
);

-- Mayoq / floor narx
CREATE TABLE price_ref (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  product_id     TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  grade          INTEGER CHECK (grade BETWEEN 1 AND 3),
  market_id      TEXT REFERENCES market(id) ON DELETE CASCADE,
  reference_usd  NUMERIC,
  floor_usd      NUMERIC,
  as_of          TEXT NOT NULL DEFAULT (CURRENT_DATE)
);

-- ---------------------------------------------------------------------
--  2) TA'MINOT (supply)
-- ---------------------------------------------------------------------
CREATE TABLE lot (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  company_id      TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  warehouse_id    TEXT REFERENCES warehouse(id) ON DELETE SET NULL,
  spec            TEXT NOT NULL DEFAULT '{}',
  grade           INTEGER CHECK (grade BETWEEN 1 AND 3),
  quantity_t      NUMERIC NOT NULL CHECK (quantity_t > 0),
  price_per_ton   NUMERIC,
  quality_status  TEXT NOT NULL DEFAULT 'pending' CHECK (quality_status IN ('pending','passed','rejected')),
  inspector_id    TEXT REFERENCES app_user(id) ON DELETE SET NULL,
  lab_result      TEXT,
  origin          TEXT,
  status          TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete','pooling','matched','shipped','closed')),
  created_at      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ---------------------------------------------------------------------
--  3) TALAB (demand)
-- ---------------------------------------------------------------------
CREATE TABLE rfq (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  importer_id       TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  spec              TEXT NOT NULL DEFAULT '{}',
  grade             INTEGER CHECK (grade BETWEEN 1 AND 3),
  target_quantity_t NUMERIC NOT NULL CHECK (target_quantity_t > 0),
  market_id         TEXT REFERENCES market(id) ON DELETE SET NULL,
  incoterm          TEXT,
  maq_t             NUMERIC,
  tolerance_pct     NUMERIC DEFAULT 5,
  deadline          TEXT,
  price_ceiling_usd NUMERIC,
  status            TEXT NOT NULL DEFAULT 'open',
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Elchixona lead
CREATE TABLE embassy_lead (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  embassy_user_id   TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  importer_contact  TEXT,
  market_id         TEXT REFERENCES market(id) ON DELETE SET NULL,
  product_id        TEXT REFERENCES product(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ---------------------------------------------------------------------
--  4) YIG'ISH (matching)
-- ---------------------------------------------------------------------
CREATE TABLE pool (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  rfq_id              TEXT REFERENCES rfq(id) ON DELETE SET NULL,
  product_id          TEXT NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  spec                TEXT NOT NULL DEFAULT '{}',
  grade               INTEGER CHECK (grade BETWEEN 1 AND 3),
  target_qty_t        NUMERIC NOT NULL CHECK (target_qty_t > 0),
  filled_qty_t        NUMERIC NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'forming' CHECK (status IN ('forming','full','matched','shipped','closed','cancelled')),
  score_weights       TEXT NOT NULL DEFAULT '{"quality":0.4,"rating":0.3,"price":0.2,"distance":0.1}',
  newcomer_quota_pct  NUMERIC NOT NULL DEFAULT 15,
  clearing_price_usd  NUMERIC,
  deadline            TEXT,
  forward             INTEGER NOT NULL DEFAULT 0,
  logistics_window    TEXT,
  created_at          TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE pool_entry (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  pool_id              TEXT NOT NULL REFERENCES pool(id) ON DELETE CASCADE,
  company_id           TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  lot_id               TEXT NOT NULL REFERENCES lot(id) ON DELETE CASCADE,
  quantity_t           NUMERIC NOT NULL CHECK (quantity_t > 0),
  share_pct            NUMERIC,
  score                NUMERIC,
  rank                 INTEGER,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  stake_amount         NUMERIC NOT NULL DEFAULT 0,
  commitment           TEXT NOT NULL DEFAULT 'claimed' CHECK (commitment IN ('claimed','warehoused')),
  warehouse_receipt_id TEXT,
  no_show_penalty      NUMERIC NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE (pool_id, lot_id)
);

-- ---------------------------------------------------------------------
--  5) BAJARISH (fulfillment)
-- ---------------------------------------------------------------------
CREATE TABLE export_order (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  pool_id              TEXT REFERENCES pool(id) ON DELETE SET NULL,
  importer_id          TEXT REFERENCES app_user(id) ON DELETE SET NULL,
  operator_id          TEXT REFERENCES operator(id) ON DELETE SET NULL,
  export_mode          TEXT NOT NULL DEFAULT 'managed' CHECK (export_mode IN ('managed','self')),
  exporter_company_id  TEXT REFERENCES company(id) ON DELETE SET NULL,
  contract_model       TEXT,
  incoterm             TEXT,
  transport_mode       TEXT,
  container_type       TEXT,
  currency             TEXT NOT NULL DEFAULT 'USD',
  fx_rate              NUMERIC,
  repatriation_status  TEXT,
  total_value_usd      NUMERIC,
  advance_pct          NUMERIC NOT NULL DEFAULT 30,
  commission_pct       NUMERIC NOT NULL DEFAULT 1,
  escrow_status        TEXT NOT NULL DEFAULT 'none' CHECK (escrow_status IN ('none','held','advance_released','balance_released','closed','refunded')),
  tracking_code        TEXT UNIQUE,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','in_transit','delivered','closed','cancelled')),
  created_at           TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE shipment (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  order_id         TEXT NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  warehouse_id     TEXT REFERENCES warehouse(id) ON DELETE SET NULL,
  corridor_id      TEXT REFERENCES corridor(id) ON DELETE SET NULL,
  provider_id      TEXT REFERENCES logistics_provider(id) ON DELETE SET NULL,
  container_type   TEXT,
  departure_date   TEXT,
  status           TEXT NOT NULL DEFAULT 'preparing',
  tracking_events  TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE escrow (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  order_id   TEXT NOT NULL UNIQUE REFERENCES export_order(id) ON DELETE CASCADE,
  total_usd  NUMERIC NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'USD',
  status     TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('none','held','advance_released','balance_released','closed','refunded')),
  held_at    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE payout (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  order_id   TEXT NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  company_id TEXT REFERENCES company(id) ON DELETE SET NULL,
  amount_usd NUMERIC NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'UZS',
  stage      TEXT NOT NULL CHECK (stage IN ('advance','balance','commission')),
  paid_at    TEXT
);

CREATE TABLE insurance (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  order_id   TEXT NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('cargo','credit')),
  provider   TEXT,
  amount_usd NUMERIC,
  policy_no  TEXT
);

CREATE TABLE document (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  order_id      TEXT NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('origin_cert','invoice','packing_list','contract','phyto','other')),
  file_ref      TEXT,
  generated_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ---------------------------------------------------------------------
--  6) ISHONCH (trust)
-- ---------------------------------------------------------------------
CREATE TABLE rating (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  ratee_company_id TEXT REFERENCES company(id) ON DELETE CASCADE,
  ratee_user_id    TEXT REFERENCES app_user(id) ON DELETE CASCADE,
  rater_user_id    TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role             TEXT,
  score            NUMERIC NOT NULL CHECK (score BETWEEN 0 AND 5),
  comment          TEXT,
  order_id         TEXT REFERENCES export_order(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CHECK (num_nonnulls(ratee_company_id, ratee_user_id) = 1)
);

CREATE TABLE dispute (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  order_id    TEXT NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  raised_by   TEXT NOT NULL REFERENCES app_user(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  arbiter_id  TEXT REFERENCES app_user(id) ON DELETE SET NULL,
  resolution  TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','rejected')),
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ---------------------------------------------------------------------
--  INDEKSLAR
-- ---------------------------------------------------------------------
CREATE INDEX idx_app_user_company   ON app_user(company_id);
CREATE INDEX idx_app_user_role      ON app_user(role);
CREATE INDEX idx_lot_company        ON lot(company_id);
CREATE INDEX idx_lot_product        ON lot(product_id);
CREATE INDEX idx_lot_status         ON lot(status);
CREATE INDEX idx_rfq_product        ON rfq(product_id);
CREATE INDEX idx_rfq_status         ON rfq(status);
CREATE INDEX idx_pool_product       ON pool(product_id);
CREATE INDEX idx_pool_status        ON pool(status);
CREATE INDEX idx_pool_rfq           ON pool(rfq_id);
CREATE INDEX idx_entry_pool         ON pool_entry(pool_id);
CREATE INDEX idx_entry_company      ON pool_entry(company_id);
CREATE INDEX idx_order_pool         ON export_order(pool_id);
CREATE INDEX idx_order_status       ON export_order(status);
CREATE INDEX idx_shipment_order     ON shipment(order_id);
CREATE INDEX idx_payout_order       ON payout(order_id);
CREATE INDEX idx_rating_company     ON rating(ratee_company_id);
CREATE INDEX idx_dispute_order      ON dispute(order_id);
CREATE INDEX idx_market_access_lkp  ON market_access(hs_chapter, market_id);

-- =====================================================================
--  Sxema tugadi (SQLite)
-- =====================================================================

-- Ilova sozlamalari (kalit-qiymat): AI provayder kaliti va h.k. -----
CREATE TABLE IF NOT EXISTS app_setting (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- Bozor tahlili — mahsulot narx tarixi (OHLC sham + hajm) -----------
-- source: demo (generatsiya) | uzex | stat | manual (CSV import)
CREATE TABLE IF NOT EXISTS price_history (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
  product_id  TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  ts          TEXT NOT NULL,               -- YYYY-MM-DD
  open        NUMERIC NOT NULL,
  high        NUMERIC NOT NULL,
  low         NUMERIC NOT NULL,
  close       NUMERIC NOT NULL,
  volume      NUMERIC NOT NULL DEFAULT 0,
  source      TEXT NOT NULL DEFAULT 'demo',
  created_at  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_price_history_prod_ts ON price_history(product_id, ts);
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_history_prod_ts_src ON price_history(product_id, ts, source);
