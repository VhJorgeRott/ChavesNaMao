import { describe, expect, it } from 'vitest';
import {
  interpretarSinalizador,
  mapearAtendimento,
} from '../../../supabase/functions/_shared/situacao-cliente.ts';

describe('interpretarSinalizador', () => {
  it.each([
    [null, false],
    ['N', false],
    ['', false],
    ['S', true],
    ['Sim', true],
    ['1', true],
    [1, true],
    [true, true],
    ['Ativo', true],
    ['Inativo', false],
    [{ ativo: 'S' }, true],
    [{ situacao: 'inativo' }, false],
  ])('%j → %s', (valor, esperado) => {
    expect(interpretarSinalizador(valor)).toBe(esperado);
  });
});

describe('mapearAtendimento', () => {
  const base = {
    idatendimento: 10293,
    titulo: 'QUALIDADE DA CASA',
    assunto: 'QUALIDADE DA CASA',
    subassunto: 'ASSISTÊNCIA TÉCNICA - SISTEMAS ELETRICOS',
    situacao: 'NOVO CHAMADO',
    dataCad: '2026-09-22 13:42:09',
    responsavel: 'Eduardo ',
    idsUnidades: 4174,
    unidades: '102',
    bloco: 'TORRE 8',
    empreendimento: { idempreendimento: 16, nome: 'PORTO BLUMEN' },
    protocolo: '2609220293',
    dataFinalizacao: null,
    dataCancelamento: null,
  };

  it('mapeia o formato real do CV', () => {
    expect(mapearAtendimento(base)).toMatchObject({
      id: '10293',
      unidadeId: '4174',
      empreendimentoId: '16',
      responsavel: 'Eduardo',
      aberto: true,
    });
  });

  it('finalizado ou cancelado não está em aberto', () => {
    expect(mapearAtendimento({ ...base, dataFinalizacao: '2026-09-23 10:00:00' }).aberto).toBe(false);
    expect(mapearAtendimento({ ...base, dataCancelamento: '2026-09-23 10:00:00' }).aberto).toBe(false);
  });
});
