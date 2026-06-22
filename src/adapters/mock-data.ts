/**
 * Dados sintéticos plausíveis de uma incorporadora brasileira, usados pelos
 * adapters `mock`. CPFs são gerados com dígitos verificadores VÁLIDOS, porém
 * sintéticos (não pertencem a pessoas reais).
 */

import type { Cliente, Empreendimento, Unidade } from '@/domain/types';
import type { SituacaoFinanceira } from './types';

/** Completa um prefixo de 9 dígitos com os 2 verificadores, gerando CPF válido. */
function gerarCpfValido(prefixo9: string): string {
  const calc = (base: string): number => {
    let sum = 0;
    const len = base.length;
    for (let i = 0; i < len; i++) sum += parseInt(base[i]!, 10) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(prefixo9);
  const d2 = calc(prefixo9 + d1);
  const full = `${prefixo9}${d1}${d2}`;
  return full.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export const empreendimentos: Empreendimento[] = [
  {
    id: 'emp-0001',
    nome: 'Residencial Jardim das Acácias',
    cidade: 'Maringá',
    uf: 'PR',
    createdAt: '2024-01-15T12:00:00Z',
  },
  {
    id: 'emp-0002',
    nome: 'Loteamento Terras do Lago',
    cidade: 'Cascavel',
    uf: 'PR',
    createdAt: '2024-03-02T12:00:00Z',
  },
];

export const unidades: Unidade[] = [
  {
    id: 'uni-0001',
    empreendimentoId: 'emp-0001',
    identificacao: 'Quadra A, Lote 12',
    status: 'LIBERADA',
    areaM2: 250,
    createdAt: '2024-02-01T12:00:00Z',
  },
  {
    id: 'uni-0002',
    empreendimentoId: 'emp-0001',
    identificacao: 'Quadra A, Lote 13',
    status: 'QUITADA',
    areaM2: 250,
    createdAt: '2024-02-01T12:00:00Z',
  },
  {
    id: 'uni-0003',
    empreendimentoId: 'emp-0001',
    identificacao: 'Quadra B, Lote 04',
    status: 'VENDIDA',
    areaM2: 312.5,
    createdAt: '2024-02-10T12:00:00Z',
  },
  {
    id: 'uni-0004',
    empreendimentoId: 'emp-0002',
    identificacao: 'Quadra 7, Lote 21',
    status: 'EM_OBRAS',
    areaM2: 420,
    createdAt: '2024-04-01T12:00:00Z',
  },
  {
    id: 'uni-0005',
    empreendimentoId: 'emp-0002',
    identificacao: 'Quadra 7, Lote 22',
    status: 'LIBERADA',
    areaM2: 420,
    createdAt: '2024-04-01T12:00:00Z',
  },
];

export const clientes: Cliente[] = [
  {
    id: 'cli-0001',
    nome: 'Mariana Oliveira Souza',
    cpf: gerarCpfValido('111444777'),
    email: 'mariana.souza@example.com',
    telefone: '+55 44 99876-5432',
    createdAt: '2024-02-05T12:00:00Z',
  },
  {
    id: 'cli-0002',
    nome: 'Rafael Pereira Lima',
    cpf: gerarCpfValido('529982247'),
    email: 'rafael.lima@example.com',
    telefone: '+55 44 99765-4321',
    createdAt: '2024-02-06T12:00:00Z',
  },
  {
    id: 'cli-0003',
    nome: 'Carla Mendes Ribeiro',
    cpf: gerarCpfValido('390533447'),
    email: 'carla.ribeiro@example.com',
    telefone: '+55 45 99654-3210',
    createdAt: '2024-04-12T12:00:00Z',
  },
];

/** Vínculo unidade → cliente (para o CRM mock resolver getClienteByUnidade). */
export const unidadeCliente: Record<string, string> = {
  'uni-0001': 'cli-0001',
  'uni-0002': 'cli-0002',
  'uni-0003': 'cli-0002',
  'uni-0005': 'cli-0003',
};

/** Situação financeira por unidade (ERP mock). */
export const situacaoFinanceira: Record<string, SituacaoFinanceira> = {
  'uni-0001': {
    unidadeId: 'uni-0001',
    quitada: false,
    valorContrato: 320000,
    saldoDevedor: 48000,
    parcelasEmAberto: 6,
    moeda: 'BRL',
  },
  'uni-0002': {
    unidadeId: 'uni-0002',
    quitada: true,
    valorContrato: 285000,
    saldoDevedor: 0,
    parcelasEmAberto: 0,
    moeda: 'BRL',
  },
  'uni-0005': {
    unidadeId: 'uni-0005',
    quitada: false,
    valorContrato: 510000,
    saldoDevedor: 102000,
    parcelasEmAberto: 12,
    moeda: 'BRL',
  },
};
