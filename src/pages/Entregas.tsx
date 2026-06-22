import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { listarEntregas } from '@/data/selectors';
import { ENTREGA_STATUS } from '@/domain/types';
import { ENTREGA_STATUS_META } from '@/domain/status';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { EntregaStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fData } from '@/lib/format';

const TODOS = '__todos__';

export function Entregas(): React.JSX.Element {
  const { state } = useData();
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>(TODOS);
  const [empFiltro, setEmpFiltro] = useState<string>(TODOS);

  const entregas = listarEntregas(state);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return entregas
      .filter(({ entrega, cliente, unidade }) => {
        if (statusFiltro !== TODOS && entrega.status !== statusFiltro) return false;
        if (empFiltro !== TODOS && unidade?.empreendimentoId !== empFiltro) return false;
        if (!q) return true;
        return (
          (cliente?.nome.toLowerCase().includes(q) ?? false) ||
          (unidade?.identificacao.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.entrega.createdAt.localeCompare(a.entrega.createdAt));
  }, [entregas, busca, statusFiltro, empFiltro]);

  return (
    <>
      <PageHeader
        icon={PackageCheck}
        titulo="Entregas"
        subtitulo="Acompanhe cada entrega pela máquina de estados"
      />
      <PageContent>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="md:max-w-sm md:flex-1">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por cliente ou unidade..." />
          </div>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os status</SelectItem>
              {ENTREGA_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {ENTREGA_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={empFiltro} onValueChange={setEmpFiltro}>
            <SelectTrigger className="md:w-64">
              <SelectValue placeholder="Empreendimento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os empreendimentos</SelectItem>
              {state.empreendimentos.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Unidade</th>
                  <th className="px-4 py-3 text-left font-medium max-md:hidden">Responsável</th>
                  <th className="px-4 py-3 text-left font-medium max-md:hidden">Iniciada</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(({ entrega, unidade, empreendimento, cliente, responsavel }) => (
                  <tr
                    key={entrega.id}
                    onClick={() => navigate(`/entregas/${entrega.id}`)}
                    className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{cliente?.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {unidade?.identificacao}
                      <span className="block text-xs">{empreendimento?.nome}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-md:hidden">
                      {responsavel?.nome ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-md:hidden">
                      {fData(entrega.iniciadaEm)}
                    </td>
                    <td className="px-4 py-3">
                      <EntregaStatusBadge status={entrega.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtradas.length === 0 && (
            <EmptyState
              icon={PackageCheck}
              titulo="Nenhuma entrega encontrada"
              descricao="Inicie uma entrega a partir de uma unidade liberada."
            />
          )}
        </div>
      </PageContent>
    </>
  );
}
