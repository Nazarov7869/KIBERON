// =====================================================================
//  SILK ROAD logotipi — kompas yulduzi (SVG) + so'z belgisi
//  variant: 'full' (belgi + matn) | 'mark' (faqat belgi)
//  theme:   'light' (och fon — SILK qora) | 'dark' (to'q fon — SILK oq)
//  Har nusxa uchun gradient ID'lari noyob (bir sahifada bir nechta bo'lsa).
// =====================================================================
import { useRef } from 'react'

let _uid = 0

export function LogoMark({ size = 34, className = '' }) {
  const idRef = useRef(null)
  if (idRef.current === null) idRef.current = ++_uid
  const u = idRef.current
  const R = `lgR${u}`, L = `lgL${u}`, D = `lgD${u}`
  return (
    <svg
      className={'logo-mark ' + className}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={R} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7DB86" /><stop offset="0.5" stopColor="#E0AF48" /><stop offset="1" stopColor="#B87E1C" />
        </linearGradient>
        <linearGradient id={L} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FCE7A6" /><stop offset="1" stopColor="#E9BE5C" />
        </linearGradient>
        <linearGradient id={D} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C88F24" /><stop offset="1" stopColor="#9A6A15" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${R})`} />
      <circle cx="50" cy="50" r="42.2" fill="#23282F" />
      {/* kompas yulduzi — vertikal cho'zilgan, pinwheel qirralar */}
      <path d="M50,50 L50,13 L42,42 Z" fill={`url(#${L})`} />
      <path d="M50,50 L79,50 L58,42 Z" fill={`url(#${L})`} />
      <path d="M50,50 L50,87 L58,58 Z" fill={`url(#${L})`} />
      <path d="M50,50 L21,50 L42,58 Z" fill={`url(#${L})`} />
      <path d="M50,50 L50,13 L58,42 Z" fill={`url(#${D})`} />
      <path d="M50,50 L79,50 L58,58 Z" fill={`url(#${D})`} />
      <path d="M50,50 L50,87 L42,58 Z" fill={`url(#${D})`} />
      <path d="M50,50 L21,50 L42,42 Z" fill={`url(#${D})`} />
      <path d="M50,13 L58,42 L79,50 L58,58 L50,87 L42,58 L21,50 L42,42 Z"
        fill="none" stroke="#8A6316" strokeWidth="0.6" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="5.4" fill="#23282F" />
      <circle cx="50" cy="50" r="5.4" fill="none" stroke={`url(#${R})`} strokeWidth="1.1" />
    </svg>
  )
}

export default function Logo({
  variant = 'full',
  theme = 'light',
  size = 34,
  showSub = true,
  className = '',
}) {
  if (variant === 'mark') {
    return (
      <span className={'logo logo--mark ' + className}>
        <LogoMark size={size} />
      </span>
    )
  }
  return (
    <span className={`logo logo--${theme} ${className}`}>
      <LogoMark size={size} />
      <span className="logo-word">
        <span className="logo-top">
          <span className="logo-silk">SILK</span>
          <span className="logo-road">ROAD</span>
        </span>
        {showSub && <span className="logo-sub">EXPORT INTELLIGENCE MAP</span>}
      </span>
    </span>
  )
}
