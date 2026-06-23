import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/data/DataProvider';
import { useSession } from '@/auth/SessionProvider';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fData } from '@/lib/format';
import type { ModeloTermo } from '@/domain/types';

export function Modelos(): React.JSX.Element {
  const { state, actions } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();
  const [excluir, setExcluir] = useState<ModeloTermo | null>(null);

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
        {state.modelos.length === 0 ? (
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {state.modelos.map((m) => (
              <Card key={m.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-tight text-foreground">{m.nome}</h3>
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                  </div>
                  <p className="line-clamp-3 flex-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {m.conteudo}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Atualizado em {fData(m.updatedAt)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/modelos/${m.id}`)}
                    >
                      <Pencil />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir modelo"
                      onClick={() => setExcluir(m)}
                    >
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

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
