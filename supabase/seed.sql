-- =============================================================================
-- Chaves na Mão — Seed de dados realistas (incorporadora brasileira)
-- =============================================================================
-- Aplicado por `supabase db reset`. CPFs sintéticos com dígitos verificadores
-- VÁLIDOS (não pertencem a pessoas reais).
--
-- Observação: NÃO semeamos `entregas`, `user_roles`, `assinaturas` nem
-- `access_tokens` porque dependem de usuários reais do Entra (auth.users) e de
-- fluxo de runtime. O primeiro admin é promovido após o primeiro login (ver
-- README → "Primeiro acesso").
-- =============================================================================

insert into empreendimentos (id, nome, cidade, uf) values
  ('11111111-1111-1111-1111-111111111111', 'Residencial Jardim das Acácias', 'Maringá',  'PR'),
  ('22222222-2222-2222-2222-222222222222', 'Loteamento Terras do Lago',      'Cascavel', 'PR');

insert into unidades (id, empreendimento_id, identificacao, status, area_m2) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Quadra A, Lote 12', 'LIBERADA', 250.00),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Quadra A, Lote 13', 'QUITADA',  250.00),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Quadra B, Lote 04', 'VENDIDA',  312.50),
  ('a0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Quadra 7, Lote 21', 'EM_OBRAS', 420.00),
  ('a0000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Quadra 7, Lote 22', 'LIBERADA', 420.00);

insert into clientes (id, nome, cpf, email, telefone) values
  ('c0000000-0000-0000-0000-000000000001', 'Mariana Oliveira Souza', '11144477735', 'mariana.souza@example.com', '+55 44 99876-5432'),
  ('c0000000-0000-0000-0000-000000000002', 'Rafael Pereira Lima',    '52998224725', 'rafael.lima@example.com',   '+55 44 99765-4321'),
  ('c0000000-0000-0000-0000-000000000003', 'Carla Mendes Ribeiro',   '39053344705', 'carla.ribeiro@example.com', '+55 45 99654-3210');
