// =====================================================================
//  YIG'ISH BOZORI — pool ro'yxati (kartalar) + yangi pool
// =====================================================================
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fmtQty, fmtMoney, fmtDate, POOL_STATUS, Badge } from '../lib/format'
import Modal from '../components/Modal'

export default function Pools() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canCreate = user.role === 'importer' || user.role === 'super_admin'
  const [status, setStatus] = useState('forming')
  const [creating, setCreating] = useState(false)

  const list = useAsync(() => api.pools.list({ status }), [status])
  const pools = list.data?.pools || []

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1>Yig'ish bozori</h1>
          <p className="muted">Konteynerlar — kichik partiyalar birlashib to'ldiradi</p>
        </div>
        {canCreate && <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Yangi pool</button>}
      </div>

      <div className="toolbar">
        <div className="tabs">
          <button className={status === 'forming' ? 'active' : ''} onClick={() => setStatus('forming')}>Yig'ilmoqda</button>
          <button className={status === 'matched' ? 'active' : ''} onClick={() => setStatus('matched')}>Taqsimlangan</button>
        </div>
        {!list.loading && <span className="count-pill">{pools.length} ta</span>}
      </div>

      {list.error && <div className="inline-err">{list.error}</div>}
      {list.loading ? (
        <div className="muted mono">Yuklanmoqda…</div>
      ) : pools.length === 0 ? (
        <div className="empty-state">
          <div className="brand-mark" />
          <h3>Pool yo'q</h3>
          <p className="muted">{status === 'forming' ? "Hozircha ochiq konteyner yo'q." : "Taqsimlangan pool yo'q."}</p>
        </div>
      ) : (
        <div className="pool-grid">
          {pools.map((p) => {
            const offered = Number(p.offered_t) || 0
            const target = Number(p.target_qty_t) || 1
            const pct = Math.min(100, (offered / target) * 100)
            return (
              <div className="card pool-card" key={p.id} onClick={() => navigate(`/pools/${p.id}`)}>
                <div className="row between center">
                  <h3>{p.product_name}</h3>
                  <Badge map={POOL_STATUS} value={p.status} />
                </div>
                <div className="faint mono" style={{ fontSize: '0.74rem' }}>{p.hs_code}</div>
                <div className="mini-bar"><div className="mini-fill" style={{ width: pct + '%' }} /></div>
                <div className="kv"><span className="k">To'ldi</span><span className="v">{fmtQty(p.status === 'matched' ? p.filled_qty_t : offered)} / {fmtQty(p.target_qty_t)}</span></div>
                <div className="kv"><span className="k">Hissadorlar</span><span className="v">{p.entry_count}</span></div>
                {p.status === 'matched' && p.clearing_price_usd != null && (
                  <div className="kv"><span className="k">Clearing</span><span className="v">{fmtMoney(p.clearing_price_usd)}/t</span></div>
                )}
                {p.deadline && <div className="kv"><span className="k">Muddat</span><span className="v">{fmtDate(p.deadline)}</span></div>}
              </div>
            )
          })}
        </div>
      )}

      {creating && (
        <CreatePool
          role={user.role}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            navigate(`/pools/${id}`)
          }}
        />
      )}
    </div>
  )
}

function CreatePool({ role, onClose, onCreated }) {
  const isImporter = role === 'importer'
  const [rfqs, setRfqs] = useState([])
  const [products, setProducts] = useState([])
  const [f, setF] = useState({ rfq_id: '', product_id: '', target_qty_t: '', newcomer_quota_pct: '15' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  useEffect(() => {
    if (isImporter) {
      api.rfqs.mine().then((d) => setRfqs((d.rfqs || []).filter((r) => r.status === 'open'))).catch(() => {})
    } else {
      api.catalog.products().then((d) => setProducts(d.products)).catch(() => {})
    }
  }, [isImporter])

  function pickRfq(e) {
    const id = e.target.value
    const r = rfqs.find((x) => x.id === id)
    setF((s) => ({ ...s, rfq_id: id, product_id: r?.product_id || '', target_qty_t: r ? r.target_quantity_t : s.target_qty_t }))
  }

  async function save() {
    setErr('')
    if (isImporter && !f.rfq_id) return setErr('RFQ tanlang')
    if (!isImporter && !f.product_id) return setErr('Mahsulotni tanlang')
    if (!(Number(f.target_qty_t) > 0)) return setErr('Konteyner hajmi 0 dan katta bo\'lishi kerak')
    setBusy(true)
    const body = {
      product_id: f.product_id,
      target_qty_t: Number(f.target_qty_t),
      rfq_id: f.rfq_id || null,
      newcomer_quota_pct: f.newcomer_quota_pct === '' ? null : Number(f.newcomer_quota_pct),
    }
    try {
      const r = await api.pools.create(body)
      onCreated(r.pool.id)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Yangi pool (konteyner)"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Yaratilmoqda…' : 'Ochish'}</button>
        </>
      }
    >
      {isImporter ? (
        <div className="field">
          <label className="label">RFQ (o'z talabingiz)</label>
          <select className="select" value={f.rfq_id} onChange={pickRfq}>
            <option value="">— tanlang —</option>
            {rfqs.map((r) => (
              <option key={r.id} value={r.id}>{r.product_name} · {fmtQty(r.target_quantity_t)} · {r.market_country || '—'}</option>
            ))}
          </select>
          {rfqs.length === 0 && <div className="hint">Avval ochiq RFQ yarating.</div>}
        </div>
      ) : (
        <div className="field">
          <label className="label">Mahsulot</label>
          <select className="select" value={f.product_id} onChange={set('product_id')}>
            <option value="">— tanlang —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.hs_code})</option>
            ))}
          </select>
        </div>
      )}
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field grow">
          <label className="label">Konteyner hajmi (tonna)</label>
          <input className="input mono" type="number" step="0.001" value={f.target_qty_t} onChange={set('target_qty_t')} placeholder="24" />
        </div>
        <div className="field grow">
          <label className="label">Yangi keluvchi kvotasi (%)</label>
          <input className="input mono" type="number" step="0.1" value={f.newcomer_quota_pct} onChange={set('newcomer_quota_pct')} />
        </div>
      </div>
      {err && <div className="inline-err">{err}</div>}
    </Modal>
  )
}
