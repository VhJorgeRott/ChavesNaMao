import { z } from 'zod';
import { PAPEL, UNIDADE_STATUS } from '@/domain/types';

/**
 * Schemas Zod compartilhados entre adapters live (CRM e ERP) para validar os
 * payloads vindos das Edge Functions antes de entrarem no domínio.
 */

export const unidadeStatusSchema = z.enum(UNIDADE_STATUS);

/** Linha da RPC `admin_list_users` (identidade em auth.users + papel). */
export const adminUsuarioRowSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  nome: z.string().nullable(),
  avatar_url: z.string().nullable(),
  papel: z.enum(PAPEL),
  created_at: z.string().nullable(),
  last_sign_in_at: z.string().nullable(),
});

/** Linha da tabela `audit_log` (feed de atividade). */
export const auditLogRowSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
  at: z.string(),
});

export const unidadeSchema = z.object({
  id: z.string(),
  empreendimentoId: z.string(),
  identificacao: z.string(),
  status: unidadeStatusSchema,
  areaM2: z.number().nullable(),
  inadimplente: z.boolean().optional(),
  createdAt: z.string(),
});
