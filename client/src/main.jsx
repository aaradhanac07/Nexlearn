import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'

import App from './App'
import './index.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  document.body.innerHTML = '<div style="color:red;padding:2rem;font-family:sans-serif"><h2>Missing VITE_CLERK_PUBLISHABLE_KEY in client/.env</h2></div>'
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

// Catch any uncaught errors and show them instead of a blank page
window.onerror = (msg, src, line, col, err) => {
  const div = document.getElementById('root')
  if (div && !div.querySelector('div')) {
    div.innerHTML = `<div style="color:#f87171;padding:2rem;font-family:monospace;background:#0f172a;min-height:100vh">
      <h2 style="color:#f1f5f9">App crashed — check console</h2>
      <pre style="font-size:13px;white-space:pre-wrap">${msg}\n${src}:${line}</pre>
    </div>`
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
)