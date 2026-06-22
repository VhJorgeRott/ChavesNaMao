-- =============================================================================
-- Chaves na Mão — Tabelas principais
-- =============================================================================
-- Convenções:
--   * id uuid default gen_random_uuid()
--   * FKs com índice explícito (ver final do arquivo)
--   * timestamptz para datas
-- =============================================================================

-- Empreendimentos -------------------------------------------------------------
create table empreendimentos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cidade      text not null,
  uf          char(2) not null,
  created_at  timestamptz not null default now()
);

-- Unidades --------------------------------------------------------------------
create table unidades (
  id                uuid primary key default gen_random_uuid(),
  empreendimento_id uuid not null references empreendimentos (id) on delete restrict,
  identificacao     text not null,
  status            unidade_status not null default 'EM_OBRAS',
  area_m2           numeric(10, 2) not null check (area_m2 > 0),
  created_at        timestamptz not null default now()
);

-- Clientes --------------------------------------------------------------------
-- Dado pessoal (LGPD): coletar o mínimo. Acesso protegido por RLS.
create table clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cpf         char(11) not null,               -- somente dígitos; validado na borda (Zod)
  email       text not null,
  telefone    text not null,
  created_at  timestamptz not null default now(),
  constraint clientes_cpf_digits check (cpf ~ '^[0-9]{11}$')
);

-- Entregas (máquina de estados de 6 etapas) -----------------------------------
create table entregas (
  id              uuid primary key default gen_random_uuid(),
  unidade_id      uuid not null references unidades (id) on delete restrict,
  cliente_id      uuid not null references clientes (id) on delete restrict,
  status          entrega_status not null default 'ABERTURA',
  responsavel_id  uuid not null references auth.users (id) on delete restrict,
  iniciada_em     timestamptz,
  concluida_em    timestamptz,
  created_at      timestamptz not null default now()
);

-- Documentos (PDFs gerados) ---------------------------------------------------
create table documentos (
  id            uuid primary key default gen_random_uuid(),
  entrega_id    uuid not null references entregas (id) on delete cascade,
  tipo          text not null,
  storage_path  text not null,                 -- bucket PRIVADO
  sha256_hash   char(64) not null,             -- integridade do PDF
  gerado_em     timestamptz not null default now(),
  constraint documentos_sha256_hex check (sha256_hash ~ '^[0-9a-f]{64}$')
);

-- Assinaturas -----------------------------------------------------------------
create table assinaturas (
  id                uuid primary key default gen_random_uuid(),
  entrega_id        uuid not null references entregas (id) on delete cascade,
  documento_id      uuid not null references documentos (id) on delete cascade,
  canvas_png_path   text,                       -- bucket PRIVADO (traço do canvas)
  metodo            metodo_assinatura not null,
  ip                inet,
  user_agent        text,
  geo               jsonb,                      -- apenas com consentimento explícito
  assinada_em       timestamptz,
  clicksign_doc_key text,
  clicksign_status  text,
  created_at        timestamptz not null default now()
);

-- Itens entregues (chaves, controles, manuais) --------------------------------
create table itens_entrega (
  id          uuid primary key default gen_random_uuid(),
  entrega_id  uuid not null references entregas (id) on delete cascade,
  descricao   text not null,
  quantidade  integer not null check (quantidade > 0)
);

-- Tokens de acesso do portal do cliente ---------------------------------------
-- Guarda APENAS o hash do token (8.2). O token em claro só existe no link.
create table access_tokens (
  id          uuid primary key default gen_random_uuid(),
  entrega_id  uuid not null references entregas (id) on delete cascade,
  token_hash  char(64) not null unique,        -- sha-256 hex
  expires_at  timestamptz not null,
  used_at     timestamptz,
  scope       text not null default 'assinatura',
  created_at  timestamptz not null default now(),
  constraint access_tokens_hash_hex check (token_hash ~ '^[0-9a-f]{64}$')
);

-- Trilha de auditoria ---------------------------------------------------------
-- NUNCA armazenar dados pessoais, tokens ou secrets em claro em metadata.
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null,                   -- auth.users.id ou 'cliente:token'
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);

-- Índices em todas as FKs e no hash do token ----------------------------------
create index idx_unidades_empreendimento_id on unidades (empreendimento_id);
create index idx_unidades_status            on unidades (status);
create index idx_entregas_unidade_id        on entregas (unidade_id);
create index idx_entregas_cliente_id        on entregas (cliente_id);
create index idx_entregas_responsavel_id    on entregas (responsavel_id);
create index idx_entregas_status            on entregas (status);
create index idx_documentos_entrega_id      on documentos (entrega_id);
create index idx_assinaturas_entrega_id     on assinaturas (entrega_id);
create index idx_assinaturas_documento_id   on assinaturas (documento_id);
create index idx_itens_entrega_entrega_id   on itens_entrega (entrega_id);
create index idx_access_tokens_entrega_id   on access_tokens (entrega_id);
create index idx_access_tokens_token_hash   on access_tokens (token_hash);
create index idx_audit_log_entity           on audit_log (entity, entity_id);
create index idx_audit_log_at               on audit_log (at);
