-- =============================================================================
-- Chaves na Mão — Log de atividade (tela de admin)
-- =============================================================================
-- Objetivo: permitir que o app registre a própria atividade do usuário
-- (login/logout, navegação, ações) na tabela audit_log já existente, e que um
-- admin liste todos os usuários da plataforma (auth.users não é exposto ao
-- cliente). A LEITURA do audit_log continua admin-only (policy já existente).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- audit_log: além do service_role, o usuário autenticado pode inserir linhas
-- atribuídas A SI MESMO. O `with check (actor = auth.uid())` impede forjar
-- atividade de terceiros. Leitura permanece restrita a admin.
-- ---------------------------------------------------------------------------
create policy audit_log_insert_self on audit_log
  for insert to authenticated
  with check (actor = auth.uid()::text);

-- Consultas do feed filtram/ordenam por ator e data.
create index if not exists audit_log_actor_at_idx on audit_log (actor, at desc);

-- ---------------------------------------------------------------------------
-- admin_list_users(): lista todos os usuários (identidade em auth.users +
-- papel em user_roles). SECURITY DEFINER para ler auth.users; guardada por
-- is_admin() para que só administradores obtenham a lista. search_path fixado.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  id                uuid,
  email             text,
  nome              text,
  avatar_url        text,
  papel             papel,
  created_at        timestamptz,
  last_sign_in_at   timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    u.id,
    u.email::text,
    coalesce(
      u.raw_user_meta_data ->> 'name',
      u.raw_user_meta_data ->> 'full_name'
    ) as nome,
    coalesce(
      u.raw_user_meta_data ->> 'avatar_url',
      u.raw_user_meta_data ->> 'picture'
    ) as avatar_url,
    coalesce(ur.papel, 'equipe_entrega'::papel) as papel,
    u.created_at,
    u.last_sign_in_at
  from auth.users u
  left join public.user_roles ur on ur.user_id = u.id
  where public.is_admin()   -- não-admin: predicado falso => zero linhas
  order by u.last_sign_in_at desc nulls last;
$$;

grant execute on function public.admin_list_users() to authenticated;
