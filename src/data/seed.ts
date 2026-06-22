/**
 * Estado inicial do store em memória (demo). Reaproveita os dados sintéticos dos
 * adapters mock como fonte única para empreendimentos, unidades e clientes, e
 * adiciona entregas em diferentes etapas para popular as telas.
 *
 * Em produção este estado vem do Supabase (com RLS); aqui é só para renderizar e
 * navegar as páginas sem backend conectado.
 */

import {
  clientes as mockClientes,
  empreendimentos as mockEmpreendimentos,
  unidades as mockUnidades,
} from '@/adapters/mock-data';
import type {
  AccessTokenRec,
  AppUser,
  Assinatura,
  Cliente,
  Documento,
  Empreendimento,
  Entrega,
  ItemEntrega,
  Unidade,
  AuditEntry,
} from '@/domain/types';

export interface DbState {
  empreendimentos: Empreendimento[];
  unidades: Unidade[];
  clientes: Cliente[];
  entregas: Entrega[];
  itens: ItemEntrega[];
  documentos: Documento[];
  assinaturas: Assinatura[];
  tokens: AccessTokenRec[];
  auditoria: AuditEntry[];
  usuarios: AppUser[];
}

const HASH_PLACEHOLDER = 'a'.repeat(64);

export const USUARIO_ADMIN: AppUser = {
  id: 'usr-admin',
  nome: 'Vitor Jorge',
  email: 'vitor.jorge@rottas.com.br',
  papel: 'admin',
  ultimaAtividade: '2026-06-22T13:00:00Z',
};

const USUARIO_EQUIPE: AppUser = {
  id: 'usr-equipe',
  nome: 'João da Silva',
  email: 'joao.silva@rottas.com.br',
  papel: 'equipe_entrega',
  ultimaAtividade: '2026-06-21T18:20:00Z',
};

export function createInitialState(): DbState {
  // Cópias para não mutar os arrays dos adapters mock.
  const unidades: Unidade[] = mockUnidades.map((u) => ({ ...u }));

  const entregas: Entrega[] = [
    {
      id: 'ent-0001',
      unidadeId: 'uni-0001',
      clienteId: 'cli-0001',
      status: 'DOCUMENTOS',
      responsavelId: USUARIO_ADMIN.id,
      iniciadaEm: '2026-06-18T12:00:00Z',
      concluidaEm: null,
      createdAt: '2026-06-18T12:00:00Z',
    },
    {
      id: 'ent-0002',
      unidadeId: 'uni-0005',
      clienteId: 'cli-0003',
      status: 'ASSINATURA',
      responsavelId: USUARIO_EQUIPE.id,
      iniciadaEm: '2026-06-15T09:30:00Z',
      concluidaEm: null,
      createdAt: '2026-06-15T09:30:00Z',
    },
    {
      id: 'ent-0003',
      unidadeId: 'uni-0002',
      clienteId: 'cli-0002',
      status: 'CONCLUIDA',
      responsavelId: USUARIO_ADMIN.id,
      iniciadaEm: '2026-05-30T14:00:00Z',
      concluidaEm: '2026-06-05T16:45:00Z',
      createdAt: '2026-05-30T14:00:00Z',
    },
  ];

  // uni-0002 já entregue (ent-0003 concluída).
  const u2 = unidades.find((u) => u.id === 'uni-0002');
  if (u2) u2.status = 'ENTREGUE';

  const documentos: Documento[] = [
    {
      id: 'doc-0001',
      entregaId: 'ent-0001',
      tipo: 'Termo de Entrega de Chaves',
      storagePath: 'entregas/ent-0001/termo-entrega.pdf',
      sha256Hash: HASH_PLACEHOLDER,
      geradoEm: '2026-06-19T10:00:00Z',
    },
    {
      id: 'doc-0002',
      entregaId: 'ent-0002',
      tipo: 'Termo de Entrega de Chaves',
      storagePath: 'entregas/ent-0002/termo-entrega.pdf',
      sha256Hash: HASH_PLACEHOLDER,
      geradoEm: '2026-06-16T11:00:00Z',
    },
    {
      id: 'doc-0003',
      entregaId: 'ent-0003',
      tipo: 'Termo de Entrega de Chaves',
      storagePath: 'entregas/ent-0003/termo-entrega.pdf',
      sha256Hash: HASH_PLACEHOLDER,
      geradoEm: '2026-06-01T09:00:00Z',
    },
  ];

  const assinaturas: Assinatura[] = [
    {
      id: 'ass-0003',
      entregaId: 'ent-0003',
      documentoId: 'doc-0003',
      canvasPngPath: 'entregas/ent-0003/assinatura.png',
      metodo: 'CLICKSIGN',
      ip: '187.45.xxx.xxx',
      userAgent: 'Mozilla/5.0',
      geo: null,
      assinadaEm: '2026-06-04T15:20:00Z',
      clicksignDocKey: 'mock-doc-0003-abc',
      clicksignStatus: 'signed',
    },
  ];

  const itens: ItemEntrega[] = [
    { id: 'item-0003-1', entregaId: 'ent-0003', descricao: 'Chave da porta principal', quantidade: 2 },
    { id: 'item-0003-2', entregaId: 'ent-0003', descricao: 'Controle do portão', quantidade: 2 },
    { id: 'item-0003-3', entregaId: 'ent-0003', descricao: 'Manual do proprietário', quantidade: 1 },
  ];

  const tokens: AccessTokenRec[] = [
    {
      id: 'tok-0002',
      entregaId: 'ent-0002',
      tokenHash: 'b'.repeat(64),
      expiresAt: '2026-06-25T09:30:00Z',
      usedAt: null,
      scope: 'assinatura',
      createdAt: '2026-06-16T11:05:00Z',
    },
  ];

  const auditoria: AuditEntry[] = [
    {
      id: 'aud-1',
      actor: USUARIO_ADMIN.id,
      action: 'ENTREGA_INICIADA',
      entity: 'entrega',
      entityId: 'ent-0001',
      metadata: { unidade: 'uni-0001' },
      at: '2026-06-18T12:00:00Z',
    },
    {
      id: 'aud-2',
      actor: USUARIO_ADMIN.id,
      action: 'DOCUMENTO_GERADO',
      entity: 'documento',
      entityId: 'doc-0001',
      metadata: { tipo: 'Termo de Entrega de Chaves' },
      at: '2026-06-19T10:00:00Z',
    },
    {
      id: 'aud-3',
      actor: 'cliente:token',
      action: 'ASSINATURA_REGISTRADA',
      entity: 'entrega',
      entityId: 'ent-0003',
      metadata: { metodo: 'CLICKSIGN' },
      at: '2026-06-04T15:20:00Z',
    },
    {
      id: 'aud-4',
      actor: USUARIO_ADMIN.id,
      action: 'ENTREGA_CONCLUIDA',
      entity: 'entrega',
      entityId: 'ent-0003',
      metadata: {},
      at: '2026-06-05T16:45:00Z',
    },
  ];

  return {
    empreendimentos: mockEmpreendimentos.map((e) => ({ ...e })),
    unidades,
    clientes: mockClientes.map((c) => ({ ...c })),
    entregas,
    itens,
    documentos,
    assinaturas,
    tokens,
    auditoria,
    usuarios: [USUARIO_ADMIN, USUARIO_EQUIPE],
  };
}
