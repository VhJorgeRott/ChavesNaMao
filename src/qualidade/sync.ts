import type { SupabaseClient } from '@supabase/supabase-js';
import { ORDEM_ENVIO, type EntradaOutbox, type QualidadeIDB } from './db';
import {
  type InspecaoRow,
  type ModeloRow,
  type NcRow,
  type TabelaQualidade,
  inspecaoParaRow,
  modeloParaRow,
  ncParaRow,
  rowParaInspecao,
  rowParaModelo,
  rowParaNc,
} from './mapeamento';

/**
 * Sincronização do banco local com o Supabase.
 *
 *  1. ENVIO: percorre a fila (pais antes de filhos), lê o estado ATUAL de cada
 *     registro e faz upsert idempotente. Fotos sobem ao Storage.
 *  2. RECEBIMENTO: busca o que mudou no servidor desde o último cursor
 *     (`updated_at`) e grava localmente — exceto registros com edição local
 *     ainda não enviada (a edição local vence até subir; no servidor, a guarda
 *     de `cliente_atualizado_em` decide entre dispositivos).
 *
 * Falha de rede interrompe e tenta de novo depois. Erro de dado (RLS, check)
 * fica registrado na pendência e não trava as demais.
 */

/** Acesso ao servidor. Interface para permitir testar sem Supabase. */
export interface RemotoQualidade {
  upsert(tabela: TabelaQualidade, row: object): Promise<void>;
  /** Envia a foto; já existir no caminho conta como sucesso. */
  enviarFoto(caminho: string, blob: Blob): Promise<void>;
  /** Linhas com `updated_at` >= cursor, em ordem crescente. */
  mudancasDesde(tabela: TabelaQualidade, cursor: string | null, limite: number): Promise<object[]>;
}

export class ErroDeRede extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroDeRede';
  }
}

export interface ResultadoSync {
  enviados: number;
  recebidos: number;
  comErro: number;
}

const LIMITE_PAGINA = 500;
const CURSOR = (t: TabelaQualidade) => `cursor:${t}`;

export async function sincronizar(
  db: QualidadeIDB,
  remoto: RemotoQualidade,
): Promise<ResultadoSync> {
  const enviado = await enviarPendencias(db, remoto);
  const recebidos = await receberMudancas(db, remoto);
  return { enviados: enviado.enviados, comErro: enviado.comErro, recebidos };
}

