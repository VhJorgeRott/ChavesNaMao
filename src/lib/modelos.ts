import {
  TIPOS_MODELO,
  type ModalidadeModelo,
  type ModeloTermo,
  type TipoModelo,
} from '@chaves/domain/types';

/**
 * Dados de exibição dos modelos de termo (listagem e editor).
 *
 * Tipo e modalidade vêm das colunas da tabela; modelos gravados antes delas
 * (null) caem na inferência pelo nome/título. "Padrão" ainda é lido do nome.
 */

const sem = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const PALAVRAS_TIPO: Record<TipoModelo, string> = {
  'Entrega de chaves': 'entrega de chaves',
  'Confissão de dívida': 'confissao de divida',
  Distrato: 'distrato',
  'Aditivo contratual': 'aditivo',
};

/** Divide o texto em trechos, isolando cada `{{variável}}` num item próprio. */
export const partesTermo = (texto: string): string[] =>
  texto.split(/(\{\{[^}]+\}\})/).filter(Boolean);

/** Chave de um trecho `{{ grupo.campo }}`, ou null se for texto comum. */
export const chaveVariavel = (trecho: string): string | null =>
  trecho.startsWith('{{') && trecho.endsWith('}}') ? trecho.slice(2, -2).trim() : null;

export interface ModeloClassificado {
  /** Primeira linha não vazia do conteúdo (o título do documento). */
  titulo: string;
  /** Resto do conteúdo, em uma linha, para a prévia. */
  corpo: string;
  tipo: TipoModelo | null;
  modalidade: ModalidadeModelo;
  padrao: boolean;
  /** Variáveis {{...}} distintas usadas no conteúdo. */
  variaveis: number;
}

export function classificarModelo(
  m: Pick<ModeloTermo, 'nome' | 'conteudo' | 'tipo' | 'modalidade'>,
): ModeloClassificado {
  const linhas = m.conteudo.split('\n');
  const i = linhas.findIndex((l) => l.trim() !== '');
  const titulo = i === -1 ? '' : linhas[i]!.trim();
  const corpo = linhas
    .slice(i + 1)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const texto = sem(`${m.nome} ${titulo}`);
  return {
    titulo,
    corpo,
    tipo: m.tipo ?? TIPOS_MODELO.find((t) => texto.includes(PALAVRAS_TIPO[t])) ?? null,
    // Sem menção explícita a venda direta, o termo é o do fluxo de financiamento.
    modalidade:
      m.modalidade ?? (sem(m.nome).includes('venda direta') ? 'Venda direta' : 'Financiamento'),
    padrao: sem(m.nome).includes('(padrao)'),
    variaveis: new Set(partesTermo(m.conteudo).map(chaveVariavel).filter(Boolean)).size,
  };
}
