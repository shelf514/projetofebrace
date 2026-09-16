/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_URL || 'http://localhost:8000'
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: (id: string) => {
            if (id.includes('node_modules')) {
              if (id.includes('recharts')) return 'charts';
              if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/'))
                return 'vendor';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      host: true,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
        '/ws': {
          target: target.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
      },
    },
  }
})
