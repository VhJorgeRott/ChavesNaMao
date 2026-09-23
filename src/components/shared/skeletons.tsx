import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Peças de skeleton reaproveitadas pelas telas enquanto os dados carregam.
 * Seguem as medidas dos componentes reais (PageHeader, linhas de lista) para a
 * troca skeleton → conteúdo não pular a página.
 */

/** Mesmo casco do PageHeader, para telas cujo título depende do dado carregado. */
export function CabecalhoSkeleton({ voltar = false }: { voltar?: boolean }): React.JSX.Element {
  return (
    <header className="border-b border-border bg-card px-4 py-3 safe-px md:px-8" aria-busy="true">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        {voltar ? (
          <Skeleton className="h-9 w-9 shrink-0 rounded-[10px]" />
        ) : (
          <Skeleton className="h-5 w-5 shrink-0" />
        )}
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-64 max-w-[60vw]" />
        </div>
      </div>
    </header>
  );
}

/** Linhas de lista/tabela: um avatar/ícone opcional + duas linhas de texto + coluna à direita. */
export function LinhasSkeleton({
  linhas = 6,
  className,
}: {
  linhas?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={cn('divide-y divide-border', className)} aria-busy="true">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4" style={{ width: `${55 - (i % 3) * 10}%` }} />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Lista de cartões clicáveis (Inspeções, Pendências): 3 linhas de texto + status à direita. */
export function CartoesSkeleton({ qtd = 5 }: { qtd?: number }): React.JSX.Element {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: qtd }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 md:flex-row md:items-center md:gap-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4" style={{ width: `${60 - (i % 3) * 10}%` }} />
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex items-center gap-3 md:w-72 md:justify-end">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Página genérica em carregamento: cabeçalho + blocos de conteúdo. */
export function PaginaSkeleton(): React.JSX.Element {
  return (
    <>
      <CabecalhoSkeleton />
      <div
        className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-6 safe-px md:px-8 md:py-8"
        aria-busy="true"
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[124px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[260px] w-full rounded-xl" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    </>
  );
}
