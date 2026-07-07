import { z } from 'zod';
import type { ErpAdapter, SituacaoFinanceira, UnidadeErp } from '../types';
import { AdapterError, AdapterNotImplementedError } from '../errors';
import { unidadeSchema } from '../schemas';
import { getSupabase } from '@/lib/supabase';

/**
 * Mega ERP (live). As chamadas ao Fabric GraphQL (view de parcelas do Mega)
 * NÃO saem do navegador — passam pela Edge Function `mega-unidades`, onde as
 * credenciais do Fabric vivem como secrets do servidor (SSRF/8.4: endpoint
 * allow-listed, segredos fora do bundle). O navegador só invoca a função
 * autenticado (JWT).
 */

const unidadeErpSchema = unidadeSchema.extend({
  contratoNumero: z.string().nullable(),
  clienteNome: z.string().nullable(),
});

const megaUnidadesRespostaSchema = z.object({
  unidades: unidadeErpSchema.array(),
  aviso: z.string().optional(),
});

export class LiveErpAdapter implements ErpAdapter {
  async getSituacaoFinanceira(_unidadeId: string): Promise<SituacaoFinanceira> {
    // TODO(live): consultar o ERP, validar com Zod e mapear para SituacaoFinanceira.
    throw new AdapterNotImplementedError('LiveErpAdapter');
  }

  async getUnidadesByEmpreendimento(
    empreendimentoId: string,
    empreendimentoNome: string,
  ): Promise<UnidadeErp[]> {
    const { data, error } = await getSupabase().functions.invoke('mega-unidades', {
      body: { empreendimentoId, empreendimentoNome },
    });
    if (error) {
      throw new AdapterError('Falha ao buscar unidades no ERP (Mega)', error);
    }
    const parsed = megaUnidadesRespostaSchema.parse(data);
    if (parsed.aviso) console.warn('[mega-unidades]', parsed.aviso);
    return parsed.unidades;
  }
}
