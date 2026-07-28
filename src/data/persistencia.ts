/**
 * Persistência do checkpoint da entrega no Supabase.
 *
 * O store do app é em memória (ver DataProvider): sem isto, iniciar uma entrega
 * e recarregar a página perdia o progresso. Aqui gravamos o subgrafo da entrega
 * (empreendimento → unidade → cliente → entrega → documentos/itens) e o lemos de
 * volta no boot, de modo que uma entrega em andamento sobreviva ao refresh e
 * apareça para qualquer pessoa da equipe, em qualquer dispositivo.
 *
 * Escrita direta do navegador (anon key + sessão do usuário), não Edge Function:
 * a RLS já concede select/insert/update dessas tabelas operacionais a quem tem
 * papel interno (`is_equipe()`), que é exatamente o alcance necessário. O que é
 * sensível — tokens de assinatura e audit_log — continua exclusivo do
 * service_role.
 *
 * Chaveamento por `external_ref`: os ids do app vêm do CV/Mega (ou são
 * sintéticos, `ent-1a2b`) e não são uuid. O upsert por external_ref é idempotente
 * — salvar o mesmo checkpoint duas vezes não duplica linhas.
 *
 * Em modo dev/mock (sem Supabase configurado) tudo aqui é no-op silencioso.
 */
import { getSupabase } from '@/lib/supabase';
import { isAuthConfigured } from '@/auth/authConfig';
import type {
  Assinatura,
  Cliente,
  Documento,
  Empreendimento,
  Entrega,
  EntregaStatus,
  ItemEntrega,
  MetodoAssinatura,
  ModeloTermo,
  Unidade,
  UnidadeStatus,
} from '@chaves/domain/types';

/** Subgrafo de uma entrega, no vocabulário do domínio (ids = external_ref). */
export interface CheckpointEntregas {
  empreendimentos: Empreendimento[];
  unidades: Unidade[];
  clientes: Cliente[];
  entregas: Entrega[];
  documentos: Documento[];
  itens: ItemEntrega[];
  assinaturas: Assinatura[];
}

/** Dados que o DataProvider envia para gravar uma entrega. */
export interface EntregaParaSalvar {
  entrega: Entrega;
  unidade: Unidade;
  empreendimento: Empreendimento;
  cliente: Cliente;
  documentos: Documento[];
  itens: ItemEntrega[];
  assinaturas: Assinatura[];
  /** `auth.users.id` do responsável — FK obrigatória em `entregas`. */
  responsavelUid: string;
}

export const persistenciaAtiva: boolean = isAuthConfigured;

const CHECKPOINT_VAZIO: CheckpointEntregas = {
  empreendimentos: [],
  unidades: [],
  clientes: [],
  entregas: [],
  documentos: [],
  itens: [],
  assinaturas: [],
};

// --- Leitura ---------------------------------------------------------------

/** Linha de `entregas` com o grafo aninhado que o select abaixo devolve. */
interface EntregaRow {
  id: string;
  external_ref: string | null;
  status: EntregaStatus;
  responsavel_id: string;
  iniciada_em: string | null;
  concluida_em: string | null;
  created_at: string;
  unidades: {
    external_ref: string | null;
    identificacao: string;
    status: UnidadeStatus;
    area_m2: number | string | null;
    created_at: string;
    empreendimentos: {
      external_ref: string | null;
      nome: string;
      cidade: string;
      uf: string;
      created_at: string;
    } | null;
  } | null;
  clientes: {
    external_ref: string | null;
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    created_at: string;
  } | null;
  documentos: {
    id: string;
    external_ref: string | null;
    tipo: string;
    storage_path: string;
    sha256_hash: string;
    gerado_em: string;
  }[];
  itens_entrega: {
    id: string;
    external_ref: string | null;
    descricao: string;
    quantidade: number;
  }[];
  assinaturas: {
    id: string;
    external_ref: string | null;
    documento_id: string;
    canvas_png_path: string | null;
    metodo: MetodoAssinatura;
    ip: string | null;
    user_agent: string | null;
    geo: { lat: number; lng: number } | null;
    assinada_em: string | null;
    clicksign_doc_key: string | null;
    clicksign_status: string | null;
  }[];
}

