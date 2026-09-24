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

export const FASES_CHAMADO: readonly FaseChamado[] = [
  'nova',
  'andamento',
  'improcedente',
  'finalizado',
];

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
export function faseDoChamado(
  fluxo: FluxoAssistencia,
  etapa: number | null,
  nome: string,
): FaseChamado {
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

export type PeriodoChamado = 'hoje' | '7' | '30';
export type LocalChamado = 'unidade' | 'area';
export type DescricaoChamado = 'com' | 'sem';
export type OrdemChamado = 'protocolo' | 'data' | 'local' | 'descricao' | 'situacao';

export interface FiltroChamados {
  fluxo?: FluxoAssistencia;
  /** 'abertos' = nova + andamento. */
  fase?: FaseChamado | 'abertos';
  situacaoIds?: string[];
  empreendimentoIds?: string[];
  /** Id da unidade no CV — para a ficha da unidade. */
  unidadeId?: string;
  busca?: string;
  /** Aberto hoje / nos últimos 7 ou 30 dias (fuso de São Paulo). */
  periodo?: PeriodoChamado;
  local?: LocalChamado;
  descricao?: DescricaoChamado;
  /** Padrão: data desc. */
  ordem?: OrdemChamado;
  direcao?: 'asc' | 'desc';
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

/**
 * Contagem facetada de cada filtro: quantos chamados sobrariam em cada opção
 * aplicando todos os OUTROS filtros (o próprio é ignorado).
 */
export interface FacetasChamados {
  empreendimento: Record<string, number>;
  periodo: Record<PeriodoChamado | 'todos', number>;
  local: Record<LocalChamado | 'todos', number>;
  descricao: Record<DescricaoChamado | 'todos', number>;
}

export interface PaginaChamados {
  itens: ChamadoAssistencia[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
  /** Faceta de situação: aplica os outros filtros, ignora fase/situação. Base dos KPIs. */
  porFase: Record<FaseChamado, number>;
  porSituacao: ResumoSituacao[];
  /** Ausente em respostas de versões anteriores da função (cache antigo). */
  facetas?: FacetasChamados | undefined;
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

/** Área comum = área preenchida ou bloco "A.C" (convenção do CV). */
export function ehAreaComum(c: ChamadoAssistencia): boolean {
  return Boolean(c.areaComum?.trim()) || normalizar(c.bloco).replace(/\s/g, '') === 'a.c';
}

/** Data de hoje (YYYY-MM-DD) em São Paulo — o servidor roda em UTC. */
export function hojeSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

function diasAtras(hoje: string, dias: number): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

const numProtocolo = (c: ChamadoAssistencia): number =>
  Number((c.protocolo ?? c.id).replace(/\D/g, '')) || 0;
const chaveLocal = (c: ChamadoAssistencia): string =>
  [c.empreendimento?.nome, c.bloco, c.unidade?.nome ?? c.areaComum].filter(Boolean).join(' ');
const comparaTexto = (a: string, b: string): number =>
  a.localeCompare(b, 'pt-BR', { numeric: true });

function comparador(
  ordem: OrdemChamado,
  direcao: 'asc' | 'desc',
): (a: ChamadoAssistencia, b: ChamadoAssistencia) => number {
  const sinal = direcao === 'asc' ? 1 : -1;
  const desempate = (a: ChamadoAssistencia, b: ChamadoAssistencia): number =>
    Number(b.id) - Number(a.id);
  return (a, b) => {
    let r = 0;
    if (ordem === 'protocolo') r = numProtocolo(a) - numProtocolo(b);
    else if (ordem === 'data') r = (a.abertoEm ?? '').localeCompare(b.abertoEm ?? '');
    else if (ordem === 'local') r = comparaTexto(chaveLocal(a), chaveLocal(b));
    else if (ordem === 'situacao') r = (a.etapa ?? 999) - (b.etapa ?? 999);
    else {
      // Solicitação: vazias sempre por último.
      const va = a.descricao.trim();
      const vb = b.descricao.trim();
      if (!va !== !vb) return va ? -1 : 1;
      r = comparaTexto(va, vb);
    }
    return r * sinal || desempate(a, b);
  };
}

type Dimensao = 'situacao' | 'empreendimento' | 'periodo' | 'local' | 'descricao';
const DIMENSOES: readonly Dimensao[] = [
  'situacao',
  'empreendimento',
  'periodo',
  'local',
  'descricao',
];

/** Aplica o filtro, ordena, recorta a página e conta as facetas. */
export function filtrarChamados(
  todos: readonly ChamadoAssistencia[],
  filtro: FiltroChamados,
  atualizadoEm: string,
  hoje: string = hojeSaoPaulo(),
): PaginaChamados {
  const fluxo = filtro.fluxo ?? 'ASSISTENCIA_TECNICA';
  const q = normalizar(filtro.busca?.trim());
  const porPagina = Math.min(
    Math.max(Math.trunc(filtro.porPagina ?? POR_PAGINA_PADRAO), 1),
    POR_PAGINA_MAX,
  );
  const situacoesSel = filtro.situacaoIds?.length ? new Set(filtro.situacaoIds) : null;
  const empreendimentosSel = filtro.empreendimentoIds?.length
    ? new Set(filtro.empreendimentoIds)
    : null;
  const inicio = { hoje, '7': diasAtras(hoje, 6), '30': diasAtras(hoje, 29) } as const;
  const noPeriodo = (c: ChamadoAssistencia, p: PeriodoChamado): boolean => {
    const dia = (c.abertoEm ?? '').slice(0, 10);
    return dia >= (p === 'hoje' ? inicio.hoje : inicio[p]) && dia <= hoje;
  };

  const doFluxo = todos.filter((c) => c.fluxo === fluxo);

  const empreendimentosMap = new Map<string, string>();
  for (const c of doFluxo) {
    if (c.empreendimento?.id) empreendimentosMap.set(c.empreendimento.id, c.empreendimento.nome);
  }

  const porFase: Record<FaseChamado, number> = {
    nova: 0,
    andamento: 0,
    improcedente: 0,
    finalizado: 0,
  };
  const situacoes = new Map<string, ResumoSituacao>();
  const facetas: FacetasChamados = {
    empreendimento: {},
    periodo: { todos: 0, hoje: 0, '7': 0, '30': 0 },
    local: { todos: 0, unidade: 0, area: 0 },
    descricao: { todos: 0, com: 0, sem: 0 },
  };
  const filtrados: ChamadoAssistencia[] = [];

  for (const c of doFluxo) {
    if (filtro.unidadeId && c.unidade?.id !== filtro.unidadeId) continue;
    if (q && !casaBusca(c, q)) continue;

    const area = ehAreaComum(c);
    const temDescricao = c.descricao.trim() !== '';
    const passa: Record<Dimensao, boolean> = {
      situacao:
        (filtro.fase === 'abertos'
          ? c.fase === 'nova' || c.fase === 'andamento'
          : !filtro.fase || c.fase === filtro.fase) &&
        (!situacoesSel || situacoesSel.has(c.situacaoId ?? '')),
      empreendimento: !empreendimentosSel || empreendimentosSel.has(c.empreendimento?.id ?? ''),
      periodo: !filtro.periodo || noPeriodo(c, filtro.periodo),
      local: !filtro.local || (filtro.local === 'area') === area,
      descricao: !filtro.descricao || (filtro.descricao === 'com') === temDescricao,
    };
    const falhas = DIMENSOES.filter((d) => !passa[d]);
    if (falhas.length === 0) filtrados.push(c);
    if (falhas.length > 1) continue;
    // Conta na faceta D quando o único filtro que falhou (se algum) é o próprio D.
    const contaEm = (d: Dimensao): boolean => falhas.length === 0 || falhas[0] === d;

    if (contaEm('situacao')) {
      porFase[c.fase] += 1;
      const chave = c.situacaoId ?? c.situacao;
      const s = situacoes.get(chave);
      if (s) s.qtd += 1;
      else
        situacoes.set(chave, {
          id: c.situacaoId,
          nome: c.situacao,
          etapa: c.etapa,
          fase: c.fase,
          qtd: 1,
        });
    }
    if (contaEm('empreendimento') && c.empreendimento?.id) {
      const id = c.empreendimento.id;
      facetas.empreendimento[id] = (facetas.empreendimento[id] ?? 0) + 1;
    }
    if (contaEm('periodo')) {
      facetas.periodo.todos += 1;
      for (const p of ['hoje', '7', '30'] as const) if (noPeriodo(c, p)) facetas.periodo[p] += 1;
    }
    if (contaEm('local')) {
      facetas.local.todos += 1;
      facetas.local[area ? 'area' : 'unidade'] += 1;
    }
    if (contaEm('descricao')) {
      facetas.descricao.todos += 1;
      facetas.descricao[temDescricao ? 'com' : 'sem'] += 1;
    }
  }

  const ordem = filtro.ordem ?? 'data';
  filtrados.sort(comparador(ordem, filtro.direcao ?? (ordem === 'data' ? 'desc' : 'asc')));

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
    facetas,
    empreendimentos: [...empreendimentosMap]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    atualizadoEm,
  };
}

/** Lê o filtro de uma query string (usado pela Edge Function). */
export function filtroDeQuery(params: URLSearchParams): FiltroChamados {
  const filtro: FiltroChamados = {};
  const um = <T extends string>(nome: string, validos: readonly T[]): T | undefined => {
    const v = params.get(nome);
    return (validos as readonly string[]).includes(v ?? '') ? (v as T) : undefined;
  };
  // Aceita também o parâmetro singular antigo, de clientes ainda sem refresh.
  const lista = (nome: string, legado: string): string[] | undefined => {
    const v = (params.get(nome) ?? params.get(legado) ?? '').split(',').filter(Boolean);
    return v.length ? v : undefined;
  };

  const fluxo = um('fluxo', ['ASSISTENCIA_TECNICA', 'ENTREGA_CHAVES', 'OUTRO'] as const);
  if (fluxo) filtro.fluxo = fluxo;
  const fase = um('fase', ['abertos', ...FASES_CHAMADO] as const);
  if (fase) filtro.fase = fase;
  const situacaoIds = lista('situacaoIds', 'situacaoId');
  if (situacaoIds) filtro.situacaoIds = situacaoIds;
  const empreendimentoIds = lista('empreendimentoIds', 'empreendimentoId');
  if (empreendimentoIds) filtro.empreendimentoIds = empreendimentoIds;
  const unidadeId = params.get('unidadeId');
  if (unidadeId) filtro.unidadeId = unidadeId;
  const busca = params.get('busca');
  if (busca) filtro.busca = busca.slice(0, 200);
  const periodo = um('periodo', ['hoje', '7', '30'] as const);
  if (periodo) filtro.periodo = periodo;
  const local = um('local', ['unidade', 'area'] as const);
  if (local) filtro.local = local;
  const descricao = um('descricao', ['com', 'sem'] as const);
  if (descricao) filtro.descricao = descricao;
  const ordem = um('ordem', ['protocolo', 'data', 'local', 'descricao', 'situacao'] as const);
  if (ordem) filtro.ordem = ordem;
  const direcao = um('direcao', ['asc', 'desc'] as const);
  if (direcao) filtro.direcao = direcao;
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
    const valor = Array.isArray(v) ? v.join(',') : v;
    if (valor !== undefined && valor !== null && valor !== '') params.set(k, String(valor));
  }
  // ponytail: compat com a versão da função que só lê o parâmetro singular;
  // remover quando o deploy com listas estiver no ar.
  if (filtro.empreendimentoIds?.length === 1) params.set('empreendimentoId', filtro.empreendimentoIds[0]!);
  if (filtro.situacaoIds?.length === 1) params.set('situacaoId', filtro.situacaoIds[0]!);
  return params.toString();
}
