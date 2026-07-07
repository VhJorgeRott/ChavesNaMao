/**
 * Exclusão da própria conta (LGPD, art. 18 V/VI).
 *
 * O usuário autenticado solicita a exclusão; a função resolve a identidade a
 * partir do JWT do header Authorization (nunca do body), registra auditoria e
 * apaga o usuário em auth.users com service_role — user_roles cai em cascata.
 *
 * Deploy: `supabase functions deploy delete-account`
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);

  // service_role só existe aqui no servidor (injetado pelo runtime do Supabase).
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  // entregas.responsavel_id é ON DELETE RESTRICT: excluir quebraria o histórico
  // operacional — bloqueia com orientação em vez de falhar no FK.
  const { count, error: entErr } = await admin
    .from('entregas')
    .select('id', { count: 'exact', head: true })
    .eq('responsavel_id', userId);
  if (entErr) return json({ error: 'internal', message: 'Erro ao verificar vínculos.' }, 500);
  if ((count ?? 0) > 0) {
    return json(
      {
        error: 'possui_entregas',
        message:
          'Sua conta é responsável por entregas registradas. Peça a um administrador ' +
          'para transferir a responsabilidade antes de excluir a conta.',
      },
      409,
    );
  }

  // Auditoria antes do delete (actor = uuid; nenhum dado pessoal em metadata).
  await admin.from('audit_log').insert({
    actor: userId,
    action: 'account.delete_self',
    entity: 'auth.users',
    entity_id: userId,
    metadata: {},
  });

  // user_roles é removido via ON DELETE CASCADE junto com auth.users.
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return json({ error: 'delete_failed', message: 'Falha ao excluir a conta.' }, 500);
  }

  return json({ ok: true });
});