const SELECT_ENTREGA = `
  id, external_ref, status, responsavel_id, iniciada_em, concluida_em, created_at,
  unidades!inner (
    external_ref, identificacao, status, area_m2, created_at,
    empreendimentos!inner ( external_ref, nome, cidade, uf, created_at )
  ),
  clientes!inner ( external_ref, nome, cpf, email, telefone, created_at ),
  documentos ( id, external_ref, tipo, storage_path, sha256_hash, gerado_em ),
  itens_entrega ( id, external_ref, descricao, quantidade ),
  assinaturas (
    id, external_ref, documento_id, canvas_png_path, metodo, ip, user_agent, geo,
    assinada_em, clicksign_doc_key, clicksign_status
  )
`;

/**
 * Carrega as entregas gravadas e as devolve no vocabulário do domínio.
 * Nunca lança: uma falha de rede/RLS degrada para "sem checkpoint", e o app
 * segue com os dados em memória.
 */
export async function carregarCheckpoints(): Promise<CheckpointEntregas> {
  if (!persistenciaAtiva) return CHECKPOINT_VAZIO;
  try {
    const { data, error } = await getSupabase()
      .from('entregas')
      .select(SELECT_ENTREGA)
      .order('created_at', { ascending: true });
    if (error) throw erroPostgrest('leitura das entregas salvas', error);

    const acc: CheckpointEntregas = {
      empreendimentos: [],
      unidades: [],
      clientes: [],
      entregas: [],
      documentos: [],
      itens: [],
      assinaturas: [],
    };
    // De-duplica por id: várias entregas compartilham unidade/empreendimento.
    const vistos = { emp: new Set<string>(), uni: new Set<string>(), cli: new Set<string>() };

    for (const row of (data ?? []) as unknown as EntregaRow[]) {
      const uniRow = row.unidades;
      const empRow = uniRow?.empreendimentos;
      const cliRow = row.clientes;
      // Sem external_ref não conseguimos casar a linha com o id em memória —
      // é linha legada (anterior a esta feature); ignoramos em vez de inventar.
      const entregaId = row.external_ref;
      const unidadeId = uniRow?.external_ref;
      const empreendimentoId = empRow?.external_ref;
      const clienteId = cliRow?.external_ref;
      if (!entregaId || !unidadeId || !empreendimentoId || !clienteId || !uniRow || !empRow || !cliRow) {
        continue;
      }

      if (!vistos.emp.has(empreendimentoId)) {
        vistos.emp.add(empreendimentoId);
        acc.empreendimentos.push({
          id: empreendimentoId,
          nome: empRow.nome,
          cidade: empRow.cidade,
          uf: empRow.uf,
          createdAt: empRow.created_at,
        });
      }
      if (!vistos.uni.has(unidadeId)) {
        vistos.uni.add(unidadeId);
        acc.unidades.push({
          id: unidadeId,
          empreendimentoId,
          identificacao: uniRow.identificacao,
          status: uniRow.status,
          areaM2: uniRow.area_m2 == null ? null : Number(uniRow.area_m2),
          createdAt: uniRow.created_at,
        });
      }
      if (!vistos.cli.has(clienteId)) {
        vistos.cli.add(clienteId);
        acc.clientes.push({
          id: clienteId,
          nome: cliRow.nome,
          cpf: cliRow.cpf,
          email: cliRow.email,
          telefone: cliRow.telefone,
          createdAt: cliRow.created_at,
        });
      }

      acc.entregas.push({
        id: entregaId,
        unidadeId,
        clienteId,
        status: row.status,
        responsavelId: row.responsavel_id,
        iniciadaEm: row.iniciada_em,
        concluidaEm: row.concluida_em,
        createdAt: row.created_at,
      });
      for (const d of row.documentos) {
        acc.documentos.push({
          id: d.external_ref ?? d.id,
          entregaId,
          tipo: d.tipo,
          storagePath: d.storage_path,
          sha256Hash: d.sha256_hash,
          geradoEm: d.gerado_em,
        });
      }
      for (const i of row.itens_entrega) {
        acc.itens.push({
          id: i.external_ref ?? i.id,
          entregaId,
          descricao: i.descricao,
          quantidade: i.quantidade,
        });
      }
      // `documento_id` é o uuid da linha; no domínio o vínculo é pelo id do app.
      const docPorUuid = new Map(row.documentos.map((d) => [d.id, d.external_ref ?? d.id]));
      for (const a of row.assinaturas) {
        acc.assinaturas.push({
          id: a.external_ref ?? a.id,
          entregaId,
          documentoId: docPorUuid.get(a.documento_id) ?? a.documento_id,
          canvasPngPath: a.canvas_png_path,
          metodo: a.metodo,
          ip: a.ip,
          userAgent: a.user_agent,
          geo: a.geo,
          assinadaEm: a.assinada_em,
          clicksignDocKey: a.clicksign_doc_key,
          clicksignStatus: a.clicksign_status,
        });
      }
    }
    return acc;
  } catch (e) {
    console.warn('[persistencia] falha ao carregar entregas salvas:', e);
    return CHECKPOINT_VAZIO;
  }
}

