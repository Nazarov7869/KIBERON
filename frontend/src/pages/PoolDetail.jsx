// =====================================================================
//  POOL DETALI — jonli PoolFill + hissadorlar + amallar
// =====================================================================
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fmtQty, fmtMoney, fmtDate, GRADE, POOL_STATUS, Badge } from '../lib/format'
import PoolFill, { segColor } from '../components/PoolFill'
import Modal from '../components/Modal'

const ENTRY_STATUS = {
  pending: { label: 'Kutilmoqda', cls: '' },
  accepted: { label: 'Qabul', cls: 'ok' },
  rejected: { label: 'Rad', cls: 'bad' },
  withdrawn: { label: 'Olingan', cls: '' },
}

export default function PoolDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)
  const [busyAct, setBusyAct] = useState('')
  const [actErr, setActErr] = useState('')

  const q = useAsync(() => api.pools.get(id), [id])
  const pool = q.data?.pool
  const entries = q.data?.entries || []

  const matched = pool?.status === 'matched'
  const target = Number(pool?.target_qty_t) || 0

  // PoolFill segmentlari: taqsimlangan bo'lsa ulush, aks holda taklif
  const accepted = entries.filter((e) => e.status === 'accepted')
  const segSource = matched ? accepted : entries
  const segments = segSource.map((e, i) => ({
    id: e.id,
    name: e.company_name,
    qty: matched ? (Number(e.share_pct) / 100) * target : Number(e.quantity_t),
    color: segColor(i),
  }))

  const myEntry = entries.find((e) => user.company_id && e.company_id === user.company_id)
  const canEnter = user.role === 'exporter' && pool?.status === 'forming'
  const canAllocate = (user.role === 'super_admin' || user.role === 'importer') && pool?.status === 'forming' && entries.length > 0
  const canOrder = (user.role === 'super_admin' || user.role === 'importer') && matched && pool?.rfq_id

  async function allocate() {
    if (!confirm('Taqsimotni ishga tushiramizmi? Bu konteynerni yopadi va clearing narxni hisoblaydi.')) return
    setActErr('')
    setBusyAct('allocate')
    try {
      await api.pools.allocate(id)
      q.reload()
    } catch (e) {
      setActErr(e.message)
    } finally {
      setBusyAct('')
    }
  }

  async function withdraw(entryId) {
    if (!confirm('Yozuvni olib tashlaymizmi?')) return
    setActErr('')
    try {
      await api.pools.removeEntry(id, entryId)
      q.reload()
    } catch (e) {
      setActErr(e.message)
    }
  }

  async function createOrder() {
    setActErr('')
    setBusyAct('order')
    try {
      await api.orders.create({ pool_id: id })
      alert("Buyurtma yaratildi. \"Buyurtmalar\" bo'limida ko'ring.")
      navigate('/orders')
    } catch (e) {
      setActErr(e.message)
    } finally {
      setBusyAct('')
    }
  }

  if (q.loading) return <div className="muted mono">Yuklanmoqda…</div>
  if (q.error) return <div className="inline-err">{q.error}</div>
  if (!pool) return null

  return (
    <div>
      <button className="back-link" onClick={() => navigate('/pools')}>← Yig'ish bozori</button>

      <div className="toolbar">
        <div>
          <div className="row center" style={{ gap: '0.7rem' }}>
            <h1>{pool.product_name}</h1>
            <Badge map={POOL_STATUS} value={pool.status} />
          </div>
          <div className="meta-row">
            <div className="meta-item"><div className="ml">Konteyner</div><div className="mv">{fmtQty(pool.target_qty_t)}</div></div>
            <div className="meta-item"><div className="ml">Yangi keluvchi kvotasi</div><div className="mv">{Number(pool.newcomer_quota_pct)}%</div></div>
            {pool.deadline && <div className="meta-item"><div className="ml">Muddat</div><div className="mv">{fmtDate(pool.deadline)}</div></div>}
            {matched && <div className="meta-item"><div className="ml">Clearing</div><div className="mv">{fmtMoney(pool.clearing_price_usd)}/t</div></div>}
          </div>
        </div>
      </div>

      {actErr && <div className="inline-err">{actErr}</div>}

      <div className="detail-grid">
        {/* CHAP: PoolFill */}
        <div className="card card-pad">
          <h3 style={{ marginBottom: '1rem' }}>{matched ? 'Taqsimot' : 'To\'lish jarayoni'}</h3>
          {segments.length === 0 ? (
            <div className="muted">Hali hissador yo'q.</div>
          ) : (
            <PoolFill target={target} segments={segments} clearing={matched ? pool.clearing_price_usd : null} />
          )}

          <div className="detail-actions">
            {canEnter && <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Lotni qo'shish</button>}
            {canAllocate && (
              <button className="btn btn-accent" onClick={allocate} disabled={busyAct === 'allocate'}>
                {busyAct === 'allocate' ? 'Taqsimlanmoqda…' : 'Taqsimlash'}
              </button>
            )}
            {canOrder && (
              <button className="btn btn-primary" onClick={createOrder} disabled={busyAct === 'order'}>
                {busyAct === 'order' ? 'Yaratilmoqda…' : 'Buyurtma yaratish'}
              </button>
            )}
          </div>
        </div>

        {/* O'NG: hissadorlar */}
        <div className="card">
          <div className="card-head"><h3>Hissadorlar</h3><span className="count-pill">{entries.length}</span></div>
          {entries.length === 0 ? (
            <div className="card-pad muted">Hali hech kim qo'shilmagan.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  {matched && <th>#</th>}
                  <th>Korxona</th>
                  <th className="num">{matched ? 'Ulush' : 'Taklif'}</th>
                  {matched && <th className="num">Ball</th>}
                  <th>Holat</th>
                  {pool.status === 'forming' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    {matched && <td className="rank-badge">{e.rank ?? '—'}</td>}
                    <td>
                      <span className="cell-strong">{e.company_name}</span>
                      {Number(e.company_rating) === 0 && <div className="entry-newcomer">yangi keluvchi</div>}
                    </td>
                    <td className="num">
                      {matched ? `${Number(e.share_pct).toFixed(1)}%` : fmtQty(e.quantity_t)}
                      {matched && <div className="faint" style={{ fontSize: '0.74rem' }}>{fmtQty((Number(e.share_pct) / 100) * target)}</div>}
                    </td>
                    {matched && <td className="num">{e.score != null ? Number(e.score).toFixed(3) : '—'}</td>}
                    <td><Badge map={ENTRY_STATUS} value={e.status} /></td>
                    {pool.status === 'forming' && (
                      <td className="actions">
                        {myEntry && e.id === myEntry.id && (
                          <button className="btn btn-ghost btn-sm" onClick={() => withdraw(e.id)}>Olib tashlash</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {adding && (
        <AddEntry
          pool={pool}
          entries={entries}
          companyId={user.company_id}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            q.reload()
          }}
        />
      )}
    </div>
  )
}

function AddEntry({ pool, entries, companyId, onClose, onAdded }) {
  const [lots, setLots] = useState([])
  const [lotId, setLotId] = useState('')
  const [qty, setQty] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.lots.mine().then((d) => {
      const inPool = new Set(entries.filter((e) => e.company_id === companyId).map((e) => e.lot_id))
      const ok = (d.lots || []).filter(
        (l) =>
          l.product_id === pool.product_id &&
          (l.status === 'complete' || l.status === 'pooling') &&
          l.price_per_ton != null &&
          !inPool.has(l.id)
      )
      setLots(ok)
    })
  }, [])

  const selected = lots.find((l) => l.id === lotId)

  async function save() {
    setErr('')
    if (!lotId) return setErr('Lotni tanlang')
    const q = Number(qty)
    if (!(q > 0)) return setErr('Hajm 0 dan katta bo\'lishi kerak')
    if (selected && q > Number(selected.quantity_t)) return setErr('Hajm lot hajmidan oshib ketdi')
    setBusy(true)
    try {
      await api.pools.addEntry(pool.id, { lot_id: lotId, quantity_t: q })
      onAdded()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Lotni poolga qo'shish"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Qo\'shilmoqda…' : 'Qo\'shish'}</button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0, fontSize: '0.88rem' }}>
        Faqat <strong>{pool.product_name}</strong> mahsulotidagi, narxi ko'rsatilgan lotlaringiz.
      </p>
      <div className="field">
        <label className="label">Lot</label>
        <select className="select" value={lotId} onChange={(e) => { setLotId(e.target.value); const l = lots.find((x) => x.id === e.target.value); setQty(l ? l.quantity_t : '') }}>
          <option value="">— tanlang —</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>{fmtQty(l.quantity_t)} · {fmtMoney(l.price_per_ton)}/t · {GRADE[l.grade] || '—'}</option>
          ))}
        </select>
        {lots.length === 0 && <div className="hint">Mos lot yo'q — avval shu mahsulotdan narxli lot qo'shing.</div>}
      </div>
      <div className="field">
        <label className="label">Qo'shiladigan hajm (tonna)</label>
        <input className="input mono" type="number" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="masalan 10" />
        {selected && <div className="hint">Lotda mavjud: {fmtQty(selected.quantity_t)}</div>}
      </div>
      {err && <div className="inline-err">{err}</div>}
    </Modal>
  )
}
