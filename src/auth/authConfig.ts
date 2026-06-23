import { env } from '@/lib/env';

/**
 * Configuração de autenticação.
 *
 * Login interno via Microsoft Entra ID usando o provider Azure do Supabase Auth
 * (OIDC) — o próprio Supabase orquestra o fluxo OAuth com a Microsoft. Não há
 * senha própria. Quando o Supabase não está configurado, a app cai num modo de
 * desenvolvimento (sessão local) para continuar navegável.
 */

/** True quando há backend de auth (Supabase) configurado para o login real. */
export const isAuthConfigured: boolean = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY,
);
