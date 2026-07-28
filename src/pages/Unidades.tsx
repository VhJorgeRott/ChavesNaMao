import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, TriangleAlert } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { UNIDADE_STATUS_VISIVEIS, type Empreendimento } from '@chaves/domain/types';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  const { garantirEmpreendimentos } = actions;
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

  const cards = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empreendimentos
      .map((emp) => {
        const unidades = state.unidades.filter(
          (u) => u.empreendimentoId === emp.id && UNIDADE_STATUS_VISIVEIS.includes(u.status),
        );
        return { emp, total: unidades.length };
      })
      .filter(({ emp }) => !q || `${emp.nome} ${emp.cidade} ${emp.uf}`.toLowerCase().includes(q));
  }, [empreendimentos, state.unidades, busca]);

  return (
    <>
      <PageHeader
        icon={Building2}
        titulo="Unidades"
        subtitulo="Selecione um empreendimento para abrir a disponibilidade"
      />
      <PageContent>
        <div className="mb-5 md:max-w-sm">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar empreendimento..." />
        </div>

        {erro && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {erro}
          </div>
        )}

        {carregando ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-32 w-full rounded-none" />
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : cards.length === 0 ? (
          <EmptyState
            icon={Building2}
            titulo="Nenhum empreendimento encontrado"
            descricao="Ajuste a busca para ver outros empreendimentos."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ emp, total }) => {
              return (
                <Card key={emp.id} className="flex flex-col overflow-hidden">
                  {/* O card é só identificação e porta de entrada. A contagem
                      por status foi retirada daqui: ela vive na tela do
                      empreendimento, onde há contexto para agir sobre ela. */}
                  <div className="relative h-32">
                    {emp.foto ? (
                      <img
                        src={emp.foto}
                        alt={emp.nome}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/80 to-primary">
                        <Building2 className="h-14 w-14 text-primary-foreground/30" />
                      </div>
                    )}
                  </div>
                  <CardContent className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <h3 className="font-semibold leading-tight text-foreground">{emp.nome}</h3>
                      <p className="text-xs text-muted-foreground">
                        {emp.cidade}
                        {emp.uf ? `/${emp.uf}` : ''}
                        {total > 0 && ` · ${total} unidade(s)`}
                        {emp.situacaoObra ? ` · ${emp.situacaoObra}` : ''}
                      </p>
                    </div>
                    <Button
                      className="mt-auto w-full"
                      onClick={() => navigate(`/unidades/${emp.id}`)}
                    >
                      Abrir disponibilidade
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageContent>
    </>
  );
}
