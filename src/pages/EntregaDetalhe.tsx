import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  PenLine,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/data/DataProvider';
import { getEntregaDetalhe } from '@/data/selectors';
import { useSession } from '@/auth/SessionProvider';
import { podeTransicionar } from '@/domain/state-machine';
import type { EntregaStatus } from '@/domain/types';
import { EntregaStatusBadge } from '@/components/shared/StatusBadge';
import { EtapaTimeline } from '@/components/entregas/EtapaTimeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { copyToClipboard, downloadText } from '@/lib/browser';
import { fArea, fData, fDataHora, maskCpf } from '@/lib/format';

export function EntregaDetalhe(): React.JSX.Element {
  const { id = '' } = useParams();
  const { state, actions } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();

  const [trabalhando, setTrabalhando] = useState(false);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [novoItem, setNovoItem] = useState({ descricao: '', quantidade: '1' });

  const detalhe = getEntregaDetalhe(state, id);

  if (!detalhe) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Entrega não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/entregas')}>
          <ArrowLeft />
          Voltar para entregas
        </Button>
      </div>
    );
  }

  const { entrega, unidade, empreendimento, cliente, responsavel, documentos, assinatura, itens, auditoria } =
    detalhe;
  const assinado = assinatura?.assinadaEm != null;

  async function avancar(proximo: EntregaStatus, mensagem: string) {
    setTrabalhando(true);
    try {
      await actions.avancarEtapa(entrega.id, proximo, currentUser.id);
      toast.success(mensagem);
    } catch (e) {
      toast.error('Não foi possível avançar a etapa', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setTrabalhando(false);
    }
  }

  async function gerarLink() {
    setTrabalhando(true);
    try {
      const { url } = await actions.gerarLinkAssinatura(entrega.id, currentUser.id);
      setLinkGerado(url);
    } catch {
      toast.error('Falha ao gerar o link de assinatura');
    } finally {
      setTrabalhando(false);
    }
  }

  function baixarDoc(tipo: string) {
    downloadText(
      `termo-entrega-${entrega.id}.txt`,
      `${tipo}\n\nCliente: ${cliente?.nome}\nUnidade: ${unidade?.identificacao}\nEmpreendimento: ${empreendimento?.nome}\n\n(Prévia mock — o PDF real é gerado no servidor, etapa 7.)`,
    );
  }

  function adicionarItem() {
    const desc = novoItem.descricao.trim();
    const qtd = parseInt(novoItem.quantidade, 10);
    if (!desc || Number.isNaN(qtd) || qtd < 1) {
      toast.error('Informe descrição e quantidade válida');
      return;
    }
    actions.adicionarItem(entrega.id, desc, qtd, currentUser.id);
    setNovoItem({ descricao: '', quantidade: '1' });
  }

  return (
    <>
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4 safe-px md:px-8">
        <div className="mx-auto max-w-[1400px]">
          <Link
            to="/entregas"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Entregas
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {unidade?.identificacao}
              </h1>
              <p className="text-sm text-muted-foreground">
                {empreendimento?.nome} · {cliente?.nome}
              </p>
            </div>
            <EntregaStatusBadge status={entrega.status} className="px-3 py-1 text-sm" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 safe-px md:px-8 md:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Coluna esquerda: timeline + ação */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Etapas</CardTitle>
              </CardHeader>
              <CardContent>
                <EtapaTimeline atual={entrega.status} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ação da etapa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AcaoEtapa
                  status={entrega.status}
                  assinado={assinado}
                  trabalhando={trabalhando}
                  temItens={itens.length > 0}
                  onIntegrar={() => avancar('INTEGRACAO', 'Dados carregados do CRM/ERP')}
                  onGerarDocs={() => avancar('DOCUMENTOS', 'Documentos gerados')}
                  onEnviarAssinatura={() => avancar('ASSINATURA', 'Pronto para assinatura')}
                  onRegistrar={() => avancar('REGISTRO', 'Entrega registrada')}
                  onConcluir={() => avancar('CONCLUIDA', 'Entrega concluída 🎉')}
                  onGerarLink={gerarLink}
                />
              </CardContent>
            </Card>
          </div>

          {/* Coluna direita: detalhes */}
          <div className="space-y-6 lg:col-span-2">
            {/* Cliente + Unidade */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <Info label="Nome" value={cliente?.nome} />
                  <Info label="CPF" value={cliente ? maskCpf(cliente.cpf) : undefined} />
                  <Info label="E-mail" value={cliente?.email} />
                  <Info label="Telefone" value={cliente?.telefone} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Unidade</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <Info label="Identificação" value={unidade?.identificacao} />
                  <Info label="Empreendimento" value={empreendimento?.nome} />
                  <Info
                    label="Localização"
                    value={empreendimento ? `${empreendimento.cidade}/${empreendimento.uf}` : undefined}
                  />
                  <Info label="Área" value={unidade ? fArea(unidade.areaM2) : undefined} />
                  <Info label="Responsável" value={responsavel?.nome} />
                </CardContent>
              </Card>
            </div>

            {/* Documentos */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  Documentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum documento gerado. Avance para a etapa de Documentos.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {documentos.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{d.tipo}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            sha256: {d.sha256Hash.slice(0, 24)}… · {fData(d.geradoEm)}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => baixarDoc(d.tipo)}>
                          <Download />
                          Baixar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Assinatura */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PenLine className="h-4 w-4 text-primary" />
                  Assinatura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {assinado ? (
                  <div className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-success">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Assinada via {assinatura?.metodo}</p>
                      <p className="text-xs text-success/80">
                        {fDataHora(assinatura?.assinadaEm)} · Clicksign: {assinatura?.clicksignStatus}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Assinatura pendente. Gere o link e envie ao cliente para assinar no portal.
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={gerarLink} disabled={trabalhando}>
                  <Link2 />
                  Gerar link de assinatura
                </Button>
              </CardContent>
            </Card>

            {/* Itens entregues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  Itens entregues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {itens.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item registrado.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {itens.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="text-sm text-foreground">
                          <span className="font-semibold tabular-nums">{i.quantidade}×</span>{' '}
                          {i.descricao}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover item"
                          onClick={() => actions.removerItem(i.id)}
                        >
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-end gap-2">
                  <Input
                    type="number"
                    min={1}
                    className="w-20"
                    value={novoItem.quantidade}
                    onChange={(e) => setNovoItem((s) => ({ ...s, quantidade: e.target.value }))}
                  />
                  <Input
                    placeholder="Descrição (ex: Chave da porta principal)"
                    value={novoItem.descricao}
                    onChange={(e) => setNovoItem((s) => ({ ...s, descricao: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && adicionarItem()}
                  />
                  <Button onClick={adicionarItem}>
                    <Plus />
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Auditoria */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Trilha de auditoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {auditoria.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-foreground">
                          <span className="font-medium">{a.action}</span>{' '}
                          <span className="text-muted-foreground">por {a.actor}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{fDataHora(a.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal do link gerado */}
      <Dialog open={linkGerado !== null} onOpenChange={(v) => !v && setLinkGerado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de assinatura gerado</DialogTitle>
            <DialogDescription>
              Envie este link ao cliente. Ele expira em 72h, é de uso único e dá acesso apenas a esta
              entrega.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={linkGerado ?? ''} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar"
              onClick={async () => {
                const ok = await copyToClipboard(linkGerado ?? '');
                toast[ok ? 'success' : 'error'](ok ? 'Link copiado' : 'Falha ao copiar');
              }}
            >
              <Copy />
            </Button>
          </div>
          <Button asChild variant="outline">
            <a href={linkGerado ?? '#'} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Abrir portal do cliente
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Info({ label, value }: { label: string; value: string | undefined }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value ?? '-'}</span>
    </div>
  );
}

function AcaoEtapa({
  status,
  assinado,
  trabalhando,
  temItens,
  onIntegrar,
  onGerarDocs,
  onEnviarAssinatura,
  onRegistrar,
  onConcluir,
  onGerarLink,
}: {
  status: EntregaStatus;
  assinado: boolean;
  trabalhando: boolean;
  temItens: boolean;
  onIntegrar: () => void;
  onGerarDocs: () => void;
  onEnviarAssinatura: () => void;
  onRegistrar: () => void;
  onConcluir: () => void;
  onGerarLink: () => void;
}): React.JSX.Element {
  if (status === 'CONCLUIDA') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
        <ShieldCheck className="h-4 w-4" />
        Entrega concluída. Trilha de auditoria completa.
      </div>
    );
  }

  switch (status) {
    case 'ABERTURA':
      return (
        <ActionRow
          texto="Carregar dados do cliente e da unidade (CRM/ERP)."
          botao="Carregar dados"
          onClick={onIntegrar}
          disabled={trabalhando}
          enabled={podeTransicionar('ABERTURA', 'INTEGRACAO')}
        />
      );
    case 'INTEGRACAO':
      return (
        <ActionRow
          texto="Gerar o termo de entrega com os dados carregados."
          botao="Gerar documentos"
          onClick={onGerarDocs}
          disabled={trabalhando}
          enabled
        />
      );
    case 'DOCUMENTOS':
      return (
        <ActionRow
          texto="Disponibilizar os documentos e abrir a etapa de assinatura."
          botao="Enviar para assinatura"
          onClick={onEnviarAssinatura}
          disabled={trabalhando}
          enabled
        />
      );
    case 'ASSINATURA':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {assinado
              ? 'Assinatura recebida. Você já pode registrar a entrega.'
              : 'Aguardando o cliente assinar. Gere e envie o link de assinatura.'}
          </p>
          {!assinado && (
            <Button variant="outline" size="sm" onClick={onGerarLink} disabled={trabalhando}>
              <Link2 />
              Gerar link
            </Button>
          )}
          <Button className="w-full" onClick={onRegistrar} disabled={trabalhando || !assinado}>
            Registrar entrega
          </Button>
        </div>
      );
    case 'REGISTRO':
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Registre os itens entregues (chaves, controles, manuais) e conclua.
          </p>
          {!temItens && (
            <p className="text-xs text-amber-600">Adicione ao menos um item antes de concluir.</p>
          )}
          <Button className="w-full" onClick={onConcluir} disabled={trabalhando || !temItens}>
            Concluir entrega
          </Button>
        </div>
      );
    default:
      return <></>;
  }
}

function ActionRow({
  texto,
  botao,
  onClick,
  disabled,
  enabled,
}: {
  texto: string;
  botao: string;
  onClick: () => void;
  disabled: boolean;
  enabled: boolean;
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{texto}</p>
      <Button className="w-full" onClick={onClick} disabled={disabled || !enabled}>
        {botao}
      </Button>
    </div>
  );
}
