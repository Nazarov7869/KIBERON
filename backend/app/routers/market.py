# =====================================================================
#  BOZOR TAHLILI MARSHRUTI — narx tickeri + OHLC shamlar (trading grafik)
#  Ma'lumot: price_history (demo generatsiya yoki UZEX/stat.uz CSV import).
#  Faqat o'qish — barcha kirgan foydalanuvchilar ko'radi.
# =====================================================================
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import fetch_all, fetch_one
from app.security import get_current_user

router = APIRouter()

# real manba ustuvorligi (bo'lsa demo o'rniga ishlatiladi)
_SOURCE_RANK = "CASE source WHEN 'uzex' THEN 4 WHEN 'stat' THEN 3 WHEN 'manual' THEN 2 ELSE 1 END"


async def _best_source(product_id) -> str | None:
    row = await fetch_one(
        f"""SELECT source FROM price_history WHERE product_id = %s
            GROUP BY source ORDER BY {_SOURCE_RANK} DESC, MAX(ts) DESC LIMIT 1""",
        [product_id],
    )
    return row["source"] if row else None


@router.get("/summary")
async def market_summary(user: dict = Depends(get_current_user)):
    """Har mahsulot bo'yicha: oxirgi narx, o'zgarish %, 30-kunlik yuqori/past, hajm."""
    rows = await fetch_all(
        f"""
        WITH ranked AS (
          SELECT product_id, ts, open, high, low, close, volume, source,
                 ROW_NUMBER() OVER (
                   PARTITION BY product_id
                   ORDER BY {_SOURCE_RANK} DESC, ts DESC
                 ) AS rn
          FROM price_history
        ),
        w30 AS (
          SELECT product_id, MAX(high) AS hi30, MIN(low) AS lo30, AVG(volume) AS avgvol
          FROM ranked WHERE rn <= 30 GROUP BY product_id
        )
        SELECT p.id, p.name, p.hs_code, p.kind,
               a.close AS last_close, a.volume AS last_volume, a.ts AS last_ts, a.source AS source,
               b.close AS prev_close,
               w30.hi30 AS high_30d, w30.lo30 AS low_30d, w30.avgvol AS avg_volume_30d
        FROM product p
        LEFT JOIN ranked a  ON a.product_id = p.id AND a.rn = 1
        LEFT JOIN ranked b  ON b.product_id = p.id AND b.rn = 2
        LEFT JOIN w30       ON w30.product_id = p.id
        ORDER BY p.name
        """
    )
    out = []
    for r in rows:
        last = r["last_close"]
        prev = r["prev_close"]
        change_abs = None
        change_pct = None
        if last is not None and prev not in (None, 0):
            change_abs = round(float(last) - float(prev), 2)
            change_pct = round((float(last) - float(prev)) / float(prev) * 100, 2)
        out.append({
            "product_id": r["id"],
            "name": r["name"],
            "hs_code": r["hs_code"],
            "kind": r["kind"],
            "last": round(float(last), 2) if last is not None else None,
            "prev": round(float(prev), 2) if prev is not None else None,
            "change_abs": change_abs,
            "change_pct": change_pct,
            "high_30d": round(float(r["high_30d"]), 2) if r["high_30d"] is not None else None,
            "low_30d": round(float(r["low_30d"]), 2) if r["low_30d"] is not None else None,
            "volume": round(float(r["last_volume"]), 1) if r["last_volume"] is not None else None,
            "avg_volume_30d": round(float(r["avg_volume_30d"]), 1) if r["avg_volume_30d"] is not None else None,
            "last_ts": r["last_ts"],
            "source": r["source"],
        })
    return {"ok": True, "count": len(out), "currency": "USD", "unit": "tonna", "items": out}


@router.get("/candles")
async def market_candles(
    user: dict = Depends(get_current_user),
    product_id: str = Query(..., description="Mahsulot ID"),
    limit: int = Query(120, ge=5, le=1000),
    source: str | None = Query(None, description="demo|uzex|stat|manual (bo'sh -> eng yaxshisi)"),
):
    """Tanlangan mahsulot uchun OHLC shamlar (o'sish tartibida)."""
    if not await fetch_one("SELECT 1 FROM product WHERE id = %s", [product_id]):
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    src = source or await _best_source(product_id)
    if not src:
        return {"ok": True, "product_id": product_id, "source": None, "count": 0, "candles": []}

    rows = await fetch_all(
        """SELECT ts, open, high, low, close, volume FROM (
             SELECT ts, open, high, low, close, volume
             FROM price_history
             WHERE product_id = %s AND source = %s
             ORDER BY ts DESC LIMIT %s
           ) ORDER BY ts ASC""",
        [product_id, src, limit],
    )
    candles = [{
        "t": r["ts"],
        "o": round(float(r["open"]), 2),
        "h": round(float(r["high"]), 2),
        "l": round(float(r["low"]), 2),
        "c": round(float(r["close"]), 2),
        "v": round(float(r["volume"]), 1),
    } for r in rows]
    return {"ok": True, "product_id": product_id, "source": src, "count": len(candles), "candles": candles}
