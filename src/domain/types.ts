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

/** Status relevantes para a operação de entrega (exibidos nas telas). */
export const UNIDADE_STATUS_VISIVEIS: readonly UnidadeStatus[] = [
  'EM_OBRAS',
  'VENDIDA',
  'LIBERADA',
  'ENTREGUE',
];

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
  /** Extras opcionais vindos do CRM (live): foto, disponibilidade e situação da obra. */
  foto?: string | null;
  unidadesDisponiveis?: number | null;
  situacaoObra?: string | null;
}

export interface Unidade {
  id: string;
  empreendimentoId: string;
  identificacao: string;
  status: UnidadeStatus;
  /** Área privativa em m². `null` quando a integração de origem não informa (ex.: Mega). */
  areaM2: number | null;
  /**
   * Cliente inadimplente no contrato vigente (classificação do Mega). Três
   * estados: `true`/`false` quando o ERP (Mega) informa; `undefined` quando a
   * origem não conhece (seed/mock/CRM) — nesse caso o selo não é exibido.
   */
  inadimplente?: boolean | undefined;
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

/**
 * Tipos de termo do processo de entrega. A Confissão de Dívida é enviada pela CR
 * e assinada eletronicamente (Clicksign); o Recebimento de Chaves é assinado
 * presencialmente (canvas) no dia da entrega, pelo cliente e pela equipe de AT.
 * O valor é o próprio rótulo exibido (Documento.tipo é texto livre).
 */
export const TIPO_DOCUMENTO = {
  CONFISSAO_DIVIDA: 'Termo de Confissão de Dívida',
  RECEBIMENTO_CHAVES: 'Termo de Recebimento de Chaves',
} as const;
export type TipoDocumento = (typeof TIPO_DOCUMENTO)[keyof typeof TIPO_DOCUMENTO];

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
  /** Foto do usuário (user_metadata do Entra); null → fallback de iniciais. */
  avatarUrl: string | null;
  /** Data de cadastro (auth.users.created_at). */
  criadoEm: string | null;
}

export interface ModeloTermo {
  id: string;
  nome: string;
  /** Texto do termo com variáveis no formato {{grupo.campo}}. */
  conteudo: string;
  createdAt: string;
  updatedAt: string;
}
