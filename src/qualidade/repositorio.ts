import type { InspecaoFvs, ModeloFvs, NaoConformidade } from '@chaves/domain/qualidade';
import { caminhoFoto } from './mapeamento';
import { type EntradaOutbox, type FotoLocal, type QualidadeIDB, type TipoRegistro } from './db';

/**
 * Leitura e escrita LOCAIS do módulo de Qualidade.
 *
 * Toda escrita grava o registro e enfileira uma pendência de envio na mesma
 * transação — se o app fechar no meio, ou os dois existem, ou nenhum. A tela
 * nunca espera a rede.
 */
export class RepositorioQualidade {
  private ouvintes = new Set<() => void>();

  constructor(
    readonly db: QualidadeIDB,
    /** Chamado após cada escrita local (agenda a sincronização). */
    private aoEscrever: () => void = () => {},
  ) {}

  // --- Assinatura de mudanças ---------------------------------------------

  assinar(ouvinte: () => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  notificar(): void {
    for (const o of this.ouvintes) o();
  }

  // --- Leitura --------------------------------------------------------------

  listarModelos(): Promise<ModeloFvs[]> {
    return this.db.getAll('modelos');
  }

  obterModelo(id: string): Promise<ModeloFvs | undefined> {
    return this.db.get('modelos', id);
  }

  listarInspecoes(): Promise<InspecaoFvs[]> {
    return this.db.getAll('inspecoes');
  }

  obterInspecao(id: string): Promise<InspecaoFvs | undefined> {
    return this.db.get('inspecoes', id);
  }

  listarNcs(): Promise<NaoConformidade[]> {
    return this.db.getAll('ncs');
  }

  ncsDaInspecao(inspecaoId: string): Promise<NaoConformidade[]> {
    return this.db.getAllFromIndex('ncs', 'porInspecao', inspecaoId);
  }

  obterFoto(id: string): Promise<FotoLocal | undefined> {
    return this.db.get('fotos', id);
  }

  /** Fotos guardadas neste aparelho para a inspeção (usadas no PDF). */
  fotosDaInspecao(inspecaoId: string): Promise<FotoLocal[]> {
    return this.db.getAllFromIndex('fotos', 'porInspecao', inspecaoId);
  }

  async pendentes(): Promise<EntradaOutbox[]> {
    return this.db.getAll('outbox');
  }

  // --- Escrita --------------------------------------------------------------

  async salvarModelo(modelo: ModeloFvs): Promise<void> {
    const tx = this.db.transaction(['modelos', 'outbox'], 'readwrite');
    await Promise.all([
      tx.objectStore('modelos').put(modelo),
      enfileirar(tx.objectStore('outbox'), 'modelo', modelo.id),
      tx.done,
    ]);
    this.depoisDeEscrever();
  }

  async salvarInspecao(inspecao: InspecaoFvs): Promise<void> {
    const tx = this.db.transaction(['inspecoes', 'outbox'], 'readwrite');
    await Promise.all([
      tx.objectStore('inspecoes').put(inspecao),
      enfileirar(tx.objectStore('outbox'), 'inspecao', inspecao.id),
      tx.done,
    ]);
    this.depoisDeEscrever();
  }

  /** Grava a inspeção e as NCs dela juntas (conclusão de inspeção). */
  async salvarInspecaoComNcs(inspecao: InspecaoFvs, ncs: NaoConformidade[]): Promise<void> {
    const tx = this.db.transaction(['inspecoes', 'ncs', 'outbox'], 'readwrite');
    const outbox = tx.objectStore('outbox');
    await Promise.all([
      tx.objectStore('inspecoes').put(inspecao),
      enfileirar(outbox, 'inspecao', inspecao.id),
      ...ncs.flatMap((nc) => [tx.objectStore('ncs').put(nc), enfileirar(outbox, 'nc', nc.id)]),
      tx.done,
    ]);
    this.depoisDeEscrever();
  }

  async salvarNc(nc: NaoConformidade): Promise<void> {
    const tx = this.db.transaction(['ncs', 'outbox'], 'readwrite');
    await Promise.all([
      tx.objectStore('ncs').put(nc),
      enfileirar(tx.objectStore('outbox'), 'nc', nc.id),
      tx.done,
    ]);
    this.depoisDeEscrever();
  }

  /**
   * Anexa uma foto a um item. O Blob fica no aparelho e sobe na sincronização;
   * a inspeção já recebe o caminho definitivo no bucket.
   */
  async adicionarFoto(
    inspecao: InspecaoFvs,
    itemId: string,
    blob: Blob,
    fotoId: string,
    agora: string,
  ): Promise<InspecaoFvs> {
    const storagePath = caminhoFoto(inspecao.id, fotoId);
    const atualizada: InspecaoFvs = {
      ...inspecao,
      fotos: [...inspecao.fotos, { id: fotoId, itemId, storagePath, criadaEm: agora }],
      atualizadoEm: agora,
    };
    const tx = this.db.transaction(['inspecoes', 'fotos', 'outbox'], 'readwrite');
    const outbox = tx.objectStore('outbox');
    await Promise.all([
      tx.objectStore('fotos').put({
        id: fotoId,
        inspecaoId: inspecao.id,
        itemId,
        storagePath,
        blob,
        enviada: false,
      }),
      enfileirar(outbox, 'foto', fotoId),
      tx.objectStore('inspecoes').put(atualizada),
      enfileirar(outbox, 'inspecao', inspecao.id),
      tx.done,
    ]);
    this.depoisDeEscrever();
    return atualizada;
  }

  /** Remove uma foto ainda não enviada (enviadas são evidência e ficam). */
  async removerFoto(inspecao: InspecaoFvs, fotoId: string, agora: string): Promise<InspecaoFvs> {
    const foto = await this.db.get('fotos', fotoId);
    if (foto?.enviada) throw new Error('Foto já sincronizada não pode ser removida.');
    const atualizada: InspecaoFvs = {
      ...inspecao,
      fotos: inspecao.fotos.filter((f) => f.id !== fotoId),
      atualizadoEm: agora,
    };
    const tx = this.db.transaction(['inspecoes', 'fotos', 'outbox'], 'readwrite');
    const outbox = tx.objectStore('outbox');
    await Promise.all([
      tx.objectStore('fotos').delete(fotoId),
      outbox.delete(`foto:${fotoId}`),
      tx.objectStore('inspecoes').put(atualizada),
      enfileirar(outbox, 'inspecao', inspecao.id),
      tx.done,
    ]);
    this.depoisDeEscrever();
    return atualizada;
  }

  private depoisDeEscrever(): void {
    this.notificar();
    this.aoEscrever();
  }
}

type OutboxStore = {
  get(chave: string): Promise<EntradaOutbox | undefined>;
  put(valor: EntradaOutbox): Promise<string>;
};

async function enfileirar(store: OutboxStore, tipo: TipoRegistro, id: string): Promise<void> {
  const chave = `${tipo}:${id}`;
  const atual = await store.get(chave);
  await store.put({
    chave,
    tipo,
    id,
    revisao: (atual?.revisao ?? 0) + 1,
    enfileiradoEm: atual?.enfileiradoEm ?? new Date().toISOString(),
    tentativas: 0,
    ultimoErro: null,
  });
}
