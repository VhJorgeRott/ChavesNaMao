import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useData } from '@/data/DataProvider';
import type { AppUser } from '@/domain/types';

/**
 * Sessão simulada para o MVP. Em produção, o usuário vem do Microsoft Entra ID
 * (OIDC/MSAL) integrado ao Supabase Auth, e o papel é lido de `user_roles` com
 * RLS. Aqui mantemos um usuário atual selecionável apenas para navegar as telas
 * e demonstrar o RBAC (admin vs equipe_entrega).
 */
interface SessionContextValue {
  currentUser: AppUser;
  isAdmin: boolean;
  /** Troca o usuário ativo (demo) — simula login com outro papel. */
  setCurrentUserId(id: string): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { state } = useData();
  const [currentUserId, setCurrentUserId] = useState<string>('usr-admin');

  const currentUser = useMemo<AppUser>(() => {
    return state.usuarios.find((u) => u.id === currentUserId) ?? state.usuarios[0]!;
  }, [state.usuarios, currentUserId]);

  const value = useMemo<SessionContextValue>(
    () => ({
      currentUser,
      isAdmin: currentUser.papel === 'admin',
      setCurrentUserId,
    }),
    [currentUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>');
  return ctx;
}
