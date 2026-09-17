import type { InspecaoFvs, StatusNc } from '@chaves/domain/qualidade';
import { STATUS_NC_LABEL } from '@chaves/domain/qualidade';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function InspecaoStatusBadge({
  inspecao,
}: {
  inspecao: Pick<InspecaoFvs, 'status' | 'resultado'>;
}): React.JSX.Element {
  if (inspecao.status === 'em_andamento') {
    return <Badge className="border-transparent bg-sky-100 text-sky-800">Em andamento</Badge>;
  }
  return inspecao.resultado === 'aprovada' ? (
    <Badge variant="success">Aprovada</Badge>
  ) : (
    <Badge variant="destructive">Reprovada</Badge>
  );
}

const COR_NC: Record<StatusNc, string> = {
  aberta: 'bg-destructive/10 text-destructive',
  em_correcao: 'bg-amber-100 text-amber-800',
  aguardando_reinspecao: 'bg-sky-100 text-sky-800',
  fechada: 'bg-success/15 text-success',
};

export function NcStatusBadge({ status }: { status: StatusNc }): React.JSX.Element {
  return (
    <Badge className={cn('whitespace-nowrap border-transparent', COR_NC[status])}>
      {STATUS_NC_LABEL[status]}
    </Badge>
  );
}
