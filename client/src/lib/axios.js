import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

/** Pre-configured axios instance (no auth header — use useAxios hook for authenticated calls) */
const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
})

export default axiosClient
