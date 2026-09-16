import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Headset,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  adapters,
  type ChamadoAssistencia,
  type FaseChamado,
  type FiltroChamados,
  type PaginaChamados,
} from '@/adapters';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
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
import {
  ChamadoSituacaoBadge,
  SlaVencidoBadge,
} from '@/components/assistencia/ChamadoSituacaoBadge';
import { ChamadoDetalheDialog } from '@/components/assistencia/ChamadoDetalheDialog';
import { FASE_META } from '@/components/assistencia/fase';
import { fData, fDataHora } from '@chaves/domain/format';
import { cn } from '@/lib/utils';

const TODOS = '__todos__';
const POR_PAGINA = 25;
const FASES: FaseChamado[] = ['nova', 'andamento', 'improcedente', 'finalizado'];

type FiltroFase = FaseChamado | 'abertos' | typeof TODOS;

const fNum = (n: number): string => n.toLocaleString('pt-BR');

/** Atalho de fase: contagem + seleção (como o topo da tela do CV). */
function FaseCard({
  label,
  qtd,
  ativo,
  onClick,
  classeMarca,
}: {
  label: string;
  qtd: number | null;
  ativo: boolean;
  onClick: () => void;
  classeMarca: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'flex flex-col items-start rounded-xl border bg-card p-4 text-left transition-colors',
        ativo ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-muted/40',
      )}
    >
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn('h-2 w-2 rounded-full', classeMarca)} />
        {label}
      </span>
      <span className="mt-1 text-2xl font-bold leading-none text-foreground">
        {qtd === null ? '-' : fNum(qtd)}
      </span>
    </button>
  );
}

