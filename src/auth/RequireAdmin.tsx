import { Navigate } from 'react-router-dom';
import { useSession } from './SessionProvider';

/**
 * Guard de rota administrativa. Em produção, a UI esconde a rota E o servidor
 * recusa via RLS (deny-by-default). Aqui refletimos o papel da sessão.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { isAdmin } = useSession();
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
