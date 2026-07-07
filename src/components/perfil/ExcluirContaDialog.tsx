import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PALAVRA_CONFIRMACAO = 'EXCLUIR';

/**
 * Fluxo de exclusão de conta (LGPD): exige ciência explícita (checkbox) e a
 * digitação de "EXCLUIR" antes de habilitar a ação destrutiva.
 */
export function ExcluirContaDialog({
  onConfirm,
}: {
  /** Executa a exclusão; deve lançar Error com mensagem exibível em falha. */
  onConfirm(): Promise<void>;
}): React.JSX.Element {
  const [aberto, setAberto] = useState(false);
  const [ciente, setCiente] = useState(false);
  const [palavra, setPalavra] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const podeExcluir = ciente && palavra.trim().toUpperCase() === PALAVRA_CONFIRMACAO;

  function mudarAberto(v: boolean): void {
    if (excluindo) return; // não fecha durante a exclusão
    setAberto(v);
    if (!v) {
      setCiente(false);
      setPalavra('');
    }
  }

  async function excluir(): Promise<void> {
    setExcluindo(true);
    try {
      await onConfirm();
      setAberto(false);
    } catch {
      // Falha já exibida pelo onConfirm (toast); dialog permanece aberto.
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={mudarAberto}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" />
          Excluir minha conta
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Excluir sua conta permanentemente?</DialogTitle>
          <DialogDescription>
            Todas as informações da sua conta serão apagadas de forma permanente e irreversível,
            conforme previsto na LGPD e nos nossos{' '}
            <Link
              to="/termos-de-uso"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              Termos de Uso
            </Link>{' '}
            e{' '}
            <Link
              to="/politica-de-privacidade"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              Política de Privacidade
            </Link>
            . Você perderá o acesso à plataforma e aos dados do seu empreendimento.
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3">
          <Checkbox
            checked={ciente}
            onChange={(e) => setCiente(e.target.checked)}
            disabled={excluindo}
            className="mt-0.5"
          />
          <span className="text-sm leading-relaxed text-foreground">
            Estou ciente de que esta ação é <strong>irreversível</strong> e de que todas as
            informações da minha conta serão excluídas.
          </span>
        </label>

        <div className="space-y-1.5">
          <Label htmlFor="confirmar-exclusao">
            Digite <code className="rounded bg-muted px-1 font-semibold">{PALAVRA_CONFIRMACAO}</code>{' '}
            para confirmar
          </Label>
          <Input
            id="confirmar-exclusao"
            value={palavra}
            onChange={(e) => setPalavra(e.target.value)}
            disabled={excluindo}
            autoComplete="off"
            placeholder={PALAVRA_CONFIRMACAO}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={excluindo}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!podeExcluir || excluindo}
            onClick={() => void excluir()}
          >
            {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
