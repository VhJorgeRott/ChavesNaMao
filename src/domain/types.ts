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

export interface Documento {
  id: string;
  entregaId: string;
  tipo: string;
  storagePath: string;
  sha256Hash: string;
  geradoEm: string;
}

export interface Assinatura {
  id: string;
  entregaId: string;
  documentoId: string;
  canvasPngPath: string | null;
  metodo: MetodoAssinatura;
  ip: string | null;
  userAgent: string | null;
  geo: { lat: number; lng: number } | null;
  assinadaEm: string | null;
  clicksignDocKey: string | null;
  clicksignStatus: string | null;
}

export interface AccessTokenRec {
  id: string;
  entregaId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  scope: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  at: string;
}

export interface AppUser {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ultimaAtividade: string | null;
}
