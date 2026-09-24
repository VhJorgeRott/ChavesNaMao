import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headset,
  ListChecks,
  MapPin,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import {
  adapters,
  type ChamadoAssistencia,
  type DescricaoChamado,
  type FaseChamado,
  type FiltroChamados,
  type LocalChamado,
  type OrdemChamado,
  type PaginaChamados,
  type PeriodoChamado,
} from '@/adapters';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChamadoSituacaoBadge,
  SlaVencidoBadge,
} from '@/components/assistencia/ChamadoSituacaoBadge';
import { ChamadoDetalheDialog } from '@/components/assistencia/ChamadoDetalheDialog';
import { FiltroDropdown } from '@/components/shared/FiltroDropdown';
import { CabecalhoOrdenavel, RESUMO_SELECIONADO } from '@/components/shared/lista';
import { n0, pct1 } from '@/lib/numeros';
import { FASE_META } from '@/components/assistencia/fase';
import { fData, fDataHora } from '@chaves/domain/format';
import { cn } from '@/lib/utils';
import { comCache, lerCache, limparCache } from '@/lib/cache-memoria';

const POR_PAGINA = 25;
const FASES: FaseChamado[] = ['nova', 'andamento', 'improcedente', 'finalizado'];
const DUAS_HORAS = 2 * 60 * 60 * 1000;
const TODOS = 'todos';

type Kpi = 'todas' | 'aberto' | FaseChamado;

/** "NOVA ASSISTÊNCIA" → "Nova assistência". */
const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const GRID_TABELA = 'grid grid-cols-[116px_96px_minmax(0,1fr)_minmax(0,1.5fr)_200px] gap-4 px-4';

function StatusLeitura({ atualizadoEm }: { atualizadoEm: string }): React.JSX.Element {
  // Recalcula a cada minuto para virar "Desatualizado" sem recarregar.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const online = agora - new Date(atualizadoEm).getTime() < DUAS_HORAS;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'ml-2 inline-flex items-center gap-1.5 rounded-full py-px pl-1.5 pr-2 align-middle text-[11px] font-semibold',
            online
              ? 'bg-[rgba(34,197,94,.12)] text-[#15803d]'
              : 'bg-muted text-slate-600 dark:text-muted-foreground',
          )}
        >
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{
              backgroundColor: online ? '#22c55e' : '#94a3b8',
              boxShadow: `0 0 0 2px ${online ? 'rgba(34,197,94,.25)' : 'rgba(148,163,184,.25)'}`,
            }}
          />
          {online ? 'Online' : 'Desatualizado'}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {online
          ? 'Dados atualizados há menos de 2 horas'
          : 'Última leitura há mais de 2 horas — clique em Atualizar'}
      </TooltipContent>
    </Tooltip>
  );
}

