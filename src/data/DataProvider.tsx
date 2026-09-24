import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { adapters } from '@/adapters';
import { AdapterError } from '@/adapters/errors';
import type { UnidadeErp } from '@/adapters/types';
import { transicionar } from '@chaves/domain/state-machine';
import { listarPendencias, verificarSignatario } from '@chaves/domain/signatario';
import {
  type Assinatura,
  type Cliente,
  type Documento,
  type Empreendimento,
  type Entrega,
  type EntregaStatus,
  type ItemEntrega,
  type ModeloTermo,
  TIPO_DOCUMENTO,
  type Unidade,
} from '@chaves/domain/types';
import type { PortalAssinarResult, PortalResolveResult, PortalSnapshot } from '@/adapters/types';
import { hashToken } from '@/lib/token';
import { logAtividade } from '@/lib/atividade';
import { createInitialState, type DbState } from './seed';
import { getEntregaDetalhe } from './selectors';
import { gravarCatalogo, lerCatalogo } from './cache';
import { mesclarCatalogo } from './catalogo-unidades';
import {
  carregarCheckpoints,
  carregarModelos,
  persistenciaAtiva,
  removerItemPersistido,
  salvarEntrega,
  salvarModelo,
} from './persistencia';

/**
 * Id de uma entidade criada no app.
 *
 * Precisa ser único ENTRE SESSÕES, não só dentro de uma: este id vira o
 * `external_ref` no Supabase, que é a chave do upsert. Um contador em memória
 * reinicia a cada carga da página, então a primeira entrega de hoje nasceria com
 * o mesmo id da primeira entrega de ontem — e o upsert sobrescreveria a linha
 * anterior em vez de criar uma nova, misturando duas entregas diferentes.
 */
function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * Monta o snapshot da entrega para o portal (envio ao adapter). As `externalRef`
 * são os ids atuais em memória (CV/Mega/mock) — o servidor faz upsert por elas.
 * Retorna `null` se faltar unidade/empreendimento/cliente para o portal exibir.
 */
function montarSnapshot(state: DbState, entregaId: string): PortalSnapshot | null {
  const det = getEntregaDetalhe(state, entregaId);
  if (!det || !det.unidade || !det.empreendimento || !det.cliente) return null;
  const { entrega, unidade, empreendimento, cliente } = det;
  return {
    entrega: { externalRef: entrega.id, status: entrega.status },
    empreendimento: {
      externalRef: empreendimento.id,
      nome: empreendimento.nome,
      cidade: empreendimento.cidade,
      uf: empreendimento.uf,
    },
    unidade: {
      externalRef: unidade.id,
      identificacao: unidade.identificacao,
      areaM2: unidade.areaM2,
      status: unidade.status,
    },
    cliente: {
      externalRef: cliente.id,
      nome: cliente.nome,
      cpf: cliente.cpf,
      email: cliente.email,
      telefone: cliente.telefone,
    },
  };
}

export interface DataActions {
  iniciarEntrega(unidadeId: string, responsavelId: string): Promise<string>;
  /**
   * Fluxo "enviar termo" para uma unidade: inicia a entrega (ou reaproveita a
   * ativa), gera o termo e o link de assinatura, avançando até CONFISSAO e
   * notificando o cliente. Base da ação em massa.
   *
   * ATENÇÃO: o documento e o link que esta ação envia foram desenhados para o
   * fluxo antigo, de assinatura única (termo de entrega + canvas no portal). Com
   * a confissão de dívida virando etapa própria, ela para no lugar certo do
   * fluxo, mas o que vai ao cliente ainda é o termo de entrega — não a confissão.
   * Alinhar isso depende de definir o que o disparo em massa deve enviar.
   */
  enviarTermoEntrega(unidadeId: string, responsavelId: string): Promise<string>;
  sincronizarUnidades(empreendimentoId: string, unidades: Unidade[]): void;
  /** Persiste (upsert) empreendimentos carregados do CRM para as telas resolverem pelo id. */
  sincronizarEmpreendimentos(empreendimentos: Empreendimento[]): void;
  /**
   * Lista de empreendimentos, servida do cache local enquanto recente. Use no
   * lugar de chamar `adapters.crm.getEmpreendimentos()` direto na tela.
   */
  garantirEmpreendimentos(opts?: { forcar?: boolean }): Promise<Empreendimento[]>;
  /**
   * Catálogo completo de unidades do empreendimento (todas as do CV, com
   * contrato/cliente do Mega nas vendidas), servido do cache
   * enquanto recente. Chamadas concorrentes para o mesmo empreendimento
   * compartilham uma única ida à rede.
   */
  garantirUnidades(
    empreendimento: Empreendimento,
    opts?: { forcar?: boolean },
  ): Promise<{ aviso?: string }>;
  /**
   * Puxa os dados de contato do cliente no CRM para uma entrega já existente.
   * Roda automaticamente ao abrir a tela de detalhe (não há mais etapa manual
   * de integração). Idempotente: sempre reflete o que o CRM devolve agora.
   */
  sincronizarDadosEntrega(entregaId: string): Promise<void>;
  avancarEtapa(entregaId: string, proximo: EntregaStatus, actorId: string): Promise<void>;
  /** Gera os termos que faltam para a entrega e devolve os recém-criados. */
  gerarDocumento(entregaId: string, actorId: string): Promise<Documento[]>;
  gerarLinkAssinatura(entregaId: string, actorId: string): Promise<{ token: string; url: string }>;
  /**
   * Envia a Confissão de Dívida para assinatura remota (Clicksign). Devolve a
   * URL de assinatura quando o provedor a fornece. Em `live` o adapter ainda é
   * stub e lança — daí a confirmação manual como alternativa.
   */
  enviarConfissaoParaAssinatura(
    entregaId: string,
    actorId: string,
  ): Promise<{ signUrl: string | null }>;
  /** Marca a confissão como assinada. `manual` fica registrado na auditoria. */
  confirmarConfissaoAssinada(
    entregaId: string,
    actorId: string,
    opts: { manual: boolean },
  ): Promise<void>;
  /** Assinatura do Recebimento de Chaves colhida no dispositivo de quem atende. */
  registrarAssinaturaPresencial(
    entregaId: string,
    pngDataUrl: string,
    geo: { lat: number; lng: number } | null,
    actorId: string,
  ): Promise<void>;
  adicionarItem(
    entregaId: string,
    descricao: string,
    quantidade: number,
    actorId: string,
  ): Promise<void>;
  removerItem(itemId: string): Promise<void>;
  /**
   * Carrega do Supabase as entregas já gravadas e as funde ao estado. Chamado
   * uma vez, depois da autenticação — é o que faz uma entrega iniciada e não
   * concluída sobreviver ao refresh.
   */
  carregarPersistidos(): Promise<void>;
  /**
   * URL temporária de um arquivo privado da entrega. `alvo` é `'assinatura'` ou
   * o tipo do documento. `null` quando o arquivo ainda não foi gerado.
   */
  urlArquivoEntrega(entregaId: string, alvo: string): Promise<string | null>;
  resolverToken(token: string): Promise<PortalResolveResult>;
  registrarAssinaturaPorToken(
    token: string,
    pngDataUrl: string,
    geo: { lat: number; lng: number } | null,
  ): Promise<PortalAssinarResult>;
  definirPapel(userId: string, papel: 'admin' | 'equipe_entrega', actorId: string): void;
  criarModelo(dados: DadosModelo, actorId: string): Promise<string>;
  atualizarModelo(id: string, dados: DadosModelo, actorId: string): Promise<void>;
  removerModelo(id: string, actorId: string): void;
}

