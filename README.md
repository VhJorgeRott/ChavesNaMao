# Chaves na Mão

Plataforma interna da Rottas para **entrega de chaves** de unidades, ponta a ponta:
modela uma máquina de estados de 6 etapas
(`ABERTURA → INTEGRACAO → DOCUMENTOS → ASSINATURA → REGISTRO → CONCLUIDA`),
unificando CRM (CV CRM), ERP (Mega) e assinatura digital (Clicksign) atrás de adapters.

> **Status:** fundação + telas do MVP. Scaffold, schema/RLS, adapters e a **UI
> completa** (Início, Unidades, Entregas, Detalhe da entrega e Portal do cliente
> com canvas de assinatura) já rodam sobre um store em memória com dados mock.
> Pendentes: auth real (Entra/MSAL ↔ Supabase), persistência no Supabase, geração
> de PDF no servidor, Clicksign live, notificações e integrações live de CRM/ERP.

## Telas

App interno (shell com sidebar, fundo cinza, tokens da Rottas):

- **Início** (`/dashboard`) — KPIs e entregas recentes.
- **Unidades** (`/unidades`) — tabela com busca/filtros; "Iniciar entrega" só para unidades liberadas.
- **Entregas** (`/entregas`) — lista filtrável; clique abre o detalhe.
- **Detalhe da entrega** (`/entregas/:id`) — timeline das 6 etapas, ação contextual por etapa
  (validada pela máquina de estados), documentos + hash, geração de link de assinatura, itens e
  trilha de auditoria.
- **Usuários** (`/admin`) — gestão de papéis (RBAC); visível só para `admin`.

Portal do cliente (rota pública, sem login):

- **`/portal/:token`** — valida o token, mostra o termo, captura a assinatura no canvas
  (Pointer Events + `devicePixelRatio`), consentimento opcional de geolocalização, e confirma via
  adapter Clicksign (mock). Tokens inválidos/expirados/usados retornam resposta idêntica (não vazam
  existência).

> O `DataProvider` (store em memória, `src/data/`) e a `SessionProvider` (sessão simulada com troca
> de papel para demo) substituem temporariamente o Supabase/Entra — a troca para o backend real é
> isolada nessas camadas.

## Stack

- **Frontend:** React 18 + TypeScript (strict) + Vite + Tailwind + shadcn/ui
- **Backend/DB:** Supabase (Postgres + Auth + Storage + Edge Functions) — projeto novo e isolado
- **Auth interno:** Microsoft Entra ID (OIDC/MSAL) ↔ Supabase Auth
- **Validação:** Zod em toda borda de confiança
- **Assinatura:** canvas (Pointer Events) + adapter Clicksign
- **Hosting:** Railway

## Pré-requisitos

- Node.js ≥ 20
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para migrations/seed locais)

## Setup

```bash
npm install
cp .env.example .env   # preencha os valores (veja a seção Segredos)
npm run dev
```

### Banco de dados (Supabase)

O schema é versionado em `supabase/migrations/` — **nunca** crie schema pela UI.

```bash
supabase init          # gera config.toml (não sobrescreve as migrations)
supabase start         # sobe o Postgres local
supabase db reset      # aplica migrations + supabase/seed.sql
```

Para aplicar no projeto remoto dedicado:

```bash
supabase link --project-ref <ref-do-projeto>
supabase db push
```

### Primeiro acesso (promover um admin)

Os papéis vivem em `user_roles` e a tabela tem RLS deny-by-default. Após o
primeiro login via Entra, promova seu usuário a `admin` (uma vez, via SQL com
service_role / SQL editor do projeto):

```sql
insert into user_roles (user_id, papel)
values ('<auth-user-uuid>', 'admin')
on conflict (user_id) do update set papel = 'admin';
```

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Type-check + build de produção |
| `npm run typecheck` | Apenas `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm test` | Testes (Vitest): máquina de estados, tokens, CPF, adapters |

## Arquitetura

### Adapters de integração (`src/adapters/`)

