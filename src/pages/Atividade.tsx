import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { toast } from 'sonner';
import { adapters, type AtividadeFiltro } from '@/adapters';
import type { AppUser, AuditEntry } from '@/domain/types';
import { PAPEL_META } from '@/domain/status';
import {
  descreverAtividade,
  metaDaAtividade,
  TIPO_ATIVIDADE_META,
  type TipoAtividade,
} from '@/domain/atividade';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fDataHora } from '@/lib/format';

const TODOS = '__todos__';
const TIPOS: TipoAtividade[] = ['login', 'navegacao', 'acao'];
const TAMANHO = 20;

export function Atividade(): React.JSX.Element {
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState<AppUser | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    void adapters.admin
      .getUsuarios()
      .then((us) => ativo && setUsuarios(us))
      .catch((e) => {
        if (ativo) toast.error(e instanceof Error ? e.message : 'Falha ao carregar os usuários');
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        icon={Activity}
        titulo="Atividade"
        subtitulo="Usuários da plataforma. Clique em um usuário para ver o histórico dele."
      />
      <PageContent>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium">Papel</th>
                  <th className="px-4 py-3 text-left font-medium max-md:hidden">Última atividade</th>
                  <th className="px-4 py-3 text-right font-medium">Atividade</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3" colSpan={4}>
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        icon={History}
                        titulo="Nenhum usuário"
                        descricao="Nenhum usuário encontrado na plataforma."
                      />
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr
                      key={u.id}
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/30"
                      onClick={() => setSelecionado(u)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            nome={u.nome}
                            avatarUrl={u.avatarUrl}
                            className="h-9 w-9 text-[11px]"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{u.nome}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.papel === 'admin' ? 'default' : 'outline'}>
                          {PAPEL_META[u.papel].label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-md:hidden">
                        {fDataHora(u.ultimaAtividade)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelecionado(u);
                          }}
                        >
                          Ver atividade
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </PageContent>

      <Dialog open={selecionado !== null} onOpenChange={(v) => !v && setSelecionado(null)}>
        <DialogContent className="max-w-2xl">
          {selecionado && <PainelAtividade usuario={selecionado} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Detalhe de atividade de um usuário: filtros + paginação server-side. */
function PainelAtividade({ usuario }: { usuario: AppUser }): React.JSX.Element {
  const [tipo, setTipo] = useState<string>(TODOS);
  const [rota, setRota] = useState('');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [pagina, setPagina] = useState(0);

  const [itens, setItens] = useState<AuditEntry[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Filtros derivados para o fetch — chaves ausentes são omitidas (não `undefined`,
  // por causa do exactOptionalPropertyTypes).
  const filtro = useMemo<AtividadeFiltro>(() => {
    const f: AtividadeFiltro = { actor: usuario.id, pagina, tamanho: TAMANHO };
    if (tipo !== TODOS) f.tipo = tipo as TipoAtividade;
    const r = rota.trim();
    if (r) f.rota = r;
    if (dataDe) f.dataDe = `${dataDe}T00:00:00`;
    if (dataAte) f.dataAte = `${dataAte}T23:59:59.999`;
    return f;
  }, [usuario.id, tipo, rota, dataDe, dataAte, pagina]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    void adapters.admin
      .getAtividade(filtro)
      .then((res) => {
        if (!ativo) return;
        setItens(res.itens);
        setTemMais(res.temMais);
      })
      .catch((e) => {
        if (ativo) toast.error(e instanceof Error ? e.message : 'Falha ao carregar a atividade');
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [filtro]);

  // Qualquer troca de filtro volta para a primeira página.
  function comReset<T>(setter: (v: T) => void): (v: T) => void {
    return (v) => {
      setter(v);
      setPagina(0);
    };
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <UserAvatar nome={usuario.nome} avatarUrl={usuario.avatarUrl} className="h-9 w-9 text-[11px]" />
          <div className="min-w-0">
            <p className="truncate">{usuario.nome}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{usuario.email}</p>
          </div>
        </DialogTitle>
      </DialogHeader>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select value={tipo} onValueChange={comReset(setTipo)}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os tipos</SelectItem>
            {TIPOS.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_ATIVIDADE_META[t].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SearchInput value={rota} onChange={comReset(setRota)} placeholder="Buscar por tela/rota..." />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          De
          <Input type="date" value={dataDe} onChange={(e) => comReset(setDataDe)(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Até
          <Input type="date" value={dataAte} onChange={(e) => comReset(setDataAte)(e.target.value)} />
        </label>
      </div>

      {/* Feed */}
      <div className="max-h-[45vh] min-h-[220px] overflow-y-auto rounded-lg border border-border">
        {carregando ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : itens.length === 0 ? (
          <EmptyState
            icon={History}
            titulo="Nenhuma atividade"
            descricao="Ajuste os filtros ou aguarde novos eventos."
          />
        ) : (
          <ul className="divide-y divide-border">
            {itens.map((e) => {
              const meta = metaDaAtividade(e.action);
              const cor = TIPO_ATIVIDADE_META[meta.tipo].color;
              const Icon = meta.icon;
              return (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${cor}26`, color: cor }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {descreverAtividade(e)}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{fDataHora(e.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Página {pagina + 1}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === 0 || carregando}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!temMais || carregando}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
            <ChevronRight />
          </Button>
        </div>
      </div>
    </>
  );
}
