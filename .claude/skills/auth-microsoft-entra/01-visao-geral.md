# 1. Visão geral da arquitetura

## O modelo mental

Existem **três** atores e o app conversa com apenas **um** deles:

| Ator | Papel | O app fala com ele? |
|------|-------|---------------------|
| **App (browser)** | Sua SPA React | — |
| **Supabase Auth** | *Broker* OAuth + emissor de sessão (JWT) | ✅ **Sim, só com este** |
| **Microsoft Entra ID** | Provedor de identidade (IdP) que autentica o usuário | ❌ Não diretamente |

O Supabase se coloca no meio. Ele guarda o `client_secret` do Entra, monta a URL
de autorização da Microsoft, recebe o callback, troca o `code` por tokens com a
Microsoft, valida o `id_token` e devolve pro seu app uma **sessão própria do
Supabase**. Essa sessão é um JWT que o Postgres usa nas políticas de RLS.

Consequência prática: **você não escreve nada de OAuth/MSAL no frontend**. Só
chama a SDK do Supabase.

## O fluxo completo, passo a passo

1. **Usuário clica "Entrar com Microsoft".**
   O app chama `supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes, redirectTo, skipBrowserRedirect: true } })`.
   O Supabase devolve uma **URL de autorização** (já com PKCE: um `code_verifier`
   é gravado no `localStorage` da sua origem).

2. **App redireciona o browser** para essa URL (`window.location.assign(data.url)`).
   O browser vai para o Supabase, que imediatamente redireciona para a **tela de
   login da Microsoft**.

3. **Usuário autentica na Microsoft** (e consente os escopos `openid email profile`
   na primeira vez).

4. **Microsoft redireciona para o callback do Supabase**
   (`https://<seu-projeto>.supabase.co/auth/v1/callback`) com um código.
   O Supabase troca esse código por tokens **com a Microsoft** (usando o
   `client_secret` que só ele tem), valida o `id_token`, cria/atualiza o usuário
   em `auth.users` e gera um `code` PKCE próprio.

5. **Supabase redireciona de volta ao seu app**, na rota `redirectTo` que você
   passou (ex.: `http://localhost:5173/auth/callback?code=...`).

6. **App troca o `code` por sessão:** `supabase.auth.exchangeCodeForSession(code)`.
   O `code_verifier` gravado no passo 1 (mesma origem, `localStorage`) fecha o
   PKCE. Agora há uma **sessão** persistida; `onAuthStateChange` dispara e o app
   navega para a área logada.

A partir daí, toda query ao Supabase carrega o JWT da sessão, e o **RLS** decide
o que o usuário pode ver/fazer.

## PKCE: por que e como

Usamos **`flowType: 'pkce'`** (Proof Key for Code Exchange). É o fluxo recomendado
para SPAs porque não expõe tokens na URL e é resistente a interceptação do código.

- No `signInWithOAuth`, o supabase-js gera um `code_verifier` aleatório e o guarda
  no `localStorage`; envia só o `code_challenge` (hash) para o provedor.
- No callback, `exchangeCodeForSession(code)` recupera o `code_verifier` e prova a
  posse — só quem iniciou o login consegue trocar o código.
- **Implicação:** o login e o callback precisam rodar na **mesma origem** (mesmo
  `localStorage`). Não inicie o login numa aba/origem e complete em outra.

## Duas decisões de design importantes (e o porquê)

### `skipBrowserRedirect: true` + navegação manual
Por padrão o supabase-js faz o redirect sozinho. Aqui pedimos a URL e navegamos
explicitamente (`window.location.assign`). Motivo: **controle e visibilidade** —
se o Supabase não retornar a URL (config errada), o erro aparece na hora em vez
de um redirect silencioso que "não faz nada".

### `detectSessionInUrl: false` + troca manual no `/auth/callback`
Por padrão o supabase-js detecta o `?code=` na URL e troca sozinho. Desligamos
isso e trocamos **manualmente** em `AuthCallback` com `exchangeCodeForSession`.
Motivo: **timing**. O auto-processamento corria com o guard de rota
(`RequireAuth`), causando um flicker/loop pro `/login`. Fazendo manual, a gente:
- troca o code uma única vez (guarda de `useRef`),
- espera o status virar `authenticated` antes de navegar,
- e mostra o erro do provedor (`?error_description=`) numa tela em vez de sumir.

## Modo "dev" (fallback sem Supabase)

A implementação de referência tem um truque útil: se **não houver** Supabase
configurado (`VITE_SUPABASE_URL`/`ANON_KEY` ausentes), o `SessionProvider` cai
num **modo dev** com sessão local simulada, para o app continuar navegável (útil
com dados mock). Assim que você configura o Supabase, ele passa automaticamente
para o **modo entra** (login real). Veja `authConfig.ts` em
[05-codigo-frontend.md](05-codigo-frontend.md).

## Camadas de segurança (defesa em profundidade)

- **Frontend guards** (`RequireAuth`, `RequireAdmin`): só de **navegação/UX**.
  Não são a verdade — apenas escondem telas.
- **A verdade é o servidor:** RLS *deny-by-default* no Postgres. O JWT da sessão
  determina o acesso. Mesmo que a UI falhe, o banco recusa.
- **Papéis (RBAC)** vivem em `user_roles` no servidor; o cliente **nunca** informa
  o próprio papel — ele é lido do banco após o login. Ver [06-rbac-e-banco.md](06-rbac-e-banco.md).

Próximo: [02-credenciais.md](02-credenciais.md) — todas as credenciais, uma a uma.
