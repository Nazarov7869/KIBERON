// =====================================================================
//  SIGNATURA KOMPONENT — POOL-FILL
//  Konteyner sig'imi hissadorlar ulushlari bo'yicha segmentlangan chiziq.
//  Platformaning "yig'ish/birlashtirish" g'oyasini ko'rsatadi.
// =====================================================================

// hissadorlarga barqaror rang (majolika oralig'idan)
const PALETTE = ['#0e8f8c', '#27508f', '#c77f1e', '#2e78c2', '#6e5aa6', '#c2497a', '#1e9e61', '#9a6f08']

export function segColor(i) {
  return PALETTE[i % PALETTE.length]
}

export default function PoolFill({ target, segments = [], clearing, unit = 't' }) {
  const filled = segments.reduce((s, x) => s + (Number(x.qty) || 0), 0)
  const denom = Math.max(target, filled) || 1
  const pct = target > 0 ? (filled / target) * 100 : 0
  const over = filled > target + 1e-9
  const remaining = Math.max(0, target - filled)

  return (
    <div className="poolfill">
      <div className="poolfill-top">
        <span className="poolfill-cap mono">
          {round(filled)} / {round(target)} {unit}
        </span>
        <span className="poolfill-pct mono">
          {pct.toFixed(0)}% {over ? '(ortiqcha)' : "to'ldi"}
        </span>
      </div>

      <div className="poolfill-bar" role="img" aria-label={`Konteyner ${pct.toFixed(0)}% to'ldi`}>
        {segments.map((s, i) => {
          const w = (Number(s.qty) / denom) * 100
          if (w <= 0) return null
          return (
            <div
              key={s.id || i}
              className="poolfill-seg"
              style={{ width: `${w}%`, background: s.color || segColor(i) }}
              title={`${s.name}: ${round(s.qty)} ${unit} (${((Number(s.qty) / (target || denom)) * 100).toFixed(1)}%)`}
            >
              {w > 8 && <span className="poolfill-seg-label">{initials(s.name)}</span>}
            </div>
          )
        })}
        {!over && remaining > 0 && (
          <div className="poolfill-empty tile-bg" style={{ width: `${(remaining / denom) * 100}%` }} />
        )}
      </div>

      {clearing != null && (
        <div className="poolfill-clearing mono">
          Clearing narx: <strong>${round(clearing)}</strong>/{unit}
        </div>
      )}

      {segments.length > 0 && (
        <div className="poolfill-legend">
          {segments.map((s, i) => (
            <div className="poolfill-leg" key={s.id || i}>
              <span className="poolfill-swatch" style={{ background: s.color || segColor(i) }} />
              <span className="poolfill-leg-name">{s.name}</span>
              <span className="mono faint">
                {round(s.qty)} {unit} · {target > 0 ? ((Number(s.qty) / target) * 100).toFixed(1) : 0}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function round(n) {
  const x = Number(n) || 0
  return Math.round(x * 1000) / 1000
}
function initials(name = '') {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
