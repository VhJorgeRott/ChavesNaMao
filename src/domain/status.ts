import type { EntregaStatus, Papel, UnidadeStatus } from './types';

/**
 * Metadados de apresentação dos status de domínio: rótulo legível + cor.
 * As cores seguem o padrão de pill translúcida (`${color}26` = ~15% alpha) do
 * design system (ver tabelas.md → StatusBadge).
 */

export interface StatusMeta {
  label: string;
  color: string; // hex
}

export const ENTREGA_STATUS_META: Record<EntregaStatus, StatusMeta> = {
  ABERTURA: { label: 'Abertura', color: '#64748b' },
  INTEGRACAO: { label: 'Integração', color: '#3b82f6' },
  DOCUMENTOS: { label: 'Documentos', color: '#8b5cf6' },
  ASSINATURA: { label: 'Assinatura', color: '#f59e0b' },
  REGISTRO: { label: 'Registro', color: '#0ea5e9' },
  CONCLUIDA: { label: 'Concluída', color: '#22c55e' },
};

export const UNIDADE_STATUS_META: Record<UnidadeStatus, StatusMeta> = {
  EM_OBRAS: { label: 'Em obras', color: '#9ca3af' },
  DISPONIVEL: { label: 'Disponível', color: '#3b82f6' },
  VENDIDA: { label: 'Vendida', color: '#8b5cf6' },
  QUITADA: { label: 'Quitada', color: '#14b8a6' },
  LIBERADA: { label: 'Liberada', color: '#f29f05' },
  ENTREGUE: { label: 'Entregue', color: '#22c55e' },
};

export const PAPEL_META: Record<Papel, StatusMeta> = {
  admin: { label: 'Administrador', color: '#f29f05' },
  equipe_entrega: { label: 'Equipe de entrega', color: '#64748b' },
};
