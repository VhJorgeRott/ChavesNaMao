import { useMemo } from 'react';
import { Building, CircleCheck, KeyRound, LayoutDashboard, Package } from 'lucide-react';
import { fNum } from '@chaves/domain/format';
import { useData } from '@/data/DataProvider';
import { listarEntregas } from '@/data/selectors';
import {
  ENTREGA_STATUS,
  UNIDADE_STATUS_LIBERADO_PARA_ENTREGA,
  type EntregaStatus,
  type UnidadeStatus,
} from '@chaves/domain/types';
import { ENTREGA_STATUS_META } from '@chaves/domain/status';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BRAND,
  BRAND_TINT,
  DonutCard,
  EmpreendimentosChart,
  KpiCard,
  type EmpreendimentoUnidades,
  type FatiaDado,
} from '@/components/dashboard/charts';

/** Unidade já vendida (com ou sem entrega). O restante é estoque. */
const VENDIDAS: readonly UnidadeStatus[] = ['VENDIDA', 'QUITADA', 'LIBERADA', 'ENTREGUE'];

/** Etapas em laranja, do claro (início) ao escuro (concluída). */
const COR_ETAPA: Record<EntregaStatus, string> = {
  ABERTURA: '#fdeccd',
  DOCUMENTOS: '#fbd48a',
  CONFISSAO: '#f6b73c',
  ASSINATURA: '#f29f05',
  REGISTRO: '#d4870a',
  CONCLUIDA: '#b36f00',
};

const GRID_AUTO = 'grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4';

export function Dashboard(): React.JSX.Element {
  const { state, carregandoPersistidos } = useData();
  const entregas = listarEntregas(state);
  // Primeira carga sem nada em cache: sem isto o painel mostraria zeros.
  const carregando = carregandoPersistidos && state.unidades.length === 0;

  const abertas = entregas.length;
  const concluidas = entregas.filter((e) => e.entrega.status === 'CONCLUIDA').length;
  const emAndamento = abertas - concluidas;
  const total = state.unidades.length;
  const vendidas = state.unidades.filter((u) => VENDIDAS.includes(u.status)).length;
  const entregues = state.unidades.filter((u) => u.status === 'ENTREGUE').length;
  const liberadas = state.unidades.filter((u) =>
    UNIDADE_STATUS_LIBERADO_PARA_ENTREGA.includes(u.status),
  ).length;

  const entregasPorEtapa = useMemo<FatiaDado[]>(
    () =>
      ENTREGA_STATUS.map((s) => ({
        name: ENTREGA_STATUS_META[s].label,
        value: entregas.filter((e) => e.entrega.status === s).length,
        color: COR_ETAPA[s],
      })),
    [entregas],
  );

  const unidadesPorStatus: FatiaDado[] = [
    { name: 'Vendida a entregar', value: vendidas - entregues, color: BRAND_TINT },
    { name: 'Entregue', value: entregues, color: BRAND },
  ];

  const porEmpreendimento = useMemo<EmpreendimentoUnidades[]>(
    () =>
      state.empreendimentos.map((e) => {
        const us = state.unidades.filter((u) => u.empreendimentoId === e.id);
        const entregue = us.filter((u) => u.status === 'ENTREGUE').length;
        return {
          nome: e.nome,
          entregue,
          vendida: us.filter((u) => VENDIDAS.includes(u.status)).length - entregue,
        };
      }),
    [state.unidades, state.empreendimentos],
  );

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        titulo="Início"
        subtitulo="Visão geral das entregas de chaves"
      />
      <PageContent>
        {carregando ? (
          <DashboardSkeleton />
        ) : (
          <div className="flex flex-col gap-4">
            <div className={GRID_AUTO}>
              <div className="grid grid-cols-2 gap-4">
                <KpiCard
                  icon={Building}
                  label="Unidades liberadas"
                  value={liberadas}
                  base={vendidas}
                  caption={`prontas · de ${fNum(vendidas, 0)} vendidas`}
                />
                <KpiCard
                  icon={Package}
                  label="Entregas em andamento"
                  value={emAndamento}
                  base={abertas}
                  caption={`de ${fNum(abertas, 0)} entregas abertas`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <KpiCard
                  icon={CircleCheck}
                  label="Entregas concluídas"
                  value={concluidas}
                  base={abertas}
                  caption={`de ${fNum(abertas, 0)} entregas abertas`}
                />
                <KpiCard
                  icon={KeyRound}
                  label="Total de unidades"
                  value={total}
                  base={total}
                  pctValue={vendidas}
                  caption={`${fNum(vendidas, 0)} vendidas · ${fNum(total - vendidas, 0)} em estoque`}
                />
              </div>
            </div>

            <div className={GRID_AUTO}>
              <DonutCard
                titulo="Entregas por etapa"
                subtitulo="Da abertura à assinatura"
                unidade="entregas"
                data={entregasPorEtapa}
              />
              <DonutCard
                titulo="Unidades por status"
                subtitulo="Vendidas com e sem entrega"
                unidade="unidades"
                data={unidadesPorStatus}
              />
            </div>

            <EmpreendimentosChart data={porEmpreendimento} />
          </div>
        )}
      </PageContent>
    </>
  );
}

function DashboardSkeleton(): React.JSX.Element {
  const kpi = (i: number) => (
    <Card key={i} className="flex flex-col gap-2.5 rounded-xl px-5 py-[18px]">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[30px] w-20" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <Skeleton className="h-3 w-36" />
    </Card>
  );
  const donut = (i: number) => (
    <Card key={i} className="flex flex-col gap-[18px] rounded-xl p-5">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-52" />
      </div>
      <div className="flex flex-wrap items-center gap-7">
        <Skeleton className="h-[180px] w-[180px] shrink-0 rounded-full" />
        <div className="flex min-w-[200px] flex-1 flex-col gap-3">
          {[0, 1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </Card>
  );
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className={GRID_AUTO}>
        <div className="grid grid-cols-2 gap-4">{[0, 1].map(kpi)}</div>
        <div className="grid grid-cols-2 gap-4">{[2, 3].map(kpi)}</div>
      </div>
      <div className={GRID_AUTO}>{[0, 1].map(donut)}</div>
      <Card className="flex flex-col gap-4 rounded-xl p-5">
        <Skeleton className="h-4 w-48" />
        {[0, 1, 2, 3, 4].map((j) => (
          <Skeleton key={j} className="h-5 w-full" />
        ))}
      </Card>
    </div>
  );
}
