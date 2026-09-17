import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  Eraser,
  FileDown,
  Loader2,
  MinusCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type InspecaoFvs,
  type ItemModeloFvs,
  type NaoConformidade,
  type ResultadoItem,
  InspecaoIncompletaError,
  RESULTADO_ITEM_CURTO,
  concluirInspecao,
  criarReinspecao,
  descreverLocal,
  itensDaInspecao,
  marcarRestantesConformes,
  pendenciasParaConcluir,
  progressoInspecao,
} from '@chaves/domain/qualidade';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusSincronizacao } from '@/components/qualidade/StatusSincronizacao';
import { FotoMiniatura } from '@/components/qualidade/FotoMiniatura';
import { InspecaoStatusBadge, NcStatusBadge } from '@/components/qualidade/badges';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SignatureCanvas, type SignatureCanvasHandle } from '@/components/portal/SignatureCanvas';
import { agoraIso, novoId, useQualidade } from '@/qualidade/QualidadeProvider';
import { comprimirImagem } from '@/qualidade/imagem';
import { gerarPdfInspecao, nomeArquivoPdf } from '@/qualidade/pdf';
import { fData, fDataHora } from '@chaves/domain/format';
import { cn } from '@/lib/utils';

type Filtro = 'todos' | 'pendentes' | 'nc';

const BOTOES: { valor: ResultadoItem; label: string; icone: typeof CheckCircle2; ativo: string }[] =
  [
    {
      valor: 'C',
      label: RESULTADO_ITEM_CURTO.C,
      icone: CheckCircle2,
      ativo: 'border-success bg-success text-success-foreground',
    },
    {
      valor: 'NC',
      label: RESULTADO_ITEM_CURTO.NC,
      icone: XCircle,
      ativo: 'border-destructive bg-destructive text-destructive-foreground',
    },
    {
      valor: 'NA',
      label: RESULTADO_ITEM_CURTO.NA,
      icone: MinusCircle,
      ativo: 'border-foreground/40 bg-muted-foreground text-white',
    },
  ];

