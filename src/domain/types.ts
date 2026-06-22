/**
 * Tipos de domínio compartilhados entre UI, adapters e validação.
 * Espelham os enums e tabelas do Postgres (ver supabase/migrations).
 */

// --- Enums (espelham tipos Postgres) ---

export const UNIDADE_STATUS = [
  'EM_OBRAS',
  'DISPONIVEL',
  'VENDIDA',
  'QUITADA',
  'LIBERADA',
  'ENTREGUE',
] as const;
export type UnidadeStatus = (typeof UNIDADE_STATUS)[number];

/** Estados em que uma entrega pode ser iniciada (regra de negócio). */
export const UNIDADE_STATUS_LIBERADO_PARA_ENTREGA: readonly UnidadeStatus[] = ['LIBERADA', 'QUITADA'];

export const ENTREGA_STATUS = [
  'ABERTURA',
  'INTEGRACAO',
  'DOCUMENTOS',
  'ASSINATURA',
  'REGISTRO',
  'CONCLUIDA',
] as const;
export type EntregaStatus = (typeof ENTREGA_STATUS)[number];

export const METODO_ASSINATURA = ['CANVAS', 'CLICKSIGN'] as const;
export type MetodoAssinatura = (typeof METODO_ASSINATURA)[number];

export const PAPEL = ['admin', 'equipe_entrega'] as const;
export type Papel = (typeof PAPEL)[number];

// --- Entidades ---

export interface Empreendimento {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  createdAt: string;
}

export interface Unidade {
  id: string;
  empreendimentoId: string;
  identificacao: string;
  status: UnidadeStatus;
  areaM2: number;
  createdAt: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  createdAt: string;
}

export interface Entrega {
  id: string;
  unidadeId: string;
  clienteId: string;
  status: EntregaStatus;
  responsavelId: string;
  iniciadaEm: string | null;
  concluidaEm: string | null;
  createdAt: string;
}

export interface ItemEntrega {
  id: string;
  entregaId: string;
  descricao: string;
  quantidade: number;
}
