-- =============================================================================
-- Chaves na Mão — bucket privado dos termos em PDF
-- =============================================================================
-- Espelha o bucket `assinaturas` da migração 6: privado, sem policies de
-- storage, de modo que só o service_role (Edge Functions) lê e escreve. O
-- navegador nunca toca no arquivo direto — quando precisar baixar, recebe uma
-- URL assinada e temporária.
--
-- É aqui que passa a existir de fato o `documentos.storage_path`, que até agora
-- apontava para um arquivo que nunca foi gerado.

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;
