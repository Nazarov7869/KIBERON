#!/usr/bin/env python3
# =====================================================================
#  seed_demo.py — Ipak Yo'li uchun TO'LIQ DEMO ma'lumot
# ---------------------------------------------------------------------
#  Ishlayotgan backendga (API) ulanib, dasturning BARCHA bo'limlarini
#  bir-biriga mos, haqiqiy ma'lumot bilan to'ldiradi:
#    - korxonalar + barcha roldagi foydalanuvchilar
#    - lotlar (sifat nazorati bilan), RFQ'lar
#    - pool'lar (yig'ilayotgan va taqsimlangan)
#    - buyurtmalar: to'liq hayotiy sikl (draft -> confirmed -> in_transit
#      -> delivered) hamda bekor qilingan (refunded)
#    - elchixona leadlari
#    - API'siz jadvallar (sug'urta, hujjat, reyting, nizo) — to'g'ridan
#      to'g'ri SQLite bazaga (dvigatel mantig'i buzilmasligi uchun
#      pul/hisob ishlari API orqali bajariladi).
#
#  Ishlatish:
#    1) Backend ishga tushgan bo'lsin (start.sh / start.bat yoki uvicorn).
#    2) python backend/scripts/seed_demo.py
#
#  Muhit o'zgaruvchilari (ixtiyoriy):
#    API_BASE  — backend manzili (standart: http://127.0.0.1:<PORT>)
#    FORCE=1   — demo allaqachon mavjud bo'lsa ham davom etishga urinadi
# =====================================================================
import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error
from datetime import date, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent          # .../backend
DEMO_PW = "demo1234"
MARKER_EMAIL = "zarafshon@demo.uz"                          # demo mavjudligini aniqlash uchun


# ------------------------------------------------------------- .env yuklash
def load_env() -> dict:
    data = {}
    envp = BASE_DIR / ".env"
    if envp.exists():
        for line in envp.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            data[k.strip()] = v.strip()
    return data


ENV = load_env()
PORT = ENV.get("PORT", "4000")
API_BASE = (os.getenv("API_BASE") or f"http://127.0.0.1:{PORT}").rstrip("/")


# ------------------------------------------------------- DB yo'lini aniqlash
def resolve_db_path() -> Path:
    url = (os.getenv("DATABASE_URL") or ENV.get("DATABASE_URL") or "sqlite:///./ipak.db").strip()
    if url.startswith("sqlite:///"):
        rest = url[len("sqlite:///"):]
        if not rest:
            return BASE_DIR / "ipak.db"
        p = Path(rest)
        return p if p.is_absolute() else (BASE_DIR / p).resolve()
    if url.startswith("sqlite://"):
        rest = url[len("sqlite://"):]
        return (BASE_DIR / rest).resolve() if rest else BASE_DIR / "ipak.db"
    if url.startswith(("postgres://", "postgresql://")):
        return BASE_DIR / "ipak.db"
    p = Path(url)
    return p if p.is_absolute() else (BASE_DIR / p).resolve()


DB_PATH = resolve_db_path()


def db() -> sqlite3.Connection:
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    # rating CHECK uchun num_nonnulls kerak
    try:
        con.create_function("num_nonnulls", -1, lambda *a: sum(1 for x in a if x is not None))
    except Exception:
        pass
    return con


# viloyat -> koordinata (korxonalar uchun)
REGION_COORDS = {
    "Jizzax": (40.115, 67.842), "Sirdaryo": (40.494, 68.782), "Farg'ona": (40.386, 71.787),
    "Buxoro": (39.767, 64.421), "Samarqand": (39.654, 66.975), "Toshkent": (41.311, 69.240),
}
# demo foydalanuvchi (email) -> koordinata
USER_COORDS = {
    "zarafshon@demo.uz": (40.115, 67.842), "sirdaryo@demo.uz": (40.494, 68.782),
    "fargona@demo.uz": (40.386, 71.787), "buxoro@demo.uz": (39.767, 64.421),
    "samarqand@demo.uz": (39.654, 66.975), "toshkent@demo.uz": (41.311, 69.240),
    "dubai@demo.uz": (25.204, 55.270), "moscow@demo.uz": (55.751, 37.618),
    "almaty@demo.uz": (43.238, 76.889), "ombor@demo.uz": (41.290, 69.330),
    "logistika@demo.uz": (41.311, 69.240), "elchixona@demo.uz": (41.311, 69.280),
    "admin@ipakyoli.uz": (40.115, 67.842),
}


