import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fNum } from '@chaves/domain/format';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface OpcaoFiltro {
  valor: string;
  label: string;
  /** Contagem facetada (aplica os outros filtros). */
  qtd?: number | undefined;
}

type Props = {
  icon: LucideIcon;
  label: string;
  opcoes: OpcaoFiltro[];
} & (
  | { multi: true; valor: string[]; onChange: (v: string[]) => void; resumoVazio: string }
  | { multi?: false; valor: string; onChange: (v: string) => void; padrao: string }
);

/**
 * Filtro em dropdown próprio (sem <select> nativo). Multi: marca num rascunho e
 * confirma em "Aplicar". Single: fecha ao escolher.
 */
export function FiltroDropdown(props: Props): React.JSX.Element {
  const { icon: Icon, label, opcoes } = props;
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<string[]>([]);

  const ativo = props.multi ? props.valor.length > 0 : props.valor !== props.padrao;
  const resumo = props.multi
    ? props.valor.length === 0
      ? props.resumoVazio
      : props.valor.length === 1
        ? (opcoes.find((o) => o.valor === props.valor[0])?.label ?? '1 selecionado')
        : null
    : (opcoes.find((o) => o.valor === props.valor)?.label ?? '');

  const abrir = (v: boolean): void => {
    if (v && props.multi) setRascunho(props.valor);
    setAberto(v);
  };

  return (
    <Popover open={aberto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border pl-3.5 pr-3 text-sm transition-colors duration-150',
            ativo
              ? 'border-primary bg-[#fff7e8] dark:bg-primary/10'
              : 'border-border bg-card hover:border-primary',
          )}
        >
          <Icon className={cn('h-4 w-4', ativo ? 'text-primary' : 'text-muted-foreground')} />
          <span className="text-muted-foreground">{label}</span>
          {resumo !== null && (
            <span className="max-w-[180px] truncate font-medium text-foreground">{resumo}</span>
          )}
          {props.multi && props.valor.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
              {props.valor.length}
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-150',
              aberto && 'rotate-180',
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[260px]">
        <ul className="max-h-[280px] overflow-y-auto">
          {opcoes.map((o) => {
            const marcado = props.multi ? rascunho.includes(o.valor) : props.valor === o.valor;
            return (
              <li key={o.valor}>
                <button
                  type="button"
                  onClick={() => {
                    if (props.multi) {
                      setRascunho((r) =>
                        r.includes(o.valor) ? r.filter((v) => v !== o.valor) : [...r, o.valor],
                      );
                    } else {
                      props.onChange(o.valor);
                      setAberto(false);
                    }
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center border',
                      props.multi ? 'rounded' : 'rounded-full',
                      marcado ? 'border-primary bg-primary' : 'border-slate-300',
                    )}
                  >
                    {marcado && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 text-foreground">{o.label}</span>
                  {o.qtd !== undefined && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fNum(o.qtd, 0)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {props.multi && (
          <div className="mt-1 flex justify-end gap-2 border-t border-border px-1 pt-1.5 pb-0.5">
            <button
              type="button"
              onClick={() => setRascunho([])}
              className="h-[30px] rounded-md px-3 text-[13px] font-medium text-muted-foreground hover:bg-muted"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => {
                props.onChange(rascunho);
                setAberto(false);
              }}
              className="h-[30px] rounded-md bg-primary px-3 text-[13px] font-medium text-white hover:bg-[#d98c04]"
            >
              Aplicar
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
