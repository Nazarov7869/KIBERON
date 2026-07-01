# =====================================================================
#  KO'P PROVAYDERLI LLM MIJOZ
#  Qaysi API kalit .env'da bo'lsa — o'sha provayder ishlatiladi.
#  Tartib: anthropic -> openai -> google -> custom (OpenAI-mos).
# =====================================================================
import asyncio
import json
import urllib.request
import urllib.error

from app.config import settings


class LLMError(Exception):
    pass


def active_provider() -> str | None:
    if settings.ANTHROPIC_API_KEY:
        return "anthropic"
    if settings.OPENAI_API_KEY:
        return "openai"
    if settings.GEMINI_API_KEY:
        return "google"
    if settings.AI_API_KEY and settings.AI_BASE_URL:
        return "custom"
    return None


_DEFAULT_MODEL = {
    "anthropic": "claude-sonnet-4-6",
    "openai": "gpt-4o-mini",
    "google": "gemini-1.5-flash",
    "custom": "gpt-4o-mini",
}


def _model(provider: str) -> str:
    return settings.AI_MODEL or _DEFAULT_MODEL[provider]


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


def _call_sync(provider: str, system: str, message: str, max_tokens: int = 1024) -> str:
    model = _model(provider)

    if provider == "anthropic":
        d = _post(
            "https://api.anthropic.com/v1/messages",
            {"x-api-key": settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            {"model": model, "max_tokens": max_tokens, "system": system,
             "messages": [{"role": "user", "content": message}]},
        )
        return "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")

    if provider in ("openai", "custom"):
        base = settings.AI_BASE_URL.rstrip("/") if provider == "custom" else "https://api.openai.com/v1"
        key = settings.AI_API_KEY if provider == "custom" else settings.OPENAI_API_KEY
        d = _post(
            f"{base}/chat/completions",
            {"Authorization": f"Bearer {key}"},
            {"model": model, "max_tokens": max_tokens, "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": message},
            ]},
        )
        return d["choices"][0]["message"]["content"]

    if provider == "google":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"
        d = _post(url, {}, {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"parts": [{"text": message}]}],
            "generationConfig": {"maxOutputTokens": max_tokens},
        })
        return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])

    raise LLMError("Provayder topilmadi")


async def complete(system: str, message: str, max_tokens: int = 1024) -> dict:
    """LLM'ni chaqiradi. Provayder sozlanmagan bo'lsa — LLMError."""
    provider = active_provider()
    if not provider:
        raise LLMError(
            "AI provayder sozlanmagan — .env'da ANTHROPIC_API_KEY / OPENAI_API_KEY / "
            "GEMINI_API_KEY yoki AI_API_KEY+AI_BASE_URL qo'ying"
        )
    text = await asyncio.to_thread(_call_sync, provider, system, message, max_tokens)
    return {"provider": provider, "model": _model(provider), "text": text}
