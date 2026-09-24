import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LayoutGrid, RefreshCw, TriangleAlert } from 'lucide-react';
import { fNum } from '@chaves/domain/format';
import { useData } from '@/data/DataProvider';
import { listarUnidades } from '@/data/selectors';
import { cn } from '@/lib/utils';
import type { Empreendimento } from '@chaves/domain/types';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function Unidades(): React.JSX.Element {
  const { state, actions } = useData();
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  // Parte do que já está em cache: revisitar a tela não mostra esqueleto nem
  // espera a rede. `garantirEmpreendimentos` só vai ao CRM se o cache envelheceu.
  const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>(state.empreendimentos);
  const [carregando, setCarregando] = useState(state.empreendimentos.length === 0);
  const [erro, setErro] = useState<string | null>(null);

  const { garantirEmpreendimentos, garantirUnidades } = actions;
  useEffect(() => {
    let ativo = true;
    garantirEmpreendimentos()
      .then((lista) => {
        if (!ativo) return;
        setEmpreendimentos(lista);
        setErro(null);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar empreendimentos');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [garantirEmpreendimentos]);

  // O cache vale 2h; o botão força a releitura do catálogo inteiro. Em série,
  // como o prefetch pós-login: são consultas pesadas à view do Mega.
  const [atualizando, setAtualizando] = useState(false);
  async function atualizar(): Promise<void> {
    setAtualizando(true);
    try {
      const lista = await garantirEmpreendimentos({ forcar: true });
      setEmpreendimentos(lista);
      setErro(null);
      for (const emp of lista) {
        await garantirUnidades(emp, { forcar: true }).catch((e: unknown) =>
          console.warn(`[unidades] atualizar ${emp.nome}:`, e),
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar empreendimentos');
    } finally {
      setAtualizando(false);
    }
  }

  const [tab, setTab] = useState<'todos' | 'com'>('todos');

  // Mesmas regras dos KPIs do detalhe (EmpreendimentoUnidades), para o card
  // bater com a tela que ele abre.
  const metricas = useMemo(() => {
    const mapa = new Map<string, Metricas>();
    for (const { unidade: u, entregaAtiva } of listarUnidades(state)) {
      const m = mapa.get(u.empreendimentoId) ?? {
        unidades: 0,
        vendidas: 0,
        disponiveis: 0,
        inadimplentes: 0,
        entregasIniciadas: 0,
      };
      m.unidades++;
      if (u.status === 'VENDIDA') m.vendidas++;
      if (u.status === 'DISPONIVEL') m.disponiveis++;
      if (u.inadimplente === true) m.inadimplentes++;
      if (entregaAtiva) m.entregasIniciadas++;
      mapa.set(u.empreendimentoId, m);
    }
    return mapa;
  }, [state]);

  const buscados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empreendimentos
      .map((emp) => ({ emp, m: metricas.get(emp.id) ?? VAZIO }))
      .filter(({ emp }) => !q || `${emp.nome} ${emp.cidade} ${emp.uf}`.toLowerCase().includes(q));
  }, [empreendimentos, metricas, busca]);
  const comDisponiveis = buscados.filter(({ m }) => m.disponiveis > 0);
  const cards = tab === 'com' ? comDisponiveis : buscados;

  return (
    <>
      <PageHeader
        icon={Building2}
        titulo="Empreendimentos"
        subtitulo="Selecione um empreendimento para abrir a disponibilidade"
        actions={
          <Button variant="outline" onClick={() => void atualizar()} disabled={atualizando}>
            <RefreshCw className={atualizando ? 'animate-spin' : undefined} />
            Atualizar
          </Button>
        }
      />
      <PageContent>
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="min-w-[260px] flex-1">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por nome ou cidade..."
            />
          </div>
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(
              [
                ['todos', `Todos (${buscados.length})`],
                ['com', `Com disponíveis (${comDisponiveis.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'h-[30px] rounded-lg px-3 text-[13px] font-medium transition-colors',
                  tab === id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {erro && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {erro}
          </div>
        )}

        {carregando ? (
          <div className={GRID}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="flex flex-col overflow-hidden rounded-xl" aria-busy="true">
                <Skeleton className="h-[180px] w-full rounded-none" />
                <div className="flex flex-col gap-2 px-4 pb-3.5 pt-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                  <div className="mt-1 flex flex-col gap-2.5">
                    {[0, 1].map((j) => (
                      <div key={j} className="flex flex-col gap-1.5">
                        <div className="flex justify-between">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-1.5 w-full rounded-full" />
                      </div>
                    ))}
                    <Skeleton className="h-[58px] w-full rounded-[10px]" />
                  </div>
                </div>
                <div className="flex h-10 items-center justify-center border-t border-muted">
                  <Skeleton className="h-3.5 w-36" />
                </div>
              </Card>
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Building2 className="h-12 w-12 text-slate-400" />
            <p className="text-[15px] font-semibold text-foreground">Nenhum empreendimento</p>
            <p className="text-[13px] text-muted-foreground">Ajuste a busca ou o filtro.</p>
          </div>
        ) : (
          <div className={GRID}>
            {cards.map(({ emp, m }) => (
              <EmpreendimentoCard
                key={emp.id}
                emp={emp}
                m={m}
                onAbrir={() => navigate(`/unidades/${emp.id}`)}
              />
            ))}
          </div>
        )}
      </PageContent>
    </>
  );
}

interface Metricas {
  unidades: number;
  vendidas: number;
  disponiveis: number;
  inadimplentes: number;
  entregasIniciadas: number;
}

const VAZIO: Metricas = {
  unidades: 0,
  vendidas: 0,
  disponiveis: 0,
  inadimplentes: 0,
  entregasIniciadas: 0,
};
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4';
const n0 = (v: number): string => fNum(v, 0);

function situacaoCores(situacao: string): { bg: string; color: string } {
  return /finaliz|conclu/i.test(situacao)
    ? { bg: 'rgba(34,197,94,.15)', color: '#15803d' }
    : { bg: '#f29f0526', color: '#b36f00' };
}

function Barra({
  label,
  valor,
  base,
  cor,
}: {
  label: string;
  valor: number;
  base: number;
  cor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">
            {base ? `${Math.round((valor / base) * 100)}%` : '-'}
          </span>
          <span className="text-muted-foreground">
            {' '}
            · {n0(valor)}/{n0(base)}
          </span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: base ? `${Math.min(100, (valor / base) * 100)}%` : 0,
            backgroundColor: cor,
          }}
        />
      </div>
    </div>
  );
}

function EmpreendimentoCard({
  emp,
  m,
  onAbrir,
}: {
  emp: Empreendimento;
  m: Metricas;
  onAbrir: () => void;
}): React.JSX.Element {
  const contadores = [
    { label: 'Unidades', valor: m.unidades, cor: undefined },
    {
      label: 'Disponíveis',
      valor: m.disponiveis,
      cor: m.disponiveis > 0 ? 'text-[#b36f00]' : undefined,
    },
    {
      label: 'Inadimplentes',
      valor: m.inadimplentes,
      cor: m.inadimplentes > 0 ? 'text-destructive' : undefined,
    },
  ];
  return (
    // O card todo abre a disponibilidade; o botão do rodapé só dá o foco de
    // teclado (o clique dele sobe até aqui).
    <Card
      onClick={onAbrir}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl transition-shadow duration-150 hover:shadow-md"
    >
      <div className="h-[180px] bg-muted">
        {emp.foto ? (
          <img
            src={emp.foto}
            alt={emp.nome}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Building2 className="h-12 w-12 text-slate-400" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-3.5 pt-4">
        <div className="flex items-center gap-2">
          <h3
            className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-[.2px] text-foreground"
            title={emp.nome}
          >
            {emp.nome}
          </h3>
          {emp.situacaoObra && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: situacaoCores(emp.situacaoObra).bg,
                color: situacaoCores(emp.situacaoObra).color,
              }}
            >
              {emp.situacaoObra}
            </span>
          )}
        </div>
        <p className="text-xs uppercase tracking-[.3px] text-muted-foreground">
          {emp.cidade}
          {emp.uf ? `/${emp.uf}` : ''}
        </p>

        <div className="mt-1 flex flex-col gap-2.5">
          <Barra label="Vendidas" valor={m.vendidas} base={m.unidades} cor="#f29f05" />
          <Barra
            label="Entregas iniciadas"
            valor={m.entregasIniciadas}
            base={m.vendidas}
            cor="#22c55e"
          />
          <div className="grid grid-cols-3 rounded-[10px] border border-muted">
            {contadores.map((c, i) => (
              <div
                key={c.label}
                className={cn('min-w-0 px-2.5 py-2', i > 0 && 'border-l border-muted')}
              >
                <p className="truncate text-[11px] text-muted-foreground">{c.label}</p>
                <p className={cn('text-[15px] font-bold tabular-nums text-foreground', c.cor)}>
                  {n0(c.valor)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="flex h-10 w-full items-center justify-center gap-2 border-t border-muted bg-card text-[13px] font-medium text-slate-600 transition-colors group-hover:bg-[#fff7e8] group-hover:text-[#b36f00] dark:text-muted-foreground dark:group-hover:bg-primary/10"
      >
        <LayoutGrid className="h-4 w-4" />
        Abrir disponibilidade
      </button>
    </Card>
  );
}
