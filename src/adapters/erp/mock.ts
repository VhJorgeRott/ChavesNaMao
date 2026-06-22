import type { ErpAdapter, SituacaoFinanceira } from '../types';
import { AdapterNotFoundError } from '../errors';
import { situacaoFinanceira } from '../mock-data';

/** Mega ERP (mock): situação financeira a partir de dados sintéticos locais. */
export class MockErpAdapter implements ErpAdapter {
  async getSituacaoFinanceira(unidadeId: string): Promise<SituacaoFinanceira> {
    const situacao = situacaoFinanceira[unidadeId];
    if (!situacao) {
      throw new AdapterNotFoundError('Situação financeira para unidade', unidadeId);
    }
    return situacao;
  }
}
