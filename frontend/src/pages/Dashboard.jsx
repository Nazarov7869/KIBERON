// =====================================================================
//  BOSHQARUV (dashboard) — rolga mos jonli metrikalar + real PoolFill
// =====================================================================
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLE_LABEL } from '../auth/AuthContext'
import { api } from '../api/client'
import PoolFill from '../components/PoolFill'

const STAT_LABELS = {
  products: 'Mahsulot', markets: 'Bozor', corridors: 'Koridor', warehouses: 'Ombor',
  providers: 'Logistika', certifications: 'Sertifikat', price_refs: "Narx ma'lumotnomasi",
}

const ROLE_HINT = {
  super_admin: "Korxonalarni tasdiqlang, xodim (elchixona/logistika) qo'shing, poollarni kuzating.",
  exporter: "Lot joylang, yig'ish bozoridagi konteynerlarga qo'shiling, ulushingizni oling.",
  importer: "Talab (RFQ) bering, konteyner ochib to'ldiring, escrow orqali xavfsiz sotib oling.",
  logistics: "Tasdiqlangan buyurtmalarni jo'nating va yetkazib bering.",
  warehouse: "Lotlar sifatini tekshiring — sifatli lotlar pooling'da oldinroq joylashadi.",
  embassy: "Tashqi bozordagi xaridorlar va talabni platformaga kiriting.",
}

