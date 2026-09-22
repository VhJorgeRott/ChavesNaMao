import { z } from 'zod';
import type { Cliente, Empreendimento, Unidade } from '@chaves/domain/types';
import type { BuscaCliente, CrmAdapter, SituacaoClienteCv } from '../types';
import { AdapterError, AdapterNotFoundError } from '../errors';
import { detalheErroFuncao } from '../erro-funcao';
import { clienteSchema, unidadeSchema } from '../schemas';
import { getSupabase } from '@/lib/supabase';

/**
 * CV CRM (live). As chamadas à API real do CV CRM NÃO saem do navegador — elas
 * passam por Supabase Edge Functions (`crm-empreendimentos`, `crm-unidades`),
 * onde o token e o e-mail do CRM vivem como secrets do servidor (SSRF/8.4:
 * endpoint allow-listed, segredos fora do bundle). O navegador só invoca as
 * funções autenticado (JWT).
 */

const situacaoClienteSchema = z.object({
  atendimentos: z
    .object({
      id: z.string(),
      protocolo: z.string().nullable(),
      titulo: z.string(),
      assunto: z.string().nullable(),
      subassunto: z.string().nullable(),
      situacao: z.string(),
      abertoEm: z.string().nullable(),
      finalizadoEm: z.string().nullable(),
      canceladoEm: z.string().nullable(),
      aberto: z.boolean(),
      responsavel: z.string().nullable(),
      unidadeId: z.string().nullable(),
      unidade: z.string().nullable(),
      bloco: z.string().nullable(),
      empreendimentoId: z.string().nullable(),
    })
    .array(),
  juridico: z.object({ ativo: z.boolean().nullable(), valor: z.string().nullable() }),
}) satisfies z.ZodType<SituacaoClienteCv>;

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


/**
 * Chamadas ao `crm-cliente` em andamento, indexadas pela query de busca. Permite
 * que invocações idênticas concorrentes compartilhem a MESMA requisição.
 */
const clientesEmVoo = new Map<string, Promise<Cliente>>();


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

  async getClienteByUnidade(_unidadeId: string, busca?: BuscaCliente): Promise<Cliente> {
    // Preferencial: titular da reserva da unidade no CV (ids do CV). A busca
    // por documento/nome segue junto como alternativa, caso a unidade não
    // tenha reserva vigente.
    const documento = (busca?.documento ?? '').replace(/\D/g, '');
    const nome = (busca?.nome ?? '').trim();
    const cv = busca?.cvUnidade ?? null;
    if (!cv && !documento && !nome) {
      throw new AdapterNotFoundError('Cliente para unidade (sem nome/documento)', _unidadeId);
    }

    const params = new URLSearchParams();
    if (cv) {
      params.set('empreendimentoId', cv.empreendimentoId);
      params.set('unidadeId', cv.unidadeId);
    }
    if (documento) params.set('documento', documento);
    else if (nome) params.set('nome', nome);

    // Deduplica chamadas idênticas concorrentes (ex.: StrictMode dispara o efeito
    // duas vezes em dev). Sem isso, duas invocações simultâneas fariam dois logins
    // v3, que se invalidam mutuamente e fazem uma delas voltar vazia.
    const chave = params.toString();
    const emVoo = clientesEmVoo.get(chave);
    if (emVoo) return emVoo;

    const promessa = (async (): Promise<Cliente> => {
      const { data, error } = await getSupabase().functions.invoke(`crm-cliente?${chave}`);
      if (error) {
        const detalhe = await detalheErroFuncao(error);
        throw new AdapterError(
          `Falha ao buscar cliente no CRM${detalhe ? `: ${detalhe}` : ''}`,
          { cause: error },
        );
      }
      return clienteSchema.parse(data);
    })();
    clientesEmVoo.set(chave, promessa);
    try {
      return await promessa;
    } finally {
      clientesEmVoo.delete(chave);
    }
  }

  async getSituacaoCliente(documento: string): Promise<SituacaoClienteCv> {
    const doc = documento.replace(/\D/g, '');
    const { data, error } = await getSupabase().functions.invoke(
      `crm-situacao-cliente?documento=${encodeURIComponent(doc)}`,
      { method: 'GET' },
    );
    if (error) {
      const detalhe = await detalheErroFuncao(error);
      throw new AdapterError(
        `Falha ao buscar a situação do cliente no CRM${detalhe ? `: ${detalhe}` : ''}`,
        { cause: error },
      );
    }
    return situacaoClienteSchema.parse(data);
  }
}
