import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // @supabase/supabase-js (auth + postgrest + realtime + storage) é o maior
    // peso do bundle. Elevamos o limite do aviso para não sinalizá-lo.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    globals: true,
    // Valores de ambiente fictícios para os testes (apenas chaves públicas VITE_*).
    env: {
      VITE_ADAPTER_MODE: 'mock',
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_PUBLIC_APP_URL: 'http://localhost:5173',
    },
  },
});
