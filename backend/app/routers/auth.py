# =====================================================================
#  AUTH MARSHRUTI — ro'yxat, kirish, joriy foydalanuvchi
# =====================================================================
from fastapi import APIRouter, Depends, HTTPException

from app.db import pool, fetch_one, dict_row
from app.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_roles,
)
from app.schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    # email band emasligi
    if await fetch_one("SELECT id FROM app_user WHERE email = %s", (body.email,)):
        raise HTTPException(status_code=409, detail="Bu email allaqachon ro'yxatdan o'tgan")

    pw = hash_password(body.password)

    if body.role == "exporter":
        c = body.company
        if await fetch_one("SELECT id FROM company WHERE stir = %s", (c.stir,)):
            raise HTTPException(status_code=409, detail="Bu STIR allaqachon ro'yxatdan o'tgan")
        # korxona + birinchi foydalanuvchi — bitta tranzaksiyada
        async with pool.connection() as conn:
            async with conn.transaction():
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(
                        """INSERT INTO company (name, stir, legal_form, company_type, region)
                           VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                        (c.name, c.stir, c.legal_form, c.company_type, c.region),
                    )
                    company_id = (await cur.fetchone())["id"]
                    await cur.execute(
                        """INSERT INTO app_user (role, company_id, name, phone, email, password_hash)
                           VALUES ('exporter', %s, %s, %s, %s, %s)
                           RETURNING id, role, name, email, company_id""",
                        (company_id, body.name, body.phone, body.email, pw),
                    )
                    user = await cur.fetchone()
    else:  # importer — faqat foydalanuvchi
        user = await fetch_one(
            """INSERT INTO app_user (role, name, phone, email, password_hash)
               VALUES ('importer', %s, %s, %s, %s)
               RETURNING id, role, name, email, company_id""",
            (body.name, body.phone, body.email, pw),
        )

    token = create_access_token(user["id"], user["role"], user["company_id"])
    return {"ok": True, "access_token": token, "user": user}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await fetch_one(
        "SELECT id, role, name, email, company_id, password_hash FROM app_user WHERE email = %s",
        (body.email,),
    )
    if not user or not user["password_hash"] or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email yoki parol noto'g'ri")

    token = create_access_token(user["id"], user["role"], user["company_id"])
    return {"ok": True, "access_token": token, "user": user}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return user


# Rol himoyasi namunasi (5-qadamda entity API'lar shu naqshda himoyalanadi)
@router.get("/admin/ping")
async def admin_ping(user: dict = Depends(require_roles("super_admin"))):
    return {"ok": True, "message": "Salom, super-admin", "user": user["name"]}
