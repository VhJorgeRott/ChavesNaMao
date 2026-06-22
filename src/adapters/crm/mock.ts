import type { Cliente } from '@/domain/types';
import type { CrmAdapter } from '../types';
import { AdapterNotFoundError } from '../errors';
import { clientes, unidadeCliente } from '../mock-data';

/** CV CRM (mock): resolve o cliente a partir de dados sintéticos locais. */
export class MockCrmAdapter implements CrmAdapter {
  async getClienteByUnidade(unidadeId: string): Promise<Cliente> {
    const clienteId = unidadeCliente[unidadeId];
    const cliente = clienteId ? clientes.find((c) => c.id === clienteId) : undefined;
    if (!cliente) {
      throw new AdapterNotFoundError('Cliente para unidade', unidadeId);
    }
    return cliente;
  }
}
