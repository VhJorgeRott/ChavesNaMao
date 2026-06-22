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
import { transicionar } from '@/domain/state-machine';
import { UNIDADE_STATUS_LIBERADO_PARA_ENTREGA, type EntregaStatus } from '@/domain/types';
import { buildPortalUrl, generateToken, hashToken, timingSafeEqualHex } from '@/lib/token';
import { env } from '@/lib/env';
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
    },
    [],
  );

  const iniciarEntrega = useCallback(
    async (unidadeId: string, responsavelId: string): Promise<string> => {
      const unidade = stateRef.current.unidades.find((u) => u.id === unidadeId);
      if (!unidade) throw new Error('Unidade não encontrada');
      if (!UNIDADE_STATUS_LIBERADO_PARA_ENTREGA.includes(unidade.status)) {
        throw new Error('Unidade não está liberada para entrega');
      }
      // Carrega o cliente via adapter de CRM (mock no MVP).
      const cliente = await adapters.crm.getClienteByUnidade(unidadeId);
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
    [pushAudit],
  );

  const gerarDocumento = useCallback(
    async (entregaId: string, actorId: string): Promise<void> => {
      const conteudo = `Termo de Entrega de Chaves — ${entregaId} — ${new Date().toISOString()}`;
      const sha256 = await hashToken(conteudo);
      const docId = nextId('doc');
      setState((s) => ({
        ...s,
        documentos: [
          ...s.documentos,
          {
            id: docId,
            entregaId,
            tipo: 'Termo de Entrega de Chaves',
            storagePath: `entregas/${entregaId}/termo-entrega.pdf`,
            sha256Hash: sha256,
            geradoEm: new Date().toISOString(),
          },
        ],
      }));
      pushAudit(actorId, 'DOCUMENTO_GERADO', 'documento', docId, { entregaId });
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

  const actions = useMemo<DataActions>(
    () => ({
      iniciarEntrega,
      avancarEtapa,
      gerarDocumento,
      gerarLinkAssinatura,
      adicionarItem,
      removerItem,
      resolverToken,
      registrarAssinaturaPorToken,
      definirPapel,
    }),
    [
      iniciarEntrega,
      avancarEtapa,
      gerarDocumento,
      gerarLinkAssinatura,
      adicionarItem,
      removerItem,
      resolverToken,
      registrarAssinaturaPorToken,
      definirPapel,
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
