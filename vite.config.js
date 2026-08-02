import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // three.js is the heavyweight: keep it in one immutable, cacheable chunk
          // so repeat visits (even after app updates) skip re-downloading it.
          if (id.includes('node_modules/three')) return 'three'
        }
      }
    }
  }
})
