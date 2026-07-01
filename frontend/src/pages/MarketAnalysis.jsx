// =====================================================================
//  BOZOR TAHLILI — trading uslubidagi narx grafigi (candlestick)
//  Ticker kartalar + mahsulot tanlash + davr (30/90/180 kun).
//  Ma'lumot: dastur narx tarixi (demo yoki UZEX/stat.uz CSV import).
// =====================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import CandleChart from '../components/CandleChart'

const TF = [
  { label: '30 kun', value: 30 },
  { label: '90 kun', value: 90 },
  { label: '180 kun', value: 180 },
]

function fmt(v, d = 2) {
  if (v == null) return '—'
  return Number(v).toLocaleString('en-US', { maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : d })
}
function pct(v) {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%'
}

export default function MarketAnalysis() {
  const [items, setItems] = useState([])
  const [sel, setSel] = useState(null)      // product_id
  const [tf, setTf] = useState(90)
  const [candles, setCandles] = useState([])
  const [source, setSource] = useState(null)
  const [err, setErr] = useState('')
  const [loadingC, setLoadingC] = useState(false)
  const tickerRef = useRef(null)

  // ticker (summary)
  useEffect(() => {
    (async () => {
      try {
        const r = await api.market.summary()
        setItems(r.items || [])
        if (r.items?.length && !sel) setSel(r.items[0].product_id)
      } catch (e) { setErr(e.message) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // candles (tanlangan mahsulot / davr)
  useEffect(() => {
    if (!sel) return
    setLoadingC(true)
    api.market
      .candles(sel, tf)
      .then((r) => { setCandles(r.candles || []); setSource(r.source) })
      .catch((e) => setErr(e.message))
      .finally(() => setLoadingC(false))
  }, [sel, tf])

  const selItem = useMemo(() => items.find((x) => x.product_id === sel), [items, sel])
  const up = selItem && selItem.change_pct != null && selItem.change_pct >= 0

  return (
    <div>
      <div className="page-head">
        <h1>Bozor tahlili</h1>
        <p className="muted">Agroeksport mahsulotlari narx dinamikasi — trading uslubidagi grafik (USD/tonna)</p>
      </div>

      {err && <div className="inline-err" style={{ marginBottom: '1rem' }}>{err}</div>}

      {/* TICKER — gorizontal kartalar */}
      <div
        ref={tickerRef}
        style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: '1rem' }}
      >
        {items.map((it) => {
          const active = it.product_id === sel
          const pos = it.change_pct != null && it.change_pct >= 0
          return (
            <button
              key={it.product_id}
              onClick={() => setSel(it.product_id)}
              className="card"
              style={{
                flex: '0 0 auto', minWidth: 150, textAlign: 'left', padding: '10px 13px',
                cursor: 'pointer', border: active ? '1.5px solid var(--royal, #1363DF)' : '1px solid var(--line, #D6E2EE)',
                background: active ? 'var(--pale, #DFF6FF)' : 'var(--surface, #fff)',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                {it.name}
              </div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, marginTop: 2 }}>
                {fmt(it.last)}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: pos ? 'var(--ok, #1E7BC2)' : 'var(--bad, #B2432F)' }}>
                {pos ? '▲' : '▼'} {pct(it.change_pct)}
              </div>
            </button>
          )
        })}
        {items.length === 0 && !err && <div className="muted card-pad">Yuklanmoqda…</div>}
      </div>

      {/* SELECTED — sarlavha + davr */}
      <div className="card card-pad" style={{ marginBottom: '1rem' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--display, sans-serif)', fontWeight: 700, fontSize: 20 }}>
              {selItem ? selItem.name : '—'}
            </div>
            <div className="row" style={{ gap: 12, alignItems: 'baseline', marginTop: 4 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 24 }}>{fmt(selItem?.last)}</span>
              <span style={{ fontWeight: 700, color: up ? 'var(--ok, #1E7BC2)' : 'var(--bad, #B2432F)' }}>
                {selItem ? `${up ? '▲' : '▼'} ${fmt(selItem.change_abs)} (${pct(selItem.change_pct)})` : ''}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>USD / tonna</span>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {TF.map((t) => (
              <button
                key={t.value}
                onClick={() => setTf(t.value)}
                className={'btn btn-sm ' + (tf === t.value ? 'btn-primary' : 'btn-ghost')}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 30-kunlik yuqori/past/hajm */}
        {selItem && (
          <div className="row" style={{ gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 13 }}>30-kun yuqori: <b style={{ color: 'var(--ink,#06283D)' }}>{fmt(selItem.high_30d)}</b></span>
            <span className="muted" style={{ fontSize: 13 }}>30-kun past: <b style={{ color: 'var(--ink,#06283D)' }}>{fmt(selItem.low_30d)}</b></span>
            <span className="muted" style={{ fontSize: 13 }}>Hajm (oxirgi): <b style={{ color: 'var(--ink,#06283D)' }}>{fmt(selItem.volume, 1)} t</b></span>
            <span className="muted" style={{ fontSize: 13 }}>O‘rtacha hajm (30k): <b style={{ color: 'var(--ink,#06283D)' }}>{fmt(selItem.avg_volume_30d, 1)} t</b></span>
          </div>
        )}

        {/* GRAFIK */}
        <div style={{ marginTop: 14, opacity: loadingC ? 0.5 : 1, transition: 'opacity .2s' }}>
          <CandleChart candles={candles} height={400} />
        </div>

        {/* Manba izohi */}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 8 }}>
          <span className="faint" style={{ fontSize: 12 }}>
            {candles.length} sham · yashil = o‘sish, qizil = tushish · sichqonchani ustiga olib boring
          </span>
          <span className="badge muted" style={{ fontSize: 11 }}>
            manba: {source === 'demo' || !source ? 'namuna (demo)' : source}
          </span>
        </div>
      </div>

      {/* Ma'lumot manbalari haqida */}
      <div className="card card-pad">
        <h3 style={{ marginBottom: '0.5rem' }}>Real ma’lumot ulash</h3>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          Hozir grafik <b>namuna (demo)</b> narx tarixidan foydalanmoqda. O‘zbekiston bo‘yicha
          ochiq narx ma’lumotlarini <span className="mono">price_history</span> jadvaliga
          (CSV/JSON) yuklab, <span className="mono">source</span> ustunini <span className="mono">uzex</span> /
          <span className="mono"> stat</span> qilib belgilasangiz, grafik avtomatik shu real ma’lumotni ko‘rsatadi.
          Ochiq manbalar:
        </p>
        <ul className="muted" style={{ fontSize: 13.5, lineHeight: 1.7, paddingLeft: '1.1rem' }}>
          <li><b>data.egov.uz</b> — rasmiy ochiq ma’lumotlar portali (CSV/JSON/XML).</li>
          <li><b>stat.uz</b> — markaziy dehqon bozorlaridagi oziq-ovqat narxlari, meva-sabzavot eksporti.</li>
          <li><b>uzex.uz</b> — tovar birjasi: agro mahsulotlar narx indekslari (haftalik/oylik).</li>
          <li>Qishloq xo‘jaligi vazirligi — kunlik qishloq xo‘jaligi mahsulotlari narxlari.</li>
        </ul>
      </div>
    </div>
  )
}
