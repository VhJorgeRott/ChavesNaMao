-- =============================================================================
-- Chaves na Mão — garante o índice único de external_ref em documentos e itens
-- =============================================================================
-- Reparo de uma armadilha da 20240101000008, que escreveu:
--
--   alter table documentos add column if not exists external_ref text unique;
--
-- `add column if not exists` é tudo ou nada: se a coluna JÁ existe, o Postgres
-- pula a cláusula inteira — inclusive o `unique`. O resultado é uma coluna sem
-- índice único, e aí o upsert do app (`on_conflict=external_ref`) falha com
-- 42P10 ("no unique or exclusion constraint matching the ON CONFLICT
-- specification"), que o PostgREST devolve ao navegador como HTTP 500. Sintoma
-- visível: a entrega não salva o checkpoint, e o console acusa 500 no POST de
-- /rest/v1/documentos?columns=...,"gerado_em".
--
-- Aqui a coluna e o índice são criados em passos separados, cada um idempotente
-- por conta própria. Rodar isto mais de uma vez é seguro, e rodar num banco que
-- já está correto não faz nada.

alter table documentos    add column if not exists external_ref text;
alter table itens_entrega add column if not exists external_ref text;

-- `create unique index if not exists` é o par idempotente que faltava: vale
-- tanto para inferência de ON CONFLICT quanto como garantia de unicidade.
create unique index if not exists documentos_external_ref_key
  on documentos (external_ref);

create unique index if not exists itens_entrega_external_ref_key
  on itens_entrega (external_ref);
