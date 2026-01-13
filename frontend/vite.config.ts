import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Localhost only
    // Use the Vite default port to avoid environments that restrict 3000.
    port: 5173,
    strictPort: false, // Try next available port if 3000 is taken
    open: true, // Automatically open browser
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // Disable buffering for streaming responses
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Check if this is a streaming response
            if (proxyRes.headers['content-type']?.includes('event-stream') ||
                proxyRes.headers['content-type']?.includes('application/json')) {
              // Disable buffering
              proxyRes.headers['x-accel-buffering'] = 'no'
              proxyRes.headers['cache-control'] = 'no-cache'
            }
          })
        },
      },
    },
  },
})

