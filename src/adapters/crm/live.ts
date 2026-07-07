import { z } from 'zod';
import type { Cliente, Empreendimento, Unidade } from '@/domain/types';
import type { CrmAdapter } from '../types';
import { AdapterError, AdapterNotImplementedError } from '../errors';
import { getSupabase } from '@/lib/supabase';

/**
 * CV CRM (live). As chamadas à API real do CV CRM NÃO saem do navegador — elas
 * passam por Supabase Edge Functions (`crm-empreendimentos`, `crm-unidades`),
 * onde o token e o e-mail do CRM vivem como secrets do servidor (SSRF/8.4:
 * endpoint allow-listed, segredos fora do bundle). O navegador só invoca as
 * funções autenticado (JWT).
 */

const empreendimentoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cidade: z.string(),
  uf: z.string(),
  createdAt: z.string(),
  foto: z.string().nullable().default(null),
  unidadesDisponiveis: z.number().nullable().default(null),
  situacaoObra: z.string().nullable().default(null),
});

const unidadeStatusSchema = z.enum([
  'EM_OBRAS',
  'DISPONIVEL',
  'VENDIDA',
  'QUITADA',
  'LIBERADA',
  'ENTREGUE',
]);

const unidadeSchema = z.object({
  id: z.string(),
  empreendimentoId: z.string(),
  identificacao: z.string(),
  status: unidadeStatusSchema,
  areaM2: z.number(),
  createdAt: z.string(),
});

export class LiveCrmAdapter implements CrmAdapter {
  async getEmpreendimentos(): Promise<Empreendimento[]> {
    const { data, error } = await getSupabase().functions.invoke('crm-empreendimentos');
    if (error) {
      throw new AdapterError('Falha ao buscar empreendimentos no CRM', error);
    }
    return empreendimentoSchema.array().parse(data);
  }

  async getUnidadesByEmpreendimento(empreendimentoId: string): Promise<Unidade[]> {
    const { data, error } = await getSupabase().functions.invoke(
      `crm-unidades?empreendimentoId=${encodeURIComponent(empreendimentoId)}`,
    );
    if (error) {
      throw new AdapterError('Falha ao buscar unidades no CRM', error);
    }
    return unidadeSchema.array().parse(data);
  }

  async getClienteByUnidade(_unidadeId: string): Promise<Cliente> {
    // TODO(live): Edge Function que resolve o cliente pela reserva da unidade no CV CRM.
    throw new AdapterNotImplementedError('LiveCrmAdapter.getClienteByUnidade');
  }
}
