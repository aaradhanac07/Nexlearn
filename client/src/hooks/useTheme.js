import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('nexlearn-theme') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('nexlearn-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggle }
}