export function Chamados(): React.JSX.Element {
  const [dados, setDados] = useState<PaginaChamados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [fase, setFase] = useState<FiltroFase>('abertos');
  const [situacaoId, setSituacaoId] = useState<string>(TODOS);
  const [empreendimentoId, setEmpreendimentoId] = useState<string>(TODOS);
  const [pagina, setPagina] = useState(1);
  const [selecionado, setSelecionado] = useState<ChamadoAssistencia | null>(null);

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
      setCarregando(true);
      setErro(null);
      const filtro: FiltroChamados & { atualizar?: boolean } = { pagina, porPagina: POR_PAGINA };
      if (fase !== TODOS) filtro.fase = fase;
      if (situacaoId !== TODOS) filtro.situacaoId = situacaoId;
      if (empreendimentoId !== TODOS) filtro.empreendimentoId = empreendimentoId;
      if (buscaAplicada) filtro.busca = buscaAplicada;
      if (atualizar) filtro.atualizar = true;
      try {
        const r = await adapters.assistencia.listarChamados(filtro);
        if (id === requisicao.current) setDados(r);
      } catch (e) {
        if (id === requisicao.current) {
          setErro(e instanceof Error ? e.message : 'Falha ao carregar os chamados.');
        }
      } finally {
        if (id === requisicao.current) setCarregando(false);
      }
    },
    [pagina, fase, situacaoId, empreendimentoId, buscaAplicada],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const mudarFase = (nova: FiltroFase): void => {
    setFase(nova);
    setSituacaoId(TODOS);
    setPagina(1);
  };

  const porFase = dados?.porFase ?? null;
  const totalAbertos = porFase ? porFase.nova + porFase.andamento : null;
  const totalGeral = porFase ? FASES.reduce((s, f) => s + porFase[f], 0) : null;
  const primeiro = dados && dados.total > 0 ? (dados.pagina - 1) * dados.porPagina + 1 : 0;
  const ultimo = dados ? Math.min(dados.pagina * dados.porPagina, dados.total) : 0;

  return (
    <>
      <PageHeader
        icon={Headset}
        titulo="Chamados"
        subtitulo={
          dados
            ? `Assistência técnica · CV CRM · lido em ${fDataHora(dados.atualizadoEm)}`
            : 'Assistência técnica · CV CRM'
        }
        actions={
          <Button variant="outline" onClick={() => void carregar(true)} disabled={carregando}>
            <RefreshCw className={carregando ? 'animate-spin' : undefined} />
            Atualizar
          </Button>
        }
      />
      <PageContent>
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <FaseCard
            label="Todas"
            qtd={totalGeral}
            ativo={fase === TODOS}
            onClick={() => mudarFase(TODOS)}
            classeMarca="bg-foreground/40"
          />
          <FaseCard
            label="Em aberto"
            qtd={totalAbertos}
            ativo={fase === 'abertos'}
            onClick={() => mudarFase('abertos')}
            classeMarca="bg-destructive"
          />
          {FASES.map((f) => (
            <FaseCard
              key={f}
              label={FASE_META[f].label}
              qtd={porFase ? porFase[f] : null}
              ativo={fase === f}
              onClick={() => mudarFase(f)}
              classeMarca={FASE_META[f].classe.split(' ').find((c) => c.startsWith('bg-')) ?? ''}
            />
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="lg:min-w-[260px] lg:max-w-sm lg:flex-1">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por protocolo, cliente, unidade..."
            />
          </div>
          <Select
            value={situacaoId}
            onValueChange={(v) => {
              setSituacaoId(v);
              setPagina(1);
            }}
          >
            <SelectTrigger className="lg:w-72">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas as situações</SelectItem>
              {dados?.porSituacao
                .filter((s): s is typeof s & { id: string } => s.id !== null)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.etapa !== null && `${String(s.etapa).padStart(2, '0')} · `}
                    {s.nome} ({fNum(s.qtd)})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select
            value={empreendimentoId}
            onValueChange={(v) => {
              setEmpreendimentoId(v);
              setPagina(1);
            }}
          >
            <SelectTrigger className="lg:w-64">
              <SelectValue placeholder="Empreendimento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os empreendimentos</SelectItem>
              {dados?.empreendimentos.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
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
            <div className="space-y-3 p-4">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Lendo os chamados do CV CRM. A primeira carga pode levar alguns segundos.
              </p>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className={cn('transition-opacity', carregando && 'opacity-60')}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Protocolo</th>
                      <th className="px-4 py-3 text-left font-medium">Abertura</th>
                      <th className="px-4 py-3 text-left font-medium">Local</th>
                      <th className="px-4 py-3 text-left font-medium">Solicitação</th>
                      <th className="px-4 py-3 text-left font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.itens.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelecionado(c)}
                        className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                          {c.protocolo ?? `#${c.id}`}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {fData(c.abertoEm)}
                        </td>
                        <td className="max-w-[240px] px-4 py-3 text-muted-foreground">
                          <span className="block truncate text-foreground">
                            {c.unidade
                              ? [c.bloco, c.unidade.nome].filter(Boolean).join(' · ')
                              : (c.areaComum ?? 'Área comum')}
                          </span>
                          <span className="block truncate text-xs">{c.empreendimento?.nome}</span>
                        </td>
                        <td className="max-w-[320px] px-4 py-3 text-muted-foreground">
                          <span className="block truncate text-foreground">
                            {c.descricao || '-'}
                          </span>
                          <span className="block truncate text-xs">
                            {c.cliente?.nome ?? c.sindico ?? '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <ChamadoSituacaoBadge chamado={c} />
                            {c.slaVencido && <SlaVencidoBadge />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dados.total === 0 ? (
                <EmptyState
                  icon={Headset}
                  titulo="Nenhum chamado encontrado"
                  descricao="Ajuste a busca ou os filtros para ver outros chamados."
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  <span>
                    {fNum(primeiro)}–{fNum(ultimo)} de {fNum(dados.total)} chamados
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
                      Página {fNum(dados.pagina)} de {fNum(dados.totalPaginas)}
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
      </PageContent>

      <ChamadoDetalheDialog
        chamado={selecionado}
        onOpenChange={(open) => !open && setSelecionado(null)}
      />
    </>
  );
}
