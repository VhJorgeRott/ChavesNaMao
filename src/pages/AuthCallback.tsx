import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/auth/SessionProvider';
import { exchangeCode } from '@/auth/entra';
import { Button } from '@/components/ui/button';

/**
 * Destino do redirect OAuth (Supabase → app). Troca o `?code=` por sessão de
 * forma explícita, espera o status assentar (evitando corrida com o RequireAuth)
 * e exibe qualquer erro em vez de voltar silenciosamente ao login.
 */
export function AuthCallback(): React.JSX.Element {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(true);
  const [trocaOk, setTrocaOk] = useState(false);
  const jaTrocou = useRef(false);

  // Passo 1: trocar o code (ou capturar erro do provedor) — uma única vez.
  useEffect(() => {
    if (jaTrocou.current) return;
    jaTrocou.current = true;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const errDesc = params.get('error_description') ?? params.get('error');
      const code = params.get('code');
      if (errDesc) {
        setErro(errDesc);
        setTrocando(false);
        return;
      }
      if (code) {
        const msg = await exchangeCode(code);
        if (msg) setErro(msg);
        else setTrocaOk(true);
        // limpa o code da URL para não reprocessar em reloads
        window.history.replaceState({}, '', '/auth/callback');
      }
      setTrocando(false);
    })();
  }, []);

  // Passo 2: encaminhar pelo status. Se a troca deu certo, esperamos o status
  // virar 'authenticated' (não mandamos pro /login no intervalo) — evita o loop.
  useEffect(() => {
    if (trocando || erro) return;
    if (status === 'authenticated') navigate('/dashboard', { replace: true });
    else if (status === 'unauthenticated' && !trocaOk) navigate('/login', { replace: true });
  }, [status, trocando, erro, trocaOk, navigate]);

  if (erro) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-bg px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">Não foi possível concluir o login</h1>
          <p className="mt-2 break-words text-sm text-muted-foreground">{erro}</p>
          <Button asChild className="mt-6">
            <Link to="/login">Voltar ao login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page-bg">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Concluindo o login...
      </div>
    </div>
  );
}
