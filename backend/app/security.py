# =====================================================================
#  XAVFSIZLIK — parol hash (bcrypt), JWT, rol asosida himoya
# =====================================================================
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings
from app.db import fetch_one


# --- parol ---
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed) -> bool:
    try:
        hb = hashed if isinstance(hashed, (bytes, bytearray)) else hashed.encode("utf-8")
        return bcrypt.checkpw(plain.encode("utf-8"), hb)
    except Exception:
        return False


# --- JWT ---
def create_access_token(sub, role, company_id) -> str:
    if isinstance(role, (bytes, bytearray)):
        role = role.decode("utf-8")
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(sub),
        "role": role,
        "company_id": str(company_id) if company_id else None,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


bearer = HTTPBearer(auto_error=False)


async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if cred is None:
        raise HTTPException(status_code=401, detail="Avtorizatsiya kerak (Bearer token)")
    try:
        payload = jwt.decode(cred.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token muddati tugagan")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token yaroqsiz")

    user = await fetch_one(
        "SELECT id, role, name, email, company_id FROM app_user WHERE id = %s",
        (payload.get("sub"),),
    )
    if not user:
        raise HTTPException(status_code=401, detail="Foydalanuvchi topilmadi")
    return user


def require_roles(*roles: str):
    """Berilgan rollardan biri bo'lishini talab qiladi (Depends sifatida)."""
    async def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Ruxsat yo'q — kerakli rol: {', '.join(roles)}",
            )
        return user

    return dependency
