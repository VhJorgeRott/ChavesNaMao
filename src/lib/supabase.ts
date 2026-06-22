import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Cliente Supabase do navegador, autenticado apenas com a ANON KEY (pública).
 *
 * A anon key, combinada com RLS deny-by-default no banco, só enxerga o escopo
 * público mínimo. Operações sensíveis NÃO usam este cliente: passam por Edge
 * Functions com service_role no servidor. A service_role key jamais é embutida
 * no bundle.
 */
export const supabase: SupabaseClient = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
