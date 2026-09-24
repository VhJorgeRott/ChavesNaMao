# 4. Configuração no Supabase

Aqui você conecta o Supabase ao Entra (colando as credenciais do capítulo 3) e
autoriza a URL de callback do seu **app**.

> Painel: <https://supabase.com/dashboard> → seu projeto.

## Passo 1 — Pegar as credenciais públicas do projeto

**Project Settings → API**:

- **Project URL** → vai para `VITE_SUPABASE_URL` no `.env` do app.
- **Project API keys → `anon` `public`** → vai para `VITE_SUPABASE_ANON_KEY`.

⚠️ **Nunca** use a chave `service_role` no frontend. Ela ignora o RLS. (O app tem
uma trava que barra o boot se detectar isso — ver `assertChaveNaoPrivilegiada`.)

## Passo 2 — Habilitar o provider Azure

**Authentication → Providers → Azure** (também aparece como "Azure"/"Microsoft"):

1. Ative o toggle **Enable Sign in with Azure**.
2. **Client ID (Application ID):** cole o **client_id** do Entra.
3. **Secret Value:** cole o **client_secret** (o `Value` do capítulo 3).
4. **Azure Tenant URL** (ou "Tenant ID", dependendo da versão do painel):
   - Se o campo pedir **URL**, use:
     `https://login.microsoftonline.com/<TENANT_ID>`
   - Se pedir só o **Tenant ID**, cole o GUID do tenant.
   - Para multitenant, alguns setups usam `.../common` ou `.../organizations` no
     lugar do GUID. Para app de org única, use o **GUID do tenant** (mais seguro).
5. **Copie a "Callback URL (for OAuth)"** mostrada nesta tela — é a
   `https://<ref>.supabase.co/auth/v1/callback` que você registrou no Entra.
   Confirme que batem exatamente.
6. **Save**.

## Passo 3 — Allow-list das Redirect URLs do app

Esta é a parte que o pessoal esquece e o login "volta pro /login sem erro".

**Authentication → URL Configuration**:

- **Site URL:** a URL principal do app em produção, ex. `https://app.suaempresa.com`
  (em dev pode ser `http://localhost:5173`).
- **Redirect URLs (allow list):** adicione **todas** as origens/rotas de callback
  do seu app que o Supabase pode redirecionar de volta. Inclua dev e prod:

  ```
  http://localhost:5173/auth/callback
  http://localhost:5174/auth/callback
  https://app.suaempresa.com/auth/callback
  ```

  > O `redirectTo` que o app envia no `signInWithOAuth` **precisa** casar com um
  > item desta lista, senão o Supabase recusa o redirect. Wildcards são suportados
  > (ex. `http://localhost:5173/**`), mas prefira URLs explícitas.

## Passo 4 — (se usar papéis) criar a tabela `user_roles`

Se você quer RBAC (admin/equipe), crie a tabela e as políticas. O SQL completo
está em [06-rbac-e-banco.md](06-rbac-e-banco.md). Resumo do que ela faz:

- `user_roles(user_id → auth.users, papel)` — a **verdade** do papel vive aqui.
- RLS: cada usuário pode **ler o próprio papel**; só admin gerencia os demais.
- Funções `is_admin()` / `is_equipe()` para usar nas políticas das outras tabelas.

Sem essa tabela, o app de referência ainda loga — cai no papel mínimo
(`equipe_entrega`) e só emite um `console.warn` (ver `loadUserFromSession`).

## Passo 5 — Configurações de sessão (opcional, recomendado)

**Authentication → Sessions / Settings**:

- Deixe o **refresh token rotation** ligado (padrão) — o supabase-js já faz
  `autoRefreshToken: true`.
- Ajuste o tempo de expiração do JWT conforme sua política (padrão 3600s costuma
  servir).

## Como o Supabase e o `.env` se conectam

```
         Entra (client_id, secret, tenant)
                     │  cola no painel
                     ▼
        ┌────────────────────────────┐
        │        Supabase Auth        │
        │  Project URL   anon key     │
        └──────────┬────────┬─────────┘
                   │        │  vão pro .env do app
                   ▼        ▼
   VITE_SUPABASE_URL   VITE_SUPABASE_ANON_KEY
```

## Checklist desta etapa

- [ ] Provider **Azure** habilitado com client_id + secret + tenant
- [ ] "Callback URL (for OAuth)" do Supabase == redirect URI cadastrada no Entra
- [ ] **Redirect URLs** do app (dev **e** prod) na allow-list
- [ ] `Project URL` e `anon key` copiados para o `.env`
- [ ] (se RBAC) tabela `user_roles` + RLS criadas

Próximo: [05-codigo-frontend.md](05-codigo-frontend.md) — o código.
