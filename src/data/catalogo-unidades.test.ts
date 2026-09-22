import { describe, expect, it } from 'vitest';
import type { Unidade } from '@chaves/domain/types';
import type { UnidadeErp } from '@/adapters/types';
import { mesclarCatalogo, numeroUnidade } from './catalogo-unidades';

const agora = '2026-09-22T00:00:00.000Z';

function mega(id: string, identificacao: string): UnidadeErp {
  return {
    id,
    empreendimentoId: '30',
    identificacao,
    status: 'VENDIDA',
    areaM2: null,
    createdAt: agora,
    contratoNumero: `C-${id}`,
    clienteNome: `Cliente ${id}`,
  };
}

function cv(id: string, identificacao: string, status: Unidade['status'], area = 50): Unidade {
  return { id, empreendimentoId: '30', identificacao, status, areaM2: area, createdAt: agora };
}

describe('numeroUnidade', () => {
  it.each([
    ['TORRE D - 608', '608'],
    ['1 (PNE)', '1'],
    ['UN15', '15'],
    ['0012A', '12A'],
    ['608', '608'],
  ])('%s → %s', (nome, esperado) => {
    expect(numeroUnidade(nome)).toBe(esperado);
  });
});

describe('mesclarCatalogo', () => {
  it('mantém as vendidas do Mega, completa a área e acrescenta as disponíveis do CV', () => {
    const doErp = [mega('m1', 'BLOCO D · 608'), mega('m2', 'BLOCO D · 607')];
    const doCrm = [
      cv('8688', 'Etapa Única · BLOCO D · TORRE D - 608', 'VENDIDA', 61.2),
      cv('8687', 'Etapa Única · BLOCO D · TORRE D - 607', 'VENDIDA', 58),
      cv('8686', 'Etapa Única · BLOCO D · TORRE D - 606', 'DISPONIVEL'),
    ];

    const r = mesclarCatalogo(doErp, doCrm);

    expect(r.map((u) => u.id)).toEqual(['m1', 'm2', '8686']);
    expect(r[0]).toMatchObject({ areaM2: 61.2, contratoNumero: 'C-m1' });
    expect(r[2]?.status).toBe('DISPONIVEL');
  });

  it('não casa o mesmo número em blocos diferentes', () => {
    const doErp = [mega('a101', 'BLOCO A · 101')];
    const doCrm = [
      cv('1', 'Etapa · BLOCO A · 101', 'VENDIDA'),
      cv('2', 'Etapa · BLOCO B · 101', 'DISPONIVEL'),
    ];

    const r = mesclarCatalogo(doErp, doCrm);

    expect(r.map((u) => u.id)).toEqual(['a101', '2']);
  });

  it('casa pelo número único quando a grafia do bloco diverge', () => {
    const doErp = [mega('m1', 'TORRE 01 · 10')];
    const doCrm = [cv('1', 'Etapa · BL 1 · 10', 'VENDIDA'), cv('2', 'Etapa · BL 1 · 11', 'DISPONIVEL')];

    expect(mesclarCatalogo(doErp, doCrm).map((u) => u.id)).toEqual(['m1', '2']);
  });

  it('sem cruzamento confiável, não duplica vendidas — só acrescenta as não vendidas', () => {
    const doErp = [mega('m1', 'X · 1'), mega('m2', 'X · 1')];
    const doCrm = [cv('10', 'Y · Z · 1', 'VENDIDA'), cv('11', 'Y · Z · 9', 'VENDIDA'), cv('12', 'Y · Z · 2', 'DISPONIVEL')];

    const ids = mesclarCatalogo(doErp, doCrm).map((u) => u.id);

    expect(ids).toEqual(['m1', 'm2', '12']);
  });

  it('com Mega vazio (empreendimento fora do Mega), devolve o mapa inteiro do CV', () => {
    const doCrm = [cv('1', 'E · B · 1', 'EM_OBRAS'), cv('2', 'E · B · 2', 'VENDIDA')];
    const r = mesclarCatalogo([], doCrm);
    expect(r.map((u) => u.id)).toEqual(['1', '2']);
    expect(r.every((u) => u.cvUnidadeId === u.id)).toBe(true);
    // Sem contrato na carteira do Mega = disponível, mesmo "vendida" no CV.
    expect(r.every((u) => u.status === 'DISPONIVEL')).toBe(true);
  });

  it('leva o id do CV para a unidade casada do Mega', () => {
    const doErp = [mega('m1', 'BLOCO N · 404')];
    const doCrm = [
      { ...cv('11511', 'Etapa Única · BLOCO N · BLOCO N - 404', 'VENDIDA'), situacaoCv: 'vendida' },
    ];
    expect(mesclarCatalogo(doErp, doCrm)[0]).toMatchObject({
      id: 'm1',
      cvUnidadeId: '11511',
      situacaoCv: 'vendida',
    });
  });

  it('casa pelo id quando os dois lados usam o mesmo (modo mock)', () => {
    const doErp = [mega('u-1', 'Torre A · 101')];
    const doCrm = [cv('u-1', 'Torre A · 101', 'VENDIDA', 70)];
    expect(mesclarCatalogo(doErp, doCrm)).toEqual([
      { ...doErp[0], areaM2: 70, cvUnidadeId: 'u-1', situacaoCv: null, motivoBloqueioCv: null },
    ]);
  });
});
