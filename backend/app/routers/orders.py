# =====================================================================
#  BUYURTMA MARSHRUTI (7-qadam) — pul harakati / ishonch qatlami
#  matched pool -> order(draft) -> confirm(escrow held)
#  -> ship(avans chiqadi) -> deliver(balans + komissiya)
#  Barcha pul mantig'i deterministik (app/settlement.py). AI YO'Q.
# =====================================================================
import uuid as _uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.db import fetch_all, fetch_one, pool as dbpool, dict_row
from app.security import get_current_user
from app.permissions import require_perm
from app.schemas import OrderCreate, ShipCreate
from app import settlement

router = APIRouter()

ORDER_SELECT = """
  SELECT o.*, pr.name AS product_name, u.name AS importer_name,
         e.status AS escrow_state, e.total_usd AS escrow_total
  FROM export_order o
  LEFT JOIN pool p ON p.id = o.pool_id
  LEFT JOIN product pr ON pr.id = p.product_id
  LEFT JOIN app_user u ON u.id = o.importer_id
  LEFT JOIN escrow e ON e.order_id = o.id
"""


async def _contributors(pool_id, target: float) -> list[dict]:
    rows = await fetch_all(
        """SELECT e.company_id, c.name AS company_name, e.share_pct, l.price_per_ton
           FROM pool_entry e JOIN company c ON c.id = e.company_id JOIN lot l ON l.id = e.lot_id
           WHERE e.pool_id = %s AND e.status = 'accepted'
           ORDER BY e.rank NULLS LAST""",
        [pool_id],
    )
    out = []
    for r in rows:
        allocated = round(float(r["share_pct"]) / 100.0 * target, 3)
        out.append({
            "company_id": r["company_id"],
            "company_name": r["company_name"],
            "allocated_qty": allocated,
            "price": float(r["price_per_ton"]),
        })
    return out


async def _load_order(order_id):
    o = await fetch_one(ORDER_SELECT + " WHERE o.id = %s", [order_id])
    if not o:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")
    return o


# ---------------------------------------------------------------- create
@router.post("", status_code=201)
async def create_order(body: OrderCreate, user: dict = Depends(require_perm("order", "create"))):
    p = await fetch_one(
        "SELECT id, rfq_id, target_qty_t, status FROM pool WHERE id = %s", [body.pool_id]
    )
    if not p:
        raise HTTPException(status_code=404, detail="Pool topilmadi")
    if p["status"] != "matched":
        raise HTTPException(status_code=409, detail=f"Pool '{p['status']}' — avval taqsimlanishi (matched) kerak")
    if not p["rfq_id"]:
        raise HTTPException(status_code=422, detail="Pool RFQ'ga bog'lanmagan — buyurtma uchun importyor kerak")
    rfq = await fetch_one("SELECT importer_id, incoterm FROM rfq WHERE id = %s", [p["rfq_id"]])
    importer_id = rfq["importer_id"]
    if user["role"] == "importer" and str(importer_id) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Bu pool sizning RFQ'ngizga tegishli emas")
    if await fetch_one("SELECT 1 FROM export_order WHERE pool_id = %s", [body.pool_id]):
        raise HTTPException(status_code=409, detail="Bu poolga buyurtma allaqachon yaratilgan")

    contributors = await _contributors(body.pool_id, float(p["target_qty_t"]))
    if not contributors:
        raise HTTPException(status_code=422, detail="Poolда qabul qilingan hissador yo'q")

    advance_pct = body.advance_pct if body.advance_pct is not None else 30.0
    commission_pct = body.commission_pct if body.commission_pct is not None else 1.0
    calc = settlement.compute(contributors, commission_pct, advance_pct)

    op = await fetch_one("SELECT id FROM operator LIMIT 1")
    operator_id = op["id"] if op else None
    tracking = "IPK-" + _uuid.uuid4().hex[:6].upper()
    incoterm = body.incoterm or rfq["incoterm"]

    new = await fetch_one(
        """INSERT INTO export_order
             (pool_id, importer_id, operator_id, incoterm, transport_mode, container_type,
              total_value_usd, advance_pct, commission_pct, escrow_status, status, tracking_code)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'none', 'draft', %s)
           RETURNING id""",
        [body.pool_id, importer_id, operator_id, incoterm, body.transport_mode, body.container_type,
         calc["total_gross_usd"], advance_pct, commission_pct, tracking],
    )
    o = await _load_order(new["id"])
    return {"ok": True, "order": o, "breakdown": calc}


