import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['recharts'],
  },
  resolve: {
    alias: {
      // Force recharts to use the CJS build (fixes require_isUnsafeProperty error)
    },
  },
})
