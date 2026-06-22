import type { ErpAdapter, SituacaoFinanceira } from '../types';
import { AdapterNotImplementedError } from '../errors';

/**
 * Mega ERP (live). Chamada real deve rodar no SERVIDOR (Edge Function), com
 * ERP_API_TOKEN como secret e ERP_API_BASE_URL allow-listed (SSRF — 8.4).
 */
export class LiveErpAdapter implements ErpAdapter {
  async getSituacaoFinanceira(_unidadeId: string): Promise<SituacaoFinanceira> {
    // TODO(live): consultar o ERP, validar com Zod e mapear para SituacaoFinanceira.
    throw new AdapterNotImplementedError('LiveErpAdapter');
  }
}
