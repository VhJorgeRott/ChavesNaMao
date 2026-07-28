import type { Cliente, Empreendimento, Unidade } from '@chaves/domain/types';
import type { CrmAdapter } from '../types';
import { AdapterNotFoundError } from '../errors';
import { clientes, empreendimentos, unidades, unidadeCliente } from '../mock-data';

/** CV CRM (mock): dados sintéticos locais. */
export class MockCrmAdapter implements CrmAdapter {
  async getEmpreendimentos(): Promise<Empreendimento[]> {
    return empreendimentos.map((e) => ({ ...e }));
  }

  async getUnidadesByEmpreendimento(empreendimentoId: string): Promise<Unidade[]> {
    return unidades.filter((u) => u.empreendimentoId === empreendimentoId).map((u) => ({ ...u }));
  }

  async getClienteByUnidade(
    unidadeId: string,
    _busca?: { nome?: string | null; documento?: string | null },
  ): Promise<Cliente> {
    const clienteId = unidadeCliente[unidadeId];
    const cliente = clienteId ? clientes.find((c) => c.id === clienteId) : undefined;
    if (!cliente) {
      throw new AdapterNotFoundError('Cliente para unidade', unidadeId);
    }
    return cliente;
  }
}
