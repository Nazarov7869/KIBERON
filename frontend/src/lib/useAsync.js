// =====================================================================
//  useAsync — yuklash/xato/qayta yuklash holati
// =====================================================================
import { useState, useEffect, useCallback } from 'react'

export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => {
    setLoading(true)
    setError('')
    return fn()
      .then((d) => {
        setData(d)
        return d
      })
      .catch((e) => setError(e.message || 'Xatolik'))
      .finally(() => setLoading(false))
  }, deps)

  useEffect(() => {
    run()
  }, [run])

  return { data, loading, error, reload: run, setData }
}
