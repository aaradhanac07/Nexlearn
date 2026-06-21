import axios from 'axios'
import { useAuth } from '@clerk/clerk-react'
import { useMemo } from 'react'

export function useAxios() {
  const { getToken } = useAuth()

  return useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL,
    })
    instance.interceptors.request.use(async (config) => {
      const token = await getToken()
      if (token) config.headers.Authorization = `Bearer ${token}`
      return config
    })
    return instance
  }, [getToken])
}