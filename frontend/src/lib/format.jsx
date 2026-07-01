// =====================================================================
//  FORMAT — pul, hajm, sana + holat nishonlari
// =====================================================================
export const fmtMoney = (n) =>
  n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })

export const fmtQty = (n) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' t'

export const fmtDate = (s) => {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return s
  }
}

export const GRADE = { 1: '1-nav', 2: '2-nav', 3: '3-nav' }

export const INCOTERMS = ['exw', 'fca', 'fob', 'cfr', 'cif', 'cpt', 'cip', 'dap', 'ddp']
export const TRANSPORT = ['rail', 'sea', 'road', 'air', 'multimodal']
export const CONTAINERS = ['c20', 'c40', 'c40hc', 'reefer']

export const LOT_STATUS = {
  complete: { label: 'Tayyor', cls: 'info' },
  pooling: { label: "Yig'ishda", cls: 'warn' },
  matched: { label: 'Biriktirilgan', cls: 'ok' },
  shipped: { label: "Jo'natilgan", cls: 'info' },
  closed: { label: 'Yopilgan', cls: '' },
}

export const RFQ_STATUS = {
  open: { label: 'Ochiq', cls: 'ok' },
  closed: { label: 'Yopiq', cls: '' },
  cancelled: { label: 'Bekor', cls: 'bad' },
}

export const POOL_STATUS = {
  forming: { label: "Yig'ilmoqda", cls: 'warn' },
  full: { label: "To'ldi", cls: 'info' },
  matched: { label: 'Taqsimlandi', cls: 'ok' },
  shipped: { label: "Jo'natildi", cls: 'info' },
  closed: { label: 'Yopildi', cls: '' },
  cancelled: { label: 'Bekor', cls: 'bad' },
}

export const ORDER_STATUS = {
  draft: { label: 'Qoralama', cls: '' },
  confirmed: { label: 'Tasdiqlangan', cls: 'info' },
  in_transit: { label: "Yo'lda", cls: 'warn' },
  delivered: { label: 'Yetkazilgan', cls: 'ok' },
  closed: { label: 'Yopilgan', cls: '' },
  cancelled: { label: 'Bekor', cls: 'bad' },
}

export const QUALITY_STATUS = {
  pending: { label: 'Tekshirilmagan', cls: '' },
  passed: { label: 'Sifatli', cls: 'ok' },
  rejected: { label: 'Rad etilgan', cls: 'bad' },
}

export const PAYOUT_STAGE = {
  advance: { label: 'Avans', cls: 'info' },
  balance: { label: 'Balans', cls: 'ok' },
  commission: { label: 'Komissiya', cls: 'warn' },
}

export function Badge({ map, value }) {
  const it = (map && map[value]) || { label: value, cls: '' }
  return <span className={'badge ' + it.cls}>{it.label}</span>
}
