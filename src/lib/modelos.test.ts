import { describe, expect, it } from 'vitest';
import { classificarModelo } from './modelos';

describe('classificarModelo', () => {
  it('infere tipo/modalidade quando as colunas estão vazias', () => {
    const m = classificarModelo({
      nome: 'Termo de Confissão de Dívida (Venda Direta)',
      conteudo:
        '\nINSTRUMENTO PARTICULAR DE CONFISSÃO DE DÍVIDA\n\n{{cliente.nome}} deve {{ divida.valor }} a {{cliente.nome}}.',
      tipo: null,
      modalidade: null,
    });
    expect(m).toEqual({
      titulo: 'INSTRUMENTO PARTICULAR DE CONFISSÃO DE DÍVIDA',
      corpo: '{{cliente.nome}} deve {{ divida.valor }} a {{cliente.nome}}.',
      tipo: 'Confissão de dívida',
      modalidade: 'Venda direta',
      padrao: false,
      variaveis: 2,
    });
    const p = classificarModelo({
      nome: 'Termo de Entrega de Chaves (padrão)',
      conteudo: 'TERMO\nx',
      tipo: null,
      modalidade: null,
    });
    expect([p.tipo, p.modalidade, p.padrao]).toEqual(['Entrega de chaves', 'Financiamento', true]);
  });

  it('usa o valor gravado quando existe', () => {
    const m = classificarModelo({
      nome: 'Termo de Entrega de Chaves',
      conteudo: '',
      tipo: 'Distrato',
      modalidade: 'Venda direta',
    });
    expect([m.tipo, m.modalidade]).toEqual(['Distrato', 'Venda direta']);
  });
});
