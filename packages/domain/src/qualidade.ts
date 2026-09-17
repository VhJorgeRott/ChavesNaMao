/**
 * Qualidade — FVS (Ficha de Verificação de Serviço).
 *
 * Substitui o processo do Mobuss, com três conceitos:
 *
 *   Modelo de FVS  → checklist versionado (seções → itens) de um serviço.
 *   Inspeção       → aplicação de um modelo num local da obra. Guarda uma CÓPIA
 *                    da estrutura do modelo (snapshot): editar o modelo depois
 *                    não altera inspeções já feitas.
 *   Não conformidade (NC) → nasce de cada item marcado "Não conforme" ao concluir
 *                    a inspeção. É corrigida pela equipe e fechada por uma
 *                    REINSPEÇÃO que verifica apenas os itens reprovados.
 *
 * Tudo aqui é puro (sem I/O): roda no navegador offline, nos testes e pode ser
 * reusado no servidor. Ids são uuid gerados no cliente — a inspeção existe antes
 * de haver internet para falar com o banco.
 */

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------

export interface ItemModeloFvs {
  id: string;
  /** O que verificar (ex.: "Prumo da parede"). */
  texto: string;
  /** Critério de aceitação / tolerância (ex.: "Desvio máximo de 3 mm/m"). */
  criterio: string | null;
  /** Método de verificação (ex.: "Prumo de face e trena"). */
  metodo: string | null;
  /** Exige foto quando marcado como não conforme. */
  fotoObrigatoriaNc: boolean;
}

export interface SecaoModeloFvs {
  id: string;
  titulo: string;
  itens: ItemModeloFvs[];
}

export interface EstruturaFvs {
  secoes: SecaoModeloFvs[];
}

