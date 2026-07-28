import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  PenLine,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/data/DataProvider';
import { getEntregaDetalhe } from '@/data/selectors';
import { useSession } from '@/auth/SessionProvider';
import type { Assinatura, EntregaStatus } from '@chaves/domain/types';
import {
  listarPendencias,
  verificarSignatario,
  type PendenciaSignatario,
} from '@chaves/domain/signatario';
import { EntregaStatusBadge, InadimplenciaBadge } from '@/components/shared/StatusBadge';
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
import { SignatureCanvas, type SignatureCanvasHandle } from '@/components/portal/SignatureCanvas';
import { copyToClipboard, imprimirDocumento, pedirGeolocalizacao } from '@/lib/browser';
import { cn } from '@/lib/utils';
import { renderTermo } from '@chaves/domain/termo';
import { fArea, fData, fDataHora, maskCpf } from '@chaves/domain/format';

export function EntregaDetalhe(): React.JSX.Element {
  const { id = '' } = useParams();
  const { state, actions } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();

  const [trabalhando, setTrabalhando] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  const [colhendoAssinatura, setColhendoAssinatura] = useState(false);
  const [novoItem, setNovoItem] = useState({ descricao: '', quantidade: '1' });

  const detalhe = getEntregaDetalhe(state, id);
  const entregaExiste = detalhe !== null;

  // Carga automática dos dados de integração (CRM/ERP) ao abrir a entrega. Isso
  // substitui a antiga etapa manual de "Integração": ninguém precisa clicar em
  // "Carregar dados". Falhas de CRM já são degradadas no provider (cai para o
  // nome vindo do ERP), então aqui só reportamos o que for inesperado.
  //
  // A dica de nome entra nas dependências de propósito. Numa entrega aberta logo
  // após o refresh, o catálogo do Mega — quem sabe o nome do cliente — ainda pode
  // estar a caminho; quando ele chega, o efeito roda de novo e aí sim o CV
  // consegue localizar a pessoa. Sem isso, a busca ficaria presa no resultado
  // vazio da primeira tentativa.
  const dicaCliente = detalhe?.unidade?.clienteNome ?? null;
  const { sincronizarDadosEntrega } = actions;
  useEffect(() => {
    if (!entregaExiste) {
      setCarregandoDados(false);
      return;
    }
    let ativo = true;
    setCarregandoDados(true);
    sincronizarDadosEntrega(id)
      .catch((e: unknown) => {
        if (!ativo) return;
        toast.error('Não foi possível carregar os dados das integrações', {
          description: e instanceof Error ? e.message : undefined,
        });
      })
      .finally(() => {
        if (ativo) setCarregandoDados(false);
      });
    return () => {
      ativo = false;
    };
  }, [id, entregaExiste, dicaCliente, sincronizarDadosEntrega]);

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

  const {
    entrega,
    unidade,
    empreendimento,
    cliente,
    responsavel,
    documentos,
    assinatura,
    assinaturaConfissao,
    itens,
    auditoria,
  } = detalhe;
  const assinado = assinatura?.assinadaEm != null;
  const confissaoAssinada = assinaturaConfissao?.assinadaEm != null;
  const confissaoEnviada = assinaturaConfissao != null;
  // O que falta no cadastro do cliente para a Clicksign aceitar o signatário.
  const pendenciaSignatario = verificarSignatario(cliente);

  async function enviarConfissao() {
    setTrabalhando(true);
    try {
      const { signUrl } = await actions.enviarConfissaoParaAssinatura(entrega.id, currentUser.id);
      if (signUrl) setLinkGerado(signUrl);
      toast.success('Confissão de dívida enviada para assinatura');
    } catch (e) {
      toast.error('Não foi possível enviar para a Clicksign', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setTrabalhando(false);
    }
  }

  async function confirmarConfissao() {
    setTrabalhando(true);
    try {
      await actions.confirmarConfissaoAssinada(entrega.id, currentUser.id, { manual: true });
      toast.success('Confissão marcada como assinada', {
        description: 'Registrado na auditoria como confirmação manual.',
      });
    } catch (e) {
      toast.error('Não foi possível confirmar a assinatura', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setTrabalhando(false);
    }
  }

  async function colherAssinatura(pngDataUrl: string, geo: { lat: number; lng: number } | null) {
    await actions.registrarAssinaturaPresencial(entrega.id, pngDataUrl, geo, currentUser.id);
    setColhendoAssinatura(false);
    toast.success('Assinatura registrada');
  }

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

  /**
   * Abre o documento. Prefere o PDF real guardado no bucket privado; se ele
   * ainda não foi gerado para esta entrega, cai para a renderização do modelo em
   * tela. A distinção importa: o PDF é o arquivo que foi (ou será) assinado, a
   * renderização é só uma prévia do texto.
   */
  async function verDocumento(tipo: string) {
    try {
      const url = await actions.urlArquivoEntrega(entrega.id, tipo);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      toast.info('PDF ainda não gerado para esta entrega', {
        description: 'Exibindo a prévia do termo a partir do modelo.',
      });
    } catch (e) {
      toast.error('Não foi possível abrir o documento', {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }
    imprimirPrevia(tipo);
  }

  /** Ver o traço da assinatura colhida — arquivo privado, via URL assinada. */
  async function verAssinatura() {
    try {
      const url = await actions.urlArquivoEntrega(entrega.id, 'assinatura');
      if (!url) {
        toast.info('Assinatura ainda não disponível para visualização');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error('Não foi possível abrir a assinatura', {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  function imprimirPrevia(tipo: string) {
    // Renderiza o termo real escolhendo o modelo pelo TIPO do documento
    // (Confissão de Dívida vs Recebimento de Chaves) e abre a impressão do
    // navegador (o usuário salva como PDF). Sem modelo, cai para texto mínimo.
    const ehConfissao = /confiss/i.test(tipo);
    const modelo =
      state.modelos.find((m) =>
        ehConfissao ? /confiss/i.test(m.nome) : /(entrega|recebimento)/i.test(m.nome),
      ) ?? state.modelos[0];
    const contexto = {
      ...(cliente ? { cliente } : {}),
      ...(unidade ? { unidade } : {}),
      ...(empreendimento ? { empreendimento } : {}),
    };
    const conteudo = modelo
      ? renderTermo(modelo.conteudo, contexto)
      : `${tipo}\n\nCliente: ${cliente?.nome ?? '-'}\nUnidade: ${unidade?.identificacao ?? '-'}\n` +
        `Empreendimento: ${empreendimento?.nome ?? '-'}`;
    imprimirDocumento(tipo, conteudo);
  }

  async function adicionarItem() {
    const desc = novoItem.descricao.trim();
    const qtd = parseInt(novoItem.quantidade, 10);
    if (!desc || Number.isNaN(qtd) || qtd < 1) {
      toast.error('Informe descrição e quantidade válida');
      return;
    }
    try {
      await actions.adicionarItem(entrega.id, desc, qtd, currentUser.id);
      setNovoItem({ descricao: '', quantidade: '1' });
    } catch (e) {
      toast.error('Não foi possível registrar o item', {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function removerItem(itemId: string) {
    try {
      await actions.removerItem(itemId);
    } catch (e) {
      toast.error('Não foi possível remover o item', {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <>
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4 safe-px md:px-8">
        <div className="mx-auto max-w-[1400px]">
          {/* Volta para a lista de unidades do empreendimento — é de lá que a
              entrega é iniciada. Sem empreendimento resolvido, cai no índice. */}
          <Link
            to={unidade ? `/unidades/${unidade.empreendimentoId}` : '/unidades'}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {empreendimento?.nome ?? 'Unidades'}
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
                  confissaoAssinada={confissaoAssinada}
                  confissaoEnviada={confissaoEnviada}
                  pendenciaSignatario={pendenciaSignatario}
                  trabalhando={trabalhando}
                  carregandoDados={carregandoDados}
                  temItens={itens.length > 0}
                  onGerarDocs={() => avancar('DOCUMENTOS', 'Documentos gerados')}
                  onIrParaConfissao={() =>
                    avancar('CONFISSAO', 'Etapa de confissão de dívida aberta')
                  }
                  onEnviarConfissao={enviarConfissao}
                  onConfirmarConfissao={confirmarConfissao}
                  onEnviarAssinatura={() => avancar('ASSINATURA', 'Pronto para a entrega')}
                  onColherAssinatura={() => setColhendoAssinatura(true)}
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
                  {unidade?.inadimplente !== undefined && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Situação</span>
                      <InadimplenciaBadge inadimplente={unidade.inadimplente} />
                    </div>
                  )}
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
                        <Button variant="outline" size="sm" onClick={() => void verDocumento(d.tipo)}>
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
                {/* As duas assinaturas do processo, na ordem em que acontecem. */}
                <LinhaAssinatura
                  titulo="Confissão de dívida"
                  descricaoPendente="Aguardando assinatura do cliente na Clicksign."
                  assinatura={assinaturaConfissao}
                />
                <LinhaAssinatura
                  titulo="Recebimento de chaves"
                  descricaoPendente="Assinada presencialmente no dia da entrega."
                  assinatura={assinatura}
                  {...(assinado ? { onVer: () => void verAssinatura() } : {})}
                />
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
                          onClick={() => void removerItem(i.id)}
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
                    onKeyDown={(e) => e.key === 'Enter' && void adicionarItem()}
                  />
                  <Button onClick={() => void adicionarItem()}>
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

      {/* Coleta presencial da assinatura, no dispositivo de quem atende */}
      <AssinaturaPresencialDialog
        aberto={colhendoAssinatura}
        onFechar={() => setColhendoAssinatura(false)}
        nomeCliente={cliente?.nome ?? 'Cliente'}
        identificacaoUnidade={unidade?.identificacao ?? ''}
        onConfirmar={colherAssinatura}
      />

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

/**
 * Coleta da assinatura do Recebimento de Chaves no ato da entrega.
 *
 * Mesmo canvas do portal do cliente — o que muda é só quem segura o aparelho.
 * A geolocalização segue opcional e por consentimento explícito, como no portal.
 */
function AssinaturaPresencialDialog({
  aberto,
  onFechar,
  nomeCliente,
  identificacaoUnidade,
  onConfirmar,
}: {
  aberto: boolean;
  onFechar: () => void;
  nomeCliente: string;
  identificacaoUnidade: string;
  onConfirmar: (png: string, geo: { lat: number; lng: number } | null) => Promise<void>;
}): React.JSX.Element {
  const canvasRef = useRef<SignatureCanvasHandle>(null);
  const [temTraco, setTemTraco] = useState(false);
  const [consentGeo, setConsentGeo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    const png = canvasRef.current?.toDataURL();
    if (!png) return;
    setEnviando(true);
    try {
      const geo = consentGeo ? await pedirGeolocalizacao() : null;
      await onConfirmar(png, geo);
      canvasRef.current?.clear();
      setTemTraco(false);
      setConsentGeo(false);
    } catch (e) {
      toast.error('Não foi possível registrar a assinatura', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !enviando && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assinatura do recebimento</DialogTitle>
          <DialogDescription>
            {nomeCliente}
            {identificacaoUnidade ? ` · ${identificacaoUnidade}` : ''} — peça ao cliente que assine
            no campo abaixo.
          </DialogDescription>
        </DialogHeader>

        <SignatureCanvas
          ref={canvasRef}
          className="h-44 w-full rounded-lg border border-border bg-card"
          onInkChange={setTemTraco}
        />

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consentGeo}
            onChange={(e) => setConsentGeo(e.target.checked)}
          />
          Registrar a localização no momento da assinatura (opcional).
        </label>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              canvasRef.current?.clear();
              setTemTraco(false);
            }}
            disabled={enviando || !temTraco}
          >
            Limpar
          </Button>
          <Button onClick={confirmar} disabled={enviando || !temTraco}>
            {enviando ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Confirmar assinatura
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Uma das duas assinaturas do processo, assinada ou pendente. */
function LinhaAssinatura({
  titulo,
  descricaoPendente,
  assinatura,
  onVer,
}: {
  titulo: string;
  descricaoPendente: string;
  assinatura: Assinatura | undefined;
  /** Presente só quando há arquivo para exibir (o traço do canvas). */
  onVer?: () => void;
}): React.JSX.Element {
  const assinada = assinatura?.assinadaEm != null;
  // Confirmação manual precisa se distinguir de uma assinatura de verdade.
  const manual = assinatura?.clicksignStatus === 'confirmado_manualmente';
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg p-3',
        assinada ? 'bg-success/10 text-success' : 'bg-muted/50 text-muted-foreground',
      )}
    >
      {assinada ? (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{titulo}</p>
        {assinada ? (
          <p className={cn('text-xs', manual ? 'text-amber-600' : 'text-success/80')}>
            {manual ? 'Confirmada manualmente pela equipe' : `Assinada via ${assinatura?.metodo}`} ·{' '}
            {fDataHora(assinatura?.assinadaEm)}
          </p>
        ) : (
          <p className="text-xs">{descricaoPendente}</p>
        )}
      </div>
      {assinada && onVer && (
        <Button variant="ghost" size="sm" className="shrink-0" onClick={onVer}>
          <Eye />
          Ver
        </Button>
      )}
    </div>
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
  confissaoAssinada,
  confissaoEnviada,
  pendenciaSignatario,
  trabalhando,
  carregandoDados,
  temItens,
  onGerarDocs,
  onIrParaConfissao,
  onEnviarConfissao,
  onConfirmarConfissao,
  onEnviarAssinatura,
  onColherAssinatura,
  onRegistrar,
  onConcluir,
  onGerarLink,
}: {
  status: EntregaStatus;
  assinado: boolean;
  confissaoAssinada: boolean;
  confissaoEnviada: boolean;
  pendenciaSignatario: PendenciaSignatario | null;
  trabalhando: boolean;
  carregandoDados: boolean;
  temItens: boolean;
  onGerarDocs: () => void;
  onIrParaConfissao: () => void;
  onEnviarConfissao: () => void;
  onConfirmarConfissao: () => void;
  onEnviarAssinatura: () => void;
  onColherAssinatura: () => void;
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
      // Os dados de CRM/ERP chegam sozinhos ao abrir a entrega — enquanto isso
      // não termina, gerar o termo usaria um cadastro possivelmente defasado.
      return carregandoDados ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando dados do cliente e da unidade (CRM/ERP)…
        </div>
      ) : (
        <ActionRow
          texto="Dados do cliente e da unidade carregados das integrações. Gere o termo de entrega."
          botao="Gerar documentos"
          onClick={onGerarDocs}
          disabled={trabalhando}
          enabled
        />
      );
    case 'DOCUMENTOS':
      return (
        <ActionRow
          texto="Documentos gerados. Siga para a confissão de dívida, que o cliente assina antes de receber as chaves."
          botao="Ir para confissão de dívida"
          onClick={onIrParaConfissao}
          disabled={trabalhando}
          enabled
        />
      );
    case 'CONFISSAO':
      // Primeira das duas assinaturas: remota, via Clicksign. A entrega só fica
      // liberada depois dela — por isso "Liberar para entrega" exige a confissão
      // assinada, seja pelo provedor ou por confirmação manual da equipe.
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {confissaoAssinada
              ? 'Confissão de dívida assinada. O cliente está apto a receber as chaves.'
              : confissaoEnviada
                ? 'Enviada ao cliente. Aguardando a assinatura na Clicksign.'
                : 'Envie o termo de confissão de dívida para o cliente assinar na Clicksign.'}
          </p>
          {!confissaoAssinada && (
            <>
              {/* Envio bloqueado enquanto o cadastro não tiver o que a Clicksign
                  exige — o aviso diz o que falta e onde resolver. */}
              {pendenciaSignatario && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold">
                      Não é possível enviar: falta {listarPendencias(pendenciaSignatario)}.
                    </p>
                    <p className="mt-0.5">
                      Esses dados vêm do CV CRM. Complete o cadastro da pessoa por lá e recarregue
                      esta entrega.
                    </p>
                  </div>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onEnviarConfissao}
                disabled={trabalhando || pendenciaSignatario !== null}
              >
                <Send />
                {confissaoEnviada ? 'Reenviar para assinatura' : 'Enviar para assinatura'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={onConfirmarConfissao}
                disabled={trabalhando}
              >
                Marcar como assinada
              </Button>
              <p className="text-xs text-muted-foreground">
                A marcação manual fica registrada na auditoria como tal.
              </p>
            </>
          )}
          <Button
            className="w-full"
            onClick={onEnviarAssinatura}
            disabled={trabalhando || !confissaoAssinada}
          >
            Liberar para entrega
          </Button>
        </div>
      );
    case 'ASSINATURA':
      // Segunda assinatura: presencial, no dia da entrega, no aparelho de quem
      // atende. O link continua disponível para quando o cliente não está junto.
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {assinado
              ? 'Recebimento de chaves assinado. Você já pode registrar a entrega.'
              : 'No ato da entrega, colha a assinatura do cliente neste dispositivo.'}
          </p>
          {!assinado && (
            <>
              <Button className="w-full" onClick={onColherAssinatura} disabled={trabalhando}>
                <PenLine />
                Colher assinatura
              </Button>
              <Button variant="ghost" size="sm" onClick={onGerarLink} disabled={trabalhando}>
                <Link2 />
                Enviar link ao cliente
              </Button>
            </>
          )}
          <Button
            className="w-full"
            variant={assinado ? 'default' : 'outline'}
            onClick={onRegistrar}
            disabled={trabalhando || !assinado}
          >
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
