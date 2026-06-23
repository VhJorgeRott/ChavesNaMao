import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { AppUser, Papel } from '@/domain/types';

/**
 * Login Microsoft Entra ID via provider Azure do Supabase Auth (OIDC).
 *
 * Fluxo: `signInWithOAuth({ provider: 'azure' })` redireciona o navegador ao
 * Supabase → Microsoft → Supabase callback → de volta ao `redirectTo` desta app.
 * O supabase-js troca o `code` por uma sessão (PKCE) e o RLS passa a usar esse
 * JWT. A verificação do token é feita pelo Supabase/Entra — nunca confiamos em
 * claims sem verificação no servidor.
 *
 * Pré-requisitos (ver README → Auth):
 *  - Provider "Azure" habilitado no Supabase (client_id, secret, tenant).
 *  - App no Entra com redirect = callback do Supabase (`.../auth/v1/callback`).
 *  - Esta app (`/auth/callback`) na allow-list de Redirect URLs do Supabase.
 */

function redirectTo(): string {
  return `${window.location.origin}/auth/callback`;
}

/** Inicia o login redirecionando para a Microsoft (via Supabase). */
export async function loginAzure(): Promise<void> {
  // skipBrowserRedirect + navegação explícita: assumimos o controle do redirect
  // (mais previsível que o redirect implícito do supabase-js) e tornamos
  // qualquer falha visível.
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'openid email profile',
      redirectTo: redirectTo(),
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Supabase não retornou a URL de autorização do Azure.');
  window.location.assign(data.url);
}

/**
 * Troca o `?code=` do callback OAuth por uma sessão (PKCE). O code verifier foi
 * gravado no localStorage durante o loginAzure (mesma origem), então o supabase-js
 * o recupera aqui. Retorna a mensagem de erro, se houver, para exibição.
 */
export async function exchangeCode(code: string): Promise<string | null> {
  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  return error ? error.message : null;
}

/** Encerra a sessão do Supabase. */
export async function logoutAzure(): Promise<void> {
  await getSupabase().auth.signOut();
}

/** Sessão atual do Supabase, se houver. */
export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

/** Assina mudanças de sessão (login/logout/refresh). Retorna o unsubscribe. */
export function onAuthChange(cb: (session: Session | null) => void): { unsubscribe: () => void } {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => cb(session));
  return data.subscription;
}

/** Mapeia a sessão do Supabase para o AppUser, carregando o papel de user_roles. */
export async function loadUserFromSession(session: Session): Promise<AppUser> {
  const user = session.user;

  // A falha ao buscar o papel (migrations ausentes, RLS, rede) NÃO deve impedir
  // o login — cai no papel mínimo (equipe_entrega) e só registra um aviso.
  let papel: Papel = 'equipe_entrega';
  try {
    const { data: roleRow, error } = await getSupabase()
      .from('user_roles')
      .select('papel')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) console.warn('[auth] não foi possível ler user_roles:', error.message);
    else if (roleRow?.papel) papel = roleRow.papel as Papel;
  } catch (e) {
    console.warn('[auth] erro ao consultar user_roles:', e);
  }

  const meta = (user.user_metadata ?? {}) as { name?: unknown; full_name?: unknown };
  const nome =
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    user.email ||
    'Usuário';

  return { id: user.id, nome, email: user.email ?? '', papel, ultimaAtividade: null };
}
