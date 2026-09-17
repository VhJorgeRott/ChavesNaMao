import type {
  AssinaturaInspecao,
  EstruturaFvs,
  FotoFvs,
  InspecaoFvs,
  LocalInspecao,
  ModeloFvs,
  NaoConformidade,
  RespostaFvs,
  StatusNc,
} from '@chaves/domain/qualidade';

/**
 * Conversão domínio ↔ linhas das tabelas `fvs_*` (migração 14).
 *
 * `atualizadoEm` do domínio vai para `cliente_atualizado_em` (relógio de quem
 * editou, usado pela guarda de última escrita). `updated_at` é do servidor e só
 * serve de cursor de sincronização — não entra no domínio.
 */

export type TabelaQualidade = 'fvs_modelos' | 'fvs_inspecoes' | 'fvs_nao_conformidades';

export interface ModeloRow {
  id: string;
  codigo: string | null;
  nome: string;
  servico: string | null;
  descricao: string | null;
  versao: number;
  ativo: boolean;
  estrutura: EstruturaFvs;
  cliente_atualizado_em: string;
  updated_at?: string;
}

export interface InspecaoRow {
  id: string;
  modelo_id: string;
  modelo_versao: number;
  modelo_nome: string;
  modelo_codigo: string | null;
  estrutura: EstruturaFvs;
  local: LocalInspecao;
  empreendimento_ref: string;
  identificador: string | null;
  fornecedor: string | null;
  responsavel: string | null;
  data_atendimento: string | null;
  validade: string | null;
  inspetor_id: string;
  inspetor_nome: string;
  assinatura: AssinaturaInspecao | null;
  status: InspecaoFvs['status'];
  resultado: InspecaoFvs['resultado'];
  reinspecao_de: string | null;
  itens_alvo: string[] | null;
  observacoes: string | null;
  respostas: Record<string, RespostaFvs>;
  fotos: FotoFvs[];
  iniciada_em: string;
  concluida_em: string | null;
  cliente_atualizado_em: string;
  updated_at?: string;
}

export interface NcRow {
  id: string;
  inspecao_id: string;
  item_id: string;
  item_texto: string;
  secao_titulo: string;
  modelo_nome: string;
  local: LocalInspecao;
  empreendimento_ref: string;
  descricao: string | null;
  responsavel: string | null;
  prazo: string | null;
  status: StatusNc;
  reinspecoes: string[];
  aberta_em: string;
  fechada_em: string | null;
  cliente_atualizado_em: string;
  updated_at?: string;
}

export function modeloParaRow(m: ModeloFvs): ModeloRow {
  return {
    id: m.id,
    codigo: m.codigo,
    nome: m.nome,
    servico: m.servico,
    descricao: m.descricao,
    versao: m.versao,
    ativo: m.ativo,
    estrutura: m.estrutura,
    cliente_atualizado_em: m.atualizadoEm,
  };
}

export function rowParaModelo(r: ModeloRow): ModeloFvs {
  return {
    id: r.id,
    codigo: r.codigo,
    nome: r.nome,
    servico: r.servico,
    descricao: r.descricao,
    versao: r.versao,
    ativo: r.ativo,
    estrutura: r.estrutura,
    atualizadoEm: r.cliente_atualizado_em,
  };
}

export function inspecaoParaRow(i: InspecaoFvs): InspecaoRow {
  return {
    id: i.id,
    modelo_id: i.modeloId,
    modelo_versao: i.modeloVersao,
    modelo_nome: i.modeloNome,
    modelo_codigo: i.modeloCodigo,
    estrutura: i.estrutura,
    local: i.local,
    empreendimento_ref: i.local.empreendimentoRef,
    identificador: i.identificador,
    fornecedor: i.fornecedor,
    responsavel: i.responsavel,
    data_atendimento: i.dataAtendimento,
    validade: i.validade,
    inspetor_id: i.inspetorId,
    inspetor_nome: i.inspetorNome,
    assinatura: i.assinatura,
    status: i.status,
    resultado: i.resultado,
    reinspecao_de: i.reinspecaoDe,
    itens_alvo: i.itensAlvo,
    observacoes: i.observacoes,
    respostas: i.respostas,
    fotos: i.fotos,
    iniciada_em: i.iniciadaEm,
    concluida_em: i.concluidaEm,
    cliente_atualizado_em: i.atualizadoEm,
  };
}

export function rowParaInspecao(r: InspecaoRow): InspecaoFvs {
  return {
    id: r.id,
    modeloId: r.modelo_id,
    modeloVersao: r.modelo_versao,
    modeloNome: r.modelo_nome,
    modeloCodigo: r.modelo_codigo,
    estrutura: r.estrutura,
    local: r.local,
    identificador: r.identificador ?? null,
    fornecedor: r.fornecedor ?? null,
    responsavel: r.responsavel ?? null,
    dataAtendimento: r.data_atendimento ?? null,
    validade: r.validade ?? null,
    inspetorId: r.inspetor_id,
    inspetorNome: r.inspetor_nome,
    assinatura: r.assinatura ?? null,
    status: r.status,
    resultado: r.resultado,
    reinspecaoDe: r.reinspecao_de,
    itensAlvo: r.itens_alvo,
    observacoes: r.observacoes,
    iniciadaEm: r.iniciada_em,
    concluidaEm: r.concluida_em,
    respostas: r.respostas ?? {},
    fotos: r.fotos ?? [],
    atualizadoEm: r.cliente_atualizado_em,
  };
}

export function ncParaRow(n: NaoConformidade): NcRow {
  return {
    id: n.id,
    inspecao_id: n.inspecaoId,
    item_id: n.itemId,
    item_texto: n.itemTexto,
    secao_titulo: n.secaoTitulo,
    modelo_nome: n.modeloNome,
    local: n.local,
    empreendimento_ref: n.local.empreendimentoRef,
    descricao: n.descricao,
    responsavel: n.responsavel,
    prazo: n.prazo,
    status: n.status,
    reinspecoes: n.reinspecoes,
    aberta_em: n.abertaEm,
    fechada_em: n.fechadaEm,
    cliente_atualizado_em: n.atualizadoEm,
  };
}

export function rowParaNc(r: NcRow): NaoConformidade {
  return {
    id: r.id,
    inspecaoId: r.inspecao_id,
    itemId: r.item_id,
    itemTexto: r.item_texto,
    secaoTitulo: r.secao_titulo,
    modeloNome: r.modelo_nome,
    local: r.local,
    descricao: r.descricao,
    responsavel: r.responsavel,
    // Postgres `date` já vem como YYYY-MM-DD.
    prazo: r.prazo,
    status: r.status,
    reinspecoes: r.reinspecoes ?? [],
    abertaEm: r.aberta_em,
    fechadaEm: r.fechada_em,
    atualizadoEm: r.cliente_atualizado_em,
  };
}

/** Caminho determinístico da foto no bucket `qualidade`. */
export function caminhoFoto(inspecaoId: string, fotoId: string): string {
  return `inspecoes/${inspecaoId}/${fotoId}.jpg`;
}
