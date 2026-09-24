# 6. Papéis (RBAC), RLS e o banco

O login te diz **quem** é o usuário. O RBAC diz **o que** ele pode fazer. Aqui a
regra de ouro: **a verdade do papel vive no servidor** (tabela `user_roles` +
RLS). O cliente nunca informa o próprio papel — ele é *lido* do banco depois do
login (ver `loadUserFromSession` em [05-codigo-frontend.md](05-codigo-frontend.md)).

## O enum de papéis

```sql
create type papel as enum ('admin', 'equipe_entrega');
```

Adapte os nomes ao seu domínio (ex. `'admin' | 'user'`).

## Tabela `user_roles`

```sql
-- A verdade do papel mora no servidor; o cliente NUNCA o informa.
create table user_roles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  papel      papel not null default 'equipe_entrega',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`user_id` referencia `auth.users` — a tabela de usuários que o **Supabase** cria
automaticamente quando alguém loga via Entra. `on delete cascade` limpa o papel se
o usuário for removido.

## Funções auxiliares de autorização

`SECURITY DEFINER` para consultar `user_roles` sem recursão de RLS; `search_path`
fixado para evitar hijack; `stable` porque só lêem dentro da transação.

```sql
create or replace function public.user_has_role(required papel[])
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.papel = any(required)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.user_has_role(array['admin']::papel[]);
$$;

-- Qualquer usuário interno com papel atribuído.
create or replace function public.is_equipe()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.user_has_role(array['admin', 'equipe_entrega']::papel[]);
$$;
```

`auth.uid()` é a função do Supabase que retorna o `id` do usuário do JWT da
sessão. É assim que o banco sabe "quem está pedindo".

## RLS na própria `user_roles`

Deny-by-default: habilite RLS e crie só as políticas necessárias.

```sql
alter table user_roles enable row level security;

-- Cada usuário LÊ o próprio papel (a UI usa p/ esconder ações);
-- admin gerencia todos.
create policy user_roles_select_self_or_admin on user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy user_roles_insert_admin on user_roles
  for insert to authenticated
  with check (public.is_admin());

create policy user_roles_update_admin on user_roles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy user_roles_delete_admin on user_roles
  for delete to authenticated
  using (public.is_admin());
```

> O `select` liberando o próprio papel é o que faz `loadUserFromSession` conseguir
> ler `papel` logo após o login. Sem essa policy, a leitura falha e o usuário cai
> no papel mínimo (o app não quebra, mas ninguém vira admin).

## Usando os papéis nas suas tabelas de negócio

Em cada tabela de dados, habilite RLS e use as funções:

```sql
alter table minha_tabela enable row level security;

-- Equipe interna (admin OU equipe) pode operar; DELETE fica negado (sem policy).
create policy minha_tabela_rw on minha_tabela
  for all to authenticated
  using (public.is_equipe()) with check (public.is_equipe());
```

## Promover o primeiro admin (o "ovo e a galinha")

Como só admin pode inserir em `user_roles`, o **primeiro** admin precisa ser
criado fora do RLS — pelo **SQL Editor** do Supabase (que roda como `service_role`):

1. O usuário faz **login uma vez** via Microsoft (isso cria a linha em `auth.users`).
2. Descubra o `id` dele: **Authentication → Users** no painel, ou:
   ```sql
   select id, email from auth.users order by created_at desc;
   ```
3. Promova:
   ```sql
   insert into user_roles (user_id, papel)
   values ('<auth-user-uuid>', 'admin')
   on conflict (user_id) do update set papel = 'admin';
   ```

A partir daí, esse admin promove os demais pela própria UI (tela de gestão de
usuários), sempre passando pelo RLS.

## Onde isso mora no projeto de referência

```
supabase/migrations/
├── 20240101000001_enums.sql          # create type papel ...
├── 20240101000002_core_tables.sql    # tabelas de negócio
├── 20240101000003_rbac_and_guards.sql# user_roles + funções + triggers
└── 20240101000004_rls_policies.sql   # todas as policies (incl. user_roles)
```

Versione o schema em migrations — **nunca** crie tabela pela UI do Supabase.

Próximo: [07-checklist-replicacao.md](07-checklist-replicacao.md).
