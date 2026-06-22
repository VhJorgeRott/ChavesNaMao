import type {
  AppUser,
  Assinatura,
  AuditEntry,
  Cliente,
  Documento,
  Empreendimento,
  Entrega,
  ItemEntrega,
  Unidade,
} from '@/domain/types';
import type { DbState } from './seed';

export interface EntregaResumo {
  entrega: Entrega;
  unidade: Unidade | undefined;
  empreendimento: Empreendimento | undefined;
  cliente: Cliente | undefined;
  responsavel: AppUser | undefined;
}

export interface EntregaDetalhe extends EntregaResumo {
  documentos: Documento[];
  assinatura: Assinatura | undefined;
  itens: ItemEntrega[];
  auditoria: AuditEntry[];
}

export interface UnidadeResumo {
  unidade: Unidade;
  empreendimento: Empreendimento | undefined;
  entregaAtiva: Entrega | undefined;
}

export function listarEntregas(state: DbState): EntregaResumo[] {
  return state.entregas.map((entrega) => resumoFromEntrega(state, entrega));
}

function resumoFromEntrega(state: DbState, entrega: Entrega): EntregaResumo {
  const unidade = state.unidades.find((u) => u.id === entrega.unidadeId);
  return {
    entrega,
    unidade,
    empreendimento: unidade
      ? state.empreendimentos.find((e) => e.id === unidade.empreendimentoId)
      : undefined,
    cliente: state.clientes.find((c) => c.id === entrega.clienteId),
    responsavel: state.usuarios.find((u) => u.id === entrega.responsavelId),
  };
}

export function getEntregaDetalhe(state: DbState, entregaId: string): EntregaDetalhe | null {
  const entrega = state.entregas.find((e) => e.id === entregaId);
  if (!entrega) return null;
  const resumo = resumoFromEntrega(state, entrega);
  return {
    ...resumo,
    documentos: state.documentos
      .filter((d) => d.entregaId === entregaId)
      .sort((a, b) => b.geradoEm.localeCompare(a.geradoEm)),
    assinatura: state.assinaturas.find((a) => a.entregaId === entregaId),
    itens: state.itens.filter((i) => i.entregaId === entregaId),
    auditoria: state.auditoria
      .filter((a) => a.entityId === entregaId)
      .sort((a, b) => b.at.localeCompare(a.at)),
  };
}

export function listarUnidades(state: DbState): UnidadeResumo[] {
  return state.unidades.map((unidade) => ({
    unidade,
    empreendimento: state.empreendimentos.find((e) => e.id === unidade.empreendimentoId),
    entregaAtiva: state.entregas.find(
      (e) => e.unidadeId === unidade.id && e.status !== 'CONCLUIDA',
    ),
  }));
}
