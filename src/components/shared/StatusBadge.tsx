import { ENTREGA_STATUS_META, UNIDADE_STATUS_META } from '@/domain/status';
import type { EntregaStatus, UnidadeStatus } from '@/domain/types';
import { cn } from '@/lib/utils';

/**
 * Pill de status com fundo translúcido na cor da fonte (padrão do design system).
 * `${color}26` = ~15% de alpha em hex.
 */
function Pill({
  label,
  color,
  className,
}: {
  label: string;
  color: string;
  className: string | undefined;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        className,
      )}
      style={{ backgroundColor: `${color}26`, color }}
    >
      {label}
    </span>
  );
}

export function EntregaStatusBadge({
  status,
  className,
}: {
  status: EntregaStatus;
  className?: string;
}): React.JSX.Element {
  const meta = ENTREGA_STATUS_META[status];
  return <Pill label={meta.label} color={meta.color} className={className} />;
}

export function UnidadeStatusBadge({
  status,
  className,
}: {
  status: UnidadeStatus;
  className?: string;
}): React.JSX.Element {
  const meta = UNIDADE_STATUS_META[status];
  return <Pill label={meta.label} color={meta.color} className={className} />;
}
