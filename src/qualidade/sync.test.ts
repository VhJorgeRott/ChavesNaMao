import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type ModeloFvs,
  concluirInspecao,
  criarInspecao,
  marcarRestantesConformes,
} from '@chaves/domain/qualidade';
import { abrirBanco, fecharBancos } from './db';
import type { TabelaQualidade } from './mapeamento';
import { RepositorioQualidade } from './repositorio';
import { ErroDeRede, type RemotoQualidade, sincronizar } from './sync';

/** Servidor em memória que imita upsert + updated_at + guarda de última escrita. */
class RemotoFake implements RemotoQualidade {
  tabelas: Record<TabelaQualidade, Map<string, Record<string, unknown>>> = {
    fvs_modelos: new Map(),
    fvs_inspecoes: new Map(),
    fvs_nao_conformidades: new Map(),
  };
  fotos = new Map<string, number>();
  offline = false;
  relogio = 0;
  upserts: string[] = [];

  private carimbo(): string {
    this.relogio += 1;
    return new Date(Date.UTC(2026, 8, 17, 12, 0, this.relogio)).toISOString();
  }

  async upsert(tabela: TabelaQualidade, row: object): Promise<void> {
    if (this.offline) throw new ErroDeRede('offline');
    const r = row as Record<string, unknown> & { id: string; cliente_atualizado_em: string };
    const atual = this.tabelas[tabela].get(r.id);
    this.upserts.push(`${tabela}:${r.id}`);
    if (atual && String(atual.cliente_atualizado_em) > r.cliente_atualizado_em) return;
    this.tabelas[tabela].set(r.id, { ...r, updated_at: this.carimbo() });
  }

  async enviarFoto(caminho: string, blob: Blob): Promise<void> {
    if (this.offline) throw new ErroDeRede('offline');
    this.fotos.set(caminho, blob.size);
  }

  async mudancasDesde(tabela: TabelaQualidade, cursor: string | null, limite: number) {
    if (this.offline) throw new ErroDeRede('offline');
    return [...this.tabelas[tabela].values()]
      .filter((r) => !cursor || String(r.updated_at) >= cursor)
      .sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))
      .slice(0, limite);
  }
}

let seq = 0;
const novoId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

const modelo: ModeloFvs = {
  id: novoId(),
  codigo: 'FVS-01',
  nome: 'Alvenaria',
  servico: 'Alvenaria',
  descricao: null,
  versao: 1,
  ativo: true,
  atualizadoEm: '2026-09-17T10:00:00.000Z',
  estrutura: {
    secoes: [
      {
        id: 's1',
        titulo: 'Execução',
        itens: [
          { id: 'i1', texto: 'Prumo', criterio: null, metodo: null, fotoObrigatoriaNc: false },
          { id: 'i2', texto: 'Nível', criterio: null, metodo: null, fotoObrigatoriaNc: false },
        ],
      },
    ],
  },
};

const local = {
  empreendimentoRef: '25',
  empreendimentoNome: 'Porto Horizonte',
  codigo: null,
  bloco: null,
  unidadeRef: null,
  unidadeNome: null,
  detalhe: 'Térreo',
};

async function novoRepo(nome: string) {
  const db = await abrirBanco(`${nome}-${novoId()}`);
  return new RepositorioQualidade(db);
}

afterEach(() => fecharBancos());