/** Campos editáveis de um modelo de termo. */
export type DadosModelo = Pick<ModeloTermo, 'nome' | 'conteudo' | 'tipo' | 'modalidade'>;

interface DataContextValue {
  state: DbState;
  actions: DataActions;
  /** Entregas e modelos do servidor ainda não chegaram (telas mostram skeleton). */
  carregandoPersistidos: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

/**
 * Idade a partir da qual o catálogo de um empreendimento é considerado velho e
 * revalidado ao abrir a tela. Abaixo disso servimos direto do cache — é o que
 * elimina a espera a cada visita. O prefetch pós-login mantém tudo aquecido.
 */
const TTL_CATALOGO_MS = 2 * 60 * 60 * 1000;

/** Chave reservada em `sincronizadoEm` para a lista de empreendimentos. */
const CHAVE_EMPREENDIMENTOS = '__empreendimentos__';

export function DataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  // O catálogo cacheado entra por cima do seed: ao reabrir o app as unidades já
  // estão lá, e o dashboard conta os números reais sem esperar nenhuma rede.
  const [state, setState] = useState<DbState>(() => {
    const base = createInitialState();
    const cache = lerCatalogo();
    if (cache.empreendimentos.length === 0 && cache.unidades.length === 0) return base;
    const idsEmp = new Set(cache.empreendimentos.map((e) => e.id));
    const idsUni = new Set(cache.unidades.map((u) => u.id));
    return {
      ...base,
      empreendimentos: [
        ...base.empreendimentos.filter((e) => !idsEmp.has(e.id)),
        ...cache.empreendimentos,
      ],
      unidades: [...base.unidades.filter((u) => !idsUni.has(u.id)), ...cache.unidades],
      sincronizadoEm: cache.sincronizadoEm,
    };
  });

  // Referência sempre atual ao estado: as ações assíncronas leem daqui em vez de
  // capturar `state` no closure, evitando dados defasados entre renders.
  const stateRef = useRef(state);
  stateRef.current = state;

  const [carregandoPersistidos, setCarregandoPersistidos] = useState(persistenciaAtiva);

  // Espelha o catálogo no localStorage sempre que ele muda.
  useEffect(() => {
    gravarCatalogo({
      empreendimentos: state.empreendimentos,
      unidades: state.unidades,
      sincronizadoEm: state.sincronizadoEm,
    });
  }, [state.empreendimentos, state.unidades, state.sincronizadoEm]);

  // Buscas de catálogo em voo, por empreendimento. Sem isto, o prefetch pós-login
  // e a tela de unidades disparariam a MESMA consulta ao Mega em paralelo.
  const emVoo = useRef(new Map<string, Promise<void>>());

  const pushAudit = useCallback(
    (
      actor: string,
      action: string,
      entity: string,
      entityId: string | null,
      metadata: Record<string, unknown> = {},
    ) => {
      setState((s) => ({
        ...s,
        auditoria: [
          ...s.auditoria,
          {
            id: nextId('aud'),
            actor,
            action,
            entity,
            entityId,
            metadata,
            at: new Date().toISOString(),
          },
        ],
      }));
      // Persiste no audit_log (Supabase) além da trilha em memória. No-op em
      // dev/mock. O actor persistido é sempre a sessão atual (RLS insert-self).
      void logAtividade({ action, entity, entityId, metadata });
    },
    [],
  );

  /**
   * Grava o checkpoint da entrega no Supabase. As entidades relacionadas são
   * lidas do estado atual, mas quem acabou de criá-las pode passá-las em
   * `extras` — o `setState` que as insere só se reflete em `stateRef` no próximo
   * render, e aqui precisamos delas agora.
   */
  const persistirEntrega = useCallback(
    async (
      entrega: Entrega,
      extras: {
        cliente?: Cliente;
        unidade?: Unidade;
        documentos?: Documento[];
        itens?: ItemEntrega[];
        assinaturas?: Assinatura[];
      } = {},
    ): Promise<void> => {
      if (!persistenciaAtiva) return;
      const s = stateRef.current;
      const unidade = extras.unidade ?? s.unidades.find((u) => u.id === entrega.unidadeId);
      const empreendimento = unidade
        ? s.empreendimentos.find((e) => e.id === unidade.empreendimentoId)
        : undefined;
      const cliente = extras.cliente ?? s.clientes.find((c) => c.id === entrega.clienteId);
      // Sem o grafo completo não há como satisfazer as FKs — não gravamos pela
      // metade. Acontece só se a unidade/empreendimento ainda não foi carregada.
      if (!unidade || !empreendimento || !cliente) {
        console.warn('[persistencia] grafo incompleto, checkpoint não gravado', entrega.id);
        return;
      }
      await salvarEntrega({
        entrega,
        unidade,
        empreendimento,
        cliente,
        documentos: extras.documentos ?? s.documentos.filter((d) => d.entregaId === entrega.id),
        itens: extras.itens ?? s.itens.filter((i) => i.entregaId === entrega.id),
        assinaturas: extras.assinaturas ?? s.assinaturas.filter((a) => a.entregaId === entrega.id),
        responsavelUid: entrega.responsavelId,
      });
    },
    [],
  );

