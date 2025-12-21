import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  base: '/photo-splat-gallery/',
  server: {
    host: true, // Allow LAN access
    // https: true // Handled by basicSsl plugin
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    },
    watch: {
      ignored: ['**/.venv/**', '**/node_modules/**']
    }
  },
  preview: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
