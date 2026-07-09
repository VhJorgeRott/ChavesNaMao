import { useEffect, useState } from 'react';
import { Building2, FileText, KeyRound, Loader2, TriangleAlert, User } from 'lucide-react';
import { adapters } from '@/adapters';
import type { SituacaoFinanceira } from '@/adapters/types';
import type { UnidadeResumo } from '@/data/selectors';
import type { Cliente } from '@/domain/types';
import { UNIDADE_STATUS_META } from '@/domain/status';
import { InadimplenciaBadge, UnidadeStatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { fArea, fMoeda, maskCpf } from '@/lib/format';

interface InfoIntegracao {
  cliente?: string;
  contrato?: string;
  inadimplente?: boolean;
}

interface UnidadeDetalheDialogProps {
  /** Resumo da unidade selecionada; `null` mantém o diálogo fechado. */
  resumo: UnidadeResumo | null;
  info: InfoIntegracao | undefined;
  onOpenChange: (open: boolean) => void;
  iniciando: boolean;
  onIniciar: () => void;
  onVerEntrega: () => void;
}

/**
 * Cadastro/detalhe de uma unidade. Reúne os dados já carregados na tabela
 * (contrato, cliente, inadimplência) e busca, sob demanda, os dados completos
 * do cliente (CRM) e a situação financeira (ERP/Mega) para apoiar a decisão de
 * iniciar — ou não — a entrega. Falhas de integração são degradadas em silêncio:
 * mostramos o que já temos e sinalizamos o que não foi possível carregar.
 */
export function UnidadeDetalheDialog({
  resumo,
  info,
  onOpenChange,
  iniciando,
  onIniciar,
  onVerEntrega,
}: UnidadeDetalheDialogProps): React.JSX.Element {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [situacao, setSituacao] = useState<SituacaoFinanceira | null>(null);
  const [carregando, setCarregando] = useState(false);

  const unidadeId = resumo?.unidade.id;
  const nomeBusca = info?.cliente ?? null;

  useEffect(() => {
    if (!unidadeId) return;
    let ativo = true;
    setCliente(null);
    setSituacao(null);
    setCarregando(true);
    void Promise.allSettled([
      adapters.crm.getClienteByUnidade(unidadeId, { nome: nomeBusca }),
      adapters.erp.getSituacaoFinanceira(unidadeId),
    ]).then(([resCliente, resSituacao]) => {
      if (!ativo) return;
      if (resCliente.status === 'fulfilled') setCliente(resCliente.value);
      if (resSituacao.status === 'fulfilled') setSituacao(resSituacao.value);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [unidadeId, nomeBusca]);

  const unidade = resumo?.unidade;
  const empreendimento = resumo?.empreendimento;
  const entregaAtiva = resumo?.entregaAtiva;
  const inadimplente = info?.inadimplente ?? unidade?.inadimplente;
  const nomeCliente = cliente?.nome ?? info?.cliente ?? null;
  const numeroContrato = situacao?.numeroContrato ?? info?.contrato ?? null;

  return (
    <Dialog open={resumo !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {unidade && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate">{unidade.identificacao}</DialogTitle>
                  <p className="truncate text-sm text-muted-foreground">
                    {empreendimento
                      ? `${empreendimento.nome} · ${empreendimento.cidade}/${empreendimento.uf}`
                      : 'Empreendimento'}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <UnidadeStatusBadge status={unidade.status} />
                  {inadimplente !== undefined && <InadimplenciaBadge inadimplente={inadimplente} />}
                </div>
              </div>
            </DialogHeader>

            <Secao icon={User} titulo="Cliente">
              <Info label="Nome" value={nomeCliente} />
              <Info label="CPF" value={cliente ? maskCpf(cliente.cpf) : null} />
              <Info label="E-mail" value={cliente?.email ?? null} />
              <Info label="Telefone" value={cliente?.telefone ?? null} />
            </Secao>

            <Separator />

            <Secao icon={FileText} titulo="Unidade e contrato">
              <Info label="Contrato" value={numeroContrato} />
              <Info label="Identificação" value={unidade.identificacao} />
              <Info label="Status" value={UNIDADE_STATUS_META[unidade.status].label} />
              <Info label="Área privativa" value={fArea(unidade.areaM2)} />
            </Secao>

            {situacao && (
              <>
                <Separator />
                <Secao icon={TriangleAlert} titulo="Situação financeira (Mega)">
                  <Info label="Valor do contrato" value={fMoeda(situacao.valorContrato)} />
                  <Info label="Saldo devedor" value={fMoeda(situacao.saldoDevedor)} />
                  <Info label="Parcelas em aberto" value={String(situacao.parcelasEmAberto)} />
                  <Info label="Quitada" value={situacao.quitada ? 'Sim' : 'Não'} />
                </Secao>
              </>
            )}

            {carregando && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Carregando dados do cliente e situação financeira...
              </p>
            )}

            <DialogFooter>
              {entregaAtiva ? (
                <Button variant="outline" onClick={onVerEntrega}>
                  Ver entrega
                </Button>
              ) : (
                <Button disabled={iniciando} onClick={onIniciar}>
                  <KeyRound />
                  {iniciando ? 'Iniciando...' : 'Iniciar entrega'}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Bloco de seção com título e ícone dentro do diálogo. */
function Secao({
  icon: Icon,
  titulo,
  children,
}: {
  icon: typeof Building2;
  titulo: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {titulo}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</dl>
    </div>
  );
}

/** Par rótulo/valor. Valores nulos são exibidos como "—". */
function Info({ label, value }: { label: string; value: string | null }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
