# 5. O código do frontend (arquivo por arquivo)

Todo o código de autenticação, pronto para copiar. É o mesmo do projeto de
referência. A estrutura é:

```
src/
├── lib/
│   ├── env.ts          # valida VITE_* com Zod + trava anti service_role
│   └── supabase.ts     # cria o client Supabase (lazy, PKCE)
├── auth/
│   ├── authConfig.ts   # decide modo "entra" (real) vs "dev" (fallback)
│   ├── entra.ts        # as funções de OAuth: login, exchange, logout, sessão
│   ├── SessionProvider.tsx   # Context React: status, currentUser, login/logout
│   ├── RequireAuth.tsx       # guard: exige sessão
│   └── RequireAdmin.tsx      # guard: exige papel admin
└── pages/
    ├── Login.tsx        # botão "Entrar com Microsoft"
    └── AuthCallback.tsx # rota /auth/callback: troca code por sessão
```

Dependências:

```bash
npm install @supabase/supabase-js react-router-dom zod
```

E o alias `@/` → `src/` (no `vite.config.ts` e `tsconfig`), que o projeto já usa.

---

## `src/lib/env.ts` — validação do ambiente

Valida as `VITE_*` no import (falha cedo se faltar algo) e **impede o boot** se
alguém colar uma chave `service_role` no lugar da `anon`.

```ts
import { z } from 'zod';

/**
 * Validação do ambiente do CLIENTE (apenas variáveis VITE_*, que são públicas).
 * Segredos (service_role, client_secret, HMAC) NÃO entram aqui.
 */
const clientEnvSchema = z.object({
  VITE_ADAPTER_MODE: z.enum(['mock', 'live']).default('mock'),
  // Opcionais: exigidos só quando o client Supabase é instanciado (ver supabase.ts).
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_ENTRA_CLIENT_ID: z.string().min(1).optional(),
  VITE_ENTRA_TENANT_ID: z.string().min(1).optional(),
  VITE_ENTRA_REDIRECT_URI: z.string().url().optional(),
  VITE_PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type AdapterMode = ClientEnv['VITE_ADAPTER_MODE'];

/**
 * Trava de segurança: impede que uma chave service_role/supabase_admin — que
 * ignora o RLS — seja usada no cliente. Decodifica o payload do JWT e recusa o
 * boot se o papel for elevado.
 */
function assertChaveNaoPrivilegiada(key: string | undefined): void {
  if (!key) return;
  const parts = key.split('.');
  if (parts.length !== 3) return; // não parece JWT
  let role: unknown;
  try {
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    role = (JSON.parse(atob(b64)) as { role?: unknown }).role;
  } catch {
    return;
  }
  if (role === 'service_role' || role === 'supabase_admin') {
    throw new Error(
      'PERIGO DE SEGURANÇA: VITE_SUPABASE_ANON_KEY contém uma chave "' +
        String(role) +
        '", que IGNORA o RLS e jamais pode ir para o cliente. ' +
        'Use a chave "anon public".',
    );
  }
}

function loadEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida. Cheque seu .env:\n${issues}`);
  }
  assertChaveNaoPrivilegiada(parsed.data.VITE_SUPABASE_ANON_KEY);
  return parsed.data;
}

export const env: ClientEnv = loadEnv();
```

---

## `src/lib/supabase.ts` — o client (lazy, PKCE)

Cria o client sob demanda. Note os quatro `auth` options — são **essenciais**:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.',
    );
  }
  client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,       // guarda a sessão no localStorage
      autoRefreshToken: true,     // renova o access token sozinho
      detectSessionInUrl: false,  // NÓS trocamos o ?code manualmente (ver AuthCallback)
      flowType: 'pkce',           // fluxo recomendado para SPA
    },
  });
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__supabase = client; // debug no console
  }
  return client;
}
```

Por que `detectSessionInUrl: false`? Para trocar o `code` explicitamente no
`/auth/callback` e controlar o timing (evita corrida com o guard de rota). Ver
[01-visao-geral.md](01-visao-geral.md).

---

## `src/auth/authConfig.ts` — modo entra vs dev

```ts
import { env } from '@/lib/env';

/** True quando há backend de auth (Supabase) configurado para o login real. */
export const isAuthConfigured: boolean = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY,
);
```

Se `false`, o `SessionProvider` cai no **modo dev** (sessão local simulada) para o
app continuar navegável sem backend. Em produção, mantenha as duas vars setadas.

---

## `src/auth/entra.ts` — as funções OAuth (o coração)

