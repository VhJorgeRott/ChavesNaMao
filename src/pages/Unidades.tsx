import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { UNIDADE_STATUS_VISIVEIS, type UnidadeStatus } from '@/domain/types';
import { UNIDADE_STATUS_META } from '@/domain/status';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function StatPill({ status, value }: { status: UnidadeStatus; value: number }): React.JSX.Element {
  const meta = UNIDADE_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
    >
      <span className="tabular-nums">{value}</span> {meta.label.toLowerCase()}
    </span>
  );
}

export function Unidades(): React.JSX.Element {
  const { state } = useData();
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  const empreendimentos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return state.empreendimentos
      .map((emp) => {
        const unidades = state.unidades.filter(
          (u) => u.empreendimentoId === emp.id && UNIDADE_STATUS_VISIVEIS.includes(u.status),
        );
        return {
          emp,
          total: unidades.length,
          emObras: unidades.filter((u) => u.status === 'EM_OBRAS').length,
          liberadas: unidades.filter((u) => u.status === 'LIBERADA').length,
          entregues: unidades.filter((u) => u.status === 'ENTREGUE').length,
        };
      })
      .filter(({ emp }) => !q || `${emp.nome} ${emp.cidade} ${emp.uf}`.toLowerCase().includes(q));
  }, [state.empreendimentos, state.unidades, busca]);

  return (
    <>
      <PageHeader
        icon={Building2}
        titulo="Unidades"
        subtitulo="Selecione um empreendimento para abrir a disponibilidade"
      />
      <PageContent>
        <div className="mb-5 md:max-w-sm">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar empreendimento..." />
        </div>

        {empreendimentos.length === 0 ? (
          <EmptyState
            icon={Building2}
            titulo="Nenhum empreendimento encontrado"
            descricao="Ajuste a busca para ver outros empreendimentos."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {empreendimentos.map(({ emp, total, emObras, liberadas, entregues }) => (
              <Card key={emp.id} className="flex flex-col overflow-hidden">
                <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-primary/80 to-primary">
                  <Building2 className="h-14 w-14 text-primary-foreground/30" />
                  <div className="absolute bottom-2 right-2 rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {liberadas} liberada(s)
                  </div>
                </div>
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="font-semibold leading-tight text-foreground">{emp.nome}</h3>
                    <p className="text-xs text-muted-foreground">
                      {emp.cidade}/{emp.uf} · {total} unidade(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <StatPill status="EM_OBRAS" value={emObras} />
                    <StatPill status="LIBERADA" value={liberadas} />
                    <StatPill status="ENTREGUE" value={entregues} />
                  </div>
                  <Button
                    className="mt-auto w-full"
                    onClick={() => navigate(`/unidades/${emp.id}`)}
                  >
                    Abrir disponibilidade
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}