  // Traz do Supabase as entregas já gravadas e as funde ao estado em memória. O
  // que veio do servidor vence: é o checkpoint real, inclusive o de outra pessoa
  // da equipe ou de outra sessão. Chamado uma vez, após a autenticação.
  const carregarPersistidos = useCallback(async (): Promise<void> => {
    if (!persistenciaAtiva) return;
    try {
      // Modelos vêm do servidor e VENCEM os do seed: são o texto que vai à
      // assinatura, e o seed é só um ponto de partida para quem roda sem backend.
      const modelos = await carregarModelos();
      if (modelos.length > 0) setState((s) => ({ ...s, modelos }));

      const ck = await carregarCheckpoints();
      if (ck.entregas.length > 0) {
        setState((s) => {
          const mesclar = <T extends { id: string }>(locais: T[], remotos: T[]): T[] => {
            const ids = new Set(remotos.map((r) => r.id));
            return [...locais.filter((l) => !ids.has(l.id)), ...remotos];
          };
          const entregas = mesclar(s.entregas, ck.entregas);
          return {
            ...s,
            empreendimentos: mesclar(s.empreendimentos, ck.empreendimentos),
            unidades: mesclar(s.unidades, ck.unidades),
            clientes: mesclar(s.clientes, ck.clientes),
            entregas,
            documentos: mesclar(s.documentos, ck.documentos),
            // Itens: o servidor é a verdade para as entregas que ele conhece, senão
            // um item removido em outra sessão ressuscitaria a partir do local.
            itens: [
              ...s.itens.filter((i) => !ck.entregas.some((e) => e.id === i.entregaId)),
              ...ck.itens,
            ],
            // Mesma regra dos itens: para as entregas que o servidor conhece, ele
            // manda. É o que faz a confissão já assinada continuar assinada depois
            // de um refresh, em vez de a etapa reabrir.
            assinaturas: [
              ...s.assinaturas.filter((a) => !ck.entregas.some((e) => e.id === a.entregaId)),
              ...ck.assinaturas,
            ],
          };
        });
      }
    } finally {
      setCarregandoPersistidos(false);
    }
  }, []);

  // Resolve o cliente de uma unidade. No live, `getClienteByUnidade` do CV CRM
  // ainda é um stub (AdapterNotImplementedError): nesse caso caímos para o nome
  // que o ERP (Mega) já trouxe na sincronização, criando um cliente mínimo e
  // persistindo-o no estado para as telas de entrega o resolverem pelo id.
  // Qualquer outro erro (rede, validação) propaga — nunca é engolido.
  // Resolve o cliente de uma unidade. A unidade em tela vem do ERP (Mega), que
  // já traz o nome do cliente; usamos esse nome como dica para o CV localizar a
  // pessoa (CPF/e-mail/telefone). Se o CRM estiver indisponível ou não achar a
  // pessoa (qualquer AdapterError), caímos para um cliente mínimo com o nome do
  // ERP e o persistimos, para nunca travar a entrega. Erros inesperados propagam.
  const resolverClienteComOrigem = useCallback(
    async (unidadeId: string): Promise<{ cliente: Cliente; origem: 'crm' | 'fallback' }> => {
      const unidadeErp = stateRef.current.unidades.find((u) => u.id === unidadeId) as
        | Partial<UnidadeErp>
        | undefined;
      const nome = unidadeErp?.clienteNome?.trim() || null;
      const cvUnidade = unidadeErp?.cvUnidadeId
        ? { empreendimentoId: unidadeErp.empreendimentoId ?? '', unidadeId: unidadeErp.cvUnidadeId }
        : null;
      try {
        const cliente = await adapters.crm.getClienteByUnidade(unidadeId, { nome, cvUnidade });
        // Persiste (upsert) o cliente resolvido para que as telas de entrega o
        // encontrem pelo `entrega.clienteId`. Sem isso, os dados vêm do CRM mas
        // nunca chegam ao estado e o cadastro aparece em branco.
        setState((st) => ({
          ...st,
          clientes: [...st.clientes.filter((c) => c.id !== cliente.id), cliente],
        }));
        return { cliente, origem: 'crm' };
      } catch (e) {
        if (!(e instanceof AdapterError)) throw e;
        console.warn('[resolverCliente] CRM indisponível — usando nome do ERP:', e.message);
        const s = stateRef.current;
        const clienteId = `cli-uni-${unidadeId}`;
        const existente = s.clientes.find((c) => c.id === clienteId);
        if (existente) return { cliente: existente, origem: 'fallback' };
        const cliente: Cliente = {
          id: clienteId,
          nome: nome || 'Cliente',
          cpf: '',
          email: '',
          telefone: '',
          createdAt: new Date().toISOString(),
        };
        setState((st) =>
          st.clientes.some((c) => c.id === clienteId)
            ? st
            : { ...st, clientes: [...st.clientes, cliente] },
        );
        return { cliente, origem: 'fallback' };
      }
    },
    [],
  );

  const resolverCliente = useCallback(
    async (unidadeId: string): Promise<Cliente> =>
      (await resolverClienteComOrigem(unidadeId)).cliente,
    [resolverClienteComOrigem],
  );

  const iniciarEntrega = useCallback(
    async (unidadeId: string, responsavelId: string): Promise<string> => {
      const unidade = stateRef.current.unidades.find((u) => u.id === unidadeId);
      if (!unidade) throw new Error('Unidade não encontrada');
      // Resolve o cliente (CRM live com fallback para o nome vindo do ERP).
      const cliente = await resolverCliente(unidadeId);
      const agora = new Date().toISOString();
      const entrega: Entrega = {
        id: nextId('ent'),
        unidadeId,
        clienteId: cliente.id,
        status: 'ABERTURA',
        responsavelId,
        iniciadaEm: agora,
        concluidaEm: null,
        createdAt: agora,
      };
      // Grava antes de mexer no estado local: se o checkpoint não for salvo, a
      // entrega não deve aparecer como iniciada — o erro sobe para a tela.
      await persistirEntrega(entrega, { cliente, unidade, documentos: [], itens: [] });
      setState((s) => ({ ...s, entregas: [...s.entregas, entrega] }));
      pushAudit(responsavelId, 'ENTREGA_INICIADA', 'entrega', entrega.id, { unidadeId });
      return entrega.id;
    },
    [persistirEntrega, pushAudit, resolverCliente],
  );

