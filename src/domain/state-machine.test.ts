import { describe, expect, it } from 'vitest';
import { ENTREGA_STATUS, type EntregaStatus } from './types';
import {
  ESTADO_FINAL,
  ESTADO_INICIAL,
  TransicaoInvalidaError,
  indiceEtapa,
  isTerminal,
  podeTransicionar,
  proximosEstados,
  transicionar,
} from './state-machine';

describe('máquina de estados da entrega', () => {
  it('avança sequencialmente por todas as 6 etapas', () => {
    let estado: EntregaStatus = ESTADO_INICIAL;
    const caminho: EntregaStatus[] = [estado];
    while (!isTerminal(estado)) {
      const [proximo] = proximosEstados(estado);
      estado = transicionar(estado, proximo);
      caminho.push(estado);
    }
    expect(caminho).toEqual([...ENTREGA_STATUS]);
    expect(estado).toBe(ESTADO_FINAL);
  });

  it('permite cada transição linear válida', () => {
    expect(podeTransicionar('ABERTURA', 'INTEGRACAO')).toBe(true);
    expect(podeTransicionar('INTEGRACAO', 'DOCUMENTOS')).toBe(true);
    expect(podeTransicionar('DOCUMENTOS', 'ASSINATURA')).toBe(true);
    expect(podeTransicionar('ASSINATURA', 'REGISTRO')).toBe(true);
    expect(podeTransicionar('REGISTRO', 'CONCLUIDA')).toBe(true);
  });

  it('rejeita pular etapas (deny-by-default)', () => {
    expect(podeTransicionar('ABERTURA', 'DOCUMENTOS')).toBe(false);
    expect(podeTransicionar('ABERTURA', 'CONCLUIDA')).toBe(false);
    expect(podeTransicionar('INTEGRACAO', 'ASSINATURA')).toBe(false);
  });

  it('rejeita retroceder', () => {
    expect(podeTransicionar('DOCUMENTOS', 'INTEGRACAO')).toBe(false);
    expect(podeTransicionar('CONCLUIDA', 'REGISTRO')).toBe(false);
  });

  it('rejeita auto-transição', () => {
    for (const estado of ENTREGA_STATUS) {
      expect(podeTransicionar(estado, estado)).toBe(false);
    }
  });

  it('lança TransicaoInvalidaError ao tentar transição proibida', () => {
    expect(() => transicionar('ABERTURA', 'CONCLUIDA')).toThrow(TransicaoInvalidaError);
    try {
      transicionar('ABERTURA', 'CONCLUIDA');
    } catch (e) {
      expect(e).toBeInstanceOf(TransicaoInvalidaError);
      const err = e as TransicaoInvalidaError;
      expect(err.de).toBe('ABERTURA');
      expect(err.para).toBe('CONCLUIDA');
    }
  });

  it('CONCLUIDA é terminal e não tem próximos estados', () => {
    expect(isTerminal('CONCLUIDA')).toBe(true);
    expect(proximosEstados('CONCLUIDA')).toEqual([]);
  });

  it('apenas CONCLUIDA é terminal', () => {
    const terminais = ENTREGA_STATUS.filter(isTerminal);
    expect(terminais).toEqual(['CONCLUIDA']);
  });

  it('indiceEtapa reflete a ordem das etapas', () => {
    expect(indiceEtapa('ABERTURA')).toBe(0);
    expect(indiceEtapa('CONCLUIDA')).toBe(5);
  });
});
