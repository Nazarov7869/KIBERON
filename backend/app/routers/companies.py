# =====================================================================
#  COMPANY MARSHRUTI — admin korxonalarni ko'radi/tasdiqlaydi;
#  eksportyor o'z korxonasini ko'radi
# =====================================================================
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one
from app.permissions import require_perm

router = APIRouter()


@router.get("")
async def list_companies(user: dict = Depends(require_perm("company", "list"))):
    rows = await fetch_all(
        """SELECT c.*, v.name AS verified_by_name,
                  (c.verified_by IS NOT NULL) AS is_verified,
                  (SELECT count(*) FROM app_user u WHERE u.company_id = c.id) AS user_count,
                  (SELECT count(*) FROM lot l WHERE l.company_id = c.id) AS lot_count
           FROM company c
           LEFT JOIN app_user v ON v.id = c.verified_by
           ORDER BY c.created_at DESC"""
    )
    return {"ok": True, "count": len(rows), "companies": rows}


@router.get("/me")
async def my_company(user: dict = Depends(require_perm("company", "read_own"))):
    if not user["company_id"]:
        raise HTTPException(status_code=404, detail="Korxona biriktirilmagan")
    row = await fetch_one(
        """SELECT c.*, v.name AS verified_by_name, (c.verified_by IS NOT NULL) AS is_verified
           FROM company c LEFT JOIN app_user v ON v.id = c.verified_by
           WHERE c.id = %s""",
        [user["company_id"]],
    )
    return {"ok": True, "company": row}


@router.post("/{company_id}/verify")
async def verify_company(company_id: UUID, user: dict = Depends(require_perm("company", "verify"))):
    if not await fetch_one("SELECT 1 FROM company WHERE id = %s", [company_id]):
        raise HTTPException(status_code=404, detail="Korxona topilmadi")
    row = await fetch_one(
        "UPDATE company SET verified_by = %s WHERE id = %s RETURNING id, name, verified_by",
        [user["id"], company_id],
    )
    return {"ok": True, "verified": True, "company": row}