describe('sincronização da qualidade', () => {
  it('envia pais antes dos filhos e esvazia a fila', async () => {
    const repo = await novoRepo('ordem');
    const remoto = new RemotoFake();
    const agora = '2026-09-17T11:00:00.000Z';

    let insp = criarInspecao(modelo, { local }, { id: 'u1', nome: 'Ana' }, agora, novoId);
    insp = marcarRestantesConformes(insp, agora);
    insp.respostas.i2 = { itemId: 'i2', resultado: 'NC', observacao: 'torto', respondidoEm: agora };
    const { inspecao, novasNcs } = concluirInspecao(insp, [], agora, novoId);

    // Gravado na ordem "errada" de propósito: NC e inspeção antes do modelo.
    await repo.salvarInspecaoComNcs(inspecao, novasNcs);
    await repo.salvarModelo(modelo);

    const r = await sincronizar(repo.db, remoto);
    expect(r).toMatchObject({ enviados: 3, comErro: 0 });
    expect(remoto.upserts.map((u) => u.split(':')[0])).toEqual([
      'fvs_modelos',
      'fvs_inspecoes',
      'fvs_nao_conformidades',
    ]);
    expect(await repo.pendentes()).toEqual([]);
    expect(remoto.tabelas.fvs_nao_conformidades.get(novasNcs[0]!.id)).toMatchObject({
      item_id: 'i2',
      status: 'aberta',
      empreendimento_ref: '25',
    });
  });

  it('várias edições offline viram um único envio com o estado final', async () => {
    const repo = await novoRepo('coalesce');
    const remoto = new RemotoFake();
    await repo.salvarModelo(modelo);
    await repo.salvarModelo({
      ...modelo,
      nome: 'Alvenaria v2',
      atualizadoEm: '2026-09-17T10:01:00.000Z',
    });
    await repo.salvarModelo({
      ...modelo,
      nome: 'Alvenaria v3',
      atualizadoEm: '2026-09-17T10:02:00.000Z',
    });

    await sincronizar(repo.db, remoto);
    expect(remoto.upserts).toHaveLength(1);
    expect(remoto.tabelas.fvs_modelos.get(modelo.id)?.nome).toBe('Alvenaria v3');
  });

  it('sem rede mantém as pendências para a próxima tentativa', async () => {
    const repo = await novoRepo('offline');
    const remoto = new RemotoFake();
    remoto.offline = true;
    await repo.salvarModelo(modelo);

    await expect(sincronizar(repo.db, remoto)).rejects.toBeInstanceOf(ErroDeRede);
    expect(await repo.pendentes()).toHaveLength(1);

    remoto.offline = false;
    await sincronizar(repo.db, remoto);
    expect(await repo.pendentes()).toHaveLength(0);
  });

  it('erro de dado registra a falha e não trava as demais pendências', async () => {
    const repo = await novoRepo('erro');
    const remoto = new RemotoFake();
    const upsertOriginal = remoto.upsert.bind(remoto);
    remoto.upsert = async (tabela, row) => {
      if (tabela === 'fvs_modelos') throw new Error('new row violates row-level security policy');
      return upsertOriginal(tabela, row);
    };
    const agora = '2026-09-17T11:00:00.000Z';
    await repo.salvarModelo(modelo);
    await repo.salvarInspecao(
      criarInspecao(modelo, { local }, { id: 'u1', nome: 'Ana' }, agora, novoId),
    );

    const r = await sincronizar(repo.db, remoto);
    expect(r.comErro).toBe(1);
    expect(r.enviados).toBe(1);
    const [pendente] = await repo.pendentes();
    expect(pendente).toMatchObject({ tipo: 'modelo', tentativas: 1 });
    expect(pendente?.ultimoErro).toMatch(/row-level security/);
  });

  it('recebe o que outro dispositivo enviou, sem sobrescrever edição local pendente', async () => {
    const remoto = new RemotoFake();
    const aparelhoA = await novoRepo('A');
    const aparelhoB = await novoRepo('B');

    await aparelhoA.salvarModelo(modelo);
    await sincronizar(aparelhoA.db, remoto);

    // B recebe o modelo.
    await sincronizar(aparelhoB.db, remoto);
    expect((await aparelhoB.obterModelo(modelo.id))?.nome).toBe('Alvenaria');

    // A renomeia e envia; B editou offline (mais tarde) e ainda não enviou.
    await aparelhoA.salvarModelo({
      ...modelo,
      nome: 'Nome do A',
      atualizadoEm: '2026-09-17T10:05:00.000Z',
    });
    await sincronizar(aparelhoA.db, remoto);
    await aparelhoB.salvarModelo({
      ...modelo,
      nome: 'Nome do B',
      atualizadoEm: '2026-09-17T10:09:00.000Z',
    });

    // Na sincronização de B: envia primeiro (vence por ser mais recente) e não é
    // sobrescrito pelo recebimento.
    await sincronizar(aparelhoB.db, remoto);
    expect((await aparelhoB.obterModelo(modelo.id))?.nome).toBe('Nome do B');
    expect(remoto.tabelas.fvs_modelos.get(modelo.id)?.nome).toBe('Nome do B');

    // A recebe a versão de B.
    await sincronizar(aparelhoA.db, remoto);
    expect((await aparelhoA.obterModelo(modelo.id))?.nome).toBe('Nome do B');
  });

  it('escrita atrasada (mais antiga) não vence a do servidor', async () => {
    const remoto = new RemotoFake();
    const aparelhoA = await novoRepo('A2');
    const aparelhoB = await novoRepo('B2');
    await aparelhoA.salvarModelo({
      ...modelo,
      nome: 'Recente',
      atualizadoEm: '2026-09-17T10:30:00.000Z',
    });
    await sincronizar(aparelhoA.db, remoto);

    await aparelhoB.salvarModelo({
      ...modelo,
      nome: 'Antigo',
      atualizadoEm: '2026-09-17T10:10:00.000Z',
    });
    await sincronizar(aparelhoB.db, remoto);

    expect(remoto.tabelas.fvs_modelos.get(modelo.id)?.nome).toBe('Recente');
  });
});
