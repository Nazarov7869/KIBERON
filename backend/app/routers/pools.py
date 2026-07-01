# =====================================================================
#  POOL MARSHRUTI (yig'ish bozori) — loyihaning yuragi
#  Eksportyorlar lotlarini qo'shadi -> konteyner to'ladi -> dvigatel
#  ballga ko'ra taqsimlaydi, clearing narx hisoblaydi.
# =====================================================================
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one, pool as dbpool, Json
from app.security import get_current_user
from app.permissions import require_perm
from app.schemas import PoolCreate, PoolEntryCreate
from app.pooling import entry_score, allocate

router = APIRouter()

POOL_SELECT = """
  SELECT p.*, pr.name AS product_name, pr.hs_code,
         (SELECT count(*) FROM pool_entry e WHERE e.pool_id = p.id) AS entry_count,
         COALESCE((SELECT sum(e.quantity_t) FROM pool_entry e WHERE e.pool_id = p.id), 0) AS offered_t
  FROM pool p
  JOIN product pr ON pr.id = p.product_id
"""


def _fnum(v):
    return float(v) if v is not None else None


# ---------------------------------------------------------------- list
@router.get("")
async def list_pools(
    user: dict = Depends(require_perm("pool", "read")),
    product_id: Optional[UUID] = None,
    status: str = "forming",
):
    sql = POOL_SELECT + " WHERE p.status = %s"
    params: list = [status]
    if product_id:
        sql += " AND p.product_id = %s"
        params.append(product_id)
    sql += " ORDER BY p.created_at DESC"
    rows = await fetch_all(sql, params)
    for r in rows:
        r["remaining_t"] = round(float(r["target_qty_t"]) - float(r["offered_t"]), 3)
    return {"ok": True, "count": len(rows), "pools": rows}


# -------------------------------------------------------------- detail
async def _entries(pool_id) -> list[dict]:
    return await fetch_all(
        """SELECT e.*, c.name AS company_name, c.rating AS company_rating,
                  l.price_per_ton, l.quality_status, l.grade AS lot_grade,
                  l.quantity_t AS lot_qty, l.warehouse_id
           FROM pool_entry e
           JOIN company c ON c.id = e.company_id
           JOIN lot l ON l.id = e.lot_id
           WHERE e.pool_id = %s
           ORDER BY e.rank NULLS LAST, e.created_at""",
        [pool_id],
    )


@router.get("/{pool_id}")
async def get_pool(pool_id: UUID, user: dict = Depends(require_perm("pool", "read"))):
    p = await fetch_one(POOL_SELECT + " WHERE p.id = %s", [pool_id])
    if not p:
        raise HTTPException(status_code=404, detail="Pool topilmadi")
    p["remaining_t"] = round(float(p["target_qty_t"]) - float(p["offered_t"]), 3)
    return {"ok": True, "pool": p, "entries": await _entries(pool_id)}


# -------------------------------------------------------------- create
@router.post("", status_code=201)
async def create_pool(body: PoolCreate, user: dict = Depends(require_perm("pool", "create"))):
    if not await fetch_one("SELECT 1 FROM product WHERE id = %s", [body.product_id]):
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    # importyor faqat o'z RFQ'siga pool ochishi mumkin
    if body.rfq_id:
        rfq = await fetch_one("SELECT importer_id FROM rfq WHERE id = %s", [body.rfq_id])
        if not rfq:
            raise HTTPException(status_code=404, detail="RFQ topilmadi")
        if user["role"] == "importer" and str(rfq["importer_id"]) != str(user["id"]):
            raise HTTPException(status_code=403, detail="Bu RFQ sizniki emas")

    new = await fetch_one(
        """INSERT INTO pool (rfq_id, product_id, spec, grade, target_qty_t, deadline, forward,
                            newcomer_quota_pct, score_weights)
           VALUES (%s, %s, %s, %s, %s, %s, %s,
                   COALESCE(%s, 15),
                   COALESCE(%s, '{"quality":0.4,"rating":0.3,"price":0.2,"distance":0.1}'::jsonb))
           RETURNING id""",
        [body.rfq_id, body.product_id, Json(body.spec), body.grade, body.target_qty_t,
         body.deadline, body.forward, body.newcomer_quota_pct,
         Json(body.score_weights) if body.score_weights is not None else None],
    )
    p = await fetch_one(POOL_SELECT + " WHERE p.id = %s", [new["id"]])
    p["remaining_t"] = round(float(p["target_qty_t"]) - float(p["offered_t"]), 3)
    return {"ok": True, "pool": p}


