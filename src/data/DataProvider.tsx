import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { adapters } from '@/adapters';
import { AdapterError } from '@/adapters/errors';
import type { UnidadeErp } from '@/adapters/types';
import { transicionar } from '@/domain/state-machine';
import { type Cliente, type Documento, type Empreendimento, type EntregaStatus, TIPO_DOCUMENTO, type Unidade } from '@/domain/types';
import { buildPortalUrl, generateToken, hashToken, timingSafeEqualHex } from '@/lib/token';
import { env } from '@/lib/env';
import { logAtividade } from '@/lib/atividade';
import { createInitialState, type DbState } from './seed';

let idCounter = 1000;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter.toString(36)}`;
}

export type PortalResultado =
  | { ok: true; entregaId: string }
  | { ok: false; motivo: 'invalido' | 'expirado' | 'usado' };

export interface DataActions {
  iniciarEntrega(unidadeId: string, responsavelId: string): Promise<string>;
  /**
   * Fluxo "enviar termo" para uma unidade: inicia a entrega (ou reaproveita a
   * ativa), gera o termo e o link de assinatura, avançando até ASSINATURA e
   * notificando o cliente. Base da ação em massa.
   */
  enviarTermoEntrega(unidadeId: string, responsavelId: string): Promise<string>;
  sincronizarUnidades(empreendimentoId: string, unidades: Unidade[]): void;
  /** Persiste (upsert) empreendimentos carregados do CRM para as telas resolverem pelo id. */
  sincronizarEmpreendimentos(empreendimentos: Empreendimento[]): void;
  avancarEtapa(entregaId: string, proximo: EntregaStatus, actorId: string): Promise<void>;
  gerarDocumento(entregaId: string, actorId: string): Promise<void>;
  gerarLinkAssinatura(entregaId: string, actorId: string): Promise<{ token: string; url: string }>;
  adicionarItem(entregaId: string, descricao: string, quantidade: number, actorId: string): void;
  removerItem(itemId: string): void;
  resolverToken(token: string): Promise<PortalResultado>;
  registrarAssinaturaPorToken(
    token: string,
    pngDataUrl: string,
    geo: { lat: number; lng: number } | null,
  ): Promise<PortalResultado>;
  definirPapel(userId: string, papel: 'admin' | 'equipe_entrega', actorId: string): void;
  criarModelo(nome: string, conteudo: string, actorId: string): string;
  atualizarModelo(id: string, dados: { nome: string; conteudo: string }, actorId: string): void;
  removerModelo(id: string, actorId: string): void;
}

interface DataContextValue {
  state: DbState;
  actions: DataActions;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<DbState>(() => createInitialState());

  // Referência sempre atual ao estado: as ações assíncronas leem daqui em vez de
  // capturar `state` no closure, evitando dados defasados entre renders.
  const stateRef = useRef(state);
  stateRef.current = state;

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
  const resolverCliente = useCallback(async (unidadeId: string): Promise<Cliente> => {
    const unidadeErp = stateRef.current.unidades.find((u) => u.id === unidadeId) as
      | Partial<UnidadeErp>
      | undefined;
    const nome = unidadeErp?.clienteNome?.trim() || null;
    try {
      const cliente = await adapters.crm.getClienteByUnidade(unidadeId, { nome });
      // Persiste (upsert) o cliente resolvido para que as telas de entrega o
      // encontrem pelo `entrega.clienteId`. Sem isso, os dados vêm do CRM mas
      // nunca chegam ao estado e o cadastro aparece em branco.
      setState((st) => ({
        ...st,
        clientes: [...st.clientes.filter((c) => c.id !== cliente.id), cliente],
      }));
      return cliente;
    } catch (e) {
      if (!(e instanceof AdapterError)) throw e;
      console.warn('[resolverCliente] CRM indisponível — usando nome do ERP:', e.message);
      const s = stateRef.current;
      const clienteId = `cli-uni-${unidadeId}`;
      const existente = s.clientes.find((c) => c.id === clienteId);
      if (existente) return existente;
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
      return cliente;
    }
  }, []);

  const iniciarEntrega = useCallback(
    async (unidadeId: string, responsavelId: string): Promise<string> => {
      const unidade = stateRef.current.unidades.find((u) => u.id === unidadeId);
      if (!unidade) throw new Error('Unidade não encontrada');
      // Resolve o cliente (CRM live com fallback para o nome vindo do ERP).
      const cliente = await resolverCliente(unidadeId);
      const entregaId = nextId('ent');
      const agora = new Date().toISOString();
      setState((s) => ({
        ...s,
        entregas: [
          ...s.entregas,
          {
            id: entregaId,
            unidadeId,
            clienteId: cliente.id,
            status: 'ABERTURA',
            responsavelId,
            iniciadaEm: agora,
            concluidaEm: null,
            createdAt: agora,
          },
        ],
      }));
      pushAudit(responsavelId, 'ENTREGA_INICIADA', 'entrega', entregaId, { unidadeId });
      return entregaId;
    },
    [pushAudit, resolverCliente],
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
      let clienteId: string;
      if (ativa) {
        entregaId = ativa.id;
        clienteId = ativa.clienteId;
      } else {
        const cliente = await resolverCliente(unidadeId);
        entregaId = nextId('ent');
        clienteId = cliente.id;
      }

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

      // Link de assinatura (uso único, 72h) — invalida tokens anteriores.
      const { token, tokenHash } = await generateToken();
      const url = buildPortalUrl(env.VITE_PUBLIC_APP_URL, token);
      const expires = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

      setState((s) => ({
        ...s,
        entregas: novaEntrega
          ? [
              ...s.entregas,
              {
                id: entregaId,
                unidadeId,
                clienteId,
                status: 'ASSINATURA',
                responsavelId,
                iniciadaEm: agora,
                concluidaEm: null,
                createdAt: agora,
              },
            ]
          : s.entregas.map((e) => (e.id === entregaId ? { ...e, status: 'ASSINATURA' } : e)),
        documentos: doc ? [...s.documentos, doc] : s.documentos,
        tokens: [
          ...s.tokens.filter((t) => t.entregaId !== entregaId),
          {
            id: nextId('tok'),
            entregaId,
            tokenHash,
            expiresAt: expires,
            usedAt: null,
            scope: 'assinatura',
            createdAt: agora,
          },
        ],
      }));

      if (novaEntrega) {
        pushAudit(responsavelId, 'ENTREGA_INICIADA', 'entrega', entregaId, { unidadeId });
      }
      if (doc) pushAudit(responsavelId, 'DOCUMENTO_GERADO', 'documento', doc.id, { entregaId });
      pushAudit(responsavelId, 'ETAPA_ASSINATURA', 'entrega', entregaId, {});
      await adapters.notification.notificar({
        tipo: 'LINK_ASSINATURA_GERADO',
        para: 'cliente',
        entregaId,
        linkAssinatura: url,
      });
      pushAudit(responsavelId, 'LINK_ASSINATURA_GERADO', 'entrega', entregaId, {});
      return entregaId;
    },
    [pushAudit, resolverCliente],
  );

  // Mescla as unidades vindas do CRM (live) com o estado local. O baseline de
  // venda (EM_OBRAS/DISPONIVEL/VENDIDA) vem do CV, mas o ciclo de ENTREGA
  // (QUITADA/LIBERADA/ENTREGUE) é controlado no app: quando uma unidade local
  // já avançou nesse ciclo, ou tem uma entrega em andamento, preservamos o
  // status local em vez de sobrescrever com o do CV.
  const sincronizarUnidades = useCallback(
    (empreendimentoId: string, novas: Unidade[]): void => {
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
    },
    [],
  );

  // Persiste (upsert) empreendimentos vindos do CRM. Sem isso, as telas de
  // entrega não resolvem o empreendimento da unidade (fica "-"), pois o estado
  // global só tinha os dados semente.
  const sincronizarEmpreendimentos = useCallback((lista: Empreendimento[]): void => {
    if (lista.length === 0) return;
    setState((s) => {
      const ids = new Set(lista.map((e) => e.id));
      return { ...s, empreendimentos: [...s.empreendimentos.filter((e) => !ids.has(e.id)), ...lista] };
    });
  }, []);

  const gerarDocumento = useCallback(
    async (entregaId: string, actorId: string): Promise<void> => {
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
      if (novos.length === 0) return;
      setState((s) => ({ ...s, documentos: [...s.documentos, ...novos] }));
      for (const d of novos) {
        pushAudit(actorId, 'DOCUMENTO_GERADO', 'documento', d.id, { entregaId, tipo: d.tipo });
      }
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
      if (proximo === 'DOCUMENTOS') {
        const jaTem = stateRef.current.documentos.some((d) => d.entregaId === entregaId);
        if (!jaTem) await gerarDocumento(entregaId, actorId);
      }

      const concluida = proximo === 'CONCLUIDA';
      setState((s) => ({
        ...s,
        entregas: s.entregas.map((e) =>
          e.id === entregaId
            ? {
                ...e,
                status: proximo,
                concluidaEm: concluida ? new Date().toISOString() : e.concluidaEm,
              }
            : e,
        ),
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
    [gerarDocumento, pushAudit],
  );

  const gerarLinkAssinatura = useCallback(
    async (entregaId: string, actorId: string): Promise<{ token: string; url: string }> => {
      const { token, tokenHash } = await generateToken();
      const url = buildPortalUrl(env.VITE_PUBLIC_APP_URL, token);
      const expires = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
      setState((s) => ({
        ...s,
        // Invalida tokens anteriores da mesma entrega (escopo mínimo + uso único).
        tokens: [
          ...s.tokens.filter((t) => t.entregaId !== entregaId),
          {
            id: nextId('tok'),
            entregaId,
            tokenHash,
            expiresAt: expires,
            usedAt: null,
            scope: 'assinatura',
            createdAt: new Date().toISOString(),
          },
        ],
      }));
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

  const adicionarItem = useCallback(
    (entregaId: string, descricao: string, quantidade: number, actorId: string): void => {
      const itemId = nextId('item');
      setState((s) => ({
        ...s,
        itens: [...s.itens, { id: itemId, entregaId, descricao, quantidade }],
      }));
      pushAudit(actorId, 'ITEM_REGISTRADO', 'entrega', entregaId, { descricao, quantidade });
    },
    [pushAudit],
  );

  const removerItem = useCallback((itemId: string): void => {
    setState((s) => ({ ...s, itens: s.itens.filter((i) => i.id !== itemId) }));
  }, []);

  const resolverToken = useCallback(async (token: string): Promise<PortalResultado> => {
    const hash = await hashToken(token);
    const rec = stateRef.current.tokens.find((t) => timingSafeEqualHex(t.tokenHash, hash));
    if (!rec) return { ok: false, motivo: 'invalido' };
    if (rec.usedAt !== null) return { ok: false, motivo: 'usado' };
    if (new Date(rec.expiresAt).getTime() <= Date.now()) return { ok: false, motivo: 'expirado' };
    return { ok: true, entregaId: rec.entregaId };
  }, []);

  const registrarAssinaturaPorToken = useCallback(
    async (
      token: string,
      pngDataUrl: string,
      geo: { lat: number; lng: number } | null,
    ): Promise<PortalResultado> => {
      const resultado = await resolverToken(token);
      if (!resultado.ok) return resultado;
      const entregaId = resultado.entregaId;
      const documento = stateRef.current.documentos.find((d) => d.entregaId === entregaId);

      // Envia ao Clicksign via adapter (mock) para validade jurídica.
      const ref = await adapters.signature.enviarParaAssinatura({
        entregaId,
        documentoId: documento?.id ?? 'sem-doc',
        nomeArquivo: 'termo-entrega.pdf',
        mimeType: 'application/pdf',
        sha256Hash: documento?.sha256Hash ?? 'a'.repeat(64),
        conteudoBase64: '',
        signatario: { nome: 'Cliente', email: 'cliente@example.com', cpf: '00000000000' },
      });
      const status = await adapters.signature.consultarStatus(ref);

      const assinaturaId = nextId('ass');
      const agora = new Date().toISOString();
      setState((s) => ({
        ...s,
        assinaturas: [
          ...s.assinaturas.filter((a) => a.entregaId !== entregaId),
          {
            id: assinaturaId,
            entregaId,
            documentoId: documento?.id ?? '',
            canvasPngPath: pngDataUrl, // em produção: upload p/ bucket privado + signed URL
            metodo: 'CLICKSIGN',
            ip: null, // capturado no servidor (não confiar no cliente)
            userAgent: navigator.userAgent,
            geo,
            assinadaEm: agora,
            clicksignDocKey: ref.documentKey,
            clicksignStatus: status.state,
          },
        ],
        // Uso único: marca o token como usado.
        tokens: s.tokens.map((t) =>
          t.entregaId === entregaId && t.usedAt === null ? { ...t, usedAt: agora } : t,
        ),
      }));
      pushAudit('cliente:token', 'ASSINATURA_REGISTRADA', 'entrega', entregaId, {
        metodo: 'CLICKSIGN',
      });
      await adapters.notification.notificar({
        tipo: 'ASSINATURA_CONCLUIDA',
        para: 'equipe@rottas.com.br',
        entregaId,
      });
      return { ok: true, entregaId };
    },
    [resolverToken, pushAudit],
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

  const criarModelo = useCallback(
    (nome: string, conteudo: string, actorId: string): string => {
      const id = nextId('mod');
      const agora = new Date().toISOString();
      setState((s) => ({
        ...s,
        modelos: [...s.modelos, { id, nome, conteudo, createdAt: agora, updatedAt: agora }],
      }));
      pushAudit(actorId, 'MODELO_CRIADO', 'modelo', id, { nome });
      return id;
    },
    [pushAudit],
  );

  const atualizarModelo = useCallback(
    (id: string, dados: { nome: string; conteudo: string }, actorId: string): void => {
      setState((s) => ({
        ...s,
        modelos: s.modelos.map((m) =>
          m.id === id ? { ...m, ...dados, updatedAt: new Date().toISOString() } : m,
        ),
      }));
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
      avancarEtapa,
      gerarDocumento,
      gerarLinkAssinatura,
      adicionarItem,
      removerItem,
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
      avancarEtapa,
      gerarDocumento,
      gerarLinkAssinatura,
      adicionarItem,
      removerItem,
      resolverToken,
      registrarAssinaturaPorToken,
      definirPapel,
      criarModelo,
      atualizarModelo,
      removerModelo,
    ],
  );

  const value = useMemo<DataContextValue>(() => ({ state, actions }), [state, actions]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>');
  return ctx;
}
