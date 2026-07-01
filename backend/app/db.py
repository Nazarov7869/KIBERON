# =====================================================================
#  DB ULANISH QATLAMI (SQLite / aiosqlite)
#  Butun ilova SQLite faylida ishlaydi — hech qanday tashqi baza kerak emas.
#  DATABASE_URL: sqlite:///./ipak.db  (yoki oddiy fayl yo'li). Bo'sh bo'lsa
#  backend/ipak.db ishlatiladi. Bu modul psycopg3 API'sining ilova ishlatgan
#  qismini (pool.connection/transaction/cursor, fetch_all/fetch_one, Json,
#  dict_row) SQLite ustida taqlid qiladi — routerlar deyarli o'zgarmaydi.
# =====================================================================
import re
import json
import time
import uuid as _uuid
import datetime as _dt
from pathlib import Path
from contextlib import asynccontextmanager

import aiosqlite

from app.config import settings

# --- Baza fayli yo'lini aniqlash -------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent.parent  # .../backend


def _resolve_db_path() -> str:
    url = (settings.DATABASE_URL or "").strip()
    if not url:
        return str(_BACKEND_DIR / "ipak.db")
    if url.startswith("sqlite:///"):
        rest = url[len("sqlite:///"):]
        if not rest:
            return str(_BACKEND_DIR / "ipak.db")
        p = Path(rest)
        return str(p if p.is_absolute() else (_BACKEND_DIR / p).resolve())
    if url.startswith("sqlite://"):
        rest = url[len("sqlite://"):]
        return str((_BACKEND_DIR / rest).resolve()) if rest else str(_BACKEND_DIR / "ipak.db")
    if url.startswith(("postgres://", "postgresql://")):
        # Eski PostgreSQL manzili — SQLite'ga o'tildi; standart faylni ishlatamiz.
        return str(_BACKEND_DIR / "ipak.db")
    # Oddiy fayl yo'li deb qabul qilamiz
    p = Path(url)
    return str(p if p.is_absolute() else (_BACKEND_DIR / p).resolve())


DB_PATH = _resolve_db_path()


# --- psycopg.types.json.Json o'rnini bosuvchi -------------------------
class Json:
    """dict/list ni jsonb ustuni uchun o'rash — SQLite'da matn (TEXT) sifatida saqlanadi."""

    def __init__(self, obj):
        self.obj = obj


# --- psycopg dict_row sentineli (routerlar import qiladi) -------------
dict_row = "dict_row"


# --- jsonb ustunlari: o'qishda avtomatik dict/list ga aylantiriladi ---
_JSON_COLS = {
    "spec", "schema", "lab_result", "score_weights",
    "waypoints", "entry_point", "tracking_events",
    "storage_classes", "modes",
}


class DictRow(dict):
    """Kalit bo'yicha ham, indeks (int) bo'yicha ham murojaatni qo'llaydi.
    psycopg dict_row (dict) va oddiy kortej (row[0]) ikkalasiga mos."""

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


def _decode_row(row) -> DictRow:
    d = DictRow()
    for k in row.keys():
        v = row[k]
        if k in _JSON_COLS and isinstance(v, str) and v:
            try:
                v = json.loads(v)
            except (ValueError, TypeError):
                pass
        d[k] = v
    return d


# --- SQL tarjimasi: PostgreSQL -> SQLite ------------------------------
_CAST_RE = re.compile(r"::\w+(\[\])?")
_ILIKE_RE = re.compile(r"\bILIKE\b", re.IGNORECASE)


def _translate(sql: str) -> str:
    sql = _CAST_RE.sub("", sql)          # ::jsonb, ::access_status va h.k. -> olib tashlanadi
    sql = _ILIKE_RE.sub("LIKE", sql)     # ILIKE -> LIKE (SQLite LIKE ASCII uchun katta-kichik farqlamaydi)
    sql = sql.replace("%s", "?")         # psycopg pozitsion belgisi -> SQLite
    return sql


def _convert_params(params):
    if params is None:
        return []
    out = []
    for v in params:
        if isinstance(v, Json):
            out.append(json.dumps(v.obj, ensure_ascii=False) if v.obj is not None else None)
        elif isinstance(v, _uuid.UUID):
            out.append(str(v))
        elif isinstance(v, bool):
            out.append(1 if v else 0)
        elif isinstance(v, (dict, list)):
            out.append(json.dumps(v, ensure_ascii=False))
        elif isinstance(v, (_dt.date, _dt.datetime)):
            out.append(v.isoformat())
        else:
            out.append(v)
    return out


