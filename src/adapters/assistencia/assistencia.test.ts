import { describe, expect, it } from 'vitest';
import {
  type ChamadoAssistencia,
  faseDoChamado,
  filtrarChamados,
  type FiltroChamados,
  filtroDeQuery,
  interpretarSituacao,
  queryDoFiltro,
} from '../../../supabase/functions/_shared/assistencia.ts';
import { createAdapters } from '../index';

describe('interpretarSituacao', () => {
  it('separa fluxo, etapa e nome', () => {
    expect(interpretarSituacao('[ASSISTÊNCIA TÉCNICA | 07] REPARO EM ANDAMENTO')).toEqual({
      fluxo: 'ASSISTENCIA_TECNICA',
      etapa: 7,
      nome: 'REPARO EM ANDAMENTO',
    });
    expect(interpretarSituacao('[ENTREGA DE CHAVES | 03] AGENDAMENTO CLIENTE')).toEqual({
      fluxo: 'ENTREGA_CHAVES',
      etapa: 3,
      nome: 'AGENDAMENTO CLIENTE',
    });
  });

  it('situação fora do padrão vira OUTRO', () => {
    expect(interpretarSituacao('Aberto')).toEqual({ fluxo: 'OUTRO', etapa: null, nome: 'Aberto' });
  });
});

describe('faseDoChamado (assistência técnica)', () => {
  it.each([
    [1, 'nova'],
    [2, 'andamento'],
    [3, 'andamento'],
    [4, 'andamento'],
    [5, 'improcedente'],
    [6, 'andamento'],
    [7, 'andamento'],
    [8, 'andamento'],
    [9, 'finalizado'],
  ] as const)('etapa %i → %s', (etapa, fase) => {
    expect(faseDoChamado('ASSISTENCIA_TECNICA', etapa, '')).toBe(fase);
  });
});

function chamado(parcial: Partial<ChamadoAssistencia>): ChamadoAssistencia {
  return {
    id: '1',
    protocolo: null,
    atendimentoId: null,
    fluxo: 'ASSISTENCIA_TECNICA',
    etapa: 1,
    situacao: 'NOVA ASSISTÊNCIA',
    situacaoId: '1',
    fase: 'nova',
    abertoEm: '2026-09-01T10:00:00',
    descricao: '',
    parecerTecnico: null,
    slaVencido: false,
    localidade: null,
    areaComum: null,
    empreendimento: { id: '25', nome: 'Porto Horizonte', dataEntrega: null },
    bloco: null,
    unidade: null,
    cliente: null,
    sindico: null,
    ...parcial,
  };
}

