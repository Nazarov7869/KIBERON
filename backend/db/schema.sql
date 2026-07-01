-- =====================================================================
--  IPAK YO'LI — EKSPORT ORKESTRATSIYA CRM
--  Ma'lumotlar bazasi sxemasi (PostgreSQL)   ·   001_init
--
--  Klasterlar: identity/katalog · ta'minot · talab · yig'ish ·
--              bajarish · ishonch   (reja v0.8, 24-bo'lim)
--
--  Diqqat: yangi (bo'sh) bazada ishga tushiriladi.
--  Ishga tushirish:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------
--  ENUM turlari
-- ---------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('super_admin','exporter','importer','logistics','warehouse','embassy');
CREATE TYPE legal_form       AS ENUM ('mchj','yatt','qk','aj','other');
CREATE TYPE company_type     AS ENUM ('producer','aggregator','both');
CREATE TYPE operator_type    AS ENUM ('hokimlik','cooperative','spv');
CREATE TYPE product_kind     AS ENUM ('agri','industrial');
CREATE TYPE storage_class    AS ENUM ('ambient','chilled','frozen','ca','gdp','hazmat','bonded','food_grade');
CREATE TYPE access_status    AS ENUM ('open','conditional','closed');
CREATE TYPE lot_status       AS ENUM ('complete','pooling','matched','shipped','closed');
CREATE TYPE quality_status   AS ENUM ('pending','passed','rejected');
CREATE TYPE pool_status      AS ENUM ('forming','full','matched','shipped','closed','cancelled');
CREATE TYPE entry_status     AS ENUM ('pending','accepted','rejected','withdrawn');
CREATE TYPE commitment_kind  AS ENUM ('claimed','warehoused');
CREATE TYPE export_mode      AS ENUM ('managed','self');
CREATE TYPE contract_model   AS ENUM ('agent','spv','lead');
CREATE TYPE escrow_status    AS ENUM ('none','held','advance_released','balance_released','closed','refunded');
CREATE TYPE order_status     AS ENUM ('draft','confirmed','in_transit','delivered','closed','cancelled');
CREATE TYPE payout_stage     AS ENUM ('advance','balance','commission');
CREATE TYPE dispute_status   AS ENUM ('open','reviewing','resolved','rejected');
CREATE TYPE insurance_type   AS ENUM ('cargo','credit');
CREATE TYPE doc_type         AS ENUM ('origin_cert','invoice','packing_list','contract','phyto','other');
CREATE TYPE transport_mode   AS ENUM ('rail','sea','road','air','multimodal');
CREATE TYPE container_type   AS ENUM ('c20','c40','c40hc','reefer');
CREATE TYPE incoterm         AS ENUM ('exw','fca','fob','cfr','cif','cpt','cip','dap','ddp');

-- =====================================================================
--  1) IDENTITY & KATALOG
-- =====================================================================

-- Eksport-operator (alohida yuridik shaxs — rasmiy eksportyor)
CREATE TABLE operator (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  bank         text,
  license      text,
  type         operator_type NOT NULL DEFAULT 'hokimlik',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Korxona (eksportyor — MChJ/YaTT/QK, STIR egasi)
CREATE TABLE company (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  stir          varchar(9) UNIQUE NOT NULL,                 -- STIR (9 raqam)
  legal_form    legal_form NOT NULL DEFAULT 'mchj',
  company_type  company_type NOT NULL DEFAULT 'producer',
  region        text,
  verified_by   uuid,                                       -- app_user(id) — FK keyin qo'shiladi
  rating        numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Foydalanuvchi (rol bilan; korxonaga tegishli yoki institutsional)
CREATE TABLE app_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role          user_role NOT NULL,
  company_id    uuid REFERENCES company(id) ON DELETE SET NULL,
  name          text NOT NULL,
  phone         varchar(20),
  email         text UNIQUE,
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- company.verified_by -> app_user (sikl bo'lgani uchun endi qo'shamiz)
ALTER TABLE company
  ADD CONSTRAINT company_verified_by_fk
  FOREIGN KEY (verified_by) REFERENCES app_user(id) ON DELETE SET NULL;

-- Mahsulot katalogi
CREATE TABLE product (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  hs_code            varchar(12) NOT NULL,
  kind               product_kind NOT NULL,
  storage_class      storage_class NOT NULL DEFAULT 'ambient',
  temp_min           numeric(5,1),
  temp_max           numeric(5,1),
  food_grade         boolean NOT NULL DEFAULT false,
  hazmat             boolean NOT NULL DEFAULT false,
  season             text,
  avg_price_usd_ton  numeric(16,2),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Spetsifikatsiya shabloni (nazoratli lug'at — atributlar sxemasi)
CREATE TABLE spec_template (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  schema      jsonb NOT NULL DEFAULT '{}',                  -- {size, color, moisture, so2, organic, variety, packaging, pesticide}
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Koridor (transport yo'lagi)
CREATE TABLE corridor (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  waypoints        jsonb NOT NULL DEFAULT '[]',             -- [[lat,lng],...]
  entry_point      jsonb,                                   -- [lat,lng]
  rate_per_ton_km  numeric(10,4),
  freight_per_feu_min numeric(12,2),
  freight_per_feu_max numeric(12,2),
  transit_days     int
);

-- Bozor (maqsadli davlat)
CREATE TABLE market (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country       text NOT NULL,
  corridor_id   uuid REFERENCES corridor(id) ON DELETE SET NULL,
  tariff_pct    numeric(6,3) NOT NULL DEFAULT 0,
  demand_notes  text
);

-- Bozorga kirish (svetofor) — HS bo'limi + bozor
CREATE TABLE market_access (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hs_chapter  varchar(4) NOT NULL,                          -- HS dastlabki 2-4 raqam
  market_id   uuid NOT NULL REFERENCES market(id) ON DELETE CASCADE,
  status      access_status NOT NULL,
  reason      text,
  UNIQUE (hs_chapter, market_id)
);

-- Omborxona
CREATE TABLE warehouse (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  lat              numeric(9,6),
  lng              numeric(9,6),
  region           text,
  storage_classes  storage_class[] NOT NULL DEFAULT '{}',
  temp_min         numeric(5,1),
  temp_max         numeric(5,1),
  food_grade       boolean NOT NULL DEFAULT false,
  hazmat           boolean NOT NULL DEFAULT false,
  bonded           boolean NOT NULL DEFAULT false,
  capacity_free_t  numeric(12,3),
  storage_rate_usd_ton_month numeric(10,2),
  rating           numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5)
);

-- Logistika provayderi
CREATE TABLE logistics_provider (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  modes       transport_mode[] NOT NULL DEFAULT '{}',
  cold_chain  boolean NOT NULL DEFAULT false,
  rating      numeric(3,2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5)
);

-- Provayder <-> koridor (ko'p-ko'p)
CREATE TABLE logistics_corridor (
  provider_id  uuid NOT NULL REFERENCES logistics_provider(id) ON DELETE CASCADE,
  corridor_id  uuid NOT NULL REFERENCES corridor(id) ON DELETE CASCADE,
  PRIMARY KEY (provider_id, corridor_id)
);

-- Sertifikat talabi (bozor yoki HS bo'limi bo'yicha)
CREATE TABLE certification (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id   uuid REFERENCES market(id) ON DELETE CASCADE,
  hs_chapter  varchar(4),
  cert_type   text NOT NULL,                                -- CE, EAC, KC, phyto, GMP, halal...
  issuer      text,
  required    boolean NOT NULL DEFAULT true,
  est_cost_usd numeric(12,2),
  est_days     int,
  CHECK (market_id IS NOT NULL OR hs_chapter IS NOT NULL)
);

-- Mayoq / floor narx (axborot tengsizligiga qarshi)
CREATE TABLE price_ref (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  grade          smallint CHECK (grade BETWEEN 1 AND 3),
  market_id      uuid REFERENCES market(id) ON DELETE CASCADE,
  reference_usd  numeric(16,2),
  floor_usd      numeric(16,2),
  as_of          date NOT NULL DEFAULT CURRENT_DATE
);

-- =====================================================================
--  2) TA'MINOT (supply)
-- =====================================================================

-- Lot — korxona taklif qilgan partiya
CREATE TABLE lot (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  warehouse_id    uuid REFERENCES warehouse(id) ON DELETE SET NULL,
  spec            jsonb NOT NULL DEFAULT '{}',
  grade           smallint CHECK (grade BETWEEN 1 AND 3),
  quantity_t      numeric(12,3) NOT NULL CHECK (quantity_t > 0),
  price_per_ton   numeric(16,2),
  quality_status  quality_status NOT NULL DEFAULT 'pending',
  inspector_id    uuid REFERENCES app_user(id) ON DELETE SET NULL,
  lab_result      jsonb,
  origin          text,                                     -- traceability (agregator uchun manba)
  status          lot_status NOT NULL DEFAULT 'complete',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
--  3) TALAB (demand)
-- =====================================================================

-- RFQ — haridor talabi (yig'ishni ishga tushiradi)
CREATE TABLE rfq (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importer_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  spec              jsonb NOT NULL DEFAULT '{}',
  grade             smallint CHECK (grade BETWEEN 1 AND 3),
  target_quantity_t numeric(12,3) NOT NULL CHECK (target_quantity_t > 0),
  market_id         uuid REFERENCES market(id) ON DELETE SET NULL,
  incoterm          incoterm,
  maq_t             numeric(12,3),                          -- minimal qabul qilinadigan hajm
  tolerance_pct     numeric(6,3) DEFAULT 5,
  deadline          date,
  price_ceiling_usd numeric(16,2),
  status            text NOT NULL DEFAULT 'open',
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Elchixona topgan haridor (lead)
CREATE TABLE embassy_lead (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embassy_user_id   uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  importer_contact  text,
  market_id         uuid REFERENCES market(id) ON DELETE SET NULL,
  product_id        uuid REFERENCES product(id) ON DELETE SET NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
--  4) YIG'ISH (matching)
-- =====================================================================

-- Pool — yig'ish zonasi
CREATE TABLE pool (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id              uuid REFERENCES rfq(id) ON DELETE SET NULL,
  product_id          uuid NOT NULL REFERENCES product(id) ON DELETE RESTRICT,
  spec                jsonb NOT NULL DEFAULT '{}',
  grade               smallint CHECK (grade BETWEEN 1 AND 3),
  target_qty_t        numeric(12,3) NOT NULL CHECK (target_qty_t > 0),
  filled_qty_t        numeric(12,3) NOT NULL DEFAULT 0,
  status              pool_status NOT NULL DEFAULT 'forming',
  score_weights       jsonb NOT NULL DEFAULT '{"quality":0.4,"rating":0.3,"price":0.2,"distance":0.1}',
  newcomer_quota_pct  numeric(6,3) NOT NULL DEFAULT 15,
  clearing_price_usd  numeric(16,2),
  deadline            date,
  forward             boolean NOT NULL DEFAULT false,       -- hosildan oldin (forward-pooling)
  logistics_window    text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Pool ishtirokchisi (qaysi korxona / qaysi lot)
CREATE TABLE pool_entry (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id              uuid NOT NULL REFERENCES pool(id) ON DELETE CASCADE,
  company_id           uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  lot_id               uuid NOT NULL REFERENCES lot(id) ON DELETE CASCADE,
  quantity_t           numeric(12,3) NOT NULL CHECK (quantity_t > 0),
  share_pct            numeric(6,3),
  score                numeric(8,4),
  rank                 int,
  status               entry_status NOT NULL DEFAULT 'pending',
  stake_amount         numeric(16,2) NOT NULL DEFAULT 0,    -- majburiyat garovi
  commitment           commitment_kind NOT NULL DEFAULT 'claimed',
  warehouse_receipt_id text,
  no_show_penalty      numeric(16,2) NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, lot_id)
);

-- =====================================================================
--  5) BAJARISH (fulfillment)
-- =====================================================================

-- Buyurtma (pool matched -> order).  "order" — rezerv so'z, shuning uchun export_order
CREATE TABLE export_order (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id              uuid REFERENCES pool(id) ON DELETE SET NULL,
  importer_id          uuid REFERENCES app_user(id) ON DELETE SET NULL,
  operator_id          uuid REFERENCES operator(id) ON DELETE SET NULL,
  export_mode          export_mode NOT NULL DEFAULT 'managed',
  exporter_company_id  uuid REFERENCES company(id) ON DELETE SET NULL,  -- self rejimda
  contract_model       contract_model,
  incoterm             incoterm,
  transport_mode       transport_mode,
  container_type       container_type,
  currency             varchar(3) NOT NULL DEFAULT 'USD',
  fx_rate              numeric(14,6),
  repatriation_status  text,
  total_value_usd      numeric(16,2),
  advance_pct          numeric(6,3) NOT NULL DEFAULT 30,
  commission_pct       numeric(6,3) NOT NULL DEFAULT 1,
  escrow_status        escrow_status NOT NULL DEFAULT 'none',
  tracking_code        text UNIQUE,
  status               order_status NOT NULL DEFAULT 'draft',
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Jo'natma
CREATE TABLE shipment (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  warehouse_id     uuid REFERENCES warehouse(id) ON DELETE SET NULL,
  corridor_id      uuid REFERENCES corridor(id) ON DELETE SET NULL,
  provider_id      uuid REFERENCES logistics_provider(id) ON DELETE SET NULL,
  container_type   container_type,
  departure_date   date,
  status           text NOT NULL DEFAULT 'preparing',
  tracking_events  jsonb NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Escrow (pul kafolati) — buyurtmaga 1:1
CREATE TABLE escrow (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL UNIQUE REFERENCES export_order(id) ON DELETE CASCADE,
  total_usd  numeric(16,2) NOT NULL,
  currency   varchar(3) NOT NULL DEFAULT 'USD',
  status     escrow_status NOT NULL DEFAULT 'held',
  held_at    timestamptz NOT NULL DEFAULT now()
);

-- To'lov (korxonaga ulush)
CREATE TABLE payout (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  company_id uuid REFERENCES company(id) ON DELETE SET NULL,
  amount_usd numeric(16,2) NOT NULL,
  currency   varchar(3) NOT NULL DEFAULT 'UZS',
  stage      payout_stage NOT NULL,
  paid_at    timestamptz
);

-- Sug'urta
CREATE TABLE insurance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  type       insurance_type NOT NULL,
  provider   text,
  amount_usd numeric(16,2),
  policy_no  text
);

-- Hujjat
CREATE TABLE document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  type          doc_type NOT NULL,
  file_ref      text,
  generated_at  timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
--  6) ISHONCH (trust)
-- =====================================================================

-- Reyting (polimorfik: korxona yoki foydalanuvchi)
CREATE TABLE rating (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ratee_company_id uuid REFERENCES company(id) ON DELETE CASCADE,
  ratee_user_id    uuid REFERENCES app_user(id) ON DELETE CASCADE,
  rater_user_id    uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role             user_role,
  score            numeric(3,2) NOT NULL CHECK (score BETWEEN 0 AND 5),
  comment          text,
  order_id         uuid REFERENCES export_order(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(ratee_company_id, ratee_user_id) = 1)   -- aniq bittasi
);

-- Nizo (hakam — super_admin/hokimlik)
CREATE TABLE dispute (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES export_order(id) ON DELETE CASCADE,
  raised_by   uuid NOT NULL REFERENCES app_user(id) ON DELETE SET NULL,
  reason      text NOT NULL,
  arbiter_id  uuid REFERENCES app_user(id) ON DELETE SET NULL,
  resolution  text,
  status      dispute_status NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
--  INDEKSLAR (so'rovlar uchun)
-- =====================================================================
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
--  Sxema tugadi — 24 jadval + 1 join + ENUMlar + indekslar
-- =====================================================================
