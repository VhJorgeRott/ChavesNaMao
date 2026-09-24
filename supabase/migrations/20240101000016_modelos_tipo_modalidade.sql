-- =============================================================================
-- Chaves na Mão — tipo e modalidade dos modelos de termo
-- =============================================================================
-- A listagem filtra os modelos por tipo e modalidade, e o editor passa a deixar
-- a equipe escolher os dois. Antes eram adivinhados pelo nome do modelo.
--
-- Nullable: um modelo sem tipo continua válido (só não aparece no filtro).

alter table modelos
  add column if not exists tipo text
    check (tipo in ('Entrega de chaves', 'Confissão de dívida', 'Distrato', 'Aditivo contratual')),
  add column if not exists modalidade text
    check (modalidade in ('Financiamento', 'Venda direta'));

update modelos set tipo = 'Entrega de chaves', modalidade = 'Financiamento'
  where external_ref = 'mod-0001' and tipo is null;
update modelos set tipo = 'Confissão de dívida', modalidade = 'Venda direta'
  where external_ref = 'mod-0002' and tipo is null;
