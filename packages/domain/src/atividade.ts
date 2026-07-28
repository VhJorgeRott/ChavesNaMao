/**
 * Taxonomia da trilha de atividade (tela de admin). Traduz os `action` crus do
 * audit_log para rótulos/ícones/tipos legíveis e gera uma descrição amigável.
 */
import {
  Activity,
  FileText,
  KeyRound,
  Link2,
  LogIn,
  LogOut,
  MousePointerClick,
  PenLine,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { AppUser, AuditEntry } from './types.js';

export type TipoAtividade = 'login' | 'navegacao' | 'acao';

/** Actions que compõem cada tipo — usadas pelo adapter para filtrar no servidor. */
export const ACOES_LOGIN = ['auth.login', 'auth.logout'] as const;
export const ACAO_NAVEGACAO = 'page.view';

export const TIPO_ATIVIDADE_META: Record<TipoAtividade, { label: string; color: string }> = {
  login: { label: 'Login/Logout', color: '#0ea5e9' },
  navegacao: { label: 'Navegação', color: '#8b5cf6' },
  acao: { label: 'Ação', color: '#f29f05' },
};

export interface AtividadeMeta {
  label: string;
  tipo: TipoAtividade;
  icon: LucideIcon;
}

const META: Record<string, AtividadeMeta> = {
  'auth.login': { label: 'Login', tipo: 'login', icon: LogIn },
  'auth.logout': { label: 'Logout', tipo: 'login', icon: LogOut },
  'page.view': { label: 'Navegação', tipo: 'navegacao', icon: MousePointerClick },
  ENTREGA_INICIADA: { label: 'Iniciou uma entrega', tipo: 'acao', icon: KeyRound },
  ENTREGA_CONCLUIDA: { label: 'Concluiu uma entrega', tipo: 'acao', icon: KeyRound },
  DOCUMENTO_GERADO: { label: 'Gerou um documento', tipo: 'acao', icon: FileText },
  LINK_ASSINATURA_GERADO: { label: 'Gerou link de assinatura', tipo: 'acao', icon: Link2 },
  ITEM_REGISTRADO: { label: 'Registrou um item', tipo: 'acao', icon: FileText },
  ASSINATURA_REGISTRADA: { label: 'Registrou uma assinatura', tipo: 'acao', icon: PenLine },
  PAPEL_ALTERADO: { label: 'Alterou um papel', tipo: 'acao', icon: ShieldCheck },
  MODELO_CRIADO: { label: 'Criou um modelo', tipo: 'acao', icon: FileText },
  MODELO_ATUALIZADO: { label: 'Atualizou um modelo', tipo: 'acao', icon: FileText },
  MODELO_REMOVIDO: { label: 'Removeu um modelo', tipo: 'acao', icon: FileText },
  'account.delete_self': { label: 'Excluiu a própria conta', tipo: 'acao', icon: ShieldCheck },
};

/** Metadados de uma ação. Etapas (`ETAPA_*`) e ações desconhecidas caem em "Ação". */
export function metaDaAtividade(action: string): AtividadeMeta {
  const conhecida = META[action];
  if (conhecida) return conhecida;
  if (action.startsWith('ETAPA_')) {
    return { label: 'Avançou uma etapa', tipo: 'acao', icon: KeyRound };
  }
  return { label: action, tipo: 'acao', icon: Activity };
}

/** Descrição legível de um evento, incluindo o caminho navegado quando houver. */
export function descreverAtividade(entry: AuditEntry): string {
  const meta = metaDaAtividade(entry.action);
  if (entry.action === 'page.view') {
    const path = typeof entry.metadata.path === 'string' ? entry.metadata.path : '';
    return path ? `Abriu a tela ${path}` : 'Navegou pela plataforma';
  }
  if (entry.action === 'auth.login') return 'Entrou na plataforma';
  if (entry.action === 'auth.logout') return 'Saiu da plataforma';
  return meta.label;
}

/** Nome do ator a partir do id, com fallback amigável para o portal do cliente. */
export function nomeDoAtor(actor: string, usuariosById: Map<string, AppUser>): string {
  if (actor.startsWith('cliente:')) return 'Cliente (portal)';
  return usuariosById.get(actor)?.nome ?? actor;
}
