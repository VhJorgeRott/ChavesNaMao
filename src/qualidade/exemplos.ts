import type { ModeloFvs } from '@chaves/domain/qualidade';

/**
 * Modelo de partida para quem abre o módulo pela primeira vez (e para demo).
 * Os modelos reais virão da importação do Mobuss.
 */
export function modeloExemploAlvenaria(id: string, agora: string): ModeloFvs {
  let n = 0;
  const item = (texto: string, criterio: string | null, fotoObrigatoriaNc = true) => ({
    id: `item-${++n}`,
    texto,
    criterio,
    metodo: null,
    fotoObrigatoriaNc,
  });
  return {
    id,
    codigo: 'FVS-EX',
    nome: 'Alvenaria de vedação (exemplo)',
    servico: 'Alvenaria',
    descricao: 'Modelo de exemplo. Edite ou substitua pelos modelos importados do Mobuss.',
    versao: 1,
    ativo: true,
    atualizadoEm: agora,
    estrutura: {
      secoes: [
        {
          id: 'secao-1',
          titulo: 'Antes da execução',
          itens: [
            item('Marcação da primeira fiada conforme projeto', 'Desvio máximo de 5 mm', false),
            item('Blocos sem trincas ou quebras', null, false),
          ],
        },
        {
          id: 'secao-2',
          titulo: 'Execução',
          itens: [
            item('Prumo da parede', 'Desvio máximo de 3 mm por metro'),
            item('Nível das fiadas', 'Desvio máximo de 3 mm por metro'),
            item('Juntas de argamassa preenchidas e uniformes', 'Espessura entre 8 e 12 mm'),
            item('Amarração entre fiadas e nos encontros', null),
            item('Vergas e contravergas executadas', 'Transpasse mínimo de 30 cm'),
          ],
        },
        {
          id: 'secao-3',
          titulo: 'Finalização',
          itens: [
            item('Encunhamento executado após o prazo', null),
            item('Área limpa, sem entulho', null, false),
          ],
        },
      ],
    },
  };
}
