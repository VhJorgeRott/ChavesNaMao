import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFound(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page-bg px-4 text-center">
      <Compass className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
      <p className="mt-1 text-sm text-muted-foreground">O endereço acessado não existe.</p>
      <Button asChild className="mt-6">
        <Link to="/dashboard">Voltar ao início</Link>
      </Button>
    </div>
  );
}
