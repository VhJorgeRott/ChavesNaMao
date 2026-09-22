import type { Cliente, Empreendimento, Unidade } from '@chaves/domain/types';
import type { BuscaCliente, CrmAdapter, SituacaoClienteCv } from '../types';
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
    _busca?: BuscaCliente,
  ): Promise<Cliente> {
    const clienteId = unidadeCliente[unidadeId];
    const cliente = clienteId ? clientes.find((c) => c.id === clienteId) : undefined;
    if (!cliente) {
      throw new AdapterNotFoundError('Cliente para unidade', unidadeId);
    }
    return cliente;
  }

  /**
   * Situação sintética, estável por cliente: o primeiro cliente do mock tem um
   * atendimento em aberto e o segundo está sinalizado no jurídico — o bastante
   * para exercitar todos os estados da ficha.
   */
  async getSituacaoCliente(documento: string): Promise<SituacaoClienteCv> {
    const doc = documento.replace(/\D/g, '');
    const indice = clientes.findIndex((c) => c.cpf.replace(/\D/g, '') === doc);
    const unidadeId = Object.entries(unidadeCliente).find(
      ([, clienteId]) => clienteId === clientes[indice]?.id,
    )?.[0];
    return {
      atendimentos:
        indice === 0
          ? [
              {
                id: '9001',
                protocolo: '2609220001',
                titulo: 'SITUAÇÃO FINANCEIRA',
                assunto: 'SITUAÇÃO FINANCEIRA',
                subassunto: 'SEGUNDA VIA DE BOLETO',
                situacao: 'NOVO CHAMADO',
                abertoEm: '2026-09-20 10:15:00',
                finalizadoEm: null,
                canceladoEm: null,
                aberto: true,
                responsavel: 'Equipe de relacionamento',
                unidadeId: unidadeId ?? null,
                unidade: null,
                bloco: null,
                empreendimentoId: null,
              },
            ]
          : [],
      juridico: { ativo: indice === 1, valor: indice === 1 ? '"S"' : null },
    };
  }
}
