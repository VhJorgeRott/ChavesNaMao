import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Loader2,
  Search,
  Send,
  TriangleAlert,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/data/DataProvider';
import { listarUnidades, type UnidadeResumo } from '@/data/selectors';
import { useSession } from '@/auth/SessionProvider';
import { UNIDADE_STATUS, type Empreendimento, type UnidadeStatus } from '@chaves/domain/types';
import { UNIDADE_STATUS_META } from '@chaves/domain/status';
import { PageContent } from '@/components/shared/PageHeader';
import { CabecalhoSkeleton, LinhasSkeleton } from '@/components/shared/skeletons';
import { SearchInput } from '@/components/shared/SearchInput';
import { InadimplenciaBadge, UnidadeStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { UnidadeDetalheDialog } from '@/components/unidades/UnidadeDetalheDialog';
import { FiltroDropdown } from '@/components/shared/FiltroDropdown';
import { CabecalhoOrdenavel, RESUMO_SELECIONADO, type Ordem } from '@/components/shared/lista';
import { n0, pct1 } from '@/lib/numeros';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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

/** Célula ativa do resumo: um status, as inadimplentes ou as com entrega iniciada. */
type Kpi = 'todas' | UnidadeStatus | 'inadimplente' | 'entrega';

const GRID_TABELA =
  'grid grid-cols-[20px_110px_minmax(0,1.4fr)_minmax(0,1fr)_80px_120px_130px_20px] items-center gap-4 px-4';

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
  const [kpi, setKpi] = useState<Kpi>('todas');
  /** Status sob o mouse na barra: destaca a célula correspondente da legenda. */
  const [destaque, setDestaque] = useState<UnidadeStatus | null>(null);
  const [inadimplenciaFiltro, setInadimplenciaFiltro] = useState<string>(TODOS);
  const [ordenacao, setOrdenacao] = useState<Ordem<CampoOrdem>>({ campo: 'cliente', dir: 'asc' });
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
    return unidades.filter(({ unidade, entregaAtiva }) => {
      const info = infoIntegracao[unidade.id];
      if (kpi === 'entrega' && !entregaAtiva) return false;
      if (kpi === 'inadimplente' && info?.inadimplente !== true) return false;
      if (kpi !== 'todas' && kpi !== 'entrega' && kpi !== 'inadimplente' && unidade.status !== kpi)
        return false;
      if (inadimplenciaFiltro === INADIMPLENTE && info?.inadimplente !== true) return false;
      if (inadimplenciaFiltro === EM_DIA && info?.inadimplente !== false) return false;
      if (!q) return true;
      return (
        unidade.identificacao.toLowerCase().includes(q) ||
        (info?.cliente?.toLowerCase().includes(q) ?? false) ||
        (info?.contrato?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [unidades, busca, kpi, inadimplenciaFiltro, infoIntegracao]);

  // Ordenação aplicada depois do filtro, sem recomputar `filtradas`.
  const ordenadas = useMemo(() => {
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
      porStatus: Object.fromEntries(
        UNIDADE_STATUS.map((s) => [s, unidades.filter((r) => r.unidade.status === s).length]),
      ) as Record<UnidadeStatus, number>,
      inadimplentes: unidades.filter((r) => infoIntegracao[r.unidade.id]?.inadimplente === true)
        .length,
      entregasIniciadas: unidades.filter((r) => r.entregaAtiva).length,
    }),
    [unidades, infoIntegracao],
  );

  // Contagem por opção do filtro de inadimplência, respeitando o resumo ativo.
  const facetaInadimplencia = useMemo(() => {
    const base = unidades.filter(({ unidade, entregaAtiva }) =>
      kpi === 'todas'
        ? true
        : kpi === 'entrega'
          ? Boolean(entregaAtiva)
          : kpi === 'inadimplente'
            ? infoIntegracao[unidade.id]?.inadimplente === true
            : unidade.status === kpi,
    );
    const inad = base.filter((r) => infoIntegracao[r.unidade.id]?.inadimplente === true).length;
    const emDia = base.filter((r) => infoIntegracao[r.unidade.id]?.inadimplente === false).length;
    return { todos: base.length, inad, emDia };
  }, [unidades, kpi, infoIntegracao]);

  // Clicar no item ativo volta para "Todas"; a seleção sai de vista junto.
  const mudarKpi = (novo: Kpi): void => {
    setKpi((atual) => (atual === novo ? 'todas' : novo));
    setSelecionadas(new Set());
  };

  const filtrosAtivos = busca.trim() !== '' || inadimplenciaFiltro !== TODOS;
  const limparFiltros = (): void => {
    setBusca('');
    setInadimplenciaFiltro(TODOS);
  };

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
      <>
        <CabecalhoSkeleton voltar />
        <PageContent>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-[148px] w-full rounded-xl" />
            <Skeleton className="h-10 w-full max-w-[520px] rounded-[10px]" />
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="h-11 bg-muted" />
              <LinhasSkeleton linhas={8} />
            </div>
          </div>
        </PageContent>
      </>
    );
  }
  if (!empreendimento) return <></>;

  return (
    <>
      <header className="border-b border-border bg-card px-4 py-3 safe-px md:px-8">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="-mr-1" asChild>
              <Link to="/unidades" aria-label="Voltar para Empreendimentos">
                <ArrowLeft />
              </Link>
            </Button>
            <Building2 className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                {empreendimento.nome}
              </h1>
              <p className="text-xs text-muted-foreground">
                {empreendimento.cidade}/{empreendimento.uf} ·{' '}
                {carregandoInfo && unidades.length === 0 ? (
                  // <p> não aceita <div>: skeleton inline.
                  <span className="inline-block h-3 w-20 animate-pulse rounded-md bg-muted align-middle" />
                ) : (
                  `${unidades.length} unidade(s)`
                )}
              </p>
            </div>
          </div>
        </div>
      </header>

      <PageContent>
        <div className="flex flex-col gap-6">
          {/* Resumo — cada célula filtra a tabela. */}
          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <button
                type="button"
                onClick={() => mudarKpi('todas')}
                aria-pressed={kpi === 'todas'}
                title="Todas as unidades cadastradas, vendidas ou não"
                className={cn(
                  'flex items-baseline gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-[background-color] duration-150 hover:bg-slate-50',
                  kpi === 'todas' && RESUMO_SELECIONADO,
                )}
              >
                <span className="text-[30px] font-bold leading-none tabular-nums text-foreground">
                  {n0(metricas.total)}
                </span>
                <span className="text-[13px] font-medium text-muted-foreground">
                  unidades · todos os status
                </span>
              </button>
              <span className="text-xs text-muted-foreground">% do total de unidades</span>
            </div>

            <div className="flex h-2 w-full gap-0.5 rounded-full bg-muted">
              {statusPresentes.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={UNIDADE_STATUS_META[s].label}
                  title={UNIDADE_STATUS_META[s].label}
                  onClick={() => mudarKpi(s)}
                  onMouseEnter={() => setDestaque(s)}
                  onMouseLeave={() => setDestaque(null)}
                  className={cn(
                    '-my-1 box-content bg-clip-content py-1 transition-opacity duration-150 first:rounded-l-full last:rounded-r-full',
                    kpi !== 'todas' && kpi !== s && 'opacity-25',
                  )}
                  style={{
                    width: `${(metricas.porStatus[s] / metricas.total) * 100}%`,
                    backgroundColor: UNIDADE_STATUS_META[s].color,
                  }}
                />
              ))}
            </div>

            {/* Status (soma 100%) no grupo com borda; os indicadores transversais ao lado. */}
            <div className="grid grid-cols-2 gap-2 min-[760px]:grid-cols-[3fr_1fr_1fr]">
              <div className="col-span-2 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-1 rounded-[10px] border border-border p-1 min-[760px]:col-span-1">
                {statusPresentes.map((s) => (
                  <CelulaResumo
                    key={s}
                    label={UNIDADE_STATUS_META[s].label}
                    dot={UNIDADE_STATUS_META[s].color}
                    qtd={metricas.porStatus[s]}
                    total={metricas.total}
                    ativa={kpi === s}
                    apagada={kpi !== 'todas' && kpi !== s}
                    destacada={destaque === s}
                    onClick={() => mudarKpi(s)}
                    title={`Unidades com status ${UNIDADE_STATUS_META[s].label}`}
                  />
                ))}
              </div>
              <CelulaResumo
                label="Inadimplentes"
                dot="#ef4444"
                corPct="#ef4444"
                qtd={carregandoInfo ? null : metricas.inadimplentes}
                total={metricas.total}
                ativa={kpi === 'inadimplente'}
                apagada={kpi !== 'todas' && kpi !== 'inadimplente'}
                onClick={() => mudarKpi('inadimplente')}
                title="Unidades cujo contrato está inadimplente no Mega"
              />
              <CelulaResumo
                label="Entregas iniciadas"
                dot="#f29f05"
                qtd={metricas.entregasIniciadas}
                total={metricas.total}
                ativa={kpi === 'entrega'}
                apagada={kpi !== 'todas' && kpi !== 'entrega'}
                onClick={() => mudarKpi('entrega')}
                title="Unidades com uma entrega já em andamento"
              />
            </div>
          </section>

          {/* Busca + filtros, na mesma linha */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="max-w-[520px] flex-[1_1_280px]">
              <SearchInput
                value={busca}
                onChange={setBusca}
                placeholder="Buscar por unidade, cliente, contrato..."
              />
            </div>
            <FiltroDropdown
              icon={TriangleAlert}
              label="Inadimplência"
              padrao={TODOS}
              valor={inadimplenciaFiltro}
              onChange={setInadimplenciaFiltro}
              opcoes={[
                { valor: TODOS, label: 'Todas', qtd: facetaInadimplencia.todos },
                { valor: INADIMPLENTE, label: 'Inadimplente', qtd: facetaInadimplencia.inad },
                { valor: EM_DIA, label: 'Em dia', qtd: facetaInadimplencia.emDia },
              ]}
            />
            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-sm text-muted-foreground transition-colors hover:bg-card"
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </button>
            )}
            <span className="ml-auto text-[13px] text-muted-foreground">
              {n0(filtradas.length)} de {n0(metricas.total)} unidades
            </span>
          </div>

          {avisoIntegracao && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {avisoIntegracao}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Barra de seleção em massa */}
            {selecionadasVisiveis.length > 0 && (
              <div className="flex min-h-11 flex-wrap items-center gap-3 border-b border-[#fde7bd] bg-[#fff7e8] px-4 py-1.5 dark:border-primary/30 dark:bg-primary/10">
                <span className="text-sm font-semibold text-foreground">
                  {n0(selecionadasVisiveis.length)} unidade(s) selecionada(s)
                </span>
                <Button
                  size="sm"
                  className="ml-auto h-[30px]"
                  onClick={enviarTermosEmMassa}
                  disabled={enviandoMassa}
                >
                  {enviandoMassa ? <Loader2 className="animate-spin" /> : <Send />}
                  {enviandoMassa ? 'Enviando...' : 'Enviar termo em massa'}
                </Button>
                <button
                  type="button"
                  onClick={() => setSelecionadas(new Set())}
                  disabled={enviandoMassa}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Limpar seleção
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div
                  className={cn(
                    GRID_TABELA,
                    'h-11 bg-muted text-sm text-slate-600 dark:text-muted-foreground',
                  )}
                >
                  <Checkbox
                    aria-label="Selecionar todas as unidades"
                    checked={todasSelecionadas}
                    ref={(el) => {
                      if (el) el.indeterminate = algumaSelecionada;
                    }}
                    onChange={alternarTodas}
                  />
                  <CabecalhoOrdenavel
                    label="Contrato"
                    campo="contrato"
                    ordem={ordenacao}
                    onOrdenar={alternarOrdem}
                  />
                  <CabecalhoOrdenavel
                    label="Cliente"
                    campo="cliente"
                    ordem={ordenacao}
                    onOrdenar={alternarOrdem}
                  />
                  <CabecalhoOrdenavel
                    label="Unidade"
                    campo="unidade"
                    ordem={ordenacao}
                    onOrdenar={alternarOrdem}
                  />
                  <CabecalhoOrdenavel
                    label="Área"
                    campo="area"
                    ordem={ordenacao}
                    onOrdenar={alternarOrdem}
                  />
                  <CabecalhoOrdenavel
                    label="Status"
                    campo="status"
                    ordem={ordenacao}
                    onOrdenar={alternarOrdem}
                  />
                  <CabecalhoOrdenavel
                    label="Inadimplência"
                    campo="inadimplente"
                    ordem={ordenacao}
                    onOrdenar={alternarOrdem}
                  />
                  <span />
                </div>

                {ordenadas.map((resumo, i) => {
                  const { unidade } = resumo;
                  const info = infoIntegracao[unidade.id];
                  const selecionada = selecionadas.has(unidade.id);
                  const semEntrega = SEM_ENTREGA.includes(unidade.status);
                  return (
                    <div
                      key={unidade.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetalhe(resumo)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDetalhe(resumo);
                        }
                      }}
                      className={cn(
                        GRID_TABELA,
                        'cursor-pointer border-t border-border py-3 text-sm transition-colors hover:bg-[#fff7e8] dark:hover:bg-primary/10',
                        selecionada && !semEntrega
                          ? 'bg-[#fffbf2] dark:bg-primary/5'
                          : i % 2 === 1
                            ? 'bg-muted/50'
                            : 'bg-card',
                      )}
                    >
                      {/* O clique no checkbox não pode abrir a unidade. */}
                      <span onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label={`Selecionar ${unidade.identificacao}`}
                          checked={selecionada && !semEntrega}
                          disabled={semEntrega}
                          onChange={() => alternarUma(unidade.id)}
                        />
                      </span>
                      <span className="font-medium tabular-nums text-foreground [overflow-wrap:anywhere]">
                        {carregandoInfo ? (
                          <Skeleton className="h-4 w-20" />
                        ) : (
                          (info?.contrato ?? <span className="text-slate-400">-</span>)
                        )}
                      </span>
                      <span className="text-foreground [overflow-wrap:anywhere]">
                        {carregandoInfo ? (
                          <Skeleton className="h-4 w-28" />
                        ) : (
                          (info?.cliente ?? <span className="text-slate-400">Sem cliente</span>)
                        )}
                      </span>
                      <span className="font-semibold text-[#b36f00] [overflow-wrap:anywhere] dark:text-primary">
                        {unidade.identificacao}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {fArea(unidade.areaM2)}
                      </span>
                      <span>
                        <UnidadeStatusBadge status={unidade.status} />
                      </span>
                      <span>
                        {carregandoInfo ? (
                          <Skeleton className="h-4 w-24" />
                        ) : info?.inadimplente !== undefined ? (
                          <InadimplenciaBadge inadimplente={info.inadimplente} />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  );
                })}
              </div>
            </div>

            {filtradas.length === 0 &&
              (carregandoInfo ? (
                <div className="overflow-x-auto" aria-busy="true">
                  <div className="min-w-[900px]">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className={cn(GRID_TABELA, 'border-t border-border py-3')}>
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <span />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={unidades.length > 0 ? Search : Building2}
                  titulo="Nenhuma unidade encontrada"
                  descricao={
                    unidades.length > 0
                      ? 'Ajuste a busca ou os filtros.'
                      : 'O empreendimento não tem unidades no CV nem contratos no Mega.'
                  }
                />
              ))}
          </div>
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

/** Célula do card de resumo (padrão Chamados/Entregas): clicar filtra a tabela. */
function CelulaResumo({
  label,
  dot,
  qtd,
  total,
  ativa,
  apagada,
  destacada = false,
  corPct = '#64748b',
  onClick,
  title,
}: {
  label: string;
  dot: string;
  /** `null` enquanto o dado da integração ainda está carregando. */
  qtd: number | null;
  total: number;
  ativa: boolean;
  apagada: boolean;
  destacada?: boolean;
  corPct?: string;
  onClick: () => void;
  title: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      title={title}
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-[10px] px-2.5 py-2 text-left transition-[opacity,background-color] duration-150 hover:bg-slate-50',
        ativa && RESUMO_SELECIONADO,
        apagada && 'opacity-[0.45]',
        destacada && 'bg-slate-50 opacity-100 ring-1 ring-border',
      )}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
        {label}
      </span>
      <span className="flex items-baseline gap-1.5 tabular-nums">
        {qtd === null ? (
          <Skeleton className="h-7 w-10" />
        ) : (
          <>
            <span className="text-xl font-bold text-foreground">{n0(qtd)}</span>
            <span className="text-xs font-semibold" style={{ color: corPct }}>
              {pct1(qtd, total || 1)}
            </span>
          </>
        )}
      </span>
    </button>
  );
}
