import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Live search goes through the local API (npm run api) so the Apify token stays off the browser.
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
})
