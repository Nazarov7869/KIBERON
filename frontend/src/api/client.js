// =====================================================================
//  API MIJOZ — backend bilan aloqa (JWT + barcha endpoint'lar)
// =====================================================================
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

let token = localStorage.getItem('ipak_token') || null

export function setToken(t) {
  token = t
  if (t) localStorage.setItem('ipak_token', t)
  else localStorage.removeItem('ipak_token')
}
export function getToken() {
  return token
}

function qs(obj = {}) {
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '')
  const s = new URLSearchParams(entries).toString()
  return s ? '?' + s : ''
}

async function req(method, path, body) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = 'Bearer ' + token
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* bo'sh javob */
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.error)) || `HTTP ${res.status}`
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  base: BASE,

  auth: {
    login: (email, password) => req('POST', '/api/auth/login', { email, password }),
    register: (payload) => req('POST', '/api/auth/register', payload),
    me: () => req('GET', '/api/auth/me'),
  },

  catalog: {
    summary: () => req('GET', '/api/catalog/summary'),
    products: () => req('GET', '/api/catalog/products'),
    markets: () => req('GET', '/api/catalog/markets'),
    access: (hs, market) => req('GET', '/api/catalog/access' + qs({ hs, market })),
  },

  lots: {
    list: (q) => req('GET', '/api/lots' + qs(q)),
    mine: () => req('GET', '/api/lots/mine'),
    create: (b) => req('POST', '/api/lots', b),
    get: (id) => req('GET', '/api/lots/' + id),
    update: (id, b) => req('PATCH', '/api/lots/' + id, b),
    setQuality: (id, b) => req('PATCH', `/api/lots/${id}/quality`, b),
    remove: (id) => req('DELETE', '/api/lots/' + id),
  },

  rfqs: {
    list: (q) => req('GET', '/api/rfqs' + qs(q)),
    mine: () => req('GET', '/api/rfqs/mine'),
    create: (b) => req('POST', '/api/rfqs', b),
    get: (id) => req('GET', '/api/rfqs/' + id),
    update: (id, b) => req('PATCH', '/api/rfqs/' + id, b),
    remove: (id) => req('DELETE', '/api/rfqs/' + id),
  },

  pools: {
    list: (q) => req('GET', '/api/pools' + qs(q)),
    get: (id) => req('GET', '/api/pools/' + id),
    create: (b) => req('POST', '/api/pools', b),
    addEntry: (id, b) => req('POST', `/api/pools/${id}/entries`, b),
    removeEntry: (id, eid) => req('DELETE', `/api/pools/${id}/entries/${eid}`),
    allocate: (id) => req('POST', `/api/pools/${id}/allocate`),
  },

  orders: {
    list: (q) => req('GET', '/api/orders' + qs(q)),
    get: (id) => req('GET', '/api/orders/' + id),
    create: (b) => req('POST', '/api/orders', b),
    confirm: (id) => req('POST', `/api/orders/${id}/confirm`),
    ship: (id, b) => req('POST', `/api/orders/${id}/ship`, b || {}),
    deliver: (id) => req('POST', `/api/orders/${id}/deliver`),
    cancel: (id) => req('POST', `/api/orders/${id}/cancel`),
  },

  companies: {
    list: () => req('GET', '/api/companies'),
    me: () => req('GET', '/api/companies/me'),
    verify: (id) => req('POST', `/api/companies/${id}/verify`),
  },

  leads: {
    list: (q) => req('GET', '/api/leads' + qs(q)),
    create: (b) => req('POST', '/api/leads', b),
    get: (id) => req('GET', '/api/leads/' + id),
    update: (id, b) => req('PATCH', '/api/leads/' + id, b),
    remove: (id) => req('DELETE', '/api/leads/' + id),
  },

  admin: {
    createUser: (b) => req('POST', '/api/admin/users', b),
  },

  ai: {
    status: () => req('GET', '/api/ai/status'),
    advisor: (question, preview = false) => req('POST', '/api/ai/advisor', { question, preview }),
  },
}
