import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  type InspecaoFvs,
  type ModeloFvs,
  concluirInspecao,
  criarInspecao,
} from '@chaves/domain/qualidade';
import { gerarPdfInspecao, nomeArquivoPdf } from './pdf';

const AGORA = '2026-09-17T10:00:00.000Z';
let n = 0;
const novoId = () => `id-${++n}`;

const modelo: ModeloFvs = {
  id: 'm1',
  codigo: 'FVS 29.01.A',
  nome: 'Execução parede de concreto',
  servico: 'Estrutura',
  descricao: null,
  versao: 2,
  ativo: true,
  atualizadoEm: AGORA,
  estrutura: {
    secoes: [
      {
        id: 's1',
        titulo: 'Execução',
        itens: [
          {
            id: 'i1',
            texto: 'Conferir marcação inicial conforme IT',
            criterio: null,
            metodo: 'Trena',
            fotoObrigatoriaNc: false,
          },
          {
            id: 'i2',
            texto: 'Prumo',
            criterio: '3 mm/m',
            metodo: 'Prumo de face',
            fotoObrigatoriaNc: false,
          },
          {
            id: 'i3',
            texto: 'Limpeza',
            criterio: null,
            metodo: 'Visual',
            fotoObrigatoriaNc: false,
          },
        ],
      },
    ],
  },
};

function inspecaoConcluida(): InspecaoFvs {
  let insp = criarInspecao(
    modelo,
    {
      local: {
        empreendimentoRef: '25',
        empreendimentoNome: 'Vega Costa e Silva',
        codigo: '01.01.06',
        bloco: 'Torre A',
        unidadeRef: null,
        unidadeNome: null,
        detalhe: '6o Pavimento',
      },
      identificador: 'parede de concreto 601, 602 A',
      fornecedor: 'GSI Serviços Limitada',
      responsavel: 'Lucas Silva Sell',
      dataAtendimento: '2026-09-08',
      validade: '2027-09-10',
    },
    { id: 'u1', nome: 'Dairiely Pinheiro' },
    AGORA,
    novoId,
  );
  insp = {
    ...insp,
    respostas: {
      i1: { itemId: 'i1', resultado: 'C', observacao: null, respondidoEm: AGORA },
      // i2 reprovado, i3 deixado "não verificado" de propósito
      i2: { itemId: 'i2', resultado: 'NC', observacao: 'Desaprumo de 8 mm', respondidoEm: AGORA },
    },
    observacoes: 'Serviço liberado após correção do desaprumo.',
    assinatura: {
      nome: 'Dairiely Pinheiro',
      // PNG 1x1 transparente
      pngDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      assinadaEm: AGORA,
    },
  };
  return concluirInspecao(insp, [], AGORA, novoId).inspecao;
}

describe('gerarPdfInspecao', () => {
  it('gera um PDF válido com o conteúdo da ficha', async () => {
    const bytes = await gerarPdfInspecao({
      inspecao: inspecaoConcluida(),
      emitidoPor: 'vitor.jorge@rottasconstrutora.com.br',
    });

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it('não quebra com acentos e caracteres fora do WinAnsi', async () => {
    const insp = inspecaoConcluida();
    const bytes = await gerarPdfInspecao({
      inspecao: {
        ...insp,
        observacoes: 'Acentuação, travessão — aspas “curvas” e emoji 🧱 no texto',
        identificador: 'Parede 601 — 3º pavimento',
      },
      emitidoPor: 'teste@rottasconstrutora.com.br',
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('nome do arquivo sai sem acento nem espaço', () => {
    expect(nomeArquivoPdf(inspecaoConcluida())).toBe(
      'FVS-29.01.A_Vega-Costa-e-Silva_2026-09-17.pdf',
    );
  });
});
