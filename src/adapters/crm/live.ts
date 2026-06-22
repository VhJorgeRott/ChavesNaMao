import type { Cliente } from '@/domain/types';
import type { CrmAdapter } from '../types';
import { AdapterNotImplementedError } from '../errors';

/**
 * CV CRM (live). O acesso à API está confirmado pelo time; a chamada real deve
 * ocorrer no SERVIDOR (Edge Function), onde o CRM_API_TOKEN existe como secret e
 * o CRM_API_BASE_URL é um endpoint allow-listed (SSRF — 8.4). Mantém a mesma
 * interface do mock para troca sem tocar no resto do app.
 */
export class LiveCrmAdapter implements CrmAdapter {
  async getClienteByUnidade(_unidadeId: string): Promise<Cliente> {
    // TODO(live): GET ${CRM_API_BASE_URL}/unidades/{id}/cliente com bearer token,
    // validar a resposta com Zod e mapear para o tipo Cliente.
    throw new AdapterNotImplementedError('LiveCrmAdapter');
  }
}