export interface ModeloFvs {
  id: string;
  /** Código curto do Mobuss/interno (ex.: "FVS-05"). */
  codigo: string | null;
  nome: string;
  /** Serviço/categoria (ex.: "Alvenaria", "Revestimento"). */
  servico: string | null;
  descricao: string | null;
  /** Sobe a cada alteração de estrutura publicada. */
  versao: number;
  ativo: boolean;
  estrutura: EstruturaFvs;
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// Inspeções
// ---------------------------------------------------------------------------

export type ResultadoItem = 'C' | 'NC' | 'NA';

export const RESULTADO_ITEM_LABEL: Record<ResultadoItem, string> = {
  C: 'Aprovado',
  NC: 'Reprovado',
  NA: 'Não se aplica',
};

/** Rótulo curto para os botões de campo. */
export const RESULTADO_ITEM_CURTO: Record<ResultadoItem, string> = {
  C: 'Aprovado',
  NC: 'Reprovado',
  NA: 'N/A',
};

export type StatusInspecao = 'em_andamento' | 'concluida';
export type ResultadoInspecao = 'aprovada' | 'reprovada';

/** Onde a inspeção foi feita. Refs vêm do catálogo (CV/Mega). */
export interface LocalInspecao {
  empreendimentoRef: string;
  empreendimentoNome: string;
  /** Código do local no padrão da obra (ex.: "01.01.06"), como no Mobuss. */
  codigo: string | null;
  /** Bloco, quadra ou torre. */
  bloco: string | null;
  unidadeRef: string | null;
  unidadeNome: string | null;
  /** Pavimento, ambiente ou trecho (texto livre: "Térreo", "Banheiro suíte"). */
  detalhe: string | null;
}

export interface RespostaFvs {
  itemId: string;
  resultado: ResultadoItem;
  observacao: string | null;
  respondidoEm: string;
}

export interface FotoFvs {
  id: string;
  itemId: string;
  /** Caminho no bucket `qualidade` (null enquanto não sincronizada). */
  storagePath: string | null;
  criadaEm: string;
}

/** Assinatura manuscrita de quem concluiu a inspeção. */
export interface AssinaturaInspecao {
  nome: string;
  /** PNG do traço do canvas (dataURL). */
  pngDataUrl: string;
  assinadaEm: string;
}

export interface InspecaoFvs {
  id: string;
  modeloId: string;
  modeloVersao: number;
  modeloNome: string;
  modeloCodigo: string | null;
  /** Estrutura congelada no momento da inspeção. */
  estrutura: EstruturaFvs;
  local: LocalInspecao;
  /** O que exatamente foi verificado (ex.: "parede de concreto 601, 602 A"). */
  identificador: string | null;
  /** Empreiteiro/fornecedor que executou o serviço. */
  fornecedor: string | null;
  /** Responsável pelo serviço no campo (não é quem preenche a ficha). */
  responsavel: string | null;
  /** Data do atendimento/execução (YYYY-MM-DD), quando diferente do preenchimento. */
  dataAtendimento: string | null;
  /** Validade da verificação (YYYY-MM-DD), como no Mobuss. */
  validade: string | null;
  inspetorId: string;
  inspetorNome: string;
  assinatura: AssinaturaInspecao | null;
  status: StatusInspecao;
  resultado: ResultadoInspecao | null;
  /** Reinspeção: id da inspeção de origem; `itensAlvo` restringe os itens verificados. */
  reinspecaoDe: string | null;
  itensAlvo: string[] | null;
  observacoes: string | null;
  iniciadaEm: string;
  concluidaEm: string | null;
  respostas: Record<string, RespostaFvs>;
  fotos: FotoFvs[];
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// Não conformidades
// ---------------------------------------------------------------------------

export type StatusNc = 'aberta' | 'em_correcao' | 'aguardando_reinspecao' | 'fechada';

export const STATUS_NC: readonly StatusNc[] = [
  'aberta',
  'em_correcao',
  'aguardando_reinspecao',
  'fechada',
];

export const STATUS_NC_LABEL: Record<StatusNc, string> = {
  aberta: 'Aberta',
  em_correcao: 'Em correção',
  aguardando_reinspecao: 'Aguardando reinspeção',
  fechada: 'Fechada',
};

export interface NaoConformidade {
  id: string;
  inspecaoId: string;
  itemId: string;
  itemTexto: string;
  secaoTitulo: string;
  modeloNome: string;
  local: LocalInspecao;
  /** Observação registrada na inspeção. */
  descricao: string | null;
  /** Empreiteiro/equipe responsável pela correção. */
  responsavel: string | null;
  /** Data limite (YYYY-MM-DD). */
  prazo: string | null;
  status: StatusNc;
  /** Inspeções que tentaram fechar esta NC (reinspeções), em ordem. */
  reinspecoes: string[];
  abertaEm: string;
  fechadaEm: string | null;
  atualizadoEm: string;
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

/** Itens que a inspeção precisa responder (todos, ou só os alvo da reinspeção). */
export function itensDaInspecao(
  inspecao: Pick<InspecaoFvs, 'estrutura' | 'itensAlvo'>,
): { secao: SecaoModeloFvs; item: ItemModeloFvs }[] {
  const alvo = inspecao.itensAlvo ? new Set(inspecao.itensAlvo) : null;
  return inspecao.estrutura.secoes.flatMap((secao) =>
    secao.itens.filter((item) => !alvo || alvo.has(item.id)).map((item) => ({ secao, item })),
  );
}

export interface ProgressoInspecao {
  total: number;
  respondidos: number;
  /** Itens deixados em branco — "não verificados" (não entram na conformidade). */
  naoVerificados: number;
  conformes: number;
  naoConformes: number;
  naoAplicaveis: number;
  /** % de conformidade entre os itens aplicáveis já respondidos (0–100), ou null. */
  conformidade: number | null;
}

export function progressoInspecao(
  inspecao: Pick<InspecaoFvs, 'estrutura' | 'itensAlvo' | 'respostas'>,
): ProgressoInspecao {
  const itens = itensDaInspecao(inspecao);
  let conformes = 0;
  let naoConformes = 0;
  let naoAplicaveis = 0;
  for (const { item } of itens) {
    const r = inspecao.respostas[item.id]?.resultado;
    if (r === 'C') conformes += 1;
    else if (r === 'NC') naoConformes += 1;
    else if (r === 'NA') naoAplicaveis += 1;
  }
  const aplicaveis = conformes + naoConformes;
  const respondidos = conformes + naoConformes + naoAplicaveis;
  return {
    total: itens.length,
    respondidos,
    naoVerificados: itens.length - respondidos,
    conformes,
    naoConformes,
    naoAplicaveis,
    conformidade: aplicaveis === 0 ? null : Math.round((conformes / aplicaveis) * 100),
  };
}

export type PendenciaConclusao =
  | { tipo: 'nada_verificado'; itemId: null; itemTexto: string }
  | { tipo: 'foto_obrigatoria'; itemId: string; itemTexto: string };

/**
 * O que impede concluir. Item em branco NÃO impede: como no Mobuss, ele fica
 * "não verificado" (a etapa pode não ter chegado) e sai do cálculo. Impedem:
 * ficha totalmente em branco e item reprovado sem a foto exigida.
 */
export function pendenciasParaConcluir(
  inspecao: Pick<InspecaoFvs, 'estrutura' | 'itensAlvo' | 'respostas' | 'fotos'>,
): PendenciaConclusao[] {
  const pendencias: PendenciaConclusao[] = [];
  for (const { item } of itensDaInspecao(inspecao)) {
    const r = inspecao.respostas[item.id];
    if (
      r?.resultado === 'NC' &&
      item.fotoObrigatoriaNc &&
      !inspecao.fotos.some((f) => f.itemId === item.id)
    ) {
      pendencias.push({ tipo: 'foto_obrigatoria', itemId: item.id, itemTexto: item.texto });
    }
  }
  if (progressoInspecao(inspecao).respondidos === 0) {
    pendencias.unshift({
      tipo: 'nada_verificado',
      itemId: null,
      itemTexto: 'Verifique ao menos um item antes de concluir.',
    });
  }
  return pendencias;
}

export class InspecaoIncompletaError extends Error {
  constructor(readonly pendencias: PendenciaConclusao[]) {
    super(`Inspeção com ${pendencias.length} pendência(s) para concluir`);
    this.name = 'InspecaoIncompletaError';
  }
}

export interface ConclusaoInspecao {
  inspecao: InspecaoFvs;
  /** NCs novas (inspeção comum) — uma por item reprovado. */
  novasNcs: NaoConformidade[];
  /** NCs existentes atualizadas (reinspeção): fechadas ou reabertas. */
  ncsAtualizadas: NaoConformidade[];
}

/**
 * Conclui a inspeção: calcula o resultado e gera/atualiza as NCs.
 *
 * - Inspeção comum: cada item NC vira uma NC "aberta".
 * - Reinspeção: cada NC de origem é FECHADA se o item agora é C/NA, ou volta a
 *   "aberta" (com a reinspeção registrada) se continua NC.
 *
 * `novoId` é injetado para manter a função pura e testável.
 */
export function concluirInspecao(
  inspecao: InspecaoFvs,
  ncsDaOrigem: readonly NaoConformidade[],
  agora: string,
  novoId: () => string,
): ConclusaoInspecao {
  const pendencias = pendenciasParaConcluir(inspecao);
  if (pendencias.length > 0) throw new InspecaoIncompletaError(pendencias);

  const itens = itensDaInspecao(inspecao);
  const reprovados = itens.filter(({ item }) => inspecao.respostas[item.id]?.resultado === 'NC');

  const concluida: InspecaoFvs = {
    ...inspecao,
    status: 'concluida',
    resultado: reprovados.length > 0 ? 'reprovada' : 'aprovada',
    concluidaEm: agora,
    atualizadoEm: agora,
  };

  if (inspecao.reinspecaoDe) {
    const ncsAtualizadas = ncsDaOrigem
      .filter((nc) => nc.status !== 'fechada' && itens.some(({ item }) => item.id === nc.itemId))
      .map((nc): NaoConformidade => {
        const continuaNc = inspecao.respostas[nc.itemId]?.resultado === 'NC';
        return {
          ...nc,
          status: continuaNc ? 'aberta' : 'fechada',
          descricao: continuaNc
            ? (inspecao.respostas[nc.itemId]?.observacao ?? nc.descricao)
            : nc.descricao,
          reinspecoes: [...nc.reinspecoes, inspecao.id],
          fechadaEm: continuaNc ? null : agora,
          atualizadoEm: agora,
        };
      });
    return { inspecao: concluida, novasNcs: [], ncsAtualizadas };
  }

  const novasNcs = reprovados.map(
    ({ secao, item }): NaoConformidade => ({
      id: novoId(),
      inspecaoId: inspecao.id,
      itemId: item.id,
      itemTexto: item.texto,
      secaoTitulo: secao.titulo,
      modeloNome: inspecao.modeloNome,
      local: inspecao.local,
      descricao: inspecao.respostas[item.id]?.observacao ?? null,
      responsavel: null,
      prazo: null,
      status: 'aberta',
      reinspecoes: [],
      abertaEm: agora,
      fechadaEm: null,
      atualizadoEm: agora,
    }),
  );
  return { inspecao: concluida, novasNcs, ncsAtualizadas: [] };
}

/**
 * Prepara a reinspeção das NCs ainda não fechadas de uma inspeção concluída (a
 * própria inspeção original ou uma reinspeção dela):
 * mesma estrutura e local, só com os itens reprovados como alvo.
 */
export function criarReinspecao(
  origem: InspecaoFvs,
  ncs: readonly NaoConformidade[],
  inspetor: { id: string; nome: string },
  agora: string,
  novoId: () => string,
): InspecaoFvs {
  // NCs pertencem sempre à inspeção RAIZ; reinspeção de reinspeção aponta para ela.
  const raiz = origem.reinspecaoDe ?? origem.id;
  const alvo = ncs
    .filter((nc) => nc.inspecaoId === raiz && nc.status !== 'fechada')
    .map((nc) => nc.itemId);
  if (alvo.length === 0) throw new Error('Não há não conformidades abertas para reinspecionar');
  return {
    ...origem,
    id: novoId(),
    inspetorId: inspetor.id,
    inspetorNome: inspetor.nome,
    assinatura: null,
    status: 'em_andamento',
    resultado: null,
    reinspecaoDe: raiz,
    itensAlvo: [...new Set(alvo)],
    observacoes: null,
    iniciadaEm: agora,
    concluidaEm: null,
    respostas: {},
    fotos: [],
    atualizadoEm: agora,
  };
}

/** Nova inspeção a partir de um modelo (congela a estrutura atual). */
export interface DadosInspecao {
  local: LocalInspecao;
  identificador?: string | null;
  fornecedor?: string | null;
  responsavel?: string | null;
  dataAtendimento?: string | null;
  validade?: string | null;
}

export function criarInspecao(
  modelo: ModeloFvs,
  dados: DadosInspecao,
  inspetor: { id: string; nome: string },
  agora: string,
  novoId: () => string,
): InspecaoFvs {
  return {
    id: novoId(),
    modeloId: modelo.id,
    modeloVersao: modelo.versao,
    modeloNome: modelo.nome,
    modeloCodigo: modelo.codigo,
    estrutura: JSON.parse(JSON.stringify(modelo.estrutura)) as EstruturaFvs,
    local: dados.local,
    identificador: dados.identificador ?? null,
    fornecedor: dados.fornecedor ?? null,
    responsavel: dados.responsavel ?? null,
    dataAtendimento: dados.dataAtendimento ?? null,
    validade: dados.validade ?? null,
    inspetorId: inspetor.id,
    inspetorNome: inspetor.nome,
    assinatura: null,
    status: 'em_andamento',
    resultado: null,
    reinspecaoDe: null,
    itensAlvo: null,
    observacoes: null,
    iniciadaEm: agora,
    concluidaEm: null,
    respostas: {},
    fotos: [],
    atualizadoEm: agora,
  };
}

/** Marca como Conforme todos os itens ainda sem resposta ("restantes conformes"). */
export function marcarRestantesConformes(inspecao: InspecaoFvs, agora: string): InspecaoFvs {
  const respostas = { ...inspecao.respostas };
  for (const { item } of itensDaInspecao(inspecao)) {
    if (!respostas[item.id]) {
      respostas[item.id] = {
        itemId: item.id,
        resultado: 'C',
        observacao: null,
        respondidoEm: agora,
      };
    }
  }
  return { ...inspecao, respostas, atualizadoEm: agora };
}

/** NC com prazo vencido e ainda não fechada. `hoje` = YYYY-MM-DD. */
export function ncVencida(nc: Pick<NaoConformidade, 'prazo' | 'status'>, hoje: string): boolean {
  return nc.status !== 'fechada' && nc.prazo !== null && nc.prazo < hoje;
}

/** Texto curto do local: "Porto Horizonte · Bloco A · Apto 101 · Banheiro". */
export function descreverLocal(local: LocalInspecao): string {
  return [local.empreendimentoNome, local.bloco, local.unidadeNome, local.detalhe]
    .filter((p): p is string => !!p && p.trim() !== '')
    .join(' · ');
}

/** Hierarquia no padrão do relatório: "Obra > Torre A > 6o Pavimento". */
export function hierarquiaLocal(local: LocalInspecao): string {
  return [local.empreendimentoNome, local.bloco, local.unidadeNome, local.detalhe]
    .filter((p): p is string => !!p && p.trim() !== '')
    .join(' > ');
}

/** Estrutura mínima válida: ao menos uma seção com um item, textos preenchidos, ids únicos. */
export function validarEstrutura(estrutura: EstruturaFvs): string[] {
  const erros: string[] = [];
  const ids = new Set<string>();
  if (estrutura.secoes.length === 0) erros.push('Adicione ao menos uma seção.');
  estrutura.secoes.forEach((secao, i) => {
    if (!secao.titulo.trim()) erros.push(`Seção ${i + 1} está sem título.`);
    if (secao.itens.length === 0) erros.push(`Seção "${secao.titulo || i + 1}" não tem itens.`);
    secao.itens.forEach((item, j) => {
      if (!item.texto.trim())
        erros.push(`Item ${j + 1} da seção "${secao.titulo || i + 1}" está vazio.`);
      if (ids.has(item.id)) erros.push(`Item duplicado: ${item.id}.`);
      ids.add(item.id);
    });
  });
  return erros;
}