  const enviarTermoEntrega = useCallback(
    async (unidadeId: string, responsavelId: string): Promise<string> => {
      const s0 = stateRef.current;
      const unidade = s0.unidades.find((u) => u.id === unidadeId);
      if (!unidade) throw new Error('Unidade não encontrada');

      // Reaproveita a entrega em andamento (não concluída) ou cria uma nova.
      const ativa = s0.entregas.find((e) => e.unidadeId === unidadeId && e.status !== 'CONCLUIDA');
      const agora = new Date().toISOString();
      const novaEntrega = ativa === undefined;
      let entregaId: string;
      let cliente: Cliente;
      if (ativa) {
        entregaId = ativa.id;
        cliente =
          s0.clientes.find((c) => c.id === ativa.clienteId) ?? (await resolverCliente(unidadeId));
      } else {
        cliente = await resolverCliente(unidadeId);
        entregaId = nextId('ent');
      }
      const clienteId = cliente.id;

      // Gera o termo (documento) se ainda não existir para esta entrega.
      let doc: Documento | null = null;
      if (!s0.documentos.some((d) => d.entregaId === entregaId)) {
        const conteudo = `Termo de Entrega de Chaves — ${entregaId} — ${agora}`;
        doc = {
          id: nextId('doc'),
          entregaId,
          tipo: 'Termo de Entrega de Chaves',
          storagePath: `entregas/${entregaId}/termo-entrega.pdf`,
          sha256Hash: await hashToken(conteudo),
          geradoEm: agora,
        };
      }

      // Link de assinatura durável: o adapter persiste o token no servidor (live)
      // ou em memória (mock) e devolve o token em claro + a URL do portal.
      const empreendimento = s0.empreendimentos.find((e) => e.id === unidade.empreendimentoId);
      if (!empreendimento) {
        throw new Error('Empreendimento da unidade não encontrado para gerar o link.');
      }
      const { url } = await adapters.portal.gerarLink({
        // A etapa segue junto para o servidor criar a entrega já em CONFISSAO,
        // e não em ASSINATURA — que era o que fazia o checkpoint seguinte tentar
        // uma transição para trás e falhar em silêncio.
        entrega: { externalRef: entregaId, status: 'CONFISSAO' },
        empreendimento: {
          externalRef: empreendimento.id,
          nome: empreendimento.nome,
          cidade: empreendimento.cidade,
          uf: empreendimento.uf,
        },
        unidade: {
          externalRef: unidade.id,
          identificacao: unidade.identificacao,
          areaM2: unidade.areaM2,
          status: unidade.status,
        },
        cliente: {
          externalRef: cliente.id,
          nome: cliente.nome,
          cpf: cliente.cpf,
          email: cliente.email,
          telefone: cliente.telefone,
        },
      });

      // Para na CONFISSAO, não na ASSINATURA: o cliente só fica apto a receber a
      // chave depois de assinar a confissão de dívida. Ir direto para ASSINATURA
      // burlaria essa regra — e o guard do banco recusaria o salto.
      const entregaFinal: Entrega = ativa
        ? { ...ativa, status: 'CONFISSAO' }
        : {
            id: entregaId,
            unidadeId,
            clienteId,
            status: 'CONFISSAO',
            responsavelId,
            iniciadaEm: agora,
            concluidaEm: null,
            createdAt: agora,
          };

      setState((s) => ({
        ...s,
        entregas: novaEntrega
          ? [...s.entregas, entregaFinal]
          : s.entregas.map((e) => (e.id === entregaId ? entregaFinal : e)),
        documentos: doc ? [...s.documentos, doc] : s.documentos,
      }));

      // `portal.gerarLink` já gravou o grafo no servidor (via Edge Function),
      // mas com o documento próprio dele; este upsert alinha o checkpoint com o
      // que a tela mostra. Falha aqui não desfaz o link já enviado ao cliente.
      await persistirEntrega(entregaFinal, {
        cliente,
        unidade,
        documentos: doc ? [doc] : [],
      }).catch((e: unknown) => console.warn('[persistencia] checkpoint do termo:', e));

      if (novaEntrega) {
        pushAudit(responsavelId, 'ENTREGA_INICIADA', 'entrega', entregaId, { unidadeId });
      }
      if (doc) pushAudit(responsavelId, 'DOCUMENTO_GERADO', 'documento', doc.id, { entregaId });
      pushAudit(responsavelId, 'ETAPA_CONFISSAO', 'entrega', entregaId, {});
      await adapters.notification.notificar({
        tipo: 'LINK_ASSINATURA_GERADO',
        para: 'cliente',
        entregaId,
        linkAssinatura: url,
      });
      pushAudit(responsavelId, 'LINK_ASSINATURA_GERADO', 'entrega', entregaId, {});
      return entregaId;
    },
    [persistirEntrega, pushAudit, resolverCliente],
  );

  // Mescla as unidades vindas do CRM (live) com o estado local. O baseline de
  // venda (EM_OBRAS/DISPONIVEL/VENDIDA) vem do CV, mas o ciclo de ENTREGA
  // (QUITADA/LIBERADA/ENTREGUE) é controlado no app: quando uma unidade local
  // já avançou nesse ciclo, ou tem uma entrega em andamento, preservamos o
  // status local em vez de sobrescrever com o do CV.
  const sincronizarUnidades = useCallback((empreendimentoId: string, novas: Unidade[]): void => {
    const CICLO_ENTREGA: readonly Unidade['status'][] = ['QUITADA', 'LIBERADA', 'ENTREGUE'];
    setState((s) => {
      const outros = s.unidades.filter((u) => u.empreendimentoId !== empreendimentoId);
      const locais = new Map(
        s.unidades
          .filter((u) => u.empreendimentoId === empreendimentoId)
          .map((u) => [u.id, u] as const),
      );
      const idsNovas = new Set(novas.map((n) => n.id));
      const merged = novas.map((nova) => {
        const local = locais.get(nova.id);
        if (local && (CICLO_ENTREGA.includes(local.status) || local.status === 'ENTREGUE')) {
          return { ...nova, status: local.status };
        }
        return nova;
      });
      // Preserva unidades locais deste empreendimento que têm entrega em
      // andamento e não vieram na resposta do CV (para não sumir do fluxo).
      const comEntrega = [...locais.values()].filter(
        (u) => !idsNovas.has(u.id) && s.entregas.some((e) => e.unidadeId === u.id),
      );
      return { ...s, unidades: [...outros, ...merged, ...comEntrega] };
    });
  }, []);

  // Persiste (upsert) empreendimentos vindos do CRM. Sem isso, as telas de
  // entrega não resolvem o empreendimento da unidade (fica "-"), pois o estado
  // global só tinha os dados semente.
  const sincronizarEmpreendimentos = useCallback((lista: Empreendimento[]): void => {
    if (lista.length === 0) return;
    // SUBSTITUI, não mescla: esta lista é o catálogo COMPLETO do CRM, então o
    // que não veio nela não existe mais. Mesclar mantinha para sempre qualquer
    // empreendimento que um dia entrou no estado — foi assim que os dados de
    // demonstração continuaram aparecendo ao lado dos reais, e é assim que um
    // empreendimento removido no CV continuaria na tela.
    setState((s) => ({ ...s, empreendimentos: lista }));
  }, []);

