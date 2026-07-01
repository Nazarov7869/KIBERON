# =====================================================================
#  RFQ MARSHRUTI (talab tomoni) — importyor talab e'lon qiladi
# =====================================================================
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one, Json
from app.security import get_current_user
from app.permissions import require_perm
from app.schemas import RfqCreate, RfqUpdate

router = APIRouter()

RFQ_SELECT = """
  SELECT r.*, p.name AS product_name, p.hs_code,
         m.country AS market_country, u.name AS importer_name
  FROM rfq r
  JOIN product p ON p.id = r.product_id
  LEFT JOIN market m ON m.id = r.market_id
  JOIN app_user u ON u.id = r.importer_id
"""


@router.get("")
async def list_rfqs(
    user: dict = Depends(require_perm("rfq", "read")),
    product_id: Optional[UUID] = None,
    market_id: Optional[UUID] = None,
    status: str = "open",
):
    """Ochiq talablarni ko'rish (eksportyor/admin talabni topadi)."""
    sql = RFQ_SELECT + " WHERE r.status = %s"
    params: list = [status]
    if product_id:
        sql += " AND r.product_id = %s"
        params.append(product_id)
    if market_id:
        sql += " AND r.market_id = %s"
        params.append(market_id)
    sql += " ORDER BY r.created_at DESC"
    rows = await fetch_all(sql, params)
    return {"ok": True, "count": len(rows), "rfqs": rows}


@router.get("/mine")
async def my_rfqs(user: dict = Depends(get_current_user)):
    if user["role"] != "importer":
        raise HTTPException(status_code=403, detail="Faqat importyor uchun")
    rows = await fetch_all(
        RFQ_SELECT + " WHERE r.importer_id = %s ORDER BY r.created_at DESC",
        [user["id"]],
    )
    return {"ok": True, "count": len(rows), "rfqs": rows}


@router.post("", status_code=201)
async def create_rfq(body: RfqCreate, user: dict = Depends(require_perm("rfq", "create"))):
    if not await fetch_one("SELECT 1 FROM product WHERE id = %s", [body.product_id]):
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    if body.market_id and not await fetch_one("SELECT 1 FROM market WHERE id = %s", [body.market_id]):
        raise HTTPException(status_code=404, detail="Bozor topilmadi")
    new = await fetch_one(
        """INSERT INTO rfq (importer_id, product_id, spec, grade, target_quantity_t,
                            market_id, incoterm, maq_t, tolerance_pct, deadline, price_ceiling_usd)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        [user["id"], body.product_id, Json(body.spec), body.grade, body.target_quantity_t,
         body.market_id, body.incoterm, body.maq_t, body.tolerance_pct, body.deadline,
         body.price_ceiling_usd],
    )
    row = await fetch_one(RFQ_SELECT + " WHERE r.id = %s", [new["id"]])
    return {"ok": True, "rfq": row}


@router.get("/{rfq_id}")
async def get_rfq(rfq_id: UUID, user: dict = Depends(require_perm("rfq", "read"))):
    row = await fetch_one(RFQ_SELECT + " WHERE r.id = %s", [rfq_id])
    if not row:
        raise HTTPException(status_code=404, detail="RFQ topilmadi")
    return {"ok": True, "rfq": row}


@router.patch("/{rfq_id}")
async def update_rfq(rfq_id: UUID, body: RfqUpdate, user: dict = Depends(require_perm("rfq", "update"))):
    rfq = await fetch_one("SELECT importer_id FROM rfq WHERE id = %s", [rfq_id])
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ topilmadi")
    if user["role"] != "super_admin" and str(rfq["importer_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Bu RFQ sizniki emas")

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="O'zgartirish uchun maydon yo'q")
    sets, params = [], []
    for k, v in fields.items():
        sets.append(f"{k} = %s")
        params.append(v)
    params.append(rfq_id)
    row = await fetch_one(f"UPDATE rfq SET {', '.join(sets)} WHERE id = %s RETURNING *", params)
    return {"ok": True, "rfq": row}


@router.delete("/{rfq_id}")
async def delete_rfq(rfq_id: UUID, user: dict = Depends(require_perm("rfq", "delete"))):
    rfq = await fetch_one("SELECT importer_id FROM rfq WHERE id = %s", [rfq_id])
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ topilmadi")
    if user["role"] != "super_admin" and str(rfq["importer_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Bu RFQ sizniki emas")
    await fetch_one("DELETE FROM rfq WHERE id = %s RETURNING id", [rfq_id])
    return {"ok": True, "deleted": str(rfq_id)}
