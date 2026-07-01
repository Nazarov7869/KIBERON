#!/usr/bin/env python3
# =====================================================================
#  Baza bootstrap (SQLite) — start.sh / start.bat chaqiradi.
#  1) SQLite fayl bazasini ochadi/yaratadi (DATABASE_URL yoki backend/ipak.db)
#  2) schema_sqlite.sql ni yuklaydi (agar jadvallar yo'q bo'lsa)
#  3) seed_sqlite.sql ni yuklaydi (agar bo'sh bo'lsa)
#  4) super-admin parolini o'rnatadi (agar hali o'rnatilmagan bo'lsa)
#  Idempotent: qayta ishga tushirsa mavjudini buzmaydi. Tashqi DB kerak emas.
# =====================================================================
import os
import sys
import sqlite3
from pathlib import Path

import bcrypt
from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent.parent          # .../backend
load_dotenv(BASE / ".env")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@ipakyoli.uz")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin12345")


def resolve_db_path() -> Path:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url:
        return BASE / "ipak.db"
    if url.startswith("sqlite:///"):
        rest = url[len("sqlite:///"):]
        if not rest:
            return BASE / "ipak.db"
        p = Path(rest)
        return p if p.is_absolute() else (BASE / p)
    if url.startswith("sqlite://"):
        rest = url[len("sqlite://"):]
        return (BASE / rest) if rest else (BASE / "ipak.db")
    if url.startswith(("postgres://", "postgresql://")):
        print("[eslatma] DATABASE_URL PostgreSQL manzili — endi SQLite ishlatiladi; backend/ipak.db")
        return BASE / "ipak.db"
    p = Path(url)
    return p if p.is_absolute() else (BASE / p)


DB_PATH = resolve_db_path()
schema_sql = (BASE / "db" / "schema_sqlite.sql").read_text(encoding="utf-8")
seed_sql = (BASE / "db" / "seed_sqlite.sql").read_text(encoding="utf-8")


def _cols(cur, table):
    cur.execute(f"PRAGMA table_info({table})")
    return {r[1] for r in cur.fetchall()}


def _add_col(cur, table, col, decl):
    if col not in _cols(cur, table):
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")


def migrate_locations(conn, cur):
    """Karta uchun lokatsiya ustunlarini qo'shadi (mavjud bazalarda ham) va
    infratuzilma (ombor / logistika / bozor) koordinatalarini to'ldiradi.
    Idempotent: ustun/qiymat bo'lsa qayta tegmaydi."""
    import json

    # 1) ustunlar (har qanday baza uchun)
    for t, c, d in [
        ("app_user", "lat", "NUMERIC"), ("app_user", "lng", "NUMERIC"), ("app_user", "address", "TEXT"),
        ("company", "lat", "NUMERIC"), ("company", "lng", "NUMERIC"), ("company", "address", "TEXT"),
        ("warehouse", "code", "TEXT"), ("warehouse", "address", "TEXT"),
        ("logistics_provider", "code", "TEXT"), ("logistics_provider", "lat", "NUMERIC"),
        ("logistics_provider", "lng", "NUMERIC"), ("logistics_provider", "hub_city", "TEXT"),
        ("market", "lat", "NUMERIC"), ("market", "lng", "NUMERIC"), ("market", "city", "TEXT"),
    ]:
        _add_col(cur, t, c, d)
    conn.commit()

    # 2) ombor kodlari (WH-01..)
    cur.execute("SELECT id FROM warehouse WHERE code IS NULL ORDER BY rowid")
    for i, (wid,) in enumerate(cur.fetchall(), 1):
        cur.execute("UPDATE warehouse SET code = ? WHERE id = ?", (f"WH-{i:02d}", wid))

    # 3) logistika firmalari — kod + hub koordinatasi
    hubs = [
        ("LOG-01", 41.311, 69.240, "Toshkent"), ("LOG-02", 41.290, 69.330, "Toshkent"),
        ("LOG-03", 39.654, 66.975, "Samarqand"), ("LOG-04", 40.116, 65.378, "Navoiy"),
        ("LOG-05", 41.550, 60.633, "Urganch"), ("LOG-06", 40.115, 67.842, "Jizzax"),
    ]
    cur.execute("SELECT id FROM logistics_provider WHERE code IS NULL ORDER BY rowid")
    for i, (lid,) in enumerate(cur.fetchall()):
        code, lat, lng, city = hubs[i % len(hubs)]
        cur.execute("UPDATE logistics_provider SET code=?, lat=?, lng=?, hub_city=? WHERE id=?",
                    (code, lat, lng, city, lid))

    # 4) bozor koordinatasi — koridorning oxirgi nuqtasi (manzil shahri)
    cur.execute("SELECT id, country, corridor_id FROM market WHERE lat IS NULL")
    for mid, country, cid in cur.fetchall():
        lat = lng = None
        if cid:
            cur.execute("SELECT waypoints FROM corridor WHERE id = ?", (cid,))
            row = cur.fetchone()
            if row and row[0]:
                try:
                    wp = json.loads(row[0])
                    if wp:
                        lat, lng = float(wp[-1][0]), float(wp[-1][1])
                except Exception:
                    pass
        cur.execute("UPDATE market SET lat=?, lng=?, city=? WHERE id=?", (lat, lng, country, mid))

    conn.commit()
    cur.execute("SELECT count(*) FROM warehouse WHERE code IS NOT NULL")
    wc = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM market WHERE lat IS NOT NULL")
    mc = cur.fetchone()[0]
    print(f"[karta] lokatsiya ustunlari tayyor · omborlar={wc} kodlangan, bozorlar={mc} koordinatali")


def _has_table(cur, name: str) -> bool:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


