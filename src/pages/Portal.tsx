import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { getEntregaDetalhe } from '@/data/selectors';
import { SignatureCanvas, type SignatureCanvasHandle } from '@/components/portal/SignatureCanvas';
import { Button } from '@/components/ui/button';
import { fArea, maskCpf } from '@/lib/format';

type Fase = 'carregando' | 'invalido' | 'pronto' | 'enviando' | 'concluido';

function pedirGeolocalizacao(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 },
    );
  });
}

export function Portal(): React.JSX.Element {
  const { token = '' } = useParams();
  const { state, actions } = useData();

  const [fase, setFase] = useState<Fase>('carregando');
  const [entregaId, setEntregaId] = useState<string | null>(null);
  const [consentGeo, setConsentGeo] = useState(false);
  const [temTraco, setTemTraco] = useState(false);
  const canvasRef = useRef<SignatureCanvasHandle>(null);

  useEffect(() => {
    let ativo = true;
    void actions.resolverToken(token).then((r) => {
      if (!ativo) return;
      if (r.ok) {
        setEntregaId(r.entregaId);
        setFase('pronto');
      } else {
        // Resposta idêntica para inválido/expirado/usado — não vaza existência.
        setFase('invalido');
      }
    });
    return () => {
      ativo = false;
    };
  }, [token, actions]);

  const detalhe = entregaId ? getEntregaDetalhe(state, entregaId) : null;

  async function confirmar() {
    const png = canvasRef.current?.toDataURL();
    if (!png) return;
    setFase('enviando');
    const geo = consentGeo ? await pedirGeolocalizacao() : null;
    const r = await actions.registrarAssinaturaPorToken(token, png, geo);
    setFase(r.ok ? 'concluido' : 'invalido');
  }

  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      {/* Topbar */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">Chaves na Mão</p>
            <p className="text-[11px] text-muted-foreground">Portal de assinatura · Rottas</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:py-10">
        {fase === 'carregando' && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Validando o link...
          </div>
        )}

        {fase === 'invalido' && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-destructive" />
            <h1 className="text-lg font-semibold text-foreground">Link inválido ou expirado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Este link de assinatura não é mais válido. Solicite um novo à equipe da Rottas.
            </p>
          </div>
        )}

        {fase === 'concluido' && (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
            <h1 className="text-lg font-semibold text-foreground">Assinatura concluída!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Recebemos sua assinatura. A equipe da Rottas dará seguimento à entrega. Você pode
              fechar esta página.
            </p>
          </div>
        )}

        {(fase === 'pronto' || fase === 'enviando') && detalhe && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5">
              <h1 className="text-lg font-bold text-foreground">Termo de Entrega de Chaves</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Confira os dados, leia os termos e assine no campo abaixo.
              </p>
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Linha rotulo="Cliente" valor={detalhe.cliente?.nome} />
                <Linha rotulo="CPF" valor={detalhe.cliente ? maskCpf(detalhe.cliente.cpf) : undefined} />
                <Linha rotulo="Unidade" valor={detalhe.unidade?.identificacao} />
                <Linha rotulo="Empreendimento" valor={detalhe.empreendimento?.nome} />
                <Linha
                  rotulo="Área"
                  valor={detalhe.unidade ? fArea(detalhe.unidade.areaM2) : undefined}
                />
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
              <p>
                Declaro, para os devidos fins, que recebi as chaves e itens da unidade acima
                identificada, em perfeitas condições, dando plena quitação à entrega objeto deste
                termo. A presente assinatura eletrônica possui validade jurídica nos termos da MP
                2.200-2/2001.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Sua assinatura</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    canvasRef.current?.clear();
                    setTemTraco(false);
                  }}
                >
                  <RotateCcw />
                  Limpar
                </Button>
              </div>
              <SignatureCanvas
                ref={canvasRef}
                onInkChange={setTemTraco}
                className="h-44 w-full touch-none rounded-lg border-2 border-dashed border-border bg-background"
              />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Assine usando o dedo, a caneta ou o mouse.
              </p>

              <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consentGeo}
                  onChange={(e) => setConsentGeo(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                />
                Autorizo o registro da minha geolocalização no momento da assinatura (opcional).
              </label>

              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={fase === 'enviando' || !temTraco}
                onClick={() => void confirmar()}
              >
                <ShieldCheck />
                {fase === 'enviando' ? 'Registrando...' : 'Confirmar e assinar'}
              </Button>
              {!temTraco && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Faça o traço da assinatura para habilitar a confirmação.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | undefined }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium text-foreground">{valor ?? '-'}</dd>
    </div>
  );
}
