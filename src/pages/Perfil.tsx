import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronRight,
  CircleUserRound,
  FileText,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useSession } from '@/auth/SessionProvider';
import { deleteAccountRemote } from '@/auth/deleteAccount';
import { PAPEL_META } from '@/domain/status';
import { fData } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { ExcluirContaDialog } from '@/components/perfil/ExcluirContaDialog';

/** Placeholder: será preenchido quando o vínculo contrato ↔ usuário for integrado. */
function MeuEmpreendimentoCard(): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meu empreendimento</CardTitle>
        <CardDescription>Dados do seu contrato com a Rottas</CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={Building2}
          titulo="Em breve"
          descricao="As informações do seu empreendimento e da sua unidade de referência aparecerão aqui."
        />
      </CardContent>
    </Card>
  );
}

function LinkLegal({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof FileText;
  label: string;
}): React.JSX.Element {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

export function Perfil(): React.JSX.Element {
  const { currentUser } = useSession();
  const { mode, logout } = useAuth();
  const navigate = useNavigate();

  async function handleExcluir(): Promise<void> {
    try {
      if (mode === 'entra') {
        await deleteAccountRemote();
        toast.success('Conta excluída', {
          description: 'Todos os seus dados foram removidos da plataforma.',
        });
      } else {
        // Modo dev: sem backend — simula a exclusão e encerra a sessão local.
        await new Promise((r) => setTimeout(r, 800));
        toast.success('Conta excluída (simulado — modo desenvolvimento)', {
          description: 'No modo real, todos os dados seriam removidos da plataforma.',
        });
        logout();
      }
      navigate('/login', { replace: true });
    } catch (e) {
      toast.error('Não foi possível excluir a conta', {
        description: e instanceof Error ? e.message : 'Tente novamente em instantes.',
      });
      throw e; // mantém o dialog aberto com o estado preservado
    }
  }

  return (
    <>
      <PageHeader
        icon={CircleUserRound}
        titulo="Meu perfil"
        subtitulo="Seus dados e preferências de conta"
      />
      <PageContent>
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {/* Identidade */}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 p-6">
              <UserAvatar
                nome={currentUser.nome}
                avatarUrl={currentUser.avatarUrl}
                className="h-16 w-16 text-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold text-foreground">{currentUser.nome}</p>
                  <Badge variant="secondary">{PAPEL_META[currentUser.papel].label}</Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{currentUser.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cadastrado em {fData(currentUser.criadoEm)}
                </p>
              </div>
            </CardContent>
          </Card>

          <MeuEmpreendimentoCard />

          {/* Legal */}
          <Card>
            <CardHeader>
              <CardTitle>Termos e privacidade</CardTitle>
              <CardDescription>Documentos que regulam o uso da plataforma</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <LinkLegal to="/termos-de-uso" icon={FileText} label="Termos de Uso" />
              <LinkLegal to="/politica-de-privacidade" icon={Shield} label="Política de Privacidade" />
            </CardContent>
          </Card>

          {/* Zona de perigo (LGPD) */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-4 w-4" />
                Zona de perigo
              </CardTitle>
              <CardDescription>
                Conforme a LGPD, você pode excluir sua conta a qualquer momento. Todas as
                informações da sua conta serão apagadas de forma permanente e irreversível.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExcluirContaDialog onConfirm={handleExcluir} />
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </>
  );
}
