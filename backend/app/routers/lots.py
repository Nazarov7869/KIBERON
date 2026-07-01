# =====================================================================
#  LOT MARSHRUTI (taklif tomoni) — eksportyor mahsulot e'lon qiladi
# =====================================================================
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one, Json
from app.security import get_current_user
from app.permissions import require_perm
from app.schemas import LotCreate, LotUpdate, QualityUpdate

router = APIRouter()

LOT_SELECT = """
  SELECT l.*, p.name AS product_name, p.hs_code,
         c.name AS company_name, c.region AS company_region,
         w.name AS warehouse_name, i.name AS inspector_name
  FROM lot l
  JOIN product p ON p.id = l.product_id
  JOIN company c ON c.id = l.company_id
  LEFT JOIN warehouse w ON w.id = l.warehouse_id
  LEFT JOIN app_user i ON i.id = l.inspector_id
"""


@router.get("")
async def list_lots(
    user: dict = Depends(require_perm("lot", "read")),
    product_id: Optional[UUID] = None,
    status: str = "complete",
    region: Optional[str] = None,
    quality_status: Optional[str] = None,
):
    """Mavjud lotlarni ko'rish (standart: 'complete' — yangi, ochiq)."""
    sql = LOT_SELECT + " WHERE l.status = %s"
    params: list = [status]
    if product_id:
        sql += " AND l.product_id = %s"
        params.append(product_id)
    if region:
        sql += " AND c.region ILIKE %s"
        params.append(region)
    if quality_status:
        sql += " AND l.quality_status = %s"
        params.append(quality_status)
    sql += " ORDER BY l.created_at DESC"
    rows = await fetch_all(sql, params)
    return {"ok": True, "count": len(rows), "lots": rows}


@router.get("/mine")
async def my_lots(user: dict = Depends(get_current_user)):
    if user["role"] != "exporter":
        raise HTTPException(status_code=403, detail="Faqat eksportyor uchun")
    rows = await fetch_all(
        LOT_SELECT + " WHERE l.company_id = %s ORDER BY l.created_at DESC",
        [user["company_id"]],
    )
    return {"ok": True, "count": len(rows), "lots": rows}


@router.post("", status_code=201)
async def create_lot(body: LotCreate, user: dict = Depends(require_perm("lot", "create"))):
    if not user["company_id"]:
        raise HTTPException(status_code=400, detail="Foydalanuvchiga korxona biriktirilmagan")
    if not await fetch_one("SELECT 1 FROM product WHERE id = %s", [body.product_id]):
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    if body.warehouse_id and not await fetch_one("SELECT 1 FROM warehouse WHERE id = %s", [body.warehouse_id]):
        raise HTTPException(status_code=404, detail="Ombor topilmadi")
    new = await fetch_one(
        """INSERT INTO lot (company_id, product_id, warehouse_id, spec, grade,
                            quantity_t, price_per_ton, origin)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        [user["company_id"], body.product_id, body.warehouse_id, Json(body.spec),
         body.grade, body.quantity_t, body.price_per_ton, body.origin],
    )
    row = await fetch_one(LOT_SELECT + " WHERE l.id = %s", [new["id"]])
    return {"ok": True, "lot": row}


@router.get("/{lot_id}")
async def get_lot(lot_id: UUID, user: dict = Depends(require_perm("lot", "read"))):
    row = await fetch_one(LOT_SELECT + " WHERE l.id = %s", [lot_id])
    if not row:
        raise HTTPException(status_code=404, detail="Lot topilmadi")
    return {"ok": True, "lot": row}


@router.patch("/{lot_id}")
async def update_lot(lot_id: UUID, body: LotUpdate, user: dict = Depends(require_perm("lot", "update"))):
    lot = await fetch_one("SELECT company_id FROM lot WHERE id = %s", [lot_id])
    if not lot:
        raise HTTPException(status_code=404, detail="Lot topilmadi")
    if user["role"] != "super_admin" and str(lot["company_id"]) != str(user["company_id"]):
        raise HTTPException(status_code=403, detail="Bu lot sizniki emas")

    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="O'zgartirish uchun maydon yo'q")
    sets, params = [], []
    for k, v in fields.items():
        sets.append(f"{k} = %s")
        params.append(Json(v) if k == "spec" else v)
    params.append(lot_id)
    row = await fetch_one(f"UPDATE lot SET {', '.join(sets)} WHERE id = %s RETURNING *", params)
    return {"ok": True, "lot": row}


@router.patch("/{lot_id}/quality")
async def set_quality(lot_id: UUID, body: QualityUpdate, user: dict = Depends(require_perm("lot", "quality"))):
    """Ombor sifat nazorati — lotni 'passed' yoki 'rejected' deb belgilaydi.
    Bu pooling ballidagi sifat omiliga (passed=1.0 / pending=0.5 / rejected=0.0) ta'sir qiladi."""
    lot = await fetch_one("SELECT id FROM lot WHERE id = %s", [lot_id])
    if not lot:
        raise HTTPException(status_code=404, detail="Lot topilmadi")
    lab = Json(body.lab_result) if body.lab_result is not None else None
    row = await fetch_one(
        """UPDATE lot
           SET quality_status = %s, inspector_id = %s, lab_result = COALESCE(%s, lab_result)
           WHERE id = %s RETURNING *""",
        [body.status, user["id"], lab, lot_id],
    )
    full = await fetch_one(LOT_SELECT + " WHERE l.id = %s", [lot_id])
    return {"ok": True, "quality_status": row["quality_status"], "lot": full}


@router.delete("/{lot_id}")
async def delete_lot(lot_id: UUID, user: dict = Depends(require_perm("lot", "delete"))):
    lot = await fetch_one("SELECT company_id FROM lot WHERE id = %s", [lot_id])
    if not lot:
        raise HTTPException(status_code=404, detail="Lot topilmadi")
    if user["role"] != "super_admin" and str(lot["company_id"]) != str(user["company_id"]):
        raise HTTPException(status_code=403, detail="Bu lot sizniki emas")
    await fetch_one("DELETE FROM lot WHERE id = %s RETURNING id", [lot_id])
    return {"ok": True, "deleted": str(lot_id)}