export function Chamados(): React.JSX.Element {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [kpi, setKpi] = useState<Kpi>('aberto');
  /** Fase sob o mouse na barra: destaca a célula correspondente da legenda. */
  const [destaque, setDestaque] = useState<FaseChamado | null>(null);
  const [situacoes, setSituacoes] = useState<string[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState<PeriodoChamado | typeof TODOS>(TODOS);
  const [local, setLocal] = useState<LocalChamado | typeof TODOS>(TODOS);
  const [descricao, setDescricao] = useState<DescricaoChamado | typeof TODOS>(TODOS);
  const [ordem, setOrdem] = useState<{ campo: OrdemChamado; dir: 'asc' | 'desc' }>({
    campo: 'data',
    dir: 'desc',
  });
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<ChamadoAssistencia | null>(null);

  const filtro = useMemo<FiltroChamados>(() => {
    const f: FiltroChamados = {
      pagina,
      porPagina: POR_PAGINA,
      ordem: ordem.campo,
      direcao: ordem.dir,
    };
    if (kpi !== 'todas') f.fase = kpi === 'aberto' ? 'abertos' : kpi;
    if (situacoes.length) f.situacaoIds = situacoes;
    if (empreendimentos.length) f.empreendimentoIds = empreendimentos;
    if (periodo !== TODOS) f.periodo = periodo;
    if (local !== TODOS) f.local = local;
    if (descricao !== TODOS) f.descricao = descricao;
    if (buscaAplicada) f.busca = buscaAplicada;
    return f;
  }, [pagina, ordem, kpi, situacoes, empreendimentos, periodo, local, descricao, buscaAplicada]);
  const chave = `chamados:${JSON.stringify(filtro)}`;

  // Parte do cache (2h): voltar à tela não chama o CRM nem mostra esqueleto.
  const [dados, setDados] = useState<PaginaChamados | null>(
    () => lerCache<PaginaChamados>(chave) ?? null,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(dados === null);

  // Busca com debounce: evita uma chamada à função a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada((atual) => {
        const nova = busca.trim();
        if (nova !== atual) setPagina(1);
        return nova;
      });
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  // Descarta respostas antigas quando os filtros mudam antes de a anterior voltar.
  const requisicao = useRef(0);

  const carregar = useCallback(
    async (atualizar = false) => {
      const id = ++requisicao.current;
      if (atualizar) limparCache('chamados:');
      const cacheado = lerCache<PaginaChamados>(chave);
      if (cacheado) {
        setDados(cacheado);
        setErro(null);
        setCarregando(false);
        return;
      }
      setCarregando(true);
      setErro(null);
      try {
        const r = await comCache(chave, () =>
          adapters.assistencia.listarChamados(atualizar ? { ...filtro, atualizar } : filtro),
        );
        if (id === requisicao.current) setDados(r);
      } catch (e) {
        if (id === requisicao.current) {
          setErro(e instanceof Error ? e.message : 'Falha ao carregar os chamados.');
        }
      } finally {
        if (id === requisicao.current) setCarregando(false);
      }
    },
    [chave, filtro],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Envolve um setter de filtro: toda mudança volta para a página 1. */
  const comPagina1 =
    <T,>(set: (v: T) => void) =>
    (v: T): void => {
      set(v);
      setPagina(1);
    };

  // Clicar no item ativo volta para "Todas".
  const mudarKpi = (novo: Kpi): void => {
    setKpi((atual) => (atual === novo ? 'todas' : novo));
    setSituacoes([]);
    setPagina(1);
  };

  const mudarSituacoes = (v: string[]): void => {
    setSituacoes(v);
    if (v.length) setKpi('todas');
    setPagina(1);
  };

  const ordenar = (campo: OrdemChamado): void => {
    setOrdem((atual) =>
      atual.campo === campo
        ? { campo, dir: atual.dir === 'asc' ? 'desc' : 'asc' }
        : { campo, dir: campo === 'data' ? 'desc' : 'asc' },
    );
    setPagina(1);
  };

  const filtrosAtivos =
    busca.trim() !== '' ||
    situacoes.length > 0 ||
    empreendimentos.length > 0 ||
    periodo !== TODOS ||
    local !== TODOS ||
    descricao !== TODOS;

  const limparFiltros = (): void => {
    setBusca('');
    setBuscaAplicada('');
    setSituacoes([]);
    setEmpreendimentos([]);
    setPeriodo(TODOS);
    setLocal(TODOS);
    setDescricao(TODOS);
    setPagina(1);
  };

  const porFase = dados?.porFase ?? null;
  const facetas = dados?.facetas;
  const abertos = porFase ? porFase.nova + porFase.andamento : null;
  const totalGeral = porFase ? FASES.reduce((s, f) => s + porFase[f], 0) : null;
  const primeiro = dados && dados.total > 0 ? (dados.pagina - 1) * dados.porPagina + 1 : 0;
  const ultimo = dados ? Math.min(dados.pagina * dados.porPagina, dados.total) : 0;

  /** O item faz parte do filtro ativo? "Em aberto" inclui Novas e Em andamento. */
  const noFiltro = (k: Exclude<Kpi, 'todas'>): boolean =>
    kpi === 'todas' || kpi === k || (kpi === 'aberto' && (k === 'nova' || k === 'andamento'));

  const celula = (
    k: Exclude<Kpi, 'todas'>,
    label: string,
    dot: string,
    qtd: number | null,
    base: number | null,
    legenda: string,
    corPct: string,
  ): React.JSX.Element => (
    <button
      key={k}
      type="button"
      onClick={() => mudarKpi(k)}
      aria-pressed={kpi === k}
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-[10px] px-2.5 py-2 text-left transition-[opacity,background-color] duration-150 hover:bg-slate-50',
        kpi === k && RESUMO_SELECIONADO,
        !noFiltro(k) && 'opacity-[0.45]',
        destaque === k && 'bg-slate-50 opacity-100 ring-1 ring-border',
      )}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
        {label}
      </span>
      <span className="flex items-baseline gap-1.5 tabular-nums">
        {qtd === null ? (
          <Skeleton className="h-7 w-8" />
        ) : (
          <span className="text-xl font-bold text-foreground">{n0(qtd)}</span>
        )}
        <span className="text-xs font-semibold" style={{ color: corPct }}>
          {qtd === null || base === null ? '-' : pct1(qtd, base || 1)}
        </span>
      </span>
      <span className="truncate text-[11px] text-muted-foreground">{legenda}</span>
    </button>
  );
  const celulaFase = (f: FaseChamado, base: number | null, legenda: string, corPct: string) =>
    celula(
      f,
      FASE_META[f].label,
      FASE_META[f].dot,
      porFase ? porFase[f] : null,
      base,
      legenda,
      corPct,
    );

  return (
    <>
      <PageHeader
        icon={Headset}
        titulo="Chamados"
        subtitulo={
          dados ? (
            <>
              Assistência técnica · CV CRM · lido em {fDataHora(dados.atualizadoEm)}
              <StatusLeitura atualizadoEm={dados.atualizadoEm} />
            </>
          ) : (
            'Assistência técnica · CV CRM'
          )
        }
        actions={
          <Button
            variant="outline"
            className="rounded-[10px] hover:border-primary hover:bg-primary hover:text-white"
            onClick={() => void carregar(true)}
            disabled={carregando}
          >
            <RefreshCw className={carregando ? 'animate-spin' : undefined} />
            Atualizar
          </Button>
        }
      />
      <PageContent>
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <button
              type="button"
              onClick={() => mudarKpi('todas')}
              aria-pressed={kpi === 'todas'}
              className={cn(
                'flex items-baseline gap-2.5 self-start rounded-[10px] px-2.5 py-2 text-left transition-[background-color] duration-150 hover:bg-slate-50',
                kpi === 'todas' && RESUMO_SELECIONADO,
              )}
            >
              {totalGeral === null ? (
                <Skeleton className="h-[30px] w-12" />
              ) : (
                <span className="text-[30px] font-bold leading-none tabular-nums text-foreground">
                  {n0(totalGeral)}
                </span>
              )}
              <span className="text-[13px] font-medium text-muted-foreground">
                chamados · todas as situações
              </span>
            </button>

            <div className="flex h-2 w-full gap-0.5 rounded-full bg-muted">
              {porFase &&
                totalGeral &&
                FASES.filter((f) => porFase[f] > 0).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-label={FASE_META[f].label}
                    title={FASE_META[f].label}
                    onClick={() => mudarKpi(f)}
                    onMouseEnter={() => setDestaque(f)}
                    onMouseLeave={() => setDestaque(null)}
                    className={cn(
                      '-my-1 box-content bg-clip-content py-1 transition-opacity duration-150 first:rounded-l-full last:rounded-r-full',
                      !noFiltro(f) && 'opacity-25',
                    )}
                    style={{
                      width: `${(porFase[f] / totalGeral) * 100}%`,
                      backgroundColor: FASE_META[f].dot,
                    }}
                  />
                ))}
            </div>

            {/* Novas + Em andamento = Em aberto: a borda do grupo mostra a hierarquia. */}
            <div className="grid grid-cols-2 gap-2 min-[760px]:grid-cols-[3fr_1fr_1fr]">
              <div className="col-span-2 grid grid-cols-3 gap-1 rounded-[10px] border border-border p-1 min-[760px]:col-span-1">
                {celula(
                  'aberto',
                  'Em aberto',
                  '#ef4444',
                  abertos,
                  totalGeral,
                  'do total de chamados',
                  '#ef4444',
                )}
                {celulaFase('nova', abertos, 'do total em aberto', '#64748b')}
                {celulaFase('andamento', abertos, 'do total em aberto', '#64748b')}
              </div>
              {celulaFase('improcedente', totalGeral, 'do total de chamados', '#64748b')}
              {celulaFase('finalizado', totalGeral, 'do total de chamados', '#15803d')}
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="max-w-[520px] flex-[1_1_280px]">
                <SearchInput
                  value={busca}
                  onChange={setBusca}
                  placeholder="Buscar por protocolo, cliente, unidade..."
                />
              </div>
              {dados && (
                <span className="ml-auto text-[13px] text-muted-foreground">
                  {n0(dados.total)} de {n0(totalGeral ?? 0)} chamados
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FiltroDropdown
                multi
                icon={ListChecks}
                label="Situação"
                resumoVazio="Todas"
                valor={situacoes}
                onChange={mudarSituacoes}
                opcoes={(dados?.porSituacao ?? [])
                  .filter((s): s is typeof s & { id: string } => s.id !== null)
                  .map((s) => ({
                    valor: s.id,
                    label: `${s.etapa !== null ? `${String(s.etapa).padStart(2, '0')} ` : ''}${capitalizar(s.nome)}`,
                    qtd: s.qtd,
                  }))}
              />
              <FiltroDropdown
                multi
                icon={Building2}
                label="Empreendimento"
                resumoVazio="Todos"
                valor={empreendimentos}
                onChange={comPagina1(setEmpreendimentos)}
                opcoes={(dados?.empreendimentos ?? []).map((e) => ({
                  valor: e.id,
                  label: e.nome,
                  qtd: facetas ? (facetas.empreendimento[e.id] ?? 0) : undefined,
                }))}
              />
              <FiltroDropdown
                icon={Calendar}
                label="Abertura"
                padrao={TODOS}
                valor={periodo}
                onChange={comPagina1((v: string) => setPeriodo(v as PeriodoChamado | typeof TODOS))}
                opcoes={[
                  { valor: TODOS, label: 'Qualquer data', qtd: facetas?.periodo.todos },
                  { valor: 'hoje', label: 'Hoje', qtd: facetas?.periodo.hoje },
                  { valor: '7', label: 'Últimos 7 dias', qtd: facetas?.periodo['7'] },
                  { valor: '30', label: 'Últimos 30 dias', qtd: facetas?.periodo['30'] },
                ]}
              />
              <FiltroDropdown
                icon={MapPin}
                label="Local"
                padrao={TODOS}
                valor={local}
                onChange={comPagina1((v: string) => setLocal(v as LocalChamado | typeof TODOS))}
                opcoes={[
                  { valor: TODOS, label: 'Todos', qtd: facetas?.local.todos },
                  { valor: 'unidade', label: 'Unidade', qtd: facetas?.local.unidade },
                  { valor: 'area', label: 'Área comum', qtd: facetas?.local.area },
                ]}
              />
              <FiltroDropdown
                icon={FileText}
                label="Solicitação"
                padrao={TODOS}
                valor={descricao}
                onChange={comPagina1((v: string) =>
                  setDescricao(v as DescricaoChamado | typeof TODOS),
                )}
                opcoes={[
                  { valor: TODOS, label: 'Todas', qtd: facetas?.descricao.todos },
                  { valor: 'com', label: 'Com descrição', qtd: facetas?.descricao.com },
                  { valor: 'sem', label: 'Sem descrição', qtd: facetas?.descricao.sem },
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
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {erro ? (
              <EmptyState
                icon={AlertTriangle}
                titulo="Não foi possível carregar os chamados"
                descricao={erro}
              >
                <Button variant="outline" onClick={() => void carregar()}>
                  <RefreshCw />
                  Tentar novamente
                </Button>
              </EmptyState>
            ) : !dados ? (
              <div className="overflow-x-auto" aria-busy="true">
                <div className="min-w-[780px]">
                  <div className={cn(GRID_TABELA, 'h-11 items-center bg-muted')}>
                    {[20, 16, 24, 32, 20].map((w, i) => (
                      <Skeleton key={i} className="h-3.5" style={{ width: `${w * 4}px` }} />
                    ))}
                  </div>
                  {Array.from({ length: 8 }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        GRID_TABELA,
                        'items-start border-t border-border py-3.5',
                        i % 2 === 1 ? 'bg-muted/50' : 'bg-card',
                      )}
                    >
                      <Skeleton className="h-4 w-16" />
                      <span className="flex flex-col gap-1.5">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-10" />
                      </span>
                      <span className="flex flex-col gap-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </span>
                      <span className="flex flex-col gap-1.5">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/5" />
                      </span>
                      <Skeleton className="h-6 w-28 rounded-full" />
                    </div>
                  ))}
                  <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                    Lendo os chamados do CV CRM. A primeira carga pode levar alguns segundos.
                  </p>
                </div>
              </div>
            ) : (
              <div className={cn('transition-opacity', carregando && 'opacity-60')}>
                <div className="overflow-x-auto">
                  <div className="min-w-[780px]">
                    <div
                      className={cn(
                        GRID_TABELA,
                        'h-11 items-center bg-muted text-sm text-slate-600 dark:text-muted-foreground',
                      )}
                    >
                      <CabecalhoOrdenavel
                        label="Protocolo"
                        campo="protocolo"
                        ordem={ordem}
                        onOrdenar={ordenar}
                      />
                      <CabecalhoOrdenavel
                        label="Abertura"
                        campo="data"
                        ordem={ordem}
                        onOrdenar={ordenar}
                      />
                      <CabecalhoOrdenavel
                        label="Local"
                        campo="local"
                        ordem={ordem}
                        onOrdenar={ordenar}
                      />
                      <CabecalhoOrdenavel
                        label="Solicitação"
                        campo="descricao"
                        ordem={ordem}
                        onOrdenar={ordenar}
                      />
                      <CabecalhoOrdenavel
                        label="Situação"
                        campo="situacao"
                        ordem={ordem}
                        onOrdenar={ordenar}
                      />
                    </div>
                    {dados.itens.map((c, i) => (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelecionado(c)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelecionado(c);
                          }
                        }}
                        className={cn(
                          GRID_TABELA,
                          'cursor-pointer items-start border-t border-border py-3.5 text-sm transition-colors hover:bg-[#fff7e8] dark:hover:bg-primary/10',
                          i % 2 === 1 ? 'bg-muted/50' : 'bg-card',
                        )}
                      >
                        <span className="font-medium tabular-nums text-foreground [overflow-wrap:anywhere]">
                          {(c.protocolo ?? c.id).replace(/^#/, '')}
                        </span>
                        <span>
                          <span className="block text-foreground">{fData(c.abertoEm)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {c.abertoEm?.slice(11, 16) ?? ''}
                          </span>
                        </span>
                        <span className="[overflow-wrap:anywhere]">
                          <span className="block text-foreground">
                            {c.unidade
                              ? [c.bloco, c.unidade.nome].filter(Boolean).join(' · ')
                              : (c.areaComum ?? 'Área comum')}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {c.empreendimento?.nome}
                          </span>
                        </span>
                        <span>
                          <span className="block leading-[1.45] text-foreground [text-wrap:pretty]">
                            {c.descricao || '-'}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {c.cliente?.nome ?? c.sindico ?? '-'}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <ChamadoSituacaoBadge chamado={c} />
                          {c.slaVencido && <SlaVencidoBadge />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {dados.total === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Search className="h-10 w-10 text-slate-400" />
                    <p className="text-[15px] font-semibold text-foreground">
                      Nenhum chamado encontrado
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      Ajuste a busca ou os filtros.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    <span>
                      {n0(primeiro)}–{n0(ultimo)} de {n0(dados.total)} chamados
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={carregando || dados.pagina <= 1}
                        onClick={() => setPagina(dados.pagina - 1)}
                      >
                        <ChevronLeft />
                        Anterior
                      </Button>
                      <span className="whitespace-nowrap">
                        Página {n0(dados.pagina)} de {n0(dados.totalPaginas)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={carregando || dados.pagina >= dados.totalPaginas}
                        onClick={() => setPagina(dados.pagina + 1)}
                      >
                        Próxima
                        <ChevronRight />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </PageContent>

      <ChamadoDetalheDialog
        chamado={selecionado}
        onOpenChange={(open) => !open && setSelecionado(null)}
      />
    </>
  );
}
