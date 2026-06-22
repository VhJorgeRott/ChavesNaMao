import { Check } from 'lucide-react';
import { ENTREGA_STATUS, type EntregaStatus } from '@/domain/types';
import { ENTREGA_STATUS_META } from '@/domain/status';
import { indiceEtapa } from '@/domain/state-machine';
import { cn } from '@/lib/utils';

/** Timeline vertical das 6 etapas, destacando a atual e as concluídas. */
export function EtapaTimeline({ atual }: { atual: EntregaStatus }): React.JSX.Element {
  const idxAtual = indiceEtapa(atual);

  return (
    <ol className="relative">
      {ENTREGA_STATUS.map((estado, idx) => {
        const meta = ENTREGA_STATUS_META[estado];
        const concluida = idx < idxAtual;
        const corrente = idx === idxAtual;
        const last = idx === ENTREGA_STATUS.length - 1;
        return (
          <li key={estado} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors',
                  concluida && 'border-success bg-success text-success-foreground',
                  corrente && 'border-primary bg-primary text-primary-foreground',
                  !concluida && !corrente && 'border-border bg-card text-muted-foreground',
                )}
                style={corrente ? { borderColor: meta.color, backgroundColor: meta.color } : undefined}
              >
                {concluida ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              {!last && (
                <span
                  className={cn('my-0.5 w-0.5 flex-1', concluida ? 'bg-success' : 'bg-border')}
                  style={{ minHeight: 22 }}
                />
              )}
            </div>
            <div className={cn('pb-5', last && 'pb-0')}>
              <p
                className={cn(
                  'text-sm font-semibold',
                  corrente ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {meta.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {concluida ? 'Concluída' : corrente ? 'Etapa atual' : 'Pendente'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
