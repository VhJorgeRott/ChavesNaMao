import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Cliente Supabase do navegador, autenticado apenas com a ANON KEY (pública).
 *
 * A anon key, combinada com RLS deny-by-default no banco, só enxerga o escopo
 * público mínimo. Operações sensíveis NÃO usam este cliente: passam por Edge
 * Functions com service_role no servidor. A service_role key jamais é embutida
 * no bundle.
 *
 * Instanciação preguiçosa: em ADAPTER_MODE=mock o app funciona sem Supabase
 * configurado. O cliente só é criado (e exige URL + anon key) quando realmente
 * usado.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env ' +
        '(veja .env.example) para usar o backend real.',
    );
  }
  client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // false: trocamos o ?code por sessão explicitamente em /auth/callback
      // (exchangeCodeForSession), para controlar o timing e expor erros — em vez
      // do auto-processamento, que corria com o guard de rota.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  // Apenas em desenvolvimento: handle para diagnóstico no console do navegador.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__supabase = client;
  }
  return client;
}
