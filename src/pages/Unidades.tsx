import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/data/DataProvider';
import { listarUnidades, type UnidadeResumo } from '@/data/selectors';
import { useSession } from '@/auth/SessionProvider';
import { UNIDADE_STATUS, UNIDADE_STATUS_LIBERADO_PARA_ENTREGA } from '@/domain/types';
import { UNIDADE_STATUS_META } from '@/domain/status';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { UnidadeStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fArea } from '@/lib/format';

const TODOS = '__todos__';

export function Unidades(): React.JSX.Element {
  const { state, actions } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [empFiltro, setEmpFiltro] = useState<string>(TODOS);
  const [statusFiltro, setStatusFiltro] = useState<string>(TODOS);
  const [iniciando, setIniciando] = useState<string | null>(null);

  const unidades = listarUnidades(state);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return unidades.filter(({ unidade, empreendimento }) => {
      if (empFiltro !== TODOS && unidade.empreendimentoId !== empFiltro) return false;
      if (statusFiltro !== TODOS && unidade.status !== statusFiltro) return false;
      if (!q) return true;
      return (
        unidade.identificacao.toLowerCase().includes(q) ||
        (empreendimento?.nome.toLowerCase().includes(q) ?? false)
      );
    });
  }, [unidades, busca, empFiltro, statusFiltro]);

  async function iniciar(resumo: UnidadeResumo) {
    setIniciando(resumo.unidade.id);
    try {
      const entregaId = await actions.iniciarEntrega(resumo.unidade.id, currentUser.id);
      toast.success('Entrega iniciada', { description: resumo.unidade.identificacao });
      navigate(`/entregas/${entregaId}`);
    } catch (e) {
      toast.error('Não foi possível iniciar a entrega', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setIniciando(null);
    }
  }

  return (
    <>
      <PageHeader
        icon={Building2}
        titulo="Unidades"
        subtitulo="Selecione uma unidade liberada para iniciar a entrega"
      />
      <PageContent>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="md:max-w-sm md:flex-1">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por unidade ou empreendimento..." />
          </div>
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
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os status</SelectItem>
              {UNIDADE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {UNIDADE_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Unidade</th>
                  <th className="px-4 py-3 text-left font-medium">Empreendimento</th>
                  <th className="px-4 py-3 text-left font-medium max-md:hidden">Área</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((resumo) => {
                  const { unidade, empreendimento, entregaAtiva } = resumo;
                  const liberada = UNIDADE_STATUS_LIBERADO_PARA_ENTREGA.includes(unidade.status);
                  return (
                    <tr
                      key={unidade.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{unidade.identificacao}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {empreendimento?.nome}
                        <span className="ml-1 text-xs">
                          · {empreendimento?.cidade}/{empreendimento?.uf}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-md:hidden">
                        {fArea(unidade.areaM2)}
                      </td>
                      <td className="px-4 py-3">
                        <UnidadeStatusBadge status={unidade.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {entregaAtiva ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/entregas/${entregaAtiva.id}`)}
                          >
                            Ver entrega
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!liberada || iniciando === unidade.id}
                            onClick={() => iniciar(resumo)}
                          >
                            <KeyRound />
                            {iniciando === unidade.id ? 'Iniciando...' : 'Iniciar entrega'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtradas.length === 0 && (
            <EmptyState
              icon={Building2}
              titulo="Nenhuma unidade encontrada"
              descricao="Ajuste a busca ou os filtros para ver outras unidades."
            />
          )}
        </div>
      </PageContent>
    </>
  );
}
