# =====================================================================
#  YIG'ISH DVIGATELI (sof, deterministik — AI YO'Q)
#  Ball (score) hisoblash + ballga ko'ra taqsimot + yangi keluvchi kvotasi
#  + clearing (yagona) narx. Hech qanday nojo'ya ta'sir yo'q — to'liq test qilinadi.
# =====================================================================
from typing import Optional


# ---- ball (score) ----------------------------------------------------
def _grade_score(grade: Optional[int]) -> float:
    return {1: 1.0, 2: 0.66, 3: 0.33}.get(grade, 0.66)


def _quality_subscore(quality_status: str, grade: Optional[int]) -> float:
    qstat = {"passed": 1.0, "pending": 0.5, "rejected": 0.0}.get(quality_status, 0.5)
    return 0.6 * qstat + 0.4 * _grade_score(grade)


def entry_score(weights: dict, *, quality_status: str, grade: Optional[int],
                rating: float, price: float, min_price: float, max_price: float,
                warehoused: bool) -> float:
    """Bitta ishtirokchining bali (0..1). Har omil normallashtirilgan."""
    quality = _quality_subscore(quality_status, grade)
    rating_s = max(0.0, min(1.0, (rating or 0) / 5.0))
    price_s = (max_price - price) / (max_price - min_price) if max_price > min_price else 1.0
    distance_s = 1.0 if warehoused else 0.6
    return (
        weights.get("quality", 0) * quality
        + weights.get("rating", 0) * rating_s
        + weights.get("price", 0) * price_s
        + weights.get("distance", 0) * distance_s
    )


# ---- taqsimot --------------------------------------------------------
def _order(entries: list[dict]) -> list[dict]:
    # ball bo'yicha kamayish; teng bo'lsa arzonroq narx; keyin id (determinizm)
    return sorted(entries, key=lambda e: (-e["score"], e["price"], str(e["id"])))


def allocate(target: float, newcomer_quota_pct: float, entries: list[dict]) -> dict:
    """
    Konteyner sig'imini (target) ballga ko'ra taqsimlaydi.
    entries: [{id, offered_qty, price, score, is_newcomer}]
    Bosqich 1: yangi keluvchilarga kvota (newcomer_quota_pct% target) — ballga ko'ra.
    Bosqich 2: qolgan sig'im barcha ishtirokchilarga ballga ko'ra.
    Qaytaradi: filled_qty, clearing_price (qty-vaznli o'rtacha), total_value, har entry ulushi.
    """
    order = _order(entries)
    alloc = {e["id"]: 0.0 for e in entries}

    # Bosqich 1 — yangi keluvchi kvotasi
    quota = round(target * newcomer_quota_pct / 100.0, 3)
    rem_q = quota
    for e in order:
        if rem_q <= 0:
            break
        if e["is_newcomer"]:
            take = min(e["offered_qty"], rem_q)
            alloc[e["id"]] += take
            rem_q -= take

    # Bosqich 2 — umumiy to'ldirish (kvotadan tashqari hammasi)
    rem = round(target - sum(alloc.values()), 3)
    for e in order:
        if rem <= 0:
            break
        avail = e["offered_qty"] - alloc[e["id"]]
        if avail <= 0:
            continue
        take = min(avail, rem)
        alloc[e["id"]] += take
        rem -= take

    filled = round(sum(alloc.values()), 3)
    value = sum(alloc[e["id"]] * e["price"] for e in entries)
    clearing = round(value / filled, 2) if filled > 0 else None

    result = []
    for rank, e in enumerate(order, start=1):
        a = round(alloc[e["id"]], 3)
        result.append({
            "id": e["id"],
            "allocated_qty": a,
            "share_pct": round(a / target * 100, 3) if target > 0 else 0.0,
            "score": round(e["score"], 4),
            "rank": rank,
            "status": "accepted" if a > 0 else "rejected",
        })

    return {
        "filled_qty": filled,
        "clearing_price": clearing,
        "total_value": round(value, 2),
        "fill_pct": round(filled / target * 100, 2) if target > 0 else 0.0,
        "entries": result,
    }
