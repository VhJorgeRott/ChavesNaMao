
import { formatCpf } from './cpf.js';
import { fArea, fData, fMoeda } from './format.js';
import type { Cliente, Empreendimento, SituacaoFinanceira, Unidade } from './types.js';

/**
 * Motor de variáveis dos modelos de termo. As variáveis usam o formato
 * `{{grupo.campo}}` e são resolvidas, na geração, com os dados da unidade:
 * cliente (CRM), unidade/empreendimento e situação financeira (ERP).
 */

export interface TermoContexto {
  cliente?: Cliente;
  unidade?: Unidade;
  empreendimento?: Empreendimento;
  financeiro?: SituacaoFinanceira;
  /**
   * Valores manuais para campos sem fonte automática (ex.: matrícula do imóvel,
   * cartório, valores por extenso, dados do credor). Indexados pela chave da
   * variável (`{{grupo.campo}}`). Ausentes renderizam vazio (linha preenchível).
   */
  extras?: Record<string, string>;
}

/** Resolvedor de um campo manual: lê de `extras` pela chave, ou vazio. */
const extra =
  (chave: string) =>
  (c: TermoContexto): string =>
    c.extras?.[chave] ?? '';

/** Resolvedores por chave de variável. */
const RESOLVERS: Record<string, (c: TermoContexto) => string> = {
  'cliente.nome': (c) => c.cliente?.nome ?? '',
  'cliente.cpf': (c) => (c.cliente ? formatCpf(c.cliente.cpf) : ''),
  'cliente.email': (c) => c.cliente?.email ?? '',
  'cliente.telefone': (c) => c.cliente?.telefone ?? '',
  'unidade.identificacao': (c) => c.unidade?.identificacao ?? '',
  'unidade.area': (c) => (c.unidade ? fArea(c.unidade.areaM2) : ''),
  'empreendimento.nome': (c) => c.empreendimento?.nome ?? '',
  'empreendimento.cidade': (c) => c.empreendimento?.cidade ?? '',
  'empreendimento.uf': (c) => c.empreendimento?.uf ?? '',
  'financeiro.contrato': (c) => c.financeiro?.numeroContrato ?? '',
  'financeiro.valorContrato': (c) => (c.financeiro ? fMoeda(c.financeiro.valorContrato) : ''),
  'financeiro.saldoDevedor': (c) => (c.financeiro ? fMoeda(c.financeiro.saldoDevedor) : ''),
  'financeiro.parcelasEmAberto': (c) =>
    c.financeiro ? String(c.financeiro.parcelasEmAberto) : '',
  'data.hoje': () => fData(new Date()),
  // --- Campos adicionais da Confissão de Dívida (manuais via `extras`) ---
  'credor.razaoSocial': (c) =>
    c.extras?.['credor.razaoSocial'] || 'Rottas Construtora e Incorporadora Ltda.',
  'credor.cnpj': extra('credor.cnpj'),
  'credor.endereco': extra('credor.endereco'),
  'cliente.rg': extra('cliente.rg'),
  'cliente.nacionalidade': extra('cliente.nacionalidade'),
  'cliente.estadoCivil': extra('cliente.estadoCivil'),
  'cliente.profissao': extra('cliente.profissao'),
  'cliente.endereco': extra('cliente.endereco'),
  'imovel.matricula': extra('imovel.matricula'),
  'imovel.cartorio': extra('imovel.cartorio'),
  'imovel.quadra': extra('imovel.quadra'),
  'imovel.lote': extra('imovel.lote'),
  'divida.valorTotal': extra('divida.valorTotal'),
  'divida.valorTotalExtenso': extra('divida.valorTotalExtenso'),
  'divida.valorEntrada': extra('divida.valorEntrada'),
  'divida.numeroParcelas': extra('divida.numeroParcelas'),
  'divida.valorParcela': extra('divida.valorParcela'),
  'divida.valorParcelaExtenso': extra('divida.valorParcelaExtenso'),
  'divida.vencimentoPrimeira': extra('divida.vencimentoPrimeira'),
  'divida.indiceCorrecao': extra('divida.indiceCorrecao'),
  'divida.jurosMora': extra('divida.jurosMora'),
  'divida.multaAtraso': extra('divida.multaAtraso'),
  'divida.formaPagamento': extra('divida.formaPagamento'),
  'geral.foro': extra('geral.foro'),
  'geral.testemunha1': extra('geral.testemunha1'),
  'geral.testemunha2': extra('geral.testemunha2'),
};

export interface VariavelInfo {
  chave: string;
  label: string;
}

export interface GrupoVariaveis {
  grupo: string;
  itens: VariavelInfo[];
}