# ------------------------------------------------------------------ list
@router.get("")
async def list_orders(user: dict = Depends(require_perm("order", "read")), status: str | None = None):
    role = user["role"]
    where, params = [], []
    if role == "importer":
        where.append("o.importer_id = %s")
        params.append(user["id"])
    elif role == "exporter":
        where.append("""o.pool_id IN (
            SELECT e.pool_id FROM pool_entry e WHERE e.company_id = %s AND e.status = 'accepted')""")
        params.append(user["company_id"])
    elif role in ("super_admin", "logistics"):
        pass  # hammasi
    else:
        return {"ok": True, "count": 0, "orders": []}
    if status:
        where.append("o.status = %s")
        params.append(status)
    sql = ORDER_SELECT + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY o.created_at DESC"
    rows = await fetch_all(sql, params)
    return {"ok": True, "count": len(rows), "orders": rows}


# ---------------------------------------------------------------- detail
@router.get("/{order_id}")
async def get_order(order_id: UUID, user: dict = Depends(get_current_user)):
    o = await _load_order(order_id)
    # kirish nazorati
    role = user["role"]
    if role in ("super_admin", "logistics"):
        pass
    elif role == "importer" and str(o["importer_id"]) == str(user["id"]):
        pass
    elif role == "exporter":
        part = await fetch_one(
            "SELECT 1 FROM pool_entry WHERE pool_id = %s AND company_id = %s AND status = 'accepted'",
            [o["pool_id"], user["company_id"]],
        )
        if not part:
            raise HTTPException(status_code=403, detail="Bu buyurtmaga ruxsatingiz yo'q")
    else:
        raise HTTPException(status_code=403, detail="Bu buyurtmaga ruxsatingiz yo'q")

    shipments = await fetch_all(
        """SELECT s.*, lp.name AS provider_name, cor.name AS corridor_name
           FROM shipment s LEFT JOIN logistics_provider lp ON lp.id = s.provider_id
           LEFT JOIN corridor cor ON cor.id = s.corridor_id
           WHERE s.order_id = %s ORDER BY s.created_at""",
        [order_id],
    )
    payouts = await fetch_all(
        """SELECT p.*, c.name AS company_name FROM payout p
           LEFT JOIN company c ON c.id = p.company_id
           WHERE p.order_id = %s ORDER BY p.stage, p.paid_at""",
        [order_id],
    )
    return {"ok": True, "order": o, "shipments": shipments, "payouts": payouts}


# --------------------------------------------------------------- confirm
@router.post("/{order_id}/confirm")
async def confirm_order(order_id: UUID, user: dict = Depends(require_perm("order", "confirm"))):
    o = await _load_order(order_id)
    if user["role"] == "importer" and str(o["importer_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Bu buyurtma sizniki emas")
    if o["status"] != "draft":
        raise HTTPException(status_code=409, detail=f"Buyurtma '{o['status']}' — faqat 'draft' tasdiqlanadi")

    total = float(o["total_value_usd"] or 0)
    async with dbpool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                await cur.execute(
                    "INSERT INTO escrow (order_id, total_usd, status) VALUES (%s, %s, 'held')",
                    [order_id, total],
                )
                await cur.execute(
                    "UPDATE export_order SET status = 'confirmed', escrow_status = 'held' WHERE id = %s",
                    [order_id],
                )
    return {"ok": True, "order_id": str(order_id), "status": "confirmed",
            "escrow_status": "held", "escrow_total_usd": round(total, 2),
            "message": "Importyor pulni escrowga qo'ydi (held)"}


# ------------------------------------------------------------------ ship
@router.post("/{order_id}/ship")
async def ship_order(order_id: UUID, body: ShipCreate, user: dict = Depends(require_perm("order", "ship"))):
    o = await _load_order(order_id)
    if o["status"] != "confirmed":
        raise HTTPException(status_code=409, detail=f"Buyurtma '{o['status']}' — avval 'confirmed' (escrow) bo'lishi kerak")
    if body.provider_id and not await fetch_one("SELECT 1 FROM logistics_provider WHERE id = %s", [body.provider_id]):
        raise HTTPException(status_code=404, detail="Logistika provayderi topilmadi")
    if body.corridor_id and not await fetch_one("SELECT 1 FROM corridor WHERE id = %s", [body.corridor_id]):
        raise HTTPException(status_code=404, detail="Koridor topilmadi")

    # avans hisobi
    pinfo = await fetch_one("SELECT target_qty_t FROM pool WHERE id = %s", [o["pool_id"]])
    contributors = await _contributors(o["pool_id"], float(pinfo["target_qty_t"]))
    calc = settlement.compute(contributors, float(o["commission_pct"]), float(o["advance_pct"]))

    async with dbpool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """INSERT INTO shipment (order_id, warehouse_id, corridor_id, provider_id,
                                            container_type, departure_date, status)
                       VALUES (%s, %s, %s, %s, %s, %s, 'in_transit') RETURNING id""",
                    [order_id, body.warehouse_id, body.corridor_id, body.provider_id,
                     body.container_type, body.departure_date],
                )
                for c in calc["contributors"]:
                    await cur.execute(
                        """INSERT INTO payout (order_id, company_id, amount_usd, currency, stage, paid_at)
                           VALUES (%s, %s, %s, 'USD', 'advance', now())""",
                        [order_id, c["company_id"], c["advance_usd"]],
                    )
                await cur.execute(
                    "UPDATE export_order SET status = 'in_transit', escrow_status = 'advance_released' WHERE id = %s",
                    [order_id],
                )
                await cur.execute("UPDATE escrow SET status = 'advance_released' WHERE order_id = %s", [order_id])
    return {"ok": True, "order_id": str(order_id), "status": "in_transit",
            "escrow_status": "advance_released",
            "advance_released_usd": calc["total_advance_usd"],
            "advance_pct": float(o["advance_pct"]),
            "message": "Jo'natma yo'lda — avans eksportyorlarga chiqarildi"}