// --- Escrita ---------------------------------------------------------------

/** `entregas.responsavel_id` é FK para `auth.users` — ids de demo não servem. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Última ocorrência de cada id vence — a mais recente é a que queremos gravar. */
function unicosPorId<T extends { id: string }>(itens: T[]): T[] {
  return [...new Map(itens.map((i) => [i.id, i])).values()];
}

/**
 * Erro do PostgREST no formato em que ele é útil.
 *
 * O objeto que o supabase-js devolve traz `code`, `details` e `hint` — é ali que
 * está a causa real (violação de constraint, trigger, RLS). Jogado num
 * `console.warn` ou num toast, porém, ele vira "[object Object]" ou some, e
 * sobra só o "500" cru do Network. Achatamos tudo numa mensagem única para que a
 * causa apareça onde quer que o erro seja mostrado.
 */
function erroPostgrest(contexto: string, error: unknown): Error {
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  const partes = [
    e?.code ? `[${e.code}]` : null,
    e?.message ?? null,
    e?.details ? `detalhes: ${e.details}` : null,
    e?.hint ? `dica: ${e.hint}` : null,
  ].filter(Boolean);
  const msg = partes.length > 0 ? partes.join(' · ') : String(error);
  const err = new Error(`${contexto}: ${msg}`);
  // Preserva o objeto original para quem quiser inspecionar no console.
  (err as Error & { causa?: unknown }).causa = error;
  return err;
}

/**
 * Grava (upsert) o checkpoint da entrega. Lança em caso de falha — quem chama
 * decide se avisa o usuário; o DataProvider trata como erro visível, porque
 * "salvou" precisa significar salvou.
 */
export async function salvarEntrega(dados: EntregaParaSalvar): Promise<void> {
  if (!persistenciaAtiva) return;
  if (!UUID_RE.test(dados.responsavelUid)) return;
  const sb = getSupabase();

  const { data: emp, error: empErr } = await sb
    .from('empreendimentos')
    .upsert(
      {
        external_ref: dados.empreendimento.id,
        nome: dados.empreendimento.nome,
        cidade: dados.empreendimento.cidade,
        uf: (dados.empreendimento.uf || 'PR').slice(0, 2),
      },
      { onConflict: 'external_ref' },
    )
    .select('id')
    .single();
  if (empErr) throw erroPostgrest('upsert de empreendimentos', empErr);

  // area_m2 aceita null desde 20240101000006, mas o check exige > 0 quando há valor.
  const area = dados.unidade.areaM2 != null && dados.unidade.areaM2 > 0 ? dados.unidade.areaM2 : null;
  const { data: uni, error: uniErr } = await sb
    .from('unidades')
    .upsert(
      {
        external_ref: dados.unidade.id,
        empreendimento_id: emp.id,
        identificacao: dados.unidade.identificacao,
        status: dados.unidade.status,
        area_m2: area,
      },
      { onConflict: 'external_ref' },
    )
    .select('id')
    .single();
  if (uniErr) throw erroPostgrest('upsert de unidades', uniErr);

  // CPF: a coluna aceita vazio (o CRM nem sempre devolve), mas só dígitos.
  const cpf = dados.cliente.cpf.replace(/\D/g, '');
  const { data: cli, error: cliErr } = await sb
    .from('clientes')
    .upsert(
      {
        external_ref: dados.cliente.id,
        nome: dados.cliente.nome,
        cpf: cpf.length === 11 ? cpf : '',
        email: dados.cliente.email,
        telefone: dados.cliente.telefone,
      },
      { onConflict: 'external_ref' },
    )
    .select('id')
    .single();
  if (cliErr) throw erroPostgrest('upsert de clientes', cliErr);

  const { data: ent, error: entErr } = await sb
    .from('entregas')
    .upsert(
      {
        external_ref: dados.entrega.id,
        unidade_id: uni.id,
        cliente_id: cli.id,
        responsavel_id: dados.responsavelUid,
        status: dados.entrega.status,
        iniciada_em: dados.entrega.iniciadaEm,
        concluida_em: dados.entrega.concluidaEm,
      },
      { onConflict: 'external_ref' },
    )
    .select('id')
    .single();
  if (entErr) throw erroPostgrest('upsert de entregas', entErr);

  // Um `external_ref` repetido no mesmo lote faz o Postgres recusar o upsert
  // inteiro com 21000 ("cannot affect row a second time"). Deduplicar aqui, e
  // não só em quem chama, mantém a garantia válida para todo call site.
  const documentos = unicosPorId(dados.documentos);
  // O uuid de cada documento é necessário logo abaixo: `assinaturas.documento_id`
  // é FK obrigatória, e o domínio só conhece o id do app (external_ref).
  const uuidPorDocumento = new Map<string, string>();
  if (documentos.length > 0) {
    const { data, error } = await sb
      .from('documentos')
      .upsert(
        documentos.map((d) => ({
          external_ref: d.id,
          entrega_id: ent.id,
          tipo: d.tipo,
          storage_path: d.storagePath,
          sha256_hash: d.sha256Hash,
          gerado_em: d.geradoEm,
        })),
        { onConflict: 'external_ref' },
      )
      .select('id, external_ref');
    if (error) throw erroPostgrest('upsert de documentos', error);
    for (const linha of (data ?? []) as { id: string; external_ref: string | null }[]) {
      if (linha.external_ref) uuidPorDocumento.set(linha.external_ref, linha.id);
    }
  }

  const itens = unicosPorId(dados.itens);
  if (itens.length > 0) {
    const { error } = await sb.from('itens_entrega').upsert(
      itens.map((i) => ({
        external_ref: i.id,
        entrega_id: ent.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
      })),
      { onConflict: 'external_ref' },
    );
    if (error) throw erroPostgrest('upsert de itens da entrega', error);
  }

  // Assinaturas: o que prova que a confissão foi assinada e que a chave foi
  // recebida. Sem gravar, um refresh reabriria etapas já vencidas.
  const assinaturas = unicosPorId(dados.assinaturas).filter((a) =>
    uuidPorDocumento.has(a.documentoId),
  );
  if (assinaturas.length > 0) {
    const { error } = await sb.from('assinaturas').upsert(
      assinaturas.map((a) => ({
        external_ref: a.id,
        entrega_id: ent.id,
        documento_id: uuidPorDocumento.get(a.documentoId)!,
        canvas_png_path: a.canvasPngPath,
        metodo: a.metodo,
        ip: a.ip,
        user_agent: a.userAgent,
        geo: a.geo,
        assinada_em: a.assinadaEm,
        clicksign_doc_key: a.clicksignDocKey,
        clicksign_status: a.clicksignStatus,
      })),
      { onConflict: 'external_ref' },
    );
    if (error) throw erroPostgrest('upsert de assinaturas', error);
  }
}

