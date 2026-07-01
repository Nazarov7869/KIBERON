// =====================================================================
//  RFQ SAHIFASI — talab tomoni
// =====================================================================
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fmtMoney, fmtQty, fmtDate, GRADE, RFQ_STATUS, INCOTERMS, Badge } from '../lib/format'
import Modal from '../components/Modal'

export default function Rfqs() {
  const { user } = useAuth()
  const isImporter = user.role === 'importer'
  const [products, setProducts] = useState([])
  const [markets, setMarkets] = useState([])
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    api.catalog.products().then((d) => setProducts(d.products)).catch(() => {})
    api.catalog.markets().then((d) => setMarkets(d.markets)).catch(() => {})
  }, [])

  const list = useAsync(() => (isImporter ? api.rfqs.mine() : api.rfqs.list()), [isImporter])
  const rfqs = list.data?.rfqs || []

  async function remove(id) {
    if (!confirm("Talabni o'chirishni tasdiqlaysizmi?")) return
    try {
      await api.rfqs.remove(id)
      list.reload()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1>{isImporter ? "Mening talablarim (RFQ)" : 'Ochiq talablar'}</h1>
          <p className="muted">
            {isImporter ? "Tashqi xaridor sifatida talab bering" : 'Importyorlar talabi — yangi imkoniyatlar'}
          </p>
        </div>
        {isImporter && <button className="btn btn-primary" onClick={() => setEditing({})}>+ Yangi RFQ</button>}
      </div>

      {!list.loading && <div className="toolbar"><span className="count-pill">{rfqs.length} ta</span></div>}
      {list.error && <div className="inline-err">{list.error}</div>}

      {list.loading ? (
        <div className="muted mono">Yuklanmoqda…</div>
      ) : rfqs.length === 0 ? (
        <div className="empty-state">
          <div className="brand-mark" />
          <h3>Talab yo'q</h3>
          <p className="muted">{isImporter ? 'Hali talab bermagansiz.' : 'Ochiq talablar topilmadi.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mahsulot</th>
                {!isImporter && <th>Importyor</th>}
                <th className="num">Talab hajmi</th>
                <th>Bozor</th>
                <th>Incoterm</th>
                <th>Muddat</th>
                <th>Holat</th>
                {isImporter && <th className="actions">Amallar</th>}
              </tr>
            </thead>
            <tbody>
              {rfqs.map((r) => (
                <tr key={r.id}>
                  <td className="cell-strong">{r.product_name}<div className="faint mono" style={{ fontSize: '0.74rem' }}>{r.hs_code}</div></td>
                  {!isImporter && <td>{r.importer_name}</td>}
                  <td className="num">{fmtQty(r.target_quantity_t)}</td>
                  <td>{r.market_country || '—'}</td>
                  <td className="mono" style={{ textTransform: 'uppercase' }}>{r.incoterm || '—'}</td>
                  <td>{fmtDate(r.deadline)}</td>
                  <td><Badge map={RFQ_STATUS} value={r.status} /></td>
                  {isImporter && (
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(r)}>Tahrir</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}>O'chirish</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RfqForm
          rfq={editing.id ? editing : null}
          products={products}
          markets={markets}
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

function RfqForm({ rfq, products, markets, onClose, onSaved }) {
  const edit = !!rfq
  const [f, setF] = useState({
    product_id: rfq?.product_id || '',
    target_quantity_t: rfq?.target_quantity_t || '',
    market_id: rfq?.market_id || '',
    incoterm: rfq?.incoterm || '',
    grade: rfq?.grade || '',
    deadline: rfq?.deadline || '',
    price_ceiling_usd: rfq?.price_ceiling_usd || '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function save() {
    setErr('')
    if (!f.product_id) return setErr('Mahsulotni tanlang')
    if (!(Number(f.target_quantity_t) > 0)) return setErr('Talab hajmi 0 dan katta bo\'lishi kerak')
    setBusy(true)
    const body = {
      product_id: f.product_id,
      target_quantity_t: Number(f.target_quantity_t),
      market_id: f.market_id || null,
      incoterm: f.incoterm || null,
      grade: f.grade === '' ? null : Number(f.grade),
      deadline: f.deadline || null,
      price_ceiling_usd: f.price_ceiling_usd === '' ? null : Number(f.price_ceiling_usd),
    }
    try {
      if (edit) {
        await api.rfqs.update(rfq.id, {
          target_quantity_t: body.target_quantity_t,
          market_id: body.market_id,
          incoterm: body.incoterm,
          grade: body.grade,
          deadline: body.deadline,
          price_ceiling_usd: body.price_ceiling_usd,
        })
      } else {
        await api.rfqs.create(body)
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
      title={edit ? 'RFQ tahrirlash' : 'Yangi RFQ'}
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
          <label className="label">Talab hajmi (tonna)</label>
          <input className="input mono" type="number" step="0.001" value={f.target_quantity_t} onChange={set('target_quantity_t')} placeholder="24" />
        </div>
        <div className="field grow">
          <label className="label">Bozor</label>
          <select className="select" value={f.market_id} onChange={set('market_id')}>
            <option value="">—</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>{m.country}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field grow">
          <label className="label">Incoterm</label>
          <select className="select" value={f.incoterm} onChange={set('incoterm')}>
            <option value="">—</option>
            {INCOTERMS.map((i) => (
              <option key={i} value={i}>{i.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <div className="field grow">
          <label className="label">Nav</label>
          <select className="select" value={f.grade} onChange={set('grade')}>
            <option value="">—</option>
            <option value="1">1-nav</option>
            <option value="2">2-nav</option>
            <option value="3">3-nav</option>
          </select>
        </div>
      </div>
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field grow">
          <label className="label">Muddat (deadline)</label>
          <input className="input" type="date" value={f.deadline || ''} onChange={set('deadline')} />
        </div>
        <div className="field grow">
          <label className="label">Maks narx ($/t)</label>
          <input className="input mono" type="number" step="0.01" value={f.price_ceiling_usd} onChange={set('price_ceiling_usd')} placeholder="ixtiyoriy" />
        </div>
      </div>
      {err && <div className="inline-err">{err}</div>}
    </Modal>
  )
}
