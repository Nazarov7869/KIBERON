// =====================================================================
//  KARTA — sputnik karta. Avval o'z manzilingizni belgilash majburiy,
//  so'ng rolga mos nuqtalar (ombor / logistika / bozor / hamkorlar) va
//  eksport uchun yo'nalish takliflari ko'rinadi.
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import LeafletMap from '../components/LeafletMap'

const UZ_CENTER = [40.8, 66.5]

const LEGEND = [
  { type: 'me', c: '#1363DF', label: 'Siz' },
  { type: 'warehouse', c: '#1e9e61', label: 'Ombor' },
  { type: 'logistics', c: '#c77f1e', label: 'Logistika' },
  { type: 'market', c: '#d14b3c', label: 'Bozor' },
  { type: 'seller', c: '#0e8f8c', label: 'Sotuvchi' },
  { type: 'buyer', c: '#6e5aa6', label: 'Xaridor' },
]

function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;') }

export default function MapPage() {
  const [me, setMe] = useState(null)          // {lat,lng,is_set,role}
  const [draft, setDraft] = useState(null)    // {lat,lng} — belgilanayotgan manzil
  const [features, setFeatures] = useState(null)
  const [products, setProducts] = useState([])
  const [selProduct, setSelProduct] = useState('')
  const [selMarket, setSelMarket] = useState('')
  const [sugg, setSugg] = useState(null)
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.geo.me().then((r) => {
      setMe(r)
      if (!r.is_set) setEditing(true)
    }).catch((e) => setErr(e.message))
    api.catalog.products().then((r) => setProducts(r.products || r.rows || [])).catch(() => {})
  }, [])

  // manzil belgilangach — nuqtalarni yuklash
  useEffect(() => {
    if (me?.is_set && !editing) {
      api.geo.features().then(setFeatures).catch((e) => setErr(e.message))
    }
  }, [me?.is_set, editing])

  function useGps() {
    if (!navigator.geolocation) { setErr('Brauzer GPS ni qo‘llab-quvvatlamaydi'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => setDraft({ lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) }),
      () => setErr('Joylashuvni aniqlab bo‘lmadi — kartadan qo‘lda belgilang')
    )
  }

  async function saveLocation() {
    if (!draft) return
    setSaving(true); setErr('')
    try {
      const r = await api.geo.setMe({ lat: draft.lat, lng: draft.lng })
      setMe((m) => ({ ...(m || {}), ...r }))
      setEditing(false)
      setDraft(null)
    } catch (e) { setErr(e.message) } finally { setSaving(false) }
  }

  async function getSuggestions() {
    setErr(''); setSugg(null)
    if (!selMarket) { setErr('Manzil bozorini tanlang'); return }
    try {
      const r = await api.geo.suggestions({ market_id: selMarket, product_id: selProduct || undefined })
      setSugg(r)
    } catch (e) { setErr(e.message) }
  }

  // markerlar
  const markers = useMemo(() => {
    if (!features) return []
    const out = []
    features.warehouses?.forEach((w) => out.push({
      lat: w.lat, lng: w.lng, type: 'warehouse',
      html: `<b>${esc(w.code)} · ${esc(w.name)}</b><br>${esc(w.region)}<br>Bo‘sh joy: ${w.capacity_free_t ?? '—'} t${w.rate ? ` · $${w.rate}/t·oy` : ''}${w.dist_km != null ? `<br><b>${w.dist_km} km</b> uzoqlikda` : ''}`,
    }))
    features.logistics?.forEach((l) => out.push({
      lat: l.lat, lng: l.lng, type: 'logistics',
      html: `<b>${esc(l.code)} · ${esc(l.name)}</b><br>Hub: ${esc(l.hub_city)}<br>Turlari: ${(l.modes || []).join(', ')}${l.cold_chain ? ' · sovuq zanjir' : ''} · ★${l.rating}`,
    }))
    features.markets?.forEach((m) => out.push({
      lat: m.lat, lng: m.lng, type: 'market',
      html: `<b>${esc(m.country)}</b><br>${esc(m.corridor_name)}${m.transit_days ? ` · ${m.transit_days} kun` : ''}<br>Tarif: ${m.tariff_pct}%`,
    }))
    features.partners?.forEach((p) => out.push({
      lat: p.lat, lng: p.lng, type: p.type,
      html: `<b>${esc(p.name)}</b>${p.region ? `<br>${esc(p.region)}` : ''}${p.verified ? ' · <span style="color:#1e9e61">tasdiqlangan</span>' : ''}${p.dist_km != null ? `<br>${p.dist_km} km` : ''}`,
    }))
    return out
  }, [features])

  const myLoc = editing ? draft : (me?.is_set ? { lat: me.lat, lng: me.lng } : null)
  const center = myLoc ? [myLoc.lat, myLoc.lng] : UZ_CENTER

  // ---- MANZIL BELGILASH REJIMI ----
  if (!me) return <div className="card card-pad muted">Yuklanmoqda…</div>

  if (editing) {
    return (
      <div>
        <div className="page-head">
          <h1>Karta — manzilingizni belgilang</h1>
          <p className="muted">Davom etish uchun avval o‘z joylashuvingizni tanlang. Kartani bosing yoki GPS’dan foydalaning.</p>
        </div>
        {err && <div className="inline-err" style={{ marginBottom: '1rem' }}>{err}</div>}
        <div className="card card-pad" style={{ marginBottom: '1rem' }}>
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={useGps}>📍 Joriy joylashuv (GPS)</button>
            <span className="muted" style={{ fontSize: 13 }}>
              {draft ? `Tanlangan: ${draft.lat}, ${draft.lng}` : 'Kartani bosib nuqta qo‘ying yoki markerni suring'}
            </span>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} disabled={!draft || saving} onClick={saveLocation}>
              {saving ? 'Saqlanmoqda…' : 'Manzilni saqlash'}
            </button>
            {me.is_set && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setDraft(null) }}>Bekor</button>
            )}
          </div>
        </div>
        <LeafletMap
          center={center}
          zoom={draft ? 11 : 6}
          myLocation={draft}
          onMapClick={(ll) => setDraft({ lat: +ll.lat.toFixed(5), lng: +ll.lng.toFixed(5) })}
          onMyDrag={(ll) => setDraft({ lat: +ll.lat.toFixed(5), lng: +ll.lng.toFixed(5) })}
          height={520}
        />
      </div>
    )
  }

  // ---- KO'RISH REJIMI ----
  const canRoute = ['exporter', 'importer', 'super_admin', 'logistics', 'warehouse', 'embassy'].includes(me.role)
  return (
    <div>
      <div className="page-head">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1>Karta</h1>
            <p className="muted">Sizga mos ombor, logistika, bozor va hamkorlar — sputnik ko‘rinishida</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setDraft({ lat: me.lat, lng: me.lng }); setEditing(true) }}>
            Manzilni o‘zgartirish
          </button>
        </div>
      </div>
      {err && <div className="inline-err" style={{ marginBottom: '1rem' }}>{err}</div>}

      {/* Yo'nalish taklifi paneli */}
      {canRoute && (
        <div className="card card-pad" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: 10 }}>Yo‘nalish taklifi</h3>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ margin: 0, minWidth: 180 }}>
              <label className="label">Mahsulot (ixtiyoriy)</label>
              <select className="input" value={selProduct} onChange={(e) => setSelProduct(e.target.value)}>
                <option value="">— tanlanmagan —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin: 0, minWidth: 180 }}>
              <label className="label">Manzil bozori</label>
              <select className="input" value={selMarket} onChange={(e) => setSelMarket(e.target.value)}>
                <option value="">— tanlang —</option>
                {features?.markets?.map((m) => <option key={m.id} value={m.id}>{m.country}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={getSuggestions}>Taklif olish</button>
            {sugg && <button className="btn btn-ghost btn-sm" onClick={() => setSugg(null)}>Tozalash</button>}
          </div>

          {sugg && (
            <div style={{ marginTop: 14 }}>
              {sugg.market && (
                <p className="muted" style={{ fontSize: 13.5, marginBottom: 8 }}>
                  <b style={{ color: 'var(--ink)' }}>{sugg.market.country}</b> yo‘nalishi
                  {sugg.summary?.total_km ? ` · ~${sugg.summary.total_km} km` : ''}
                  {sugg.summary?.transit_days ? ` · ~${sugg.summary.transit_days} kun` : ''}
                  {sugg.market.tariff_pct != null ? ` · tarif ${sugg.market.tariff_pct}%` : ''}
                </p>
              )}
              <div className="row" style={{ gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 240 }}>
                  <div className="faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>ENG YAQIN OMBORLAR</div>
                  {sugg.nearest_warehouses?.map((w) => (
                    <div key={w.code} style={{ fontSize: 13, marginBottom: 3 }}>
                      <b>{w.code}</b> · {w.name} — {w.dist_km} km
                      {w.suitable
                        ? <span className="badge ok" style={{ fontSize: 10, marginLeft: 6 }}>mos</span>
                        : <span className="badge warn" style={{ fontSize: 10, marginLeft: 6 }}>saqlash sinfi mos emas</span>}
                    </div>
                  ))}
                </div>
                {sugg.corridor && (
                  <div style={{ minWidth: 240 }}>
                    <div className="faint" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>KORIDOR & LOGISTIKA</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>{sugg.corridor.name} · {sugg.corridor.transit_days} kun
                      {sugg.corridor.freight_min ? ` · $${sugg.corridor.freight_min}–${sugg.corridor.freight_max}/FEU` : ''}</div>
                    {sugg.logistics?.length
                      ? sugg.logistics.map((l) => (
                        <div key={l.code} style={{ fontSize: 13, marginBottom: 2 }}>
                          <b>{l.code}</b> · {l.name} <span className="faint">({(l.modes || []).join(', ')}{l.cold_chain ? ', sovuq' : ''})</span>
                        </div>))
                      : <div className="faint" style={{ fontSize: 13 }}>Bu koridorga firma biriktirilmagan</div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="card card-pad" style={{ marginBottom: '1rem' }}>
        <div className="map-legend">
          {LEGEND.map((l) => (
            <span key={l.type} className="lg-item"><span className="lg-dot" style={{ background: l.c }} /> {l.label}</span>
          ))}
        </div>
      </div>

      {/* Karta */}
      <LeafletMap
        center={center}
        zoom={me.role === 'importer' ? 4 : 6}
        markers={markers}
        route={sugg?.route || null}
        myLocation={{ lat: me.lat, lng: me.lng }}
        height={560}
      />

      {!features && <div className="card card-pad muted" style={{ marginTop: '1rem' }}>Nuqtalar yuklanmoqda…</div>}
    </div>
  )
}