def seed_price_history(conn, cur, days: int = 180):
    """Har mahsulot uchun kunlik OHLC sham + hajm (demo) generatsiya qiladi.
    avg_price_usd_ton ga bog'langan tasodifiy sayr. Idempotent: bo'sh bo'lsagina.
    Real ma'lumot (UZEX/stat.uz CSV) import qilinsa, bu 'demo' qatorlar o'rnini
    bosishi mumkin (source bo'yicha ajratilgan).
    """
    import random
    from datetime import date, timedelta

    if not _has_table(cur, "price_history"):
        # eski bazada jadval yo'q bo'lsa — yaratamiz
        conn.executescript(
            """CREATE TABLE IF NOT EXISTS price_history (
                 id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-'||substr('89ab',1+(abs(random())%4),1)||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6)))),
                 product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
                 ts TEXT NOT NULL, open NUMERIC NOT NULL, high NUMERIC NOT NULL,
                 low NUMERIC NOT NULL, close NUMERIC NOT NULL, volume NUMERIC NOT NULL DEFAULT 0,
                 source TEXT NOT NULL DEFAULT 'demo', created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP));
               CREATE INDEX IF NOT EXISTS idx_price_history_prod_ts ON price_history(product_id, ts);
               CREATE UNIQUE INDEX IF NOT EXISTS uq_price_history_prod_ts_src ON price_history(product_id, ts, source);"""
        )

    cur.execute("SELECT count(*) FROM price_history")
    if cur.fetchone()[0] > 0:
        print("[bozor] narx tarixi mavjud — o'tkazib yuborildi")
        return

    cur.execute("SELECT id, name, avg_price_usd_ton FROM product ORDER BY name")
    products = cur.fetchall()
    if not products:
        return

    rnd = random.Random(20260101)          # takrorlanuvchi
    start = date.today() - timedelta(days=days - 1)
    rows = []
    for pid, name, avg in products:
        base = float(avg) if avg else 800.0
        price = base * rnd.uniform(0.9, 1.1)
        drift = rnd.uniform(-0.0006, 0.0012)   # mahsulotga xos yengil trend
        vol = rnd.uniform(0.012, 0.030)        # kunlik volatillik
        for i in range(days):
            d = start + timedelta(days=i)
            o = price
            ret = rnd.gauss(drift, vol)
            c = max(base * 0.5, o * (1 + ret))
            hi = max(o, c) * (1 + abs(rnd.gauss(0, vol / 2)))
            lo = min(o, c) * (1 - abs(rnd.gauss(0, vol / 2)))
            volume = round(rnd.uniform(40, 400) * (base / 800.0), 1)   # tonna
            rows.append((pid, d.isoformat(), round(o, 2), round(hi, 2),
                         round(lo, 2), round(c, 2), volume, "demo"))
            price = c
    cur.executemany(
        "INSERT OR IGNORE INTO price_history (product_id, ts, open, high, low, close, volume, source) "
        "VALUES (?,?,?,?,?,?,?,?)",
        rows,
    )
    conn.commit()
    print(f"[bozor] narx tarixi yuklandi ({len(products)} mahsulot × {days} kun = {len(rows)} sham)")


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"[baza] SQLite fayli: {DB_PATH}")

    try:
        conn = sqlite3.connect(str(DB_PATH))
        # num_nonnulls CHECK cheklovi uchun (rating jadvali insert paytida kerak bo'lishi mumkin)
        conn.create_function("num_nonnulls", -1, lambda *a: sum(1 for x in a if x is not None))
        conn.execute("PRAGMA foreign_keys = ON")
        cur = conn.cursor()

        # 2) SXEMA
        if not _has_table(cur, "product"):
            print("[sxema] jadvallar topilmadi — schema_sqlite.sql yuklanmoqda…")
            conn.executescript(schema_sql)
            print("[sxema] schema_sqlite.sql yuklandi")
        else:
            print("[sxema] jadvallar mavjud — o'tkazib yuborildi")

        # 3) SEED
        cur.execute("SELECT count(*) FROM product")
        n = cur.fetchone()[0]
        if n == 0:
            print("[seed] boshlang'ich ma'lumot yuklanmoqda…")
            conn.executescript(seed_sql)
            conn.commit()
            cur.execute("SELECT count(*) FROM product")
            print(f"[seed] seed_sqlite.sql yuklandi ({cur.fetchone()[0]} mahsulot)")
        else:
            print(f"[seed] mavjud ({n} mahsulot) — o'tkazib yuborildi")

        # 3b) BOZOR TAHLILI — narx tarixi (demo OHLC), agar bo'sh bo'lsa
        seed_price_history(conn, cur)

        # 3c) KARTA — lokatsiya ustunlari (migratsiya) + infratuzilma koordinatalari
        migrate_locations(conn, cur)

        # 4) ADMIN PAROL
        cur.execute("SELECT id, password_hash FROM app_user WHERE email = ?", (ADMIN_EMAIL,))
        row = cur.fetchone()
        if row is None:
            print(f"[admin] '{ADMIN_EMAIL}' topilmadi — seed super_admin emailini tekshiring")
        elif not row[1]:
            h = bcrypt.hashpw(ADMIN_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cur.execute("UPDATE app_user SET password_hash = ? WHERE id = ?", (h, row[0]))
            conn.commit()
            print(f"[admin] parol o'rnatildi  ->  {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        else:
            print(f"[admin] parol allaqachon o'rnatilgan  ->  {ADMIN_EMAIL}")

        conn.commit()
        conn.close()
        print("\n\u2713 Baza tayyor.")
    except Exception as e:
        print(f"\nXATO: bazani tayyorlab bo'lmadi: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
