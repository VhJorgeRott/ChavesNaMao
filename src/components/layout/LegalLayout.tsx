import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Layout das páginas legais (Termos de Uso / Política de Privacidade).
 * Funciona logado e deslogado — não depende de sessão nem do AppLayout.
 */
export function LegalLayout({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-page-bg">
      <header className="border-b border-border bg-card px-4 py-4 safe-px md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">Chaves na Mão</p>
              <p className="text-[11px] text-muted-foreground">Rottas</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Da mesma aba (login/perfil) volta ao histórico; em aba nova, vai ao login.
              if (window.history.length > 1) navigate(-1);
              else navigate('/login');
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8 safe-px md:px-8">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-10">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{titulo}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Última atualização: {atualizadoEm}</p>
          <div className="mt-6 space-y-4">{children}</div>
        </article>
      </main>
    </div>
  );
}

/** Título de seção do texto legal. */
export function LegalH2({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="pt-4 text-base font-semibold text-foreground">{children}</h2>;
}

/** Parágrafo do texto legal. */
export function LegalP({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

/** Lista do texto legal. */
export function LegalUl({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
      {children}
    </ul>
  );
}