def set_demo_locations(con: sqlite3.Connection):
    """Demo korxona va foydalanuvchilarga real koordinatalar beradi (karta uchun)."""
    n_c = n_u = 0
    for region, (lat, lng) in REGION_COORDS.items():
        cur = con.execute(
            "UPDATE company SET lat=?, lng=?, address=COALESCE(address, ?) WHERE region=? AND lat IS NULL",
            (lat, lng, f"{region}, O'zbekiston", region),
        )
        n_c += cur.rowcount
    for email, (lat, lng) in USER_COORDS.items():
        cur = con.execute(
            "UPDATE app_user SET lat=?, lng=? WHERE email=? AND lat IS NULL", (lat, lng, email)
        )
        n_u += cur.rowcount
    con.commit()
    print(f"✓ lokatsiyalar biriktirildi (korxona: {n_c}, foydalanuvchi: {n_u})")


# ---------------------------------------------------------------- API yordamchi
def api(method: str, path: str, token: str | None = None, body=None):
    url = API_BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode() or "{}"
            return r.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode() or "{}"
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}
    except urllib.error.URLError as e:
        print(f"\nXATO: backendga ulanib bo'lmadi ({API_BASE}).")
        print(f"       Avval serverni ishga tushiring (start.sh / start.bat).\n       Tafsilot: {e}")
        sys.exit(1)


def must(status, resp, what):
    if status not in (200, 201):
        print(f"XATO [{what}] -> {status}: {json.dumps(resp, ensure_ascii=False)[:400]}")
        sys.exit(1)
    return resp


def dig(resp, *keys):
    """Javobdan id ni bir nechta ehtimoliy joydan oladi."""
    for k in keys:
        cur = resp
        ok = True
        for part in k.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                ok = False
                break
        if ok and cur:
            return cur
    return None


# =====================================================================
#  0) Oldindan tekshiruv
# =====================================================================
def preflight():
    st, health = api("GET", "/health")
    if st != 200:
        print(f"XATO: /health javob bermadi ({st}). Backend ishga tushganmi?")
        sys.exit(1)
    if not DB_PATH.exists():
        print(f"XATO: baza fayli topilmadi: {DB_PATH}\n       Avval init_db.py ni ishga tushiring.")
        sys.exit(1)
    con = db()
    exists = con.execute("SELECT 1 FROM app_user WHERE email = ?", (MARKER_EMAIL,)).fetchone()
    con.close()
    if exists and os.getenv("FORCE") != "1":
        print("Demo ma'lumot allaqachon qo'shilgan (belgi topildi).")
        print("Qayta qo'shish uchun bazani tozalang:")
        print(f"   1) '{DB_PATH.name}' faylini o'chiring")
        print("   2) python scripts/init_db.py")
        print("   3) python scripts/seed_demo.py")
        sys.exit(0)