```ts
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { AppUser, Papel } from '@/domain/types';

function redirectTo(): string {
  return `${window.location.origin}/auth/callback`;
}

/** Inicia o login redirecionando para a Microsoft (via Supabase). */
export async function loginAzure(): Promise<void> {
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'openid email profile',
      redirectTo: redirectTo(),
      skipBrowserRedirect: true, // assumimos o redirect p/ tornar falhas visíveis
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Supabase não retornou a URL de autorização do Azure.');
  window.location.assign(data.url);
}

/** Troca o ?code do callback por uma sessão (PKCE). Retorna msg de erro, se houver. */
export async function exchangeCode(code: string): Promise<string | null> {
  const { error } = await getSupabase().auth.exchangeCodeForSession(code);
  return error ? error.message : null;
}

/** Encerra a sessão. */
export async function logoutAzure(): Promise<void> {
  await getSupabase().auth.signOut();
}

/** Sessão atual, se houver. */
export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

/** Assina mudanças de sessão (login/logout/refresh). Retorna o unsubscribe. */
export function onAuthChange(cb: (session: Session | null) => void): { unsubscribe: () => void } {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => cb(session));
  return data.subscription;
}

/** Mapeia a sessão para o AppUser, carregando o papel de user_roles. */
export async function loadUserFromSession(session: Session): Promise<AppUser> {
  const user = session.user;

  // Falha ao ler o papel NÃO impede o login — cai no papel mínimo.
  let papel: Papel = 'equipe_entrega';
  try {
    const { data: roleRow, error } = await getSupabase()
      .from('user_roles')
      .select('papel')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) console.warn('[auth] não foi possível ler user_roles:', error.message);
    else if (roleRow?.papel) papel = roleRow.papel as Papel;
  } catch (e) {
    console.warn('[auth] erro ao consultar user_roles:', e);
  }

  const meta = (user.user_metadata ?? {}) as { name?: unknown; full_name?: unknown };
  const nome =
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    user.email ||
    'Usuário';

  return { id: user.id, nome, email: user.email ?? '', papel, ultimaAtividade: null };
}
```

> **Tipos:** `AppUser` e `Papel` são do domínio do projeto de referência. Ao
> replicar, substitua por tipos seus. O mínimo é `Papel = 'admin' | 'equipe_entrega'`
> e `AppUser = { id; nome; email; papel; ... }`.

---

## `src/auth/SessionProvider.tsx` — o Context

