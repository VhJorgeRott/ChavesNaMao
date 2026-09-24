---
name: auth-microsoft-entra
description: >-
  Como implementar login "Entrar com Microsoft" (Microsoft Entra ID / Azure AD)
  em um app React + Vite, usando o Supabase Auth como broker OAuth (provider
  "azure", fluxo PKCE) — sem senha própria e sem MSAL. Use quando o usuário
  quiser adicionar login corporativo Microsoft, replicar essa autenticação em
  outro app, entender quais credenciais são necessárias, ou depurar o fluxo
  OAuth/redirect/callback. Dispara com "login com Microsoft", "Entra ID",
  "Azure AD", "signInWithOAuth azure", "replicar autenticação".
---

# Login com Microsoft (Entra ID) via Supabase Auth

Guia completo e replicável para colocar **"Entrar com Microsoft"** em qualquer
app React + Vite. Extraído da implementação de referência do projeto **Chaves na
Mão** (Rottas), que já roda em produção-de-desenvolvimento.

## A ideia em uma frase

O navegador **nunca fala direto com a Microsoft**. Ele fala com o **Supabase**,
que atua como *broker* OAuth: o Supabase guarda as credenciais do Entra, redireciona
para a Microsoft, recebe o callback, valida tudo e devolve ao app uma **sessão
(JWT)**. O app só chama `supabase.auth.signInWithOAuth({ provider: 'azure' })`.

```
[App/Browser] --(1) signInWithOAuth('azure')--> [Supabase Auth]
     ^                                                 |
     |                                        (2) redirect p/ Microsoft
     |                                                 v
     |                                          [Microsoft Entra ID]
     |                                                 |
     |                                  (3) usuário loga, consente
     |                                                 v
     |                                          [Supabase /auth/v1/callback]
     |                                                 | (4) valida, cria code
     +---(5) volta p/ /auth/callback?code=... ---------+
     |
 (6) exchangeCodeForSession(code)  --> sessão JWT (PKCE) --> RLS usa esse JWT
```

**Por que não MSAL direto?** Porque assim o *client_secret* do Entra vive no
servidor do Supabase (nunca no bundle), você ganha refresh de token, persistência
de sessão e integração automática com RLS do Postgres — de graça. Menos código,
mais seguro.

## Leia nesta ordem

| # | Arquivo | O que cobre |
|---|---------|-------------|
| 1 | [01-visao-geral.md](01-visao-geral.md) | Arquitetura, o fluxo passo a passo, decisões e trade-offs |
| 2 | [02-credenciais.md](02-credenciais.md) | **TODAS** as credenciais: o que é, onde pega, público vs. segredo |
| 3 | [03-configuracao-azure-entra.md](03-configuracao-azure-entra.md) | Passo a passo no portal Azure (registrar app, secret, redirect) |
| 4 | [04-configuracao-supabase.md](04-configuracao-supabase.md) | Habilitar o provider Azure, allow-list de redirects, tabela de papéis |
| 5 | [05-codigo-frontend.md](05-codigo-frontend.md) | O código completo, arquivo por arquivo, pronto pra copiar |
| 6 | [06-rbac-e-banco.md](06-rbac-e-banco.md) | Papéis (RBAC), RLS, promover o primeiro admin |
| 7 | [07-checklist-replicacao.md](07-checklist-replicacao.md) | Checklist de replicação + troubleshooting dos erros comuns |

## Stack de referência

- **Frontend:** React 18 + TypeScript + Vite
- **Auth/DB:** Supabase (`@supabase/supabase-js`) com provider **Azure** (OIDC)
- **IdP:** Microsoft Entra ID (antigo Azure AD)
- **Validação de env:** Zod
- **Roteamento:** react-router-dom v6

## Resumo do que você vai precisar

1. Um **app registrado no Entra ID** → gera `client_id`, `tenant_id`, `client_secret`.
2. Um **projeto Supabase** → gera `Project URL` e `anon key`.
3. Colar o `client_id`/`secret`/`tenant` **no painel do Supabase** (provider Azure).
4. Registrar 2 **redirect URLs**: a do Supabase no Entra, e a do seu app no Supabase.
5. ~7 arquivos de código no frontend (todos em [05-codigo-frontend.md](05-codigo-frontend.md)).
6. Uma tabela `user_roles` + RLS se quiser papéis (admin/equipe) — [06-rbac-e-banco.md](06-rbac-e-banco.md).

> **Regra de ouro:** só variáveis com prefixo `VITE_` vão pro navegador, e elas são
> **públicas**. O `client_secret` do Entra e a `service_role` do Supabase **JAMAIS**
> entram no bundle — ficam no painel do Supabase / secrets do servidor.
