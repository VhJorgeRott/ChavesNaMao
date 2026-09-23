import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  Braces,
  Copy,
  FileText,
  FileX,
  Loader2,
  Landmark,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/data/DataProvider';
import { useSession } from '@/auth/SessionProvider';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { FiltroDropdown } from '@/components/shared/FiltroDropdown';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fData } from '@chaves/domain/format';
import { MODALIDADES_MODELO, TIPOS_MODELO, type ModeloTermo } from '@chaves/domain/types';
import { classificarModelo } from '@/lib/modelos';
import { n0 } from '@/lib/numeros';
import { cn } from '@/lib/utils';

const TODOS = 'todos';
type Ordem = 'recente' | 'nome';

/** Badge em pílula dos cards (tipo, modalidade, padrão). */
function Pilula({ children, destaque = false }: { children: React.ReactNode; destaque?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        destaque
          ? 'bg-primary/15 text-[#b45309] dark:text-primary'
          : 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

/** Texto com as variáveis {{...}} destacadas em azul/monospace. */
function ComVariaveis({ texto }: { texto: string }): React.JSX.Element {
  return (
    <>
      {texto.split(/(\{\{[^}]+\}\})/).map((t, i) =>
        t.startsWith('{{') ? (
          <code
            key={i}
            className="rounded bg-blue-500/[0.12] px-1 py-px font-mono text-xs text-[#1d4ed8] dark:text-blue-300"
          >
            {t}
          </code>
        ) : (
          t
        ),
      )}
    </>
  );
}

export function Modelos(): React.JSX.Element {
  const { state, actions, carregandoPersistidos } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();
  const [excluir, setExcluir] = useState<ModeloTermo | null>(null);
  const [duplicando, setDuplicando] = useState<ModeloTermo | null>(null);
  const [salvandoCopia, setSalvandoCopia] = useState(false);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState(TODOS);
  const [modalidade, setModalidade] = useState(TODOS);
  const [ordem, setOrdem] = useState<Ordem>('recente');

  const modelos = useMemo(
    () => state.modelos.map((m) => ({ ...m, ...classificarModelo(m) })),
    [state.modelos],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return modelos
      .filter(
        (m) =>
          (tipo === TODOS || m.tipo === tipo) &&
          (modalidade === TODOS || m.modalidade === modalidade) &&
          (!q || `${m.nome} ${m.conteudo}`.toLowerCase().includes(q)),
      )
      .sort((a, b) =>
        ordem === 'nome'
          ? a.nome.localeCompare(b.nome, 'pt-BR')
          : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [modelos, busca, tipo, modalidade, ordem]);

  // "Limpar" não mexe na ordenação: ela não filtra nada.
  const filtrosAtivos = busca.trim() !== '' || tipo !== TODOS || modalidade !== TODOS;
  const limparFiltros = (): void => {
    setBusca('');
    setTipo(TODOS);
    setModalidade(TODOS);
  };

  async function confirmarDuplicacao() {
    const m = duplicando;
    if (!m) return;
    setSalvandoCopia(true);
    try {
      await actions.criarModelo(
        { nome: `${m.nome} (cópia)`, conteudo: m.conteudo, tipo: m.tipo, modalidade: m.modalidade },
        currentUser.id,
      );
      toast.success('Modelo duplicado', { description: m.nome });
      setDuplicando(null);
    } catch (e) {
      toast.error('Não foi possível duplicar o modelo', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSalvandoCopia(false);
    }
  }

  function confirmarExclusao() {
    if (!excluir) return;
    actions.removerModelo(excluir.id, currentUser.id);
    toast.success('Modelo excluído', { description: excluir.nome });
    setExcluir(null);
  }

  return (
    <>
      <PageHeader
        icon={FileText}
        titulo="Modelos de termo"
        subtitulo="Crie modelos com variáveis que puxam os dados na geração do termo"
        actions={
          <Button onClick={() => navigate('/modelos/novo')}>
            <Plus />
            Novo modelo
          </Button>
        }
      />
      <PageContent>
        {carregandoPersistidos && state.modelos.length === 0 ? (
          <ModelosSkeleton />
        ) : state.modelos.length === 0 ? (
          <EmptyState
            icon={FileText}
            titulo="Nenhum modelo cadastrado"
            descricao="Crie o primeiro modelo de termo com variáveis."
          >
            <Button onClick={() => navigate('/modelos/novo')}>
              <Plus />
              Novo modelo
            </Button>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="min-w-0 flex-[1_1_280px]">
                <SearchInput
                  value={busca}
                  onChange={setBusca}
                  placeholder="Buscar por nome, título ou variável..."
                />
              </div>
              <FiltroDropdown
                icon={Tag}
                label="Tipo"
                padrao={TODOS}
                valor={tipo}
                onChange={setTipo}
                opcoes={[
                  { valor: TODOS, label: 'Todos os tipos' },
                  ...TIPOS_MODELO.map((t) => ({ valor: t, label: t })),
                ]}
              />
              <FiltroDropdown
                icon={Landmark}
                label="Modalidade"
                padrao={TODOS}
                valor={modalidade}
                onChange={setModalidade}
                opcoes={[
                  { valor: TODOS, label: 'Todas' },
                  ...MODALIDADES_MODELO.map((m) => ({ valor: m, label: m })),
                ]}
              />
              <FiltroDropdown
                icon={ArrowUpDown}
                label="Ordenar"
                padrao="recente"
                valor={ordem}
                onChange={(v) => setOrdem(v as Ordem)}
                opcoes={[
                  { valor: 'recente', label: 'Mais recentes' },
                  { valor: 'nome', label: 'Nome (A–Z)' },
                ]}
              />
              {filtrosAtivos && (
                <Button variant="ghost" onClick={limparFiltros} className="text-muted-foreground">
                  <X />
                  Limpar
                </Button>
              )}
            </div>

            <span className="text-[13px] text-muted-foreground">
              {filtrosAtivos
                ? `${n0(filtrados.length)} de ${n0(modelos.length)} modelos`
                : `${n0(modelos.length)} modelos`}
            </span>

            {filtrados.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-card px-6 py-12 text-center dark:border-border">
                <FileX className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
                <span className="text-sm font-semibold text-foreground">
                  Nenhum modelo encontrado
                </span>
                <span className="text-[13px] text-muted-foreground">
                  Ajuste os filtros ou crie um novo modelo.
                </span>
                <Button variant="outline" className="mt-2" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
                {filtrados.map((m) => (
                  <article
                    key={m.id}
                    className="flex min-w-0 flex-col gap-3.5 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {m.tipo && <Pilula>{m.tipo}</Pilula>}
                        <Pilula>{m.modalidade}</Pilula>
                        {m.padrao && <Pilula destaque>Padrão</Pilula>}
                      </div>
                      <h2 className="text-base font-semibold leading-snug text-foreground [text-wrap:pretty]">
                        {m.nome}
                      </h2>
                    </div>

                    <div className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-slate-50 p-3 dark:bg-muted/40">
                      <span className="text-[11px] font-semibold uppercase leading-snug tracking-[0.04em] text-slate-600 dark:text-muted-foreground">
                        {m.titulo}
                      </span>
                      <p className="line-clamp-2 text-[13px] leading-normal text-slate-600 dark:text-muted-foreground">
                        <ComVariaveis texto={m.corpo} />
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Braces className="h-3.5 w-3.5" />
                        {m.variaveis} {m.variaveis === 1 ? 'variável' : 'variáveis'}
                      </span>
                      <span>Atualizado em {fData(m.updatedAt)}</span>
                    </div>

                    <div className="flex items-center gap-2 border-t border-border pt-3.5">
                      <Button
                        variant="outline"
                        className="h-9 flex-1 hover:border-primary hover:bg-primary hover:text-white"
                        onClick={() => navigate(`/modelos/${m.id}`)}
                      >
                        <Pencil />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground"
                        title="Duplicar"
                        aria-label={`Duplicar ${m.nome}`}
                        onClick={() => setDuplicando(m)}
                      >
                        <Copy />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
                        title="Excluir"
                        aria-label={`Excluir ${m.nome}`}
                        onClick={() => setExcluir(m)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </PageContent>

      <Dialog
        open={duplicando !== null}
        onOpenChange={(v) => !v && !salvandoCopia && setDuplicando(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicar modelo</DialogTitle>
            <DialogDescription>
              Será criada uma cópia de "{duplicando?.nome}" com o nome "{duplicando?.nome} (cópia)".
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicando(null)} disabled={salvandoCopia}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmarDuplicacao()} disabled={salvandoCopia}>
              {salvandoCopia ? <Loader2 className="animate-spin" /> : <Copy />}
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluir !== null} onOpenChange={(v) => !v && setExcluir(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir modelo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{excluir?.nome}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluir(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao}>
              <Trash2 />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ModelosSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-4 w-24" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-[74px] w-full rounded-[10px]" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex gap-2 border-t border-border pt-3.5">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
