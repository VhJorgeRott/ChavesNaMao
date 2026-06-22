import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf, onlyDigits } from './cpf';

describe('isValidCpf', () => {
  it('aceita CPFs válidos (com e sem máscara)', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('rejeita dígitos verificadores errados', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('11144477736')).toBe(false);
  });

  it('rejeita tamanho incorreto', () => {
    expect(isValidCpf('123')).toBe(false);
    expect(isValidCpf('5299822472555')).toBe(false);
  });

  it('rejeita sequências repetidas', () => {
    expect(isValidCpf('000.000.000-00')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
  });
});

describe('formatCpf / onlyDigits', () => {
  it('formata 11 dígitos com máscara', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });
  it('extrai apenas dígitos', () => {
    expect(onlyDigits('529.982.247-25')).toBe('52998224725');
  });
});
