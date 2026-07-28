-- =============================================================================
-- Chaves na Mão — remoção da etapa INTEGRACAO do fluxo de entrega
-- =============================================================================
-- Os dados de CRM/ERP passaram a ser puxados automaticamente ao abrir a entrega
-- (ver src/pages/EntregaDetalhe.tsx), então a etapa manual de integração deixou
-- de existir. O fluxo agora é:
--
--   ABERTURA → DOCUMENTOS → ASSINATURA → REGISTRO → CONCLUIDA
--
-- O valor 'INTEGRACAO' permanece no enum `entrega_status`: o Postgres não
-- permite remover valor de enum, e mantê-lo preserva a leitura de registros
-- históricos no audit_log. Ele apenas não é mais alcançável pelo guard.

-- Realoca entregas paradas na etapa removida ----------------------------------
-- Desabilita o trigger na sessão da migração: a transição INTEGRACAO →
-- DOCUMENTOS é válida pela regra ANTIGA, mas o guard já terá sido substituído
-- se atualizarmos depois. Fazemos o update primeiro, com a regra antiga ainda
-- em vigor, para não precisar contornar a guarda.
update entregas
   set status = 'DOCUMENTOS'
 where status = 'INTEGRACAO';

-- Novo guard da máquina de estados --------------------------------------------
-- Espelha src/domain/state-machine.ts. Defesa em profundidade: mesmo que a UI
-- ou uma Edge Function falhe, o banco recusa pular etapas.
create or replace function public.enforce_entrega_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'ABERTURA'   and new.status = 'DOCUMENTOS') or
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
