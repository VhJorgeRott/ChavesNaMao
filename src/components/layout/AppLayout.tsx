import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { AppSidebar } from './AppSidebar';
import { Button } from '@/components/ui/button';
import { logAtividade } from '@/lib/atividade';

/**
 * Largura abaixo da qual a sidebar recolhe sozinha. Token próprio, separado do
 * breakpoint `md` (768px) que divide o conteúdo — ver docs/design-system/navegacao.md.
 */
const SIDEBAR_AUTO_COLLAPSE = 1050;

/**
 * Shell autenticado: sidebar fixa no desktop, drawer no mobile, e o fundo cinza
 * (`--page-bg`) pintado uma única vez no scroll container (ver page-background.md).
 */
export function AppLayout(): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= SIDEBAR_AUTO_COLLAPSE);
  const location = useLocation();

  // Cruzar o limiar força o estado; dentro da mesma faixa, o toggle manual manda.
  // Só o evento `change` (não o valor inicial), senão o estado manual seria
  // desfeito a cada re-render.
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${SIDEBAR_AUTO_COLLAPSE}px)`);
    const onChange = (e: MediaQueryListEvent): void => setCollapsed(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Atalho ⌘B / Ctrl+B, igual ao Control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Registra a navegação entre telas (nível de rota) para a trilha de atividade.
  // logAtividade é no-op sem sessão/backend, então só persiste no modo autenticado.
  useEffect(() => {
    void logAtividade({
      action: 'page.view',
      entity: 'route',
      metadata: { path: location.pathname, title: document.title },
    });
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:block">
        <AppSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
          <button
            className="absolute right-4 top-4 rounded-md bg-card p-2 text-foreground shadow"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2 safe-pt md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="text-sm font-bold">Chaves na Mão</span>
          </div>
        </header>

        {/* Scroll container — fonte única do fundo cinza */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-page-bg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
