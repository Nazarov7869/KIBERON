# =====================================================================
#  AI PROVAYDER SOZLAMALARI — bazadan (admin panel) yoki .env dan
# ---------------------------------------------------------------------
#  Admin panel orqali kiritilgan kalit `app_setting` jadvalida saqlanadi
#  va .env qiymatlaridan USTUN turadi. Kalit kiritilmagan bo'lsa — .env
#  ga qaytadi (eski xatti-harakat). Kalit bazada ochiq (plaintext, xuddi
#  .env kabi) saqlanadi; API javoblarida faqat niqoblangan ko'rinishda
#  qaytariladi.
# =====================================================================
from app.db import pool, fetch_all
from app.config import settings

_AI_KEYS = ("ai_provider", "ai_api_key", "ai_base_url", "ai_model")
VALID_PROVIDERS = ("anthropic", "openai", "google", "custom")


async def _ensure_table() -> None:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "CREATE TABLE IF NOT EXISTS app_setting ("
                "  key TEXT PRIMARY KEY,"
                "  value TEXT,"
                "  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)"
                ")"
            )


async def _load_db() -> dict:
    await _ensure_table()
    rows = await fetch_all(
        "SELECT key, value FROM app_setting WHERE key IN (%s,%s,%s,%s)", list(_AI_KEYS)
    )
    return {r["key"]: (r["value"] or "") for r in rows}


async def get_ai_config() -> dict:
    """Effektiv AI konfiguratsiyasi: baza -> .env fallback.

    Qaytadi: {provider, api_key, base_url, model, source} — source: db|env|none
    """
    try:
        db = await _load_db()
    except Exception:
        db = {}

    provider = (db.get("ai_provider") or "").strip()
    api_key = (db.get("ai_api_key") or "").strip()
    base_url = (db.get("ai_base_url") or "").strip()
    model = (db.get("ai_model") or "").strip()

    if api_key:  # bazada kalit bor -> undan foydalanamiz
        return {
            "provider": provider or "anthropic",
            "api_key": api_key,
            "base_url": base_url,
            "model": model,
            "source": "db",
        }

    # .env fallback (eski mantiq)
    if settings.ANTHROPIC_API_KEY:
        provider, api_key = "anthropic", settings.ANTHROPIC_API_KEY
    elif settings.OPENAI_API_KEY:
        provider, api_key = "openai", settings.OPENAI_API_KEY
    elif settings.GEMINI_API_KEY:
        provider, api_key = "google", settings.GEMINI_API_KEY
    elif settings.AI_API_KEY and settings.AI_BASE_URL:
        provider, api_key, base_url = "custom", settings.AI_API_KEY, settings.AI_BASE_URL
    else:
        provider, api_key = "", ""

    return {
        "provider": provider,
        "api_key": api_key,
        "base_url": base_url or settings.AI_BASE_URL,
        "model": model or settings.AI_MODEL,
        "source": "env" if api_key else "none",
    }


async def set_ai_config(provider: str, api_key: str, base_url: str = "", model: str = "") -> None:
    await _ensure_table()
    pairs = {
        "ai_provider": (provider or "").strip(),
        "ai_api_key": (api_key or "").strip(),
        "ai_base_url": (base_url or "").strip(),
        "ai_model": (model or "").strip(),
    }
    async with pool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                for k, v in pairs.items():
                    await cur.execute(
                        "INSERT INTO app_setting (key, value, updated_at) VALUES (%s, %s, now()) "
                        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = now()",
                        [k, v],
                    )


async def clear_ai_config() -> None:
    await _ensure_table()
    async with pool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                for k in _AI_KEYS:
                    await cur.execute("DELETE FROM app_setting WHERE key = %s", [k])


def mask_key(key: str) -> str:
    """Kalitni xavfsiz ko'rsatish: sk-ant-...AA (boshi va oxiri)."""
    if not key:
        return ""
    if len(key) <= 12:
        return key[:2] + "…"
    return key[:8] + "…" + key[-4:]
