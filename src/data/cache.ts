/**
 * Cache local (localStorage) do catálogo: empreendimentos e unidades.
 *
 * Motivo: o catálogo vem do CV/Mega a cada visita de tela, o que deixava a
 * listagem de unidades lenta e — pior — zerava os números do dashboard sempre
 * que o app era fechado. Guardando aqui, o app reabre já com os dados e a
 * revalidação acontece em segundo plano.
 *
 * O que NÃO entra aqui: entregas, clientes, documentos e assinaturas. Essas são
 * a operação em si, com dado pessoal, e vivem no Supabase sob RLS (ver
 * `persistencia.ts`). O catálogo cacheado carrega apenas identificação, status,
 * área e os campos de contrato que o Mega devolve — sem CPF, e-mail ou telefone.
 */
import type { Empreendimento, Unidade } from '@chaves/domain/types';

/**
 * Sobe a versão para invalidar caches antigos.
 *
 * v2: quem já usou o app tem empreendimentos e unidades de DEMONSTRAÇÃO
 * gravados aqui, de quando o seed entrava no estado mesmo em modo live. Sem
 * trocar a chave, eles voltariam do cache e continuariam na tela.
 * v3: o catálogo passou a trazer todas as unidades do CV (não só as vendidas
 * do Mega); o cache antigo esconderia as disponíveis até expirar.
 */
const CHAVE = 'chavesnamao:catalogo:v3';

export interface CatalogoCache {
  empreendimentos: Empreendimento[];
  unidades: Unidade[];
  /** ISO da última sincronização bem-sucedida, por empreendimento. */
  sincronizadoEm: Record<string, string>;
}

export const CATALOGO_VAZIO: CatalogoCache = {
  empreendimentos: [],
  unidades: [],
  sincronizadoEm: {},
};

function ehArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/**
 * Lê o catálogo salvo. Qualquer inconsistência (JSON inválido, formato de uma
 * versão anterior, storage indisponível em aba privada) devolve o catálogo
 * vazio: cache é otimização, nunca motivo para o app não abrir.
 */
export function lerCatalogo(): CatalogoCache {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return CATALOGO_VAZIO;
    const dados = JSON.parse(bruto) as Partial<CatalogoCache>;
    if (!ehArray(dados.empreendimentos) || !ehArray(dados.unidades)) return CATALOGO_VAZIO;
    return {
      empreendimentos: dados.empreendimentos as Empreendimento[],
      unidades: dados.unidades as Unidade[],
      sincronizadoEm:
        dados.sincronizadoEm && typeof dados.sincronizadoEm === 'object'
          ? dados.sincronizadoEm
          : {},
    };
  } catch {
    return CATALOGO_VAZIO;
  }
}

/**
 * Grava o catálogo. Falha silenciosa por desenho: estourar a cota do
 * localStorage não pode derrubar o fluxo de quem está entregando uma chave.
 */
export function gravarCatalogo(catalogo: CatalogoCache): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(catalogo));
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[cache] não foi possível gravar o catálogo', e);
  }
}

export function limparCatalogo(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}
