import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA: o app precisa ABRIR sem internet (inspeções de qualidade em obra sem
    // sinal). O service worker guarda o "casco" do app (JS/CSS/HTML); os dados
    // offline ficam no IndexedDB (src/qualidade). Chamadas ao Supabase e às
    // integrações NÃO são cacheadas — são de outra origem e sempre ao vivo.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'Chaves na Mão',
        short_name: 'Chaves na Mão',
        description: 'Atendimento, qualidade e entrega de obra — Rottas',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#f5f5f4',
        theme_color: '#f59229',
        icons: [
          { src: '/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Margem acima do padrão (2 MB) para o bundle principal crescer sem sair do cache.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@chaves/domain': fileURLToPath(new URL('./packages/domain/src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Falha explicitamente se a 5173 estiver ocupada, em vez de pular para
    // outra porta — assim o redirect_uri do OAuth nunca fica inconsistente.
    strictPort: true,
  },
  build: {
    // @supabase/supabase-js (auth + postgrest + realtime + storage) é o maior
    // peso do bundle. Elevamos o limite do aviso para não sinalizá-lo.
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'packages/*/src/**/*.{test,spec}.ts'],
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