/** Catálogo de variáveis disponíveis, agrupado para a UI. */
export const CATALOGO_VARIAVEIS: GrupoVariaveis[] = [
  {
    grupo: 'Cliente',
    itens: [
      { chave: 'cliente.nome', label: 'Nome' },
      { chave: 'cliente.cpf', label: 'CPF' },
      { chave: 'cliente.email', label: 'E-mail' },
      { chave: 'cliente.telefone', label: 'Telefone' },
    ],
  },
  {
    grupo: 'Unidade',
    itens: [
      { chave: 'unidade.identificacao', label: 'Identificação' },
      { chave: 'unidade.area', label: 'Área' },
      { chave: 'empreendimento.nome', label: 'Empreendimento' },
      { chave: 'empreendimento.cidade', label: 'Cidade' },
      { chave: 'empreendimento.uf', label: 'UF' },
    ],
  },
  {
    grupo: 'Financeiro (ERP)',
    itens: [
      { chave: 'financeiro.contrato', label: 'Nº do contrato' },
      { chave: 'financeiro.valorContrato', label: 'Valor do contrato' },
      { chave: 'financeiro.saldoDevedor', label: 'Saldo devedor (a pagar)' },
      { chave: 'financeiro.parcelasEmAberto', label: 'Parcelas em aberto' },
    ],
  },
  {
    grupo: 'Geral',
    itens: [
      { chave: 'data.hoje', label: 'Data de hoje' },
      { chave: 'geral.foro', label: 'Foro (comarca)' },
      { chave: 'geral.testemunha1', label: 'Testemunha 1' },
      { chave: 'geral.testemunha2', label: 'Testemunha 2' },
    ],
  },
  {
    grupo: 'Credor',
    itens: [
      { chave: 'credor.razaoSocial', label: 'Razão social' },
      { chave: 'credor.cnpj', label: 'CNPJ' },
      { chave: 'credor.endereco', label: 'Endereço' },
    ],
  },
  {
    grupo: 'Devedor (dados adicionais)',
    itens: [
      { chave: 'cliente.rg', label: 'RG' },
      { chave: 'cliente.nacionalidade', label: 'Nacionalidade' },
      { chave: 'cliente.estadoCivil', label: 'Estado civil' },
      { chave: 'cliente.profissao', label: 'Profissão' },
      { chave: 'cliente.endereco', label: 'Endereço' },
    ],
  },
  {
    grupo: 'Imóvel',
    itens: [
      { chave: 'imovel.matricula', label: 'Matrícula' },
      { chave: 'imovel.cartorio', label: 'Cartório de registro' },
      { chave: 'imovel.quadra', label: 'Quadra' },
      { chave: 'imovel.lote', label: 'Lote' },
    ],
  },
  {
    grupo: 'Dívida (Confissão)',
    itens: [
      { chave: 'divida.valorTotal', label: 'Valor total' },
      { chave: 'divida.valorTotalExtenso', label: 'Valor total (por extenso)' },
      { chave: 'divida.valorEntrada', label: 'Valor de entrada' },
      { chave: 'divida.numeroParcelas', label: 'Nº de parcelas' },
      { chave: 'divida.valorParcela', label: 'Valor da parcela' },
      { chave: 'divida.valorParcelaExtenso', label: 'Valor da parcela (por extenso)' },
      { chave: 'divida.vencimentoPrimeira', label: 'Vencimento da 1ª parcela' },
      { chave: 'divida.indiceCorrecao', label: 'Índice de correção' },
      { chave: 'divida.jurosMora', label: 'Juros de mora' },
      { chave: 'divida.multaAtraso', label: 'Multa por atraso' },
      { chave: 'divida.formaPagamento', label: 'Forma de pagamento' },
    ],
  },
];

const VAR_REGEX = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Resolve as variáveis `{{...}}` do template com o contexto. Variáveis
 * desconhecidas são mantidas como estão (ajuda a flagrar erros de digitação).
 */
export function renderTermo(conteudo: string, ctx: TermoContexto): string {
  return conteudo.replace(VAR_REGEX, (match, chave: string) => {
    const resolver = RESOLVERS[chave];
    return resolver ? resolver(ctx) : match;
  });
}

/** Lista as variáveis usadas no template que não existem no catálogo. */
export function variaveisInvalidas(conteudo: string): string[] {
  const invalidas = new Set<string>();
  for (const m of conteudo.matchAll(VAR_REGEX)) {
    const chave = m[1]!;
    if (!RESOLVERS[chave]) invalidas.add(chave);
  }
  return [...invalidas];
}

/**
 * Variáveis do template que ficariam VAZIAS com este contexto.
 *
 * Diferente de `variaveisInvalidas`, que acusa erro de digitação: aqui a
 * variável existe, mas não há dado para ela. É o que permite recusar o envio de
 * uma confissão de dívida sem o valor da dívida — um documento com validade
 * jurídica e a cláusula principal em branco é pior do que documento nenhum.
 */
export function variaveisVazias(conteudo: string, ctx: TermoContexto): string[] {
  const vazias = new Set<string>();
  for (const m of conteudo.matchAll(VAR_REGEX)) {
    const chave = m[1]!;
    const resolver = RESOLVERS[chave];
    if (resolver && resolver(ctx).trim() === '') vazias.add(chave);
  }
  return [...vazias];
}
