import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { SearchInput } from '@/components/shared/SearchInput';
import { StatusSincronizacao } from '@/components/qualidade/StatusSincronizacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  agoraIso,
  novoId,
  useConsultaQualidade,
  useQualidade,
} from '@/qualidade/QualidadeProvider';
import { modeloExemploAlvenaria } from '@/qualidade/exemplos';
import { normalizarBusca as normalizar } from '@/lib/utils';
import { fData } from '@chaves/domain/format';

export function ModelosFvs(): React.JSX.Element {
  const navigate = useNavigate();
  const { repo } = useQualidade();
  const [busca, setBusca] = useState('');
  const { dados: modelos, carregando } = useConsultaQualidade((r) => r.listarModelos(), []);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return (modelos ?? [])
      .filter((m) => !q || [m.nome, m.codigo, m.servico].some((c) => normalizar(c).includes(q)))
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [modelos, busca]);

  async function criarExemplo() {
    if (!repo) return;
    await repo.salvarModelo(modeloExemploAlvenaria(novoId(), agoraIso()));
    toast.success('Modelo de exemplo criado');
  }

  const novo = (
    <Button onClick={() => navigate('/qualidade/modelos/novo')}>
      <Plus />
      Novo modelo
    </Button>
  );

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        titulo="Modelos de FVS"
        subtitulo="Fichas de verificação de serviço usadas nas inspeções"
        actions={
          <>
            <StatusSincronizacao />
            {novo}
          </>
        }
      />
      <PageContent>
        {carregando ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                aria-busy="true"
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
              >
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : (modelos ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={ClipboardList}
                titulo="Nenhum modelo de FVS"
                descricao="Crie o primeiro modelo, use o exemplo de alvenaria para conhecer o fluxo, ou importe os modelos do Mobuss (em breve)."
              >
                <div className="flex flex-wrap justify-center gap-2">
                  {novo}
                  <Button variant="outline" onClick={() => void criarExemplo()}>
                    <Sparkles />
                    Usar exemplo
                  </Button>
                </div>
              </EmptyState>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-4 max-w-sm">
              <SearchInput
                value={busca}
                onChange={setBusca}
                placeholder="Buscar modelo ou serviço..."
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtrados.map((m) => {
                const itens = m.estrutura.secoes.reduce((s, sec) => s + sec.itens.length, 0);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => navigate(`/qualidade/modelos/${m.id}`)}
                    className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground">{m.nome}</p>
                      {!m.ativo && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[m.codigo, m.servico].filter(Boolean).join(' · ') || 'Sem código'}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {m.estrutura.secoes.length} seção(ões) · {itens} item(ns) · v{m.versao} ·
                      atualizado em {fData(m.atualizadoEm)}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </PageContent>
    </>
  );
}
