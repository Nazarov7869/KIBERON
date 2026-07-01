// =====================================================================
//  AI MASLAHATCHI — chat (grounding) + preview rejim
// =====================================================================
import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

const SUGGESTIONS = [
  "Quritilgan o'rikni qaysi bozorga sotsam bo'ladi?",
  'Yangi keluvchi kvotasi qanday ishlaydi?',
  'Clearing narx qanday hisoblanadi?',
  'Escrow va to\'lov bosqichlari qanday?',
]

export default function Advisor() {
  const [msgs, setMsgs] = useState([])
  const [q, setQ] = useState('')
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [provider, setProvider] = useState(undefined)
  const logRef = useRef(null)

  useEffect(() => {
    api.ai.status().then((d) => setProvider(d.provider)).catch(() => setProvider(null))
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [msgs, busy])

  async function send(question) {
    const text = (question ?? q).trim()
    if (!text || busy) return
    setQ('')
    setMsgs((m) => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const r = await api.ai.advisor(text, preview)
      if (r.preview) {
        setMsgs((m) => [...m, { role: 'ctx', text: r.context }])
      } else {
        setMsgs((m) => [...m, { role: 'ai', text: r.answer }])
      }
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: 'ai', text: (e.message || 'Xatolik') + (e.status === 503 ? "\n\n(Maslahatchini sinash uchun \"Faqat kontekst\" rejimini yoqing.)" : '') },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>AI maslahatchi</h1>
        <p className="muted">Platformaning haqiqiy ma'lumotiga asoslangan eksport maslahati</p>
      </div>

      {provider === null && (
        <div className="ai-banner">
          AI provayder sozlanmagan. Backend <span className="mono">.env</span> da kalit qo'shing yoki
          <strong> "Faqat kontekst"</strong> rejimida yig'ilgan ma'lumotni ko'ring.
        </div>
      )}
      {provider && (
        <div className="opt-row" style={{ marginBottom: '0.6rem' }}>
          Provayder: <span className="badge ok">{provider}</span>
        </div>
      )}

      <div className="chat">
        <div className="chat-log" ref={logRef}>
          {msgs.length === 0 ? (
            <div className="chat-empty">
              <div className="brand-mark" style={{ margin: '0 auto 0.8rem' }} />
              <p>Eksport, bozorlar yoki platforma haqida so'rang.</p>
              <div className="col" style={{ gap: '0.4rem', marginTop: '0.8rem' }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="btn btn-sm" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            msgs.map((m, i) => (
              <div key={i} className={'msg ' + m.role}>
                {m.role === 'ctx' && <div className="faint" style={{ marginBottom: '0.4rem', fontWeight: 600 }}>Yig'ilgan kontekst (LLM chaqirilmadi):</div>}
                {m.text}
              </div>
            ))
          )}
          {busy && <div className="msg ai faint">…</div>}
        </div>

        <div className="opt-row" style={{ paddingTop: '0.6rem' }}>
          <input type="checkbox" id="prev" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
          <label htmlFor="prev">Faqat kontekst (LLMsiz — qanday ma'lumot yig'ilishini ko'rsatadi)</label>
        </div>

        <div className="chat-input">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            placeholder="Savolingizni yozing…"
          />
          <button className="btn btn-primary" onClick={() => send()} disabled={busy || !q.trim()}>Yuborish</button>
        </div>
      </div>
    </div>
  )
}
