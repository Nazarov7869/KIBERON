// =====================================================================
//  BUYURTMALAR — ro'yxat
// =====================================================================
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../lib/useAsync'
import { fmtMoney, fmtDate, ORDER_STATUS, Badge } from '../lib/format'

const ESCROW_LABEL = {
  none: '—',
  held: 'Pul ushlandi',
  advance_released: 'Avans chiqdi',
  balance_released: 'Balans chiqdi',
  closed: 'Yopildi',
  refunded: 'Qaytarildi',
}

export default function Orders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const list = useAsync(() => api.orders.list(), [])
  const orders = list.data?.orders || []

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1>Buyurtmalar</h1>
          <p className="muted">Konteyner buyurtmalari — escrow, jo'natma, to'lov</p>
        </div>
        {!list.loading && <span className="count-pill">{orders.length} ta</span>}
      </div>

      {list.error && <div className="inline-err">{list.error}</div>}
      {list.loading ? (
        <div className="muted mono">Yuklanmoqda…</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="brand-mark" />
          <h3>Buyurtma yo'q</h3>
          <p className="muted">
            {user.role === 'importer'
              ? "Taqsimlangan pooldan \"Buyurtma yaratish\" orqali boshlang."
              : 'Hozircha buyurtma yo\'q.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Kuzatuv</th>
                <th>Mahsulot</th>
                <th className="num">Qiymat</th>
                <th>Holat</th>
                <th>Escrow</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders/${o.id}`)}>
                  <td className="mono cell-strong">{o.tracking_code}</td>
                  <td>{o.product_name || '—'}</td>
                  <td className="num">{fmtMoney(o.total_value_usd)}</td>
                  <td><Badge map={ORDER_STATUS} value={o.status} /></td>
                  <td className="faint" style={{ fontSize: '0.84rem' }}>{ESCROW_LABEL[o.escrow_status] || o.escrow_status}</td>
                  <td className="faint" style={{ fontSize: '0.84rem' }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
