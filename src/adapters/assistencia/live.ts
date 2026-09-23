import { z } from 'zod';
import type { AssistenciaAdapter, FiltroChamados, PaginaChamados } from '../types';
import { AdapterError } from '../errors';
import { detalheErroFuncao } from '../erro-funcao';
import { getSupabase } from '@/lib/supabase';
import { queryDoFiltro } from '../../../supabase/functions/_shared/assistencia.ts';

/**
 * Assistência técnica (live). A consulta ao CV CRM passa pela Edge Function
 * `crm-assistencias`, que guarda as credenciais do CRM, mantém os chamados em
 * cache e devolve só a página pedida.
 */

const fase = z.enum(['nova', 'andamento', 'improcedente', 'finalizado']);

const chamadoSchema = z.object({
  id: z.string(),
  protocolo: z.string().nullable(),
  atendimentoId: z.string().nullable(),
  fluxo: z.enum(['ASSISTENCIA_TECNICA', 'ENTREGA_CHAVES', 'OUTRO']),
  etapa: z.number().nullable(),
  situacao: z.string(),
  situacaoId: z.string().nullable(),
  fase,
  abertoEm: z.string().nullable(),
  descricao: z.string(),
  parecerTecnico: z.string().nullable(),
  slaVencido: z.boolean(),
  localidade: z.string().nullable(),
  areaComum: z.string().nullable(),
  empreendimento: z
    .object({ id: z.string().nullable(), nome: z.string(), dataEntrega: z.string().nullable() })
    .nullable(),
  bloco: z.string().nullable(),
  unidade: z
    .object({ id: z.string().nullable(), nome: z.string(), codigoInterno: z.string().nullable() })
    .nullable(),
  cliente: z
    .object({ nome: z.string(), email: z.string().nullable(), documento: z.string().nullable() })
    .nullable(),
  sindico: z.string().nullable(),
});

const paginaSchema = z.object({
  itens: chamadoSchema.array(),
  total: z.number(),
  pagina: z.number(),
  porPagina: z.number(),
  totalPaginas: z.number(),
  porFase: z.object({
    nova: z.number(),
    andamento: z.number(),
    improcedente: z.number(),
    finalizado: z.number(),
  }),
  porSituacao: z
    .object({
      id: z.string().nullable(),
      nome: z.string(),
      etapa: z.number().nullable(),
      fase,
      qtd: z.number(),
    })
    .array(),
  facetas: z
    .object({
      empreendimento: z.record(z.number()),
      periodo: z.object({ todos: z.number(), hoje: z.number(), '7': z.number(), '30': z.number() }),
      local: z.object({ todos: z.number(), unidade: z.number(), area: z.number() }),
      descricao: z.object({ todos: z.number(), com: z.number(), sem: z.number() }),
    })
    .optional(),
  empreendimentos: z.object({ id: z.string(), nome: z.string() }).array(),
  atualizadoEm: z.string(),
}) satisfies z.ZodType<PaginaChamados>;

export class LiveAssistenciaAdapter implements AssistenciaAdapter {
  async listarChamados({
    atualizar,
    ...filtro
  }: FiltroChamados & { atualizar?: boolean }): Promise<PaginaChamados> {
    const query = queryDoFiltro(filtro) + (atualizar ? '&atualizar=1' : '');
    const { data, error } = await getSupabase().functions.invoke(`crm-assistencias?${query}`, {
      method: 'GET',
    });
    if (error) {
      const detalhe = await detalheErroFuncao(error);
      throw new AdapterError(
        `Falha ao buscar chamados de assistência no CRM${detalhe ? `: ${detalhe}` : ''}`,
        { cause: error },
      );
    }
    return paginaSchema.parse(data);
  }
}
