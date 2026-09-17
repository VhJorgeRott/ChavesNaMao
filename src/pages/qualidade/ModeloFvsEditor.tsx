import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  ClipboardList,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type EstruturaFvs,
  type ItemModeloFvs,
  type ModeloFvs,
  type SecaoModeloFvs,
  validarEstrutura,
} from '@chaves/domain/qualidade';
import { PageContent, PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { agoraIso, novoId, useQualidade } from '@/qualidade/QualidadeProvider';
import { cn } from '@/lib/utils';

function novoItem(): ItemModeloFvs {
  return { id: novoId(), texto: '', criterio: null, metodo: null, fotoObrigatoriaNc: true };
}

function novaSecao(): SecaoModeloFvs {
  return { id: novoId(), titulo: '', itens: [novoItem()] };
}

function mover<T>(lista: T[], de: number, para: number): T[] {
  if (para < 0 || para >= lista.length) return lista;
  const copia = [...lista];
  const [x] = copia.splice(de, 1);
  copia.splice(para, 0, x!);
  return copia;
}

const vazioParaNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

export function ModeloFvsEditor(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const ehNovo = !id || id === 'novo';
  const navigate = useNavigate();
  const { repo } = useQualidade();

  const original = useRef<ModeloFvs | null>(null);
  const [carregado, setCarregado] = useState(ehNovo);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);

  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [servico, setServico] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [secoes, setSecoes] = useState<SecaoModeloFvs[]>(() => [novaSecao()]);

  // Foco no item recém-criado por Enter, para cadastrar a lista em sequência.
  const focarItem = useRef<string | null>(null);

  useEffect(() => {
    if (ehNovo || !repo) return;
    void repo.obterModelo(id).then((m) => {
      if (!m) {
        toast.error('Modelo não encontrado neste aparelho');
        navigate('/qualidade/modelos', { replace: true });
        return;
      }
      original.current = m;
      setNome(m.nome);
      setCodigo(m.codigo ?? '');
      setServico(m.servico ?? '');
      setDescricao(m.descricao ?? '');
      setAtivo(m.ativo);
      setSecoes(m.estrutura.secoes);
      setCarregado(true);
    });
  }, [ehNovo, id, repo, navigate]);

  useEffect(() => {
    if (!focarItem.current) return;
    document.getElementById(`item-${focarItem.current}`)?.focus();
    focarItem.current = null;
  });

  const atualizarSecao = (i: number, patch: Partial<SecaoModeloFvs>) =>
    setSecoes((ss) => ss.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  const atualizarItem = (i: number, j: number, patch: Partial<ItemModeloFvs>) =>
    setSecoes((ss) =>
      ss.map((s, k) =>
        k === i ? { ...s, itens: s.itens.map((it, l) => (l === j ? { ...it, ...patch } : it)) } : s,
      ),
    );

  const adicionarItem = (i: number, depoisDe?: number) => {
    const item = novoItem();
    focarItem.current = item.id;
    setSecoes((ss) =>
      ss.map((s, k) => {
        if (k !== i) return s;
        const itens = [...s.itens];
        itens.splice(depoisDe === undefined ? itens.length : depoisDe + 1, 0, item);
        return { ...s, itens };
      }),
    );
  };

  async function salvar() {
    if (!repo) return;
    const estrutura: EstruturaFvs = {
      secoes: secoes.map((s) => ({
        ...s,
        titulo: s.titulo.trim(),
        itens: s.itens
          .filter((it) => it.texto.trim() !== '' || it.criterio || it.metodo)
          .map((it) => ({ ...it, texto: it.texto.trim() })),
      })),
    };
    const problemas = [
      ...(nome.trim() ? [] : ['Informe o nome do modelo.']),
      ...validarEstrutura(estrutura),
    ];
    setErros(problemas);
    if (problemas.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const anterior = original.current;
    const mudouEstrutura =
      !anterior || JSON.stringify(anterior.estrutura) !== JSON.stringify(estrutura);
    const modelo: ModeloFvs = {
      id: anterior?.id ?? novoId(),
      nome: nome.trim(),
      codigo: vazioParaNull(codigo),
      servico: vazioParaNull(servico),
      descricao: vazioParaNull(descricao),
      ativo,
      // Nova versão só quando os itens mudam: inspeções guardam a versão usada.
      versao: anterior ? anterior.versao + (mudouEstrutura ? 1 : 0) : 1,
      estrutura,
      atualizadoEm: agoraIso(),
    };

    setSalvando(true);
    try {
      await repo.salvarModelo(modelo);
      toast.success(ehNovo ? 'Modelo criado' : 'Modelo salvo', {
        description: mudouEstrutura && anterior ? `Versão ${modelo.versao}` : undefined,
      });
      navigate('/qualidade/modelos');
    } finally {
      setSalvando(false);
    }
  }

  if (!carregado) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalItens = secoes.reduce((s, sec) => s + sec.itens.length, 0);

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        titulo={ehNovo ? 'Novo modelo de FVS' : 'Editar modelo de FVS'}
        subtitulo={
          original.current
            ? `Versão ${original.current.versao} · ${totalItens} item(ns)`
            : `${totalItens} item(ns)`
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/qualidade/modelos')}>
              <ArrowLeft />
              Voltar
            </Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando ? <Loader2 className="animate-spin" /> : <Save />}
              Salvar
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="mx-auto max-w-4xl space-y-4">
          {erros.length > 0 && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="mb-1 font-semibold">Corrija antes de salvar:</p>
              <ul className="list-inside list-disc">
                {erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Alvenaria de vedação"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex.: FVS-05"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="servico">Serviço</Label>
                <Input
                  id="servico"
                  value={servico}
                  onChange={(e) => setServico(e.target.value)}
                  placeholder="Ex.: Alvenaria"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="descricao">Descrição / orientações</Label>
                <textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
                Ativo (disponível para novas inspeções)
              </label>
            </CardContent>
          </Card>

          {secoes.map((secao, i) => (
            <Card key={secao.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <Input
                    value={secao.titulo}
                    onChange={(e) => atualizarSecao(i, { titulo: e.target.value })}
                    placeholder="Título da seção (ex.: Execução)"
                    className="font-semibold"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Mover seção para cima"
                    disabled={i === 0}
                    onClick={() => setSecoes((ss) => mover(ss, i, i - 1))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Mover seção para baixo"
                    disabled={i === secoes.length - 1}
                    onClick={() => setSecoes((ss) => mover(ss, i, i + 1))}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover seção"
                    disabled={secoes.length === 1}
                    onClick={() => setSecoes((ss) => ss.filter((_, k) => k !== i))}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {secao.itens.map((item, j) => (
                    <div key={item.id} className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-2 w-6 shrink-0 text-right text-xs text-muted-foreground">
                          {i + 1}.{j + 1}
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <Input
                            id={`item-${item.id}`}
                            value={item.texto}
                            onChange={(e) => atualizarItem(i, j, { texto: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                adicionarItem(i, j);
                              }
                            }}
                            placeholder="O que verificar (Enter adiciona o próximo)"
                          />
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input
                              value={item.criterio ?? ''}
                              onChange={(e) =>
                                atualizarItem(i, j, { criterio: vazioParaNull(e.target.value) })
                              }
                              placeholder="Critério / tolerância"
                              className="text-xs"
                            />
                            <Input
                              value={item.metodo ?? ''}
                              onChange={(e) =>
                                atualizarItem(i, j, { metodo: vazioParaNull(e.target.value) })
                              }
                              placeholder="Método de verificação"
                              className="text-xs"
                            />
                          </div>
                          <label
                            className={cn(
                              'flex w-fit cursor-pointer items-center gap-2 text-xs',
                              item.fotoObrigatoriaNc ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            <Checkbox
                              checked={item.fotoObrigatoriaNc}
                              onChange={(e) =>
                                atualizarItem(i, j, { fotoObrigatoriaNc: e.target.checked })
                              }
                            />
                            <Camera className="h-3.5 w-3.5" />
                            Foto obrigatória quando não conforme
                          </label>
                        </div>
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Mover item para cima"
                            disabled={j === 0}
                            onClick={() =>
                              atualizarSecao(i, { itens: mover(secao.itens, j, j - 1) })
                            }
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Mover item para baixo"
                            disabled={j === secao.itens.length - 1}
                            onClick={() =>
                              atualizarSecao(i, { itens: mover(secao.itens, j, j + 1) })
                            }
                          >
                            <ArrowDown />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Remover item"
                            onClick={() =>
                              atualizarSecao(i, { itens: secao.itens.filter((_, l) => l !== j) })
                            }
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" onClick={() => adicionarItem(i)}>
                  <Plus />
                  Adicionar item
                </Button>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={() => setSecoes((ss) => [...ss, novaSecao()])}
          >
            <Plus />
            Adicionar seção
          </Button>

          {original.current && (
            <p className="text-center text-xs text-muted-foreground">
              Alterar os itens gera uma nova versão. Inspeções já feitas continuam com a versão que
              usaram.
            </p>
          )}
        </div>
      </PageContent>
    </>
  );
}