# --------------------------------------------------------- add entry
@router.post("/{pool_id}/entries", status_code=201)
async def add_entry(pool_id: UUID, body: PoolEntryCreate, user: dict = Depends(require_perm("pool", "enter"))):
    p = await fetch_one("SELECT id, product_id, status FROM pool WHERE id = %s", [pool_id])
    if not p:
        raise HTTPException(status_code=404, detail="Pool topilmadi")
    if p["status"] != "forming":
        raise HTTPException(status_code=409, detail="Pool yopiq — yangi lot qo'shib bo'lmaydi")

    lot = await fetch_one(
        "SELECT id, company_id, product_id, quantity_t, price_per_ton, warehouse_id FROM lot WHERE id = %s",
        [body.lot_id],
    )
    if not lot:
        raise HTTPException(status_code=404, detail="Lot topilmadi")
    if str(lot["company_id"]) != str(user["company_id"]):
        raise HTTPException(status_code=403, detail="Bu lot sizniki emas")
    if str(lot["product_id"]) != str(p["product_id"]):
        raise HTTPException(status_code=422, detail="Lot mahsuloti pool mahsulotiga mos emas")
    if lot["price_per_ton"] is None:
        raise HTTPException(status_code=422, detail="Lotda narx (price_per_ton) ko'rsatilmagan — pool uchun majburiy")
    if body.quantity_t > float(lot["quantity_t"]):
        raise HTTPException(status_code=422, detail="Hajm lot hajmidan oshib ketdi")
    if await fetch_one("SELECT 1 FROM pool_entry WHERE pool_id = %s AND lot_id = %s", [pool_id, body.lot_id]):
        raise HTTPException(status_code=409, detail="Bu lot allaqachon poolда")

    commitment = "warehoused" if lot["warehouse_id"] else "claimed"
    async with dbpool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                await cur.execute(
                    """INSERT INTO pool_entry (pool_id, company_id, lot_id, quantity_t, commitment)
                       VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                    [pool_id, lot["company_id"], body.lot_id, body.quantity_t, commitment],
                )
                await cur.execute("UPDATE lot SET status = 'pooling' WHERE id = %s", [body.lot_id])

    p2 = await fetch_one(POOL_SELECT + " WHERE p.id = %s", [pool_id])
    return {
        "ok": True,
        "pool_id": str(pool_id),
        "target_qty_t": float(p2["target_qty_t"]),
        "offered_t": float(p2["offered_t"]),
        "remaining_t": round(float(p2["target_qty_t"]) - float(p2["offered_t"]), 3),
        "entry_count": int(p2["entry_count"]),
    }


# ---------------------------------------------------- withdraw entry
@router.delete("/{pool_id}/entries/{entry_id}")
async def withdraw_entry(pool_id: UUID, entry_id: UUID, user: dict = Depends(get_current_user)):
    e = await fetch_one(
        "SELECT e.id, e.company_id, e.lot_id, p.status AS pool_status FROM pool_entry e JOIN pool p ON p.id = e.pool_id WHERE e.id = %s AND e.pool_id = %s",
        [entry_id, pool_id],
    )
    if not e:
        raise HTTPException(status_code=404, detail="Yozuv topilmadi")
    if user["role"] != "super_admin" and str(e["company_id"]) != str(user["company_id"]):
        raise HTTPException(status_code=403, detail="Bu yozuv sizniki emas")
    if e["pool_status"] != "forming":
        raise HTTPException(status_code=409, detail="Pool yopiq — yozuvni olib bo'lmaydi")

    async with dbpool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                await cur.execute("DELETE FROM pool_entry WHERE id = %s", [entry_id])
                # lotda boshqa faol yozuv qolmasa — 'complete' ga qaytarish
                await cur.execute(
                    "SELECT count(*) AS n FROM pool_entry WHERE lot_id = %s", [e["lot_id"]]
                )
                row = await cur.fetchone()
                if row[0] == 0:
                    await cur.execute("UPDATE lot SET status = 'complete' WHERE id = %s", [e["lot_id"]])
    return {"ok": True, "withdrawn": str(entry_id)}


# --------------------------------------------------------- ALLOCATE
@router.post("/{pool_id}/allocate")
async def allocate_pool(pool_id: UUID, user: dict = Depends(require_perm("pool", "allocate"))):
    p = await fetch_one(
        "SELECT id, rfq_id, target_qty_t, newcomer_quota_pct, score_weights, status FROM pool WHERE id = %s",
        [pool_id],
    )
    if not p:
        raise HTTPException(status_code=404, detail="Pool topilmadi")
    # egalik: importyor faqat o'z RFQ'si orqali; aks holda faqat admin
    if user["role"] == "importer":
        if not p["rfq_id"]:
            raise HTTPException(status_code=403, detail="Bu pool sizga bog'liq emas")
        rfq = await fetch_one("SELECT importer_id FROM rfq WHERE id = %s", [p["rfq_id"]])
        if not rfq or str(rfq["importer_id"]) != str(user["id"]):
            raise HTTPException(status_code=403, detail="Bu pool sizga bog'liq emas")
    if p["status"] not in ("forming", "full"):
        raise HTTPException(status_code=409, detail=f"Pool holati '{p['status']}' — taqsimlab bo'lmaydi")

    rows = await _entries(pool_id)
    if not rows:
        raise HTTPException(status_code=422, detail="Poolда yozuv yo'q")

    prices = [float(r["price_per_ton"]) for r in rows]
    mn, mx = min(prices), max(prices)
    weights = p["score_weights"]  # jsonb -> dict
    entries = []
    for r in rows:
        s = entry_score(
            weights,
            quality_status=r["quality_status"],
            grade=r["lot_grade"],
            rating=_fnum(r["company_rating"]) or 0.0,
            price=float(r["price_per_ton"]),
            min_price=mn, max_price=mx,
            warehoused=(r["commitment"] == "warehoused"),
        )
        entries.append({
            "id": r["id"],
            "offered_qty": float(r["quantity_t"]),
            "price": float(r["price_per_ton"]),
            "score": s,
            "is_newcomer": (_fnum(r["company_rating"]) or 0.0) == 0.0,
        })

    res = allocate(float(p["target_qty_t"]), float(p["newcomer_quota_pct"]), entries)

    # natijani yozish — bitta tranzaksiyada
    by_id = {e["id"]: e for e in res["entries"]}
    async with dbpool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                for r in rows:
                    a = by_id[r["id"]]
                    await cur.execute(
                        "UPDATE pool_entry SET share_pct = %s, score = %s, rank = %s, status = %s WHERE id = %s",
                        [a["share_pct"], a["score"], a["rank"], a["status"], r["id"]],
                    )
                    # lot holati: qabul -> matched, rad -> complete
                    new_lot_status = "matched" if a["status"] == "accepted" else "complete"
                    await cur.execute("UPDATE lot SET status = %s WHERE id = %s", [new_lot_status, r["lot_id"]])
                await cur.execute(
                    "UPDATE pool SET filled_qty_t = %s, clearing_price_usd = %s, status = 'matched' WHERE id = %s",
                    [res["filled_qty"], res["clearing_price"], pool_id],
                )

    # boyitilgan natija (kompaniya nomlari bilan)
    name_by_id = {r["id"]: r["company_name"] for r in rows}
    contributors = [
        {**a, "company_name": name_by_id[a["id"]]}
        for a in sorted(res["entries"], key=lambda x: x["rank"])
    ]
    return {
        "ok": True,
        "pool_id": str(pool_id),
        "status": "matched",
        "target_qty_t": float(p["target_qty_t"]),
        "filled_qty_t": res["filled_qty"],
        "fill_pct": res["fill_pct"],
        "clearing_price_usd": res["clearing_price"],
        "total_value_usd": res["total_value"],
        "contributors": contributors,
    }
