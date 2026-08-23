import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_API_BASE_URL || 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Forward /api/* directly to the FastAPI backend at http://localhost:8000/api/*
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            icons: ['@tabler/icons-react'],
            markdown: ['react-markdown', 'remark-gfm'],
            highlightjs: ['highlight.js'],
          },
        },
      },
    },
  };
});