// --- Modelos de termo ------------------------------------------------------
// Ficam fora do checkpoint de entrega: são catálogo, não operação. É o texto que
// o cliente assina, então a fonte é o servidor — a Edge Function que gera o PDF
// lê daqui, não do navegador de quem clicou.

interface ModeloRow {
  id: string;
  external_ref: string | null;
  nome: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

/** Modelos gravados. Nunca lança: sem servidor, o app segue com os do seed. */
export async function carregarModelos(): Promise<ModeloTermo[]> {
  if (!persistenciaAtiva) return [];
  try {
    const { data, error } = await getSupabase()
      .from('modelos')
      .select('id, external_ref, nome, conteudo, created_at, updated_at')
      .order('created_at', { ascending: true });
    if (error) throw erroPostgrest('leitura dos modelos', error);
    return ((data ?? []) as ModeloRow[]).map((m) => ({
      id: m.external_ref ?? m.id,
      nome: m.nome,
      conteudo: m.conteudo,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));
  } catch (e) {
    console.warn('[persistencia] falha ao carregar modelos:', e);
    return [];
  }
}

/** Grava (upsert) um modelo. Lança em falha — "salvou" precisa significar salvou. */
export async function salvarModelo(modelo: ModeloTermo): Promise<void> {
  if (!persistenciaAtiva) return;
  const { error } = await getSupabase().from('modelos').upsert(
    {
      external_ref: modelo.id,
      nome: modelo.nome,
      conteudo: modelo.conteudo,
    },
    { onConflict: 'external_ref' },
  );
  if (error) throw erroPostgrest('upsert de modelo', error);
}

/** Remove um item da entrega também no servidor (senão ele volta no refresh). */
export async function removerItemPersistido(itemId: string): Promise<void> {
  if (!persistenciaAtiva) return;
  const { error } = await getSupabase().from('itens_entrega').delete().eq('external_ref', itemId);
  if (error) throw erroPostgrest('remoção de item da entrega', error);
}
