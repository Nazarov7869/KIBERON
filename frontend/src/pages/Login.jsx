// =====================================================================
//  KIRISH SAHIFASI
// =====================================================================
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Logo from '../components/Logo'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (e2) {
      setErr(e2.message || 'Kirishda xatolik')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <div className="auth-aside-tiles" />
        <Logo variant="full" theme="dark" size={40} />
        <div className="auth-pitch">
          <h1>Birlashib, dunyo bozoriga.</h1>
          <p>Kichik korxonalar lotlarini birlashtirib bitta konteynerni to'ldiradi —
            adolatli taqsimot, shaffof narx, ishonchli to'lov.</p>
        </div>
        <div className="auth-foot">Jizzax viloyati eksport operatori</div>
      </aside>

      <section className="auth-panel">
        <div className="auth-card card card-pad">
          <h2>Kirish</h2>
          <p className="auth-sub">Hisobingizga kiring</p>
          <form onSubmit={submit}>
            <div className="field">
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="siz@korxona.uz" required autoFocus />
            </div>
            <div className="field">
              <label className="label">Parol</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {err && <div className="error-text" style={{ marginBottom: '0.8rem' }}>{err}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Kirilmoqda…' : 'Kirish'}</button>
          </form>
          <div className="auth-switch">
            Hisobingiz yo'qmi? <Link to="/register">Ro'yxatdan o'tish</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