# --------------------------------------------------------------- deliver
@router.post("/{order_id}/deliver")
async def deliver_order(order_id: UUID, user: dict = Depends(require_perm("order", "deliver"))):
    o = await _load_order(order_id)
    if o["status"] != "in_transit":
        raise HTTPException(status_code=409, detail=f"Buyurtma '{o['status']}' — avval 'in_transit' bo'lishi kerak")

    pinfo = await fetch_one("SELECT target_qty_t FROM pool WHERE id = %s", [o["pool_id"]])
    contributors = await _contributors(o["pool_id"], float(pinfo["target_qty_t"]))
    calc = settlement.compute(contributors, float(o["commission_pct"]), float(o["advance_pct"]))

    async with dbpool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                await cur.execute("UPDATE shipment SET status = 'delivered' WHERE order_id = %s", [order_id])
                for c in calc["contributors"]:
                    await cur.execute(
                        """INSERT INTO payout (order_id, company_id, amount_usd, currency, stage, paid_at)
                           VALUES (%s, %s, %s, 'USD', 'balance', now())""",
                        [order_id, c["company_id"], c["balance_usd"]],
                    )
                # operator komissiyasi (company_id yo'q)
                await cur.execute(
                    """INSERT INTO payout (order_id, company_id, amount_usd, currency, stage, paid_at)
                       VALUES (%s, NULL, %s, 'USD', 'commission', now())""",
                    [order_id, calc["total_commission_usd"]],
                )
                await cur.execute(
                    "UPDATE export_order SET status = 'delivered', escrow_status = 'closed' WHERE id = %s",
                    [order_id],
                )
                await cur.execute("UPDATE escrow SET status = 'closed' WHERE order_id = %s", [order_id])
    return {"ok": True, "order_id": str(order_id), "status": "delivered",
            "escrow_status": "closed",
            "balance_released_usd": calc["total_balance_usd"],
            "commission_usd": calc["total_commission_usd"],
            "message": "Yetkazildi — balans chiqarildi, komissiya olindi, escrow yopildi"}


# ---------------------------------------------------------------- cancel
@router.post("/{order_id}/cancel")
async def cancel_order(order_id: UUID, user: dict = Depends(require_perm("order", "cancel"))):
    o = await _load_order(order_id)
    if user["role"] == "importer" and str(o["importer_id"]) != str(user["id"]):
        raise HTTPException(status_code=403, detail="Bu buyurtma sizniki emas")
    if o["status"] not in ("draft", "confirmed"):
        raise HTTPException(status_code=409, detail=f"Buyurtma '{o['status']}' — bekor qilib bo'lmaydi (avans chiqqan)")

    refunded = False
    async with dbpool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                if o["escrow_state"] == "held":
                    await cur.execute("UPDATE escrow SET status = 'refunded' WHERE order_id = %s", [order_id])
                    refunded = True
                new_escrow = "refunded" if refunded else "none"
                await cur.execute(
                    "UPDATE export_order SET status = 'cancelled', escrow_status = %s WHERE id = %s",
                    [new_escrow, order_id],
                )
    return {"ok": True, "order_id": str(order_id), "status": "cancelled",
            "refunded": refunded,
            "message": "Buyurtma bekor qilindi" + (" — pul importyorga qaytarildi" if refunded else "")}