Toda integração externa fica atrás de uma interface TypeScript, com implementação
`mock` (dados sintéticos) e `live` (API real), selecionável por `VITE_ADAPTER_MODE`:

```
crm/          CrmAdapter          → CV CRM      (cliente por unidade)
erp/          ErpAdapter          → Mega ERP    (situação financeira)
signature/    SignatureAdapter    → Clicksign   (validade jurídica)
notification/ NotificationAdapter → e-mail      (eventos-chave)
```

Trocar `mock` → `live` não exige mudanças fora da camada de adapters. As
implementações `live` que usam segredos rodam no **servidor** (Edge Functions).

### Máquina de estados (`src/domain/state-machine.ts`)

Transições lineares, deny-by-default. Validada no cliente (UX), **revalidada no
servidor** (Edge Function) e reforçada no **banco** por trigger
(`enforce_entrega_transition`). Não é possível pular etapas.

## Segurança (resumo)

Este app trata dados pessoais (LGPD), documentos contratuais e assinaturas com
peso jurídico. Decisões aplicadas nesta fundação:

- **RLS deny-by-default em TODAS as tabelas.** A `anon key` não lê nada; o portal
  do cliente acessa só via Edge Functions com `service_role` validando o token.
- **RBAC** (`admin`, `equipe_entrega`) com a verdade no servidor (`user_roles` + RLS).
- **Tokens do portal:** 256 bits via CSPRNG, **apenas o hash** (SHA-256) no banco,
  expiração curta, uso único, comparação em tempo constante, escopo por entrega.
- **Segredos nunca no bundle:** só variáveis `VITE_*` (públicas) chegam ao cliente.
- **Validação Zod** na borda; CPF e hashes com `CHECK` no banco.
- **Auditoria** (`audit_log`) sem dados pessoais/tokens/secrets em claro.

### Segredos e rotação

- Públicos (`VITE_*`): URL Supabase, anon key, client_id/tenant Entra. Vão no `.env`/host.
- Sensíveis (sem `VITE_`): `SUPABASE_SERVICE_ROLE_KEY`, `CLICKSIGN_API_TOKEN`,
  `CLICKSIGN_WEBHOOK_HMAC_SECRET`, tokens de CRM/ERP, API key de e-mail. Vivem como
  secrets do servidor: `supabase secrets set NOME=valor`.
- **Rotação:** gere a nova credencial no provedor → atualize o secret no host/Supabase
  → invalide a antiga. Nunca faça commit de `.env`; só `.env.example` é versionado.

## Deploy (Railway)

1. Conecte o repositório no Railway.
2. Defina as variáveis públicas (`VITE_*`) e os segredos do servidor no painel.
3. Build: `npm run build`; sirva `dist/` (SPA).
4. Garanta HTTPS/HSTS, CORS restrito às origens conhecidas e headers de segurança
   (CSP, X-Content-Type-Options, frame-ancestors, Referrer-Policy) — etapa 13 do roteiro.

## Roteiro

Concluído: fundação (1–3) + **UI das telas internas e do portal** (5, 6, 8 e a tela de gestão de
usuários da etapa 11) sobre store em memória. Próximas etapas: auth Entra/MSAL + guards (4),
persistência no Supabase, PDF + Storage + hash no servidor (7), Clicksign live + webhook HMAC (9),
notificações (10), integrações live CRM/ERP (12), hardening de headers/CORS/CSP (13).

## Troubleshooting

**`Cannot find module @rollup/rollup-win32-x64-msvc` ao rodar `npm run dev`/`build`.**
O Windows Defender remove o binário nativo do Rollup (falso positivo). Este projeto já contorna isso
com um override para a build WebAssembly em `package.json`:

```jsonc
"overrides": { "rollup": "npm:@rollup/wasm-node@4.62.2" }
```

Se atualizar o Vite/Rollup, ajuste a versão do override para casar com a nova do `rollup`. Para
voltar à build nativa (mais rápida), remova o override e adicione uma exclusão da pasta do projeto
no Defender (`Add-MpPreference -ExclusionPath <pasta>` em PowerShell admin), depois `npm install`.
