import type { SituacaoFinanceira } from '@/adapters/types';
import { formatCpf } from '@/lib/cpf';
import { fArea, fData, fMoeda } from '@/lib/format';
import type { Cliente, Empreendimento, Unidade } from './types';

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
}

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
    itens: [{ chave: 'data.hoje', label: 'Data de hoje' }],
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
