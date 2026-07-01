// =====================================================================
//  TASHQI XARIDORLAR (leads) — elchixona/operator
// =====================================================================
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fmtDate } from '../lib/format'
import Modal from '../components/Modal'

export default function Leads() {
  const { user } = useAuth()
  const isAdmin = user.role === 'super_admin'
  const canEdit = user.role === 'embassy' || user.role === 'super_admin'
  const isExporter = user.role === 'exporter'
  const [products, setProducts] = useState([])
  const [markets, setMarkets] = useState([])
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    api.catalog.products().then((d) => setProducts(d.products)).catch(() => {})
    api.catalog.markets().then((d) => setMarkets(d.markets)).catch(() => {})
  }, [])

  const list = useAsync(() => api.leads.list(), [])
  const leads = list.data?.leads || []

  async function remove(id) {
    if (!confirm("Lead'ni o'chirasizmi?")) return
    try {
      await api.leads.remove(id)
      list.reload()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1>{isExporter ? 'Tashqi talab' : 'Tashqi xaridorlar'}</h1>
          <p className="muted">
            {isExporter
              ? 'Elchixonalar topgan xorijiy xaridorlar — eksport imkoniyatlari'
              : "Elchixona to'plagan potensial importyor kontaktlari"}
          </p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setEditing({})}>+ Yangi kontakt</button>}
      </div>

      {!list.loading && <div className="toolbar"><span className="count-pill">{leads.length} ta</span></div>}
      {list.error && <div className="inline-err">{list.error}</div>}

      {list.loading ? (
        <div className="muted mono">Yuklanmoqda…</div>
      ) : leads.length === 0 ? (
        <div className="empty-state"><div className="brand-mark" /><h3>Kontakt yo'q</h3><p className="muted">{canEdit ? '"Yangi kontakt" orqali tashqi xaridor qo\'shing.' : 'Hozircha tashqi talab kiritilmagan.'}</p></div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Kontakt</th>
                <th>Mahsulot</th>
                <th>Bozor</th>
                <th>Izoh</th>
                {isAdmin && <th>Elchixona</th>}
                <th>Sana</th>
                {canEdit && <th className="actions"></th>}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="cell-strong">{l.importer_contact}</td>
                  <td>{l.product_name || '—'}</td>
                  <td>{l.market_country || '—'}</td>
                  <td className="faint" style={{ maxWidth: '22ch', fontSize: '0.84rem' }}>{l.notes || '—'}</td>
                  {isAdmin && <td className="faint" style={{ fontSize: '0.84rem' }}>{l.embassy_name}</td>}
                  <td className="faint" style={{ fontSize: '0.82rem' }}>{fmtDate(l.created_at)}</td>
                  {canEdit && (
                    <td className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(l)}>Tahrir</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(l.id)}>O'chirish</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <LeadForm
          lead={editing.id ? editing : null}
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

function LeadForm({ lead, products, markets, onClose, onSaved }) {
  const edit = !!lead
  const [f, setF] = useState({
    importer_contact: lead?.importer_contact || '',
    product_id: lead?.product_id || '',
    market_id: lead?.market_id || '',
    notes: lead?.notes || '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function save() {
    setErr('')
    if (!f.importer_contact || f.importer_contact.trim().length < 2) return setErr('Kontakt kiriting')
    setBusy(true)
    const body = {
      importer_contact: f.importer_contact.trim(),
      product_id: f.product_id || null,
      market_id: f.market_id || null,
      notes: f.notes || null,
    }
    try {
      if (edit) await api.leads.update(lead.id, body)
      else await api.leads.create(body)
      onSaved()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={edit ? 'Kontaktni tahrirlash' : 'Yangi tashqi xaridor'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Bekor</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
        </>
      }
    >
      <div className="field">
        <label className="label">Kontakt (nomi / aloqa)</label>
        <input className="input" value={f.importer_contact} onChange={set('importer_contact')} placeholder="Masalan: Al-Noor Trading, ahmad@alnoor.ae" />
      </div>
      <div className="row" style={{ gap: '0.75rem' }}>
        <div className="field grow">
          <label className="label">Qiziqqan mahsulot</label>
          <select className="select" value={f.product_id} onChange={set('product_id')}>
            <option value="">—</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field grow">
          <label className="label">Bozor</label>
          <select className="select" value={f.market_id} onChange={set('market_id')}>
            <option value="">—</option>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.country}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label">Izoh</label>
        <textarea className="input" rows={3} value={f.notes} onChange={set('notes')} placeholder="Talab hajmi, shartlar, kuzatuv eslatmalari…" />
      </div>
      {err && <div className="inline-err">{err}</div>}
    </Modal>
  )
}
