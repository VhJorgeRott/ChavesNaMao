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
  /** Mensagem do último erro de autenticação (modo entra), para diagnóstico. */
  error: string | null;
  login(): void;
  logout(): void;
  /** Troca o usuário ativo — apenas no modo dev (demo de papéis). */
  setDevUserId(id: string): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const mode: 'entra' | 'dev' = isAuthConfigured ? 'entra' : 'dev';
  const { state } = useData();

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

    // Sessão inicial (após o redirect de /auth/callback o supabase-js já trocou
    // o code por sessão via detectSessionInUrl) + assinatura de mudanças.
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
      setDevUserId: () => {
        /* sem efeito no modo entra */
      },
    };
  }, [mode, state.usuarios, devUserId, devAuthenticated, entraStatus, entraUser, entraError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Acesso completo ao estado de auth (login/logout/status) — usado por guards e Login. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <SessionProvider>');
  return ctx;
}

/**
 * Sessão do usuário autenticado. Use em telas internas (sempre atrás de
 * <RequireAuth>), onde o usuário é garantidamente não-nulo.
 */
export function useSession(): {
  currentUser: AppUser;
  isAdmin: boolean;
  setCurrentUserId(id: string): void;
} {
  const { currentUser, isAdmin, setDevUserId } = useAuth();
  if (!currentUser) throw new Error('useSession usado sem sessão autenticada.');
  return { currentUser, isAdmin, setCurrentUserId: setDevUserId };
}
