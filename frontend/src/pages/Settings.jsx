// =====================================================================
//  SOZLAMALAR — AI provayder kaliti (faqat super_admin)
//  Kalit bazada saqlanadi va .env dan ustun turadi. Serverni qayta
//  ishga tushirish shart emas.
// =====================================================================
import { useEffect, useState } from 'react'
import { api } from '../api/client'

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)', hint: 'Kalit: sk-ant-…' },
  { value: 'openai', label: 'OpenAI (GPT)', hint: 'Kalit: sk-…' },
  { value: 'google', label: 'Google (Gemini)', hint: 'AIza… kaliti' },
  { value: 'custom', label: 'Custom (OpenAI-mos)', hint: 'O‘z bazaviy URL bilan' },
]

const SOURCE_LABEL = {
  db: 'admin panelda kiritilgan',
  env: '.env faylidan',
  none: 'sozlanmagan',
}

export default function Settings() {
  const [cur, setCur] = useState(null)          // joriy holat (serverdan)
  const [f, setF] = useState({ provider: 'anthropic', api_key: '', base_url: '', model: '' })
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [test, setTest] = useState(null)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function load() {
    setErr('')
    try {
      const r = await api.admin.getAiSettings()
      setCur(r.settings)
      setF((s) => ({
        ...s,
        provider: r.settings.provider || 'anthropic',
        base_url: r.settings.base_url || '',
        model: r.settings.model || '',
      }))
    } catch (e) {
      setErr(e.message)
    }
  }

  useEffect(() => { load() }, [])

  async function save() {
    setErr(''); setOk(''); setTest(null)
    if (f.api_key.trim().length < 8) return setErr('API kalitini kiriting')
    if (f.provider === 'custom' && !f.base_url.trim()) return setErr("'Custom' uchun bazaviy URL kerak")
    setBusy(true)
    try {
      const r = await api.admin.saveAiSettings({
        provider: f.provider,
        api_key: f.api_key.trim(),
        base_url: f.base_url.trim() || null,
        model: f.model.trim() || null,
      })
      setCur(r.settings)
      setOk('Saqlandi. AI maslahatchi endi shu kalit bilan ishlaydi.')
      setF((s) => ({ ...s, api_key: '' }))   // kalitni ekrandan tozalaymiz
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function runTest() {
    setErr(''); setOk(''); setTest(null); setTesting(true)
    try {
      const r = await api.admin.testAiSettings()
      setTest({ ok: true, text: `${r.provider} · ${r.model} → "${r.reply}"` })
    } catch (e) {
      setTest({ ok: false, text: e.message })
    } finally {
      setTesting(false)
    }
  }

  async function clear() {
    setErr(''); setOk(''); setTest(null)
    if (!window.confirm('AI kalitini o‘chirasizmi? (.env bo‘lsa o‘shanga qaytadi)')) return
    setBusy(true)
    try {
      const r = await api.admin.clearAiSettings()
      setCur(r.settings)
      setOk('Tozalandi.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const providerHint = PROVIDERS.find((p) => p.value === f.provider)?.hint || ''

  return (
    <div>
      <div className="page-head">
        <h1>Sozlamalar</h1>
        <p className="muted">Sun’iy intellekt (AI) provayderi va API kaliti</p>
      </div>

      <div className="detail-grid">
        <div className="card card-pad" style={{ maxWidth: 520 }}>
          <h3 style={{ marginBottom: '0.25rem' }}>AI provayder kaliti</h3>
          <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Kalit xavfsiz bazada saqlanadi va <b>.env</b> dan ustun turadi. Serverni qayta
            ishga tushirish shart emas.
          </p>

          {/* joriy holat */}
          <div className="card" style={{ background: 'var(--surface-2, #f4f8fc)', marginBottom: '1rem' }}>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Holat</span>
                <span className={'badge ' + (cur?.configured ? 'ok' : 'muted')}>
                  {cur?.configured ? 'Faol' : 'Sozlanmagan'}
                </span>
              </div>
              {cur?.configured && (
                <>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Provayder</span><span className="cell-strong">{cur.provider}</span>
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Kalit</span><span className="mono">{cur.key_masked}</span>
                  </div>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="muted">Manba</span><span>{SOURCE_LABEL[cur.source] || cur.source}</span>
                  </div>
                  {cur.model && (
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted">Model</span><span className="mono">{cur.model}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* forma */}
          <div className="field">
            <label className="label">Provayder</label>
            <select className="select" value={f.provider} onChange={set('provider')}>
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">API kalit</label>
            <input className="input mono" type="password" autoComplete="off" value={f.api_key}
                   onChange={set('api_key')} placeholder={providerHint || 'API kalitini kiriting'} />
          </div>
          {f.provider === 'custom' && (
            <div className="field">
              <label className="label">Bazaviy URL (base_url)</label>
              <input className="input mono" value={f.base_url} onChange={set('base_url')}
                     placeholder="https://api.example.com/v1" />
            </div>
          )}
          <div className="field">
            <label className="label">Model <span className="faint">(ixtiyoriy — bo‘sh = standart)</span></label>
            <input className="input mono" value={f.model} onChange={set('model')}
                   placeholder="masalan claude-sonnet-4-6 / gpt-4o-mini" />
          </div>

          {err && <div className="inline-err">{err}</div>}
          {ok && <div className="ok-note">{ok}</div>}
          {test && <div className={test.ok ? 'ok-note' : 'inline-err'}>{test.ok ? 'Sinov muvaffaqiyatli: ' : 'Sinov xatosi: '}{test.text}</div>}

          <div className="row" style={{ gap: '0.6rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
            <button className="btn btn-ghost" onClick={runTest} disabled={testing || !cur?.configured}>
              {testing ? 'Sinovda…' : 'Sinash'}
            </button>
            {cur?.source === 'db' && (
              <button className="btn btn-ghost" onClick={clear} disabled={busy}>O‘chirish</button>
            )}
          </div>
        </div>

        <div className="card card-pad" style={{ maxWidth: 420 }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Ma’lumot</h3>
          <ul className="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7, paddingLeft: '1.1rem' }}>
            <li>Kalit kiritilgach <b>AI maslahatchi</b> va hujjat tahlili ishlaydi.</li>
            <li><b>Anthropic</b> kaliti <span className="mono">console.anthropic.com</span> dan olinadi.</li>
            <li>Kalit hech qачон to‘liq ko‘rsatilmaydi — faqat boshi va oxiri.</li>
            <li>“Sinash” tugmasi kichik so‘rov yuborib kalit ishlashini tekshiradi.</li>
            <li>“O‘chirish” — bazadagi kalitni olib tashlaydi; <b>.env</b> bo‘lsa o‘shanga qaytadi.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
