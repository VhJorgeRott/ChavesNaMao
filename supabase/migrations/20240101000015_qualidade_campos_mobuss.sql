-- =============================================================================
-- Qualidade — campos que o processo do Mobuss usa na FVS
-- =============================================================================
-- Vieram do relatório "Registro de Inspeção de Serviço" que a equipe emite hoje:
-- identificador do que foi verificado, fornecedor (empreiteiro), responsável
-- pelo serviço em campo, data do atendimento e validade da verificação.
--
-- `assinatura` guarda o traço de quem concluiu a ficha (PNG em dataURL + nome e
-- horário), assinado no próprio aparelho ao concluir — inclusive offline.
-- O código do local (padrão "01.01.06") entra dentro do jsonb `local`, que já
-- existe, sem alterar o formato da coluna.

alter table fvs_inspecoes
  add column if not exists identificador    text,
  add column if not exists fornecedor       text,
  add column if not exists responsavel      text,
  add column if not exists data_atendimento date,
  add column if not exists validade         date,
  add column if not exists assinatura       jsonb;
