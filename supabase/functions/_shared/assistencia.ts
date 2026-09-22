// Chamados de assistência do CV CRM — tipos e regras puras (sem Deno/DOM).
//
// Compartilhado de propósito: a Edge Function `crm-assistencias` filtra e pagina
// no servidor com estas funções, e o app importa o MESMO arquivo (tipos, mock e
// testes). Mantenha-o sem imports e sem APIs de runtime.
//
// O módulo de assistência do CV guarda dois fluxos, identificados pelo prefixo
// da situação: "[ASSISTÊNCIA TÉCNICA | 01] NOVA ASSISTÊNCIA" e
// "[ENTREGA DE CHAVES | 07] VISTORIA E ENTREGA". O número é a etapa do fluxo.

export type FluxoAssistencia = 'ASSISTENCIA_TECNICA' | 'ENTREGA_CHAVES' | 'OUTRO';

/** Fase de alto nível do chamado, derivada da etapa do fluxo. */
export type FaseChamado = 'nova' | 'andamento' | 'improcedente' | 'finalizado';

export const FASES_CHAMADO: readonly FaseChamado[] = ['nova', 'andamento', 'improcedente', 'finalizado'];

export interface ChamadoAssistencia {
  id: string;
  protocolo: string | null;
  atendimentoId: string | null;
  fluxo: FluxoAssistencia;
  /** Etapa numérica do fluxo (o "01" de "[... | 01]"), quando houver. */
  etapa: number | null;
  /** Nome da situação sem o prefixo do fluxo (ex.: "NOVA ASSISTÊNCIA"). */
  situacao: string;
  situacaoId: string | null;
  fase: FaseChamado;
  /** Data/hora de abertura (ISO sem fuso, hora local). */
  abertoEm: string | null;
  descricao: string;
  parecerTecnico: string | null;
  slaVencido: boolean;
  localidade: string | null;
  areaComum: string | null;
  empreendimento: { id: string | null; nome: string; dataEntrega: string | null } | null;
  bloco: string | null;
  unidade: { id: string | null; nome: string; codigoInterno: string | null } | null;
  cliente: { nome: string; email: string | null; documento: string | null } | null;
  sindico: string | null;
}

/** Minúsculas e sem acentos, para comparar textos vindos do CV. */
export function normalizar(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Separa "[FLUXO | NN] NOME" em fluxo, etapa e nome. */
export function interpretarSituacao(bruta: string): {
  fluxo: FluxoAssistencia;
  etapa: number | null;
  nome: string;
} {
  const m = bruta.trim().match(/^\[\s*([^|\]]+?)\s*\|\s*(\d+)\s*\]\s*(.*)$/);
  if (!m) return { fluxo: 'OUTRO', etapa: null, nome: bruta.trim() };
  const prefixo = normalizar(m[1]);
  const fluxo: FluxoAssistencia = prefixo.includes('assistencia')
    ? 'ASSISTENCIA_TECNICA'
    : prefixo.includes('entrega')
      ? 'ENTREGA_CHAVES'
      : 'OUTRO';
  return { fluxo, etapa: Number(m[2]), nome: (m[3] ?? '').trim() || bruta.trim() };
}

/**
 * Fase a partir da etapa. Para Assistência Técnica as etapas do CV são:
 * 01 nova · 02 tentativa de contato · 03 sem contato · 04 vistoria ·
 * 05 improcedente · 06 procedente · 07 reparo em andamento · 08 emissão da OS ·
 * 09 reparo finalizado.
 */
export function faseDoChamado(fluxo: FluxoAssistencia, etapa: number | null, nome: string): FaseChamado {
  if (fluxo === 'ASSISTENCIA_TECNICA' && etapa !== null) {
    if (etapa === 1) return 'nova';
    if (etapa === 5) return 'improcedente';
    if (etapa === 9) return 'finalizado';
    return 'andamento';
  }
  const s = normalizar(nome);
  if (/improced|cancel|indefer/.test(s)) return 'improcedente';
  if (/finaliz|conclu|encerr/.test(s)) return 'finalizado';
  if (etapa === 1 || /^nov[ao]/.test(s)) return 'nova';
  return 'andamento';
}

// ---------------------------------------------------------------------------
// Filtro e paginação
// ---------------------------------------------------------------------------

export interface FiltroChamados {
  fluxo?: FluxoAssistencia;
  /** 'abertos' = nova + andamento. */
  fase?: FaseChamado | 'abertos';
  situacaoId?: string;
  empreendimentoId?: string;
  /** Id da unidade no CV — para a ficha da unidade. */
  unidadeId?: string;
  busca?: string;
  pagina?: number;
  porPagina?: number;
}

export interface ResumoSituacao {
  id: string | null;
  nome: string;
  etapa: number | null;
  fase: FaseChamado;
  qtd: number;
}

