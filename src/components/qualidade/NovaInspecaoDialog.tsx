import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { criarInspecao, type ModeloFvs } from '@chaves/domain/qualidade';
import { useData } from '@/data/DataProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { agoraIso, novoId, useQualidade } from '@/qualidade/QualidadeProvider';

const NENHUMA = '__nenhuma__';

/**
 * Início de inspeção: modelo + local. Pensado para ser rápido em campo — só o
 * empreendimento é obrigatório; unidade vem do catálogo (se já carregado neste
 * aparelho) e bloco/detalhe são texto livre.
 */
export function NovaInspecaoDialog({
  aberto,
  onOpenChange,
  modelos,
}: {
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  modelos: ModeloFvs[];
}): React.JSX.Element {
  const navigate = useNavigate();
  const { repo, usuario } = useQualidade();
  const { state, actions } = useData();
  const { garantirEmpreendimentos, garantirUnidades } = actions;

  const [modeloId, setModeloId] = useState('');
  const [empreendimentoId, setEmpreendimentoId] = useState('');
  const [unidadeId, setUnidadeId] = useState(NENHUMA);
  const [bloco, setBloco] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [codigo, setCodigo] = useState('');
  const [identificador, setIdentificador] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [dataAtendimento, setDataAtendimento] = useState('');
  const [validade, setValidade] = useState('');
  const [salvando, setSalvando] = useState(false);

  const ativos = useMemo(
    () => modelos.filter((m) => m.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [modelos],
  );
  const empreendimentos = useMemo(
    () => [...state.empreendimentos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [state.empreendimentos],
  );
  const empreendimento = empreendimentos.find((e) => e.id === empreendimentoId);
  const unidades = useMemo(
    () =>
      state.unidades
        .filter((u) => u.empreendimentoId === empreendimentoId)
        .sort((a, b) => a.identificacao.localeCompare(b.identificacao, 'pt-BR', { numeric: true })),
    [state.unidades, empreendimentoId],
  );

  // Garante a lista de empreendimentos (do cache, se offline).
  useEffect(() => {
    if (aberto) void garantirEmpreendimentos().catch(() => undefined);
  }, [aberto, garantirEmpreendimentos]);

  // Carrega unidades do empreendimento escolhido (falha offline é esperada).
  useEffect(() => {
    if (empreendimento) void garantirUnidades(empreendimento).catch(() => undefined);
  }, [empreendimento, garantirUnidades]);

  useEffect(() => {
    if (!aberto) return;
    if (ativos.length === 1) setModeloId(ativos[0]!.id);
  }, [aberto, ativos]);

  async function iniciar() {
    const modelo = ativos.find((m) => m.id === modeloId);
    if (!repo || !modelo || !empreendimento) return;
    const unidade = unidades.find((u) => u.id === unidadeId);
    const inspecao = criarInspecao(
      modelo,
      {
        local: {
          empreendimentoRef: empreendimento.id,
          empreendimentoNome: empreendimento.nome,
          codigo: codigo.trim() || null,
          bloco: bloco.trim() || null,
          unidadeRef: unidade?.id ?? null,
          unidadeNome: unidade?.identificacao ?? null,
          detalhe: detalhe.trim() || null,
        },
        identificador: identificador.trim() || null,
        fornecedor: fornecedor.trim() || null,
        responsavel: responsavel.trim() || null,
        dataAtendimento: dataAtendimento || null,
        validade: validade || null,
      },
      usuario,
      agoraIso(),
      novoId,
    );
    setSalvando(true);
    try {
      await repo.salvarInspecao(inspecao);
      onOpenChange(false);
      navigate(`/qualidade/inspecoes/${inspecao.id}`);
    } catch (e) {
      toast.error('Não foi possível iniciar a inspeção', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova inspeção</DialogTitle>
          <DialogDescription>Escolha a ficha e onde ela será aplicada.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Modelo de FVS</Label>
            <Select value={modeloId} onValueChange={setModeloId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a ficha" />
              </SelectTrigger>
              <SelectContent>
                {ativos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.codigo ? `${m.codigo} · ` : ''}
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Empreendimento</Label>
            <Select
              value={empreendimentoId}
              onValueChange={(v) => {
                setEmpreendimentoId(v);
                setUnidadeId(NENHUMA);
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    empreendimentos.length === 0
                      ? 'Nenhum empreendimento neste aparelho'
                      : 'Selecione o empreendimento'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {empreendimentos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bloco">Bloco / quadra</Label>
              <Input
                id="bloco"
                value={bloco}
                onChange={(e) => setBloco(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId} disabled={!empreendimento}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NENHUMA}>Sem unidade (área comum / geral)</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.identificacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="detalhe">Pavimento, ambiente ou trecho</Label>
              <Input
                id="detalhe"
                value={detalhe}
                onChange={(e) => setDetalhe(e.target.value)}
                placeholder="Ex.: 6o pavimento"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="codigo-local">Código do local</Label>
              <Input
                id="codigo-local"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex.: 01.01.06"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="identificador">Identificador do que será verificado</Label>
            <Input
              id="identificador"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="Ex.: parede de concreto 601, 602 A"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fornecedor">Fornecedor / empreiteiro</Label>
              <Input
                id="fornecedor"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                placeholder="Quem executou o serviço"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="responsavel-servico">Responsável pelo serviço</Label>
              <Input
                id="responsavel-servico"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome do responsável em campo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data-atendimento">Data do atendimento</Label>
              <Input
                id="data-atendimento"
                type="date"
                value={dataAtendimento}
                onChange={(e) => setDataAtendimento(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="validade">Validade da verificação</Label>
              <Input
                id="validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void iniciar()}
            disabled={!modeloId || !empreendimento || salvando}
          >
            {salvando ? <Loader2 className="animate-spin" /> : <Play />}
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
