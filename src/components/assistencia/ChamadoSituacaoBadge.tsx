import { TimerOff } from 'lucide-react';
import type { ChamadoAssistencia } from '@/adapters/types';
import { Badge } from '@/components/ui/badge';
import { FASE_META } from './fase';

/** Situação do CV (sem o prefixo do fluxo), colorida pela fase. */
export function ChamadoSituacaoBadge({
  chamado,
}: {
  chamado: Pick<ChamadoAssistencia, 'situacao' | 'fase' | 'etapa'>;
}): React.JSX.Element {
  const meta = FASE_META[chamado.fase];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-semibold uppercase"
      style={{ backgroundColor: meta.bg, color: meta.cor }}
    >
      {chamado.etapa !== null && (
        <span className="font-medium opacity-80">{String(chamado.etapa).padStart(2, '0')}</span>
      )}
      {chamado.situacao}
    </span>
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
