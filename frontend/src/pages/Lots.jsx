// =====================================================================
//  LOTLAR SAHIFASI — taklif tomoni
// =====================================================================
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fmtMoney, fmtQty, GRADE, LOT_STATUS, Badge } from '../lib/format'
import Modal from '../components/Modal'

export default function Lots() {
  const { user } = useAuth()
  const isExporter = user.role === 'exporter'
  const [tab, setTab] = useState(isExporter ? 'mine' : 'all')
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(null) // lot obyekt yoki {} (yangi) yoki null

  useEffect(() => {
    api.catalog.products().then((d) => setProducts(d.products)).catch(() => {})
  }, [])

  const list = useAsync(() => (tab === 'mine' ? api.lots.mine() : api.lots.list()), [tab])
  const lots = list.data?.lots || []

  async function remove(id) {
    if (!confirm("Lotni o'chirishni tasdiqlaysizmi?")) return
    try {
      await api.lots.remove(id)
      list.reload()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1>Lotlar</h1>
          <p className="muted">Eksportga tayyor mahsulot partiyalari</p>
        </div>
        {isExporter && (
          <button className="btn btn-primary" onClick={() => setEditing({})}>+ Yangi lot</button>
        )}
      </div>

      <div className="toolbar">
        <div className="tabs">
          {isExporter && (
            <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>Mening lotlarim</button>
          )}
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Mavjud lotlar</button>
        </div>
        {!list.loading && <span className="count-pill">{lots.length} ta</span>}
      </div>

      {list.error && <div className="inline-err">{list.error}</div>}
      {list.loading ? (
        <div className="muted mono">Yuklanmoqda…</div>
      ) : lots.length === 0 ? (
        <div className="empty-state">
          <div className="brand-mark" />
          <h3>Lot yo'q</h3>
          <p className="muted">
            {tab === 'mine' ? "Hali lot joylamagansiz. \"Yangi lot\" tugmasi orqali qo'shing." : 'Mavjud lotlar topilmadi.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mahsulot</th>
                {tab === 'all' && <th>Korxona</th>}
                <th className="num">Hajm</th>
                <th className="num">Narx/t</th>
                <th>Nav</th>
                <th>Holat</th>
                {tab === 'mine' && <th className="actions">Amallar</th>}
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <td className="cell-strong">{l.product_name}<div className="faint mono" style={{ fontSize: '0.74rem' }}>{l.hs_code}</div></td>
                  {tab === 'all' && <td>{l.company_name}{l.company_region && <div className="faint" style={{ fontSize: '0.78rem' }}>{l.company_region}</div>}</td>}
                  <td className="num">{fmtQty(l.quantity_t)}</td>
                  <td className="num">{fmtMoney(l.price_per_ton)}</td>
                  <td>{GRADE[l.grade] || '—'}</td>
                  <td><Badge map={LOT_STATUS} value={l.status} /></td>
                  {tab === 'mine' && (
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(l)} disabled={l.status !== 'complete' && l.status !== 'pooling'}>Tahrir</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(l.id)} disabled={l.status === 'matched' || l.status === 'shipped'}>O'chirish</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <LotForm
          lot={editing.id ? editing : null}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            list.reload()
          }}
        />
      )}
    </div>
  )
}

function LotForm({ lot, products, onClose, onSaved }) {
  const edit = !!lot
  const [f, setF] = useState({
    product_id: lot?.product_id || '',
    quantity_t: lot?.quantity_t || '',
    price_per_ton: lot?.price_per_ton || '',
    grade: lot?.grade || '',
    origin: lot?.origin || '',
    status: lot?.status || 'complete',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function save() {
    setErr('')
    if (!f.product_id) return setErr('Mahsulotni tanlang')
    if (!(Number(f.quantity_t) > 0)) return setErr('Hajm 0 dan katta bo\'lishi kerak')
    setBusy(true)
    const body = {
      product_id: f.product_id,
      quantity_t: Number(f.quantity_t),
      price_per_ton: f.price_per_ton === '' ? null : Number(f.price_per_ton),
      grade: f.grade === '' ? null : Number(f.grade),
      origin: f.origin || null,
    }
    try {
      if (edit) {
        const upd = { quantity_t: body.quantity_t, price_per_ton: body.price_per_ton, grade: body.grade, origin: body.origin, status: f.status }
        await api.lots.update(lot.id, upd)
      } else {
        await api.lots.create(body)
      }
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={edit ? 'Lotni tahrirlash' : 'Yangi lot'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        </>
      }
    >
      <div className="field">
        <label className="label">Mahsulot</label>
        <select className="select" value={f.product_id} onChange={set('product_id')} disabled={edit}>
          <option value="">— tanlang —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.hs_code})</option>
          ))}
        </select>
      </div>
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field grow">
          <label className="label">Hajm (tonna)</label>
          <input className="input mono" type="number" step="0.001" value={f.quantity_t} onChange={set('quantity_t')} placeholder="18.5" />
        </div>
        <div className="field grow">
          <label className="label">Narx ($/tonna)</label>
          <input className="input mono" type="number" step="0.01" value={f.price_per_ton} onChange={set('price_per_ton')} placeholder="1200" />
        </div>
      </div>
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field grow">
          <label className="label">Nav (1–3)</label>
          <select className="select" value={f.grade} onChange={set('grade')}>
            <option value="">—</option>
            <option value="1">1-nav</option>
            <option value="2">2-nav</option>
            <option value="3">3-nav</option>
          </select>
        </div>
        <div className="field grow">
          <label className="label">Manba (origin)</label>
          <input className="input" value={f.origin} onChange={set('origin')} placeholder="Jizzax, Zomin" />
        </div>
      </div>
      {edit && (
        <div className="field">
          <label className="label">Holat</label>
          <select className="select" value={f.status} onChange={set('status')}>
            <option value="complete">Tayyor</option>
            <option value="pooling">Yig'ishda</option>
          </select>
        </div>
      )}
      {err && <div className="inline-err">{err}</div>}
    </Modal>
  )
}
