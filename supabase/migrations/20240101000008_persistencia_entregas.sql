-- =============================================================================
-- Chaves na Mão — persistência do checkpoint da entrega
-- =============================================================================
-- Até aqui a entrega só existia no store em memória do navegador: recarregar a
-- página perdia o progresso de uma entrega iniciada e não concluída. O app passa
-- a gravar o checkpoint direto nas tabelas operacionais (RLS já permite à equipe
-- interna select/insert/update — ver 20240101000004_rls_policies.sql).
--
-- Esta migração é ADITIVA. Ela apenas:
--   1. estende o padrão de `external_ref` para documentos e itens;
--   2. permite à equipe REMOVER itens da entrega.

-- 1) external_ref em documentos e itens ---------------------------------------
-- Mesma razão de 20240101000006: os ids do app (`doc-1a2b`, `item-1a2b`) não são
-- uuid. O upsert por external_ref torna a gravação idempotente — salvar duas
-- vezes o mesmo checkpoint não duplica linhas.
alter table documentos    add column if not exists external_ref text unique;
alter table itens_entrega add column if not exists external_ref text unique;

-- 2) DELETE de itens da entrega -----------------------------------------------
-- Exceção deliberada e estreita ao deny-by-default de DELETE: os itens
-- entregues (chaves, controles, manuais) são digitados à mão na etapa REGISTRO e
-- corrigir um engano é operação de rotina. Sem esta política, o item removido na
-- tela reaparecia no próximo carregamento. Continua restrito à equipe interna, e
-- DELETE segue negado em todas as demais tabelas.
create policy itens_entrega_delete on itens_entrega
  for delete to authenticated
  using (public.is_equipe());
