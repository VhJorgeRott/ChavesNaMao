import { TimerOff } from 'lucide-react';
import type { ChamadoAssistencia } from '@/adapters/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FASE_META } from './fase';

/** Situação do CV (sem o prefixo do fluxo), colorida pela fase. */
export function ChamadoSituacaoBadge({
  chamado,
}: {
  chamado: Pick<ChamadoAssistencia, 'situacao' | 'fase' | 'etapa'>;
}): React.JSX.Element {
  return (
    <Badge className={cn('whitespace-nowrap font-medium', FASE_META[chamado.fase].classe)}>
      {chamado.etapa !== null && (
        <span className="mr-1 opacity-70">{String(chamado.etapa).padStart(2, '0')}</span>
      )}
      {chamado.situacao}
    </Badge>
  );
}

export function SlaVencidoBadge(): React.JSX.Element {
  return (
    <Badge variant="destructive" className="gap-1 whitespace-nowrap">
      <TimerOff className="h-3 w-3" />
      SLA vencido
    </Badge>
  );
}
