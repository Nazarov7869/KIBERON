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


def _has_table(cur, name: str) -> bool:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return cur.fetchone() is not None


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
