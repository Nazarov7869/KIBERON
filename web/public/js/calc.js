// Ipak Yo'li — narx kalkulyatori (mobil formula + O'zbekiston soliqlari)
(function () {
  'use strict';

  // ---- Formula (mobil PriceCalculator bilan bir xil) + soliqlar ----
  function compute(i) {
    if (!(i.cost > 0) || !(i.qty > 0)) return null;
    var qty = i.qty;
    var loss = Math.min(Math.max(1 - (i.waste || 0) / 100, 0.01), 1);
    var eff = i.cost / loss;
    var certKg = (i.cert || 0) / qty;
    var be = eff + (i.packaging || 0) + certKg;
    var exw = be * (1 + (i.margin || 0) / 100);
    var profit = exw - be;
    var fob = exw + (i.inland || 0);
    var hasExport = i.contCost > 0 && i.contCap > 0;
    var frSolo = hasExport ? i.contCost / qty : 0;
    var frPool = hasExport ? i.contCost / i.contCap : 0;
    var cfrP = fob + frPool, cfrS = fob + frSolo;
    var cifP = cfrP * (1 + (i.insurance || 0) / 100);
    var cifS = cfrS * (1 + (i.insurance || 0) / 100);
    var comm = cifP * (i.commission || 0) / 100;
    var save = Math.max(0, cifS - cifP);
    var savePct = cifS > 0 ? (save / cifS) * 100 : 0;

    // ---- Soliqlar (O'zbekiston 2026) ----
    // Rejim: turnover (aylanma solig'i, bazasi = daromad) yoki profit (foyda solig'i)
    var regime = i.taxRegime || 'turnover_1';
    var isProfit = regime.indexOf('vat') === 0;
    var defRate = regime === 'vat_15' ? 15 : (regime === 'turnover_4' ? 4 : 1);
    var rate = (i.taxRate != null && i.taxRate !== '') ? i.taxRate : defRate;
    var excise = i.excise || 0;
    var revenue = exw; // sotuv narxi (1 kg) — aylanma solig'i bazasi
    var exportVat = 0; // eksport 0% QQS
    var incomeTax = isProfit ? Math.max(0, profit) * rate / 100 : revenue * rate / 100;
    var totalTax = incomeTax + excise;
    var netProfit = profit - totalTax;
    var burden = profit > 0 ? (totalTax / profit) * 100 : 0;

    return {
      certKg: certKg, be: be, exw: exw, profit: profit, fob: fob,
      cfrP: cfrP, cifP: cifP, cifS: cifS, comm: comm,
      save: save, savePct: savePct, hasExport: hasExport,
      totalCost: be * qty, totalProfit: profit * qty, totalCif: cifP * qty, totalSave: save * qty,
      // soliqlar
      isProfit: isProfit, rate: rate, excise: excise, revenue: revenue, exportVat: exportVat,
      incomeTax: incomeTax, totalTax: totalTax, netProfit: netProfit, burden: burden,
      totalTaxBatch: totalTax * qty, totalNet: netProfit * qty,
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('calc');
    if (!root) return;
    var results = document.getElementById('results');

    var W = {
      perkg: results.dataset.perkg || 'per kg',
      profit: results.dataset.profitword || 'profit',
      saving: results.dataset.savingword || 'Saving',
      total: results.dataset.totalword || 'total',
      uzs: results.dataset.uzs || "so'm",
      turnovertax: results.dataset.turnovertax || 'Turnover tax',
      profittax: results.dataset.profittax || 'Profit tax',
    };

    var currency = 'USD';
    function fmt(v, dec) {
      var parts = (v).toFixed(dec).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return parts.join('.');
    }
    function price(v, dec) {
      if (dec == null) dec = 2;
      var s = fmt(v, dec);
      return currency === 'USD' ? '$' + s : s + ' ' + W.uzs;
    }
    function num(id) {
      var el = document.getElementById(id);
      if (!el) return 0;
      var v = parseFloat(String(el.value).replace(',', '.').trim());
      return isNaN(v) ? 0 : v;
    }
    function rawVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    function set(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }
    function show(id, on) { var el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; }

    function render() {
      var taxRateRaw = rawVal('c-taxrate');
      var r = compute({
        cost: num('c-cost'), qty: num('c-qty'), margin: num('c-margin'),
        packaging: num('c-packaging'), waste: num('c-waste'), cert: num('c-cert'), inland: num('c-inland'),
        contCost: num('c-contcost'), contCap: num('c-contcap'), insurance: num('c-insurance'), commission: num('c-commission'),
        taxRegime: rawVal('c-regime'), taxRate: taxRateRaw === '' ? null : num('c-taxrate'), excise: num('c-excise'),
      });

      if (!r) { show('res-empty', true); show('res-body', false); return; }
      show('res-empty', false); show('res-body', true);

      set('r-breakeven', price(r.be));
      set('r-recommended', price(r.exw));
      set('r-recommended-sub', W.perkg + ' · ' + W.profit + ' ' + price(r.profit));

      // Eksport bosqichlari
      show('ladder-block', r.hasExport);
      if (r.hasExport) {
        set('r-exw', price(r.exw)); set('r-fob', price(r.fob));
        set('r-cfr', price(r.cfrP)); set('r-cif', price(r.cifP));
        show('commission-line', r.comm > 0); set('r-commission', price(r.comm));
      }

      // Konteyner to'ldirish foydasi
      var showPool = r.hasExport && r.save > 0;
      show('pooling-block', showPool);
      if (showPool) {
        set('r-solo', price(r.cifS)); set('r-pooled', price(r.cifP));
        set('r-saving-line', W.saving + ': ' + price(r.save) + '/kg · ' + fmt(r.savePct, 1) + '% · ' + W.total + ' ' + price(r.totalSave, 0));
      }

      // Soliqlar
      set('r-tax-pretax', price(r.profit));
      set('r-incometax-label', r.isProfit ? W.profittax : W.turnovertax);
      set('r-incometax', price(r.incomeTax));
      show('excise-row', r.excise > 0); set('r-excise', price(r.excise));
      set('r-netprofit', price(r.netProfit));
      set('r-burden', fmt(r.burden, 1) + '%');

      // Butun partiya
      set('r-total-cost', price(r.totalCost, 0));
      set('r-total-profit', price(r.totalProfit, 0));
      show('total-cif-row', r.hasExport); set('r-total-cif', price(r.totalCif, 0));
      set('r-total-tax', price(r.totalTaxBatch, 0));
      set('r-total-net', price(r.totalNet, 0));
    }

    // Soliq rejimi o'zgarsa — standart stavkani qo'yamiz
    var regimeSel = document.getElementById('c-regime');
    if (regimeSel) {
      regimeSel.addEventListener('change', function () {
        var v = regimeSel.value;
        var def = v === 'vat_15' ? '15' : (v === 'turnover_4' ? '4' : '1');
        var rateEl = document.getElementById('c-taxrate');
        if (rateEl) rateEl.value = def;
        render();
      });
    }

    root.querySelectorAll('input').forEach(function (el) { el.addEventListener('input', render); });
    root.querySelectorAll('.cur-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        currency = b.dataset.cur;
        root.querySelectorAll('.cur-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        render();
      });
    });

    render();
  });
})();
