import type { LucideIcon } from 'lucide-react';

/** Header local da página (padrão Home/Empreendimentos): bg-card + borda inferior. */
export function PageHeader({
  icon: Icon,
  titulo,
  subtitulo,
  actions,
}: {
  icon?: LucideIcon;
  titulo: string;
  subtitulo?: string;
  actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <header className="border-b border-border bg-card px-4 py-4 safe-px md:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{titulo}</h1>
            {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Wrapper de conteúdo da página com max-width padrão (1400px). */
export function PageContent({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 safe-px md:px-8 md:py-8">{children}</div>
  );
}
