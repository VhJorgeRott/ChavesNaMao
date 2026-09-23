import { ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Peças compartilhadas das telas de lista (Chamados, Entregas): estilo do card de
 * resumo que funciona como filtro e cabeçalho ordenável.
 * Ver docs/design-system — mesma linguagem visual nas duas telas.
 */

/** Célula selecionada dos cards de resumo (Entregas, Chamados). */
export const RESUMO_SELECIONADO =
  'bg-primary/[0.08] shadow-[inset_0_0_0_1.5px_hsl(var(--primary))]';

export interface Ordem<T extends string> {
  campo: T;
  dir: 'asc' | 'desc';
}

/** Cabeçalho de coluna ordenável. Coluna nova começa asc; repetir inverte. */
export function CabecalhoOrdenavel<T extends string>({
  label,
  campo,
  ordem,
  onOrdenar,
  className,
}: {
  label: string;
  campo: T;
  ordem: Ordem<T>;
  onOrdenar: (campo: T) => void;
  className?: string;
}): React.JSX.Element {
  const ativa = ordem.campo === campo;
  return (
    <button
      type="button"
      onClick={() => onOrdenar(campo)}
      className={cn(
        'flex items-center gap-1.5 text-left',
        ativa ? 'font-semibold text-foreground' : 'font-medium',
        className,
      )}
    >
      {label}
      {ativa ? (
        <ArrowUp
          className={cn(
            'h-3.5 w-3.5 text-primary transition-transform',
            ordem.dir === 'desc' && 'rotate-180',
          )}
        />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
      )}
    </button>
  );
}