# =====================================================================
#  Asosiy oqim
# =====================================================================
def main():
    print(f"→ API   : {API_BASE}")
    print(f"→ Baza  : {DB_PATH}")
    preflight()

    # -------- reference id'lar (bazadan; ular uchun API yo'q) -----------
    con = db()
    products = [dict(r) for r in con.execute("SELECT id FROM product ORDER BY name")]
    markets = [dict(r) for r in con.execute("SELECT id FROM market ORDER BY country")]
    warehouses = [dict(r) for r in con.execute("SELECT id FROM warehouse ORDER BY name")]
    providers = [dict(r) for r in con.execute("SELECT id FROM logistics_provider ORDER BY name")]
    corridors = [dict(r) for r in con.execute("SELECT id FROM corridor ORDER BY name")]
    con.close()
    if len(products) < 9 or not markets or not warehouses:
        print("XATO: katalog to'liq emas. Avval init_db.py bilan seed qiling.")
        sys.exit(1)

    P = [p["id"] for p in products]          # mahsulot id'lari
    M = [m["id"] for m in markets]
    WH = [w["id"] for w in warehouses]
    PROV = [p["id"] for p in providers]
    COR = [c["id"] for c in corridors]

    def wh(i):   return WH[i % len(WH)]
    def prov(i): return PROV[i % len(PROV)] if PROV else None
    def cor(i):  return COR[i % len(COR)] if COR else None
    def mkt(i):  return M[i % len(M)]

    today = date.today()
    d = lambda days: (today + timedelta(days=days)).isoformat()

    # -------- 1) Super-admin kirish ------------------------------------
    admin_email = ENV.get("ADMIN_EMAIL", "admin@ipakyoli.uz")
    admin_pw = ENV.get("ADMIN_PASSWORD", "admin12345")
    st, r = api("POST", "/api/auth/login", body={"email": admin_email, "password": admin_pw})
    must(st, r, "admin login")
    A = r["access_token"]
    admin_id = dig(r, "user.id", "id")
    print("✓ super-admin kirdi")

    # -------- 2) Xodimlar (embassy / logistics / warehouse) ------------
    staff_defs = [
        ("warehouse", "Ombor Nazoratchisi", "ombor@demo.uz"),
        ("logistics", "Logistika Koordinatori", "logistika@demo.uz"),
        ("embassy",   "Elchixona Vakili", "elchixona@demo.uz"),
    ]
    staff_tokens = {}
    for role, name, email in staff_defs:
        st, r = api("POST", "/api/admin/users", A,
                    {"role": role, "name": name, "email": email, "phone": "+998 90 000 00 00", "password": DEMO_PW})
        must(st, r, f"staff {role}")
        st2, r2 = api("POST", "/api/auth/login", body={"email": email, "password": DEMO_PW})
        must(st2, r2, f"staff login {role}")
        staff_tokens[role] = r2["access_token"]
    LG = staff_tokens["logistics"]
    EM = staff_tokens["embassy"]
    print("✓ xodimlar yaratildi (ombor, logistika, elchixona)")

    # -------- 3) Eksportyor korxonalar (6 ta) --------------------------
    exp_defs = [
        ("Zarafshon Agro MChJ",     "100000001", "mchj",  "producer",   "Jizzax",     MARKER_EMAIL),
        ("Sirdaryo Fruit MChJ",     "100000002", "mchj",  "aggregator", "Sirdaryo",   "sirdaryo@demo.uz"),
        ("Farg'ona Harvest YaTT",   "100000003", "yatt",  "producer",   "Farg'ona",   "fargona@demo.uz"),
        ("Buxoro Dried QK",         "100000004", "qk",    "both",       "Buxoro",     "buxoro@demo.uz"),
        ("Samarqand Orchards MChJ", "100000005", "mchj",  "producer",   "Samarqand",  "samarqand@demo.uz"),
        ("Toshkent Export AJ",      "100000006", "aj",    "aggregator", "Toshkent",   "toshkent@demo.uz"),
    ]
    exporters = []  # {token, user_id, company_id, name, email}
    for name, stir, lf, ctype, region, email in exp_defs:
        st, r = api("POST", "/api/auth/register", body={
            "role": "exporter", "name": name.split()[0] + " menejer", "email": email,
            "phone": "+998 91 111 22 33", "password": DEMO_PW,
            "company": {"name": name, "stir": stir, "legal_form": lf,
                        "company_type": ctype, "region": region},
        })
        must(st, r, f"register exporter {email}")
        exporters.append({
            "token": r["access_token"],
            "user_id": dig(r, "user.id"),
            "company_id": dig(r, "user.company_id"),
            "name": name, "email": email,
        })
    print(f"✓ {len(exporters)} eksportyor korxona ro'yxatdan o'tdi")

    # -------- 4) Importyorlar (3 ta) -----------------------------------
    imp_defs = [
        ("Dubai Fresh Import", "dubai@demo.uz"),
        ("Moscow Trade LLC",   "moscow@demo.uz"),
        ("Almaty Distributors", "almaty@demo.uz"),
    ]
    importers = []
    for name, email in imp_defs:
        st, r = api("POST", "/api/auth/register", body={
            "role": "importer", "name": name, "email": email,
            "phone": "+971 50 000 00 00", "password": DEMO_PW,
        })
        must(st, r, f"register importer {email}")
        importers.append({"token": r["access_token"], "user_id": dig(r, "user.id"),
                          "name": name, "email": email})
    print(f"✓ {len(importers)} importyor ro'yxatdan o'tdi")

    # -------- 5) Korxonalarni tasdiqlash (bittasi tasdiqlanmagan) ------
    st, comp = api("GET", "/api/companies", A)
    must(st, comp, "list companies")
    comp_rows = comp.get("companies", comp.get("rows", []))
    id_by_stir = {}
    for c in comp_rows:
        if c.get("stir"):
            id_by_stir[c["stir"]] = c["id"]
    verified = 0
    for name, stir, *_ in exp_defs[:-1]:      # oxirgisini (Toshkent) tasdiqlamaymiz
        cid = id_by_stir.get(stir)
        if cid:
            st, r = api("POST", f"/api/companies/{cid}/verify", A)
            if st in (200, 201):
                verified += 1
    print(f"✓ {verified} korxona tasdiqlandi (1 tasi 'tasdiqlanmagan' holatda qoldirildi)")

    E = exporters  # qisqartma

    def make_lot(exp, product, qty, price, grade, warehouse_i=None, brix=None, origin=None):
        spec = {"grade": {1: "A", 2: "B", 3: "C"}.get(grade, "A")}
        if brix is not None:
            spec["brix"] = brix
        body = {"product_id": product, "quantity_t": qty, "price_per_ton": price,
                "grade": grade, "spec": spec}
        if warehouse_i is not None:
            body["warehouse_id"] = wh(warehouse_i)
        if origin:
            body["origin"] = origin
        st, r = api("POST", "/api/lots", exp["token"], body)
        must(st, r, f"lot {exp['email']}")
        return dig(r, "lot.id")

    # -------- 6) Pool'lar uchun lotlar + hissa qo'shish ----------------
    # RFQ -> pool -> lotlar -> allocate strukturasi
    def make_rfq(imp, product, qty, market_i, grade=1, ceiling=None):
        body = {"product_id": product, "target_quantity_t": qty, "market_id": mkt(market_i),
                "incoterm": "fob", "grade": grade, "maq_t": 5, "tolerance_pct": 10,
                "deadline": d(45)}
        if ceiling:
            body["price_ceiling_usd"] = ceiling
        st, r = api("POST", "/api/rfqs", imp["token"], body)
        must(st, r, "rfq")
        return dig(r, "rfq.id")

    def make_pool(product, target, rfq_id=None, grade=1):
        body = {"product_id": product, "target_qty_t": target, "grade": grade,
                "spec": {"grade": {1: "A", 2: "B", 3: "C"}[grade]},
                "score_weights": {"quality": 0.4, "rating": 0.3, "price": 0.2, "distance": 0.1},
                "newcomer_quota_pct": 15}
        if rfq_id:
            body["rfq_id"] = rfq_id
        st, r = api("POST", "/api/pools", A, body)
        must(st, r, "pool")
        return dig(r, "pool.id")

    def enter(exp, pool_id, lot_id, qty):
        st, r = api("POST", f"/api/pools/{pool_id}/entries", exp["token"],
                    {"lot_id": lot_id, "quantity_t": qty})
        must(st, r, f"entry {exp['email']}")

    def allocate(pool_id):
        st, r = api("POST", f"/api/pools/{pool_id}/allocate", A)
        must(st, r, "allocate")
        return r

    # ---- Pool A (p0, target 100) -> RFQ imp0 -> ORDER (delivered) ----
    rfqA = make_rfq(importers[0], P[0], 100, 0, grade=1, ceiling=1000)
    poolA = make_pool(P[0], 100, rfqA, grade=1)
    lA1 = make_lot(E[0], P[0], 40, 920, 1, 0, brix=15.5, origin="Jizzax")
    lA2 = make_lot(E[1], P[0], 35, 890, 1, 1, brix=14.8, origin="Sirdaryo")
    lA3 = make_lot(E[2], P[0], 45, 950, 2, 2, brix=16.0, origin="Farg'ona")
    enter(E[0], poolA, lA1, 40)
    enter(E[1], poolA, lA2, 35)
    enter(E[2], poolA, lA3, 45)
    allocate(poolA)

    # ---- Pool B (p1, target 80) -> RFQ imp1 -> ORDER (in_transit) ----
    rfqB = make_rfq(importers[1], P[1], 80, 1, grade=1)
    poolB = make_pool(P[1], 80, rfqB, grade=1)
    lB1 = make_lot(E[1], P[1], 30, 780, 1, 3)
    lB2 = make_lot(E[3], P[1], 30, 810, 1, 4)
    lB3 = make_lot(E[4], P[1], 30, 760, 1, 0)
    enter(E[1], poolB, lB1, 30)
    enter(E[3], poolB, lB2, 30)
    enter(E[4], poolB, lB3, 30)
    allocate(poolB)

    # ---- Pool C (p2, target 60) -> RFQ imp2 -> ORDER (confirmed) -----
    rfqC = make_rfq(importers[2], P[2], 60, 2, grade=1)
    poolC = make_pool(P[2], 60, rfqC, grade=1)
    lC1 = make_lot(E[0], P[2], 35, 700, 1, 1)
    lC2 = make_lot(E[4], P[2], 35, 720, 2, 5)
    enter(E[0], poolC, lC1, 35)
    enter(E[4], poolC, lC2, 35)
    allocate(poolC)

    # ---- Pool F (p2, target 50) -> RFQ imp1 -> ORDER (cancelled) -----
    rfqF = make_rfq(importers[1], P[2], 50, 0, grade=1)
    poolF = make_pool(P[2], 50, rfqF, grade=1)
    lF1 = make_lot(E[0], P[2], 30, 710, 1)
    lF2 = make_lot(E[4], P[2], 30, 705, 1)
    enter(E[0], poolF, lF1, 30)
    enter(E[4], poolF, lF2, 30)
    allocate(poolF)

    # ---- Pool D (p0, target 120) — YIG'ILMOQDA (allocate YO'Q) -------
    poolD = make_pool(P[0], 120, None, grade=1)
    lD1 = make_lot(E[2], P[0], 50, 940, 1, 2)
    lD2 = make_lot(E[5], P[0], 40, 900, 2)      # E[5] tasdiqlanmagan korxona ham hissa qo'shadi
    enter(E[2], poolD, lD1, 50)
    enter(E[5], poolD, lD2, 40)

    # ---- Pool E (p1, standalone) — YIG'ILMOQDA ----------------------
    poolE = make_pool(P[1], 70, None, grade=1)
    lE1 = make_lot(E[3], P[1], 25, 800, 1)
    enter(E[3], poolE, lE1, 25)

    print("✓ 6 pool yaratildi (4 taqsimlangan, 2 yig'ilmoqda)")

    # -------- 7) Mustaqil lotlar (turli mahsulot; sifat nazorati) -----
    var_lots = [
        (E[1], P[3], 20, 600, 1, "passed"),
        (E[2], P[4], 18, 1500, 1, "passed"),
        (E[3], P[5], 22, 450, 2, "passed"),
        (E[4], P[6], 15, 2000, 1, "passed"),
        (E[0], P[7], 12, 1800, 1, None),
        (E[5], P[8], 25, 500, 3, "rejected"),
    ]
    q_passed = q_rejected = 0
    for exp, prod, qty, price, grade, quality in var_lots:
        lid = make_lot(exp, prod, qty, price, grade, warehouse_i=1)
        if quality == "passed":
            st, r = api("PATCH", f"/api/lots/{lid}/quality", staff_tokens["warehouse"],
                        {"status": "passed",
                         "lab_result": {"brix": 15, "defects_pct": 1.2, "grade": "A"},
                         "note": "Namuna me'yorda"})
            must(st, r, "quality passed")
            q_passed += 1
        elif quality == "rejected":
            st, r = api("PATCH", f"/api/lots/{lid}/quality", staff_tokens["warehouse"],
                        {"status": "rejected",
                         "lab_result": {"brix": 9, "defects_pct": 7.5, "grade": "C"},
                         "note": "Nuqson foizi yuqori"})
            must(st, r, "quality rejected")
            q_rejected += 1
    print(f"✓ mustaqil lotlar + sifat nazorati (passed={q_passed}, rejected={q_rejected})")

    # -------- 8) Buyurtmalar (hayotiy sikl) ---------------------------
    def make_order(pool_id):
        st, r = api("POST", "/api/orders", A,
                    {"pool_id": pool_id, "transport_mode": "rail",
                     "container_type": "c40hc", "advance_pct": 30, "commission_pct": 1.5})
        must(st, r, "order create")
        return dig(r, "order.id")

    def confirm(oid):
        st, r = api("POST", f"/api/orders/{oid}/confirm", A); must(st, r, "confirm")

    def ship(oid, i):
        st, r = api("POST", f"/api/orders/{oid}/ship", LG,
                    {"warehouse_id": wh(i), "corridor_id": cor(i), "provider_id": prov(i),
                     "container_type": "c40hc", "departure_date": d(2)})
        must(st, r, "ship")

    def deliver(oid):
        st, r = api("POST", f"/api/orders/{oid}/deliver", LG); must(st, r, "deliver")

    def cancel(oid):
        st, r = api("POST", f"/api/orders/{oid}/cancel", A); must(st, r, "cancel")

    orderA = make_order(poolA); confirm(orderA); ship(orderA, 0); deliver(orderA)     # delivered
    orderB = make_order(poolB); confirm(orderB); ship(orderB, 1)                       # in_transit
    orderC = make_order(poolC); confirm(orderC)                                        # confirmed
    orderF = make_order(poolF); confirm(orderF); cancel(orderF)                        # cancelled
    print("✓ buyurtmalar: A=yetkazildi, B=yo'lda, C=tasdiqlangan, F=bekor(qaytarildi)")

    # -------- 9) Elchixona leadlari -----------------------------------
    leads = [
        {"importer_contact": "Al Nahda Trading (Dubai)", "market_id": mkt(0),
         "product_id": P[0], "notes": "BAAda anorga barqaror talab, oyiga 2 konteyner"},
        {"importer_contact": "EuroFruit GmbH (Berlin)", "market_id": mkt(1),
         "product_id": P[1], "notes": "Yevropa uchun sertifikat (GlobalGAP) talab qilinadi"},
        {"importer_contact": "Astana Foods (Qozog'iston)", "market_id": mkt(2),
         "product_id": P[2], "notes": "Temir yo'l bilan tez yetkazish afzal"},
        {"importer_contact": "Istanbul Import Co", "notes": "Quruq meva bo'yicha so'rov, narx ochiq"},
    ]
    for L in leads:
        st, r = api("POST", "/api/leads", EM, L)
        must(st, r, "lead")
    print(f"✓ {len(leads)} elchixona leadi qo'shildi")

    # =================================================================
    #  10) API'siz jadvallar — to'g'ridan-to'g'ri bazaga
    #      (sug'urta, hujjat, reyting, nizo)
    # =================================================================
    con = db()
    cur = con.cursor()

    def order_total(oid):
        row = con.execute("SELECT total_value_usd FROM export_order WHERE id = ?", (oid,)).fetchone()
        return float(row[0]) if row and row[0] is not None else 0.0

    # --- Sug'urta (insurance) ---
    tA = order_total(orderA)
    tB = order_total(orderB)
    insurances = [
        (orderA, "cargo",  "Uzbekinvest", round(tA * 1.10, 2), "CARGO-A-0001"),
        (orderA, "credit", "Uzbekinvest", round(tA * 0.90, 2), "CREDIT-A-0001"),
        (orderB, "cargo",  "Kafolat", round(tB * 1.10, 2), "CARGO-B-0001"),
    ]
    cur.executemany(
        "INSERT INTO insurance (order_id, type, provider, amount_usd, policy_no) VALUES (?,?,?,?,?)",
        insurances)

    # --- Hujjatlar (document) ---
    documents = [
        (orderA, "origin_cert",  "docs/A/origin_cert.pdf"),
        (orderA, "invoice",      "docs/A/invoice.pdf"),
        (orderA, "packing_list", "docs/A/packing_list.pdf"),
        (orderA, "phyto",        "docs/A/phyto.pdf"),
        (orderA, "contract",     "docs/A/contract.pdf"),
        (orderB, "invoice",      "docs/B/invoice.pdf"),
        (orderB, "packing_list", "docs/B/packing_list.pdf"),
        (orderC, "contract",     "docs/C/contract.pdf"),
        (orderC, "invoice",      "docs/C/invoice.pdf"),
    ]
    cur.executemany(
        "INSERT INTO document (order_id, type, file_ref) VALUES (?,?,?)", documents)

    # --- Reytinglar (rating) — yetkazilgan A buyurtma bo'yicha ---
    # importyor (imp0) uchta hissador korxonani baholaydi
    contribA = [(E[0]["company_id"], 5, "A'lo sifat, o'z vaqtida"),
                (E[1]["company_id"], 4, "Yaxshi, kichik kechikish"),
                (E[2]["company_id"], 5, "Ishonchli hamkor")]
    rater_imp = importers[0]["user_id"]
    for cid, score, comment in contribA:
        cur.execute(
            """INSERT INTO rating (ratee_company_id, ratee_user_id, rater_user_id, role, score, comment, order_id)
               VALUES (?, NULL, ?, 'exporter', ?, ?, ?)""",
            (cid, rater_imp, score, comment, orderA))
    # eksportyor importyorni baholaydi (ratee_user_id)
    cur.execute(
        """INSERT INTO rating (ratee_company_id, ratee_user_id, rater_user_id, role, score, comment, order_id)
           VALUES (NULL, ?, ?, 'importer', 5, ?, ?)""",
        (importers[0]["user_id"], E[0]["user_id"], "To'lov o'z vaqtida, aniq talablar", orderA))

    # --- Nizolar (dispute) ---
    # B buyurtma — ochiq nizo (importyor kechikishdan shikoyat)
    cur.execute(
        """INSERT INTO dispute (order_id, raised_by, reason, status)
           VALUES (?, ?, ?, 'open')""",
        (orderB, importers[1]["user_id"], "Yetkazish muddati rejadan kechikmoqda"))
    # A buyurtma — hal qilingan nizo (arbitr — super-admin)
    cur.execute(
        """INSERT INTO dispute (order_id, raised_by, reason, arbiter_id, resolution, status)
           VALUES (?, ?, ?, ?, ?, 'resolved')""",
        (orderA, importers[0]["user_id"], "Bir partiyada sifat bo'yicha e'tiroz",
         admin_id, "Qisman kompensatsiya (2%) kelishildi, tomonlar rozi"))

    con.commit()
    con.close()
    print("✓ sug'urta, hujjatlar, reytinglar, nizolar qo'shildi")

    # =================================================================
    #  Yakuniy hisobot
    # =================================================================
    con = db()
    tables = ["company", "app_user", "lot", "rfq", "pool", "pool_entry",
              "export_order", "escrow", "shipment", "payout", "insurance",
              "document", "rating", "dispute", "embassy_lead"]
    set_demo_locations(con)

    print("\n================= DEMO MA'LUMOT QO'SHILDI =================")
    print("Jadval bo'yicha yozuvlar soni:")
    for t in tables:
        try:
            n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            print(f"   {t:16} {n}")
        except Exception as e:
            print(f"   {t:16} ERR {e}")
    # buyurtma holatlari
    rows = con.execute("SELECT status, COUNT(*) c FROM export_order GROUP BY status").fetchall()
    print("Buyurtma holatlari:", {r[0]: r[1] for r in rows})
    rows = con.execute("SELECT status, COUNT(*) c FROM pool GROUP BY status").fetchall()
    print("Pool holatlari:    ", {r[0]: r[1] for r in rows})
    con.close()

    print("\nDemo login (barcha parol: demo1234):")
    print(f"   super-admin : {admin_email} / {admin_pw}")
    print("   ombor       : ombor@demo.uz")
    print("   logistika   : logistika@demo.uz")
    print("   elchixona   : elchixona@demo.uz")
    print("   eksportyor  : zarafshon@demo.uz  (yoki sirdaryo/fargona/buxoro/samarqand@demo.uz)")
    print("   importyor   : dubai@demo.uz  (yoki moscow/almaty@demo.uz)")
    print("==========================================================")


if __name__ == "__main__":
    main()
