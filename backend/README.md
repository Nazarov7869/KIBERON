# Ipak Yo'li — Eksport CRM (backend, FastAPI)

Qadama-qadam quriladigan backend. Baza qatlami SQL (SQLite — tashqi server kerak emas), ilova qatlami
**Python / FastAPI**.

## Bosqich holati

- [x] **1-qadam — Baza sxemasi** (`db/schema_sqlite.sql`): 24 entity + join jadval,
      ENUM'lar TEXT+CHECK ko'rinishida, FK va indekslar. SQLite 3.45'da tasdiqlangan.
- [x] **2-qadam — Boshlang'ich ma'lumot** (`db/seed_sqlite.sql`): 12 mahsulot, 6 koridor,
      6 bozor, 42 svetofor qoidasi, 7 ombor, 5 logistika, 19 sertifikat, 18 narx.
- [x] **3-qadam — DB ulanish + server** (FastAPI): `app/db.py` (aiosqlite, psycopg-mos qatlam),
      `app/main.py`, health + katalog marshruti. Serverda sinovdan o'tgan.
- [x] **4-qadam — Auth** (`app/security.py`, `app/routers/auth.py`): ro'yxat
      (eksportyor = korxona+user bitta tranzaksiyada; importyor = user),
      kirish, parol bcrypt, JWT token, rol asosida himoya. Serverda sinovdan o'tgan.
- [x] **5-qadam — Entity API'lar + ruxsat matritsasi** (`app/permissions.py`,
      `routers/lots.py`, `routers/rfqs.py`, `routers/companies.py`): Lot (taklif),
      RFQ (talab) to'liq CRUD; korxona tasdiqlash; rol + qator-egaligi himoyasi.
- [x] **6-qadam — Yig'ish dvigateli** (`app/pooling.py`, `routers/pools.py`):
      pool ochish, lot qo'shish, ballga ko'ra taqsimot + yangi keluvchi kvotasi +
      clearing narx. Sof deterministik (AI yo'q). Sinovdan o'tgan.
- [x] **7-qadam — Buyurtma -> escrow -> jo'natma -> payout** (`app/settlement.py`,
      `routers/orders.py`): matched pooldan buyurtma, escrow (held), avans/balans/
      komissiya taqsimoti, refund. Sof deterministik. Sinovdan o'tgan.
- [x] **8-qadam — AI qatlami** (`app/llm.py`, `app/advisor.py`, `routers/ai.py`):
      ko'p provayderli LLM (anthropic/openai/google/custom), platformaning haqiqiy
      ma'lumotiga asoslangan maslahatchi (grounding) + preview rejim. Sinovdan o'tgan.

## Ishga tushirish

```bash
# 1) Python paketlari
pip install -r requirements.txt

# 2) .env (.env.example dan nusxa) — SQLite, sozlash shart emas
#    DATABASE_URL=sqlite:///./ipak.db

# 3) Baza + katalog (idempotent: sxema + seed + admin paroli)
python scripts/init_db.py

# 4) Server
uvicorn app.main:app --reload --host 0.0.0.0 --port 5555

# 5) (ixtiyoriy) Barcha bo'limlarga to'liq DEMO ma'lumot — server ochiq turganda:
python scripts/seed_demo.py
```

Avtomatik API hujjat (Swagger UI): **http://localhost:5555/docs**  (server `0.0.0.0:5555` da tinglaydi)

