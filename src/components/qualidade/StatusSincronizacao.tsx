import { AlertTriangle, CheckCircle2, CloudOff, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { useQualidade } from '@/qualidade/QualidadeProvider';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fDataHora } from '@chaves/domain/format';
import { cn } from '@/lib/utils';

/** Indicador compacto do estado offline/sincronização, para os cabeçalhos da Qualidade. */
export function StatusSincronizacao({ className }: { className?: string }): React.JSX.Element {
  const { status, sincronizarAgora } = useQualidade();

  let icone = <CheckCircle2 className="h-4 w-4 text-success" />;
  let texto = 'Sincronizado';
  let detalhe = status.ultimaSincronizacao
    ? `Última sincronização: ${fDataHora(status.ultimaSincronizacao)}`
    : 'Tudo salvo no servidor.';

  if (!status.servidorConfigurado) {
    icone = <HardDrive className="h-4 w-4 text-muted-foreground" />;
    texto = 'Só neste aparelho';
    detalhe = 'Modo de desenvolvimento: os dados ficam salvos apenas neste navegador.';
  } else if (!status.online) {
    icone = <CloudOff className="h-4 w-4 text-amber-600" />;
    texto = status.pendentes > 0 ? `Offline · ${status.pendentes} para enviar` : 'Offline';
    detalhe =
      'Sem internet. Continue trabalhando: tudo fica salvo no aparelho e sobe quando a conexão voltar.';
  } else if (status.sincronizando) {
    icone = <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    texto = 'Sincronizando…';
  } else if (status.comErro > 0) {
    icone = <AlertTriangle className="h-4 w-4 text-destructive" />;
    texto = `${status.comErro} com erro`;
    detalhe =
      'Alguns registros foram recusados pelo servidor. Tente de novo ou avise o administrador.';
  } else if (status.erro) {
    icone = <AlertTriangle className="h-4 w-4 text-amber-600" />;
    texto = status.pendentes > 0 ? `${status.pendentes} para enviar` : 'Falha ao sincronizar';
    detalhe = status.erro;
  } else if (status.pendentes > 0) {
    icone = <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    texto = `${status.pendentes} para enviar`;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2', className)}
          onClick={sincronizarAgora}
          disabled={!status.servidorConfigurado || !status.online || status.sincronizando}
        >
          {icone}
          <span className="whitespace-nowrap">{texto}</span>
          {status.servidorConfigurado && status.online && !status.sincronizando && (
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{detalhe}</TooltipContent>
    </Tooltip>
  );
}
