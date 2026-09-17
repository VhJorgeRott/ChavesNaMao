import { describe, expect, it } from 'vitest';
import {
  type InspecaoFvs,
  InspecaoIncompletaError,
  type ModeloFvs,
  concluirInspecao,
  criarInspecao,
  criarReinspecao,
  descreverLocal,
  marcarRestantesConformes,
  ncVencida,
  pendenciasParaConcluir,
  progressoInspecao,
  validarEstrutura,
} from './qualidade.js';

const AGORA = '2026-09-17T10:00:00.000Z';

function geradorIds(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

const modelo: ModeloFvs = {
  id: 'mod-alv',
  codigo: 'FVS-01',
  nome: 'Alvenaria de vedação',
  servico: 'Alvenaria',
  descricao: null,
  versao: 3,
  ativo: true,
  atualizadoEm: AGORA,
  estrutura: {
    secoes: [
      {
        id: 's1',
        titulo: 'Execução',
        itens: [
          { id: 'i1', texto: 'Prumo', criterio: '3 mm/m', metodo: null, fotoObrigatoriaNc: true },
          { id: 'i2', texto: 'Nível', criterio: null, metodo: null, fotoObrigatoriaNc: false },
        ],
      },
      {
        id: 's2',
        titulo: 'Limpeza',
        itens: [
          { id: 'i3', texto: 'Área limpa', criterio: null, metodo: null, fotoObrigatoriaNc: false },
        ],
      },
    ],
  },
};

const local = {
  empreendimentoRef: '25',
  empreendimentoNome: 'Porto Horizonte',
  codigo: '01.01.06',
  bloco: 'Bloco A',
  unidadeRef: '101',
  unidadeNome: 'Apto 101',
  detalhe: null,
};

const inspetor = { id: 'u1', nome: 'Ana' };

function responder(
  insp: InspecaoFvs,
  respostas: Record<string, 'C' | 'NC' | 'NA'>,
  obs?: string,
): InspecaoFvs {
  const r = { ...insp.respostas };
  for (const [itemId, resultado] of Object.entries(respostas)) {
    r[itemId] = { itemId, resultado, observacao: obs ?? null, respondidoEm: AGORA };
  }
  return { ...insp, respostas: r };
}

describe('criarInspecao', () => {
  it('congela a estrutura do modelo (editar o modelo não afeta a inspeção)', () => {
    const insp = criarInspecao(modelo, { local }, inspetor, AGORA, geradorIds());
    expect(insp.modeloVersao).toBe(3);
    expect(insp.estrutura).toEqual(modelo.estrutura);
    expect(insp.estrutura).not.toBe(modelo.estrutura);
    expect(insp.estrutura.secoes[0]).not.toBe(modelo.estrutura.secoes[0]);
  });
});

describe('progresso e pendências', () => {
  it('conta respostas e calcula conformidade só sobre itens aplicáveis', () => {
    const insp = responder(criarInspecao(modelo, { local }, inspetor, AGORA, geradorIds()), {
      i1: 'C',
      i2: 'NC',
      i3: 'NA',
    });
    expect(progressoInspecao(insp)).toEqual({
      total: 3,
      respondidos: 3,
      naoVerificados: 0,
      conformes: 1,
      naoConformes: 1,
      naoAplicaveis: 1,
      conformidade: 50,
    });
  });

  it('item em branco fica "não verificado" e não impede concluir', () => {
    const insp = responder(criarInspecao(modelo, { local }, inspetor, AGORA, geradorIds()), {
      i1: 'C',
    });
    expect(progressoInspecao(insp)).toMatchObject({ respondidos: 1, naoVerificados: 2 });
    expect(pendenciasParaConcluir(insp)).toEqual([]);
  });

  it('exige foto no item reprovado quando o modelo manda, e ao menos um item verificado', () => {
    const vazia = criarInspecao(modelo, { local }, inspetor, AGORA, geradorIds());
    expect(pendenciasParaConcluir(vazia)).toEqual([
      { tipo: 'nada_verificado', itemId: null, itemTexto: expect.any(String) },
    ]);

    const comNc = responder(vazia, { i1: 'NC' });
    expect(pendenciasParaConcluir(comNc)).toEqual([
      { tipo: 'foto_obrigatoria', itemId: 'i1', itemTexto: 'Prumo' },
    ]);
  });

  it('"restantes conformes" não sobrescreve o que já foi respondido', () => {
    const insp = marcarRestantesConformes(
      responder(criarInspecao(modelo, { local }, inspetor, AGORA, geradorIds()), { i2: 'NC' }),
      AGORA,
    );
    expect(insp.respostas.i1?.resultado).toBe('C');
    expect(insp.respostas.i2?.resultado).toBe('NC');
    expect(insp.respostas.i3?.resultado).toBe('C');
  });
});

describe('concluirInspecao', () => {
  it('recusa concluir ficha totalmente em branco', () => {
    const insp = criarInspecao(modelo, { local }, inspetor, AGORA, geradorIds());
    expect(() => concluirInspecao(insp, [], AGORA, geradorIds())).toThrow(InspecaoIncompletaError);
  });

  it('aprovada quando não há NC, mesmo com item não verificado', () => {
    const insp = responder(criarInspecao(modelo, { local }, inspetor, AGORA, geradorIds()), {
      i1: 'C',
      i2: 'C',
    });
    const r = concluirInspecao(insp, [], AGORA, geradorIds());
    expect(r.inspecao.status).toBe('concluida');
    expect(r.inspecao.resultado).toBe('aprovada');
    expect(r.novasNcs).toEqual([]);
  });

  it('gera uma NC por item reprovado, com seção, local e observação', () => {
    const ids = geradorIds();
    const insp = responder(
      responder(criarInspecao(modelo, { local }, inspetor, AGORA, ids), { i1: 'C', i3: 'C' }),
      { i2: 'NC' },
      'Desnível de 1 cm',
    );
    const r = concluirInspecao(insp, [], AGORA, ids);
    expect(r.inspecao.resultado).toBe('reprovada');
    expect(r.novasNcs).toHaveLength(1);
    expect(r.novasNcs[0]).toMatchObject({
      inspecaoId: insp.id,
      itemId: 'i2',
      itemTexto: 'Nível',
      secaoTitulo: 'Execução',
      descricao: 'Desnível de 1 cm',
      status: 'aberta',
      local,
    });
  });
});

describe('reinspeção', () => {
  function inspecaoReprovada() {
    const ids = geradorIds();
    let insp = criarInspecao(modelo, { local }, inspetor, AGORA, ids);
    insp = responder(insp, { i1: 'NC', i2: 'NC', i3: 'C' });
    insp = { ...insp, fotos: [{ id: 'f1', itemId: 'i1', storagePath: null, criadaEm: AGORA }] };
    const r = concluirInspecao(insp, [], AGORA, ids);
    return { ids, origem: r.inspecao, ncs: r.novasNcs };
  }

  it('verifica apenas os itens das NCs abertas', () => {
    const { ids, origem, ncs } = inspecaoReprovada();
    const re = criarReinspecao(origem, ncs, { id: 'u2', nome: 'Bruno' }, AGORA, ids);
    expect(re.reinspecaoDe).toBe(origem.id);
    expect([...(re.itensAlvo ?? [])].sort()).toEqual(['i1', 'i2']);
    expect(progressoInspecao(re).total).toBe(2);
    expect(re.respostas).toEqual({});
  });

  it('fecha as NCs corrigidas e reabre as que continuam não conformes', () => {
    const { ids, origem, ncs } = inspecaoReprovada();
    let re = criarReinspecao(origem, ncs, inspetor, AGORA, ids);
    re = responder(re, { i1: 'C', i2: 'NC' });
    const r = concluirInspecao(re, ncs, '2026-09-20T10:00:00.000Z', ids);
    expect(r.novasNcs).toEqual([]);
    const porItem = Object.fromEntries(r.ncsAtualizadas.map((nc) => [nc.itemId, nc]));
    expect(porItem.i1?.status).toBe('fechada');
    expect(porItem.i1?.fechadaEm).toBe('2026-09-20T10:00:00.000Z');
    expect(porItem.i2?.status).toBe('aberta');
    expect(porItem.i2?.reinspecoes).toEqual([re.id]);
  });

  it('reinspeção de uma reinspeção continua apontando para a inspeção raiz', () => {
    const { ids, origem, ncs } = inspecaoReprovada();
    let re1 = criarReinspecao(origem, ncs, inspetor, AGORA, ids);
    re1 = responder(re1, { i1: 'C', i2: 'NC' });
    const r1 = concluirInspecao(re1, ncs, AGORA, ids);
    const ncsDepois = ncs.map((nc) => r1.ncsAtualizadas.find((u) => u.id === nc.id) ?? nc);

    const re2 = criarReinspecao(r1.inspecao, ncsDepois, inspetor, AGORA, ids);
    expect(re2.reinspecaoDe).toBe(origem.id);
    expect(re2.itensAlvo).toEqual(['i2']);
  });

  it('não cria reinspeção sem NC aberta', () => {
    const { ids, origem, ncs } = inspecaoReprovada();
    const fechadas = ncs.map((nc) => ({ ...nc, status: 'fechada' as const }));
    expect(() => criarReinspecao(origem, fechadas, inspetor, AGORA, ids)).toThrow();
  });
});

describe('utilitários', () => {
  it('ncVencida considera prazo e status', () => {
    expect(ncVencida({ prazo: '2026-09-10', status: 'aberta' }, '2026-09-17')).toBe(true);
    expect(ncVencida({ prazo: '2026-09-17', status: 'aberta' }, '2026-09-17')).toBe(false);
    expect(ncVencida({ prazo: '2026-09-10', status: 'fechada' }, '2026-09-17')).toBe(false);
    expect(ncVencida({ prazo: null, status: 'aberta' }, '2026-09-17')).toBe(false);
  });

  it('descreverLocal junta só as partes preenchidas', () => {
    expect(descreverLocal({ ...local, detalhe: 'Banheiro' })).toBe(
      'Porto Horizonte · Bloco A · Apto 101 · Banheiro',
    );
    expect(descreverLocal({ ...local, bloco: null, unidadeNome: null })).toBe('Porto Horizonte');
  });

  it('validarEstrutura aponta seção vazia, item sem texto e id duplicado', () => {
    expect(validarEstrutura(modelo.estrutura)).toEqual([]);
    expect(validarEstrutura({ secoes: [] })).toHaveLength(1);
    const erros = validarEstrutura({
      secoes: [
        {
          id: 's',
          titulo: '',
          itens: [
            { id: 'x', texto: '', criterio: null, metodo: null, fotoObrigatoriaNc: false },
            { id: 'x', texto: 'ok', criterio: null, metodo: null, fotoObrigatoriaNc: false },
          ],
        },
      ],
    });
    expect(erros).toHaveLength(3);
  });
});