const classeTextarea =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function InspecaoExecucao(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { repo, usuario } = useQualidade();

  const [insp, setInsp] = useState<InspecaoFvs | null>(null);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [ncs, setNcs] = useState<NaoConformidade[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [destaque, setDestaque] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [fotoEmItem, setFotoEmItem] = useState<string | null>(null);
  const [temTraco, setTemTraco] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const canvasRef = useRef<SignatureCanvasHandle>(null);

  // Gravações em série: cada toque salva no IndexedDB sem atropelar o anterior.
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const inspRef = useRef<InspecaoFvs | null>(null);

  const carregarNcs = useCallback(
    async (i: InspecaoFvs) => {
      if (!repo) return;
      setNcs(await repo.ncsDaInspecao(i.reinspecaoDe ?? i.id));
    },
    [repo],
  );

  useEffect(() => {
    if (!repo || !id) return;
    let ativo = true;
    const carregar = async () => {
      const i = await repo.obterInspecao(id);
      if (!ativo) return;
      if (!i) {
        setNaoEncontrada(true);
        return;
      }
      // Não sobrescreve a edição em curso com o eco da própria gravação.
      if (!inspRef.current || inspRef.current.atualizadoEm <= i.atualizadoEm) {
        inspRef.current = i;
        setInsp(i);
      }
      await carregarNcs(i);
    };
    void carregar();
    const cancelar = repo.assinar(() => void carregar());
    return () => {
      ativo = false;
      cancelar();
    };
  }, [repo, id, carregarNcs]);

  const aplicar = useCallback(
    (mudar: (atual: InspecaoFvs) => InspecaoFvs) => {
      const atual = inspRef.current;
      if (!atual || !repo || atual.status === 'concluida') return;
      const nova = { ...mudar(atual), atualizadoEm: agoraIso() };
      inspRef.current = nova;
      setInsp(nova);
      fila.current = fila.current.then(() =>
        repo.salvarInspecao(nova).catch((e: unknown) =>
          toast.error('Falha ao salvar no aparelho', {
            description: e instanceof Error ? e.message : String(e),
          }),
        ),
      );
    },
    [repo],
  );

  const responder = (item: ItemModeloFvs, resultado: ResultadoItem) =>
    aplicar((i) => {
      const anterior = i.respostas[item.id];
      return {
        ...i,
        respostas: {
          ...i.respostas,
          [item.id]: {
            itemId: item.id,
            resultado,
            observacao: anterior?.observacao ?? null,
            respondidoEm: agoraIso(),
          },
        },
      };
    });

  const observar = (item: ItemModeloFvs, observacao: string) =>
    aplicar((i) => {
      const r = i.respostas[item.id];
      if (!r) return i;
      return {
        ...i,
        respostas: { ...i.respostas, [item.id]: { ...r, observacao: observacao || null } },
      };
    });

  async function anexarFoto(item: ItemModeloFvs, arquivo: File) {
    if (!repo || !inspRef.current) return;
    setFotoEmItem(item.id);
    try {
      await fila.current;
      const blob = await comprimirImagem(arquivo);
      const atualizada = await repo.adicionarFoto(
        inspRef.current,
        item.id,
        blob,
        novoId(),
        agoraIso(),
      );
      inspRef.current = atualizada;
      setInsp(atualizada);
    } catch (e) {
      toast.error('Não foi possível salvar a foto', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setFotoEmItem(null);
    }
  }

  async function removerFoto(fotoId: string) {
    if (!repo || !inspRef.current) return;
    try {
      await fila.current;
      const atualizada = await repo.removerFoto(inspRef.current, fotoId, agoraIso());
      inspRef.current = atualizada;
      setInsp(atualizada);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível remover a foto');
    }
  }

  function irParaPendencia() {
    const i = inspRef.current;
    if (!i) return;
    const [primeira] = pendenciasParaConcluir(i);
    if (!primeira) return;
    if (primeira.itemId === null) {
      toast.info(primeira.itemTexto);
      return;
    }
    setFiltro('todos');
    setDestaque(primeira.itemId);
    requestAnimationFrame(() =>
      document
        .getElementById(`item-${primeira.itemId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
    setTimeout(() => setDestaque(null), 2500);
  }

  async function concluir() {
    const i = inspRef.current;
    if (!repo || !i) return;
    setConcluindo(true);
    try {
      await fila.current;
      const png = canvasRef.current?.toDataURL();
      if (!png) {
        toast.error('Assine a ficha para concluir');
        setConcluindo(false);
        return;
      }
      const assinada: InspecaoFvs = {
        ...i,
        assinatura: { nome: usuario.nome, pngDataUrl: png, assinadaEm: agoraIso() },
      };
      const origem = i.reinspecaoDe ? await repo.ncsDaInspecao(i.reinspecaoDe) : [];
      const r = concluirInspecao(assinada, origem, agoraIso(), novoId);
      await repo.salvarInspecaoComNcs(r.inspecao, [...r.novasNcs, ...r.ncsAtualizadas]);
      inspRef.current = r.inspecao;
      setInsp(r.inspecao);
      setConfirmar(false);
      if (i.reinspecaoDe) {
        const fechadas = r.ncsAtualizadas.filter((n) => n.status === 'fechada').length;
        toast.success('Reinspeção concluída', {
          description: `${fechadas} NC(s) fechada(s), ${r.ncsAtualizadas.length - fechadas} continuam abertas.`,
        });
      } else {
        toast.success(
          r.inspecao.resultado === 'aprovada' ? 'Inspeção aprovada' : 'Inspeção reprovada',
          {
            description:
              r.novasNcs.length > 0
                ? `${r.novasNcs.length} não conformidade(s) registrada(s).`
                : undefined,
          },
        );
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      if (e instanceof InspecaoIncompletaError) {
        setConfirmar(false);
        irParaPendencia();
      } else {
        toast.error('Não foi possível concluir', {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    } finally {
      setConcluindo(false);
    }
  }

  async function baixarPdf() {
    const i = inspRef.current;
    if (!repo || !i) return;
    setGerandoPdf(true);
    try {
      const locais = await repo.fotosDaInspecao(i.id);
      const fotos = new Map<string, { bytes: Uint8Array; tipo: string }>();
      for (const f of locais) {
        if (f.blob)
          fotos.set(f.id, { bytes: new Uint8Array(await f.blob.arrayBuffer()), tipo: f.blob.type });
      }
      const bytes = await gerarPdfInspecao({ inspecao: i, emitidoPor: usuario.nome, fotos });
      // Copia para um ArrayBuffer próprio: o Blob exige isso e o tipo do pdf-lib
      // é genérico o bastante para o TS recusar a passagem direta.
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivoPdf(i);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      toast.error('Não foi possível gerar o PDF', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setGerandoPdf(false);
    }
  }

  async function reinspecionar() {
    const i = inspRef.current;
    if (!repo || !i) return;
    try {
      const nova = criarReinspecao(i, ncs, usuario, agoraIso(), novoId);
      await repo.salvarInspecao(nova);
      navigate(`/qualidade/inspecoes/${nova.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível criar a reinspeção');
    }
  }

  const itens = useMemo(() => (insp ? itensDaInspecao(insp) : []), [insp]);
  const progresso = useMemo(() => (insp ? progressoInspecao(insp) : null), [insp]);
  const pendencias = useMemo(() => (insp ? pendenciasParaConcluir(insp) : []), [insp]);

  if (naoEncontrada) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        titulo="Inspeção não encontrada"
        descricao="Ela pode ainda não ter sido sincronizada para este aparelho."
      >
        <Button variant="outline" onClick={() => navigate('/qualidade/inspecoes')}>
          <ArrowLeft />
          Voltar
        </Button>
      </EmptyState>
    );
  }
  if (!insp || !progresso) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const concluida = insp.status === 'concluida';
  const pct =
    progresso.total === 0 ? 0 : Math.round((progresso.respondidos / progresso.total) * 100);
  const ncsAbertas = ncs.filter((n) => n.status !== 'fechada');
  const idsNcDestaInspecao = new Set(
    insp.reinspecaoDe ? (insp.itensAlvo ?? []) : ncs.map((n) => n.itemId),
  );

  const secoesVisiveis = insp.estrutura.secoes
    .map((secao) => ({
      secao,
      itens: itens
        .filter((x) => x.secao.id === secao.id)
        .map((x) => x.item)
        .filter((item) => {
          const r = insp.respostas[item.id];
          if (filtro === 'pendentes') return !r || pendencias.some((p) => p.itemId === item.id);
          if (filtro === 'nc') return r?.resultado === 'NC';
          return true;
        }),
    }))
    .filter((s) => s.itens.length > 0);

  return (
    <div className="flex flex-1 flex-col">
      {/* Cabeçalho fixo com progresso */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur safe-px md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Voltar"
              onClick={() => navigate('/qualidade/inspecoes')}
            >
              <ArrowLeft />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">
                {insp.reinspecaoDe && <span className="text-primary">Reinspeção · </span>}
                {insp.modeloCodigo ? `${insp.modeloCodigo} · ` : ''}
                {insp.modeloNome}
              </p>
              <p className="truncate text-xs text-muted-foreground">{descreverLocal(insp.local)}</p>
            </div>
            <div className="hidden sm:block">
              <StatusSincronizacao />
            </div>
            <InspecaoStatusBadge inspecao={insp} />
          </div>
          {!concluida && (
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {progresso.respondidos}/{progresso.total}
                {progresso.naoConformes > 0 && (
                  <span className="text-destructive"> · {progresso.naoConformes} NC</span>
                )}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4 pb-32 safe-px md:px-8">
        {concluida && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Concluída em {fDataHora(insp.concluidaEm)} por {insp.inspetorNome}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {progresso.conformidade === null ? '—' : `${progresso.conformidade}% conforme`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {progresso.conformes} conforme(s) · {progresso.naoConformes} não conforme(s) ·{' '}
                  {progresso.naoAplicaveis} N/A
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void baixarPdf()} disabled={gerandoPdf}>
                  {gerandoPdf ? <Loader2 className="animate-spin" /> : <FileDown />}
                  Gerar PDF
                </Button>
                {ncsAbertas.length > 0 && (
                  <Button onClick={() => void reinspecionar()}>
                    <RotateCcw />
                    Reinspecionar {ncsAbertas.length} NC(s)
                  </Button>
                )}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-3 text-sm md:grid-cols-4">
              {(
                [
                  ['Identificador', insp.identificador],
                  ['Fornecedor', insp.fornecedor],
                  ['Responsável', insp.responsavel],
                  [
                    'Data do atendimento',
                    insp.dataAtendimento ? fData(`${insp.dataAtendimento}T12:00:00`) : null,
                  ],
                  ['Validade', insp.validade ? fData(`${insp.validade}T12:00:00`) : null],
                  ['Código do local', insp.local.codigo],
                  ['Revisão da ficha', `Rev${String(insp.modeloVersao).padStart(2, '0')}`],
                  [
                    'Não verificados',
                    progresso.naoVerificados > 0 ? String(progresso.naoVerificados) : null,
                  ],
                ] as const
              )
                .filter(([, valor]) => !!valor)
                .map(([rotulo, valor]) => (
                  <div key={rotulo} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                    <dd className="break-words text-foreground">{valor}</dd>
                  </div>
                ))}
            </dl>

            {insp.assinatura && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">Assinatura do inspetor</p>
                <img
                  src={insp.assinatura.pngDataUrl}
                  alt={`Assinatura de ${insp.assinatura.nome}`}
                  className="mt-1 h-16 w-auto max-w-full"
                />
                <p className="text-sm font-medium text-foreground">{insp.assinatura.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {fDataHora(insp.assinatura.assinadaEm)}
                </p>
              </div>
            )}
            {insp.reinspecaoDe && (
              <p className="mt-2 text-sm">
                <Link
                  to={`/qualidade/inspecoes/${insp.reinspecaoDe}`}
                  className="text-primary underline"
                >
                  Ver inspeção original
                </Link>
              </p>
            )}
            {ncs.filter((n) => idsNcDestaInspecao.has(n.itemId)).length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                <p className="text-sm font-semibold text-foreground">Não conformidades</p>
                {ncs
                  .filter((n) => idsNcDestaInspecao.has(n.itemId))
                  .map((n) => (
                    <Link
                      key={n.id}
                      to={`/qualidade/pendencias?nc=${n.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
                    >
                      <span className="min-w-0 truncate">{n.itemTexto}</span>
                      <NcStatusBadge status={n.status} />
                    </Link>
                  ))}
              </div>
            )}
          </div>
        )}

        {!concluida && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['todos', `Todos (${progresso.total})`],
                ['pendentes', `Pendentes (${pendencias.length})`],
                ['nc', `Não conformes (${progresso.naoConformes})`],
              ] as const
            ).map(([valor, label]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltro(valor)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm',
                  filtro === valor
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {secoesVisiveis.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {filtro === 'pendentes'
              ? 'Nenhuma pendência. Pode concluir.'
              : 'Nenhum item neste filtro.'}
          </p>
        )}

        {secoesVisiveis.map(({ secao, itens: itensSecao }) => (
          <section key={secao.id} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {secao.titulo}
            </h2>
            {itensSecao.map((item) => {
              const r = insp.respostas[item.id];
              const fotos = insp.fotos.filter((f) => f.itemId === item.id);
              const faltaFoto =
                r?.resultado === 'NC' && item.fotoObrigatoriaNc && fotos.length === 0;
              return (
                <div
                  key={item.id}
                  id={`item-${item.id}`}
                  className={cn(
                    'rounded-xl border bg-card p-4 transition-shadow',
                    r?.resultado === 'NC' ? 'border-destructive/40' : 'border-border',
                    destaque === item.id && 'ring-2 ring-primary',
                  )}
                >
                  <p className="font-medium text-foreground">{item.texto}</p>
                  {(item.criterio || item.metodo) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[item.criterio, item.metodo].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {concluida ? (
                    <p
                      className={cn(
                        'mt-2 text-sm font-medium',
                        r?.resultado === 'NC'
                          ? 'text-destructive'
                          : r?.resultado === 'C'
                            ? 'text-success'
                            : 'text-muted-foreground',
                      )}
                    >
                      {r ? BOTOES.find((b) => b.valor === r.resultado)?.label : 'Não verificado'}
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {BOTOES.map((b) => {
                        const ativo = r?.resultado === b.valor;
                        return (
                          <button
                            key={b.valor}
                            type="button"
                            onClick={() => responder(item, b.valor)}
                            aria-pressed={ativo}
                            className={cn(
                              'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 py-2 text-xs font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-sm',
                              ativo
                                ? b.ativo
                                : 'border-border bg-background text-muted-foreground active:bg-muted',
                            )}
                          >
                            <b.icone className="h-5 w-5" />
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(r?.resultado === 'NC' || r?.observacao || fotos.length > 0) && (
                    <div className="mt-3 space-y-3">
                      {concluida
                        ? r?.observacao && <p className="text-sm text-foreground">{r.observacao}</p>
                        : r && (
                            <textarea
                              defaultValue={r.observacao ?? ''}
                              onBlur={(e) => {
                                if ((r.observacao ?? '') !== e.target.value)
                                  observar(item, e.target.value);
                              }}
                              rows={2}
                              placeholder={
                                r.resultado === 'NC' ? 'Descreva a não conformidade' : 'Observação'
                              }
                              className={classeTextarea}
                            />
                          )}

                      <div className="flex flex-wrap items-center gap-2">
                        {fotos.map((f) => (
                          <FotoMiniatura
                            key={f.id}
                            fotoId={f.id}
                            storagePath={f.storagePath}
                            {...(concluida ? {} : { onRemover: () => void removerFoto(f.id) })}
                          />
                        ))}
                        {!concluida && (
                          <label
                            className={cn(
                              'flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center text-xs leading-tight',
                              faltaFoto
                                ? 'border-destructive text-destructive'
                                : 'border-border text-muted-foreground',
                            )}
                          >
                            {fotoEmItem === item.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Camera className="h-5 w-5" />
                            )}
                            {faltaFoto ? 'Foto obrigatória' : 'Foto'}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="sr-only"
                              onChange={(e) => {
                                const arquivo = e.target.files?.[0];
                                e.target.value = '';
                                if (arquivo) void anexarFoto(item, arquivo);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        {!concluida ? (
          <div className="space-y-1.5">
            <p className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Observações gerais
            </p>
            <textarea
              defaultValue={insp.observacoes ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== insp.observacoes) aplicar((i) => ({ ...i, observacoes: v }));
              }}
              rows={3}
              className={classeTextarea}
            />
          </div>
        ) : (
          insp.observacoes && (
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="mb-1 font-semibold">Observações gerais</p>
              <p className="whitespace-pre-line">{insp.observacoes}</p>
            </div>
          )
        )}
      </div>

      {/* Barra de ações fixa (polegar) */}
      {!concluida && (
        <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur safe-px md:px-8">
          <div
            className="mx-auto flex max-w-3xl gap-2"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <Button
              variant="outline"
              className="flex-1"
              disabled={progresso.respondidos === progresso.total}
              onClick={() => aplicar((i) => marcarRestantesConformes(i, agoraIso()))}
            >
              <CheckCheck />
              <span className="truncate">Restantes conformes</span>
            </Button>
            <Button
              className="flex-1"
              onClick={() => (pendencias.length > 0 ? irParaPendencia() : setConfirmar(true))}
            >
              <ClipboardCheck />
              {pendencias.length > 0 ? `${pendencias.length} pendente(s)` : 'Concluir e assinar'}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir {insp.reinspecaoDe ? 'reinspeção' : 'inspeção'}?</DialogTitle>
            <DialogDescription>
              Depois de concluída, a ficha não pode mais ser editada.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p>
              <strong>{progresso.conformes}</strong> conforme(s),{' '}
              <strong className={progresso.naoConformes > 0 ? 'text-destructive' : undefined}>
                {progresso.naoConformes}
              </strong>{' '}
              não conforme(s), <strong>{progresso.naoAplicaveis}</strong> N/A.
            </p>
            {progresso.naoVerificados > 0 && (
              <p className="mt-1">
                {progresso.naoVerificados} item(ns) ficam registrados como{' '}
                <strong>não verificados</strong>.
              </p>
            )}
            <p className="mt-1 text-muted-foreground">
              {insp.reinspecaoDe
                ? 'Itens conformes fecham as não conformidades; os que continuarem reprovados reabrem.'
                : progresso.naoConformes > 0
                  ? `Serão abertas ${progresso.naoConformes} não conformidade(s) em Pendências.`
                  : 'A inspeção será aprovada.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Assinatura de {usuario.nome}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  canvasRef.current?.clear();
                  setTemTraco(false);
                }}
              >
                <Eraser />
                Limpar
              </Button>
            </div>
            <SignatureCanvas
              ref={canvasRef}
              onInkChange={setTemTraco}
              className="h-36 w-full touch-none rounded-lg border-2 border-dashed border-border bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Assine com o dedo ou a caneta. A assinatura entra no PDF da ficha.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)}>
              Voltar
            </Button>
            <Button onClick={() => void concluir()} disabled={concluindo || !temTraco}>
              {concluindo ? <Loader2 className="animate-spin" /> : <ClipboardCheck />}
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
