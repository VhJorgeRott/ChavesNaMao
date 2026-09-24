import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus } from 'lucide-react';
import { type InspecaoFvs, descreverLocal, progressoInspecao } from '@chaves/domain/qualidade';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusSincronizacao } from '@/components/qualidade/StatusSincronizacao';
import { NovaInspecaoDialog } from '@/components/qualidade/NovaInspecaoDialog';
import { InspecaoStatusBadge } from '@/components/qualidade/badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CartoesSkeleton } from '@/components/shared/skeletons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConsultaQualidade } from '@/qualidade/QualidadeProvider';
import { fDataHora } from '@chaves/domain/format';
import { cn, normalizarBusca } from '@/lib/utils';

const TODOS = '__todos__';
type FiltroSituacao = typeof TODOS | 'em_andamento' | 'aprovada' | 'reprovada';

const SITUACOES: { valor: FiltroSituacao; label: string }[] = [
  { valor: TODOS, label: 'Todas' },
  { valor: 'em_andamento', label: 'Em andamento' },
  { valor: 'reprovada', label: 'Reprovadas' },
  { valor: 'aprovada', label: 'Aprovadas' },
];

function situacaoDe(i: InspecaoFvs): Exclude<FiltroSituacao, typeof TODOS> {
  return i.status === 'em_andamento' ? 'em_andamento' : (i.resultado ?? 'aprovada');
}

export function Inspecoes(): React.JSX.Element {
  const navigate = useNavigate();
  const [nova, setNova] = useState(false);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<FiltroSituacao>(TODOS);
  const [empreendimento, setEmpreendimento] = useState(TODOS);

  const { dados, carregando } = useConsultaQualidade(
    async (r) => ({ inspecoes: await r.listarInspecoes(), modelos: await r.listarModelos() }),
    [],
  );
  const inspecoes = useMemo(() => dados?.inspecoes ?? [], [dados]);
  const modelos = dados?.modelos ?? [];

  const contagem = useMemo(() => {
    const c: Record<FiltroSituacao, number> = {
      [TODOS]: 0,
      em_andamento: 0,
      aprovada: 0,
      reprovada: 0,
    };
    for (const i of inspecoes) {
      c[TODOS] += 1;
      c[situacaoDe(i)] += 1;
    }
    return c;
  }, [inspecoes]);

  const empreendimentos = useMemo(
    () =>
      [...new Map(inspecoes.map((i) => [i.local.empreendimentoRef, i.local.empreendimentoNome]))]
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [inspecoes],
  );

  const filtradas = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    return inspecoes
      .filter((i) => situacao === TODOS || situacaoDe(i) === situacao)
      .filter((i) => empreendimento === TODOS || i.local.empreendimentoRef === empreendimento)
      .filter(
        (i) =>
          !q ||
          [i.modeloNome, i.modeloCodigo, descreverLocal(i.local), i.inspetorNome].some((c) =>
            normalizarBusca(c).includes(q),
          ),
      )
      .sort(
        (a, b) =>
          Number(b.status === 'em_andamento') - Number(a.status === 'em_andamento') ||
          b.iniciadaEm.localeCompare(a.iniciadaEm),
      );
  }, [inspecoes, busca, situacao, empreendimento]);

  const semModelo = !carregando && modelos.filter((m) => m.ativo).length === 0;

  const botaoNova = (
    <Button
      onClick={() => (semModelo ? navigate('/qualidade/modelos') : setNova(true))}
      disabled={carregando}
    >
      <Plus />
      Nova inspeção
    </Button>
  );

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        titulo="Inspeções (FVS)"
        subtitulo="Verificação de serviços em campo — funciona sem internet"
        actions={
          <>
            <StatusSincronizacao />
            {botaoNova}
          </>
        }
      />
      <PageContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {SITUACOES.map((s) => (
            <button
              key={s.valor}
              type="button"
              onClick={() => setSituacao(s.valor)}
              aria-pressed={situacao === s.valor}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                situacao === s.valor
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
              )}
            >
              {s.label} <span className="ml-1 opacity-70">{contagem[s.valor]}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="md:max-w-sm md:flex-1">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar ficha, local, inspetor..."
            />
          </div>
          <Select value={empreendimento} onValueChange={setEmpreendimento}>
            <SelectTrigger className="md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os empreendimentos</SelectItem>
              {empreendimentos.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {carregando ? (
          <CartoesSkeleton />
        ) : filtradas.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={ClipboardCheck}
                titulo={
                  inspecoes.length === 0 ? 'Nenhuma inspeção ainda' : 'Nenhuma inspeção encontrada'
                }
                descricao={
                  semModelo
                    ? 'Cadastre um modelo de FVS para começar a inspecionar.'
                    : inspecoes.length === 0
                      ? 'Inicie a primeira inspeção. Ela fica salva no aparelho mesmo sem internet.'
                      : 'Ajuste a busca ou os filtros.'
                }
              >
                {inspecoes.length === 0 && botaoNova}
              </EmptyState>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtradas.map((i) => {
              const p = progressoInspecao(i);
              const pct = p.total === 0 ? 0 : Math.round((p.respondidos / p.total) * 100);
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => navigate(`/qualidade/inspecoes/${i.id}`)}
                  className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40 md:flex-row md:items-center md:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {i.reinspecaoDe && (
                        <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
                          Reinspeção
                        </span>
                      )}
                      {i.modeloCodigo ? `${i.modeloCodigo} · ` : ''}
                      {i.modeloNome}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {descreverLocal(i.local)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {i.inspetorNome} · {fDataHora(i.concluidaEm ?? i.iniciadaEm)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 md:w-72 md:justify-end">
                    {i.status === 'em_andamento' ? (
                      <div className="flex flex-1 items-center gap-2 md:max-w-40">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {p.respondidos}/{p.total}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {p.conformidade === null ? '—' : `${p.conformidade}% conforme`}
                        {p.naoConformes > 0 && ` · ${p.naoConformes} NC`}
                      </span>
                    )}
                    <InspecaoStatusBadge inspecao={i} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PageContent>

      <NovaInspecaoDialog aberto={nova} onOpenChange={setNova} modelos={modelos} />
    </>
  );
}
