import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Download, PackageCheck, Search, User, X } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { listarEntregas } from '@/data/selectors';
import { ENTREGA_STATUS } from '@chaves/domain/types';
import type { EntregaStatus } from '@chaves/domain/types';
import { ENTREGA_STATUS_META } from '@chaves/domain/status';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { EntregaStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { FiltroDropdown } from '@/components/shared/FiltroDropdown';
import { CabecalhoOrdenavel, RESUMO_SELECIONADO, type Ordem } from '@/components/shared/lista';
import { n0, pct1 } from '@/lib/numeros';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { fData } from '@chaves/domain/format';
import { baixarCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

/** KPI ativo: "todas" ou uma etapa da máquina de estados. */
type Kpi = 'todas' | EntregaStatus;
type Campo = 'cliente' | 'unidade' | 'responsavel' | 'iniciada' | 'status';

/**
 * Rótulo curto da legenda do resumo. Os nomes completos ("Confissão de dívida",
 * "Assinatura na entrega") não cabem em 1/6 do card.
 * O badge da tabela continua usando ENTREGA_STATUS_META[s].label.
 */
const KPI_LABEL: Record<EntregaStatus, string> = {
  ABERTURA: 'Abertura',
  DOCUMENTOS: 'Documentos',
  CONFISSAO: 'Confissão',
  ASSINATURA: 'Assinatura',
  REGISTRO: 'Registro',
  CONCLUIDA: 'Concluída',
};

const GRID_TABELA =
  'grid grid-cols-[20px_minmax(0,1.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_104px_168px_20px] items-center gap-4 px-4';

/** Ordem de exibição das etapas nos KPIs e na ordenação por status. */
const ORDEM_ETAPA: Record<EntregaStatus, number> = Object.fromEntries(
  ENTREGA_STATUS.map((s, i) => [s, i]),
) as Record<EntregaStatus, number>;

/** Reusa o Checkbox do design system, só acrescentando o estado indeterminado
 *  (que existe como propriedade do DOM, não como atributo). */
function Marcador({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}): React.JSX.Element {
  return (
    <Checkbox
      ref={(el) => {
        if (el) el.indeterminate = indeterminate && !checked;
      }}
      checked={checked}
      onChange={onChange}
      aria-label={label}
    />
  );
}

export function Entregas(): React.JSX.Element {
  const { state, carregandoPersistidos } = useData();
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [kpi, setKpi] = useState<Kpi>('todas');
  /** Etapa sob o mouse na barra: destaca a célula correspondente da legenda. */
  const [destaque, setDestaque] = useState<EntregaStatus | null>(null);
  const [empreendimentos, setEmpreendimentos] = useState<string[]>([]);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<Ordem<Campo>>({ campo: 'iniciada', dir: 'desc' });
  const [marcadas, setMarcadas] = useState<string[]>([]);

  const entregas = listarEntregas(state);
  const total = entregas.length;
  const carregando = carregandoPersistidos && total === 0;

  const porEtapa = useMemo(() => {
    const acc = Object.fromEntries(ENTREGA_STATUS.map((s) => [s, 0])) as Record<
      EntregaStatus,
      number
    >;
    for (const { entrega } of entregas) acc[entrega.status] += 1;
    return acc;
  }, [entregas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = entregas.filter(({ entrega, cliente, unidade, empreendimento, responsavel }) => {
      if (kpi !== 'todas' && entrega.status !== kpi) return false;
      if (empreendimentos.length && !empreendimentos.includes(unidade?.empreendimentoId ?? ''))
        return false;
      if (responsaveis.length && !responsaveis.includes(entrega.responsavelId ?? '')) return false;
      if (!q) return true;
      return [cliente?.nome, unidade?.identificacao, empreendimento?.nome, responsavel?.nome].some(
        (v) => v?.toLowerCase().includes(q),
      );
    });

    const dir = ordem.dir === 'asc' ? 1 : -1;
    const chave = (e: (typeof lista)[number]): string | number => {
      switch (ordem.campo) {
        case 'cliente':
          return e.cliente?.nome ?? '';
        case 'unidade':
          return e.unidade?.identificacao ?? '';
        case 'responsavel':
          return e.responsavel?.nome ?? '';
        case 'status':
          return ORDEM_ETAPA[e.entrega.status];
        case 'iniciada':
          return e.entrega.iniciadaEm ?? e.entrega.createdAt;
      }
    };
    return [...lista].sort((a, b) => {
      const x = chave(a);
      const y = chave(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y), 'pt-BR') * dir;
    });
  }, [entregas, busca, kpi, empreendimentos, responsaveis, ordem]);

  // Contagem por opção considerando os demais filtros (facetas dos dropdowns).
  const facetas = useMemo(() => {
    const base = entregas.filter(({ entrega }) => kpi === 'todas' || entrega.status === kpi);
    const conta = (
      chave: (e: (typeof base)[number]) => string | undefined,
    ): Record<string, number> =>
      base.reduce<Record<string, number>>((acc, e) => {
        const k = chave(e);
        if (k) acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    return {
      empreendimento: conta((e) => e.unidade?.empreendimentoId),
      responsavel: conta((e) => e.entrega.responsavelId ?? undefined),
    };
  }, [entregas, kpi]);

  const filtrosAtivos =
    busca !== '' || kpi !== 'todas' || empreendimentos.length > 0 || responsaveis.length > 0;

  const limparFiltros = (): void => {
    setBusca('');
    setKpi('todas');
    setEmpreendimentos([]);
    setResponsaveis([]);
    setMarcadas([]);
  };

  // Trocar de KPI reseta a seleção: as linhas marcadas saem de vista.
  const mudarKpi = (k: Kpi): void => {
    setKpi((atual) => (atual === k ? 'todas' : k));
    setMarcadas([]);
  };

  const ordenar = (campo: Campo): void =>
    setOrdem((o) =>
      o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'asc' },
    );

  const idsVisiveis = filtradas.map((e) => e.entrega.id);
  const todasMarcadas = idsVisiveis.length > 0 && idsVisiveis.every((id) => marcadas.includes(id));
  const algumaMarcada = marcadas.length > 0;

  const alternarTodas = (): void => setMarcadas(todasMarcadas ? [] : idsVisiveis);
  const alternarUma = (id: string): void =>
    setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const exportar = (): void => {
    const sel = filtradas.filter((e) => marcadas.includes(e.entrega.id));
    baixarCsv(`entregas-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Cliente', 'Unidade', 'Empreendimento', 'Responsável', 'Iniciada em', 'Etapa'],
      ...sel.map(({ entrega, unidade, empreendimento, cliente, responsavel }) => [
        cliente?.nome ?? '',
        unidade?.identificacao ?? '',
        empreendimento?.nome ?? '',
        responsavel?.nome ?? '',
        fData(entrega.iniciadaEm),
        ENTREGA_STATUS_META[entrega.status].label,
      ]),
    ]);
  };

  return (
    <>
      <PageHeader
        icon={PackageCheck}
        titulo="Entregas"
        subtitulo="Acompanhe cada entrega pela máquina de estados"
      />
      <PageContent>
        <div className="flex flex-col gap-6">
          {/* KPIs — cada um filtra por etapa da máquina de estados. */}
          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <button
                type="button"
                onClick={() => mudarKpi('todas')}
                aria-pressed={kpi === 'todas'}
                title="Todas as entregas registradas"
                className={cn(
                  'flex items-baseline gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-[background-color] duration-150 hover:bg-slate-50',
                  kpi === 'todas' && RESUMO_SELECIONADO,
                )}
              >
                {carregando ? (
                  <Skeleton className="h-[30px] w-12" />
                ) : (
                  <span className="text-[30px] font-bold leading-none tabular-nums text-foreground">
                    {n0(total)}
                  </span>
                )}
                <span className="text-[13px] font-medium text-muted-foreground">
                  entregas · todas as etapas
                </span>
              </button>
              <span className="text-xs text-muted-foreground">% do total de entregas</span>
            </div>

            <div className="flex h-2 w-full gap-0.5 rounded-full bg-muted">
              {ENTREGA_STATUS.filter((s) => porEtapa[s] > 0).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={KPI_LABEL[s]}
                  title={KPI_LABEL[s]}
                  onClick={() => mudarKpi(s)}
                  onMouseEnter={() => setDestaque(s)}
                  onMouseLeave={() => setDestaque(null)}
                  className={cn(
                    '-my-1 box-content bg-clip-content py-1 transition-opacity duration-150 first:rounded-l-full last:rounded-r-full',
                    kpi !== 'todas' && kpi !== s && 'opacity-25',
                  )}
                  style={{
                    width: `${(porEtapa[s] / total) * 100}%`,
                    backgroundColor: ENTREGA_STATUS_META[s].color,
                  }}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1 min-[420px]:grid-cols-3 min-[720px]:grid-cols-6">
              {ENTREGA_STATUS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => mudarKpi(s)}
                  aria-pressed={kpi === s}
                  title={`Entregas na etapa ${ENTREGA_STATUS_META[s].label}`}
                  className={cn(
                    'flex min-w-0 flex-col gap-1 rounded-[10px] px-2.5 py-2 text-left transition-[opacity,background-color] duration-150 hover:bg-slate-50',
                    kpi === s && RESUMO_SELECIONADO,
                    kpi !== 'todas' && kpi !== s && 'opacity-[0.45]',
                    destaque === s && 'bg-slate-50 opacity-100 ring-1 ring-border',
                  )}
                >
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-600">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: ENTREGA_STATUS_META[s].color }}
                    />
                    {KPI_LABEL[s]}
                  </span>
                  <span className="flex items-baseline gap-1.5 tabular-nums">
                    {carregando ? (
                      <Skeleton className="h-7 w-8" />
                    ) : (
                      <span className="text-xl font-bold text-foreground">{n0(porEtapa[s])}</span>
                    )}
                    <span
                      className="text-xs font-semibold"
                      style={{ color: s === 'CONCLUIDA' ? '#15803d' : '#64748b' }}
                    >
                      {pct1(porEtapa[s], total || 1)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Busca + filtros, na mesma linha */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="max-w-[520px] flex-[1_1_280px]">
              <SearchInput
                value={busca}
                onChange={setBusca}
                placeholder="Buscar por cliente, unidade, empreendimento..."
              />
            </div>
            <FiltroDropdown
              multi
              icon={Building2}
              label="Empreendimento"
              resumoVazio="Todos"
              valor={empreendimentos}
              onChange={setEmpreendimentos}
              opcoes={state.empreendimentos.map((e) => ({
                valor: e.id,
                label: e.nome,
                qtd: facetas.empreendimento[e.id] ?? 0,
              }))}
            />
            <FiltroDropdown
              multi
              icon={User}
              label="Responsável"
              resumoVazio="Todos"
              valor={responsaveis}
              onChange={setResponsaveis}
              opcoes={state.usuarios.map((u) => ({
                valor: u.id,
                label: u.nome,
                qtd: facetas.responsavel[u.id] ?? 0,
              }))}
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
              {n0(filtradas.length)} de {n0(total)} entregas
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Barra de seleção em massa */}
            {algumaMarcada && (
              <div className="flex h-11 flex-wrap items-center gap-3 border-b border-[#fde7bd] bg-[#fff7e8] px-4 dark:border-primary/30 dark:bg-primary/10">
                <span className="text-sm font-semibold text-foreground">
                  {n0(marcadas.length)} {marcadas.length === 1 ? 'entrega' : 'entregas'} selecionada
                  {marcadas.length === 1 ? '' : 's'}
                </span>
                <Button variant="outline" size="sm" className="ml-auto h-[30px]" onClick={exportar}>
                  <Download />
                  Exportar
                </Button>
                <button
                  type="button"
                  onClick={() => setMarcadas([])}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Limpar seleção
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <div
                  className={cn(
                    GRID_TABELA,
                    'h-11 bg-muted text-sm text-slate-600 dark:text-muted-foreground',
                  )}
                >
                  <Marcador
                    checked={todasMarcadas}
                    indeterminate={algumaMarcada}
                    onChange={alternarTodas}
                    label="Selecionar todas as entregas visíveis"
                  />
                  <CabecalhoOrdenavel
                    label="Cliente"
                    campo="cliente"
                    ordem={ordem}
                    onOrdenar={ordenar}
                  />
                  <CabecalhoOrdenavel
                    label="Unidade"
                    campo="unidade"
                    ordem={ordem}
                    onOrdenar={ordenar}
                  />
                  <CabecalhoOrdenavel
                    label="Responsável"
                    campo="responsavel"
                    ordem={ordem}
                    onOrdenar={ordenar}
                  />
                  <CabecalhoOrdenavel
                    label="Iniciada"
                    campo="iniciada"
                    ordem={ordem}
                    onOrdenar={ordenar}
                  />
                  <CabecalhoOrdenavel
                    label="Etapa"
                    campo="status"
                    ordem={ordem}
                    onOrdenar={ordenar}
                  />
                  <span />
                </div>

                {filtradas.map(({ entrega, unidade, empreendimento, cliente, responsavel }, i) => {
                  const marcada = marcadas.includes(entrega.id);
                  return (
                    <div
                      key={entrega.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/entregas/${entrega.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/entregas/${entrega.id}`);
                        }
                      }}
                      className={cn(
                        GRID_TABELA,
                        'cursor-pointer border-t border-border py-3 text-sm transition-colors hover:bg-[#fff7e8] dark:hover:bg-primary/10',
                        marcada
                          ? 'bg-[#fffbf2] dark:bg-primary/5'
                          : i % 2 === 1
                            ? 'bg-muted/50'
                            : 'bg-card',
                      )}
                    >
                      {/* O clique no checkbox não pode abrir a entrega. */}
                      <span onClick={(e) => e.stopPropagation()}>
                        <Marcador
                          checked={marcada}
                          onChange={() => alternarUma(entrega.id)}
                          label={`Selecionar entrega de ${cliente?.nome ?? 'cliente'}`}
                        />
                      </span>
                      <span className="font-medium text-foreground [overflow-wrap:anywhere]">
                        {cliente?.nome ?? <span className="text-slate-400">Sem cliente</span>}
                      </span>
                      <span className="[overflow-wrap:anywhere]">
                        <span className="block font-semibold text-[#b36f00] dark:text-primary">
                          {unidade?.identificacao ?? '-'}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {empreendimento?.nome}
                        </span>
                      </span>
                      <span className="text-muted-foreground [overflow-wrap:anywhere]">
                        {responsavel?.nome ?? '-'}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {fData(entrega.iniciadaEm)}
                      </span>
                      <span>
                        <EntregaStatusBadge status={entrega.status} />
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  );
                })}
                {carregando &&
                  Array.from({ length: 6 }, (_, i) => (
                    <div
                      key={i}
                      aria-busy="true"
                      className={cn(GRID_TABELA, 'border-t border-border py-3')}
                    >
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-3/4" />
                      <span className="flex flex-col gap-1.5">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-3 w-2/3" />
                      </span>
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <span />
                    </div>
                  ))}
              </div>
            </div>

            {!carregando &&
              filtradas.length === 0 &&
              (filtrosAtivos ? (
                <EmptyState
                  icon={Search}
                  titulo="Nenhuma entrega encontrada"
                  descricao="Ajuste a busca ou os filtros."
                />
              ) : (
                <EmptyState
                  icon={PackageCheck}
                  titulo="Nenhuma entrega encontrada"
                  descricao="Inicie uma entrega a partir de uma unidade liberada."
                />
              ))}
          </div>
        </div>
      </PageContent>
    </>
  );
}
