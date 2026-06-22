import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { KeyRound, Menu, X } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { Button } from '@/components/ui/button';

/**
 * Shell autenticado: sidebar fixa no desktop, drawer no mobile, e o fundo cinza
 * (`--page-bg`) pintado uma única vez no scroll container (ver page-background.md).
 */
export function AppLayout(): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:block">
        <AppSidebar />
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
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <KeyRound className="h-4 w-4" />
            </div>
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
