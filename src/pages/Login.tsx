import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogIn } from 'lucide-react';
import { useAuth } from '@/auth/SessionProvider';
import { Button } from '@/components/ui/button';

/** Microsoft logo (4 quadrados) — SVG inline, marca oficial. */
function MicrosoftLogo(): React.JSX.Element {
  return (
    <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function Login(): React.JSX.Element {
  const { mode, status, login, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'authenticated') navigate('/dashboard', { replace: true });
  }, [status, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Chaves na Mão</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesso restrito à equipe da Rottas
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {mode === 'entra' ? (
          <Button className="w-full" size="lg" onClick={login}>
            <MicrosoftLogo />
            Entrar com Microsoft
          </Button>
        ) : (
          <>
            <Button className="w-full" size="lg" onClick={login}>
              <LogIn />
              Entrar (modo desenvolvimento)
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Entra ID não configurado — usando sessão local de demonstração. Configure
              <code className="mx-1 rounded bg-muted px-1">VITE_ENTRA_CLIENT_ID</code>
              para o login real.
            </p>
          </>
        )}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Login exclusivamente via Microsoft Entra ID · sem senha própria
      </p>
    </div>
  );
}