  /**
   * Garante que a lista de empreendimentos está carregada, servindo do cache
   * enquanto ele for recente. Devolve sempre a lista completa — do CRM quando
   * buscou, do estado quando reaproveitou o cache.
   */
  const garantirEmpreendimentos = useCallback(
    async (opts: { forcar?: boolean } = {}): Promise<Empreendimento[]> => {
      const emVooAtual = emVoo.current.get(CHAVE_EMPREENDIMENTOS);
      if (emVooAtual) {
        await emVooAtual;
        return stateRef.current.empreendimentos;
      }
      if (!opts.forcar) {
        const carimbo = stateRef.current.sincronizadoEm[CHAVE_EMPREENDIMENTOS];
        if (
          carimbo &&
          stateRef.current.empreendimentos.length > 0 &&
          Date.now() - Date.parse(carimbo) < TTL_CATALOGO_MS
        ) {
          return stateRef.current.empreendimentos;
        }
      }
      const busca = (async () => {
        const lista = await adapters.crm.getEmpreendimentos();
        sincronizarEmpreendimentos(lista);
        setState((s) => ({
          ...s,
          sincronizadoEm: {
            ...s.sincronizadoEm,
            [CHAVE_EMPREENDIMENTOS]: new Date().toISOString(),
          },
        }));
      })();
      emVoo.current.set(CHAVE_EMPREENDIMENTOS, busca);
      try {
        await busca;
      } finally {
        emVoo.current.delete(CHAVE_EMPREENDIMENTOS);
      }
      return stateRef.current.empreendimentos;
    },
    [sincronizarEmpreendimentos],
  );

  /**
   * Garante que o catálogo de unidades do empreendimento está carregado.
   *
   * Ponto único de entrada para essa busca — tanto a tela de unidades quanto o
   * prefetch pós-login passam por aqui. Serve do cache enquanto ele for recente
   * (`TTL_CATALOGO_MS`), reaproveita a chamada já em voo quando duas origens
   * pedem o mesmo empreendimento, e só vai à rede quando precisa de verdade.
   */
  const garantirUnidades = useCallback(
    async (
      empreendimento: Empreendimento,
      opts: { forcar?: boolean } = {},
    ): Promise<{ aviso?: string }> => {
      const { id, nome } = empreendimento;
      const emVooAtual = emVoo.current.get(id);
      if (emVooAtual) {
        await emVooAtual;
        return {};
      }

      if (!opts.forcar) {
        const carimbo = stateRef.current.sincronizadoEm[id];
        const temUnidades = stateRef.current.unidades.some((u) => u.empreendimentoId === id);
        if (carimbo && temUnidades && Date.now() - Date.parse(carimbo) < TTL_CATALOGO_MS) return {};
      }

      // O mapa do CV tem todas as unidades cadastradas; o Mega só as vendidas
      // (com contrato), e há empreendimentos que ainda nem existem lá. Buscamos
      // os dois em paralelo e mesclamos (ver `mesclarCatalogo`). Cada fonte é
      // opcional: a falha de uma não pode esconder o que a outra trouxe — só
      // quando as duas falham a busca falha.
      let aviso: string | undefined;
      const busca = (async () => {
        const [erp, crm] = await Promise.allSettled([
          adapters.erp.getUnidadesByEmpreendimento(id, nome),
          adapters.crm.getUnidadesByEmpreendimento(id),
        ]);
        if (erp.status === 'rejected' && crm.status === 'rejected') throw crm.reason;
        if (erp.status === 'rejected') {
          console.warn('[garantirUnidades] Mega indisponível', erp.reason);
          aviso = 'Mega indisponível: cliente, contrato e inadimplência não foram carregados.';
        } else if (crm.status === 'rejected') {
          console.warn('[garantirUnidades] CV indisponível', crm.reason);
          aviso =
            'Não foi possível ler o mapa de unidades do CV — exibindo só as unidades com contrato no Mega.';
        }
        sincronizarUnidades(
          id,
          mesclarCatalogo(
            erp.status === 'fulfilled' ? erp.value : [],
            crm.status === 'fulfilled' ? crm.value : [],
          ),
        );
        setState((s) => ({
          ...s,
          sincronizadoEm: { ...s.sincronizadoEm, [id]: new Date().toISOString() },
        }));
      })();

      emVoo.current.set(id, busca);
      try {
        await busca;
      } finally {
        emVoo.current.delete(id);
      }
      return aviso ? { aviso } : {};
    },
    [sincronizarUnidades],
  );

  /**
   * Carga automática dos dados de integração da entrega, no lugar da antiga
   * etapa manual. Duas travas para não PIORAR o cadastro que já está em tela:
   *
   *  - sem a unidade em estado não há dica de nome para o CV (a unidade vem do
   *    Mega, que é quem sabe o nome do cliente). Buscar assim só produziria o
   *    cliente mínimo de fallback, então preferimos não buscar: quando o
   *    catálogo chegar, a tela chama de novo com a dica na mão;
   *  - só religamos a entrega quando o CRM realmente resolveu alguém. O cliente
   *    de fallback (nome do ERP, sem CPF/e-mail/telefone) nunca substitui o que
   *    foi gravado na abertura — do contrário, abrir a entrega logo depois de um
   *    refresh apagaria o contato da tela.
   */
  const sincronizarDadosEntrega = useCallback(
    async (entregaId: string): Promise<void> => {
      const entrega = stateRef.current.entregas.find((e) => e.id === entregaId);
      if (!entrega) throw new Error('Entrega não encontrada');
      const unidade = stateRef.current.unidades.find((u) => u.id === entrega.unidadeId);
      if (!unidade) return;
      const { cliente, origem } = await resolverClienteComOrigem(entrega.unidadeId);
      if (origem === 'fallback' || cliente.id === entrega.clienteId) return;
      setState((s) => ({
        ...s,
        entregas: s.entregas.map((e) => (e.id === entregaId ? { ...e, clienteId: cliente.id } : e)),
      }));
    },
    [resolverClienteComOrigem],
  );

