-- =============================================================================
-- Chaves na Mão — Enums (tipos Postgres)
-- =============================================================================
-- Migrations versionadas; o schema NÃO é criado pela UI. Use o Supabase CLI:
--   supabase db reset   (aplica migrations + seed em ambiente local)
-- =============================================================================

create type unidade_status as enum (
  'EM_OBRAS',
  'DISPONIVEL',
  'VENDIDA',
  'QUITADA',
  'LIBERADA',
  'ENTREGUE'
);

create type entrega_status as enum (
  'ABERTURA',
  'INTEGRACAO',
  'DOCUMENTOS',
  'ASSINATURA',
  'REGISTRO',
  'CONCLUIDA'
);

create type metodo_assinatura as enum ('CANVAS', 'CLICKSIGN');

create type papel as enum ('admin', 'equipe_entrega');
