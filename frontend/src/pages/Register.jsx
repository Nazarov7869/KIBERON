// =====================================================================
//  RO'YXATDAN O'TISH — eksportyor (korxona bilan) yoki importyor
// =====================================================================
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Logo from '../components/Logo'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState('exporter')
  const [f, setF] = useState({
    name: '', email: '', phone: '', password: '',
    cname: '', stir: '', region: '', legal_form: 'mchj', company_type: 'producer',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (role === 'exporter' && !/^\d{9}$/.test(f.stir)) {
      setErr('STIR 9 ta raqamdan iborat bo\'lishi kerak')
      return
    }
    setBusy(true)
    const payload = {
      role,
      name: f.name,
      email: f.email,
      phone: f.phone || undefined,
      password: f.password,
      company: role === 'exporter'
        ? { name: f.cname, stir: f.stir, region: f.region || undefined, legal_form: f.legal_form, company_type: f.company_type }
        : undefined,
    }
    try {
      await register(payload)
      navigate('/')
    } catch (e2) {
      setErr(e2.message || 'Ro\'yxatda xatolik')
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
          <h1>Platformaga qo'shiling.</h1>
          <p>Eksportyor sifatida mahsulotingizni joylang yoki importyor sifatida talab bering.</p>
        </div>
        <div className="auth-foot">Elchixona/logistika hisoblari operator tomonidan ochiladi</div>
      </aside>

      <section className="auth-panel">
        <div className="auth-card card card-pad">
          <h2>Ro'yxatdan o'tish</h2>
          <p className="auth-sub">Hisob turini tanlang</p>

          <div className="seg-toggle">
            <button type="button" className={role === 'exporter' ? 'active' : ''} onClick={() => setRole('exporter')}>Eksportyor</button>
            <button type="button" className={role === 'importer' ? 'active' : ''} onClick={() => setRole('importer')}>Importyor</button>
          </div>

          <form onSubmit={submit}>
            <div className="field">
              <label className="label">Ism familiya</label>
              <input className="input" value={f.name} onChange={set('name')} required />
            </div>
            <div className="row" style={{ gap: '0.75rem' }}>
              <div className="field grow">
                <label className="label">Email</label>
                <input className="input" type="email" value={f.email} onChange={set('email')} required />
              </div>
              <div className="field grow">
                <label className="label">Telefon</label>
                <input className="input" value={f.phone} onChange={set('phone')} placeholder="+998…" />
              </div>
            </div>
            <div className="field">
              <label className="label">Parol</label>
              <input className="input" type="password" value={f.password} onChange={set('password')} minLength={6} required />
            </div>

            {role === 'exporter' && (
              <>
                <div className="nav-section" style={{ padding: '0.3rem 0 0.5rem' }}>Korxona</div>
                <div className="field">
                  <label className="label">Korxona nomi</label>
                  <input className="input" value={f.cname} onChange={set('cname')} required placeholder="Masalan: Oltin Vodiy MChJ" />
                </div>
                <div className="row" style={{ gap: '0.75rem' }}>
                  <div className="field grow">
                    <label className="label">STIR (9 raqam)</label>
                    <input className="input mono" value={f.stir} onChange={set('stir')} maxLength={9} placeholder="305123456" required />
                  </div>
                  <div className="field grow">
                    <label className="label">Hudud</label>
                    <input className="input" value={f.region} onChange={set('region')} placeholder="Jizzax" />
                  </div>
                </div>
                <div className="row" style={{ gap: '0.75rem' }}>
                  <div className="field grow">
                    <label className="label">Tashkiliy shakl</label>
                    <select className="select" value={f.legal_form} onChange={set('legal_form')}>
                      <option value="mchj">MChJ</option>
                      <option value="yatt">YaTT</option>
                      <option value="qk">QK</option>
                      <option value="aj">AJ</option>
                      <option value="other">Boshqa</option>
                    </select>
                  </div>
                  <div className="field grow">
                    <label className="label">Turi</label>
                    <select className="select" value={f.company_type} onChange={set('company_type')}>
                      <option value="producer">Ishlab chiqaruvchi</option>
                      <option value="aggregator">Agregator</option>
                      <option value="both">Ikkalasi</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {err && <div className="error-text" style={{ marginBottom: '0.8rem' }}>{err}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Yaratilmoqda…' : 'Ro\'yxatdan o\'tish'}</button>
          </form>
          <div className="auth-switch">
            Hisobingiz bormi? <Link to="/login">Kirish</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
