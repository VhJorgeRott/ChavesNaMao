import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleCheckBig,
  Eye,
  Loader2,
  Plus,
  Save,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { adapters } from '@/adapters';
import type { SituacaoFinanceira } from '@/adapters/types';
import { useData } from '@/data/DataProvider';
import { useSession } from '@/auth/SessionProvider';
import {
  CATALOGO_VARIAVEIS,
  renderTermo,
  variaveisInvalidas,
  type TermoContexto,
} from '@chaves/domain/termo';
import {
  MODALIDADES_MODELO,
  TIPOS_MODELO,
  type Cliente,
  type ModalidadeModelo,
  type TipoModelo,
} from '@chaves/domain/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CabecalhoSkeleton } from '@/components/shared/skeletons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { chaveVariavel, partesTermo } from '@/lib/modelos';
import { cn } from '@/lib/utils';

/** Rótulo de cada variável do catálogo ("cliente.nome" → "Nome"). */
const LABELS: Record<string, string> = Object.fromEntries(
  CATALOGO_VARIAVEIS.flatMap((g) => g.itens.map((v) => [v.chave, v.label])),
);

/** Trigger dos dropdowns do formulário (padrão da barra de filtros: 40px, rounded-[10px]). */
const TRIGGER = 'h-10 rounded-[10px] border-border bg-card shadow-none hover:border-slate-300';

/** Mesma fonte/medidas no backdrop e no textarea — senão o cursor desalinha do texto. */
const EDITOR_TEXTO =
  'm-0 box-border px-4 py-3.5 font-mono text-[13px] leading-[22px] whitespace-pre-wrap [overflow-wrap:break-word]';

const CARD = 'rounded-xl border border-border bg-card p-5 shadow-sm';

/**
 * Num refresh em /modelos/:id os modelos ainda vêm do servidor: espera por eles
 * antes de montar o editor, senão ele redirecionaria (id "inexistente") e o
 * formulário nasceria vazio.
 */
export function ModeloEditor(): React.JSX.Element {
  const { id = 'novo' } = useParams();
  const { state, carregandoPersistidos } = useData();
  if (id !== 'novo' && carregandoPersistidos && !state.modelos.some((m) => m.id === id)) {
    return <ModeloEditorSkeleton />;
  }
  return <EditorModelo key={id} />;
}

