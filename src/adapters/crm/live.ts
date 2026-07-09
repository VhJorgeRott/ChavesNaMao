import { z } from 'zod';
import type { Cliente, Empreendimento, Unidade } from '@/domain/types';
import type { CrmAdapter } from '../types';
import { AdapterError, AdapterNotFoundError } from '../errors';
import { clienteSchema, unidadeSchema } from '../schemas';
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

/**
 * Extrai o motivo real de uma falha da Edge Function. O supabase-js embrulha
 * respostas não-2xx num `FunctionsHttpError` cujo corpo (com `error`/`detalhe`/
 * `alvo` que a função devolveu) fica em `error.context` — um `Response`. Sem ler
 * isso, o motivo real do CRM se perde e só sobra uma mensagem genérica.
 */
async function detalheErroFuncao(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const body: unknown = await ctx.clone().json();
      if (body && typeof body === 'object') {
        const b = body as { error?: unknown; detalhe?: unknown; alvo?: unknown };
        const partes = [b.error, b.detalhe, b.alvo]
          .filter((v) => typeof v === 'string' && v.trim() !== '')
          .map((v) => String(v).trim());
        if (partes.length) return partes.join(' — ');
      }
    } catch {
      try {
        const txt = (await ctx.clone().text()).trim();
        if (txt) return txt.slice(0, 300);
      } catch {
        /* corpo já consumido ou ilegível */
      }
    }
  }
  return error instanceof Error ? error.message : '';
}

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

  async getClienteByUnidade(
    _unidadeId: string,
    busca?: { nome?: string | null; documento?: string | null },
  ): Promise<Cliente> {
    // A unidade em tela vem do ERP (Mega), que não expõe o idpessoa do CV. Por
    // isso localizamos a pessoa no cadastro do CV por documento (preferencial)
    // ou nome — dados que o app já tem em mãos.
    const documento = (busca?.documento ?? '').replace(/\D/g, '');
    const nome = (busca?.nome ?? '').trim();
    if (!documento && !nome) {
      throw new AdapterNotFoundError('Cliente para unidade (sem nome/documento)', _unidadeId);
    }

    const params = new URLSearchParams();
    if (documento) params.set('documento', documento);
    else params.set('nome', nome);

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
}
