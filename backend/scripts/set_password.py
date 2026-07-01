#!/usr/bin/env python3
# =====================================================================
#  Foydalanuvchi parolini o'rnatish (SQLite).
#  Ishlatish:  python scripts/set_password.py admin@ipakyoli.uz <parol>
# =====================================================================
import os
import sys
import sqlite3
from pathlib import Path

import bcrypt
from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent.parent
load_dotenv(BASE / ".env")


def resolve_db_path() -> Path:
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url:
        return BASE / "ipak.db"
    if url.startswith("sqlite:///"):
        rest = url[len("sqlite:///"):]
        p = Path(rest) if rest else Path("ipak.db")
        return p if p.is_absolute() else (BASE / p)
    if url.startswith("sqlite://"):
        rest = url[len("sqlite://"):]
        return (BASE / rest) if rest else (BASE / "ipak.db")
    if url.startswith(("postgres://", "postgresql://")):
        return BASE / "ipak.db"
    p = Path(url)
    return p if p.is_absolute() else (BASE / p)


def main():
    if len(sys.argv) != 3:
        print("Ishlatish: python scripts/set_password.py <email> <parol>")
        sys.exit(2)
    email, password = sys.argv[1], sys.argv[2]
    h = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn = sqlite3.connect(str(resolve_db_path()))
    cur = conn.cursor()
    cur.execute("UPDATE app_user SET password_hash = ? WHERE email = ?", (h, email))
    if cur.rowcount == 0:
        print(f"Foydalanuvchi topilmadi: {email}")
        conn.close()
        sys.exit(1)
    conn.commit()
    conn.close()
    print(f"Parol o'rnatildi: {email}")


if __name__ == "__main__":
    main()
