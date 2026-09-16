import type { LucideIcon } from 'lucide-react';
import { Building2, ClipboardList, Headset, User, Wrench } from 'lucide-react';
import type { ChamadoAssistencia } from '@/adapters/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { fData, fDataHora } from '@chaves/domain/format';
import { ChamadoSituacaoBadge, SlaVencidoBadge } from './ChamadoSituacaoBadge';

function Secao({
  icon: Icon,
  titulo,
  children,
}: {
  icon: LucideIcon;
  titulo: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {titulo}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{value || '-'}</dd>
    </div>
  );
}

function Texto({ children }: { children: string }): React.JSX.Element {
  return (
    <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm text-foreground">
      {children}
    </p>
  );
}

export function ChamadoDetalheDialog({
  chamado,
  onOpenChange,
}: {
  chamado: ChamadoAssistencia | null;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  return (
    <Dialog open={chamado !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {chamado && (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Headset className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate">
                    Chamado {chamado.protocolo ?? `#${chamado.id}`}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Aberto em {fDataHora(chamado.abertoEm)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {chamado.slaVencido && <SlaVencidoBadge />}
                  <ChamadoSituacaoBadge chamado={chamado} />
                </div>
              </div>
            </DialogHeader>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardList className="h-4 w-4 text-primary" />
                Solicitação
              </h3>
              <Texto>{chamado.descricao || 'Sem descrição.'}</Texto>
            </section>

            {chamado.parecerTecnico && (
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wrench className="h-4 w-4 text-primary" />
                  Parecer técnico
                </h3>
                <Texto>{chamado.parecerTecnico}</Texto>
              </section>
            )}

            <Separator />

            <Secao icon={Building2} titulo="Local">
              <Info label="Empreendimento" value={chamado.empreendimento?.nome} />
              <Info
                label="Entrega do empreendimento"
                value={fData(chamado.empreendimento?.dataEntrega)}
              />
              <Info label="Bloco / quadra" value={chamado.bloco} />
              <Info label="Unidade" value={chamado.unidade?.nome} />
              <Info label="Localidade" value={chamado.localidade} />
              <Info label="Área comum" value={chamado.areaComum} />
            </Secao>

            <Separator />

            <Secao icon={User} titulo="Solicitante">
              <Info label="Cliente" value={chamado.cliente?.nome} />
              <Info label="Documento" value={chamado.cliente?.documento} />
              <Info label="E-mail" value={chamado.cliente?.email} />
              <Info label="Síndico" value={chamado.sindico} />
            </Secao>

            <p className="text-xs text-muted-foreground">
              ID no CV: {chamado.id}
              {chamado.atendimentoId && ` · Atendimento ${chamado.atendimentoId}`}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
