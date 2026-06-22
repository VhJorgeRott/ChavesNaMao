/**
 * Contratos das integrações externas. Toda integração fica atrás de uma destas
 * interfaces; mock e live as implementam de forma idêntica, de modo que trocar
 * `VITE_ADAPTER_MODE=mock|live` não exige mudanças fora da camada de adapters.
 *
 * SEGURANÇA (SSRF — 8.4): implementações `live` só podem chamar endpoints
 * allow-listed (configurados por env no servidor). Nenhuma URL vem de input do
 * usuário. Segredos (API tokens) ficam no servidor, nunca no bundle.
 */

import type { Cliente } from '@/domain/types';

// ---------------------------------------------------------------------------
// CRM (CV CRM) — dados do cliente a partir da unidade
// ---------------------------------------------------------------------------
export interface CrmAdapter {
  getClienteByUnidade(unidadeId: string): Promise<Cliente>;
}

// ---------------------------------------------------------------------------
// ERP (Mega) — situação financeira da unidade
// ---------------------------------------------------------------------------
export interface SituacaoFinanceira {
  unidadeId: string;
  quitada: boolean;
  valorContrato: number;
  saldoDevedor: number;
  parcelasEmAberto: number;
  moeda: 'BRL';
}

export interface ErpAdapter {
  getSituacaoFinanceira(unidadeId: string): Promise<SituacaoFinanceira>;
}

// ---------------------------------------------------------------------------
// Assinatura (Clicksign) — validade jurídica (MP 2.200-2)
// ---------------------------------------------------------------------------
export interface Signatario {
  nome: string;
  email: string;
  cpf: string;
}

export interface DocumentoParaAssinar {
  entregaId: string;
  documentoId: string;
  nomeArquivo: string;
  mimeType: string;
  /** Hash do PDF gerado — garante integridade do que vai para a assinatura. */
  sha256Hash: string;
  /** Conteúdo do documento em base64 (o PDF privado do Storage). */
  conteudoBase64: string;
  signatario: Signatario;
}

export interface SignatureRef {
  provider: 'clicksign' | 'mock';
  /** Chave do documento no provedor (assinaturas.clicksign_doc_key). */
  documentKey: string;
  /** URL de assinatura, quando o provedor a fornece. */
  signUrl?: string;
}

export type SignatureState = 'pending' | 'signed' | 'canceled' | 'error';

export interface SignatureStatus {
  state: SignatureState;
  signedAt: string | null;
  /** Identificador do provedor (assinaturas.clicksign_status). */
  providerStatus: string;
}

export interface SignatureAdapter {
  enviarParaAssinatura(doc: DocumentoParaAssinar): Promise<SignatureRef>;
  consultarStatus(ref: SignatureRef): Promise<SignatureStatus>;
}

// ---------------------------------------------------------------------------
// Notificações (e-mail) — eventos-chave
// ---------------------------------------------------------------------------
export type NotificationEvent =
  | {
      tipo: 'LINK_ASSINATURA_GERADO';
      /** Único dado sensível permitido no corpo; segue as regras de token (8.2). */
      para: string;
      entregaId: string;
      linkAssinatura: string;
    }
  | { tipo: 'ASSINATURA_CONCLUIDA'; para: string; entregaId: string }
  | { tipo: 'ENTREGA_FINALIZADA'; para: string; entregaId: string };

export interface NotificationResult {
  enviado: boolean;
  provider: string;
  messageId: string | null;
}

export interface NotificationAdapter {
  notificar(event: NotificationEvent): Promise<NotificationResult>;
}

// ---------------------------------------------------------------------------
// Conjunto completo de adapters resolvido por ambiente
// ---------------------------------------------------------------------------
export interface Adapters {
  crm: CrmAdapter;
  erp: ErpAdapter;
  signature: SignatureAdapter;
  notification: NotificationAdapter;
}
