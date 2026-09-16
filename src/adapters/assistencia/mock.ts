import type {
  AssistenciaAdapter,
  ChamadoAssistencia,
  FiltroChamados,
  PaginaChamados,
} from '../types';
import {
  faseDoChamado,
  filtrarChamados,
  interpretarSituacao,
} from '../../../supabase/functions/_shared/assistencia.ts';

/**
 * Assistência técnica (mock): chamados sintéticos com as situações reais do CV,
 * filtrados e paginados pela mesma função que a Edge Function usa.
 */

const SITUACOES = [
  { id: '1', bruta: '[ASSISTÊNCIA TÉCNICA | 01] NOVA ASSISTÊNCIA' },
  { id: '10', bruta: '[ASSISTÊNCIA TÉCNICA | 02] TENTATIVA DE CONTATO' },
  { id: '11', bruta: '[ASSISTÊNCIA TÉCNICA | 03] SEM CONTATO' },
  { id: '9', bruta: '[ASSISTÊNCIA TÉCNICA | 04] VISTORIA' },
  { id: '3', bruta: '[ASSISTÊNCIA TÉCNICA | 05] IMPROCEDENTE' },
  { id: '2', bruta: '[ASSISTÊNCIA TÉCNICA | 06] PROCEDENTE' },
  { id: '8', bruta: '[ASSISTÊNCIA TÉCNICA | 07] REPARO EM ANDAMENTO' },
  { id: '5', bruta: '[ASSISTÊNCIA TÉCNICA | 08] EMISSÃO DA OS' },
  { id: '6', bruta: '[ASSISTÊNCIA TÉCNICA | 09] REPARO FINALIZADO' },
  { id: '17', bruta: '[ENTREGA DE CHAVES | 07] VISTORIA E ENTREGA' },
];

const EMPREENDIMENTOS = [
  { id: '25', nome: 'Residencial Jardim das Acácias', dataEntrega: '2025-06-30T00:00:00' },
  { id: '17', nome: 'Loteamento Terras do Lago', dataEntrega: '2026-02-28T00:00:00' },
];

const PROBLEMAS = [
  'Infiltração na parede do banheiro social, próxima ao box.',
  'Porta da cozinha não fecha corretamente; dobradiça desalinhada.',
  'Trinca no reboco da fachada frontal.',
  'Tomada da sala sem energia.',
  'Vazamento no sifão da pia da cozinha.',
  'Piso cerâmico solto no corredor.',
];

const CLIENTES = ['Mariana Oliveira Souza', 'Rafael Pereira Lima', 'Carla Mendes Ribeiro'];

function gerar(): ChamadoAssistencia[] {
  return Array.from({ length: 64 }, (_, i) => {
    // Distribuição parecida com a real: a maioria finalizada.
    const sit = SITUACOES[i % 3 === 0 ? 8 : i % SITUACOES.length]!;
    const { fluxo, etapa, nome } = interpretarSituacao(sit.bruta);
    const emp = EMPREENDIMENTOS[i % EMPREENDIMENTOS.length]!;
    const areaComum = i % 11 === 0;
    const dia = String(28 - (i % 28)).padStart(2, '0');
    return {
      id: String(1100 - i),
      protocolo: `202609${dia}${String(i).padStart(2, '0')}`,
      atendimentoId: String(8800 - i),
      fluxo,
      etapa,
      situacao: nome,
      situacaoId: sit.id,
      fase: faseDoChamado(fluxo, etapa, nome),
      abertoEm: `2026-${i < 20 ? '09' : '08'}-${dia}T${String(8 + (i % 9)).padStart(2, '0')}:15:00`,
      descricao: PROBLEMAS[i % PROBLEMAS.length]!,
      parecerTecnico: etapa !== null && etapa >= 5 ? 'Vistoria realizada; reparo avaliado.' : null,
      slaVencido: i % 13 === 0,
      localidade: areaComum ? null : 'Unidade',
      areaComum: areaComum ? 'Portaria' : null,
      empreendimento: emp,
      bloco: areaComum ? null : `Quadra ${String.fromCharCode(65 + (i % 4))}`,
      unidade: areaComum
        ? null
        : { id: String(500 + i), nome: `Lote ${i + 1}`, codigoInterno: null },
      cliente: areaComum
        ? null
        : {
            nome: CLIENTES[i % CLIENTES.length]!,
            email: 'cliente@example.com',
            documento: '529.982.247-25',
          },
      sindico: areaComum ? 'Associação de moradores' : null,
    };
  });
}

const chamados = gerar();

export class MockAssistenciaAdapter implements AssistenciaAdapter {
  async listarChamados({
    atualizar: _atualizar,
    ...filtro
  }: FiltroChamados & { atualizar?: boolean }): Promise<PaginaChamados> {
    return structuredClone(filtrarChamados(chamados, filtro, new Date().toISOString()));
  }
}
