# Chaves na Mão

Plataforma interna da Rottas para **entrega de chaves** de unidades, ponta a ponta:
modela uma máquina de estados de 6 etapas
(`ABERTURA → INTEGRACAO → DOCUMENTOS → ASSINATURA → REGISTRO → CONCLUIDA`),
unificando CRM (CV CRM), ERP (Mega) e assinatura digital (Clicksign) atrás de adapters.

> **Status:** fundação (etapas 1–3 do roteiro). Scaffold + schema/RLS + camada de
> adapters prontos. Auth (Entra/MSAL), telas, geração de PDF, portal do cliente,
> Clicksign live, notificações e integrações live vêm nas próximas etapas.

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

Fundação concluída (1–3). Próximas etapas: auth Entra/MSAL + guards (4), telas de
Unidades e Entregas + transições no servidor (5–6), PDF + Storage + hash (7),
portal do cliente + canvas (8), Clicksign live + webhook HMAC (9), notificações
(10), gestão de usuários (11), integrações live CRM/ERP (12), hardening de
headers/CORS/CSP (13).