describe('filtrarChamados', () => {
  const todos = [
    chamado({ id: '1', abertoEm: '2026-09-01T10:00:00' }),
    chamado({
      id: '2',
      abertoEm: '2026-09-03T10:00:00',
      fase: 'finalizado',
      situacaoId: '6',
      etapa: 9,
    }),
    chamado({
      id: '3',
      abertoEm: '2026-09-02T10:00:00',
      fase: 'andamento',
      situacaoId: '8',
      etapa: 7,
    }),
    chamado({ id: '4', fluxo: 'ENTREGA_CHAVES', etapa: 7, situacaoId: '17' }),
    chamado({
      id: '5',
      descricao: 'Infiltração no banheiro',
      empreendimento: { id: '17', nome: 'Terras do Lago', dataEntrega: null },
    }),
  ];

  it('filtra só o fluxo de assistência técnica por padrão e ordena por abertura', () => {
    const r = filtrarChamados(todos, {}, 'agora');
    expect(r.itens.map((c) => c.id)).toEqual(['2', '3', '5', '1']);
    expect(r.porFase).toEqual({ nova: 2, andamento: 1, improcedente: 0, finalizado: 1 });
  });

  it('"abertos" exclui finalizados e improcedentes, mas as contagens não mudam', () => {
    const r = filtrarChamados(todos, { fase: 'abertos' }, 'agora');
    expect(r.total).toBe(3);
    expect(r.porFase.finalizado).toBe(1);
  });

  it('busca ignora acentos e caixa', () => {
    const r = filtrarChamados(todos, { busca: 'INFILTRACAO' }, 'agora');
    expect(r.itens.map((c) => c.id)).toEqual(['5']);
  });

  it('pagina e limita a página ao intervalo válido', () => {
    const r = filtrarChamados(todos, { porPagina: 3, pagina: 99 }, 'agora');
    expect(r.totalPaginas).toBe(2);
    expect(r.pagina).toBe(2);
    expect(r.itens).toHaveLength(1);
  });

  it('filtro vai e volta pela query string, com listas', () => {
    const filtro: FiltroChamados = {
      fase: 'abertos',
      situacaoIds: ['6', '8'],
      empreendimentoIds: ['25'],
      busca: 'porta',
      periodo: '7',
      local: 'area',
      descricao: 'sem',
      ordem: 'local',
      direcao: 'asc',
      pagina: 2,
    };
    expect(filtroDeQuery(new URLSearchParams(queryDoFiltro(filtro)))).toEqual(filtro);
  });

  it('aceita os parâmetros singulares antigos', () => {
    expect(filtroDeQuery(new URLSearchParams('empreendimentoId=25&situacaoId=6'))).toEqual({
      empreendimentoIds: ['25'],
      situacaoIds: ['6'],
    });
  });

  it('multi-seleção de situação e empreendimento', () => {
    const r = filtrarChamados(todos, { situacaoIds: ['6', '8'] }, 'agora');
    expect(r.itens.map((c) => c.id)).toEqual(['2', '3']);
    const e = filtrarChamados(todos, { empreendimentoIds: ['17', 'x'] }, 'agora');
    expect(e.itens.map((c) => c.id)).toEqual(['5']);
  });

  it('período usa o "hoje" informado', () => {
    const r = filtrarChamados(todos, { periodo: 'hoje' }, 'agora', '2026-09-02');
    expect(r.itens.map((c) => c.id)).toEqual(['3']);
    const s = filtrarChamados(todos, { periodo: '7' }, 'agora', '2026-09-02');
    expect(s.itens.map((c) => c.id)).toEqual(['3', '5', '1']);
    expect(s.facetas?.periodo).toMatchObject({ todos: 4, hoje: 1, '7': 3, '30': 3 });
  });

  it('local: área comum por área preenchida ou bloco A.C', () => {
    const lista = [
      chamado({ id: '10', areaComum: 'Piscina' }),
      chamado({ id: '11', bloco: 'A.C' }),
      chamado({ id: '12', bloco: 'B', unidade: { id: '1', nome: '101', codigoInterno: null } }),
    ];
    expect(filtrarChamados(lista, { local: 'area' }, 'agora').total).toBe(2);
    expect(filtrarChamados(lista, { local: 'unidade' }, 'agora').itens.map((c) => c.id)).toEqual([
      '12',
    ]);
  });

  it('facetas ignoram o próprio filtro e aplicam os demais', () => {
    const r = filtrarChamados(todos, { empreendimentoIds: ['17'], descricao: 'com' }, 'agora');
    expect(r.total).toBe(1);
    // Empreendimento: só o filtro de descrição vale → só o 5 tem descrição.
    expect(r.facetas?.empreendimento).toEqual({ '17': 1 });
    // Descrição: só o filtro de empreendimento vale → o 5.
    expect(r.facetas?.descricao).toEqual({ todos: 1, com: 1, sem: 0 });
    // KPIs aplicam os dois filtros.
    expect(r.porFase).toEqual({ nova: 1, andamento: 0, improcedente: 0, finalizado: 0 });
  });

  it('ordena por coluna e direção; solicitação vazia fica por último', () => {
    const asc = filtrarChamados(todos, { ordem: 'data', direcao: 'asc' }, 'agora');
    expect(asc.itens.map((c) => c.id)).toEqual(['5', '1', '3', '2']);
    const sit = filtrarChamados(todos, { ordem: 'situacao', direcao: 'desc' }, 'agora');
    expect(sit.itens[0]?.id).toBe('2');
    const desc = filtrarChamados(todos, { ordem: 'descricao', direcao: 'desc' }, 'agora');
    expect(desc.itens[0]?.id).toBe('5');
  });
});

describe('MockAssistenciaAdapter', () => {
  it('devolve página com contagens', async () => {
    const { assistencia } = createAdapters('mock');
    const r = await assistencia.listarChamados({ porPagina: 10 });
    expect(r.itens).toHaveLength(10);
    expect(r.total).toBeGreaterThan(10);
    expect(r.itens.every((c) => c.fluxo === 'ASSISTENCIA_TECNICA')).toBe(true);
  });
});