async function enviarPendencias(
  db: QualidadeIDB,
  remoto: RemotoQualidade,
): Promise<{ enviados: number; comErro: number }> {
  const fila = (await db.getAll('outbox')).sort(
    (a, b) =>
      ORDEM_ENVIO[a.tipo] - ORDEM_ENVIO[b.tipo] || a.enfileiradoEm.localeCompare(b.enfileiradoEm),
  );
  let enviados = 0;
  let comErro = 0;

  for (const entrada of fila) {
    try {
      const existe = await enviarUma(db, remoto, entrada);
      await concluirEntrada(db, entrada);
      if (existe) enviados += 1;
    } catch (e) {
      if (e instanceof ErroDeRede) throw e;
      comErro += 1;
      const atual = await db.get('outbox', entrada.chave);
      if (atual) {
        await db.put('outbox', {
          ...atual,
          tentativas: atual.tentativas + 1,
          ultimoErro: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }
  return { enviados, comErro };
}

/** Envia o estado atual do registro. Retorna false se ele não existe mais. */
async function enviarUma(
  db: QualidadeIDB,
  remoto: RemotoQualidade,
  e: EntradaOutbox,
): Promise<boolean> {
  switch (e.tipo) {
    case 'modelo': {
      const m = await db.get('modelos', e.id);
      if (!m) return false;
      await remoto.upsert('fvs_modelos', modeloParaRow(m));
      return true;
    }
    case 'inspecao': {
      const i = await db.get('inspecoes', e.id);
      if (!i) return false;
      await remoto.upsert('fvs_inspecoes', inspecaoParaRow(i));
      return true;
    }
    case 'nc': {
      const n = await db.get('ncs', e.id);
      if (!n) return false;
      await remoto.upsert('fvs_nao_conformidades', ncParaRow(n));
      return true;
    }
    case 'foto': {
      const f = await db.get('fotos', e.id);
      if (!f?.blob) return false;
      await remoto.enviarFoto(f.storagePath, f.blob);
      await db.put('fotos', { ...f, enviada: true });
      return true;
    }
  }
}

/** Remove a pendência — a não ser que o registro tenha sido editado durante o envio. */
async function concluirEntrada(db: QualidadeIDB, enviada: EntradaOutbox): Promise<void> {
  const tx = db.transaction('outbox', 'readwrite');
  const atual = await tx.store.get(enviada.chave);
  if (atual && atual.revisao === enviada.revisao) await tx.store.delete(enviada.chave);
  await tx.done;
}

async function receberMudancas(db: QualidadeIDB, remoto: RemotoQualidade): Promise<number> {
  let total = 0;
  total += await receberTabela(db, remoto, 'fvs_modelos', async (row, pendentes) => {
    const r = row as ModeloRow;
    if (pendentes.has(`modelo:${r.id}`)) return;
    await db.put('modelos', rowParaModelo(r));
  });
  total += await receberTabela(db, remoto, 'fvs_inspecoes', async (row, pendentes) => {
    const r = row as InspecaoRow;
    if (pendentes.has(`inspecao:${r.id}`)) return;
    await db.put('inspecoes', rowParaInspecao(r));
  });
  total += await receberTabela(db, remoto, 'fvs_nao_conformidades', async (row, pendentes) => {
    const r = row as NcRow;
    if (pendentes.has(`nc:${r.id}`)) return;
    await db.put('ncs', rowParaNc(r));
  });
  return total;
}

async function receberTabela(
  db: QualidadeIDB,
  remoto: RemotoQualidade,
  tabela: TabelaQualidade,
  aplicar: (row: object, pendentes: Set<string>) => Promise<void>,
): Promise<number> {
  let cursor = ((await db.get('meta', CURSOR(tabela))) as string | undefined) ?? null;
  let total = 0;
  for (;;) {
    const linhas = await remoto.mudancasDesde(tabela, cursor, LIMITE_PAGINA);
    if (linhas.length === 0) break;
    const pendentes = new Set(await db.getAllKeys('outbox'));
    for (const linha of linhas) await aplicar(linha, pendentes);
    total += linhas.length;
    const ultimo = (linhas[linhas.length - 1] as { updated_at?: string }).updated_at;
    if (!ultimo || ultimo === cursor) break;
    cursor = ultimo;
    await db.put('meta', cursor, CURSOR(tabela));
    if (linhas.length < LIMITE_PAGINA) break;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Implementação Supabase
// ---------------------------------------------------------------------------

function ehErroDeRede(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg);
}

export function remotoSupabase(supabase: SupabaseClient): RemotoQualidade {
  const falhar = (e: unknown, contexto: string): never => {
    const msg = (e as { message?: string })?.message ?? String(e);
    if (ehErroDeRede(e)) throw new ErroDeRede(`${contexto}: ${msg}`);
    throw new Error(`${contexto}: ${msg}`);
  };

  return {
    async upsert(tabela, row) {
      try {
        const { error } = await supabase.from(tabela).upsert(row, { onConflict: 'id' });
        if (error) falhar(error, `Envio para ${tabela}`);
      } catch (e) {
        if (e instanceof ErroDeRede || (e instanceof Error && e.message.startsWith('Envio')))
          throw e;
        falhar(e, `Envio para ${tabela}`);
      }
    },

    async enviarFoto(caminho, blob) {
      try {
        const { error } = await supabase.storage
          .from('qualidade')
          .upload(caminho, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
        // Reenvio após queda de conexão: o arquivo já está lá.
        if (error && !/already exists|duplicate/i.test(error.message))
          falhar(error, 'Envio de foto');
      } catch (e) {
        if (e instanceof ErroDeRede || (e instanceof Error && e.message.startsWith('Envio')))
          throw e;
        falhar(e, 'Envio de foto');
      }
    },

    async mudancasDesde(tabela, cursor, limite) {
      try {
        let q = supabase
          .from(tabela)
          .select('*')
          .order('updated_at', { ascending: true })
          .limit(limite);
        // gte (não gt): linhas gravadas no mesmo instante do cursor não se perdem
        // na virada de página. Reaplicar a linha do cursor é idempotente.
        if (cursor) q = q.gte('updated_at', cursor);
        const { data, error } = await q;
        if (error) falhar(error, `Leitura de ${tabela}`);
        return (data ?? []) as object[];
      } catch (e) {
        if (e instanceof ErroDeRede || (e instanceof Error && e.message.startsWith('Leitura')))
          throw e;
        return falhar(e, `Leitura de ${tabela}`);
      }
    },
  };
}

/** URL temporária de uma foto já enviada (para ver em outro dispositivo). */
export async function urlAssinadaFoto(
  supabase: SupabaseClient,
  caminho: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('qualidade')
    .createSignedUrl(caminho, 60 * 10);
  return error ? null : data.signedUrl;
}
