// =====================================================================
//  XODIMLAR — operator yangi ichki foydalanuvchi ochadi
// =====================================================================
import { useState } from 'react'
import { api } from '../api/client'
import { ROLE_LABEL } from '../auth/AuthContext'

const STAFF_ROLES = ['embassy', 'logistics', 'warehouse']

export default function Staff() {
  const [f, setF] = useState({ role: 'embassy', name: '', email: '', phone: '', password: '' })
  const [created, setCreated] = useState([])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function create() {
    setErr('')
    setOk('')
    if (f.name.trim().length < 2) return setErr('Ism kiriting')
    if (!f.email.includes('@')) return setErr("To'g'ri email kiriting")
    if (f.password.length < 6) return setErr('Parol kamida 6 belgi')
    setBusy(true)
    try {
      const r = await api.admin.createUser({
        role: f.role,
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone || null,
        password: f.password,
      })
      setCreated((c) => [{ ...r.user, _email: f.email.trim() }, ...c])
      setOk(`${f.name} (${ROLE_LABEL[f.role]}) yaratildi`)
      setF({ role: f.role, name: '', email: '', phone: '', password: '' })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Xodimlar</h1>
        <p className="muted">Elchixona, logistika va ombor foydalanuvchilarini yaratish</p>
      </div>

      <div className="detail-grid">
        <div className="card card-pad" style={{ maxWidth: 440 }}>
          <h3 style={{ marginBottom: '1rem' }}>Yangi foydalanuvchi</h3>
          <div className="field">
            <label className="label">Rol</label>
            <select className="select" value={f.role} onChange={set('role')}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">To'liq ism</label>
            <input className="input" value={f.name} onChange={set('name')} placeholder="Familiya Ism" />
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" value={f.email} onChange={set('email')} placeholder="user@ipakyoli.uz" />
          </div>
          <div className="row" style={{ gap: '0.75rem' }}>
            <div className="field grow">
              <label className="label">Telefon</label>
              <input className="input" value={f.phone} onChange={set('phone')} placeholder="+998…" />
            </div>
            <div className="field grow">
              <label className="label">Parol</label>
              <input className="input mono" type="text" value={f.password} onChange={set('password')} placeholder="kamida 6 belgi" />
            </div>
          </div>
          {err && <div className="inline-err">{err}</div>}
          {ok && <div className="ok-note">{ok}</div>}
          <button className="btn btn-primary" style={{ marginTop: '0.4rem' }} onClick={create} disabled={busy}>{busy ? 'Yaratilmoqda…' : 'Yaratish'}</button>
        </div>

        <div className="card">
          <div className="card-head"><h3>Shu seansda yaratilganlar</h3><span className="count-pill">{created.length}</span></div>
          {created.length === 0 ? (
            <div className="card-pad muted">Hali foydalanuvchi yaratilmadi.</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Ism</th><th>Rol</th><th>Email</th></tr></thead>
              <tbody>
                {created.map((u) => (
                  <tr key={u.id}>
                    <td className="cell-strong">{u.name}</td>
                    <td><span className="badge info">{ROLE_LABEL[u.role] || u.role}</span></td>
                    <td className="faint mono" style={{ fontSize: '0.8rem' }}>{u.email || u._email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
