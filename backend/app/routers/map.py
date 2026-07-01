# =====================================================================
#  KARTA MARSHRUTI — sputnik karta uchun ma'lumotlar
#  - /me            : foydalanuvchi o'z lokatsiyasini o'qiydi/belgilaydi (majburiy)
#  - /features      : rolga mos nuqtalar (ombor, logistika, bozor, hamkorlar) + koridorlar
#  - /suggestions   : yo'nalish taklifi (eng yaqin ombor + koridor + logistika + marshrut)
#  Barcha kirgan foydalanuvchilar ko'radi; ma'lumot roli bo'yicha filtrlanadi.
# =====================================================================
import json
from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.db import fetch_all, fetch_one
from app.security import get_current_user

router = APIRouter()


def haversine(lat1, lng1, lat2, lng2) -> float:
    """Ikki nuqta orasidagi masofa (km)."""
    if None in (lat1, lng1, lat2, lng2):
        return None
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return round(2 * R * asin(sqrt(a)), 1)


def _wp(v):
    """waypoints/entry_point — list yoki JSON-string bo'lishi mumkin."""
    if v is None:
        return None
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return None
    return v


# --------------------------------------------------------------- MENING LOKATSIYAM
class LocationIn(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    address: str | None = None


@router.get("/me")
async def my_location(user: dict = Depends(get_current_user)):
    row = await fetch_one("SELECT lat, lng, address FROM app_user WHERE id = %s", [user["id"]])
    lat = row["lat"] if row else None
    lng = row["lng"] if row else None
    return {
        "ok": True,
        "role": user["role"],
        "lat": lat,
        "lng": lng,
        "address": row["address"] if row else None,
        "is_set": lat is not None and lng is not None,
    }


@router.put("/me")
async def set_my_location(body: LocationIn, user: dict = Depends(get_current_user)):
    await fetch_one(
        "UPDATE app_user SET lat = %s, lng = %s, address = %s WHERE id = %s RETURNING id",
        [body.lat, body.lng, body.address, user["id"]],
    )
    # eksportyor bo'lsa — korxona lokatsiyasini ham yangilaymiz (xaridorlar ko'radi)
    if user["role"] == "exporter" and user.get("company_id"):
        await fetch_one(
            "UPDATE company SET lat = %s, lng = %s, address = COALESCE(%s, address) WHERE id = %s RETURNING id",
            [body.lat, body.lng, body.address, user["company_id"]],
        )
    return {"ok": True, "lat": body.lat, "lng": body.lng, "address": body.address, "is_set": True}


# --------------------------------------------------------------- XARITADAGI NUQTALAR
async def _warehouses(me):
    rows = await fetch_all(
        """SELECT code, name, lat, lng, region, capacity_free_t,
                  storage_rate_usd_ton_month AS rate, rating, storage_classes
           FROM warehouse WHERE lat IS NOT NULL"""
    )
    out = []
    for r in rows:
        out.append({
            "code": r["code"], "name": r["name"], "lat": r["lat"], "lng": r["lng"],
            "region": r["region"], "capacity_free_t": r["capacity_free_t"],
            "rate": r["rate"], "rating": r["rating"],
            "storage_classes": _wp(r["storage_classes"]) or [],
            "dist_km": haversine(me["lat"], me["lng"], r["lat"], r["lng"]) if me["is_set"] else None,
        })
    if me["is_set"]:
        out.sort(key=lambda x: (x["dist_km"] is None, x["dist_km"]))
    return out


async def _logistics(me):
    rows = await fetch_all(
        """SELECT code, name, lat, lng, hub_city, modes, cold_chain, rating
           FROM logistics_provider WHERE lat IS NOT NULL"""
    )
    out = []
    for r in rows:
        out.append({
            "code": r["code"], "name": r["name"], "lat": r["lat"], "lng": r["lng"],
            "hub_city": r["hub_city"], "modes": _wp(r["modes"]) or [],
            "cold_chain": bool(r["cold_chain"]), "rating": r["rating"],
            "dist_km": haversine(me["lat"], me["lng"], r["lat"], r["lng"]) if me["is_set"] else None,
        })
    return out


async def _markets():
    rows = await fetch_all(
        """SELECT m.id, m.country, m.city, m.lat, m.lng, m.tariff_pct, c.name AS corridor_name,
                  c.transit_days
           FROM market m LEFT JOIN corridor c ON c.id = m.corridor_id
           WHERE m.lat IS NOT NULL ORDER BY m.country"""
    )
    return [dict(r) for r in rows]


async def _corridors():
    rows = await fetch_all(
        """SELECT name, waypoints, entry_point, transit_days,
                  freight_per_feu_min AS fmin, freight_per_feu_max AS fmax FROM corridor"""
    )
    out = []
    for r in rows:
        wp = _wp(r["waypoints"])
        if not wp:
            continue
        out.append({
            "name": r["name"], "waypoints": wp, "entry_point": _wp(r["entry_point"]),
            "transit_days": r["transit_days"], "freight_min": r["fmin"], "freight_max": r["fmax"],
        })
    return out


async def _partners(role, me):
    """Rolga mos ishtirokchilar: sotuvchilar (korxona) va xaridorlar (importyor)."""
    sellers, buyers = [], []
    want_sellers = role in ("importer", "logistics", "warehouse", "super_admin")
    want_buyers = role in ("exporter", "logistics", "embassy", "super_admin")
    if want_sellers:
        rows = await fetch_all(
            """SELECT name, region, lat, lng, (verified_by IS NOT NULL) AS verified
               FROM company WHERE lat IS NOT NULL"""
        )
        sellers = [{
            "type": "seller", "name": r["name"], "region": r["region"],
            "lat": r["lat"], "lng": r["lng"], "verified": bool(r["verified"]),
            "dist_km": haversine(me["lat"], me["lng"], r["lat"], r["lng"]) if me["is_set"] else None,
        } for r in rows]
    if want_buyers:
        rows = await fetch_all(
            """SELECT name, lat, lng FROM app_user
               WHERE role = 'importer' AND lat IS NOT NULL"""
        )
        buyers = [{
            "type": "buyer", "name": r["name"], "lat": r["lat"], "lng": r["lng"],
            "dist_km": haversine(me["lat"], me["lng"], r["lat"], r["lng"]) if me["is_set"] else None,
        } for r in rows]
    return sellers + buyers


@router.get("/features")
async def map_features(user: dict = Depends(get_current_user)):
    me_row = await fetch_one("SELECT lat, lng, address FROM app_user WHERE id = %s", [user["id"]])
    me = {"lat": me_row["lat"], "lng": me_row["lng"], "address": me_row["address"],
          "is_set": me_row["lat"] is not None and me_row["lng"] is not None}
    return {
        "ok": True,
        "role": user["role"],
        "me": me,
        "warehouses": await _warehouses(me),
        "logistics": await _logistics(me),
        "markets": await _markets(),
        "partners": await _partners(user["role"], me),
        "corridors": await _corridors(),
    }


# --------------------------------------------------------------- YO'NALISH TAKLIFI
def _corridor_len_km(entry, waypoints):
    pts = []
    if entry:
        pts.append(entry)
    pts += waypoints
    total = 0.0
    for i in range(1, len(pts)):
        d = haversine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
        if d:
            total += d
    return round(total, 1)


@router.get("/suggestions")
async def route_suggestions(
    user: dict = Depends(get_current_user),
    product_id: str | None = Query(None),
    market_id: str | None = Query(None),
    limit_wh: int = Query(3, ge=1, le=7),
):
    me_row = await fetch_one("SELECT lat, lng FROM app_user WHERE id = %s", [user["id"]])
    if not me_row or me_row["lat"] is None:
        raise HTTPException(status_code=400, detail="Avval o'z manzilingizni kartada belgilang")
    me = {"lat": me_row["lat"], "lng": me_row["lng"], "is_set": True}

    # mahsulot (ombor mosligi uchun)
    product = None
    need_class = None
    if product_id:
        p = await fetch_one("SELECT id, name, storage_class FROM product WHERE id = %s", [product_id])
        if p:
            product = {"id": p["id"], "name": p["name"], "storage_class": p["storage_class"]}
            need_class = p["storage_class"]

    # eng yaqin (mos) omborlar
    whs = await _warehouses(me)
    for w in whs:
        w["suitable"] = (need_class in w["storage_classes"]) if need_class else True
    ranked = sorted(whs, key=lambda x: (not x["suitable"], x["dist_km"] if x["dist_km"] is not None else 9e9))
    nearest = ranked[:limit_wh]

    result = {
        "ok": True,
        "origin": {"lat": me["lat"], "lng": me["lng"]},
        "product": product,
        "nearest_warehouses": nearest,
        "market": None,
        "corridor": None,
        "logistics": [],
        "route": None,
        "summary": None,
    }

    # bozor tanlangan bo'lsa — to'liq marshrut + logistika
    if market_id:
        m = await fetch_one(
            """SELECT m.country, m.city, m.lat, m.lng, m.tariff_pct, m.corridor_id,
                      c.name AS corridor_name, c.waypoints, c.entry_point, c.transit_days,
                      c.freight_per_feu_min AS fmin, c.freight_per_feu_max AS fmax
               FROM market m LEFT JOIN corridor c ON c.id = m.corridor_id
               WHERE m.id = %s""",
            [market_id],
        )
        if not m:
            raise HTTPException(status_code=404, detail="Bozor topilmadi")
        result["market"] = {"country": m["country"], "city": m["city"], "lat": m["lat"],
                            "lng": m["lng"], "tariff_pct": m["tariff_pct"]}
        wp = _wp(m["waypoints"]) or []
        entry = _wp(m["entry_point"])
        if m["corridor_id"]:
            result["corridor"] = {
                "name": m["corridor_name"], "entry_point": entry, "waypoints": wp,
                "transit_days": m["transit_days"], "freight_min": m["fmin"], "freight_max": m["fmax"],
            }
            # koridorga xizmat qiluvchi logistika firmalari
            logs = await fetch_all(
                """SELECT lp.code, lp.name, lp.modes, lp.cold_chain, lp.rating
                   FROM logistics_provider lp
                   JOIN logistics_corridor lc ON lc.provider_id = lp.id
                   WHERE lc.corridor_id = %s ORDER BY lp.rating DESC""",
                [m["corridor_id"]],
            )
            result["logistics"] = [{
                "code": r["code"], "name": r["name"], "modes": _wp(r["modes"]) or [],
                "cold_chain": bool(r["cold_chain"]), "rating": r["rating"],
            } for r in logs]

        # marshrut chizig'i: men -> eng yaqin ombor -> koridor kirish -> ... -> bozor
        route = [[me["lat"], me["lng"]]]
        wh = nearest[0] if nearest else None
        if wh:
            route.append([wh["lat"], wh["lng"]])
        if entry and (not route or route[-1] != entry):
            route.append(entry)
        for pt in wp:
            if not route or route[-1] != pt:
                route.append(pt)
        result["route"] = route

        leg = haversine(me["lat"], me["lng"], wh["lat"], wh["lng"]) if wh else None
        wh_to_entry = haversine(wh["lat"], wh["lng"], entry[0], entry[1]) if (wh and entry) else None
        corridor_km = _corridor_len_km(entry, wp) if wp else None
        total = sum(x for x in [leg, wh_to_entry, corridor_km] if x)
        result["summary"] = {
            "leg_to_warehouse_km": leg,
            "warehouse_to_border_km": wh_to_entry,
            "corridor_km": corridor_km,
            "total_km": round(total, 1) if total else None,
            "transit_days": m["transit_days"],
        }

    return result
