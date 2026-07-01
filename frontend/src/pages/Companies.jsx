// =====================================================================
//  KORXONALAR — operator tasdiqlash
// =====================================================================
import { api } from '../api/client'
import { useAsync } from '../lib/useAsync'

const COMPANY_TYPE = { producer: 'Ishlab chiqaruvchi', aggregator: "Yig'uvchi", both: 'Ikkalasi' }
const LEGAL = { mchj: 'MChJ', yatt: 'YaTT', qk: 'QK', aj: 'AJ', other: 'Boshqa' }

export default function Companies() {
  const list = useAsync(() => api.companies.list(), [])
  const companies = list.data?.companies || []

  async function verify(id) {
    if (!confirm('Korxonani tasdiqlaysizmi? Tasdiqdan keyin ishonch belgisi qo\'yiladi.')) return
    try {
      await api.companies.verify(id)
      list.reload()
    } catch (e) {
      alert(e.message)
    }
  }

  const pending = companies.filter((c) => !c.is_verified).length

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1>Korxonalar</h1>
          <p className="muted">Ishtirokchilarni tekshirish va tasdiqlash</p>
        </div>
        {!list.loading && (
          <div className="row center" style={{ gap: '0.5rem' }}>
            <span className="count-pill">{companies.length} ta</span>
            {pending > 0 && <span className="badge warn">{pending} tasdiqsiz</span>}
          </div>
        )}
      </div>

      {list.error && <div className="inline-err">{list.error}</div>}
      {list.loading ? (
        <div className="muted mono">Yuklanmoqda…</div>
      ) : companies.length === 0 ? (
        <div className="empty-state"><div className="brand-mark" /><h3>Korxona yo'q</h3></div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Korxona</th>
                <th>Turi</th>
                <th>Hudud</th>
                <th className="num">Reyting</th>
                <th className="num">Lot</th>
                <th>Holat</th>
                <th className="actions"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="cell-strong">{c.name}</span>
                    <div className="faint mono" style={{ fontSize: '0.74rem' }}>{LEGAL[c.legal_form]} · STIR {c.stir}</div>
                  </td>
                  <td>{COMPANY_TYPE[c.company_type] || c.company_type}</td>
                  <td>{c.region || '—'}</td>
                  <td className="num">{c.rating != null ? Number(c.rating).toFixed(2) : '—'}</td>
                  <td className="num">{c.lot_count}</td>
                  <td>
                    {c.is_verified ? (
                      <span className="badge ok">Tasdiqlangan</span>
                    ) : (
                      <span className="badge">Tasdiqsiz</span>
                    )}
                    {c.is_verified && c.verified_by_name && (
                      <div className="faint" style={{ fontSize: '0.72rem' }}>{c.verified_by_name}</div>
                    )}
                  </td>
                  <td className="actions">
                    {!c.is_verified && <button className="btn btn-primary btn-sm" onClick={() => verify(c.id)}>Tasdiqlash</button>}
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
