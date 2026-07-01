import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CRM frontend: 0.0.0.0:4444 da ishlaydi, domen: ipak.elektronbozor.uz
// Barcha API so'rovlari .env dagi VITE_API_URL ga (https://ipak.elektronbozor.uz) ketadi.
const allowedHosts = ['ipak.elektronbozor.uz', '.elektronbozor.uz', 'localhost', '127.0.0.1']

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4444,
    strictPort: true,
    allowedHosts,
  },
  preview: {
    host: '0.0.0.0',
    port: 4444,
    strictPort: true,
    allowedHosts,
  },
})
