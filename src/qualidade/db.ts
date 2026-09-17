import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { InspecaoFvs, ModeloFvs, NaoConformidade } from '@chaves/domain/qualidade';

/**
 * Banco local (IndexedDB) do módulo de Qualidade — a fonte da verdade NO
 * DISPOSITIVO. As telas leem e gravam só aqui; `sync.ts` conversa com o
 * Supabase quando há internet.
 *
 * Por que IndexedDB e não localStorage: fotos (Blob) e volume. Uma obra gera
 * centenas de inspeções com fotos; localStorage tem ~5 MB e só guarda texto.
 */

export type TipoRegistro = 'modelo' | 'inspecao' | 'nc' | 'foto';

/** Ordem de envio: pais antes de filhos (FKs no banco). */
export const ORDEM_ENVIO: Record<TipoRegistro, number> = {
  modelo: 0,
  inspecao: 1,
  nc: 2,
  foto: 3,
};

export interface FotoLocal {
  id: string;
  inspecaoId: string;
  itemId: string;
  storagePath: string;
  /** Presente enquanto a foto existir só neste dispositivo (ou em cache). */
  blob: Blob | null;
  enviada: boolean;
}

/**
 * Pendência de envio. Guarda só a REFERÊNCIA ao registro: no envio lemos o
 * estado atual, então 20 edições seguidas offline viram um único upsert.
 */
export interface EntradaOutbox {
  chave: string; // `${tipo}:${id}`
  tipo: TipoRegistro;
  id: string;
  /** Incrementa a cada nova edição — evita apagar uma edição feita durante o envio. */
  revisao: number;
  enfileiradoEm: string;
  tentativas: number;
  ultimoErro: string | null;
}

interface QualidadeDB extends DBSchema {
  modelos: { key: string; value: ModeloFvs };
  inspecoes: { key: string; value: InspecaoFvs };
  ncs: { key: string; value: NaoConformidade; indexes: { porInspecao: string } };
  fotos: { key: string; value: FotoLocal; indexes: { porInspecao: string } };
  outbox: { key: string; value: EntradaOutbox };
  meta: { key: string; value: unknown };
}

export type QualidadeIDB = IDBPDatabase<QualidadeDB>;

const NOME = 'chavesnamao-qualidade';
const VERSAO = 1;

const conexoes = new Map<string, Promise<QualidadeIDB>>();

/**
 * Abre (uma vez) o banco local. `sufixo` isola usuários diferentes no mesmo
 * aparelho (tablet compartilhado) e os testes.
 */
export function abrirBanco(sufixo: string): Promise<QualidadeIDB> {
  const nome = `${NOME}:${sufixo}`;
  let conexao = conexoes.get(nome);
  if (!conexao) {
    conexao = openDB<QualidadeDB>(nome, VERSAO, {
      upgrade(db) {
        db.createObjectStore('modelos', { keyPath: 'id' });
        db.createObjectStore('inspecoes', { keyPath: 'id' });
        db.createObjectStore('ncs', { keyPath: 'id' }).createIndex('porInspecao', 'inspecaoId');
        db.createObjectStore('fotos', { keyPath: 'id' }).createIndex('porInspecao', 'inspecaoId');
        db.createObjectStore('outbox', { keyPath: 'chave' });
        db.createObjectStore('meta');
      },
    });
    conexoes.set(nome, conexao);
  }
  return conexao;
}

/** Só para testes: esquece conexões abertas. */
export function fecharBancos(): void {
  for (const c of conexoes.values()) void c.then((db) => db.close());
  conexoes.clear();
}
