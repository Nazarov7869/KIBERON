# =====================================================================
#  HISOB-KITOB (sof, deterministik — AI YO'Q)
#  Har hissador uchun: gross -> komissiya -> net -> avans + balans.
#  Importyor escrowga total_gross qo'yadi; pul shu yerdan taqsimlanadi.
# =====================================================================


def compute(contributors: list[dict], commission_pct: float, advance_pct: float) -> dict:
    """
    contributors: [{company_id, company_name, allocated_qty, price}]
    Qaytaradi: har hissador uchun gross/komissiya/net/avans/balans + jami summalar.
      gross    = allocated_qty * price        (eksportyor sotuvi)
      komissiya = gross * commission_pct/100   (operator ulushi)
      net      = gross - komissiya            (eksportyorga sof)
      avans    = net * advance_pct/100         (jo'natishda)
      balans   = net - avans                   (yetkazishda)
    """
    rows = []
    tg = tc = tn = ta = tb = 0.0
    for c in contributors:
        gross = round(c["allocated_qty"] * c["price"], 2)
        commission = round(gross * commission_pct / 100.0, 2)
        net = round(gross - commission, 2)
        advance = round(net * advance_pct / 100.0, 2)
        balance = round(net - advance, 2)
        rows.append({
            "company_id": c["company_id"],
            "company_name": c.get("company_name"),
            "allocated_qty": c["allocated_qty"],
            "price": c["price"],
            "gross_usd": gross,
            "commission_usd": commission,
            "net_usd": net,
            "advance_usd": advance,
            "balance_usd": balance,
        })
        tg += gross
        tc += commission
        tn += net
        ta += advance
        tb += balance

    return {
        "contributors": rows,
        "total_gross_usd": round(tg, 2),
        "total_commission_usd": round(tc, 2),
        "total_net_usd": round(tn, 2),
        "total_advance_usd": round(ta, 2),
        "total_balance_usd": round(tb, 2),
    }
