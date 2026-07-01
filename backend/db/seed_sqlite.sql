-- =====================================================================
--  IPAK YO'LI — KATALOG SEED (SQLite)   ·   2-qadam
--  PostgreSQL seed'idan ko'chirilgan. CROSS JOIN LATERAL -> CTE+CASE,
--  ARRAY[...]::type[] -> JSON massiv matni, ::jsonb/::type -> olib tashlangan,
--  TRUNCATE ... CASCADE -> DELETE (bog'liqlik tartibida).
-- =====================================================================

-- Tozalash (bog'liqlik tartibida — bola jadvallar avval) --------------
DELETE FROM dispute;
DELETE FROM rating;
DELETE FROM document;
DELETE FROM insurance;
DELETE FROM payout;
DELETE FROM escrow;
DELETE FROM shipment;
DELETE FROM export_order;
DELETE FROM pool_entry;
DELETE FROM pool;
DELETE FROM embassy_lead;
DELETE FROM rfq;
DELETE FROM lot;
DELETE FROM price_ref;
DELETE FROM certification;
DELETE FROM logistics_corridor;
DELETE FROM logistics_provider;
DELETE FROM market_access;
DELETE FROM market;
DELETE FROM warehouse;
DELETE FROM corridor;
DELETE FROM spec_template;
DELETE FROM product;
DELETE FROM app_user;
DELETE FROM company;
DELETE FROM operator;

-- Eksport-operator -----------------------------------------------------
INSERT INTO operator (name, bank, license, type) VALUES
  ('Jizzax Eksport Operatori', 'Agrobank', 'EKS-2025-001', 'hokimlik');

-- Mahsulot katalogi (12) ----------------------------------------------
INSERT INTO product (name, hs_code, kind, storage_class, temp_min, temp_max, food_grade, hazmat, season, avg_price_usd_ton) VALUES
  ('Quritilgan meva (o''rik, mayiz)',      '0813100000', 'agri',       'ambient', NULL, NULL, 1, 0, 'Yil bo''yi', 2800),
  ('Yangi olma',                           '0808100000', 'agri',       'chilled', 0,    4,    1, 0, 'Kuz-qish',  700),
  ('Qovun / poliz',                        '0807190000', 'agri',       'chilled', 4,    10,   1, 0, 'Yoz',       450),
  ('Anor',                                 '0810901000', 'agri',       'ambient', NULL, NULL, 1, 0, 'Kuz',       900),
  ('Uzum (yangi)',                         '0806101000', 'agri',       'chilled', 0,    4,    1, 0, 'Yoz-kuz',   800),
  ('Paxta tolasi',                         '5201000000', 'agri',       'ambient', NULL, NULL, 0, 0, 'Kuz',       1900),
  ('Mis sim / kabel',                      '8544110000', 'industrial', 'ambient', NULL, NULL, 0, 0, NULL,        9500),
  ('Past kuchlanish kabeli',               '8544499101', 'industrial', 'ambient', NULL, NULL, 0, 0, NULL,        6500),
  ('Alumin kabel',                         '8544429009', 'industrial', 'ambient', NULL, NULL, 0, 0, NULL,        4200),
  ('Kuch transformatori (TMG)',            '8504210000', 'industrial', 'ambient', NULL, NULL, 0, 0, NULL,        7800),
  ('Taqsimlash qurilmasi (RP/yacheyka)',   '8537209200', 'industrial', 'ambient', NULL, NULL, 0, 0, NULL,        11000),
  ('Doripenem (antibiotik)',               '3004200002', 'industrial', 'gdp',     2,    8,    0, 0, NULL,        480000);

-- Spetsifikatsiya shabloni --------------------------------------------
INSERT INTO spec_template (product_id, schema)
SELECT id, '{"variety":["o''rik","mayiz"],"caliber":["jumbo","standart","mayda"],"color":["och","to''q"],"moisture_max_pct":18,"so2":["bor","yo''q"],"organic":[true,false],"packaging":["karton","vakuum"]}'
FROM product WHERE hs_code='0813100000';
INSERT INTO spec_template (product_id, schema)
SELECT id, '{"caliber_mm":[65,70,75],"color":["qizil","yashil"],"grade":["extra","class_1"],"packaging":["karton_tray"],"cold_chain":true}'
FROM product WHERE hs_code='0808100000';

-- Eksport koridorlari (6) ---------------------------------------------
INSERT INTO corridor (name, waypoints, entry_point, freight_per_feu_min, freight_per_feu_max, transit_days) VALUES
  ('O''rta yo''lak (Trans-Kaspiy)',          '[[43.65,51.16],[40.41,49.87],[41.72,44.79],[41.01,28.98]]', '[43.65,51.16]', 3500, 4500, 21),
  ('Shimoliy yo''lak (Rossiya)',             '[[50.28,57.17],[55.76,37.62]]',                              '[50.28,57.17]', 2800, 3200, 12),
  ('Qo''shni bozor (avto/temir yo''l)',       '[[43.22,76.85]]',                                            '[43.22,76.85]',  800, 1500,  4),
  ('Janubiy yo''lak (Eron porti)',           '[[37.95,58.38],[27.18,56.27],[25.20,55.27]]',                '[37.95,58.38]', 2500, 3500, 18),
  ('Sharqiy yo''lak (Xitoy)',                '[[44.21,80.41],[43.83,87.62]]',                              '[44.21,80.41]', 2500, 3500, 15),
  ('Sharqiy yo''lak (Xitoy porti orqali)',   '[[44.21,80.41],[34.60,119.22],[35.10,129.04]]',              '[44.21,80.41]', 3000, 4200, 26);

-- Maqsadli bozorlar (6) -----------------------------------------------
INSERT INTO market (country, corridor_id, tariff_pct, demand_notes) VALUES
  ('Rossiya',                (SELECT id FROM corridor WHERE name='Shimoliy yo''lak (Rossiya)'),           5, 'EAEU yaqin hamkor; bojxona deklaratsiyasi + EAC.'),
  ('Qozog''iston',           (SELECT id FROM corridor WHERE name='Qo''shni bozor (avto/temir yo''l)'),      0, 'EAEU yagona bojxona hududi — bojsiz.'),
  ('Yevropa Ittifoqi',       (SELECT id FROM corridor WHERE name='O''rta yo''lak (Trans-Kaspiy)'),          0, 'GSP+ doirasida ko''p tovarlar 0%; EORI + import deklaratsiyasi.'),
  ('BAA (Fors ko''rfazi)',   (SELECT id FROM corridor WHERE name='Janubiy yo''lak (Eron porti)'),          5, 'GCC yagona tarif 5%; G-mark talab qilinishi mumkin.'),
  ('Xitoy',                  (SELECT id FROM corridor WHERE name='Sharqiy yo''lak (Xitoy)'),               8, 'GACC ro''yxati + ba''zi tovarlar uchun CCC.'),
  ('Janubiy Koreya',         (SELECT id FROM corridor WHERE name='Sharqiy yo''lak (Xitoy porti orqali)'),  8, 'KC sertifikati; qishloq xo''jaligi uchun qattiq fitosanitar.');

-- Bozorga kirish (svetofor) — HS bo'limi × bozor ----------------------
-- CROSS JOIN LATERAL o'rniga: avval status (st) ni CTE'da hisoblaymiz,
-- keyin reason'ni st'ga tayangan CASE bilan aniqlaymiz.
WITH ch(hs_chapter, kind) AS (VALUES
    ('0813','dried'), ('08','fresh'), ('07','fresh'), ('06','fresh'),
    ('30','pharma'),  ('85','ind'),   ('52','ind')),
  mk(k, country) AS (VALUES
    ('russia','Rossiya'), ('kazakhstan','Qozog''iston'), ('eu','Yevropa Ittifoqi'),
    ('gulf','BAA (Fors ko''rfazi)'), ('china','Xitoy'), ('korea','Janubiy Koreya')),
  base AS (
    SELECT ch.hs_chapter AS hs_chapter, m.id AS market_id, ch.kind AS kind, mk.k AS k,
      CASE
        WHEN ch.kind='dried' THEN 'open'
        WHEN ch.kind='fresh'  AND mk.k='korea' THEN 'closed'
        WHEN ch.kind='fresh'  AND mk.k IN ('eu','china') THEN 'conditional'
        WHEN ch.kind='fresh'  THEN 'open'
        WHEN ch.kind='pharma' AND mk.k='eu' THEN 'closed'
        WHEN ch.kind='pharma' THEN 'conditional'
        ELSE 'open'
      END AS st
    FROM ch CROSS JOIN mk
    JOIN market m ON m.country = mk.country
  )
INSERT INTO market_access (hs_chapter, market_id, status, reason)
SELECT hs_chapter, market_id, st,
  CASE
    WHEN kind='dried' THEN 'Quritilgan meva — tez buzilmaydi; oziq-ovqat xavfsizligi sertifikati (aflatoksin/SO2) bilan ochiq.'
    WHEN kind='fresh'  AND st='closed' THEN 'Yangi qishloq xo''jaligi — fitosanitar protokol yo''q (masalan Koreyaga yangi olma taqiq).'
    WHEN kind='fresh'  AND st='conditional' THEN 'Tez buziladigan — qat''iy fitosanitar shartlar + sovuq zanjir.'
    WHEN kind='fresh'  THEN 'Past to''siq — fitosanitar sertifikat bilan kirish mumkin.'
    WHEN kind='pharma' AND st='closed' THEN 'Dori vositasi — EU uchun EMA/milliy ro''yxat + GMP; hozircha yopiq.'
    WHEN kind='pharma' THEN 'Dori vositasi — maqsadli davlatda ro''yxat va GMP shart; shartli.'
    ELSE 'Sanoat/xom-ashyo — fitosanitar to''siq yo''q; texnik standart (CE/EAC/KC) muvofiqligi.'
  END AS reason
FROM base;

-- Omborxonalar (7) — storage_classes JSON massiv sifatida -------------
INSERT INTO warehouse (name, lat, lng, region, storage_classes, temp_min, temp_max, food_grade, bonded, capacity_free_t, storage_rate_usd_ton_month, rating) VALUES
  ('Toshkent logistika markazi (bojxona omborli)', 41.290, 69.330, 'Toshkent shahri',   '["ambient","food_grade","chilled","bonded"]', 0, 6,    1, 1,  25000, 9, 4.6),
  ('Angren quruq port',                            41.016, 70.143, 'Toshkent viloyati', '["ambient","food_grade","bonded"]',          NULL, NULL, 1, 1,  18000, 7, 4.2),
  ('Samarqand agro-konsolidatsiya markazi',        39.654, 66.975, 'Samarqand',         '["ambient","food_grade","chilled"]',         0, 6,    1, 0, 12000, 8, 4.4),
  ('Andijon (Farg''ona vodiysi) markazi',          40.782, 72.344, 'Andijon',           '["ambient","food_grade","chilled"]',         0, 6,    1, 0, 10000, 8, 4.3),
  ('Navoiy erkin iqtisodiy zona (xalqaro logistika)', 40.116, 65.378, 'Navoiy',         '["ambient","food_grade","chilled","bonded"]', 0, 6,    1, 1,  30000, 6, 4.7),
  ('Termiz xalqaro savdo markazi',                 37.224, 67.278, 'Surxondaryo',       '["ambient","food_grade","bonded"]',          NULL, NULL, 1, 1,   9000, 7, 4.0),
  ('Urganch poliz-konsolidatsiya markazi',         41.550, 60.633, 'Xorazm',            '["ambient","food_grade","chilled"]',         0, 6,    1, 0,  8000, 8, 4.1);

-- Logistika provayderlari (5) — modes JSON massiv sifatida ------------
INSERT INTO logistics_provider (name, modes, cold_chain, rating) VALUES
  ('Uzbekistan Temir Yo''l Konteyner', '["rail"]',                  0, 4.4),
  ('Silk Road Multimodal',             '["rail","sea","multimodal"]', 0, 4.1),
  ('ColdChain Logistics UZ',           '["rail","road"]',           1, 4.6),
  ('Caspian Freight Lines',            '["sea"]',                   1, 4.0),
  ('Central Asia Express Cargo',       '["road"]',                  0, 4.3);

-- Provayder <-> koridor bog'lanishlari --------------------------------
WITH lc(pname, cname) AS (VALUES
  ('Uzbekistan Temir Yo''l Konteyner', 'Shimoliy yo''lak (Rossiya)'),
  ('Uzbekistan Temir Yo''l Konteyner', 'Qo''shni bozor (avto/temir yo''l)'),
  ('Uzbekistan Temir Yo''l Konteyner', 'Sharqiy yo''lak (Xitoy)'),
  ('Uzbekistan Temir Yo''l Konteyner', 'O''rta yo''lak (Trans-Kaspiy)'),
  ('Silk Road Multimodal',             'O''rta yo''lak (Trans-Kaspiy)'),
  ('Silk Road Multimodal',             'Janubiy yo''lak (Eron porti)'),
  ('Silk Road Multimodal',             'Sharqiy yo''lak (Xitoy porti orqali)'),
  ('ColdChain Logistics UZ',           'Shimoliy yo''lak (Rossiya)'),
  ('ColdChain Logistics UZ',           'Qo''shni bozor (avto/temir yo''l)'),
  ('ColdChain Logistics UZ',           'O''rta yo''lak (Trans-Kaspiy)'),
  ('Caspian Freight Lines',            'O''rta yo''lak (Trans-Kaspiy)'),
  ('Caspian Freight Lines',            'Janubiy yo''lak (Eron porti)'),
  ('Central Asia Express Cargo',       'Qo''shni bozor (avto/temir yo''l)'),
  ('Central Asia Express Cargo',       'Sharqiy yo''lak (Xitoy)'),
  ('Central Asia Express Cargo',       'Shimoliy yo''lak (Rossiya)'))
INSERT INTO logistics_corridor (provider_id, corridor_id)
SELECT p.id, c.id FROM lc
JOIN logistics_provider p ON p.name = lc.pname
JOIN corridor c ON c.name = lc.cname;

-- Sertifikatlar — bozor bo'yicha --------------------------------------
INSERT INTO certification (market_id, hs_chapter, cert_type, issuer, required, est_cost_usd, est_days) VALUES
  ((SELECT id FROM market WHERE country='Rossiya'),              NULL, 'EAC sertifikati (TR TS)',            NULL, 1, 1200, 20),
  ((SELECT id FROM market WHERE country='Rossiya'),              NULL, 'Kelib chiqish sertifikati (CT-1)',   NULL, 1,  150,  3),
  ((SELECT id FROM market WHERE country='Qozog''iston'),         NULL, 'EAC sertifikati (EAEU)',             NULL, 1, 1000, 18),
  ((SELECT id FROM market WHERE country='Qozog''iston'),         NULL, 'Kelib chiqish sertifikati',          NULL, 1,  150,  3),
  ((SELECT id FROM market WHERE country='Yevropa Ittifoqi'),     NULL, 'CE muvofiqlik (tegishli direktiva)', NULL, 1, 3000, 45),
  ((SELECT id FROM market WHERE country='Yevropa Ittifoqi'),     NULL, 'Kelib chiqish sertifikati (REX/EUR.1)', NULL, 1, 200, 5),
  ((SELECT id FROM market WHERE country='BAA (Fors ko''rfazi)'), NULL, 'G-mark (GCC)',                       NULL, 1, 2000, 30),
  ((SELECT id FROM market WHERE country='BAA (Fors ko''rfazi)'), NULL, 'Halal sertifikati',                  NULL, 1,  800, 14),
  ((SELECT id FROM market WHERE country='BAA (Fors ko''rfazi)'), NULL, 'Kelib chiqish sertifikati',          NULL, 1,  150,  3),
  ((SELECT id FROM market WHERE country='Xitoy'),                NULL, 'CCC sertifikati',                    NULL, 1, 2500, 40),
  ((SELECT id FROM market WHERE country='Xitoy'),                NULL, 'GACC ro''yxatdan o''tish',           NULL, 1,  600, 21),
  ((SELECT id FROM market WHERE country='Janubiy Koreya'),       NULL, 'KC sertifikati',                     NULL, 1, 2200, 35),
  ((SELECT id FROM market WHERE country='Janubiy Koreya'),       NULL, 'Kelib chiqish sertifikati',          NULL, 1,  150,  3);

-- Sertifikatlar — HS bo'limi bo'yicha (override) ----------------------
INSERT INTO certification (market_id, hs_chapter, cert_type, issuer, required, est_cost_usd, est_days) VALUES
  (NULL, '30', 'Dori vositasini ro''yxatdan o''tkazish (maqsadli davlat)', NULL, 1, 25000, 540),
  (NULL, '30', 'GMP sertifikati',               NULL, 1, 15000, 180),
  (NULL, '08', 'Fitosanitar sertifikat',        'O''simliklar karantini agentligi', 1, 120, 5),
  (NULL, '07', 'Fitosanitar sertifikat',        'O''simliklar karantini agentligi', 1, 120, 5),
  (NULL, '06', 'Fitosanitar sertifikat',        'O''simliklar karantini agentligi', 1, 120, 5),
  (NULL, '52', 'Sifat va zararsizlik sertifikati', NULL, 1, 300, 7);

-- Mayoq / floor narxlar (price_ref) -----------------------------------
-- quritilgan meva: nav (1/2/3) × asosiy bozorlar
WITH g(grade, factor) AS (VALUES (1, 1.00), (2, 0.85), (3, 0.70)),
  mk(country) AS (VALUES ('Rossiya'),('Yevropa Ittifoqi'),('BAA (Fors ko''rfazi)'),('Xitoy'),('Janubiy Koreya'))
INSERT INTO price_ref (product_id, grade, market_id, reference_usd, floor_usd)
SELECT p.id, g.grade, m.id,
       round(p.avg_price_usd_ton * g.factor, 2),
       round(p.avg_price_usd_ton * g.factor * 0.82, 2)
FROM product p CROSS JOIN g CROSS JOIN mk
JOIN market m ON m.country = mk.country
WHERE p.hs_code='0813100000';

-- bir nechta boshqa mahsulot (1-nav, bittadan bozor)
INSERT INTO price_ref (product_id, grade, market_id, reference_usd, floor_usd)
SELECT p.id, 1, m.id, p.avg_price_usd_ton, round(p.avg_price_usd_ton*0.85,2)
FROM product p JOIN market m ON m.country='BAA (Fors ko''rfazi)' WHERE p.hs_code='0810901000';
INSERT INTO price_ref (product_id, grade, market_id, reference_usd, floor_usd)
SELECT p.id, 1, m.id, p.avg_price_usd_ton, round(p.avg_price_usd_ton*0.85,2)
FROM product p JOIN market m ON m.country='Xitoy' WHERE p.hs_code='5201000000';
INSERT INTO price_ref (product_id, grade, market_id, reference_usd, floor_usd)
SELECT p.id, 1, m.id, p.avg_price_usd_ton, round(p.avg_price_usd_ton*0.88,2)
FROM product p JOIN market m ON m.country='Rossiya' WHERE p.hs_code='8544110000';

-- Bootstrap: super-admin ----------------------------------------------
INSERT INTO app_user (role, name, email) VALUES
  ('super_admin', 'Hokimlik administratori', 'admin@ipakyoli.uz');

-- =====================================================================
--  Seed tugadi (SQLite)
-- =====================================================================
