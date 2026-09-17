-- =============================================================================
-- Chaves na Mão — Qualidade: FVS (Ficha de Verificação de Serviço)
-- =============================================================================
-- Substitui o processo de qualidade do Mobuss. Regras de negócio em
-- packages/domain/src/qualidade.ts.
--
-- Desenho pensado para OFFLINE:
--   * ids são uuid gerados no dispositivo (a inspeção nasce sem internet);
--   * a inspeção é UMA linha (respostas e fotos em jsonb), então sincronizar é
--     um único upsert idempotente;
--   * `cliente_atualizado_em` é o relógio de quem editou. O gatilho de guarda
--     descarta uma escrita mais antiga que a que já está no banco (last write
--     wins pelo momento da edição, não pelo momento em que a internet voltou);
--   * `updated_at` (servidor) é o cursor do "pull" incremental.
-- =============================================================================

-- Guarda de última escrita ----------------------------------------------------
create or replace function public.guarda_escrita_mais_recente()
returns trigger
language plpgsql
as $$
begin
  if old.cliente_atualizado_em is not null
     and new.cliente_atualizado_em < old.cliente_atualizado_em then
    -- Escrita atrasada (dispositivo que ficou offline com dado velho): ignora.
    return null;
  end if;
  return new;
end;
$$;

-- Modelos de FVS --------------------------------------------------------------
create table if not exists fvs_modelos (
  id                    uuid primary key,
  codigo                text,
  nome                  text not null,
  servico               text,
  descricao             text,
  versao                integer not null default 1 check (versao >= 1),
  ativo                 boolean not null default true,
  -- { secoes: [{ id, titulo, itens: [{ id, texto, criterio, metodo, fotoObrigatoriaNc }] }] }
  estrutura             jsonb not null,
  criado_por            uuid references auth.users (id) on delete set null,
  cliente_atualizado_em timestamptz not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists fvs_modelos_updated_at_idx on fvs_modelos (updated_at);

-- Inspeções -------------------------------------------------------------------
create table if not exists fvs_inspecoes (
  id                    uuid primary key,
  modelo_id             uuid not null references fvs_modelos (id) on delete restrict,
  modelo_versao         integer not null,
  modelo_nome           text not null,
  modelo_codigo         text,
  -- Cópia da estrutura do modelo no momento da inspeção.
  estrutura             jsonb not null,
  -- { empreendimentoRef, empreendimentoNome, bloco, unidadeRef, unidadeNome, detalhe }
  local                 jsonb not null,
  empreendimento_ref    text not null,
  inspetor_id           uuid not null references auth.users (id) on delete restrict,
  inspetor_nome         text not null,
  status                text not null check (status in ('em_andamento', 'concluida')),
  resultado             text check (resultado in ('aprovada', 'reprovada')),
  reinspecao_de         uuid references fvs_inspecoes (id) on delete restrict,
  itens_alvo            text[],
  observacoes           text,
  -- { [itemId]: { itemId, resultado: 'C'|'NC'|'NA', observacao, respondidoEm } }
  respostas             jsonb not null default '{}'::jsonb,
  -- [{ id, itemId, storagePath, criadaEm }]
  fotos                 jsonb not null default '[]'::jsonb,
  iniciada_em           timestamptz not null,
  concluida_em          timestamptz,
  cliente_atualizado_em timestamptz not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint fvs_inspecoes_conclusao_ck check (
    (status = 'concluida') = (concluida_em is not null and resultado is not null)
  )
);

create index if not exists fvs_inspecoes_updated_at_idx on fvs_inspecoes (updated_at);
create index if not exists fvs_inspecoes_empreendimento_idx on fvs_inspecoes (empreendimento_ref);
create index if not exists fvs_inspecoes_reinspecao_idx on fvs_inspecoes (reinspecao_de);

-- Não conformidades -----------------------------------------------------------
create table if not exists fvs_nao_conformidades (
  id                    uuid primary key,
  inspecao_id           uuid not null references fvs_inspecoes (id) on delete restrict,
  item_id               text not null,
  item_texto            text not null,
  secao_titulo          text not null,
  modelo_nome           text not null,
  local                 jsonb not null,
  empreendimento_ref    text not null,
  descricao             text,
  responsavel           text,
  prazo                 date,
  status                text not null
                        check (status in ('aberta', 'em_correcao', 'aguardando_reinspecao', 'fechada')),
  reinspecoes           uuid[] not null default '{}',
  aberta_em             timestamptz not null,
  fechada_em            timestamptz,
  cliente_atualizado_em timestamptz not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- Uma NC por item de inspeção: reenviar a conclusão não duplica.
  constraint fvs_nc_item_unico unique (inspecao_id, item_id)
);

create index if not exists fvs_nc_updated_at_idx on fvs_nao_conformidades (updated_at);
create index if not exists fvs_nc_status_idx on fvs_nao_conformidades (status);

-- Gatilhos --------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['fvs_modelos', 'fvs_inspecoes', 'fvs_nao_conformidades']
  loop
    execute format(
      'create trigger trg_%1$s_guarda before update on %1$I
         for each row execute function public.guarda_escrita_mais_recente();',
      t
    );
    execute format(
      'create trigger trg_%1$s_touch before update on %1$I
         for each row execute function public.touch_updated_at();',
      t
    );
  end loop;
end;
$$;

-- RLS: equipe interna opera; DELETE negado (qualidade é registro de auditoria) -
alter table fvs_modelos           enable row level security;
alter table fvs_inspecoes         enable row level security;
alter table fvs_nao_conformidades enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['fvs_modelos', 'fvs_inspecoes', 'fvs_nao_conformidades']
  loop
    execute format(
      'create policy %1$s_select on %1$I for select to authenticated using (public.is_equipe());',
      t
    );
    execute format(
      'create policy %1$s_insert on %1$I for insert to authenticated with check (public.is_equipe());',
      t
    );
    execute format(
      'create policy %1$s_update on %1$I for update to authenticated
         using (public.is_equipe()) with check (public.is_equipe());',
      t
    );
  end loop;
end;
$$;

-- Fotos das inspeções ---------------------------------------------------------
-- Bucket privado. Diferente de `documentos`, aqui o NAVEGADOR envia direto: a
-- foto é tirada em campo e sobe quando a conexão volta, sem Edge Function no
-- meio. Caminho: inspecoes/{inspecaoId}/{fotoId}.jpg. Sem update/delete —
-- evidência de inspeção não é sobrescrita.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qualidade', 'qualidade', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy qualidade_fotos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'qualidade' and public.is_equipe());

create policy qualidade_fotos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'qualidade' and public.is_equipe());
