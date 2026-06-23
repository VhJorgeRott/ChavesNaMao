import { describe, expect, it } from 'vitest';
import type { SituacaoFinanceira } from '@/adapters/types';
import { renderTermo, variaveisInvalidas, type TermoContexto } from './termo';
import type { Cliente, Empreendimento, Unidade } from './types';

const cliente: Cliente = {
  id: 'cli-1',
  nome: 'Mariana Souza',
  cpf: '11144477735',
  email: 'm@example.com',
  telefone: '+55 44 90000-0000',
  createdAt: '2026-01-01T00:00:00Z',
};
const unidade: Unidade = {
  id: 'uni-1',
  empreendimentoId: 'emp-1',
  identificacao: 'Quadra A, Lote 12',
  status: 'LIBERADA',
  areaM2: 250,
  createdAt: '2026-01-01T00:00:00Z',
};
const empreendimento: Empreendimento = {
  id: 'emp-1',
  nome: 'Jardim das Acácias',
  cidade: 'Maringá',
  uf: 'PR',
  createdAt: '2026-01-01T00:00:00Z',
};
const financeiro: SituacaoFinanceira = {
  unidadeId: 'uni-1',
  numeroContrato: 'CT-2024-1042',
  quitada: false,
  valorContrato: 320000,
  saldoDevedor: 48000,
  parcelasEmAberto: 6,
  moeda: 'BRL',
};
const ctx: TermoContexto = { cliente, unidade, empreendimento, financeiro };

describe('renderTermo', () => {
  it('resolve variáveis conhecidas com os dados do contexto', () => {
    const out = renderTermo(
      'Cliente {{cliente.nome}} — unidade {{unidade.identificacao}} — contrato {{financeiro.contrato}}',
      ctx,
    );
    expect(out).toContain('Mariana Souza');
    expect(out).toContain('Quadra A, Lote 12');
    expect(out).toContain('CT-2024-1042');
    expect(out).not.toContain('{{');
  });

  it('formata os valores financeiros e o CPF', () => {
    expect(renderTermo('{{financeiro.saldoDevedor}}', ctx)).toContain('48.000');
    expect(renderTermo('{{financeiro.parcelasEmAberto}}', ctx)).toBe('6');
    expect(renderTermo('{{cliente.cpf}}', ctx)).toBe('111.444.777-35');
  });

  it('aceita espaços dentro das chaves', () => {
    expect(renderTermo('{{  cliente.nome  }}', ctx)).toBe('Mariana Souza');
  });

  it('mantém variáveis desconhecidas intactas', () => {
    expect(renderTermo('oi {{foo.bar}} fim', ctx)).toBe('oi {{foo.bar}} fim');
  });

  it('campos ausentes no contexto viram string vazia', () => {
    expect(renderTermo('[{{cliente.nome}}]', {})).toBe('[]');
  });
});

describe('variaveisInvalidas', () => {
  it('lista apenas as chaves fora do catálogo, sem duplicar', () => {
    expect(variaveisInvalidas('{{cliente.nome}} {{foo.bar}} {{foo.bar}} {{x.y}}')).toEqual([
      'foo.bar',
      'x.y',
    ]);
  });
  it('retorna vazio quando todas são válidas', () => {
    expect(variaveisInvalidas('{{cliente.nome}} {{financeiro.saldoDevedor}}')).toEqual([]);
  });
});
