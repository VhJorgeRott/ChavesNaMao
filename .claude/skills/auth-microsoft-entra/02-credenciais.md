# 2. Todas as credenciais (o que é, onde pega, público vs. segredo)

Esta é a parte que mais confunde na hora de replicar. Existem credenciais de
**dois provedores** (Entra e Supabase), e cada uma tem um destino certo. Errar o
destino é a causa nº 1 de falha — e de vazamento.

## A regra de ouro (leia isto primeiro)

> **`VITE_*` = público, vai pro bundle do navegador.** Qualquer um que abrir o
> DevTools vê. Por isso **só valores públicos** podem ter esse prefixo.
>
> **Segredos NÃO têm prefixo `VITE_`.** Eles vivem no **painel do Supabase** ou
> como secrets do servidor. Nunca no `.env` do frontend, nunca no Git.

O app de referência tem até uma trava que **impede o boot** se você colar uma
chave `service_role` no lugar da `anon` (ver `assertChaveNaoPrivilegiada` em
[05-codigo-frontend.md](05-codigo-frontend.md)).

## Tabela mestra das credenciais

| Credencial | Provedor | Onde obter | Destino | Público? |
|------------|----------|-----------|---------|:--------:|
| **Client ID** (Application ID) | Entra | Portal Azure → App registration → Overview | **Painel do Supabase** (provider Azure) | público* |
| **Client Secret** | Entra | Portal Azure → App registration → Certificates & secrets | **Painel do Supabase** (provider Azure) | 🔒 **SEGREDO** |
| **Tenant ID** (Directory ID) | Entra | Portal Azure → App registration → Overview | **Painel do Supabase** (Azure "URL"/tenant) | público* |
| **Project URL** | Supabase | Supabase → Project Settings → API → Project URL | `.env` do app → `VITE_SUPABASE_URL` | ✅ público |
| **anon public key** | Supabase | Supabase → Project Settings → API → anon public | `.env` do app → `VITE_SUPABASE_ANON_KEY` | ✅ público |
| **service_role key** | Supabase | Supabase → Project Settings → API → service_role | 🔒 servidor/Edge Functions apenas | 🔒 **SEGREDO** |

\* `client_id` e `tenant_id` **tecnicamente não são segredos** (aparecem em URLs
OAuth), mas no nosso desenho eles vão pro **Supabase**, não pro `.env` do app —
porque é o Supabase que fala com a Microsoft. O `client_secret` **é segredo** e
também mora só no Supabase.

## O ponto-chave que quase todo mundo erra

No desenho com Supabase-como-broker, as credenciais do **Entra**
(`client_id` + `client_secret` + `tenant`) **NÃO vão para o `.env` do frontend.**
Elas são coladas **dentro do painel do Supabase** (Authentication → Providers →
Azure). O frontend só conhece o Supabase.

Ou seja, o `.env` do seu app precisa de apenas **duas** credenciais para o login
funcionar:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...  # a chave "anon public"
```

## E as variáveis `VITE_ENTRA_*` do `.env.example`?

O `.env.example` do projeto lista também:

```dotenv
VITE_ENTRA_CLIENT_ID=...
VITE_ENTRA_TENANT_ID=...
VITE_ENTRA_REDIRECT_URI=http://localhost:5173/auth/callback
```

**Atenção — honestidade técnica:** no código atual (que usa o provider Azure do
Supabase), essas três variáveis **não são obrigatórias e não são lidas pelo fluxo
de login**. O que liga o "modo entra" é só a presença de `VITE_SUPABASE_URL` +
`VITE_SUPABASE_ANON_KEY` (ver `isAuthConfigured` em `authConfig.ts`). Elas ficam
ali como:

- documentação de quais IDs do Entra existem, e
- gancho para um eventual caminho **MSAL direto** (sem Supabase), caso você um dia
  queira falar direto com a Microsoft.

Se você for replicar **exatamente** este desenho (recomendado), pode **ignorar as
`VITE_ENTRA_*`** — configure o Entra dentro do Supabase.

> Só a `Login.tsx` referencia `VITE_ENTRA_CLIENT_ID` — apenas no **texto de ajuda**
> do modo dev ("configure X para o login real"). Não afeta o fluxo.

## O `.env` mínimo, comentado

```dotenv
# Modo dos adapters (mock = dados sintéticos | live = APIs reais). Não é auth.
VITE_ADAPTER_MODE=mock

# --- Supabase (PÚBLICO — pode ir pro cliente) ---
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_PUBLIC_KEY

# Base pública do app (usada p/ montar links; e como referência do redirect).
VITE_PUBLIC_APP_URL=http://localhost:5173

# =============================================================================
# SEGREDOS — SEM prefixo VITE_. NÃO vão aqui no frontend. Referência apenas:
#   - Client Secret do Entra  -> colar no painel do Supabase (provider Azure)
#   - SUPABASE_SERVICE_ROLE_KEY -> só no servidor / Edge Functions
# =============================================================================
```

## Checklist de "onde cada coisa mora"

- [ ] `client_id` do Entra → **Supabase** (Auth → Providers → Azure → "Client ID")
- [ ] `client_secret` do Entra → **Supabase** (Auth → Providers → Azure → "Secret")
- [ ] `tenant_id` do Entra → **Supabase** (Auth → Providers → Azure → "Azure Tenant URL/ID")
- [ ] `VITE_SUPABASE_URL` → `.env` do app
- [ ] `VITE_SUPABASE_ANON_KEY` → `.env` do app
- [ ] `service_role` → **nunca** no app; só servidor
- [ ] `.env` está no `.gitignore`; só `.env.example` é versionado

Próximo: [03-configuracao-azure-entra.md](03-configuracao-azure-entra.md).