  const gerarDocumento = useCallback(
    async (entregaId: string, actorId: string): Promise<Documento[]> => {
      // Gera os DOIS termos do processo: Confissão de Dívida (assinada via
      // Clicksign) e Recebimento de Chaves (assinado presencialmente no canvas).
      const carimbo = new Date().toISOString();
      const tipos = [TIPO_DOCUMENTO.CONFISSAO_DIVIDA, TIPO_DOCUMENTO.RECEBIMENTO_CHAVES] as const;
      const arquivos: Record<string, string> = {
        [TIPO_DOCUMENTO.CONFISSAO_DIVIDA]: 'confissao-divida.pdf',
        [TIPO_DOCUMENTO.RECEBIMENTO_CHAVES]: 'recebimento-chaves.pdf',
      };
      const novos: Documento[] = [];
      for (const tipo of tipos) {
        if (stateRef.current.documentos.some((d) => d.entregaId === entregaId && d.tipo === tipo)) {
          continue;
        }
        const conteudo = `${tipo} — ${entregaId} — ${carimbo}`;
        novos.push({
          id: nextId('doc'),
          entregaId,
          tipo,
          storagePath: `entregas/${entregaId}/${arquivos[tipo]}`,
          sha256Hash: await hashToken(conteudo),
          geradoEm: new Date().toISOString(),
        });
      }
      if (novos.length === 0) return [];
      setState((s) => ({ ...s, documentos: [...s.documentos, ...novos] }));
      for (const d of novos) {
        pushAudit(actorId, 'DOCUMENTO_GERADO', 'documento', d.id, { entregaId, tipo: d.tipo });
      }
      return novos;
    },
    [pushAudit],
  );

  const avancarEtapa = useCallback(
    async (entregaId: string, proximo: EntregaStatus, actorId: string): Promise<void> => {
      const entrega = stateRef.current.entregas.find((e) => e.id === entregaId);
      if (!entrega) throw new Error('Entrega não encontrada');
      // Valida a transição (deny-by-default) — espelha a regra do servidor.
      transicionar(entrega.status, proximo);

      // Efeitos colaterais por etapa de destino.
      let novosDocs: Documento[] = [];
      if (proximo === 'DOCUMENTOS') {
        const jaTem = stateRef.current.documentos.some((d) => d.entregaId === entregaId);
        if (!jaTem) novosDocs = await gerarDocumento(entregaId, actorId);
      }

      const concluida = proximo === 'CONCLUIDA';
      const atualizada: Entrega = {
        ...entrega,
        status: proximo,
        concluidaEm: concluida ? new Date().toISOString() : entrega.concluidaEm,
      };
      const unidadeAtualizada = concluida
        ? stateRef.current.unidades
            .filter((u) => u.id === entrega.unidadeId)
            .map((u): Unidade => ({ ...u, status: 'ENTREGUE' }))[0]
        : undefined;

      // Deduplica por id: `gerarDocumento` já fez o setState dos documentos novos
      // E os devolveu, então somar as duas fontes repetia cada um. No upsert isso
      // vira o mesmo `external_ref` duas vezes no mesmo lote, e o Postgres recusa
      // com 21000 ("ON CONFLICT DO UPDATE command cannot affect row a second
      // time"). Como o setState só aparece em `stateRef` depois de um render, a
      // falha dependia do timing — e sumia na segunda tentativa, quando os
      // documentos já existiam e nada novo era gerado.
      const documentos = [
        ...stateRef.current.documentos.filter((d) => d.entregaId === entregaId),
        ...novosDocs,
      ];
      const documentosUnicos = [...new Map(documentos.map((d) => [d.id, d])).values()];

      // O checkpoint vai ao servidor antes do estado local mudar: se a gravação
      // falhar, a etapa não "anda" só na tela do usuário. O erro sobe para quem
      // chamou, que já exibe a falha.
      await persistirEntrega(atualizada, {
        ...(unidadeAtualizada ? { unidade: unidadeAtualizada } : {}),
        documentos: documentosUnicos,
      });

      setState((s) => ({
        ...s,
        entregas: s.entregas.map((e) => (e.id === entregaId ? atualizada : e)),
        unidades: concluida
          ? s.unidades.map((u) => (u.id === entrega.unidadeId ? { ...u, status: 'ENTREGUE' } : u))
          : s.unidades,
      }));

      pushAudit(actorId, `ETAPA_${proximo}`, 'entrega', entregaId, { de: entrega.status });
      if (concluida) {
        await adapters.notification.notificar({
          tipo: 'ENTREGA_FINALIZADA',
          para: 'equipe@rottas.com.br',
          entregaId,
        });
      }
    },
    [gerarDocumento, persistirEntrega, pushAudit],
  );

  const gerarLinkAssinatura = useCallback(
    async (entregaId: string, actorId: string): Promise<{ token: string; url: string }> => {
      // O adapter persiste o token no servidor (live) ou em memória (mock) e
      // devolve o token em claro + a URL do portal. Nada de token é gravado aqui.
      const snapshot = montarSnapshot(stateRef.current, entregaId);
      if (!snapshot) throw new Error('Dados da entrega incompletos para gerar o link.');
      const { token, url } = await adapters.portal.gerarLink(snapshot);
      await adapters.notification.notificar({
        tipo: 'LINK_ASSINATURA_GERADO',
        para: 'cliente',
        entregaId,
        linkAssinatura: url,
      });
      pushAudit(actorId, 'LINK_ASSINATURA_GERADO', 'entrega', entregaId, {});
      return { token, url };
    },
    [pushAudit],
  );

  /** Documento de um tipo dentro da entrega — as duas assinaturas apontam para um. */
  const acharDocumento = useCallback((entregaId: string, tipo: string): Documento => {
    const doc = stateRef.current.documentos.find(
      (d) => d.entregaId === entregaId && d.tipo === tipo,
    );
    if (!doc) throw new Error(`Documento "${tipo}" ainda não foi gerado para esta entrega.`);
    return doc;
  }, []);

