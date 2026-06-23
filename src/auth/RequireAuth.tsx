import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './SessionProvider';

/**
 * Guard de autenticação das rotas internas. Enquanto a sessão resolve, mostra um
 * loader; sem sessão, redireciona para /login. A verdade final do acesso aos
 * dados é sempre o servidor (RLS) — este guard é apenas de navegação.
 */
export function RequireAuth({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-bg">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
