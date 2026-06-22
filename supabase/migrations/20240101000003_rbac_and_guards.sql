-- =============================================================================
-- Chaves na Mão — RBAC (papéis) + funções auxiliares + guardas de integridade
-- =============================================================================

-- Papel por usuário -----------------------------------------------------------
-- A verdade do papel mora no servidor; o cliente NUNCA o informa.
create table user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  papel      papel not null default 'equipe_entrega',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Funções auxiliares de autorização -------------------------------------------
-- SECURITY DEFINER para consultar user_roles sem recursão de RLS. search_path
-- fixado para evitar hijack. STABLE pois lê apenas dentro da transação.

create or replace function public.user_has_role(required papel[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.papel = any(required)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.user_has_role(array['admin']::papel[]);
$$;

-- Qualquer usuário interno com papel atribuído (admin OU equipe_entrega).
create or replace function public.is_equipe()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.user_has_role(array['admin', 'equipe_entrega']::papel[]);
$$;

-- Guarda da máquina de estados (Insecure Design — não pular etapas) -----------
-- Reforça no banco a mesma regra do src/domain/state-machine.ts. Defesa em
-- profundidade: mesmo que a UI ou uma Edge Function falhe, o banco recusa.
create or replace function public.enforce_entrega_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'ABERTURA'   and new.status = 'INTEGRACAO') or
    (old.status = 'INTEGRACAO' and new.status = 'DOCUMENTOS') or
    (old.status = 'DOCUMENTOS' and new.status = 'ASSINATURA') or
    (old.status = 'ASSINATURA' and new.status = 'REGISTRO')   or
    (old.status = 'REGISTRO'   and new.status = 'CONCLUIDA')
  ) then
    raise exception 'Transição de entrega inválida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_entrega_transition
  before update of status on entregas
  for each row
  execute function public.enforce_entrega_transition();

-- updated_at automático em user_roles -----------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_roles_touch
  before update on user_roles
  for each row
  execute function public.touch_updated_at();
