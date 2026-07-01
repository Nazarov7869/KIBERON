# =====================================================================
#  ADMIN MARSHRUTI — super_admin xodim foydalanuvchilar yaratadi
#  (elchixona / logistika / ombor — ular o'zi ro'yxatdan o'tolmaydi)
# =====================================================================
from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_one
from app.security import hash_password, require_roles
from app.schemas import StaffCreate

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
