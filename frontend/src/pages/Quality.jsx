// =====================================================================
//  SIFAT NAZORATI — ombor lotlarni tekshiradi (passed/rejected)
//  Sifat holati pooling balliga ta'sir qiladi.
// =====================================================================
import { useState } from 'react'
import { api } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { fmtQty, fmtMoney, GRADE, QUALITY_STATUS, Badge } from '../lib/format'

export default function Quality() {
  const [tab, setTab] = useState('pending')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const list = useAsync(
    () => api.lots.list(tab === 'pending' ? { quality_status: 'pending' } : {}),
    [tab]
  )
  const lots = list.data?.lots || []

  async function setQuality(id, status) {
    const verb = status === 'passed' ? 'sifatli deb tasdiqlash' : 'rad etish'
    if (!confirm(`Lotni ${verb}?`)) return
    setErr('')
    setBusy(id + status)
    try {
      await api.lots.setQuality(id, { status })
      list.reload()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1>Sifat nazorati</h1>
          <p className="muted">Lot sifati pooling ballini belgilaydi — sifatli lotlar oldinroq joylashadi</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="tabs">
          <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Tekshirilmagan</button>
          <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Barcha lotlar</button>
        </div>
        {!list.loading && <span className="count-pill">{lots.length} ta</span>}
      </div>

      {err && <div className="inline-err">{err}</div>}
      {list.loading ? (
        <div className="muted mono">Yuklanmoqda…</div>
      ) : lots.length === 0 ? (
        <div className="empty-state">
          <div className="brand-mark" />
          <h3>{tab === 'pending' ? 'Tekshirilmagan lot yo\'q' : 'Lot yo\'q'}</h3>
          <p className="muted">{tab === 'pending' ? 'Barcha lotlar tekshirilgan.' : 'Hozircha ochiq lot yo\'q.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Korxona</th>
                <th className="num">Hajm</th>
                <th>Nav</th>
                <th>Sifat</th>
                <th>Inspektor</th>
                <th className="actions">Amal</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id}>
                  <td className="cell-strong">{l.product_name}<div className="faint mono" style={{ fontSize: '0.74rem' }}>{l.hs_code}</div></td>
                  <td>{l.company_name}{l.company_region && <div className="faint" style={{ fontSize: '0.78rem' }}>{l.company_region}</div>}</td>
                  <td className="num">{fmtQty(l.quantity_t)}</td>
                  <td>{GRADE[l.grade] || '—'}</td>
                  <td><Badge map={QUALITY_STATUS} value={l.quality_status} /></td>
                  <td className="faint" style={{ fontSize: '0.84rem' }}>{l.inspector_name || '—'}</td>
                  <td className="actions">
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy === l.id + 'passed' || l.quality_status === 'passed'}
                      onClick={() => setQuality(l.id, 'passed')}
                    >Sifatli</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy === l.id + 'rejected' || l.quality_status === 'rejected'}
                      onClick={() => setQuality(l.id, 'rejected')}
                    >Rad</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