// rolga qarab haqiqiy metrikalarni yuklash
async function loadMetrics(role) {
  if (role === 'exporter') {
    const [lots, pools, orders] = await Promise.all([api.lots.mine(), api.pools.list({ status: 'forming' }), api.orders.list()])
    return [
      { label: 'Lotlarim', value: lots.lots.length, to: '/lots' },
      { label: 'Ochiq konteynerlar', value: pools.pools.length, to: '/pools' },
      { label: 'Buyurtmalarim', value: orders.orders.length, to: '/orders' },
    ]
  }
  if (role === 'importer') {
    const [rfqs, pools, orders] = await Promise.all([api.rfqs.mine(), api.pools.list({ status: 'forming' }), api.orders.list()])
    return [
      { label: "RFQ'larim", value: rfqs.rfqs.length, to: '/rfqs' },
      { label: 'Ochiq konteynerlar', value: pools.pools.length, to: '/pools' },
      { label: 'Buyurtmalarim', value: orders.orders.length, to: '/orders' },
    ]
  }
  if (role === 'super_admin') {
    const [comp, pools, orders] = await Promise.all([api.companies.list(), api.pools.list({ status: 'forming' }), api.orders.list()])
    const pending = comp.companies.filter((c) => !c.is_verified).length
    return [
      { label: 'Korxonalar', value: comp.companies.length, sub: pending ? `${pending} tasdiqsiz` : 'hammasi tasdiqlangan', to: '/companies' },
      { label: 'Faol konteynerlar', value: pools.pools.length, to: '/pools' },
      { label: 'Buyurtmalar', value: orders.orders.length, to: '/orders' },
    ]
  }
  if (role === 'logistics') {
    const orders = await api.orders.list()
    return [
      { label: "Jo'natish kutilmoqda", value: orders.orders.filter((o) => o.status === 'confirmed').length, to: '/orders' },
      { label: "Yo'lda", value: orders.orders.filter((o) => o.status === 'in_transit').length, to: '/orders' },
      { label: 'Yetkazilgan', value: orders.orders.filter((o) => o.status === 'delivered' || o.status === 'closed').length, to: '/orders' },
    ]
  }
  if (role === 'warehouse') {
    const [pend, pools] = await Promise.all([api.lots.list({ quality_status: 'pending' }), api.pools.list({ status: 'forming' })])
    return [
      { label: 'Tekshirilmagan lotlar', value: pend.lots.length, to: '/quality' },
      { label: 'Ochiq konteynerlar', value: pools.pools.length, to: '/pools' },
    ]
  }
  if (role === 'embassy') {
    const leads = await api.leads.list()
    return [{ label: 'Kontaktlarim', value: leads.leads.length, to: '/leads' }]
  }
  return []
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [featured, setFeatured] = useState(undefined) // undefined=yuklanmoqda, null=yo'q
  const [err, setErr] = useState('')

  useEffect(() => {
    api.catalog.summary().then((d) => setSummary(d.summary)).catch((e) => setErr(e.message))
    loadMetrics(user.role).then(setMetrics).catch(() => setMetrics([]))
    // haqiqiy taqsimlangan pool (signatura)
    api.pools.list({ status: 'matched' })
      .then(async (d) => {
        if (!d.pools.length) return setFeatured(null)
        const det = await api.pools.get(d.pools[0].id)
        const acc = (det.entries || []).filter((e) => e.status === 'accepted')
        const target = Number(det.pool.target_qty_t)
        setFeatured({
          pool: det.pool,
          target,
          clearing: det.pool.clearing_price_usd,
          segments: acc.map((e) => ({ id: e.id, name: e.company_name, qty: (Number(e.share_pct) / 100) * target })),
        })
      })
      .catch(() => setFeatured(null))
  }, [user.role])

  const roleColor = `var(--role-${user.role})`

  return (
    <div>
      <div className="page-head">
        <div className="row center between wrap" style={{ gap: '0.6rem' }}>
          <div>
            <h1>Assalomu alaykum, {user.name.split(' ')[0]}</h1>
            <p className="muted">Ipak Yo'li eksport platformasiga xush kelibsiz</p>
          </div>
          <span className="role-pill" style={{ background: roleColor }}>{ROLE_LABEL[user.role]}</span>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '1.4rem', background: 'var(--feruza-050)', borderColor: 'transparent' }}>
        <strong>Nima qilishingiz mumkin:</strong>{' '}
        <span className="muted">{ROLE_HINT[user.role]}</span>
      </div>

      {/* JONLI METRIKALAR */}
      {metrics && metrics.length > 0 && (
        <div className="grid stat-grid" style={{ marginBottom: '1.8rem' }}>
          {metrics.map((m) => (
            <button className="card stat-card stat-click" key={m.label} onClick={() => navigate(m.to)}>
              <div className="stat-val">{m.value}</div>
              <div className="stat-label">{m.label}</div>
              {m.sub && <div className="faint" style={{ fontSize: '0.74rem', marginTop: '0.2rem' }}>{m.sub}</div>}
            </button>
          ))}
        </div>
      )}

      {/* SIGNATURA: haqiqiy taqsimlangan pool yoki tushuntirish */}
      <div className="card" style={{ marginBottom: '1.8rem' }}>
        <div className="card-head">
          <div>
            <h3>Yig'ish bozori{featured ? '' : ' — qanday ishlaydi'}</h3>
            <span className="faint" style={{ fontSize: '0.84rem' }}>
              {featured
                ? `${featured.pool.product_name} — ${featured.segments.length} korxona ${(+featured.target).toFixed(0)}t konteynerni to'ldirdi`
                : 'Namuna: 3 korxona bitta 24 tonnali konteynerni to\'ldiradi'}
            </span>
          </div>
          <span className="badge ok badge-dot">matched</span>
        </div>
        <div className="card-pad">
          {featured ? (
            <>
              <PoolFill target={featured.target} clearing={featured.clearing} segments={featured.segments} />
              <button className="btn btn-sm" style={{ marginTop: '1rem' }} onClick={() => navigate(`/pools/${featured.pool.id}`)}>
                Poolni ko'rish →
              </button>
            </>
          ) : (
            <>
              <PoolFill target={24} clearing={1012.5} segments={[
                { id: 1, name: 'Alfa Eksport', qty: 10 },
                { id: 2, name: 'Beta Agro', qty: 10 },
                { id: 3, name: 'Gamma Fermer', qty: 4 },
              ]} />
              <p className="muted" style={{ fontSize: '0.88rem', marginTop: '1rem', marginBottom: 0 }}>
                Har bir rang — alohida korxonaning ulushi. Ballga ko'ra taqsimlanadi, yangi
                keluvchilar 15% kvota bilan himoyalanadi, narx esa qty-vaznli o'rtacha (clearing).
              </p>
            </>
          )}
        </div>
      </div>

      <h3 style={{ marginBottom: '0.8rem' }}>Platforma katalogi</h3>
      {err && <div className="inline-err">{err}</div>}
      {summary ? (
        <div className="grid stat-grid">
          {Object.entries(summary).map(([k, v]) => (
            <div className="card stat-card" key={k}>
              <div className="stat-val">{v}</div>
              <div className="stat-label">{STAT_LABELS[k] || k}</div>
            </div>
          ))}
        </div>
      ) : (
        !err && <div className="muted mono">Yuklanmoqda…</div>
      )}
    </div>
  )
}
