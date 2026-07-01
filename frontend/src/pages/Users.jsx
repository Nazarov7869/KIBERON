// =====================================================================
//  FOYDALANUVCHILAR — barcha ro'yxatdan o'tganlar (faqat super_admin)
// =====================================================================
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { ROLE_LABEL } from '../auth/AuthContext'

const ROLE_BADGE = {
  super_admin: 'info', exporter: 'ok', importer: 'info',
  logistics: 'muted', warehouse: 'warn', embassy: 'muted',
}

function fmtDate(s) {
  if (!s) return '—'
  return String(s).slice(0, 10)
}

export default function Users() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    api.admin.listUsers().then(setData).catch((e) => setErr(e.message))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    let rows = data.users
    if (role) rows = rows.filter((u) => u.role === role)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      rows = rows.filter((u) =>
        (u.name || '').toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s) ||
        (u.company_name || '').toLowerCase().includes(s)
      )
    }
    return rows
  }, [data, q, role])

  const roles = data ? Object.keys(data.by_role) : []

  return (
    <div>
      <div className="page-head">
        <h1>Foydalanuvchilar</h1>
        <p className="muted">Platformada ro‘yxatdan o‘tgan barcha foydalanuvchilar</p>
      </div>

      {err && <div className="inline-err">{err}</div>}

      {/* rollar bo'yicha xulosani ko'rsatish */}
      {data && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button className={'btn btn-sm ' + (role === '' ? 'btn-primary' : 'btn-ghost')} onClick={() => setRole('')}>
            Hammasi <span className="count-pill">{data.count}</span>
          </button>
          {roles.map((r) => (
            <button key={r} className={'btn btn-sm ' + (role === r ? 'btn-primary' : 'btn-ghost')} onClick={() => setRole(r)}>
              {ROLE_LABEL[r] || r} <span className="count-pill">{data.by_role[r]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-head" style={{ gap: 12 }}>
          <h3>Ro‘yxat</h3>
          <input
            className="input"
            style={{ maxWidth: 260, marginLeft: 'auto' }}
            placeholder="Ism, email yoki korxona bo‘yicha qidirish…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {!data ? (
          <div className="card-pad muted">Yuklanmoqda…</div>
        ) : filtered.length === 0 ? (
          <div className="card-pad muted">Foydalanuvchi topilmadi.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Ism</th><th>Rol</th><th>Email</th><th>Telefon</th><th>Korxona</th><th>Ro‘yxatdan o‘tgan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="cell-strong">{u.name}</td>
                  <td><span className={'badge ' + (ROLE_BADGE[u.role] || 'muted')}>{ROLE_LABEL[u.role] || u.role}</span></td>
                  <td className="faint mono" style={{ fontSize: '0.8rem' }}>{u.email || '—'}</td>
                  <td className="faint" style={{ fontSize: '0.85rem' }}>{u.phone || '—'}</td>
                  <td>
                    {u.company_name ? (
                      <span>
                        {u.company_name}{' '}
                        {u.company_verified
                          ? <span className="badge ok" style={{ fontSize: 10 }}>tasdiqlangan</span>
                          : <span className="badge warn" style={{ fontSize: 10 }}>kutilmoqda</span>}
                      </span>
                    ) : <span className="faint">—</span>}
                  </td>
                  <td className="faint" style={{ fontSize: '0.85rem' }}>{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
