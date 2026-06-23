import { useAuth } from '@clerk/clerk-react'
import axios from 'axios'
import { useMemo } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

/**
 * useApi — returns an axios instance pre-configured with
 * the Clerk JWT in the Authorization header.
 *
 * Usage:
 *   const api = useApi()
 *   const { data } = await api.get('/api/courses')
 */
export function useApi() {
  const { getToken } = useAuth()

  const instance = useMemo(() => {
    const ax = axios.create({ baseURL: BASE_URL })

    ax.interceptors.request.use(async config => {
      try {
        const token = await getToken()
        if (token) config.headers.Authorization = `Bearer ${token}`
      } catch {
        // unauthenticated — let the server reject it
      }
      return config
    })

    return ax
  }, [getToken])

  return instance
}