  /**
   * Envia a Confissão de Dívida ao cliente para assinatura remota (Clicksign) e
   * registra a assinatura como pendente. Devolve a URL de assinatura quando o
   * provedor a fornece.
   *
   * Em `live` o adapter Clicksign ainda é um stub e lança — por isso a etapa
   * também aceita confirmação manual (ver `confirmarConfissaoAssinada`).
   */
  const enviarConfissaoParaAssinatura = useCallback(
    async (entregaId: string, actorId: string): Promise<{ signUrl: string | null }> => {
      const entrega = stateRef.current.entregas.find((e) => e.id === entregaId);
      if (!entrega) throw new Error('Entrega não encontrada');
      const doc = acharDocumento(entregaId, TIPO_DOCUMENTO.CONFISSAO_DIVIDA);
      const cliente = stateRef.current.clientes.find((c) => c.id === entrega.clienteId);
      if (!cliente) throw new Error('Cliente da entrega não encontrado');

      // Não envia com cadastro incompleto. Sem CPF válido a Clicksign recusa, e
      // sem e-mail não há para onde mandar o convite de assinatura — melhor
      // barrar aqui, dizendo o que falta, do que devolver um 422 da API.
      const pendencia = verificarSignatario(cliente);
      if (pendencia) {
        throw new Error(
          `Cadastro do cliente incompleto: falta ${listarPendencias(pendencia)}. ` +
            'Os dados vêm do CV CRM — confira o cadastro da pessoa por lá e recarregue a entrega.',
        );
      }

      const ref = await adapters.signature.enviarParaAssinatura({
        entregaId,
        documentoId: doc.id,
        nomeArquivo: 'confissao-divida.pdf',
        mimeType: 'application/pdf',
        sha256Hash: doc.sha256Hash,
        // O PDF real ainda é gerado no servidor (pendente); o mock ignora o
        // conteúdo e o live falha antes de usá-lo.
        conteudoBase64: '',
        signatario: { nome: cliente.nome, email: cliente.email, cpf: cliente.cpf },
      });

      const anterior = stateRef.current.assinaturas.find(
        (a) => a.entregaId === entregaId && a.metodo === 'CLICKSIGN',
      );
      const assinatura: Assinatura = {
        id: anterior?.id ?? nextId('ass'),
        entregaId,
        documentoId: doc.id,
        canvasPngPath: null,
        metodo: 'CLICKSIGN',
        ip: null,
        userAgent: null,
        geo: null,
        assinadaEm: null,
        clicksignDocKey: ref.documentKey,
        clicksignStatus: 'pending',
      };
      await persistirEntrega(entrega, {
        assinaturas: [
          ...stateRef.current.assinaturas.filter(
            (a) => a.entregaId === entregaId && a.id !== assinatura.id,
          ),
          assinatura,
        ],
      });
      setState((s) => ({
        ...s,
        assinaturas: [...s.assinaturas.filter((a) => a.id !== assinatura.id), assinatura],
      }));
      pushAudit(actorId, 'CONFISSAO_ENVIADA_ASSINATURA', 'entrega', entregaId, {
        documentKey: ref.documentKey,
        provider: ref.provider,
      });
      return { signUrl: ref.signUrl ?? null };
    },
    [acharDocumento, persistirEntrega, pushAudit],
  );

  /**
   * Marca a Confissão de Dívida como assinada.
   *
   * `manual: true` é a saída enquanto a Clicksign não está integrada: a equipe
   * confirma que a assinatura aconteceu fora do sistema. A auditoria registra
   * explicitamente que foi confirmação manual — quem auditar depois precisa
   * conseguir distinguir isso de uma confirmação vinda do provedor.
   */
  const confirmarConfissaoAssinada = useCallback(
    async (entregaId: string, actorId: string, opts: { manual: boolean }): Promise<void> => {
      const entrega = stateRef.current.entregas.find((e) => e.id === entregaId);
      if (!entrega) throw new Error('Entrega não encontrada');
      const doc = acharDocumento(entregaId, TIPO_DOCUMENTO.CONFISSAO_DIVIDA);
      const anterior = stateRef.current.assinaturas.find(
        (a) => a.entregaId === entregaId && a.metodo === 'CLICKSIGN',
      );
      const assinatura: Assinatura = {
        id: anterior?.id ?? nextId('ass'),
        entregaId,
        documentoId: doc.id,
        canvasPngPath: null,
        metodo: 'CLICKSIGN',
        ip: null,
        userAgent: null,
        geo: null,
        assinadaEm: new Date().toISOString(),
        clicksignDocKey: anterior?.clicksignDocKey ?? null,
        clicksignStatus: opts.manual ? 'confirmado_manualmente' : 'signed',
      };
      await persistirEntrega(entrega, {
        assinaturas: [
          ...stateRef.current.assinaturas.filter(
            (a) => a.entregaId === entregaId && a.id !== assinatura.id,
          ),
          assinatura,
        ],
      });
      setState((s) => ({
        ...s,
        assinaturas: [...s.assinaturas.filter((a) => a.id !== assinatura.id), assinatura],
      }));
      pushAudit(
        actorId,
        opts.manual ? 'CONFISSAO_CONFIRMADA_MANUALMENTE' : 'CONFISSAO_ASSINADA',
        'entrega',
        entregaId,
        { manual: opts.manual },
      );
    },
    [acharDocumento, persistirEntrega, pushAudit],
  );

  /**
   * Colhe a assinatura do Recebimento de Chaves ali mesmo, no dispositivo de quem
   * está atendendo, no dia da entrega.
   *
   * Reaproveita o caminho do portal em vez de criar um endpoint novo: gera um
   * token e o consome na hora. Com isso o PNG segue para o mesmo bucket privado,
   * o token continua de uso único e a auditoria do servidor é a mesma da
   * assinatura remota — o link só não chega a sair do aparelho.
   */
  const registrarAssinaturaPresencial = useCallback(
    async (
      entregaId: string,
      pngDataUrl: string,
      geo: { lat: number; lng: number } | null,
      actorId: string,
    ): Promise<void> => {
      const entrega = stateRef.current.entregas.find((e) => e.id === entregaId);
      if (!entrega) throw new Error('Entrega não encontrada');
      const doc = acharDocumento(entregaId, TIPO_DOCUMENTO.RECEBIMENTO_CHAVES);
      const snapshot = montarSnapshot(stateRef.current, entregaId);
      if (!snapshot) throw new Error('Dados da entrega incompletos para registrar a assinatura.');

      const { token } = await adapters.portal.gerarLink(snapshot);
      const r = await adapters.portal.registrarAssinatura({
        token,
        pngDataUrl,
        geo,
        userAgent: navigator.userAgent,
      });
      if (!r.ok) throw new Error('Não foi possível registrar a assinatura.');

      // A assinatura JÁ foi gravada pelo servidor: `portal-assinar` sobe o PNG no
      // bucket privado e insere a linha em `assinaturas`. Persistir daqui criava
      // uma segunda linha para a mesma assinatura, apontando para um caminho que
      // não existe (montado com o external_ref, enquanto o arquivo real fica sob
      // o uuid da entrega). Aqui só refletimos na tela; a linha autoritativa vem
      // do servidor no próximo `carregarPersistidos`.
      const anterior = stateRef.current.assinaturas.find(
        (a) => a.entregaId === entregaId && a.metodo === 'CANVAS',
      );
      const assinatura: Assinatura = {
        id: anterior?.id ?? nextId('ass'),
        entregaId,
        documentoId: doc.id,
        // Desconhecido no cliente — quem resolve o arquivo é o servidor.
        canvasPngPath: null,
        metodo: 'CANVAS',
        ip: null,
        userAgent: navigator.userAgent,
        geo,
        assinadaEm: new Date().toISOString(),
        clicksignDocKey: null,
        clicksignStatus: null,
      };
      setState((s) => ({
        ...s,
        assinaturas: [...s.assinaturas.filter((a) => a.id !== assinatura.id), assinatura],
      }));
      pushAudit(actorId, 'ASSINATURA_PRESENCIAL_REGISTRADA', 'entrega', entregaId, {
        comGeo: geo !== null,
      });
    },
    [acharDocumento, pushAudit],
  );

