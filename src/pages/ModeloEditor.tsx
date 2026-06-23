import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Save } from 'lucide-react';
import { toast } from 'sonner';
import { adapters } from '@/adapters';
import type { SituacaoFinanceira } from '@/adapters/types';
import { useData } from '@/data/DataProvider';
import { useSession } from '@/auth/SessionProvider';
import {
  CATALOGO_VARIAVEIS,
  renderTermo,
  variaveisInvalidas,
  type TermoContexto,
} from '@/domain/termo';
import type { Cliente } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ModeloEditor(): React.JSX.Element {
  const { id = 'novo' } = useParams();
  const { state, actions } = useData();
  const { currentUser } = useSession();
  const navigate = useNavigate();

  const existente = id !== 'novo' ? state.modelos.find((m) => m.id === id) : undefined;
  const ehNovo = id === 'novo';

  const [nome, setNome] = useState(existente?.nome ?? '');
  const [conteudo, setConteudo] = useState(existente?.conteudo ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Redireciona se o id não existe.
  useEffect(() => {
    if (!ehNovo && !existente) navigate('/modelos', { replace: true });
  }, [ehNovo, existente, navigate]);

  // Pré-visualização: contexto resolvido (CRM + ERP) para a unidade escolhida.
  const [previewUnidadeId, setPreviewUnidadeId] = useState<string>(
    () => state.unidades[0]?.id ?? '',
  );
  const [ctx, setCtx] = useState<TermoContexto>({});

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const unidade = state.unidades.find((u) => u.id === previewUnidadeId);
      const empreendimento = unidade
        ? state.empreendimentos.find((e) => e.id === unidade.empreendimentoId)
        : undefined;
      let cliente: Cliente | undefined;
      let financeiro: SituacaoFinanceira | undefined;
      try {
        cliente = await adapters.crm.getClienteByUnidade(previewUnidadeId);
      } catch {
        /* unidade sem cliente */
      }
      try {
        financeiro = await adapters.erp.getSituacaoFinanceira(previewUnidadeId);
      } catch {
        /* unidade sem dados financeiros */
      }
      if (!ativo) return;
      const novo: TermoContexto = {};
      if (unidade) novo.unidade = unidade;
      if (empreendimento) novo.empreendimento = empreendimento;
      if (cliente) novo.cliente = cliente;
      if (financeiro) novo.financeiro = financeiro;
      setCtx(novo);
    })();
    return () => {
      ativo = false;
    };
  }, [previewUnidadeId, state.unidades, state.empreendimentos]);

  const invalidas = useMemo(() => variaveisInvalidas(conteudo), [conteudo]);
  const preview = useMemo(() => renderTermo(conteudo, ctx), [conteudo, ctx]);

  function inserirVariavel(chave: string) {
    const token = `{{${chave}}}`;
    const ta = textareaRef.current;
    if (!ta) {
      setConteudo((c) => c + token);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setConteudo(conteudo.slice(0, start) + token + conteudo.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function salvar() {
    if (!nome.trim() || !conteudo.trim()) {
      toast.error('Informe o nome e o conteúdo do modelo');
      return;
    }
    if (ehNovo) actions.criarModelo(nome.trim(), conteudo, currentUser.id);
    else actions.atualizarModelo(id, { nome: nome.trim(), conteudo }, currentUser.id);
    toast.success('Modelo salvo');
    navigate('/modelos');
  }

  return (
    <>
      <header className="border-b border-border bg-card px-4 py-4 safe-px md:px-8">
        <div className="mx-auto max-w-[1400px]">
          <Link
            to="/modelos"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Modelos
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {ehNovo ? 'Novo modelo' : 'Editar modelo'}
            </h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/modelos')}>
                Cancelar
              </Button>
              <Button onClick={salvar}>
                <Save />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 safe-px md:px-8 md:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Editor */}
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome do modelo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Termo de Entrega de Chaves"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conteudo">Conteúdo do termo</Label>
                  <textarea
                    id="conteudo"
                    ref={textareaRef}
                    value={conteudo}
                    onChange={(e) => setConteudo(e.target.value)}
                    placeholder="Escreva o termo e insira variáveis com os botões ao lado..."
                    className="min-h-[340px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {invalidas.length > 0 && (
                    <p className="text-xs text-destructive">
                      Variáveis não reconhecidas: {invalidas.map((v) => `{{${v}}}`).join(', ')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Variáveis disponíveis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <p className="text-xs text-muted-foreground">
                  Clique para inserir no ponto do cursor. Na geração, cada variável puxa o dado real
                  da unidade.
                </p>
                {CATALOGO_VARIAVEIS.map((g) => (
                  <div key={g.grupo}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {g.grupo}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.itens.map((v) => (
                        <button
                          key={v.chave}
                          type="button"
                          onClick={() => inserirVariavel(v.chave)}
                          className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                          title={`{{${v.chave}}}`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Pré-visualização */}
          <div>
            <Card className="lg:sticky lg:top-6">
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Eye className="h-4 w-4 text-primary" />
                  Pré-visualização
                </CardTitle>
                <Select value={previewUnidadeId} onValueChange={setPreviewUnidadeId}>
                  <SelectTrigger className="h-8 w-[220px] text-xs">
                    <SelectValue placeholder="Unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.identificacao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="min-h-[340px] whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed text-foreground">
                  {conteudo.trim() ? preview : (
                    <span className="text-muted-foreground">
                      A pré-visualização do termo aparece aqui.
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Resolvido com os dados de <span className="font-medium">{ctx.cliente?.nome ?? '—'}</span>{' '}
                  (cliente do CRM) e contrato {ctx.financeiro?.numeroContrato ?? '—'} (ERP).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
