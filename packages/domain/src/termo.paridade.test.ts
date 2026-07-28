import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATALOGO_VARIAVEIS, renderTermo } from './termo.js';

/**
 * Guarda da duplicação entre `src/domain/termo.ts` (navegador, usado no preview
 * do editor) e `supabase/functions/_shared/termo.ts` (Deno, que gera o PDF que
 * vai à assinatura).
 *
 * Os dois precisam existir — a Edge Function não importa de `src/` — mas se as
 * chaves divergirem, o preview mostra uma coisa e o cliente assina outra. Este
 * teste lê o arquivo do servidor como texto e compara o conjunto de chaves.
 */

const CAMINHO_SERVIDOR = fileURLToPath(
  new URL('../../../supabase/functions/_shared/termo.ts', import.meta.url),
);

/** Extrai as chaves declaradas no mapa RESOLVERS do arquivo do servidor. */
function chavesDoServidor(): Set<string> {
  const fonte = readFileSync(CAMINHO_SERVIDOR, 'utf8');
  const inicio = fonte.indexOf('export const RESOLVERS');
  expect(inicio).toBeGreaterThan(-1);
  const corpo = fonte.slice(inicio, fonte.indexOf('\n};', inicio));
  return new Set([...corpo.matchAll(/^\s{2}'([\w.]+)':/gm)].map((m) => m[1]!));
}

/** Chaves do lado do navegador, pelo catálogo que a UI oferece. */
function chavesDoNavegador(): Set<string> {
  return new Set(CATALOGO_VARIAVEIS.flatMap((g) => g.itens.map((i) => i.chave)));
}

describe('paridade das variáveis de termo entre navegador e servidor', () => {
  it('o servidor resolve toda variável que a UI oferece', () => {
    const servidor = chavesDoServidor();
    const faltando = [...chavesDoNavegador()].filter((c) => !servidor.has(c));
    expect(faltando).toEqual([]);
  });

  it('o servidor não inventa variável que a UI desconhece', () => {
    const navegador = chavesDoNavegador();
    const sobrando = [...chavesDoServidor()].filter((c) => !navegador.has(c));
    expect(sobrando).toEqual([]);
  });

  it('resolve as variáveis com fonte automática', () => {
    const saida = renderTermo('{{cliente.nome}} · {{unidade.identificacao}}', {
      cliente: {
        id: 'c1',
        nome: 'Maria Souza',
        cpf: '52998224725',
        email: 'm@e.com',
        telefone: '',
        createdAt: '',
      },
      unidade: {
        id: 'u1',
        empreendimentoId: 'e1',
        identificacao: 'TORRE A · 101',
        status: 'LIBERADA',
        areaM2: 60,
        createdAt: '',
      },
    });
    expect(saida).toBe('Maria Souza · TORRE A · 101');
  });
});