# --- Custom SQLite funksiyalari (now(), gen_random_uuid(), num_nonnulls) --
def _now_str() -> str:
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


async def _register(conn: aiosqlite.Connection):
    conn.row_factory = aiosqlite.Row
    # Funksiyalar aiosqlite ishchi ipida ro'yxatdan o'tishi shart (await orqali)
    await conn.create_function("now", 0, _now_str)
    await conn.create_function("gen_random_uuid", 0, lambda: str(_uuid.uuid4()))
    await conn.create_function(
        "num_nonnulls", -1, lambda *a: sum(1 for x in a if x is not None)
    )


@asynccontextmanager
async def _open():
    conn = await aiosqlite.connect(DB_PATH)
    await _register(conn)
    await conn.execute("PRAGMA foreign_keys = ON")
    await conn.execute("PRAGMA busy_timeout = 5000")
    try:
        yield conn
    finally:
        await conn.close()


# --- Oddiy so'rov yordamchilari (avtomatik commit) --------------------
async def fetch_all(sql: str, params=None) -> list[dict]:
    """Bir nechta qator qaytaradi (dict ko'rinishida)."""
    start = time.perf_counter()
    async with _open() as conn:
        cur = await conn.execute(_translate(sql), _convert_params(params))
        rows = await cur.fetchall()
        await conn.commit()
    ms = (time.perf_counter() - start) * 1000
    if ms > 300:
        print(f"[db] sekin so'rov {ms:.0f}ms: {' '.join(sql.split())[:70]}")
    return [_decode_row(r) for r in rows]


async def fetch_one(sql: str, params=None) -> dict | None:
    """Bitta qator qaytaradi (yoki None)."""
    async with _open() as conn:
        cur = await conn.execute(_translate(sql), _convert_params(params))
        row = await cur.fetchone()
        await conn.commit()
    return _decode_row(row) if row is not None else None


# --- Tranzaksiya uchun psycopg-mos shim ------------------------------
class _Cursor:
    def __init__(self, conn: aiosqlite.Connection):
        self._conn = conn
        self._cur = None

    async def execute(self, sql: str, params=None):
        self._cur = await self._conn.execute(_translate(sql), _convert_params(params))
        return self

    async def fetchone(self):
        row = await self._cur.fetchone()
        return _decode_row(row) if row is not None else None

    async def fetchall(self):
        return [_decode_row(r) for r in await self._cur.fetchall()]

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Conn:
    def __init__(self, conn: aiosqlite.Connection):
        self._conn = conn

    def cursor(self, row_factory=None):
        # row_factory (dict_row) e'tiborsiz — biz doim DictRow qaytaramiz
        return _Cursor(self._conn)

    @asynccontextmanager
    async def transaction(self):
        try:
            await self._conn.execute("BEGIN")
            yield self
            await self._conn.commit()
        except BaseException:
            await self._conn.rollback()
            raise


class _Pool:
    """psycopg AsyncConnectionPool o'rnini bosuvchi minimal shim."""

    async def open(self):
        # SQLite fayli uchun doimiy pool kerak emas — ulanish har so'rovda ochiladi.
        return None

    async def close(self):
        return None

    @asynccontextmanager
    async def connection(self):
        conn = await aiosqlite.connect(DB_PATH)
        await _register(conn)
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA busy_timeout = 5000")
        try:
            yield _Conn(conn)
        finally:
            await conn.close()


pool = _Pool()


# --- Sog'liq / diagnostika --------------------------------------------
async def health_check() -> dict:
    start = time.perf_counter()
    try:
        async with _open() as conn:
            await conn.execute("SELECT 1")
        return {"ok": True, "latency_ms": round((time.perf_counter() - start) * 1000, 1)}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}


async def table_counts() -> dict:
    rows = await fetch_all(
        """
        SELECT 'product' AS t, count(*) AS n FROM product
        UNION ALL SELECT 'market',        count(*) FROM market
        UNION ALL SELECT 'warehouse',     count(*) FROM warehouse
        UNION ALL SELECT 'market_access', count(*) FROM market_access
        UNION ALL SELECT 'certification', count(*) FROM certification
        UNION ALL SELECT 'price_ref',     count(*) FROM price_ref
        UNION ALL SELECT 'app_user',      count(*) FROM app_user
        """
    )
    return {r["t"]: int(r["n"]) for r in rows}