export interface PaginaChamados {
  itens: ChamadoAssistencia[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  /** Contagens no fluxo + empreendimento + busca (ignora fase/situação), para os atalhos. */
  porFase: Record<FaseChamado, number>;
  porSituacao: ResumoSituacao[];
  empreendimentos: { id: string; nome: string }[];
  /** Quando os dados foram lidos do CV (ISO). */
  atualizadoEm: string;
}

export const POR_PAGINA_PADRAO = 25;
export const POR_PAGINA_MAX = 100;

function casaBusca(c: ChamadoAssistencia, q: string): boolean {
  return [
    c.protocolo,
    c.id,
    c.descricao,
    c.cliente?.nome,
    c.cliente?.documento,
    c.unidade?.nome,
    c.bloco,
    c.areaComum,
    c.localidade,
    c.empreendimento?.nome,
  ].some((campo) => normalizar(campo).includes(q));
}

/** Aplica o filtro, ordena (mais recentes primeiro) e recorta a página. */
export function filtrarChamados(
  todos: readonly ChamadoAssistencia[],
  filtro: FiltroChamados,
  atualizadoEm: string,
): PaginaChamados {
  const fluxo = filtro.fluxo ?? 'ASSISTENCIA_TECNICA';
  const q = normalizar(filtro.busca?.trim());
  const porPagina = Math.min(Math.max(Math.trunc(filtro.porPagina ?? POR_PAGINA_PADRAO), 1), POR_PAGINA_MAX);

  const doFluxo = todos.filter((c) => c.fluxo === fluxo);

  const empreendimentosMap = new Map<string, string>();
  for (const c of doFluxo) {
    if (c.empreendimento?.id) empreendimentosMap.set(c.empreendimento.id, c.empreendimento.nome);
  }

  // Base dos atalhos: fluxo + empreendimento + busca.
  const base = doFluxo.filter(
    (c) =>
      (!filtro.empreendimentoId || c.empreendimento?.id === filtro.empreendimentoId) &&
      (!filtro.unidadeId || c.unidade?.id === filtro.unidadeId) &&
      (!q || casaBusca(c, q)),
  );

  const porFase: Record<FaseChamado, number> = { nova: 0, andamento: 0, improcedente: 0, finalizado: 0 };
  const situacoes = new Map<string, ResumoSituacao>();
  for (const c of base) {
    porFase[c.fase] += 1;
    const chave = c.situacaoId ?? c.situacao;
    const s = situacoes.get(chave);
    if (s) s.qtd += 1;
    else situacoes.set(chave, { id: c.situacaoId, nome: c.situacao, etapa: c.etapa, fase: c.fase, qtd: 1 });
  }

  const filtrados = base
    .filter((c) => {
      if (filtro.fase === 'abertos') {
        if (c.fase !== 'nova' && c.fase !== 'andamento') return false;
      } else if (filtro.fase && c.fase !== filtro.fase) return false;
      if (filtro.situacaoId && c.situacaoId !== filtro.situacaoId) return false;
      return true;
    })
    .sort((a, b) => (b.abertoEm ?? '').localeCompare(a.abertoEm ?? '') || Number(b.id) - Number(a.id));

  const total = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(Math.trunc(filtro.pagina ?? 1), 1), totalPaginas);

  return {
    itens: filtrados.slice((pagina - 1) * porPagina, pagina * porPagina),
    total,
    pagina,
    porPagina,
    totalPaginas,
    porFase,
    porSituacao: [...situacoes.values()].sort(
      (a, b) => (a.etapa ?? 999) - (b.etapa ?? 999) || a.nome.localeCompare(b.nome),
    ),
    empreendimentos: [...empreendimentosMap]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    atualizadoEm,
  };
}

/** Lê o filtro de uma query string (usado pela Edge Function). */
export function filtroDeQuery(params: URLSearchParams): FiltroChamados {
  const filtro: FiltroChamados = {};
  const fluxo = params.get('fluxo');
  if (fluxo === 'ASSISTENCIA_TECNICA' || fluxo === 'ENTREGA_CHAVES' || fluxo === 'OUTRO') filtro.fluxo = fluxo;
  const fase = params.get('fase');
  if (fase === 'abertos' || (FASES_CHAMADO as readonly string[]).includes(fase ?? '')) {
    filtro.fase = fase as FaseChamado | 'abertos';
  }
  const situacaoId = params.get('situacaoId');
  if (situacaoId) filtro.situacaoId = situacaoId;
  const empreendimentoId = params.get('empreendimentoId');
  if (empreendimentoId) filtro.empreendimentoId = empreendimentoId;
  const unidadeId = params.get('unidadeId');
  if (unidadeId) filtro.unidadeId = unidadeId;
  const busca = params.get('busca');
  if (busca) filtro.busca = busca.slice(0, 200);
  const pagina = Number(params.get('pagina'));
  if (Number.isFinite(pagina) && pagina > 0) filtro.pagina = pagina;
  const porPagina = Number(params.get('porPagina'));
  if (Number.isFinite(porPagina) && porPagina > 0) filtro.porPagina = porPagina;
  return filtro;
}

/** Monta a query string do filtro (usado pelo app). */
export function queryDoFiltro(filtro: FiltroChamados): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtro)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  return params.toString();
}
