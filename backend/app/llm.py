# =====================================================================
#  KO'P PROVAYDERLI LLM MIJOZ
#  Kalit va provayder AVVAL bazadan (admin panel), keyin .env dan olinadi
#  (app/settings_store.get_ai_config). Provayderlar: anthropic / openai /
#  google / custom (OpenAI-mos).
# =====================================================================
import asyncio
import json
import urllib.request
import urllib.error

from app.settings_store import get_ai_config


class LLMError(Exception):
    pass


_DEFAULT_MODEL = {
    "anthropic": "claude-sonnet-4-6",
    "openai": "gpt-4o-mini",
    "google": "gemini-1.5-flash",
    "custom": "gpt-4o-mini",
}


def _model(cfg: dict) -> str:
    return (cfg.get("model") or "").strip() or _DEFAULT_MODEL.get(cfg.get("provider") or "", "")


async def active_provider() -> str | None:
    """Hozir samarali provayder (baza yoki .env). Sozlanmagan bo'lsa None."""
    cfg = await get_ai_config()
    return cfg["provider"] if cfg.get("api_key") else None


async def provider_status() -> dict:
    """AI holati: {provider, configured, source}."""
    cfg = await get_ai_config()
    configured = bool(cfg.get("api_key"))
    return {
        "provider": cfg["provider"] if configured else None,
        "configured": configured,
        "source": cfg.get("source", "none"),
    }


def _post(url: str, headers: dict, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise LLMError(f"provayder xatosi {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}")
    except Exception as e:  # noqa: BLE001
        raise LLMError(f"so'rov xatosi: {e}")


def _call_sync(cfg: dict, system: str, message: str, max_tokens: int = 1024) -> str:
    provider = cfg.get("provider")
    api_key = cfg.get("api_key")
    model = _model(cfg)

    if provider == "anthropic":
        d = _post(
            "https://api.anthropic.com/v1/messages",
            {"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            {"model": model, "max_tokens": max_tokens, "system": system,
             "messages": [{"role": "user", "content": message}]},
        )
        return "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")

    if provider in ("openai", "custom"):
        base = (cfg.get("base_url") or "").rstrip("/") if provider == "custom" else "https://api.openai.com/v1"
        if provider == "custom" and not base:
            raise LLMError("custom provayder uchun AI_BASE_URL (bazaviy URL) kerak")
        d = _post(
            f"{base}/chat/completions",
            {"Authorization": f"Bearer {api_key}"},
            {"model": model, "max_tokens": max_tokens, "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ]},
        )
        return d["choices"][0]["message"]["content"]

    if provider == "google":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        d = _post(url, {}, {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"parts": [{"text": message}]}],
            "generationConfig": {"maxOutputTokens": max_tokens},
        })
        return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])

    raise LLMError("Provayder topilmadi")


async def complete(system: str, message: str, max_tokens: int = 1024) -> dict:
    """LLM'ni chaqiradi. Provayder sozlanmagan bo'lsa — LLMError."""
    cfg = await get_ai_config()
    if not cfg.get("api_key"):
        raise LLMError(
            "AI provayder sozlanmagan — admin panelda Sozlamalar > AI dan kalit kiriting "
            "(yoki .env'da ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY qo'ying)"
        )
    text = await asyncio.to_thread(_call_sync, cfg, system, message, max_tokens)
    return {"provider": cfg["provider"], "model": _model(cfg), "text": text}


async def test_config(cfg: dict) -> dict:
    """Berilgan config bilan kichik sinov chaqiruvi (kalitni tekshirish uchun)."""
    if not cfg.get("api_key"):
        raise LLMError("Kalit kiritilmagan")
    text = await asyncio.to_thread(
        _call_sync, cfg, "Reply with the single word: OK", "ping", 16
    )
    return {"provider": cfg["provider"], "model": _model(cfg), "reply": (text or "").strip()[:60]}
