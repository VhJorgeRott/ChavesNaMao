-- =============================================================================
-- Chaves na Mão — guard da etapa CONFISSAO + persistência das assinaturas
-- =============================================================================

-- 1) Guard da máquina de estados ----------------------------------------------
-- Espelha src/domain/state-machine.ts, agora com a confissão de dívida entre os
-- documentos e a assinatura presencial. Defesa em profundidade: mesmo que a UI
-- falhe, o banco recusa pular a confissão e entregar a chave antes dela.
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
    (old.status = 'DOCUMENTOS' and new.status = 'CONFISSAO')  or
    (old.status = 'CONFISSAO'  and new.status = 'ASSINATURA') or
    (old.status = 'ASSINATURA' and new.status = 'REGISTRO')   or
    (old.status = 'REGISTRO'   and new.status = 'CONCLUIDA')
  ) then
    raise exception 'Transição de entrega inválida: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- 2) external_ref em assinaturas -----------------------------------------------
-- As assinaturas passam a ser gravadas e recarregadas junto do checkpoint: sem
-- isso, um refresh apagava a confissão já assinada e a etapa reabria, deixando a
-- entrega avançar de novo sobre uma assinatura que já existia.
--
-- Coluna e índice em passos separados, cada um idempotente por conta própria —
-- `add column if not exists ... unique` pula o `unique` quando a coluna já
-- existe, armadilha que já nos custou um 500 em produção (ver 20240101000009).
alter table assinaturas add column if not exists external_ref text;

create unique index if not exists assinaturas_external_ref_key
  on assinaturas (external_ref);
