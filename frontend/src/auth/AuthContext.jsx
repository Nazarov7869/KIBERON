// =====================================================================
//  AUTH KONTEKSTI — joriy foydalanuvchi, kirish/ro'yxat/chiqish
// =====================================================================
import { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken, getToken } from '../api/client'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      if (getToken()) {
        try {
          setUser(await api.auth.me())
        } catch {
          setToken(null)
        }
      }
      setLoading(false)
    })()
  }, [])

  async function login(email, password) {
    const r = await api.auth.login(email, password)
    setToken(r.access_token)
    setUser(r.user)
    return r
  }

  async function register(payload) {
    const r = await api.auth.register(payload)
    setToken(r.access_token)
    setUser(r.user)
    return r
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)

// rol -> o'zbekcha nom
export const ROLE_LABEL = {
  super_admin: 'Operator (hokimlik)',
  exporter: 'Eksportyor',
  importer: 'Importyor',
  logistics: 'Logistika',
  warehouse: 'Ombor',
  embassy: 'Elchixona',
}
