import { useEffect, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  FileText,
  Gavel,
  Headset,
  KeyRound,
  Loader2,
  MessagesSquare,
  PackageCheck,
  TriangleAlert,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { adapters } from '@/adapters';
import type {
  ChamadoAssistencia,
  FluxoAssistencia,
  SituacaoClienteCv,
  SituacaoFinanceira,
} from '@/adapters/types';
import type { UnidadeResumo } from '@/data/selectors';
import type { Cliente } from '@chaves/domain/types';
import { ENTREGA_STATUS_META, UNIDADE_STATUS_META } from '@chaves/domain/status';
import { UnidadeStatusBadge } from '@/components/shared/StatusBadge';
import { ChamadoSituacaoBadge, SlaVencidoBadge } from '@/components/assistencia/ChamadoSituacaoBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { fArea, fData, fMoeda, maskCpf } from '@chaves/domain/format';
import { cn } from '@/lib/utils';

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

/** Unidades sem venda: não há cliente, contrato nem entrega. */
const SEM_VENDA = ['DISPONIVEL', 'EM_OBRAS'];

interface Chamados {
  assistencia: ChamadoAssistencia[];
  entregaChaves: ChamadoAssistencia[];
  /** O servidor ainda não filtra por unidade (função não atualizada). */
  incompleto: boolean;
}

const aberto = (c: ChamadoAssistencia): boolean => c.fase === 'nova' || c.fase === 'andamento';

/**
 * Chamados da unidade no CV. O filtro por unidade roda no servidor; o filtro
 * repetido aqui protege contra uma versão da função que ainda o ignore — nesse
 * caso a lista vem recortada e sinalizamos em vez de mostrar dado de outra
 * unidade.
 */
async function buscarChamados(empreendimentoId: string, unidadeId: string): Promise<Chamados> {
  const porFluxo = async (fluxo: FluxoAssistencia) => {
    const pagina = await adapters.assistencia.listarChamados({
      fluxo,
      empreendimentoId,
      unidadeId,
      porPagina: 100,
    });
    const daUnidade = pagina.itens.filter((c) => c.unidade?.id === unidadeId);
    return { itens: daUnidade, incompleto: daUnidade.length < pagina.itens.length };
  };
  const [at, ec] = await Promise.all([porFluxo('ASSISTENCIA_TECNICA'), porFluxo('ENTREGA_CHAVES')]);
  return {
    assistencia: at.itens,
    entregaChaves: ec.itens,
    incompleto: at.incompleto || ec.incompleto,
  };
}

/**
 * Ficha da unidade: um panorama do que está acontecendo com ela, reunindo o
 * que vem de cada sistema — cadastro e chamados do CV, contrato e
 * inadimplência do Mega, entrega do próprio app. Cada fonte carrega e falha
 * de forma independente: mostramos o que chegou e sinalizamos o resto.
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
  const [carregandoCliente, setCarregandoCliente] = useState(false);
  const [chamados, setChamados] = useState<Chamados | null>(null);
  const [carregandoChamados, setCarregandoChamados] = useState(false);
  const [erroChamados, setErroChamados] = useState(false);
  const [situacaoCliente, setSituacaoCliente] = useState<SituacaoClienteCv | null>(null);
  const [carregandoSituacaoCliente, setCarregandoSituacaoCliente] = useState(false);
  const [erroSituacaoCliente, setErroSituacaoCliente] = useState(false);

  const unidadeId = resumo?.unidade.id;
  const empreendimentoId = resumo?.unidade.empreendimentoId;
  const cvUnidadeId = resumo?.unidade.cvUnidadeId ?? null;
  const nomeBusca = info?.cliente ?? null;
  const semVenda = resumo ? SEM_VENDA.includes(resumo.unidade.status) : false;

  // Cliente (CV) e situação financeira (Mega) — só faz sentido com venda.
  useEffect(() => {
    // Limpa antes de sair: sem isso, abrir uma unidade sem venda depois de uma
    // vendida manteria o cliente (e o relacionamento) da anterior.
    setCliente(null);
    setSituacao(null);
    if (!unidadeId || semVenda) return;
    let ativo = true;
    setCarregandoCliente(true);
    void Promise.allSettled([
      adapters.crm.getClienteByUnidade(unidadeId, {
        nome: nomeBusca,
        cvUnidade:
          empreendimentoId && cvUnidadeId ? { empreendimentoId, unidadeId: cvUnidadeId } : null,
      }),
      adapters.erp.getSituacaoFinanceira(unidadeId),
    ]).then(([resCliente, resSituacao]) => {
      if (!ativo) return;
      if (resCliente.status === 'fulfilled') setCliente(resCliente.value);
      if (resSituacao.status === 'fulfilled') setSituacao(resSituacao.value);
      setCarregandoCliente(false);
    });
    return () => {
      ativo = false;
    };
  }, [unidadeId, nomeBusca, semVenda, empreendimentoId, cvUnidadeId]);

  // Relacionamento e jurídico: a API do CV só filtra pelo CPF, então esperam o
  // cliente ser resolvido.
  const cpf = cliente?.cpf ?? null;
  useEffect(() => {
    setSituacaoCliente(null);
    setErroSituacaoCliente(false);
    if (!cpf) return;
    let ativo = true;
    setCarregandoSituacaoCliente(true);
    adapters.crm
      .getSituacaoCliente(cpf)
      .then((r) => {
        if (ativo) setSituacaoCliente(r);
      })
      .catch(() => {
        if (ativo) setErroSituacaoCliente(true);
      })
      .finally(() => {
        if (ativo) setCarregandoSituacaoCliente(false);
      });
    return () => {
      ativo = false;
    };
  }, [cpf]);

  // Chamados de assistência e de entrega de chaves no CV.
  useEffect(() => {
    if (!empreendimentoId || !cvUnidadeId) return;
    let ativo = true;
    setChamados(null);
    setErroChamados(false);
    setCarregandoChamados(true);
    buscarChamados(empreendimentoId, cvUnidadeId)
      .then((r) => {
        if (ativo) setChamados(r);
      })
      .catch(() => {
        if (ativo) setErroChamados(true);
      })
      .finally(() => {
        if (ativo) setCarregandoChamados(false);
      });
    return () => {
      ativo = false;
    };
  }, [empreendimentoId, cvUnidadeId]);

  const unidade = resumo?.unidade;
  const empreendimento = resumo?.empreendimento;
  const entregaAtiva = resumo?.entregaAtiva;
  const inadimplente = info?.inadimplente ?? unidade?.inadimplente;
  const nomeCliente = cliente?.nome ?? info?.cliente ?? null;
  const numeroContrato = situacao?.numeroContrato ?? info?.contrato ?? null;

  const atAbertos = chamados?.assistencia.filter(aberto) ?? [];
  const slaVencidos = atAbertos.filter((c) => c.slaVencido).length;
  const ecAberto = chamados?.entregaChaves.find(aberto) ?? null;
  const todosChamados = chamados
    ? [...chamados.assistencia, ...chamados.entregaChaves].sort(
        (a, b) =>
          Number(aberto(b)) - Number(aberto(a)) || (b.abertoEm ?? '').localeCompare(a.abertoEm ?? ''),
      )
    : [];

  // Atendimentos desta unidade ou sem unidade vinculada (assuntos gerais do
  // cliente); os de outras unidades do mesmo cliente ficam de fora.
  const atendimentos =
    situacaoCliente?.atendimentos.filter(
      (a) => a.unidadeId === null || a.unidadeId === cvUnidadeId,
    ) ?? [];
  const atendimentosAbertos = atendimentos.filter((a) => a.aberto);
  const juridico = situacaoCliente?.juridico ?? null;

  // Estado comum aos indicadores que dependem do cliente (relacionamento e jurídico).
  const estadoCliente: Pick<IndicadorProps, 'carregando' | 'valor' | 'tom'> | null = semVenda
    ? { valor: 'Sem venda', tom: 'neutro' }
    : carregandoCliente || carregandoSituacaoCliente
      ? { carregando: true, valor: '', tom: 'neutro' }
      : !cpf
        ? { valor: 'Cliente não localizado no CV', tom: 'neutro' }
        : erroSituacaoCliente
          ? { valor: 'Falha ao consultar o CV', tom: 'neutro' }
          : null;

  const semDadosCv = !cvUnidadeId;
  const estadoChamados: Pick<IndicadorProps, 'carregando' | 'valor' | 'tom'> | null =
    carregandoChamados
      ? { carregando: true, valor: '', tom: 'neutro' }
      : semDadosCv
        ? { valor: 'Sem cadastro no CV', tom: 'neutro' }
        : erroChamados
          ? { valor: 'Falha ao consultar o CV', tom: 'neutro' }
          : null;

  return (
    <Dialog open={resumo !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
                <div className="ml-auto shrink-0">
                  <UnidadeStatusBadge status={unidade.status} />
                </div>
              </div>
            </DialogHeader>

            {/* Panorama: o que está acontecendo com a unidade, sistema a sistema. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Indicador
                icon={Wallet}
                titulo="Financeiro (Mega)"
                {...(semVenda
                  ? { valor: 'Sem venda', tom: 'neutro' }
                  : inadimplente === true
                    ? { valor: 'Inadimplente', tom: 'alerta' }
                    : inadimplente === false
                      ? { valor: 'Em dia', tom: 'ok' }
                      : { valor: 'Sem contrato no Mega', tom: 'neutro' })}
              />
              <Indicador
                icon={Headset}
                titulo="Assistência técnica"
                {...(estadoChamados ??
                  (atAbertos.length > 0
                    ? {
                        valor: `${atAbertos.length} em aberto`,
                        detalhe: slaVencidos > 0 ? `${slaVencidos} com SLA vencido` : undefined,
                        tom: slaVencidos > 0 ? 'alerta' : 'atencao',
                      }
                    : { valor: 'Nenhuma em aberto', tom: 'ok' }))}
              />
              <Indicador
                icon={KeyRound}
                titulo="Vistoria e entrega (CV)"
                {...(estadoChamados ??
                  (ecAberto
                    ? { valor: ecAberto.situacao, detalhe: `Aberto em ${fData(ecAberto.abertoEm)}`, tom: 'atencao' }
                    : { valor: 'Nenhum agendamento', tom: 'neutro' }))}
              />
              <Indicador
                icon={PackageCheck}
                titulo="Entrega no app"
                {...(entregaAtiva
                  ? { valor: ENTREGA_STATUS_META[entregaAtiva.status].label, tom: 'atencao' }
                  : unidade.status === 'ENTREGUE'
                    ? { valor: 'Entregue', tom: 'ok' }
                    : { valor: 'Não iniciada', tom: 'neutro' })}
              />
              <Indicador
                icon={MessagesSquare}
                titulo="Relacionamento"
                {...(estadoCliente ??
                  (atendimentosAbertos.length > 0
                    ? {
                        valor: `${atendimentosAbertos.length} em aberto`,
                        detalhe: atendimentosAbertos[0]?.titulo,
                        tom: 'atencao',
                      }
                    : { valor: 'Nenhum em aberto', tom: 'ok' }))}
              />
              <Indicador
                icon={Gavel}
                titulo="Jurídico"
                {...(estadoCliente ??
                  (juridico?.ativo === true
                    ? { valor: 'Sinalizado no jurídico', tom: 'alerta' }
                    : juridico?.ativo === false
                      ? { valor: 'Sem sinalização', tom: 'ok' }
                      : { valor: 'Cliente não localizado no CV', tom: 'neutro' }))}
              />
              <Indicador
                icon={ClipboardCheck}
                titulo="Vistoria de unidade"
                valor="Módulo em construção"
                tom="pendente"
              />
            </div>

            <Separator />

            {!semVenda && (
              <>
                <Secao icon={User} titulo="Cliente">
                  <Info label="Nome" value={nomeCliente} />
                  <Info label="CPF" value={cliente ? maskCpf(cliente.cpf) : null} />
                  <Info label="E-mail" value={cliente?.email ?? null} />
                  <Info label="Telefone" value={cliente?.telefone ?? null} />
                </Secao>
                <Separator />
              </>
            )}

            <Secao icon={FileText} titulo="Unidade e contrato">
              <Info label="Contrato" value={numeroContrato} />
              <Info label="Status" value={UNIDADE_STATUS_META[unidade.status].label} />
              <Info label="Situação no CV" value={capitalizar(unidade.situacaoCv)} />
              {unidade.motivoBloqueioCv && (
                <Info label="Motivo do bloqueio" value={unidade.motivoBloqueioCv} />
              )}
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

            {carregandoCliente && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Carregando dados do cliente e situação financeira...
              </p>
            )}

            {atendimentos.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MessagesSquare className="h-4 w-4 text-muted-foreground" />
                    Atendimentos de relacionamento
                  </div>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {atendimentos.map((a) => (
                      <li key={a.id} className="flex flex-col gap-1 px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {a.protocolo ?? `#${a.id}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fData(a.abertoEm)}
                            {a.responsavel ? ` · ${a.responsavel}` : ''}
                          </span>
                          <span
                            className={cn(
                              'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
                              a.aberto
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {a.situacao}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {[a.titulo, a.subassunto].filter(Boolean).join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {todosChamados.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Headset className="h-4 w-4 text-muted-foreground" />
                    Chamados no CV
                  </div>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {todosChamados.map((c) => (
                      <li key={c.id} className="flex flex-col gap-1.5 px-3 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {c.protocolo ?? `#${c.id}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {c.fluxo === 'ENTREGA_CHAVES' ? 'Entrega de chaves' : 'Assistência'} ·{' '}
                            {fData(c.abertoEm)}
                          </span>
                          <span className="ml-auto flex items-center gap-1.5">
                            {c.slaVencido && aberto(c) && <SlaVencidoBadge />}
                            <ChamadoSituacaoBadge chamado={c} />
                          </span>
                        </div>
                        {c.descricao && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{c.descricao}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {chamados?.incompleto && (
              <p className="text-xs text-muted-foreground">
                A lista de chamados pode estar incompleta: a função <code>crm-assistencias</code>{' '}
                precisa ser atualizada para filtrar por unidade.
              </p>
            )}

            {!semVenda && (
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
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function capitalizar(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Tom = 'ok' | 'atencao' | 'alerta' | 'neutro' | 'pendente';

const TOM_CLASSES: Record<Tom, string> = {
  ok: 'border-success/30 bg-success/5 [&_[data-valor]]:text-success',
  atencao: 'border-amber-300/60 bg-amber-50 [&_[data-valor]]:text-amber-700',
  alerta: 'border-destructive/30 bg-destructive/5 [&_[data-valor]]:text-destructive',
  neutro: 'border-border bg-card',
  pendente: 'border-dashed border-border bg-muted/30 [&_[data-valor]]:text-muted-foreground',
};

interface IndicadorProps {
  icon: LucideIcon;
  titulo: string;
  valor: string;
  detalhe?: string | undefined;
  tom: Tom;
  carregando?: boolean;
}

/** Cartão do panorama: um sistema, uma leitura rápida do estado da unidade nele. */
function Indicador({
  icon: Icon,
  titulo,
  valor,
  detalhe,
  tom,
  carregando = false,
}: IndicadorProps): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', TOM_CLASSES[tom])}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {titulo}
      </div>
      {carregando ? (
        <Loader2 className="mt-1.5 h-4 w-4 animate-spin text-primary" />
      ) : (
        <>
          <p data-valor className="mt-1 truncate text-sm font-semibold text-foreground">
            {valor}
          </p>
          {detalhe && <p className="truncate text-xs text-muted-foreground">{detalhe}</p>}
        </>
      )}
    </div>
  );
}

/** Bloco de seção com título e ícone dentro do diálogo. */
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
