# =====================================================================
#  ELCHIXONA LEAD MARSHRUTI — tashqi bozordagi xaridor/talab ma'lumoti
#  Elchixona va super_admin kiritadi; eksportyor talabni ko'radi.
# =====================================================================
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one
from app.security import get_current_user
from app.permissions import require_perm
from app.schemas import LeadCreate, LeadUpdate

router = APIRouter()

LEAD_SELECT = """
  SELECT e.*, m.country AS market_country, pr.name AS product_name, u.name AS embassy_name
  FROM embassy_lead e
  LEFT JOIN market m ON m.id = e.market_id
  LEFT JOIN product pr ON pr.id = e.product_id
  JOIN app_user u ON u.id = e.embassy_user_id
"""


@router.get("")
async def list_leads(
    user: dict = Depends(require_perm("lead", "read")),
    product_id: Optional[UUID] = None,
    market_id: Optional[UUID] = None,
):
    where, params = [], []
    if user["role"] == "embassy":           # elchixona faqat o'zinikini ko'radi
        where.append("e.embassy_user_id = %s")
        params.append(user["id"])
    if product_id:
        where.append("e.product_id = %s")
        params.append(product_id)
    if market_id:
        where.append("e.market_id = %s")
        params.append(market_id)
    sql = LEAD_SELECT + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY e.created_at DESC"
    rows = await fetch_all(sql, params)
    return {"ok": True, "count": len(rows), "leads": rows}


@router.post("", status_code=201)
async def create_lead(body: LeadCreate, user: dict = Depends(require_perm("lead", "create"))):
    if body.product_id and not await fetch_one("SELECT 1 FROM product WHERE id = %s", [body.product_id]):
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    if body.market_id and not await fetch_one("SELECT 1 FROM market WHERE id = %s", [body.market_id]):
        raise HTTPException(status_code=404, detail="Bozor topilmadi")
    new = await fetch_one(
        """INSERT INTO embassy_lead (embassy_user_id, importer_contact, market_id, product_id, notes)
           VALUES (%s, %s, %s, %s, %s) RETURNING id""",
        [user["id"], body.importer_contact, body.market_id, body.product_id, body.notes],
    )
    row = await fetch_one(LEAD_SELECT + " WHERE e.id = %s", [new["id"]])
    return {"ok": True, "lead": row}


@router.get("/{lead_id}")
async def get_lead(lead_id: UUID, user: dict = Depends(require_perm("lead", "read"))):
    row = await fetch_one(LEAD_SELECT + " WHERE e.id = %s", [lead_id])
    if not row:
        raise HTTPException(status_code=404, detail="Lead topilmadi")
    if user["role"] == "embassy" and str(row["embassy_user_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Bu lead sizniki emas")
    return {"ok": True, "lead": row}


@router.patch("/{lead_id}")
async def update_lead(lead_id: UUID, body: LeadUpdate, user: dict = Depends(require_perm("lead", "update"))):
    lead = await fetch_one("SELECT embassy_user_id FROM embassy_lead WHERE id = %s", [lead_id])
    if not lead:
        raise HTTPException(status_code=404, detail="Lead topilmadi")
    if user["role"] != "super_admin" and str(lead["embassy_user_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Bu lead sizniki emas")
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="O'zgartirish uchun maydon yo'q")
    if "product_id" in fields and fields["product_id"] and not await fetch_one("SELECT 1 FROM product WHERE id = %s", [fields["product_id"]]):
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    if "market_id" in fields and fields["market_id"] and not await fetch_one("SELECT 1 FROM market WHERE id = %s", [fields["market_id"]]):
        raise HTTPException(status_code=404, detail="Bozor topilmadi")
    sets, params = [], []
    for k, v in fields.items():
        sets.append(f"{k} = %s")
        params.append(v)
    params.append(lead_id)
    await fetch_one(f"UPDATE embassy_lead SET {', '.join(sets)} WHERE id = %s RETURNING id", params)
    row = await fetch_one(LEAD_SELECT + " WHERE e.id = %s", [lead_id])
    return {"ok": True, "lead": row}


@router.delete("/{lead_id}")
async def delete_lead(lead_id: UUID, user: dict = Depends(require_perm("lead", "delete"))):
    lead = await fetch_one("SELECT embassy_user_id FROM embassy_lead WHERE id = %s", [lead_id])
    if not lead:
        raise HTTPException(status_code=404, detail="Lead topilmadi")
    if user["role"] != "super_admin" and str(lead["embassy_user_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Bu lead sizniki emas")
    await fetch_one("DELETE FROM embassy_lead WHERE id = %s RETURNING id", [lead_id])
    return {"ok": True, "deleted": str(lead_id)}
