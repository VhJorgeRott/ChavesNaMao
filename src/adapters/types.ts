/**
 * Contratos das integrações externas. Toda integração fica atrás de uma destas
 * interfaces; mock e live as implementam de forma idêntica, de modo que trocar
 * `VITE_ADAPTER_MODE=mock|live` não exige mudanças fora da camada de adapters.
 *
 * SEGURANÇA (SSRF — 8.4): implementações `live` só podem chamar endpoints
 * allow-listed (configurados por env no servidor). Nenhuma URL vem de input do
 * usuário. Segredos (API tokens) ficam no servidor, nunca no bundle.
 */

import type { AppUser, AuditEntry, Cliente, Empreendimento, Unidade } from '@/domain/types';
import type { TipoAtividade } from '@/domain/atividade';

// ---------------------------------------------------------------------------
// CRM (CV CRM) — cadastro de empreendimentos, unidades e dados do cliente
// ---------------------------------------------------------------------------
export interface CrmAdapter {
  getEmpreendimentos(): Promise<Empreendimento[]>;
  /** Unidades do empreendimento (mapa de disponibilidade do CV). */
  getUnidadesByEmpreendimento(empreendimentoId: string): Promise<Unidade[]>;
  /**
   * Cliente da unidade. Como a unidade em tela vem do ERP (Mega), que não
   * conhece o `idpessoa` do CV, a resolução usa uma dica de busca (`nome` ou
   * `documento`) já disponível no app para localizar a pessoa no cadastro do CV.
   */
  getClienteByUnidade(
    unidadeId: string,
    busca?: { nome?: string | null; documento?: string | null },
  ): Promise<Cliente>;
}

// ---------------------------------------------------------------------------
// ERP (Mega) — situação financeira da unidade
// ---------------------------------------------------------------------------
export interface SituacaoFinanceira {
  unidadeId: string;
  /** ID/nº do contrato como registrado no ERP (Mega). */
  numeroContrato: string;
  quitada: boolean;
  valorContrato: number;
  saldoDevedor: number;
  parcelasEmAberto: number;
  moeda: 'BRL';
}

/** Unidade vinda do ERP com dados agregados de contrato/cliente (evita N chamadas por unidade). */
export type UnidadeErp = Unidade & {
  contratoNumero: string | null;
  clienteNome: string | null;
};

export interface ErpAdapter {
  getSituacaoFinanceira(unidadeId: string): Promise<SituacaoFinanceira>;
  /**
   * Unidades do empreendimento no ERP (Mega, view de parcelas do Fabric).
   * O cruzamento CV↔Mega é feito pelo NOME do empreendimento (a view não
   * conhece o id do CV); só unidades com contrato aparecem.
   */
  getUnidadesByEmpreendimento(
    empreendimentoId: string,
    empreendimentoNome: string,
  ): Promise<UnidadeErp[]>;
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
// Portal do cliente (token de assinatura durável)
// ---------------------------------------------------------------------------
// O link de assinatura precisa funcionar em outro dispositivo. Por isso a
// geração/validação do token e o snapshot da entrega passam por esta interface:
// `mock` mantém tudo em memória (dev/testes); `live` chama Edge Functions
// (service_role) que persistem no Postgres. Em nenhum caso o token em claro é
// gravado — só o link enviado ao cliente o contém.

/** Dados enviados ao gerar o link: chaves externas (CV/Mega/mock) + exibição. */
export interface PortalSnapshot {
  entrega: { externalRef: string };
  empreendimento: { externalRef: string; nome: string; cidade: string; uf: string };
  unidade: { externalRef: string; identificacao: string; areaM2: number | null; status: string };
  cliente: {
    externalRef: string;
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
  };
}

/** Snapshot mínimo de exibição devolvido ao portal após validar o token. */
export interface PortalDelivery {
  entregaId: string;
  cliente: { nome: string; cpf: string };
  unidade: { identificacao: string; areaM2: number | null };
  empreendimento: { nome: string; cidade: string; uf: string };
}

export type PortalResolveResult = { ok: true; delivery: PortalDelivery } | { ok: false };
export type PortalAssinarResult = { ok: true; entregaId: string } | { ok: false };

export interface PortalAssinarInput {
  token: string;
  /** PNG do traço do canvas (dataURL). */
  pngDataUrl: string;
  geo: { lat: number; lng: number } | null;
  userAgent: string;
}

export interface PortalAdapter {
  /** Gera (e persiste, no live) o token de assinatura; devolve token em claro + URL. */
  gerarLink(snapshot: PortalSnapshot): Promise<{ token: string; url: string }>;
  /** Valida o token e devolve o snapshot de exibição, ou `{ ok: false }` genérico. */
  resolver(token: string): Promise<PortalResolveResult>;
  /** Registra a assinatura (uso único do token). */
  registrarAssinatura(input: PortalAssinarInput): Promise<PortalAssinarResult>;
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
// Admin — listagem de usuários e trilha de atividade (tela de admin)
// ---------------------------------------------------------------------------
export interface AtividadeFiltro {
  /** Restringe ao ator (user id). */
  actor?: string;
  /** Restringe ao tipo de evento (login/navegação/ação). */
  tipo?: TipoAtividade;
  /** Busca (ilike) no caminho navegado (metadata.path) — casa page.view. */
  rota?: string;
  /** Limite inferior/superior de data (ISO). */
  dataDe?: string;
  dataAte?: string;
  /** Página 0-based. */
  pagina?: number;
  /** Tamanho da página (padrão 20). */
  tamanho?: number;
}

/** Uma página de atividade + se há mais registros adiante. */
export interface AtividadePagina {
  itens: AuditEntry[];
  temMais: boolean;
}

export interface AdminAdapter {
  /** Todos os usuários da plataforma (live: RPC admin_list_users; mock: seed). */
  getUsuarios(): Promise<AppUser[]>;
  /** Página de atividade (mais recente primeiro) conforme os filtros. */
  getAtividade(filtro?: AtividadeFiltro): Promise<AtividadePagina>;
}

// ---------------------------------------------------------------------------
// Conjunto completo de adapters resolvido por ambiente
// ---------------------------------------------------------------------------
export interface Adapters {
  crm: CrmAdapter;
  erp: ErpAdapter;
  signature: SignatureAdapter;
  notification: NotificationAdapter;
  admin: AdminAdapter;
  portal: PortalAdapter;
}
