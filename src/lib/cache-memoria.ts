/**
 * Cache em memória das consultas de tela (chamados, atividade): sobrevive à
 * navegação entre rotas, some no F5 e é limpo no logout.
 *
 * Em memória — e não no localStorage como o catálogo (`src/data/cache.ts`) —
 * porque essas respostas carregam dado pessoal (nome, e-mail, CPF do cliente).
 */

/** Esses dados mudam pouco; quem precisa de dado fresco usa o botão Atualizar. */
const TTL_MS = 2 * 60 * 60 * 1000;

interface Entrada {
  em: number;
  promessa: Promise<unknown>;
  valor?: unknown;
  resolvido: boolean;
}

const entradas = new Map<string, Entrada>();

function fresca(chave: string): Entrada | undefined {
  const e = entradas.get(chave);
  if (e && Date.now() - e.em < TTL_MS) return e;
  entradas.delete(chave);
  return undefined;
}

/** Valor já resolvido e dentro do TTL — para o estado inicial da tela não piscar esqueleto. */
export function lerCache<T>(chave: string): T | undefined {
  const e = fresca(chave);
  return e?.resolvido ? (e.valor as T) : undefined;
}

/**
 * Serve do cache dentro do TTL. Guarda a promessa, então duas telas pedindo a
 * mesma chave ao mesmo tempo fazem uma busca só. Erro não fica cacheado.
 */
export function comCache<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  const existente = fresca(chave);
  if (existente) return existente.promessa as Promise<T>;
  const entrada: Entrada = { em: Date.now(), promessa: buscar(), resolvido: false };
  entradas.set(chave, entrada);
  entrada.promessa.then(
    (v) => {
      entrada.valor = v;
      entrada.resolvido = true;
    },
    () => {
      if (entradas.get(chave) === entrada) entradas.delete(chave);
    },
  );
  return entrada.promessa as Promise<T>;
}

/** Sem prefixo limpa tudo (logout); com prefixo limpa um grupo (botão Atualizar). */
export function limparCache(prefixo = ''): void {
  for (const chave of [...entradas.keys()]) if (chave.startsWith(prefixo)) entradas.delete(chave);
}
