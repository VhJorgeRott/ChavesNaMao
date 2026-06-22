import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, KeyRound, LayoutDashboard, PackageCheck } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { listarEntregas } from '@/data/selectors';
import { UNIDADE_STATUS_LIBERADO_PARA_ENTREGA } from '@/domain/types';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { EntregaStatusBadge } from '@/components/shared/StatusBadge';
import { fData } from '@/lib/format';
import type { LucideIcon } from 'lucide-react';

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
}): React.JSX.Element {
  return (
    <Card className="rounded-xl">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-foreground">{value}</span>
          {hint && <span className="pb-1 text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard(): React.JSX.Element {
  const { state } = useData();
  const entregas = listarEntregas(state);

  const emAndamento = entregas.filter((e) => e.entrega.status !== 'CONCLUIDA');
  const concluidas = entregas.filter((e) => e.entrega.status === 'CONCLUIDA');
  const liberadas = state.unidades.filter((u) =>
    UNIDADE_STATUS_LIBERADO_PARA_ENTREGA.includes(u.status),
  );

  const recentes = [...entregas]
    .sort((a, b) => b.entrega.createdAt.localeCompare(a.entrega.createdAt))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        titulo="Início"
        subtitulo="Visão geral das entregas de chaves"
      />
      <PageContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Building2} label="Unidades liberadas" value={liberadas.length} hint="prontas" />
          <Kpi icon={PackageCheck} label="Entregas em andamento" value={emAndamento.length} />
          <Kpi icon={CheckCircle2} label="Entregas concluídas" value={concluidas.length} />
          <Kpi icon={KeyRound} label="Total de unidades" value={state.unidades.length} />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Entregas recentes
          </h2>
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {recentes.map(({ entrega, unidade, empreendimento, cliente }) => (
                <Link
                  key={entrega.id}
                  to={`/entregas/${entrega.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {unidade?.identificacao ?? 'Unidade'} ·{' '}
                      <span className="text-muted-foreground">{empreendimento?.nome}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {cliente?.nome} · iniciada em {fData(entrega.iniciadaEm)}
                    </p>
                  </div>
                  <EntregaStatusBadge status={entrega.status} />
                </Link>
              ))}
            </div>
          </Card>
        </section>
      </PageContent>
    </>
  );
}
