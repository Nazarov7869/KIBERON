// =====================================================================
//  CandleChart — trading uslubidagi sham (candlestick) + hajm grafigi
//  Sof <canvas> (tashqi kutubxonasiz). Yashil = o'sish, qizil = tushish.
//  Sichqoncha ustiga kelganda crosshair + OHLC tooltip ko'rsatadi.
// =====================================================================
import { useEffect, useRef, useState } from 'react'

const UP = '#1E7BC2'      // o'sish (ko'k-yashil palitraga mos)
const DOWN = '#B2432F'    // tushish
const GRID = 'rgba(120,140,160,0.16)'
const AXIS = '#90A2B4'
const CROSS = 'rgba(19,99,223,0.55)'

function niceNum(v) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default function CandleChart({ candles = [], height = 380 }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [hover, setHover] = useState(null)      // {x, y, i}
  const [w, setW] = useState(800)

  // kenglikni kuzatish (responsive)
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0].contentRect.width
      if (cw) setW(Math.max(320, Math.floor(cw)))
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, w, height, hover])

  function layout() {
    const padL = 8, padR = 62, padT = 12, padB = 22
    const volH = Math.round(height * 0.18)
    const priceH = height - padT - padB - volH - 8
    return { padL, padR, padT, padB, volH, priceH, plotW: w - padL - padR }
  }

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = height * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = height + 'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, height)
    if (!candles.length) {
      ctx.fillStyle = AXIS
      ctx.font = '13px Manrope, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Ma’lumot yo‘q', w / 2, height / 2)
      return
    }

    const { padL, padR, padT, priceH, volH, plotW } = layout()
    const n = candles.length
    let lo = Infinity, hi = -Infinity, vmax = 0
    for (const c of candles) {
      if (c.l < lo) lo = c.l
      if (c.h > hi) hi = c.h
      if (c.v > vmax) vmax = c.v
    }
    const pad = (hi - lo) * 0.08 || hi * 0.05 || 1
    lo -= pad; hi += pad
    const priceTop = padT
    const priceBot = padT + priceH
    const volTop = priceBot + 8
    const volBot = volTop + volH

    const xFor = (i) => padL + (plotW * (i + 0.5)) / n
    const yFor = (p) => priceBot - ((p - lo) / (hi - lo)) * priceH
    const cw = Math.max(1, Math.min(16, (plotW / n) * 0.66))

    // gorizontal grid + narx yorliqlari (o'ngda)
    ctx.font = '11px Manrope, sans-serif'
    ctx.textBaseline = 'middle'
    const steps = 5
    for (let s = 0; s <= steps; s++) {
      const p = lo + ((hi - lo) * s) / steps
      const y = yFor(p)
      ctx.strokeStyle = GRID
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke()
      ctx.fillStyle = AXIS
      ctx.textAlign = 'left'
      ctx.fillText(niceNum(p), padL + plotW + 6, y)
    }

    // shamlar
    for (let i = 0; i < n; i++) {
      const c = candles[i]
      const up = c.c >= c.o
      const col = up ? UP : DOWN
      const x = xFor(i)
      // piltik (wick)
      ctx.strokeStyle = col
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, yFor(c.h)); ctx.lineTo(x, yFor(c.l)); ctx.stroke()
      // tana (body)
      const yO = yFor(c.o), yC = yFor(c.c)
      const top = Math.min(yO, yC)
      const bh = Math.max(1, Math.abs(yC - yO))
      ctx.fillStyle = col
      ctx.fillRect(x - cw / 2, top, cw, bh)
      // hajm
      const vh = vmax ? (c.v / vmax) * volH : 0
      ctx.globalAlpha = 0.5
      ctx.fillRect(x - cw / 2, volBot - vh, cw, vh)
      ctx.globalAlpha = 1
    }

    // crosshair + tooltip
    if (hover && hover.i != null && candles[hover.i]) {
      const i = hover.i
      const c = candles[i]
      const x = xFor(i)
      ctx.strokeStyle = CROSS
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, priceTop); ctx.lineTo(x, volBot); ctx.stroke()
      if (hover.y >= priceTop && hover.y <= priceBot) {
        ctx.beginPath(); ctx.moveTo(padL, hover.y); ctx.lineTo(padL + plotW, hover.y); ctx.stroke()
      }
      ctx.setLineDash([])

      // tooltip
      const up = c.c >= c.o
      const lines = [
        c.t,
        `O ${niceNum(c.o)}   H ${niceNum(c.h)}`,
        `L ${niceNum(c.l)}   C ${niceNum(c.c)}`,
        `Hajm ${niceNum(c.v)} t`,
      ]
      ctx.font = '11px Manrope, sans-serif'
      const tw = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 16
      const th = lines.length * 15 + 10
      let tx = x + 10
      if (tx + tw > padL + plotW) tx = x - tw - 10
      const ty = Math.min(Math.max(priceTop, (hover.y || priceTop) - th / 2), volBot - th)
      ctx.fillStyle = 'rgba(6,40,61,0.92)'
      ctx.strokeStyle = up ? UP : DOWN
      ctx.lineWidth = 1
      roundRect(ctx, tx, ty, tw, th, 6)
      ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      lines.forEach((t, k) => ctx.fillText(t, tx + 8, ty + 6 + k * 15))
    }
  }

  function roundRect(ctx, x, y, w2, h2, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w2, y, x + w2, y + h2, r)
    ctx.arcTo(x + w2, y + h2, x, y + h2, r)
    ctx.arcTo(x, y + h2, x, y, r)
    ctx.arcTo(x, y, x + w2, y, r)
    ctx.closePath()
  }

  function onMove(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const { padL, padR } = layout()
    const plotW = w - padL - padR
    const n = candles.length
    if (n === 0) return
    let i = Math.floor(((x - padL) / plotW) * n)
    i = Math.max(0, Math.min(n - 1, i))
    setHover({ x, y, i })
  }

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', width: '100%', cursor: 'crosshair' }}
      />
    </div>
  )
}
