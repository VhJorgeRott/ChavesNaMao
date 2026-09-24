import { Navigate, useLocation } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginaSkeleton } from '@/components/shared/skeletons';
import { useAuth } from './SessionProvider';

/**
 * Guard de autenticação das rotas internas. Enquanto a sessão resolve, mostra o
 * casco do app em skeleton; sem sessão, redireciona para /login. A verdade final do acesso aos
 * dados é sempre o servidor (RLS) — este guard é apenas de navegação.
 */
export function RequireAuth({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        <aside className="hidden w-[13.125rem] flex-col gap-3 border-r border-sidebar-border bg-sidebar px-5 py-5 md:flex">
          <div className="mb-3 flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </aside>
        <main className="flex flex-1 flex-col overflow-hidden bg-page-bg">
          <PaginaSkeleton />
        </main>
      </div>
    );
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
