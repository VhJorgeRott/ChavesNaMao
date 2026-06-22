import { Badge } from '@/components/ui/badge';
import { ENTREGA_STATUS } from '@/domain/types';
import { indiceEtapa, isTerminal } from '@/domain/state-machine';

/**
 * Tela de fundação (placeholder). As telas reais (Unidades, Entregas, Detalhe,
 * Admin e Portal do cliente) entram nas próximas etapas do roteiro. Aqui apenas
 * confirmamos o scaffold e exibimos a máquina de estados da entrega.
 */
function App(): React.JSX.Element {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Chaves na Mão</h1>
        <p className="mt-2 text-muted-foreground">
          Entrega de chaves ponta a ponta — scaffold de fundação.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Máquina de estados da entrega</h2>
        <ol className="flex flex-wrap items-center gap-2">
          {ENTREGA_STATUS.map((estado) => (
            <li key={estado} className="flex items-center gap-2">
              <Badge variant={isTerminal(estado) ? 'default' : 'secondary'}>
                {indiceEtapa(estado) + 1}. {estado}
              </Badge>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          Transições lineares e validadas (deny-by-default). A verdade é sempre revalidada no
          servidor.
        </p>
      </section>
    </main>
  );
}

export default App;
