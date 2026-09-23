# 7. Checklist de replicação + troubleshooting

Guia rápido para colocar "Entrar com Microsoft" em **outro app** do zero, e a
lista dos erros que você provavelmente vai encontrar (com a solução).

## Checklist de replicação (do zero → login funcionando)

### A. Azure / Entra ID — ver [03](03-configuracao-azure-entra.md)
- [ ] Registrar app em **App registrations**
- [ ] Anotar **Client ID** e **Tenant ID** (Overview)
- [ ] Criar **Client Secret** e copiar o **Value** (só aparece uma vez!)
- [ ] Redirect URI **Web** = `https://<ref>.supabase.co/auth/v1/callback`
- [ ] API permissions: `openid`, `email`, `profile`, `User.Read` (+ admin consent se preciso)

### B. Supabase — ver [04](04-configuracao-supabase.md)
- [ ] Copiar **Project URL** e **anon public key** (Settings → API)
- [ ] Auth → Providers → **Azure**: colar Client ID + Secret + Tenant, salvar
- [ ] Auth → URL Configuration: **Site URL** + **Redirect URLs** (dev **e** prod)
- [ ] (se RBAC) criar `user_roles` + funções + RLS — ver [06](06-rbac-e-banco.md)

### C. Código do app — ver [05](05-codigo-frontend.md)
- [ ] `npm install @supabase/supabase-js react-router-dom zod`
- [ ] Copiar `lib/env.ts`, `lib/supabase.ts`
- [ ] Copiar `auth/authConfig.ts`, `auth/entra.ts`, `auth/SessionProvider.tsx`,
      `auth/RequireAuth.tsx`, `auth/RequireAdmin.tsx`
- [ ] Copiar `pages/Login.tsx`, `pages/AuthCallback.tsx`
- [ ] Adaptar tipos `AppUser`/`Papel` ao seu domínio
- [ ] Registrar rotas `/login` e `/auth/callback` no `App.tsx`
- [ ] Envolver as rotas com `<SessionProvider>`; proteger internas com `<RequireAuth>`

### D. `.env` do app — ver [02](02-credenciais.md)
- [ ] `VITE_SUPABASE_URL=...`
- [ ] `VITE_SUPABASE_ANON_KEY=...` (a **anon**, não a service_role!)
- [ ] `.env` no `.gitignore`

### E. Teste de fumaça
- [ ] `npm run dev` → abrir `/login`
- [ ] Clicar "Entrar com Microsoft" → tela da Microsoft aparece
- [ ] Logar → volta em `/auth/callback` → cai no `/dashboard`
- [ ] (RBAC) promover 1º admin via SQL Editor; conferir tela de admin

## O que muda de um app para outro

Ao copiar para um app novo, você quase sempre vai:

1. **Reaproveitar o mesmo app do Entra** OU registrar um novo. Se reaproveitar,
   some a redirect URI do novo Supabase à lista do Entra.
2. **Criar um novo projeto Supabase** (ou reusar) e colar as credenciais do Entra
   nele. Cada projeto Supabase = um par `URL` + `anon key` diferente no `.env`.
3. **Adaptar `AppUser`/`Papel`** e a fonte de papéis (`user_roles`) ao domínio novo.
4. **Trocar textos/branding** em `Login.tsx`.
5. Ajustar as **Redirect URLs** (dev/prod) do novo app na allow-list do Supabase.

O núcleo (`entra.ts`, `supabase.ts`, `SessionProvider.tsx`, guards, `AuthCallback`)
costuma ir **sem alteração**.

## Troubleshooting — erros comuns

### "redirect_uri_mismatch" (tela da Microsoft)
A redirect URI que o Supabase enviou não bate com a cadastrada no Entra.
→ No Entra, a Redirect URI **Web** tem que ser **exatamente**
`https://<ref>.supabase.co/auth/v1/callback` (sem barra a mais, https, ref certo).

### Loga na Microsoft mas volta pro `/login` sem erro
Quase sempre é a **allow-list de Redirect URLs do Supabase**.
→ Auth → URL Configuration: adicione a URL exata do callback do seu app
(`http://localhost:5173/auth/callback`, a porta certa!) e a de produção. O
`redirectTo` do `loginAzure()` precisa estar nessa lista.

### "both auth code and code verifier should be non-empty" / PKCE falha
O `code_verifier` não foi encontrado no `localStorage`.
→ Causas: você iniciou o login numa origem/porta e voltou em outra; ou limpou o
storage no meio. Garanta **mesma origem** no login e no callback. A porta importa
(5173 ≠ 5174 ≠ prod).

### "Unsupported provider: provider is not enabled"
O provider Azure não está ligado no Supabase.
→ Auth → Providers → Azure → **Enable** + salvar com credenciais.

### Loga, mas o usuário nunca é admin
A leitura de `user_roles` falhou ou o papel não foi atribuído.
→ Confira a policy `user_roles_select_self_or_admin` (o usuário precisa poder ler
o próprio papel). E promova o 1º admin via SQL Editor (ver [06](06-rbac-e-banco.md)).
→ Veja o `console.warn('[auth] ...')` no DevTools — ele diz o motivo.

### App não sobe: "PERIGO DE SEGURANÇA: ... service_role ..."
Você colou a **service_role** em `VITE_SUPABASE_ANON_KEY`. A trava do `env.ts`
barrou (ainda bem — ela ignora o RLS e vazaria tudo).
→ Use a chave **anon public** (Settings → API → Project API keys → `anon` `public`)
e **rotacione** a service_role que ficou exposta.

### "Supabase não configurado" / app cai no "modo desenvolvimento"
Faltam `VITE_SUPABASE_URL` e/ou `VITE_SUPABASE_ANON_KEY` no `.env`.
→ Preencha as duas e reinicie o `npm run dev` (Vite lê `.env` só no boot).

### O login some depois de um tempo / "Invalid login credentials" do nada
O **Client Secret do Entra expirou**.
→ Crie um novo secret no Entra e atualize no Supabase (Auth → Providers → Azure).
Ver "Rotação do secret" em [03](03-configuracao-azure-entra.md).

### Mudou o `.env` e nada acontece
O Vite embute as `VITE_*` no **build/boot**. Reinicie o dev server; para produção,
**rebuild** (`npm run build`) — não adianta trocar a env sem rebuildar.

## Como usar esta skill em outro projeto

Esta pasta é autocontida. Para levar a **outro app**:

- **Como referência (docs):** copie a pasta inteira para o repo novo, ex.
  `cp -r .claude/skills/auth-microsoft-entra /caminho/outro-app/.claude/skills/`
- **Como skill global** (disponível em todos os seus projetos):
  `cp -r .claude/skills/auth-microsoft-entra ~/.claude/skills/`
  Depois é só pedir ao Claude Code "configura login com Microsoft" que ele puxa
  este guia.

Volte ao índice: [SKILL.md](SKILL.md).
