# 3. Configuração no portal Azure (Microsoft Entra ID)

Objetivo desta etapa: registrar um "app" no Entra e obter **client_id**,
**tenant_id** e **client_secret**, além de autorizar a URL de callback do Supabase.

> Portal: <https://portal.azure.com> → busque por **"Microsoft Entra ID"**
> (antigo "Azure Active Directory").

## Antes de começar: pegue a URL de callback do Supabase

Você vai precisar dela no passo 3. Ela tem sempre este formato:

```
https://<PROJECT-REF>.supabase.co/auth/v1/callback
```

O `<PROJECT-REF>` é o subdomínio do seu projeto Supabase (ex.: `abcdxyz`). Você
também encontra essa URL pronta no painel do Supabase em **Authentication →
Providers → Azure** (campo "Callback URL (for OAuth)"). Copie de lá para não errar.

## Passo 1 — Registrar o aplicativo

1. Entra ID → **App registrations** → **+ New registration**.
2. **Name:** algo reconhecível, ex. `Chaves na Mão — Auth`.
3. **Supported account types:** escolha conforme sua necessidade:
   - **Single tenant** ("Accounts in this organizational directory only") —
     recomendado para app corporativo interno (só usuários da sua org).
   - **Multitenant** — se usuários de outras organizações Microsoft vão entrar.
4. **Redirect URI:** selecione a plataforma **Web** e cole a **URL de callback do
   Supabase** (a do formato `.../auth/v1/callback` acima). ⚠️ **É a do Supabase,
   não a do seu app.**
5. **Register**.

## Passo 2 — Anotar Client ID e Tenant ID

Na tela **Overview** do app recém-criado, copie:

- **Application (client) ID** → este é o seu **`client_id`**.
- **Directory (tenant) ID** → este é o seu **`tenant_id`**.

Guarde os dois — vão para o painel do Supabase (não para o `.env`).

## Passo 3 — Criar o Client Secret

1. No app → **Certificates & secrets** → aba **Client secrets** → **+ New client secret**.
2. **Description:** ex. `supabase-oauth`.
3. **Expires:** escolha a validade (ex. 6, 12 ou 24 meses). ⚠️ **Anote a data** —
   quando expirar, o login para de funcionar até você rotacionar (ver abaixo).
4. **Add**.
5. **Copie o `Value` AGORA** (não o `Secret ID`). O `Value` só aparece uma vez;
   se sair da tela, ele fica mascarado para sempre e você terá que criar outro.

Esse `Value` é o seu **`client_secret`** → vai para o painel do Supabase.

## Passo 4 — Redirect URIs (confirme e adicione as do app se necessário)

Em **Authentication → Platform configurations → Web → Redirect URIs**, garanta que
existe a URL de callback do **Supabase**:

```
https://<PROJECT-REF>.supabase.co/auth/v1/callback
```

> No desenho com Supabase-broker, **só a URL do Supabase** precisa estar aqui. A
> URL do seu app (`http://localhost:5173/auth/callback`) é autorizada **no
> Supabase** (próximo capítulo), não no Entra. Só adicione URLs do seu app aqui
> se um dia usar MSAL direto.

Marque também, se aparecer, **ID tokens** em "Implicit grant and hybrid flows"
não é necessário para PKCE/authorization code — pode deixar desmarcado.

## Passo 5 — Permissões de API (escopos)

Em **API permissions**, o padrão já inclui **Microsoft Graph → `User.Read`** com
consentimento delegado, o que basta para `openid email profile`. Verifique que
estão presentes (Microsoft Graph, delegated):

- `openid`
- `email`
- `profile`
- `User.Read` (padrão)

Se sua organização exigir **admin consent**, clique em **Grant admin consent for
<sua org>** para evitar que cada usuário veja a tela de consentimento.

## Passo 6 — (opcional) Restringir quem pode entrar

Se quiser que **apenas usuários atribuídos** acessem:
Entra ID → **Enterprise applications** → seu app → **Properties** →
**Assignment required? = Yes**, depois **Users and groups** → atribua as pessoas.

## Resultado desta etapa

Você deve ter em mãos:

| Valor | Exemplo de formato |
|-------|--------------------|
| **Client ID** | `00000000-0000-0000-0000-000000000000` |
| **Tenant ID** | `00000000-0000-0000-0000-000000000000` |
| **Client Secret (Value)** | `abc7Q~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

## Rotação do secret (importante!)

O `client_secret` **expira**. Quando chegar perto do vencimento:

1. Crie um **novo** secret no Entra (Passo 3) — o antigo continua válido em paralelo.
2. Cole o **novo** `Value` no painel do Supabase (Auth → Providers → Azure → Secret) e salve.
3. Teste o login.
4. Só então **delete o secret antigo** no Entra.

Fazendo nessa ordem, você roda sem downtime.

Próximo: [04-configuracao-supabase.md](04-configuracao-supabase.md).
