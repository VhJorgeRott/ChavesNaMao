-- =============================================================================
-- Chaves na Mão — Backend do portal de assinatura (token durável)
-- =============================================================================
-- Objetivo: o link de assinatura precisa funcionar em OUTRO dispositivo. Para
-- isso o ciclo mínimo da entrega (empreendimento/unidade/cliente/entrega/
-- documento) e o token passam a ser persistidos no Postgres, e o portal do
-- cliente acessa via Edge Functions (service_role) — nunca direto do navegador.
--
-- Esta migração é ADITIVA (não destrói PKs): adiciona `external_ref` para o
-- upsert idempotente (os IDs de unidade/cliente vêm do CV/Mega, não são uuid),
-- relaxa a checagem de CPF e cria o bucket privado das assinaturas.
-- =============================================================================

create extension if not exists pgcrypto;

-- Referência externa (id do CV/Mega/mock) para upsert idempotente a partir da
-- Edge Function. Nullable e unique: no Postgres múltiplos NULLs são permitidos,
-- mas sempre enviamos um valor não-nulo ao gerar o link.
alter table empreendimentos add column if not exists external_ref text unique;
alter table unidades        add column if not exists external_ref text unique;
alter table clientes        add column if not exists external_ref text unique;
alter table entregas        add column if not exists external_ref text unique;

-- Clientes resolvidos por fallback do ERP podem chegar sem CPF (o Mega nem
-- sempre expõe o documento). Aceita vazio OU 11 dígitos — a validação forte
-- continua na borda (Zod) quando o dado existe.
alter table clientes drop constraint if exists clientes_cpf_digits;
alter table clientes add constraint clientes_cpf_digits
  check (cpf = '' or cpf ~ '^[0-9]{11}$');

-- Unidades vindas do ERP (Mega) nem sempre trazem a área privativa. Permite
-- área ausente, mantendo a positividade quando informada.
alter table unidades alter column area_m2 drop not null;
alter table unidades drop constraint if exists unidades_area_m2_check;
alter table unidades add constraint unidades_area_m2_check
  check (area_m2 is null or area_m2 > 0);

-- Bucket PRIVADO para o traço do canvas (PNG). Sem policies de storage → apenas
-- o service_role (Edge Functions) escreve/lê; a anon key não enxerga nada.
insert into storage.buckets (id, name, public)
values ('assinaturas', 'assinaturas', false)
on conflict (id) do nothing;
