import { describe, expect, it } from 'vitest';
import { montarCsv } from './csv';

const SEM_BOM = (s: string): string => s.replace(/^\uFEFF/, '');

describe('montarCsv', () => {
  it('começa com BOM para o Excel ler UTF-8', () => {
    expect(montarCsv([['Ação']]).startsWith('\uFEFF')).toBe(true);
  });

  it('separa colunas por ; e linhas por CRLF', () => {
    expect(
      SEM_BOM(
        montarCsv([
          ['a', 'b'],
          ['c', 'd'],
        ]),
      ),
    ).toBe('"a";"b"\r\n"c";"d"');
  });

  it('não deixa um ; no conteúdo virar coluna nova', () => {
    const csv = SEM_BOM(montarCsv([['Silva; Souza', 'x']]));
    expect(csv).toBe('"Silva; Souza";"x"');
    // 2 campos, não 3
    expect(csv.split('";"')).toHaveLength(2);
  });

  it('escapa aspas duplicando-as', () => {
    expect(SEM_BOM(montarCsv([['Cliente "Zé"']]))).toBe('"Cliente ""Zé"""');
  });

  it('mantém quebra de linha dentro do campo entre aspas', () => {
    expect(SEM_BOM(montarCsv([['linha1\nlinha2']]))).toBe('"linha1\nlinha2"');
  });

  it('aceita lista vazia', () => {
    expect(SEM_BOM(montarCsv([]))).toBe('');
  });
});
