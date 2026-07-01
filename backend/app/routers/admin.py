# =====================================================================
#  ADMIN MARSHRUTI — super_admin xodim foydalanuvchilar yaratadi
#  (elchixona / logistika / ombor — ular o'zi ro'yxatdan o'tolmaydi)
# =====================================================================
from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_one, fetch_all
from app.security import hash_password, require_roles
from app.schemas import StaffCreate, AiSettingsUpdate
from app import settings_store
from app.llm import test_config, LLMError

router = APIRouter()


@router.post("/users", status_code=201)
async def create_staff(body: StaffCreate, user: dict = Depends(require_roles("super_admin"))):
    if await fetch_one("SELECT 1 FROM app_user WHERE email = %s", [body.email]):
        raise HTTPException(status_code=409, detail="Bu email allaqachon mavjud")
    pw = hash_password(body.password)
    row = await fetch_one(
        """INSERT INTO app_user (role, name, phone, email, password_hash)
           VALUES (%s, %s, %s, %s, %s) RETURNING id, role, name, email""",
        [body.role, body.name, body.phone, body.email, pw],
    )
    return {"ok": True, "user": row}


# --------------------------------------------------------------- users
@router.get("/users")
async def list_users(user: dict = Depends(require_roles("super_admin"))):
    """Barcha ro'yxatdan o'tgan foydalanuvchilar (parolsiz) + korxona nomi."""
    rows = await fetch_all(
        """SELECT u.id, u.role, u.name, u.email, u.phone, u.created_at,
                  u.company_id, c.name AS company_name,
                  (c.verified_by IS NOT NULL) AS company_verified
           FROM app_user u
           LEFT JOIN company c ON c.id = u.company_id
           ORDER BY u.created_at DESC"""
    )
    # rollar bo'yicha soni
    counts = {}
    for r in rows:
        counts[r["role"]] = counts.get(r["role"], 0) + 1
    return {"ok": True, "count": len(rows), "by_role": counts, "users": rows}


# ------------------------------------------------------------------ AI
async def _ai_settings_view() -> dict:
    cfg = await settings_store.get_ai_config()
    return {
        "provider": cfg["provider"] or None,
        "configured": bool(cfg["api_key"]),
        "has_key": bool(cfg["api_key"]),
        "key_masked": settings_store.mask_key(cfg["api_key"]),
        "base_url": cfg["base_url"] or "",
        "model": cfg["model"] or "",
        "source": cfg["source"],   # db | env | none
    }


@router.get("/ai-settings")
async def get_ai_settings(user: dict = Depends(require_roles("super_admin"))):
    return {"ok": True, "settings": await _ai_settings_view()}


@router.put("/ai-settings")
async def put_ai_settings(body: AiSettingsUpdate, user: dict = Depends(require_roles("super_admin"))):
    if body.provider == "custom" and not (body.base_url or "").strip():
        raise HTTPException(status_code=422, detail="'custom' provayder uchun bazaviy URL (base_url) kerak")
    await settings_store.set_ai_config(body.provider, body.api_key, body.base_url or "", body.model or "")
    return {"ok": True, "settings": await _ai_settings_view(), "message": "AI sozlamalari saqlandi"}


@router.delete("/ai-settings")
async def delete_ai_settings(user: dict = Depends(require_roles("super_admin"))):
    await settings_store.clear_ai_config()
    return {"ok": True, "settings": await _ai_settings_view(), "message": "AI sozlamalari tozalandi (.env ga qaytdi)"}


@router.post("/ai-settings/test")
async def test_ai_settings(user: dict = Depends(require_roles("super_admin"))):
    """Joriy (baza yoki .env) kalit bilan kichik sinov chaqiruvi."""
    cfg = await settings_store.get_ai_config()
    if not cfg.get("api_key"):
        raise HTTPException(status_code=400, detail="AI kaliti sozlanmagan")
    try:
        res = await test_config(cfg)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=f"Sinov muvaffaqiyatsiz: {e}")
    return {"ok": True, "provider": res["provider"], "model": res["model"], "reply": res["reply"]}
