import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  ChevronsUpDown,
  Eye,
  DoorOpen,
  KeyRound,
  Loader2,
  Send,
  Tag,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/data/DataProvider';
import { listarUnidades, type UnidadeResumo } from '@/data/selectors';
import { useSession } from '@/auth/SessionProvider';
import { UNIDADE_STATUS, type Empreendimento, type UnidadeStatus } from '@chaves/domain/types';
import { UNIDADE_STATUS_META } from '@chaves/domain/status';
import { PageContent } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { InadimplenciaBadge, UnidadeStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { UnidadeDetalheDialog } from '@/components/unidades/UnidadeDetalheDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fArea } from '@chaves/domain/format';
import { cn } from '@/lib/utils';

const TODOS = '__todos__';
const INADIMPLENTE = 'inadimplente';
const EM_DIA = 'emdia';

/**
 * Sem venda não há cliente nem contrato: essas unidades aparecem no catálogo,
 * mas não entram no fluxo de entrega (nem no envio de termo em massa).
 */
const SEM_ENTREGA: readonly UnidadeStatus[] = ['DISPONIVEL', 'EM_OBRAS'];

/** Colunas ordenáveis da tabela de unidades. */
type CampoOrdem = 'contrato' | 'cliente' | 'unidade' | 'area' | 'status' | 'inadimplente';
type Ordenacao = { campo: CampoOrdem | null; dir: 'asc' | 'desc' };

/**
 * Comparador genérico para a ordenação da tabela. Strings usam `localeCompare`
 * pt-BR com `numeric` (para "MÓDULO 1 · 5" ordenar naturalmente); números por
 * subtração; nullish/undefined sempre por último, independente da direção.
 */
function compararValores(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
  dir: 'asc' | 'desc',
): number {
  const aVazio = a === null || a === undefined || a === '';
  const bVazio = b === null || b === undefined || b === '';
  if (aVazio && bVazio) return 0;
  if (aVazio) return 1;
  if (bVazio) return -1;

  let cmp: number;
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else if (typeof a === 'boolean' && typeof b === 'boolean') {
    cmp = Number(a) - Number(b);
  } else {
    cmp = String(a).localeCompare(String(b), 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    });
  }
  return dir === 'asc' ? cmp : -cmp;
}