function EditorModelo(): React.JSX.Element {
  const { id = 'novo' } = useParams();
  const { state, actions } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();

  const existente = id !== 'novo' ? state.modelos.find((m) => m.id === id) : undefined;
  const ehNovo = id === 'novo';

  const [nome, setNome] = useState(existente?.nome ?? '');
  const [conteudo, setConteudo] = useState(existente?.conteudo ?? '');
  const [tipo, setTipo] = useState<TipoModelo | null>(existente?.tipo ?? null);
  const [modalidade, setModalidade] = useState<ModalidadeModelo | null>(
    existente?.modalidade ?? null,
  );
  const [buscaVar, setBuscaVar] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Redireciona se o id não existe.
  useEffect(() => {
    if (!ehNovo && !existente) navigate('/modelos', { replace: true });
  }, [ehNovo, existente, navigate]);

  const alterado =
    nome !== (existente?.nome ?? '') ||
    conteudo !== (existente?.conteudo ?? '') ||
    tipo !== (existente?.tipo ?? null) ||
    modalidade !== (existente?.modalidade ?? null);

  function descartar() {
    setNome(existente?.nome ?? '');
    setConteudo(existente?.conteudo ?? '');
    setTipo(existente?.tipo ?? null);
    setModalidade(existente?.modalidade ?? null);
  }

  // Pré-visualização: contexto resolvido (CRM + ERP) para a unidade escolhida.
  const [previewUnidadeId, setPreviewUnidadeId] = useState<string>(
    () => state.unidades[0]?.id ?? '',
  );
  const [ctx, setCtx] = useState<TermoContexto>({});
  const [salvando, setSalvando] = useState(false);

  // Depende dos objetos resolvidos, não dos arrays do catálogo: o prefetch em
  // segundo plano troca `state.unidades` a cada empreendimento que chega, e isso
  // refazia as chamadas ao CRM/ERP da mesma unidade várias vezes.
  const unidadePreview = useMemo(
    () => state.unidades.find((u) => u.id === previewUnidadeId),
    [state.unidades, previewUnidadeId],
  );
  const empreendimentoPreview = useMemo(
    () =>
      unidadePreview
        ? state.empreendimentos.find((e) => e.id === unidadePreview.empreendimentoId)
        : undefined,
    [state.empreendimentos, unidadePreview],
  );

  useEffect(() => {
    let ativo = true;
    const unidade = unidadePreview;
    const empreendimento = empreendimentoPreview;
    void (async () => {
      let cliente: Cliente | undefined;
      let financeiro: SituacaoFinanceira | undefined;
      try {
        cliente = await adapters.crm.getClienteByUnidade(previewUnidadeId);
      } catch {
        /* unidade sem cliente */
      }
      try {
        financeiro = await adapters.erp.getSituacaoFinanceira(previewUnidadeId);
      } catch {
        /* unidade sem dados financeiros */
      }
      if (!ativo) return;
      const novo: TermoContexto = {};
      if (unidade) novo.unidade = unidade;
      if (empreendimento) novo.empreendimento = empreendimento;
      if (cliente) novo.cliente = cliente;
      if (financeiro) novo.financeiro = financeiro;
      setCtx(novo);
    })();
    return () => {
      ativo = false;
    };
  }, [previewUnidadeId, unidadePreview, empreendimentoPreview]);

  // O backdrop do editor usa o texto ao vivo (senão o cursor desalinha); o resto
  // (prévia, contagem, validação) pode ficar um passo atrás da digitação.
  const partes = useMemo(() => partesTermo(conteudo), [conteudo]);
  const conteudoAdiado = useDeferredValue(conteudo);
  const partesAdiadas = useMemo(() => partesTermo(conteudoAdiado), [conteudoAdiado]);
  const invalidas = useMemo(() => variaveisInvalidas(conteudoAdiado), [conteudoAdiado]);
  const usadas = useMemo(
    () => new Set(partesAdiadas.map(chaveVariavel).filter((k): k is string => k !== null)),
    [partesAdiadas],
  );

  // Cada trecho da prévia: texto, valor resolvido ou variável sem dado.
  const preview = useMemo(
    () =>
      partesAdiadas.map((t) => {
        const k = chaveVariavel(t);
        if (k === null || !(k in LABELS)) return { t, tipo: 'texto' as const };
        const valor = renderTermo(`{{${k}}}`, ctx);
        return valor.trim()
          ? { t: valor, tipo: 'ok' as const }
          : { t: LABELS[k]!, tipo: 'falta' as const };
      }),
    [partesAdiadas, ctx],
  );
  const semDado = [...new Set(preview.filter((p) => p.tipo === 'falta').map((p) => p.t))];

  const grupos = useMemo(() => {
    const q = buscaVar.trim().toLowerCase();
    return CATALOGO_VARIAVEIS.map((g) => ({
      ...g,
      itens: g.itens.filter(
        (v) => !q || v.label.toLowerCase().includes(q) || v.chave.toLowerCase().includes(q),
      ),
    })).filter((g) => g.itens.length > 0);
  }, [buscaVar]);

  function inserirVariavel(chave: string) {
    const token = `{{${chave}}}`;
    const ta = textareaRef.current;
    if (!ta) {
      setConteudo((c) => c + token);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setConteudo(conteudo.slice(0, start) + token + conteudo.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  async function salvar() {
    if (!nome.trim() || !conteudo.trim()) {
      toast.error('Informe o nome e o conteúdo do modelo');
      return;
    }
    setSalvando(true);
    try {
      // Só navega depois de o servidor confirmar: este é o texto que o cliente
      // assina, então "salvo" não pode ser só na tela de quem editou.
      const dados = { nome: nome.trim(), conteudo, tipo, modalidade };
      if (ehNovo) await actions.criarModelo(dados, currentUser.id);
      else await actions.atualizarModelo(id, dados, currentUser.id);
      toast.success('Modelo salvo');
      navigate('/modelos');
    } catch (e) {
      toast.error('Não foi possível salvar o modelo', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvando(false);
    }
  }

  // O catálogo inteiro (todos os empreendimentos) chega a milhares de unidades.
  // Select nativo agrupado por empreendimento: o do Radix renderiza todos os
  // itens mesmo fechado, a cada tecla digitada no editor.
  const opcoesUnidade = useMemo(
    () =>
      state.empreendimentos.map((e) => {
        const us = state.unidades.filter((u) => u.empreendimentoId === e.id);
        return us.length === 0 ? null : (
          <optgroup key={e.id} label={e.nome}>
            {us.map((u) => (
              <option key={u.id} value={u.id}>
                {u.identificacao}
              </option>
            ))}
          </optgroup>
        );
      }),
    [state.empreendimentos, state.unidades],
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card px-4 py-3 safe-px md:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="shrink-0 rounded-[10px]" asChild>
              <Link to="/modelos" aria-label="Voltar para Modelos de termo">
                <ArrowLeft />
              </Link>
            </Button>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Modelos de termo</span>
                <ChevronRight className="h-3 w-3" />
                <span>{ehNovo ? 'Novo' : 'Editar'}</span>
              </div>
              <h1 className="truncate text-lg font-bold leading-snug text-foreground">
                {nome.trim() || (ehNovo ? 'Novo modelo' : 'Sem nome')}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {alterado && (
              <span className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Alterações não salvas
              </span>
            )}
            <Button
              variant="outline"
              className="rounded-[10px] hover:border-primary hover:bg-primary hover:text-white"
              onClick={descartar}
              disabled={!alterado || salvando}
            >
              Cancelar
            </Button>
            <Button className="rounded-[10px]" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))] items-start gap-6 px-4 py-6 safe-px md:px-8 md:pb-10">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Dados + conteúdo */}
          <section className={cn(CARD, 'flex flex-col gap-4')}>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3">
              <div className="col-span-full flex flex-col gap-1.5">
                <Label htmlFor="nome">Nome do modelo</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Termo de Entrega de Chaves"
                  className="h-10 rounded-[10px]"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Tipo</Label>
                <Select value={tipo ?? ''} onValueChange={(v) => setTipo(v as TipoModelo)}>
                  <SelectTrigger className={TRIGGER}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_MODELO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Modalidade</Label>
                <Select
                  value={modalidade ?? ''}
                  onValueChange={(v) => setModalidade(v as ModalidadeModelo)}
                >
                  <SelectTrigger className={TRIGGER}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDADES_MODELO.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor="conteudo">Conteúdo do termo</Label>
                <span className="text-xs text-muted-foreground">
                  {usadas.size} {usadas.size === 1 ? 'variável usada' : 'variáveis usadas'}
                </span>
              </div>
              {/* O backdrop pinta as variáveis e define a altura; o textarea
                  transparente por cima recebe a digitação. Sem scroll próprio,
                  não há o que sincronizar. */}
              <div className="relative overflow-hidden rounded-[10px] border border-border bg-card focus-within:ring-2 focus-within:ring-primary/35">
                <div
                  aria-hidden="true"
                  className={cn(EDITOR_TEXTO, 'min-h-[360px] text-foreground')}
                >
                  {partes.map((t, i) =>
                    chaveVariavel(t) !== null ? (
                      <span
                        key={i}
                        className="rounded bg-blue-500/[0.12] text-[#1d4ed8] dark:text-blue-300"
                      >
                        {t}
                      </span>
                    ) : (
                      t
                    ),
                  )}
                  {/* Linha extra: um "\n" final precisa de altura para o cursor. */}
                  {'​\n'}
                </div>
                <textarea
                  id="conteudo"
                  ref={textareaRef}
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  spellCheck={false}
                  placeholder="Escreva o termo e insira variáveis clicando nelas abaixo..."
                  className={cn(
                    EDITOR_TEXTO,
                    'absolute inset-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent text-transparent caret-foreground outline-none placeholder:text-muted-foreground',
                  )}
                />
              </div>
              {invalidas.length > 0 && (
                <p className="text-xs text-destructive">
                  Variáveis não reconhecidas: {invalidas.map((v) => `{{${v}}}`).join(', ')}
                </p>
              )}
            </div>
          </section>

          {/* Variáveis disponíveis */}
          <section className={cn(CARD, 'flex flex-col gap-3.5')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-base font-semibold text-foreground">Variáveis disponíveis</h2>
                <p className="text-[13px] text-muted-foreground">
                  Clique para inserir no cursor. Na geração, cada variável puxa o dado real da
                  unidade.
                </p>
              </div>
              <div className="relative min-w-[160px] flex-[0_1_220px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={buscaVar}
                  onChange={(e) => setBuscaVar(e.target.value)}
                  placeholder="Buscar variável..."
                  className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-2.5 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              </div>
            </div>
            {grupos.map((g) => (
              <div
                key={g.grupo}
                className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-border"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {g.grupo}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {g.itens.map((v) => {
                    const usada = usadas.has(v.chave);
                    const Icone = usada ? Check : Plus;
                    return (
                      <button
                        key={v.chave}
                        type="button"
                        onClick={() => inserirVariavel(v.chave)}
                        title={`{{${v.chave}}}`}
                        className={cn(
                          'flex h-7 items-center gap-1 rounded-full border px-2.5 text-[13px] font-medium transition-colors',
                          usada
                            ? 'border-blue-500/30 bg-blue-500/10 text-[#1d4ed8] hover:bg-blue-500/[0.18] dark:text-blue-300'
                            : 'border-border bg-slate-50 text-foreground hover:border-blue-500/40 hover:bg-blue-500/[0.06] hover:text-[#1d4ed8] dark:bg-muted',
                        )}
                      >
                        <Icone className="h-3 w-3" strokeWidth={2.5} />
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {grupos.length === 0 && (
              <span className="py-3 text-[13px] text-muted-foreground">
                Nenhuma variável encontrada.
              </span>
            )}
          </section>
        </div>

        {/* Pré-visualização */}
        <section className={cn(CARD, 'flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-[88px]')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="h-[18px] w-[18px] text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Pré-visualização</h2>
            </div>
            <label className="flex min-w-[190px] flex-[0_1_260px] items-center gap-2 text-xs text-muted-foreground">
              Unidade
              <select
                value={previewUnidadeId}
                onChange={(e) => setPreviewUnidadeId(e.target.value)}
                className={cn(
                  TRIGGER,
                  'h-9 min-w-0 flex-1 border px-2.5 text-[13px] font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/25',
                )}
              >
                {!unidadePreview && <option value="">Selecione</option>}
                {opcoesUnidade}
              </select>
            </label>
          </div>

          {conteudo.trim() &&
            (semDado.length > 0 ? (
              <div className="flex items-start gap-2 rounded-[10px] bg-red-500/[0.08] px-3 py-2.5 text-[13px] leading-[1.45] text-[#b91c1c] dark:text-red-400">
                <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
                <span>
                  {semDado.length}{' '}
                  {semDado.length === 1 ? 'variável sem dado' : 'variáveis sem dado'} nesta unidade:{' '}
                  {semDado.join(', ')}. O termo sairá com esses campos em branco.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-[10px] bg-green-500/10 px-3 py-2.5 text-[13px] text-[#15803d] dark:text-green-400">
                <CircleCheckBig className="h-4 w-4 shrink-0" />
                Todas as variáveis preenchidas para esta unidade.
              </div>
            ))}

          {/* A folha fica branca também no tema escuro: é o documento impresso. */}
          <div className="rounded-[10px] bg-slate-100 p-4 dark:bg-muted">
            <div className="box-border max-h-[calc(100vh-330px)] min-h-[320px] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-white px-9 py-8 text-sm leading-[1.7] text-[#1a1a1a] shadow-sm [overflow-wrap:break-word] [text-wrap:pretty]">
              {conteudo.trim() ? (
                preview.map((p, i) =>
                  p.tipo === 'ok' ? (
                    <span key={i} className="rounded-[3px] bg-blue-500/10 px-0.5 text-[#1d4ed8]">
                      {p.t}
                    </span>
                  ) : p.tipo === 'falta' ? (
                    <span
                      key={i}
                      title="Sem dado para esta unidade"
                      className="rounded-[3px] border border-dashed border-red-500 bg-red-500/[0.06] px-1 text-xs font-medium text-red-600"
                    >
                      {p.t}
                    </span>
                  ) : (
                    p.t
                  ),
                )
              ) : (
                <span className="text-slate-400">A pré-visualização do termo aparece aqui.</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-blue-500/25" />
              Dado resolvido
            </span>
            <span className="flex items-center gap-1.5">
              <span className="box-border h-2.5 w-2.5 rounded-[3px] border border-dashed border-red-500" />
              Sem dado
            </span>
            <span className="ml-auto">
              CRM: {ctx.cliente?.nome ?? 'sem cliente'} · ERP:{' '}
              {ctx.financeiro?.numeroContrato
                ? `contrato ${ctx.financeiro.numeroContrato}`
                : 'sem contrato'}
            </span>
          </div>
        </section>
      </div>
    </>
  );
}

function ModeloEditorSkeleton(): React.JSX.Element {
  return (
    <>
      <CabecalhoSkeleton voltar />
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))] items-start gap-6 px-4 py-6 safe-px md:px-8">
        <div className="flex flex-col gap-4">
          <div className={cn(CARD, 'flex flex-col gap-3')}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
        <Skeleton className="h-[560px] w-full rounded-xl" />
      </div>
    </>
  );
}
