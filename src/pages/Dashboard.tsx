import { useMemo } from 'react';
import { Building2, CheckCircle2, KeyRound, LayoutDashboard, PackageCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { listarEntregas } from '@/data/selectors';
import {
  ENTREGA_STATUS,
  UNIDADE_STATUS_LIBERADO_PARA_ENTREGA,
  UNIDADE_STATUS_VISIVEIS,
} from '@/domain/types';
import { ENTREGA_STATUS_META, UNIDADE_STATUS_META } from '@/domain/status';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChartCard,
  Donut,
  HorizontalStackedBar,
  type BarSerie,
  type FatiaDado,
} from '@/components/dashboard/charts';

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

  const emAndamento = entregas.filter((e) => e.entrega.status !== 'CONCLUIDA').length;
  const concluidas = entregas.filter((e) => e.entrega.status === 'CONCLUIDA').length;
  const liberadas = state.unidades.filter((u) =>
    UNIDADE_STATUS_LIBERADO_PARA_ENTREGA.includes(u.status),
  ).length;

  // Entregas por etapa (donut).
  const entregasPorEtapa = useMemo<FatiaDado[]>(
    () =>
      ENTREGA_STATUS.map((s) => ({
        name: ENTREGA_STATUS_META[s].label,
        value: entregas.filter((e) => e.entrega.status === s).length,
        color: ENTREGA_STATUS_META[s].color,
      })).filter((d) => d.value > 0),
    [entregas],
  );

  // Unidades por status (donut) — só o pipeline (em obra, liberada, entregue).
  const unidadesPorStatus = useMemo<FatiaDado[]>(
    () =>
      UNIDADE_STATUS_VISIVEIS.map((s) => ({
        name: UNIDADE_STATUS_META[s].label,
        value: state.unidades.filter((u) => u.status === s).length,
        color: UNIDADE_STATUS_META[s].color,
      })).filter((d) => d.value > 0),
    [state.unidades],
  );
  const totalPipeline = unidadesPorStatus.reduce((acc, d) => acc + d.value, 0);

  // Unidades por empreendimento, empilhadas por status (barra horizontal).
  const { rows, series } = useMemo(() => {
    const statusPresentes = UNIDADE_STATUS_VISIVEIS.filter((s) =>
      state.unidades.some((u) => u.status === s),
    );
    const serie: BarSerie[] = statusPresentes.map((s) => ({
      key: UNIDADE_STATUS_META[s].label,
      color: UNIDADE_STATUS_META[s].color,
    }));
    const linhas = state.empreendimentos.map((e) => {
      const row: Record<string, string | number> = { empreendimento: e.nome };
      for (const s of statusPresentes) {
        row[UNIDADE_STATUS_META[s].label] = state.unidades.filter(
          (u) => u.empreendimentoId === e.id && u.status === s,
        ).length;
      }
      return row;
    });
    return { rows: linhas, series: serie };
  }, [state.unidades, state.empreendimentos]);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        titulo="Início"
        subtitulo="Visão geral das entregas de chaves"
      />
      <PageContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Building2} label="Unidades liberadas" value={liberadas} hint="prontas" />
          <Kpi icon={PackageCheck} label="Entregas em andamento" value={emAndamento} />
          <Kpi icon={CheckCircle2} label="Entregas concluídas" value={concluidas} />
          <Kpi icon={KeyRound} label="Total de unidades" value={state.unidades.length} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard titulo="Entregas por etapa">
            <Donut data={entregasPorEtapa} total={entregas.length} legenda="entregas" />
          </ChartCard>
          <ChartCard titulo="Unidades por status">
            <Donut data={unidadesPorStatus} total={totalPipeline} legenda="unidades" />
          </ChartCard>
        </div>

        <div className="mt-6">
          <ChartCard titulo="Unidades por empreendimento">
            <HorizontalStackedBar
              rows={rows}
              series={series}
              categoryKey="empreendimento"
              height={Math.max(180, rows.length * 70)}
            />
          </ChartCard>
        </div>
      </PageContent>
    </>
  );
}