export function EmpreendimentoUnidades(): React.JSX.Element {
  const { empreendimentoId = '' } = useParams();
  const { state, actions } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();

  // O empreendimento sai do cache quando já conhecido: nesse caso a tela pinta
  // na hora e a revalidação corre por baixo, sem spinner.
  const doCache = state.empreendimentos.find((e) => e.id === empreendimentoId);
  const [empreendimento, setEmpreendimento] = useState<Empreendimento | undefined>(doCache);
  const [carregandoEmp, setCarregandoEmp] = useState(doCache === undefined);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>(TODOS);
  const [inadimplenciaFiltro, setInadimplenciaFiltro] = useState<string>(TODOS);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ campo: 'cliente', dir: 'asc' });
  const [iniciando, setIniciando] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<UnidadeResumo | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [enviandoMassa, setEnviandoMassa] = useState(false);
  // Falha parcial das integrações (CV ou Mega) — fica visível na tela.
  const [avisoIntegracao, setAvisoIntegracao] = useState<string | null>(null);
  // Só há espera de verdade na primeira vez: com unidades em cache a tabela já
  // aparece, e `garantirUnidades` decide sozinho se precisa revalidar.
  const temUnidadesEmCache = state.unidades.some((u) => u.empreendimentoId === empreendimentoId);
  const [carregandoInfo, setCarregandoInfo] = useState(!temUnidadesEmCache);

  // Resolve o empreendimento. `garantirEmpreendimentos` serve do cache quando
  // recente, então revisitar a tela não paga uma ida ao CRM.
  const { garantirEmpreendimentos, garantirUnidades } = actions;
  useEffect(() => {
    let ativo = true;
    void garantirEmpreendimentos()
      .then((lista) => {
        if (!ativo) return;
        const found = lista.find((e) => e.id === empreendimentoId);
        setEmpreendimento(found);
        setCarregandoEmp(false);
        if (!found) navigate('/unidades', { replace: true });
      })
      .catch(() => {
        if (ativo) {
          setCarregandoEmp(false);
          navigate('/unidades', { replace: true });
        }
      });
    return () => {
      ativo = false;
    };
  }, [empreendimentoId, navigate, garantirEmpreendimentos]);

  // Catálogo de unidades. A busca em si (Mega + área do CV) vive no
  // DataProvider, compartilhada com o prefetch pós-login — aqui só reagimos.
  useEffect(() => {
    let ativo = true;
    if (!empreendimento) return;
    garantirUnidades(empreendimento)
      .then(({ aviso }) => {
        if (!ativo) return;
        setCarregandoInfo(false);
        setAvisoIntegracao(aviso ?? null);
      })
      .catch((e: unknown) => {
        if (!ativo) return;
        setCarregandoInfo(false);
        toast.error(e instanceof Error ? e.message : 'Falha ao carregar as unidades');
      });
    return () => {
      ativo = false;
    };
  }, [empreendimento, garantirUnidades]);

  // Os extras do Mega (cliente, contrato, inadimplência) agora viajam na própria
  // unidade, então sobrevivem ao cache em vez de morrer com o estado da tela.
  const infoIntegracao = useMemo(() => {
    const mapa: Record<string, { cliente?: string; contrato?: string; inadimplente?: boolean }> =
      {};
    for (const u of state.unidades) {
      if (u.empreendimentoId !== empreendimentoId) continue;
      const info: { cliente?: string; contrato?: string; inadimplente?: boolean } = {};
      if (u.clienteNome) info.cliente = u.clienteNome;
      if (u.contratoNumero) info.contrato = u.contratoNumero;
      if (u.inadimplente !== undefined) info.inadimplente = u.inadimplente;
      mapa[u.id] = info;
    }
    return mapa;
  }, [state.unidades, empreendimentoId]);

  // Todas as unidades cadastradas no empreendimento, vendidas ou não.
  const unidades = useMemo(
    () => listarUnidades(state).filter((r) => r.unidade.empreendimentoId === empreendimentoId),
    [state, empreendimentoId],
  );

  // Opções do filtro de status: só as que existem neste empreendimento.
  const statusPresentes = useMemo(
    () => UNIDADE_STATUS.filter((s) => unidades.some((r) => r.unidade.status === s)),
    [unidades],
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return unidades.filter(({ unidade }) => {
      if (statusFiltro !== TODOS && unidade.status !== statusFiltro) return false;
      const info = infoIntegracao[unidade.id];
      if (inadimplenciaFiltro === INADIMPLENTE && info?.inadimplente !== true) return false;
      if (inadimplenciaFiltro === EM_DIA && info?.inadimplente !== false) return false;
      if (!q) return true;
      return (
        unidade.identificacao.toLowerCase().includes(q) ||
        (info?.cliente?.toLowerCase().includes(q) ?? false) ||
        (info?.contrato?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [unidades, busca, statusFiltro, inadimplenciaFiltro, infoIntegracao]);

  // Ordenação aplicada depois do filtro, sem recomputar `filtradas`.
  const ordenadas = useMemo(() => {
    if (!ordenacao.campo) return filtradas;
    const campo = ordenacao.campo;
    const valor = ({ unidade }: UnidadeResumo): string | number | boolean | null | undefined => {
      const info = infoIntegracao[unidade.id];
      switch (campo) {
        case 'contrato':
          return info?.contrato;
        case 'cliente':
          return info?.cliente;
        case 'unidade':
          return unidade.identificacao;
        case 'area':
          return unidade.areaM2;
        case 'status':
          return UNIDADE_STATUS_META[unidade.status].label;
        case 'inadimplente':
          return info?.inadimplente;
      }
    };
    return [...filtradas].sort((a, b) => compararValores(valor(a), valor(b), ordenacao.dir));
  }, [filtradas, ordenacao, infoIntegracao]);

  function alternarOrdem(campo: CampoOrdem) {
    setOrdenacao((atual) =>
      atual.campo === campo
        ? { campo, dir: atual.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: 'asc' },
    );
  }

  // Indicadores do empreendimento (totais, independentes dos filtros da tabela).
  const metricas = useMemo(
    () => ({
      total: unidades.length,
      vendidas: unidades.filter((r) => r.unidade.status === 'VENDIDA').length,
      disponiveis: unidades.filter((r) => r.unidade.status === 'DISPONIVEL').length,
      inadimplentes: unidades.filter((r) => infoIntegracao[r.unidade.id]?.inadimplente === true)
        .length,
      entregasIniciadas: unidades.filter((r) => r.entregaAtiva).length,
    }),
    [unidades, infoIntegracao],
  );

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

  // Seleção limitada às linhas visíveis (após busca/filtro/ordenação) que podem
  // entrar no fluxo de entrega.
  const selecionaveis = useMemo(
    () => ordenadas.filter((r) => !SEM_ENTREGA.includes(r.unidade.status)),
    [ordenadas],
  );
  const selecionadasVisiveis = useMemo(
    () => selecionaveis.filter((r) => selecionadas.has(r.unidade.id)),
    [selecionaveis, selecionadas],
  );
  const todasSelecionadas =
    selecionaveis.length > 0 && selecionadasVisiveis.length === selecionaveis.length;
  const algumaSelecionada = selecionadasVisiveis.length > 0 && !todasSelecionadas;

  function alternarUma(id: string) {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  function alternarTodas() {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (selecionaveis.every((r) => nova.has(r.unidade.id)) && selecionaveis.length > 0) {
        selecionaveis.forEach((r) => nova.delete(r.unidade.id));
      } else {
        selecionaveis.forEach((r) => nova.add(r.unidade.id));
      }
      return nova;
    });
  }

  async function enviarTermosEmMassa() {
    const ids = selecionadasVisiveis.map((r) => r.unidade.id);
    if (ids.length === 0) return;
    setEnviandoMassa(true);
    try {
      const resultados = await Promise.allSettled(
        ids.map((id) => actions.enviarTermoEntrega(id, currentUser.id)),
      );
      const ok = resultados.filter((r) => r.status === 'fulfilled').length;
      const falhas = resultados.length - ok;
      if (ok > 0) {
        toast.success(`${ok} termo(s) enviado(s) ao cliente para assinatura`);
      }
      if (falhas > 0) {
        toast.error(`${falhas} unidade(s) não puderam receber o termo`);
      }
      setSelecionadas(new Set());
    } finally {
      setEnviandoMassa(false);
    }
  }

  if (carregandoEmp) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
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
                {empreendimento.cidade}/{empreendimento.uf} ·{' '}
                {carregandoInfo && unidades.length === 0
                  ? 'Carregando...'
                  : `${unidades.length} unidade(s)`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <PageContent>
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard
            icon={Building2}
            label="Unidades"
            value={metricas.total}
            tooltip="Total de unidades cadastradas no empreendimento, vendidas ou não."
          />
          <KpiCard
            icon={Tag}
            label="Vendidas"
            value={metricas.vendidas}
            tooltip="Unidades com status Vendida."
          />
          <KpiCard
            icon={DoorOpen}
            label="Disponíveis"
            value={metricas.disponiveis}
            tooltip="Unidades ainda sem venda no CV."
          />
          <KpiCard
            icon={TriangleAlert}
            label="Inadimplentes"
            value={metricas.inadimplentes}
            carregando={carregandoInfo}
            tooltip="Unidades cujo contrato está inadimplente no Mega."
          />
          <KpiCard
            icon={KeyRound}
            label="Entregas iniciadas"
            value={metricas.entregasIniciadas}
            tooltip="Unidades com uma entrega já em andamento."
          />
        </div>

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
              {statusPresentes.map((s) => (
                <SelectItem key={s} value={s}>
                  {UNIDADE_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={inadimplenciaFiltro} onValueChange={setInadimplenciaFiltro}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="Inadimplência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as situações</SelectItem>
              <SelectItem value={INADIMPLENTE}>Inadimplente</SelectItem>
              <SelectItem value={EM_DIA}>Em dia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {avisoIntegracao && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {avisoIntegracao}
          </div>
        )}

        {selecionadasVisiveis.length > 0 && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-foreground">
              {selecionadasVisiveis.length} unidade(s) selecionada(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelecionadas(new Set())}
                disabled={enviandoMassa}
              >
                Limpar seleção
              </Button>
              <Button size="sm" onClick={enviarTermosEmMassa} disabled={enviandoMassa}>
                {enviandoMassa ? <Loader2 className="animate-spin" /> : <Send />}
                {enviandoMassa ? 'Enviando...' : 'Enviar termo em massa'}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      aria-label="Selecionar todas as unidades"
                      checked={todasSelecionadas}
                      ref={(el) => {
                        if (el) el.indeterminate = algumaSelecionada;
                      }}
                      onChange={alternarTodas}
                    />
                  </th>
                  <ThOrdenavel campo="contrato" label="Contrato" ordenacao={ordenacao} onSort={alternarOrdem} />
                  <ThOrdenavel campo="cliente" label="Cliente" ordenacao={ordenacao} onSort={alternarOrdem} />
                  <ThOrdenavel campo="unidade" label="Unidade" ordenacao={ordenacao} onSort={alternarOrdem} />
                  <ThOrdenavel campo="area" label="Área" ordenacao={ordenacao} onSort={alternarOrdem} className="max-md:hidden" />
                  <ThOrdenavel campo="status" label="Status" ordenacao={ordenacao} onSort={alternarOrdem} />
                  <ThOrdenavel campo="inadimplente" label="Inadimplência" ordenacao={ordenacao} onSort={alternarOrdem} />
                  <th className="px-4 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((resumo) => {
                  const { unidade } = resumo;
                  const selecionada = selecionadas.has(unidade.id);
                  const semEntrega = SEM_ENTREGA.includes(unidade.status);
                  return (
                    <tr
                      key={unidade.id}
                      className={cn(
                        'border-b border-border/60 last:border-0 hover:bg-muted/30',
                        selecionada && 'bg-primary/5',
                      )}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          aria-label={`Selecionar ${unidade.identificacao}`}
                          checked={selecionada && !semEntrega}
                          disabled={semEntrega}
                          onChange={() => alternarUma(unidade.id)}
                        />
                      </td>
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
                      <td className="px-4 py-3 text-foreground">
                        <button
                          type="button"
                          onClick={() => setDetalhe(resumo)}
                          className="font-medium text-primary hover:underline"
                        >
                          {unidade.identificacao}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-md:hidden">
                        {fArea(unidade.areaM2)}
                      </td>
                      <td className="px-4 py-3">
                        <UnidadeStatusBadge status={unidade.status} />
                      </td>
                      <td className="px-4 py-3">
                        {carregandoInfo ? (
                          <Skeleton className="h-4 w-24" />
                        ) : infoIntegracao[unidade.id]?.inadimplente !== undefined ? (
                          <InadimplenciaBadge
                            inadimplente={infoIntegracao[unidade.id]?.inadimplente ?? false}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => setDetalhe(resumo)}>
                          <Eye />
                          Ver unidade
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtradas.length === 0 &&
            (carregandoInfo ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Buscando unidades...
              </div>
            ) : (
              <EmptyState
                icon={Building2}
                titulo="Nenhuma unidade encontrada"
                descricao={
                  unidades.length > 0
                    ? 'Ajuste a busca ou o filtro de status.'
                    : 'O empreendimento não tem unidades no CV nem contratos no Mega.'
                }
              />
            ))}
        </div>
      </PageContent>

      <UnidadeDetalheDialog
        resumo={detalhe}
        info={detalhe ? infoIntegracao[detalhe.unidade.id] : undefined}
        onOpenChange={(open) => {
          if (!open) setDetalhe(null);
        }}
        iniciando={detalhe ? iniciando === detalhe.unidade.id : false}
        onIniciar={() => {
          if (detalhe) void iniciar(detalhe);
        }}
        onVerEntrega={() => {
          if (detalhe?.entregaAtiva) navigate(`/entregas/${detalhe.entregaAtiva.id}`);
        }}
      />
    </>
  );
}

/** Card de indicador (KPI) com tooltip explicativo no hover — padrão do design system. */
function KpiCard({
  icon: Icon,
  label,
  value,
  tooltip,
  carregando = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tooltip: string;
  carregando?: boolean;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="cursor-default rounded-xl text-left">
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-semibold">{label}</h3>
            </div>
            {carregando ? (
              <Skeleton className="h-9 w-12" />
            ) : (
              <span className="text-3xl font-bold tabular-nums text-foreground">{value}</span>
            )}
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Cabeçalho de coluna clicável que ordena a tabela pelo `campo` indicado. */
function ThOrdenavel({
  campo,
  label,
  ordenacao,
  onSort,
  className,
}: {
  campo: CampoOrdem;
  label: string;
  ordenacao: Ordenacao;
  onSort: (campo: CampoOrdem) => void;
  className?: string;
}): React.JSX.Element {
  const ativo = ordenacao.campo === campo;
  return (
    <th className={cn('px-4 py-3 text-left font-medium', className)}>
      <button
        type="button"
        onClick={() => onSort(campo)}
        className={cn(
          'group inline-flex items-center gap-1 font-medium hover:text-foreground',
          ativo && 'text-foreground',
        )}
      >
        {label}
        {ativo ? (
          ordenacao.dir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
        )}
      </button>
    </th>
  );
}