  const adicionarItem = useCallback(
    async (
      entregaId: string,
      descricao: string,
      quantidade: number,
      actorId: string,
    ): Promise<void> => {
      const entrega = stateRef.current.entregas.find((e) => e.id === entregaId);
      if (!entrega) throw new Error('Entrega não encontrada');
      const item: ItemEntrega = { id: nextId('item'), entregaId, descricao, quantidade };
      await persistirEntrega(entrega, {
        itens: [...stateRef.current.itens.filter((i) => i.entregaId === entregaId), item],
      });
      setState((s) => ({ ...s, itens: [...s.itens, item] }));
      pushAudit(actorId, 'ITEM_REGISTRADO', 'entrega', entregaId, { descricao, quantidade });
    },
    [persistirEntrega, pushAudit],
  );

  const removerItem = useCallback(async (itemId: string): Promise<void> => {
    await removerItemPersistido(itemId);
    setState((s) => ({ ...s, itens: s.itens.filter((i) => i.id !== itemId) }));
  }, []);

  /**
   * URL temporária de um arquivo privado da entrega (traço da assinatura ou PDF
   * do termo). `null` quando o arquivo ainda não existe — o PDF só passa a
   * existir quando a geração server-side roda para aquela entrega.
   */
  const urlArquivoEntrega = useCallback(
    (entregaId: string, alvo: string): Promise<string | null> =>
      adapters.portal.urlArquivo(entregaId, alvo),
    [],
  );

  const resolverToken = useCallback(
    (token: string): Promise<PortalResolveResult> => adapters.portal.resolver(token),
    [],
  );

  const registrarAssinaturaPorToken = useCallback(
    async (
      token: string,
      pngDataUrl: string,
      geo: { lat: number; lng: number } | null,
    ): Promise<PortalAssinarResult> => {
      // Registro da assinatura (upload do PNG em bucket privado, uso único do
      // token e auditoria) acontece no servidor (live) ou em memória (mock) via
      // adapter — o portal roda numa sessão anônima, sem o estado interno.
      const r = await adapters.portal.registrarAssinatura({
        token,
        pngDataUrl,
        geo,
        userAgent: navigator.userAgent,
      });
      if (r.ok) {
        await adapters.notification.notificar({
          tipo: 'ASSINATURA_CONCLUIDA',
          para: 'equipe@rottas.com.br',
          entregaId: r.entregaId,
        });
      }
      return r;
    },
    [],
  );

  const definirPapel = useCallback(
    (userId: string, papel: 'admin' | 'equipe_entrega', actorId: string): void => {
      setState((s) => ({
        ...s,
        usuarios: s.usuarios.map((u) => (u.id === userId ? { ...u, papel } : u)),
      }));
      pushAudit(actorId, 'PAPEL_ALTERADO', 'usuario', userId, { papel });
    },
    [pushAudit],
  );

  // Modelos gravam ANTES de mexer no estado: é o texto que o cliente vai
  // assinar, e a Edge Function que gera o PDF lê do servidor. Se a gravação
  // falhar, a edição não pode parecer salva só na tela de quem editou.
  const criarModelo = useCallback(
    async (dados: DadosModelo, actorId: string): Promise<string> => {
      const id = nextId('mod');
      const agora = new Date().toISOString();
      const modelo: ModeloTermo = { id, ...dados, createdAt: agora, updatedAt: agora };
      await salvarModelo(modelo);
      setState((s) => ({ ...s, modelos: [...s.modelos, modelo] }));
      pushAudit(actorId, 'MODELO_CRIADO', 'modelo', id, { nome: dados.nome });
      return id;
    },
    [pushAudit],
  );

  const atualizarModelo = useCallback(
    async (id: string, dados: DadosModelo, actorId: string): Promise<void> => {
      const atual = stateRef.current.modelos.find((m) => m.id === id);
      if (!atual) throw new Error('Modelo não encontrado');
      const atualizado: ModeloTermo = { ...atual, ...dados, updatedAt: new Date().toISOString() };
      await salvarModelo(atualizado);
      setState((s) => ({ ...s, modelos: s.modelos.map((m) => (m.id === id ? atualizado : m)) }));
      pushAudit(actorId, 'MODELO_ATUALIZADO', 'modelo', id, {});
    },
    [pushAudit],
  );

  const removerModelo = useCallback(
    (id: string, actorId: string): void => {
      setState((s) => ({ ...s, modelos: s.modelos.filter((m) => m.id !== id) }));
      pushAudit(actorId, 'MODELO_REMOVIDO', 'modelo', id, {});
    },
    [pushAudit],
  );

  const actions = useMemo<DataActions>(
    () => ({
      iniciarEntrega,
      enviarTermoEntrega,
      sincronizarUnidades,
      sincronizarEmpreendimentos,
      garantirEmpreendimentos,
      garantirUnidades,
      sincronizarDadosEntrega,
      avancarEtapa,
      gerarDocumento,
      gerarLinkAssinatura,
      enviarConfissaoParaAssinatura,
      confirmarConfissaoAssinada,
      registrarAssinaturaPresencial,
      adicionarItem,
      removerItem,
      carregarPersistidos,
      urlArquivoEntrega,
      resolverToken,
      registrarAssinaturaPorToken,
      definirPapel,
      criarModelo,
      atualizarModelo,
      removerModelo,
    }),
    [
      iniciarEntrega,
      enviarTermoEntrega,
      sincronizarUnidades,
      sincronizarEmpreendimentos,
      garantirEmpreendimentos,
      garantirUnidades,
      sincronizarDadosEntrega,
      avancarEtapa,
      gerarDocumento,
      gerarLinkAssinatura,
      enviarConfissaoParaAssinatura,
      confirmarConfissaoAssinada,
      registrarAssinaturaPresencial,
      adicionarItem,
      removerItem,
      carregarPersistidos,
      urlArquivoEntrega,
      resolverToken,
      registrarAssinaturaPorToken,
      definirPapel,
      criarModelo,
      atualizarModelo,
      removerModelo,
    ],
  );

  const value = useMemo<DataContextValue>(
    () => ({ state, actions, carregandoPersistidos }),
    [state, actions, carregandoPersistidos],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>');
  return ctx;
}
