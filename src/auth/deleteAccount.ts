import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

/**
 * Exclui a conta do usuário logado via Edge Function `delete-account` (LGPD).
 * O supabase-js envia o access token da sessão no header Authorization; a
 * função valida o JWT e apaga o usuário com service_role no servidor.
 * Lança Error com mensagem exibível ao usuário.
 */
export async function deleteAccountRemote(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? 'Falha ao excluir a conta. Tente novamente.');
    }
    throw new Error('Falha ao excluir a conta. Verifique sua conexão e tente novamente.');
  }

  // O usuário já não existe no servidor — limpamos apenas a sessão local
  // (signOut global falharia contra um usuário deletado).
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}