### Endpoint'lar
| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/health` | Server tirikmi (liveness) |
| GET | `/health/db` | Baza javob beradimi + seed sanog'i (readiness) |
| GET | `/api/catalog/products` | Mahsulot katalogi |
| GET | `/api/catalog/markets` | Bozorlar (koridor bilan) |
| GET | `/api/catalog/access?hs=0813100000&market=Yevropa` | Svetofor (HS 4->2 fallback) |
| GET | `/api/catalog/summary` | Katalog xulosasi |
| POST | `/api/auth/register` | Ro'yxat (eksportyor=korxona+user, importyor=user) |
| POST | `/api/auth/login` | Kirish — email+parol → JWT |
| GET | `/api/auth/me` | Joriy foydalanuvchi (token kerak) |
| GET | `/api/auth/admin/ping` | Rol himoyasi namunasi (faqat super_admin) |
| GET/POST | `/api/lots` · `/api/lots/mine` · `/api/lots/{id}` | Lot (taklif) CRUD |
| GET/POST | `/api/rfqs` · `/api/rfqs/mine` · `/api/rfqs/{id}` | RFQ (talab) CRUD |
| GET | `/api/companies` | Korxonalar ro'yxati (admin) |
| GET | `/api/companies/me` | O'z korxonasi (eksportyor) |
| POST | `/api/companies/{id}/verify` | Korxonani tasdiqlash (admin) |
| GET/POST | `/api/pools` · `/api/pools/{id}` | Pool (yig'ish) ko'rish/ochish |
| POST/DELETE | `/api/pools/{id}/entries[/{eid}]` | Lotni poolga qo'shish / olib tashlash (exporter) |
| POST/GET | `/api/lots` · `/api/lots/{id}` | Lot yaratish/ko'rish (filtrlar: product_id, status, region, quality_status) |
| PATCH | `/api/lots/{id}/quality` | Sifat nazorati — passed/rejected (ombor/super_admin); ballga ta'sir qiladi |
| POST | `/api/pools/{id}/allocate` | Taqsimot dvigateli (admin yoki pool egasi) |
| POST/GET | `/api/orders` · `/api/orders/{id}` | Buyurtma yaratish/ko'rish |
| POST | `/api/orders/{id}/confirm` | Tasdiqlash — escrowga pul (importyor) |
| POST | `/api/orders/{id}/ship` | Jo'natish — avans chiqadi (logistika) |
| POST | `/api/orders/{id}/deliver` | Yetkazish — balans+komissiya (logistika) |
| POST | `/api/orders/{id}/cancel` | Bekor qilish — refund (importyor) |
| GET | `/api/ai/status` | AI provayderi sozlanganmi |
| POST | `/api/ai/advisor` | Eksport maslahatchisi (grounding; `preview:true` — LLMsiz) |
| POST | `/api/admin/users` | Xodim yaratish: elchixona/logistika/ombor (super_admin) |
| GET/POST | `/api/leads` · `/api/leads/{id}` | Tashqi xaridor (lead) — elchixona kiritadi, eksportyor ko'radi |

### AI qatlami (`app/llm.py`, `app/advisor.py`) — grounding
- **Ko'p provayderli**: `.env`'dagi kalitga qarab `anthropic` / `openai` / `google` /
  `custom` (OpenAI-mos) tanlanadi. `AI_MODEL` bilan model sozlanadi.
- **Maslahatchi grounding**: AI platformaning HAQIQIY ma'lumotiga asoslanadi —
  svetofor (bozorga kirish), katalog, foydalanuvchining lot/RFQ/buyurtmalari +
  statik platforma qoidalari. Raqam o'ylab topilmaydi.
- **Preview rejim**: `preview:true` — LLM chaqirilmasdan yig'ilgan kontekst qaytadi
  (shaffoflik + sinov uchun).
- AI taqsimot/narx/escrow qarorini QABUL QILMAYDI — bu dvigatel ishi.

### Pul oqimi (`app/settlement.py`) — sof deterministik
`matched pool → order(draft) → confirm → ship → deliver`
- **confirm**: importyor `total_value`ni escrowga qo'yadi (`held`)
- **ship**: avans (`net × advance_pct%`, standart 30%) eksportyorlarga chiqadi (`advance_released`)
- **deliver**: balans (qolgan) + operator komissiyasi (`gross × commission_pct%`, standart 1%) → escrow `closed`
- Har hissador: `gross = ulush × narx` → `komissiya` → `net` → `avans + balans`
- **cancel** (avansgacha): escrow `refunded` — pul importyorga qaytadi

AI bu yerda ISHLATILMAYDI (escrow, payout, narx — faqat deterministik).

### Yig'ish dvigateli (`app/pooling.py`) — sof deterministik
Konteyner sig'imi (`target_qty_t`) ishtirokchilar o'rtasida **ballga ko'ra** taqsimlanadi:
1. **Ball (score)** — har lot uchun: `sifat·0.4 + reyting·0.3 + narx·0.2 + masofa·0.1`
   (vaznlar `pool.score_weights`'da sozlanadi; har omil 0..1 normallashtirilgan).
2. **Yangi keluvchi kvotasi** — `newcomer_quota_pct`% (standart 15%) target reyting=0
   korxonalarga ajratiladi → bozorga kirish kafolati.
3. **Umumiy to'ldirish** — qolgan sig'im ballga ko'ra.
4. **Clearing narx** — taqsimlangan hajmlarning qty-vaznli o'rtacha narxi.

AI bu yerda ISHLATILMAYDI (taqsimot, narx, kvota — faqat deterministik mantiq).

### Ruxsat matritsasi (`app/permissions.py`)
| Entity.amal | Ruxsat etilgan rollar | Qator-egaligi |
|---|---|---|
| lot.create | exporter | — |
| lot.read | barcha rollar | — |
| lot.update / delete | exporter, super_admin | exporter faqat o'z lotini |
| rfq.create | importer | — |
| rfq.read | barcha rollar | — |
| rfq.update / delete | importer, super_admin | importer faqat o'z RFQ'sini |
| company.list / verify | super_admin | — |
| company.read_own | exporter | o'z korxonasi |
| lead.create / update / delete | super_admin, embassy | embassy faqat o'z leadini |
| lead.read | super_admin, embassy, exporter | embassy faqat o'zinikini |

> Xodim foydalanuvchilar (elchixona/logistika/ombor) o'zi ro'yxatdan o'tolmaydi —
> ularni super_admin `POST /api/admin/users` orqali yaratadi.

> Seed'dagi super-admin parolsiz. Faollashtirish:
> `python scripts/set_password.py admin@ipakyoli.uz <parol>`

## Struktura

```
ipak-crm/
  db/
    schema_sqlite.sql # 1-qadam — sxema (DDL, SQLite)
    seed_sqlite.sql   # 2-qadam — katalog ma'lumoti (SQLite)
  app/
    main.py           # FastAPI ilova + health
    db.py             # aiosqlite (psycopg-mos qatlam) + so'rov yordamchilari
    config.py         # ENV sozlamalari (DB, JWT)
    security.py       # parol (bcrypt), JWT, rol himoyasi
    permissions.py    # ruxsat matritsasi (entity x amal -> rollar)
    pooling.py        # yig'ish dvigateli (ball, taqsimot, clearing narx)
    settlement.py     # pul hisobi (gross/komissiya/avans/balans)
    llm.py            # ko'p provayderli LLM mijoz
    advisor.py        # eksport maslahatchisi (grounding)
    schemas.py        # Pydantic so'rov/javob modellari
    routers/
      catalog.py      # katalog (o'qish) endpoint'lari
      auth.py         # ro'yxat, kirish, /me
      lots.py         # lot (taklif) CRUD
      rfqs.py         # rfq (talab) CRUD
      companies.py    # korxona ko'rish/tasdiqlash
      pools.py        # pool: ochish, qo'shish, taqsimot
      orders.py       # buyurtma: escrow, jo'natma, payout
      ai.py           # AI maslahatchi
      admin.py        # super_admin: xodim (elchixona/logistika/ombor) yaratish
      leads.py        # elchixona: tashqi xaridor (lead) kiritish
  scripts/
    init_db.py        # baza bootstrap (sxema + seed + admin)
    seed_demo.py      # barcha bo'limlarga to'liq demo ma'lumot (API orqali)
    set_password.py   # foydalanuvchi parolini o'rnatish (admin faollashtirish)
  requirements.txt
  .env.example
```

### Sxema xaritasi (`db/schema_sqlite.sql`)

| Klaster | Jadvallar |
|---|---|
| Identity & katalog | operator, company, app_user, product, spec_template, corridor, market, market_access, warehouse, logistics_provider, logistics_corridor, certification, price_ref |
| Ta'minot | lot |
| Talab | rfq, embassy_lead |
| Yig'ish | pool, pool_entry |
| Bajarish | export_order, shipment, escrow, payout, insurance, document |
| Ishonch | rating, dispute |

**Asosiy zanjir:** `rfq + lot → pool → pool_entry → export_order → shipment/escrow/payout`
