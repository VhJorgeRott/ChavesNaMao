import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ListChecks, Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  type InspecaoFvs,
  type NaoConformidade,
  type StatusNc,
  STATUS_NC,
  STATUS_NC_LABEL,
  criarReinspecao,
  descreverLocal,
  ncVencida,
} from '@chaves/domain/qualidade';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusSincronizacao } from '@/components/qualidade/StatusSincronizacao';
import { NcStatusBadge } from '@/components/qualidade/badges';
import { FotoMiniatura } from '@/components/qualidade/FotoMiniatura';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  agoraIso,
  novoId,
  useConsultaQualidade,
  useQualidade,
} from '@/qualidade/QualidadeProvider';
import { fData } from '@chaves/domain/format';
import { cn, normalizarBusca } from '@/lib/utils';

const TODOS = '__todos__';
type FiltroStatus = StatusNc | 'abertas' | typeof TODOS;

/** Status que a equipe define à mão. "Fechada" só por reinspeção. */
const STATUS_EDITAVEIS: StatusNc[] = ['aberta', 'em_correcao', 'aguardando_reinspecao'];

function hojeLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Pendencias(): React.JSX.Element {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { repo, usuario } = useQualidade();

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatus>('abertas');
  const [empreendimento, setEmpreendimento] = useState(TODOS);
  const [soVencidas, setSoVencidas] = useState(false);

  const { dados, carregando } = useConsultaQualidade(
    async (r) => ({ ncs: await r.listarNcs(), inspecoes: await r.listarInspecoes() }),
    [],
  );
  const ncs = useMemo(() => dados?.ncs ?? [], [dados]);
  const inspecoesPorId = useMemo(
    () => new Map((dados?.inspecoes ?? []).map((i) => [i.id, i])),
    [dados],
  );
  const hoje = hojeLocal();

  const selecionada = ncs.find((n) => n.id === params.get('nc')) ?? null;
  const abrir = (nc: NaoConformidade | null) =>
    setParams(nc ? { nc: nc.id } : {}, { replace: true });

  const contagem = useMemo(() => {
    const c: Record<string, number> = { [TODOS]: ncs.length, abertas: 0 };
    for (const n of ncs) {
      c[n.status] = (c[n.status] ?? 0) + 1;
      if (n.status !== 'fechada') c.abertas! += 1;
    }
    return c;
  }, [ncs]);
  const vencidas = ncs.filter((n) => ncVencida(n, hoje)).length;

  const empreendimentos = useMemo(
    () =>
      [...new Map(ncs.map((n) => [n.local.empreendimentoRef, n.local.empreendimentoNome]))]
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [ncs],
  );

  const filtradas = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    return ncs
      .filter((n) =>
        status === TODOS
          ? true
          : status === 'abertas'
            ? n.status !== 'fechada'
            : n.status === status,
      )
      .filter((n) => empreendimento === TODOS || n.local.empreendimentoRef === empreendimento)
      .filter((n) => !soVencidas || ncVencida(n, hoje))
      .filter(
        (n) =>
          !q ||
          [n.itemTexto, n.modeloNome, n.descricao, n.responsavel, descreverLocal(n.local)].some(
            (c) => normalizarBusca(c).includes(q),
          ),
      )
      .sort(
        (a, b) =>
          Number(ncVencida(b, hoje)) - Number(ncVencida(a, hoje)) ||
          (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999') ||
          b.abertaEm.localeCompare(a.abertaEm),
      );
  }, [ncs, busca, status, empreendimento, soVencidas, hoje]);

  const FILTROS: { valor: FiltroStatus; label: string }[] = [
    { valor: 'abertas', label: 'Abertas' },
    ...STATUS_NC.map((s) => ({ valor: s, label: STATUS_NC_LABEL[s] })),
    { valor: TODOS, label: 'Todas' },
  ];

  async function reinspecionar(nc: NaoConformidade) {
    const origem = inspecoesPorId.get(nc.inspecaoId);
    if (!repo || !origem) {
      toast.error('Inspeção de origem não está neste aparelho');
      return;
    }
    try {
      const todasDaOrigem = await repo.ncsDaInspecao(origem.id);
      const nova = criarReinspecao(origem, todasDaOrigem, usuario, agoraIso(), novoId);
      await repo.salvarInspecao(nova);
      navigate(`/qualidade/inspecoes/${nova.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível criar a reinspeção');
    }
  }

  return (
    <>
      <PageHeader
        icon={ListChecks}
        titulo="Pendências"
        subtitulo="Não conformidades abertas nas inspeções"
        actions={<StatusSincronizacao />}
      />
      <PageContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              onClick={() => setStatus(f.valor)}
              aria-pressed={status === f.valor}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                status === f.valor
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
              )}
            >
              {f.label} <span className="ml-1 opacity-70">{contagem[f.valor] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="md:max-w-sm md:flex-1">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar item, local, responsável..."
            />
          </div>
          <Select value={empreendimento} onValueChange={setEmpreendimento}>
            <SelectTrigger className="md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os empreendimentos</SelectItem>
              {empreendimentos.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={soVencidas} onChange={(e) => setSoVencidas(e.target.checked)} />
            Só vencidas
            {vencidas > 0 && <span className="font-semibold text-destructive">({vencidas})</span>}
          </label>
        </div>

        {carregando ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={ListChecks}
                titulo={ncs.length === 0 ? 'Nenhuma não conformidade' : 'Nada neste filtro'}
                descricao={
                  ncs.length === 0
                    ? 'Itens marcados como "Não conforme" nas inspeções aparecem aqui ao concluir a ficha.'
                    : 'Ajuste a busca ou os filtros.'
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtradas.map((n) => {
              const vencida = ncVencida(n, hoje);
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => abrir(n)}
                  className={cn(
                    'flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 md:flex-row md:items-center md:gap-4',
                    vencida ? 'border-destructive/50' : 'border-border',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{n.itemTexto}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {descreverLocal(n.local)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n.modeloNome} · {n.secaoTitulo}
                      {n.descricao && ` · ${n.descricao}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:w-80 md:justify-end">
                    <span
                      className={cn(
                        'flex items-center gap-1 text-xs',
                        vencida ? 'font-semibold text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {vencida ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <CalendarClock className="h-3.5 w-3.5" />
                      )}
                      {n.prazo ? fData(`${n.prazo}T12:00:00`) : 'Sem prazo'}
                    </span>
                    <span className="max-w-32 truncate text-xs text-muted-foreground">
                      {n.responsavel ?? 'Sem responsável'}
                    </span>
                    <NcStatusBadge status={n.status} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PageContent>

      <NcDialog
        nc={selecionada}
        inspecao={selecionada ? (inspecoesPorId.get(selecionada.inspecaoId) ?? null) : null}
        onFechar={() => abrir(null)}
        onReinspecionar={(nc) => void reinspecionar(nc)}
      />
    </>
  );
}

function NcDialog({
  nc,
  inspecao,
  onFechar,
  onReinspecionar,
}: {
  nc: NaoConformidade | null;
  inspecao: InspecaoFvs | null;
  onFechar: () => void;
  onReinspecionar: (nc: NaoConformidade) => void;
}): React.JSX.Element {
  const { repo } = useQualidade();
  const [responsavel, setResponsavel] = useState('');
  const [prazo, setPrazo] = useState('');
  const [status, setStatus] = useState<StatusNc>('aberta');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!nc) return;
    setResponsavel(nc.responsavel ?? '');
    setPrazo(nc.prazo ?? '');
    setStatus(nc.status);
  }, [nc]);

  async function salvar() {
    if (!repo || !nc) return;
    setSalvando(true);
    try {
      await repo.salvarNc({
        ...nc,
        responsavel: responsavel.trim() || null,
        prazo: prazo || null,
        status,
        atualizadoEm: agoraIso(),
      });
      toast.success('Pendência atualizada');
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  const fotosOrigem = inspecao?.fotos.filter((f) => nc && f.itemId === nc.itemId) ?? [];
  const fechada = nc?.status === 'fechada';

  return (
    <Dialog open={nc !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {nc && (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3 pr-6">
                <DialogTitle>{nc.itemTexto}</DialogTitle>
                <NcStatusBadge status={nc.status} />
              </div>
              <DialogDescription>{descreverLocal(nc.local)}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  {nc.modeloNome} · {nc.secaoTitulo} · aberta em {fData(nc.abertaEm)}
                </p>
                <p className="mt-1 text-foreground">{nc.descricao ?? 'Sem descrição.'}</p>
                {fotosOrigem.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fotosOrigem.map((f) => (
                      <FotoMiniatura key={f.id} fotoId={f.id} storagePath={f.storagePath} />
                    ))}
                  </div>
                )}
                {nc.reinspecoes.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reinspecionada {nc.reinspecoes.length} vez(es)
                    {fechada && nc.fechadaEm && ` · fechada em ${fData(nc.fechadaEm)}`}
                  </p>
                )}
              </div>

              {!fechada && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="responsavel">Responsável pela correção</Label>
                    <Input
                      id="responsavel"
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      placeholder="Empreiteiro ou equipe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prazo">Prazo</Label>
                    <Input
                      id="prazo"
                      type="date"
                      value={prazo}
                      onChange={(e) => setPrazo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as StatusNc)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_EDITAVEIS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_NC_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    A pendência é fechada pela reinspeção, quando o item for verificado como
                    conforme.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {inspecao && (
                <Button variant="ghost" asChild>
                  <Link to={`/qualidade/inspecoes/${inspecao.id}`}>Ver inspeção</Link>
                </Button>
              )}
              {!fechada && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onReinspecionar(nc)}
                    disabled={!inspecao}
                  >
                    <RotateCcw />
                    Reinspecionar
                  </Button>
                  <Button onClick={() => void salvar()} disabled={salvando}>
                    {salvando ? <Loader2 className="animate-spin" /> : <Save />}
                    Salvar
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