Concentra o estado de auth e expõe `useAuth()`/`useSession()`. Suporta os dois
modos (entra/dev).

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useData } from '@/data/DataProvider';
import type { AppUser } from '@/domain/types';
import { isAuthConfigured } from './authConfig';
import {
  getCurrentSession,
  loadUserFromSession,
  loginAzure,
  logoutAzure,
  onAuthChange,
} from './entra';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthContextValue {
  mode: 'entra' | 'dev';
  status: AuthStatus;
  currentUser: AppUser | null;
  isAdmin: boolean;
  error: string | null;
  login(): void;
  logout(): void;
  setDevUserId(id: string): void; // só no modo dev
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const mode: 'entra' | 'dev' = isAuthConfigured ? 'entra' : 'dev';
  const { state } = useData(); // fonte dos usuários no modo dev; remova se não usar

  // Modo dev: começa deslogado para exercitar o fluxo de login/guard.
  const [devUserId, setDevUserId] = useState<string>('usr-admin');
  const [devAuthenticated, setDevAuthenticated] = useState<boolean>(false);

  // Modo entra: estado da sessão real.
  const [entraStatus, setEntraStatus] = useState<AuthStatus>('loading');
  const [entraUser, setEntraUser] = useState<AppUser | null>(null);
  const [entraError, setEntraError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'entra') return;
    let ativo = true;

    async function aplicarSessao(session: Awaited<ReturnType<typeof getCurrentSession>>) {
      if (!ativo) return;
      if (!session) {
        setEntraUser(null);
        setEntraStatus('unauthenticated');
        return;
      }
      try {
        const user = await loadUserFromSession(session);
        if (!ativo) return;
        setEntraUser(user);
        setEntraError(null);
        setEntraStatus('authenticated');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[auth:entra] falha ao carregar perfil:', e);
        if (ativo) {
          setEntraError(`Falha ao carregar o perfil — ${msg}`);
          setEntraStatus('unauthenticated');
        }
      }
    }

    void getCurrentSession()
      .then(aplicarSessao)
      .catch(() => ativo && setEntraStatus('unauthenticated'));
    const sub = onAuthChange((session) => void aplicarSessao(session));

    return () => {
      ativo = false;
      sub.unsubscribe();
    };
  }, [mode]);

  const value = useMemo<AuthContextValue>(() => {
    if (mode === 'dev') {
      const user = state.usuarios.find((u) => u.id === devUserId) ?? state.usuarios[0] ?? null;
      return {
        mode,
        status: devAuthenticated ? 'authenticated' : 'unauthenticated',
        currentUser: devAuthenticated ? user : null,
        isAdmin: devAuthenticated && user?.papel === 'admin',
        error: null,
        login: () => setDevAuthenticated(true),
        logout: () => setDevAuthenticated(false),
        setDevUserId,
      };
    }
    return {
      mode,
      status: entraStatus,
      currentUser: entraUser,
      isAdmin: entraUser?.papel === 'admin',
      error: entraError,
      login: () =>
        void loginAzure().catch((e) =>
          setEntraError(e instanceof Error ? e.message : 'Falha ao iniciar o login'),
        ),
      logout: () => void logoutAzure(),
      setDevUserId: () => {},
    };
  }, [mode, state.usuarios, devUserId, devAuthenticated, entraStatus, entraUser, entraError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <SessionProvider>');
  return ctx;
}

/** Sessão garantida (use atrás de <RequireAuth>). */
export function useSession(): {
  currentUser: AppUser;
  isAdmin: boolean;
  setCurrentUserId(id: string): void;
} {
  const { currentUser, isAdmin, setDevUserId } = useAuth();
  if (!currentUser) throw new Error('useSession usado sem sessão autenticada.');
  return { currentUser, isAdmin, setCurrentUserId: setDevUserId };
}
```

> **Ao replicar sem os dados mock:** remova `useData()` e o bloco `mode === 'dev'`.
> Fica só o modo entra. O modo dev é uma conveniência, não parte essencial do login.

---

## `src/auth/RequireAuth.tsx` — guard de sessão

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './SessionProvider';

export function RequireAuth({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
```

## `src/auth/RequireAdmin.tsx` — guard de papel

```tsx
import { Navigate } from 'react-router-dom';
import { useSession } from './SessionProvider';

export function RequireAdmin({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isAdmin } = useSession();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
```

> Lembre: guards são **UX**. A autorização real é o **RLS** no banco.

---

## `src/pages/Login.tsx` — o botão

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/auth/SessionProvider';
import { Button } from '@/components/ui/button';

/** Logo da Microsoft (4 quadrados), SVG inline. */
function MicrosoftLogo(): React.JSX.Element {
  return (
    <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function Login(): React.JSX.Element {
  const { status, login, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'authenticated') navigate('/dashboard', { replace: true });
  }, [status, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Chaves na Mão</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso restrito à equipe</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <Button className="w-full" size="lg" onClick={login}>
          <MicrosoftLogo />
          Entrar com Microsoft
        </Button>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Login exclusivamente via Microsoft Entra ID · sem senha própria
      </p>
    </div>
  );
}
```

---

## `src/pages/AuthCallback.tsx` — a rota `/auth/callback`

Troca o `?code=` por sessão, espera o status assentar (evita corrida com o guard)
e mostra o erro do provedor em vez de voltar em silêncio ao login.

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/auth/SessionProvider';
import { exchangeCode } from '@/auth/entra';
import { Button } from '@/components/ui/button';

export function AuthCallback(): React.JSX.Element {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(true);
  const [trocaOk, setTrocaOk] = useState(false);
  const jaTrocou = useRef(false);

  // Passo 1: trocar o code (ou capturar erro do provedor) — uma única vez.
  useEffect(() => {
    if (jaTrocou.current) return;
    jaTrocou.current = true;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const errDesc = params.get('error_description') ?? params.get('error');
      const code = params.get('code');
      if (errDesc) {
        setErro(errDesc);
        setTrocando(false);
        return;
      }
      if (code) {
        const msg = await exchangeCode(code);
        if (msg) setErro(msg);
        else setTrocaOk(true);
        window.history.replaceState({}, '', '/auth/callback'); // limpa o code da URL
      }
      setTrocando(false);
    })();
  }, []);

  // Passo 2: encaminhar pelo status (esperando 'authenticated' após troca OK).
  useEffect(() => {
    if (trocando || erro) return;
    if (status === 'authenticated') navigate('/dashboard', { replace: true });
    else if (status === 'unauthenticated' && !trocaOk) navigate('/login', { replace: true });
  }, [status, trocando, erro, trocaOk, navigate]);

  if (erro) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-destructive" />
          <h1 className="text-lg font-semibold">Não foi possível concluir o login</h1>
          <p className="mt-2 break-words text-sm text-muted-foreground">{erro}</p>
          <Button asChild className="mt-6">
            <Link to="/login">Voltar ao login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Concluindo o login...
      </div>
    </div>
  );
}
```

---

## Ligando tudo: `App.tsx` (roteamento)

O `SessionProvider` envolve as rotas. As rotas públicas (`/login`,
`/auth/callback`) ficam fora do guard; as internas ficam atrás de `RequireAuth`.

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider } from '@/auth/SessionProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { Login } from '@/pages/Login';
import { AuthCallback } from '@/pages/AuthCallback';
// ... demais páginas

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Internas — exigem sessão */}
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* rota só de admin */}
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
export default App;
```

> ⚠️ A rota `/auth/callback` **precisa existir** e casar com o `redirectTo` do
> `loginAzure()` **e** com a allow-list de Redirect URLs no Supabase.

Próximo: [06-rbac-e-banco.md](06-rbac-e-banco.md).
