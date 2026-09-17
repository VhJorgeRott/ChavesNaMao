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
import { useSession } from '@/auth/SessionProvider';
import { persistenciaAtiva } from '@/data/persistencia';
import { getSupabase } from '@/lib/supabase';
import { abrirBanco } from './db';
import { RepositorioQualidade } from './repositorio';
import { ErroDeRede, remotoSupabase, sincronizar, urlAssinadaFoto } from './sync';

/**
 * Liga o módulo de Qualidade à sessão: abre o banco local do usuário e mantém
 * a sincronização rodando em segundo plano (ao abrir, ao voltar a internet, ao
 * voltar para a aba, após cada escrita e a cada minuto).
 *
 * Sem Supabase configurado (modo dev), tudo funciona só no aparelho.
 */

export interface StatusSync {
  online: boolean;
  /** false no modo dev: os dados ficam só neste aparelho. */
  servidorConfigurado: boolean;
  sincronizando: boolean;
  pendentes: number;
  comErro: number;
  ultimaSincronizacao: string | null;
  erro: string | null;
}

interface QualidadeContexto {
  repo: RepositorioQualidade | null;
  status: StatusSync;
  sincronizarAgora(): void;
  usuario: { id: string; nome: string };
  /** URL exibível de uma foto: local (blob) ou assinada do Storage. */
  urlFoto(fotoId: string, storagePath: string): Promise<string | null>;
}

const Contexto = createContext<QualidadeContexto | null>(null);

const INTERVALO_MS = 60_000;
const ATRASO_APOS_ESCRITA_MS = 1_500;

export const novoId = (): string => crypto.randomUUID();
export const agoraIso = (): string => new Date().toISOString();

export function QualidadeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { currentUser } = useSession();
  const [repo, setRepo] = useState<RepositorioQualidade | null>(null);
  const [status, setStatus] = useState<StatusSync>({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    servidorConfigurado: persistenciaAtiva,
    sincronizando: false,
    pendentes: 0,
    comErro: 0,
    ultimaSincronizacao: null,
    erro: null,
  });

  const emAndamento = useRef(false);
  const deNovo = useRef(false);
  const timerEscrita = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repoRef = useRef<RepositorioQualidade | null>(null);

  const atualizarContagem = useCallback(async (r: RepositorioQualidade) => {
    const fila = await r.pendentes();
    setStatus((s) => ({
      ...s,
      pendentes: fila.length,
      comErro: fila.filter((p) => p.ultimoErro).length,
    }));
  }, []);

  const executarSync = useCallback(async () => {
    const r = repoRef.current;
    if (!r) return;
    await atualizarContagem(r);
    if (!persistenciaAtiva || !navigator.onLine) return;
    if (emAndamento.current) {
      deNovo.current = true;
      return;
    }
    emAndamento.current = true;
    setStatus((s) => ({ ...s, sincronizando: true }));
    try {
      do {
        deNovo.current = false;
        const resultado = await sincronizar(r.db, remotoSupabase(getSupabase()));
        if (resultado.recebidos > 0) r.notificar();
      } while (deNovo.current);
      setStatus((s) => ({ ...s, erro: null, ultimaSincronizacao: agoraIso() }));
    } catch (e) {
      const msg =
        e instanceof ErroDeRede
          ? 'Sem conexão com o servidor'
          : e instanceof Error
            ? e.message
            : String(e);
      setStatus((s) => ({ ...s, erro: msg }));
    } finally {
      emAndamento.current = false;
      setStatus((s) => ({ ...s, sincronizando: false }));
      await atualizarContagem(r);
    }
  }, [atualizarContagem]);

  // Abre o banco do usuário.
  useEffect(() => {
    let ativo = true;
    void abrirBanco(currentUser.id).then((db) => {
      if (!ativo) return;
      const r = new RepositorioQualidade(db, () => {
        if (timerEscrita.current) clearTimeout(timerEscrita.current);
        timerEscrita.current = setTimeout(() => void executarSync(), ATRASO_APOS_ESCRITA_MS);
      });
      repoRef.current = r;
      setRepo(r);
      void executarSync();
    });
    return () => {
      ativo = false;
      repoRef.current = null;
      if (timerEscrita.current) clearTimeout(timerEscrita.current);
    };
  }, [currentUser.id, executarSync]);

  // Gatilhos de sincronização.
  useEffect(() => {
    const aoMudarRede = () => {
      setStatus((s) => ({ ...s, online: navigator.onLine }));
      if (navigator.onLine) void executarSync();
    };
    const aoVoltarAba = () => {
      if (document.visibilityState === 'visible') void executarSync();
    };
    window.addEventListener('online', aoMudarRede);
    window.addEventListener('offline', aoMudarRede);
    document.addEventListener('visibilitychange', aoVoltarAba);
    const intervalo = setInterval(() => void executarSync(), INTERVALO_MS);
    return () => {
      window.removeEventListener('online', aoMudarRede);
      window.removeEventListener('offline', aoMudarRede);
      document.removeEventListener('visibilitychange', aoVoltarAba);
      clearInterval(intervalo);
    };
  }, [executarSync]);

  const urlFoto = useCallback(
    async (fotoId: string, storagePath: string): Promise<string | null> => {
      const local = await repoRef.current?.obterFoto(fotoId);
      if (local?.blob) return URL.createObjectURL(local.blob);
      if (!persistenciaAtiva || !navigator.onLine) return null;
      return urlAssinadaFoto(getSupabase(), storagePath);
    },
    [],
  );

  const valor = useMemo<QualidadeContexto>(
    () => ({
      repo,
      status,
      sincronizarAgora: () => void executarSync(),
      usuario: { id: currentUser.id, nome: currentUser.nome },
      urlFoto,
    }),
    [repo, status, executarSync, currentUser.id, currentUser.nome, urlFoto],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useQualidade(): QualidadeContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useQualidade deve ser usado dentro de <QualidadeProvider>');
  return ctx;
}

/**
 * Consulta reativa ao banco local: roda `consulta` ao montar e a cada escrita
 * (local ou recebida da sincronização).
 */
export function useConsultaQualidade<T>(
  consulta: (repo: RepositorioQualidade) => Promise<T>,
  deps: readonly unknown[],
): { dados: T | null; carregando: boolean } {
  const { repo } = useQualidade();
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const consultaRef = useRef(consulta);
  consultaRef.current = consulta;

  useEffect(() => {
    if (!repo) return;
    let ativo = true;
    const rodar = () => {
      void consultaRef.current(repo).then((d) => {
        if (!ativo) return;
        setDados(d);
        setCarregando(false);
      });
    };
    rodar();
    const cancelar = repo.assinar(rodar);
    return () => {
      ativo = false;
      cancelar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, ...deps]);

  return { dados, carregando };
}
