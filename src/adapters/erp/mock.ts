import type { ErpAdapter, SituacaoFinanceira, UnidadeErp } from '../types';
import { AdapterNotFoundError } from '../errors';
import { clientes, situacaoFinanceira, unidadeCliente, unidades } from '../mock-data';

/** Mega ERP (mock): situação financeira a partir de dados sintéticos locais. */
export class MockErpAdapter implements ErpAdapter {
  async getSituacaoFinanceira(unidadeId: string): Promise<SituacaoFinanceira> {
    const situacao = situacaoFinanceira[unidadeId];
    if (!situacao) {
      throw new AdapterNotFoundError('Situação financeira para unidade', unidadeId);
    }
    return situacao;
  }

  async getUnidadesByEmpreendimento(
    empreendimentoId: string,
    _empreendimentoNome: string,
  ): Promise<UnidadeErp[]> {
    return unidades
      .filter((u) => u.empreendimentoId === empreendimentoId)
      .map((u) => {
        const clienteId = unidadeCliente[u.id];
        const sit = situacaoFinanceira[u.id];
        return {
          ...u,
          inadimplente: sit ? !sit.quitada && sit.parcelasEmAberto > 0 : false,
          contratoNumero: sit?.numeroContrato ?? null,
          clienteNome: clientes.find((c) => c.id === clienteId)?.nome ?? null,
        };
      });
  }
}
