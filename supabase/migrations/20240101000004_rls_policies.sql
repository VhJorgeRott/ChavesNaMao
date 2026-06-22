-- =============================================================================
-- Chaves na Mão — Row Level Security (DENY BY DEFAULT)
-- =============================================================================
-- Princípios (seção 8):
--   * RLS habilitado em TODAS as tabelas, sem exceção.
--   * Sem política => acesso negado. A `anon key` não enxerga NADA: o portal do
--     cliente acessa exclusivamente via Edge Functions com service_role, que
--     validam o token e ignoram RLS de forma controlada.
--   * Usuários internos (authenticated) agem conforme o papel (RBAC).
--   * Tabelas sensíveis (access_tokens, audit_log) não têm política de cliente.
-- =============================================================================

alter table empreendimentos enable row level security;
alter table unidades        enable row level security;
alter table clientes        enable row level security;
alter table entregas        enable row level security;
alter table documentos      enable row level security;
alter table assinaturas     enable row level security;
alter table itens_entrega   enable row level security;
alter table access_tokens   enable row level security;
alter table audit_log       enable row level security;
alter table user_roles      enable row level security;

-- ---------------------------------------------------------------------------
-- Tabelas operacionais: equipe interna (admin OU equipe_entrega) opera tudo.
-- SELECT / INSERT / UPDATE. DELETE permanece negado (sem política).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'empreendimentos', 'unidades', 'clientes',
    'entregas', 'documentos', 'assinaturas', 'itens_entrega'
  ]
  loop
    execute format(
      'create policy %1$I_select on %1$I for select to authenticated using (public.is_equipe());',
      t
    );
    execute format(
      'create policy %1$I_insert on %1$I for insert to authenticated with check (public.is_equipe());',
      t
    );
    execute format(
      'create policy %1$I_update on %1$I for update to authenticated using (public.is_equipe()) with check (public.is_equipe());',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- access_tokens: NENHUMA política de cliente. Apenas service_role (Edge
-- Functions) cria/valida tokens. RLS habilitado garante negação total ao
-- anon e ao authenticated. (Sem CREATE POLICY de propósito.)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- audit_log: somente admin pode LER. Escrita é exclusiva do service_role.
-- ---------------------------------------------------------------------------
create policy audit_log_select_admin on audit_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- user_roles (RBAC): admin gerencia tudo; cada usuário pode LER o próprio papel
-- (necessário para a UI esconder ações — a checagem definitiva é server-side).
-- ---------------------------------------------------------------------------
create policy user_roles_select_self_or_admin on user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy user_roles_insert_admin on user_roles
  for insert to authenticated
  with check (public.is_admin());

create policy user_roles_update_admin on user_roles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy user_roles_delete_admin on user_roles
  for delete to authenticated
  using (public.is_admin());
