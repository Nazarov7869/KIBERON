# =====================================================================
#  KATALOG MARSHRUTI (faqat o'qish — ulanish ishlashini ko'rsatadi)
#  To'liq entity API'lar 5-qadamda; bu yerda baza o'qilishini tasdiqlaymiz.
# =====================================================================
from fastapi import APIRouter

from app.db import fetch_all

router = APIRouter()


@router.get("/products")
async def products():
    rows = await fetch_all(
        """SELECT id, name, hs_code, kind, storage_class, food_grade, avg_price_usd_ton
           FROM product ORDER BY kind, name"""
    )
    return {"ok": True, "count": len(rows), "products": rows}


@router.get("/markets")
async def markets():
    rows = await fetch_all(
        """SELECT m.id, m.country, m.tariff_pct, c.name AS corridor, c.transit_days
           FROM market m LEFT JOIN corridor c ON c.id = m.corridor_id
           ORDER BY m.country"""
    )
    return {"ok": True, "count": len(rows), "markets": rows}


@router.get("/access")
async def access(hs: str | None = None, market: str | None = None):
    """Svetofor — bozorga kirish (baza darvozasi).
    HS kodi berilsa: avval 4-belgi (0813), keyin 2-belgi (08) — eng aniq mos.
    """
    if hs:
        ch4, ch2 = hs[:4], hs[:2]
        sql = """SELECT a.hs_chapter, m.country, a.status, a.reason
                 FROM market_access a JOIN market m ON m.id = a.market_id
                 WHERE a.hs_chapter IN (%s, %s)"""
        params: list = [ch4, ch2]
        if market:
            sql += " AND m.country ILIKE %s"
            params.append(market)
        rows = await fetch_all(sql, params)
        # har bozor uchun eng aniq (uzun) mos qoidani saqlaymiz
        best: dict = {}
        for r in rows:
            cur = best.get(r["country"])
            if cur is None or len(r["hs_chapter"]) > len(cur["hs_chapter"]):
                best[r["country"]] = r
        acc = sorted(best.values(), key=lambda x: x["country"])
        return {"ok": True, "resolvedFrom": {"ch4": ch4, "ch2": ch2}, "count": len(acc), "access": acc}

    # hs berilmasa: hammasi (ixtiyoriy bozor filtri)
    sql = """SELECT a.hs_chapter, m.country, a.status, a.reason
             FROM market_access a JOIN market m ON m.id = a.market_id"""
    params = []
    if market:
        sql += " WHERE m.country ILIKE %s"
        params.append(market)
    sql += " ORDER BY a.hs_chapter, m.country"
    rows = await fetch_all(sql, params or None)
    return {"ok": True, "count": len(rows), "access": rows}


@router.get("/summary")
async def summary():
    rows = await fetch_all(
        """SELECT
            (SELECT count(*) FROM product)            AS products,
            (SELECT count(*) FROM market)             AS markets,
            (SELECT count(*) FROM corridor)           AS corridors,
            (SELECT count(*) FROM warehouse)          AS warehouses,
            (SELECT count(*) FROM logistics_provider) AS providers,
            (SELECT count(*) FROM certification)      AS certifications,
            (SELECT count(*) FROM price_ref)          AS price_refs"""
    )
    return {"ok": True, "summary": rows[0]}
