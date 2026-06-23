import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { adapters } from '@/adapters';
import { useData } from '@/data/DataProvider';
import { listarUnidades, type UnidadeResumo } from '@/data/selectors';
import { useSession } from '@/auth/SessionProvider';
import {
  UNIDADE_STATUS_LIBERADO_PARA_ENTREGA,
  UNIDADE_STATUS_VISIVEIS,
} from '@/domain/types';
import { UNIDADE_STATUS_META } from '@/domain/status';
import { PageContent } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { UnidadeStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fArea } from '@/lib/format';

const TODOS = '__todos__';

export function EmpreendimentoUnidades(): React.JSX.Element {
  const { empreendimentoId = '' } = useParams();
  const { state, actions } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();

  const empreendimento = state.empreendimentos.find((e) => e.id === empreendimentoId);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>(TODOS);
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [infoIntegracao, setInfoIntegracao] = useState<
    Record<string, { cliente?: string; contrato?: string }>
  >({});
  const [carregandoInfo, setCarregandoInfo] = useState(true);

  // Redireciona se o empreendimento não existe.
  useEffect(() => {
    if (!empreendimento) navigate('/unidades', { replace: true });
  }, [empreendimento, navigate]);

  // Unidades do empreendimento, apenas com status visíveis.
  const unidades = useMemo(
    () =>
      listarUnidades(state).filter(
        (r) =>
          r.unidade.empreendimentoId === empreendimentoId &&
          UNIDADE_STATUS_VISIVEIS.includes(r.unidade.status),
      ),
    [state, empreendimentoId],
  );

  useEffect(() => {
    let ativo = true;
    setCarregandoInfo(true);
    void (async () => {
      const entradas = await Promise.all(
        unidades.map(async ({ unidade }) => {
          const info: { cliente?: string; contrato?: string } = {};
          try {
            info.cliente = (await adapters.crm.getClienteByUnidade(unidade.id)).nome;
          } catch {
            /* sem cliente no CRM */
          }
          try {
            info.contrato = (await adapters.erp.getSituacaoFinanceira(unidade.id)).numeroContrato;
          } catch {
            /* sem contrato no ERP */
          }
          return [unidade.id, info] as const;
        }),
      );
      if (!ativo) return;
      setInfoIntegracao(Object.fromEntries(entradas));
      setCarregandoInfo(false);
    })();
    return () => {
      ativo = false;
    };
  }, [unidades]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return unidades.filter(({ unidade }) => {
      if (statusFiltro !== TODOS && unidade.status !== statusFiltro) return false;
      if (!q) return true;
      const info = infoIntegracao[unidade.id];
      return (
        unidade.identificacao.toLowerCase().includes(q) ||
        (info?.cliente?.toLowerCase().includes(q) ?? false) ||
        (info?.contrato?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [unidades, busca, statusFiltro, infoIntegracao]);

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

  if (!empreendimento) return <></>;

  return (
    <>
      <header className="border-b border-border bg-card px-4 py-4 safe-px md:px-8">
        <div className="mx-auto max-w-[1400px]">
          <Link
            to="/unidades"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Empreendimentos
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {empreendimento.nome}
              </h1>
              <p className="text-sm text-muted-foreground">
                {empreendimento.cidade}/{empreendimento.uf} · {unidades.length} unidade(s)
              </p>
            </div>
          </div>
        </div>
      </header>

      <PageContent>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="md:max-w-sm md:flex-1">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por unidade, cliente, contrato..." />
          </div>
          <Select value={statusFiltro} onValueChange={setStatusFiltro}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os status</SelectItem>
              {UNIDADE_STATUS_VISIVEIS.map((s) => (
                <SelectItem key={s} value={s}>
                  {UNIDADE_STATUS_META[s].label}
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
                  <th className="px-4 py-3 text-left font-medium">Contrato</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Unidade</th>
                  <th className="px-4 py-3 text-left font-medium max-md:hidden">Área</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((resumo) => {
                  const { unidade, entregaAtiva } = resumo;
                  const liberada = UNIDADE_STATUS_LIBERADO_PARA_ENTREGA.includes(unidade.status);
                  return (
                    <tr
                      key={unidade.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {carregandoInfo ? (
                          <Skeleton className="h-4 w-20" />
                        ) : (
                          (infoIntegracao[unidade.id]?.contrato ?? (
                            <span className="text-muted-foreground">—</span>
                          ))
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {carregandoInfo ? (
                          <Skeleton className="h-4 w-28" />
                        ) : (
                          (infoIntegracao[unidade.id]?.cliente ?? (
                            <span className="text-muted-foreground">—</span>
                          ))
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">{unidade.identificacao}</td>
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
              descricao="Ajuste a busca ou o filtro de status."
            />
          )}
        </div>
      </PageContent>
    </>
  );
}
