-- =============================================================================
-- Chaves na Mão — nova etapa CONFISSAO no enum de status da entrega
-- =============================================================================
-- O processo tem DUAS assinaturas, em ordem: a Confissão de Dívida, assinada
-- remotamente pelo cliente (Clicksign), e só depois o Recebimento de Chaves,
-- assinado presencialmente no dia da entrega. A confissão vira etapa própria:
--
--   ABERTURA → DOCUMENTOS → CONFISSAO → ASSINATURA → REGISTRO → CONCLUIDA
--
-- Esta migração contém APENAS o `add value`, sozinha, de propósito: um valor de
-- enum recém-adicionado não pode ser usado na mesma transação que o criou. O
-- guard que passa a referenciar 'CONFISSAO' vem na migração seguinte.

alter type entrega_status add value if not exists 'CONFISSAO' before 'ASSINATURA';
